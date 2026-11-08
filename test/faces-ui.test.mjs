import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as geometryModule from '../public/assets/face-geometry.mjs';

const source=(await readFile(new URL('../public/assets/faces.js',import.meta.url),'utf8'))
 .replace(/import\('\.\/face-geometry\.mjs\?v=\d+'\)/,'Promise.resolve(geometryModule)')
 .replace(/import\('\.\/face-detector\.mjs\?v=\d+'\)/,'Promise.resolve(detectorModule)');
function fixture(detected=[]){
 const view={width:360,height:800},created=[];
 class Node extends EventTarget{
  constructor(tag='div'){super();this.tagName=tag;this.children=[];this.queries=new Map();this.style={};this.dataset={};this.hidden=false;this.scrollLeft=0;this.scrollTop=0;this.className='';this.parent=null;created.push(this);}
  get classList(){return {contains:value=>this.className.split(' ').includes(value),add:(...values)=>{this.className=[...new Set([...this.className.split(' '),...values])].join(' ');},remove:(...values)=>{this.className=this.className.split(' ').filter(x=>!values.includes(x)).join(' ');}};}
  append(...nodes){for(const node of nodes){node.remove();node.parent=this;this.children.push(node);}}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(node=>node!==this);this.parent=null;}
  before(node){this.parent?.append(node);}
  replaceWith(node){const parent=this.parent;this.remove();parent?.append(node);}
  replaceChildren(...nodes){for(const node of [...this.children])node.remove();this.append(...nodes);}
  setAttribute(name,value){this[name]=value;}
  querySelector(selector){if(!this.queries.has(selector)){const node=new Node();node.selector=selector;this.queries.set(selector,node);}return this.queries.get(selector);}
  querySelectorAll(){return [];}
  contains(node){return node===this||this.children.some(child=>child.contains(node));}
  closest(selector){return this.matches(selector)?this:this.parent?.closest(selector)||null;}
  matches(selector){return selector==='.'+this.className;}
  focus(){}
  get clientWidth(){return this.className==='face-photo-scroll'?view.width:this.getBoundingClientRect().width;}
  get clientHeight(){return this.className==='face-photo-scroll'?Math.min(view.height*.43,parseFloat(this.children[0]?.style.height)||0):this.getBoundingClientRect().height;}
  getBoundingClientRect(){
   if(this===stage||this.className==='face-photo-scroll')return {x:0,y:100,left:0,top:100,width:view.width,height:this===stage?270:this.clientHeight};
   if(this.className==='face-photo-surface'){const width=parseFloat(this.style.width),height=parseFloat(this.style.height),left=Math.max(0,(view.width-width)/2)-this.parent.scrollLeft,top=100-this.parent.scrollTop;return {x:left,y:top,left,top,width,height};}
   if(this===image)return this.parent?.className==='face-photo-surface'?this.parent.getBoundingClientRect():{x:0,y:100,left:0,top:100,width:360,height:270};
   return {x:0,y:0,left:0,top:0,width:280,height:240};
  }
 }
 const root=new Node(),stage=new Node(),image=new Node('img'),dialog=new Node();root.append(stage);stage.append(image);
 Object.assign(image,{naturalWidth:4000,naturalHeight:3000,complete:true});
 const document=new Node();document.documentElement={get clientWidth(){return view.width;}};document.getElementById=()=>dialog;document.createElement=tag=>new Node(tag);
 const window=new Node();window.FamilyApp={apiEnabled:true};window.FamilyTags={findPeople:async()=>[],flush:async()=>{}};window.FamilyI18n={isEnglish:false,personName:p=>p.name,error:v=>v,fetch:async()=>Response.json({faces:[]})};
 let progress;
 const detectorModule={detectFaces:async(key,img,signal,onProgress)=>{progress=onProgress;return detected;}};
 vm.runInNewContext(source,{window,document,geometryModule,detectorModule,crypto,AbortController,CustomEvent,Response,clearTimeout,setTimeout,matchMedia:()=>({matches:true}),innerWidth:view.width,innerHeight:view.height,getComputedStyle:()=>({maxHeight:String(view.height*.43)})});
 document.dispatchEvent(new Event('DOMContentLoaded'));
 const find=className=>created.find(node=>node.className===className&&node.parent);
 const emit=(node,type,properties={})=>{const event=new Event(type,{cancelable:true});for(const [key,value]of Object.entries(properties))Object.defineProperty(event,key,{value});node.dispatchEvent(event);};
 return {faces:window.FamilyFaces,stage,image,view,window,find,emit,get progress(){return progress;},async mount(id='photo',options={}){await window.FamilyFaces.mount(stage,image,{id,kind:'photo',tags:[]},options);}};
}
const first={rect:{x:.5,y:.4,width:.012,height:.016},score:.9},second={rect:{x:.517,y:.4,width:.012,height:.016},score:.9};

test('zoomed and scrolled image coordinates still select each of two tiny neighbouring faces',async()=>{
 const f=fixture([first,second]);await f.mount();
 const toolbar=f.find('face-zoom-toolbar'),scroll=f.find('face-photo-scroll'),surface=f.find('face-photo-surface'),selection=f.find('face-selection');
 assert.ok(toolbar);assert.equal(parseFloat(surface.style.width),360);
 for(let i=0;i<6;i++)f.emit(toolbar.querySelector('[data-face-zoom-in]'),'click');
 assert.equal(parseFloat(surface.style.width),2880);assert.equal(toolbar.querySelector('[data-face-zoom-level]').textContent,'800%');assert.equal(toolbar.querySelector('[data-face-zoom-in]').disabled,true);
 scroll.scrollLeft=1320;scroll.scrollTop=740;f.emit(scroll,'scroll');
 for(const face of [first,second]){
  const r=f.image.getBoundingClientRect();f.emit(f.stage,'click',{detail:1,clientX:r.left+(face.rect.x+face.rect.width/2)*r.width,clientY:r.top+(face.rect.y+face.rect.height/2)*r.height});
  assert.equal(selection.hidden,false);assert.equal(selection.style.left,face.rect.x*100+'%');assert.equal(selection.style.width,face.rect.width*100+'%');
 }
 f.emit(toolbar.querySelector('[data-face-zoom-reset]'),'click');assert.equal(parseFloat(surface.style.width),360);assert.equal(toolbar.querySelector('[data-face-zoom-level]').textContent,'100%');
 f.faces.clear();assert.equal(f.find('face-zoom-toolbar'),undefined);assert.equal(f.image.parent,f.stage);assert.equal(f.stage.classList.contains('has-face-zoom'),false);
});
test('drag scrolling does not create a face, and viewport resizing preserves normalized positions',async()=>{
 const f=fixture([first,second]);await f.mount();const toolbar=f.find('face-zoom-toolbar'),scroll=f.find('face-photo-scroll'),selection=f.find('face-selection');
 f.emit(toolbar.querySelector('[data-face-zoom-in]'),'click');f.emit(scroll,'pointerdown');scroll.scrollLeft=100;
 f.emit(f.stage,'click',{detail:1,clientX:150,clientY:220});assert.equal(selection.hidden,true);assert.equal(f.find('face-popover face-picker'),undefined);
 f.view.width=760;f.emit(f.window,'resize');const r=f.image.getBoundingClientRect();
 f.emit(f.stage,'click',{detail:1,clientX:r.left+(second.rect.x+second.rect.width/2)*r.width,clientY:r.top+(second.rect.y+second.rect.height/2)*r.height});
 assert.equal(selection.style.left,second.rect.x*100+'%');assert.equal(selection.style.height,second.rect.height*100+'%');f.faces.clear();
});
test('late incremental results from a closed photo cannot repaint the next photo',async()=>{
 const f=fixture([first]);await f.mount('first');const oldProgress=f.progress;f.faces.clear();await f.mount('next');
 const buttons=f.find('face-hit-buttons'),before=buttons.children.map(button=>button.dataset.faceId);oldProgress([second]);
 assert.deepEqual(buttons.children.map(button=>button.dataset.faceId),before);assert.equal(buttons.children[0].style.left,first.rect.x*100+'%');f.faces.clear();
});
test('incremental overlapping detections never give two face buttons the same selection identity',async()=>{
 const f=fixture([first]);await f.mount();const buttons=f.find('face-hit-buttons'),previous=buttons.children[0].dataset.faceId;
 f.progress([first,{rect:{...first.rect,x:first.rect.x+.001},score:.8}]);
 const ids=buttons.children.map(button=>button.dataset.faceId);assert.equal(ids[0],previous);assert.equal(new Set(ids).size,2);f.faces.clear();
});


test('only the partial gallery highlights missing faces and confirmed face labels remove individual markers',async()=>{
 const f=fixture([first,second]);await f.mount('partial-photo',{highlightMissing:true});
 const buttons=f.find('face-hit-buttons'),note=f.find('face-missing-note');assert.equal(buttons.children.filter(button=>button.classList.contains('face-missing')).length,2);assert.ok(note.textContent.includes('2'));
 const firstLabel={id:'a'.repeat(32),rect:first.rect,personId:'yona',person:{id:'yona',name:'יונה'}};
 f.window.dispatchEvent(new CustomEvent('family-media-changed',{detail:{operation:'faces',item:{id:'partial-photo',tagsRevision:'new'},faces:[firstLabel]}}));
 assert.equal(buttons.children.filter(button=>button.classList.contains('face-missing')).length,1);assert.equal(buttons.children.find(button=>button.classList.contains('face-missing')).style.left,second.rect.x*100+'%');
 const secondLabel={id:'b'.repeat(32),rect:second.rect,personId:'shlomo',person:{id:'shlomo',name:'שלמה'}};
 f.window.dispatchEvent(new CustomEvent('family-media-changed',{detail:{operation:'faces',item:{id:'partial-photo',tagsRevision:'last'},faces:[firstLabel,secondLabel]}}));
 assert.equal(buttons.children.filter(button=>button.classList.contains('face-missing')).length,0);assert.ok(note.textContent.includes('✓'));
 f.faces.clear();assert.equal(f.find('face-missing-note'),undefined);await f.mount('ordinary-photo');
 assert.equal(f.find('face-missing-note'),undefined);assert.equal(f.find('face-hit-buttons').children.some(button=>button.classList.contains('face-missing')),false);f.faces.clear();
});
