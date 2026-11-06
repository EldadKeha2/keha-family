(() => {
  'use strict';
  const phoneQuery=matchMedia('(max-width: 700px)'),standaloneQuery=matchMedia('(display-mode: standalone)');
  let installPrompt=null,installed=false,busy=false;
  // Keep the browser's one-use event until the visitor explicitly asks to install.
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;update();});
  window.addEventListener('appinstalled',()=>{installed=true;installPrompt=null;update();if(dialog?.open)dialog.close();});

  const card=document.getElementById('homeInstall'),dialog=document.getElementById('homeInstallDialog');
  if(!card||!dialog)return;
  const english=window.FamilyI18n?.isEnglish,tr=(he,en)=>english?en:he;
  const ua=navigator.userAgent||'',ios=/iPhone|iPad|iPod/i.test(ua)||(/Macintosh/i.test(ua)&&navigator.maxTouchPoints>1);
  const android=/Android/i.test(ua),embedded=/FBAN|FBAV|Instagram|WhatsApp|Line\/|; wv\)/i.test(ua);
  const url=new URL('/',location.origin),language=window.FamilyI18n?.language;
  if(['he','en-US','en-GB'].includes(language))url.searchParams.set('lang',language);
  url.hash='home';
  const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  card.innerHTML='<img src="assets/app-icons/icon-192.png" width="52" height="52" alt=""><div class="home-install-copy"><strong data-home-install-heading></strong><p data-home-install-description></p></div><div class="home-install-actions" data-home-install-actions><button type="button" data-home-install-action aria-haspopup="dialog" aria-controls="homeInstallDialog">'+tr('התקן קיצור דרך לאתר','Install site shortcut')+'</button><button type="button" data-home-install-share>'+tr('שיתוף הקיצור','Share shortcut')+'</button></div><p class="home-install-status" data-home-install-status role="status" aria-live="polite"></p><p class="home-install-status" data-home-install-share-status role="status" aria-live="polite"></p><label class="home-install-link-label" for="homeInstallShareLink" hidden>'+tr('קישור לאתר להעתקה ולשיתוף','Website link to copy and share')+'</label><input class="home-install-link-input" id="homeInstallShareLink" value="'+escape(url.href)+'" readonly dir="ltr" hidden>';
  const button=card.querySelector('[data-home-install-action]'),status=card.querySelector('[data-home-install-status]');
  const shareButton=card.querySelector('[data-home-install-share]'),shareStatus=card.querySelector('[data-home-install-share-status]');
  shareButton.addEventListener('click',async()=>{
    if(shareButton.disabled)return;
    shareButton.disabled=true;shareStatus.textContent='';
    try{
      if(typeof navigator.share==='function'){
        try{
          await navigator.share({title:tr('בית משפחת קהא','Keha Family Home'),text:tr('הבית שלנו מתחיל כאן. פתחו את האתר בטלפון והתקינו קיצור דרך למסך הבית.','Our family home starts here. Open the website on your phone and install a home screen shortcut.'),url:url.href});
          shareStatus.textContent=tr('השיתוף הושלם.','Sharing complete.');return;
        }catch(error){if(error?.name==='AbortError')return;}
      }
      try{
        await navigator.clipboard.writeText(url.href);
        shareStatus.textContent=tr('הקישור הועתק. שלחו אותו לבני המשפחה כדי שיוכלו להוסיף גם אצלם קיצור דרך.','Link copied. Send it to the family so they can add their own shortcut.');
      }catch{
        const input=card.querySelector('#homeInstallShareLink');input.hidden=false;
        card.querySelector('label[for="homeInstallShareLink"]').hidden=false;
        input.focus();input.select();input.setSelectionRange?.(0,input.value.length);
        shareStatus.textContent=tr('לחצו לחיצה ממושכת על הקישור המסומן, העתיקו אותו ושלחו לבני המשפחה.','Press and hold the selected link, copy it, and send it to the family.');
      }
    }finally{shareButton.disabled=false;}
  });

  function update(){
    if(!card)return;
    const isInstalled=installed||standaloneQuery.matches||navigator.standalone===true;
    card.hidden=!(phoneQuery.matches||navigator.userAgentData?.mobile);
    button.hidden=isInstalled;status.hidden=isInstalled;
    card.querySelector('[data-home-install-actions]').setAttribute('data-installed',String(isInstalled));
    card.querySelector('[data-home-install-heading]').textContent=isInstalled?tr('הבית שלנו, במרחק נגיעה','Our family, just one tap away'):tr('הבית שלנו, גם במסך הבית','Our family, on your home screen');
    card.querySelector('[data-home-install-description]').textContent=isInstalled?tr('שתפו את קיצור הדרך עם בני המשפחה.','Share the shortcut with your family.'):tr('קיצור דרך לאתר עם הסמל שלנו, כמו אפליקציה.','A shortcut to the family website, with our own app icon.');
    if(isInstalled&&dialog.open)dialog.close();
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
    dialog.querySelector('[data-home-install-close]').addEventListener('click',()=>dialog.close());
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
    if(!dialog.open)dialog.showModal();
    dialog.querySelector('[data-home-install-close]').focus();
  }
  button.addEventListener('click',async()=>{
    if(busy||button.hidden)return;
    if(!installPrompt){openHelp();return;}
    const prompt=installPrompt;installPrompt=null;busy=true;button.disabled=true;status.textContent='';
    try{
      await prompt.prompt();
      const choice=await prompt.userChoice;
      status.textContent=choice?.outcome==='accepted'?tr('השלימו את ההוספה בחלון של הטלפון.','Finish adding the website in your phone’s dialog.'):tr('אפשר להוסיף גם דרך תפריט הדפדפן. לחצו שוב להצגת ההנחיות.','You can also add it from your browser menu. Tap again for instructions.');
    }catch{openHelp();}
    finally{busy=false;button.disabled=false;update();}
  });
  dialog.addEventListener('click',event=>{
    if(event.target!==dialog)return;
    const rect=dialog.getBoundingClientRect();
    if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();
  });
  dialog.addEventListener('close',()=>{if(!card.hidden)(button.hidden?shareButton:button).focus();});
  for(const query of [phoneQuery,standaloneQuery])query.addEventListener?.('change',update);
  window.addEventListener('pageshow',update);
  update();
})();
