(() => {
  'use strict';
  const t=(he,en)=>document.documentElement.lang?.startsWith('en')||window.FamilyI18n?.isEnglish?en:he;
  const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const shareSymbol='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m8.7 10.5 6.6-4m-6.6 7 6.6 4"/><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/></svg>';
  function markup(kind,titleText,url){
    const label={story:t('שיתוף הזיכרון','Share memory'),film:t('שיתוף הסרט','Share film'),voice:t('שיתוף ההקלטה','Share recording')}[kind];
    const linkLabel={story:t('קישור לזיכרון','Memory link'),film:t('קישור לסרט','Film link'),voice:t('קישור להקלטה','Recording link')}[kind];
    const encodedUrl=encodeURIComponent(url),title=encodeURIComponent(titleText),message=encodeURIComponent(titleText+'\n'+url);
    const icon=name=>`<svg viewBox="0 0 24 24" aria-hidden="true"><use href="/assets/share-icons.svg#${name}"></use></svg>`;
    const sendIcon='<svg viewBox="0 0 24 24" fill="none" stroke="#1688b5" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="m3 10 18-7-4 18-6-6-3 3v-6l9-6-11 7Z"/></svg>';
    const external='target="_blank" rel="noopener noreferrer"';
    return `<details class="memory-sharing" data-share-title="${safe(titleText)}" data-share-kind="${kind}">
      <summary aria-label="${label} · ${safe(titleText)}">${shareSymbol}${label}</summary>
      <div class="memory-share-options">
        <a href="https://wa.me/?text=${safe(message)}" ${external}>${icon('whatsapp')}WhatsApp</a>
        <a href="https://www.facebook.com/sharer/sharer.php?u=${safe(encodedUrl)}" ${external}>${icon('facebook')}Facebook</a>
        <button type="button" data-memory-share="messenger">${icon('messenger')}Messenger</button>
        <button type="button" data-memory-share="instagram">${icon('instagram')}Instagram</button>
        <a href="https://t.me/share/url?url=${safe(encodedUrl)}&amp;text=${safe(title)}" ${external}>${sendIcon}Telegram</a>
        <a href="mailto:?subject=${safe(title)}&amp;body=${safe(message)}">${icon('email')}${t('מייל','Email')}</a>
        <button type="button" data-memory-share="copy">${icon('link')}${t('העתקת קישור','Copy link')}</button>
        ${typeof navigator.share==='function'?`<button type="button" data-memory-share="device">${shareSymbol}${t('שיתוף דרך המכשיר','Share via device')}</button>`:''}
      </div>
      <p class="memory-share-status" role="status"></p>
      <input type="text" class="memory-share-url" dir="ltr" aria-label="${linkLabel}" value="${safe(url)}" readonly hidden>
      <a class="memory-share-open" ${external} hidden></a>
    </details>`;
  }
  async function share(button){
    const panel=button.closest('.memory-sharing'),field=panel.querySelector('input'),status=panel.querySelector('[role="status"]'),open=panel.querySelector('.memory-share-open');
    const action=button.dataset.memoryShare,url=field.value;
    field.hidden=true;open.hidden=true;status.textContent='';
    if(action==='device'){
      try{await navigator.share({title:panel.dataset.shareTitle,url});return;}
      catch(error){if(error?.name==='AbortError')return;}
    }
    const platform={messenger:'Messenger',instagram:'Instagram'}[action];
    try{
      await navigator.clipboard.writeText(url);
      status.textContent=platform?t('הקישור הועתק. אפשר להדביק אותו בהודעה ב־','Link copied. Paste it into a message on ')+platform+'.':t('הקישור הועתק','Link copied');
    }catch{
      field.hidden=false;field.focus();field.select();
      status.textContent=t('אפשר להעתיק את הקישור מהשדה.','Select and copy the link.');
    }
    if(platform){
      open.textContent=t('פתיחת ','Open ')+platform;
      open.href=action==='instagram'?'https://www.instagram.com/direct/inbox/':'https://www.facebook.com/messages/';
      open.hidden=false;
    }
  }
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-memory-share]');
    if(button)void share(button);
  });
  window.FamilyMemorySharing={markup};
})();
