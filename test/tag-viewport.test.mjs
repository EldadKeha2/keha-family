import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import family from '../src/family.mjs';
const source=await readFile(new URL('../public/assets/tags.js',import.meta.url),'utf8');

function fixture({mobile=true}={}){
  let frameId=0;const frames=new Map(),requests=[];
  class Node extends EventTarget{
    constructor(){super();this.children=new Map();this.dataset={};this.isConnected=true;this.scrollTop=0;this.hidden=false;this.value='';this.bounds={top:0,height:0};this.classes=new Set();this.properties=new Map();this.classList={add:name=>this.classes.add(name),remove:name=>this.classes.delete(name),contains:name=>this.classes.has(name)};this.style={setProperty:(k,v)=>this.properties.set(k,v),removeProperty:k=>this.properties.delete(k)};}
    querySelector(selector){if(!this.children.has(selector))this.children.set(selector,new Node());return this.children.get(selector);}
    querySelectorAll(){return [];}
    closest(selector){return selector==='dialog'?this.dialog:selector==='label'?this.label:null;}
    contains(node){return node===this||[...this.children.values()].some(child=>child.contains(node));}
    getBoundingClientRect(){return {...this.bounds,bottom:this.bounds.top+this.bounds.height};}
    replaceChildren(){}
    focus(){}
  }
  const viewport=new EventTarget();Object.assign(viewport,{height:720,offsetTop:0});
  const dialog=new Node(),host=new Node(),input=host.querySelector('[data-tag-search]'),area=host.querySelector('[data-tag-search-area]'),label=new Node(),header=dialog.querySelector('.media-viewer-header'),widget=host.querySelector('.tag-widget');
  host.dialog=dialog;input.label=label;dialog.bounds.top=8;header.bounds.height=54;label.bounds.height=76;area.bounds.top=640;
  const scrolls=[];dialog.scrollBy=({top})=>{scrolls.push(top);area.bounds.top-=top;};
  const document={activeElement:input,addEventListener(){},getElementById(){return {open:false};}};
  const window={FAMILY_DATA:family,visualViewport:viewport,innerHeight:720,matchMedia:()=>({matches:mobile}),FamilyApp:{apiEnabled:true,toast(){}},addEventListener(){},dispatchEvent(){}};
  window.FamilyI18n={t:v=>v,html:(parts,...values)=>parts.reduce((s,p,i)=>s+p+(values[i]??''),''),isEnglish:false,locale:'he-IL',personName:p=>p.name,searchNames:p=>p.name,branchName:p=>p?.title||'',error:String,fetch:async(path)=>{requests.push(path);throw Error('No network needed');}};
  vm.runInNewContext(source,{window,document,AbortController,CustomEvent,clearTimeout,setTimeout,requestAnimationFrame:callback=>{const id=++frameId;frames.set(id,callback);return id;},cancelAnimationFrame:id=>frames.delete(id)});
  window.FamilyTags.mountInline(host,{id:'viewport-video',kind:'video',name:'Memory',tags:[],tagsRevision:'known'});
  const flush=()=>{for(const [id,callback]of [...frames]){frames.delete(id);callback();}};
  return {window,dialog,host,input,area,label,header,widget,viewport,frames,requests,scrolls,flush,
    focus(){input.dispatchEvent(new Event('focus'));flush();},
    type(query){input.value=query;input.dispatchEvent(new Event('input'));flush();},
    resize(height,offsetTop=0){viewport.height=height;viewport.offsetTop=offsetTop;viewport.dispatchEvent(new Event('resize'));flush();},
    firstResultBottom(){return area.bounds.top+label.bounds.height+4+62;}
  };
}
test('mobile video search keeps the first matching name above the keyboard as the visual viewport shrinks',()=>{
  const f=fixture();f.focus();f.type('שי');f.resize(330);
  assert.ok(f.widget.classList.contains('is-searching'));assert.ok(f.dialog.classList.contains('tag-search-active'));
  assert.ok(f.firstResultBottom()<f.viewport.height-8,'The first matching row must fit above the keyboard');
  assert.ok(Number.parseFloat(f.dialog.properties.get('--tag-results-height'))>=64);assert.ok(Number.parseFloat(f.dialog.properties.get('--tag-results-height'))<=160);
  // Search ranking has its own regressions; either matching row must remain available above the keyboard.
  const html=f.host.querySelector('[data-tag-results]').innerHTML;assert.match(html,/data-tag-person="shay"/);assert.match(html,/data-tag-person="avishai"/);assert.equal(f.requests.length,0);
  f.window.FamilyTags.clearInline(f.host);
});
test('keyboard panning is represented in the dialog placement and closing removes viewport listeners and queued work',()=>{
  const f=fixture();f.focus();f.resize(300,40);assert.equal(f.dialog.properties.get('--tag-visible-top'),'40px');
  f.input.dispatchEvent(new Event('focus'));assert.equal(f.frames.size,1);f.window.FamilyTags.clearInline(f.host);
  assert.equal(f.frames.size,0);assert.ok(!f.dialog.classList.contains('tag-search-active'));assert.equal(f.dialog.properties.size,0);
  const before=f.scrolls.length;f.resize(260);assert.equal(f.frames.size,0);assert.equal(f.scrolls.length,before,'Closed images must not move the new tagging panel');
});
test('desktop focus leaves the existing gallery size and scrolling unchanged',()=>{
  const f=fixture({mobile:false});f.focus();f.type('שי');f.resize(330);assert.ok(!f.dialog.classList.contains('tag-search-active'));assert.equal(f.dialog.properties.size,0);assert.equal(f.scrolls.length,0);f.window.FamilyTags.clearInline(f.host);
});
