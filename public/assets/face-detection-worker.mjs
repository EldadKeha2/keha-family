import {FaceDetector} from './vendor/mediapipe/vision_bundle.mjs';
import {clampRect,sameRegion,unrotateRect,separateFaces} from './face-geometry.mjs?v=5';
import {detectionRegions} from './face-scan.mjs?v=2';
import {createYuNet,projectYuNet,confirmYuNet,sameDetection,unrotateYuNet} from './face-yunet.mjs?v=4';
import {STRONG_FACE_SCORE,proposalMatches,verifiedEvidence} from './face-verification.mjs?v=1';
import pico from './vendor/pico/pico.mjs';

// Model files are hosted with the site. Detection must not send photos or metrics elsewhere.
const RUNTIME='https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm/vision_wasm_module_internal.wasm';
const localFetch=self.fetch.bind(self);
self.fetch=(input,options)=>{
  const url=new URL(typeof input==='string'||input instanceof URL?input:input.url,self.location.href);
  if(url.origin===self.location.origin)return localFetch(input,options);
  // The sole external request downloads a pinned public runtime, without visitor data or credentials.
  if(url.href===RUNTIME&&(!options?.method||options.method==='GET'))return localFetch(RUNTIME,{method:'GET',mode:'cors',credentials:'omit',referrerPolicy:'no-referrer',integrity:'sha256-YXuOAkjb0n6dfs5CGABOrkzvtJkZbRu0+g4/7yFwh1Y=',cache:'force-cache'});
  return Promise.reject(new TypeError('External face-detector requests are disabled'));
};

let detector,cascade,hasGraphics;
function graphics(){
  if(hasGraphics===undefined)try{const gl=new OffscreenCanvas(1,1).getContext('webgl2');hasGraphics=Boolean(gl);gl?.getExtension('WEBGL_lose_context')?.loseContext();}catch{hasGraphics=false;}
  return hasGraphics;
}
async function model(){
  if(!detector){const root=new URL('./vendor/mediapipe/',import.meta.url);detector=await FaceDetector.createFromOptions({wasmLoaderPath:new URL('vision_wasm_module_internal.js',root).href,wasmBinaryPath:RUNTIME},{canvas:new OffscreenCanvas(1,1),baseOptions:{modelAssetPath:new URL('blaze_face_short_range.tflite',root).href,delegate:'CPU'},runningMode:'IMAGE',minDetectionConfidence:.55,minSuppressionThreshold:.45});}
  return detector;
}
async function loadCascade(){
  if(!cascade){const response=await fetch(new URL('./vendor/pico/facefinder',import.meta.url));if(!response.ok)throw Error('Face model unavailable');cascade=pico.unpack_cascade(new Int8Array(await response.arrayBuffer()));}
}
async function cpuFaces(bitmap,onProgress=()=>{},supplemental=false){
  await loadCascade();
  const found=[];
  for(const turn of [0,90,270,180]){
    const scale=Math.min(1,(turn===0?2560:1920)/Math.max(bitmap.width,bitmap.height)),width=Math.round(bitmap.width*scale),height=Math.round(bitmap.height*scale);
    const w=turn%180?height:width,h=turn%180?width:height,tile=new OffscreenCanvas(w,h),ctx=tile.getContext('2d',{willReadFrequently:true});
    if(turn===90){ctx.translate(w,0);ctx.rotate(Math.PI/2);}else if(turn===180){ctx.translate(w,h);ctx.rotate(Math.PI);}else if(turn===270){ctx.translate(0,h);ctx.rotate(-Math.PI/2);}ctx.drawImage(bitmap,0,0,width,height);
    const rgba=ctx.getImageData(0,0,w,h).data,pixels=new Uint8Array(w*h);for(let n=0;n<pixels.length;n++)pixels[n]=(2*rgba[4*n]+7*rgba[4*n+1]+rgba[4*n+2])/10;
    const detections=pico.cluster_detections(pico.run_cascade({pixels,nrows:h,ncols:w,ldim:w},cascade,{shiftfactor:.1,minsize:16,maxsize:Math.min(w,h),scalefactor:1.1}),.35);
    for(const d of detections.filter(d=>d[3]>(supplemental?7:5))){const rect=clampRect(unrotateRect({x:(d[1]-d[2]/2)/w,y:(d[0]-d[2]/2)/h,width:d[2]/w,height:d[2]/h},turn)),score=1-Math.exp(-d[3]/12),previous=found.findIndex(face=>sameRegion(face.rect,rect));if(previous<0)found.push({rect,score,turn});else if(found[previous].score<score)found[previous]={rect,score,turn};}
    onProgress(found);tile.width=tile.height=1;
  }
  return found.sort((a,b)=>b.score-a.score).slice(0,150);
}
async function detailedFaces(bitmap,onProgress){
  const engine=await createYuNet(),size={width:bitmap.width,height:bitmap.height},tile=new OffscreenCanvas(640,640),candidates=[];
  const regions=detectionRegions(size.width,size.height,[1024,384]);
  let pass=0;
  try{
    for(const region of regions){
      const scale=640/Math.max(region.width,region.height),drawn={width:Math.round(region.width*scale),height:Math.round(region.height*scale)};
      const scan=async flipped=>{
        const ctx=tile.getContext('2d',{willReadFrequently:true});ctx.clearRect(0,0,640,640);ctx.save();
        if(flipped){ctx.translate(drawn.width,0);ctx.scale(-1,1);}
        ctx.drawImage(bitmap,region.x,region.y,region.width,region.height,0,0,drawn.width,drawn.height);ctx.restore();
        const faces=(await engine.detect(tile)).map(face=>projectYuNet(face,region,size,drawn,flipped)).filter(Boolean);
        const accepted=confirmYuNet(candidates,faces,++pass);onProgress(accepted.filter(face=>face.score>=STRONG_FACE_SCORE));return faces;
      };
      const faces=await scan(false);
      // A second viewpoint helps asymmetric occlusion and verifies weak faces.
      if(faces.length||pass===1)await scan(true);
    }
    return candidates;
  }finally{tile.width=tile.height=1;}
}

// Recheck every uncertain neural, cascade or secondary-model proposal. Flowers
// can survive mirrored views; require changed context/scale and independent
// cascade evidence when neural confidence remains moderate.
async function verifiedFaces(bitmap,proposals,known,add){
 let engine;try{engine=await createYuNet();}catch{return;}
 try{await loadCascade();}catch{}
 const size={width:bitmap.width,height:bitmap.height},tile=new OffscreenCanvas(640,640),pending=[];
 for(const proposal of proposals.toSorted((a,b)=>b.score-a.score))if(!known.some(face=>sameDetection(face,proposal))&&!pending.some(face=>sameDetection(face,proposal)))pending.push(proposal);
 try{for(const proposal of pending.slice(0,150)){
  const r=proposal.rect,pixels=Math.max(r.width*size.width,r.height*size.height),scores=[];let best=null;
  const tilt=proposal.landmarks?Math.atan2((proposal.landmarks[1].y-proposal.landmarks[0].y)*size.height,(proposal.landmarks[1].x-proposal.landmarks[0].x)*size.width):-(proposal.turn||0)*Math.PI/180;
  const angles=Math.abs(tilt)>.2?[0,-tilt]:[0];
  for(const context of [2.4,3.4,5]){
   const edge=Math.max(24,pixels*context),width=Math.min(edge,size.width),height=Math.min(edge,size.height);
   const region={x:Math.max(0,Math.min(size.width-width,(r.x+r.width/2)*size.width-width/2)),y:Math.max(0,Math.min(size.height-height,(r.y+r.height/2)*size.height-height/2)),width,height};
   const scale=640/Math.max(width,height),drawn={width:Math.round(width*scale),height:Math.round(height*scale)};
   let score=0;
   for(const angle of angles){
    const ctx=tile.getContext('2d',{willReadFrequently:true});ctx.clearRect(0,0,640,640);ctx.save();ctx.translate(drawn.width/2,drawn.height/2);ctx.rotate(angle);ctx.translate(-drawn.width/2,-drawn.height/2);ctx.drawImage(bitmap,region.x,region.y,width,height,0,0,drawn.width,drawn.height);ctx.restore();
    const faces=(await engine.detect(tile)).map(face=>projectYuNet(unrotateYuNet(face,angle,drawn),region,size,drawn)).filter(face=>face&&proposalMatches(proposal,face,pixels));
    const winner=faces.toSorted((a,b)=>b.score-a.score)[0];score=Math.max(score,winner?.score||0);if(winner&&(!best||winner.score>best.score))best=winner;
   }
   scores.push(score);
   if(verifiedEvidence(scores,-1,pixels))break;
  }
  let support=-1;
  if(best&&cascade&&!verifiedEvidence(scores,-1,pixels)&&scores.filter(score=>score>=.7).length>=2){
   // Test native pixels around the candidate, rather than treating a proposal
   // elsewhere in the same crop as confirmation of this face.
   const edge=Math.max(24,Math.ceil(pixels*3)),w=Math.min(edge,size.width),h=Math.min(edge,size.height),x=Math.max(0,Math.min(size.width-w,Math.floor((r.x+r.width/2)*size.width-w/2))),y=Math.max(0,Math.min(size.height-h,Math.floor((r.y+r.height/2)*size.height-h/2)));
   const local=new OffscreenCanvas(w,h),ctx=local.getContext('2d',{willReadFrequently:true});
   const cx=(r.x+r.width/2)*size.width-x,cy=(r.y+r.height/2)*size.height-y;
   for(const angle of angles){ctx.clearRect(0,0,w,h);ctx.save();ctx.translate(cx,cy);ctx.rotate(angle);ctx.translate(-cx,-cy);ctx.drawImage(bitmap,x,y,w,h,0,0,w,h);ctx.restore();
    const rgba=ctx.getImageData(0,0,w,h).data,gray=new Uint8Array(w*h);for(let i=0;i<gray.length;i++)gray[i]=(2*rgba[i*4]+7*rgba[i*4+1]+rgba[i*4+2])/10;
    for(const scale of [.65,.8,1,1.2,1.5])for(const dx of [-.18,0,.18])for(const dy of [-.18,0,.18]){const s=pixels*scale,c=cx+dx*r.width*size.width,row=cy+dy*r.height*size.height;if(c-s/2>0&&row-s/2>0&&c+s/2<w&&row+s/2<h)support=Math.max(support,cascade(row,c,s,gray,w));}
   }
   local.width=local.height=1;
  }
  if(best&&verifiedEvidence(scores,support,pixels))add([best]);
 }return true;}finally{tile.width=tile.height=1;}
}

self.onmessage=async event=>{
  const {id,bitmap}=event.data;
  let galleryFaces=null;
  const found=[],snapshotFaces=()=>separateFaces(found).toSorted((a,b)=>b.score-a.score).slice(0,150).map(({rect,score})=>({rect,score}));
  const publish=(engine,partial=true)=>self.postMessage({id,faces:snapshotFaces(),galleryFaces,engine,partial});
  const add=faces=>{for(const face of faces){const previous=found.findIndex(other=>sameDetection(other,face));if(previous<0)found.push(face);else if(found[previous].score<face.score)found[previous]=face;}};
  let detailed=false;const proposals=[];
  try{
    // CPU/WASM works on phones and browsers without a graphics context too.
    try{let passes=0;proposals.push(...await detailedFaces(bitmap,faces=>{add(faces);if(++passes%4===0||passes===1)publish('yunet');}));detailed=true;galleryFaces=snapshotFaces();publish('yunet');}catch{}
    if(!graphics()){try{proposals.push(...await cpuFaces(bitmap,()=>{},true));}catch{}await verifiedFaces(bitmap,proposals,found,add);galleryFaces=detailed?snapshotFaces():null;publish(detailed?'yunet+verified-pico':'pico-manual',false);return;}
    const engine=await model(),width=bitmap.width,height=bitmap.height,regions=detectionRegions(width,height),tile=new OffscreenCanvas(1,1);
    let scanned=0;
    for(const region of regions){
      const scale=Math.min(1,1024/Math.max(region.width,region.height));tile.width=Math.max(1,Math.round(region.width*scale));tile.height=Math.max(1,Math.round(region.height*scale));
      tile.getContext('2d').drawImage(bitmap,region.x,region.y,region.width,region.height,0,0,tile.width,tile.height);
      const result=engine.detect(tile);
      for(const detection of result.detections){const b=detection.boundingBox;if(!b||b.width<4||b.height<4)continue;
        // Reject cut-off boxes; overlapping tiles supply an intact view at seams.
        if((region.x>0&&b.originX<1)||(region.y>0&&b.originY<1)||(region.x+region.width<width&&b.originX+b.width>tile.width-1)||(region.y+region.height<height&&b.originY+b.height>tile.height-1))continue;
        const sx=region.width/tile.width,sy=region.height/tile.height,rect=clampRect({x:(region.x+b.originX*sx)/width,y:(region.y+b.originY*sy)/height,width:b.width*sx/width,height:b.height*sy/height}),score=detection.categories?.[0]?.score||0;
        // Secondary-model boxes also need the detailed local recheck. A high
        // secondary score alone must not turn a torso or ashtray into a face.
        proposals.push({rect,score});
      }
      if(++scanned%8===0||scanned===1)publish(detailed?'yunet+mediapipe':'mediapipe');
    }
    tile.width=tile.height=1;galleryFaces=snapshotFaces();publish(detailed?'yunet+mediapipe':'mediapipe');
    // PICO also supplements successful model results: one large face must not
    // prevent a native-detail scan for smaller faces elsewhere in the photo.
    let verified=false;try{proposals.push(...await cpuFaces(bitmap,()=>{},true));verified=await verifiedFaces(bitmap,proposals,found,add);}catch{}
    galleryFaces=detailed||verified?snapshotFaces():null;publish(detailed?'yunet+mediapipe+verified-pico':'mediapipe+verified-pico',false);
  }catch(error){hasGraphics=false;try{detector?.close();}catch{}detector=undefined;try{proposals.push(...await cpuFaces(bitmap,()=>{},true));await verifiedFaces(bitmap,proposals,found,add);if(detailed)galleryFaces=snapshotFaces();publish(detailed?'yunet+verified-pico':'manual',false);}catch{if(found.length)publish('yunet',false);else self.postMessage({id,error:String(error?.message||'Face detection is unavailable')});}}
  finally{bitmap.close();}
};
