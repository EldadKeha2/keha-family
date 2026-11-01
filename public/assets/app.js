(() => {
  'use strict';
  const data = window.FAMILY_DATA;
  const $ = id => document.getElementById(id);
  const people = Object.values(data.people);
  const media = new Map();
  const state = {view:'tree', branch:'all', mode:'overview', query:'', currentPerson:null, gallery:[], photoIndex:0, urls:[]};
  const camera = {x:0,y:0,scale:1,width:0,height:0};
  const branchFor = id => data.branches.find(b => b.id === id);
  const getMedia = p => media.get(p.id) || {};
  const nameOf = p => getMedia(p).name || p.name;
  const birthdayOf = p => getMedia(p).birthday || p.birthday;
  const isPlaceholder = p => p.placeholder && nameOf(p) === p.name;
  const branchTitle = p => branchFor(p.branch)?.title || 'השורשים של כולנו';
  const generationName = n => ['','הדור הראשון','הדור השני','הדור השלישי','הדור הרביעי','הדור החמישי'][n] || `דור ${n}`;
  const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safe = escapeHTML;
  const initials = p => nameOf(p).split(/\s+/).filter(Boolean).map(s => s[0]).slice(0,2).join('');
  const normalize = s => s.normalize('NFKD').replace(/[\u0591-\u05c7'"׳״]/g,'').toLowerCase().trim();
  const silhouette = '<svg class="silhouette" viewBox="0 0 80 100" aria-hidden="true"><circle cx="40" cy="27" r="17"/><path d="M9 94V83c0-20 12-33 31-33s31 13 31 33v11Z"/></svg>';
  const arrow = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg>';
  const calendarIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="16" rx="2"/><path d="M8 3v4m8-4v4M4 10h16m-11 4h1m4 0h1m-6 3h1"/></svg>';
  const imageIcon = '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="4" y="5" width="24" height="23" rx="2"/><circle cx="11" cy="12" r="2.5"/><path d="m5 24 8-8 5 5 4-4 6 7"/></svg>';
  let toastTimer;

  function portraitHTML(p) {
    const src = getMedia(p).profile;
    return `<span class="portrait" aria-hidden="true">${silhouette}<span class="portrait-letter">${safe(initials(p))}</span>${src ? `<img class="profile-photo" src="${safe(src)}" alt="" loading="lazy">` : ''}</span>`;
  }
  function birthdayHTML(p) {
    const invalid = getMedia(p).invalidBirthday;
    const value = birthdayOf(p), death = p.deathDate ? window.FamilyDates.parse(p.deathDate) : null;
    const age = invalid ? null : p.deceased ? death ? window.FamilyDates.age(value,death.date) : null : window.FamilyDates.age(value);
    const unknown = value === '1.1.1111';
    return `<span class="birthday-line"><bdi>${safe(invalid ? 'תאריך לבדיקה' : unknown ? 'טרם הוזן' : value)}</bdi><button class="birthday-edit" data-edit-birthday="${p.id}" aria-label="עריכת יום ההולדת של ${safe(nameOf(p))}" title="עריכת יום הולדת"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15Z"/></svg></button></span>${age !== null ? `<span class="person-age" aria-label="${p.deceased?'גיל בפטירה':'גיל'} ${age}">${p.deceased?`(${p.gender==='f'?'בת':'בן'} ${age} בפטירת${p.gender==='f'?'ה':'ו'})`:`(${age})`}</span>` : ''}${death?`<span class="person-death-date">${p.gender==='f'?'נפטרה':'נפטר'} ב־<bdi>${safe(p.deathDate)}</bdi></span>`:''}${p.aliyahYear?`<span class="person-aliyah-year">${p.gender==='f'?'עלתה':'עלה'} לארץ ב־<bdi>${safe(p.aliyahYear)}</bdi></span>`:''}`;
  }
  function personCardHTML(p) {
    const unset = birthdayOf(p) === '1.1.1111';
    return `<article class="person-card${p.deceased?' memorial':''}${isPlaceholder(p)?' placeholder-person':''}" data-person-card="${p.id}"><button class="person-open" data-person="${p.id}" aria-label="פתיחת הגלריה של ${safe(nameOf(p))}">${portraitHTML(p)}<span class="person-name${nameOf(p).length>17?' long-name':''}">${safe(nameOf(p))}${p.deceased?' <span class="memorial-inline">ז״ל</span>':''}</span></button><div class="person-birthday${unset?' birthday-unset':''}" data-birthday-for="${p.id}">${birthdayHTML(p)}</div></article>`;
  }
  function toast(message) {
    clearTimeout(toastTimer); $('toast').textContent = message; $('toast').hidden = false;
    toastTimer = setTimeout(() => {$('toast').hidden = true;}, 6000);
  }
  function renderBranches() {
    $('branchBar').innerHTML = `<button class="branch-chip all-chip${state.branch==='all'?' active':''}" data-branch="all" aria-pressed="${state.branch==='all'}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v6M5 15V9h14v6M12 9v6"/><circle cx="5" cy="18" r="2"/><circle cx="12" cy="18" r="2"/><circle cx="19" cy="18" r="2"/></svg> כל המשפחה</button>` + data.branches.map(b => `<button class="branch-chip${state.branch===b.id?' active':''}" data-branch="${b.id}" style="--branch-color:${b.color}" aria-pressed="${state.branch===b.id}"><span class="chip-dot"></span>${safe(b.title)}</button>`).join('');
  }
  function selectBranch(id) {
    state.branch = id;
    if (id !== 'all') state.mode = 'branch';
    else state.mode = 'overview';
    renderBranches(); renderView();
  }
  function setView(view) {
    const previous = state.view;
    state.view = view;
    if (previous !== view) {state.query='';$('searchInput').value='';}
    document.querySelectorAll('[data-view]').forEach(el => {el.classList.toggle('active',el.dataset.view === view);el.setAttribute('aria-pressed',String(el.dataset.view === view));});
    $('searchResults').hidden = true;
    renderView();
  }
  function renderView() {
    const isTree = state.view === 'tree';
    const isDirectory = state.view === 'directory';
    const global = !isTree && !isDirectory;
    $('treeView').hidden = !isTree;
    $('directoryView').hidden = !isDirectory;
    $('branchBar').hidden = global;
    const titles = {tree:['האילן המשפחתי','משורש משותף, שישה ענפים של אהבה'],directory:['כל בני המשפחה','האלבומים וימי ההולדת של כולנו'],videos:['סרטוני המשפחה','הקולות, הצחוק והרגעים שנשארים איתנו'],photos:['תמונות משפחתיות','אלבום אחד, אינספור זיכרונות משותפים'],stories:['הסיפורים שלנו','יומן משפחתי, מהעבר ועד היום'],weddings:['החתונות שלנו','סיפורי האהבה, הברכות והרגעים מהיום המיוחד'],nostalgia:['פינת הנוסטלגיה','תמונות, סרטים ומכתבים שמחזירים אותנו הביתה']};
    const [title,subtitle] = titles[state.view] || titles.tree;
    $('workspaceTitle').textContent = title;
    $('workspaceSubtitle').textContent = subtitle;
    $('searchInput').placeholder = global ? state.view==='stories'?'חיפוש בסיפורים ובשנים':'חיפוש לפי כיתוב או שם קובץ' : 'חיפוש בן או בת משפחה';
    $('searchInput').setAttribute('aria-label', global?'חיפוש בתוכן המשפחתי':'חיפוש בני משפחה');
    window.FamilyPortal?.activate(state.view);
    window.FamilyArchive?.activate(state.view);
    if (isTree) renderTree(); else if (isDirectory) renderDirectory();
  }
  function renderDirectory() {
    const query = normalize(state.query);
    const selected = people.filter(p => (state.branch === 'all' || p.branch === state.branch) && (!query || normalize(nameOf(p)).includes(query)));
    $('directoryCount').textContent = `${selected.length} כרטיסים${state.branch!=='all'?' · '+branchFor(state.branch).title:''}`;
    $('directoryGrid').innerHTML = selected.map(p=>`<article class="directory-card${p.deceased?' memorial':''}" data-person-card="${p.id}"><button class="directory-open" data-person="${p.id}" aria-label="פתיחת האלבום של ${safe(nameOf(p))}">${portraitHTML(p)}<strong>${safe(nameOf(p))}${p.deceased?' <span class="memorial-inline">ז״ל</span>':''}</strong><span class="directory-branch">${safe(branchTitle(p))}</span></button><div class="directory-date" data-birthday-for="${p.id}">${birthdayHTML(p)}</div></article>`).join('');
    $('emptySearch').hidden = selected.length > 0;
  }

  function renderTree() {
    const overview = state.branch === 'all' && state.mode === 'overview';
    const rootId = state.branch === 'all' ? data.root : branchFor(state.branch).unit;
    const rootHistorySpace = data.units[rootId].people.some(id=>data.people[id].aliyahYear) ? 40 : 0;
    const gap = 36;
    const levelHeight = 340;
    const top = 70;
    const pad = 48;
    const positions = [];
    const lines = [];
    const widths = new Map();
    const children = unit => overview && unit.id !== data.root ? [] : unit.children;
    const nodeWidth = unit => unit.people.length === 2 ? 320 : 146;
    function measure(id) {
      const unit = data.units[id], kids = children(unit);
      const childWidth = kids.reduce((sum, child) => sum+measure(child), 0) + Math.max(0,kids.length-1)*gap;
      const width = Math.max(nodeWidth(unit),childWidth);
      widths.set(id,width);return width;
    }
    function place(id,left,depth) {
      const unit=data.units[id], width=widths.get(id), x=left+width/2, y=top+depth*levelHeight+(depth?rootHistorySpace:0);
      positions.push({id,unit,x,y,width:nodeWidth(unit),depth});
      const kids=children(unit);
      let right=left+width;
      const total=kids.reduce((sum,c)=>sum+widths.get(c),0)+Math.max(0,kids.length-1)*gap;
      right -= (width-total)/2;
      const childCenters=[];
      for (const child of kids) {const w=widths.get(child);const childX=right-w/2;childCenters.push(childX);place(child,right-w,depth+1);right-=w+gap;}
      if(kids.length){
        const extra=depth===0?rootHistorySpace:0;
        const start=y+261+extra, middle=y+294+extra, end=y+levelHeight-7+extra;
        lines.push(`<path d="M${x} ${start}V${middle}"/><circle class="connector-start" cx="${x}" cy="${start}" r="2.5"/>`);
        if(kids.length>1) lines.push(`<path d="M${Math.min(...childCenters)} ${middle}H${Math.max(...childCenters)}"/>`);
        for(const cx of childCenters) lines.push(`<path d="M${cx} ${middle}V${end}"/>`);
      }
    }
    const width=measure(rootId)+2*pad;
    place(rootId,pad,0);
    const maxDepth=Math.max(...positions.map(p=>p.depth));
    const height=top+maxDepth*levelHeight+(maxDepth?rootHistorySpace:0)+(overview?316:278)+30;
    camera.width=width;camera.height=height;
    const world=$('treeWorld');world.style.width=width+'px';world.style.height=height+'px';
    $('treeConnectors').setAttribute('width',width);$('treeConnectors').setAttribute('height',height);$('treeConnectors').innerHTML=lines.join('');
    $('treeNodes').innerHTML=positions.map(({unit,x,y,width:w,depth})=>{
      const branch=branchFor(unit.branch);
      let label='';
      if (unit.id===data.root) label='<span class="generation-label">כאן מתחיל הסיפור</span>';
      else if(depth===0 || overview) label=`<span class="branch-label" style="--branch-color:${branch?.color||'#a2824c'}">${safe(branch?.title||'')}</span>`;
      const open=overview && unit.id!==data.root ? `<button class="branch-open" data-open-branch="${unit.branch}" style="--branch-color:${branch.color}" aria-label="פתיחת ${safe(branch.title)}">${safe(branch.title)} <span class="branch-count">${people.filter(p=>p.branch===unit.branch&&!isPlaceholder(p)).length}</span>${arrow}</button>`:'';
      return `<div class="tree-unit${unit.people.length===2?' couple':''}" data-unit="${unit.id}" style="left:${x-w/2}px;top:${y}px;width:${w}px">${label}${unit.people.length===2?'<span class="union-diamond" aria-hidden="true"></span>':''}${unit.people.map(id=>personCardHTML(data.people[id])).join('')}${open}</div>`;
    }).join('');
    $('treeBreadcrumb').textContent = state.branch==='all' ? (overview?'כל המשפחה · ששת הענפים':'כל המשפחה · כל הדורות') : `יונה ושלמה › ${branchFor(state.branch).title}`;
    $('overviewButton').classList.toggle('selected',overview);$('overviewButton').setAttribute('aria-pressed',String(overview));
    $('fullTreeButton').classList.toggle('selected',!overview);$('fullTreeButton').setAttribute('aria-pressed',String(!overview));
    $('canvasHint').innerHTML=overview?'<span aria-hidden="true">✧</span> גררו ימינה ושמאלה בין הענפים · לחצו על שם לפתיחת האלבום':'<span aria-hidden="true">✧</span> גררו את העץ כדי לטייל בין הדורות · + להתקרבות';
    requestAnimationFrame(()=>{
      const viewport=$('treeViewport');
      const fit=Math.min((viewport.clientWidth-40)/width,(viewport.clientHeight-80)/height,1.06);
      camera.scale = Math.max(.9,Math.min(1.06,fit));
      camera.x=(viewport.clientWidth-width*camera.scale)/2;
      camera.y=overview ? Math.max(15,(viewport.clientHeight-55-height*camera.scale)/2) : 25;
      applyCamera();
    });
  }
  function applyCamera() {
    $('treeWorld').style.transform=`translate(${camera.x}px,${camera.y}px) scale(${camera.scale})`;
    $('zoomValue').textContent=Math.round(camera.scale*100)+'%';
  }
  function zoom(factor,cx,cy) {
    const viewport=$('treeViewport');
    cx=cx??viewport.clientWidth/2;cy=cy??viewport.clientHeight/2;
    const previous=camera.scale;camera.scale=Math.max(.08,Math.min(2.4,previous*factor));
    camera.x=cx-(cx-camera.x)*camera.scale/previous;camera.y=cy-(cy-camera.y)*camera.scale/previous;
    applyCamera();
  }
  function fitTree() {
    const v=$('treeViewport');camera.scale=Math.min((v.clientWidth-36)/camera.width,(v.clientHeight-82)/camera.height,1.1);
    camera.x=(v.clientWidth-camera.width*camera.scale)/2;camera.y=Math.max(12,(v.clientHeight-55-camera.height*camera.scale)/2);applyCamera();
  }
  const apiEnabled = window.LOCAL_FAMILY_SERVER === true;
  const drafts = new Map();
  const uploads = [];
  let uploadRunning = false;
  let galleryRevision = null;
  let gallerySignature = '';
  let galleryLoading = false;
  let mediaLoading = false;
  const keyFor = (personId, file) => personId + '\u001f' + file;
  const imageTypes = /\.(jpe?g|png|webp|gif|avif)$/i;

  function updatePersonUI(personId, item) {
    const p = data.people[personId];
    const previous = getMedia(p);
    media.set(personId, {...previous, ...item});
    for (const node of document.querySelectorAll('[data-person]')) {
      if (node.dataset.person !== personId) continue;
      if (previous.profile !== item.profile) {
        const portrait = node.querySelector('.portrait');
        if (portrait) portrait.outerHTML = portraitHTML(p);
      }
      const name = node.querySelector('.person-name');
      if (name) name.innerHTML = safe(nameOf(p)) + (p.deceased ? ' <span class="memorial-inline">ז״ל</span>' : '');
      const strong = node.querySelector('strong');
      if (strong) strong.innerHTML = safe(nameOf(p)) + (p.deceased ? ' <span class="memorial-inline">ז״ל</span>' : '');
      const birthday = node.closest('[data-person-card]')?.querySelector('[data-birthday-for]');
      const signature=[birthdayOf(p),getMedia(p).invalidBirthday,p.deceased,new Date().toDateString()].join('|');
      if (birthday && birthday.dataset.dateSignature !== signature) {birthday.innerHTML=birthdayHTML(p);birthday.dataset.dateSignature=signature;}
      node.setAttribute('aria-label', 'פתיחת הגלריה של ' + nameOf(p));
    }
    if (state.currentPerson === personId && $('personDialog').open) {
      $('galleryTitle').textContent = 'הגלריה של ' + nameOf(p);
      const profileDate=$('profileBirthday'),signature=[birthdayOf(p),getMedia(p).invalidBirthday,p.deceased,new Date().toDateString()].join('|');
      if(profileDate && profileDate.dataset.dateSignature!==signature){profileDate.innerHTML=birthdayHTML(p);profileDate.dataset.dateSignature=signature;}
    }
  }

  function openPerson(personId) {
    if (!data.people[personId]) return;
    flushDrafts();
    state.currentPerson = personId;
    state.gallery = [];
    galleryRevision = null;
    gallerySignature = '';
    const p = data.people[personId];
    $('personBody').innerHTML = `<header class="gallery-header"><div><h2 id="galleryTitle">הגלריה של ${safe(nameOf(p))}</h2><div class="profile-birthday" id="profileBirthday">${birthdayHTML(p)}</div><span id="galleryCount" class="gallery-count"></span></div></header><section class="photo-dropzone${apiEnabled ? '' : ' offline'}" id="photoDropzone" aria-label="אזור להעלאת תמונות"><svg viewBox="0 0 40 40" aria-hidden="true"><path d="M7 27v7h26v-7M20 28V6m-8 8 8-8 8 8"/></svg><button class="primary-button upload-photos" id="uploadPhotos" ${apiEnabled ? '' : 'disabled'}>הוספת תמונות</button><button class="secondary-button mobile-camera" id="capturePersonPhoto" ${apiEnabled ? '' : 'disabled'}>צילום תמונה</button><span>בחרו תמונות מהגלריה או מהמצלמה<span class="desktop-paste"> · אפשר לגרור לכאן או להדביק צילום עם <bdi>Ctrl+V</bdi></span></span></section><div id="uploadState" class="upload-state" role="status"></div><div class="photo-gallery-grid" id="galleryGrid"></div><div class="gallery-empty-state" id="galleryEmpty" ${apiEnabled ? 'hidden' : ''}>${apiEnabled ? 'אין עדיין תמונות בגלריה' : 'השמירה אינה זמינה כרגע'}</div>`;
    if (!$('personDialog').open) $('personDialog').showModal();
    $('personDialog').scrollTop = 0;
    const cached = getMedia(p);
    if (Array.isArray(cached.gallery)) renderGallery(cached);
    if (apiEnabled) refreshOpenGallery(true);
  }

  function draftStatus(personId, file, text, failed=false) {
    if (state.currentPerson !== personId || !$('personDialog').open) return;
    const area = Array.from($('galleryGrid').querySelectorAll('textarea')).find(el => el.dataset.captionFile === file);
    if (!area) return;
    const status = area.closest('.gallery-photo').querySelector('[data-caption-status]');
    status.textContent = text;
    status.classList.toggle('save-error', failed);
  }

  function renderGallery(item) {
    if (!Array.isArray(item.gallery)) return;
    const personId = state.currentPerson;
    state.gallery = item.gallery;
    const photoCount = item.gallery.length;
    $('galleryCount').textContent = photoCount === 1 ? 'תמונה אחת' : photoCount ? `${photoCount} תמונות` : '';
    $('galleryEmpty').hidden = photoCount > 0;
    $('galleryEmpty').textContent = 'אין עדיין תמונות בגלריה';
    const signature = item.gallery.map(p => p.file + '|' + p.src).join('\u0000') + '|' + (item.profileFile || '') + '|' + Boolean(item.profileIsManual);
    if (signature !== gallerySignature) {
      const active = document.activeElement;
      const focusedFile = active?.dataset?.captionFile;
      const selection = focusedFile ? [active.selectionStart, active.selectionEnd] : null;
      $('galleryGrid').innerHTML = item.gallery.map(photo => {
        const draft = drafts.get(keyFor(personId, photo.file));
        const caption = draft?.dirty ? draft.value : photo.caption;
        const isProfile = item.profileIsManual && item.profileFile === photo.file;
        return `<article class="gallery-photo"><button class="gallery-image" data-open-photo="${safe(photo.file)}" aria-label="פתיחת התמונה ${safe(photo.name)}"><img src="${safe(photo.src)}" alt="${safe(caption || photo.name)}" loading="lazy"></button><div class="photo-actions"><button class="profile-select${isProfile ? ' is-profile' : ''}" data-set-profile="${safe(photo.file)}" data-owner="${personId}" aria-pressed="${Boolean(isProfile)}" ${isProfile ? 'disabled' : ''}>${isProfile ? '✓ תמונת הפרופיל' : 'קביעה כתמונת פרופיל'}</button></div><div class="caption-editor"><label class="visually-hidden" for="caption-${safe(personId)}-${safe(encodeURIComponent(photo.file))}">כיתוב לתמונה ${safe(photo.name)}</label><textarea id="caption-${safe(personId)}-${safe(encodeURIComponent(photo.file))}" data-caption-file="${safe(photo.file)}" data-owner="${personId}" rows="2" maxlength="5000" placeholder="מי בתמונה? איפה ומתי? כתבו כאן…" ${apiEnabled ? '' : 'disabled'}>${safe(caption || '')}</textarea><div class="caption-toolbar"><span data-caption-status role="status">${draft?.dirty ? 'ממתין לשמירה…' : ''}</span><button data-save-caption="${safe(photo.file)}" data-owner="${personId}">שמירה</button></div></div></article>`;
      }).join('');
      gallerySignature = signature;
      if (focusedFile) {
        const area = Array.from($('galleryGrid').querySelectorAll('textarea')).find(el => el.dataset.captionFile === focusedFile);
        if (area) {area.focus({preventScroll:true});area.setSelectionRange(...selection);}
      }
    } else {
      for (const area of $('galleryGrid').querySelectorAll('textarea')) {
        const draft = drafts.get(keyFor(personId, area.dataset.captionFile));
        if (draft?.dirty || document.activeElement === area) continue;
        const photo = item.gallery.find(p => p.file === area.dataset.captionFile);
        if (photo && area.value !== photo.caption) area.value = photo.caption;
      }
    }
    galleryRevision = item.revision;
    if ($('lightbox').open) {
      const previousFile = $('lightboxImage').dataset.file;
      const index = state.gallery.findIndex(p => p.file === previousFile);
      if (index >= 0) openPhoto(index); else $('lightbox').close();
    }
  }

  async function refreshOpenGallery(force=false) {
    if (!apiEnabled || !$('personDialog').open || galleryLoading) return;
    const personId = state.currentPerson;
    galleryLoading = true;
    try {
      const headers = !force && galleryRevision ? {'If-None-Match':'"' + galleryRevision + '"'} : {};
      const response = await fetch('api/people/' + encodeURIComponent(personId), {headers, cache:'no-store'});
      if (response.status === 304) return;
      const result = await response.json();
      if (!response.ok) throw Error(result.error || 'לא ניתן לפתוח את הגלריה.');
      updatePersonUI(personId, result);
      if (personId === state.currentPerson && $('personDialog').open) renderGallery(result);
    } catch(error) {
      if (force && personId === state.currentPerson && $('personDialog').open) toast(error.message || 'לא ניתן לקרוא את הגלריה כרגע.');
    } finally {galleryLoading = false;}
  }

  async function chooseProfilePhoto(personId, file) {
    if (!apiEnabled) return;
    try {
      const response = await fetch('api/people/' + encodeURIComponent(personId) + '/profile', {
        method:'POST', headers:{'Content-Type':'application/json','X-Family-Token':window.FAMILY_API_TOKEN},
        body:JSON.stringify({file})
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || 'תמונת הפרופיל לא נשמרה.');
      updatePersonUI(personId, result.person);
      if (state.currentPerson === personId && $('personDialog').open) renderGallery(result.person);
      toast('תמונת הפרופיל של ' + nameOf(data.people[personId]) + ' עודכנה');
    } catch(error) {toast(error.message || 'לא ניתן לשמור את תמונת הפרופיל כרגע.');}
  }

  function editCaption(area) {
    const personId = area.dataset.owner, file = area.dataset.captionFile;
    const key = keyFor(personId, file);
    const draft = drafts.get(key) || {personId, file, saving:false};
    clearTimeout(draft.timer);
    draft.value = area.value;
    draft.dirty = true;
    draft.timer = setTimeout(() => saveCaption(key), 850);
    drafts.set(key, draft);
    draftStatus(personId, file, 'ממתין לשמירה…');
  }

  async function saveCaption(key) {
    const draft = drafts.get(key);
    if (!draft || !draft.dirty || draft.saving || !apiEnabled) return;
    clearTimeout(draft.timer);
    draft.saving = true;
    const text = draft.value;
    draftStatus(draft.personId, draft.file, 'שומר…');
    try {
      const response = await fetch('api/people/' + encodeURIComponent(draft.personId) + '/caption', {
        method:'POST', headers:{'Content-Type':'application/json','X-Family-Token':window.FAMILY_API_TOKEN},
        body:JSON.stringify({file:draft.file,caption:text}), keepalive:true
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || 'הכיתוב לא נשמר.');
      if (draft.value === text) {draft.dirty = false;draftStatus(draft.personId,draft.file,'נשמר ✓');}
      else draft.timer = setTimeout(() => saveCaption(key), 150);
    } catch(error) {
      draftStatus(draft.personId,draft.file,'לא נשמר · לחצו על שמירה',true);
      toast(error.message || 'הכיתוב לא נשמר. נסו שוב.');
    } finally {draft.saving = false;}
  }

  function flushDrafts() {
    for (const [key,draft] of drafts) {
      if (draft.dirty) {clearTimeout(draft.timer);saveCaption(key);}
    }
  }

  function openPhoto(index) {
    if (!state.gallery.length) return;
    state.photoIndex = (index + state.gallery.length) % state.gallery.length;
    const photo = state.gallery[state.photoIndex];
    $('lightboxImage').src = photo.src;
    $('lightboxImage').alt = photo.caption || photo.name;
    $('lightboxImage').dataset.file = photo.file;
    $('lightboxCaption').textContent = photo.caption || '';
    $('lightboxCounter').textContent = `${state.photoIndex + 1} / ${state.gallery.length}`;
    $('previousPhoto').hidden = $('nextPhoto').hidden = state.gallery.length < 2;
    if (!$('lightbox').open) $('lightbox').showModal();
  }

  function showSearch() {
    const query=normalize(state.query);
    if(!['tree','directory'].includes(state.view)){window.FamilyPortal?.search(state.query);window.FamilyArchive?.search(state.query);$('searchResults').hidden=true;return;}
    if(state.view==='directory'){renderDirectory();$('searchResults').hidden=true;return;}
    if(!query){$('searchResults').hidden=true;return;}
    const matches=people.filter(p=>normalize(nameOf(p)).includes(query));
    $('searchResults').innerHTML=matches.length?matches.slice(0,15).map(p=>`<button class="search-result" data-search-person="${p.id}"><span>${safe(nameOf(p))}${p.deceased?' ז״ל':''}</span><small>${safe(branchTitle(p))}</small></button>`).join(''):'<div class="search-empty">לא נמצא שם מתאים</div>';
    $('searchResults').hidden=false;
  }

  async function loadFamilyMedia() {
    if (!apiEnabled || mediaLoading) return;
    mediaLoading = true;
    try {
      const response = await fetch('api/media', {cache:'no-store'});
      if (!response.ok) throw Error('connection');
      const result = await response.json();
      Object.entries(result.people).forEach(([personId,item])=>updatePersonUI(personId,item));
      $('runtimeNotice').hidden = true;
    } catch(error) {
      $('runtimeNotice').textContent = 'החיבור לשמירה אינו זמין כרגע. נסו לרענן את הדף.';
      $('runtimeNotice').hidden = false;
    } finally {mediaLoading = false;}
  }

  function addUploads(files, fromClipboard=false) {
    if (!apiEnabled) {toast('ההעלאה אינה זמינה כרגע. נסו לרענן את הדף.');return;}
    if (!state.currentPerson || !$('personDialog').open) return;
    const selected = Array.from(files).filter(file => /^image\/(jpeg|png|webp|gif|avif)$/i.test(file.type) || imageTypes.test(file.name));
    if (!selected.length) {toast('בחרו תמונת JPG, PNG, WEBP, GIF או AVIF.');return;}
    if (selected.length < files.length) toast('חלק מהקבצים אינם בפורמט נתמך. יתר התמונות יישמרו.');
    uploads.push({personId:state.currentPerson,files:selected,clipboard:fromClipboard});
    runUploads();
  }

  async function runUploads() {
    if (uploadRunning) return;
    uploadRunning = true;
    while (uploads.length) {
      const batch = uploads.shift();
      let saved = 0;
      for (let i=0;i<batch.files.length;i++) {
        const file = batch.files[i];
        if (state.currentPerson === batch.personId && $('personDialog').open) {
          $('uploadState').textContent = `מעלה תמונה ${i+1} מתוך ${batch.files.length}…`;
          $('photoDropzone').classList.add('uploading');
        }
        try {
          if (file.size > 50*1024*1024) throw Error('אפשר להעלות עד 50MB לתמונה.');
          const date = new Date().toISOString().replace(/[:.]/g,'-');
          const filename = batch.clipboard ? 'צילום_מסך_' + date + '.png' : file.name;
          const response = await fetch('api/people/' + encodeURIComponent(batch.personId) + '/photos?filename=' + encodeURIComponent(filename), {
            method:'POST',headers:{'Content-Type':file.type || 'application/octet-stream','X-Family-Token':window.FAMILY_API_TOKEN},body:file
          });
          const result = await response.json();
          if (!response.ok) throw Error(result.error || 'התמונה לא נשמרה.');
          saved++;
          updatePersonUI(batch.personId,result.person);
          if (state.currentPerson === batch.personId && $('personDialog').open) renderGallery(result.person);
        } catch(error) {toast((file.name ? file.name + ': ' : '') + (error.message || 'התמונה לא נשמרה.'));}
      }
      if (state.currentPerson === batch.personId && $('personDialog').open) {
        $('photoDropzone').classList.remove('uploading');
        $('uploadState').textContent = saved === 1 ? 'התמונה נוספה לאלבום ✓' : saved ? `${saved} תמונות נוספו לאלבום ✓` : 'לא נשמרו תמונות. אפשר לנסות שוב.';
      }
    }
    uploadRunning = false;
  }

  document.addEventListener('click',event=>{
    const person=event.target.closest('[data-person]');if(person){openPerson(person.dataset.person);return;}
    const branch=event.target.closest('[data-branch]');if(branch){selectBranch(branch.dataset.branch);return;}
    const openBranch=event.target.closest('[data-open-branch]');if(openBranch){selectBranch(openBranch.dataset.openBranch);return;}
    const view=event.target.closest('[data-view]');if(view){setView(view.dataset.view);return;}
    const search=event.target.closest('[data-search-person]');if(search){$('searchResults').hidden=true;openPerson(search.dataset.searchPerson);return;}
    const photo=event.target.closest('[data-open-photo]');if(photo){openPhoto(state.gallery.findIndex(p=>p.file===photo.dataset.openPhoto));return;}
    const profile=event.target.closest('[data-set-profile]');if(profile){chooseProfilePhoto(profile.dataset.owner,profile.dataset.setProfile);return;}
    const save=event.target.closest('[data-save-caption]');if(save){saveCaption(keyFor(save.dataset.owner,save.dataset.saveCaption));return;}
    if(event.target.closest('#uploadPhotos')){$('photoUploadInput').value='';$('photoUploadInput').click();return;}
    if(!event.target.closest('.search-wrap'))$('searchResults').hidden=true;
  });
  document.addEventListener('input',event=>{if(event.target.matches('textarea[data-caption-file]'))editCaption(event.target);});
  document.addEventListener('focusout',event=>{if(event.target.matches('textarea[data-caption-file]'))saveCaption(keyFor(event.target.dataset.owner,event.target.dataset.captionFile));});
  document.addEventListener('paste',event=>{
    if (!$('personDialog').open) {if(!window.FamilyArchive?.acceptPaste(event))window.FamilyPortal?.acceptPaste(event);return;}
    if ($('lightbox').open) return;
    const files=Array.from(event.clipboardData?.items || []).filter(item=>item.kind==='file'&&item.type.startsWith('image/')).map(item=>item.getAsFile()).filter(Boolean);
    if(files.length){event.preventDefault();addUploads(files,true);}
  });
  document.addEventListener('dragover',event=>{
    if(Array.from(event.dataTransfer?.types || []).includes('Files')){
      event.preventDefault();
      if($('personDialog').open&&!$('lightbox').open)$('photoDropzone').classList.add('drag-over');
      else {window.FamilyPortal?.dragOver(event);window.FamilyArchive?.dragOver(event);}
    }
  });
  $('personDialog').addEventListener('dragleave',event=>{if(!event.relatedTarget||!$('personDialog').contains(event.relatedTarget))$('photoDropzone')?.classList.remove('drag-over');});
  document.addEventListener('drop',event=>{
    if(!event.dataTransfer?.files.length)return;
    event.preventDefault();
    if($('personDialog').open&&!$('lightbox').open){$('photoDropzone').classList.remove('drag-over');addUploads(event.dataTransfer.files);}
    else if (!window.FamilyArchive?.acceptDrop(event)&&!window.FamilyPortal?.acceptDrop(event)) toast('פתחו גלריה שאליה תרצו להוסיף את התמונות.');
  });
  $('photoUploadInput').addEventListener('change',()=>{if($('photoUploadInput').files.length)addUploads($('photoUploadInput').files);});
  $('personCameraInput').addEventListener('change',()=>{if($('personCameraInput').files.length)addUploads($('personCameraInput').files);});
  document.addEventListener('click',event=>{if(event.target.closest('#capturePersonPhoto')){$('personCameraInput').value='';$('personCameraInput').click();}});
  document.addEventListener('error',event=>{if(event.target.matches('img.profile-photo'))event.target.hidden=true;},true);
  $('closePerson').addEventListener('click',()=>$('personDialog').close());
  $('personDialog').addEventListener('close',flushDrafts);
  $('closeLightbox').addEventListener('click',()=>$('lightbox').close());
  $('previousPhoto').addEventListener('click',()=>openPhoto(state.photoIndex-1));
  $('nextPhoto').addEventListener('click',()=>openPhoto(state.photoIndex+1));
  $('searchInput').addEventListener('input',()=>{state.query=$('searchInput').value;showSearch();});
  $('searchInput').addEventListener('focus',()=>{if(state.query)showSearch();});
  $('searchInput').addEventListener('keydown',e=>{if(e.key==='Escape')$('searchResults').hidden=true;if(e.key==='Enter'){const first=$('searchResults').querySelector('[data-search-person]');if(first&&!$('searchResults').hidden)first.click();}});
  $('homeLink').addEventListener('click',e=>{e.preventDefault();state.branch='all';state.mode='overview';state.query='';$('searchInput').value='';renderBranches();setView('tree');});
  $('overviewButton').addEventListener('click',()=>{state.branch='all';state.mode='overview';renderBranches();renderTree();});
  $('fullTreeButton').addEventListener('click',()=>{state.mode=state.branch==='all'?'full':'branch';renderTree();});
  $('zoomIn').addEventListener('click',()=>zoom(1.2));$('zoomOut').addEventListener('click',()=>zoom(1/1.2));$('fitButton').addEventListener('click',fitTree);
  document.addEventListener('keydown',e=>{if($('lightbox').open){if(e.key==='ArrowRight')openPhoto(state.photoIndex+1);if(e.key==='ArrowLeft')openPhoto(state.photoIndex-1);}});
  $('personDialog').addEventListener('click',e=>{if(e.target===$('personDialog')){const r=$('personDialog').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('personDialog').close();}});
  window.addEventListener('pagehide',flushDrafts);

  const viewport=$('treeViewport');let drag=null;
  const touches=new Map();let pinch=null;
  viewport.addEventListener('pointerdown',e=>{
    if(e.pointerType==='touch'){
      touches.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(touches.size===2){
        const [a,b]=[...touches.values()],r=viewport.getBoundingClientRect();
        pinch={distance:Math.hypot(a.x-b.x,a.y-b.y),scale:camera.scale,x:(a.x+b.x)/2-r.left,y:(a.y+b.y)/2-r.top,cameraX:camera.x,cameraY:camera.y};
        drag=null;viewport.setPointerCapture(e.pointerId);return;
      }
    }
    if(e.target.closest('button')||e.button>0)return;
    drag={id:e.pointerId,startX:e.clientX,startY:e.clientY,x:camera.x,y:camera.y};viewport.setPointerCapture(e.pointerId);viewport.classList.add('dragging');
  });
  viewport.addEventListener('pointermove',e=>{
    if(touches.has(e.pointerId))touches.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pinch&&touches.size===2){const[a,b]=[...touches.values()],r=viewport.getBoundingClientRect(),scale=Math.max(.08,Math.min(2.4,pinch.scale*Math.hypot(a.x-b.x,a.y-b.y)/Math.max(1,pinch.distance)));camera.x=(a.x+b.x)/2-r.left-(pinch.x-pinch.cameraX)*scale/pinch.scale;camera.y=(a.y+b.y)/2-r.top-(pinch.y-pinch.cameraY)*scale/pinch.scale;camera.scale=scale;applyCamera();return;}
    if(drag&&e.pointerId===drag.id){camera.x=drag.x+e.clientX-drag.startX;camera.y=drag.y+e.clientY-drag.startY;applyCamera();}
  });
  const endDrag=e=>{touches.delete(e.pointerId);pinch=null;drag=null;viewport.classList.remove('dragging');};viewport.addEventListener('pointerup',endDrag);viewport.addEventListener('pointercancel',endDrag);
  viewport.addEventListener('wheel',e=>{if(e.ctrlKey||e.metaKey){e.preventDefault();const r=viewport.getBoundingClientRect();zoom(e.deltaY<0?1.1:1/1.1,e.clientX-r.left,e.clientY-r.top);}}, {passive:false});
  viewport.addEventListener('keydown',e=>{
    if(e.target!==viewport)return;
    if(e.key==='+'||e.key==='='){e.preventDefault();zoom(1.2);}else if(e.key==='-'){e.preventDefault();zoom(1/1.2);}else if(e.key==='0'){e.preventDefault();fitTree();}
    else if(e.key.startsWith('Arrow')){e.preventDefault();if(e.key==='ArrowLeft')camera.x+=50;if(e.key==='ArrowRight')camera.x-=50;if(e.key==='ArrowUp')camera.y+=50;if(e.key==='ArrowDown')camera.y-=50;applyCamera();}
  });
  let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(state.view==='tree')renderTree();},150);});
  window.FamilyApp={setView,getView:()=>state.view,getPerson:id=>data.people[id],nameOf:id=>nameOf(data.people[id]),birthdayOf:id=>birthdayOf(data.people[id]),updatePerson:updatePersonUI,toast,apiEnabled,openSharedGallery:(items,index)=>{state.gallery=items;openPhoto(index);}};
  renderBranches();renderView();
  if(apiEnabled){
    loadFamilyMedia();
    setInterval(()=>{if(document.visibilityState!=='hidden')refreshOpenGallery();},10000);
    setInterval(()=>{if(document.visibilityState!=='hidden')loadFamilyMedia();},30000);
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){loadFamilyMedia();refreshOpenGallery(true);}});
  }else{
    $('runtimeNotice').textContent='החיבור לשמירה אינו זמין כרגע. נסו לרענן את הדף.';
    $('runtimeNotice').hidden=false;
  }
})();
