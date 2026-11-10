import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../public/assets/photo-fullscreen.js',import.meta.url),'utf8');
function fixture({english=false,native=false,rejected=false,viewerOpen=true,loading=false,items=null}={}){
 const frames=[],steps=[],stepOptions=[],nativeCalls=[],handlers=()=>new Map();let document,window,state,viewer,stage;
 const camel=name=>name.replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase());
 class Node{
  constructor(tag='div'){this.tagName=tag;this.nodeType=1;this.children=[];this.parentNode=null;this.dataset={};this.attributes=new Map();this.handlers=handlers();this.className='';this.hidden=false;this.disabled=false;this.textContent='';this.innerHTML='';}
  get isConnected(){return this===document.body||Boolean(this.parentNode?.isConnected);}
  get classList(){const set=new Set(this.className.split(' ').filter(Boolean));return{contains:name=>set.has(name),add:(...names)=>{names.forEach(name=>set.add(name));this.className=[...set].join(' ');},remove:(...names)=>{names.forEach(name=>set.delete(name));this.className=[...set].join(' ');},toggle:(name,on)=>{on=on??!set.has(name);set[on?'add':'delete'](name);this.className=[...set].join(' ');}};}
  setAttribute(key,value){this.attributes.set(key,String(value));}
  getAttribute(key){if(key.startsWith('data-'))return this.dataset[camel(key.slice(5))]??null;return this.attributes.get(key)??(key==='id'?this.id:key==='class'?this.className:null);}
  matches(selector){return selector.split(',').some(selector=>{selector=selector.trim();if(selector.startsWith('#'))return this.id===selector.slice(1);if(selector.startsWith('.'))return this.classList.contains(selector.slice(1));if(selector.startsWith('['))return[...selector.matchAll(/\[([^=\]]+)(?:="([^"]*)")?\]/g)].every(([,key,value])=>{const actual=this.getAttribute(key);return value===undefined?actual!==null:actual===value;});return this.tagName===selector;});}
  querySelectorAll(selector){return this.children.flatMap(child=>[...(child.matches(selector)?[child]:[]),...child.querySelectorAll(selector)]);}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  closest(selector){return this.matches(selector)?this:this.parentNode?.closest(selector)||null;}
  append(...nodes){for(const node of nodes){node.remove();node.parentNode=this;this.children.push(node);}}
  prepend(...nodes){for(const node of [...nodes].reverse()){node.remove();node.parentNode=this;this.children.unshift(node);}}
  before(node){const parent=this.parentNode,index=parent.children.indexOf(this);node.remove();node.parentNode=parent;parent.children.splice(index,0,node);}
  replaceWith(node){this.before(node);this.remove();}
  replaceChildren(...nodes){for(const node of [...this.children])node.remove();this.append(...nodes);}
  remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(child=>child!==this);this.parentNode=null;}
  contains(node){return node===this||this.children.some(child=>child.contains(node));}
  addEventListener(type,fn,options={}){if(!this.handlers.has(type))this.handlers.set(type,[]);this.handlers.get(type).push({fn,capture:options.capture});}
  focus(){document.activeElement=this;}
  click(){if(!this.disabled)emit(this,'click');}
  close(){this.open=false;state.active=false;this.classList.remove('photo-fullscreen');window.FamilyPhotoFullscreen?.closed();}
 }
 document={readyState:'complete',hidden:false,fullscreenElement:null,handlers:handlers(),addEventListener:Node.prototype.addEventListener,createElement:tag=>{const node=new Node(tag);if(native&&tag==='div')node.requestFullscreen=()=>{nativeCalls.push(node);if(rejected)return Promise.reject(Error('Unsupported'));document.fullscreenElement=node;emit(document,'fullscreenchange');return Promise.resolve();};return node;},createComment:()=>{const node=new Node('comment');node.nodeType=8;return node;},getElementById:id=>document.body.id===id?document.body:document.body.querySelector('#'+id),querySelectorAll:selector=>document.body.querySelectorAll(selector),exitFullscreen(){document.fullscreenElement=null;emit(document,'fullscreenchange');return Promise.resolve();}};
 document.body=new Node('body');document.activeElement=document.body;viewer=new Node('dialog');viewer.id='mediaViewer';viewer.open=viewerOpen;stage=new Node();stage.id='mediaStage';viewer.append(stage);document.body.append(viewer);
 window={FamilyI18n:{isEnglish:english},handlers:handlers(),addEventListener:Node.prototype.addEventListener};
 const photo=id=>({id,kind:'photo',src:'/photo/'+id,caption:'Photo '+id}),list=items||[photo('a'),photo('b'),photo('c')];state={items:list,index:0,active:false,busy:false,scope:'gallery'};
 function imageFor(item){const image=new Node('img');image.complete=!loading;image.naturalWidth=loading?0:1600;image.src=image.currentSrc=item.src;image.alt=item.caption||'';image.decode=async()=>{};return image;}
 stage.append(imageFor(list[0]));
 const media={current:()=>state.items[state.index],photoState:()=>({active:state.active,item:media.current(),busy:state.busy,index:state.index,total:state.items.filter(item=>item.kind==='photo').length,scope:state.scope}),lookup:(_,id)=>list.find(item=>item.id===id),open(array,index=0,scope='gallery'){state.items=array;state.index=index;state.scope=scope;viewer.open=true;stage.replaceChildren(imageFor(media.current()));window.FamilyPhotoFullscreen?.sync();return true;},openFrom(scope,id){const index=list.findIndex(item=>item.id===id);if(index<0)return;return media.open(list,index,scope);},setFullscreen(on){state.active=on;viewer.classList.toggle('photo-fullscreen',on);if(on)window.FamilyPhotoFullscreen.present(media.current(),stage.querySelector('img'));else window.FamilyPhotoFullscreen.sync();return true;},step(direction,options={}){steps.push(direction);stepOptions.push(options);state.index=(state.index+direction+state.items.length)%state.items.length;stage.replaceChildren(imageFor(media.current()));window.FamilyPhotoFullscreen.present(media.current(),stage.querySelector('img'));}};window.FamilyMedia=media;
 function emit(target,type,props={}){const event={target,...props,preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.stopped=true;},stopImmediatePropagation(){this.stopped=true;}};const path=[];for(let node=target;node&&node!==document;node=node.parentNode)path.push(node);for(const handler of document.handlers.get(type)||[])if(handler.capture)handler.fn(event);if(!event.stopped){for(const node of path)for(const handler of node.handlers?.get(type)||[])handler.fn(event);for(const handler of document.handlers.get(type)||[])if(!handler.capture)handler.fn(event);}return event;}
 const grid=new Node();document.body.append(grid);const opener=new Node('button');opener.dataset.mediaOpen='b';opener.dataset.mediaScope='gallery';opener.append(imageFor(list[1]||list[0]));grid.append(opener);
 const poster=new Node('button');poster.dataset.mediaOpen='video';poster.dataset.mediaScope='videos';poster.append(new Node('img'));grid.append(poster);
 vm.runInNewContext(source,{window,document,setTimeout,clearTimeout,requestAnimationFrame:fn=>{frames.push(fn);return frames.length;}});
 const api=window.FamilyPhotoFullscreen,find=className=>document.body.querySelector('.'+className);
 return{document,window,media,state,viewer,stage,opener,poster,grid,api,steps,stepOptions,nativeCalls,find,emit,photo,flush:()=>new Promise(resolve=>setImmediate(resolve)),load(){const image=stage.querySelector('img');image.complete=true;image.naturalWidth=1600;emit(image,'load');},redecorate(){for(const {fn}of window.handlers.get('family-media-changed')||[])fn();for(const fn of frames.splice(0))fn();}};
}
test('the viewer enters native fullscreen or the phone fallback and restores its original position on exit',async()=>{
 for(const native of [false,true])for(const rejected of [false,true]){
  const f=fixture({native,rejected}),before=f.stage.parentNode;f.find('photo-fullscreen-viewer').click();await f.flush();
  assert.equal(f.api.isActive(),true);assert.equal(f.state.active,true);assert.equal(f.stage.parentNode.id,'photoFullscreenRoot');assert.equal(f.find('photo-fullscreen-close').parentNode.className,'photo-fullscreen-bar');
  if(native&&!rejected)assert.equal(f.document.fullscreenElement,f.stage.parentNode);
  f.find('photo-fullscreen-next').click();assert.equal(f.media.current().id,'b');f.find('photo-fullscreen-close').click();
  assert.equal(f.api.isActive(),false);assert.equal(f.viewer.open,true);assert.equal(f.stage.parentNode,before);assert.equal(f.media.current().id,'b');assert.equal(f.document.fullscreenElement,null);
 }
});
test('the desktop fullscreen icon stays in the right rail above zoom and returns to the photo on compact layouts',async()=>{
 for(const english of [false,true]){
  const f=fixture({english}),launch=f.find('photo-fullscreen-viewer'),rail=f.document.createElement('div');rail.id='personalPhotoRight';f.viewer.append(rail);f.viewer.classList.add('personal-photo-desktop');
  f.api.sync();f.api.sync();assert.equal(launch.parentNode,rail);assert.equal(f.viewer.querySelectorAll('[data-photo-fullscreen="viewer"]').length,1);
  f.media.step(1);f.api.sync();assert.equal(f.find('photo-fullscreen-viewer'),launch,'Photo navigation reuses the rail icon');assert.equal(launch.parentNode,rail);
  launch.click();await f.flush();assert.equal(f.api.isActive(),true,'The moved icon still opens the current photo fullscreen');f.api.exit();assert.equal(f.find('photo-fullscreen-viewer').parentNode,rail);
  f.viewer.classList.remove('personal-photo-desktop');f.emit(f.window,'resize');assert.equal(f.find('photo-fullscreen-viewer').parentNode,f.stage);assert.equal(f.viewer.querySelectorAll('[data-photo-fullscreen="viewer"]').length,1);
 }
});
test('thumbnail fullscreen buttons are siblings, are not duplicated, skip video posters and return to the grid',async()=>{
 const f=fixture({viewerOpen:false});assert.equal(f.opener.parentNode.className,'photo-fullscreen-thumb');assert.equal(f.opener.querySelector('[data-photo-fullscreen]'),null);assert.equal(f.poster.parentNode,f.grid);
 f.redecorate();f.redecorate();assert.equal(f.document.querySelectorAll('[data-photo-fullscreen="thumbnail"]').length,1);
 f.opener._photoFullscreenLaunch.click();await f.flush();assert.equal(f.api.isActive(),true);assert.equal(f.media.current().id,'b');f.find('photo-fullscreen-close').click();assert.equal(f.viewer.open,false);assert.equal(f.stage.parentNode,f.viewer);
});
test('both languages keep the next action at +1 and the previous action at -1; Escape and native Escape exit cleanly',async()=>{
 for(const english of [false,true]){
  const f=fixture({english,native:true});f.api.enter();await f.flush();f.find('photo-fullscreen-next').click();f.find('photo-fullscreen-previous').click();assert.deepEqual(f.steps,[1,-1]);assert.equal(f.media.current().id,'a');
  assert.equal(f.emit(f.document,'keydown',{key:'Escape'}).defaultPrevented,true);assert.equal(f.api.isActive(),false);assert.equal(f.viewer.open,true);
  f.api.enter();await f.flush();f.document.fullscreenElement=null;f.emit(f.document,'fullscreenchange');assert.equal(f.api.isActive(),false);
 }
});
test('personal album photos, profile portraits and the home carousel open directly without activating their ordinary click paths',async()=>{
 const f=fixture({viewerOpen:false}),person=f.document.createElement('button'),portrait=f.document.createElement('button'),home=f.document.createElement('div'),homePhoto=f.document.createElement('button');
 person.dataset.personItem='c';person.dataset.personKind='photos';person.append(f.document.createElement('img'));person.addEventListener('click',()=>f.media.openFrom('personal:ora','c'));
 portrait.dataset.personPortrait='';const profile=f.document.createElement('img');profile.src=profile.currentSrc='/profile';profile.alt='Profile name';portrait.append(profile);
 home.id='homeSlideStage';homePhoto.id='homeSlideOpen';homePhoto.dataset.photoAlbum='home:photos';homePhoto.dataset.photoId='a';homePhoto.disabled=true;homePhoto.append(f.document.createElement('img'));home.append(homePhoto);f.document.body.append(person,portrait,home);f.redecorate();
 person._photoFullscreenLaunch.click();await f.flush();assert.equal(f.state.scope,'personal:ora');assert.equal(f.media.current().id,'c');assert.equal(f.api.isActive(),true);f.api.exit();assert.equal(f.viewer.open,false);
 portrait._photoFullscreenLaunch.click();await f.flush();assert.equal(f.media.current().src,'/profile');assert.equal(f.media.current().caption,'Profile name');assert.equal(f.find('photo-fullscreen-play').disabled,true);f.api.exit();
 home.querySelector('[data-photo-fullscreen]').click();await f.flush();assert.equal(f.state.scope,'home:photos');assert.equal(f.media.current().id,'a');assert.equal(f.api.isActive(),true);f.api.exit();
});
test('slideshow loops, pauses, waits four seconds per loaded image and never advances while hidden or closed',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const f=fixture();f.api.enter();await f.flush();f.find('photo-fullscreen-play').click();
 for(const id of ['b','c','a']){t.mock.timers.tick(3999);assert.equal(f.steps.length,['b','c','a'].indexOf(id));t.mock.timers.tick(1);await f.flush();assert.equal(f.media.current().id,id);}
 f.document.hidden=true;f.emit(f.document,'visibilitychange');t.mock.timers.tick(30000);assert.equal(f.steps.length,3);f.document.hidden=false;f.emit(f.document,'visibilitychange');t.mock.timers.tick(4000);await f.flush();assert.equal(f.media.current().id,'b');
 f.find('photo-fullscreen-play').click();t.mock.timers.tick(20000);assert.equal(f.steps.length,4);f.find('photo-fullscreen-play').click();f.find('photo-fullscreen-close').click();t.mock.timers.tick(20000);assert.equal(f.steps.length,4);
});
test('unloaded, failed and stale images cannot start or revive a slideshow',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const f=fixture({loading:true});f.api.enter();f.find('photo-fullscreen-play').click();t.mock.timers.tick(20000);assert.equal(f.steps.length,0);f.load();await f.flush();t.mock.timers.tick(4000);await f.flush();assert.equal(f.steps.length,1);
 f.emit(f.stage.querySelector('img'),'error');await f.flush();assert.equal(f.find('photo-fullscreen-play').getAttribute('aria-pressed'),'false');assert.ok(f.find('photo-fullscreen-status').textContent);t.mock.timers.tick(20000);assert.equal(f.steps.length,1);
 const stale=fixture({loading:true});stale.api.enter();stale.find('photo-fullscreen-play').click();stale.api.exit();stale.load();await stale.flush();t.mock.timers.tick(20000);assert.equal(stale.steps.length,0);
});
test('a loaded next-page image starts its dwell timer only when the page request has finished',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const f=fixture();f.api.enter();await f.flush();f.find('photo-fullscreen-play').click();f.state.busy=true;f.api.sync();
 f.api.present(f.media.current(),f.stage.querySelector('img'));await f.flush();t.mock.timers.tick(12000);assert.equal(f.steps.length,0);
 f.state.busy=false;f.api.sync();t.mock.timers.tick(3999);assert.equal(f.steps.length,0);t.mock.timers.tick(1);assert.equal(f.steps.length,1);f.api.exit();
});
test('one-photo views disable playback and arrows; closing the underlying gallery restores the stage',async()=>{
 const f=fixture({items:[{id:'only',kind:'photo',src:'/only'}]});f.api.enter();await f.flush();assert.equal(f.find('photo-fullscreen-play').disabled,true);assert.equal(f.find('photo-fullscreen-next').hidden,true);assert.equal(f.find('photo-fullscreen-previous').hidden,true);f.viewer.close();assert.equal(f.api.isActive(),false);assert.equal(f.stage.parentNode,f.viewer);
});
test('grid and viewer use the same outward-arrow fullscreen symbol',()=>{
 const f=fixture(),viewerIcon=f.find('photo-fullscreen-viewer').innerHTML.split('</svg>')[0];
 assert.equal(f.opener._photoFullscreenLaunch.innerHTML.split('</svg>')[0],viewerIcon);
});
test('slideshow speed changes replace the active timer and still wait for loaded photos',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const f=fixture();f.api.enter();await f.flush();const speed=f.find('photo-fullscreen-speed');f.find('photo-fullscreen-play').click();
 for(const value of [.25,.5,1,1.5,2]){
  t.mock.timers.tick(100);const before=f.steps.length;speed.value=String(value);f.emit(speed,'change');const duration=4000/value;
  t.mock.timers.tick(Math.floor(duration)-1);assert.equal(f.steps.length,before);t.mock.timers.tick(2);await f.flush();assert.equal(f.steps.length,before+1);
 }
 f.state.busy=true;f.api.sync();speed.value='.5';f.emit(speed,'change');const before=f.steps.length;t.mock.timers.tick(20000);assert.equal(f.steps.length,before);
 f.state.busy=false;f.api.sync();t.mock.timers.tick(7999);assert.equal(f.steps.length,before);t.mock.timers.tick(1);await f.flush();assert.equal(f.steps.length,before+1);f.api.exit();
});
test('random slideshow transitions cover every effect without repeats and leave manual navigation unchanged',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const f=fixture();f.api.enter();await f.flush();const effects=f.find('photo-fullscreen-effects');effects.click();assert.equal(effects.getAttribute('aria-pressed'),'true');f.find('photo-fullscreen-play').click();
 for(let i=0;i<14;i++){t.mock.timers.tick(4000);await f.flush();}
 const chosen=f.stepOptions.map(options=>options.effect);assert.equal(new Set(chosen.slice(0,7)).size,7);assert.equal(new Set(chosen.slice(7)).size,7);for(let i=1;i<chosen.length;i++)assert.notEqual(chosen[i],chosen[i-1]);
 f.find('photo-fullscreen-next').click();await f.flush();assert.equal(f.stepOptions.at(-1).effect,undefined,'Arrow clicks do not request slideshow effects');
 effects.click();assert.equal(effects.getAttribute('aria-pressed'),'false');t.mock.timers.tick(4000);await f.flush();assert.equal(f.stepOptions.at(-1).effect,null);f.api.exit();
});
