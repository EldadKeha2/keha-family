import {suggestPeople,SEARCH_TYPES} from './site-search-core.mjs';

const I=window.FamilyI18n,tr=(he,en)=>I.isEnglish?en:he,$=id=>document.getElementById(id);
const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={person:['בני משפחה','People'],photo:['תמונות','Photos'],video:['סרטונים','Videos'],document:['מסמכים','Documents'],story:['זיכרונות','Memories'],voice:['הקלטות','Recordings'],wedding:['חתונות','Weddings'],event:['אירועים','Events']};
const typeLabel=type=>tr(...(labels[type]||['תוכן','Content']));
const magnifier='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>';
const roster=()=>window.FamilyPeopleRoster?.snapshot()||Object.values(window.FAMILY_DATA?.people||{});
const personName=person=>I.personName(person);
const safeURL=value=>{try{const url=new URL(value,location.href);return url.origin===location.origin&&/^https?:$/.test(url.protocol)?url.pathname+url.search+url.hash:'';}catch{return '';}};
const initials=person=>personName(person).split(' ').slice(0,2).map(part=>part[0]||'').join('');
function portrait(person){const src=safeURL(person.profile);return '<span class="site-search-avatar"><span aria-hidden="true">'+safe(initials(person))+'</span>'+(src?'<img '+(window.FamilyPhotoFraming?.profile(person)||'')+' src="'+safe(src)+'" alt="" loading="lazy" decoding="async">':'')+'</span>';}
let dialog,view,button,controller,epoch=0,lastKey=null,result=null,pending=false,params=new URLSearchParams();
const active=()=>window.FamilyApp?.getView()==='search';
const routeParams=()=>new URLSearchParams(location.hash.startsWith('#search/')?location.hash.slice(8):'');
function navigate(next){
  const route='#search/'+next.toString();
  closeDialog();
  if(window.FamilyNavigation)window.FamilyNavigation.go(route);else history.pushState(null,'',route);
  window.FamilyApp?.setView('search',false);activate('search');
}
function search(query,person){const next=new URLSearchParams();if(query?.trim())next.set('q',query.trim().slice(0,200));if(person)next.set('person',person);navigate(next);}
function closeDialog(){if(dialog?.open)dialog.close();}
function openProfile(id){closeDialog();window.FamilyApp?.openPerson(id);}
function suggestions(){
  const query=$('siteSearchQuickInput').value.trim(),people=suggestPeople(roster(),query),host=$('siteSearchSuggestions');
  host.innerHTML=people.map(person=>'<li class="site-search-suggestion"><a class="site-search-person" href="#person/'+encodeURIComponent(person.id)+'" data-site-search-person="'+safe(person.id)+'">'+portrait(person)+'<span><strong>'+safe(personName(person))+'</strong><small>'+tr('לפתיחת הפרופיל','Open profile')+'</small></span><span class="site-search-chevron" aria-hidden="true">'+(I.isEnglish?'→':'←')+'</span></a><button class="site-search-related" type="button" data-site-search-related="'+safe(person.id)+'">'+magnifier+'<span>'+tr('חיפוש חופשי של ','Search all content for ')+safe(personName(person))+'</span></button></li>').join('');
  $('siteSearchQuickInput').setAttribute('aria-expanded',String(people.length>0));
  const free=$('siteSearchFree');free.hidden=!query;free.querySelector('span').textContent=tr('חיפוש חופשי של ״','Search all content for “')+query+tr('״','”');
  $('siteSearchQuickHint').textContent=!query?tr('חפשו בן משפחה, מקום, אירוע או זיכרון','Search for a person, place, event or memory'):!people.length?tr('אפשר לחפש את המילים האלה בכל תכני האתר','Search these words across the family website'):tr('הקישו על התמונה לפרופיל, או על החיפוש שמתחתיה לכל התכנים','Tap a portrait for the profile, or search below it for all related content');
}
function openQuick(){
  $('siteSearchQuickInput').value=active()?params.get('q')||'':'';suggestions();
  dialog.showModal();button?.setAttribute('aria-expanded','true');$('siteSearchQuickInput').focus();
  window.FamilyPeopleRoster?.load().then(()=>{if(dialog.open)suggestions();}).catch(()=>{if(dialog.open)$('siteSearchQuickHint').textContent=tr('חלק מהשמות זמינים כרגע. החיפוש החופשי עדיין זמין.','Some names are available right now. You can still search all content.');});
}
function optionList(items,current,all,label){
  const options=[{id:'',name:all},...items];
  if(current&&!options.some(item=>String(item.id)===current))options.push({id:current,name:label||current,count:0});
  return options.map(item=>'<option value="'+safe(item.id)+'"'+(String(item.id)===current?' selected':'')+'>'+safe((I.isEnglish?item.nameEn:item.name)||item.name||item.id)+(item.count!==undefined?' ('+item.count+')':'')+'</option>').join('');
}
function renderShell(){
  view.innerHTML='<form class="site-search-form" id="siteSearchForm" role="search"><label for="siteSearchPageInput" class="site-search-sr">'+tr('חיפוש בכל האתר','Search the family website')+'</label><div class="site-search-field">'+magnifier+'<input id="siteSearchPageInput" type="search" maxlength="200" autocomplete="off" placeholder="'+tr('שם, מקום, אירוע או זיכרון','Name, place, event or memory')+'"><button type="submit">'+tr('חיפוש','Search')+'</button></div></form><div class="site-search-subject" id="siteSearchSubject" hidden></div><div class="site-search-types" id="siteSearchTypes" role="group" aria-label="'+tr('סוג תוכן','Content type')+'"></div><details class="site-search-filters" id="siteSearchFilters"><summary>'+tr('סינון ומיון','Filter and sort')+' <span id="siteSearchFilterCount"></span></summary><div class="site-search-filter-fields"><label>'+tr('ענף משפחתי','Family branch')+'<select data-site-filter="branch"></select></label><label>'+tr('שנה מתועדת','Recorded year')+'<select data-site-filter="year"></select></label><label>'+tr('תגית','Tag')+'<select data-site-filter="label"></select></label><label>'+tr('סדר לפי','Sort by')+'<select data-site-filter="sort"><option value="relevance">'+tr('רלוונטיות','Relevance')+'</option><option value="newest">'+tr('מהחדש לישן','Newest first')+'</option><option value="oldest">'+tr('מהישן לחדש','Oldest first')+'</option></select></label></div><p class="site-search-filter-note">'+tr('סינון השנה משתמש בתאריך המתועד של התוכן.','The year filter uses the recorded date of the content.')+'</p><button type="button" class="site-search-reset" data-site-search-reset>'+tr('איפוס הסינון','Reset filters')+'</button></details><p id="siteSearchStatus" class="site-search-status" role="status" aria-live="polite"></p><div class="site-search-grid" id="siteSearchGrid"></div><nav class="site-search-pager" id="siteSearchPager" aria-label="'+tr('עמודי תוצאות','Result pages')+'" hidden></nav>';
  $('siteSearchForm').addEventListener('submit',event=>{event.preventDefault();search($('siteSearchPageInput').value);});
  view.addEventListener('change',event=>{const field=event.target.dataset.siteFilter;if(!field)return;const next=new URLSearchParams(params);if(event.target.value&&!(field==='sort'&&event.target.value==='relevance'))next.set(field,event.target.value);else next.delete(field);next.delete('page');navigate(next);});
  view.addEventListener('click',event=>{
    const type=event.target.closest('[data-site-search-type]');if(type){const next=new URLSearchParams(params);if(type.dataset.siteSearchType==='all')next.delete('type');else next.set('type',type.dataset.siteSearchType);next.delete('page');navigate(next);return;}
    if(event.target.closest('[data-site-search-reset]')){const next=new URLSearchParams(params);for(const key of ['type','branch','year','label','sort','page'])next.delete(key);navigate(next);return;}
    if(event.target.closest('[data-site-search-unselect]')){const next=new URLSearchParams(params);next.delete('person');navigate(next);return;}
    const page=event.target.closest('[data-site-search-page]');if(page){const next=new URLSearchParams(params);next.set('page',page.dataset.siteSearchPage);navigate(next);view.scrollIntoView({block:'start',behavior:'instant'});return;}
    const person=event.target.closest('[data-site-search-person]');if(person){event.preventDefault();openProfile(person.dataset.siteSearchPerson);return;}
    const open=event.target.closest('[data-site-search-result]');if(open){event.preventDefault();openResult(Number(open.dataset.siteSearchResult));return;}
    if(event.target.closest('[data-site-search-retry]')){lastKey=null;load();}
  });
}
function resultCard(item,index){
  const title=I.isEnglish?item.titleEn||item.title:item.title,photo=item.type==='photo'?safeURL(item.media.thumbnailSrc||item.media.previewSrc||item.media.src):item.type==='video'?safeURL(item.media.poster):'';
  const image=item.type==='person'?portrait(item.person):photo?'<span class="site-search-preview"><img src="'+safe(photo)+'" alt="" loading="lazy" decoding="async">'+(item.type==='video'?'<span class="site-search-play" aria-hidden="true">▶</span>':'')+'</span>':'<span class="site-search-symbol" aria-hidden="true">'+({video:'▷',document:'▤',story:'❧',voice:'♫',wedding:'◇',event:'✧'}[item.type]||'◇')+'</span>';
  return '<article class="site-search-card"><a class="site-search-result-main" href="'+safe(item.href||'?media='+item.id+'#search/'+params.toString())+'" data-site-search-result="'+index+'">'+image+'<span class="site-search-result-copy"><small>'+safe(typeLabel(item.type))+(item.year?' · '+item.year:'')+'</small><strong dir="auto">'+safe(title)+'</strong>'+(item.excerpt&&item.excerpt!==title?'<span class="site-search-excerpt" dir="auto">'+safe(item.excerpt)+'</span>':'')+'<span class="site-search-open">'+tr(item.type==='person'?'לפרופיל':'לפתיחה',item.type==='person'?'Open profile':'Open')+' '+(I.isEnglish?'→':'←')+'</span></span></a>'+(item.people.length&&item.type!=='person'?'<div class="site-search-card-people">'+item.people.slice(0,5).map(p=>'<a href="#person/'+encodeURIComponent(p.id)+'" data-site-search-person="'+safe(p.id)+'">'+safe(personName(p))+'</a>').join('')+(item.people.length>5?'<span>+'+(item.people.length-5)+'</span>':'')+'</div>':'')+'</article>';
}
function render(data){
  result=data;const f=data.facets,type=params.get('type')||'all';
  const count=f.types.reduce((n,item)=>n+item.count,0);
  $('siteSearchTypes').innerHTML=[{id:'all',count},...SEARCH_TYPES.map(id=>({id,count:f.types.find(item=>item.id===id)?.count||0})).filter(item=>item.count||item.id===type)].map(item=>'<button type="button" data-site-search-type="'+item.id+'" aria-pressed="'+(type===item.id)+'">'+(item.id==='all'?tr('הכל','All'):safe(typeLabel(item.id)))+' <span>'+item.count+'</span></button>').join('');
  view.querySelector('[data-site-filter=branch]').innerHTML=optionList(f.branches,params.get('branch')||'',tr('כל הענפים','All branches'));
  view.querySelector('[data-site-filter=year]').innerHTML=optionList(f.years,params.get('year')||'',tr('כל השנים','All years'));
  view.querySelector('[data-site-filter=label]').innerHTML=optionList(f.labels,params.get('label')||'',tr('כל התגיות','All tags'));
  view.querySelector('[data-site-filter=sort]').value=params.get('sort')||'relevance';
  const n=['branch','year','label'].filter(key=>params.has(key)).length;$('siteSearchFilterCount').textContent=n?'('+n+')':'';
  const subject=$('siteSearchSubject');subject.hidden=!data.person;subject.innerHTML=data.person?'<a href="#person/'+encodeURIComponent(data.person.id)+'" data-site-search-person="'+safe(data.person.id)+'">'+portrait(data.person)+'<span>'+tr('כל התכנים הקשורים ל','All content related to ')+safe(personName(data.person))+'</span></a><button type="button" data-site-search-unselect aria-label="'+tr('ביטול בחירת האדם','Clear selected person')+'">×</button>':'';
  $('siteSearchStatus').textContent=!data.query&&!data.person?tr('הקלידו שם או מילים כדי למצוא רגעים מכל האתר','Enter a name or words to find moments from across the website'):data.count?data.count+' '+tr('תוצאות','results'):tr('לא נמצאו תוצאות. נסו מילים אחרות או שנו את הסינון.','No results found. Try other words or change the filters.');
  $('siteSearchGrid').innerHTML=data.items.map(resultCard).join('');
  const pager=$('siteSearchPager');pager.hidden=data.pages<=1;pager.innerHTML='<button type="button" data-site-search-page="'+(data.page-1)+'" '+(data.page<=1?'disabled':'')+'>'+tr('הקודם','Previous')+'</button><span>'+tr('עמוד ','Page ')+data.page+' '+tr('מתוך','of')+' '+data.pages+'</span><button type="button" data-site-search-page="'+(data.page+1)+'" '+(data.page>=data.pages?'disabled':'')+'>'+tr('הבא','Next')+'</button>';
}
async function load(){
  if(!active())return;
  params=routeParams();const key=params.toString();if(lastKey===key&&(result||pending))return;lastKey=key;pending=true;
  controller?.abort();controller=new AbortController();const current=++epoch;
  $('siteSearchPageInput').value=params.get('q')||'';
  $('siteSearchStatus').textContent=tr('מחפשים בזיכרונות המשפחה…','Searching our family memories…');view.setAttribute('aria-busy','true');
  $('siteSearchGrid').innerHTML='';$('siteSearchPager').hidden=true;
  try{
    const response=await I.fetch('api/search?'+key,{signal:controller.signal,cache:'no-store'}),data=await response.json();if(current!==epoch)return;
    if(!response.ok)throw Error(I.error(data.error)||tr('החיפוש לא הושלם. נסו שוב.','Search could not finish. Please try again.'));
    render(data);
  }catch(error){if(current!==epoch||error.name==='AbortError')return;lastKey=null;result=null;$('siteSearchStatus').textContent=error.message;$('siteSearchGrid').innerHTML='<button type="button" class="secondary-button" data-site-search-retry>'+tr('ניסיון נוסף','Try again')+'</button>';}
  finally{if(current===epoch){pending=false;view.removeAttribute('aria-busy');}}
}
function openResult(index){
  const item=result?.items[index];if(!item)return;
  if(item.type==='person'){openProfile(item.id);return;}
  if(item.media){window.FamilyMedia?.open(result.items.filter(row=>row.media).map(row=>row.media),result.items.slice(0,index).filter(row=>row.media).length,'site-search');return;}
  if(item.content){
    const content=item.content,panel=$('siteSearchContentDialog');
    panel.innerHTML='<button type="button" class="site-search-close" data-site-content-close aria-label="'+tr('סגירה','Close')+'">×</button><small>'+safe(typeLabel(item.type))+(item.year?' · '+item.year:'')+'</small><h2 id="siteSearchContentTitle" dir="auto">'+safe(item.title)+'</h2>'+(content.author?'<p dir="auto">'+safe(content.author)+'</p>':'')+(item.type==='voice'?'<audio controls preload="none" src="'+safe(content.src)+'"></audio>':'')+'<div class="site-search-full-text" dir="auto">'+safe(content.body)+'</div>'+listAttachments(content.attachments)+'<a class="site-search-related" href="'+safe(item.href)+'">'+tr('לעמוד '+typeLabel(item.type),'Browse '+typeLabel(item.type))+'</a>';
    panel.querySelector('[data-site-content-close]').addEventListener('click',()=>panel.close());panel.querySelector('a[href^="#"]')?.addEventListener('click',()=>panel.close());panel.showModal();return;
  }
  if(item.href){window.FamilyNavigation?.go(item.href);window.dispatchEvent(new Event('hashchange'));}
}
function listAttachments(items){return (items||[]).map(item=>{const url=safeURL(item.src);return url?'<p><a href="'+safe(url)+'" target="_blank" rel="noopener">'+safe(item.name)+'</a></p>':'';}).join('');}
function activate(name){
  if(!view)return;view.hidden=name!=='search';
  if(name==='search')load();else if(controller){controller.abort();epoch++;lastKey=null;pending=false;view.removeAttribute('aria-busy');}
}
function init(){
  view=$('siteSearchView');if(!view)return;renderShell();
  button=document.createElement('button');button.type='button';button.dataset.siteSearchOpen='';button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-controls','siteSearchDialog');button.setAttribute('aria-expanded','false');button.setAttribute('aria-label',tr('חיפוש בכל האתר','Search the family website'));button.innerHTML=magnifier+'<span>'+tr('חיפוש','Search')+'</span>';
  document.querySelector('[data-home-install-actions]')?.append(button);button.addEventListener('click',openQuick);
  dialog=document.createElement('dialog');dialog.id='siteSearchDialog';dialog.className='site-search-dialog';dialog.setAttribute('aria-labelledby','siteSearchQuickTitle');dialog.setAttribute('data-i18n-skip','');
  dialog.innerHTML='<header class="site-search-dialog-heading"><h2 id="siteSearchQuickTitle">'+tr('מה מחפשים במשפחה?','What are you looking for?')+'</h2><button type="button" class="site-search-close" data-site-search-close aria-label="'+tr('סגירה','Close')+'">×</button></header><form id="siteSearchQuickForm" role="search"><label for="siteSearchQuickInput" class="site-search-sr">'+tr('שם או מילות חיפוש','Name or search words')+'</label><div class="site-search-field">'+magnifier+'<input id="siteSearchQuickInput" type="search" inputmode="search" maxlength="200" autocomplete="off" aria-controls="siteSearchSuggestions" aria-expanded="false" placeholder="'+tr('למשל: רועי','For example: Roei')+'"><button type="submit" aria-label="'+tr('חיפוש חופשי','Search all content')+'">'+tr('חיפוש','Search')+'</button></div></form><p class="site-search-hint" id="siteSearchQuickHint" role="status"></p><ul id="siteSearchSuggestions" class="site-search-suggestions"></ul><button type="button" class="site-search-free" id="siteSearchFree" hidden>'+magnifier+'<span></span></button>';
  document.body.append(dialog);
  for(const element of [dialog,view])element.addEventListener('error',event=>{if(event.target.tagName==='IMG')event.target.remove();},true);
  dialog.querySelector('[data-site-search-close]').addEventListener('click',closeDialog);
  $('siteSearchQuickInput').addEventListener('input',suggestions);
  $('siteSearchQuickInput').addEventListener('keydown',event=>{if(event.key==='ArrowDown'){const first=dialog.querySelector('[data-site-search-person]');if(first){event.preventDefault();first.focus();}}});
  $('siteSearchQuickForm').addEventListener('submit',event=>{event.preventDefault();const query=$('siteSearchQuickInput').value.trim();if(query)search(query);});
  $('siteSearchFree').addEventListener('click',()=>search($('siteSearchQuickInput').value));
  dialog.addEventListener('click',event=>{const person=event.target.closest('[data-site-search-person]');if(person){event.preventDefault();openProfile(person.dataset.siteSearchPerson);return;}const related=event.target.closest('[data-site-search-related]');if(related){const p=roster().find(p=>p.id===related.dataset.siteSearchRelated);if(p)search(personName(p),p.id);}});
  dialog.addEventListener('keydown',event=>{if(!['ArrowDown','ArrowUp'].includes(event.key)||event.target===$('siteSearchQuickInput'))return;const choices=[...$('siteSearchSuggestions').querySelectorAll('a,button')],at=choices.indexOf(document.activeElement);if(at<0)return;event.preventDefault();if(at===0&&event.key==='ArrowUp')$('siteSearchQuickInput').focus();else choices[(at+(event.key==='ArrowDown'?1:-1)+choices.length)%choices.length]?.focus();});
  dialog.addEventListener('close',()=>{button.setAttribute('aria-expanded','false');if(!button.closest('[hidden]')&&window.FamilyApp?.getView()==='home')button.focus();});
  for(const name of ['hashchange','popstate'])window.addEventListener(name,()=>{closeDialog();if($('siteSearchContentDialog')?.open)$('siteSearchContentDialog').close();if(location.hash.split('/')[0]==='#search'){window.FamilyApp?.setView('search',false);activate('search');}});
  for(const name of ['family-media-changed','family-person-changed'])window.addEventListener(name,()=>{lastKey=null;if(active())load();});
  const content=document.createElement('dialog');content.id='siteSearchContentDialog';content.className='site-search-dialog site-search-content-dialog';content.setAttribute('aria-labelledby','siteSearchContentTitle');content.addEventListener('close',()=>content.querySelector('audio')?.pause());document.body.append(content);
  window.FamilySiteSearch={activate,open:openQuick};activate(window.FamilyApp?.getView()||location.hash.slice(1).split('/')[0]);
}
init();
