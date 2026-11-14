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

test('Life itself includes each video once across old event assignments and the direct category',()=>{
 const api=model(),collection={library:{events:[{id:'life-a',categoryId:'everyday-life'},{id:'life-b',categoryId:'everyday-life'},{id:'everyday-life-clips',categoryId:'everyday-life'},{id:'party',categoryId:'birthdays'}]},items:[{id:'one',kind:'video',nostalgiaEventIds:['life-a','life-b']},{id:'two',kind:'video',nostalgiaEventIds:['everyday-life-clips']},{id:'other',kind:'video',nostalgiaEventIds:['party']},{id:'photo',kind:'photo',nostalgiaEventIds:['life-a']},{id:'loose',kind:'video',nostalgiaEventIds:[]}]};
 assert.deepEqual(Array.from(api.viewCategoryItems(collection,'everyday-life'),item=>item.id),['one','two']);
 assert.deepEqual(collection.items[0].nostalgiaEventIds,['life-a','life-b']);
});

// Exercise navigation through the same delegated events used by the gallery.
function galleryModel(source,run){
  const nodes=new Map(),documentListeners=new Map(),windowListeners=new Map(),timers=new Map(),openedVideos=[];let timerId=0;
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
  const window={FamilyI18n:{isEnglish:false,error:message=>message},FamilyMedia:{open:(...args)=>openedVideos.push(args)},addEventListener:(name,fn)=>listen(windowListeners,name,fn),requestAnimationFrame:fn=>fn(),FamilyArchive:{renderNostalgia(){}}};
  const context={window,document,location,matchMedia:query=>({matches:query.includes('hover:hover')}),setTimeout:fn=>{const id=++timerId;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id)};
  run(source,context);emit(documentListeners,'DOMContentLoaded');
  const collection={items:[],library:{categories:[{id:'military',name:'מסיבות גיוס ושחרור',icon:'olive',color:'olive'},{id:'holidays',name:'חגים ומועדים',icon:'lantern',color:'honey'}],events:[{id:'ora',categoryId:'military',name:'מסיבת השחרור של אורה',count:19,videoCount:19,revision:'1'},{id:'independence',categoryId:'holidays',name:'יום העצמאות 1996',count:1,videoCount:1,revision:'1'}]}};
  const render=()=>window.FamilyNostalgia.select(collection);render();
  const button=data=>({dataset:data,hasAttribute:name=>Object.hasOwn(data,name.replace(/^data-/,'').replace(/-([a-z])/g,(_,c)=>c.toUpperCase())),closest(selector){return selector==='button'||selector==='[data-nostalgia-category]'&&Object.hasOwn(data,'nostalgiaCategory')?this:null;}});
  return {api:window.FamilyNostalgia,openedVideos,node:id=>nodes.get(id),collection,render,goEvent(id){location.hash=id?'#nostalgia/event/'+id:'#nostalgia';render();},click:data=>emit(documentListeners,'click',{target:button(data)}),hover:id=>emit(documentListeners,'pointerover',{target:button({nostalgiaCategory:id})}),leave:()=>{location.hash='#tree';nodes.get('nostalgiaView').hidden=true;emit(windowListeners,'hashchange');},flush(){for(let count=0;timers.size;count++){if(count>30)throw Error('Timer loop');const pending=[...timers];timers.clear();for(const[,fn]of pending)fn();}}};
}

test('event folders use the browsing grid without upload actions, and returning home restores uploads',()=>{
 const gallery=galleryModel(source,(code,context)=>vm.runInNewContext(code,context));
 gallery.goEvent('ora');
 assert.equal(gallery.node('nostalgiaView').classList.contains('nostalgia-event-grid'),true);
 assert.equal(gallery.node('nostalgiaDropzone').hidden,true);
 assert.doesNotMatch(gallery.node('nostalgiaEventHeader').innerHTML,/data-archive-upload/);
 assert.match(gallery.node('nostalgiaEventHeader').innerHTML,/מסיבת השחרור של אורה/);
 assert.doesNotMatch(gallery.node('nostalgiaEventHeader').innerHTML,/nostalgia-event-title|nostalgia-event-seal|19|אירוע אחד, כל הרגעים/);
 assert.equal(gallery.node('nostalgiaFeedIntro').hidden,true);
 gallery.goEvent(null);
 assert.equal(gallery.node('nostalgiaView').classList.contains('nostalgia-event-grid'),false);
 assert.equal(gallery.node('nostalgiaDropzone').hidden,false);
 assert.equal(gallery.node('nostalgiaFeedIntro').hidden,false);
});

test('opening a folder ignores the search and media filter retained from the library home',()=>{
 const gallery=galleryModel(source,(code,context)=>vm.runInNewContext(code,context));
 gallery.collection.items=[{id:'ora-video',kind:'video',name:'קטע ראשון',nostalgiaEventIds:['ora']},{id:'other-video',kind:'video',name:'קטע אחר',nostalgiaEventIds:['independence']},{id:'loose',kind:'photo',name:'Unassigned'}];
 gallery.goEvent('ora');
 const items=gallery.node('nostalgiaView');
 assert.equal(items.classList.contains('nostalgia-event-grid'),true);
 // The hidden home controls must not make a populated folder look empty.
 const api=gallery.api;
 assert.deepEqual(Array.from(api.select(gallery.collection,{query:'unrelated search',filter:'photo'}),item=>item.id),['ora-video']);
 gallery.goEvent(null);
 assert.deepEqual(Array.from(api.select(gallery.collection,{query:'Unassigned',filter:'photo'}),item=>item.id),['loose']);
});

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

function lifeGallery(){
 const math=Object.create(Math);math.random=()=>0;
 const gallery=galleryModel(source,(code,context)=>vm.runInNewContext(code,{...context,Math:math}));
 gallery.collection.library.categories.push({id:'everyday-life',name:'החיים עצמם',icon:'camera',color:'blue'});
 gallery.collection.library.events.push({id:'old-life',categoryId:'everyday-life',name:'שם ישן',videoCount:1},{id:'everyday-life-clips',categoryId:'everyday-life',name:'החיים עצמם',directCategory:true,videoCount:1});
 gallery.collection.items=[{id:'life-1',name:'סרטון ראשון',kind:'video',src:'/media/one',nostalgiaEventIds:['old-life']},{id:'life-2',name:'סרטון שני',kind:'video',src:'/media/two',nostalgiaEventIds:['everyday-life-clips']}];
 gallery.render();return gallery;
}
test('only Life itself keeps the same home carousel while its arrows select individual videos and clicking plays them',()=>{
 const gallery=lifeGallery(),life=gallery.node('nostalgiaCategories').innerHTML.match(/<section[^>]*data-nostalgia-direct-category="everyday-life"[\s\S]*?<\/section>/)[0];
 assert.equal((life.match(/data-nostalgia-single-video=/g)||[]).length,2);assert.match(life,/nostalgia-folder-tab/);
 assert.doesNotMatch(life,/data-nostalgia-event=|data-nostalgia-new-event=/);assert.match(life,/הסרטון הבא/);
 gallery.click({nostalgiaShelfStep:'1',shelf:'everyday-life'});gallery.node('nostalgiaCategories').dataset.signature='';gallery.render();
 assert.match(gallery.node('nostalgiaCategories').innerHTML,/nostalgia-single-video is-active[^>]*data-nostalgia-single-video="life-2"/);
 gallery.click({nostalgiaSingleVideo:'life-2'});
 assert.deepEqual(Array.from(gallery.openedVideos[0][0],item=>item.id),['life-1','life-2']);assert.equal(gallery.openedVideos[0][1],1);
 assert.equal(gallery.openedVideos[0][2],'nostalgia-everyday-life');assert.equal(gallery.node('nostalgiaCategoryDialog').open,false);
 assert.equal(gallery.node('nostalgiaLibraryHome').hidden,false);assert.match(gallery.node('nostalgiaCategories').innerHTML,/data-nostalgia-event="ora"/);
 gallery.goEvent('old-life');assert.equal(gallery.api.isEvent(),false);assert.equal(gallery.node('nostalgiaEventHeader').hidden,true);
});
test('Life itself has one assignment choice and saving it preserves historical memberships',()=>{
 const gallery=lifeGallery();gallery.click({nostalgiaAssign:'life-1'});
 const choices=gallery.node('nostalgiaAssignChoices').innerHTML;
 assert.match(choices,/value="everyday-life-clips" checked/);assert.doesNotMatch(choices,/value="old-life"/);
 assert.deepEqual(Array.from(gallery.api.uploadEvents(),event=>event.id),['ora','independence','everyday-life-clips']);
 assert.deepEqual(Array.from(gallery.api.selectedAssignments(['old-life','ora'],['everyday-life-clips','independence'])),['independence','old-life']);
 assert.deepEqual(Array.from(gallery.api.selectedAssignments([],['everyday-life-clips'])),['everyday-life-clips']);
 assert.deepEqual(Array.from(gallery.api.selectedAssignments(['old-life'],[])),[]);
});
test('segment filenames are sorted naturally within the event',()=>{
 const api=model(),items=[4,2,1,3].map(n=>({id:String(n),name:'Bloom-seg'+n,nostalgiaEventIds:['bloom']}));
 assert.deepEqual(Array.from(api.viewItems({items},'bloom'),i=>i.id),['1','2','3','4']);
});

test('folder stacks keep exactly one front cover, fan neighbours behind it, and hide distant covers',()=>{
 const api=model(),front=api.stackPose(3,3,9),next=api.stackPose(4,3,9),previous=api.stackPose(2,3,9),far=api.stackPose(7,3,9);
 assert.equal(front.distance,0);assert.ok(front.z>next.z);assert.equal(next.x,-previous.x);assert.ok(next.scale<front.scale);assert.equal(far.visible,false);
});
test('returning to the home starts from a random real event rather than the add-folder card and background updates preserve that choice',()=>{
 const math=Object.create(Math);math.random=()=>.9;
 const gallery=galleryModel(source,(code,context)=>vm.runInNewContext(code,{...context,Math:math}));
 gallery.collection.library.events.push({id:'event-b',categoryId:'military',name:'B',videoCount:1},{id:'event-c',categoryId:'military',name:'C',videoCount:1});
 gallery.leave();gallery.node('nostalgiaView').hidden=false;gallery.render();
 assert.match(gallery.node('nostalgiaCategories').innerHTML,/nostalgia-folder is-active[^>]*data-nostalgia-event="event-c"/);
 gallery.collection.library.events[2].videoCount=4;gallery.render();assert.match(gallery.node('nostalgiaCategories').innerHTML,/nostalgia-folder is-active[^>]*data-nostalgia-event="event-c"/);
});
