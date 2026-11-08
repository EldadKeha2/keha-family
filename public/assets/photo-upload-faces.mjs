import {fullCrop,rotateCrop,pixelCrop,rotatedSize} from './photo-edit-core.mjs';
const key=name=>String(name||'').normalize('NFKD').replace(/[\u0591-\u05c7'"׳״]/g,'').replace(/\s+/g,' ').trim().toLowerCase();
const id=()=>crypto.randomUUID().replaceAll('-','');
const turnRect=(rect,rotation)=>{let result={...rect};for(let i=0;i<((rotation%4)+4)%4;i++)result=rotateCrop(result,1);return result;};
export function faceDraftPeople(d){return [...new Map((d.faceTags||[]).map(face=>[face.person.id,face.person])).values()];}
export function transformedUploadFaces(d){
  const size=rotatedSize(d.width,d.height,d.rotation),pixels=pixelCrop(d.width,d.height,d.rotation,d.crop||fullCrop());
  const crop={x:pixels.x/size.width,y:pixels.y/size.height,width:pixels.width/size.width,height:pixels.height/size.height};
  return (d.faceTags||[]).flatMap(face=>{
    const rect=turnRect(face.rect,d.rotation),left=Math.max(rect.x,crop.x),top=Math.max(rect.y,crop.y),right=Math.min(rect.x+rect.width,crop.x+crop.width),bottom=Math.min(rect.y+rect.height,crop.y+crop.height);
    if(right<=left||bottom<=top)return [];
    const mapped={x:(left-crop.x)/crop.width,y:(top-crop.y)/crop.height,width:(right-left)/crop.width,height:(bottom-top)/crop.height};
    if(mapped.width<.0005||mapped.height<.0005)return [];
    return [{rect:mapped,...(face.person.draftName?{name:face.person.name}:{personId:face.person.id})}];
  });
}
export function createUploadFaceAdapter(d,{findPeople,getPerson,onChange=()=>{},tr=(he,en)=>en}){
  d.faceTags??=[];d.ignoredFaces??=[];d.facesComplete??=false;const roster=new Map(faceDraftPeople(d).map(person=>[person.id,person]));
  const faces=()=>d.faceTags.map(face=>({...face,personId:face.person.id,rect:turnRect(face.rect,d.rotation)}));
  const item=()=>({id:d.key,kind:'photo',tags:faceDraftPeople(d),tagsRevision:String(d.faceRevision||0),faceSummary:{reviewed:d.facesComplete}});
  const snapshot=()=>({item:item(),faces:faces(),ignoredFaces:d.ignoredFaces.map(rect=>turnRect(rect,d.rotation))});
  const changed=face=>{d.faceRevision=(d.faceRevision||0)+1;const result={...snapshot(),face:face?faces().find(saved=>saved.id===face.id):null};onChange(result);return result;};
  async function search(query,preferred=[]){
    const found=await findPeople(query,preferred);for(const person of found)roster.set(person.id,person);
    const local=faceDraftPeople(d).filter(person=>person.draftName&&(!key(query)||key(person.name).includes(key(query))));
    return [...new Map([...local,...found].map(person=>[person.id,person])).values()];
  }
  return {load:async()=>snapshot(),findPeople:search,mapDetections:found=>found.map(face=>({...face,rect:turnRect(face.rect,d.rotation)})),
    async save(input){
      const previous=d.faceTags.find(face=>face.id===input.faceId);
      if(input.personId===null){d.faceTags=d.faceTags.filter(face=>face.id!==input.faceId);d.facesComplete=false;return changed(null);}
      let person;
      if(input.name!==undefined){
        const name=String(input.name).trim().replace(/\s+/g,' ');if(!name||name.length>120)throw Error(tr('יש להזין שם באורך של עד 120 תווים.','Enter a name (up to 120 characters).'));
        const exact=(await search(name)).filter(person=>[person.name,person.nameEn].some(value=>key(value)===key(name)));
        if(exact.length>1)throw Error(tr('בחרו את האדם המתאים מהרשימה.','Choose the matching person from the list.'));
        person=exact[0]||{id:'draft-'+id(),name,extra:true,draftName:true};
      }else person=roster.get(input.personId)||getPerson(input.personId);
      if(!person)throw Error(tr('בחרו אדם מהרשימה.','Choose a person from the list.'));
      if(!previous&&d.faceTags.length>=150)throw Error(tr('אפשר לתייג עד 150 אזורי פנים בתמונה.','A photo can have up to 150 face tags.'));
      roster.set(person.id,person);const face={id:input.faceId,person,rect:turnRect(input.rect,-d.rotation),revision:id()};
      d.faceTags=d.faceTags.filter(saved=>saved.id!==face.id);d.faceTags.push(face);d.facesComplete=false;return changed(face);
    },
    async ignore({rect,ignored}){const original=turnRect(rect,-d.rotation);if(ignored)d.ignoredFaces.push(original);else d.ignoredFaces=d.ignoredFaces.filter(other=>JSON.stringify(other)!==JSON.stringify(original));return changed(null);},
    async review({complete}){d.facesComplete=Boolean(complete);return changed(null);}
  };
}
