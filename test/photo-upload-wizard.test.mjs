import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import * as core from '../public/assets/photo-edit-core.mjs';
import * as metadata from '../public/assets/photo-upload-metadata.mjs';
import * as faceDraft from '../public/assets/photo-upload-faces.mjs';
import * as catalog from '../public/assets/photo-labels-catalog.mjs';

const source=(await readFile(new URL('../public/assets/photo-editor.js',import.meta.url),'utf8')).replace(/^import[^\n]+\n/gm,'');
const keyboardSource=await readFile(new URL('../public/assets/photo-keyboard.js',import.meta.url),'utf8');
function fixture({desktop=true,english=false,onUpload=async()=>{},photoSize={width:1000,height:800},viewportSize={width:1000,height:420}}={}){
 const nodes=new Map(),all=[],mounts=[],uploaded=[],closed=[];
 const people=[{id:'yona',name:'יונה',nameEn:'Yona'},{id:'shlomo',name:'שלמה',nameEn:'Shlomo'}];
 class Node extends EventTarget{
  constructor(tag='div',id=''){super();this.tagName=tag;this.id=id;this.dataset={};this.hidden=false;this.disabled=false;this.checked=false;this.value='';this.style={setProperty:(k,v)=>{this.style[k]=v;},removeProperty:k=>{delete this.style[k];}};this.classes=new Set();this.classList={toggle:(k,v)=>v?this.classes.add(k):this.classes.delete(k)};this.width=1000;this.height=800;all.push(this);}
  set innerHTML(value){this.html=value;for(const match of value.matchAll(/<([a-z0-9]+)[^>]*\bid="([^"]+)"/g))if(!nodes.has(match[2]))nodes.set(match[2],new Node(match[1],match[2]));}
  get innerHTML(){return this.html||'';}
  setAttribute(key,value){this[key]=value;}
  querySelector(selector){if(selector.startsWith('#'))return node(selector.slice(1));return node(this.id+selector);}
  querySelectorAll(selector){if(selector==='button,input,textarea')return all.filter(n=>['button','input','textarea'].includes(n.tagName));return [];}
  contains(target){return target===this;}
  closest(selector){return selector.split(',').some(part=>part===this.tagName||part==='[data-upload-remove-person]'&&this.dataset.uploadRemovePerson||part==='dialog[open]'&&this.tagName==='dialog'&&this.open||part==='[role="dialog"]'&&this.role==='dialog'||part==='[role="textbox"]'&&this.role==='textbox'||part.startsWith('.')&&this.classes.has(part.slice(1)))?this:null;}
  append(...children){for(const child of children)if(child.id)nodes.set(child.id,child);}
  focus(){document.activeElement=this;}
  blur(){document.activeElement=document.body;this.dispatchEvent(new Event('blur'));}
  showModal(){this.open=true;}
  close(){this.open=false;}
  get clientWidth(){return this.id==='photoEditViewport'?viewportSize.width:1000;}
  get clientHeight(){return this.id==='photoEditViewport'?viewportSize.height:420;}
  getContext(){return {save(){},scale(){},translate(){},rotate(){},drawImage(){},restore(){}};}
  toBlob(fn,type){fn(new Blob(['rendered pixels'],{type}));}
 }
 const node=id=>{if(!nodes.has(id))nodes.set(id,new Node('div',id));return nodes.get(id);};
 const document={activeElement:null,getElementById:node,createElement:tag=>new Node(tag),body:new Node()};
 const window=new EventTarget();window.innerHeight=900;window.createImageBitmap=true;window.FamilyI18n={isEnglish:english,personName:p=>english?p.nameEn||p.name:p.name};
 window.FamilyApp={apiEnabled:true,getPersonSummary:id=>people.find(p=>p.id===id)};window.FamilyTags={findPeople:async query=>people.filter(p=>!query||p.name.includes(query))};
 window.FamilyFaces={async mount(stage,image,item,options){mounts.push({stage,image,item,options});await options.adapter.load();},clear(){},dismiss(){},fit(){},async flush(){}};
 vm.runInNewContext(keyboardSource+'\n'+source,{...core,...metadata,...faceDraft,...catalog,window,document,navigator:{userAgent:desktop?'Windows NT 10.0':'Android Mobile'},File,Blob,URL,crypto,queueMicrotask,ResizeObserver:class{observe(){}},requestAnimationFrame:fn=>fn(),matchMedia:()=>({matches:desktop}),createImageBitmap:async file=>({...photoSize,close(){closed.push(file.name);}})});
 const flush=()=>new Promise(resolve=>setImmediate(resolve));
 return {node,mounts,uploaded,window,document,flush,api:window.FamilyPhotoEditor,async begin(files){const result=window.FamilyPhotoEditor.prepare(files,{scope:'gallery',onUpload:async(file,progress)=>{uploaded.push({file,payload:window.FamilyPhotoEditor.upload(file)});await onUpload(file,progress);}});await flush();return {result};},async click(id){node('photoEdit'+id).dispatchEvent(new Event('click'));await flush();},async key(key,{type='keydown',target=document.body,...flags}={}){const event=new Event(type,{cancelable:true});for(const [name,value]of Object.entries({key,target,...flags}))Object.defineProperty(event,name,{value});window.dispatchEvent(event);await flush();return event;}};
}
const image=name=>new File(['original pixels '+name],name,{type:'image/jpeg',lastModified:1234});
async function details(entry){const bytes=new Uint8Array(await entry.payload.body.arrayBuffer()),n=Number(entry.payload.headers[metadata.PHOTO_METADATA_HEADER]);return {metadata:metadata.decodeUploadMetadata(bytes.subarray(0,n)),pixels:bytes.subarray(n)};}

test('phone and desktop faces can be tagged immediately and resume automatically after cropping or resetting',async()=>{
 for(const desktop of [true,false]){
 const f=fixture({desktop}),{result}=await f.begin([image('one.jpg'),image('two.jpg')]);
 assert.equal(f.node('photoEditTaggingToggle').hidden,true);assert.equal(f.mounts.at(-1).options.adapter.enabled(),true);assert.equal(f.node('photoUploadEditor').classes.has('is-face-tagging'),true);
 await f.click('CropToggle');assert.equal(f.mounts.at(-1).options.adapter.enabled(),false);assert.equal(f.node('photoUploadEditor').classes.has('is-face-tagging'),false);
 await f.click('Reset');assert.equal(f.mounts.at(-1).options.adapter.enabled(),true);assert.equal(f.node('photoUploadEditor').classes.has('is-face-tagging'),true);
 const active=f.mounts.at(-1);f.window.dispatchEvent(new Event('resize'));assert.equal(f.mounts.at(-1),active,'Keyboard or viewport resizing must not close the current face picker');
 await f.click('Next');assert.equal(f.mounts.at(-1).options.adapter.enabled(),true);assert.equal(active.options.adapter.enabled(),false);await f.click('Cancel');assert.equal(await result,null);
 }
});

function enterDate(f,date){
 for(const field of ['day','month','year']){const input=f.node('photoEditDate'+field);input.value=date[field]??'';input.dispatchEvent(new Event('input'));}
}
test('previous-date copy preserves complete and partial dates independently, without copying other photo details',async()=>{
 for(const desktop of [true,false])for(const english of [true,false]){
  const f=fixture({desktop,english}),{result}=await f.begin([image('one.jpg'),image('two.jpg'),image('three.jpg')]);
  assert.equal(f.node('photoEditCopyDate').disabled,true);await f.click('CopyDate');assert.equal(f.node('photoEditDateyear').value,'');
  enterDate(f,{day:29,month:2,year:2000});f.node('photoEditCaption').value='first only';f.node('photoEditCaption').dispatchEvent(new Event('input'));
  await f.click('Next');assert.equal(f.node('photoEditCopyDate').disabled,false);await f.click('CopyDate');
  assert.deepEqual(['day','month','year'].map(field=>f.node('photoEditDate'+field).value),[29,2,2000]);assert.equal(f.node('photoEditCaption').value,'');
  enterDate(f,{year:1980});await f.click('Previous');assert.equal(f.node('photoEditDateyear').value,2000,'Copied dates must be separate objects');
  await f.click('Next');await f.click('Next');enterDate(f,{day:12,month:6,year:1990});await f.click('CopyDate');
  assert.deepEqual(['day','month','year'].map(field=>f.node('photoEditDate'+field).value),['','',1980],'Partial dates clear unknown fields from the target');
  await f.click('SaveCurrent');assert.deepEqual((await details(f.uploaded[0])).metadata.date,{day:null,month:null,year:1980});
  assert.equal(f.node('photoEditCopyDate').disabled,true,'Wrapping to the first photo has no predecessor');await f.click('Cancel');await result;
 }
});
test('date copy follows queue order, skips removed photos and retains the date after uploading its predecessor',async()=>{
 const f=fixture(),{result}=await f.begin([image('01_05_1980.jpg'),image('02_06_1990.jpg'),image('three.jpg')]);
 await f.click('Next');await f.click('Remove');await f.click('CopyDate');assert.equal(f.node('photoEditDateyear').value,1980);
 await f.click('Previous');enterDate(f,{day:31,month:12,year:2001});await f.click('SaveCurrent');assert.equal(f.node('photoEditFilename').textContent,'three.jpg');
 assert.equal(f.node('photoEditCopyDate').disabled,false);await f.click('CopyDate');assert.equal(f.node('photoEditDateyear').value,2001);
 await f.click('SaveCurrent');assert.deepEqual((await details(f.uploaded[1])).metadata.date,{day:31,month:12,year:2001});assert.deepEqual(Array.from(await result),[]);
 const empty=fixture(),pending=await empty.begin([image('one.jpg'),image('two.jpg')]);await empty.click('Next');assert.equal(empty.node('photoEditCopyDate').disabled,true);await empty.click('Cancel');await pending.result;
});
test('Next validates date ranges and real calendar days without losing the current photo or its draft',async()=>{
 for(const desktop of [true,false])for(const english of [true,false]){
  const f=fixture({desktop,english}),{result}=await f.begin([image('one.jpg'),image('two.jpg')]),year=new Date().getFullYear();
  for(const [date,field]of [[{year:1909},'year'],[{year:year+1},'year'],[{year:0},'year'],[{month:0},'month'],[{month:13},'month'],[{day:0},'day'],[{day:32},'day'],[{day:31,month:4,year:2000},'day'],[{day:29,month:2,year:2001},'day'],[{month:1.5},'month']]){
   enterDate(f,date);await f.click('Next');assert.equal(f.node('photoEditFilename').textContent,'one.jpg');assert.equal(f.node('photoEditDateError').hidden,false);assert.ok(f.node('photoEditDateError').textContent);assert.equal(f.document.activeElement,f.node('photoEditDate'+field));assert.equal(f.node('photoEditDate'+field)['aria-invalid'],'true');
   await f.click('SaveCurrent');assert.equal(f.uploaded.length,0);await f.click('Save');assert.equal(f.node('photoUploadEditor').open,true);
  }
  for(const date of [{year:1910},{year},{day:31,month:1,year:2000},{day:29,month:2,year:2000},{day:29,month:2},{month:12},{}]){
   enterDate(f,date);assert.equal(f.node('photoEditDateError').hidden,true);await f.click('Next');assert.equal(f.node('photoEditFilename').textContent,'two.jpg');await f.click('Previous');
  }
  await f.click('Cancel');await result;
 }
});
test('keyboard Next validates too, and malformed numeric input is not treated as an unknown date',async()=>{
 const f=fixture(),{result}=await f.begin([image('one.jpg'),image('two.jpg')]);
 enterDate(f,{year:1909});await f.key('ArrowRight');assert.equal(f.node('photoEditFilename').textContent,'one.jpg');
 await f.key('Control',{ctrlKey:true});await f.key('Control',{type:'keyup'});assert.equal(f.node('photoEditFilename').textContent,'one.jpg');
 enterDate(f,{});const input=f.node('photoEditDatemonth');input.validity={badInput:true};input.value='';input.dispatchEvent(new Event('input'));await f.click('Next');assert.equal(f.node('photoEditDateError').hidden,false);
 input.validity={badInput:false};input.dispatchEvent(new Event('input'));await f.click('Next');assert.equal(f.node('photoEditFilename').textContent,'two.jpg');await f.click('Cancel');await result;
});
test('phone previews use the full available frame for portrait, landscape and small images and retain their aspect on rotation',async()=>{
 for(const photoSize of [{width:947,height:2048},{width:2048,height:947},{width:160,height:120}]){
  const frame={width:300,height:650},f=fixture({desktop:false,photoSize,viewportSize:frame}),{result}=await f.begin([image('one.jpg')]);
  const check=ratio=>{const style=f.node('photoEditImage').style,w=parseFloat(style.width),h=parseFloat(style.height);assert.ok(w<=frame.width+.001&&h<=frame.height+.001);assert.ok(Math.abs(w-frame.width)<.001||Math.abs(h-frame.height)<.001,'At least one image edge must fill its frame');assert.ok(Math.abs(w/h-ratio)<.0001,'The preview must preserve the photo aspect ratio');};
  check(photoSize.width/photoSize.height);await f.click('Right');check(photoSize.height/photoSize.width);await f.click('Cancel');assert.equal(await result,null);
 }
});
test('phone face choices survive switching photos and rotation and upload with only the photo that was tagged',async()=>{
 const f=fixture({desktop:false}),{result}=await f.begin([image('one.jpg'),image('two.jpg')]);
 const first=f.mounts.at(-1).options.adapter;await first.findPeople('יונה');await first.save({faceId:'a'.repeat(32),personId:'yona',rect:{x:.2,y:.2,width:.1,height:.15}});
 await f.click('Next');assert.equal((await f.mounts.at(-1).options.adapter.load()).faces.length,0);
 await f.click('Previous');assert.equal((await f.mounts.at(-1).options.adapter.load()).faces[0].person.id,'yona');await f.click('Right');
 const rotated=(await f.mounts.at(-1).options.adapter.load()).faces[0].rect;await f.click('SaveCurrent');const data=(await details(f.uploaded[0])).metadata;
 assert.equal(data.faces[0].personId,'yona');for(const key of ['x','y','width','height'])assert.ok(Math.abs(data.faces[0].rect[key]-rotated[key])<.00001);
 await f.click('Save');const remaining=await result;assert.equal(remaining[0].name,'two.jpg');assert.deepEqual((await details({payload:f.api.upload(remaining[0])})).metadata.faces,[]);
});
test('descriptions start compact; phone focus expands for editing and blur collapses without losing the uploaded text',async()=>{
 for(const desktop of [true,false]){
  const f=fixture({desktop}),{result}=await f.begin([image('one.jpg')]),input=f.node('photoEditCaption');
  Object.defineProperty(input,'scrollHeight',{get(){return this.value.length>80?116:36;}});
  assert.equal(input.rows,1);input.value='A longer description. '.repeat(12);input.dispatchEvent(new Event('input'));
  assert.equal(input.rows,1);assert.equal(input.style.height,desktop?'118px':undefined);
  if(!desktop){
   input.focus();input.dispatchEvent(new Event('focus'));assert.equal(input.rows,3);assert.equal(input.style.height,'118px');
   f.document.activeElement=f.node('photoEditSaveCurrent');input.dispatchEvent(new Event('blur'));assert.equal(input.rows,1);assert.equal(input.style.height,undefined);
   await f.click('SaveCurrent');assert.equal((await details(f.uploaded[0])).metadata.caption,'A longer description. '.repeat(12));assert.deepEqual(Array.from(await result),[]);
  }else{
   input.value='';input.dispatchEvent(new Event('input'));assert.equal(input.style.height,'38px');
   input.style.height='132px';input.value='תיאור קצר';input.dispatchEvent(new Event('input'));input.dispatchEvent(new Event('blur'));f.window.dispatchEvent(new Event('resize'));assert.equal(input.style.height,'132px','Typing, blur and window resizing must preserve the height chosen with the native resize handle');
   input.style.height='76px';input.dispatchEvent(new Event('input'));assert.equal(input.style.height,'76px','The same handle can also reduce the height');
   await f.click('Cancel');assert.equal(await result,null);
  }
 }
});

test('uploading only the current photo leaves other edits in the wizard and never uploads it twice with Upload all',async()=>{
 for(const desktop of [true,false]){
 const f=fixture({desktop}),files=[image('one.jpg'),image('two.jpg'),image('three.jpg')],{result}=await f.begin(files);
 assert.equal(f.node('photoEditSaveCurrent').hidden,false);assert.match(f.node('photoEditSave').textContent,desktop?/שמירה והעלאה של הכל/:/העלאת הכל/);
 await f.click('Next');f.node('photoEditCaption').value='second description';f.node('photoEditCaption').dispatchEvent(new Event('input'));
 await f.click('SaveCurrent');assert.equal(f.uploaded.length,1);assert.equal(f.uploaded[0].file.name,'two.jpg');assert.equal((await details(f.uploaded[0])).metadata.caption,'second description');assert.deepEqual(Buffer.from((await details(f.uploaded[0])).pixels),Buffer.from(await files[1].arrayBuffer()));
 assert.match(f.node('photoEditCounter').textContent,/תמונה 2 מתוך 2/);assert.equal(f.node('photoEditFilename').textContent,'three.jpg');
 await f.click('Save');const remaining=await result;assert.deepEqual(Array.from(remaining,file=>file.name),['one.jpg','three.jpg']);assert.equal(f.node('photoUploadEditor').open,false);
 }
});
test('a failed individual upload keeps the same image and its metadata for retry; cancel never approves the rest',async()=>{
 for(const desktop of [true,false]){
 let fails=true;const f=fixture({desktop,onUpload:async()=>{if(fails)throw Error('Network unavailable');}}),{result}=await f.begin([image('one.jpg'),image('two.jpg')]);
 f.node('photoEditCaption').value='Keep this';f.node('photoEditCaption').dispatchEvent(new Event('input'));await f.click('SaveCurrent');assert.match(f.node('photoEditError').textContent,/Network unavailable/);assert.equal(f.node('photoEditFilename').textContent,'one.jpg');assert.equal(f.node('photoEditCaption').value,'Keep this');
 assert.match(f.node('photoEditCounter').textContent,/תמונה 1 מתוך 2/);
 fails=false;await f.click('SaveCurrent');assert.equal(f.node('photoEditFilename').textContent,'two.jpg');await f.click('Cancel');assert.equal(await result,null);assert.equal(f.uploaded.length,2);
 }
});
test('Next wraps from last to first, metadata remains per photo, and individual upload is available on phones and desktop',async()=>{
 for(const desktop of [true,false]){
  const f=fixture({desktop}),{result}=await f.begin([image('one.jpg'),image('two.jpg')]);assert.equal(f.node('photoEditSaveCurrent').hidden,false);
  f.node('photoEditCaption').value='first';f.node('photoEditCaption').dispatchEvent(new Event('input'));await f.click('Next');assert.equal(f.node('photoEditCaption').value,'');assert.equal(f.node('photoEditNext').disabled,false);await f.click('Next');assert.equal(f.node('photoEditFilename').textContent,'one.jpg');assert.equal(f.node('photoEditCaption').value,'first');await f.click('Cancel');assert.equal(await result,null);
 }
});
test('desktop upload keyboard arrows follow the physical direction in both languages and wrap with each photo draft intact',async()=>{
 for(const english of [false,true]){
  const f=fixture({english}),{result}=await f.begin([image('one.jpg'),image('two.jpg'),image('three.jpg')]);
  f.node('photoEditCaption').value='Keep the first description';f.node('photoEditCaption').dispatchEvent(new Event('input'));
  assert.equal((await f.key('ArrowRight')).defaultPrevented,true);assert.equal(f.node('photoEditFilename').textContent,'two.jpg');
  await f.key('ArrowRight');assert.equal(f.node('photoEditFilename').textContent,'three.jpg');
  await f.key('ArrowRight');assert.equal(f.node('photoEditFilename').textContent,'one.jpg');assert.equal(f.node('photoEditCaption').value,'Keep the first description');
  await f.key('ArrowLeft');assert.equal(f.node('photoEditFilename').textContent,'three.jpg');
  await f.click('Cancel');assert.equal(await result,null);assert.equal((await f.key('ArrowRight')).defaultPrevented,false);
 }
});
test('upload navigation leaves arrow keys to metadata, face editors, cropping, modifiers and phone layouts',async()=>{
 const f=fixture(),{result}=await f.begin([image('one.jpg'),image('two.jpg')]);
 for(const target of [f.node('photoEditCaption'),f.node('photoEditDateday'),f.node('photoEditDatemonth'),f.node('photoEditDateyear'),{isContentEditable:true},{closest:()=>({role:'dialog'})},{closest:selector=>selector.includes('.face-selection')?{}:null}]){
  assert.equal((await f.key('ArrowRight',{target})).defaultPrevented,false);assert.equal(f.node('photoEditFilename').textContent,'one.jpg');
 }
 for(const flag of ['ctrlKey','metaKey','altKey','shiftKey','isComposing'])assert.equal((await f.key('ArrowRight',{[flag]:true})).defaultPrevented,false);
 await f.click('CropToggle');assert.equal((await f.key('ArrowRight')).defaultPrevented,false);assert.equal(f.node('photoEditFilename').textContent,'one.jpg');
 await f.click('Reset');await f.key('ArrowRight');assert.equal(f.node('photoEditFilename').textContent,'two.jpg');await f.click('Cancel');assert.equal(await result,null);
 const phone=fixture({desktop:false}),pending=await phone.begin([image('one.jpg'),image('two.jpg')]);assert.equal((await phone.key('ArrowRight')).defaultPrevented,false);assert.equal(phone.node('photoEditFilename').textContent,'one.jpg');await phone.click('Cancel');assert.equal(await pending.result,null);
});
test('a solo Control tap advances on release, wraps, and preserves photo edits while typing',async()=>{
 const f=fixture(),{result}=await f.begin([image('one.jpg'),image('two.jpg')]),input=f.node('photoEditCaption');input.value='תיאור שנשמר';input.dispatchEvent(new Event('input'));
 await f.key('Control',{ctrlKey:true,target:input});assert.equal(f.node('photoEditFilename').textContent,'one.jpg');await f.key('Control',{ctrlKey:true,repeat:true,target:input});
 assert.equal((await f.key('Control',{type:'keyup',target:input})).defaultPrevented,true);assert.equal(f.node('photoEditFilename').textContent,'two.jpg');
 await f.key('Control',{ctrlKey:true});await f.key('Control',{type:'keyup'});assert.equal(f.node('photoEditFilename').textContent,'one.jpg');assert.equal(input.value,'תיאור שנשמר');await f.click('Cancel');assert.equal(await result,null);
});
test('Control combinations, pointer gestures, lost focus and phone layouts never trigger the solo-Control shortcut',async()=>{
 const f=fixture(),{result}=await f.begin([image('one.jpg'),image('two.jpg')]);
 for(const key of ['c','v','a','+','-','ArrowRight']){await f.key('Control',{ctrlKey:true});await f.key(key,{ctrlKey:true});assert.equal((await f.key('Control',{type:'keyup'})).defaultPrevented,false);assert.equal(f.node('photoEditFilename').textContent,'one.jpg');}
 for(const type of ['blur','pointerdown','wheel']){await f.key('Control',{ctrlKey:true});f.window.dispatchEvent(new Event(type));await f.key('Control',{type:'keyup'});assert.equal(f.node('photoEditFilename').textContent,'one.jpg');}
 await f.click('Cancel');assert.equal(await result,null);
 const phone=fixture({desktop:false}),pending=await phone.begin([image('one.jpg'),image('two.jpg')]);await phone.key('Control',{ctrlKey:true});await phone.key('Control',{type:'keyup'});assert.equal(phone.node('photoEditFilename').textContent,'one.jpg');await phone.click('Cancel');assert.equal(await pending.result,null);
});
test('Control with Shift moves backward from caption, date, label and face inputs in either modifier order',async()=>{
 const f=fixture(),{result}=await f.begin([image('one.jpg'),image('two.jpg'),image('three.jpg')]);
 for(const target of [f.node('photoEditCaption'),f.node('photoEditDateyear'),f.node('photoEditCustomLabelName'),{isContentEditable:true},{closest:()=>({role:'dialog'})}]){
  await f.key('Shift',{shiftKey:true,target});await f.key('Control',{ctrlKey:true,shiftKey:true,target});await f.key('Control',{type:'keyup',shiftKey:true,target});assert.equal(f.node('photoEditFilename').textContent,'three.jpg');
  await f.key('Control',{ctrlKey:true,target});await f.key('Shift',{ctrlKey:true,shiftKey:true,target});await f.key('Shift',{type:'keyup',ctrlKey:true,target});await f.key('Control',{type:'keyup',target});assert.equal(f.node('photoEditFilename').textContent,'two.jpg');
  await f.click('Next');assert.equal(f.node('photoEditFilename').textContent,'three.jpg');await f.click('Next');
 }
 await f.click('Cancel');assert.equal(await result,null);
});
test('Enter commits the upload description without uploading; Shift+Enter and phone Enter retain multiline input',async()=>{
 for(const desktop of [true,false]){
  const f=fixture({desktop}),{result}=await f.begin([image('one.jpg'),image('two.jpg')]),input=f.node('photoEditCaption');
  input.focus();input.value='שורה ראשונה\nSecond line';input.dispatchEvent(new Event('input'));
  const enter=flags=>{const event=new Event('keydown',{cancelable:true});Object.assign(event,{key:'Enter',...flags});input.dispatchEvent(event);return event;};
  assert.equal(enter({shiftKey:true}).defaultPrevented,false);assert.equal(enter({isComposing:true}).defaultPrevented,false);
  assert.equal(enter({}).defaultPrevented,desktop);assert.equal(f.uploaded.length,0);assert.equal(f.document.activeElement===input,!desktop);
  await f.click('Next');await f.click('Previous');assert.equal(input.value,'שורה ראשונה\nSecond line');
  await f.click('SaveCurrent');assert.equal((await details(f.uploaded[0])).metadata.caption,'שורה ראשונה\nSecond line');await f.click('Cancel');await result;
 }
});
test('solo Control waits for a pending face tag and cannot skip past a photo chosen while it waits',async()=>{
 const f=fixture(),{result}=await f.begin([image('one.jpg'),image('two.jpg'),image('three.jpg')]);let resolve;
 f.window.FamilyFaces.flush=()=>new Promise(done=>{resolve=done;});await f.key('Control',{ctrlKey:true});await f.key('Control',{type:'keyup'});assert.equal(f.node('photoEditFilename').textContent,'one.jpg');
 await f.click('Next');resolve();await f.flush();assert.equal(f.node('photoEditFilename').textContent,'two.jpg');
 f.window.FamilyFaces.flush=async()=>{};await f.key('Control',{ctrlKey:true});await f.key('Control',{type:'keyup'});assert.equal(f.node('photoEditFilename').textContent,'three.jpg');await f.click('Cancel');assert.equal(await result,null);
});
test('phone individual upload advances and reduces the photo count only after success, while repeated taps cannot upload twice',async()=>{
 let finishUpload;const f=fixture({desktop:false,onUpload:()=>new Promise(resolve=>{finishUpload=resolve;})}),{result}=await f.begin([image('one.jpg'),image('two.jpg'),image('three.jpg')]);
 await f.click('SaveCurrent');assert.equal(f.uploaded.length,1);assert.equal(f.node('photoEditSaveCurrent').disabled,true);assert.equal(f.node('photoEditNext').disabled,true);assert.equal(f.node('photoEditFilename').textContent,'one.jpg');assert.match(f.node('photoEditCounter').textContent,/תמונה 1 מתוך 3/);
 await f.click('SaveCurrent');assert.equal(f.uploaded.length,1);finishUpload();await f.flush();
 assert.equal(f.node('photoUploadEditor').open,true);assert.equal(f.node('photoEditFilename').textContent,'two.jpg');assert.match(f.node('photoEditCounter').textContent,/תמונה 1 מתוך 2/);assert.equal(f.node('photoEditSaveCurrent').disabled,false);assert.equal(f.node('photoEditSaveCurrent').hidden,false);
 await f.click('Save');assert.deepEqual(Array.from(await result,file=>file.name),['two.jpg','three.jpg']);assert.equal(f.uploaded.length,1);
});
test('uploading the last selected photo continues with the first remaining photo',async()=>{
 const f=fixture({desktop:false}),{result}=await f.begin([image('one.jpg'),image('two.jpg'),image('three.jpg')]);
 await f.click('Next');await f.click('Next');await f.click('SaveCurrent');
 assert.equal(f.uploaded[0].file.name,'three.jpg');assert.equal(f.node('photoEditFilename').textContent,'one.jpg');assert.match(f.node('photoEditCounter').textContent,/תמונה 1 מתוך 2/);
 await f.click('Save');assert.deepEqual(Array.from(await result,file=>file.name),['one.jpg','two.jpg']);
});
test('draft face names, event labels and completion travel with only the selected image',async()=>{
 const f=fixture(),{result}=await f.begin([image('one.jpg'),image('two.jpg')]),adapter=f.mounts.at(-1).options.adapter;
 await adapter.save({faceId:'a'.repeat(32),personId:'yona',rect:{x:.2,y:.2,width:.1,height:.15}});await adapter.review({complete:true});
 const event=new Event('change');Object.defineProperty(event,'target',{value:{dataset:{uploadLabel:'birthdays'},checked:true}});f.node('photoEditEventChoices').dispatchEvent(event);
 assert.match(f.node('photoEditPeopleTags').innerHTML,/יונה/);assert.match(f.node('photoEditEventTags').innerHTML,/ימי הולדת/);
 await f.click('SaveCurrent');const saved=(await details(f.uploaded[0])).metadata;assert.equal(saved.faces[0].personId,'yona');assert.deepEqual(saved.labels,['birthdays']);assert.equal(saved.complete,true);
 await f.click('Save');const remaining=await result,payload=f.api.upload(remaining[0]),data=await details({payload});assert.deepEqual(data.metadata.faces,[]);assert.deepEqual(data.metadata.labels,[]);assert.equal(data.metadata.complete,false);
});
async function addLabel(f,name){
 const input=f.node('photoEditCustomLabelName');input.value=name;input.dispatchEvent(new Event('input'));
 const event=new Event('submit',{cancelable:true});f.node('photoEditCustomLabelForm').dispatchEvent(event);await f.flush();assert.equal(event.defaultPrevented,true);
}
test('custom upload labels stay with their photo, survive navigation and travel in the actual upload metadata',async()=>{
 const f=fixture(),{result}=await f.begin([image('one.jpg'),image('two.jpg')]),name='מפגש משפחתי, חוף <ים>',id=catalog.photoLabelFromName(name);
 await addLabel(f,name);assert.match(f.node('photoEditEventTags').innerHTML,/חוף &lt;ים&gt;/);assert.doesNotMatch(f.node('photoEditEventTags').innerHTML,/<ים>/);assert.match(f.node('photoEditEventChoices').innerHTML,/חוף &lt;ים&gt;/);
 const input=f.node('photoEditCustomLabelName');input.value='טיוטה לתמונה הראשונה';input.dispatchEvent(new Event('input'));
 await f.click('Next');assert.equal(f.node('photoEditEventTags').innerHTML,'');assert.equal(input.value,'');assert.ok(f.node('photoEditEventChoices').innerHTML.includes(id),'The label is available for another photo without being selected automatically');
 await f.click('Previous');assert.equal(input.value,'טיוטה לתמונה הראשונה');assert.match(f.node('photoEditEventTags').innerHTML,/חוף &lt;ים&gt;/);
 await f.click('SaveCurrent');assert.deepEqual((await details(f.uploaded[0])).metadata.labels,[id]);assert.equal(input.value,'');
 await f.click('Save');const remaining=await result;assert.deepEqual((await details({payload:f.api.upload(remaining[0])})).metadata.labels,[]);
});
test('adding an existing upload label selects it once and invalid names retain their draft without damaging selections',async()=>{
 const f=fixture({english:true}),{result}=await f.begin([image('one.jpg')]);
 await addLabel(f,'Birthdays');await addLabel(f,'ימי הולדת');await addLabel(f,'  FAMILY   REUNION  ');await addLabel(f,'family reunion');
 await addLabel(f,' ');assert.match(f.node('photoEditLabelStatus').textContent,/up to 60/);assert.equal(f.node('photoEditCustomLabelName').value,' ');
 await f.click('SaveCurrent');const labels=(await details(f.uploaded[0])).metadata.labels;assert.equal(labels.length,2);assert.equal(labels[0],'birthdays');assert.equal(catalog.photoLabelKey(labels[1]),catalog.photoLabelKey(catalog.photoLabelFromName('Family reunion')));assert.deepEqual(Array.from(await result),[]);
});
test('the upload wizard rejects a 33rd label without silently dropping any of the first 32',async()=>{
 const f=fixture(),{result}=await f.begin([image('one.jpg')]);
 for(let index=0;index<32;index++)await addLabel(f,'טיול '+index);
 await addLabel(f,'תגית נוספת מעבר למגבלה');assert.match(f.node('photoEditLabelStatus').textContent,/32/);assert.equal(f.node('photoEditCustomLabelName').value,'תגית נוספת מעבר למגבלה');
 await f.click('SaveCurrent');const labels=(await details(f.uploaded[0])).metadata.labels;assert.equal(labels.length,32);assert.equal(labels.includes(catalog.photoLabelFromName('טיול 0')),true);assert.equal(labels.includes(catalog.photoLabelFromName('טיול 31')),true);assert.deepEqual(Array.from(await result),[]);
});
test('the last individual upload closes the wizard without re-approving a saved file',async()=>{
 const f=fixture(),{result}=await f.begin([image('only.jpg')]);await f.click('SaveCurrent');assert.deepEqual(Array.from(await result),[]);assert.equal(f.uploaded.length,1);
});
test('individual approval validates only its photo, while remaining non-image files still require Upload all',async()=>{
 const f=fixture(),{result}=await f.begin([image('one.jpg'),image('two.jpg')]);await f.click('Next');f.node('photoEditDateyear').value='99';f.node('photoEditDateyear').dispatchEvent(new Event('input'));await f.click('Previous');await f.click('SaveCurrent');assert.equal(f.uploaded.length,1);assert.equal(f.node('photoEditFilename').textContent,'two.jpg');await f.click('Save');assert.match(f.node('photoEditDateError').textContent,/1910/);await f.click('Cancel');assert.equal(await result,null);
 const mixed=fixture(),other=new File(['document'],'notes.pdf',{type:'application/pdf'}),pending=await mixed.begin([image('only.jpg'),other]);await mixed.click('SaveCurrent');assert.equal(mixed.node('photoUploadEditor').open,true);assert.equal(mixed.node('photoEditLeft').disabled,true);assert.equal(mixed.node('photoEditSaveCurrent').hidden,true);await mixed.click('Save');const remaining=await pending.result;assert.deepEqual(Array.from(remaining,file=>file.name),['notes.pdf']);assert.equal(mixed.uploaded.length,1);
});

