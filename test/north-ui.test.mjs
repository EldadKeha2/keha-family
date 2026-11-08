import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {setMaxListeners} from 'node:events';
import * as engine from '../public/assets/north.mjs';
import {PREPARED_HEADS} from '../public/assets/jachnun-heads.mjs';
import {headCrop} from '../public/assets/jachnun.mjs';

const source=(await readFile(new URL('../public/assets/north.js',import.meta.url),'utf8')).replace(/^import[^\n]+\n/gm,'').replace(/export function /g,'function ');
function fixture({english=false}={}){
  let now=1000,nextFrame=0,game=null,backs=0,audioCreated=0,claps=0,audioStops=0;
  const frames=new Map(),nodes=new Map(),imageRequests=[],requests=[],drawCalls=[];
  const gradient={addColorStop(){}};
  const ctx=new Proxy({createLinearGradient:()=>gradient,createRadialGradient:()=>gradient,drawImage:(image,...args)=>drawCalls.push({src:image.url,args})},{get:(target,key)=>key in target?target[key]:()=>{}});
  class Surface{
    constructor(dataset={}){this.handlers=new Map();this.dataset=dataset;this.style={setProperty(){}};this.attributes={};this.hidden=false;this.disabled=false;this.width=engine.WORLD_WIDTH;this.height=engine.WORLD_HEIGHT;this.innerHTML='';this.textContent='';this.focused=false;}
    addEventListener(type,callback,options={}){if(!this.handlers.has(type))this.handlers.set(type,new Set());this.handlers.get(type).add(callback);if(options.signal){setMaxListeners(0,options.signal);options.signal.addEventListener('abort',()=>this.handlers.get(type).delete(callback),{once:true});}}
    emit(type,event={}){for(const fn of [...(this.handlers.get(type)||[])])fn(event);}
    setAttribute(key,value){this.attributes[key]=value;}
    getContext(){return ctx;}
    focus(){this.focused=true;}
    scrollIntoView(){}
    setPointerCapture(){}
    getBoundingClientRect(){return {left:10,top:20,width:engine.WORLD_WIDTH,height:engine.WORLD_HEIGHT};}
  }
  const root=new Surface();root.classList={add(){},remove(){}};
  root.querySelector=selector=>{
    const marker=selector.startsWith('[')?selector.slice(1,-1).split('=')[0]:selector.slice(1);
    if(!root.innerHTML.includes(marker))return null;
    if(!nodes.has(selector))nodes.set(selector,new Surface());return nodes.get(selector);
  };
  const arrows=[new Surface({northSteer:'-1'}),new Surface({northSteer:'1'})];
  root.querySelectorAll=selector=>selector==='[data-north-steer]'?arrows:selector==='[data-north-relative]'?[...root.innerHTML.matchAll(/data-north-relative="([^"]+)"/g)].map(match=>new Surface({northRelative:match[1]})):[];
  const document=new Surface();document.visibilityState='visible';document.documentElement={hasAttribute:()=>false};document.querySelector=()=>null;
  const window=new Surface();window.matchMedia=()=>({matches:false});window.FAMILY_DATA={people:{}};window.FamilyI18n={isEnglish:english,personName:p=>english?(p.nameEn||p.name||p.id):(p.name||p.nameEn||p.id),fetch:async(...args)=>{requests.push(args);throw Error('Unexpected API request');}};
  window.AudioContext=class{
    constructor(){audioCreated++;this.state='running';this.sampleRate=100;this.currentTime=0;this.destination={};}
    createBuffer(_channels,size){return {getChannelData:()=>new Float32Array(size)};}
    createBufferSource(){return {connect(){},start(){claps++;},stop(){audioStops++;}};}
    createGain(){return {gain:{value:0},connect(){}};}
    createBiquadFilter(){return {frequency:{value:0},Q:{value:0},connect(){}};}
  };
  class Image{
    constructor(){this.complete=true;this.naturalWidth=512;this.naturalHeight=512;}
    set src(value){this.url=value;imageRequests.push(value);this.onload?.();}
  }
  vm.runInNewContext(source+'\nwindow.test={mountNorth,pauseNorth};',{
    ...engine,PREPARED_HEADS,headCrop,window,document,Image,AbortController,performance:{now:()=>now},
    createTrip(){game=engine.createTrip(123,{traffic:false});return game;},
    requestAnimationFrame(fn){const id=++nextFrame;frames.set(id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id)
  });
  const target=selector=>({closest:pattern=>pattern.split(',').includes(selector)?selector==='[data-north-steer]'?arrows[1]:root.querySelector(selector):null});
  const event=(selector,overrides={})=>({target:target(selector),isPrimary:true,button:0,pointerId:1,detail:1,preventDefault(){},...overrides});
  return {root,nodes,frames,requests,imageRequests,drawCalls,document,window,arrows,get html(){return root.innerHTML;},get game(){return game;},get backs(){return backs;},get audioCreated(){return audioCreated;},get claps(){return claps;},get audioStops(){return audioStops;},
    mount(){window.test.mountNorth(root,()=>backs++);},unmount(){window.test.pauseNorth();},
    click(selector,overrides={}){root.emit('click',event(selector,overrides));},
    key(code,{repeat=false,field=null}={}){let prevented=false;document.emit('keydown',{code,repeat,target:{closest:pattern=>field&&pattern.split(',').includes(field)?{}:null},preventDefault(){prevented=true;}});return prevented;},
    keyup(code){document.emit('keyup',{code});},
    doubleClick(){root.emit('dblclick',event('[data-north-board]'));},
    pointer(type,selector,overrides={}){root.emit(type,event(selector,{pointerType:'touch',clientX:240,...overrides}));},
    release(){document.emit('pointerup',{});},
    advance(ms){const end=now+ms;while(now<end){now=Math.min(end,now+1000/60);const pending=[...frames.values()];frames.clear();for(const callback of pending)callback(now);}},
    jumpFrame(ms){now+=ms;const pending=[...frames.values()];frames.clear();for(const callback of pending)callback(now);},
    visibility(value){document.visibilityState=value;document.emit('visibilitychange');},blur(){window.emit('blur');}
  };
}

test('both memorial intros retain Roi’s tribute and timer while removing the instruction sidebar and fictional family art',()=>{
  for(const english of [false,true]){
    const f=fixture({english});f.mount();assert.match(f.html,english?/Heading North/:/נוסעים לצפון/);assert.match(f.html,english?/In loving memory of Roei Elharizi/:/לזכרו של רועי אלחריזי/);
    assert.match(f.html,/data-north-time[^>]*>3:00/);assert.doesNotMatch(f.html,/north-guide|north-tip|north-route-card|north-rules|Two collisions|Three collisions|שתי התנגשויות|שלוש התנגשויות/);
    assert.equal(f.frames.size,0);assert.equal(f.audioCreated,0);assert.equal(f.requests.length,0);
    for(const file of ['roi-profile.webp','cruze-roi-v2.webp','roi-stop-v2.webp'])assert.ok(f.imageRequests.includes('assets/games/north/'+file),file+' must load');
    assert.equal(f.imageRequests.filter(path=>path.startsWith('assets/games/heads/')).length,0,'Family heads load near arrival instead of the intro');
    assert.ok(f.imageRequests.every(path=>!path.includes('family-clapping')&&!path.includes('family-cheering')),'Fictional crowd artwork must not load');
  }
});

test('keyboard and double-click share one turbo use, while repeats and typing fields do not consume it',()=>{
  const f=fixture();f.mount();f.click('[data-north-start]');assert.equal(f.audioCreated,1);assert.equal(f.frames.size,1);f.advance(1000);
  assert.equal(f.key('Space',{repeat:true}),true);assert.equal(f.game.turboUsed,false);
  assert.equal(f.key('Space',{field:'input'}),false);assert.equal(f.game.turboUsed,false);
  f.doubleClick();assert.equal(f.game.turboUsed,true);assert.equal(f.game.turboRemaining,5);f.advance(1000);const remaining=f.game.turboRemaining;
  f.key('Space');f.click('[data-north-turbo]');f.doubleClick();assert.equal(f.game.turboRemaining,remaining);assert.equal(f.nodes.get('[data-north-turbo]').disabled,true);assert.equal(f.nodes.get('[data-north-turbos]').textContent,'0');
});

test('physical left and right work in either language, touch dragging maps into road coordinates and held controls release',()=>{
  for(const english of [false,true]){
    const f=fixture({english});f.mount();f.click('[data-north-start]');f.advance(30);const start=f.game.player.x;
    f.key('ArrowLeft');f.advance(200);f.keyup('ArrowLeft');assert.ok(f.game.player.x<start);assert.ok(Math.abs(start-f.game.player.x-engine.STEER_SPEED*.2)<.1,'Keyboard steering must match the speed used by obstacle spacing');const left=f.game.player.x;
    f.key('ArrowRight');f.advance(300);f.keyup('ArrowRight');assert.ok(f.game.player.x>left);
    f.pointer('pointerdown','[data-north-board]',{clientX:140});f.pointer('pointermove','[data-north-board]',{clientX:330});assert.equal(f.game.targetX,320);f.release();
    f.pointer('pointermove','[data-north-board]',{clientX:150});assert.equal(f.game.targetX,320,'Touch hover after release must not steer');
    f.pointer('pointerdown','[data-north-steer]');f.advance(200);f.release();const target=f.game.targetX;f.advance(200);assert.equal(f.game.targetX,target,'Released arrow must not keep steering');
  }
});

test('hidden pages, blur and unmount pause the same run without consuming time, refreshing turbo or leaving live listeners',()=>{
  const f=fixture();f.mount();f.click('[data-north-start]');f.key('Space');f.advance(1000);f.visibility('hidden');const elapsed=f.game.elapsed,remaining=f.game.turboRemaining;
  assert.equal(f.frames.size,0);assert.match(f.html,/data-phase="paused"/);f.advance(30000);f.visibility('visible');assert.equal(f.game.elapsed,elapsed);assert.equal(f.frames.size,0);
  f.click('[data-north-resume]');f.advance(500);assert.ok(f.game.elapsed>elapsed);assert.ok(f.game.turboRemaining<remaining);
  f.blur();assert.equal(f.frames.size,0);f.click('[data-north-resume]');f.advance(100);f.unmount();const paused=f.game.elapsed;assert.equal(f.frames.size,0);f.advance(30000);f.mount();assert.match(f.html,/data-phase="paused"/);assert.equal(f.game.elapsed,paused);assert.equal(f.game.turboUsed,true);
  f.click('[data-north-back]');assert.equal(f.backs,1);assert.equal(f.frames.size,0);assert.equal(f.requests.length,0);
  assert.equal([...f.document.handlers.values()].reduce((total,set)=>total+set.size,0),0,'Document input listeners must be detached');
});

test('large animation gaps pause the trip, and a collision visibly stops progress while its countdown runs',()=>{
  const f=fixture();f.mount();f.click('[data-north-start]');f.advance(100);const elapsed=f.game.elapsed;f.jumpFrame(2000);assert.match(f.html,/data-phase="paused"/);assert.equal(f.game.elapsed,elapsed);
  f.click('[data-north-resume]');f.advance(30);engine.collideTrip(f.game);const distance=f.game.distance;f.advance(1000);assert.equal(f.game.distance,distance);assert.equal(f.nodes.get('[data-north-crashes]').textContent,'1');assert.equal(f.nodes.get('[data-north-toast]').hidden,false);assert.match(f.nodes.get('[data-north-toast]').textContent,/השעון ממשיך/);assert.equal(f.nodes.get('[data-north-turbo]').disabled,true);
});

test('success displays the family welcome and applause once, sound can be muted, and restarting creates a fresh journey',()=>{
  for(const english of [false,true]){
    const f=fixture({english});f.mount();f.click('[data-north-start]');f.advance(30);f.game.stationStarted=true;f.game.stationDone=true;f.game.stationElapsed=10;f.game.distance=engine.ROUTE_SECONDS-.005;f.advance(30);assert.equal(f.game.phase,'won');assert.equal(f.frames.size,0);assert.match(f.html,english?/Roei is here/:/רועי הגיע/);assert.match(f.html,/north-family-celebration/);assert.ok(f.imageRequests.filter(path=>path.startsWith('assets/games/heads/')).length>=8);assert.ok(new Set(f.drawCalls.filter(call=>call.src?.startsWith('assets/games/heads/')).map(call=>call.src)).size>=8,'Actual fixed family portraits are drawn at the finish');assert.match(f.html,/data-north-relative="ruti"/);assert.match(f.html,/data-north-relative="eldad"/);assert.match(f.html,english?/Ruth Harizi/:/רותי חריזי/);assert.equal(f.claps,75);f.advance(1000);assert.equal(f.claps,75);
    f.click('[data-north-sound]');assert.ok(f.audioStops>=75);f.click('[data-north-start]');assert.equal(f.game.elapsed,0);assert.equal(f.game.turboUsed,false);assert.equal(f.game.collisions,0);f.advance(30);f.game.stationStarted=true;f.game.stationDone=true;f.game.stationElapsed=10;f.game.distance=engine.ROUTE_SECONDS-.005;f.advance(30);assert.equal(f.game.phase,'won');assert.equal(f.claps,75,'Muted win must not play applause');
  }
});

test('timeout shows a warm retry screen and never plays the victory applause',()=>{
  const f=fixture({english:true});f.mount();f.click('[data-north-start]');f.advance(30);f.game.elapsed=engine.TRIP_LIMIT-.005;f.advance(30);assert.equal(f.game.phase,'lost');assert.match(f.html,/always saves a place for Roei/);assert.doesNotMatch(f.html,/north-family-celebration/);assert.equal(f.claps,0);assert.equal(f.frames.size,0);assert.equal(f.nodes.get('[data-north-time]').textContent,'0:00');
});


test('the midpoint station stops driving for ten seconds while the trip clock counts down, locks controls and runs only once',()=>{
  for(const english of [false,true]){
    const f=fixture({english});f.mount();f.click('[data-north-start]');f.advance(30);
    f.game.distance=engine.ROUTE_SECONDS/2-.005;f.advance(30);
    assert.equal(f.game.stationStarted,true);assert.equal(f.game.stationDone,false);assert.ok(f.game.stationRemaining>9.9&&f.game.stationRemaining<=10);
    assert.equal(f.nodes.get('[data-north-station]').hidden,false);assert.equal(f.nodes.get('[data-north-turbo]').disabled,true);for(const arrow of f.arrows)assert.equal(arrow.disabled,true);
    const distance=f.game.distance,x=f.game.player.x,target=f.game.targetX,elapsed=f.game.elapsed,remaining=f.game.stationRemaining;
    f.key('ArrowLeft');f.key('Space');f.doubleClick();f.click('[data-north-turbo]');f.click('[data-north-steer]',{detail:0});f.pointer('pointerdown','[data-north-board]',{clientX:140});f.pointer('pointermove','[data-north-board]',{clientX:330});f.release();
    f.advance(1000);f.keyup('ArrowLeft');assert.equal(f.game.distance,distance);assert.equal(f.game.player.x,x);assert.equal(f.game.targetX,target);assert.equal(f.game.turboUsed,false);assert.ok(Math.abs(f.game.elapsed-elapsed-1)<1e-6);assert.ok(Math.abs(remaining-f.game.stationRemaining-1)<1e-6);
    f.click('[data-north-pause]');const frozenTime=f.game.elapsed,frozenStation=f.game.stationRemaining;f.advance(20000);assert.equal(f.game.elapsed,frozenTime);assert.equal(f.game.stationRemaining,frozenStation);
    f.unmount();f.mount();assert.match(f.html,/data-phase="paused"/);assert.equal(f.game.stationRemaining,frozenStation);f.click('[data-north-resume]');f.advance(30);f.advance(f.game.stationRemaining*1000+30);
    assert.equal(f.game.stationDone,true);assert.equal(f.game.stationRemaining,0);assert.ok(Math.abs(f.game.stationElapsed-10)<1e-6);assert.equal(f.nodes.get('[data-north-station]').hidden,true);assert.equal(f.nodes.get('[data-north-turbo]').disabled,false);
    f.advance(1000);assert.equal(f.game.stationDone,true);assert.equal(f.game.stationElapsed,10);assert.ok(f.game.distance>distance);assert.equal(f.requests.length,0);
  }
});
