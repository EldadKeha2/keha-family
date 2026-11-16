import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';

const sources=await Promise.all(['photo-native.js','photo-swipe.js','video-album-input.js'].map(name=>readFile(new URL('../public/assets/'+name,import.meta.url),'utf8')));
const tick=async()=>{for(let i=0;i<4;i++)await new Promise(resolve=>setImmediate(resolve));};
function fixture({mobile=false}={}){
 const {window,document}=parseHTML('<html><body><dialog id="first"><video controls></video></dialog><dialog id="second"><video controls></video></dialog></body></html>');
 let restored=0;const captures=[],selected=[];
 Object.defineProperty(window.HTMLElement.prototype,'clientWidth',{configurable:true,get:()=>800});
 Object.defineProperty(window.HTMLElement.prototype,'onscrollend',{configurable:true,value:null});
 window.HTMLElement.prototype.getBoundingClientRect=()=>({top:0,bottom:500,width:800,height:500});
 window.HTMLElement.prototype.setPointerCapture=id=>captures.push(id);
 window.FamilyMedia={refreshPhotoPresentation(){restored++;}};window.ontouchstart=null;
 const context=vm.createContext({window,document,CSS:{supports:()=>true},navigator:{userAgent:mobile?'Android Mobile':'Windows NT 10.0'},setTimeout,clearTimeout});
 for(const source of sources)vm.runInContext(source,context);
 const items=[{key:'a',kind:'video',poster:'/poster-a',caption:'Clip A',src:'/a.mp4'},{key:'b',kind:'video',poster:'/poster-b',caption:'Clip B',src:'/b.mp4'}];
 const emit=(node,type,props={})=>{const event=new window.Event(type,{bubbles:true,cancelable:true});Object.assign(event,props);node.dispatchEvent(event);return event;};
 const mount=id=>{
  const dialog=document.getElementById(id),video=dialog.querySelector('video');dialog.open=true;let controller;
  controller=window.FamilyVideoAlbumInput.bind(video,{isOpen:()=>dialog.open,select:item=>{selected.push(item.key);video.src=item.src;controller.sync(items,item.key);}});
  video.src=items[0].src;controller.sync(items,'a');
  return {dialog,video,controller,strip:()=>controller.stage.querySelector('.native-photo-strip'),close(){dialog.open=false;controller.close();}};
 };
 return {window,document,items,emit,mount,captures,selected,get restored(){return restored;}};
}

test('generated video input uses the same native strip while retaining one real player and native controls',async()=>{
 const f=fixture(),player=f.mount('first'),strip=player.strip();
 assert.ok(strip);assert.equal(player.controller.stage.querySelectorAll('video').length,1);assert.equal(strip.children[1].querySelector('video'),player.video);
 assert.equal(strip.children[0].querySelector('img').src,'/poster-b');assert.equal(strip.children[2].querySelector('img').src,'/poster-b');
 assert.equal(f.emit(player.video,'wheel',{deltaX:120,deltaY:0,clientX:200,clientY:470}).defaultPrevented,false,'The seeking strip still gets native wheel input');
 for(const [type,x]of [['pointerdown',200],['pointermove',350],['pointerup',350]])assert.equal(f.emit(player.video,type,{pointerType:'touch',pointerId:1,isPrimary:true,button:0,clientX:x,clientY:200}).defaultPrevented,false);
 assert.deepEqual(f.captures,[]);
 strip.scrollLeft=0;f.emit(strip,'scrollend');await tick();assert.deepEqual(f.selected,['b']);assert.equal(player.video.src,'/b.mp4');assert.equal(player.strip(),strip);assert.equal(strip.scrollLeft,800);
 strip.scrollLeft=1600;f.emit(strip,'scrollend');await tick();assert.deepEqual(f.selected,['b','a']);assert.equal(player.video.src,'/a.mp4');
 player.close();assert.equal(player.strip(),null);assert.equal(player.video.parentNode,player.controller.stage);assert.equal(f.restored,1);
});

test('closing a different generated player cannot remove the active strip and a closed player cannot navigate',async()=>{
 const f=fixture(),first=f.mount('first'),second=f.mount('second'),strip=second.strip();
 first.close();assert.equal(second.strip(),strip);assert.equal(f.window.FamilyPhotoNative.has(second.controller.stage),true);assert.equal(f.restored,0,'Closing an inactive player cannot steal native ownership from a different open dialog');
 second.close();strip.scrollLeft=0;f.emit(strip,'scrollend');await tick();assert.deepEqual(f.selected,[]);assert.equal(f.window.FamilyPhotoNative.has(second.controller.stage),false);
});

test('phone touch fallback navigates ready videos without taking native seeking controls',async()=>{
 const f=fixture({mobile:true}),player=f.mount('first');assert.equal(player.strip(),null);
 const touch=(type,x,y=200)=>{const point={identifier:4,clientX:x,clientY:y,target:player.video};return f.emit(player.video,type,{touches:type==='touchend'?[]:[point],changedTouches:[point]});};
 touch('touchstart',350,480);touch('touchmove',200,480);touch('touchend',200,480);assert.deepEqual(f.selected,[],'Seeking retains its native gesture');
 touch('touchstart',350);touch('touchmove',200);touch('touchend',200);await tick();assert.deepEqual(f.selected,['b']);assert.equal(player.video.src,'/b.mp4');player.close();
});
