(() => {
  'use strict';
  const I18n=window.FamilyI18n;
  const $=id=>document.getElementById(id),app=()=>window.FamilyApp;
  const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normalize=value=>String(value??'').normalize('NFKD').replace(/[\u0591-\u05c7'"׳״]/g,'').toLowerCase().trim();
  const family=window.FAMILY_DATA;
  const couples=Object.values(family.units).filter(unit=>unit.people.length===2).sort((a,b)=>a.generation-b.generation);
  const pairById=new Map(couples.map(pair=>[pair.id,pair]));
  const summaries=new Map(),details=new Map(),collections=new Map(),photoEditVersions=new Map(),loading=new Map(),filters=new Map(),drafts=new Map(),greetingDrafts=new Map(),greetingPending=new Set(),uploadStates=new Map();
  const jobs=[];
  const state={view:'tree',weddingId:null,query:'',ready:false,uploading:false,weddingsLoaded:false,editingDate:null};
  const pencil='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15Z"/></svg>';
  const captureCalendar='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18M8 15h2m4 0h2"/></svg>';
  const captureDate=item=>window.FamilyPhotoDate?.text?.(item.takenDate)||[item.takenDate?.day,item.takenDate?.month,item.takenDate?.year].filter(Boolean).join('.');
  const captureLabel=item=>captureDate(item)||(I18n.isEnglish?'Recording date not set':'תאריך צילום טרם צוין');
  const name=id=>app()?.nameOf(id)||family.people[id].name;
  const branchTitle=pair=>I18n.branchName(family.branches.find(branch=>branch.id===pair.branch))||I18n.t('השורשים של כולנו');
  const pairTitle=pair=>pair.people.map(id=>name(id)+(family.people[id].deceased?I18n.t(' ז״ל'):'')).join(I18n.t(' ו'));
  const scope=()=>state.view==='nostalgia'?'nostalgia':state.view==='weddings'&&state.weddingId?'wedding:'+state.weddingId:null;
  const base=key=>key==='nostalgia'?'api/nostalgia':'api/weddings/'+encodeURIComponent(key.slice(8));
  const prefix=key=>key==='nostalgia'?'nostalgia':'wedding';
  const gridId=key=>key==='nostalgia'?'nostalgiaGrid':'weddingMediaGrid';
  const draftKey=(key,file)=>key+'\u001f'+file;
  const toast=message=>app()?.toast(message);
  const canSave=()=>{if(app()?.apiEnabled)return true;toast(I18n.t('השמירה אינה זמינה כרגע. נסו לרענן את הדף.'));return false;};
  async function request(path,options={}){
    const response=await I18n.fetch(path,{cache:'no-store',...options,headers:{...(options.body?{'X-Family-Token':window.FAMILY_API_TOKEN}:{}),...options.headers}});
    if(response.status===304)return null;
    let result;try{result=await response.json();}catch{throw Error(I18n.t('לא התקבלה תשובה מהשרת. נסו לרענן את הדף.'));}
    if(!response.ok)throw Object.assign(Error(I18n.error(result.error)||I18n.t('לא ניתן לשמור את השינוי.')),{status:response.status,code:result.code});return result;
  }
  const post=(path,body)=>request(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  function setStatus(id,message='',failed=false){$(id).textContent=message;$(id).classList.toggle('failed',failed);}
  function urlFor(view,id){return view==='weddings'?'#weddings'+(id?'/'+encodeURIComponent(id):''):view==='nostalgia'?'#nostalgia':'';}
  function route(){
    const [view,rawId]=location.hash.slice(1).split('/');
    if(view==='weddings'){
      let id;try{id=rawId?decodeURIComponent(rawId):null;}catch{id=null;}
      state.weddingId=pairById.has(id)?id:null;state.query='';$('searchInput').value='';app().setView('weddings',false);
      if(rawId&&!state.weddingId)toast(I18n.t('הזוג לא נמצא. אפשר לבחור זוג מרשימת החתונות.'));
    }else if(view==='nostalgia'){app().setView('nostalgia',false);}
    else if(!view&&(state.view==='weddings'||state.view==='nostalgia'))app().setView(matchMedia('(max-width:700px)').matches?'home':'tree',false);
  }
  function openWedding(id){
    if(id&&!pairById.has(id))return;
    state.weddingId=id;state.query='';$('searchInput').value='';
    const hash=urlFor('weddings',id);if(window.FamilyNavigation)window.FamilyNavigation.go(hash);else if(location.hash!==hash)history.pushState(null,'',hash);
    app().setView('weddings',false);$('weddingsView').scrollIntoView({block:'start',behavior:'instant'});
  }
  function yearsText(record){
    if(/^\d{4}$/.test(record?.date||''))return I18n.isEnglish?'Only the year is known':'ידועה רק השנה';
    const years=window.FamilyDates.age(record?.date);if(years===null)return '';
    const pair=pairById.get(record.id),historic=pair?.people.some(id=>family.people[id].deceased);
    if(historic)return years===0?I18n.t('פחות משנה מאז החתונה'):I18n.html`${years} שנים מאז החתונה`;
    return years===0?I18n.t('נשואים פחות משנה'):years===1?I18n.t('נשואים שנה אחת'):I18n.html`נשואים ${years} שנים`;
  }
  const weddingProfile=id=>app()?.getPersonSummary?.(id)?.profile||'';
  function weddingPortrait(pair,record){
    const picture=record?.cover?`<img class="wedding-card-cover" src="${safe(record.cover)}" alt="${safe(pairTitle(pair))}" loading="lazy" decoding="async">`:`<span class="wedding-portraits" aria-hidden="true">${pair.people.map(id=>{const src=weddingProfile(id);return `<span class="wedding-person-initial">${safe(name(id).split(/\s+/).filter(Boolean).map(part=>part[0]).slice(0,2).join(''))}${src?`<img class="wedding-person-photo" src="${safe(src)}" alt="" loading="lazy" decoding="async">`:''}</span>`;}).join('')}</span>`;
    return `<span class="wedding-card-art${record?.cover?' has-wedding-photo':''}"><span class="wedding-card-picture">${picture}</span><span class="wedding-card-flourish" aria-hidden="true"></span></span>`;
  }
  function renderWeddings(){
    const query=normalize(state.query),selectedBranch=$('weddingBranchFilter').value;
    const selected=couples.filter(pair=>(selectedBranch==='all'||(pair.branch||'root')===selectedBranch)&&(!query||normalize(pairTitle(pair)+' '+branchTitle(pair)+' '+(summaries.get(pair.id)?.date||'')).includes(query)));
    $('weddingsCount').textContent=I18n.html`${selected.length}${selected.length!==couples.length?I18n.t(' מתוך ')+couples.length:''} ${I18n.isEnglish?I18n.word(selected.length,'couple in the wedding collection','couples in the wedding collection'):I18n.t('זוגות באלבום החתונות')}`;
    const signature=JSON.stringify(selected.map(pair=>{const item=summaries.get(pair.id);return [pair.id,item?.date,item?.revision,item?.cover,item?.mediaCount,item?.greetingCount,...pair.people.map(weddingProfile)];}));
    if($('weddingGrid').dataset.signature===signature)return;
    $('weddingGrid').dataset.signature=signature;
    $('weddingGrid').innerHTML=selected.map(pair=>{
      const record=summaries.get(pair.id),date=record?.date;
      return I18n.html`<article class="wedding-card"><button class="wedding-card-open" data-open-wedding="${pair.id}" aria-label="עמוד החתונה של ${safe(pairTitle(pair))}">${weddingPortrait(pair,record)}<h4><span>${safe(name(pair.people[0]))}${family.people[pair.people[0]].deceased?I18n.t(' ז״ל'):''}</span><em>ו</em><span>${safe(name(pair.people[1]))}${family.people[pair.people[1]].deceased?I18n.t(' ז״ל'):''}</span></h4><span class="wedding-card-branch">${safe(branchTitle(pair))}</span></button><div class="wedding-card-date"><div>${date?`<bdi>${safe(I18n.date(date))}</bdi><small>${safe(yearsText(record))}</small>`:I18n.t('<span class="wedding-date-unknown">יום הנישואים טרם הוזן</span>')}</div><button class="birthday-edit" data-edit-wedding-date="${pair.id}" aria-label="עריכת יום הנישואים של ${safe(pairTitle(pair))}" title="עדכון יום הנישואים" ${record?'':'disabled'}>${pencil}</button></div><div class="wedding-card-footer"><span>${record?.mediaCount||0} ${I18n.isEnglish?I18n.word(record?.mediaCount||0,'memory','memories'):I18n.t('זיכרונות')} · ${record?.greetingCount||0} ${I18n.isEnglish?I18n.word(record?.greetingCount||0,'greeting','greetings'):I18n.t('ברכות')}</span><button data-open-wedding="${pair.id}">${I18n.isEnglish?'Open album':'לאלבום'} <span aria-hidden="true">↗</span></button></div></article>`;
    }).join('')||I18n.t('<p class="no-content-match">לא נמצאו זוגות בבחירה הזו. נסו שם אחר או ענף אחר.</p>');
  }
  async function refreshWeddings(){
    if(loading.get('weddings'))return;loading.set('weddings',true);
    if(!state.weddingsLoaded)setStatus('weddingsStatus',I18n.t('טוען את ימי הנישואים והאלבומים…'));
    try{
      const result=await request('api/weddings');for(const record of result.weddings)summaries.set(record.id,record);
      state.weddingsLoaded=true;setStatus('weddingsStatus');if(state.view==='weddings'&&!state.weddingId)renderWeddings();
    }catch(error){setStatus('weddingsStatus',error.message,true);}finally{loading.set('weddings',false);}
  }
  function renderWedding(id){
    if(state.view!=='weddings'||state.weddingId!==id)return;
    const pair=pairById.get(id),record=details.get(id)||summaries.get(id),changed=$('weddingDetail').dataset.couple!==id;
    $('weddingDetail').dataset.couple=id;
    $('weddingNames').textContent=pairTitle(pair);$('weddingBranch').textContent=branchTitle(pair);
    $('weddingDateLabel').textContent=record?.date?(/^\d{4}$/.test(record.date)?(I18n.isEnglish?'Wedding year · ':'שנת הנישואים · '):I18n.t('יום הנישואים · '))+I18n.date(record.date):I18n.t('יום הנישואים עוד לא הוזן');
    $('weddingYears').textContent=yearsText(record);$('editWeddingDate').disabled=!record;
    if(changed){const draft=greetingDrafts.get(id);$('greetingAuthor').value=draft?.author||'';$('greetingBody').value=draft?.body||'';$('greetingError').textContent='';}
    $('saveWeddingGreeting').disabled=greetingPending.has(id);
    const greetings=details.get(id)?.greetings||[];$('weddingGreetingsCount').textContent=I18n.html`${greetings.length} ${I18n.isEnglish?I18n.word(greetings.length,'memory or greeting','memories and greetings'):I18n.t('זיכרונות וברכות')}`;
    $('weddingGreetingList').innerHTML=greetings.map(item=>`<article class="greeting-card"><p dir="auto">${safe(item.body)}</p><footer><strong dir="auto">${safe(item.author)}</strong><time datetime="${safe(item.createdAt)}">${safe(new Date(item.createdAt).toLocaleDateString(I18n.locale))}</time></footer></article>`).join('')||I18n.t('<div class="archive-empty"><h4>הזיכרון הראשון עוד לפנינו</h4><p>שתפו משהו שאתם זוכרים מהחתונה. זיכרון קצר או ברכה יישארו כאן לצד האלבום.</p></div>');
    renderCollection('wedding:'+id);
  }
  async function refreshWedding(id){
    const key='wedding:'+id;if(loading.get(key))return;loading.set(key,true);
    const photoEditVersion=photoEditVersions.get(key);
    if(!details.has(id))setStatus('weddingsStatus',I18n.t('טוען את עמוד החתונה…'));
    try{
      const result=await request(base(key));if(photoEditVersions.get(key)!==photoEditVersion)return;details.set(id,result);summaries.set(id,result);collections.set(key,result.collection);
      if(state.weddingId===id){setStatus('weddingsStatus');renderWedding(id);}
    }catch(error){if(state.weddingId===id)setStatus('weddingsStatus',error.message,true);}finally{loading.set(key,false);}
  }
  async function refreshNostalgia(){
    const key='nostalgia';if(loading.get(key))return;loading.set(key,true);
    const photoEditVersion=photoEditVersions.get(key);
    if(!collections.has(key))setStatus('nostalgiaStatus',I18n.t('פותח את אלבום הזיכרונות…'));
    try{const result=await request(base(key));if(photoEditVersions.get(key)!==photoEditVersion)return;collections.set(key,result);setStatus('nostalgiaStatus');if(scope()===key)renderCollection(key);}
    catch(error){setStatus('nostalgiaStatus',error.message,true);}finally{loading.set(key,false);}
  }
  function renderCollection(key){
    if(scope()!==key)return;
    const collection=collections.get(key)||{items:[]},filter=filters.get(key)||'all',query=normalize(state.query);
    let items=collection.items.filter(item=>(filter==='all'||item.kind===filter)&&(!query||normalize(item.name+' '+item.caption+' '+(item.tags||[]).map(person=>I18n.searchNames(person)).join(' ')).includes(query)));
    if(key==='nostalgia'&&window.FamilyNostalgia&&collection.library)items=window.FamilyNostalgia.select(collection,{query,filter});
    window.FamilyMedia.register(key,items,{cover:collection.cover});
    const grid=$(gridId(key)),sameScope=grid.dataset.scope===key;
    const oldCards=new Map((sameScope?[...grid.children]:[]).filter(card=>card.dataset.mediaFile).map(card=>[card.dataset.mediaFile,card]));
    const cards=[];
    for(const item of items){
      let card=oldCards.get(item.file);
      if(card&&card.dataset.mediaSrc!==item.src)card=null;
      if(!card){
        card=document.createElement('article');card.className='shared-media-card'+(key==='nostalgia'&&item.kind==='video'?' nostalgia-video-card':'');card.dataset.mediaFile=item.file;card.dataset.mediaSrc=item.src;
        let viewer;
        if(item.kind==='photo')viewer=I18n.html`<button class="gallery-image" data-media-open="${safe(item.id||item.file)}" data-media-scope="${safe(key)}" aria-label="פתיחת התמונה ${safe(I18n.mediaName(item))}"><img src="${safe(item.thumbnailSrc||item.src)}" ${window.FamilyPhotoThumbnails?.attributes(item)||''} alt="${safe(item.caption||I18n.mediaName(item))}" loading="lazy" decoding="async"></button>`;
        else if(item.provider==='youtube')viewer=`<button type="button" class="archive-video-poster" data-media-open="${safe(item.id||item.file)}" data-media-scope="${safe(key)}" aria-label="${safe((I18n.isEnglish?'Play ':'ניגון ')+I18n.mediaName(item))}"><img src="${safe(item.poster)}" alt="${safe(I18n.mediaName(item))}" loading="lazy" decoding="async"><span class="archive-video-play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m8 5 12 7-12 7Z"/></svg></span></button>`;
        else if(item.kind==='video')viewer=I18n.html`<div class="video-frame"><video controls playsinline preload="metadata" aria-label="${safe(item.caption||I18n.mediaName(item))}"><source src="${safe(item.src)}" type="${safe(item.mime)}"></video></div><div class="video-file-info"><span>${safe(I18n.mediaName(item))}</span><a href="${safe(item.src)}" download="${safe(item.filename)}">הורדת המקור ↗</a></div><p class="video-codec-note" hidden>הסרטון לא מתנגן כאן. אפשר להוריד את המקור או להעלות MP4 עם H.264.</p>`;
        else viewer=I18n.html`<a class="archive-document" href="${safe(item.src)}" download="${safe(item.filename)}"><span class="document-emblem" aria-hidden="true">▤</span><strong>${safe(I18n.mediaName(item))}</strong><small>${safe(item.filename.split('.').pop().toUpperCase())} · ${(item.size/1024/1024).toFixed(1)}MB</small><span>הורדת המסמך ↓</span></a>`;
        const captionId='archive-caption-'+item.file.replace(/[^a-zA-Z0-9-]/g,'-');
        card.innerHTML=item.kind==='photo'?viewer:viewer+`<div class="media-file-name">${safe(item.provider==='youtube'?I18n.mediaName(item):item.filename)}</div>`+window.FamilyMedia.controls(item,key)+I18n.html`<div class="caption-editor"><label for="${captionId}">${item.kind==='photo'?I18n.t('מי בתמונה? איפה ומתי?'):item.kind==='video'?I18n.t('מה רואים בסרטון?'):I18n.t('מה הסיפור של המסמך?')}</label><textarea dir="auto" id="${captionId}" rows="2" maxlength="5000" data-archive-caption="${safe(item.file)}" data-archive-scope="${safe(key)}" placeholder="כמה מילים שיעזרו לשמור את הזיכרון…"></textarea><div class="caption-toolbar"><span data-archive-caption-status role="status"></span><button data-save-archive-caption="${safe(item.file)}" data-archive-scope="${safe(key)}">שמירה</button></div></div>`;
        if(key==='nostalgia'&&item.kind==='video')card.insertAdjacentHTML('afterbegin',`<header class="nostalgia-video-heading"><span class="small-eyebrow">${I18n.isEnglish?'From our family films':'מהסרטים המשפחתיים שלנו'}</span><h4>${safe(I18n.mediaName(item))}</h4></header>`);
        if(key==='nostalgia'&&item.kind==='video')card.insertAdjacentHTML('beforeend',`<button type="button" class="archive-capture-date" data-archive-date="${safe(item.id)}" aria-label="${I18n.isEnglish?'Edit recording date':'עריכת תאריך הצילום'}" aria-haspopup="dialog" aria-controls="photoDateDialog">${captureCalendar}<span data-archive-date-label>${safe(captureLabel(item))}</span>${pencil}</button>`);
        if(item.provider==='youtube')card.querySelector('.archive-video-poster img')?.addEventListener('error',event=>{event.currentTarget.hidden=true;});
        else if(item.kind==='video'){
          const player=card.querySelector('video'),note=card.querySelector('.video-codec-note');
          player.addEventListener('error',()=>{note.hidden=false;},true);
          for(const event of ['loadeddata','canplay'])player.addEventListener(event,()=>{note.hidden=true;});
        }
      }
      const draft=drafts.get(draftKey(key,item.file)),area=card.querySelector('textarea');
      if(area&&area!==document.activeElement)area.value=draft?.dirty?draft.value:item.caption||'';
      const dateLabel=card.querySelector('[data-archive-date-label]');if(dateLabel)dateLabel.textContent=captureLabel(item);
      card.dataset.mediaKind=item.kind;if(key==='nostalgia')window.FamilyNostalgia?.decorateCard?.(card,item);cards.push(card);
    }
    if(key==='nostalgia'){
      const groups=[],kinds=filter==='all'?['video','photo','document']:[filter];
      const labels={photo:I18n.t('תמונות נוסטלגיות'),video:I18n.t('סרטוני נוסטלגיה'),document:I18n.t('מסמכים מהעבר')};
      const actions={photo:I18n.t('＋ העלאת תמונות'),video:I18n.t('＋ העלאת סרטונים'),document:I18n.t('＋ העלאת מסמכים')};
      for(const kind of kinds){
        const kindCards=cards.filter(card=>card.dataset.mediaKind===kind);
        if(key==='nostalgia'&&!kindCards.length&&filter==='all')continue;
        const heading=grid.querySelector('[data-nostalgia-kind="'+kind+'"]')||document.createElement('header');
        heading.className='nostalgia-media-heading';heading.dataset.nostalgiaKind=kind;
        heading.innerHTML=`<h4>${labels[kind]} <span>(${kindCards.length})</span></h4><button type="button" class="secondary-button" data-archive-upload="nostalgia" data-archive-kind="${kind}">${actions[kind]}</button>`;
        groups.push(heading,...kindCards);
        if(!kindCards.length){const empty=grid.querySelector('[data-nostalgia-empty="'+kind+'"]')||document.createElement('p');empty.className='nostalgia-kind-empty';empty.dataset.nostalgiaEmpty=kind;empty.textContent=I18n.t(query?'לא נמצאו זיכרונות מהסוג הזה בחיפוש.':'כאן יש מקום לזיכרונות שלכם. הוסיפו את הראשון!');groups.push(empty);}
      }
      cards.splice(0,cards.length,...groups);
    }else if(!items.length&&collection.items.length){const previous=grid.querySelector('.no-content-match');cards.push(previous||Object.assign(document.createElement('p'),{className:'no-content-match',textContent:I18n.t('לא נמצאו זיכרונות בבחירה הזו. נסו לשנות את הסינון או את החיפוש.')}));}
    // Insert only new cards; do not detach playing videos during a background refresh.
    const active=document.activeElement,selection=active?.dataset?.archiveCaption?[active.selectionStart,active.selectionEnd]:null;
    const wanted=new Set(cards);for(const child of [...grid.children])if(!wanted.has(child))child.remove();
    let anchor=grid.firstElementChild;for(const card of cards){if(card===anchor)anchor=anchor.nextElementSibling;else grid.insertBefore(card,anchor);}
    grid.dataset.scope=key;
    window.FamilyTags.refresh(grid,items);
    if(selection&&grid.contains(active)){active.focus({preventScroll:true});active.setSelectionRange(...selection);}
    const nostalgia=key==='nostalgia',empty=$(nostalgia?'nostalgiaEmpty':'weddingMediaEmpty');empty.hidden=nostalgia||collection.items.length>0;
    $(nostalgia?'nostalgiaCount':'weddingMediaCount').textContent=I18n.html`${items.length}${!nostalgia&&items.length!==collection.items.length?I18n.t(' מתוך ')+collection.items.length:''} ${I18n.isEnglish?I18n.word(items.length,'memory','memories'):I18n.t('זיכרונות')}`;
    $(nostalgia?'nostalgiaFilters':'weddingMediaFilters').querySelectorAll('[data-archive-filter]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.archiveFilter===filter)));
    updateUploadUI(key);
  }
  function captionStatus(key,file,message,failed=false){
    if(scope()!==key)return;
    const card=[...$(gridId(key)).children].find(card=>card.dataset.mediaFile===file),status=card?.querySelector('[data-archive-caption-status]');
    if(status){status.textContent=message;status.classList.toggle('save-error',failed);}
  }
  function editCaption(area){
    const key=area.dataset.archiveScope,file=area.dataset.archiveCaption,id=draftKey(key,file);
    const draft=drafts.get(id)||{key,file,saving:false};clearTimeout(draft.timer);draft.value=area.value;draft.dirty=true;
    draft.timer=setTimeout(()=>saveCaption(id),800);drafts.set(id,draft);captionStatus(key,file,I18n.t('ממתין לשמירה…'));
  }
  async function saveCaption(id){
    const draft=drafts.get(id);if(!draft?.dirty||draft.saving)return;
    clearTimeout(draft.timer);draft.saving=true;const value=draft.value;captionStatus(draft.key,draft.file,I18n.t('שומר…'));
    try{
      await post(base(draft.key)+'/caption',{file:draft.file,caption:value});
      const item=collections.get(draft.key)?.items.find(item=>item.file===draft.file);if(item)item.caption=value;
      if(draft.value===value){draft.dirty=false;captionStatus(draft.key,draft.file,I18n.t('נשמר ✓'));}
      else draft.timer=setTimeout(()=>saveCaption(id),100);
    }catch(error){captionStatus(draft.key,draft.file,I18n.t('לא נשמר · נסו שוב'),true);toast(error.message);}finally{draft.saving=false;}
  }
  function updateUploadUI(key){
    if(scope()!==key)return;const item=uploadStates.get(key),id=prefix(key);
    $(id+'UploadState').textContent=item?.message||'';$(id+'Progress').hidden=!item?.active;$(id+'Progress').value=item?.percent||0;
    $(id+'Dropzone').classList.toggle('uploading',Boolean(item?.active));
  }
  function sendFile(key,file,onProgress,eventId=null){
    if(key==='nostalgia'&&file.size>90*1024*1024&&(/^video\//i.test(file.type)||/\.(mp4|mov|webm|m4v)$/i.test(file.name)))return sendLargeVideo(file,onProgress,eventId);
    return new Promise((resolve,reject)=>{
      const xhr=new XMLHttpRequest();xhr.open('POST',base(key)+'/upload?filename='+encodeURIComponent(file.name)+(eventId?'&event='+encodeURIComponent(eventId):''));
      xhr.setRequestHeader('X-Family-Token',window.FAMILY_API_TOKEN);xhr.setRequestHeader('Content-Type',file.type||'application/octet-stream');
      xhr.upload.onprogress=event=>{if(event.lengthComputable)onProgress(Math.round(event.loaded/event.total*100));};
      xhr.onload=()=>{let result;try{result=JSON.parse(xhr.responseText);}catch{reject(Error(I18n.t('לא התקבל אישור שמירה. נסו לרענן.')));return;}if(xhr.status>=200&&xhr.status<300)Promise.resolve(window.FamilyPhotoThumbnails?.fromUpload?.(result,file)).then(()=>resolve(result),()=>resolve(result));else reject(Error(I18n.error(result.error)||I18n.t('הקובץ לא נשמר.')));};
      xhr.onerror=()=>reject(Error(I18n.t('ההעלאה נקטעה. בדקו את החיבור ונסו שוב.')));xhr.onabort=()=>reject(Error(I18n.t('ההעלאה בוטלה.')));const payload=window.FamilyPhotoEditor?.upload?.(file)||{body:file};for(const [name,value]of Object.entries(payload.headers||{}))xhr.setRequestHeader(name,value);xhr.send(payload.body);
    });
  }
  async function retryVideo(action){
    for(let attempt=0;;attempt++){
      try{return await action();}
      catch(error){if(attempt>=2||!(error.retryable||error instanceof TypeError||error.status>=500||error.code==='VIDEO_INCOMPLETE'))throw error;await new Promise(resolve=>setTimeout(resolve,500*(attempt+1)));}
    }
  }
  function sendVideoPart(session,number,blob,onProgress){
    return new Promise((resolve,reject)=>{
      const xhr=new XMLHttpRequest();xhr.open('POST','api/nostalgia/multipart/part');xhr.timeout=180000;
      for(const [name,value]of Object.entries({'X-Family-Token':window.FAMILY_API_TOKEN,'X-Upload-Session':session,'X-Upload-Part':String(number),'Content-Type':'application/octet-stream'}))xhr.setRequestHeader(name,value);
      xhr.upload.onprogress=event=>{if(event.lengthComputable)onProgress(event.loaded);};
      xhr.onload=()=>{let result;try{result=JSON.parse(xhr.responseText);}catch{reject(Object.assign(Error(I18n.isEnglish?'The upload was not acknowledged. Please try again.':'לא התקבל אישור להעלאה. נסו שוב.'),{retryable:xhr.status>=500}));return;}if(xhr.status>=200&&xhr.status<300)resolve(result);else reject(Object.assign(Error(I18n.error(result.error)||I18n.t('הקובץ לא נשמר.')),{status:xhr.status,code:result.code}));};
      const interrupted=()=>reject(Object.assign(Error(I18n.t('ההעלאה נקטעה. בדקו את החיבור ונסו שוב.')),{retryable:true}));
      xhr.onerror=interrupted;xhr.ontimeout=interrupted;xhr.onabort=()=>reject(Error(I18n.t('ההעלאה בוטלה.')));xhr.send(blob);
    });
  }
  async function sendLargeVideo(file,onProgress,eventId=null){
    const head=new Uint8Array(await file.slice(0,128).arrayBuffer());
    const upload=await post('api/nostalgia/multipart/start',{filename:file.name,size:file.size,head:btoa(String.fromCharCode(...head)),...(eventId?{eventId}:{})});
    try{
      for(let offset=0,number=1;offset<file.size;offset+=upload.partSize,number++){
        const part=file.slice(offset,Math.min(file.size,offset+upload.partSize));
        await retryVideo(()=>sendVideoPart(upload.session,number,part,loaded=>onProgress(Math.min(99,Math.floor((offset+loaded)/file.size*100)))));
        onProgress(Math.min(99,Math.floor((offset+part.size)/file.size*100)));
      }
      onProgress(100);
      return await retryVideo(()=>post('api/nostalgia/multipart/complete',{session:upload.session}));
    }catch(error){await post('api/nostalgia/multipart/abort',{session:upload.session}).catch(()=>{});throw error;}
  }
  function applyUploaded(key,result){collections.set(key,result.collection);
        if(key!=='nostalgia'){const id=key.slice(8),record=details.get(id);if(record){record.collection=result.collection;record.mediaCount=result.collection.count;record.cover=result.collection.items.find(item=>item.kind==='photo')?.src||null;summaries.set(id,record);}}
        if(scope()===key)renderCollection(key);}
  async function addFiles(key,input,{eventId=key==='nostalgia'?window.FamilyNostalgia?.uploadEventId?.():null}={}){
    if(!key||!canSave())return;
    let files=[...input];if(!files.length)return;
    if(files.some(file=>/^image\//i.test(file.type)||/\.(jpe?g|png|webp|gif|avif)$/i.test(file.name))){
      try{files=await window.FamilyPhotoEditor.prepare(files,{scope:key,onUpload:async(file,progress)=>{const result=await sendFile(key,file,progress,eventId);applyUploaded(key,result);}});}catch{toast(I18n.isEnglish?'The photo editor could not open. Refresh the page and try again.':'מסך עריכת התמונות לא נטען. רעננו את הדף ונסו שוב.');return;}
      if(!files?.length)return;
    }
    const item=uploadStates.get(key);
    const status=item?.pending?item:{saved:0,failed:0,pending:0,message:'',active:false,percent:0};status.pending+=files.length;uploadStates.set(key,status);
    jobs.push(...files.map(file=>({key,file,eventId})));runUploads();
  }
  async function runUploads(){
    if(state.uploading)return;state.uploading=true;
    try{while(jobs.length){
      const {key,file,eventId}=jobs.shift(),status=uploadStates.get(key);status.active=true;status.percent=0;status.message=I18n.t('מעלה ')+file.name+'…';updateUploadUI(key);
      try{
        const video=/^video\//i.test(file.type)||/\.(mp4|mov|webm|m4v)$/i.test(file.name),photo=/^image\//i.test(file.type)||/\.(jpe?g|png|gif|webp|avif)$/i.test(file.name);
        const maximum=video?(key==='nostalgia'?500:90):photo?50:10;if(file.size>maximum*1024*1024)throw Error(I18n.html`אפשר להעלות ${video?I18n.t('סרטון'):photo?I18n.t('תמונה'):I18n.t('מסמך')} עד ${maximum}MB.`);
        const result=await sendFile(key,file,percent=>{status.percent=percent;status.message=percent===100?I18n.t('ההעלאה הסתיימה, שומר את הזיכרון…'):I18n.html`מעלה ${file.name} · ${percent}%`;updateUploadUI(key);},eventId);
        applyUploaded(key,result);status.saved++;
      }catch(error){status.failed++;toast(file.name+': '+error.message);status.lastError=error.message;}
      finally{status.pending--;status.active=false;status.message=I18n.html`${status.saved} קבצים נשמרו${status.saved?' ✓':''}${status.failed?' · '+status.failed+I18n.t(' לא נשמרו: ')+status.lastError:''}`;updateUploadUI(key);}
    }}finally{state.uploading=false;}
  }
  async function openDate(id){
    if(!canSave())return;
    if(!summaries.has(id))await refreshWeddings();
    const record=summaries.get(id);if(!record){toast(I18n.t('יום הנישואים לא נטען. נסו לרענן.'));return;}
    state.editingDate={id,revision:record.revision};const date=/^\d{4}$/.test(record.date)?{year:Number(record.date)}:window.FamilyDates.parse(record.date);
    $('weddingDateCouple').textContent=pairTitle(pairById.get(id));$('weddingDay').value=date?.day||'';$('weddingMonth').value=date?.month||'';$('weddingYear').value=date?.year||'';
    $('weddingDateError').textContent='';const hint=$('weddingDatePrecisionHint');if(hint)hint.textContent=I18n.isEnglish?'If only the year is known, leave the day and month blank.':'אם ידועה רק השנה, השאירו את היום והחודש ריקים.';previewDate();$('weddingDateDialog').showModal();
  }
  const dateInput=()=>!$('weddingDay').value&&!$('weddingMonth').value?$('weddingYear').value:`${$('weddingDay').value}.${$('weddingMonth').value}.${$('weddingYear').value}`;
  function previewDate(){if(/^\d{4}$/.test(dateInput())){$('weddingDatePreview').textContent=I18n.isEnglish?'Year only; no anniversary reminder will be sent.':'שנה בלבד; לא תישלח תזכורת יום נישואים.';return;}const years=window.FamilyDates.age(dateInput());$('weddingDatePreview').textContent=years===null?'':yearsText({id:state.editingDate?.id,date:dateInput()});}
  async function saveDate(event,clear=false){
    event.preventDefault();if(!state.editingDate)return;
    const current={...state.editingDate},button=$('saveWeddingDate');button.disabled=true;$('clearWeddingDate').disabled=true;$('weddingDateError').textContent='';
    try{
      const result=await post('api/weddings/'+encodeURIComponent(current.id)+'/date',{date:clear?'':dateInput(),expectedRevision:current.revision});
      summaries.set(current.id,result.wedding);const detail=details.get(current.id);if(detail)Object.assign(detail,result.wedding);
      $('weddingDateDialog').close();if(state.weddingId===current.id)renderWedding(current.id);else if(state.view==='weddings')renderWeddings();toast(I18n.t('יום הנישואים נשמר ✓'));
    }catch(error){$('weddingDateError').textContent=error.message;}finally{button.disabled=false;$('clearWeddingDate').disabled=false;}
  }
  function rememberGreeting(){if(state.weddingId)greetingDrafts.set(state.weddingId,{author:$('greetingAuthor').value,body:$('greetingBody').value});}
  async function saveGreeting(event){
    event.preventDefault();const id=state.weddingId;if(!id||!canSave()||greetingPending.has(id))return;
    rememberGreeting();const body={...greetingDrafts.get(id)};greetingPending.add(id);$('saveWeddingGreeting').disabled=true;$('greetingError').textContent='';
    try{
      await post('api/weddings/'+encodeURIComponent(id)+'/greetings',body);
      const current=greetingDrafts.get(id);if(current?.body===body.body&&current?.author===body.author){greetingDrafts.delete(id);if(state.weddingId===id)$('weddingGreetingForm').reset();}
      await refreshWedding(id);toast(I18n.t('הזיכרון או הברכה נוספו לעמוד החתונה ✓'));
    }catch(error){if(state.weddingId===id)$('greetingError').textContent=error.message;else toast(error.message);}
    finally{greetingPending.delete(id);if(state.weddingId===id)$('saveWeddingGreeting').disabled=false;}
  }
  function activate(view){
    const changed=state.view!==view;state.view=view;if(changed)state.query='';
    $('weddingsView').hidden=view!=='weddings';$('nostalgiaView').hidden=view!=='nostalgia';
    if(!state.ready)return;
    if(view==='weddings'){
      let id;try{id=decodeURIComponent(location.hash.split('/')[1]||'');}catch{id=null;}
      state.weddingId=pairById.has(id)?id:null;
    }
    if(view==='weddings'){$('weddingsOverview').hidden=Boolean(state.weddingId);$('weddingDetail').hidden=!state.weddingId;if(state.weddingId){renderWedding(state.weddingId);refreshWedding(state.weddingId);}else{renderWeddings();refreshWeddings();}}
    if(view==='nostalgia'){renderCollection('nostalgia');refreshNostalgia();}
    document.querySelectorAll('#weddingsView video,#nostalgiaView video').forEach(video=>{if(!video.closest('section.portal-view')||video.closest('section.portal-view').hidden)video.pause();});
    for(const [key,draft]of drafts)if(draft.dirty)saveCaption(key);
  }
  function search(query){state.query=query;if(state.view==='weddings'&&!state.weddingId)renderWeddings();else if(scope())renderCollection(scope());}
  function acceptDrop(event){const key=scope();if(key==='nostalgia'&&window.FamilyNostalgia?.acceptDrop?.(event))return true;if(!key||document.querySelector('dialog[open]'))return false;$(prefix(key)+'Dropzone').classList.remove('drag-over');addFiles(key,event.dataTransfer.files);return true;}
  function dragOver(){const key=scope();if(key&&!document.querySelector('dialog[open]'))$(prefix(key)+'Dropzone').classList.add('drag-over');}
  function acceptPaste(event){
    const key=scope();if(!key||document.querySelector('dialog[open]')||event.target.closest('textarea,input'))return false;
    const files=[...(event.clipboardData?.items||[])].filter(item=>item.kind==='file'&&item.type.startsWith('image/')).map(item=>item.getAsFile()).filter(Boolean);
    if(!files.length)return false;event.preventDefault();addFiles(key,files);return true;
  }
  function init(){
    state.ready=true;$('weddingYear').max=new Date().getFullYear();
    $('weddingBranchFilter').insertAdjacentHTML('beforeend',I18n.t('<option value="root">השורשים של כולנו</option>')+family.branches.map(branch=>`<option value="${branch.id}">${safe(I18n.branchName(branch))}</option>`).join(''));
    document.addEventListener('click',event=>{
      const open=event.target.closest('[data-open-wedding]');if(open){openWedding(open.dataset.openWedding);return;}
      if(event.target.closest('[data-share-wedding-memory]')){$('weddingGreetingsTitle').scrollIntoView({block:'start'});$('greetingBody').focus({preventScroll:true});return;}
      if(event.target.closest('[data-wedding-back]')){if(!window.FamilyNavigation?.returnTo('#weddings'))openWedding(null);return;}
      const date=event.target.closest('[data-edit-wedding-date]');if(date){openDate(date.dataset.editWeddingDate);return;}
      if(event.target.closest('#editWeddingDate')){openDate(state.weddingId);return;}
      const upload=event.target.closest('[data-archive-upload]');if(upload){if(!canSave())return;const key=scope();if(!key)return;const input=$(prefix(key)+'UploadInput');const kind=upload.dataset.archiveKind;input.accept=kind==='photo'?'image/jpeg,image/png,image/webp,image/gif,image/avif':kind==='video'?'video/mp4,video/webm,video/quicktime,.mp4,.m4v,.mov,.webm':kind==='document'?'.pdf,.doc,.docx,.txt,.md':'image/jpeg,image/png,image/webp,image/gif,image/avif,video/mp4,video/webm,video/quicktime,.mp4,.m4v,.mov,.webm,.pdf,.doc,.docx,.txt,.md';input.dataset.scope=key;input.dataset.eventId=key==='nostalgia'?(window.FamilyNostalgia?.uploadEventId?.()||''):'';input.value='';input.click();return;}
      const filter=event.target.closest('[data-archive-filter]');if(filter){const key=scope();if(key){filters.set(key,filter.dataset.archiveFilter);renderCollection(key);}return;}
      const capture=event.target.closest('[data-archive-date]');if(capture){const memory=collections.get(scope())?.items.find(item=>item.id===capture.dataset.archiveDate);if(memory)window.FamilyPhotoDate?.open(memory);return;}
      const save=event.target.closest('[data-save-archive-caption]');if(save){saveCaption(draftKey(save.dataset.archiveScope,save.dataset.saveArchiveCaption));return;}
      const photo=event.target.closest('[data-archive-photo]');if(photo){const key=scope(),items=(collections.get(key)?.items||[]).filter(item=>item.kind==='photo');app().openSharedGallery(items,items.findIndex(item=>item.file===photo.dataset.archivePhoto));}
    });
    document.addEventListener('input',event=>{if(event.target.matches('[data-archive-caption]'))editCaption(event.target);if(event.target.closest('#weddingDateForm'))previewDate();if(event.target.closest('#weddingGreetingForm'))rememberGreeting();});
    document.addEventListener('keydown',event=>{if(event.target.matches('[data-archive-caption]'))window.FamilyPhotoKeyboard?.saveDescription(event,()=>saveCaption(draftKey(event.target.dataset.archiveScope,event.target.dataset.archiveCaption)));});
    document.addEventListener('focusout',event=>{if(event.target.matches('[data-archive-caption]'))saveCaption(draftKey(event.target.dataset.archiveScope,event.target.dataset.archiveCaption));});
    for(const id of ['weddingUploadInput','nostalgiaUploadInput'])$(id).addEventListener('change',()=>addFiles($(id).dataset.scope,$(id).files,{eventId:$(id).dataset.eventId||null}));
    for(const id of ['weddingDropzone','nostalgiaDropzone'])$(id).addEventListener('dragleave',event=>{if(!event.relatedTarget||!$(id).contains(event.relatedTarget))$(id).classList.remove('drag-over');});
    $('weddingBranchFilter').addEventListener('change',renderWeddings);$('weddingDateForm').addEventListener('submit',saveDate);$('clearWeddingDate').addEventListener('click',event=>saveDate(event,true));$('weddingGreetingForm').addEventListener('submit',saveGreeting);
    window.addEventListener('family-media-changed',event=>{
      if(['photo-edit','photo-date','caption','labels'].includes(event.detail.operation)&&event.detail.item){
        const item=event.detail.item;for(const [key,album] of collections)if(album.items?.some(photo=>photo.id===item.id)){album.items=album.items.map(photo=>photo.id===item.id?{...photo,...item}:photo);photoEditVersions.set(key,(photoEditVersions.get(key)||0)+1);if(scope()===key)renderCollection(key);}
        for(const pair of summaries.values())if(pair.cover?.split('?')[0]==='/media/'+item.id)pair.cover=item.src;
        if(state.view==='weddings'&&!state.weddingId)renderWeddings();return;
      }
      const result=event.detail,key=result.scope;if(key!=='nostalgia'&&!key?.startsWith('wedding:'))return;
      if(!result.collection){const album=collections.get(key);if(album&&result.item&&result.operation==='tags'){album.items=album.items.map(item=>item.id===result.item.id?{...item,...result.item}:item);if(scope()===key)renderCollection(key);}return;}
      if(result.operation==='delete'){const id=draftKey(key,result.item.file);clearTimeout(drafts.get(id)?.timer);drafts.delete(id);}
      collections.set(key,result.collection);
      if(result.wedding){const id=result.wedding.id;summaries.set(id,result.wedding);if(details.has(id))details.set(id,{...details.get(id),...result.wedding,collection:result.collection});}
      if(scope()===key)renderCollection(key);else window.FamilyMedia.register(key,result.collection.items,{cover:result.collection.cover});
      if(state.view==='weddings'&&!state.weddingId)renderWeddings();
    });
    $('shareWedding').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(location.href);toast(I18n.t('הקישור לעמוד החתונה הועתק ✓'));}catch{toast(I18n.t('אפשר להעתיק את הקישור משורת הכתובת.'));}});
    $('weddingDateDialog').addEventListener('click',event=>{if(event.target!==$('weddingDateDialog'))return;const rect=$('weddingDateDialog').getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)$('weddingDateDialog').close();});
    window.addEventListener('popstate',route);window.addEventListener('hashchange',route);
    window.addEventListener('beforeunload',event=>{if(state.uploading||jobs.length||[...greetingDrafts.values()].some(draft=>draft.body.trim())){event.preventDefault();event.returnValue='';}});
    window.addEventListener('pagehide',()=>{for(const[key,draft]of drafts)if(draft.dirty)saveCaption(key);});
    const refresh=()=>{if(document.visibilityState==='hidden')return;if(state.view==='nostalgia')refreshNostalgia();if(state.view==='weddings'){if(state.weddingId)refreshWedding(state.weddingId);else refreshWeddings();}};
    document.addEventListener('visibilitychange',refresh);setInterval(refresh,30000);
    if(/^#(weddings|nostalgia)(\/|$)/.test(location.hash))route();else activate(app().getView());
  }
  window.FamilyArchive={activate,search,acceptDrop,dragOver,acceptPaste,renderNostalgia:()=>renderCollection('nostalgia'),uploadToNostalgia:(files,eventId)=>addFiles('nostalgia',files,{eventId}),nostalgiaAction:async(action,body)=>{const result=await post('api/nostalgia/'+action,body);if(result.collection)applyUploaded('nostalgia',result);return result;}};
  document.addEventListener('error',event=>{if(event.target.matches?.('.wedding-person-photo'))event.target.hidden=true;},true);
  window.addEventListener('family-profile-changed',()=>{if(state.view==='weddings'&&!state.weddingId)renderWeddings();});
  document.addEventListener('DOMContentLoaded',init);
})();

