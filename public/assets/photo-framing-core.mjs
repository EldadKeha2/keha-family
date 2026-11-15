export const HOLD_MS=1500;
export function normalizeFrame(value){return {x:Math.max(0,Math.min(1,Number.isFinite(value?.x)?value.x:.5)),y:Math.max(0,Math.min(1,Number.isFinite(value?.y)?value.y:.5)),fit:value?.fit==='contain'?'contain':'cover'};}
export function dragFrame(value,dx,dy,box,image){
  const frame=normalizeFrame(value),scale=(frame.fit==='contain'?Math.min:Math.max)(box.width/image.width,box.height/image.height),spaceX=box.width-image.width*scale,spaceY=box.height-image.height*scale;
  return normalizeFrame({...frame,x:frame.x+(Math.abs(spaceX)>1?dx/spaceX:0),y:frame.y+(Math.abs(spaceY)>1?dy/spaceY:0)});
}
