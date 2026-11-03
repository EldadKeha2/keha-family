import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import family from '../src/family.mjs';
import {PUBLIC_WRITE_TOKEN} from '../src/worker.mjs';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
test('static assets are served without Worker quota consumption',()=>{
  const config=JSON.parse(read('../wrangler.jsonc'));
  assert.deepEqual(config.assets.run_worker_first,['/api/*','/media/*','/family-data.js']);
  assert.equal(config.assets.directory,'./public');
  assert.equal(config.build.command,'node scripts/build-family-fallback.mjs');
});
test('maintenance overlay has no manually navigable page or trigger',()=>{
  const html=read('../public/index.html');
  const js=read('../public/assets/maintenance.js');
  const css=read('../public/assets/maintenance.css');
  assert.match(html,/assets\/maintenance\.js/);
  assert.match(html,/assets\/maintenance\.css/);
  assert.doesNotMatch(html,/<a\b[^>]*href="[^"]*maintenance/i);
  assert.match(js,/response\.status/);
  assert.match(js,/family-data/);
  assert.match(js,/120000/);
  assert.doesNotMatch(js,/URLSearchParams|location\.hash|query\.get\(/);
  assert.match(js,/GRANDMA is working/);
  assert.match(js,/אנחנו מתנצלים/);
  assert.match(css,/prefers-reduced-motion/);
});

test('static fallback is loaded before live data and includes the current public tree without replacing live values',()=>{
  const html=read('../public/index.html'),fallback=read('../public/assets/family-fallback.js');
  assert.ok(html.indexOf('assets/maintenance.js')<html.indexOf('assets/family-fallback.js'));
  assert.ok(html.indexOf('assets/family-fallback.js')<html.indexOf('src="family-data.js"'));
  assert.ok(html.indexOf('src="family-data.js"')<html.indexOf('assets/app.js'));
  const context=vm.createContext({window:{}});vm.runInContext(fallback,context);
  assert.deepEqual(JSON.parse(JSON.stringify(context.window.FAMILY_DATA)),family);assert.equal(context.window.FAMILY_API_TOKEN,PUBLIC_WRITE_TOKEN);assert.equal(context.window.FAMILY_DATA_AVAILABLE,false);
  context.window.FAMILY_DATA.people.mila.birthday='9.7.2022';context.window.FAMILY_DATA_AVAILABLE=true;vm.runInContext(fallback,context);
  assert.equal(context.window.FAMILY_DATA.people.mila.birthday,'9.7.2022');assert.equal(context.window.FAMILY_DATA_AVAILABLE,true);
});

class Element extends EventTarget{
  constructor(doc){super();this.doc=doc;this.style={};this.hidden=false;this.inert=false;this.isConnected=true;this.children=new Map();this.attributes=new Map();this.classList={values:new Set(),add(v){this.values.add(v);},remove(v){this.values.delete(v);},contains(v){return this.values.has(v);}};}
  setAttribute(k,v){this.attributes.set(k,v);}
  querySelector(selector){if(!this.children.has(selector))this.children.set(selector,new Element(this.doc));return this.children.get(selector);}
  append(node){if(node.id)this.doc.nodes.set(node.id,node);}
  prepend(node){this.append(node);}
  focus(){this.doc.activeElement=this;}
}
function browserFixture({available=true,session=new Map(),images=[],fetch:fetcher=async()=>Response.json({available:false}),storageWorks=true,readyState='loading',initialData={people:{}}}={}){
  const document=new EventTarget();document.nodes=new Map();document.readyState=readyState;document.visibilityState='visible';document.documentElement=new Element(document);document.body=new Element(document);document.activeElement=new Element(document);const root=new Element(document);
  document.createElement=()=>new Element(document);document.getElementById=id=>document.nodes.get(id)||null;document.querySelector=selector=>selector==='.page-shell'?root:null;document.querySelectorAll=()=>images;
  class XHR extends EventTarget{open(method,url){this.method=method;this.url=url;}getResponseHeader(name){return this.headers?.get(name)||null;}}
  const intervals=new Map(),calls=[];let reloads=0,nextTimer=1;
  const window=new EventTarget();window.FAMILY_DATA=initialData;window.FAMILY_DATA_AVAILABLE=available;window.XMLHttpRequest=XHR;window.fetch=async(...args)=>{calls.push(args);return fetcher(...args);};
  const location={href:'https://family.example/?lang=he',origin:'https://family.example',reload(){reloads++;}};
  const storage={getItem(k){if(!storageWorks)throw Error('Storage blocked');return session.get(k)||null;},setItem(k,v){if(!storageWorks)throw Error('Storage blocked');session.set(k,v);},removeItem(k){session.delete(k);}};
  vm.runInContext(read('../public/assets/maintenance.js'),vm.createContext({window,document,location,sessionStorage:storage,URL,WeakMap,setInterval(fn,ms){const id=nextTimer++;intervals.set(id,{fn,ms});return id;},clearInterval(id){intervals.delete(id);}}));
  return {window,document,root,calls,session,intervals,get reloads(){return reloads;},startup(){document.dispatchEvent(new Event('DOMContentLoaded'));},screen:()=>document.getElementById('familyMaintenanceScreen'),continue(){document.getElementById('familyMaintenanceScreen').querySelector('.family-maintenance-enter').dispatchEvent(new Event('click'));},emit(name,properties){const event=new Event(name);for(const [k,v]of Object.entries(properties))Object.defineProperty(event,k,{value:v});window.dispatchEvent(event);},async recovery(){for(const timer of intervals.values())await timer.fn();}};
}
test('failed or partial bootstrap raises the bilingual screen and continuation restores navigation once per tab',async()=>{
  const f=browserFixture({available:false});f.startup();assert.equal(f.window.FamilyMaintenance.isActive(),true);assert.equal(f.root.inert,true);
  const screen=f.screen();assert.match(screen.innerHTML,/המשך לאתר בכל זאת/);assert.match(screen.innerHTML,/Continue to the website anyway/);assert.match(screen.innerHTML,/חלק מהתמונות, המידע והאפשרויות/);assert.match(screen.innerHTML,/photos, information and features/);assert.match(screen.innerHTML,/grandma-construction\.png/);assert.equal(f.document.activeElement,screen.querySelector('.family-maintenance-enter'));
  f.continue();assert.equal(f.window.FamilyMaintenance.isActive(),false);assert.equal(f.root.inert,false);assert.equal(screen.hidden,true);assert.equal(f.document.documentElement.classList.contains('family-maintenance-active'),false);assert.ok(f.document.getElementById('familyLimitedNotice'));assert.equal(f.intervals.size,0);
  const again=browserFixture({available:false,session:f.session});again.startup();assert.equal(again.window.FamilyMaintenance.isActive(),false);assert.equal(again.root.inert,false);assert.ok(again.document.getElementById('familyLimitedNotice'));assert.deepEqual(Object.keys(again.window.FamilyMaintenance),['isActive']);
});
test('healthy deferred data is allowed to finish before startup decides to show a warning',()=>{
  const f=browserFixture({readyState:'interactive',initialData:null});assert.equal(f.window.FamilyMaintenance.isActive(),false);assert.equal(f.screen(),null);
  f.window.FAMILY_DATA={people:{}};f.startup();assert.equal(f.window.FamilyMaintenance.isActive(),false);
});
test('failed services and quota responses trigger the screen without consuming or replacing the API response',async()=>{
  for(const status of [402,429,500,502,503,504,507]){
    const response=new Response('Original response',{status}),f=browserFixture({fetch:async()=>response});f.startup();assert.equal(f.window.FamilyMaintenance.isActive(),false);
    const returned=await f.window.fetch('/api/media');assert.equal(returned,response);assert.equal(await returned.text(),'Original response');assert.equal(f.window.FamilyMaintenance.isActive(),true,'Status '+status);
    f.continue();await f.window.fetch('/api/collections/photos');assert.equal(f.window.FamilyMaintenance.isActive(),false,'Further failures must not reopen the acknowledged screen');
  }
  const html=browserFixture({fetch:async()=>new Response('<h1>Error 1027</h1>',{headers:{'Content-Type':'text/html'}})});await html.window.fetch('/api/media');assert.equal(html.window.FamilyMaintenance.isActive(),true);
  const marker=browserFixture({fetch:async()=>Response.json({error:'limited'},{status:403,headers:{'X-Family-Storage-Limit':'daily'}})});await marker.window.fetch('/api/media');assert.equal(marker.window.FamilyMaintenance.isActive(),true);
});
test('validation errors, missing records, external failures and intentional cancellation do not open maintenance',async()=>{
  for(const status of [400,401,403,404,409,413,415]){const f=browserFixture({fetch:async()=>Response.json({error:'Validation'},{status})});await f.window.fetch('/api/people/mila/birthday');assert.equal(f.window.FamilyMaintenance.isActive(),false);}
  const external=browserFixture({fetch:async()=>new Response('Failed',{status:503})});await external.window.fetch('https://external.example/api/media');assert.equal(external.window.FamilyMaintenance.isActive(),false);
  const aborted=browserFixture({fetch:async()=>{throw new DOMException('Cancelled','AbortError');}});await assert.rejects(()=>aborted.window.fetch('/api/media'),{name:'AbortError'});assert.equal(aborted.window.FamilyMaintenance.isActive(),false);
  const offline=browserFixture({fetch:async()=>{throw new TypeError('Network unavailable');}});await assert.rejects(()=>offline.window.fetch('/api/media'));assert.equal(offline.window.FamilyMaintenance.isActive(),true);
});
test('uploads, broken family media and bootstrap script failures use the same acknowledgement',()=>{
  for(const status of [429,500,503]){const f=browserFixture(),xhr=new f.window.XMLHttpRequest();xhr.open('POST','/api/collections/gallery/upload');xhr.status=status;xhr.dispatchEvent(new Event('load'));assert.equal(f.window.FamilyMaintenance.isActive(),true);}
  const offline=browserFixture(),xhr=new offline.window.XMLHttpRequest();xhr.open('POST','/api/people/mila/photos');xhr.dispatchEvent(new Event('error'));assert.equal(offline.window.FamilyMaintenance.isActive(),true);
  const reused=browserFixture(),request=new reused.window.XMLHttpRequest();request.open('POST','/api/collections/gallery/upload');request.open('POST','https://external.example/upload');request.status=503;request.dispatchEvent(new Event('load'));assert.equal(reused.window.FamilyMaintenance.isActive(),false);
  for(const tagName of ['IMG','VIDEO','IFRAME']){const f=browserFixture();f.emit('error',{target:{tagName,src:'https://family.example/media/1234'}});assert.equal(f.window.FamilyMaintenance.isActive(),true);}
  const bootstrap=browserFixture();bootstrap.emit('error',{target:{tagName:'SCRIPT',src:'https://family.example/family-data.js'}});assert.equal(bootstrap.window.FamilyMaintenance.isActive(),true);
  const missingIcon=browserFixture();missingIcon.emit('error',{target:{tagName:'IMG',src:'https://family.example/assets/icon.png'}});assert.equal(missingIcon.window.FamilyMaintenance.isActive(),false);
  const iframe=browserFixture();iframe.emit('load',{target:{tagName:'IFRAME',src:'https://family.example/media/123',contentDocument:{contentType:'application/json',body:{textContent:'{"error":"Unavailable"}'}}}});assert.equal(iframe.window.FamilyMaintenance.isActive(),true);
});
test('acknowledgement works when browser storage is blocked, and recovery requires a real health result',async()=>{
  const f=browserFixture({available:false,storageWorks:false});f.startup();f.continue();f.emit('error',{target:{tagName:'IMG',src:'https://family.example/media/123'}});assert.equal(f.window.FamilyMaintenance.isActive(),false);
  const configOnly=browserFixture({available:false,fetch:async()=>Response.json({database:true})});configOnly.startup();await configOnly.recovery();assert.equal(configOnly.reloads,0);
  const recovered=browserFixture({available:false,fetch:async()=>Response.json({available:true})});recovered.startup();await recovered.recovery();assert.equal(recovered.reloads,1);assert.equal(recovered.calls[0][0],'/api/health');
});
