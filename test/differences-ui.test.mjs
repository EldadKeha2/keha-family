import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import family from '../src/family.mjs';
import {differencePuzzles,differenceLevels,createDifferenceRound,beginDifferenceRound,checkDifferenceTime,markDifference} from '../public/assets/differences.mjs';
const source=(await readFile(new URL('../public/assets/differences.js',import.meta.url),'utf8')).replace(/^import[^\n]+\n/gm,'');
function fixture(english=false){
  let now=10000,nextId=0;const intervals=new Map(),nodes=new Map(),events=new Map(),images=[];
  class Node{
    constructor(){this.handlers=new Map();this.hidden=false;this.style={};this.dataset={};this.textContent='';this.classList={toggle(){}};}
    addEventListener(kind,fn){this.handlers.set(kind,fn);}
    setAttribute(){}focus(){}scrollIntoView(){}
    getBoundingClientRect(){return {left:0,top:0,width:1000,height:1000};}
    set innerHTML(html){this.html=html;for(const m of html.matchAll(/id="([^"]+)"/g))nodes.set(m[1],new Node());}
    get innerHTML(){return this.html;}
    querySelector(s){if(!nodes.has(s))nodes.set(s,new Node());return nodes.get(s);}
    querySelectorAll(s){return [this.querySelector(s+':one'),this.querySelector(s+':two')];}
  }
  nodes.set('familyGamesContent',new Node());const root=nodes.get('familyGamesContent');
  const document={visibilityState:'visible',getElementById:id=>nodes.get(id),addEventListener:(kind,fn)=>events.set(kind,fn)};
  const window={FAMILY_DATA:family,FamilyI18n:{isEnglish:english,personName:p=>english?p.nameEn:p.name},FamilyGames:{showLobby(){window.FamilyDifferences.close();root.innerHTML='lobby';}}};
  vm.runInNewContext(source,{window,document,differencePuzzles,differenceLevels,createDifferenceRound,beginDifferenceRound:(r)=>beginDifferenceRound(r,now),checkDifferenceTime:(r)=>checkDifferenceTime(r,now),markDifference:(r,x,y)=>markDifference(r,x,y,now),shuffled:x=>[...x],Date:class extends Date{static now(){return now;}},Image:class{constructor(){images.push(this);}},setInterval(fn,ms){const id=++nextId;intervals.set(id,{fn,ms,next:now+ms});return id;},clearInterval:id=>intervals.delete(id)});
  events.get('DOMContentLoaded')();const flush=()=>new Promise(resolve=>setImmediate(resolve));
  async function click(selector,position={}){root.handlers.get('click')({detail:1,...position,target:{closest:s=>s===selector?root.querySelector(s):null}});await flush();}
  return {window,images,nodes,intervals,get html(){return root.innerHTML;},open:()=>window.FamilyDifferences.open(),start:()=>click('[data-diff-start]'),next:()=>click('[data-diff-next]'),retry:()=>click('[data-diff-retry]'),lobby:()=>click('[data-diff-lobby]'),find:(x,y)=>click('[data-diff-stage]',{clientX:x*1000,clientY:y*1000}),
    async load(start=images.length-2){images[start].onload();images[start+1].onload();await flush();},async error(){images.at(-1).onerror();await flush();},
    advance(ms){const target=now+ms;while(true){const due=[...intervals].sort((a,b)=>a[1].next-b[1].next)[0];if(!due||due[1].next>target)break;now=due[1].next;due[1].next+=due[1].ms;due[1].fn();}now=target;},
    visibility(v){document.visibilityState=v;events.get('visibilitychange')();}
  };
}
test('both localized games wait for both assets, show canonical tags under each photo, and award only complete photos',async()=>{
  for(const english of [false,true]){
    const f=fixture(english);f.open();assert.match(f.html,english?/Choose your difficulty/:/בחרו רמת קושי/);await f.start();assert.equal(f.intervals.size,0);assert.match(f.html,/diff-tags/);assert.equal((f.html.match(/<span>Elan Blum<\/span>/g)||[]).length,english?2:0);
    f.images[0].onload();await new Promise(resolve=>setImmediate(resolve));assert.equal(f.intervals.size,0);f.images[1].onload();await new Promise(resolve=>setImmediate(resolve));assert.equal(f.intervals.size,1);
    for(let i=0;i<5;i++){
      if(i)await f.load();for(const d of differencePuzzles[i].differences.easy)await f.find(d.x,d.y);
      assert.match(f.nodes.get('diffStatus').textContent,english?/earned a point/:/קיבלתם נקודה/);await f.next();
    }
    assert.match(f.html,/<strong>100<\/strong>/);assert.equal(f.intervals.size,0);
  }
});
test('three mistakes automatically skip with no point, old loads cannot start the next photo, and timeout also skips',async()=>{
  const f=fixture();f.open();await f.start();await f.load();for(let i=0;i<3;i++)await f.find(0,0);assert.match(f.nodes.get('diffStatus').textContent,/שלוש טעויות/);f.advance(1400);assert.match(f.html,/2 \/ 5/);assert.equal(f.intervals.size,0);await f.load(0);assert.equal(f.intervals.size,0);await f.load();assert.equal(f.intervals.size,1);f.advance(120000);assert.match(f.nodes.get('diffStatus').textContent,/הזמן נגמר/);f.advance(1400);assert.match(f.html,/3 \/ 5/);
  await f.lobby();await f.load();assert.equal(f.intervals.size,0);assert.equal(f.html,'lobby');
});
test('failed loads allow retry without using time and hidden images begin only on returning',async()=>{
  const f=fixture();f.open();await f.start();await f.error();assert.match(f.nodes.get('diffStatus').textContent,/לא הצלחנו/);f.advance(200000);assert.equal(f.intervals.size,0);await f.retry();f.visibility('hidden');await f.load();f.advance(200000);f.visibility('visible');assert.equal(f.nodes.get('diffTime').textContent,'2:00');f.advance(1000);assert.equal(f.nodes.get('diffTime').textContent,'1:59');
});
