import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {bindTimelineFullscreen} from '../public/assets/family-timeline-fullscreen.mjs';

function harness(native=true){
  const {document,window}=parseHTML('<html><body style="overflow:auto"><section><div class="ft-toolbar"><button data-timeline-fullscreen><span></span></button></div><div data-overview-world style="transform:translateX(-200px)"></div></section></body></html>');
  const root=document.querySelector('section'),button=root.querySelector('button'),world=root.querySelector('[data-overview-world]');
  Object.defineProperty(root,'clientHeight',{value:1080,configurable:true});
  Object.defineProperty(root.querySelector('.ft-toolbar'),'offsetHeight',{value:48});
  let requests=0,exits=0;
  const changed=()=>document.dispatchEvent(new window.Event('fullscreenchange'));
  document.exitFullscreen=async()=>{exits++;document.fullscreenElement=null;changed();};
  if(native)root.requestFullscreen=async()=>{requests++;document.fullscreenElement=root;changed();};
  const controller=bindTimelineFullscreen(root,{tr:he=>he});
  const click=()=>button.dispatchEvent(new window.Event('click',{bubbles:true}));
  const key=key=>{const event=new window.Event('keydown',{cancelable:true});event.key=key;document.dispatchEvent(event);return event;};
  return {document,window,root,button,world,controller,click,key,changed,requests:()=>requests,exits:()=>exits};
}

test('fullscreen toggles the mounted timeline, fills the screen and restores scroll and zoom state',async()=>{
  const h=harness();
  assert.equal(h.button.getAttribute('aria-label'),'מסך מלא');
  h.click();
  assert.equal(h.requests(),1);assert.equal(h.document.fullscreenElement,h.root);
  assert.equal(h.root.classList.contains('is-fullscreen'),true);
  assert.equal(h.button.getAttribute('aria-pressed'),'true');
  assert.equal(h.button.textContent,'יציאה ממסך מלא');
  assert.ok(Number(h.root.style.getPropertyValue('--ft-fullscreen-scale'))>1.5);
  assert.equal(h.document.body.style.overflow,'hidden');
  h.click();await Promise.resolve();
  assert.equal(h.exits(),1);assert.equal(h.document.fullscreenElement,null);
  assert.equal(h.root.classList.contains('is-fullscreen'),false);
  assert.equal(h.document.body.style.overflow,'auto');
  assert.equal(h.button.getAttribute('aria-pressed'),'false');
  assert.equal(h.root.querySelector('[data-overview-world]'),h.world);
  assert.equal(h.world.style.transform,'translateX(-200px)');
});

test('browser fullscreen exit and Escape both return to the ordinary timeline',()=>{
  const h=harness();h.click();
  h.document.fullscreenElement=null;h.changed();
  assert.equal(h.root.classList.contains('is-fullscreen'),false);
  assert.equal(h.button.textContent,'מסך מלא');
  h.click();assert.equal(h.key('Escape').defaultPrevented,true);
  assert.equal(h.root.classList.contains('is-fullscreen'),false);
  assert.equal(h.document.body.style.overflow,'auto');
});

test('unsupported or denied fullscreen keeps an edge-to-edge fallback with a working exit',async()=>{
  for(const request of [undefined,()=>Promise.reject(Error('Denied')),()=>{throw Error('Unavailable');}]){
    const h=harness(false);h.root.requestFullscreen=request;
    h.click();await Promise.resolve();await Promise.resolve();
    assert.equal(h.root.classList.contains('is-fullscreen'),true);
    assert.equal(h.button.getAttribute('aria-label'),'יציאה ממסך מלא');
    h.key('Escape');assert.equal(h.root.classList.contains('is-fullscreen'),false);
    assert.equal(h.document.body.style.overflow,'auto');
  }
});

test('navigation exits immediately, even when a pending native request completes later',async()=>{
  const h=harness(false);let resolve;
  h.root.requestFullscreen=()=>new Promise(done=>{resolve=done;});
  h.click();h.controller.exit({restoreFocus:false});
  assert.equal(h.root.classList.contains('is-fullscreen'),false);
  h.document.fullscreenElement=h.root;resolve();await Promise.resolve();
  assert.equal(h.exits(),1);assert.equal(h.document.fullscreenElement,null);
  assert.equal(h.document.body.style.overflow,'auto');
});
