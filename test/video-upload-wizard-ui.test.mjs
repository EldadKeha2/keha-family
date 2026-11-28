import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import vm from 'node:vm';
import {bindSegmentTimeline, followPreviousEnd, markedRange, prepareSegmentFile, segmentControlsHTML, segmentHue, segmentColor} from '../public/assets/video-upload-segments.mjs';
import {videoUploadMetadata} from '../public/assets/video-upload-metadata.mjs';
import {captureSegmentWork,restoreSegmentWork} from '../public/assets/video-segment-work.mjs';
import {createSegmentHistory} from '../public/assets/video-segment-history.mjs';
import {tagChoices,taggedPeople} from '../public/assets/tag-choices.mjs';
import {bindUploadPreview} from '../public/assets/video-upload-preview.mjs';
import {filenamePhotoDate} from '../public/assets/photo-upload-metadata.mjs';

const source=(await readFile(new URL('../public/assets/video-upload-wizard.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'');
const swipeSource=await readFile(new URL('../public/assets/photo-swipe.js',import.meta.url),'utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function deferred(){let resolve,reject;const promise=new Promise((done,failed)=>{resolve=done;reject=failed;});return {promise,resolve,reject};}
function fixture({finalize,categories,sourceFactory,cut=prepareSegmentFile,previewWorker,check=file=>({file,phase:'ready',verified:true,discard(){}})}={}){
 const nodes=new Map(),listeners=new Map(),events=new Map(),uploads=[],saves=[],changed=[],toasts=[],probes=[],urls=[],revoked=[];
 class Element{
  constructor(tag='div'){this.tag=tag;this.tagName=tag.toUpperCase();this.dataset={};this.currentTime=0;this.style={setProperty(name,value){this[name]=value;}};this.value='';this.validity={};this.disabled=false;this.hidden=false;this.open=false;this.listeners=new Map();this.attributes=new Map();this.classes=new Set();this.captures=[];this.clientWidth=360;this.loadCount=0;this.paused=true;this.pauseCount=0;this.classList={toggle:(name,on)=>on?this.classes.add(name):this.classes.delete(name),add:name=>this.classes.add(name),remove:name=>this.classes.delete(name)};}
  set innerHTML(value){this.html=value;for(const [,tag,attrs,id]of value.matchAll(/<(\w+)\b([^>]*\bid="([^"]+)"[^>]*)>/g)){const child=new Element(tag);child.id=id;child.parent=this;child.field=attrs.includes('data-video-draft-field');child.boundary=attrs.includes('data-video-boundary');nodes.set(id,child);}}
  get innerHTML(){return this.html||'';}
  setAttribute(name,value){this.attributes.set(name,value);}
  removeAttribute(name){this.attributes.delete(name);}
  addEventListener(type,fn){const previous=this.listeners.get(type);this.listeners.set(type,previous?event=>{previous(event);return fn(event);}:fn);}
  closest(selector){return selector.split(',').some(part=>part===this.tag||this.tag==='button'&&part.startsWith('button'))?this:null;}
  getBoundingClientRect(){return {left:0,top:0,right:360,bottom:240,width:360,height:240};}
  setPointerCapture(id){this.captures.push(id);this.capturedPointer=id;}
  hasPointerCapture(id){return this.capturedPointer===id;}
  releasePointerCapture(id){if(this.hasPointerCapture(id))this.capturedPointer=null;}
  querySelectorAll(selector){return [...nodes.values()].filter(node=>node.parent===this&&(selector==='[data-video-draft-field]'?node.field:selector==='[data-video-boundary]'?node.boundary:['input','textarea','select','button'].includes(node.tag)));}
  showModal(){this.open=true;}
  close(){this.open=false;this.listeners.get('close')?.();}
  canPlayType(){return 'probably';} play(){this.paused=false;this.listeners.get('play')?.();return Promise.resolve();} pause(){this.paused=true;this.pauseCount++;this.listeners.get('pause')?.();} load(){this.loadCount++;} replaceChildren(){this.html='';} blur(){} focus(){this.focused=true;}
  click(){assert.equal(this.disabled,false,'clicked control is enabled');return this.listeners.get('click')?.();}
 }
 const document={getElementById:id=>nodes.get(id),createElement:tag=>{const node=new Element(tag);if(tag==='video')probes.push(node);return node;},addEventListener:(name,fn)=>events.set(name,fn),body:{append(node){nodes.set(node.id,node);}}};
 const window={FAMILY_API_TOKEN:'test',FamilyI18n:{isEnglish:false,error:String,fetch:async(path,options)=>{const data=JSON.parse(options.body);saves.push({path,data});return finalize?finalize(saves.length,data):Response.json({item:{id:path.split('/')[2]}});}},FamilyVideoCategories:categories,FamilyVideoEditor:{icon:'',clock:String,seconds:text=>String(text).trim()?String(text).split(':').reduce((v,part)=>v*60+Number(part),0):NaN},FamilyNostalgia:{uploadEvents:()=>[{id:'original-event',name:'Original event'}]},FamilyApp:{toast:value=>toasts.push(value)},confirm:()=>true,addEventListener:(name,fn)=>listeners.set(name,fn),dispatchEvent:event=>changed.push(event.detail)};
 window.FamilyNostalgia.uploadEventLabel=event=>event.name;
 const context=vm.createContext({window,document,captureSegmentWork,restoreSegmentWork,createVideoSource:sourceFactory,tagChoices,taggedPeople,startUploadCheck:check,MAX_VIDEO_SOURCE_BYTES:4*1024**3,bindUploadPreview:options=>bindUploadPreview({...options,worker:previewWorker}),videoUploadMetadata,filenamePhotoDate,bindSegmentTimeline,followPreviousEnd,markedRange,prepareSegmentFile:cut,segmentControlsHTML,segmentHue,crypto:{randomUUID},URL:{createObjectURL:file=>'blob:local/'+urls.push(file),revokeObjectURL:url=>revoked.push(url)},clearTimeout,setTimeout,CustomEvent:class{constructor(name,{detail}){this.detail=detail;}}});
 document.querySelectorAll=selector=>[...nodes.values()].filter(node=>node.tag===selector);
 context.createSegmentHistory=createSegmentHistory;
 vm.runInContext(swipeSource,context);vm.runInContext(source,context);
 const upload=(file,progress,target)=>{const pending=deferred();uploads.push({file,progress,target,...pending});return pending.promise;};
 const prepare=(names=['first.mp4','second.mp4'],options={})=>window.FamilyVideoUpload.prepare(names.map(name=>typeof name==='string'?{name,type:'video/mp4',size:500}:name),{scope:'nostalgia',eventId:'original-event',upload,...options});
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
 return {get,prepare,uploads,saves,changed,toasts,probes,urls,revoked,listeners,result,window,document,Element,events,pointer,touch,stroke,clip};
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

function openSegments(f,duration=8){
 f.get('Player').duration=duration;f.get('Player').onloadedmetadata();f.get('Split').click();
}
function boundary(f,id,value){
 const field=f.get(id);field.value=value;field.listeners.get('input')();
}
function railPointer(f,type,x,target=f.get('Track'),y){
 const event={target,pointerId:1,isPrimary:true,button:0,clientX:x,clientY:y,preventDefault(){this.defaultPrevented=true;}};
 f.get('Track').listeners.get(type)(event);return event;
}
function markedButton(index){
 return {dataset:{segmentIndex:String(index)},closest(selector){return selector==='[data-segment-index]'?this:null;}};
}
function pressEditorKey(f,target,key,code,options={}){
 const event={target,key,code,preventDefault(){this.defaultPrevented=true;},stopPropagation(){},...options};
 f.get('Wizard').listeners.get('keydown')(event);
 return Boolean(event.defaultPrevented);
}
async function waitForUpload(f,count){
 for(let i=0;i<100&&f.uploads.length<count;i++)await tick();
 assert.equal(f.uploads.length,count,'the expected upload started');
}
function tagName(f,name){
 f.get('Search').value=name;
 const button={hasAttribute:attr=>attr==='data-video-add-name'};
 f.get('Wizard').listeners.get('click')({target:{closest:selector=>selector.includes('[data-video-add-name]')?button:null}});
}

test('Next keeps the marked portion on the player timeline and seeks to the precise cut, including the film end',async()=>{
 const f=fixture(),done=f.prepare(['tape.mp4']);
 assert.equal(f.get('Track').hidden,true);
 openSegments(f,10);
 assert.equal(f.get('Track').hidden,false);
 boundary(f,'StartTime','1.25');
 f.get('Player').currentTime=3.75;f.get('EndHere').click();
 f.get('Player').currentTime=7;f.get('Next').click();
 assert.match(f.get('Marks').innerHTML,/left:12.5%;width:25%/);
 assert.equal(f.get('StartTime').value,'3.75');
 assert.equal(f.get('Player').currentTime,3.75);assert.equal(Number(f.get('Playhead').value),3.75);
 boundary(f,'EndTime','10');f.get('Next').click();
 assert.equal(f.get('Title').textContent,'מקטע 1');assert.equal(f.get('StartTime').value,'1.25');assert.equal(f.get('Player').currentTime,1.25);
 assert.match(f.get('Marks').innerHTML,/left:37.5%;width:62.5%/);
 boundary(f,'Playhead','7.5');assert.equal(f.get('Player').currentTime,7.5);
 assert.equal(f.get('Title').textContent,'מקטע 2');assert.equal(f.get('StartTime').value,'3.75');
 f.get('Previous').click();assert.equal(f.get('StartTime').value,'1.25','scrubbing preserves the original cut');
 f.get('Split').click();assert.equal(f.get('Track').hidden,true);
 f.get('Close').click();await done;
});

test('A and L step the playhead by one second on English and Hebrew keyboards without editing a cut or interrupting playback',async()=>{
 const f=fixture(),done=f.prepare(['tape.mp4']),player=f.get('Player');
 assert.equal(pressEditorKey(f,player,'l','KeyL'),false,'shortcuts belong to the split editor');
 openSegments(f,8.75);boundary(f,'EndTime','5.25');
 assert.equal(pressEditorKey(f,f.get('Next'),'L','KeyL'),true);assert.equal(player.currentTime,6.25);
 assert.equal(player.paused,true);assert.equal(f.get('EndTime').value,'5.25');
 await player.play();pressEditorKey(f,player,'ש','KeyA');
 assert.equal(player.currentTime,5.25);assert.equal(player.paused,false);
 pressEditorKey(f,f.get('Playhead'),'ך','KeyL',{repeat:true});assert.equal(Number(f.get('Playhead').value),6.25);
 player.currentTime=8.5;pressEditorKey(f,player,'l','');assert.equal(player.currentTime,8.75);
 player.currentTime=.25;pressEditorKey(f,player,'a','');assert.equal(player.currentTime,0);
 for(const id of ['Name','Caption','StartTime','EndTime','Search','Dateyear','Target']){
  assert.equal(pressEditorKey(f,f.get(id),'l','KeyL'),false,id);
 }
 for(const options of [{ctrlKey:true},{altKey:true},{metaKey:true},{isComposing:true},{keyCode:229}]){
  assert.equal(pressEditorKey(f,player,'l','KeyL',options),false);
 }
 assert.equal(player.currentTime,0);assert.equal(f.get('StartTime').value,'0');assert.equal(f.get('EndTime').value,'5.25');
 f.get('Close').click();await done;
});

test('A and L move the focused segment handle, retaining the previous cut as the end floor and respecting locks',async()=>{
 const f=fixture(),done=f.prepare(['tape.mp4']);openSegments(f,837.96);
 boundary(f,'EndTime','02:24.27');f.get('PinNext').click();
 const start=f.get('StartSlider'),end=f.get('EndSlider');
 pressEditorKey(f,end,'a','KeyA');assert.equal(Number(end.value),144.27);assert.equal(f.get('EndTime').value,'');
 pressEditorKey(f,end,'ך','KeyL');assert.equal(f.get('EndTime').value,'145.27');assert.equal(f.get('Player').currentTime,145.27);
 pressEditorKey(f,end,'l','KeyL');pressEditorKey(f,start,'l','KeyL');
 assert.equal(f.get('StartTime').value,'145.27');assert.equal(f.get('EndTime').value,'146.27');
 pressEditorKey(f,end,'a','KeyA');pressEditorKey(f,end,'a','KeyA');assert.equal(Number(end.value),145.27);
 f.get('Previous').click();assert.equal(end.disabled,true);assert.equal(pressEditorKey(f,end,'l','KeyL'),false);
 assert.equal(Number(end.value),144.27);
 f.get('Close').click();await done;
});

test('locking a marked segment advances without uploading, protects its bounds, and permits unlocking',async()=>{
 const f=fixture({cut:async()=>new File(['clip'],'clip.mp4')}),done=f.prepare(['tape.mp4']);
 openSegments(f,10);
 assert.equal(f.get('PinNext').disabled,true);
 boundary(f,'EndTime','2.5');f.get('Caption').value='ראשון';f.get('PinNext').click();
 assert.equal(f.get('Title').textContent,'מקטע 2');assert.equal(f.get('StartTime').value,'2.5');
 assert.match(f.get('Marks').innerHTML,/data-pinned="true"[^>]+מקטע 1 · מקובע/);
 assert.equal(f.uploads.length,0);
 boundary(f,'EndTime','6');f.get('PinNext').click();
 f.get('Previous').click();f.get('Previous').click();
 assert.equal(f.get('Caption').value,'ראשון');
 assert.equal(f.get('PinNext').textContent,'שחרור קיבוע');assert.equal(f.get('EndHere').disabled,true);
 assert.equal(f.get('Reset').disabled,true);assert.equal(f.get('Remove').hidden,true);
 assert.equal(f.get('SaveCurrent').disabled,false);
 f.get('PinNext').click();assert.equal(f.get('EndHere').disabled,false);
 boundary(f,'EndTime','3.5');f.get('Next').click();
 assert.equal(f.get('StartTime').value,'2.5','locked successor retains its start even when the prior cut changes');
 const saving=f.get('SaveCurrent').click();await waitForUpload(f,1);f.uploads[0].resolve(f.result(0));await saving;
 assert.equal(f.get('PinNext').hidden,true,'saved ranges cannot be unlocked');
 f.get('Close').click();await done;
});

test('an automatic start follows corrections to the preceding end, while a manually chosen start stays put',async()=>{
 const f=fixture(),done=f.prepare(['tape.mp4']);openSegments(f,12);
 boundary(f,'EndTime','2');f.get('Next').click();f.get('Previous').click();
 boundary(f,'EndTime','3.25');f.get('Next').click();
 assert.equal(f.get('StartTime').value,'3.25');assert.equal(f.get('Player').currentTime,3.25);
 boundary(f,'StartTime','4');f.get('Previous').click();boundary(f,'EndTime','3.5');f.get('Next').click();
 assert.equal(f.get('StartTime').value,'4');
 f.get('Reset').click();assert.equal(f.get('StartTime').value,'3.5');
 f.get('Close').click();await done;
});

test('the end slider begins at the preceding cut and the same floor applies to typing and the playhead',async()=>{
 for(const advance of ['Next','PinNext']){
  const f=fixture(),done=f.prepare(['tape.mp4']);openSegments(f,837.96);
  boundary(f,'EndTime','02:24.27');f.get(advance).click();
  const slider=f.get('EndSlider'),field=f.get('EndTime'),player=f.get('Player');
  assert.equal(slider.min,144.27);assert.equal(slider.value,144.27);
  assert.equal(field.value,'');assert.equal(field.placeholder,'144.27');
  assert.equal(f.get('SaveCurrent').disabled,true,'the starting position alone does not mark a clip');
  boundary(f,'EndSlider','143.53');assert.equal(slider.value,144.27);assert.equal(field.value,'144.27');
  player.currentTime=143.53;player.listeners.get('timeupdate')();
  f.get('EndHere').click();assert.equal(field.value,'144.27');assert.equal(player.currentTime,144.27);
  boundary(f,'EndTime','02:23.53');assert.equal(f.get('SaveCurrent').disabled,true);
  field.listeners.get('blur')();assert.equal(field.value,'144.27');
  boundary(f,'EndTime','03');assert.equal(field.value,'03','typing a later timestamp is uninterrupted');
  boundary(f,'EndTime','03:00.57');field.listeners.get('change')();
  assert.equal(slider.value,180.57);assert.equal(f.get('SaveCurrent').disabled,false);
  boundary(f,'StartTime','100');assert.equal(slider.min,144.27,'an earlier manual start cannot bypass the previous cut');
  boundary(f,'StartTime','170');assert.equal(slider.min,170);
  f.get('Reset').click();assert.equal(slider.min,144.27);assert.equal(slider.value,144.27);
  f.get('Previous').click();assert.equal(slider.min,0);assert.equal(slider.value,144.27);
  f.get('Close').click();await done;
 }
});

test('a revised previous end updates unpinned bounds and the native last step reaches the exact film end',async()=>{
 const f=fixture(),done=f.prepare(['tape.mp4']);openSegments(f,12.009);
 boundary(f,'EndTime','3.253');f.get('Next').click();boundary(f,'EndTime','5');
 f.get('Previous').click();boundary(f,'EndTime','6.003');f.get('Next').click();
 const slider=f.get('EndSlider');
 assert.equal(f.get('Player').currentTime,6.003);
 assert.equal(slider.min,6.003);assert.equal(slider.value,6.003);assert.equal(f.get('SaveCurrent').disabled,true);
 f.get('Previous').click();boundary(f,'EndTime','4.003');f.get('Next').click();
 assert.equal(slider.min,4.003);assert.equal(slider.value,5,'the marked endpoint survives a correction');
 boundary(f,'EndSlider','12.003');assert.equal(f.get('Player').currentTime,12.009);
 f.get('Next').click();assert.equal(slider.min,0);assert.equal(slider.max,12.009);
 assert.equal(f.get('Title').textContent,'מקטע 1');assert.equal(f.get('SaveCurrent').disabled,false);
 f.get('Close').click();await done;
});

test('split mode removes duplicate controls and an untouched segment closes immediately',async()=>{
 const f=fixture(),done=f.prepare(['tape.mp4']);
 f.window.confirm=()=>assert.fail('Untouched segment asked for confirmation');
 openSegments(f);
 assert.equal(f.get('Title').textContent,'מקטע 1');
 assert.equal(f.get('FileInfo').hidden,true);
 assert.equal(f.get('PlaybackTools').hidden,true);
 assert.equal(f.get('SegmentList'),undefined);
 assert.equal(f.get('Caption').rows,1);
 assert.equal(f.get('Dateday').placeholder,'יום');
 f.get('Split').click();
 assert.equal(f.get('FileInfo').hidden,false);
 assert.equal(f.get('PlaybackTools').hidden,false);
 assert.equal(f.get('Caption').rows,2);
 f.get('Split').click();
 f.listeners.get('beforeunload')({preventDefault(){assert.fail('Untouched segment blocked leaving the page');}});
 f.get('Close').click();
 await done;
});

test('closing or pressing Escape after segment activity asks first and declining keeps the work',async()=>{
 for(const activity of ['metadata','mark','play']){
  const f=fixture(),done=f.prepare(['tape.mp4']);
  openSegments(f);
  if(activity==='metadata')f.get('Caption').value='חג משפחתי';
  if(activity==='mark'){
   boundary(f,'EndTime','3');
   f.get('Next').click();
   f.get('Previous').click();
  }
  if(activity==='play'){await f.get('Player').play();f.get('Player').pause();}
  let prompts=0,exit=false;
  f.window.confirm=message=>{assert.match(message,/לצאת מעריכת המקטעים/);prompts++;return exit;};
  f.get('Wizard').listeners.get('cancel')({preventDefault(){}});
  assert.equal(prompts,1,activity);
  assert.equal(f.get('Wizard').open,true);
  if(activity==='metadata')assert.equal(f.get('Caption').value,'חג משפחתי');
  if(activity==='mark')assert.equal(f.get('EndTime').value,'3');
  exit=true;
  f.get('Close').click();await done;
  assert.equal(prompts,2);
 }
});

test('creating an event closes the picker first, keeps the draft and carries only the chosen destination forward',async()=>{
 const f=fixture({cut:async({name})=>new File(['clip'],name+'.mp4')});
 const life='everyday-life-clips',party={id:'party',name:'יום הולדת לנעמה',categoryId:'birthdays'},holiday={id:'holiday',name:'פסח',categoryId:'holidays'};
 let confirm,previous;
 f.window.FamilyNostalgia={
  directUploadId:life,uploadEvents:()=>[party,holiday],
  uploadEventLabel:event=>event.name+' · '+(event.categoryId==='birthdays'?'ימי הולדת':'חגים ומועדים'),
  createUploadEvent:(id,created)=>{assert.equal(f.get('EventChoices').hidden,true);previous=id;confirm=created;}
 };
 const done=f.prepare(['tape.mp4'],{eventId:null});openSegments(f);
 const create=()=>{f.get('EventTrigger').click();assert.equal(f.get('EventChoices').hidden,false);f.get('EventNew').click();};
 assert.equal(f.get('TargetRow').hidden,true);assert.equal(f.get('EventRow').hidden,false);
 assert.equal(f.get('EventValue').textContent,'ללא שיוך');assert.equal(f.get('EventClear').hidden,true);
 assert.doesNotMatch(f.get('Wizard').innerHTML,/יום הולדת לנעמה|פסח/);
 f.get('Caption').value='לפני העוגה';f.get('Dateyear').value='1989';boundary(f,'EndTime','2');
 create();assert.equal(previous,'');confirm(party);
 f.get('Next').click();assert.equal(f.get('EventValue').textContent,'יום הולדת לנעמה · ימי הולדת');
 boundary(f,'EndTime','4');f.get('Next').click();boundary(f,'EndTime','6');
 create();assert.equal(previous,'party');confirm(holiday);
 f.get('Next').click();assert.equal(f.get('EventValue').textContent,'פסח · חגים ומועדים');boundary(f,'EndTime','8');
 for(let i=0;i<3;i++)f.get('Previous').click();
 f.get('EventTrigger').click();f.get('EventLife').click();
 assert.equal(f.get('EventValue').textContent,'החיים עצמם');assert.equal(f.get('Caption').value,'לפני העוגה');
 f.get('Next').click();assert.equal(f.get('EventValue').textContent,'החיים עצמם');
 f.get('Next').click();assert.equal(f.get('EventValue').textContent,'פסח · חגים ומועדים');
 create();assert.equal(previous,'holiday'); // Dismiss the prompt without confirming.
 assert.equal(f.get('EventValue').textContent,'פסח · חגים ומועדים');
 const saving=f.get('SaveAll').click(),expected=[life,life,'holiday','holiday'];
 for(const [i,id] of expected.entries()){
  await waitForUpload(f,i+1);assert.equal(f.uploads[i].target.eventId,id);f.uploads[i].resolve(f.result(i));
 }
 await saving;
 assert.deepEqual(f.saves.map(item=>item.data.metadata.eventId),expected);
 assert.equal(f.saves[0].data.metadata.date.year,1989);
 f.get('Done').click();await done;
});

test('split is available only for an originally single video, with an independent full-video draft',async()=>{
 const multi=fixture(),multiDone=multi.prepare();
 assert.equal(multi.get('Split').hidden,true);multi.get('Remove').click();assert.equal(multi.get('Split').hidden,true);
 multi.get('Close').click();await multiDone;
 const f=fixture(),done=f.prepare(['recording.mp4']);
 assert.equal(f.get('Split').hidden,false);assert.equal(f.get('Split').disabled,true);
 f.get('Caption').value='Original caption';openSegments(f,5294);
 assert.equal(f.get('SaveCurrent').disabled,true);assert.equal(f.get('Next').disabled,true);
 boundary(f,'StartTime','1:15:00');boundary(f,'EndTime','1:14:59');
 assert.equal(f.get('SaveAll').disabled,true,'reversed intervals are not marked');
 boundary(f,'EndTime','1:20:00');f.get('Caption').value='First only';f.get('Dateyear').value='1989';tagName(f,'Yona');
 f.get('Next').click();assert.equal(f.get('Title').textContent,'מקטע 2');assert.equal(f.get('StartTime').value,'4800');
 assert.equal(f.get('Caption').value,'');assert.equal(f.get('Dateyear').value,1989);assert.doesNotMatch(f.get('PeopleTags').innerHTML,/Yona/);
 const secondHue=f.get('Wizard').style['--segment-hue'];
 assert.match(f.get('Marks').innerHTML,/מקטע 1/);f.get('Player').currentTime=5000;f.get('EndHere').click();f.get('Caption').value='Second only';
 f.get('Previous').click();assert.notEqual(f.get('Wizard').style['--segment-hue'],secondHue);
 assert.equal(f.get('Caption').value,'First only');assert.match(f.get('PeopleTags').innerHTML,/Yona/);
 assert.match(f.get('Marks').innerHTML,/מקטע 2/);assert.equal(f.get('Player').currentTime,4500);
 f.get('Split').click();assert.equal(f.get('Caption').value,'Original caption');assert.equal(f.get('Segments').hidden,true);
 f.get('Split').click();assert.equal(f.get('Caption').value,'First only');f.get('Next').click();assert.equal(f.get('Caption').value,'Second only');
 f.get('Reset').click();assert.equal(f.get('EndTime').value,'');assert.match(f.get('Marks').innerHTML,/מקטע 1/);
 assert.equal(f.get('SaveAll').disabled,false,'an unfinished segment must not block earlier selections');
 f.get('Remove').click();assert.equal(f.get('Title').textContent,'מקטע 1');
 f.get('Close').click();await done;
});

test('individual and batch saves upload playable slices with independent metadata, skipping saved and unmarked segments',async()=>{
 const {planMp4Clip}=await import('../src/mp4-clip.mjs');
 const bytes=await readFile(new URL('./fixtures/video-clip-source.mp4',import.meta.url));
 const file=new File([bytes],'recording.mp4',{type:'video/mp4'}),f=fixture();
 const done=f.prepare([file],{scope:'videos',group:'family'});
 openSegments(f);boundary(f,'StartTime','1.25');boundary(f,'EndSlider','3.75');
 f.get('Name').value='First';f.get('Caption').value='First caption';f.get('Dateyear').value=1989;tagName(f,'Shlomo');
 const saving=f.get('SaveCurrent').click();
 await waitForUpload(f,1);
 const first=f.uploads[0];assert.notEqual(first.file,file);assert.equal(first.file.name,'First.mp4');
 first.resolve(f.result(0));await saving;
 assert.equal(f.get('Wizard').open,true);assert.equal(f.get('SaveCurrent').disabled,true);
 f.get('Next').click();assert.equal(f.get('StartTime').value,'3.75');boundary(f,'EndTime','7.25');
 f.get('Name').value='Second';f.get('Caption').value='Second caption';f.get('Dateyear').value=1990;
 f.get('Target').value='special-birthdays';tagName(f,'Yona');
 f.get('Next').click();assert.equal(f.get('Title').textContent,'מקטע 3');
 const batch=f.get('SaveAll').click();await waitForUpload(f,2);
 const second=f.uploads[1];assert.notEqual(first.target.uploadId,second.target.uploadId);second.resolve(f.result(1));await batch;
 assert.equal(f.get('Title').textContent,'מקטע 3');assert.equal(f.get('SaveAll').disabled,true);assert.equal(f.uploads.length,2);
 for(const [i,[name,person,year,group,duration]] of [['First','Shlomo',1989,'family',2.5],['Second','Yona',1990,'special-birthdays',3.5]].entries()){
  const {metadata}=f.saves[i].data;
  assert.equal(metadata.name,name);assert.equal(metadata.caption,name+' caption');assert.deepEqual(metadata.people,[{name:person}]);
  assert.equal(metadata.date.year,year);assert.equal(metadata.group,group);assert.equal(metadata.range,undefined,'the independent upload must not be trimmed again');
  const clip=f.uploads[i].file;assert.ok(clip.size<file.size);
  const read=async(a,b)=>new Uint8Array(await clip.slice(a,b+1).arrayBuffer());
  assert.equal((await planMp4Clip(read,clip.size,{start:0,end:duration})).sourceDuration,duration);
 }
 f.get('Close').click();await done;
});

test('a split retry reuses the same file and identifiers after interrupted transfer and finalization',async()=>{
 let cuts=0;
 const f=fixture({cut:async({name})=>{cuts++;return new File(['clip'],name+'.mp4');},finalize:count=>count===1?Response.json({error:'Temporary failure'},{status:503}):Response.json({saved:true})});
 const done=f.prepare([{name:'long.mp4',type:'video/mp4',size:700*1024*1024}]);
 openSegments(f,5294);boundary(f,'StartTime','1:25:00');f.get('Player').currentTime=5294;f.get('EndHere').click();
 const first=f.get('SaveCurrent').click();await tick();f.uploads[0].reject(Error('Connection lost'));await first;
 assert.equal(f.get('StartSlider').disabled,true);assert.equal(f.get('Name').disabled,true);
 const second=f.get('SaveCurrent').click();assert.equal(f.uploads[0].file,f.uploads[1].file);assert.equal(f.uploads[0].target.uploadId,f.uploads[1].target.uploadId);
 f.get('Close').click();f.uploads[1].resolve(f.result(0));await second;assert.match(f.get('BackgroundStatus').textContent,/ניסיון נוסף/);
 f.get('Background').click();await f.get('SaveAll').click();
 assert.equal(f.uploads.length,2);assert.equal(cuts,1);assert.deepEqual(f.saves[0],f.saves[1]);assert.equal(f.get('Next').disabled,false);
 f.get('Close').click();await done;
});

test('upload through a time selects complete segments by their end on the source timeline, regardless of draft order',async()=>{
 const f=fixture({cut:async({name})=>new File(['clip'],name+'.mp4')}),done=f.prepare(['film.mp4']);
 openSegments(f);
 for(const [index,[start,end]] of [[0,1],[1,2],[2,5]].entries()){
  if(index)f.get(index===2?'PinNext':'Next').click();
  boundary(f,'StartTime',String(start));boundary(f,'EndTime',String(end));f.get('Name').value='Part '+(index+1);
 }
 // A locked second range keeps its original times if the first is later edited.
 f.get('Previous').click();f.get('Previous').click();boundary(f,'StartTime','6');boundary(f,'EndTime','8');
 f.get('Player').currentTime=5;f.get('CutoffHere').click();
 assert.equal(f.get('CutoffTime').value,'5');
 const batch=f.get('SaveThrough').click();await waitForUpload(f,1);f.uploads[0].resolve(f.result(0));
 await waitForUpload(f,2);f.uploads[1].resolve(f.result(1));await batch;
 assert.deepEqual(f.saves.map(entry=>entry.data.metadata.name),['Part 2','Part 3']);
 assert.equal(f.get('SaveThrough').disabled,true);assert.equal(f.get('SaveAll').disabled,false);
 const rest=f.get('SaveAll').click();await waitForUpload(f,3);f.uploads[2].resolve(f.result(2));await rest;
 assert.equal(f.saves[2].data.metadata.name,'Part 1');assert.equal(f.get('Done').hidden,false);
 f.get('Done').click();await done;
});

test('late metadata keeps a playing segment at its playhead; changing segments deliberately seeks', async () => {
 const f=fixture(), done=f.prepare(['tape.mp4']);
 openSegments(f); boundary(f,'EndTime','5');
 const player=f.get('Player');
 await player.play(); player.currentTime=2.5;
 const pauses=player.pauseCount;
 await player.onloadedmetadata();
 assert.equal(player.currentTime,2.5); assert.equal(player.pauseCount,pauses);
 f.get('Next').click();
 assert.equal(player.paused,true); assert.equal(player.currentTime,5);
 f.get('Close').click(); await done;
});

test('a lightweight copy keeps original time, tags and source for both segment export and the full upload', async () => {
 const original=new File(['high quality'],'source.mp4',{type:'video/mp4'});
 const light=new File(['light'],'preview.webm',{type:'video/webm'});
 const cuts=[];
 const worker={postMessage(message){this.input=message.file;},terminate(){this.stopped=true;}};
 const f=fixture({previewWorker:()=>worker,cut:async options=>{cuts.push(options);return new File(['export'],'segment.mp4');}});
 const done=f.prepare([original]); openSegments(f); boundary(f,'StartTime','1');boundary(f,'EndTime','4');
 f.get('Caption').value='Birthday';tagName(f,'Grandmother');
 f.get('Split').click();
 assert.equal(f.get('PlaybackTools').hidden,false);
 f.get('PreviewMode').click();
 assert.equal(worker.input,original);
 worker.onmessage({data:{percent:30}});assert.equal(f.get('PreviewProgress').value,30);
 f.get('Player').currentTime=2.75;
 worker.onmessage({data:{file:light}});
 const probe=f.probes.at(-1);probe.duration=8.05;probe.videoWidth=240;probe.onloadedmetadata();await tick();
 assert.equal(worker.stopped,true);assert.equal(f.urls.at(-1),light);
 const player=f.get('Player');player.duration=8.05;player.currentTime=0;await player.onloadedmetadata();
 assert.equal(player.currentTime,2.75);
 f.get('PreviewPlay').click();assert.equal(player.paused,false);f.get('PreviewPlay').click();assert.equal(player.paused,true);
 f.get('Split').click();
 assert.equal(f.get('EndSlider').max,8);
 f.get('Next').click();f.get('Previous').click();
 assert.equal(f.get('Caption').value,'Birthday');assert.equal(f.urls.at(-1),light);
 const part=f.get('SaveCurrent').click();await waitForUpload(f,1);
 assert.equal(cuts[0].file,original);assert.deepEqual({...cuts[0].range},{start:1,end:4});
 assert.deepEqual(f.uploads[0].file.name,'segment.mp4');
 f.uploads[0].resolve(f.result(0));await part;
 assert.deepEqual(f.saves[0].data.metadata.people,[{name:'Grandmother'}]);
 f.get('Split').click();const full=f.get('SaveCurrent').click();await waitForUpload(f,2);
 assert.equal(f.uploads[1].file,original);f.uploads[1].resolve(f.result(1));await full;await done;
 assert.equal(f.revoked.length,f.urls.length);
});

test('a manual preview must match the source, and a canceled conversion cannot replace the next video', async () => {
 const worker={postMessage(){},terminate(){this.stopped=true;}};
 const f=fixture({previewWorker:()=>worker}),done=f.prepare(['a.mp4','b.mp4']);
 const player=f.get('Player'),field=f.get('PreviewFile');
 player.duration=90;await player.onloadedmetadata();
 const originalUrl=player.src;
 function choose(duration) {
  field.files=[new File(['copy'],'copy.mp4',{type:'video/mp4'})];field.listeners.get('change')();
  const probe=f.probes.at(-1);probe.videoWidth=320;probe.duration=duration;probe.onloadedmetadata();
 }
 choose(83);await tick();
 assert.equal(player.src,originalUrl);assert.match(f.get('PreviewStatus').textContent,/משך העותק שונה/);
 choose(90.04);await tick();assert.notEqual(player.src,originalUrl);
 assert.equal(f.get('PreviewMode').attributes.get('aria-pressed'),'true');
 f.get('PreviewMode').click(); assert.equal(f.get('PreviewMode').attributes.get('aria-pressed'),'false');
 f.get('Next').click();f.get('PreviewMode').click();f.get('Previous').click();
 assert.equal(worker.stopped,true);const active=player.src;
 worker.onmessage({data:{file:new File(['stale'],'stale.mp4')}});await tick();
 assert.equal(player.src,active);
 f.get('Close').click();await done;assert.equal(f.revoked.length,f.urls.length);
});

test('staging keeps the local file seekable when splitting and supplies remote playback and successive segment saves',async()=>{
 const f=fixture(),original=new File(['original video'],'family.mp4',{type:'video/mp4'});
 const transfer=deferred(),sources=[],publications=[];
 function stage(file,{changed}){
  const source={file,received:0,phase:'uploading',url:null,discard(){this.discarded=true;},
   ensure(){return transfer.promise;},async save(record){publications.push(record);return {item:{id:record.mediaId}};}};
  sources.push(source);source.refresh=()=>changed(source);return source;
 }
 const done=f.prepare([original],{stageSources:stage});
 assert.equal(sources.length,1);assert.equal(f.get('SourcePanel').hidden,false);
 const [source]=sources;
 source.received=5;source.refresh();assert.match(f.get('SourceStatus').textContent,/התקבלו באתר/);
 openSegments(f,8);boundary(f,'StartTime','1');boundary(f,'EndTime','3');
 const player=f.get('Player'),local=player.src;assert.match(local,/^blob:/);
 source.phase='ready';source.url='https://family.example/api/video-sources/test/play';transfer.resolve(source);source.refresh();
 assert.equal(player.src,local,'a completed upload cannot replace the local file during a scrub');
 assert.equal(f.get('PlaybackTools').hidden,true);
 f.get('Split').click();assert.equal(player.src,source.url);
 player.currentTime=5.75;player.readyState=0;await player.play();
 f.get('Split').click();assert.match(player.src,/^blob:/);
 player.currentTime=0;player.readyState=2;await player.onloadedmetadata();player.listeners.get('loadedmetadata')();
 assert.equal(player.currentTime,1);assert.equal(player.paused,true,'entering the cut cancels resume on the old source');
 await player.play();assert.equal(player.paused,false);player.pause();
 await f.get('SaveCurrent').click();
 f.get('Next').click();boundary(f,'EndTime','6');await f.get('SaveCurrent').click();
 assert.equal(publications.length,2);assert.deepEqual(publications.map(p=>({...p.metadata.range})),[{start:1,end:3},{start:3,end:6}]);
 assert.equal(sources.length,1);assert.equal(f.uploads.length,0);
 f.get('Done').click();await done;assert.equal(source.discarded,true);assert.ok(!f.revoked.includes(source.url));
});

function controlledChecks() {
 const checks=[];
 return {checks,check(file,changed){
  const gate=deferred();
  const state={file,phase:'checking',percent:0,ready:gate.promise,discard(){this.discarded=true;},
   complete(fields){Object.assign(this,fields);changed(this);gate.resolve(this);}};
  checks.push(state);return state;
 }};
}

test('saving during inspection waits for the repaired source, for both cloud and local uploads',async()=>{
 for(const cloud of [true,false]){
  const {check,checks}=controlledChecks(), f=fixture({check});
  const input=new File(['input'],'tape.mp4'), fixed=new File(['fixed'],'tape.mp4');
  const staged=[],published=[];
  function stage(file){
   staged.push(file);
   return {file,phase:'ready',received:file.size,url:'https://family.example/fixed',discard(){},
    ensure:async()=>{},save:async payload=>{published.push(payload);return {item:{id:payload.mediaId}};}};
  }
  const done=f.prepare([input],{stageSources:cloud&&stage});
  f.get('Caption').value='Edited while checking';
  const save=f.get('SaveCurrent').click();
  assert.equal(staged.length+f.uploads.length,0);
  checks[0].complete({file:fixed,phase:'ready',repaired:2,verified:true});
  if(!cloud){
   await waitForUpload(f,1);assert.equal(f.uploads[0].file,fixed);f.uploads[0].resolve(f.result(0));
  }
  await save;await done;
  assert.equal(f.urls.includes(input),false);
  assert.equal(f.urls.includes(fixed),true);
  assert.equal(cloud?staged[0]:f.uploads[0].file,fixed);
  assert.equal(cloud?published[0].metadata.caption:f.saves[0].data.metadata.caption,'Edited while checking');
 }
});

test('segment export uses the repaired picture while preserving marks and edited metadata',async()=>{
 const {check,checks}=controlledChecks(), cuts=[];
 const f=fixture({check,cut:async options=>{cuts.push(options);return new File(['cut'],'clip.mp4');}});
 const input=new File(['in'],'source.mp4'), fixed=new File(['fixed'],'source.mp4');
 const done=f.prepare([input]);f.get('Caption').value='Family';
 checks[0].complete({file:fixed,phase:'ready',repaired:1,verified:true});
 assert.equal(f.get('Caption').value,'Family');openSegments(f,10);boundary(f,'EndTime','3');
 const saving=f.get('SaveCurrent').click();await waitForUpload(f,1);
 assert.equal(checks.length,1);assert.equal(cuts[0].file,fixed);
 assert.deepEqual({...cuts[0].range},{start:0,end:3});
 f.uploads[0].resolve(f.result(0));await saving;f.get('Done').click();await done;
});

test('an unrepairable file is never sent, and a canceled or removed check cannot stage late',async()=>{
 const {check,checks}=controlledChecks(),f=fixture({check});
 const done=f.prepare(['a.mp4','b.mp4'],{stageSources:()=>assert.fail('Unexpected upload')});
 const save=f.get('SaveCurrent').click();
 checks[0].complete({phase:'failed',error:{code:'VIDEO_DECODE'}});
 await save;assert.equal(f.get('SaveCurrent').disabled,true);assert.match(f.get('Error').textContent,/בדיקת הניגון/);
 f.get('CheckRetry').click();assert.equal(checks.length,2);
 f.get('Remove').click();assert.equal(checks[1].discarded,true);
 checks[1].complete({file:new File(['stale'],'a.mp4'),phase:'ready',verified:true});
 assert.equal(f.get('Filename').textContent,'b.mp4');
 f.get('Close').click();await done;assert.equal(checks[2].discarded,true);
});

test('history restores a whole drag, exact playhead, cuts and locks and invalidates redo after another edit',async()=>{
 const f=fixture(),done=f.prepare(['tape.mp4']);openSegments(f,837.96);
 boundary(f,'EndTime','144.27');boundary(f,'Playhead','123.456');
 const slider=f.get('EndSlider'),player=f.get('Player');
 slider.listeners.get('pointerdown')();boundary(f,'EndSlider','171');boundary(f,'EndSlider','192.53');slider.listeners.get('pointerup')();
 const key=(letter,target=slider)=>pressEditorKey(f,target,letter==='Z'?'ז':'ט','Key'+letter,{ctrlKey:true});
 assert.equal(key('Z'),true);assert.equal(player.currentTime,123.456);assert.equal(f.get('EndTime').value,'144.27');
 key('Y');assert.equal(player.currentTime,192.53);assert.equal(f.get('EndTime').value,'192.53');
 f.get('PinNext').click();assert.equal(f.get('Title').textContent,'מקטע 2');
 key('Z',player);assert.equal(f.get('Title').textContent,'מקטע 1');assert.equal(f.get('EndSlider').disabled,false);
 key('Y',player);assert.equal(f.get('Title').textContent,'מקטע 2');assert.equal(Number(f.get('EndSlider').min),192.53);
 boundary(f,'EndTime','400');f.get('Reset').click();key('Z');assert.equal(f.get('EndTime').value,'400');
 boundary(f,'EndSlider','350');key('Y');assert.equal(f.get('EndTime').value,'350');
 assert.equal(key('Z',f.get('Caption')),false,'native text undo stays available');
 key('Z');boundary(f,'Playhead','211.75');key('Z');assert.equal(player.currentTime,400);
 player.listeners.get('pointerdown')();player.currentTime=310;player.listeners.get('seeking')();
 key('Z',player);assert.equal(player.currentTime,400);key('Y',player);assert.equal(player.currentTime,310);
 f.get('Close').click();await done;
});

test('pressing a colored mark seeks to the exact point and selects it in one undoable gesture',async()=>{
 const f=fixture(),done=f.prepare(['tape.mp4']);openSegments(f,120);
 boundary(f,'EndTime','40');f.get('PinNext').click();boundary(f,'EndTime','100');
 const track=f.get('Track'),player=f.get('Player'),first=markedButton(0);
 await player.play();
 assert.equal(railPointer(f,'pointerdown',65.25,first).defaultPrevented,true);
 assert.equal(player.paused,true);assert.equal(player.currentTime,21.75);
 assert.equal(track.hasPointerCapture(1),true);assert.equal(track.classes.has('is-scrubbing'),true);
 railPointer(f,'pointerup',65.25);
 track.listeners.get('click')({target:first,detail:1});
 assert.equal(f.get('Title').textContent,'מקטע 1');assert.equal(player.currentTime,21.75);
 assert.equal(f.get('EndTime').value,'40');assert.equal(track.classes.has('is-scrubbing'),false);
 pressEditorKey(f,f.get('Playhead'),'z','KeyZ',{ctrlKey:true});
 assert.equal(f.get('Title').textContent,'מקטע 2');assert.equal(player.currentTime,100);
 pressEditorKey(f,f.get('Playhead'),'y','KeyY',{ctrlKey:true});
 assert.equal(f.get('Title').textContent,'מקטע 1');assert.equal(player.currentTime,21.75);
 railPointer(f,'pointerdown',315);railPointer(f,'pointerup',315);
 assert.equal(player.currentTime,105);assert.equal(f.get('Title').textContent,'מקטע 1');
 track.listeners.get('click')({target:markedButton(1),detail:0});
 assert.equal(f.get('Title').textContent,'מקטע 2');assert.equal(player.currentTime,40);
 f.get('Close').click();await done;
});

test('left and right navigate cuts from the pager, video or playhead and show the destination start',async()=>{
 const f=fixture(),done=f.prepare(['tape.mp4']);openSegments(f,120);
 const player=f.get('Player'),thumb=f.get('Playhead');
 const arrow=(target,key,options)=>pressEditorKey(f,target,key,key,options);
 boundary(f,'StartTime','3.24');boundary(f,'EndTime','39.8');f.get('Next').click();
 boundary(f,'StartTime','42.44');boundary(f,'EndTime','98');f.get('Previous').click();
 assert.equal(player.currentTime,3.24);
 boundary(f,'Playhead','9.48');await player.play();
 assert.equal(arrow(f.get('Previous'),'ArrowRight'),true);
 assert.equal(f.get('Title').textContent,'מקטע 2');assert.equal(player.paused,true);assert.equal(player.currentTime,42.44);
 arrow(player,'ArrowRight',{repeat:true});assert.equal(f.get('Title').textContent,'מקטע 2');
 for(const field of ['Caption','Name','Dateyear','EndTime','EndSlider']){
  assert.equal(arrow(f.get(field),'ArrowLeft'),false);
 }
 assert.equal(arrow(player,'ArrowLeft',{altKey:true}),false);
 boundary(f,'Playhead','79.52');
 arrow(thumb,'ArrowLeft');assert.equal(f.get('Title').textContent,'מקטע 1');assert.equal(player.currentTime,3.24);
 arrow(f.get('Next'),'ArrowLeft');assert.equal(f.get('Title').textContent,'מקטע 1');
 player.readyState=0;arrow(player,'ArrowRight');
 assert.equal(Number(thumb.value),42.44);assert.equal(player.currentTime,3.24);
 player.readyState=1;player.listeners.get('loadedmetadata')();await new Promise(resolve=>setTimeout(resolve,8));
 assert.equal(player.currentTime,42.44);
 f.get('Close').click();await done;
});

test('clicks across saved clips use local media times and obsolete metadata cannot overwrite later navigation',async()=>{
 const f=fixture();
 const segments=[{id:'one',src:'/one.mp4',number:1,start:0,end:40,name:'One'},{id:'two',src:'/two.mp4',number:2,start:40,end:120,name:'Two'}];
 f.window.FamilyI18n.fetch=async()=>Response.json({duration:120,segments});
 await f.window.FamilyVideoUpload.openProject('one');
 const player=f.get('Player'),thumb=f.get('Playhead');
 player.readyState=0;
 railPointer(f,'pointerdown',225,markedButton(1));railPointer(f,'pointerup',225);
 assert.equal(player.src,'/two.mp4');assert.equal(Number(thumb.value),75);
 player.readyState=2;player.listeners.get('loadedmetadata')();await new Promise(resolve=>setTimeout(resolve,8));
 assert.equal(player.currentTime,35);assert.equal(Number(thumb.value),75);
 player.readyState=0;
 railPointer(f,'pointerdown',60,markedButton(0));railPointer(f,'pointerup',60);
 assert.equal(Number(thumb.value),20);player.listeners.get('loadedmetadata')();
 pressEditorKey(f,thumb,'ArrowRight','ArrowRight');
 player.readyState=2;player.listeners.get('loadedmetadata')();await new Promise(resolve=>setTimeout(resolve,8));
 assert.equal(player.src,'/two.mp4');assert.equal(player.currentTime,0);assert.equal(Number(thumb.value),40);
 f.get('Close').click();
});

test('scrubbing waits for decoding, coalesces reversals, preserves the grab offset and lands on release',async()=>{
 const f=fixture(),done=f.prepare(['tape.mp4']);openSegments(f,120);
 boundary(f,'EndTime','90');boundary(f,'Playhead','80');
 const player=f.get('Player'),track=f.get('Track'),thumb=f.get('Playhead'),issued=[];
 let mediaTime=80;
 Object.defineProperty(player,'currentTime',{get:()=>mediaTime,set:time=>{issued.push(time);mediaTime=time;player.seeking=true;}});
 const decoded=async()=>{player.seeking=false;player.listeners.get('seeked')();await new Promise(resolve=>setTimeout(resolve,8));};
 railPointer(f,'pointerdown',243,thumb); // Grab three pixels to the right of the center.
 assert.deepEqual(issued,[]);
 railPointer(f,'pointermove',303);assert.deepEqual(issued,[100]);
 for(const x of [294,273,249,183,123])railPointer(f,'pointermove',x);
 player.listeners.get('timeupdate')();
 assert.deepEqual(issued,[100]);assert.equal(Number(thumb.value),40);
 await decoded();assert.deepEqual(issued,[100,40]);
 railPointer(f,'pointermove',108);railPointer(f,'pointermove',63);
 assert.equal(Number(thumb.value),20);railPointer(f,'pointerup',33);
 assert.deepEqual(issued,[100,40,10]);assert.equal(track.hasPointerCapture(1),false);
 await decoded();assert.equal(Number(thumb.value),10);assert.equal(f.get('EndTime').value,'90');
 pressEditorKey(f,thumb,'z','KeyZ',{ctrlKey:true});await decoded();assert.equal(mediaTime,80);
 railPointer(f,'pointerdown',240,thumb);railPointer(f,'pointermove',-60);railPointer(f,'pointercancel',-60);
 assert.equal(track.classes.has('is-scrubbing'),false);assert.equal(mediaTime,0);await decoded();
 railPointer(f,'pointermove',340);assert.equal(mediaTime,0);
 f.get('Close').click();await done;
});

test('the final pin wraps to the first cut, including a single fractional-duration clip, and can be undone',async()=>{
 for(const splitAt of [0,144.27]){
  const f=fixture(),done=f.prepare(['tape.mp4']);openSegments(f,837.96);
  if(splitAt){boundary(f,'EndTime',String(splitAt));f.get('PinNext').click();}
  boundary(f,'EndSlider','837.96');f.get('PinNext').click();
  assert.equal(f.get('Title').textContent,'מקטע 1');assert.equal(f.get('Player').currentTime,0);
  assert.equal((f.get('Marks').innerHTML.match(/data-pinned="true"/g)||[]).length,splitAt?2:1);
  pressEditorKey(f,f.get('Player'),'z','KeyZ',{ctrlKey:true});
  assert.equal(f.get('Title').textContent,splitAt?'מקטע 2':'מקטע 1');assert.equal(f.get('Player').currentTime,837.96);
  assert.equal(f.get('EndSlider').disabled,false);
  pressEditorKey(f,f.get('Player'),'y','KeyY',{ctrlKey:true});assert.equal(f.get('Title').textContent,'מקטע 1');
  f.get('Close').click();await done;
 }
});

test('all thirty marks have distinct colors and segment 31 starts the same cycle',()=>{
 const colors=Array.from({length:30},(_,i)=>segmentColor(i+1));
 assert.equal(new Set(colors).size,30);
 assert.deepEqual(Array.from({length:30},(_,i)=>segmentColor(i+31)),colors);
});

test('saved cuts stay editable in the open wizard and reopen as a group from a fresh session',async()=>{
 const publications=[],records=new Map(),requests=[];
 function stage(file){
  return {file,phase:'ready',received:file.size,url:'https://family.example/source',ensure:async()=>{},discard(){},
   async save({mediaId,metadata}){
    publications.push(metadata.segmentProject);
    const item={id:mediaId,src:'/media/'+mediaId,name:metadata.name,caption:metadata.caption,takenDate:metadata.date};
    records.set(mediaId,{item,info:metadata.segmentProject});return {item};
   }};
 }
 function api(f){
  f.window.FamilyI18n.fetch=async(path,options)=>{
   requests.push(path);const entry=records.get(path.split('/')[2]);
   if(!options)return Response.json({duration:8,segments:[...records.values()].map(({item,info})=>({...item,date:item.takenDate,number:info.number,start:info.start,end:info.end}))});
   assert.match(path,/video-segment-details$/);const {after}=JSON.parse(options.body);
   Object.assign(entry.item,{name:after.name,caption:after.caption,takenDate:after.date});
   return Response.json({item:entry.item});
  };
 }
 const f=fixture();api(f);const done=f.prepare(['one.mp4'],{stageSources:stage});
 openSegments(f);boundary(f,'EndTime','3.75');f.get('PinNext').click();boundary(f,'EndSlider','8');f.get('PinNext').click();
 await f.get('SaveAll').click();assert.equal(f.get('Wizard').open,true);
 assert.equal(f.get('Name').disabled,false);assert.equal(f.get('EndSlider').disabled,true);
 assert.equal(publications.length,2);assert.equal(publications[0].id,publications[1].id);
 assert.deepEqual(publications.map(p=>[p.number,p.start,p.end,p.duration]),[[1,0,3.75,8],[2,3.75,8,8]]);
 boundary(f,'Name','חג המשפחה');boundary(f,'Dateyear','1998');f.get('Next').click();boundary(f,'Caption','בחצר');
 await f.get('SaveAll').click();assert.equal(f.get('Wizard').open,true);assert.equal(publications.length,2);
 f.get('Close').click();await done;
 const second=[...records.keys()][1],g=fixture();api(g);await g.window.FamilyVideoUpload.openProject(second);
 assert.equal(g.get('Title').textContent,'מקטע 2');assert.equal(g.get('Caption').value,'בחצר');
 assert.equal(g.get('Player').src,'/media/'+second);assert.equal(g.get('StartTime').value,'3.75');
 boundary(g,'Playhead','5.25');assert.equal(g.get('Player').currentTime,1.5);
 g.get('Next').click();assert.equal(g.get('Title').textContent,'מקטע 1');assert.equal(g.get('Name').value,'חג המשפחה');assert.equal(g.get('Dateyear').value,1998);
 boundary(g,'Caption','טיול');g.window.confirm=()=>false;g.get('Done').click();assert.equal(g.get('Wizard').open,true);
 await g.get('SaveCurrent').click();g.get('Done').click();assert.equal(g.get('Wizard').open,false);
 assert.equal(requests.filter(p=>p.endsWith('video-segment-details')).length,3);assert.equal(publications.length,2);assert.equal(g.uploads.length,0);
});

test('the main playhead follows each cut during a single drag, retaining the exact time, metadata and undo group',async()=>{
 const f=fixture(),done=f.prepare(['tape.mp4']);openSegments(f,120);
 const title=()=>f.get('Title').textContent,player=f.get('Player'),thumb=f.get('Playhead');
 boundary(f,'Caption','ראשון');boundary(f,'Dateyear','1989');boundary(f,'EndTime','30');f.get('PinNext').click();
 boundary(f,'Caption','שני');boundary(f,'Dateyear','1990');boundary(f,'StartTime','38');boundary(f,'EndTime','70');f.get('PinNext').click();
 boundary(f,'Caption','שלישי');boundary(f,'Dateyear','1991');boundary(f,'EndTime','120');
 const loads=player.loadCount;
 railPointer(f,'pointerdown',360,thumb);
 railPointer(f,'pointermove',150);assert.equal(title(),'מקטע 2');assert.equal(player.currentTime,50);assert.equal(f.get('Dateyear').value,1990);assert.equal(f.get('Caption').value,'שני');
 railPointer(f,'pointermove',99);assert.equal(title(),'מקטע 2','A gap preserves the last displayed draft');assert.equal(player.currentTime,33);
 railPointer(f,'pointermove',66);assert.equal(title(),'מקטע 1');assert.equal(player.currentTime,22);assert.equal(f.get('Caption').value,'ראשון');
 railPointer(f,'pointermove',210);assert.equal(title(),'מקטע 3','The shared boundary belongs to the following cut');assert.equal(player.currentTime,70);
 railPointer(f,'pointermove',147);railPointer(f,'pointerup',147);
 assert.equal(player.currentTime,49);assert.equal(title(),'מקטע 2');assert.equal(player.loadCount,loads);
 pressEditorKey(f,thumb,'z','KeyZ',{ctrlKey:true});assert.equal(title(),'מקטע 3');assert.equal(player.currentTime,120);assert.equal(f.get('Caption').value,'שלישי');
 pressEditorKey(f,thumb,'y','KeyY',{ctrlKey:true});assert.equal(title(),'מקטע 2');assert.equal(player.currentTime,49);
 f.get('Close').click();await done;
});

test('dragging between colored lanes at the same film time selects the lane under the hand',async()=>{
 const f=fixture(),done=f.prepare(['tape.mp4']);openSegments(f,120);
 boundary(f,'EndTime','60');f.get('PinNext').click();boundary(f,'StartTime','30');boundary(f,'EndTime','90');
 const track=f.get('Track'),marks=[markedButton(0),markedButton(1)];
 track.ownerDocument={elementsFromPoint:(_x,y)=>[f.get('Playhead'),marks[y<14?0:1],track]};
 track.contains=hit=>marks.includes(hit);
 railPointer(f,'pointerdown',270,f.get('Playhead'),20);
 railPointer(f,'pointermove',135,track,20);assert.equal(f.get('Title').textContent,'מקטע 2');
 railPointer(f,'pointermove',135,track,5);assert.equal(f.get('Title').textContent,'מקטע 1');assert.equal(f.get('Player').currentTime,45);
 railPointer(f,'pointerup',135,track,5);f.get('Close').click();await done;
});

test('the upload picker excludes existing identities per segment, restores removed tags and discards stale searches',async()=>{
 const f=fixture(),people=[{id:'one',name:'יחיאל קהא'},{id:'two',name:'יחיאל קהא'}],late=deferred();
 f.window.FamilyTags={findPeople:async query=>query==='late'?late.promise:people.filter(person=>person.name.includes(query))};
 f.window.FamilyI18n.personName=p=>p.name;
 const done=f.prepare(['tape.mp4']);openSegments(f,10);
 const type=query=>{f.get('Search').value=query;return f.get('Search').listeners.get('input')();};
 const clickOption=(key,value)=>{
  const add=key==='videoAddPerson',button={dataset:{[key]:String(value)},hasAttribute:()=>false};
  f.get('Wizard').listeners.get('click')({target:{closest:selector=>selector.includes(add?'[data-video-add-person]':'[data-video-remove-person]')?button:null}});
 };
 const options=()=>(f.get('Results').innerHTML.match(/data-video-add-person=/g)||[]).length;
 await type('יחיאל');assert.equal(options(),2);clickOption('videoAddPerson',0);
 await type('יחיאל');assert.equal(options(),1);clickOption('videoAddPerson',0);
 await type('יחיאל קהא');assert.equal(options(),0);assert.doesNotMatch(f.get('Results').innerHTML,/data-video-add-name/);
 clickOption('videoRemovePerson',0);await tick();assert.equal(options(),1);
 const waiting=type('late');boundary(f,'EndTime','4');f.get('Next').click();late.resolve(people);await waiting;assert.equal(options(),0);
 await type('יחיאל קהא');assert.equal(options(),2);assert.equal(f.get('PeopleTags').innerHTML,'');
 f.get('Previous').click();await type('יחיאל');assert.equal(options(),1);
 tagName(f,'אורח חדש');await type('אוֹרח   חדש');assert.doesNotMatch(f.get('Results').innerHTML,/data-video-add-name/);
 f.get('Close').click();await done;
});

test('segment batch progress counts confirmed saves, covers source and metadata retries, and stays visible in the background',async()=>{
 const f=fixture(),saves=[],original=deferred();let change,staged;
 const stage=(file,{changed})=>{
  change=changed;staged={file,phase:'uploading',received:0,ensure:()=>original.promise,discard(){},
   save:()=>{const wait=deferred();saves.push(wait);return wait.promise;}};
  return staged;
 };
 const done=f.prepare(['film.mp4'],{stageSources:stage});openSegments(f,12);
 for(const end of [4,8,12]){boundary(f,'EndTime',String(end));f.get('PinNext').click();}
 const check=(count,percent)=>{
  assert.equal(f.get('BatchMeter').hidden,false);assert.equal(f.get('BatchProgress').value,percent);
  assert.equal(f.get('BackgroundProgress').value,percent);assert.match(f.get('BatchCount').textContent,new RegExp(count+' מתוך 3'));
 };
 const saving=f.get('SaveAll').click();check(0,0);
 staged.received=staged.file.size/2;change(staged);assert.equal(f.get('Progress').value,50);assert.match(f.get('Status').textContent,/50%/);
 f.get('Close').click();assert.equal(f.get('Background').hidden,false);assert.match(f.get('BackgroundStatus').textContent,/50%/);
 staged.phase='ready';original.resolve();await tick();saves[0].resolve({item:{id:'one'}});await tick();check(1,33);
 saves[1].reject(new Error('Try again'));await saving;check(1,33);assert.match(f.get('BackgroundStatus').textContent,/ניסיון נוסף/);
 f.get('Background').click();const retry=f.get('SaveAll').click();check(1,33);await tick();
 saves[2].resolve({item:{id:'two'}});await tick();check(2,66);assert.match(f.get('Status').textContent,/מקטע 3/);
 saves[3].resolve({item:{id:'three'}});await retry;check(3,100);assert.equal(f.get('Wizard').open,true);
 assert.equal(saves.length,4);f.get('Close').click();await done;
});

test('batch progress shows current transfer separately and excludes unfinished cuts and cuts beyond the requested end',async()=>{
 const f=fixture({cut:async({file})=>file}),done=f.prepare(['record.mp4']);openSegments(f,12);
 for(const end of [4,8,10]){boundary(f,'EndTime',String(end));f.get('Next').click();}
 boundary(f,'CutoffTime','8');
 const saving=f.get('SaveThrough').click();await waitForUpload(f,1);
 assert.match(f.get('BatchCount').textContent,/0 מתוך 2/);f.uploads[0].progress(100);
 assert.equal(f.get('BatchProgress').value,0,'Received bytes do not confirm a saved cut');
 f.uploads[0].resolve(f.result(0));await waitForUpload(f,2);f.uploads[1].progress(37);
 assert.equal(f.get('BatchProgress').value,50);assert.equal(f.get('Progress').value,37);
 f.uploads[1].resolve(f.result(1));await saving;assert.equal(f.get('BatchProgress').value,100);
 const remaining=f.get('SaveAll').click();await waitForUpload(f,3);assert.match(f.get('BatchCount').textContent,/2 מתוך 3/);
 f.uploads[2].resolve(f.result(2));await remaining;assert.match(f.get('BatchCount').textContent,/3 מתוך 3/);
 f.get('Close').click();await done;
});

test('save work keeps an unfinished cut editable, closes cleanly and resumes at the saved playhead without another upload',async()=>{
 const store={},published=[];let saves=0;
 const file={name:'family.mp4',size:500,type:'video/mp4'};
 function stage(blob){
  return {file:blob,phase:'ready',received:500,url:'https://test.example/whole.mp4',ensure:async()=>{},discard(){},
   async save({mediaId,metadata}){
    published.push({id:mediaId,name:metadata.name,caption:metadata.caption,date:metadata.date});
    return {item:{id:mediaId,name:metadata.name,caption:metadata.caption,takenDate:metadata.date}};
   },
   async saveWork({workId,revision,snapshot}){
    assert.equal(revision,store.revision||null);Object.assign(store,{workId,revision:String(++saves),snapshot:structuredClone(snapshot)});
    return {operation:'video-segment-work',workRevision:store.revision};
   },async resume(workId){assert.equal(workId,store.workId);this.file=file;return {scope:'nostalgia',workRevision:store.revision,snapshot:structuredClone(store.snapshot),published:structuredClone(published)};}};
 }
 const f=fixture({sourceFactory:stage}),done=f.prepare([file],{stageSources:stage,eventId:''});openSegments(f,12);
 boundary(f,'EndTime','4');f.get('PinNext').click();
 boundary(f,'Name','בחצר');boundary(f,'Caption','כאן ממשיכים');boundary(f,'Dateyear','1998');tagName(f,'דוד');
 boundary(f,'StartTime','5.25');
 assert.equal(f.get('SaveWork').hidden,false);await f.get('SaveWork').click();
 assert.equal(f.get('Wizard').open,true);assert.match(f.get('Status').textContent,/סרטונים לא משויכים/);
 assert.equal(store.snapshot.segments.length,2);assert.equal(store.snapshot.segments[0].segment.pinned,true);
 assert.equal(store.snapshot.segments[1].segment.end,null);assert.equal(store.snapshot.position,5.25);
 assert.equal(f.uploads.length,0);f.window.confirm=()=>assert.fail('A confirmed checkpoint closed with a warning');
 f.get('Close').click();await done;
 await f.window.FamilyVideoUpload.openWork(store.workId);
 assert.equal(f.get('Wizard').open,true);assert.equal(f.get('Title').textContent,'מקטע 2');
 assert.equal(f.get('Name').value,'בחצר');assert.equal(f.get('Dateyear').value,1998);
 assert.equal(f.get('Caption').value,'כאן ממשיכים');assert.match(f.get('PeopleTags').innerHTML,/דוד/);
 assert.equal(f.get('Player').src,'https://test.example/whole.mp4');
 assert.equal(Number(f.get('Playhead').value),5.25);assert.equal(f.get('EndTime').value,'');
 assert.equal(f.get('Name').disabled,false);
 boundary(f,'EndTime','9');f.get('PinNext').click();assert.equal(f.get('Title').textContent,'מקטע 3');assert.equal(Number(f.get('StartTime').value),9);
 let asked=false;f.window.confirm=()=>{asked=true;return false;};f.get('Close').click();assert.equal(asked,true);assert.equal(f.get('Wizard').open,true);
 await f.get('SaveAll').click();assert.equal(saves,2);assert.equal(store.snapshot.segments.length,3);
 assert.equal(published.length,2);assert.equal(store.snapshot.segments[2].segment.end,null);
 assert.match(f.get('Status').textContent,/המקטעים והעבודה נשמרו/);
 f.get('Close').click();assert.equal(f.get('Wizard').open,false);
});
