import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../public/assets/desktop-app.js',import.meta.url),'utf8');
function launch({mode='standalone',ua='Mozilla/5.0 (Windows NT 10.0; Win64; x64)',mobile=false,touch=0,iframe=false,ready='loading',screen={availLeft:0,availTop:0,availWidth:1920,availHeight:1040},moveBlocked=false,resizeBlocked=false}={}){
  const document=new EventTarget(),window=new EventTarget(),moves=[],sizes=[];
  document.readyState=ready;window.top=iframe?{}:window;window.screen=screen;
  window.moveTo=(...args)=>{moves.push(args);if(moveBlocked)throw Error('Move denied');};
  window.resizeTo=(...args)=>{sizes.push(args);if(resizeBlocked)throw Error('Resize denied');};
  vm.runInNewContext(source,{window,document,navigator:{userAgent:ua,maxTouchPoints:touch,userAgentData:{mobile}},matchMedia:query=>({matches:query===`(display-mode: ${mode})`})});
  return {moves,sizes,ready(){document.dispatchEvent(new Event('DOMContentLoaded'));},show(){window.dispatchEvent(new Event('pageshow'));}};
}

test('an installed desktop app fills its display work area at launch, including secondary displays',()=>{
  const f=launch({screen:{availLeft:-2560,availTop:30,availWidth:2560,availHeight:1370}});
  assert.equal(f.sizes.length,0);f.ready();assert.deepEqual(f.moves,[[-2560,30]]);assert.deepEqual(f.sizes,[[2560,1370]]);
});

test('an already loaded app also fits, while later page-show events preserve manual resizing',()=>{
  const f=launch({ready:'interactive',mode:'minimal-ui'});
  assert.deepEqual(f.sizes,[[1920,1040]]);f.ready();f.show();f.show();assert.equal(f.moves.length,1);assert.equal(f.sizes.length,1);
});

test('ordinary browser tabs, existing fullscreen windows, mobile devices, native apps and embedded pages never resize',()=>{
  for(const options of [{mode:'browser'},{mode:'fullscreen'},{mobile:true},{ua:'Mozilla/5.0 (Linux; Android 16)'},{ua:'Mozilla/5.0 (Macintosh; Intel Mac OS X)',touch:5},{ua:'Windows NT 10.0 KehaFamilyDesktop/2.0.0'},{iframe:true}]){
    const f=launch(options);f.ready();f.show();assert.equal(f.moves.length,0);assert.equal(f.sizes.length,0);
  }
});

test('unavailable display information and browser restrictions leave the installed app usable',()=>{
  for(const screen of [undefined,{}, {availWidth:0,availHeight:0},{availWidth:NaN,availHeight:1040},{availWidth:1920,availHeight:Infinity}]){
    const f=launch({screen:screen??{}});assert.doesNotThrow(()=>f.ready());assert.equal(f.sizes.length,0);
  }
  const f=launch({moveBlocked:true,resizeBlocked:true});assert.doesNotThrow(()=>f.ready());assert.deepEqual(f.sizes,[[1920,1040]]);
});
