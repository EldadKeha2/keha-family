import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../public/assets/photo-native.js',import.meta.url),'utf8');
const swipeSource=await readFile(new URL('../public/assets/photo-swipe.js',import.meta.url),'utf8');
function fixture({mobile=false,english=false,supported=true,scrollEnd=false,width=mobile?360:800}={}){
 class Node{
  constructor(){this.nodeType=1;this.children=[];this.handlers=new Map();this.clientWidth=width;this.scrollLeft=0;this.className='';this.parent=null;this.style={};if(scrollEnd)this.onscrollend=null;const classes=new Set();this.classList={add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x)};}
  get parentNode(){return this.parent;}
  setAttribute(name,value){this[name]=value;}
  addEventListener(type,handler){this.handlers.set(type,handler);}
  append(...nodes){for(const node of nodes){node.remove();node.parent=this;this.children.push(node);}}
  before(node){const parent=this.parent,index=parent.children.indexOf(this);node.remove();node.parent=parent;parent.children.splice(index,0,node);}
  remove(){if(this.parent){this.parent.children=this.parent.children.filter(x=>x!==this);this.parent=null;}}
  querySelector(selector){if(selector==='.face-photo-scroll')return this.children.flatMap(n=>[n,...n.children.flatMap(c=>[c,...c.children])]).find(n=>n.className==='face-photo-scroll')||null;return null;}
 }
 const events=new Map(),stage=new Node(),scroll=new Node(),window={addEventListener(){}},document={createElement:()=>new Node(),addEventListener:(type,handler)=>{const previous=events.get(type);events.set(type,event=>{previous?.(event);handler(event);});}},calls=[];scroll.className='face-photo-scroll';stage.append(scroll);let enabled=true;
 const context=vm.createContext({window,document,navigator:{userAgent:mobile?'Android':'Windows NT'},CSS:{supports:()=>supported},matchMedia:()=>({matches:mobile}),Date,setTimeout,clearTimeout});vm.runInContext(source,context);vm.runInContext(swipeSource,context);
 const options={previous:{kind:'photo',previewSrc:'/prev-small'},next:{kind:'photo',previewSrc:'/next-small'},isEnglish:english,enabled:()=>enabled,step(direction,opts){calls.push({direction,native:opts.native});window.FamilyPhotoNative.reset(stage);}};
 return {window,api:window.FamilyPhotoNative,swipe:window.FamilyPhotoSwipe,events,stage,scroll,calls,options,disable(){enabled=false;}};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const pointer=(f,type,x=200,y=100,id=7,target)=>{
 const event={pointerType:'touch',pointerId:id,isPrimary:true,clientX:x,clientY:y,target};
 (type==='pointerdown'?f.stage.children[0].handlers:f.events).get(type)(event);return event;
};
const wheel=(strip,dx,extra={})=>{const event={deltaX:dx,deltaY:0,cancelable:true,preventDefault(){this.prevented=true;},...extra};strip.handlers.get('wheel')(event);return event;};

test('fixed native panes always place Next on the left and Previous on the right',async()=>{
 for(const mobile of [false,true])for(const english of [false,true])for(const page of [0,2]){
  const f=fixture({mobile,english});f.api.mount(f.stage,f.options);const strip=f.stage.children[0],width=strip.clientWidth;
  assert.equal(strip.children[0].children[0].src,'/next-small');assert.equal(strip.children[2].children[0].src,'/prev-small');assert.equal(strip.children[1].children[0],f.scroll);
  f.api.claim(f.stage);strip.scrollLeft=page*width;strip.handlers.get('scrollend')();strip.handlers.get('scrollend')();await flush();
  assert.deepEqual(f.calls,[{direction:page===0?1:-1,native:true}]);assert.equal(f.scroll.parent,f.stage);
 }
});

test('unsupported browsers and disabled editing unwrap the actual face scroller safely',()=>{
 const old=fixture({supported:false});assert.equal(old.api.mount(old.stage,old.options),false);assert.equal(old.stage.children[0],old.scroll);
 const f=fixture();f.api.mount(f.stage,f.options);f.disable();assert.equal(f.api.mount(f.stage,f.options),false);assert.equal(f.stage.children[0],f.scroll);
});

test('screen touch follows the completed finger in both directions and ignores obsolete completion',async()=>{
 for(const direction of [-1,1])for(const page of [0,2]){
  const f=fixture({scrollEnd:true});f.api.mount(f.stage,f.options);const strip=f.stage.children[0];
  pointer(f,'pointerdown');pointer(f,'pointermove',200+direction*140);pointer(f,'pointerup',200+direction*140);
  strip.scrollLeft=page*800;strip.handlers.get('scrollend')();strip.handlers.get('scrollend')();await flush();assert.deepEqual(f.calls,[{direction,native:true}]);
 }
});

test('horizontal trackpad input moves the actual pixels with the gesture and settles on the matching fixed pane',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 for(const direction of [-1,1]){
  const f=fixture({scrollEnd:true});f.api.mount(f.stage,f.options);const strip=f.stage.children[0];
  const event=wheel(strip,direction*120);assert.equal(event.prevented,true);assert.equal(strip.scrollLeft,800-direction*120);assert.equal(strip.style.scrollSnapType,'none');
  t.mock.timers.tick(80);assert.equal(strip.style.scrollSnapType,'');assert.equal(strip.scrollLeft,direction>0?0:1600);strip.handlers.get('scrollend')();await flush();
  assert.deepEqual(f.calls,[{direction,native:true}]);
 }
});

test('a released touch commits within its bounded deadline without scrollend or a completed snap',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const f=fixture({scrollEnd:true});f.api.mount(f.stage,f.options);const strip=f.stage.children[0];
 pointer(f,'pointerdown');pointer(f,'pointerup',340);strip.scrollLeft=680;
 const wait=f.api.whenIdle(f.stage);assert.ok(wait);t.mock.timers.tick(249);assert.deepEqual(f.calls,[]);t.mock.timers.tick(1);await wait;await flush();assert.deepEqual(f.calls,[{direction:1,native:true}]);assert.equal(f.api.whenIdle(f.stage),null);
});

test('controlled wheel including fractional input commits within 300ms without scrollend',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 for(const dx of [120,.75]){
  const f=fixture({scrollEnd:true});f.api.mount(f.stage,f.options);const strip=f.stage.children[0];wheel(strip,dx);const wait=f.api.whenIdle(f.stage);
  t.mock.timers.tick(80);t.mock.timers.tick(219);assert.deepEqual(f.calls,[]);t.mock.timers.tick(1);await wait;await flush();assert.deepEqual(f.calls,[{direction:1,native:true}]);assert.equal(f.api.whenIdle(f.stage),null);f.api.reset();
 }
});

test('an owned completed neighboring edge counts even when fractional wheel samples sum below the old threshold',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const f=fixture({scrollEnd:true});f.api.mount(f.stage,f.options);const strip=f.stage.children[0];
 wheel(strip,.75);strip.scrollLeft=0;t.mock.timers.tick(80);strip.handlers.get('scrollend')();await flush();assert.deepEqual(f.calls,[{direction:1,native:true}]);
});

test('a stale partial wheel completion cannot finish its newer target animation early',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const f=fixture({scrollEnd:true});f.api.mount(f.stage,f.options);const strip=f.stage.children[0];
 strip.scrollTo=()=>{};wheel(strip,120);t.mock.timers.tick(80);strip.handlers.get('scrollend')();assert.deepEqual(f.calls,[]);t.mock.timers.tick(220);await flush();assert.deepEqual(f.calls,[{direction:1,native:true}]);
});

test('a second touch is retained while earlier media preparation remains pending',async()=>{
 const f=fixture({scrollEnd:true}),finishes=[];f.options.step=(direction,options)=>{f.calls.push({direction,native:options.native});return new Promise(resolve=>finishes.push(resolve));};f.api.mount(f.stage,f.options);const strip=f.stage.children[0];
 for(const direction of [1,1,-1]){pointer(f,'pointerdown');pointer(f,'pointerup',200+direction*140);strip.scrollLeft=direction>0?0:1600;strip.handlers.get('scrollend')();assert.equal(strip.scrollLeft,800);assert.equal(strip.style.overflowX,'');}
 assert.deepEqual(f.calls.map(call=>call.direction),[1,1,-1]);for(const finish of finishes)finish();await flush();f.api.reset();
});

test('new contact is reserved before a previous completed swipe can paint a warm cached target',async()=>{
 const f=fixture({scrollEnd:true}),waits=[];f.options.step=(direction,options)=>{f.calls.push({direction,native:options.native});const wait=f.api.whenIdle(f.stage);if(wait)waits.push(wait);return wait;};f.api.mount(f.stage,f.options);const strip=f.stage.children[0];
 pointer(f,'pointerdown');pointer(f,'pointerup',340);pointer(f,'pointerdown');assert.equal(waits.length,1);assert.deepEqual(f.calls.map(call=>call.direction),[1]);
 pointer(f,'pointerup',340);strip.scrollLeft=0;strip.handlers.get('scrollend')();await Promise.all(waits);await flush();assert.deepEqual(f.calls.map(call=>call.direction),[1,1]);f.api.reset();
});

test('separate wheel episodes retain two actions before one coalesced browser completion without relying on a coalesced browser end',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 for(const second of [[90,45],[-90,-45]]){
  const f=fixture({scrollEnd:true});f.options.step=(direction,options)=>{f.calls.push({direction,native:options.native});return new Promise(()=>{});};f.api.mount(f.stage,f.options);const strip=f.stage.children[0];
  for(const dx of [90,45]){wheel(strip,dx);t.mock.timers.tick(8);}t.mock.timers.tick(110);
  for(const dx of second){wheel(strip,dx);t.mock.timers.tick(8);}t.mock.timers.tick(80);t.mock.timers.tick(220);strip.handlers.get('scrollend')();await flush();
  assert.deepEqual(f.calls.map(call=>call.direction),[1,Math.sign(second[0])]);assert.equal(f.api.whenIdle(f.stage),null);f.api.reset();
 }
});

test('wheel reversal preserves the new physical episode before committing the preceding direction',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const f=fixture({scrollEnd:true}),waits=[];f.options.step=(direction,options)=>{f.calls.push({direction,native:options.native});const wait=f.api.whenIdle(f.stage);if(wait)waits.push(wait);return wait;};f.api.mount(f.stage,f.options);const strip=f.stage.children[0];
 wheel(strip,120);wheel(strip,-140);assert.equal(waits.length,1);t.mock.timers.tick(80);t.mock.timers.tick(220);await Promise.all(waits);await flush();assert.deepEqual(f.calls.map(call=>call.direction),[1,-1]);f.api.reset();
});

test('native playback controls, vertical scrolling and pinch zoom retain their browser actions',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const f=fixture({scrollEnd:true});f.api.mount(f.stage,f.options);const strip=f.stage.children[0],video={getBoundingClientRect:()=>({bottom:500}),closest:selector=>selector==='video'?video:null};
 const event={target:video,pointerType:'touch',pointerId:7,isPrimary:true,clientX:200,clientY:480};strip.handlers.get('pointerdown')(event);f.events.get('pointerup')({...event,clientX:350});
 assert.equal(wheel(strip,140,{target:video,clientY:480}).prevented,undefined);assert.equal(wheel(strip,0,{deltaY:140}).prevented,undefined);assert.equal(wheel(strip,140,{ctrlKey:true}).prevented,undefined);
 pointer(f,'pointerdown');strip.handlers.get('touchstart')({touches:[{identifier:7},{identifier:8}]});t.mock.timers.tick(350);await flush();assert.deepEqual(f.calls,[]);assert.equal(f.api.whenIdle(f.stage),null);f.api.reset();
});

test('zero-width startup cannot select a pane, and reset resolves every pending input waiter',async()=>{
 const f=fixture({width:0,scrollEnd:true});f.api.mount(f.stage,f.options);const strip=f.stage.children[0];assert.equal(strip.style.visibility,'hidden');strip.handlers.get('scrollend')();assert.deepEqual(f.calls,[]);
 strip.clientWidth=800;f.api.mount(f.stage,f.options);assert.equal(strip.scrollLeft,800);assert.equal(strip.style.visibility,'');strip.scrollLeft=0;strip.handlers.get('scrollend')();assert.deepEqual(f.calls,[]);
 pointer(f,'pointerdown');const waiting=f.api.whenIdle(f.stage);f.api.reset();await waiting;assert.equal(f.api.whenIdle(f.stage),null);
});


test('Windows pointer cancellation with a ghost compatibility touch is bounded and a new wheel packet takes ownership',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 for(const wheelNext of [false,true]){
  const f=fixture({scrollEnd:true});f.api.mount(f.stage,f.options);const strip=f.stage.children[0];
  pointer(f,'pointerdown');strip.handlers.get('touchstart')({touches:[{identifier:7,clientX:200,clientY:100}]});f.events.get('pointercancel')({pointerId:7});
  const wait=f.api.whenIdle(f.stage);
  if(wheelNext){wheel(strip,.75);t.mock.timers.tick(80);t.mock.timers.tick(220);}else t.mock.timers.tick(250);
  await wait;await flush();assert.equal(f.api.whenIdle(f.stage),null);assert.deepEqual(f.calls.map(call=>call.direction),wheelNext?[1]:[]);f.api.reset();
 }
});

test('a normal Windows pointer release completes a compatibility touch even when touchend never arrives',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 for(const lateTouchEnd of [false,true]){
  const f=fixture({scrollEnd:true});f.api.mount(f.stage,f.options);const strip=f.stage.children[0];
  pointer(f,'pointerdown');strip.handlers.get('touchstart')({touches:[{identifier:9,clientX:200,clientY:100}]});
  pointer(f,'pointermove',340);pointer(f,'pointerup',340);const wait=f.api.whenIdle(f.stage);
  t.mock.timers.tick(250);await wait;await flush();assert.deepEqual(f.calls,[{direction:1,native:true}]);assert.equal(f.api.whenIdle(f.stage),null);
  if(lateTouchEnd){f.events.get('touchend')({changedTouches:[{identifier:9,clientX:340,clientY:100}]});t.mock.timers.tick(300);await flush();assert.equal(f.calls.length,1,'A late companion touchend cannot count the same gesture twice');}
  f.api.reset();
 }
});

test('Windows browser-owned native pan survives early pointer cancellation and continuous real scroll samples',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 for(const compatibility of [false,true]){
  const f=fixture({scrollEnd:true});f.api.mount(f.stage,f.options);const strip=f.stage.children[0];
  pointer(f,'pointerdown');if(compatibility)strip.handlers.get('touchstart')({touches:[{identifier:7,clientX:200,clientY:100}]});pointer(f,'pointermove',208);f.events.get('pointercancel')({pointerId:7});
  for(let i=1;i<=6;i++){t.mock.timers.tick(60);strip.scrollLeft=800-i*30;strip.handlers.get('scroll')();assert.deepEqual(f.calls,[]);assert.equal(strip.scrollLeft,800-i*30,'A fixed cancellation timer cannot recenter a still-moving native pan');}
  const wait=f.api.whenIdle(f.stage);t.mock.timers.tick(249);assert.deepEqual(f.calls,[]);t.mock.timers.tick(1);await wait;await flush();assert.deepEqual(f.calls,[{direction:1,native:true}]);assert.equal(f.api.whenIdle(f.stage),null);
 }
});

test('native automatic snapback retains inferred physical direction while an explicit actual release can reverse or cancel it',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 for(const release of ['missing','cancel','reverse']){
  const f=fixture({scrollEnd:true});f.api.mount(f.stage,f.options);const strip=f.stage.children[0];
  pointer(f,'pointerdown');strip.handlers.get('touchstart')({touches:[{identifier:7,clientX:200,clientY:100}]});pointer(f,'pointermove',208);f.events.get('pointercancel')({pointerId:7});
  strip.scrollLeft=620;strip.handlers.get('scroll')();
  if(release!=='missing')f.events.get('touchend')({changedTouches:[{identifier:7,clientX:release==='cancel'?205:60,clientY:100}]});
  strip.scrollLeft=800;strip.handlers.get('scroll')();strip.handlers.get('scrollend')();t.mock.timers.tick(350);await flush();
  assert.deepEqual(f.calls.map(call=>call.direction),release==='missing'?[1]:release==='reverse'?[-1]:[]);assert.equal(f.api.whenIdle(f.stage),null);f.api.reset();
 }
});

test('an orphan touchstart releases idle without discarding ownership of a later actual native pan',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const f=fixture({scrollEnd:true});f.api.mount(f.stage,f.options);const strip=f.stage.children[0];
 strip.handlers.get('touchstart')({touches:[{identifier:7,clientX:200,clientY:100}]});const wait=f.api.whenIdle(f.stage);t.mock.timers.tick(350);await wait;assert.equal(f.api.whenIdle(f.stage),null);assert.deepEqual(f.calls,[]);
 strip.scrollLeft=650;strip.handlers.get('scroll')();assert.equal(f.api.isActive(f.stage),true);t.mock.timers.tick(250);await flush();assert.deepEqual(f.calls,[{direction:1,native:true}]);assert.equal(f.api.whenIdle(f.stage),null);
});


test('trackpad mapping applies only after horizontal ownership and never changes actual screen-touch direction',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const f=fixture({scrollEnd:true}),mapped=[];f.window.FamilyGalleryInput={wheelDelta:dx=>{mapped.push(dx);return -dx;}};f.api.mount(f.stage,f.options);const strip=f.stage.children[0];
 wheel(strip,0,{deltaY:140});wheel(strip,120,{ctrlKey:true});assert.deepEqual(mapped,[]);
 wheel(strip,120,{deltaMode:1});assert.deepEqual(mapped,[1920]);assert.equal(strip.scrollLeft,1600);t.mock.timers.tick(80);strip.handlers.get('scrollend')();await flush();assert.deepEqual(f.calls,[{direction:-1,native:true}]);
 const touch=fixture({scrollEnd:true});touch.window.FamilyGalleryInput={wheelDelta:()=>{throw Error('Screen touch must never be calibrated');}};touch.api.mount(touch.stage,touch.options);const rail=touch.stage.children[0];pointer(touch,'pointerdown');pointer(touch,'pointerup',340);rail.scrollLeft=0;rail.handlers.get('scrollend')();await flush();assert.deepEqual(touch.calls,[{direction:1,native:true}]);
});
