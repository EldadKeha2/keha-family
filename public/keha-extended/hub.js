(() => {
  'use strict';
  if(!document.documentElement.hasAttribute('data-extended-keha'))return;
  const data=window.FAMILY_DATA,I=window.FamilyI18n;
  const tr=(he,en)=>I.isEnglish?en:he;
  const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const shlomoHome=(document.documentElement.dataset.kehaShlomoHome || '/keha-extended/shlomo/')+'#home';
  const names={
    shlomo:()=>tr('משפחת שלמה קהא','Shlomo Keha Family'),
    zechariah:()=>tr('זכריה ויהודית קהא','Zechariah & Yehudit Keha'),
    kehat:()=>tr('משפחת קהת','Kehat family'),
    yissachar:()=>tr('יוסף יששכר','Yosef Yissachar'),
  };
  function markup(branch='all',suffix='tree'){
    const notes={shlomo:tr('בנו של זכריה קהא האב','Son of Zechariah the Elder'),zechariah:tr('זכריה קהא הבן · בנו של סעדיה','Zechariah the Younger · Son of Saadia'),kehat:tr('ג׳ידעאן והילדים','Jidaan and his children'),yissachar:tr('ענף להשלמה','More to discover')};
    const symbols={shlomo:'ש',zechariah:'ז · י',kehat:'ק',yissachar:'י'};
    const circles=data.branches.map(({id})=>{
      const p=window.FamilyApp?.getPersonSummary(id==='shlomo'?'shlomo':id==='zechariah'?'keha-zechariah':id==='kehat'?'kehat-jidaan':'keha-yosef-yissachar') || data.people[id==='shlomo'?'shlomo':''];
      const portrait=p?.profile?`<img src="${safe(p.profile)}" alt="" decoding="async">`:`<span aria-hidden="true">${symbols[id]}</span>`;
      const inner=`<span class="extended-branch-portrait">${portrait}</span><strong>${safe(names[id]())}</strong><span class="extended-branch-note">${safe(notes[id])}</span>`;
      return id==='shlomo'?`<a class="extended-branch-circle extended-shlomo" href="${safe(shlomoHome)}">${inner}</a>`:
        `<button type="button" class="extended-branch-circle extended-${id}" data-branch="${id}" aria-pressed="${branch===id}">${inner}</button>`;
    }).join('');
    const ancestor=(id,side,name,description)=>`<a class="extended-ancestor extended-ancestor-${side}" href="#person/${id}" data-person="${id}"><strong>${name}</strong><span>${description}</span><small>${tr('נפטר בתימן לפני העלייה','Died in Yemen before immigration')}</small></a><span class="extended-parent-line extended-parent-line-${side}" aria-hidden="true"></span>`;
    const ancestry=ancestor('keha-zechariah-father','shlomo',tr('זכריה קהא האב','Zechariah Keha the Elder'),tr('אביו של שלמה','Shlomo’s father'))+ancestor('saadia-elder','zechariah',tr('סעדיה קהא','Saadia Keha'),tr('אביו של זכריה קהא הבן','Father of Zechariah the Younger'));
    return `<div class="extended-hub-art"><span class="extended-sibling-link"><span>${tr('אחים','Brothers')}</span></span>${ancestry}<p class="extended-cousin-label">${tr('שלמה וזכריה קהא הבן — בני דודים','Shlomo and Zechariah the Younger — first cousins')}</p><svg class="extended-hub-lines" viewBox="0 0 1000 720" preserveAspectRatio="none" aria-hidden="true"><defs><marker id="extended-tip-${suffix}" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="m1 1 6 3-6 3"/></marker></defs><g marker-end="url(#extended-tip-${suffix})"><path d="M500 436C408 396 389 254 259 252"/><path d="M500 436C592 396 611 254 741 252"/><path d="M500 460C400 543 365 588 259 588"/><path d="M500 460C600 543 635 588 741 588"/></g></svg><img class="extended-olive-tree" src="/assets/founder-tree-shlomo-v1.webp" alt="${tr('עץ זית עתיק במרכז ארבעת ענפי המשפחה','An ancient olive tree at the centre of four family branches')}" width="1280" height="1280" fetchpriority="high">${circles}<span class="extended-tree-seal" aria-hidden="true">❖</span></div><p class="extended-hub-caption">${tr('ארבעה ענפים, סיפור משפחתי שנבנה יחד','Four branches, a family story we are building together')}</p><p class="extended-research-note">${tr('הקווים הרציפים מציגים את האחים ואת בניהם, לפי המידע המשפחתי. החיצים המקווקווים מובילים לענפים; הקשר לקהת וליוסף יששכר עדיין במחקר.','Solid lines show the brothers and their sons, according to family information. Dashed arrows open the branches; the connections to Kehat and Yosef Yissachar remain under research.')}</p>${branch!=='all'?`<button type="button" class="extended-all-branches" data-branch="all">${tr('חזרה לארבעת הענפים','Back to all four branches')}</button>`:''}`;
  }
  function renderHome(){const home=document.getElementById('extendedKehaHomeHub');if(home)home.innerHTML=markup('all','home');}
  window.FamilyExtendedKeha={
    title:()=>tr('משפחת קהא המורחבת','The Extended Keha Family'),
    renderTree(state){
      const hub=document.getElementById('extendedKehaHub');
      document.body.dataset.extendedBranch=state.branch;
      if(hub)hub.innerHTML=markup(state.branch);
      const subtitle=document.getElementById('workspaceSubtitle');
      if(subtitle)subtitle.textContent=tr('האחים זכריה וסעדיה · בניהם שלמה וזכריה בני דודים','Brothers Zechariah and Saadia · Their sons Shlomo and Zechariah are first cousins');
      if(state.branch!=='all')return false;
      document.getElementById('workspaceTitle').textContent=tr('משפחת קהא המורחבת','The Extended Keha Family');
      document.getElementById('mobileViewTitle').textContent=tr('משפחת קהא המורחבת','The Extended Keha Family');
      document.getElementById('workspaceDetail').hidden=true;
      return true;
    },
  };
  renderHome();
  document.addEventListener('click',event=>{
    if(event.target.closest('[data-branch="shlomo"]')){event.preventDefault();event.stopPropagation();location.assign(shlomoHome);}
  },true);
  document.getElementById('extendedKehaHomeHub')?.addEventListener('click',event=>{
    if(event.target.closest('[data-branch]'))window.FamilyApp?.setView('tree');
  });
  for(const event of ['family-people-loaded','family-profile-changed','family-person-changed'])window.addEventListener(event,()=>{
    renderHome();const hub=document.getElementById('extendedKehaHub');if(hub)hub.innerHTML=markup(document.body.dataset.extendedBranch||'all');
  });
})();
