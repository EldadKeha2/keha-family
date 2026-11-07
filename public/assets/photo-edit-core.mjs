export const fullCrop = () => ({x:0,y:0,width:1,height:1});
export const turns = value => ((Math.round(value)%4)+4)%4;
export const isPhoto = file => /^image\//i.test(file.type||'') || /\.(jpe?g|png|webp|gif|avif)$/i.test(file.name||'');
const clamp = (value,min,max) => Math.max(min,Math.min(max,value));

export function normalizeCrop(crop) {
  const x=clamp(Number(crop.x)||0,0,0.9999),y=clamp(Number(crop.y)||0,0,0.9999);
  return {x,y,width:clamp(Number(crop.width)||0.0001,0.0001,1-x),height:clamp(Number(crop.height)||0.0001,0.0001,1-y)};
}
export function rotateCrop(crop,direction) {
  const c=normalizeCrop(crop);
  return normalizeCrop(direction>0?{x:1-c.y-c.height,y:c.x,width:c.height,height:c.width}:{x:c.y,y:1-c.x-c.width,width:c.height,height:c.width});
}
export function rotatedSize(width,height,rotation) {
  return turns(rotation)%2?{width:height,height:width}:{width,height};
}
export function pixelCrop(width,height,rotation,crop) {
  const size=rotatedSize(width,height,rotation),c=normalizeCrop(crop);
  const x=clamp(Math.round(c.x*size.width),0,size.width-1),y=clamp(Math.round(c.y*size.height),0,size.height-1);
  const right=clamp(Math.round((c.x+c.width)*size.width),x+1,size.width),bottom=clamp(Math.round((c.y+c.height)*size.height),y+1,size.height);
  return {x,y,width:right-x,height:bottom-y};
}
export function moveCrop(crop,handle,dx,dy,minX=0.01,minY=0.01) {
  const c=normalizeCrop(crop);
  if(handle==='move')return {...c,x:clamp(c.x+dx,0,1-c.width),y:clamp(c.y+dy,0,1-c.height)};
  let left=c.x,top=c.y,right=c.x+c.width,bottom=c.y+c.height;
  if(handle.includes('w'))left=clamp(left+dx,0,right-Math.min(minX,c.width));
  if(handle.includes('e'))right=clamp(right+dx,left+Math.min(minX,c.width),1);
  if(handle.includes('n'))top=clamp(top+dy,0,bottom-Math.min(minY,c.height));
  if(handle.includes('s'))bottom=clamp(bottom+dy,top+Math.min(minY,c.height),1);
  return normalizeCrop({x:left,y:top,width:right-left,height:bottom-top});
}
export function changed(rotation,crop) {
  const c=normalizeCrop(crop);
  return turns(rotation)!==0 || c.x>0.00001 || c.y>0.00001 || c.width<0.99999 || c.height<0.99999;
}
export function outputFormat(file) {
  const type=file.type?.toLowerCase();
  return type==='image/jpeg'||/\.jpe?g$/i.test(file.name)?'image/jpeg':type==='image/webp'?'image/webp':'image/png';
}
export function outputName(name,type) {
  return (String(name||'photo').replace(/\.[^.]+$/,'')||'photo')+({'image/jpeg':'.jpg','image/webp':'.webp'}[type]||'.png');
}
// Translate the full, EXIF-oriented source into the output crop directly. This
// avoids a second full-size canvas and makes rotation part of the saved pixels.
export function drawPhoto(ctx,source,width,height,rotation,crop=fullCrop(),scale=1) {
  const rect=pixelCrop(width,height,rotation,crop),r=turns(rotation);
  ctx.save();ctx.scale(scale,scale);ctx.translate(-rect.x,-rect.y);
  if(r===1){ctx.translate(height,0);ctx.rotate(Math.PI/2);}
  if(r===2){ctx.translate(width,height);ctx.rotate(Math.PI);}
  if(r===3){ctx.translate(0,width);ctx.rotate(-Math.PI/2);}
  ctx.drawImage(source,0,0,width,height);ctx.restore();
}
