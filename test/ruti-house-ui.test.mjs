import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
import * as engine from '../public/assets/ruti-house-engine.mjs';

const source=(await readFile(new URL('../public/assets/ruti-house.js',import.meta.url),'utf8')).replace(/^import[^\n]+\n/gm,'').replace(/export function /g,'function ');
function fixture({english=false,failSave=false,initialScores=[]}={}){
  let now=100000,sequence=0,backs=0,game=null,html='',saveStatus=failSave?503:200;
  const nodes=new Map(),listeners=new Map(),frames=new Map(),requests=[],writes=[],sounds=[],effects=[];
  const register=(target,type,fn,{signal}={})=>{const key=`${target}.${type}`;if(!listeners.has(key))listeners.set(key,new Set());listeners.get(key).add(fn);signal?.addEventListener('abort',()=>listeners.get(key)?.delete(fn),{once:true});};
  const emit=(target,type,event={})=>{for(const fn of [...listeners.get(`${target}.${type}`)||[]])fn(event);};
  function node(dataset={}){return {dataset,style:{setProperty(name,value){this[name]=value;}},classList:{add(){},remove(){},toggle(){}},textContent:'',innerHTML:'',hidden:false,disabled:false,attributes:{},setAttribute(name,value){this.attributes[name]=value;},focus(){},scrollIntoView(){},remove(){},animate(){},append(value){effects.push(value);},getBoundingClientRect:()=>({left:0,top:0,width:600,height:400}),querySelector:()=>node()};}
  const tools=engine.TOOLS.map(t=>node({rhTool:t.id}));
  const root={classList:{add(){},remove(){}},addEventListener:(type,fn,options)=>register('root',type,fn,options),get innerHTML(){return html;},set innerHTML(value){html=value;nodes.clear();},querySelector(selector){if(!nodes.has(selector))nodes.set(selector,node());return nodes.get(selector);},querySelectorAll(selector){return selector==='[data-rh-tool]'?tools:[];}};
  const document={hidden:false,visibilityState:'visible',documentElement:{hasAttribute:()=>false},createElement:()=>node(),addEventListener:(type,fn,options)=>register('document',type,fn,options)};
  const window={FAMILY_API_TOKEN:'test-token',matchMedia:()=>({matches:false}),addEventListener:(type,fn,options)=>register('window',type,fn,options),FamilyI18n:{isEnglish:english,fetch:async(path,options)=>{
    requests.push({path,options});if(options?.method==='POST'){const entry=JSON.parse(options.body);writes.push(entry);return Response.json(saveStatus===200?{saved:true,rank:1,scores:[{...entry,id:entry.requestId}]}:{error:'שמירה נכשלה'},{status:saveStatus});}
    if(path.endsWith('/scores'))return Response.json({scores:initialScores});return Response.json({person:{profile:`/media/${path.split('/')[2]}.webp`}});
  }}};
  const audio={unlock(){return Promise.resolve(true);},setEnabled(){},stop(){},play(kind){sounds.push(kind);}};
  vm.runInNewContext(source+'\nwindow.test={mountRutiHouse,pauseRutiHouse,processEvents};',{
    ...engine,window,document,Response,AbortController,crypto:webcrypto,performance:{now:()=>now},
    createHouse(){game=engine.createHouse({random:()=>.5});return game;},
    houseArtwork:()=>'<svg></svg>',iconArtwork:id=>`<svg data-icon="${id}"></svg>`,createHouseSound:()=>audio,
    requestAnimationFrame(fn){const id=++sequence;frames.set(id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id),setTimeout(){return ++sequence;}
  });
  const flush=()=>new Promise(resolve=>setImmediate(resolve));
  return {root,nodes,frames,requests,writes,sounds,effects,document,window,flush,get game(){return game;},get html(){return html;},get backs(){return backs;},
    mount(){window.test.mountRutiHouse(root,()=>backs++);},
    async start(){this.mount();await flush();await this.click('[data-rh-start]');},
    async click(selector,dataset={}){emit('root','click',{target:{closest:s=>s===selector?{dataset}:null}});await flush();},
    async choose(id){await this.click('[data-rh-tool]',{rhTool:id});},async act(id){await this.click('[data-rh-target]',{rhTarget:id});},
    key(code,{editable=false}={}){let prevented=false;emit('document','keydown',{code,target:{closest:()=>editable?{}:null},preventDefault(){prevented=true;}});return prevented;},
    visibility(hidden){document.hidden=hidden;document.visibilityState=hidden?'hidden':'visible';emit('document','visibilitychange');},blur(){emit('window','blur');},
    advance(ms){const end=now+ms;while(now<end){now=Math.min(end,now+1000/60);const callbacks=[...frames.values()];frames.clear();for(const fn of callbacks)fn(now);}},jump(ms){now+=ms;},
    input(value){emit('root','input',{target:{value,matches:s=>s==='[data-rh-name]'}});},
    async submit(){emit('root','submit',{preventDefault(){},target:{matches:s=>s==='[data-rh-score-form]'}});await flush();},
    process(){window.test.processEvents();},allowSave(){saveStatus=200;},listenerCount(target,type){return listeners.get(`${target}.${type}`)?.size||0;}
  };
}
const toast=f=>f.nodes.get('[data-rh-toast]').textContent;

test('the game mounts bilingually, loads one shared leaderboard, and uses prepared family portraits',async()=>{
  for(const english of [false,true]){
    const f=fixture({english});f.mount();await f.flush();assert.match(f.html,english?/Ruti’s House/:/הבית של רותי/);assert.match(f.html,/portraits\/ruti.webp/);
    assert.equal(f.requests.filter(r=>r.path.endsWith('/scores')).length,1);assert.deepEqual(f.requests.filter(r=>r.path.includes('/people/')).map(r=>r.path),['api/people/hila/page','api/people/rivi/page']);
    await f.click('[data-rh-start]');assert.equal(f.frames.size,1);assert.equal(f.game.phase,'playing');assert.equal(f.game.tasks.length,3);assert.match(f.html,/data-rh-tool="hand"/);assert.match(f.html,/data-rh-tool="peanuts"/);
  }
});

test('recipe preparation plays the actual action sound, identifies the next tool, then announces timed readiness',async()=>{
  for(const english of [false,true]){
    const f=fixture({english});await f.start();const carrot=engine.RECIPES.find(r=>r.id==='carrot');
    await f.act('cook-carrot');assert.equal(f.game.kitchen.carrot.step,0);assert.match(toast(f),english?/First select: Knife/:/בחרו קודם: סכין/);
    await f.choose('knife');await f.act('cook-carrot');assert.equal(f.game.kitchen.carrot.step,1);assert.equal(f.sounds.at(-1),'knife');assert.match(toast(f),english?/Next: Mix in raisins and dressing — Bowl & spoon/:/עכשיו: מערבבים צימוקים ותיבול — קערה וכף/);
    assert.equal(f.nodes.get('[data-rh-chef]').dataset.action,'knife');
    await f.choose('bowl');await f.act('cook-carrot');assert.equal(f.game.kitchen.carrot.state,'cooking');assert.equal(f.sounds.at(-1),'bowl');assert.match(toast(f),english?/Cooking!/:/בהכנה!/);
    f.game.tasks=[];f.game.events=[];f.game.schedule={plant:999,dust:999,guest:999,cat:999};f.advance(carrot.duration*1000+150);
    assert.equal(f.game.inventory.carrot,2);assert.equal(f.game.stats.dishes,1);assert.equal(f.sounds.at(-1),'ready');assert.match(toast(f),english?/is ready! Serve it up/:/מוכנה! אפשר להגיש/);assert.doesNotMatch(toast(f),english?/sparkling/:/מבריק/);
  }
});

test('empty meals, full stock and cooking dishes have explicit feedback without accidental points',async()=>{
  for(const english of [false,true]){
    const f=fixture({english});await f.start();const guest=f.game.tasks.find(t=>t.type==='guest');f.game.inventory[guest.recipeId]=0;await f.choose('serve');await f.act(guest.id);
    assert.match(toast(f),english?/ran out! Prepare more, or serve peanuts/:/המנה נגמרה! הכינו עוד, או הגישו בוטנים/);assert.equal(f.game.score,0);assert.ok(f.game.tasks.includes(guest));
    await f.choose('peanuts');await f.act(guest.id);assert.equal(f.game.stats.snacks,1);assert.equal(f.game.score,engine.POINTS.snack);
    f.game.inventory.tahini=3;await f.act('cook-tahini');assert.match(toast(f),english?/Three portions are ready/:/יש כבר שלוש מנות מוכנות/);
    f.game.inventory.tahini=1;await f.choose('bowl');await f.act('cook-tahini');await f.act('cook-tahini');await f.act('cook-tahini');assert.match(toast(f),english?/still cooking/:/עדיין בהכנה/);assert.equal(f.game.score,engine.POINTS.snack);
  }
});

test('pause, hidden tabs, blur and navigation freeze all timers until explicit resume',async()=>{
  const f=fixture();await f.start();f.advance(1000);const initial=f.game.elapsed;
  await f.click('[data-rh-pause]');assert.equal(f.frames.size,0);f.advance(100000);assert.equal(f.game.elapsed,initial);
  await f.click('[data-rh-pause]');f.advance(150);assert.ok(f.game.elapsed>initial);f.visibility(true);assert.equal(f.frames.size,0);const paused=f.game.elapsed;f.jump(3600000);f.visibility(false);assert.equal(f.frames.size,0);assert.equal(f.game.elapsed,paused);
  await f.click('[data-rh-pause]');f.advance(150);f.blur();assert.equal(f.frames.size,0);assert.match(f.nodes.get('[data-rh-overlay]').innerHTML,/כל השעונים עצרו/);
  await f.click('[data-rh-back]');assert.equal(f.backs,1);assert.equal(f.frames.size,0);assert.equal(f.listenerCount('root','click'),0);f.mount();await f.flush();assert.equal(f.frames.size,0);assert.equal(f.listenerCount('root','click'),1);
  await f.click('[data-rh-pause]');assert.equal(f.frames.size,1);
});

test('keyboard tools leave name entry alone, and the third cat opens a retryable idempotent score form',async()=>{
  for(const english of [false,true]){
    const f=fixture({english,failSave:true});await f.start();assert.equal(f.key('Digit8'),true);assert.equal(f.game.selected,'hand');assert.equal(f.key('Digit1',{editable:true}),false);assert.equal(f.game.selected,'hand');
    const guest=f.game.tasks.find(t=>t.type==='guest');await f.choose('serve');await f.act(guest.id);const score=f.game.score;
    f.game.tasks=[];f.game.events=[];f.game.schedule={plant:999,dust:999,guest:999,cat:999};
    for(let i=0;i<3;i++)f.game.tasks.push({id:`test-cat-${i}`,type:'cat',slot:i,total:.1,remaining:.1});f.advance(300);await f.flush();
    assert.equal(f.game.phase,'finished');assert.equal(f.game.strikes,3);assert.equal(f.frames.size,0);assert.match(f.html,/data-rh-score-form/);assert.equal(f.game.score,score);
    await f.submit();assert.equal(f.writes.length,0);f.input('  Player One  ');await f.submit();assert.equal(f.writes.length,1);assert.match(f.html,/Player One/);assert.match(f.html,english?/Could not save your score/:/שמירה נכשלה/);
    f.allowSave();await f.submit();assert.equal(f.writes.length,2);assert.equal(f.writes[0].requestId,f.writes[1].requestId);assert.equal(f.writes[1].name,'Player One');assert.equal(f.writes[1].score,score);assert.equal(f.writes[1].meals,1);assert.equal(f.writes[1].elapsed,Math.floor(f.game.elapsed));assert.match(f.html,english?/Score saved! Your rank/:/השיא נשמר! המקום שלכם/);
    await f.submit();assert.equal(f.writes.length,2);await f.click('[data-rh-start]');assert.equal(f.game.strikes,0);assert.equal(f.game.score,0);assert.equal(f.frames.size,1);
  }
});

test('leaderboards escape visitor names before rendering',async()=>{
  const f=fixture({initialScores:[{id:'a'.repeat(32),name:'<img src=x onerror=alert(1)>',score:300,meals:1,snacks:0,level:1}]});f.mount();await f.flush();const table=f.nodes.get('[data-rh-leaderboard]').innerHTML;
  assert.match(table,/&lt;img src=x onerror=alert\(1\)&gt;/);assert.doesNotMatch(table,/<img src=x/);
});
