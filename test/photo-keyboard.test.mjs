import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../public/assets/photo-keyboard.js',import.meta.url),'utf8');
function fixture({userAgent='Windows NT 10.0',mobile=false,touch=0,wide=true}={}){
 const window=new EventTarget(),navigator={userAgent,maxTouchPoints:touch,userAgentData:{mobile}},moves=[];
 vm.runInNewContext(source,{window,navigator,matchMedia:()=>({matches:wide})});
 let available=true,context={id:'photo-1'};
 window.FamilyPhotoKeyboard.bindNavigation({available:()=>available,capture:()=>context,navigate:(direction,owner)=>moves.push({direction,owner})});
 const key=(key,flags={},type='keydown')=>{const event=new Event(type,{cancelable:true});Object.assign(event,{key,...flags});window.dispatchEvent(event);return event;};
 return {window,navigator,moves,key,api:window.FamilyPhotoKeyboard,set available(value){available=value;},set context(value){context=value;}};
}
test('desktop shortcuts work in narrow desktop/native windows and never activate on phones or tablets',()=>{
 for(const options of [{userAgent:'Windows NT 10.0',wide:false,touch:10},{userAgent:'KehaFamilyDesktop/2.0.0',wide:false},{userAgent:'Macintosh',wide:false},{userAgent:'X11 Linux x86_64',wide:false}])assert.equal(fixture(options).api.desktop(),true);
 for(const options of [{userAgent:'Android',wide:true},{userAgent:'iPhone',wide:true},{userAgent:'Macintosh',touch:5,wide:true},{mobile:true,wide:true}]){
  const f=fixture(options);assert.equal(f.api.desktop(),false);f.key('Control',{ctrlKey:true});f.key('Control',{},'keyup');assert.equal(f.moves.length,0);
 }
});
test('modifier taps navigate on release once, in either order, retaining Shift if it is released first',()=>{
 const f=fixture();f.key('Control',{ctrlKey:true});f.key('Control',{ctrlKey:true,repeat:true});assert.equal(f.moves.length,0);assert.equal(f.key('Control',{},'keyup').defaultPrevented,true);
 f.key('Shift',{shiftKey:true});f.key('Control',{ctrlKey:true,shiftKey:true});f.key('Control',{shiftKey:true},'keyup');
 f.key('Control',{ctrlKey:true});f.key('Shift',{ctrlKey:true,shiftKey:true});f.key('Shift',{ctrlKey:true},'keyup');f.key('Control',{},'keyup');
 assert.deepEqual(f.moves.map(move=>move.direction),[1,-1,-1]);assert.equal(f.moves[0].owner.id,'photo-1');
});
test('copy/paste, select all, zoom, language shortcuts, composing, pointer gestures and lost focus do not navigate',()=>{
 const f=fixture();
 for(const key of ['c','v','a','+','-','ArrowRight','Tab','Enter'])for(const shiftKey of [true,false]){f.key('Control',{ctrlKey:true,shiftKey});f.key(key,{ctrlKey:true,shiftKey});assert.equal(f.key('Control',{shiftKey},'keyup').defaultPrevented,false);}
 for(const flags of [{altKey:true},{metaKey:true},{isComposing:true}]){f.key('Control',{ctrlKey:true,...flags});f.key('Control',{},'keyup');}
 for(const type of ['blur','pointerdown','wheel']){f.key('Control',{ctrlKey:true});f.window.dispatchEvent(new Event(type));f.key('Control',{},'keyup');}
 f.key('Control',{ctrlKey:true});f.available=false;f.key('Control',{},'keyup');assert.equal(f.moves.length,0);
});
test('Enter saves once, while Shift+Enter, IME, modifier combinations and mobile keep their normal meaning',()=>{
 const f=fixture();let saves=0;
 const enter=flags=>{const event=new Event('keydown',{cancelable:true});Object.assign(event,{key:'Enter',...flags});f.api.saveDescription(event,()=>saves++);return event;};
 assert.equal(enter({}).defaultPrevented,true);assert.equal(saves,1);assert.equal(enter({repeat:true}).defaultPrevented,true);assert.equal(saves,1);
 for(const flags of [{shiftKey:true},{ctrlKey:true},{altKey:true},{metaKey:true},{isComposing:true},{keyCode:229}])assert.equal(enter(flags).defaultPrevented,false);
 f.navigator.userAgent='Android';assert.equal(enter({}).defaultPrevented,false);assert.equal(saves,1);
});
