(() => {
  'use strict';
  if(!document.documentElement.hasAttribute('data-extended-keha'))return;
  const data=window.FAMILY_DATA,I=window.FamilyI18n;
  const tr=(he,en)=>I.isEnglish?en:he;
  const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const shlomoHome=(document.documentElement.dataset.kehaShlomoHome || '/keha-extended/shlomo/')+'#home';
  const zechariahHome=(document.documentElement.dataset.kehaZechariahHome || '/keha-extended/zechariah/')+'#home';
  const kehatHome=(document.documentElement.dataset.kehaKehatHome || '/keha-extended/kehat/')+'#home';
  const names={
    shlomo:()=>tr('משפחת שלמה קהא','Shlomo Keha Family'),
    zechariah:()=>tr('משפחת זכריה קהא הבן','Family of Zechariah Keha the Younger'),
    kehat:()=>tr('משפחת קהת','Kehat family'),
    yissachar:()=>tr('משפחת יששכר','Yissachar Family'),
  };
  function markup(branch='all',suffix='tree'){
    const notes={shlomo:tr('בנו של זכריה קהא האב','Son of Zechariah the Elder'),zechariah:tr('זכריה קהא הבן · בנו של סעדיה','Zechariah the Younger · Son of Saadia'),yissachar:tr('יוסף וצביה וילדיהם · ענף נפרד','Yosef, Tzvia and their children · independent branch')};
    const symbols={shlomo:'ש',zechariah:'ז · י',yissachar:'י'};
    const circle=id=>{
      const p=window.FamilyApp?.getPersonSummary(id==='shlomo'?'shlomo':id==='zechariah'?'keha-zechariah':'yissachar-yosef') || data.people[id==='shlomo'?'shlomo':''];
      const portrait=p?.profile?`<img src="${safe(p.profile)}" alt="" decoding="async">`:`<span aria-hidden="true">${symbols[id]}</span>`;
      const inner=`<span class="extended-branch-portrait">${portrait}</span><strong>${safe(names[id]())}</strong>${id==='yissachar'?'':`<span class="extended-branch-note">${safe(notes[id])}</span>`}`;
      return ['shlomo','zechariah'].includes(id)?`<a class="extended-branch-circle extended-${id}" href="${safe(id==='shlomo'?shlomoHome:zechariahHome)}">${inner}</a>`:
        `<button type="button" class="extended-branch-circle extended-${id}" data-branch="${id}" aria-pressed="${branch===id}">${inner}</button>`;
    };
    const circles=['shlomo','zechariah'].map(circle).join('');
    const kehatCircle=id=>{
      const label=I.branchName(data.branches.find(branch=>branch.id===id));
      return `<div class="extended-kehat-item"><a class="extended-branch-circle extended-kehat-small" href="${safe(kehatHome)}" aria-label="${safe(label)}"><strong>${safe(label)}</strong></a></div>`;
    };
    const kehatGroup=`<section class="extended-kehat-group" aria-label="${tr('שני ענפי משפחת קהת','The two Kehat family branches')}"><h3>${names.kehat()}</h3><div class="extended-kehat-circles">${kehatCircle('kehat-tzadok')}${kehatCircle('kehat')}</div><p>${tr('נישואי יעקב ויהודית מחברים בין הענפים','The relationship between these two branches is not yet known')}</p></section>`;
    const lowerBranches=`<div class="extended-lower-branches">${kehatGroup}<div class="extended-yissachar-group">${circle('yissachar')}<span class="extended-branch-note">${safe(notes.yissachar)}</span></div></div>`;
    const ancestor=(id,side,name,description,phoneDescription=description)=>`<a class="extended-ancestor extended-ancestor-${side}" href="#person/${id}" data-person="${id}"><strong>${name}</strong><span>${phoneDescription===description?description:`<span class="extended-desktop-only">${description}</span><span class="extended-phone-only">${phoneDescription}</span>`}</span></a><span class="extended-parent-line extended-parent-line-${side}" aria-hidden="true"></span>`;
    const ancestry=ancestor('keha-zechariah-father','shlomo',tr('זכריה קהא האב','Zechariah Keha the Elder'),tr('אביו של שלמה','Shlomo’s father'))+ancestor('saadia-elder','zechariah',tr('סעדיה קהא','Saadia Keha'),tr('אביו של זכריה הבן','Zechariah’s father'),tr('אבי זכריה הבן','Zechariah’s father'));
    return `<div class="extended-hub-art"><span class="extended-sibling-link"><span>${tr('אחים','Brothers')}</span></span>${ancestry}<p class="extended-cousin-label">${tr('שלמה וזכריה קהא הבן — בני דודים','Shlomo and Zechariah the Younger — first cousins')}</p><span class="extended-cousin-link extended-phone-only"><span>${tr('בני דודים','First cousins')}</span></span><svg class="extended-hub-lines" viewBox="0 0 1000 720" preserveAspectRatio="none" aria-hidden="true"><defs><marker id="extended-tip-${suffix}" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="m1 1 6 3-6 3"/></marker></defs><g marker-end="url(#extended-tip-${suffix})"><path d="M500 436C408 396 389 254 259 252"/><path d="M500 436C592 396 611 254 741 252"/><path d="M500 460C400 543 365 588 259 588"/><path d="M500 460C600 543 635 588 741 588"/></g></svg><img class="extended-olive-tree" src="/assets/founder-tree-shlomo-v1.webp" alt="${tr('עץ זית עתיק במרכז ארבעת ענפי המשפחה','An ancient olive tree at the centre of four family branches')}" width="1280" height="1280" fetchpriority="high">${circles}${lowerBranches}<span class="extended-tree-seal" aria-hidden="true">❖</span></div><span class="extended-phone-seal extended-phone-only" aria-hidden="true">❖</span><p class="extended-hub-caption">${tr('ענפי המשפחה, סיפור שנבנה יחד','Family branches, a story we are building together')}</p><p class="extended-research-note">${tr('הקווים הרציפים מציגים את האחים ואת בניהם, לפי המידע המשפחתי. החיצים המקווקווים מובילים לענפים; ענפי צדוק ואהרון מוצגים בנפרד ומתחברים בנישואי יעקב ויהודית; הקרבה בין הסבים עדיין בבירור. עשרת האחים והאחיות בענף טרי הם ילדי זכריה בן סעדיה בן אהרון בקהת, לפי אישור אלדד. משפחת יששכר של יוסף וצביה מוצגת בנפרד ותישאר ללא חיבור עד להנחיה נוספת.','Solid lines show the brothers and their sons, according to family information. Dashed arrows open the branches. Tzadok and Aharon’s branches are shown separately and connected by Yaakov and Yehudit’s marriage; the grandfathers’ blood relationship remains under research. The owner confirmed the ten Tri siblings as children of Zechariah son of Saadia son of Aharon in Kehat. Yosef and Tzvia’s Yissachar family remains separate until further family instructions.')}</p>${branch!=='all'?`<button type="button" class="extended-all-branches" data-branch="all">${tr('חזרה לכל הענפים','Back to all branches')}</button>`:''}`;
  }
  function renderHome(){const home=document.getElementById('extendedKehaHomeHub');if(home)home.innerHTML=markup('all','home');}
  window.FamilyExtendedKeha={
    title:()=>tr('משפחת קהא המורחבת','The Extended Keha Family'),
    renderTree(state){
      const hub=document.getElementById('extendedKehaHub');
      document.body.dataset.extendedBranch=state.branch;
      if(hub)hub.innerHTML=markup(state.branch);
      const heading=tr('האילן המשפחתי של קהא המורחבת','The extended Keha family tree');
      document.getElementById('workspaceTitle').textContent=heading;
      document.getElementById('mobileViewTitle').textContent=heading;
      const subtitle=document.getElementById('workspaceSubtitle');if(subtitle)subtitle.textContent='';
      if(state.branch!=='all')return false;
      document.getElementById('workspaceDetail').hidden=true;
      return true;
    },
  };
  renderHome();
  document.addEventListener('click',event=>{
    const branch=event.target.closest('[data-branch]')?.dataset.branch;
    const destination={shlomo:shlomoHome,zechariah:zechariahHome,kehat:kehatHome,'kehat-tzadok':kehatHome}[branch];
    if(destination){event.preventDefault();event.stopPropagation();location.assign(destination);}
  },true);
  document.getElementById('extendedKehaHomeHub')?.addEventListener('click',event=>{
    if(event.target.closest('[data-branch]'))window.FamilyApp?.setView('tree');
  });
  for(const event of ['family-people-loaded','family-profile-changed','family-person-changed'])window.addEventListener(event,()=>{
    renderHome();const hub=document.getElementById('extendedKehaHub');if(hub)hub.innerHTML=markup(document.body.dataset.extendedBranch||'all');
  });
})();
