(() => {
  'use strict';
  const I=window.FamilyI18n,$=id=>document.getElementById(id),app=()=>window.FamilyApp;
  const tr=(he,en)=>I.isEnglish?en:he;
  const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const keys=['photos','videos','documents'];
  const state={view:'tree',id:null,data:null,ready:false,loading:false,loadingKey:null,queued:false,pages:{photos:1,videos:1,documents:1},revision:null,aboutEditing:false,aboutDraft:'',aboutExpected:'',running:false,queue:[],status:'',error:''};
  let picker=null,refreshTimer,tagsDirty=false,refreshPending=false;
  const aboutKey=()=>I.isEnglish?'aboutEn':'about';
  const biography=()=>window.FamilyBiography,editing=()=>state.aboutEditing||biography()?.isEditing();
  const finishEditing=()=>{if(refreshPending){refreshPending=false;load(true);}};
  async function api(path,body){
    const response=await I.fetch(path,{method:body?'POST':'GET',cache:'no-store',headers:body?{'Content-Type':'application/json','X-Family-Token':window.FAMILY_API_TOKEN}:{},...(body?{body:JSON.stringify(body)}:{})});
    let result;try{result=await response.json();}catch{throw Error(tr('לא התקבלה תשובה מהשרת. נסו שוב.','The server did not respond. Please try again.'));}
    if(!response.ok)throw Error(I.error(result.error));return result;
  }
  function dates(){return app().getPerson(state.id)?app().birthdayHTML(state.id):'';}
  function pager(key,album){return `<nav class="person-album-pager" aria-label="${tr('דפדוף באלבום','Album pages')}"><button type="button" class="secondary-button" data-person-page="${key}" data-step="-1" ${album.page<=1?'disabled':''}>${tr('הקודם','Previous')}</button><span>${tr('עמוד','Page')} ${album.page} ${tr('מתוך','of')} ${album.pages} · ${album.total} ${tr('פריטים','items')}</span><button type="button" class="secondary-button" data-person-page="${key}" data-step="1" ${album.page>=album.pages?'disabled':''}>${tr('הבא','Next')}</button></nav>`;}
  function card(key,item){
    let content;
    if(key==='photos')content=`<img src="${safe(item.src)}" alt="${safe(item.caption||I.mediaName(item))}" loading="lazy">`;
    else if(key==='videos')content=(item.poster?`<img src="${safe(item.poster)}" alt="" loading="lazy">`:`<span class="person-video-ornament" aria-hidden="true">❖</span>`)+`<span class="person-video-play" aria-hidden="true">▶</span><span class="person-file-title">${safe(item.caption||I.mediaName(item))}</span>`;
    else content=(item.mime.startsWith('image/')?`<img src="${safe(item.src)}?inline=1" alt="" loading="lazy">`:`<span class="person-document-icon" aria-hidden="true">▤</span>`)+`<span class="person-file-title">${safe(I.mediaName(item))}</span><small>${safe(item.filename?.split('.').pop()?.toUpperCase()||'')}</small>`;
    return `<button type="button" class="person-media-tile person-media-${key}" data-person-item="${safe(item.id)}" data-person-kind="${key}" aria-label="${tr('פתיחת','Open')} ${safe(item.caption||I.mediaName(item))}">${content}</button>`;
  }
  function album(key){
    const a=state.data.albums[key],title={photos:tr('תמונות','Photos'),videos:tr('סרטונים','Videos'),documents:tr('מסמכים ותעודות','Documents and certificates')}[key];
    const upload={photos:tr('העלאת תמונות','Upload photos'),videos:tr('העלאת סרטונים','Upload videos'),documents:tr('העלאת מסמכים ותעודות','Upload documents and certificates')}[key];
    return `<section class="person-album" id="personAlbum-${key}" data-person-drop="${key}" aria-label="${title}"><header><div><span class="small-eyebrow">${tr('כל פריט, חלק מהסיפור','Every item is part of the story')}</span><h3>${title}<small>${a.total}</small></h3></div><button class="primary-button" type="button" data-person-upload="${key}">＋ ${upload}</button></header>${key==='photos'?`<p class="person-album-help">${tr('גם התמונות שתויגו בגלריה המשפחתית מופיעות כאן. לחצו על תמונה לצפייה ולפעולות נוספות.','Photos tagged in the Family Gallery appear here too. Open a photo to view it and see its options.')}</p>`:''}<div class="person-album-grid person-grid-${key}">${a.items.map(item=>card(key,item)).join('')}</div>${!a.total?`<p class="person-album-empty">${tr('עוד מקום לזיכרון הבא. אפשר להוסיף כמה קבצים יחד.','Room for the next memory. You can upload several files together.')}</p>`:pager(key,a)}<p class="person-upload-limit">${key==='photos'?tr('עד 50MB לתמונה · אפשר גם לגרור או להדביק תמונה','Up to 50MB per photo · Drag or paste photos here'):key==='videos'?tr('MP4, WebM או MOV · עד 90MB לסרטון','MP4, WebM or MOV · Up to 90MB per video'):tr('PDF, Word, TXT או צילום תעודה · עד 10MB לקובץ','PDF, Word, TXT or certificate scans · Up to 10MB per file')}</p></section>`;
  }

  function relativeCard(id,kind) {
    const person=app().getPersonSummary(id),name=app().nameOf(id),initials=name.split(/\s+/).filter(Boolean).map(part=>part[0]).slice(0,2).join('');
    const role=kind==='parents'?({m:tr('אבא','Father'),f:tr('אמא','Mother')}[person.gender]||tr('הורה','Parent')):'';
    const image=person.profile?`<img class="profile-photo" src="${safe(person.profile)}" alt="" loading="lazy" decoding="async">`:`<span class="person-relative-initials">${safe(initials)}</span>`;
    return `<li><a class="person-relative-link" href="#person/${encodeURIComponent(id)}" data-person-relative="${safe(id)}" data-person="${safe(id)}" ${role?`title="${safe(role)}" `:''}aria-label="${safe((role?role+': ':'')+tr('פתיחת העמוד האישי של ','Open the personal page of ')+name)}"><span class="portrait" aria-hidden="true">${image}</span><span class="person-name">${safe(name)}${person.deceased?`&nbsp;<span class="memorial-inline">${tr('ז״ל','in memory')}</span>`:''}</span></a></li>`;
  }
  function relationsHTML(person) {
    const relatives=window.FamilyRelations?.forPerson(window.FAMILY_DATA,person.id)||{partners:[],parents:[],children:[],siblings:[]};
    const groups=[['partners',tr('בן/בת זוג','Partner')],['parents',tr('הורים','Parents')],['children',tr('ילדים','Children')],['siblings',tr('אחים/אחיות','Siblings')]];
    const emptyLabel=tr('טרם נוספו פרטים','No details added yet');
    return `<section class="person-family" aria-label="${tr('משפחה קרובה','Close family')}">${groups.map(([key,title])=>`<section class="person-family-group" data-relative-kind="${key}" aria-labelledby="personFamily-${key}"><h3 id="personFamily-${key}">${title}</h3>${relatives[key].length?`<ul class="person-family-list">${relatives[key].map(id=>relativeCard(id,key)).join('')}</ul>`:`<p class="person-family-empty" title="${emptyLabel}"><span aria-hidden="true">—</span><span class="visually-hidden">${emptyLabel}</span></p>`}</section>`).join('')}</section>`;
  }

  function render(){
    if(!state.ready||!state.id)return;
    const root=$('personPageContent');
    if(!state.data){root.innerHTML=`<p class="person-page-status" role="status">${safe(state.error||tr('טוען את העמוד האישי…','Loading the personal page…'))}</p>`;return;}
    const p=state.data.person,name=app().nameOf(state.id),initials=name.split(/\s+/).map(p=>p[0]).slice(0,2).join('');
    if(p.extra){
      $('workspaceTitle').textContent=tr('אלבום תמונות','Photo album');$('mobileViewTitle').textContent=tr('אלבום תמונות','Photo album');$('workspaceSubtitle').textContent=tr('מכרים וחברי משפחה','Family friends and acquaintances');
      root.innerHTML=`<nav class="person-page-breadcrumb"><a href="#directory" data-person-back>${I.isEnglish?'←':'→'} ${tr('חזרה','Back')}</a><span aria-hidden="true">›</span><span>${safe(name)}</span><button class="quiet-button" type="button" data-copy-person-link>${tr('העתקת קישור לאלבום','Copy album link')} ↗</button></nav><header class="person-page-hero"><button type="button" class="person-page-portrait" data-person-portrait aria-label="${tr('פתיחת תמונה מהאלבום','Open an album photo')}" ${p.profile?'':'disabled'}>${p.profile?`<img src="${safe(p.profile)}" alt="${safe(name)}">`:`<span>${safe(initials)}</span>`}</button><div><span class="small-eyebrow">${tr('מכרים וחברי משפחה','Family friends and acquaintances')}</span><h2>${safe(name)}</h2><p>${tr('התמונות והסרטונים שבהם תויגו','Photos and videos in which they are tagged')}</p></div></header><p class="person-page-status" id="personPageStatus" role="status">${safe(state.status||state.error)}${state.partial?`<button class="secondary-button person-page-retry" type="button" data-person-retry>${tr('ניסיון נוסף','Try again')}</button>`:''}</p>${state.partial?`<p class="person-page-unavailable">${tr('התמונות יופיעו כשהחיבור לשמירה יחזור.','Photos will appear when the connection returns.')}</p>`:keys.map(album).join('')}`;
      return;
    }
    root.innerHTML=`<nav class="person-page-breadcrumb"><a href="#directory" data-person-back>${I.isEnglish?'←':'→'} ${tr('חזרה','Back')}</a><span aria-hidden="true">›</span><span>${safe(name)}</span><button class="quiet-button" type="button" data-copy-person-link>${tr('העתקת קישור לעמוד','Copy page link')} ↗</button></nav><header class="person-page-hero"><button type="button" class="person-page-portrait" data-person-portrait aria-label="${tr('פתיחת תמונת הפרופיל','Open profile picture')}" ${p.profile?'':'disabled'}>${p.profile?`<img src="${safe(p.profile)}" alt="${safe(name)}">`:`<span>${safe(initials)}</span>`}</button><div><span class="small-eyebrow">${tr('הסיפור של','The story of')}</span><h2>${safe(name)}${p.deceased?`${p.id==='becker-parent'?'&nbsp;':' '}<small>${tr('ז״ל','in loving memory')}</small>`:''}</h2><div class="person-page-dates" id="personPageBirthday">${dates()}</div></div><span class="person-page-emblem" aria-hidden="true">❖</span></header>${relationsHTML(p)}<section class="person-about"><header><h3>${tr('אודות','About')}</h3><button class="person-about-pencil" data-edit-about type="button" aria-label="${tr('עריכת אודות','Edit biography')}" title="${tr('עריכת אודות','Edit biography')}" ${state.partial||biography()?.isEditing()?'disabled':''}>✎</button></header><div class="person-about-text" ${state.aboutEditing?'hidden':''}>${state.partial?`<span class="person-about-placeholder">${tr('הפרטים אינם זמינים כרגע','Details are currently unavailable')}</span>`:p[aboutKey()]?safe(p[aboutKey()]):`<span class="person-about-placeholder">${tr('כאן אפשר לכתוב כמה מילים על החיים, האנשים והרגעים שחשוב לזכור.','Add a few words about a life, the people and the moments worth remembering.')}</span>`}</div><form id="personAboutForm" ${state.aboutEditing?'':'hidden'}><label class="visually-hidden" for="personAboutText">${tr('אודות','About')}</label><textarea dir="auto" id="personAboutText" rows="7" maxlength="10000">${safe(state.aboutDraft)}</textarea><p id="personAboutError" class="form-error" role="alert"></p><div class="form-actions"><button class="primary-button" type="submit">${tr('שמירת האודות','Save biography')}</button><button class="secondary-button" type="button" data-cancel-about>${tr('ביטול','Cancel')}</button></div></form>${biography()?.render(p,!state.partial)||''}</section><p class="person-page-status" id="personPageStatus" role="status">${safe(state.status||state.error)}${state.partial?`<button class="secondary-button person-page-retry" type="button" data-person-retry>${tr('ניסיון נוסף','Try again')}</button>`:''}</p>${state.partial?`<p class="person-page-unavailable">${tr('התמונות והקבצים יופיעו כשהחיבור לשמירה יחזור. פריטים קיימים אינם זמינים כרגע.','Photos and files will appear when the connection returns. Existing items are currently unavailable.')}</p>`:keys.map(album).join('')}`;
  }
  async function load(force=false){
    if(!state.id)return;if(editing()){refreshPending=true;return;}const id=state.id,params=new URLSearchParams(state.pages),key=id+params;
    if(state.loading){if(force||state.loadingKey!==key)state.queued=true;return;}
    state.loading=true;state.loadingKey=key;
    try{
      const response=await I.fetch('api/people/'+encodeURIComponent(id)+'/page?'+params,{cache:'no-store',headers:!force&&state.revision?{'If-None-Match':'"'+state.revision+'"'}:{}});
      if(response.status===304)return;
      const result=await response.json();if(!response.ok)throw Error(I.error(result.error));
      if(state.id!==id||id+new URLSearchParams(state.pages)!==key)return;
      if(editing()){refreshPending=true;return;}
      state.partial=false;state.data=result;state.revision=result.revision;for(const key of keys)state.pages[key]=result.albums[key].page;
      app().updatePerson(id,result.person);state.error='';render();
    }catch(error){if(id===state.id){state.error=error.message;if(!state.data){state.partial=true;state.data={person:{...app().getPersonSummary(id)},albums:{}};}render();}}finally{state.loading=false;state.loadingKey=null;if(state.queued){state.queued=false;load(true);}}
  }
  function open(id,sync=true){
    if(!app().getPerson(id))return;
    if($('calendarDayDialog').open)$('calendarDayDialog').close();if($('mediaViewer').open)$('mediaViewer').close();if($('personDialog').open)$('personDialog').close();
    if(state.id!==id){biography()?.reset();refreshPending=false;state.partial=false;state.id=id;state.data=null;state.pages={photos:1,videos:1,documents:1};state.revision=null;state.aboutEditing=false;state.aboutDraft='';state.status='';state.error='';}
    if(sync){const hash='#person/'+encodeURIComponent(id);if(window.FamilyNavigation)window.FamilyNavigation.go(hash);else if(location.hash!==hash)history.pushState(null,'',hash);}
    app().setView('person',false);window.scrollTo({top:0,behavior:'instant'});
  }
  function route(){const match=/^#person\/([^/]+)$/.exec(location.hash);if(match)try{const id=decodeURIComponent(match[1]);if(state.view!=='person'||state.id!==id)open(id,false);}catch{app().toast(tr('הקישור לעמוד אינו תקין.','This page link is invalid.'));}}
  function activate(view){
    state.view=view;$('personView').hidden=view!=='person';if(view!=='person'||!state.ready)return;
    const match=/^#person\/([^/]+)$/.exec(location.hash);let requested;try{requested=match?decodeURIComponent(match[1]):null;}catch{return;}
    if(requested&&requested!==state.id&&app().getPerson(requested)){open(requested,false);return;}
    render();if(state.id&&!state.data)load();
  }
  function uploadOne(id,kind,file,progress){
    return new Promise((resolve,reject)=>{
      const params=new URLSearchParams({filename:file.name,layout:'page',...state.pages,[kind]:1});
      const xhr=new XMLHttpRequest();xhr.open('POST','api/people/'+encodeURIComponent(id)+'/'+kind+'?'+params);xhr.setRequestHeader('X-Family-Token',window.FAMILY_API_TOKEN);xhr.setRequestHeader('Content-Type',file.type||'application/octet-stream');
      xhr.upload.onprogress=event=>{if(event.lengthComputable)progress(Math.round(event.loaded/event.total*100));};
      xhr.onload=()=>{let result;try{result=JSON.parse(xhr.responseText);}catch{reject(Error(tr('לא התקבל אישור שמירה. נסו שוב.','No save confirmation was received. Please try again.')));return;}if(xhr.status>=200&&xhr.status<300)resolve(result);else reject(Error(I.error(result.error)));};xhr.onerror=()=>reject(Error(tr('ההעלאה נקטעה. נסו שוב.','The upload was interrupted. Please try again.')));const payload=window.FamilyPhotoEditor?.upload?.(file)||{body:file};for(const [name,value]of Object.entries(payload.headers||{}))xhr.setRequestHeader(name,value);xhr.send(payload.body);
    });
  }
  function applyUploaded(id,result){app().updatePerson(id,result.person);
        if(id===state.id){state.data=result;state.revision=null;for(const key of keys)state.pages[key]=result.albums[key].page;state.status=tr('נשמר ✓ ','Saved ✓ ')+file.name;render();}}
  async function queue(id,kind,files){
    if(!app().apiEnabled)return;let approved=[...files];
    if(kind==='photos'){
      try{approved=await window.FamilyPhotoEditor.prepare(approved,{scope:'personal:'+id,onUpload:async(file,progress)=>{const result=await uploadOne(id,kind,file,progress);applyUploaded(id,result);}});}catch{app().toast(tr('מסך עריכת התמונות לא נטען. רעננו את הדף ונסו שוב.','The photo editor could not open. Refresh the page and try again.'));return;}
      if(!approved?.length)return;
    }
    state.queue.push(...approved.map(file=>({id,kind,file})));runUploads();
  }
  async function runUploads(){
    if(state.running)return;state.running=true;let saved=0;
    while(state.queue.length){const {id,kind,file}=state.queue.shift(),max=kind==='videos'?90:kind==='documents'?10:50;
      try{if(file.size>max*1024*1024)throw Error(tr('הקובץ גדול מדי. המגבלה: ','The file is too large. Limit: ')+max+'MB');
        const progress=percent=>{if(id!==state.id)return;state.status=tr('מעלה ','Uploading ')+file.name+' · '+percent+'%';if($('personPageStatus'))$('personPageStatus').textContent=state.status;};progress(0);
        const result=await uploadOne(id,kind,file,progress);saved++;applyUploaded(id,result);
      }catch(error){app().toast(file.name+': '+error.message);}
    }
    state.running=false;state.status=saved?tr('הקבצים נשמרו ✓','Files saved ✓'):tr('לא נשמרו קבצים. אפשר לנסות שוב.','No files were saved. Please try again.');if($('personPageStatus'))$('personPageStatus').textContent=state.status;
  }
  function init(){
    state.ready=true;route();activate(app().getView());
    const root=$('personPageContent');
    biography()?.attach(root,{person:()=>state.data?.person,isBlocked:()=>state.aboutEditing||state.partial,render,save:(id,body)=>api('api/people/'+encodeURIComponent(id)+'/biography',body),saved:(id,person)=>{app().updatePerson(id,person);if(id===state.id){state.data.person={...state.data.person,...person};state.revision=null;state.status=tr('הפרטים נשמרו ✓','Details saved ✓');}},finished:finishEditing});
    root.addEventListener('click',async event=>{
      const relative=event.target.closest('[data-person-relative]');
      if(relative){
        event.stopPropagation();
        if(event.button>0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
        event.preventDefault();open(relative.dataset.personRelative);return;
      }
      if(event.target.closest('[data-person-back]')){event.preventDefault();if(!window.FamilyNavigation?.back('#directory'))app().setView('directory',false);return;}
      if(event.target.closest('[data-person-retry]')){load(true);return;}
      const page=event.target.closest('[data-person-page]');if(page&&!page.disabled){const key=page.dataset.personPage;state.pages[key]+=Number(page.dataset.step);await load(true);$('personAlbum-'+key)?.scrollIntoView({block:'start',behavior:'instant'});return;}
      const item=event.target.closest('[data-person-item]');if(item){const items=state.data.albums[item.dataset.personKind].items;window.FamilyMedia.open(items,items.findIndex(p=>p.id===item.dataset.personItem),'personal:'+state.id);return;}
      if(event.target.closest('[data-person-portrait]')&&state.data.person.profile){const id=state.data.person.profile.split('?')[0].split('/').pop();try{const result=await api('api/media/'+id+'/view');window.FamilyMedia.open([result.item],0,'personal:'+state.id);}catch(error){app().toast(error.message);}return;}
      if(event.target.closest('[data-edit-about]')&&!state.partial&&!biography()?.isEditing()){state.aboutEditing=true;state.aboutExpected=state.data.person[aboutKey()]||'';state.aboutDraft=state.aboutExpected;render();$('personAboutText').focus();return;}
      if(event.target.closest('[data-cancel-about]')){state.aboutEditing=false;render();finishEditing();return;}
      const upload=event.target.closest('[data-person-upload]');if(upload){picker={id:state.id,kind:upload.dataset.personUpload};const input=$('personPageUpload');input.accept=picker.kind==='photos'?'image/jpeg,image/png,image/webp,image/gif,image/avif':picker.kind==='videos'?'video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov':'.pdf,.doc,.docx,.txt,.md,image/jpeg,image/png,image/webp,image/gif,image/avif';input.value='';input.click();return;}
      if(event.target.closest('[data-copy-person-link]')){const url=new URL('/',location.origin);url.searchParams.set('lang',I.language);url.hash='person/'+encodeURIComponent(state.id);try{await navigator.clipboard.writeText(url.href);app().toast(tr('הקישור לעמוד הועתק ✓','Page link copied ✓'));}catch{app().toast(url.href);}}
    });
    root.addEventListener('input',event=>{if(event.target.id==='personAboutText')state.aboutDraft=event.target.value;});
    root.addEventListener('submit',async event=>{if(event.target.id!=='personAboutForm')return;event.preventDefault();const id=state.id,button=event.target.querySelector('[type=submit]');button.disabled=true;
      try{const result=await api('api/people/'+encodeURIComponent(id)+'/about',{about:state.aboutDraft,expectedAbout:state.aboutExpected,language:I.isEnglish?'en':'he'});app().updatePerson(id,result.person);if(state.id===id){state.data.person={...state.data.person,...result.person};state.aboutEditing=false;state.status=tr('האודות נשמר ✓','Biography saved ✓');render();finishEditing();}}
      catch(error){if($('personAboutError'))$('personAboutError').textContent=error.message;}finally{button.disabled=false;}
    });
    $('personPageUpload').addEventListener('change',()=>{if(picker&&$('personPageUpload').files.length)queue(picker.id,picker.kind,$('personPageUpload').files);$('personPageUpload').value='';});
    $('personView').addEventListener('dragover',event=>{if(state.view!=='person')return;event.preventDefault();event.stopPropagation();event.target.closest('[data-person-drop]')?.classList.add('drag-over');});
    $('personView').addEventListener('dragleave',event=>event.target.closest('[data-person-drop]')?.classList.remove('drag-over'));
    $('personView').addEventListener('drop',event=>{event.preventDefault();event.stopPropagation();const zone=event.target.closest('[data-person-drop]'),kind=zone?.dataset.personDrop||'photos';zone?.classList.remove('drag-over');queue(state.id,kind,event.dataTransfer.files);});
    document.addEventListener('paste',event=>{if(state.view!=='person'||document.querySelector('dialog[open]')||event.target.closest('input,textarea'))return;const files=[...(event.clipboardData?.items||[])].filter(p=>p.kind==='file'&&p.type.startsWith('image/')).map(p=>p.getAsFile()).filter(Boolean);if(files.length){event.preventDefault();queue(state.id,'photos',files);}});
    window.addEventListener('hashchange',route);window.addEventListener('popstate',route);
    const refresh=()=>{if(state.view!=='person'||!state.id||state.running)return;clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>load(true),150);};
    window.addEventListener('family-person-changed',event=>{if(event.detail.id===state.id)refresh();});
    window.addEventListener('family-media-changed',event=>{if(event.detail.operation==='labels'&&event.detail.item){const item=event.detail.item;for(const album of Object.values(state.data?.albums||{}))album.items=album.items.map(photo=>photo.id===item.id?{...photo,...item}:photo);return;}if(event.detail.affectedPersonIds?.includes(state.id)){tagsDirty=true;if(!$('mediaViewer').open&&!$('tagPeopleDialog').open){tagsDirty=false;refresh();}}else if(event.detail.people?.[state.id]||event.detail.person?.id===state.id)refresh();});
    const finishTags=()=>{if(tagsDirty&&!document.querySelector('dialog[open]')){tagsDirty=false;refresh();}};
    $('mediaViewer').addEventListener('close',finishTags);$('tagPeopleDialog').addEventListener('close',finishTags);
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&state.view==='person')load();});
    setInterval(()=>{if(document.visibilityState==='visible'&&state.view==='person'&&!editing()&&!document.querySelector('dialog[open]'))load();},120000);
    window.addEventListener('beforeunload',event=>{if(state.running||biography()?.isDirty()||(state.aboutEditing&&state.aboutDraft!==state.aboutExpected)){event.preventDefault();event.returnValue='';}});
  }
  window.FamilyPeople={open,activate,search:()=>{}};document.addEventListener('DOMContentLoaded',init);
})();
