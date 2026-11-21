import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import family from '../src/family.mjs';
import {createKehatFamily,createTzadokFamily} from '../public/keha-extended/branch-portals.mjs';
import {toOriginalFamilyData} from '../public/nakash/tree-data-adapter.mjs';
import {browserHistory,navigationSource} from './helpers/browser-history.mjs';

const relationsSource=await readFile(new URL('../public/assets/relations.js',import.meta.url),'utf8');
const peopleSource=await readFile(new URL('../public/assets/people.js',import.meta.url),'utf8');
async function fixture(id='eldad',{familyData=family,navigation=false,entryUrl,english=false,overrides={},pageAlbums={},photoPages=null,pagedAlbums={},mediaView=null,pageView=null,phone=false,photoPrepare=async()=>[]}={}){
  const browser=navigation?browserHistory(entryUrl||'https://family.test/#person/'+id):null;let view=browser?browser.location.hash.slice(1).split('/')[0]:'person';
  const nodes=new Map(),listeners=new Map(),requests=[],registered=[],toasts=[],prepared=[],location=browser?.location||{hash:'#person/'+id,origin:'https://family.test'},callbacks=new Map();
  function node(name){if(!nodes.has(name))nodes.set(name,{innerHTML:'',hidden:false,open:false,value:'',files:[],clicks:0,click(){this.clicks++;},showModal(){this.open=true;},close(){this.open=false;},scrollIntoView(){},addEventListener:(kind,callback)=>listeners.set(name+':'+kind,callback),querySelector:()=>null});return nodes.get(name);}
  const summary=id=>({...familyData.people[id],...overrides[id]});
  const window={FAMILY_DATA:familyData,FamilyMedia:{register:(...args)=>registered.push(args)},FamilyI18n:{isEnglish:english,language:english?'en-US':'he',error:String,mediaName:item=>item.caption||item.name||'',fetch:async url=>{
    requests.push(String(url));if(String(url).startsWith('api/media/'))return mediaView?mediaView(String(url)):{ok:true,json:async()=>({item:{id:String(url).split('/')[2],kind:'photo',src:'/media/current'}})};
    if(pageView){const custom=pageView(String(url));if(custom)return custom;}
    const id=decodeURIComponent(String(url).match(/api\/people\/([^/]+)\/page/)[1]);
    const params=new URL(url,'https://family.test').searchParams;
    return {ok:true,status:200,json:async()=>({person:summary(id),revision:id,albums:Object.fromEntries(['photos','videos','documents'].map(key=>{
      const pages=key==='photos'&&photoPages?photoPages:pagedAlbums[key];if(!pages)return [key,{items:pageAlbums[key]||[],page:1,pages:1,total:pageAlbums[key]?.length||0,size:25}];
      const focus=pages.findIndex(items=>items.some(item=>item.id===params.get('focus'))),page=focus>=0?focus+1:Number(params.get(key)||1);
      return [key,{items:pages[page-1],page,pages:pages.length,total:pages.flat().length,size:pages[0].length}];
    }))})};
  }},scrollTo(){},addEventListener(event,callback){callbacks.set(event,callback);browser?.addEventListener(event,callback);}};
  window.FamilyApp={getPerson:id=>familyData.people[id],getPersonSummary:summary,nameOf:id=>english?summary(id).nameEn:summary(id).name,birthdayHTML:()=>'',updatePerson(){},toast:message=>toasts.push(message),getView:()=>view,setView(next,sync=true){if(browser&&sync)window.FamilyNavigation.go('#'+next);view=next;window.FamilyPeople.activate(next);}};
  window.FamilyPhotoEditor={prepare:(files,options)=>{prepared.push({files,options});return photoPrepare(files,options);}};
  const document={getElementById:node,addEventListener:(event,callback)=>callbacks.set(event,callback),querySelector:()=>null,visibilityState:'visible'};
  const context=vm.createContext({window,document,location,history:browser?.history||{pushState(_a,_b,hash){location.hash=hash;}},matchMedia:query=>({matches:phone&&query==='(max-width:700px)'}),URLSearchParams,URL,console,setInterval:()=>0,setTimeout,clearTimeout});
  if(browser){vm.runInContext(navigationSource,context);browser.addEventListener('popstate',()=>{const next=location.hash.slice(1).split('/')[0];if(next!==view)window.FamilyApp.setView(next,false);});}
  vm.runInContext(relationsSource,context);vm.runInContext(peopleSource,context);callbacks.get('DOMContentLoaded')();
  const flush=()=>new Promise(resolve=>setImmediate(resolve));await flush();
  return {window,browser,registered,toasts,prepared,node,clickUpload(kind='photos'){return listeners.get('personPageContent:click')({target:{closest:selector=>selector==='[data-person-upload]'?{dataset:{personUpload:kind}}:null}});},clickCamera(){return listeners.get('personPageContent:click')({target:{closest:selector=>selector==='[data-person-camera]'?{}:null}});},chooseSource(source){callbacks.get('click')({target:{closest:selector=>selector==='[data-person-photo-source]'?{dataset:{personPhotoSource:source}}:null}});},selectCapture(files){node('personPageCamera').files=files;listeners.get('personPageCamera:change')();},get view(){return view;},clickPage(step){return listeners.get('personPageContent:click')({target:{closest:selector=>selector==='[data-person-page]'?{dataset:{personPage:'photos',step:String(step)}}:null}});},clickPortrait(){return listeners.get('personPageContent:click')({target:{closest:selector=>selector==='[data-person-portrait]'?{}:null}});},clickItem(id,kind='photos'){return listeners.get('personPageContent:click')({target:{closest:selector=>selector==='[data-person-item]'?{dataset:{personItem:id,personKind:kind}}:null}});},openMedia(){node('mediaViewer').open=true;},closeMedia(){node('mediaViewer').open=false;listeners.get('mediaViewer:close')?.();},back(){return listeners.get('personPageContent:click')({preventDefault(){},target:{closest:selector=>selector==='[data-person-back]'?{}:null}});},location,requests,flush,get html(){return node('personPageContent').innerHTML;},async clickRelative(id,modifier=false){
    let prevented=false,stopped=false;
    await listeners.get('personPageContent:click')({button:0,ctrlKey:modifier,preventDefault(){prevented=true;},stopPropagation(){stopped=true;},target:{closest:selector=>selector==='[data-person-relative]'?{dataset:{personRelative:id}}:null}});
    await flush();return {prevented,stopped};
  }};
}
const group=(html,key)=>html.match(new RegExp('<section class="person-family-group" data-relative-kind="'+key+'"[\\s\\S]*?<\\/section>'))[0];

test('documented Kehat records appear beside the editable biography with safe source links',async()=>{
  const data=toOriginalFamilyData(createTzadokFamily(family));
  const f=await fixture('kehat-tzadok',{familyData:data});
  assert.match(f.html,/תיעוד ומקורות/);assert.match(f.html,/H57320/);assert.match(f.html,/7\.1\.1944/);
  assert.match(f.html,/document_id=bcabe2ef7e3d3a93_294dece0e6a0b728#page=81/);
  assert.match(f.html,/data-edit-about/);
  const malicious=await fixture('eldad',{overrides:{eldad:{researchNotes:'<script>bad()</script>',researchSources:[{label:'Unsafe',url:'javascript:bad()'},{label:'A & B',url:'https://example.test/?a=1&b=2'}]}}});
  assert.doesNotMatch(malicious.html,/<script>|href="javascript:/);assert.match(malicious.html,/&lt;script&gt;/);assert.match(malicious.html,/a=1&amp;b=2/);
});

test('a known grandfather appears as a grandfather while an unresolved father stays empty',async()=>{
  const data=toOriginalFamilyData(createTzadokFamily(family)),f=await fixture('kehat-ron',{familyData:data});
  assert.match(group(f.html,'grandparents'),/kehat-tzadok/);
  assert.doesNotMatch(group(f.html,'parents'),/kehat-tzadok|kehat-reuven|kehat-shimon/);
  assert.match(group(f.html,'children'),/kehat-gur/);
});

test('possible life dates remain visibly qualified and do not become confirmed profile dates',async()=>{
  const data=toOriginalFamilyData(createKehatFamily(family)),f=await fixture('kehat-jidaan',{familyData:data});
  assert.match(f.html,/רישום מצבה אפשרי · הזיהוי בבירור/);
  assert.match(f.html,/1876–1877/);assert.match(f.html,/9\.12\.1962/);assert.match(f.html,/גיל בפטירה: 85/);
  assert.equal(data.people['kehat-jidaan'].deathDate,undefined);
});

test('phone profile photo uploads offer camera or gallery, while other media and desktop keep their picker',async()=>{
 const f=await fixture('eldad',{phone:true});f.window.FamilyApp.apiEnabled=true;
 assert.equal((f.html.match(/data-person-camera/g)||[]).length,1);
 await f.clickUpload();assert.equal(f.node('personPhotoUploadSource').open,true);assert.equal(f.node('personPageUpload').clicks,0);
 f.chooseSource('gallery');assert.equal(f.node('personPhotoUploadSource').open,false);assert.equal(f.node('personPageUpload').clicks,1);assert.equal(f.node('personPageCamera').clicks,0);
 await f.clickUpload();f.chooseSource('camera');assert.equal(f.node('personPhotoUploadSource').open,false);assert.equal(f.node('personPageCamera').clicks,1);
 for(const kind of ['videos','documents']){await f.clickUpload(kind);assert.equal(f.node('personPhotoUploadSource').open,false);}
 assert.equal(f.node('personPageUpload').clicks,3);
 const desktop=await fixture();desktop.window.FamilyApp.apiEnabled=true;await desktop.clickUpload();assert.equal(desktop.node('personPageUpload').clicks,1);assert.equal(desktop.node('personPhotoUploadSource').open,false);
});
test('profile camera captures enter the upload wizard for the selected person, with cancellation and retakes supported',async()=>{
 let finish;const f=await fixture('shosh',{phone:true,photoPrepare:()=>new Promise(resolve=>{finish=resolve;})});f.window.FamilyApp.apiEnabled=true;
 const image={name:'camera.jpg',type:'image/jpeg',size:100};
 await f.clickCamera();assert.equal(f.node('personPageCamera').clicks,1);assert.equal(f.node('personPhotoUploadSource').open,false);
 f.selectCapture([]);await f.flush();assert.equal(f.prepared.length,0);
 await f.clickCamera();f.selectCapture([image]);await f.flush();assert.equal(f.prepared.length,1);assert.equal(f.prepared[0].options.scope,'personal:shosh');assert.equal(f.prepared[0].files[0],image);assert.equal(f.node('personPageCamera').value,'');
 finish([]);await f.flush();await f.clickUpload();f.chooseSource('camera');f.selectCapture([image]);await f.flush();assert.equal(f.prepared.length,2);assert.equal(f.prepared[1].options.scope,'personal:shosh');finish([]);await f.flush();
 f.window.FamilyApp.apiEnabled=false;const before=f.node('personPageCamera').clicks;await f.clickCamera();assert.equal(f.node('personPageCamera').clicks,before);
});

test('personal photo grid pages loop without changing the video and document pages',async()=>{
 const photoPages=['a','b','c'].map(id=>[{id,kind:'photo',mime:'image/jpeg',src:'/media/'+id}]),f=await fixture('eldad',{photoPages});
 assert.doesNotMatch(f.html,/data-person-page="photos" data-step="-1" disabled/);
 await f.clickPage(-1);assert.match(f.requests.at(-1),/photos=3&videos=1&documents=1/);assert.match(f.html,/data-person-item="c"/);assert.doesNotMatch(f.html,/data-person-page="photos" data-step="1" disabled/);
 await f.clickPage(1);assert.match(f.requests.at(-1),/photos=1&videos=1&documents=1/);assert.match(f.html,/data-person-item="a"/);
});

test('personal pages register the loaded album of a directly linked item without mixing media kinds',async()=>{
 const id='a'.repeat(32),make=(id,kind,mime)=>({id,kind,mime,src:'/media/'+id,caption:'Family memory',filename:id+'.jpg'});
 for(const key of ['photos','videos','documents']){
  const pageAlbums={photos:[make('photo','photo','image/jpeg')],videos:[make('video','video','video/mp4')],documents:[make('document','document','application/pdf')]};pageAlbums[key].push({...pageAlbums[key][0],id});
  const f=await fixture('ora',{navigation:true,entryUrl:'https://family.test/?media='+id+'#person/ora',pageAlbums});
  assert.equal(f.registered.length,1);assert.equal(f.registered[0][0],'personal:ora');assert.equal(f.registered[0][1],pageAlbums[key]);assert.equal(f.requests.length,1);
 }
 const unrelated=await fixture('ora',{navigation:true,entryUrl:'https://family.test/?media='+id+'#person/ora'});assert.equal(unrelated.registered.length,0);
});

test('an edited profile photo opens the same original media ID despite its display revision',async()=>{
 const id='a'.repeat(32),f=await fixture('eldad',{overrides:{eldad:{profile:'/media/'+id+'?v='+'b'.repeat(32)}}}),opened=[];
 f.window.FamilyMedia.open=(...args)=>opened.push(args);await f.clickPortrait();
 assert.ok(f.requests.includes('api/media/'+id+'/view'));assert.match(f.requests.at(-1),new RegExp('api/people/eldad/page\\?photos=1&videos=1&documents=1&focus='+id));assert.equal(opened.length,1);assert.equal(opened[0][0][0].id,id);assert.equal(opened[0][2],'personal:eldad');
});

test('a profile picture opens among the loaded personal photos at its real position, without duplicates',async()=>{
 const photo=id=>({id,kind:'photo',mime:'image/jpeg',src:'/media/'+id});
 for(const extra of [false,true]){
  const pageAlbums={photos:['a','profile','b'].map(photo),videos:[{id:'film',kind:'video',mime:'video/mp4',src:'/media/film'}]},f=await fixture('eldad',{overrides:{eldad:{extra,profile:'/media/profile?v=revision'}},pageAlbums}),opened=[];
  f.window.FamilyMedia.open=(...args)=>opened.push(args);await f.clickPortrait();
  assert.equal(opened.length,1);assert.deepEqual(Array.from(opened[0][0],item=>item.id),['a','profile','b']);assert.equal(opened[0][1],1);assert.equal(opened[0][2],'personal:eldad');
  assert.equal(opened[0][0][1].src,'/media/current','The selected photo uses the fresh original metadata');assert.equal(pageAlbums.photos[1].src,'/media/profile','Opening never mutates the rendered album array');
 }
});

test('a profile outside the loaded photo page opens on its real containing page with paging available',async()=>{
 const photos=['a','b'].map(id=>({id,kind:'photo',mime:'image/jpeg',src:'/media/'+id})),f=await fixture('eldad',{overrides:{eldad:{profile:'/media/profile'}},photoPages:[photos,[{id:'profile',kind:'photo',mime:'image/jpeg',src:'/media/profile'}]]}),opened=[];
 f.window.FamilyMedia.open=(...args)=>opened.push(args);await f.clickPortrait();
 assert.deepEqual(Array.from(opened[0][0],item=>item.id),['profile']);assert.equal(opened[0][1],0);assert.equal(opened[0][2],'personal:eldad');assert.equal(photos.length,2);
 assert.match(f.requests.at(-1),/focus=profile/);assert.equal(f.registered.at(-1)[2].pagination.page,2);assert.equal(f.registered.at(-1)[2].pagination.pages,2);assert.equal(typeof f.registered.at(-1)[2].loadPage,'function');
});

test('off-page personal links load the matching page and register a real page loader',async()=>{
 const id='f'.repeat(32),photo=id=>({id,kind:'photo',mime:'image/jpeg',src:'/media/'+id}),pages=[[photo('a'.repeat(32))],[photo(id)]];
 const f=await fixture('eldad',{navigation:true,entryUrl:'https://family.test/?media='+id+'#person/eldad',photoPages:pages});
 assert.match(f.requests[0],new RegExp('focus='+id));assert.equal(f.registered.length,1);assert.equal(f.registered[0][1][0].id,id);assert.equal(f.registered[0][2].pagination.page,2);assert.equal(typeof f.registered[0][2].loadPage,'function');
 await f.registered[0][2].loadPage(1);assert.equal(f.registered.at(-1)[2].pagination.page,1);assert.equal(f.registered.at(-1)[1][0].id,'a'.repeat(32));assert.match(f.requests.at(-1),/photos=1&videos=1&documents=1$/,'Subsequent paging does not keep forcing the original shared item');
});

test('personal gallery loaders page one media kind while retaining the other album positions',async()=>{
 const make=(id,kind)=>({id,kind,mime:kind==='photo'?'image/jpeg':kind==='video'?'video/mp4':'application/pdf',src:'/media/'+id});
 const f=await fixture('eldad',{overrides:{eldad:{profile:'/media/profile'}},photoPages:[[make('p1','photo')],[make('profile','photo')]],pagedAlbums:{videos:[[make('v1','video')],[make('v2','video')]],documents:[[make('d1','document')],[make('d2','document')],[make('d3','document')]]}}),opened=[];
 f.window.FamilyMedia.open=(...args)=>opened.push(args);
 await f.clickItem('v1','videos');assert.equal(f.registered.at(-1)[2].pagination.page,1);await f.registered.at(-1)[2].loadPage(2);
 assert.match(f.requests.at(-1),/photos=1&videos=2&documents=1/);assert.deepEqual(Array.from(f.registered.at(-1)[1],item=>item.id),['v2']);
 await f.clickItem('d1','documents');await f.registered.at(-1)[2].loadPage(3);assert.match(f.requests.at(-1),/photos=1&videos=2&documents=3/);
 await f.clickPortrait();assert.match(f.requests.at(-1),/photos=1&videos=2&documents=3&focus=profile/);assert.equal(opened.at(-1)[0][0].id,'profile');assert.equal(f.registered.at(-1)[2].pagination.page,2);
 const photoLoader=f.registered.at(-1)[2].loadPage;await photoLoader(1);assert.match(f.requests.at(-1),/photos=1&videos=2&documents=3/);assert.deepEqual(Array.from(f.registered.at(-1)[1],item=>item.kind),['photo']);
 f.closeMedia();await f.registered.at(-1)[2].loadPage(2);assert.equal(f.registered.at(-1)[2].pagination.page,2,'Closing can restore the grid page through the same loader');
 await f.clickItem('v2','videos');const count=f.requests.length;await assert.rejects(photoLoader(1),/album changed|האלבום השתנה/);assert.equal(f.requests.length,count,'A previous media kind cannot change the newly opened gallery');assert.equal(f.registered.at(-1)[1][0].kind,'video');
 await f.registered.at(-1)[2].loadPage(1);assert.match(f.requests.at(-1),/photos=2&videos=1&documents=3/);assert.deepEqual(Array.from(f.registered.at(-1)[1],item=>item.id),['v1']);
});

test('a page response cannot replace a newer page request or another person',async()=>{
 const make=id=>({id,kind:'photo',mime:'image/jpeg',src:'/media/'+id}),photoPages=[['a'],['b'],['c']].map(ids=>ids.map(make)),pending=new Map();let deferred=false;
 const response=page=>({ok:true,json:async()=>({person:family.people.eldad,revision:'page-'+page,albums:{photos:{items:photoPages[page-1],page,pages:3,total:3,size:1},videos:{items:[],page:1,pages:1,total:0,size:10},documents:{items:[],page:1,pages:1,total:0,size:10}}})});
 const f=await fixture('eldad',{photoPages,pageView:url=>deferred?new Promise(resolve=>pending.set(Number(new URL(url,'https://family.test').searchParams.get('photos')),resolve)):null});f.window.FamilyMedia.open=()=>{};await f.clickItem('a');const load=f.registered.at(-1)[2].loadPage;deferred=true;
 const older=load(2),olderResult=assert.rejects(older,/album changed|האלבום השתנה/),newer=load(3);pending.get(3)(response(3));await newer;pending.get(2)(response(2));await olderResult;assert.match(f.html,/data-person-item="c"/);assert.equal(f.registered.at(-1)[2].pagination.page,3);
 const stale=f.registered.at(-1)[2].loadPage(2),staleResult=assert.rejects(stale,/album changed|האלבום השתנה/);deferred=false;await f.clickRelative('yona');pending.get(2)(response(2));await staleResult;assert.match(f.html,/יונה/);assert.doesNotMatch(f.html,/data-person-item="b"/);
});

test('closing a viewer rejects its pending page without a grid jump and permits a new closed-page restoration',async()=>{
 const make=id=>({id,kind:'photo',mime:'image/jpeg',src:'/media/'+id}),photoPages=[[make('a')],[make('b')]];
 const response=page=>({ok:true,json:async()=>({person:family.people.eldad,revision:'page-'+page,albums:{photos:{items:photoPages[page-1],page,pages:2,total:2,size:1},videos:{items:[],page:1,pages:1,total:0,size:10},documents:{items:[],page:1,pages:1,total:0,size:10}}})});
 for(const reopen of [false,true]){
  let deferredPage=null,finish;
  const f=await fixture('eldad',{photoPages,pageView:url=>Number(new URL(url,'https://family.test').searchParams.get('photos'))===deferredPage?new Promise(resolve=>finish=resolve):null});
  f.window.FamilyMedia.open=()=>f.openMedia();await f.clickItem('a');const loadPage=f.registered.at(-1)[2].loadPage,registrations=f.registered.length;
  deferredPage=2;const pending=loadPage(2),rejected=assert.rejects(pending,/album changed|האלבום השתנה/);f.closeMedia();if(reopen)f.openMedia();
  finish(response(2));await rejected;assert.match(f.html,/data-person-item="a"/);assert.doesNotMatch(f.html,/data-person-item="b"/);assert.equal(f.registered.length,registrations,'The late response cannot register a different page after closing');
  if(reopen)f.closeMedia();deferredPage=null;await loadPage(2);assert.match(f.html,/data-person-item="b"/);assert.equal(f.registered.at(-1)[2].pagination.page,2,'An explicit load started while closed remains usable for grid restoration');
  deferredPage=1;const restoring=loadPage(1),restorationRejected=assert.rejects(restoring,/album changed|האלבום השתנה/);f.openMedia();finish(response(1));await restorationRejected;
  assert.match(f.html,/data-person-item="b"/,'Reopening a viewer also invalidates an unfinished closed-page restoration');
  f.closeMedia();deferredPage=null;await loadPage(1);assert.match(f.html,/data-person-item="a"/);assert.equal(f.registered.at(-1)[2].pagination.page,1);
 }
});

test('a late profile response cannot open over another person, page, gallery or closed viewer',async()=>{
 for(const change of ['person','view','album','close','same-person']){
  let finish;const photos=['a','b'].map(id=>({id,kind:'photo',mime:'image/jpeg',src:'/media/'+id}));
  const f=await fixture('eldad',{overrides:{eldad:{profile:'/media/profile'}},photoPages:[photos,photos],mediaView:()=>new Promise(resolve=>finish=resolve)}),opened=[];
  f.window.FamilyMedia.open=(...args)=>opened.push(args);const pending=f.clickPortrait();
  if(change==='person')await f.clickRelative('yona');
  else if(change==='view')f.window.FamilyApp.setView('directory',false);
  else if(change==='album')await f.clickPage(1);
  else if(change==='close')f.closeMedia();
  else f.window.FamilyPeople.open('eldad');
  finish({ok:true,json:async()=>({item:{id:'profile',kind:'photo',src:'/media/profile'}})});await pending;assert.equal(opened.length,0,change);assert.deepEqual(f.toasts,[]);
 }
 let finish;const f=await fixture('eldad',{overrides:{eldad:{profile:'/media/profile'}},pageAlbums:{photos:[{id:'a',kind:'photo',mime:'image/jpeg',src:'/media/a'}]},mediaView:()=>new Promise(resolve=>finish=resolve)}),opened=[];
 f.window.FamilyMedia.open=(...args)=>opened.push(args);const pending=f.clickPortrait();await f.clickItem('a');f.closeMedia();finish({ok:true,json:async()=>({item:{id:'profile',kind:'photo',src:'/media/profile'}})});await pending;assert.equal(opened.length,1);assert.equal(opened[0][0][0].id,'a');
});

test('only the latest profile request can open and unavailable profiles report an error without opening',async()=>{
 const pending=[],f=await fixture('eldad',{overrides:{eldad:{profile:'/media/profile'}},mediaView:()=>new Promise(resolve=>pending.push(resolve))}),opened=[];
 f.window.FamilyMedia.open=(...args)=>opened.push(args);const first=f.clickPortrait(),second=f.clickPortrait();
 pending[1]({ok:true,json:async()=>({item:{id:'profile',kind:'photo',src:'/media/new'}})});await second;
 pending[0]({ok:true,json:async()=>({item:{id:'profile',kind:'photo',src:'/media/old'}})});await first;assert.equal(opened.length,1);assert.equal(opened[0][0][0].src,'/media/new');
 const missing=await fixture('eldad',{overrides:{eldad:{profile:'/media/missing'}},mediaView:async()=>({ok:false,json:async()=>({error:'The photo was removed'})})}),missingOpened=[];
 missing.window.FamilyMedia.open=(...args)=>missingOpened.push(args);await missing.clickPortrait();assert.equal(missingOpened.length,0);assert.deepEqual(missing.toasts,['The photo was removed']);
});

test('Back restores each relative page and then the actual source section; Forward renders the correct person',async()=>{
  for(const english of [false,true]){
    const f=await fixture('eldad',{navigation:true,english,entryUrl:'https://family.test/#calendar'});
    f.window.FamilyPeople.open('eldad');await f.flush();await f.clickRelative('yehiel');await f.clickRelative('yona');
    const length=f.browser.history.length;
    f.browser.history.back();await f.flush();assert.match(f.html,english?/Yehiel/:/יחיאל/);assert.equal(f.location.hash,'#person/yehiel');
    f.browser.history.back();await f.flush();assert.match(f.html,english?/Eldad/:/אלדד/);assert.equal(f.location.hash,'#person/eldad');
    await f.back();await f.flush();assert.equal(f.view,'calendar');assert.equal(f.location.hash,'#calendar');
    f.browser.history.forward();await f.flush();assert.equal(f.location.hash,'#person/eldad');assert.match(f.html,english?/Eldad/:/אלדד/);
    assert.equal(f.browser.history.length,length);
  }
});

test('the personal Back link has a useful parent on a fresh direct entry',async()=>{
  const f=await fixture('eldad',{navigation:true});await f.back();await f.flush();
  assert.equal(f.view,'directory');assert.equal(f.location.hash,'#directory');
});

test('personal pages show four localized family groups in order, with cached photos and one page request',async()=>{
  for(const english of [false,true]){
    const f=await fixture('eldad',{english,overrides:{adi:{profile:'/media/adi.jpg'}}});
    assert.match(f.html,english?/Close family/:/משפחה קרובה/);
    assert.match(group(f.html,'partners'),/href="#person\/adi"/);
    assert.match(group(f.html,'partners'),/src="\/media\/adi.jpg"/);
    assert.match(group(f.html,'parents'),/href="#person\/yehiel"/);
    assert.match(group(f.html,'parents'),/href="#person\/rachel-katan"/);
    assert.match(group(f.html,'parents'),english?/title="Father"/:/title="אבא"/);
    assert.match(group(f.html,'parents'),english?/title="Mother"/:/title="אמא"/);
    assert.match(group(f.html,'parents'),english?/>Parents<\//:/>הורים<\//);
    assert.deepEqual([...f.html.matchAll(/data-relative-kind="([^"]+)"/g)].map(match=>match[1]),['partners','parents','children','siblings']);
    assert.match(group(f.html,'siblings'),/href="#person\/bosmat"/);
    assert.match(group(f.html,'siblings'),/href="#person\/naama"/);
    assert.ok(!group(f.html,'children').includes('data-person-relative'));
    assert.ok(f.html.indexOf('class="person-family"')<f.html.indexOf('class="person-about"'));
    assert.equal(f.requests.length,1,'relative photos must reuse the cache rather than fetch every relative');
  }
});
test('relative names are escaped and missing photos have a profile placeholder',async()=>{
  const f=await fixture('eldad',{overrides:{adi:{name:'<script>Adi</script> & family'}}});
  assert.match(group(f.html,'partners'),/&lt;script&gt;Adi&lt;\/script&gt; &amp; family/);
  assert.ok(!f.html.includes('<script>Adi'));
  assert.match(group(f.html,'partners'),/person-relative-initials/);
});
test('a relative link opens the selected personal page once and preserves native modified clicks',async()=>{
  const f=await fixture();
  assert.deepEqual(await f.clickRelative('bosmat',true),{prevented:false,stopped:true});assert.equal(f.requests.length,1);
  assert.deepEqual(await f.clickRelative('bosmat'),{prevented:true,stopped:true});
  assert.equal(f.location.hash,'#person/bosmat');assert.equal(f.requests.length,2);
  assert.match(group(f.html,'partners'),/href="#person\/itzik"/);
  assert.match(group(f.html,'parents'),/href="#person\/yehiel"/);
  assert.match(group(f.html,'children'),/href="#person\/naomi"/);
  assert.match(group(f.html,'children'),/href="#person\/noga"/);
});
test('parent links open the parent page and unknown parents stay empty',async()=>{
  const f=await fixture();
  assert.deepEqual(await f.clickRelative('yehiel'),{prevented:true,stopped:true});
  assert.equal(f.location.hash,'#person/yehiel');
  assert.match(group(f.html,'parents'),/href="#person\/yona"/);
  assert.match(group(f.html,'parents'),/href="#person\/shlomo"/);
  await f.clickRelative('rachel-katan');
  assert.ok(!group(f.html,'parents').includes('data-person-relative'));
  assert.match(group(f.html,'parents'),/טרם נוספו פרטים/);
});
test('About displays the active language without falling back to text in the other language',async()=>{
  for(const english of [false,true]){
    const f=await fixture('eldad',{english,overrides:{eldad:{about:'סיפור בעברית בלבד',aboutEn:'English story only'}}});
    assert.ok(f.html.includes(english?'English story only':'סיפור בעברית בלבד'));
    assert.ok(!f.html.includes(english?'סיפור בעברית בלבד':'English story only'));
  }
  const empty=await fixture('eldad',{english:true,overrides:{eldad:{about:'סיפור בעברית בלבד'}}});assert.ok(!empty.html.includes('סיפור בעברית בלבד'));
});
test('a manually added acquaintance opens a tagged-media album without invented family or biography sections',async()=>{
 for(const english of[false,true]){
  const f=await fixture('eldad',{english,overrides:{eldad:{extra:true}}});
  assert.match(f.html,english?/Family friends and acquaintances/:/מכרים וחברי משפחה/);
  assert.match(f.html,/id="personAlbum-photos"/);assert.match(f.html,/data-person-back/);
  assert.doesNotMatch(f.html,/class="person-about"|class="person-family"|id="personPageBirthday"/);
 }
});
