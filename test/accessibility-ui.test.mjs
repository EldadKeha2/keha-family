import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../public/assets/accessibility.js',import.meta.url),'utf8');
const key='keha-accessibility-v1';
const defaults={text:100,contrast:false,links:false,spacing:false,motion:false,focus:false,clean:false};
const plain=value=>JSON.parse(JSON.stringify(value));

// Model only native DOM methods used by the controller. Dialog focus containment
// and responsive layout remain browser checks, not assertions about this model.
function fixture({saved=null,english=false,osMotion=false,storageBlocked=false}={}){
  const data=new Map(saved===null?[]:[[key,saved]]),writes=[],events=[];
  const document={activeElement:null,addEventListener(type,fn){if(type==='DOMContentLoaded')this.init=fn;},getElementById:id=>nodes.get(id),createElement:tag=>new Element(tag)};
  class Element extends EventTarget{
    constructor(tag='div'){super();this.tagName=tag;this.attributes=new Map();this.children=new Map();this.dataset={};this.textContent='';this.hidden=false;this.open=false;this.value='';this.modalCalls=0;this.style={values:new Map(),setProperty(name,value){this.values.set(name,value);}};}
    setAttribute(name,value){this.attributes.set(name,String(value));}
    getAttribute(name){return this.attributes.get(name)??null;}
    hasAttribute(name){return this.attributes.has(name);}
    toggleAttribute(name,on){if(on)this.attributes.set(name,'');else this.attributes.delete(name);return on;}
    focus(){document.activeElement=this;}
    scrollIntoView(options){this.scrollOptions=options;}
    append(child){this.children.set('#'+child.id,child);nodes.set(child.id,child);}
    closest(selector){return selector==='[data-a11y-option]'&&this.dataset.a11yOption?this:null;}
    querySelector(selector){return this.children.get(selector)??null;}
    querySelectorAll(selector){return selector==='[data-a11y-option]'?this.options:[];}
    showModal(){this.open=true;this.modalCalls++;}
    close(){this.open=false;this.dispatchEvent(new Event('close'));}
    set innerHTML(value){
      this.html=value;
      if(this.tagName!=='dialog')return;
      for(const selector of ['[data-a11y-size]','[data-a11y-os-motion]','.a11y-status','.a11y-close','.a11y-reset','.a11y-directory'])this.children.set(selector,new Element());
      this.options=[];
      for(const match of value.matchAll(/data-a11y-option="([^"]+)"[^>]*>[\s\S]*?<strong>([^<]+)<\/strong>/g)){
        const button=new Element('button');button.dataset.a11yOption=match[1];const title=new Element('strong');title.textContent=match[2];button.children.set('strong',title);this.options.push(button);
      }
    }
    get innerHTML(){return this.html;}
  }
  const nodes=new Map(['accessibilityButton','skipToContent','mainContent'].map(id=>[id,new Element()]));
  nodes.get('accessibilityButton').setAttribute('aria-expanded','false');
  document.documentElement=new Element('html');document.body=new Element('body');
  const window=new EventTarget();window.FamilyI18n={isEnglish:english};
  const dispatch=window.dispatchEvent.bind(window);window.dispatchEvent=event=>{events.push(event);return dispatch(event);};
  const motion=new EventTarget();motion.matches=osMotion;
  const localStorage={getItem(name){if(storageBlocked)throw Error('Storage denied');return data.get(name)??null;},setItem(name,value){if(storageBlocked)throw Error('Storage denied');data.set(name,value);writes.push({name,value});}};
  const location={hash:'#person/yona'};
  const context=vm.createContext({window,document,localStorage,matchMedia:()=>motion,Event,CustomEvent,location});
  vm.runInContext(source,context);document.init();
  const panel=nodes.get('accessibilityPanel'),root=document.documentElement,api=window.FamilyAccessibility;
  function emit(element,type,target=element){const event=new Event(type);Object.defineProperty(event,'target',{value:target});element.dispatchEvent(event);}
  const option=name=>panel.options.find(button=>button.dataset.a11yOption===name);
  return {api,root,panel,window,motion,nodes,data,writes,events,document,location,
    toggle(name){emit(panel,'click',option(name));},
    size(value){const select=panel.querySelector('[data-a11y-size]');select.value=String(value);emit(select,'change');},
    click(selector){emit(selector==='trigger'?nodes.get('accessibilityButton'):panel.querySelector(selector),'click');},
    storage(name,value){const event=new Event('storage');Object.assign(event,{key:name,newValue:value});window.dispatchEvent(event);},
    systemMotion(value){motion.matches=value;motion.dispatchEvent(new Event('change'));},
    option,emit};
}

test('accessibility is opt-in and does not persist or activate a mode on first visit',()=>{
  const f=fixture();assert.deepEqual(plain(f.api.getSettings()),defaults);assert.equal(f.writes.length,0);
  assert.equal(f.root.style.values.get('--a11y-text-scale'),'1');
  for(const name of ['active','text','contrast','links','spacing','motion','focus','clean'])assert.equal(f.root.hasAttribute('data-a11y-'+name),false,name);
  assert.equal(f.panel.open,false);assert.equal(f.nodes.get('accessibilityButton').getAttribute('aria-label'),'נגישות');
  assert.match(f.panel.innerHTML,/aria-labelledby|a11yTitle/);assert.equal(f.panel.getAttribute('aria-labelledby'),'a11yTitle');
});

test('stored preferences are restored before use, bounded and copied rather than exposed for mutation',()=>{
  const f=fixture({saved:JSON.stringify({text:175,contrast:true,links:'true',motion:1,clean:true,unknown:true})});
  assert.deepEqual(plain(f.api.getSettings()),{...defaults,text:175,contrast:true,clean:true});
  assert.equal(f.root.style.values.get('--a11y-text-scale'),'1.75');assert.equal(f.option('contrast').getAttribute('aria-pressed'),'true');
  const copy=f.api.getSettings();copy.text=200;copy.contrast=false;assert.equal(f.api.getSettings().text,175);assert.equal(f.api.getSettings().contrast,true);
  assert.equal(fixture({saved:JSON.stringify({text:999,contrast:[]})}).api.getSettings().text,100);
  assert.deepEqual(plain(fixture({saved:'{malformed'}).api.getSettings()),defaults);
});

test('independent toggles persist and announce their current state without changing other choices',()=>{
  const f=fixture();f.toggle('contrast');f.toggle('links');f.toggle('contrast');
  assert.equal(f.api.getSettings().contrast,false);assert.equal(f.api.getSettings().links,true);
  assert.equal(f.option('contrast').getAttribute('aria-pressed'),'false');assert.equal(f.option('links').getAttribute('aria-pressed'),'true');
  assert.equal(f.root.hasAttribute('data-a11y-links'),true);assert.equal(f.root.hasAttribute('data-a11y-contrast'),false);
  assert.equal(f.panel.querySelector('.a11y-status').textContent,'ניגודיות גבוהה: כבוי');
  assert.equal(JSON.parse(f.data.get(key)).links,true);assert.equal(f.writes.length,3);assert.match(f.nodes.get('accessibilityButton').getAttribute('aria-label'),/התאמות פעילות/);
});

test('all offered text sizes affect the scale, survive reopening and reset with the other settings',()=>{
  const f=fixture();assert.deepEqual([...f.panel.innerHTML.matchAll(/<option value="(\d+)"/g)].map(match=>Number(match[1])),[100,115,130,150,175,200]);
  for(const size of [115,130,150,175,200]){f.size(size);assert.equal(f.root.style.values.get('--a11y-text-scale'),String(size/100));assert.equal(f.root.hasAttribute('data-a11y-text'),true);}
  f.toggle('spacing');const reopened=fixture({saved:f.data.get(key)});assert.equal(reopened.api.getSettings().text,200);assert.equal(reopened.api.getSettings().spacing,true);
  f.click('.a11y-reset');assert.deepEqual(plain(f.api.getSettings()),defaults);assert.deepEqual(JSON.parse(f.data.get(key)),defaults);assert.equal(f.root.hasAttribute('data-a11y-active'),false);assert.equal(f.root.hasAttribute('data-a11y-text'),false);
});

test('storage denial does not break adjustments, reset, or panel controls',()=>{
  const f=fixture({storageBlocked:true});f.toggle('focus');f.size(150);assert.equal(f.api.getSettings().focus,true);assert.equal(f.api.getSettings().text,150);
  f.click('trigger');assert.equal(f.panel.open,true);f.click('.a11y-close');assert.equal(f.panel.open,false);
  f.click('.a11y-reset');assert.deepEqual(plain(f.api.getSettings()),defaults);
});

test('device motion preferences are respected immediately and remain respected after reset',()=>{
  const f=fixture({osMotion:true});assert.equal(f.api.isReducedMotion(),true);assert.equal(f.api.getSettings().motion,false);assert.equal(f.root.hasAttribute('data-a11y-active'),false);
  assert.equal(f.panel.querySelector('[data-a11y-os-motion]').hidden,false);
  f.toggle('motion');f.toggle('motion');assert.equal(f.api.isReducedMotion(),true);
  f.click('.a11y-reset');assert.equal(f.api.isReducedMotion(),true);assert.equal(f.root.hasAttribute('data-a11y-motion'),true);
  f.systemMotion(false);assert.equal(f.api.isReducedMotion(),false);assert.equal(f.root.hasAttribute('data-a11y-motion'),false);
  f.toggle('motion');f.systemMotion(true);f.systemMotion(false);assert.equal(f.api.isReducedMotion(),true,'Explicit visitor setting remains active when device changes');
  const changes=f.events.filter(event=>event.type==='family-accessibility-changed');assert.equal(changes.at(-1).detail.reduceMotion,true);
});

test('cross-tab updates and storage clear synchronize preferences without writing them back',()=>{
  const f=fixture();f.storage(key,JSON.stringify({text:130,motion:true,clean:true}));
  assert.equal(f.api.getSettings().text,130);assert.equal(f.api.isReducedMotion(),true);assert.equal(f.root.hasAttribute('data-a11y-clean'),true);assert.equal(f.writes.length,0);
  f.storage('other-setting',JSON.stringify({text:200}));assert.equal(f.api.getSettings().text,130);
  f.storage(key,'broken-json');assert.equal(f.api.getSettings().text,130);
  f.storage(null,null);assert.deepEqual(plain(f.api.getSettings()),defaults);assert.equal(f.writes.length,0);
  f.storage(key,null);assert.deepEqual(plain(f.api.getSettings()),defaults);
});

test('native dialog lifecycle exposes expansion state, avoids duplicate opens and restores trigger focus',()=>{
  const f=fixture(),trigger=f.nodes.get('accessibilityButton');f.click('trigger');assert.equal(f.panel.open,true);assert.equal(trigger.getAttribute('aria-expanded'),'true');assert.equal(f.document.activeElement,f.panel.querySelector('.a11y-close'));
  f.click('trigger');assert.equal(f.panel.modalCalls,1);f.click('.a11y-close');assert.equal(f.panel.open,false);assert.equal(trigger.getAttribute('aria-expanded'),'false');assert.equal(f.document.activeElement,trigger);
  f.click('trigger');f.panel.close();assert.equal(trigger.getAttribute('aria-expanded'),'false');assert.equal(f.document.activeElement,trigger);
  f.click('trigger');f.click('.a11y-directory');assert.equal(f.panel.open,false);
});

test('skip link focuses and reveals main content without replacing the current app route',()=>{
  const f=fixture(),event=new Event('click',{cancelable:true});f.nodes.get('skipToContent').dispatchEvent(event);
  assert.equal(event.defaultPrevented,true);assert.equal(f.location.hash,'#person/yona');assert.equal(f.document.activeElement,f.nodes.get('mainContent'));assert.deepEqual(plain(f.nodes.get('mainContent').scrollOptions),{block:'start',behavior:'instant'});
});

test('English options, help, announcements and trigger labels are fully localized',()=>{
  const f=fixture({english:true});assert.equal(f.nodes.get('accessibilityButton').getAttribute('aria-label'),'Accessibility');assert.equal(f.nodes.get('skipToContent').textContent,'Skip to main content');
  assert.match(f.panel.innerHTML,/Accessibility options/);assert.match(f.panel.innerHTML,/Close accessibility options/);assert.match(f.panel.innerHTML,/Text size/);assert.match(f.panel.innerHTML,/Reset adjustments/);assert.doesNotMatch(f.panel.innerHTML,/[\u0590-\u05ff]/);
  f.toggle('contrast');assert.equal(f.panel.querySelector('.a11y-status').textContent,'High contrast: On');assert.equal(f.nodes.get('accessibilityButton').getAttribute('aria-label'),'Accessibility, adjustments active');
  f.size(200);assert.equal(f.panel.querySelector('.a11y-status').textContent,'Text size changed to 200%');
});
