import {mergeFaces,sameRegion,labelledRegion} from './face-geometry.mjs?v=6';

// Bump when the detector changes so existing photos are indexed again once.
export const FACE_SCAN_VERSION='gallery-faces-v7';
export const GALLERY_FILTER_VERSION='tagging-v3';
export function withoutIgnored(faces,ignored=[]){return faces.filter(face=>!ignored.some(rect=>labelledRegion(rect,face.rect)));}
export function faceCoverage(saved,detected,tagCount,{reviewed=false}={}){
  const faces=mergeFaces(saved,detected),unmatched=faces.filter(face=>!saved.includes(face));
  return {total:faces.length,unmatched:unmatched.length,partial:!reviewed&&tagCount>0};
}
export function detectionRegions(faces){
  const regions=[];
  for(const face of faces)if(!regions.some(other=>sameRegion(other.rect,face.rect)))regions.push({rect:face.rect,...(Number.isFinite(face.score)?{score:face.score}:{})});
  return mergeFaces([],regions);
}
