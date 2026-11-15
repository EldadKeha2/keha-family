import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../public/assets/video-editor.js',import.meta.url),'utf8');
function model(){const window={FamilyI18n:{isEnglish:false}},document={addEventListener(){}};vm.runInNewContext(source,{window,document});return window.FamilyVideoEditor;}
test('video ranges accept minute and hour positions, reject ambiguous seconds, and preserve fractional marks',()=>{
 const api=model();assert.equal(api.seconds('01:02.25'),62.25);assert.equal(api.seconds('1:02:03.5'),3723.5);assert.equal(api.seconds('2,75'),2.75);assert.ok(Number.isNaN(api.seconds('1:62')));assert.ok(Number.isNaN(api.seconds('')));assert.equal(api.clock(3723.5),'1:02:03.50');
});
test('the same edit action is offered in every video collection, including uploaded and linked films',()=>{
 const api=model();for(const scope of ['nostalgia','videos','personal:tomer','wedding:root','nursery:tomer'])assert.match(api.controls({id:'film',kind:'video'},scope),new RegExp('data-video-scope="'+scope+'"'));
 assert.equal(api.controls({id:'photo',kind:'photo'},'nostalgia'),'');assert.match(api.controls({id:'youtube',kind:'video',provider:'youtube'},'videos'),/data-video-edit="youtube"/);
});

function editorFixture(){
 const nodes=new Map(),listeners=new Map(),videos=[],requests=[];let sequence=0;
 class Node{
  constructor(tag='div'){this.tagName=tag.toUpperCase();this.handlers=new Map();this.children=[];this.style={};this.value='';this.hidden=false;this.open=false;this.paused=true;this.readyState=1;this.duration=120;this.seeking=false;this.position=0;this.seeks=[];this.classList={toggle(){}};}
  set innerHTML(value){this.html=value;for(const match of value.matchAll(/<(\w+)\b([^>]*\bid="([^"]+)"[^>]*)>/g)){const node=new Node(match[1]);node.id=match[3];node.value=/\bvalue="([^"]*)"/.exec(match[2])?.[1]||'';nodes.set(node.id,node);}}
  set currentTime(value){this.position=Number(value);this.seeks.push(this.position);this.seeking=true;}
  get currentTime(){return this.position;}
  addEventListener(type,callback){const all=this.handlers.get(type)||[];all.push(callback);this.handlers.set(type,all);}
  emit(type,extra={}){return Promise.all((this.handlers.get(type)||[]).map(fn=>fn({target:this,currentTarget:this,preventDefault(){},stopPropagation(){},...extra})));}
  setAttribute(key,value){this[key]=value;}removeAttribute(key){delete this[key];}
  replaceChildren(...children){this.children=children;}appendChild(child){this.children.push(child);return child;}
  pause(){this.paused=true;}load(){}showModal(){this.open=true;}close(){this.open=false;}
  async finishSeek(){this.seeking=false;await this.emit('seeked');}
 }
 const document={body:new Node('body'),activeElement:null,getElementById:id=>nodes.get(id),createElement(tag){const node=new Node(tag);if(tag==='video')videos.push(node);return node;},querySelectorAll:selector=>selector==='video'?videos:[],addEventListener:(type,fn)=>listeners.set(type,fn)};
 const window={FamilyI18n:{isEnglish:false,mediaName:item=>item.name,error:String,fetch:async(path,options)=>{requests.push({path,body:JSON.parse(options.body)});return Response.json({item:{id:'saved-clip',kind:'video'}});}},dispatchEvent(){},FamilyApp:{toast(){}}};
 vm.runInNewContext(source,{window,document,URL,Response,CustomEvent,crypto:{randomUUID:()=>String(++sequence).padStart(32,'0')}});listeners.get('DOMContentLoaded')();
 const api=window.FamilyVideoEditor,get=id=>nodes.get(id);
 const open=async(id='film')=>{api.open({id,kind:'video',name:'Family movie',src:'/media/'+id,duration:120},'nostalgia');const media=videos.at(-1);await media.emit('loadedmetadata');await media.finishSeek();media.seeks=[];return media;};
 return {api,window,document,get,requests,open,input(id,value){get(id).value=String(value);return get(id).emit('input');}};
}
test('Save submits the caption and staged tags together without a clip range when only details changed',async()=>{
 const f=editorFixture();f.window.FamilyTags={mountDraft(){},clearInline(){},draftSelection:async()=>({people:[{personId:'yona'},{name:'New guest'}],expectedTagsRevision:'tags-before'})};
 await f.open();await f.input('videoClipName','Our updated family memory');await f.get('videoClipForm').emit('submit',{submitter:f.get('videoClipSave')});
 assert.equal(f.requests.length,1);assert.equal(f.requests[0].path,'api/media/film/video-edit');assert.equal(f.requests[0].body.range,null);assert.equal(f.requests[0].body.caption,'Our updated family memory');assert.equal(f.requests[0].body.people.length,2);assert.equal(f.requests[0].body.expectedTagsRevision,'tags-before');
});
test('touch scrubbing previews the boundary that moved even when focus stays on the other slider',async()=>{
 const f=editorFixture(),video=await f.open();f.document.activeElement=f.get('videoClipStartRange');
 await f.input('videoClipEndRange',87.25);assert.equal(video.currentTime,87.25);assert.equal(f.get('videoClipEnd').value,'01:27.25');await video.finishSeek();
 f.document.activeElement=f.get('videoClipEndRange');await f.input('videoClipStartRange',12.5);assert.equal(video.currentTime,12.5);assert.equal(f.get('videoClipStart').value,'00:12.50');
});
test('rapid scrubbing displays the latest requested frame and saves those exact boundaries',async()=>{
 const f=editorFixture(),video=await f.open();await f.input('videoClipStartRange',10);await f.input('videoClipStartRange',20);await f.input('videoClipStartRange',30);
 assert.deepEqual(video.seeks,[10]);await video.finishSeek();assert.deepEqual(video.seeks,[10,30]);await video.finishSeek();
 await f.input('videoClipEnd','01:30.25');assert.equal(video.currentTime,90.25);await video.finishSeek();
 await f.get('videoClipForm').emit('submit',{submitter:f.get('videoClipSaveNew')});assert.equal(f.requests.length,1);assert.equal(f.requests[0].body.start,30);assert.equal(f.requests[0].body.end,90.25);
});
test('late seek and metadata events from a closed video cannot change the next editor',async()=>{
 const f=editorFixture(),old=await f.open('old');await f.input('videoClipStartRange',10);await f.input('videoClipStartRange',50);await f.get('videoClipClose').emit('click');
 const current=await f.open('new');old.duration=999;await old.emit('loadedmetadata');await old.finishSeek();
 assert.equal(f.get('videoClipEnd').value,'02:00.00');assert.equal(current.currentTime,0);assert.deepEqual(current.seeks,[]);
});
