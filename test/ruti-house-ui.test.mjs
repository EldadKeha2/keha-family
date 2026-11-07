import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
import * as engine from '../public/assets/ruti-house-engine.mjs';
import * as motion from '../public/assets/ruti-house-motion.mjs';
import {PLANT_VARIETIES,getHouseLayout,getTaskLocation,findHousePath} from '../public/assets/ruti-house-scene.mjs';
import {rutiHouseScore} from '../src/ruti-house-scores.mjs';
import {HOUSE_LESSONS} from '../public/assets/ruti-house-lessons.mjs';

const source=(await readFile(new URL('../public/assets/ruti-house.js',import.meta.url),'utf8')).replace(/^import[^\n]+\n/gm,'').replace(/export function /g,'function ');
const required=t=>({plant:'water',dust:'broom',cat:'hand',guest:'serve'}[t.type]);
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

function fixture({english=false,startLevel=1,failSave=false,initialScores=[]}={}){
  let now=100000,sequence=0,backs=0,game=null,actor=null,html='',saveStatus=failSave?503:200;
  const nodes=new Map(),listeners=new Map(),frames=new Map(),requests=[],writes=[],sounds=[],draws=[];
  const register=(target,type,fn,{signal}={})=>{const key=`${target}.${type}`;if(!listeners.has(key))listeners.set(key,new Set());listeners.get(key).add(fn);signal?.addEventListener('abort',()=>listeners.get(key)?.delete(fn),{once:true});};
  const emit=(target,type,event={})=>{for(const fn of [...listeners.get(`${target}.${type}`)||[]])fn(event);};
  const context=new Proxy({},{get:(target,key)=>key in target?target[key]:()=>{}});
  const body=()=>html+[...nodes.values()].map(n=>n.innerHTML).join('');
  function node(dataset={}){const classes=new Set();return {dataset,width:960,height:600,style:{setProperty(name,value){this[name]=value;}},classList:{add(value){classes.add(value);},remove(value){classes.delete(value);},toggle(value,on){if(on===undefined)on=!classes.has(value);if(on)classes.add(value);else classes.delete(value);return on;},contains(value){return classes.has(value);}},textContent:'',innerHTML:'',hidden:false,disabled:false,attributes:{},setAttribute(name,value){this.attributes[name]=value;},getContext:()=>context,focus(){},scrollIntoView(){},animate(){},getBoundingClientRect:()=>({left:0,top:0,width:960,height:600})};}
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
  const audio={unlock(){return Promise.resolve(true);},setEnabled(){},stop(){},play(kind){sounds.push(kind);}};
  vm.runInNewContext(source+'\nwindow.test={mountRutiHouse,pauseRutiHouse,state,render,processEvents,tutorialGuide:typeof tutorialGuide==="function"?tutorialGuide:null};',{
    ...engine,...motion,HOUSE_LESSONS,window,document,Image,Response,AbortController,crypto:webcrypto,performance:{now:()=>now},
    createHouse(){game=gameAt(startLevel);return game;},createHouseActor(start){actor=motion.createHouseActor(start);return actor;},
    PLANT_VARIETIES,getHouseLayout,getTaskLocation,findHousePath,renderHouse(_ctx,g,visual){draws.push({level:g.level,phase:g.phase,actor:{...visual.actor}});},
    createSceneAssets:()=>({family:{},icons:{},ready:Promise.resolve()}),houseArtwork:()=>'<svg></svg>',iconArtwork:id=>`<svg data-icon="${id}"></svg>`,createHouseSound:()=>audio,
    requestAnimationFrame(fn){const id=++sequence;frames.set(id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id)
  });
  const flush=()=>new Promise(resolve=>setImmediate(resolve));
  return {root,nodes,frames,requests,writes,sounds,draws,document,window,flush,get game(){return game;},get actor(){return actor;},get state(){return window.test.state;},get html(){return html;},get backs(){return backs;},
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
    assert.match(opening,english?/The tahini is on its way/:/הטחינה בדרך/);assert.match(opening,english?/Open the house/:/פותחים את הבית/);assert.doesNotMatch(opening,english?/\b(?:level|stage|chapter)s?\b/i:/שלב/);
    assert.match(f.nodes.get('[data-rh-leaderboard]').innerHTML,/Champion/);assert.equal(f.requests.filter(r=>r.path.endsWith('/scores')).length,1);
  }
});

test('every newly introduced mechanic asks the player to demonstrate understanding before any stage clock can start',async()=>{
  for(const english of [false,true])for(let level=1;level<=7;level++){
    const f=fixture({english,startLevel:level});await f.start(false);assert.equal(f.state.briefing,true);assert.equal(f.state.understood,false);assert.equal(f.frames.size,0);const before=JSON.stringify({elapsed:f.game.elapsed,tasks:f.game.tasks,kitchen:f.game.kitchen});f.advance(120000);assert.equal(JSON.stringify({elapsed:f.game.elapsed,tasks:f.game.tasks,kitchen:f.game.kitchen}),before);
    assert.equal(f.root.querySelector('[data-rh-begin-stage]').disabled,true);await f.click('[data-rh-begin-stage]');assert.equal(f.state.briefing,true);assert.equal(f.frames.size,0);
    await f.click('[data-rh-understand-answer]',{rhUnderstandAnswer:'1'});assert.equal(f.state.understood,false);assert.equal(f.root.querySelector('[data-rh-begin-stage]').disabled,true);assert.equal(f.game.strikes,0);
    await f.click('[data-rh-understand-answer]',{rhUnderstandAnswer:'0'});assert.equal(f.state.understood,true);assert.equal(f.root.querySelector('[data-rh-begin-stage]').disabled,false);await f.click('[data-rh-begin-stage]');assert.equal(f.state.briefing,false);assert.equal(f.frames.size,1);
  }
  for(let level=8;level<=10;level++){const f=fixture({startLevel:level});await f.start(false);assert.equal(f.state.briefing,false);assert.equal(f.frames.size,1);}
});

test('the first stage shows only two tools and four named pots, starts safely and completes after thirty physical waterings',async()=>{
  for(const english of [false,true]){
    const f=fixture({english});await f.start();const first=f.game.tasks[0];assert.equal(f.game.level,1);assert.equal(f.game.stage.goal,30);assert.equal(f.game.tasks.length,1);assert.equal(first.type,'plant');assert.equal(first.untimed,true);assert.equal(f.actor.tool,null);assert.equal(f.game.selected,null);
    assert.deepEqual(f.root.querySelectorAll('[data-rh-tool]').map(b=>b.dataset.rhTool),['water','broom']);
    assert.equal(f.nodes.get('[data-rh-tool="water"]').disabled,false);assert.equal(f.nodes.get('[data-rh-tool="broom"]').disabled,false);assert.equal(f.nodes.get('[data-rh-tool="water"]').classList.contains('rh-tool-guide'),true);assert.match(f.nodes.get('[data-rh-hint]').textContent,english?/watering can/i:/משפך/);
    assert.equal(f.root.querySelector('[data-rh-tool="serve"]'),null);assert.equal(f.root.querySelector('[data-rh-tool="peanuts"]'),null);
    const initialTargets=f.root.querySelectorAll('[data-rh-target]');assert.equal(initialTargets.length,4);assert.ok(initialTargets.every(b=>!b.dataset.rhTarget.startsWith('cook-')));
    for(const plant of PLANT_VARIETIES)assert.ok(f.nodes.get('[data-rh-hotspots]').innerHTML.includes(english?plant.en:plant.he));
    assert.equal(f.key('Digit3'),false);assert.equal(f.game.selected,null);for(const digit of [5,6,7,8])assert.equal(f.key(`Digit${digit}`),false);
    const remaining=first.remaining;f.advance(70000);assert.equal(f.game.tasks.length,1);assert.equal(first.remaining,remaining);assert.equal(f.game.strikes,0);assert.equal(f.game.stats.plants,0);
    const slots=[];
    for(let i=0;i<6;i++){
      f.until(()=>f.game.tasks.length>0);const task=f.game.tasks[0];assert.equal(f.game.tasks.length,1);assert.equal(task.type,'plant');assert.equal(task.untimed,true);slots.push(task.slot);
      await performTask(f,task);f.until(()=>!f.game.tasks.some(t=>t.id===task.id));assert.equal(f.game.phase,'playing');assert.equal(f.game.level,1);
    }
    assert.equal(new Set(slots.slice(0,4)).size,4);assert.equal(f.game.stageCompleted,6);assert.equal(engine.firstStagePace(f.game).untimed,false);
    await finishWateringStage(f);assert.equal(f.game.stats.plants,30);assert.equal(f.game.wateredSlots.length,30);assert.equal(new Set(f.game.wateredSlots).size,4);assert.ok(f.game.stats.dust>0);assert.equal(f.game.stageCompleted,30);assert.equal(f.game.completedLevels,1);assert.equal(f.game.phase,'stage-complete');
  }
});

test('late first-stage waterings expire visibly, pause safely and recover without advancing the thirty-watering goal',async()=>{
  const f=fixture();await f.start();let guard=0;while(f.game.stageCompleted<24&&guard++<10000)completeEngineTask(f.game);assert.equal(f.game.stageCompleted,24);assert.equal(engine.firstStagePace(f.game).phase,3);
  f.game.tasks=[];f.game.spawnRemaining=0;f.game.typeCursor=0;f.advance(100);const task=f.game.tasks.find(t=>t.type==='plant');assert.ok(task);assert.equal(task.untimed,undefined);assert.equal(task.total,12);
  await f.click('[data-rh-pause]');const remaining=task.remaining;f.advance(60000);assert.equal(task.remaining,remaining);assert.equal(f.game.stageCompleted,24);await f.click('[data-rh-pause]');
  const missed=f.game.stats.missed;f.advance((task.remaining+.1)*1000);assert.ok(!f.game.tasks.some(t=>t.id===task.id));assert.ok(f.game.stats.missed>missed);assert.equal(f.game.stageCompleted,24);assert.equal(f.game.strikes,0);assert.ok(f.state.departures.some(d=>d.type==='plant-missed'&&d.slot===task.slot));
  // A second overlapping request may already be nearly expired. Recover on
  // a fresh request that still allows fetching the can and walking to it.
  f.until(()=>f.game.tasks.some(t=>t.type==='plant'&&t.remaining>10));const next=f.game.tasks.find(t=>t.type==='plant'&&t.remaining>10);await performTask(f,next);f.until(()=>f.game.stageCompleted===25);assert.equal(f.game.phase,'playing');assert.equal(f.game.level,1);
});

test('Ruti fetches, walks and waters before the next plant appears, without clearing the first stage early',async()=>{
  const f=fixture();await f.start();const plant=f.game.tasks[0],start={x:f.actor.x,y:f.actor.y};await f.choose('water');await f.act(plant.id);
  assert.equal(f.actor.tool,null);assert.equal(f.game.stats.plants,0);assert.equal(f.state.pendingTarget,plant.id);assert.equal(f.state.motion.busy,true);f.advance(100);assert.equal(f.game.stats.plants,0);assert.notDeepEqual({x:f.actor.x,y:f.actor.y},start);
  const elapsed=f.until(()=>f.game.stats.plants===1);assert.ok(elapsed>2000);assert.equal(f.game.score,40);assert.equal(f.game.level,1);assert.equal(f.game.phase,'playing');assert.equal(f.game.stageCompleted,1);assert.equal(f.frames.size,1);assert.ok(f.draws.some(d=>d.actor.tool==='water'&&d.actor.walking));assert.ok(f.draws.some(d=>d.actor.action==='water'&&d.actor.actionProgress>0&&d.actor.actionProgress<1));f.until(()=>f.game.tasks.length===1);assert.notEqual(f.game.tasks[0].slot,plant.slot);
});

test('stage congratulations advance automatically after 1.8 seconds, carrying score and strikes while task clocks stay frozen',async()=>{
  const f=fixture();await f.start();f.game.strikes=1;await finishWateringStage(f);assert.equal(f.frames.size,1);const score=f.game.score,elapsed=f.game.elapsed;assert.match(f.nodes.get('[data-rh-overlay]').innerHTML,/כל הכבוד!/);assert.doesNotMatch(f.nodes.get('[data-rh-overlay]').innerHTML,/data-rh-next/);f.advance(1200);assert.equal(f.game.level,1);assert.equal(f.game.elapsed,elapsed);assert.equal(f.game.score,score);
  f.until(()=>f.game.level===2,1000);assert.equal(f.state.briefing,true);assert.equal(f.frames.size,0);assert.equal(f.game.phase,'playing');assert.equal(f.game.strikes,1);assert.equal(f.game.score,score);assert.equal(f.actor.tool,null);await f.acknowledge();assert.equal(f.state.briefing,false);assert.equal(f.frames.size,1);
});

test('pause, hidden tabs, blur and navigation freeze both walking and the congratulations timer until explicit resume',async()=>{
  const f=fixture();await f.start();await f.choose('water');await f.act(f.game.tasks[0].id);f.advance(200);assert.equal(f.state.motion.busy,true);await f.click('[data-rh-pause]');const frozen={x:f.actor.x,y:f.actor.y,elapsed:f.game.elapsed,progress:f.actor.actionProgress};assert.equal(f.frames.size,0);f.advance(60000);assert.deepEqual({x:f.actor.x,y:f.actor.y,elapsed:f.game.elapsed,progress:f.actor.actionProgress},frozen);
  await f.click('[data-rh-pause]');f.advance(150);assert.ok(f.game.elapsed>frozen.elapsed);f.visibility(true);assert.equal(f.frames.size,0);const elapsed=f.game.elapsed,x=f.actor.x;f.jump(3600000);f.visibility(false);assert.equal(f.frames.size,0);assert.equal(f.game.elapsed,elapsed);assert.equal(f.actor.x,x);await f.click('[data-rh-pause]');f.advance(100);f.blur();assert.equal(f.frames.size,0);assert.match(f.nodes.get('[data-rh-overlay]').innerHTML,/כל השעונים עצרו/);await f.click('[data-rh-pause]');
  await finishWateringStage(f);f.advance(300);const cheer=f.state.transitionRemaining;assert.ok(cheer>0&&cheer<1.8);f.visibility(true);f.advance(60000);assert.equal(f.state.transitionRemaining,cheer);assert.equal(f.game.level,1);f.visibility(false);assert.equal(f.frames.size,0);await f.click('[data-rh-pause]');f.advance(100);f.blur();const afterBlur=f.state.transitionRemaining;f.advance(60000);assert.equal(f.state.transitionRemaining,afterBlur);
  await f.click('[data-rh-back]');assert.equal(f.backs,1);assert.equal(f.listenerCount('root','click'),0);f.mount();await f.flush();assert.equal(f.listenerCount('root','click'),1);assert.equal(f.frames.size,0);assert.equal(f.state.transitionRemaining,afterBlur);await f.click('[data-rh-pause]');f.until(()=>f.game.level===2,3000);assert.equal(f.state.briefing,true);assert.equal(f.frames.size,0);await f.acknowledge();assert.equal(f.frames.size,1);
});

test('the single Food tool serves a homemade dish directly to the guest without kitchen selection or preparation',async()=>{
  for(const english of [false,true]){
    const f=fixture({english,startLevel:6});await f.start();f.until(()=>f.game.tasks.some(t=>t.type==='guest'));const guest=f.game.tasks.find(t=>t.type==='guest'),before=f.game.score,stock=f.game.inventory[guest.recipeId];await f.choose('serve');f.until(()=>!f.state.motion.busy);assert.equal(f.actor.tool,'serve');
    assert.deepEqual(f.root.querySelectorAll('[data-rh-tool]').map(b=>b.dataset.rhTool),['water','broom','hand','serve']);assert.ok(f.root.querySelectorAll('[data-rh-target]').every(b=>!b.dataset.rhTarget.startsWith('cook-')));
    const initialMeals=f.game.stats.meals;await f.act(guest.id);assert.equal(f.state.motion.busy,true);assert.equal(f.actor.carryDish,guest.recipeId);assert.equal(f.game.stats.meals,initialMeals);f.advance(100);f.until(()=>f.game.stats.meals===initialMeals+1);assert.equal(f.game.inventory[guest.recipeId],stock);assert.equal(f.actor.carryDish,null);assert.equal(f.game.score-before,300);assert.equal(f.game.requiredMealComplete,true);assert.equal(f.game.stats.snacks,0);assert.equal(f.game.stats.dishes,0);assert.ok(f.draws.some(d=>d.actor.carryDish===guest.recipeId&&d.actor.walking));
  }
});

test('the third cat ends the run and v2 saves preserve stage scores, statistics and retry identifiers',async()=>{
  for(const english of [false,true]){
    const f=fixture({english,startLevel:3,failSave:true});await f.start();assert.equal(f.key('Digit3'),true);assert.equal(f.game.selected,'hand');for(const digit of [5,6,7,8])assert.equal(f.key(`Digit${digit}`),false);assert.equal(f.key('Digit1',{editable:true}),false);assert.equal(f.game.selected,'hand');f.game.tasks=[];f.game.events=[];for(let i=0;i<3;i++)f.game.tasks.push({id:`test-cat-${i}`,type:'cat',slot:i%2,door:i%2,state:'approaching',waiting:0,total:.1,remaining:.1});f.advance(300);await f.flush();assert.equal(f.game.phase,'finished');assert.equal(f.game.strikes,3);assert.equal(f.frames.size,0);assert.match(f.html,/data-rh-score-form/);
    await f.submit();assert.equal(f.writes.length,0);f.input('  Player One  ');await f.submit();assert.equal(f.writes.length,1);assert.match(f.html,english?/Could not save your score/:/שמירה נכשלה/);f.allowSave();await f.submit();assert.equal(f.writes.length,2);const payload=f.writes[1];assert.equal(payload.requestId,f.writes[0].requestId);assert.equal(payload.name,'Player One');assert.equal(payload.version,2);assert.equal(payload.completedLevels,2);assert.deepEqual(payload.stageScores,[...f.game.stageScores]);assert.equal(payload.stageScores.reduce((a,b)=>a+b,0),payload.score);assert.ok(payload.stageScores[0]>0);assert.equal(payload.level,3);assert.equal(payload.plants,f.game.stats.plants);assert.equal(payload.elapsed,Math.floor(f.game.elapsed));assert.equal(f.requests.find(r=>r.options?.method==='POST').options.headers['X-Family-Token'],'test-token');assert.match(f.html,english?/Score saved! Your rank/:/השיא נשמר! המקום שלכם/);await f.submit();assert.equal(f.writes.length,2);
  }
});

test('leaderboards escape visitor names without adding stage explanations to the opening',async()=>{
  const f=fixture({initialScores:[{id:'a'.repeat(32),name:'<img src=x onerror=alert(1)>',score:300,meals:1,snacks:0,level:10,completedLevels:10}]});f.mount();await f.flush();const table=f.nodes.get('[data-rh-leaderboard]').innerHTML;assert.match(table,/&lt;img src=x onerror=alert\(1\)&gt;/);assert.doesNotMatch(table,/<img src=x/);assert.doesNotMatch(introCopy(f.html),/שלב/);
});

test('all ten simplified stages remain winnable with physical movement and direct food serving, and the resulting score validates',async t=>{
  const f=fixture();await f.start();const layout=getHouseLayout(960,600),completed=new Set();
  const prioritize=tasks=>{const cats=tasks.filter(t=>t.type==='cat');if(cats.length)return cats.sort((a,b)=>(a.waiting+a.remaining)-(b.waiting+b.remaining))[0];const cost=t=>{const p=getTaskLocation(t,layout).anchor||getTaskLocation(t,layout),change=f.actor.tool===required(t)?0:1.4;return Math.hypot((p.x-f.actor.x)*1.6,p.y-f.actor.y)+change;};return [...tasks].sort((a,b)=>cost(a)-cost(b))[0];};
  let targetId=null,steps=0;
  while(f.game.phase!=='finished'&&steps++<35000){
    if(f.state.briefing){await f.acknowledge();continue;}
    if(f.game.phase==='stage-complete'){completed.add(f.game.level);f.advance(100);targetId=null;continue;}
    const shown=f.root.querySelectorAll('[data-rh-tool]').map(b=>b.dataset.rhTool);assert.ok(shown.length<=4);assert.ok(!shown.includes('peanuts'));if(f.game.level===1)assert.deepEqual(shown,['water','broom']);if(f.game.level>=5)assert.deepEqual(shown,['water','broom','hand','serve']);
    const target=f.game.tasks.find(t=>t.id===targetId),cat=prioritize(f.game.tasks.filter(t=>t.type==='cat'));
    if(!f.state.motion.busy||cat&&target?.type!=='cat'){
      const neededGuest=f.game.stage.requiredMeal&&!f.game.requiredMealComplete?f.game.tasks.find(t=>t.type==='guest'):null,next=cat||neededGuest||prioritize(f.game.tasks);
      if(next){await performTask(f,next);targetId=next.id;}
    }
    f.advance(100);
  }
  assert.equal(f.game.won,true,JSON.stringify({level:f.game.level,strikes:f.game.strikes,elapsed:f.game.elapsed,completed:[...completed],requiredMealComplete:f.game.requiredMealComplete,tasks:f.game.tasks.map(t=>({type:t.type,remaining:t.remaining,waiting:t.waiting}))}));assert.equal(f.game.completedLevels,10);assert.equal(completed.size,9);assert.ok(f.game.strikes<3);assert.equal(f.game.stageScores.reduce((a,b)=>a+b,0),f.game.score);assert.ok(f.game.stageScores.every(points=>points>0));assert.ok(f.game.stats.plants>=30);assert.equal(f.game.stats.dishes,0);assert.equal(f.game.stats.snacks,0);assert.ok(f.game.stats.meals>=1);assert.match(f.html,/כל עשרת השלבים/);assert.equal(f.frames.size,0);
  f.input('אלופת הבית');await f.submit();assert.equal(f.writes.length,1);const entry=rutiHouseScore(f.writes[0]);assert.equal(entry.version,2);assert.equal(entry.completedLevels,10);assert.equal(entry.level,10);assert.equal(entry.score,f.game.score);assert.equal(entry.name,'אלופת הבית');assert.equal(entry.stageScores.reduce((a,b)=>a+b,0),entry.score);
  t.diagnostic(`Ten levels won in ${Math.floor(f.game.elapsed)} game seconds with ${f.game.strikes} strikes; thirty-water opening and direct guest meals completed; ${entry.score} points pass the production v2 validator.`);
});
