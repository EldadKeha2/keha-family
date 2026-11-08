import {sameRegion,intersection} from './face-geometry.mjs?v=4';

// YuNet predicts five landmark locations as well as a box. Two partly hidden
// people can have overlapping boxes but distinct eyes/noses; keep both.
export function sameDetection(a,b){
  if(!a.landmarks||!b.landmarks)return sameRegion(a.rect,b.rect);
  const area=intersection(a.rect,b.rect),aa=a.rect.width*a.rect.height,bb=b.rect.width*b.rect.height;
  if(area/Math.max(Number.EPSILON,aa+bb-area)<.25)return false;
  const w=Math.min(a.rect.width,b.rect.width),h=Math.min(a.rect.height,b.rect.height);
  const distance=a.landmarks.reduce((sum,p,i)=>sum+Math.hypot((p.x-b.landmarks[i].x)/w,(p.y-b.landmarks[i].y)/h),0)/5;
  return distance<.18;
}
export function suppressDetections(faces){
  const kept=[];
  for(const face of faces.toSorted((a,b)=>b.score-a.score))if(!kept.some(other=>sameDetection(other,face)))kept.push(face);
  return kept.slice(0,150);
}
export function decodeYuNet(outputs,threshold=.45){
  const faces=[];
  for(const stride of [8,16,32]){
    const cls=outputs['cls_'+stride].data,obj=outputs['obj_'+stride].data,boxes=outputs['bbox_'+stride].data,points=outputs['kps_'+stride].data,cols=640/stride;
    for(let i=0;i<cls.length;i++){
      const score=Math.sqrt(Math.max(0,Math.min(1,cls[i]))*Math.max(0,Math.min(1,obj[i])));if(score<threshold)continue;
      const c=i%cols,r=Math.floor(i/cols),width=Math.exp(boxes[i*4+2])*stride,height=Math.exp(boxes[i*4+3])*stride;
      const x=(c+boxes[i*4])*stride-width/2,y=(r+boxes[i*4+1])*stride-height/2;
      if(![x,y,width,height,score].every(Number.isFinite)||width<4||height<4)continue;
      faces.push({rect:{x,y,width,height},score,landmarks:Array.from({length:5},(_,n)=>({x:(points[i*10+n*2]+c)*stride,y:(points[i*10+n*2+1]+r)*stride}))});
    }
  }
  return suppressDetections(faces);
}
export function projectYuNet(face,region,size,drawn,flipped=false){
  const r=face.rect,sx=region.width/drawn.width,sy=region.height/drawn.height;
  const localX=flipped?drawn.width-r.x-r.width:r.x,cx=localX+r.width/2,cy=r.y+r.height/2;
  // Padding is not part of the photograph. Preserve real faces at image edges.
  if(cx<0||cy<0||cx>drawn.width||cy>drawn.height)return null;
  // A crop can cut one face into several convincing strips. An overlapping
  // neighbouring crop sees the intact face; real photo-edge faces stay valid.
  const margin=8;
  if((region.x>0&&localX<margin)||(region.y>0&&r.y<margin)||
    (region.x+region.width<size.width&&localX+r.width>drawn.width-margin)||
    (region.y+region.height<size.height&&r.y+r.height>drawn.height-margin))return null;
  const x=Math.max(0,region.x+localX*sx),y=Math.max(0,region.y+r.y*sy);
  const right=Math.min(size.width,region.x+(localX+r.width)*sx),bottom=Math.min(size.height,region.y+(r.y+r.height)*sy);
  if(right-x<3||bottom-y<3)return null;
  const points=flipped?[1,0,2,4,3].map(i=>face.landmarks[i]):face.landmarks;
  return {rect:{x:x/size.width,y:y/size.height,width:(right-x)/size.width,height:(bottom-y)/size.height},score:face.score,landmarks:points.map(p=>({x:(region.x+(flipped?drawn.width-p.x:p.x)*sx)/size.width,y:(region.y+p.y*sy)/size.height}))};
}
export function confirmYuNet(candidates,faces,pass){
  for(const face of faces){
    let candidate=candidates.find(other=>sameDetection(other,face));
    if(!candidate){candidate={...face,passes:new Set()};candidates.push(candidate);}
    if(face.score>candidate.score)Object.assign(candidate,face);
    candidate.passes.add(pass);
  }
  // A lower-confidence half-face needs agreement from independent crops/views.
  return candidates.filter(face=>face.score>=.65||(face.score>=.48&&face.passes.size>=2));
}

let pending;
export function createYuNet(){
  return pending||=(async()=>{
    const ort=await import('./vendor/onnxruntime/ort.wasm.min.mjs');
    ort.env.wasm.numThreads=1;ort.env.wasm.proxy=false;
    ort.env.wasm.wasmPaths=new URL('./vendor/onnxruntime/',import.meta.url).href;
    const response=await fetch(new URL('./vendor/yunet/face_detection_yunet_2023mar.onnx',import.meta.url),{cache:'force-cache'});
    if(!response.ok)throw Error('Detailed face model unavailable');
    const session=await ort.InferenceSession.create(new Uint8Array(await response.arrayBuffer()),{executionProviders:['wasm'],graphOptimizationLevel:'all'});
    const input=new Float32Array(3*640*640);
    return {async detect(canvas){
      const rgba=canvas.getContext('2d',{willReadFrequently:true}).getImageData(0,0,640,640).data,area=640*640;
      for(let i=0;i<area;i++){input[i]=rgba[i*4+2];input[area+i]=rgba[i*4+1];input[area*2+i]=rgba[i*4];}
      const tensor=new ort.Tensor('float32',input,[1,3,640,640]);let outputs;
      try{outputs=await session.run({input:tensor});return decodeYuNet(outputs);}
      finally{tensor.dispose();if(outputs)for(const value of Object.values(outputs))value.dispose();}
    }};
  })().catch(error=>{pending=undefined;throw error;});
}
