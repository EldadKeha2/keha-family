(() => {
  'use strict';
  // Pointer events cover phones, tablets and touch screens regardless of width.
  function bind(stage,{enabled,step,right,left,move,cancel,claim,nativeEnd,vertical,mouse=()=>false,touchOnly=()=>false,preferPointer=()=>false,nativeScroll=()=>false,wheelRoot=()=>null,photoButtons=false,videoSurface=null,strictStart=false}){
    let gesture=null,nativePointer=null,suppressClickUntil=0,touchStart=null,wheelGesture=null,wheelTimer=null,previewFrame=null,pendingPreview=null;
    const frames=typeof requestAnimationFrame==='function'&&typeof cancelAnimationFrame==='function';
    const clearPreview=()=>{if(previewFrame!==null)cancelAnimationFrame(previewFrame);previewFrame=null;pendingPreview=null;};
    const flushPreview=()=>{const pending=pendingPreview;clearPreview();if(pending)move?.(pending.dx,pending.options);};
    // Input can arrive faster than the display refreshes (and some browsers
    // emit both touch and pointer streams). Paint only the latest finger
    // position once per frame; commit that position before release navigation.
    const preview=(dx,options)=>{if(!move)return;if(!frames){move(dx,options);return;}pendingPreview={dx,options};if(previewFrame===null)previewFrame=requestAnimationFrame(()=>{previewFrame=null;const pending=pendingPreview;pendingPreview=null;if(pending)move(pending.dx,pending.options);});};
    const desktopBridge=()=>mouse()?window.FamilyGalleryInput:null;
    const touchDirection=dx=>desktopBridge()?.touchAction?.(Math.sign(dx))??Math.sign(dx);
    const wheelMotion=dx=>dx;
    const navigate=(dx,options={})=>{
      const bridge=desktopBridge();
      if(options.input==='wheel')bridge?.commitPadGesture?.(dx);
      else if(options.input==='touch')bridge?.commitTouchGesture?.(dx);
      const direction=options.input==='touch'?touchDirection(dx):Math.sign(dx),action=direction>0?right:left;
      stage.setAttribute?.('data-gallery-last-input',options.input||'manual');stage.setAttribute?.('data-gallery-last-action',direction>0?'next':'previous');
      return action?action(options):step(direction,options);
    };
    const idle=new Set(),finished=()=>{for(const resolve of idle)resolve();idle.clear();};
    const controls='a,input,textarea,select,video,iframe,[contenteditable=""],[contenteditable="true"],[contenteditable="plaintext-only"],[role="textbox"],button:not(.face-hit)'+(photoButtons?':not(.home-carousel-card):not(.home-slide-open)':'')+',.face-picker,.face-name,.face-label-list,.face-adjust-guide,[data-face-handle]';
    const controlAt=event=>{
      let control=event.target.closest(controls);
      if(control&&typeof stage.contains==='function'&&!stage.contains(event.target))return control;
      // Fitted photo wrappers and image pixels remain browsing surfaces even
      // if their host adds editing/accessibility attributes to them.
      while(control?.matches?.('img,.native-photo-strip,.native-photo-pane,.face-photo-scroll,.face-photo-surface'))control=control.parentElement?.closest?.(controls)||null;
      return control&&control!==stage&&(typeof stage.contains!=='function'||stage.contains(control))?control:null;
    };
    const previewVideo=event=>{
      const video=videoSurface?.();if(!video||event.target.closest('video')!==video)return null;
      const rect=video.getBoundingClientRect?.();
      // Native controls are retargeted to <video> outside its shadow tree.
      // Keep their whole bottom strip available for playback and seeking.
      return rect&&event.clientY>=rect.top&&event.clientY<rect.bottom-72?video:null;
    };
    const freshVideoTouch=event=>{if(videoSurface&&event.target.closest('video')===videoSurface())suppressClickUntil=0;};
    const reset=(preserveTouch=false)=>{clearPreview();gesture=null;nativePointer=null;stage.classList.remove('photo-pointer-dragging');clearTimeout(wheelTimer);wheelTimer=null;wheelGesture=null;if(preserveTouch!==true){touchStart=null;finished();cancel?.();}else if(!touchStart||touchStart.native)finished();};
    const blockClick=()=>{suppressClickUntil=Date.now()+700;};
    const distance=()=>mouse()?Math.max(32,Math.min(56,stage.clientWidth*.06)):Math.max(40,Math.min(80,stage.clientWidth*.12));
    const nativeEnded=(start,event)=>{
      if(!start)return;const dx=event.clientX-start.x,dy=event.clientY-start.y,distance=Math.max(40,Math.min(80,stage.clientWidth*.12));
      if(Date.now()-start.time<=4000&&Math.abs(dx)>=distance&&Math.abs(dx)>=Math.abs(dy)*1.5){blockClick();nativeEnd?.(dx);}
    };
    document.addEventListener('pointerdown',event=>{
      if(touchOnly())return;
      if(gesture&&event.pointerId!==gesture.id){blockClick();reset();}
    },{capture:true,passive:true});
    const begin=event=>{
      const touch=['touch','pen'].includes(event.pointerType)||event.sourceCapabilities?.firesTouchEvents;
      // A CSS snap strip owns real touch and precision-trackpad input. Do not
      // capture or replay those events; mouse dragging remains available.
      if(touch&&nativeScroll())return;
      const isMouse=!touch&&event.pointerType==='mouse'&&mouse()&&!event.ctrlKey&&!event.metaKey&&!event.altKey;
      const control=controlAt(event),video=control?.tagName==='VIDEO'?previewVideo(event):null;
      if(!(touch||isMouse)||event.isPrimary===false||event.button>0||!enabled()||control&&!video)return;
      suppressClickUntil=0;
      gesture={id:event.pointerId,x:event.clientX,y:event.clientY,lastY:event.clientY,time:Date.now(),dragged:false,desktop:mouse(),video,threshold:distance()};
      const ownership=claim?.(event)||'manual',mode=isMouse?'queued':ownership;
      if(mode==='native'){nativePointer=gesture;gesture=null;return mode;}
      // Capture the stable stage before face/image setup reparents the target.
      // Touch browsers otherwise lose the end of an implicitly captured stream.
      if(!isMouse&&!video&&typeof event.pointerId==='number')try{stage.setPointerCapture?.(event.pointerId);}catch{}
      gesture.mode=mode;gesture.mouse=isMouse;return mode;
    };
    // Phones use the real touch stream. Windows hybrid browsers can emit a
    // touchstart without subsequent touchmove events; keep their pointer stream
    // active, retaining TouchEvents as a fallback if the browser cancels it.
    stage.addEventListener('pointerdown',event=>{freshVideoTouch(event);if(!touchOnly())begin(event);},{capture:true,passive:true});
    const moved=event=>{
      const g=gesture;if(!g||event.pointerId!==g.id)return;
      if(!enabled()||g.mouse&&event.buttons===0){if(g.dragged)blockClick();reset();return;}
      const dx=event.clientX-g.x,dy=event.clientY-g.y;
      if(!g.dragged&&!g.vertical){
        // Precision touch input often starts with a few diagonal pixels.
        // Lock the axis only once the direction is clear, then keep it.
        if(Math.abs(dy)>(g.desktop?24:10)&&Math.abs(dy)>=Math.abs(dx)*(g.desktop?1.4:1)){
          if(g.desktop&&!g.mouse&&vertical)g.vertical=true;else {reset();return;}
        }
        if(!g.vertical&&(Math.abs(dx)<10||Math.abs(dx)<Math.abs(dy)*(g.desktop?1.2:1.3)))return;
        // A video tap must still toggle native controls. Claim its stream only
        // after a deliberate horizontal stroke can actually change the file.
        if(g.video&&!g.vertical&&Math.abs(dx)<g.threshold)return;
      }
      if(g.vertical){blockClick();if(event.cancelable)event.preventDefault();vertical(g.lastY-event.clientY);g.lastY=event.clientY;return;}
      if(!g.dragged){
        g.dragged=true;stage.classList.add('photo-pointer-dragging');
        if(typeof event.pointerId==='number')try{stage.setPointerCapture?.(event.pointerId);}catch{}
      }
      blockClick();if(event.cancelable)event.preventDefault();
      if(!g.mouse&&g.desktop)desktopBridge()?.observeTouchGesture?.(dx);
      preview(dx,{queued:g.mode==='queued',actionDirection:g.mouse?Math.sign(dx):touchDirection(dx)});
    };
    document.addEventListener('pointermove',event=>{if(!touchOnly()&&(!touchStart||preferPointer()))moved(event);},{capture:true,passive:false});
    const released=event=>{
      const g=gesture;if(!g){if(nativePointer?.id===event.pointerId){nativeEnded(nativePointer,event);nativePointer=null;}return;}if(event.pointerId!==g.id)return;
      const dx=event.clientX-g.x,dy=event.clientY-g.y;
      if(g.vertical){blockClick();reset();return;}
      if(g.dragged||Math.abs(dx)>(g.video?g.threshold:10))blockClick();
      if(!enabled()||!g.dragged&&Date.now()-g.time>4000||Math.abs(dx)<g.threshold||Math.abs(dx)<Math.abs(dy)*(g.desktop&&g.dragged?1:1.5)){reset();return;}
      flushPreview();
      gesture=null;touchStart=null;stage.classList.remove('photo-pointer-dragging');finished();
      if(event.cancelable)event.preventDefault();
      // Use the gallery's actual Next/Previous actions for physical gestures.
      navigate(dx,{dragX:dx,queued:true,input:g.mouse?'mouse':'touch',...(g.mode==='queued'?{native:true}:{})});
    };
    document.addEventListener('pointerup',event=>{if(!touchOnly()&&(!touchStart||preferPointer()))released(event);},{capture:true,passive:false});
    document.addEventListener('pointercancel',event=>{if(!touchOnly()&&gesture?.id===event.pointerId){blockClick();reset(true);}},{capture:true,passive:true});
    // Some Windows touch browsers interrupt the pointer stream when their
    // native photo scroller claims a gesture. Keep a single-touch fallback;
    // only one stream can finish a swipe, so normal phones never advance twice.
    const fromTouch=(event,touch)=>({pointerId:'touch-'+touch.identifier,pointerType:'touch',isPrimary:true,button:0,clientX:touch.clientX,clientY:touch.clientY,target:touch.target||event.target,cancelable:event.cancelable,preventDefault:()=>event.preventDefault()});
    stage.addEventListener('touchstart',event=>{
      freshVideoTouch(event);
      // Some hybrid laptops emit a mouse-like pointer before the real touch
      // stream. Once the native touch owner is present, discard that manual
      // companion so it cannot commit a second or reversed action on release.
      if(nativeScroll()){if(gesture||nativePointer||touchStart)reset();return;}
      if(event.touches.length!==1){touchStart=null;blockClick();reset();return;}
      touchStart=fromTouch(event,event.touches[0]);touchStart.time=Date.now();
      if(!gesture){const mode=begin(touchStart);touchStart.native=mode==='native';if(strictStart&&!mode){touchStart=null;finished();}}
    },{capture:true,passive:true});
    document.addEventListener('touchmove',event=>{
      if(!touchStart)return;
      if(event.touches.length!==1){touchStart=null;blockClick();reset();return;}
      if(!touchStart||touchStart.native)return;
      const touch=fromTouch(event,event.touches[0]);
      if(!gesture)begin(touchStart);
      if(gesture)moved({...touch,pointerId:gesture.id});
    },{capture:true,passive:false});
    document.addEventListener('touchend',event=>{
      if(touchStart?.native){const touch=[...event.changedTouches].find(touch=>'touch-'+touch.identifier===touchStart.pointerId);if(touch)nativeEnded({x:touchStart.clientX,y:touchStart.clientY,time:touchStart.time},fromTouch(event,touch));nativePointer=null;}
      if(touchStart&&!touchStart.native&&!gesture)begin(touchStart);
      if(touchStart&&gesture){const touch=[...event.changedTouches].find(touch=>'touch-'+touch.identifier===touchStart.pointerId);if(touch)released({...fromTouch(event,touch),pointerId:gesture.id});}
      touchStart=null;if(!gesture)finished();
    },{capture:true,passive:false});
    document.addEventListener('touchcancel',()=>{touchStart=null;blockClick();reset();},{capture:true,passive:true});
    stage.addEventListener('dragstart',event=>{if(mouse()&&enabled()&&!controlAt(event))event.preventDefault();});
    const onWheel=event=>{
      if(nativeScroll())return;
      const outside=typeof stage.contains==='function'&&!stage.contains(event.target),candidate=outside?event.target.closest('input,textarea,select,[contenteditable=""],[contenteditable="true"],[contenteditable="plaintext-only"],[role="textbox"]'):controlAt(event),control=outside&&(candidate?.readOnly||candidate?.disabled)?null:candidate;
      if(!mouse()||!enabled()||gesture||touchStart||event.ctrlKey||event.metaKey||control&&!previewVideo(event))return;
      const unit=event.deltaMode===1?16:event.deltaMode===2?stage.clientWidth:1;
      const rawDx=(event.deltaX||event.shiftKey&&event.deltaY||0)*unit,dy=event.shiftKey&&!event.deltaX?0:(event.deltaY||0)*unit;
      // Windows Precision Touchpads can report a whole gesture in subpixel
      // deltas. Accumulate them, including the small momentum tail.
      // Once a horizontal burst owns the axis, diagonal samples and momentum
      // remain part of that same swipe instead of being discarded individually.
      if(!Number.isFinite(rawDx)||!rawDx||!wheelGesture&&Math.abs(rawDx)<Math.abs(dy)*1.15)return;
      const dx=window.FamilyGalleryInput?.wheelDelta?.(rawDx)??rawDx;
      if(event.cancelable)event.preventDefault();blockClick();
      const sample=window.FamilyPhotoNative?.wheelSample?.(stage,dx);
      const complete=done=>{if(!done)return;window.FamilyPhotoNative?.finishWheelEpisode?.(stage,done.episode);window.FamilyGalleryInput?.finishWheelDirection?.();if(!wheelGesture)finished();if(enabled()&&Math.abs(done.dx)>=distance()){flushPreview();navigate(done.dx,{dragX:wheelMotion(done.dx),queued:true,native:true,input:'wheel'});}else {clearPreview();cancel?.();}};
      const finish=()=>{wheelTimer=null;const done=wheelGesture;wheelGesture=null;complete(done);};
      if(sample?.ignore){if(wheelGesture){clearTimeout(wheelTimer);wheelTimer=setTimeout(finish,120);}return;}
      if(sample?.replace&&wheelGesture)wheelGesture.dx=0;
      if(sample?.split&&wheelGesture){clearTimeout(wheelTimer);const done=wheelGesture;wheelGesture={dx:0,episode:sample.episode};complete(done);}
      wheelGesture||={dx:0,episode:sample?.episode};wheelGesture.dx+=dx;desktopBridge()?.observePadGesture?.(wheelGesture.dx);preview(wheelMotion(wheelGesture.dx),{queued:true,actionDirection:Math.sign(wheelGesture.dx)});clearTimeout(wheelTimer);
      wheelTimer=setTimeout(finish,120);
    };
    stage.addEventListener('wheel',onWheel,{capture:true,passive:false});
    document.addEventListener('wheel',event=>{const root=wheelRoot();if(!root||stage.contains(event.target)||!window.FamilyPhotoNative?.wheelScope?.(stage,event,root))return;onWheel(event);},{capture:true,passive:false});
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
