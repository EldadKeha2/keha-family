import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import vm from 'node:vm';
import {videoUploadMetadata} from '../public/assets/video-upload-metadata.mjs';
import {filenamePhotoDate} from '../public/assets/photo-upload-metadata.mjs';

const source=(await readFile(new URL('../public/assets/video-upload-wizard.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function deferred(){let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};}
function fixture({finalize}={}){
 const nodes=new Map(),listeners=new Map(),uploads=[],saves=[],changed=[],toasts=[];
 class Element{
  constructor(tag='div'){this.tag=tag;this.dataset={};this.value='';this.validity={};this.disabled=false;this.hidden=false;this.open=false;this.listeners=new Map();this.attributes=new Map();this.classes=new Set();this.classList={toggle:(name,on)=>on?this.classes.add(name):this.classes.delete(name)};}
  set innerHTML(value){this.html=value;for(const [,tag,attrs,id]of value.matchAll(/<(\w+)\b([^>]*\bid="([^"]+)"[^>]*)>/g)){const child=new Element(tag);child.id=id;child.parent=this;child.field=attrs.includes('data-video-draft-field');nodes.set(id,child);}}
  get innerHTML(){return this.html||'';}
  setAttribute(name,value){this.attributes.set(name,value);}
  removeAttribute(name){this.attributes.delete(name);}
  addEventListener(type,fn){this.listeners.set(type,fn);}
  querySelectorAll(selector){return [...nodes.values()].filter(node=>node.parent===this&&(selector==='[data-video-draft-field]'?node.field:['input','textarea','select','button'].includes(node.tag)));}
  showModal(){this.open=true;}
  close(){this.open=false;this.listeners.get('close')?.();}
  pause(){} load(){} replaceChildren(){} blur(){}
  click(){assert.equal(this.disabled,false,'clicked control is enabled');return this.listeners.get('click')?.();}
 }
 const document={getElementById:id=>nodes.get(id),createElement:tag=>new Element(tag),body:{append(node){nodes.set(node.id,node);}}};
 const window={FAMILY_API_TOKEN:'test',FamilyI18n:{isEnglish:false,error:String,fetch:async(path,options)=>{const data=JSON.parse(options.body);saves.push({path,data});return finalize?finalize(saves.length,data):Response.json({item:{id:path.split('/')[2]}});}},FamilyVideoEditor:{icon:'',clock:String},FamilyNostalgia:{uploadEvents:()=>[{id:'original-event',name:'Original event'}]},FamilyApp:{toast:value=>toasts.push(value)},confirm:()=>true,addEventListener:(name,fn)=>listeners.set(name,fn),dispatchEvent:event=>changed.push(event.detail)};
 vm.runInNewContext(source,{window,document,videoUploadMetadata,filenamePhotoDate,crypto:{randomUUID},URL:{createObjectURL:()=>'/local-preview',revokeObjectURL(){}},CustomEvent:class{constructor(name,{detail}){this.detail=detail;}}});
 const upload=(file,progress,target)=>{const pending=deferred();uploads.push({file,progress,target,...pending});return pending.promise;};
 const prepare=(names=['first.mp4','second.mp4'])=>window.FamilyVideoUpload.prepare(names.map(name=>({name,type:'video/mp4',size:500})),{scope:'nostalgia',eventId:'original-event',upload});
 const result=index=>({file:'file-'+index+'.mp4',collection:{items:[{id:'item-'+index,file:'file-'+index+'.mp4'}]}});
 return {get:id=>nodes.get('videoUpload'+id),prepare,uploads,saves,changed,toasts,listeners,result};
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
