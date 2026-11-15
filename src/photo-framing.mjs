import {HttpError} from './http.mjs';
export function photoFrame(value){return {x:Math.max(0,Math.min(1,Number.isFinite(value?.x)?value.x:.5)),y:Math.max(0,Math.min(1,Number.isFinite(value?.y)?value.y:.5)),fit:value?.fit==='contain'?'contain':'cover'};}
export function validatePhotoFrame(value){
  if(!value||!Number.isFinite(value.x)||!Number.isFinite(value.y)||value.x<0||value.x>1||value.y<0||value.y>1||!['cover','contain'].includes(value.fit))throw new HttpError(400,'בחרו מיקום תקין לתמונה במסגרת.');
  return photoFrame(value);
}
