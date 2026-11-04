import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import * as engine from '../public/assets/jachnun.mjs';
import {PREPARED_HEADS} from '../public/assets/jachnun-heads.mjs';
import {webcrypto} from 'node:crypto';
const source=(await readFile(new URL('../public/assets/jachnun.js',import.meta.url),'utf8')).replace(/^import[^\n]+\n/gm,'').replace(/export function /g,'function ');
function fixture({english=false,fail=false,manualImages=false,requestStatus=200}={}){
  const events=new Map(),nodes=new Map(),images=[],timers=new Map(),requests=[],copied=[],turns=[],writes=[];let timerId=0,backs=0;
  const context=new Proxy({},{get:()=>()=>{}});
  const node=()=>({style:{},disabled:false,hidden:false,textContent:'',innerHTML:'',getContext:()=>context,querySelector:()=>({focus(){}}),focus(){},select(){},scrollIntoView(){}});
  const root={innerHTML:'',classList:{add(){},remove(){}},querySelector(selector){if(!nodes.has(selector))nodes.set(selector,node());return nodes.get(selector);},querySelectorAll:()=>[node(),node(),node()],addEventListener(type,fn){events.set(type,fn);}};
  const document={visibilityState:'visible',createElement:node,addEventListener(type,fn){events.set(type,fn);}};
  const people={yona:{id:'yona',name:'יונה נקאש',nameEn:'Yona Nakash'},eldad:{id:'eldad',name:'אלדד קהא',nameEn:'Eldad Keha'}};
  const window={location:{origin:'https://family.test'},FAMILY_DATA:{people},FamilyApp:{getPersonSummary:id=>({...people[id],profile:'/cached/'+id})},FamilyI18n:{isEnglish:english,language:english?'en':'he',locale:english?'en-US':'he-IL',personName:p=>english?p.nameEn:p.name,error:String,fetch:async (path,options)=>{requests.push(path);if(options?.method==='POST'){writes.push(JSON.parse(options.body));return Response.json(requestStatus===200?{sent:true}:{error:'failed'},{status:requestStatus});}if(fail)throw Error('Offline');return Response.json({people:{yona:{profile:'/media/yona'},eldad:{profile:'/media/eldad'}}});}}};
  class Image{constructor(){this.naturalWidth=414;this.naturalHeight=444;images.push(this);}set src(value){this.url=value;if(!manualImages)queueMicrotask(()=>this.onload());}}
  vm.runInNewContext(source+'\nwindow.test={mountJachnun,pauseJachnun};',{...engine,PREPARED_HEADS,crypto:webcrypto,turnSnake(state,direction){turns.push(direction);return engine.turnSnake(state,direction);},window,document,Image,Response,AbortController,URL,navigator:{clipboard:{async writeText(v){copied.push(v);}}},setTimeout(fn){const id=++timerId;timers.set(id,fn);return id;},clearTimeout(id){timers.delete(id);}});
  const flush=()=>new Promise(resolve=>setImmediate(resolve));
  const click=async(selector,dataset={})=>{events.get('click')({target:{closest:s=>s===selector?{dataset}:null}});await flush();};
  return {root,nodes,images,timers,requests,copied,turns,writes,document,events,window,flush,get html(){return root.innerHTML;},get backs(){return backs;},mount(){window.test.mountJachnun(root,()=>{backs++;});},click,load(index=images.length-1){images[index].onload();},tick(){const entry=timers.entries().next().value;if(entry){timers.delete(entry[0]);entry[1]();}},async select(id){events.get('change')({target:{id:'jachnunCharacter',value:id}});await flush();},key(key,code=''){let prevented=false;events.get('keydown')({key,code,target:{matches:()=>false},preventDefault(){prevented=true;}});return prevented;}};
}
test('both languages select Grandma Yona by default, use her real portrait, and wait for the head before playing',async()=>{
  for(const english of [false,true]){
    const f=fixture({english,manualImages:true});f.mount();await f.flush();assert.match(f.html,english?/Catch the Jachnun/:/תפוס תג׳חנון/);assert.match(f.html,/<option value="yona" selected>/);assert.match(f.html,english?/Grandma Yona/:/סבתא יונה/);assert.deepEqual(f.requests,[]);assert.equal(f.images[0].url,PREPARED_HEADS.find(h=>h.id==='yona').src);assert.equal(f.nodes.get('[data-jachnun-start]').disabled,true);
    await f.click('[data-jachnun-start]');assert.equal(f.timers.size,0);f.load();assert.equal(f.nodes.get('[data-jachnun-start]').disabled,false);await f.click('[data-jachnun-start]');assert.equal(f.timers.size,1);assert.equal((f.html.match(/class="jachnun-life"/g)||[]).length,3);assert.doesNotMatch(f.html,/♥|♡/);assert.match(f.html,/data-jachnun-direction="up"/);
  }
});
test('changing character ignores a stale photo load and keeps the selected person for the game',async()=>{
  const f=fixture({manualImages:true});f.mount();await f.flush();await f.select('eldad');assert.equal(f.images[1].url,PREPARED_HEADS.find(h=>h.id==='eldad').src);f.load(0);assert.equal(f.nodes.get('[data-jachnun-start]').disabled,true);f.load(1);await f.click('[data-jachnun-start]');assert.match(f.html,/אלדד קהא/);assert.equal(f.timers.size,1);
});
test('three crashes finish once, retain score, offer sharing and restart with three lives',async()=>{
  const f=fixture();f.mount();await f.flush();await f.click('[data-jachnun-start]');
  for(let life=2;life>=0;life--){for(let i=0;i<18&&f.timers.size;i++)f.tick();assert.equal(f.timers.size,0);if(life){assert.match(f.html,new RegExp('נותרו '+life));await f.click('[data-jachnun-continue]');}else{assert.match(f.html,/נגמרו הפסילות/);assert.match(f.html,/game-share-whatsapp/);assert.match(f.html,/mailto:/);}}
  await f.click('[data-jachnun-share]');assert.match(f.copied[0],/תפוס תג׳חנון/);assert.match(f.copied[0],/סבתא יונה/);await f.click('[data-jachnun-restart]');assert.equal((f.html.match(/class="jachnun-life"/g)||[]).length,3);assert.doesNotMatch(f.html,/♥|♡/);assert.equal(f.timers.size,1);
});
test('space, tab visibility and leaving the games stop movement until an explicit resume',async()=>{
  const f=fixture();f.mount();await f.flush();await f.click('[data-jachnun-start]');assert.equal(f.key(' '),true);assert.equal(f.timers.size,0);assert.match(f.html,/רגע לנשום/);await f.click('[data-jachnun-pause]');assert.equal(f.timers.size,1);
  f.document.visibilityState='hidden';f.events.get('visibilitychange')();assert.equal(f.timers.size,0);f.document.visibilityState='visible';f.events.get('visibilitychange')();assert.equal(f.timers.size,0);await f.click('[data-jachnun-pause]');assert.equal(f.timers.size,1);
  f.window.test.pauseJachnun();assert.equal(f.timers.size,0);f.mount();await f.flush();assert.match(f.html,/רגע לנשום/);assert.equal(f.timers.size,0);await f.click('[data-jachnun-back]');assert.equal(f.backs,1);assert.equal(f.timers.size,0);
});
test('profile changes and unavailable live media never replace the reviewed, fixed head snapshots',async()=>{
  const f=fixture({fail:true});f.mount();await f.flush();assert.equal(f.images[0].url,PREPARED_HEADS.find(h=>h.id==='yona').src);assert.equal(f.nodes.get('[data-jachnun-start]').disabled,false);assert.deepEqual(f.requests,[]);
});

test('phone swipes and direction buttons steer without moving for taps or cancelled gestures',async()=>{
  const f=fixture();f.mount();await f.flush();await f.click('[data-jachnun-start]');
  const canvas={closest:selector=>selector==='[data-jachnun-board]'?{}:null,setPointerCapture(){}};
  const down=(x,y)=>f.events.get('pointerdown')({target:canvas,pointerId:7,button:0,clientX:x,clientY:y});
  const up=(x,y)=>f.events.get('pointerup')({pointerId:7,clientX:x,clientY:y});
  down(100,100);let blocked=false;f.events.get('pointermove')({pointerId:7,preventDefault(){blocked=true;}});up(102,40);assert.equal(blocked,true);assert.equal(f.turns.at(-1),'up');
  down(100,100);up(101,102);assert.equal(f.turns.length,1);
  down(100,100);f.events.get('pointercancel')();up(30,100);assert.equal(f.turns.length,1);
  await f.click('[data-jachnun-direction]',{jachnunDirection:'left'});assert.equal(f.turns.at(-1),'left');
});

test('the head request explains missing heads, requires a name and sends only an explicit request',async()=>{
  for(const english of [false,true]){
    const f=fixture({english});f.mount();await f.flush();assert.match(f.html,english?/Is my head missing from the list/:/הראש שלי לא נמצא ברשימת הראשים/);assert.match(f.html,/id="jachnunRequestName"[^>]*required/);assert.match(f.html,english?/Request your head/:/דרוש שהראש שלך יופיע/);
    const submit=()=>f.events.get('submit')({preventDefault(){},target:{matches:()=>true}});
    submit();await f.flush();assert.equal(f.writes.length,0);
    f.events.get('input')({target:{id:'jachnunRequestName',value:'אלדד קהא'}});submit();submit();await f.flush();assert.equal(f.writes.length,1);assert.equal(f.requests[0],'api/games/jachnun/head-request');assert.equal(f.writes[0].name,'אלדד קהא');assert.equal(f.writes[0].language,english?'en':'he');assert.match(f.writes[0].requestId,/^[a-f0-9]{32}$/);assert.match(f.html,english?/Your request was sent to Eldad/:/הבקשה נשלחה לאלדד/);submit();await f.flush();assert.equal(f.writes.length,1);
  }
});
test('mail delivery errors never display success and preserve the name and id for a safe retry',async()=>{
  const f=fixture({requestStatus:503});f.mount();await f.flush();f.events.get('input')({target:{id:'jachnunRequestName',value:'Eldad Keha'}});
  const submit=()=>f.events.get('submit')({preventDefault(){},target:{matches:()=>true}});submit();await f.flush();assert.match(f.html,/לא ניתן לשלוח/);assert.doesNotMatch(f.html,/הבקשה נשלחה לאלדד/);assert.match(f.html,/value="Eldad Keha"/);submit();await f.flush();assert.equal(f.writes.length,2);assert.equal(f.writes[0].requestId,f.writes[1].requestId);
});
