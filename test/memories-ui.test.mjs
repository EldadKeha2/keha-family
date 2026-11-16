import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
import {webcrypto} from 'node:crypto';

const source=await readFile(new URL('../public/assets/memories.js',import.meta.url),'utf8');
const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
const person={id:'yona',name:'יונה נקאש קהא',nameEn:'Yona Nakash Keha',context:'Family'};
const story={id:'a'.repeat(24),title:'הדרך הביתה',body:'סיפור משפחתי',category:'roots',year:null,author:'משפחה',personIds:['yona'],tags:[person],attachments:[],createdAt:'2026-11-01T00:00:00Z',updatedAt:'2026-11-01T00:00:00Z'};
const recording={id:'b'.repeat(32),title:'בקולה של סבתא',body:'זיכרון מוקלט',author:'משפחה',year:1985,personIds:['yona'],tags:[person],filename:'voice.mp3',src:'/api/voices/'+('b'.repeat(32))+'/audio',createdAt:'2026-11-01T00:00:00Z',updatedAt:'2026-11-01T00:00:00Z'};
const tick=async()=>{for(let n=0;n<5;n++)await new Promise(resolve=>setImmediate(resolve));};

function fixture({english=false,reduced=false,stories=[story],recordings=[recording],fail=false,categoryError=0}={}){
  const {window,document}=parseHTML(html),requests=[],timers=new Map(),scrolls=[],uploads=[],notices=[];let timer=0;
  // Native browser methods, modeled only at the UI boundary.
  for(const dialog of document.querySelectorAll('dialog')){dialog.showModal=()=>{dialog.open=true;};dialog.close=()=>{dialog.open=false;};}
  window.HTMLElement.prototype.scrollIntoView=function(){scrolls.push(this.id);};
  window.HTMLElement.prototype.focus=function(){Object.defineProperty(document,'activeElement',{value:this,configurable:true});};
  window.HTMLElement.prototype.pause=function(){this.paused=true;};
  Object.defineProperty(window.HTMLSelectElement.prototype,'value',{get(){return this._value??this.querySelector('option[selected]')?.value??this.querySelector('option')?.value??'';},set(value){this._value=String(value);},configurable:true});
  for(const input of document.querySelectorAll('input[type=file]'))input.files=[];
  for(const form of document.querySelectorAll('form'))form.reset=()=>{for(const input of form.querySelectorAll('input,textarea')){input.value='';if(input.type==='file')input.files=[];}};
  class Form extends FormData{constructor(form){super();if(form)for(const el of form.querySelectorAll('[name]')){if(el.type==='file')for(const file of el.files||[])this.append(el.name,file);else this.set(el.name,el.value||'');}}}
  const api=async(path,options={})=>{
    requests.push({path,options});if(fail&&options.method!=='POST')return Response.json({error:'Offline'},{status:503});
    if(options.method==='POST'){
      if(/^api\/stories\/[^/]+\/category$/.test(path)){
        if(categoryError)return Response.json({error:'This memory has changed. Refresh and try again.'},{status:categoryError});
        const body=JSON.parse(options.body);return Response.json({story:{...story,category:body.category,updatedAt:'2026-11-16T00:00:00Z'}});
      }
      if(path.startsWith('api/stories')){const body=options.body;return Response.json({story:{...story,title:body.get('title'),body:body.get('body'),year:body.get('year')||null,category:body.get('category'),personIds:JSON.parse(body.get('personIds')),tags:JSON.parse(body.get('personIds')).map(()=>person)}});}
      if(path.startsWith('api/voices/')){const body=JSON.parse(options.body);return Response.json({recording:{...recording,...body,tags:body.personIds.map(()=>person)}});}
    }
    return Response.json(path==='api/stories'?{stories,revision:'s1'}:{recordings,revision:'v1'});
  };
  Object.assign(window,{FAMILY_API_TOKEN:'public-marker',FamilyI18n:{isEnglish:english,locale:english?'en-US':'he-IL',error:String,personName:p=>english?p.nameEn:p.name,searchNames:p=>[p.name,p.nameEn].join(' '),fetch:api},FamilyApp:{apiEnabled:true,getView:()=> 'tree',toast:s=>notices.push(s)},FamilyTags:{findPeople:async q=>[person].filter(p=>!q||p.name.includes(q)||p.nameEn.toLowerCase().includes(q.toLowerCase()))},FamilyAccessibility:{isReducedMotion:()=>reduced}});
  class XHR{
    constructor(){this.headers={};this.events={};this.upload={addEventListener:(name,fn)=>{this.progress=fn;}};}
    open(method,url){this.method=method;this.url=url;}setRequestHeader(key,value){this.headers[key]=value;}addEventListener(name,fn){this.events[name]=fn;}
    send(file){this.file=file;uploads.push(this);queueMicrotask(()=>{this.progress?.({lengthComputable:true,loaded:file.size,total:file.size});this.status=201;this.responseText=JSON.stringify({recording});this.events.load();});}
  }
  vm.runInNewContext(source,{window,document,FormData:Form,Response,TextEncoder,crypto:webcrypto,btoa,XMLHttpRequest:XHR,matchMedia:()=>({matches:reduced}),setInterval:()=>0,setTimeout:fn=>{timers.set(++timer,fn);return timer;},clearTimeout:id=>timers.delete(id)});
  document.dispatchEvent(new window.Event('DOMContentLoaded'));
  const get=id=>document.getElementById(id),click=selector=>{const el=document.querySelector(selector);assert.ok(el,selector);el.dispatchEvent(new window.Event('click',{bubbles:true}));};
  const emit=(id,type,props={})=>{const event=new window.Event(type,{bubbles:true,cancelable:true});Object.assign(event,props);get(id).dispatchEvent(event);return event;};
  return {window,document,get,click,emit,requests,uploads,timers,scrolls,notices,async activate(view){window.FamilyMemories.activate(view);await tick();},async flush(){await tick();},finishAnimation(){const callbacks=[...timers.values()];timers.clear();callbacks.forEach(fn=>fn());}};
}

test('the five category doors open from an ornamented book and each click turns its pages',async()=>{
  const f=fixture();await f.activate('stories');
  assert.equal(f.document.querySelectorAll('[data-memory-category]').length,5);
  assert.match(f.get('memoryWorld').textContent,/סיפורי שורשים/);assert.doesNotMatch(f.get('memoryWorld').textContent,/סיפור העלייה/);
  assert.ok(f.document.querySelector('.memory-book-art'));assert.ok(f.document.querySelector('.memory-turn-sheet'));
  f.click('[data-memory-category="roots"]');assert.equal(f.get('memoryWorld').classList.contains('is-turning'),true);
  assert.equal(f.get('memoryCollectionTitle').textContent,'סיפורי שורשים');assert.match(f.get('storyTimeline').textContent,/הדרך הביתה/);
  assert.equal(f.scrolls.includes('memoryCollection'),false);f.finishAnimation();assert.equal(f.get('memoryWorld').classList.contains('is-turning'),false);assert.equal(f.scrolls.at(-1),'memoryCollection');
  f.click('[data-memory-category="funny"]');assert.equal(f.get('storyTimeline').children.length,0);assert.equal(f.get('storiesEmpty').hidden,false);
  f.click('#newStory');assert.equal(f.get('storyEditor').open,true);assert.equal(f.get('storyCategory').value,'funny');
});
test('new memories save the selected chapter and keyboard-selected people without requiring a year',async()=>{
  const f=fixture();await f.activate('stories');f.click('[data-memory-category="childhood"]');f.click('#newStory');
  assert.equal(f.get('storyYear').hasAttribute('required'),false);f.get('storyTitle').value='משחקי ילדות';f.get('storyBody').value='יום אחד…';
  f.get('storyPeoplePickerSearch').value='יונה';f.emit('storyPeoplePickerSearch','input');await f.flush();
  assert.equal(f.get('storyPeoplePickerSearch').getAttribute('aria-expanded'),'true');f.emit('storyPeoplePickerSearch','keydown',{key:'Enter'});
  assert.match(f.get('storyPeoplePicker').textContent,/יונה נקאש קהא/);
  f.emit('storyForm','submit');await f.flush();const mutation=f.requests.find(r=>r.options.method==='POST');
  assert.equal(mutation.path,'api/stories');assert.equal(mutation.options.body.get('category'),'childhood');assert.equal(mutation.options.body.get('year'),'');assert.deepEqual(JSON.parse(mutation.options.body.get('personIds')),['yona']);
  assert.equal(mutation.options.headers['X-Family-Token'],'public-marker');assert.equal(f.get('storyEditor').open,false);
});
test('existing memories retain attachments and tags during editing and filter by tagged people',async()=>{
  const f=fixture();await f.activate('stories');f.click('[data-edit-story]');
  assert.equal(f.get('storyCategory').value,'roots');assert.match(f.get('storyPeoplePicker').textContent,/יונה נקאש קהא/);assert.equal(f.get('storyYear').value,'');
  f.get('storyTitle').value='כותרת מתוקנת';f.emit('storyForm','submit');await f.flush();const mutation=f.requests.find(r=>r.options.method==='POST');
  assert.equal(mutation.options.body.get('expectedUpdatedAt'),story.updatedAt);assert.deepEqual(JSON.parse(mutation.options.body.get('personIds')),['yona']);
  f.window.FamilyMemories.search('Yona');assert.equal(f.get('storyTimeline').children.length,1);
  f.window.FamilyMemories.search('no-match');assert.equal(f.get('storyTimeline').children.length,0);assert.equal(f.get('storiesEmpty').hidden,false);
});
test('Enter in an empty or still-loading people picker never submits a story',async()=>{
  const f=fixture();await f.activate('stories');f.click('#newStory');f.get('storyTitle').value='A complete memory';f.get('storyBody').value='Content';
  assert.equal(f.emit('storyPeoplePickerSearch','keydown',{key:'Enter'}).defaultPrevented,true);
  f.get('storyPeoplePickerSearch').value='יונה';f.emit('storyPeoplePickerSearch','input');
  assert.equal(f.emit('storyPeoplePickerSearch','keydown',{key:'Enter'}).defaultPrevented,true);
  assert.equal(f.requests.some(r=>r.options.method==='POST'),false);await f.flush();
  f.emit('storyPeoplePickerSearch','keydown',{key:'Enter'});assert.match(f.get('storyPeoplePicker').textContent,/יונה נקאש קהא/);
});
test('voices use native seekable players, allow metadata editing and expose download links',async()=>{
  const f=fixture();await f.activate('voices');assert.equal(f.get('voicesView').hidden,false);assert.equal(f.get('storiesView').hidden,true);
  const player=f.document.querySelector('#voiceList audio');assert.ok(player.hasAttribute('controls'));assert.equal(player.getAttribute('preload'),'none');assert.equal(player.getAttribute('src'),recording.src);
  assert.match(f.document.querySelector('#voiceList a[download]').href,/download=1/);
  f.click('[data-edit-recording]');assert.equal(f.get('voiceFileLabel').hidden,true);assert.equal(f.get('voiceFile').required,false);
  f.get('voiceTitle').value='כותרת חדשה';f.emit('voiceForm','submit');await f.flush();const mutation=f.requests.find(r=>r.options.method==='POST');
  assert.equal(mutation.path,'api/voices/'+recording.id);assert.equal(JSON.parse(mutation.options.body).expectedUpdatedAt,recording.updatedAt);assert.equal(f.uploads.length,0);
  await f.activate('stories');assert.equal(f.get('voicesView').hidden,true);
});
test('each memory has five category choices at its bottom and saves only its category',async()=>{
  const f=fixture();await f.activate('stories');const id='storyCategory-'+story.id,select=f.get(id);
  assert.equal(select.closest('.memory-card').lastElementChild.className,'memory-card-category');
  assert.deepEqual([...select.querySelectorAll('option')].map(option=>option.value),['roots','people','family','childhood','funny']);assert.equal(select.value,'roots');
  select.value='childhood';f.emit(id,'change');assert.equal(f.get(id).disabled,true);assert.equal(f.get(id).value,'childhood');await f.flush();
  const mutation=f.requests.find(r=>r.options.method==='POST');assert.equal(mutation.path,'api/stories/'+story.id+'/category');assert.deepEqual(JSON.parse(mutation.options.body),{category:'childhood',expectedUpdatedAt:story.updatedAt});
  assert.equal(f.get(id).value,'childhood');assert.equal(f.get(id).disabled,false);assert.match(f.get('storyTimeline').textContent,/סיפור משפחתי/);assert.match(f.get('storyTimeline').textContent,/יונה נקאש קהא/);assert.match(f.get(id+'Status').textContent,/נשמר/);
});
test('moving a memory updates its chapter without switching the reader out of the chosen chapter',async()=>{
  const f=fixture();await f.activate('stories');f.click('[data-memory-category="roots"]');const id='storyCategory-'+story.id;f.get(id).value='funny';f.emit(id,'change');await f.flush();
  assert.equal(f.get('memoryCollectionTitle').textContent,'סיפורי שורשים');assert.equal(f.get('storyTimeline').children.length,0);assert.match(f.notices.at(-1),/סיפורים מצחיקים/);
  f.click('[data-memory-category="funny"]');assert.match(f.get('storyTimeline').textContent,/הדרך הביתה/);assert.equal(f.get(id).value,'funny');
});
test('a stale category change restores the saved category and keeps the memory available for retry',async()=>{
  const f=fixture({categoryError:409});await f.activate('stories');const id='storyCategory-'+story.id;f.get(id).value='people';f.emit(id,'change');await f.flush();
  assert.equal(f.get(id).value,'roots');assert.equal(f.get(id).disabled,false);assert.match(f.get(id+'Status').textContent,/Refresh/);assert.match(f.get('storyTimeline').textContent,/סיפור משפחתי/);
  assert.equal(f.requests.filter(r=>r.options.method==='POST').length,1);
});
test('the voices introduction uses the requested family recordings heading',async()=>{
  const f=fixture();await f.activate('voices');assert.equal(f.document.querySelector('.voices-intro h3').textContent,'ההקלטות בקולם של בני המשפחה');
});
test('audio uploads send original bytes, Hebrew metadata, people and a stable retry identity',async()=>{
  const f=fixture({recordings:[]});await f.activate('voices');f.click('#newRecording');
  const file=new File(['ID3family audio'],'voice.mp3',{type:'audio/mpeg'});f.get('voiceFile').files=[file];f.emit('voiceFile','change');f.get('voiceTitle').value='הקול שלנו';
  f.get('voicePeoplePickerSearch').value='יונה';f.emit('voicePeoplePickerSearch','input');await f.flush();f.emit('voicePeoplePickerSearch','keydown',{key:'Enter'});
  f.emit('voiceForm','submit');await f.flush();assert.equal(f.uploads.length,1);const upload=f.uploads[0],metadata=JSON.parse(Buffer.from(upload.headers['X-Family-Recording'],'base64').toString('utf8'));
  assert.equal(upload.file,file);assert.match(upload.url,/uploadId=[a-f0-9]{32}/);assert.equal(metadata.title,'הקול שלנו');assert.deepEqual(metadata.personIds,['yona']);assert.equal(f.get('voiceEditor').open,false);
  assert.equal(f.get('voiceProgress').value,100);assert.match(f.get('voiceList').textContent,/בקולה של סבתא/);
});
test('reduced motion skips page animation, and failed loading does not masquerade as an empty archive',async()=>{
  const f=fixture({reduced:true,english:true,fail:true});await f.activate('stories');f.click('[data-memory-category="roots"]');
  assert.equal(f.get('memoryWorld').classList.contains('is-turning'),false);assert.equal(f.get('memoryCollectionTitle').textContent,'Our roots');
  assert.equal(f.get('storiesEmpty').hidden,true);assert.equal(f.get('memoryStatus').textContent,'Offline');assert.match(f.get('memoryBook').textContent,/Our memories/);
  assert.equal(f.requests.some(r=>r.options.method==='POST'),false);
});
