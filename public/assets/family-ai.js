(() => {
  'use strict';
  const I=window.FamilyI18n,$=id=>document.getElementById(id),tr=(he,en)=>I.isEnglish?en:he;
  const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const icons={spark:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.8 6.2L21 12l-6.2 2.8L12 21l-2.8-6.2L3 12l6.2-2.8Z"/><path d="m20 2 .7 1.3L22 4l-1.3.7L20 6l-.7-1.3L18 4l1.3-.7Z"/></svg>',trash:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/></svg>',play:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 10 7-10 7Z"/></svg>',gallery:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="m3 17 6-6 4 4 3-3 5 5"/><circle cx="15.5" cy="7.5" r="1"/></svg>',download:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/></svg>',restore:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10a8 8 0 1 1 1 8M4 4v6h6M12 8v5l3 2"/></svg>'};
  const state={active:false,ready:false,loaded:false,loading:false,error:'',items:[],filter:'all',excluded:false,excludedCount:0,query:'',page:1,pagination:{page:1,pages:1,total:0},request:0,config:null,configError:false,jobs:new Map(),submitting:new Set(),polling:false};
  let pollTimer,searchTimer,loadController,generationDialog,removeDialog,videoDialog,pendingPhoto=null,pendingRemoval=null,removing=false;
  const statusOf=job=>String(job?.status||'').toUpperCase();
  const isBusy=job=>['SUBMITTING','PENDING','THROTTLED','RUNNING','SAVING'].includes(statusOf(job));
  const shouldPoll=job=>isBusy(job)&&job?.errorCode!=='SUBMISSION_UNCERTAIN';
  const errors={
    PROVIDER_AUTH:['שירות יצירת הסרטונים אינו מחובר כרגע. יש לבדוק את חיבור השירות.','The video service connection needs attention.'],
    PROVIDER_CREDITS:['אין כרגע יתרה זמינה ליצירת סרטונים. אפשר לנסות שוב לאחר חידוש היתרה.','The video creation balance is empty. Please try again after it is replenished.'],
    PROVIDER_BUSY:['שירות יצירת הסרטונים עמוס כרגע. אפשר לנסות שוב מאוחר יותר.','The video service is busy. Please try again later.'],
    GENERATION_FAILED:['לא ניתן היה ליצור סרטון מהתמונה הזאת. אפשר לנסות שוב.','A video could not be created from this photo. You can try again.'],
    SUBMISSION_UNCERTAIN:['אישור הבקשה טרם התקבל. היצירה נעצרה לבדיקה כדי למנוע חיוב כפול.','The request could not be confirmed. Creation is paused for review to avoid a duplicate charge.'],
    OUTPUT_SAVE_FAILED:['הסרטון נוצר. אנחנו מנסים להשלים את השמירה שלו.','Your video was created. We are trying to finish saving it.'],
    SOURCE_CHANGED:['התמונה נערכה מאז היצירה. הסרטון שייך לגרסה הקודמת.','The photo was edited after creation. This video uses the previous version.'],
    FAMILY_AI_NOT_CONFIGURED:['יצירת הסרטונים עדיין אינה מחוברת.','Video generation has not been connected yet.'],
    FAMILY_AI_ACCESS_CODE:['קוד היצירה אינו נכון.','The creation code is incorrect.'],
    FAMILY_AI_IMAGE_RESIZE:['לא ניתן להכין את התמונה ליצירה. נסו לפתוח אותה שוב.','The photo could not be prepared for generation. Please open it again.'],
    AI_DAILY_LIMIT:['מכסת יצירת הסרטונים היומית מוצתה. נסו שוב מחר.','The daily video creation limit has been reached. Try again tomorrow.']
  };
  const errorText=(code,fallback='')=>errors[code]?tr(...errors[code]):fallback;
  const jobFor=item=>state.jobs.get(item.id)||item.aiJob;
  const titleOf=item=>item.caption||I.mediaName?.(item)||tr('רגע מהאלבום המשפחתי','A moment from the family album');
  const previewOf=item=>item.preview?.src||item.previewSrc||item.thumbnailSrc||item.src;
  const videoOf=job=>job?.videoSrc||job?.src||'';
  async function request(path,options={}){
    const response=await I.fetch(path,{cache:'no-store',...options,headers:{...(options.body?{'Content-Type':'application/json','X-Family-Token':window.FAMILY_API_TOKEN}:{}),...options.headers}});
    let result;try{result=await response.json();}catch{throw Error(tr('לא התקבלה תשובה מהשרת. נסו שוב.','No response from the server. Please try again.'));}
    if(!response.ok){const error=Error(errorText(result.code,I.error?.(result.error)||result.error||tr('לא ניתן להשלים את הפעולה. נסו שוב.','Could not complete this action. Please try again.')));error.code=result.code;throw error;}
    return result;
  }
  const post=(path,body)=>request(path,{method:'POST',body:JSON.stringify(body)});
  function jobLabel(job){
    const status=statusOf(job);
    if(job?.errorCode)return errorText(job.errorCode,tr('היצירה לא הושלמה. אפשר לנסות שוב מאוחר יותר.','Creation did not finish. Please try again later.'));
    if(job?.stale)return tr('הסרטון שייך לגרסה קודמת של התמונה. אפשר ליצור סרטון חדש.','This video uses an earlier photo version. You can create a new video.');
    if(status==='SUCCEEDED')return tr('הזיכרון קם לחיים','Your memory is alive');
    if(status==='FAILED')return tr('היצירה לא הושלמה · אפשר לנסות שוב','Creation did not finish · you can try again');
    if(status==='SAVING')return tr('שומרים את הסרטון המשפחתי…','Saving your family video…');
    if(status==='RUNNING')return tr('התמונה מתעוררת לחיים…','Bringing this photo to life…');
    if(status==='THROTTLED')return tr('ממתינים למקום פנוי ביצירה…','Waiting for an available generation slot…');
    return tr('התמונה בתור ליצירה…','Your photo is in the creation queue…');
  }
  function card(item){
    const job=jobFor(item),status=statusOf(job),busy=isBusy(job)||state.submitting.has(item.id),finished=status==='SUCCEEDED'&&videoOf(job)&&!job?.stale,unavailable=!state.config?.enabled&&!finished&&!state.excluded,title=titleOf(item),date=item.takenDate?.year||'';
    const action=state.excluded?`${icons.restore}<span>${tr('החזרה לבינה משפחתית','Restore photo')}</span>`:finished?`${icons.play}<span>${tr('צפייה בזיכרון החי','Watch the living memory')}</span>`:busy?`<span class="family-ai-spinner" aria-hidden="true"></span><span>${tr('בתהליך יצירה…','Creating…')}</span>`:`${icons.spark}<span>${tr(status==='FAILED'?'ניסיון נוסף להחיות':'להעיר לחיים',status==='FAILED'?'Try creating again':'Bring to life')}</span>`;
    return `<article class="family-ai-card${busy?' is-creating':''}${finished?' is-ready':''}" data-ai-card="${safe(item.id)}"><button class="family-ai-photo" type="button" data-ai-open="${safe(item.id)}" aria-label="${safe(tr('פתיחה בגלריה: ','Open in gallery: ')+title)}"><img src="${safe(item.thumbnailSrc||previewOf(item))}" alt="${safe(title)}" loading="lazy" decoding="async"><span class="family-ai-photo-open">${icons.gallery}<span>${tr('פתיחה בגלריה','Open in gallery')}</span></span>${finished?`<span class="family-ai-ready-badge">${icons.spark}${tr('זיכרון חי','Alive')}</span>`:''}</button><div class="family-ai-card-body"><div class="family-ai-caption"><p dir="auto" title="${safe(title)}">${safe(title)}</p>${date?`<span class="family-ai-year">${safe(date)}</span>`:''}</div><div class="family-ai-card-actions"><button type="button" class="family-ai-create${finished?' is-play':''}" ${busy||unavailable?'disabled':''} ${unavailable?`title="${tr('יצירת הסרטונים ממתינה לחיבור שירות הווידאו','Video generation is waiting for the video service connection')}"`:''} data-ai-${state.excluded?'restore':finished?'play':'create'}="${safe(item.id)}">${action}${!state.excluded&&!busy?`<span class="family-ai-duration">${tr('10 שנ׳','10s')}</span>`:''}</button>${!state.excluded?`<button type="button" class="family-ai-remove" data-ai-remove="${safe(item.id)}" aria-label="${safe(tr('הסרה מבינה משפחתית: ','Remove from Artificial Family: ')+title)}" title="${tr('הסרה מהעמוד הזה','Remove from this section')}">${icons.trash}</button>`:''}</div>${job&&!state.excluded?`<div class="family-ai-job ${status==='FAILED'?'is-failed':''}" role="status"><span>${jobLabel(job)}</span>${job.stale&&videoOf(job)?`<button type="button" class="family-ai-previous-video" data-ai-play="${safe(item.id)}">${tr('צפייה בסרטון הקודם','Watch the previous video')}</button>`:''}${busy&&Number.isFinite(job.progress)&&job.progress>0?`<progress max="1" value="${Math.min(1,Math.max(0,job.progress))}" aria-label="${tr('התקדמות היצירה','Generation progress')}"></progress>`:''}</div>`:''}</div></article>`;
  }
  function render({advanceRemoved=false}={}){
    if(!state.ready)return;
    const config=state.config;
    $('familyAiConnection').hidden=Boolean(config?.enabled);
    $('familyAiConnectionText').textContent=state.configError?tr('לא ניתן לבדוק כרגע את חיבור יצירת הסרטונים. אפשר לנסות שוב.','The video connection could not be checked. Please try again.'):config?tr('יצירת הסרטונים ממתינה לחיבור שירות הווידאו. בינתיים אפשר לגלות תמונות ולפתוח אותן בגלריה.','Video creation is waiting for the video service to be connected. You can already explore photos and open them in the gallery.'):tr('בודקים את חיבור יצירת הסרטונים…','Checking the video creation connection…');
    $('familyAiConnectionRetry').hidden=!state.configError;
    $('familyAiHiddenToggle').innerHTML=icons.restore+'<span>'+tr(state.excluded?'חזרה לתמונות':'תמונות שהוסרו',state.excluded?'Back to photos':'Removed photos')+(state.excludedCount?' · '+state.excludedCount:'')+'</span>';
    $('familyAiHiddenToggle').setAttribute('aria-pressed',String(state.excluded));
    $('familyAiHiddenNote').hidden=!state.excluded;
    for(const button of $('familyAiFilters').querySelectorAll('button'))button.setAttribute('aria-pressed',String(button.dataset.aiFilter===state.filter));
    const pagination=state.pagination;
    $('familyAiCount').textContent=state.loading?tr('אוספים את הזיכרונות…','Gathering your memories…'):pagination.total?pagination.total.toLocaleString(I.locale)+tr(state.excluded?' תמונות שהוסרו מהעמוד':' תמונות של פעם',state.excluded?' removed photos':' photographs from the past'):'';
    $('familyAiError').hidden=!state.error;$('familyAiErrorText').textContent=state.error;
    $('familyAiLoading').hidden=!state.loading||state.items.length>0;
    $('familyAiGrid').setAttribute('aria-busy',String(state.loading));
    const active=document.activeElement,focusedId=active?.closest?.('[data-ai-card]')?.dataset.aiCard,focusedAction=active?.dataset?Object.keys(active.dataset).find(key=>key.startsWith('ai')):null;
    $('familyAiGrid').innerHTML=state.items.map(card).join('');
    if(focusedId&&focusedAction){const matched=[...$('familyAiGrid').querySelectorAll('[data-ai-card]')].find(el=>el.dataset.aiCard===focusedId);matched?.querySelector('[data-'+focusedAction.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())+']')?.focus({preventScroll:true});}
    $('familyAiEmpty').hidden=state.loading||Boolean(state.items.length)||Boolean(state.error);
    $('familyAiEmptyTitle').textContent=tr(state.excluded?'כל הזיכרונות נשארו איתנו':state.query?'לא נמצאו תמונות בחיפוש הזה':state.filter==='ready'?'הזיכרון החי הראשון עוד לפנינו':'מחכים לתמונות של פעם',state.excluded?'All memories are still here':state.query?'No photos match this search':state.filter==='ready'?'Your first living memory is still ahead':'Waiting for photographs from the past');
    $('familyAiEmptyText').textContent=tr(state.excluded?'תמונות שתסירו מהעמוד יופיעו כאן, ותוכלו להחזיר אותן בכל רגע.':state.query?'נסו שם אחר או נקו את החיפוש.':state.filter==='ready'?'בחרו תמונה מתוך ״כל התמונות״ ולחצו על ״להעיר לחיים״.':'כאן נאספות רק תמונות שסומנו ״שחור לבן״.',state.excluded?'Photos removed from this section appear here, ready to restore at any time.':state.query?'Try another name or clear the search.':state.filter==='ready'?'Choose a photo from All photos and press Bring to life.':'Only photographs tagged Black and white are gathered here.');
    $('familyAiPager').hidden=pagination.pages<2||Boolean(state.error);
    $('familyAiPageLabel').textContent=tr(`עמוד ${pagination.page} מתוך ${pagination.pages}`,`Page ${pagination.page} of ${pagination.pages}`);
    $('familyAiPrevious').disabled=state.loading||pagination.page<=1;$('familyAiNext').disabled=state.loading||pagination.page>=pagination.pages;
    // Reuse the normal gallery with its zoom, face labels, swiping and descriptions.
    window.FamilyMedia?.register('family-ai',state.items,{retainCurrent:!advanceRemoved,advanceRemoved,pagination:{...state.pagination,filter:state.filter,query:state.query,excluded:state.excluded}});
  }
  async function loadConfig(){
    state.configError=false;
    try{state.config=await request('api/family-ai/config');}catch{state.configError=true;}render();
  }
  async function load(){
    loadController?.abort();const controller=loadController=new AbortController(),sequence=++state.request;state.loading=true;state.error='';render();
    try{
      const query=new URLSearchParams({page:String(state.page),size:'40',filter:state.filter,q:state.query,...(state.excluded?{excluded:'1'}:{})});
      const result=await request('api/family-ai?'+query,{signal:controller.signal});if(sequence!==state.request)return;
      state.items=result.items||[];state.excludedCount=result.excludedCount||0;state.pagination=result.pagination||{page:1,pages:1,total:result.count||state.items.length};state.page=state.pagination.page;state.loaded=true;
      for(const item of state.items){if(item.aiJob)state.jobs.set(item.id,item.aiJob);else state.jobs.delete(item.id);}
    }catch(error){if(sequence!==state.request||controller.signal.aborted)return;state.error=error.message;}
    finally{if(sequence===state.request){state.loading=false;render();schedulePoll();}}
  }
  function schedulePoll(){
    clearTimeout(pollTimer);if(!state.active||document.visibilityState==='hidden')return;
    if(state.items.some(item=>shouldPoll(jobFor(item))))pollTimer=setTimeout(()=>void poll(),6500);
  }
  async function poll(){
    if(state.polling||!state.active)return;state.polling=true;let changed=false;
    try{
      const pending=state.items.filter(item=>shouldPoll(jobFor(item)));
      const results=await Promise.allSettled(pending.map(async item=>{const result=await request('api/family-ai/jobs/'+encodeURIComponent(item.id));if(result.job){state.jobs.set(item.id,{...result.job,stale:result.job.revision!==(item.photoRevision||'original')});if(statusOf(result.job)==='SUCCEEDED')changed=true;}}));
      if(results.some(result=>result.status==='rejected'))$('familyAiPollNotice').textContent=tr('היצירה נשמרת בשרת. ננסה לבדוק שוב את ההתקדמות.','Your creation is saved on the server. We will check progress again shortly.');else $('familyAiPollNotice').textContent='';
      render();if(changed&&state.filter==='ready')void load();
    }finally{state.polling=false;schedulePoll();}
  }
  function ensureDialog(id,html,className=''){
    const dialog=document.createElement('dialog');dialog.id=id;dialog.className='family-ai-dialog '+className;dialog.dir=I.isEnglish?'ltr':'rtl';dialog.setAttribute('data-i18n-skip','');dialog.innerHTML=html;document.body.append(dialog);
    dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});return dialog;
  }
  function openGeneration(item){
    if(!state.config?.enabled){$('familyAiConnection').scrollIntoView({behavior:'smooth',block:'center'});window.FamilyApp?.toast(tr('יצירת הסרטונים תהיה זמינה אחרי חיבור שירות הווידאו.','Video creation becomes available when the video service is connected.'));return;}
    if(!generationDialog){
      generationDialog=ensureDialog('familyAiGenerateDialog',`<button type="button" class="dialog-close" data-ai-close aria-label="${tr('סגירה','Close')}">×</button><span class="family-ai-dialog-emblem" aria-hidden="true">❖</span><h2 id="familyAiGenerateTitle">${tr('מעירים זיכרון לחיים','Bring a memory to life')}</h2><div class="family-ai-confirm-photo"><img id="familyAiGeneratePreview" alt=""><p id="familyAiGenerateCaption" dir="auto"></p></div><p>${tr('סרטון של 10 שניות, עם תנועה עדינה, מצמוץ וחיוך קטן — בהשראת התמונה המקורית.','A 10-second video, with gentle motion, blinking and a small smile, inspired by the original photograph.')}</p><p class="family-ai-generation-disclosure">${tr('התמונה תישלח לשירות Runway ליצירת וידאו. היצירה עולה כ־$0.50 ומשתמשת ביתרת היצירה המשפחתית. התוצאה היא יצירת בינה מלאכותית.','The photo will be sent to Runway to create a video. Generation costs about $0.50 and uses the family creation balance. The result is an AI creation.')}</p><form id="familyAiGenerateForm"><label for="familyAiAccessCode">${tr('קוד יצירה משפחתי','Family creation code')}</label><input id="familyAiAccessCode" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" required maxlength="200"><p id="familyAiGenerateError" class="family-ai-form-error" role="alert"></p><div class="family-ai-dialog-actions"><button type="button" class="secondary-button" data-ai-close>${tr('ביטול','Cancel')}</button><button id="familyAiGenerateSubmit" type="submit" class="primary-button">${icons.spark}<span>${tr('להעיר לחיים','Bring to life')}</span></button></div></form>`);
      generationDialog.setAttribute('aria-labelledby','familyAiGenerateTitle');
      generationDialog.querySelectorAll('[data-ai-close]').forEach(button=>button.addEventListener('click',()=>generationDialog.close()));
      generationDialog.addEventListener('close',()=>{$('familyAiAccessCode').value='';pendingPhoto=null;});
      $('familyAiGenerateForm').addEventListener('submit',event=>{event.preventDefault();void generate();});
    }
    pendingPhoto=item;$('familyAiGeneratePreview').src=previewOf(item);$('familyAiGeneratePreview').alt=titleOf(item);$('familyAiGenerateCaption').textContent=titleOf(item);$('familyAiAccessCode').value='';$('familyAiGenerateError').textContent='';$('familyAiGenerateSubmit').disabled=false;generationDialog.showModal();$('familyAiAccessCode').focus();
  }
  async function preparedImage(item){
    // A compact JPEG also permits animation of AVIF/GIF photos and large scans.
    const image=new Image();image.decoding='async';image.src=item.src||item.previewSrc||item.preview?.src;await image.decode();
    const scale=Math.min(1,1920/Math.max(image.naturalWidth,image.naturalHeight)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
    const context=canvas.getContext('2d');if(!context)return {width:image.naturalWidth,height:image.naturalHeight};context.fillStyle='#faf7ef';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);
    const imageData=canvas.toDataURL('image/jpeg',.9);return {width:image.naturalWidth,height:image.naturalHeight,...(imageData.length<4_000_000?{imageData}:{})};
  }
  async function generate(){
    const item=pendingPhoto;if(!item||state.submitting.has(item.id))return;
    const accessCode=$('familyAiAccessCode').value;if(!accessCode)return;
    state.submitting.add(item.id);$('familyAiGenerateSubmit').disabled=true;$('familyAiGenerateError').textContent='';render();
    try{
      let image={};try{image=await preparedImage(item);}catch{}
      const result=await post('api/family-ai/generate',{id:item.id,...image,accessCode,...(statusOf(jobFor(item))==='FAILED'?{retry:true}:{})});
      if(result.job)state.jobs.set(item.id,{...result.job,stale:result.job.revision!==(item.photoRevision||'original')});generationDialog.close();window.FamilyApp?.toast(result.job?.errorCode?jobLabel(result.job):statusOf(result.job)==='FAILED'?jobLabel(result.job):statusOf(result.job)==='SUCCEEDED'?tr('הסרטון מוכן לצפייה.','Your video is ready to watch.'):tr('הזיכרון בדרך לחיים. אפשר להמשיך לגלוש ולחזור לכאן.','Your memory is coming to life. You can keep browsing and return here.'));schedulePoll();
    }catch(error){if(generationDialog.open)$('familyAiGenerateError').textContent=error.message;else window.FamilyApp?.toast(error.message);}
    finally{state.submitting.delete(item.id);$('familyAiGenerateSubmit').disabled=false;render();schedulePoll();}
  }
  function confirmRemoval(item){
    if(removing)return;
    if(!removeDialog){
      removeDialog=ensureDialog('familyAiRemoveDialog',`<button type="button" class="dialog-close" data-ai-close aria-label="${tr('סגירה','Close')}">×</button><span class="family-ai-dialog-emblem" aria-hidden="true">❖</span><h2 id="familyAiRemoveTitle">${tr('להסיר מבינה משפחתית?','Remove from Artificial Family?')}</h2><p id="familyAiRemoveCaption" dir="auto"></p><p>${tr('התמונה תוסר רק מהעמוד הזה. היא תישאר בגלריה, ואפשר יהיה להחזיר אותה דרך ״תמונות שהוסרו״.','The photo will be removed from this section. It stays in the gallery and can be restored through Removed photos.')}</p><p id="familyAiRemoveError" class="family-ai-form-error" role="alert"></p><div class="family-ai-dialog-actions"><button type="button" class="secondary-button" data-ai-close>${tr('ביטול','Cancel')}</button><button type="button" id="familyAiRemoveConfirm" class="primary-button">${tr('הסרה מהעמוד','Remove from section')}</button></div>`);
      removeDialog.setAttribute('aria-labelledby','familyAiRemoveTitle');removeDialog.querySelectorAll('[data-ai-close]').forEach(button=>button.addEventListener('click',()=>removeDialog.close()));
      const password=document.createElement('div');password.className='family-ai-removal-password';
      password.innerHTML=`<label for="familyAiRemovePassword">${tr('סיסמת מחיקה','Removal password')}</label><input id="familyAiRemovePassword" type="password" autocomplete="off" inputmode="numeric" maxlength="128" required><p>${tr('הזינו את הסיסמה כדי להסיר את התמונה ואת האפקטים שלה מהעמוד ומהתור.','Enter the password to remove this photo and its effects from the page and queue.')}</p>`;
      removeDialog.querySelector('.family-ai-dialog-actions').before(password);
      const submit=async()=>{if(!pendingRemoval||removing)return;const id=pendingRemoval.id,code=$('familyAiRemovePassword').value;if(!code){$('familyAiRemoveError').textContent=tr('יש להזין את סיסמת המחיקה.','Enter the removal password.');$('familyAiRemovePassword').focus();return;}removing=true;$('familyAiRemoveConfirm').disabled=true;$('familyAiRemovePassword').value='';try{await changeExclusion(id,true,code);removeDialog.close();void window.FamilyAI.refresh();}catch(error){$('familyAiRemoveError').textContent=error.message;$('familyAiRemovePassword').focus();}finally{removing=false;$('familyAiRemoveConfirm').disabled=false;}};
      $('familyAiRemoveConfirm').addEventListener('click',submit);
      $('familyAiRemovePassword').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();void submit();}});
      removeDialog.addEventListener('close',()=>{$('familyAiRemovePassword').value='';pendingRemoval=null;});
    }
    pendingRemoval=item;$('familyAiRemoveCaption').textContent=titleOf(item);$('familyAiRemoveError').textContent='';$('familyAiRemovePassword').value='';removeDialog.showModal();$('familyAiRemovePassword').focus();
  }
  async function changeExclusion(id,excluded,password){
    await post('api/family-ai/exclude',{id,excluded,...(excluded?{password}:{})});state.items=state.items.filter(item=>item.id!==id);render({advanceRemoved:true});await load();window.FamilyApp?.toast(tr(excluded?'התמונה הוסרה מהעמוד ומהתור.':'התמונה חזרה לבינה משפחתית.',excluded?'Photo removed from this section and queue.':'Photo restored to Artificial Family.'));
  }
  function play(item){
    const src=videoOf(jobFor(item));if(!src)return;
    if(!videoDialog){
      videoDialog=ensureDialog('familyAiVideoDialog',`<button type="button" class="dialog-close" data-ai-close aria-label="${tr('סגירה','Close')}">×</button><div class="family-ai-video-heading"><span aria-hidden="true">❖</span><h2 id="familyAiVideoTitle">${tr('זיכרון שקם לחיים','A memory brought to life')}</h2><span class="family-ai-video-label">${tr('בינה מלאכותית · 10 שניות','AI creation · 10 seconds')}</span></div><video id="familyAiVideo" controls playsinline preload="metadata"></video><p id="familyAiVideoCaption" dir="auto"></p><div class="family-ai-dialog-actions"><button type="button" class="secondary-button" id="familyAiViewOriginal">${icons.gallery}${tr('התמונה המקורית','Original photo')}</button><a id="familyAiVideoDownload" class="primary-button" download>${icons.download}${tr('הורדת הסרטון','Download video')}</a></div>`,'family-ai-video-dialog');
      videoDialog.setAttribute('aria-labelledby','familyAiVideoTitle');videoDialog.querySelector('[data-ai-close]').addEventListener('click',()=>videoDialog.close());videoDialog.addEventListener('close',()=>{$('familyAiVideo').pause();$('familyAiVideo').removeAttribute('src');$('familyAiVideo').load();});
      $('familyAiViewOriginal').addEventListener('click',()=>{const id=$('familyAiViewOriginal').dataset.photoId;videoDialog.close();openPhoto(id);});
    }
    $('familyAiVideo').src=src;$('familyAiVideo').poster=previewOf(item);$('familyAiVideoCaption').textContent=titleOf(item);$('familyAiVideoDownload').href=src;$('familyAiVideoDownload').download='family-memory-'+item.id+'.mp4';$('familyAiViewOriginal').dataset.photoId=item.id;videoDialog.showModal();$('familyAiVideo').play()?.catch(()=>{});
  }
  function openPhoto(id){const index=state.items.findIndex(item=>item.id===id);if(index>=0)window.FamilyMedia?.open([...state.items],index,'family-ai');}
  function activate(view){
    const host=$('familyAiView');if(!host)return;state.active=view==='family-ai';host.hidden=!state.active;
    if(!state.ready)return;
    if(state.active){if(!state.config&&!state.configError)void loadConfig();if(!state.loaded&&!state.loading)void load();else{render();schedulePoll();}}
    else clearTimeout(pollTimer);
  }
  function search(query){if(!state.active)return;state.query=query;state.page=1;clearTimeout(searchTimer);searchTimer=setTimeout(()=>void load(),280);}
  function init(){
    const host=$('familyAiView');if(!host)return;host.setAttribute('data-i18n-skip','');host.classList.add('family-ai-view');
    host.innerHTML=`<header class="family-ai-intro"><div class="family-ai-intro-copy"><span class="family-ai-kicker">${tr('רגעים מהעבר · קסם של היום','Yesterday’s moments · today’s magic')}</span><h2><span aria-hidden="true">❖</span>${tr('בינה משפחתית','Artificial Family')}</h2><p>${tr('אותם הפנים. אותם הזיכרונות. עוד רגע קטן יחד.','The same faces. The same memories. One more moment together.')}</p><span class="family-ai-stitch" aria-hidden="true">✧ ─ ◇ ─ ❖ ─ ◇ ─ ✧</span></div><div class="family-ai-intro-note"><span class="family-ai-seal" aria-hidden="true">${icons.spark}</span><p>${tr('בוחרים תמונה ישנה<br>ומעירים אותה לחיים','Choose an old photograph<br>and bring it to life')}</p><span>${tr('סרטון אישי של 10 שניות','A personal 10-second video')}</span></div></header><div id="familyAiConnection" class="family-ai-connection" role="status"><span aria-hidden="true">${icons.spark}</span><p id="familyAiConnectionText"></p><button type="button" id="familyAiConnectionRetry" hidden>${tr('ניסיון נוסף','Try again')}</button></div><div class="family-ai-toolbar"><div id="familyAiFilters" class="family-ai-filters" role="group" aria-label="${tr('סינון תמונות','Filter photos')}">${[['all',tr('כל התמונות','All photos')],['black-and-white',tr('שחור לבן','Black and white')],['vintage',tr('וינטג׳','Vintage')],['ready',tr('זיכרונות חיים','Living memories')]].map(([value,label])=>`<button type="button" data-ai-filter="${value}" aria-pressed="${value==='all'}">${label}</button>`).join('')}</div><button id="familyAiHiddenToggle" class="family-ai-hidden-toggle" type="button" aria-pressed="false"></button></div><p id="familyAiHiddenNote" class="family-ai-hidden-note" hidden>${tr('התמונות האלה הוסרו רק מבינה משפחתית. לחצו על ״החזרה״ כדי לצרף אותן שוב.','These photos were removed from Artificial Family. Press Restore to include them again.')}</p><div class="family-ai-section-meta"><p id="familyAiCount" role="status" aria-live="polite"></p><span>${tr('לחיצה על תמונה פותחת את הגלריה','Press a photo to open the gallery')}</span></div><div id="familyAiError" class="family-ai-error" role="alert" hidden><p id="familyAiErrorText"></p><button type="button" id="familyAiRetry" class="secondary-button">${tr('ניסיון נוסף','Try again')}</button></div><div id="familyAiLoading" class="family-ai-loading" role="status" hidden><span class="family-ai-spinner" aria-hidden="true"></span><span>${tr('פותחים את אלבום הזיכרונות…','Opening the memory album…')}</span></div><div id="familyAiGrid" class="family-ai-grid"></div><div id="familyAiEmpty" class="family-ai-empty" hidden><span aria-hidden="true">❖</span><h3 id="familyAiEmptyTitle"></h3><p id="familyAiEmptyText"></p></div><p id="familyAiPollNotice" class="family-ai-poll-notice" role="status"></p><nav id="familyAiPager" class="family-ai-pager" aria-label="${tr('עמודי תמונות','Photo pages')}" hidden><button type="button" id="familyAiPrevious" class="secondary-button">${tr('הקודם','Previous')}</button><span id="familyAiPageLabel" role="status"></span><button type="button" id="familyAiNext" class="primary-button">${tr('הבא','Next')}</button></nav><p class="family-ai-footnote">${tr('הזיכרונות החיים נוצרים בבינה מלאכותית, בהשראת התצלום המקורי. התמונות המקוריות נשמרות בגלריה.','Living memories are AI creations inspired by the original photograph. Original photos stay in the gallery.')}</p>`;
    state.ready=true;
    host.addEventListener('click',event=>{
      const button=event.target.closest('button');if(!button||button.disabled)return;
      if(button.dataset.aiFilter){state.filter=button.dataset.aiFilter;state.page=1;void load();return;}
      if(button.dataset.aiOpen){openPhoto(button.dataset.aiOpen);return;}
      const id=button.dataset.aiCreate||button.dataset.aiRemove||button.dataset.aiRestore||button.dataset.aiPlay,item=state.items.find(item=>item.id===id);if(!item)return;
      if(button.dataset.aiCreate)openGeneration(item);else if(button.dataset.aiRemove)confirmRemoval(item);else if(button.dataset.aiPlay)play(item);else if(button.dataset.aiRestore){button.disabled=true;void changeExclusion(id,false).catch(error=>{button.disabled=false;window.FamilyApp?.toast(error.message);});}
    });
    $('familyAiHiddenToggle').addEventListener('click',()=>{state.excluded=!state.excluded;state.page=1;void load();});
    $('familyAiPrevious').addEventListener('click',()=>{if(state.page>1){state.page--;void load();host.scrollIntoView({block:'start'});}});$('familyAiNext').addEventListener('click',()=>{if(state.page<state.pagination.pages){state.page++;void load();host.scrollIntoView({block:'start'});}});
    $('familyAiRetry').addEventListener('click',()=>void load());$('familyAiConnectionRetry').addEventListener('click',()=>void loadConfig());
    window.addEventListener('family-media-changed',()=>{if(state.active)void load();else state.loaded=false;});
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&state.active){void load();}else clearTimeout(pollTimer);});
    render();activate(window.FamilyApp?.getView?.()||location.hash.slice(1).split('/')[0]);
  }
  window.FamilyAI={activate,search,refresh:()=>load(),remove:confirmRemoval,pageGallery:page=>{state.page=page;return load();},galleryQuery:()=>({page:state.page}),exclude:id=>{const item=state.items.find(item=>item.id===id)||window.FamilyMedia?.lookup('family-ai',id)||window.FamilyMedia?.lookup('living-family',id);if(item)confirmRemoval(item);},statusOf,isBusy};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
