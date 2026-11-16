(() => {
  'use strict';
  const I=window.FamilyI18n,$=id=>document.getElementById(id),tr=(he,en)=>I.isEnglish?en:he;
  const safe=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const state={active:false,loaded:false,loading:false,items:[],error:'',query:'',signature:'',archive:false};
  let timer,dialog,currentPhoto=null,currentAction=null;
  const symbols={smile:'<circle cx="12" cy="12" r="9"/><path d="M8 14c2 3 6 3 8 0M8 9h.01M16 9h.01"/>',wave:'<path d="M8 12V6a1.5 1.5 0 0 1 3 0v5-7a1.5 1.5 0 0 1 3 0v7-5a1.5 1.5 0 0 1 3 0v6-3a1.5 1.5 0 0 1 3 0v5c0 5-3 8-7 8-3 0-5-2-7-5l-2-3a1.5 1.5 0 0 1 2.4-1.8L8 15"/>',dance:'<path d="M14 3v12a3 3 0 1 1-3-3c1 0 2 .4 3 1M14 4l7-2v10a3 3 0 1 1-3-3c1 0 2 .4 3 1"/>'};
  const icon=id=>`<svg viewBox="0 0 24 24" aria-hidden="true">${symbols[id]||symbols.smile}</svg>`;
  const title=item=>I.isEnglish?item.titleEn||item.title:item.title;
  const preview=item=>item.previewSrc||item.thumbnailSrc||item.src;
  const actionTitle=action=>I.isEnglish?action.labelEn:action.label;
  const shortTitle=id=>({smile:tr('חיוך','Smile'),wave:tr('שלום','Wave'),dance:tr('ריקוד','Dance')})[id];
  const ready=action=>action.status==='ready'&&Boolean(action.videoSrc);
  function actionButton(item,action,inside=false){
    const available=ready(action),selected=inside&&currentAction===action.id;
    return `<button type="button" class="living-action${available?' is-ready':' is-pending'}" data-living-photo="${safe(item.id)}" data-living-action="${safe(action.id)}" ${available?'':'disabled'} ${inside?`aria-pressed="${selected}"`:''} aria-label="${safe(title(item)+' · '+actionTitle(action)+(available?'':tr(' · בהכנה',' · in preparation')))}" title="${safe(actionTitle(action)+(available?'':tr(' · בהכנה',' · in preparation')))}">${icon(action.id)}<span>${inside?safe(actionTitle(action)):shortTitle(action.id)}</span></button>`;
  }
  function removeButton(item){
    const label=tr('הסרת התמונה עם סיסמה: ','Remove photo with password: ')+title(item);
    return `<button type="button" class="living-remove" data-living-remove="${safe(item.id)}" aria-label="${safe(label)}" title="${safe(label)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/></svg></button>`;
  }
  function card(item){
    const count=item.animations.filter(ready).length;
    return `<article class="living-card" data-living-card="${safe(item.id)}"><button class="living-photo" type="button" data-living-original="${safe(item.id)}" aria-label="${safe(tr('פתיחת התמונה המקורית: ','Open original photo: ')+title(item))}"><img src="${safe(item.thumbnailSrc||preview(item))}" alt="${safe(title(item))}" loading="lazy" decoding="async"><span class="living-photo-hint">${tr('התמונה המקורית','Original photo')}</span></button><div class="living-card-body"><div class="living-card-caption"><h3 dir="auto">${safe(title(item))}</h3><span class="living-card-count${count?' has-ready':''}">${count?tr(`${count} מתוך 3`,`${count} of 3`):tr('בהכנה','In preparation')}</span></div><div class="living-card-tools"><div class="living-actions" role="group" aria-label="${safe(tr('מה תרצו שיקרה בתמונה?','What should happen in this photo?')+' '+title(item))}">${item.animations.map(action=>actionButton(item,action)).join('')}</div>${removeButton(item)}</div></div></article>`;
  }
  function render(){
    const query=state.query.trim().toLocaleLowerCase(),items=state.items.filter(item=>!query||[item.title,item.titleEn,item.caption,...(item.tags||[]).flatMap(person=>[person.name,person.nameEn])].filter(Boolean).some(value=>value.toLocaleLowerCase().includes(query)));
    const allClips=state.items.length*3,readyClips=state.items.reduce((n,item)=>n+item.animations.filter(ready).length,0);
    $('livingFamilyStatus').textContent=state.loading&&!state.loaded?tr('פותחים את אלבום הזיכרונות…','Opening the memory album…'):state.loaded?tr(`${state.items.length} תמונות · ${readyClips} מתוך ${allClips} רגעים מוכנים לבחירה`,`${state.items.length} photos · ${readyClips} of ${allClips} moments ready to play`):'';
    $('livingFamilyError').hidden=!state.error;$('livingFamilyErrorText').textContent=state.error;
    $('livingFamilyGrid').innerHTML=items.map(card).join('');
    $('livingFamilyEmpty').hidden=Boolean(items.length)||state.loading||Boolean(state.error);
    $('livingFamilyEmpty').textContent=query?tr('לא נמצאו תמונות בחיפוש הזה.','No photos match this search.'):tr('הרגעים הראשונים יופיעו כאן בקרוב.','The first memories will appear here soon.');
    window.FamilyMedia?.register('living-family',state.items);
  }
  async function load(){
    if(state.loading)return;const previousError=state.error;state.loading=true;state.error='';if(!state.loaded)render();
    try{
      const response=await I.fetch('api/family-ai/featured',{cache:'no-store'});let data;try{data=await response.json();}catch{throw Error(tr('האלבום לא נטען כרגע. אפשר לנסות שוב.','The album could not load. Please try again.'));}
      if(!response.ok)throw Error(data.error||tr('לא ניתן לפתוח את האלבום כרגע.','The album is unavailable right now.'));
      const signature=JSON.stringify(data.items||[]);state.items=data.items||[];state.loaded=true;
      if(state.signature!==signature||previousError){state.signature=signature;render();}
    }catch(error){state.error=error.message;render();}
    finally{state.loading=false;if(!state.loaded)render();scheduleRefresh();}
  }
  function scheduleRefresh(){clearTimeout(timer);if(state.active&&document.visibilityState==='visible'&&state.items.some(item=>item.animations.some(action=>!ready(action))))timer=setTimeout(()=>void load(),60000);}
  function openOriginal(id){const index=state.items.findIndex(item=>item.id===id);if(index>=0)window.FamilyMedia?.open([...state.items],index,'living-family');}
  function showVideo(item,action){
    if(!ready(action))return;
    if(!dialog){
      dialog=document.createElement('dialog');dialog.id='livingFamilyPlayer';dialog.className='family-ai-dialog family-ai-video-dialog living-player';dialog.dir=I.isEnglish?'ltr':'rtl';dialog.setAttribute('data-i18n-skip','');dialog.setAttribute('aria-labelledby','livingFamilyPlayerTitle');
      dialog.innerHTML=`<button type="button" class="dialog-close" data-living-close aria-label="${tr('סגירה','Close')}">×</button><div class="living-player-heading"><span aria-hidden="true">❖</span><h2 id="livingFamilyPlayerTitle"></h2></div><div id="livingFamilyPlayerActions" class="living-player-actions" role="group" aria-label="${tr('בחירת הנפשה','Choose an animation')}"></div><video id="livingFamilyVideo" controls playsinline loop preload="metadata"></video><p id="livingFamilyPlayerNote" class="living-player-note"></p><p id="livingFamilyPlayerError" class="family-ai-form-error" role="alert"></p><div class="family-ai-dialog-actions"><button type="button" class="secondary-button" id="livingFamilyOriginal">${tr('התמונה המקורית','Original photo')}</button><a class="primary-button" id="livingFamilyDownload" download>${tr('הורדת הסרטון','Download video')}</a></div>`;
      document.body.append(dialog);
      dialog.addEventListener('click',event=>{if(event.target===dialog||event.target.closest('[data-living-close]'))dialog.close();const button=event.target.closest('[data-living-action]');if(button&&!button.disabled){const photo=state.items.find(photo=>photo.id===button.dataset.livingPhoto),selected=photo?.animations.find(action=>action.id===button.dataset.livingAction);if(selected)showVideo(photo,selected);}});
      dialog.addEventListener('close',()=>{const video=$('livingFamilyVideo');video.pause();video.removeAttribute('src');video.load();currentPhoto=null;currentAction=null;});
      $('livingFamilyOriginal').addEventListener('click',()=>{const id=currentPhoto;dialog.close();openOriginal(id);});
      $('livingFamilyVideo').addEventListener('error',()=>{$('livingFamilyPlayerError').textContent=tr('הסרטון לא נטען. אפשר לנסות אפשרות אחרת או להוריד אותו.','The video could not load. Try another action or download it.');});
    }
    currentPhoto=item.id;currentAction=action.id;
    $('livingFamilyPlayerTitle').textContent=title(item);$('livingFamilyPlayerActions').innerHTML=item.animations.map(variant=>actionButton(item,variant,true)).join('');
    $('livingFamilyPlayerNote').textContent=tr(`${action.label} · כ־${Math.round(action.duration)} שניות${action.stale?' · מבוסס על גרסה קודמת של התמונה':''}`,`${action.labelEn} · about ${Math.round(action.duration)} seconds${action.stale?' · based on a previous version of the photo':''}`);
    $('livingFamilyPlayerError').textContent='';const video=$('livingFamilyVideo');video.pause();video.poster=preview(item);video.src=action.videoSrc;
    $('livingFamilyDownload').href=action.videoSrc+'&download=1';$('livingFamilyDownload').download='family-memory-'+item.id+'-'+action.id+'.mp4';
    if(!dialog.open)dialog.showModal();video.play()?.catch(()=>{});
  }
  function init(){
    const host=$('familyAiView'),original=window.FamilyAI;if(!host||!original)return;
    const archive=document.createElement('div');archive.id='livingFamilyArchive';archive.className='living-family-archive';while(host.firstChild)archive.append(host.firstChild);host.append(archive);archive.hidden=true;
    archive.querySelector('.family-ai-intro')?.setAttribute('hidden','');
    const section=document.createElement('section');section.id='livingFamilySection';section.className='living-family-section';section.setAttribute('data-i18n-skip','');
    section.innerHTML=`<div class="living-family-meta"><p id="livingFamilyStatus" role="status" aria-live="polite"></p><button type="button" class="secondary-button living-refresh" data-living-refresh>${tr('רענון','Refresh')}</button></div><div id="livingFamilyError" class="family-ai-error" role="alert" hidden><p id="livingFamilyErrorText"></p><button type="button" class="secondary-button" data-living-refresh>${tr('ניסיון נוסף','Try again')}</button></div><div id="livingFamilyGrid" class="living-family-grid"></div><p id="livingFamilyEmpty" class="family-ai-empty" hidden></p><p class="family-ai-footnote">${tr('כל רגע הוא הנפשת בינה מלאכותית בהשראת התמונה המקורית. האפשרויות הבהירות עדיין בהכנה.','Each moment is an AI animation inspired by the original photograph. Faded actions are still in preparation.')}</p><button type="button" id="livingFamilyArchiveToggle" class="secondary-button living-archive-toggle" aria-expanded="false">${tr('עוד תמונות מהאלבום','More photographs from the album')}</button>`;
    host.prepend(section);
    section.addEventListener('click',event=>{const button=event.target.closest('button');if(!button||button.disabled)return;if(button.hasAttribute('data-living-refresh')){state.signature='';void load();return;}if(button.dataset.livingRemove){const item=state.items.find(item=>item.id===button.dataset.livingRemove);if(item)original.remove(item);return;}if(button.dataset.livingOriginal){openOriginal(button.dataset.livingOriginal);return;}if(button.dataset.livingAction){const item=state.items.find(item=>item.id===button.dataset.livingPhoto),action=item?.animations.find(action=>action.id===button.dataset.livingAction);if(action)showVideo(item,action);}});
    $('livingFamilyArchiveToggle').addEventListener('click',()=>{state.archive=!state.archive;archive.hidden=!state.archive;$('livingFamilyArchiveToggle').setAttribute('aria-expanded',String(state.archive));$('livingFamilyArchiveToggle').textContent=tr(state.archive?'סגירת האלבום הנוסף':'עוד תמונות מהאלבום',state.archive?'Close the additional album':'More photographs from the album');});
    const oldActivate=original.activate,oldSearch=original.search,oldRefresh=original.refresh;
    original.activate=view=>{oldActivate(view);state.active=view==='family-ai';if(state.active){if(!state.loaded)void load();else scheduleRefresh();}else clearTimeout(timer);};
    original.search=query=>{if(!state.active)return;state.query=query;render();if(state.archive)oldSearch(query);};
    original.refresh=()=>{void load();return oldRefresh();};
    window.addEventListener('family-media-changed',()=>{if(state.active)void load();else state.loaded=false;});
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&state.active)void load();else clearTimeout(timer);});
    original.activate(window.FamilyApp?.getView?.()||location.hash.slice(1).split('/')[0]);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
