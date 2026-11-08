import family from './family.mjs';
import {HttpError,text} from './http.mjs';
import {FACE_SCAN_VERSION,GALLERY_FILTER_VERSION} from '../public/assets/face-coverage.mjs';
import {familyMemberIds,hasFamily} from '../public/assets/gallery-family.mjs';
import {PHOTO_LABELS} from '../public/assets/photo-labels-catalog.mjs';
export function galleryOrdering(options={}){
  // Legacy clients omit sort; the gallery interface explicitly defaults to random.
  const sort=options.sort||'uploaded-desc';
  if(!['random','uploaded-asc','uploaded-desc','taken-asc','taken-desc','tags-asc','tags-desc'].includes(sort))throw new HttpError(400,'בחרו סדר תמונות תקין.');
  if(sort==='random'){
    const seed=options.seed===undefined||options.seed===null||options.seed===''?1013904223:Number(options.seed);
    if(!Number.isSafeInteger(seed)||seed<0||seed>0xffffffff)throw new HttpError(400,'בחרו סדר תמונות תקין.');
    let mixed=Math.imul(seed^(seed>>>16),0x21f0aaad);mixed=Math.imul(mixed^(mixed>>>15),0x735a2d97);mixed^=mixed>>>15;
    const multiplier=(mixed>>>0)%2147483645+2;
    // A nonlinear rank avoids keeping sequential uploads in repeating strides.
    // Each factor is below 2^31, so their product fits SQLite's signed integer.
    const rank='CAST(((m.rowid * ?) % 2147483647) AS INTEGER)';
    return {sort,seed,sql:'(('+rank+' * '+rank+') % 2147483647) ASC,m.id ASC',args:[multiplier,multiplier]};
  }
  const direction=sort.endsWith('-asc')?'ASC':'DESC';
  if(sort.startsWith('tags-'))return {sort,seed:null,sql:'(SELECT count(*) FROM media_tags sort_tags WHERE sort_tags.media_id=m.id) '+direction+',m.rowid DESC',args:[]};
  const date=sort.startsWith('taken-')?"json_extract(m.data,'$.takenDate.year') * 10000 + coalesce(json_extract(m.data,'$.takenDate.month'),1) * 100 + coalesce(json_extract(m.data,'$.takenDate.day'),1)":"json_extract(m.data,'$.createdAt')";
  return {sort,seed:null,sql:'CASE WHEN ('+date+') IS NULL THEN 1 ELSE 0 END ASC,('+date+') '+direction+',m.rowid DESC',args:[]};
}
export function galleryLabels(value){
  const source=text(value||'','תגיות',200),labels=[...new Set(source?source.split(','):[])].sort();
  if(labels.some(id=>!PHOTO_LABELS.some(label=>label.id===id)))throw new HttpError(400,'בחרו תגיות מהרשימה.');
  return labels;
}
function refinementIds(value,label){
  const source=text(value||'',label,40000);
  if(!source)return [];
  const ids=[...new Set(source.split(','))].sort();
  if(ids.length>500||ids.some(id=>id.length>80||!/^[a-zA-Z0-9_-]+$/.test(id)))throw new HttpError(400,label==='אדם'?'בחרו אדם מהרשימה.':'בחרו משפחה מהרשימה.');
  return ids;
}
export function galleryRefinement(options={}){
  const people=refinementIds(options.person,'אדם'),units=refinementIds(options.unit,'משפחה');
  if(units.some(id=>![2,3,4].includes(family.units[id]?.generation)||!hasFamily(family,family.units[id])))throw new HttpError(400,'בחרו משפחה מהרשימה.');
  return {person:people.join(','),unit:units.join(','),people,members:[...new Set([...people,...units.flatMap(id=>familyMemberIds(family,id))])]};
}
export function galleryRevision(revision,options={}){
  const {person,unit}=galleryRefinement(options),filter=options.filter||'all';
  const labels=galleryLabels(options.labels).join(',');
  const order=galleryOrdering(options);
  return revision+':'+FACE_SCAN_VERSION+':'+GALLERY_FILTER_VERSION+':'+Number(options.page||1)+':'+Number(options.size||100)+':'+encodeURIComponent((options.query||'').trim())+(filter==='all'?'':':'+filter)+(person||unit?':refine2:'+encodeURIComponent(person)+':'+encodeURIComponent(unit):'')+(labels?':labels:'+labels:'')+':order1:'+order.sort+(order.seed===null?'':':'+order.seed);
}
