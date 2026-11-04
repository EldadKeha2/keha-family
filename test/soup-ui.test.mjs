import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import * as engine from '../public/assets/soup.mjs';
import {ingredientIcon} from '../public/assets/soup-icons.mjs';

const source=(await readFile(new URL('../public/assets/soup.js',import.meta.url),'utf8')).replace(/^import[^\n]+\n/gm,'').replace(/export function /g,'function ');
function fixture({english=false,reducedMotion=false}={}){
  let now=1000,nextTimer=0,backs=0;const timers=new Map(),events=new Map(),nodes=new Map(),flights=[],animations=[];
  function node(dataset={}){return {dataset,style:{},disabled:false,hidden:false,textContent:'',innerHTML:'',className:'',removed:false,getBoundingClientRect(){return {left:100,top:100,width:120,height:150};},querySelector(selector){return nodeFor('child:'+JSON.stringify(dataset)+selector);},focus(){},scrollIntoView(){},setAttribute(){},remove(){this.removed=true;},animate(frames,options){animations.push({frames,options});return {};}};}
  function nodeFor(selector){if(!nodes.has(selector))nodes.set(selector,node());return nodes.get(selector);}
  const root={innerHTML:'',classList:{add(){},remove(){}},querySelector(selector){const needle=selector.startsWith('[')?selector.slice(1,-1):selector.slice(1);return root.innerHTML.includes(needle)?nodeFor(selector):null;},querySelectorAll(selector){
    if(selector==='[data-soup-add]')return [...root.innerHTML.matchAll(/data-soup-add="([^"]+)"/g)].map(match=>{const n=nodeFor('ingredient:'+match[1]);n.dataset.soupAdd=match[1];return n;});
    if(selector.includes('[data-soup-finish]'))return [nodeFor('[data-soup-finish]'),nodeFor('[data-soup-reset]')];return [];
  },addEventListener(type,fn,{signal}={}){events.set(type,fn);signal?.addEventListener('abort',()=>{if(events.get(type)===fn)events.delete(type);});}};
  const document={visibilityState:'visible',createElement:()=>node(),body:{appendChild(item){flights.push(item);}},addEventListener(type,fn,{signal}={}){events.set(type,fn);signal?.addEventListener('abort',()=>{if(events.get(type)===fn)events.delete(type);});}};
  const window={matchMedia:()=>({matches:reducedMotion}),FamilyI18n:{isEnglish:english}};
  const FakeDate=class extends Date{static now(){return now;}};
  vm.runInNewContext(source+'\nwindow.soupTest={mountSoup,pauseSoup,getGame:()=>game};',{...engine,ingredientIcon,window,document,AbortController,Date:FakeDate,setTimeout(fn,delay){const id=++nextTimer;timers.set(id,{fn,due:now+delay,repeat:0});return id;},clearTimeout:id=>timers.delete(id),setInterval(fn,delay){const id=++nextTimer;timers.set(id,{fn,due:now+delay,repeat:delay});return id;},clearInterval:id=>timers.delete(id)});
  const flush=()=>new Promise(resolve=>setImmediate(resolve));
  const f={nodes,events,timers,flights,animations,document,window,flush,get html(){return root.innerHTML;},get game(){return window.soupTest.getGame();},get backs(){return backs;},mount(){window.soupTest.mountSoup(root,()=>backs++);},async click(selector,dataset={}){const target=node(dataset);events.get('click')({target:{closest:pattern=>pattern===selector?target:null}});await flush();},advance(ms){const target=now+ms;while(true){const due=[...timers.entries()].sort((a,b)=>a[1].due-b[1].due)[0];if(!due||due[1].due>target)break;now=due[1].due;if(due[1].repeat)due[1].due+=due[1].repeat;else timers.delete(due[0]);due[1].fn();}now=target;},jump(ms){now+=ms;},visibility(value){document.visibilityState=value;events.get('visibilitychange')();},async add(id){await f.click('[data-soup-add]',{soupAdd:id});},async remove(id){await f.click('[data-soup-remove]',{soupRemove:id});}};
  return f;
}
async function prepared(f){f.mount();await f.click('[data-soup-start]');await f.click('[data-soup-water]');f.advance(1200);await f.click('[data-soup-heat]');}
async function correctRecipe(f){for(const [id,amount] of Object.entries(engine.SECRET_RECIPE)){const item=engine.INGREDIENTS.find(item=>item.id===id);for(let n=0;n<amount/item.step;n++){await f.add(id);f.advance(1200);}}}
test('the bilingual story hides the solution and opens a pantry with twelve equally presented options',async()=>{
  for(const english of [false,true]){const f=fixture({english});f.mount();assert.match(f.html,english?/The Secret in the Pot/:/הסוד שבסיר/);assert.match(f.html,/assets\/games\/soup\/yona-chef.webp/);assert.match(f.html,english?/secret recipe/:/מתכון סודי/);assert.doesNotMatch(f.html,/data-soup-add|soup-revealed-recipe/);await f.click('[data-soup-start]');assert.equal((f.html.match(/data-soup-add="/g)||[]).length,12);assert.match(f.html,english?/Necks/:/גרונות/);assert.match(f.html,/¼/);assert.equal(f.game.phase,'playing');}
});
test('an ingredient goes from the clicked shelf through both hand poses into the pot once, with a guarded finish button',async()=>{
  const f=fixture();await prepared(f);const before=f.animations.length;await f.add('carrot');await f.add('carrot');assert.equal(f.game.contents.carrot,undefined);assert.equal(f.animations.length,before+1);assert.equal(f.nodes.get('[data-soup-chef]').dataset.pose,'pick');assert.equal(f.nodes.get('[data-soup-finish]').disabled,true);await f.click('[data-soup-finish]');assert.equal(f.game.attempts,0);f.advance(420);assert.equal(f.nodes.get('[data-soup-chef]').dataset.pose,'throw');f.advance(520);assert.equal(f.game.contents.carrot,1);f.advance(260);assert.equal(f.game.contents.carrot,1);assert.equal(f.nodes.get('[data-soup-chef]').dataset.pose,'idle');assert.equal(f.nodes.get('[data-soup-finish]').disabled,false);assert.ok(f.flights.every(item=>item.removed));
});
test('water and a real boiling interval are mandatory and remain intact while ingredients are animated',async()=>{
  const f=fixture();f.mount();await f.click('[data-soup-start]');await f.add('potato');assert.equal(f.game.feedback,'water');assert.equal(f.flights.length,0);await f.click('[data-soup-heat]');assert.equal(f.game.heat,false);await f.click('[data-soup-water]');f.advance(1200);assert.equal(f.game.water,true);await f.click('[data-soup-heat]');f.advance(engine.BOIL_MS-1);assert.equal(f.game.boiled,false);f.advance(151);assert.equal(f.game.boiled,true);await f.add('potato');f.advance(1200);assert.equal(f.game.boiled,true);assert.equal(f.game.contents.potato,1);
});
test('only submitting the exact recipe wins; an extra ingredient can be corrected without losing the pot',async()=>{
  for(const english of [false,true]){const f=fixture({english});await prepared(f);await correctRecipe(f);assert.equal(f.game.phase,'playing');await f.add('onion');f.advance(1200);await f.click('[data-soup-finish]');assert.equal(f.game.phase,'playing');assert.equal(f.game.feedback,'recipe');assert.match(f.nodes.get('[data-soup-feedback]').textContent,english?/Not quite/:/עוד לא/);await f.remove('onion');assert.equal(f.game.boiled,true);await f.click('[data-soup-finish]');assert.equal(f.game.phase,'success');assert.match(f.html,english?/You did it!!!/:/הצלחת!!!/);assert.match(f.html,/soup-revealed-recipe/);assert.match(f.html,english?/Boiling water/:/מים רותחים/);assert.match(f.html,/¼/);assert.equal(f.game.attempts,2);assert.equal(f.timers.size,0);}
});
test('leaving during a throw commits the selected portion once and removes animation artifacts; boiling continues by deadline',async()=>{
  const f=fixture();await prepared(f);await f.add('neck');f.advance(300);f.window.soupTest.pauseSoup();assert.equal(f.game.contents.neck,1);assert.equal(f.timers.size,0);assert.ok(f.flights.every(item=>item.removed));f.jump(10000);f.mount();assert.equal(f.game.boiled,true);assert.equal(f.game.contents.neck,1);f.advance(2000);assert.equal(f.game.contents.neck,1);await f.click('[data-soup-back]');assert.equal(f.backs,1);assert.equal(f.timers.size,0);
});
test('hidden-tab cleanup and reduced-motion input never duplicate or lose a chosen ingredient',async()=>{
  const f=fixture();await prepared(f);await f.add('potato');f.visibility('hidden');assert.equal(f.game.contents.potato,1);assert.equal(f.timers.size,0);f.jump(10000);f.visibility('visible');assert.equal(f.game.boiled,true);assert.equal(f.game.contents.potato,1);
  const quiet=fixture({reducedMotion:true});await prepared(quiet);await quiet.add('hawaij');assert.equal(quiet.game.contents.hawaij,.25);assert.equal(quiet.animations.length,0);assert.equal(quiet.nodes.get('[data-soup-finish]').disabled,false);
});
test('a fresh pot clears all ingredients, water and heating and still permits returning to game selection',async()=>{
  const f=fixture();await prepared(f);await f.add('paprika');f.advance(1200);await f.click('[data-soup-reset]');assert.equal(Object.keys(f.game.contents).length,0);assert.equal(f.game.water,false);assert.equal(f.game.heat,false);assert.equal(f.game.boiled,false);assert.equal(f.timers.size,0);assert.equal(f.game.phase,'playing');await f.click('[data-soup-back]');assert.equal(f.backs,1);
});
