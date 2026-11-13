import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {photoDate,photoAge,photoDateText} from '../public/assets/photo-date.mjs';

const source=(await readFile(new URL('../public/assets/photo-moments.js',import.meta.url),'utf8')).replace(/^import[^\n]+\n/,'');
function fixture(english=false){
 const nodes=new Map(),changes=[],requests=[],messages=[];
 class Node extends EventTarget{
  constructor(id=''){super();this.id=id;this.open=false;this.value='';this.dataset={};this.classList={contains:()=>false};this.properties=new Map();this.style={setProperty:(key,value)=>this.properties.set(key,value)};}
  replaceChildren(){this.innerHTML='';}
  contains(target){for(let current=target;current;current=current.parentNode)if(current===this)return true;return false;}
  set innerHTML(value){this.html=value;for(const match of value.matchAll(/<([a-z]+)[^>]*\bid="([^"]+)"/g)){const child=node(match[2]);child.tagName=match[1];child.parentNode=this;}}
  get innerHTML(){return this.html||'';}
  setAttribute(key,value){this[key]=value;}
  querySelectorAll(selector){return [...nodes.values()].filter(child=>child!==this&&this.contains(child)&&selector.split(',').includes(child.tagName));}
  closest(selector){return selector==='#'+this.id?this:null;}
  focus(){document.activeElement=this;}
  showModal(){this.open=true;}
  close(){this.open=false;this.dispatchEvent(new Event('close'));}
 }
 const node=id=>{if(!nodes.has(id))nodes.set(id,new Node(id));return nodes.get(id);};
 const document={readyState:'complete',activeElement:null,getElementById:node,createElement:()=>new Node(),body:{append:value=>nodes.set(value.id,value)}};
 const window=new EventTarget();window.innerHeight=800;window.visualViewport=new EventTarget();Object.assign(window.visualViewport,{height:800,offsetTop:0});
 window.FamilyI18n={isEnglish:english,locale:english?'en-US':'he-IL',error:String,fetch:async(path,options)=>{requests.push({path,options});const body=JSON.parse(options.body);return Response.json({operation:'photo-date',item:{id:path.split('/')[2],kind:'photo',takenDate:body.date,takenDateRevision:'saved'}});}};window.FamilyApp={apiEnabled:true,toast:message=>messages.push(message)};
 window.addEventListener('family-photo-overlays-changed',event=>changes.push(event.detail));
 vm.runInNewContext(source,{window,document,photoDate,photoAge,photoDateText,CustomEvent});
 const click=id=>{const event=new Event('click');Object.defineProperty(event,'target',{value:node(id)});node('photoMomentTools').dispatchEvent(event);};
 return {window,document,node,changes,requests,messages,click,api:window.FamilyPhotoDate,mount:photo=>window.FamilyPhotoDate.mount({kind:'photo',tags:[],...photo}),flush:()=>new Promise(resolve=>setImmediate(resolve)),enter(field,value){const input=node('photoInlineDate'+field);input.value=value;const event=new Event('input');Object.defineProperty(event,'target',{value:input});input.dispatchEvent(event);},submit(){const event=new Event('submit',{cancelable:true});node('photoInlineDateForm').dispatchEvent(event);return event;},resize(height,top=0){Object.assign(window.visualViewport,{height,offsetTop:top});window.visualViewport.dispatchEvent(new Event('resize'));}};
}
test('a video recording date can be edited directly from an archive card without opening the video viewer',async()=>{
 for(const english of [false,true]){
  const f=fixture(english);f.api.open({id:'film',kind:'video',takenDate:{year:1994},takenDateRevision:'before'});
  assert.equal(f.node('photoDateDialog').open,true);assert.equal(f.node('photoDateyear').value,1994);assert.match(f.node('photoDateTitle').textContent,english?/video recorded/:/הסרטון צולם/);
  f.node('photoDateyear').value='1995';f.node('photoDateForm').dispatchEvent(new Event('submit',{cancelable:true}));await f.flush();
  assert.equal(f.requests[0].path,'api/media/film/photo-date');assert.deepEqual(JSON.parse(f.requests[0].options.body),{date:{day:null,month:null,year:1995},expectedRevision:'before'});assert.equal(f.node('photoDateDialog').open,false);
 }
});
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

test('desktop date fields are always open, preserve partial dates and save inline in Hebrew and English',async()=>{
 for(const english of [false,true]){
  const f=fixture(english);f.mount({id:'a',takenDate:{month:6,year:1980},takenDateRevision:'before'});f.api.setDesktopInline(true);
  assert.equal(f.node('photoInlineDateForm').hidden,false);assert.equal(f.node('photoDateDialog').open,false);assert.equal(f.node('editPhotoDate').hidden,true);assert.equal(f.node('photoInlineDateday').value,'');assert.equal(f.node('photoInlineDatemonth').value,6);
  f.enter('day','16');f.enter('year','1990');assert.equal(f.node('photoInlineDateSave').disabled,false);assert.equal(f.submit().defaultPrevented,true);await f.flush();
  assert.equal(f.requests.length,1);assert.equal(f.requests[0].path,'api/media/a/photo-date');assert.deepEqual(JSON.parse(f.requests[0].options.body),{date:{day:16,month:6,year:1990},expectedRevision:'before'});assert.equal(f.node('photoInlineDateSave').disabled,true);assert.match(f.node('photoInlineDateStatus').textContent,/✓/);
  f.api.setDesktopInline(false);assert.equal(f.node('photoInlineDateForm').hidden,true);assert.equal(f.node('editPhotoDate').hidden,false);f.click('editPhotoDate');assert.equal(f.node('photoDateDialog').open,true);assert.equal(f.node('photoDateyear').value,1990);
 }
});
test('inline date drafts keep their values and focus through unrelated photo updates and save when leaving the date box',async()=>{
 const f=fixture();f.mount({id:'a',takenDate:{year:1980},takenDateRevision:'original'});f.api.setDesktopInline(true);f.node('photoInlineDateyear').focus();f.enter('year','1992');
 f.window.dispatchEvent(new CustomEvent('family-media-changed',{detail:{item:{id:'a',caption:'Updated caption',takenDate:{year:1980}}}}));assert.equal(f.node('photoInlineDateyear').value,'1992');assert.equal(f.document.activeElement,f.node('photoInlineDateyear'));
 const inside=new Event('focusout');Object.defineProperty(inside,'relatedTarget',{value:f.node('photoInlineDatemonth')});f.node('photoInlineDateForm').dispatchEvent(inside);await f.flush();assert.equal(f.requests.length,0);
 const outside=new Event('focusout');Object.defineProperty(outside,'relatedTarget',{value:f.node('openedCaptionText')});f.node('photoInlineDateForm').dispatchEvent(outside);await f.flush();assert.equal(f.requests.length,1);assert.equal(JSON.parse(f.requests[0].options.body).date.year,1992);
});
test('a delayed date save belongs to its original photo, prevents duplicate writes and cannot replace the next photo fields',async()=>{
 const f=fixture();let finish;const calls=[];f.window.FamilyI18n.fetch=async(path,options)=>{calls.push({path,options});return new Promise(resolve=>{finish=()=>resolve(Response.json({item:{id:'a',takenDate:{year:1990},takenDateRevision:'saved'}}));});};
 f.mount({id:'a',takenDate:{year:1980},takenDateRevision:'original'});f.api.setDesktopInline(true);f.enter('year','1990');f.submit();f.submit();assert.equal(calls.length,1);assert.equal(f.node('photoInlineDateyear').disabled,true);
 f.mount({id:'b',takenDate:{day:3,month:4,year:2000},takenDateRevision:'b-original'});assert.equal(f.node('photoInlineDateyear').disabled,false);finish();await f.flush();assert.equal(f.node('photoInlineDateyear').value,2000);assert.equal(f.node('photoInlineDateday').value,3);
});
test('invalid and failed inline date saves preserve the entered date for correction or retry',async()=>{
 const f=fixture();f.mount({id:'a',takenDate:{year:1980},takenDateRevision:'original'});f.api.setDesktopInline(true);
 f.enter('day','31');f.enter('month','4');f.submit();await f.flush();assert.equal(f.requests.length,0);assert.ok(f.node('photoInlineDateError').textContent);assert.equal(f.node('photoInlineDateday').value,'31');
 f.enter('day','30');f.window.FamilyI18n.fetch=async()=>Response.json({error:'Temporary failure'},{status:503});f.submit();await f.flush();assert.match(f.node('photoInlineDateError').textContent,/Temporary failure/);assert.equal(f.node('photoInlineDateday').value,'30');assert.equal(f.node('photoInlineDateSave').disabled,false);
 f.window.FamilyI18n.fetch=async(path,options)=>{f.requests.push({path,options});return Response.json({item:{id:'a',takenDate:JSON.parse(options.body).date,takenDateRevision:'new'}});};for(const field of ['day','month','year'])f.enter(field,'');f.submit();await f.flush();assert.deepEqual(JSON.parse(f.requests[0].options.body).date,{day:null,month:null,year:null});assert.equal(f.node('photoInlineDateError').textContent,'');
});
test('concurrent date edits refresh the photo and require reopening before discarding the conflicting draft',async()=>{
 const f=fixture();let writes=0;f.window.FamilyI18n.fetch=async(path,options)=>{if(options?.method==='POST'){writes++;return Response.json({error:'Conflict'},{status:409});}return Response.json({item:{id:'a',takenDate:{year:2001},takenDateRevision:'other'}});};
 f.mount({id:'a',takenDate:{year:1980},takenDateRevision:'original'});f.api.setDesktopInline(true);f.enter('year','1990');f.submit();await f.flush();assert.equal(writes,1);assert.ok(f.node('photoInlineDateError').textContent);assert.equal(f.node('photoInlineDateyear').value,'1990');
 f.node('mediaViewer').dispatchEvent(new Event('close'));f.mount({id:'a',takenDate:{year:2001},takenDateRevision:'other'});assert.equal(f.node('photoInlineDateyear').value,2001);assert.equal(f.node('photoInlineDateSave').disabled,true);
});
