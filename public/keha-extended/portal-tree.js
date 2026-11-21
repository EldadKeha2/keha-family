(() => {
  'use strict';
  if(document.documentElement.dataset.branchPortal!=='kehat')return;
  const I=window.FamilyI18n,tr=(he,en)=>I.isEnglish?en:he;
  const triHome=((document.documentElement.dataset.kehaExtendedHome||'https://family-extended.eldadkeha.workers.dev/keha-extended/')+'#tree/yissachar').replace(/&/g,'&amp;').replace(/"/g,'&quot;');
  window.FamilyExtendedKeha={
    title:()=>tr('משפחת קהת','Kehat Family'),
    renderTree(state){
      const root=document.getElementById('kehatPortalOverview'),overview=state.branch==='all';
      document.body.dataset.kehatOverview=String(overview);root.hidden=!overview;
      if(!overview)return false;
      root.innerHTML=`<div class="kehat-portal-roots"><button class="kehat-portal-circle" type="button" data-branch="kehat-tzadok"><span aria-hidden="true">❖</span><strong>${tr('ענף צדוק','Tzadok branch')}</strong><small>${tr('זכריה בן צדוק קהת','Zechariah Kehat, son of Tzadok')}</small></button><button class="kehat-portal-circle" type="button" data-branch="kehat"><span aria-hidden="true">❖</span><strong>${tr('ענף אהרון','Aharon branch')}</strong><small>${tr('סעדיה (ג׳ידעאן) בן אהרון קהת','Saadia (Jidaan) Kehat, son of Aharon')}</small></button></div><p class="kehat-portal-note">${tr('שני הענפים מתחברים בנישואי יעקב ויהודית ב־1947. הקרבה בין הסבים אהרון וצדוק עדיין בבירור.','The branches meet through Yaakov and Yehudit’s 1947 marriage. The relationship between their grandfathers Aharon and Tzadok is still under research.')}</p><p class="kehat-portal-note"><a href="${triHome}">${tr('לענף זכריה ויונה קהא טירי · עשרת האחים','Zechariah and Yona Keha Tiri · ten siblings')}</a></p>`;
      document.getElementById('workspaceTitle').textContent=tr('אילן היוחסין של משפחת קהת','The Kehat family tree');
      document.getElementById('mobileViewTitle').textContent=tr('משפחת קהת','Kehat Family');
      document.getElementById('workspaceSubtitle').textContent=tr('בחרו ענף כדי להכיר את בני המשפחה','Choose a branch to explore the family');
      document.getElementById('workspaceDetail').hidden=true;
      return true;
    },
  };
})();
