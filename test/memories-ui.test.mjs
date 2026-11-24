import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
import {webcrypto} from 'node:crypto';
import {browserHistory,navigationSource} from './helpers/browser-history.mjs';

const source=await readFile(new URL('../public/assets/memories.js',import.meta.url),'utf8');
const sharing=await readFile(new URL('../public/assets/memory-sharing.js',import.meta.url),'utf8');
const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
const person={id:'yona',name:'יונה נקאש קהא',nameEn:'Yona Nakash Keha',context:'Family'};
const story={id:'a'.repeat(24),title:'הדרך הביתה',body:'סיפור משפחתי',category:'roots',year:null,author:'משפחה',personIds:['yona'],tags:[person],attachments:[],createdAt:'2026-11-01T00:00:00Z',updatedAt:'2026-11-01T00:00:00Z'};
const recording={id:'b'.repeat(32),title:'בקולה של סבתא',body:'זיכרון מוקלט',author:'משפחה',year:1985,personIds:['yona'],tags:[person],filename:'voice.mp3',src:'/api/voices/'+('b'.repeat(32))+'/audio',createdAt:'2026-11-01T00:00:00Z',updatedAt:'2026-11-01T00:00:00Z'};
const tick=async()=>{for(let n=0;n<5;n++)await new Promise(resolve=>setImmediate(resolve));};

function fixture({english=false,reduced=false,stories=[story],recordings=[recording],people=[person],fail=false,categoryError=0,href='https://family.test/',navigator={},historyNavigation=false,phone=false,site={},beforeReadyView=''}={}){
  const {window,document}=parseHTML(html),requests=[],timers=new Map(),scrolls=[],uploads=[],notices=[];let timer=0;
  Object.assign(document.documentElement.dataset,site);
  const browser=historyNavigation?browserHistory(href):null,location=browser?.location||new URL(href);
  if(browser)for(const type of ['popstate','hashchange'])browser.addEventListener(type,event=>window.dispatchEvent(Object.assign(new window.Event(type),event)));
  // Native browser methods, modeled only at the UI boundary.
  for(const dialog of document.querySelectorAll('dialog')){dialog.showModal=()=>{dialog.open=true;};dialog.close=()=>{dialog.open=false;dialog.dispatchEvent(new window.Event('close'));};}
  window.HTMLElement.prototype.scrollIntoView=function(){scrolls.push(this.id);};
  window.HTMLElement.prototype.focus=function(){Object.defineProperty(document,'activeElement',{value:this,configurable:true});};
  window.HTMLElement.prototype.pause=function(){this.paused=true;};
  window.HTMLInputElement.prototype.select=function(){this.selected=true;};
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
  window.FAMILY_DATA={people:Object.fromEntries(people.map(p=>[p.id,p]))};
  window.FamilyI18n.language=english?'en-US':'he';
  window.FamilyApp.getPersonSummary=id=>people.find(p=>p.id===id);
  class XHR{
    constructor(){this.headers={};this.events={};this.upload={addEventListener:(name,fn)=>{this.progress=fn;}};}
    open(method,url){this.method=method;this.url=url;}setRequestHeader(key,value){this.headers[key]=value;}addEventListener(name,fn){this.events[name]=fn;}
    send(file){this.file=file;uploads.push(this);queueMicrotask(()=>{this.progress?.({lengthComputable:true,loaded:file.size,total:file.size});this.status=201;this.responseText=JSON.stringify({recording});this.events.load();});}
  }
  const context=vm.createContext({window,document,location,history:browser?.history,navigator,URL,FormData:Form,Response,TextEncoder,crypto:webcrypto,btoa,XMLHttpRequest:XHR,matchMedia:query=>({matches:query.includes('700px')?phone:reduced}),setInterval:()=>0,setTimeout:fn=>{timers.set(++timer,fn);return timer;},clearTimeout:id=>timers.delete(id)});
  if(browser)vm.runInContext(navigationSource,context);
  vm.runInContext(sharing,context);
  vm.runInContext(source,context);
  if(browser)window.addEventListener('popstate',()=>{window.FamilyMemories.activate(location.hash.slice(1).split('/')[0]);});
  if(beforeReadyView)window.FamilyMemories.activate(beforeReadyView);
  document.dispatchEvent(new window.Event('DOMContentLoaded'));
  const get=id=>document.getElementById(id),click=selector=>{const el=document.querySelector(selector);assert.ok(el,selector);el.dispatchEvent(new window.Event('click',{bubbles:true}));};
  const emit=(id,type,props={})=>{const event=new window.Event(type,{bubbles:true,cancelable:true});Object.assign(event,props);get(id).dispatchEvent(event);return event;};
  return {window,document,location,browser,get,click,emit,requests,uploads,timers,scrolls,notices,async activate(view){if(browser)window.FamilyNavigation.go('#'+view);window.FamilyMemories.activate(view);await tick();},async flush(){await tick();},finishAnimation(){const callbacks=[...timers.values()];timers.clear();callbacks.forEach(fn=>fn());}};
}

test('a cold roots link opens the aliyah folder when the router runs before the book mounts',async()=>{
  const f=fixture({href:'https://family.test/#stories/roots',historyNavigation:true,beforeReadyView:'stories'});
  await f.flush();
  assert.equal(f.get('storiesView').hidden,false);
  assert.equal(f.get('storyAliyahFolder'),null);
  assert.equal(f.get('storiesCount').textContent,'1 זיכרון');
  assert.equal(f.get('memoryWorld').dataset.category,'roots');
});

test('the two films form one shareable story in the book and its chapter',async()=>{
  const filmStory={...story,id:'c'.repeat(24),title:'סיפורי העלייה של סבא שלמה וסבתא יונה',filmCollection:'aliyah'};
  const copied=[];
  const f=fixture({historyNavigation:true,stories:[story,{...story,id:'d'.repeat(24),category:'childhood'},filmStory],navigator:{clipboard:{writeText:async url=>copied.push(url)}}});
  await f.activate('stories');
  assert.equal(f.get('storyTimeline').children.length,3);
  assert.equal(f.get('storiesCount').textContent,'3 זיכרונות');
  f.click('[data-memory-category="roots"]');
  assert.equal(f.get('storyTimeline').children.length,2);
  f.click('[data-open-story="'+filmStory.id+'"]');
  const reader=f.get('storyReaderBody');
  assert.deepEqual([...reader.querySelectorAll('[data-memory-film]')].map(a=>new URL(a.getAttribute('href')).pathname),['/aliyah/shlomo/','/aliyah/yona/']);
  f.click('#storyReaderBody [data-memory-share="copy"]');await f.flush();
  assert.deepEqual(copied,['https://family.test/#stories/'+filmStory.id]);
  f.click('[data-memory-film="shlomo"]');
  assert.equal(reader.querySelector('iframe').getAttribute('src'),'https://family.test/aliyah/shlomo/?embed=1');
  f.click('[data-memory-film="yona"]');assert.equal(reader.querySelectorAll('iframe').length,1);
  assert.equal(reader.querySelector('iframe').getAttribute('src'),'https://family.test/aliyah/yona/?embed=1');
  f.browser.history.back();await f.flush();assert.equal(reader.querySelector('iframe'),null);
});

test('the five category doors open from an ornamented book and each click turns its pages',async()=>{
  const f=fixture();await f.activate('stories');
  assert.equal(f.document.querySelectorAll('[data-memory-category]').length,5);
  assert.match(f.get('memoryWorld').textContent,/סיפורי עלייה ושורשים/);assert.doesNotMatch(f.get('memoryWorld').textContent,/סיפור העלייה/);
  assert.ok(f.document.querySelector('.memory-book-art'));assert.ok(f.document.querySelector('.memory-turn-sheet'));
  f.click('[data-memory-category="roots"]');assert.equal(f.get('memoryWorld').classList.contains('is-turning'),true);
  assert.equal(f.get('memoryCollectionTitle').textContent,'סיפורי עלייה ושורשים');assert.match(f.get('storyTimeline').textContent,/הדרך הביתה/);
  assert.equal(f.scrolls.includes('memoryCollection'),false);f.finishAnimation();assert.equal(f.get('memoryWorld').classList.contains('is-turning'),false);assert.equal(f.scrolls.at(-1),'memoryCollection');
  f.click('[data-memory-category="funny"]');assert.equal(f.get('storyTimeline').children.length,0);assert.equal(f.get('storiesEmpty').hidden,false);
  f.click('#newStory');assert.equal(f.get('storyEditor').open,true);assert.equal(f.get('storyCategory').value,'funny');
});

test('phone Back closes a story before leaving its filtered list, Forward reopens it, and X consumes that same step',async()=>{
  for(const home of ['/','/nakash/','/keha-extended/','/keha-extended/zechariah-tzadok/']){
    const site=home==='/'?{}:{nakashHome:home,nakashEntryView:'home',nakashViews:'home tree stories documents search'};
    const f=fixture({historyNavigation:true,phone:true,href:'https://family.test'+home+'?lang=en-GB#home',site});
    await f.activate('stories');f.click('[data-memory-category="roots"]');f.finishAnimation();
    f.get('storyPersonFilter').value='yona';f.emit('storyPersonFilter','change');
    f.click('[data-open-story]');assert.equal(f.location.hash,'#stories/'+story.id);assert.equal(f.get('storyReader').open,true);
    const length=f.browser.history.length;
    f.browser.history.back();await f.flush();assert.equal(f.location.hash,'#stories');assert.equal(f.get('storyReader').open,false);
    assert.equal(f.get('storyPersonFilter').value,'yona');assert.equal(f.get('memoryCollectionTitle').textContent,'סיפורי עלייה ושורשים');
    f.browser.history.forward();await f.flush();assert.equal(f.get('storyReader').open,true);assert.match(f.get('storyReaderBody').textContent,/סיפור משפחתי/);assert.equal(f.browser.history.length,length);
    f.get('storyReader').close();await f.flush();assert.equal(f.location.hash,'#stories');
    f.browser.history.back();await f.flush();assert.equal(f.location.hash,'#home');assert.equal(f.location.pathname,home);assert.equal(f.location.search,'?lang=en-GB');
  }
});

test('a direct story link opens after its content loads and Back and Forward restore the list and reader',async()=>{
  const f=fixture({historyNavigation:true,phone:true,href:'https://family.test/?lang=he#stories/'+story.id});
  f.window.FamilyMemories.activate('stories');await f.flush();assert.equal(f.get('storyReader').open,true);
  const length=f.browser.history.length;f.browser.history.back();await f.flush();assert.equal(f.location.hash,'#stories');assert.equal(f.get('storyReader').open,false);
  f.browser.history.forward();await f.flush();assert.equal(f.get('storyReader').open,true);assert.equal(f.browser.history.length,length);
});
test('story cards and readers show the storyteller portrait rather than the tagged subject in either language',async()=>{
  const shosh={id:'shosh',name:'שוש בלום',nameEn:'Shosh Bloom',profile:'/media/'+'1'.repeat(32)},margalit={id:'margalit',name:'מרגלית נקאש',nameEn:'Margalit Nakash',profile:'/media/'+'2'.repeat(32)};
  for(const english of [false,true]){
    const f=fixture({english,people:[shosh,margalit],stories:[{...story,title:'נעלי הבית של סבתא מרגלית',author:'שוש בלום',category:'childhood',personIds:['margalit'],tags:[margalit]}]});
    await f.activate('stories');f.click('[data-memory-category="childhood"]');
    const card=f.document.querySelector('.memory-card-heading img');assert.equal(card.getAttribute('src'),shosh.profile+'?thumbnail=1');assert.equal(card.alt,english?'Shosh Bloom':'שוש בלום');
    f.click('[data-open-story]');assert.equal(f.document.querySelector('.story-reader-byline img').getAttribute('src'),shosh.profile+'?thumbnail=1');assert.match(f.get('storyReaderBody').textContent,english?/Margalit Nakash/:/מרגלית נקאש/);
    shosh.profile='/media/'+'3'.repeat(32);f.window.dispatchEvent(new f.window.Event('family-profile-changed'));
    assert.equal(f.document.querySelector('.memory-card-heading img').getAttribute('src'),shosh.profile+'?thumbnail=1');assert.equal(f.document.querySelector('.story-reader-byline img').getAttribute('src'),shosh.profile+'?thumbnail=1');
  }
});
test('an existing credited grandmother keeps her own portrait while ambiguous or unknown narrators use initials',async()=>{
  const yona={...person,profile:'/media/'+'4'.repeat(32)},tami={id:'tammy',name:'תמי לבבי',nameEn:'Tami Levavi',profile:'/media/'+'5'.repeat(32)};
  const credited=fixture({people:[yona,tami],stories:[{...story,author:'סבתא יונה מתוך עבודת השורשים של תמי'}]});await credited.activate('stories');assert.equal(credited.document.querySelector('.memory-narrator-portrait img').getAttribute('src'),yona.profile+'?thumbnail=1');
  for(const author of ['יונה','מספרת אחרת','<img src=x onerror=alert(1)>']){
    const f=fixture({people:[yona,{...yona,id:'another-yona',name:'יונה אחרת'}],stories:[{...story,author}]});await f.activate('stories');assert.equal(f.document.querySelectorAll('.memory-narrator-portrait img').length,0);assert.ok(f.document.querySelector('.memory-narrator-portrait'));assert.equal(f.document.querySelectorAll('[onerror]').length,0);
  }
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
test('each share destination receives the selected recording link, including the device sheet and clipboard',async()=>{
  const sent=[],copied=[],navigator={share:async data=>sent.push(data),clipboard:{writeText:async url=>copied.push(url)}};
  const second={...recording,id:'c'.repeat(32),title:'Grandpa & Grandma #1'};
  const f=fixture({recordings:[recording,second],english:true,navigator,href:'https://family.test/?install=1&media=old#voices'});
  await f.activate('voices');
  const panels=[...f.document.querySelectorAll('.memory-sharing')];
  assert.equal(panels.length,2);assert.equal(panels[1].previousElementSibling.localName,'audio');
  const url='https://family.test/?lang=en-US#voices/'+second.id,panel=panels[1];
  assert.equal(panel.querySelector('input').value,url);assert.notEqual(panels[0].querySelector('input').value,url);
  const links=[...panel.querySelectorAll('.memory-share-options a')].map(a=>new URL(a.getAttribute('href')));
  assert.equal(links[0].searchParams.get('text'),second.title+'\n'+url);
  assert.equal(links[1].searchParams.get('u'),url);assert.equal(links[2].searchParams.get('url'),url);
  assert.equal(links[3].searchParams.get('subject'),second.title);assert.equal(links[3].searchParams.get('body'),second.title+'\n'+url);
  for(const action of ['device','copy','messenger','instagram']){
    panel.querySelector('[data-memory-share="'+action+'"]').dispatchEvent(new f.window.Event('click',{bubbles:true}));
    await f.flush();
    if(['messenger','instagram'].includes(action))assert.equal(panel.querySelector('.memory-share-open').hidden,false);
  }
  assert.equal(sent.length,1);assert.equal(sent[0].title,second.title);assert.equal(sent[0].url,url);
  assert.deepEqual(copied,[url,url,url]);
  navigator.share=async()=>{throw new DOMException('Cancelled','AbortError');};
  panel.querySelector('[data-memory-share="device"]').dispatchEvent(new f.window.Event('click',{bubbles:true}));await f.flush();
  assert.equal(copied.length,3);assert.equal(panel.querySelector('.memory-share-status').textContent,'');
});
test('shared links open a single recording on load and history navigation, with manual copy when needed',async()=>{
  const second={...recording,id:'c'.repeat(32),title:'ראיון שני',src:'/second.mp3'};
  const f=fixture({recordings:[recording,second],href:'https://family.test/#voices/'+second.id});
  await f.activate('voices');
  assert.deepEqual([...f.get('voiceList').querySelectorAll('h4')].map(el=>el.textContent),[second.title]);
  assert.equal(f.get('voiceList').querySelector('audio').getAttribute('src'),second.src);
  assert.equal(f.get('voiceAllRecordings').hidden,false);assert.equal(f.get('voicePersonFilter').closest('label').hidden,true);
  assert.equal(f.document.querySelector('[data-memory-share="device"]'),null);
  f.click('[data-memory-share="copy"]');await f.flush();
  const field=f.document.querySelector('.memory-share-url');
  assert.equal(field.hidden,false);assert.equal(field.selected,true);assert.equal(field.value,f.location.href);
  f.location.hash='#voices/'+('d'.repeat(32));f.window.dispatchEvent(new f.window.Event('hashchange'));
  assert.equal(f.get('voiceSharedMissing').hidden,false);assert.equal(f.get('voiceList').children.length,0);
  f.location.hash='#voices';f.window.dispatchEvent(new f.window.Event('popstate'));
  assert.equal(f.get('voiceList').children.length,2);assert.equal(f.get('voiceSharedMissing').hidden,true);assert.equal(f.get('voiceAllRecordings').hidden,true);
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
  assert.equal(f.get('memoryCollectionTitle').textContent,'סיפורי עלייה ושורשים');assert.equal(f.get('storyTimeline').children.length,0);assert.match(f.notices.at(-1),/סיפורים מצחיקים/);
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
  assert.equal(f.get('memoryWorld').classList.contains('is-turning'),false);assert.equal(f.get('memoryCollectionTitle').textContent,'Aliyah and family roots');
  assert.equal(f.get('storiesEmpty').hidden,true);assert.equal(f.get('memoryStatus').textContent,'Offline');assert.match(f.get('memoryBook').textContent,/Our memories/);
  assert.equal(f.requests.some(r=>r.options.method==='POST'),false);
});
