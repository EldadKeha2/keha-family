import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../public/assets/photo-native.js',import.meta.url),'utf8');
function fixture({mobile=false,english=false}={}){
 class Node{
  constructor(){this.nodeType=1;this.children=[];this.handlers=new Map();this.clientWidth=800;this.scrollLeft=0;this.className='';this.parent=null;this.style={};const classes=new Set();this.classList={add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x)};}
  setAttribute(name,value){this[name]=value;}
  addEventListener(type,handler){this.handlers.set(type,handler);}
  append(...nodes){for(const node of nodes){node.remove();node.parent=this;this.children.push(node);}}
  before(node){const parent=this.parent,index=parent.children.indexOf(this);node.remove();node.parent=parent;parent.children.splice(index,0,node);}
  remove(){if(this.parent){this.parent.children=this.parent.children.filter(x=>x!==this);this.parent=null;}}
  querySelector(selector){if(selector==='.face-photo-scroll')return this.children.flatMap(n=>[n,...n.children.flatMap(c=>[c,...c.children])]).find(n=>n.className==='face-photo-scroll')||null;return null;}
 }
 const stage=new Node(),scroll=new Node(),window={},document={createElement:()=>new Node()},calls=[];scroll.className='face-photo-scroll';stage.append(scroll);let enabled=true;
 vm.runInNewContext(source,{window,document,navigator:{userAgent:mobile?'Android':'Windows NT'},matchMedia:()=>({matches:mobile}),setTimeout,clearTimeout});
 const options={previous:{kind:'photo',previewSrc:'/prev-small'},next:{kind:'photo',previewSrc:'/next-small'},isEnglish:english,enabled:()=>enabled,step(direction,opts){calls.push({direction,native:opts.native});window.FamilyPhotoNative.reset(stage);}};
 return {api:window.FamilyPhotoNative,stage,scroll,calls,options,disable(){enabled=false;}};
}
test('desktop native scrolling selects the adjacent photo once in either language and restores the face scroller',async()=>{
 for(const english of [true,false])for(const page of [0,2]){
  const f=fixture({english});assert.equal(f.api.mount(f.stage,f.options),true);const strip=f.stage.children[0];assert.equal(strip.className,'native-photo-strip');assert.equal(strip.scrollLeft,800);
  assert.equal(strip.children[1].children[0],f.scroll);assert.equal(f.api.mount(f.stage,f.options),true);assert.equal(f.stage.children.length,1);
  strip.scrollLeft=page*800;strip.handlers.get('scrollend')();strip.handlers.get('scrollend')();await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(f.calls,[{direction:(page===2?1:-1)*(english?1:-1),native:true}]);assert.equal(f.scroll.parent,f.stage);assert.equal(f.api.has(f.stage),false);
 }
});
test('native swiping leaves phones on their existing gestures and disables itself for zoom or editing',()=>{
 const phone=fixture({mobile:true});assert.equal(phone.api.mount(phone.stage,phone.options),false);assert.equal(phone.stage.children[0],phone.scroll);
 const f=fixture();f.api.mount(f.stage,f.options);f.disable();assert.equal(f.api.mount(f.stage,f.options),false);assert.equal(f.stage.children[0],f.scroll);
});
