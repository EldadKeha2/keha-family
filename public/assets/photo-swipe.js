(() => {
  'use strict';
  // Pointer events cover phones, tablets and touch screens regardless of width.
  function bind(stage,{enabled,step,isEnglish}){
    let gesture=null,suppressClickUntil=0;
    const controls='a,input,textarea,select,video,iframe,[contenteditable],[role="textbox"],button:not(.face-hit),.face-picker,.face-name,.face-label-list,.face-adjust-guide,[data-face-handle]';
    const reset=()=>{gesture=null;};
    const blockClick=()=>{suppressClickUntil=Date.now()+700;};
    document.addEventListener('pointerdown',event=>{
      if(gesture&&event.pointerId!==gesture.id){blockClick();reset();}
    },{capture:true,passive:true});
    stage.addEventListener('pointerdown',event=>{
      if(!['touch','pen'].includes(event.pointerType)||event.isPrimary===false||event.button>0||!enabled()||event.target.closest(controls))return;
      suppressClickUntil=0;
      gesture={id:event.pointerId,x:event.clientX,y:event.clientY,time:Date.now(),dragged:false};
    },{passive:true});
    document.addEventListener('pointermove',event=>{
      const g=gesture;if(!g||event.pointerId!==g.id)return;
      if(!enabled()){if(g.dragged)blockClick();reset();return;}
      const dx=event.clientX-g.x,dy=event.clientY-g.y;
      if(!g.dragged){
        if(Math.abs(dy)>10&&Math.abs(dy)>=Math.abs(dx)){reset();return;}
        if(Math.abs(dx)<10||Math.abs(dx)<Math.abs(dy)*1.3)return;
        g.dragged=true;
        stage.setPointerCapture?.(event.pointerId);
      }
      blockClick();if(event.cancelable)event.preventDefault();
    },{capture:true,passive:false});
    document.addEventListener('pointerup',event=>{
      const g=gesture;if(!g||event.pointerId!==g.id)return;reset();
      const dx=event.clientX-g.x,dy=event.clientY-g.y;
      const distance=Math.max(40,Math.min(80,stage.clientWidth*.12));
      if(g.dragged||Math.abs(dx)>10)blockClick();
      if(!enabled()||Date.now()-g.time>1500||Math.abs(dx)<distance||Math.abs(dx)<Math.abs(dy)*1.5)return;
      if(event.cancelable)event.preventDefault();
      // Match the existing previous/next arrows in Hebrew and English.
      step((dx<0?1:-1)*(isEnglish()?1:-1));
    },{capture:true,passive:false});
    document.addEventListener('pointercancel',event=>{if(gesture?.id===event.pointerId){blockClick();reset();}},{capture:true,passive:true});
    // A swipe starting over a face must not also open or remove its tag.
    stage.addEventListener('click',event=>{
      if(event.detail!==0&&Date.now()<suppressClickUntil){event.preventDefault();event.stopImmediatePropagation();}
    },{capture:true});
    window.addEventListener('blur',reset);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)reset();});
    return {reset};
  }
  window.FamilyPhotoSwipe={bind};
})();
