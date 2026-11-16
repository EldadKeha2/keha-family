import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../public/assets/photo-native.js',import.meta.url),'utf8');

function fixture({supported=true,width=800,keep=false}={}){
 class Node{
  constructor(){this.nodeType=1;this.children=[];this.handlers=new Map();this.clientWidth=width;this.scrollLeft=0;this.className='';this.parent=null;this.style={};const classes=new Set();this.classList={add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x)};}
  get parentNode(){return this.parent;}
  setAttribute(name,value){this[name]=value;}
  addEventListener(type,handler){const previous=this.handlers.get(type);this.handlers.set(type,event=>{previous?.(event);handler(event);});}
  append(...nodes){for(const node of nodes){node.remove();node.parent=this;this.children.push(node);}}
  before(node){const parent=this.parent,index=parent.children.indexOf(this);node.remove();node.parent=parent;parent.children.splice(index,0,node);}
  remove(){if(this.parent){this.parent.children=this.parent.children.filter(x=>x!==this);this.parent=null;}}
  contains(node){return node===this||this.children.some(child=>child.contains(node));}
  setPointerCapture(id){this.captured=id;}
  releasePointerCapture(){this.captured=null;}
  closest(){return null;}
  querySelector(selector){if(selector==='.face-photo-scroll')return this.children.flatMap(n=>[n,...n.children.flatMap(c=>[c,...c.children])]).find(n=>n.className==='face-photo-scroll')||null;return null;}
 }
 const events=new Map(),stage=new Node(),scroll=new Node(),window={addEventListener(){}},document={createElement:()=>new Node(),addEventListener:(type,handler)=>{const previous=events.get(type);events.set(type,event=>{previous?.(event);handler(event);});}},calls=[];scroll.className='face-photo-scroll';stage.append(scroll);let enabled=true;
 const context=vm.createContext({window,document,navigator:{userAgent:'Windows NT'},CSS:{supports:()=>supported},getComputedStyle:()=>({backgroundColor:'rgb(237, 229, 212)'}),Date,setTimeout,clearTimeout});vm.runInContext(source,context);
 const options={previous:{kind:'photo',previewSrc:'/prev-small'},next:{kind:'photo',previewSrc:'/next-small'},enabled:()=>enabled,step(direction,opts){calls.push({direction,native:opts.native});if(!keep)window.FamilyPhotoNative.reset(stage);}};
 const f={window,api:window.FamilyPhotoNative,events,stage,scroll,calls,options,disable(){enabled=false;}};
 f.fire=(type,values={})=>{
  const event={target:scroll,cancelable:true,preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.stopped=true;},stopImmediatePropagation(){this.stopped=true;},...values};
  events.get(type)?.(event);
  const path=[];for(let node=event.target;node;node=node.parentNode)path.push(node);
  for(const node of path.reverse()){if(event.stopped)break;node.handlers?.get(type)?.(event);}
  return event;
 };
 return f;
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const pointer=(f,type,x=200,y=100,id=7,target=f.scroll)=>f.fire(type,{pointerType:'touch',pointerId:id,isPrimary:true,clientX:x,clientY:y,target});
const touch=(f,type,x=200,y=100,id=9)=>{const point={identifier:id,clientX:x,clientY:y,target:f.scroll};return f.fire(type,{touches:type==='touchend'||type==='touchcancel'?[]:[point],changedTouches:[point]});};
const wheel=(f,dx,extra={})=>f.fire('wheel',{deltaX:dx,deltaY:0,...extra});
const stroke=(f,dx,dy=0)=>{pointer(f,'pointerdown');pointer(f,'pointermove',200+dx,100+dy);return pointer(f,'pointerup',200+dx,100+dy);};
const directions=f=>f.calls.map(call=>call.direction);

test('the controlled strip keeps fixed Next-left panes and the actual face scroller in the center',()=>{
 const f=fixture();f.api.mount(f.stage,f.options);const strip=f.stage.children[0];
 assert.equal(strip.children[0].children[0].src,'/next-small');assert.equal(strip.children[2].children[0].src,'/prev-small');assert.equal(strip.children[1].children[0],f.scroll);assert.equal(strip.scrollLeft,800);f.api.reset();assert.equal(f.scroll.parent,f.stage);
});

test('unsupported browsers and disabled editing unwrap the actual face scroller safely',()=>{
 const old=fixture({supported:false});assert.equal(old.api.mount(old.stage,old.options),false);assert.equal(old.stage.children[0],old.scroll);
 const f=fixture();f.api.mount(f.stage,f.options);f.disable();assert.equal(f.api.mount(f.stage,f.options),false);assert.equal(f.stage.children[0],f.scroll);
});

test('physical right and left touch moves the actual pixels with the finger and commits once on release',async()=>{
 for(const direction of [-1,1]){
  const f=fixture();f.api.mount(f.stage,f.options);const strip=f.stage.children[0];
  pointer(f,'pointerdown');pointer(f,'pointermove',200+direction*140);assert.equal(strip.scrollLeft,800-direction*140);assert.deepEqual(f.calls,[]);
  pointer(f,'pointerup',200+direction*140);await flush();assert.deepEqual(f.calls,[{direction,native:true}]);assert.equal(f.api.whenIdle(f.stage),null);
 }
});

test('moving back under the threshold cancels an earlier horizontal drag',async()=>{
 const f=fixture();f.api.mount(f.stage,f.options);const strip=f.stage.children[0];
 pointer(f,'pointerdown');pointer(f,'pointermove',340);pointer(f,'pointermove',205);pointer(f,'pointerup',205);await flush();assert.deepEqual(f.calls,[]);assert.equal(strip.scrollLeft,800);assert.equal(f.api.whenIdle(f.stage),null);f.api.reset();
});

test('vertical and multiple-contact touch gestures cannot navigate the gallery',async()=>{
 const f=fixture();f.api.mount(f.stage,f.options);const strip=f.stage.children[0];
 stroke(f,20,150);pointer(f,'pointerdown');f.fire('touchstart',{touches:[{identifier:9,clientX:200,clientY:100},{identifier:10,clientX:250,clientY:100}]});pointer(f,'pointerup',340);await flush();assert.deepEqual(f.calls,[]);assert.equal(strip.scrollLeft,800);assert.equal(f.api.whenIdle(f.stage),null);f.api.reset();
});

test('compatibility touch events join the pointer stream without resetting its origin or counting twice',async()=>{
 const f=fixture({keep:true});f.api.mount(f.stage,f.options);const strip=f.stage.children[0];
 pointer(f,'pointerdown');pointer(f,'pointermove',250);touch(f,'touchstart',250);pointer(f,'pointermove',340);assert.equal(strip.scrollLeft,660);pointer(f,'pointerup',340);touch(f,'touchend',340);await flush();assert.deepEqual(directions(f),[1]);assert.equal(f.api.whenIdle(f.stage),null);f.api.reset();
});

test('TouchEvent-only fallback follows actual positions and commits on touchend',async()=>{
 const f=fixture();f.api.mount(f.stage,f.options);const strip=f.stage.children[0];
 touch(f,'touchstart');touch(f,'touchmove',340);assert.equal(strip.scrollLeft,660);touch(f,'touchend',340);await flush();assert.deepEqual(directions(f),[1]);assert.equal(f.api.whenIdle(f.stage),null);
});

test('native non-enumerable Touch identifiers remain attached to their fallback contact',async()=>{
 const f=fixture();f.api.mount(f.stage,f.options);const point=x=>{const value={clientX:x,clientY:100,target:f.scroll};Object.defineProperty(value,'identifier',{value:9});return value;};
 f.fire('touchstart',{touches:[point(200)]});f.fire('touchmove',{touches:[point(340)]});assert.equal(f.stage.children[0].scrollLeft,660);f.fire('touchend',{touches:[],changedTouches:[point(340)]});await flush();assert.deepEqual(directions(f),[1]);assert.equal(f.api.whenIdle(f.stage),null);
});

test('cancellation releases ownership and cannot turn unowned browser scrolling into a navigation',async()=>{
 const f=fixture();f.api.mount(f.stage,f.options);const strip=f.stage.children[0];
 pointer(f,'pointerdown');pointer(f,'pointermove',208);pointer(f,'pointercancel',208);strip.scrollLeft=0;strip.handlers.get('scroll')?.({});strip.handlers.get('scrollend')?.({});await flush();assert.deepEqual(f.calls,[]);assert.equal(f.api.whenIdle(f.stage),null);f.api.reset();
});

test('a cancelled already-claimed horizontal stroke completes once from its last controlled position',async()=>{
 for(const direction of [-1,1]){
  const f=fixture({keep:true});f.api.mount(f.stage,f.options);pointer(f,'pointerdown');pointer(f,'pointermove',200+direction*140);pointer(f,'pointercancel',0,0);pointer(f,'pointerup',200+direction*140);await flush();assert.deepEqual(directions(f),[direction]);assert.equal(f.api.whenIdle(f.stage),null);f.api.reset();
 }
});

test('a completed horizontal swipe suppresses its accidental face or playback click',async()=>{
 const f=fixture({keep:true});f.api.mount(f.stage,f.options);stroke(f,140);const event=f.fire('click');await flush();assert.equal(event.defaultPrevented,true);assert.equal(event.stopped,true);assert.deepEqual(directions(f),[1]);f.api.reset();
});

test('rapid complete touch gestures each remain available while earlier media preparation is pending',async()=>{
 const f=fixture({keep:true}),finishes=[];f.options.step=(direction,options)=>{f.calls.push({direction,native:options.native});return new Promise(resolve=>finishes.push(resolve));};f.api.mount(f.stage,f.options);
 for(const direction of [1,1,-1])stroke(f,direction*140);assert.deepEqual(directions(f),[1,1,-1]);assert.equal(f.api.whenIdle(f.stage),null);for(const finish of finishes)finish();await flush();f.api.reset();
});

test('preview covers hide old letterbox pixels once ready while retaining the old photo during loading',()=>{
 for(const ready of [false,true]){
  const f=fixture({keep:true});f.options.step=()=>new Promise(()=>{});f.api.mount(f.stage,f.options);const strip=f.stage.children[0],neighbor=strip.children[0].children[0];
  if(ready)Object.assign(neighbor,{tagName:'IMG',complete:true,naturalWidth:200,naturalHeight:400});
  stroke(f,140);const cover=strip.children[1].children.find(node=>node.className==='native-pending-cover'),image=cover.children[0];
  assert.equal(strip.children[1].children.includes(f.scroll),true,'The decoded current photo stays behind an unready preview');
  if(ready)assert.equal(image,neighbor,'A ready neighbour keeps its already-painted image node');
  else {assert.equal(image.style.opacity,'0');assert.equal(cover.style.backgroundColor,undefined);image.naturalWidth=200;image.handlers.get('load')({});}
  assert.equal(image.style.opacity,'1');assert.equal(cover.style.backgroundColor,'rgb(237, 229, 212)','Ready preview letterboxing must conceal the previous image');f.api.reset();
 }
});

test('horizontal trackpad input moves physical pixels, prevents browser default and commits after 80ms quiet',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 for(const direction of [-1,1]){
  const f=fixture();f.api.mount(f.stage,f.options);const strip=f.stage.children[0];const event=wheel(f,direction*120);assert.equal(event.defaultPrevented,true);assert.equal(strip.scrollLeft,800-direction*120);t.mock.timers.tick(79);assert.deepEqual(f.calls,[]);t.mock.timers.tick(1);await flush();assert.deepEqual(directions(f),[direction]);assert.equal(f.api.whenIdle(f.stage),null);
 }
});

test('fractional trackpad input is valid without a pixel threshold or a browser scrollend',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const f=fixture();f.api.mount(f.stage,f.options);wheel(f,.75);const wait=f.api.whenIdle(f.stage);assert.ok(wait);t.mock.timers.tick(80);await wait;await flush();assert.deepEqual(directions(f),[1]);assert.equal(f.api.whenIdle(f.stage),null);
});

test('moderately diagonal horizontal input starts ownership and later diagonal tails stay owned',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const f=fixture();f.api.mount(f.stage,f.options);const strip=f.stage.children[0];assert.equal(wheel(f,90,{deltaY:100}).defaultPrevented,true);assert.equal(wheel(f,5,{deltaY:30}).defaultPrevented,true);assert.equal(strip.scrollLeft,705);t.mock.timers.tick(80);await flush();assert.deepEqual(directions(f),[1]);
});

test('separate quiet wheel bursts each commit without any browser completion event',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const f=fixture({keep:true});f.api.mount(f.stage,f.options);
 for(const dx of [120,120,-120]){wheel(f,dx);t.mock.timers.tick(80);}await flush();assert.deepEqual(directions(f),[1,1,-1]);assert.equal(f.api.whenIdle(f.stage),null);f.api.reset();
});

test('wheel reversal reserves the new input before the previous action can render a cached target',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const f=fixture({keep:true}),waits=[];f.options.step=(direction,options)=>{f.calls.push({direction,native:options.native});const wait=f.api.whenIdle(f.stage);if(wait)waits.push(wait);return wait;};f.api.mount(f.stage,f.options);
 wheel(f,120);wheel(f,-140);assert.deepEqual(directions(f),[1]);assert.equal(waits.length,1);t.mock.timers.tick(80);await Promise.all(waits);await flush();assert.deepEqual(directions(f),[1,-1]);assert.equal(f.api.whenIdle(f.stage),null);f.api.reset();
});

test('late compatibility touchcancel cannot cancel a new wheel episode after pointer release',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const f=fixture({keep:true});f.api.mount(f.stage,f.options);pointer(f,'pointerdown');touch(f,'touchstart');pointer(f,'pointermove',340);pointer(f,'pointerup',340);wheel(f,120);const wait=f.api.whenIdle(f.stage);
 f.fire('touchcancel',{touches:[],changedTouches:[{identifier:9,clientX:340,clientY:100}]});assert.equal(f.stage.children[0].scrollLeft,680);assert.equal(f.api.isActive(f.stage),true);t.mock.timers.tick(80);await wait;await flush();assert.deepEqual(directions(f),[1,1]);assert.equal(f.api.whenIdle(f.stage),null);f.api.reset();
});

test('playback controls, vertical wheel and pinch keep their browser actions',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const f=fixture();f.api.mount(f.stage,f.options);const video={parentNode:f.scroll,getBoundingClientRect:()=>({bottom:500}),closest:selector=>selector==='video'?video:null};
 pointer(f,'pointerdown',200,480,7,video);pointer(f,'pointermove',350,480,7,video);pointer(f,'pointerup',350,480,7,video);assert.equal(wheel(f,140,{target:video,clientY:480}).defaultPrevented,undefined);assert.equal(wheel(f,0,{deltaY:140}).defaultPrevented,undefined);assert.equal(wheel(f,140,{ctrlKey:true}).defaultPrevented,undefined);t.mock.timers.tick(100);await flush();assert.deepEqual(f.calls,[]);assert.equal(f.api.whenIdle(f.stage),null);f.api.reset();
});

test('trackpad mapping applies only to owned horizontal input and never changes actual screen-touch direction',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const f=fixture({keep:true}),mapped=[];f.window.FamilyGalleryInput={wheelDelta:dx=>{mapped.push(dx);return -dx;}};f.api.mount(f.stage,f.options);const strip=f.stage.children[0];
 wheel(f,0,{deltaY:140});wheel(f,120,{ctrlKey:true});assert.deepEqual(mapped,[]);wheel(f,120,{deltaMode:1});assert.deepEqual(mapped,[1920]);assert.equal(strip.scrollLeft,1600);t.mock.timers.tick(80);await flush();assert.deepEqual(directions(f),[-1]);stroke(f,140);await flush();assert.deepEqual(directions(f),[-1,1]);assert.deepEqual(mapped,[1920]);f.api.reset();
});

test('zero-width startup waits for geometry and unowned scrollend never selects a photograph',()=>{
 const f=fixture({width:0});f.api.mount(f.stage,f.options);const strip=f.stage.children[0];assert.equal(strip.style.visibility,'hidden');strip.handlers.get('scrollend')?.({});assert.deepEqual(f.calls,[]);strip.clientWidth=800;f.api.mount(f.stage,f.options);assert.equal(strip.scrollLeft,800);assert.equal(strip.style.visibility,'');strip.scrollLeft=0;strip.handlers.get('scrollend')?.({});assert.deepEqual(f.calls,[]);f.api.reset();
});

test('reset resolves pending input waiters and cannot steal an image reparented by a newer face context',async()=>{
 const f=fixture();f.api.mount(f.stage,f.options);pointer(f,'pointerdown');const wait=f.api.whenIdle(f.stage);const newer=f.stage.children[0].children[2];newer.append(f.scroll);f.api.reset();await wait;assert.equal(f.scroll.parent,newer);assert.equal(f.api.whenIdle(f.stage),null);
});
