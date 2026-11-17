import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';

const source=await readFile(new URL('../public/assets/desktop-masthead.js',import.meta.url),'utf8');
function fixture({preferences=false,ltr=false}={}){
  const {window,document}=parseHTML('<html><body><div class="edge-left"></div><div class="edge-right"></div><div class="page-shell"><header class="site-header"><div data-home-install-actions><form></form><button data-desktop-install-action></button><button data-desktop-bookmark-action></button><button data-home-install-share></button><button data-desktop-refresh></button></div></header><main>Page content</main></div></body></html>');
  document.readyState='complete';
  const header=document.querySelector('header'),actions=document.querySelector('[data-home-install-actions]'),shell=header.parentElement;
  let controlsStart=500;
  const rect=(left,width)=>ltr?{left:1200-left-width,right:1200-left,width}:{left,right:left+width,width};
  if(preferences){
    for(const [tag,selector,left,width] of [['div','desktop-menu',40,44],['div','language-selector',220,120],['button','accessibilityButton',100,110]]){
      const element=document.createElement(tag);if(selector==='accessibilityButton')element.id=selector;else element.className=selector;
      element.getBoundingClientRect=()=>rect(left,width);header.append(element);
    }
  }
  let available=640,scale=1,desktop=true,frame,observer;
  Object.defineProperty(shell,'clientWidth',{get:()=>1680});
  Object.defineProperty(actions,'clientWidth',{get:()=>available});
  document.querySelector('.edge-left').getBoundingClientRect=()=>({right:44});
  document.querySelector('.edge-right').getBoundingClientRect=()=>({left:1860});
  actions.querySelector('form').getBoundingClientRect=()=>rect(controlsStart,120);
  const selectors=['data-desktop-install-action','data-desktop-bookmark-action','data-home-install-share','data-desktop-refresh'];
  const widths=[160,150,80,100];
  selectors.forEach((name,index)=>{
    const button=actions.querySelector('['+name+']');
    button.getBoundingClientRect=()=>rect(controlsStart+120+index*160,button.hidden?0:button.hasAttribute('data-header-icon-only')?44:widths[index]*scale);
  });
  vm.runInNewContext(source,{window,document,matchMedia:()=>({get matches(){return desktop;}}),requestAnimationFrame:fn=>{frame=fn;return 1;},getComputedStyle:element=>element===shell?{paddingLeft:'66px',paddingRight:'66px'}:{columnGap:'6px'},ResizeObserver:class{constructor(callback){observer=callback;}observe(){}}});
  const flush=()=>{const callback=frame;frame=null;callback?.();};
  const resize=width=>{available=width;window.dispatchEvent(new window.Event('resize'));flush();};
  flush();
  return {header,actions,shell,resize,flush,collapsed:()=>selectors.filter(name=>actions.querySelector('['+name+']').hasAttribute('data-header-icon-only')),enlarge(){scale=1.3;window.dispatchEvent(new window.Event('family-accessibility-changed'));flush();},phone(){desktop=false;resize(330);},observe:()=>{observer();flush();},tighten(){controlsStart=380;resize(640);}};
}

test('desktop actions retain all labels whenever they fit and collapse only enough to fit',()=>{
  const f=fixture();assert.deepEqual(f.collapsed(),[]);
  f.resize(480);assert.deepEqual(f.collapsed(),['data-desktop-bookmark-action','data-desktop-refresh']);
  f.resize(640);assert.deepEqual(f.collapsed(),[]);
  f.enlarge();assert.ok(f.collapsed().length>0);
  f.resize(900);assert.deepEqual(f.collapsed(),[]);
});
test('the masthead reaches the ornaments without resizing the page and releases desktop sizing on phones',()=>{
  const f=fixture();
  assert.equal(f.header.style.getPropertyValue('--desktop-masthead-width'),'1816px');
  assert.equal(f.header.style.getPropertyValue('--desktop-masthead-margin'),'-134px');
  assert.equal(f.shell.getAttribute('style'),null);
  f.resize(400);f.phone();assert.deepEqual(f.collapsed(),[]);
  assert.equal(f.header.style.getPropertyValue('--desktop-masthead-width'),undefined);
});
test('a layout observer refits labels when another action becomes hidden',()=>{
  const f=fixture();f.resize(400);assert.ok(f.collapsed().length>0);
  f.actions.querySelector('[data-desktop-bookmark-action]').hidden=true;
  f.observe();assert.ok(f.collapsed().length<3);
});
test('language and accessibility center between the menu and actions, with less spacing when room shrinks',()=>{
  const f=fixture({preferences:true});
  assert.equal(f.header.style.getPropertyValue('--desktop-preferences-offset'),'72px');
  f.observe();assert.equal(f.header.style.getPropertyValue('--desktop-preferences-offset'),'72px');
  f.tighten();assert.equal(f.header.style.getPropertyValue('--desktop-preferences-offset'),'12px');
  f.phone();assert.equal(f.header.style.getPropertyValue('--desktop-preferences-offset'),undefined);
});
test('preference centering mirrors correctly for an English masthead',()=>{
  const f=fixture({preferences:true,ltr:true});
  assert.equal(f.header.style.getPropertyValue('--desktop-preferences-offset'),'-72px');
  f.tighten();assert.equal(f.header.style.getPropertyValue('--desktop-preferences-offset'),'-12px');
});
