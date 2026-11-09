import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {File} from 'node:buffer';
import {readFile} from 'node:fs/promises';
import {browserHistory,navigationSource} from './helpers/browser-history.mjs';

const source=await readFile(new URL('../public/assets/media.js',import.meta.url),'utf8');
function fixture({navigation=false,english=false,native=true,files=true,cancel=false,clipboard=true,defer=false}={}){
  const nodes=new Map(),events=new Map(),windowEvents=new Map(),shared=[],copied=[],requests=[],pending=[];
  class Node{
    constructor(){this.handlers=new Map();this.hidden=false;this.open=false;this.textContent='';this.value='';this.isConnected=true;this.classList={toggle(){}};this.children=new Map();this.content=[];}
    addEventListener(type,callback){this.handlers.set(type,callback);}
    setAttribute(key,value){this[key]=value;}
    getAttribute(key){return key in this?String(this[key]):null;}
    removeAttribute(key){delete this[key];}
    querySelector(selector){if(!this.children.has(selector))this.children.set(selector,new Node());return this.children.get(selector);}
    querySelectorAll(){return [];}
    replaceChildren(...nodes){this.content=nodes;}
    append(...nodes){this.content.push(...nodes);}
    focus(){}
    select(){}
    load(){}
    showModal(){this.open=true;}
    close(){this.open=false;this.handlers.get('close')?.();}
  }
  const get=id=>{if(!nodes.has(id))nodes.set(id,new Node());return nodes.get(id);};
  const browser=navigation?browserHistory('https://family.test/?lang='+(english?'en-US':'he')+'#gallery'):null;
  const location=browser?.location||{origin:'https://family.test',href:'https://family.test/?lang='+(english?'en-US':'he')+'#gallery'};
  const window={FamilyApp:{apiEnabled:true,toast(){}},FamilyTags:{taggable:item=>['photo','video'].includes(item.kind),mountInline(){},clearInline(){},controls:()=>'',labels:()=>''},addEventListener(type,fn){if(!windowEvents.has(type))windowEvents.set(type,[]);windowEvents.get(type).push(fn);},dispatchEvent(event){for(const fn of windowEvents.get(event.type)||[])fn(event);}};
  window.FamilyI18n={isEnglish:english,language:english?'en-US':'he',t:v=>v,html:(parts,...values)=>parts.reduce((s,p,i)=>s+p+(values[i]??''),''),mediaName:p=>p.name||'',fetch:async(path,options)=>{requests.push({path,options});return{ok:true,blob:()=>defer?new Promise(resolve=>pending.push(resolve)):Promise.resolve(new Blob(['picture'],{type:'image/jpeg'}))};}};
  const navigator={userActivation:{isActive:true},clipboard:{async writeText(value){if(!clipboard)throw Error('Unavailable');copied.push(value);}}};
  if(native){navigator.canShare=()=>files;navigator.share=async data=>{shared.push(data);if(cancel)throw Object.assign(Error('Cancelled'),{name:'AbortError'});};}
  const document={activeElement:null,getElementById:get,querySelector:()=>null,querySelectorAll:()=>[],createElement:()=>new Node(),createTextNode:text=>({textContent:text}),addEventListener:(type,callback)=>events.set(type,callback)};
  if(browser)window.addEventListener=browser.addEventListener;
  const context=vm.createContext({window,document,location,navigator,File,Blob,URL,CustomEvent:class{constructor(type,{detail}){this.type=type;this.detail=detail;}},history:browser?.history||{replaceState(){}},matchMedia:()=>({matches:false}),clearTimeout,setTimeout});
  if(browser)vm.runInContext(navigationSource,context);vm.runInContext(source,context);events.get('DOMContentLoaded')();
  const photo=(id='a')=>({id,kind:'photo',mime:'image/jpeg',src:'/media/'+id,name:'Family photo',filename:'memory.jpg',tags:[]});
  return {browser,photo,window,document,events,nodes,get,navigator,shared,copied,requests,pending,open(id='a'){window.FamilyMedia.open([photo(id)],0,'gallery');},close(){get('mediaViewer').close();},click(){return get('shareMediaInstagram').handlers.get('click')({preventDefault(){}});}};
}
test('photo viewers request the family album toggle and keep current pixels while membership changes',()=>{
 const f=fixture(),calls=[];f.window.FamilyPhotoCollections={controls(item,scope,options){calls.push({item,scope,options});return item.kind==='photo'?'family-toggle':'';}};
 f.open();assert.equal(calls.at(-1).options.viewer,true);assert.equal(f.get('mediaViewerCollections').innerHTML,'family-toggle');
 const image=f.get('mediaStage').content[0];f.window.dispatchEvent(new CustomEvent('family-media-changed',{detail:{operation:'collection',scope:'photos',included:true,item:{...f.photo(),collections:['gallery','photos']}}}));
 assert.equal(f.get('mediaStage').content[0],image);assert.equal(calls.at(-1).item.collections.includes('photos'),true);
 f.window.FamilyMedia.open([{id:'video',kind:'video',src:'/media/video'}],0,'videos');assert.equal(f.get('mediaViewerCollections').innerHTML,'');
});
test('photo editing refreshes the displayed pixels, face coordinates and download, including after reopening',async()=>{
 for(const scope of ['gallery','personal:ruti','wedding:parents','nostalgia','nursery:ruti']){
  const f=fixture(),calls=[],mounts=[],photo=f.photo(),edited={...photo,src:'/media/a?v=new',photoRevision:'new'};
  f.window.FamilyFaces={clear(){},update(){},mount(_stage,img,item){mounts.push({img,item});}};
  f.window.FamilyPhotoEditor={async edit(item){calls.push(item);return {operation:'photo-edit',scope:'gallery',item:edited};}};
  f.window.FamilyMedia.open([photo],0,scope);assert.equal(f.get('editOpenedPhoto').hidden,false);
  const previousImage=f.get('mediaStage').content[0];
  await f.get('editOpenedPhoto').handlers.get('click')();assert.equal(calls.length,1);assert.equal(calls[0].id,'a');assert.equal(f.get('mediaOriginal').href,edited.src);assert.equal(f.get('mediaViewer').open,true);
  assert.equal(f.get('mediaStage').content[0].src,edited.src);assert.notEqual(f.get('mediaStage').content[0],previousImage);assert.equal(mounts.at(-1).item.photoRevision,'new');
  const editedImage=f.get('mediaStage').content[0];f.window.dispatchEvent(new CustomEvent('family-media-changed',{detail:{operation:'tags',item:{...edited,tags:[{id:'yona'}]}}}));
  assert.equal(f.get('mediaStage').content[0],editedImage,'Metadata updates must preserve the image and its active face controls');
  f.close();f.window.FamilyMedia.openFrom(scope,'a');assert.equal(f.get('mediaStage').content[0].src,edited.src);
  f.window.FamilyMedia.open([{id:'video',kind:'video',src:'/media/video'}],0,scope);assert.equal(f.get('editOpenedPhoto').hidden,true);
  await f.get('editOpenedPhoto').handlers.get('click')();assert.equal(calls.length,1);
 }
});
test('editing a retained photo refreshes its pixels without adding it back to the filtered album',async()=>{
 const f=fixture(),edited={...f.photo(),src:'/media/a?v=edited',photoRevision:'edited'};f.open();f.window.FamilyMedia.register('gallery',[],{retainCurrent:true});
 f.window.FamilyPhotoEditor={edit:async()=>({operation:'photo-edit',scope:'gallery',item:edited})};await f.get('editOpenedPhoto').handlers.get('click')();
 assert.equal(f.get('mediaViewer').open,true);assert.equal(f.get('mediaStage').content[0].src,edited.src);f.close();f.window.FamilyMedia.openFrom('gallery','a');assert.equal(f.get('mediaViewer').open,false);
});
test('editor cancellation leaves the current photo unchanged and editing keys cannot move the underlying album',async()=>{
 const f=fixture();f.window.FamilyPhotoEditor={edit:async()=>null};f.window.FamilyMedia.open([f.photo('a'),f.photo('b')],0,'gallery');
 await f.get('editOpenedPhoto').handlers.get('click')();assert.equal(f.get('mediaOriginal').href,'/media/a');
 f.document.querySelector=()=>({open:true});f.events.get('keydown')({key:'ArrowRight',target:{closest:()=>null},preventDefault(){}});assert.equal(f.get('mediaOriginal').href,'/media/a');
 f.document.querySelector=()=>null;f.events.get('keydown')({key:'ArrowRight',target:{closest:()=>null},preventDefault(){}});assert.equal(f.get('mediaOriginal').href,'/media/b');
});
test('Back closes a media viewer in its original album and Forward restores the cached photo once',async()=>{
  const f=fixture({navigation:true}),url=f.browser.location.href;
  f.open('a');assert.equal(f.browser.location.search,'?lang=he&media=a');assert.equal(f.get('mediaViewer').open,true);
  const length=f.browser.history.length;
  f.browser.history.back();await f.browser.flush();assert.equal(f.browser.location.href,url);assert.equal(f.get('mediaViewer').open,false);
  f.browser.history.forward();await f.browser.flush();assert.equal(f.get('mediaViewer').open,true);assert.equal(f.get('copyMediaLink').handlers.has('click'),true);
  assert.equal(f.browser.history.length,length);assert.equal(f.requests.length,0,'cached Forward must not fetch the shared link again');
  f.close();await f.browser.flush();assert.equal(f.browser.location.href,url);
  f.browser.history.back();await f.browser.flush();assert.equal(f.browser.location.hash,'#tree');assert.equal(f.get('mediaViewer').open,false);
});

test('moving between photos keeps one viewer history entry and returns to the album from the last photo',async()=>{
  const f=fixture({navigation:true});f.window.FamilyMedia.open([f.photo('a'),f.photo('b')],0,'gallery');
  const length=f.browser.history.length;
  f.get('mediaNext').handlers.get('click')();assert.equal(f.browser.location.search,'?lang=he&media=b');
  assert.equal(f.browser.history.length,length);f.close();await f.browser.flush();
  assert.equal(f.browser.location.hash,'#gallery');assert.equal(f.browser.location.search,'?lang=he');
  f.browser.history.forward();await f.browser.flush();assert.equal(f.get('mediaViewer').open,true);assert.equal(f.browser.location.search,'?lang=he&media=b');
});
test('Instagram shares an actual file through the native sheet and reuses the prepared file only for its own photo',async()=>{
  const f=fixture();f.open('a');await f.click();assert.equal(f.shared.length,1);assert.equal(f.shared[0].files.length,1);assert.equal(await f.shared[0].files[0].text(),'picture');assert.equal(f.shared[0].files[0].type,'image/jpeg');assert.equal(f.shared[0].url,undefined);assert.equal(f.requests[0].path,'/media/a');assert.equal(f.requests[0].options.cache,'force-cache');assert.equal(f.get('shareMediaInstagram').disabled,false);
  await f.click();assert.equal(f.requests.length,1);f.open('b');await f.click();assert.equal(f.requests.length,2);assert.equal(f.requests[1].path,'/media/b');
});
test('sharing a photo after editing fetches its new pixels and discards preparation of the old revision',async()=>{
 for(const inFlight of [false,true]){
  const f=fixture({defer:inFlight});f.open();const sharing=f.click();await new Promise(resolve=>setImmediate(resolve));if(!inFlight)await sharing;
  const edited={...f.photo(),src:'/media/a?v=new',photoRevision:'new'};f.window.dispatchEvent(new CustomEvent('family-media-changed',{detail:{operation:'photo-edit',scope:'gallery',item:edited}}));
  if(inFlight){f.pending.shift()(new Blob(['old'],{type:'image/jpeg'}));await sharing;assert.equal(f.shared.length,0);assert.equal(f.get('shareMediaInstagram').disabled,false);}
  const latest=f.click();await new Promise(resolve=>setImmediate(resolve));if(inFlight)f.pending.shift()(new Blob(['edited'],{type:'image/jpeg'}));await latest;
  assert.equal(f.requests.length,2);assert.equal(f.requests.at(-1).path,edited.src);if(inFlight)assert.equal(await f.shared[0].files[0].text(),'edited');
 }
});
test('unsupported sharing offers a photo download and a copied deep link, in both languages',async()=>{
  for(const english of [false,true])for(const native of [false,true]){
    const f=fixture({english,native,files:false});f.open();await f.click();assert.equal(f.shared.length,0);assert.equal(f.get('instagramShareHelp').hidden,false);assert.equal(f.get('downloadForInstagram').href,'/media/a');assert.equal(f.get('downloadForInstagram').textContent,english?'Download photo':'הורדת התמונה');assert.match(f.copied[0],/media=a/);assert.match(f.get('mediaShareStatus').textContent,english?/Link copied/:/הקישור הועתק/);
  }
});
test('a lost user gesture prepares the file for a second tap without fetching it again',async()=>{
  const f=fixture({english:true});f.open();f.navigator.userActivation.isActive=false;await f.click();assert.equal(f.shared.length,0);assert.match(f.get('mediaShareStatus').textContent,/Tap Instagram again/);f.navigator.userActivation.isActive=true;await f.click();assert.equal(f.shared.length,1);assert.equal(f.requests.length,1);
});
test('cancelling native share stays quiet and unavailable clipboard exposes a selectable link',async()=>{
  const native=fixture({cancel:true});native.open();await native.click();assert.equal(native.get('mediaShareStatus').textContent,'');assert.equal(native.get('instagramShareHelp').hidden,true);
  const fallback=fixture({native:false,clipboard:false});fallback.open();await fallback.click();assert.equal(fallback.get('mediaLinkFallback').hidden,false);assert.match(fallback.get('mediaLinkFallback').value,/media=a/);
});
test('a photo changed or closed during preparation is never shared or attached to the next photo',async()=>{
  for(const close of [false,true]){
    const f=fixture({defer:true});f.open('a');const pending=f.click();await new Promise(resolve=>setImmediate(resolve));assert.equal(f.pending.length,1);if(close)f.close();else f.open('b');f.pending[0](new Blob(['old-photo'],{type:'image/jpeg'}));await pending;assert.equal(f.shared.length,0);assert.equal(f.copied.length,0);if(!close)assert.equal(f.get('shareMediaInstagram').disabled,false);
  }
});
test('tagging can keep the current photo open while the untagged album updates behind it',()=>{
  const f=fixture();f.open('a');
  const next={id:'b',kind:'photo',src:'/media/b',name:'Next photo',tags:[]};
  f.window.FamilyMedia.register('gallery',[next],{retainCurrent:true});
  assert.equal(f.get('mediaViewer').open,true);assert.equal(f.get('mediaOriginal').href,'/media/a');
  f.window.FamilyMedia.requestDelete('gallery','a');assert.equal(f.get('deleteMediaDialog').open,true,'The retained photo still supports its normal actions');f.get('deleteMediaDialog').close();
  f.get('mediaNext').handlers.get('click')();assert.equal(f.get('mediaOriginal').href,'/media/b');
  f.window.FamilyMedia.register('gallery',[],{retainCurrent:true});assert.equal(f.get('mediaViewer').open,true);assert.equal(f.get('mediaOriginal').href,'/media/b');
  f.window.FamilyMedia.register('gallery',[]);assert.equal(f.get('mediaViewer').open,false,'An actual deletion can still close the last photo');
  f.window.FamilyMedia.openFrom('gallery','b');assert.equal(f.get('mediaViewer').open,false,'The retained photo must not leak into the filtered album on reopening');
});
test('repeated tag, face and detector events cannot close or replace a photo already omitted from a filtered album',()=>{
 for(const onlyPhoto of[false,true]){
  const f=fixture(),photo=f.photo('a'),next=f.photo('b');f.window.FamilyMedia.open(onlyPhoto?[photo]:[photo,next],0,'gallery');
  f.window.FamilyMedia.register('gallery',onlyPhoto?[]:[next],{retainCurrent:true});
  for(const[index,operation]of['tags','faces','face-detection','face-review','tags'].entries()){
   f.window.dispatchEvent(new CustomEvent('family-media-changed',{detail:{operation,scope:'gallery',item:{...photo,tags:[{id:'yona'}],tagsRevision:'revision-'+index}}}));
   assert.equal(f.get('mediaViewer').open,true,operation+' must keep the viewer open');assert.equal(f.get('mediaOriginal').href,'/media/a',operation+' must not advance to another photo');
   assert.equal(f.get('mediaTagPanel').hidden,false);
  }
  f.get('closeMediaViewer').handlers.get('click')();assert.equal(f.get('mediaViewer').open,false);
  f.window.FamilyMedia.openFrom('gallery','a');assert.equal(f.get('mediaViewer').open,false,'A retained photo must not be reinserted into the actual filtered collection');
 }
});
test('a click retargeted to the viewer after a tag option disappears cannot dismiss the photo',()=>{
 const f=fixture();f.open('a');f.get('mediaViewer').handlers.get('click')?.({target:f.get('mediaViewer')});assert.equal(f.get('mediaViewer').open,true);
 f.get('closeMediaViewer').handlers.get('click')();assert.equal(f.get('mediaViewer').open,false);
});
test('an unrelated deletion cannot evict a pinned photo, while deleting that photo still closes it',()=>{
 const f=fixture();f.open('a');f.window.FamilyMedia.register('gallery',[],{retainCurrent:true});
 f.window.dispatchEvent(new CustomEvent('family-media-changed',{detail:{operation:'delete',scope:'gallery',item:f.photo('b')}}));assert.equal(f.get('mediaViewer').open,true);assert.equal(f.get('mediaOriginal').href,'/media/a');
 f.window.dispatchEvent(new CustomEvent('family-media-changed',{detail:{operation:'delete',scope:'gallery',item:f.photo('a')}}));assert.equal(f.get('mediaViewer').open,false);
});
test('the profile action follows the album owner gender when switching between personal albums',()=>{
  const f=fixture(),owners={rachel:{gender:'f'},avishai:{gender:'m'}};
  f.window.FamilyApp.getPerson=id=>owners[id];
  const photo={id:'group',kind:'photo',src:'/media/group',file:'group.jpg',tags:[{id:'avishai',gender:'m'}]};
  const button=f.get('openedProfilePhoto'),hair=button.querySelector('[data-profile-hair]');
  f.window.FamilyMedia.open([photo],0,'personal:rachel');assert.equal(button.hidden,false);assert.equal(button.getAttribute('data-gender'),'f');assert.equal(hair.getAttribute('hidden'),null);
  f.window.FamilyMedia.open([photo],0,'personal:avishai');assert.equal(button.getAttribute('data-gender'),'m');assert.equal(hair.getAttribute('hidden'),'');
  f.window.FamilyMedia.open([photo],0,'personal:guest');assert.equal(button.getAttribute('data-gender'),'unknown');
  f.window.FamilyMedia.open([photo],0,'gallery');assert.equal(button.hidden,true,'Only a personal album offers profile selection');
});
test('the effective profile stays selected across photo navigation and live owner updates',()=>{
 for(const english of [false,true]){
  const f=fixture({english}),owner={profileFile:'b.jpg',profile:'/media/b?v=edited',profileId:'old-deleted'};
  f.window.FamilyApp.getPerson=()=>({gender:'f'});f.window.FamilyApp.getPersonSummary=()=>owner;
  const photos=['a','b'].map(id=>({...f.photo(id),file:id+'.jpg'})),button=f.get('openedProfilePhoto');
  f.window.FamilyMedia.open(photos,0,'personal:rachel');assert.equal(button.getAttribute('aria-pressed'),'false');
  f.get('mediaNext').handlers.get('click')();assert.equal(button.getAttribute('aria-pressed'),'true');assert.equal(button.querySelector('span').textContent,english?'Current profile picture':'זו תמונת הפרופיל');
  f.get('mediaPrevious').handlers.get('click')();assert.equal(button.getAttribute('aria-pressed'),'false');
  owner.profileFile='a.jpg';f.window.dispatchEvent(new CustomEvent('family-profile-changed',{detail:{id:'rachel'}}));assert.equal(button.getAttribute('aria-pressed'),'true');
 }
});
test('clicking a selected profile restores its predecessor, updates the marks and sends one guarded request',async()=>{
 for(const english of [false,true]){
  const f=fixture({english}),owner={profileFile:'b.jpg',profile:'/media/b'},photos=['a','b'].map(id=>({...f.photo(id),file:id+'.jpg'})),button=f.get('openedProfilePhoto');
  f.window.FamilyApp.getPersonSummary=()=>owner;f.window.FamilyApp.updatePerson=(_id,person)=>Object.assign(owner,person);
  let resolve;f.window.FamilyI18n.fetch=async(path,options)=>{f.requests.push({path,options});return new Promise(done=>resolve=done);};
  f.window.FamilyMedia.open(photos,1,'personal:rachel');assert.equal(button.getAttribute('aria-pressed'),'true');assert.match(button.title,english?/undo/:/לביטול/);
  const undo=button.handlers.get('click')();await button.handlers.get('click')();assert.equal(f.requests.length,1);assert.equal(f.requests[0].path,'api/people/rachel/profile');assert.deepEqual(JSON.parse(f.requests[0].options.body),{file:'b.jpg',restorePrevious:true});
  f.get('mediaPrevious').handlers.get('click')();resolve({ok:true,json:async()=>({person:{profileId:'a',profileFile:'a.jpg',profile:'/media/a'}})});await undo;
  assert.equal(button.getAttribute('aria-pressed'),'true','The restored previous photo gets its mark even after navigation');f.get('mediaNext').handlers.get('click')();assert.equal(button.getAttribute('aria-pressed'),'false');assert.equal(button.disabled,false);
 }
});
test('undo with no predecessor shows no profile, can be selected again, and a failed undo preserves the selected state',async()=>{
 const f=fixture(),owner={profileId:'a',profileFile:'a.jpg',profile:'/media/a'},item={...f.photo(),file:'a.jpg'},button=f.get('openedProfilePhoto');
 f.window.FamilyApp.getPersonSummary=()=>owner;f.window.FamilyApp.updatePerson=(_id,person)=>Object.assign(owner,person);f.window.FamilyI18n.error=value=>value;
 let response={ok:false,json:async()=>({error:'Unavailable'})};f.window.FamilyI18n.fetch=async(path,options)=>{f.requests.push({path,options});return response;};
 f.window.FamilyMedia.open([item],0,'personal:rachel');await button.handlers.get('click')();assert.equal(button.getAttribute('aria-pressed'),'true');assert.equal(owner.profile,'/media/a');
 response={ok:true,json:async()=>({person:{profileId:null,profileFile:null,profile:null,profileCleared:true}})};await button.handlers.get('click')();assert.equal(owner.profile,null);assert.equal(button.getAttribute('aria-pressed'),'false');
 response={ok:true,json:async()=>({person:{profileId:'a',profileFile:'a.jpg',profile:'/media/a',profileCleared:false}})};await button.handlers.get('click')();assert.deepEqual(JSON.parse(f.requests.at(-1).options.body),{file:'a.jpg'});assert.equal(button.getAttribute('aria-pressed'),'true');
});
test('a profile save updates the correct photo after navigation, survives reopening, and a failed save adds no selection',async()=>{
 const f=fixture(),owners={rachel:{profileFile:'a.jpg'},other:{profileFile:'other.jpg'}},photos=['a','b','c'].map(id=>({...f.photo(id),file:id+'.jpg'})),button=f.get('openedProfilePhoto');
 f.window.FamilyApp.getPersonSummary=id=>owners[id];f.window.FamilyApp.updatePerson=(id,person)=>Object.assign(owners[id],person);f.window.FamilyI18n.error=value=>value;
 let resolve;f.window.FamilyI18n.fetch=async(path,options)=>{f.requests.push({path,options});return new Promise(done=>resolve=done);};
 f.window.FamilyMedia.open(photos,1,'personal:rachel');const saving=button.handlers.get('click')();assert.equal(button.getAttribute('aria-pressed'),'false');
 f.get('mediaPrevious').handlers.get('click')();resolve({ok:true,json:async()=>({person:{profileFile:'b.jpg',profile:'/media/b'}})});await saving;
 assert.equal(button.getAttribute('aria-pressed'),'false','The old photo must lose its mark when the new save succeeds');
 f.get('mediaNext').handlers.get('click')();assert.equal(button.getAttribute('aria-pressed'),'true');f.close();f.window.FamilyMedia.open(photos,1,'personal:rachel');assert.equal(button.getAttribute('aria-pressed'),'true');
 f.get('mediaNext').handlers.get('click')();const failing=button.handlers.get('click')();resolve({ok:false,json:async()=>({error:'Not saved'})});await failing;assert.equal(button.getAttribute('aria-pressed'),'false');assert.equal(button.disabled,false);assert.equal(owners.rachel.profileFile,'b.jpg');
});
test('wedding and baby albums offer their own cover selection without replacing a person profile',async()=>{
 for(const english of[false,true])for(const scope of['wedding:u-root','nursery:yona']){
  const f=fixture({english}),item={...f.photo('a'),file:'a.jpg'};let profileUpdates=0;f.window.FamilyApp.updatePerson=()=>profileUpdates++;
  f.window.FamilyI18n.fetch=async(path,options)=>{f.requests.push({path,options});return{ok:true,json:async()=>({saved:true,operation:'album-cover',scope,item,collection:{items:[item],count:1,cover:item.src}})};};
  f.window.FamilyMedia.open([item],0,scope);const button=f.get('openedProfilePhoto');assert.equal(button.hidden,false);assert.match(button.querySelector('span').textContent,scope.startsWith('wedding:')?(english?/wedding/:/חתונה/):(english?/baby/:/תינוקייה/));
  await button.handlers.get('click')();assert.equal(f.requests[0].path,'api/collections/cover');assert.deepEqual(JSON.parse(f.requests[0].options.body),{collection:scope,mediaId:'a'});assert.equal(profileUpdates,0);assert.equal(f.get('mediaViewer').open,true);assert.equal(button.disabled,false);assert.equal(button.getAttribute('aria-pressed'),'true');
  f.close();f.window.FamilyMedia.register(scope,[item],{cover:item.src+'?revision=latest'});f.window.FamilyMedia.open([item],0,scope);assert.equal(button.getAttribute('aria-pressed'),'true');
 }
});
test('desktop header captions follow photo navigation and both screen sizes retain their own description labels',()=>{
  for(const english of [false,true]){
    const f=fixture({english}),photos=[{id:'a',kind:'photo',src:'/media/a',caption:'A family memory',tags:[]},{id:'b',kind:'photo',src:'/media/b',caption:'',tags:[]}];
    f.window.FamilyMedia.open(photos,0,'gallery');
    assert.equal(f.get('mediaHeaderCaption').textContent,'A family memory');assert.equal(f.get('mediaViewerCaption').textContent,'A family memory');
    assert.equal(f.get('editOpenedCaption').querySelector('[data-media-caption-desktop]').textContent,english?'Add a photo description':'להוספת תיאור לתמונה');
    assert.equal(f.get('editOpenedCaption').querySelector('[data-media-caption-mobile]').textContent,english?'Add a description':'הוסף תיאור לתמונה');
    f.get('mediaNext').handlers.get('click')();assert.equal(f.get('mediaHeaderCaption').textContent,'');assert.equal(f.get('mediaViewerCaption').textContent,'','Moving to an uncaptioned photo clears the previous description everywhere');
    assert.equal(f.get('openedProfilePhoto').hidden,true,'The shared gallery does not offer profile selection');
  }
});
