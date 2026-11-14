import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../public/assets/video-presentation.js',import.meta.url),'utf8');
function fixture({native=false,rejected=false}={}){
 const listeners=new Map(),steps=[],edits=[],nodes=new Map();let document,api,index=0;
 class Node{
  constructor(tag='div'){this.tagName=tag;this.children=[];this.parentNode=null;this.dataset={};this.handlers=new Map();this.classes=new Set();this.hidden=false;this.classList={add:x=>this.classes.add(x),remove:x=>this.classes.delete(x),toggle:(x,on)=>on?this.classes.add(x):this.classes.delete(x),contains:x=>this.classes.has(x)};}
  append(...values){for(const child of values){child.remove();child.parentNode=this;this.children.push(child);}}prepend(child){child.remove();child.parentNode=this;this.children.unshift(child);}before(child){child.remove();const p=this.parentNode;child.parentNode=p;p.children.splice(p.children.indexOf(this),0,child);}remove(){if(this.parentNode)this.parentNode.children.splice(this.parentNode.children.indexOf(this),1);this.parentNode=null;}
  setAttribute(k,v){this[k]=v;}focus(){document.activeElement=this;}addEventListener(type,fn){const all=this.handlers.get(type)||[];all.push(fn);this.handlers.set(type,all);}
  closest(selector){const data=/^\[data-([^\]]+)\]$/.exec(selector);return data&&Object.hasOwn(this.dataset,data[1].replace(/-([a-z])/g,(_,c)=>c.toUpperCase()))?this:this.parentNode?.closest(selector)||null;}
  querySelector(selector){return this.children.find(n=>selector.startsWith('.')?n.classes.has(selector.slice(1)):selector==='[data-video-fullscreen]'&&n.dataset.videoFullscreen)||null;}
  set innerHTML(html){this.children=[];this.insertAdjacentHTML('beforeend',html);}insertAdjacentHTML(_,html){for(const m of html.matchAll(/<(button|div)\b([^>]*)>/g)){const node=new Node(m[1]);for(const [,key,value]of m[2].matchAll(/([\w-]+)="([^"]*)"/g)){if(key==='class')value.split(' ').forEach(c=>node.classes.add(c));if(key.startsWith('data-'))node.dataset[key.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=value;}this.append(node);}}
 }
 const get=id=>{if(!nodes.has(id)){const n=new Node();n.id=id;nodes.set(id,n);}return nodes.get(id);};
 const emit=(target,type)=>{const event={target,preventDefault(){this.defaultPrevented=true;},stopImmediatePropagation(){this.stopped=true;}};for(const {fn,capture}of listeners.get(type)||[])if(capture)fn(event);if(!event.stopped){for(const fn of target.handlers?.get(type)||[])fn(event);for(const {fn,capture}of listeners.get(type)||[])if(!capture)fn(event);}return event;};
 document={fullscreenElement:null,getElementById:get,createComment:()=>new Node('comment'),createElement:tag=>{const n=new Node(tag);if(native)n.requestFullscreen=()=>{if(rejected)return Promise.reject(Error('Not supported'));document.fullscreenElement=n;emit(document,'fullscreenchange');return Promise.resolve();};return n;},addEventListener(type,fn,capture=false){const all=listeners.get(type)||[];all.push({fn,capture});listeners.set(type,all);},exitFullscreen(){document.fullscreenElement=null;emit(document,'fullscreenchange');return Promise.resolve();}};
 const viewer=get('mediaViewer'),stage=get('mediaStage');viewer.open=true;viewer.append(stage);stage.append(new Node('video'));
 const items=[{id:'a',kind:'video',name:'12345.mp4'},{id:'b',kind:'video',name:'second.mp4'}];
 const window={FamilyI18n:{isEnglish:false},FamilyVideoEditor:{controls:item=>`<button class="video-edit-button" data-video-edit="${item.id}"></button>`,open:(item,scope)=>edits.push([item.id,scope])},FamilyMedia:{current:()=>items[index],isOpen:()=>viewer.open,openFrom:()=>{viewer.open=true;return true;},step:direction=>{steps.push(direction);index=(index+direction+items.length)%items.length;api.present(items[index],'videos');}}};
 vm.runInNewContext(source,{window,document});api=window.FamilyVideoPresentation;api.present(items[0],'videos');
 return{api,viewer,stage,document,items,steps,edits,get,emit,flush:()=>new Promise(resolve=>setImmediate(resolve))};
}
test('video fullscreen keeps the existing player and restores its gallery position when browser fullscreen is unavailable',async()=>{
 for(const options of [{},{native:true,rejected:true},{native:true}]){
  const f=fixture(options),player=f.stage.children[0];assert.equal(f.api.enter(),true);await f.flush();assert.equal(f.api.isActive(),true);assert.equal(f.stage.parentNode.id,'videoFullscreenRoot');assert.equal(f.stage.children[0],player);
  assert.equal(f.api.exit(),true);await f.flush();assert.equal(f.api.isActive(),false);assert.equal(f.stage.parentNode,f.viewer);assert.equal(f.stage.children[0],player);assert.equal(f.document.fullscreenElement,null);
 }
});
test('fullscreen navigation changes the video in the current gallery and Escape returns to that gallery',()=>{
 const f=fixture();f.api.enter();const root=f.stage.parentNode;f.emit(root.querySelector('.video-fullscreen-next'),'click');assert.deepEqual(f.steps,[1]);assert.equal(f.api.isActive(),true);assert.equal(f.stage.parentNode,root);
 const event=f.emit(f.viewer,'cancel');assert.equal(event.defaultPrevented,true);assert.equal(f.api.isActive(),false);assert.equal(f.viewer.open,true);assert.equal(f.stage.parentNode,f.viewer);
});
test('editing from native fullscreen exits it before opening the same video editor',async()=>{
 const f=fixture({native:true});f.api.enter();await f.flush();const button={dataset:{videoScope:'videos'},closest:selector=>selector==='[data-video-edit]'?button:null};f.emit(button,'click');assert.deepEqual(f.edits,[['a','videos']]);assert.equal(f.api.isActive(),false);assert.equal(f.stage.parentNode,f.viewer);
});
test('event video tiles open their own gallery and fullscreen, show descriptions, and omit filenames',()=>{
 const f=fixture(),markup=f.api.tile({id:'event-film',file:'event-film.mp4',filename:'camera-original.mp4',src:'/media/event-film',mime:'video/mp4',caption:'Dancing together',duration:288},'nostalgia');
 assert.match(markup,/data-media-scope="nostalgia"/);assert.match(markup,/data-video-scope="nostalgia"/);
 assert.match(markup,/data-video-fullscreen="event-film"/);assert.match(markup,/data-video-edit="event-film"/);
 assert.match(markup,/Dancing together/);assert.match(markup,/4:48/);assert.doesNotMatch(markup,/camera-original|data-archive-upload/);
});
