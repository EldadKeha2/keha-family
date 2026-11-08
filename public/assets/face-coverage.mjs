import {mergeFaces,sameRegion} from './face-geometry.mjs?v=5';

// Bump when the detector changes so existing photos are indexed again once.
export const FACE_SCAN_VERSION='gallery-faces-v4';
export function faceCoverage(saved,detected,tagCount){
  const faces=mergeFaces(saved,detected),unmatched=faces.filter(face=>!saved.includes(face));
  return {total:faces.length,unmatched:unmatched.length,partial:tagCount>0&&unmatched.length>0&&faces.length>tagCount};
}
export function detectionRegions(faces){
  const regions=[];
  for(const face of faces)if(!regions.some(other=>sameRegion(other.rect,face.rect)))regions.push({rect:face.rect,...(Number.isFinite(face.score)?{score:face.score}:{})});
  return mergeFaces([],regions);
}
