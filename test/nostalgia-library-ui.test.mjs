import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../public/assets/nostalgia-library.js',import.meta.url),'utf8');
function model(){const window={FamilyI18n:{isEnglish:false}},document={addEventListener(){}};vm.runInNewContext(source,{window,document});return window.FamilyNostalgia;}
test('each event exposes only its own files, including shared clips, and unclassified files remain separate',()=>{
 const api=model(),collection={items:[{id:'loose',name:'A'},{id:'a',nostalgiaEventIds:['ora']},{id:'both',nostalgiaEventIds:['ora','holiday']},{id:'b',nostalgiaEventIds:['holiday']}]};
 assert.deepEqual(Array.from(api.viewItems(collection,null),i=>i.id),['loose']);assert.deepEqual(Array.from(api.viewItems(collection,'ora'),i=>i.id),['a','both']);assert.deepEqual(Array.from(api.viewItems(collection,'holiday'),i=>i.id),['both','b']);assert.equal(collection.items.length,4);
});
test('numbered event clips stay in their original sequence even when uploaded out of order',()=>{
 const api=model(),items=[19,2,10,1].map(n=>({id:String(n),name:'מסיבת השחרור של אורה - קטע '+String(n).padStart(2,'0'),nostalgiaEventIds:['ora']}));
 assert.deepEqual(Array.from(api.viewItems({items},'ora'),i=>i.id),['1','2','10','19']);assert.deepEqual(items.map(i=>i.id),['19','2','10','1']);
});

// Exercise navigation through the same delegated events used by the gallery.
function galleryModel(source,run){
  const nodes=new Map(),documentListeners=new Map(),windowListeners=new Map(),timers=new Map();let timerId=0;
  class Element{
    constructor(tag='div'){this.tagName=tag.toUpperCase();this.dataset={};this.style={scrollBehavior:''};this.hidden=false;this.open=false;this.scrollLeft=0;this.clientWidth=800;this.value='';this.listeners=new Map();this._html='';const classes=new Set();this.classList={add:(...values)=>values.forEach(v=>classes.add(v)),remove:(...values)=>values.forEach(v=>classes.delete(v)),contains:v=>classes.has(v),toggle:(v,on)=>{if(on??!classes.has(v))classes.add(v);else classes.delete(v)}};}
    set innerHTML(value){this._html=value;for(const match of value.matchAll(/\bid="([^"]+)"/g))if(!nodes.has(match[1])){const child=new Element();child.id=match[1];nodes.set(child.id,child);}}
    get innerHTML(){return this._html;}
    setAttribute(){}
    appendChild(child){nodes.set(child.id,child);return child;}
    insertBefore(child){return this.appendChild(child);}
    addEventListener(name,fn){const listeners=this.listeners.get(name)||[];listeners.push(fn);this.listeners.set(name,listeners);}
    showModal(){this.open=true;}
    close(){this.open=false;}
    scrollBy({left}){this.scrollLeft+=left;}
    reset(){}
  }
  for(const id of ['nostalgiaView','nostalgiaLibraryHome','nostalgiaEventHeader','nostalgiaFeedIntro','nostalgiaDropzone','nostalgiaUploadState']){const node=new Element();node.id=id;nodes.set(id,node);}
  const listen=(map,name,fn)=>{const listeners=map.get(name)||[];listeners.push(fn);map.set(name,listeners);};
  const emit=(map,name,event={})=>{for(const fn of map.get(name)||[])fn(event);};
  const document={getElementById:id=>nodes.get(id),createElement:tag=>new Element(tag),body:new Element('body'),addEventListener:(name,fn)=>listen(documentListeners,name,fn),querySelector:selector=>selector==='dialog[open]'?[...nodes.values()].find(node=>node.open):null,querySelectorAll:()=>[]};
  const location={hash:'#nostalgia'};
  const window={FamilyI18n:{isEnglish:false,error:message=>message},addEventListener:(name,fn)=>listen(windowListeners,name,fn),requestAnimationFrame:fn=>fn(),FamilyArchive:{renderNostalgia(){}}};
  const context={window,document,location,matchMedia:query=>({matches:query.includes('hover:hover')}),setTimeout:fn=>{const id=++timerId;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id)};
  run(source,context);emit(documentListeners,'DOMContentLoaded');
  const collection={items:[],library:{categories:[{id:'military',name:'מסיבות גיוס ושחרור',icon:'olive',color:'olive'},{id:'holidays',name:'חגים ומועדים',icon:'lantern',color:'honey'}],events:[{id:'ora',categoryId:'military',name:'מסיבת השחרור של אורה',count:19,videoCount:19,revision:'1'},{id:'independence',categoryId:'holidays',name:'יום העצמאות 1996',count:1,videoCount:1,revision:'1'}]}};
  const render=()=>window.FamilyNostalgia.select(collection);render();
  const button=data=>({dataset:data,hasAttribute:name=>Object.hasOwn(data,name.replace(/^data-/,'').replace(/-([a-z])/g,(_,c)=>c.toUpperCase())),closest(selector){return selector==='button'||selector==='[data-nostalgia-category]'&&Object.hasOwn(data,'nostalgiaCategory')?this:null;}});
  return {node:id=>nodes.get(id),collection,render,click:data=>emit(documentListeners,'click',{target:button(data)}),hover:id=>emit(documentListeners,'pointerover',{target:button({nostalgiaCategory:id})}),leave:()=>{location.hash='#tree';nodes.get('nostalgiaView').hidden=true;emit(windowListeners,'hashchange');},flush(){for(let count=0;timers.size;count++){if(count>30)throw Error('Timer loop');const pending=[...timers];timers.clear();for(const[,fn]of pending)fn();}}};
}

test("Switching categories starts with the first event",()=>{
 const gallery=galleryModel(source,(code,context)=>vm.runInNewContext(code,context));
 (function(m,assert){m.click({nostalgiaCategory:'military'});m.node('nostalgiaEventRail').scrollLeft=-400;m.click({nostalgiaCloseCategory:''});m.flush();m.click({nostalgiaCategory:'holidays'});assert.equal(m.node('nostalgiaEventRail').scrollLeft,0);})(gallery,assert);
});

test("Background event updates preserve the current category position",()=>{
 const gallery=galleryModel(source,(code,context)=>vm.runInNewContext(code,context));
 (function(m,assert){m.click({nostalgiaCategory:'military'});m.node('nostalgiaEventRail').scrollLeft=-180;m.collection.library.events[0].revision='2';m.render();assert.equal(m.node('nostalgiaEventRail').scrollLeft,-180);})(gallery,assert);
});

test("Leaving Nostalgia cancels a pending hover opening",()=>{
 const gallery=galleryModel(source,(code,context)=>vm.runInNewContext(code,context));
 (function(m,assert){m.hover('military');m.leave();m.flush();assert.equal(m.node('nostalgiaCategoryDialog').open,false);})(gallery,assert);
});

test("Leaving Nostalgia closes an open category",()=>{
 const gallery=galleryModel(source,(code,context)=>vm.runInNewContext(code,context));
 (function(m,assert){m.click({nostalgiaCategory:'military'});m.leave();assert.equal(m.node('nostalgiaCategoryDialog').open,false);})(gallery,assert);
});

test("A delayed hover cannot open a category on a hidden page",()=>{
 const gallery=galleryModel(source,(code,context)=>vm.runInNewContext(code,context));
 (function(m,assert){m.hover('military');m.node('nostalgiaView').hidden=true;m.flush();assert.equal(m.node('nostalgiaCategoryDialog').open,false);})(gallery,assert);
});

test("Reopening a closing category cancels the earlier close timer",()=>{
 const gallery=galleryModel(source,(code,context)=>vm.runInNewContext(code,context));
 (function(m,assert){m.click({nostalgiaCategory:'military'});m.click({nostalgiaCloseCategory:''});m.click({nostalgiaCategory:'military'});m.flush();assert.equal(m.node('nostalgiaCategoryDialog').open,true);assert.equal(m.node('nostalgiaCategoryDialog').classList.contains('is-closing'),false);})(gallery,assert);
});

test('the home shows every folder inside compact shelves, with one highlighted folder per category and no opening banner',()=>{
 const gallery=galleryModel(source,(code,context)=>vm.runInNewContext(code,context));
 const markup=gallery.node('nostalgiaCategories').innerHTML;
 assert.match(markup,/data-nostalgia-shelf="military"/);
 assert.match(markup,/data-nostalgia-event="ora"/);
 assert.match(markup,/data-nostalgia-event="independence"/);
 assert.equal((markup.match(/class="nostalgia-folder is-active"/g)||[]).length,2);
 assert.equal((markup.match(/data-nostalgia-new-event=/g)||[]).length,2);
 assert.match(markup,/nostalgia-shelf-frame/);
 assert.doesNotMatch(gallery.node('nostalgiaLibraryHome').innerHTML,/nostalgia-library-intro|פותחים מגירה של זיכרונות/);
});
test('segment filenames are sorted naturally within the event',()=>{
 const api=model(),items=[4,2,1,3].map(n=>({id:String(n),name:'Bloom-seg'+n,nostalgiaEventIds:['bloom']}));
 assert.deepEqual(Array.from(api.viewItems({items},'bloom'),i=>i.id),['1','2','3','4']);
});
