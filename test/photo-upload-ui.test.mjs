import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../public/assets/portal.js',import.meta.url),'utf8');
const thumbnailSource=await readFile(new URL('../public/assets/photo-thumbnails.js',import.meta.url),'utf8');
function fixture(prepare,upload,drop,{phone=false,apiEnabled=true,backgroundCopies=false,hidden=false,browsing=false}={}){
  const nodes=new Map(),events=new Map(),sent=[],messages=[],requests=[];
  class Node{
    constructor(){this.handlers=new Map();this.children=[];this.dataset={};this.value='';this.files=[];this.classList={add(){},remove(){},toggle(){}};this.widgets=new Map();}
    addEventListener(type,fn){this.handlers.set(type,fn);}querySelectorAll(){return [];}
    click(){this.clicks=(this.clicks||0)+1;}showModal(){this.open=true;}close(){this.open=false;}
    getBoundingClientRect(){return {left:20,right:340,top:100,bottom:350};}
    querySelector(selector){if(!this.widgets.has(selector))this.widgets.set(selector,new Node());return this.widgets.get(selector);}
  }
  const node=id=>{if(!nodes.has(id))nodes.set(id,new Node());return nodes.get(id);};
  const empty={items:[],count:0,revision:'test',pagination:{page:1,pages:1,total:0,size:100}};
  const window={FamilyPhotoEditor:{prepare,upload},FAMILY_API_TOKEN:'test-token',FamilyI18n:{isEnglish:false,t:String,html:(parts,...values)=>parts.reduce((s,p,i)=>s+p+(values[i]??''),''),fetch:async()=>Response.json(empty)},FamilyMedia:{register(){}},FamilyTags:{refresh(){}},FamilyApp:{apiEnabled,getView:()=> 'tree',toast:message=>messages.push(message)},addEventListener(){}};
  window.FamilyI18n.fetch=async(path,options)=>{requests.push({path,options});return Response.json(empty);};
  const document={hidden,getElementById:node,querySelector:()=>null,querySelectorAll:()=>[],addEventListener:(type,fn)=>events.set(type,fn)};
  if(backgroundCopies){
    window.FamilyMedia.isPhotoBrowsing=()=>browsing;
    vm.runInNewContext(thumbnailSource,{window,document,setTimeout(){},createImageBitmap:()=>new Promise(()=>{})});
  }
  window.FamilyPhotoDrop=drop;
  class XHR{
    constructor(){this.upload={};this.headers={};}open(method,url){this.url=url;}setRequestHeader(name,value){this.headers[name]=value;}send(file){this.file=file;sent.push(this);}
    complete(result={file:'saved.jpg',collection:empty}){this.status=201;this.responseText=JSON.stringify(result);this.onload();}
  }
  vm.runInNewContext(source,{window,document,XMLHttpRequest:XHR,Response,URLSearchParams,console,setInterval(){},setTimeout(){},clearTimeout(){},requestAnimationFrame:fn=>fn(),matchMedia:query=>({matches:phone&&query==='(max-width:700px)'})});events.get('DOMContentLoaded')();
  return {window,document,sent,messages,node,requests,flush:()=>new Promise(resolve=>setImmediate(resolve)),tap(selector,dataset){events.get('click')({target:{closest:query=>query===selector?{dataset}:null}});},select(kind,files){const input=node({gallery:'sharedGalleryInput',camera:'sharedGalleryCamera',photos:'sharedPhotosInput',videos:'sharedVideosInput'}[kind]);input.files=files;input.handlers.get('change')();}};
}
const original={name:'original.png',type:'image/png',size:100},edited={name:'edited.jpg',type:'image/jpeg',size:80};

test('desktop and phone batches keep uploading while hidden, browsing elsewhere or waiting on image decoding',async()=>{
  for(const phone of [false,true])for(const mode of ['hidden','browsing','minimize-during-copy']){
    const files=Array.from({length:12},(_,index)=>({name:'photo-'+index+'.jpg',type:'image/jpeg',size:3000000}));
    const f=fixture(async()=>files,undefined,undefined,{phone,backgroundCopies:true,hidden:mode==='hidden',browsing:mode==='browsing'});
    f.select('gallery',files);await f.flush();f.window.FamilyPortal.activate('photos');await f.flush();
    for(const [index,file]of files.entries()){
      assert.equal(f.sent.length,index+1,`${phone?'Phone':'Desktop'} ${mode}: photo ${index+1} must start without a thumbnail`);
      assert.match(f.sent[index].url,/collections\/gallery\/upload/);
      const item={id:'photo-'+index,kind:'photo',file:file.name,src:'/media/'+index,mime:file.type,size:file.size};
      f.sent[index].complete({file:file.name,collection:{items:[item],revision:String(index)}});
      if(mode==='minimize-during-copy')f.document.hidden=true;
      await f.flush();
    }
    assert.match(f.node('galleryUploadState').textContent,/12/);
    assert.equal(f.node('galleryProgress').hidden,true);
  }
});

test('phone gallery asks for a source before opening a native picker; cancelling never opens the editor',async()=>{
  let calls=0;const f=fixture(async()=>{calls++;return [];},undefined,undefined,{phone:true});
  f.tap('[data-upload-collection]',{uploadCollection:'gallery'});
  assert.equal(f.node('galleryUploadSource').open,true);assert.equal(f.node('sharedGalleryInput').clicks,undefined);assert.equal(f.node('sharedGalleryCamera').clicks,undefined);
  f.tap('[data-close-dialog]',{closeDialog:'galleryUploadSource'});await f.flush();assert.equal(f.node('galleryUploadSource').open,false);assert.equal(calls,0);assert.equal(f.sent.length,0);
  f.tap('[data-upload-collection]',{uploadCollection:'gallery'});f.tap('[data-gallery-upload-source]',{galleryUploadSource:'gallery'});
  assert.equal(f.node('galleryUploadSource').open,false);assert.equal(f.node('sharedGalleryInput').clicks,1);assert.equal(f.node('sharedGalleryCamera').clicks,undefined);
  f.select('gallery',[]);await f.flush();assert.equal(calls,0);assert.equal(f.sent.length,0);
});
test('phone camera uses the gallery editor and destination, waits for approval and supports a second capture',async()=>{
  let approve,scope;const f=fixture((files,options)=>{scope=options.scope;return new Promise(resolve=>{approve=resolve;});},undefined,undefined,{phone:true});
  f.tap('[data-upload-collection]',{uploadCollection:'gallery'});f.tap('[data-gallery-upload-source]',{galleryUploadSource:'camera'});
  assert.equal(f.node('galleryUploadSource').open,false);assert.equal(f.node('sharedGalleryCamera').clicks,1);assert.equal(f.node('sharedGalleryInput').clicks,undefined);
  f.select('camera',[original]);await f.flush();assert.equal(scope,'gallery');assert.equal(f.sent.length,0);assert.equal(f.node('sharedGalleryCamera').value,'');
  approve([edited]);await f.flush();assert.equal(f.sent.length,1);assert.match(f.sent[0].url,/collections\/gallery\/upload/);assert.equal(f.sent[0].file,edited);f.sent[0].complete();await f.flush();
  f.tap('[data-upload-collection]',{uploadCollection:'gallery'});f.tap('[data-gallery-upload-source]',{galleryUploadSource:'camera'});assert.equal(f.node('sharedGalleryCamera').clicks,2);
});
test('desktop gallery and other mobile albums open their existing picker directly; offline cannot start either flow',()=>{
  for(const phone of [false,true])for(const kind of ['gallery','photos','videos']){
    if(phone&&kind==='gallery')continue;
    const f=fixture(async()=>[],undefined,undefined,{phone});f.tap('[data-upload-collection]',{uploadCollection:kind});
    assert.equal(Boolean(f.node('galleryUploadSource').open),false);assert.equal(f.node({gallery:'sharedGalleryInput',photos:'sharedPhotosInput',videos:'sharedVideosInput'}[kind]).clicks,1);
  }
  const offline=fixture(async()=>[],undefined,undefined,{phone:true,apiEnabled:false});
  offline.tap('[data-upload-collection]',{uploadCollection:'gallery'});offline.tap('[data-gallery-upload-source]',{galleryUploadSource:'camera'});
  assert.equal(Boolean(offline.node('galleryUploadSource').open),false);assert.equal(offline.node('sharedGalleryCamera').clicks,undefined);assert.equal(offline.sent.length,0);
});
test('tapping inside the source dialog keeps it open; its backdrop dismisses it',()=>{
  const f=fixture(async()=>[],undefined,undefined,{phone:true}),dialog=f.node('galleryUploadSource');
  f.tap('[data-upload-collection]',{uploadCollection:'gallery'});dialog.handlers.get('click')({target:dialog,clientX:100,clientY:200});assert.equal(dialog.open,true);
  dialog.handlers.get('click')({target:dialog,clientX:5,clientY:50});assert.equal(dialog.open,false);assert.equal(f.sent.length,0);
});

test('family gallery sends no bytes until approval and uploads the rendered file to the original gallery',async()=>{
  let approve;const f=fixture(()=>new Promise(resolve=>{approve=resolve;}));f.select('gallery',[original]);await f.flush();assert.equal(f.sent.length,0);
  f.window.FamilyPortal.activate('photos');approve([edited]);await f.flush();assert.equal(f.sent.length,1);
  assert.equal(f.sent[0].file,edited);assert.match(f.sent[0].url,/collections\/gallery\/upload\?filename=edited.jpg/);
  assert.equal(f.sent[0].headers['Content-Type'],'image/jpeg');assert.equal(f.sent[0].headers['X-Family-Token'],'test-token');
  f.sent[0].complete();await f.flush();
});
test('cancel, an empty selection and an editor error cannot upload original images',async()=>{
  for(const prepare of [async()=>null,async()=>[],async()=>{throw Error('unavailable');}]){
    const f=fixture(prepare);f.select('gallery',[original]);await f.flush();assert.equal(f.sent.length,0);
  }
});
test('gallery forwards each prepared photo with its own metadata body and header',async()=>{
  const first={name:'one.jpg',type:'image/jpeg',size:50},second={name:'two.png',type:'image/png',size:60},bodyOne={withDate:'first'},bodyTwo={withDate:'second'};
  const f=fixture(async()=>[first,second],file=>({body:file===first?bodyOne:bodyTwo,headers:{'X-Family-Photo-Metadata-Length':file===first?'100':'120'}}));
  f.select('gallery',[original]);await f.flush();assert.equal(f.sent.length,1);assert.equal(f.sent[0].file,bodyOne);assert.equal(f.sent[0].headers['X-Family-Photo-Metadata-Length'],'100');
  f.sent[0].complete();await f.flush();assert.equal(f.sent.length,2);assert.equal(f.sent[1].file,bodyTwo);assert.equal(f.sent[1].headers['X-Family-Photo-Metadata-Length'],'120');assert.equal(f.sent[1].headers['Content-Type'],'image/png');
  f.sent[1].complete();await f.flush();
});
test('photo editor receives the selected destination even if the visitor changes tabs',async()=>{
  for(const kind of ['gallery','photos']){
    let context;const f=fixture(async(files,options)=>{context=options;return [];});f.select(kind,[original]);await f.flush();
    assert.equal(context.scope,kind);assert.equal(f.sent.length,0);
  }
});
test('individual approval uploads just that image to the original destination while the wizard keeps the batch open',async()=>{
 let context,approve;const f=fixture((files,options)=>{context=options;return new Promise(resolve=>{approve=resolve;});});
 f.select('gallery',[original,edited]);await f.flush();assert.equal(f.sent.length,0);f.window.FamilyPortal.activate('photos');
 const saving=context.onUpload(edited,()=>{});assert.equal(f.sent.length,1);assert.match(f.sent[0].url,/collections\/gallery\/upload/);assert.equal(f.sent[0].file,edited);f.sent[0].complete();await saving;
 assert.equal(f.sent.length,1);approve([original]);await f.flush();assert.equal(f.sent.length,2);assert.equal(f.sent[1].file,original);f.sent[1].complete();await f.flush();
});
test('videos retain the normal upload flow and never enter the photo editor',async()=>{
  let calls=0;const f=fixture(async files=>{calls++;return files;}),video={name:'family.mp4',type:'video/mp4',size:50};
  f.select('videos',[video]);assert.equal(calls,0);assert.equal(f.sent.length,1);assert.equal(f.sent[0].file,video);f.sent[0].complete();await f.flush();
});
test('pasting into the family gallery uses the same approval gate and preserves the output extension',async()=>{
  let approve;const f=fixture(()=>new Promise(resolve=>{approve=resolve;}));f.window.FamilyPortal.activate('gallery');await f.flush();
  let prevented=false;f.window.FamilyPortal.acceptPaste({clipboardData:{items:[{kind:'file',type:'image/png',getAsFile:()=>original}]},preventDefault(){prevented=true;}});
  assert.equal(prevented,true);assert.equal(f.sent.length,0);approve([edited]);await f.flush();assert.equal(f.sent.length,1);
  assert.match(f.sent[0].url,/filename=.*\.jpg$/);f.sent[0].complete();await f.flush();
});
test('desktop drop finishes preparation before the editor and uploads only after approval to the original destination',async()=>{
  let finishRead,approve,editorCalls=0,scope;
  const f=fixture((files,options)=>{editorCalls++;assert.equal(files[0],original);scope=options.scope;return new Promise(resolve=>{approve=resolve;});},undefined,{hide(){},prepare:files=>new Promise(resolve=>{finishRead=()=>resolve(files);})});
  f.window.FamilyPortal.activate('gallery');await f.flush();
  assert.equal(f.window.FamilyPortal.acceptDrop({dataTransfer:{files:[original]}}),true);assert.equal(editorCalls,0);assert.equal(f.sent.length,0);
  f.window.FamilyPortal.activate('photos');finishRead();await f.flush();assert.equal(editorCalls,1);assert.equal(scope,'gallery');assert.equal(f.sent.length,0);
  approve([edited]);await f.flush();assert.equal(f.sent.length,1);assert.match(f.sent[0].url,/collections\/gallery\/upload/);f.sent[0].complete();await f.flush();
});
test('cancelled or failed drop preparation sends no bytes and never opens the editor',async()=>{
  for(const prepare of [async()=>null,async()=>{throw Error('Disk unavailable');}]){
    let calls=0;const f=fixture(async files=>{calls++;return files;},undefined,{hide(){},prepare});
    f.window.FamilyPortal.activate('gallery');await f.flush();f.window.FamilyPortal.acceptDrop({dataTransfer:{files:[original]}});await f.flush();
    assert.equal(calls,0);assert.equal(f.sent.length,0);
  }
});
test('gallery starts random, keeps the same seed while filtering and sends explicit sort choices to the server',async()=>{
  const f=fixture(async()=>[]);f.window.FamilyPortal.activate('gallery');await f.flush();
  const initial=f.window.FamilyPortal.galleryQuery();assert.equal(initial.sort,'random');assert.ok(Number.isSafeInteger(initial.seed));
  let url=new URL(f.requests.at(-1).path,'https://fixture.example/');assert.equal(url.searchParams.get('sort'),'random');assert.equal(url.searchParams.get('seed'),String(initial.seed));
  await f.window.FamilyPortal.refineGallery({person:'yona'});assert.equal(f.window.FamilyPortal.galleryQuery().seed,initial.seed);
  await f.window.FamilyPortal.sortGallery('taken-asc');await f.flush();url=new URL(f.requests.at(-1).path,'https://fixture.example/');
  assert.equal(url.searchParams.get('sort'),'taken-asc');assert.equal(url.searchParams.get('person'),'yona');assert.equal(url.searchParams.get('page'),'1');
  f.window.FamilyPortal.sortGallery('invalid');assert.equal(f.window.FamilyPortal.galleryQuery().sort,'taken-asc');
});

