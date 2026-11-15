import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {HOLD_MS,normalizeFrame,dragFrame} from '../public/assets/photo-framing-core.mjs';
import {photoFrame,validatePhotoFrame} from '../src/photo-framing.mjs';
const source=(await readFile(new URL('../public/assets/photo-framing.js',import.meta.url),'utf8')).replace(/^import[^\n]+\n/,'');
const id='a'.repeat(32),flush=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(){
 const handlers=new Map(),events=new Map(),timers=new Map(),calls=[];let now=0,serial=0,toolbar,mutated;
 const image={tagName:'IMG',dataset:{photoFrame:id},style:{},naturalWidth:400,naturalHeight:1000,isConnected:true,attrs:{},classList:{values:new Set(),add(v){this.values.add(v);},remove(v){this.values.delete(v);}},getAttribute:key=>key==='src'?'/media/'+id:null,getBoundingClientRect:()=>({left:10,top:10,bottom:210,width:200,height:200}),setPointerCapture(){},releasePointerCapture(){},matches:()=>true,querySelectorAll:()=>[],setAttribute(key,value){this.attrs[key]=value;},closest(s){return s==='img[data-photo-frame]'?this:s==='dialog'||s==='[aria-hidden=true]'?null:s==='button,a'?owner:null;}};
 const owner={dataset:{},title:'Open photo',setAttribute(){},closest:()=>null,querySelector:()=>image};
 const button=()=>({textContent:'',setAttribute(){}}),buttons=new Map();
 const document={readyState:'complete',body:{append(node){toolbar=node;}},querySelectorAll:()=>[image],addEventListener:(type,fn)=>handlers.set(type,fn),createElement:()=>({style:{},offsetHeight:74,hidden:false,setAttribute(){},addEventListener(type,fn){this[type]=fn;},querySelector(selector){if(!buttons.has(selector))buttons.set(selector,button());return buttons.get(selector);}})};
 const window={FamilyI18n:{isEnglish:false,error:String,fetch:async(url,options)=>{const body=JSON.parse(options.body);calls.push({url,...body});return Response.json({item:{id,framing:body.framing}});}},FamilyApp:{toast(){}},addEventListener:(type,fn)=>events.set(type,fn),dispatchEvent(event){events.get(event.type)?.(event);},FAMILY_API_TOKEN:'test'};
 vm.runInNewContext(source,{window,document,HOLD_MS,normalizeFrame,dragFrame,innerWidth:400,innerHeight:700,CustomEvent,MutationObserver:class{constructor(fn){mutated=fn;}observe(){}},Date:{now:()=>now},setTimeout:(fn,ms)=>{timers.set(++serial,{fn,at:now+ms});return serial;},clearTimeout:key=>timers.delete(key)});
 function event(type,extra={}){const e={target:image,button:0,isPrimary:true,pointerType:'mouse',pointerId:1,clientX:100,clientY:100,preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;},stopImmediatePropagation(){this.stopped=true;},...extra};handlers.get(type)?.(e);return e;}
 return{image,owner,calls,window,event,rescan:()=>mutated([{addedNodes:[image]}]),get toolbar(){return toolbar;},tick(ms){now+=ms;for(const [key,timer]of [...timers])if(timer.at<=now){timers.delete(key);timer.fn();}}};
}
test('framing translates in the direction of a drag for tall and wide photos and stays within the frame',()=>{
 const box={width:200,height:200},center=normalizeFrame();
 assert.ok(dragFrame(center,0,70,box,{width:400,height:1000}).y<.5);
 assert.ok(dragFrame(center,70,0,box,{width:1000,height:400}).x<.5);
 assert.deepEqual(dragFrame(center,900,900,box,{width:400,height:1000}),{x:.5,y:0,fit:'cover'});
 const fitted=dragFrame({x:.5,y:.5,fit:'contain'},40,0,box,{width:400,height:1000});assert.ok(fitted.x>.5);assert.equal(fitted.y,.5);
 for(const value of [{x:.2,y:.3,fit:'contain'},{x:1,y:0,fit:'cover'},{}])assert.deepEqual(photoFrame(value),normalizeFrame(value));
 for(const value of [null,{x:-1,y:.5,fit:'cover'},{x:.5,y:Infinity,fit:'cover'},{x:.5,y:.5,fit:'url(bad)'}])assert.throws(()=>validatePhotoFrame(value));
});
test('mouse dragging updates framing immediately, saves once on release and suppresses opening the gallery',async()=>{
 const f=fixture();f.event('pointerdown');f.event('pointermove',{clientY:160});assert.equal(f.calls.length,0);assert.equal(f.image.classList.values.has('photo-framing-active'),true);assert.equal(f.image.style.objectPosition,'50% 30%');
 f.event('pointerup',{clientY:160});await flush();assert.equal(f.calls.length,1);assert.deepEqual(f.calls[0].framing,{x:.5,y:.3,fit:'cover'});assert.equal(f.event('click').prevented,true);
});
test('a phone tap or an early swipe keeps ordinary gallery opening and scrolling with no framing mutation',()=>{
 const f=fixture();f.event('pointerdown',{pointerType:'touch'});f.tick(1499);f.event('pointerup',{pointerType:'touch'});assert.equal(f.calls.length,0);assert.equal(f.event('click').prevented,undefined);
 f.event('pointerdown',{pointerType:'touch'});f.event('pointermove',{pointerType:'touch',clientX:140});f.tick(1500);assert.equal(f.image.classList.values.has('photo-framing-active'),false);assert.equal(f.calls.length,0);
});
test('a phone enables positioning only after exactly 1500 ms and then saves the finger movement',async()=>{
 const f=fixture();f.event('pointerdown',{pointerType:'touch'});f.tick(1499);assert.equal(f.image.classList.values.has('photo-framing-active'),false);f.tick(1);assert.equal(f.image.classList.values.has('photo-framing-active'),true);
 const moved=f.event('pointermove',{pointerType:'touch',clientY:175});assert.equal(moved.prevented,true);f.event('pointerup',{pointerType:'touch',clientY:175});await flush();assert.equal(f.calls.length,1);assert.equal(f.calls[0].framing.y,.25);assert.equal(f.event('click').stopped,true);
});
test('an interrupted long press restores its previous position without saving',()=>{
 const f=fixture();f.event('pointerdown',{pointerType:'touch'});f.tick(1500);f.event('pointermove',{pointerType:'touch',clientY:160});f.event('pointercancel',{pointerType:'touch'});assert.equal(f.calls.length,0);assert.equal(f.image.style.objectPosition,'50% 50%');
});

test('framing instructions appear once when other gallery controls are added or the same image is observed again',()=>{const f=fixture();f.rescan();f.rescan();assert.equal(f.owner.title.split('למיקום התמונה:').length-1,1);});
