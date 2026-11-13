(() => {
  'use strict';
  const I18n=window.FamilyI18n;
  const $=id=>document.getElementById(id),app=()=>window.FamilyApp;
  const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const albums=new Map(),albumPages=new Map(),albumCovers=new Map(),albumEdges=new Map();
  const state={scope:null,items:[],index:0,activeId:null,pending:null,deleting:false,opener:null,paging:false,pageTarget:null,pageDirection:1,pageRequest:null,pageRender:null,pageQueued:false,navigation:0,session:0,photoActivity:0,photoLoading:false,photoTarget:null,fullscreen:false};
  const identity=item=>item.id||item.file;
  const versionKey=item=>JSON.stringify([identity(item),item.src,item.photoRevision||'original']);
  const current=()=>state.items[state.index];
  const desktopPhotoInput=()=>window.FamilyPhotoPresentation?.desktop?.()===true||navigator.userAgentData?.platform==='Windows'||/Windows/i.test(navigator.userAgent||'');
  const inlinePhotoCaption=()=>current()?.kind==='photo'&&!state.fullscreen&&(window.FamilyPhotoKeyboard?.desktop?.()??desktopPhotoInput());
  function photoIndex(direction,wrap=true,from=state.index){
    for(let distance=1;distance<=state.items.length;distance++){
      const index=from+direction*distance;
      if(!wrap&&(index<0||index>=state.items.length))return index<0?-1:state.items.length;
      const next=(index%state.items.length+state.items.length)%state.items.length;if(state.items[next]?.kind==='photo')return next;
    }
    return from;
  }
  function photoNeighbour(direction,from=state.index){
    const page=albumPages.get(state.scope),wrap=state.scope!=='gallery'||!(page?.pages>1);
    const index=state.fullscreen?photoIndex(direction,wrap,from):from+direction;
    if(state.items[index])return state.items[index];
    if(wrap)return state.items[(index+state.items.length)%state.items.length];
    // The first and last pages are neighbours in the same album. Keep their
    // already loaded previews under the finger while the page changes.
    const edge=albumEdges.get(state.scope);
    return (direction>0&&page.page===page.pages?edge?.first:direction<0&&page.page===1?edge?.last:null)||null;
  }
  function photoState(){
    const photos=state.items.filter(item=>item.kind==='photo'),page=state.scope==='gallery'?albumPages.get(state.scope):null;
    return {active:state.fullscreen,item:current(),scope:state.scope,busy:state.paging||state.photoLoading,pageLoading:state.paging,index:(page?(page.page-1)*page.size:0)+photos.indexOf(current()),total:page?.total??photos.length};
  }
  function setFullscreen(enabled){
    if(enabled&&(!$('mediaViewer').open||current()?.kind!=='photo'))return false;
    if(state.fullscreen===enabled)return true;
    const stage=$('mediaStage'),faces=stage._familyFaceContext;
    if(enabled&&(captionEditing||faces&&(faces.saving||faces.reviewSaving||faces.adjust||faces.resizeDrag||faces.popup?.classList.contains('face-picker'))))return false;
    const image=faces?.image||stage.querySelector('.native-photo-pane:nth-child(2) img')||stage.querySelector('img');
    state.fullscreen=enabled;$('mediaViewer').classList.toggle('photo-fullscreen',enabled);
    state.session++;state.navigation++;state.photoLoading=false;state.photoTarget=null;state.paging=false;state.pageTarget=null;state.pageRequest=null;
    window.FamilyPhotoViewerLayout?.sync();
    if($('mediaViewer').open)show(state.index,{image});return true;
  }
  const linked=(item,scope)=>scope?.startsWith('personal:')&&item.scope!==scope;
  let noticeTimer,expectedCaption='',captionEditing=false,captionEditor=0,captionSave=null,captionLocked=false;
  let renderedVersion=null,instagramPrepared={key:null,file:null};
  let restoringLink='',photoSwipe=null,faceTimer=null;
  const tr=(he,en)=>I18n.isEnglish?en:he;
  function shareURL(item){const url=new URL('/',location.origin);url.searchParams.set('media',item.id);url.searchParams.set('lang',I18n.language);url.hash='gallery';return url.href;}

  function controls(item,scope){
    return I18n.html`<div class="media-controls"><button data-media-open="${safe(identity(item))}" data-media-scope="${safe(scope)}">⛶ פתיחה בגלריה</button>${window.FamilyTags.controls(item)}${item.id?`<button class="media-delete" data-media-delete="${safe(item.id)}" data-media-scope="${safe(scope)}" aria-label="${linked(item,scope)?I18n.t('הסרת'):I18n.t('מחיקת')} ${safe(I18n.mediaName(item))}${linked(item,scope)?I18n.t(' מהאלבום'):''}">${I18n.isEnglish&&item.kind==='photo'?'Delete Photo':linked(item,scope)?I18n.t('הסרה מהאלבום'):I18n.t('מחיקת הפריט')}</button>`:''}</div>${window.FamilyTags.labels(item)}`;
  }
  function routeAlbum(){
    const [view,raw]=new URL(location.href).hash.slice(1).split('/');let id;
    try{id=raw&&decodeURIComponent(raw);}catch{return null;}
    if(view==='person'&&id)return 'personal:'+id;
    if(view==='weddings'&&id)return 'wedding:'+id;
    if(view==='nursery'&&id)return 'nursery:'+id;
    return ['gallery','photos','videos','nostalgia'].includes(view)?view:null;
  }
  function registeredLink(id){
    const preferred=routeAlbum(),scopes=preferred?[preferred]:[...albums.keys()].filter(scope=>!scope.startsWith('link:'));
    for(const scope of scopes){const items=albums.get(scope)||[],index=items.findIndex(item=>identity(item)===id);if(index>=0)return {scope,items,index};}
    return null;
  }
  function register(scope,items,{retainCurrent=false,advanceRemoved=false,pagination,cover}={}){
    const previousPage=albumPages.get(scope);
    albums.set(scope,items);
    if(cover!==undefined)albumCovers.set(scope,cover);
    if(pagination){
      albumPages.set(scope,{...pagination});
      const {page,...context}=pagination,key=JSON.stringify(context);
      const edge=albumEdges.get(scope)?.key===key?albumEdges.get(scope):{key};
      if(page===1)edge.first=items.find(item=>item.kind==='photo');
      if(page===pagination.pages)edge.last=items.findLast(item=>item.kind==='photo');
      albumEdges.set(scope,edge);
    }
    // A direct photo can arrive before its album. Adopt the matching route's
    // album in place so the image, face editor, zoom and focus survive loading.
    if($('mediaViewer')?.open&&state.scope?.startsWith('link:')&&scope===routeAlbum()&&new URL(location.href).searchParams.get('media')===state.activeId&&items.some(item=>identity(item)===state.activeId))state.scope=scope;
    if(!$('mediaViewer')?.open||state.scope!==scope)return;
    if(state.paging&&pagination?.page===state.pageTarget){
      const session=state.session,render=()=>{if(session!==state.session||!$('mediaViewer').open)return;state.items=items;if(items.length)show(state.pageDirection>0?0:items.length-1,{direction:state.pageDirection,native:state.pageNative,instant:state.pageInstant,effect:state.pageEffect});else $('mediaViewer').close();};
      let idle=state.pageNative||state.pageQueued?photoSwipe?.whenIdle?.():null;
      if(idle)state.pageRender=(async()=>{do{await idle;idle=photoSwipe?.whenIdle?.();}while(idle);render();})();else render();return;
    }
    const id=state.activeId,active=current(),nextIds=advanceRemoved?state.items.slice(state.index+1).map(identity):[];
    const previousPosition=((previousPage?.page||1)-1)*(previousPage?.size||state.items.length)+state.index;
    let index=items.findIndex(item=>identity(item)===id);
    // Keep the photo being tagged open even after it leaves the untagged filter.
    if(retainCurrent&&!state.deleting&&index<0&&active){items=[...items];index=Math.min(state.index,items.length);items.splice(index,0,active);}
    state.items=items;
    if(!items.length){$('mediaViewer').close();return;}
    if(index<0){
      const successor=nextIds.map(id=>items.findIndex(item=>identity(item)===id)).find(index=>index>=0);
      if(successor!==undefined)show(successor);
      // Completion removes the current photo. Preserve its old successor's
      // identity; after the final photo, continue at the start of the category.
      else if(advanceRemoved&&previousPosition>=(pagination?.total??items.length)){
        if(pagination?.page>1&&pagination.pages>1&&window.FamilyPortal?.pageGallery){state.index=items.length-1;void step(1);}
        else show(0);
      }else show(Math.min(state.index,items.length-1));
    }
    // Compare with the pixels actually mounted in the viewer: mutation events
    // may already have merged the new source into the active item's metadata.
    else {state.index=index;if(renderedVersion!==versionKey(items[index]))show(index);else metadata();}
  }
  function navigationBusy(){
    // Loading a neighbour must not rebuild the old photo's tags and controls.
    // Keep arrows clickable so another press can select a newer target.
    $('mediaPrevious').disabled=$('mediaNext').disabled=state.paging;
    $('mediaStage').setAttribute('aria-busy',String(state.photoLoading));
  }
  function metadata(){
    const item=current();if(!item)return;
    $('mediaViewer').setAttribute('data-media-scope',state.scope||'');
    const albumControls=$('mediaViewerCollections');if(albumControls){if(window.FamilyPhotoCollections?.mountViewer)window.FamilyPhotoCollections.mountViewer(albumControls,item,state.scope);else albumControls.innerHTML=window.FamilyPhotoCollections?.controls(item,state.scope,{viewer:true})||'';}
    $('mediaViewerCaption').textContent=$('mediaHeaderCaption').textContent=item.caption||'';
    const descriptionLabel=item.kind==='video'?tr('הוסף תיאור לסרטון','Add a video description'):item.kind==='document'?tr('הוסף תיאור למסמך','Add a document description'):tr('הוסף תיאור לתמונה','Add a photo description');
    const desktopDescriptionLabel=item.kind==='video'?tr('להוספת תיאור לסרטון','Add a video description'):item.kind==='document'?tr('להוספת תיאור למסמך','Add a document description'):tr('להוספת תיאור לתמונה','Add a photo description');
    $('editOpenedCaption').querySelector('[data-media-caption-mobile]').textContent=I18n.isEnglish?'Add a description':descriptionLabel;$('editOpenedCaption').querySelector('[data-media-caption-desktop]').textContent=desktopDescriptionLabel;$('editOpenedCaption').setAttribute('aria-label',desktopDescriptionLabel);$('editOpenedCaption').title=desktopDescriptionLabel;
    const url=shareURL(item),label=(item.caption||I18n.mediaName(item)||'Keha Family').replace(/[\r\n]/g,' ');
    $('shareMediaWhatsApp').href='https://wa.me/?text='+encodeURIComponent(label+'\n'+url);
    $('shareMediaFacebook').href='https://www.facebook.com/sharer/sharer.php?u='+encodeURIComponent(url);
    $('shareMediaEmail').href='mailto:?subject='+encodeURIComponent(label)+'&body='+encodeURIComponent(label+'\n\n'+url);
    if(instagramPrepared.key!==versionKey(item)){instagramPrepared={key:versionKey(item),file:null};$('shareMediaInstagram').disabled=false;$('shareMediaInstagram').removeAttribute('aria-busy');}
    $('shareMediaInstagram').hidden=item.kind==='document';
    $('instagramShareHelp').hidden=true;
    $('downloadForInstagram').href=item.src;$('downloadForInstagram').download=item.filename||'';
    $('downloadForInstagram').textContent=item.kind==='video'?tr('הורדת הסרטון','Download video'):tr('הורדת התמונה','Download photo');
    $('mediaShareStatus').textContent='';$('mediaLinkFallback').hidden=true;
    const ownerId=state.scope?.startsWith('personal:')?state.scope.slice(9):null,owner=ownerId&&(app()?.getPersonSummary?.(ownerId)||app()?.getPerson?.(ownerId)||window.FAMILY_DATA?.people?.[ownerId]),gender=['m','f'].includes(owner?.gender)?owner.gender:'unknown',profileButton=$('openedProfilePhoto');
    const albumCover=/^(wedding|nursery):/.test(state.scope||'');
    profileButton.hidden=!((ownerId||albumCover)&&item.kind==='photo');profileButton.setAttribute('data-gender',gender);
    const source=albumCover?albumCovers.get(state.scope):owner?.profile;
    let selected=false;
    if(!albumCover&&owner?.profileFile&&item.file)selected=owner.profileFile===item.file;
    else if(source&&item.src){try{selected=new URL(source,location.origin).pathname===new URL(item.src,location.origin).pathname;}catch{}}
    else if(!albumCover)selected=Boolean(owner?.profileId&&owner.profileId===item.id);
    profileButton.setAttribute('aria-pressed',String(selected));
    const profileLabel=state.scope?.startsWith('wedding:')?(selected?tr('זו תמונת החתונה','Current wedding cover photo'):tr('קבע כתמונת החתונה','Set wedding cover photo')):state.scope?.startsWith('nursery:')?(selected?tr('זו תמונת התינוקייה','Current baby album cover photo'):tr('קבע כתמונת התינוקייה','Set baby album cover photo')):(selected?tr('זו תמונת הפרופיל','Current profile picture'):tr('קבע כתמונת פרופיל','Set as profile picture'));
    profileButton.querySelector('span').textContent=profileLabel;profileButton.setAttribute('aria-label',profileLabel);profileButton.title=profileLabel;
    if(selected&&!albumCover){const undoLabel=tr('זו תמונת הפרופיל. לחצו לביטול הבחירה ולחזרה לתמונה הקודמת','Current profile picture. Click to undo this selection and restore the previous photo');profileButton.title=undoLabel;profileButton.setAttribute('aria-label',undoLabel);}
    const profileHair=profileButton.querySelector('[data-profile-hair]');if(gender==='f')profileHair.removeAttribute('hidden');else profileHair.setAttribute('hidden','');
    captionControls();
    const page=albumPages.get(state.scope),total=page?.total??state.items.length,offset=page?(page.page-1)*page.size:0;
    $('mediaStage').classList.toggle('photo-swipe-enabled',item.kind==='photo'&&total>1&&!state.paging);
    $('mediaViewerCounter').textContent=`${offset+state.index+1} / ${total}`;
    $('mediaPrevious').hidden=$('mediaNext').hidden=total<2;
    navigationBusy();
    const link=$('mediaOriginal');link.href=item.watchUrl||item.src;
    const edit=$('editOpenedPhoto');if(edit){edit.hidden=!(item.id&&item.kind==='photo');edit.setAttribute('aria-label',tr('עריכת תמונה','Edit photo'));edit.title=tr('עריכת תמונה','Edit photo');}
    const downloadLabel=item.kind==='video'?tr('הורדת סרטון','Download video'):item.kind==='document'?tr('הורדת מסמך','Download document'):tr('הורדת תמונה','Download photo');
    link.querySelector('span').textContent=item.provider==='youtube'?I18n.t('צפייה ביוטיוב ↗'):downloadLabel;link.querySelector('svg').hidden=item.provider==='youtube';link.title=item.provider==='youtube'?I18n.t('צפייה ביוטיוב ↗'):downloadLabel;
    if(item.provider==='youtube'){link.removeAttribute('download');link.target='_blank';link.rel='noopener';}
    else {link.download=item.filename||'';link.removeAttribute('target');link.removeAttribute('rel');}
    $('mediaViewerDelete').hidden=!item.id;
    const deleteLabel=I18n.isEnglish&&item.kind==='photo'?'Delete Photo':linked(item,state.scope)?I18n.t('הסרה מהאלבום'):tr('מחק פריט','Delete item');
    $('mediaViewerDelete').querySelector('span').textContent=deleteLabel;$('mediaViewerDelete').title=deleteLabel;
    window.FamilyTags.mountInline($('mediaTagPanel'),item);
    window.FamilyPhotoLabels?.mount(item);
    window.FamilyPhotoDate?.mount(item);
    window.FamilyFaces?.update(item);
    window.FamilyPhotoViewerLayout?.sync();
    refreshPhotoPresentation();
    window.FamilyPhotoFullscreen?.sync();
  }
  async function instagramFallback(item){
    if(identity(current()||{})!==identity(item)||!$('mediaViewer').open)return;
    $('instagramShareHelp').hidden=false;
    const url=shareURL(item);
    try{await navigator.clipboard.writeText(url);if(identity(current()||{})!==identity(item)||!$('mediaViewer').open)return;$('mediaShareStatus').textContent=tr('הקישור הועתק. אפשר להדביק אותו בהודעה ב-Instagram, או להוריד את התמונה ולהעלות אותה.','Link copied. Paste it into an Instagram message, or download the photo and upload it.');}
    catch{if(identity(current()||{})!==identity(item)||!$('mediaViewer').open)return;$('mediaLinkFallback').value=url;$('mediaLinkFallback').hidden=false;$('mediaShareStatus').textContent=tr('אפשר להוריד את התמונה ולהעלות ב-Instagram, או להעתיק את הקישור להודעה.','Download the photo to upload on Instagram, or copy the link into a message.');}
  }
  async function shareInstagram(event){
    event.preventDefault();const item=current();if(!item)return;
    const key=versionKey(item),button=$('shareMediaInstagram'),isCurrent=()=>versionKey(current()||{})===key&&$('mediaViewer').open;
    if(!navigator.share||!navigator.canShare||item.provider==='youtube'){await instagramFallback(item);return;}
    const type=item.mime||'',extensions={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','image/avif':'avif','video/mp4':'mp4','video/webm':'webm'};
    if(!extensions[type]){await instagramFallback(item);return;}
    button.disabled=true;button.setAttribute('aria-busy','true');
    try{
      let file=instagramPrepared.key===key?instagramPrepared.file:null;
      if(!file){
        $('mediaShareStatus').textContent=tr('מכינים את התמונה לשיתוף…','Preparing the photo to share…');
        const response=await I18n.fetch(item.src,{cache:'force-cache'});if(!response.ok)throw Error('Media unavailable');
        const blob=await response.blob();if(!isCurrent())return;
        file=new File([blob],'family-memory.'+extensions[type],{type});instagramPrepared={key,file};
      }
      if(!navigator.canShare({files:[file]})){await instagramFallback(item);return;}
      if(navigator.userActivation?.isActive===false){$('mediaShareStatus').textContent=tr('התמונה מוכנה. לחצו שוב על Instagram ובחרו אותו בחלון השיתוף.','The photo is ready. Tap Instagram again, then choose it in the sharing menu.');return;}
      $('mediaShareStatus').textContent=tr('בחרו Instagram בחלון השיתוף של הטלפון.','Choose Instagram in your phone’s sharing menu.');
      await navigator.share({files:[file],title:item.caption||I18n.mediaName(item)||'Keha Family'});
    }catch(error){if(!isCurrent())return;if(error.name==='AbortError'){$('mediaShareStatus').textContent='';return;}await instagramFallback(item);}
    finally{if(isCurrent()){button.disabled=false;button.removeAttribute('aria-busy');}}
  }
  function clearStage({preserveHandoff=false,nextItem=null}={}){
    clearTimeout(faceTimer);faceTimer=null;
    photoSwipe?.reset();
    window.FamilyPhotoPresentation?.cancel({preserveHandoff});
    renderedVersion=null;
    window.FamilyFaces?.clear({preserveControls:Boolean(nextItem?.id&&nextItem.kind==='photo'&&!state.fullscreen),item:nextItem});
    $('mediaStage').querySelectorAll('video').forEach(video=>{video.pause();video.removeAttribute('src');video.load();});
    $('mediaStage').replaceChildren();
  }
  function show(index,{direction=0,image=null,native=false,instant=false,effect=null}={}){
    if(!state.items.length)return;
    const handoff=native?window.FamilyPhotoPresentation?.holdNative?.($('mediaStage'),image):null;
    const ghost=!instant&&!native&&direction&&current()?.kind==='photo'?window.FamilyPhotoPresentation?.snapshot($('mediaStage')):null;
    state.index=(index+state.items.length)%state.items.length;
    const item=current();state.activeId=identity(item);captionEditing=false;captionLocked=false;captionEditor++;captionSave=null;clearStage({preserveHandoff:Boolean(handoff),nextItem:item});renderedVersion=versionKey(item);metadata();
    if($('mediaViewer').open)syncMediaRoute(item,true);
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
      const img=image||document.createElement('img');img.decoding='async';img.fetchPriority='high';img.draggable=false;if(!image)img.src=(item.kind==='photo'?item.previewSrc||item.src:item.src)+(item.kind==='document'?'?inline=1':'');img.alt=item.caption||I18n.mediaName(item);stage.append(img);$('mediaPlaybackNote').hidden=true;
      window.FamilyPhotoPresentation?.preload(state.items,state.index);
      if(!state.fullscreen){
        const mountFaces=()=>{faceTimer=null;if(current()&&identity(current())===identity(item)&&renderedVersion===versionKey(item))window.FamilyFaces?.mount(stage,img,current(),{highlightMissing:state.scope==='gallery'&&window.FamilyPortal?.isPartialGallery?.()===true});};
        if(direction&&!native&&!instant&&$('mediaViewer').classList.contains('personal-photo-desktop'))faceTimer=setTimeout(mountFaces,180);else mountFaces();
      }
      const preload=()=>{if($('mediaViewer').open&&current()===item)window.FamilyPhotoThumbnails?.schedule(item,img);};
      if(img.complete&&img.naturalWidth)preload();else img.addEventListener('load',preload,{once:true});
      if(item.kind==='photo'&&!instant){if(effect&&!native)window.FamilyPhotoPresentation?.transition(stage,ghost,effect);else window.FamilyPhotoPresentation?.slide(stage,ghost,-direction);}
      refreshPhotoPresentation();
      window.FamilyPhotoPresentation?.finishHandoff?.(handoff,img,window.FamilyFaces?.whenReady?.(stage,img));
      if(state.fullscreen)window.FamilyPhotoFullscreen?.present(item,img);
    }else if(['application/pdf','text/plain','text/markdown'].includes(item.mime)){
      const frame=document.createElement('iframe');frame.src=item.src+'?inline=1';frame.title=I18n.mediaName(item);frame.referrerPolicy='same-origin';stage.append(frame);$('mediaPlaybackNote').hidden=true;
    }else{
      const note=document.createElement('p');note.className='media-document-preview';note.textContent='▤ '+item.filename+I18n.t(' · לפתיחת המסמך בחרו ״הורדת המקור״.');stage.append(note);$('mediaPlaybackNote').hidden=true;
    }
  }
  function open(items,index=0,scope){
    if(!items?.length||index<0)return;
    state.photoActivity=Date.now();
    state.session++;state.navigation++;state.paging=false;state.pageRequest=null;state.photoLoading=false;state.photoTarget=null;state.pageTarget=null;state.scope=scope||items[index]?.scope||'shared';state.items=items;albums.set(state.scope,items);
    state.opener=document.activeElement;
    document.querySelectorAll('video').forEach(video=>video.pause());
    show(index);if(!$('mediaViewer').open){syncMediaRoute(current());$('mediaViewer').showModal();}window.FamilyPhotoViewerLayout?.sync();refreshPhotoPresentation();window.FamilyPhotoFullscreen?.sync();return true;
  }
  function syncMediaRoute(item,replace=false){
    if(!window.FamilyNavigation||!item?.id)return;
    const url=new URL(location.href);url.searchParams.set('media',item.id);window.FamilyNavigation.go(url.href,{replace});
  }
  function openFrom(scope,id){const items=albums.get(scope)||[];return open(items,items.findIndex(item=>identity(item)===id||item.file===id),scope);}
  async function step(direction,{native=false,instant=false,queued=false,effect=null}={}){
    if(!current())return;
    if(inlinePhotoCaption()&&captionEditing){
      const owner={session:state.session,navigation:state.navigation,id:identity(current())};
      if(!await saveOpenedCaption()||owner.session!==state.session||owner.navigation!==state.navigation||owner.id!==identity(current()||{}))return;
    }
    state.photoActivity=Date.now();
    if(state.paging){
      if(!queued||!state.pageRequest)return;
      const session=state.session;try{await state.pageRequest;}catch{return;}
      if(session===state.session&&$('mediaViewer').open)return step(direction,{native,instant,queued,effect});return;
    }
    if(state.photoLoading&&native&&!queued)return;
    const waiting=state.photoLoading?state.items.findIndex(item=>identity(item)===state.photoTarget):-1,from=waiting>=0?waiting:state.index;
    const page=albumPages.get(state.scope),wrap=state.scope!=='gallery'||!(page?.pages>1),next=state.fullscreen?photoIndex(direction,wrap,from):from+direction;
    if(state.fullscreen&&next===from)return;
    if(next>=0&&next<state.items.length||state.scope!=='gallery'||!(page?.pages>1)||!window.FamilyPortal?.pageGallery){
      const target=(next+state.items.length)%state.items.length,item=state.items[target],navigation=++state.navigation;
      const ready=item.kind==='photo'?window.FamilyPhotoPresentation?.ready?.(item):null;
      if(state.photoLoading&&target===state.index){state.photoLoading=false;state.photoTarget=null;window.FamilyPhotoPresentation?.cancel();navigationBusy();refreshPhotoPresentation();window.FamilyPhotoFullscreen?.sync();return;}
      let idle=native||queued?photoSwipe?.whenIdle?.():null;
      if(ready&&!idle){state.photoLoading=false;state.photoTarget=null;show(target,{direction,native,instant,effect,image:ready});return;}
      const pending=ready?Promise.resolve(ready):item.kind==='photo'?window.FamilyPhotoPresentation?.prepare(item):null;
      if(!pending&&!idle){state.photoLoading=false;state.photoTarget=null;show(next,{direction,native,instant,effect});return;}
      state.photoLoading=true;state.photoTarget=identity(item);navigationBusy();window.FamilyPhotoFullscreen?.sync();let image=null;
      try{image=await pending;}catch{}
      if(navigation!==state.navigation||!$('mediaViewer').open)return;
      // Keep the native target under the next finger stroke. Its release can
      // select another photo before the earlier load replaces the touch target.
      if(idle)await idle;while((native||queued)&&(idle=photoSwipe?.whenIdle?.()))await idle;
      if(navigation!==state.navigation||!$('mediaViewer').open)return;
      state.photoLoading=false;state.photoTarget=null;const updated=state.items.findIndex(photo=>identity(photo)===identity(item));if(updated>=0)show(updated,{direction,native,instant,effect,image:versionKey(state.items[updated])===versionKey(item)?window.FamilyPhotoPresentation?.copy?.(image)||image:null});else metadata();return;
    }
    const navigation=++state.navigation;state.photoLoading=false;state.photoTarget=null;state.paging=true;state.pageDirection=direction;state.pageNative=native;state.pageQueued=queued;state.pageInstant=instant;state.pageEffect=effect;state.pageTarget=(page.page-1+direction+page.pages)%page.pages+1;metadata();
    state.pageRender=null;
    try{state.pageRequest=Promise.resolve(window.FamilyPortal.pageGallery(state.pageTarget)).then(()=>state.pageRender);await state.pageRequest;}finally{if(navigation===state.navigation){state.paging=false;state.pageTarget=null;state.pageRequest=null;state.pageRender=null;if($('mediaViewer').open)metadata();}}
  }
  function canNavigatePhoto({pending=false}={}){
    const stage=$('mediaStage');return $('mediaViewer').open&&current()?.kind==='photo'&&(pending||!state.paging&&!state.photoLoading)&&!captionEditing&&
      (pending||!stage.classList.contains?.('photo-slide-running'))&&(state.fullscreen?photoState().total:(albumPages.get(state.scope)?.total??state.items.length))>1&&
      !document.querySelector('#deleteMediaDialog[open],#tagPeopleDialog[open],#photoUploadEditor[open],#photoDateDialog[open]')&&(window.FamilyFaces?.canNavigate?.(stage)??true);
  }
  function refreshPhotoPresentation(){
    const stage=$('mediaStage');
    // All devices use the same physical swipe and album order as Next/Previous.
    // Phones retain native vertical scrolling and pinch zoom; only desktop
    // touch needs its vertical movement handled by the pointer controller.
    stage.classList.toggle('photo-manual-swipes',desktopPhotoInput());
    window.FamilyPhotoNative?.reset(stage);
  }
  function requestDelete(scope,id){
    if(!app()?.apiEnabled){app()?.toast(I18n.t('השמירה אינה זמינה כרגע. נסו לרענן.'));return;}
    const item=(albums.get(scope)||[]).find(item=>item.id===id)||(state.scope===scope&&current()?.id===id?current():null);if(!item)return;
    const isLinked=linked(item,scope),personName=isLinked?app().nameOf(scope.slice(9)):'';
    state.pending={scope:scope.startsWith('personal:')?scope:item.scope,item,isLinked};$('deleteMediaName').textContent=item.name||item.filename;
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
    const href=location.href,id=new URL(href).searchParams.get('media');
    if(!id){restoringLink='';if($('mediaViewer').open)$('mediaViewer').close();return;}
    if($('mediaViewer').open&&state.activeId===id||restoringLink===href)return;
    const known=registeredLink(id);if(known){open(known.items,known.index,known.scope);return;}
    if(!/^[a-f0-9]{32}$/.test(id))return;
    restoringLink=href;
    try{const response=await I18n.fetch('api/media/'+id+'/view',{cache:'no-store'}),result=await response.json();if(location.href!==href)return;if(!response.ok)throw Error(I18n.error(result.error));const loaded=registeredLink(id);if(loaded)open(loaded.items,loaded.index,loaded.scope);else open([result.item],0,'link:'+result.item.id);}catch(error){if(location.href===href)app()?.toast(error.message);}finally{if(restoringLink===href)restoringLink='';}
  }
  function captionControls(){
    const inline=inlinePhotoCaption(),input=$('openedCaptionText'),form=$('openedCaptionForm');
    $('mediaViewer').classList.toggle('media-caption-inline',inline);$('editOpenedCaption').hidden=inline;
    form.hidden=!(inline||captionEditing);
    input.readOnly=inline&&captionLocked;form.classList.toggle('caption-saved',input.readOnly);
    if(!captionEditing){expectedCaption=current()?.caption||'';input.value=expectedCaption;$('openedCaptionError').textContent='';}
    form.querySelector('label').textContent=inline?tr('תיאור התמונה','Photo description'):tr('כיתוב לתמונה או לקובץ','Photo or file description');
    input.setAttribute('dir',I18n.isEnglish?'ltr':'rtl');
    input.placeholder=tr('הקלידו כאן תיאור...','Type a description here...');input.rows=inline?2:3;
  }
  function beginCaptionEdit(preserveValue=false){
    const item=current();if(!item||captionEditing)return;
    captionEditing=true;captionLocked=false;captionEditor++;captionSave=null;expectedCaption=item.caption||'';
    if(!preserveValue)$('openedCaptionText').value=expectedCaption;
    $('openedCaptionError').textContent='';captionControls();$('openedCaptionForm').querySelector('[type=submit]').disabled=false;
  }
  function saveOpenedCaption(event){
    event?.preventDefault();const item=current();if(!item||!captionEditing)return Promise.resolve(false);
    if(captionSave?.editor===captionEditor)return captionSave.promise;
    const owner={editor:captionEditor,session:state.session,id:identity(item)},input=$('openedCaptionText'),button=$('openedCaptionForm').querySelector('[type=submit]');
    const active=()=>$('mediaViewer').open&&owner.session===state.session&&owner.editor===captionEditor&&identity(current()||{})===owner.id&&captionEditing;
    button.disabled=true;$('openedCaptionError').textContent='';captionSave=owner;
    owner.promise=(async()=>{
      try{
        while(active()){
          const caption=input.value;
          if(caption!==expectedCaption){
            const response=await I18n.fetch('api/media/'+item.id+'/caption',{method:'POST',headers:{'Content-Type':'application/json','X-Family-Token':window.FAMILY_API_TOKEN},body:JSON.stringify({caption,expectedCaption})}),result=await response.json();
            if(!response.ok)throw Error(I18n.error(result.error));
            window.dispatchEvent(new CustomEvent('family-media-changed',{detail:result}));
            if(!active())return false;
            expectedCaption=result.item?.caption??caption;
            if(input.value!==caption)continue;
          }
          captionEditing=false;captionLocked=inlinePhotoCaption();captionControls();if(captionLocked)input.blur?.();notify(tr('הכיתוב נשמר ✓','Caption saved ✓'));return true;
        }
        return false;
      }catch(error){if(active())$('openedCaptionError').textContent=error.message;return false;}
      finally{if(captionSave===owner){captionSave=null;button.disabled=false;}}
    })();
    return owner.promise;
  }
  function canControlNavigate(){
    return Boolean($('mediaViewer').open&&current()&&!state.deleting&&(state.items.length>1||(albumPages.get(state.scope)?.total||0)>1)&&!document.querySelector('#deleteMediaDialog[open],#tagPeopleDialog[open],#photoUploadEditor[open],#photoDateDialog[open]'));
  }
  async function controlNavigate(direction,owner){
    const active=()=>owner.session===state.session&&owner.navigation===state.navigation&&owner.id===identity(current()||{})&&canControlNavigate();
    if(!active())return;
    try{
      await window.FamilyFaces?.flush?.();if(!active())return;
      if(captionEditing&&!await saveOpenedCaption())return;
      if(active())await step(direction,{instant:true,queued:true});
    }catch(error){if(active())notify(error.message||tr('לא ניתן להשלים את התיוג כרגע.','The tag could not be completed.'));}
  }
  function init(){
    const stage=$('mediaStage');
    $('mediaPrevious').querySelector('[data-paging-arrow]').textContent='←';$('mediaNext').querySelector('[data-paging-arrow]').textContent='→';
    photoSwipe=window.FamilyPhotoSwipe?.bind(stage,{
      enabled:()=>canNavigatePhoto({pending:true}),mouse:desktopPhotoInput,claim:()=> 'queued',
      vertical:dy=>{$('mediaViewer').scrollTop+=dy;},
      step,
      move:(dx,{queued=false}={})=>{
        if(!queued){window.FamilyPhotoPresentation?.drag(stage,dx);return;}
        const waiting=state.items.findIndex(item=>identity(item)===state.photoTarget),from=waiting>=0?waiting:state.index,direction=dx>0?1:-1,next=photoNeighbour(direction,from);
        window.FamilyPhotoPresentation?.dragQueued?.(stage,dx,{current:state.items[from],next});
      },cancel:()=>window.FamilyPhotoPresentation?.settle()
    });
    $('editOpenedPhoto')?.addEventListener('click',async()=>{
      const item=current();if(!item||item.kind!=='photo')return;
      if(!app()?.apiEnabled||!window.FamilyPhotoEditor?.edit){notify(tr('העורך אינו זמין כרגע. נסו לרענן.','The editor is unavailable. Please refresh.'));return;}
      try{const result=await window.FamilyPhotoEditor.edit({...item});if(!result)return;window.dispatchEvent(new CustomEvent('family-media-changed',{detail:result}));notify(tr('התמונה נשמרה. הגרסאות הקודמות זמינות בעורך ✓','Photo saved. Previous versions are available in the editor ✓'));}
      catch(error){notify(error.message);}
    });
    $('editOpenedCaption').addEventListener('click',()=>{beginCaptionEdit();$('openedCaptionText').focus();});
    $('cancelOpenedCaption').addEventListener('click',()=>{captionEditing=false;captionLocked=false;captionEditor++;captionSave=null;$('openedCaptionForm').querySelector('[type=submit]').disabled=false;captionControls();});
    $('openedCaptionText').addEventListener('click',()=>{if(inlinePhotoCaption()&&captionLocked){beginCaptionEdit(true);$('openedCaptionText').focus();}});
    $('openedCaptionText').addEventListener('input',()=>{if(inlinePhotoCaption())beginCaptionEdit(true);});
    $('openedCaptionForm').addEventListener('submit',saveOpenedCaption);
    $('openedCaptionText').addEventListener('keydown',event=>window.FamilyPhotoKeyboard?.saveDescription(event,saveOpenedCaption));
    window.FamilyPhotoKeyboard?.bindNavigation({available:canControlNavigate,capture:()=>({session:state.session,navigation:state.navigation,id:identity(current())}),navigate:controlNavigate});
    $('shareMediaInstagram').addEventListener('click',shareInstagram);
    $('shareMediaMessenger').addEventListener('click',async event=>{
      const item=current();if(!item){event.preventDefault();return;}const url=shareURL(item),title=item.caption||I18n.mediaName(item)||'Keha Family';
      if(navigator.share){event.preventDefault();try{await navigator.share({title,url});}catch(error){if(error.name!=='AbortError'){$('mediaShareStatus').textContent=tr('אפשר להעתיק את הקישור ולשלוח ב-Messenger.','Copy the link and send it in Messenger.');}}return;}
      try{await navigator.clipboard.writeText(url);$('mediaShareStatus').textContent=tr('הקישור הועתק. בחרו שיחה ב-Messenger והדביקו אותו.','Link copied. Choose a Messenger conversation and paste it.');}
      catch{$('mediaLinkFallback').value=url;$('mediaLinkFallback').hidden=false;$('mediaShareStatus').textContent=tr('העתיקו את הקישור מהשדה והדביקו בשיחה ב-Messenger.','Copy the link from the field and paste it in Messenger.');}
    });
    $('copyMediaLink').addEventListener('click',async()=>{if(!current())return;const url=shareURL(current());try{await navigator.clipboard.writeText(url);$('mediaShareStatus').textContent=tr('הקישור הועתק ✓','Link copied ✓');}catch{$('mediaLinkFallback').value=url;$('mediaLinkFallback').hidden=false;$('mediaLinkFallback').focus();$('mediaLinkFallback').select();$('mediaShareStatus').textContent=tr('אפשר להעתיק את הקישור מהשדה','Copy the link from the field');}});
    $('openedProfilePhoto').addEventListener('click',async()=>{
      const item=current(),scope=state.scope;if(!item||item.kind!=='photo'||!scope||!(/^(personal|wedding|nursery):/.test(scope)))return;
      const albumCover=!scope.startsWith('personal:'),id=scope.slice(9),button=$('openedProfilePhoto'),selected=button.getAttribute('aria-pressed')==='true',restorePrevious=!albumCover&&selected;
      if(button.disabled||albumCover&&selected)return;button.disabled=true;
      try{
        const response=await I18n.fetch(albumCover?'api/collections/cover':'api/people/'+encodeURIComponent(id)+'/profile',{method:'POST',headers:{'Content-Type':'application/json','X-Family-Token':window.FAMILY_API_TOKEN},body:JSON.stringify(albumCover?{collection:scope,mediaId:item.id}:{file:item.file,...(restorePrevious?{restorePrevious:true}:{})})});
        const result=await response.json();if(!response.ok)throw Error(I18n.error(result.error));
        if(albumCover)window.dispatchEvent(new CustomEvent('family-media-changed',{detail:result}));
        else{app().updatePerson(id,result.person);window.dispatchEvent(new CustomEvent('family-person-changed',{detail:{id}}));}
        notify(restorePrevious?(result.person.profile?tr('תמונת הפרופיל הקודמת הוחזרה ✓','Previous profile picture restored ✓'):tr('הקביעה בוטלה. אין תמונת פרופיל.','Selection removed. No profile picture is set.')):albumCover?tr('תמונת הפרופיל של האלבום עודכנה ✓','Album cover photo updated ✓'):tr('תמונת הפרופיל עודכנה ✓','Profile picture updated ✓'));
      }catch(error){notify(error.message);}finally{button.disabled=false;}
    });
    const refreshProfile=event=>{if($('mediaViewer').open&&state.scope==='personal:'+event.detail.id)metadata();};
    window.addEventListener('family-person-changed',refreshProfile);window.addEventListener('family-profile-changed',refreshProfile);
    window.addEventListener('family-thumbnail-ready',event=>{const item=event.detail.item;if(item)for(const items of albums.values())for(const photo of items)if(photo.id===item.id){photo.thumbnailSrc=item.thumbnailSrc;photo.thumbnailSize=item.thumbnailSize;photo.previewSrc=item.previewSrc||photo.previewSrc;photo.previewSize=item.previewSize||photo.previewSize;}});
    window.addEventListener('family-media-changed',event=>{const result=event.detail;if(result.collection&&'cover' in result.collection)albumCovers.set(result.scope,result.collection.cover);if(!result.item)return;for(const [scope,items]of [...albums]){
      const albumRemoval=result.operation==='collection'&&result.included===false&&scope===result.scope&&/^(nursery|wedding):/.test(scope);
      const remove=result.operation==='delete'||(result.operation==='untag'&&scope===result.contextScope)||albumRemoval,updated=items.filter(item=>!(remove&&item.id===result.item.id)).map(item=>item.id===result.item.id?{...item,...result.item}:item);
      // The visible photo may already be absent from the filtered album. Keep
      // its latest metadata, and pin it through every subsequent tag/scan event.
      if(!remove&&state.scope===scope&&state.activeId===result.item.id)state.items=state.items.map(item=>item.id===result.item.id?{...item,...result.item}:item);
      register(scope,updated,{retainCurrent:!(remove&&state.scope===scope&&state.activeId===result.item.id)});
    }});
    openSharedLink();
    window.addEventListener('popstate',openSharedLink);window.addEventListener('hashchange',openSharedLink);
    document.addEventListener('click',event=>{
      const open=event.target.closest('[data-media-open]');if(open){openFrom(open.dataset.mediaScope,open.dataset.mediaOpen);return;}
      const remove=event.target.closest('[data-media-delete]');if(remove)requestDelete(remove.dataset.mediaScope,remove.dataset.mediaDelete);
    });
    $('closeMediaViewer').addEventListener('click',()=>$('mediaViewer').close());
    $('mediaPrevious').addEventListener('click',()=>step(-1,{instant:window.FamilyPhotoPresentation?.desktop?.()}));$('mediaNext').addEventListener('click',()=>step(1,{instant:window.FamilyPhotoPresentation?.desktop?.()}));
    $('mediaViewerDelete').addEventListener('click',()=>requestDelete(state.scope,current()?.id));
    $('confirmMediaDelete').addEventListener('click',confirmDelete);
    $('cancelMediaDelete').addEventListener('click',()=>$('deleteMediaDialog').close());
    $('deleteMediaDialog').addEventListener('cancel',event=>{if(state.deleting)event.preventDefault();});
    $('deleteMediaDialog').addEventListener('close',()=>{state.pending=null;});
    $('mediaViewer').addEventListener('close',()=>{state.session++;state.navigation++;state.paging=false;state.pageTarget=null;state.pageRequest=null;state.photoLoading=false;state.photoTarget=null;state.fullscreen=false;$('mediaViewer').classList.toggle('photo-fullscreen',false);window.FamilyPhotoFullscreen?.closed();instagramPrepared={key:null,file:null};const url=new URL(location.href);if(url.searchParams.get('media')===state.activeId){url.searchParams.delete('media');if(window.FamilyNavigation)window.FamilyNavigation.returnTo(url.href);else history.replaceState(null,'',url.href);}clearStage();window.FamilyTags.clearInline($('mediaTagPanel'));if(state.opener?.isConnected)state.opener.focus({preventScroll:true});});
    document.addEventListener('keydown',event=>{
      if(!$('mediaViewer').open||$('deleteMediaDialog').open||$('tagPeopleDialog').open||document.querySelector('#photoUploadEditor[open],#photoDateDialog[open]')||event.target.closest('input,textarea'))return;
      if(event.key==='ArrowLeft'){event.preventDefault();step(-1);}
      if(event.key==='ArrowRight'){event.preventDefault();step(1);}
    });
  }
  window.FamilyMedia={register,controls,open,openFrom,requestDelete,notify,current,refreshPhotoPresentation,photoState,setFullscreen,step,isPhotoBrowsing:()=>Boolean($('mediaViewer')?.open&&current()?.kind==='photo'&&(state.photoLoading||state.paging||photoSwipe?.isActive?.()||Date.now()-state.photoActivity<800)),lookup:(scope,id)=>(albums.get(scope)||[]).find(item=>identity(item)===id||item.file===id),isOpen:scope=>Boolean($('mediaViewer')?.open&&(!scope||state.scope===scope))};
  document.addEventListener('DOMContentLoaded',init);
})();
