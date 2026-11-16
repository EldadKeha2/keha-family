import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';

const sources=await Promise.all(['gallery-input-settings.js','photo-native.js','photo-swipe.js','video-album-input.js'].map(name=>readFile(new URL('../public/assets/'+name,import.meta.url),'utf8')));
const tick=async()=>{for(let i=0;i<4;i++)await new Promise(resolve=>setImmediate(resolve));};
function fixture({mobile=false,supported=true,bridge=null,threeItems=false}={}){
 const {window,document}=parseHTML('<html><body><dialog id="first"><video controls></video></dialog><dialog id="second"><video controls></video></dialog></body></html>');
 let restored=0;const captures=[],selected=[];
 Object.defineProperty(window.HTMLElement.prototype,'clientWidth',{configurable:true,get:()=>800});
 Object.defineProperty(window.HTMLElement.prototype,'onscrollend',{configurable:true,value:null});
 window.HTMLElement.prototype.getBoundingClientRect=()=>({top:0,bottom:500,width:800,height:500});
 window.HTMLElement.prototype.setPointerCapture=id=>captures.push(id);
 window.FamilyMedia={refreshPhotoPresentation(){restored++;}};window.ontouchstart=null;
 const storage=new Map(bridge?[['keha-desktop-gesture-bridge-v14',JSON.stringify(bridge)]]:[]);window.localStorage={getItem:key=>storage.get(key)};
 const context=vm.createContext({window,document,URL,location:{href:'https://family.test/'},CSS:{supports:()=>supported},navigator:{userAgent:mobile?'Android Mobile':'Windows NT 10.0'},setTimeout,clearTimeout});
 for(const source of sources)vm.runInContext(source,context);
 const items=[{key:'a',kind:'video',poster:'/poster-a',caption:'Clip A',src:'/a.mp4'},{key:'b',kind:'video',poster:'/poster-b',caption:'Clip B',src:'/b.mp4'}];
 if(threeItems)items.push({key:'c',kind:'video',poster:'/poster-c',caption:'Clip C',src:'/c.mp4'});
 const emit=(node,type,props={})=>{const event=new window.Event(type,{bubbles:true,cancelable:true});Object.assign(event,props);node.dispatchEvent(event);return event;};
 const mount=id=>{
  const dialog=document.getElementById(id),video=dialog.querySelector('video');dialog.open=true;let controller;
  controller=window.FamilyVideoAlbumInput.bind(video,{isOpen:()=>dialog.open,select:item=>{selected.push(item.key);video.src=item.src;controller.sync(items,item.key);}});
  video.src=items[0].src;controller.sync(items,'a');
  return {dialog,video,controller,strip:()=>controller.stage.querySelector('.native-photo-strip'),close(){dialog.open=false;controller.close();}};
 };
 return {window,document,items,emit,mount,captures,selected,get restored(){return restored;}};
}

test('generated video input owns horizontal movement and release while retaining one real player and native controls',async()=>{
 const f=fixture(),player=f.mount('first'),strip=player.strip();
 assert.ok(strip);assert.equal(player.controller.stage.querySelectorAll('video').length,1);assert.equal(strip.children[1].querySelector('video'),player.video);
 assert.equal(strip.children[0].querySelector('img').src,'/poster-b');assert.equal(strip.children[2].querySelector('img').src,'/poster-b');
 assert.equal(f.emit(player.video,'wheel',{deltaX:120,deltaY:0,clientX:200,clientY:470}).defaultPrevented,false,'The seeking strip still gets native wheel input');
 const pointer=(type,x,id=1)=>f.emit(player.video,type,{pointerType:'touch',pointerId:id,isPrimary:true,button:0,clientX:x,clientY:200});
 assert.equal(pointer('pointerdown',200).defaultPrevented,false);assert.equal(pointer('pointermove',350).defaultPrevented,true);assert.equal(strip.scrollLeft,650,'The first rightward motion moves actual pixels right');
 assert.deepEqual(f.captures,[1]);assert.equal(pointer('pointerup',350).defaultPrevented,true);
 await tick();assert.deepEqual(f.selected,['b']);assert.equal(player.video.src,'/b.mp4');assert.equal(player.strip(),strip);assert.equal(strip.scrollLeft,800);
 for(const [type,x]of [['pointerdown',350],['pointermove',200],['pointerup',200]])f.emit(player.video,type,{pointerType:'touch',pointerId:2,isPrimary:true,button:0,clientX:x,clientY:200});
 await tick();assert.deepEqual(f.selected,['b','a']);assert.equal(player.video.src,'/a.mp4');
 assert.equal(f.emit(player.video,'wheel',{deltaX:120,deltaY:0,clientX:200,clientY:200}).defaultPrevented,true,'The video body owns horizontal wheel input');
 await new Promise(resolve=>setTimeout(resolve,100));await tick();assert.deepEqual(f.selected,['b','a','b'],'Wheel navigation commits without scrollend');
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

test('generated video galleries retain the same pad action and screen animation as the main viewer',async()=>{
 for(const supported of [true,false])for(const pad of [-1,1])for(const touch of [-1,1]){
  const f=fixture({supported,bridge:{pad,touch},threeItems:true}),player=f.mount('first'),expected=pad>0?'b':'c';
  f.emit(player.video,'pointerdown',{pointerType:'touch',pointerId:1,isPrimary:true,button:0,clientX:300,clientY:200});
  f.emit(player.video,'pointermove',{pointerType:'touch',pointerId:1,isPrimary:true,button:0,clientX:300+touch*140,clientY:200});
  if(supported){assert.equal(player.strip().scrollLeft,800-touch*140);assert.equal(player.strip().children[touch>0?0:2]._item.key,expected);}
  f.emit(player.video,'pointerup',{pointerType:'touch',pointerId:1,isPrimary:true,button:0,clientX:300+touch*140,clientY:200});await tick();assert.equal(f.selected.at(-1),expected);player.close();
  const reopened=f.mount('second');f.emit(reopened.video,'wheel',{deltaX:pad*140,deltaY:0,clientX:400,clientY:200});
  if(supported){assert.equal(reopened.strip().scrollLeft,800-pad*140);assert.equal(reopened.strip().children[pad>0?0:2]._item.key,expected);}
  await new Promise(resolve=>setTimeout(resolve,150));await tick();assert.equal(f.selected.at(-1),expected);reopened.close();
 }
});

test('a desktop reference pair cannot change the phone video fallback direction',async()=>{
 const f=fixture({mobile:true,bridge:{pad:1,touch:-1},threeItems:true}),player=f.mount('first');
 for(const [type,x]of [['touchstart',350],['touchmove',200],['touchend',200]]){
  const point={identifier:4,clientX:x,clientY:200,target:player.video};f.emit(player.video,type,{touches:type==='touchend'?[]:[point],changedTouches:[point]});
 }
 await tick();assert.equal(f.selected.at(-1),'b');player.close();
});

test('generated video galleries accept pad navigation over their dialog controls and background',async()=>{
 for(const supported of [true,false]){
  const f=fixture({supported,bridge:{pad:-1,touch:1},threeItems:true}),player=f.mount('first'),button=f.document.createElement('button');button.textContent='Download';player.dialog.append(button);
  f.emit(button,'wheel',{deltaX:100,deltaY:0,clientX:400,clientY:200});f.emit(player.dialog,'wheel',{deltaX:40,deltaY:0,clientX:400,clientY:200});
  if(supported){assert.equal(player.strip().scrollLeft,660);assert.equal(player.strip().children[0]._item.key,'b');}
  await new Promise(resolve=>setTimeout(resolve,150));await tick();assert.deepEqual(f.selected,['b']);
  f.emit(button,'wheel',{deltaX:-140,deltaY:0,clientX:400,clientY:200});await new Promise(resolve=>setTimeout(resolve,150));await tick();assert.deepEqual(f.selected,['b','a']);player.close();
 }
});
