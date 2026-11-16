import {suggestPeople,SEARCH_TYPES} from './site-search-core.mjs';

const I=window.FamilyI18n,tr=(he,en)=>I.isEnglish?en:he,$=id=>document.getElementById(id);
const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={person:['בני משפחה','People'],photo:['תמונות','Photos'],video:['סרטונים','Videos'],document:['מסמכים','Documents'],story:['זיכרונות','Memories'],voice:['הקלטות','Recordings'],wedding:['חתונות','Weddings'],event:['אירועים','Events']};
const typeLabel=type=>tr(...(labels[type]||['תוכן','Content']));
const magnifier='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>';
const contentSearchIcon='<svg viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21H3V4h17v2M8 25H6V8h17v3"/><rect x="10" y="12" width="15" height="15" rx="2"/><path d="m12 22 3-3 3 3M14 15h.01"/><circle cx="24" cy="23" r="5" fill="#edf1e4"/><path d="m28 27 3 3"/></svg>';
const sectionAliases={tree:['אילן יוחסין','עץ המשפחה','Family Tree'],timeline:['ציר הזמן','Family Timeline'],directory:['אנשים','בני משפחה','Family Members'],videos:['וידאו','סרטים','Videos'],gallery:['גלריה','Family Gallery'],screensaver:['שומר המסך','Screensaver'],calendar:['לוח השנה','יומן','Family Calendar'],photos:['אלבום משפחתי','Family Photos'],stories:['זיכרונות','סיפורים','Our Stories','Memories'],voices:['הקלטות','קולות','Family Voices','Recordings'],weddings:['חתונה','Weddings'],'family-ai':['בינה מלאכותית','Family AI'],nostalgia:['נוסטלגיה','Nostalgia'],updates:['עדכונים','הרשמה','Updates'],games:['משחקים','Family Games'],nursery:['תינוקיה','תינוקייה','Nursery'],memorial:['הנצחה','יזכור','Memorial']};
function matchingSections(query){
  const sections=[...document.querySelectorAll('#mainNav [data-view]')].filter(link=>Object.hasOwn(sectionAliases,link.dataset.view)).map(link=>({id:link.dataset.view,name:link.textContent.trim(),aliases:sectionAliases[link.dataset.view]}));
  return suggestPeople(sections,query,5);
}
const roster=()=>window.FamilyPeopleRoster?.snapshot()||Object.values(window.FAMILY_DATA?.people||{});
const personName=person=>I.personName(person);
const safeURL=value=>{try{const url=new URL(value,location.href);return url.origin===location.origin&&/^https?:$/.test(url.protocol)?url.pathname+url.search+url.hash:'';}catch{return '';}};
const initials=person=>personName(person).split(' ').slice(0,2).map(part=>part[0]||'').join('');
function portrait(person){const src=safeURL(person.profile),frame=person.profileFraming||{},position=key=>Number.isFinite(frame[key])?Math.min(1,Math.max(0,frame[key]))*100:50,style='object-position:'+position('x')+'% '+position('y')+'%;object-fit:'+(frame.fit==='contain'?'contain':'cover');return '<span class="site-search-avatar"><span aria-hidden="true">'+safe(initials(person))+'</span>'+(src?'<img style="'+style+'" src="'+safe(src)+'" alt="" loading="lazy" decoding="async">':'')+'</span>';}
let dialog,view,button,headerSlot,desktopForm,desktopInput,desktopMenu,desktopNavigation,quickNavigation,controller,epoch=0,lastKey=null,result=null,pending=false,params=new URLSearchParams();
const active=()=>window.FamilyApp?.getView()==='search';
const routeParams=()=>new URLSearchParams(location.hash.startsWith('#search/')?location.hash.slice(8):'');
function navigate(next){
  const route='#search/'+next.toString();
  closeDialog();
  if(window.FamilyNavigation)window.FamilyNavigation.go(route);else history.pushState(null,'',route);
  window.FamilyApp?.setView('search',false);activate('search');
}
function search(query,person){const next=new URLSearchParams();if(query?.trim())next.set('q',query.trim().slice(0,200));if(person)next.set('person',person);navigate(next);}
function closeDesktop(){if(desktopMenu)desktopMenu.hidden=true;desktopInput?.setAttribute('aria-expanded','false');desktopNavigation?.clear();}
function closeDialog(){if(dialog?.open)dialog.close();closeDesktop();}
function openProfile(id){closeDialog();window.FamilyApp?.openPerson(id);}
function openSection(id){if(!Object.hasOwn(sectionAliases,id))return;closeDialog();window.FamilyApp?.setView(id);}
function submitSuggestedSearch(query){
  query=query.trim();if(!query)return;
  const first=suggestPeople(roster(),query)[0],section=matchingSections(query)[0];if(first)openProfile(first.id);else if(section)openSection(section.id);else search(query);
}
function suggestionNavigation(input,host,show){
  const selector='[data-site-search-person],[data-site-search-related],[data-site-search-section],.site-search-free';
  const options=()=>[...host.querySelectorAll(selector)].filter(choice=>!choice.hidden);
  const key=choice=>choice?.dataset.siteSearchPerson?'person/'+choice.dataset.siteSearchPerson:choice?.dataset.siteSearchRelated?'related/'+choice.dataset.siteSearchRelated:choice?.dataset.siteSearchSection?'section/'+choice.dataset.siteSearchSection:'free';
  let selected;
  input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-haspopup','listbox');input.setAttribute('aria-controls',host.id);
  host.setAttribute('role','listbox');host.setAttribute('aria-label',tr('תוצאות חיפוש','Search suggestions'));
  function choose(index,scroll=false){
    const choices=options();selected=choices[index];
    choices.forEach((choice,i)=>{if(!choice.id)choice.id=input.id+'-option-'+i;choice.setAttribute('role','option');choice.setAttribute('aria-selected',String(choice===selected));});
    if(selected){input.setAttribute('aria-activedescendant',selected.id);if(scroll)selected.scrollIntoView?.({block:'nearest',inline:'nearest'});}else input.removeAttribute('aria-activedescendant');
  }
  function refresh(reset=false){const previous=selected&&key(selected),choices=options(),index=reset?-1:choices.findIndex(choice=>key(choice)===previous);choose(index<0?0:index);}
  function clear(){choose(-1);}
  function submit(){
    if(!input.value.trim())return;
    const choice=!host.hidden&&(selected?.isConnected?selected:options()[0]);if(choice)choice.click();else submitSuggestedSearch(input.value);
  }
  function keydown(event){
    if(event.defaultPrevented||event.isComposing||event.keyCode===229||event.altKey||event.ctrlKey||event.metaKey)return;
    if(event.key==='Enter'&&event.target===input){event.preventDefault();event.stopPropagation();if(!event.repeat)submit();return;}
    if(!['ArrowDown','ArrowUp'].includes(event.key)||!input.value.trim()||(event.target!==input&&!host.contains(event.target)))return;
    event.preventDefault();event.stopPropagation();
    if(host.hidden||input.getAttribute('aria-expanded')!=='true')show();
    const choices=options();if(!choices.length)return;
    const index=choices.indexOf(event.target===input?selected:event.target.closest(selector));
    if(event.target!==input)input.focus({preventScroll:true});
    choose(index<0?(event.key==='ArrowDown'?0:choices.length-1):(index+(event.key==='ArrowDown'?1:-1)+choices.length)%choices.length,true);
  }
  host.addEventListener('focusin',event=>{const index=options().indexOf(event.target.closest(selector));if(index>=0)choose(index);});
  return {refresh,clear,submit,keydown};
}
function peopleSuggestions(people){
  return people.map(person=>'<li role="presentation" class="site-search-suggestion"><a class="site-search-person" href="#person/'+encodeURIComponent(person.id)+'" data-site-search-person="'+safe(person.id)+'">'+portrait(person)+'<span><strong>'+safe(personName(person))+'</strong><small>'+tr('לפתיחת הפרופיל','Open profile')+'</small></span><span class="site-search-chevron" aria-hidden="true">'+(I.isEnglish?'→':'←')+'</span></a></li><li role="presentation" class="site-search-suggestion site-search-content-suggestion"><button class="site-search-person site-search-content-action" type="button" data-site-search-related="'+safe(person.id)+'"><span class="site-search-content-icon">'+contentSearchIcon+'</span><span><strong>'+tr('כל התכנים של ','All content for ')+safe(personName(person))+'</strong><small>'+tr('תמונות, סרטונים, זיכרונות ועוד','Photos, videos, memories and more')+'</small></span><span class="site-search-chevron" aria-hidden="true">'+(I.isEnglish?'→':'←')+'</span></button></li>').join('');
}
function sectionSuggestions(sections){
  return sections.map(section=>'<li role="presentation" class="site-search-suggestion site-search-section-suggestion"><a class="site-search-person site-search-section" href="#'+section.id+'" data-site-search-section="'+section.id+'"><span class="site-search-section-icon" aria-hidden="true"><svg viewBox="0 0 48 48" focusable="false"><use href="assets/home-icons.svg?v=voices-v2#'+section.id+'"></use></svg></span><span><strong>'+safe(section.name)+'</strong><small>'+tr('פתיחת הקטגוריה','Open category')+'</small></span><span class="site-search-chevron" aria-hidden="true">'+(I.isEnglish?'→':'←')+'</span></a></li>').join('');
}
function selectSuggestion(event){
  const section=event.target.closest('[data-site-search-section]');if(section){event.preventDefault();openSection(section.dataset.siteSearchSection);return;}
  const person=event.target.closest('[data-site-search-person]');if(person){event.preventDefault();openProfile(person.dataset.siteSearchPerson);return;}
  const related=event.target.closest('[data-site-search-related]');if(related){const p=roster().find(p=>p.id===related.dataset.siteSearchRelated);if(p)search(personName(p),p.id);}
}
function suggestions(reset=false){
  const query=$('siteSearchQuickInput').value.trim(),people=suggestPeople(roster(),query),sections=matchingSections(query),host=$('siteSearchSuggestions');
  host.innerHTML=peopleSuggestions(people)+sectionSuggestions(sections);
  $('siteSearchQuickInput').setAttribute('aria-expanded',String(Boolean(query)));
  const free=$('siteSearchFree');free.hidden=!query;free.querySelector('span').textContent=tr('חיפוש חופשי של ״','Search all content for “')+query+tr('״','”');
  $('siteSearchQuickHint').textContent=!query?tr('חפשו בן משפחה, קטגוריה, מקום, אירוע או זיכרון','Search for a person, category, place, event or memory'):sections.length?tr('בחרו קטגוריה לפתיחה ישירה, או המשיכו לחיפוש חופשי','Open a category directly, or search all content'):!people.length?tr('אפשר לחפש את המילים האלה בכל תכני האתר','Search these words across the family website'):tr('בחרו פרופיל, את כל התכנים של האדם, או חיפוש חופשי של הטקסט','Choose a profile, all content for that person, or a free text search');
  quickNavigation?.refresh(reset);
}
function openQuick(){
  closeDesktop();
  $('siteSearchQuickInput').value=active()?params.get('q')||'':'';suggestions(true);
  dialog.showModal();button?.setAttribute('aria-expanded','true');$('siteSearchQuickInput').focus();
  window.FamilyPeopleRoster?.load().then(()=>{if(dialog.open)suggestions();}).catch(()=>{if(dialog.open)$('siteSearchQuickHint').textContent=tr('חלק מהשמות זמינים כרגע. החיפוש החופשי עדיין זמין.','Some names are available right now. You can still search all content.');});
}
function desktopSuggestions(reset=false){
  const query=desktopInput.value.trim();
  $('siteSearchDesktopSuggestions').innerHTML=peopleSuggestions(suggestPeople(roster(),query))+sectionSuggestions(matchingSections(query));
  $('siteSearchDesktopFree').querySelector('span').textContent=tr('חיפוש חופשי של ״','Search all content for “')+query+tr('״','”');
  desktopMenu.hidden=!query;desktopInput.setAttribute('aria-expanded',String(Boolean(query)));
  if(query)desktopNavigation.refresh(reset);else desktopNavigation.clear();
}
function mountDesktopSearch(actions){
  if(!actions)return;
  desktopForm=document.createElement('form');desktopForm.id='siteSearchDesktopForm';desktopForm.className='site-search-desktop';desktopForm.setAttribute('role','search');desktopForm.setAttribute('data-i18n-skip','');desktopForm.dir=I.isEnglish?'ltr':'rtl';
  desktopForm.innerHTML='<label class="site-search-desktop-field" for="siteSearchDesktopInput">'+magnifier+'<span class="site-search-sr">'+tr('חיפוש בכל האתר','Search the family website')+'</span><input id="siteSearchDesktopInput" type="search" inputmode="search" maxlength="200" autocomplete="off" placeholder="'+tr('חיפוש','Search')+'" aria-controls="siteSearchDesktopMenu" aria-expanded="false"></label><div id="siteSearchDesktopMenu" class="site-search-desktop-menu" hidden><ul id="siteSearchDesktopSuggestions" class="site-search-suggestions" role="presentation"></ul><button id="siteSearchDesktopFree" class="site-search-free" type="button">'+magnifier+'<span></span></button></div>';
  actions.prepend(desktopForm);desktopInput=$('siteSearchDesktopInput');desktopMenu=$('siteSearchDesktopMenu');
  desktopNavigation=suggestionNavigation(desktopInput,desktopMenu,desktopSuggestions);
  desktopInput.addEventListener('input',()=>desktopSuggestions(true));
  desktopInput.addEventListener('focus',()=>{
    desktopSuggestions();window.FamilyPeopleRoster?.load().then(()=>{if(!desktopMenu.hidden&&desktopForm.contains(document.activeElement))desktopSuggestions();}).catch(()=>{});
  });
  desktopForm.addEventListener('submit',event=>{event.preventDefault();desktopNavigation.submit();});
  desktopForm.addEventListener('click',selectSuggestion);
  $('siteSearchDesktopFree').addEventListener('click',()=>search(desktopInput.value));
  desktopForm.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&!desktopMenu.hidden){event.preventDefault();event.stopPropagation();desktopInput.focus();closeDesktop();return;}
    desktopNavigation.keydown(event);
  });
  desktopForm.addEventListener('focusout',event=>{if(event.relatedTarget&&!desktopForm.contains(event.relatedTarget))closeDesktop();});
  document.addEventListener('click',event=>{if(!desktopForm.contains(event.target))closeDesktop();});
  window.addEventListener('resize',closeDesktop);
  desktopForm.addEventListener('error',event=>{if(event.target.tagName==='IMG')event.target.remove();},true);
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
  const host=name==='home'?document.querySelector('[data-home-install-actions]'):headerSlot;
  if(button&&host&&button.parentElement!==host)host.append(button);
  if(name==='search')load();else if(controller){controller.abort();epoch++;lastKey=null;pending=false;view.removeAttribute('aria-busy');}
}
function init(){
  view=$('siteSearchView');if(!view)return;renderShell();
  button=document.createElement('button');button.type='button';button.dataset.siteSearchOpen='';button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-controls','siteSearchDialog');button.setAttribute('aria-expanded','false');button.setAttribute('aria-label',tr('חיפוש בכל האתר','Search the family website'));button.innerHTML=magnifier+'<span>'+tr('חיפוש','Search')+'</span>';
  headerSlot=document.createElement('div');headerSlot.className='site-search-header-slot';document.querySelector('.site-header')?.append(headerSlot);
  const brand=document.querySelector('#homeLink>span');if(brand)brand.innerHTML='<span class="brand-title-line">'+tr('בית משפחת','Keha Family')+'</span> <span class="brand-title-line">'+tr('קהא','Home')+'</span>';
  const actions=document.querySelector('[data-home-install-actions]');actions?.append(button);button.addEventListener('click',openQuick);mountDesktopSearch(actions);
  dialog=document.createElement('dialog');dialog.id='siteSearchDialog';dialog.className='site-search-dialog';dialog.setAttribute('aria-labelledby','siteSearchQuickTitle');dialog.setAttribute('data-i18n-skip','');
  dialog.innerHTML='<header class="site-search-dialog-heading"><h2 id="siteSearchQuickTitle">'+tr('מה מחפשים במשפחה?','What are you looking for?')+'</h2><button type="button" class="site-search-close" data-site-search-close aria-label="'+tr('סגירה','Close')+'">×</button></header><form id="siteSearchQuickForm" role="search"><label for="siteSearchQuickInput" class="site-search-sr">'+tr('שם או מילות חיפוש','Name or search words')+'</label><div class="site-search-field">'+magnifier+'<input id="siteSearchQuickInput" type="search" inputmode="search" maxlength="200" autocomplete="off" aria-controls="siteSearchSuggestions" aria-expanded="false" placeholder="'+tr('למשל: רועי','For example: Roei')+'"><button type="submit">'+tr('חיפוש','Search')+'</button></div></form><p class="site-search-hint" id="siteSearchQuickHint" role="status"></p><div id="siteSearchQuickOptions"><ul id="siteSearchSuggestions" class="site-search-suggestions" role="presentation"></ul><button type="button" class="site-search-free" id="siteSearchFree" hidden>'+magnifier+'<span></span></button></div>';
  document.body.append(dialog);
  for(const element of [dialog,view])element.addEventListener('error',event=>{if(event.target.tagName==='IMG')event.target.remove();},true);
  dialog.querySelector('[data-site-search-close]').addEventListener('click',closeDialog);
  quickNavigation=suggestionNavigation($('siteSearchQuickInput'),$('siteSearchQuickOptions'),suggestions);
  $('siteSearchQuickInput').addEventListener('input',()=>suggestions(true));
  $('siteSearchQuickForm').addEventListener('submit',event=>{event.preventDefault();quickNavigation.submit();});
  $('siteSearchFree').addEventListener('click',()=>search($('siteSearchQuickInput').value));
  dialog.addEventListener('click',selectSuggestion);
  dialog.addEventListener('keydown',quickNavigation.keydown);
  dialog.addEventListener('close',()=>{quickNavigation.clear();$('siteSearchQuickInput').setAttribute('aria-expanded','false');button.setAttribute('aria-expanded','false');if(!button.closest('[hidden]'))button.focus();});
  for(const name of ['hashchange','popstate'])window.addEventListener(name,()=>{closeDialog();if($('siteSearchContentDialog')?.open)$('siteSearchContentDialog').close();if(location.hash.split('/')[0]==='#search'){window.FamilyApp?.setView('search',false);activate('search');}});
  for(const name of ['family-media-changed','family-person-changed'])window.addEventListener(name,()=>{lastKey=null;if(active())load();});
  const content=document.createElement('dialog');content.id='siteSearchContentDialog';content.className='site-search-dialog site-search-content-dialog';content.setAttribute('aria-labelledby','siteSearchContentTitle');content.addEventListener('close',()=>content.querySelector('audio')?.pause());document.body.append(content);
  window.FamilySiteSearch={activate,open:openQuick};activate(window.FamilyApp?.getView()||location.hash.slice(1).split('/')[0]);
}
init();
