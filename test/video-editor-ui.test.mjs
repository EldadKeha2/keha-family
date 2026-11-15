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
  focus(){if(!this.disabled)document.activeElement=this;}select(){this.selectionStart=0;this.selectionEnd=this.value.length;}
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
test('saving details retains a long description while keeping the video title within its name limit',async()=>{
 const f=editorFixture(),caption='A longer family memory. '.repeat(30);await f.open();await f.input('videoClipName',caption);await f.get('videoClipForm').emit('submit',{submitter:f.get('videoClipSave')});
 assert.equal(f.requests[0].body.caption,caption.trim());assert.equal(f.requests[0].body.name.length,140);assert.equal(f.requests[0].body.range,null);
});
test('the name pencil selects the entire caption and exposes its own save action',async()=>{
 const f=editorFixture();await f.open();await f.get('videoClipEditName').emit('click');
 const field=f.get('videoClipName');assert.equal(f.document.activeElement,field);assert.equal(field.selectionStart,0);assert.equal(field.selectionEnd,field.value.length);
 assert.equal(field.hidden,false);assert.equal(f.get('videoClipSaveName').hidden,false);assert.equal(f.get('videoClipEditName').hidden,true);assert.equal(f.get('videoClipSubtitle').hidden,true);
});
test('saving a caption leaves trim and tag drafts open and refreshes the next save expectations',async()=>{
 const f=editorFixture();let tagReads=0;
 f.window.FamilyTags={mountDraft(){},clearInline(){},draftSelection:async()=>{tagReads++;return {people:[{personId:'yona'}],expectedTagsRevision:'tags-before'};}};
 await f.open();await f.input('videoClipStart',10);await f.input('videoClipEnd',40);await f.get('videoClipEditName').emit('click');
 await f.input('videoClipName','Updated caption');await f.get('videoClipSaveName').emit('click');
 assert.equal(f.requests.length,1);assert.equal(f.requests[0].path,'api/media/film/video-edit');assert.equal(f.requests[0].body.caption,'Updated caption');assert.equal(f.requests[0].body.range,null);assert.equal('people' in f.requests[0].body,false);assert.equal(tagReads,0);
 assert.equal(f.document.body.children[0].open,true);assert.equal(f.get('videoClipName').hidden,true);assert.equal(f.get('videoClipEditName').hidden,false);assert.equal(f.get('videoClipSaveName').hidden,true);
 assert.equal(f.document.activeElement,f.get('videoClipEditName'));
 assert.equal(f.get('videoClipSubtitle').textContent,'Updated caption');assert.equal(f.get('videoClipStart').value,'10');assert.equal(f.get('videoClipEnd').value,'40');
 await f.get('videoClipForm').emit('submit',{submitter:f.get('videoClipSave')});
 assert.equal(f.requests[1].body.expectedName,'Updated caption');assert.equal(f.requests[1].body.expectedCaption,'Updated caption');assert.deepEqual(f.requests[1].body.range,{start:10,end:40});assert.equal(f.requests[1].body.people.length,1);assert.equal(tagReads,1);
});
test('Enter saves the edited caption while Shift Enter, composition and held Enter keep typing safe',async()=>{
 const f=editorFixture();await f.open();await f.get('videoClipEditName').emit('click');await f.input('videoClipName','A caption\nwith another line');
 for(const extra of [{shiftKey:true},{isComposing:true},{keyCode:229},{ctrlKey:true},{repeat:true}])await f.get('videoClipName').emit('keydown',{key:'Enter',...extra});
 assert.equal(f.requests.length,0);let prevented=false;
 await f.get('videoClipName').emit('keydown',{key:'Enter',preventDefault(){prevented=true;}});
 assert.equal(prevented,true);assert.equal(f.requests.length,1);assert.equal(f.requests[0].body.caption,'A caption\nwith another line');assert.equal(f.document.body.children[0].open,true);
});
test('a caption retry retains its operation id and text, and does not require a valid trim range',async()=>{
 const f=editorFixture(),attempts=[];f.window.FamilyI18n.fetch=async(path,options)=>{const body=JSON.parse(options.body);attempts.push(body);if(attempts.length===1)throw Error('Connection interrupted');return Response.json({item:{id:'film',kind:'video',name:body.name,caption:body.caption}});};
 await f.open();await f.input('videoClipEnd','invalid');await f.get('videoClipEditName').emit('click');await f.input('videoClipName','Try this caption');await f.get('videoClipSaveName').emit('click');
 assert.equal(f.get('videoClipName').hidden,false);assert.equal(f.get('videoClipName').readOnly,false);assert.equal(f.get('videoClipName').value,'Try this caption');assert.equal(f.get('videoClipSaveName').disabled,false);assert.match(f.get('videoClipStatus').textContent,/Connection interrupted/);
 await f.get('videoClipSaveName').emit('click');assert.equal(attempts.length,2);assert.equal(attempts[0].operationId,attempts[1].operationId);assert.equal(attempts[1].range,null);assert.equal(f.get('videoClipSave').disabled,true);assert.equal(f.get('videoClipName').hidden,true);
});
test('caption saving in the upload preview stays local until the selected clip is confirmed',async()=>{
 const f=editorFixture();let selection;
 f.api.open({id:'upload-preview',kind:'video',name:'Original upload',src:'blob:preview',duration:120},'upload',{selectionOnly:true,onConfirm:value=>{selection=value;}});
 await f.get('videoClipEditName').emit('click');await f.input('videoClipName','Renamed upload');await f.get('videoClipSaveName').emit('click');
 assert.equal(f.requests.length,0);assert.equal(f.document.body.children[0].open,true);assert.equal(f.get('videoClipSubtitle').textContent,'Renamed upload');
 await f.get('videoClipForm').emit('submit',{submitter:f.get('videoClipSave')});assert.equal(selection.name,'Renamed upload');assert.equal(f.requests.length,0);
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
