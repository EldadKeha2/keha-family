(() => {
  'use strict';
  const I=window.FamilyI18n,$=id=>document.getElementById(id),app=()=>window.FamilyApp,tr=(he,en)=>I.isEnglish?en:he;
  const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normalize=value=>String(value).normalize('NFKD').replace(/[\u0591-\u05c7'"׳״]/g,'').toLowerCase().trim();
  const scope=id=>'nursery:'+id,icon='<svg viewBox="0 0 48 48" aria-hidden="true"><use href="assets/home-icons.svg#nursery"></use></svg>';
  const albums=new Map(),albumVersions=new Map(),errors=new Map(),messages=new Map(),loading=new Set(),queue=[];
  const state={ready:false,view:'tree',id:null,page:1,query:'',summaries:{},summaryLoading:false,summaryError:'',summaryLoaded:false,running:false,uploading:null};
  // Use the live family roster, never a manually maintained list of nursery cards.
  const members=()=>app().getPeople().filter(person=>!person.extended&&!person.extra);
  const member=id=>members().find(person=>person.id===id);
  const name=id=>app().nameOf(id),photoCount=n=>I.isEnglish?`${n} ${n===1?'photo':'photos'}`:n===1?'תמונה אחת':`${n} תמונות`;
  const routeId=()=>{try{return /^#nursery\/([^/]+)$/.exec(location.hash)?.[1]?decodeURIComponent(location.hash.slice(9)):null;}catch{return null;}};
  function indexCard(person){
    const summary=state.summaries[person.id],label=name(person.id);
    return `<a class="nursery-card${summary?.count?' has-baby-photos':''}" href="#nursery/${encodeURIComponent(person.id)}" data-nursery-person="${safe(person.id)}" aria-label="${safe(tr('אלבום התינוקייה של ','Baby album for ')+label)}"><span class="nursery-frame">${summary?.cover?`<img src="${safe(summary.cover)}" alt="${safe(tr('תמונת תינוקות של ','Baby photo of ')+label)}" loading="lazy" decoding="async">`:`<span class="nursery-placeholder">${icon}<span>${tr('כאן מתחיל הסיפור','The story starts here')}</span></span>`}<span class="nursery-frame-corner" aria-hidden="true">❖</span></span><strong>${safe(label)}</strong><span class="nursery-card-action">${summary?.count?`${photoCount(summary.count)} <span aria-hidden="true">${I.isEnglish?'→':'←'}</span>`:`<span aria-hidden="true">＋</span> ${tr('הוספת תמונות','Add baby photos')}`}</span></a>`;
  }
  function renderIndex(){
    const all=members(),query=normalize(state.query),visible=all.filter(person=>!query||normalize(I.searchNames({...person,...app().getPersonSummary(person.id)})).includes(query));
    const filled=all.filter(person=>state.summaries[person.id]?.count).length;
    $('nurseryContent').innerHTML=`<header class="nursery-intro"><span class="nursery-intro-icon" aria-hidden="true">${icon}</span><span class="small-eyebrow">${tr('ההתחלה של כולנו','Where we all began')}</span><h2>${tr('גם אנחנו היינו פעם קטנטנים','We were little once, too')}</h2><p>${tr('חיוכים ראשונים, לחיים עגולות ורגעים קטנים של משפחה. לחצו על כרטיס והוסיפו תמונות תינוקות.','First smiles, chubby cheeks and little family moments. Open a card to add baby photos.')}</p><span class="nursery-intro-ornament" aria-hidden="true">◇ ❖ ◇</span></header><div class="nursery-index-heading"><h3>${tr('אלבומי התינוקייה שלנו','Our baby albums')}</h3><span>${state.summaryLoaded?(I.isEnglish?`${filled} of ${all.length} albums have photos`:`${filled} מתוך ${all.length} אלבומים עם תמונות`):tr('יש מקום לכולם','A little space for everyone')}</span></div><p class="nursery-status${state.summaryError?' is-error':''}" role="status">${safe(state.summaryError||(!state.summaryLoaded?tr('טוען תמונות תינוקות…','Loading baby photos…'):''))}${state.summaryError?` <button type="button" data-nursery-retry>${tr('ניסיון נוסף','Try again')}</button>`:''}</p><div class="nursery-grid">${visible.map(indexCard).join('')}</div>${!visible.length?`<p class="nursery-no-match">${tr('לא נמצא שם מתאים. נסו לחפש בשם הפרטי.','No matching name. Try a first name.')}</p>`:''}`;
  }
  function photoCard(item,id){
    return `<article class="compact-gallery-card nursery-photo-card"><button type="button" class="gallery-image" data-media-open="${safe(item.id)}" data-media-scope="${safe(scope(id))}" aria-label="${safe(tr('פתיחת תמונת התינוקות: ','Open baby photo: ')+(item.caption||I.mediaName(item)))}"><img src="${safe(item.src)}" alt="${safe(item.caption||tr('תמונת תינוקות של ','Baby photo of ')+name(id))}" loading="lazy" decoding="async"></button><div class="compact-photo-info"><span>${safe(item.caption||I.mediaName(item))}</span><button type="button" class="compact-photo-delete" data-media-delete="${safe(item.id)}" data-media-scope="${safe(scope(id))}" aria-label="${safe(tr('מחיקת התמונה ','Delete photo ')+I.mediaName(item))}">×</button></div></article>`;
  }
  function renderAlbum(){
    const id=state.id,album=albums.get(id),items=album?.items||[],p=album?.pagination||{page:1,pages:1,total:0},busy=Boolean(state.uploading),status=messages.get(id)||'',error=errors.get(id)||'';
    window.FamilyMedia.register(scope(id),items,{cover:album?.cover});
    $('nurseryContent').innerHTML=`<nav class="person-page-breadcrumb nursery-breadcrumb"><a href="#nursery" data-nursery-back>${I.isEnglish?'←':'→'} ${tr('חזרה לתינוקייה','Back to the nursery')}</a><span aria-hidden="true">›</span><span>${safe(name(id))}</span></nav><header class="nursery-album-hero"><span class="nursery-album-emblem" aria-hidden="true">${icon}</span><div><span class="small-eyebrow">${tr('האלבום של ההתחלה','The very first chapter')}</span><h2>${safe(name(id))}</h2><p>${tr('תמונות התינוקות שלי','My baby photos')}</p></div><span class="nursery-hero-diamond" aria-hidden="true">❖</span></header><div class="collection-heading nursery-album-heading"><div><h3>${tr('אלבום התינוקייה','Baby album')}</h3><span class="collection-count">${album?photoCount(album.count):tr('טוען את האלבום…','Loading the album…')}</span></div><button class="primary-button" type="button" data-nursery-upload ${busy?'disabled':''}>＋ ${tr('הוספת תמונות','Add photos')}</button></div><p class="nursery-album-help">${tr('לחצו על תמונה לצפייה, תיאור, תיוג ושיתוף, בדיוק כמו בגלריה המשפחתית.','Open a photo to view it, add a description, tag or share, just like in the Family Gallery.')}</p><p class="nursery-status${error?' is-error':''}" role="status">${safe(error||status)}${error?` <button type="button" data-nursery-retry>${tr('ניסיון נוסף','Try again')}</button>`:''}</p><div class="compact-gallery-grid nursery-photo-grid">${items.map(item=>photoCard(item,id)).join('')}</div>${album&&!album.count?`<div class="nursery-empty-album"><span aria-hidden="true">${icon}</span><h3>${tr('לתמונה הראשונה יש מקום מיוחד','A special place for the first photo')}</h3><p>${tr('מצאו תמונת תינוקות מהאלבום המשפחתי והוסיפו אותה לכאן.','Find a baby photo in the family album and add it here.')}</p><button type="button" class="primary-button" data-nursery-upload ${busy?'disabled':''}>＋ ${tr('בחירת תמונות','Choose photos')}</button></div>`:''}${p.total?`<nav class="person-album-pager nursery-pager" aria-label="${tr('דפדוף באלבום התינוקייה','Baby album pages')}"><button class="secondary-button" type="button" data-nursery-page="-1" ${p.page<=1?'disabled':''}>${tr('הקודם','Previous')}</button><span>${I.isEnglish?`Page ${p.page} of ${p.pages}`:`עמוד ${p.page} מתוך ${p.pages}`} · ${photoCount(p.total)}</span><button class="secondary-button" type="button" data-nursery-page="1" ${p.page>=p.pages?'disabled':''}>${tr('הבא','Next')}</button></nav>`:''}<section class="collection-upload nursery-dropzone" data-nursery-drop><div><span class="small-eyebrow">${tr('עוד רגע קטן לשמור','Another little moment to keep')}</span><h3>${tr('מוסיפים תמונות לתינוקייה','Add photos to the baby album')}</h3><p>${tr('אפשר לבחור כמה תמונות יחד, לגרור לכאן או להדביק תמונה. עד 50MB לתמונה.','Choose several photos, drag them here or paste a photo. Up to 50MB per photo.')}</p></div><button class="primary-button" type="button" data-nursery-upload ${busy?'disabled':''}>＋ ${tr('בחירת תמונות','Choose photos')}</button><button class="secondary-button mobile-camera" type="button" data-nursery-camera ${busy?'disabled':''}>${tr('צילום תמונה','Take a photo')}</button><p class="nursery-upload-status" id="nurseryUploadStatus" role="status" aria-live="polite">${safe(status)}</p><progress id="nurseryProgress" max="100" value="${state.uploading?.id===id?state.uploading.percent:0}" ${state.uploading?.id===id?'':'hidden'} aria-label="${tr('התקדמות העלאת התמונות','Photo upload progress')}"></progress></section>`;
  }
  function render(){
    if(!state.ready||state.view!=='nursery')return;
    document.body.dataset.nurseryMode=state.id?'album':'index';
    if(state.id)renderAlbum();else renderIndex();
  }
  async function loadIndex(){
    if(state.summaryLoading||!app().apiEnabled)return;state.summaryLoading=true;
    const versions=new Map(albumVersions);
    try{const response=await I.fetch('api/nursery',{cache:'no-store'}),result=await response.json();if(!response.ok)throw Error(I.error(result.error));const summaries=result.albums;for(const [id,version]of albumVersions)if(version!==versions.get(id)&&state.summaries[id])summaries[id]=state.summaries[id];state.summaries=summaries;state.summaryLoaded=true;state.summaryError='';}
    catch(error){state.summaryError=error.message||tr('לא ניתן לטעון את התינוקייה כרגע.','The nursery is currently unavailable.');}
    finally{state.summaryLoading=false;render();}
  }
  function applyAlbum(id,album,mutation=false){
    if(mutation)albumVersions.set(id,(albumVersions.get(id)||0)+1);
    albums.set(id,album);state.summaries[id]={count:album.count,cover:'cover' in album?album.cover:album.pagination?.page>1?(state.summaries[id]?.cover||album.items[0]?.src||null):(album.items[0]?.src||null)};
  }
  async function loadAlbum(id,page=state.page){
    const key=id+':'+page;if(loading.has(key)||!app().apiEnabled)return;loading.add(key);errors.delete(id);
    const version=albumVersions.get(id);
    try{const response=await I.fetch('api/nursery/'+encodeURIComponent(id)+'?page='+page,{cache:'no-store'}),result=await response.json();if(!response.ok)throw Error(I.error(result.error));if(state.id===id&&state.page===page&&albumVersions.get(id)===version){applyAlbum(id,result);state.page=result.pagination.page;}}
    catch(error){if(state.id===id&&state.page===page)errors.set(id,error.message||tr('לא ניתן לטעון את האלבום כרגע.','The album is currently unavailable.'));}
    finally{loading.delete(key);render();}
  }
  function activate(next){
    state.view=next;$('nurseryView').hidden=next!=='nursery';if(!state.ready||next!=='nursery')return;
    const requested=routeId(),id=requested&&member(requested)?requested:null;
    if(state.id!==id){state.id=id;state.page=1;state.query='';}
    render();if(id)loadAlbum(id,state.page);else loadIndex();
  }
  function navigate(id){
    if(id&&!member(id))return;
    const hash=id?'#nursery/'+encodeURIComponent(id):'#nursery';
    if(window.FamilyNavigation)window.FamilyNavigation.go(hash);else if(location.hash!==hash)history.pushState(null,'',hash);
    state.query='';$('searchInput').value='';app().setView('nursery',false);window.scrollTo({top:0,behavior:'instant'});
  }
  function pick(camera=false){
    if(!state.id||state.running)return;
    if(!app().apiEnabled){app().toast(tr('השמירה אינה זמינה כרגע. נסו לרענן.','Saving is currently unavailable. Please refresh.'));return;}
    const input=$(camera?'nurseryCameraInput':'nurseryUploadInput');input.value='';input.dataset.personId=state.id;input.click();
  }
  function uploadFile(id,file,onProgress){
    return new Promise((resolve,reject)=>{
      const xhr=new XMLHttpRequest();xhr.open('POST','api/nursery/'+encodeURIComponent(id)+'/upload?filename='+encodeURIComponent(file.name||'baby-photo.jpg'));
      xhr.setRequestHeader('X-Family-Token',window.FAMILY_API_TOKEN);xhr.setRequestHeader('Content-Type',file.type||'application/octet-stream');
      xhr.upload.onprogress=event=>{if(event.lengthComputable)onProgress(Math.round(event.loaded/event.total*100));};
      xhr.onload=()=>{let result;try{result=JSON.parse(xhr.responseText);}catch{reject(Error(tr('לא התקבל אישור שמירה. נסו שוב.','No save confirmation was received. Please try again.')));return;}if(xhr.status>=200&&xhr.status<300)resolve(result);else reject(Error(I.error(result.error)));};
      xhr.onerror=()=>reject(Error(tr('ההעלאה נקטעה. נסו שוב.','The upload was interrupted. Please try again.')));xhr.onabort=xhr.onerror;const payload=window.FamilyPhotoEditor?.upload?.(file)||{body:file};for(const [name,value]of Object.entries(payload.headers||{}))xhr.setRequestHeader(name,value);xhr.send(payload.body);
    });
  }
  async function addFiles(id,files){
    if(!member(id)||!app().apiEnabled)return;
    let selected=[...files].filter(file=>/^image\//i.test(file.type)||/\.(jpe?g|png|webp|gif|avif)$/i.test(file.name));
    if(!selected.length){app().toast(tr('בחרו תמונות מהגלריה או מהמצלמה.','Choose photos from your gallery or camera.'));return;}
    try{selected=await window.FamilyPhotoEditor.prepare(selected,{scope:'nursery:'+id,onUpload:async(file,progress)=>{const result=await uploadFile(id,file,progress);applyAlbum(id,result.collection,true);if(state.id===id)state.page=1;render();}});}catch{app().toast(tr('מסך עריכת התמונות לא נטען. רעננו את הדף ונסו שוב.','The photo editor could not open. Refresh the page and try again.'));return;}
    if(!selected?.length)return;
    errors.delete(id);queue.push({id,files:selected});runUploads();
  }
  async function runUploads(){
    if(state.running)return;state.running=true;
    while(queue.length){
      const {id,files}=queue.shift();let saved=0,failed=0;
      for(const [index,file]of files.entries()){
        state.uploading={id,percent:0};messages.set(id,tr('מעלה תמונה ','Uploading photo ')+(index+1)+tr(' מתוך ',' of ')+files.length+'…');render();
        try{
          if(file.size>50*1024*1024)throw Error(tr('אפשר להעלות תמונה עד 50MB.','Photos can be up to 50MB.'));
          const result=await uploadFile(id,file,percent=>{state.uploading={id,percent};if(state.id!==id||state.view!=='nursery')return;const progress=$('nurseryProgress');if(progress)progress.value=percent;const label=$('nurseryUploadStatus');if(label)label.textContent=messages.get(id)+' '+percent+'%';});
          saved++;applyAlbum(id,result.collection,true);if(state.id===id)state.page=1;
        }catch(error){failed++;errors.set(id,error.message);}
      }
      messages.set(id,saved?(I.isEnglish?`${saved} ${saved===1?'photo':'photos'} saved to ${name(id)}’s baby album ✓`:`${saved===1?'התמונה נוספה':saved+' תמונות נוספו'} לאלבום התינוקייה של ${name(id)} ✓`):tr('לא נשמרו תמונות. אפשר לנסות שוב.','No photos were saved. Please try again.'));
      if(!failed)errors.delete(id);app().toast(messages.get(id));
    }
    state.running=false;state.uploading=null;render();
  }
  function canDrop(){return state.view==='nursery'&&Boolean(state.id)&&!document.querySelector('dialog[open]');}
  function init(){
    state.ready=true;activate(app().getView());
    $('nurseryContent').addEventListener('click',event=>{
      const person=event.target.closest('[data-nursery-person]');if(person){event.preventDefault();navigate(person.dataset.nurseryPerson);return;}
      if(event.target.closest('[data-nursery-back]')){event.preventDefault();if(!window.FamilyNavigation?.returnTo('#nursery'))navigate(null);return;}
      if(event.target.closest('[data-nursery-upload]')){pick();return;}
      if(event.target.closest('[data-nursery-camera]')){pick(true);return;}
      if(event.target.closest('[data-nursery-retry]')){if(state.id)loadAlbum(state.id);else loadIndex();return;}
      const page=event.target.closest('[data-nursery-page]');if(page&&!page.disabled){state.page+=Number(page.dataset.nurseryPage);loadAlbum(state.id);}
    });
    for(const id of ['nurseryUploadInput','nurseryCameraInput'])$(id).addEventListener('change',event=>{addFiles(event.target.dataset.personId,event.target.files);event.target.value='';});
    $('nurseryContent').addEventListener('dragover',event=>{if(canDrop()&&event.dataTransfer?.types.includes('Files')){event.preventDefault();event.dataTransfer.dropEffect='copy';event.currentTarget.classList.add('nursery-drag-over');}});
    $('nurseryContent').addEventListener('dragleave',event=>{if(!event.currentTarget.contains(event.relatedTarget))event.currentTarget.classList.remove('nursery-drag-over');});
    $('nurseryContent').addEventListener('drop',event=>{event.currentTarget.classList.remove('nursery-drag-over');if(!canDrop()||!event.dataTransfer?.files.length)return;event.preventDefault();addFiles(state.id,event.dataTransfer.files);});
    document.addEventListener('paste',event=>{if(!canDrop()||event.target.closest('input,textarea,[contenteditable=true]'))return;const files=[...(event.clipboardData?.items||[])].filter(item=>item.kind==='file'&&item.type.startsWith('image/')).map(item=>item.getAsFile()).filter(Boolean);if(files.length){event.preventDefault();addFiles(state.id,files);}});
    window.addEventListener('family-people-loaded',render);window.addEventListener('family-person-changed',render);
    window.addEventListener('family-media-changed',event=>{
      if(event.detail.operation==='labels'&&event.detail.item){const item=event.detail.item;for(const [id,album]of albums)if(album.items.some(photo=>photo.id===item.id))applyAlbum(id,{...album,items:album.items.map(photo=>photo.id===item.id?{...photo,...item}:photo)},true);render();return;}
      const result=event.detail;if(!result.scope?.startsWith('nursery:'))return;const id=result.scope.slice(8);
      if(result.collection)applyAlbum(id,result.collection,true);
      if(state.view==='nursery'&&state.id===id){loadAlbum(id,state.page);}else render();
    });
    const route=()=>{if(location.hash==='#nursery'||location.hash.startsWith('#nursery/')){if(app().getView()==='nursery')activate('nursery');else app().setView('nursery',false);}};
    window.addEventListener('hashchange',route);window.addEventListener('popstate',route);
    document.addEventListener('visibilitychange',()=>{if(state.view==='nursery'&&document.visibilityState==='visible'&&!state.running){if(state.id)loadAlbum(state.id);else loadIndex();}});
    window.addEventListener('beforeunload',event=>{if(state.running){event.preventDefault();event.returnValue='';}});
  }
  window.FamilyNursery={activate,search(query){state.query=query;render();},members};document.addEventListener('DOMContentLoaded',init);
})();
