(() => {
  'use strict';
  const $=id=>document.getElementById(id),tr=(he,en)=>window.FamilyI18n.isEnglish?en:he;
  const expand='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m8 0h5v-5"/></svg>';
  const playIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7Z"/></svg>',pauseIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14"/></svg>';
  let viewer,stage,root,anchor,bar,play,close,previous,next,counter,caption,status,active=false,playing=false,returnToViewer=true,hadNative=false;
  let timer=null,hideTimer=null,frame=null,paint=0,ready=false,wasBusy=false;
  const media=()=>window.FamilyMedia;
  function button(className,label,html){const node=document.createElement('button');node.type='button';node.className=className;node.setAttribute('aria-label',label);node.title=label;node.innerHTML=html;return node;}
  function cancelAdvance(){clearTimeout(timer);timer=null;}
  function schedule(){
    cancelAdvance();const state=media()?.photoState();
    if(!active||!playing||!ready||document.hidden||state?.busy||!(state?.total>1))return;
    timer=setTimeout(()=>{timer=null;if(active&&playing&&!document.hidden)media().step(1);},4000);
  }
  function showControls(){
    if(!active)return;root.classList.add('controls-visible');clearTimeout(hideTimer);
    hideTimer=setTimeout(()=>{if(active&&!root.querySelector('button:focus-visible'))root.classList.remove('controls-visible');},2400);
  }
  function sync(){
    if(!viewer||!media())return;const state=media().photoState(),photo=state.item?.kind==='photo';
    if(!active){
      if(viewer.open&&photo&&!stage.querySelector('[data-photo-fullscreen]')){const launch=button('photo-fullscreen-launch photo-fullscreen-viewer',tr('הצגת התמונה במסך מלא','View photo fullscreen'),expand);launch.dataset.photoFullscreen='viewer';stage.append(launch);}
      return;
    }
    if(!viewer.open){closed();return;}if(!photo){exit();return;}
    const resumed=wasBusy&&!state.busy;wasBusy=state.busy;if(state.busy)cancelAdvance();
    const label=tr('תמונה '+(state.index+1)+' מתוך '+state.total,'Photo '+(state.index+1)+' of '+state.total);
    if(counter.textContent!==label)counter.textContent=label;
    if(caption.textContent!==(state.item.caption||''))caption.textContent=state.item.caption||'';caption.hidden=!state.item.caption;
    previous.hidden=next.hidden=state.total<2;previous.disabled=next.disabled=state.busy;
    if(state.total<2){playing=false;cancelAdvance();}play.disabled=state.total<2;
    const playLabel=playing?tr('השהיית המצגת','Pause slideshow'):tr('הפעלת מצגת בלולאה','Play looping slideshow');
    if(play.getAttribute('aria-label')!==playLabel){play.setAttribute('aria-label',playLabel);play.title=playLabel;play.innerHTML=playing?pauseIcon:playIcon;}play.setAttribute('aria-pressed',String(playing));
    if(resumed&&ready)schedule();
  }
  function present(item,image){
    const token=++paint;ready=false;cancelAdvance();if(!active)return;
    status.textContent='';
    const loaded=image.complete?(image.naturalWidth?Promise.resolve():Promise.reject(Error('Image unavailable'))):new Promise((resolve,reject)=>{
      image.addEventListener('load',resolve,{once:true});image.addEventListener('error',reject,{once:true});
    });
    loaded.then(()=>image.decode?.().catch(()=>{})).then(()=>{
      if(!active||token!==paint||media().current()!==item)return;ready=true;schedule();
    }).catch(()=>{if(active&&token===paint){playing=false;ready=false;cancelAdvance();status.textContent=tr('התמונה לא נטענה. אפשר לעבור לתמונה הבאה.','This photo could not load. You can move to the next photo.');sync();}});
    sync();
  }
  function restoreStage(){if(anchor?.parentNode)anchor.replaceWith(stage);anchor=null;root.hidden=true;}
  function leaveNative(){if(document.fullscreenElement===root)Promise.resolve(document.exitFullscreen?.()).catch(()=>{});}
  function enter(backToViewer=true){
    if(active||!viewer.open||media().current()?.kind!=='photo'||media().photoState().busy)return false;
    returnToViewer=backToViewer;active=true;playing=false;hadNative=false;ready=false;wasBusy=false;root.hidden=false;
    if(!media().setFullscreen(true)){active=false;root.hidden=true;return false;}
    anchor=document.createComment('fullscreen-photo-position');stage.before(anchor);root.prepend(stage);root.hidden=false;
    sync();showControls();root.focus({preventScroll:true});
    // A div can request browser fullscreen; a dialog itself cannot. Phones that
    // do not expose that API use the same edge-to-edge viewport presentation.
    try{const requested=root.requestFullscreen?.();if(requested)Promise.resolve(requested).then(()=>{if(!active)leaveNative();}).catch(()=>{});}catch{}
    return true;
  }
  function exit(){
    if(!active)return;const back=returnToViewer;active=false;playing=false;ready=false;paint++;cancelAdvance();clearTimeout(hideTimer);hadNative=false;
    leaveNative();restoreStage();media().setFullscreen(false);
    if(!back&&viewer.open)viewer.close();else stage.querySelector('[data-photo-fullscreen]')?.focus({preventScroll:true});
  }
  function closed(){
    if(!root)return;active=false;playing=false;ready=false;paint++;cancelAdvance();clearTimeout(hideTimer);hadNative=false;leaveNative();restoreStage();
  }
  function launch(opener){
    const wasOpen=viewer.open;
    if(opener===stage){enter(true);return;}
    const scope=opener.dataset.photoAlbum||opener.dataset.mediaScope,id=opener.dataset.photoId||opener.dataset.mediaOpen;
    if(scope&&id){if(!media().openFrom(scope,id))return;}
    else if(opener.matches('[data-person-item]'))opener.click();
    else if(opener.matches('[data-person-portrait]')){
      const image=opener.querySelector('img');if(!image)return;
      const src=image.currentSrc||image.src;media().open([{kind:'photo',src,file:src,caption:image.alt||'',name:image.alt||'',mime:'image/jpeg',tags:[]}],0,'profile-photo');
    }
    if(viewer.open&&media().current()?.kind==='photo')enter(wasOpen);
  }
  function decorate(){
    frame=null;
    for(const opener of document.querySelectorAll('[data-media-open],[data-person-item][data-person-kind="photos"],[data-person-portrait]')){
      if(opener.closest('#mediaViewer')||!opener.querySelector('img')||opener.disabled||opener._photoFullscreenLaunch?.isConnected)continue;
      if(opener.dataset.mediaOpen&&media()?.lookup(opener.dataset.mediaScope,opener.dataset.mediaOpen)?.kind!=='photo')continue;
      const wrapper=document.createElement('div');wrapper.className='photo-fullscreen-thumb'+(opener.matches('[data-person-portrait]')?' photo-fullscreen-portrait':'');
      opener.before(wrapper);wrapper.append(opener);const control=button('photo-fullscreen-launch',tr('הצגת התמונה במסך מלא','View photo fullscreen'),expand);
      control.dataset.photoFullscreen='thumbnail';control._photoOpener=opener;opener._photoFullscreenLaunch=control;wrapper.append(control);
    }
    const home=$('homeSlideStage'),opener=$('homeSlideOpen');
    if(home&&opener&&!home.querySelector('[data-photo-fullscreen]')){const control=button('photo-fullscreen-launch photo-fullscreen-home',tr('הצגת התמונה במסך מלא','View photo fullscreen'),expand);control.dataset.photoFullscreen='home';control._photoOpener=opener;home.append(control);}
  }
  function scheduleDecoration(){if(frame===null)frame=requestAnimationFrame(decorate);}
  function init(){
    viewer=$('mediaViewer');stage=$('mediaStage');if(!viewer||!stage)return;
    root=document.createElement('div');root.id='photoFullscreenRoot';root.className='photo-fullscreen-root';root.hidden=true;root.tabIndex=-1;root.setAttribute('role','group');root.setAttribute('aria-label',tr('תצוגת תמונות במסך מלא','Fullscreen photo viewer'));
    bar=document.createElement('div');bar.className='photo-fullscreen-bar';bar.dir='ltr';
    play=button('photo-fullscreen-play',tr('הפעלת מצגת בלולאה','Play looping slideshow'),playIcon);play.setAttribute('aria-pressed','false');
    close=button('photo-fullscreen-close',tr('יציאה ממסך מלא','Exit fullscreen'),'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>');
    previous=button('photo-fullscreen-previous',tr('התמונה הקודמת','Previous photo'),'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 5-7 7 7 7"/></svg>');
    next=button('photo-fullscreen-next',tr('התמונה הבאה','Next photo'),'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m10 5 7 7-7 7"/></svg>');
    counter=document.createElement('span');counter.className='photo-fullscreen-counter';counter.setAttribute('role','status');counter.setAttribute('aria-live','polite');counter.dir='auto';
    caption=document.createElement('p');caption.className='photo-fullscreen-caption';caption.dir='auto';status=document.createElement('p');status.className='photo-fullscreen-status';status.setAttribute('role','status');
    bar.append(play,counter,close);root.append(bar,previous,next,caption,status);viewer.append(root);
    close.addEventListener('click',exit);previous.addEventListener('click',()=>media().step(-1));next.addEventListener('click',()=>media().step(1));
    play.addEventListener('click',()=>{playing=!playing;sync();schedule();showControls();});
    root.addEventListener('pointermove',showControls,{passive:true});root.addEventListener('pointerdown',showControls,{passive:true});root.addEventListener('focusin',showControls);
    viewer.addEventListener('cancel',event=>{if(active){event.preventDefault();exit();}});
    document.addEventListener('keydown',event=>{if(active&&event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();exit();}},{capture:true});
    document.addEventListener('fullscreenchange',()=>{if(document.fullscreenElement===root)hadNative=true;else if(active&&hadNative)exit();});
    document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelAdvance();else schedule();});
    document.addEventListener('click',event=>{
      const control=event.target.closest('[data-photo-fullscreen]');if(!control)return;event.preventDefault();event.stopPropagation();
      if(control.dataset.photoFullscreen==='viewer')launch(stage);else launch(control._photoOpener);
    },{capture:true});
    if(typeof MutationObserver!=='undefined')new MutationObserver(records=>{if(records.some(record=>!viewer.contains(record.target)&&[...record.addedNodes].some(node=>node.nodeType===1)))scheduleDecoration();}).observe(document.body,{childList:true,subtree:true});
    window.addEventListener('family-media-changed',scheduleDecoration);decorate();sync();
  }
  window.FamilyPhotoFullscreen={enter,exit,closed,sync,present,isActive:()=>active};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
