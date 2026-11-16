import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';

const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
const names=['gallery-input-settings.js','photo-native.js','photo-swipe.js','media.js'];
const sources=new Map(await Promise.all(names.map(async name=>[name,await readFile(new URL('../public/assets/'+name,import.meta.url),'utf8')])));
const stylesheet=await readFile(new URL('../public/'+html.match(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/)[1],import.meta.url),'utf8');
const nativeRule=stylesheet.match(/(?:^|})\s*\.native-photo-strip\{([^}]+)\}/)?.[1]||'';
const nativeStyle=name=>nativeRule.match(new RegExp('(?:^|;)'+name+':([^;]+)'))?.[1]?.trim()||'';
const directionKey='keha-gallery-pad-direction-v2';
const presentationSource=await readFile(new URL('../public/assets/photo-presentation.js',import.meta.url),'utf8');
const flush=async()=>{for(let i=0;i<4;i++)await new Promise(resolve=>setImmediate(resolve));};

function browserWheel(f,target,deltaX,extra={}){
 const ancestor=target.closest('.native-photo-strip'),viewport=ancestor||f.strip(),before=viewport.scrollLeft;
 const event=f.emit(target,'wheel',{deltaX,deltaY:0,deltaMode:0,clientX:400,clientY:250,...extra});
 // Model the browser's normal wheel action only when script did not own it.
 if(ancestor&&!event.defaultPrevented&&!event.ctrlKey&&!event.metaKey&&!['hidden','clip'].includes(viewport.style.overflowX||nativeStyle('overflow-x')))viewport.scrollLeft+=deltaX;
 f.emit(viewport,'scroll');return {event,viewport,before,after:viewport.scrollLeft};
}

function nativeStroke(f,dx,{wheel=false}={}){
 const viewport=f.strip();assert.ok(viewport,'A rapid gesture still needs an active native input surface');
 const target=viewport.children[1].querySelector('img,video,iframe')||viewport;
 if(wheel){browserWheel(f,target,dx);return viewport;}
 else for(const [type,x]of [['pointerdown',200],['pointermove',200+dx],['pointerup',200+dx]])f.emit(target,type,{pointerType:'touch',pointerId:1,isPrimary:true,button:0,clientX:x,clientY:250});
 return viewport;
}

async function finishWheel(f,viewport){
 await new Promise(resolve=>setTimeout(resolve,100));await flush();
}

// Browser geometry and image readiness are the boundaries modeled here. The
// production index, DOM tree, native scroller, gesture binding and media state
// machine are real, so missing script wiring or reparenting cannot be hidden
// by the lightweight object fixtures used in the individual unit suites.
function fixture({supported=true,mobile=false,width=1200,delayedFaces=false,realPresentation=false,hiddenDialogGeometry=false,query='',route='photos',linkedItem=null,loadView=null,storage=new Map([[directionKey,'1']])}={}){
 const {window,document}=parseHTML(html),requests=[],captures=[],observers=[],faceReady=[],faceMounts=[],animations=[],frames=new Map();let failSave=false,layoutReady=!hiddenDialogGeometry,frameId=0;
 const get=id=>document.getElementById(id);
 Object.defineProperty(document,'scripts',{configurable:true,get:()=>document.querySelectorAll('script[src]')});
 window.localStorage={getItem:key=>storage.has(key)?storage.get(key):null,setItem:(key,value)=>storage.set(key,String(value)),removeItem:key=>storage.delete(key)};
 for(const dialog of document.querySelectorAll('dialog')){
  dialog.showModal=()=>{dialog.open=true;dialog.setAttribute('open','');};
  dialog.close=()=>{dialog.open=false;dialog.removeAttribute('open');dialog.dispatchEvent(new window.Event('close'));};
 }
 Object.defineProperty(window.HTMLElement.prototype,'clientWidth',{configurable:true,get(){if(hiddenDialogGeometry&&(!layoutReady||this.closest('dialog')&&!this.closest('dialog').open))return 0;return this._testWidth??width;}});
 Object.defineProperty(window.HTMLElement.prototype,'onscrollend',{configurable:true,value:null,writable:true});
 window.HTMLElement.prototype.getBoundingClientRect=function(){return {x:0,y:100,left:0,right:this.clientWidth,top:100,bottom:700,width:this.clientWidth,height:600};};
 window.HTMLElement.prototype.setPointerCapture=function(id){captures.push({node:this,id});};
 window.HTMLElement.prototype.focus=function(){Object.defineProperty(document,'activeElement',{value:this,configurable:true});};
 window.HTMLElement.prototype.blur=function(){if(document.activeElement===this)Object.defineProperty(document,'activeElement',{value:document.body,configurable:true});};
 window.HTMLElement.prototype.pause=function(){this.paused=true;};
 window.HTMLElement.prototype.load=function(){};
 if(realPresentation){
  Object.defineProperty(window.HTMLImageElement.prototype,'complete',{configurable:true,get:()=>true});
  Object.defineProperty(window.HTMLImageElement.prototype,'naturalWidth',{configurable:true,get:()=>1200});
  Object.defineProperty(window.HTMLImageElement.prototype,'naturalHeight',{configurable:true,get:()=>800});
  window.HTMLImageElement.prototype.decode=()=>Promise.resolve();
  window.HTMLCanvasElement.prototype.getContext=()=>({drawImage(){}});
  window.HTMLElement.prototype.animate=function(){
   let finish;const animation={node:this,cancelled:false,finished:new Promise(resolve=>{finish=resolve;}),cancel(){this.cancelled=true;finish();},finish(){finish();}};animations.push(animation);return animation;
  };
 }
 const emit=(node,type,props={})=>{const {cancelable=true,...values}=props,event=new window.Event(type,{bubbles:true,cancelable});Object.assign(event,values);node.dispatchEvent(event);return event;};
 const navigator={userAgent:mobile?'Android Mobile':'Windows NT 10.0',maxTouchPoints:5};
 window.ontouchstart=null;
 const presentation={desktop:()=>!mobile,source:item=>item.previewSrc||item.src,preload(){},cancel(){window.FamilyPhotoNative?.reset();},settle(){},slide(){},snapshot:()=>null,prepare:()=>null};
 Object.assign(window,{
  FamilyApp:{apiEnabled:true,toast(){}},FamilyPhotoPresentation:presentation,
  FamilyPhotoKeyboard:{desktop:()=>!mobile,bindNavigation(){}},
  FamilyTags:{taggable:()=>true,mountInline(){},clearInline(){},controls:()=>'',labels:()=>''},
  FamilyI18n:{isEnglish:false,language:'he',t:String,error:String,mediaName:item=>item.name||item.id,html:(parts,...values)=>parts.reduce((out,part,i)=>out+part+(values[i]??''),''),fetch:async(path,options)=>{
   requests.push({path,options});if(path.endsWith('/view')&&loadView)return loadView(path,options);if(path.endsWith('/view')&&linkedItem)return Response.json({item:linkedItem});const caption=JSON.parse(options.body).caption;
   return Response.json(failSave?{error:'Caption was not saved'}:{operation:'caption',scope:'photos',item:{...window.FamilyMedia.current(),caption}},{status:failSave?409:200});
  }},
  FamilyFaces:{
   mount(stage,image,item){
    faceMounts.push({stage,image,item});
    const context={image,item,zoom:1};stage._familyFaceContext=context;
    const ready=()=>{
     if(stage._familyFaceContext!==context||!image.isConnected)return;
     const scroller=document.createElement('div');scroller.className='face-photo-scroll';
     const surface=document.createElement('div');surface.className='face-photo-surface';surface.append(image);scroller.append(surface);stage.append(scroller);
     window.FamilyMedia.refreshPhotoPresentation();
    };
    if(delayedFaces)faceReady.push(ready);else queueMicrotask(ready);
   },
   clear(){delete get('mediaStage')._familyFaceContext;},update(){},fit(){},
   canNavigate(stage){const c=stage._familyFaceContext;return !c||c.zoom===1&&!c.saving&&!c.adjust;}
  }
 });
 class ResizeObserver{
  constructor(callback){this.callback=callback;this.nodes=new Set();observers.push(this);}
  observe(node){this.nodes.add(node);}
  disconnect(){this.nodes.clear();}
 }
 function Image(){
  const image=document.createElement('img');Object.defineProperty(image,'src',{configurable:true,get(){return this.getAttribute('src')||'';},set(value){this.setAttribute('src',value);queueMicrotask(()=>{image.onload?.();image.dispatchEvent(new window.Event('load'));});}});return image;
 }
 const location={origin:'https://family.test',href:'https://family.test/'+query+'#'+route};
 const context=vm.createContext({window,document,navigator,...(realPresentation?{Image}:{}),CSS:{supports:()=>supported},ResizeObserver,CustomEvent:window.CustomEvent,URL,Response,history:{replaceState(){}},location,matchMedia:query=>({matches:query.includes('max-width')&&(mobile||width<=700)}),getComputedStyle:()=>({minHeight:'40',maxHeight:'280',backgroundColor:'#ede5d4'}),requestAnimationFrame:fn=>{const id=++frameId;if(layoutReady)queueMicrotask(fn);else frames.set(id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id),setTimeout:(fn,ms)=>{const timer=setTimeout(fn,ms);timer.unref();return timer;},clearTimeout});
 // Follow production ordering when loading the scripts under test.
 const loaded=[];
 for(const script of document.querySelectorAll('script[src]')){
  const name=script.getAttribute('src').split('/').at(-1).split('?')[0];
  if(name==='photo-presentation.js'&&realPresentation)vm.runInContext(presentationSource,context,{filename:name});
  if(sources.has(name)){vm.runInContext(sources.get(name),context,{filename:name});loaded.push(name);}
 }
 document.dispatchEvent(new window.Event('DOMContentLoaded'));
 const photo=id=>({id,kind:'photo',mime:'image/jpeg',src:'/media/'+id,previewSrc:'/media/'+id+'?preview=1',name:id,tags:[]});
 const video=id=>({...photo(id),kind:'video',mime:'video/mp4',poster:'/posters/'+id+'.jpg'});
 const strip=()=>get('mediaStage').querySelector('.native-photo-strip');
 return {window,document,location,get,emit,requests,captures,loaded,photo,video,strip,faceReady,faceMounts,animations,
  finishAnimations(){for(const animation of animations)animation.finish();},
  open:async(kind='photo',scope=kind==='photo'?'photos':'videos',index=0)=>{window.FamilyMedia.open(['a','b','c'].map(kind==='photo'?photo:video),index,scope);await flush();},
  async snap(page){nativeStroke({strip,emit},page===0?140:-140);await flush();},
  resize(value){const viewport=strip();viewport._testWidth=value;for(const observer of observers)if(observer.nodes.has(viewport))observer.callback([{target:viewport}]);},
  layout(){layoutReady=true;for(const observer of observers)for(const node of observer.nodes)if(node.isConnected)observer.callback([{target:node}]);const pending=[...frames.values()];frames.clear();for(const callback of pending)callback();},
  zoom(value){const stage=get('mediaStage');stage._familyFaceContext.zoom=value;stage.classList.toggle('face-photo-enlarged',value>1);window.FamilyMedia.refreshPhotoPresentation();},
  failSaving(value=true){failSave=value;},
  close(){get('mediaViewer').close();}
 };
}

test('production loads the native controller before the gallery binds gesture input',()=>{
 const f=fixture();for(const name of names)assert.ok(f.loaded.includes(name),name+' must be loaded by the production page');
 assert.ok(f.loaded.indexOf('gallery-input-settings.js')<f.loaded.indexOf('photo-native.js'));assert.ok(f.loaded.indexOf('photo-native.js')<f.loaded.indexOf('media.js'));assert.ok(f.loaded.indexOf('photo-swipe.js')<f.loaded.indexOf('media.js'));assert.equal(f.window.FamilyPhotoNative.supported(),true);assert.equal(f.window.FamilyPhotoNative.version,8,'The loaded implementation, not only its script URL, must be version eight');
});

test('a cold gallery link adopts a retained random page even when that page omits the opened photo',async()=>{
 const id='d'.repeat(32),item={id,kind:'photo',scope:'gallery',mime:'image/jpeg',src:'/media/'+id,previewSrc:'/media/'+id+'?preview=1',tags:[]};
 const f=fixture({query:'?media='+id,route:'gallery',linkedItem:item});await flush();
 const media=f.window.FamilyMedia,stage=f.get('mediaStage'),selected=media.current(),image=stage._familyFaceContext.image;
 assert.equal(f.get('mediaViewer').getAttribute('data-media-scope'),'link:'+id);assert.equal(f.get('mediaViewerCounter').textContent,'1 / 1');assert.equal(f.strip(),null);assert.equal(f.get('mediaNext').hidden,true);
 const page=[f.photo('before'),f.photo('after')],pagination={page:1,size:100,pages:12,total:1120,sort:'random',seed:123};
 for(const scope of ['photos','personal:ora'])media.register(scope,[selected,...page],{retainCurrent:true,pagination});
 assert.equal(f.get('mediaViewer').getAttribute('data-media-scope'),'link:'+id,'Other route albums cannot take ownership of a direct gallery photo');
 media.register('gallery',page,{pagination});assert.equal(f.get('mediaViewer').getAttribute('data-media-scope'),'link:'+id,'Adopting an absent photo requires the caller to retain it explicitly');
 media.register('gallery',page,{retainCurrent:true,pagination});await flush();
 assert.equal(f.get('mediaViewer').getAttribute('data-media-scope'),'gallery');assert.equal(media.current(),selected,'The actual selected item survives adoption');assert.equal(media.photoState().total,1120);assert.equal(f.get('mediaViewerCounter').textContent,'1 / 1120');assert.equal(f.get('mediaNext').hidden,false);assert.equal(f.get('mediaPrevious').hidden,false);
 assert.ok(f.strip());assert.equal(f.strip().children[1].querySelector('img'),image,'The already displayed image is never reset to the first page item');assert.equal(f.strip().children[0].querySelector('img').getAttribute('src'),'/media/before?preview=1');
 media.register('gallery',page,{retainCurrent:true,pagination});await flush();assert.equal(media.current(),selected);assert.equal(f.get('mediaViewerCounter').textContent,'1 / 1120','Repeated missing-page refreshes retain the photo once');
 media.register('gallery',[page[0],selected,page[1]],{retainCurrent:true,pagination});await flush();assert.equal(media.current(),selected);assert.equal(f.get('mediaViewerCounter').textContent,'2 / 1120');assert.equal(media.items('gallery').filter(photo=>photo.id===id).length,1);
 for(const scope of ['photos','personal:ora'])media.register(scope,[selected],{retainCurrent:true});
 assert.equal(f.get('mediaViewer').getAttribute('data-media-scope'),'gallery');assert.equal(media.current(),selected);assert.equal(f.strip().children[1].querySelector('img'),image);
 const shared=new URL(f.get('shareMediaEmail').getAttribute('href'));assert.match(decodeURIComponent(shared.searchParams.get('body')),/#gallery/);assert.ok(shared.searchParams.get('body').includes('media='+id));
 await f.snap(0);assert.equal(media.current().id,'after','A later page containing the retained photo uses its real successor without a duplicate');assert.equal(f.requests.filter(request=>request.path.endsWith('/view')).length,1);f.close();
});

test('a gallery page registered before the direct-photo fetch finishes still supplies navigation and its total',async()=>{
 const id='f'.repeat(32),item={id,kind:'photo',scope:'gallery',mime:'image/jpeg',src:'/media/'+id,previewSrc:'/media/'+id+'?preview=1',tags:[]};let finish;
 const f=fixture({query:'?media='+id,route:'gallery',loadView:()=>new Promise(resolve=>{finish=resolve;})}),media=f.window.FamilyMedia,pagination={page:1,size:100,pages:12,total:1120,sort:'random',seed:321},page=[f.photo('before'),f.photo('after')];
 assert.equal(Boolean(f.get('mediaViewer').open),false);media.register('gallery',page,{retainCurrent:true,pagination});
 finish(Response.json({item}));await flush();
 assert.equal(f.get('mediaViewer').getAttribute('data-media-scope'),'gallery');assert.equal(media.current().id,id);assert.equal(f.get('mediaViewerCounter').textContent,'1 / 1120');assert.equal(media.photoState().total,1120);assert.equal(f.get('mediaNext').hidden,false);assert.equal(f.get('mediaPrevious').hidden,false);assert.ok(f.strip());
 assert.equal(f.strip().children[1].querySelector('img').getAttribute('src'),item.previewSrc);assert.equal(f.strip().children[0].querySelector('img').getAttribute('src'),'/media/before?preview=1');assert.equal(media.items('gallery').filter(photo=>photo.id===id).length,1);
 const selected=media.current();media.register('gallery',[page[0],selected,page[1]],{retainCurrent:true,pagination});await flush();assert.equal(f.get('mediaViewerCounter').textContent,'2 / 1120');assert.equal(media.items('gallery').filter(photo=>photo.id===id).length,1);
 await f.snap(0);assert.equal(media.current().id,'after');assert.equal(f.requests.filter(request=>request.path.endsWith('/view')).length,1);f.close();
});

test('a stale direct-photo response cannot use a registered gallery to replace a newer active URL or profile route',async()=>{
 for(const nextRoute of ['gallery','person/ora']){
  const id='a'.repeat(32),item={id,kind:'photo',scope:'gallery',mime:'image/jpeg',src:'/media/'+id,tags:[]};let finish;
  const f=fixture({query:'?media='+id,route:'gallery',loadView:()=>new Promise(resolve=>{finish=resolve;})});f.window.FamilyMedia.register('gallery',[f.photo('other')],{retainCurrent:true,pagination:{page:1,size:100,pages:12,total:1120}});
  f.location.href='https://family.test/?media=newer#'+nextRoute;f.window.FamilyMedia.open([f.photo('newer'),f.photo('next')],0,nextRoute==='gallery'?'gallery':'personal:ora');await flush();
  finish(Response.json({item}));await flush();assert.equal(f.window.FamilyMedia.current().id,'newer');assert.equal(f.get('mediaViewer').getAttribute('data-media-scope'),nextRoute==='gallery'?'gallery':'personal:ora');assert.equal(f.get('mediaViewer').open,true);f.close();
 }
});

test('retaining a shared gallery page cannot claim a direct photo belonging to a profile route',async()=>{
 const id='e'.repeat(32),item={id,kind:'photo',scope:'gallery',mime:'image/jpeg',src:'/media/'+id,tags:[]},f=fixture({query:'?media='+id,route:'person/ora',linkedItem:item});await flush();
 f.window.FamilyMedia.register('gallery',[f.photo('other')],{retainCurrent:true,pagination:{page:1,size:100,pages:12,total:1120}});
 assert.equal(f.get('mediaViewer').getAttribute('data-media-scope'),'link:'+id);assert.equal(f.get('mediaViewerCounter').textContent,'1 / 1');
 const selected=f.window.FamilyMedia.current();f.window.FamilyMedia.register('personal:ora',[f.photo('before'),selected,f.photo('after')]);await flush();
 assert.equal(f.get('mediaViewer').getAttribute('data-media-scope'),'personal:ora');assert.equal(f.get('mediaViewerCounter').textContent,'2 / 3');assert.equal(f.get('openedProfilePhoto').hidden,false);assert.ok(f.strip());f.close();
});

test('desktop photo viewers drag the actual pixels right and commit Next directly on release',async()=>{
 for(const scope of ['photos','gallery','personal:ruti','wedding:parents','nursery:ruti']){
  const f=fixture();await f.open('photo',scope);const stage=f.get('mediaStage'),viewport=f.strip();assert.ok(viewport,scope);
  assert.equal(viewport.children.length,3);assert.equal(viewport.scrollLeft,viewport.clientWidth);assert.equal(stage.classList.contains('photo-manual-swipes'),false);
  const image=viewport.children[1].querySelector('img');assert.ok(image,'The actual photo stays in the center pane');
  const finger={pointerType:'touch',pointerId:1,isPrimary:true,button:0,clientY:250};
  f.emit(image,'pointerdown',{...finger,clientX:200});f.emit(image,'pointermove',{...finger,clientX:350});
  assert.equal(viewport.clientWidth-viewport.scrollLeft,150,'The first physical-right move must move the current pixels right without synthetic browser scrolling');
  assert.equal(f.window.FamilyMedia.current().id,'a','The current item is retained while the finger is down');
  f.emit(image,'pointerup',{...finger,clientX:350});await flush();
  assert.equal(f.window.FamilyMedia.current().id,'b',scope+' commits Next without any scroll or scrollend event');
  const wheelViewport=f.strip(),wheel=browserWheel(f,wheelViewport.children[1].querySelector('img'),140);assert.equal(wheel.event.defaultPrevented,true);
  await finishWheel(f,wheelViewport);assert.equal(f.window.FamilyMedia.current().id,'c');
  await f.snap(2);assert.equal(f.window.FamilyMedia.current().id,'b',scope+' leftward drag selects Previous');f.close();
 }
});

test('desktop local video galleries drag directly while playback controls keep their native input',async()=>{
 for(const scope of ['videos','nostalgia:life','nostalgia:event','personal:ruti','wedding:parents','nursery:ruti','home:photos']){
  const f=fixture();await f.open('video',scope);const stage=f.get('mediaStage'),viewport=f.strip();assert.ok(viewport,scope+' must share the gallery controller');
  const player=viewport.children[1].querySelector('video');assert.ok(player);assert.equal(player.controls,true);player.currentTime=42;
  assert.equal(stage.querySelectorAll('video').length,1,'Neighbor panes use still posters, never extra video players');
  assert.equal(viewport.children[0].querySelector('img')?.getAttribute('src'),'/posters/b.jpg');assert.equal(viewport.children[2].querySelector('img')?.getAttribute('src'),'/posters/c.jpg');
  for(const [type,x]of [['pointerdown',200],['pointermove',350],['pointerup',350]])assert.equal(f.emit(player,type,{pointerType:'touch',pointerId:1,isPrimary:true,button:0,clientX:x,clientY:680}).defaultPrevented,false,'The native seeking strip retains its input');
  const controls=browserWheel(f,player,140,{clientY:680});assert.equal(controls.event.defaultPrevented,false);assert.equal(controls.after,controls.before,'Ignored control input cannot pan the outer gallery');
  assert.equal(player.currentTime,42);assert.equal(f.window.FamilyMedia.current().id,'a');
  nativeStroke(f,140);await flush();assert.equal(f.window.FamilyMedia.current().id,'b');assert.equal(stage.querySelectorAll('video').length,1);
  f.emit(viewport,'scrollend');await flush();assert.equal(f.window.FamilyMedia.current().id,'b','A late native completion never skips a second film');
  await f.snap(2);assert.equal(f.window.FamilyMedia.current().id,'a');f.close();
 }
});

test('native navigation moves through mixed photos and local videos in family, profile and archive albums',async()=>{
 for(const scope of ['gallery','personal:ruti','nostalgia:life','wedding:parents','home:photos']){
  const f=fixture(),items=[f.photo('a'),f.video('b'),f.photo('c')];f.window.FamilyMedia.open(items,0,scope);await flush();
  assert.equal(f.strip().children[0].querySelector('img')?.getAttribute('src'),'/posters/b.jpg');
  await f.snap(0);assert.equal(f.window.FamilyMedia.current().id,'b');assert.equal(f.get('mediaStage').querySelectorAll('video').length,1);
  assert.equal(f.strip().children[0].querySelector('img')?.getAttribute('src'),'/media/c?preview=1');
  await f.snap(0);assert.equal(f.window.FamilyMedia.current().id,'c');assert.equal(f.get('mediaStage').querySelectorAll('video').length,0);
  await f.snap(2);assert.equal(f.window.FamilyMedia.current().id,'b');await f.snap(0);assert.equal(f.window.FamilyMedia.current().id,'c');f.close();
 }
});

test('real photo handoffs never leave a still-image cover over a neighboring video',async()=>{
 for(const scope of ['personal:ruti','nostalgia:life','home:photos']){
  const f=fixture({realPresentation:true}),items=[f.photo('a'),f.video('b'),f.photo('c')];f.window.FamilyMedia.open(items,0,scope);await flush();
  await f.snap(0);assert.equal(f.window.FamilyMedia.current().id,'b');assert.ok(f.strip().children[1].querySelector('video'));
  assert.equal(f.get('mediaViewer').querySelectorAll('.photo-transition-cover').length,0,'A photo-to-video swipe must reveal the live player instead of retaining its poster cover');
  await f.snap(0);assert.equal(f.window.FamilyMedia.current().id,'c');assert.ok(f.strip().children[1].querySelector('img'));
  assert.equal(f.get('mediaViewer').querySelectorAll('.photo-transition-cover').length,0,'A completed video-to-photo handoff clears its temporary cover');
  await f.snap(2);assert.equal(f.window.FamilyMedia.current().id,'b');assert.equal(f.get('mediaViewer').querySelectorAll('.photo-transition-cover').length,0);f.close();
 }
});

test('the native strip mounts after asynchronous face wrapping and is rebuilt around the next photo',async()=>{
 const f=fixture({delayedFaces:true});await f.open();assert.equal(f.strip(),null,'A face context still preparing its wrapper is not reparented early');
 f.faceReady.shift()();await flush();const first=f.strip();assert.ok(first);assert.ok(first.children[1].querySelector('.face-photo-scroll img'));
 await f.snap(0);assert.equal(f.window.FamilyMedia.current().id,'b');assert.equal(f.strip(),null);
 f.faceReady.shift()();await flush();assert.ok(f.strip());assert.notEqual(f.strip(),first);assert.equal(f.strip().children[1].querySelector('img').getAttribute('src'),'/media/b?preview=1');f.close();
});

test('native neighboring panes retain original photos when derived previews are unavailable',async()=>{
 for(const size of [undefined,8_000_000]){
  const f=fixture(),items=['a','b','c'].map(id=>{const item=f.photo(id);delete item.previewSrc;if(size!==undefined)item.size=size;return item;});
  f.window.FamilyMedia.open(items,0,'photos');await flush();const viewport=f.strip();assert.ok(viewport);
  assert.equal(viewport.children[0].querySelector('img')?.getAttribute('src'),'/media/b','The Next preview must not be blank for a large or unmeasured original');
  assert.equal(viewport.children[2].querySelector('img')?.getAttribute('src'),'/media/c','The Previous preview must not be blank for a large or unmeasured original');
  await f.snap(0);assert.equal(f.window.FamilyMedia.current().id,'b');assert.equal(f.strip().children[1].querySelector('img').getAttribute('src'),'/media/b');f.close();
 }
});

test('a retained current photo refreshes native neighbors when the filtered album order changes',async()=>{
 const f=fixture();await f.open();const viewport=f.strip(),image=viewport.children[1].querySelector('img');
 assert.equal(viewport.children[0].querySelector('img').getAttribute('src'),'/media/b?preview=1');
 f.window.FamilyMedia.register('photos',[f.photo('c'),f.photo('b')],{retainCurrent:true});await flush();
 assert.equal(f.window.FamilyMedia.current().id,'a');assert.equal(f.strip(),viewport,'Updating album membership preserves the currently viewed pixels and native strip');
 assert.equal(f.strip().children[1].querySelector('img'),image);
 assert.equal(f.strip().children[0].querySelector('img').getAttribute('src'),'/media/c?preview=1','The newly visible Next neighbor must match the changed album order');
 assert.equal(f.strip().children[2].querySelector('img').getAttribute('src'),'/media/b?preview=1');
 await f.snap(0);assert.equal(f.window.FamilyMedia.current().id,'c','The photo selected after snapping matches the refreshed preview');f.close();
});

test('native photo scrolling survives fullscreen reparenting, resize and return to face tagging',async()=>{
 const f=fixture();await f.open();const stage=f.get('mediaStage'),image=stage._familyFaceContext.image,originalParent=stage.parentNode,anchor=f.document.createComment('test-fullscreen-position');
 stage.before(anchor);const root=f.document.createElement('div');root.id='photoFullscreenRoot';f.get('mediaViewer').append(root);
 assert.equal(f.window.FamilyMedia.setFullscreen(true),true);root.prepend(stage);await flush();
 assert.equal(f.get('mediaStage'),stage);assert.equal(stage.parentNode,root);assert.equal(f.window.FamilyMedia.photoState().active,true);
 assert.equal(f.strip().children[1].querySelector('img'),image,'Fullscreen preserves the decoded photo while changing its container');
 const fullscreenStrip=f.strip();for(let i=0;i<3;i++)f.window.FamilyMedia.refreshPhotoPresentation();
 assert.equal(f.strip(),fullscreenStrip);assert.equal(f.strip().children[1].querySelector('img'),image,'Repeated refreshes cannot mistake a neighbour preview for the fullscreen photo');
 const mountsBefore=f.faceMounts.length;f.resize(900);assert.equal(f.strip().scrollLeft,900);
 await f.snap(0);assert.equal(f.window.FamilyMedia.current().id,'b');assert.equal(f.faceMounts.length,mountsBefore,'Browsing fullscreen does not mount editable face controls');
 anchor.replaceWith(stage);root.remove();assert.equal(f.window.FamilyMedia.setFullscreen(false),true);await flush();
 assert.equal(stage.parentNode,originalParent);assert.equal(f.window.FamilyMedia.photoState().active,false);
 assert.equal(f.window.FamilyMedia.current().id,'b');assert.equal(f.faceMounts.length,mountsBefore+1);assert.equal(stage._familyFaceContext.item.id,'b');
 assert.ok(f.strip().children[1].querySelector('.face-photo-scroll img'),'The selected photo returns with tagging and native navigation together');
 await f.snap(2);assert.equal(f.window.FamilyMedia.current().id,'a');f.close();
});

test('native swiping remains available after repeated Next and Previous clicks with the real presentation lifecycle',async()=>{
 for(const fullscreen of [false,true])for(const scope of ['photos','gallery','personal:ruti','wedding:parents','home:photos']){
  const f=fixture({realPresentation:true});await f.open('photo',scope);f.get('mediaViewer').classList.add('personal-photo-desktop');
  if(fullscreen){assert.equal(f.window.FamilyMedia.setFullscreen(true),true);await flush();}
  const assertNative=expected=>{
   const stage=f.get('mediaStage'),viewport=f.strip();assert.equal(f.window.FamilyMedia.current().id,expected,scope);
   assert.ok(viewport,'A working native strip must remain after every arrow or native completion');assert.equal(f.window.FamilyPhotoNative.has(stage),true);
   assert.equal(stage.classList.contains('photo-slide-running'),false,'No completed desktop button leaves a transition blocking native input');
   assert.equal(viewport.children[1].querySelector('img').getAttribute('src'),'/media/'+expected+'?preview=1');
  };
  for(let repeat=0;repeat<3;repeat++){
   assertNative('a');await f.snap(0);assertNative('b');
   f.emit(f.get('mediaNext'),'click');await flush();assertNative('c');
   await f.snap(0);assertNative('a');f.emit(f.get('mediaPrevious'),'click');await flush();assertNative('c');
   await f.snap(2);assertNative('b');f.emit(f.get('mediaPrevious'),'click');await flush();assertNative('a');
  }
  const previous=f.strip();previous.scrollLeft=previous.clientWidth*.7;
  f.emit(f.get('mediaNext'),'click');await flush();assertNative('b');f.emit(previous,'scrollend');await flush();assertNative('b');
  f.finishAnimations();await flush();assertNative('b');await f.snap(0);assertNative('c');f.close();
 }
});

test('a native raw image moved into its completed face wrapper is not extracted by the previous strip reset',async()=>{
 const f=fixture();await f.open();const stage=f.get('mediaStage'),image=stage._familyFaceContext.image;
 f.window.FamilyPhotoNative.reset(stage);stage.replaceChildren(image);delete stage._familyFaceContext;f.window.FamilyMedia.refreshPhotoPresentation();
 const previous=f.strip();assert.ok(previous.children[1].firstElementChild===image);
 const scroller=f.document.createElement('div'),surface=f.document.createElement('div');scroller.className='face-photo-scroll';surface.className='face-photo-surface';surface.append(image);scroller.append(surface);stage.append(scroller);
 stage._familyFaceContext={image,item:f.window.FamilyMedia.current(),zoom:1};f.window.FamilyMedia.refreshPhotoPresentation();
 assert.ok(f.strip()!==previous);assert.ok(f.strip().children[1].querySelector('.face-photo-surface img')===image,'Resetting the old strip must respect the newer face wrapper ownership');
 assert.equal(stage.querySelector(':scope > img'),null,'The viewed photo must not be stranded outside its new scrolling surface');
 await f.snap(0);assert.equal(f.window.FamilyMedia.current().id,'b');f.close();
});

test('a narrow Windows arrow transition finishing before delayed face setup preserves subsequent native swipes',async()=>{
 const f=fixture({width:600,realPresentation:true});await f.open();f.get('mediaViewer').classList.add('personal-photo-desktop');
 for(const [button,expected,swipeExpected]of [['mediaNext','b','c'],['mediaPrevious','b','c']]){
  f.emit(f.get(button),'click');await flush();f.finishAnimations();await flush();
  await new Promise(resolve=>setTimeout(resolve,210));await flush();
  assert.equal(f.window.FamilyMedia.current().id,expected);assert.ok(f.strip());
  assert.equal(f.strip().children[1].querySelector('.face-photo-surface img')?.getAttribute('src'),'/media/'+expected+'?preview=1','The delayed face wrapper must retain the actual image after the arrow transition');
  await f.snap(0);assert.equal(f.window.FamilyMedia.current().id,swipeExpected);
 }
 f.close();
});

test('cancelling presentation effects does not dismantle a live browser-owned gallery strip',async()=>{
 const f=fixture({realPresentation:true});await f.open();const viewport=f.strip();f.window.FamilyPhotoPresentation.cancel();
 assert.ok(f.strip()===viewport,'An effects-only cancellation preserves the active native strip');assert.equal(f.window.FamilyPhotoNative.has(f.get('mediaStage')),true);
 await f.snap(0);assert.equal(f.window.FamilyMedia.current().id,'b');f.close();
});

test('native photo scrolling saves descriptions before moving and retains failed drafts at center',async()=>{
 for(const fail of [false,true]){
  const f=fixture();await f.open('photo');f.failSaving(fail);
  const input=f.get('openedCaptionText');input.value='A description worth keeping';f.emit(input,'input');
  await f.snap(0);assert.equal(f.requests.length,1);assert.equal(f.requests[0].path,'api/media/a/caption');
  assert.equal(f.window.FamilyMedia.current().id,fail?'a':'b');assert.ok(f.strip());assert.equal(f.strip().scrollLeft,f.strip().clientWidth);
  if(fail){assert.equal(input.value,'A description worth keeping');assert.equal(f.get('openedCaptionError').textContent,'Caption was not saved');f.failSaving(false);await f.snap(0);assert.equal(f.window.FamilyMedia.current().id,'b','A failed save does not permanently lock the native strip');}
  else assert.equal(f.window.FamilyMedia.lookup('photos','a').caption,'A description worth keeping');
  f.close();
 }
});

test('physical rightward touch and trackpad gestures select the same item as the Next arrow',async()=>{
 for(const kind of ['photo','video'])for(const wheel of [false,true]){
  const f=fixture();await f.open(kind,kind==='photo'?'photos':'videos',1);
  f.emit(f.get('mediaNext'),'click');await flush();const next=f.window.FamilyMedia.current().id;assert.equal(next,'c');
  await f.open(kind,kind==='photo'?'photos':'videos',1);const forward=nativeStroke(f,140,{wheel});if(wheel)await finishWheel(f,forward);else await flush();
  assert.equal(f.window.FamilyMedia.current().id,next,(wheel?'Trackpad':'Touch')+' rightward movement must follow Next');
  const backward=nativeStroke(f,-140,{wheel});if(wheel)await finishWheel(f,backward);else await flush();assert.equal(f.window.FamilyMedia.current().id,'b','Leftward movement follows Previous');f.close();
 }
});

test('rightward trackpad input moves the actual current pixels right before choosing the Next image',async()=>{
 for(const kind of ['photo','video']){
  const f=fixture();await f.open(kind,kind==='photo'?'photos':'videos',1);const viewport=f.strip(),target=viewport.children[1].querySelector(kind==='photo'?'img':'video');
  const next=kind==='photo'?'/media/c?preview=1':'/posters/c.jpg',previous=kind==='photo'?'/media/a?preview=1':'/posters/a.jpg';
  assert.equal(viewport.children[0].querySelector('img')?.getAttribute('src'),next);
  const sample=browserWheel(f,target,140);
  assert.equal(sample.event.defaultPrevented,true,'The default browser wheel movement would send the pixels left');
  assert.ok(sample.after<sample.before,'Positive rightward input must decrease the actual scrollLeft');
  assert.equal(viewport.clientWidth-sample.after,140,'The center pane moves 140 pixels right, before any completed navigation');
  assert.equal(f.window.FamilyMedia.current().id,'b','Spatial movement is verified before committing a new item');
  assert.equal(viewport.children[0].querySelector('img')?.getAttribute('src'),next,'Trackpad input does not swap neighbor panes to hide reversed pixel movement');
  assert.equal(viewport.children[2].querySelector('img')?.getAttribute('src'),previous);
  await new Promise(resolve=>setTimeout(resolve,320));await flush();assert.equal(f.window.FamilyMedia.current().id,'c');f.close();
 }
});

test('the delivered CSS prevents unowned horizontal browser movement on the controlled gallery rail',()=>{
 assert.equal(nativeStyle('overflow-x'),'hidden','The stylesheet actually linked from production must disable default horizontal browser scrolling');
 assert.equal(nativeStyle('scroll-snap-type'),'none','Browser snap restoration must not compete with controlled pointer pixels');
 assert.equal(nativeStyle('touch-action'),'pinch-zoom','The browser cannot cancel a controlled laptop drag for its early vertical pixels');
});

test('stage backgrounds and face overlays outside the strip share the actual horizontal input owner',async()=>{
 for(const kind of ['photo','video'])for(const wheel of [false,true])for(const overlay of [false,true]){
  const f=fixture();await f.open(kind);const stage=f.get('mediaStage'),viewport=f.strip();let target=stage;
  if(overlay){const layer=f.document.createElement('div');layer.className='face-layer';const area=f.document.createElement('div');area.className='face-image-area';target=f.document.createElement('button');target.className='face-hit';area.append(target);layer.append(area);stage.append(layer);assert.equal(target.closest('.native-photo-strip'),null,'The input target is a stage sibling, just as a face overlay before wrapping can be');}
  if(wheel){const sample=browserWheel(f,target,140);assert.equal(sample.event.defaultPrevented,true);assert.equal(viewport.clientWidth-sample.after,140);await finishWheel(f,viewport);}
  else {
   const finger={pointerType:'touch',pointerId:4,isPrimary:true,button:0,clientY:250};f.emit(target,'pointerdown',{...finger,clientX:200});f.emit(target,'pointermove',{...finger,clientX:340});assert.equal(viewport.clientWidth-viewport.scrollLeft,140,'The actual viewed pixels follow a drag even when it starts outside the inner strip');f.emit(target,'pointerup',{...finger,clientX:340});await flush();
  }
  assert.equal(f.window.FamilyMedia.current().id,'b',(wheel?'Wheel':'Touch')+' at the '+(overlay?'face overlay':'stage background')+' advances exactly once');f.close();
 }
});

test('a small diagonal start can become a rightward laptop drag on pointer and touch streams',async()=>{
 for(const pointer of [false,true]){
  const f=fixture();await f.open();const stage=f.get('mediaStage'),viewport=f.strip(),target=viewport.children[1].querySelector('img'),finger={pointerType:'touch',pointerId:4,isPrimary:true,button:0};
  const touch=(type,x,y)=>{const point={identifier:9,clientX:x,clientY:y,target};return f.emit(target,type,{touches:type==='touchend'?[]:[point],changedTouches:[point]});};
  if(pointer)f.emit(target,'pointerdown',{...finger,clientX:200,clientY:250});touch('touchstart',200,250);
  if(pointer)f.emit(target,'pointermove',{...finger,clientX:202,clientY:258});else touch('touchmove',202,258);
  assert.equal(viewport.scrollLeft,viewport.clientWidth);assert.equal(f.window.FamilyMedia.current().id,'a');
  const move=pointer?f.emit(target,'pointermove',{...finger,clientX:340,clientY:250}):touch('touchmove',340,250);
  assert.equal(move.defaultPrevented,true);assert.equal(viewport.clientWidth-viewport.scrollLeft,140,'The early two-by-eight-pixel packet cannot permanently turn a rightward gesture into vertical input');
  if(pointer)f.emit(target,'pointerup',{...finger,clientX:340,clientY:250});touch('touchend',340,250);await flush();
  assert.equal(f.window.FamilyMedia.current().id,'b');assert.equal(f.window.FamilyPhotoNative.isActive(stage),false);f.close();
 }
});

test('controlled vertical finger movement scrolls the viewer without navigating photos or videos',async()=>{
 for(const kind of ['photo','video']){
  const f=fixture();await f.open(kind);const viewer=f.get('mediaViewer'),stage=f.get('mediaStage'),viewport=f.strip(),target=viewport.children[1].querySelector(kind==='photo'?'img':'video');viewer.scrollTop=200;
  const finger={pointerType:'touch',pointerId:3,isPrimary:true,button:0,clientX:200};f.emit(target,'pointerdown',{...finger,clientY:250});
  for(const clientY of [290,350])assert.equal(f.emit(target,'pointermove',{...finger,clientY}).defaultPrevented,true,'The controller owns vertical finger movement while retaining pinch zoom');
  f.emit(target,'pointerup',{...finger,clientY:350});await flush();
  assert.equal(viewer.scrollTop,100,'A hundred-pixel downward finger move scrolls the dialog upward by the same amount');assert.equal(f.window.FamilyMedia.current().id,'a');assert.equal(viewport.scrollLeft,viewport.clientWidth);assert.equal(f.window.FamilyPhotoNative.isActive(stage),false);
  const wheel=browserWheel(f,stage,0,{deltaY:140});assert.equal(wheel.event.defaultPrevented,false,'A vertical trackpad wheel remains native');assert.equal(wheel.after,wheel.before);f.close();
 }
});

test('repeated native remounts keep one stage input handler and one navigation action',async()=>{
 const f=fixture();await f.open();const stage=f.get('mediaStage');
 for(let cycle=0;cycle<5;cycle++){
  f.window.FamilyPhotoNative.reset(stage);for(let refresh=0;refresh<3;refresh++)f.window.FamilyMedia.refreshPhotoPresentation();
  const viewport=f.strip(),sample=browserWheel(f,stage,140);assert.equal(viewport.clientWidth-sample.after,140,'Repeated mounts cannot multiply the wheel delta');
  await finishWheel(f,viewport);assert.equal(f.window.FamilyMedia.current().id,['b','c','a','b','c'][cycle],'Only the current stage controller submits navigation');
 }
 f.close();
});

test('declined or noncancelable wheel events cannot send pixels left through browser default scrolling',async()=>{
 for(const mode of ['diagonal','disabled','pinch','noncancelable-diagonal','noncancelable-horizontal']){
  const f=fixture();await f.open();const viewport=f.strip(),target=viewport.children[1].querySelector('img'),stage=f.get('mediaStage');
  if(mode==='disabled')stage._familyFaceContext.adjust=true;
  const extra={deltaY:mode.includes('diagonal')?180:0,...(mode==='pinch'?{ctrlKey:true}:{}),...(mode.startsWith('noncancelable')?{cancelable:false}:{})};
  const sample=browserWheel(f,target,140,extra);
  if(mode==='noncancelable-horizontal'){
   assert.equal(sample.event.defaultPrevented,false);assert.equal(viewport.clientWidth-sample.after,140,'Script moves noncancelable horizontal input once and hidden overflow prevents an opposite default pan');
  }else assert.equal(sample.after,sample.before,mode+' must never leak a default browser pan into the neighbor pane');
  await new Promise(resolve=>setTimeout(resolve,120));await flush();
  assert.equal(f.window.FamilyMedia.current().id,mode==='noncancelable-horizontal'?'b':'a');
  assert.equal(f.window.FamilyPhotoNative.isActive(stage),false);if(mode==='disabled')stage._familyFaceContext.adjust=false;
  nativeStroke(f,140);await flush();assert.equal(f.window.FamilyMedia.current().id,mode==='noncancelable-horizontal'?'c':'b','Declined input does not leave later drags blocked');f.close();
 }
});

test('diagonal samples continue the already owned trackpad episode without leaking a reverse default pan',async()=>{
 const f=fixture();await f.open();const viewport=f.strip(),target=viewport.children[1].querySelector('img');
 const start=browserWheel(f,target,80,{deltaY:2});assert.equal(start.event.defaultPrevented,true);assert.equal(viewport.clientWidth-start.after,80);
 const tail=browserWheel(f,target,20,{deltaY:90});assert.equal(tail.event.defaultPrevented,true,'A diagonal tail remains in the established horizontal episode');
 assert.equal(viewport.clientWidth-tail.after,100,'Every accepted sample moves the actual pixels in the same physical direction');
 await finishWheel(f,viewport);assert.equal(f.window.FamilyMedia.current().id,'b');f.close();
});

test('a fresh uncalibrated laptop preserves positive owned wheel mapping to rightward pixels and Next',async()=>{
 const f=fixture({storage:new Map()});await f.open('photo','photos',1);assert.equal(f.window.FamilyGalleryInput.wheelFactor(),1);assert.equal(f.window.FamilyGalleryInput.isCalibrating(),false);
 const viewport=f.strip(),sample=browserWheel(f,viewport.children[1].querySelector('img'),140);
 assert.equal(sample.event.defaultPrevented,true);assert.equal(viewport.clientWidth-sample.after,140);
 await finishWheel(f,viewport);assert.equal(f.window.FamilyMedia.current().id,'c');f.close();
});

test('two immediate Next presses leave the following rightward drag working',async()=>{
 const f=fixture({realPresentation:true});f.window.FamilyMedia.open(['a','b','c','d','e'].map(f.photo),0,'photos');await flush();
 f.emit(f.get('mediaNext'),'click');f.emit(f.get('mediaNext'),'click');await flush();assert.equal(f.window.FamilyMedia.current().id,'c');
 const viewport=f.strip(),target=viewport.children[1].querySelector('img'),finger={pointerType:'touch',pointerId:5,isPrimary:true,button:0,clientY:250};
 f.emit(target,'pointerdown',{...finger,clientX:200});f.emit(target,'pointermove',{...finger,clientX:340});assert.equal(viewport.clientWidth-viewport.scrollLeft,140);
 f.emit(target,'pointerup',{...finger,clientX:340});await flush();assert.equal(f.window.FamilyMedia.current().id,'d');f.close();
});

test('released touch and wheel movement complete without a native scrollend and cannot leave queued arrows waiting',async()=>{
 for(const kind of ['photo','video'])for(const wheel of [false,true]){
  const f=fixture();await f.open(kind);const viewport=f.strip(),target=viewport.children[1].querySelector(kind==='photo'?'img':'video');
  if(wheel)browserWheel(f,target,140);
  else {
   const finger={pointerType:'touch',pointerId:1,isPrimary:true,button:0,clientY:250};
   f.emit(target,'pointerdown',{...finger,clientX:200});f.emit(target,'pointermove',{...finger,clientX:340});assert.equal(viewport.clientWidth-viewport.scrollLeft,140);f.emit(target,'pointerup',{...finger,clientX:340});
  }
  // No animation, scrollend or manually forced snap follows the release.
  await new Promise(resolve=>setTimeout(resolve,320));await flush();
  assert.equal(f.window.FamilyMedia.current().id,'b',(wheel?'Wheel':'Touch')+' quiet completion must retain the requested next action');
  assert.equal(f.window.FamilyPhotoNative.isActive(f.get('mediaStage')),false);assert.equal(f.window.FamilyPhotoNative.whenIdle(f.get('mediaStage')),null);
  assert.equal(f.window.FamilyMedia.photoState().busy,false);assert.equal(f.get('mediaViewer').querySelectorAll('.native-pending-cover').length,0);
  f.emit(f.get('mediaNext'),'click');await flush();assert.equal(f.window.FamilyMedia.current().id,'c','The following arrow cannot wait on a completed gesture forever');f.close();
 }
});

test('pointer cancellation follows claimed horizontal movement while vertical movement and pinch stay cancelled',async()=>{
 for(const reason of ['early-cancel','horizontal-cancel','vertical','pinch']){
  const f=fixture();await f.open();const viewport=f.strip(),target=viewport.children[1].querySelector('img');
  const finger={pointerType:'touch',pointerId:7,isPrimary:true,button:0,clientY:250};
  f.emit(target,'pointerdown',{...finger,clientX:200});
  if(reason==='vertical')f.emit(target,'pointermove',{...finger,clientX:208,clientY:390});
  else f.emit(target,'pointermove',{...finger,clientX:reason==='early-cancel'?208:340});
  if(reason==='early-cancel'||reason==='horizontal-cancel')f.emit(target,'pointercancel',{...finger,clientX:reason==='early-cancel'?208:340});
  else if(reason==='pinch'){
   f.emit(target,'pointerdown',{...finger,pointerId:8,isPrimary:false,clientX:400});
   const one={identifier:7,clientX:340,clientY:250,target},two={identifier:8,clientX:400,clientY:250,target};f.emit(target,'touchstart',{touches:[one,two],changedTouches:[two]});
   f.emit(target,'pointerup',{...finger,clientX:340});f.emit(target,'pointerup',{...finger,pointerId:8,isPrimary:false,clientX:400});
  }else f.emit(target,'pointerup',{...finger,clientX:208,clientY:390});
  await new Promise(resolve=>setTimeout(resolve,350));await flush();
  assert.equal(f.window.FamilyMedia.current().id,reason==='horizontal-cancel'?'b':'a',reason+' uses only the last script-controlled horizontal movement');assert.equal(f.strip().scrollLeft,f.strip().clientWidth);
  assert.equal(f.window.FamilyPhotoNative.isActive(f.get('mediaStage')),false);assert.equal(f.window.FamilyPhotoNative.whenIdle(f.get('mediaStage')),null);
  await f.snap(0);assert.equal(f.window.FamilyMedia.current().id,reason==='horizontal-cancel'?'c':'b','A cancelled '+reason+' never disables the next real drag');f.close();
 }
});

test('compatibility touch events preserve the pointer origin and never duplicate a completed drag',async()=>{
 const f=fixture();await f.open();const viewport=f.strip(),target=viewport.children[1].querySelector('img'),finger={pointerType:'touch',pointerId:7,isPrimary:true,button:0,clientY:250},point={identifier:9,clientX:210,clientY:250,target};
 f.emit(target,'pointerdown',{...finger,clientX:200});f.emit(target,'touchstart',{touches:[point],changedTouches:[point]});
 f.emit(target,'pointermove',{...finger,clientX:340});assert.equal(viewport.clientWidth-viewport.scrollLeft,140,'Companion touchstart must not shift an existing pointer origin by ten pixels');
 f.emit(target,'pointerup',{...finger,clientX:340});f.emit(target,'touchend',{touches:[],changedTouches:[{...point,clientX:340}]});await flush();
 assert.equal(f.window.FamilyMedia.current().id,'b','Pointer release and its compatibility touchend are one action');assert.equal(f.window.FamilyPhotoNative.isActive(f.get('mediaStage')),false);f.close();
});

test('an intentional drag back to its starting position cancels without a browser snap or scrollend',async()=>{
 const f=fixture();await f.open();const viewport=f.strip(),target=viewport.children[1].querySelector('img');
 const finger={pointerType:'touch',pointerId:7,isPrimary:true,button:0,clientY:250};
 f.emit(target,'pointerdown',{...finger,clientX:200});f.emit(target,'pointermove',{...finger,clientX:380});assert.equal(viewport.clientWidth-viewport.scrollLeft,180);
 f.emit(target,'pointermove',{...finger,clientX:200});f.emit(target,'pointerup',{...finger,clientX:200});await flush();
 assert.equal(f.window.FamilyMedia.current().id,'a');assert.equal(viewport.scrollLeft,viewport.clientWidth);assert.equal(f.window.FamilyPhotoNative.isActive(f.get('mediaStage')),false);
 await f.snap(0);assert.equal(f.window.FamilyMedia.current().id,'b');f.close();
});

test('explicit device calibration maps a negative physical-right wheel packet to rightward pixels and persists without setup UI',async()=>{
 const storage=new Map(),f=fixture({query:'?gesture-check=8',storage}),settings=f.window.FamilyGalleryInput;
 assert.equal(settings.isCalibrating(),true);assert.equal(settings.wheelFactor(),1);assert.ok(f.get('galleryGestureCheck'));
 settings.wheelDelta(-140);assert.equal(settings.isCalibrating(),true,'Calibration waits for an open media viewer');assert.equal(storage.has('keha-gallery-pad-direction-v2'),false);
 await f.open('photo','photos',1);const viewport=f.strip(),sample=browserWheel(f,viewport.children[1].querySelector('img'),-140);
 assert.equal(sample.event.defaultPrevented,true);assert.equal(viewport.clientWidth-sample.after,140,'A calibrated negative device packet moves the current pixels right');
 assert.equal(settings.wheelFactor(),-1);assert.equal(settings.isCalibrating(),false);assert.equal(storage.get('keha-gallery-pad-direction-v2'),'-1');
 await new Promise(resolve=>setTimeout(resolve,320));await flush();assert.equal(f.window.FamilyMedia.current().id,'c');
 const trace=f.get('galleryGestureCheck').querySelector('output').textContent;assert.match(trace,/build 8/);assert.match(trace,/native implementation 8/);assert.match(trace,/controller \{/);assert.match(trace,/wheel -140 → 140/);assert.match(trace,/factor -1/);assert.match(trace,/photo-native\.js/);f.close();
 const restored=fixture({storage});assert.equal(restored.window.FamilyGalleryInput.wheelFactor(),-1);assert.equal(restored.window.FamilyGalleryInput.isCalibrating(),false);assert.equal(restored.get('galleryGestureCheck'),null,'Ordinary browsing shows no diagnostic or calibration interface');
 await restored.open('photo','photos',1);const next=restored.strip(),again=browserWheel(restored,next.children[1].querySelector('img'),-140);assert.equal(next.clientWidth-again.after,140);
 await new Promise(resolve=>setTimeout(resolve,320));await flush();assert.equal(restored.window.FamilyMedia.current().id,'c');restored.close();
 const setupReload=fixture({query:'?gesture-check=8',storage}),reloadedSettings=setupReload.window.FamilyGalleryInput;
 assert.equal(reloadedSettings.wheelFactor(),-1);assert.equal(reloadedSettings.isCalibrating(),false,'Reloading the setup URL must preserve an already calibrated device');
 await setupReload.open('photo','photos',1);const reloadedRail=setupReload.strip(),left=browserWheel(setupReload,reloadedRail.children[1].querySelector('img'),140);
 assert.equal(reloadedRail.clientWidth-left.after,-140,'A physical-left packet remains left after reloading the setup page');assert.equal(storage.get('keha-gallery-pad-direction-v2'),'-1');
 await new Promise(resolve=>setTimeout(resolve,320));await flush();assert.equal(setupReload.window.FamilyMedia.current().id,'a','A left gesture on reload must select Previous, not recalibrate the device');
 assert.equal(reloadedSettings.wheelFactor(),-1);assert.equal(reloadedSettings.isCalibrating(),false);
 const recalibrate=setupReload.get('galleryGestureCheck').querySelector('[data-gesture-recalibrate]');assert.equal(recalibrate.hidden,false);setupReload.emit(recalibrate,'click');await flush();assert.equal(reloadedSettings.isCalibrating(),true);
 assert.equal(storage.get('keha-gallery-pad-direction-v2'),'-1','Pressing recalibrate waits for a new physical-right sample');
 await setupReload.open('photo','photos',1);const recalibratedRail=setupReload.strip(),right=browserWheel(setupReload,recalibratedRail.children[1].querySelector('img'),140);
 assert.equal(recalibratedRail.clientWidth-right.after,140);assert.equal(reloadedSettings.wheelFactor(),1);assert.equal(reloadedSettings.isCalibrating(),false);assert.equal(storage.get('keha-gallery-pad-direction-v2'),'1');
 await new Promise(resolve=>setTimeout(resolve,320));await flush();assert.equal(setupReload.window.FamilyMedia.current().id,'c');setupReload.close();
});

test('an orphan compatibility touchstart without a pointer stream or end cannot block later wheel input',async()=>{
 const f=fixture();await f.open();const viewport=f.strip(),target=viewport.children[1].querySelector('img'),point={identifier:9,clientX:200,clientY:250,target};
 f.emit(target,'touchstart',{touches:[point],changedTouches:[point]});assert.equal(f.window.FamilyPhotoNative.isActive(f.get('mediaStage')),true);
 await new Promise(resolve=>setTimeout(resolve,650));await flush();
 assert.equal(f.window.FamilyMedia.current().id,'a','A compatibility start without movement never invents a navigation action');
 assert.equal(f.window.FamilyPhotoNative.isActive(f.get('mediaStage')),false);assert.equal(f.window.FamilyPhotoNative.whenIdle(f.get('mediaStage')),null);
 browserWheel(f,f.strip().children[1].querySelector('img'),140);await new Promise(resolve=>setTimeout(resolve,320));await flush();
 assert.equal(f.window.FamilyMedia.current().id,'b','The next real wheel episode must not wait for an impossible touchend');f.close();
});

test('fractional wheel input moves the pixels and completes without requiring a forced edge or native end event',async()=>{
 const f=fixture();await f.open();const viewport=f.strip(),target=viewport.children[1].querySelector('img'),sample=browserWheel(f,target,.75);assert.equal(sample.event.defaultPrevented,true);assert.equal(viewport.clientWidth-sample.after,.75,'Fractional input moves the pixels in the requested physical direction');
 await new Promise(resolve=>setTimeout(resolve,120));await flush();
 assert.equal(f.window.FamilyMedia.current().id,'b','Owned fractional horizontal input still completes one requested action');
 assert.equal(f.window.FamilyPhotoNative.isActive(f.get('mediaStage')),false);assert.equal(f.window.FamilyPhotoNative.whenIdle(f.get('mediaStage')),null);
 f.emit(f.get('mediaNext'),'click');await flush();assert.equal(f.window.FamilyMedia.current().id,'c');f.close();
});

test('two rapid native strokes and mixed arrow actions retain every requested step while a photo loads',async t=>{
 for(const wheel of [false,true])for(const actions of [['swipe','swipe'],['swipe','next','previous','swipe'],['swipe','back']])await t.test((wheel?'trackpad: ':'touch: ')+actions.join(' → '),async()=>{
  const f=fixture(),loads=[];f.window.FamilyMedia.open(['a','b','c','d','e'].map(f.photo),0,'photos');await flush();
  f.window.FamilyPhotoPresentation.ready=()=>null;f.window.FamilyPhotoPresentation.prepare=item=>new Promise(resolve=>loads.push({item,resolve}));
  for(const action of actions){
   if(action==='swipe'||action==='back'){const viewport=nativeStroke(f,action==='back'?-140:140,{wheel});if(wheel)await finishWheel(f,viewport);}
   else {const button=f.get(action==='next'?'mediaNext':'mediaPrevious');assert.equal(button.disabled,false);f.emit(button,'click');}
  }
  assert.equal(f.window.FamilyMedia.current().id,'a','The first unresolved image remains visible');
  for(let round=0;round<5;round++){
   for(const {item,resolve}of loads.splice(0)){const image=f.document.createElement('img');image.src=item.previewSrc;resolve(image);}
   await flush();
  }
  const expected=actions.includes('back')?'a':'c',following=expected==='a'?'b':'d';
  assert.equal(f.window.FamilyMedia.current().id,expected,actions.join(' → ')+' must retain every step and reversal without dropping a rapid gesture');
  assert.ok(f.strip());const followingViewport=nativeStroke(f,140,{wheel});if(wheel)await finishWheel(f,followingViewport);for(const {item,resolve}of loads.splice(0)){const image=f.document.createElement('img');image.src=item.previewSrc;resolve(image);}await flush();assert.equal(f.window.FamilyMedia.current().id,following,'The queue remains usable after draining');f.close();
 });
});

test('separate same-direction trackpad bursts count twice even when the browser coalesces their scrollend',async t=>{
 for(const [label,direction,second,expected]of [['new right gesture',1,[90,45],'e'],['new left gesture',-1,[-90,-45],'a'],['separate fractional right episode',1,[1,.5],'e'],['separate fractional left episode',-1,[-1,-.5],'a']])await t.test(label,async()=>{
  const f=fixture({realPresentation:true});f.window.FamilyMedia.open(['a','b','c','d','e'].map(f.photo),2,'photos');await flush();
  const viewport=f.strip();
  const burst=deltas=>{const target=f.strip().children[1].querySelector('img');for(const deltaX of deltas)browserWheel(f,target,deltaX);};
  burst([direction*90,direction*45]);await new Promise(resolve=>setTimeout(resolve,110));await flush();
  burst(second);await flush();
  await finishWheel(f,f.strip());assert.equal(f.window.FamilyMedia.current().id,expected,'A quiet boundary makes the next owned horizontal episode a second action, including fractional input');
  f.emit(viewport,'scrollend');await flush();assert.equal(f.window.FamilyMedia.current().id,expected,'A late duplicate scrollend cannot count another action');f.close();
 });
});

test('a continuous trackpad episode including its fractional tail commits exactly one action',async()=>{
 for(const direction of [1,-1]){
  const f=fixture({realPresentation:true});f.window.FamilyMedia.open(['a','b','c','d','e'].map(f.photo),2,'photos');await flush();
  const viewport=f.strip(),target=viewport.children[1].querySelector('img');
  for(const delta of [90,45,1,.5,.25]){browserWheel(f,target,delta*direction);await new Promise(resolve=>setTimeout(resolve,12));}
  await finishWheel(f,viewport);assert.equal(f.window.FamilyMedia.current().id,direction>0?'d':'b','Samples within the same quiet-boundary window remain one continuous action');
  f.emit(viewport,'scrollend');await flush();assert.equal(f.window.FamilyMedia.current().id,direction>0?'d':'b');f.close();
 }
});

test('opening with zero-width dialog geometry anchors the center photo before revealing the native strip',async()=>{
 for(const kind of ['photo','video']){
  const f=fixture({hiddenDialogGeometry:true});await f.open(kind);const viewport=f.strip();assert.ok(viewport);assert.equal(viewport.clientWidth,0);
  const media=viewport.children[1].querySelector(kind==='photo'?'img':'video');assert.ok(media);
  assert.equal(viewport.style.visibility,'hidden','The unmeasured strip must not flash a neighboring pane');
  f.emit(viewport,'scroll');f.emit(viewport,'scrollend');await flush();assert.equal(f.window.FamilyMedia.current().id,'a','Layout-induced scroll events are not a navigation intent');
  f.layout();await flush();assert.equal(viewport.scrollLeft,viewport.clientWidth);assert.notEqual(viewport.style.visibility,'hidden');
  assert.ok(viewport.children[1].querySelector(kind==='photo'?'img':'video')===media,'The original pixels remain in the centered pane');
  f.emit(viewport,'scrollend');await flush();assert.equal(f.window.FamilyMedia.current().id,'a');nativeStroke(f,140);await flush();assert.equal(f.window.FamilyMedia.current().id,'b');f.close();
 }
});

test('a prepared photo cannot replace the original touch target underneath the next unfinished stroke',async()=>{
 const f=fixture(),loads=[];await f.open();f.window.FamilyPhotoPresentation.ready=()=>null;f.window.FamilyPhotoPresentation.prepare=item=>new Promise(resolve=>loads.push({item,resolve}));
 nativeStroke(f,140);const viewport=f.strip(),image=viewport.children[1].querySelector('img');assert.ok(loads.some(load=>load.item.id==='b'));
 const finger={pointerType:'touch',pointerId:2,isPrimary:true,button:0,clientY:250};
 f.emit(image,'pointerdown',{...finger,clientX:200});f.emit(image,'pointermove',{...finger,clientX:340});assert.equal(viewport.clientWidth-viewport.scrollLeft,140);
 for(const {item,resolve}of loads.splice(0)){const prepared=f.document.createElement('img');prepared.src=item.previewSrc;resolve(prepared);}await flush();
 assert.equal(f.window.FamilyMedia.current().id,'a','The first image load must wait while a second physical stroke still owns the old target');assert.equal(image.isConnected,true);
 f.emit(image,'pointerup',{...finger,clientX:340});
 for(let round=0;round<5;round++){for(const {item,resolve}of loads.splice(0)){const prepared=f.document.createElement('img');prepared.src=item.previewSrc;resolve(prepared);}await flush();}
 assert.equal(f.window.FamilyMedia.current().id,'c','Releasing the second stroke keeps both requested advances');assert.ok(f.strip());f.close();
});

test('two fast cached touch releases advance twice without any native completion event',async()=>{
 const f=fixture({realPresentation:true});await f.open();
 for(const pointerId of [1,2]){
  // Each new physical contact hits the currently displayed surface. A cached
  // first release may already have replaced its image synchronously.
  const viewport=f.strip(),image=viewport.children[1].querySelector('img'),finger={pointerType:'touch',pointerId,isPrimary:true,button:0,clientY:250};
  for(const [type,x]of [['pointerdown',200],['pointermove',340],['pointerup',340]])f.emit(image,type,{...finger,clientX:x});
  await flush(); // Browser input tasks let pending DOM microtasks finish between contacts.
 }
 assert.equal(f.window.FamilyMedia.current().id,'c','Each physical release queues one advance even when every image is already decoded');assert.ok(f.strip());
 assert.equal(f.window.FamilyPhotoNative.isActive(f.get('mediaStage')),false);f.close();
});

test('rapid queued arrows share one caption save and retain both steps or preserve a failed draft',async()=>{
 for(const kind of ['photo','video'])for(const fail of [false,true]){
  const f=fixture();await f.open(kind);let finish;const requests=[];
  f.window.FamilyI18n.fetch=(path,options)=>{requests.push({path,options});return new Promise(resolve=>{finish=()=>resolve(Response.json(fail?{error:'Caption was not saved'}:{operation:'caption',scope:'photos',item:{...f.window.FamilyMedia.current(),caption:'Keep this draft'}},{status:fail?409:200}));});};
  const input=f.get('openedCaptionText');input.value='Keep this draft';f.emit(input,'input');
  f.emit(f.get('mediaNext'),'click');f.emit(f.get('mediaNext'),'click');assert.equal(requests.length,1,'Rapid arrows share the in-flight save');finish();await flush();
  assert.equal(f.window.FamilyMedia.current().id,fail?'a':'c','Both queued steps must survive a successful asynchronous caption save');
  if(fail){assert.equal(input.value,'Keep this draft');assert.equal(f.get('openedCaptionError').textContent,'Caption was not saved');}
  assert.ok(f.strip());f.close();
 }
});

test('a second arrow press during a native page load continues beyond the first item of the next page',async()=>{
 for(const kind of ['photo','video']){
  const f=fixture(),scope='personal:ruti',make=kind==='photo'?f.photo:f.video,pages=[['a','b'].map(make),['c','d'].map(make)];let finishPage;
  const loadPage=page=>new Promise(resolve=>{finishPage=()=>{register(page);resolve();};});
  const register=page=>f.window.FamilyMedia.register(scope,pages[page-1],{pagination:{page,pages:2,size:2,total:4},loadPage});
  register(1);f.window.FamilyMedia.openFrom(scope,'b');await flush();nativeStroke(f,140);
  const next=f.get('mediaNext');assert.equal(next.disabled,false,'Page transport must not discard a second arrow press');if(!next.disabled)f.emit(next,'click');
  finishPage();await flush();assert.equal(f.window.FamilyMedia.current().id,'d','Native Next plus arrow Next must advance across the page boundary twice');assert.ok(f.strip());f.close();
 }
});

test('native scrolling loops and crosses gallery pages without duplicate completion',async()=>{
 const f=fixture(),pages=[['a','b'].map(f.photo),['c'].map(f.photo)],visited=[];
 const register=page=>f.window.FamilyMedia.register('gallery',pages[page-1],{pagination:{page,pages:2,size:2,total:3,sort:'random',seed:7}});
 f.window.FamilyPortal={pageGallery:async page=>{visited.push(page);register(page);}};register(1);f.window.FamilyMedia.openFrom('gallery','b');await flush();
 const old=f.strip();await f.snap(0);assert.equal(f.window.FamilyMedia.current().id,'c');assert.deepEqual(visited,[2]);
 f.emit(old,'scrollend');await flush();assert.equal(f.window.FamilyMedia.current().id,'c','An obsolete native completion cannot advance the new album page');
 await f.snap(0);assert.equal(f.window.FamilyMedia.current().id,'a');assert.deepEqual(visited,[2,1]);
 await f.snap(2);assert.equal(f.window.FamilyMedia.current().id,'c');assert.deepEqual(visited,[2,1,2]);f.close();
});

test('profile page loaders retain native swiping on the final single-item photo or video page',async()=>{
 for(const kind of ['photo','video']){
  const f=fixture(),scope='personal:ruti',make=kind==='photo'?f.photo:f.video,pages=[['a','b'].map(make),['c'].map(make)],visited=[];
  const loadPage=async page=>{visited.push(page);register(page);};
  const register=page=>f.window.FamilyMedia.register(scope,pages[page-1],{pagination:{page,pages:2,size:2,total:3},loadPage});
  register(1);f.window.FamilyMedia.openFrom(scope,'b');await flush();await f.snap(0);
  assert.equal(f.window.FamilyMedia.current().id,'c');assert.deepEqual(visited,[2]);assert.ok(f.strip(),'A single visible '+kind+' on the last page still has adjacent album pages');
  assert.equal(f.strip().children[0].querySelector('img')?.getAttribute('src'),kind==='photo'?'/media/a?preview=1':'/posters/a.jpg','The known first-page neighbor remains visible across the album loop');
  await f.snap(0);assert.equal(f.window.FamilyMedia.current().id,'a');assert.deepEqual(visited,[2,1]);
  assert.equal(f.strip().children[2].querySelector('img')?.getAttribute('src'),kind==='photo'?'/media/c?preview=1':'/posters/c.jpg');
  await f.snap(2);assert.equal(f.window.FamilyMedia.current().id,'c');assert.deepEqual(visited,[2,1,2]);f.close();
 }
});

test('native scrolling recenters on resize and yields cleanly to photo zoom and unsupported browsers',async()=>{
 const f=fixture();await f.open();f.resize(640);assert.equal(f.strip().scrollLeft,640);await f.snap(0);assert.equal(f.window.FamilyMedia.current().id,'b');
 f.zoom(2);assert.equal(f.strip(),null);assert.ok(f.get('mediaStage').querySelector('.face-photo-scroll img'));
 f.zoom(1);assert.ok(f.strip());await f.snap(2);assert.equal(f.window.FamilyMedia.current().id,'a');f.close();
 for(const options of [{supported:false},{mobile:true}]){
  const fallback=fixture(options);await fallback.open();assert.equal(fallback.strip(),null,'Unsupported browsers and phones keep the existing gesture path');
  const image=fallback.get('mediaStage').querySelector('img');
  if(options.mobile){
   for(const [type,x]of [['touchstart',350],['touchmove',200],['touchend',200]]){
    const point={identifier:9,clientX:x,clientY:250,target:image};fallback.emit(image,type,{touches:type==='touchend'?[]:[point],changedTouches:[point]});
   }
  }else for(const [type,x]of [['pointerdown',200],['pointermove',350],['pointerup',350]])fallback.emit(image,type,{pointerType:'touch',pointerId:1,isPrimary:true,button:0,clientX:x,clientY:250});
  await flush();assert.equal(fallback.window.FamilyMedia.current().id,'b','The fallback remains usable for its device input');fallback.close();
 }
});
