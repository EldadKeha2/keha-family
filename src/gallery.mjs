import family from './family.mjs';
import {HttpError,text} from './http.mjs';
import {FACE_SCAN_VERSION,GALLERY_FILTER_VERSION} from '../public/assets/face-coverage.mjs';
import {familyMemberIds,hasFamily} from '../public/assets/gallery-family.mjs';
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
  return revision+':'+FACE_SCAN_VERSION+':'+GALLERY_FILTER_VERSION+':'+Number(options.page||1)+':'+Number(options.size||100)+':'+encodeURIComponent((options.query||'').trim())+(filter==='all'?'':':'+filter)+(person||unit?':refine2:'+encodeURIComponent(person)+':'+encodeURIComponent(unit):'');
}
