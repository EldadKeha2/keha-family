import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
import * as engine from '../public/assets/ruti-house-engine.mjs';
import * as motion from '../public/assets/ruti-house-motion.mjs';
import {PLANT_VARIETIES,getHouseLayout,getTaskLocation,findHousePath} from '../public/assets/ruti-house-scene.mjs';
import {rutiHouseScore} from '../src/ruti-house-scores.mjs';
import * as character from '../public/assets/ruti-house-character.mjs';
import {HOUSE_LESSONS} from '../public/assets/ruti-house-lessons.mjs';

const source=(await readFile(new URL('../public/assets/ruti-house.js',import.meta.url),'utf8')).replace(/^import[^\n]+\n/gm,'').replace(/export function /g,'function ');
const required=t=>t.type==='guest'?(t.food||'serve'):({plant:'water',dust:'broom',cat:'hand'}[t.type]);
function completeEngineTask(g){
  if(g.tasks.length){
    const t=g.tasks.find(t=>g.stage.requiredMeal&&!g.requiredMealComplete&&t.type==='guest')||g.tasks[0];
    engine.selectTool(g,required(t));engine.actHouse(g,t.id);
  }else engine.advanceHouse(g,.1);
}
function gameAt(level){
  const g=engine.createHouse({random:()=>.5});let steps=0;
  while(g.level<level&&steps++<100000){if(g.phase==='stage-complete')engine.advanceStage(g);else completeEngineTask(g);}
  assert.equal(g.level,level,'fixture must complete each stage and its guest objective before advancing');g.events=[];return g;
}

function fixture({english=false,startLevel=1,failSave=false,initialScores=[],width=960,height=600,speech=false}={}){
  let now=100000,sequence=0,backs=0,game=null,actor=null,html='',saveStatus=failSave?503:200;
  const nodes=new Map(),listeners=new Map(),frames=new Map(),requests=[],writes=[],sounds=[],audioEvents=[],spoken=[],draws=[];let audioStops=0;
  const register=(target,type,fn,{signal}={})=>{const key=`${target}.${type}`;if(!listeners.has(key))listeners.set(key,new Set());listeners.get(key).add(fn);signal?.addEventListener('abort',()=>listeners.get(key)?.delete(fn),{once:true});};
  const emit=(target,type,event={})=>{for(const fn of [...listeners.get(`${target}.${type}`)||[]])fn(event);};
  const context=new Proxy({},{get:(target,key)=>key in target?target[key]:()=>{}});
  const body=()=>html+[...nodes.values()].map(n=>n.innerHTML).join('');
  function node(dataset={}){const classes=new Set();return {dataset,width,height,style:{setProperty(name,value){this[name]=value;}},classList:{add(value){classes.add(value);},remove(value){classes.delete(value);},toggle(value,on){if(on===undefined)on=!classes.has(value);if(on)classes.add(value);else classes.delete(value);return on;},contains(value){return classes.has(value);}},textContent:'',innerHTML:'',hidden:false,disabled:false,attributes:{},setAttribute(name,value){this.attributes[name]=value;},getContext:()=>context,focus(){},scrollIntoView(){},animate(){},getBoundingClientRect:()=>({left:0,top:0,width,height})};}
  const root={classList:{add(){},remove(){}},addEventListener:(type,fn,options)=>register('root',type,fn,options),get innerHTML(){return html;},set innerHTML(value){html=value;nodes.clear();},querySelector(selector){
    const present=selector.startsWith('[')?body().includes(selector.slice(1,-1)):body().includes(selector.slice(1));if(!present)return null;
    if(!nodes.has(selector))nodes.set(selector,node());const found=nodes.get(selector);if(selector==='[data-rh-begin-stage]'){const tag=body().match(/<button[^>]*data-rh-begin-stage[^>]*>/)?.[0]||'';found.disabled=/\sdisabled(?:\s|>)/.test(tag);}return found;
  },querySelectorAll(selector){
    if(selector==='[data-rh-tool]')return [...new Set([...html.matchAll(/data-rh-tool="([^"]+)"/g)].map(m=>m[1]))].map(id=>{const key=`[data-rh-tool="${id}"]`;if(!nodes.has(key))nodes.set(key,node({rhTool:id}));return nodes.get(key);});
    if(selector==='[data-rh-target]')return [...new Set([...body().matchAll(/data-rh-target="([^"]+)"/g)].map(m=>m[1]))].map(id=>{const key=`[data-rh-target="${id}"]`;if(!nodes.has(key))nodes.set(key,node({rhTarget:id}));return nodes.get(key);});return [];
  }};
  const document={hidden:false,visibilityState:'visible',documentElement:{hasAttribute:()=>false},addEventListener:(type,fn,options)=>register('document',type,fn,options)};
  const window={devicePixelRatio:1,FAMILY_API_TOKEN:'test-token',matchMedia:()=>({matches:false}),addEventListener:(type,fn,options)=>register('window',type,fn,options),FamilyI18n:{isEnglish:english,fetch:async(path,options)=>{
    requests.push({path,options});if(options?.method==='POST'){const entry=JSON.parse(options.body);writes.push(entry);return Response.json(saveStatus===200?{saved:true,rank:1,scores:[{...entry,id:entry.requestId}]}:{error:'שמירה נכשלה'},{status:saveStatus});}
    if(path.endsWith('/scores'))return Response.json({scores:initialScores});return Response.json({person:{profile:`/media/${path.split('/')[2]}.webp`}});
  }}};
  class Image{constructor(){this.complete=true;this.naturalWidth=100;}set src(value){this.url=value;queueMicrotask(()=>this.onload?.());}}
  class Utterance{constructor(text){this.text=text;}}
  const synthesis=speech?{getVoices:()=>[{name:english?'Samantha':'Carmit',lang:english?'en-US':'he-IL'}],speak(utterance){spoken.push(utterance.text);utterance.onstart?.();utterance.onend?.();},cancel(){}}:null;
  const audio={unlock(){return Promise.resolve(true);},setEnabled(){},stop(){audioStops++;},play(kind){sounds.push(kind);audioEvents.push({kind,action:actor?.action,walking:!!actor?.walking,progress:actor?.actionProgress,plants:game?.stats.plants,dust:game?.stats.dust});}};
  vm.runInNewContext(source+'\nwindow.test={mountRutiHouse,pauseRutiHouse,state,render,processEvents,tutorialGuide:typeof tutorialGuide==="function"?tutorialGuide:null};',{
    ...engine,...motion,...character,HOUSE_LESSONS,window,document,Image,Response,AbortController,crypto:webcrypto,performance:{now:()=>now},
    createRutiPerformance:options=>character.createRutiPerformance({...options,synthesis,Utterance:speech?Utterance:null}),createHouse(){game=gameAt(startLevel);return game;},createHouseActor(start){actor=motion.createHouseActor(start);return actor;},
    PLANT_VARIETIES,getHouseLayout,getTaskLocation,findHousePath,renderHouse(_ctx,g,visual){draws.push({level:g.level,phase:g.phase,actor:{...visual.actor},quiet:visual.quiet,showTaskLabels:visual.showTaskLabels?{...visual.showTaskLabels}:null});},
    drawRutiCelebration(_ctx,visual){draws.push({celebration:true,progress:visual.progress,actor:{...visual.actor}});},createSceneAssets:()=>({family:{},icons:{},ready:Promise.resolve()}),houseArtwork:()=>'<svg></svg>',iconArtwork:id=>`<svg data-icon="${id}"></svg>`,createHouseSound:()=>audio,createRutiSong:()=>({mount(){},stop(){},pause(){},setEnabled(){}}),
    requestAnimationFrame(fn){const id=++sequence;frames.set(id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id)
  });
  const flush=()=>new Promise(resolve=>setImmediate(resolve));
  return {root,nodes,frames,requests,writes,sounds,audioEvents,spoken,draws,document,window,flush,get audioStops(){return audioStops;},get game(){return game;},get actor(){return actor;},get state(){return window.test.state;},get html(){return html;},get backs(){return backs;},
    mount(){window.test.mountRutiHouse(root,()=>backs++);},async start(acknowledge=true){this.mount();await flush();await this.click('[data-rh-start]');if(acknowledge)await this.acknowledge();},async acknowledge(){if(this.state.briefing){await this.click('[data-rh-understand-answer]',{rhUnderstandAnswer:'0'});await this.click('[data-rh-begin-stage]');}},
    async click(selector,dataset={}){emit('root','click',{target:{closest:s=>s===selector?{dataset}:null}});await flush();},
    async choose(id){await this.click('[data-rh-tool]',{rhTool:id});},async act(id){await this.click('[data-rh-target]',{rhTarget:id});},
    key(code,{editable=false}={}){let prevented=false;emit('document','keydown',{code,target:{closest:()=>editable?{}:null},preventDefault(){prevented=true;}});return prevented;},
    visibility(hidden){document.hidden=hidden;document.visibilityState=hidden?'hidden':'visible';emit('document','visibilitychange');},blur(){emit('window','blur');},
    advance(ms){const end=now+ms;while(now<end){now=Math.min(end,now+1000/60);const callbacks=[...frames.values()];frames.clear();for(const fn of callbacks)fn(now);}},jump(ms){now+=ms;},
    until(predicate,maxMs=20000){let elapsed=0;while(!predicate()&&elapsed<maxMs){this.advance(50);elapsed+=50;}assert.ok(predicate(),`Expected game transition within ${maxMs}ms`);return elapsed;},
    input(value){emit('root','input',{target:{value,matches:s=>s==='[data-rh-name]'}});},async submit(){emit('root','submit',{preventDefault(){},target:{matches:s=>s==='[data-rh-score-form]'}});await flush();},
    allowSave(){saveStatus=200;},listenerCount(target,type){return listeners.get(`${target}.${type}`)?.size||0;}
  };
}
const toast=f=>f.nodes.get('[data-rh-toast]')?.textContent||'';

function introCopy(html){return html.split('<section class="rh-leaderboard"')[0];}
async function finishWateringStage(f){
  let steps=0;
  while(f.game.phase==='playing'&&steps++<6000){
    if(!f.state.motion.busy&&f.game.tasks.length){const target=[...f.game.tasks].sort((a,b)=>(a.untimed?Infinity:a.remaining)-(b.untimed?Infinity:b.remaining))[0];await performTask(f,target);}f.advance(100);
  }
  assert.equal(f.game.phase,'stage-complete','thirty waterings must finish through ordinary controls');
}
async function performTask(f,task){
  const selected=required(task);
  if(f.game.selected!==selected||f.actor.tool!==selected)await f.choose(selected);
  await f.act(task.id);
}

test('the original bilingual opening remains about Ruti’s home without stage promises, even with a populated leaderboard',async()=>{
  for(const english of [false,true]){
    const f=fixture({english,initialScores:[{id:'a'.repeat(32),name:'Champion',score:1000,meals:2,snacks:1,level:10,completedLevels:10}]});f.mount();await f.flush();
    const opening=introCopy(f.html);assert.match(opening,english?/A warm home\. A big heart\. A moment to rest\?/:/בית קטן\. לב ענק\. רגע של מנוחה\?/);
    assert.match(opening,english?/The plants are thirsty/:/העציצים צמאים/);assert.match(opening,english?/Open the house/:/פותחים את הבית/);assert.doesNotMatch(opening,english?/\b(?:level|stage|chapter)s?\b/i:/שלב/);
    assert.match(f.nodes.get('[data-rh-leaderboard]').innerHTML,/Champion/);assert.equal(f.requests.filter(r=>r.path.endsWith('/scores')).length,1);
  }
});

test('every newly introduced mechanic asks the player to demonstrate understanding before any stage clock can start',async()=>{
  for(const english of [false,true])for(const level of Object.keys(HOUSE_LESSONS).map(Number)){
    const f=fixture({english,startLevel:level});await f.start(false);assert.equal(f.state.briefing,true);assert.equal(f.state.understood,false);assert.equal(f.frames.size,0);const before=JSON.stringify({elapsed:f.game.elapsed,tasks:f.game.tasks,kitchen:f.game.kitchen});f.advance(120000);assert.equal(JSON.stringify({elapsed:f.game.elapsed,tasks:f.game.tasks,kitchen:f.game.kitchen}),before);
    assert.equal(f.root.querySelector('[data-rh-begin-stage]').disabled,true);await f.click('[data-rh-begin-stage]');assert.equal(f.state.briefing,true);assert.equal(f.frames.size,0);
    await f.click('[data-rh-understand-answer]',{rhUnderstandAnswer:'1'});assert.equal(f.state.understood,false);assert.equal(f.root.querySelector('[data-rh-begin-stage]').disabled,true);assert.equal(f.game.strikes,0);
    await f.click('[data-rh-understand-answer]',{rhUnderstandAnswer:'0'});assert.equal(f.state.understood,true);assert.equal(f.root.querySelector('[data-rh-begin-stage]').disabled,false);await f.click('[data-rh-begin-stage]');assert.equal(f.state.briefing,false);assert.equal(f.frames.size,1);
  }
  for(const level of Array.from({length:10},(_,i)=>i+1).filter(level=>!HOUSE_LESSONS[level])){const f=fixture({startLevel:level});await f.start(false);assert.equal(f.state.briefing,false);assert.equal(f.frames.size,1);}
});

test('the first stage shows only two tools and four unnamed pots, starts safely and completes after thirty physical household tasks',async()=>{
  for(const english of [false,true]){
    const f=fixture({english});await f.start();const first=f.game.tasks[0];assert.equal(f.game.level,1);assert.equal(f.game.stage.goal,30);assert.equal(f.game.tasks.length,1);assert.equal(first.type,'plant');assert.equal(first.untimed,true);assert.equal(f.actor.tool,null);assert.equal(f.game.selected,null);
    assert.deepEqual(f.root.querySelectorAll('[data-rh-tool]').map(b=>b.dataset.rhTool),['water','broom']);
    assert.equal(f.nodes.get('[data-rh-tool="water"]').disabled,false);assert.equal(f.nodes.get('[data-rh-tool="broom"]').disabled,false);assert.equal(f.nodes.get('[data-rh-tool="water"]').classList.contains('rh-tool-guide'),true);assert.match(f.nodes.get('[data-rh-hint]').textContent,english?/watering can/i:/משפך/);
    assert.equal(f.root.querySelector('[data-rh-tool="serve"]'),null);assert.equal(f.root.querySelector('[data-rh-tool="peanuts"]'),null);
    const initialTargets=f.root.querySelectorAll('[data-rh-target]');assert.equal(initialTargets.length,4);assert.ok(initialTargets.every(b=>!b.dataset.rhTarget.startsWith('cook-')));
    for(const plant of PLANT_VARIETIES)assert.ok(!f.nodes.get('[data-rh-hotspots]').innerHTML.includes(english?plant.en:plant.he),'plant species names are absent from tooltips and labels');
    assert.equal(f.key('Digit3'),false);assert.equal(f.game.selected,null);for(const digit of [5,6,7,8])assert.equal(f.key(`Digit${digit}`),false);
    const remaining=first.remaining;f.advance(70000);assert.equal(f.game.tasks.length,1);assert.equal(first.remaining,remaining);assert.equal(f.game.strikes,0);assert.equal(f.game.stats.plants,0);
    const slots=[];
    for(let i=0;i<6;i++){
      f.until(()=>f.game.tasks.length>0);const task=f.game.tasks[0];assert.equal(f.game.tasks.length,1);assert.equal(task.type,'plant');assert.equal(task.untimed,true);slots.push(task.slot);
      await performTask(f,task);f.until(()=>!f.game.tasks.some(t=>t.id===task.id));assert.equal(f.game.phase,'playing');assert.equal(f.game.level,1);
    }
    assert.equal(new Set(slots.slice(0,4)).size,4);assert.equal(f.game.stageCompleted,6);assert.equal(engine.firstStagePace(f.game).untimed,false);
    await finishWateringStage(f);assert.equal(f.game.stats.plants+f.game.stats.dust,30);assert.equal(f.game.wateredSlots.length,f.game.stats.plants);assert.equal(new Set(f.game.wateredSlots).size,4);assert.ok(f.game.stats.dust>0);assert.equal(f.game.stageCompleted,30);assert.equal(f.game.completedLevels,1);assert.equal(f.game.phase,'stage-complete');
  }
});

test('portrait canvases complete all four opening plant positions through the ordinary tool and target controls',async()=>{
  for(const [width,height] of [[388,544.6],[390,570],[320,500]])for(const english of [false,true]){
    const f=fixture({width,height,english});await f.start();
    const slots=[];await f.choose('water');
    for(let count=1;count<=4;count++){
      f.until(()=>f.game.tasks.some(task=>task.type==='plant'));
      const task=f.game.tasks.find(task=>task.type==='plant');slots.push(task.slot);
      await f.act(task.id);
      assert.equal(f.state.motion.busy,true,`target ${task.slot} at ${width}×${height} must start walking or watering`);
      f.until(()=>f.game.stats.plants===count,15000);
      assert.ok(f.game.score>0);assert.equal(f.actor.walking,false);assert.equal(f.actor.action,null);
    }
    assert.equal(new Set(slots).size,4,'every permanent plant is reachable from the opening and previous interaction');
  }
});

test('late first-stage waterings expire visibly, pause safely and recover without advancing the thirty-watering goal',async()=>{
  const f=fixture();await f.start();let guard=0;while(f.game.stageCompleted<24&&guard++<10000)completeEngineTask(f.game);assert.equal(f.game.stageCompleted,24);assert.equal(engine.firstStagePace(f.game).phase,3);
  f.game.tasks=[];f.game.spawnRemaining=0;f.game.typeCursor=0;f.advance(100);const task=f.game.tasks.find(t=>t.type==='plant');assert.ok(task);assert.equal(task.untimed,undefined);assert.equal(task.total,12);
  await f.click('[data-rh-pause]');const remaining=task.remaining;f.advance(60000);assert.equal(task.remaining,remaining);assert.equal(f.game.stageCompleted,24);await f.click('[data-rh-pause]');
  const missed=f.game.stats.missed;f.advance((task.remaining+.1)*1000);assert.ok(!f.game.tasks.some(t=>t.id===task.id));assert.ok(f.game.stats.missed>missed);assert.equal(f.game.stageCompleted,24);assert.equal(f.game.strikes,0);assert.ok(f.state.departures.some(d=>d.type==='plant-missed'&&d.slot===task.slot));
  // A second overlapping request may already be nearly expired. Recover on
  // a fresh request that still allows walking to it and watering.
  f.until(()=>f.game.tasks.some(t=>t.type==='plant'&&t.remaining>10));const next=f.game.tasks.find(t=>t.type==='plant'&&t.remaining>10);await performTask(f,next);f.until(()=>f.game.stageCompleted===25);assert.equal(f.game.phase,'playing');assert.equal(f.game.level,1);
});

test('selecting a tool changes it in hand instantly without moving Ruti, then tasks still require walking and watering',async()=>{
  const f=fixture();await f.start();const plant=f.game.tasks[0],start={x:f.actor.x,y:f.actor.y};await f.choose('broom');
  assert.equal(f.actor.tool,'broom');assert.equal(f.game.selected,'broom');assert.equal(f.state.motion.busy,false);assert.deepEqual({x:f.actor.x,y:f.actor.y},start);f.advance(2000);assert.deepEqual({x:f.actor.x,y:f.actor.y},start);assert.equal(f.game.stats.plants,0);
  await f.choose('water');assert.equal(f.actor.tool,'water');assert.equal(f.game.selected,'water');assert.equal(f.state.motion.busy,false);assert.deepEqual({x:f.actor.x,y:f.actor.y},start);await f.act(plant.id);
  assert.equal(f.game.stats.plants,0);assert.equal(f.state.pendingTarget,null);assert.equal(f.state.motion.busy,true);f.advance(100);assert.equal(f.game.stats.plants,0);assert.notDeepEqual({x:f.actor.x,y:f.actor.y},start);
  const elapsed=f.until(()=>f.game.stats.plants===1);assert.ok(elapsed>1000);assert.equal(f.game.score,76);assert.equal(f.game.level,1);assert.equal(f.game.phase,'playing');assert.equal(f.game.stageCompleted,1);assert.equal(f.frames.size,1);assert.ok(f.draws.some(d=>d.actor.tool==='water'&&d.actor.walking));assert.ok(f.draws.some(d=>d.actor.action==='water'&&d.actor.actionProgress>0&&d.actor.actionProgress<1));f.until(()=>f.game.tasks.length===1);assert.notEqual(f.game.tasks[0].slot,plant.slot);
});

test('switching tools during a walk or watering cancels the old task without teleporting or awarding a stale completion',async()=>{
  for(const during of ['walk','action']){
    const f=fixture();await f.start();const plant=f.game.tasks[0];await f.choose('water');await f.act(plant.id);
    if(during==='walk')f.advance(200);else f.until(()=>f.actor.action==='water'&&f.actor.actionProgress>.2);
    assert.equal(f.state.motion.busy,true);assert.equal(f.game.stats.plants,0);const where={x:f.actor.x,y:f.actor.y};await f.choose('broom');
    assert.equal(f.actor.tool,'broom');assert.equal(f.game.selected,'broom');assert.equal(f.actor.action,null);assert.equal(f.state.motion.busy,false);assert.deepEqual({x:f.actor.x,y:f.actor.y},where);f.advance(5000);
    assert.deepEqual({x:f.actor.x,y:f.actor.y},where);assert.equal(f.game.stats.plants,0);assert.equal(f.game.score,0);assert.ok(f.game.tasks.some(t=>t.id===plant.id));
    await f.choose('water');await f.act(plant.id);f.until(()=>f.game.stats.plants===1);assert.ok(f.game.score>40&&f.game.score<80);assert.equal(f.game.stageCompleted,1);
  }
});

test('reselecting the tool already in hand preserves the current walk and completes the task exactly once',async()=>{
  const f=fixture();await f.start();const plant=f.game.tasks[0];await f.choose('water');await f.act(plant.id);f.advance(200);const where={x:f.actor.x,y:f.actor.y};
  await f.choose('water');assert.equal(f.state.motion.busy,true);assert.deepEqual({x:f.actor.x,y:f.actor.y},where);assert.equal(f.actor.tool,'water');f.until(()=>f.game.stats.plants===1);f.advance(1000);assert.equal(f.game.stats.plants,1);assert.equal(f.game.score,80);
});

test('the enlarged singing broom dance waits for Next indefinitely while game clocks, score and strikes stay frozen',async()=>{
  for(const english of [false,true]){
    const f=fixture({english});await f.start();f.game.strikes=1;await finishWateringStage(f);assert.equal(f.frames.size,1);
    const score=f.game.score,elapsed=f.game.elapsed,overlay=f.nodes.get('[data-rh-overlay]').innerHTML;
    assert.match(overlay,english?/You reached Level/:/עברת לשלב/);assert.match(overlay,/data-rh-next/);assert.equal(f.state.celebrating,true);assert.equal(f.actor.celebrating,true);assert.ok(f.draws.some(d=>d.celebration));assert.equal(f.root.querySelector('.ruti-house').classList.contains('rh-quiet'),false,'the stage announcement and Next button remain readable during the dance');
    f.advance(120000);assert.equal(f.game.level,1);assert.equal(f.game.phase,'stage-complete');assert.equal(f.game.elapsed,elapsed);assert.equal(f.game.score,score);assert.equal(f.game.strikes,1);assert.equal(f.state.celebrating,true);assert.ok(f.state.celebrationElapsed>119);assert.equal(f.frames.size,1);
    const stops=f.audioStops;await f.click('[data-rh-next]');assert.equal(f.game.level,2);assert.equal(f.game.phase,'playing');assert.equal(f.game.strikes,1);assert.equal(f.game.score,score);assert.equal(f.actor.tool,null);assert.equal(f.actor.celebrating,false);assert.equal(f.state.celebrating,false);assert.ok(f.audioStops>stops);assert.equal(f.state.briefing,false,'the faster repeat adds no repeated lesson');assert.equal(f.frames.size,1);assert.equal(f.root.querySelector('.ruti-house').classList.contains('rh-quiet'),true,'ordinary play resumes with icons and progress instead of labels');
    await f.click('[data-rh-next]');assert.equal(f.game.level,2,'a second Next click cannot skip another stage');
  }
});

test('pause, hidden tabs, blur and navigation freeze both walking and the singing celebration until explicit resume',async()=>{
  const f=fixture();await f.start();await f.choose('water');await f.act(f.game.tasks[0].id);f.advance(200);assert.equal(f.state.motion.busy,true);await f.click('[data-rh-pause]');const frozen={x:f.actor.x,y:f.actor.y,elapsed:f.game.elapsed,progress:f.actor.actionProgress};assert.equal(f.frames.size,0);f.advance(60000);assert.deepEqual({x:f.actor.x,y:f.actor.y,elapsed:f.game.elapsed,progress:f.actor.actionProgress},frozen);
  await f.click('[data-rh-pause]');f.advance(150);assert.ok(f.game.elapsed>frozen.elapsed);f.visibility(true);assert.equal(f.frames.size,0);const elapsed=f.game.elapsed,x=f.actor.x;f.jump(3600000);f.visibility(false);assert.equal(f.frames.size,0);assert.equal(f.game.elapsed,elapsed);assert.equal(f.actor.x,x);await f.click('[data-rh-pause]');f.advance(100);f.blur();assert.equal(f.frames.size,0);assert.match(f.nodes.get('[data-rh-overlay]').innerHTML,/כל השעונים עצרו/);await f.click('[data-rh-pause]');
  await finishWateringStage(f);f.advance(300);const cheer=f.state.celebrationElapsed;assert.ok(cheer>0);f.visibility(true);f.advance(60000);assert.equal(f.state.celebrationElapsed,cheer);assert.equal(f.game.level,1);await f.click('[data-rh-next]');assert.equal(f.game.level,1,'Next cannot bypass a paused celebration');assert.equal(f.state.celebrating,true);f.visibility(false);assert.equal(f.frames.size,0);await f.click('[data-rh-pause]');f.advance(100);f.blur();const afterBlur=f.state.celebrationElapsed;f.advance(60000);assert.equal(f.state.celebrationElapsed,afterBlur);
  await f.click('[data-rh-back]');assert.equal(f.backs,1);assert.equal(f.listenerCount('root','click'),0);f.mount();await f.flush();assert.equal(f.listenerCount('root','click'),1);assert.equal(f.frames.size,0);assert.equal(f.state.celebrationElapsed,afterBlur);await f.click('[data-rh-pause]');f.advance(1000);assert.equal(f.game.level,1);assert.ok(f.state.celebrationElapsed>afterBlur);assert.equal(f.frames.size,1);await f.click('[data-rh-next]');assert.equal(f.game.level,2);assert.equal(f.state.briefing,false);assert.equal(f.frames.size,1);
});

test('the single Food tool serves a homemade dish directly to the guest without kitchen selection or preparation',async()=>{
  for(const english of [false,true]){
    const f=fixture({english,startLevel:6});await f.start();f.until(()=>f.game.tasks.some(t=>t.type==='guest'),30000);const guest=f.game.tasks.find(t=>t.type==='guest'),before=f.game.score,stock=f.game.inventory[guest.recipeId];await f.choose('serve');f.until(()=>!f.state.motion.busy);assert.equal(f.actor.tool,'serve');
    assert.deepEqual(f.root.querySelectorAll('[data-rh-tool]').map(b=>b.dataset.rhTool),['water','broom','hand','argue','serve']);assert.ok(f.root.querySelectorAll('[data-rh-target]').every(b=>!b.dataset.rhTarget.startsWith('cook-')));
    const initialMeals=f.game.stats.meals;await f.act(guest.id);assert.equal(f.state.motion.busy,true);assert.equal(f.actor.carryDish,guest.recipeId);assert.equal(f.game.stats.meals,initialMeals);f.advance(100);f.until(()=>f.game.stats.meals===initialMeals+1);assert.equal(f.game.inventory[guest.recipeId],stock);assert.equal(f.actor.carryDish,null);assert.ok(f.game.score-before>300&&f.game.score-before<=600);assert.equal(f.game.requiredMealComplete,true);assert.equal(f.game.stats.snacks,0);assert.equal(f.game.stats.dishes,0);assert.ok(f.draws.some(d=>d.actor.carryDish===guest.recipeId&&d.actor.walking));
  }
});

test('the third cat ends the run and v5 saves preserve stage scores, statistics and retry identifiers',async()=>{
  for(const english of [false,true]){
    const f=fixture({english,startLevel:3,failSave:true});await f.start();assert.equal(f.key('Digit3'),true);assert.equal(f.game.selected,'hand');for(const digit of [5,6,7,8])assert.equal(f.key(`Digit${digit}`),false);assert.equal(f.key('Digit1',{editable:true}),false);assert.equal(f.game.selected,'hand');f.game.tasks=[];f.game.events=[];for(let i=0;i<3;i++)f.game.tasks.push({id:`test-cat-${i}`,type:'cat',slot:i%2,door:i%2,state:'approaching',waiting:0,total:.1,remaining:.1});f.advance(300);await f.flush();assert.equal(f.game.phase,'finished');assert.equal(f.game.strikes,3);assert.equal(f.frames.size,0);assert.match(f.html,/data-rh-score-form/);
    await f.submit();assert.equal(f.writes.length,0);f.input('  Player One  ');await f.submit();assert.equal(f.writes.length,1);assert.match(f.html,english?/Could not save your score/:/שמירה נכשלה/);f.allowSave();await f.submit();assert.equal(f.writes.length,2);const payload=f.writes[1];assert.equal(payload.requestId,f.writes[0].requestId);assert.equal(payload.name,'Player One');assert.equal(payload.version,5);assert.equal(payload.completedLevels,2);assert.deepEqual(payload.stageScores,[...f.game.stageScores]);assert.equal(payload.stageScores.reduce((a,b)=>a+b,0),payload.score);assert.ok(payload.stageScores[0]>0);assert.equal(payload.level,3);assert.equal(payload.plants,f.game.stats.plants);assert.equal(payload.elapsed,Math.floor(f.game.elapsed));assert.equal(f.requests.find(r=>r.options?.method==='POST').options.headers['X-Family-Token'],'test-token');assert.match(f.html,english?/Score saved! Your rank/:/השיא נשמר! המקום שלכם/);await f.submit();assert.equal(f.writes.length,2);
  }
});

test('leaderboards escape visitor names without adding stage explanations to the opening',async()=>{
  const f=fixture({initialScores:[{id:'a'.repeat(32),name:'<img src=x onerror=alert(1)>',score:300,meals:1,snacks:0,level:10,completedLevels:10}]});f.mount();await f.flush();const table=f.nodes.get('[data-rh-leaderboard]').innerHTML;assert.match(table,/&lt;img src=x onerror=alert\(1\)&gt;/);assert.doesNotMatch(table,/<img src=x/);assert.doesNotMatch(introCopy(f.html),/שלב/);
});

test('all twelve stages remain winnable with physical movement and direct food serving, and the resulting score validates',async t=>{
  const f=fixture();await f.start();const layout=getHouseLayout(960,600),completed=new Set();
  const prioritize=tasks=>{const cats=tasks.filter(t=>t.type==='cat');if(cats.length)return cats.sort((a,b)=>(a.waiting+a.remaining)-(b.waiting+b.remaining))[0];const cost=t=>{const p=getTaskLocation(t,layout).anchor||getTaskLocation(t,layout),change=f.actor.tool===required(t)?0:1.4;return Math.hypot((p.x-f.actor.x)*1.6,p.y-f.actor.y)+change;};return [...tasks].sort((a,b)=>cost(a)-cost(b))[0];};
  let targetId=null,steps=0;
  while(f.game.phase!=='finished'&&steps++<35000){
    if(f.state.briefing){await f.acknowledge();continue;}
    if(f.game.phase==='stage-complete'){completed.add(f.game.level);await f.click('[data-rh-next]');targetId=null;continue;}
    const shown=f.root.querySelectorAll('[data-rh-tool]').map(b=>b.dataset.rhTool);assert.ok(shown.length<=6);assert.equal(shown.includes('peanuts'),f.game.level>=11);if(f.game.level===1)assert.deepEqual(shown,['water','broom']);if(f.game.level>=6)assert.deepEqual(shown,['water','broom','hand','argue','serve',...(f.game.level>=11?['peanuts']:[])]);
    const target=f.game.tasks.find(t=>t.id===targetId),cat=prioritize(f.game.tasks.filter(t=>t.type==='cat'));
    if(!f.state.motion.busy||cat&&target?.type!=='cat'){
      const neededGuest=f.game.stage.requiredMeal&&!f.game.requiredMealComplete?f.game.tasks.find(t=>t.type==='guest'):null,next=cat||neededGuest||prioritize(f.game.tasks);
      if(next){await performTask(f,next);targetId=next.id;}
    }
    f.advance(100);
  }
  assert.equal(f.state.celebrating,true);assert.match(f.nodes.get('[data-rh-overlay]').innerHTML,/הבית כולו בידיים טובות!/);assert.doesNotMatch(f.html,/data-rh-score-form/);f.advance(30000);assert.equal(f.state.celebrating,true);assert.doesNotMatch(f.html,/data-rh-score-form/);f.input('Too early');await f.submit();assert.equal(f.writes.length,0,'the final score cannot be saved until the player ends the celebration');await f.click('[data-rh-next]');assert.equal(f.state.celebrating,false);assert.equal(f.game.won,true,JSON.stringify({level:f.game.level,strikes:f.game.strikes,elapsed:f.game.elapsed,completed:[...completed],requiredMealComplete:f.game.requiredMealComplete,tasks:f.game.tasks.map(t=>({type:t.type,remaining:t.remaining,waiting:t.waiting}))}));assert.equal(f.game.completedLevels,12);assert.equal(completed.size,11);assert.ok(f.game.strikes<3);assert.equal(f.game.stageScores.reduce((a,b)=>a+b,0),f.game.score);assert.ok(f.game.stageScores.every(points=>points>0));assert.ok(f.game.stats.plants>=60);assert.equal(f.game.stats.dishes,0);assert.ok(f.game.stats.snacks>=0);assert.ok(f.game.stats.meals>=1);assert.match(f.html,/כל הבית/);assert.equal(f.frames.size,0);
  f.input('אלופת הבית');await f.submit();assert.equal(f.writes.length,1);const entry=rutiHouseScore(f.writes[0]);assert.equal(entry.version,5);assert.equal(entry.completedLevels,12);assert.equal(entry.level,12);assert.equal(entry.score,f.game.score);assert.equal(entry.name,'אלופת הבית');assert.equal(entry.stageScores.reduce((a,b)=>a+b,0),entry.score);
  t.diagnostic(`Twelve levels won in ${Math.floor(f.game.elapsed)} game seconds with ${f.game.strikes} strikes; thirty-water opening and direct guest meals completed; ${entry.score} points pass the production v5 validator.`);
});


test('watering and dust completion stay free of speech and prose from their first successful action',async()=>{
 for(const english of [false,true])for(const [kind,stat] of [['plant','plants'],['dust','dust']]){
  const f=fixture({english,speech:true});await f.start();f.spoken.length=0;
  await f.choose(kind==='plant'?'water':'broom');assert.equal(f.actor.speechText,'');assert.equal(f.actor.speaking,false);assert.equal(f.spoken.length,0,'selecting a household tool does not start spoken instructions');
  for(let count=1;count<=3;count++){
   f.game.stats[stat]=count;f.game.events.push({type:'success',kind,points:40});f.window.test.processEvents();
   assert.equal(toast(f),'');assert.equal(f.actor.speechText,'');assert.equal(f.actor.speaking,false);assert.equal(f.spoken.length,0);
  }
 }
});

 test('physical watering and sweeping audio starts once at the action, followed by a reward only after success',async()=>{
  for(const [kind,stat,selected] of [['plant','plants','water'],['dust','dust','broom']]){
    const f=fixture({speech:true});await f.start();f.spoken.length=0;
    if(kind==='dust'){f.game.tasks=[{id:'test-dust',type:'dust',slot:0,position:{x:.68,y:.6},total:24,remaining:24}];f.game.events=[];}
    const task=f.game.tasks.find(t=>t.type===kind);await f.choose(selected);await f.act(task.id);assert.equal(f.actor.walking,true);assert.equal(f.sounds.filter(sound=>sound===`${kind==='plant'?'water':'dust'}-action`).length,0,'walking toward a task is not the physical action');
    f.until(()=>f.actor.action===selected);const action=f.audioEvents.filter(event=>event.kind===`${kind==='plant'?'water':'dust'}-action`);assert.equal(action.length,1);assert.equal(action[0].action,selected);assert.equal(action[0].walking,false);assert.ok(action[0].progress<.1);assert.equal(f.sounds.filter(sound=>sound===`${kind==='plant'?'water':'dust'}-reward`).length,0);
    f.advance(150);assert.equal(f.sounds.filter(sound=>sound===`${kind==='plant'?'water':'dust'}-action`).length,1,'a continuing animation does not replay the action sound every frame');
    f.until(()=>f.game.stats[stat]===1);assert.equal(f.sounds.filter(sound=>sound===`${kind==='plant'?'water':'dust'}-reward`).length,1);const reward=f.audioEvents.find(event=>event.kind===`${kind==='plant'?'water':'dust'}-reward`);assert.equal(reward[stat],1);assert.equal(toast(f),'');assert.equal(f.actor.speechText,'');assert.equal(f.spoken.length,0);
  }
});

 test('interrupted, wrong-tool and expired targets never play a watering or dust reward',async()=>{
  for(const during of ['walking','acting']){
    const f=fixture();await f.start();const plant=f.game.tasks[0];await f.choose('water');await f.act(plant.id);
    if(during==='walking')f.advance(150);else f.until(()=>f.actor.action==='water'&&f.actor.actionProgress>.2);
    const begun=f.sounds.filter(kind=>kind==='water-action').length;assert.equal(begun,during==='walking'?0:1);await f.choose('broom');f.advance(3000);assert.equal(f.game.stats.plants,0);assert.equal(f.sounds.filter(kind=>kind.endsWith('-reward')).length,0);
    await f.act(plant.id);f.advance(150);assert.equal(f.sounds.filter(kind=>kind.endsWith('-reward')).length,0,'the wrong selected tool cannot reward a target');
  }
  const expired=fixture();await expired.start();const task=expired.game.tasks[0];await expired.choose('water');await expired.act(task.id);expired.game.tasks=[];expired.advance(5000);assert.equal(expired.game.stats.plants,0);assert.equal(expired.sounds.filter(kind=>kind==='water-reward').length,0);
});

test('guidance and captions disappear at exactly fifteen opening tasks while icons and progress stay usable',async()=>{
  for(const english of [false,true]){
    const f=fixture({english,speech:true});await f.start();assert.ok(f.nodes.get('[data-rh-hint]').textContent);assert.equal(f.draws.findLast(d=>!d.celebration).showTaskLabels?.plant,true);
    let steps=0;while(f.game.stageCompleted<14&&steps++<10000)completeEngineTask(f.game);assert.equal(f.game.stageCompleted,14);f.advance(150);
    assert.equal(f.draws.findLast(d=>!d.celebration).quiet,false);assert.equal(f.draws.findLast(d=>!d.celebration).showTaskLabels.plant,true);assert.equal(f.root.querySelector('.ruti-house').classList.contains('rh-quiet'),false);
    f.game.events.push({type:'wrong',required:'water'});f.window.test.processEvents();assert.ok(toast(f),'an instruction can still appear before the cutoff');
    f.actor.speechText='A current instruction';f.actor.speaking=true;f.spoken.length=0;
    while(f.game.stageCompleted<15&&steps++<10000)completeEngineTask(f.game);assert.equal(f.game.stageCompleted,15);f.advance(150);
    assert.equal(f.nodes.get('[data-rh-hint]').textContent,'');const visual=f.draws.findLast(d=>!d.celebration);assert.equal(visual.quiet,true);assert.equal(visual.showTaskLabels.plant,false);assert.equal(visual.showTaskLabels.dust,false);assert.equal(f.root.querySelector('.ruti-house').classList.contains('rh-quiet'),true);assert.equal(toast(f),'');assert.equal(f.actor.speechText,'');assert.equal(f.actor.speaking,false);assert.equal(f.spoken.length,0);
    await f.choose('broom');assert.equal(toast(f),'');assert.equal(f.actor.speechText,'');await f.choose('water');assert.equal(toast(f),'');assert.equal(f.actor.speechText,'');assert.equal(f.nodes.get('[data-rh-progress]').textContent,'15');
    assert.deepEqual(f.root.querySelectorAll('[data-rh-tool]').map(b=>b.dataset.rhTool),['water','broom']);
    for(const target of f.root.querySelectorAll('[data-rh-target]'))assert.ok(target.dataset.rhTarget,'accessible task controls remain available after visual guidance fades');
  }
});

test('cats introduce the hand before level three, then the first cat already uses quiet controls and physical feedback',async()=>{
  for(const english of [false,true]){
    const f=fixture({english,startLevel:3,speech:true});await f.start(false);assert.equal(f.state.briefing,true);assert.match(f.nodes.get('[data-rh-overlay]').innerHTML,english?/hand|Shoo/i:/יד|לכו מפה/);assert.equal(f.root.querySelector('.ruti-house').classList.contains('rh-quiet'),false);
    await f.acknowledge();f.spoken.length=0;assert.equal(f.nodes.get('[data-rh-hint]').textContent,'');const visual=f.draws.findLast(d=>!d.celebration);assert.equal(visual.quiet,true);assert.deepEqual(visual.showTaskLabels,{cat:false,plant:false,dust:false});
    f.until(()=>f.game.tasks.some(t=>t.type==='cat'),60000);const cat=f.game.tasks.find(t=>t.type==='cat'),before=f.game.stats.cats;await performTask(f,cat);f.until(()=>f.game.stats.cats===before+1);f.advance(150);
    assert.equal(f.nodes.get('[data-rh-hint]').textContent,'');assert.equal(toast(f),'');assert.equal(f.actor.speechText,'');assert.equal(f.actor.speaking,false);assert.equal(f.spoken.length,0);assert.ok(f.sounds.includes('cat'),'successful shooing retains its sound feedback');
    await f.choose('water');await f.choose('hand');assert.equal(toast(f),'');assert.equal(f.actor.speechText,'');assert.equal(f.spoken.length,0);assert.deepEqual(f.root.querySelectorAll('[data-rh-tool]').map(b=>b.dataset.rhTool),['water','broom','hand']);
  }
});

test('every later stage keeps normal reactions silent and unlabeled while lessons and pause screens remain readable',async()=>{
  for(const english of [false,true])for(let level=2;level<=10;level++){
    const f=fixture({english,startLevel:level,speech:true});await f.start(false);
    if(f.state.briefing){assert.equal(f.root.querySelector('.ruti-house').classList.contains('rh-quiet'),false);assert.match(f.nodes.get('[data-rh-overlay]').innerHTML,/data-rh-begin-stage/);await f.acknowledge();}
    assert.equal(f.root.querySelector('.ruti-house').classList.contains('rh-quiet'),true);assert.equal(f.nodes.get('[data-rh-hint]').textContent,'');const visual=f.draws.findLast(d=>!d.celebration);assert.equal(visual.quiet,true);assert.ok(Object.values(visual.showTaskLabels).every(value=>value===false));
    f.spoken.length=0;
    for(const event of [{type:'pace-up',phase:2},{type:'cat-approach'},{type:'wrong',required:'water'},{type:'strike',targetId:'departed-cat'},{type:'missed',kind:'plant'},{type:'missed',kind:'guest'},{type:'success',kind:'cat'},{type:'success',kind:'meal'}]){
      f.game.events.push(event);f.window.test.processEvents();assert.equal(toast(f),'',`level ${level}: ${event.type} must not add prose`);assert.equal(f.actor.speechText,'');assert.equal(f.actor.speaking,false);assert.equal(f.spoken.length,0);
    }
    await f.choose('hand');await f.choose('serve');assert.equal(toast(f),'');assert.equal(f.actor.speechText,'');assert.equal(f.spoken.length,0);assert.equal(f.nodes.get('[data-rh-progress]').textContent,String(f.game.stageCompleted));assert.ok(f.root.querySelectorAll('[data-rh-tool]').length>=2);
    await f.click('[data-rh-pause]');assert.equal(f.root.querySelector('.ruti-house').classList.contains('rh-quiet'),false);assert.match(f.nodes.get('[data-rh-overlay]').innerHTML,english?/All timers are paused/:/כל השעונים עצרו/);assert.match(f.nodes.get('[data-rh-overlay]').innerHTML,/data-rh-pause/);
    await f.click('[data-rh-pause]');assert.equal(f.root.querySelector('.ruti-house').classList.contains('rh-quiet'),true);assert.equal(f.nodes.get('[data-rh-hint]').textContent,'');
  }
});

test('identical player reactions earn identical points despite different walks, and repeat clicks preserve the response',async()=>{
  const results=[];
  for(const near of [false,true]){
    const f=fixture();await f.start();await f.choose('water');const task=f.game.tasks[0];
    if(near){const anchor=getHouseLayout(1000,580).plants[task.slot].anchor;f.actor.x=anchor.x;f.actor.y=anchor.y;}
    f.advance(2000);const responseSeconds=f.game.elapsed-task.createdAt;await f.act(task.id);f.advance(100);await f.act(task.id);
    const walkingMs=f.until(()=>f.game.stats.plants===1);
    results.push({points:f.game.score,responseSeconds,walkingMs});
  }
  assert.equal(results[0].points,76);assert.equal(results[1].points,76);
  assert.equal(results[0].responseSeconds,results[1].responseSeconds);
  assert.ok(results[0].walkingMs>results[1].walkingMs+500);
});

test('only the physical plant has a tutorial outline, never the water word hit area',async()=>{
  const f=fixture();await f.start();const buttons=f.nodes.get('[data-rh-hotspots]').innerHTML.match(/<button[^>]+>/g);
  const signal=buttons.find(b=>b.includes('aria-hidden="true"'));
  assert.ok(signal);assert.ok(!signal.includes('rh-guided-target'));
  assert.equal(buttons.filter(b=>b.includes('rh-guided-target')).length,1);
});

test('level four explains Ora with the argument icon, requires both clicks, and shows a pausable five-second bonus',async()=>{
 for(const english of [false,true]){
  const f=fixture({startLevel:4,english});await f.start(false);
  assert.match(f.nodes.get('[data-rh-overlay]').innerHTML,/data-icon="argue"/);
  assert.match(f.nodes.get('[data-rh-overlay]').innerHTML,english?/5,000 points/:/5,000 נקודות/);
  await f.acknowledge();assert.equal(f.nodes.get('[data-rh-tool="argue"]').disabled,true);
  let guard=0;while(!f.game.ora&&guard++<12000)completeEngineTask(f.game);assert.ok(f.game.ora);f.advance(100);
  const ora=f.game.ora,before=f.game.score;assert.equal(f.nodes.get('[data-rh-tool="argue"]').disabled,false);assert.equal(f.nodes.get('[data-rh-tool="argue"]').classList.contains('rh-ora-ready'),true);
  await f.act(ora.id);assert.equal(f.game.stats.oraWins,0);await f.choose('argue');await f.act(ora.id);
  assert.equal(f.game.phase,'ora-bonus');assert.equal(f.game.score-before,5000);assert.match(f.nodes.get('[data-rh-overlay]').innerHTML,english?/won the argument with Ora/:/ניצחת את אורה בוויכוח/);
  const elapsed=f.game.elapsed,deadlines=JSON.stringify(f.game.tasks);f.advance(2000);assert.equal(f.game.elapsed,elapsed);assert.equal(JSON.stringify(f.game.tasks),deadlines);
  await f.click('[data-rh-pause]');const remaining=f.game.oraBonusRemaining;f.advance(60000);assert.equal(f.game.oraBonusRemaining,remaining);await f.click('[data-rh-pause]');
  f.until(()=>f.game.phase==='playing',5000);assert.equal(f.game.stats.oraWins,1);assert.equal(f.nodes.get('[data-rh-overlay]').hidden,true);
 }
});

test('remaining lives use Ruti heads first and cat symbols from level three, with one fewer symbol per strike',async()=>{
 for(const level of [1,3]){
  const f=fixture({startLevel:level});await f.start();const lives=f.nodes.get('[data-rh-strikes]');
  assert.match(f.html,/פסילות/);assert.equal((lives.innerHTML.match(/class="rh-life-symbol"/g)||[]).length,3);
  assert.match(lives.innerHTML,level===1?/ruti-head-cutout/:/data-icon="cat"/);
  f.game.strikes=1;f.advance(200);assert.equal((lives.innerHTML.match(/class="rh-life-symbol"/g)||[]).length,2);assert.equal(lives.attributes['aria-label'],'פסילות שנותרו: 2');
 }
});

test('the upper task summary shows only successful per-type counts, conceals the target and resets each level',async()=>{
 const f=fixture();await f.start();assert.match(f.html,/מטלות שבוצעו/);assert.doesNotMatch(f.html,/\/ 30|30 מטלות|30 השקיות/);
 const tally=()=>[...f.nodes.get('[data-rh-task-tallies]').innerHTML.matchAll(/data-rh-task-count="([^"]+)">(\d+)</g)].map(m=>[m[1],Number(m[2])]);
 assert.deepEqual(tally(),[['plants',0],['dust',0]]);
 await performTask(f,f.game.tasks[0]);f.until(()=>f.game.stageCompleted===1);f.advance(150);
 assert.equal(f.nodes.get('[data-rh-progress]').textContent,'1');assert.deepEqual(tally(),[['plants',1],['dust',0]]);
 f.until(()=>f.game.tasks.length>0);const task=f.game.tasks[0];task.untimed=false;task.remaining=.01;f.advance(200);assert.ok(f.game.stats.missed>0);assert.deepEqual(tally(),[['plants',1],['dust',0]]);
 let guard=0;while(f.game.phase==='playing'&&guard++<12000)completeEngineTask(f.game);f.advance(150);assert.equal(f.game.stageResolved,30);assert.equal(f.game.stageCompleted,29);assert.equal(tally().reduce((a,[,b])=>a+b,0),29);
 await f.click('[data-rh-next]');assert.equal(f.game.level,2);assert.equal(f.nodes.get('[data-rh-progress]').textContent,'0');assert.deepEqual(tally(),[['plants',0],['dust',0]]);
});

test('tool slots and success tally slots stay fixed while only newly relevant icons appear',async()=>{
 for(const level of [1,3,4,5,6,10,11,12]){
  const f=fixture({startLevel:level});await f.start();
  const shelf=f.html.match(/<div class="rh-tools"[\s\S]*?<\/div><\/div>/)[0];
  const slots=[...shelf.matchAll(/data-rh-tool="([^"]+)"|class="rh-tool-slot"/g)].map(m=>m[1]||null);
  assert.equal(slots.length,6);assert.deepEqual(slots,engine.TOOLS.map(t=>f.game.unlockedTools.includes(t.id)?t.id:null));
  const tally=f.nodes.get('[data-rh-task-tallies]').innerHTML;assert.equal((tally.match(/class="rh-task-tally"|class="rh-tally-slot"/g)||[]).length,6);
  assert.doesNotMatch(f.html,/rh-stage-road|\/ 10|\/ 12|עשרת|twelve levels|ten levels|30 מטלות|\/ 30/);
  if(level===5)assert.equal(f.key('Digit5'),false);if(level>=6)assert.equal(f.key('Digit5'),true);if(level>=11){assert.equal(f.key('Digit6'),true);assert.equal(f.game.selected,'peanuts');}
 }
});

test('advanced visitors require the correct refreshment through the ordinary tool and target controls',async()=>{
 const f=fixture({startLevel:11});await f.start();const visitor={id:'visitor-qa',type:'guest',guest:'visitor-hila',food:'peanuts',door:1,slot:1,total:28,remaining:28,createdAt:f.game.elapsed};
 f.game.tasks=[visitor];f.game.stageIssued++;f.window.test.render();await f.choose('serve');await f.act(visitor.id);assert.equal(f.state.motion.busy,false);assert.ok(f.game.tasks.includes(visitor));assert.ok(f.sounds.includes('wrong'));assert.equal(toast(f),'','late levels do not reveal the correct food in text');
 const before=f.game.stats.snacks;await f.choose('peanuts');await f.act(visitor.id);assert.equal(f.state.motion.busy,true);f.until(()=>f.game.stats.snacks===before+1);assert.equal(f.actor.carryDish,null);assert.ok(!f.game.tasks.includes(visitor));
});
