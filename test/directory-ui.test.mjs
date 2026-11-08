import{test}from'node:test';
import assert from'node:assert/strict';
import vm from'node:vm';
import{readFile}from'node:fs/promises';
import family from'../src/family.mjs';
const source=await readFile(new URL('../public/assets/app.js',import.meta.url),'utf8');
function fixture({phone=false,english=false}={}){
 const nodes=new Map(),handlers=new Map(),opened=[];
 class Node extends EventTarget{
  constructor(){super();this.dataset={};this.style={};this.hidden=false;this.value='';this.innerHTML='';this.open=false;this.classList={add(){},remove(){},toggle(){}};}
  setAttribute(k,v){this[k]=v;}querySelector(){return null;}querySelectorAll(){return [];}getBoundingClientRect(){return{top:100,left:0,width:400,height:300};}blur(){}
 }
 const node=id=>{if(!nodes.has(id))nodes.set(id,new Node());return nodes.get(id);};
 const document={getElementById:node,body:new Node(),documentElement:new Node(),querySelectorAll:()=>[],querySelector:()=>null,addEventListener:(name,fn)=>{if(!handlers.has(name))handlers.set(name,[]);handlers.get(name).push(fn);}};
 const window=new Node();window.FAMILY_DATA=structuredClone(family);window.FamilyDates={parse:()=>null,age:()=>null};window.FamilyPeople={activate(){},open:id=>opened.push(id)};
 window.FamilyI18n={isEnglish:english,locale:english?'en-US':'he-IL',t:s=>s,html:(p,...v)=>p.reduce((s,a,i)=>s+a+(v[i]??''),''),word:(n,a,b)=>n===1?a:b,personName:p=>english?p.nameEn||p.name:p.name,branchName:b=>b?.title||'',searchNames:p=>[p.name,p.nameEn].filter(Boolean).join(' '),date:s=>s};
 const location={hash:'#directory'};
 vm.runInNewContext(source,{window,document,location,history:{pushState(){}},matchMedia:q=>({matches:q.includes('700px')&&phone}),innerWidth:phone?390:1280,innerHeight:900,console,setTimeout,clearTimeout,setInterval:()=>0,requestAnimationFrame:()=>0,cancelAnimationFrame(){},CustomEvent});
 const click=(selector,dataset)=>{for(const fn of handlers.get('click')||[])fn({target:{closest:s=>s===selector?{dataset}:null},preventDefault(){}});};
 return{window,node,opened,group:g=>click('[data-directory-group]',{directoryGroup:g}),card:id=>click('[data-person]',{person:id}),search:q=>{node('searchInput').value=q;node('searchInput').dispatchEvent(new Event('input'));},render(){window.FamilyApp.setView('directory',false);},get html(){return node('directoryGrid').innerHTML;}};
}
test('the third directory group contains every active manual-only name, has no branch restriction and opens their album',()=>{
 for(const phone of[false,true])for(const english of[false,true]){
  const f=fixture({phone,english}),extra={id:'extra-new',extra:true,name:'אורח חדש',nameEn:'New guest',photoCount:2,mediaCount:2,profile:'/media/guest'};
  f.window.FamilyApp.updatePerson(extra.id,extra);f.window.FamilyApp.updatePerson('extra-empty',{id:'extra-empty',extra:true,name:'Empty guest',photoCount:0,mediaCount:0});
  f.render();assert.ok(!f.html.includes('extra-new'));f.group('extended');assert.ok(!f.html.includes('extra-new'));
  f.group('friends');assert.match(f.html,/extra-new/);assert.match(f.html,/\/media\/guest/);assert.match(f.html,/2 תמונות מתויגות/);assert.ok(!f.html.includes('extra-empty'));assert.equal(f.node('branchBar').hidden,true);
  assert.ok(!f.html.includes('data-person="yona"'));f.card(extra.id);assert.deepEqual(f.opened,[extra.id]);
  f.search(english?'New guest':'אורח');assert.match(f.html,/extra-new/);f.search('not-a-name');assert.equal(f.html,'');
  f.window.FamilyApp.updatePerson(extra.id,{...extra,photoCount:0,mediaCount:0});f.group('friends');assert.equal(f.html,'');
 }
});
