import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import family from '../src/family.mjs';
import {browserHistory,navigationSource} from './helpers/browser-history.mjs';

const source=await readFile(new URL('../public/assets/archive.js',import.meta.url),'utf8');
function fixture(items=[],{navigation=false,entryUrl='https://family.test/#weddings'}={}){
  const browser=navigation?browserHistory(entryUrl):null;let view=navigation?new URL(entryUrl).hash.slice(1).split('/')[0]:'nostalgia';
  const nodes=new Map(),handlers=new Map(),requests=[];
  class Node{
    constructor(){this.dataset={};this.children=[];this.className='';this.innerHTML='';this.value='';this.textContent='';this.parent=null;this.widgets=new Map();this.clicks=0;this.classList={add(){},remove(){},toggle(){}};}
    get firstElementChild(){return this.children[0]||null;}
    get nextElementSibling(){return this.parent?.children[this.parent.children.indexOf(this)+1]||null;}
    addEventListener(){} setAttribute(){} insertAdjacentHTML(){} contains(){return false;} scrollIntoView(){}
    querySelectorAll(){return [];}
    querySelector(selector){
      const match=/^\[data-nostalgia-(kind|empty)="([^"]+)"\]$/.exec(selector);
      if(match)return this.children.find(n=>n.dataset[match[1]==='kind'?'nostalgiaKind':'nostalgiaEmpty']===match[2])||null;
      if(selector==='video'||selector==='textarea'){
        if(!this.innerHTML.includes('<'+selector))return null;
        if(!this.widgets.has(selector))this.widgets.set(selector,new Node());return this.widgets.get(selector);
      }
      return null;
    }
    insertBefore(node,anchor){if(node.parent)node.remove();const at=anchor?this.children.indexOf(anchor):this.children.length;this.children.splice(at,0,node);node.parent=this;}
    remove(){if(this.parent){this.parent.children.splice(this.parent.children.indexOf(this),1);this.parent=null;}}
    click(){this.clicks++;}
  }
  const get=id=>{if(!nodes.has(id))nodes.set(id,new Node());return nodes.get(id);};
  const document={activeElement:null,visibilityState:'visible',getElementById:get,createElement:()=>new Node(),querySelector:()=>null,querySelectorAll:()=>[],addEventListener(type,fn){handlers.set(type,fn);}};
  const window={FAMILY_DATA:navigation?family:{people:{},units:{},branches:[]},FAMILY_API_TOKEN:'test',FamilyDates:{age:()=>null},FamilyTags:{refresh(){}},FamilyMedia:{register(){},controls:()=>''},FamilyI18n:{isEnglish:false,t:String,html:(parts,...values)=>parts.reduce((text,part,i)=>text+part+(values[i]??''),''),mediaName:item=>item.name,error:String,fetch:async path=>{requests.push(path);if(path==='api/weddings')return Response.json({weddings:[]});if(path.startsWith('api/weddings/'))return Response.json({id:path.split('/').pop(),greetings:[],collection:{items:[],count:0}});return Response.json({items,count:items.length});}},addEventListener(){}};
  window.FamilyI18n.branchName=b=>b?.name||'';
  window.FamilyApp={apiEnabled:true,getView:()=>view,nameOf:id=>family.people[id]?.name||id,setView(next,sync=true){if(browser&&sync)window.FamilyNavigation.go('#'+next);view=next;window.FamilyArchive.activate(next);},toast(){}};
  if(browser)window.addEventListener=browser.addEventListener;
  const context=vm.createContext({window,document,location:browser?.location||{hash:'#nostalgia',pathname:'/',search:''},history:browser?.history||{replaceState(){}},URL,setInterval(){},clearTimeout(){},setTimeout(){},matchMedia:()=>({matches:false})});
  if(browser)vm.runInContext(navigationSource,context);vm.runInContext(source,context);
  handlers.get('DOMContentLoaded')();
  const flush=()=>new Promise(resolve=>setImmediate(resolve));
  const click=(selector,dataset)=>handlers.get('click')({target:{closest:s=>s===selector?{dataset}:null}});
  return {browser,window,get view(){return view;},openWedding:id=>click('[data-open-wedding]',{openWedding:id}),back:()=>click('[data-wedding-back]'),nodes,requests,flush,get grid(){return get('nostalgiaGrid');},upload(kind){click('[data-archive-upload]',{archiveUpload:'nostalgia',archiveKind:kind});},filter(kind){click('[data-archive-filter]',{archiveFilter:kind});}};
}
const item=(kind,n)=>({id:String(n),file:n+'.'+({photo:'jpg',video:'mp4',document:'pdf'}[kind]),filename:'Memory '+n,name:'Memory '+n,kind,src:'/media/'+n,mime:{photo:'image/jpeg',video:'video/mp4',document:'application/pdf'}[kind],size:100});

test('nostalgia separates images, films and documents and preserves a playing video through refreshes',async()=>{
  const f=fixture([item('video',1),item('photo',2),item('document',3)]);await f.flush();
  assert.deepEqual(f.requests,['api/nostalgia']);
  assert.deepEqual(f.grid.children.filter(n=>n.dataset.nostalgiaKind).map(n=>n.dataset.nostalgiaKind),['photo','video','document']);
  assert.deepEqual(f.grid.children.filter(n=>n.dataset.mediaKind).map(n=>n.dataset.mediaKind),['photo','video','document']);
  const video=f.grid.children.find(n=>n.dataset.mediaKind==='video'),player=video.querySelector('video');
  f.filter('all');assert.equal(f.grid.children.find(n=>n.dataset.mediaKind==='video'),video);assert.equal(video.querySelector('video'),player);
  f.filter('video');assert.equal(f.grid.children.filter(n=>n.dataset.mediaKind).length,1);assert.equal(f.grid.children.find(n=>n.dataset.mediaKind),video);
});

test('wedding history restores the correct couple and overview without adding entries during Back or Forward',async()=>{
  const ids=Object.values(family.units).filter(unit=>unit.people.length===2).map(unit=>unit.id);
  const f=fixture([],{navigation:true});await f.flush();
  f.openWedding(ids[0]);await f.flush();assert.equal(f.browser.location.hash,'#weddings/'+ids[0]);
  f.openWedding(ids[1]);await f.flush();const length=f.browser.history.length;
  f.browser.history.back();await f.flush();
  assert.equal(f.nodes.get('weddingDetail').dataset.couple,ids[0]);assert.equal(f.nodes.get('weddingsOverview').hidden,true);
  f.browser.history.back();await f.flush();
  assert.equal(f.browser.location.hash,'#weddings');assert.equal(f.nodes.get('weddingsOverview').hidden,false);
  assert.equal(f.nodes.get('weddingDetail').hidden,true);
  f.browser.history.forward();await f.flush();f.browser.history.forward();await f.flush();
  assert.equal(f.nodes.get('weddingDetail').dataset.couple,ids[1]);assert.equal(f.browser.history.length,length);
});

test('the wedding return button and revisiting the weddings tab do not reopen a stale couple',async()=>{
  const id=family.root,f=fixture([],{navigation:true});await f.flush();
  f.openWedding(id);await f.flush();f.back();await f.flush();
  assert.equal(f.browser.location.hash,'#weddings');assert.equal(f.nodes.get('weddingsOverview').hidden,false);
  f.browser.history.back();await f.flush();assert.equal(f.browser.location.hash,'#tree');
  f.window.FamilyApp.setView('weddings');f.openWedding(id);await f.flush();
  f.window.FamilyApp.setView('gallery');f.window.FamilyApp.setView('weddings');await f.flush();
  assert.equal(f.browser.location.hash,'#weddings');assert.equal(f.nodes.get('weddingsOverview').hidden,false);
});
test('empty nostalgia categories expose upload controls and each picker accepts the selected type',async()=>{
  const f=fixture();await f.flush();assert.equal(f.grid.children.filter(n=>n.dataset.nostalgiaKind).length,3);
  for(const [kind,accept]of [['photo','image/jpeg'],['video','video/mp4'],['document','.pdf']]){
    f.upload(kind);const input=f.nodes.get('nostalgiaUploadInput');assert.equal(input.dataset.scope,'nostalgia');assert.ok(input.accept.includes(accept));
    if(kind==='video')assert.ok(!input.accept.includes('image/'));if(kind==='photo')assert.ok(!input.accept.includes('video/'));
  }
  assert.equal(f.nodes.get('nostalgiaUploadInput').clicks,3);
});
