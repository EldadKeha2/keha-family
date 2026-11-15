import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const previews=await readFile(new URL('../public/assets/video-previews.js',import.meta.url),'utf8');
const thumbnails=await readFile(new URL('../public/assets/photo-thumbnails.js',import.meta.url),'utf8');

function fixture({slow=false,observer=true}={}){
  const videos=[],timers=new Map(),listeners=new Map();let observeCallback,observerInstance,id=0;
  class IntersectionObserver{
    constructor(callback){observeCallback=callback;this.observed=new Set();observerInstance=this;}
    observe(video){this.observed.add(video);}
    unobserve(video){this.observed.delete(video);}
  }
  const document={hidden:false,querySelectorAll:()=>videos.filter(video=>video.dataset.previewSrc),addEventListener:(type,fn)=>listeners.set(type,fn)};
  const window={navigator:{connection:{effectiveType:slow?'2g':'4g'}}};
  vm.runInNewContext(previews,{window,document,IntersectionObserver:observer?IntersectionObserver:undefined,setTimeout:fn=>{timers.set(++id,fn);return id;},clearTimeout:id=>timers.delete(id)});
  function video(src,{stackHidden=false}={}){
    const handlers=new Map(),node={isConnected:true,dataset:{previewSrc:src},loads:0,stackHidden,
      closest(selector){return selector==='video'||selector==='video[data-preview-src]'&&this.dataset.previewSrc?this:selector==='[data-nostalgia-folder]'?{style:{getPropertyValue:()=>this.stackHidden?'0':'1'}}:null;},
      addEventListener:(type,fn)=>handlers.set(type,fn),removeEventListener:type=>handlers.delete(type),
      matches:selector=>selector==='video[data-preview-src]'&&Boolean(node.dataset.previewSrc),querySelectorAll:()=>[],setAttribute(key,value){this[key]=value;},
      removeAttribute(key){delete this[key];},load(){this.loads++;},finish(){handlers.get('loadeddata')?.({type:'loadeddata'});},fail(){handlers.get('error')?.({type:'error'});this.hidden=true;}
    };videos.push(node);return node;
  }
  return{window,document,video,timers,isObserved:video=>observerInstance?.observed.has(video),watch:()=>window.FamilyVideoPreviews.watch(),intersect:(nodes,value=true)=>observeCallback(nodes.map(target=>({target,isIntersecting:value}))),visible:()=>listeners.get('visibilitychange')(),gesture:video=>listeners.get('pointerdown')({target:video}),error:target=>listeners.get('error')({target})};
}

test('video covers do not download offscreen metadata and visible requests have bounded concurrency',()=>{
  const f=fixture(),videos=Array.from({length:30},(_,i)=>f.video('/film/'+i));f.watch();
  assert.equal(videos.reduce((sum,v)=>sum+v.loads,0),0);
  f.intersect(videos.slice(0,8));
  assert.equal(videos.reduce((sum,v)=>sum+v.loads,0),3);
  assert.equal(videos[3].src,undefined);
  videos[0].finish();assert.equal(videos[3].src,'/film/3');assert.equal(videos[3].preload,'metadata');
  f.intersect(videos.slice(4,8),false);videos[1].finish();videos[2].finish();videos[3].finish();
  assert.equal(videos[4].src,undefined,'Scrolling away removes waiting downloads');
  f.watch();f.intersect(videos.slice(0,4));assert.equal(videos[0].loads,1,'Loaded covers are not requested again');
});

test('weak connections serialize covers and inactive folder covers wait until visible in their stack',()=>{
  const f=fixture({slow:true}),first=f.video('/first'),next=f.video('/next'),hidden=f.video('/hidden',{stackHidden:true});f.watch();f.intersect([first,next,hidden]);
  assert.equal(first.loads,1);assert.equal(next.loads,0);assert.equal(hidden.loads,0);
  first.finish();assert.equal(next.loads,1);next.finish();assert.equal(hidden.loads,0);
  hidden.stackHidden=false;f.watch();f.intersect([hidden]);assert.equal(hidden.loads,1,'Changing the stack activates a newly visible cover');
});

test('preview errors, removals and stalled loads release waiting covers',()=>{
  const f=fixture({slow:true}),first=f.video('/first'),next=f.video('/next'),third=f.video('/third');f.watch();f.intersect([first,next,third]);
  first.isConnected=false;f.watch();assert.equal(next.loads,1);assert.equal(f.timers.size,1);assert.equal(first.src,undefined,'Removed covers abort the underlying media request');
  [...f.timers.values()][0]();assert.equal(third.loads,1,'A stalled decorative cover does not block the rest indefinitely');
  assert.equal(next.src,undefined,'A timed out cover releases its network request before the next starts');assert.equal(next.dataset.previewSrc,'/next','Interrupted covers keep a retry URL');
});

test('timed out covers re-arm viewport observation and recover on re-entry without repeated visible retries',()=>{
  const f=fixture({slow:true}),video=f.video('/film');f.watch();f.intersect([video]);
  [...f.timers.values()][0]();assert.equal(video.src,undefined);assert.equal(video.dataset.previewSrc,'/film');assert.equal(f.isObserved(video),true);
  const loads=video.loads;for(let i=0;i<5;i++){f.intersect([video]);f.watch();}assert.equal(video.loads,loads,'Immediate observer callbacks and unrelated renders must not loop failed requests');
  f.intersect([video],false);f.intersect([video]);assert.equal(video.src,'/film');assert.equal(video.loads,loads+1);video.finish();assert.equal(f.timers.size,0);
});

test('failed covers retain their retry URL and become visible again after a successful re-entry',()=>{
  const f=fixture(),video=f.video('/film');f.watch();f.intersect([video]);video.fail();
  assert.equal(video.dataset.previewSrc,'/film');assert.equal(f.isObserved(video),true);assert.equal(video.hidden,true);
  const loads=video.loads;f.intersect([video]);assert.equal(video.loads,loads);
  f.intersect([video],false);f.intersect([video]);video.finish();assert.equal(video.hidden,false);assert.equal(video.src,'/film');assert.equal(f.timers.size,0);
});

test('browsers without IntersectionObserver keep cover loading available',()=>{
  const f=fixture({observer:false,slow:true}),first=f.video('/first'),next=f.video('/next');f.watch();assert.equal(first.loads,1);assert.equal(next.loads,0);first.finish();assert.equal(next.loads,1);
});

test('touching native video controls bypasses background preview queue immediately without resetting a loaded player',()=>{
  const f=fixture({slow:true}),first=f.video('/first'),next=f.video('/next');f.watch();f.intersect([first,next]);
  assert.equal(next.loads,0);f.gesture(next);assert.equal(next.src,'/next');assert.equal(next.loads,1);
  f.gesture(next);assert.equal(next.loads,1,'Native play controls must not reload the current video');
});

test('a visitor-controlled player is never reset by the decorative preview deadline',()=>{
  const f=fixture({slow:true}),first=f.video('/first'),next=f.video('/next');f.watch();f.intersect([first,next]);
  f.gesture(first);[...f.timers.values()][0]();assert.equal(first.src,'/first');assert.equal(first.loads,1);assert.equal(next.loads,0,'The active request remains counted until an actual media event');
  first.finish();assert.equal(next.loads,1);
});

test('hidden documents postpone decorative requests until returning to the page',()=>{
  const f=fixture(),video=f.video('/film');f.document.hidden=true;f.watch();f.intersect([video]);assert.equal(video.loads,0);
  f.document.hidden=false;f.visible();f.intersect([video]);assert.equal(video.loads,1);
});

test('failed prepared poster images fall back to the original first-frame cover through the lazy queue',()=>{
  const f=fixture(),video=f.video('/temporary');f.document.createElement=()=>video;let replacement;
  const image={isConnected:true,dataset:{videoPosterSrc:'/original#t=0.1'},replaceWith:node=>{replacement=node;}};
  f.error(image);assert.equal(replacement,video);assert.equal(video.dataset.previewSrc,'/original#t=0.1');assert.equal(video.src,undefined);assert.equal(f.isObserved(video),true);
  f.intersect([video]);assert.equal(video.src,'/original#t=0.1');
});

test('an adaptive player fallback is not canceled by the failed decorative request listener',()=>{
  const f=fixture(),video=f.video('/derived');f.watch();f.intersect([video]);video.src='/original';video.fail();
  assert.equal(video.src,'/original');assert.equal(video.dataset.previewSrc,undefined);assert.equal(f.timers.size,0);
});

test('optional photo-copy uploads wait for weak connections to improve',async()=>{
  const requests=[],connectionListeners=new Map(),navigator={connection:{saveData:true,addEventListener:(type,fn)=>connectionListeners.set(type,fn)}},window={FamilyApp:{apiEnabled:true},FamilyI18n:{fetch:async path=>{requests.push(path);return Response.json({item:{}});}},dispatchEvent(){}};
  const document={hidden:false,querySelectorAll:()=>[],addEventListener(){},createElement:()=>({getContext:()=>({drawImage(){}}),toBlob:fn=>fn(new Blob(['copy'],{type:'image/webp'}))})};
  vm.runInNewContext(thumbnails,{window,document,navigator,Blob,CustomEvent,setTimeout,createImageBitmap:async()=>({width:3000,height:2000,close(){}})});
  window.FamilyPhotoThumbnails.fromUpload({item:{id:'photo',kind:'photo',src:'/photo',size:3000000}},{type:'image/jpeg'});
  await new Promise(resolve=>setImmediate(resolve));assert.equal(requests.length,0);
  navigator.connection.saveData=false;connectionListeners.get('change')();await new Promise(resolve=>setImmediate(resolve));assert.equal(requests.length,2);
});

test('thumbnail mutation handling scans added subtrees without rescanning all sibling photos',()=>{
  let callback;const listeners=new Map(),scanned=[],window={FamilyApp:{apiEnabled:true}},document={body:{},querySelectorAll:()=>[],addEventListener:(name,fn)=>listeners.set(name,fn)};
  class MutationObserver{constructor(fn){callback=fn;}observe(){}}
  vm.runInNewContext(thumbnails,{window,document,MutationObserver,setTimeout});listeners.get('DOMContentLoaded')();
  const parent={querySelectorAll(){assert.fail('Adding a card must not scan every existing sibling');}},added={nodeType:1,parentElement:parent,querySelectorAll:()=>{scanned.push('card');return[];}};
  callback([{addedNodes:[added]}]);assert.deepEqual(scanned,['card']);
});
