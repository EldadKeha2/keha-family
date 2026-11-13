(() => {
  'use strict';
  const $=id=>document.getElementById(id),I=window.FamilyI18n,english=I.isEnglish;
  const tr=(he,en)=>english?en:he,safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normalize=value=>String(value||'').normalize('NFKD').replace(/[\u0591-\u05c7'"׳״]/g,'').toLowerCase();
  const state={collection:null,library:null,eventId:null,categoryId:null,query:'',uploadChoice:'',assignId:null,newEventAssignId:null,hoverTimer:null,closeTimer:null,closing:false};
  const eventName=event=>english?(event.nameEn||event.name):event.name;
  const categoryName=category=>english?(category.nameEn||category.name):category.name;
  const eventsText=n=>english?`${n} ${n===1?'event':'events'}`:n===1?'אירוע אחד':`${n} אירועים`;
  const videosText=n=>english?`${n} ${n===1?'video':'videos'}`:n===1?'סרטון אחד':`${n} סרטונים`;
  const dateText=date=>window.FamilyPhotoDate?.text?.(date)||[date?.day,date?.month,date?.year].filter(Boolean).join('.');
  const iconPaths={cake:'M16 30h32v20H16zM12 50h40M16 38c4 6 7-6 11 0s7-6 11 0 7-6 10 0M23 24v6m9-6v6m9-6v6M23 19v-3m9 3v-3m9 3v-3',lantern:'M22 18h20l7 12-4 20H19l-4-20zM22 18l10-9 10 9M15 30h34M26 31v17m12-17v17M29 55h6',spark:'m32 9 7 16 17 7-17 7-7 17-7-17L9 32l16-7zM48 10v9m-4-4h9M12 46v8m-4-4h8',camera:'M12 22h10l5-7h12l5 7h9v29H12zM43 28h4M42 36a10 10 0 1 1-20 0 10 10 0 0 1 20 0z',olive:'M18 54c18-6 20-29 29-43M26 45c-12 2-13-8-13-8 10-4 14 1 13 8zM32 35c-12-1-11-11-11-11 11-2 14 4 11 11zM36 25c-7-7-2-14-2-14 9 3 9 9 2 14zM28 43c2-10 13-8 13-8 1 10-7 12-13 8zM37 30c4-10 13-7 13-7-1 10-9 12-13 7z',scroll:'M18 15h28v37H18M18 15c-10-8-13 7-3 7h3m28-7c10-8 13 7 3 7h-3M18 43c-10-8-13 7-3 7h3m28-7c10-8 13 7 3 7h-3M25 25h14m-14 7h14m-14 7h10'};
  const icon=key=>`<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${iconPaths[key]||iconPaths.spark}"/></svg>`;
  const sparkle='<span class="nostalgia-sparkle" aria-hidden="true">✧</span>';
  const allItems=()=>state.collection?.items||[];
  const getEvent=id=>state.library?.events.find(event=>event.id===id);
  const mediaSearch=item=>normalize([item.name,item.nameEn,item.caption,...(item.tags||[]).flatMap(tag=>[tag.name,tag.nameEn])].join(' '));
  function sequence(item){const match=/(?:קטע|חלק|part|segment)\s*(\d+)/i.exec(item.name||item.filename||'');return match?Number(match[1]):null;}
  function viewItems(collection,eventId){
    const items=collection.items.filter(item=>eventId?(item.nostalgiaEventIds||[]).includes(eventId):!(item.nostalgiaEventIds||[]).length);
    if(eventId)items.sort((a,b)=>{const x=sequence(a),y=sequence(b);return x!==null&&y!==null?x-y:String(a.uploadedAt||'').localeCompare(String(b.uploadedAt||''));});
    return items;
  }
  function routeEvent(){const match=/^#nostalgia\/event\/([^/?#]+)/.exec(location.hash);try{return match?decodeURIComponent(match[1]):null;}catch{return null;}}
  function navigate(eventId){closeCategory(true);const url=eventId?'#nostalgia/event/'+encodeURIComponent(eventId):'#nostalgia';if(window.FamilyNavigation)window.FamilyNavigation.go(url);else location.hash=url;window.FamilyArchive?.renderNostalgia?.();$('nostalgiaView')?.scrollIntoView({block:'start'});}
  function matchingEvents(categoryId){
    return (state.library?.events||[]).filter(event=>(!categoryId||event.categoryId===categoryId)&&(!state.query||normalize(eventName(event)+' '+event.location).includes(state.query)||allItems().some(item=>(item.nostalgiaEventIds||[]).includes(event.id)&&mediaSearch(item).includes(state.query))));
  }
  function categoryCards(){
    const grid=$('nostalgiaCategories');if(!grid||!state.library)return;
    const categories=state.library.categories.filter(c=>!state.query||normalize(categoryName(c)).includes(state.query)||matchingEvents(c.id).length);
    const signature=JSON.stringify([state.query,categories,state.library.events.map(e=>[e.id,e.revision,e.count])]);if(grid.dataset.signature===signature)return;grid.dataset.signature=signature;
    grid.innerHTML=categories.map((category,index)=>{const events=state.library.events.filter(e=>e.categoryId===category.id),count=events.reduce((n,e)=>n+e.videoCount,0);return `<button type="button" class="nostalgia-category-card theme-${safe(category.color)}" data-nostalgia-category="${safe(category.id)}" aria-haspopup="dialog" aria-controls="nostalgiaCategoryDialog" style="--card-index:${index}"><span class="nostalgia-card-layers" aria-hidden="true"></span><span class="nostalgia-card-face"><span class="nostalgia-card-ornament" aria-hidden="true">◆ · ◆ · ◆</span><span class="nostalgia-category-icon">${icon(category.icon)}</span><span class="nostalgia-category-name">${safe(categoryName(category))}</span><span class="nostalgia-category-stats">${eventsText(events.length)}<i>·</i>${videosText(count)}</span><span class="nostalgia-category-open">${tr('פותחים את הזיכרונות','Open the memories')} <b aria-hidden="true">↗</b></span>${sparkle}</span></button>`;}).join('')+`<button type="button" class="nostalgia-new-category" data-nostalgia-new-category><span aria-hidden="true">＋</span><strong>${tr('קטגוריה נוספת','Another category')}</strong><small>${tr('עוד מקום לסיפור שלכם','Room for another story')}</small></button>`;
  }
  function uploadSelector(){
    let host=$('nostalgiaUploadTarget');if(!host){host=document.createElement('div');host.id='nostalgiaUploadTarget';host.className='nostalgia-upload-target';host.setAttribute('data-i18n-skip','');$('nostalgiaDropzone').insertBefore(host,$('nostalgiaUploadState'));}
    const signature=JSON.stringify(state.library.categories.map(c=>[c.id,c.name,c.nameEn]))+JSON.stringify(state.library.events.map(e=>[e.id,e.name,e.nameEn,e.categoryId]));
    if(host.dataset.signature!==signature){host.dataset.signature=signature;host.innerHTML=`<label for="nostalgiaUploadEvent">${tr('לאיזה אירוע להוסיף?','Which event should these belong to?')}</label><select id="nostalgiaUploadEvent"><option value="">${tr('אירועים לא מתויגים — ללא שיוך','Unclassified — no event selected')}</option>${state.library.categories.map(category=>`<optgroup label="${safe(categoryName(category))}">${state.library.events.filter(e=>e.categoryId===category.id).map(event=>`<option value="${safe(event.id)}">${safe(eventName(event))}</option>`).join('')}</optgroup>`).join('')}</select><button type="button" class="quiet-button" data-nostalgia-new-event>${tr('＋ יצירת אירוע','＋ Create an event')}</button><small>${tr('בלי בחירת אירוע, הפריטים יישמרו באזור הלא מתויג.','If no event is selected, files stay in the unclassified area.')}</small>`;}
    $('nostalgiaUploadEvent').value=state.uploadChoice;
  }
  function select(collection,{query='',filter='all'}={}){
    state.collection=collection;state.library=collection.library;state.query=normalize(query);
    const requested=routeEvent(),event=getEvent(requested),eventId=event?.id||null;
    if(state.eventId!==eventId){state.eventId=eventId;state.uploadChoice=eventId||'';}
    $('nostalgiaLibraryHome').hidden=Boolean(event);$('nostalgiaEventHeader').hidden=!event;
    if(event){
      const category=state.library.categories.find(c=>c.id===event.categoryId),header=$('nostalgiaEventHeader'),signature=JSON.stringify([event,category]);
      if(header.dataset.signature!==signature){header.dataset.signature=signature;header.innerHTML=`<div class="nostalgia-event-backbar"><button type="button" class="secondary-button" data-nostalgia-home>← ${tr('לספריית הזיכרונות','Memory library')}</button><button type="button" class="quiet-button" data-nostalgia-category="${safe(category.id)}">${safe(categoryName(category))}</button><button type="button" class="quiet-button" data-nostalgia-edit-event="${safe(event.id)}">✎ ${tr('עריכת פרטי האירוע','Edit event details')}</button></div><div class="nostalgia-event-title theme-${safe(category.color)}"><span class="nostalgia-event-seal">${icon(category.icon)}</span><span class="small-eyebrow">${tr('אירוע אחד, כל הרגעים','One occasion, all its moments')}</span><h3>${safe(eventName(event))}</h3><div class="nostalgia-event-meta">${dateText(event.date)?`<span>◷ <bdi>${safe(dateText(event.date))}</bdi></span>`:''}${event.location?`<span>⌖ ${safe(event.location)}</span>`:''}<span>▻ ${videosText(event.videoCount)}</span></div><button type="button" class="primary-button" data-archive-upload="nostalgia" data-archive-kind="video">${tr('＋ הוספת סרטונים לאירוע','＋ Add videos to this event')}</button>${sparkle}</div>`;}
    }else categoryCards();
    const feed=$('nostalgiaFeedIntro'),signature=eventId||'unassigned';
    if(feed.dataset.signature!==signature){feed.dataset.signature=signature;feed.innerHTML=event?`<div><span class="small-eyebrow">${tr('לוחצים על רגע ונכנסים שוב לסיפור','Choose a moment and step back into the story')}</span><h4>${tr('הסרטונים והזיכרונות מהאירוע','Videos and memories from this event')}</h4></div>`:`<div><span class="small-eyebrow">${tr('כל זיכרון ימצא את המקום שלו','Every memory has a place')}</span><h4>${tr('אירועים לא מתויגים','Unclassified memories')}</h4><p>${tr('הוסיפו סרטונים כאן, ואז שייכו אותם לאירוע. אפשר גם לגרור את סמל השיוך אל אחת הספריות.','Upload videos here, then assign them to an event. You can also drag their event label onto a folder.')}</p></div>`;}
    uploadSelector();if($('nostalgiaCategoryDialog')?.open)renderCategory();
    let items=viewItems(collection,eventId);if(filter!=='all')items=items.filter(item=>item.kind===filter);
    if(state.query)items=items.filter(item=>mediaSearch(item).includes(state.query)||event&&normalize(eventName(event)).includes(state.query));
    return items;
  }
  function decorateCard(card,item){
    let box=card.querySelector('.nostalgia-item-events');if(!box){box=document.createElement('div');box.className='nostalgia-item-events';box.setAttribute('data-i18n-skip','');card.appendChild(box);}
    const names=(item.nostalgiaEventIds||[]).map(getEvent).filter(Boolean).map(eventName),signature=names.join('|');
    if(box.dataset.signature===signature)return;box.dataset.signature=signature;
    box.innerHTML=`<button type="button" draggable="true" class="nostalgia-assign-button" data-nostalgia-assign="${safe(item.id)}" data-nostalgia-drag="${safe(item.id)}" aria-haspopup="dialog"><span aria-hidden="true">▱</span><span>${names.length?safe(names.join(' · ')):tr('שיוך לאירוע','Assign to an event')}</span><b aria-hidden="true">＋</b></button>`;
  }
  function eventCover(event,category){
    if(event.cover&&event.coverKind==='photo')return `<img src="${safe(event.cover)}" alt="" loading="lazy" decoding="async">`;
    if(event.cover&&event.coverKind==='video')return `<video src="${safe(event.cover)}" preload="metadata" muted playsinline aria-hidden="true" tabindex="-1"></video>`;
    return `<span class="nostalgia-event-cover-icon">${icon(category.icon)}</span><span class="nostalgia-event-year">${safe(event.date?.year||'')}</span>`;
  }
  function renderCategory(){
    const category=state.library?.categories.find(c=>c.id===state.categoryId);if(!category)return;
    $('nostalgiaCategoryTitle').textContent=categoryName(category);
    $('nostalgiaCategoryDescription').textContent=tr('בחרו אירוע, או החליקו כדי לפגוש זיכרונות נוספים.','Choose an event, or swipe to discover more memories.');
    const rail=$('nostalgiaEventRail'),events=matchingEvents(category.id),signature=JSON.stringify(events);if(rail.dataset.signature===category.id+signature)return;rail.dataset.signature=category.id+signature;
    const categoryChanged=rail.dataset.categoryId!==category.id,scroll=categoryChanged?0:rail.scrollLeft;
    rail.dataset.categoryId=category.id;
    rail.innerHTML=events.map((event,index)=>`<div class="nostalgia-event-slot" style="--event-index:${Math.min(index,6)}"><button type="button" class="nostalgia-event-card theme-${safe(category.color)}" data-nostalgia-event="${safe(event.id)}"><span class="nostalgia-event-cover">${eventCover(event,category)}<span class="nostalgia-film-edge" aria-hidden="true"></span></span><span class="nostalgia-event-card-body"><span class="nostalgia-event-date">${dateText(event.date)?safe(dateText(event.date)):tr('מן האלבום המשפחתי','From the family album')}</span><strong>${safe(eventName(event))}</strong><span>${videosText(event.videoCount)}</span><small>${event.location?safe(event.location):tr('פותחים את האלבום','Open the album')} <b aria-hidden="true">↗</b></small></span></button></div>`).join('')+`<div class="nostalgia-event-slot"><button type="button" class="nostalgia-event-card nostalgia-add-event" data-nostalgia-new-event="${safe(category.id)}"><span class="nostalgia-plus-orbit" aria-hidden="true">＋</span><strong>${tr('עוד אירוע לספרייה','Another event for the library')}</strong><small>${tr('נותנים שם, ומוסיפים זיכרונות','Give it a name, then add memories')}</small></button></div>`;
    const behavior=rail.style.scrollBehavior;rail.style.scrollBehavior='auto';rail.scrollLeft=scroll;rail.style.scrollBehavior=behavior;
  }
  function openCategory(id){
    if($('nostalgiaView')?.hidden||!state.library?.categories.some(c=>c.id===id))return;
    const dialog=$('nostalgiaCategoryDialog');if(document.querySelector('dialog[open]')&&!dialog.open)return;
    clearTimeout(state.hoverTimer);clearTimeout(state.closeTimer);state.closeTimer=null;state.categoryId=id;state.closing=false;dialog.classList.remove('is-closing');renderCategory();
    if(!dialog.open){dialog.classList.remove('is-ready','is-closing');dialog.showModal();const paint=window.requestAnimationFrame||((fn)=>setTimeout(fn,0));paint(()=>paint(()=>dialog.classList.add('is-ready')));}
  }
  function closeCategory(immediate=false){
    const dialog=$('nostalgiaCategoryDialog');clearTimeout(state.hoverTimer);if(!dialog?.open)return;
    if(immediate||matchMedia('(prefers-reduced-motion: reduce)').matches){clearTimeout(state.closeTimer);state.closeTimer=null;state.closing=false;dialog.close();return;}
    if(state.closing)return;state.closing=true;dialog.classList.add('is-closing');state.closeTimer=setTimeout(()=>{state.closeTimer=null;if(dialog.open)dialog.close();state.closing=false;},170);
  }
  async function action(name,body){return window.FamilyArchive.nostalgiaAction(name,body);}
  function categoryOptions(selected){return state.library.categories.map(c=>`<option value="${safe(c.id)}" ${c.id===selected?'selected':''}>${safe(categoryName(c))}</option>`).join('');}
  function openEventForm(categoryId=null,eventId=null,assignId=null){
    const event=eventId?getEvent(eventId):null;state.newEventAssignId=assignId;
    const form=$('nostalgiaEventForm');form.reset();form.dataset.eventId=event?.id||'';form.dataset.revision=event?.revision||'';
    $('nostalgiaEventFormTitle').textContent=event?tr('פרטי האירוע','Event details'):tr('פותחים ספרייה לאירוע','A folder for another occasion');
    $('nostalgiaEventCategory').innerHTML=categoryOptions(event?.categoryId||categoryId||state.categoryId||state.library.categories[0].id);
    $('nostalgiaEventName').value=event?.name||'';$('nostalgiaEventLocation').value=event?.location||'';
    for(const part of ['day','month','year'])$('nostalgiaEvent'+part).value=event?.date?.[part]||'';
    $('nostalgiaEventError').textContent='';$('nostalgiaEventDialog').showModal();
  }
  function openAssign(id){
    const item=allItems().find(item=>item.id===id);if(!item)return;state.assignId=id;
    $('nostalgiaAssignTitle').textContent=tr('באילו אירועים לשמור את הסרטון?','Which events should this memory belong to?');
    $('nostalgiaAssignChoices').innerHTML=state.library.categories.map(category=>`<fieldset><legend>${safe(categoryName(category))}</legend>${state.library.events.filter(e=>e.categoryId===category.id).map(event=>`<label><input type="checkbox" value="${safe(event.id)}" ${(item.nostalgiaEventIds||[]).includes(event.id)?'checked':''}><span>${safe(eventName(event))}</span></label>`).join('')||`<small>${tr('עדיין אין אירועים. אפשר ליצור את הראשון.','No events yet. Create the first one.')}</small>`}</fieldset>`).join('');
    $('nostalgiaAssignError').textContent='';$('nostalgiaAssignDialog').showModal();
  }
  function acceptDrop(event){
    const target=event.target.closest?.('[data-nostalgia-event]');if(!target)return false;
    const id=target.dataset.nostalgiaEvent,files=[...(event.dataTransfer?.files||[])],mediaId=event.dataTransfer?.getData('application/x-keha-memory');
    if(!files.length&&!mediaId)return false;event.preventDefault();event.stopPropagation();target.classList.remove('drop-ready');
    if(files.length){navigate(id);window.FamilyArchive.uploadToNostalgia(files,id);}
    else action('assign',{id:mediaId,add:[id]}).then(()=>window.FamilyApp?.toast(tr('הזיכרון נוסף לאירוע ✓','Memory added to the event ✓'))).catch(error=>window.FamilyApp?.toast(error.message));
    return true;
  }
  function createDialog(id,html,className='nostalgia-form-dialog'){
    const dialog=document.createElement('dialog');dialog.id=id;dialog.className=className;dialog.setAttribute('data-i18n-skip','');dialog.innerHTML=html;document.body.appendChild(dialog);return dialog;
  }
  function init(){
    if(!$('nostalgiaLibraryHome'))return;
    $('nostalgiaLibraryHome').innerHTML=`<header class="nostalgia-library-intro"><div class="nostalgia-library-kicker">${tr('מהאלבום, מהמגירה, מהלב','From the album, the drawer, the heart')}</div><h3>${tr('פותחים מגירה של זיכרונות','Open a drawer of memories')}</h3><p>${tr('יש ימים שנשארים איתנו. בחרו מדף, פתחו אירוע, וחזרו לרגע הביתה.','Some days stay with us. Choose a shelf, open an occasion, and step back home.')}</p><span class="nostalgia-library-stitch" aria-hidden="true">◇ · ◆ · ◇ · ◆ · ◇</span>${sparkle}${sparkle}${sparkle}</header><div class="nostalgia-library-heading"><div><span class="small-eyebrow">${tr('הסיפורים שלנו, לפי נושאים','Our stories, by theme')}</span><h4>${tr('כל מדף והסיפור שלו','Every shelf has its story')}</h4></div><span>${tr('עוברים על כרטיסייה ופותחים את האירועים','Hover or tap a card to discover its events')}</span></div><div class="nostalgia-categories" id="nostalgiaCategories"></div>`;
    createDialog('nostalgiaCategoryDialog',`<div class="nostalgia-category-panel"><button type="button" class="nostalgia-dialog-close" data-nostalgia-close-category aria-label="${tr('סגירה','Close')}">×</button><header><span class="small-eyebrow">${tr('מן המדף אל הרגעים','From the shelf to the moments')}</span><h3 id="nostalgiaCategoryTitle"></h3><p id="nostalgiaCategoryDescription"></p></header><div class="nostalgia-rail-wrap"><button type="button" class="nostalgia-rail-arrow rail-right" data-nostalgia-scroll="1" aria-label="${tr('גלילה ימינה','Scroll right')}">›</button><div class="nostalgia-event-rail" id="nostalgiaEventRail" tabindex="0" aria-label="${tr('אירועים בקטגוריה','Events in this category')}"></div><button type="button" class="nostalgia-rail-arrow rail-left" data-nostalgia-scroll="-1" aria-label="${tr('גלילה שמאלה','Scroll left')}">‹</button></div><p class="nostalgia-rail-hint">${tr('אפשר להחליק, לגרור או להשתמש בחצים','Swipe, drag, or use the arrows')} <span aria-hidden="true">↔</span></p></div>`,'nostalgia-category-dialog');
    createDialog('nostalgiaEventDialog',`<form id="nostalgiaEventForm"><button type="button" class="nostalgia-dialog-close" data-nostalgia-close="nostalgiaEventDialog" aria-label="${tr('סגירה','Close')}">×</button><span class="small-eyebrow">${tr('עוד סיפור לאלבום שלנו','Another story for our album')}</span><h3 id="nostalgiaEventFormTitle"></h3><label>${tr('שם האירוע','Event name')}<input id="nostalgiaEventName" maxlength="140" required></label><label>${tr('באיזה מדף?','Which shelf?')}<select id="nostalgiaEventCategory" required></select></label><fieldset class="nostalgia-date-inputs"><legend>${tr('תאריך האירוע — אם ידוע','Event date — if known')}</legend><label>${tr('יום','Day')}<input id="nostalgiaEventday" inputmode="numeric" type="number" min="1" max="31"></label><label>${tr('חודש','Month')}<input id="nostalgiaEventmonth" inputmode="numeric" type="number" min="1" max="12"></label><label>${tr('שנה','Year')}<input id="nostalgiaEventyear" inputmode="numeric" type="number" min="1000" max="9999"></label></fieldset><label>${tr('איפה זה היה?','Where was it?')}<input id="nostalgiaEventLocation" maxlength="240"></label><p class="form-error" id="nostalgiaEventError" role="alert"></p><button type="submit" class="primary-button">${tr('שמירת האירוע','Save event')}</button></form>`);
    createDialog('nostalgiaNewCategoryDialog',`<form id="nostalgiaNewCategoryForm"><button type="button" class="nostalgia-dialog-close" data-nostalgia-close="nostalgiaNewCategoryDialog" aria-label="${tr('סגירה','Close')}">×</button><span class="small-eyebrow">${tr('עוד מקום לזיכרונות','More room for memories')}</span><h3>${tr('מוסיפים מדף חדש','Add another shelf')}</h3><label>${tr('שם הקטגוריה','Category name')}<input id="nostalgiaNewCategoryName" maxlength="80" required></label><p class="form-error" id="nostalgiaNewCategoryError" role="alert"></p><button type="submit" class="primary-button">${tr('יצירת קטגוריה','Create category')}</button></form>`);
    createDialog('nostalgiaAssignDialog',`<form id="nostalgiaAssignForm"><button type="button" class="nostalgia-dialog-close" data-nostalgia-close="nostalgiaAssignDialog" aria-label="${tr('סגירה','Close')}">×</button><h3 id="nostalgiaAssignTitle"></h3><p>${tr('אפשר לבחור יותר מאירוע אחד. בלי סימון, הפריט יופיע באזור הלא מתויג.','Choose more than one event if needed. With none selected, the file stays unclassified.')}</p><div id="nostalgiaAssignChoices" class="nostalgia-assign-choices"></div><button type="button" class="quiet-button" data-nostalgia-new-event-for-item>${tr('＋ יצירת אירוע חדש','＋ Create a new event')}</button><p id="nostalgiaAssignError" class="form-error" role="alert"></p><button type="submit" class="primary-button">${tr('שמירת השיוך','Save selection')}</button></form>`);
    $('nostalgiaCategoryDialog').addEventListener('cancel',event=>{event.preventDefault();closeCategory();});
    $('nostalgiaCategoryDialog').addEventListener('click',event=>{if(event.target===$('nostalgiaCategoryDialog'))closeCategory();});
    document.addEventListener('click',event=>{
      const target=event.target.closest?.('button');if(!target)return;
      if(target.hasAttribute('data-nostalgia-close-category'))return closeCategory();
      if(target.dataset.nostalgiaClose)return $(target.dataset.nostalgiaClose).close();
      if(target.dataset.nostalgiaCategory)return openCategory(target.dataset.nostalgiaCategory);
      if(target.dataset.nostalgiaEvent)return navigate(target.dataset.nostalgiaEvent);
      if(target.hasAttribute('data-nostalgia-home'))return navigate(null);
      if(target.hasAttribute('data-nostalgia-new-category')){$('nostalgiaNewCategoryForm').reset();$('nostalgiaNewCategoryError').textContent='';$('nostalgiaNewCategoryDialog').showModal();return;}
      if(target.hasAttribute('data-nostalgia-new-event'))return openEventForm(target.dataset.nostalgiaNewEvent||null);
      if(target.dataset.nostalgiaEditEvent)return openEventForm(null,target.dataset.nostalgiaEditEvent);
      if(target.dataset.nostalgiaAssign)return openAssign(target.dataset.nostalgiaAssign);
      if(target.hasAttribute('data-nostalgia-new-event-for-item'))return openEventForm(null,null,state.assignId);
      if(target.dataset.nostalgiaScroll){const rail=$('nostalgiaEventRail');rail.scrollBy({left:Number(target.dataset.nostalgiaScroll)*Math.min(rail.clientWidth*.8,640),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}
    });
    document.addEventListener('pointerover',event=>{const button=event.target.closest?.('[data-nostalgia-category]');if(!button||!matchMedia('(hover:hover) and (pointer:fine)').matches||$('nostalgiaCategoryDialog').open)return;clearTimeout(state.hoverTimer);state.hoverTimer=setTimeout(()=>openCategory(button.dataset.nostalgiaCategory),230);});
    document.addEventListener('pointerout',event=>{if(event.target.closest?.('[data-nostalgia-category]')&&!event.relatedTarget?.closest?.('[data-nostalgia-category]'))clearTimeout(state.hoverTimer);});
    document.addEventListener('change',event=>{if(event.target.id==='nostalgiaUploadEvent')state.uploadChoice=event.target.value;});
    document.addEventListener('dragstart',event=>{const handle=event.target.closest?.('[data-nostalgia-drag]');if(handle){event.dataTransfer.setData('application/x-keha-memory',handle.dataset.nostalgiaDrag);event.dataTransfer.effectAllowed='copy';}});
    document.addEventListener('dragover',event=>{const card=event.target.closest?.('[data-nostalgia-event]'),category=event.target.closest?.('[data-nostalgia-category]');if(card){event.preventDefault();card.classList.add('drop-ready');}else if(category){event.preventDefault();if(state.dragCategory!==category.dataset.nostalgiaCategory){state.dragCategory=category.dataset.nostalgiaCategory;clearTimeout(state.hoverTimer);state.hoverTimer=setTimeout(()=>openCategory(state.dragCategory),450);}}});
    document.addEventListener('dragleave',event=>event.target.closest?.('[data-nostalgia-event]')?.classList.remove('drop-ready'));
    const clearDrag=()=>{state.dragCategory=null;clearTimeout(state.hoverTimer);document.querySelectorAll('.nostalgia-event-card.drop-ready').forEach(card=>card.classList.remove('drop-ready'));};
    document.addEventListener('dragend',clearDrag);
    document.addEventListener('drop',event=>{acceptDrop(event);clearDrag();},true);
    const rail=$('nostalgiaEventRail');let drag=null;
    rail.addEventListener('pointerdown',event=>{if(event.pointerType!=='mouse'||event.button!==0)return;drag={x:event.clientX,scroll:rail.scrollLeft,id:event.pointerId,moved:false};});
    rail.addEventListener('pointermove',event=>{if(!drag)return;const dx=event.clientX-drag.x;if(Math.abs(dx)>6&&!drag.moved){drag.moved=true;rail.setPointerCapture(drag.id);rail.classList.add('is-dragging');}if(drag.moved){event.preventDefault();rail.scrollLeft=drag.scroll-dx;}});
    const endDrag=()=>{if(drag?.moved){rail.classList.remove('is-dragging');setTimeout(()=>{drag=null;},0);}else drag=null;};rail.addEventListener('pointerup',endDrag);rail.addEventListener('pointercancel',endDrag);rail.addEventListener('click',event=>{if(drag?.moved){event.preventDefault();event.stopPropagation();}},true);
    rail.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight'].includes(event.key))return;event.preventDefault();rail.scrollBy({left:(event.key==='ArrowRight'?1:-1)*320,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});});
    $('nostalgiaEventForm').addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget,button=form.querySelector('[type=submit]');button.disabled=true;try{const date=Object.fromEntries(['day','month','year'].map(part=>[part,$('nostalgiaEvent'+part).value?Number($('nostalgiaEvent'+part).value):null]));const result=await action('event',{id:form.dataset.eventId||undefined,expectedRevision:form.dataset.revision||undefined,categoryId:$('nostalgiaEventCategory').value,name:$('nostalgiaEventName').value,location:$('nostalgiaEventLocation').value,date});$('nostalgiaEventDialog').close();if(state.newEventAssignId){await action('assign',{id:state.newEventAssignId,add:[result.event.id]});$('nostalgiaAssignDialog').close();state.newEventAssignId=null;}navigate(result.event.id);}catch(error){$('nostalgiaEventError').textContent=I.error(error.message);}finally{button.disabled=false;}});
    $('nostalgiaNewCategoryForm').addEventListener('submit',async event=>{event.preventDefault();const button=event.currentTarget.querySelector('[type=submit]');button.disabled=true;try{const result=await action('category',{name:$('nostalgiaNewCategoryName').value});$('nostalgiaNewCategoryDialog').close();openCategory(result.category.id);}catch(error){$('nostalgiaNewCategoryError').textContent=I.error(error.message);}finally{button.disabled=false;}});
    $('nostalgiaAssignForm').addEventListener('submit',async event=>{event.preventDefault();const button=event.currentTarget.querySelector('[type=submit]');button.disabled=true;try{const current=allItems().find(item=>item.id===state.assignId)?.nostalgiaEventIds||[],wanted=[...$('nostalgiaAssignChoices').querySelectorAll('input:checked')].map(input=>input.value);await action('assign',{id:state.assignId,add:wanted.filter(id=>!current.includes(id)),remove:current.filter(id=>!wanted.includes(id))});$('nostalgiaAssignDialog').close();}catch(error){$('nostalgiaAssignError').textContent=I.error(error.message);}finally{button.disabled=false;}});
    for(const event of ['hashchange','popstate'])window.addEventListener(event,()=>{if(/^#nostalgia(?:\/|$)/.test(location.hash))window.FamilyArchive?.renderNostalgia?.();else closeCategory(true);});
  }
  window.FamilyNostalgia={select,decorateCard,viewItems,acceptDrop,uploadEventId:()=>$('nostalgiaUploadEvent')?.value||null};
  document.addEventListener('DOMContentLoaded',init);
})();
