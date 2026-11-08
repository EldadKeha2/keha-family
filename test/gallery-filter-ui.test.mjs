import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import family from '../src/family.mjs';
import {familyOptions,familyLabel} from '../public/assets/gallery-family.mjs';

const source=(await readFile(new URL('../public/assets/gallery-filter.js',import.meta.url),'utf8')).replace(/^import[^\n]+\n/,'');
function fixture(english=false){
 const nodes=new Map(),handlers=new Map(),requests=[];let query={filter:'all',query:'',person:'',unit:''};
 class Node{
  constructor(){this.innerHTML='';this.value='';this.dataset={};this.handlers=new Map();this.children=new Map();this.classList={toggle(){}};}
  addEventListener(name,callback){this.handlers.set(name,callback);}
  setAttribute(){}
  querySelector(selector){if(!this.children.has(selector))this.children.set(selector,new Node());return this.children.get(selector);}
  querySelectorAll(){return [];}
 }
 const get=id=>{if(!nodes.has(id))nodes.set(id,new Node());return nodes.get(id);};
 const collection={items:[],count:0,pagination:{person:'',unit:'',query:''}};
 const window={FAMILY_DATA:family,addEventListener(){},FamilyI18n:{isEnglish:english,locale:english?'en-US':'he',personName:p=>english?p.nameEn||p.name:p.name,fetch:async path=>{requests.push(path);return Response.json({people:Object.values(family.people).filter(p=>!p.placeholder)});}},FamilyPortal:{getCollection:()=>collection,galleryQuery:()=>({...query}),refineGallery:value=>{query={...query,...value};collection.pagination={...query};window.FamilyGalleryFilter.render();}}};
 const document={readyState:'complete',getElementById:get,addEventListener:(name,callback)=>{if(!handlers.has(name))handlers.set(name,[]);handlers.get(name).push(callback);}};
 vm.runInNewContext(source,{window,document,familyOptions,familyLabel,URLSearchParams});
 const change=(kind,id,checked)=>get('galleryFilterPanel').handlers.get('change')({target:{dataset:{[kind==='person'?'galleryPerson':'galleryFamily']:id},checked}});
 return {window,get,change,requests,query:()=>query,async open(){await get('galleryFilterToggle').handlers.get('click')();},search(text){get('galleryPersonSearch').value=text;get('galleryPersonSearch').handlers.get('input')();},reset(){get('clearGalleryFilter').handlers.get('click')();}};
}
for(const english of [false,true])test('checkboxes keep independent people and family selections through search, removal and reset '+(english?'English':'Hebrew'),async()=>{
 const f=fixture(english);await f.open();
 assert.equal(f.get('clearGalleryFilter').hidden,true);
 assert.match(f.get('galleryPersonFilter').innerHTML,/type="checkbox"/);
 assert.match(f.get('galleryFamily4').innerHTML,english?/Family of Matan Gandelman/:/המשפחה של מתן גנדלמן/);
 for(const id of ['u-roi','u-naama','u-yarden'])assert.ok(![2,3,4].some(g=>f.get('galleryFamily'+g).innerHTML.includes('data-gallery-family="'+id+'"')));
 f.change('person','yona',true);f.change('person','ruti',true);
 assert.equal(f.get('clearGalleryFilter').hidden,false);
 f.change('family','u-matan-g',true);f.change('family','u-moran',true);f.change('family','u-becker',true);
 assert.equal(f.query().person,'ruti,yona');assert.equal(f.query().unit,'u-becker,u-matan-g,u-moran');
 assert.equal(f.get('galleryPeopleChoiceCount').textContent,'(2)');
 for(const generation of [2,3,4])assert.equal(f.get('galleryFamily'+generation+'ChoiceCount').textContent,'(1)');
 f.search(english?'Eldad':'אלדד');
 const html=f.get('galleryPersonFilter').innerHTML;
 assert.match(html,/data-gallery-person="eldad"/);assert.match(html,/data-gallery-person="yona" checked/);assert.match(html,/data-gallery-person="ruti" checked/);
 f.change('person','eldad',true);f.change('person','yona',false);f.change('family','u-moran',false);
 assert.equal(f.query().person,'eldad,ruti');assert.equal(f.query().unit,'u-becker,u-matan-g');
 assert.equal(f.get('galleryFamily3ChoiceCount').textContent,'');
 f.reset();assert.equal(f.query().person,'');assert.equal(f.query().unit,'');
 assert.equal(f.get('clearGalleryFilter').hidden,true);
 f.change('family','u-moran',true);assert.equal(f.get('clearGalleryFilter').hidden,false);f.change('family','u-moran',false);assert.equal(f.get('clearGalleryFilter').hidden,true);
 for(const id of ['galleryPersonFilter','galleryFamily2','galleryFamily3','galleryFamily4'])assert.doesNotMatch(f.get(id).innerHTML,/ checked/);
 assert.equal(f.get('galleryPersonSearch').value,'');
 f.change('person','ruti',true);f.get('galleryPeopleChoices').open=true;f.get('galleryFamily2Choices').open=true;await f.open();assert.equal(f.query().person,'');assert.equal(f.get('galleryFilterPanel').hidden,true);
 assert.equal(f.get('galleryPeopleChoices').open,false);assert.equal(f.get('galleryFamily2Choices').open,false);assert.equal(f.get('galleryPeopleChoiceCount').textContent,'');
});
