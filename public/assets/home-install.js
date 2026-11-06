(() => {
  'use strict';
  const phoneQuery=matchMedia('(max-width: 700px)'),standaloneQuery=matchMedia('(display-mode: standalone)');
  let installPrompt=null,installed=false,relatedInstalled=false,installationCheck=null,busy=false,dialogKind=null,dialogReturnFocus=null,feedbackTimer,invitationOffered=false;
  let installState='idle',attemptActive=false,installWaitTimer=null,successConfirmedByUser=false;
  // Keep the browser's one-use event until the visitor explicitly asks to install.
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;update();});
  // Chromium may emit appinstalled before Android finishes creating the package.
  // Wait for an installed-app check, standalone launch, or the visitor's confirmation.
  window.addEventListener('appinstalled',()=>{installPrompt=null;if(attemptActive&&!hasInstalledShortcut())waitForInstallation();void checkInstalledShortcut();update();});

  const card=document.getElementById('homeInstall'),dialog=document.getElementById('homeInstallDialog');
  if(!card||!dialog)return;
  let english=Boolean(window.FamilyI18n?.isEnglish);const tr=(he,en)=>english?en:he;
  const ua=navigator.userAgent||'',ios=/iPhone|iPad|iPod/i.test(ua)||(/Macintosh/i.test(ua)&&navigator.maxTouchPoints>1);
  const android=/Android/i.test(ua),embedded=/FBAN|FBAV|Instagram|WhatsApp|Line\/|; wv\)/i.test(ua);
  const mobileDevice=ios||android||navigator.userAgentData?.mobile===true||/Mobile|Tablet/i.test(ua);
  const url=new URL('/',location.origin),language=window.FamilyI18n?.language;
  if(['he','en-US','en-GB'].includes(language))url.searchParams.set('lang',language);
  url.hash='home';
  const invitationURL=new URL(url.href);invitationURL.searchParams.set('install','1');
  const installationInvitation=new URLSearchParams(location.search).get('install')==='1';
  const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const shortcutIcon='<svg class="home-install-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="4" y="2" width="12" height="20" rx="2"/><path d="M8 18h4M19 5v8m-4-4h8"/></svg>';
  const shareIcon='<svg class="home-install-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m8.7 10.5 6.6-4m-6.6 7 6.6 4"/><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/></svg>';
  card.innerHTML='<div class="home-install-actions" data-home-install-actions><button type="button" data-home-install-action aria-label="'+tr('התקן קיצור דרך לאתר','Install site shortcut')+'" title="'+tr('התקן קיצור דרך לאתר','Install site shortcut')+'" aria-haspopup="dialog" aria-controls="homeInstallDialog">'+shortcutIcon+'<span>'+tr('התקן','Install')+'</span></button><button type="button" data-home-install-share aria-label="'+tr('שיתוף האתר','Share website')+'" title="'+tr('שיתוף האתר','Share website')+'">'+shareIcon+'<span>'+tr('שיתוף','Share')+'</span></button></div><p class="home-install-status" data-home-install-status role="status" aria-live="polite"></p><p class="home-install-status" data-home-install-share-status role="status" aria-live="polite"></p>';
  const button=card.querySelector('[data-home-install-action]'),status=card.querySelector('[data-home-install-status]');
  const shareButton=card.querySelector('[data-home-install-share]'),shareStatus=card.querySelector('[data-home-install-share-status]');
  function announce(target,message){
    clearTimeout(feedbackTimer);status.textContent='';shareStatus.textContent='';target.textContent=message;
    const inline=dialog.open?dialog.querySelector('[data-home-install-invite-status]')||dialog.querySelector('[data-home-install-help-status]'):null;if(target===status&&inline)inline.textContent=message;
    feedbackTimer=setTimeout(()=>{target.textContent='';if(inline)inline.textContent='';},5000);
  }
  function closeDialog(){
    if(typeof dialog.close==='function')dialog.close();
    else{dialog.open=false;dialog.removeAttribute('open');dialog.dispatchEvent(new Event('close'));}
  }
  function continueToSite(){
    closeDialog();
    if(english!==Boolean(window.FamilyI18n?.isEnglish)&&typeof location.assign==='function'){
      const nextLanguage=english?'en-US':'he';url.searchParams.set('lang',nextLanguage);
      try{localStorage.setItem('keha-family-language',nextLanguage);}catch{}
      location.assign(url.href);
    }
  }
  function showDialog(kind,returnFocus){
    dialogKind=kind;dialogReturnFocus=returnFocus;
    dialog.setAttribute('dir',english?'ltr':'rtl');
    dialog.querySelector('[data-home-install-close]').addEventListener('click',()=>closeDialog());
    dialog.querySelector('[data-home-install-language]')?.addEventListener('click',()=>{
      const currentKind=dialogKind,currentFocus=dialogReturnFocus;english=!english;
      invitationURL.searchParams.set('lang',english?'en-US':'he');
      if(currentKind==='invite')openInvitation(currentFocus);else if(currentKind==='install')openHelp(currentFocus);else if(currentKind==='success')openSuccess(currentFocus);
    });
    dialog.querySelector('[data-home-install-check-icon]')?.addEventListener('click',()=>completeInstallation(true));
    if(!dialog.open){
      if(typeof dialog.showModal==='function')dialog.showModal();
      else{dialog.open=true;dialog.setAttribute('open','');dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.classList?.add('home-install-dialog-fallback');}
    }
    dialog.querySelector('[data-home-install-close]').focus();
  }
  function languageControl(){return '<button type="button" class="home-install-language" data-home-install-language lang="en" dir="ltr">'+(english?'Hebrew':'English Translate')+'</button>';}
  function welcomeArt(){return '<div class="home-install-welcome" data-home-install-welcome><img class="home-install-yona" src="assets/install/yona-invite.webp" width="640" height="640" alt="'+tr('סבתא יונה מחייכת ומזמינה אתכם להתקין','Grandma Yona smiles and invites you to install')+'"></div>';}
  function platformLogos(){return '<div class="home-install-platforms" data-home-install-platforms dir="ltr"><span class="home-install-platform"><svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false" fill="#3c8b45"><path d="m7.2 4.4-1.4-2 .7-.5L8 4.1a9 9 0 0 1 8 0l1.5-2.2.7.5-1.4 2A6.7 6.7 0 0 1 20 10H4a6.7 6.7 0 0 1 3.2-5.6ZM4 11h16v8a2 2 0 0 1-2 2h-1v2h-3v-2h-4v2H7v-2H6a2 2 0 0 1-2-2Zm-3 0h2v8H1Zm20 0h2v8h-2Z"/><circle cx="8" cy="7" r=".8" fill="#fcf8ed"/><circle cx="16" cy="7" r=".8" fill="#fcf8ed"/></svg><span>Android</span></span><span class="home-install-platform"><svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.78 3.08.84 1.18-.24 2.31-.97 3.57-.88 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01ZM12.03 7.25C11.88 5.02 13.69 3.17 15.77 3c.29 2.58-2.34 4.5-3.74 4.25Z"/></svg><span>iPhone / iPad</span></span></div>';}
  function progressControl(){return '<div class="home-install-progress" data-home-install-progress role="progressbar" aria-label="'+tr('ממתינים להתקנה בטלפון','Waiting for installation on your phone')+'" hidden><span aria-hidden="true"></span></div>';}
  function iconConfirmation(hidden=false){return '<button type="button" class="home-install-invite-browse home-install-check-icon" data-home-install-check-icon'+(hidden?' hidden':'')+'>'+tr('האייקון מופיע במסך הבית','The icon is on my home screen')+'</button>';}
  function installMessage(){return installState==='requesting'?tr('ממתינים לאישור בטלפון…','Waiting for your phone’s approval…'):installState==='pending'?tr('הבקשה אושרה. ממתינים לסיום ההתקנה בטלפון…','Request approved. Waiting for your phone to finish installing…'):installState==='unknown'?tr('הטלפון לא שלח אישור סיום. בדקו אם האייקון מופיע במסך הבית.','Your phone did not confirm completion. Check whether the icon is on your home screen.'):'';}
  function clearInstallWait(){clearTimeout(installWaitTimer);installWaitTimer=null;}
  function waitForInstallation(){
    if(hasInstalledShortcut()||installState==='done')return;
    installState='pending';clearTimeout(feedbackTimer);update();
    if(installWaitTimer!==null)return;
    installWaitTimer=setTimeout(async()=>{
      installWaitTimer=null;await checkInstalledShortcut();
      if(attemptActive&&!hasInstalledShortcut()){installState='unknown';update();}
    },20000);
  }
  function completeInstallation(byUser=false){
    const showSuccess=dialog.open&&['invite','install','success'].includes(dialogKind),returnFocus=dialogReturnFocus||button;
    installed=true;attemptActive=false;installState='done';successConfirmedByUser=byUser;installPrompt=null;clearInstallWait();clearTimeout(feedbackTimer);
    status.textContent=tr('ההתקנה הושלמה','Installation complete');
    if(showSuccess)openSuccess(returnFocus);else announce(status,tr('ההתקנה הושלמה','Installation complete'));
    update();
  }
  function openSuccess(returnFocus=button){
    dialog.innerHTML='<button type="button" class="home-install-close" data-home-install-close aria-label="'+tr('סגירה','Close')+'">×</button>'+languageControl()+'<div class="home-install-success-mark" aria-hidden="true">✓</div><div data-home-install-success role="status" aria-live="polite"><h2 id="homeInstallTitle">'+(successConfirmedByUser?tr('האייקון מוכן!','Your icon is ready!'):tr('ההתקנה הושלמה','Installation complete'))+'</h2><p class="home-install-dialog-intro">'+tr('בית משפחת קהא במרחק נגיעה.','Keha Family Home is just a tap away.')+'</p></div><button type="button" class="home-install-invite-primary" data-home-install-success-browse>'+tr('להמשיך לאתר','Continue to the website')+'</button>';
    dialog.querySelector('[data-home-install-success-browse]').addEventListener('click',continueToSite);showDialog('success',returnFocus);
  }
  function openShareFallback(){
    dialog.innerHTML='<button type="button" class="home-install-close" data-home-install-close aria-label="'+tr('סגירת השיתוף','Close sharing')+'">×</button><h2 id="homeInstallTitle">'+tr('שולחים קישור להתקנה','Share an installation link')+'</h2><p class="home-install-dialog-intro">'+tr('הקישור יפתח אצל בני המשפחה את אפשרות הוספת האתר למסך הבית. העתיקו אותו ושלחו בווטסאפ.','This link opens the option to add the website to your family’s home screen. Copy it and send it on WhatsApp.')+'</p><div class="home-install-link-tools"><label for="homeInstallShareLink">'+tr('קישור להתקנת קיצור דרך','Shortcut installation link')+'</label><input id="homeInstallShareLink" value="'+escape(invitationURL.href)+'" readonly dir="ltr"></div>';
    showDialog('share',shareButton);
    const input=dialog.querySelector('#homeInstallShareLink');input.focus();input.select();input.setSelectionRange?.(0,input.value.length);
  }
  shareButton.addEventListener('click',async()=>{
    if(shareButton.disabled)return;
    shareButton.disabled=true;shareStatus.textContent='';status.textContent='';
    try{
      if(typeof navigator.share==='function'){
        try{
          await navigator.share({title:tr('בית משפחת קהא','Keha Family Home'),text:tr('בית משפחת קהא במסך הבית שלכם. פתחו את הקישור ולחצו ״התקן״.','Keha Family Home on your home screen. Open the link and tap “Install”.'),url:invitationURL.href});
          announce(shareStatus,tr('הקישור הועבר לשיתוף','Link ready to share'));return;
        }catch(error){if(error?.name==='AbortError')return;}
      }
      try{
        await navigator.clipboard.writeText(invitationURL.href);
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
    if(isInstalled&&attemptActive){completeInstallation();return;}
    card.hidden=!(phoneQuery.matches||navigator.userAgentData?.mobile);
    button.hidden=false;status.hidden=false;
    button.setAttribute('aria-haspopup',isInstalled?'false':'dialog');
    card.querySelector('[data-home-install-actions]').setAttribute('data-installed',String(isInstalled));
    button.disabled=busy;
    if(isInstalled&&dialog.open&&dialogKind==='install')closeDialog();
    if(dialog.open&&dialogKind==='invite'){
      if(isInstalled&&!dialog.querySelector('[data-home-install-invite-installed]'))openInvitation();
      const action=dialog.querySelector('[data-home-install-invite-start]');
      if(action){action.disabled=busy||installState==='pending';action.textContent=tr('התקן','Install');}
    }
    if(dialog.open&&dialogKind==='install'){
      const action=dialog.querySelector('[data-home-install-native-start]'),instructions=dialog.querySelector('[data-home-install-instructions]');
      if(action){action.hidden=!installPrompt&&!busy;action.disabled=busy||installState==='pending';}
      if(instructions)instructions.hidden=Boolean(installPrompt)||busy||installState==='pending';
    }
    const waiting=installState==='requesting'||installState==='pending',message=installMessage();
    if(dialog.open&&['invite','install'].includes(dialogKind)){
      const progress=dialog.querySelector('[data-home-install-progress]'),confirmation=dialog.querySelector('[data-home-install-check-icon]'),inline=dialog.querySelector('[data-home-install-invite-status]')||dialog.querySelector('[data-home-install-help-status]');
      if(progress)progress.hidden=!waiting;
      if(confirmation&&dialogKind==='invite')confirmation.hidden=!attemptActive;
      if(inline&&message)inline.textContent=message;
    }
    if(message)status.textContent=message;
  }
  function steps(items){return '<ol>'+items.map(item=>'<li>'+item+'</li>').join('')+'</ol>';}
  function appleHelp(){return steps([
    tr('ב־Safari לחצו על שיתוף <span class="home-install-share" aria-hidden="true">↑</span> ובחרו ״הוספה למסך הבית״.','In Safari, tap Share <span class="home-install-share" aria-hidden="true">↑</span> and choose “Add to Home Screen”.'),
    tr('לחצו ״הוסף״. אייקון האתר יופיע במסך הבית.','Tap “Add”. The website icon will appear on your home screen.')
  ]);}
  function androidHelp(){return steps([
    tr('ב־Chrome פתחו את התפריט ⋮ ובחרו ״התקנת אפליקציה״ או ״הוספה למסך הבית״.','In Chrome, open the ⋮ menu and choose “Install app” or “Add to Home screen”.'),
    tr('אשרו ״התקן״ או ״הוסף״. אייקון האתר יופיע במסך הבית.','Confirm “Install” or “Add”. The website icon will appear on your home screen.')
  ]);}
  function openHelp(returnFocus=button){
    const embeddedNote=embedded?'<p class="home-install-browser-note">'+tr('בתפריט ⋮ או השיתוף של האפליקציה בחרו ״פתיחה בדפדפן״. אחרי הפתיחה לחצו שוב ״התקן״.','In this app’s ⋮ or Share menu, choose “Open in browser”. Then tap “Install” again.')+'</p>':'';
    const help=ios?appleHelp():android?androidHelp():'<h3>iPhone / iPad</h3>'+appleHelp()+'<h3>Android</h3>'+androidHelp();
    dialog.innerHTML='<button type="button" class="home-install-close" data-home-install-close aria-label="'+tr('סגירת ההנחיות','Close instructions')+'">×</button>'+languageControl()+'<img class="home-install-dialog-icon" src="assets/app-icons/icon-192.png" width="64" height="64" alt=""><h2 id="homeInstallTitle">'+tr('התקנת בית משפחת קהא','Install Keha Family Home')+'</h2><button type="button" class="home-install-invite-primary" data-home-install-native-start hidden>'+tr('התקן','Install')+'</button>'+progressControl()+'<div data-home-install-instructions>'+embeddedNote+help+'</div><p class="home-install-invite-status" data-home-install-help-status role="status" aria-live="polite"></p>'+iconConfirmation();
    dialog.querySelector('[data-home-install-native-start]').addEventListener('click',()=>requestInstallation(true));
    showDialog('install',returnFocus);
    update();
  }
  function openInvitation(returnFocus=shareButton){
    const alreadyInstalled=hasInstalledShortcut();
    dialog.innerHTML='<button type="button" class="home-install-close" data-home-install-close aria-label="'+tr('סגירת ההזמנה','Close invitation')+'">×</button>'+languageControl()+'<img class="home-install-dialog-icon" src="assets/app-icons/icon-192.png" width="64" height="64" alt=""><h2 id="homeInstallTitle">'+(alreadyInstalled?tr('הבית שלנו כבר אצלכם','Our home is already with you'):tr('התקנת בית משפחת קהא','Install Keha Family Home'))+'</h2>'+(alreadyInstalled?'<p class="home-install-dialog-intro" data-home-install-invite-installed>'+tr('קיצור הדרך כבר מותקן בטלפון הזה. אפשר להמשיך ישר לאתר.','The shortcut is already installed on this device. You can continue to the website.')+'</p>':'<p class="home-install-dialog-intro">'+tr('אייקון האתר במסך הבית של הטלפון — המשפחה במרחק נגיעה.','The website icon on your phone’s home screen — your family just a tap away.')+'</p>'+welcomeArt()+'<button type="button" class="home-install-invite-primary" data-home-install-invite-start>'+tr('התקן','Install')+'</button>'+platformLogos()+progressControl()+'<p class="home-install-invite-status" data-home-install-invite-status role="status" aria-live="polite"></p>'+iconConfirmation(true))+'<button type="button" class="home-install-invite-browse" data-home-install-invite-browse>'+tr('להמשיך לאתר','Continue to the website')+'</button>';
    dialog.querySelector('[data-home-install-invite-start]')?.addEventListener('click',()=>requestInstallation(true));
    dialog.querySelector('[data-home-install-invite-browse]').addEventListener('click',continueToSite);
    showDialog('invite',returnFocus);update();
  }
  function offerInvitation(){if(!installationInvitation||invitationOffered||!mobileDevice)return;invitationOffered=true;openInvitation();}
  async function requestInstallation(fromInvitation=false){
    if(busy||(!fromInvitation&&button.hidden))return;
    if(hasInstalledShortcut()){
      announce(status,tr('קיצור הדרך כבר מותקן','The shortcut is already installed'));
      return;
    }
    if(attemptActive&&(installState==='pending'||installState==='requesting')){if(!dialog.open)openInvitation(button);return;}
    if(!installPrompt){
      if(window.top===window&&typeof navigator.getInstalledRelatedApps==='function')await checkInstalledShortcut();
      if(hasInstalledShortcut())announce(status,tr('קיצור הדרך כבר מותקן','The shortcut is already installed'));
      else openHelp();
      return;
    }
    if(!dialog.open||!['invite','install'].includes(dialogKind))openInvitation(button);
    const prompt=installPrompt;installPrompt=null;busy=true;attemptActive=true;installState='requesting';clearInstallWait();clearTimeout(feedbackTimer);status.textContent='';shareStatus.textContent='';update();
    try{
      await prompt.prompt();
      const choice=await prompt.userChoice;
      if(installState==='done'||hasInstalledShortcut())return;
      if(choice?.outcome==='accepted')waitForInstallation();
      else{attemptActive=false;installState='idle';clearInstallWait();announce(status,tr('לחצו שוב להנחיות ההוספה.','Tap again for installation instructions.'));}
    }catch{if(installState!=='done'){attemptActive=false;installState='idle';clearInstallWait();openHelp();}}
    finally{busy=false;button.disabled=false;update();}
  }
  button.addEventListener('click',()=>requestInstallation());
  dialog.addEventListener('keydown',event=>{if(event.key==='Escape'&&dialog.open&&typeof dialog.showModal!=='function'){event.preventDefault();closeDialog();}});
  dialog.addEventListener('click',event=>{
    if(event.target!==dialog)return;
    const rect=dialog.getBoundingClientRect();
    if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)closeDialog();
  });
  dialog.addEventListener('close',()=>{if(!card.hidden)(dialogReturnFocus===button&&button.hidden?shareButton:dialogReturnFocus||shareButton).focus();dialogKind=null;});
  for(const query of [phoneQuery,standaloneQuery])query.addEventListener?.('change',update);
  window.addEventListener('pageshow',()=>{update();void checkInstalledShortcut();});
  window.addEventListener('focus',()=>{update();void checkInstalledShortcut();});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void checkInstalledShortcut();});
  update();void checkInstalledShortcut();
  if(document.readyState==='loading'||document.readyState==='interactive')document.addEventListener('DOMContentLoaded',offerInvitation,{once:true});else offerInvitation();
})();
