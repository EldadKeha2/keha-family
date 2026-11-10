import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {File} from 'node:buffer';
import {readFile} from 'node:fs/promises';
import {browserHistory,navigationSource} from './helpers/browser-history.mjs';

const source=await readFile(new URL('../public/assets/media.js',import.meta.url),'utf8');
const swipeSource=await readFile(new URL('../public/assets/photo-swipe.js',import.meta.url),'utf8');
const presentationSource=await readFile(new URL('../public/assets/photo-presentation.js',import.meta.url),'utf8');
function fixture({navigation=false,english=false,native=true,files=true,cancel=false,clipboard=true,defer=false,url=null,loadView=null}={}){
  const nodes=new Map(),events=new Map(),windowEvents=new Map(),shared=[],copied=[],requests=[],pending=[];
  class Node{
    constructor(tag='div'){this.tagName=tag;this.handlers=new Map();this.hidden=false;this.open=false;this.textContent='';this.value='';this.isConnected=true;this.style={};const classes=new Set();this.classList={toggle(name,on){on=on??!classes.has(name);classes[on?'add':'delete'](name);},contains:name=>classes.has(name),add:name=>classes.add(name),remove:name=>classes.delete(name)};this.children=new Map();this.content=[];}
    addEventListener(type,callback){this.handlers.set(type,callback);}
    setAttribute(key,value){this[key]=value;}
    getAttribute(key){return key in this?String(this[key]):null;}
    removeAttribute(key){delete this[key];}
    querySelector(selector){if(this===nodes.get('mediaStage')&&['img','.native-photo-pane:nth-child(2) img','.face-photo-scroll img'].includes(selector))return this.content.find(node=>node.tagName==='img')||null;if(!this.children.has(selector))this.children.set(selector,new Node());return this.children.get(selector);}
    querySelectorAll(){return [];}
    replaceChildren(...nodes){this.content=nodes;}
    append(...nodes){for(const node of nodes)node.parentNode=this;this.content.push(...nodes);}
    remove(){this.isConnected=false;if(this.parentNode)this.parentNode.content=this.parentNode.content.filter(node=>node!==this);this.parentNode=null;}
    focus(){}
    select(){}
    load(){}
    showModal(){this.open=true;}
    close(){this.open=false;this.handlers.get('close')?.();}
  }
  const get=id=>{if(!nodes.has(id))nodes.set(id,new Node());return nodes.get(id);};
  const initial=url||'https://family.test/?lang='+(english?'en-US':'he')+'#gallery',browser=navigation?browserHistory(initial):null;
  const location=browser?.location||{origin:'https://family.test',href:initial};
  const window={FamilyApp:{apiEnabled:true,toast(){}},FamilyTags:{taggable:item=>['photo','video'].includes(item.kind),mountInline(){},clearInline(){},controls:()=>'',labels:()=>''},addEventListener(type,fn){if(!windowEvents.has(type))windowEvents.set(type,[]);windowEvents.get(type).push(fn);},dispatchEvent(event){for(const fn of windowEvents.get(event.type)||[])fn(event);}};
  window.FamilyI18n={isEnglish:english,language:english?'en-US':'he',t:v=>v,html:(parts,...values)=>parts.reduce((s,p,i)=>s+p+(values[i]??''),''),mediaName:p=>p.name||'',fetch:async(path,options)=>{requests.push({path,options});if(path.endsWith('/view')&&loadView)return loadView(path,options);return{ok:true,blob:()=>defer?new Promise(resolve=>pending.push(resolve)):Promise.resolve(new Blob(['picture'],{type:'image/jpeg'}))};}};
  const navigator={userActivation:{isActive:true},clipboard:{async writeText(value){if(!clipboard)throw Error('Unavailable');copied.push(value);}}};
  if(native){navigator.canShare=()=>files;navigator.share=async data=>{shared.push(data);if(cancel)throw Object.assign(Error('Cancelled'),{name:'AbortError'});};}
  const document={activeElement:null,getElementById:get,querySelector:()=>null,querySelectorAll:()=>[],createElement:tag=>new Node(tag),createTextNode:text=>({textContent:text}),addEventListener:(type,callback)=>events.set(type,callback)};
  if(browser)window.addEventListener=browser.addEventListener;
  const context=vm.createContext({window,document,location,navigator,File,Blob,URL,CustomEvent:class{constructor(type,{detail}){this.type=type;this.detail=detail;}},history:browser?.history||{replaceState(){}},matchMedia:()=>({matches:false}),clearTimeout,setTimeout});
  if(browser)vm.runInContext(navigationSource,context);vm.runInContext(presentationSource,context);vm.runInContext(swipeSource,context);vm.runInContext(source,context);events.get('DOMContentLoaded')();
  const photo=(id='a')=>({id,kind:'photo',mime:'image/jpeg',src:'/media/'+id,name:'Family photo',filename:'memory.jpg',tags:[]});
  return {browser,photo,window,document,events,nodes,get,navigator,shared,copied,requests,pending,open(id='a'){window.FamilyMedia.open([photo(id)],0,'gallery');},close(){get('mediaViewer').close();},click(){return get('shareMediaInstagram').handlers.get('click')({preventDefault(){}});}};
}

test('fullscreen reuses the decoded image, skips non-photos, wraps and restores tagging on the selected photo in every album',async()=>{
 for(const english of [false,true])for(const scope of ['gallery','photos','personal:ora','wedding:parents','nursery:ora','nostalgia','home:photos']){
  const f=fixture({english}),a=f.photo('a'),b=f.photo('b'),video={...f.photo('v'),kind:'video'},doc={...f.photo('d'),kind:'document'};let mounts=0;
  f.window.FamilyFaces={mount(){mounts++;},clear(){},update(){}};f.window.FamilyMedia.open([a,video,b,doc],0,scope);const image=f.get('mediaStage').content[0];assert.equal(mounts,1);
  assert.equal(f.window.FamilyMedia.setFullscreen(true),true);assert.equal(f.get('mediaStage').content[0],image);assert.equal(mounts,1,'A fullscreen slideshow does not run face detection');assert.equal(f.window.FamilyMedia.photoState().total,2);
  await f.window.FamilyMedia.step(1);assert.equal(f.window.FamilyMedia.current().id,'b');assert.equal(f.window.FamilyMedia.photoState().index,1);await f.window.FamilyMedia.step(1);assert.equal(f.window.FamilyMedia.current().id,'a');await f.window.FamilyMedia.step(-1);assert.equal(f.window.FamilyMedia.current().id,'b');
  f.window.FamilyMedia.setFullscreen(false);assert.equal(f.window.FamilyMedia.current().id,'b');assert.equal(mounts,2);assert.equal(f.get('mediaViewer').classList.contains('photo-fullscreen'),false);f.close();
 }
});
test('fullscreen traverses gallery pages, wraps the last page and retains the selected filter context',async()=>{
 const f=fixture(),pages=[[f.photo('a'),f.photo('b')],[f.photo('c'),f.photo('d')]],visited=[];
 const register=page=>f.window.FamilyMedia.register('gallery',pages[page-1],{pagination:{page,size:2,pages:2,total:4}});register(1);f.window.FamilyMedia.open(pages[0],1,'gallery');f.window.FamilyMedia.setFullscreen(true);
 f.window.FamilyPortal={pageGallery:async page=>{visited.push(page);register(page);}};
 await f.window.FamilyMedia.step(1);assert.equal(f.window.FamilyMedia.current().id,'c');assert.equal(f.window.FamilyMedia.photoState().index,2);assert.equal(f.window.FamilyMedia.photoState().total,4);assert.equal(f.window.FamilyMedia.photoState().active,true);
 await f.window.FamilyMedia.step(1);await f.window.FamilyMedia.step(1);assert.equal(f.window.FamilyMedia.current().id,'a');assert.deepEqual(visited,[2,1]);f.close();assert.equal(f.window.FamilyMedia.photoState().active,false);
});
test('fullscreen cannot discard a caption draft or interrupt face editing and pending face saves',()=>{
 const f=fixture();f.open();f.get('editOpenedCaption').handlers.get('click')();f.get('openedCaptionText').value='Unfinished description';assert.equal(f.window.FamilyMedia.setFullscreen(true),false);assert.equal(f.get('openedCaptionText').value,'Unfinished description');assert.equal(f.get('openedCaptionForm').hidden,false);
 f.get('cancelOpenedCaption').handlers.get('click')();
 for(const field of ['saving','reviewSaving','adjust','resizeDrag']){f.get('mediaStage')._familyFaceContext={[field]:true};assert.equal(f.window.FamilyMedia.setFullscreen(true),false,field);assert.equal(f.window.FamilyMedia.photoState().active,false);}
 delete f.get('mediaStage')._familyFaceContext;assert.equal(f.window.FamilyMedia.setFullscreen(true),true);f.close();
});
test('exiting fullscreen cancels an outstanding next-photo preparation and a late image cannot change the restored viewer',async()=>{
 const f=fixture();f.window.FamilyMedia.open([f.photo('a'),f.photo('b')],0,'photos');f.window.FamilyMedia.setFullscreen(true);let finish;
 f.window.FamilyPhotoPresentation.prepare=()=>new Promise(resolve=>finish=resolve);const pending=f.window.FamilyMedia.step(1);assert.equal(f.window.FamilyMedia.photoState().busy,true);
 f.window.FamilyMedia.setFullscreen(false);finish(f.document.createElement('img'));await pending;assert.equal(f.window.FamilyMedia.current().id,'a');assert.equal(f.window.FamilyMedia.photoState().active,false);assert.equal(f.window.FamilyMedia.photoState().busy,false);f.close();
});
test('direct photos adopt their route album after loading without resetting the image or active editing',async()=>{
 const id='a'.repeat(32),item={id,kind:'photo',scope:'gallery',mime:'image/jpeg',src:'/media/'+id,tags:[]};
 for(const [route,scope]of [['person/ora','personal:ora'],['weddings/u-fish','wedding:u-fish'],['nursery/ora','nursery:ora'],['gallery','gallery'],['photos','photos']]){
  const f=fixture({navigation:true,url:'https://family.test/?media='+id+'#'+route,loadView:async()=>({ok:true,json:async()=>({item})})});await f.browser.flush();
  assert.equal(f.get('mediaViewer').getAttribute('data-media-scope'),'link:'+id);const image=f.get('mediaStage').content[0];let clears=0,updates=0;f.window.FamilyFaces={mount(){},clear(){clears++;},update(){updates++;}};
  f.get('editOpenedCaption').handlers.get('click')();f.get('openedCaptionText').value='Unfinished caption';
  f.window.FamilyMedia.register(scope==='gallery'?'photos':'gallery',[item]);assert.equal(f.get('mediaViewer').getAttribute('data-media-scope'),'link:'+id,'An unrelated album must not claim the open photo');
  f.window.FamilyMedia.register(scope,[f.photo('before'),item,f.photo('after')]);
  assert.equal(f.get('mediaViewer').getAttribute('data-media-scope'),scope);assert.equal(f.get('mediaViewerCounter').textContent,'2 / 3');assert.equal(f.get('mediaPrevious').hidden,false);assert.equal(f.get('mediaNext').hidden,false);
  assert.equal(f.get('mediaStage').content[0],image);assert.equal(clears,0);assert.equal(updates,1);assert.equal(f.get('openedCaptionForm').hidden,false);assert.equal(f.get('openedCaptionText').value,'Unfinished caption');assert.equal(f.window.FamilyMedia.current().id,id);
  assert.equal(f.requests.length,1);f.get('cancelOpenedCaption').handlers.get('click')();f.get('mediaNext').handlers.get('click')();assert.equal(f.get('mediaOriginal').href,'/media/after');f.close();
 }
});
test('a direct photo response rechecks the preferred album when other albums finished first',async()=>{
 const id='b'.repeat(32),item={id,kind:'photo',scope:'gallery',mime:'image/jpeg',src:'/media/'+id,tags:[]};let finish;
 const f=fixture({navigation:true,url:'https://family.test/?media='+id+'#person/ora',loadView:()=>new Promise(resolve=>{finish=resolve;})});
 f.window.FamilyMedia.register('gallery',[item]);f.window.FamilyMedia.register('personal:ora',[f.photo('before'),item,f.photo('after')]);
 finish({ok:true,json:async()=>({item})});await f.browser.flush();assert.equal(f.get('mediaViewer').getAttribute('data-media-scope'),'personal:ora');assert.equal(f.get('mediaViewerCounter').textContent,'2 / 3');assert.equal(f.get('openedProfilePhoto').hidden,false);f.close();
});
test('late album loading cannot reopen a closed direct photo or replace another selected photo',async()=>{
 const id='c'.repeat(32),item={id,kind:'photo',scope:'gallery',src:'/media/'+id,tags:[]};
 for(const action of ['closed','different-photo']){
  const f=fixture({navigation:true,url:'https://family.test/?media='+id+'#person/ora',loadView:async()=>({ok:true,json:async()=>({item})})});await f.browser.flush();
  if(action==='closed')f.close();else f.window.FamilyMedia.open([f.photo('other')],0,'photos');
  f.window.FamilyMedia.register('personal:ora',[item]);assert.equal(f.get('mediaViewer').open,action!=='closed');if(action==='different-photo')assert.equal(f.window.FamilyMedia.current().id,'other');f.close();
 }
});

function pointer(f,type,x,y=100,extra={}){
 const event={pointerId:1,pointerType:'touch',isPrimary:true,button:0,clientX:x,clientY:y,cancelable:true,target:{closest:()=>null},preventDefault(){this.prevented=true;},...extra};
 f.events.get(type)?.(event);
 if(type==='pointerdown')f.get('mediaStage').handlers.get(type)?.(event);
 return event;
}
function swipe(f,dx,extra={}){pointer(f,'pointerdown',200,100,extra);pointer(f,'pointermove',200+dx,103,extra);pointer(f,'pointerup',200+dx,103,extra);}
test('a committed swipe holds its offset while the next photo loads instead of springing back',async()=>{
 const f=fixture();f.get('mediaStage').clientWidth=360;f.window.FamilyMedia.open([f.photo('a'),f.photo('b')],0,'gallery');let finish,settles=0;
 f.window.FamilyPhotoPresentation.prepare=()=>new Promise(resolve=>{finish=resolve;});f.window.FamilyPhotoPresentation.settle=()=>{settles++;};
 swipe(f,120);assert.equal(settles,0);assert.equal(f.get('mediaOriginal').href,'/media/a');finish(null);await new Promise(resolve=>setImmediate(resolve));assert.equal(f.get('mediaOriginal').href,'/media/b');
});
test('viewer previews load for browsing while the original remains the download and editor source',()=>{
 const f=fixture(),photo={...f.photo(),thumbnailSrc:'/media/a?thumbnail=1',previewSrc:'/media/a?preview=1'};f.window.FamilyMedia.open([photo],0,'gallery');assert.equal(f.get('mediaStage').content[0].src,photo.previewSrc);assert.equal(f.get('mediaOriginal').href,photo.src);
});
test('grid thumbnails never replace the original in the photo viewer, downloads or editing',()=>{
 const f=fixture(),photo={...f.photo(),thumbnailSrc:'/media/a?thumbnail=1',thumbnailSize:100};f.window.FamilyMedia.open([photo],0,'gallery');
 assert.equal(f.get('mediaStage').content[0].src,'/media/a');assert.equal(f.get('mediaOriginal').href,'/media/a');
});
test('wide Windows-style touch events can swipe after pointer cancellation without double navigation',()=>{
 const f=fixture();f.get('mediaStage').clientWidth=1440;f.window.FamilyMedia.open([f.photo('a'),f.photo('b'),f.photo('c')],0,'gallery');
 const touch=(type,x)=>{const p={identifier:9,clientX:x,clientY:100,target:{closest:()=>null}},event={touches:type==='touchend'?[]:[p],changedTouches:[p],target:p.target,cancelable:true,preventDefault(){this.prevented=true;}};(type==='touchstart'?f.get('mediaStage').handlers:f.events).get(type)(event);return event;};
 pointer(f,'pointerdown',200);touch('touchstart',200);pointer(f,'pointercancel',200);assert.equal(touch('touchmove',340).prevented,true);touch('touchend',340);
 assert.equal(f.get('mediaOriginal').href,'/media/b');
 pointer(f,'pointerdown',200);touch('touchstart',200);pointer(f,'pointermove',340);pointer(f,'pointerup',340);touch('touchend',340);assert.equal(f.get('mediaOriginal').href,'/media/c','A browser emitting both streams advances just once');
});
test('photo preparation keeps the current photo visible and cannot reopen a closed or changed album',async()=>{
 for(const action of ['finish','close','another-album','edit-target']){
  const f=fixture();let finish;f.window.FamilyMedia.open([f.photo('a'),f.photo('b')],0,'gallery');
  f.window.FamilyPhotoPresentation.prepare=()=>new Promise(resolve=>{finish=resolve;});
  const pending=f.get('mediaNext').handlers.get('click')();assert.equal(f.get('mediaOriginal').href,'/media/a');assert.equal(f.get('mediaNext').disabled,false);
  if(action==='close')f.close();if(action==='another-album')f.window.FamilyMedia.open([f.photo('c')],0,'photos');
  if(action==='edit-target')f.window.dispatchEvent(new CustomEvent('family-media-changed',{detail:{operation:'photo-edit',item:{...f.photo('b'),src:'/media/b?v=edited',photoRevision:'edited'}}}));
  const oldImage=f.document.createElement('img');oldImage.src='/media/b';finish(oldImage);await pending;
  if(action==='close')assert.equal(f.get('mediaViewer').open,false);
  else if(action==='another-album')assert.equal(f.get('mediaOriginal').href,'/media/c');
  else{assert.equal(f.get('mediaOriginal').href,action==='finish'?'/media/b':'/media/b?v=edited');assert.equal(f.get('mediaStage').content[0].src,f.get('mediaOriginal').href);assert.equal(f.get('mediaNext').disabled,false);}
 }
});
test('desktop button presses switch prepared photos and rebind their controls synchronously',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const f=fixture(),mounts=[],tags=[];let preparations=0;
 f.window.FamilyPhotoPresentation.ready=item=>Object.assign(f.document.createElement('img'),{src:item.src});f.window.FamilyPhotoPresentation.prepare=()=>{preparations++;return null;};f.window.FamilyPhotoPresentation.preload=()=>{};
 f.window.FamilyFaces={mount(_stage,_image,item){mounts.push(item.id);},clear(){},update(){}};f.window.FamilyTags.mountInline=(_panel,item)=>tags.push(item.id);
 f.get('mediaViewer').classList.add('personal-photo-desktop');f.window.FamilyMedia.open(['a','b','c','d'].map(f.photo),0,'photos');mounts.length=0;tags.length=0;
 const clicks=['b','c','d'].map(id=>{const pending=f.get('mediaNext').handlers.get('click')();assert.equal(f.window.FamilyMedia.current().id,id,'No microtask or image load is needed for a warm neighbour');return pending;});
 assert.equal(preparations,0);assert.deepEqual(tags,['b','c','d']);assert.deepEqual(mounts,['b','c','d']);t.mock.timers.tick(200);assert.deepEqual(mounts,['b','c','d'],'Button navigation does not queue a second controls mount');
 await Promise.all(clicks);f.close();t.mock.timers.tick(200);assert.deepEqual(mounts,['b','c','d']);
});
test('only desktop Previous and Next buttons skip sliding, including delayed loads and gallery page boundaries',async()=>{
 for(const desktop of [false,true])for(const fullscreen of [false,true]){
  const f=fixture(),slides=[],snapshots=[];f.window.FamilyPhotoPresentation.desktop=()=>desktop;f.window.FamilyPhotoPresentation.snapshot=()=>{snapshots.push(true);return {};};f.window.FamilyPhotoPresentation.slide=(_stage,_ghost,direction)=>{if(direction)slides.push(direction);};
  f.window.FamilyMedia.open(['a','b','c'].map(f.photo),0,'photos');if(fullscreen)f.window.FamilyMedia.setFullscreen(true);slides.length=0;snapshots.length=0;
  await f.get('mediaNext').handlers.get('click')();await f.get('mediaPrevious').handlers.get('click')();assert.equal(slides.length,desktop?0:2);assert.equal(snapshots.length,desktop?0:2);
  await f.window.FamilyMedia.step(1);assert.equal(slides.length,desktop?1:3,'Keyboard, slideshow and swipe navigation keep their existing transition');
  let finish;f.window.FamilyPhotoPresentation.prepare=()=>new Promise(resolve=>finish=resolve);const pending=f.get('mediaNext').handlers.get('click')();finish(null);await pending;assert.equal(slides.length,desktop?1:4,'Preparation retains the requested button transition');f.close();
 }
 const f=fixture(),slides=[];f.window.FamilyPhotoPresentation.desktop=()=>true;f.window.FamilyPhotoPresentation.slide=(_stage,_ghost,direction)=>{if(direction)slides.push(direction);};
 f.window.FamilyMedia.register('gallery',[f.photo('a')],{pagination:{page:1,pages:2,size:1,total:2}});f.window.FamilyMedia.openFrom('gallery','a');
 f.window.FamilyPortal={pageGallery:async page=>f.window.FamilyMedia.register('gallery',[f.photo(page===2?'b':'a')],{pagination:{page,pages:2,size:1,total:2}})};
 await f.get('mediaNext').handlers.get('click')();assert.equal(f.window.FamilyMedia.current().id,'b');assert.deepEqual(slides,[]);f.close();
});
test('rapid clicks select the latest pending photo and ignore earlier out-of-order image loads',async()=>{
 for(const fullscreen of [false,true]){
  const f=fixture(),pending=new Map(),tags=[];f.window.FamilyPhotoPresentation.preload=()=>{};f.window.FamilyPhotoPresentation.prepare=item=>new Promise(resolve=>pending.set(item.id,resolve));
  f.window.FamilyMedia.open(['a','b','c','d'].map(f.photo),0,'photos');if(fullscreen)f.window.FamilyMedia.setFullscreen(true);f.window.FamilyTags.mountInline=(_panel,item)=>tags.push(item.id);
  const first=f.window.FamilyMedia.step(1),second=f.window.FamilyMedia.step(1),last=f.window.FamilyMedia.step(1);assert.equal(f.window.FamilyMedia.current().id,'a');assert.equal(f.get('mediaNext').disabled,false);assert.deepEqual(tags,[],'Waiting does not rebuild the old photo');
  pending.get('c')(f.document.createElement('img'));await second;pending.get('b')(f.document.createElement('img'));await first;assert.equal(f.window.FamilyMedia.current().id,'a');
  pending.get('d')(f.document.createElement('img'));await last;assert.equal(f.window.FamilyMedia.current().id,'d');assert.equal(f.window.FamilyMedia.photoState().busy,false);assert.deepEqual(tags,['d']);f.close();
 }
});
test('reversing a pending next press keeps the displayed image and cancels the late result',async()=>{
 const f=fixture();f.window.FamilyPhotoPresentation.preload=()=>{};f.window.FamilyMedia.open(['a','b','c'].map(f.photo),0,'photos');const image=f.get('mediaStage').content[0];let finish;
 f.window.FamilyPhotoPresentation.prepare=()=>new Promise(resolve=>finish=resolve);const pending=f.window.FamilyMedia.step(1);await f.window.FamilyMedia.step(-1);assert.equal(f.window.FamilyMedia.current().id,'a');assert.equal(f.window.FamilyMedia.photoState().busy,false);
 finish(f.document.createElement('img'));await pending;assert.equal(f.get('mediaStage').content[0],image);assert.equal(f.window.FamilyMedia.current().id,'a');f.close();
});
test('a pending neighbour cannot overwrite a later gallery page selected by another next press',async()=>{
 const f=fixture(),pagination={page:1,pages:2,size:2,total:4};let finish;f.window.FamilyPhotoPresentation.preload=()=>{};f.window.FamilyMedia.register('gallery',['a','b'].map(f.photo),{pagination});f.window.FamilyMedia.openFrom('gallery','a');
 f.window.FamilyPhotoPresentation.prepare=()=>new Promise(resolve=>finish=resolve);f.window.FamilyPortal={pageGallery:async page=>f.window.FamilyMedia.register('gallery',['c','d'].map(f.photo),{pagination:{...pagination,page}})};
 const pending=f.window.FamilyMedia.step(1);await f.window.FamilyMedia.step(1);assert.equal(f.window.FamilyMedia.current().id,'c');assert.equal(f.window.FamilyMedia.photoState().pageLoading,false);
 finish(f.document.createElement('img'));await pending;assert.equal(f.window.FamilyMedia.current().id,'c');f.close();
});
test('touch swipes navigate every photo album in both languages and on wide touch screens',()=>{
 for(const english of [false,true])for(const width of [360,1440])for(const scope of ['gallery','photos','personal:ruti','wedding:parents','nostalgia','nursery:ruti']){
  const f=fixture({english});f.get('mediaStage').clientWidth=width;
  f.window.FamilyMedia.open([f.photo('a'),f.photo('b'),f.photo('c')],0,scope);
  swipe(f,english?-120:120);assert.equal(f.get('mediaOriginal').href,'/media/b',scope);
  swipe(f,english?120:-120);assert.equal(f.get('mediaOriginal').href,'/media/a',scope);
  swipe(f,english?120:-120);assert.equal(f.get('mediaOriginal').href,'/media/c','Previous wraps just like its arrow');
 }
});
test('taps, short drags, vertical scrolling, mouse drags and gestures over controls leave the photo in place',()=>{
 const f=fixture();f.get('mediaStage').clientWidth=360;f.window.FamilyMedia.open([f.photo('a'),f.photo('b')],0,'gallery');
 swipe(f,4);swipe(f,20);swipe(f,120,{pointerType:'mouse'});swipe(f,120,{target:{closest:()=>({})}});
 pointer(f,'pointerdown',100,100);pointer(f,'pointermove',110,220);pointer(f,'pointerup',240,225);
 assert.equal(f.get('mediaOriginal').href,'/media/a');
 const tap={detail:1,preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;}};
 pointer(f,'pointerdown',100);pointer(f,'pointerup',100);f.get('mediaStage').handlers.get('click')(tap);assert.equal(tap.prevented,undefined,'An ordinary tap still reaches face tagging');
});
test('pinch, cancelled and stale gestures never navigate and swipes cannot activate a face tag',()=>{
 const f=fixture();f.get('mediaStage').clientWidth=360;f.window.FamilyMedia.open([f.photo('a'),f.photo('b')],0,'gallery');
 pointer(f,'pointerdown',100);pointer(f,'pointermove',150);pointer(f,'pointerdown',200,100,{pointerId:2,isPrimary:false});pointer(f,'pointerup',240);
 pointer(f,'pointerdown',100);pointer(f,'pointermove',230);pointer(f,'pointercancel',230);pointer(f,'pointerup',230);
 pointer(f,'pointerdown',100);f.window.FamilyMedia.open([f.photo('a'),f.photo('b')],0,'photos');pointer(f,'pointerup',240);
 assert.equal(f.get('mediaOriginal').href,'/media/a');
 swipe(f,120);assert.equal(f.get('mediaOriginal').href,'/media/b');
 const click={detail:1,preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;}};
 f.get('mediaStage').handlers.get('click')(click);assert.equal(click.prevented,true);assert.equal(click.stopped,true);
 const keyboard={...click,detail:0,prevented:false,stopped:false};f.get('mediaStage').handlers.get('click')(keyboard);assert.equal(keyboard.prevented,false);
});
test('zoom, active tag edits, caption edits, other dialogs, videos and single-photo albums block swipes',()=>{
 const f=fixture();f.get('mediaStage').clientWidth=360;
 const open=()=>f.window.FamilyMedia.open([f.photo('a'),f.photo('b')],0,'gallery');open();
 f.window.FamilyFaces={canNavigate:()=>false,clear(){},update(){},mount(){}};swipe(f,120);assert.equal(f.get('mediaOriginal').href,'/media/a');
 f.window.FamilyFaces.canNavigate=()=>true;f.get('editOpenedCaption').handlers.get('click')();swipe(f,120);assert.equal(f.get('mediaOriginal').href,'/media/a');
 f.get('cancelOpenedCaption').handlers.get('click')();f.document.querySelector=()=>({open:true});swipe(f,120);assert.equal(f.get('mediaOriginal').href,'/media/a');f.document.querySelector=()=>null;
 f.window.FamilyMedia.open([{...f.photo('a'),kind:'video'},f.photo('b')],0,'videos');swipe(f,120);assert.equal(f.get('mediaOriginal').href,'/media/a');
 f.open();swipe(f,120);assert.equal(f.get('mediaOriginal').href,'/media/a');
 open();swipe(f,120);assert.equal(f.get('mediaOriginal').href,'/media/b');
});
test('swiping across gallery pages preserves pagination and applies the following gesture after loading',async()=>{
 const f=fixture(),pages=[],pagination={page:1,pages:2,size:2,total:4};f.get('mediaStage').clientWidth=360;
 let finish;f.window.FamilyPortal={pageGallery(page){pages.push(page);return new Promise(resolve=>{finish=()=>{f.window.FamilyMedia.register('gallery',[f.photo('c'),f.photo('d')],{pagination:{...pagination,page}});resolve();};});}};
 f.window.FamilyMedia.register('gallery',[f.photo('a'),f.photo('b')],{pagination});f.window.FamilyMedia.openFrom('gallery','b');
 swipe(f,120);swipe(f,120);assert.deepEqual(pages,[2]);finish();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(f.get('mediaOriginal').href,'/media/d');assert.equal(f.get('mediaViewerCounter').textContent,'4 / 4');
 swipe(f,-120);assert.equal(f.get('mediaOriginal').href,'/media/c');
});
test('successive phone strokes select every pending target without waiting for the previous image load',async()=>{
 for(const english of [false,true])for(const native of [false,true]){
  const f=fixture({english}),loads=new Map();f.get('mediaStage').clientWidth=360;f.window.FamilyPhotoPresentation.preload=()=>{};
  f.window.FamilyMedia.open(['a','b','c','d'].map(f.photo),0,'photos');f.window.FamilyPhotoPresentation.prepare=item=>new Promise(resolve=>loads.set(item.id,resolve));
  f.window.FamilyPhotoNative={mount(){},reset(){},claim:()=>native?'queued':'manual'};
  swipe(f,english?-120:120);swipe(f,english?-120:120);swipe(f,english?-120:120);assert.deepEqual([...loads.keys()],['b','c','d']);
  loads.get('b')(null);loads.get('c')(null);await new Promise(resolve=>setImmediate(resolve));assert.equal(f.window.FamilyMedia.current().id,'a');
  loads.get('d')(null);await new Promise(resolve=>setImmediate(resolve));assert.equal(f.window.FamilyMedia.current().id,'d');f.close();
 }
});
test('a photo load finishing under the next finger cannot replace its touch target or lose that stroke',async()=>{
 for(const native of [false,true]){
 const f=fixture(),loads=new Map();f.get('mediaStage').clientWidth=360;f.window.FamilyPhotoPresentation.preload=()=>{};f.window.FamilyMedia.open(['a','b','c'].map(f.photo),0,'photos');
 const moves=[];f.window.FamilyPhotoPresentation.prepare=item=>new Promise(resolve=>loads.set(item.id,resolve));f.window.FamilyPhotoPresentation.dragQueued=(_stage,dx,photos)=>moves.push({dx,current:photos.current.id,next:photos.next.id});f.window.FamilyPhotoNative={mount(){},reset(){},claim:()=>native?'queued':'manual'};
 const first=f.window.FamilyMedia.step(1,{native,queued:true}),shown=f.get('mediaStage').content[0];pointer(f,'pointerdown',200);pointer(f,'pointermove',340);
 if(native)assert.deepEqual(moves,[{dx:140,current:'b',next:'c'}],'The following photo already follows the finger while the earlier target is still loading');
 loads.get('b')(null);await new Promise(resolve=>setImmediate(resolve));assert.equal(f.window.FamilyMedia.current().id,'a');assert.equal(f.get('mediaStage').content[0],shown);
 pointer(f,'pointerup',340);assert.deepEqual([...loads.keys()],['b','c']);loads.get('c')(null);await first;await new Promise(resolve=>setImmediate(resolve));assert.equal(f.window.FamilyMedia.current().id,'c');f.close();
 }
});
test('pointer cancellation during a repeated Android stroke retains it through image loading and touch release',async()=>{
 const f=fixture(),loads=new Map();f.get('mediaStage').clientWidth=360;f.window.FamilyPhotoPresentation.preload=()=>{};f.window.FamilyMedia.open(['a','b','c'].map(f.photo),0,'photos');
 f.window.FamilyPhotoPresentation.prepare=item=>new Promise(resolve=>loads.set(item.id,resolve));f.window.FamilyPhotoNative={mount(){},reset(){},claim:()=> 'queued'};
 const touch=(type,x)=>{const p={identifier:9,clientX:x,clientY:100,target:{closest:()=>null}},event={touches:type==='touchend'?[]:[p],changedTouches:[p],target:p.target,cancelable:true,preventDefault(){}};(type==='touchstart'?f.get('mediaStage').handlers:f.events).get(type)(event);};
 const first=f.window.FamilyMedia.step(1,{native:true});pointer(f,'pointerdown',200);touch('touchstart',200);pointer(f,'pointercancel',200);loads.get('b')(null);await new Promise(resolve=>setImmediate(resolve));assert.equal(f.window.FamilyMedia.current().id,'a');
 touch('touchend',340);assert.deepEqual([...loads.keys()],['b','c']);loads.get('c')(null);await first;await new Promise(resolve=>setImmediate(resolve));assert.equal(f.window.FamilyMedia.current().id,'c');f.close();
});
test('a second stroke can finish the first native snap before scrollend, even with fully prepared neighbours',async()=>{
 const f=fixture();f.get('mediaStage').clientWidth=360;f.window.FamilyMedia.open(['a','b','c'].map(f.photo),0,'photos');f.window.FamilyPhotoPresentation.preload=()=>{};
 f.window.FamilyPhotoPresentation.ready=item=>Object.assign(f.document.createElement('img'),{src:item.src});let first,claimed=false;
 f.window.FamilyPhotoNative={mount(){},reset(){},claim(){if(!claimed){claimed=true;first=f.window.FamilyMedia.step(1,{native:true});}return 'queued';}};
 pointer(f,'pointerdown',200);assert.equal(f.window.FamilyMedia.current().id,'a');pointer(f,'pointermove',340);pointer(f,'pointerup',340);await first;
 assert.equal(f.window.FamilyMedia.current().id,'c');f.close();
});
test('a native gallery page arriving under the next stroke keeps the touch target until release, then advances again',async()=>{
 const f=fixture(),pagination={page:1,pages:2,size:2,total:4};let finish;f.get('mediaStage').clientWidth=360;
 f.window.FamilyPortal={pageGallery:page=>new Promise(resolve=>{finish=()=>{f.window.FamilyMedia.register('gallery',['c','d'].map(f.photo),{pagination:{...pagination,page}});resolve();};})};
 f.window.FamilyMedia.register('gallery',['a','b'].map(f.photo),{pagination});f.window.FamilyMedia.openFrom('gallery','b');f.window.FamilyPhotoNative={mount(){},reset(){},claim:()=> 'queued'};
 const first=f.window.FamilyMedia.step(1,{native:true});pointer(f,'pointerdown',200);pointer(f,'pointermove',340);finish();await new Promise(resolve=>setImmediate(resolve));assert.equal(f.window.FamilyMedia.current().id,'b');
 pointer(f,'pointerup',340);await first;await new Promise(resolve=>setImmediate(resolve));assert.equal(f.window.FamilyMedia.current().id,'d');assert.equal(f.get('mediaViewerCounter').textContent,'4 / 4');f.close();
});
test('the first native touch stays with browser scrolling and cannot also trigger fallback navigation',()=>{
 const f=fixture(),notes=[];f.get('mediaStage').clientWidth=360;f.window.FamilyMedia.open(['a','b','c'].map(f.photo),0,'photos');f.window.FamilyPhotoNative={mount(){},reset(){},claim:()=> 'native',note:(_stage,dx)=>notes.push(dx)};
 const touch=(type,x)=>{const p={identifier:9,clientX:x,clientY:100,target:{closest:()=>null}},event={touches:type==='touchend'?[]:[p],changedTouches:[p],target:p.target,cancelable:true,preventDefault(){this.prevented=true;}};(type==='touchstart'?f.get('mediaStage').handlers:f.events).get(type)(event);return event;};
 pointer(f,'pointerdown',200);touch('touchstart',200);pointer(f,'pointercancel',200);assert.equal(touch('touchmove',340).prevented,undefined);assert.deepEqual(notes,[]);touch('touchend',340);assert.deepEqual(notes,[140]);assert.equal(f.window.FamilyMedia.current().id,'a');f.close();
});
test('photo viewers request the family album toggle and keep current pixels while membership changes',()=>{
 const f=fixture(),calls=[];f.window.FamilyPhotoCollections={controls(item,scope,options){calls.push({item,scope,options});return item.kind==='photo'?'family-toggle':'';}};
 f.open();assert.equal(calls.at(-1).options.viewer,true);assert.equal(f.get('mediaViewerCollections').innerHTML,'family-toggle');
 const image=f.get('mediaStage').content[0];f.window.dispatchEvent(new CustomEvent('family-media-changed',{detail:{operation:'collection',scope:'photos',included:true,item:{...f.photo(),collections:['gallery','photos']}}}));
 assert.equal(f.get('mediaStage').content[0],image);assert.equal(calls.at(-1).item.collections.includes('photos'),true);
 f.window.FamilyMedia.open([{id:'video',kind:'video',src:'/media/video'}],0,'videos');assert.equal(f.get('mediaViewerCollections').innerHTML,'');
});
test('photo editing refreshes the displayed pixels, face coordinates and download, including after reopening',async()=>{
 for(const scope of ['gallery','personal:ruti','wedding:parents','nostalgia','nursery:ruti']){
  const f=fixture(),calls=[],mounts=[],photo=f.photo(),edited={...photo,src:'/media/a?v=new',photoRevision:'new'};
  f.window.FamilyFaces={clear(){},update(){},mount(_stage,img,item){mounts.push({img,item});}};
  f.window.FamilyPhotoEditor={async edit(item){calls.push(item);return {operation:'photo-edit',scope:'gallery',item:edited};}};
  f.window.FamilyMedia.open([photo],0,scope);assert.equal(f.get('editOpenedPhoto').hidden,false);
  const previousImage=f.get('mediaStage').content[0];
  await f.get('editOpenedPhoto').handlers.get('click')();assert.equal(calls.length,1);assert.equal(calls[0].id,'a');assert.equal(f.get('mediaOriginal').href,edited.src);assert.equal(f.get('mediaViewer').open,true);
  assert.equal(f.get('mediaStage').content[0].src,edited.src);assert.notEqual(f.get('mediaStage').content[0],previousImage);assert.equal(mounts.at(-1).item.photoRevision,'new');
  const editedImage=f.get('mediaStage').content[0];f.window.dispatchEvent(new CustomEvent('family-media-changed',{detail:{operation:'tags',item:{...edited,tags:[{id:'yona'}]}}}));
  assert.equal(f.get('mediaStage').content[0],editedImage,'Metadata updates must preserve the image and its active face controls');
  f.close();f.window.FamilyMedia.openFrom(scope,'a');assert.equal(f.get('mediaStage').content[0].src,edited.src);
  f.window.FamilyMedia.open([{id:'video',kind:'video',src:'/media/video'}],0,scope);assert.equal(f.get('editOpenedPhoto').hidden,true);
  await f.get('editOpenedPhoto').handlers.get('click')();assert.equal(calls.length,1);
 }
});
test('editing a retained photo refreshes its pixels without adding it back to the filtered album',async()=>{
 const f=fixture(),edited={...f.photo(),src:'/media/a?v=edited',photoRevision:'edited'};f.open();f.window.FamilyMedia.register('gallery',[],{retainCurrent:true});
 f.window.FamilyPhotoEditor={edit:async()=>({operation:'photo-edit',scope:'gallery',item:edited})};await f.get('editOpenedPhoto').handlers.get('click')();
 assert.equal(f.get('mediaViewer').open,true);assert.equal(f.get('mediaStage').content[0].src,edited.src);f.close();f.window.FamilyMedia.openFrom('gallery','a');assert.equal(f.get('mediaViewer').open,false);
});
test('editor cancellation leaves the current photo unchanged and editing keys cannot move the underlying album',async()=>{
 const f=fixture();f.window.FamilyPhotoEditor={edit:async()=>null};f.window.FamilyMedia.open([f.photo('a'),f.photo('b')],0,'gallery');
 await f.get('editOpenedPhoto').handlers.get('click')();assert.equal(f.get('mediaOriginal').href,'/media/a');
 f.document.querySelector=()=>({open:true});f.events.get('keydown')({key:'ArrowRight',target:{closest:()=>null},preventDefault(){}});assert.equal(f.get('mediaOriginal').href,'/media/a');
 f.document.querySelector=()=>null;f.events.get('keydown')({key:'ArrowRight',target:{closest:()=>null},preventDefault(){}});assert.equal(f.get('mediaOriginal').href,'/media/b');
});
test('Back closes a media viewer in its original album and Forward restores the cached photo once',async()=>{
  const f=fixture({navigation:true}),url=f.browser.location.href;
  f.open('a');assert.equal(f.browser.location.search,'?lang=he&media=a');assert.equal(f.get('mediaViewer').open,true);
  const length=f.browser.history.length;
  f.browser.history.back();await f.browser.flush();assert.equal(f.browser.location.href,url);assert.equal(f.get('mediaViewer').open,false);
  f.browser.history.forward();await f.browser.flush();assert.equal(f.get('mediaViewer').open,true);assert.equal(f.get('copyMediaLink').handlers.has('click'),true);
  assert.equal(f.browser.history.length,length);assert.equal(f.requests.length,0,'cached Forward must not fetch the shared link again');
  f.close();await f.browser.flush();assert.equal(f.browser.location.href,url);
  f.browser.history.back();await f.browser.flush();assert.equal(f.browser.location.hash,'#tree');assert.equal(f.get('mediaViewer').open,false);
});

test('moving between photos keeps one viewer history entry and returns to the album from the last photo',async()=>{
  const f=fixture({navigation:true});f.window.FamilyMedia.open([f.photo('a'),f.photo('b')],0,'gallery');
  const length=f.browser.history.length;
  f.get('mediaNext').handlers.get('click')();assert.equal(f.browser.location.search,'?lang=he&media=b');
  assert.equal(f.browser.history.length,length);f.close();await f.browser.flush();
  assert.equal(f.browser.location.hash,'#gallery');assert.equal(f.browser.location.search,'?lang=he');
  f.browser.history.forward();await f.browser.flush();assert.equal(f.get('mediaViewer').open,true);assert.equal(f.browser.location.search,'?lang=he&media=b');
});
test('Instagram shares an actual file through the native sheet and reuses the prepared file only for its own photo',async()=>{
  const f=fixture();f.open('a');await f.click();assert.equal(f.shared.length,1);assert.equal(f.shared[0].files.length,1);assert.equal(await f.shared[0].files[0].text(),'picture');assert.equal(f.shared[0].files[0].type,'image/jpeg');assert.equal(f.shared[0].url,undefined);assert.equal(f.requests[0].path,'/media/a');assert.equal(f.requests[0].options.cache,'force-cache');assert.equal(f.get('shareMediaInstagram').disabled,false);
  await f.click();assert.equal(f.requests.length,1);f.open('b');await f.click();assert.equal(f.requests.length,2);assert.equal(f.requests[1].path,'/media/b');
});
test('sharing a photo after editing fetches its new pixels and discards preparation of the old revision',async()=>{
 for(const inFlight of [false,true]){
  const f=fixture({defer:inFlight});f.open();const sharing=f.click();await new Promise(resolve=>setImmediate(resolve));if(!inFlight)await sharing;
  const edited={...f.photo(),src:'/media/a?v=new',photoRevision:'new'};f.window.dispatchEvent(new CustomEvent('family-media-changed',{detail:{operation:'photo-edit',scope:'gallery',item:edited}}));
  if(inFlight){f.pending.shift()(new Blob(['old'],{type:'image/jpeg'}));await sharing;assert.equal(f.shared.length,0);assert.equal(f.get('shareMediaInstagram').disabled,false);}
  const latest=f.click();await new Promise(resolve=>setImmediate(resolve));if(inFlight)f.pending.shift()(new Blob(['edited'],{type:'image/jpeg'}));await latest;
  assert.equal(f.requests.length,2);assert.equal(f.requests.at(-1).path,edited.src);if(inFlight)assert.equal(await f.shared[0].files[0].text(),'edited');
 }
});
test('unsupported sharing offers a photo download and a copied deep link, in both languages',async()=>{
  for(const english of [false,true])for(const native of [false,true]){
    const f=fixture({english,native,files:false});f.open();await f.click();assert.equal(f.shared.length,0);assert.equal(f.get('instagramShareHelp').hidden,false);assert.equal(f.get('downloadForInstagram').href,'/media/a');assert.equal(f.get('downloadForInstagram').textContent,english?'Download photo':'הורדת התמונה');assert.match(f.copied[0],/media=a/);assert.match(f.get('mediaShareStatus').textContent,english?/Link copied/:/הקישור הועתק/);
  }
});
test('a lost user gesture prepares the file for a second tap without fetching it again',async()=>{
  const f=fixture({english:true});f.open();f.navigator.userActivation.isActive=false;await f.click();assert.equal(f.shared.length,0);assert.match(f.get('mediaShareStatus').textContent,/Tap Instagram again/);f.navigator.userActivation.isActive=true;await f.click();assert.equal(f.shared.length,1);assert.equal(f.requests.length,1);
});
test('cancelling native share stays quiet and unavailable clipboard exposes a selectable link',async()=>{
  const native=fixture({cancel:true});native.open();await native.click();assert.equal(native.get('mediaShareStatus').textContent,'');assert.equal(native.get('instagramShareHelp').hidden,true);
  const fallback=fixture({native:false,clipboard:false});fallback.open();await fallback.click();assert.equal(fallback.get('mediaLinkFallback').hidden,false);assert.match(fallback.get('mediaLinkFallback').value,/media=a/);
});
test('a photo changed or closed during preparation is never shared or attached to the next photo',async()=>{
  for(const close of [false,true]){
    const f=fixture({defer:true});f.open('a');const pending=f.click();await new Promise(resolve=>setImmediate(resolve));assert.equal(f.pending.length,1);if(close)f.close();else f.open('b');f.pending[0](new Blob(['old-photo'],{type:'image/jpeg'}));await pending;assert.equal(f.shared.length,0);assert.equal(f.copied.length,0);if(!close)assert.equal(f.get('shareMediaInstagram').disabled,false);
  }
});
test('removing the current photo from its own event album advances or closes that album while preserving other albums',()=>{
 for(const scope of ['wedding:u-root','nursery:yona'])for(const last of [false,true]){
  const f=fixture(),first={...f.photo('a'),scope:'gallery',collections:['gallery','photos',scope]},next={...f.photo('b'),scope:'gallery',collections:['gallery',scope]};
  f.window.FamilyMedia.register('gallery',[first,next]);f.window.FamilyMedia.open(last?[first]:[first,next],0,scope);
  f.window.dispatchEvent(new CustomEvent('family-media-changed',{detail:{operation:'collection',scope,included:false,item:{...first,collections:['gallery','photos']},collection:{items:last?[]:[next],count:last?0:1}}}));
  assert.equal(f.get('mediaViewer').open,!last);if(!last)assert.equal(f.get('mediaOriginal').href,'/media/b');
  f.window.FamilyMedia.openFrom('gallery','a');assert.equal(f.get('mediaViewer').open,true);assert.equal(f.get('mediaOriginal').href,'/media/a','The original is still available in the family gallery');
 }
});
test('tagging can keep the current photo open while the untagged album updates behind it',()=>{
  const f=fixture();f.open('a');
  const next={id:'b',kind:'photo',src:'/media/b',name:'Next photo',tags:[]};
  f.window.FamilyMedia.register('gallery',[next],{retainCurrent:true});
  assert.equal(f.get('mediaViewer').open,true);assert.equal(f.get('mediaOriginal').href,'/media/a');
  f.window.FamilyMedia.requestDelete('gallery','a');assert.equal(f.get('deleteMediaDialog').open,true,'The retained photo still supports its normal actions');f.get('deleteMediaDialog').close();
  f.get('mediaNext').handlers.get('click')();assert.equal(f.get('mediaOriginal').href,'/media/b');
  f.window.FamilyMedia.register('gallery',[],{retainCurrent:true});assert.equal(f.get('mediaViewer').open,true);assert.equal(f.get('mediaOriginal').href,'/media/b');
  f.window.FamilyMedia.register('gallery',[]);assert.equal(f.get('mediaViewer').open,false,'An actual deletion can still close the last photo');
  f.window.FamilyMedia.openFrom('gallery','b');assert.equal(f.get('mediaViewer').open,false,'The retained photo must not leak into the filtered album on reopening');
});
test('repeated tag, face and detector events cannot close or replace a photo already omitted from a filtered album',()=>{
 for(const onlyPhoto of[false,true]){
  const f=fixture(),photo=f.photo('a'),next=f.photo('b');f.window.FamilyMedia.open(onlyPhoto?[photo]:[photo,next],0,'gallery');
  f.window.FamilyMedia.register('gallery',onlyPhoto?[]:[next],{retainCurrent:true});
  for(const[index,operation]of['tags','faces','face-detection','face-review','tags'].entries()){
   f.window.dispatchEvent(new CustomEvent('family-media-changed',{detail:{operation,scope:'gallery',item:{...photo,tags:[{id:'yona'}],tagsRevision:'revision-'+index}}}));
   assert.equal(f.get('mediaViewer').open,true,operation+' must keep the viewer open');assert.equal(f.get('mediaOriginal').href,'/media/a',operation+' must not advance to another photo');
   assert.equal(f.get('mediaTagPanel').hidden,false);
  }
  f.get('closeMediaViewer').handlers.get('click')();assert.equal(f.get('mediaViewer').open,false);
  f.window.FamilyMedia.openFrom('gallery','a');assert.equal(f.get('mediaViewer').open,false,'A retained photo must not be reinserted into the actual filtered collection');
 }
});
test('a click retargeted to the viewer after a tag option disappears cannot dismiss the photo',()=>{
 const f=fixture();f.open('a');f.get('mediaViewer').handlers.get('click')?.({target:f.get('mediaViewer')});assert.equal(f.get('mediaViewer').open,true);
 f.get('closeMediaViewer').handlers.get('click')();assert.equal(f.get('mediaViewer').open,false);
});
test('an unrelated deletion cannot evict a pinned photo, while deleting that photo still closes it',()=>{
 const f=fixture();f.open('a');f.window.FamilyMedia.register('gallery',[],{retainCurrent:true});
 f.window.dispatchEvent(new CustomEvent('family-media-changed',{detail:{operation:'delete',scope:'gallery',item:f.photo('b')}}));assert.equal(f.get('mediaViewer').open,true);assert.equal(f.get('mediaOriginal').href,'/media/a');
 f.window.dispatchEvent(new CustomEvent('family-media-changed',{detail:{operation:'delete',scope:'gallery',item:f.photo('a')}}));assert.equal(f.get('mediaViewer').open,false);
});
test('the profile action follows the album owner gender when switching between personal albums',()=>{
  const f=fixture(),owners={rachel:{gender:'f'},avishai:{gender:'m'}};
  f.window.FamilyApp.getPerson=id=>owners[id];
  const photo={id:'group',kind:'photo',src:'/media/group',file:'group.jpg',tags:[{id:'avishai',gender:'m'}]};
  const button=f.get('openedProfilePhoto'),hair=button.querySelector('[data-profile-hair]');
  f.window.FamilyMedia.open([photo],0,'personal:rachel');assert.equal(button.hidden,false);assert.equal(button.getAttribute('data-gender'),'f');assert.equal(hair.getAttribute('hidden'),null);
  f.window.FamilyMedia.open([photo],0,'personal:avishai');assert.equal(button.getAttribute('data-gender'),'m');assert.equal(hair.getAttribute('hidden'),'');
  f.window.FamilyMedia.open([photo],0,'personal:guest');assert.equal(button.getAttribute('data-gender'),'unknown');
  f.window.FamilyMedia.open([photo],0,'gallery');assert.equal(button.hidden,true,'Only a personal album offers profile selection');
});
test('the effective profile stays selected across photo navigation and live owner updates',()=>{
 for(const english of [false,true]){
  const f=fixture({english}),owner={profileFile:'b.jpg',profile:'/media/b?v=edited',profileId:'old-deleted'};
  f.window.FamilyApp.getPerson=()=>({gender:'f'});f.window.FamilyApp.getPersonSummary=()=>owner;
  const photos=['a','b'].map(id=>({...f.photo(id),file:id+'.jpg'})),button=f.get('openedProfilePhoto');
  f.window.FamilyMedia.open(photos,0,'personal:rachel');assert.equal(button.getAttribute('aria-pressed'),'false');
  f.get('mediaNext').handlers.get('click')();assert.equal(button.getAttribute('aria-pressed'),'true');assert.equal(button.querySelector('span').textContent,english?'Current profile picture':'זו תמונת הפרופיל');
  f.get('mediaPrevious').handlers.get('click')();assert.equal(button.getAttribute('aria-pressed'),'false');
  owner.profileFile='a.jpg';f.window.dispatchEvent(new CustomEvent('family-profile-changed',{detail:{id:'rachel'}}));assert.equal(button.getAttribute('aria-pressed'),'true');
 }
});
test('clicking a selected profile restores its predecessor, updates the marks and sends one guarded request',async()=>{
 for(const english of [false,true]){
  const f=fixture({english}),owner={profileFile:'b.jpg',profile:'/media/b'},photos=['a','b'].map(id=>({...f.photo(id),file:id+'.jpg'})),button=f.get('openedProfilePhoto');
  f.window.FamilyApp.getPersonSummary=()=>owner;f.window.FamilyApp.updatePerson=(_id,person)=>Object.assign(owner,person);
  let resolve;f.window.FamilyI18n.fetch=async(path,options)=>{f.requests.push({path,options});return new Promise(done=>resolve=done);};
  f.window.FamilyMedia.open(photos,1,'personal:rachel');assert.equal(button.getAttribute('aria-pressed'),'true');assert.match(button.title,english?/undo/:/לביטול/);
  const undo=button.handlers.get('click')();await button.handlers.get('click')();assert.equal(f.requests.length,1);assert.equal(f.requests[0].path,'api/people/rachel/profile');assert.deepEqual(JSON.parse(f.requests[0].options.body),{file:'b.jpg',restorePrevious:true});
  f.get('mediaPrevious').handlers.get('click')();resolve({ok:true,json:async()=>({person:{profileId:'a',profileFile:'a.jpg',profile:'/media/a'}})});await undo;
  assert.equal(button.getAttribute('aria-pressed'),'true','The restored previous photo gets its mark even after navigation');f.get('mediaNext').handlers.get('click')();assert.equal(button.getAttribute('aria-pressed'),'false');assert.equal(button.disabled,false);
 }
});
test('undo with no predecessor shows no profile, can be selected again, and a failed undo preserves the selected state',async()=>{
 const f=fixture(),owner={profileId:'a',profileFile:'a.jpg',profile:'/media/a'},item={...f.photo(),file:'a.jpg'},button=f.get('openedProfilePhoto');
 f.window.FamilyApp.getPersonSummary=()=>owner;f.window.FamilyApp.updatePerson=(_id,person)=>Object.assign(owner,person);f.window.FamilyI18n.error=value=>value;
 let response={ok:false,json:async()=>({error:'Unavailable'})};f.window.FamilyI18n.fetch=async(path,options)=>{f.requests.push({path,options});return response;};
 f.window.FamilyMedia.open([item],0,'personal:rachel');await button.handlers.get('click')();assert.equal(button.getAttribute('aria-pressed'),'true');assert.equal(owner.profile,'/media/a');
 response={ok:true,json:async()=>({person:{profileId:null,profileFile:null,profile:null,profileCleared:true}})};await button.handlers.get('click')();assert.equal(owner.profile,null);assert.equal(button.getAttribute('aria-pressed'),'false');
 response={ok:true,json:async()=>({person:{profileId:'a',profileFile:'a.jpg',profile:'/media/a',profileCleared:false}})};await button.handlers.get('click')();assert.deepEqual(JSON.parse(f.requests.at(-1).options.body),{file:'a.jpg'});assert.equal(button.getAttribute('aria-pressed'),'true');
});
test('a profile save updates the correct photo after navigation, survives reopening, and a failed save adds no selection',async()=>{
 const f=fixture(),owners={rachel:{profileFile:'a.jpg'},other:{profileFile:'other.jpg'}},photos=['a','b','c'].map(id=>({...f.photo(id),file:id+'.jpg'})),button=f.get('openedProfilePhoto');
 f.window.FamilyApp.getPersonSummary=id=>owners[id];f.window.FamilyApp.updatePerson=(id,person)=>Object.assign(owners[id],person);f.window.FamilyI18n.error=value=>value;
 let resolve;f.window.FamilyI18n.fetch=async(path,options)=>{f.requests.push({path,options});return new Promise(done=>resolve=done);};
 f.window.FamilyMedia.open(photos,1,'personal:rachel');const saving=button.handlers.get('click')();assert.equal(button.getAttribute('aria-pressed'),'false');
 f.get('mediaPrevious').handlers.get('click')();resolve({ok:true,json:async()=>({person:{profileFile:'b.jpg',profile:'/media/b'}})});await saving;
 assert.equal(button.getAttribute('aria-pressed'),'false','The old photo must lose its mark when the new save succeeds');
 f.get('mediaNext').handlers.get('click')();assert.equal(button.getAttribute('aria-pressed'),'true');f.close();f.window.FamilyMedia.open(photos,1,'personal:rachel');assert.equal(button.getAttribute('aria-pressed'),'true');
 f.get('mediaNext').handlers.get('click')();const failing=button.handlers.get('click')();resolve({ok:false,json:async()=>({error:'Not saved'})});await failing;assert.equal(button.getAttribute('aria-pressed'),'false');assert.equal(button.disabled,false);assert.equal(owners.rachel.profileFile,'b.jpg');
});
test('wedding and baby albums offer their own cover selection without replacing a person profile',async()=>{
 for(const english of[false,true])for(const scope of['wedding:u-root','nursery:yona']){
  const f=fixture({english}),item={...f.photo('a'),file:'a.jpg'};let profileUpdates=0;f.window.FamilyApp.updatePerson=()=>profileUpdates++;
  f.window.FamilyI18n.fetch=async(path,options)=>{f.requests.push({path,options});return{ok:true,json:async()=>({saved:true,operation:'album-cover',scope,item,collection:{items:[item],count:1,cover:item.src}})};};
  f.window.FamilyMedia.open([item],0,scope);const button=f.get('openedProfilePhoto');assert.equal(button.hidden,false);assert.match(button.querySelector('span').textContent,scope.startsWith('wedding:')?(english?/wedding/:/חתונה/):(english?/baby/:/תינוקייה/));
  await button.handlers.get('click')();assert.equal(f.requests[0].path,'api/collections/cover');assert.deepEqual(JSON.parse(f.requests[0].options.body),{collection:scope,mediaId:'a'});assert.equal(profileUpdates,0);assert.equal(f.get('mediaViewer').open,true);assert.equal(button.disabled,false);assert.equal(button.getAttribute('aria-pressed'),'true');
  f.close();f.window.FamilyMedia.register(scope,[item],{cover:item.src+'?revision=latest'});f.window.FamilyMedia.open([item],0,scope);assert.equal(button.getAttribute('aria-pressed'),'true');
 }
});
test('desktop header captions follow photo navigation and both screen sizes retain their own description labels',()=>{
  for(const english of [false,true]){
    const f=fixture({english}),photos=[{id:'a',kind:'photo',src:'/media/a',caption:'A family memory',tags:[]},{id:'b',kind:'photo',src:'/media/b',caption:'',tags:[]}];
    f.window.FamilyMedia.open(photos,0,'gallery');
    assert.equal(f.get('mediaHeaderCaption').textContent,'A family memory');assert.equal(f.get('mediaViewerCaption').textContent,'A family memory');
    assert.equal(f.get('editOpenedCaption').querySelector('[data-media-caption-desktop]').textContent,english?'Add a photo description':'להוספת תיאור לתמונה');
    assert.equal(f.get('editOpenedCaption').querySelector('[data-media-caption-mobile]').textContent,english?'Add a description':'הוסף תיאור לתמונה');
    f.get('mediaNext').handlers.get('click')();assert.equal(f.get('mediaHeaderCaption').textContent,'');assert.equal(f.get('mediaViewerCaption').textContent,'','Moving to an uncaptioned photo clears the previous description everywhere');
    assert.equal(f.get('openedProfilePhoto').hidden,true,'The shared gallery does not offer profile selection');
  }
});
