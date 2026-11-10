import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../public/assets/photo-native.js',import.meta.url),'utf8');
function fixture({mobile=false,english=false,supported=true,scrollEnd=false,width=mobile?360:800}={}){
 class Node{
  constructor(){this.nodeType=1;this.children=[];this.handlers=new Map();this.clientWidth=width;this.scrollLeft=0;this.className='';this.parent=null;this.style={};if(scrollEnd)this.onscrollend=null;const classes=new Set();this.classList={add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x)};}
  setAttribute(name,value){this[name]=value;}
  addEventListener(type,handler){this.handlers.set(type,handler);}
  append(...nodes){for(const node of nodes){node.remove();node.parent=this;this.children.push(node);}}
  before(node){const parent=this.parent,index=parent.children.indexOf(this);node.remove();node.parent=parent;parent.children.splice(index,0,node);}
  remove(){if(this.parent){this.parent.children=this.parent.children.filter(x=>x!==this);this.parent=null;}}
  querySelector(selector){if(selector==='.face-photo-scroll')return this.children.flatMap(n=>[n,...n.children.flatMap(c=>[c,...c.children])]).find(n=>n.className==='face-photo-scroll')||null;return null;}
 }
 const stage=new Node(),scroll=new Node(),window={},document={createElement:()=>new Node()},calls=[];scroll.className='face-photo-scroll';stage.append(scroll);let enabled=true;
 vm.runInNewContext(source,{window,document,navigator:{userAgent:mobile?'Android':'Windows NT'},CSS:{supports:()=>supported},matchMedia:()=>({matches:mobile}),setTimeout,clearTimeout});
 const options={previous:{kind:'photo',previewSrc:'/prev-small'},next:{kind:'photo',previewSrc:'/next-small'},isEnglish:english,enabled:()=>enabled,step(direction,opts){calls.push({direction,native:opts.native});window.FamilyPhotoNative.reset(stage);}};
 return {api:window.FamilyPhotoNative,stage,scroll,calls,options,disable(){enabled=false;}};
}
test('phone and desktop native scrolling selects the adjacent photo once in either language and restores the face scroller',async()=>{
 for(const mobile of [false,true])for(const english of [true,false])for(const page of [0,2]){
  const f=fixture({mobile,english}),width=mobile?360:800;assert.equal(f.api.mount(f.stage,f.options),true);const strip=f.stage.children[0];assert.equal(strip.className,'native-photo-strip');assert.equal(strip.scrollLeft,width);
  assert.equal(strip.children[1].children[0],f.scroll);assert.equal(f.api.mount(f.stage,f.options),true);assert.equal(f.stage.children.length,1);
  assert.equal(strip.children[0].children[0].src,'/next-small','A rightward finger movement reveals the higher-numbered photo on the left');assert.equal(strip.children[2].children[0].src,'/prev-small');
  strip.scrollLeft=page*width;strip.handlers.get('scrollend')();strip.handlers.get('scrollend')();await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(f.calls,[{direction:page===0?1:-1,native:true}]);assert.equal(f.scroll.parent,f.stage);assert.equal(f.api.has(f.stage),false);
 }
});
test('native swiping disables itself for zoom, editing and browsers needing the gesture fallback',()=>{
 const old=fixture({supported:false});assert.equal(old.api.mount(old.stage,old.options),false);assert.equal(old.stage.children[0],old.scroll);
 for(const mobile of [false,true]){const f=fixture({mobile});f.api.mount(f.stage,f.options);f.disable();assert.equal(f.api.mount(f.stage,f.options),false);assert.equal(f.stage.children[0],f.scroll);}
});
test('native scrolling waits for a completed snap and freezes the target while its photo is prepared',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const f=fixture({mobile:true,scrollEnd:true});let finish;
 f.options.step=(direction,options)=>{f.calls.push({direction,native:options.native});return new Promise(resolve=>{finish=resolve;});};f.api.mount(f.stage,f.options);const strip=f.stage.children[0];
 strip.scrollLeft=100;strip.handlers.get('scrollend')();assert.equal(f.calls.length,0,'A partially finished snap must not replace the photo');
 strip.scrollLeft=0;strip.handlers.get('scroll')();t.mock.timers.tick(500);assert.equal(f.calls.length,0,'Supporting browsers wait for the actual gesture end, not a pause under the finger');
 strip.handlers.get('scrollend')();strip.handlers.get('scrollend')();assert.deepEqual(f.calls,[{direction:1,native:true}]);assert.equal(strip.style.overflowX,'hidden');
 finish();await new Promise(resolve=>setImmediate(resolve));assert.equal(strip.style.overflowX,'');assert.equal(strip.scrollLeft,360);f.api.reset();
});
test('a new stroke claims a completed native snap before scrollend and queues further strokes while loading',async()=>{
 for(const english of [false,true]){
  const f=fixture({mobile:true,english,scrollEnd:true});let finish,busy=true;
  f.options.busy=()=>busy;f.options.step=(direction,options)=>{f.calls.push({direction,native:options.native});return new Promise(resolve=>finish=resolve);};
  f.api.mount(f.stage,f.options);const strip=f.stage.children[0];assert.equal(f.api.claim(f.stage),'native');strip.scrollLeft=0;
  assert.equal(f.api.claim(f.stage),'queued');assert.deepEqual(f.calls,[{direction:1,native:true}]);strip.handlers.get('scrollend')();assert.equal(f.calls.length,1);
  finish();await new Promise(resolve=>setImmediate(resolve));assert.equal(f.api.claim(f.stage),'queued','An older load ending cannot unlock a strip used by a newer queued target');assert.equal(strip.scrollLeft,0);
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
test('released touch swipes still select a neighbour when native scrolling is cancelled or reports no completion',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 for(const mobile of [false,true])for(const english of [false,true])for(const dx of [-120,120]){
  const f=fixture({mobile,english,scrollEnd:true});f.api.mount(f.stage,f.options);const strip=f.stage.children[0];f.api.note(f.stage,dx);strip.handlers.get('scrollend')();assert.equal(f.calls.length,0);
  t.mock.timers.tick(179);assert.equal(f.calls.length,0);t.mock.timers.tick(1);await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(f.calls,[{direction:dx>0?1:-1,native:true}]);strip.handlers.get('scrollend')();assert.equal(f.calls.length,1,'A late browser completion cannot advance twice');
 }
 const hidden=fixture({mobile:true,scrollEnd:true,width:0});hidden.api.mount(hidden.stage,hidden.options);hidden.stage.children[0].clientWidth=360;hidden.api.note(hidden.stage,120);t.mock.timers.tick(180);assert.equal(hidden.calls.length,1,'Opening while hidden must not permanently retain a zero-width strip');
 const closed=fixture({mobile:true,scrollEnd:true});closed.api.mount(closed.stage,closed.options);closed.api.note(closed.stage,120);closed.api.reset();t.mock.timers.tick(500);assert.equal(closed.calls.length,0);
});
