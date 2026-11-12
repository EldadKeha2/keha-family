import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../public/assets/memorial.js',import.meta.url),'utf8');
function fixture({hash='#memorial/yona',english=false,defer=false}={}){
 const people=[{id:'shlomo',name:'שלמה קהא',nameEn:'Shlomo Keha',birthday:'1.1.1907',deathDate:'12.11.1996',deceased:true},{id:'yona',name:'יונה נקאש',nameEn:'Yona Nakash',birthday:'16.10.1921',deathDate:'16.6.2010',deceased:true}];
 const nodes=new Map(),frames=[],requests=[],focused=[],scrolled=[],documentEvents=new Map();let view=hash.slice(1).split('/')[0],finishLoad;
 const document={activeElement:null,visibilityState:'visible',getElementById:id=>node(id),addEventListener:(name,fn)=>documentEvents.set(name,fn)};
 class Node{
  constructor(id){this.id=id;this.dataset={};this.handlers=new Map();this.cards=[];this.hidden=false;this.textContent='';}
  set innerHTML(value){this.html=value;this.cards=[...value.matchAll(/<article class="([^"]+)" data-remembrance="([^"]+)"/g)].map(match=>{const card=new Node();card.className=match[1];card.dataset.remembrance=match[2];return card;});}
  get innerHTML(){return this.html;}
  addEventListener(name,fn){this.handlers.set(name,fn);}querySelectorAll(){return this.cards;}
  focus(){document.activeElement=this;focused.push(this.dataset.remembrance);}scrollIntoView(){scrolled.push(this.dataset.remembrance);}
 }
 const node=id=>{if(!nodes.has(id))nodes.set(id,new Node(id));return nodes.get(id);};
 const location={hash},window=new EventTarget();window.FAMILY_API_TOKEN='test-token';
 window.FamilyI18n={isEnglish:english,locale:english?'en-US':'he-IL',date:String,error:String,personName:p=>english?p.nameEn:p.name,fetch:async(path,options)=>{
  requests.push({path,options});if(options?.method==='POST')return Response.json({candle:{count:1,lit:true}});
  const result=()=>Response.json({candles:Object.fromEntries(people.map(p=>[p.id,{count:0,lit:false}]))});
  if(defer)return new Promise(resolve=>finishLoad=()=>resolve(result()));return result();
 }};
 window.FamilyApp={getView:()=>view,getPeople:()=>people,getPersonSummary:id=>people.find(p=>p.id===id),nameOf:id=>people.find(p=>p.id===id).name};
 window.FamilyDates={parse:value=>{if(!value)return null;const [day,month,year]=value.split('.').map(Number);return {year,date:new Date(Date.UTC(year,month-1,day))};}};
 vm.runInNewContext(source,{window,document,location,crypto,localStorage:{getItem:()=> 'a'.repeat(32),setItem(){}},requestAnimationFrame:fn=>frames.push(fn),setInterval(){}});documentEvents.get('DOMContentLoaded')();
 const flush=async()=>{await new Promise(resolve=>setImmediate(resolve));while(frames.length)frames.shift()();};
 return {window,document,people,requests,focused,scrolled,node,flush,finish:()=>finishLoad(),route(hash){location.hash=hash;view=hash.slice(1).split('/')[0];window.FamilyMemorial.activate(view);window.dispatchEvent(new Event('hashchange'));},async light(id){await node('memorialContent').handlers.get('click')({target:{closest:selector=>selector==='[data-light-candle]'?{dataset:{lightCandle:id}}:null}});}};
}
test('memorial email links focus and highlight the intended person after loading without lighting a candle',async()=>{
 for(const english of [true,false]){
  const f=fixture({english,defer:true});assert.equal(f.focused.length,0);f.finish();await f.flush();
  assert.deepEqual(f.focused,['yona']);assert.deepEqual(f.scrolled,['yona']);assert.match(f.node('memorialContent').innerHTML,/is-remembrance-target" data-remembrance="yona"/);
  assert.equal(f.requests.length,1);assert.equal(f.requests[0].path,'api/memorial');assert.equal(f.requests[0].options.method,undefined);
  f.window.dispatchEvent(new Event('family-people-loaded'));await f.flush();assert.equal(f.focused.length,1,'Background data refreshes must not repeatedly move the page');
  await f.light('yona');assert.equal(f.requests[1].path,'api/memorial/yona/candles');assert.equal(f.requests[1].options.method,'POST');assert.match(f.node('memorialContent').innerHTML,/candle-is-lit[^>]+data-remembrance="yona"/);
 }
});
test('links work while the memorial page is already open, and re-entry focuses the selected person again',async()=>{
 const f=fixture();await f.flush();f.route('#memorial/shlomo');await f.flush();assert.deepEqual(f.focused,['yona','shlomo']);
 f.route('#tree');f.route('#memorial/shlomo');await f.flush();assert.deepEqual(f.focused,['yona','shlomo','shlomo']);assert.equal(f.requests.filter(r=>r.options.method==='POST').length,0);
});
test('unknown, malformed and non-person routes never choose a different person or light a candle',async()=>{
 for(const hash of ['#memorial','#memorial/unknown','#memorial/%E0%A4%A','#memorial/%22%5D%3Cscript%3E','#memorial/yona/extra']){
  const f=fixture({hash});await f.flush();assert.equal(f.focused.length,0);assert.equal(f.scrolled.length,0);assert.ok(!f.node('memorialContent').innerHTML.includes('is-remembrance-target'));
  assert.equal(f.requests.filter(r=>r.options.method==='POST').length,0);
 }
});
test('a delayed candle count response cannot bring a visitor back after leaving the memorial page',async()=>{
 const f=fixture({defer:true});f.route('#tree');f.finish();await f.flush();assert.equal(f.focused.length,0);assert.equal(f.node('memorialView').hidden,true);
});
