(() => {
  'use strict';
  if(!document.documentElement.hasAttribute('data-extended-keha'))return;
  const data=window.FAMILY_DATA,I=window.FamilyI18n,config=document.documentElement.dataset;
  const tr=(he,en)=>I.isEnglish?en:he;
  const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const homes={
    shlomo:(config.kehaShlomoHome||'/keha-extended/shlomo/')+'#home',
    zechariah:(config.kehaZechariahHome||'/keha-extended/zechariah/')+'#home',
    'kehat-tzadok':(config.kehaZechariahTzadokHome||'/keha-extended/zechariah-tzadok/')+'#home',
    kehat:(config.kehaKehatHome||'/keha-extended/kehat/')+'#home',
  };
  const corners=()=>[
    {id:'shlomo',person:'shlomo',symbol:'ש',name:tr('משפחת קהא','Keha family'),detail:tr('שלמה בן זכריה','Shlomo, son of Zechariah')},
    {id:'zechariah',person:'keha-zechariah',symbol:'ז',name:tr('משפחת קהא','Keha family'),detail:tr('זכריה בן שלום','Zechariah, son of Shalom')},
    {id:'kehat',person:'kehat-jidaan',symbol:'ס',name:tr('משפחת קהת','Kehat family'),detail:tr('סעדיה (ג׳ידעאן) בן אהרון','Saadia (Jidaan), son of Aharon')},
    {id:'kehat-tzadok',person:'kehat-zechariah-ben-tzadok',symbol:'ז',name:tr('משפחת קהא','Keha family'),detail:tr('זכריה בן צדוק','Zechariah, son of Tzadok')},
  ];
  function portrait(id,symbol){
    const person=window.FamilyApp?.getPersonSummary(id)||data.people[id];
    return `<span class="extended-branch-portrait">${person?.profile?`<img src="${safe(person.profile)}" alt="" decoding="async">`:`<span aria-hidden="true">${symbol}</span>`}</span>`;
  }
  function markup(){
    const families=corners().map(c=>`<a class="extended-branch-circle extended-${c.id}" data-family-corner="${c.id}" href="${safe(homes[c.id])}" aria-label="${safe(c.name+' · '+c.detail)}">${portrait(c.person,c.symbol)}<strong>${safe(c.name)}</strong><span class="extended-branch-note">${safe(c.detail)}</span></a>`).join('');
    const ancestor=(id,side,name,detail)=>`<a class="extended-ancestor extended-ancestor-${side}" href="#person/${id}" data-person="${id}"><strong>${safe(name)}</strong><span>${safe(detail)}</span></a><span class="extended-parent-line extended-parent-line-${side}" aria-hidden="true"></span>`;
    const ancestry=ancestor('keha-zechariah-father','shlomo',tr('זכריה קהא האב','Zechariah Keha the Elder'),tr('אביו של שלמה','Shlomo’s father'))+ancestor('saadia-elder','zechariah',tr('שלום קהא','Shalom Keha'),tr('אביו של זכריה','Zechariah’s father'));
    return `<div class="extended-hub-art"><span class="extended-sibling-link"><span>${tr('אחים','Brothers')}</span></span>${ancestry}<span class="extended-cousin-link"><span>${tr('בני דודים','First cousins')}</span></span><img class="extended-olive-tree" src="/assets/founder-tree-shlomo-v1.webp" alt="${tr('עץ זית במרכז ארבע משפחות קהא','An olive tree at the centre of four Keha families')}" width="1280" height="1280" fetchpriority="high">${families}<p class="extended-connection-note">${tr('קשר משפחתי ידוע','A known family connection')}<span>${tr('דרגת הקרבה לענפים התחתונים בבירור','The lower branches’ exact kinship is under research')}</span></p><span class="extended-tree-seal" aria-hidden="true">❖</span></div><p class="extended-kinship-note">${tr('הקשר בין המשפחות ידוע מתיעוד ועדויות המשפחה. שני הענפים העליונים הם בני דודים; החוליות שמחברות אל הענפים התחתונים עדיין בבירור. נישואי יעקב ויהודית מחברים בין משפחות סעדיה בן אהרון וזכריה בן צדוק.','Family records and testimony establish the connection between these families. The upper branches are first cousins; the links to the lower branches are still under research. Yaakov and Yehudit’s marriage connects Saadia son of Aharon’s family with Zechariah son of Tzadok’s family.')}</p><section class="extended-related-families" aria-label="${tr('משפחות נוספות','Other family connections')}"><button type="button" class="extended-related-circle" data-branch="yissachar">${portrait('yissachar-yosef','י')}<strong>${tr('משפחת יששכר','Yissachar family')}</strong><span>${tr('הדוד יוסף וצביה','Uncle Yosef and Tzvia')}</span></button><p>${tr('משפחה נוספת מהמעגל המשפחתי','Another family in our family circle')}<span>${tr('שורשי המשפחה ודרגת הקרבה עדיין בבירור','Its roots and exact kinship are still under research')}</span></p></section>`;
  }
  const back=()=>`<button type="button" class="extended-all-branches" data-branch="all">${tr('חזרה לקהא המורחבת','Back to the extended Keha family')}</button>`;
  function renderHome(){const home=document.getElementById('extendedKehaHomeHub');if(home)home.innerHTML=markup();}
  window.FamilyExtendedKeha={
    title:()=>tr('משפחת קהא המורחבת','The Extended Keha Family'),
    renderTree(state){
      const hub=document.getElementById('extendedKehaHub');
      document.body.dataset.extendedBranch=state.branch;
      if(hub)hub.innerHTML=state.branch==='all'?markup():back();
      if(state.branch!=='all')return false;
      document.getElementById('workspaceTitle').textContent=tr('האילן המשפחתי','Family tree');
      document.getElementById('mobileViewTitle').textContent=tr('קהא המורחבת','The extended Keha family');
      document.getElementById('workspaceSubtitle').textContent='';
      document.getElementById('workspaceDetail').hidden=true;
      return true;
    },
  };
  renderHome();
  document.addEventListener('click',event=>{
    const branch=event.target.closest('[data-branch]')?.dataset.branch;
    if(homes[branch]){event.preventDefault();event.stopPropagation();location.assign(homes[branch]);}
  },true);
  document.getElementById('extendedKehaHomeHub')?.addEventListener('click',event=>{
    if(event.target.closest('[data-branch]'))window.FamilyApp?.setView('tree');
  });
  for(const event of ['family-people-loaded','family-profile-changed','family-person-changed'])window.addEventListener(event,()=>{
    renderHome();const hub=document.getElementById('extendedKehaHub');if(hub)hub.innerHTML=document.body.dataset.extendedBranch==='all'?markup():back();
  });
})();
