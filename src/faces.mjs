import {HttpError} from './http.mjs';

export const FACE_LIMIT=150;
export function faceRect(value){
  if(!value||typeof value!=='object'||Array.isArray(value))throw new HttpError(400,'בחרו אזור פנים תקין בתמונה.');
  const rect={};
  for(const key of ['x','y','width','height']){
    const n=value[key];if(typeof n!=='number'||!Number.isFinite(n)||n<0||n>1)throw new HttpError(400,'בחרו אזור פנים תקין בתמונה.');
    rect[key]=Math.round(n*1e6)/1e6;
  }
  if(rect.width<.0005||rect.height<.0005||rect.x+rect.width>1.000001||rect.y+rect.height>1.000001)throw new HttpError(400,'אזור הפנים צריך להיות בתוך התמונה.');
  return rect;
}
export function overlap(a,b){
  const intersection=Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));
  return intersection/(a.width*a.height+b.width*b.height-intersection||1);
}
export function sameFaceRegion(a,b){
  return overlap(a,b)>.6&&
    Math.abs(a.x+a.width/2-b.x-b.width/2)<Math.min(a.width,b.width)*.18&&
    Math.abs(a.y+a.height/2-b.y-b.height/2)<Math.min(a.height,b.height)*.18;
}
