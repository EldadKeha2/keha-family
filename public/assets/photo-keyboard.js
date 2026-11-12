(() => {
  'use strict';
  function desktop(){
    const ua=navigator.userAgent||'';
    if(navigator.userAgentData?.mobile===true||/Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(ua)||(/Macintosh/i.test(ua)&&navigator.maxTouchPoints>1))return false;
    return /Windows|Macintosh|X11|Linux|CrOS|KehaFamilyDesktop\//i.test(ua)||matchMedia('(min-width:701px)').matches;
  }
  function saveDescription(event,save){
    if(!desktop()||event.key!=='Enter'||event.shiftKey||event.ctrlKey||event.altKey||event.metaKey||event.isComposing||event.keyCode===229||event.defaultPrevented)return false;
    event.preventDefault();event.stopPropagation();
    if(!event.repeat)save();
    return true;
  }
  function bindNavigation({available,capture,navigate}){
    let tap=null;
    const eligible=event=>desktop()&&!event.defaultPrevented&&!event.isComposing&&!event.altKey&&!event.metaKey&&available();
    window.addEventListener('keydown',event=>{
      if(event.key==='Control'){
        if(!event.repeat)tap=eligible(event)?{context:capture(),previous:Boolean(event.shiftKey)}:null;
      }else if(event.key==='Shift'&&event.ctrlKey&&tap)tap.previous=true;
      else tap=null;
    },{capture:true});
    window.addEventListener('keyup',event=>{
      if(event.key==='Shift')return;
      const pressed=tap;tap=null;
      if(event.key!=='Control'||event.ctrlKey||!pressed||!eligible(event))return;
      event.preventDefault();event.stopPropagation();
      navigate(pressed.previous||event.shiftKey?-1:1,pressed.context);
    },{capture:true});
    for(const type of ['blur','pointerdown','wheel'])window.addEventListener(type,()=>{tap=null;},{capture:true,passive:true});
  }
  window.FamilyPhotoKeyboard={desktop,saveDescription,bindNavigation};
})();
