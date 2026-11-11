import {familyTimeline} from './family-timeline-data.mjs';

const I=window.FamilyI18n,$=id=>document.getElementById(id),app=()=>window.FamilyApp;
const tr=(he,en)=>I.isEnglish?en:he;
const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normalize=value=>String(value??'').normalize('NFKD').replace(/[\u0591-\u05c7'"׳״]/g,'').toLowerCase().trim();
const arrows={up:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 14 6-6 6 6"/></svg>',down:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 10 6 6 6-6"/></svg>'};
const icons={birth:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16v8H4zM4 16c2-3 4 3 6 0s4 3 6 0 3 0 4 0M8 12V8m4 4V7m4 5V8M8 5v-1m4 0V3m4 2V4"/></svg>',aliyah:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 16 9-3 8-8-3-2-8 8-6 1 2 2-2 2Zm7-4-3-7 3-2 4 5M7 21h14"/></svg>',wedding:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="15" r="6"/><circle cx="16" cy="15" r="6"/><path d="M12 8c-7-4-2-9 0-5 2-4 7 1 0 5Z"/></svg>'};
const state={view:'tree',ready:false,query:'',wedding:null,weddingLoaded:false,loading:false,error:false,active:'before-1930',chapters:[],signature:'',frame:0,renderFrame:0};
const personName=p=>I.personName(p);
const portrait=p=>{const name=personName(p),letters=name.split(/\s+/).filter(Boolean).map(s=>s[0]).slice(0,2).join('');return `<span class="ft-portrait"><span aria-hidden="true">${safe(letters)}</span>${p.profile?`<img src="${safe(p.profile)}" alt="" loading="lazy" decoding="async">`:''}</span>`;};
const dateLabel=event=>{
  const options={year:'numeric',timeZone:'UTC'};
  if(event.month)options.month='long';
  if(event.day)options.day='numeric';
  return new Intl.DateTimeFormat(I.locale,options).format(new Date(Date.UTC(event.year,(event.month||1)-1,event.day||1)));
};
const chapterTitle=chapter=>chapter.start===null?tr('לפני שנות ה־30','Before the 1930s'):I.isEnglish?`${chapter.start}s`:chapter.start<2000?`שנות ה־${String(chapter.start).slice(-2)}`:`שנות ה־${chapter.start}`;
const birthdayWord=count=>tr(count===1?'יום הולדת':'ימי הולדת',count===1?'birthday':'birthdays');
function weddingPhoto(){const record=state.wedding,items=record?.collection?.items||[],photo=items.find(p=>p.kind==='photo'&&(p.src===record.cover||p.src===record.collection?.cover))||items.find(p=>p.kind==='photo');return photo?.previewSrc||photo?.thumbnailSrc||photo?.src||record?.cover||'';}
function weddingCard(event,{hero=false}={}){
  const src=weddingPhoto(),label=tr('החתונה של יונה ושלמה','Yona and Shlomo’s wedding');
  const stamp=event?dateLabel(event):state.loading&&!state.weddingLoaded?tr('פותחים את אלבום החתונה…','Opening the wedding album…'):tr('שנת הנישואים טרם הוזנה','Wedding year not yet recorded');
  return `<a class="ft-wedding${hero?' ft-wedding-hero':''}" href="#weddings/u-root" aria-label="${safe(label)}"><span class="ft-wedding-photo">${src?`<img src="${safe(src)}" alt="${safe(label)}" ${hero?'':'loading="lazy"'} decoding="async">`:`<span class="ft-wedding-placeholder" aria-hidden="true">${icons.wedding}</span>`}</span><span class="ft-wedding-caption"><span class="ft-event-type">${icons.wedding}${tr('כאן מתחיל הסיפור שלנו','Where our story begins')}</span><strong>${label}</strong><small>${safe(stamp)}</small><span class="ft-wedding-link">${tr('לאלבום החתונה','Visit the wedding album')} <span aria-hidden="true">${I.isEnglish?'↗':'↖'}</span></span></span></a>`;
}
function eventCard(event){
  if(event.kind==='wedding')return `<li class="ft-event ft-event-wedding" data-timeline-event="${event.id}"><span class="ft-year-mark"><bdi>${event.year}</bdi></span>${weddingCard(event)}</li>`;
  const p=event.person,name=personName(p),birth=event.kind==='birth',branch=window.FAMILY_DATA.branches.find(b=>b.id===p.branch);
  const label=birth?tr(p.gender==='f'?'נולדה':'נולד','Born'):tr(p.gender==='f'?'עלתה לארץ':'עלה לארץ','Moved to Israel');
  return `<li class="ft-event ft-event-${event.kind}" data-timeline-event="${safe(event.id)}"><span class="ft-year-mark"><bdi>${event.year}</bdi></span><a class="ft-person-card" href="#person/${encodeURIComponent(p.id)}" style="--ft-branch:${branch?.color||'#7b8766'}" aria-label="${safe(name+' · '+label+' · '+dateLabel(event))}">${portrait(p)}<span class="ft-person-copy"><span class="ft-event-type">${icons[event.kind]}${label}</span><strong>${safe(name)}</strong><time datetime="${event.year}${event.month?'-'+String(event.month).padStart(2,'0'):''}${event.day?'-'+String(event.day).padStart(2,'0'):''}">${safe(dateLabel(event))}</time>${!birth?`<small>${event.month?tr('חודש ושנה מתועדים','Recorded month and year'):tr('שנת העלייה','Year of immigration')}</small>`:''}</span><span class="ft-card-leaf" aria-hidden="true">❧</span></a></li>`;
}
function matches(event,query){
  if(!query)return true;
  const p=event.person;
  return normalize([event.year,dateLabel(event),event.kind==='birth'?tr('יום הולדת לידה נולד נולדה','birthday birth born'):event.kind==='aliyah'?tr('עלייה לארץ','immigration Israel'):tr('חתונה נישואים יונה שלמה','wedding marriage Yona Shlomo'),p?I.searchNames(p):'',p?.id].join(' ')).includes(query);
}
function render(){
  if(!state.ready||state.view!=='timeline')return;
  const people=app().getPeople().map(p=>app().getPersonSummary(p.id)),model=familyTimeline({people,wedding:state.wedding}),query=normalize(state.query);
  const chapters=model.chapters.map(c=>({...c,events:c.events.filter(e=>matches(e,query))})).filter(c=>!query||c.events.length);
  state.chapters=chapters;
  const signature=JSON.stringify([I.language,state.query,state.weddingLoaded,state.loading,state.error,people.map(p=>[p.id,p.name,p.nameEn,p.birthday,p.invalidBirthday,p.profile,p.aliyahYear,p.aliyahMonth]),state.wedding]);
  if(signature===state.signature)return;state.signature=signature;
  const visibleBirths=chapters.reduce((n,c)=>n+c.events.filter(e=>e.kind==='birth').length,0);
  $('timelineContent').innerHTML=`<header class="ft-intro"><div class="ft-intro-copy"><span class="ft-eyebrow"><span aria-hidden="true">❖</span>${tr('משורש אחד, דורות של אהבה','One beginning, generations of love')}</span><h2>${tr('דור אחר דור,<br>הסיפור שלנו ממשיך.','Generation after generation,<br>our story grows.')}</h2><p>${tr('האנשים, השנים והרגעים שהפכו אותנו למשפחה.','The people, years and moments that made us a family.')}</p><div class="ft-intro-stats"><span><b>${model.birthCount}</b> ${tr('ימי הולדת על הציר','birthdays on the timeline')}</span><span><b>${model.chapters.length}</b> ${tr('פרקים בסיפור שלנו','chapters in our story')}</span></div></div>${weddingCard(model.marriage,{hero:true})}</header><div class="ft-layout"><nav class="ft-navigation" aria-label="${tr('מעבר בין עשורים','Browse decades')}"><span class="ft-nav-caption">${tr('העשורים שלנו','Our decades')}</span><div class="ft-mobile-navigation"><button type="button" data-timeline-step="-1" aria-label="${tr('לעשור הקודם','Previous decade')}">${arrows.up}</button><label class="ft-decade-select"><span class="visually-hidden">${tr('בחירת עשור','Choose a decade')}</span><select id="timelineDecadeSelect">${chapters.map(c=>`<option value="${c.id}">${chapterTitle(c)}</option>`).join('')}</select></label><button type="button" data-timeline-step="1" aria-label="${tr('לעשור הבא','Next decade')}">${arrows.down}</button></div><div class="ft-decade-links">${chapters.map(c=>`<button type="button" data-timeline-decade="${c.id}"><span>${chapterTitle(c)}</span><small>${c.events.filter(e=>e.kind==='birth').length}</small></button>`).join('')}</div><p class="ft-nav-help">${tr('גוללים בין השנים,<br>לוחצים על תמונה ופוגשים את הסיפור.','Scroll through the years.<br>Select a portrait to meet its story.')}</p></nav><div class="ft-chapters">${query?`<p class="ft-search-count" role="status">${visibleBirths} ${birthdayWord(visibleBirths)} ${tr('בחיפוש','found')}</p>`:''}${chapters.map(c=>`<section class="ft-chapter" id="ft-decade-${c.id}" aria-labelledby="ft-heading-${c.id}" data-timeline-chapter="${c.id}"><header class="ft-chapter-heading"><span class="ft-chapter-dot" aria-hidden="true">${c.start===null?'❖':'✦'}</span><div><span class="ft-chapter-range"><bdi>${c.start===null?tr('עד 1929','Up to 1929'):c.start+'–'+c.end}</bdi></span><h3 id="ft-heading-${c.id}">${chapterTitle(c)}</h3></div><span class="ft-chapter-count">${c.events.filter(e=>e.kind==='birth').length} ${birthdayWord(c.events.filter(e=>e.kind==='birth').length)}</span></header>${c.events.length?`<ol class="ft-events">${c.events.map(eventCard).join('')}</ol>`:`<div class="ft-quiet-decade"><span aria-hidden="true">❧</span><p>${tr('עוד מקום לזיכרונות מהעשור הזה','A little space for memories from this decade')}</p></div>`}</section>`).join('')||`<div class="ft-no-match"><h3>${tr('לא מצאנו רגע מתאים בחיפוש','No matching moments')}</h3><p>${tr('אפשר לנסות שם אחר או שנת לידה.','Try another name or birth year.')}</p><button type="button" data-timeline-reset>${tr('לכל ציר הזמן','Show the full timeline')}</button></div>`}<footer class="ft-closing"><span aria-hidden="true">❧</span><p>${tr('וכל שם חדש מוסיף עוד ענף לסיפור שלנו.','Every new name adds another branch to our story.')}</p>${model.unknown.length?`<small>${model.unknown.length} ${tr('בני משפחה יתווספו לציר כשיעודכן תאריך הלידה שלהם.','family members will join the timeline when their birth dates are recorded.')}</small>`:''}${state.error?`<p class="ft-load-error" role="status">${tr('אלבום החתונה לא נטען כרגע.','The wedding album could not be loaded.')} <button type="button" data-timeline-retry>${tr('ניסיון נוסף','Try again')}</button></p>`:''}</footer></div></div>`;
  if(!chapters.some(c=>c.id===state.active))state.active=chapters[0]?.id||'before-1930';
  setActive(state.active);scheduleScroll();
}
function setActive(id){
  state.active=id;
  for(const button of $('timelineContent').querySelectorAll('[data-timeline-decade]')){
    const active=button.dataset.timelineDecade===id;button.setAttribute('aria-current',String(active));
  }
  const select=$('timelineDecadeSelect');if(select)select.value=id;
  const index=state.chapters.findIndex(c=>c.id===id);
  for(const button of $('timelineContent').querySelectorAll('[data-timeline-step]'))button.disabled=Number(button.dataset.timelineStep)<0?index<=0:index>=state.chapters.length-1;
}
function goToDecade(id){
  const section=$('ft-decade-'+id);if(!section)return;
  setActive(id);
  const reduce=window.FamilyAccessibility?.isReducedMotion?.()||matchMedia('(prefers-reduced-motion: reduce)').matches;
  section.scrollIntoView({block:'start',behavior:reduce?'instant':'smooth'});
}
function scheduleScroll(){
  if(state.view!=='timeline'||state.frame)return;
  state.frame=requestAnimationFrame(()=>{
    state.frame=0;if(state.view!=='timeline'||!state.chapters.length)return;
    const edge=matchMedia('(max-width:700px)').matches?120:105;
    let active=state.chapters[0].id;
    for(const c of state.chapters){if($('ft-decade-'+c.id)?.getBoundingClientRect().top<=edge)active=c.id;else break;}
    if(active!==state.active)setActive(active);
  });
}
function scheduleRender(){if(state.renderFrame||state.view!=='timeline')return;state.renderFrame=requestAnimationFrame(()=>{state.renderFrame=0;render();});}
async function loadWedding(){
  if(state.loading)return;state.loading=true;state.error=false;render();
  try{
    const response=await I.fetch('api/weddings/u-root',{cache:'no-store'});
    if(!response.ok)throw Error();
    state.wedding=await response.json();state.weddingLoaded=true;
  }catch{state.error=true;}finally{state.loading=false;render();}
}
function activate(view){
  const entering=view==='timeline'&&state.view!==view;state.view=view;
  if(entering)state.query=$('searchInput').value;
  $('timelineView').setAttribute('aria-label',tr('ציר זמן משפחתי','Family Timeline'));
  $('timelineView').hidden=view!=='timeline';
  if(!state.ready||view!=='timeline')return;
  render();if(entering||!state.weddingLoaded)loadWedding();
}
function init(){
  state.ready=true;
  $('timelineContent').addEventListener('click',event=>{
    const target=event.target.closest('[data-timeline-decade],[data-timeline-step],[data-timeline-retry],[data-timeline-reset]');
    if(!target)return;
    if(target.hasAttribute('data-timeline-retry')){loadWedding();return;}
    if(target.hasAttribute('data-timeline-reset')){$('searchInput').value='';$('searchInput').dispatchEvent(new Event('input'));return;}
    if(target.dataset.timelineDecade){goToDecade(target.dataset.timelineDecade);return;}
    const index=state.chapters.findIndex(c=>c.id===state.active),next=state.chapters[index+Number(target.dataset.timelineStep)];if(next)goToDecade(next.id);
  });
  $('timelineContent').addEventListener('change',event=>{if(event.target.id==='timelineDecadeSelect')goToDecade(event.target.value);});
  window.addEventListener('scroll',scheduleScroll,{passive:true});window.addEventListener('resize',scheduleScroll);
  for(const event of ['family-people-loaded','family-person-changed','family-profile-changed'])window.addEventListener(event,scheduleRender);
  activate(app().getView());
}
window.FamilyTimeline={activate,search(query){state.query=query;render();}};
if(!app())document.addEventListener('DOMContentLoaded',init,{once:true});else init();
