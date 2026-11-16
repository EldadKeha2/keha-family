import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';
import * as labels from '../public/assets/photo-labels-catalog.mjs';

const source=(await readFile(new URL('../public/assets/media-selection.js',import.meta.url),'utf8')).replace(/^import[^\n]+\n/gm,'');
const tick=async()=>{for(let i=0;i<5;i++)await new Promise(resolve=>setImmediate(resolve));};
function fixture({desktop=true,english=false}={}){
 const {document,window:dom}=parseHTML('<html><body><section><div class="gallery-category-row"><div class="gallery-tag-filters"></div><button class="gallery-refine-toggle">Filter</button></div><div id="photos"></div></section><section><div class="video-filter-toolbar"></div><div id="videos"></div></section></body></html>');
 const handlers=new Map(),timers=new Map(),frames=new Map(),items=new Map(),requests=[],changes=[],downloads=[];let now=10000,sequence=0,opens=0,failId=null;
 const add=(scope,id,kind='photo')=>{
  const item={id,kind,scope,name:'Memory '+id,src:'/media/'+id};items.set(scope+':'+id,item);
  const card=document.createElement('article');card.className='shared-media-card';card.innerHTML=`<button data-media-open="${id}" data-media-scope="${scope}"><img src="/photo"></button>`;document.getElementById(scope==='videos'?'videos':'photos').append(card);return card;
 };
 const a=add('gallery','a'.repeat(32)),b=add('gallery','b'.repeat(32)),video=add('videos','c'.repeat(32),'video');
 const originalAdd=document.addEventListener.bind(document);
 document.addEventListener=(name,fn,options)=>{if(!handlers.has(name))handlers.set(name,[]);handlers.get(name).push(fn);};
 dom.HTMLElement.prototype.showModal=function(){this.setAttribute('open','');};dom.HTMLElement.prototype.close=function(){this.removeAttribute('open');};dom.HTMLElement.prototype.focus=function(){};
 dom.HTMLElement.prototype.submit=function(){downloads.push({action:this.action,ids:JSON.parse(this.querySelector('[name=ids]').value)});};
 const window={FamilyPhotoKeyboard:{desktop:()=>desktop},FamilyI18n:{isEnglish:english,mediaName:item=>item.name,error:String,fetch:async(path,options)=>{
  const body=options?.body&&JSON.parse(options.body);requests.push({path,body});
  if(path.startsWith('api/gallery/selection?'))return Response.json({ids:['a'.repeat(32),'b'.repeat(32),'d'.repeat(32)]});
  const [,id,action]=/^api\/media\/([^/]+)\/(.+)$/.exec(path)||[];
  if(id===failId)return Response.json({error:'Connection failed'},{status:503});
  const item=[...items.values()].find(item=>item.id===id);return Response.json({saved:true,item:{...item,labels:body.label?[body.label]:[]},operation:action==='labels'?'labels':'delete',scope:item?.scope});
 }},FamilyMedia:{lookup:(scope,id)=>items.get(scope+':'+id)},FamilyPortal:{galleryQuery:()=>({query:'',person:'yona',unit:'',labels:'black-and-white',filter:'partial'})},FAMILY_API_TOKEN:'test-token',dispatchEvent:event=>changes.push(event.detail),addEventListener:(name,fn)=>{handlers.set('window:'+name,[fn]);}};
 class Clock extends Date{static now(){return now;}}
 vm.runInNewContext(source,{...labels,loadPhotoLabelCatalog:async()=>{},window,document,Date:Clock,Response,URLSearchParams,CustomEvent,MutationObserver:class{observe(){}},setTimeout(fn,delay){const id=++sequence;timers.set(id,{fn,at:now+delay});return id;},clearTimeout:id=>timers.delete(id),requestAnimationFrame(fn){const id=++sequence;frames.set(id,fn);return id;}});
 const emit=(name,target,extra={})=>{
  const event={target,pointerId:1,button:0,isPrimary:true,clientX:10,clientY:10,preventDefault(){this.defaultPrevented=true;},stopImmediatePropagation(){this.stopped=true;},...extra};
  for(const fn of handlers.get(name)||[]){fn(event);if(event.stopped)break;}
  if(name==='click'&&!event.stopped&&target.closest('[data-media-open]'))opens++;return event;
 };
 const advance=amount=>{now+=amount;for(const [id,timer]of [...timers])if(timer.at<=now){timers.delete(id);timer.fn();}};
 const flush=()=>{for(const [id,fn]of [...frames]){frames.delete(id);fn();}};
 const button=card=>card.querySelector('[data-media-open]');
 const tap=card=>{emit('pointerdown',button(card));advance(80);emit('pointerup',button(card));return emit('click',button(card));};
 const hold=card=>{emit('pointerdown',button(card));advance(650);emit('pointerup',button(card));return emit('click',button(card));};
 const api=window.FamilyMediaSelection;flush();
 const bar=document.querySelector('.media-selection-bar');
 const action=name=>bar.querySelector('[data-selection-'+name+']').click();
 return {api,document,window,a,b,video,bar,requests,changes,downloads,advance,emit,flush,button,tap,hold,action,get opens(){return opens;},set failId(id){failId=id;}};
}
test('a short click opens the photo; one long press selects it and suppresses its opening click',()=>{
 const f=fixture();f.tap(f.a);assert.equal(f.opens,1);assert.deepEqual(Array.from(f.api.ids()),[]);
 f.hold(f.a);assert.equal(f.opens,1);assert.deepEqual(Array.from(f.api.ids()),['a'.repeat(32)]);assert.ok(f.a.classList.contains('is-media-selected'));assert.equal(f.a.querySelector('[data-selection-check]').getAttribute('aria-pressed'),'true');assert.equal(f.bar.hidden,false);
 f.tap(f.b);assert.equal(f.api.ids().length,2);f.tap(f.a);assert.deepEqual(Array.from(f.api.ids()),['b'.repeat(32)]);f.tap(f.b);assert.equal(f.api.ids().length,0);assert.equal(f.b.querySelector('[data-selection-check]').hidden,false,'Selection mode stays open after deselecting its last item');
 f.action('done');assert.equal(f.bar.hidden,true);f.tap(f.a);assert.equal(f.opens,2);
});
test('scrolling, movement, canceled pointers and pinch gestures cancel a pending selection',()=>{
 for(const cancel of [f=>f.emit('pointermove',f.button(f.a),{clientX:40}),f=>f.emit('scroll',f.document),f=>f.emit('pointercancel',f.button(f.a)),f=>f.emit('pointerdown',f.button(f.a),{pointerId:2,isPrimary:false})]){
  const f=fixture();f.emit('pointerdown',f.button(f.a));cancel(f);f.advance(900);assert.equal(f.api.ids().length,0);
 }
});
test('long-press selection works for video grids and never mixes two grids',()=>{
 const f=fixture();f.hold(f.a);f.hold(f.video);assert.deepEqual(Array.from(f.api.ids()),['c'.repeat(32)]);assert.equal(f.a.querySelector('[data-selection-check]').hidden,true);assert.equal(f.video.querySelector('[data-selection-check]').hidden,false);
 f.tap(f.video);assert.equal(f.api.ids().length,0);assert.equal(f.opens,0);
});
test('select all retains the active category and filters, including matching items on later pages',async()=>{
 const f=fixture();f.hold(f.a);f.action('all');await tick();assert.equal(f.api.ids().length,3);
 const url=new URL(f.requests[0].path,'https://family.test/');assert.equal(url.searchParams.get('filter'),'partial');assert.equal(url.searchParams.get('person'),'yona');assert.equal(url.searchParams.get('labels'),'black-and-white');
 f.action('download');assert.equal(f.downloads[0].action,'api/media/download');assert.equal(f.downloads[0].ids.length,3);
});
test('bulk deletion waits for confirmation, uses source scopes and retains failures for retry',async()=>{
 const f=fixture();f.hold(f.a);f.tap(f.b);f.action('delete');assert.equal(f.requests.length,0);
 const dialog=f.document.querySelector('dialog');assert.equal(dialog.hasAttribute('open'),true);dialog.querySelector('[data-selection-cancel]').click();assert.equal(f.requests.length,0);
 f.failId='b'.repeat(32);f.action('delete');dialog.querySelector('[data-selection-confirm]').click();await tick();
 assert.equal(f.requests.length,2);assert.equal(f.requests[0].body.scope,'gallery');assert.deepEqual(Array.from(f.api.ids()),['b'.repeat(32)]);assert.equal(f.changes.length,1);assert.match(f.bar.textContent,/Connection failed/);
 f.failId=null;f.action('delete');dialog.querySelector('[data-selection-confirm]').click();await tick();assert.equal(f.api.ids().length,0);assert.equal(f.changes.length,2);
});
test('a single chosen label is added to every selected video without replacing existing metadata',async()=>{
 const f=fixture();f.hold(f.video);f.action('label');await tick();const dialog=f.document.querySelector('dialog');
 dialog.querySelector('input[name=label]').value='זיכרון משפחתי';dialog.querySelector('form').dispatchEvent(new f.document.defaultView.Event('submit',{bubbles:true,cancelable:true}));await tick();
 assert.equal(f.requests.length,1);assert.match(f.requests[0].path,/\/labels$/);assert.equal(f.requests[0].body.tagged,true);assert.match(f.requests[0].body.label,/^custom:/);assert.equal(f.changes[0].operation,'labels');
});

test('desktop header Select opens the existing actions with no implicit selection and ordinary clicks then toggle cards',()=>{
 for(const english of [false,true]){
  const f=fixture({english}),button=f.document.querySelector('.gallery-category-row [data-selection-start]');
  assert.equal(button.hidden,false);assert.equal(button.getAttribute('aria-pressed'),'false');assert.equal(f.bar.hidden,true);
  button.click();assert.equal(f.bar.hidden,false);assert.equal(button.getAttribute('aria-pressed'),'true');assert.deepEqual(Array.from(f.api.ids()),[]);
  assert.equal(f.bar.querySelector('[data-selection-download]').disabled,true);assert.equal(f.bar.querySelector('[data-selection-all]').disabled,false);
  f.tap(f.a);f.tap(f.b);assert.equal(f.opens,0);assert.equal(f.api.ids().length,2);assert.equal(f.bar.querySelector('[data-selection-download]').disabled,false);
  button.click();assert.equal(f.bar.hidden,true);assert.equal(button.getAttribute('aria-pressed'),'false');f.tap(f.a);assert.equal(f.opens,1);
 }
});
test('desktop selection buttons keep grids separate, use existing filtered Select all and do not duplicate after rendering',async()=>{
 const f=fixture(),gallery=f.document.querySelector('.gallery-category-row [data-selection-start]'),video=f.document.querySelector('.video-filter-toolbar [data-selection-start]');
 gallery.click();f.action('all');await tick();assert.equal(f.api.ids().length,3);assert.match(f.requests[0].path,/filter=partial/);
 video.click();assert.deepEqual(Array.from(f.api.ids()),[]);assert.equal(gallery.getAttribute('aria-pressed'),'false');f.tap(f.video);assert.deepEqual(Array.from(f.api.ids()),['c'.repeat(32)]);
 f.api.refresh();f.flush();f.api.refresh();f.flush();assert.equal(f.document.querySelectorAll('[data-selection-start]').length,2);
 assert.equal(f.document.querySelectorAll('.media-grid-header-actions').length,1);
});
test('phones retain long-press selection without desktop entry buttons',()=>{
 const f=fixture({desktop:false});assert.equal(f.document.querySelector('.gallery-category-row [data-selection-start]').hidden,true);
 f.hold(f.a);assert.equal(f.bar.hidden,false);assert.deepEqual(Array.from(f.api.ids()),['a'.repeat(32)]);
});
test('a mouse hold selects at two seconds before release and its release never opens or deselects the photo',()=>{
 const f=fixture(),target=f.button(f.a);
 f.emit('pointerdown',target,{pointerType:'mouse'});f.advance(1999);
 assert.equal(f.bar.hidden,true);assert.equal(f.api.ids().length,0);f.advance(1);
 assert.equal(f.bar.hidden,false);assert.deepEqual(Array.from(f.api.ids()),['a'.repeat(32)]);assert.equal(f.opens,0);
 f.advance(4000);f.emit('pointerup',target,{pointerType:'mouse'});f.emit('click',target,{pointerType:'mouse'});
 assert.equal(f.opens,0);assert.deepEqual(Array.from(f.api.ids()),['a'.repeat(32)]);
 f.tap(f.b);assert.equal(f.api.ids().length,2);
});
test('a shorter mouse hold opens normally and movement or cancellation cannot start selection later',()=>{
 const f=fixture(),target=f.button(f.a);
 f.emit('pointerdown',target,{pointerType:'mouse'});f.advance(1999);f.emit('pointerup',target,{pointerType:'mouse'});f.emit('click',target,{pointerType:'mouse'});
 assert.equal(f.opens,1);assert.equal(f.bar.hidden,true);f.advance(2000);assert.equal(f.api.ids().length,0);
 for(const action of ['pointermove','pointercancel','scroll']){
  f.emit('pointerdown',target,{pointerType:'mouse'});f.emit(action,target,{pointerType:'mouse',clientX:40});f.advance(2500);
  assert.equal(f.api.ids().length,0);f.emit('pointerup',target,{pointerType:'mouse'});
 }
});
test('dynamic grids get their own top menu and an emptied grid removes its stale entry point',()=>{
 const f=fixture(),section=f.document.createElement('section'),grid=f.document.createElement('div'),card=f.video.cloneNode(true);grid.id='dynamic-video-grid';
 grid.append(card);section.append(grid);f.document.body.append(section);f.api.refresh();f.flush();
 const menu=section.querySelector('.media-grid-selection-menu');assert.ok(menu);menu.querySelector('[data-selection-start]').click();f.tap(card);assert.deepEqual(Array.from(f.api.ids()),['c'.repeat(32)]);
 card.remove();f.api.refresh();f.flush();assert.equal(section.querySelector('[data-selection-start]'),null);
});
