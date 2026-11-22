import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
import {nakashHTML} from '../src/nakash-shell.mjs';
import {extendedKehaHTML,shlomoKehaHTML,branchPortalHTML} from '../src/extended-keha.mjs';

const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
const source=await readFile(new URL('../public/assets/tree-fullscreen.js',import.meta.url),'utf8');

function harness({native=true,english=false}={}){
  const {document,window:dom}=parseHTML(html),window=new EventTarget();
  const viewport=document.getElementById('treeViewport'),button=document.getElementById('treeFullscreenButton');
  document.body.dataset.activeView='tree';
  window.FamilyI18n={isEnglish:english};
  let requests=0,exits=0,fits=0,focused=null,observer;
  const frames=new Map();let nextFrame=1;
  const changed=()=>document.dispatchEvent(new dom.Event('fullscreenchange'));
  document.exitFullscreen=async()=>{exits++;document.fullscreenElement=null;changed();};
  if(native)viewport.requestFullscreen=async()=>{requests++;document.fullscreenElement=viewport;changed();};
  button.focus=()=>{focused=button;};
  document.getElementById('fitButton').addEventListener('click',()=>fits++);
  class MutationObserver{constructor(callback){observer=callback;}observe(){}}
  const requestAnimationFrame=callback=>{const id=nextFrame++;frames.set(id,callback);return id;};
  vm.runInNewContext(source,{window,document,MutationObserver,requestAnimationFrame,cancelAnimationFrame:id=>frames.delete(id)});
  const flush=()=>{const queued=[...frames.values()];frames.clear();for(const callback of queued)callback();};
  const click=()=>{button.dispatchEvent(new dom.Event('click',{bubbles:true}));flush();};
  return {document,window,viewport,button,click,flush,changed,requests:()=>requests,exits:()=>exits,fits:()=>fits,focused:()=>focused,
    view(value){document.body.dataset.activeView=value;observer();flush();},
    key(value){const event=new dom.Event('keydown',{cancelable:true});event.key=value;document.dispatchEvent(event);flush();return event;},
  };
}

test('original and every family portal expose the same fullscreen control beside zoom',()=>{
  const pages=[html,...['','inside','keha','haim','yehuda','medina'].map(id=>nakashHTML(html,id)),extendedKehaHTML(html),shlomoKehaHTML(html),...['kehat','zechariah','zechariah-tzadok'].map(id=>branchPortalHTML(html,id))];
  for(const page of pages){
    const {document}=parseHTML(page),button=document.getElementById('treeFullscreenButton');
    assert.ok(button);assert.equal(button.previousElementSibling.id,'zoomOut');
    assert.ok(button.closest('#treeViewport .zoom-controls'));
    assert.equal(button.getAttribute('aria-controls'),'treeViewport');
    assert.ok(document.querySelector('script[src*="tree-fullscreen.js"]'));
  }
});

test('fullscreen fills the existing tree, retains its controls, refits it and exits through the same button',async()=>{
  const h=harness(),world=h.document.getElementById('treeWorld');
  assert.equal(h.button.querySelector('.tree-fullscreen-label').textContent,'מסך מלא');
  assert.equal(h.document.getElementById('treeFullscreenExit').hidden,true);
  h.click();assert.equal(h.requests(),1);assert.ok(h.document.fullscreenElement===h.viewport);
  assert.ok(h.viewport.classList.contains('tree-is-fullscreen'));assert.ok(h.document.documentElement.classList.contains('tree-fullscreen-active'));
  assert.equal(h.button.getAttribute('aria-pressed'),'true');assert.equal(h.button.title,'יציאה ממסך מלא');assert.equal(h.fits(),1);
  assert.equal(h.document.getElementById('treeFullscreenExit').hidden,false);
  assert.equal(h.document.getElementById('treeFullscreenExit').textContent,'יציאה ממסך מלא');
  assert.ok(h.document.getElementById('treeWorld')===world);
  for(const id of ['zoomIn','zoomOut','fitButton'])assert.ok(h.viewport.contains(h.document.getElementById(id)));
  h.click();await Promise.resolve();
  assert.equal(h.exits(),1);assert.equal(h.document.fullscreenElement,null);assert.equal(h.button.getAttribute('aria-pressed'),'false');
  assert.equal(h.viewport.classList.contains('tree-is-fullscreen'),false);assert.equal(h.document.documentElement.classList.contains('tree-fullscreen-active'),false);
  assert.equal(h.fits(),2);assert.ok(h.focused()===h.button);
  assert.equal(h.document.getElementById('treeFullscreenExit').hidden,true);
  h.click();h.document.getElementById('treeFullscreenExit').click();h.flush();
  assert.equal(h.button.getAttribute('aria-pressed'),'false');
});

test('unsupported or denied native fullscreen retains the full-window tree and a working Escape exit',async()=>{
  for(const request of [undefined,()=>Promise.reject(Error('Fullscreen denied')),()=>{throw Error('Fullscreen unavailable');}]){
    const h=harness({native:false,english:true});h.viewport.requestFullscreen=request;h.document.body.style.overflow='auto';h.click();await Promise.resolve();
    assert.ok(h.viewport.classList.contains('tree-is-fullscreen'));assert.equal(h.button.title,'Exit fullscreen');
    assert.equal(h.key('Escape').defaultPrevented,true);assert.equal(h.viewport.classList.contains('tree-is-fullscreen'),false);
    assert.equal(h.button.title,'Fullscreen');assert.equal(h.document.body.style.overflow,'auto');
  }
});

test('browser exit, navigation and a late native request cannot leave an empty fullscreen tree',async()=>{
  const h=harness();h.click();h.document.fullscreenElement=null;h.changed();h.flush();
  assert.equal(h.viewport.classList.contains('tree-is-fullscreen'),false);
  h.click();h.view('person');await Promise.resolve();
  assert.equal(h.document.fullscreenElement,null);assert.equal(h.document.documentElement.classList.contains('tree-fullscreen-active'),false);
  const late=harness({native:false});let resolve;
  late.viewport.requestFullscreen=()=>new Promise(done=>{resolve=done;});
  late.click();late.view('gallery');late.document.fullscreenElement=late.viewport;resolve();await new Promise(done=>setImmediate(done));
  assert.equal(late.document.fullscreenElement,null);assert.equal(late.exits(),1);
});
