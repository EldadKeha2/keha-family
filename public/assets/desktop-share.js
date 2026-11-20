(() => {
  'use strict';
  const tr=(he,en)=>window.FamilyI18n?.isEnglish?en:he;
  let dialog,opener,session=0;
  function desktop(){
    const nav=window.navigator||navigator,ua=nav.userAgent||'';
    if(nav.userAgentData?.mobile===true||/Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(ua)||(/Macintosh/i.test(ua)&&nav.maxTouchPoints>1))return false;
    return /Windows|Macintosh|Linux|CrOS/i.test(ua)||matchMedia('(min-width:701px)').matches;
  }
  function siteLink(){
    const site=document.documentElement?.dataset,url=new URL(site?.nakashHome||'.',site?.nakashOrigin||location.href),language=window.FamilyI18n?.language;
    if(language==='en-US'||language==='en-GB')url.searchParams.set('lang',language);
    return url.href;
  }
  const icons={
    whatsapp:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.5 11.7a8.5 8.5 0 0 1-12.6 7.5L3 20.5l1.3-4.8A8.5 8.5 0 1 1 20.5 11.7Z"/><path d="m8.3 7.3 1.1 2.5-.9 1c.7 1.7 1.9 2.9 3.6 3.6l1-.9 2.5 1.1c.1 1.4-1 2.1-2.1 2.1-3.4-.3-7-3.9-7.3-7.3 0-1.1.7-2.2 2.1-2.1Z"/></svg>',
    facebook:'<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M14.2 22v-8.7h2.9l.4-3.4h-3.3V7.7c0-1 .3-1.6 1.7-1.6h1.8V3.1c-.3 0-1.4-.1-2.6-.1-2.6 0-4.3 1.6-4.3 4.4v2.5H8v3.4h2.8V22Z"/></svg>',
    link:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m10 13 4-4m-5 8-1.5 1.5a4.2 4.2 0 0 1-6-6L6 8a4.2 4.2 0 0 1 6 0m3-1 1.5-1.5a4.2 4.2 0 0 1 6 6L18 16a4.2 4.2 0 0 1-6 0"/></svg>'
  };
  function ensureDialog(){
    if(dialog)return dialog;
    dialog=document.createElement('dialog');dialog.id='desktopSiteShare';dialog.className='desktop-site-share';dialog.setAttribute('data-i18n-skip','');dialog.setAttribute('aria-labelledby','desktopSiteShareTitle');
    document.body.append(dialog);
    dialog.addEventListener('close',()=>{session++;if(opener?.isConnected)opener.focus();});
    dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();});
    return dialog;
  }
  function open(trigger){
    const panel=ensureDialog();if(panel.open)return;
    opener=trigger;const token=++session,url=siteLink(),title=document.documentElement?.dataset?.nakashName||tr('בית משפחת קהא','The Keha Family Home');panel.dir=window.FamilyI18n?.isEnglish?'ltr':'rtl';
    panel.innerHTML=`<header><h2 id="desktopSiteShareTitle">${tr('שיתוף האתר','Share the website')}</h2><button type="button" data-site-share-close aria-label="${tr('סגירה','Close')}">×</button></header><div class="desktop-site-share-options"><a class="desktop-site-share-option" data-site-share-whatsapp target="_blank" rel="noopener noreferrer"><span class="desktop-site-share-icon share-whatsapp">${icons.whatsapp}</span><span>${tr('שיתוף דרך WhatsApp','Share via WhatsApp')}</span></a><a class="desktop-site-share-option" data-site-share-facebook target="_blank" rel="noopener noreferrer"><span class="desktop-site-share-icon share-facebook">${icons.facebook}</span><span>${tr('שיתוף בפייסבוק','Share on Facebook')}</span></a><button type="button" class="desktop-site-share-option" data-site-share-copy><span class="desktop-site-share-icon share-link">${icons.link}</span><span>${tr('העתקת קישור לאתר','Copy website link')}</span></button></div><p class="desktop-site-share-status" role="status" aria-live="polite"></p><input class="desktop-site-share-url" aria-label="${tr('קישור לאתר','Website link')}" readonly hidden dir="ltr">`;
    panel.querySelector('[data-site-share-whatsapp]').href='https://wa.me/?text='+encodeURIComponent(title+'\n'+url);
    panel.querySelector('[data-site-share-facebook]').href='https://www.facebook.com/sharer/sharer.php?u='+encodeURIComponent(url);
    panel.querySelector('[data-site-share-close]').addEventListener('click',()=>panel.close());
    for(const link of panel.querySelectorAll('a'))link.addEventListener('click',()=>panel.close());
    const input=panel.querySelector('input');input.value=url;
    const copy=panel.querySelector('[data-site-share-copy]'),status=panel.querySelector('[role="status"]');
    copy.addEventListener('click',async()=>{
      if(copy.disabled)return;copy.disabled=true;status.textContent='';
      try{
        await navigator.clipboard.writeText(url);
        if(!panel.open||token!==session)return;
        const message=tr('הקישור לאתר הועתק ✓','Website link copied ✓');
        if(window.FamilyApp?.toast){panel.close();window.FamilyApp.toast(message);}else status.textContent=message;
      }catch{
        if(!panel.open||token!==session)return;
        status.textContent=tr('אפשר לסמן ולהעתיק את הקישור מכאן:','Select and copy the link here:');input.hidden=false;input.focus();input.select();
      }finally{copy.disabled=false;}
    });
    trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-controls',panel.id);panel.showModal();
  }
  window.addEventListener('click',event=>{
    const trigger=event.target?.closest?.('[data-home-install-share]');
    if(!trigger||!desktop())return;
    event.preventDefault();event.stopImmediatePropagation();open(trigger);
  },{capture:true});
})();
