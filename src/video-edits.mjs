import {HttpError,text,uid} from './http.mjs';

export function videoEditorPeople(value){
 if(value===undefined)return undefined;
 if(!Array.isArray(value)||value.length>150)throw new HttpError(400,'אפשר לתייג עד 150 אנשים בסרטון.');
 return value.map(person=>{
  if(!person||Boolean(person.personId)===Boolean(person.name))throw new HttpError(400,'בחרו אדם מהרשימה או הזינו שם חדש.');
  return person.personId?{personId:text(person.personId,'אדם',80,true)}:{name:text(person.name,'שם',120,true).replace(/\s+/g,' ')};
 });
}
export class VideoEdits {
 constructor(owner){this.owner=owner;}
 expectations(source,p){
  if(p.expectedVideoRevision!==undefined&&p.expectedVideoRevision!==(source.videoRevision||'original')||p.expectedName!==undefined&&p.expectedName!==source.name||p.expectedCaption!==undefined&&p.expectedCaption!==(source.caption||''))throw new HttpError(409,'הסרטון או הכיתוב השתנו. פתחו את העורך מחדש.');
  if(p.expectedTagsRevision!==undefined&&p.expectedTagsRevision!==this.owner.tagsRevision(source.id))throw new HttpError(409,'התיוגים השתנו. פתחו את העורך מחדש.');
 }
 prepare(p){
  const source=this.owner.media(p.id);
  if(source.kind!=='video'&&!source.mime?.startsWith('video/'))throw new HttpError(400,'בחרו סרטון לעריכה.');
  if(!/^[a-f0-9]{32}$/.test(p.operationId||''))throw new HttpError(400,'אישור השמירה אינו תקין. פתחו את העורך מחדש.');
  const name=text(p.name,'שם הסרטון',140,true),caption=text(p.caption??name,'כיתוב הסרטון',5000),people=videoEditorPeople(p.people),range=p.range||null;
  if(range&&(!Number.isFinite(range.start)||!Number.isFinite(range.end)||range.start<0||range.end-range.start<.1||range.end>86400))throw new HttpError(400,'סמנו התחלה וסיום תקינים לקטע.');
  const fingerprint=JSON.stringify({name,caption,people,range});
  if(source.videoEdit?.operationId===p.operationId){if(source.videoEdit.fingerprint!==fingerprint)throw new HttpError(409,'פרטי העריכה השתנו. פתחו את העורך מחדש.');return {existing:{...this.owner.mediaChanged(source,'video-edit'),alreadySaved:true}};}
  if(range&&source.duration&&range.end>source.duration+.05)throw new HttpError(400,'סמנו התחלה וסיום תקינים לקטע.');
  this.expectations(source,p);
  return {source,operationId:p.operationId,name,caption,people,range,fingerprint,expectedVideoRevision:p.expectedVideoRevision,expectedName:p.expectedName,expectedCaption:p.expectedCaption,expectedTagsRevision:p.expectedTagsRevision};
 }
 save(p){
  const prepared=this.prepare(p);
  if(prepared.existing)return {...prepared.existing,storedKey:this.owner.media(p.id).key||null};
  const item=prepared.source,oldPeople=this.owner.relatedPeople(item);
  if((item.key||null)!==p.sourceKey)throw new HttpError(409,'הסרטון השתנה. פתחו את העורך מחדש.');
  if(prepared.range){
   item.videoOriginal??={key:item.key||null,size:item.size,mime:item.mime,duration:item.duration||null,youtubeStart:item.youtubeStart,youtubeEnd:item.youtubeEnd};
   if(item.provider==='youtube'){const offset=item.youtubeStart||0;item.youtubeStart=offset+prepared.range.start;item.youtubeEnd=offset+prepared.range.end;}
   else{const rendered=p.rendered;if(!rendered?.key?.startsWith('video-clips/'+item.id+'/')||!Number.isSafeInteger(rendered.size)||rendered.size<1)throw new HttpError(400,'הקטע המסומן לא נשמר.');Object.assign(item,{key:rendered.key,size:rendered.size,mime:'video/mp4',file:(item.category==='personal'?'gallery/':'')+item.id+'.mp4'});}
   item.duration=p.rendered?.duration||prepared.range.end-prepared.range.start;item.videoRevision=uid();
  }
  Object.assign(item,{name:prepared.name,nameEn:null,caption:prepared.caption,videoEdit:{operationId:prepared.operationId,fingerprint:prepared.fingerprint}});
  this.owner.sql.exec('UPDATE media SET data=? WHERE id=?',JSON.stringify(item),item.id);
  let taggedPeople=[];
  if(prepared.people){
   const keep=new Set(prepared.people.map(person=>person.personId).filter(Boolean)),remove=this.owner.tagIds(item.id).filter(id=>!keep.has(id));
   if(remove.length)this.owner.patchTags(item.id,remove.map(personId=>({personId,tagged:false})));
   if(prepared.people.length)taggedPeople=this.owner.patchTags(item.id,prepared.people.map(person=>({...person,tagged:true}))).taggedPeople;
  }
  const updated=this.owner.media(item.id);this.owner.touchMedia(updated);
  return {...this.owner.mediaChanged(updated,'video-edit',[...new Set([...oldPeople,...this.owner.relatedPeople(updated)])]),taggedPeople,storedKey:updated.key||null};
 }
}
