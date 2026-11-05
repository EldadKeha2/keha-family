import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import * as engine from '../public/assets/soup.mjs';
import {ingredientIcon,portionIcon} from '../public/assets/soup-icons.mjs';

const source=(await readFile(new URL('../public/assets/soup.js',import.meta.url),'utf8')).replace(/^import[^\n]+\n/gm,'').replace(/export function /g,'function ');
function fixture({english=false,reducedMotion=false}={}){
  let now=1000,nextTimer=0,backs=0;const timers=new Map(),events=new Map(),nodes=new Map(),flights=[],animations=[];
  function node(dataset={}){return {dataset,style:{setProperty(name,value){this[name]=value;}},disabled:false,hidden:false,textContent:'',innerHTML:'',className:'',removed:false,getBoundingClientRect(){return {left:100,top:100,width:120,height:150};},querySelector(selector){const child=nodeFor('child:'+JSON.stringify(dataset)+selector);if(selector==='.soup-ingredient-icon'){child.innerHTML=dataset.soupAdd?ingredientIcon(dataset.soupAdd):'';child.getBoundingClientRect=()=>({left:20,top:30,width:58,height:58});}return child;},focus(){},scrollIntoView(){},setAttribute(){},remove(){this.removed=true;},animate(frames,options){animations.push({frames,options});return {};}};}
  function nodeFor(selector){if(!nodes.has(selector))nodes.set(selector,node());return nodes.get(selector);}
  const root={innerHTML:'',classList:{add(){},remove(){}},querySelector(selector){const needle=selector.startsWith('[')?selector.slice(1,-1):selector.slice(1);return root.innerHTML.includes(needle)?nodeFor(selector):null;},querySelectorAll(selector){
    if(selector==='[data-picked]')return [...nodes.values()].filter(n=>n.dataset.picked);
    if(selector==='[data-soup-add]')return [...root.innerHTML.matchAll(/data-soup-add="([^"]+)"/g)].map(match=>{const n=nodeFor('ingredient:'+match[1]);n.dataset.soupAdd=match[1];return n;});
    if(selector.includes('[data-soup-finish]'))return [nodeFor('[data-soup-finish]'),nodeFor('[data-soup-reset]')];return [];
  },addEventListener(type,fn,{signal}={}){events.set(type,fn);signal?.addEventListener('abort',()=>{if(events.get(type)===fn)events.delete(type);});}};
  const document={visibilityState:'visible',createElement:()=>node(),body:{appendChild(item){flights.push(item);}},addEventListener(type,fn,{signal}={}){events.set(type,fn);signal?.addEventListener('abort',()=>{if(events.get(type)===fn)events.delete(type);});}};
  const window={matchMedia:()=>({matches:reducedMotion}),FamilyI18n:{isEnglish:english}};
  const FakeDate=class extends Date{static now(){return now;}};
  vm.runInNewContext(source+'\nwindow.soupTest={mountSoup,pauseSoup,getGame:()=>game};',{...engine,ingredientIcon,portionIcon,window,document,AbortController,Date:FakeDate,setTimeout(fn,delay){const id=++nextTimer;timers.set(id,{fn,due:now+delay,repeat:0});return id;},clearTimeout:id=>timers.delete(id),setInterval(fn,delay){const id=++nextTimer;timers.set(id,{fn,due:now+delay,repeat:delay});return id;},clearInterval:id=>timers.delete(id)});
  const flush=()=>new Promise(resolve=>setImmediate(resolve));
  const f={nodes,events,timers,flights,animations,document,window,flush,get html(){return root.innerHTML;},get game(){return window.soupTest.getGame();},get backs(){return backs;},get now(){return now;},mount(){window.soupTest.mountSoup(root,()=>backs++);},async click(selector,dataset={}){const target=node(dataset);events.get('click')({target:{closest:pattern=>pattern===selector?target:null}});await flush();},advance(ms){const target=now+ms;while(true){const due=[...timers.entries()].sort((a,b)=>a[1].due-b[1].due)[0];if(!due||due[1].due>target)break;now=due[1].due;if(due[1].repeat)due[1].due+=due[1].repeat;else timers.delete(due[0]);due[1].fn();}now=target;},jump(ms){now+=ms;},visibility(value){document.visibilityState=value;events.get('visibilitychange')();},async add(id){await f.click('[data-soup-add]',{soupAdd:id});},async remove(id){await f.click('[data-soup-remove]',{soupRemove:id});}};
  return f;
}
async function prepared(f){f.mount();await f.click('[data-soup-start]');await f.click('[data-soup-water]');f.advance(3000);await f.click('[data-soup-heat]');}
async function correctRecipe(f){for(const [id,amount] of Object.entries(engine.SECRET_RECIPE)){const item=engine.INGREDIENTS.find(item=>item.id===id);for(let n=0;n<amount/item.step;n++){await f.add(id);f.advance(3000);}}}
test('the bilingual story hides the solution and opens a pantry with twelve equally presented options',async()=>{
  for(const english of [false,true]){const f=fixture({english});f.mount();assert.match(f.html,english?/The Secret Recipe/:/המתכון הסודי/);assert.match(f.html,/assets\/games\/soup\/yona-chef.webp/);assert.match(f.html,english?/secret recipe/:/מתכון סודי/);assert.doesNotMatch(f.html,/data-soup-add|soup-revealed-recipe/);await f.click('[data-soup-start]');assert.equal((f.html.match(/data-soup-add="/g)||[]).length,12);assert.match(f.html,english?/Necks/:/גרונות/);assert.match(f.html,/¼/);assert.equal(f.game.phase,'playing');}
});
test('the actual shelf ingredient is carried slowly and lowered into the pot once, with a guarded finish button',async()=>{
  const f=fixture();await prepared(f);const before=f.animations.length;await f.add('carrot');await f.add('carrot');assert.equal(f.game.contents.carrot,undefined);assert.equal(f.animations.length,before+1);assert.equal(f.nodes.get('[data-soup-chef]').dataset.pose,'pick');assert.equal(f.nodes.get('[data-soup-finish]').disabled,true);await f.click('[data-soup-finish]');assert.equal(f.game.attempts,0);assert.equal(f.flights.at(-1).dataset.ingredient,'carrot');assert.equal(f.flights.at(-1).innerHTML,ingredientIcon('carrot'));assert.match(f.animations.at(-1).frames[0].transform,/translate\(25px,35px\)/);assert.ok(f.animations.at(-1).options.duration>=2500);f.advance(1049);assert.equal(f.nodes.get('[data-soup-chef]').dataset.pose,'pick');f.advance(1);assert.equal(f.nodes.get('[data-soup-chef]').dataset.pose,'place');f.advance(1349);assert.equal(f.game.contents.carrot,undefined);f.advance(1);assert.equal(f.game.contents.carrot,1);f.advance(400);assert.equal(f.game.contents.carrot,1);assert.equal(f.nodes.get('[data-soup-chef]').dataset.pose,'idle');assert.equal(f.nodes.get('[data-soup-finish]').disabled,false);assert.ok(f.flights.every(item=>item.removed));
});
test('adding water automatically lights the flame and waits for the full boil, which remains intact during cooking',async()=>{
  const f=fixture();f.mount();await f.click('[data-soup-start]');await f.add('potato');assert.equal(f.game.feedback,'water');assert.equal(f.flights.length,0);await f.click('[data-soup-heat]');assert.equal(f.game.heat,false);await f.click('[data-soup-water]');f.advance(3000);assert.equal(f.game.water,true);assert.equal(f.game.heat,true);assert.equal(f.nodes.get('[data-soup-kitchen]').dataset.heat,'true');const deadline=f.game.boilAt;await f.click('[data-soup-heat]');assert.equal(f.game.boilAt,deadline);f.advance(deadline-f.now-1);assert.equal(f.game.boiled,false);f.advance(151);assert.equal(f.game.boiled,true);await f.add('potato');f.advance(3000);assert.equal(f.game.boiled,true);assert.equal(f.game.contents.potato,1);
});
test('only submitting the exact recipe wins; an extra ingredient can be corrected without losing the pot',async()=>{
  for(const english of [false,true]){const f=fixture({english});await prepared(f);await correctRecipe(f);assert.equal(f.game.phase,'playing');await f.add('onion');f.advance(3000);await f.click('[data-soup-finish]');assert.equal(f.game.phase,'playing');assert.equal(f.game.feedback,'recipe');assert.match(f.nodes.get('[data-soup-feedback]').textContent,english?/Not quite/:/עוד לא/);await f.remove('onion');assert.equal(f.game.boiled,true);await f.click('[data-soup-finish]');assert.equal(f.game.phase,'success');assert.match(f.html,english?/You did it!!!/:/הצלחת!!!/);assert.match(f.html,/soup-revealed-recipe/);assert.match(f.html,english?/Boiling water/:/מים רותחים/);assert.match(f.html,/¼/);assert.equal(f.game.attempts,2);assert.equal(f.timers.size,0);}
});
test('leaving while carrying an ingredient commits the selected portion once and removes animation artifacts; boiling continues by deadline',async()=>{
  const f=fixture();await prepared(f);await f.add('neck');f.advance(300);f.window.soupTest.pauseSoup();assert.equal(f.game.contents.neck,1);assert.equal(f.timers.size,0);assert.ok(f.flights.every(item=>item.removed));f.jump(10000);f.mount();assert.equal(f.game.boiled,true);assert.equal(f.game.contents.neck,1);f.advance(2000);assert.equal(f.game.contents.neck,1);await f.click('[data-soup-back]');assert.equal(f.backs,1);assert.equal(f.timers.size,0);
});
test('hidden-tab cleanup and reduced-motion input never duplicate or lose a chosen ingredient',async()=>{
  const f=fixture();await prepared(f);await f.add('potato');f.visibility('hidden');assert.equal(f.game.contents.potato,1);assert.equal(f.timers.size,0);f.jump(10000);f.visibility('visible');assert.equal(f.game.boiled,true);assert.equal(f.game.contents.potato,1);
  const quiet=fixture({reducedMotion:true});await prepared(quiet);await quiet.add('hawaij');assert.equal(quiet.game.contents.hawaij,.25);assert.equal(quiet.animations.length,0);assert.equal(quiet.nodes.get('[data-soup-finish]').disabled,false);
});
test('a fresh pot clears all ingredients, water and heating and still permits returning to game selection',async()=>{
  const f=fixture();await prepared(f);await f.add('paprika');f.advance(3000);await f.click('[data-soup-reset]');assert.equal(Object.keys(f.game.contents).length,0);assert.equal(f.game.water,false);assert.equal(f.game.heat,false);assert.equal(f.game.boiled,false);assert.equal(f.timers.size,0);assert.equal(f.game.phase,'playing');await f.click('[data-soup-back]');assert.equal(f.backs,1);
});

test('slow stirring is visual only, guards input, and leaves the complete recipe and tasting attempts untouched',async()=>{
  for(const english of [false,true]){
    const f=fixture({english});await prepared(f);await correctRecipe(f);const before=f.game;
    await f.click('[data-soup-stir]');assert.equal(f.nodes.get('[data-soup-kitchen]').dataset.stirring,'true');assert.equal(f.nodes.get('[data-soup-chef]').dataset.pose,'place');assert.equal(f.nodes.get('[data-soup-stir]').disabled,true);
    await f.add('paprika');await f.click('[data-soup-finish]');f.advance(3599);assert.strictEqual(f.game,before);assert.equal(f.nodes.get('[data-soup-finish]').disabled,true);f.advance(1);assert.strictEqual(f.game,before);assert.equal(f.nodes.get('[data-soup-kitchen]').dataset.stirring,'false');assert.equal(f.nodes.get('[data-soup-finish]').disabled,false);
    assert.match(f.nodes.get('[data-soup-live]').textContent,english?/unchanged/:/נשארו בדיוק/);await f.click('[data-soup-finish]');assert.equal(f.game.phase,'success');
  }
});
test('stirring before water, interrupted stirring, and reduced-motion stirring never add an ingredient or a tasting attempt',async()=>{
  const f=fixture();f.mount();await f.click('[data-soup-start]');const dry=f.game;await f.click('[data-soup-stir]');assert.strictEqual(f.game,dry);assert.equal(f.timers.size,0);
  await f.click('[data-soup-water]');f.advance(3000);await f.add('carrot');f.advance(3000);const before=f.game;await f.click('[data-soup-stir]');f.advance(500);f.window.soupTest.pauseSoup();assert.strictEqual(f.game,before);assert.equal(f.timers.size,0);f.mount();assert.equal(f.nodes.get('[data-soup-chef]').dataset.pose,'idle');assert.equal(f.game.contents.carrot,1);
  const quiet=fixture({reducedMotion:true});await prepared(quiet);const quietBefore=quiet.game;await quiet.click('[data-soup-stir]');assert.strictEqual(quiet.game,quietBefore);assert.equal(quiet.nodes.get('[data-soup-finish]').disabled,false);
});

test('leaving during water filling starts heating once and preserves the automatic boiling deadline',async()=>{
  const f=fixture();f.mount();await f.click('[data-soup-start]');await f.click('[data-soup-water]');f.advance(500);f.window.soupTest.pauseSoup();assert.equal(f.game.water,true);assert.equal(f.game.heat,true);const deadline=f.game.boilAt;assert.equal(f.timers.size,0);f.jump(engine.BOIL_MS+1000);f.mount();assert.equal(f.game.boilAt,deadline);assert.equal(f.game.boiled,true);assert.equal(f.nodes.get('[data-soup-kitchen]').dataset.boiled,'true');assert.equal(f.timers.size,0);
});

test('the broth shows one, two and three of each product, caps only the picture and retains all twelve product types',async()=>{
 for(const english of [false,true]){
  const f=fixture({english,reducedMotion:true});await prepared(f);
  const count=id=>(f.nodes.get('[data-soup-floating]').innerHTML.match(new RegExp('data-soup-product="'+id+'"','g'))||[]).length;
  for(const amount of [1,2,3,4]){await f.add('potato');assert.equal(count('potato'),Math.min(amount,3));assert.equal(f.game.contents.potato,amount);}
  await f.remove('potato');assert.equal(count('potato'),3);await f.remove('potato');assert.equal(count('potato'),2);await f.remove('potato');assert.equal(count('potato'),1);await f.remove('potato');assert.equal(count('potato'),0);
  for(const item of engine.INGREDIENTS){for(let i=0;i<4;i++)await f.add(item.id);assert.equal(count(item.id),3);assert.equal(f.game.contents[item.id],4*item.step);}
  assert.equal((f.nodes.get('[data-soup-floating]').innerHTML.match(/class="soup-food-unit"/g)||[]).length,36);
  const before=f.nodes.get('[data-soup-floating]').innerHTML;await f.click('[data-soup-stir]');assert.equal(f.nodes.get('[data-soup-floating]').innerHTML,before);assert.equal(f.game.attempts,0);
  await f.click('[data-soup-reset]');assert.equal(f.nodes.get('[data-soup-floating]').innerHTML,'');assert.equal(Object.keys(f.game.contents).length,0);
 }
});
test('each added hawaij portion deepens the broth, including beyond three drawn portions; removal and a fresh pot restore the colour',async()=>{
 const f=fixture({reducedMotion:true});await prepared(f);await f.add('potato');
 const colour=()=>f.nodes.get('[data-soup-kitchen]').style['--soup-broth'];const unspiced=colour(),shades=[];
 for(let i=0;i<4;i++){await f.add('hawaij');shades.push(colour());}
 assert.equal(new Set([unspiced,...shades]).size,5);assert.equal(f.game.contents.hawaij,1);assert.equal((f.nodes.get('[data-soup-floating]').innerHTML.match(/data-soup-product="hawaij"/g)||[]).length,3);
 for(let i=0;i<4;i++)await f.remove('hawaij');assert.equal(colour(),unspiced);
 await f.click('[data-soup-reset]');assert.equal(colour(),'#819294');assert.equal(f.game.contents.hawaij,undefined);
});
