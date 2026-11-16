import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {browserHistory,navigationSource} from './helpers/browser-history.mjs';

const source=await readFile(new URL('../public/assets/nursery.js',import.meta.url),'utf8');
const empty=id=>({kind:'nursery:'+id,items:[],count:0,pagination:{page:1,pages:1,total:0,size:10}});
function fixture({navigation=false,entryUrl='https://family.test/#nursery',english=false,albumFetch,prepare=async files=>files}={}){
  const browser=navigation?browserHistory(entryUrl):null;let view=browser?browser.location.hash.slice(1).split('/')[0]:'nursery',viewerScope=null;
  const nodes=new Map(),events=new Map(),windowEvents=new Map(),sent=[],registered=[];
  const people=[{id:'yona',name:'Yona',profile:'/adult-profile.jpg'},{id:'shlomo',name:'Shlomo'},{id:'extended',name:'Extended',extended:true},{id:'extra-guest',name:'Guest',extra:true}];
  const node=id=>{if(!nodes.has(id))nodes.set(id,{innerHTML:'',value:'',dataset:{},hidden:false,clicks:0,handlers:new Map(),click(){this.clicks++;},addEventListener(type,fn){this.handlers.set(type,fn);}});return nodes.get(id);};
  const location=browser?.location||{hash:'#nursery'},document={body:{dataset:{}},visibilityState:'visible',querySelector:()=>null,getElementById:node,addEventListener(type,fn){events.set(type,fn);}};
  const window={FamilyI18n:{isEnglish:english,searchNames:p=>p.name,mediaName:p=>p.name,error:String,fetch:async path=>path==='api/nursery'?Response.json({albums:{}}):albumFetch?albumFetch(path):Response.json(empty(path.split('/').pop().split('?')[0]))},FamilyMedia:{register(scope,items,options){registered.push({scope,items,options});},isOpen:scope=>Boolean(viewerScope)&&(!scope||viewerScope===scope)},addEventListener(type,fn){windowEvents.set(type,fn);browser?.addEventListener(type,fn);},scrollTo(){},FAMILY_API_TOKEN:'test'};
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
  return {browser,get view(){return view;},people,window,nodes,node,sent,registered,location,open,click,flush:()=>new Promise(resolve=>setImmediate(resolve)),get html(){return node('nurseryContent').innerHTML;},openViewer(scope='nursery:yona'){viewerScope=scope;node('mediaViewer').open=true;},closeViewer(){viewerScope=null;node('mediaViewer').open=false;node('mediaViewer').handlers.get('close')?.();},select(files){const input=node('nurseryUploadInput');input.files=files;input.handlers.get('change')({target:input});}};
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
test('the shared baby-photo viewer receives full pagination and loads each adjacent page for its owner',async()=>{
 const requested=[],f=fixture({albumFetch:async path=>{
  const url=new URL(path,'https://test/'),id=url.pathname.split('/').at(-1),page=Number(url.searchParams.get('page'));requested.push(id+':'+page);
  const items=Array.from({length:page===3?1:10},(_,i)=>({id:id+'-'+((page-1)*10+i+1),kind:'photo',name:'Baby photo',src:'/media/'+id+'-'+((page-1)*10+i+1)}));
  return Response.json({...empty(id),cover:'/media/chosen-cover',items,count:21,pagination:{page,pages:3,total:21,size:10}});
 }});
 await f.flush();f.open('yona');await f.flush();
 let current=f.registered.at(-1);assert.equal(current.scope,'nursery:yona');assert.equal(current.options.cover,'/media/chosen-cover');assert.deepEqual(current.options.pagination,{page:1,pages:3,total:21,size:10});
 for(const page of [2,3,1]){
  await current.options.loadPage(page);current=f.registered.at(-1);
  assert.equal(current.scope,'nursery:yona');assert.equal(current.options.pagination.page,page);assert.equal(current.items[0].id,'yona-'+((page-1)*10+1));assert.equal(current.items.length,page===3?1:10);
 }
 assert.deepEqual(requested,['yona:1','yona:2','yona:3','yona:1']);assert.equal(f.location.hash,'#nursery/yona');
});
test('a deep-linked baby photo adopts its containing page and subsequent viewer navigation ignores the old focus',async()=>{
 const focus='a'.repeat(32),requested=[],f=fixture({navigation:true,entryUrl:'https://family.test/?media='+focus+'#nursery/yona',albumFetch:async path=>{
  const params=new URL(path,'https://test/').searchParams;requested.push({page:Number(params.get('page')),focus:params.get('focus')});
  const page=params.has('focus')?3:Number(params.get('page'));
  return Response.json({...empty('yona'),items:[{id:page===3?focus:'page-'+page,name:'Baby photo',src:'/media/page-'+page}],count:23,pagination:{page,pages:3,total:23,size:10}});
 }});
 await f.flush();let album=f.registered.at(-1);
 assert.deepEqual(requested,[{page:1,focus}]);assert.equal(album.scope,'nursery:yona');assert.equal(album.items[0].id,focus);assert.equal(album.options.pagination.page,3);assert.match(f.html,/עמוד 3 מתוך 3/);
 await album.options.loadPage(2);album=f.registered.at(-1);
 assert.deepEqual(requested.at(-1),{page:2,focus:null});assert.equal(album.options.pagination.page,2);assert.equal(album.items[0].id,'page-2');assert.match(f.html,/עמוד 2 מתוך 3/);
});
test('a delayed viewer page and a retained loader cannot replace a different baby album',async()=>{
 let finishPage;const requested=[],f=fixture({albumFetch:path=>{
  const url=new URL(path,'https://test/'),id=url.pathname.split('/').at(-1),page=Number(url.searchParams.get('page'));requested.push(id+':'+page);
  if(id==='yona'&&page===2)return new Promise(resolve=>{finishPage=resolve;});
  return Promise.resolve(Response.json({...empty(id),items:[{id:id+'-1',name:id+' photo',src:'/media/'+id}],count:20,pagination:{page,pages:2,total:20,size:10}}));
 }});
 await f.flush();f.open('yona');await f.flush();const load=f.registered.at(-1).options.loadPage,pending=load(2);
 f.open('shlomo');await f.flush();finishPage(Response.json({...empty('yona'),items:[{id:'wrong-person',name:'Yona old page',src:'/media/wrong'}],count:20,pagination:{page:2,pages:2,total:20,size:10}}));await pending;
 assert.equal(f.registered.at(-1).scope,'nursery:shlomo');assert.match(f.html,/Shlomo/);assert.doesNotMatch(f.html,/wrong-person|Yona old page/);
 await load(1);assert.equal(f.registered.at(-1).scope,'nursery:shlomo');assert.deepEqual(requested,['yona:1','yona:2','shlomo:1']);
});
test('closing and reopening the viewer discards its unfinished page without jumping the baby grid',async()=>{
 let finishPage;const album=page=>({...empty('yona'),items:[{id:'photo-'+page,name:'Baby page '+page,src:'/media/page-'+page}],count:20,pagination:{page,pages:2,total:20,size:10}});
 const f=fixture({albumFetch:path=>Number(new URL(path,'https://test/').searchParams.get('page'))===2?new Promise(resolve=>{finishPage=resolve;}):Promise.resolve(Response.json(album(1)))});
 await f.flush();f.open('yona');await f.flush();f.openViewer();const pending=f.registered.at(-1).options.loadPage(2);
 f.closeViewer();assert.match(f.html,/עמוד 1 מתוך 2/);f.openViewer();
 finishPage(Response.json(album(2)));await pending;
 assert.equal(f.registered.at(-1).options.pagination.page,1);assert.equal(f.registered.at(-1).items[0].id,'photo-1');assert.doesNotMatch(f.html,/Baby page 2/);
});
test('a closed viewer can restore its opening page while a discarded later page remains in flight',async()=>{
 let finishLast;const requested=[],album=page=>({...empty('yona'),items:[{id:'photo-'+page,name:'Baby page '+page,src:'/media/page-'+page}],count:21,pagination:{page,pages:3,total:21,size:10}});
 const f=fixture({albumFetch:path=>{const page=Number(new URL(path,'https://test/').searchParams.get('page'));requested.push(page);return page===3?new Promise(resolve=>{finishLast=resolve;}):Promise.resolve(Response.json(album(page)));}});
 await f.flush();f.open('yona');await f.flush();f.openViewer();let load=f.registered.at(-1).options.loadPage;
 await load(2);assert.equal(f.registered.at(-1).options.pagination.page,2);load=f.registered.at(-1).options.loadPage;const pending=load(3);
 f.closeViewer();await load(1);assert.equal(f.registered.at(-1).options.pagination.page,1);
 finishLast(Response.json(album(3)));await pending;
 assert.equal(f.registered.at(-1).options.pagination.page,1);assert.equal(f.registered.at(-1).items[0].id,'photo-1');assert.deepEqual(requested,[1,2,3,1]);assert.match(f.html,/עמוד 1 מתוך 3/);
});
test('a closed return-page request cannot replace the grid after any viewer reopens',async()=>{
 for(const reopenedScope of ['nursery:yona','photos']){
  let finishRestore,firstPageRequests=0;const album=page=>({...empty('yona'),items:[{id:'photo-'+page,name:'Baby page '+page,src:'/media/page-'+page}],count:20,pagination:{page,pages:2,total:20,size:10}});
  const f=fixture({albumFetch:path=>{const page=Number(new URL(path,'https://test/').searchParams.get('page'));if(page===1&&++firstPageRequests>1)return new Promise(resolve=>{finishRestore=resolve;});return Promise.resolve(Response.json(album(page)));}});
  await f.flush();f.open('yona');await f.flush();f.openViewer();let load=f.registered.at(-1).options.loadPage;await load(2);load=f.registered.at(-1).options.loadPage;
  f.closeViewer();const restore=load(1);f.openViewer(reopenedScope);finishRestore(Response.json(album(1)));await restore;
  assert.equal(f.registered.at(-1).options.pagination.page,2,reopenedScope);assert.equal(f.registered.at(-1).items[0].id,'photo-2');assert.match(f.html,/עמוד 2 מתוך 2/);
 }
});
test('the viewer awaits an already loading grid page and reports failures without losing the current photos',async()=>{
 let finishPage;let attempts=0;const f=fixture({albumFetch:path=>{
  const page=Number(new URL(path,'https://test/').searchParams.get('page'));
  if(page===2){attempts++;return new Promise(resolve=>{finishPage=resolve;});}
  return Promise.resolve(Response.json({...empty('yona'),items:[{id:'first-photo',name:'First photo',src:'/media/first'}],count:20,pagination:{page:1,pages:2,total:20,size:10}}));
 }});
 await f.flush();f.open('yona');await f.flush();const load=f.registered.at(-1).options.loadPage;
 f.click('[data-nursery-page]',{nurseryPage:'1'});f.openViewer();let completed=false;const pending=load(2).then(()=>{completed=true;});await f.flush();assert.equal(completed,false);assert.equal(attempts,1,'Grid and viewer share the in-flight page request');
 finishPage(Response.json({...empty('yona'),items:[{id:'second-page',name:'Second page',src:'/media/second'}],count:20,pagination:{page:2,pages:2,total:20,size:10}}));await pending;assert.equal(f.registered.at(-1).items[0].id,'second-page');
 await load(1);const failed=load(2);finishPage(Response.json({error:'Please retry'},{status:503}));await assert.rejects(failed,/Please retry/);assert.equal(f.registered.at(-1).items[0].id,'first-photo');assert.match(f.html,/Please retry/);
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
