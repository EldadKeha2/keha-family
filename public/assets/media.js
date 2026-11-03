(() => {
  'use strict';
  const I18n=window.FamilyI18n;
  const $=id=>document.getElementById(id),app=()=>window.FamilyApp;
  const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const albums=new Map();
  const state={scope:null,items:[],index:0,activeId:null,pending:null,deleting:false,opener:null};
  const identity=item=>item.id||item.file;
  const current=()=>state.items[state.index];
  const linked=(item,scope)=>scope?.startsWith('personal:')&&item.scope!==scope;
  let noticeTimer,expectedCaption='',captionEditing=false;
  const tr=(he,en)=>I18n.isEnglish?en:he;
  function shareURL(item){const url=new URL('/',location.origin);url.searchParams.set('media',item.id);url.searchParams.set('lang',I18n.language);url.hash='gallery';return url.href;}

  function controls(item,scope){
    return I18n.html`<div class="media-controls"><button data-media-open="${safe(identity(item))}" data-media-scope="${safe(scope)}">⛶ פתיחה בגלריה</button>${window.FamilyTags.controls(item)}${item.id?`<button class="media-delete" data-media-delete="${safe(item.id)}" data-media-scope="${safe(scope)}" aria-label="${linked(item,scope)?I18n.t('הסרת'):I18n.t('מחיקת')} ${safe(I18n.mediaName(item))}${linked(item,scope)?I18n.t(' מהאלבום'):''}">${linked(item,scope)?I18n.t('הסרה מהאלבום'):I18n.t('מחיקת הפריט')}</button>`:''}</div>${window.FamilyTags.labels(item)}`;
  }
  function register(scope,items){
    albums.set(scope,items);
    if(!$('mediaViewer')?.open||state.scope!==scope)return;
    const id=state.activeId,index=items.findIndex(item=>identity(item)===id);
    state.items=items;
    if(!items.length){$('mediaViewer').close();return;}
    if(index<0)show(Math.min(state.index,items.length-1));
    else {state.index=index;metadata();}
  }
  function metadata(){
    const item=current();if(!item)return;
    $('mediaViewerTitle').textContent=I18n.mediaName(item)||I18n.t('זיכרון משפחתי');
    $('mediaViewerCaption').textContent=item.caption||'';
    const url=shareURL(item),label=(item.caption||I18n.mediaName(item)||'Keha Family').replace(/[\r\n]/g,' ');
    $('shareMediaWhatsApp').href='https://wa.me/?text='+encodeURIComponent(label+'\n'+url);
    $('shareMediaFacebook').href='https://www.facebook.com/sharer/sharer.php?u='+encodeURIComponent(url);
    $('shareMediaEmail').href='mailto:?subject='+encodeURIComponent(label)+'&body='+encodeURIComponent(label+'\n\n'+url);
    $('mediaShareStatus').textContent='';$('mediaLinkFallback').hidden=true;
    $('openedProfilePhoto').hidden=!(state.scope?.startsWith('personal:')&&item.kind==='photo');
    $('openedCaptionForm').hidden=!captionEditing;
    $('mediaViewerCounter').textContent=`${state.index+1} / ${state.items.length}`;
    $('mediaPrevious').hidden=$('mediaNext').hidden=state.items.length<2;
    const link=$('mediaOriginal');link.href=item.watchUrl||item.src;
    link.textContent=item.provider==='youtube'?I18n.t('צפייה ביוטיוב ↗'):I18n.t('הורדת המקור ↓');
    if(item.provider==='youtube'){link.removeAttribute('download');link.target='_blank';link.rel='noopener';}
    else {link.download=item.filename||'';link.removeAttribute('target');link.removeAttribute('rel');}
    $('mediaViewerDelete').hidden=!item.id;
    $('mediaViewerDelete').textContent=linked(item,state.scope)?I18n.t('הסרה מהאלבום'):I18n.t('מחיקת הפריט');
    window.FamilyTags.mountInline($('mediaTagPanel'),item);
    $('mediaViewerTag').hidden=!window.FamilyTags.taggable(item);
    $('mediaViewerTag').textContent=item.tags?.length?I18n.t('תיוג אנשים (')+item.tags.length+')':I18n.t('תיוג אנשים');
  }
  function clearStage(){
    $('mediaStage').querySelectorAll('video').forEach(video=>{video.pause();video.removeAttribute('src');video.load();});
    $('mediaStage').replaceChildren();
  }
  function show(index){
    if(!state.items.length)return;
    state.index=(index+state.items.length)%state.items.length;
    const item=current();state.activeId=identity(item);captionEditing=false;clearStage();metadata();
    const stage=$('mediaStage');stage.classList.toggle('is-video',item.kind==='video');stage.classList.toggle('is-document',item.kind==='document');
    if(item.provider==='youtube'&&/^[\w-]{11}$/.test(item.youtubeId)){
      const frame=document.createElement('iframe');
      frame.src='https://www.youtube-nocookie.com/embed/'+item.youtubeId+'?rel=0';
      frame.title=I18n.mediaName(item);frame.allow='autoplay; encrypted-media; picture-in-picture; fullscreen';
      frame.allowFullscreen=true;frame.referrerPolicy='strict-origin-when-cross-origin';
      stage.append(frame);
      $('mediaPlaybackNote').textContent=I18n.t('אם הסרטון אינו זמין לניגון כאן, אפשר לפתוח אותו ביוטיוב.');
      $('mediaPlaybackNote').hidden=false;
    }else if(item.kind==='video'){
      const video=document.createElement('video');video.controls=true;video.playsInline=true;video.preload='metadata';video.src=item.src;video.setAttribute('aria-label',I18n.mediaName(item));
      video.addEventListener('error',()=>{$('mediaPlaybackNote').textContent=I18n.t('הסרטון לא מתנגן בדפדפן הזה. אפשר להוריד את המקור או להעלות MP4 עם H.264.');$('mediaPlaybackNote').hidden=false;});stage.append(video);
      $('mediaPlaybackNote').hidden=true;
    }else if(item.kind==='photo'||item.mime?.startsWith('image/')){
      const img=document.createElement('img');img.src=item.src+(item.kind==='document'?'?inline=1':'');img.alt=item.caption||I18n.mediaName(item);stage.append(img);$('mediaPlaybackNote').hidden=true;
    }else if(['application/pdf','text/plain','text/markdown'].includes(item.mime)){
      const frame=document.createElement('iframe');frame.src=item.src+'?inline=1';frame.title=I18n.mediaName(item);frame.referrerPolicy='same-origin';stage.append(frame);$('mediaPlaybackNote').hidden=true;
    }else{
      const note=document.createElement('p');note.className='media-document-preview';note.textContent='▤ '+item.filename+I18n.t(' · לפתיחת המסמך בחרו ״הורדת המקור״.');stage.append(note);$('mediaPlaybackNote').hidden=true;
    }
  }
  function open(items,index=0,scope){
    if(!items?.length||index<0)return;
    state.scope=scope||items[index]?.scope||'shared';state.items=items;albums.set(state.scope,items);
    state.opener=document.activeElement;
    document.querySelectorAll('video').forEach(video=>video.pause());
    show(index);if(!$('mediaViewer').open)$('mediaViewer').showModal();
  }
  function openFrom(scope,id){const items=albums.get(scope)||[];open(items,items.findIndex(item=>identity(item)===id||item.file===id),scope);}
  function requestDelete(scope,id){
    if(!app()?.apiEnabled){app()?.toast(I18n.t('השמירה אינה זמינה כרגע. נסו לרענן.'));return;}
    const item=(albums.get(scope)||[]).find(item=>item.id===id);if(!item)return;
    const isLinked=linked(item,scope),personName=isLinked?app().nameOf(scope.slice(9)):'';
    state.pending={scope:scope.startsWith('link:')?item.scope:scope,item,isLinked};$('deleteMediaName').textContent=item.name||item.filename;
    $('deleteMediaTitle').textContent=isLinked?I18n.t('להסיר את הפריט מהאלבום של ')+personName+'?':I18n.t('האם אתה בטוח שאתה רוצה למחוק פריט זה?');
    $('deleteMediaHint').textContent=isLinked?I18n.t('התיוג של ')+personName+I18n.t(' יוסר. הפריט ימשיך להופיע באלבום המקורי ובאלבומים של שאר המתויגים.'):I18n.t('הפריט יוסר מכל האלבומים שבהם הוא מופיע. מיד לאחר המחיקה אפשר לבחור ״ביטול מחיקה״.');
    $('confirmMediaDelete').textContent=isLinked?I18n.t('כן, הסר מהאלבום'):I18n.t('כן, מחק');
    $('deleteMediaError').textContent='';$('confirmMediaDelete').disabled=false;
    $('deleteMediaDialog').showModal();$('cancelMediaDelete').focus();
  }
  async function change(item,scope,operation,extra={}){
    const response=await I18n.fetch('api/media/'+item.id+'/'+operation,{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json','X-Family-Token':window.FAMILY_API_TOKEN},body:JSON.stringify({scope,...extra})});
    let result;try{result=await response.json();}catch{throw Error(I18n.t('לא התקבלה תשובה מהשרת. נסו שוב.'));}
    if(!response.ok)throw Error(I18n.error(result.error)||I18n.t('הפעולה לא נשמרה.'));
    window.dispatchEvent(new CustomEvent('family-media-changed',{detail:result}));return result;
  }
  function notify(message,action){
    app()?.toast(message,action);clearTimeout(noticeTimer);
    const notices=[$('mediaViewerNotice')];
    if($('personDialog').open){
      let inline=$('personMediaNotice');
      if(!inline){inline=document.createElement('div');inline.id='personMediaNotice';inline.className='media-inline-notice';inline.setAttribute('role','status');$('personBody').prepend(inline);}
      notices.push(inline);
    }
    for(const notice of notices){
      notice.replaceChildren(document.createTextNode(message));
      if(action){const button=document.createElement('button');button.textContent=action.label;button.addEventListener('click',action.run);notice.append(button);}
      notice.hidden=false;
    }
    noticeTimer=setTimeout(()=>{notices.forEach(notice=>{notice.hidden=true;});},20000);
  }
  async function confirmDelete(){
    if(!state.pending||state.deleting)return;
    const {item,scope,isLinked}=state.pending;state.deleting=true;
    $('confirmMediaDelete').disabled=true;$('cancelMediaDelete').disabled=true;
    try{
      const result=await change(item,scope,isLinked?'untag':'delete');$('deleteMediaDialog').close();
      let restored=false;
      const undo=async()=>{if(restored)return;restored=true;try{await change(item,scope,isLinked?'retag':'restore',{restoreProfile:result.wasProfile===true});notify(I18n.t('הפריט הוחזר לאלבום ✓'));}catch(error){restored=false;notify(error.message,{label:I18n.t('ניסיון נוסף'),run:undo});}};
      notify(I18n.t('הפריט הוסר מהאלבום.'),{label:isLinked?I18n.t('ביטול ההסרה'):I18n.t('ביטול מחיקה'),run:undo});
      if(!$('mediaViewer').open&&$('personDialog').open)$('personMediaNotice').querySelector('button')?.focus({preventScroll:true});
    }catch(error){$('deleteMediaError').textContent=error.message;}
    finally{state.deleting=false;$('confirmMediaDelete').disabled=false;$('cancelMediaDelete').disabled=false;}
  }
  async function openSharedLink(){
    const id=new URL(location.href).searchParams.get('media');if(!/^[a-f0-9]{32}$/.test(id||''))return;
    try{const response=await I18n.fetch('api/media/'+id+'/view',{cache:'no-store'}),result=await response.json();if(!response.ok)throw Error(I18n.error(result.error));open([result.item],0,'link:'+result.item.id);}catch(error){app()?.toast(error.message);}
  }
  async function saveOpenedCaption(event){
    event.preventDefault();const item=current();if(!item)return;
    const button=$('openedCaptionForm').querySelector('[type=submit]');button.disabled=true;$('openedCaptionError').textContent='';
    try{const response=await I18n.fetch('api/media/'+item.id+'/caption',{method:'POST',headers:{'Content-Type':'application/json','X-Family-Token':window.FAMILY_API_TOKEN},body:JSON.stringify({caption:$('openedCaptionText').value,expectedCaption})});const result=await response.json();if(!response.ok)throw Error(I18n.error(result.error));captionEditing=false;$('openedCaptionForm').hidden=true;window.dispatchEvent(new CustomEvent('family-media-changed',{detail:result}));notify(tr('הכיתוב נשמר ✓','Caption saved ✓'));}catch(error){$('openedCaptionError').textContent=error.message;}finally{button.disabled=false;}
  }
  function init(){
    $('editOpenedCaption').addEventListener('click',()=>{const item=current();if(!item)return;captionEditing=true;expectedCaption=item.caption||'';$('openedCaptionText').value=expectedCaption;$('openedCaptionError').textContent='';$('openedCaptionForm').hidden=false;$('openedCaptionText').focus();});
    $('cancelOpenedCaption').addEventListener('click',()=>{captionEditing=false;$('openedCaptionForm').hidden=true;});
    $('openedCaptionForm').addEventListener('submit',saveOpenedCaption);
    $('copyMediaLink').addEventListener('click',async()=>{if(!current())return;const url=shareURL(current());try{await navigator.clipboard.writeText(url);$('mediaShareStatus').textContent=tr('הקישור הועתק ✓','Link copied ✓');}catch{$('mediaLinkFallback').value=url;$('mediaLinkFallback').hidden=false;$('mediaLinkFallback').focus();$('mediaLinkFallback').select();$('mediaShareStatus').textContent=tr('אפשר להעתיק את הקישור מהשדה','Copy the link from the field');}});
    $('openedProfilePhoto').addEventListener('click',async()=>{if(!current()||!state.scope?.startsWith('personal:'))return;const id=state.scope.slice(9),button=$('openedProfilePhoto');button.disabled=true;try{const response=await I18n.fetch('api/people/'+encodeURIComponent(id)+'/profile',{method:'POST',headers:{'Content-Type':'application/json','X-Family-Token':window.FAMILY_API_TOKEN},body:JSON.stringify({file:current().file})});const result=await response.json();if(!response.ok)throw Error(I18n.error(result.error));app().updatePerson(id,result.person);window.dispatchEvent(new CustomEvent('family-person-changed',{detail:{id}}));notify(tr('תמונת הפרופיל עודכנה ✓','Profile photo updated ✓'));}catch(error){notify(error.message);}finally{button.disabled=false;}});
    window.addEventListener('family-media-changed',event=>{const result=event.detail;if(!result.item)return;for(const [scope,items]of [...albums]){const remove=result.operation==='delete'||(result.operation==='untag'&&scope===result.contextScope),updated=items.filter(item=>!(remove&&item.id===result.item.id)).map(item=>item.id===result.item.id?{...item,...result.item}:item);register(scope,updated);}});
    openSharedLink();
    document.addEventListener('click',event=>{
      const open=event.target.closest('[data-media-open]');if(open){openFrom(open.dataset.mediaScope,open.dataset.mediaOpen);return;}
      const remove=event.target.closest('[data-media-delete]');if(remove)requestDelete(remove.dataset.mediaScope,remove.dataset.mediaDelete);
    });
    $('closeMediaViewer').addEventListener('click',()=>$('mediaViewer').close());
    $('mediaPrevious').addEventListener('click',()=>show(state.index-1));$('mediaNext').addEventListener('click',()=>show(state.index+1));
    $('mediaViewerDelete').addEventListener('click',()=>requestDelete(state.scope,current()?.id));
    $('mediaViewerTag').addEventListener('click',()=>window.FamilyTags.open(current()?.id));
    $('confirmMediaDelete').addEventListener('click',confirmDelete);
    $('cancelMediaDelete').addEventListener('click',()=>$('deleteMediaDialog').close());
    $('deleteMediaDialog').addEventListener('cancel',event=>{if(state.deleting)event.preventDefault();});
    $('deleteMediaDialog').addEventListener('close',()=>{state.pending=null;});
    $('mediaViewer').addEventListener('close',()=>{const url=new URL(location.href);if(url.searchParams.has('media')){url.searchParams.delete('media');history.replaceState(null,'',url.href);}clearStage();window.FamilyTags.clearInline($('mediaTagPanel'));if(state.opener?.isConnected)state.opener.focus({preventScroll:true});});
    $('mediaViewer').addEventListener('click',event=>{if(event.target===$('mediaViewer'))$('mediaViewer').close();});
    document.addEventListener('keydown',event=>{
      if(!$('mediaViewer').open||$('deleteMediaDialog').open||$('tagPeopleDialog').open||event.target.closest('input,textarea'))return;
      if(event.key===(I18n.isEnglish?'ArrowLeft':'ArrowRight')){event.preventDefault();show(state.index-1);}
      if(event.key===(I18n.isEnglish?'ArrowRight':'ArrowLeft')){event.preventDefault();show(state.index+1);}
    });
  }
  window.FamilyMedia={register,controls,open,openFrom,requestDelete,notify};
  document.addEventListener('DOMContentLoaded',init);
})();
