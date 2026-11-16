import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';

const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
const names=['photo-native.js','photo-swipe.js','media.js'];
const sources=new Map(await Promise.all(names.map(async name=>[name,await readFile(new URL('../public/assets/'+name,import.meta.url),'utf8')])));
const flush=async()=>{for(let i=0;i<4;i++)await new Promise(resolve=>setImmediate(resolve));};

// Browser geometry and image readiness are the boundaries modeled here. The
// production index, DOM tree, native scroller, gesture binding and media state
// machine are real, so missing script wiring or reparenting cannot be hidden
// by the lightweight object fixtures used in the individual unit suites.
function fixture({supported=true,mobile=false,width=1200,delayedFaces=false}={}){
 const {window,document}=parseHTML(html),requests=[],captures=[],observers=[],faceReady=[],faceMounts=[];let failSave=false;
 const get=id=>document.getElementById(id);
 for(const dialog of document.querySelectorAll('dialog')){
  dialog.showModal=()=>{dialog.open=true;dialog.setAttribute('open','');};
  dialog.close=()=>{dialog.open=false;dialog.removeAttribute('open');dialog.dispatchEvent(new window.Event('close'));};
 }
 Object.defineProperty(window.HTMLElement.prototype,'clientWidth',{configurable:true,get(){return this._testWidth??width;}});
 Object.defineProperty(window.HTMLElement.prototype,'onscrollend',{configurable:true,value:null,writable:true});
 window.HTMLElement.prototype.getBoundingClientRect=function(){return {x:0,y:100,left:0,right:this.clientWidth,top:100,bottom:700,width:this.clientWidth,height:600};};
 window.HTMLElement.prototype.setPointerCapture=function(id){captures.push({node:this,id});};
 window.HTMLElement.prototype.focus=function(){Object.defineProperty(document,'activeElement',{value:this,configurable:true});};
 window.HTMLElement.prototype.blur=function(){if(document.activeElement===this)Object.defineProperty(document,'activeElement',{value:document.body,configurable:true});};
 window.HTMLElement.prototype.pause=function(){this.paused=true;};
 window.HTMLElement.prototype.load=function(){};
 const emit=(node,type,props={})=>{const event=new window.Event(type,{bubbles:true,cancelable:true});Object.assign(event,props);node.dispatchEvent(event);return event;};
 const navigator={userAgent:mobile?'Android Mobile':'Windows NT 10.0',maxTouchPoints:5};
 window.ontouchstart=null;
 const presentation={desktop:()=>!mobile,source:item=>item.previewSrc||item.src,preload(){},cancel(){window.FamilyPhotoNative?.reset();},settle(){},slide(){},snapshot:()=>null,prepare:()=>null};
 Object.assign(window,{
  FamilyApp:{apiEnabled:true,toast(){}},FamilyPhotoPresentation:presentation,
  FamilyPhotoKeyboard:{desktop:()=>!mobile,bindNavigation(){}},
  FamilyTags:{taggable:()=>true,mountInline(){},clearInline(){},controls:()=>'',labels:()=>''},
  FamilyI18n:{isEnglish:false,language:'he',t:String,error:String,mediaName:item=>item.name||item.id,html:(parts,...values)=>parts.reduce((out,part,i)=>out+part+(values[i]??''),''),fetch:async(path,options)=>{
   requests.push({path,options});const caption=JSON.parse(options.body).caption;
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
   clear(){delete get('mediaStage')._familyFaceContext;},update(){},
   canNavigate(stage){const c=stage._familyFaceContext;return !c||c.zoom===1&&!c.saving&&!c.adjust;}
  }
 });
 class ResizeObserver{
  constructor(callback){this.callback=callback;this.nodes=new Set();observers.push(this);}
  observe(node){this.nodes.add(node);}
  disconnect(){this.nodes.clear();}
 }
 const context=vm.createContext({window,document,navigator,CSS:{supports:()=>supported},ResizeObserver,CustomEvent:window.CustomEvent,URL,Response,history:{replaceState(){}},location:{origin:'https://family.test',href:'https://family.test/#photos'},matchMedia:()=>({matches:mobile}),getComputedStyle:()=>({minHeight:'40',maxHeight:'280'}),setTimeout:(fn,ms)=>{const timer=setTimeout(fn,ms);timer.unref();return timer;},clearTimeout});
 // Follow production ordering when loading the scripts under test.
 const loaded=[];
 for(const script of document.querySelectorAll('script[src]')){
  const name=script.getAttribute('src').split('/').at(-1).split('?')[0];
  if(sources.has(name)){vm.runInContext(sources.get(name),context,{filename:name});loaded.push(name);}
 }
 document.dispatchEvent(new window.Event('DOMContentLoaded'));
 const photo=id=>({id,kind:'photo',mime:'image/jpeg',src:'/media/'+id,previewSrc:'/media/'+id+'?preview=1',name:id,tags:[]});
 const video=id=>({...photo(id),kind:'video',mime:'video/mp4'});
 const strip=()=>get('mediaStage').querySelector('.native-photo-strip');
 return {window,document,get,emit,requests,captures,loaded,photo,video,strip,faceReady,faceMounts,
  open:async(kind='photo',scope=kind==='photo'?'photos':'videos',index=0)=>{window.FamilyMedia.open(['a','b','c'].map(kind==='photo'?photo:video),index,scope);await flush();},
  async snap(page){const viewport=strip();assert.ok(viewport,'The active media must be inside a browser scroll-snap strip');viewport.scrollLeft=page*viewport.clientWidth;emit(viewport,'scroll');emit(viewport,'scrollend');await flush();},
  resize(value){const viewport=strip();viewport._testWidth=value;for(const observer of observers)if(observer.nodes.has(viewport))observer.callback([{target:viewport}]);},
  zoom(value){const stage=get('mediaStage');stage._familyFaceContext.zoom=value;stage.classList.toggle('face-photo-enlarged',value>1);window.FamilyMedia.refreshPhotoPresentation();},
  failSaving(value=true){failSave=value;},
  close(){get('mediaViewer').close();}
 };
}

test('production loads the native controller before the gallery binds gesture input',()=>{
 const f=fixture();for(const name of names)assert.ok(f.loaded.includes(name),name+' must be loaded by the production page');
 assert.ok(f.loaded.indexOf('photo-native.js')<f.loaded.indexOf('media.js'));assert.ok(f.loaded.indexOf('photo-swipe.js')<f.loaded.indexOf('media.js'));assert.equal(f.window.FamilyPhotoNative.supported(),true);
});

test('desktop photo viewers use browser scrolling for both touch and trackpad input',async()=>{
 for(const scope of ['photos','gallery','personal:ruti','wedding:parents','nursery:ruti']){
  const f=fixture();await f.open('photo',scope);const stage=f.get('mediaStage'),viewport=f.strip();assert.ok(viewport,scope);
  assert.equal(viewport.children.length,3);assert.equal(viewport.scrollLeft,viewport.clientWidth);assert.equal(stage.classList.contains('photo-manual-swipes'),false);
  const surface=viewport.children[1].querySelector('img');assert.ok(surface,'The actual photo stays in the center pane');
  for(const [type,x]of [['pointerdown',200],['pointermove',350],['pointerup',350]]){
   assert.equal(f.emit(surface,type,{pointerType:'touch',pointerId:1,isPrimary:true,button:0,clientX:x,clientY:250}).defaultPrevented,false);
  }
  const point={identifier:1,clientX:200,clientY:250,target:surface};
  assert.equal(f.emit(surface,'touchstart',{touches:[point],changedTouches:[point]}).defaultPrevented,false);
  assert.equal(f.emit(surface,'touchmove',{touches:[{...point,clientX:350}],changedTouches:[]}).defaultPrevented,false);
  assert.equal(f.emit(surface,'touchend',{touches:[],changedTouches:[{...point,clientX:350}]}).defaultPrevented,false);
  assert.equal(f.emit(surface,'wheel',{deltaX:140,deltaY:0,deltaMode:0,clientX:400,clientY:250}).defaultPrevented,false,'The browser receives the full trackpad gesture');
  assert.equal(f.captures.length,0,'Native touch does not capture the pointer away from browser scrolling');assert.equal(f.window.FamilyMedia.current().id,'a');
  await f.snap(0);assert.equal(f.window.FamilyMedia.current().id,'b',scope+' Next');
  await f.snap(2);assert.equal(f.window.FamilyMedia.current().id,'a',scope+' Previous');f.close();
 }
});

test('desktop videos retain the working manual touch and trackpad navigation',async()=>{
 const f=fixture();await f.open('video');const stage=f.get('mediaStage');assert.equal(f.strip(),null);
 const player=stage.querySelector('video');
 for(const [type,x]of [['pointerdown',200],['pointermove',350],['pointerup',350]])f.emit(player,type,{pointerType:'touch',pointerId:1,isPrimary:true,button:0,clientX:x,clientY:250});
 await flush();assert.equal(f.window.FamilyMedia.current().id,'b','The established video screen gesture still works');assert.equal(f.strip(),null);
 const wheel=f.emit(stage.querySelector('video'),'wheel',{deltaX:-140,deltaY:0,deltaMode:0,clientX:400,clientY:250});assert.equal(wheel.defaultPrevented,true);
 await new Promise(resolve=>setTimeout(resolve,150));await flush();assert.equal(f.window.FamilyMedia.current().id,'a','The established video trackpad path still works');assert.equal(f.strip(),null);f.close();
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

test('native scrolling loops and crosses gallery pages without duplicate completion',async()=>{
 const f=fixture(),pages=[['a','b'].map(f.photo),['c'].map(f.photo)],visited=[];
 const register=page=>f.window.FamilyMedia.register('gallery',pages[page-1],{pagination:{page,pages:2,size:2,total:3,sort:'random',seed:7}});
 f.window.FamilyPortal={pageGallery:async page=>{visited.push(page);register(page);}};register(1);f.window.FamilyMedia.openFrom('gallery','b');await flush();
 const old=f.strip();await f.snap(0);assert.equal(f.window.FamilyMedia.current().id,'c');assert.deepEqual(visited,[2]);
 f.emit(old,'scrollend');await flush();assert.equal(f.window.FamilyMedia.current().id,'c','An obsolete native completion cannot advance the new album page');
 await f.snap(0);assert.equal(f.window.FamilyMedia.current().id,'a');assert.deepEqual(visited,[2,1]);
 await f.snap(2);assert.equal(f.window.FamilyMedia.current().id,'c');assert.deepEqual(visited,[2,1,2]);f.close();
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
