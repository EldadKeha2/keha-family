import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import vm from 'node:vm';
import {bindSegmentTimeline, markedRange, prepareSegmentFile, segmentControlsHTML, segmentHue} from '../public/assets/video-upload-segments.mjs';
import {videoUploadMetadata} from '../public/assets/video-upload-metadata.mjs';
import {bindUploadPreview} from '../public/assets/video-upload-preview.mjs';
import {filenamePhotoDate} from '../public/assets/photo-upload-metadata.mjs';

const source=(await readFile(new URL('../public/assets/video-upload-wizard.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'');
const swipeSource=await readFile(new URL('../public/assets/photo-swipe.js',import.meta.url),'utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function deferred(){let resolve,reject;const promise=new Promise((done,failed)=>{resolve=done;reject=failed;});return {promise,resolve,reject};}
function fixture({finalize,categories,cut=prepareSegmentFile,previewWorker}={}){
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
  setPointerCapture(id){this.captures.push(id);}
  querySelectorAll(selector){return [...nodes.values()].filter(node=>node.parent===this&&(selector==='[data-video-draft-field]'?node.field:selector==='[data-video-boundary]'?node.boundary:['input','textarea','select','button'].includes(node.tag)));}
  showModal(){this.open=true;}
  close(){this.open=false;this.listeners.get('close')?.();}
  canPlayType(){return 'probably';} play(){this.paused=false;this.listeners.get('play')?.();return Promise.resolve();} pause(){this.paused=true;this.pauseCount++;this.listeners.get('pause')?.();} load(){this.loadCount++;} replaceChildren(){} blur(){} focus(){this.focused=true;}
  click(){assert.equal(this.disabled,false,'clicked control is enabled');return this.listeners.get('click')?.();}
 }
 const document={getElementById:id=>nodes.get(id),createElement:tag=>{const node=new Element(tag);if(tag==='video')probes.push(node);return node;},addEventListener:(name,fn)=>events.set(name,fn),body:{append(node){nodes.set(node.id,node);}}};
 const window={FAMILY_API_TOKEN:'test',FamilyI18n:{isEnglish:false,error:String,fetch:async(path,options)=>{const data=JSON.parse(options.body);saves.push({path,data});return finalize?finalize(saves.length,data):Response.json({item:{id:path.split('/')[2]}});}},FamilyVideoCategories:categories,FamilyVideoEditor:{icon:'',clock:String,seconds:text=>String(text).trim()?String(text).split(':').reduce((v,part)=>v*60+Number(part),0):NaN},FamilyNostalgia:{uploadEvents:()=>[{id:'original-event',name:'Original event'}]},FamilyApp:{toast:value=>toasts.push(value)},confirm:()=>true,addEventListener:(name,fn)=>listeners.set(name,fn),dispatchEvent:event=>changed.push(event.detail)};
 window.FamilyNostalgia.uploadEventLabel=event=>event.name;
 const context=vm.createContext({window,document,MAX_VIDEO_SOURCE_BYTES:4*1024**3,bindUploadPreview:options=>bindUploadPreview({...options,worker:previewWorker}),videoUploadMetadata,filenamePhotoDate,bindSegmentTimeline,markedRange,prepareSegmentFile:cut,segmentControlsHTML,segmentHue,crypto:{randomUUID},URL:{createObjectURL:file=>'blob:local/'+urls.push(file),revokeObjectURL:url=>revoked.push(url)},clearTimeout,setTimeout,CustomEvent:class{constructor(name,{detail}){this.detail=detail;}}});
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
async function waitForUpload(f,count){
 for(let i=0;i<100&&f.uploads.length<count;i++)await tick();
 assert.equal(f.uploads.length,count,'the expected upload started');
}
function tagName(f,name){
 f.get('Search').value=name;
 const button={hasAttribute:attr=>attr==='data-video-add-name'};
 f.get('Wizard').listeners.get('click')({target:{closest:selector=>selector.includes('[data-video-add-name]')?button:null}});
}

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
 for(const [index,[start,end]] of [[6,8],[0,2],[2,5]].entries()){
  if(index)f.get('Next').click();
  boundary(f,'StartTime',String(start));boundary(f,'EndTime',String(end));f.get('Name').value='Part '+(index+1);
 }
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
 f.get('PreviewMode').click();
 assert.equal(worker.input,original);
 worker.onmessage({data:{percent:30}});assert.equal(f.get('PreviewProgress').value,30);
 f.get('Player').currentTime=2.75;
 worker.onmessage({data:{file:light}});
 const probe=f.probes.at(-1);probe.duration=8.05;probe.videoWidth=240;probe.onloadedmetadata();await tick();
 assert.equal(worker.stopped,true);assert.equal(f.urls.at(-1),light);
 const player=f.get('Player');player.duration=8.05;player.currentTime=0;await player.onloadedmetadata();
 assert.equal(player.currentTime,2.75);assert.equal(f.get('EndSlider').max,8);
 f.get('PreviewPlay').click();assert.equal(player.paused,false);f.get('PreviewPlay').click();assert.equal(player.paused,true);
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

test('the single original starts staging on selection, supplies remote playback and serves successive segment saves',async()=>{
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
 source.phase='ready';source.url='https://family.example/api/video-sources/test/play';transfer.resolve(source);source.refresh();
 const player=f.get('Player');assert.equal(player.src,source.url);
 f.get('SourcePlay').click();assert.equal(player.paused,false);
 f.get('PreviewPlay').click();assert.equal(player.paused,true);
 await f.get('SaveCurrent').click();
 f.get('Next').click();boundary(f,'EndTime','6');await f.get('SaveCurrent').click();
 assert.equal(publications.length,2);assert.deepEqual(publications.map(p=>({...p.metadata.range})),[{start:1,end:3},{start:3,end:6}]);
 assert.equal(sources.length,1);assert.equal(f.uploads.length,0);
 f.get('Done').click();await done;assert.equal(source.discarded,true);assert.ok(!f.revoked.includes(source.url));
});
