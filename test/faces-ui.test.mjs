import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as geometryModule from '../public/assets/face-geometry.mjs';

const source=(await readFile(new URL('../public/assets/faces.js',import.meta.url),'utf8'))
 .replace(/import\('\.\/face-geometry\.mjs\?v=\d+'\)/,'Promise.resolve(geometryModule)')
 .replace(/import\('\.\/face-detector\.mjs\?v=\d+'\)/,'Promise.resolve(detectorModule)');
function fixture(detected=[],{desktop=false}={}){
 const view={width:desktop?1200:360,height:800},created=[];
 class Node extends EventTarget{
  constructor(tag='div'){super();this.tagName=tag;this.children=[];this.queries=new Map();this.style={};this.dataset={};this.hidden=false;this.scrollLeft=0;this.scrollTop=0;this.className='';this.parent=null;created.push(this);}
  get classList(){return {contains:value=>this.className.split(' ').includes(value),add:(...values)=>{this.className=[...new Set([...this.className.split(' '),...values])].join(' ');},remove:(...values)=>{this.className=this.className.split(' ').filter(x=>!values.includes(x)).join(' ');}};}
  append(...nodes){for(const node of nodes){node.remove();node.parent=this;this.children.push(node);}}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(node=>node!==this);this.parent=null;}
  before(node){this.parent?.append(node);}
  insertBefore(node,anchor){node.remove();node.parent=this;const index=anchor?this.children.indexOf(anchor):this.children.length;this.children.splice(index,0,node);}
  replaceWith(node){const parent=this.parent;this.remove();parent?.append(node);}
  replaceChildren(...nodes){for(const node of [...this.children])node.remove();this.append(...nodes);}
  setAttribute(name,value){this[name]=value;}
  querySelector(selector){if(!this.queries.has(selector)){const node=new Node();node.selector=selector;this.queries.set(selector,node);}return this.queries.get(selector);}
  querySelectorAll(){return [];}
  contains(node){return node===this||[...this.children,...this.queries.values()].some(child=>child.contains(node));}
  closest(selector){return this.matches(selector)?this:this.parent?.closest(selector)||null;}
  matches(selector){return selector==='[data-face-handle]'?Boolean(this.dataset.faceHandle):selector==='.'+this.className;}
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
 const root=new Node(),stage=new Node(),image=new Node('img'),dialog=new Node(),title=new Node('h2'),download=new Node('a'),edit=new Node('button');root.append(title,stage);title.append(download,edit);stage.append(image);
 Object.assign(image,{naturalWidth:4000,naturalHeight:3000,complete:true});
 const document=new Node();document.documentElement={get clientWidth(){return view.width;}};document.getElementById=id=>id==='mediaViewerTitle'?title:id==='editOpenedPhoto'?edit:dialog;document.createElement=tag=>new Node(tag);
 const window=new Node();window.FamilyApp={apiEnabled:true};window.FamilyTags={findPeople:async()=>[],flush:async()=>{}};window.FamilyI18n={isEnglish:false,personName:p=>p.name,error:v=>v,fetch:async()=>Response.json({faces:[]})};
 let progress,detectionImage;
 const detectorModule={detectFaces:async(key,img,signal,onProgress)=>{progress=onProgress;detectionImage=img;return detected;}};
 vm.runInNewContext(source,{window,document,geometryModule,detectorModule,crypto,AbortController,CustomEvent,Response,clearTimeout,setTimeout,matchMedia:()=>({matches:!desktop}),innerWidth:view.width,innerHeight:view.height,getComputedStyle:()=>({maxHeight:String(view.height*.43)})});
 document.dispatchEvent(new Event('DOMContentLoaded'));
 const find=className=>created.findLast(node=>node.className===className&&node.parent);
 const emit=(node,type,properties={})=>{const event=new Event(type,{cancelable:true});for(const [key,value]of Object.entries(properties))Object.defineProperty(event,key,{value});node.dispatchEvent(event);};
 return {faces:window.FamilyFaces,stage,image,title,download,edit,view,window,document,find,emit,get progress(){return progress;},get detectionImage(){return detectionImage;},async mount(id='photo',options={},item={}){await window.FamilyFaces.mount(stage,image,{id,kind:'photo',tags:[],...item},options);}};
}
const first={rect:{x:.5,y:.4,width:.012,height:.016},score:.9},second={rect:{x:.517,y:.4,width:.012,height:.016},score:.9};

test('the upload wizard reuses face picking, frame editing and completion without a media write or gallery scan',async()=>{
 const f=fixture([first],{desktop:true}),requests=[],person={id:'yona',name:'יונה'},originalBitmap={width:6000,height:4000},saved={...first,id:'a'.repeat(32),personId:'yona',person};let reviewed=false,face=saved;
 const snapshot=()=>({item:{id:'upload-local',kind:'photo',faceSummary:{reviewed}},faces:[face]});
 const adapter={enabled:()=>true,load:async()=>snapshot(),findPeople:async()=>[],mapDetections:found=>found,save:async p=>{requests.push(p);face={...face,rect:p.rect};return {...snapshot(),face};},review:async p=>{reviewed=p.complete;return snapshot();}};
 f.window.FamilyI18n.fetch=async()=>{throw Error('Drafts must never write to the media API');};f.window.FamilyTags.flush=async()=>{throw Error('Drafts have no server tags');};f.image.tagName='canvas';f.image.complete=false;
 await f.mount('upload-local',{adapter,reviewHost:f.title,reviewLabel:true,zoom:false,detectionImage:originalBitmap});assert.equal(f.detectionImage,originalBitmap);assert.equal(f.find('face-zoom-toolbar'),undefined);assert.match(f.find('face-review-text').textContent,/אישור תיוג מלא/);
 const area=f.image.getBoundingClientRect(),selection=f.find('face-selection');f.emit(f.stage,'click',{detail:1,clientX:area.left+.506*area.width,clientY:area.top+.408*area.height});assert.ok(f.find('face-popover face-picker'));
 const handle=selection.children.find(node=>node.dataset.faceHandle==='se');f.emit(f.stage,'pointerdown',{target:handle,pointerId:1,clientX:area.left+.512*area.width,clientY:area.top+.416*area.height});f.emit(f.stage,'pointermove',{target:handle,pointerId:1,clientX:area.left+.52*area.width,clientY:area.top+.43*area.height});f.emit(f.stage,'pointerup',{target:handle,pointerId:1});await new Promise(resolve=>setImmediate(resolve));await f.faces.flush();assert.equal(requests.length,1);assert.equal(requests[0].personId,'yona');assert.ok(requests[0].rect.width>saved.rect.width);
 const button=f.find('face-review-button');f.emit(button,'click');await new Promise(resolve=>setImmediate(resolve));assert.equal(button['aria-pressed'],'true');assert.equal(reviewed,true);assert.match(f.find('face-review-text').textContent,/כל הפרצופים תויגו/);f.faces.clear();
});

test('face names open real profiles on desktop and touch; free names and unknown people stay plain text',async()=>{
 for(const desktop of [false,true])for(const kind of ['family','extra','unknown']){
  const f=fixture([],{desktop}),opened=[],person={id:kind==='family'?'yona':'extra-name',name:'יונה <קהא>',extra:kind==='extra'},face={...first,id:'named',personId:person.id,person};
  f.window.FamilyApp.getPerson=id=>kind==='unknown'?null:person;f.window.FamilyApp.openPerson=id=>opened.push(id);
  f.window.FamilyI18n.fetch=async()=>Response.json({faces:[face]});await f.mount();
  const hit=f.find('face-hit-buttons').children[0];f.emit(hit,'focus');const bubble=f.find('face-popover face-name');
  assert.match(bubble.innerHTML,/יונה &lt;קהא&gt;/);
  if(kind==='family'){
   assert.match(bubble.innerHTML,/href="#person\/yona"/);f.emit(bubble.querySelector('[data-face-profile]'),'click',{button:0});assert.deepEqual(opened,['yona']);
   if(!desktop){f.emit(bubble.querySelector('[data-face-edit]'),'click');assert.ok(f.find('face-popover face-picker'));assert.deepEqual(opened,['yona']);}
  }else{assert.doesNotMatch(bubble.innerHTML,/data-face-profile|<a /);assert.deepEqual(opened,[]);}
  f.faces.clear();
 }
});

test('moving from a face to its name keeps the link usable, keyboard focus retains it, and leaving dismisses it',async()=>{
 const f=fixture([],{desktop:true}),person={id:'yona',name:'יונה'},face={...first,id:'named',personId:'yona',person};
 f.window.FamilyApp.getPerson=()=>person;f.window.FamilyI18n.fetch=async()=>Response.json({faces:[face]});await f.mount();
 const hit=f.find('face-hit-buttons').children[0];f.emit(hit,'pointerenter',{pointerType:'mouse'});let bubble=f.find('face-popover face-name');
 f.emit(hit,'pointerleave',{pointerType:'mouse',relatedTarget:null});f.emit(bubble,'pointerenter');
 f.emit(f.document,'pointermove',{target:bubble.querySelector('[data-face-profile]'),clientX:0,clientY:0});
 await new Promise(resolve=>setTimeout(resolve,280));assert.equal(f.find('face-popover face-name'),bubble);
 const link=bubble.querySelector('[data-face-profile]');f.document.activeElement=link;f.emit(hit,'blur',{relatedTarget:link});
 f.emit(f.document,'pointermove',{target:f.stage,clientX:9999,clientY:9999});await new Promise(resolve=>setTimeout(resolve,280));assert.equal(f.find('face-popover face-name'),bubble);
 f.document.activeElement=null;f.emit(bubble,'focusout',{relatedTarget:null});assert.equal(f.find('face-popover face-name'),undefined);
 f.emit(hit,'pointerenter',{pointerType:'mouse'});bubble=f.find('face-popover face-name');f.emit(hit,'pointerleave',{pointerType:'mouse',relatedTarget:null});
 await new Promise(resolve=>setTimeout(resolve,280));assert.equal(f.find('face-popover face-name'),undefined);f.faces.clear();
});

test('all-name and age overlays follow labelled faces, hide unknown ages, reposition on zoom and clear between photos',async()=>{
 const f=fixture([],{desktop:true}),person={id:'yona',name:'יונה'},guest={id:'extra-guest',name:'אורח',extra:true},faces=[{...first,id:'known',personId:person.id,person},{...second,id:'guest',personId:guest.id,person:guest}];
 let state={showNames:false,showAges:false};const opened=[];
 f.window.FamilyApp.getPerson=id=>id==='yona'?person:guest;f.window.FamilyApp.openPerson=id=>opened.push(id);
 f.window.FamilyPhotoDate={overlays:()=>state,ageFor:p=>p.id==='yona'?{text:'58',title:'גיל משוער'}:null};
 f.window.FamilyI18n.fetch=async()=>Response.json({faces});await f.mount('all-labels');const host=f.find('face-visible-labels');assert.equal(host.children.length,0);
 const toggle=next=>{state=next;f.window.dispatchEvent(new CustomEvent('family-photo-overlays-changed',{detail:{id:'all-labels'}}));};
 toggle({showNames:true,showAges:false});assert.equal(host.children.length,2);assert.match(host.children[0].innerHTML,/href="#person\/yona"/);assert.doesNotMatch(host.children[1].innerHTML,/<a /);
 f.emit(host.children[0].querySelector('[data-face-profile]'),'click',{button:0});assert.deepEqual(opened,['yona']);
 toggle({showNames:false,showAges:true});assert.equal(host.children.length,1);assert.match(host.children[0].innerHTML,/58/);assert.doesNotMatch(host.children[0].innerHTML,/יונה/);
 const before=parseFloat(host.children[0].style.left);f.emit(f.find('face-zoom-toolbar').querySelector('[data-face-zoom-in]'),'click');assert.ok(parseFloat(host.children[0].style.left)>before);
 toggle({showNames:true,showAges:true});assert.equal(host.children.length,2);assert.match(host.children[0].innerHTML,/יונה.*58/);assert.doesNotMatch(host.children[1].innerHTML,/face-visible-age/);
 toggle({showNames:false,showAges:false});assert.equal(host.children.length,0);f.faces.clear();assert.equal(f.find('face-layer'),undefined);
});

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


test('all-faces confirmation is available in ordinary and partial gallery photos, saves before hiding markers and supports undo',async()=>{
 for(const highlightMissing of [false,true]){
  const f=fixture([first,second]),requests=[];
  f.window.FamilyI18n.fetch=async(path,options)=>{
   requests.push({path,options});
   if(path.endsWith('/review')){const body=JSON.parse(options.body);return Response.json({saved:true,operation:'face-review',item:{id:'reviewed',scope:'gallery',kind:'photo',tagsRevision:'tags-1',faceSummary:{reviewed:body.complete,partial:!body.complete}}});}
   return Response.json({faces:[],item:{id:'reviewed',scope:'gallery',kind:'photo',tagsRevision:'tags-1'}});
  };
  await f.mount('reviewed',{highlightMissing},{scope:'gallery',tagsRevision:'tags-1'});
  const button=f.find('face-review-button'),hits=f.find('face-hit-buttons');assert.ok(button);assert.equal(button['aria-pressed'],'false');assert.match(button['aria-label'],/אישור/);assert.deepEqual(f.title.children,[f.download,button,f.edit]);assert.equal(hits.children.length,2);
  f.emit(button,'click');await new Promise(resolve=>setImmediate(resolve));
  const review=requests.find(r=>r.path.endsWith('/review'));assert.deepEqual(JSON.parse(review.options.body),{complete:true,photoRevision:'original',tagsRevision:'tags-1'});assert.equal(hits.children.length,0);assert.equal(button['aria-pressed'],'true');assert.match(button['aria-label'],/ביטול/);assert.equal(f.find('face-review-status').hidden,true);assert.equal(button.disabled,false);
  f.emit(button,'click');await new Promise(resolve=>setImmediate(resolve));assert.equal(hits.children.length,2);assert.equal(button['aria-pressed'],'false');assert.match(button['aria-label'],/אישור/);assert.deepEqual(f.title.children,[f.download,button,f.edit]);
  f.faces.clear();assert.deepEqual(f.title.children,[f.download,f.edit]);f.window.FamilyI18n.fetch=async()=>Response.json({faces:[],item:{id:'next-photo',faceSummary:{reviewed:true}}});await f.mount('next-photo',{}, {scope:'gallery',faceSummary:{reviewed:true}});assert.equal(f.find('face-review-button')['aria-pressed'],'true');assert.equal(f.title.children.length,3);f.faces.clear();
 }
});

test('a failed completion confirmation leaves the photo markers and retry button intact',async()=>{
 const f=fixture([first]);f.window.FamilyI18n.fetch=async(path)=>path.endsWith('/review')?Response.json({error:'Connection lost'},{status:503}):Response.json({faces:[]});
 await f.mount('retry',{}, {scope:'gallery'});const button=f.find('face-review-button');f.emit(button,'click');await new Promise(resolve=>setImmediate(resolve));assert.equal(f.find('face-hit-buttons').children.length,1);assert.equal(button.disabled,false);assert.match(f.find('face-review-status').textContent,/Connection lost/);assert.equal(f.find('face-review-status').hidden,false);assert.equal(button['aria-pressed'],'false');
});

test('desktop frame handles save new geometry with the same person, face identity and concurrency revision',async()=>{
 const original={id:'a'.repeat(32),rect:{x:.3,y:.2,width:.1,height:.15},personId:'yona',person:{id:'yona',name:'יונה'},revision:'face-r1'},requests=[];
 const f=fixture([],{desktop:true});
 f.window.FamilyI18n.fetch=async(path,options)=>{
  if(path.endsWith('/save')){const body=JSON.parse(options.body);requests.push(body);const face={...original,rect:body.rect,revision:'face-r2'};return Response.json({operation:'faces',scope:'gallery',item:{id:'resizable',kind:'photo',tagsRevision:'t2'},faces:[face],face});}
  return Response.json({faces:[original]});
 };
 await f.mount('resizable');const area=f.image.getBoundingClientRect(),selection=f.find('face-selection');assert.equal(selection.children.length,8);
 f.emit(f.stage,'click',{detail:1,clientX:area.left+.35*area.width,clientY:area.top+.25*area.height});
 const handle=selection.children.find(node=>node.dataset.faceHandle==='se');
 f.emit(f.stage,'pointerdown',{target:handle,pointerId:1,clientX:area.left+.4*area.width,clientY:area.top+.35*area.height});
 f.emit(f.stage,'pointermove',{target:handle,pointerId:1,clientX:area.left+.43*area.width,clientY:area.top+.39*area.height});
 f.emit(f.stage,'pointerup',{target:handle,pointerId:1});await new Promise(resolve=>setImmediate(resolve));
 assert.equal(requests.length,1);assert.equal(requests[0].personId,'yona');assert.equal(requests[0].faceId,original.id);assert.equal(requests[0].expectedRevision,'face-r1');
 assert.ok(Math.abs(requests[0].rect.width-.13)<1e-10);assert.ok(Math.abs(requests[0].rect.height-.19)<1e-10);assert.deepEqual(original.rect,{x:.3,y:.2,width:.1,height:.15});
 assert.equal(f.find('face-hit-buttons').children.length,1);f.faces.clear();
});
test('desktop resizing works after zoom and late detections keep the adjusted box; phones have no resize handles',async()=>{
 const f=fixture([first,second],{desktop:true});await f.mount();const toolbar=f.find('face-zoom-toolbar');f.emit(toolbar.querySelector('[data-face-zoom-in]'),'click');
 const area=f.image.getBoundingClientRect(),selection=f.find('face-selection');f.emit(f.stage,'click',{detail:1,clientX:area.left+.506*area.width,clientY:area.top+.408*area.height});
 const handle=selection.children.find(node=>node.dataset.faceHandle==='nw');
 f.emit(f.stage,'pointerdown',{target:handle,pointerId:1,clientX:area.left+.5*area.width,clientY:area.top+.4*area.height});
 f.emit(f.stage,'pointermove',{target:handle,pointerId:1,clientX:area.left+.497*area.width,clientY:area.top+.395*area.height});f.emit(f.stage,'pointerup',{target:handle,pointerId:1});await new Promise(resolve=>setImmediate(resolve));
 const width=parseFloat(selection.style.width);assert.ok(Math.abs(width-1.5)<1e-8);f.progress([first,second]);assert.ok(Math.abs(parseFloat(f.find('face-hit-buttons').children[0].style.width)-1.5)<1e-8);
 f.faces.clear();const phone=fixture([first]);await phone.mount();assert.equal(phone.find('face-selection').children.length,0);phone.faces.clear();
});
test('ignoring one false detection is photo-specific, survives reopening, and Undo restores the region',async()=>{
 const f=fixture([first,second]),requests=[];let ignored=[];
 f.window.FamilyI18n.fetch=async(path,options)=>{
  if(path.endsWith('/ignore')){const body=JSON.parse(options.body);requests.push(body);ignored=body.ignored?[body.rect]:[];return Response.json({saved:true,operation:'face-ignore',item:{id:'ignored-photo',kind:'photo'},faces:[],detectedFaces:body.ignored?[second]:[first,second],ignoredFaces:ignored});}
  return Response.json({faces:[],ignoredFaces:ignored,detectedFaces:[first,second]});
 };
 await f.mount('ignored-photo');let area=f.image.getBoundingClientRect();f.emit(f.stage,'click',{detail:1,clientX:area.left+.506*area.width,clientY:area.top+.408*area.height});
 f.emit(f.find('face-popover face-picker').querySelector('[data-face-ignore]'),'click');await new Promise(resolve=>setImmediate(resolve));assert.equal(requests[0].ignored,true);assert.equal(requests[0].photoRevision,'original');assert.equal(f.find('face-hit-buttons').children.length,1);assert.equal(f.find('face-zoom-toolbar').querySelector('[data-face-ignore-undo]').hidden,false);
 f.faces.clear();await f.mount('ignored-photo');assert.equal(f.find('face-hit-buttons').children.length,1);
 f.emit(f.find('face-zoom-toolbar').querySelector('[data-face-ignore-undo]'),'click');await new Promise(resolve=>setImmediate(resolve));assert.equal(requests.at(-1).ignored,false);assert.equal(f.find('face-hit-buttons').children.length,2);
 f.faces.clear();await f.mount('other-photo');assert.equal(f.find('face-hit-buttons').children.length,2);f.faces.clear();
});
