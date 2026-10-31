(() => {
  'use strict';
  if(!window.FAMILY_CLOUD)return;
  const actions=document.createElement('div');actions.className='cloud-actions';
  const backup=document.createElement('a');backup.href='api/export';backup.download='family-backup.json';backup.textContent='הורדת גיבוי נתונים';
  actions.append(backup);document.querySelector('.site-footer').append(actions);
  fetch('api/setup',{cache:'no-store'}).then(response=>response.json()).then(result=>{
    if(result.mediaConfigured===false){
      const notice=document.createElement('p');notice.className='cloud-setup-notice';
      notice.textContent='החיבור לאחסון המדיה עדיין בהגדרה. אפשר לעדכן תאריכים ולכתוב סיפורים; העלאת קבצים תתאפשר לאחר השלמת החיבור.';
      document.querySelector('.workspace-header').after(notice);
    }
  }).catch(()=>{});
})();
