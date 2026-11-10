import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {photoDate,photoAge,photoDateText} from '../public/assets/photo-date.mjs';

const source=(await readFile(new URL('../public/assets/photo-moments.js',import.meta.url),'utf8')).replace(/^import[^\n]+\n/,'');
function fixture(english=false){
 const nodes=new Map(),changes=[];
 class Node extends EventTarget{
  constructor(id=''){super();this.id=id;this.open=false;this.value='';this.dataset={};this.classList={contains:()=>false};this.properties=new Map();this.style={setProperty:(key,value)=>this.properties.set(key,value)};}
  replaceChildren(){this.innerHTML='';}
  setAttribute(key,value){this[key]=value;}
  querySelectorAll(){return [];}
  closest(selector){return selector==='#'+this.id?this:null;}
  focus(){document.activeElement=this;}
  showModal(){this.open=true;}
  close(){this.open=false;this.dispatchEvent(new Event('close'));}
 }
 const node=id=>{if(!nodes.has(id))nodes.set(id,new Node(id));return nodes.get(id);};
 const document={readyState:'complete',activeElement:null,getElementById:node,createElement:()=>new Node(),body:{append:value=>nodes.set(value.id,value)}};
 const window=new EventTarget();window.innerHeight=800;window.visualViewport=new EventTarget();Object.assign(window.visualViewport,{height:800,offsetTop:0});
 window.FamilyI18n={isEnglish:english,locale:english?'en-US':'he-IL'};window.FamilyApp={apiEnabled:true};
 window.addEventListener('family-photo-overlays-changed',event=>changes.push(event.detail));
 vm.runInNewContext(source,{window,document,photoDate,photoAge,photoDateText,CustomEvent});
 const click=id=>{const event=new Event('click');Object.defineProperty(event,'target',{value:node(id)});node('photoMomentTools').dispatchEvent(event);};
 return {window,document,node,changes,click,api:window.FamilyPhotoDate,mount:photo=>window.FamilyPhotoDate.mount({kind:'photo',tags:[],...photo}),resize(height,top=0){Object.assign(window.visualViewport,{height,offsetTop:top});window.visualViewport.dispatchEvent(new Event('resize'));}};
}
test('name and age toggles are independent, retain state on metadata changes, and reset for a new photo',()=>{
 for(const english of [false,true]){
  const f=fixture(english);f.mount({id:'a',takenDate:{year:1980}});assert.match(f.node('photoMomentTools').innerHTML,/id="togglePhotoNames"/);
  f.click('togglePhotoNames');assert.equal(f.api.overlays('a').showNames,true);assert.equal(f.api.overlays('a').showAges,false);
  f.click('togglePhotoAges');assert.equal(f.api.overlays('a').showAges,true);assert.equal(f.changes.at(-1).id,'a');
  f.window.dispatchEvent(new CustomEvent('family-media-changed',{detail:{item:{id:'a',takenDate:{day:16,month:10,year:1980}}}}));assert.equal(f.api.overlays('a').showNames,true);assert.equal(f.api.overlays('a').showAges,true);
  f.window.dispatchEvent(new CustomEvent('family-media-changed',{detail:{item:{id:'a',takenDate:{year:null}}}}));assert.equal(f.api.overlays('a').showAges,false);assert.equal(f.api.overlays('a').showNames,true);
  f.click('togglePhotoAges');assert.equal(f.api.overlays('a').showAges,false);f.mount({id:'b',takenDate:{year:2000}});assert.equal(f.api.overlays('b').showNames,false);assert.equal(f.api.overlays('b').showAges,false);
 }
});
test('overlay ages use the lower whole year for partial dates without symbols and skip unknown birthdays',()=>{
 const f=fixture(),photo={id:'a',takenDate:{year:1980},tags:[{id:'yona',birthday:'16.10.1921'}]};
 assert.equal(f.api.ageFor({id:'yona'},photo).text,'58');assert.equal(fixture(true).api.ageFor({id:'yona'},photo).text,'58');assert.equal(f.api.ageFor({id:'unknown'},photo),null);
 f.window.FamilyApp.getPersonSummary=()=>({birthday:'16.10.1921'});assert.equal(f.api.ageFor({id:'yona'},{...photo,tags:[],takenDate:{day:16,month:10,year:1980}}).text,'59');
 assert.equal(f.api.ageFor({id:'unknown',birthday:'1.1.1111'},photo),null);assert.equal(f.api.ageFor({id:'future',birthday:'1.1.2000'},photo),null);
});
test('the date editor stays at the top of the visible viewport and above a shrinking phone keyboard',()=>{
 const f=fixture();f.mount({id:'a',takenDate:{year:1980}});f.click('editPhotoDate');const dialog=f.node('photoDateDialog');
 assert.equal(dialog.open,true);assert.equal(f.node('photoDateyear').value,1980);assert.equal(f.node('photoDateday').value,'');assert.equal(dialog.properties.get('--photo-date-top'),'36px');
 f.resize(310,40);const top=parseFloat(dialog.properties.get('--photo-date-top')),height=parseFloat(dialog.properties.get('--photo-date-height'));
 assert.ok(top>=40&&top<70);assert.ok(top+height<=350);assert.equal(f.document.activeElement,f.node('photoDateday'));
 f.node('cancelPhotoDate').dispatchEvent(new Event('click'));assert.equal(dialog.open,false);f.resize(200);assert.equal(parseFloat(dialog.properties.get('--photo-date-top')),top);
});
