(() => {
  'use strict';
  const I=window.FamilyI18n,$=id=>document.getElementById(id),en=I.isEnglish;
  const t=(he,english)=>en?english:he;
  const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normalize=value=>String(value??'').normalize('NFKD').replace(/[\u0591-\u05c7'"׳״]/g,'').toLowerCase().trim();
  const categories=[
    {id:'roots',title:t('סיפורי שורשים','Our roots'),hint:t('מאין באנו','Where our story began'),intro:t('המסעות, הבתים והאנשים שמהם צמחה המשפחה שלנו.','The journeys, homes and people our family grew from.'),icon:'M12 21v-8m0 4-6 4m6-4 6 4M7 13c-6 0-5-7-1-7 0-6 10-6 10 0 5 0 6 7 1 7Z'},
    {id:'people',title:t('זיכרונות מאנשים','People we remember'),hint:t('האנשים שבלב','The people in our hearts'),intro:t('משפט, מחווה או רגע שנשאר איתנו מאדם אהוב.','A word, a gesture, a moment with someone dear.'),icon:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m18 0v-2a4 4 0 0 0-3-4M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8m7 0a4 4 0 0 1 0 8'},
    {id:'family',title:t('זיכרונות משפחתיים','Family memories'),hint:t('הרגעים שלנו יחד','The moments we share'),intro:t('המפגשים, המסורות וכל הרגעים שהופכים אותנו למשפחה.','Our gatherings, traditions and the moments that make us a family.'),icon:'m3 11 9-8 9 8m-16-2v12h14V9m-10 12v-7h6v7'},
    {id:'childhood',title:t('זיכרונות ילדות','Childhood memories'),hint:t('כשהיינו ילדים','When we were little'),intro:t('המשחקים, החופשות, הריחות וההרפתקאות של פעם.','The games, holidays, familiar scents and adventures of childhood.'),icon:'m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z'},
    {id:'funny',title:t('סיפורים מצחיקים','Family laughter'),hint:t('עד היום אנחנו צוחקים','Still making us smile'),intro:t('התקריות הקטנות והסיפורים שאף פעם לא נמאס לספר.','The little mishaps and stories we never tire of telling.'),icon:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM7 9h.01M17 9h.01M7 14c2 5 8 5 10 0Z'}
  ];
  const category=id=>categories.find(c=>c.id===id)||categories[2];
  const state={view:null,query:'',category:'all',stories:[],recordings:[],revisions:{},loading:{},loaded:{},story:null,recording:null,uploadId:null,savingStory:false,savingVoice:false,flipTimer:null};
  const categorySaves=new Map(),categoryNotes=new Map();let storyEdits=0;
  const reduced=()=>window.FamilyAccessibility?.isReducedMotion?.()??matchMedia('(prefers-reduced-motion: reduce)').matches;
  async function request(path,options={}){
    const response=await I.fetch(path,{cache:'no-store',...options,headers:{...(options.body?{'X-Family-Token':window.FAMILY_API_TOKEN}:{}),...options.headers}});
    if(response.status===304)return null;
    let data;try{data=await response.json();}catch{throw Error(t('לא התקבלה תשובה מהשרת. נסו שוב.','The server did not respond. Please try again.'));}
    if(!response.ok)throw Error(I.error(data.error)||t('השינוי לא נשמר.','Your changes could not be saved.'));return data;
  }
  function bookHTML(){return `<span class="memory-book-stage" aria-hidden="true"><svg class="memory-book-art" viewBox="0 0 280 220"><defs><linearGradient id="memoryPaper" x2="1" y2=".3"><stop stop-color="#e8d5a8"/><stop offset=".18" stop-color="#fff8e4"/><stop offset=".82" stop-color="#f7eaca"/><stop offset="1" stop-color="#cdb681"/></linearGradient><linearGradient id="memoryCover" x2="1" y2="1"><stop stop-color="#60705a"/><stop offset=".5" stop-color="#344c3d"/><stop offset="1" stop-color="#263e32"/></linearGradient></defs><ellipse cx="140" cy="190" rx="108" ry="13" fill="#927544" opacity=".15"/><path d="M19 52Q78 24 139 52 199 24 261 52L267 182Q205 162 141 192 78 164 13 183Z" fill="#9a7741"/><path d="M24 47Q80 26 139 50V184Q80 158 19 175Z" fill="url(#memoryCover)"/><path d="M141 50Q198 25 256 46L260 176Q198 157 141 184Z" fill="url(#memoryPaper)"/><path d="M140 51v135M31 55Q80 40 127 56V169Q80 151 28 165Z" fill="none" stroke="#d4b575" stroke-width="1.4"/><path d="M39 62Q80 48 118 63V157Q78 143 36 155Z" fill="none" stroke="#d4b575" stroke-width=".6"/><path d="m77 69 8 12 14 1-4 14 8 12-13 7-5 14-13-6-14 4-3-14-12-9 10-10 1-15 15 1Z" fill="none" stroke="#dfbf7c" stroke-width="1.7"/><path d="m77 83 15 20-18 15-16-20Z" fill="none" stroke="#dfbf7c"/><circle cx="75" cy="101" r="7" fill="#bf9958"/><path d="m43 68 4-4 4 4-4 4Zm59 75 4-4 4 4-4 4Zm-60 0 4-4 4 4-4 4Zm62-75 4-4 4 4-4 4Z" fill="#dfbf7c"/><g fill="none" stroke="#bda47a" stroke-linecap="round"><path d="M158 70q39-14 80-6m-80 17q39-14 80-6m-80 18q39-14 80-6m-80 18q39-14 80-6m-80 18q28-11 54-9"/><path d="m197 131 6 9 11-1-4 10 6 9-11 2-5 9-7-8-11 1 3-11-7-8 11-3Z"/></g><path d="m150 175 12 4-1 24-9-8-7 4Z" fill="#b7684b"/><path d="M23 178q56-15 113 12m10 0q55-26 115-10" fill="none" stroke="#edddb6" stroke-width="2"/></svg><span class="memory-turn-sheet"><i>✧</i></span></span>`;}
  function worldHTML(){
    const stars=Array.from({length:18},(_,i)=>`<i class="memory-spark" style="--spark-x:${8+(i*37)%86}%;--spark-y:${5+(i*23)%87}%;--spark-delay:${(i%7)*-.8}s;--spark-size:${i%3===0?15:8}px">✦</i>`).join('');
    return `<div class="memory-world-frame" aria-hidden="true"></div><p class="memory-world-kicker">${t('לכל זיכרון יש שער. לכל משפחה יש ספר.','Every memory opens a door. Every family has a storybook.')}</p><div class="memory-sparks" aria-hidden="true">${stars}</div><svg class="memory-branches" viewBox="0 0 1000 620" preserveAspectRatio="none" aria-hidden="true"><g><path data-memory-branch="roots" d="M500 320C460 230 540 180 500 75"/><path data-memory-branch="people" d="M500 320C360 355 335 200 180 245"/><path data-memory-branch="family" d="M500 320C640 355 665 200 820 245"/><path data-memory-branch="childhood" d="M500 320C490 450 355 423 260 520"/><path data-memory-branch="funny" d="M500 320C510 450 645 423 740 520"/></g><g class="memory-branch-diamonds"><path d="m500 173 6 8-6 8-6-8ZM316 260l6 8-6 8-6-8Zm368 0 6 8-6 8-6-8ZM381 432l6 8-6 8-6-8Zm238 0 6 8-6 8-6-8Z"/></g></svg><button type="button" class="memory-book" id="memoryBook" aria-label="${t('כל הזיכרונות שלנו','All our memories')}" aria-pressed="true">${bookHTML()}<span class="memory-book-title">${t('הזיכרונות שלנו','Our memories')}</span><small>${t('ספר אחד. אינספור סיפורים.','One book. Countless stories.')}</small><span class="memory-book-ornament" aria-hidden="true">✧ ─ ◇ ─ ✧</span></button>${categories.map(c=>`<button type="button" class="memory-category memory-category-${c.id}" data-memory-category="${c.id}" aria-pressed="false"><span class="memory-category-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="${c.icon}"/></svg></span><strong>${safe(c.title)}</strong><small>${safe(c.hint)}</small><span class="memory-category-count" data-memory-count="${c.id}"></span></button>`).join('')}<p class="memory-world-hint">${t('בחרו שער, ודפדפו אל עולם של זיכרונות','Choose a door, and turn the page into a world of memories')}</p>`;
  }
  function chooseCategory(id,{scroll=true}={}){
    if(id!=='all'&&!categories.some(c=>c.id===id))return;
    state.category=id;const world=$('memoryWorld');world.dataset.category=id;
    for(const button of world.querySelectorAll('[data-memory-category]'))button.setAttribute('aria-pressed',String(button.dataset.memoryCategory===id));
    $('memoryBook').setAttribute('aria-pressed',String(id==='all'));
    clearTimeout(state.flipTimer);world.classList.remove('is-turning');
    if(!reduced()){void world.offsetWidth;world.classList.add('is-turning');}
    renderStories();
    state.flipTimer=setTimeout(()=>{world.classList.remove('is-turning');if(scroll&&state.view==='stories')$('memoryCollection').scrollIntoView({behavior:reduced()?'instant':'smooth',block:'start'});},reduced()?0:750);
  }
  class PeoplePicker{
    constructor(host,label){this.host=host;this.label=label;this.selected=new Map();this.serial=0;this.active=-1;this.results=[];}
    mount(tags=[]){
      this.serial++;this.selected=new Map(tags.map(person=>[person.id,person]));const id=this.host.id;
      this.host.innerHTML=`<label for="${id}Search">${safe(this.label)}</label><div class="memory-picker-chips"></div><div class="memory-picker-search"><input id="${id}Search" type="text" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="${id}Results" autocomplete="off" placeholder="${t('הקלידו שם כדי לתייג','Type a name to tag someone')}"><div class="memory-picker-results" id="${id}Results" role="listbox" aria-label="${t('בחירת אנשים','Choose people')}" hidden></div></div><p class="memory-picker-status" role="status"></p>`;
      this.input=this.host.querySelector('input');this.list=this.host.querySelector('[role=listbox]');this.status=this.host.querySelector('[role=status]');this.chips=this.host.querySelector('.memory-picker-chips');
      this.input.addEventListener('input',()=>this.search());this.input.addEventListener('focus',()=>this.search());
      this.input.addEventListener('keydown',event=>{
        if(event.key==='Escape'&&!this.list.hidden){event.preventDefault();event.stopPropagation();this.hide();return;}
        // Enter belongs to the name picker even while its network search is pending.
        // Never let a missing/hidden suggestion submit the surrounding story form.
        if(event.key==='Enter'){event.preventDefault();if(!this.list.hidden&&this.results.length)this.pick(this.results[Math.max(0,this.active)]);return;}
        if(!['ArrowDown','ArrowUp'].includes(event.key)||this.list.hidden||!this.results.length)return;
        event.preventDefault();
        this.active=(this.active+(event.key==='ArrowDown'?1:-1)+this.results.length)%this.results.length;this.highlight();
      });
      this.list.addEventListener('mousedown',event=>event.preventDefault());
      this.list.addEventListener('click',event=>{const button=event.target.closest('[data-memory-person]');if(button)this.pick(this.results.find(p=>p.id===button.dataset.memoryPerson));});
      this.chips.addEventListener('click',event=>{const button=event.target.closest('[data-memory-untag]');if(button){this.selected.delete(button.dataset.memoryUntag);this.renderChips();this.input.focus();}});
      this.input.addEventListener('blur',()=>setTimeout(()=>{if(!this.host.contains(document.activeElement))this.hide();},100));this.renderChips();
    }
    renderChips(){this.chips.innerHTML=[...this.selected.values()].map(p=>`<button type="button" class="memory-person-chip" data-memory-untag="${safe(p.id)}" aria-label="${t('הסרת התיוג של ','Remove tag for ')+safe(I.personName(p))}">${safe(I.personName(p))}<span aria-hidden="true">×</span></button>`).join('');}
    async search(){
      const serial=++this.serial;this.status.textContent=t('טוען שמות…','Loading names…');
      try{
        const people=await window.FamilyTags.findPeople(this.input.value);if(serial!==this.serial)return;
        this.results=people.filter(p=>!this.selected.has(p.id)).slice(0,20);this.active=this.results.length?0:-1;this.status.textContent='';
        this.list.innerHTML=this.results.map((p,i)=>`<button type="button" id="${this.host.id}Option${i}" role="option" aria-selected="${i===0}" data-memory-person="${safe(p.id)}"><strong>${safe(I.personName(p))}</strong><small>${safe(p.context||'')}</small></button>`).join('');
        this.list.hidden=!this.results.length;this.input.setAttribute('aria-expanded',String(!this.list.hidden));this.highlight();
        if(!this.results.length)this.status.textContent=t('לא נמצאו שמות נוספים. נסו איות אחר.','No more matching names. Try another spelling.');
      }catch(error){if(serial===this.serial){this.hide();this.status.textContent=error.message;}}
    }
    highlight(){for(const [i,button]of [...this.list.querySelectorAll('[role=option]')].entries())button.setAttribute('aria-selected',String(i===this.active));if(this.active>=0){this.input.setAttribute('aria-activedescendant',this.host.id+'Option'+this.active);this.list.children[this.active]?.scrollIntoView?.({block:'nearest'});}}
    pick(person){if(!person)return;if(this.selected.size>=150){this.status.textContent=t('אפשר לתייג עד 150 אנשים.','You can tag up to 150 people.');return;}this.selected.set(person.id,person);this.input.value='';this.renderChips();this.hide();this.input.focus();this.hide();}
    hide(){this.serial++;this.list.hidden=true;this.input.setAttribute('aria-expanded','false');this.input.removeAttribute('aria-activedescendant');if(this.status.textContent===t('טוען שמות…','Loading names…'))this.status.textContent='';}
    ids(){return [...this.selected.keys()];}
  }
  let storyPicker,voicePicker;
  function narratorPerson(item){
    // The storyteller is identified by the byline, never by the story's subjects.
    const author=normalize(item.author).split(/\s+מתוך\s+|\s+from\s+/i)[0].replace(/^(?:סבתא|סבתה|סבא|grandma|grandpa|grandmother|grandfather)\s+/i,'').replace(/\s+/g,' ');
    if(!author)return null;
    const roster=new Map();
    for(const p of [...Object.values(window.FAMILY_DATA?.people||{}),...(window.FamilyPeopleRoster?.snapshot?.()||[]),...(window.FamilyApp?.getPeople?.()||[])])roster.set(p.id,{...roster.get(p.id),...p,...window.FamilyApp?.getPersonSummary?.(p.id)});
    const people=[...roster.values()];
    const exact=people.filter(p=>[p.name,p.nameEn,...(p.aliases||[])].some(value=>value&&normalize(value).replace(/\s+/g,' ')===author));
    if(exact.length)return exact.length===1?exact[0]:null;
    const first=people.filter(p=>[p.firstName,p.name?.split(/\s+/)[0],p.nameEn?.split(/\s+/)[0]].some(value=>value&&normalize(value)===author));
    return first.length===1?first[0]:null;
  }
  function narratorHTML(item){
    const person=narratorPerson(item),label=person?I.personName(person):item.author||t('המספר או המספרת','Storyteller');
    const initials=String(label).trim().split(/\s+/).slice(0,2).map(part=>Array.from(part)[0]).join('');
    let src=typeof person?.profile==='string'?person.profile:'';
    if(/^\/media\/[a-f0-9]{32}(?:\?|$)/.test(src)&&!/[?&]thumbnail=/.test(src))src+=(src.includes('?')?'&':'?')+'thumbnail=1';
    return `<span class="memory-narrator-portrait" data-memory-narrator="${safe(item.id)}" aria-label="${safe(label)}"><span aria-hidden="true">${safe(initials)}</span>${src?`<img class="profile-photo" ${window.FamilyPhotoFraming?.profile(person)||''} src="${safe(src)}" alt="${safe(label)}" loading="lazy" decoding="async">`:''}</span>`;
  }
  function refreshNarratorPortraits(){
    for(const node of document.querySelectorAll('[data-memory-narrator]')){const item=state.stories.find(item=>item.id===node.dataset.memoryNarrator);if(item)node.outerHTML=narratorHTML(item);}
  }
  const tagsHTML=(item,kind)=>(item.tags||[]).map(p=>`<button type="button" class="memory-person-chip" data-memory-filter-person="${safe(p.id)}" data-memory-kind="${kind}">${safe(I.personName(p))}</button>`).join('');
  const filesHTML=files=>(files||[]).map(file=>`<a href="${safe(file.src)}" target="_blank" rel="noopener" download="${safe(file.name)}">▤ ${safe(file.name)} <span>↓</span></a>`).join('');
  function filterOptions(select,values,allLabel){
    const old=select.value;select.innerHTML=`<option value="all">${safe(allLabel)}</option>`+values.map(([id,label])=>`<option value="${safe(id)}">${safe(label)}</option>`).join('');select.value=values.some(([id])=>String(id)===old)?old:'all';
  }
  function peopleOptions(items){const people=new Map(items.flatMap(item=>(item.tags||[]).map(p=>[p.id,p])));return [...people.values()].sort((a,b)=>I.personName(a).localeCompare(I.personName(b),I.locale)).map(p=>[p.id,I.personName(p)]);}
  function categoryControl(item){
    const busy=categorySaves.has(item.id),note=categoryNotes.get(item.id),id='storyCategory-'+item.id;
    return `<div class="memory-card-category"><label for="${id}">${t('שיוך לקטגוריה','Memory category')}</label><select id="${id}" data-story-category="${item.id}" aria-label="${t('שיוך הזיכרון ','Category for ')+safe(item.title)}" aria-describedby="${id}Status" ${busy||!window.FamilyApp?.apiEnabled?'disabled':''}>${categories.map(c=>`<option value="${c.id}" ${(categorySaves.get(item.id)||category(item.category).id)===c.id?'selected':''}>${safe(c.title)}</option>`).join('')}</select><span id="${id}Status" class="memory-category-status${note?.failed?' is-error':''}" role="status">${safe(busy?t('שומר…','Saving…'):note?.message||'')}</span></div>`;
  }
  async function assignCategory(id,value){
    const item=state.stories.find(item=>item.id===id);if(!item||categorySaves.has(id)||category(item.category).id===value||!categories.some(c=>c.id===value)||!canWrite())return;
    categorySaves.set(id,value);categoryNotes.delete(id);storyEdits++;renderStories();
    try{
      const data=await request('api/stories/'+id+'/category',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({category:value,expectedUpdatedAt:item.updatedAt})});
      state.stories=state.stories.map(item=>item.id===id?data.story:item);state.revisions.stories=null;
      categoryNotes.set(id,{message:t('נשמר ✓','Saved ✓')});window.FamilyApp.toast(t('הזיכרון שויך ל','Memory moved to ')+category(value).title+' ✓');
    }catch(error){categoryNotes.set(id,{message:error.message,failed:true});}
    finally{categorySaves.delete(id);storyEdits++;renderStories();}
  }
  function renderStories(){
    const selected=state.category==='all'?null:category(state.category),all=state.stories.filter(item=>!selected||category(item.category).id===selected.id);
    $('memoryCollectionTitle').textContent=selected?.title||t('כל הזיכרונות שלנו','All our memories');
    $('memoryCollectionIntro').textContent=selected?.intro||t('כל אחד זוכר משהו אחר. ביחד, הסיפור שלנו מתמלא.','We each remember something different. Together, our story grows.');
    $('memoryCollectionEyebrow').textContent=selected?t('פרק מתוך הספר המשפחתי','A chapter from our family storybook'):t('דפים מהספר המשפחתי','Pages from our family storybook');
    for(const c of categories){const count=state.stories.filter(item=>category(item.category).id===c.id).length;$('memoryWorld').querySelector(`[data-memory-count="${c.id}"]`).textContent=count?`${count} ${t(count===1?'זיכרון':'זיכרונות',count===1?'memory':'memories')}`:'';}
    filterOptions($('storyYearFilter'),[...new Set(all.map(item=>item.year).filter(Boolean))].sort((a,b)=>a-b).map(year=>[year,year]),t('כל השנים','All years'));
    filterOptions($('storyPersonFilter'),peopleOptions(all),t('כל האנשים','Everyone'));
    const year=$('storyYearFilter').value,person=$('storyPersonFilter').value,q=normalize(state.query);
    const items=all.filter(item=>(year==='all'||item.year===Number(year))&&(person==='all'||item.tags?.some(p=>p.id===person))&&(!q||normalize([item.title,item.body,item.author,item.year,...(item.tags||[]).map(I.searchNames)].join(' ')).includes(q))).sort((a,b)=>$('storySort').value==='oldest'?(a.year??9999)-(b.year??9999)||a.createdAt.localeCompare(b.createdAt):b.createdAt.localeCompare(a.createdAt));
    $('storiesCount').textContent=state.loaded.stories?`${items.length} ${t(items.length===1?'זיכרון':'זיכרונות',items.length===1?'memory':'memories')}`:'';
    $('storiesEmpty').hidden=!state.loaded.stories||items.length>0;
    $('memoryEmptyText').textContent=all.length?t('לא נמצאו זיכרונות בסינון הזה. אפשר לשנות את הסינון או להוסיף זיכרון.','No memories match these filters. Change them or add a memory.'):selected?.intro||t('סיפור קטן, רגע גדול, או משהו שרק אתם זוכרים.','A small story, a big moment, or something only you remember.');
    $('storyTimeline').innerHTML=items.map(item=>`<article class="memory-card"><div class="memory-card-meta"><span>${safe(category(item.category).title)}</span>${item.year?`<bdi>${item.year}</bdi>`:''}</div><div class="memory-card-heading">${narratorHTML(item)}<h4><button type="button" data-open-story="${item.id}">${safe(item.title)}</button></h4></div><p class="memory-card-excerpt" dir="auto">${safe((item.body||'').slice(0,230))}${item.body?.length>230?'…':''}</p><div class="memory-card-people">${tagsHTML(item,'stories')}</div><div class="memory-card-footer"><span>${safe(item.author||'')}</span><button type="button" data-open-story="${item.id}">${t('פתיחת הזיכרון','Read memory')} <span aria-hidden="true">${en?'→':'←'}</span></button><button type="button" data-edit-story="${item.id}" aria-label="${t('עריכת הזיכרון ','Edit memory ')+safe(item.title)}">${t('עריכה','Edit')}</button></div>${categoryControl(item)}</article>`).join('');
  }
  function renderVoices({background=false}={}){
    if(background&&[...$('voiceList').querySelectorAll('audio')].some(a=>!a.paused))return;
    filterOptions($('voicePersonFilter'),peopleOptions(state.recordings),t('כל האנשים','Everyone'));
    const person=$('voicePersonFilter').value,q=normalize(state.query),items=state.recordings.filter(item=>(person==='all'||item.tags?.some(p=>p.id===person))&&(!q||normalize([item.title,item.body,item.author,item.year,...(item.tags||[]).map(I.searchNames)].join(' ')).includes(q)));
    const signature=JSON.stringify(items);if($('voiceList').dataset.signature!==signature){
      $('voiceList').querySelectorAll('audio').forEach(audio=>audio.pause());$('voiceList').dataset.signature=signature;
      $('voiceList').innerHTML=items.map(item=>`<article class="voice-card"><div class="voice-card-heading"><span class="voice-card-seal" aria-hidden="true">♫</span><div><h4>${safe(item.title)}</h4><p>${[item.year,item.author].filter(Boolean).map(safe).join(' · ')}</p></div><button type="button" class="voice-edit" data-edit-recording="${item.id}" aria-label="${t('עריכת ההקלטה ','Edit recording ')+safe(item.title)}">${t('עריכה','Edit')}</button></div><audio controls preload="none" src="${safe(item.src)}" aria-label="${safe(item.title)}"></audio>${item.body?`<p class="voice-description" dir="auto">${safe(item.body)}</p>`:''}<div class="voice-card-footer"><div class="memory-card-people">${tagsHTML(item,'voices')}</div><a href="${safe(item.src)}?download=1" download="${safe(item.filename)}">${t('הורדה','Download')} ↓</a></div></article>`).join('');
    }
    $('voicesCount').textContent=state.loaded.voices?`${items.length} ${t(items.length===1?'הקלטה':'הקלטות',items.length===1?'recording':'recordings')}`:'';
    $('voicesEmpty').hidden=!state.loaded.voices||items.length>0;
    $('voicesEmpty').querySelector('h4').textContent=state.recordings.length?t('לא נמצאו הקלטות בבחירה הזו','No recordings match your selection'):t('כאן שומרים את הקולות שלנו','A home for our family voices');
  }
  async function refresh(kind,force=false){
    if(!window.FamilyApp?.apiEnabled||state.loading[kind])return;state.loading[kind]=true;const startedEdit=storyEdits,status=$(kind==='stories'?'memoryStatus':'voicesStatus');
    if(!state.loaded[kind])status.textContent=t('פותחים את האלבום…','Opening the album…');
    try{const data=await request('api/'+(kind==='stories'?'stories':'voices'),{headers:!force&&state.revisions[kind]?{'If-None-Match':'"'+state.revisions[kind]+'"'}:{}});if(data){if(kind==='stories'&&(categorySaves.size||startedEdit!==storyEdits))return;state[kind==='stories'?'stories':'recordings']=data[kind==='stories'?'stories':'recordings'];state.revisions[kind]=data.revision;state.loaded[kind]=true;if(kind==='stories')renderStories();else renderVoices({background:!force});}status.textContent='';}
    catch(error){status.textContent=error.message;}finally{state.loading[kind]=false;}
  }
  function openStory(id){
    const item=state.stories.find(item=>item.id===id);if(!item)return;
    $('storyReaderBody').innerHTML=`<span class="story-reader-year">${safe(category(item.category).title)}${item.year?' · '+item.year:''}</span><h2 id="storyReaderTitle">${safe(item.title)}</h2><div class="story-reader-byline">${narratorHTML(item)}${item.author?`<p class="story-reader-author">${t('זיכרון מאת ','A memory by ')+safe(item.author)}</p>`:''}</div><div class="memory-card-people">${tagsHTML(item,'stories')}</div><div class="story-full-text" dir="auto">${safe(item.body)}</div>${item.attachments?.length?`<div class="attachment-list"><h3>${t('המסמכים שמלווים את הזיכרון','Documents accompanying this memory')}</h3>${filesHTML(item.attachments)}</div>`:''}<button type="button" class="secondary-button" data-edit-story="${item.id}">${t('עריכת הזיכרון','Edit memory')}</button>`;
    $('storyReader').showModal();
  }
  function canWrite(){if(window.FamilyApp?.apiEnabled)return true;window.FamilyApp?.toast(t('השמירה זמינה באתר המחובר.','Saving is available on the connected website.'));return false;}
  function editStory(id=null){
    if(!canWrite()||state.savingStory)return;const item=id?state.stories.find(item=>item.id===id):null;if(id&&!item)return;
    if($('storyReader').open)$('storyReader').close();state.story=item;$('storyForm').reset();
    $('storyEditorTitle').textContent=item?t('עורכים זיכרון','Edit a memory'):t('מוסיפים זיכרון','Add a memory');
    $('storyCategory').value=item?category(item.category).id:state.category==='all'?'family':state.category;
    for(const [id,key]of [['storyTitle','title'],['storyBody','body'],['storyAuthor','author'],['storyYear','year']])$(id).value=item?.[key]||'';
    $('storyYear').max=String(new Date().getFullYear());$('existingStoryFiles').innerHTML=filesHTML(item?.attachments);$('storyError').textContent='';storyPicker.mount(item?.tags||[]);$('storyEditor').showModal();
  }
  function editorBusy(dialog,busy){dialog.querySelectorAll('input,textarea,select,button').forEach(el=>{el.disabled=busy;});}
  async function saveStory(event){
    event.preventDefault();if(state.savingStory)return;const files=[...$('storyFiles').files];$('storyError').textContent='';
    if(files.length>10||files.some(f=>f.size>10*1024*1024)||files.reduce((n,f)=>n+f.size,0)>20*1024*1024){$('storyError').textContent=t('עד 10 קבצים, עד 10MB לקובץ ועד 20MB יחד.','Up to 10 files, 10MB each and 20MB total.');return;}
    const form=new FormData($('storyForm'));form.set('personIds',JSON.stringify(storyPicker.ids()));if(state.story)form.set('expectedUpdatedAt',state.story.updatedAt);
    state.savingStory=true;editorBusy($('storyEditor'),true);$('saveStory').textContent=t('שומר…','Saving…');
    try{
      const data=await request('api/stories'+(state.story?'/'+state.story.id:''),{method:'POST',body:form});
      state.stories=[data.story,...state.stories.filter(item=>item.id!==data.story.id)];state.loaded.stories=true;state.revisions.stories=null;state.query='';$('searchInput').value='';
      $('storyPersonFilter').value='all';$('storyYearFilter').value='all';chooseCategory(data.story.category,{scroll:false});$('storyEditor').close();window.FamilyApp.toast(t('עוד זיכרון נכנס לספר שלנו ✓','Another memory joins our storybook ✓'));
    }catch(error){$('storyError').textContent=error.message;}finally{state.savingStory=false;editorBusy($('storyEditor'),false);$('saveStory').textContent=t('שמירת הזיכרון','Save memory');}
  }
  function editRecording(id=null){
    if(!canWrite()||state.savingVoice)return;const item=id?state.recordings.find(item=>item.id===id):null;if(id&&!item)return;
    state.recording=item;state.uploadId=crypto.randomUUID().replaceAll('-','');$('voiceForm').reset();
    $('voiceEditorTitle').textContent=item?t('עריכת ההקלטה','Edit recording'):t('העלאת הקלטה','Upload a recording');$('saveRecording').textContent=item?t('שמירת הפרטים','Save details'):t('העלאת ההקלטה','Upload recording');
    for(const [id,key]of [['voiceTitle','title'],['voiceBody','body'],['voiceAuthor','author'],['voiceYear','year']])$(id).value=item?.[key]||'';
    $('voiceYear').max=String(new Date().getFullYear());$('voiceFileLabel').hidden=Boolean(item);$('voiceFile').required=!item;$('voiceExistingFile').hidden=!item;$('voiceExistingFile').textContent=item?.filename||'';
    $('voiceError').textContent='';$('voiceUploadStatus').textContent='';$('voiceProgress').hidden=true;voicePicker.mount(item?.tags||[]);$('voiceEditor').showModal();
  }
  function uploadAudio(file,fields){
    const metadata=btoa(Array.from(new TextEncoder().encode(JSON.stringify(fields)),b=>String.fromCharCode(b)).join(''));
    return new Promise((resolve,reject)=>{
      const xhr=new XMLHttpRequest();xhr.open('POST','api/voices/upload?uploadId='+state.uploadId+'&filename='+encodeURIComponent(file.name));xhr.setRequestHeader('X-Family-Token',window.FAMILY_API_TOKEN);xhr.setRequestHeader('X-Family-Recording',metadata);xhr.setRequestHeader('Content-Type',file.type||'application/octet-stream');
      xhr.upload.addEventListener('progress',event=>{if(!event.lengthComputable)return;$('voiceProgress').value=event.loaded/event.total*100;$('voiceUploadStatus').textContent=event.loaded===event.total?t('הקובץ הועבר. שומר את ההקלטה…','File transferred. Saving the recording…'):t('מעלה הקלטה… ','Uploading recording… ')+Math.round(event.loaded/event.total*100)+'%';});
      xhr.addEventListener('load',()=>{let data;try{data=JSON.parse(xhr.responseText);}catch{reject(Error(t('לא התקבל אישור לשמירה. נסו שוב.','No save confirmation. Please try again.')));return;}if(xhr.status>=200&&xhr.status<300)resolve(data);else reject(Error(I.error(data.error)||t('ההעלאה לא הושלמה.','Upload failed.')));});
      xhr.addEventListener('error',()=>reject(Error(t('החיבור נותק. אפשר לנסות שוב בלי לבחור מחדש את הקובץ.','Connection lost. You can retry without selecting the file again.'))));xhr.send(file);
    });
  }
  async function saveRecording(event){
    event.preventDefault();if(state.savingVoice)return;$('voiceError').textContent='';const file=$('voiceFile').files[0];
    if(!state.recording&&(!file||!file.size||file.size>90*1024*1024)){$('voiceError').textContent=t('בחרו הקלטה שאינה ריקה, עד 90MB.','Choose a nonempty recording up to 90MB.');return;}
    const fields={title:$('voiceTitle').value,body:$('voiceBody').value,author:$('voiceAuthor').value,year:$('voiceYear').value,personIds:voicePicker.ids()};
    state.savingVoice=true;editorBusy($('voiceEditor'),true);$('voiceProgress').hidden=Boolean(state.recording);$('voiceUploadStatus').textContent=t('שומר את ההקלטה…','Saving the recording…');
    try{
      const data=state.recording?await request('api/voices/'+state.recording.id,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...fields,expectedUpdatedAt:state.recording.updatedAt})}):await uploadAudio(file,fields);
      state.recordings=[data.recording,...state.recordings.filter(item=>item.id!==data.recording.id)];state.loaded.voices=true;state.revisions.voices=null;state.query='';$('searchInput').value='';$('voicePersonFilter').value='all';renderVoices();$('voiceEditor').close();window.FamilyApp.toast(t('הקול הזה נשמר איתנו ✓','This voice is now part of our family album ✓'));
    }catch(error){$('voiceError').textContent=error.message;$('voiceUploadStatus').textContent='';}finally{state.savingVoice=false;editorBusy($('voiceEditor'),false);$('saveRecording').textContent=state.recording?t('שמירת הפרטים','Save details'):t('העלאת ההקלטה','Upload recording');}
  }
  function activate(view){
    const changed=state.view!==view;state.view=view;$('storiesView').hidden=view!=='stories';$('voicesView').hidden=view!=='voices';
    if(view!=='voices')$('voiceList').querySelectorAll('audio').forEach(audio=>audio.pause());
    if(changed)state.query='';
    if(view==='stories'){renderStories();refresh('stories');window.FamilyPeopleRoster?.load?.().then(refreshNarratorPortraits).catch(()=>{});}else if(view==='voices'){renderVoices();refresh('voices');}
  }
  function init(){
    window.FamilyPeopleRoster?.subscribe?.(refreshNarratorPortraits);
    window.addEventListener('family-profile-changed',refreshNarratorPortraits);
    window.addEventListener('family-people-loaded',refreshNarratorPortraits);
    $('memoryWorld').innerHTML=worldHTML();storyPicker=new PeoplePicker($('storyPeoplePicker'),t('מי מופיע בזיכרון?','Who appears in this memory?'));voicePicker=new PeoplePicker($('voicePeoplePicker'),t('את מי שומעים בהקלטה?','Who can we hear in this recording?'));
    document.addEventListener('click',event=>{
      const c=event.target.closest('[data-memory-category]');if(c){chooseCategory(c.dataset.memoryCategory);return;}
      if(event.target.closest('#memoryBook')){chooseCategory('all');return;}
      const read=event.target.closest('[data-open-story]');if(read){openStory(read.dataset.openStory);return;}
      const edit=event.target.closest('[data-edit-story]');if(edit){editStory(edit.dataset.editStory);return;}
      if(event.target.closest('#newStory,[data-new-story]')){editStory();return;}
      const voice=event.target.closest('[data-edit-recording]');if(voice){editRecording(voice.dataset.editRecording);return;}
      if(event.target.closest('#newRecording,[data-new-recording]')){editRecording();return;}
      const person=event.target.closest('[data-memory-filter-person]');if(person){const voices=person.dataset.memoryKind==='voices',filter=$(voices?'voicePersonFilter':'storyPersonFilter');filter.value=person.dataset.memoryFilterPerson;if($('storyReader').open)$('storyReader').close();if(voices)renderVoices();else{$('storyYearFilter').value='all';renderStories();$('memoryCollection').scrollIntoView({block:'start',behavior:reduced()?'instant':'smooth'});}}
    });
    $('storyTimeline').addEventListener('change',event=>{if(event.target.matches('[data-story-category]'))assignCategory(event.target.dataset.storyCategory,event.target.value);});
    $('storyForm').addEventListener('submit',saveStory);$('voiceForm').addEventListener('submit',saveRecording);
    for(const id of ['storyPersonFilter','storyYearFilter','storySort'])$(id).addEventListener('change',renderStories);$('voicePersonFilter').addEventListener('change',()=>renderVoices());
    $('voiceFile').addEventListener('change',()=>{state.uploadId=crypto.randomUUID().replaceAll('-','');const file=$('voiceFile').files[0];if(file&&!$('voiceTitle').value)$('voiceTitle').value=file.name.replace(/\.[^.]+$/,'').replaceAll('_',' ');});
    for(const id of ['storyEditor','voiceEditor'])$(id).addEventListener('cancel',event=>{if(state.savingStory||state.savingVoice)event.preventDefault();});
    $('voiceList').addEventListener('play',event=>{if(event.target.tagName!=='AUDIO')return;$('voiceList').querySelectorAll('audio').forEach(audio=>{if(audio!==event.target)audio.pause();});},true);
    $('voiceList').addEventListener('ended',()=>renderVoices({background:true}),true);
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&['stories','voices'].includes(state.view))refresh(state.view);});
    setInterval(()=>{if(document.visibilityState!=='hidden'&&['stories','voices'].includes(state.view))refresh(state.view);},30000);
    window.addEventListener('beforeunload',event=>{if(state.savingStory||state.savingVoice||categorySaves.size||$('voiceEditor').open&&($('voiceFile').files.length||$('voiceTitle').value||$('voiceBody').value)){event.preventDefault();event.returnValue='';}});
    activate(window.FamilyApp?.getView?.()||'tree');
  }
  window.FamilyMemories={activate,search(query){state.query=query;if(state.view==='stories')renderStories();if(state.view==='voices')renderVoices();}};
  document.addEventListener('DOMContentLoaded',init);
})();
