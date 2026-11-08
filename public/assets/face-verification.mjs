import {intersection} from './face-geometry.mjs?v=6';
import {sameDetection,plausibleFaceLandmarks} from './face-yunet.mjs?v=5';

export const STRONG_FACE_SCORE=.88;
export function profileFace(face){
  if(!plausibleFaceLandmarks(face))return false;
  const r=face.rect,p=face.landmarks.map(point=>({x:(point.x-r.x)/r.width,y:(point.y-r.y)/r.height}));
  const eye={x:p[1].x-p[0].x,y:p[1].y-p[0].y},span=Math.hypot(eye.x,eye.y),eyes={x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2};
  const noseAlong=((p[2].x-eyes.x)*eye.x+(p[2].y-eyes.y)*eye.y)/(span*span);
  return span<.24&&Math.abs(noseAlong)>.65;
}
export function proposalMatches(proposal,face,pixels=Infinity){
  if(!plausibleFaceLandmarks(face))return false;
  if(proposal.landmarks&&sameDetection(proposal,face))return true;
  if(proposal.landmarks&&pixels>12)return false;
  const a=proposal.rect,b=face.rect,aa=a.width*a.height,bb=b.width*b.height;
  return Math.min(aa,bb)/Math.max(aa,bb)>.15&&intersection(a,b)/Math.min(aa,bb)>.65&&
    Math.abs(a.x+a.width/2-b.x-b.width/2)<Math.max(a.width,b.width)*.4&&
    Math.abs(a.y+a.height/2-b.y-b.height/2)<Math.max(a.height,b.height)*.4;
}
export function verifiedEvidence(scores,cascadeScore,pixels,proposal){
  // Mirrors of one texture are not independent evidence of a person. Weak
  // proposals must survive context/scale changes, or a different classifier.
  if(scores.some(score=>score>=STRONG_FACE_SCORE))return true;
  if(scores.filter(score=>score>=.7).length>=2&&cascadeScore>0)return true;
  // Frontal cascades reject genuine profiles. A narrow eye pair and a nose
  // beyond that pair need agreement from three separate local contexts.
  if(proposal&&profileFace(proposal)&&scores.filter(score=>score>=.5).length>=3&&
    (Math.max(...scores)>=.75||(proposal.score>=.7&&Math.max(...scores)>=.58)))return true;
  // Wider contexts avoid magnifying a 17–27 pixel head into a blurry close-up.
  if(proposal?.score>=.75&&pixels>12&&pixels<=32&&scores.filter(score=>score>=.55).length>=3&&Math.max(...scores)>=.7)return true;
  // Do not throw away genuine distant faces merely because they have only a
  // handful of original pixels. Still require two independent local contexts.
  return pixels<=12&&Math.max(...scores)>=.6&&scores.filter(score=>score>=.45).length>=2;
}
