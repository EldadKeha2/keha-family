(() => {
  'use strict';
  const config=document.documentElement.dataset;
  if(!config.branchPortal)return;
  const I=window.FamilyI18n;
  const name=()=>I.isEnglish?config.branchNameEn:config.nakashName;
  const tr=(he,en)=>I.isEnglish?en:he;
  const dialog=document.getElementById('extendedKehaDialog');
  let returnFocus=null;
  for(const trigger of document.querySelectorAll('[data-extended-open]')){
    trigger.querySelector('[data-extended-label]').textContent=trigger.dataset.extendedOpen==='header'
      ?tr('לאתר קהא המורחבת','Visit extended Keha')
      :tr('לאתר משפחת קהא המורחבת','The extended Keha family site');
  }
  if(dialog){
    const labels=[
      ['#extendedKehaTitle','קהא המורחבת','The extended Keha family'],
      ['[data-extended-intro]','איך תרצו לפתוח את אתר המשפחה?','How would you like to open the family site?'],
      ['[data-extended-install-title]','התקנת האתר במסך הבית','Add the site to your home screen'],
      ['[data-extended-install-note]','קיצור ישיר לאתר קהא המורחבת','A shortcut to the extended Keha family site'],
      ['[data-extended-visit-title]','מעבר לאתר','Visit the site'],
      ['[data-extended-visit-note]','לכל ענפי משפחת קהא המורחבת','Explore all branches of the extended family'],
    ];
    for(const [selector,he,en] of labels)dialog.querySelector(selector).textContent=tr(he,en);
    dialog.querySelector('[data-extended-close]').setAttribute('aria-label',tr('סגירה','Close'));
    if(['he','en-US','en-GB'].includes(I.language))for(const link of dialog.querySelectorAll('a')){
      const url=new URL(link.getAttribute('href'));url.searchParams.set('lang',I.language);link.href=url.href;
    }
    document.addEventListener('click',event=>{
      const trigger=event.target.closest('[data-extended-open]');
      if(trigger){
        event.preventDefault();returnFocus=trigger;
        const mobile=document.getElementById('mobileNavDialog');
        if(mobile?.open){mobile.close();returnFocus=document.getElementById('mobileMenuToggle');}
        const desktop=document.getElementById('desktopMenuDropdown');
        if(desktop&&!desktop.hidden){
          desktop.hidden=true;document.getElementById('desktopMenuToggle').setAttribute('aria-expanded','false');
          if(desktop.contains(trigger))returnFocus=document.getElementById('desktopMenuToggle');
        }
        if(!dialog.open)dialog.showModal();
      }else if(event.target.closest('[data-extended-close]'))dialog.close();
    });
    dialog.addEventListener('close',()=>returnFocus?.focus());
    dialog.addEventListener('click',event=>{
      if(event.target!==dialog)return;
      const rect=dialog.getBoundingClientRect();
      if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();
    });
    document.addEventListener('DOMContentLoaded',()=>{
      for(const id of ['homeTiles','mobileMenuTiles','desktopMenuTiles']){
        const tree=document.querySelector('#'+id+' .home-tile-tree');if(!tree)continue;
        const tile=document.createElement('button');tile.type='button';tile.className='home-tile home-tile-extended';
        tile.dataset.extendedOpen='menu';tile.setAttribute('aria-haspopup','dialog');tile.setAttribute('aria-controls',dialog.id);
        tile.innerHTML='<span class="home-tile-icon" aria-hidden="true"><img src="/keha-extended/brand.svg" alt="" width="48" height="48"></span><span><strong>'+tr('לאתר משפחת קהא המורחבת','The extended Keha family site')+'</strong><small>'+tr('מעבר לאתר או התקנה במסך הבית','Visit the site or add it to your home screen')+'</small></span>';
        tree.after(tile);
      }
    });
  }
  window.FamilyExtendedKeha={
    title:name,
    renderTree(state){
      // Each single-family portal opens its full tree directly.
      if(window.FAMILY_DATA.branches.length===1&&state.branch==='all')state.mode='full';
      document.getElementById('workspaceTitle').textContent=(I.isEnglish?'The family tree of ':'האילן המשפחתי של ')+name();
      document.getElementById('mobileViewTitle').textContent=name();
      return false;
    },
  };
})();
