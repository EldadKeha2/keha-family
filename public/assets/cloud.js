(() => {
  'use strict';
  if(!window.FAMILY_CLOUD)return;
  const actions=document.createElement('div');actions.className='cloud-actions';
  const backup=document.createElement('a');backup.href='api/export';backup.download='family-backup.json';backup.textContent='הורדת גיבוי נתונים';
  const logout=document.createElement('button');logout.type='button';logout.textContent='יציאה';
  logout.addEventListener('click',async()=>{
    logout.disabled=true;
    try{
      const result=await fetch('auth/logout',{method:'POST',headers:{'X-Family-Token':window.FAMILY_API_TOKEN}});
      if(!result.ok)throw Error();location.assign('/');
    }catch{logout.disabled=false;window.FamilyApp?.toast('לא ניתן לצאת כרגע. נסו שוב.');}
  });
  actions.append(backup,logout);document.querySelector('.site-footer').append(actions);
  fetch('api/setup',{cache:'no-store'}).then(response=>response.json()).then(result=>{
    if(result.mediaConfigured===false){
      const notice=document.createElement('p');notice.className='cloud-setup-notice';
      notice.textContent='החיבור לאחסון המדיה עדיין בהגדרה. אפשר לעדכן תאריכים ולכתוב סיפורים; העלאת קבצים תתאפשר לאחר השלמת החיבור.';
      document.querySelector('.workspace-header').after(notice);
    }
  }).catch(()=>{});
})();
