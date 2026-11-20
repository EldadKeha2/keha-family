(() => {
  'use strict';
  const I=window.FamilyI18n,section=document.getElementById('founderTreeView');
  if(!section)return;
  const tr=(he,en)=>I.isEnglish?en:he;
  const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const trees={
    shlomo:{image:'assets/founder-tree-shlomo-v1.webp',thumb:'assets/founder-tree-shlomo-thumb-v1.webp',person:()=>tr('סבא שלמה','Grandpa Shlomo'),family:()=>tr('שורשי משפחת קהא','The roots of the Keha family'),alt:()=>tr('איור עץ זית עם גזע עתיק, ענפים ועלים ירוקים','Illustrated olive tree with an ancient trunk, branches and green leaves')},
    yona:{image:'assets/founder-tree-yona-v1.webp',thumb:'assets/founder-tree-yona-thumb-v1.webp',person:()=>tr('סבתא יונה','Grandma Yona'),family:()=>tr('שורשי משפחת נקאש','The roots of the Nakash family'),alt:()=>tr('איור עץ תאנה עם גזע מתפתל, ענפים ועלים ירוקים','Illustrated fig tree with a winding trunk, branches and green leaves')}
  };
  const title=id=>tr('העץ המלא של ','The full family tree of ')+trees[id].person();
  const linkLabel=id=>tr('לעץ המלא של ','The full family tree of ')+trees[id].person();
  const treeHref=id=>location.protocol!=='file:'?(id==='yona'?'/nakash/inside/':'https://family-extended.eldadkeha.workers.dev/keha-extended/'):'#founder-tree/'+id;
  function linkHTML(id){
    const tree=trees[id];if(!tree)return '';
    return `<a class="founder-tree-link" href="${treeHref(id)}" data-founder-tree="${id}" aria-label="${safe(linkLabel(id))}"><svg class="founder-tree-arrow" viewBox="0 0 48 32" aria-hidden="true"><path d="M3 27C13 10 25 8 43 12m-7-8 8 8-9 5"/></svg><img src="${tree.thumb}" alt="" width="154" height="154" decoding="async"><span><span>${tr('לעץ המלא של','The full family tree of')}</span><strong>${tree.person()}</strong></span></a>`;
  }
  function render(){
    if(section.hidden)return;
    const id=location.hash.split('/')[1],tree=Object.hasOwn(trees,id)?trees[id]:null;
    const heading=tree?title(id):tr('העצים המשפחתיים','Our family trees');
    for(const key of ['workspaceTitle','mobileViewTitle']){const node=document.getElementById(key);if(node)node.textContent=heading;}
    const subtitle=document.getElementById('workspaceSubtitle');if(subtitle)subtitle.textContent=tree?tree.family():tr('לכל משפחה, שורשים משלה','Every family has its own roots');
    section.setAttribute('aria-label',heading);
    const back=`<a class="founder-tree-back" href="#tree" data-founder-back>${tr('חזרה לאילן המשפחתי','Back to the family tree')}</a>`;
    if(!tree){section.innerHTML=`<nav class="founder-tree-navigation">${back}</nav><div class="founder-tree-choice">${Object.keys(trees).map(linkHTML).join('')}</div>`;return;}
    const person=window.FamilyApp?.getPersonSummary(id)||window.FAMILY_DATA.people[id],name=I.personName(person);
    const initials=name.split(/\s+/).filter(Boolean).map(part=>part[0]).slice(0,2).join('');
    const portrait=person.profile?`<img class="profile-photo" ${window.FamilyPhotoFraming?.profile(person)||''} src="${safe(person.profile)}" alt="" width="84" height="96" decoding="async">`:`<span>${safe(initials)}</span>`;
    const other=id==='shlomo'?'yona':'shlomo';
    const openNakash=id==='yona'&&location.protocol!=='file:'?`<a class="founder-tree-other" href="${treeHref(id)}">${tr('לאילן היוחסין של משפחת נקאש','Open the Nakash family tree')}</a>`:'';
    section.innerHTML=`<nav class="founder-tree-navigation">${back}${openNakash}<a class="founder-tree-other" href="${treeHref(other)}">${safe(tr('לעץ של ','The tree of ')+trees[other].person())}</a></nav><figure class="founder-tree-figure" data-founder-canvas="${id}"><img class="founder-tree-art" src="${tree.image}" alt="${safe(tree.alt())}" width="1280" height="1280" fetchpriority="high" decoding="async"><figcaption><a class="founder-tree-person" href="#person/${id}" aria-label="${safe(tr('פתיחת העמוד האישי של ','Open the personal page of ')+name)}"><span class="founder-tree-portrait">${portrait}</span><strong>${safe(name)}</strong></a></figcaption></figure>`;
  }
  function activate(view){section.hidden=view!=='founder-tree';render();}
  section.addEventListener('click',event=>{
    if(!event.target.closest('[data-founder-back]')||event.button>0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
    event.preventDefault();
    if(window.FamilyNavigation){if(!window.FamilyNavigation.returnTo('#tree'))window.FamilyApp.setView('tree',false);}
    else window.FamilyApp.setView('tree');
  });
  for(const event of ['hashchange','popstate','family-people-loaded','family-person-changed','family-profile-changed'])window.addEventListener(event,render);
  window.FamilyFounderTrees={activate,linkHTML};
})();
