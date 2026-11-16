import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../public/assets/family-ai.js',import.meta.url),'utf8');
const photo={id:'a'.repeat(32),kind:'photo',src:'/media/original.jpg',thumbnailSrc:'/media/thumb.jpg',name:'Family photo',caption:'Our family',photoRevision:'original'};
const tick=async()=>{for(let i=0;i<6;i++)await new Promise(resolve=>setImmediate(resolve));};
function model({enabled=true,job=null,english=true,items=[photo]}={}){
  const nodes=new Map(),docListeners=new Map(),timers=new Map(),requests=[],registered=[],opened=[],imageSources=[],notices=[],bindings=[];let timerId=0;
  class Element{
    constructor(tag='div'){this.tagName=tag.toUpperCase();this.dataset={};this.listeners=new Map();this.attrs={};this.hidden=false;this.disabled=false;this.open=false;this.value='';this._html='';this.classList={add(){},toggle(){}};}
    set innerHTML(value){this._html=value;for(const match of value.matchAll(/\bid="([^"]+)"/g)){const node=nodes.get(match[1])||new Element();node.id=match[1];nodes.set(node.id,node);}}
    get innerHTML(){return this._html;}
    addEventListener(name,callback){this.listeners.set(name,callback);}
    setAttribute(name,value){this.attrs[name]=value;}
    removeAttribute(name){delete this.attrs[name];}
    querySelectorAll(selector){if(this.id==='familyAiFilters')return ['all','black-and-white','vintage','ready'].map(value=>({dataset:{aiFilter:value},setAttribute(){}}));if(selector==='[data-ai-close]')return [new Element('button')];return [];}
    querySelector(){return new Element('button');}
    before(){}
    append(node){nodes.set(node.id,node);}
    showModal(){this.open=true;}
    close(){this.open=false;this.listeners.get('close')?.({});}
    focus(){}
    pause(){this.paused=true;}
    play(){this.paused=false;return Promise.resolve();}
    load(){}
    scrollIntoView(){}
    getContext(){return {fillRect(){},drawImage(){}};}
    toDataURL(){return 'data:image/jpeg;base64,/9j/AAAA';}
    async emit(name,event={}){return this.listeners.get(name)?.({target:this,preventDefault(){},...event});}
  }
  nodes.set('familyAiView',new Element());nodes.get('familyAiView').id='familyAiView';
  const document={readyState:'loading',visibilityState:'visible',activeElement:null,getElementById:id=>nodes.get(id),createElement:tag=>new Element(tag),body:new Element('body'),addEventListener:(name,callback)=>docListeners.set(name,callback)};
  const window={FAMILY_API_TOKEN:'public-write',FamilyI18n:{isEnglish:english,locale:'en-US',mediaName:item=>item.name,error:value=>value,fetch:async(path,options={})=>{requests.push({path,options});let data;if(path==='api/family-ai/config')data={enabled};else if(path.startsWith('api/family-ai?'))data={items:items.map(item=>({...item,aiJob:item.aiJob||job})),pagination:{page:Number(new URL(path,'https://test/').searchParams.get('page')),pages:3,total:90},excludedCount:2};else if(path==='api/family-ai/exclude')data={saved:true};else if(path==='api/family-ai/generate')data={job:job||{id:photo.id,status:'PENDING',revision:'original'}};else if(path.startsWith('api/family-ai/jobs/'))data={job};else throw Error('Unexpected path '+path);return {ok:true,json:async()=>data};}},FamilyApp:{getView:()=> 'tree',toast:message=>notices.push(message)},FamilyMedia:{register:(...args)=>registered.push(args),open:(...args)=>opened.push(args),lookup:()=>photo},FamilyVideoAlbumInput:{bind(video,options){const binding={video,options,items:[],sync(items,selected){this.items=items;this.selected=selected;},close(){this.closed=true;}};bindings.push(binding);return binding;}},addEventListener(){}};
  class Image{constructor(){this.naturalWidth=2400;this.naturalHeight=1800;}set src(value){imageSources.push(value);}async decode(){}}
  vm.runInNewContext(source,{window,document,location:{hash:'#tree'},URLSearchParams,AbortController,Image,setTimeout:callback=>{timers.set(++timerId,callback);return timerId;},clearTimeout:id=>timers.delete(id)});
  docListeners.get('DOMContentLoaded')();
  const click=async data=>{const button={dataset:data,disabled:false};await nodes.get('familyAiView').emit('click',{target:{closest:()=>button}});await tick();};
  return {api:window.FamilyAI,nodes,requests,registered,opened,imageSources,notices,timers,bindings,click,activate:async()=>{window.FamilyAI.activate('family-ai');await tick();}};
}

test('the tab uses the shared gallery and registers server pagination',async()=>{
  const ui=model();await ui.activate();await ui.click({aiOpen:photo.id});
  assert.equal(ui.opened.length,1);assert.equal(ui.opened[0][2],'family-ai');assert.equal(ui.opened[0][0][0].id,photo.id);
  assert.equal(ui.registered.at(-1)[2].pagination.total,90);
  await ui.api.pageGallery(2);assert.match(ui.requests.at(-1).path,/page=2/);assert.equal(ui.api.galleryQuery().page,2);
});

test('disconnected generation is disabled, while originals can still open in the gallery',async()=>{
  const ui=model({enabled:false});await ui.activate();
  assert.match(ui.nodes.get('familyAiGrid').innerHTML,/disabled title="Video generation is waiting/);
  assert.equal(ui.nodes.get('familyAiConnection').hidden,false);
  await ui.click({aiOpen:photo.id});assert.equal(ui.opened.length,1);
  assert.equal(ui.requests.some(request=>request.options.method==='POST'),false);
});

test('generated-video swipes keep the selected caption, saved clip and original-photo action synchronized',async()=>{
 const completed={status:'SUCCEEDED',revision:'original',videoSrc:'/generated-a.mp4'},other={...photo,id:'b'.repeat(32),caption:'Second memory',aiJob:{...completed,videoSrc:'/generated-b.mp4'}},pending={...photo,id:'c'.repeat(32),aiJob:{status:'PENDING',revision:'original'}};
 const ui=model({job:completed,items:[photo,other,pending]});await ui.activate();await ui.click({aiPlay:photo.id});
 const binding=ui.bindings[0];assert.equal(binding.items.length,2);assert.equal(binding.selected,photo.id);
 binding.options.select(binding.items[1]);assert.equal(ui.nodes.get('familyAiVideo').src,'/generated-b.mp4');assert.equal(ui.nodes.get('familyAiVideoCaption').textContent,'Second memory');assert.equal(ui.nodes.get('familyAiVideoDownload').download,'family-memory-'+other.id+'.mp4');
 await ui.nodes.get('familyAiViewOriginal').emit('click');assert.equal(binding.closed,true);assert.equal(ui.opened[0][0][ui.opened[0][1]].id,other.id);
});

test('photo removal requires confirmation and sends section exclusion instead of deleting media',async()=>{
  const ui=model();await ui.activate();ui.api.exclude(photo.id);
  assert.equal(ui.nodes.get('familyAiRemoveDialog').open,true);
  assert.equal(ui.requests.filter(request=>request.options.method==='POST').length,0);
  await ui.nodes.get('familyAiRemoveConfirm').emit('click');await tick();
  assert.equal(ui.requests.some(request=>request.options.method==='POST'),false);
  ui.nodes.get('familyAiRemovePassword').value='test-removal-password';
  await ui.nodes.get('familyAiRemoveConfirm').emit('click');await tick();
  assert.equal(ui.nodes.get('familyAiRemovePassword').value,'');
  const mutation=ui.requests.find(request=>request.options.method==='POST');assert.equal(mutation.path,'api/family-ai/exclude');assert.deepEqual(JSON.parse(mutation.options.body),{id:photo.id,excluded:true,password:'test-removal-password'});
  assert.equal(ui.requests.some(request=>/api\/media\/.*\/delete/.test(request.path)),false);
  assert.equal(ui.registered.some(([, ,options])=>options.advanceRemoved===true),true);
});

test('creation requires the code form and prepares the original rather than its thumbnail',async()=>{
  const ui=model();await ui.activate();await ui.click({aiCreate:photo.id});
  assert.equal(ui.requests.some(request=>request.path==='api/family-ai/generate'),false);
  ui.nodes.get('familyAiAccessCode').value='private-code';await ui.nodes.get('familyAiGenerateForm').emit('submit');await tick();
  const mutation=ui.requests.find(request=>request.path==='api/family-ai/generate'),body=JSON.parse(mutation.options.body);
  assert.equal(body.accessCode,'private-code');assert.equal(body.width,2400);assert.equal(body.height,1800);assert.deepEqual(ui.imageSources,[photo.src]);
  assert.equal(ui.nodes.get('familyAiAccessCode').value,'');assert.equal(ui.nodes.get('familyAiGenerateDialog').open,false);
});

test('uncertain submission reports its state without repeated polling or a false success message',async()=>{
  const ui=model({job:{id:photo.id,status:'SUBMITTING',revision:'original',errorCode:'SUBMISSION_UNCERTAIN'}});await ui.activate();
  assert.match(ui.nodes.get('familyAiGrid').innerHTML,/paused for review to avoid a duplicate charge/);
  assert.equal(ui.timers.size,0);
});

test('a stale completed video allows a fresh creation and retains access to the prior video',async()=>{
  const ui=model({job:{status:'SUCCEEDED',revision:'old-version',stale:true,videoSrc:'/api/family-ai/video/'+photo.id}});await ui.activate();
  const html=ui.nodes.get('familyAiGrid').innerHTML;
  assert.match(html,new RegExp('data-ai-create="'+photo.id+'"'));assert.match(html,/Watch the previous video/);assert.match(html,/earlier photo version/);
});

test('an immediate provider credit failure is never announced as a successful creation',async()=>{
  const ui=model({job:{status:'FAILED',revision:'original',errorCode:'PROVIDER_CREDITS'}});await ui.activate();await ui.click({aiCreate:photo.id});ui.nodes.get('familyAiAccessCode').value='private-code';await ui.nodes.get('familyAiGenerateForm').emit('submit');await tick();
  assert.match(ui.notices.at(-1),/balance is empty/);assert.doesNotMatch(ui.notices.at(-1),/coming to life/);
});


test('bulk AI removal shares the password gate and never submits a general media deletion',async()=>{
  const ui=model();await ui.activate();let cleared=false;
  const other={...photo,id:'b'.repeat(32)};ui.api.removeMany([photo,other],()=>{cleared=true;});
  assert.match(ui.nodes.get('familyAiRemoveCaption').textContent,/2 selected photos/);
  assert.equal(ui.requests.some(r=>r.options.method==='POST'),false);
  ui.nodes.get('familyAiRemovePassword').value='test-removal-password';
  await ui.nodes.get('familyAiRemoveConfirm').emit('click');await tick();
  const writes=ui.requests.filter(r=>r.options.method==='POST');assert.equal(writes.length,2);
  assert.ok(writes.every(r=>r.path==='api/family-ai/exclude'&&JSON.parse(r.options.body).password==='test-removal-password'));
  assert.equal(cleared,true);assert.equal(ui.nodes.get('familyAiRemovePassword').value,'');
});
