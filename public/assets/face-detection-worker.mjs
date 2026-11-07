import {FaceDetector} from './vendor/mediapipe/vision_bundle.mjs';
import {clampRect,sameRegion,unrotateRect} from './face-geometry.mjs?v=2';
import {detectionRegions} from './face-scan.mjs?v=1';
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
async function cpuFaces(bitmap,onProgress=()=>{},supplemental=false){
  if(!cascade){const response=await fetch(new URL('./vendor/pico/facefinder',import.meta.url));if(!response.ok)throw Error('Face model unavailable');cascade=pico.unpack_cascade(new Int8Array(await response.arrayBuffer()));}
  const found=[];
  for(const turn of [0,90,270,180]){
    const scale=Math.min(1,(turn===0?2560:1920)/Math.max(bitmap.width,bitmap.height)),width=Math.round(bitmap.width*scale),height=Math.round(bitmap.height*scale);
    const w=turn%180?height:width,h=turn%180?width:height,tile=new OffscreenCanvas(w,h),ctx=tile.getContext('2d',{willReadFrequently:true});
    if(turn===90){ctx.translate(w,0);ctx.rotate(Math.PI/2);}else if(turn===180){ctx.translate(w,h);ctx.rotate(Math.PI);}else if(turn===270){ctx.translate(0,h);ctx.rotate(-Math.PI/2);}ctx.drawImage(bitmap,0,0,width,height);
    const rgba=ctx.getImageData(0,0,w,h).data,pixels=new Uint8Array(w*h);for(let n=0;n<pixels.length;n++)pixels[n]=(2*rgba[4*n]+7*rgba[4*n+1]+rgba[4*n+2])/10;
    const detections=pico.cluster_detections(pico.run_cascade({pixels,nrows:h,ncols:w,ldim:w},cascade,{shiftfactor:.1,minsize:16,maxsize:Math.min(w,h),scalefactor:1.1}),.35);
    for(const d of detections.filter(d=>d[3]>(supplemental?7:5))){const rect=clampRect(unrotateRect({x:(d[1]-d[2]/2)/w,y:(d[0]-d[2]/2)/h,width:d[2]/w,height:d[2]/h},turn)),score=1-Math.exp(-d[3]/12),previous=found.findIndex(face=>sameRegion(face.rect,rect));if(previous<0)found.push({rect,score});else if(found[previous].score<score)found[previous]={rect,score};}
    onProgress(found);tile.width=tile.height=1;
  }
  return found.sort((a,b)=>b.score-a.score).slice(0,150);
}
self.onmessage=async event=>{
  const {id,bitmap}=event.data;
  const found=[],publish=(engine,partial=true)=>self.postMessage({id,faces:found.toSorted((a,b)=>b.score-a.score).slice(0,150),engine,partial});
  const add=faces=>{for(const face of faces){const previous=found.findIndex(other=>sameRegion(other.rect,face.rect));if(previous<0)found.push(face);else if(found[previous].score<face.score)found[previous]=face;}};
  try{
    if(!graphics()){await cpuFaces(bitmap,faces=>{add(faces);publish('pico');});publish('pico',false);return;}
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
        add([{rect,score}]);
      }
      if(++scanned%8===0||scanned===1)publish('mediapipe');
    }
    tile.width=tile.height=1;publish('mediapipe');
    // PICO also supplements successful model results: one large face must not
    // prevent a native-detail scan for smaller faces elsewhere in the photo.
    try{await cpuFaces(bitmap,faces=>{add(faces.filter(face=>!found.some(other=>sameRegion(other.rect,face.rect))));publish('mediapipe+pico');},found.length>0);}catch{}
    publish('mediapipe+pico',false);
  }catch(error){hasGraphics=false;try{detector?.close();}catch{}detector=undefined;try{await cpuFaces(bitmap,faces=>{add(faces);publish('pico');});publish('pico',false);}catch{if(found.length)publish('mediapipe',false);else self.postMessage({id,error:String(error?.message||'Face detection is unavailable')});}}
  finally{bitmap.close();}
};
