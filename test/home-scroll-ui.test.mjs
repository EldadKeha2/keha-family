import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../public/assets/home-scroll.js',import.meta.url),'utf8');
const plain=value=>JSON.parse(JSON.stringify(value));

// Model layout measurements and the animation frame queue, leaving actual pill
// position, safe-area spacing and touch target appearance to phone browser QA.
function fixture({mobile=true,view='home',markerTop=1800,height=800,english=false,reducedMotion=false,appReducedMotion=null}={}){
  const nodes=new Map(),scrolls=[],observers=[],frames=new Map(),listenerOptions=[];let nextFrame=1,reads=0,dialogOpen=false;
  class Element extends EventTarget{
    constructor(){super();this.hidden=false;this.dataset={};this.attrs=new Map();this.textContent='';this.innerHTML='';}
    setAttribute(name,value){this.attrs.set(name,String(value));}
    getAttribute(name){return this.attrs.get(name)??null;}
    removeAttribute(name){this.attrs.delete(name);}
    getBoundingClientRect(){reads++;return {top:markerTop,bottom:markerTop+1,left:0,right:320,height:1,width:320};}
    contains(){return false;}
  }
  for(const id of ['homeView','homeScrollEnd','homeMoreHint','homeTiles'])nodes.set(id,new Element());
  const document=new EventTarget();document.readyState='complete';document.visibilityState='visible';document.documentElement=new Element();document.documentElement.clientHeight=height;
  document.body=new Element();document.body.dataset.activeView=view;nodes.get('homeView').hidden=view!=='home';
  document.getElementById=id=>nodes.get(id)||null;document.querySelector=selector=>selector==='dialog[open]'?(dialogOpen?new Element():null):selector.startsWith('#')?nodes.get(selector.slice(1))||null:null;
  const window=new EventTarget(),nativeAdd=window.addEventListener.bind(window);
  window.addEventListener=(type,listener,options)=>{listenerOptions.push({type,options});return nativeAdd(type,listener,options);};
  window.FamilyI18n={isEnglish:english};window.innerHeight=height;window.scrollBy=options=>scrolls.push(options);
  if(appReducedMotion!==null)window.FamilyAccessibility={isReducedMotion:()=>appReducedMotion};
  const viewport=new EventTarget();viewport.height=height;viewport.offsetTop=0;window.visualViewport=viewport;
  const queries=new Map();
  const matchMedia=query=>{if(!queries.has(query)){const media=new EventTarget();media.matches=query.includes('reduced-motion')?reducedMotion:mobile;queries.set(query,media);}return queries.get(query);};
  const requestAnimationFrame=callback=>{const id=nextFrame++;frames.set(id,callback);return id;};
  const cancelAnimationFrame=id=>frames.delete(id);
  class MutationObserver{
    constructor(callback){this.callback=callback;this.targets=[];observers.push(this);}
    observe(target,options){this.targets.push({target,options});}
    disconnect(){this.targets=[];}
  }
  const context=vm.createContext({window,document,matchMedia,MutationObserver,requestAnimationFrame,cancelAnimationFrame,innerHeight:height,Event,console});
  vm.runInContext(source,context);document.dispatchEvent(new Event('DOMContentLoaded'));
  const flush=()=>{const queued=[...frames.values()];frames.clear();for(const callback of queued)callback();};flush();
  const hint=nodes.get('homeMoreHint');
  return {window,document,nodes,hint,scrolls,queries,observers,frames,listenerOptions,flush,get reads(){return reads;},
    position(top){markerTop=top;},
    scroll(){window.dispatchEvent(new Event('scroll'));},
    click(){hint.dispatchEvent(new Event('click'));},
    mobile(value){const media=matchMedia('(max-width: 700px)');media.matches=value;media.dispatchEvent(new Event('change'));flush();},
    motion(value){const media=matchMedia('(prefers-reduced-motion: reduce)');media.matches=value;media.dispatchEvent(new Event('change'));},
    view(value){document.body.dataset.activeView=value;nodes.get('homeView').hidden=value!=='home';for(const observer of observers)observer.callback([]);flush();},
    modal(value){dialogOpen=value;for(const observer of observers)observer.callback([]);flush();},
    visible(value){document.visibilityState=value?'visible':'hidden';document.dispatchEvent(new Event('visibilitychange'));flush();},
    mutate(){for(const observer of observers)observer.callback([]);flush();}
  };
}

test('more-pages hint appears only on the phone homepage while remaining tiles are below the viewport',()=>{
  const f=fixture();assert.equal(f.hint.hidden,false);
  f.mobile(false);assert.equal(f.hint.hidden,true);f.mobile(true);assert.equal(f.hint.hidden,false);
  f.view('games');assert.equal(f.hint.hidden,true);f.view('home');assert.equal(f.hint.hidden,false);
  assert.equal(fixture({mobile:false}).hint.hidden,true);assert.equal(fixture({view:'tree'}).hint.hidden,true);
  assert.equal(fixture({markerTop:650}).hint.hidden,true);
});

test('scrolling to the last homepage tile hides the hint, and scrolling back reveals it again',()=>{
  const f=fixture();f.position(600);f.scroll();f.flush();assert.equal(f.hint.hidden,true);
  f.position(1600);f.scroll();f.flush();assert.equal(f.hint.hidden,false);
});

test('a hint tap moves down most of a screen and honors reduced motion',()=>{
  const f=fixture();f.click();assert.equal(f.scrolls.length,1);assert.deepEqual(plain(f.scrolls[0]),{top:520,behavior:'smooth'});
  f.motion(true);f.click();assert.deepEqual(plain(f.scrolls[1]),{top:520,behavior:'instant'});
  const accessible=fixture({appReducedMotion:true});accessible.click();assert.equal(accessible.scrolls[0].behavior,'instant');
});

test('English hint is localized while Hebrew remains the default',()=>{
  const he=fixture(),en=fixture({english:true});
  assert.match(he.hint.innerHTML+he.hint.textContent,/יש עוד עמודים למטה/);
  assert.match(en.hint.innerHTML+en.hint.textContent,/More pages below/);assert.doesNotMatch(en.hint.innerHTML+en.hint.textContent,/[\u0590-\u05ff]/);
});

test('passive scrolling batches measurements within a frame and responds to asynchronous homepage changes',()=>{
  const f=fixture(),before=f.reads;f.scroll();f.scroll();f.scroll();assert.equal(f.reads,before);f.flush();assert.equal(f.reads,before+1);
  assert.ok(f.listenerOptions.some(item=>item.type==='scroll'&&item.options?.passive===true));
  f.position(500);f.mutate();assert.equal(f.hint.hidden,true);f.position(1500);f.mutate();assert.equal(f.hint.hidden,false);
});


test('an open dialog or background tab suppresses the hint until the homepage is available again',()=>{
  const f=fixture();f.modal(true);assert.equal(f.hint.hidden,true);f.modal(false);assert.equal(f.hint.hidden,false);
  f.visible(false);assert.equal(f.hint.hidden,true);f.visible(true);assert.equal(f.hint.hidden,false);
});
