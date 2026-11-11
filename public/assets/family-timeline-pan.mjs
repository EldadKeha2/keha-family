// Horizontal gestures belong to the rail; vertical gestures remain page scrolling.
export function bindTimelinePan(root,{getTrack,getYear,moveYear,pixelsPerYear=44,timers=globalThis}) {
  let drag=null,suppressClick=null,wheel=null,wheelTimer=null;
  const context=target=>{
    const viewport=target.closest('.ft-rail-viewport'),generation=Number(viewport?.closest('[data-rail]')?.dataset.rail),track=getTrack(generation);
    return viewport&&track?.years.length?{viewport,generation,track}:null;
  };
  const cohort=target=>{
    const list=target.closest('[data-rail-focus]');
    return list&&list.scrollWidth>list.clientWidth+1?list:null;
  };
  function position(gesture,year){
    gesture.year=Math.max(gesture.track.years[0],Math.min(gesture.track.years.at(-1),year));
    moveYear(gesture.generation,gesture.year,{scrubbing:true});
    gesture.viewport.querySelector('.ft-axis-world').style.transform=`translateX(${-(gesture.year-gesture.track.start)*pixelsPerYear}px)`;
  }
  function settle(gesture,{cancelled=false}={}){
    let target=gesture.year;
    // A short phone swipe can cross a large gap between two recorded years.
    if(!cancelled&&Math.abs(gesture.dx)>=44&&getYear(gesture.generation)===gesture.anchorYear){
      const next=gesture.track.years.indexOf(gesture.anchorYear)+(gesture.dx<0?1:-1);
      target=gesture.track.years[next]??target;
    }
    moveYear(gesture.generation,target);
  }
  function finishWheel(){
    timers.clearTimeout(wheelTimer);wheelTimer=null;
    if(wheel){const previous=wheel;wheel=null;settle(previous);}
  }
  function finishDrag(event,cancelled=false){
    if(!drag||event.pointerId!==drag.pointerId)return;
    const previous=drag;drag=null;
    previous.viewport.classList.remove('is-dragging');
    if(previous.moved){
      suppressClick=previous.viewport;
      if(!previous.cohort)settle(previous,{cancelled});
    }
    if(previous.viewport.hasPointerCapture?.(event.pointerId))previous.viewport.releasePointerCapture(event.pointerId);
  }
  root.addEventListener('pointerdown',event=>{
    suppressClick=null;
    if(event.isPrimary===false){if(drag)finishDrag({pointerId:drag.pointerId},true);return;}
    if(event.button!==0||event.ctrlKey||event.metaKey||event.altKey||event.target.closest('[data-rail-step],input,select'))return;
    const current=context(event.target);if(!current)return;
    finishWheel();
    const anchorYear=getYear(current.generation),list=cohort(event.target);
    drag={...current,pointerId:event.pointerId,anchorYear,year:anchorYear,x:event.clientX,y:event.clientY,dx:0,moved:false,cohort:list,scrollLeft:list?.scrollLeft||0};
  });
  root.addEventListener('pointermove',event=>{
    if(!drag||event.pointerId!==drag.pointerId)return;
    const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
    if(!drag.moved){
      if(Math.max(Math.abs(dx),Math.abs(dy))<7)return;
      if(Math.abs(dy)>Math.abs(dx)){drag=null;return;}
      drag.moved=true;drag.viewport.classList.add('is-dragging');
      drag.viewport.setPointerCapture(event.pointerId);
    }
    event.preventDefault();drag.dx=dx;
    if(drag.cohort)drag.cohort.scrollLeft=drag.scrollLeft-dx;
    else position(drag,drag.anchorYear-dx/pixelsPerYear);
  },{passive:false});
  root.addEventListener('pointerup',event=>finishDrag(event));
  root.addEventListener('pointercancel',event=>finishDrag(event,true));
  root.addEventListener('lostpointercapture',event=>finishDrag(event,true));
  root.addEventListener('click',event=>{
    if(suppressClick&&event.detail!==0&&event.target.closest('.ft-rail-viewport')===suppressClick){
      suppressClick=null;event.preventDefault();event.stopImmediatePropagation();
    }
  },true);
  root.addEventListener('dragstart',event=>{if(event.target.closest('.ft-rail-viewport'))event.preventDefault();});
  root.addEventListener('wheel',event=>{
    if(event.ctrlKey||drag||cohort(event.target))return;
    const delta=event.shiftKey&&!event.deltaX?event.deltaY:event.deltaX;
    if(!delta||!event.shiftKey&&Math.abs(event.deltaY)>Math.abs(delta))return;
    const current=context(event.target);if(!current)return;
    event.preventDefault();
    if(wheel&&wheel.viewport!==current.viewport)finishWheel();
    if(!wheel){const anchorYear=getYear(current.generation);wheel={...current,anchorYear,year:anchorYear,dx:0};}
    const pixels=delta*(event.deltaMode===1?16:event.deltaMode===2?current.viewport.clientWidth:1);
    wheel.dx-=pixels;position(wheel,wheel.year+pixels/pixelsPerYear);
    timers.clearTimeout(wheelTimer);wheelTimer=timers.setTimeout(finishWheel,140);
  },{passive:false});
}
