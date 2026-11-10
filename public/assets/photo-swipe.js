(() => {
  'use strict';
  // Pointer events cover phones, tablets and touch screens regardless of width.
  function bind(stage,{enabled,step,isEnglish,move,cancel,claim,nativeEnd,mouse=()=>false,photoButtons=false}){
    let gesture=null,nativePointer=null,suppressClickUntil=0,touchStart=null,wheelGesture=null,wheelTimer=null;
    const idle=new Set(),finished=()=>{for(const resolve of idle)resolve();idle.clear();};
    const controls='a,input,textarea,select,video,iframe,[contenteditable],[role="textbox"],button:not(.face-hit)'+(photoButtons?':not(.home-carousel-card):not(.home-slide-open)':'')+',.face-picker,.face-name,.face-label-list,.face-adjust-guide,[data-face-handle]';
    const reset=(preserveTouch=false)=>{gesture=null;nativePointer=null;stage.classList.remove('photo-pointer-dragging');clearTimeout(wheelTimer);wheelTimer=null;wheelGesture=null;if(preserveTouch!==true){touchStart=null;finished();cancel?.();}else if(!touchStart||touchStart.native)finished();};
    const blockClick=()=>{suppressClickUntil=Date.now()+700;};
    const nativeEnded=(start,event)=>{
      if(!start)return;const dx=event.clientX-start.x,dy=event.clientY-start.y,distance=Math.max(40,Math.min(80,stage.clientWidth*.12));
      if(Date.now()-start.time<=4000&&Math.abs(dx)>=distance&&Math.abs(dx)>=Math.abs(dy)*1.5){blockClick();nativeEnd?.(dx);}
    };
    document.addEventListener('pointerdown',event=>{
      if(gesture&&event.pointerId!==gesture.id){blockClick();reset();}
    },{capture:true,passive:true});
    const begin=event=>{
      const isMouse=event.pointerType==='mouse'&&mouse()&&!event.ctrlKey&&!event.metaKey&&!event.altKey;
      if(!(['touch','pen'].includes(event.pointerType)||event.sourceCapabilities?.firesTouchEvents||isMouse)||event.isPrimary===false||event.button>0||!enabled()||event.target.closest(controls))return;
      suppressClickUntil=0;
      gesture={id:event.pointerId,x:event.clientX,y:event.clientY,time:Date.now(),dragged:false};
      const ownership=claim?.(event)||'manual',mode=isMouse?'queued':ownership;
      if(mode==='native'){nativePointer=gesture;gesture=null;return mode;}
      gesture.mode=mode;gesture.mouse=isMouse;return mode;
    };
    stage.addEventListener('pointerdown',begin,{capture:true,passive:true});
    const moved=event=>{
      const g=gesture;if(!g||event.pointerId!==g.id)return;
      if(!enabled()||g.mouse&&event.buttons===0){if(g.dragged)blockClick();reset();return;}
      const dx=event.clientX-g.x,dy=event.clientY-g.y;
      if(!g.dragged){
        if(Math.abs(dy)>10&&Math.abs(dy)>=Math.abs(dx)){reset();return;}
        if(Math.abs(dx)<10||Math.abs(dx)<Math.abs(dy)*1.3)return;
        g.dragged=true;stage.classList.add('photo-pointer-dragging');
        if(typeof event.pointerId==='number')try{stage.setPointerCapture?.(event.pointerId);}catch{}
      }
      blockClick();if(event.cancelable)event.preventDefault();
      move?.(dx,{queued:g.mode==='queued'});
    };
    document.addEventListener('pointermove',moved,{capture:true,passive:false});
    const released=event=>{
      const g=gesture;if(!g){if(nativePointer?.id===event.pointerId){nativeEnded(nativePointer,event);nativePointer=null;}return;}if(event.pointerId!==g.id)return;
      const dx=event.clientX-g.x,dy=event.clientY-g.y;
      const distance=Math.max(40,Math.min(80,stage.clientWidth*.12));
      if(g.dragged||Math.abs(dx)>10)blockClick();
      if(!enabled()||Date.now()-g.time>4000||Math.abs(dx)<distance||Math.abs(dx)<Math.abs(dy)*1.5){reset();return;}
      gesture=null;touchStart=null;stage.classList.remove('photo-pointer-dragging');finished();
      if(event.cancelable)event.preventDefault();
      // Match the existing previous/next arrows in Hebrew and English.
      step((dx<0?1:-1)*(isEnglish()?1:-1),{dragX:dx,queued:true,...(g.mode==='queued'?{native:true}:{})});
    };
    document.addEventListener('pointerup',released,{capture:true,passive:false});
    document.addEventListener('pointercancel',event=>{if(gesture?.id===event.pointerId){blockClick();reset(true);}},{capture:true,passive:true});
    // Some Windows touch browsers interrupt the pointer stream when their
    // native photo scroller claims a gesture. Keep a single-touch fallback;
    // only one stream can finish a swipe, so normal phones never advance twice.
    const fromTouch=(event,touch)=>({pointerId:'touch-'+touch.identifier,pointerType:'touch',isPrimary:true,button:0,clientX:touch.clientX,clientY:touch.clientY,target:touch.target||event.target,cancelable:event.cancelable,preventDefault:()=>event.preventDefault()});
    stage.addEventListener('touchstart',event=>{
      if(event.touches.length!==1){touchStart=null;blockClick();reset();return;}
      touchStart=fromTouch(event,event.touches[0]);touchStart.time=Date.now();if(!gesture)touchStart.native=begin(touchStart)==='native';
    },{capture:true,passive:true});
    document.addEventListener('touchmove',event=>{
      if(event.touches.length!==1){touchStart=null;blockClick();reset();return;}
      if(!touchStart||touchStart.native)return;
      const touch=fromTouch(event,event.touches[0]),dx=touch.clientX-touchStart.clientX,dy=touch.clientY-touchStart.clientY;
      if(Math.abs(dy)>10&&Math.abs(dy)>=Math.abs(dx)){touchStart=null;return;}
      if(Math.abs(dx)>10&&Math.abs(dx)>Math.abs(dy)*1.3&&enabled()){
        if(event.cancelable)event.preventDefault();
        if(!gesture)begin(touchStart);
        if(gesture?.id===touch.pointerId)moved(touch);
      }
    },{capture:true,passive:false});
    document.addEventListener('touchend',event=>{
      if(touchStart?.native){const touch=[...event.changedTouches].find(touch=>'touch-'+touch.identifier===touchStart.pointerId);if(touch)nativeEnded({x:touchStart.clientX,y:touchStart.clientY,time:touchStart.time},fromTouch(event,touch));nativePointer=null;}
      if(touchStart&&!touchStart.native&&!gesture)begin(touchStart);
      if(touchStart&&gesture?.id===touchStart.pointerId){const touch=[...event.changedTouches].find(touch=>'touch-'+touch.identifier===gesture.id);if(touch)released(fromTouch(event,touch));}
      touchStart=null;if(!gesture)finished();
    },{capture:true,passive:false});
    document.addEventListener('touchcancel',()=>{touchStart=null;blockClick();reset();},{capture:true,passive:true});
    stage.addEventListener('dragstart',event=>{if(mouse()&&enabled()&&!event.target.closest(controls))event.preventDefault();});
    stage.addEventListener('wheel',event=>{
      if(!mouse()||!enabled()||gesture||touchStart||event.ctrlKey||event.metaKey||event.target.closest(controls)||Math.abs(event.deltaX)<2||Math.abs(event.deltaX)<Math.abs(event.deltaY)*1.3)return;
      if(event.cancelable)event.preventDefault();blockClick();
      const unit=event.deltaMode===1?16:event.deltaMode===2?stage.clientWidth:1;
      wheelGesture||={dx:0};wheelGesture.dx-=event.deltaX*unit;move?.(wheelGesture.dx,{queued:true});clearTimeout(wheelTimer);
      wheelTimer=setTimeout(()=>{wheelTimer=null;const dx=wheelGesture?.dx||0;wheelGesture=null;finished();const distance=Math.max(40,Math.min(80,stage.clientWidth*.12));if(enabled()&&Math.abs(dx)>=distance)step((dx<0?1:-1)*(isEnglish()?1:-1),{dragX:dx,queued:true,native:true});else cancel?.();},120);
    },{passive:false});
    // A swipe starting over a face must not also open or remove its tag.
    stage.addEventListener('click',event=>{
      if(event.detail!==0&&Date.now()<suppressClickUntil){event.preventDefault();event.stopImmediatePropagation();}
    },{capture:true});
    window.addEventListener('blur',reset);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)reset();});
    return {reset,isActive:()=>Boolean(gesture||touchStart||wheelGesture),whenIdle:()=>gesture||touchStart&&!touchStart.native||wheelGesture?new Promise(resolve=>idle.add(resolve)):null};
  }
  window.FamilyPhotoSwipe={bind};
})();
