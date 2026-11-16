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
 return {api:window.FamilyPhotoNative,swipe:window.FamilyPhotoSwipe,events,stage,scroll,calls,options,disable(){enabled=false;}};
}
test('phone and desktop native scrolling selects the adjacent photo once in either language and restores the face scroller',async()=>{
 for(const mobile of [false,true])for(const english of [true,false])for(const page of [0,2]){
  const f=fixture({mobile,english}),width=mobile?360:800;assert.equal(f.api.mount(f.stage,f.options),true);const strip=f.stage.children[0];assert.equal(strip.className,'native-photo-strip');assert.equal(strip.scrollLeft,width);
  assert.equal(strip.children[1].children[0],f.scroll);assert.equal(f.api.mount(f.stage,f.options),true);assert.equal(f.stage.children.length,1);
  assert.equal(strip.children[0].children[0].src,'/next-small','A rightward finger movement reveals the higher-numbered photo on the left');assert.equal(strip.children[2].children[0].src,'/prev-small');
  f.api.claim(f.stage);strip.scrollLeft=page*width;strip.handlers.get('scrollend')();strip.handlers.get('scrollend')();await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(f.calls,[{direction:page===0?1:-1,native:true}]);assert.equal(f.scroll.parent,f.stage);assert.equal(f.api.has(f.stage),false);
 }
});
test('native swiping disables itself for zoom, editing and browsers needing the gesture fallback',()=>{
 const old=fixture({supported:false});assert.equal(old.api.mount(old.stage,old.options),false);assert.equal(old.stage.children[0],old.scroll);
 for(const mobile of [false,true]){const f=fixture({mobile});f.api.mount(f.stage,f.options);f.disable();assert.equal(f.api.mount(f.stage,f.options),false);assert.equal(f.stage.children[0],f.scroll);}
});
test('native scrolling waits for a completed snap and remains centered and available while its photo is prepared',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const f=fixture({mobile:true,scrollEnd:true});let finish;
 f.options.step=(direction,options)=>{f.calls.push({direction,native:options.native});return new Promise(resolve=>{finish=resolve;});};f.api.mount(f.stage,f.options);const strip=f.stage.children[0];
 f.api.claim(f.stage);strip.scrollLeft=100;strip.handlers.get('scrollend')();assert.equal(f.calls.length,0,'A partially finished snap must not replace the photo');
 strip.scrollLeft=0;strip.handlers.get('scroll')();t.mock.timers.tick(500);assert.equal(f.calls.length,0,'Supporting browsers wait for the actual gesture end, not a pause under the finger');
 strip.handlers.get('scrollend')();strip.handlers.get('scrollend')();assert.deepEqual(f.calls,[{direction:1,native:true}]);assert.equal(strip.style.overflowX,'');assert.equal(strip.scrollLeft,360);
 finish();await new Promise(resolve=>setImmediate(resolve));assert.equal(strip.style.overflowX,'');assert.equal(strip.scrollLeft,360);f.api.reset();
});
test('a new stroke claims a completed native snap before scrollend and queues further strokes while loading',async()=>{
 for(const english of [false,true]){
  const f=fixture({mobile:true,english,scrollEnd:true});let finish,busy=true;
  f.options.busy=()=>busy;f.options.step=(direction,options)=>{f.calls.push({direction,native:options.native});return new Promise(resolve=>finish=resolve);};
  f.api.mount(f.stage,f.options);const strip=f.stage.children[0];assert.equal(f.api.claim(f.stage),'native');strip.scrollLeft=0;
  assert.equal(f.api.claim(f.stage),'queued');assert.deepEqual(f.calls,[{direction:1,native:true}]);strip.handlers.get('scrollend')();assert.equal(f.calls.length,1);
  finish();await new Promise(resolve=>setImmediate(resolve));assert.equal(f.api.claim(f.stage),'queued','An older load ending cannot unlock a strip used by a newer queued target');assert.equal(strip.scrollLeft,360,'The next physical stroke starts from the reusable center');
  busy=false;f.api.reset();assert.equal(f.api.claim(f.stage),'manual');
 }
});
test('a released native flick is counted before a second stroke interrupts its unfinished snap',async()=>{
 for(const dx of [-120,120]){
  const f=fixture({mobile:true,scrollEnd:true});f.api.mount(f.stage,f.options);const strip=f.stage.children[0];strip.scrollLeft=360-dx;
  f.api.note(f.stage,dx);assert.equal(f.calls.length,0,'A single swipe still belongs to native scrolling until it snaps');
  assert.equal(f.api.claim(f.stage),'queued');assert.deepEqual(f.calls,[{direction:dx>0?1:-1,native:true}]);await new Promise(resolve=>setImmediate(resolve));
 }
 const f=fixture({mobile:true,scrollEnd:true});f.api.mount(f.stage,f.options);f.stage.children[0].handlers.get('scrollend')();assert.equal(f.api.claim(f.stage),'native','Returning to center without a released swipe never selects another photo');f.api.reset();
});
test('phone pointer and touch swipes follow the finger even when the browser snaps to the opposite photo',async()=>{
 for(const english of [false,true])for(const stream of ['pointer','touch'])for(const dx of [-120,120])for(const opposite of [false,true]){
  const f=fixture({mobile:true,english,scrollEnd:true});f.api.mount(f.stage,f.options);const strip=f.stage.children[0];
  f.swipe.bind(f.stage,{enabled:f.options.enabled,step:f.options.step,claim:()=>f.api.claim(f.stage),nativeEnd:dx=>f.api.note(f.stage,dx)});
  const target={closest:()=>null},pointer=(type,x)=>{const event={pointerId:7,pointerType:'touch',isPrimary:true,button:0,clientX:x,clientY:100,target,cancelable:true,preventDefault(){}};(type==='pointerdown'?f.stage.handlers:f.events).get(type)(event);};
  const touch=(type,x)=>{const point={identifier:7,clientX:x,clientY:100,target},event={touches:type==='touchend'?[]:[point],changedTouches:[point],target,cancelable:true,preventDefault(){}};(type==='touchstart'?f.stage.handlers:f.events).get(type)(event);};
  pointer('pointerdown',180);
  if(stream==='touch'){touch('touchstart',180);pointer('pointercancel',180);touch('touchmove',180+dx);}
  else pointer('pointermove',180+dx);
  const expected=dx>0?1:-1,page=(expected>0)!==opposite?0:2;strip.scrollLeft=page*360;
  if(stream==='touch')touch('touchend',180+dx);else pointer('pointerup',180+dx);
  strip.handlers.get('scrollend')();pointer('pointerup',180+dx);strip.handlers.get('scrollend')();
  await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(f.calls,[{direction:expected,native:true}],`${english?'English':'Hebrew'} ${stream}: right is Next, left is Previous, once`);
  assert.equal(strip.scrollLeft,360,'The reusable strip recenters after recording the selected neighbour');
 }
});
test('released touch swipes still select a neighbour when native scrolling is cancelled or reports no completion',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 for(const mobile of [false,true])for(const english of [false,true])for(const dx of [-120,120]){
  const f=fixture({mobile,english,scrollEnd:true});f.api.mount(f.stage,f.options);const strip=f.stage.children[0];f.api.note(f.stage,dx);strip.handlers.get('scrollend')();assert.equal(f.calls.length,0);
  t.mock.timers.tick(179);assert.equal(f.calls.length,0);t.mock.timers.tick(1);await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(f.calls,[{direction:dx>0?1:-1,native:true}]);strip.handlers.get('scrollend')();assert.equal(f.calls.length,1,'A late browser completion cannot advance twice');
 }
 const hidden=fixture({mobile:true,scrollEnd:true,width:0});hidden.api.mount(hidden.stage,hidden.options);hidden.stage.children[0].clientWidth=360;hidden.api.note(hidden.stage,120);t.mock.timers.tick(180);assert.equal(hidden.calls.length,1,'Opening while hidden must not permanently retain a zero-width strip');
 const closed=fixture({mobile:true,scrollEnd:true});closed.api.mount(closed.stage,closed.options);closed.api.note(closed.stage,120);closed.api.reset();t.mock.timers.tick(500);assert.equal(closed.calls.length,0);
});


test('native touch direction follows the completed finger and wheel direction follows Next deltas',async()=>{
 for(const mode of ['touch','wheel'])for(const direction of [-1,1])for(const page of [0,2]){
  const f=fixture({scrollEnd:true});f.api.mount(f.stage,f.options);const strip=f.stage.children[0];
  if(mode==='wheel')strip.handlers.get('wheel')({deltaX:direction*120,deltaY:0});
  else{
   strip.handlers.get('pointerdown')({pointerType:'touch',pointerId:7,clientX:200,clientY:100});
   f.events.get('pointermove')({pointerId:7,clientX:200+direction*120,clientY:100});
   f.events.get('pointerup')({pointerId:7,clientX:200+direction*120,clientY:100});
  }
  strip.scrollLeft=page*800;strip.handlers.get('scrollend')();await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(f.calls,[{direction,native:true}],mode+' must retain physical intent even if a browser snap finishes on the opposite pane');
 }
});

test('each completed native stroke is accepted while earlier media preparation is still pending',async()=>{
 const f=fixture({scrollEnd:true}),finishes=[];f.options.step=(direction,options)=>{f.calls.push({direction,native:options.native});return new Promise(resolve=>finishes.push(resolve));};
 f.api.mount(f.stage,f.options);const strip=f.stage.children[0];
 for(const direction of [1,1,-1]){
  strip.handlers.get('pointerdown')({pointerType:'touch',pointerId:7,clientX:200,clientY:100});
  f.events.get('pointerup')({pointerId:7,clientX:200+direction*120,clientY:100});
  strip.scrollLeft=direction>0?0:1600;strip.handlers.get('scrollend')();strip.handlers.get('scrollend')();
  assert.equal(strip.scrollLeft,800);assert.equal(strip.style.overflowX,'');
 }
 assert.deepEqual(f.calls.map(call=>call.direction),[1,1,-1]);
 for(const finish of finishes)finish();await new Promise(resolve=>setImmediate(resolve));f.api.reset();
});

test('native contact keeps pending pixels stable until release and reset resolves outstanding waiters',async()=>{
 const f=fixture({scrollEnd:true});f.api.mount(f.stage,f.options);const strip=f.stage.children[0];
 strip.handlers.get('pointerdown')({pointerType:'touch',pointerId:7,clientX:200,clientY:100});
 let idle=false;const wait=f.api.whenIdle(f.stage).then(()=>idle=true);assert.equal(f.api.isActive(f.stage),true);await Promise.resolve();assert.equal(idle,false);
 f.events.get('pointerup')({pointerId:7,clientX:200,clientY:100});await wait;assert.equal(f.api.isActive(f.stage),false);
 strip.handlers.get('pointerdown')({pointerType:'touch',pointerId:8,clientX:200,clientY:100});const closed=f.api.whenIdle(f.stage);f.api.reset();await closed;assert.equal(f.api.whenIdle(f.stage),null);
});

test('a zero-width opening stays hidden until a reused mount can anchor the actual center',()=>{
 const f=fixture({width:0,scrollEnd:true});f.api.mount(f.stage,f.options);const strip=f.stage.children[0];
 assert.equal(strip.style.visibility,'hidden');strip.handlers.get('scrollend')();assert.deepEqual(f.calls,[]);
 strip.clientWidth=800;f.api.mount(f.stage,f.options);assert.equal(strip.scrollLeft,800);assert.equal(strip.style.visibility,'');assert.equal(strip.children[1].children[0],f.scroll);strip.handlers.get('scrollend')();assert.deepEqual(f.calls,[]);strip.scrollLeft=0;strip.handlers.get('scrollend')({type:'scrollend'});assert.equal(strip.scrollLeft,800);assert.deepEqual(f.calls,[],'An unarmed layout snap cannot navigate');f.api.reset();
});


test('a reversing wheel phase reserves new input before committing an earlier unsnapped burst',async()=>{
 const f=fixture({scrollEnd:true}),waits=[];f.options.step=(direction,options)=>{
  f.calls.push({direction,native:options.native});const wait=f.api.whenIdle(f.stage);if(wait)waits.push(wait);return wait;
 };
 f.api.mount(f.stage,f.options);const strip=f.stage.children[0];
 strip.handlers.get('wheel')({deltaX:120,deltaY:0});strip.scrollLeft=950;
 strip.handlers.get('wheel')({deltaX:-140,deltaY:0});
 assert.deepEqual(f.calls,[{direction:1,native:true}]);assert.equal(waits.length,1,'The first cached image must wait for the reversing physical input');
 strip.scrollLeft=0;strip.handlers.get('scrollend')();await Promise.all(waits);await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(f.calls.map(call=>call.direction),[1,-1]);assert.equal(strip.scrollLeft,800);f.api.reset();
});


test('a completed second stroke remains active until native snap completion consumes its intent',async()=>{
 const f=fixture({scrollEnd:true});f.options.step=()=>new Promise(()=>{});f.api.mount(f.stage,f.options);const strip=f.stage.children[0];
 strip.handlers.get('pointerdown')({pointerType:'touch',pointerId:7,clientX:200,clientY:100});
 f.events.get('pointerup')({pointerId:7,clientX:340,clientY:100});
 let idle=false;const waiting=f.api.whenIdle(f.stage).then(()=>idle=true);await Promise.resolve();assert.equal(idle,false,'A released but unconsumed action must not be replaced by an earlier decoded photo');
 strip.scrollLeft=0;strip.handlers.get('scrollend')();await waiting;assert.equal(idle,true);f.api.reset();
});

test('native playback seeking never leaves a deferred gallery swipe for the next contact',async()=>{
 const f=fixture({scrollEnd:true});f.api.mount(f.stage,f.options);const strip=f.stage.children[0],video={getBoundingClientRect:()=>({bottom:500}),closest:selector=>selector==='video'?video:null};
 const event={target:video,pointerType:'touch',pointerId:7,clientX:200,clientY:480};
 strip.handlers.get('pointerdown')(event);f.events.get('pointerup')({...event,clientX:350});assert.equal(f.api.whenIdle(f.stage),null);
 strip.handlers.get('wheel')({target:video,clientY:480,deltaX:120,deltaY:0});assert.equal(f.api.whenIdle(f.stage),null);
 strip.handlers.get('pointerdown')({...event,clientY:200});assert.deepEqual(f.calls,[],'Seeking cannot be replayed as a photo navigation at the next body touch');f.api.reset();
});


test('separate same-direction wheel bursts count twice before one coalesced scrollend, while tiny momentum counts once',async t=>{
 t.mock.timers.enable({apis:['Date']});
 for(const second of [[90,45],[1,.5]]){
  const f=fixture({scrollEnd:true});f.options.step=(direction,options)=>{f.calls.push({direction,native:options.native});return new Promise(()=>{});};
  f.api.mount(f.stage,f.options);const strip=f.stage.children[0];
  for(const dx of [90,45]){strip.handlers.get('wheel')({deltaX:dx,deltaY:0});t.mock.timers.tick(8);}strip.scrollLeft=1600;
  t.mock.timers.tick(110);
  for(const dx of second){strip.handlers.get('wheel')({deltaX:dx,deltaY:0});t.mock.timers.tick(8);}strip.scrollLeft=1600;
  strip.handlers.get('scrollend')();strip.handlers.get('scrollend')();await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(f.calls.map(call=>call.direction),second[0]>8?[1,1]:[1]);assert.equal(strip.scrollLeft,800);f.api.reset();
 }
 const continuous=fixture({scrollEnd:true});continuous.options.step=(direction,options)=>{continuous.calls.push({direction,native:options.native});return new Promise(()=>{});};
 continuous.api.mount(continuous.stage,continuous.options);const strip=continuous.stage.children[0];
 for(let i=0;i<80;i++){strip.handlers.get('wheel')({deltaX:2,deltaY:.1});t.mock.timers.tick(8);}strip.scrollLeft=1600;strip.handlers.get('scrollend')();strip.handlers.get('scrollend')();
 assert.deepEqual(continuous.calls.map(call=>call.direction),[1]);continuous.api.reset();
});
