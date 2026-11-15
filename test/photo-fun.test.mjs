import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {BACKGROUNDS,HEADS,PROPS,funDefaults,normalizeFun,hitSticker,placedSticker,drawBackground,drawSticker} from '../public/assets/photo-fun-core.mjs';
import {separatePerson} from '../public/assets/photo-fun-segment.mjs';

test('fun state round-trips through undo snapshots without sharing mutable sticker or brush arrays',()=>{
  const input={background:'beach',stickers:[{id:'lion',kind:'emoji',glyph:'🦁',x:.4,y:.3,size:.2,rotation:20}],strokes:[{mode:'erase',size:.08,points:[{x:.1,y:.2}]}]},copy=normalizeFun(JSON.parse(JSON.stringify(normalizeFun(input))));
  assert.deepEqual(copy,normalizeFun(input));copy.stickers[0].x=.9;copy.strokes[0].points[0].x=.9;assert.equal(input.stickers[0].x,.4);assert.equal(input.strokes[0].points[0].x,.1);
  assert.deepEqual(funDefaults(),{background:'none',stickers:[],strokes:[],feather:2});
});
test('invalid and extreme sticker inputs cannot escape the bounded photo design state',()=>{
  const state=normalizeFun({background:'not-a-scene',stickers:[{kind:'emoji',x:Infinity,y:-90,size:900,rotation:-999},{kind:'script',text:'bad'}],strokes:[{points:[{x:NaN,y:1},{x:90,y:-10}]}]});
  assert.equal(state.background,'none');assert.equal(state.stickers.length,1);assert.equal(state.stickers[0].x,.5);assert.equal(state.stickers[0].y,0);assert.equal(state.stickers[0].size,1.3);assert.equal(state.stickers[0].rotation,-180);assert.deepEqual(state.strokes[0].points,[{x:1,y:0}]);
  assert.equal(normalizeFun({stickers:Array.from({length:100},()=>({kind:'emoji'}))}).stickers.length,40);
});
test('head and prop placement follows normalized face coordinates on portrait and landscape photos',()=>{
  const face={rect:{x:.4,y:.15,width:.16,height:.2}};
  for(const [w,h]of [[1600,1000],[1000,1600]]){
    const head=placedSticker(HEADS[0],'head',face,w,h,'head'),glasses=placedSticker(PROPS[0],'prop',face,w,h,'glasses'),crown=placedSticker(PROPS[1],'prop',face,w,h,'crown');
    assert.ok(Math.abs(head.x-.48)<1e-10);assert.ok(head.y>face.rect.y&&head.y<face.rect.y+face.rect.height);assert.ok(Math.abs(head.size*Math.min(w,h)-face.rect.width*w*1.55)<1e-9);assert.ok(crown.y<face.rect.y);assert.ok(glasses.y>face.rect.y);
    assert.equal(hitSticker([head],{x:head.x,y:head.y},w,h)?.id,'head');assert.equal(hitSticker([head],{x:0,y:1},w,h),null);
  }
});
test('hit testing uses topmost sticker order and its rotation without changing the saved layout',()=>{
  const a=placedSticker(HEADS[0],'head',null,1000,800,'a'),b={...a,id:'b',rotation:75};assert.equal(hitSticker([a,b],{x:.5,y:.35},1000,800).id,'b');assert.equal(b.rotation,75);
});
function drawingContext(){const commands=[],ctx=new Proxy({commands},{get(target,key){if(key in target)return target[key];if(key==='createLinearGradient'||key==='createRadialGradient')return (...args)=>{commands.push([key,...args]);return {addColorStop:(...args)=>commands.push(['stop',...args])};};return (...args)=>commands.push([key,...args]);},set(target,key,value){target[key]=value;return true;}});return ctx;}
test('every illustrated destination and sticker draws with the same deterministic preview/export coordinates',()=>{
  for(const [id]of BACKGROUNDS){const a=drawingContext(),b=drawingContext();drawBackground(a,600,400,id);drawBackground(b,600,400,id);assert.deepEqual(a.commands,b.commands);assert.ok(a.commands.length>2);}
  for(const p of [...HEADS,...PROPS]){const ctx=drawingContext(),sticker=placedSticker(p,HEADS.includes(p)?'head':'prop',null,1000,800,'s');drawSticker(ctx,sticker,1000,800);assert.deepEqual(ctx.commands.find(([name])=>name==='translate'),['translate',sticker.x*1000,sticker.y*800]);assert.ok(ctx.commands.some(([name])=>name==='fillText'||name==='fill'));}
});
const workerSource=(await readFile(new URL('../public/assets/photo-fun-worker.mjs',import.meta.url),'utf8')).replace(/^import[^\n]+\n/,'');
test('person segmentation keeps the selfie probability orientation, transfers a copy and closes input pixels',async()=>{
  const sent=[],fetches=[];let options,closed=false;
  const self={location:{href:'https://family.example/assets/photo-fun-worker.mjs',origin:'https://family.example'},fetch:async(...args)=>{fetches.push(args);return {};},postMessage:(...args)=>sent.push(args)};
  const ImageSegmenter={createFromOptions:async(files,opts)=>{options=opts;return {getLabels:()=>['selfie'],segment(bitmap,callback){callback({confidenceMasks:[{width:3,height:1,getAsFloat32Array:()=>Float32Array.from([0,.5,1])}]});}};}};
  vm.runInNewContext(workerSource.replaceAll('import.meta.url',"'https://family.example/assets/photo-fun-worker.mjs'"),{self,ImageSegmenter,OffscreenCanvas:class{},URL,Uint8Array});
  await self.onmessage({data:{id:8,bitmap:{close(){closed=true;}}}});assert.equal(closed,true);assert.deepEqual([...sent[0][0].mask.data],[0,128,255]);assert.equal(options.outputConfidenceMasks,true);assert.equal(options.baseOptions.delegate,'CPU');assert.match(options.baseOptions.modelAssetPath,/\/assets\/vendor\/mediapipe\/selfie_segmenter.tflite$/);
  await assert.rejects(self.fetch('https://elsewhere.example/collect-photo'),/External photo processing/);assert.equal(fetches.length,0);
  await self.fetch('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm/vision_wasm_module_internal.wasm');assert.equal(fetches[0][1].credentials,'omit');assert.equal(fetches[0][1].referrerPolicy,'no-referrer');assert.match(fetches[0][1].integrity,/^sha256-/);
});
test('closing during a background separation terminates its worker instead of publishing late output',async()=>{
  const originals={Worker:globalThis.Worker,createImageBitmap:globalThis.createImageBitmap};let terminated=false,closed=false,worker;
  globalThis.Worker=class{constructor(){worker=this;}terminate(){terminated=true;}postMessage(){}};globalThis.createImageBitmap=async()=>({close(){closed=true;}});
  try{const controller=new AbortController(),pending=separatePerson({width:100,height:100},controller.signal);controller.abort();await assert.rejects(pending,error=>error.name==='AbortError');await new Promise(resolve=>setImmediate(resolve));assert.equal(terminated,true);assert.equal(closed,true);assert.ok(worker);}
  finally{Object.assign(globalThis,originals);}
});
test('a browser without a GPU falls back to the CPU worker using local pixels only',async()=>{
  const original={Worker:globalThis.Worker,createImageBitmap:globalThis.createImageBitmap,document:globalThis.document},workers=[];
  globalThis.Worker=class{constructor(url){this.url=String(url);workers.push(this);}terminate(){}postMessage(message){if(this.url.includes('photo-fun-worker'))queueMicrotask(()=>this.onmessage({data:{error:'GPU unavailable'}}));else{assert.equal(message.pixels.length,320*320*4);assert.equal(message.width,320);queueMicrotask(()=>this.onmessage({data:{mask:{width:2,height:1,data:new Uint8Array([0,255])}}}));}}};
  globalThis.createImageBitmap=async()=>({close(){}});globalThis.document={createElement:()=>({getContext:()=>({drawImage(){},getImageData:()=>({data:new Uint8ClampedArray(320*320*4)})})})};
  try{const mask=await separatePerson({width:20,height:30});assert.deepEqual([...mask.data],[0,255]);assert.equal(workers.length,2);assert.match(workers[1].url,/photo-cutout-cpu-worker/);}
  finally{Object.assign(globalThis,original);}
});
