export function intersection(a,b){return Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));}
export function sameRegion(a,b){const area=intersection(a,b);return area/Math.max(.000001,Math.min(a.width*a.height,b.width*b.height))>.55;}
export function unrotateRect(rect,turn){
  if(turn===90)return {x:rect.y,y:1-rect.x-rect.width,width:rect.height,height:rect.width};
  if(turn===180)return {x:1-rect.x-rect.width,y:1-rect.y-rect.height,width:rect.width,height:rect.height};
  if(turn===270)return {x:1-rect.y-rect.height,y:rect.x,width:rect.height,height:rect.width};
  return {...rect};
}
export function clampRect(rect){
  const x=Math.max(0,Math.min(.995,rect.x)),y=Math.max(0,Math.min(.995,rect.y));
  return {x,y,width:Math.max(.005,Math.min(1-x,rect.width)),height:Math.max(.005,Math.min(1-y,rect.height))};
}
export function mergeFaces(saved,detected){return [...saved,...detected.filter(face=>!saved.some(label=>sameRegion(label.rect,face.rect)))].slice(0,150);}
export function chooseFace(faces,point,size){
  const candidates=faces.filter(face=>{const r=face.rect,dx=Math.max(0,(28/size.width-r.width)/2),dy=Math.max(0,(28/size.height-r.height)/2);return point.x>=r.x-dx&&point.x<=r.x+r.width+dx&&point.y>=r.y-dy&&point.y<=r.y+r.height+dy;});
  return candidates.sort((a,b)=>Math.hypot((point.x-a.rect.x-a.rect.width/2)*size.width,(point.y-a.rect.y-a.rect.height/2)*size.height)-Math.hypot((point.x-b.rect.x-b.rect.width/2)*size.width,(point.y-b.rect.y-b.rect.height/2)*size.height))[0]||null;
}
export function manualRect(point,size){const width=Math.min(.3,Math.max(.04,64/size.width)),height=Math.min(.4,Math.max(.04,64/size.height));return clampRect({x:Math.max(0,Math.min(1-width,point.x-width/2)),y:Math.max(0,Math.min(1-height,point.y-height/2)),width,height});}
export function popoverPosition(face,panel,viewport){
  const gap=8,pad=8,left=viewport.left||0,top=viewport.top||0,right=left+viewport.width,bottom=top+viewport.height;
  const width=Math.min(panel.width,viewport.width-2*pad),height=Math.min(panel.height,viewport.height-2*pad);
  let x=face.x+face.width+gap,y=face.y;
  if(x+width>right-pad){if(face.x-gap-width>=left+pad)x=face.x-gap-width;else{x=face.x+face.width/2-width/2;y=face.y+face.height+gap;}}
  return {x:Math.max(left+pad,Math.min(right-width-pad,x)),y:Math.max(top+pad,Math.min(bottom-height-pad,y)),width,maxHeight:viewport.height-2*pad};
}
