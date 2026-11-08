import{test}from'node:test';
import assert from'node:assert/strict';
import vm from'node:vm';
import{readFile}from'node:fs/promises';
import{browserHistory,navigationSource}from'./helpers/browser-history.mjs';

const mediaSource=await readFile(new URL('../public/assets/media.js',import.meta.url),'utf8');
const portalSource=await readFile(new URL('../public/assets/portal.js',import.meta.url),'utf8');
const appSource=await readFile(new URL('../public/assets/app.js',import.meta.url),'utf8');
const photo=(id='a',tags=[])=>({id,file:id+'.jpg',filename:id+'.jpg',scope:'gallery',kind:'photo',mime:'image/jpeg',src:'/media/'+id,name:'Photo '+id,caption:'',tags,tagsRevision:'initial',faceSummary:{total:2,unmatched:2,partial:tags.length>0,reviewed:false}});
function fixture(items=[photo('a'),photo('b')],{allPageSize=Infinity,routing=false,phone=false}={}){
 const nodes=new Map(),documentHandlers=new Map(),windowHandlers=new Map(),intervals=[],requests=[],pending=[];let nextDeferred=false,revision=1;
 const server=structuredClone(items),mounted=[];
 class Node{
  constructor(){this.handlers=new Map();this.children=[];this.widgets=new Map();this.dataset={};this.className='';this.style={setProperty(){}};this.classList={add(){},toggle(){},remove(){}};this.hidden=false;this.open=false;this.value='';this.isConnected=true;}
  addEventListener(name,fn){if(!this.handlers.has(name))this.handlers.set(name,[]);this.handlers.get(name).push(fn);}
  emit(name,event={}){for(const fn of this.handlers.get(name)||[])fn(event);}
  click(){this.emit('click');}setAttribute(k,v){this[k]=String(v);}getAttribute(k){return this[k]??null;}removeAttribute(k){delete this[k];}
  querySelector(selector){if(selector==='video'&&!this.innerHTML?.includes('<video'))return null;if(!this.widgets.has(selector))this.widgets.set(selector,new Node());return this.widgets.get(selector);}
  querySelectorAll(selector){return selector==='.shared-media-card'?this.children:[];}
  replaceChildren(...nodes){this.children=nodes;}append(...nodes){this.children.push(...nodes);}focus(){}blur(){}pause(){}load(){}scrollIntoView(){}
  get firstElementChild(){return this.children[0]||null;}get nextElementSibling(){return this.parent?.children[this.parent.children.indexOf(this)+1]||null;}
  insertBefore(node,anchor){node.remove();const index=anchor?this.children.indexOf(anchor):this.children.length;this.children.splice(index,0,node);node.parent=this;}
  remove(){if(this.parent){this.parent.children.splice(this.parent.children.indexOf(this),1);this.parent=null;}}
  showModal(){this.open=true;}close(){if(!this.open)return;this.open=false;this.emit('close');}
 }
 const get=id=>{if(!nodes.has(id))nodes.set(id,new Node());return nodes.get(id);};
 const filters=['all','untagged','partial','complete'].map(filter=>{const n=new Node();n.dataset.galleryFilter=filter;return n;});
 const listen=(map,name,fn)=>{if(!map.has(name))map.set(name,[]);map.get(name).push(fn);};
 const document={activeElement:null,visibilityState:'visible',body:new Node(),documentElement:new Node(),getElementById:get,createElement:()=>new Node(),createTextNode:text=>({textContent:text}),querySelector:()=>null,querySelectorAll:s=>s==='[data-gallery-filter]'?filters:[],addEventListener:(name,fn)=>listen(documentHandlers,name,fn)};
 const collection=path=>{
  const params=new URL(path,'https://test/').searchParams,filter=params.get('filter')||'all',selected=server.filter(item=>filter==='untagged'?!item.tags.length&&!item.faceSummary.reviewed:filter==='partial'?item.faceSummary.partial:filter==='complete'?item.faceSummary.reviewed:true);
  const size=Math.min(Number(params.get('size'))||100,filter==='all'?allPageSize:Infinity),pages=Math.max(1,Math.ceil(selected.length/size)),page=Math.max(1,Math.min(pages,Number(params.get('page'))||1));
  return{items:structuredClone(selected.slice((page-1)*size,page*size)),count:selected.length,revision:'gallery-'+revision+'-'+page,filterCounts:{all:server.length,untagged:server.filter(i=>!i.tags.length&&!i.faceSummary.reviewed).length,partial:server.filter(i=>i.faceSummary.partial).length,complete:server.filter(i=>i.faceSummary.reviewed).length},pagination:{page,size,pages,total:selected.length,filter}};
 };
 const browser=routing?browserHistory('https://test/?lang=he#gallery'):null;
 const window={FamilyApp:{apiEnabled:true,toast(){}},FAMILY_DATA:{people:{},branches:[],units:{}},scrollTo(){},FamilyTags:{controls:()=>'',labels:()=>'',refresh(){},clearInline(){},mountInline:(_host,item)=>mounted.push(structuredClone(item))},addEventListener:(name,fn)=>{listen(windowHandlers,name,fn);browser?.addEventListener(name,fn);},dispatchEvent:event=>{for(const fn of windowHandlers.get(event.type)||[])fn(event);}};
 window.FamilyI18n={isEnglish:false,language:'he',t:String,html:(parts,...values)=>parts.reduce((s,p,i)=>s+p+(values[i]??''),''),mediaName:item=>item.name,error:String,searchNames:item=>item.name,fetch:async path=>{
  requests.push(path);const result=collection(path);
  if(nextDeferred){nextDeferred=false;return new Promise(resolve=>pending.push(()=>resolve(Response.json(result))));}return Response.json(result);
 }};
 const context=vm.createContext({window,document,location:browser?.location||{href:'https://test/?lang=he#gallery',origin:'https://test'},history:browser?.history||{replaceState(){}},navigator:{},URL,URLSearchParams,Response,CustomEvent,console,setInterval:fn=>intervals.push(fn),setTimeout,clearTimeout,requestAnimationFrame:()=>0,cancelAnimationFrame(){},innerWidth:phone?390:1280,innerHeight:900,matchMedia:q=>({matches:q.includes('700px')&&phone})});
 if(routing)vm.runInContext(navigationSource,context);
 vm.runInContext(mediaSource,context);vm.runInContext(portalSource,context);if(routing){vm.runInContext(appSource,context);window.FamilyApp.apiEnabled=true;}
 for(const fn of documentHandlers.get('DOMContentLoaded'))fn();window.FamilyPortal.activate('gallery');
 const flush=async()=>{await new Promise(resolve=>setImmediate(resolve));await new Promise(resolve=>setImmediate(resolve));};
 return{window,get,requests,pending,mounted,filters,flush,server,browser,
  filter(name){for(const fn of documentHandlers.get('click')||[])fn({target:{closest:s=>s==='[data-gallery-filter]'?{dataset:{galleryFilter:name}}:null}});},
  open:id=>window.FamilyMedia.openFrom('gallery',id),close:()=>get('closeMediaViewer').click(),poll:()=>intervals.forEach(fn=>fn()),defer(){nextDeferred=true;},
  change(id,operation='tags',tagCount=1){const item=server.find(i=>i.id===id);item.tags=Array.from({length:tagCount},(_,i)=>({id:'person-'+i,name:'Person '+i}));item.tagsRevision='tags-'+(++revision);item.faceSummary={total:2,unmatched:2-tagCount,partial:tagCount>0,reviewed:false};window.dispatchEvent(new CustomEvent('family-media-changed',{detail:{operation,scope:'gallery',item:structuredClone(item)}}));},
  edit(id){const item=server.find(i=>i.id===id);item.photoRevision='edit-'+(++revision);item.src='/media/'+id+'?v='+item.photoRevision;window.dispatchEvent(new CustomEvent('family-media-changed',{detail:{operation:'photo-edit',scope:'gallery',item:structuredClone(item)}}));return item.src;},
  review(id,complete=true){const item=server.find(i=>i.id===id);item.faceSummary={...item.faceSummary,reviewed:complete,partial:!complete&&item.tags.length>0};revision++;window.dispatchEvent(new CustomEvent('family-media-changed',{detail:{operation:'face-review',scope:'gallery',item:structuredClone(item)}}));},
  get cards(){return get('sharedGalleryGrid').children.map(card=>card.dataset.mediaFile);}
 };
}

test('X, photo paging and browser returns keep the selected tagging category on desktop and phones',async()=>{
 for(const phone of [false,true])for(const filter of ['partial','untagged','complete']){
  const items=[photo('a',filter==='untagged'?[]:[{id:'person-0'}]),photo('b',filter==='untagged'?[]:[{id:'person-0'}])];
  if(filter==='complete')for(const item of items){item.faceSummary.reviewed=true;item.faceSummary.partial=false;}
  const f=fixture(items,{routing:true,phone});await f.flush();f.filter(filter);await f.flush();await f.window.FamilyPortal.sortGallery('taken-asc');await f.flush();
  f.open('a');f.get('mediaNext').click();f.close();await f.flush();assert.equal(f.get('mediaViewer').open,false);assert.equal(f.window.FamilyPortal.galleryQuery().filter,filter);assert.equal(f.window.FamilyPortal.galleryQuery().sort,'taken-asc');assert.equal(f.filters.find(button=>button.dataset.galleryFilter===filter).getAttribute('aria-pressed'),'true');
  f.open('a');f.browser.history.back();await f.flush();assert.equal(f.get('mediaViewer').open,false);assert.equal(f.window.FamilyPortal.galleryQuery().filter,filter);
  f.browser.history.forward();await f.flush();assert.equal(f.get('mediaViewer').open,true);f.close();await f.flush();assert.equal(f.window.FamilyPortal.galleryQuery().filter,filter);
  f.window.FamilyApp.setView('home');f.browser.history.back();await f.flush();assert.equal(f.window.FamilyApp.getView(),'gallery');assert.equal(f.window.FamilyPortal.galleryQuery().filter,filter,'History restoration must not reset the category');
  f.window.FamilyApp.setView('home');f.window.FamilyApp.setView('gallery');await f.flush();assert.equal(f.window.FamilyPortal.galleryQuery().filter,'all','An explicit new gallery visit still starts at All photos');
 }
});

test('a first tag moves a photo exclusively to partial after X, where it waits for explicit completion',async()=>{
 const f=fixture();await f.flush();f.filter('untagged');await f.flush();f.open('a');
 const before=f.requests.length,counts=f.filters.map(button=>button.textContent);assert.equal(f.get('mediaViewer').open,true);
 for(const operation of['tags','faces','face-detection','tags']){f.change('a',operation);f.poll();await f.flush();assert.equal(f.get('mediaViewer').open,true);assert.equal(f.get('mediaOriginal').href,'/media/a');assert.deepEqual(f.cards,['a.jpg','b.jpg']);assert.deepEqual(f.filters.map(button=>button.textContent),counts);}
 assert.equal(f.requests.length,before,'Do not reload or recategorize a filtered gallery during its open tagging session');assert.equal(f.mounted.at(-1).tags.length,1,'The visible tagging metadata still updates immediately');
 f.close();await f.flush();assert.deepEqual(f.cards,['b.jpg']);assert.equal(f.requests.length,before+1);assert.equal(f.filters[1].getAttribute('aria-pressed'),'true');assert.match(f.filters[2].textContent,/\(1\)/);
 f.filter('partial');await f.flush();assert.deepEqual(f.cards,['a.jpg']);
 f.open('a');f.review('a');await f.flush();assert.equal(f.get('mediaViewer').open,false);assert.deepEqual(f.cards,[]);assert.equal(f.filters[2].getAttribute('aria-pressed'),'true');f.filter('complete');await f.flush();assert.deepEqual(f.cards,['a.jpg']);
 f.filter('untagged');await f.flush();assert.deepEqual(f.cards,['b.jpg']);f.filter('all');await f.flush();assert.deepEqual(f.cards,['a.jpg','b.jpg']);
});

test('an edited gallery photo stays current in its viewer, thumbnail and reopened view in every tagging category',async()=>{
 for(const filter of ['all','untagged','partial','complete']){
  const a=photo('a',filter==='partial'?[{id:'yona'}]:[]);if(filter==='complete')a.faceSummary.reviewed=true;
  const f=fixture([a]);await f.flush();if(filter!=='all'){f.filter(filter);await f.flush();}f.open('a');const edited=f.edit('a');
  assert.equal(f.get('mediaViewer').open,true);assert.equal(f.get('mediaStage').children[0].src,edited);f.close();await f.flush();
  assert.equal(f.get('sharedGalleryGrid').children[0].dataset.mediaSrc,edited);assert.match(f.get('sharedGalleryGrid').children[0].innerHTML,/\?v=edit-/);
  f.open('a');assert.equal(f.get('mediaStage').children[0].src,edited);f.close();
 }
});
test('a slow refresh between two saved edits cannot roll the gallery back to the first edit',async()=>{
 const f=fixture();await f.flush();f.open('a');f.edit('a');f.defer();f.poll();assert.equal(f.pending.length,1);const latest=f.edit('a');f.pending.shift()();await f.flush();
 assert.equal(f.get('mediaStage').children[0].src,latest);assert.equal(f.get('sharedGalleryGrid').children[0].dataset.mediaSrc,latest);f.close();f.open('a');assert.equal(f.get('mediaStage').children[0].src,latest);
});
test('tagging the final detected face stays partial until confirmation, then an empty partial category stays selected',async()=>{
 const f=fixture([photo('a',[{id:'person-0'}])]);await f.flush();f.filter('partial');await f.flush();f.open('a');f.change('a','faces',2);await f.flush();
 assert.equal(f.get('mediaViewer').open,true);assert.deepEqual(f.cards,['a.jpg']);f.close();await f.flush();assert.deepEqual(f.cards,['a.jpg']);
 f.open('a');f.review('a');await f.flush();assert.equal(f.get('mediaViewer').open,false);assert.deepEqual(f.cards,[]);assert.equal(f.filters[2].getAttribute('aria-pressed'),'true');f.filter('complete');await f.flush();assert.deepEqual(f.cards,['a.jpg']);f.filter('partial');await f.flush();assert.deepEqual(f.cards,[]);assert.equal(f.get('sharedGalleryEmpty').hidden,false);
});
test('a gallery response requested before opening the photo cannot apply midway through tagging',async()=>{
 const f=fixture();await f.flush();f.filter('untagged');await f.flush();f.defer();f.poll();assert.equal(f.pending.length,1);f.open('a');f.change('a');f.change('a','face-detection');f.pending.shift()();await f.flush();
 assert.equal(f.get('mediaViewer').open,true);assert.equal(f.get('mediaOriginal').href,'/media/a');assert.deepEqual(f.cards,['a.jpg','b.jpg']);
 f.review('a');await f.flush();assert.equal(f.get('mediaViewer').open,true);assert.equal(f.get('mediaOriginal').href,'/media/b');f.close();await f.flush();assert.deepEqual(f.cards,['b.jpg']);assert.equal(f.window.FamilyPortal.galleryQuery().filter,'untagged');
});

test('completion keeps partial selected, advances to its next photo and puts only the completed photo in complete',async()=>{
 const f=fixture([photo('a',[{id:'person-0'}]),photo('b',[{id:'person-0'}]),photo('c')],{routing:true});await f.flush();f.filter('partial');await f.flush();await f.window.FamilyPortal.sortGallery('taken-asc');await f.window.FamilyPortal.refineGallery({person:'yona',labels:'holidays'});await f.flush();const query={...f.window.FamilyPortal.galleryQuery()};f.open('a');f.review('a');await f.flush();
 assert.deepEqual({...f.window.FamilyPortal.galleryQuery()},query);assert.equal(f.filters[2].getAttribute('aria-pressed'),'true');assert.equal(f.get('mediaViewer').open,true);assert.equal(f.get('mediaOriginal').href,'/media/b');assert.deepEqual(f.cards,['b.jpg']);assert.equal(f.get('mediaViewerCounter').textContent,'1 / 1');
 f.close();await f.flush();assert.equal(f.window.FamilyPortal.galleryQuery().filter,'partial');f.filter('complete');await f.flush();assert.deepEqual(f.cards,['a.jpg']);
});
test('undo keeps complete selected and advances or closes without sending the visitor to another category',async()=>{
 const items=[photo('a',[{id:'person-0'}]),photo('b',[{id:'person-0'}])];for(const item of items){item.faceSummary.reviewed=true;item.faceSummary.partial=false;}
 const f=fixture(items);await f.flush();f.filter('complete');await f.flush();f.open('a');f.review('a',false);await f.flush();assert.equal(f.filters[3].getAttribute('aria-pressed'),'true');assert.deepEqual(f.cards,['b.jpg']);assert.equal(f.get('mediaOriginal').href,'/media/b');
 f.review('b',false);await f.flush();assert.equal(f.get('mediaViewer').open,false);assert.equal(f.window.FamilyPortal.galleryQuery().filter,'complete');assert.deepEqual(f.cards,[]);f.filter('partial');await f.flush();assert.deepEqual(f.cards,['a.jpg','b.jpg']);
});
test('queued review responses keep All selected and preserve the final confirmation choice',async()=>{
 const f=fixture();await f.flush();f.open('a');f.defer();f.review('a');assert.equal(f.pending.length,1);f.review('a',false);f.pending.shift()();await f.flush();assert.equal(f.filters[0].getAttribute('aria-pressed'),'true');assert.equal(f.get('mediaOriginal').href,'/media/a');assert.equal(f.get('mediaViewer').open,true);assert.equal(f.server[0].faceSummary.reviewed,false);assert.match(f.requests.at(-1),/filter=all/);f.close();
});
test('the viewer counts the whole category and loads adjacent pages without losing its filter or sort',async()=>{
 for(const phone of [false,true])for(const filter of ['all','partial']){
  const f=fixture(Array.from({length:205},(_,i)=>photo(String(i),[{id:'person-0'}])),{phone});await f.flush();if(filter!=='all'){f.filter(filter);await f.flush();}await f.window.FamilyPortal.sortGallery('taken-asc');f.open('99');assert.equal(f.get('mediaViewerCounter').textContent,'100 / 205');
  f.get('mediaNext').click();await f.flush();assert.equal(f.get('mediaOriginal').href,'/media/100');assert.equal(f.get('mediaViewerCounter').textContent,'101 / 205');assert.equal(f.window.FamilyPortal.galleryQuery().filter,filter);assert.equal(f.window.FamilyPortal.galleryQuery().sort,'taken-asc');
  f.get('mediaPrevious').click();await f.flush();assert.equal(f.get('mediaOriginal').href,'/media/99');assert.equal(f.get('mediaViewerCounter').textContent,'100 / 205');f.close();
 }
});

test('an empty people or family filter explains how to change the criteria and reset restores the normal empty gallery',async()=>{
 const f=fixture([]);await f.flush();await f.window.FamilyPortal.refineGallery({person:'yona'});await f.flush();
 assert.equal(f.get('sharedGalleryEmpty').querySelector('h3').textContent,'לא נמצאו תמונות בסינון הזה');assert.match(f.get('sharedGalleryEmpty').querySelector('p').textContent,/לאפס את הסינון/);
 await f.window.FamilyPortal.refineGallery({unit:'u-matan-g'});await f.flush();assert.equal(f.get('sharedGalleryEmpty').querySelector('h3').textContent,'לא נמצאו תמונות בסינון הזה');
 await f.window.FamilyPortal.refineGallery({});await f.flush();assert.equal(f.get('sharedGalleryEmpty').querySelector('h3').textContent,'כל רגע משפחתי מתחיל בתמונה');
});

test('page navigation waits for an older response, wraps across the last page and cannot reopen a closed viewer',async()=>{
 const f=fixture(Array.from({length:205},(_,i)=>photo(String(i))));await f.flush();f.open('99');f.defer();f.poll();assert.equal(f.pending.length,1);f.get('mediaNext').click();assert.equal(f.get('mediaNext').disabled,true);f.pending.shift()();await f.flush();assert.equal(f.get('mediaOriginal').href,'/media/100');assert.equal(f.get('mediaViewerCounter').textContent,'101 / 205');
 await f.window.FamilyPortal.pageGallery(3);f.close();f.open('204');f.get('mediaNext').click();await f.flush();assert.equal(f.get('mediaOriginal').href,'/media/0');assert.equal(f.get('mediaViewerCounter').textContent,'1 / 205');f.get('mediaPrevious').click();await f.flush();assert.equal(f.get('mediaOriginal').href,'/media/204');assert.equal(f.get('mediaViewerCounter').textContent,'205 / 205');
 f.defer();f.get('mediaNext').click();f.close();f.pending.shift()();await f.flush();assert.equal(f.get('mediaViewer').open,false);
});
