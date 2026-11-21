(() => {
  'use strict';
  const config=document.documentElement.dataset;
  if(!config.branchPortal)return;
  const I=window.FamilyI18n;
  const name=()=>I.isEnglish?config.branchNameEn:config.nakashName;
  const treeLink=document.querySelector('[data-extended-tree-link]'),installLink=document.querySelector('[data-extended-install-link]');
  if(treeLink)treeLink.textContent=I.isEnglish?'The extended Keha family':'קהא המורחבת';
  if(installLink)installLink.textContent=I.isEnglish?'Install the extended family site':'התקנת קהא המורחבת';
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
