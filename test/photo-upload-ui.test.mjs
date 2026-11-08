import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../public/assets/portal.js',import.meta.url),'utf8');
function fixture(prepare,upload,drop){
  const nodes=new Map(),events=new Map(),sent=[],messages=[],requests=[];
  class Node{
    constructor(){this.handlers=new Map();this.children=[];this.dataset={};this.value='';this.files=[];this.classList={add(){},remove(){},toggle(){}};this.widgets=new Map();}
    addEventListener(type,fn){this.handlers.set(type,fn);}querySelectorAll(){return [];}
    querySelector(selector){if(!this.widgets.has(selector))this.widgets.set(selector,new Node());return this.widgets.get(selector);}
  }
  const node=id=>{if(!nodes.has(id))nodes.set(id,new Node());return nodes.get(id);};
  const empty={items:[],count:0,revision:'test',pagination:{page:1,pages:1,total:0,size:100}};
  const window={FamilyPhotoEditor:{prepare,upload},FAMILY_API_TOKEN:'test-token',FamilyI18n:{isEnglish:false,t:String,html:(parts,...values)=>parts.reduce((s,p,i)=>s+p+(values[i]??''),''),fetch:async()=>Response.json(empty)},FamilyMedia:{register(){}},FamilyTags:{refresh(){}},FamilyApp:{apiEnabled:true,getView:()=> 'tree',toast:message=>messages.push(message)},addEventListener(){}};
  window.FamilyI18n.fetch=async(path,options)=>{requests.push({path,options});return Response.json(empty);};
  const document={getElementById:node,querySelector:()=>null,querySelectorAll:()=>[],addEventListener:(type,fn)=>events.set(type,fn)};
  window.FamilyPhotoDrop=drop;
  class XHR{
    constructor(){this.upload={};this.headers={};}open(method,url){this.url=url;}setRequestHeader(name,value){this.headers[name]=value;}send(file){this.file=file;sent.push(this);}
    complete(){this.status=201;this.responseText=JSON.stringify({file:'saved.jpg',collection:empty});this.onload();}
  }
  vm.runInNewContext(source,{window,document,XMLHttpRequest:XHR,Response,URLSearchParams,console,setInterval(){},setTimeout(){},clearTimeout(){},requestAnimationFrame:fn=>fn(),matchMedia:()=>({matches:false})});events.get('DOMContentLoaded')();
  return {window,sent,messages,node,requests,flush:()=>new Promise(resolve=>setImmediate(resolve)),select(kind,files){const input=node({gallery:'sharedGalleryInput',photos:'sharedPhotosInput',videos:'sharedVideosInput'}[kind]);input.files=files;input.handlers.get('change')();}};
}
const original={name:'original.png',type:'image/png',size:100},edited={name:'edited.jpg',type:'image/jpeg',size:80};

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
