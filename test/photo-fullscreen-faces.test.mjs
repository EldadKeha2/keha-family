import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../public/assets/photo-fullscreen-faces.js',import.meta.url),'utf8');
const faces=[{rect:{x:.4,y:.3,width:.2,height:.2},person:{id:'yona',name:'יונה'}},{rect:{x:.7,y:.3,width:.1,height:.2},person:{id:'shlomo',name:'שלמה'}},{rect:{x:.1,y:.1,width:.1,height:.1}}];
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function fixture({read=async()=>faces,naturalWidth=1000,naturalHeight=600}={}){
 class Node extends EventTarget{
  constructor(){super();this.children=[];this.style={};this.dataset={};this.hidden=false;this.textContent='';this.isConnected=true;this.classes=new Set();this.classList={contains:name=>this.classes.has(name)};}
  setAttribute(name,value){this[name]=value;}
  append(...nodes){for(const node of nodes){node.parent=this;this.children.push(node);}}
  remove(){this.isConnected=false;if(this.parent)this.parent.children=this.parent.children.filter(node=>node!==this);}
  getBoundingClientRect(){return this.className?.split(' ').includes('photo-fullscreen-face-label')?{left:0,top:0,width:120,height:34}:{left:0,top:0,width:1000,height:600};}
  querySelector(selector){return this.children.find(node=>node.className===selector.slice(1))||null;}
 }
 const stage=new Node(),image=new Node(),window=new EventTarget(),document=new EventTarget(),requests=[];image.naturalWidth=naturalWidth;image.naturalHeight=naturalHeight;let busy=false;
 document.createElement=()=>new Node();window.FamilyMedia={photoState:()=>({busy})};window.FamilyI18n={personName:person=>person.name};window.FamilyFaces={saved:(item,options)=>{requests.push({item,options});return read(item,options);}};
 vm.runInNewContext(source,{window,document,AbortController,Date,setTimeout,clearTimeout});
 const api=window.FamilyFullscreenFaces,item=id=>({id,kind:'photo',tags:[]});
 const pointer=(type,x=500,y=240,pointerType='mouse',extra={})=>{const event=new Event(type);for(const [key,value]of Object.entries({clientX:x,clientY:y,pointerType,pointerId:1,buttons:0,...extra}))Object.defineProperty(event,key,{value});stage.dispatchEvent(event);return event;};
 return {api,window,document,stage,image,requests,pointer,item,busy(value){busy=value;},mount(id='a',extra={}){api.mount(stage,image,{...item(id),...extra});},bubble:()=>stage.querySelector('.photo-fullscreen-face-label'),outline:()=>stage.querySelector('.photo-fullscreen-face-outline')};
}
test('fullscreen hover displays saved names, replaces the previous label and never labels an unnamed face',async()=>{
 const f=fixture();f.mount();await flush();f.pointer('pointermove');assert.equal(f.bubble().textContent,'יונה');assert.equal(f.bubble().hidden,false);assert.equal(f.outline().style.left,'400px');
 f.pointer('pointermove',750,240);assert.equal(f.bubble().textContent,'שלמה');f.pointer('pointermove',150,90);assert.equal(f.bubble().hidden,true);f.pointer('pointermove');f.pointer('pointerleave');assert.equal(f.bubble().hidden,true);f.api.clear();
});
test('portrait letterboxes and resized images map pointer coordinates to the actual contained pixels',async()=>{
 const f=fixture({naturalWidth:200,naturalHeight:400});f.mount();await flush();f.pointer('pointermove',500,240);assert.equal(f.bubble().textContent,'יונה');assert.equal(f.outline().style.left,'470px');
 f.pointer('pointermove',100,240);assert.equal(f.bubble().hidden,true,'The side margin is not part of the photo');
 f.image.getBoundingClientRect=()=>({left:20,top:10,width:400,height:400});f.window.dispatchEvent(new Event('resize'));f.pointer('pointermove',220,170);assert.equal(f.bubble().textContent,'יונה');assert.equal(f.outline().style.left,'200px');f.api.clear();
});
test('a touch tap keeps the name for two seconds even after pointerleave, while swipes and cancellation show no label',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const f=fixture();f.mount();await flush();f.pointer('pointerdown',500,240,'touch');const end=f.pointer('pointerup',500,240,'touch');f.pointer('pointerleave',500,240,'touch');assert.equal(f.bubble().hidden,false);assert.equal(end.defaultPrevented,false);
 t.mock.timers.tick(1999);assert.equal(f.bubble().hidden,false);t.mock.timers.tick(1);assert.equal(f.bubble().hidden,true);
 f.pointer('pointerdown',500,240,'touch');f.pointer('pointermove',620,240,'touch');f.pointer('pointerup',620,240,'touch');assert.equal(f.bubble().hidden,true);
 f.pointer('pointerdown',500,240,'touch');f.pointer('pointercancel',500,240,'touch');f.pointer('pointerup',500,240,'touch');assert.equal(f.bubble().hidden,true);f.api.clear();
});
test('fullscreen labels stay out of pending photos, transitions and scrolling',async()=>{
 const f=fixture();f.mount();await flush();f.busy(true);f.pointer('pointermove');assert.equal(f.bubble().hidden,true);f.busy(false);f.stage.classes.add('photo-slide-running');f.pointer('pointermove');assert.equal(f.bubble().hidden,true);f.stage.classes.clear();
 f.pointer('pointermove');assert.equal(f.bubble().hidden,false);f.stage.dispatchEvent(new Event('scroll'));assert.equal(f.bubble().hidden,true);f.api.clear();
});
test('late face requests and old input handlers cannot label a different photo or a closed viewer',async()=>{
 const pending=new Map(),f=fixture({read:item=>new Promise(resolve=>pending.set(item.id,resolve))});f.mount('a');const first=f.requests[0];f.mount('b');assert.equal(first.options.signal.aborted,true);f.pointer('pointermove');pending.get('b')([{...faces[0],person:{name:'New photo'}}]);await flush();assert.equal(f.bubble().textContent,'New photo');
 pending.get('a')(faces);await flush();assert.equal(f.bubble().textContent,'New photo');const bubble=f.bubble();f.api.clear();assert.equal(bubble.isConnected,false);f.pointer('pointermove');assert.equal(f.stage.children.length,0);
});
test('names remain text and a failed saved-label request leaves photo input usable',async()=>{
 const f=fixture({read:async()=>[{...faces[0],person:{name:'<script>Family name</script>'}}]});f.mount();await flush();f.pointer('pointermove');assert.equal(f.bubble().textContent,'<script>Family name</script>');f.api.clear();
 const failed=fixture({read:async()=>{throw Error('Offline');}});failed.mount();await flush();assert.equal(failed.pointer('pointerup').defaultPrevented,false);assert.equal(failed.bubble().hidden,true);failed.api.clear();
});
test('persistent names and photo ages are independent, follow each image and resize, and never invent unknown ages',async()=>{
 const f=fixture(),ages=[];f.window.FamilyPhotoDate={ageFor(person,item){ages.push({person,item});return person.id==='yona'&&item.takenDate?.year?{text:'58'}:null;}};
 const labels=()=>f.stage.children.filter(node=>node.className?.includes('photo-fullscreen-person-label'));
 f.api.configure({showNames:true,showAges:true});f.mount('old',{takenDate:{year:1980}});await flush();
 assert.deepEqual(labels().map(node=>node.textContent),['יונה · גיל 58','שלמה']);assert.ok(ages.every(call=>call.item.id==='old'));
 f.api.configure({showNames:false});assert.deepEqual(labels().map(node=>node.textContent),['גיל 58']);
 const old=labels()[0];f.window.dispatchEvent(new Event('resize'));assert.equal(old.isConnected,false);assert.equal(labels().length,1);
 f.mount('undated');assert.equal(labels().length,0);await flush();assert.equal(labels().length,0,'Unknown photo dates have no age label');
 f.api.configure({showNames:true});assert.deepEqual(labels().map(node=>node.textContent),['יונה','שלמה']);f.api.clear();assert.equal(f.stage.children.length,0);
});
