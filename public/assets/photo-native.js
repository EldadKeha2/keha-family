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
  const inputActive=b=>Boolean(b&&(b.contact||b.wheel));
  const blockedClicks=new WeakMap();
  function resolveIdle(b){if(!inputActive(b)){for(const resolve of b.idle)resolve();b.idle.clear();}}
  function clearCover(b){b.cover?.remove();b.cover=null;b.previewImage=null;}
  const blockClick=b=>blockedClicks.set(b.stage,Date.now()+700);
  const prevent=event=>{if(event?.cancelable!==false)event?.preventDefault?.();};
  const coordinate=point=>Number.isFinite(point?.clientX)&&Number.isFinite(point?.clientY);
  const touchPoint=(event,touch)=>({identifier:touch.identifier,clientX:touch.clientX,clientY:touch.clientY,target:touch.target||event.target,cancelable:event.cancelable,preventDefault:()=>event.preventDefault?.()});
  document.addEventListener('pointerdown',event=>{const b=active;if(b?.contact&&b.contact.pointerId!=null&&b.contact.pointerId!==event.pointerId)b.cancel();},{capture:true,passive:true});
  document.addEventListener('pointermove',event=>{const b=active;if(b?.contact?.pointerId===event.pointerId)b.move(event);},{capture:true,passive:false});
  document.addEventListener('pointerup',event=>{const b=active;if(b?.contact?.pointerId===event.pointerId)b.release(event);},{capture:true,passive:false});
  document.addEventListener('pointercancel',event=>{const b=active;if(b?.contact?.pointerId===event.pointerId)b.release();},{capture:true,passive:true});
  document.addEventListener('touchmove',event=>{
    const b=active,g=b?.contact;if(!g||g.pointerId!=null)return;
    if(event.touches.length!==1){b.cancel();return;}
    const touch=[...event.touches].find(touch=>touch.identifier===g.touchId);if(touch)b.move(touchPoint(event,touch));
  },{capture:true,passive:false});
  document.addEventListener('touchend',event=>{
    const b=active,g=b?.contact;if(!g||g.pointerId!=null)return;
    const touch=[...event.changedTouches].find(touch=>touch.identifier===g.touchId);if(touch)b.release(touchPoint(event,touch));
  },{capture:true,passive:false});
  document.addEventListener('touchcancel',event=>{const b=active,g=b?.contact;if(g&&g.pointerId==null&&[...event.changedTouches].some(touch=>touch.identifier===g.touchId))b.cancel();},{capture:true,passive:true});
  document.addEventListener('click',event=>{
    if(event.detail===0)return;
    for(let node=event.target;node;node=node.parentNode){if(Date.now()<(blockedClicks.get(node)||0)){event.preventDefault();event.stopImmediatePropagation();return;}}
  },{capture:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)active?.cancel();});
  window.addEventListener?.('blur',()=>active?.cancel());
  function holdPreview(b,pane){
    const source=previewSource(pane._item);if(!source)return;
    clearCover(b);
    const ready=[...pane.children].find(child=>child.tagName==='IMG'&&child.complete&&child.naturalWidth),cover=document.createElement('div'),image=ready||document.createElement('img');cover.className='native-pending-cover';cover.setAttribute('aria-hidden','true');
    // Reuse already-painted neighbour pixels when possible. Creating a fresh
    // image here can briefly expose the old center while its cached load fires.
    if(ready)pane._photoSource=null;
    Object.assign(cover.style,{position:'absolute',inset:'0',zIndex:'5',overflow:'hidden'});
    Object.assign(image.style,{position:'absolute',inset:'0',width:'100%',height:'100%',maxWidth:'100%',maxHeight:'100%',objectFit:'contain',opacity:'0'});
    image.alt='';image.draggable=false;image.decoding='async';
    image.addEventListener('load',()=>{if(b.previewImage===image&&image.naturalWidth){cover.style.backgroundColor=typeof getComputedStyle==='function'?getComputedStyle(b.stage).backgroundColor:'#ede5d4';image.style.opacity='1';}});
    // Loading neighbours keep the old decoded photo behind them, never a blank
    // canvas. Once ready, these pixels survive recentering for the next stroke.
    if(!ready)image.src=source;if(image.complete&&image.naturalWidth){cover.style.backgroundColor=typeof getComputedStyle==='function'?getComputedStyle(b.stage).backgroundColor:'#ede5d4';image.style.opacity='1';}
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
  function releaseCapture(b,g){if(g?.pointerId!=null)try{b.stage.releasePointerCapture?.(g.pointerId);}catch{}}
  function reset(stage){
    if(!active||stage&&active.stage!==stage)return;
    const b=active;active=null;clearTimeout(b.wheelTimer);clearTimeout(b.contactTimer);releaseCapture(b,b.contact);b.resize?.disconnect();for(const resolve of b.idle)resolve();b.idle.clear();
    if(b.node.parentNode===b.center)b.viewport.before(b.node);
    b.viewport.remove();b.stage.classList.remove('has-native-photo-strip');b.stage.classList.remove('photo-pointer-dragging');
  }
  function has(stage){return active?.stage===stage;}
  // Legacy callers can still submit a completed gesture; DOM scrolling itself
  // never has authority to select a neighbouring item.
  function note(stage,dx){const b=active;if(b?.stage===stage&&Number.isFinite(dx)&&dx){b.cancel();b.navigate(Math.sign(dx));}}
  function claim(stage){return active?.stage===stage?'queued':'manual';}
  function mount(stage,{previous,next,enabled,step,busy,pending=false}){
    if(stage?.nodeType!==1||!supported()||!enabled()){reset(stage);return false;}
    const node=stage.querySelector('.face-photo-scroll')||(!stage._familyFaceContext?(active?.stage===stage?active.node:stage.querySelector('video,iframe,img')):null);
    if(!node)return false;
    if(active?.stage===stage&&active.node===node){Object.assign(active,{enabled,step,busy,previous,next});if(!pending)clearCover(active);arrange(active);anchor(active);return true;}
    reset();const viewport=document.createElement('div');viewport.className='native-photo-strip';viewport.dir='ltr';
    Object.assign(viewport.style,{scrollBehavior:'auto',scrollSnapType:'none',touchAction:'pan-y pinch-zoom',visibility:'hidden',overflowX:'hidden'});
    const left=document.createElement('div'),center=document.createElement('div'),right=document.createElement('div');
    for(const pane of [left,center,right]){pane.className='native-photo-pane';viewport.append(pane);}
    node.before(viewport);center.append(node);stage.classList.add('has-native-photo-strip');
    const b=active={stage,node,viewport,center,enabled,step,busy,previous,next,width:0,anchored:false,pending:0,idle:new Set(),contact:null,wheel:null};
    arrange(b);anchor(b);
    const recenter=()=>{if(b.anchored)viewport.scrollLeft=b.width;};
    const navigate=b.navigate=direction=>{
      if(active!==b||!anchor(b))return;
      if(!direction||!b.enabled()){recenter();resolveIdle(b);return;}
      // Copy the selected preview before step() can update logical neighbours.
      // Input ownership is already complete, so image preparation can paint.
      holdPreview(b,viewport.children[direction>0?0:2]);recenter();resolveIdle(b);b.pending++;
      let request;try{request=b.step(direction,{native:true,queued:true});}catch{request=null;}
      Promise.resolve(request).catch(()=>{}).finally(()=>{if(active!==b)return;b.pending--;if(!b.pending&&!b.busy?.())clearCover(b);});
    };
    const nativeControl=event=>{
      const target=event.target;
      if(target?.closest?.('a,input,textarea,select,iframe,[contenteditable],[role="textbox"],[data-face-handle],.face-picker,.face-name,.face-label-list,.face-adjust-guide,button:not(.face-hit)'))return true;
      const video=target?.closest?.('video'),rect=video?.getBoundingClientRect?.();return Boolean(rect&&event.clientY>=rect.bottom-72);
    };
    const endContact=()=>{const g=b.contact;b.contact=null;clearTimeout(b.contactTimer);releaseCapture(b,g);stage.classList.remove('photo-pointer-dragging');return g;};
    const finishWheel=()=>{
      const wheel=b.wheel;if(!wheel)return;b.wheel=null;clearTimeout(b.wheelTimer);
      navigate(Math.sign(wheel.dx));
    };
    b.cancel=()=>{endContact();b.wheel=null;clearTimeout(b.wheelTimer);recenter();resolveIdle(b);};
    const draw=g=>{viewport.scrollLeft=Math.max(0,Math.min(b.width*2,b.width-g.dx));};
    b.move=event=>{
      const g=b.contact;if(!g||!coordinate(event)||active!==b)return;
      if(!b.enabled()){b.cancel();return;}
      clearTimeout(b.contactTimer);g.dx=event.clientX-g.x;g.dy=event.clientY-g.y;
      if(!g.axis&&Math.max(Math.abs(g.dx),Math.abs(g.dy))>=8){
        g.axis=Math.abs(g.dx)>=Math.abs(g.dy)*.8?'x':'y';
        if(g.axis==='x'){
          stage.classList.add('photo-pointer-dragging');
          if(g.pointerId!=null)try{stage.setPointerCapture?.(g.pointerId);}catch{}
        }
      }
      if(g.axis!=='x')return;
      blockClick(b);prevent(event);draw(g);
    };
    b.release=event=>{
      if(!b.contact)return;b.move(event);const g=endContact();if(!g)return;
      const threshold=Math.max(32,Math.min(56,b.width*.06));
      const direction=g.axis==='x'&&Math.abs(g.dx)>=threshold?Math.sign(g.dx):0;
      if(g.axis==='x'){blockClick(b);prevent(event);}
      navigate(direction);
    };
    const begin=(event,pointer=true)=>{
      if(active!==b||!b.enabled()||!anchor(b)||!coordinate(event)||nativeControl(event))return;
      if(event.isPrimary===false){b.cancel();return;}
      if(b.contact){
        // Pointer and compatibility TouchEvents describe one contact. Joining
        // the second stream must never replace its origin or select an item.
        if(pointer&&b.contact.pointerId==null){b.contact.pointerId=event.pointerId;clearTimeout(b.contactTimer);return;}
        if(!pointer){b.contact.touchId=event.identifier;return;}
        if(b.contact.pointerId===event.pointerId)return;
        b.cancel();
      }
      b.contact={pointerId:pointer?event.pointerId:null,touchId:pointer?null:event.identifier,x:event.clientX,y:event.clientY,dx:0,dy:0,axis:null};
      // Reserve the new finger before completing an earlier wheel burst; a
      // warm cached target must wait for this new contact to be released.
      if(b.wheel)finishWheel();
      if(!pointer){const g=b.contact;b.contactTimer=setTimeout(()=>{if(active===b&&b.contact===g&&!g.axis)b.cancel();},650);}
    };
    viewport.addEventListener('pointerdown',event=>{if(['touch','pen'].includes(event.pointerType)||event.sourceCapabilities?.firesTouchEvents)begin(event);},{capture:true,passive:true});
    viewport.addEventListener('touchstart',event=>{if(event.touches.length!==1){b.cancel();return;}begin(touchPoint(event,event.touches[0]),false);},{capture:true,passive:true});
    viewport.addEventListener('wheel',event=>{
      if(event.ctrlKey||event.metaKey||nativeControl(event)||active!==b||!b.enabled()||!anchor(b))return;
      const unit=event.deltaMode===1?16:event.deltaMode===2?b.width:1,rawDX=(event.deltaX||event.shiftKey&&event.deltaY||0)*unit,dy=(event.shiftKey&&!event.deltaX?0:event.deltaY||0)*unit;
      if(!Number.isFinite(rawDX)||!rawDX||!b.wheel&&Math.abs(rawDX)<Math.abs(dy)*.8)return;
      const dx=window.FamilyGalleryInput?.wheelDelta?.(rawDX)??rawDX;
      if(!Number.isFinite(dx)||!dx)return;
      prevent(event);blockClick(b);
      if(b.contact){
        // Wheel input proves a new owner. Finish a real horizontal finger
        // stroke, while making the newly reserved wheel visible to whenIdle.
        b.wheel={dx:0};const g=endContact(),threshold=Math.max(32,Math.min(56,b.width*.06));
        navigate(g?.axis==='x'&&Math.abs(g.dx)>=threshold?Math.sign(g.dx):0);
      }
      if(b.wheel?.dx&&Math.sign(dx)!==Math.sign(b.wheel.dx)){
        const previous=b.wheel;b.wheel={dx:0};clearTimeout(b.wheelTimer);navigate(Math.sign(previous.dx));
      }
      if(active!==b)return;b.wheel||={dx:0};b.wheel.dx+=dx;
      viewport.scrollLeft=Math.max(0,Math.min(b.width*2,b.width-b.wheel.dx));
      clearTimeout(b.wheelTimer);b.wheelTimer=setTimeout(()=>{if(active===b)finishWheel();},80);
    },{capture:true,passive:false});
    // Browser scroll events are deliberately observational only. The rail is
    // not horizontally scrollable by the browser, even for declined inputs.
    if(typeof ResizeObserver!=='undefined'){b.resize=new ResizeObserver(()=>{if(active===b)anchor(b);});b.resize.observe(viewport);}
    return true;
  }
  window.FamilyPhotoNative={mount,reset,has,claim,note,supported,preview:stage=>active?.stage===stage?active.previewImage:null,isActive:stage=>active?.stage===stage&&inputActive(active),whenIdle:stage=>active?.stage===stage&&inputActive(active)?new Promise(resolve=>active.idle.add(resolve)):null};
})();
