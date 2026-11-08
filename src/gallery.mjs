import family from './family.mjs';
import {HttpError,text} from './http.mjs';
import {FACE_SCAN_VERSION,GALLERY_FILTER_VERSION} from '../public/assets/face-coverage.mjs';
import {familyMemberIds} from '../public/assets/gallery-family.mjs';
export function galleryRefinement(options={}){
  const person=text(options.person||'','אדם',80),unit=text(options.unit||'','משפחה',80);
  if(person&&!/^[a-zA-Z0-9_-]+$/.test(person))throw new HttpError(400,'בחרו אדם מהרשימה.');
  if(unit&&![2,3,4].includes(family.units[unit]?.generation))throw new HttpError(400,'בחרו משפחה מהרשימה.');
  return {person,unit,members:unit?familyMemberIds(family,unit):[]};
}
export function galleryRevision(revision,options={}){
  const {person,unit}=galleryRefinement(options),filter=options.filter||'all';
  return revision+':'+FACE_SCAN_VERSION+':'+GALLERY_FILTER_VERSION+':'+Number(options.page||1)+':'+Number(options.size||100)+':'+encodeURIComponent((options.query||'').trim())+(filter==='all'?'':':'+filter)+(person||unit?':refine:'+encodeURIComponent(person)+':'+encodeURIComponent(unit):'');
}
