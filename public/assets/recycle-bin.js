(() => {
  'use strict';
  const I=window.FamilyI18n,tr=(he,en)=>I?.isEnglish?en:he;
  const mobile=navigator.userAgentData?.mobile===true||/Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(navigator.userAgent||'')||(/Macintosh/i.test(navigator.userAgent||'')&&navigator.maxTouchPoints>1);
  if(!window.FAMILY_CLOUD||mobile)return;
  const standalone=()=>navigator.standalone===true||['standalone','minimal-ui','fullscreen'].some(mode=>matchMedia('(display-mode:'+mode+')').matches);
  const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const bin='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6m4-6v6"/></svg>';
  const restoreIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10a8 8 0 1 1 1 8M4 4v6h6M12 8v5l3 2"/></svg>';
  const actions=document.querySelector('.site-footer .cloud-actions');if(!actions)return;
  const entry=document.createElement('button');entry.type='button';entry.id='recycleBinEntry';entry.setAttribute('data-i18n-skip','');entry.innerHTML=bin+'<span>'+tr('סל המחזור','Recycle bin')+'</span>';entry.hidden=standalone();actions.append(entry);
  for(const mode of ['standalone','minimal-ui','fullscreen'])matchMedia('(display-mode:'+mode+')').addEventListener('change',()=>{entry.hidden=standalone();});
  let dialog,page=1,kind='',query='',generation=0,pending=false;
  async function api(path,body){
    const response=await I.fetch('api/trash'+path,{method:body===undefined?'GET':'POST',cache:'no-store',credentials:'same-origin',headers:body===undefined?{}:{'Content-Type':'application/json','X-Family-Token':window.FAMILY_API_TOKEN},...(body===undefined?{}:{body:JSON.stringify(body)})});
    const result=await response.json();if(!response.ok){const error=new Error(I?.error?.(result.error)||result.error||tr('לא ניתן לפתוח את סל המחזור.','Unable to open the recycle bin.'));error.status=response.status;throw error;}return result;
  }
  function shell(){
    if(dialog)return;
    dialog=document.createElement('dialog');dialog.id='recycleBinDialog';dialog.className='recycle-dialog';dialog.setAttribute('data-i18n-skip','');dialog.setAttribute('aria-labelledby','recycleBinTitle');
    dialog.innerHTML=`<header><h2 id="recycleBinTitle">${bin}${tr('סל המחזור','Recycle bin')}</h2><button type="button" class="recycle-close" aria-label="${tr('סגירה','Close')}">×</button></header><div id="recycleBinBody"></div>`;
    dialog.querySelector('.recycle-close').addEventListener('click',()=>dialog.close());
    dialog.addEventListener('close',()=>{generation++;document.getElementById('recycleBinBody').replaceChildren();api('/logout',{}).catch(()=>{});});
    document.body.append(dialog);
  }
  function locked(message=''){
    generation++;pending=false;
    document.getElementById('recycleBinBody').innerHTML=`<form class="recycle-login"><label for="recyclePassword">${tr('סיסמה לסל המחזור','Recycle bin password')}</label><div><input id="recyclePassword" type="password" autocomplete="current-password" required maxlength="128" autofocus><button type="submit">${tr('כניסה','Unlock')}</button></div><p class="recycle-error" role="alert">${safe(message)}</p></form>`;
    const form=dialog.querySelector('form'),input=dialog.querySelector('input');input.focus();
    form.addEventListener('submit',async event=>{
      event.preventDefault();if(pending)return;pending=true;const submit=form.querySelector('button');submit.disabled=true;
      try{await api('/login',{password:input.value});input.value='';pending=false;await load();}
      catch(error){input.value='';locked(error.message);}
      finally{pending=false;submit.disabled=false;}
    });
  }
  function source(item){
    const scope=item.scope||'';
    if(item.owner)return tr('האלבום של ','Album for ')+item.owner;
    if(scope.startsWith('nursery:'))return tr('התינוקייה','Baby album');
    if(scope.startsWith('wedding:'))return tr('אלבום חתונה','Wedding album');
    return ({gallery:tr('הגלריה המשפחתית','Family gallery'),photos:tr('תמונות משפחתיות','Family photos'),videos:tr('סרטונים','Videos'),nostalgia:tr('פינת הנוסטלגיה','Nostalgia corner')})[scope]||tr('האתר המשפחתי','Family website');
  }
  function card(item){
    const title=item.caption||item.name||item.filename||tr('ללא כותרת','Untitled'),file=safe(item.preview||''),date=new Intl.DateTimeFormat(I?.isEnglish?'en-GB':'he-IL',{dateStyle:'short',timeStyle:'short'}).format(new Date(item.deletedAt));
    const preview=item.preview?(item.kind==='photo'?`<a href="${file}" target="_blank" rel="noopener" aria-label="${safe(title)}"><img src="${file}" loading="lazy" alt="${safe(title)}"></a>`:item.kind==='video'?`<video src="${file}" controls preload="none" aria-label="${safe(title)}"></video>`:`<a class="recycle-document" href="${file}" target="_blank" rel="noopener"><span aria-hidden="true">▤</span>${safe(item.filename||title)}</a>`):`<div class="recycle-document"><span aria-hidden="true">${item.kind==='video'?'▷':'▤'}</span></div>`;
    return `<article class="recycle-card"><div class="recycle-preview">${preview}</div><div class="recycle-card-text"><h3 dir="auto">${safe(title)}</h3><p>${safe(source(item))}</p><time datetime="${safe(item.deletedAt)}">${tr('נמחק: ','Deleted: ')}${safe(date)}</time></div><button type="button" data-recycle-restore="${safe(item.id)}">${restoreIcon}${tr('שחזור','Restore')}</button></article>`;
  }
  async function load(){
    const ticket=++generation,body=document.getElementById('recycleBinBody');
    body.innerHTML=`<p class="recycle-loading" role="status">${tr('טוען את סל המחזור…','Loading the recycle bin…')}</p>`;
    try{
      const params=new URLSearchParams({page:String(page),kind,q:query}),result=await api('?'+params);
      if(ticket!==generation||!dialog.open)return;
      page=result.page;
      body.innerHTML=`<div class="recycle-toolbar"><form><label class="recycle-sr-only" for="recycleSearch">${tr('חיפוש בסל המחזור','Search deleted items')}</label><input id="recycleSearch" type="search" value="${safe(query)}" placeholder="${tr('חיפוש בסל המחזור','Search deleted items')}"><label class="recycle-sr-only" for="recycleKind">${tr('סוג קובץ','File type')}</label><select id="recycleKind">${[['',tr('כל הפריטים','All items')],['photo',tr('תמונות','Photos')],['video',tr('סרטונים','Videos')],['document',tr('מסמכים','Documents')]].map(([value,label])=>`<option value="${value}"${kind===value?' selected':''}>${label}</option>`).join('')}</select><button type="submit">${tr('חיפוש','Search')}</button></form><button type="button" data-recycle-lock>${tr('נעילת סל המחזור','Lock recycle bin')}</button></div><p class="recycle-count" role="status">${result.count} ${tr('פריטים בסל המחזור','items in the recycle bin')}</p><p class="recycle-error" role="alert" id="recycleError"></p><div class="recycle-grid">${result.items.map(card).join('')||`<p>${tr('אין פריטים להצגה.','No items to display.')}</p>`}</div>${result.pages>1?`<nav class="recycle-paging" aria-label="${tr('עמודי סל המחזור','Recycle bin pages')}"><button type="button" data-recycle-page="-1"${page===1?' disabled':''}>${tr('הקודם','Previous')}</button><span>${page} / ${result.pages}</span><button type="button" data-recycle-page="1"${page===result.pages?' disabled':''}>${tr('הבא','Next')}</button></nav>`:''}`;
      body.querySelector('form').addEventListener('submit',event=>{event.preventDefault();query=body.querySelector('#recycleSearch').value;kind=body.querySelector('#recycleKind').value;page=1;load();});
      body.querySelector('[data-recycle-lock]').addEventListener('click',async()=>{try{await api('/logout',{});locked();}catch(error){locked(error.message);}});
      for(const button of body.querySelectorAll('[data-recycle-page]'))button.addEventListener('click',()=>{page+=Number(button.dataset.recyclePage);load();});
      for(const button of body.querySelectorAll('[data-recycle-restore]'))button.addEventListener('click',async()=>{
        if(pending)return;pending=true;button.disabled=true;
        try{const result=await api('/'+button.dataset.recycleRestore+'/restore',{});window.dispatchEvent(new CustomEvent('family-media-changed',{detail:result}));window.FamilyApp?.toast(tr('הפריט שוחזר למקומו ✓','Item restored to its album ✓'));await load();}
        catch(error){if(error.status===401)locked();else{const message=document.getElementById('recycleError');if(message)message.textContent=error.message;}}
        finally{pending=false;button.disabled=false;}
      });
    }catch(error){if(ticket!==generation||!dialog.open)return;if(error.status===401)locked();else body.innerHTML=`<p class="recycle-error" role="alert">${safe(error.message)}</p>`;}
  }
  entry.addEventListener('click',()=>{shell();page=1;kind='';query='';dialog.showModal();locked();});
})();
