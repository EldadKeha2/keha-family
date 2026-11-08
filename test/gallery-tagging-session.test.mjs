import{test}from'node:test';
import assert from'node:assert/strict';
import vm from'node:vm';
import{readFile}from'node:fs/promises';

const mediaSource=await readFile(new URL('../public/assets/media.js',import.meta.url),'utf8');
const portalSource=await readFile(new URL('../public/assets/portal.js',import.meta.url),'utf8');
const photo=(id='a',tags=[])=>({id,file:id+'.jpg',filename:id+'.jpg',scope:'gallery',kind:'photo',mime:'image/jpeg',src:'/media/'+id,name:'Photo '+id,caption:'',tags,tagsRevision:'initial',faceSummary:{total:2,unmatched:2,partial:tags.length>0,reviewed:false}});
function fixture(items=[photo('a'),photo('b')],{allPageSize=Infinity}={}){
 const nodes=new Map(),documentHandlers=new Map(),windowHandlers=new Map(),intervals=[],requests=[],pending=[];let nextDeferred=false,revision=1;
 const server=structuredClone(items),mounted=[];
 class Node{
  constructor(){this.handlers=new Map();this.children=[];this.widgets=new Map();this.dataset={};this.className='';this.style={setProperty(){}};this.classList={add(){},toggle(){},remove(){}};this.hidden=false;this.open=false;this.value='';this.isConnected=true;}
  addEventListener(name,fn){if(!this.handlers.has(name))this.handlers.set(name,[]);this.handlers.get(name).push(fn);}
  emit(name,event={}){for(const fn of this.handlers.get(name)||[])fn(event);}
  click(){this.emit('click');}setAttribute(k,v){this[k]=String(v);}getAttribute(k){return this[k]??null;}removeAttribute(k){delete this[k];}
  querySelector(selector){if(selector==='video'&&!this.innerHTML?.includes('<video'))return null;if(!this.widgets.has(selector))this.widgets.set(selector,new Node());return this.widgets.get(selector);}
  querySelectorAll(selector){return selector==='.shared-media-card'?this.children:[];}
  replaceChildren(...nodes){this.children=nodes;}append(...nodes){this.children.push(...nodes);}focus(){}pause(){}load(){}scrollIntoView(){}
  get firstElementChild(){return this.children[0]||null;}get nextElementSibling(){return this.parent?.children[this.parent.children.indexOf(this)+1]||null;}
  insertBefore(node,anchor){node.remove();const index=anchor?this.children.indexOf(anchor):this.children.length;this.children.splice(index,0,node);node.parent=this;}
  remove(){if(this.parent){this.parent.children.splice(this.parent.children.indexOf(this),1);this.parent=null;}}
  showModal(){this.open=true;}close(){if(!this.open)return;this.open=false;this.emit('close');}
 }
 const get=id=>{if(!nodes.has(id))nodes.set(id,new Node());return nodes.get(id);};
 const filters=['all','untagged','partial','complete'].map(filter=>{const n=new Node();n.dataset.galleryFilter=filter;return n;});
 const listen=(map,name,fn)=>{if(!map.has(name))map.set(name,[]);map.get(name).push(fn);};
 const document={activeElement:null,visibilityState:'visible',getElementById:get,createElement:()=>new Node(),createTextNode:text=>({textContent:text}),querySelector:()=>null,querySelectorAll:s=>s==='[data-gallery-filter]'?filters:[],addEventListener:(name,fn)=>listen(documentHandlers,name,fn)};
 const collection=path=>{
  const filter=new URL(path,'https://test/').searchParams.get('filter')||'all',selected=server.filter(item=>filter==='untagged'?!item.tags.length&&!item.faceSummary.reviewed:filter==='partial'?item.faceSummary.partial:filter==='complete'?item.faceSummary.reviewed:true);
  return{items:structuredClone(filter==='all'?selected.slice(0,allPageSize):selected),count:selected.length,revision:'gallery-'+revision,filterCounts:{all:server.length,untagged:server.filter(i=>!i.tags.length&&!i.faceSummary.reviewed).length,partial:server.filter(i=>i.faceSummary.partial).length,complete:server.filter(i=>i.faceSummary.reviewed).length},pagination:{page:1,size:100,pages:1,total:selected.length,filter}};
 };
 const window={FamilyApp:{apiEnabled:true,toast(){}},FAMILY_DATA:{people:{}},FamilyTags:{controls:()=>'',labels:()=>'',refresh(){},clearInline(){},mountInline:(_host,item)=>mounted.push(structuredClone(item))},addEventListener:(name,fn)=>listen(windowHandlers,name,fn),dispatchEvent:event=>{for(const fn of windowHandlers.get(event.type)||[])fn(event);}};
 window.FamilyI18n={isEnglish:false,language:'he',t:String,html:(parts,...values)=>parts.reduce((s,p,i)=>s+p+(values[i]??''),''),mediaName:item=>item.name,error:String,searchNames:item=>item.name,fetch:async path=>{
  requests.push(path);const result=collection(path);
  if(nextDeferred){nextDeferred=false;return new Promise(resolve=>pending.push(()=>resolve(Response.json(result))));}return Response.json(result);
 }};
 const context=vm.createContext({window,document,location:{href:'https://test/?lang=he#gallery',origin:'https://test'},history:{replaceState(){}},navigator:{},URL,URLSearchParams,Response,CustomEvent,console,setInterval:fn=>intervals.push(fn),setTimeout,clearTimeout,matchMedia:()=>({matches:false})});
 vm.runInContext(mediaSource,context);vm.runInContext(portalSource,context);for(const fn of documentHandlers.get('DOMContentLoaded'))fn();window.FamilyPortal.activate('gallery');
 const flush=async()=>{await new Promise(resolve=>setImmediate(resolve));await new Promise(resolve=>setImmediate(resolve));};
 return{window,get,requests,pending,mounted,filters,flush,server,
  filter(name){for(const fn of documentHandlers.get('click')||[])fn({target:{closest:s=>s==='[data-gallery-filter]'?{dataset:{galleryFilter:name}}:null}});},
  open:id=>window.FamilyMedia.openFrom('gallery',id),close:()=>get('closeMediaViewer').click(),poll:()=>intervals.forEach(fn=>fn()),defer(){nextDeferred=true;},
  change(id,operation='tags',tagCount=1){const item=server.find(i=>i.id===id);item.tags=Array.from({length:tagCount},(_,i)=>({id:'person-'+i,name:'Person '+i}));item.tagsRevision='tags-'+(++revision);item.faceSummary={total:2,unmatched:2-tagCount,partial:tagCount>0,reviewed:false};window.dispatchEvent(new CustomEvent('family-media-changed',{detail:{operation,scope:'gallery',item:structuredClone(item)}}));},
  review(id,complete=true){const item=server.find(i=>i.id===id);item.faceSummary={...item.faceSummary,reviewed:complete,partial:!complete&&item.tags.length>0};revision++;window.dispatchEvent(new CustomEvent('family-media-changed',{detail:{operation:'face-review',scope:'gallery',item:structuredClone(item)}}));},
  get cards(){return get('sharedGalleryGrid').children.map(card=>card.dataset.mediaFile);}
 };
}

test('a first tag moves a photo exclusively to partial after X, where it waits for explicit completion',async()=>{
 const f=fixture();await f.flush();f.filter('untagged');await f.flush();f.open('a');
 const before=f.requests.length,counts=f.filters.map(button=>button.textContent);assert.equal(f.get('mediaViewer').open,true);
 for(const operation of['tags','faces','face-detection','tags']){f.change('a',operation);f.poll();await f.flush();assert.equal(f.get('mediaViewer').open,true);assert.equal(f.get('mediaOriginal').href,'/media/a');assert.deepEqual(f.cards,['a.jpg','b.jpg']);assert.deepEqual(f.filters.map(button=>button.textContent),counts);}
 assert.equal(f.requests.length,before,'Do not reload or recategorize a filtered gallery during its open tagging session');assert.equal(f.mounted.at(-1).tags.length,1,'The visible tagging metadata still updates immediately');
 f.close();await f.flush();assert.deepEqual(f.cards,['b.jpg']);assert.equal(f.requests.length,before+1);assert.equal(f.filters[1].getAttribute('aria-pressed'),'true');assert.match(f.filters[2].textContent,/\(1\)/);
 f.filter('partial');await f.flush();assert.deepEqual(f.cards,['a.jpg']);
 f.open('a');f.review('a');await f.flush();assert.equal(f.get('mediaViewer').open,true);assert.deepEqual(f.cards,['a.jpg','b.jpg']);assert.equal(f.filters[0].getAttribute('aria-pressed'),'true');f.close();await f.flush();assert.deepEqual(f.cards,['a.jpg','b.jpg']);f.filter('complete');await f.flush();assert.deepEqual(f.cards,['a.jpg']);
 f.filter('untagged');await f.flush();assert.deepEqual(f.cards,['b.jpg']);f.filter('all');await f.flush();assert.deepEqual(f.cards,['a.jpg','b.jpg']);
});
test('tagging the final detected face stays partial until completion, which does not close the viewer',async()=>{
 const f=fixture([photo('a',[{id:'person-0'}])]);await f.flush();f.filter('partial');await f.flush();f.open('a');f.change('a','faces',2);await f.flush();
 assert.equal(f.get('mediaViewer').open,true);assert.deepEqual(f.cards,['a.jpg']);f.close();await f.flush();assert.deepEqual(f.cards,['a.jpg']);
 f.open('a');f.review('a');await f.flush();assert.equal(f.get('mediaViewer').open,true);assert.deepEqual(f.cards,['a.jpg']);assert.equal(f.filters[0].getAttribute('aria-pressed'),'true');f.close();await f.flush();assert.deepEqual(f.cards,['a.jpg']);f.filter('complete');await f.flush();assert.deepEqual(f.cards,['a.jpg']);f.filter('partial');await f.flush();assert.deepEqual(f.cards,[]);assert.equal(f.get('sharedGalleryEmpty').hidden,false);
});
test('a gallery response requested before opening the photo cannot apply midway through tagging',async()=>{
 const f=fixture();await f.flush();f.filter('untagged');await f.flush();f.defer();f.poll();assert.equal(f.pending.length,1);f.open('a');f.change('a');f.change('a','face-detection');f.pending.shift()();await f.flush();
 assert.equal(f.get('mediaViewer').open,true);assert.equal(f.get('mediaOriginal').href,'/media/a');assert.deepEqual(f.cards,['a.jpg','b.jpg']);
 f.review('a');await f.flush();assert.equal(f.get('mediaViewer').open,true);f.close();await f.flush();assert.deepEqual(f.cards,['a.jpg','b.jpg']);f.filter('untagged');await f.flush();assert.deepEqual(f.cards,['b.jpg']);
});

test('completion returns to All photos without replacing an older open photo that is absent from its first page',async()=>{
 const f=fixture([photo('newer'),photo('older',[{id:'person-0'}])],{allPageSize:1});await f.flush();f.filter('partial');await f.flush();f.open('older');f.review('older');await f.flush();
 assert.equal(f.filters[0].getAttribute('aria-pressed'),'true');assert.equal(f.get('mediaViewer').open,true);assert.equal(f.get('mediaOriginal').href,'/media/older');assert.deepEqual(f.cards,['newer.jpg']);
 f.close();await f.flush();f.filter('complete');await f.flush();assert.deepEqual(f.cards,['older.jpg']);f.window.FamilyPortal.activate('home');f.window.FamilyPortal.activate('gallery');await f.flush();assert.equal(f.filters[0].getAttribute('aria-pressed'),'true');
});

test('undo switches to partial immediately, keeps the same photo open, and allows confirmation again',async()=>{
 const f=fixture([photo('newer'),photo('older',[{id:'person-0'}])],{allPageSize:1});await f.flush();f.filter('partial');await f.flush();f.open('older');
 f.review('older');await f.flush();assert.equal(f.filters[0].getAttribute('aria-pressed'),'true');assert.deepEqual(f.cards,['newer.jpg']);
 f.review('older',false);await f.flush();assert.equal(f.filters[2].getAttribute('aria-pressed'),'true');assert.deepEqual(f.cards,['older.jpg']);assert.equal(f.get('mediaOriginal').href,'/media/older');assert.equal(f.get('mediaViewer').open,true);assert.match(f.filters[3].textContent,/\(0\)/);
 f.review('older');await f.flush();assert.equal(f.filters[0].getAttribute('aria-pressed'),'true');assert.deepEqual(f.cards,['newer.jpg']);assert.equal(f.get('mediaOriginal').href,'/media/older');f.close();
});
test('undo without any names restores the untagged category and queued review requests retain the final choice',async()=>{
 const f=fixture();await f.flush();f.open('a');f.defer();f.review('a');assert.equal(f.pending.length,1);
 f.review('a',false);f.pending.shift()();await f.flush();assert.equal(f.filters[1].getAttribute('aria-pressed'),'true');assert.deepEqual(f.cards,['a.jpg','b.jpg']);assert.equal(f.get('mediaOriginal').href,'/media/a');assert.equal(f.get('mediaViewer').open,true);assert.match(f.requests.at(-1),/filter=untagged/);f.close();
});
