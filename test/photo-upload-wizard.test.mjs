import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import * as core from '../public/assets/photo-edit-core.mjs';
import * as metadata from '../public/assets/photo-upload-metadata.mjs';
import * as faceDraft from '../public/assets/photo-upload-faces.mjs';
import * as catalog from '../public/assets/photo-labels-catalog.mjs';

const source=(await readFile(new URL('../public/assets/photo-editor.js',import.meta.url),'utf8')).replace(/^import[^\n]+\n/gm,'');
function fixture({desktop=true,english=false,onUpload=async()=>{}}={}){
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
  closest(selector){return selector==='[data-upload-remove-person]'&&this.dataset.uploadRemovePerson?this:null;}
  append(...children){for(const child of children)if(child.id)nodes.set(child.id,child);}
  focus(){document.activeElement=this;}
  showModal(){this.open=true;}
  close(){this.open=false;}
  get clientWidth(){return 1000;}
  get clientHeight(){return 420;}
  getContext(){return {save(){},scale(){},translate(){},rotate(){},drawImage(){},restore(){}};}
  toBlob(fn,type){fn(new Blob(['rendered pixels'],{type}));}
 }
 const node=id=>{if(!nodes.has(id))nodes.set(id,new Node('div',id));return nodes.get(id);};
 const document={activeElement:null,getElementById:node,createElement:tag=>new Node(tag),body:new Node()};
 const window=new EventTarget();window.innerHeight=900;window.createImageBitmap=true;window.FamilyI18n={isEnglish:english,personName:p=>english?p.nameEn||p.name:p.name};
 window.FamilyApp={apiEnabled:true,getPersonSummary:id=>people.find(p=>p.id===id)};window.FamilyTags={findPeople:async query=>people.filter(p=>!query||p.name.includes(query))};
 window.FamilyFaces={async mount(stage,image,item,options){mounts.push({stage,image,item,options});await options.adapter.load();},clear(){},dismiss(){},fit(){},async flush(){}};
 vm.runInNewContext(source,{...core,...metadata,...faceDraft,...catalog,window,document,File,Blob,URL,crypto,queueMicrotask,ResizeObserver:class{observe(){}},requestAnimationFrame:fn=>fn(),matchMedia:()=>({matches:desktop}),createImageBitmap:async file=>({width:1000,height:800,close(){closed.push(file.name);}})});
 const flush=()=>new Promise(resolve=>setImmediate(resolve));
 return {node,mounts,uploaded,window,flush,api:window.FamilyPhotoEditor,async begin(files){const result=window.FamilyPhotoEditor.prepare(files,{scope:'gallery',onUpload:async(file,progress)=>{uploaded.push({file,payload:window.FamilyPhotoEditor.upload(file)});await onUpload(file,progress);}});await flush();return {result};},async click(id){node('photoEdit'+id).dispatchEvent(new Event('click'));await flush();}};
}
const image=name=>new File(['original pixels '+name],name,{type:'image/jpeg',lastModified:1234});
async function details(entry){const bytes=new Uint8Array(await entry.payload.body.arrayBuffer()),n=Number(entry.payload.headers[metadata.PHOTO_METADATA_HEADER]);return {metadata:metadata.decodeUploadMetadata(bytes.subarray(0,n)),pixels:bytes.subarray(n)};}

test('desktop faces can be tagged immediately and resume automatically after cropping or resetting',async()=>{
 const f=fixture(),{result}=await f.begin([image('one.jpg'),image('two.jpg')]);
 assert.equal(f.node('photoEditTaggingToggle').hidden,true);assert.equal(f.mounts.at(-1).options.adapter.enabled(),true);assert.equal(f.node('photoUploadEditor').classes.has('is-face-tagging'),true);
 await f.click('CropToggle');assert.equal(f.mounts.at(-1).options.adapter.enabled(),false);assert.equal(f.node('photoUploadEditor').classes.has('is-face-tagging'),false);
 await f.click('Reset');assert.equal(f.mounts.at(-1).options.adapter.enabled(),true);assert.equal(f.node('photoUploadEditor').classes.has('is-face-tagging'),true);
 await f.click('Next');assert.equal(f.mounts.at(-1).options.adapter.enabled(),true);await f.click('Cancel');assert.equal(await result,null);
});
test('desktop descriptions start on one line, expand for longer text and shrink when cleared; phones retain two rows',async()=>{
 for(const desktop of [true,false]){
  const f=fixture({desktop}),{result}=await f.begin([image('one.jpg')]),input=f.node('photoEditCaption');
  Object.defineProperty(input,'scrollHeight',{get(){return this.value.length>80?116:36;}});
  assert.equal(input.rows,desktop?1:2);input.value='A longer description. '.repeat(12);input.dispatchEvent(new Event('input'));
  assert.equal(input.rows,desktop?1:2);assert.equal(input.style.height,desktop?'118px':undefined);
  input.value='';input.dispatchEvent(new Event('input'));assert.equal(input.style.height,desktop?'38px':undefined);await f.click('Cancel');assert.equal(await result,null);
 }
});

test('uploading only the current photo leaves other edits in the wizard and never uploads it twice with Upload all',async()=>{
 for(const desktop of [true,false]){
 const f=fixture({desktop}),files=[image('one.jpg'),image('two.jpg'),image('three.jpg')],{result}=await f.begin(files);
 assert.equal(f.node('photoEditSaveCurrent').hidden,false);assert.match(f.node('photoEditSave').textContent,/שמירה והעלאה של הכל/);
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
test('the last individual upload closes the wizard without re-approving a saved file',async()=>{
 const f=fixture(),{result}=await f.begin([image('only.jpg')]);await f.click('SaveCurrent');assert.deepEqual(Array.from(await result),[]);assert.equal(f.uploaded.length,1);
});
test('individual approval validates only its photo, while remaining non-image files still require Upload all',async()=>{
 const f=fixture(),{result}=await f.begin([image('one.jpg'),image('two.jpg')]);await f.click('Next');f.node('photoEditDateyear').value='99';f.node('photoEditDateyear').dispatchEvent(new Event('input'));await f.click('Next');await f.click('SaveCurrent');assert.equal(f.uploaded.length,1);assert.equal(f.node('photoEditFilename').textContent,'two.jpg');await f.click('Save');assert.match(f.node('photoEditError').textContent,/תאריך/);await f.click('Cancel');assert.equal(await result,null);
 const mixed=fixture(),other=new File(['document'],'notes.pdf',{type:'application/pdf'}),pending=await mixed.begin([image('only.jpg'),other]);await mixed.click('SaveCurrent');assert.equal(mixed.node('photoUploadEditor').open,true);assert.equal(mixed.node('photoEditLeft').disabled,true);assert.equal(mixed.node('photoEditSaveCurrent').hidden,true);await mixed.click('Save');const remaining=await pending.result;assert.deepEqual(Array.from(remaining,file=>file.name),['notes.pdf']);assert.equal(mixed.uploaded.length,1);
});
