import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {DEFAULT_VIDEO_CATEGORIES} from '../public/assets/video-category-catalog.mjs';

const source=(await readFile(new URL('../public/assets/video-categories.js',import.meta.url),'utf8')).replace(/^import[^\n]+\n/,'');
function fixture(){
 const nodes=new Map(),clicks=[],changes=[],requests=[],events=[],pending=[];
 class Node{
  constructor(){this.dataset={};this.value='';this.open=false;this.disabled=false;this.handlers=new Map();this.children=new Map();}
  setAttribute(key,value){this[key]=value;}
  set innerHTML(html){this.html=html;for(const [,id]of html.matchAll(/\bid="([^"]+)"/g))if(!nodes.has(id))nodes.set(id,new Node());}
  get innerHTML(){return this.html||'';}
  querySelector(selector){if(!this.children.has(selector))this.children.set(selector,new Node());return this.children.get(selector);}
  querySelectorAll(){return [];}
  addEventListener(type,fn){this.handlers.set(type,fn);}
  showModal(){this.open=true;}
  close(){this.open=false;}
  focus(){}
 }
 for(const id of ['videoCategories','videoUploadCategory'])nodes.set(id,new Node());nodes.get('videoUploadCategory').value='family';
 const document={getElementById:id=>nodes.get(id),createElement:()=>new Node(),body:{append:node=>nodes.set(node.id,node)},addEventListener:(type,fn)=>{if(type==='click')clicks.push(fn);if(type==='change')changes.push(fn);}};
 const collection={categories:DEFAULT_VIDEO_CATEGORIES,items:[{id:'video-a',kind:'video',videoCategory:'family',caption:'A family memory',src:'/media/video-a'}]};
 const window={FamilyI18n:{isEnglish:false,error:String,fetch:async(path,request)=>{requests.push({path,body:JSON.parse(request.body)});return new Promise(resolve=>pending.push(resolve));}},FamilyApp:{toast(){}},FamilyPortal:{getCollection:()=>collection},dispatchEvent:event=>events.push(event.detail)};
 vm.runInNewContext(source,{window,document,DEFAULT_VIDEO_CATEGORIES,CustomEvent:class{constructor(type,{detail}){this.type=type;this.detail=detail;}}});
 const click=(selector,dataset={})=>{const target={dataset,closest:s=>s===selector?target:null};for(const fn of clicks)fn({target});};
 return {api:window.FamilyVideoCategories,window,nodes,requests,events,collection,click,change:id=>{const target=nodes.get(id);target.id=id;for(const fn of changes)fn({target});},submit:id=>nodes.get(id).querySelector('form').handlers.get('submit')({preventDefault(){}}),reply:async(result,status=200)=>{pending.shift()(Response.json(result,{status}));await new Promise(resolve=>setImmediate(resolve));}};
}
test('shared custom video categories appear in filters and upload choices with escaped names and leave nostalgia controls alone',()=>{
 const f=fixture(),custom={id:'a'.repeat(32),name:'טיולים <ים>',nameEn:'Trips'};f.api.render([...DEFAULT_VIDEO_CATEGORIES,custom],custom.id);
 assert.match(f.nodes.get('videoCategories').innerHTML,/טיולים &lt;ים&gt;/);assert.match(f.api.options(),new RegExp(custom.id));assert.equal(f.nodes.get('videoUploadCategory').value,custom.id);
 assert.match(f.api.controls({id:'video-a',kind:'video'},'videos'),/data-video-assign-category="video-a"/);assert.equal(f.api.controls({id:'video-a',kind:'video'},'nostalgia'),'');
 f.window.FamilyI18n.isEnglish=true;f.api.render([...DEFAULT_VIDEO_CATEGORIES,custom],custom.id);assert.match(f.api.options(),/>Trips</);
});
test('failed category creation keeps its draft and retry publishes the shared server catalog once',async()=>{
 const f=fixture();f.click('[data-video-new-category]');f.nodes.get('videoCategoryName').value='טיולים';f.nodes.get('videoCategoryNameEn').value='Trips';
 f.submit('videoCategoryEditor');assert.equal(f.requests[0].path,'api/collections/videos/categories');await f.reply({error:'Save failed'},503);
 assert.equal(f.nodes.get('videoCategoryEditor').open,true);assert.equal(f.nodes.get('videoCategoryName').value,'טיולים');assert.equal(f.nodes.get('videoCategoryCreateError').textContent,'Save failed');assert.equal(f.events.length,0);
 const category={id:'a'.repeat(32),name:'טיולים',nameEn:'Trips'};f.submit('videoCategoryEditor');await f.reply({category,operation:'video-category-create',scope:'videos',collection:{...f.collection,categories:[...DEFAULT_VIDEO_CATEGORIES,category]}});
 assert.equal(f.nodes.get('videoCategoryEditor').open,false);assert.equal(f.events.length,1);assert.equal(f.events[0].category.id,category.id);assert.match(f.api.options(),new RegExp(category.id));
});
test('assignment targets the video that opened the dialog and sends its original category for conflict protection',async()=>{
 const f=fixture(),category={id:'a'.repeat(32),name:'טיולים'};f.collection.categories=[...DEFAULT_VIDEO_CATEGORIES,category];
 f.click('[data-video-assign-category]',{videoAssignCategory:'video-a'});f.nodes.get('videoCategoryChoice').value=category.id;
 f.collection.items[0]={id:'video-b',kind:'video',videoCategory:'family'};
 f.submit('videoCategoryAssignment');assert.equal(f.requests[0].path,'api/media/video-a/video-category');assert.deepEqual(f.requests[0].body,{group:category.id,expectedGroup:'family'});
 await f.reply({operation:'video-category',scope:'videos',item:{id:'video-a'},collection:f.collection});assert.equal(f.nodes.get('videoCategoryAssignment').open,false);assert.equal(f.events[0].item.id,'video-a');
});

test('upload dropdown category creation preserves the previous destination on cancellation and selects the saved category',async()=>{
 const f=fixture(),upload=f.nodes.get('videoUploadCategory');f.api.render(DEFAULT_VIDEO_CATEGORIES,'special-birthdays');
 assert.match(upload.innerHTML,/value="__create_category__"/);assert.doesNotMatch(f.api.options(),/__create_category__/);
 upload.value='__create_category__';f.change('videoUploadCategory');assert.equal(upload.value,'special-birthdays');assert.equal(f.nodes.get('videoCategoryEditor').open,true);
 f.nodes.get('videoCategoryEditor').close();assert.equal(upload.value,'special-birthdays');assert.equal(f.requests.length,0);
 upload.value='__create_category__';f.change('videoUploadCategory');f.nodes.get('videoCategoryName').value='טיולים';f.submit('videoCategoryEditor');
 const category={id:'b'.repeat(32),name:'טיולים'};await f.reply({category,operation:'video-category-create',scope:'videos',collection:{...f.collection,categories:[...DEFAULT_VIDEO_CATEGORIES,category]}});
 assert.equal(upload.value,category.id);assert.equal(upload.dataset.category,category.id);assert.equal(f.nodes.get('videoCategoryEditor').open,false);
});
