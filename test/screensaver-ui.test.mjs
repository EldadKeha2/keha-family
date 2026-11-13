import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import family from '../src/family.mjs';

const source=await readFile(new URL('../public/assets/screensaver.js',import.meta.url),'utf8');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const photo=id=>({id,kind:'photo',src:'/photo/'+id,caption:'Photo '+id,tags:[]});
const result=(ids,pages=1,page=1)=>({ok:true,json:async()=>({items:ids.map(photo),count:ids.length,pagination:{page,pages,total:ids.length}})});
function fixture({read=async()=>result(['one','two']),english=false}={}){
  const nodes=new Map(),requests=[],registrations=[],opens=[],statuses=[];
  class Node extends EventTarget{
    constructor(tag='div'){super();this.tagName=tag;this.children=[];this.attributes={};this.hidden=false;this.disabled=false;this.value='';this.textContent='';this.className='';}
    set innerHTML(value){for(const match of value.matchAll(/<([a-z]+)[^>]*\bid="([^"]+)"/g)){const node=new Node(match[1]);node.id=match[2];nodes.set(node.id,node);this.append(node);}}
    setAttribute(name,value){this.attributes[name]=String(value);}
    getAttribute(name){return name==='src'?this.src??null:this.attributes[name]??null;}
    removeAttribute(name){delete this.attributes[name];if(name==='src')delete this.src;}
    append(...children){for(const node of children){node.remove();node.parent=this;this.children.push(node);}}
    replaceChildren(...children){for(const node of this.children)node.parent=null;this.children=[];this.append(...children);}
    remove(){if(this.parent)this.parent.children=this.parent.children.filter(node=>node!==this);this.parent=null;}
    querySelector(selector){return this.children.find(node=>node.tagName===selector)||this.children.map(node=>node.querySelector(selector)).find(Boolean)||null;}
    click(){if(!this.disabled)this.dispatchEvent(new Event('click'));}
  }
  const host=new Node();host.id='screensaverView';nodes.set(host.id,host);
  const bar=new Node(),mediaState={scope:null,items:[],index:0},options={showNames:false,showAges:false};let active=false,playing=false;
  const window={FAMILY_DATA:family,FamilyI18n:{isEnglish:english,locale:english?'en-US':'he-IL',branchName:b=>english?b.titleEn:b.title,personName:p=>p.name,async fetch(url,options){const query=new URL(url,'https://family.test').searchParams;requests.push({query,options});return read(query,options);}},FamilyApp:{getView:()=> 'screensaver'}};
  window.FamilyMedia={photoState:()=>mediaState,current:()=>mediaState.items[mediaState.index],register(scope,items){registrations.push({scope,items});if(mediaState.scope===scope)mediaState.items=items;},open(items,index,scope){opens.push({items,index,scope});Object.assign(mediaState,{items,index,scope});return true;}};
  window.FamilyPhotoFullscreen={isActive:()=>active,options:()=>options,configure:value=>Object.assign(options,value),enter(){active=true;window.FamilyScreensaver.mountFullscreen(bar);return true;},play(){playing=true;},setAlbumStatus(blocked,message){statuses.push({blocked,message});},exit(){active=false;window.FamilyScreensaver.fullscreenClosed();}};
  const document={readyState:'complete',getElementById:id=>nodes.get(id)||null,createElement:tag=>new Node(tag)};
  vm.runInNewContext(source,{window,document,location:{hash:'#screensaver'},AbortController,URLSearchParams});
  const select=()=>nodes.get('screensaverFamily').querySelector('select');
  return {window,nodes,bar,requests,registrations,opens,statuses,mediaState,playing:()=>playing,select,choose(value,control=select()){control.value=value;control.dispatchEvent(new Event('change'));},start:()=>nodes.get('screensaverStart').click(),fullSelect:()=>bar.querySelector('select')};
}
test('the dedicated page offers exactly all plus the six branches in both languages and starts its own looping album',async()=>{
  for(const english of [false,true]){
    const f=fixture({english});await flush();
    assert.deepEqual(f.select().children.map(node=>node.value),['all',...family.branches.map(branch=>branch.id)]);
    assert.equal(f.requests[0].query.get('unit'),'');assert.equal(f.requests[0].query.get('size'),'500');
    for(const branch of family.branches){f.choose(branch.id);await flush();assert.equal(f.requests.at(-1).query.get('unit'),branch.unit);}
    f.start();assert.equal(f.opens.at(-1).scope,'screensaver');assert.equal(f.playing(),true);assert.equal(f.fullSelect().value,family.branches.at(-1).id);
    assert.ok(f.registrations.every(album=>album.scope==='screensaver'),'Gallery and personal albums keep their original content');
    f.window.FamilyPhotoFullscreen.exit();assert.equal(f.fullSelect(),null);
    f.mediaState.scope='personal:yona';f.window.FamilyScreensaver.mountFullscreen(f.bar);assert.equal(f.fullSelect(),null,'Other fullscreen views have no family selector');
  }
});
test('every matching gallery page is loaded, with a stable random seed and no repeated photos between pages',async()=>{
  const f=fixture({read:async query=>query.get('page')==='1'?result(['one','two'],2,1):result(['two','three'],2,2)});await flush();
  assert.deepEqual(f.requests.map(r=>r.query.get('page')),['1','2']);assert.equal(f.requests[0].query.get('seed'),f.requests[1].query.get('seed'));
  f.start();assert.deepEqual(Array.from(f.opens.at(-1).items,item=>item.id),['one','two','three']);
});
test('a fast branch change discards late photos from previous branches, even if their requests ignore cancellation',async()=>{
  const pending=[],f=fixture({read:()=>new Promise(resolve=>pending.push(resolve))});
  f.choose('harizi');f.choose('becker');assert.equal(f.nodes.get('screensaverStart').disabled,true);assert.equal(f.requests[0].options.signal.aborted,true);
  pending[2](result(['becker']));await flush();pending[1](result(['harizi']));pending[0](result(['all']));await flush();
  f.start();assert.deepEqual(Array.from(f.opens.at(-1).items,item=>item.id),['becker']);assert.equal(f.fullSelect().value,'becker');
});
test('empty branches hold the running screen without falling back to other families, and selecting a populated branch resumes it',async()=>{
  const f=fixture({read:async query=>query.get('unit')==='u-becker'?result([]):result(['family-photo','another'])});await flush();f.start();
  f.choose('becker',f.fullSelect());assert.equal(f.statuses.at(-1).blocked,true);await flush();
  assert.equal(f.statuses.at(-1).blocked,true);assert.equal(f.opens.length,1);assert.equal(f.nodes.get('screensaverStart').disabled,true);
  f.choose('harizi',f.fullSelect());await flush();assert.equal(f.statuses.at(-1).blocked,false);assert.equal(f.opens.length,2);assert.equal(f.playing(),true);
});
test('a failed load can be retried and a response arriving after exit cannot replace another open album',async()=>{
  let resolve,read=0;const f=fixture({read:async()=>++read===1?{ok:false}:read===2?result(['recovered','two']):new Promise(done=>resolve=done)});
  await flush();assert.equal(f.nodes.get('screensaverRetry').hidden,false);assert.equal(f.nodes.get('screensaverStart').disabled,true);
  f.nodes.get('screensaverRetry').click();await flush();f.start();f.choose('fish',f.fullSelect());
  f.window.FamilyPhotoFullscreen.exit();f.window.FamilyMedia.open([photo('personal')],0,'personal:yona');resolve(result(['fish']));await flush();
  assert.equal(f.mediaState.scope,'personal:yona');assert.equal(f.window.FamilyMedia.current().id,'personal');
});
