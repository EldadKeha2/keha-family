(() => {
  'use strict';
  const phoneQuery=matchMedia('(max-width: 700px)'),standaloneQuery=matchMedia('(display-mode: standalone)');
  let installPrompt=null,installed=false,relatedInstalled=false,installationCheck=null,busy=false,dialogKind=null,dialogReturnFocus=null,feedbackTimer;
  // Keep the browser's one-use event until the visitor explicitly asks to install.
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;update();});
  window.addEventListener('appinstalled',()=>{installed=true;installPrompt=null;update();});

  const card=document.getElementById('homeInstall'),dialog=document.getElementById('homeInstallDialog');
  if(!card||!dialog)return;
  const english=window.FamilyI18n?.isEnglish,tr=(he,en)=>english?en:he;
  const ua=navigator.userAgent||'',ios=/iPhone|iPad|iPod/i.test(ua)||(/Macintosh/i.test(ua)&&navigator.maxTouchPoints>1);
  const android=/Android/i.test(ua),embedded=/FBAN|FBAV|Instagram|WhatsApp|Line\/|; wv\)/i.test(ua);
  const url=new URL('/',location.origin),language=window.FamilyI18n?.language;
  if(['he','en-US','en-GB'].includes(language))url.searchParams.set('lang',language);
  url.hash='home';
  const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const shortcutIcon='<svg class="home-install-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="4" y="2" width="12" height="20" rx="2"/><path d="M8 18h4M19 5v8m-4-4h8"/></svg>';
  const shareIcon='<svg class="home-install-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m8.7 10.5 6.6-4m-6.6 7 6.6 4"/><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/></svg>';
  card.innerHTML='<div class="home-install-actions" data-home-install-actions><button type="button" data-home-install-action aria-label="'+tr('התקן קיצור דרך לאתר','Install site shortcut')+'" title="'+tr('התקן קיצור דרך לאתר','Install site shortcut')+'" aria-haspopup="dialog" aria-controls="homeInstallDialog">'+shortcutIcon+'<span>'+tr('קיצור דרך','Shortcut')+'</span></button><button type="button" data-home-install-share aria-label="'+tr('שיתוף האתר','Share website')+'" title="'+tr('שיתוף האתר','Share website')+'">'+shareIcon+'<span>'+tr('שיתוף','Share')+'</span></button></div><p class="home-install-status" data-home-install-status role="status" aria-live="polite"></p><p class="home-install-status" data-home-install-share-status role="status" aria-live="polite"></p>';
  const button=card.querySelector('[data-home-install-action]'),status=card.querySelector('[data-home-install-status]');
  const shareButton=card.querySelector('[data-home-install-share]'),shareStatus=card.querySelector('[data-home-install-share-status]');
  function announce(target,message){
    clearTimeout(feedbackTimer);status.textContent='';shareStatus.textContent='';target.textContent=message;
    feedbackTimer=setTimeout(()=>{target.textContent='';},5000);
  }
  function showDialog(kind,returnFocus){
    dialogKind=kind;dialogReturnFocus=returnFocus;
    dialog.querySelector('[data-home-install-close]').addEventListener('click',()=>dialog.close());
    if(!dialog.open)dialog.showModal();
    dialog.querySelector('[data-home-install-close]').focus();
  }
  function openShareFallback(){
    dialog.innerHTML='<button type="button" class="home-install-close" data-home-install-close aria-label="'+tr('סגירת השיתוף','Close sharing')+'">×</button><h2 id="homeInstallTitle">'+tr('שיתוף האתר','Share website')+'</h2><p class="home-install-dialog-intro">'+tr('לחצו לחיצה ממושכת על הקישור, העתיקו אותו ושלחו לבני המשפחה.','Press and hold the link, copy it, and send it to your family.')+'</p><div class="home-install-link-tools"><label for="homeInstallShareLink">'+tr('קישור לאתר להעתקה','Website link to copy')+'</label><input id="homeInstallShareLink" value="'+escape(url.href)+'" readonly dir="ltr"></div>';
    showDialog('share',shareButton);
    const input=dialog.querySelector('#homeInstallShareLink');input.focus();input.select();input.setSelectionRange?.(0,input.value.length);
  }
  shareButton.addEventListener('click',async()=>{
    if(shareButton.disabled)return;
    shareButton.disabled=true;shareStatus.textContent='';status.textContent='';
    try{
      if(typeof navigator.share==='function'){
        try{
          await navigator.share({title:tr('בית משפחת קהא','Keha Family Home'),text:tr('הבית שלנו מתחיל כאן. התמונות, הסיפורים והרגעים של המשפחה.','Our family home starts here. Family photos, stories and memories.'),url:url.href});
          announce(shareStatus,tr('הקישור הועבר לשיתוף','Link ready to share'));return;
        }catch(error){if(error?.name==='AbortError')return;}
      }
      try{
        await navigator.clipboard.writeText(url.href);
        announce(shareStatus,tr('הקישור הועתק','Link copied'));
      }catch{openShareFallback();}
    }finally{shareButton.disabled=false;}
  });

  function hasInstalledShortcut(){return installed||relatedInstalled||standaloneQuery.matches||navigator.standalone===true;}
  function checkInstalledShortcut(){
    if(window.top!==window||typeof navigator.getInstalledRelatedApps!=='function')return Promise.resolve();
    if(installationCheck)return installationCheck;
    const manifestURL=new URL('/manifest.webmanifest',location.origin).href,appID=new URL('/',location.origin).href;
    installationCheck=Promise.resolve().then(()=>navigator.getInstalledRelatedApps()).then(apps=>{
        relatedInstalled=apps.some(app=>app.platform==='webapp'&&(app.url===manifestURL||app.id===appID));
        if(relatedInstalled)installPrompt=null;
        update();
    }).catch(()=>{}).finally(()=>{installationCheck=null;});
    return installationCheck;
  }
  function update(){
    if(!card)return;
    const isInstalled=hasInstalledShortcut();
    card.hidden=!(phoneQuery.matches||navigator.userAgentData?.mobile);
    button.hidden=false;status.hidden=false;
    button.setAttribute('aria-haspopup',isInstalled?'false':'dialog');
    card.querySelector('[data-home-install-actions]').setAttribute('data-installed',String(isInstalled));
    if(isInstalled&&dialog.open&&dialogKind==='install')dialog.close();
  }
  function steps(items){return '<ol>'+items.map(item=>'<li>'+item+'</li>').join('')+'</ol>';}
  function appleHelp(){return steps([
    tr('פתחו את האתר ב Safari והקישו על כפתור השיתוף <span class="home-install-share" aria-hidden="true">↑</span>.','Open the website in Safari and tap Share <span class="home-install-share" aria-hidden="true">↑</span>.'),
    tr('בחרו ״הוספה למסך הבית״. לפעמים צריך לגלול ברשימת הפעולות כדי למצוא אותה.','Choose “Add to Home Screen”. You may need to scroll through the actions to find it.'),
    tr('אשרו את השם והקישו ״הוסף״. אם מוצגת האפשרות ״פתיחה כיישום אינטרנט״, השאירו אותה פעילה.','Confirm the name and tap “Add”. If “Open as Web App” appears, leave it enabled.')
  ]);}
  function androidHelp(){return steps([
    tr('פתחו את האתר ב Chrome והקישו על תפריט שלוש הנקודות ⋮.','Open the website in Chrome and tap the three-dot menu ⋮.'),
    tr('בחרו ״הוספה למסך הבית״ או ״התקנת אפליקציה״, לפי מה שמופיע בדפדפן.','Choose “Add to Home screen” or “Install app”, depending on the option your browser shows.'),
    tr('אשרו את ההוספה. הסמל יופיע במסך הבית של הטלפון.','Confirm the addition. The icon will appear on your phone’s home screen.')
  ]);}
  function openHelp(){
    const embeddedNote=embedded?'<p class="home-install-browser-note">'+tr('האתר פתוח כרגע בתוך אפליקציה. העתיקו את הקישור ופתחו אותו ב Safari באייפון או ב Chrome באנדרואיד, ואז בצעו את השלבים הבאים.','This page is open inside another app. Copy the link and open it in Safari on iPhone or Chrome on Android, then follow these steps.')+'</p>':'';
    const help=ios?appleHelp():android?androidHelp():'<h3>iPhone / iPad</h3>'+appleHelp()+'<h3>Android</h3>'+androidHelp();
    dialog.innerHTML='<button type="button" class="home-install-close" data-home-install-close aria-label="'+tr('סגירת ההנחיות','Close instructions')+'">×</button><img class="home-install-dialog-icon" src="assets/app-icons/icon-192.png" width="64" height="64" alt=""><h2 id="homeInstallTitle">'+tr('מוסיפים את הבית שלנו למסך הבית','Add our family to your home screen')+'</h2><p class="home-install-dialog-intro">'+tr('עוד רגע והמשפחה במרחק נגיעה.','Keep the family just one tap away.')+'</p>'+embeddedNote+help+'<div class="home-install-link-tools"><button type="button" data-home-install-copy>'+tr('העתקת קישור לאתר','Copy website link')+'</button><p data-home-install-copy-status role="status" aria-live="polite"></p><label for="homeInstallLink" hidden>'+tr('קישור לאתר להעתקה','Website link to copy')+'</label><input id="homeInstallLink" value="'+escape(url.href)+'" readonly dir="ltr" hidden></div>';
    dialog.querySelector('[data-home-install-copy]').addEventListener('click',async()=>{
      const copyStatus=dialog.querySelector('[data-home-install-copy-status]');
      try{
        await navigator.clipboard.writeText(url.href);
        copyStatus.textContent=tr('הקישור הועתק. אפשר להדביק אותו בדפדפן.','Link copied. You can paste it into your browser.');
      }catch{
        const input=dialog.querySelector('#homeInstallLink');input.hidden=false;
        dialog.querySelector('label[for="homeInstallLink"]').hidden=false;
        input.focus();input.select();input.setSelectionRange?.(0,input.value.length);
        copyStatus.textContent=tr('לחצו לחיצה ממושכת על הקישור המסומן ובחרו ״העתק״.','Press and hold the selected link and choose “Copy”.');
      }
    });
    showDialog('install',button);
  }
  button.addEventListener('click',async()=>{
    if(busy||button.hidden)return;
    if(hasInstalledShortcut()){
      announce(status,tr('קיצור הדרך כבר מותקן','The shortcut is already installed'));
      return;
    }
    if(!installPrompt){
      if(window.top===window&&typeof navigator.getInstalledRelatedApps==='function')await checkInstalledShortcut();
      if(hasInstalledShortcut())announce(status,tr('קיצור הדרך כבר מותקן','The shortcut is already installed'));
      else openHelp();
      return;
    }
    const prompt=installPrompt;installPrompt=null;busy=true;button.disabled=true;status.textContent='';shareStatus.textContent='';
    try{
      await prompt.prompt();
      const choice=await prompt.userChoice;
      announce(status,choice?.outcome==='accepted'?tr('השלימו את ההוספה בטלפון.','Finish adding it on your phone.'):tr('לחצו שוב להנחיות ההוספה.','Tap again for installation instructions.'));
    }catch{openHelp();}
    finally{busy=false;button.disabled=false;update();}
  });
  dialog.addEventListener('click',event=>{
    if(event.target!==dialog)return;
    const rect=dialog.getBoundingClientRect();
    if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();
  });
  dialog.addEventListener('close',()=>{if(!card.hidden)(dialogReturnFocus===button&&button.hidden?shareButton:dialogReturnFocus||shareButton).focus();dialogKind=null;});
  for(const query of [phoneQuery,standaloneQuery])query.addEventListener?.('change',update);
  window.addEventListener('pageshow',()=>{update();void checkInstalledShortcut();});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void checkInstalledShortcut();});
  update();void checkInstalledShortcut();
})();
