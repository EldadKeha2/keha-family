import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
import * as engine from '../public/assets/ruti-house-engine.mjs';
import * as motion from '../public/assets/ruti-house-motion.mjs';
import {getHouseLayout,getTaskLocation,findHousePath} from '../public/assets/ruti-house-scene.mjs';
import {rutiHouseScore} from '../src/ruti-house-scores.mjs';

const source=(await readFile(new URL('../public/assets/ruti-house.js',import.meta.url),'utf8')).replace(/^import[^\n]+\n/gm,'').replace(/export function /g,'function ');
const required=t=>({plant:'water',dust:'broom',cat:'hand',guest:'peanuts'}[t.type]);
function gameAt(level){const g=engine.createHouse({random:()=>.5});while(g.level<level){while(g.phase==='playing'){if(g.tasks.length){const t=g.tasks[0];engine.selectTool(g,required(t));engine.actHouse(g,t.id);}else engine.advanceHouse(g,.1);}engine.advanceStage(g);}g.events=[];return g;}

function fixture({english=false,startLevel=1,failSave=false,initialScores=[]}={}){
  let now=100000,sequence=0,backs=0,game=null,actor=null,html='',saveStatus=failSave?503:200;
  const nodes=new Map(),listeners=new Map(),frames=new Map(),requests=[],writes=[],sounds=[],draws=[];
  const register=(target,type,fn,{signal}={})=>{const key=`${target}.${type}`;if(!listeners.has(key))listeners.set(key,new Set());listeners.get(key).add(fn);signal?.addEventListener('abort',()=>listeners.get(key)?.delete(fn),{once:true});};
  const emit=(target,type,event={})=>{for(const fn of [...listeners.get(`${target}.${type}`)||[]])fn(event);};
  const context=new Proxy({},{get:(target,key)=>key in target?target[key]:()=>{}});
  const body=()=>html+[...nodes.values()].map(n=>n.innerHTML).join('');
  function node(dataset={}){const classes=new Set();return {dataset,width:960,height:600,style:{setProperty(name,value){this[name]=value;}},classList:{add(value){classes.add(value);},remove(value){classes.delete(value);},toggle(value,on){if(on===undefined)on=!classes.has(value);if(on)classes.add(value);else classes.delete(value);return on;}},textContent:'',innerHTML:'',hidden:false,disabled:false,attributes:{},setAttribute(name,value){this.attributes[name]=value;},getContext:()=>context,focus(){},scrollIntoView(){},animate(){},getBoundingClientRect:()=>({left:0,top:0,width:960,height:600})};}
  const root={classList:{add(){},remove(){}},addEventListener:(type,fn,options)=>register('root',type,fn,options),get innerHTML(){return html;},set innerHTML(value){html=value;nodes.clear();},querySelector(selector){
    const present=selector.startsWith('[')?body().includes(selector.slice(1,-1)):body().includes(selector.slice(1));if(!present)return null;
    if(!nodes.has(selector))nodes.set(selector,node());return nodes.get(selector);
  },querySelectorAll(selector){
    if(selector==='[data-rh-tool]')return engine.TOOLS.map(t=>{const key=`[data-rh-tool="${t.id}"]`;if(!nodes.has(key))nodes.set(key,node({rhTool:t.id}));return nodes.get(key);});return [];
  }};
  const document={hidden:false,visibilityState:'visible',documentElement:{hasAttribute:()=>false},addEventListener:(type,fn,options)=>register('document',type,fn,options)};
  const window={devicePixelRatio:1,FAMILY_API_TOKEN:'test-token',matchMedia:()=>({matches:false}),addEventListener:(type,fn,options)=>register('window',type,fn,options),FamilyI18n:{isEnglish:english,fetch:async(path,options)=>{
    requests.push({path,options});if(options?.method==='POST'){const entry=JSON.parse(options.body);writes.push(entry);return Response.json(saveStatus===200?{saved:true,rank:1,scores:[{...entry,id:entry.requestId}]}:{error:'שמירה נכשלה'},{status:saveStatus});}
    if(path.endsWith('/scores'))return Response.json({scores:initialScores});return Response.json({person:{profile:`/media/${path.split('/')[2]}.webp`}});
  }}};
  class Image{constructor(){this.complete=true;this.naturalWidth=100;}set src(value){this.url=value;queueMicrotask(()=>this.onload?.());}}
  const audio={unlock(){return Promise.resolve(true);},setEnabled(){},stop(){},play(kind){sounds.push(kind);}};
  vm.runInNewContext(source+'\nwindow.test={mountRutiHouse,pauseRutiHouse,state,render,processEvents};',{
    ...engine,...motion,window,document,Image,Response,AbortController,crypto:webcrypto,performance:{now:()=>now},
    createHouse(){game=gameAt(startLevel);return game;},createHouseActor(start){actor=motion.createHouseActor(start);return actor;},
    getHouseLayout,getTaskLocation,findHousePath,renderHouse(_ctx,g,visual){draws.push({level:g.level,phase:g.phase,actor:{...visual.actor}});},
    createSceneAssets:()=>({family:{},icons:{},ready:Promise.resolve()}),houseArtwork:()=>'<svg></svg>',iconArtwork:id=>`<svg data-icon="${id}"></svg>`,createHouseSound:()=>audio,
    requestAnimationFrame(fn){const id=++sequence;frames.set(id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id)
  });
  const flush=()=>new Promise(resolve=>setImmediate(resolve));
  return {root,nodes,frames,requests,writes,sounds,draws,document,window,flush,get game(){return game;},get actor(){return actor;},get state(){return window.test.state;},get html(){return html;},get backs(){return backs;},
    mount(){window.test.mountRutiHouse(root,()=>backs++);},async start(){this.mount();await flush();await this.click('[data-rh-start]');},
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

test('the bilingual tutorial starts with one sixty-second task and guides the only available tool',async()=>{
  for(const english of [false,true]){
    const f=fixture({english});f.mount();await f.flush();assert.match(f.html,english?/Ruti’s House/:/הבית של רותי/);assert.match(f.html,/portraits\/ruti.webp/);assert.equal(f.requests.filter(r=>r.path.endsWith('/scores')).length,1);
    await f.click('[data-rh-start]');assert.equal(f.game.tasks.length,1);assert.equal(f.game.tasks[0].type,'plant');assert.equal(f.game.tasks[0].remaining,60);assert.equal(f.actor.tool,null);assert.equal(f.game.selected,null);
    assert.equal(f.nodes.get('[data-rh-tool="water"]').disabled,false);assert.equal(f.nodes.get('[data-rh-tool="broom"]').disabled,true);assert.match(f.nodes.get('[data-rh-hint]').textContent,english?/One task, a full minute/:/משימה אחת, דקה שלמה/);
    f.advance(1000);assert.equal(f.game.level,1);assert.equal(f.game.tasks.length,1);assert.equal(f.game.stats.plants,0);
  }
});

test('Ruti physically fetches a tool, queues the target and finishes watering only after walking and the action pose',async()=>{
  const f=fixture();await f.start();const plant=f.game.tasks[0],start={x:f.actor.x,y:f.actor.y};await f.choose('water');await f.act(plant.id);
  assert.equal(f.actor.tool,null);assert.equal(f.game.stats.plants,0);assert.equal(f.state.pendingTarget,plant.id);assert.equal(f.state.motion.busy,true);f.advance(100);assert.equal(f.game.stats.plants,0);assert.notDeepEqual({x:f.actor.x,y:f.actor.y},start);
  const elapsed=f.until(()=>f.game.phase==='stage-complete');assert.ok(elapsed>2000);assert.equal(f.game.stats.plants,1);assert.equal(f.game.score,40);assert.equal(f.frames.size,0);assert.ok(f.draws.some(d=>d.actor.tool==='water'&&d.actor.walking));assert.ok(f.draws.some(d=>d.actor.action==='water'&&d.actor.actionProgress>0&&d.actor.actionProgress<1));
  assert.match(f.nodes.get('[data-rh-overlay]').innerHTML,/שלב 1 הושלם/);const snapshot=JSON.stringify({actor:f.actor,elapsed:f.game.elapsed,score:f.game.score});f.advance(60000);assert.equal(JSON.stringify({actor:f.actor,elapsed:f.game.elapsed,score:f.game.score}),snapshot);
});

test('explicit stage continuation keeps score and strikes and starts the next stage with one task',async()=>{
  const f=fixture();await f.start();f.game.strikes=1;await f.choose('water');await f.act(f.game.tasks[0].id);f.until(()=>f.game.phase==='stage-complete');const score=f.game.score;
  await f.click('[data-rh-next]');assert.equal(f.game.level,2);assert.equal(f.game.phase,'playing');assert.equal(f.game.tasks.length,1);assert.equal(f.game.tasks[0].type,'dust');assert.equal(f.game.tasks[0].total,40);assert.equal(f.game.strikes,1);assert.equal(f.game.score,score);assert.equal(f.actor.tool,null);assert.equal(f.frames.size,1);
});

test('pause, blur, hidden tabs and navigation freeze both walking and game clocks until explicit resume',async()=>{
  const f=fixture();await f.start();await f.choose('water');await f.act(f.game.tasks[0].id);f.advance(200);assert.equal(f.state.motion.busy,true);
  await f.click('[data-rh-pause]');const frozen={x:f.actor.x,y:f.actor.y,elapsed:f.game.elapsed,progress:f.actor.actionProgress};assert.equal(f.frames.size,0);f.advance(60000);assert.deepEqual({x:f.actor.x,y:f.actor.y,elapsed:f.game.elapsed,progress:f.actor.actionProgress},frozen);
  await f.click('[data-rh-pause]');f.advance(150);assert.ok(f.game.elapsed>frozen.elapsed);f.visibility(true);assert.equal(f.frames.size,0);const elapsed=f.game.elapsed,x=f.actor.x;f.jump(3600000);f.visibility(false);assert.equal(f.frames.size,0);assert.equal(f.game.elapsed,elapsed);assert.equal(f.actor.x,x);
  await f.click('[data-rh-pause]');f.advance(100);f.blur();assert.equal(f.frames.size,0);assert.match(f.nodes.get('[data-rh-overlay]').innerHTML,/כל השעונים עצרו/);
  await f.click('[data-rh-back]');assert.equal(f.backs,1);assert.equal(f.listenerCount('root','click'),0);f.mount();await f.flush();assert.equal(f.listenerCount('root','click'),1);assert.equal(f.frames.size,0);await f.click('[data-rh-pause]');assert.equal(f.frames.size,1);
});

test('a serving tray must physically collect the requested kitchen dish before feeding a guest',async()=>{
  for(const english of [false,true]){
    const f=fixture({english,startLevel:3});await f.start();const guest=f.game.tasks[0],before=f.game.score,stock=f.game.inventory[guest.recipeId];await f.choose('serve');f.until(()=>!f.state.motion.busy);assert.equal(f.actor.tool,'serve');
    await f.act(guest.id);assert.equal(f.game.stats.meals,0);assert.equal(f.state.motion.busy,false);assert.match(toast(f),english?/First collect it from its kitchen spot/:/קחו קודם את המנה מהמקום שלה במטבח/);
    await f.act(`cook-${guest.recipeId}`);assert.equal(f.actor.carryDish,null);assert.equal(f.state.heldDish,null);f.advance(100);assert.equal(f.state.heldDish,null);f.until(()=>f.state.heldDish===guest.recipeId);assert.equal(f.actor.carryDish,guest.recipeId);assert.equal(f.game.inventory[guest.recipeId],stock);
    await f.act(guest.id);assert.equal(f.game.stats.meals,0);f.until(()=>f.game.stats.meals===1);assert.equal(f.game.inventory[guest.recipeId],stock-1);assert.equal(f.actor.carryDish,null);assert.equal(f.state.heldDish,null);assert.equal(f.game.score-before,300);assert.ok(f.draws.some(d=>d.actor.carryDish===guest.recipeId&&d.actor.walking));
  }
});

test('the third cat ends the run and v2 saves preserve stage scores, stats and retry identifiers',async()=>{
  for(const english of [false,true]){
    const f=fixture({english,startLevel:4,failSave:true});await f.start();assert.equal(f.key('Digit8'),true);assert.equal(f.game.selected,'hand');assert.equal(f.key('Digit1',{editable:true}),false);assert.equal(f.game.selected,'hand');
    f.game.tasks=[];f.game.events=[];for(let i=0;i<3;i++)f.game.tasks.push({id:`test-cat-${i}`,type:'cat',slot:i%2,door:i%2,state:'approaching',waiting:0,total:.1,remaining:.1});f.advance(300);await f.flush();assert.equal(f.game.phase,'finished');assert.equal(f.game.strikes,3);assert.equal(f.frames.size,0);assert.match(f.html,/data-rh-score-form/);
    await f.submit();assert.equal(f.writes.length,0);f.input('  Player One  ');await f.submit();assert.equal(f.writes.length,1);assert.match(f.html,english?/Could not save your score/:/שמירה נכשלה/);
    f.allowSave();await f.submit();assert.equal(f.writes.length,2);const payload=f.writes[1];assert.equal(payload.requestId,f.writes[0].requestId);assert.equal(payload.name,'Player One');assert.equal(payload.version,2);assert.equal(payload.completedLevels,3);assert.deepEqual(payload.stageScores,[...f.game.stageScores]);assert.equal(payload.stageScores.reduce((a,b)=>a+b,0),payload.score);assert.equal(payload.level,4);assert.equal(payload.plants,f.game.stats.plants);assert.equal(payload.elapsed,Math.floor(f.game.elapsed));assert.equal(f.requests.find(r=>r.options?.method==='POST').options.headers['X-Family-Token'],'test-token');assert.match(f.html,english?/Score saved! Your rank/:/השיא נשמר! המקום שלכם/);
    await f.submit();assert.equal(f.writes.length,2);
  }
});

test('leaderboards escape visitor names and display the ten-stage champion marker',async()=>{
  const f=fixture({initialScores:[{id:'a'.repeat(32),name:'<img src=x onerror=alert(1)>',score:300,meals:1,snacks:0,level:10,completedLevels:10}]});f.mount();await f.flush();const table=f.nodes.get('[data-rh-leaderboard]').innerHTML;assert.match(table,/&lt;img src=x onerror=alert\(1\)&gt;/);assert.doesNotMatch(table,/<img src=x/);assert.match(table,/10 ✿/);
});

test('a player can finish all ten stages through real walking and actions, then save a valid v2 winning score',async t=>{
  const f=fixture();await f.start();const layout=getHouseLayout(960,600),completed=[],prioritize=tasks=>{
    const cats=tasks.filter(t=>t.type==='cat');if(cats.length)return cats.sort((a,b)=>(a.waiting+a.remaining)-(b.waiting+b.remaining))[0];
    const cost=t=>{const p=getTaskLocation(t,layout).anchor||getTaskLocation(t,layout),change=f.actor.tool===required(t)?0:1.4;return Math.hypot((p.x-f.actor.x)*1.6,p.y-f.actor.y)+change;};
    return [...tasks].sort((a,b)=>cost(a)-cost(b))[0];
  };
  let targetId=null,steps=0;
  while(f.game.phase!=='finished'&&steps++<30000){
    if(f.game.phase==='stage-complete'){completed.push({level:f.game.level,strikes:f.game.strikes,elapsed:f.game.elapsed});await f.click('[data-rh-next]');targetId=null;continue;}
    const target=f.game.tasks.find(t=>t.id===targetId),cat=prioritize(f.game.tasks.filter(t=>t.type==='cat'));
    // Finish ordinary jobs, but immediately respond to a newly arriving cat.
    // These are ordinary controls: no actor position, deadline, life or score
    // is changed by the test player.
    if(!f.state.motion.busy||cat&&target?.type!=='cat'){
      const next=cat||prioritize(f.game.tasks);
      if(next){const id=required(next);if(f.actor.tool!==id)await f.choose(id);await f.act(next.id);targetId=next.id;}
    }
    f.advance(100);
  }
  assert.equal(f.game.won,true,JSON.stringify({level:f.game.level,strikes:f.game.strikes,elapsed:f.game.elapsed,completed,tasks:f.game.tasks.map(t=>({type:t.type,remaining:t.remaining,waiting:t.waiting}))}));
  assert.equal(f.game.completedLevels,10);assert.equal(completed.length,9);assert.ok(f.game.strikes<3);assert.equal(f.game.stageScores.reduce((a,b)=>a+b,0),f.game.score);assert.ok(f.game.stageScores.every(points=>points>0));assert.match(f.html,/כל עשרת השלבים/);assert.equal(f.frames.size,0);
  f.input('אלופת הבית');await f.submit();assert.equal(f.writes.length,1);const entry=rutiHouseScore(f.writes[0]);assert.equal(entry.version,2);assert.equal(entry.completedLevels,10);assert.equal(entry.level,10);assert.equal(entry.score,f.game.score);assert.equal(entry.name,'אלופת הבית');assert.equal(entry.stageScores.reduce((a,b)=>a+b,0),entry.score);
  t.diagnostic(`Ten levels won in ${Math.floor(f.game.elapsed)} game seconds with ${f.game.strikes} strikes; ${entry.score} points pass the production v2 validator.`);
});
