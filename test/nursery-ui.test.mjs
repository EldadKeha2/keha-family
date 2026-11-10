import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {browserHistory,navigationSource} from './helpers/browser-history.mjs';

const source=await readFile(new URL('../public/assets/nursery.js',import.meta.url),'utf8');
const empty=id=>({kind:'nursery:'+id,items:[],count:0,pagination:{page:1,pages:1,total:0,size:10}});
function fixture({navigation=false,entryUrl='https://family.test/#nursery',english=false,albumFetch,prepare=async files=>files}={}){
  const browser=navigation?browserHistory(entryUrl):null;let view=browser?browser.location.hash.slice(1).split('/')[0]:'nursery';
  const nodes=new Map(),events=new Map(),windowEvents=new Map(),sent=[],registered=[];
  const people=[{id:'yona',name:'Yona',profile:'/adult-profile.jpg'},{id:'shlomo',name:'Shlomo'},{id:'extended',name:'Extended',extended:true},{id:'extra-guest',name:'Guest',extra:true}];
  const node=id=>{if(!nodes.has(id))nodes.set(id,{innerHTML:'',value:'',dataset:{},hidden:false,clicks:0,handlers:new Map(),click(){this.clicks++;},addEventListener(type,fn){this.handlers.set(type,fn);}});return nodes.get(id);};
  const location=browser?.location||{hash:'#nursery'},document={body:{dataset:{}},visibilityState:'visible',querySelector:()=>null,getElementById:node,addEventListener(type,fn){events.set(type,fn);}};
  const window={FamilyI18n:{isEnglish:english,searchNames:p=>p.name,mediaName:p=>p.name,error:String,fetch:async path=>path==='api/nursery'?Response.json({albums:{}}):albumFetch?albumFetch(path):Response.json(empty(path.split('/').pop().split('?')[0]))},FamilyMedia:{register(scope,items){registered.push({scope,items});}},addEventListener(type,fn){windowEvents.set(type,fn);browser?.addEventListener(type,fn);},scrollTo(){},FAMILY_API_TOKEN:'test'};
  window.FamilyApp={getPeople:()=>people,getPersonSummary:id=>people.find(p=>p.id===id),nameOf:id=>people.find(p=>p.id===id)?.name||id,apiEnabled:true,getView:()=>view,setView(next,sync=true){if(browser&&sync)window.FamilyNavigation.go('#'+next);view=next;window.FamilyNursery.activate(next);},toast(){}};
  window.FamilyPhotoEditor={prepare};
  class XHR{
    constructor(){this.upload={};}open(method,url){this.url=url;}setRequestHeader(){}send(file){this.file=file;sent.push(this);}
    complete(result,status=201){this.status=status;this.responseText=JSON.stringify(result);this.onload();}
  }
  const context=vm.createContext({window,document,location,history:browser?.history||{pushState(_a,_b,hash){location.hash=hash;}},matchMedia:()=>({matches:true}),URL,XMLHttpRequest:XHR,Map,Set,URLSearchParams,Response});
  if(browser){vm.runInContext(navigationSource,context);browser.addEventListener('popstate',()=>{const next=location.hash.slice(1).split('/')[0];if(next!==view)window.FamilyApp.setView(next,false);});}
  vm.runInContext(source,context);
  events.get('DOMContentLoaded')();
  const click=(selector,dataset={})=>node('nurseryContent').handlers.get('click')({preventDefault(){},target:{closest:s=>s===selector?{dataset}:null}});
  const open=id=>click('[data-nursery-person]',{nurseryPerson:id});
  return {browser,get view(){return view;},people,window,nodes,node,sent,registered,location,open,click,flush:()=>new Promise(resolve=>setImmediate(resolve)),get html(){return node('nurseryContent').innerHTML;},select(files){const input=node('nurseryUploadInput');input.files=files;input.handlers.get('change')({target:input});}};
}
test('nursery cards follow new core members automatically and exclude extended and tag-only people',async()=>{
 const f=fixture();await f.flush();assert.match(f.html,/#nursery\/yona/);assert.doesNotMatch(f.html,/#nursery\/(extended|extra-guest)/);assert.doesNotMatch(f.html,/adult-profile/);
 f.people.push({id:'new-relative',name:'New relative'});f.window.FamilyNursery.search('');assert.match(f.html,/#nursery\/new-relative/);
 f.window.FamilyNursery.search('new relative');assert.match(f.html,/#nursery\/new-relative/);assert.doesNotMatch(f.html,/#nursery\/yona/);
});
test('baby album grid pages wrap from first to last and last to first',async()=>{
 const requested=[],f=fixture({albumFetch:async path=>{const page=Number(new URL(path,'https://test/').searchParams.get('page'));requested.push(page);return Response.json({...empty('yona'),count:21,pagination:{page,pages:3,total:21,size:10}});}});
 await f.flush();f.open('yona');await f.flush();assert.doesNotMatch(f.html,/data-nursery-page="-1" disabled/);
 f.click('[data-nursery-page]',{nurseryPage:'-1'});await f.flush();assert.deepEqual(requested,[1,3]);assert.doesNotMatch(f.html,/data-nursery-page="1" disabled/);
 f.click('[data-nursery-page]',{nurseryPage:'1'});await f.flush();assert.deepEqual(requested,[1,3,1]);
});
test('a selected baby cover stays on the index even when the newest photo is different',async()=>{
 const f=fixture();await f.flush();f.window.FamilyI18n.fetch=async path=>Response.json(path==='api/nursery'?{albums:{yona:{count:2,cover:'/media/chosen'}}}:{...empty('yona'),cover:'/media/chosen',items:[{id:'newest',src:'/media/newest',name:'Newest'}],count:2});
 f.open('yona');await f.flush();f.click('[data-nursery-back]');await f.flush();assert.match(f.html,/src="\/media\/chosen"/);assert.doesNotMatch(f.html,/src="\/media\/newest"/);
});
test('an upload retains the selected album owner when the visitor moves to another member',async()=>{
 const f=fixture();await f.flush();f.open('yona');await f.flush();f.click('[data-nursery-upload]');assert.equal(f.node('nurseryUploadInput').dataset.personId,'yona');
 f.open('shlomo');await f.flush();f.select([{name:'first-smile.jpg',type:'image/jpeg',size:100}]);await f.flush();assert.equal(f.sent.length,1);assert.match(f.sent[0].url,/api\/nursery\/yona\/upload/);
 const item={id:'baby-yona',src:'/media/baby-yona',name:'First smile'};f.sent[0].complete({collection:{...empty('yona'),items:[item],count:1,pagination:{page:1,pages:1,total:1,size:10}}});await f.flush();
 assert.match(f.html,/Shlomo/);assert.doesNotMatch(f.html,/baby-yona/);assert.equal(f.location.hash,'#nursery/shlomo');
});
test('a slow album response cannot replace the next person’s album, and English uses the shared viewer',async()=>{
 let resolveYona;const f=fixture({english:true,albumFetch:path=>path.includes('/yona?')?new Promise(resolve=>{resolveYona=resolve;}):Promise.resolve(Response.json(empty('shlomo')))});await f.flush();assert.match(f.html,/We were little once, too/);
 f.open('yona');f.open('shlomo');await f.flush();resolveYona(Response.json({...empty('yona'),items:[{id:'wrong-photo',src:'/media/wrong-photo',name:'Yona only'}],count:1}));await f.flush();
 assert.match(f.html,/My baby photos/);assert.match(f.html,/Back to the nursery/);assert.doesNotMatch(f.html,/wrong-photo/);assert.equal(f.registered.at(-1).scope,'nursery:shlomo');
});
test('a refresh started before an upload cannot hide the newly saved photo',async()=>{
 let resolveAlbum;const f=fixture({albumFetch:()=>new Promise(resolve=>{resolveAlbum=resolve;})});await f.flush();f.open('yona');f.click('[data-nursery-upload]');f.select([{name:'baby.jpg',type:'image/jpeg',size:100}]);
 await f.flush();const item={id:'new-photo',src:'/media/new-photo',name:'Saved baby photo'};f.sent[0].complete({collection:{...empty('yona'),items:[item],count:1,pagination:{page:1,pages:1,total:1,size:10}}});await f.flush();assert.match(f.html,/new-photo/);
 resolveAlbum(Response.json(empty('yona')));await f.flush();assert.match(f.html,/new-photo/);assert.match(f.html,/התמונה נוספה/);
});

test('photo uploads wait for approval, send only edited bytes, and cancel without sending',async()=>{
 let approve;const f=fixture({prepare:()=>new Promise(resolve=>{approve=resolve;})});await f.flush();f.open('yona');await f.flush();f.click('[data-nursery-upload]');
 f.select([{name:'original.jpg',type:'image/jpeg',size:100}]);await f.flush();assert.equal(f.sent.length,0);
 const edited={name:'cropped.jpg',type:'image/jpeg',size:50};approve([edited]);await f.flush();assert.equal(f.sent.length,1);assert.equal(f.sent[0].file,edited);
 f.sent[0].complete({collection:empty('yona')});await f.flush();
 f.select([{name:'cancel.jpg',type:'image/jpeg',size:100}]);await f.flush();approve(null);await f.flush();assert.equal(f.sent.length,1);
});

test('nursery Back and Forward traverse album owners and the list without replacing history',async()=>{
  const f=fixture({navigation:true});await f.flush();f.open('yona');await f.flush();f.open('shlomo');await f.flush();
  const length=f.browser.history.length;
  f.browser.history.back();await f.flush();assert.equal(f.location.hash,'#nursery/yona');assert.match(f.html,/Yona/);assert.doesNotMatch(f.html,/Shlomo/);
  f.browser.history.back();await f.flush();assert.equal(f.location.hash,'#nursery');assert.match(f.html,/#nursery\/shlomo/);
  f.browser.history.forward();await f.flush();f.browser.history.forward();await f.flush();
  assert.equal(f.location.hash,'#nursery/shlomo');assert.match(f.html,/Shlomo/);assert.equal(f.browser.history.length,length);
});

test('returning from a directly opened baby album consumes its nursery parent',async()=>{
  const f=fixture({navigation:true,entryUrl:'https://family.test/?lang=en-US#nursery/yona',english:true});await f.flush();
  assert.match(f.html,/My baby photos/);f.click('[data-nursery-back]');await f.flush();
  assert.equal(f.location.hash,'#nursery');assert.match(f.html,/We were little once/);
  f.browser.history.back();await f.flush();assert.equal(f.view,'home');
});
