(() => {
  'use strict';
  // Pointer events cover phones, tablets and touch screens regardless of width.
  function bind(stage,{enabled,step,isEnglish,move,cancel}){
    let gesture=null,suppressClickUntil=0,touchStart=null;
    const controls='a,input,textarea,select,video,iframe,[contenteditable],[role="textbox"],button:not(.face-hit),.face-picker,.face-name,.face-label-list,.face-adjust-guide,[data-face-handle]';
    const reset=(preserveTouch=false)=>{gesture=null;if(preserveTouch!==true){touchStart=null;cancel?.();}};
    const blockClick=()=>{suppressClickUntil=Date.now()+700;};
    document.addEventListener('pointerdown',event=>{
      if(gesture&&event.pointerId!==gesture.id){blockClick();reset();}
    },{capture:true,passive:true});
    const begin=event=>{
      if(!(['touch','pen'].includes(event.pointerType)||event.sourceCapabilities?.firesTouchEvents)||event.isPrimary===false||event.button>0||!enabled()||event.target.closest(controls))return;
      suppressClickUntil=0;
      gesture={id:event.pointerId,x:event.clientX,y:event.clientY,time:Date.now(),dragged:false};
    };
    stage.addEventListener('pointerdown',begin,{capture:true,passive:true});
    const moved=event=>{
      const g=gesture;if(!g||event.pointerId!==g.id)return;
      if(!enabled()){if(g.dragged)blockClick();reset();return;}
      const dx=event.clientX-g.x,dy=event.clientY-g.y;
      if(!g.dragged){
        if(Math.abs(dy)>10&&Math.abs(dy)>=Math.abs(dx)){reset();return;}
        if(Math.abs(dx)<10||Math.abs(dx)<Math.abs(dy)*1.3)return;
        g.dragged=true;
        if(typeof event.pointerId==='number')try{stage.setPointerCapture?.(event.pointerId);}catch{}
      }
      blockClick();if(event.cancelable)event.preventDefault();
      move?.(dx);
    };
    document.addEventListener('pointermove',moved,{capture:true,passive:false});
    const released=event=>{
      const g=gesture;if(!g||event.pointerId!==g.id)return;
      const dx=event.clientX-g.x,dy=event.clientY-g.y;
      const distance=Math.max(40,Math.min(80,stage.clientWidth*.12));
      if(g.dragged||Math.abs(dx)>10)blockClick();
      if(!enabled()||Date.now()-g.time>4000||Math.abs(dx)<distance||Math.abs(dx)<Math.abs(dy)*1.5){reset();return;}
      gesture=null;touchStart=null;
      if(event.cancelable)event.preventDefault();
      // Match the existing previous/next arrows in Hebrew and English.
      step((dx<0?1:-1)*(isEnglish()?1:-1),{dragX:dx});
    };
    document.addEventListener('pointerup',released,{capture:true,passive:false});
    document.addEventListener('pointercancel',event=>{if(gesture?.id===event.pointerId){blockClick();reset(true);}},{capture:true,passive:true});
    // Some Windows touch browsers interrupt the pointer stream when their
    // native photo scroller claims a gesture. Keep a single-touch fallback;
    // only one stream can finish a swipe, so normal phones never advance twice.
    const fromTouch=(event,touch)=>({pointerId:'touch-'+touch.identifier,pointerType:'touch',isPrimary:true,button:0,clientX:touch.clientX,clientY:touch.clientY,target:touch.target||event.target,cancelable:event.cancelable,preventDefault:()=>event.preventDefault()});
    stage.addEventListener('touchstart',event=>{
      if(event.touches.length!==1){touchStart=null;blockClick();reset();return;}
      touchStart=fromTouch(event,event.touches[0]);if(!gesture)begin(touchStart);
    },{capture:true,passive:true});
    stage.addEventListener('touchmove',event=>{
      if(event.touches.length!==1){touchStart=null;blockClick();reset();return;}
      if(!touchStart)return;
      const touch=fromTouch(event,event.touches[0]),dx=touch.clientX-touchStart.clientX,dy=touch.clientY-touchStart.clientY;
      if(Math.abs(dy)>10&&Math.abs(dy)>=Math.abs(dx)){touchStart=null;return;}
      if(Math.abs(dx)>10&&Math.abs(dx)>Math.abs(dy)*1.3&&enabled()){
        if(event.cancelable)event.preventDefault();
        if(!gesture)begin(touchStart);
        if(gesture?.id===touch.pointerId)moved(touch);
      }
    },{capture:true,passive:false});
    stage.addEventListener('touchend',event=>{
      if(touchStart&&gesture?.id===touchStart.pointerId){const touch=[...event.changedTouches].find(touch=>'touch-'+touch.identifier===gesture.id);if(touch)released(fromTouch(event,touch));}
      touchStart=null;
    },{capture:true,passive:false});
    stage.addEventListener('touchcancel',()=>{touchStart=null;blockClick();reset();},{capture:true,passive:true});
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
