(() => {
  'use strict';
  let active=null;
  const supported=()=>typeof CSS!=='undefined'&&CSS.supports('scroll-snap-type','x mandatory');
  function reset(stage){
    if(!active||stage&&active.stage!==stage)return;
    const b=active;active=null;clearTimeout(b.timer);clearTimeout(b.releaseTimer);b.resize?.disconnect();
    b.viewport.before(b.node);b.viewport.remove();b.stage.classList.remove('has-native-photo-strip');
  }
  function has(stage){return active?.stage===stage;}
  function note(stage,dx){
    const b=active;if(b?.stage!==stage||b.locked)return;b.releasedPage=dx>0?0:2;b.releasedAt=Date.now();clearTimeout(b.releaseTimer);
    // A Windows/browser gesture can finish without scrolling its native strip.
    // The released finger still selects its neighbour; never lose that swipe.
    b.releaseTimer=setTimeout(()=>{if(active!==b||b.locked||b.releasedPage==null)return;b.width=b.viewport.clientWidth||b.width;b.viewport.scrollLeft=b.releasedPage*b.width;b.finish();},180);
  }
  function claim(stage){
    const b=active;if(!b||b.stage!==stage)return 'manual';
    if(b.locked)return 'queued';
    const page=b.releasedPage!=null&&Date.now()-b.releasedAt<750?b.releasedPage:Math.round(b.viewport.scrollLeft/b.width);
    if(page===1)return 'native';
    // A second finger stroke can start before scrollend from the first one.
    // Finish that snap now and retain the new stroke while its photo loads.
    b.viewport.scrollLeft=page*b.width;b.finish();return 'queued';
  }
  function mount(stage,{previous,next,enabled,step,busy}){
    if(stage?.nodeType!==1||!supported()||!enabled()){reset(stage);return false;}
    const node=stage.querySelector('.face-photo-scroll')||(!stage._familyFaceContext?stage.querySelector('img'):null);
    if(!node)return false;
    if(active?.stage===stage&&active.node===node)return true;
    reset();const viewport=document.createElement('div');viewport.className='native-photo-strip';viewport.dir='ltr';
    const left=document.createElement('div'),center=document.createElement('div'),right=document.createElement('div');
    for(const pane of [left,center,right]){pane.className='native-photo-pane';viewport.append(pane);}
    const side=(pane,item)=>{
      pane.setAttribute('aria-hidden','true');if(!item)return;
      const image=document.createElement('img');image.alt='';image.decoding='async';image.fetchPriority='low';image.draggable=false;
      const constrained=navigator.connection?.saveData||/^(slow-)?2g$/.test(navigator.connection?.effectiveType||'');
      const source=constrained?item.thumbnailSrc:item.previewSrc||item.thumbnailSrc||(item.size<1000000?item.src:null);
      if(source&&item.kind==='photo'){image.src=source;pane.append(image);}
    };
    side(left,next);side(right,previous);
    node.before(viewport);center.append(node);stage.classList.add('has-native-photo-strip');
    const b=active={stage,node,viewport,center,width:viewport.clientWidth,locked:false,timer:null};
    viewport.scrollLeft=b.width;
    const finish=b.finish=()=>{
      if(active!==b||b.locked||!b.width)return;
      const page=Math.round(viewport.scrollLeft/b.width);
      if(page===1)return;if(Math.abs(viewport.scrollLeft-page*b.width)>2)return;
      if(!enabled()){viewport.scrollLeft=b.width;return;}
      // Browser momentum/restoration can snap to the other pane. A completed
      // finger stroke owns Next/Previous, just like the manual swipe handler.
      const target=b.releasedPage!=null&&Date.now()-b.releasedAt<750?b.releasedPage:page;
      clearTimeout(b.releaseTimer);b.releasedPage=null;b.locked=true;viewport.style.overflowX='hidden';
      if(target!==page)viewport.scrollLeft=target*b.width;
      const direction=target<1?1:-1;
      Promise.resolve(step(direction,{native:true})).finally(()=>{if(active===b&&!busy?.()){b.locked=false;viewport.style.overflowX='';viewport.scrollLeft=b.width;}});
    };
    // Native scrollend waits for the finger and momentum to finish. Only older
    // browsers need a timer; committing a half-finished snap causes a jump.
    const scrollEnd='onscrollend' in viewport;
    viewport.addEventListener('scroll',()=>{if(active!==b||b.locked||scrollEnd)return;clearTimeout(b.timer);b.timer=setTimeout(finish,160);},{passive:true});
    viewport.addEventListener('scrollend',finish,{passive:true});
    if(typeof ResizeObserver!=='undefined'){
      b.resize=new ResizeObserver(()=>{if(active===b&&!b.locked&&Math.abs(viewport.clientWidth-b.width)>1){b.width=viewport.clientWidth;viewport.scrollLeft=b.width;}});b.resize.observe(viewport);
    }
    return true;
  }
  window.FamilyPhotoNative={mount,reset,has,claim,note};
})();
