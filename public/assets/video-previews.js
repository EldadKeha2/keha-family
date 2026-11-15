(() => {
  'use strict';
  // Decorative first frames must not compete with the opened video, photos or
  // uploads. Keep the existing cover/player markup, but attach its URL only
  // when that cover approaches the viewport.
  const watched=new Set(),nearby=new Set(),queued=new Set(),active=new Map(),foreground=new WeakSet(),waitingForExit=new WeakSet();
  const connection=()=>window.navigator?.connection;
  const constrained=()=>connection()?.saveData||/^(slow-)?2g$/.test(connection()?.effectiveType||'');
  function eligible(video){
    if(!video.isConnected||document.hidden||video.closest?.('[hidden]'))return false;
    const folder=video.closest?.('[data-nostalgia-folder]');
    return !folder||folder.style.getPropertyValue('--stack-opacity')!=='0';
  }
  function pump(){
    const limit=constrained()?1:3;
    for(const video of queued){
      if(active.size>=limit)break;
      queued.delete(video);
      if(waitingForExit.has(video)||!eligible(video)||!nearby.has(video)||!video.dataset.previewSrc)continue;
      start(video);
    }
  }
  function start(video){
    if(!video.dataset.previewSrc)return;
    const src=video.dataset.previewSrc;
    observer?.unobserve(video);watched.delete(video);nearby.delete(video);queued.delete(video);waitingForExit.delete(video);
    let timer;
    const finish=({cancel=false,type}={})=>{
      // Once a visitor has used native controls the player owns its request.
      // Keep its token until a real media event; never reset active playback.
      if(cancel&&foreground.has(video)&&video.isConnected)return;
      if(!active.delete(video))return;
      clearTimeout(timer);
      for(const type of ['loadeddata','error','abort'])video.removeEventListener(type,finish);
      const currentSrc=video.getAttribute?.('src')??video.src;
      if((cancel||type==='error'||type==='abort')&&currentSrc===src){
        // Releasing a queue slot must also stop the underlying request. A
        // timer alone would allow an unlimited number of stalled downloads.
        video.removeAttribute('src');video.preload='none';video.dataset.previewSrc=src;
        try{video.load();}catch{}
        // Re-arm the observer, but require an exit/entry before retrying.
        // Its immediate callback for an already visible failed cover must not
        // create an endless retry loop on a weak or disconnected network.
        waitingForExit.add(video);
        if(observer&&video.isConnected){watched.add(video);observer.observe(video);}
      }else if(type==='loadeddata'){
        video.hidden=false;
      }
      pump();
    };
    active.set(video,finish);
    for(const type of ['loadeddata','error','abort'])video.addEventListener(type,finish,{once:true});
    timer=setTimeout(()=>finish({cancel:true}),12000);
    video.preload='metadata';video.src=src;delete video.dataset.previewSrc;
    try{video.load();}catch{finish({cancel:true});}
  }
  const observer=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{
    for(const {target,isIntersecting}of entries){
      if(!target.dataset.previewSrc)continue;
      if(isIntersecting){nearby.add(target);if(!waitingForExit.has(target)&&eligible(target))queued.add(target);}
      else{nearby.delete(target);queued.delete(target);waitingForExit.delete(target);}
    }
    pump();
  },{rootMargin:constrained()?'80px':'350px'}):null;
  function watch(root=document){
    for(const video of watched)if(!video.isConnected){observer?.unobserve(video);watched.delete(video);nearby.delete(video);queued.delete(video);}
    for(const [video,finish]of active)if(!video.isConnected)finish({cancel:true});
    const videos=[...(root.matches?.('video[data-preview-src]')?[root]:[]),...root.querySelectorAll('video[data-preview-src]')];
    for(const video of videos){
      if(waitingForExit.has(video)||!eligible(video))continue;
      if(!observer){nearby.add(video);queued.add(video);}
      else if(!watched.has(video)){watched.add(video);observer.observe(video);}
      else if(nearby.has(video))queued.add(video);
    }
    pump();
  }
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)watch();});
  // An inline player's native controls remain immediately available even if
  // its optional first-frame request was still waiting behind other covers.
  for(const type of ['pointerdown','focusin','play'])document.addEventListener(type,event=>{
    const video=event.target.closest?.('video');
    if(video){foreground.add(video);start(video);}
  },true);
  document.addEventListener('error',event=>{
    const image=event.target,src=image?.dataset?.videoPosterSrc;
    if(!src||!image.isConnected)return;
    // A prepared JPEG is optional; transient errors retain the exact old
    // first-frame cover behavior instead of leaving a permanently blank tile.
    const video=document.createElement('video');video.muted=true;video.playsInline=true;video.preload='none';video.tabIndex=-1;video.setAttribute('aria-hidden','true');video.dataset.previewSrc=src;
    image.replaceWith(video);watch(video);
  },true);
  window.FamilyVideoPreviews={watch};
})();
