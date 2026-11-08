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

// Protect the whole head, with extra room above the model's face rectangle.
export function labelFaceBounds(face){
  const x=Math.min(10,Math.max(2,face.width*.12)),top=Math.min(18,Math.max(3,face.height*.22)),bottom=Math.min(6,Math.max(2,face.height*.08));
  return {x:face.x-x,y:face.y-top,width:face.width+2*x,height:face.height+top+bottom};
}
export function labelLeader(box,face){
  const head=labelFaceBounds(face),cx=box.x+box.width/2,cy=box.y+box.height/2,fx=head.x+head.width/2,fy=head.y+head.height/2;
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  return {from:{x:clamp(fx,box.x,box.x+box.width),y:clamp(fy,box.y,box.y+box.height)},to:{x:clamp(cx,head.x,head.x+head.width),y:clamp(cy,head.y,head.y+head.height)}};
}
function labelGrid(rects=[],gap=0){
  const cells=new Map(),size=64;
  const visit=(r,fn)=>{for(let x=Math.floor((r.x-gap)/size);x<=Math.floor((r.x+r.width+gap)/size);x++)for(let y=Math.floor((r.y-gap)/size);y<=Math.floor((r.y+r.height+gap)/size);y++)fn(x+':'+y);};
  const add=r=>visit(r,key=>{if(!cells.has(key))cells.set(key,[]);cells.get(key).push(r);});
  rects.forEach(add);
  return {add,near(r){const result=new Set();visit(r,key=>{for(const other of cells.get(key)||[])result.add(other);});return [...result];}};
}
const labelCollision=(a,b,gap=0)=>a.x<b.x+b.width+gap&&a.x+a.width+gap>b.x&&a.y<b.y+b.height+gap&&a.y+a.height+gap>b.y;
function lineCrossesFace(line,rect){
  let lo=0,hi=1;const dx=line.to.x-line.from.x,dy=line.to.y-line.from.y;
  for(const [p,q] of [[-dx,line.from.x-rect.x],[dx,rect.x+rect.width-line.from.x],[-dy,line.from.y-rect.y],[dy,rect.y+rect.height-line.from.y]]){
    if(Math.abs(p)<1e-9){if(q<0)return false;continue;}
    const t=q/p;if(p<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);if(lo>hi)return false;
  }
  return true;
}
// Try measured one-, two- and three-line labels in the free space around every
// head. A separate legend is safer than covering faces in an impossible crowd.
export function layoutFaceLabels(labels,{width,height,faces=[]},gap=4){
  if(!(width>0&&height>0))return null;if(!labels.length)return [];
  const variants=labels.map(label=>(label.variants||[label]).map((v,index)=>({width:Math.min(v.width,width),height:v.height,variant:index})).filter(v=>v.width>0&&v.height>0&&v.height<=height));
  if(variants.some(v=>!v.length)||variants.reduce((sum,v)=>sum+Math.min(...v.map(r=>r.width*r.height)),0)>width*height)return null;
  const uniqueFaces=new Map([...labels.map(l=>l.face),...faces].filter(r=>r&&r.width>0&&r.height>0&&r.x<width&&r.y<height&&r.x+r.width>0&&r.y+r.height>0).map(r=>[[r.x,r.y,r.width,r.height].join(','),r]));
  const heads=[...uniqueFaces.values()].map(labelFaceBounds),faceGrid=labelGrid(heads,gap),pad=1;
  const options=labels.map((label,index)=>{
    const head=labelFaceBounds(label.face),cx=head.x+head.width/2,cy=head.y+head.height/2,candidates=[];
    const neighbours=heads.map(r=>({r,d:Math.hypot(r.x+r.width/2-cx,r.y+r.height/2-cy)})).sort((a,b)=>a.d-b.d).slice(0,10).map(o=>o.r);
    for(const v of variants[index]){
      const w=v.width,h=v.height,maxX=width-w-pad,maxY=height-h-pad;if(maxX<pad||maxY<pad)continue;
      const xs=[pad,maxX,cx-w/2,head.x-w-gap,head.x+head.width+gap,head.x,head.x+head.width-w],ys=[pad,maxY,head.y-h-gap,head.y+head.height+gap,cy-h/2];
      for(let n=1;n<=5;n++){xs.push(cx-w/2-n*(w+gap)/2,cx-w/2+n*(w+gap)/2);ys.push(head.y-h-gap-n*(h+gap),head.y+head.height+gap+n*(h+gap));}
      for(const r of neighbours){xs.push(r.x-w-gap,r.x+r.width+gap);ys.push(r.y-h-gap,r.y+r.height+gap);}
      const unique=(values,max)=>[...new Set(values.map(n=>Math.max(pad,Math.min(max,Math.round(n*10)/10))))];
      for(const x of unique(xs,maxX))for(const y of unique(ys,maxY)){
        const box={x,y,...v};if(faceGrid.near(box).some(r=>labelCollision(box,r,gap)))continue;
        const leader=labelLeader(box,label.face),distance=Math.hypot(leader.to.x-leader.from.x,leader.to.y-leader.from.y),above=y+h<=head.y,below=y>=head.y+head.height;
        const wrap=Math.max(0,h-variants[index][0].height)*.35;
        const score=distance+(above?0:below?10+head.height*.2:18+head.height*.35)+wrap+Math.abs(x+w/2-cx)*.08;
        candidates.push({...box,leader,score});
      }
    }
    candidates.sort((a,b)=>a.score-b.score||a.variant-b.variant||a.y-b.y||a.x-b.x);
    // Never route a connector through another person's face.
    const safe=[];for(const box of candidates){
      const line=box.leader,extent={x:Math.min(line.from.x,line.to.x),y:Math.min(line.from.y,line.to.y),width:Math.abs(line.to.x-line.from.x),height:Math.abs(line.to.y-line.from.y)};
      if(!faceGrid.near(extent).some(r=>!(r.x===head.x&&r.y===head.y&&r.width===head.width&&r.height===head.height)&&lineCrossesFace(line,r)))safe.push(box);
      if(safe.length===180)break;
    }
    return {index,face:label.face,candidates:safe.length?safe:candidates.slice(0,180).map(box=>({...box,leader:null})),nearby:safe.filter(c=>c.score<60).length};
  });
  const orders=[options.slice().sort((a,b)=>a.nearby-b.nearby||a.face.y-b.face.y||a.face.x-b.face.x),options.slice().sort((a,b)=>a.face.y-b.face.y||a.face.x-b.face.x),options.slice().sort((a,b)=>a.candidates.length-b.candidates.length||b.face.y-a.face.y)];
  for(const ordered of orders){
    const occupied=labelGrid([],gap),result=Array(labels.length);let complete=true;
    for(const label of ordered){const box=label.candidates.find(box=>!occupied.near(box).some(r=>labelCollision(box,r,gap)));if(!box){complete=false;break;}occupied.add(box);result[label.index]=box;}
    if(complete)return result;
  }
  return null;
}
