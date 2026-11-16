import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source=(await readFile(new URL('../public/assets/photo-effects.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'');

function fixture({desktop=false}={}){
 const frames=new Map(),events=new Map();let serial=0,notify,reads=0,writes=0;
 const style=()=>new Proxy({},{set(target,key,value){writes++;target[key]=value;return true;}});
 const node=()=>({dataset:{},style:style(),attrs:{},addEventListener(type,fn){events.set(type,fn);},getAttribute(key){return this.attrs[key];},setAttribute(key,value){this.attrs[key]=value;},remove(){if(this.parentNode)this.parentNode.button=null;this.parentNode=null;}});
 const image={complete:true,naturalWidth:200,rect:{left:20,top:30,width:200,height:120},getBoundingClientRect(){reads++;return this.rect;}};
 const stage={button:null,querySelector(selector){return selector==='[data-photo-magic]'?this.button:image;},append(button){button.remove();this.button=button;button.parentNode=this;},getBoundingClientRect(){reads++;return {left:0,top:0,width:400,height:300};}};
 const rail={button:null,firstChild:{id:'personalPhotoReview'},insertBefore(button,before){assert.equal(before,this.firstChild);button.remove();this.button=button;button.parentNode=this;}};
 const viewer={open:true,classList:{contains:()=>desktop},querySelector:()=>rail.button||stage.button,addEventListener(type,fn){events.set(type,fn);}};
 let item={id:'a',kind:'photo'};
 const window={FamilyI18n:{isEnglish:false},FamilyMedia:{current:()=>item,photoState:()=>({busy:false})},addEventListener(type,fn){events.set(type,fn);}};
 const document={readyState:'complete',getElementById:id=>id==='mediaViewer'?viewer:id==='mediaStage'?stage:id==='personalPhotoLeft'&&desktop?rail:null,createElement:node};
 vm.runInNewContext(source,{window,document,LOOKS:[],ART:[],LIGHT:[],FRAMES:[],TUNING:[],requestAnimationFrame:fn=>{const id=++serial;frames.set(id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id),MutationObserver:class{constructor(fn){notify=fn;}observe(){}}});
 return {api:window.FamilyPhotoEffects,frames,events,viewer,stage,rail,image,desktop:value=>desktop=value,notify:()=>notify(),paint(){const batch=[...frames.values()];frames.clear();for(const fn of batch)fn();},setItem:value=>item=value,get reads(){return reads;},get writes(){return writes;}};
}

test('photo mutations, loads and resize bursts share one geometry measurement and avoid unchanged style writes',()=>{
 const f=fixture(),before=f.reads,writes=f.writes;
 for(let i=0;i<100;i++){f.notify();f.events.get('load')();f.events.get('resize')();}
 assert.equal(f.frames.size,1);assert.equal(f.reads,before);f.paint();
 assert.equal(f.reads-before,2,'Only the stage and current image are measured once');assert.equal(f.writes,writes,'Stable wand placement does not write identical CSS again');
});

test('public photo-effect sync stays immediate and cancels obsolete queued placement',()=>{
 const f=fixture();f.notify();f.image.rect={left:60,top:70,width:200,height:120};f.api.sync();
 assert.equal(f.frames.size,0);assert.equal(f.stage.button.style.left,'68px');assert.equal(f.stage.button.style.top,'78px');
 const reads=f.reads;f.paint();assert.equal(f.reads,reads);
 f.notify();f.viewer.open=false;f.paint();assert.equal(f.stage.button,null);assert.equal(f.reads,reads,'Closing before the frame avoids measuring a hidden photo');
 f.viewer.open=true;f.notify();f.setItem({id:'video',kind:'video'});f.paint();assert.equal(f.stage.button,null,'A queued update rechecks the latest media kind');
});

test('desktop wand stays above the left review controls without reading photo geometry across navigation and loading',()=>{
 const f=fixture({desktop:true}),button=f.rail.button;assert.ok(button);assert.equal(f.stage.button,null);assert.equal(f.reads,0);
 f.image.complete=false;f.image.naturalWidth=0;f.setItem({id:'next-photo',kind:'photo'});
 for(let i=0;i<100;i++){f.notify();f.events.get('load')();f.events.get('resize')();}f.paint();
 assert.equal(f.rail.button,button);assert.equal(button.hidden,false);assert.equal(f.reads,0,'Desktop navigation never measures the photo to place the wand');assert.equal(f.writes,0);
 f.desktop(false);f.image.complete=true;f.image.naturalWidth=200;f.api.sync();assert.equal(f.stage.button,button);assert.equal(button.style.left,'28px');assert.equal(button.style.top,'38px');
 const reads=f.reads;f.desktop(true);f.api.sync();assert.equal(f.rail.button,button);assert.equal(f.stage.button,null);assert.equal(button.style.left,'');assert.equal(button.style.top,'');assert.equal(f.reads,reads);
 f.setItem({id:'film',kind:'video'});f.api.sync();assert.equal(f.rail.button,null);f.setItem({id:'photo',kind:'photo'});f.api.sync();f.viewer.open=false;f.api.sync();assert.equal(f.rail.button,null);
});
