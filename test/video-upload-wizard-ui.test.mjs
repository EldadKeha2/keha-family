import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import vm from 'node:vm';
import {videoUploadMetadata} from '../public/assets/video-upload-metadata.mjs';
import {filenamePhotoDate} from '../public/assets/photo-upload-metadata.mjs';

const source=(await readFile(new URL('../public/assets/video-upload-wizard.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'');
const swipeSource=await readFile(new URL('../public/assets/photo-swipe.js',import.meta.url),'utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function deferred(){let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};}
function fixture({finalize,categories}={}){
 const nodes=new Map(),listeners=new Map(),events=new Map(),uploads=[],saves=[],changed=[],toasts=[];
 class Element{
  constructor(tag='div'){this.tag=tag;this.tagName=tag.toUpperCase();this.dataset={};this.value='';this.validity={};this.disabled=false;this.hidden=false;this.open=false;this.listeners=new Map();this.attributes=new Map();this.classes=new Set();this.captures=[];this.clientWidth=360;this.loadCount=0;this.classList={toggle:(name,on)=>on?this.classes.add(name):this.classes.delete(name),add:name=>this.classes.add(name),remove:name=>this.classes.delete(name)};}
  set innerHTML(value){this.html=value;for(const [,tag,attrs,id]of value.matchAll(/<(\w+)\b([^>]*\bid="([^"]+)"[^>]*)>/g)){const child=new Element(tag);child.id=id;child.parent=this;child.field=attrs.includes('data-video-draft-field');nodes.set(id,child);}}
  get innerHTML(){return this.html||'';}
  setAttribute(name,value){this.attributes.set(name,value);}
  removeAttribute(name){this.attributes.delete(name);}
  addEventListener(type,fn){this.listeners.set(type,fn);}
  closest(selector){return selector.split(',').some(part=>part===this.tag||this.tag==='button'&&part.startsWith('button'))?this:null;}
  getBoundingClientRect(){return {left:0,top:0,right:360,bottom:240,width:360,height:240};}
  setPointerCapture(id){this.captures.push(id);}
  querySelectorAll(selector){return [...nodes.values()].filter(node=>node.parent===this&&(selector==='[data-video-draft-field]'?node.field:['input','textarea','select','button'].includes(node.tag)));}
  showModal(){this.open=true;}
  close(){this.open=false;this.listeners.get('close')?.();}
  pause(){} load(){this.loadCount++;} replaceChildren(){} blur(){}
  click(){assert.equal(this.disabled,false,'clicked control is enabled');return this.listeners.get('click')?.();}
 }
 const document={getElementById:id=>nodes.get(id),createElement:tag=>new Element(tag),addEventListener:(name,fn)=>events.set(name,fn),body:{append(node){nodes.set(node.id,node);}}};
 const window={FAMILY_API_TOKEN:'test',FamilyI18n:{isEnglish:false,error:String,fetch:async(path,options)=>{const data=JSON.parse(options.body);saves.push({path,data});return finalize?finalize(saves.length,data):Response.json({item:{id:path.split('/')[2]}});}},FamilyVideoCategories:categories,FamilyVideoEditor:{icon:'',clock:String},FamilyNostalgia:{uploadEvents:()=>[{id:'original-event',name:'Original event'}]},FamilyApp:{toast:value=>toasts.push(value)},confirm:()=>true,addEventListener:(name,fn)=>listeners.set(name,fn),dispatchEvent:event=>changed.push(event.detail)};
 const context=vm.createContext({window,document,videoUploadMetadata,filenamePhotoDate,crypto:{randomUUID},URL:{createObjectURL:()=>'/local-preview',revokeObjectURL(){}},clearTimeout,setTimeout,CustomEvent:class{constructor(name,{detail}){this.detail=detail;}}});
 vm.runInContext(swipeSource,context);vm.runInContext(source,context);
 const upload=(file,progress,target)=>{const pending=deferred();uploads.push({file,progress,target,...pending});return pending.promise;};
 const prepare=(names=['first.mp4','second.mp4'],options={})=>window.FamilyVideoUpload.prepare(names.map(name=>({name,type:'video/mp4',size:500})),{scope:'nostalgia',eventId:'original-event',upload,...options});
 const result=index=>({file:'file-'+index+'.mp4',collection:{items:[{id:'item-'+index,file:'file-'+index+'.mp4'}]}});
 const get=id=>nodes.get('videoUpload'+id);
 const pointer=(type,x,y=80,extra={})=>{const event={pointerId:1,pointerType:'touch',isPrimary:true,button:0,clientX:x,clientY:y,target:get('Player'),cancelable:true,preventDefault(){this.prevented=true;},...extra};events.get(type)?.(event);if(type==='pointerdown')get('Viewport').listeners.get(type)?.(event);return event;};
 const touch=(type,x,y=80,count=1)=>{const point={identifier:9,clientX:x,clientY:y,target:get('Player')},event={target:point.target,touches:type==='touchend'?[]:Array.from({length:count},(_,i)=>({...point,identifier:9+i})),changedTouches:[point],cancelable:true,preventDefault(){this.prevented=true;}};(type==='touchstart'?get('Viewport').listeners:events).get(type)?.(event);return event;};
 const stroke=(dx,{stream='pointer',y=80,target}={})=>{
  if(stream!=='touch')pointer('pointerdown',160,y,target?{target}:{});
  if(stream!=='pointer')touch('touchstart',160,y);
  if(stream!=='touch')pointer('pointermove',160+dx,y+2,target?{target}:{});
  if(stream!=='pointer')touch('touchmove',160+dx,y+2);
  if(stream!=='touch')pointer('pointerup',160+dx,y+2,target?{target}:{});
  if(stream!=='pointer')touch('touchend',160+dx,y+2);
 };
 const clip=new Element('dialog');nodes.set('videoClipEditor',clip);
 return {get,prepare,uploads,saves,changed,toasts,listeners,result,window,document,Element,events,pointer,touch,stroke,clip};
}

test('closing a saving wizard keeps the entire batch running with the original destination and a reopenable progress control',async()=>{
 const f=fixture(),prepared=f.prepare(),saving=f.get('SaveAll').click();
 assert.equal(f.uploads.length,1);assert.equal(f.get('Close').disabled,false);
 f.get('Player').duration=300;f.get('Player').onloadedmetadata();
 assert.equal(f.get('Name').disabled,true,'late preview metadata cannot unlock a saving draft');
 f.get('Close').click();assert.equal(f.get('Wizard').open,false);assert.equal(f.get('Background').hidden,false);
 f.uploads[0].progress(45);assert.match(f.get('BackgroundStatus').textContent,/45%/);
 f.get('Background').click();assert.equal(f.get('Wizard').open,true);assert.equal(f.get('Background').hidden,true);
 f.get('Close').click();
 let protectedUnload=false;f.listeners.get('beforeunload')({preventDefault(){protectedUnload=true;}});assert.equal(protectedUnload,true);
 f.uploads[0].resolve(f.result(0));await tick();
 assert.equal(f.uploads.length,2);assert.equal(f.get('Wizard').open,false,'next video does not reopen the modal');
 for(const transfer of f.uploads)assert.equal(transfer.target.eventId,'original-event');
 f.uploads[1].resolve(f.result(1));await saving;assert.deepEqual(Array.from(await prepared),[]);
 assert.equal(f.saves.length,2);assert.equal(f.changed.length,2);assert.equal(f.get('Background').hidden,true);
 protectedUnload=false;f.listeners.get('beforeunload')({preventDefault(){protectedUnload=true;}});assert.equal(protectedUnload,false);
});

test('a failed metadata save remains visible after minimizing and retrying reuses the uploaded file and operation',async()=>{
 const f=fixture({finalize:count=>count===1?Response.json({error:'Temporary save failure'},{status:503}):Response.json({saved:true})}),prepared=f.prepare(['only.mp4']);
 const firstSave=f.get('SaveAll').click();f.get('Close').click();f.uploads[0].resolve(f.result(0));await firstSave;
 assert.equal(f.get('Background').hidden,false);assert.match(f.get('BackgroundStatus').textContent,/ניסיון נוסף/);
 f.get('Background').click();assert.match(f.get('Error').textContent,/Temporary save failure/);
 await f.get('SaveAll').click();await prepared;
 assert.equal(f.uploads.length,1,'metadata retry does not reupload the video');assert.equal(f.saves.length,2);
 assert.deepEqual(f.saves[0].data,f.saves[1].data,'the retry uses the same finalization operation');assert.equal(f.get('Background').hidden,true);
});

test('a category created during video upload becomes the saved destination without losing the draft description',async()=>{
 let created;
 const category='b'.repeat(32),categories={options:({allowCreate})=>{assert.equal(allowCreate,true);return '<option value="family">Family</option><option value="'+category+'">Trips</option><option value="__create_category__">Add category</option>';},createFromSelect:(select,{previous,onSelect})=>{if(select.value!=='__create_category__')return false;select.value=previous;created=()=>{select.value=category;onSelect(category);};return true;}};
 const f=fixture({categories}),prepared=f.prepare(['trip.mp4'],{scope:'videos',group:'family'});
 f.get('Caption').value='Our trip';f.get('Target').value='__create_category__';f.get('Target').listeners.get('change')();assert.equal(f.get('Target').value,'family');
 created();const saving=f.get('SaveAll').click();assert.equal(f.uploads[0].target.group,category);f.uploads[0].resolve(f.result(0));await saving;await prepared;
 assert.equal(f.saves[0].data.metadata.group,category);assert.equal(f.saves[0].data.metadata.caption,'Our trip');
});

test('video upload swipes use Next and Previous once and retain draft details without wrapping at the ends',async()=>{
 for(const stream of ['pointer','touch','both']){
  const f=fixture(),prepared=f.prepare(['first.mp4','second.mp4','third.mp4']);
  f.get('Name').value='First edited name';f.get('Caption').value='First description';f.get('Dateday').value='12';f.get('Datemonth').value='7';f.get('Dateyear').value='1988';
  f.stroke(130,{stream});assert.equal(f.get('Filename').textContent,'second.mp4',stream);f.get('Caption').value='Second description';
  f.stroke(-130,{stream});assert.equal(f.get('Filename').textContent,'first.mp4');assert.equal(f.get('Name').value,'First edited name');assert.equal(f.get('Caption').value,'First description');assert.equal(f.get('Dateday').value,12);assert.equal(f.get('Datemonth').value,7);assert.equal(f.get('Dateyear').value,1988);
  let loads=f.get('Player').loadCount;f.stroke(-130,{stream});assert.equal(f.get('Filename').textContent,'first.mp4');assert.equal(f.get('Player').loadCount,loads,'Previous at the first file must not restart playback');
  f.stroke(130,{stream});assert.equal(f.get('Caption').value,'Second description');f.stroke(130,{stream});assert.equal(f.get('Filename').textContent,'third.mp4');
  loads=f.get('Player').loadCount;f.stroke(130,{stream});assert.equal(f.get('Filename').textContent,'third.mp4');assert.equal(f.get('Player').loadCount,loads,'Next at the last file must not restart playback');
  f.get('Close').click();await prepared;
 }
});

test('video preview taps and short movements stay native and the playback control strip never starts a swipe',async()=>{
 const f=fixture(),prepared=f.prepare(),stage=f.get('Viewport');
 const click=()=>{const event={detail:1,preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;}};stage.listeners.get('click')(event);return event;};
 f.pointer('pointerdown',160);assert.deepEqual(stage.captures,[],'Starting on video does not capture its native tap');
 assert.equal(f.pointer('pointermove',175,82).prevented,undefined);f.pointer('pointerup',175,82);assert.equal(click().prevented,undefined);assert.deepEqual(stage.captures,[]);
 for(const stream of ['pointer','touch','both'])f.stroke(130,{stream,y:210});
 assert.equal(f.get('Filename').textContent,'first.mp4');assert.deepEqual(stage.captures,[]);assert.equal(click().prevented,undefined);
 f.pointer('pointerdown',160);assert.equal(f.pointer('pointermove',220,82).prevented,true);assert.deepEqual(stage.captures,[1]);f.pointer('pointerup',290,82);assert.equal(f.get('Filename').textContent,'second.mp4');assert.equal(click().prevented,true,'The synthetic click after a swipe cannot toggle playback');
 f.pointer('pointerdown',160,210);f.pointer('pointerup',160,210);assert.equal(click().prevented,undefined,'A fresh native-control tap is available immediately after the swipe');
 f.get('Close').click();await prepared;
});

test('video upload vertical scroll, pinches, cancellations and unrelated videos do not change the draft',async()=>{
 const f=fixture(),prepared=f.prepare();
 f.pointer('pointerdown',160);assert.equal(f.pointer('pointermove',164,185).prevented,undefined);f.pointer('pointerup',290,185);
 f.touch('touchstart',160);assert.equal(f.touch('touchmove',165,190).prevented,undefined);f.touch('touchend',290,190);
 f.pointer('pointerdown',160);f.pointer('pointermove',210);f.pointer('pointerdown',240,80,{pointerId:2,isPrimary:false});f.pointer('pointerup',300);
 f.touch('touchstart',160);f.touch('touchmove',210);f.touch('touchstart',210,80,2);f.touch('touchmove',300);f.touch('touchend',300);
 f.pointer('pointerdown',160);f.pointer('pointermove',240);f.pointer('pointercancel',240);f.pointer('pointerup',300);
 f.touch('touchstart',160);f.touch('touchmove',240);f.events.get('touchcancel')();f.touch('touchend',300);
 f.window.visualViewport={scale:2};f.stroke(130,{stream:'both'});assert.equal(f.get('Filename').textContent,'first.mp4','Panning a zoomed preview cannot navigate');f.window.visualViewport.scale=1;
 f.stroke(130,{target:new f.Element('video')});assert.equal(f.get('Filename').textContent,'first.mp4');
 f.get('Close').click();await prepared;
});

test('a video upload swipe cannot start during a clip dialog or continue after uploading begins',async()=>{
 const f=fixture(),prepared=f.prepare();
 f.clip.open=true;f.touch('touchstart',160);f.clip.open=false;f.touch('touchmove',290);f.touch('touchend',290);assert.equal(f.get('Filename').textContent,'first.mp4','A disabled initial stroke cannot revive after the modal closes');
 f.pointer('pointerdown',160);f.pointer('pointermove',240);f.clip.open=true;f.pointer('pointerup',290);assert.equal(f.get('Filename').textContent,'first.mp4');f.clip.open=false;
 f.touch('touchstart',160);f.touch('touchmove',240);const saving=f.get('SaveAll').click();f.touch('touchend',290);f.stroke(130,{stream:'both'});assert.equal(f.get('Filename').textContent,'first.mp4');assert.equal(f.uploads.length,1);
 f.uploads[0].resolve(f.result(0));await tick();f.uploads[1].resolve(f.result(1));await saving;await prepared;
});

test('video gestures remain excluded unless the caller explicitly opts in to the exact preview',async()=>{
 const f=fixture(),prepared=f.prepare(),directions=[];
 f.window.FamilyPhotoSwipe.bind(f.get('Viewport'),{enabled:()=>true,right:()=>directions.push(1),left:()=>directions.push(-1)});
 for(const stream of ['pointer','touch','both'])f.stroke(130,{stream});assert.deepEqual(directions,[]);
 f.get('Close').click();await prepared;
});
