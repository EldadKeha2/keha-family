import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

// The DOM fixture does not lay out CSS transforms. Positive translate3d x
// moves actual pixels right while the scroll origin remains fixed.
const paintedPosition=viewport=>viewport.scrollLeft-(Number(viewport.children[1]?.style.transform?.match(/translate3d\(([-.\d]+)px/)?.[1])||0);

const source=await readFile(new URL('../public/assets/photo-native.js',import.meta.url),'utf8');

function fixture({supported=true,width=800,keep=false}={}){
 class Node{
  constructor(){this.nodeType=1;this.tagName='DIV';this.children=[];this.handlers=new Map();this.clientWidth=width;this.scrollLeft=0;this.className='';this.parent=null;this.style={};const classes=new Set();this.classList={add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x)||this.className.split(/\s+/).includes(x)};}
  get parentNode(){return this.parent;}
  get parentElement(){return this.parent;}
  setAttribute(name,value){this[name]=value;}
  getAttribute(name){return Object.hasOwn(this,name)?this[name]:null;}
  hasAttribute(name){return this.getAttribute(name)!==null;}
  addEventListener(type,handler){const previous=this.handlers.get(type);this.handlers.set(type,event=>{previous?.(event);handler(event);});}
  append(...nodes){for(const node of nodes){node.remove();node.parent=this;this.children.push(node);}}
  before(node){const parent=this.parent,index=parent.children.indexOf(this);node.remove();node.parent=parent;parent.children.splice(index,0,node);}
  remove(){if(this.parent){this.parent.children=this.parent.children.filter(x=>x!==this);this.parent=null;}}
  contains(node){return node===this||this.children.some(child=>child.contains(node));}
  setPointerCapture(id){this.captured=id;}
  releasePointerCapture(){this.captured=null;}
  matches(selector){return selector.split(',').some(part=>{part=part.trim();const not=part.match(/^(.+):not\((.+)\)$/);if(not)return this.matches(not[1])&&!this.matches(not[2]);if(part.startsWith('.'))return this.classList.contains(part.slice(1));const attr=part.match(/^\[([^=\]]+)(?:=["']?([^"'\]]+)["']?)?\]$/);if(attr)return attr[2]===undefined?this.hasAttribute(attr[1]):this.getAttribute(attr[1])===attr[2];return this.tagName.toLowerCase()===part.toLowerCase();});}
  closest(selector){for(let node=this;node;node=node.parentNode)if(node.matches?.(selector))return node;return null;}
  querySelector(selector){if(selector==='.face-photo-scroll')return this.children.flatMap(n=>[n,...n.children.flatMap(c=>[c,...c.children])]).find(n=>n.className==='face-photo-scroll')||null;return null;}
 }
 const events=new Map(),stage=new Node(),scroll=new Node(),window={addEventListener(){}},document={createElement:tag=>{const node=new Node();node.tagName=tag.toUpperCase();return node;},addEventListener:(type,handler)=>{const previous=events.get(type);events.set(type,event=>{previous?.(event);handler(event);});}},calls=[];scroll.className='face-photo-scroll';stage.append(scroll);let enabled=true;
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
 assert.equal(strip.children[0].children[0].src,'/next-small');assert.equal(strip.children[2].children[0].src,'/prev-small');assert.equal(strip.children[1].children[0],f.scroll);assert.equal(paintedPosition(strip),800);f.api.reset();assert.equal(f.scroll.parent,f.stage);
});

test('unsupported browsers and disabled editing unwrap the actual face scroller safely',()=>{
 const old=fixture({supported:false});assert.equal(old.api.mount(old.stage,old.options),false);assert.equal(old.stage.children[0],old.scroll);
 const f=fixture();f.api.mount(f.stage,f.options);f.disable();assert.equal(f.api.mount(f.stage,f.options),false);assert.equal(f.stage.children[0],f.scroll);
});

test('physical right and left touch moves the actual pixels with the finger and commits once on release',async()=>{
 for(const direction of [-1,1]){
  const f=fixture();f.api.mount(f.stage,f.options);const strip=f.stage.children[0];
  pointer(f,'pointerdown');pointer(f,'pointermove',200+direction*140);assert.equal(paintedPosition(strip),800-direction*140);assert.deepEqual(f.calls,[]);
  pointer(f,'pointerup',200+direction*140);await flush();assert.deepEqual(f.calls,[{direction,native:true}]);assert.equal(f.api.whenIdle(f.stage),null);
 }
});

test('pad animation moves in physical CSS coordinates while the calibrated Next or Previous action stays unchanged',async t=>{
 t.mock.timers.enable({apis:['setTimeout','Date']});
 for(const [raw,factor,expected]of [[120,1,1],[-120,-1,1],[-120,1,-1]]){
  const f=fixture({keep:true});f.window.FamilyGalleryInput={wheelDelta:dx=>dx*factor};f.api.mount(f.stage,f.options);const strip=f.stage.children[0],origin=strip.scrollLeft;
  Object.defineProperty(strip,'scrollLeft',{get:()=>origin,set:value=>assert.equal(value,origin,'Animation must not change browser scroll coordinates')});
  wheel(f,raw);assert.equal(strip.style.direction,'ltr');assert.equal(strip.style.flexDirection,'row');
  for(const pane of strip.children)assert.equal(pane.style.transform,'translate3d('+(expected*120)+'px,0,0)','The viewed photograph and both neighbours move in the same physical screen direction');
  assert.equal(strip.children[0]._item,f.options.next,'The Next photograph keeps its identity and position');
  t.mock.timers.tick(80);await flush();assert.deepEqual(directions(f),[expected]);assert.equal(strip.children[1].style.transform,'translate3d(0px,0,0)');f.api.reset();
 }
});

test('moving back under the threshold cancels an earlier horizontal drag',async()=>{
 const f=fixture();f.api.mount(f.stage,f.options);const strip=f.stage.children[0];
 pointer(f,'pointerdown');pointer(f,'pointermove',340);pointer(f,'pointermove',205);pointer(f,'pointerup',205);await flush();assert.deepEqual(f.calls,[]);assert.equal(paintedPosition(strip),800);assert.equal(f.api.whenIdle(f.stage),null);f.api.reset();
});

test('vertical and unsupported three-contact touch gestures cannot navigate the gallery',async()=>{
 const f=fixture();f.api.mount(f.stage,f.options);const strip=f.stage.children[0];
 stroke(f,20,150);pointer(f,'pointerdown');f.fire('touchstart',{touches:[{identifier:9,clientX:200,clientY:100},{identifier:10,clientX:250,clientY:100},{identifier:11,clientX:300,clientY:100}]});pointer(f,'pointerup',340);await flush();assert.deepEqual(f.calls,[]);assert.equal(paintedPosition(strip),800);assert.equal(f.api.whenIdle(f.stage),null);f.api.reset();
});

test('compatibility touch events join the pointer stream without resetting its origin or counting twice',async()=>{
 const f=fixture({keep:true});f.api.mount(f.stage,f.options);const strip=f.stage.children[0];
 pointer(f,'pointerdown');pointer(f,'pointermove',250);touch(f,'touchstart',250);pointer(f,'pointermove',340);assert.equal(paintedPosition(strip),660);pointer(f,'pointerup',340);touch(f,'touchend',340);await flush();assert.deepEqual(directions(f),[1]);assert.equal(f.api.whenIdle(f.stage),null);f.api.reset();
});

test('TouchEvent-only fallback follows actual positions and commits on touchend',async()=>{
 const f=fixture();f.api.mount(f.stage,f.options);const strip=f.stage.children[0];
 touch(f,'touchstart');touch(f,'touchmove',340);assert.equal(paintedPosition(strip),660);touch(f,'touchend',340);await flush();assert.deepEqual(directions(f),[1]);assert.equal(f.api.whenIdle(f.stage),null);
});

test('native non-enumerable Touch identifiers remain attached to their fallback contact',async()=>{
 const f=fixture();f.api.mount(f.stage,f.options);const point=x=>{const value={clientX:x,clientY:100,target:f.scroll};Object.defineProperty(value,'identifier',{value:9});return value;};
 f.fire('touchstart',{touches:[point(200)]});f.fire('touchmove',{touches:[point(340)]});assert.equal(paintedPosition(f.stage.children[0]),660);f.fire('touchend',{touches:[],changedTouches:[point(340)]});await flush();assert.deepEqual(directions(f),[1]);assert.equal(f.api.whenIdle(f.stage),null);
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
  const f=fixture();f.api.mount(f.stage,f.options);const strip=f.stage.children[0];const event=wheel(f,direction*120);assert.equal(event.defaultPrevented,true);assert.equal(paintedPosition(strip),800-direction*120);t.mock.timers.tick(79);assert.deepEqual(f.calls,[]);t.mock.timers.tick(1);await flush();assert.deepEqual(directions(f),[direction]);assert.equal(f.api.whenIdle(f.stage),null);
 }
});

test('fractional trackpad input is valid without a pixel threshold or a browser scrollend',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const f=fixture();f.api.mount(f.stage,f.options);wheel(f,.75);const wait=f.api.whenIdle(f.stage);assert.ok(wait);t.mock.timers.tick(80);await wait;await flush();assert.deepEqual(directions(f),[1]);assert.equal(f.api.whenIdle(f.stage),null);
});

test('moderately diagonal horizontal input starts ownership and later diagonal tails stay owned',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const f=fixture();f.api.mount(f.stage,f.options);const strip=f.stage.children[0];assert.equal(wheel(f,90,{deltaY:100}).defaultPrevented,true);assert.equal(wheel(f,5,{deltaY:30}).defaultPrevented,true);assert.equal(paintedPosition(strip),705);t.mock.timers.tick(80);await flush();assert.deepEqual(directions(f),[1]);
});

test('separate quiet wheel bursts each commit without any browser completion event',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const f=fixture({keep:true});f.api.mount(f.stage,f.options);
 for(const dx of [120,120,-120]){wheel(f,dx);t.mock.timers.tick(80);}await flush();assert.deepEqual(directions(f),[1,1,-1]);assert.equal(f.api.whenIdle(f.stage),null);f.api.reset();
});

test('one pad stroke with sparse decaying momentum cannot advance three photographs across remounts',async t=>{
 t.mock.timers.enable({apis:['setTimeout','Date']});const f=fixture({keep:true});f.api.mount(f.stage,f.options);
 wheel(f,160);wheel(f,80);t.mock.timers.tick(80);await flush();assert.deepEqual(directions(f),[1]);
 for(const tail of [24,8,2]){
  f.api.reset(f.stage);f.api.mount(f.stage,f.options);t.mock.timers.tick(70);const strip=f.stage.children[0],sample=wheel(f,tail);
  assert.equal(sample.defaultPrevented,true);assert.equal(paintedPosition(strip),strip.clientWidth,'A momentum tail cannot drag the next photograph');
  t.mock.timers.tick(80);await flush();assert.deepEqual(directions(f),[1],'Momentum after a quiet gap belongs to the original stroke');
 }
 wheel(f,160);t.mock.timers.tick(80);await flush();assert.deepEqual(directions(f),[1,1],'A renewed deliberate stroke works immediately');f.api.reset();
});

test('small reverse-sign pad tremors neither flip the preview nor create extra navigation',async t=>{
 t.mock.timers.enable({apis:['setTimeout','Date']});const f=fixture({keep:true});f.api.mount(f.stage,f.options);const strip=f.stage.children[0];
 wheel(f,120);const position=paintedPosition(strip);wheel(f,-1);assert.equal(paintedPosition(strip),position);wheel(f,8);t.mock.timers.tick(80);await flush();assert.deepEqual(directions(f),[1]);
 wheel(f,-140);t.mock.timers.tick(80);await flush();assert.deepEqual(directions(f),[1,-1],'A deliberate reversal is a new stroke');f.api.reset();
});

test('a subpixel start in the opposite sign is replaced by the deliberate stroke instead of counting another image',async t=>{
 t.mock.timers.enable({apis:['setTimeout','Date']});const f=fixture({keep:true});f.api.mount(f.stage,f.options);
 wheel(f,.4);wheel(f,-120);assert.equal(paintedPosition(f.stage.children[0]),920);t.mock.timers.tick(80);await flush();assert.deepEqual(directions(f),[-1]);f.api.reset();
});

test('subpixel pad momentum is filtered proportionally while another real fractional stroke stays available',async t=>{
 t.mock.timers.enable({apis:['setTimeout','Date']});const f=fixture({keep:true});f.api.mount(f.stage,f.options);
 wheel(f,.75);wheel(f,.4);t.mock.timers.tick(80);await flush();assert.deepEqual(directions(f),[1]);
 for(const tail of [.1,.03]){t.mock.timers.tick(70);wheel(f,tail);t.mock.timers.tick(80);await flush();assert.deepEqual(directions(f),[1]);}
 wheel(f,.75);t.mock.timers.tick(80);await flush();assert.deepEqual(directions(f),[1,1]);f.api.reset();
});

test('wheel reversal reserves the new input before the previous action can render a cached target',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const f=fixture({keep:true}),waits=[];f.options.step=(direction,options)=>{f.calls.push({direction,native:options.native});const wait=f.api.whenIdle(f.stage);if(wait)waits.push(wait);return wait;};f.api.mount(f.stage,f.options);
 wheel(f,120);wheel(f,-140);assert.deepEqual(directions(f),[1]);assert.equal(waits.length,1);t.mock.timers.tick(80);await Promise.all(waits);await flush();assert.deepEqual(directions(f),[1,-1]);assert.equal(f.api.whenIdle(f.stage),null);f.api.reset();
});

test('late compatibility touchcancel cannot cancel a new wheel episode after pointer release',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const f=fixture({keep:true});f.api.mount(f.stage,f.options);pointer(f,'pointerdown');touch(f,'touchstart');pointer(f,'pointermove',340);pointer(f,'pointerup',340);wheel(f,120);const wait=f.api.whenIdle(f.stage);
 f.fire('touchcancel',{touches:[],changedTouches:[{identifier:9,clientX:340,clientY:100}]});assert.equal(paintedPosition(f.stage.children[0]),680);assert.equal(f.api.isActive(f.stage),true);t.mock.timers.tick(80);await wait;await flush();assert.deepEqual(directions(f),[1,1]);assert.equal(f.api.whenIdle(f.stage),null);f.api.reset();
});

test('playback controls, vertical wheel and pinch keep their browser actions',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const f=fixture(),video=new f.scroll.constructor();video.tagName='VIDEO';video.getBoundingClientRect=()=>({bottom:500});f.scroll.append(video);f.api.mount(f.stage,f.options);
 pointer(f,'pointerdown',200,480,7,video);pointer(f,'pointermove',350,480,7,video);pointer(f,'pointerup',350,480,7,video);assert.equal(wheel(f,140,{target:video,clientY:480}).defaultPrevented,undefined);assert.equal(wheel(f,0,{deltaY:140}).defaultPrevented,undefined);assert.equal(wheel(f,140,{ctrlKey:true}).defaultPrevented,undefined);t.mock.timers.tick(100);await flush();assert.deepEqual(f.calls,[]);assert.equal(f.api.whenIdle(f.stage),null);f.api.reset();
});

test('trackpad mapping applies only to owned horizontal input and never changes actual screen-touch direction',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const f=fixture({keep:true}),mapped=[];f.window.FamilyGalleryInput={wheelDelta:dx=>{mapped.push(dx);return -dx;}};f.api.mount(f.stage,f.options);const strip=f.stage.children[0];
 wheel(f,0,{deltaY:140});wheel(f,120,{ctrlKey:true});assert.deepEqual(mapped,[]);wheel(f,120,{deltaMode:1});assert.deepEqual(mapped,[1920]);assert.equal(paintedPosition(strip),1600);t.mock.timers.tick(80);await flush();assert.deepEqual(directions(f),[-1]);stroke(f,140);await flush();assert.deepEqual(directions(f),[-1,1]);assert.deepEqual(mapped,[1920]);f.api.reset();
});

test('zero-width startup waits for geometry and unowned scrollend never selects a photograph',()=>{
 const f=fixture({width:0});f.api.mount(f.stage,f.options);const strip=f.stage.children[0];assert.equal(strip.style.visibility,'hidden');strip.handlers.get('scrollend')?.({});assert.deepEqual(f.calls,[]);strip.clientWidth=800;f.api.mount(f.stage,f.options);assert.equal(paintedPosition(strip),800);assert.equal(strip.style.visibility,'');strip.scrollLeft=0;strip.handlers.get('scrollend')?.({});assert.deepEqual(f.calls,[]);f.api.reset();
});

test('reset resolves pending input waiters and cannot steal an image reparented by a newer face context',async()=>{
 const f=fixture();f.api.mount(f.stage,f.options);pointer(f,'pointerdown');const wait=f.api.whenIdle(f.stage);const newer=f.stage.children[0].children[2];newer.append(f.scroll);f.api.reset();await wait;assert.equal(f.scroll.parent,newer);assert.equal(f.api.whenIdle(f.stage),null);
});

test('stage background and a sibling face-hit outside the strip receive the same physical swipe controller',async()=>{
 for(const targetKind of ['background','face']){
  const f=fixture();f.api.mount(f.stage,f.options);const strip=f.stage.children[0],target=targetKind==='background'?f.stage:new f.scroll.constructor();
  if(targetKind==='face'){target.className='face-hit';f.stage.append(target);}
  pointer(f,'pointerdown',200,100,7,target);pointer(f,'pointermove',340,100,7,target);assert.equal(paintedPosition(strip),660);pointer(f,'pointerup',340,100,7,target);await flush();assert.deepEqual(directions(f),[1]);assert.equal(f.api.whenIdle(f.stage),null);
 }
});

test('remounting a stage uses one live wheel handler and keeps stage-background input usable',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const f=fixture({keep:true});f.api.mount(f.stage,f.options);f.api.reset(f.stage);f.api.mount(f.stage,f.options);f.api.mount(f.stage,f.options);const strip=f.stage.children[0];
 assert.equal(strip.style.touchAction,'pinch-zoom');const event=wheel(f,120,{target:f.stage});assert.equal(event.defaultPrevented,true);assert.equal(paintedPosition(strip),680,'One physical packet moves once after remount');t.mock.timers.tick(80);await flush();assert.deepEqual(directions(f),[1]);stroke(f,140);await flush();assert.deepEqual(directions(f),[1,1]);f.api.reset();
});

test('a tiny initially vertical sample stays undecided and allows the real horizontal swipe to emerge',async()=>{
 const f=fixture();f.api.mount(f.stage,f.options);const strip=f.stage.children[0];pointer(f,'pointerdown');pointer(f,'pointermove',202,108);assert.equal(paintedPosition(strip),800);pointer(f,'pointermove',340,100);assert.equal(paintedPosition(strip),660);pointer(f,'pointerup',340,100);await flush();assert.deepEqual(directions(f),[1]);
});

test('deliberate vertical movement scrolls by incremental deltas and can yield to a later clear horizontal swipe',async()=>{
 const f=fixture(),vertical=[];f.options.vertical=dy=>vertical.push(dy);f.api.mount(f.stage,f.options);const strip=f.stage.children[0];pointer(f,'pointerdown');pointer(f,'pointermove',200,130);pointer(f,'pointermove',200,160);assert.deepEqual(vertical,[-30,-30]);assert.equal(paintedPosition(strip),800);pointer(f,'pointermove',340,160);assert.equal(paintedPosition(strip),660);pointer(f,'pointerup',340,160);await flush();assert.deepEqual(directions(f),[1]);
});

test('an unclaimed cancelled Windows pointer retains its joined TouchEvent contact for a bounded fallback',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 for(const continuing of [false,true]){
  const f=fixture();f.api.mount(f.stage,f.options);pointer(f,'pointerdown');touch(f,'touchstart');pointer(f,'pointermove',202,108);pointer(f,'pointercancel',0,0);const wait=f.api.whenIdle(f.stage);assert.ok(wait);t.mock.timers.tick(349);assert.equal(f.api.isActive(f.stage),true);
  if(continuing){touch(f,'touchmove',340);assert.equal(paintedPosition(f.stage.children[0]),660);touch(f,'touchend',340);}else t.mock.timers.tick(1);
  await wait;await flush();assert.deepEqual(directions(f),continuing?[1]:[]);assert.equal(f.api.whenIdle(f.stage),null);f.api.reset();
 }
});

test('diagnostics expose the actual mounted controller and current input owner',()=>{
 const f=fixture();assert.equal(f.api.version,12);f.api.mount(f.stage,f.options);const initial=f.api.diagnostics(f.stage);for(const field of ['mounted','enabled','lastDecision','lastEvent','phase','pointer','touch','wheel','width','protectedMatch'])assert.equal(Object.hasOwn(initial,field),true,field);assert.equal(initial.mounted,true);assert.equal(initial.enabled,true);assert.equal(initial.width,800);pointer(f,'pointerdown');const active=f.api.diagnostics(f.stage);assert.equal(active.pointer,true);f.api.reset();assert.equal(f.api.diagnostics(f.stage).mounted,false);
});

test('a tiny fallback TouchMove after pointercancel releases idle without navigation after quiet',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const f=fixture();f.api.mount(f.stage,f.options);pointer(f,'pointerdown');touch(f,'touchstart');pointer(f,'pointermove',202,108);pointer(f,'pointercancel',0,0);touch(f,'touchmove',203,109);const wait=f.api.whenIdle(f.stage);assert.ok(wait);t.mock.timers.tick(349);assert.equal(f.api.isActive(f.stage),true);t.mock.timers.tick(1);await wait;await flush();assert.deepEqual(directions(f),[]);assert.equal(f.api.whenIdle(f.stage),null);f.api.reset();
});

test('a meaningful fallback TouchMove completes once from its last position when touchend is missing',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const f=fixture({keep:true});f.api.mount(f.stage,f.options);pointer(f,'pointerdown');touch(f,'touchstart');pointer(f,'pointermove',202,108);pointer(f,'pointercancel',0,0);touch(f,'touchmove',340);const wait=f.api.whenIdle(f.stage);assert.ok(wait);t.mock.timers.tick(349);assert.deepEqual(directions(f),[]);t.mock.timers.tick(1);await wait;await flush();assert.deepEqual(directions(f),[1]);touch(f,'touchend',340);t.mock.timers.tick(350);assert.deepEqual(directions(f),[1]);assert.equal(f.api.whenIdle(f.stage),null);f.api.reset();
});

test('continued fallback TouchMove samples keep ownership until 350ms after the last sample',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const f=fixture();f.api.mount(f.stage,f.options);pointer(f,'pointerdown');touch(f,'touchstart');pointer(f,'pointermove',202,108);pointer(f,'pointercancel',0,0);
 for(const x of [240,260,280,300,340]){t.mock.timers.tick(100);touch(f,'touchmove',x);assert.deepEqual(directions(f),[]);assert.equal(f.api.isActive(f.stage),true);}
 const wait=f.api.whenIdle(f.stage);t.mock.timers.tick(349);assert.deepEqual(directions(f),[]);t.mock.timers.tick(1);await wait;await flush();assert.deepEqual(directions(f),[1]);assert.equal(f.api.whenIdle(f.stage),null);
});

test('a healthy pointer can remain held for a second without a fallback watchdog completing it',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const f=fixture();f.api.mount(f.stage,f.options);pointer(f,'pointerdown');pointer(f,'pointermove',340);t.mock.timers.tick(1000);assert.deepEqual(directions(f),[]);assert.equal(f.api.isActive(f.stage),true);pointer(f,'pointerup',340);await flush();assert.deepEqual(directions(f),[1]);assert.equal(f.api.whenIdle(f.stage),null);
});

test('attributes on the known photo scroller do not classify ordinary image input as a protected control',async()=>{
 for(const attributes of [{contenteditable:'false'},{role:'textbox'}]){
  const f=fixture();for(const [name,value] of Object.entries(attributes))f.scroll.setAttribute(name,value);f.api.mount(f.stage,f.options);stroke(f,140);await flush();assert.deepEqual(directions(f),[1]);
 }
});

test('control-like ancestors outside the stage cannot block ordinary photo input',async()=>{
 for(const outerType of ['button','a','textbox','false-editable']){
  const f=fixture(),outer=new f.scroll.constructor();if(outerType==='textbox')outer.setAttribute('role','textbox');else if(outerType==='false-editable')outer.setAttribute('contenteditable','false');else outer.tagName=outerType.toUpperCase();outer.append(f.stage);f.api.mount(f.stage,f.options);stroke(f,140);await flush();assert.deepEqual(directions(f),[1],outerType);
 }
});

test('actual controls inside the stage stay protected and diagnostics identify the matched element',async()=>{
 for(const controlType of ['button','a','input','textbox','editable']){
  const f=fixture(),control=new f.scroll.constructor();if(controlType==='textbox')control.setAttribute('role','textbox');else if(controlType==='editable')control.setAttribute('contenteditable','true');else control.tagName=controlType.toUpperCase();f.scroll.append(control);f.api.mount(f.stage,f.options);pointer(f,'pointerdown',200,100,7,control);pointer(f,'pointermove',340,100,7,control);pointer(f,'pointerup',340,100,7,control);await flush();assert.deepEqual(directions(f),[],controlType);assert.equal(f.api.diagnostics(f.stage).lastDecision,'protected-control');assert.ok(f.api.diagnostics(f.stage).protectedMatch,controlType);f.api.reset();
 }
});

const contacts=(f,points)=>points.map(([id,x,y=100])=>({identifier:id,clientX:x,clientY:y,target:f.scroll}));
const group=(f,type,points,changed=points)=>f.fire(type,{touches:contacts(f,points),changedTouches:contacts(f,changed)});

test('parallel two-finger centroid movement follows physical direction and commits once on first lift',async()=>{
 for(const direction of [-1,1]){
  const f=fixture({keep:true});f.api.mount(f.stage,f.options);const strip=f.stage.children[0],first=200+direction*140,second=300+direction*140;
  group(f,'touchstart',[[9,200],[10,300]]);const move=group(f,'touchmove',[[9,first],[10,second]]);assert.equal(paintedPosition(strip),800-direction*140);assert.equal(move.defaultPrevented,true);group(f,'touchend',[[10,second]],[[9,first]]);await flush();assert.deepEqual(directions(f),[direction]);
  group(f,'touchmove',[[10,second+300]]);group(f,'touchend',[],[[10,second+300]]);await flush();assert.deepEqual(directions(f),[direction],'The remaining finger tail cannot become a second swipe');assert.equal(f.api.whenIdle(f.stage),null);stroke(f,140);await flush();assert.deepEqual(directions(f),[direction,1]);f.api.reset();
 }
});

test('secondary pointer events cannot cancel a two-finger TouchEvent gesture or finish it before TouchEnd',async()=>{
 const f=fixture({keep:true});f.api.mount(f.stage,f.options);pointer(f,'pointerdown');touch(f,'touchstart',200,100,9);f.fire('pointerdown',{pointerType:'touch',pointerId:8,isPrimary:false,clientX:300,clientY:100});group(f,'touchstart',[[9,200],[10,300]]);group(f,'touchmove',[[9,340],[10,440]]);assert.equal(paintedPosition(f.stage.children[0]),660);pointer(f,'pointerup',340);await flush();assert.deepEqual(directions(f),[]);assert.equal(f.api.isActive(f.stage),true);group(f,'touchend',[[10,440]],[[9,340]]);await flush();assert.deepEqual(directions(f),[1]);pointer(f,'pointerup',440,100,8);group(f,'touchend',[],[[10,440]]);await flush();assert.deepEqual(directions(f),[1]);assert.equal(f.api.whenIdle(f.stage),null);f.api.reset();
});

test('two-finger pinch and rotation cancel gallery navigation while leaving browser zoom available',async()=>{
 for(const movement of [[[9,180,100],[10,320,100]],[[9,390,50],[10,390,150]]]){
  const f=fixture();f.api.mount(f.stage,f.options);group(f,'touchstart',[[9,200],[10,300]]);const event=group(f,'touchmove',movement);assert.notEqual(event.defaultPrevented,true);group(f,'touchend',[[10,movement[1][1],movement[1][2]]],[[9,movement[0][1],movement[0][2]]]);group(f,'touchend',[],[[10,movement[1][1],movement[1][2]]]);await flush();assert.deepEqual(directions(f),[]);assert.equal(f.api.whenIdle(f.stage),null);f.api.reset();
 }
});

test('a fresh primary pointer recovers from a missing final group TouchEnd while the old remaining finger is ignored',async()=>{
 const f=fixture({keep:true});f.api.mount(f.stage,f.options);const strip=f.stage.children[0];group(f,'touchstart',[[9,200],[10,300]]);group(f,'touchmove',[[9,340],[10,440]]);group(f,'touchend',[[10,440]],[[9,340]]);await flush();assert.deepEqual(directions(f),[1]);group(f,'touchmove',[[10,740]]);assert.equal(paintedPosition(strip),800);assert.deepEqual(directions(f),[1]);stroke(f,140);await flush();assert.deepEqual(directions(f),[1,1]);assert.equal(f.api.whenIdle(f.stage),null);f.api.reset();
});

test('a fresh one-contact TouchStart recovers even when the browser reuses the missing group-tail identifier',async()=>{
 const f=fixture({keep:true});f.api.mount(f.stage,f.options);const strip=f.stage.children[0];group(f,'touchstart',[[9,200],[10,300]]);group(f,'touchmove',[[9,340],[10,440]]);group(f,'touchend',[[10,440]],[[9,340]]);group(f,'touchmove',[[10,740]]);assert.equal(paintedPosition(strip),800);touch(f,'touchstart',200,100,10);touch(f,'touchmove',340,100,10);assert.equal(paintedPosition(strip),660);touch(f,'touchend',340,100,10);await flush();assert.deepEqual(directions(f),[1,1]);assert.equal(f.api.whenIdle(f.stage),null);f.api.reset();
});

test('an old group-tail guard cannot swallow TouchEnd in a different mounted viewer stage',async()=>{
 const f=fixture({keep:true});f.api.mount(f.stage,f.options);group(f,'touchstart',[[9,200],[10,300]]);group(f,'touchmove',[[9,340],[10,440]]);group(f,'touchend',[[10,440]],[[9,340]]);await flush();assert.deepEqual(directions(f),[1]);
 const nextStage=new f.scroll.constructor(),nextScroll=new f.scroll.constructor();nextScroll.className='face-photo-scroll';nextStage.append(nextScroll);f.api.mount(nextStage,f.options);const point=x=>({identifier:10,clientX:x,clientY:100,target:nextScroll});f.fire('touchstart',{target:nextScroll,touches:[point(200)]});f.fire('touchmove',{target:nextScroll,touches:[point(340)]});assert.equal(paintedPosition(nextStage.children[0]),660);f.fire('touchend',{target:nextScroll,touches:[],changedTouches:[point(340)]});await flush();assert.deepEqual(directions(f),[1,1]);assert.equal(f.api.whenIdle(nextStage),null);f.api.reset();
});

test('a fresh primary pointer reserves its contact before completing a meaningful group whose first TouchEnd is missing',async()=>{
 const f=fixture({keep:true}),waits=[];f.options.step=(direction,options)=>{f.calls.push({direction,native:options.native});const wait=f.api.whenIdle(f.stage);if(wait)waits.push(wait);return wait;};f.api.mount(f.stage,f.options);group(f,'touchstart',[[9,200],[10,300]]);group(f,'touchmove',[[9,340],[10,440]]);assert.deepEqual(directions(f),[]);pointer(f,'pointerdown');assert.deepEqual(directions(f),[1]);assert.equal(waits.length,1,'The new finger already owns input when the old step checks idle');pointer(f,'pointermove',340);pointer(f,'pointerup',340);await Promise.all(waits);await flush();assert.deepEqual(directions(f),[1,1]);assert.equal(f.api.whenIdle(f.stage),null);f.api.reset();
});

test('a fresh primary pointer cancels a tiny unfinished group and preserves its own normal swipe',async()=>{
 const f=fixture({keep:true});f.api.mount(f.stage,f.options);group(f,'touchstart',[[9,200],[10,300]]);group(f,'touchmove',[[9,210],[10,310]]);pointer(f,'pointerdown');assert.deepEqual(directions(f),[]);pointer(f,'pointermove',340);pointer(f,'pointerup',340);await flush();assert.deepEqual(directions(f),[1]);assert.equal(f.api.whenIdle(f.stage),null);f.api.reset();
});

test('a fresh one-contact TouchStart completes an unfinished meaningful group and preserves the new contact',async()=>{
 const f=fixture({keep:true});f.api.mount(f.stage,f.options);group(f,'touchstart',[[9,200],[10,300]]);group(f,'touchmove',[[9,340],[10,440]]);touch(f,'touchstart',200,100,11);assert.deepEqual(directions(f),[1]);touch(f,'touchmove',340,100,11);touch(f,'touchend',340,100,11);await flush();assert.deepEqual(directions(f),[1,1]);assert.equal(f.api.whenIdle(f.stage),null);f.api.reset();
});

test('repeated same-pair TouchStart preserves the old origin while a genuinely new pair completes and replaces it',async()=>{
 const f=fixture({keep:true});f.api.mount(f.stage,f.options);const strip=f.stage.children[0];group(f,'touchstart',[[9,200],[10,300]]);group(f,'touchmove',[[9,340],[10,440]]);group(f,'touchstart',[[9,340],[10,440]]);assert.deepEqual(directions(f),[]);group(f,'touchmove',[[9,360],[10,460]]);assert.equal(paintedPosition(strip),640,'The repeated pair retains its original centroid');group(f,'touchstart',[[11,200],[12,300]]);assert.deepEqual(directions(f),[1]);group(f,'touchmove',[[11,340],[12,440]]);assert.equal(paintedPosition(strip),660);group(f,'touchend',[[12,440]],[[11,340]]);group(f,'touchend',[],[[12,440]]);await flush();assert.deepEqual(directions(f),[1,1]);assert.equal(f.api.whenIdle(f.stage),null);f.api.reset();
});

test('a primary pointer on an outside header finishes an old meaningful group from its last centroid before an arrow acts',async()=>{
 const f=fixture({keep:true});f.api.mount(f.stage,f.options);group(f,'touchstart',[[9,200],[10,300]]);group(f,'touchmove',[[9,340],[10,440]]);const header=new f.scroll.constructor();header.tagName='HEADER';f.fire('pointerdown',{target:header,pointerType:'touch',pointerId:12,isPrimary:true,clientX:-500,clientY:-500});assert.deepEqual(f.calls,[{direction:1,native:true}],'Header coordinates cannot replace the old group position');assert.equal(f.api.whenIdle(f.stage),null);f.options.step(1,{native:false});await flush();assert.deepEqual(directions(f),[1,1]);f.api.reset();
});

test('a primary pointer outside the viewer discards a tiny unfinished group so only the manual arrow acts',async()=>{
 const f=fixture({keep:true});f.api.mount(f.stage,f.options);group(f,'touchstart',[[9,200],[10,300]]);group(f,'touchmove',[[9,210],[10,310]]);const header=new f.scroll.constructor();header.tagName='HEADER';f.fire('pointerdown',{target:header,pointerType:'touch',pointerId:12,isPrimary:true,clientX:900,clientY:900});assert.deepEqual(directions(f),[]);assert.equal(f.api.whenIdle(f.stage),null);f.options.step(1,{native:false});await flush();assert.deepEqual(f.calls,[{direction:1,native:false}]);f.api.reset();
});

test('a protected control or primary mouse inside the viewer finishes the old group and leaves input idle',async()=>{
 for(const kind of ['protected-touch','ordinary-mouse']){
  const f=fixture({keep:true});f.api.mount(f.stage,f.options);group(f,'touchstart',[[9,200],[10,300]]);group(f,'touchmove',[[9,340],[10,440]]);let target=f.scroll;
  if(kind==='protected-touch'){target=new f.scroll.constructor();target.tagName='BUTTON';f.scroll.append(target);}
  f.fire('pointerdown',{target,pointerType:kind==='ordinary-mouse'?'mouse':'touch',pointerId:12,isPrimary:true,clientX:-500,clientY:-500});await flush();assert.deepEqual(directions(f),[1],kind);assert.equal(f.api.whenIdle(f.stage),null,kind);f.api.reset();
 }
});

test('the same protected pointer event cannot claim a newly remounted controller along its frozen browser event path',async()=>{
 const f=fixture({keep:true}),button=new f.scroll.constructor();button.tagName='BUTTON';f.scroll.append(button);f.options.step=(direction,options)=>{f.calls.push({direction,native:options.native});f.api.reset(f.stage);button.remove();f.api.mount(f.stage,f.options);};f.api.mount(f.stage,f.options);const oldStrip=f.stage.children[0];group(f,'touchstart',[[9,200],[10,300]]);group(f,'touchmove',[[9,340],[10,440]]);
 const event={target:button,pointerType:'touch',pointerId:12,isPrimary:true,clientX:-500,clientY:-500,cancelable:true,preventDefault(){this.defaultPrevented=true;}};
 // Native dispatch freezes its ancestor path before document capture. The
 // old protected target therefore still reaches stage capture after remount.
 f.events.get('pointerdown')(event);assert.notEqual(f.stage.children[0],oldStrip);f.stage.handlers.get('pointerdown')(event);await flush();assert.deepEqual(directions(f),[1]);assert.equal(f.api.has(f.stage),true);assert.equal(f.api.diagnostics(f.stage).pointer,false);assert.equal(f.api.whenIdle(f.stage),null);f.api.reset();
});
