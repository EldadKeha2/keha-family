(() => {
  'use strict';
  const mobile=()=>!(navigator.userAgentData?.platform==='Windows'||/Windows/i.test(navigator.userAgent||''))&&(navigator.userAgentData?.mobile===true||/Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(navigator.userAgent||'')||(/Macintosh/i.test(navigator.userAgent||'')&&navigator.maxTouchPoints>1));
  // The generated-video dialogs keep their own captions, download links and
  // animation buttons. Only their existing player receives a shared input layer.
  function bind(video,{isOpen,select}){
    if(!video?.parentNode)return null;
    const stage=document.createElement('div');stage.className='video-album-stage';video.before(stage);stage.append(video);
    let items=[],index=0;
    const enabled=()=>isOpen()&&items.length>1;
    const navigate=direction=>{if(!enabled())return;const next=(index+direction+items.length)%items.length;return select(items[next]);};
    const native=()=>window.FamilyPhotoNative;
    const vertical=dy=>{const dialog=stage.closest('dialog');if(dialog)dialog.scrollTop=(dialog.scrollTop||0)+dy;};
    const refresh=()=>{
      if(!mobile()&&native()?.supported?.()===true&&enabled())native().mount(stage,{previous:items[(index-1+items.length)%items.length],next:items[(index+1)%items.length],enabled,step:navigate,touchStep:navigate,vertical});
      else native()?.reset(stage);
    };
    const manual=window.FamilyPhotoSwipe?.bind(stage,{enabled,mouse:()=>!mobile(),preferPointer:()=>!mobile(),touchOnly:()=>mobile()&&'ontouchstart' in window,
      nativeScroll:()=>native()?.has?.(stage)===true,strictStart:true,videoSurface:()=>video,vertical,
      wheelRoot:()=>stage.closest('dialog'),
      right:()=>navigate(mobile()?-1:1),left:()=>navigate(mobile()?1:-1)});
    window.addEventListener?.('resize',refresh);
    return {
      sync(nextItems,selected){items=[...nextItems];index=Math.max(0,items.findIndex(item=>item.key===selected));refresh();},
      close(){const owned=native()?.has?.(stage)===true;items=[];manual?.reset();native()?.reset(stage);if(owned)window.FamilyMedia?.refreshPhotoPresentation?.();},
      stage
    };
  }
  window.FamilyVideoAlbumInput={bind};
})();
