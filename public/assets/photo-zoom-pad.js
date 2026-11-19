(() => {
  'use strict';
  // WheelEvents do not consistently expose physical finger contact. Prefer
  // the momentum signal where available; otherwise require a short burst
  // with a clear falling tail before considering it a released flick.
  function bind(stage,{enabled,canNavigate=enabled,pan,start,step}){
    const QUICK=240,QUIET=120,CONFIRM=90;
    let gesture=null,quietTimer=null,releaseTimer=null,panUntil=0,recent=null;
    const idle=new Set(),settled=()=>{for(const resolve of idle)resolve();idle.clear();};
    const native=()=>window.FamilyPhotoNative;
    const stopTimers=()=>{clearTimeout(quietTimer);clearTimeout(releaseTimer);quietTimer=releaseTimer=null;};
    const finish=(allowNavigation=true)=>{
      const g=gesture;if(!g)return;gesture=null;stopTimers();
      native()?.finishWheelEpisode?.(stage,g.episode);
      stage.classList.remove('face-photo-panning');
      const duration=g.releasedAt===null?Infinity:g.releasedAt-g.started;
      const threshold=Math.max(48,Math.min(90,stage.clientWidth*.06));
      const bridge=window.FamilyGalleryInput,dx=bridge?.wheelDelta?.(g.dx)??g.dx,direction=Number.isFinite(dx)?Math.sign(dx):0;
      const flick=allowNavigation&&enabled()&&canNavigate()&&direction!==0&&!g.panOnly&&g.releasedAt!==null&&duration<=QUICK&&Math.abs(g.dx)>=threshold&&Math.abs(g.dx)/Math.max(32,duration)>=.45;
      recent={at:Date.now(),panOnly:!flick};
      if(!flick)panUntil=Date.now()+320;
      settled();
      if(flick){
        bridge?.observePadGesture?.(dx);bridge?.commitPadGesture?.(direction);
        stage.setAttribute('data-gallery-last-input','wheel');stage.setAttribute('data-gallery-last-action',direction>0?'next':'previous');
        step(direction,{queued:true,input:'wheel'});
      }
    };
    const reset=()=>finish(false);
    function handle(event){
      if(event.ctrlKey||event.metaKey||event.altKey){reset();return false;}
      const now=Date.now(),active=enabled(),unit=event.deltaMode===1?16:event.deltaMode===2?stage.clientWidth:1;
      const dx=(event.deltaX||event.shiftKey&&event.deltaY||0)*unit,dy=(event.shiftKey&&!event.deltaX?0:event.deltaY||0)*unit;
      if(!Number.isFinite(dx)||!Number.isFinite(dy))return false;
      // An inertial tail belongs to the old photo, including after its zoom
      // controller is replaced by the next fitted photo.
      if(!gesture&&event.momentum===true&&recent&&now-recent.at<500){
        recent.at=now;if(active&&recent.panOnly)pan(dx,dy);
        if(event.cancelable!==false)event.preventDefault();return true;
      }
      if(!active){reset();return false;}
      if(!gesture&&(!dx||Math.abs(dx)<Math.abs(dy)*1.15))return false;
      if(event.cancelable!==false)event.preventDefault();
      const mapped=window.FamilyGalleryInput?.wheelDelta?.(dx)??dx,sample=Number.isFinite(mapped)&&mapped?native()?.wheelSample?.(stage,mapped):null;
      if(sample?.ignore&&!gesture)return true;
      if(!gesture){
        gesture={started:now,dx:0,sign:Math.sign(dx),peak:0,last:0,falling:0,releasedAt:null,panOnly:now<panUntil||event.deltaMode>0,momentumKnown:typeof event.momentum==='boolean',episode:sample?.episode};
        start?.();
      }
      const g=gesture,magnitude=Math.abs(dx);g.episode=sample?.episode||g.episode;g.dx+=dx;g.momentumKnown||=typeof event.momentum==='boolean';
      if(dx&&Math.sign(dx)!==g.sign)g.panOnly=true;
      if(g.releasedAt===null&&now-g.started>QUICK)g.panOnly=true;
      if(g.releasedAt!==null&&magnitude>g.peak*.7&&event.momentum!==true){g.releasedAt=null;g.falling=0;clearTimeout(releaseTimer);releaseTimer=null;if(now-g.started>QUICK)g.panOnly=true;}
      g.falling=magnitude&&magnitude<g.last*.94?g.falling+1:magnitude>g.last*1.1?0:g.falling;
      g.peak=Math.max(g.peak,magnitude);g.last=magnitude;
      stage.classList.add('face-photo-panning');pan(dx,dy);
      if(event.momentum===true){g.releasedAt=now;finish();return true;}
      // If the browser supplies momentum=false, wait for its actual true
      // packet. A quiet held finger must not be mistaken for a release.
      if(!g.momentumKnown&&!g.panOnly&&g.releasedAt===null&&g.falling>=2&&magnitude<=g.peak*.55&&now-g.started<=QUICK){
        g.releasedAt=now;releaseTimer=setTimeout(()=>{if(gesture===g)finish();},CONFIRM);
      }
      clearTimeout(quietTimer);quietTimer=setTimeout(()=>{if(gesture===g)finish();},QUIET);
      return true;
    }
    window.addEventListener('blur',reset);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)reset();});
    return {handle,reset,isActive:()=>Boolean(gesture),whenIdle:()=>gesture?new Promise(resolve=>idle.add(resolve)):null};
  }
  window.FamilyPhotoZoomPad={bind};
})();
