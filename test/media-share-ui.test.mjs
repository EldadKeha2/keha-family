import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {File} from 'node:buffer';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../public/assets/media.js',import.meta.url),'utf8');
function fixture({english=false,native=true,files=true,cancel=false,clipboard=true,defer=false}={}){
  const nodes=new Map(),events=new Map(),shared=[],copied=[],requests=[],pending=[];
  class Node{
    constructor(){this.handlers=new Map();this.hidden=false;this.open=false;this.textContent='';this.value='';this.isConnected=true;this.classList={toggle(){}};this.children=new Map();}
    addEventListener(type,callback){this.handlers.set(type,callback);}
    setAttribute(key,value){this[key]=value;}
    getAttribute(key){return key in this?String(this[key]):null;}
    removeAttribute(key){delete this[key];}
    querySelector(selector){if(!this.children.has(selector))this.children.set(selector,new Node());return this.children.get(selector);}
    querySelectorAll(){return [];}
    replaceChildren(){}
    append(){}
    focus(){}
    select(){}
    load(){}
    showModal(){this.open=true;}
    close(){this.open=false;this.handlers.get('close')?.();}
  }
  const get=id=>{if(!nodes.has(id))nodes.set(id,new Node());return nodes.get(id);};
  const location={origin:'https://family.test',href:'https://family.test/?lang='+(english?'en-US':'he')+'#gallery'};
  const window={FamilyApp:{apiEnabled:true,toast(){}},FamilyTags:{taggable:item=>['photo','video'].includes(item.kind),mountInline(){},clearInline(){},controls:()=>'',labels:()=>''},addEventListener(){}};
  window.FamilyI18n={isEnglish:english,language:english?'en-US':'he',t:v=>v,html:(parts,...values)=>parts.reduce((s,p,i)=>s+p+(values[i]??''),''),mediaName:p=>p.name||'',fetch:async(path,options)=>{requests.push({path,options});return{ok:true,blob:()=>defer?new Promise(resolve=>pending.push(resolve)):Promise.resolve(new Blob(['picture'],{type:'image/jpeg'}))};}};
  const navigator={userActivation:{isActive:true},clipboard:{async writeText(value){if(!clipboard)throw Error('Unavailable');copied.push(value);}}};
  if(native){navigator.canShare=()=>files;navigator.share=async data=>{shared.push(data);if(cancel)throw Object.assign(Error('Cancelled'),{name:'AbortError'});};}
  const document={activeElement:null,getElementById:get,querySelectorAll:()=>[],createElement:()=>new Node(),addEventListener:(type,callback)=>events.set(type,callback)};
  vm.runInNewContext(source,{window,document,location,navigator,File,Blob,URL,history:{replaceState(){}},clearTimeout,setTimeout});events.get('DOMContentLoaded')();
  const photo=(id='a')=>({id,kind:'photo',mime:'image/jpeg',src:'/media/'+id,name:'Family photo',filename:'memory.jpg',tags:[]});
  return {window,nodes,get,navigator,shared,copied,requests,pending,open(id='a'){window.FamilyMedia.open([photo(id)],0,'gallery');},close(){get('mediaViewer').close();},click(){return get('shareMediaInstagram').handlers.get('click')({preventDefault(){}});}};
}
test('Instagram shares an actual file through the native sheet and reuses the prepared file only for its own photo',async()=>{
  const f=fixture();f.open('a');await f.click();assert.equal(f.shared.length,1);assert.equal(f.shared[0].files.length,1);assert.equal(await f.shared[0].files[0].text(),'picture');assert.equal(f.shared[0].files[0].type,'image/jpeg');assert.equal(f.shared[0].url,undefined);assert.equal(f.requests[0].path,'/media/a');assert.equal(f.requests[0].options.cache,'force-cache');assert.equal(f.get('shareMediaInstagram').disabled,false);
  await f.click();assert.equal(f.requests.length,1);f.open('b');await f.click();assert.equal(f.requests.length,2);assert.equal(f.requests[1].path,'/media/b');
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
