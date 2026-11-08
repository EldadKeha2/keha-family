import {HttpError} from './http.mjs';
import {rotateCrop} from '../public/assets/photo-edit-core.mjs';

export const photoVersionId=value=>value==='original'||typeof value==='string'&&/^[a-f0-9]{32}$/.test(value);
export const photoSource=item=>'/media/'+item.id+(item.photoRevision?'?v='+item.photoRevision:'');
export function photoTransform(rotation,crop){
  if(!Number.isInteger(rotation)||rotation<0||rotation>3||!crop||['x','y','width','height'].some(key=>!Number.isFinite(crop[key]))||crop.x<0||crop.y<0||crop.width<=0||crop.height<=0||crop.x+crop.width>1.000001||crop.y+crop.height>1.000001)throw new HttpError(400,'פרטי הסיבוב או החיתוך אינם תקינים.');
  return {rotation,crop:{x:crop.x,y:crop.y,width:crop.width,height:crop.height}};
}
export function transformPhotoFaces(faces,{rotation,crop}){
  return faces.flatMap(face=>{
    let rect={...face.rect};for(let turn=0;turn<rotation;turn++)rect=rotateCrop(rect,1);
    const left=Math.max(rect.x,crop.x),top=Math.max(rect.y,crop.y),right=Math.min(rect.x+rect.width,crop.x+crop.width),bottom=Math.min(rect.y+rect.height,crop.y+crop.height);
    if(right<=left||bottom<=top)return [];
    return [{...face,rect:{x:(left-crop.x)/crop.width,y:(top-crop.y)/crop.height,width:(right-left)/crop.width,height:(bottom-top)/crop.height}}];
  });
}
