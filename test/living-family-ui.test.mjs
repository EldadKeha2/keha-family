import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../public/assets/living-family.js',import.meta.url),'utf8');
const photo={id:'a'.repeat(32),title:'יונה ושלמה',titleEn:'Yona and Shlomo',generation:1,src:'/media/source',thumbnailSrc:'/media/thumb',tags:[],animations:[{id:'smile',label:'מבט וחיוך',labelEn:'A look and a smile',status:'ready',duration:5.0625,videoSrc:'/api/family-ai/video/source/smile?v=one'},{id:'wave',label:'נפנוף לשלום',labelEn:'A little wave',status:'ready',duration:5.0625,videoSrc:'/api/family-ai/video/source/wave?v=two'},{id:'dance',label:'ריקוד קטן',labelEn:'A little dance',status:'pending',duration:5}]};
const tick=async()=>{for(let i=0;i<6;i++)await new Promise(resolve=>setImmediate(resolve));};
function fixture({items=[photo]}={}){
  const nodes=new Map(),listeners=new Map(),requests=[],opened=[],registered=[],removed=[],bindings=[];let fail=false;
  class Element{
    constructor(){this.children=[];this.listeners=new Map();this.attrs={};this.hidden=false;this.open=false;this.disabled=false;this.dataset={};this.paused=true;this.classList={add(){}};}
    get firstChild(){return this.children[0]||null;}
    append(node){if(node.parent){node.parent.children=node.parent.children.filter(child=>child!==node);}node.parent=this;this.children.push(node);if(node.id)nodes.set(node.id,node);}
    prepend(node){this.append(node);this.children=[node,...this.children.filter(child=>child!==node)];}
    set innerHTML(value){this.html=value;for(const match of value.matchAll(/\bid="([^"]+)"/g)){const node=nodes.get(match[1])||new Element();node.id=match[1];nodes.set(node.id,node);}}
    get innerHTML(){return this.html||'';}
    querySelector(){return new Element();}
    addEventListener(name,callback){this.listeners.set(name,callback);}
    setAttribute(name,value){this.attrs[name]=value;}
    removeAttribute(name){delete this.attrs[name];delete this[name];}
    showModal(){this.open=true;}
    close(){this.open=false;this.listeners.get('close')?.({target:this});}
    pause(){this.paused=true;}
    play(){this.paused=false;return Promise.resolve();}
    load(){}
    async emit(name,event={}){return this.listeners.get(name)?.({target:this,...event});}
  }
  const host=new Element();host.id='familyAiView';host.append(new Element());nodes.set(host.id,host);
  const document={readyState:'loading',visibilityState:'visible',getElementById:id=>nodes.get(id),createElement:()=>new Element(),body:new Element(),addEventListener:(name,callback)=>listeners.set(name,callback)};
  const window={FamilyI18n:{isEnglish:true,fetch:async(path,options)=>{requests.push({path,options});if(fail)throw Error('Offline');return {ok:true,json:async()=>({items,total:items.length,totalClips:3,readyClips:2})};}},FamilyAI:{activate(){},search(){},refresh(){},remove:item=>removed.push(item)},FamilyApp:{getView:()=> 'tree'},FamilyMedia:{register:(...args)=>registered.push(args),open:(...args)=>opened.push(args)},FamilyVideoAlbumInput:{bind(video,options){const binding={video,options,items:[],sync(items,selected){this.items=items;this.selected=selected;},close(){this.closed=true;}};bindings.push(binding);return binding;}},addEventListener(){}};
  vm.runInNewContext(source,{window,document,location:{hash:'#tree'},setTimeout:()=>1,clearTimeout(){}});listeners.get('DOMContentLoaded')();
  const click=async(data,{inDialog=false,disabled=false}={})=>{const button={dataset:data,disabled,hasAttribute:name=>name==='data-living-refresh'&&'livingRefresh'in data};await nodes.get(inDialog?'livingFamilyPlayer':'livingFamilySection').emit('click',{target:{closest:selector=>selector==='[data-living-close]'?null:button}});await tick();};
  return {nodes,requests,opened,registered,removed,bindings,api:window.FamilyAI,click,set fail(value){fail=value;},activate:async()=>{window.FamilyAI.activate('family-ai');await tick();}};
}

test('visitors see three actions with accurate readiness and only GET requests',async()=>{
  const f=fixture();await f.activate();const html=f.nodes.get('livingFamilyGrid').innerHTML;
  assert.equal([...html.matchAll(/data-living-action=/g)].length,3);assert.match(html,/is-pending[^]*data-living-action="dance" disabled/);assert.match(f.nodes.get('livingFamilyStatus').textContent,/2 of 3 moments ready/);
  assert.equal(f.nodes.get('livingFamilyArchive').hidden,true);assert.ok(f.requests.every(request=>!request.options.method||request.options.method==='GET'));
});

test('action selection switches the actual saved clip and a pending action cannot start playback',async()=>{
  const f=fixture();await f.activate();await f.click({livingPhoto:photo.id,livingAction:'dance'},{disabled:true});assert.equal(f.nodes.has('livingFamilyPlayer'),false);
  await f.click({livingPhoto:photo.id,livingAction:'smile'});assert.equal(f.nodes.get('livingFamilyVideo').src,photo.animations[0].videoSrc);assert.equal(f.nodes.get('livingFamilyPlayer').open,true);
  await f.click({livingPhoto:photo.id,livingAction:'wave'},{inDialog:true});assert.equal(f.nodes.get('livingFamilyVideo').src,photo.animations[1].videoSrc);assert.match(f.nodes.get('livingFamilyDownload').href,/wave\?v=two&download=1/);assert.match(f.nodes.get('livingFamilyPlayerNote').textContent,/5 seconds/);
  assert.ok(f.requests.every(request=>request.path==='api/family-ai/featured'));
});

test('the original-photo button stops the movie and opens the normal shared gallery',async()=>{
  const f=fixture();await f.activate();await f.click({livingPhoto:photo.id,livingAction:'smile'});await f.nodes.get('livingFamilyOriginal').emit('click');
  assert.equal(f.nodes.get('livingFamilyVideo').paused,true);assert.equal(f.nodes.get('livingFamilyVideo').src,undefined);assert.equal(f.nodes.get('livingFamilyPlayer').open,false);assert.equal(f.opened[0][0][0].id,photo.id);assert.equal(f.opened[0][2],'living-family');
});

test('generated-video swipes update animation choices, download and original-photo links together',async()=>{
 const other={...photo,id:'b'.repeat(32),titleEn:'Another family photo',animations:[{...photo.animations[0],videoSrc:'/other-smile.mp4'},photo.animations[2]]};
 const f=fixture({items:[photo,other]});await f.activate();await f.click({livingPhoto:photo.id,livingAction:'smile'});
 const binding=f.bindings[0];assert.equal(binding.items.length,3,'Only ready saved variants participate');
 binding.options.select(binding.items[1]);assert.equal(f.nodes.get('livingFamilyVideo').src,photo.animations[1].videoSrc);assert.equal(binding.selected,photo.id+':wave');
 assert.match(f.nodes.get('livingFamilyPlayerActions').innerHTML,/data-living-action="wave"[^>]*aria-pressed="true"/);
 binding.options.select(binding.items[2]);assert.equal(f.nodes.get('livingFamilyPlayerTitle').textContent,'Another family photo');assert.equal(f.nodes.get('livingFamilyVideo').src,'/other-smile.mp4');assert.match(f.nodes.get('livingFamilyDownload').download,new RegExp(other.id+'-smile'));
 await f.nodes.get('livingFamilyOriginal').emit('click');assert.equal(binding.closed,true);assert.equal(f.opened[0][0][f.opened[0][1]].id,other.id);
});

test('a failed refresh retains the album and a later success clears its error',async()=>{
  const f=fixture();await f.activate();f.fail=true;await f.click({livingRefresh:''});assert.equal(f.nodes.get('livingFamilyError').hidden,false);assert.match(f.nodes.get('livingFamilyGrid').innerHTML,/Yona and Shlomo/);
  f.fail=false;await f.click({livingRefresh:''});assert.equal(f.nodes.get('livingFamilyError').hidden,true);
  f.api.search('does not match');assert.equal(f.nodes.get('livingFamilyEmpty').hidden,false);assert.equal(f.nodes.get('livingFamilyGrid').innerHTML,'');
});


test('a separate trash button under each original opens the shared password dialog without starting generation',async()=>{
  const f=fixture();await f.activate();const html=f.nodes.get('livingFamilyGrid').innerHTML;
  assert.match(html,/living-card-tools/);assert.match(html,/data-living-remove=/);
  await f.click({livingRemove:photo.id});assert.equal(f.removed.length,1);assert.equal(f.removed[0].id,photo.id);
  assert.ok(f.requests.every(request=>!request.options.method||request.options.method==='GET'));
});
