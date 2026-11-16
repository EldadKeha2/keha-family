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
  const inputActive=b=>Boolean(b&&(b.pointerId!=null||b.touchId!=null||b.wheelActive||b.scrolling||b.touchIntent));
  function resolveIdle(b){if(!inputActive(b)){for(const resolve of b.idle)resolve();b.idle.clear();}}
  function clearCover(b){b.cover?.remove();b.cover=null;b.previewImage=null;}
  function position(b,event){
    if(!b.stroke)return;
    b.stroke.dx=event.clientX-b.stroke.x;b.stroke.dy=event.clientY-b.stroke.y;
  }
  function released(b,event){
    if(event)position(b,event);
    const stroke=b.stroke;
    if(stroke&&Math.abs(stroke.dx)>=Math.max(32,Math.min(56,b.width*.06))&&Math.abs(stroke.dx)>=Math.abs(stroke.dy)*1.2)b.touchIntent={direction:Math.sign(stroke.dx),time:Date.now()};
    if(b.pointerId==null&&b.touchId==null){
      if(b.deferredFinish){b.deferredFinish=false;b.finish();}else resolveIdle(b);
    }
  }
  document.addEventListener('pointermove',event=>{const b=active;if(b?.pointerId===event.pointerId)position(b,event);},{capture:true,passive:true});
  document.addEventListener('pointerup',event=>{const b=active;if(b?.pointerId!==event.pointerId)return;b.pointerId=null;released(b,event);},{capture:true,passive:true});
  document.addEventListener('pointercancel',event=>{const b=active;if(b?.pointerId!==event.pointerId)return;b.pointerId=null;resolveIdle(b);},{capture:true,passive:true});
  document.addEventListener('touchmove',event=>{const b=active;if(b?.touchId==null)return;const touch=[...event.touches].find(touch=>touch.identifier===b.touchId);if(touch)position(b,touch);},{capture:true,passive:true});
  document.addEventListener('touchend',event=>{const b=active;if(b?.touchId==null)return;const touch=[...event.changedTouches].find(touch=>touch.identifier===b.touchId);if(touch){b.touchId=null;b.pointerId=null;released(b,touch);}},{capture:true,passive:true});
  document.addEventListener('touchcancel',()=>{const b=active;if(!b)return;b.touchId=null;b.pointerId=null;resolveIdle(b);},{capture:true,passive:true});
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
  function arrange(b,mode=b.mode){
    b.mode=mode;
    // Touch content follows the finger. Precision trackpads report scroll
    // deltas instead; positive deltaX must select the same Next action.
    side(b.viewport.children[0],mode==='wheel'?b.previous:b.next);
    side(b.viewport.children[2],mode==='wheel'?b.next:b.previous);
  }
  function reset(stage){
    if(!active||stage&&active.stage!==stage)return;
    const b=active;active=null;clearTimeout(b.timer);clearTimeout(b.releaseTimer);clearTimeout(b.wheelTimer);b.resize?.disconnect();for(const resolve of b.idle)resolve();b.idle.clear();
    if(b.node.parentNode===b.center)b.viewport.before(b.node);
    b.viewport.remove();b.stage.classList.remove('has-native-photo-strip');
  }
  function has(stage){return active?.stage===stage;}
  function note(stage,dx){
    const b=active;if(b?.stage!==stage||b.locked)return;b.armed=true;b.releasedPage=dx>0?0:2;b.releasedAt=Date.now();clearTimeout(b.releaseTimer);
    b.releaseTimer=setTimeout(()=>{if(active!==b||b.locked||b.releasedPage==null)return;if(!anchor(b))return;b.viewport.scrollLeft=b.releasedPage*b.width;b.finish();},180);
  }
  function claim(stage){
    const b=active;if(!b||b.stage!==stage)return 'manual';
    if(b.locked)return 'queued';b.armed=true;
    const page=b.releasedPage!=null&&Date.now()-b.releasedAt<750?b.releasedPage:Math.round(b.viewport.scrollLeft/b.width);
    if(page===1)return 'native';
    b.viewport.scrollLeft=page*b.width;b.finish();return 'queued';
  }
  function mount(stage,{previous,next,enabled,step,busy,pending=false}){
    if(stage?.nodeType!==1||!supported()||!enabled()){reset(stage);return false;}
    const node=stage.querySelector('.face-photo-scroll')||(!stage._familyFaceContext?(active?.stage===stage?active.node:stage.querySelector('video,iframe,img')):null);
    if(!node)return false;
    if(active?.stage===stage&&active.node===node){
      Object.assign(active,{enabled,step,busy,previous,next});if(!pending)clearCover(active);arrange(active);anchor(active);return true;
    }
    reset();const viewport=document.createElement('div');viewport.className='native-photo-strip';viewport.dir='ltr';
    Object.assign(viewport.style,{scrollBehavior:'auto',visibility:'hidden',overflowX:''});
    const left=document.createElement('div'),center=document.createElement('div'),right=document.createElement('div');
    for(const pane of [left,center,right]){pane.className='native-photo-pane';viewport.append(pane);}
    node.before(viewport);center.append(node);stage.classList.add('has-native-photo-strip');
    const b=active={stage,node,viewport,center,enabled,step,busy,previous,next,mode:'touch',width:0,anchored:false,armed:false,locked:false,pending:0,timer:null,idle:new Set(),pointerId:null,touchId:null,wheelActive:false,wheelSum:0,wheelRestart:null,lastWheelAt:null,scrolling:false};
    arrange(b);anchor(b);
    const finish=b.finish=(force=false,reserveWheel=false)=>{
      if(active!==b||!anchor(b))return;force=force===true;
      if(!force&&(b.pointerId!=null||b.touchId!=null)){b.deferredFinish=true;return;}
      b.scrolling=false;b.wheelActive=reserveWheel===true;clearTimeout(b.wheelTimer);resolveIdle(b);
      const page=Math.round(viewport.scrollLeft/b.width);
      if(!b.armed){viewport.scrollLeft=b.width;return;}
      const intent=b.mode==='wheel'?(Math.abs(b.wheelSum)>=Math.max(32,Math.min(56,b.width*.06))?Math.sign(b.wheelSum):0):b.touchIntent?b.touchIntent.direction:0;
      if(!force&&Math.abs(viewport.scrollLeft-page*b.width)>2)return;
      if(!b.enabled()||b.mode==='wheel'&&!intent||page===1&&!intent){b.touchIntent=null;b.wheelSum=0;b.wheelRestart=null;viewport.scrollLeft=b.width;resolveIdle(b);return;}

      const target=intent?(intent>0)===(b.mode!=='wheel')?0:2:b.releasedPage!=null&&Date.now()-b.releasedAt<750?b.releasedPage:page;
      clearTimeout(b.releaseTimer);b.releasedPage=null;b.touchIntent=null;b.wheelSum=0;b.wheelRestart=null;resolveIdle(b);
      const direction=intent||(target<1?1:-1)*(b.mode==='wheel'?-1:1);
      holdPreview(b,viewport.children[target]);
      // Keep the browser scroller available while the media request runs. A
      // second complete stroke is another action, not part of a disabled lock.
      viewport.scrollLeft=b.width;b.armed=false;b.pending++;b.locked=true;
      let request;try{request=b.step(direction,{native:true,queued:true});}catch{request=null;}
      Promise.resolve(request).catch(()=>{}).finally(()=>{if(active!==b)return;b.pending--;if(!b.pending&&!b.busy?.()){b.locked=false;clearCover(b);}});
    };
    const input=mode=>{if(active!==b||!b.enabled()||!anchor(b))return false;b.armed=true;arrange(b,mode);return true;};
    const nativeControl=event=>{
      const target=event.target;
      if(target?.closest?.('a,input,textarea,select,[contenteditable],[data-face-handle],button:not(.face-hit)'))return true;
      const video=target?.closest?.('video'),rect=video?.getBoundingClientRect?.();
      return Boolean(rect&&event.clientY>=rect.bottom-72);
    };
    const cancelInput=()=>{b.pointerId=null;b.touchId=null;b.touchIntent=null;b.armed=false;b.scrolling=false;resolveIdle(b);};
    const beginTouch=(event,touch=false)=>{
      if(active!==b||!b.enabled()||!anchor(b)||nativeControl(event))return;
      if(event.isPrimary===false){cancelInput();return;}
      const preceding=b.touchIntent&&b.pointerId==null&&b.touchId==null;
      if(touch)b.touchId=event.identifier;else b.pointerId=event.pointerId;
      // Register the new contact before committing the released one, so image
      // preparation cannot replace this finger's target in the same call stack.
      if(preceding)b.finish(true);
      if(active!==b)return;input('touch');
      b.stroke={x:event.clientX,y:event.clientY,dx:0,dy:0};
    };
    viewport.addEventListener('pointerdown',event=>{if(['touch','pen'].includes(event.pointerType)||event.sourceCapabilities?.firesTouchEvents)beginTouch(event);},{capture:true,passive:true});
    viewport.addEventListener('touchstart',event=>{if(event.touches.length===1)beginTouch(event.touches[0],true);else cancelInput();},{capture:true,passive:true});
    viewport.addEventListener('wheel',event=>{
      if(event.ctrlKey||event.metaKey||nativeControl(event))return;
      const unit=event.deltaMode===1?16:event.deltaMode===2?b.width:1;
      const dx=(event.deltaX||event.shiftKey&&event.deltaY||0)*unit,dy=(event.shiftKey&&!event.deltaX?0:event.deltaY||0)*unit;
      if(dx&&Math.abs(dx)>=Math.abs(dy)*1.15){
        const now=Date.now(),distance=Math.max(32,Math.min(56,b.width*.06));
        // Browser snap animation can merge two separate trackpad bursts into
        // one scrollend. A pause between meaningful sample groups marks the
        // next action; continuous precision-pad momentum stays in one group.
        const nextPhase=b.lastWheelAt!==null&&now-b.lastWheelAt>=70&&Math.abs(b.wheelSum)>=distance;
        const reversal=b.wheelSum&&Math.sign(dx)!==Math.sign(b.wheelSum)&&Math.abs(dx)>=8&&Math.abs(b.wheelSum)>=40;
        if(!b.wheelRestart&&(nextPhase||reversal))b.wheelRestart={sum:0};
        if(b.wheelRestart){
          b.wheelRestart.sum+=dx;
          // A tiny late momentum tail is not another action. Fractional input
          // can still build a real restarted phase over several samples.
          if(Math.abs(b.wheelRestart.sum)>=32){
            const restarted=b.wheelRestart.sum;b.finish(true,true);
            if(active!==b)return;b.wheelSum=restarted;
          }
        }else b.wheelSum+=dx;
        if(active!==b||!input('wheel'))return;b.lastWheelAt=now;b.wheelActive=true;
        clearTimeout(b.wheelTimer);b.wheelTimer=setTimeout(()=>{if(active!==b)return;b.wheelActive=false;resolveIdle(b);},180);
      }
    },{capture:true,passive:true});
    const scrollEnd='onscrollend' in viewport;
    viewport.addEventListener('scroll',()=>{if(active!==b)return;if(b.anchored&&Math.abs(viewport.scrollLeft-b.width)>2)b.scrolling=true;if(scrollEnd)return;clearTimeout(b.timer);b.timer=setTimeout(finish,160);},{passive:true});
    viewport.addEventListener('scrollend',()=>finish(),{passive:true});
    if(typeof ResizeObserver!=='undefined'){b.resize=new ResizeObserver(()=>{if(active===b)anchor(b);});b.resize.observe(viewport);}
    return true;
  }
  window.FamilyPhotoNative={mount,reset,has,claim,note,supported,preview:stage=>active?.stage===stage?active.previewImage:null,isActive:stage=>active?.stage===stage&&inputActive(active),whenIdle:stage=>active?.stage===stage&&inputActive(active)?new Promise(resolve=>active.idle.add(resolve)):null};
})();
