(() => {
  'use strict';
  const phoneQuery=matchMedia('(max-width: 700px)'),standaloneQuery=matchMedia('(display-mode: standalone)');
  let installPrompt=null,installed=false,relatedInstalled=false,installationCheck=null,busy=false,dialogKind=null,dialogReturnFocus=null,feedbackTimer,invitationOffered=false;
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
  function showDialog(kind,returnFocus){
    dialogKind=kind;dialogReturnFocus=returnFocus;
    dialog.querySelector('[data-home-install-close]').addEventListener('click',()=>closeDialog());
    if(!dialog.open){
      if(typeof dialog.showModal==='function')dialog.showModal();
      else{dialog.open=true;dialog.setAttribute('open','');dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.classList?.add('home-install-dialog-fallback');}
    }
    dialog.querySelector('[data-home-install-close]').focus();
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
    card.hidden=!(phoneQuery.matches||navigator.userAgentData?.mobile);
    button.hidden=false;status.hidden=false;
    button.setAttribute('aria-haspopup',isInstalled?'false':'dialog');
    card.querySelector('[data-home-install-actions]').setAttribute('data-installed',String(isInstalled));
    if(isInstalled&&dialog.open&&dialogKind==='install')closeDialog();
    if(dialog.open&&dialogKind==='invite'){
      if(isInstalled&&!dialog.querySelector('[data-home-install-invite-installed]'))openInvitation();
      const action=dialog.querySelector('[data-home-install-invite-start]');
      if(action){action.disabled=busy;action.textContent=tr('התקן','Install');}
    }
    if(dialog.open&&dialogKind==='install'){
      const action=dialog.querySelector('[data-home-install-native-start]'),instructions=dialog.querySelector('[data-home-install-instructions]');
      if(action){action.hidden=!installPrompt&&!busy;action.disabled=busy;}
      if(instructions)instructions.hidden=Boolean(installPrompt)||busy;
    }
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
  function openHelp(){
    const embeddedNote=embedded?'<p class="home-install-browser-note">'+tr('בתפריט ⋮ או השיתוף של האפליקציה בחרו ״פתיחה בדפדפן״. אחרי הפתיחה לחצו שוב ״התקן״.','In this app’s ⋮ or Share menu, choose “Open in browser”. Then tap “Install” again.')+'</p>':'';
    const help=ios?appleHelp():android?androidHelp():'<h3>iPhone / iPad</h3>'+appleHelp()+'<h3>Android</h3>'+androidHelp();
    dialog.innerHTML='<button type="button" class="home-install-close" data-home-install-close aria-label="'+tr('סגירת ההנחיות','Close instructions')+'">×</button><img class="home-install-dialog-icon" src="assets/app-icons/icon-192.png" width="64" height="64" alt=""><h2 id="homeInstallTitle">'+tr('התקנת בית משפחת קהא','Install Keha Family Home')+'</h2><button type="button" class="home-install-invite-primary" data-home-install-native-start hidden>'+tr('התקן','Install')+'</button><div data-home-install-instructions>'+embeddedNote+help+'</div><p class="home-install-invite-status" data-home-install-help-status role="status" aria-live="polite"></p>';
    dialog.querySelector('[data-home-install-native-start]').addEventListener('click',()=>requestInstallation(true));
    showDialog('install',button);
    update();
  }
  function openInvitation(){
    const alreadyInstalled=hasInstalledShortcut();
    dialog.innerHTML='<button type="button" class="home-install-close" data-home-install-close aria-label="'+tr('סגירת ההזמנה','Close invitation')+'">×</button><img class="home-install-dialog-icon" src="assets/app-icons/icon-192.png" width="64" height="64" alt=""><h2 id="homeInstallTitle">'+(alreadyInstalled?tr('הבית שלנו כבר אצלכם','Our home is already with you'):tr('התקנת בית משפחת קהא','Install Keha Family Home'))+'</h2>'+(alreadyInstalled?'<p class="home-install-dialog-intro" data-home-install-invite-installed>'+tr('קיצור הדרך כבר מותקן בטלפון הזה. אפשר להמשיך ישר לאתר.','The shortcut is already installed on this device. You can continue to the website.')+'</p>':'<p class="home-install-dialog-intro">'+tr('אייקון האתר במסך הבית של הטלפון — המשפחה במרחק נגיעה.','The website icon on your phone’s home screen — your family just a tap away.')+'</p><button type="button" class="home-install-invite-primary" data-home-install-invite-start>'+tr('התקן','Install')+'</button><p class="home-install-invite-status" data-home-install-invite-status role="status" aria-live="polite"></p>')+'<button type="button" class="home-install-invite-browse" data-home-install-invite-browse>'+tr('להמשיך לאתר','Continue to the website')+'</button>';
    dialog.querySelector('[data-home-install-invite-start]')?.addEventListener('click',()=>requestInstallation(true));
    dialog.querySelector('[data-home-install-invite-browse]').addEventListener('click',()=>closeDialog());
    showDialog('invite',shareButton);
  }
  function offerInvitation(){if(!installationInvitation||invitationOffered)return;invitationOffered=true;openInvitation();}
  async function requestInstallation(fromInvitation=false){
    if(busy||(!fromInvitation&&button.hidden))return;
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
    const prompt=installPrompt;installPrompt=null;busy=true;button.disabled=true;status.textContent='';shareStatus.textContent='';update();
    try{
      await prompt.prompt();
      const choice=await prompt.userChoice;
      announce(status,choice?.outcome==='accepted'?tr('השלימו את ההוספה בטלפון.','Finish adding it on your phone.'):tr('לחצו שוב להנחיות ההוספה.','Tap again for installation instructions.'));
    }catch{openHelp();}
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
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void checkInstalledShortcut();});
  update();void checkInstalledShortcut();
  if(document.readyState==='loading'||document.readyState==='interactive')document.addEventListener('DOMContentLoaded',offerInvitation,{once:true});else offerInvitation();
})();
