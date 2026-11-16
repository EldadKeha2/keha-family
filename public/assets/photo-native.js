(() => {
  'use strict';
  let active=null;
  const supported=()=>typeof CSS!=='undefined'&&CSS.supports('scroll-snap-type','x mandatory');
  const previewSource=item=>item?.kind==='photo'?((navigator.connection?.saveData||/^(slow-)?2g$/.test(navigator.connection?.effectiveType||'')?item.thumbnailSrc:null)||(window.FamilyPhotoPresentation?.source?.(item)||item.previewSrc||item.thumbnailSrc||item.src)):item?.kind==='video'?item.poster||null:null;
  function side(pane,item){
    const source=previewSource(item),key=JSON.stringify([source,item?.kind,item?.kind==='video'?(item.caption||item.name||item.filename):'']);
    pane._item=item;
    if(pane._photoSource===key)return;pane._photoSource=key;
    for(const child of [...pane.children])child.remove();
    pane.setAttribute('aria-hidden','true');
    if(source){const image=document.createElement('img');image.alt='';image.decoding='async';image.fetchPriority='low';image.draggable=false;image.src=source;pane.append(image);}
    if(item?.kind==='video'){const title=document.createElement('span');title.className='native-video-preview';title.textContent='▶ '+(item.caption||item.name||item.filename||'');pane.append(title);}
  }
  const inputActive=b=>Boolean(b&&(b.pointerId!=null||b.touchId!=null||b.wheelActive||b.settling));
  function resolveIdle(b){if(!inputActive(b)){for(const resolve of b.idle)resolve();b.idle.clear();}}
  function clearCover(b){b.cover?.remove();b.cover=null;b.previewImage=null;}
  function position(b,event){if(b.stroke){b.stroke.dx=event.clientX-b.stroke.x;b.stroke.dy=event.clientY-b.stroke.y;}}
  function released(b,event,force=false){
    if(event)position(b,event);
    if(b.pointerId!=null||b.touchId!=null)return;
    const stroke=b.stroke;b.explicitRelease=Boolean(event);
    b.touchIntent=stroke&&Math.abs(stroke.dx)>=Math.max(32,Math.min(56,b.width*.06))&&Math.abs(stroke.dx)>=Math.abs(stroke.dy)*1.2?Math.sign(stroke.dx):0;
    b.settling=true;clearTimeout(b.settleTimer);
    b.settleTimer=setTimeout(()=>{if(active===b)b.finish(true);},250);
    if(force||b.nativeEnded)b.finish(force);
  }
  function cancelledContact(b,delay=250){
    clearTimeout(b.contactTimer);b.pointerCancelled=true;b.settling=true;
    b.contactTimer=setTimeout(()=>{
      if(active!==b)return;b.touchId=null;b.pointerId=null;b.pointerCancelled=false;
      if(b.nativePanSeen||b.explicitRelease||Math.abs(b.stroke?.dx||0)>=32){if(b.explicitRelease)b.finish(true);else released(b,null,true);}
      else{
        // An orphan compatibility start must release idle, but a later real
        // native pan on this same rail still belongs to its original contact.
        b.settling=false;clearTimeout(b.settleTimer);resolveIdle(b);
      }
    },delay);
  }
  document.addEventListener('pointermove',event=>{const b=active;if(b?.pointerId===event.pointerId)position(b,event);},{capture:true,passive:true});
  document.addEventListener('pointerup',event=>{const b=active;if(b?.pointerId!==event.pointerId)return;clearTimeout(b.contactTimer);b.pointerCancelled=false;b.pointerId=null;b.touchId=null;released(b,event);},{capture:true,passive:true});
  document.addEventListener('pointercancel',event=>{const b=active;if(b?.pointerId!==event.pointerId)return;b.pointerId=null;cancelledContact(b);},{capture:true,passive:true});
  document.addEventListener('touchmove',event=>{const b=active;if(b?.touchId==null)return;const touch=[...event.touches].find(touch=>touch.identifier===b.touchId);if(touch){position(b,touch);if(b.pointerCancelled)cancelledContact(b);}},{capture:true,passive:true});
  document.addEventListener('touchend',event=>{const b=active;if(b?.touchId==null)return;const touch=[...event.changedTouches].find(touch=>touch.identifier===b.touchId);if(touch){clearTimeout(b.contactTimer);b.pointerCancelled=false;b.touchId=null;b.pointerId=null;released(b,touch);}},{capture:true,passive:true});
  document.addEventListener('touchcancel',()=>{const b=active;if(!b)return;b.touchId=null;b.pointerId=null;released(b);},{capture:true,passive:true});
  function holdPreview(b,pane){
    const source=previewSource(pane._item);if(!source)return;
    clearCover(b);
    const cover=document.createElement('div'),image=document.createElement('img');cover.className='native-pending-cover';cover.setAttribute('aria-hidden','true');
    Object.assign(cover.style,{position:'absolute',inset:'0',zIndex:'5',overflow:'hidden'});
    Object.assign(image.style,{position:'absolute',inset:'0',width:'100%',height:'100%',maxWidth:'100%',maxHeight:'100%',objectFit:'contain',opacity:'0'});
    image.alt='';image.draggable=false;image.decoding='async';
    image.addEventListener('load',()=>{if(b.previewImage===image&&image.naturalWidth){cover.style.backgroundColor=typeof getComputedStyle==='function'?getComputedStyle(b.stage).backgroundColor:'#ede5d4';image.style.opacity='1';}});
    // Loading neighbours keep the old decoded photo behind them, never a blank
    // canvas. Once ready, these pixels survive recentering for the next stroke.
    image.src=source;if(image.complete&&image.naturalWidth)image.style.opacity='1';
    cover.append(image);cover.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();});
    b.center.append(cover);b.cover=cover;b.previewImage=image;
  }
  function anchor(b){
    const width=b.viewport.clientWidth;
    if(!(width>0))return false;
    if(!b.anchored||Math.abs(width-b.width)>1){b.width=width;b.viewport.scrollLeft=width;b.anchored=true;b.viewport.style.visibility='';}
    return true;
  }
  function arrange(b){side(b.viewport.children[0],b.next);side(b.viewport.children[2],b.previous);}
  function reset(stage){
    if(!active||stage&&active.stage!==stage)return;
    const b=active;active=null;clearTimeout(b.wheelTimer);clearTimeout(b.settleTimer);clearTimeout(b.contactTimer);b.resize?.disconnect();for(const resolve of b.idle)resolve();b.idle.clear();
    if(b.node.parentNode===b.center)b.viewport.before(b.node);
    b.viewport.remove();b.stage.classList.remove('has-native-photo-strip');
  }
  function has(stage){return active?.stage===stage;}
  function note(stage,dx){
    const b=active;if(b?.stage!==stage||b.pending)return;b.touchOwned=true;b.touchIntent=Math.sign(dx);b.settling=true;
    clearTimeout(b.settleTimer);b.settleTimer=setTimeout(()=>{if(active===b)b.finish(true);},180);
  }
  function claim(stage){
    const b=active;if(!b||b.stage!==stage)return 'manual';
    if(b.pending)return 'queued';b.touchOwned=true;
    if(Math.abs(b.viewport.scrollLeft-b.width)<=2)return 'native';
    b.finish(true);return 'queued';
  }
  function mount(stage,{previous,next,enabled,step,busy,pending=false}){
    if(stage?.nodeType!==1||!supported()||!enabled()){reset(stage);return false;}
    const node=stage.querySelector('.face-photo-scroll')||(!stage._familyFaceContext?(active?.stage===stage?active.node:stage.querySelector('video,iframe,img')):null);
    if(!node)return false;
    if(active?.stage===stage&&active.node===node){Object.assign(active,{enabled,step,busy,previous,next});if(!pending)clearCover(active);arrange(active);anchor(active);return true;}
    reset();const viewport=document.createElement('div');viewport.className='native-photo-strip';viewport.dir='ltr';
    Object.assign(viewport.style,{scrollBehavior:'auto',visibility:'hidden',overflowX:''});
    const left=document.createElement('div'),center=document.createElement('div'),right=document.createElement('div');
    for(const pane of [left,center,right]){pane.className='native-photo-pane';viewport.append(pane);}
    node.before(viewport);center.append(node);stage.classList.add('has-native-photo-strip');
    const b=active={stage,node,viewport,center,enabled,step,busy,previous,next,width:0,anchored:false,pending:0,idle:new Set(),pointerId:null,touchId:null,touchOwned:false,touchIntent:0,wheelActive:false,wheelOwned:false,wheelSum:0,settling:false,nativeEnded:false};
    arrange(b);anchor(b);
    const clearEpisode=()=>{
      clearTimeout(b.wheelTimer);clearTimeout(b.settleTimer);clearTimeout(b.contactTimer);b.pointerCancelled=false;b.settling=false;b.touchOwned=false;b.touchIntent=0;b.explicitRelease=false;b.nativePanSeen=false;b.panDirection=0;b.wheelOwned=false;b.wheelSum=0;b.nativeEnded=false;b.settleTarget=null;viewport.style.scrollSnapType='';
    };
    const finish=b.finish=(fallback=false,reserveWheel=false)=>{
      if(active!==b||!anchor(b))return;fallback=fallback===true;
      if(!fallback&&(b.pointerId!=null||b.touchId!=null)){if(Math.abs(viewport.scrollLeft-b.width)>2)b.nativeEnded=true;return;}
      const edge=viewport.scrollLeft<=2?1:viewport.scrollLeft>=b.width*2-2?-1:0;
      const owned=b.touchOwned||b.wheelOwned;
      const direction=b.wheelOwned?(b.wheelSum?Math.sign(b.wheelSum):edge):(b.explicitRelease?b.touchIntent:b.touchIntent||b.panDirection||edge);
      // Navigation is no longer part of input ownership. Clear the completed
      // episode before step(), while retaining a newer contact or wheel burst.
      clearEpisode();b.wheelActive=reserveWheel===true;resolveIdle(b);
      if(!owned||!direction||!b.enabled()){viewport.scrollLeft=b.width;return;}
      holdPreview(b,viewport.children[direction>0?0:2]);viewport.scrollLeft=b.width;b.pending++;
      let request;try{request=b.step(direction,{native:true,queued:true});}catch{request=null;}
      Promise.resolve(request).catch(()=>{}).finally(()=>{if(active!==b)return;b.pending--;if(!b.pending&&!b.busy?.())clearCover(b);});
    };
    const nativeControl=event=>{
      const target=event.target;
      if(target?.closest?.('a,input,textarea,select,[contenteditable],[data-face-handle],button:not(.face-hit)'))return true;
      const video=target?.closest?.('video'),rect=video?.getBoundingClientRect?.();return Boolean(rect&&event.clientY>=rect.bottom-72);
    };
    const cancel=()=>{b.pointerId=null;b.touchId=null;b.wheelActive=false;clearEpisode();viewport.scrollLeft=b.width;resolveIdle(b);};
    const beginTouch=(event,touch=false)=>{
      if(active!==b||!b.enabled()||!anchor(b)||nativeControl(event))return;
      if(event.isPrimary===false){cancel();return;}
      const preceding=b.settling||b.wheelOwned;
      if(touch)b.touchId=event.identifier;else b.pointerId=event.pointerId;
      if(preceding)b.finish(true);
      if(active!==b)return;b.touchOwned=true;b.explicitRelease=false;b.nativeEnded=false;b.nativePanSeen=false;b.panDirection=0;b.stroke={x:event.clientX,y:event.clientY,dx:0,dy:0};
      if(touch&&b.pointerId==null)cancelledContact(b,350);
    };
    viewport.addEventListener('pointerdown',event=>{if(['touch','pen'].includes(event.pointerType)||event.sourceCapabilities?.firesTouchEvents)beginTouch(event);},{capture:true,passive:true});
    viewport.addEventListener('touchstart',event=>{if(event.touches.length===1)beginTouch(event.touches[0],true);else cancel();},{capture:true,passive:true});
    const settleWheel=()=>{
      if(active!==b||!b.wheelOwned)return;b.wheelActive=false;b.settling=true;viewport.style.scrollSnapType='';
      const edge=viewport.scrollLeft<=2?1:viewport.scrollLeft>=b.width*2-2?-1:0;
      const direction=b.wheelSum?Math.sign(b.wheelSum):edge,target=direction>0?0:direction<0?b.width*2:b.width;b.settleTarget=target;
      clearTimeout(b.settleTimer);b.settleTimer=setTimeout(()=>{if(active===b)b.finish(true);},220);
      if(viewport.scrollTo)viewport.scrollTo({left:target,behavior:'smooth'});else viewport.scrollLeft=target;
    };
    viewport.addEventListener('wheel',event=>{
      if(event.ctrlKey||event.metaKey||nativeControl(event)||active!==b||!b.enabled()||!anchor(b))return;
      const unit=event.deltaMode===1?16:event.deltaMode===2?b.width:1,rawDX=(event.deltaX||event.shiftKey&&event.deltaY||0)*unit,dy=(event.shiftKey&&!event.deltaX?0:event.deltaY||0)*unit;
      if(!rawDX||Math.abs(rawDX)<Math.abs(dy)*1.15)return;
      const dx=window.FamilyGalleryInput?.wheelDelta?.(rawDX)??rawDX;
      if(event.cancelable!==false)event.preventDefault?.();
      const oldContact=b.pointerId!=null||b.touchId!=null;
      const preceding=oldContact||b.settling||b.wheelOwned&&Math.sign(dx)!==Math.sign(b.wheelSum)&&Math.abs(dx)>=8;
      // A wheel packet proves a new input owner; stale Windows compatibility
      // touch IDs cannot hold this episode or a decoded image indefinitely.
      if(oldContact){b.pointerId=null;b.touchId=null;const stroke=b.stroke;b.touchIntent=stroke&&Math.abs(stroke.dx)>=32?Math.sign(stroke.dx):0;}
      // Reserve this new physical input before committing a previous episode,
      // so a warm cached image cannot replace its native target in this stack.
      b.wheelActive=true;if(preceding)b.finish(true,true);
      if(active!==b)return;
      b.wheelOwned=true;b.wheelActive=true;b.settling=false;b.wheelSum+=dx;viewport.style.scrollSnapType='none';
      // Fixed left=Next panes let the actual pixels follow a rightward gesture.
      viewport.scrollLeft=Math.max(0,Math.min(b.width*2,viewport.scrollLeft-dx));
      clearTimeout(b.wheelTimer);b.wheelTimer=setTimeout(settleWheel,80);
    },{capture:true,passive:false});
    viewport.addEventListener('scroll',()=>{
      if(active!==b||!b.touchOwned||b.wheelOwned||!anchor(b))return;
      const offset=b.width-viewport.scrollLeft;
      if(Math.abs(offset)<=2)return;
      b.nativePanSeen=true;
      if(Math.abs(offset)>=Math.max(12,Math.min(32,b.width*.025)))b.panDirection=Math.sign(offset);
      // pointercancel means the browser took the pan. Its actual moving rail,
      // rather than a stopped pointer stream, keeps this contact alive.
      clearTimeout(b.settleTimer);cancelledContact(b);
    },{passive:true});
    viewport.addEventListener('scrollend',()=>{
      if(!b.wheelOwned||b.settling&&Math.abs(viewport.scrollLeft-b.settleTarget)<=2)b.finish();
    },{passive:true});
    if(typeof ResizeObserver!=='undefined'){b.resize=new ResizeObserver(()=>{if(active===b)anchor(b);});b.resize.observe(viewport);}
    return true;
  }
  window.FamilyPhotoNative={mount,reset,has,claim,note,supported,preview:stage=>active?.stage===stage?active.previewImage:null,isActive:stage=>active?.stage===stage&&inputActive(active),whenIdle:stage=>active?.stage===stage&&inputActive(active)?new Promise(resolve=>active.idle.add(resolve)):null};
})();
