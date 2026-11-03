(() => {
  'use strict';
  const I=window.FamilyI18n,$=id=>document.getElementById(id),app=()=>window.FamilyApp;
  const tr=(he,en)=>I.isEnglish?en:he;
  const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const keys=['photos','videos','documents'];
  const state={view:'tree',id:null,data:null,ready:false,loading:false,loadingKey:null,queued:false,pages:{photos:1,videos:1,documents:1},revision:null,aboutEditing:false,aboutDraft:'',aboutExpected:'',running:false,queue:[],status:'',error:''};
  let picker=null,refreshTimer,tagsDirty=false;
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
  function render(){
    if(!state.ready||!state.id)return;
    const root=$('personPageContent');
    if(!state.data){root.innerHTML=`<p class="person-page-status" role="status">${safe(state.error||tr('טוען את העמוד האישי…','Loading the personal page…'))}</p>`;return;}
    const p=state.data.person,name=app().nameOf(state.id),initials=name.split(/\s+/).map(p=>p[0]).slice(0,2).join('');
    root.innerHTML=`<nav class="person-page-breadcrumb"><a href="#directory">${tr('בני המשפחה','Family members')}</a><span aria-hidden="true">›</span><span>${safe(name)}</span><button class="quiet-button" type="button" data-copy-person-link>${tr('העתקת קישור לעמוד','Copy page link')} ↗</button></nav><header class="person-page-hero"><button type="button" class="person-page-portrait" data-person-portrait aria-label="${tr('פתיחת תמונת הפרופיל','Open profile photo')}" ${p.profile?'':'disabled'}>${p.profile?`<img src="${safe(p.profile)}" alt="${safe(name)}">`:`<span>${safe(initials)}</span>`}</button><div><span class="small-eyebrow">${tr('הסיפור של','The story of')}</span><h2>${safe(name)} ${p.deceased?`<small>${tr('ז״ל','in loving memory')}</small>`:''}</h2><div class="person-page-dates" id="personPageBirthday">${dates()}</div></div><span class="person-page-emblem" aria-hidden="true">❖</span></header><section class="person-about"><header><h3>${tr('אודות','About')}</h3><button class="person-about-pencil" data-edit-about type="button" aria-label="${tr('עריכת אודות','Edit biography')}" title="${tr('עריכת אודות','Edit biography')}">✎</button></header><div class="person-about-text" ${state.aboutEditing?'hidden':''}>${p.about?safe(p.about):`<span class="person-about-placeholder">${tr('כאן אפשר לכתוב כמה מילים על החיים, האנשים והרגעים שחשוב לזכור.','Add a few words about a life, the people and the moments worth remembering.')}</span>`}</div><form id="personAboutForm" ${state.aboutEditing?'':'hidden'}><label class="visually-hidden" for="personAboutText">${tr('אודות','About')}</label><textarea dir="auto" id="personAboutText" rows="7" maxlength="10000">${safe(state.aboutDraft)}</textarea><p id="personAboutError" class="form-error" role="alert"></p><div class="form-actions"><button class="primary-button" type="submit">${tr('שמירת האודות','Save biography')}</button><button class="secondary-button" type="button" data-cancel-about>${tr('ביטול','Cancel')}</button></div></form></section><p class="person-page-status" id="personPageStatus" role="status">${safe(state.status||state.error)}</p>${keys.map(album).join('')}`;
  }
  async function load(force=false){
    if(!state.id)return;const id=state.id,params=new URLSearchParams(state.pages),key=id+params;
    if(state.loading){if(force||state.loadingKey!==key)state.queued=true;return;}
    state.loading=true;state.loadingKey=key;
    try{
      const response=await I.fetch('api/people/'+encodeURIComponent(id)+'/page?'+params,{cache:'no-store',headers:!force&&state.revision?{'If-None-Match':'"'+state.revision+'"'}:{}});
      if(response.status===304)return;
      const result=await response.json();if(!response.ok)throw Error(I.error(result.error));
      if(state.id!==id||id+new URLSearchParams(state.pages)!==key)return;
      state.data=result;state.revision=result.revision;for(const key of keys)state.pages[key]=result.albums[key].page;
      app().updatePerson(id,result.person);state.error='';render();
    }catch(error){if(id===state.id){state.error=error.message;render();}}finally{state.loading=false;state.loadingKey=null;if(state.queued){state.queued=false;load(true);}}
  }
  function open(id,sync=true){
    if(!app().getPerson(id))return;
    if($('calendarDayDialog').open)$('calendarDayDialog').close();if($('mediaViewer').open)$('mediaViewer').close();if($('personDialog').open)$('personDialog').close();
    if(state.id!==id){state.id=id;state.data=null;state.pages={photos:1,videos:1,documents:1};state.revision=null;state.aboutEditing=false;state.aboutDraft='';state.status='';state.error='';}
    if(sync&&location.hash!=='#person/'+encodeURIComponent(id))history.pushState(null,'','#person/'+encodeURIComponent(id));
    app().setView('person',false);window.scrollTo({top:0,behavior:'instant'});
  }
  function route(){const match=/^#person\/([^/]+)$/.exec(location.hash);if(match)try{open(decodeURIComponent(match[1]),false);}catch{app().toast(tr('הקישור לעמוד אינו תקין.','This page link is invalid.'));}}
  function activate(view){
    state.view=view;$('personView').hidden=view!=='person';if(view!=='person'||!state.ready)return;
    if(!state.id){const match=/^#person\/([^/]+)$/.exec(location.hash);if(match)state.id=decodeURIComponent(match[1]);}
    render();if(state.id&&!state.data)load();
  }
  function uploadOne(id,kind,file,progress){
    return new Promise((resolve,reject)=>{
      const params=new URLSearchParams({filename:file.name,layout:'page',...state.pages,[kind]:1});
      const xhr=new XMLHttpRequest();xhr.open('POST','api/people/'+encodeURIComponent(id)+'/'+kind+'?'+params);xhr.setRequestHeader('X-Family-Token',window.FAMILY_API_TOKEN);xhr.setRequestHeader('Content-Type',file.type||'application/octet-stream');
      xhr.upload.onprogress=event=>{if(event.lengthComputable)progress(Math.round(event.loaded/event.total*100));};
      xhr.onload=()=>{let result;try{result=JSON.parse(xhr.responseText);}catch{reject(Error(tr('לא התקבל אישור שמירה. נסו שוב.','No save confirmation was received. Please try again.')));return;}if(xhr.status>=200&&xhr.status<300)resolve(result);else reject(Error(I.error(result.error)));};xhr.onerror=()=>reject(Error(tr('ההעלאה נקטעה. נסו שוב.','The upload was interrupted. Please try again.')));xhr.send(file);
    });
  }
  function queue(id,kind,files){
    if(!app().apiEnabled)return;state.queue.push(...[...files].map(file=>({id,kind,file})));runUploads();
  }
  async function runUploads(){
    if(state.running)return;state.running=true;let saved=0;
    while(state.queue.length){const {id,kind,file}=state.queue.shift(),max=kind==='videos'?90:kind==='documents'?10:50;
      try{if(file.size>max*1024*1024)throw Error(tr('הקובץ גדול מדי. המגבלה: ','The file is too large. Limit: ')+max+'MB');
        const progress=percent=>{if(id!==state.id)return;state.status=tr('מעלה ','Uploading ')+file.name+' · '+percent+'%';if($('personPageStatus'))$('personPageStatus').textContent=state.status;};progress(0);
        const result=await uploadOne(id,kind,file,progress);saved++;app().updatePerson(id,result.person);
        if(id===state.id){state.data=result;state.revision=null;for(const key of keys)state.pages[key]=result.albums[key].page;state.status=tr('נשמר ✓ ','Saved ✓ ')+file.name;render();}
      }catch(error){app().toast(file.name+': '+error.message);}
    }
    state.running=false;state.status=saved?tr('הקבצים נשמרו ✓','Files saved ✓'):tr('לא נשמרו קבצים. אפשר לנסות שוב.','No files were saved. Please try again.');if($('personPageStatus'))$('personPageStatus').textContent=state.status;
  }
  function init(){
    state.ready=true;route();activate(app().getView());
    const root=$('personPageContent');
    root.addEventListener('click',async event=>{
      const page=event.target.closest('[data-person-page]');if(page&&!page.disabled){const key=page.dataset.personPage;state.pages[key]+=Number(page.dataset.step);await load(true);$('personAlbum-'+key)?.scrollIntoView({block:'start',behavior:'instant'});return;}
      const item=event.target.closest('[data-person-item]');if(item){const items=state.data.albums[item.dataset.personKind].items;window.FamilyMedia.open(items,items.findIndex(p=>p.id===item.dataset.personItem),'personal:'+state.id);return;}
      if(event.target.closest('[data-person-portrait]')&&state.data.person.profile){const id=state.data.person.profile.split('/').pop();try{const result=await api('api/media/'+id+'/view');window.FamilyMedia.open([result.item],0,'personal:'+state.id);}catch(error){app().toast(error.message);}return;}
      if(event.target.closest('[data-edit-about]')){state.aboutEditing=true;state.aboutExpected=state.data.person.about||'';state.aboutDraft=state.aboutExpected;render();$('personAboutText').focus();return;}
      if(event.target.closest('[data-cancel-about]')){state.aboutEditing=false;render();return;}
      const upload=event.target.closest('[data-person-upload]');if(upload){picker={id:state.id,kind:upload.dataset.personUpload};const input=$('personPageUpload');input.accept=picker.kind==='photos'?'image/jpeg,image/png,image/webp,image/gif,image/avif':picker.kind==='videos'?'video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov':'.pdf,.doc,.docx,.txt,.md,image/jpeg,image/png,image/webp,image/gif,image/avif';input.value='';input.click();return;}
      if(event.target.closest('[data-copy-person-link]')){const url=new URL('/',location.origin);url.searchParams.set('lang',I.language);url.hash='person/'+encodeURIComponent(state.id);try{await navigator.clipboard.writeText(url.href);app().toast(tr('הקישור לעמוד הועתק ✓','Page link copied ✓'));}catch{app().toast(url.href);}}
    });
    root.addEventListener('input',event=>{if(event.target.id==='personAboutText')state.aboutDraft=event.target.value;});
    root.addEventListener('submit',async event=>{if(event.target.id!=='personAboutForm')return;event.preventDefault();const id=state.id,button=event.target.querySelector('[type=submit]');button.disabled=true;
      try{const result=await api('api/people/'+encodeURIComponent(id)+'/about',{about:state.aboutDraft,expectedAbout:state.aboutExpected});app().updatePerson(id,result.person);if(state.id===id){state.data.person={...state.data.person,...result.person};state.aboutEditing=false;state.status=tr('האודות נשמר ✓','Biography saved ✓');render();}}
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
    window.addEventListener('family-media-changed',event=>{if(event.detail.affectedPersonIds?.includes(state.id)){tagsDirty=true;if(!$('mediaViewer').open&&!$('tagPeopleDialog').open){tagsDirty=false;refresh();}}else if(event.detail.people?.[state.id]||event.detail.person?.id===state.id)refresh();});
    const finishTags=()=>{if(tagsDirty&&!document.querySelector('dialog[open]')){tagsDirty=false;refresh();}};
    $('mediaViewer').addEventListener('close',finishTags);$('tagPeopleDialog').addEventListener('close',finishTags);
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&state.view==='person')load();});
    setInterval(()=>{if(document.visibilityState==='visible'&&state.view==='person'&&!state.aboutEditing&&!document.querySelector('dialog[open]'))load();},120000);
    window.addEventListener('beforeunload',event=>{if(state.running||(state.aboutEditing&&state.aboutDraft!==state.aboutExpected)){event.preventDefault();event.returnValue='';}});
  }
  window.FamilyPeople={open,activate,search:()=>{}};document.addEventListener('DOMContentLoaded',init);
})();
