import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../public/assets/portal.js',import.meta.url),'utf8');
function fixture(prepare,upload){
  const nodes=new Map(),events=new Map(),sent=[],messages=[];
  class Node{
    constructor(){this.handlers=new Map();this.children=[];this.dataset={};this.value='';this.files=[];this.classList={add(){},remove(){},toggle(){}};this.widgets=new Map();}
    addEventListener(type,fn){this.handlers.set(type,fn);}querySelectorAll(){return [];}
    querySelector(selector){if(!this.widgets.has(selector))this.widgets.set(selector,new Node());return this.widgets.get(selector);}
  }
  const node=id=>{if(!nodes.has(id))nodes.set(id,new Node());return nodes.get(id);};
  const empty={items:[],count:0,revision:'test',pagination:{page:1,pages:1,total:0,size:100}};
  const window={FamilyPhotoEditor:{prepare,upload},FAMILY_API_TOKEN:'test-token',FamilyI18n:{isEnglish:false,t:String,html:(parts,...values)=>parts.reduce((s,p,i)=>s+p+(values[i]??''),''),fetch:async()=>Response.json(empty)},FamilyMedia:{register(){}},FamilyTags:{refresh(){}},FamilyApp:{apiEnabled:true,getView:()=> 'tree',toast:message=>messages.push(message)},addEventListener(){}};
  const document={getElementById:node,querySelector:()=>null,querySelectorAll:()=>[],addEventListener:(type,fn)=>events.set(type,fn)};
  class XHR{
    constructor(){this.upload={};this.headers={};}open(method,url){this.url=url;}setRequestHeader(name,value){this.headers[name]=value;}send(file){this.file=file;sent.push(this);}
    complete(){this.status=201;this.responseText=JSON.stringify({file:'saved.jpg',collection:empty});this.onload();}
  }
  vm.runInNewContext(source,{window,document,XMLHttpRequest:XHR,Response,URLSearchParams,console,setInterval(){},setTimeout(){},clearTimeout(){},requestAnimationFrame:fn=>fn(),matchMedia:()=>({matches:false})});events.get('DOMContentLoaded')();
  return {window,sent,messages,node,flush:()=>new Promise(resolve=>setImmediate(resolve)),select(kind,files){const input=node({gallery:'sharedGalleryInput',photos:'sharedPhotosInput',videos:'sharedVideosInput'}[kind]);input.files=files;input.handlers.get('change')();}};
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
