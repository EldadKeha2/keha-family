import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../public/assets/home.js',import.meta.url),'utf8');
const swipeSource=await readFile(new URL('../public/assets/photo-swipe.js',import.meta.url),'utf8');
const photos=['a','b','c'].map(id=>({id,src:'/'+id+'.jpg',name:id,caption:'Caption '+id,kind:'photo'}));
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture({items=photos,reduced=false,carousel=false,width=1120,height=190,desktop=true,swipe=false}={}){
 const nodes=[],images=[],timers=new Map(),opened=[];let now=0,sequence=0;
 class Node extends EventTarget{
  constructor(){super();nodes.push(this);this.children=[];this.parent=null;this.id='';this.hidden=false;this.className='';this.textContent='';this.attrs={};this.dataset={};this.style={setProperty(name,value){this[name]=value;}};}
  get classList(){return {add:(...names)=>this.className=[...new Set([...this.className.split(' ').filter(Boolean),...names])].join(' '),remove:(...names)=>this.className=this.className.split(' ').filter(n=>!names.includes(n)).join(' '),contains:name=>this.className.split(' ').includes(name)};}
  append(...children){for(const node of children){node.remove();node.removed=false;node.parent=this;this.children.push(node);if(node.classList.contains('home-slide-incoming'))setTimer(()=>{const event=new Event('animationend');Object.defineProperty(event,'animationName',{value:'homePhotoIn'});node.dispatchEvent(event);},650);}}
  getBoundingClientRect(){return {width,height};}
  get clientWidth(){return width;}
  closest(){return null;}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);this.parent=null;this.removed=true;}
  removeAttribute(name){if(name==='id')this.id='';else delete this.attrs[name];}
  setAttribute(name,value){this.attrs[name]=String(value);}
  querySelectorAll(selector){return this.children.filter(n=>n.classList.contains(selector.slice(1)));}
  click(){this.dispatchEvent(new Event('click'));}
  close(){this.open=false;this.dispatchEvent(new Event('close'));}
 }
 class Photo extends Node{
  constructor(){super();images.push(this);this.naturalWidth=0;this.naturalHeight=0;}
  async decode(){}
  resolve(w=1000,h=800){this.naturalWidth=w;this.naturalHeight=h;this.onload?.();}
  fail(){this.onerror?.();}
 }
 const ids=['homeView','homeSlideImage','homeSlidePlaceholder','homeSlideCaption','homeSlideCounter','homeSlideOpen','homeSlidePrevious','homeSlideNext','homeSlidePause','homeTiles','mobileMenuTiles','mobileMenuToggle','mobileNavDialog','closeMobileMenu','mediaViewer'];
 for(const id of ids){const n=new Node();n.id=id;}
 const get=id=>nodes.findLast(n=>n.id===id&&!n.removed);get('homeSlideOpen').append(get('homeSlideImage'));get('homeSlideImage').hidden=true;get('homeSlideCaption').hidden=true;
 if(carousel){for(const id of ['homeSlideStage','homeCarouselRail']){const node=new Node();node.id=id;}get('homeSlideStage').append(get('homeSlideOpen'),get('homeCarouselRail'));}
 const document=new EventTarget();document.getElementById=get;document.createElement=()=>new Node();document.visibilityState='visible';
 const window=new EventTarget(),motion=new EventTarget(),desktopQuery=new EventTarget();motion.matches=reduced;desktopQuery.matches=desktop;
 window.FamilyApp={getView:()=> 'home'};
 window.FamilyI18n={t:String,isEnglish:false,mediaName:item=>item.name,fetch:async()=>Response.json({items})};
 window.FamilyMedia={register(){},open:(list,index,scope)=>{opened.push({id:list[index].id,scope});get('mediaViewer').open=true;}};
 const setTimer=(fn,delay)=>{const id=++sequence;timers.set(id,{fn,time:now+delay});return id;};
 class Clock extends Date{static now(){return now;}}
 const context=vm.createContext({window,document,navigator:{userAgent:desktop?'Windows NT':'Android Mobile',userAgentData:{mobile:!desktop}},Image:Photo,matchMedia:query=>query.includes('min-width')?desktopQuery:motion,Date:Clock,setTimeout:setTimer,clearTimeout:id=>timers.delete(id)});
 if(swipe)vm.runInContext(swipeSource,context);vm.runInContext(source,context);
 document.dispatchEvent(new Event('DOMContentLoaded'));
 return {window,document,get,images,opened,motion,
  async resize(w,h,isDesktop=true){width=w;height=h;desktopQuery.matches=isDesktop;window.dispatchEvent(new Event('resize'));await tick();},
  async update(list){const event=new Event('family-media-changed');Object.defineProperty(event,'detail',{value:{scope:'photos',collection:{items:list}}});window.dispatchEvent(event);await tick();},
  async ready(){await tick();},
  async resolve(src,w=1000,h=800){const image=images.findLast(i=>i.src===src&&!i.naturalWidth);assert.ok(image,'A requested/preloaded image exists: '+src);image.resolve(w,h);await tick();},
  async advance(ms){const end=now+ms;for(let guard=0;guard<1000;guard++){const entry=[...timers].filter(([,t])=>t.time<=end).sort((a,b)=>a[1].time-b[1].time)[0];if(!entry)break;now=entry[1].time;timers.delete(entry[0]);entry[1].fn();await tick();}now=end;await tick();},
  async next(){get('homeSlideNext').click();await tick();},async previous(){get('homeSlidePrevious').click();await tick();},
  async visibility(value){document.visibilityState=value;document.dispatchEvent(new Event('visibilitychange'));await tick();},
  async reduced(value){motion.matches=value;motion.dispatchEvent(new Event('change'));await tick();}
 };
}

test('a slow new photo never receives its caption over the preceding photo; the caption waits until after entry',async()=>{
 const f=fixture();await f.ready();await f.resolve('/a.jpg');assert.equal(f.get('homeSlideImage').src,'/a.jpg');assert.equal(f.get('homeSlideCaption').hidden,true);
 await f.advance(1949);assert.equal(f.get('homeSlideCaption').hidden,true);await f.advance(1);assert.equal(f.get('homeSlideCaption').textContent,'Caption a');
 await f.next();await f.advance(6000);assert.equal(f.get('homeSlideImage').src,'/a.jpg');assert.equal(f.get('homeSlideCaption').textContent,'Caption a','B must not be announced while A is still visible');
 await f.resolve('/b.jpg');assert.equal(f.get('homeSlideCaption').hidden,true);assert.equal(f.get('homeSlideImage').src,'/b.jpg');
 await f.advance(1949);assert.equal(f.get('homeSlideCaption').hidden,true);await f.advance(1);assert.equal(f.get('homeSlideCaption').textContent,'Caption b');
});
test('automatic changes are faster than six seconds, preloaded, and pause while the opened photo is being viewed',async()=>{
 const f=fixture();await f.ready();await f.resolve('/a.jpg');await f.advance(650);await f.resolve('/b.jpg');
 await f.advance(3499);assert.equal(f.get('homeSlideImage').src,'/a.jpg');await f.advance(1);assert.equal(f.get('homeSlideImage').src,'/b.jpg');
 f.get('homeSlideOpen').click();assert.deepEqual(f.opened,[{id:'b',scope:'home:photos'}]);await f.advance(10000);assert.equal(f.get('homeSlideImage').src,'/b.jpg');
 f.get('mediaViewer').close();await f.resolve('/c.jpg');await f.advance(3500);assert.equal(f.get('homeSlideImage').src,'/c.jpg');
});
test('rapid browsing discards out-of-order downloads and their captions, and opening still follows the visible image',async()=>{
 const f=fixture();await f.ready();await f.resolve('/a.jpg');await f.advance(1950);await f.next();await f.next();
 f.get('homeSlideOpen').click();assert.equal(f.opened[0].id,'a');f.get('mediaViewer').close();
 await f.resolve('/c.jpg');await f.resolve('/b.jpg');await f.advance(1950);assert.equal(f.get('homeSlideImage').src,'/c.jpg');assert.equal(f.get('homeSlideCaption').textContent,'Caption c');assert.equal(f.get('homeSlideCounter').textContent,'3 / 3');
});
test('leaving the home screen or hiding the tab cancels stale photo/caption work and returning resumes safely',async()=>{
 const f=fixture();await f.ready();await f.resolve('/a.jpg');await f.advance(650);await f.next();f.window.FamilyHome.activate('tree');await f.resolve('/b.jpg');await f.advance(10000);assert.equal(f.get('homeSlideImage').src,'/a.jpg');assert.equal(f.get('homeSlideCaption').hidden,true);
 f.window.FamilyHome.activate('home');await tick();await f.advance(1300);assert.equal(f.get('homeSlideCaption').textContent,'Caption a');
 await f.visibility('hidden');await f.advance(8000);assert.equal(f.get('homeSlideImage').src,'/a.jpg');await f.visibility('visible');await f.advance(3500);assert.equal(f.get('homeSlideImage').src,'/b.jpg');
});
test('reduced motion pauses autoplay and skips animated transitions, while manual browsing and delayed captions still work',async()=>{
 const f=fixture({reduced:true});await f.ready();await f.resolve('/a.jpg');assert.equal(f.get('homeSlideImage').className,'');await f.advance(1300);assert.equal(f.get('homeSlideCaption').textContent,'Caption a');await f.advance(10000);assert.equal(f.get('homeSlideImage').src,'/a.jpg');
 await f.resolve('/b.jpg');await f.next();await f.advance(1299);assert.equal(f.get('homeSlideCaption').hidden,true);await f.advance(1);assert.equal(f.get('homeSlideCaption').textContent,'Caption b');
 await f.reduced(false);f.get('homeSlidePause').click();await f.advance(10000);assert.equal(f.get('homeSlideImage').src,'/b.jpg');
});
test('a failed photo is skipped without displaying its text, and an empty album retains its placeholder',async()=>{
 const f=fixture();await f.ready();await f.resolve('/a.jpg');await f.advance(1950);await f.next();f.images.findLast(i=>i.src==='/b.jpg').fail();await tick();assert.equal(f.get('homeSlideImage').src,'/a.jpg');await f.resolve('/c.jpg');await f.advance(1950);assert.equal(f.get('homeSlideCaption').textContent,'Caption c');
 const empty=fixture({items:[]});await empty.ready();assert.equal(empty.get('homeSlidePlaceholder').hidden,false);assert.equal(empty.get('homeSlideOpen').disabled,true);assert.equal(empty.get('homeSlideCaption').hidden,true);
});
test('the desktop filmstrip fills tall, wide and narrow stages, including panoramas and two-photo albums',async()=>{
 const f=fixture({carousel:true});await f.ready();await f.resolve('/a.jpg');
 assert.equal(f.get('homeSlideStage').dataset.carousel,'true');assert.equal(f.get('homeCarouselRail').hidden,false);assert.equal(f.get('homeSlideOpen').disabled,true);assert.equal(f.get('homeSlideOpen').attrs['aria-hidden'],'true');
 const cards=f.get('homeCarouselRail').children;assert.ok(cards.length>=5);assert.equal(cards.filter(n=>n.dataset.active==='true').length,1);assert.ok(cards.some(n=>parseFloat(n.style['--home-card-x'])<0));assert.ok(cards.some(n=>parseFloat(n.style['--home-card-x'])>0));
 await f.resize(1120,440);assert.equal(f.get('homeSlideStage').dataset.carousel,'true');assert.equal(f.get('homeCarouselRail').hidden,false);
 await f.resize(390,190,false);assert.equal(f.get('homeSlideStage').dataset.carousel,'true','Narrowing a Windows window does not turn the filmstrip off');
 await f.resize(1120,190);assert.equal(f.get('homeSlideStage').dataset.carousel,'true');
 const full=fixture({carousel:true});await full.ready();await full.resolve('/a.jpg',1800,300);assert.equal(full.get('homeSlideStage').dataset.carousel,'true');
 const two=fixture({carousel:true,items:photos.slice(0,2)});await two.ready();await two.resolve('/a.jpg');assert.equal(two.get('homeSlideStage').dataset.carousel,'true');
 const phone=fixture({carousel:true,desktop:false,width:1120,height:440});await phone.ready();await phone.resolve('/a.jpg');assert.equal(phone.get('homeSlideStage').dataset.carousel,'false','A phone retains its slideshow even in landscape');
 const one=fixture({carousel:true,items:photos.slice(0,1)});await one.ready();await one.resolve('/a.jpg');assert.equal(one.get('homeSlideStage').dataset.carousel,'false');
});
test('the film moves continuously, tracks the nearest center between photos and stays bounded over loops',async()=>{
 const f=fixture({carousel:true});await f.ready();await f.resolve('/a.jpg');await f.resolve('/b.jpg');await f.resolve('/c.jpg');await f.advance(650);
 const rail=f.get('homeCarouselRail'),first=rail.children.find(n=>n.dataset.active==='true'),x=()=>parseFloat(first.style['--home-card-x']);const initial=x();await f.advance(200);assert.ok(x()<initial,'Motion continues between image centers');
 await f.advance(3400);assert.equal(f.get('homeSlideImage').src,'/a.jpg','The first image has not yet left the logical anchor');assert.equal(f.window.FamilyHome.centeredPhoto().id,'b','The visible center changes before the next image reaches the anchor');assert.equal(f.get('homeSlideOpen').dataset.photoId,'b');
 await f.advance(5000);assert.equal(f.get('homeSlideImage').src,'/b.jpg');assert.ok(rail.children.length<=24);
 await f.resolve('/a.jpg');await f.advance(24000);assert.ok(rail.children.length<=24,'Wrapping never accumulates an unbounded row of photos');
});
test('film motion pauses on user pause, open photos, hidden tabs and reduced motion, and then resumes',async()=>{
 const f=fixture({carousel:true});await f.ready();await f.resolve('/a.jpg');await f.resolve('/b.jpg');await f.resolve('/c.jpg');await f.advance(650);const rail=f.get('homeCarouselRail'),card=rail.children.find(n=>n.dataset.active==='true'),x=()=>card.style['--home-card-x'];
 f.get('homeSlidePause').click();const paused=x();await f.advance(3000);assert.equal(x(),paused);f.get('homeSlidePause').click();await f.advance(200);assert.notEqual(x(),paused);
 rail.children.find(n=>n.dataset.active==='true').click();const opened=x();await f.advance(3000);assert.equal(x(),opened);f.get('mediaViewer').close();await f.advance(200);assert.notEqual(x(),opened);
 await f.visibility('hidden');const hidden=x();await f.advance(3000);assert.equal(x(),hidden);await f.visibility('visible');await f.advance(200);assert.notEqual(x(),hidden);
 await f.reduced(true);const reduced=x();await f.advance(3000);assert.equal(x(),reduced);await f.reduced(false);await f.advance(200);assert.notEqual(x(),reduced);
});
test('carousel photos and their own captions move together in both directions and the center opens the visible photo',async()=>{
 const f=fixture({carousel:true});await f.ready();await f.resolve('/a.jpg');await f.resolve('/b.jpg');await f.resolve('/c.jpg');await f.advance(650);
 const rail=f.get('homeCarouselRail'),original=rail.children.find(n=>n.dataset.active==='true');assert.equal(original.children[1].textContent,'Caption a');
 await f.next();assert.equal(rail.dataset.animate,'true');assert.ok(parseFloat(original.style['--home-card-x'])<0);let active=rail.children.find(n=>n.dataset.active==='true');assert.equal(active.children[1].textContent,'Caption b');assert.equal(active.children[0].src,'/b.jpg');
 active.click();assert.deepEqual(f.opened,[{id:'b',scope:'home:photos'}]);f.get('mediaViewer').close();await f.previous();await f.resolve('/a.jpg');active=rail.children.find(n=>n.dataset.active==='true');assert.equal(active,original);assert.equal(active.children[1].textContent,'Caption a');assert.equal(parseFloat(active.style['--home-card-x']),0);
});
test('a side preview centers its photo, keeps captions safe, and reduced motion disables animation and autoplay',async()=>{
 const f=fixture({carousel:true,reduced:true,items:photos.map(p=>({...p,caption:p.caption+' <script>'}))});await f.ready();await f.resolve('/a.jpg');await f.resolve('/b.jpg');await f.resolve('/c.jpg');
 const rail=f.get('homeCarouselRail'),right=rail.children.find(n=>parseFloat(n.style['--home-card-x'])>0);right.click();await tick();let active=rail.children.find(n=>n.dataset.active==='true');assert.equal(active.children[1].textContent,'Caption b <script>');assert.equal(rail.dataset.animate,'false');assert.equal(f.get('homeSlidePause').disabled,true);
 await f.advance(10000);assert.equal(f.get('homeSlideImage').src,'/b.jpg');assert.ok(rail.children.filter(n=>n.tabIndex===0).length<=3);
});
test('carousel captions stay attached to the right photo after album edits or reorder, and stale side downloads cannot revive a hidden stage',async()=>{
 const f=fixture({carousel:true});await f.ready();await f.resolve('/a.jpg');await f.resolve('/b.jpg');await f.resolve('/c.jpg');
 const changed=[photos[2],{...photos[0],caption:'Updated a'},photos[1]];await f.update(changed);let active=f.get('homeCarouselRail').children.find(n=>n.dataset.active==='true');assert.equal(active.children[1].textContent,'Updated a');assert.equal(active.children[0].src,'/a.jpg');active.click();assert.equal(f.opened.at(-1).id,'a');
 const late=fixture({carousel:true});await late.ready();await late.resolve('/a.jpg');late.window.FamilyHome.activate('tree');await late.resolve('/b.jpg');assert.ok(late.get('homeCarouselRail').children.filter(n=>n.dataset.active!=='true').every(n=>n.dataset.ready!=='true'));
});
test('the shared gesture handler also browses the running home film with touch and desktop mouse dragging',async()=>{
 for(const pointerType of ['touch','mouse']){
  const f=fixture({carousel:true,swipe:true});await f.ready();await f.resolve('/a.jpg');await f.resolve('/b.jpg');await f.resolve('/c.jpg');
  const pointer=(type,x)=>{const event=new Event(type,{cancelable:true});for(const [key,value]of Object.entries({pointerId:1,pointerType,isPrimary:true,button:0,buttons:1,clientX:x,clientY:100}))Object.defineProperty(event,key,{value});(type==='pointerdown'?f.get('homeSlideStage'):f.document).dispatchEvent(event);};
  pointer('pointerdown',200);pointer('pointermove',340);pointer('pointerup',340);await tick();assert.equal(f.get('homeSlideImage').src,'/b.jpg');
  pointer('pointerdown',340);pointer('pointermove',200);pointer('pointerup',200);await f.resolve('/a.jpg');assert.equal(f.get('homeSlideImage').src,'/a.jpg');f.window.FamilyHome.activate('tree');
 }
});
