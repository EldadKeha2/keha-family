import {intersection} from './face-geometry.mjs?v=5';
import {sameDetection,plausibleFaceLandmarks} from './face-yunet.mjs?v=4';

export const STRONG_FACE_SCORE=.88;
export function proposalMatches(proposal,face,pixels=Infinity){
  if(!plausibleFaceLandmarks(face))return false;
  if(proposal.landmarks&&sameDetection(proposal,face))return true;
  if(proposal.landmarks&&pixels>12)return false;
  const a=proposal.rect,b=face.rect,aa=a.width*a.height,bb=b.width*b.height;
  return Math.min(aa,bb)/Math.max(aa,bb)>.15&&intersection(a,b)/Math.min(aa,bb)>.65&&
    Math.abs(a.x+a.width/2-b.x-b.width/2)<Math.max(a.width,b.width)*.4&&
    Math.abs(a.y+a.height/2-b.y-b.height/2)<Math.max(a.height,b.height)*.4;
}
export function verifiedEvidence(scores,cascadeScore,pixels){
  // Mirrors of one texture are not independent evidence of a person. Weak
  // proposals must survive context/scale changes, or a different classifier.
  if(scores.some(score=>score>=STRONG_FACE_SCORE))return true;
  if(scores.filter(score=>score>=.7).length>=2&&cascadeScore>0)return true;
  // Do not throw away genuine distant faces merely because they have only a
  // handful of original pixels. Still require two independent local contexts.
  return pixels<=12&&Math.max(...scores)>=.6&&scores.filter(score=>score>=.45).length>=2;
}
