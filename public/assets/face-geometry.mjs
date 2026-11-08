export function intersection(a,b){return Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));}
export function sameRegion(a,b){
  const area=intersection(a,b),aa=a.width*a.height,bb=b.width*b.height;
  // Containment alone can swallow a neighbouring small face inside a broad box.
  return Math.min(aa,bb)/Math.max(aa,bb)>.45&&area/Math.max(Number.EPSILON,aa+bb-area)>.4&&
    Math.abs(a.x+a.width/2-b.x-b.width/2)<Math.min(a.width,b.width)*.18&&
    Math.abs(a.y+a.height/2-b.y-b.height/2)<Math.min(a.height,b.height)*.18;
}
export function unrotateRect(rect,turn){
  if(turn===90)return {x:rect.y,y:1-rect.x-rect.width,width:rect.height,height:rect.width};
  if(turn===180)return {x:1-rect.x-rect.width,y:1-rect.y-rect.height,width:rect.width,height:rect.height};
  if(turn===270)return {x:1-rect.y-rect.height,y:rect.x,width:rect.height,height:rect.width};
  return {...rect};
}
export function clampRect(rect){
  const x=Math.max(0,Math.min(.9995,rect.x)),y=Math.max(0,Math.min(.9995,rect.y));
  return {x,y,width:Math.max(.0005,Math.min(1-x,rect.width)),height:Math.max(.0005,Math.min(1-y,rect.height))};
}
export function resizeFaceRect(rect,handle,point){
  const minimum=.0005;let left=rect.x,top=rect.y,right=rect.x+rect.width,bottom=rect.y+rect.height;
  if(handle.includes('w'))left=Math.max(0,Math.min(right-minimum,point.x));
  if(handle.includes('e'))right=Math.min(1,Math.max(left+minimum,point.x));
  if(handle.includes('n'))top=Math.max(0,Math.min(bottom-minimum,point.y));
  if(handle.includes('s'))bottom=Math.min(1,Math.max(top+minimum,point.y));
  return {x:left,y:top,width:right-left,height:bottom-top};
}
export function separateFaces(faces){
  // Coarse cascades sometimes see a pair of heads as one very large face.
  // Independent, well-supported small regions are stronger evidence than that box.
  return faces.filter(face=>{
    const r=face.rect,area=r.width*r.height;
    const contained=faces.filter(other=>{
      if(other===face||other.score!==undefined&&other.score<.65)return false;
      const b=other.rect,x=b.x+b.width/2,y=b.y+b.height/2;
      return b.width*b.height<area*.38&&x>r.x&&x<r.x+r.width&&y>r.y&&y<r.y+r.height;
    });
    return !contained.some((a,i)=>contained.slice(i+1).some(b=>
      Math.hypot((a.rect.x+a.rect.width/2-b.rect.x-b.rect.width/2)/Math.max(a.rect.width,b.rect.width),(a.rect.y+a.rect.height/2-b.rect.y-b.rect.height/2)/Math.max(a.rect.height,b.rect.height))>.7));
  });
}
// A carefully positioned label may cover only the inner face while a model
// includes the hair or neck. It still describes one person. Require both
// containment and aligned centres; overlap with a neighbouring head is not enough.
export function labelledRegion(label,detected){
  if(sameRegion(label,detected))return true;
  const aa=label.width*label.height,bb=detected.width*detected.height,overlap=intersection(label,detected);
  return Math.min(aa,bb)/Math.max(aa,bb)>=.12&&overlap/Math.min(aa,bb)>=.88&&
    Math.abs(label.x+label.width/2-detected.x-detected.width/2)<=Math.max(label.width,detected.width)*.24&&
    Math.abs(label.y+label.height/2-detected.y-detected.height/2)<=Math.max(label.height,detected.height)*.28;
}
export function mergeFaces(saved,detected){const independent=separateFaces([...saved,...detected]);return [...saved,...detected.filter(face=>independent.includes(face)&&!saved.some(label=>labelledRegion(label.rect,face.rect)))].slice(0,150);}
export function chooseFace(faces,point,size){
  faces=separateFaces(faces);
  const inside=faces.filter(({rect:r})=>point.x>=r.x&&point.x<=r.x+r.width&&point.y>=r.y&&point.y<=r.y+r.height);
  const candidates=inside.length?inside:faces.filter(face=>{const r=face.rect,dx=Math.max(0,(28/size.width-r.width)/2),dy=Math.max(0,(28/size.height-r.height)/2);return point.x>=r.x-dx&&point.x<=r.x+r.width+dx&&point.y>=r.y-dy&&point.y<=r.y+r.height+dy;});
  if(inside.length>1){const smallest=Math.min(...inside.map(face=>face.rect.width*face.rect.height));for(let i=candidates.length-1;i>=0;i--)if(candidates[i].rect.width*candidates[i].rect.height>smallest*2)candidates.splice(i,1);}
  return candidates.sort((a,b)=>Math.hypot((point.x-a.rect.x-a.rect.width/2)*size.width,(point.y-a.rect.y-a.rect.height/2)*size.height)-Math.hypot((point.x-b.rect.x-b.rect.width/2)*size.width,(point.y-b.rect.y-b.rect.height/2)*size.height))[0]||null;
}
export function manualRect(point,size){const width=Math.min(.3,Math.max(.0005,32/size.width)),height=Math.min(.4,Math.max(.0005,32/size.height));return clampRect({x:Math.max(0,Math.min(1-width,point.x-width/2)),y:Math.max(0,Math.min(1-height,point.y-height/2)),width,height});}
export function popoverPosition(face,panel,viewport){
  const gap=8,pad=8,left=viewport.left||0,top=viewport.top||0,right=left+viewport.width,bottom=top+viewport.height;
  const width=Math.min(panel.width,viewport.width-2*pad),height=Math.min(panel.height,viewport.height-2*pad);
  let x=face.x+face.width+gap,y=face.y;
  if(x+width>right-pad){if(face.x-gap-width>=left+pad)x=face.x-gap-width;else{x=face.x+face.width/2-width/2;y=face.y+face.height+gap;}}
  return {x:Math.max(left+pad,Math.min(right-width-pad,x)),y:Math.max(top+pad,Math.min(bottom-height-pad,y)),width,maxHeight:viewport.height-2*pad};
}
