(() => {
  'use strict';
  const $=id=>document.getElementById(id),app=()=>window.FamilyApp;
  const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const albums=new Map();
  const state={scope:null,items:[],index:0,activeId:null,pending:null,deleting:false,opener:null};
  const identity=item=>item.id||item.file;
  const current=()=>state.items[state.index];
  const linked=(item,scope)=>scope?.startsWith('personal:')&&item.scope!==scope;
  let noticeTimer;
  function controls(item,scope){
    return `<div class="media-controls"><button data-media-open="${safe(identity(item))}" data-media-scope="${safe(scope)}">⛶ פתיחה בגלריה</button>${window.FamilyTags.controls(item)}${item.id?`<button class="media-delete" data-media-delete="${safe(item.id)}" data-media-scope="${safe(scope)}" aria-label="${linked(item,scope)?'הסרת':'מחיקת'} ${safe(item.name)}${linked(item,scope)?' מהאלבום':''}">${linked(item,scope)?'הסרה מהאלבום':'מחיקת הפריט'}</button>`:''}</div>${window.FamilyTags.labels(item)}`;
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
    $('mediaViewerTitle').textContent=item.name||'זיכרון משפחתי';
    $('mediaViewerCaption').textContent=item.caption||'';
    $('mediaViewerCounter').textContent=`${state.index+1} / ${state.items.length}`;
    $('mediaPrevious').hidden=$('mediaNext').hidden=state.items.length<2;
    const link=$('mediaOriginal');link.href=item.watchUrl||item.src;
    link.textContent=item.provider==='youtube'?'צפייה ביוטיוב ↗':'הורדת המקור ↓';
    if(item.provider==='youtube'){link.removeAttribute('download');link.target='_blank';link.rel='noopener';}
    else {link.download=item.filename||'';link.removeAttribute('target');link.removeAttribute('rel');}
    $('mediaViewerDelete').hidden=!item.id;
    $('mediaViewerDelete').textContent=linked(item,state.scope)?'הסרה מהאלבום':'מחיקת הפריט';
    $('mediaViewerTags').innerHTML=window.FamilyTags.labels(item);
    $('mediaViewerTag').hidden=!window.FamilyTags.taggable(item);
    $('mediaViewerTag').textContent=item.tags?.length?'תיוג אנשים ('+item.tags.length+')':'תיוג אנשים';
  }
  function clearStage(){
    $('mediaStage').querySelectorAll('video').forEach(video=>{video.pause();video.removeAttribute('src');video.load();});
    $('mediaStage').replaceChildren();
  }
  function show(index){
    if(!state.items.length)return;
    state.index=(index+state.items.length)%state.items.length;
    const item=current();state.activeId=identity(item);clearStage();metadata();
    const stage=$('mediaStage');stage.classList.toggle('is-video',item.kind==='video');
    if(item.provider==='youtube'&&/^[\w-]{11}$/.test(item.youtubeId)){
      const frame=document.createElement('iframe');
      frame.src='https://www.youtube-nocookie.com/embed/'+item.youtubeId+'?rel=0';
      frame.title=item.name;frame.allow='autoplay; encrypted-media; picture-in-picture; fullscreen';
      frame.allowFullscreen=true;frame.referrerPolicy='strict-origin-when-cross-origin';
      stage.append(frame);
      $('mediaPlaybackNote').textContent='אם הסרטון אינו זמין לניגון כאן, אפשר לפתוח אותו ביוטיוב.';
      $('mediaPlaybackNote').hidden=false;
    }else if(item.kind==='video'){
      const video=document.createElement('video');video.controls=true;video.playsInline=true;video.preload='metadata';video.src=item.src;video.setAttribute('aria-label',item.name);
      video.addEventListener('error',()=>{$('mediaPlaybackNote').textContent='הסרטון לא מתנגן בדפדפן הזה. אפשר להוריד את המקור או להעלות MP4 עם H.264.';$('mediaPlaybackNote').hidden=false;});stage.append(video);
      $('mediaPlaybackNote').hidden=true;
    }else if(item.kind==='photo'||item.mime?.startsWith('image/')){
      const img=document.createElement('img');img.src=item.src;img.alt=item.caption||item.name;stage.append(img);$('mediaPlaybackNote').hidden=true;
    }else{
      const note=document.createElement('p');note.className='media-document-preview';note.textContent='▤ '+item.filename+' · לפתיחת המסמך בחרו ״הורדת המקור״.';stage.append(note);$('mediaPlaybackNote').hidden=true;
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
    if(!app()?.apiEnabled){app()?.toast('השמירה אינה זמינה כרגע. נסו לרענן.');return;}
    const item=(albums.get(scope)||[]).find(item=>item.id===id);if(!item)return;
    const isLinked=linked(item,scope),personName=isLinked?app().nameOf(scope.slice(9)):'';
    state.pending={scope,item,isLinked};$('deleteMediaName').textContent=item.name||item.filename;
    $('deleteMediaTitle').textContent=isLinked?'להסיר את הפריט מהאלבום של '+personName+'?':'האם אתה בטוח שאתה רוצה למחוק פריט זה?';
    $('deleteMediaHint').textContent=isLinked?'התיוג של '+personName+' יוסר. הפריט ימשיך להופיע באלבום המקורי ובאלבומים של שאר המתויגים.':'הפריט יוסר מכל האלבומים שבהם הוא מופיע. מיד לאחר המחיקה אפשר לבחור ״ביטול מחיקה״.';
    $('confirmMediaDelete').textContent=isLinked?'כן, הסר מהאלבום':'כן, מחק';
    $('deleteMediaError').textContent='';$('confirmMediaDelete').disabled=false;
    $('deleteMediaDialog').showModal();$('cancelMediaDelete').focus();
  }
  async function change(item,scope,operation,extra={}){
    const response=await fetch('api/media/'+item.id+'/'+operation,{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json','X-Family-Token':window.FAMILY_API_TOKEN},body:JSON.stringify({scope,...extra})});
    let result;try{result=await response.json();}catch{throw Error('לא התקבלה תשובה מהשרת. נסו שוב.');}
    if(!response.ok)throw Error(result.error||'הפעולה לא נשמרה.');
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
      const undo=async()=>{if(restored)return;restored=true;try{await change(item,scope,isLinked?'retag':'restore',{restoreProfile:result.wasProfile===true});notify('הפריט הוחזר לאלבום ✓');}catch(error){restored=false;notify(error.message,{label:'ניסיון נוסף',run:undo});}};
      notify('הפריט הוסר מהאלבום.',{label:isLinked?'ביטול ההסרה':'ביטול מחיקה',run:undo});
      if(!$('mediaViewer').open&&$('personDialog').open)$('personMediaNotice').querySelector('button')?.focus({preventScroll:true});
    }catch(error){$('deleteMediaError').textContent=error.message;}
    finally{state.deleting=false;$('confirmMediaDelete').disabled=false;$('cancelMediaDelete').disabled=false;}
  }
  function init(){
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
    $('mediaViewer').addEventListener('close',()=>{clearStage();if(state.opener?.isConnected)state.opener.focus({preventScroll:true});});
    $('mediaViewer').addEventListener('click',event=>{if(event.target===$('mediaViewer'))$('mediaViewer').close();});
    document.addEventListener('keydown',event=>{
      if(!$('mediaViewer').open||$('deleteMediaDialog').open||$('tagPeopleDialog').open||event.target.closest('input,textarea'))return;
      if(event.key==='ArrowRight'){event.preventDefault();show(state.index-1);}
      if(event.key==='ArrowLeft'){event.preventDefault();show(state.index+1);}
    });
  }
  window.FamilyMedia={register,controls,open,openFrom,requestDelete,notify};
  document.addEventListener('DOMContentLoaded',init);
})();
