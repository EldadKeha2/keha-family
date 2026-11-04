import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../public/assets/archive.js',import.meta.url),'utf8');
function fixture(items=[]){
  const nodes=new Map(),handlers=new Map(),requests=[];
  class Node{
    constructor(){this.dataset={};this.children=[];this.className='';this.innerHTML='';this.value='';this.textContent='';this.parent=null;this.widgets=new Map();this.clicks=0;this.classList={add(){},remove(){},toggle(){}};}
    get firstElementChild(){return this.children[0]||null;}
    get nextElementSibling(){return this.parent?.children[this.parent.children.indexOf(this)+1]||null;}
    addEventListener(){} setAttribute(){} insertAdjacentHTML(){} contains(){return false;}
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
  const window={FAMILY_DATA:{people:{},units:{},branches:[]},FAMILY_API_TOKEN:'test',FamilyDates:{age:()=>null},FamilyTags:{refresh(){}},FamilyMedia:{register(){},controls:()=>''},FamilyI18n:{isEnglish:false,t:String,html:(parts,...values)=>parts.reduce((text,part,i)=>text+part+(values[i]??''),''),mediaName:item=>item.name,error:String,fetch:async path=>{requests.push(path);return Response.json({items,count:items.length});}},addEventListener(){}};
  window.FamilyApp={apiEnabled:true,getView:()=> 'nostalgia',setView:view=>window.FamilyArchive.activate(view),toast(){}};
  vm.runInNewContext(source,{window,document,location:{hash:'#nostalgia',pathname:'/',search:''},history:{replaceState(){}},setInterval(){},clearTimeout(){},setTimeout(){},matchMedia:()=>({matches:false})});
  handlers.get('DOMContentLoaded')();
  const flush=()=>new Promise(resolve=>setImmediate(resolve));
  const click=(selector,dataset)=>handlers.get('click')({target:{closest:s=>s===selector?{dataset}:null}});
  return {nodes,requests,flush,get grid(){return get('nostalgiaGrid');},upload(kind){click('[data-archive-upload]',{archiveUpload:'nostalgia',archiveKind:kind});},filter(kind){click('[data-archive-filter]',{archiveFilter:kind});}};
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
test('empty nostalgia categories expose upload controls and each picker accepts the selected type',async()=>{
  const f=fixture();await f.flush();assert.equal(f.grid.children.filter(n=>n.dataset.nostalgiaKind).length,3);
  for(const [kind,accept]of [['photo','image/jpeg'],['video','video/mp4'],['document','.pdf']]){
    f.upload(kind);const input=f.nodes.get('nostalgiaUploadInput');assert.equal(input.dataset.scope,'nostalgia');assert.ok(input.accept.includes(accept));
    if(kind==='video')assert.ok(!input.accept.includes('image/'));if(kind==='photo')assert.ok(!input.accept.includes('video/'));
  }
  assert.equal(f.nodes.get('nostalgiaUploadInput').clicks,3);
});
