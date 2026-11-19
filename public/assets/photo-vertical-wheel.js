(() => {
  'use strict';
  // WheelEvent has no device identity or finger-up event. Treat ambiguous
  // pixel packets as precision scrolling, and reserve notches for real wheels.
  function bind(stage,{root,enabled,step}){
    const QUICK=240,CONFIRM=90,QUIET=120;
    let gesture=null,quietTimer=null,releaseTimer=null,precisionUntil=0,panUntil=0,recent=null;
    const stopTimers=()=>{clearTimeout(quietTimer);clearTimeout(releaseTimer);quietTimer=releaseTimer=null;};
    const reset=()=>{gesture=null;stopTimers();};
    const prevent=event=>{if(event.cancelable!==false)event.preventDefault();};
    function scrollTarget(target,viewer,dy){
      const nodes=[];for(let node=target;node;node=node.parentElement){nodes.push(node);if(node===viewer)break;}
      if(!nodes.includes(viewer))nodes.push(viewer);
      // Desktop layouts keep the people and tags in their own scrolling
      // footer, beside the fixed photo frame rather than above its ancestor.
      const footer=viewer?.querySelector?.('.media-viewer-footer');if(footer&&!nodes.includes(footer))nodes.push(footer);
      return nodes.find(node=>{
        if(!node||!(node.clientHeight>0)||!(node.scrollHeight>node.clientHeight))return false;
        const style=typeof getComputedStyle==='function'?getComputedStyle(node):{};
        const overflow=style.overflowY||style.overflow||'';
        if(node===viewer?/hidden|clip/.test(overflow):!/auto|scroll|overlay/.test(overflow))return false;
        return dy>0?node.scrollTop<node.scrollHeight-node.clientHeight-1:node.scrollTop>1;
      });
    }
    function finish(allowNavigation=false){
      const g=gesture;if(!g)return;reset();const now=Date.now(),duration=g.releasedAt===null?Infinity:g.releasedAt-g.started;
      const flick=allowNavigation&&enabled()&&g.contact&&!g.scrollOnly&&g.releasedAt!==null&&duration<=QUICK&&Math.abs(g.dy)>=64&&Math.abs(g.dy)/Math.max(32,duration)>=.45;
      recent={at:now,peak:g.peak,sign:g.sign,navigated:flick};if(!flick)panUntil=now+320;
      if(flick)step(-Math.sign(g.dy),'pad-vertical');
    }
    function handle(event){
      const x=event.deltaX||0,y=event.deltaY;
      if(!Number.isFinite(x)||!Number.isFinite(y)||event.ctrlKey||event.metaKey||event.altKey||event.shiftKey||event.sourceCapabilities?.firesTouchEvents){reset();return false;}
      if(!y||Math.abs(y)<Math.abs(x)*1.15){reset();return false;}
      if(!enabled()){reset();return false;}
      const viewer=root();
      // Captions, names, tags and every other area outside the photograph keep
      // ordinary browser scrolling with either kind of pointing device.
      if(!viewer||!stage.contains(event.target)||event.target.closest?.('input,textarea,select,[contenteditable=""],[contenteditable="true"],[contenteditable="plaintext-only"],[role="textbox"],.face-picker,.face-label-list,.face-adjust-guide,[data-face-handle]')||viewer.querySelector?.('[data-photo-label-toggle][aria-expanded="true"]')){reset();return true;}
      if(event.cancelable===false){reset();return true;}
      const now=Date.now(),legacy=event.wheelDeltaY||event.wheelDelta||0;
      const discrete=window.FamilyPhotoNative?.mouseWheelDirection?.(event)||0;
      // A lone 100px packet is also a perfectly valid pad movement. Legacy
      // notch evidence or line/page units is required before navigating at once.
      if(discrete&&event.momentum!==true&&(event.deltaMode>0||legacy&&now>=precisionUntil)){
        reset();prevent(event);step(discrete,'mouse-wheel');return true;
      }
      precisionUntil=now+400;
      const unit=event.deltaMode===1?16:event.deltaMode===2?stage.clientHeight||viewer.clientHeight||1:1,dy=y*unit,magnitude=Math.abs(dy),scroller=scrollTarget(event.target,viewer,dy);
      if(!gesture&&recent?.navigated&&now-recent.at<500&&(event.momentum===true||Math.sign(dy)===recent.sign&&magnitude<recent.peak*.55)){
        recent.at=now;prevent(event);return true;
      }
      gesture||={started:now,dy:0,sign:Math.sign(dy),peak:0,last:0,falling:0,releasedAt:null,scrollOnly:now<panUntil,momentumKnown:false,contact:event.momentum!==true};
      const g=gesture;g.momentumKnown||=typeof event.momentum==='boolean';
      // Once scrolling has moved this gesture, reaching the bottom cannot
      // reinterpret its remaining contact or momentum as Next photo.
      if(scroller){g.scrollOnly=true;scroller.scrollTop=Math.max(0,Math.min(scroller.scrollHeight-scroller.clientHeight,(scroller.scrollTop||0)+dy));}
      if(Math.sign(dy)!==g.sign||g.releasedAt===null&&now-g.started>QUICK)g.scrollOnly=true;
      if(g.releasedAt!==null&&magnitude>g.peak*.7&&event.momentum!==true){g.releasedAt=null;g.falling=0;clearTimeout(releaseTimer);releaseTimer=null;if(now-g.started>QUICK)g.scrollOnly=true;}
      g.dy+=dy;g.falling=magnitude<g.last*.94?g.falling+1:magnitude>g.last*1.1?0:g.falling;g.peak=Math.max(g.peak,magnitude);g.last=magnitude;
      prevent(event);
      if(event.momentum===true){g.releasedAt=now;finish(true);return true;}
      if(!g.momentumKnown&&!g.scrollOnly&&g.releasedAt===null&&g.falling>=2&&magnitude<=g.peak*.55&&now-g.started<=QUICK){
        g.releasedAt=now;releaseTimer=setTimeout(()=>{if(gesture===g)finish(true);},CONFIRM);
      }
      clearTimeout(quietTimer);quietTimer=null;
      if(!g.momentumKnown)quietTimer=setTimeout(()=>{if(gesture===g)finish(false);},QUIET);
      return true;
    }
    return {handle,reset};
  }
  window.FamilyPhotoVerticalWheel={bind};
})();
