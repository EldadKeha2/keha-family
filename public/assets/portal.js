(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const app = () => window.FamilyApp;
  const notify = message => app()?.toast(message);
  const normalize = value => String(value).normalize('NFKD').replace(/[\u0591-\u05c7'"׳״]/g, '').toLowerCase().trim();
  const state = {view:'tree', query:'', videoCategory:'all', collections:{photos:{items:[]},videos:{items:[]}}, stories:[], storyRevision:null, editingStory:null, birthdayId:null};
  const revisions = {}, signatures = {}, loading = {}, queues = {photos:[], videos:[]}, running = {}, drafts = new Map();
  let ready = false;
  function canSave() {if (app()?.apiEnabled) return true;notify('כדי לשמור שינויים, פתחו את האתר באמצעות קובץ ההפעלה.');return false;}
  async function request(path, options={}) {
    const response = await fetch(path, {cache:'no-store', ...options, headers:{...(options.body ? {'X-Family-Token':window.FAMILY_API_TOKEN} : {}), ...options.headers}});
    if (response.status === 304) return null;
    let result;
    try {result = await response.json();} catch {console.error('Family API response',path,response.status,response.url,response.headers.get('Content-Type'));throw Error('לא התקבלה תשובה מהשרת. בדקו את החיבור ונסו שוב.');}
    if (!response.ok) throw Error(result.error || 'השינוי לא נשמר.');
    return result;
  }
  const jsonPost = (path, body) => request(path, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)});
  function activate(view) {
    state.view = view;
    state.query = '';
    for (const kind of ['photos','videos','stories']) {
      $(kind + 'View').hidden = view !== kind;
    }
    if (!ready) return;
    if (view === 'photos' || view === 'videos') {renderCollection(view);refreshCollection(view,true);}
    if (view === 'stories') {renderStories();refreshStories(true);}
    if (view !== 'videos') $('videosGrid').querySelectorAll('video').forEach(video=>video.pause());
    flushCaptions();
  }
  function search(query) {
    state.query = query;
    if (['photos','videos'].includes(state.view)) renderCollection(state.view);
    else if (state.view === 'stories') renderStories();
  }
  function captionKey(kind, file) {return kind + '\u001f' + file;}
  function captionStatus(kind,file,message,failed=false) {
    const area = [...$(kind+'Grid').querySelectorAll('textarea')].find(area=>area.dataset.sharedFile===file);
    if (!area) return;
    const status = area.closest('.shared-media-card').querySelector('[data-shared-status]');
    status.textContent = message;status.classList.toggle('save-error',failed);
  }
  function renderCollection(kind) {
    const collection = state.collections[kind], query = normalize(state.query);
    const filtered = collection.items.filter(item => (kind!=='videos'||state.videoCategory==='all'||(item.videoCategory||'family')===state.videoCategory)&&(!query || normalize(item.caption+' '+item.name+' '+(item.tags||[]).map(person=>person.name).join(' ')).includes(query)));
    const isVideo = kind === 'videos';
    window.FamilyMedia.register(kind,filtered);
    if(isVideo)$('videoCategories').querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.videoCategory===state.videoCategory)));
    $(kind+'Count').textContent = collection.items.length ? `${filtered.length}${filtered.length!==collection.items.length?' מתוך '+collection.items.length:''} ${isVideo?'סרטונים':'תמונות'} באלבום המשותף` : isVideo?'רגעים ששווה לראות שוב':'אלבום משותף לכל המשפחה';
    $(kind+'Empty').hidden = collection.items.length > 0;
    const signature = filtered.map(item=>item.file+'|'+item.src).join('\u0000');
    if (signatures[kind] !== signature) {
      const active = document.activeElement, focusedFile = active?.dataset?.sharedFile;
      const selection = focusedFile ? [active.selectionStart,active.selectionEnd] : null;
      const grid = $(kind+'Grid');
      // Reuse existing cards so a new upload never interrupts a playing video.
      const previous = new Map([...grid.querySelectorAll('.shared-media-card')].map(card=>[card.dataset.mediaFile,card]));
      const cards = [];
      for (const [index,item] of filtered.entries()) {
        let card = previous.get(item.file);
        if (card && card.dataset.mediaSrc !== item.src) card = null;
        if (!card) {
          card = document.createElement('article');card.className='shared-media-card';card.dataset.mediaFile=item.file;card.dataset.mediaSrc=item.src;
          const draft = drafts.get(captionKey(kind,item.file));
          const caption = draft?.dirty ? draft.value : item.caption;
          const viewer = item.provider==='youtube'
            ? `<button class="youtube-poster" data-media-open="${safe(item.id)}" data-media-scope="videos" aria-label="ניגון ${safe(item.name)} בגלריה"><img src="${safe(item.poster)}" alt="${safe(item.name)}" loading="lazy"><span class="youtube-play" aria-hidden="true"><span>▶</span></span><span class="youtube-poster-title" aria-hidden="true" hidden>${safe(item.name)}</span></button><div class="youtube-card-heading"><h3>${safe(item.name)}</h3><a href="${safe(item.watchUrl)}" target="_blank" rel="noopener">YouTube ↗</a></div><p class="video-category-label">ימי הולדת מיוחדים</p>`
            : isVideo
              ? `<div class="video-frame"><video controls playsinline preload="metadata" aria-label="${safe(item.caption||item.name)}"><source src="${safe(item.src)}" type="${safe(item.mime)}">הדפדפן אינו תומך בניגון הסרטון.</video></div><div class="video-file-info"><span>${safe(item.name)}</span><a href="${safe(item.src)}" download>הורדת המקור ↗</a></div><p class="video-codec-note" hidden>הפורמט הזה לא מתנגן בדפדפן הנוכחי. אפשר להוריד את המקור או להעלות גרסת MP4 בתקן H.264.</p>`
              : `<button class="gallery-image" data-media-open="${safe(item.id||item.file)}" data-media-scope="${kind}" aria-label="פתיחת התמונה ${safe(item.name)}"><img src="${safe(item.src)}" alt="${safe(caption||item.name)}" loading="lazy"></button>`;
          const id = `shared-caption-${kind}-${encodeURIComponent(item.file)}`;
          card.innerHTML = viewer + window.FamilyMedia.controls(item,kind) + `<div class="caption-editor"><label for="${safe(id)}">${isVideo?'מה רואים בסרטון?':'מי בתמונה? איפה ומתי?'}</label><textarea id="${safe(id)}" data-shared-kind="${kind}" data-shared-file="${safe(item.file)}" rows="2" maxlength="5000" placeholder="כתבו כאן את הסיפור של הרגע הזה…" ${app()?.apiEnabled?'':'disabled'}>${safe(caption)}</textarea><div class="caption-toolbar"><span data-shared-status role="status">${draft?.dirty?'ממתין לשמירה…':''}</span><button data-save-shared="${safe(item.file)}" data-shared-kind="${kind}">שמירה</button></div></div>`;
          card.querySelector('video')?.addEventListener('error',()=>{card.querySelector('.video-codec-note').hidden=false;},true);
          if(item.provider==='youtube'){
            const img=card.querySelector('.youtube-poster img');
            const fallback=()=>{img.hidden=true;card.querySelector('.youtube-poster').classList.add('is-fallback');card.querySelector('.youtube-poster-title').hidden=false;};
            img.addEventListener('error',fallback,{once:true});if(img.complete&&!img.naturalWidth)fallback();
          }
        }
        card.style.setProperty('--card-index',Math.min(index,8));cards.push(card);
      }
      const wanted=new Set(cards);for(const child of [...grid.children])if(!wanted.has(child))child.remove();
      let anchor=grid.firstElementChild;
      for(const card of cards){if(card===anchor)anchor=anchor.nextElementSibling;else grid.insertBefore(card,anchor);}
      signatures[kind] = signature;
      if (focusedFile) {
        const area=[...grid.querySelectorAll('textarea')].find(area=>area.dataset.sharedFile===focusedFile);
        if(area){area.focus({preventScroll:true});area.setSelectionRange(...selection);}
      }
      if (!filtered.length && collection.items.length) grid.innerHTML='<p class="no-content-match">אין סרטונים או תמונות בבחירה הזו. אפשר לשנות את הקטגוריה או את החיפוש.</p>';
    }
    window.FamilyTags.refresh($(kind+'Grid'),filtered);
    for(const area of $(kind+'Grid').querySelectorAll('textarea')) {
      const draft=drafts.get(captionKey(kind,area.dataset.sharedFile));
      if(draft?.dirty || area===document.activeElement)continue;
      const item=collection.items.find(item=>item.file===area.dataset.sharedFile);
      if(item && area.value!==item.caption)area.value=item.caption;
    }
  }
  async function refreshCollection(kind,force=false) {
    if (!app()?.apiEnabled || loading[kind]) return;
    loading[kind] = true;
    try {
      const result = await request('api/collections/'+kind,{headers:!force&&revisions[kind]?{'If-None-Match':'"'+revisions[kind]+'"'}:{}});
      if (!result) return;
      state.collections[kind]=result;revisions[kind]=result.revision;
      if(state.view===kind)renderCollection(kind);
    }catch(error){if(force)notify(error.message);}finally{loading[kind]=false;}
  }
  function editCaption(area) {
    const kind=area.dataset.sharedKind,file=area.dataset.sharedFile,key=captionKey(kind,file);
    const draft=drafts.get(key)||{kind,file,saving:false};
    clearTimeout(draft.timer);draft.value=area.value;draft.dirty=true;
    draft.timer=setTimeout(()=>saveCaption(key),800);drafts.set(key,draft);
    captionStatus(kind,file,'ממתין לשמירה…');
  }
  async function saveCaption(key) {
    const draft=drafts.get(key);
    if(!draft?.dirty || draft.saving || !app()?.apiEnabled)return;
    clearTimeout(draft.timer);draft.saving=true;const text=draft.value;
    captionStatus(draft.kind,draft.file,'שומר…');
    try {
      await request('api/collections/'+draft.kind+'/caption',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({file:draft.file,caption:text}),keepalive:true});
      const item=state.collections[draft.kind].items.find(item=>item.file===draft.file);if(item)item.caption=text;
      if(draft.value===text){draft.dirty=false;captionStatus(draft.kind,draft.file,'נשמר ✓');}
      else draft.timer=setTimeout(()=>saveCaption(key),100);
    }catch(error){captionStatus(draft.kind,draft.file,'לא נשמר · נסו שוב',true);notify(error.message);}finally{draft.saving=false;}
  }
  function flushCaptions(){for(const[key,draft]of drafts)if(draft.dirty)saveCaption(key);}
  function addFiles(kind,files,clipboard=false) {
    if(!canSave())return;
    const candidates=[...files], selected=candidates.filter(file=>kind==='videos'?/^video\//i.test(file.type)||/\.(mp4|webm|mov|m4v)$/i.test(file.name):/^image\//i.test(file.type)||/\.(jpe?g|png|webp|gif|avif)$/i.test(file.name));
    if(!selected.length){notify(kind==='videos'?'בחרו סרטון MP4, WebM, MOV או M4V.':'בחרו תמונות מהגלריה או מהמצלמה.');return;}
    if(selected.length<candidates.length)notify('חלק מהקבצים לא התאימו לגלריה הזו. שאר הקבצים יועלו.');
    const group=kind==='videos'?$('videoUploadCategory').value:'family';
    queues[kind].push(...selected.map(file=>({file,clipboard,group})));runUploads(kind);
  }
  function uploadFile(kind,file,name,onProgress,group) {
    return new Promise((resolve,reject)=>{
      const xhr=new XMLHttpRequest();xhr.open('POST','api/collections/'+kind+'/upload?filename='+encodeURIComponent(name)+(kind==='videos'?'&group='+encodeURIComponent(group):''));
      xhr.setRequestHeader('X-Family-Token',window.FAMILY_API_TOKEN);xhr.setRequestHeader('Content-Type',file.type||'application/octet-stream');
      xhr.upload.onprogress=event=>{if(event.lengthComputable)onProgress(Math.round(event.loaded/event.total*100));};
      xhr.onload=()=>{let result;try{result=JSON.parse(xhr.responseText);}catch{reject(Error('החיבור הסתיים בלי אישור שמירה. נסו לרענן.'));return;}if(xhr.status>=200&&xhr.status<300)resolve(result);else reject(Error(result.error||'הקובץ לא נשמר.'));};
      xhr.onerror=()=>reject(Error('ההעלאה נקטעה. בדקו את החיבור ונסו שוב.'));
      xhr.onabort=()=>reject(Error('ההעלאה בוטלה.'));xhr.send(file);
    });
  }
  async function runUploads(kind) {
    if(running[kind])return;running[kind]=true;let saved=0;
    const status=$(kind+'UploadState'),progress=$(kind+'Progress'),zone=$(kind+'Dropzone');
    zone.classList.add('uploading');
    while(queues[kind].length){
      const{file,clipboard,group}=queues[kind].shift();
      try{
        if(file.size>(kind==='videos'?90*1024*1024:50*1024*1024))throw Error(kind==='videos'?'הסרטון גדול מ־90MB.':'התמונה גדולה מ־50MB.');
        const filename=clipboard?'צילום_מסך_'+new Date().toISOString().replace(/[:.]/g,'-')+'.png':file.name;
        progress.hidden=false;progress.value=0;status.textContent='מעלה '+filename+'…';
        const result=await uploadFile(kind,file,filename,percent=>{progress.value=percent;status.textContent=percent===100?'ההעלאה הסתיימה, שומר את הקובץ…':`מעלה ${filename} · ${percent}%`;},group);
        saved++;state.collections[kind]=result.collection;revisions[kind]=result.collection.revision;
        if(state.view===kind)renderCollection(kind);
      }catch(error){notify(file.name+': '+error.message);}
    }
    status.textContent=saved?`${saved} ${kind==='videos'?'סרטונים':'תמונות'} נשמרו ✓`:'לא נשמרו קבצים. אפשר לנסות שוב.';
    progress.hidden=true;zone.classList.remove('uploading');running[kind]=false;
  }
  function allowSharedInput(){return ['photos','videos'].includes(state.view)&&!document.querySelector('dialog[open]');}
  function acceptDrop(event){if(!allowSharedInput())return false;$(state.view+'Dropzone').classList.remove('drag-over');addFiles(state.view,event.dataTransfer.files);return true;}
  function dragOver(){if(allowSharedInput())$(state.view+'Dropzone').classList.add('drag-over');}
  function acceptPaste(event){
    if(state.view!=='photos'||!allowSharedInput())return;
    const files=[...(event.clipboardData?.items||[])].filter(item=>item.kind==='file'&&item.type.startsWith('image/')).map(item=>item.getAsFile()).filter(Boolean);
    if(files.length){event.preventDefault();addFiles('photos',files,true);}
  }
  function openBirthday(id) {
    if(!canSave())return;state.birthdayId=id;
    const value=app().birthdayOf(id),parts=window.FamilyDates.parse(value),known=parts&&parts.year!==1111;
    state.birthdayExpected=value;
    $('birthdayPersonName').textContent=app().nameOf(id);
    $('birthDay').value=known?parts.day:'';$('birthMonth').value=known?parts.month:'';$('birthYear').value=known?parts.year:'';
    $('birthdayError').textContent='';$('birthdayPreview').textContent='';$('birthdayDialog').showModal();
  }
  function birthdayValue(){return `${$('birthDay').value}.${$('birthMonth').value}.${$('birthYear').value}`;}
  function previewBirthday(){const age=window.FamilyDates.age(birthdayValue());$('birthdayPreview').textContent=age===null?'':`הגיל שיופיע בכרטיס: (${age})`;}
  async function saveBirthday(event,clear=false){
    event.preventDefault();const button=$('saveBirthday');button.disabled=true;$('birthdayError').textContent='';
    try{const result=await jsonPost('api/people/'+encodeURIComponent(state.birthdayId)+'/birthday',{birthday:clear?'':birthdayValue(),expectedBirthday:state.birthdayExpected});app().updatePerson(state.birthdayId,result.person);$('birthdayDialog').close();notify('יום ההולדת עודכן ✓');}
    catch(error){$('birthdayError').textContent=error.message;}finally{button.disabled=false;}
  }
  async function refreshStories(force=false){
    if(!app()?.apiEnabled||loading.stories)return;loading.stories=true;
    try{const result=await request('api/stories',{headers:!force&&state.storyRevision?{'If-None-Match':'"'+state.storyRevision+'"'}:{}});if(result){state.stories=result.stories;state.storyRevision=result.revision;renderStories();}}
    catch(error){if(force)notify(error.message);}finally{loading.stories=false;}
  }
  function renderStories(){
    const yearFilter=$('storyYearFilter'),previousYear=yearFilter.value;
    const years=[...new Set(state.stories.map(story=>story.year))].sort((a,b)=>a-b);
    yearFilter.innerHTML='<option value="all">כל השנים</option>'+years.map(year=>`<option value="${year}">${year}</option>`).join('');
    if(years.includes(Number(previousYear)))yearFilter.value=previousYear;
    const query=normalize(state.query),year=yearFilter.value,descending=$('storySort').value==='newest';
    const stories=state.stories.filter(story=>(year==='all'||story.year===Number(year))&&(!query||normalize(story.title+' '+story.body+' '+story.author+' '+story.year).includes(query))).sort((a,b)=>(a.year-b.year||a.createdAt.localeCompare(b.createdAt))*(descending?-1:1));
    $('storiesCount').textContent=state.stories.length?(stories.length===1?'סיפור אחד ביומן':`${stories.length} סיפורים ביומן`):'';
    $('storiesEmpty').hidden=state.stories.length>0;
    const groups=new Map();for(const story of stories){if(!groups.has(story.year))groups.set(story.year,[]);groups.get(story.year).push(story);}
    $('storyTimeline').innerHTML=[...groups].map(([year,entries])=>`<section class="timeline-year"><h4><bdi>${year}</bdi><span class="year-diamond" aria-hidden="true">◆</span></h4><div class="year-stories">${entries.map(story=>`<article class="story-card"><span class="story-overline">${safe(story.author||'מהיומן המשפחתי')}</span><h3><button data-open-story="${story.id}">${safe(story.title)}</button></h3><p>${safe(story.body.slice(0,230))}${story.body.length>230?'…':''}</p><div class="story-card-footer"><button class="read-story" data-open-story="${story.id}">לסיפור המלא ←</button>${story.attachments.length?`<span>${story.attachments.length} מסמכים מצורפים</span>`:''}<button class="edit-story" data-edit-story="${story.id}" aria-label="עריכת הסיפור ${safe(story.title)}">✎ עריכה</button></div></article>`).join('')}</div></section>`).join('');
    if(!stories.length&&state.stories.length)$('storyTimeline').innerHTML='<p class="no-content-match">לא נמצאו סיפורים בבחירה הזו.</p>';
  }
  const attachmentHTML=attachments=>attachments.map(file=>`<a href="${safe(file.src)}" target="_blank" rel="noopener" download="${safe(file.name)}">▤ ${safe(file.name)} <span>↓</span></a>`).join('');
  function openStory(id){
    const story=state.stories.find(item=>item.id===id);if(!story)return;
    $('storyReaderBody').innerHTML=`<span class="story-reader-year"><bdi>${story.year}</bdi></span><h2 id="storyReaderTitle">${safe(story.title)}</h2>${story.author?`<p class="story-reader-author">סיפור מאת ${safe(story.author)}</p>`:''}<div class="story-full-text">${safe(story.body)}</div>${story.attachments.length?`<div class="attachment-list"><h3>המסמכים שמלווים את הסיפור</h3>${attachmentHTML(story.attachments)}</div>`:''}<button class="secondary-button" data-edit-story="${story.id}">✎ עריכת הסיפור</button>`;
    $('storyReader').showModal();
  }
  function editStory(id=null){
    if(!canSave())return;const story=id?state.stories.find(item=>item.id===id):null;if(id&&!story)return;
    if($('storyReader').open)$('storyReader').close();state.editingStory=id;$('storyForm').reset();
    state.editingStoryUpdatedAt=story?.updatedAt||null;
    $('storyEditorTitle').textContent=story?'עורכים סיפור משפחתי':'מוסיפים סיפור משלנו';
    $('storyYear').value=story?.year||'';$('storyTitle').value=story?.title||'';$('storyAuthor').value=story?.author||'';$('storyBody').value=story?.body||'';
    $('existingStoryFiles').innerHTML=story?.attachments.length?'<span>מסמכים שכבר צורפו לסיפור:</span>'+attachmentHTML(story.attachments):'';
    $('storyError').textContent='';$('storyEditor').showModal();
  }
  async function saveStory(event){
    event.preventDefault();const button=$('saveStory'),files=[...$('storyFiles').files];
    $('storyError').textContent='';
    if(files.length>10||files.some(file=>file.size>10*1024*1024)||files.reduce((sum,file)=>sum+file.size,0)>20*1024*1024){$('storyError').textContent='אפשר לצרף עד 10 קבצים, עד 10MB לקובץ ועד 20MB יחד.';return;}
    button.disabled=true;button.textContent='שומר את הסיפור…';
    try{const form=new FormData($('storyForm'));if(state.editingStory)form.set('expectedUpdatedAt',state.editingStoryUpdatedAt);await request('api/stories'+(state.editingStory?'/'+state.editingStory:''),{method:'POST',body:form});$('storyEditor').close();$('storyYearFilter').value='all';state.query='';$('searchInput').value='';await refreshStories(true);notify('עוד זיכרון נשמר ביומן המשפחתי ✓');}
    catch(error){$('storyError').textContent=error.message;}finally{button.disabled=false;button.textContent='שמירת הסיפור';}
  }
  function init(){
    ready=true;
    document.addEventListener('click',event=>{
      const close=event.target.closest('[data-close-dialog]');if(close){$(close.dataset.closeDialog).close();return;}
      const birthday=event.target.closest('[data-edit-birthday]');if(birthday){openBirthday(birthday.dataset.editBirthday);return;}
      const upload=event.target.closest('[data-upload-collection]');if(upload){if(!canSave())return;const input=$(upload.dataset.uploadCollection==='videos'?'sharedVideosInput':'sharedPhotosInput');input.value='';input.click();return;}
      const camera=event.target.closest('[data-camera-collection]');if(camera){if(!canSave())return;const input=$(camera.dataset.cameraCollection==='videos'?'sharedVideosCamera':'sharedPhotosCamera');input.value='';input.click();return;}
      const save=event.target.closest('[data-save-shared]');if(save){saveCaption(captionKey(save.dataset.sharedKind,save.dataset.saveShared));return;}
      const category=event.target.closest('[data-video-category]');if(category){state.videoCategory=category.dataset.videoCategory;if(state.videoCategory!=='all')$('videoUploadCategory').value=state.videoCategory;renderCollection('videos');return;}
      const photo=event.target.closest('[data-shared-open]');if(photo){const items=state.collections.photos.items;app().openSharedGallery(items,items.findIndex(item=>item.file===photo.dataset.sharedOpen));return;}
      const read=event.target.closest('[data-open-story]');if(read){openStory(read.dataset.openStory);return;}
      const edit=event.target.closest('[data-edit-story]');if(edit){editStory(edit.dataset.editStory);return;}
      if(event.target.closest('#newStory,[data-new-story]'))editStory();
    });
    document.addEventListener('input',event=>{if(event.target.matches('textarea[data-shared-file]'))editCaption(event.target);if(event.target.closest('#birthdayForm'))previewBirthday();});
    document.addEventListener('focusout',event=>{if(event.target.matches('textarea[data-shared-file]'))saveCaption(captionKey(event.target.dataset.sharedKind,event.target.dataset.sharedFile));});
    for(const[kind,ids]of Object.entries({photos:['sharedPhotosInput','sharedPhotosCamera'],videos:['sharedVideosInput','sharedVideosCamera']}))for(const id of ids)$(id).addEventListener('change',()=>{if($(id).files.length)addFiles(kind,$(id).files);});
    for(const kind of ['photos','videos'])$(kind+'Dropzone').addEventListener('dragleave',event=>{if(!event.relatedTarget||!$(kind+'Dropzone').contains(event.relatedTarget))$(kind+'Dropzone').classList.remove('drag-over');});
    $('birthdayForm').addEventListener('submit',saveBirthday);$('storyForm').addEventListener('submit',saveStory);
    $('clearBirthday').addEventListener('click',event=>saveBirthday(event,true));
    window.addEventListener('family-media-changed',event=>{
      const result=event.detail,kind=result.scope;if(!['photos','videos'].includes(kind)||!result.collection)return;
      if(result.operation==='delete'){const key=captionKey(kind,result.item.file);clearTimeout(drafts.get(key)?.timer);drafts.delete(key);}
      state.collections[kind]=result.collection;revisions[kind]=result.collection.revision;
      if(state.view===kind)renderCollection(kind);else window.FamilyMedia.register(kind,result.collection.items);
    });
    $('storyYearFilter').addEventListener('change',renderStories);$('storySort').addEventListener('change',renderStories);
    for(const id of ['birthdayDialog','storyEditor','storyReader'])$(id).addEventListener('click',event=>{if(event.target!==$(id))return;const rect=$(id).getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)$(id).close();});
    // Returning from the phone's gallery/camera refreshes the current shared view.
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){if(['photos','videos'].includes(state.view))refreshCollection(state.view);if(state.view==='stories')refreshStories();}});
    setInterval(()=>{if(document.visibilityState==='hidden')return;if(['photos','videos'].includes(state.view))refreshCollection(state.view);if(state.view==='stories')refreshStories();},30000);
    window.addEventListener('pagehide',flushCaptions);
    window.addEventListener('beforeunload',event=>{const dirtyStory=$('storyEditor').open&&([...$('storyForm').querySelectorAll('input:not([type=file]),textarea')].some(field=>field.value)||$('storyFiles').files.length);if(running.photos||running.videos||dirtyStory){event.preventDefault();event.returnValue='';}});
    activate(state.view);
  }
  window.FamilyPortal={activate,search,acceptDrop,acceptPaste,dragOver};
  document.addEventListener('DOMContentLoaded',init);
})();
