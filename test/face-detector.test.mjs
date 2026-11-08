import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {detectionSize} from '../public/assets/face-scan.mjs';
import {detectionRegions} from '../public/assets/face-scan.mjs';
import {clampRect,sameRegion,unrotateRect,separateFaces} from '../public/assets/face-geometry.mjs';
import {sameDetection,projectYuNet,confirmYuNet} from '../public/assets/face-yunet.mjs';

const source=(await readFile(new URL('../public/assets/face-detector.mjs',import.meta.url),'utf8'))
 .replace(/^import .*;\n/,'').replace('export function detectFaces','function detectFaces').replaceAll('import.meta.url',JSON.stringify('https://family.example/assets/face-detector.mjs'))+'\nglobalThis.detectFaces=detectFaces;';
function fixture(createBitmap=async()=>({close(){}})){
 const workers=[],bitmaps=[];
 class Worker{
  constructor(){workers.push(this);this.messages=[];this.terminated=false;}
  postMessage(message){this.messages.push(message);}
  terminate(){this.terminated=true;}
  reply(data){this.onmessage({data:{id:this.messages.at(-1).id,...data}});}
 }
 const context=vm.createContext({URL,DOMException,Worker,detectionSize,setTimeout,clearTimeout,createImageBitmap:(image,options)=>{bitmaps.push({image,options});return createBitmap(image);}});vm.runInContext(source,context);
 return {detect:context.detectFaces,workers,bitmaps};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const image={naturalWidth:6000,naturalHeight:4000};

test('detection streams early faces, retains high-resolution source detail and reuses a completed scan',async()=>{
 const f=fixture(),progress=[],pending=f.detect('photo-a',image,undefined,faces=>progress.push(faces));await tick();
 assert.equal(f.bitmaps[0].options.resizeWidth,4096);assert.equal(f.bitmaps[0].options.resizeQuality,'high');
 const early=[{rect:{x:.1,y:.2,width:.02,height:.03},score:.8}];f.workers[0].reply({faces:early,partial:true,engine:'mediapipe'});
 assert.equal(progress.length,1);assert.equal(progress[0].engine,'mediapipe');
 const completed=[...early,{rect:{x:.125,y:.2,width:.02,height:.03},score:.7}];f.workers[0].reply({faces:completed,engine:'mediapipe+pico'});
 assert.equal((await pending).length,2);assert.equal((await f.detect('photo-a',image)).length,2);assert.equal(f.bitmaps.length,1);
});
test('closing a photo cancels its running scan and a late bitmap cannot leak into the next photo',async()=>{
 let completeOld,closed=false;
 const f=fixture(photo=>photo===image?new Promise(resolve=>{completeOld=()=>resolve({close(){closed=true;}});}):Promise.resolve({close(){}})),controller=new AbortController();
 const old=f.detect('old',image,controller.signal),rejected=assert.rejects(old,{name:'AbortError'});controller.abort();await rejected;
 const next=f.detect('next',{naturalWidth:800,naturalHeight:600});await tick();completeOld();await tick();
 assert.equal(closed,true);assert.equal(f.workers[0].terminated,true);assert.equal(f.workers[0].messages.length,0);assert.equal(f.workers[1].messages.length,1);
 f.workers[1].reply({faces:[{rect:{x:.7,y:.2,width:.1,height:.1},score:.9}]});assert.equal((await next)[0].rect.x,.7);
});
test('a late decode failure after cancellation cannot reject the new photo scan',async()=>{
 let failOld;const f=fixture(photo=>photo===image?new Promise((_,reject)=>{failOld=reject;}):Promise.resolve({close(){}})),controller=new AbortController();
 const old=f.detect('old',image,controller.signal),rejected=assert.rejects(old,{name:'AbortError'});controller.abort();await rejected;
 const next=f.detect('next',{naturalWidth:500,naturalHeight:400});await tick();failOld(Error('old image decode failed'));await tick();
 f.workers[1].reply({faces:[]});assert.equal((await next).length,0);
});
test('abandoned queued photos do not run and a worker failure preserves already usable face boxes',async()=>{
 const f=fixture(),first=f.detect('first',image);await tick();
 const queued=f.detect('queued',image),dropped=assert.rejects(queued,{name:'AbortError'}),latest=f.detect('latest',image);await dropped;
 f.workers[0].reply({faces:[]});await first;await tick();assert.equal(f.bitmaps.length,2);
 f.workers[0].reply({faces:[{rect:{x:.2,y:.1,width:.03,height:.04},score:.9}],partial:true});f.workers[0].onerror();
 assert.equal((await latest).length,1);
});

test('the worker finds close small faces through fine crops, projects coordinates correctly and supplements a successful model pass',async()=>{
 const workerSource=(await readFile(new URL('../public/assets/face-detection-worker.mjs',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'').replaceAll('import.meta.url',JSON.stringify('https://family.example/assets/face-detection-worker.mjs'));
 const width=1200,height=800,targets=[{x:80,y:80,width:180,height:180},{x:600,y:300,width:40,height:50},{x:644,y:300,width:40,height:50}],messages=[];
 let calls=0,picoCalls=0,closed=false;
 class Canvas{
  constructor(w,h){this.width=w;this.height=h;}
  getContext(type){if(type==='webgl2')return {getExtension:()=>null};return {drawImage:(bitmap,...args)=>{this.crop=args.length===8?args:[0,0,width,height,0,0,this.width,this.height];},translate(){},rotate(){},getImageData:()=>({data:new Uint8Array(this.width*this.height*4)})};}
 }
 const FaceDetector={createFromOptions:async()=>({detect:tile=>{calls++;const [x,y,w,h]=tile.crop;return {detections:targets.filter(face=>face.x>=x&&face.y>=y&&face.x+face.width<=x+w&&face.y+face.height<=y+h&&face.width/w*128>=8).map(face=>({boundingBox:{originX:(face.x-x)*tile.width/w,originY:(face.y-y)*tile.height/h,width:face.width*tile.width/w,height:face.height*tile.height/h},categories:[{score:.9}]}))};}})};
 const pico={unpack_cascade:()=>{},run_cascade:image=>++picoCalls===1?[[height*.7,width*.8,24,12]]:[],cluster_detections:d=>d};
 const self={location:{href:'https://family.example/assets/face-detection-worker.mjs',origin:'https://family.example'},fetch:async()=>new Response(new ArrayBuffer(1)),postMessage:message=>messages.push(message)};
 vm.runInNewContext(workerSource,{FaceDetector,pico,clampRect,sameRegion,separateFaces,sameDetection,createYuNet:async()=>{throw Error('Detailed model unavailable');},unrotateRect,detectionRegions,self,fetch:(...args)=>self.fetch(...args),OffscreenCanvas:Canvas,URL,Response});
 await self.onmessage({data:{id:7,bitmap:{width,height,close(){closed=true;}}}});
 const final=messages.at(-1);assert.equal(final.partial,false);assert.equal(final.engine,'mediapipe+pico');assert.equal(closed,true);assert.equal(picoCalls,4);assert.ok(calls>5);
 for(const target of targets)assert.ok(final.faces.some(face=>Math.abs(face.rect.x-target.x/width)<1e-9&&Math.abs(face.rect.width-target.width/width)<1e-9),'Every face keeps its original normalized coordinates');
 assert.equal(final.faces.length,4,'PICO must add a missed small face even when MediaPipe already found others');assert.ok(messages.some(message=>message.partial&&message.faces.length>0));
});
