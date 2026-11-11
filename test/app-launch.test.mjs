import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
const source=html.match(/<script id="familyLaunchStartup">([\s\S]*?)<\/script>/)[1];

function fixture({android=true,standalone=true,reducedMotion=false}={}){
  const classes=new Set(),frames=[],timers=new Map();let now=0,nextTimer=0,removals=0;
  const window=new EventTarget(),document=new EventTarget();
  const screen={remove(){removals++;}};
  document.documentElement={classList:{add(...names){names.forEach(name=>classes.add(name));},remove(...names){names.forEach(name=>classes.delete(name));}}};
  document.getElementById=id=>id==='familyLaunchScreen'&&removals===0?screen:null;
  vm.runInNewContext(source,{window,document,navigator:{userAgent:android?'Mozilla/5.0 (Linux; Android 16)':'Mozilla/5.0 (Windows NT 10.0)'},matchMedia:query=>({matches:query==='(display-mode: standalone)'?standalone:reducedMotion}),requestAnimationFrame:callback=>frames.push(callback),setTimeout(callback,delay){const id=++nextTimer;timers.set(id,{callback,at:now+delay});return id;},clearTimeout:id=>timers.delete(id)});
  return {classes,window,document,get removals(){return removals;},frame(){const pending=frames.splice(0);pending.forEach(callback=>callback());},advance(ms){const end=now+ms;for(;;){const due=[...timers].filter(([,timer])=>timer.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!due)break;timers.delete(due[0]);now=due[1].at;due[1].callback();}now=end;},ready(){document.dispatchEvent(new Event('DOMContentLoaded'));}};
}

test('only an installed Android launch gets the splash; normal visits and other installed platforms remain visible',()=>{
  for(const android of [false,true])for(const standalone of [false,true]){
    const f=fixture({android,standalone});assert.equal(f.classes.has('family-launch-active'),android&&standalone);
    if(!android||!standalone){f.ready();f.frame();f.frame();f.advance(10000);assert.equal(f.removals,0);assert.equal(f.classes.size,0);}
  }
});

test('the splash covers the complete startup and leaves once after the home screen renders',()=>{
  const f=fixture();let homeReady=false;
  f.document.addEventListener('DOMContentLoaded',()=>{homeReady=true;});
  f.advance(1200);assert.ok(f.classes.has('family-launch-active'));assert.equal(f.removals,0);
  f.ready();assert.ok(homeReady);assert.equal(f.classes.has('family-launch-ready'),false);
  f.frame();assert.equal(f.classes.has('family-launch-ready'),false);
  f.frame();assert.ok(f.classes.has('family-launch-ready'));assert.ok(f.classes.has('family-launch-active'));
  f.advance(200);assert.equal(f.classes.size,0);assert.equal(f.removals,1);
  for(const type of ['focus','visibilitychange','hashchange','DOMContentLoaded'])f.window.dispatchEvent(new Event(type));
  f.ready();f.frame();f.frame();f.advance(10000);assert.equal(f.classes.size,0);assert.equal(f.removals,1);
});

test('a stalled startup releases the app without waiting forever or flashing again when it finally loads',()=>{
  const f=fixture();f.advance(7999);assert.ok(f.classes.has('family-launch-active'));
  f.advance(1);assert.equal(f.classes.size,0);assert.equal(f.removals,1);
  f.ready();f.frame();f.frame();f.advance(10000);assert.equal(f.classes.size,0);assert.equal(f.removals,1);
});

test('back-forward cache and background resume never restore the launch screen',()=>{
  for(const duringFade of [false,true]){
    const f=fixture();if(duringFade){f.ready();f.frame();f.frame();}
    f.window.dispatchEvent(new Event('pagehide'));assert.equal(f.classes.size,0);assert.equal(f.removals,1);
    const restore=new Event('pageshow');Object.defineProperty(restore,'persisted',{value:true});f.window.dispatchEvent(restore);
    f.ready();f.frame();f.frame();f.advance(10000);assert.equal(f.classes.size,0);assert.equal(f.removals,1);
  }
});

test('reduced motion reveals the ready app immediately with no fade delay',()=>{
  const f=fixture({reducedMotion:true});f.ready();f.frame();f.frame();assert.equal(f.classes.size,0);assert.equal(f.removals,1);
});

test('the first web frame uses the native launch background and the existing app artwork without an image request',async()=>{
  const manifest=JSON.parse(await readFile(new URL('../public/manifest.webmanifest',import.meta.url),'utf8'));
  const criticalStyle=html.match(/<style id="familyLaunchStyle">([\s\S]*?)<\/style>/)[1];
  assert.ok(criticalStyle.includes('html,body{background:'+manifest.background_color+'}'));
  assert.ok(html.indexOf('id="familyLaunchStartup"')<html.indexOf('<link rel="stylesheet"'));
  const screen=html.match(/<div id="familyLaunchScreen"[^>]*>([\s\S]*?)<\/div>/)[1];
  const icon=await readFile(new URL('../public/assets/app-icons/icon.svg',import.meta.url),'utf8');
  assert.equal(screen.replace(' focusable="false"',''),icon.trim());
});
