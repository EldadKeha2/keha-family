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
    const notes={shlomo:tr('למשפחה שלנו','Our family home'),zechariah:tr('הענף המשפחתי','Family branch'),kehat:tr('ג׳ידעאן והילדים','Jidaan and his children'),yissachar:tr('ענף להשלמה','More to discover')};
    const symbols={shlomo:'ש',zechariah:'ז · י',kehat:'ק',yissachar:'י'};
    const circles=data.branches.map(({id})=>{
      const p=window.FamilyApp?.getPersonSummary(id==='shlomo'?'shlomo':id==='zechariah'?'keha-zechariah':id==='kehat'?'kehat-jidaan':'keha-yosef-yissachar') || data.people[id==='shlomo'?'shlomo':''];
      const portrait=p?.profile?`<img src="${safe(p.profile)}" alt="" decoding="async">`:`<span aria-hidden="true">${symbols[id]}</span>`;
      const inner=`<span class="extended-branch-portrait">${portrait}</span><strong>${safe(names[id]())}</strong><span class="extended-branch-note">${safe(notes[id])}</span>`;
      return id==='shlomo'?`<a class="extended-branch-circle extended-shlomo" href="${safe(shlomoHome)}">${inner}</a>`:
        `<button type="button" class="extended-branch-circle extended-${id}" data-branch="${id}" aria-pressed="${branch===id}">${inner}</button>`;
    }).join('');
    return `<div class="extended-hub-art"><svg class="extended-hub-lines" viewBox="0 0 1000 570" preserveAspectRatio="none" aria-hidden="true"><defs><marker id="extended-tip-${suffix}" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="m1 1 6 3-6 3"/></marker></defs><g marker-end="url(#extended-tip-${suffix})"><path d="M500 336C408 296 389 134 259 132"/><path d="M500 336C592 296 611 134 741 132"/><path d="M500 360C400 443 365 421 259 421"/><path d="M500 360C600 443 635 421 741 421"/></g></svg><img class="extended-olive-tree" src="/assets/founder-tree-shlomo-v1.webp" alt="${tr('עץ זית עתיק במרכז ארבעת ענפי המשפחה','An ancient olive tree at the centre of four family branches')}" width="1280" height="1280" fetchpriority="high">${circles}<span class="extended-tree-seal" aria-hidden="true">❖</span></div><p class="extended-hub-caption">${tr('ארבעה ענפים, סיפור משפחתי שנבנה יחד','Four branches, a family story we are building together')}</p><p class="extended-research-note">${tr('הקשר בין הענפים עדיין בבירור. החיצים מזמינים להכיר את המשפחות ואינם קובעים קשר הורי.','The connections between these branches are still being researched. The arrows open the family branches and do not indicate parentage.')}</p>${branch!=='all'?`<button type="button" class="extended-all-branches" data-branch="all">${tr('חזרה לארבעת הענפים','Back to all four branches')}</button>`:''}`;
  }
  function renderHome(){const home=document.getElementById('extendedKehaHomeHub');if(home)home.innerHTML=markup('all','home');}
  window.FamilyExtendedKeha={
    title:()=>tr('משפחת קהא המורחבת','The Extended Keha Family'),
    renderTree(state){
      const hub=document.getElementById('extendedKehaHub');
      document.body.dataset.extendedBranch=state.branch;
      if(hub)hub.innerHTML=markup(state.branch);
      const subtitle=document.getElementById('workspaceSubtitle');
      if(subtitle)subtitle.textContent=tr('ארבעה ענפים · הקשר המשפחתי בבירור','Four branches · Family connections under research');
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
