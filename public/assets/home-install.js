(() => {
  'use strict';
  const phoneQuery=matchMedia('(max-width: 700px)'),standaloneQuery=matchMedia('(display-mode: standalone)');
  let installPrompt=null,installed=false,relatedInstalled=false,installationCheck=null,busy=false,dialogKind=null,dialogReturnFocus=null,feedbackTimer,invitationOffered=false;
  let installState='idle',attemptActive=false,installWaitTimer=null,successConfirmedByUser=false;
  // Keep the browser's one-use event until the visitor explicitly asks to install.
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;update();});
  // Chromium may emit appinstalled before Android finishes creating the package.
  // Wait for an installed-app check, standalone launch, or the visitor's confirmation.
  window.addEventListener('appinstalled',()=>{installPrompt=null;if(!mobileDevice){installed=true;if(dialogKind==='desktop-install')closeDialog();announce(status,tr('ההתקנה הושלמה. קיצור האתר מוכן במחשב.','Installation complete. Your site shortcut is ready on this computer.'));update();return;}if(attemptActive&&!hasInstalledShortcut())waitForInstallation();void checkInstalledShortcut();update();});

  const card=document.getElementById('homeInstall'),dialog=document.getElementById('homeInstallDialog');
  if(!card||!dialog)return;
  let english=Boolean(window.FamilyI18n?.isEnglish);const tr=(he,en)=>english?en:he;
  const ua=navigator.userAgent||'',ios=/iPhone|iPad|iPod/i.test(ua)||(/Macintosh/i.test(ua)&&navigator.maxTouchPoints>1);
  const android=/Android/i.test(ua),embedded=/FBAN|FBAV|Instagram|WhatsApp|Line\/|; wv\)/i.test(ua);
  const mobileDevice=ios||android||navigator.userAgentData?.mobile===true||/Mobile|Tablet/i.test(ua);
  const nativeDesktop=/KehaFamilyDesktop\//i.test(ua);
  const url=new URL('/',location.origin),language=window.FamilyI18n?.language;
  if(['he','en-US','en-GB'].includes(language))url.searchParams.set('lang',language);
  url.hash='home';
  const invitationURL=new URL(url.href);invitationURL.searchParams.set('install','1');
  const installationInvitation=new URLSearchParams(location.search).get('install')==='1';
  const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const shortcutIcon='<svg class="home-install-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="4" y="2" width="12" height="20" rx="2"/><path d="M8 18h4M19 5v8m-4-4h8"/></svg>';
  const desktopIcon='<img class="desktop-shortcut-logo" src="assets/app-icons/icon-192.png" width="24" height="24" alt="" aria-hidden="true">';
  const refreshIcon='<svg class="home-install-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20 7v5h-5M4 17v-5h5M19.1 9a7.5 7.5 0 0 0-12.4-3L4 9m16 6-2.7 3A7.5 7.5 0 0 1 4.9 15"/></svg>';
  const shareIcon='<svg class="home-install-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m8.7 10.5 6.6-4m-6.6 7 6.6 4"/><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/></svg>';
  card.innerHTML='<div class="home-install-actions" data-home-install-actions><button type="button" data-home-install-action aria-label="'+tr('התקן קיצור דרך לאתר','Install site shortcut')+'" title="'+tr('התקן קיצור דרך לאתר','Install site shortcut')+'" aria-haspopup="dialog" aria-controls="homeInstallDialog">'+shortcutIcon+'<span>'+tr('התקן','Install')+'</span></button><button type="button" data-desktop-install-action hidden aria-haspopup="dialog" aria-controls="homeInstallDialog" aria-label="'+tr('הוספת קיצור דרך למחשב עם לוגו האתר','Add a desktop shortcut with the website logo')+'" title="'+tr('הוסף קיצור דרך','Add shortcut')+'">'+desktopIcon+'<span>'+tr('הוסף קיצור דרך','Add shortcut')+'</span></button><button type="button" data-home-install-share aria-label="'+tr('שיתוף האתר','Share website')+'" title="'+tr('שיתוף האתר','Share website')+'">'+shareIcon+'<span>'+tr('שיתוף','Share')+'</span></button><button type="button" data-desktop-refresh hidden aria-label="'+tr('רענון העמוד הנוכחי','Refresh current page')+'" title="'+tr('רענון','Refresh')+'">'+refreshIcon+'<span>'+tr('רענון','Refresh')+'</span></button></div><p class="home-install-status" data-home-install-status role="status" aria-live="polite"></p><p class="home-install-status" data-home-install-share-status role="status" aria-live="polite"></p>';
  const button=card.querySelector('[data-home-install-action]'),status=card.querySelector('[data-home-install-status]');
  const shareButton=card.querySelector('[data-home-install-share]'),shareStatus=card.querySelector('[data-home-install-share-status]');
  const desktopButton=card.querySelector('[data-desktop-install-action]'),refreshButton=card.querySelector('[data-desktop-refresh]');
  const desktopShortcutLink=document.getElementById('desktopShortcutLink');
  const desktopView=()=>!mobileDevice&&!phoneQuery.matches;
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
    dialog.setAttribute('data-ios-guide',String(ios&&kind==='invite'&&!hasInstalledShortcut()));
    dialog.querySelector('[data-home-install-close]').addEventListener('click',()=>closeDialog());
    dialog.querySelector('[data-home-install-language]')?.addEventListener('click',()=>{
      const currentKind=dialogKind,currentFocus=dialogReturnFocus;english=!english;
      invitationURL.searchParams.set('lang',english?'en-US':'he');
      if(currentKind==='invite')openInvitation(currentFocus);else if(currentKind==='install')openHelp(currentFocus);else if(currentKind==='desktop-install')openDesktopHelp(currentFocus);else if(currentKind==='success')openSuccess(currentFocus);
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

  function hasInstalledShortcut(){return nativeDesktop||installed||relatedInstalled||standaloneQuery.matches||navigator.standalone===true;}
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
    // Keep the phone invitation and desktop actions together in the shared header.
    card.hidden=false;
    button.hidden=!(phoneQuery.matches||navigator.userAgentData?.mobile);status.hidden=false;
    desktopButton.hidden=!desktopView()||nativeDesktop;refreshButton.hidden=!desktopView();desktopButton.disabled=busy;
    if(desktopShortcutLink){
      desktopShortcutLink.hidden=!desktopView()||nativeDesktop;
      const label=desktopShortcutLink.querySelector('span');
      if(label)label.textContent=tr('הוסף קיצור דרך','Add shortcut');
    }
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
    if(dialog.open&&dialogKind==='desktop-install'){
      const action=dialog.querySelector('[data-desktop-native-start]'),instructions=dialog.querySelector('[data-desktop-install-instructions]');
      if(action){action.hidden=!installPrompt;action.disabled=busy;}
      if(instructions)instructions.hidden=Boolean(installPrompt);
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
  function openDesktopHelp(returnFocus=desktopButton){
    let help;const legacyWindows=/Windows NT (?:5|6)\./i.test(ua);
    if(/Edg\//.test(ua))help=steps([
      legacyWindows?tr('ב־Edge פתחו ⋯ ← אפליקציות ← התקנת אתר זה כאפליקציה.','In Edge, open ⋯ → Apps → Install this site as an app.'):tr('ב־Edge פתחו ⋯ ← כלים נוספים ← אפליקציות ← התקנת אתר זה כאפליקציה.','In Edge, open ⋯ → More tools → Apps → Install this site as an app.'),
      tr('אשרו את ההתקנה. ליצירת הסמל בשולחן העבודה: פתחו את דף האפליקציות של Edge, בחרו ״פרטים״ ליד בית משפחת קהא ואז ״יצירת קיצור דרך בשולחן העבודה״.','Confirm installation. For a desktop icon, open Edge’s Apps page, select Details for Keha Family Home, then Create Desktop shortcut.')
    ]);
    else if(/Chrome|Chromium/.test(ua))help=steps([
      legacyWindows?tr('ב־Chrome פתחו ⋮ ← כלים נוספים ← יצירת קיצור דרך.','In Chrome, open ⋮ → More tools → Create shortcut.'):tr('ב־Chrome פתחו ⋮ ← העברה, שמירה ושיתוף ← יצירת קיצור דרך, או לחצו על סמל ההתקנה בשורת הכתובת.','In Chrome, open ⋮ → Cast, save, and share → Create shortcut, or use the install icon in the address bar.'),
      tr('השאירו את שם האתר ואשרו ״יצירה״ או ״התקנה״. הסמל יתווסף עם לוגו האתר.','Keep the website name and confirm Create or Install. The shortcut uses the website’s logo.')
    ]);
    else if(/Macintosh|Mac OS X/.test(ua)&&/Safari/.test(ua))help=steps([
      tr('ב־Safari במק פתחו ״קובץ״ ← ״הוספה ל־Dock״.','In Safari on Mac, open File → Add to Dock.'),
      tr('אשרו ״הוסף״. לוגו האתר יופיע ב־Dock ובתיקיית היישומים.','Confirm Add. The website’s logo appears in the Dock and Applications folder.')
    ]);
    else help='<p>'+tr('להוספת קיצור עם לוגו האתר, פתחו את האתר ב־Chrome או ב־Edge במחשב ובחרו באפשרות ההתקנה בתפריט הדפדפן.','To add a shortcut with the website’s logo, open this site in Chrome or Edge on your computer and choose the browser’s install option.')+'</p>';
    dialog.innerHTML='<button type="button" class="home-install-close" data-home-install-close aria-label="'+tr('סגירת ההנחיות','Close instructions')+'">×</button>'+languageControl()+'<img class="home-install-dialog-icon" src="assets/app-icons/icon-192.png" width="64" height="64" alt=""><h2 id="homeInstallTitle">'+tr('קיצור דרך למחשב','Add a desktop shortcut')+'</h2><button type="button" class="home-install-invite-primary" data-desktop-native-start hidden>'+tr('הוסף קיצור דרך','Add shortcut')+'</button><div data-desktop-install-instructions>'+help+'</div><p class="home-install-invite-status" data-home-install-help-status role="status" aria-live="polite"></p>';
    dialog.querySelector('[data-desktop-native-start]').addEventListener('click',()=>requestDesktopInstallation(returnFocus));showDialog('desktop-install',returnFocus);update();
  }
  async function requestDesktopInstallation(returnFocus=desktopButton){
    if(!desktopView()||busy)return;
    if(hasInstalledShortcut()){announce(status,tr('קיצור הדרך כבר מותקן','The shortcut is already installed'));return;}
    if(!installPrompt){
      await checkInstalledShortcut();
      if(hasInstalledShortcut())announce(status,tr('קיצור הדרך כבר מותקן','The shortcut is already installed'));else openDesktopHelp(returnFocus);return;
    }
    const prompt=installPrompt;installPrompt=null;busy=true;update();
    try{
      // Use the retained event synchronously within this click's user activation.
      await prompt.prompt();const choice=await prompt.userChoice;
      if(choice?.outcome==='accepted'&&!hasInstalledShortcut())announce(status,tr('הבקשה אושרה. הדפדפן משלים את ההתקנה.','Request approved. Your browser is finishing the installation.'));
    }catch{openDesktopHelp(returnFocus);}finally{busy=false;update();}
  }
  desktopButton.addEventListener('click',()=>requestDesktopInstallation());
  desktopShortcutLink?.addEventListener('click',event=>{
    event.preventDefault();
    if(desktopView()&&!nativeDesktop)void requestDesktopInstallation(desktopShortcutLink);
  });
  refreshButton.addEventListener('click',()=>{if(desktopView())location.reload();});
  function appleHelp(){return '<div class="home-install-apple-steps" data-home-install-apple-steps>'+steps([
    '<strong><span class="home-install-share" aria-hidden="true">↑</span> '+tr('שיתוף','Share')+'</strong><span>'+tr('בסרגל של Safari. אם הסמל מוסתר, פתחו את תפריט ⋯ ואז ״שיתוף״.','Use Safari’s toolbar. If the icon is hidden, open the ⋯ page menu, then “Share”.')+'</span>',
    '<strong>'+tr('הוספה למסך הבית','Add to Home Screen')+'</strong><span>'+tr('בוחרים ברשימת הפעולות של Safari. ייתכן שצריך לגלול ברשימה.','Choose it in Safari’s actions. You may need to scroll down the list.')+'</span>',
    '<strong>'+tr('הוסף','Add')+'</strong><span>'+tr('משאירים את השם ולוחצים ״הוסף״. האייקון יופיע במסך הבית.','Keep the name and tap “Add”. The icon will appear on your Home Screen.')+'</span>'
  ])+'</div>';}
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
    let content;
    if(alreadyInstalled){
      content='<p class="home-install-dialog-intro" data-home-install-invite-installed>'+tr('קיצור הדרך כבר מותקן בטלפון הזה. אפשר להמשיך ישר לאתר.','The shortcut is already installed on this device. You can continue to the website.')+'</p>';
    }else if(ios){
      const browserNote=embedded?'<p class="home-install-browser-note">'+tr('אם ״הוספה למסך הבית״ אינה זמינה כאן, בתפריט האפליקציה בחרו ״פתיחה בדפדפן״.','If “Add to Home Screen” is missing here, use this app’s menu and choose “Open in browser”.')+'</p>':'';
      content='<p class="home-install-dialog-intro">'+tr('הוספה חד־פעמית דרך Safari. אפשר להשאיר חלון זה פתוח בזמן ההוספה.','Add once through Safari. You can leave this guide open while adding the icon.')+'</p>'+welcomeArt()+browserNote+appleHelp();
    }else{
      content='<p class="home-install-dialog-intro">'+tr('אייקון האתר במסך הבית של הטלפון — המשפחה במרחק נגיעה.','The website icon on your phone’s home screen — your family just a tap away.')+'</p>'+welcomeArt()+'<button type="button" class="home-install-invite-primary" data-home-install-invite-start>'+tr('התקן','Install')+'</button>'+platformLogos()+progressControl()+'<p class="home-install-invite-status" data-home-install-invite-status role="status" aria-live="polite"></p>'+iconConfirmation(true);
    }
    const heading=alreadyInstalled?tr('הבית שלנו כבר אצלכם','Our home is already with you'):ios?tr('מוסיפים למסך הבית','Add to your Home Screen'):tr('התקנת בית משפחת קהא','Install Keha Family Home');
    dialog.innerHTML='<button type="button" class="home-install-close" data-home-install-close aria-label="'+tr('סגירת ההזמנה','Close invitation')+'">×</button>'+languageControl()+'<img class="home-install-dialog-icon" src="assets/app-icons/icon-192.png" width="64" height="64" alt=""><h2 id="homeInstallTitle">'+heading+'</h2>'+content+'<button type="button" class="home-install-invite-browse" data-home-install-invite-browse>'+tr('להמשיך לאתר','Continue to the website')+'</button>';
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
    if(ios){openInvitation(button);return;}
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
  dialog.addEventListener('close',()=>{const focus=dialogReturnFocus||shareButton;if(!card.hidden)(focus.hidden?shareButton:focus).focus();dialogKind=null;});
  for(const query of [phoneQuery,standaloneQuery])query.addEventListener?.('change',update);
  window.addEventListener('pageshow',()=>{update();void checkInstalledShortcut();});
  window.addEventListener('focus',()=>{update();void checkInstalledShortcut();});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void checkInstalledShortcut();});
  update();void checkInstalledShortcut();
  if(document.readyState==='loading'||document.readyState==='interactive')document.addEventListener('DOMContentLoaded',offerInvitation,{once:true});else offerInvitation();
})();
