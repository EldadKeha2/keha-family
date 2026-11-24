import original from './family.mjs';
import {createFamily} from '../public/nakash/family-data.mjs';
import {createExtendedFamily,EXTENDED_PEOPLE} from '../public/keha-extended/family-data.mjs';
import {createShlomoFamily} from '../public/keha-extended/shlomo-data.mjs';
import {extendedGalleryGenerations,extendedGalleryPhoto} from '../public/keha-extended/gallery-generations.mjs';
import {HttpError,text,uid} from './http.mjs';
import {extendedContactBranch} from './extended-people.mjs';
import {DOCUMENT_CATEGORIES,checkDocumentCategory,documentCategory} from './document-categories.mjs';

export const ORIGINAL_PHOTO_PEOPLE=new Set(['shlomo','yona','ruti','becker-parent','yehiel','avigail','ora','shosh']);
const originalPeople=new Set(Object.keys(original.people));
const youngerOriginalPeople=new Set(Object.values(original.people).filter(person=>person.generation>=3).map(person=>person.id));
const paternalScopes=new Set(['extended','zechariah','zechariah-tzadok','kehat']);
const founderUnits=['u-root','u-keha-zechariah-father','u-saadia-elder','u-keha-zechariah','u-kehat-tzadok-elder','u-kehat-zechariah-ben-tzadok','u-kehat-aharon-elder','u-keha-kehat','u-kehat-zechariah','u-keha-yissachar'];
export const MISATTRIBUTED_YONA_DOCUMENT='57537c6f78904f8fa31c876e8b4461d2';
export const UNVERIFIED_YONA_MARRIAGE_DOCUMENT='2b4dfc4ec6d443dd940f310d0141527f';
export const UNATTRIBUTED_KEHAT_REGISTER='c9bfadd7e1ab6b8323534f2dd5a8a82a';
const validScopes=new Set(['original','nakash','keha','haim','yehuda','medina','extended','shlomo','zechariah','zechariah-tzadok','kehat']);
const kind=item=>item.kind||(item.mime?.startsWith('image/')?'photo':item.mime?.startsWith('video/')?'video':'document');
const subjects=item=>[...new Set([item.personId,...(item.personIds||[]),...(item.people||[]),...(item.documentPeople||[])].filter(Boolean))];
const caption=item=>[item.title,item.name,item.filename,item.caption].filter(Boolean).join(' ');
const excluded=item=>item.archiveExcluded||item.id===MISATTRIBUTED_YONA_DOCUMENT||item.id===UNVERIFIED_YONA_MARRIAGE_DOCUMENT||item.id===UNATTRIBUTED_KEHAT_REGISTER||/מודע[הת]\s+(?:אבל|אזכרה)|obituary|memorial notice/i.test(caption(item));

export function contentContext(branch,sharedPeople={},identities={}){
  if(!validScopes.has(branch))throw new HttpError(400,'המשפחה אינה מוכרת.');
  const paternal=paternalScopes.has(branch);
  const tree=(branch==='shlomo'?createShlomoFamily:paternal?createExtendedFamily:createFamily)({...original,sharedPeople,identities});
  const canonical=id=>tree.identities?.[id]||identities[id]||id;
  let ids;
  if(branch==='original')ids=new Set(Object.keys(original.people));
  else if(branch==='shlomo')ids=new Set(ORIGINAL_PHOTO_PEOPLE);
  else if(branch==='nakash')ids=new Set(Object.keys(tree.people));
  else if(branch==='extended'){
    ids=new Set();
    // The shared paternal archive stops at the founders and their historical
    // children's generation. Grandchildren never enter through a date heuristic.
    for(const unitId of founderUnits){
      const unit=tree.units[unitId];if(!unit)continue;
      for(const id of unit.people)if(id!=='yona'&&!tree.people[id]?.placeholder)ids.add(id);
      for(const child of unit.children||[])for(const id of tree.units[child]?.people||[]){
        const p=tree.people[id],year=p?.birthYear||p?.birthYearMax||Number(p?.birthday?.split('.').at(-1));
        if(id!=='yona'&&p&&!p.placeholder&&(unitId!=='u-root'||p.deceased||p.deathDate||year>1800&&year<=1930))ids.add(id);
      }
    }
  }else if(paternal){
    ids=new Set(Object.keys(tree.people).filter(id=>{
      const value=tree.branchIds.get(id),members=tree.people[id].branches||[];
      return [value,...members].includes(branch==='zechariah-tzadok'?'kehat-tzadok':branch);
    }));
  }else{
    ids=new Set(Object.keys(tree.people).filter(id=>tree.branchIds.get(id)===branch));
    for(const id of tree.units[tree.root]?.people||[])ids.add(id);
  }
  if(branch==='original')for(const id of tree.units[tree.root]?.people||[])ids.add(id);
  const documentIds=branch==='original'||branch==='shlomo'?new Set(['shlomo','yona']):new Set(ids);
  const mediaIds=branch==='extended'?new Set(Object.keys(tree.people)):new Set(ids);
  const galleryGenerations=branch==='extended'?extendedGalleryGenerations(tree,sharedPeople,youngerOriginalPeople):null;
  let contacts;
  if(paternal){
    contacts={...tree.people};
    for(const p of Object.values(sharedPeople))if(p.extra&&!p.mergedInto&&!p.archiveOnly&&extendedContactBranch(p)&&!contacts[p.id])contacts[p.id]=p;
    for(const p of Object.values(contacts))if(p.placeholder)delete contacts[p.id];
  }
  return {branch,tree,ids,mediaIds,documentIds,contacts,canonical,galleryGenerations};
}

export function contentHasSubjects(item,context,document=false){
  const ids=document?context.documentIds:context.ids;
  return subjects(item).some(id=>ids.has(context.canonical(id)));
}
export function storyInContext(story,context){
  if(context.branch==='shlomo'){const ids=subjects(story).map(context.canonical);return ids.length>0&&ids.every(id=>id==='shlomo');}
  if(context.branch==='original')return !story.familyScopes?.length||story.familyScopes.includes('original')||contentHasSubjects(story,context);
  if(contentHasSubjects(story,context))return true;
  if(paternalScopes.has(context.branch)&&context.branch!=='extended'&&story.familyScopes?.includes(context.branch))return true;
  return context.branch!=='extended'&&!subjects(story).length&&story.familyScopes?.includes(context.branch);
}
export function restrictedOriginalPerson(id){return originalPeople.has(id)&&!ORIGINAL_PHOTO_PEOPLE.has(id);}
function shlomoTaggedMedia(item,context){
  const tags=(item.people||[]).map(context.canonical);
  return tags.length>0&&tags.every(id=>ORIGINAL_PHOTO_PEOPLE.has(id));
}
export function mediaInContext(item,context){
  if(excluded(item))return false;
  if(context.branch==='shlomo'){
    if(kind(item)==='document')return contentHasSubjects(item,context,true)&&subjects(item).every(id=>context.documentIds.has(context.canonical(id)));
    return shlomoTaggedMedia(item,context)&&(kind(item)==='photo'?item.faceSummary?.reviewed===true:(item.people||[]).some(id=>['shlomo','yona'].includes(context.canonical(id))));
  }
  if(kind(item)==='document')return contentHasSubjects(item,context,true)||item.familyScopes?.includes(context.branch)&&(!subjects(item).length||paternalScopes.has(context.branch)&&context.branch!=='extended');
  if(subjects(item).some(id=>ORIGINAL_PHOTO_PEOPLE.has(id)&&context.tree.people[id]))return true;
  if(!item.category?.startsWith('nakash:')&&subjects(item).some(id=>originalPeople.has(id)))return false;
  return subjects(item).some(id=>context.mediaIds.has(context.canonical(id)))||item.familyScopes?.includes(context.branch)||item.category==='nakash:'+context.branch||context.branch==='extended'&&['nakash:extended','nakash:shlomo','nakash:zechariah','nakash:zechariah-tzadok','nakash:kehat'].includes(item.category);
}
function collectionInContext(item,context,generation='first'){
  if(context.branch==='extended'&&kind(item)==='photo'&&!extendedGalleryPhoto(item,context.galleryGenerations,generation,context.canonical))return false;
  if(!mediaInContext(item,context))return false;
  if(context.branch==='shlomo'&&kind(item)!=='document')return (item.people||[]).some(id=>['shlomo','yona'].includes(context.canonical(id)));
  if(['haim','yehuda','medina','zechariah','zechariah-tzadok','kehat'].includes(context.branch)&&kind(item)!=='document')return subjects(item).some(id=>context.mediaIds.has(context.canonical(id)))||item.category==='nakash:'+context.branch||item.familyScopes?.includes(context.branch);
  return true;
}

function unattributeDocument(state,id,migration,attributionNote,sourceCaption){
  if(state.rows('SELECT id FROM meta WHERE id=?',migration).length)return;
  const row=state.rows('SELECT data FROM media WHERE id=?',id)[0];
  if(row){
    const item=JSON.parse(row.data),tags=state.tagIds(item.id);
    const collections=state.rows('SELECT collection,added_at FROM media_collections WHERE media_id=?',item.id);
    const affected=[...new Set([...subjects(item),...tags])].filter(id=>state.rows('SELECT id FROM people WHERE id=?',id).length);
    state.sql.exec('INSERT OR IGNORE INTO meta(id,value) VALUES(?,?)',migration+':backup',row.data);
    state.sql.exec('INSERT OR IGNORE INTO meta(id,value) VALUES(?,?)',migration+':tags',JSON.stringify(tags));
    state.sql.exec('INSERT OR IGNORE INTO meta(id,value) VALUES(?,?)',migration+':collections',JSON.stringify(collections));
    delete item.personId;
    item.category='research:unattributed';item.archiveExcluded=true;
    for(const key of ['people','personIds','documentPeople','familyScopes'])delete item[key];
    item.attributionNote=attributionNote;
    if(sourceCaption)item.caption=sourceCaption;
    state.sql.exec('UPDATE media SET category=?,person_id=NULL,data=? WHERE id=?',item.category,JSON.stringify(item),item.id);
    state.sql.exec('DELETE FROM media_tags WHERE media_id=?',item.id);
    state.sql.exec('DELETE FROM media_collections WHERE media_id=?',item.id);
    state.touchTags(item.id);
    for(const {collection} of collections)state.touch(collection);
    state.touchMedia(item,affected);
  }
  state.sql.exec('INSERT INTO meta(id,value) VALUES(?,?)',migration,'done');
}

// Keep the original profiles for historical references to their IDs. The
// electoral-register household no longer has active family profiles or units.
function correctJimaanFamily(state){
  const migration='kehat-jimaan-children-2026-11-22-v1';
  if(state.rows('SELECT id FROM meta WHERE id=?',migration).length)return;
  for(const id of ['kehat-jidaan','kehat-yehudit']){
    const row=state.rows('SELECT data FROM people WHERE id=?',id)[0];
    if(!row)continue;
    const person=JSON.parse(row.data),seed=EXTENDED_PEOPLE.find(p=>p.id===id);
    if(id==='kehat-jidaan'){
      person.aliases=[...new Set([...(person.aliases||[]),...seed.aliases])];
      if(person.researchNotes)person.researchNotes=person.researchNotes.replace('ואביהם של שלמה, יעקב, זכריה ואהרון','ואביהם של אהרון (הבכור), זכריה, יהודית ויעקב');
    }
    if(!person.researchNotes||id==='kehat-yehudit'&&person.researchNotes.startsWith('השם יהודית הופיע בין ילדי סעדיה בתרשים המוקדם')){
      person.researchNotes=seed.researchNotes;
    }
    if(JSON.stringify(person)===row.data)continue;
    state.sql.exec('INSERT OR IGNORE INTO meta(id,value) VALUES(?,?)',migration+':backup:'+id,row.data);
    state.savePerson(person);
  }
  for(const id of ['kehat-shlomo','kehat-shlomo-sarah','kehat-esther']){
    const row=state.rows('SELECT data FROM people WHERE id=?',id)[0];
    if(!row)continue;
    const person=JSON.parse(row.data);
    state.sql.exec('INSERT OR IGNORE INTO meta(id,value) VALUES(?,?)',migration+':backup:'+id,row.data);
    state.savePerson({id,name:person.name,nameEn:person.nameEn,extra:true,extendedKeha:true,archiveOnly:true});
  }
  state.sql.exec('INSERT INTO meta(id,value) VALUES(?,?)',migration,'done');
}

export function initializeFamilyContent(state){
  unattributeDocument(state,UNVERIFIED_YONA_MARRIAGE_DOCUMENT,'family-content-yona-h72727-unattributed-2026-11-21-v1',
    'תעודת H72727 מתעדת את נישואי יונה בת שלמה ושרה לשלום ב־5.3.1945. זהות המשפחה שבתעודה טרם התבררה.');
  unattributeDocument(state,UNATTRIBUTED_KEHAT_REGISTER,'family-content-kehat-register-unattributed-2026-11-22-v1',
    'הרשומות מציינות את שם אביו של שלמה כסעדיה. המשפחה תיקנה את השיוך לענף ג׳ימעאן בן אהרון.',
    'פנקס הבוחרים של רחובות, תש״ט, אזור קלפי ז׳, דף 17, שורות 478–480. שלמה קהת בן סעדיה (1896, 510907), שרה קהת בת סעדיה (1900, 510908) ואסתר קהת בת שלמה (1930, 510909) רשומים בכתובת ״הגשר, קהת שלמה״.');
  correctJimaanFamily(state);
  const migration='family-content-attribution-2026-11-21-v1';
  if(state.rows('SELECT id FROM meta WHERE id=?',migration).length)return;
  const row=state.rows('SELECT data FROM media WHERE id=?',MISATTRIBUTED_YONA_DOCUMENT)[0];
  if(row){
    state.sql.exec('INSERT OR IGNORE INTO meta(id,value) VALUES(?,?)',migration+':backup',row.data);
    const item=JSON.parse(row.data);
    delete item.personId;item.category='research:unattributed';item.archiveExcluded=true;
    item.attributionNote='השיוך ליונה נקאש קהא הוסר לבקשת המשפחה: זו יונה אחרת.';
    for(const key of ['people','personIds','documentPeople'])if(item[key])item[key]=item[key].filter(id=>id!=='yona');
    state.sql.exec('UPDATE media SET category=?,person_id=NULL,data=? WHERE id=?',item.category,JSON.stringify(item),item.id);
    state.sql.exec('DELETE FROM media_tags WHERE media_id=? AND person_id=?',item.id,'yona');
    const p=state.person('yona');state.savePerson(p);
  }
  // This older story predates person tags. Give it its established subject so
  // it follows Yona into the Nakash archive without entering the paternal one.
  const story=state.rows('SELECT data FROM stories WHERE id=?','364456d5b4384755b980eb24')[0];
  if(story){const item=JSON.parse(story.data);if(!item.personIds?.length){item.personIds=['yona'];state.sql.exec('UPDATE stories SET data=? WHERE id=?',JSON.stringify(item),item.id);state.sql.exec("INSERT INTO meta(id,value) VALUES('stories',?) ON CONFLICT(id) DO UPDATE SET value=excluded.value",uid());}}
  state.sql.exec('INSERT INTO meta(id,value) VALUES(?,?)',migration,'done');
}

export function stateContentContext(state,branch){
  const people=Object.fromEntries(state.rows('SELECT id,data FROM people').map(row=>[row.id,JSON.parse(row.data)]));
  return contentContext(branch,people,state.sharedNakashIdentities||{});
}
function shlomoItems(state,context,source=null){
  const tags=new Map();
  const rows=source?state.rows('SELECT media_id,person_id FROM media_tags WHERE media_id IN (SELECT value FROM json_each(?))',JSON.stringify(source.map(item=>item.id))):state.rows('SELECT media_id,person_id FROM media_tags');
  for(const {media_id,person_id} of rows){if(!tags.has(media_id))tags.set(media_id,[]);tags.get(media_id).push(context.canonical(person_id));}
  const items=(source||state.rows('SELECT data FROM media ORDER BY rowid DESC').map(row=>JSON.parse(row.data)))
    .map(item=>({...item,people:[...new Set(tags.get(item.id)||[])]}))
    .filter(item=>!excluded(item)&&(kind(item)==='document'?mediaInContext(item,context):shlomoTaggedMedia(item,context)));
  const metadata=state.mediaPublicMany(items);
  return items.map((item,i)=>({...item,faceSummary:metadata[i].faceSummary,tagsRevision:metadata[i].tagsRevision})).filter(item=>mediaInContext(item,context));
}
function shlomoProfile(state,person,items){
  const eligible=ORIGINAL_PHOTO_PEOPLE.has(person.id)?items.filter(item=>kind(item)==='document'?subjects(item).includes(person.id):item.people.includes(person.id)):[];
  const snapshot=state.snapshot(person,eligible,false);
  return {...person,...snapshot,profileId:snapshot.profileMediaId,profileHistory:[],gallery:[]};
}
export function scopedMediaLinks(value,branch){
  if(branch!=='shlomo')return value;
  if(typeof value==='string'&&/^\/(?:media\/[a-f0-9]{32}(?:\?|$)|api\/voices\/[a-f0-9]{32}\/audio(?:\?|$))/.test(value)){
    const url=new URL(value,'https://family.invalid');url.searchParams.set('familyScope',branch);return url.pathname+url.search;
  }
  if(Array.isArray(value))return value.map(item=>scopedMediaLinks(item,branch));
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,scopedMediaLinks(item,branch)]));
  return value;
}
export function contentPerson(state,{branch,id,selection=false,...options}){
  const context=stateContentContext(state,branch);
  if(branch==='shlomo'){
    if(!context.tree.people[id])throw new HttpError(404,'האדם לא נמצא במשפחה הזאת.');
    const items=shlomoItems(state,context,state.personMedia(id)).filter(item=>kind(item)==='document'?subjects(item).includes(id):item.people.includes(id));
    const contentIds=ORIGINAL_PHOTO_PEOPLE.has(id)?items.map(item=>item.id):[];
    if(selection)return state.personSelection(id,{...options,contentIds});
    const result=state.personPage(id,{...options,contentIds});
    return scopedMediaLinks({...result,person:shlomoProfile(state,result.person,items)},branch);
  }
  const items=restrictedOriginalPerson(id)?[]:state.personMedia(id).filter(item=>!excluded(item)&&(kind(item)==='document'?context.mediaIds.has(id):mediaInContext({...item,people:[id]},context)));
  const contentIds=items.map(item=>item.id);
  return selection?state.personSelection(id,{...options,contentIds}):state.personPage(id,{...options,contentIds});
}

export function contentDocuments(state,branch){
  const context=stateContentContext(state,branch),all=state.rows("SELECT data FROM media WHERE COALESCE(json_extract(data,'$.kind'),'')='document' OR category='attachment'").map(row=>JSON.parse(row.data));
  const stories=state.run('stories').stories.filter(story=>branch==='shlomo'?storyInContext(story,context):contentHasSubjects(story,context,true));
  const attachments=new Set(stories.flatMap(story=>(story.attachments||[]).map(file=>file.src?.split('/').at(-1))));
  const merged=new Map();
  for(const source of all){
    const item={...source,people:state.tagIds(source.id)};
    if(excluded(item)||!mediaInContext(item,context)&&!attachments.has(item.id))continue;
    const key=(item.filename||item.name||item.id)+'\u001f'+item.size;
    const old=merged.get(key),personIds=subjects(item);
    if(old){
      old.sourceIds.push(source.id);old.personIds=[...new Set([...old.personIds,...personIds])];
      old.tags=old.personIds.map(id=>({id,name:context.tree.people[id]?.name||state.person(id).name}));
      if(source.documentCategory)old.documentCategory=source.documentCategory;
      continue;
    }
    merged.set(key,{...state.mediaPublic(source),documentCategory:documentCategory(source),documentPreview:source.documentPreview||null,sourceUrl:source.sourceUrl||null,sourceLabel:source.sourceLabel||null,sourceIds:[source.id],createdAt:source.createdAt,kind:source.mime?.startsWith('audio/')?'audio':'document',personIds,tags:personIds.map(id=>({id,name:context.tree.people[id]?.name||state.person(id).name}))});
  }
  for(const item of state.run('recordings').recordings){
    if(contentHasSubjects(item,context,true))merged.set('audio:'+item.id,{...item,recording:true,kind:'audio',documentCategory:item.documentCategory||'other',name:item.title,caption:item.body});
  }
  const selectable=context.contacts?Object.values(context.contacts):[...context.documentIds].map(id=>context.tree.people[id]).filter(p=>p&&!p.placeholder);
  const people=selectable.map(({id,name,nameEn,aliases})=>({id,name,nameEn,aliases}));
  return {items:[...merged.values()].sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||'')),people,categories:DOCUMENT_CATEGORIES};
}

export function handleFamilyContent(state,action,args){
  const {branch='original'}=args,context=stateContentContext(state,branch);
  if(action==='content.person')return contentPerson(state,args);
  if(action==='content.people'){
    const result=state.run('people');
    if(branch!=='shlomo')return result;
    const items=shlomoItems(state,context);
    return scopedMediaLinks({...result,people:Object.fromEntries(Object.entries(result.people).filter(([id])=>context.tree.people[id]).map(([id,person])=>[id,shlomoProfile(state,person,items)]))},branch);
  }
  if(action==='content.documents')return contentDocuments(state,branch);
  if(action==='content.document.category'){
    const category=checkDocumentCategory(args.category);
    const item=contentDocuments(state,branch).items.find(item=>item.id===args.id);
    if(!item)throw new HttpError(404,'התיעוד לא נמצא במשפחה הזאת.');
    if(category===item.documentCategory)return {id:item.id,category};
    if(item.documentCategory!==args.expectedCategory)throw new HttpError(409,'התגית השתנתה. הרשימה תתרענן.');
    if(item.recording){
      const recording=state.recordings.raw(item.id);
      state.sql.exec('UPDATE recordings SET data=? WHERE id=?',JSON.stringify({...recording,documentCategory:category}),item.id);
      state.recordings.touch();
    }else{
      for(const id of item.sourceIds){
        const source=state.media(id);
        state.sql.exec('UPDATE media SET data=? WHERE id=?',JSON.stringify({...source,documentCategory:category}),id);
      }
    }
    return {id:item.id,category};
  }
  if(action==='content.document.delete'){
    const item=contentDocuments(state,branch).items.find(item=>item.id===args.id);
    if(!item)throw new HttpError(404,'המסמך לא נמצא במשפחה הזאת.');
    if(item.recording){
      const original=state.run('recording.get',{id:item.id});
      state.sql.exec('INSERT OR IGNORE INTO meta(id,value) VALUES(?,?)','document-recording-trash:'+item.id,JSON.stringify(original));
      state.sql.exec('DELETE FROM recordings WHERE id=?',item.id);state.recordings.touch();
    }else{
      const ids=new Set(item.sourceIds);
      for(const row of state.rows('SELECT id,data FROM stories')){
        const story=JSON.parse(row.data),attachments=story.attachments||[];
        const retained=attachments.filter(file=>!ids.has(file.src?.split('/').at(-1)));
        if(retained.length===attachments.length)continue;
        state.sql.exec('INSERT OR IGNORE INTO meta(id,value) VALUES(?,?)','document-story-backup:'+item.id+':'+row.id,row.data);
        story.attachments=retained;story.updatedAt=new Date().toISOString();
        state.sql.exec('UPDATE stories SET data=? WHERE id=?',JSON.stringify(story),row.id);
        state.sql.exec("INSERT INTO meta(id,value) VALUES('stories',?) ON CONFLICT(id) DO UPDATE SET value=excluded.value",uid());
      }
      for(const id of ids){const source=state.media(id);state.run('media.delete',{id,scope:state.mediaScope(source),fromDocumentArchive:true});}
    }
    return {deleted:true,id:item.id};
  }
  if(action==='content.stories'){
    const result=state.run('stories');
    return {...result,stories:result.stories.filter(item=>storyInContext(item,context)),allowedPersonIds:branch==='original'?null:branch==='shlomo'?['shlomo']:context.contacts?Object.keys(context.contacts):[...context.ids],revision:result.revision+':'+branch+':v3'};
  }
  if(action==='content.story.save'){
    const fields={...args.fields};
    if(args.id){const row=state.rows('SELECT data FROM stories WHERE id=?',args.id)[0];if(!row||!storyInContext(JSON.parse(row.data),context))throw new HttpError(404,'הסיפור לא נמצא.');}
    if(fields.personIds!==undefined&&(!Array.isArray(fields.personIds)||fields.personIds.length>150||fields.personIds.some(id=>typeof id!=='string')))throw new HttpError(400,'בחרו אנשים מהרשימה.');
    fields.personIds=(fields.personIds||[]).map(context.canonical);
    if(branch==='shlomo'&&(!fields.personIds.length||fields.personIds.some(id=>id!=='shlomo')))throw new HttpError(400,'במשפחה הזאת אפשר לשמור סיפורים על שלמה קהא בלבד.');
    if(fields.personIds.some(id=>context.contacts?!Object.hasOwn(context.contacts,id):!context.ids.has(id)))throw new HttpError(400,'בחרו את האנשים הרלוונטיים למשפחה הזאת.');
    if(branch==='extended'&&!fields.personIds.some(id=>context.ids.has(id)))throw new HttpError(400,'בחרו אדם מהדורות המייסדים שאליו שייך הסיפור.');
    fields.familyScopes=[branch];
    return state.run('memory.story.save',{...args,fields});
  }
  if(action==='content.items'){
    if(branch==='shlomo')return {items:shlomoItems(state,context).filter(item=>(!args.kind||kind(item)===args.kind)&&collectionInContext(item,context))};
    const tags=new Map();
    for(const row of state.rows('SELECT media_id,person_id FROM media_tags')){if(!tags.has(row.media_id))tags.set(row.media_id,[]);tags.get(row.media_id).push(row.person_id);}
    const items=state.rows('SELECT data FROM media ORDER BY rowid DESC').map(row=>JSON.parse(row.data)).filter(item=>!args.kind||kind(item)===args.kind).map(item=>({...item,people:tags.get(item.id)||[]})).filter(item=>collectionInContext(item,context,args.generation));
    const metadata=state.mediaPublicMany(items);
    return {items:items.map((item,i)=>({...item,faceSummary:metadata[i].faceSummary,tagsRevision:metadata[i].tagsRevision}))};
  }
  if(action==='content.media.authorize'){
    const item=state.media(args.id);
    if(branch==='shlomo'){
      const tagged={...item,people:state.tagIds(item.id),faceSummary:kind(item)==='photo'?state.faceSummary(item):undefined};
      if(args.portrait&&(!ORIGINAL_PHOTO_PEOPLE.has(args.portrait)||!tagged.people.includes(args.portrait)))throw new HttpError(404,'הפריט לא נמצא.');
      if(mediaInContext(tagged,context))return {allowed:true,photoRevision:item.photoRevision||'original'};
      if(kind(item)==='document'&&state.run('stories').stories.some(story=>storyInContext(story,context)&&story.attachments?.some(file=>file.src==='/media/'+item.id)))return {allowed:true};
      throw new HttpError(404,'הפריט לא נמצא.');
    }
    if(args.portrait&&context.tree.people[args.portrait]){
      const p=state.run('person',{id:args.portrait});
      if(p.profileMediaId===item.id)return {allowed:true};
    }
    if(state.run('stories').stories.some(story=>contentHasSubjects(story,context,true)&&story.attachments?.some(file=>file.src==='/media/'+item.id)))return {allowed:true};
    if(!mediaInContext({...item,people:state.tagIds(item.id)},context))throw new HttpError(404,'הפריט לא נמצא.');
    return {allowed:true};
  }
  if(action==='content.voice.authorize'){
    if(!contentHasSubjects(state.run('recording.get',{id:args.id}),context,true))throw new HttpError(404,'ההקלטה לא נמצאה.');
    return {allowed:true};
  }
  if(action==='content.document.prepare'||action==='content.document.add'){
    const fields=args.fields||{},personIds=fields.personIds;
    if(!Array.isArray(personIds)||!personIds.length||personIds.length>30||personIds.some(id=>typeof id!=='string'||(context.contacts?!Object.hasOwn(context.contacts,context.canonical(id)):!context.documentIds.has(context.canonical(id)))))throw new HttpError(400,'בחרו את האנשים שאליהם שייך המסמך.');
    if(branch==='extended'&&!personIds.some(id=>context.documentIds.has(context.canonical(id))))throw new HttpError(400,'בחרו גם בן משפחה מהדורות המתועדים בארכיון המשותף.');
    const clean={title:text(fields.title,'כותרת',200,true),caption:text(fields.caption||'','תיאור',5000),personIds:[...new Set(personIds.map(context.canonical))]};
    if(fields.documentCategory!=null)clean.documentCategory=checkDocumentCategory(fields.documentCategory);
    if(action==='content.document.prepare')return {fields:clean};
    const item={...args.item,name:clean.title,caption:clean.caption,personId:clean.personIds[0],documentPeople:clean.personIds,familyScopes:[branch],category:'personal'};
    if(clean.documentCategory)item.documentCategory=clean.documentCategory;
    state.sql.exec('INSERT INTO media(id,category,person_id,data) VALUES(?,?,?,?)',item.id,item.category,item.personId,JSON.stringify(item));
    for(const id of clean.personIds){state.sql.exec('INSERT OR IGNORE INTO media_tags(media_id,person_id) VALUES(?,?)',item.id,id);state.savePerson(state.person(id));}
    return {saved:true,item:state.mediaPublic(item)};
  }
  throw new HttpError(404,'הפעולה אינה זמינה.');
}
