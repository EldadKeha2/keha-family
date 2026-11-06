import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
import * as engine from '../public/assets/neto-tetris.mjs';
import {NETO_PRODUCTS,NETO_STORE_URL} from '../public/assets/neto-products.mjs';

const source=(await readFile(new URL('../public/assets/neto-tetris.js',import.meta.url),'utf8')).replace(/^import[^\n]+\n/gm,'').replace(/export function /g,'function ');
function fixture({english=false,failSave=false,initialScores=[],reducedMotion=false,legacyCrypto=false,failArt=false}={}){
  let now=100000,sequence=0,backs=0,game=null,html='',scoreStatus=failSave?503:200;
  const nodes=new Map(),listeners=new Map(),frames=new Map(),requests=[],writes=[],draws=[],zapDraws=[],previews=[];
  const register=(target,type,fn,{signal}={})=>{
    const key=target+'.'+type;if(!listeners.has(key))listeners.set(key,new Set());listeners.get(key).add(fn);
    signal?.addEventListener('abort',()=>listeners.get(key)?.delete(fn),{once:true});
  };
  const emit=(target,type,event={})=>{for(const fn of [...listeners.get(target+'.'+type)||[]])fn(event);};
  const ctx={clearRect(){}};
  function node(dataset={},width=144,height=108){return {dataset,style:{},width,height,disabled:false,hidden:false,textContent:'',innerHTML:'',getContext:()=>ctx,focus(){},scrollIntoView(){}};}
  const body=()=>html+[...nodes.values()].map(n=>n.innerHTML).join('');
  const root={clientWidth:960,classList:{add(){},remove(){}},addEventListener:(type,fn,options)=>register('root',type,fn,options),get innerHTML(){return html;},set innerHTML(value){html=value;nodes.clear();},querySelector(selector){
    const present=selector.startsWith('[')?body().includes(selector.slice(1,-1)):selector.startsWith('#')?body().includes('id="'+selector.slice(1)+'"'):body().includes(selector.slice(1));
    if(!present)return null;
    if(!nodes.has(selector)){const action=selector.match(/data-neto-action="([^"]+)"/),board=selector==='[data-neto-board]';nodes.set(selector,node(action?{netoAction:action[1]}:{},board?400:144,board?800:108));}
    return nodes.get(selector);
  },querySelectorAll(selector){
    if(selector==='[data-neto-preview]')return [...body().matchAll(/data-neto-preview="([^"]+)"/g)].map(match=>node({netoPreview:match[1]}));
    if(selector==='[data-neto-action]')return [...new Set([...body().matchAll(/data-neto-action="([^"]+)"/g)].map(match=>match[1]))].map(action=>root.querySelector('[data-neto-action="'+action+'"]'));
    return [];
  }};
  const document={visibilityState:'visible',documentElement:{hasAttribute:()=>reducedMotion},addEventListener:(type,fn,options)=>register('document',type,fn,options)};
  const window={FAMILY_API_TOKEN:'test-token',matchMedia:()=>({matches:reducedMotion}),addEventListener:(type,fn,options)=>register('window',type,fn,options),FamilyI18n:{isEnglish:english,fetch:async(path,options)=>{
    requests.push({path,options});
    if(options?.method==='POST'){
      const entry=JSON.parse(options.body);writes.push(entry);
      return Response.json(scoreStatus===200?{saved:true,rank:1,scores:[{...entry,id:entry.requestId}]}:{error:'unavailable'},{status:scoreStatus});
    }
    return Response.json({scores:initialScores});
  }}};
  vm.runInNewContext(source+'\nwindow.test={mountNetoTetris,pauseNetoTetris};',{
    ...engine,NETO_PRODUCTS,NETO_STORE_URL,window,document,Response,AbortController,Uint8Array,
    performance:{now:()=>now},crypto:legacyCrypto?{getRandomValues:n=>webcrypto.getRandomValues(n)}:webcrypto,
    createTetris(options){game=engine.createTetris({random:()=>.2,...options});return game;},
    loadNetoImages(callback){if(failArt)return Promise.reject(Error('art unavailable'));queueMicrotask(callback);return Promise.resolve();},
    drawTetris(_ctx,current,options){draws.push({phase:current.phase,group:current.active?.group,...options});},
    drawTetromino(_ctx,type){previews.push(type);},
    drawZap(_ctx,snapshot,progress,options){zapDraws.push({snapshot,progress,...options});},
    requestAnimationFrame(callback){const id=++sequence;frames.set(id,callback);return id;},cancelAnimationFrame:id=>frames.delete(id)
  });
  const flush=()=>new Promise(resolve=>setImmediate(resolve));
  const target=selector=>({closest:pattern=>pattern.split(',').some(part=>part===selector||part==='[data-neto-action]'&&selector.startsWith('[data-neto-action='))?(selector.startsWith('[data-neto-action=')?root.querySelector(selector):{}):null});
  return {root,nodes,frames,requests,writes,draws,zapDraws,previews,document,window,flush,get game(){return game;},get html(){return html;},get backs(){return backs;},
    mount(){window.test.mountNetoTetris(root,()=>backs++);},
    async start(){this.mount();await flush();await this.click('[data-neto-start]');},
    async click(selector,detail=0){emit('root','click',{target:target(selector),detail});await flush();},
    key(key,code='',{repeat=false,editable=false,button=false}={}){let prevented=false;const target={closest:selector=>editable||button&&selector.split(',').includes('button')?target:null};emit('document','keydown',{key,code,repeat,target,preventDefault(){prevented=true;}});return prevented;},
    pointer(action){let prevented=false;const button=root.querySelector('[data-neto-action="'+action+'"]');emit('root','pointerdown',{isPrimary:true,button:0,target:{closest:selector=>selector==='[data-neto-action]'?button:null},preventDefault(){prevented=true;}});return prevented;},
    release(){emit('document','pointerup');},
    visibility(value){document.visibilityState=value;emit('document','visibilitychange');},
    advance(ms){const until=now+ms;while(now<until){now=Math.min(until,now+1000/60);const callbacks=[...frames.values()];frames.clear();for(const callback of callbacks)callback(now);}},
    jumpTime(ms){now+=ms;},
    input(value){emit('root','input',{target:{id:'netoScoreName',value}});},
    async submit(){emit('root','submit',{preventDefault(){},target:{matches:selector=>selector==='[data-neto-score-form]'}});await flush();},
    allowSave(){scoreStatus=200;},listenerCount(target,type){return listeners.get(target+'.'+type)?.size||0;}
  };
}
const tile=()=>({type:'J',group:1000,rotation:0,localX:0,localY:0});
function setActive(f,type='T',x=3,y=4,rotation=0){f.game.active={type,x,y,rotation,group:++f.game.sequence};f.game.gravity=f.game.lockTime=0;}
function clearRow(f){
  f.game.board[engine.ROWS-1]=Array.from({length:engine.COLS},(_,x)=>x>=3&&x<=6?null:tile());
  setActive(f,'I',3,0);f.key(' ','Space');
}
function topOut(f){
  for(const y of [0,1])f.game.board[y]=Array.from({length:engine.COLS},(_,x)=>x>=2&&x<=7?tile():null);
  setActive(f,'O',3,engine.ROWS-2);f.key(' ','Space');
}
async function finish(f,{withPoints=true}={}){
  for(let life=0;life<3;life++){
    if(withPoints)clearRow(f);topOut(f);
    if(life<2)await f.click('[data-neto-continue]');
  }
  await f.flush();
}

test('the bilingual opening tells the Fish family story without dashes and explains exact products, lives and ZAP',async()=>{
  for(const english of [false,true]){
    const f=fixture({english});f.mount();await f.flush();
    assert.match(f.html,english?/Hashmal Neto Tetris/:/חשמל נטו טטריס/);
    const story=f.html.match(/<p class="neto-story">([^<]+)<\/p>/)?.[1];assert.ok(story);assert.doesNotMatch(story,/[-‐‑‒–—־]/);
    assert.match(story,english?/Tomer/:/תומר/);assert.match(story,english?/Tedi/:/תדי/);assert.match(story,english?/Fish brothers/:/האחים פיש/);
    assert.match(f.html,english?/Three lives\./:/שלוש פסילות\./);
    assert.doesNotMatch(f.html,/כל הבית נופל למקום|Everything falls into place|הגבלת זמן|בלי שעון|No time limit|No clock/i);
    assert.match(f.html,english?/Clearing with ZAP adds no points/:/הניקוי עצמו לא מוסיף נקודות/);
    assert.equal((f.html.match(/data-neto-preview=/g)||[]).length,7);assert.ok(Object.keys(NETO_PRODUCTS).every(type=>f.previews.includes(type)));
    assert.match(f.html,/href="https:\/\/www\.netoneto\.co\.il\//);assert.equal(f.writes.length,0);assert.equal(f.frames.size,0);
  }
});
test('keyboard and phone controls move, rotate and drop once, while form inputs and repeated Space are ignored',async()=>{
  const f=fixture();await f.start();setActive(f,'T');const x=f.game.active.x;
  assert.equal(f.key('ArrowLeft','ArrowLeft'),true);assert.equal(f.game.active.x,x-1);assert.equal(f.pointer('right'),true);f.release();assert.equal(f.game.active.x,x);
  f.key('ArrowUp','ArrowUp');assert.equal(f.game.active.rotation,1);f.pointer('rotate');assert.equal(f.game.active.rotation,2);
  const y=f.game.active.y;f.pointer('down');f.release();assert.equal(f.game.active.y,y+1);
  const before={...f.game.active};assert.equal(f.key('ArrowLeft','ArrowLeft',{editable:true}),false);assert.deepEqual(f.game.active,before);
  const pieces=f.game.pieces;f.key(' ','Space',{repeat:true});assert.equal(f.game.pieces,pieces);f.key(' ','Space');assert.equal(f.game.pieces,pieces+1);
  assert.doesNotMatch(f.html,/role="timer"|data-neto-time|הגבלת זמן|בלי שעון|No time limit|No clock/i);
  const sideBrands=[...f.html.matchAll(/<[^>]+\bclass="[^"]*\bneto-side-brand-(?:left|right)\b[^"]*"[^>]*>/g)];
  assert.equal(sideBrands.length,2);for(const side of ['neto-side-brand-left','neto-side-brand-right'])assert.ok(sideBrands.some(match=>match[0].includes(side)));
  for(const brand of sideBrands)assert.match(brand[0],/aria-hidden="true"/);
  assert.equal((f.html.match(/src="assets\/games\/neto\/logo\.webp"/g)||[]).length,2);
});
test('holding a phone direction repeats until release and remounting leaves one set of listeners',async()=>{
  const f=fixture();await f.start();setActive(f,'T');f.advance(20);f.pointer('left');f.advance(480);assert.equal(f.game.active.x,0);
  f.release();f.advance(500);assert.equal(f.game.active.x,0);f.mount();await f.flush();assert.equal(f.listenerCount('document','keydown'),1);assert.equal(f.listenerCount('root','pointerdown'),1);
  assert.equal(f.frames.size,0);await f.click('[data-neto-resume]');setActive(f,'T');f.key('ArrowRight','ArrowRight');assert.equal(f.game.active.x,4);
});
test('Space on a focused button retains native activation instead of hard-dropping a product',async()=>{
  const f=fixture();await f.start();setActive(f,'T');const before={...f.game.active},pieces=f.game.pieces;
  assert.equal(f.key(' ','Space',{button:true}),false);assert.deepEqual(f.game.active,before);assert.equal(f.game.pieces,pieces);
  await f.click('[data-neto-action="rotate"]',0);assert.equal(f.game.active.rotation,1);assert.equal(f.game.pieces,pieces);
  assert.equal(f.key(' ','Space',{button:true}),false);assert.equal(f.game.pieces,pieces);await f.click('[data-neto-pause]',0);assert.equal(f.frames.size,0);
});
test('pause, hidden tabs and navigation preserve the same score and lives across long absences',async()=>{
  const f=fixture();await f.start();clearRow(f);const game=f.game,points=game.score,active={...game.active};
  await f.click('[data-neto-pause]');assert.equal(f.frames.size,0);f.advance(1000);f.key('ArrowLeft','ArrowLeft');assert.deepEqual(game.active,active);assert.equal(game.score,points);
  await f.click('[data-neto-resume]');assert.equal(f.frames.size,1);f.visibility('hidden');assert.equal(f.frames.size,0);f.jumpTime(3600000);f.visibility('visible');assert.equal(f.frames.size,0);
  assert.match(f.nodes.get('[data-neto-overlay]').innerHTML,/מוכנים\? ממשיכים מאותה נקודה\./);assert.doesNotMatch(f.nodes.get('[data-neto-overlay]').innerHTML,/הגבלת זמן|בלי שעון|No time limit|No clock/i);await f.click('[data-neto-resume]');f.advance(20);assert.equal(f.game,game);assert.equal(game.score,points);assert.equal(game.lives,3);
  await f.click('[data-neto-back]');assert.equal(f.backs,1);assert.equal(f.frames.size,0);f.jumpTime(86400000);f.mount();await f.flush();assert.equal(f.game,game);assert.equal(f.frames.size,0);
  await f.click('[data-neto-resume]');assert.equal(f.frames.size,1);assert.equal(game.phase,'playing');assert.equal(game.score,points);assert.equal(game.lives,3);
});
test('ZAP freezes the same products for its full animation, ignores repeated activation and clears without scoring',async()=>{
  const f=fixture();await f.start();clearRow(f);setActive(f,'S');f.game.board[19][0]=tile();const score=f.game.score,lines=f.game.lines,next=f.game.next[0],group=f.game.active.group;
  f.advance(20);f.pointer('zap');assert.equal(f.game.phase,'zapping');assert.equal(f.game.zaps,1);assert.equal(f.nodes.get('[data-neto-price]').hidden,false);
  assert.equal(f.zapDraws.at(-1).snapshot.length,5);f.pointer('zap');f.key('b','KeyB');f.key(' ','Space');assert.equal(f.game.zaps,1);assert.equal(f.game.active.group,group);
  f.advance(2500);assert.equal(f.game.phase,'zapping');assert.ok(f.game.board[19][0]);assert.equal(f.game.score,score);assert.equal(f.game.lines,lines);assert.equal(f.game.lives,3);
  f.advance(150);assert.equal(f.game.phase,'playing');assert.equal(f.game.board.flat().filter(Boolean).length,0);assert.equal(f.game.active.type,next);assert.notEqual(f.game.active.group,group);assert.equal(f.game.score,score);assert.equal(f.game.lines,lines);assert.equal(f.game.lives,3);assert.equal(f.nodes.get('[data-neto-price]').hidden,true);
  assert.equal(f.nodes.get('[data-neto-action="zap"]').disabled,false);assert.ok(f.zapDraws.some(draw=>draw.progress>.9));
});
test('a paused ZAP resumes its remaining animation and reduced motion uses a shorter clear',async()=>{
  const f=fixture();await f.start();f.advance(20);f.pointer('zap');f.advance(1000);const progress=f.zapDraws.at(-1).progress;
  f.key('p','KeyP');assert.equal(f.frames.size,0);assert.equal(f.nodes.get('[data-neto-price]').hidden,true);f.jumpTime(1000000);assert.equal(f.game.phase,'zapping');
  f.key('p','KeyP');assert.equal(f.frames.size,1);f.advance(20);assert.ok(f.zapDraws.at(-1).progress>=progress);f.advance(1700);assert.equal(f.game.phase,'playing');assert.equal(f.game.zaps,1);
  const reduced=fixture({reducedMotion:true});await reduced.start();reduced.advance(20);reduced.pointer('zap');reduced.advance(750);assert.equal(reduced.game.phase,'zapping');reduced.advance(100);assert.equal(reduced.game.phase,'playing');assert.ok(reduced.zapDraws.every(draw=>draw.reduced));
});
test('three full warehouses preserve points across lives and end with the cumulative score form in both languages',async()=>{
  for(const english of [false,true]){
    const f=fixture({english});await f.start();
    for(let n=0;n<3;n++){
      clearRow(f);assert.equal(f.game.score,(n+1)*100);topOut(f);assert.equal(f.game.lives,2-n);
      if(n<2){assert.equal(f.game.phase,'crashed');assert.equal(f.frames.size,0);assert.match(f.nodes.get('[data-neto-overlay]').innerHTML,english?/Your score is kept/:/הניקוד שלכם נשמר/);assert.doesNotMatch(f.html,/data-neto-score-form/);await f.click('[data-neto-continue]');assert.equal(f.game.board.flat().filter(Boolean).length,0);assert.equal(f.frames.size,1);}
    }
    await f.flush();assert.equal(f.game.phase,'finished');assert.equal(f.game.score,300);assert.equal(f.game.lines,3);assert.match(f.html,/data-neto-score-form/);assert.match(f.html,english?/Every point from all three lives/:/כל הנקודות משלוש הפסילות/);assert.equal(f.frames.size,0);assert.equal(f.writes.length,0);
  }
});
test('score save failures preserve the same request and final stats, and successful retries cannot submit twice',async()=>{
  const f=fixture({english:true,failSave:true});await f.start();await finish(f);f.input('  Warehouse   Champion  ');await f.submit();assert.equal(f.writes.length,1);
  assert.match(f.nodes.get('[data-neto-entry]').innerHTML,/could not be saved/);assert.match(f.nodes.get('[data-neto-entry]').innerHTML,/Warehouse   Champion/);f.allowSave();await f.submit();assert.equal(f.writes.length,2);assert.deepEqual(f.writes[0],f.writes[1]);
  const saved=f.writes[1];assert.match(saved.requestId,/^[a-f0-9]{32}$/);assert.equal(saved.name,'Warehouse Champion');assert.equal(saved.score,300);assert.equal(saved.lines,3);assert.equal(saved.level,1);assert.equal(saved.pieces,6);assert.equal(saved.zaps,0);
  assert.match(f.nodes.get('[data-neto-entry]').innerHTML,/is saved/);assert.match(f.nodes.get('[data-neto-leaderboard]').innerHTML,/Warehouse Champion/);await f.submit();assert.equal(f.writes.length,2);
  await f.click('[data-neto-start]');assert.equal(f.game.score,0);assert.equal(f.game.lives,3);assert.equal(f.frames.size,1);assert.doesNotMatch(f.html,/data-neto-score-form/);
});
test('leaderboard names are escaped, art failures leave gameplay available and no score writes occur before submission',async()=>{
  const f=fixture({failArt:true,initialScores:[{id:'x',name:'<img src=x onerror=alert(1)>',score:100,lines:1,level:1}]});f.mount();await f.flush();
  const leaderboard=f.nodes.get('[data-neto-leaderboard]').innerHTML;assert.match(leaderboard,/&lt;img/);assert.doesNotMatch(leaderboard,/<img src=x/);assert.equal(f.writes.length,0);assert.equal(f.requests.length,1);
  await f.click('[data-neto-start]');assert.equal(f.frames.size,1);assert.ok(f.draws.length);await finish(f,{withPoints:false});assert.equal(f.writes.length,0);f.input('');await f.submit();assert.equal(f.writes.length,0);assert.match(f.nodes.get('[data-neto-entry]').innerHTML,/60/);
});
test('browsers without randomUUID still save a secure run identifier',async()=>{
  const f=fixture({legacyCrypto:true});await f.start();await finish(f,{withPoints:false});f.input('Old browser');await f.submit();assert.equal(f.writes.length,1);assert.match(f.writes[0].requestId,/^[a-f0-9]{32}$/);
});
