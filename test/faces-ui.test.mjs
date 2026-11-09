import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as geometryModule from '../public/assets/face-geometry.mjs';
import {crowdPhotoFaces} from './helpers/crowd-photo.mjs';

const source=(await readFile(new URL('../public/assets/faces.js',import.meta.url),'utf8'))
 .replace(/import\('\.\/face-geometry\.mjs\?v=\d+'\)/,'Promise.resolve(geometryModule)')
 .replace(/import\('\.\/face-detector\.mjs\?v=\d+'\)/,'Promise.resolve(detectorModule)');
function fixture(detected=[],{desktop=false}={}){
 const view={width:desktop?1200:360,height:800},created=[];
 class Node extends EventTarget{
  constructor(tag='div'){super();this.tagName=tag;this.children=[];this.queries=new Map();this.style={};this.dataset={};this.hidden=false;this.scrollLeft=0;this.scrollTop=0;this.className='';this.parent=null;created.push(this);}
  get parentNode(){return this.parent;}
  get isConnected(){return this===document||Boolean(this.parent?.isConnected);}
  get classList(){return {toggle:(value,force)=>{const enabled=force??!this.className.split(' ').includes(value);this.classList[enabled?'add':'remove'](value);return enabled;},contains:value=>this.className.split(' ').includes(value),add:(...values)=>{this.className=[...new Set([...this.className.split(' '),...values])].join(' ');},remove:(...values)=>{this.className=this.className.split(' ').filter(x=>!values.includes(x)).join(' ');}};}
  append(...nodes){for(const node of nodes){node.remove();node.parent=this;this.children.push(node);}}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(node=>node!==this);this.parent=null;}
  before(node){this.parent?.append(node);}
  insertBefore(node,anchor){node.remove();node.parent=this;const index=anchor?this.children.indexOf(anchor):this.children.length;this.children.splice(index,0,node);}
  replaceWith(node){const parent=this.parent;this.remove();parent?.append(node);}
  replaceChildren(...nodes){for(const node of [...this.children])node.remove();this.append(...nodes);}
  setAttribute(name,value){this[name]=value;}
  querySelector(selector){if(!this.queries.has(selector)){const node=new Node();node.selector=selector;this.queries.set(selector,node);}return this.queries.get(selector);}
  querySelectorAll(selector){const nodes=[...this.children,...this.queries.values()];return nodes.flatMap(node=>[...(node.matches(selector)?[node]:[]),...node.querySelectorAll(selector)]);}
  contains(node){return node===this||[...this.children,...this.queries.values()].some(child=>child.contains(node));}
  closest(selector){return this.matches(selector)?this:this.parent?.closest(selector)||null;}
  matches(selector){return selector.split(',').some(value=>{value=value.trim();if(value.startsWith('.'))return this.classList.contains(value.slice(1));if(value==='[data-face-handle]')return Boolean(this.dataset.faceHandle);if(value==='dialog[open]')return this.tagName.toLowerCase()==='dialog'&&this.open;if(value==='[hidden]')return this.hidden;if(value==='[inert]')return Boolean(this.inert);if(value==='[aria-hidden="true"]')return this['aria-hidden']==='true';if(value==='[role="textbox"]')return this.role==='textbox';return ['input','textarea','select'].includes(value)&&this.tagName.toLowerCase()===value;});}
  focus(){}
  click(){this.dispatchEvent(new Event('click',{cancelable:true}));}
  getClientRects(){return this.closest('[hidden]')?[]:[this.getBoundingClientRect()];}
  get clientWidth(){return this.className==='face-photo-scroll'?view.width:this.getBoundingClientRect().width;}
  get clientHeight(){return this.className==='face-photo-scroll'?Math.min(view.height*.43,parseFloat(this.children[0]?.style.height)||0):this.getBoundingClientRect().height;}
  getBoundingClientRect(){
   if(this===stage||this.className==='face-photo-scroll')return {x:0,y:100,left:0,top:100,width:view.width,height:this===stage?270:this.clientHeight};
   if(this.className==='face-photo-surface'){const width=parseFloat(this.style.width),height=parseFloat(this.style.height),left=Math.max(0,(view.width-width)/2)-this.parent.scrollLeft,top=100-this.parent.scrollTop;return {x:left,y:top,left,top,width,height};}
   if(this===image)return this.parent?.className==='face-photo-surface'?this.parent.getBoundingClientRect():{x:0,y:100,left:0,top:100,width:360,height:270};
   if(this.classList.contains('face-visible-label'))return {x:0,y:0,left:0,top:0,width:90,height:24};
   return {x:0,y:0,left:0,top:0,width:280,height:240};
  }
 }
 const root=new Node(),stage=new Node(),image=new Node('img'),dialog=new Node('dialog'),title=new Node('h2'),download=new Node('a'),edit=new Node('button');dialog.open=true;dialog.append(root);root.append(title,stage);title.append(download,edit);stage.append(image);
 Object.assign(image,{naturalWidth:4000,naturalHeight:3000,complete:true});
 const document=new Node();document.body=new Node('body');document.append(document.body);document.body.append(dialog);document.documentElement={get clientWidth(){return view.width;}};document.getElementById=id=>id==='mediaViewerTitle'?title:id==='editOpenedPhoto'?edit:dialog;document.createElement=tag=>new Node(tag);
 const window=new Node();window.FamilyApp={apiEnabled:true};window.FamilyTags={findPeople:async()=>[],flush:async()=>{}};window.FamilyI18n={isEnglish:false,personName:p=>p.name,error:v=>v,fetch:async()=>Response.json({faces:[]})};
 let progress,detectionImage;
 const detectorModule={detectFaces:async(key,img,signal,onProgress)=>{progress=onProgress;detectionImage=img;return detected;}};
 const reboot=()=>vm.runInNewContext(source,{window,document,geometryModule,detectorModule,crypto,AbortController,CustomEvent,Response,clearTimeout,setTimeout,matchMedia:()=>({matches:!desktop}),innerWidth:view.width,innerHeight:view.height,getComputedStyle:()=>({maxHeight:String(view.height*.43)})});reboot();
 document.dispatchEvent(new Event('DOMContentLoaded'));
 const find=className=>created.findLast(node=>node.className===className&&node.parent);
 const emit=(node,type,properties={})=>{const event=new Event(type,{cancelable:true});for(const [key,value]of Object.entries(properties))Object.defineProperty(event,key,{value});node.dispatchEvent(event);return event;};
 return {faces:window.FamilyFaces,stage,image,title,download,edit,view,window,document,dialog,reboot,find,emit,get progress(){return progress;},get detectionImage(){return detectionImage;},async mount(id='photo',options={},item={}){await window.FamilyFaces.mount(stage,image,{id,kind:'photo',tags:[],...item},options);}};
}
const first={rect:{x:.5,y:.4,width:.012,height:.016},score:.9},second={rect:{x:.517,y:.4,width:.012,height:.016},score:.9};

test('repeated metadata refreshes reuse one face viewer and remove leftover external controls',async()=>{
 const f=fixture([first]),options={highlightMissing:true},item={scope:'gallery',tagsRevision:'t1'};await f.mount('dated',options,item);
 const toolbar=f.find('face-zoom-toolbar'),review=f.find('face-review-button'),note=f.find('face-missing-note');f.emit(toolbar.querySelector('[data-face-zoom-in]'),'click');
 for(const year of [2006,2007,2008]){
  // Simulate controls left outside the stage by an interrupted older render.
  for(const name of ['face-zoom-toolbar','face-missing-note','face-review-button','face-review-status']){const orphan=f.document.createElement('div');orphan.className=name;(name==='face-review-button'?f.title:f.dialog).append(orphan);}
  f.faces.update({id:'dated',kind:'photo',...item,takenDate:{year}});
  await f.mount('dated',options,{...item,takenDate:{year}});
  for(const name of ['face-zoom-toolbar','face-missing-note','face-review-button','face-review-status'])assert.equal(f.dialog.querySelectorAll('.'+name).length,1,name);
  assert.equal(f.find('face-zoom-toolbar'),toolbar);assert.equal(f.find('face-review-button'),review);assert.equal(f.find('face-missing-note'),note);assert.equal(toolbar.querySelector('[data-face-zoom-level]').textContent,'150%');
 }
 f.faces.clear();for(const name of ['face-zoom-toolbar','face-missing-note','face-review-button','face-review-status'])assert.equal(f.dialog.querySelectorAll('.'+name).length,0,name);
});

test('stage ownership disposes a previous face controller and ignores its delayed detections',async()=>{
 const f=fixture([first]);await f.mount('dated',{highlightMissing:true},{scope:'gallery'});const oldProgress=f.progress,oldToolbar=f.find('face-zoom-toolbar');
 f.reboot();await f.mount('dated',{highlightMissing:true},{scope:'gallery',takenDate:{year:2006}});assert.equal(oldToolbar.parent,null);
 const hits=f.find('face-hit-buttons'),before=hits.children.map(node=>node.dataset.faceId);oldProgress([second]);assert.deepEqual(hits.children.map(node=>node.dataset.faceId),before);
 for(const name of ['face-zoom-toolbar','face-missing-note','face-review-button','face-review-status'])assert.equal(f.dialog.querySelectorAll('.'+name).length,1,name);
 f.window.FamilyFaces.clear();assert.equal(f.dialog.querySelectorAll('.face-zoom-toolbar').length,0);assert.equal(f.title.children.length,2);
});

test('metadata received before face controls are ready is retained without interrupting mounting',async()=>{
 const f=fixture(),pending=f.mount('dated',{highlightMissing:true},{scope:'gallery'});
 assert.doesNotThrow(()=>f.faces.update({id:'dated',kind:'photo',scope:'gallery',takenDate:{year:2006},faceSummary:{reviewed:true}}));await pending;
 assert.equal(f.find('face-review-button')['aria-pressed'],'true');assert.equal(f.find('face-missing-note').hidden,true);assert.equal(f.dialog.querySelectorAll('.face-zoom-toolbar').length,1);f.faces.clear();
});

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

test('editing an existing face survives focus leaving its former name bubble on desktop and touch',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 for(const desktop of [false,true]){
  const f=fixture([],{desktop}),person={id:'yona',name:'יונה'},face={...first,id:'named',personId:person.id,person,revision:'face-1'};
  f.window.FamilyI18n.fetch=async()=>Response.json({faces:[face]});await f.mount();
  const hit=f.find('face-hit-buttons').children[0];f.emit(hit,'focus');const bubble=f.find('face-popover face-name');
  if(desktop)f.emit(f.stage,'click',{detail:0,target:hit});else{
   const edit=bubble.querySelector('[data-face-edit]');f.emit(edit,'pointerdown',{pointerType:'touch'});t.mock.timers.tick(2500);assert.equal(f.find('face-popover face-name'),bubble,'A pressed pencil must survive the name timeout until its click');f.emit(edit,'click');
  }
  const panel=f.find('face-popover face-picker');assert.ok(panel);assert.match(panel.innerHTML,/הסרת התיוג הזה/);
  // Removing a focused label can deliver its focusout after the editor opens.
  f.emit(bubble,'focusout',{relatedTarget:panel.querySelector('input')});f.emit(hit,'blur',{relatedTarget:panel.querySelector('input')});
  assert.equal(f.find('face-popover face-picker'),panel,'The previous label must not dismiss the new editor');
  t.mock.timers.tick(2500);assert.equal(f.find('face-popover face-picker'),panel,'The name timer must not close the editor');
  f.emit(panel.querySelector('[data-face-close]'),'click');assert.equal(f.find('face-popover face-picker'),undefined);
  f.faces.clear();
 }
});

test('existing face names can be changed and reopened with the same face identity in every shared viewer',async()=>{
 for(const desktop of [false,true])for(const scope of ['photos','gallery','personal:yona','wedding:parents','nostalgia']){
  const f=fixture([],{desktop}),before={id:'yona',name:'יונה'},after={id:'shlomo',name:'שלמה'},requests=[];let face={...first,id:'saved-face',personId:before.id,person:before,revision:'face-1'};
  f.window.FamilyI18n.fetch=async(path,options)=>{
   if(path.endsWith('/save')){const payload=JSON.parse(options.body);requests.push(payload);face={...face,personId:payload.personId,person:after,revision:'face-2'};return Response.json({operation:'faces',scope,item:{id:'retag',kind:'photo',scope,tags:[after],tagsRevision:'t2'},faces:[face],face});}
   return Response.json({faces:[face]});
  };
  f.window.FamilyTags.findPeople=async()=>[after];await f.mount('retag',{}, {scope,tags:[before]});
  const open=()=>{const hit=f.find('face-hit-buttons').children[0];if(desktop)f.emit(f.stage,'click',{detail:0,target:hit});else{f.emit(hit,'focus');f.emit(f.find('face-popover face-name').querySelector('[data-face-edit]'),'click');}};
  open();let panel=f.find('face-popover face-picker');const host=panel.querySelector('[data-face-results]'),option=f.document.createElement('button');option.dataset.facePerson=after.id;
  host.querySelectorAll=selector=>selector==='[data-face-person]'?[option]:[];
  await new Promise(resolve=>setImmediate(resolve));assert.match(host.innerHTML,/שלמה/);f.emit(option,'click');await f.faces.flush();
  assert.equal(requests.length,1);assert.equal(requests[0].faceId,'saved-face');assert.equal(requests[0].expectedRevision,'face-1');assert.equal(requests[0].personId,'shlomo');
  f.faces.dismiss();open();panel=f.find('face-popover face-picker');assert.match(panel.innerHTML,/שלמה/);assert.match(panel.innerHTML,/הסרת התיוג הזה/);f.faces.clear();
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
 f.window.FamilyI18n.fetch=async()=>Response.json({faces});await f.mount('all-labels');const host=f.find('face-visible-labels'),visible=()=>host.children.filter(node=>node.classList.contains('face-visible-label'));assert.equal(visible().length,0);
 const toggle=next=>{state=next;f.window.dispatchEvent(new CustomEvent('family-photo-overlays-changed',{detail:{id:'all-labels'}}));};
 toggle({showNames:true,showAges:false});assert.equal(visible().length,2);assert.match(visible()[0].innerHTML,/href="#person\/yona"/);assert.doesNotMatch(visible()[1].innerHTML,/<a /);
 f.emit(visible()[0].querySelector('[data-face-profile]'),'click',{button:0});assert.deepEqual(opened,['yona']);
 toggle({showNames:false,showAges:true});assert.equal(visible().length,1);assert.match(visible()[0].innerHTML,/58/);assert.doesNotMatch(visible()[0].innerHTML,/יונה/);
 const before=parseFloat(visible()[0].style.left);f.emit(f.find('face-zoom-toolbar').querySelector('[data-face-zoom-in]'),'click');assert.ok(parseFloat(visible()[0].style.left)>before);
 toggle({showNames:true,showAges:true});assert.equal(visible().length,2);assert.match(visible()[0].innerHTML,/יונה.*58/);assert.doesNotMatch(visible()[1].innerHTML,/face-visible-age/);
 toggle({showNames:false,showAges:false});assert.equal(visible().length,0);f.faces.clear();assert.equal(f.find('face-layer'),undefined);
});

test('age-only overlays also avoid an unlabelled face above their person',async()=>{
 const obstacle={rect:{x:.3,y:.1,width:.35,height:.3},score:.95},person={id:'one',name:'אדם'},face={id:'named',rect:{x:.4,y:.5,width:.15,height:.15},personId:'one',person},f=fixture([obstacle]);
 f.window.FamilyI18n.fetch=async()=>Response.json({faces:[face]});f.window.FamilyPhotoDate={overlays:()=>({showNames:false,showAges:true}),ageFor:()=>({text:'25',title:'גיל'})};await f.mount();
 const host=f.find('face-visible-labels'),label=host.children.find(node=>node.classList.contains('face-visible-label'));
 assert.ok(parseFloat(label.style.top)>=(face.rect.y+face.rect.height)*270,JSON.stringify(label.style));assert.match(label.innerHTML,/25/);assert.doesNotMatch(label.innerHTML,/אדם/);f.faces.clear();
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
test('ignoring one false detection disappears immediately, stays hidden after reopening and has no Undo control',async()=>{
 const f=fixture([first,second]),requests=[];let ignored=[];
 f.window.FamilyI18n.fetch=async(path,options)=>{
  if(path.endsWith('/ignore')){const body=JSON.parse(options.body);requests.push(body);ignored=body.ignored?[body.rect]:[];return Response.json({saved:true,operation:'face-ignore',item:{id:'ignored-photo',kind:'photo'},faces:[],detectedFaces:body.ignored?[second]:[first,second],ignoredFaces:ignored});}
  return Response.json({faces:[],ignoredFaces:path.includes('ignored-photo')?ignored:[],detectedFaces:[first,second]});
 };
 await f.mount('ignored-photo');let area=f.image.getBoundingClientRect();f.emit(f.stage,'click',{detail:1,clientX:area.left+.506*area.width,clientY:area.top+.408*area.height});
 f.emit(f.find('face-popover face-picker').querySelector('[data-face-ignore]'),'click');assert.equal(f.find('face-hit-buttons').children.length,1);assert.equal(f.find('face-popover face-picker'),undefined);await f.faces.flush();assert.equal(requests[0].ignored,true);assert.equal(requests[0].photoRevision,'original');assert.equal(f.find('face-hit-buttons').children.length,1);assert.doesNotMatch(f.find('face-zoom-toolbar').innerHTML,/data-face-ignore-undo/);
 f.faces.clear();await f.mount('ignored-photo');assert.equal(f.find('face-hit-buttons').children.length,1);
 assert.doesNotMatch(f.find('face-zoom-toolbar').innerHTML,/data-face-ignore-undo/);assert.equal(requests.length,1);
 f.faces.clear();await f.mount('other-photo');assert.equal(f.find('face-hit-buttons').children.length,2);f.faces.clear();
});

test('removing one duplicate face immediately renumbers the legend and markers, retains the other occurrence and survives late scans',async()=>{
 const faces=Array.from({length:26},(_,i)=>({id:String(i+1).padStart(32,'0'),revision:'r'+i,rect:{x:.05+(i%6)*.15,y:.05+Math.floor(i/6)*.18,width:.05,height:.06},personId:i===20?'maya':'person-'+i,person:{id:i===20?'maya':'person-'+i,name:i===17||i===20?'מאיה':'אדם '+i}}));faces[17].personId='maya';faces[17].person.id='maya';
 const f=fixture(faces.map(face=>({rect:face.rect,score:.95}))),requests=[],removed=faces[20];let saved=faces,ignored=[],finish;
 f.window.FamilyPhotoDate={overlays:()=>({showNames:true})};
 f.window.FamilyI18n.fetch=async(path,options)=>{if(path.endsWith('/ignore')){requests.push(JSON.parse(options.body));await new Promise(resolve=>finish=resolve);saved=faces.filter(face=>face!==removed);ignored=[removed.rect];return Response.json({operation:'face-ignore',item:{id:'duplicates',kind:'photo'},faces:saved,detectedFaces:saved.map(face=>({rect:face.rect})),ignoredFaces:ignored});}return Response.json({faces:saved,ignoredFaces:ignored});};
 await f.mount('duplicates');const legend=f.find('face-label-list'),annotations=f.find('face-visible-labels');assert.equal(legend.children.length,26);
 const area=f.image.getBoundingClientRect();f.emit(f.stage,'click',{detail:1,clientX:area.left+(removed.rect.x+.025)*area.width,clientY:area.top+(removed.rect.y+.03)*area.height});f.emit(f.find('face-popover face-name').querySelector('[data-face-edit]'),'click');
 f.emit(f.find('face-popover face-picker').querySelector('[data-face-remove]'),'click');assert.equal(legend.children.length,25);assert.equal(f.find('face-hit-buttons').children.length,25);assert.equal(f.find('face-popover face-picker'),undefined);
 const checkNumbers=()=>{assert.deepEqual(legend.children.map(node=>Number(/face-label-number[^>]*>(\d+)/.exec(node.innerHTML)[1])),Array.from({length:25},(_,i)=>i+1));assert.deepEqual(annotations.children.filter(node=>node.className==='face-label-marker').map(node=>node.textContent),Array.from({length:25},(_,i)=>i+1));assert.equal(legend.children.filter(node=>node.innerHTML.includes('מאיה')).length,1);};checkNumbers();
 await new Promise(resolve=>setImmediate(resolve));assert.equal(requests[0].faceId,removed.id);assert.equal(requests[0].expectedRevision,removed.revision);f.window.dispatchEvent(new CustomEvent('family-media-changed',{detail:{operation:'faces',item:{id:'duplicates',kind:'photo'},faces,ignoredFaces:[]}}));checkNumbers();assert.equal(f.find('face-hit-buttons').children.length,25);finish();await f.faces.flush();checkNumbers();
 f.progress(faces.map(face=>({rect:face.rect,score:.95})));assert.equal(f.find('face-hit-buttons').children.length,25);checkNumbers();f.faces.clear();await f.mount('duplicates');assert.equal(f.find('face-label-list').children.length,25);assert.doesNotMatch(f.find('face-zoom-toolbar').innerHTML,/data-face-ignore-undo/);f.faces.clear();
});

test('a failed removal restores the face and label without confirming or offering Undo',async()=>{
 const person={id:'maya',name:'מאיה'},face={...first,id:'a'.repeat(32),revision:'current',personId:person.id,person},f=fixture([first]);
 f.window.FamilyPhotoDate={overlays:()=>({showNames:true})};f.window.FamilyI18n.fetch=async path=>path.endsWith('/ignore')?Response.json({error:'Connection lost'},{status:503}):Response.json({faces:[face]});await f.mount();
 const area=f.image.getBoundingClientRect();f.emit(f.stage,'click',{detail:1,clientX:area.left+.506*area.width,clientY:area.top+.408*area.height});f.emit(f.find('face-popover face-name').querySelector('[data-face-edit]'),'click');f.emit(f.find('face-popover face-picker').querySelector('[data-face-remove]'),'click');assert.equal(f.find('face-hit-buttons').children.length,0);await f.faces.flush();assert.equal(f.find('face-hit-buttons').children.length,1);assert.equal(f.find('face-visible-labels').children.filter(node=>node.className==='face-visible-label').length,1);assert.doesNotMatch(f.find('face-zoom-toolbar').innerHTML,/data-face-ignore-undo/);f.faces.clear();
});

test('touching a saved face shows its name for two seconds, and another face replaces the previous label immediately',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const faces=[{id:'one',rect:{x:.1,y:.2,width:.1,height:.1},personId:'one',person:{id:'one',name:'אחד'}},{id:'two',rect:{x:.7,y:.2,width:.1,height:.1},personId:'two',person:{id:'two',name:'שתיים'}}],f=fixture();f.window.FamilyI18n.fetch=async()=>Response.json({faces});await f.mount();
 const tap=x=>{const area=f.image.getBoundingClientRect();f.emit(f.stage,'click',{detail:1,pointerType:'touch',clientX:area.left+x*area.width,clientY:area.top+.25*area.height});};
 tap(.15);let bubble=f.find('face-popover face-name');assert.match(bubble.innerHTML,/אחד/);f.emit(bubble,'pointerenter');f.emit(bubble,'focusin');t.mock.timers.tick(1999);assert.equal(f.find('face-popover face-name'),bubble);t.mock.timers.tick(1);assert.equal(f.find('face-popover face-name'),undefined);
 tap(.15);const previous=f.find('face-popover face-name');t.mock.timers.tick(400);tap(.75);bubble=f.find('face-popover face-name');assert.notEqual(bubble,previous);assert.equal(previous.parent,null);assert.match(bubble.innerHTML,/שתיים/);t.mock.timers.tick(1600);assert.equal(f.find('face-popover face-name'),bubble);t.mock.timers.tick(400);assert.equal(f.find('face-popover face-name'),undefined);f.faces.clear();
});
test('dense all-name overlays fall back to a numbered legend and return to the photo when zoom makes room',async()=>{
 const faces=Array.from({length:60},(_,i)=>({id:String(i),rect:{x:.08+(i%6)*.15,y:.06+Math.floor(i/6)*.09,width:.055,height:.05},personId:'person-'+i,person:{id:'person-'+i,name:'בן משפחה '+i}})),f=fixture();f.window.FamilyI18n.fetch=async()=>Response.json({faces});f.window.FamilyPhotoDate={overlays:()=>({showNames:true})};await f.mount();
 const legend=f.find('face-label-list');assert.equal(legend.hidden,false);assert.equal(legend.children.length,60);assert.ok(legend.children.every(node=>node.innerHTML.includes('face-label-number')));
 for(let i=0;i<6;i++)f.emit(f.find('face-zoom-toolbar').querySelector('[data-face-zoom-in]'),'click');assert.equal(legend.hidden,true);assert.equal(legend.children.length,0);assert.equal(f.find('face-visible-labels').children.filter(node=>node.classList.contains('face-visible-label')).length,60);f.faces.clear();assert.equal(f.find('face-label-list'),undefined);
});

test('crowd numbers locate and highlight their own face on hover, keyboard focus and touch without opening an editor',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const faces=Array.from({length:26},(_,i)=>({id:String(i),rect:{x:.05+(i%6)*.15,y:.05+Math.floor(i/6)*.18,width:.05,height:.06},personId:String(i),person:{id:String(i),name:'אדם '+i}})),f=fixture();
 f.window.FamilyI18n.fetch=async()=>Response.json({faces});f.window.FamilyPhotoDate={overlays:()=>({showNames:true})};await f.mount();
 const legend=f.find('face-label-list'),target=f.find('face-label-target'),markers=f.find('face-visible-labels').children.filter(node=>node.className==='face-label-marker');assert.equal(legend.hidden,false);assert.equal(target.hidden,true);assert.equal(markers[10].hidden,false);
 f.emit(legend.children[10],'pointerenter');assert.equal(target.hidden,false);assert.equal(target.style.left,faces[10].rect.x*100+'%');assert.equal(markers[10].classList.contains('face-annotation-active'),true);
 f.emit(legend.children[10],'pointerleave');assert.equal(target.hidden,true);
 f.emit(legend.children[20],'focusin');assert.equal(target.style.top,faces[20].rect.y*100+'%');f.emit(legend.children[20],'focusout',{relatedTarget:null});assert.equal(target.hidden,true);
 f.emit(markers[10],'click');t.mock.timers.tick(1000);f.window.dispatchEvent(new CustomEvent('family-media-changed',{detail:{operation:'faces',item:{id:'photo',kind:'photo'},faces}}));assert.equal(target.hidden,false,'Background detections must preserve the highlight');t.mock.timers.tick(999);assert.equal(target.hidden,false);assert.equal(f.find('face-popover face-picker'),undefined);t.mock.timers.tick(1);assert.equal(target.hidden,true,'Refreshing labels must not extend the two-second highlight');
 f.emit(legend.children[20].querySelector('[data-face-locate]'),'click');assert.equal(target.style.left,faces[20].rect.x*100+'%');f.faces.clear();t.mock.timers.tick(2000);assert.equal(target.hidden,true);assert.equal(f.find('face-layer'),undefined);
});

test('visual connectors and locating use the precise matching head while face edit geometry stays unchanged',async()=>{
 const person={id:'one',name:'אחד'},faces=[{id:'wide',personId:person.id,person,rect:{x:.35,y:.25,width:.4,height:.55}},{id:'precise',personId:person.id,person,rect:{x:.45,y:.27,width:.08,height:.1}},{id:'neighbour',personId:'two',person:{id:'two',name:'שני'},rect:{x:.62,y:.25,width:.08,height:.1}}],f=fixture([],{desktop:true});
 f.window.FamilyI18n.fetch=async()=>Response.json({faces});f.window.FamilyPhotoDate={overlays:()=>({showNames:true})};await f.mount();const host=f.find('face-visible-labels'),label=host.children.find(node=>node.classList.contains('face-visible-label'));f.emit(label.querySelector('[data-face-locate]'),'click');
 const target=f.find('face-label-target');assert.equal(target.style.left,faces[1].rect.x*100+'%');assert.equal(target.style.width,faces[1].rect.width*100+'%');
 const hit=f.find('face-hit-buttons').children.find(node=>node.dataset.faceId==='wide');assert.equal(hit.style.width,'40%','Stored editing geometry is preserved');f.emit(f.stage,'click',{detail:0,target:hit});assert.equal(f.find('face-selection').style.width,'40%');assert.ok(f.find('face-popover face-picker'));f.faces.clear();
});

test('two removals renumber a real dense photo immediately, through overlay toggles, late scans and reopening',async()=>{
 for(const desktop of [false,true]){
  const original=crowdPhotoFaces(),detected=original.filter(face=>!face.person),f=fixture(detected,{desktop}),removed=[original[20].id,original[23].id];let saved=original.filter(face=>face.person),ignored=[],showNames=true,revision=0;
  f.image.naturalWidth=f.image.naturalHeight=3000;f.view.width=450;f.view.height=1100;
  const snapshot=()=>({item:{id:'dense-removals',kind:'photo',scope:'photos',tagsRevision:'t'+revision},faces:saved,ignoredFaces:ignored,detectedFaces:detected});
  f.window.FamilyI18n.fetch=async(path,options)=>{
   if(path.endsWith('/ignore')){const payload=JSON.parse(options.body),face=saved.find(face=>face.id===payload.faceId);assert.ok(face);saved=saved.filter(face=>face.id!==payload.faceId);ignored=[...ignored,face.rect];revision++;return Response.json({...snapshot(),operation:'face-ignore',scope:'photos'});}
   return Response.json(snapshot());
  };
  f.window.FamilyPhotoDate={overlays:()=>({showNames})};await f.mount('dense-removals',{},snapshot().item);
  const check=count=>{
   const legend=f.find('face-label-list'),host=f.find('face-visible-labels');assert.equal(legend.hidden,false);
   assert.deepEqual(legend.children.map(node=>Number(/face-label-number[^>]*>(\d+)/.exec(node.innerHTML)[1])),Array.from({length:count},(_,i)=>i+1));
   const markers=host.children.filter(node=>node.classList.contains('face-label-marker')&&!node.hidden);assert.equal(markers.length,count,'The remaining markers must not disappear as one group');assert.deepEqual(markers.map(node=>Number(node.textContent)),Array.from({length:count},(_,i)=>i+1));
  };
  check(26);
  for(const [i,id]of removed.entries()){
   const hit=f.find('face-hit-buttons').children.find(node=>node.dataset.faceId===id);
   if(desktop)f.emit(f.stage,'click',{detail:0,target:hit});else{f.emit(hit,'focus');f.emit(f.find('face-popover face-name').querySelector('[data-face-edit]'),'click');}
   f.emit(f.find('face-popover face-picker').querySelector('[data-face-remove]'),'click');check(25-i);await f.faces.flush();check(25-i);
  }
  showNames=false;f.window.dispatchEvent(new CustomEvent('family-photo-overlays-changed',{detail:{id:'dense-removals'}}));assert.equal(f.find('face-visible-labels').children.length,0);
  showNames=true;f.window.dispatchEvent(new CustomEvent('family-photo-overlays-changed',{detail:{id:'dense-removals'}}));check(24);
  f.progress(original.map(face=>({rect:face.rect,score:.95})));check(24);
  f.faces.clear();await f.mount('dense-removals',{},snapshot().item);check(24);f.faces.clear();
 }
});

test('backslash toggles the existing all-faces button in every album that offers it',async()=>{
 for(const scope of ['gallery','photos','personal:yona','wedding:parents','nostalgia','nursery:yona']){
  const f=fixture([],{desktop:true}),requests=[],flushed=[];let reviewed=false,revision=0;
  const item=()=>({id:'shortcut-photo',kind:'photo',scope,collections:['gallery'],tagsRevision:'t'+revision,faceSummary:{reviewed}});
  f.window.FamilyTags.flush=async id=>flushed.push(id);
  f.window.FamilyI18n.fetch=async(path,options)=>{
   if(path.endsWith('/review')){const payload=JSON.parse(options.body);requests.push(payload);reviewed=payload.complete;revision++;return Response.json({operation:'face-review',scope,item:item()});}
   return Response.json({item:item(),faces:[]});
  };
  await f.mount('shortcut-photo',{},item());const button=f.find('face-review-button');assert.equal(button['aria-keyshortcuts'],'\\');assert.ok(button.title.includes('\\'));
  for(const complete of [true,false]){
   const event=f.emit(f.document,'keydown',{key:'\\',target:f.stage});assert.equal(event.defaultPrevented,true);await new Promise(resolve=>setImmediate(resolve));
   assert.equal(button['aria-pressed'],String(complete));assert.equal(requests.at(-1).complete,complete);assert.equal(requests.at(-1).photoRevision,'original');
  }
  assert.deepEqual(flushed,['shortcut-photo','shortcut-photo']);assert.equal(requests.length,2);f.faces.clear();
  assert.equal(f.emit(f.document,'keydown',{key:'\\',target:f.stage}).defaultPrevented,false);
 }
});

test('backslash leaves typing, modified keys, hidden controls, other dialogs and face editing alone',async()=>{
 const f=fixture([],{desktop:true}),requests=[];f.window.FamilyI18n.fetch=async(path,options)=>{if(path.endsWith('/review'))requests.push(JSON.parse(options.body));return Response.json({faces:[],item:{id:'guarded',kind:'photo',scope:'gallery',faceSummary:{reviewed:true}}});};await f.mount('guarded',{}, {scope:'gallery'});
 const button=f.find('face-review-button'),press=properties=>f.emit(f.document,'keydown',{key:'\\',target:f.stage,...properties});
 for(const properties of [{key:'/'},{key:'|',shiftKey:true},{ctrlKey:true},{metaKey:true},{altKey:true},{shiftKey:true},{repeat:true},{isComposing:true}])assert.equal(press(properties).defaultPrevented,false);
 for(const tag of ['input','textarea','select']){const input=f.document.createElement(tag);f.dialog.append(input);assert.equal(press({target:input}).defaultPrevented,false);input.remove();}
 const editable=f.document.createElement('div');editable.isContentEditable=true;f.dialog.append(editable);assert.equal(press({target:editable}).defaultPrevented,false);editable.remove();
 const textbox=f.document.createElement('div');textbox.setAttribute('role','textbox');f.dialog.append(textbox);assert.equal(press({target:textbox}).defaultPrevented,false);textbox.remove();
 button.disabled=true;assert.equal(press().defaultPrevented,false);button.disabled=false;
 button.hidden=true;assert.equal(press().defaultPrevented,false);button.hidden=false;
 f.title.hidden=true;assert.equal(press().defaultPrevented,false);f.title.hidden=false;
 button.inert=true;assert.equal(press().defaultPrevented,false);button.inert=false;
 button.setAttribute('aria-hidden','true');assert.equal(press().defaultPrevented,false);button.setAttribute('aria-hidden','false');
 button.remove();assert.equal(press().defaultPrevented,false);f.title.append(button);
 f.dialog.open=false;assert.equal(press().defaultPrevented,false);f.dialog.open=true;
 const other=f.document.createElement('dialog'),otherField=f.document.createElement('div');other.open=true;other.append(otherField);f.document.body.append(other);
 assert.equal(press({target:otherField}).defaultPrevented,false);f.document.activeElement=otherField;assert.equal(press({target:f.document.body}).defaultPrevented,false);f.document.activeElement=null;assert.equal(press({target:f.document.body}).defaultPrevented,false);other.remove();
 const openPicker=()=>{const r=f.image.getBoundingClientRect();f.emit(f.stage,'click',{detail:1,target:f.stage,clientX:r.left+r.width/2,clientY:r.top+r.height/2});};openPicker();assert.ok(f.find('face-popover face-picker'));assert.equal(press().defaultPrevented,false);
 f.emit(f.find('face-popover face-picker').querySelector('[data-face-adjust]'),'click');assert.equal(press().defaultPrevented,false);f.faces.dismiss();await new Promise(resolve=>setImmediate(resolve));assert.equal(requests.length,0);
 assert.equal(press({target:f.document.body}).defaultPrevented,true);await new Promise(resolve=>setImmediate(resolve));assert.equal(requests.length,1);f.faces.clear();
 const absent=fixture([],{desktop:true});await absent.mount('native-photo',{}, {scope:'photos',collections:['photos']});assert.equal(absent.find('face-review-button'),undefined);assert.equal(absent.emit(absent.document,'keydown',{key:'\\',target:absent.stage}).defaultPrevented,false);absent.faces.clear();
});

test('holding backslash cannot repeat a save or approve the next photo after navigation',async()=>{
 const f=fixture([],{desktop:true}),requests=[];let finish;
 f.window.FamilyI18n.fetch=async(path,options)=>{
  if(!path.endsWith('/review'))return Response.json({faces:[]});const payload=JSON.parse(options.body);requests.push({path,payload});await new Promise(resolve=>finish=resolve);return Response.json({operation:'face-review',item:{id:path.split('/')[2],kind:'photo',scope:'gallery',faceSummary:{reviewed:payload.complete}}});
 };
 await f.mount('first',{}, {scope:'gallery'});f.emit(f.document,'keydown',{key:'\\',target:f.stage});assert.equal(f.find('face-review-button').disabled,true);await new Promise(resolve=>setImmediate(resolve));
 for(const repeat of [true,false])assert.equal(f.emit(f.document,'keydown',{key:'\\',repeat,target:f.stage}).defaultPrevented,false);assert.equal(requests.length,1);finish();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(f.emit(f.document,'keydown',{key:'\\',repeat:true,target:f.stage}).defaultPrevented,false);assert.equal(requests.length,1);
 await f.mount('next',{}, {scope:'gallery'});assert.equal(f.emit(f.document,'keydown',{key:'\\',repeat:true,target:f.stage}).defaultPrevented,false);assert.equal(requests.length,1);
 f.emit(f.document,'keydown',{key:'\\',target:f.stage});await new Promise(resolve=>setImmediate(resolve));assert.equal(requests.length,2);assert.match(requests[1].path,/media\/next\/faces\/review/);finish();await new Promise(resolve=>setImmediate(resolve));f.faces.clear();
});

test('the upload wizard uses the same backslash shortcut without writing a draft to the media API',async()=>{
 const f=fixture([],{desktop:true}),requests=[];let reviewed=false,enabled=true;
 const snapshot=()=>({item:{id:'draft',kind:'photo',faceSummary:{reviewed}},faces:[]}),adapter={enabled:()=>enabled,load:async()=>snapshot(),mapDetections:faces=>faces,review:async payload=>{requests.push(payload);reviewed=payload.complete;return snapshot();}};
 f.window.FamilyI18n.fetch=async()=>{throw Error('A draft must not use the media API');};f.window.FamilyTags.flush=async()=>{throw Error('A draft has no server tags');};
 await f.mount('draft',{adapter,reviewHost:f.title,reviewLabel:true,zoom:false});
 for(const complete of [true,false]){assert.equal(f.emit(f.document,'keydown',{key:'\\',target:f.stage}).defaultPrevented,true);await new Promise(resolve=>setImmediate(resolve));assert.equal(reviewed,complete);assert.equal(f.find('face-review-button')['aria-pressed'],String(complete));}
 enabled=false;assert.equal(f.emit(f.document,'keydown',{key:'\\',target:f.stage}).defaultPrevented,false);assert.equal(requests.length,2);f.faces.clear();
});
