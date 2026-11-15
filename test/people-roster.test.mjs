import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../public/assets/people-roster.js',import.meta.url),'utf8');
function fixture(respond){
  let now=1000000;const handlers=new Map(),requests=[];
  const people={tidhar:{id:'tidhar',name:'תדהר פיש',nameEn:'Tidhar Fish',generation:3,aliases:['תדי','טדי'],branch:'main'}};
  const window={FAMILY_DATA:{people},FamilyApp:{},FamilyI18n:{error:String,fetch(path,options){requests.push({path,options});return respond?respond(requests.length):Promise.resolve(Response.json({people:Object.values(people)},{headers:{ETag:'"one"'}}));}},addEventListener(type,fn){if(!handlers.has(type))handlers.set(type,[]);handlers.get(type).push(fn);}};
  vm.runInNewContext(source,{window,Date:class extends Date{static now(){return now;}}});
  return {api:window.FamilyPeopleRoster,window,requests,advance(ms){now+=ms;},emit(type,detail){for(const fn of handlers.get(type)||[])fn({detail});}};
}
test('tagging and both filters share one in-flight request and a complete fresh roster',async()=>{
  let resolve;const f=fixture(()=>new Promise(done=>{resolve=done;}));
  const tagging=f.api.load(),gallery=f.api.load(),videos=f.api.load();assert.equal(tagging,gallery);assert.equal(gallery,videos);assert.equal(f.requests.length,1);
  resolve(Response.json({people:[{id:'guest',name:'Archive guest',extra:true}]}));await tagging;
  assert.ok((await gallery).some(person=>person.id==='guest'));assert.equal((await videos).length,2);await f.api.load();assert.equal(f.requests.length,1);
  const tidhar=f.api.snapshot().find(person=>person.id==='tidhar');assert.equal(tidhar.generation,3);assert.deepEqual(Array.from(tidhar.aliases),['תדי','טדי']);
});
test('known tags can use the seeded family immediately while the first search still fetches all extra names',async()=>{
  const f=fixture();await f.api.load({requireComplete:false});assert.equal(f.requests.length,0);
  await f.api.load();assert.equal(f.requests.length,1);await f.api.load();assert.equal(f.requests.length,1);
});
test('expiry revalidates with ETag and 304 retains names, aliases and subscribers without downloading another body',async()=>{
  const f=fixture(count=>Promise.resolve(count===1?Response.json({people:[{id:'tidhar',name:'תדהר פיש',nameEn:'Tidhar Fish'}]},{headers:{ETag:'"roster-1"'}}):new Response(null,{status:304})));
  let notifications=0;f.api.subscribe(()=>notifications++);await f.api.load();const before=notifications;
  f.advance(300001);await f.api.load();assert.equal(f.requests[1].options.headers['If-None-Match'],'"roster-1"');assert.equal(notifications,before);assert.equal(f.api.snapshot()[0].generation,3);
  await f.api.load();assert.equal(f.requests.length,2);
});
test('saved new names immediately reach all subscribers and invalidate the next remote refresh',async()=>{
  const f=fixture();await f.api.load();const changes=[];f.api.subscribe(people=>changes.push(people.map(person=>person.name)));
  f.emit('family-media-changed',{taggedPeople:[{id:'new-guest',name:'New family friend',extra:true}]});
  assert.equal(changes.at(-1).includes('New family friend'),true);await f.api.load();assert.equal(f.requests.length,2);assert.deepEqual(Object.keys(f.requests[1].options.headers),[]);
});
test('person edits use the updated summary and stale in-flight results cannot overwrite a newer save',async()=>{
  let resolve;const f=fixture(()=>new Promise(done=>{resolve=done;}));const pending=f.api.load();
  f.window.FamilyApp.getPersonSummary=id=>({id,name:'Updated Tidhar Fish',nameEn:'Updated Tidhar Fish'});
  f.emit('family-person-changed',{id:'tidhar'});resolve(Response.json({people:[{id:'tidhar',name:'Old name',nameEn:'Old name'}]},{headers:{ETag:'"old"'}}));await pending;
  assert.equal(f.api.snapshot()[0].name,'Updated Tidhar Fish');assert.equal(f.api.snapshot()[0].generation,3);
  const next=f.api.load();assert.equal(f.requests.length,2);assert.deepEqual(Object.keys(f.requests[1].options.headers),[]);resolve(Response.json({people:[]}));await next;
});
test('failed downloads retain the seeded roster and clear the pending request for retry',async()=>{
  const f=fixture(count=>count===1?Promise.reject(Error('Offline')):Promise.resolve(Response.json({people:[{id:'guest',name:'Guest'}]})));
  await assert.rejects(f.api.load(),/Offline/);assert.equal(f.api.snapshot()[0].id,'tidhar');await f.api.load();assert.equal(f.requests.length,2);assert.ok(f.api.snapshot().some(person=>person.id==='guest'));
});
test('unsubscribed consumers stop receiving roster changes',()=>{
  const f=fixture();let calls=0;const unsubscribe=f.api.subscribe(()=>calls++);unsubscribe();f.api.update({id:'new',name:'New guest'});assert.equal(calls,1);
});

test('real tagging, photo filters and video filters share downloads and immediately display a newly saved person',async()=>{
  const [tagsSource,gallerySource,videoSource]=await Promise.all(['tags.js','gallery-filter.js','video-filter.js'].map(name=>readFile(new URL('../public/assets/'+name,import.meta.url),'utf8')));
  let resolve;const f=fixture(()=>new Promise(done=>{resolve=done;})),nodes=new Map();
  class Node{
    constructor(){this.innerHTML='';this.value='';this.handlers=new Map();this.children=new Map();this.classList={toggle(){}};}
    addEventListener(type,fn){this.handlers.set(type,fn);}
    setAttribute(){}
    querySelector(selector){if(!this.children.has(selector))this.children.set(selector,new Node());return this.children.get(selector);}
    querySelectorAll(){return [];}
  }
  const get=id=>{if(!nodes.has(id))nodes.set(id,new Node());return nodes.get(id);};
  const document={readyState:'complete',getElementById:get,addEventListener(){}};
  const window=f.window;window.FAMILY_DATA.units={};window.FAMILY_DATA.branches=[];
  Object.assign(window.FamilyI18n,{t:value=>value,html:(parts,...values)=>parts.reduce((out,part,index)=>out+part+(values[index]??''),''),isEnglish:true,locale:'en-US',personName:person=>person.nameEn||person.name,searchNames:person=>person.name+' '+(person.nameEn||''),branchName:()=>''});
  window.FamilyPortal={getCollection:()=>({items:[],count:0,pagination:{}}),galleryQuery:()=>({filter:'all',person:'',unit:'',labels:'',query:''})};
  const context=vm.createContext({window,document,familyOptions:()=>[],familyLabel:()=>'',photoLabelOptions:()=>[],photoLabelName:()=>'',loadPhotoLabelCatalog:()=>Promise.resolve(),VIDEO_SORTS:[],filterVideos:items=>items});
  vm.runInContext(tagsSource,context);
  for(const code of [gallerySource,videoSource])vm.runInContext('(()=>{'+code.replace(/^import[^\n]+\n/gm,'')+'})()',context);
  const tagging=window.FamilyTags.findPeople('Guest'),photos=get('galleryFilterToggle').handlers.get('click')(),videos=get('videoFilterToggle').handlers.get('click')();
  assert.equal(f.requests.length,1);resolve(Response.json({people:[{id:'guest',name:'Archive Guest',nameEn:'Archive Guest',extra:true}]}));await Promise.all([tagging,photos,videos]);
  assert.match(get('galleryPersonFilter').innerHTML,/Archive Guest/);assert.match(get('videoPersonFilter').innerHTML,/Archive Guest/);
  f.emit('family-media-changed',{taggedPeople:[{id:'newest',name:'Newest Friend',extra:true}]});
  assert.match(get('galleryPersonFilter').innerHTML,/Newest Friend/);assert.match(get('videoPersonFilter').innerHTML,/Newest Friend/);assert.equal(f.requests.length,1);
});
