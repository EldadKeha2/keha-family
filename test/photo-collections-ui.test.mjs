import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../public/assets/photo-collections.js',import.meta.url),'utf8');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(english=false){
 const document=new EventTarget(),window=new EventTarget(),groups=[],requests=[],messages=[];
 document.querySelectorAll=()=>groups;
 window.FAMILY_DATA={people:{tomer:{id:'tomer'},shani:{id:'shani'},extra:{id:'extra',extra:true}},units:{pair:{id:'u-tomer',people:['tomer','shani']}}};
 window.FamilyApp={apiEnabled:true,getPerson:id=>window.FAMILY_DATA.people[id],toast:message=>messages.push(message)};
 window.FAMILY_API_TOKEN='test-csrf';
 window.FamilyI18n={isEnglish:english,error:value=>value,fetch:(path,options)=>new Promise(resolve=>requests.push({path,options,resolve}))};
 vm.runInNewContext(source,{window,document,CustomEvent,Map,Set,String,Object,JSON});
 const item=(id='one',collections=['gallery'])=>({id,kind:'photo',scope:'gallery',collections});
 const group=(photo=item(),scope='personal:tomer',viewer=false)=>{const node={dataset:{collectionPhoto:photo.id,collectionScope:scope,...(viewer?{collectionViewer:'true'}:{})},innerHTML:window.FamilyPhotoCollections.controls(photo,scope,{viewer})};groups.push(node);return node;};
 const button=(node,collection,pressed=false)=>({dataset:{photoCollection:collection},disabled:false,closest:()=>node,attributes:new Map([['aria-pressed',String(pressed)]]),getAttribute(key){return this.attributes.get(key);},setAttribute(key,value){this.attributes.set(key,value);},removeAttribute(key){this.attributes.delete(key);}});
 const click=target=>{const event=new Event('click');Object.defineProperty(event,'target',{value:{closest:()=>target}});document.dispatchEvent(event);};
 const respond=async(index,photo,ok=true)=>{const body=JSON.parse(requests[index].options.body);requests[index].resolve({ok,json:async()=>ok?{operation:'collection',scope:body.collection,included:body.included??true,item:photo}:{error:'Connection lost'}});await flush();};
 const selected=(node,collection)=>new RegExp('data-photo-collection="'+collection+'"[^>]*aria-pressed="true"').test(node.innerHTML);
 return {window,document,groups,requests,messages,item,group,button,click,respond,selected};
}
test('viewers offer Family photos in both languages while profile thumbnails retain their baby and wedding shortcuts',()=>{
 for(const english of [false,true]){
  const f=fixture(english),profile=f.group(f.item('one',['gallery','photos','nursery:tomer']));
  assert.equal((profile.innerHTML.match(/data-photo-collection=/g)||[]).length,2);
  assert.doesNotMatch(profile.innerHTML,/data-photo-collection="photos"/);assert.equal(f.selected(profile,'nursery:tomer'),true);assert.equal(f.selected(profile,'wedding:u-tomer'),false);
  for(const scope of ['gallery','photos','link:gallery','link:photos','link:personal:tomer'])assert.equal(f.window.FamilyPhotoCollections.controls(f.item(),scope),'',scope);
  for(const scope of ['gallery','photos','link:gallery','link:photos','link:personal:tomer']){
   const viewer=f.group(f.item(),scope,true);assert.match(viewer.innerHTML,/data-photo-collection="photos"/);assert.equal(f.selected(viewer,'photos'),true);
   assert.match(viewer.innerHTML,english?/Remove from Family photos/:/הסרה מתמונות משפחתיות/);
  }
  const unavailable=f.group(f.item(),'personal:extra');assert.equal((unavailable.innerHTML.match(/disabled/g)||[]).length,2);
  assert.equal(f.window.FamilyPhotoCollections.controls({...f.item(),kind:'video'},'personal:tomer'),'');
 }
});
test('the family button adds and removes the exact photo immediately and a stale card cannot restore a removed selection',async()=>{
 const f=fixture(),g=f.group(f.item(),'gallery',true);assert.equal(f.selected(g,'photos'),false);
 let b=f.button(g,'photos');f.click(b);f.click(b);assert.equal(f.requests.length,1);assert.deepEqual(JSON.parse(f.requests[0].options.body),{collection:'photos',scope:'gallery',included:true});
 await f.respond(0,f.item('one',['gallery','photos']));assert.equal(f.selected(g,'photos'),true);
 b=f.button(g,'photos',true);f.click(b);assert.deepEqual(JSON.parse(f.requests[1].options.body),{collection:'photos',scope:'gallery',included:false});
 await f.respond(1,f.item());assert.equal(f.selected(g,'photos'),false);
 const stale=f.group(f.item('one',['gallery','photos']),'gallery',true);assert.equal(f.selected(stale,'photos'),false);
 f.click(f.button(g,'photos'));await f.respond(2,f.item('one',['gallery','photos']));assert.equal(f.selected(g,'photos'),true);
});
test('a failed removal retains the green selection, and another album response cannot re-add a removed family selection',async()=>{
 const f=fixture(),g=f.group(f.item('one',['gallery','photos']),'personal:tomer',true),b=f.button(g,'photos',true);
 f.click(b);await f.respond(0,null,false);assert.equal(f.selected(g,'photos'),true);assert.equal(b.disabled,false);
 f.click(f.button(g,'nursery:tomer'));f.click(f.button(g,'photos',true));
 await f.respond(2,f.item('one',['gallery','nursery:tomer']));await f.respond(1,f.item('one',['gallery','photos','nursery:tomer']));
 assert.equal(f.selected(g,'photos'),false);assert.equal(f.selected(g,'nursery:tomer'),true);
});
test('one tap saves the exact photo and owner, blocks repeated taps and keeps concurrent successful selections even if responses arrive out of order',async()=>{
 const f=fixture(),g=f.group(),baby=f.button(g,'nursery:tomer'),wedding=f.button(g,'wedding:u-tomer');
 f.click(baby);f.click(baby);assert.equal(f.requests.length,1);assert.equal(baby.disabled,true);
 assert.equal(f.requests[0].path,'api/media/one/collections');assert.equal(f.requests[0].options.headers['X-Family-Token'],'test-csrf');
 assert.deepEqual(JSON.parse(f.requests[0].options.body),{collection:'nursery:tomer',scope:'personal:tomer'});
 f.click(wedding);assert.equal(f.requests.length,2);
 await f.respond(1,f.item('one',['gallery','nursery:tomer','wedding:u-tomer']));
 await f.respond(0,f.item('one',['gallery','nursery:tomer']));
 assert.equal(f.selected(g,'nursery:tomer'),true);assert.equal(f.selected(g,'wedding:u-tomer'),true);
 assert.equal(f.selected({innerHTML:f.window.FamilyPhotoCollections.controls(f.item(),'personal:tomer')},'wedding:u-tomer'),true);
});
test('a failed album save leaves the icon unmarked and ready to retry',async()=>{
 const f=fixture(),g=f.group(),b=f.button(g,'wedding:u-tomer');f.click(b);
 await f.respond(0,null,false);assert.equal(f.selected(g,'wedding:u-tomer'),false);assert.equal(b.disabled,false);assert.equal(f.messages.at(-1),'Connection lost');
 f.click(b);assert.equal(f.requests.length,2);await f.respond(1,f.item('one',['gallery','wedding:u-tomer']));assert.equal(f.selected(g,'wedding:u-tomer'),true);
});
test('a save finishing after a photo change never marks the next photo',async()=>{
 const f=fixture(),first=f.group(),b=f.button(first,'nursery:tomer');f.click(b);f.groups.length=0;const second=f.group(f.item('two'));
 await f.respond(0,f.item('one',['gallery','nursery:tomer']));assert.equal(f.selected(second,'nursery:tomer'),false);
});
