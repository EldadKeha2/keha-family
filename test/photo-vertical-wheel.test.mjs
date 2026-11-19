import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../public/assets/photo-vertical-wheel.js',import.meta.url),'utf8');
function fixture({scrollHeight=600}={}){
 let now=1000,serial=0,active=true,labels=false;const timers=new Map(),steps=[];
 const node=(parent=null,overflowY='visible')=>({parentElement:parent,clientHeight:600,scrollHeight:600,scrollTop:0,overflowY,closest(){return this.editor?this:null;},contains(target){for(let n=target;n;n=n.parentElement)if(n===this)return true;return false;},querySelector(){return labels?{}:null;}});
 const viewer=node(null,'auto');viewer.scrollHeight=scrollHeight;const stage=node(viewer),image=node(stage),metadata=node(viewer),nested=node(stage,'auto'),footer=node(viewer,'auto'),window={FamilyPhotoNative:{mouseWheelDirection:event=>event.deltaX?0:-Math.sign(event.deltaY)}};
 viewer.querySelector=selector=>selector==='.media-viewer-footer'?footer:labels?{}:null;
 vm.runInNewContext(source,{window,getComputedStyle:n=>({overflowY:n.overflowY}),Date:class extends Date{static now(){return now;}},setTimeout:(fn,ms)=>{const id=++serial;timers.set(id,{fn,at:now+ms});return id;},clearTimeout:id=>timers.delete(id)});
 const api=window.FamilyPhotoVerticalWheel.bind(stage,{root:()=>viewer,enabled:()=>active,step:(direction,input)=>steps.push({direction,input})});
 const wheel=(dy,extra={})=>{const event={target:image,deltaX:0,deltaY:dy,deltaMode:0,cancelable:true,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},...extra};return {handled:api.handle(event),event};};
 const tick=ms=>{const end=now+ms;for(;;){const next=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];if(!next||next[1].at>end)break;now=next[1].at;timers.delete(next[0]);next[1].fn();}now=end;};
 return {api,viewer,stage,image,metadata,nested,footer,steps,wheel,tick,set active(value){active=value;},set labels(value){labels=value;}};
}

test('continuous pad scrolling reaches the people tags without changing photos, including its tail at the bottom',()=>{
 const f=fixture({scrollHeight:900});
 for(const dy of [30,60,80,100,60,40]){const {event}=f.wheel(dy,{momentum:false});assert.equal(event.defaultPrevented,true);f.tick(45);}
 assert.equal(f.viewer.scrollTop,300);f.wheel(20,{momentum:true});f.tick(600);assert.deepEqual(f.steps,[]);
 assert.equal(f.viewer.scrollTop,300,'Reaching the bottom cannot turn the rest of this scroll into a swipe');
});

test('metadata, editable controls and an open Labels dropdown retain ordinary mouse and pad scrolling',()=>{
 const f=fixture({scrollHeight:1000});
 for(const extra of [{},{deltaMode:1},{wheelDeltaY:-120}])assert.equal(f.wheel(100,{target:f.metadata,...extra}).event.defaultPrevented,false);
 f.image.editor=true;assert.equal(f.wheel(100,{deltaMode:1}).event.defaultPrevented,false);f.image.editor=false;
 f.labels=true;assert.equal(f.wheel(100,{deltaMode:1}).event.defaultPrevented,false);f.tick(1000);assert.deepEqual(f.steps,[]);
});

test('real wheel notches keep both navigation directions above the photograph even when the viewer can scroll',()=>{
 const f=fixture({scrollHeight:1200});
 for(const extra of [{deltaMode:1,momentum:false},{deltaMode:2,momentum:false},{wheelDeltaY:120,momentum:false}]){assert.equal(f.wheel(-53,extra).event.defaultPrevented,true);assert.equal(f.wheel(53,extra).event.defaultPrevented,true);}
 assert.deepEqual(f.steps.map(s=>s.direction),[1,-1,1,-1,1,-1]);assert.ok(f.steps.every(s=>s.input==='mouse-wheel'));assert.equal(f.viewer.scrollTop,0);
});

test('ambiguous 100px packets and vertical diagonal pad motion scroll instead of masquerading as mouse notches',()=>{
 const f=fixture({scrollHeight:1200});
 f.wheel(100);f.wheel(90,{deltaX:2});f.wheel(40,{wheelDeltaY:-120});assert.equal(f.viewer.scrollTop,230);f.tick(600);assert.deepEqual(f.steps,[]);
});

test('a nested scroller consumes movement first and then chains to the surrounding viewer',()=>{
 const f=fixture({scrollHeight:1000});f.nested.scrollHeight=700;
 f.wheel(100,{target:f.nested});assert.equal(f.nested.scrollTop,100);assert.equal(f.viewer.scrollTop,0);
 f.wheel(80,{target:f.nested});assert.equal(f.viewer.scrollTop,80);f.wheel(10,{target:f.nested,momentum:true});assert.deepEqual(f.steps,[]);
});

test('the fixed desktop photo can scroll its separate people-and-tags footer without moving to the next photo',()=>{
 const f=fixture();f.viewer.overflowY='hidden';f.footer.scrollHeight=1000;
 f.wheel(100);f.wheel(80);assert.equal(f.viewer.scrollTop,0);assert.equal(f.footer.scrollTop,180);f.tick(600);assert.deepEqual(f.steps,[]);
});

test('a short released pad flick navigates once only when there is no scrolling room in that direction',()=>{
 for(const sign of [-1,1]){
  const f=fixture();f.wheel(sign*90,{momentum:false});f.tick(20);f.wheel(sign*12,{momentum:true});
  assert.deepEqual(f.steps,[{direction:-sign,input:'pad-vertical'}]);f.tick(100);f.wheel(sign*6,{momentum:true});f.tick(600);assert.equal(f.steps.length,1,'Momentum must not approve another photo');
 }
 const scrollable=fixture({scrollHeight:900});scrollable.wheel(90,{momentum:false});scrollable.tick(20);scrollable.wheel(12,{momentum:true});assert.deepEqual(scrollable.steps,[]);assert.equal(scrollable.viewer.scrollTop,102);
});

test('sustained contact and silent held fingers never become a release, even when no scrolling room remains',()=>{
 for(const pause of [260,1200]){
  const f=fixture();f.wheel(100,{momentum:false});f.tick(pause);f.wheel(70,{momentum:false});f.tick(20);f.wheel(12,{momentum:true});f.tick(500);assert.deepEqual(f.steps,[]);
 }
 const isolated=fixture();isolated.wheel(120);isolated.tick(1000);assert.deepEqual(isolated.steps,[]);
});

test('browsers without momentum flags require falling samples and confirmation; renewed contact cancels the flick',()=>{
 for(const renewed of [false,true]){
  const f=fixture();for(const dy of [90,40,12]){f.wheel(dy);f.tick(20);}
  assert.deepEqual(f.steps,[]);
  if(renewed){f.wheel(85);f.tick(260);f.wheel(80);}
  f.tick(300);assert.equal(f.steps.length,renewed?0:1);
 }
});

test('cancellation, modifiers, unrelated horizontal input and a disabled viewer cannot commit a delayed flick',()=>{
 for(const cancel of [f=>f.api.reset(),f=>{f.active=false;},f=>f.wheel(5,{ctrlKey:true}),f=>f.wheel(0,{deltaX:80}),f=>f.wheel(10,{target:f.metadata})]){
  const f=fixture();for(const dy of [90,40,12]){f.wheel(dy);f.tick(15);}cancel(f);f.tick(500);assert.deepEqual(f.steps,[]);
 }
 const f=fixture({scrollHeight:1000});assert.equal(f.wheel(80,{cancelable:false}).event.defaultPrevented,false);assert.equal(f.viewer.scrollTop,0);assert.deepEqual(f.steps,[]);
});
