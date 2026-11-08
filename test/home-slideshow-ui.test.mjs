import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../public/assets/home.js',import.meta.url),'utf8');
const photos=['a','b','c'].map(id=>({id,src:'/'+id+'.jpg',name:id,caption:'Caption '+id,kind:'photo'}));
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture({items=photos,reduced=false}={}){
 const nodes=[],images=[],timers=new Map(),opened=[];let now=0,sequence=0;
 class Node extends EventTarget{
  constructor(){super();nodes.push(this);this.children=[];this.parent=null;this.id='';this.hidden=false;this.className='';this.textContent='';this.attrs={};this.style={setProperty(){}};}
  get classList(){return {add:(...names)=>this.className=[...new Set([...this.className.split(' ').filter(Boolean),...names])].join(' '),remove:(...names)=>this.className=this.className.split(' ').filter(n=>!names.includes(n)).join(' '),contains:name=>this.className.split(' ').includes(name)};}
  append(node){node.remove();node.removed=false;node.parent=this;this.children.push(node);if(node.classList.contains('home-slide-incoming'))setTimer(()=>{const event=new Event('animationend');Object.defineProperty(event,'animationName',{value:'homePhotoIn'});node.dispatchEvent(event);},650);}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);this.parent=null;this.removed=true;}
  removeAttribute(name){if(name==='id')this.id='';else delete this.attrs[name];}
  setAttribute(name,value){this.attrs[name]=String(value);}
  querySelectorAll(selector){return this.children.filter(n=>n.classList.contains(selector.slice(1)));}
  click(){this.dispatchEvent(new Event('click'));}
  close(){this.open=false;this.dispatchEvent(new Event('close'));}
 }
 class Photo extends Node{
  constructor(){super();images.push(this);this.naturalWidth=0;}
  async decode(){}
  resolve(){this.naturalWidth=1000;this.onload?.();}
  fail(){this.onerror?.();}
 }
 const ids=['homeView','homeSlideImage','homeSlidePlaceholder','homeSlideCaption','homeSlideCounter','homeSlideOpen','homeSlidePrevious','homeSlideNext','homeSlidePause','homeTiles','mobileMenuTiles','mobileMenuToggle','mobileNavDialog','closeMobileMenu','mediaViewer'];
 for(const id of ids){const n=new Node();n.id=id;}
 const get=id=>nodes.findLast(n=>n.id===id&&!n.removed);get('homeSlideOpen').append(get('homeSlideImage'));get('homeSlideImage').hidden=true;get('homeSlideCaption').hidden=true;
 const document=new EventTarget();document.getElementById=get;document.visibilityState='visible';
 const window=new EventTarget(),motion=new EventTarget();motion.matches=reduced;
 window.FamilyApp={getView:()=> 'home'};
 window.FamilyI18n={t:String,isEnglish:false,mediaName:item=>item.name,fetch:async()=>Response.json({items})};
 window.FamilyMedia={register(){},open:(list,index,scope)=>{opened.push({id:list[index].id,scope});get('mediaViewer').open=true;}};
 const setTimer=(fn,delay)=>{const id=++sequence;timers.set(id,{fn,time:now+delay});return id;};
 class Clock extends Date{static now(){return now;}}
 vm.runInNewContext(source,{window,document,Image:Photo,matchMedia:()=>motion,Date:Clock,setTimeout:setTimer,clearTimeout:id=>timers.delete(id)});
 document.dispatchEvent(new Event('DOMContentLoaded'));
 return {window,document,get,images,opened,motion,
  async ready(){await tick();},
  async resolve(src){const image=images.findLast(i=>i.src===src&&!i.naturalWidth);assert.ok(image,'A requested/preloaded image exists: '+src);image.resolve();await tick();},
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
