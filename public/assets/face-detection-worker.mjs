import {FaceDetector} from './vendor/mediapipe/vision_bundle.mjs';
import {clampRect,sameRegion,unrotateRect} from './face-geometry.mjs';
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
  if(!detector){const root=new URL('./vendor/mediapipe/',import.meta.url);detector=await FaceDetector.createFromOptions({wasmLoaderPath:new URL('vision_wasm_module_internal.js',root).href,wasmBinaryPath:RUNTIME},{canvas:new OffscreenCanvas(1,1),baseOptions:{modelAssetPath:new URL('blaze_face_short_range.tflite',root).href,delegate:'CPU'},runningMode:'IMAGE',minDetectionConfidence:.55,minSuppressionThreshold:.3});}
  return detector;
}
async function cpuFaces(bitmap){
  if(!cascade){const response=await fetch(new URL('./vendor/pico/facefinder',import.meta.url));if(!response.ok)throw Error('Face model unavailable');cascade=pico.unpack_cascade(new Int8Array(await response.arrayBuffer()));}
  const scale=Math.min(1,1024/Math.max(bitmap.width,bitmap.height)),width=Math.round(bitmap.width*scale),height=Math.round(bitmap.height*scale),canvas=new OffscreenCanvas(width,height),context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(bitmap,0,0,width,height);
  const found=[];
  for(const turn of [0,90,180,270]){
    const w=turn%180?height:width,h=turn%180?width:height,tile=new OffscreenCanvas(w,h),ctx=tile.getContext('2d',{willReadFrequently:true});
    if(turn===90){ctx.translate(w,0);ctx.rotate(Math.PI/2);}else if(turn===180){ctx.translate(w,h);ctx.rotate(Math.PI);}else if(turn===270){ctx.translate(0,h);ctx.rotate(-Math.PI/2);}ctx.drawImage(canvas,0,0);
    const rgba=ctx.getImageData(0,0,w,h).data,pixels=new Uint8Array(w*h);for(let n=0;n<pixels.length;n++)pixels[n]=(2*rgba[4*n]+7*rgba[4*n+1]+rgba[4*n+2])/10;
    const detections=pico.cluster_detections(pico.run_cascade({pixels,nrows:h,ncols:w,ldim:w},cascade,{shiftfactor:.1,minsize:20,maxsize:Math.min(w,h),scalefactor:1.1}),.2);
    for(const d of detections.filter(d=>d[3]>50)){const rect=clampRect(unrotateRect({x:(d[1]-d[2]/2)/w,y:(d[0]-d[2]/2)/h,width:d[2]/w,height:d[2]/h},turn)),previous=found.findIndex(face=>sameRegion(face.rect,rect));if(previous<0)found.push({rect,score:d[3]});else if(found[previous].score<d[3])found[previous]={rect,score:d[3]};}
  }
  return found.sort((a,b)=>b.score-a.score).slice(0,150);
}
self.onmessage=async event=>{
  const {id,bitmap}=event.data;
  try{
    if(!graphics()){self.postMessage({id,faces:await cpuFaces(bitmap),engine:'pico'});return;}
    const engine=await model(),width=bitmap.width,height=bitmap.height,canvas=new OffscreenCanvas(width,height),context=canvas.getContext('2d');context.drawImage(bitmap,0,0);
    const regions=[{x:0,y:0,width,height}];
    // Four overlapping crops improve small faces in group photos without scanning every thumbnail.
    if(Math.max(width,height)>640){const w=Math.round(width*.62),h=Math.round(height*.62);for(const x of [0,width-w])for(const y of [0,height-h])regions.push({x,y,width:w,height:h});}
    const found=[];
    for(const region of regions){
      const tile=new OffscreenCanvas(region.width,region.height);tile.getContext('2d').drawImage(canvas,region.x,region.y,region.width,region.height,0,0,region.width,region.height);
      const result=engine.detect(tile);
      for(const detection of result.detections){const b=detection.boundingBox;if(!b||b.width<4||b.height<4)continue;const rect=clampRect({x:(region.x+b.originX)/width,y:(region.y+b.originY)/height,width:b.width/width,height:b.height/height});const score=detection.categories?.[0]?.score||0;
        const previous=found.findIndex(face=>sameRegion(face.rect,rect));if(previous<0)found.push({rect,score});else if(found[previous].score<score)found[previous]={rect,score};
      }
    }
    self.postMessage({id,faces:found.length?found.sort((a,b)=>b.score-a.score).slice(0,150):await cpuFaces(bitmap),engine:found.length?'mediapipe':'pico'});
  }catch(error){hasGraphics=false;try{detector?.close();}catch{}detector=undefined;try{self.postMessage({id,faces:await cpuFaces(bitmap),engine:'pico'});}catch{self.postMessage({id,error:String(error?.message||'Face detection is unavailable')});}}
  finally{bitmap.close();}
};
