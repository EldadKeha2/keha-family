(() => {
  'use strict';
  const I18n=window.FamilyI18n;
  const data = window.FAMILY_DATA;
  const $ = id => document.getElementById(id);
  const people = Object.values(data.people);
  const media = new Map();
  const phoneQuery=matchMedia('(max-width:700px)'),isPhone=()=>phoneQuery.matches;
  const validViews=new Set(['home','tree','directory','gallery','calendar','videos','photos','stories','weddings','nostalgia','updates','memorial','person']);
  const requestedView=location.hash.slice(1).split('/')[0];
  const state = {view:validViews.has(requestedView)?(requestedView==='home'&&!isPhone()?'tree':requestedView):(isPhone()?'home':'tree'), branch:'all', mode:'overview', query:'', currentPerson:null, galleryFilter:'all', gallery:[], photoIndex:0, urls:[]};
  const camera = {x:0,y:0,scale:1,width:0,height:0};
  let motionFrame=0,suppressClickUntil=0;
  const branchFor = id => data.branches.find(b => b.id === id);
  const getMedia = p => media.get(p.id) || {};
  const nameOf = p => I18n.personName({...p,...getMedia(p)});
  const birthdayOf = p => getMedia(p).birthday || p.birthday;
  const isPlaceholder = p => p.placeholder && (getMedia(p).name||p.name) === p.name;
  const branchTitle = p => p.extra?I18n.t('שם נוסף באלבומים'):I18n.branchName(branchFor(p.branch)) || I18n.t('השורשים של כולנו');
  const generationName = n => ['',I18n.t('הדור הראשון'),I18n.t('הדור השני'),I18n.t('הדור השלישי'),I18n.t('הדור הרביעי'),I18n.t('הדור החמישי')][n] || I18n.html`דור ${n}`;
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
    const aliyah=p.aliyahMonth?new Intl.DateTimeFormat(I18n.locale,{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(p.aliyahYear,p.aliyahMonth-1,1))):p.aliyahYear;
    const deathEdit=p.deceased?`<button class="birthday-edit" data-edit-death="${p.id}" aria-label="${safe(I18n.t('עדכון תאריך פטירה'))}" title="${safe(I18n.t('עדכון תאריך פטירה'))}">🕯 ✎</button>`:'';
    if(p.extra)return I18n.t('<span class="directory-branch">אלבום מתמונות וסרטונים שתויגו</span>');
    const invalid = getMedia(p).invalidBirthday;
    const value = birthdayOf(p), death = p.deathDate ? window.FamilyDates.parse(p.deathDate) : null;
    const age = invalid ? null : p.deceased ? death ? window.FamilyDates.age(value,death.date) : null : window.FamilyDates.age(value);
    const unknown = value === '1.1.1111';
    if(I18n.isEnglish)return `<span class="birthday-line"><bdi>${safe(invalid?'Date needs checking':unknown?'Not added yet':I18n.date(value))}</bdi><button class="birthday-edit" data-edit-birthday="${p.id}" aria-label="Edit the birthday of ${safe(nameOf(p))}" title="Edit birthday">✎</button></span>${age!==null?`<span class="person-age">(${p.deceased?`aged ${age} at death`:age})</span>`:''}${death?`<span class="person-death-date">Died on <bdi>${safe(I18n.date(p.deathDate))}</bdi></span>`:''}${deathEdit}${p.aliyahYear?`<span class="person-aliyah-year">Moved to Israel in <bdi>${safe(aliyah)}</bdi></span>`:''}`;
    return I18n.html`<span class="birthday-line"><bdi>${safe(invalid ? I18n.t('תאריך לבדיקה') : unknown ? I18n.t('טרם הוזן') : I18n.date(value))}</bdi><button class="birthday-edit" data-edit-birthday="${p.id}" aria-label="עריכת יום ההולדת של ${safe(nameOf(p))}" title="עריכת יום הולדת"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15Z"/></svg></button></span>${age !== null ? `<span class="person-age" aria-label="${p.deceased?I18n.t('גיל בפטירה'):I18n.t('גיל')} ${age}">${p.deceased?I18n.html`(${p.gender==='f'?I18n.t('בת'):I18n.t('בן')} ${age} בפטירת${p.gender==='f'?I18n.t('ה'):I18n.t('ו')})`:`(${age})`}</span>` : ''}${death?I18n.html`<span class="person-death-date">${p.gender==='f'?I18n.t('נפטרה'):I18n.t('נפטר')} ב־<bdi>${safe(I18n.date(p.deathDate))}</bdi></span>`:''}${deathEdit}${p.aliyahYear?I18n.html`<span class="person-aliyah-year">${p.gender==='f'?I18n.t('עלתה'):I18n.t('עלה')} לארץ ב־<bdi>${safe(aliyah)}</bdi></span>`:''}`;
  }
  function personCardHTML(p) {
    const unset = birthdayOf(p) === '1.1.1111';
    return I18n.html`<article class="person-card${p.deceased?' memorial':''}${isPlaceholder(p)?' placeholder-person':''}" data-person-card="${p.id}"><button class="person-open" data-person="${p.id}" aria-label="פתיחת הגלריה של ${safe(nameOf(p))}">${portraitHTML(p)}<span class="person-name${nameOf(p).length>17?' long-name':''}">${safe(nameOf(p))}${p.deceased?I18n.t(' <span class="memorial-inline">ז״ל</span>'):''}</span></button><div class="person-birthday${unset?' birthday-unset':''}" data-birthday-for="${p.id}">${birthdayHTML(p)}</div></article>`;
  }
  function toast(message,action) {
    clearTimeout(toastTimer); $('toast').textContent = message; $('toast').hidden = false;
    if(action){const button=document.createElement('button');button.textContent=action.label;button.addEventListener('click',action.run);$('toast').append(button);}
    toastTimer = setTimeout(() => {$('toast').hidden = true;}, action?20000:6000);
  }
  function renderBranches() {
    $('branchBar').innerHTML = I18n.html`<button class="branch-chip all-chip${state.branch==='all'?' active':''}" data-branch="all" aria-pressed="${state.branch==='all'}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v6M5 15V9h14v6M12 9v6"/><circle cx="5" cy="18" r="2"/><circle cx="12" cy="18" r="2"/><circle cx="19" cy="18" r="2"/></svg> כל המשפחה</button>` + data.branches.map(b => `<button class="branch-chip${state.branch===b.id?' active':''}" data-branch="${b.id}" style="--branch-color:${b.color}" aria-pressed="${state.branch===b.id}"><span class="chip-dot"></span>${safe(I18n.branchName(b))}</button>`).join('');
  }
  function selectBranch(id) {
    state.branch = id;
    if (id !== 'all') state.mode = 'branch';
    else state.mode = 'overview';
    renderBranches(); renderView();
  }
  function setView(view,syncRoute=true) {
    if(!validViews.has(view))return;if(view==='home'&&!isPhone())view='tree';
    const previous = state.view;
    stopTreeMotion();
    if(syncRoute){const target=view==='weddings'&&location.hash.startsWith('#weddings')?location.hash:'#'+view;if(location.hash!==target)history.pushState(null,'',target);}
    if($('mobileNavDialog').open)$('mobileNavDialog').close();
    state.view = view;
    if (previous !== view) {state.query='';$('searchInput').value='';}
    document.querySelectorAll('[data-view]').forEach(el => {el.classList.toggle('active',el.dataset.view === view);el.setAttribute('aria-pressed',String(el.dataset.view === view));});
    $('searchResults').hidden = true;
    renderView();
    if(previous!==view&&isPhone())window.scrollTo({top:0,behavior:'instant'});
  }
  function renderView() {
    document.body.dataset.activeView=state.view;
    const isTree = state.view === 'tree';
    const isDirectory = state.view === 'directory';
    const global = !isTree && !isDirectory;
    $('treeView').hidden = !isTree;
    $('directoryView').hidden = !isDirectory;
    $('branchBar').hidden = global;
    const titles = {memorial:[I18n.t('לזכרם'),I18n.t('הזיכרונות נשארים איתנו')],person:[I18n.t('עמוד אישי'),I18n.t('סיפור חיים, תמונות וזיכרונות')],updates:[I18n.t('עדכונים'),I18n.t('תזכורות משפחתיות, ישר למייל')],home:[I18n.t('הבית שלנו'),I18n.t('כל המשפחה, במקום אחד')],gallery:[I18n.t('הגלריה המשפחתית'),I18n.t('תמונות, אנשים ורגעים ששומרים יחד')],calendar:[I18n.t('לוח שנה משפחתי'),I18n.t('ימי הולדת, חגים ומועדים בלוח עברי ולועזי')],tree:[I18n.t('האילן המשפחתי'),I18n.t('משורש משותף, שישה ענפים של אהבה')],directory:[I18n.t('כל בני המשפחה'),I18n.t('האלבומים וימי ההולדת של כולנו')],videos:[I18n.t('סרטוני המשפחה'),I18n.t('הקולות, הצחוק והרגעים שנשארים איתנו')],photos:[I18n.t('תמונות משפחתיות'),I18n.t('אלבום אחד, אינספור זיכרונות משותפים')],stories:[I18n.t('הסיפורים שלנו'),I18n.t('יומן משפחתי, מהעבר ועד היום')],weddings:[I18n.t('החתונות שלנו'),I18n.t('סיפורי האהבה, הברכות והרגעים מהיום המיוחד')],nostalgia:[I18n.t('פינת הנוסטלגיה'),I18n.t('תמונות, סרטים ומכתבים שמחזירים אותנו הביתה')]};
    const [title,subtitle] = titles[state.view] || titles.tree;
    $('workspaceTitle').textContent = title;
    $('mobileViewTitle').textContent=title;
    $('workspaceSubtitle').textContent = subtitle;
    $('searchInput').placeholder = global ? state.view==='stories'?I18n.t('חיפוש בסיפורים ובשנים'):I18n.t('חיפוש לפי כיתוב, שם קובץ או אדם') : I18n.t('חיפוש בן או בת משפחה');
    $('searchInput').setAttribute('aria-label', global?I18n.t('חיפוש בתוכן המשפחתי'):I18n.t('חיפוש בני משפחה'));
    window.FamilyPortal?.activate(state.view);
    window.FamilyArchive?.activate(state.view);
    window.FamilyCalendar?.activate(state.view);
    window.FamilyHome?.activate(state.view);
    window.FamilyUpdates?.activate(state.view);
    window.FamilyPeople?.activate(state.view);
    window.FamilyMemorial?.activate(state.view);
    if (isTree) renderTree(); else if (isDirectory) renderDirectory();
  }
  function renderDirectory() {
    const query = normalize(state.query);
    const selected = people.filter(p => (state.branch === 'all' || p.branch === state.branch) && (!query || normalize(I18n.searchNames({...p,...getMedia(p)})).includes(query)));
    $('directoryCount').textContent = I18n.html`${selected.length} ${I18n.isEnglish?I18n.word(selected.length,'card','cards'):I18n.t('כרטיסים')}${state.branch!=='all'?' · '+I18n.branchName(branchFor(state.branch)):''}`;
    $('directoryGrid').innerHTML = selected.map(p=>I18n.html`<article class="directory-card${p.deceased?' memorial':''}" data-person-card="${p.id}"><button class="directory-open" data-person="${p.id}" aria-label="פתיחת האלבום של ${safe(nameOf(p))}">${portraitHTML(p)}<strong>${safe(nameOf(p))}${p.deceased?I18n.t(' <span class="memorial-inline">ז״ל</span>'):''}</strong><span class="directory-branch">${safe(branchTitle(p))}</span></button><div class="directory-date" data-birthday-for="${p.id}">${birthdayHTML(p)}</div></article>`).join('');
    $('emptySearch').hidden = selected.length > 0;
  }

  function renderTree() {
    const phone=isPhone(),overview=state.branch==='all'&&state.mode==='overview';
    const rootId=state.branch==='all'?data.root:branchFor(state.branch).unit;
    const rootHistorySpace=!phone&&data.units[rootId].people.some(id=>data.people[id].aliyahYear)?40:0;
    const gap=phone?20:36,levelHeight=phone?195:340,top=phone?40:70,pad=phone?25:48;
    const positions=[],lines=[],widths=new Map();
    const children=unit=>overview&&unit.id!==data.root?[]:unit.children;
    const nodeWidth=unit=>unit.people.length===2?(phone?174:320):(phone?80:146);
    function measure(id){const unit=data.units[id],kids=children(unit),total=kids.reduce((sum,child)=>sum+measure(child),0)+Math.max(0,kids.length-1)*gap,width=Math.max(nodeWidth(unit),total);widths.set(id,width);return width;}
    function place(id,left,depth){
      const unit=data.units[id],width=widths.get(id),x=left+width/2,y=top+depth*levelHeight+(depth?rootHistorySpace:0);
      positions.push({id,unit,x,y,width:nodeWidth(unit),depth});const kids=children(unit),total=kids.reduce((sum,child)=>sum+widths.get(child),0)+Math.max(0,kids.length-1)*gap;let right=left+width-(width-total)/2;const centers=[];
      for(const child of kids){const w=widths.get(child);centers.push(right-w/2);place(child,right-w,depth+1);right-=w+gap;}
      if(kids.length){const extra=depth===0?rootHistorySpace:0,start=y+(phone?115:261)+extra,middle=y+(phone?155:294)+extra,end=y+levelHeight-7+extra;lines.push(`<path d="M${x} ${start}V${middle}"/><circle class="connector-start" cx="${x}" cy="${start}" r="2.5"/>`);if(kids.length>1)lines.push(`<path d="M${Math.min(...centers)} ${middle}H${Math.max(...centers)}"/>`);for(const cx of centers)lines.push(`<path d="M${cx} ${middle}V${end}"/>`);}
    }
    let width,height;
    if(phone&&overview){
      width=520;height=740;const root=data.units[data.root];positions.push({id:root.id,unit:root,x:260,y:45,width:174,depth:0});lines.push('<path d="M260 158V530"/>');
      data.branches.forEach((branch,index)=>{const x=index%2===0?380:140,y=220+Math.floor(index/2)*170,unit=data.units[branch.unit];positions.push({id:unit.id,unit,x,y,width:174,depth:1});lines.push(`<path d="M260 ${y-30}H${x}V${y-10}"/>`);});
    }else{width=measure(rootId)+2*pad;place(rootId,pad,0);const maxDepth=Math.max(...positions.map(item=>item.depth));height=top+maxDepth*levelHeight+(maxDepth?rootHistorySpace:0)+(phone?150:overview?316:278)+30;}
    camera.width=width;camera.height=height;const world=$('treeWorld');$('treeViewport').dataset.overview=String(overview);world.style.width=width+'px';world.style.height=height+'px';
    $('treeConnectors').setAttribute('width',width);$('treeConnectors').setAttribute('height',height);$('treeConnectors').innerHTML=lines.join('');
    $('treeNodes').innerHTML=positions.map(({unit,x,y,width:w,depth})=>{const branch=branchFor(unit.branch);let label='';if(unit.id===data.root)label=I18n.t('<span class="generation-label">כאן מתחיל הסיפור</span>');else if(depth===0||overview)label=`<span class="branch-label" style="--branch-color:${branch?.color||'#a2824c'}">${safe(I18n.branchName(branch)||'')}</span>`;const open=overview&&unit.id!==data.root?I18n.html`<button class="branch-open" data-open-branch="${unit.branch}" style="--branch-color:${branch.color}" aria-label="פתיחת ${safe(I18n.branchName(branch))}">${safe(I18n.branchName(branch))} <span class="branch-count">${people.filter(person=>person.branch===unit.branch&&!isPlaceholder(person)).length}</span>${arrow}</button>`:'';return `<div class="tree-unit${unit.people.length===2?' couple':''}" data-unit="${unit.id}" style="left:${x-w/2}px;top:${y}px;width:${w}px">${label}${unit.people.length===2?'<span class="union-diamond" aria-hidden="true"></span>':''}${unit.people.map(id=>personCardHTML(data.people[id])).join('')}${open}</div>`;}).join('');
    $('treeBreadcrumb').textContent=state.branch==='all'?(overview?I18n.t('כל המשפחה · ששת הענפים'):I18n.t('כל המשפחה · כל הדורות')):I18n.html`יונה ושלמה › ${I18n.branchName(branchFor(state.branch))}`;
    for(const [id,selected]of [['overviewButton',overview],['fullTreeButton',!overview]]){$(id).classList.toggle('selected',selected);$(id).setAttribute('aria-pressed',String(selected));}
    $('canvasHint').innerHTML=phone?I18n.t('<span aria-hidden="true">✧</span> צבטו להגדלה · גררו לטיול בענפים · לחצו על שם לפתיחת האלבום'):overview?I18n.t('<span aria-hidden="true">✧</span> גררו ימינה ושמאלה בין הענפים · לחצו על שם לפתיחת האלבום'):I18n.t('<span aria-hidden="true">✧</span> גררו את העץ כדי לטייל בין הדורות · + להתקרבות');
    requestAnimationFrame(()=>{if(state.view!=='tree')return;const viewport=$('treeViewport'),fit=Math.min((viewport.clientWidth-30)/width,(viewport.clientHeight-70)/height,1.06);camera.scale=phone?fit:Math.max(.9,Math.min(1.06,fit));camera.x=(viewport.clientWidth-width*camera.scale)/2;camera.y=phone?Math.max(12,(viewport.clientHeight-60-height*camera.scale)/2):overview?Math.max(15,(viewport.clientHeight-55-height*camera.scale)/2):25;applyCamera();});
  }
  function applyCamera(){
    $('treeWorld').style.transform=`translate(${camera.x}px,${camera.y}px) scale(${camera.scale})`;
    $('zoomValue').textContent=Math.round(camera.scale*100)+'%';
  }
  function stopTreeMotion(){if(motionFrame)cancelAnimationFrame(motionFrame);motionFrame=0;}
  function clampCamera(){
    if(!isPhone())return;const viewport=$('treeViewport'),w=camera.width*camera.scale,h=camera.height*camera.scale;
    camera.x=w<viewport.clientWidth-20?(viewport.clientWidth-w)/2:Math.max(viewport.clientWidth-w-65,Math.min(65,camera.x));
    camera.y=h<viewport.clientHeight-40?Math.max(10,(viewport.clientHeight-55-h)/2):Math.max(viewport.clientHeight-h-65,Math.min(65,camera.y));
  }
  function zoom(factor,cx,cy){
    stopTreeMotion();const viewport=$('treeViewport');cx=cx??viewport.clientWidth/2;cy=cy??viewport.clientHeight/2;
    const old=camera.scale;camera.scale=Math.max(isPhone() ? .035 : .08,Math.min(isPhone()?3.5:2.4,old*factor));camera.x=cx-(cx-camera.x)*camera.scale/old;camera.y=cy-(cy-camera.y)*camera.scale/old;clampCamera();applyCamera();
  }
  function fitTree(){stopTreeMotion();const viewport=$('treeViewport');camera.scale=Math.min((viewport.clientWidth-30)/camera.width,(viewport.clientHeight-75)/camera.height,1.1);camera.x=(viewport.clientWidth-camera.width*camera.scale)/2;camera.y=Math.max(12,(viewport.clientHeight-55-camera.height*camera.scale)/2);applyCamera();}

  const apiEnabled = window.LOCAL_FAMILY_SERVER === true;
  const drafts = new Map();
  const uploads = [];
  let uploadRunning = false;
  let galleryRevision = null;
  let gallerySignature = '';
  let galleryLoading = false;
  let mediaLoading = false;
  let mediaRevision=null,mediaLoadedAt=0,mediaDirty=false;
  const keyFor = (personId, file) => personId + '\u001f' + file;
  const imageTypes = /\.(jpe?g|png|webp|gif|avif)$/i;

  function updatePersonUI(personId, item) {
    let p = data.people[personId];
    if(!p&&item.extra){p={id:personId,name:item.name,firstName:item.name,lastName:'',extra:true,birthday:item.birthday||'1.1.1111',branch:null,generation:null,placeholder:false};data.people[personId]=p;people.push(p);if(state.view==='directory')renderDirectory();}
    if(!p)return;
    const previous = getMedia(p);
    media.set(personId, {...previous, ...item});
    if('deathDate' in item)p.deathDate=item.deathDate;
    if('deceased' in item)p.deceased=item.deceased;
    if('aliyahYear' in item)p.aliyahYear=item.aliyahYear;
    if('aliyahMonth' in item)p.aliyahMonth=item.aliyahMonth;
    if((previous.birthday||p.birthday)!==birthdayOf(p)||(previous.name||p.name)!==(item.name||p.name))window.dispatchEvent(new CustomEvent('family-person-changed',{detail:{id:personId}}));
    for (const node of document.querySelectorAll('[data-person]')) {
      if (node.dataset.person !== personId) continue;
      if (previous.profile !== item.profile) {
        const portrait = node.querySelector('.portrait');
        if (portrait) portrait.outerHTML = portraitHTML(p);
      }
      const name = node.querySelector('.person-name');
      if (name) name.innerHTML = safe(nameOf(p)) + (p.deceased ? I18n.t(' <span class="memorial-inline">ז״ל</span>') : '');
      const strong = node.querySelector('strong');
      if (strong) strong.innerHTML = safe(nameOf(p)) + (p.deceased ? I18n.t(' <span class="memorial-inline">ז״ל</span>') : '');
      const birthday = node.closest('[data-person-card]')?.querySelector('[data-birthday-for]');
      const signature=[birthdayOf(p),getMedia(p).invalidBirthday,p.deceased,p.deathDate,new Date().toDateString()].join('|');
      if (birthday && birthday.dataset.dateSignature !== signature) {birthday.innerHTML=birthdayHTML(p);birthday.dataset.dateSignature=signature;}
      node.setAttribute('aria-label', I18n.t('פתיחת הגלריה של ') + nameOf(p));
    }
    if (state.currentPerson === personId && $('personDialog').open) {
      $('galleryTitle').textContent = I18n.t('הגלריה של ') + nameOf(p);
      const profileDate=$('profileBirthday'),signature=[birthdayOf(p),getMedia(p).invalidBirthday,p.deceased,p.deathDate,new Date().toDateString()].join('|');
      if(profileDate && profileDate.dataset.dateSignature!==signature){profileDate.innerHTML=birthdayHTML(p);profileDate.dataset.dateSignature=signature;}
    }
  }

  function openPerson(personId) {
    if(window.FamilyPeople){window.FamilyPeople.open(personId);return;}
    if (!data.people[personId]) return;
    if($('calendarDayDialog').open)$('calendarDayDialog').close();
    flushDrafts();
    state.currentPerson = personId;
    state.galleryFilter = 'all';
    state.gallery = [];
    galleryRevision = null;
    gallerySignature = '';
    const p = data.people[personId];
    $('personBody').innerHTML = I18n.html`<header class="gallery-header"><div><h2 id="galleryTitle">הגלריה של ${safe(nameOf(p))}</h2><div class="profile-birthday" id="profileBirthday">${birthdayHTML(p)}</div><span id="galleryCount" class="gallery-count"></span></div></header><section class="photo-dropzone${apiEnabled ? '' : ' offline'}" id="photoDropzone" aria-label="אזור להעלאת תמונות"><svg viewBox="0 0 40 40" aria-hidden="true"><path d="M7 27v7h26v-7M20 28V6m-8 8 8-8 8 8"/></svg><button class="primary-button upload-photos" id="uploadPhotos" ${apiEnabled ? '' : 'disabled'}>הוספת תמונות</button><button class="secondary-button mobile-camera" id="capturePersonPhoto" ${apiEnabled ? '' : 'disabled'}>צילום תמונה</button><span>בחרו תמונות מהגלריה או מהמצלמה<span class="desktop-paste"> · אפשר לגרור לכאן או להדביק צילום עם <bdi>Ctrl+V</bdi></span></span></section><div id="uploadState" class="upload-state" role="status"></div><div class="archive-filters personal-gallery-filters" id="personalMediaFilters" aria-label="סינון האלבום האישי"><button data-person-media-filter="all" aria-pressed="true">הכול</button><button data-person-media-filter="photo" aria-pressed="false">תמונות</button><button data-person-media-filter="video" aria-pressed="false">סרטונים</button></div><div class="photo-gallery-grid" id="galleryGrid"></div><div class="gallery-empty-state" id="galleryEmpty" ${apiEnabled ? 'hidden' : ''}>${apiEnabled ? I18n.t('אין עדיין תמונות בגלריה') : I18n.t('השמירה אינה זמינה כרגע')}</div>`;
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
    const personId=state.currentPerson,scope='personal:'+personId,album=item;
    const items=item.gallery.filter(media=>state.galleryFilter==='all'||media.kind===state.galleryFilter);
    state.gallery=items;window.FamilyMedia.register(scope,items);
    const photoCount=item.photoCount??item.gallery.filter(media=>media.kind==='photo').length,videoCount=item.videoCount||0;
    $('galleryCount').textContent=[photoCount?(photoCount===1?I18n.t('תמונה אחת'):photoCount+I18n.t(' תמונות')):'',videoCount?(videoCount===1?I18n.t('סרטון אחד'):videoCount+I18n.t(' סרטונים')):''].filter(Boolean).join(' · ');
    $('galleryEmpty').hidden=items.length>0;
    $('galleryEmpty').textContent=item.gallery.length?I18n.t('אין פריטים בבחירה הזו. אפשר לבחור בסוג אחר.'):I18n.t('אין עדיין תמונות או סרטונים באלבום');
    $('personalMediaFilters').querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.personMediaFilter===state.galleryFilter)));
    const grid=$('galleryGrid'),previous=new Map([...grid.children].map(card=>[card.dataset.mediaFile,card])),cards=[];
    for(const item of items){
      let card=previous.get(item.file);
      if(!card||card.dataset.mediaSrc!==item.src){
        card=document.createElement('article');card.className='gallery-photo';card.dataset.mediaFile=item.file;card.dataset.mediaSrc=item.src;
        let viewer;
        if(item.provider==='youtube')viewer=I18n.html`<button class="personal-video-cover" data-media-open="${safe(item.id)}" data-media-scope="${safe(scope)}" aria-label="ניגון ${safe(I18n.mediaName(item))} בגלריה"><span aria-hidden="true">▶</span><strong>${safe(I18n.mediaName(item))}</strong></button>`;
        else if(item.kind==='video')viewer=I18n.html`<video class="person-gallery-video" controls playsinline preload="metadata" src="${safe(item.src)}" aria-label="${safe(I18n.mediaName(item))}"></video><p class="video-codec-note" hidden>הסרטון לא מתנגן בדפדפן הזה. אפשר לפתוח אותו בגלריה ולהוריד את המקור.</p><div class="personal-media-name">${safe(I18n.mediaName(item))}</div>`;
        else viewer=I18n.html`<button class="gallery-image" data-media-open="${safe(item.id||item.file)}" data-media-scope="${safe(scope)}" aria-label="פתיחת התמונה ${safe(I18n.mediaName(item))}"><img src="${safe(item.src)}" alt="${safe(item.caption||I18n.mediaName(item))}" loading="lazy"></button>`;
        const profile=item.kind==='photo'?I18n.html`<div class="photo-actions"><button class="profile-select" data-set-profile="${safe(item.file)}" data-owner="${personId}">קביעה כתמונת פרופיל</button></div>`:'';
        const captionId='caption-'+personId+'-'+encodeURIComponent(item.file);
        card.innerHTML=viewer+(item.linked?I18n.t('<p class="linked-media-note">מופיע באלבום הזה בזכות תיוג</p>'):'')+profile+window.FamilyMedia.controls(item,scope)+I18n.html`<div class="caption-editor"><label class="visually-hidden" for="${safe(captionId)}">כיתוב ל${item.kind==='video'?I18n.t('סרטון'):I18n.t('תמונה')} ${safe(I18n.mediaName(item))}</label><textarea dir="auto" id="${safe(captionId)}" data-caption-file="${safe(item.file)}" data-owner="${personId}" rows="2" maxlength="5000" placeholder="מי מופיע כאן? איפה ומתי? כתבו כאן…" ${apiEnabled?'':'disabled'}></textarea><div class="caption-toolbar"><span data-caption-status role="status"></span><button data-save-caption="${safe(item.file)}" data-owner="${personId}">שמירה</button></div></div>`;
        card.querySelector('video')?.addEventListener('error',()=>{card.querySelector('.video-codec-note').hidden=false;});
      }
      const profileButton=card.querySelector('.profile-select');
      if(profileButton){const isProfile=Boolean(album.profileIsManual)&&album.profileFile===item.file;profileButton.classList.toggle('is-profile',isProfile);profileButton.disabled=isProfile;profileButton.setAttribute('aria-pressed',String(isProfile));profileButton.textContent=isProfile?I18n.t('✓ תמונת הפרופיל'):I18n.t('קביעה כתמונת פרופיל');}
      const area=card.querySelector('textarea'),draft=drafts.get(keyFor(personId,item.file));
      if(area!==document.activeElement)area.value=draft?.dirty?draft.value:item.caption||'';
      cards.push(card);
    }
    const wanted=new Set(cards);for(const card of [...grid.children])if(!wanted.has(card)){card.querySelectorAll('video').forEach(video=>video.pause());card.remove();}
    let anchor=grid.firstElementChild;for(const card of cards){if(card===anchor)anchor=anchor.nextElementSibling;else grid.insertBefore(card,anchor);}
    window.FamilyTags.refresh(grid,items);galleryRevision=item.revision;
  }

  async function refreshOpenGallery(force=false) {
    if (!apiEnabled || !$('personDialog').open || galleryLoading) return;
    const personId = state.currentPerson;
    galleryLoading = true;
    try {
      const headers = !force && galleryRevision ? {'If-None-Match':'"' + galleryRevision + '"'} : {};
      const response = await I18n.fetch('api/people/' + encodeURIComponent(personId), {headers, cache:'no-store'});
      if (response.status === 304) return;
      const result = await response.json();
      if (!response.ok) throw Error(I18n.error(result.error) || I18n.t('לא ניתן לפתוח את הגלריה.'));
      updatePersonUI(personId, result);
      if (personId === state.currentPerson && $('personDialog').open) renderGallery(result);
    } catch(error) {
      if (force && personId === state.currentPerson && $('personDialog').open) toast(error.message || I18n.t('לא ניתן לקרוא את הגלריה כרגע.'));
    } finally {galleryLoading = false;}
  }

  async function chooseProfilePhoto(personId, file) {
    if (!apiEnabled) return;
    try {
      const response = await I18n.fetch('api/people/' + encodeURIComponent(personId) + '/profile', {
        method:'POST', headers:{'Content-Type':'application/json','X-Family-Token':window.FAMILY_API_TOKEN},
        body:JSON.stringify({file})
      });
      const result = await response.json();
      if (!response.ok) throw Error(I18n.error(result.error) || I18n.t('תמונת הפרופיל לא נשמרה.'));
      updatePersonUI(personId, result.person);
      if (state.currentPerson === personId && $('personDialog').open) renderGallery(result.person);
      toast(I18n.t('תמונת הפרופיל של ') + nameOf(data.people[personId]) + I18n.t(' עודכנה'));
    } catch(error) {toast(error.message || I18n.t('לא ניתן לשמור את תמונת הפרופיל כרגע.'));}
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
    draftStatus(personId, file, I18n.t('ממתין לשמירה…'));
  }

  async function saveCaption(key) {
    const draft = drafts.get(key);
    if (!draft || !draft.dirty || draft.saving || !apiEnabled) return;
    clearTimeout(draft.timer);
    draft.saving = true;
    const text = draft.value;
    draftStatus(draft.personId, draft.file, I18n.t('שומר…'));
    try {
      const response = await I18n.fetch('api/people/' + encodeURIComponent(draft.personId) + '/caption', {
        method:'POST', headers:{'Content-Type':'application/json','X-Family-Token':window.FAMILY_API_TOKEN},
        body:JSON.stringify({file:draft.file,caption:text}), keepalive:true
      });
      const result = await response.json();
      if (!response.ok) throw Error(I18n.error(result.error) || I18n.t('הכיתוב לא נשמר.'));
      if (draft.value === text) {draft.dirty = false;draftStatus(draft.personId,draft.file,I18n.t('נשמר ✓'));}
      else draft.timer = setTimeout(() => saveCaption(key), 150);
    } catch(error) {
      draftStatus(draft.personId,draft.file,I18n.t('לא נשמר · לחצו על שמירה'),true);
      toast(error.message || I18n.t('הכיתוב לא נשמר. נסו שוב.'));
    } finally {draft.saving = false;}
  }

  function flushDrafts() {
    for (const [key,draft] of drafts) {
      if (draft.dirty) {clearTimeout(draft.timer);saveCaption(key);}
    }
  }

  function openPhoto(index) {
    if (!state.gallery.length) return;
    if(window.FamilyMedia){window.FamilyMedia.open(state.gallery,index,'personal:'+state.currentPerson);return;}
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
    if(state.view==='person'){$('searchResults').hidden=true;window.FamilyPeople?.search(state.query);return;}
    if(!['tree','directory'].includes(state.view)){window.FamilyPortal?.search(state.query);window.FamilyArchive?.search(state.query);window.FamilyCalendar?.search(state.query);$('searchResults').hidden=true;return;}
    if(state.view==='directory'){renderDirectory();$('searchResults').hidden=true;return;}
    if(!query){$('searchResults').hidden=true;return;}
    const matches=people.filter(p=>normalize(I18n.searchNames({...p,...getMedia(p)})).includes(query));
    $('searchResults').innerHTML=matches.length?matches.slice(0,15).map(p=>`<button class="search-result" data-search-person="${p.id}"><span>${safe(nameOf(p))}${p.deceased?I18n.t(' ז״ל'):''}</span><small>${safe(branchTitle(p))}</small></button>`).join(''):I18n.t('<div class="search-empty">לא נמצא שם מתאים</div>');
    $('searchResults').hidden=false;
  }

  async function loadFamilyMedia(force=false) {
    if (!apiEnabled || mediaLoading) return;
    mediaLoading = true;
    try {
      const response = await I18n.fetch('api/media', {cache:'no-store',headers:!force&&mediaRevision?{'If-None-Match':'"'+mediaRevision+'"'}:{}});
      mediaLoadedAt=Date.now();
      if(response.status===304){$('runtimeNotice').hidden=true;return;}
      if (!response.ok) throw Error('connection');
      const result = await response.json();
      mediaRevision=result.revision;mediaDirty=false;
      Object.entries(result.people).forEach(([personId,item])=>updatePersonUI(personId,item));
      window.dispatchEvent(new CustomEvent('family-people-loaded'));
      $('runtimeNotice').hidden = true;
    } catch(error) {
      $('runtimeNotice').textContent = I18n.t('החיבור לשמירה אינו זמין כרגע. נסו לרענן את הדף.');
      $('runtimeNotice').hidden = false;
    } finally {mediaLoading = false;}
  }

  function addUploads(files, fromClipboard=false) {
    if (!apiEnabled) {toast(I18n.t('ההעלאה אינה זמינה כרגע. נסו לרענן את הדף.'));return;}
    if (!state.currentPerson || !$('personDialog').open) return;
    const selected = Array.from(files).filter(file => /^image\/(jpeg|png|webp|gif|avif)$/i.test(file.type) || imageTypes.test(file.name));
    if (!selected.length) {toast(I18n.t('בחרו תמונת JPG, PNG, WEBP, GIF או AVIF.'));return;}
    if (selected.length < files.length) toast(I18n.t('חלק מהקבצים אינם בפורמט נתמך. יתר התמונות יישמרו.'));
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
          $('uploadState').textContent = I18n.html`מעלה תמונה ${i+1} מתוך ${batch.files.length}…`;
          $('photoDropzone').classList.add('uploading');
        }
        try {
          if (file.size > 50*1024*1024) throw Error(I18n.t('אפשר להעלות עד 50MB לתמונה.'));
          const date = new Date().toISOString().replace(/[:.]/g,'-');
          const filename = batch.clipboard ? I18n.t('צילום_מסך_') + date + '.png' : file.name;
          const response = await I18n.fetch('api/people/' + encodeURIComponent(batch.personId) + '/photos?filename=' + encodeURIComponent(filename), {
            method:'POST',headers:{'Content-Type':file.type || 'application/octet-stream','X-Family-Token':window.FAMILY_API_TOKEN},body:file
          });
          const result = await response.json();
          if (!response.ok) throw Error(I18n.error(result.error) || I18n.t('התמונה לא נשמרה.'));
          saved++;
          updatePersonUI(batch.personId,result.person);
          if (state.currentPerson === batch.personId && $('personDialog').open) renderGallery(result.person);
        } catch(error) {toast((file.name ? file.name + ': ' : '') + (error.message || I18n.t('התמונה לא נשמרה.')));}
      }
      if (state.currentPerson === batch.personId && $('personDialog').open) {
        $('photoDropzone').classList.remove('uploading');
        $('uploadState').textContent = saved === 1 ? I18n.t('התמונה נוספה לאלבום ✓') : saved ? I18n.html`${saved} תמונות נוספו לאלבום ✓` : I18n.t('לא נשמרו תמונות. אפשר לנסות שוב.');
      }
    }
    uploadRunning = false;
  }

  document.addEventListener('click',event=>{
    const filter=event.target.closest('[data-person-media-filter]');if(filter){state.galleryFilter=filter.dataset.personMediaFilter;renderGallery(getMedia(data.people[state.currentPerson]));return;}
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
    else if (!window.FamilyArchive?.acceptDrop(event)&&!window.FamilyPortal?.acceptDrop(event)) toast(I18n.t('פתחו גלריה שאליה תרצו להוסיף את התמונות.'));
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
  $('homeLink').addEventListener('click',e=>{e.preventDefault();state.branch='all';state.mode='overview';state.query='';$('searchInput').value='';renderBranches();setView(isPhone()?'home':'tree');});
  $('overviewButton').addEventListener('click',()=>{state.branch='all';state.mode='overview';renderBranches();renderTree();});
  $('fullTreeButton').addEventListener('click',()=>{state.mode=state.branch==='all'?'full':'branch';renderTree();});
  $('zoomIn').addEventListener('click',()=>zoom(1.2));$('zoomOut').addEventListener('click',()=>zoom(1/1.2));$('fitButton').addEventListener('click',fitTree);
  document.addEventListener('keydown',e=>{if($('lightbox').open){if(e.key==='ArrowRight')openPhoto(state.photoIndex+1);if(e.key==='ArrowLeft')openPhoto(state.photoIndex-1);}});
  $('personDialog').addEventListener('click',e=>{if(e.target===$('personDialog')){const r=$('personDialog').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('personDialog').close();}});
  window.addEventListener('pagehide',flushDrafts);

  const viewport=$('treeViewport');let drag=null,pinch=null;
  const touches=new Map();
  viewport.addEventListener('click',event=>{if(performance.now()<suppressClickUntil){event.preventDefault();event.stopImmediatePropagation();}},true);
  viewport.addEventListener('pointerdown',event=>{
    stopTreeMotion();if(event.button>0)return;
    if(event.pointerType==='touch'){
      touches.set(event.pointerId,{x:event.clientX,y:event.clientY});
      if(touches.size===2){const [a,b]=[...touches.values()],rect=viewport.getBoundingClientRect();pinch={distance:Math.hypot(a.x-b.x,a.y-b.y),scale:camera.scale,x:(a.x+b.x)/2-rect.left,y:(a.y+b.y)/2-rect.top,cameraX:camera.x,cameraY:camera.y};drag=null;for(const id of touches.keys())viewport.setPointerCapture(id);suppressClickUntil=performance.now()+500;return;}
    }else if(event.target.closest('button'))return;
    drag={id:event.pointerId,startX:event.clientX,startY:event.clientY,x:camera.x,y:camera.y,lastX:event.clientX,lastY:event.clientY,time:event.timeStamp,vx:0,vy:0,started:false,touch:event.pointerType==='touch'};
  });
  viewport.addEventListener('pointermove',event=>{
    if(touches.has(event.pointerId))touches.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(pinch&&touches.size===2){const [a,b]=[...touches.values()],rect=viewport.getBoundingClientRect(),scale=Math.max(.035,Math.min(3.5,pinch.scale*Math.hypot(a.x-b.x,a.y-b.y)/Math.max(1,pinch.distance)));camera.x=(a.x+b.x)/2-rect.left-(pinch.x-pinch.cameraX)*scale/pinch.scale;camera.y=(a.y+b.y)/2-rect.top-(pinch.y-pinch.cameraY)*scale/pinch.scale;camera.scale=scale;clampCamera();applyCamera();suppressClickUntil=performance.now()+500;return;}
    if(!drag||event.pointerId!==drag.id)return;
    if(!drag.started&&Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)>6){drag.started=true;viewport.setPointerCapture(event.pointerId);viewport.classList.add('dragging');}
    if(!drag.started)return;
    const dt=Math.max(1,event.timeStamp-drag.time);drag.vx=.4*drag.vx+.6*(event.clientX-drag.lastX)/dt;drag.vy=.4*drag.vy+.6*(event.clientY-drag.lastY)/dt;drag.lastX=event.clientX;drag.lastY=event.clientY;drag.time=event.timeStamp;
    camera.x=drag.x+event.clientX-drag.startX;camera.y=drag.y+event.clientY-drag.startY;clampCamera();applyCamera();suppressClickUntil=performance.now()+400;
  });
  function momentum(vx,vy){
    if(!isPhone()||Math.hypot(vx,vy)<.08)return;let previous=performance.now();
    const step=now=>{const dt=Math.min(32,now-previous);previous=now;camera.x+=vx*dt;camera.y+=vy*dt;vx*=Math.pow(.91,dt/16);vy*=Math.pow(.91,dt/16);clampCamera();applyCamera();if(Math.hypot(vx,vy)>.025)motionFrame=requestAnimationFrame(step);else motionFrame=0;};motionFrame=requestAnimationFrame(step);
  }
  function endDrag(event){
    const ended=drag;touches.delete(event.pointerId);pinch=null;drag=null;viewport.classList.remove('dragging');
    if(touches.size===1){const [id,point]=[...touches][0];drag={id,startX:point.x,startY:point.y,x:camera.x,y:camera.y,lastX:point.x,lastY:point.y,time:event.timeStamp,vx:0,vy:0,started:true,touch:true};}
    else if(ended?.started&&ended.touch){suppressClickUntil=performance.now()+400;if(event.timeStamp-ended.time<90)momentum(Math.max(-3,Math.min(3,ended.vx)),Math.max(-3,Math.min(3,ended.vy)));}
  }
  viewport.addEventListener('pointerup',endDrag);viewport.addEventListener('pointercancel',event=>{touches.clear();pinch=null;drag=null;viewport.classList.remove('dragging');stopTreeMotion();});
  viewport.addEventListener('wheel',event=>{if(event.ctrlKey||event.metaKey){event.preventDefault();const rect=viewport.getBoundingClientRect();zoom(event.deltaY<0?1.1:1/1.1,event.clientX-rect.left,event.clientY-rect.top);}}, {passive:false});
  viewport.addEventListener('keydown',e=>{
    if(e.target!==viewport)return;
    if(e.key==='+'||e.key==='='){e.preventDefault();zoom(1.2);}else if(e.key==='-'){e.preventDefault();zoom(1/1.2);}else if(e.key==='0'){e.preventDefault();fitTree();}
    else if(e.key.startsWith('Arrow')){e.preventDefault();if(e.key==='ArrowLeft')camera.x+=50;if(e.key==='ArrowRight')camera.x-=50;if(e.key==='ArrowUp')camera.y+=50;if(e.key==='ArrowDown')camera.y-=50;applyCamera();}
  });
  let resizeTimer,lastWidth=innerWidth;window.addEventListener('resize',()=>{if(innerWidth===lastWidth)return;lastWidth=innerWidth;clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(state.view==='tree')renderTree();if(!isPhone()&&state.view==='home')setView('tree');},120);});
  window.addEventListener('family-media-changed',event=>{
    const result=event.detail,affected=result.people|| (result.person?{[result.person.id]:result.person}:{});
    if(result.affectedPersonIds){mediaDirty=true;for(const person of result.taggedPeople||[])if(person.extra&&!data.people[person.id])updatePersonUI(person.id,{...person,birthday:'1.1.1111'});}
    for(const [personId,item]of Object.entries(affected)){
      if(['delete','untag'].includes(result.operation)){const key=keyFor(personId,result.item.file);clearTimeout(drafts.get(key)?.timer);drafts.delete(key);}
      updatePersonUI(personId,item);
      if(state.currentPerson===personId&&$('personDialog').open)renderGallery(item);
    }
  });
  window.FamilyApp={setView,getView:()=>state.view,getPerson:id=>data.people[id],getPersonSummary:id=>({...data.people[id],...media.get(id)}),getPeople:()=>people.map(person=>({...person,name:nameOf(person)})),nameOf:id=>data.people[id]?nameOf(data.people[id]):id,birthdayOf:id=>birthdayOf(data.people[id]),openPerson,birthdayHTML:id=>birthdayHTML(data.people[id]),updatePerson:updatePersonUI,toast,apiEnabled,openSharedGallery:(items,index)=>window.FamilyMedia?.open(items,index)};
  function simpleRoute(){const view=location.hash.slice(1).split('/')[0];if(['weddings','nostalgia'].includes(view))return;const target=validViews.has(view)?view:(!view?(isPhone()?'home':'tree'):null);if(target&&target!==state.view)setView(target,false);}
  window.addEventListener('hashchange',simpleRoute);window.addEventListener('popstate',simpleRoute);
  renderBranches();renderView();
  if(apiEnabled){
    loadFamilyMedia();
    setInterval(()=>{if(document.visibilityState!=='hidden')refreshOpenGallery();},10000);
    setInterval(()=>{if(document.visibilityState!=='hidden'&&!document.querySelector('dialog[open]'))loadFamilyMedia();},300000);
    const refreshAfterTags=()=>{if(mediaDirty&&!document.querySelector('dialog[open]'))loadFamilyMedia();};
    $('mediaViewer').addEventListener('close',refreshAfterTags);$('tagPeopleDialog').addEventListener('close',refreshAfterTags);
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){if(Date.now()-mediaLoadedAt>60000||mediaDirty)loadFamilyMedia();refreshOpenGallery(true);}});
  }else{
    $('runtimeNotice').textContent=I18n.t('החיבור לשמירה אינו זמין כרגע. נסו לרענן את הדף.');
    $('runtimeNotice').hidden=false;
  }
})();
