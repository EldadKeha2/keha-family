import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../public/assets/photo-zoom-pad.js',import.meta.url),'utf8');
function fixture({direction=1}={}){
 let time=0,serial=0,enabled=true,starts=0;
 const timers=new Map(),steps=[],position={x:500,y:300},classes=new Set(),attributes=new Map();
 const window=new EventTarget(),document=new EventTarget(),stage={clientWidth:1000,classList:{add:name=>classes.add(name),remove:name=>classes.delete(name)},setAttribute:(key,value)=>attributes.set(key,value)};
 window.FamilyGalleryInput={wheelDelta:dx=>dx*direction};
 window.FamilyPhotoNative={wheelSample:()=>({episode:{}}),finishWheelEpisode(){}};
 class ClockDate extends Date{static now(){return time;}}
 vm.runInNewContext(source,{window,document,Date:ClockDate,setTimeout:(fn,ms)=>{const id=++serial;timers.set(id,{fn,at:time+ms});return id;},clearTimeout:id=>timers.delete(id)});
 const api=window.FamilyPhotoZoomPad.bind(stage,{enabled:()=>enabled,pan:(dx,dy)=>{position.x+=dx;position.y+=dy;},start:()=>starts++,step:(direction,options)=>steps.push({direction,options,at:time})});
 return {api,steps,position,classes,attributes,window,document,get starts(){return starts;},enabled:value=>{enabled=value;},
  advance(ms){const end=time+ms;while(true){const next=[...timers].filter(([,task])=>task.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;time=next[1].at;timers.delete(next[0]);next[1].fn();}time=end;},
  wheel(dx,extra={}){const event={deltaX:dx,deltaY:0,deltaMode:0,cancelable:true,preventDefault(){this.defaultPrevented=true;},...extra};event.handled=api.handle(event);return event;}
 };
}

test('sustained horizontal pad movement pans immediately, including direction changes, and never navigates',()=>{
 const f=fixture();for(let i=0;i<8;i++){assert.equal(f.wheel(i<4?20:-10,{deltaY:2,momentum:false}).handled,true);f.advance(65);}
 assert.deepEqual(f.position,{x:540,y:316});assert.equal(f.starts,1);assert.equal(f.steps.length,0);f.advance(200);assert.equal(f.steps.length,0);assert.equal(f.api.isActive(),false);
});

test('a short physical flick waits for its momentum release signal, then selects exactly one photo',()=>{
 const f=fixture({direction:-1});f.wheel(35,{momentum:false});f.advance(20);f.wheel(65,{momentum:false});
 assert.equal(f.steps.length,0);assert.equal(f.position.x,600);f.advance(20);f.wheel(18,{momentum:true});
 assert.equal(f.steps.length,1);assert.equal(f.steps[0].direction,-1);assert.equal(f.api.isActive(),false);
 f.enabled(false);for(const dx of [12,8,3,1]){f.advance(60);assert.equal(f.wheel(dx,{momentum:true}).handled,true);}
 assert.equal(f.steps.length,1,'Momentum after a new fitted photo cannot select another photo');
});

test('legacy pads require a short fast falling tail; a large isolated packet or a quiet held finger only pans',()=>{
 const f=fixture();for(const dx of [16,56,80,36,12]){f.wheel(dx);f.advance(16);}
 assert.equal(f.steps.length,0);f.advance(73);assert.equal(f.steps.length,0);f.advance(1);assert.equal(f.steps.length,1);
 const isolated=fixture();isolated.wheel(160);isolated.advance(500);assert.equal(isolated.steps.length,0);
 const held=fixture();for(const dx of [60,35,10]){held.wheel(dx,{momentum:false});held.advance(20);}held.advance(500);assert.equal(held.steps.length,0);
});

test('continued contact cancels an apparent release, while a long stroke cannot turn its final tail into a flick',()=>{
 const f=fixture();for(const dx of [80,35,10]){f.wheel(dx);f.advance(20);}f.wheel(75);f.advance(70);
 for(let i=0;i<5;i++){f.wheel(50);f.advance(70);}for(const dx of [20,6]){f.wheel(dx);f.advance(16);}f.advance(500);assert.equal(f.steps.length,0);
 const reverse=fixture();reverse.wheel(100);reverse.advance(20);reverse.wheel(-20);reverse.advance(20);reverse.wheel(-5,{momentum:true});assert.equal(reverse.steps.length,0);
});

test('pan pauses stay in the same photo and a later separate flick can navigate again',()=>{
 const f=fixture();f.wheel(90,{momentum:false});f.advance(150);f.wheel(90,{momentum:false});f.advance(20);f.wheel(15,{momentum:true});assert.equal(f.steps.length,0);
 f.advance(550);f.wheel(-90,{momentum:false});f.advance(20);f.wheel(-15,{momentum:true});assert.equal(f.steps.length,1);assert.equal(f.steps[0].direction,-1);
});

test('pinch, vertical input, disabled editing and hidden pages never turn a pan into navigation',async()=>{
 const f=fixture();assert.equal(f.wheel(0,{deltaY:80}).handled,false);assert.equal(f.wheel(80,{ctrlKey:true}).handled,false);assert.equal(f.wheel(80,{metaKey:true}).handled,false);assert.equal(f.position.x,500);
 f.wheel(80);const idle=f.api.whenIdle();assert.ok(idle);f.document.hidden=true;f.document.dispatchEvent(new Event('visibilitychange'));await idle;
 f.advance(300);assert.equal(f.steps.length,0);assert.equal(f.api.isActive(),false);
 f.enabled(false);assert.equal(f.wheel(100).handled,false);assert.equal(f.steps.length,0);
});
