import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';
import family from '../src/family.mjs';
import * as familyHelpers from '../public/assets/gallery-family.mjs';
import * as labels from '../public/assets/photo-labels-catalog.mjs';
const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
const sources=await Promise.all(['person-gallery.js','people.js','media-selection.js'].map(name=>readFile(new URL('../public/assets/'+name,import.meta.url),'utf8')));
const flush=async()=>{for(let n=0;n<6;n++)await new Promise(resolve=>setImmediate(resolve));};
async function fixture(english=false,{phone=false}={}){
 const {document,window:dom}=parseHTML(html),callbacks=new Map(),frames=[],requests=[],downloads=[],opened=[];
 document.querySelectorAll('dialog').forEach(node=>node.open=false);
 dom.HTMLElement.prototype.focus=function(){};dom.HTMLElement.prototype.scrollIntoView=function(){};dom.HTMLElement.prototype.submit=function(){downloads.push(JSON.parse(this.querySelector('[name=ids]').value));};
 const nativeAdd=document.addEventListener.bind(document);document.addEventListener=(event,callback,...args)=>{if(!callbacks.has(event))callbacks.set(event,[]);callbacks.get(event).push(callback);nativeAdd(event,callback,...args);};
 Object.defineProperty(document,'readyState',{value:'loading'});
 const photo=id=>({id,kind:'photo',mime:'image/jpeg',src:'/media/'+id,name:'Photo '+id}),photos=[photo('a'.repeat(32)),photo('b'.repeat(32)),photo('c'.repeat(32))],video={id:'d'.repeat(32),kind:'video',mime:'video/mp4',src:'/media/d',caption:'Family video'};
 const window={FAMILY_DATA:family,FAMILY_API_TOKEN:'test',FamilyPeopleRoster:{snapshot:()=>Object.values(family.people),load:async()=>{},subscribe(){}},FamilyI18n:{isEnglish:english,locale:english?'en':'he',language:english?'en':'he',error:String,mediaName:item=>item.name||'',personName:p=>typeof p==='string'?family.people[p]?.name||p:p.name,searchNames:p=>p.name,fetch:async path=>{
  requests.push(path);if(path.includes('/selection?'))return Response.json({ids:photos.map(p=>p.id)});
  const params=new URL(path,'https://family.test').searchParams,page=Number(params.get('photos')||1),filtered=Boolean(params.get('photosLabels'));
  return Response.json({person:{...family.people.eldad},revision:'revision',albums:{photos:{items:filtered?[]:page===2?[photos[2]]:photos.slice(0,2),page,pages:2,total:filtered?0:3,size:2},videos:{items:[video],page:1,pages:1,total:1,size:100},documents:{items:[],page:1,pages:1,total:0,size:10}}});
 }},FamilyMedia:{register(){},open:(...args)=>opened.push(args)},addEventListener(){},scrollTo(){}};
 window.FamilyApp={getPerson:id=>family.people[id],getPersonSummary:id=>family.people[id],nameOf:id=>family.people[id].name,birthdayHTML:()=>'',updatePerson(){},getView:()=> 'person',setView:view=>window.FamilyPeople.activate(view),toast(){},apiEnabled:true};
 const context=vm.createContext({window,document,location:{hash:'#person/eldad',origin:'https://family.test'},history:{},familyHelpers,labels,loadPhotoLabelCatalog:async()=>{},...labels,Response,URL,URLSearchParams,console,MutationObserver:class{observe(){}},requestAnimationFrame:fn=>(frames.push(fn),frames.length),setTimeout,clearTimeout,setInterval:()=>0,matchMedia:query=>({matches:query==='(max-width:700px)'?phone:!phone})});
 vm.runInContext(sources[0].replace("import('./gallery-family.mjs?v=2')",'Promise.resolve(familyHelpers)').replace("import('./photo-labels-catalog.mjs?v=2')",'Promise.resolve(labels)'),context);
 vm.runInContext(sources[1],context);vm.runInContext(sources[2].replace(/^import[^\n]+\n/gm,''),context);
 for(const callback of callbacks.get('DOMContentLoaded'))callback();await flush();
 const paint=()=>{while(frames.length)frames.shift()();};paint();
 const click=target=>{const event={target,preventDefault(){},stopImmediatePropagation(){this.stopped=true;}};for(const fn of callbacks.get('click')||[]){fn(event);if(event.stopped)break;}};
 const change=node=>node.dispatchEvent(new dom.Event('change',{bubbles:true}));
 return {document,window,photos,video,requests,downloads,opened,paint,click,change,root:document.getElementById('personPageContent')};
}
test('personal photos and videos reuse gallery options without tagging-state tabs and keep independent sorting',async()=>{
 for(const english of [false,true]){
  const f=await fixture(english),root=f.root;
  assert.equal(root.querySelectorAll('[data-gallery-filter]').length,0);assert.equal(root.querySelectorAll('[data-person-grid]').length,2);
  for(const key of ['photos','videos']){
   const select=root.querySelector('[data-person-size="'+key+'"]');assert.deepEqual([...select.querySelectorAll('option')].map(o=>o.value),['10','20','50','100','200','300','400','500','all']);assert.equal(select.querySelector('[selected]').value,'10');
   assert.equal(root.querySelector('[data-person-sort="'+key+'"] [selected]').value,'random');assert.ok(root.querySelector('#personAlbum-'+key+' [data-selection-start]'));
  }
  await f.window.FamilyPeople.refineAlbum('videos',{sort:'taken-asc',size:'all'});f.paint();
  assert.equal(root.querySelector('[data-person-sort="videos"] [selected]').value,'taken-asc');assert.equal(root.querySelector('[data-person-size="videos"] [selected]').value,'all');assert.equal(root.querySelector('[data-person-sort="photos"] [selected]').value,'random');
  assert.ok(f.requests.at(-1).includes('videosSort=taken-asc'));assert.ok(f.requests.at(-1).includes('videosSize=all'));
 }
});
test('personal selection stays on the same grid through paging, selects every album page, and downloads those IDs',async()=>{
 const f=await fixture(),grid=f.root.querySelector('[data-person-grid="photos"]');
 f.root.querySelector('#personAlbum-photos [data-selection-start]').click();f.click(grid.querySelector('[data-person-item]'));assert.equal(f.window.FamilyMediaSelection.ids().length,1);assert.equal(f.opened.length,0);
 f.root.querySelector('#personAlbum-photos [data-person-page][data-step="1"]').click();await flush();f.paint();assert.equal(f.root.querySelector('[data-person-grid="photos"]'),grid);assert.equal(f.window.FamilyMediaSelection.ids().length,1);
 f.document.querySelector('[data-selection-all]').click();await flush();assert.deepEqual(new Set(f.window.FamilyMediaSelection.ids()),new Set(f.photos.map(p=>p.id)));assert.ok(f.requests.at(-1).includes('/selection?'));
 f.document.querySelector('[data-selection-download]').click();assert.deepEqual(new Set(f.downloads[0]),new Set(f.photos.map(p=>p.id)));
});
test('personal filter choices stay in their own album and clear a stale selection',async()=>{
 const f=await fixture(),root=f.root;
 root.querySelector('#personAlbum-photos [data-selection-start]').click();f.click(root.querySelector('[data-person-grid="photos"] [data-person-item]'));
 root.querySelector('[data-person-filter-toggle="photos"]').click();await flush();f.paint();
 const panel=root.querySelector('[data-person-filter-panel="photos"]');assert.equal(panel.hidden,false);assert.equal(root.querySelector('[data-person-filter-panel="videos"]').hidden,true);
 const label=panel.querySelector('input[data-person-refine="labels"][value="holidays"]');assert.ok(label);label.checked=true;f.change(label);await flush();f.paint();
 assert.equal(f.window.FamilyMediaSelection.ids().length,0);assert.ok(f.requests.at(-1).includes('photosLabels=holidays'));assert.ok(!f.requests.at(-1).includes('videosLabels=holidays'));assert.match(root.querySelector('#personAlbum-photos .person-album-empty').textContent,/בסינון/);
});

test('phone profile albums request ten items while the shared gallery keeps its existing sizes',async()=>{
 const f=await fixture(false,{phone:true});
 for(const key of ['photos','videos']){
  assert.equal(f.root.querySelector('[data-person-size="'+key+'"] [selected]').value,'10');
  assert.ok(f.requests[0].includes(key+'Size=10'));
 }
 assert.deepEqual([...f.document.querySelectorAll('#galleryView [data-gallery-size] option')].slice(0,6).map(o=>o.value),['100','200','300','400','500','all']);
});
test('desktop photo row density starts at three and changing it keeps the selection and current page without fetching',async()=>{
 const f=await fixture(),root=f.root,grid=root.querySelector('[data-person-grid="photos"]'),columns=root.querySelector('[data-person-photo-columns]');
 assert.equal(columns.querySelector('[selected]').value,'3');assert.equal(grid.style.getPropertyValue('--person-photo-columns'),'3');
 assert.equal(root.querySelector('#personAlbum-videos [data-person-photo-columns]'),null);
 root.querySelector('#personAlbum-photos [data-selection-start]').click();f.click(grid.querySelector('[data-person-item]'));const requests=f.requests.length;
 columns.querySelector('[selected]').removeAttribute('selected');columns.querySelector('[value="5"]').setAttribute('selected','');f.change(columns);f.paint();
 assert.equal(grid.style.getPropertyValue('--person-photo-columns'),'5');assert.equal(f.window.FamilyMediaSelection.ids().length,1);assert.equal(f.requests.length,requests);
 f.window.FamilyPeople.render();f.paint();assert.equal(root.querySelector('[data-person-grid="photos"]'),grid);assert.equal(root.querySelector('[data-person-photo-columns] [selected]').value,'5');assert.equal(f.window.FamilyMediaSelection.ids().length,1);
});
