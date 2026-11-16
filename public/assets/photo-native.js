(() => {
  'use strict';
  let active=null,ignoredTouchStage=null,ignoredTouchIds=new Set();
  const boundStages=new WeakSet();
  const completedPointerStarts=new WeakSet();
  // A pad keeps emitting momentum after the finger lifts, including packets
  // separated by more than the paint/commit deadline. Keep its episode on the
  // stable stage so rebuilding a photograph cannot turn that tail into Next.
  const wheelEpisodes=new WeakMap();
  function wheelSample(stage,dx){
    const now=Date.now(),magnitude=Math.abs(dx),sign=Math.sign(dx),old=wheelEpisodes.get(stage),recent=old&&now-old.at<=360;
    if(recent){
      const same=sign===old.sign,rebound=!same&&magnitude<=old.peak*.1;
      const tail=old.ended&&same&&magnitude<old.peak*.3&&(magnitude<=old.last*1.4+Math.max(.001,old.peak*.005)||old.tail&&magnitude<old.peak*.12);
      if(rebound||tail){old.at=now;old.ignored++;if(tail){old.last=magnitude;old.tail=true;}return {episode:old,ignore:true};}
      if(!old.ended&&same){old.at=now;old.last=magnitude;old.peak=Math.max(old.peak,magnitude);old.samples++;return {episode:old};}
    }
    const replace=Boolean(recent&&!old.ended&&old.samples<=2&&old.peak<8&&magnitude>=Math.max(.5,old.peak*4)&&sign!==old.sign);
    const episode={sign,at:now,peak:magnitude,last:magnitude,samples:1,ignored:0,ended:false,tail:false};wheelEpisodes.set(stage,episode);
    return {episode,replace,split:Boolean(old&&!old.ended&&!replace)};
  }
  function finishWheelEpisode(stage,episode){if(episode&&wheelEpisodes.get(stage)===episode)episode.ended=true;}
  function clearWheelEpisode(stage){if(stage)wheelEpisodes.delete(stage);}
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
  const targetLabel=target=>{const tag=target?.tagName?.toLowerCase?.()||'element',classes=typeof target?.className==='string'?target.className.trim().split(/\s+/).filter(Boolean).slice(0,4).join('.'):'';return tag+(classes?'.'+classes:'');};
  function record(b,type,event,decision){b.lastEvent=type+' '+targetLabel(event?.target);b.lastDecision=decision;}
  const clearTouchTail=()=>{ignoredTouchStage=null;ignoredTouchIds.clear();};
  const ignoreTouchTail=(stage,touches)=>{ignoredTouchStage=touches.length?stage:null;ignoredTouchIds=new Set([...touches].map(touch=>touch.identifier));};
  const tailRemains=touches=>[...touches].some(touch=>ignoredTouchIds.has(touch.identifier));
  document.addEventListener('pointerdown',event=>{
    const b=active;if(!b?.contact||event.isPrimary===false)return;
    const touch=['touch','pen'].includes(event.pointerType)||event.sourceCapabilities?.firesTouchEvents;
    if(b.contact.group&&(!touch||!b.stage.contains(event.target)||b.isProtected(event))){completedPointerStarts.add(event);record(b,'pointerdown',event,'new-control-owner');b.release();return;}
    if(!b.contact.group&&b.contact.pointerId!=null&&b.contact.pointerId!==event.pointerId)b.cancel();
  },{capture:true,passive:true});
  document.addEventListener('pointermove',event=>{const b=active;if(!b?.contact?.group&&b?.contact?.pointerId===event.pointerId)b.move(event);},{capture:true,passive:false});
  document.addEventListener('pointerup',event=>{const b=active;if(!b?.contact?.group&&b?.contact?.pointerId===event.pointerId)b.release(event);},{capture:true,passive:false});
  document.addEventListener('pointercancel',event=>{const b=active;if(!b?.contact?.group&&b?.contact?.pointerId===event.pointerId)b.pointerCancelled(event);},{capture:true,passive:true});
  document.addEventListener('touchmove',event=>{
    const b=active,g=b?.contact;if(!g||ignoredTouchStage===b.stage||g.pointerId!=null)return;
    if(g.group){b.moveGroup(event);return;}
    if(event.touches.length!==1){b.cancel();return;}
    const touch=[...event.touches].find(touch=>touch.identifier===g.touchId);if(touch)b.move(touchPoint(event,touch));
  },{capture:true,passive:false});
  document.addEventListener('touchend',event=>{
    if(ignoredTouchStage){const ignored=active?.stage===ignoredTouchStage;if(!tailRemains(event.touches))clearTouchTail();if(ignored)return;}
    const b=active,g=b?.contact;if(!g||g.pointerId!=null)return;
    if(g.group){b.endGroup(event);return;}
    const touch=[...event.changedTouches].find(touch=>touch.identifier===g.touchId);if(touch)b.release(touchPoint(event,touch));
  },{capture:true,passive:false});
  document.addEventListener('touchcancel',event=>{if(ignoredTouchStage){const ignored=active?.stage===ignoredTouchStage;if(!tailRemains(event.touches))clearTouchTail();if(ignored)return;}const b=active,g=b?.contact;if(g?.group){b.cancelGroup(event);return;}if(g&&g.pointerId==null&&[...event.changedTouches].some(touch=>touch.identifier===g.touchId))b.cancel();},{capture:true,passive:true});
  document.addEventListener('click',event=>{
    if(event.detail===0)return;
    for(let node=event.target;node;node=node.parentNode){if(Date.now()<(blockedClicks.get(node)||0)){event.preventDefault();event.stopImmediatePropagation();return;}}
  },{capture:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){clearWheelEpisode(active?.stage);clearTouchTail();active?.cancel();}});
  window.addEventListener?.('blur',()=>{clearWheelEpisode(active?.stage);clearTouchTail();active?.cancel();});
  function bindStage(stage){
    if(boundStages.has(stage))return;boundStages.add(stage);
    stage.addEventListener('pointerdown',event=>{
      const b=active;if(b?.stage!==stage)return;
      if(completedPointerStarts.has(event))return;
      if(ignoredTouchStage===stage){if(event.isPrimary===false)return;clearTouchTail();}
      if(event.isPrimary===false){record(b,'pointerdown',event,'await-touch-group');return;}
      if(['touch','pen'].includes(event.pointerType)||event.sourceCapabilities?.firesTouchEvents)b.begin(event);
      else record(b,'pointerdown',event,'manual-mouse');
    },{capture:true,passive:true});
    stage.addEventListener('touchstart',event=>{
      const b=active;if(b?.stage!==stage)return;
      if(ignoredTouchStage===stage){if(event.touches.length!==1&&tailRemains(event.touches))return;clearTouchTail();}
      if(event.touches.length>2){record(b,'touchstart',event,'multitouch-cancel');b.cancelGroup(event);return;}
      if(event.touches.length===2){b.beginGroup(event);return;}
      if(event.touches.length!==1)return;
      b.begin(touchPoint(event,event.touches[0]),false);
    },{capture:true,passive:true});
    stage.addEventListener('wheel',event=>{const b=active;if(b?.stage===stage)b.handleWheel(event);},{capture:true,passive:false});
  }
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
  function mount(stage,{previous,next,enabled,step,touchStep,busy,vertical,pending=false}){
    if(stage?.nodeType!==1||!supported()||!enabled()){reset(stage);return false;}
    const node=stage.querySelector('.face-photo-scroll')||(!stage._familyFaceContext?(active?.stage===stage?active.node:stage.querySelector('video,iframe,img')):null);
    if(!node)return false;
    if(active?.stage===stage&&active.node===node){Object.assign(active,{enabled,step,touchStep,busy,vertical,previous,next});if(!pending)clearCover(active);arrange(active);anchor(active);return true;}
    reset();const viewport=document.createElement('div');viewport.className='native-photo-strip';viewport.dir='ltr';
    Object.assign(viewport.style,{scrollBehavior:'auto',scrollSnapType:'none',touchAction:'pinch-zoom',visibility:'hidden',overflowX:'hidden'});
    const left=document.createElement('div'),center=document.createElement('div'),right=document.createElement('div');
    for(const pane of [left,center,right]){pane.className='native-photo-pane';viewport.append(pane);}
    node.before(viewport);center.append(node);stage.classList.add('has-native-photo-strip');
    const b=active={stage,node,viewport,center,enabled,step,touchStep,busy,vertical,previous,next,width:0,anchored:false,pending:0,idle:new Set(),contact:null,wheel:null,lastDecision:'mounted',lastEvent:'mount',protectedMatch:null};
    arrange(b);anchor(b);
    const clearWheelPaint=()=>{for(const pane of viewport.children){pane.style.transform='';pane.style.willChange='';}};
    const recenter=()=>{clearWheelPaint();if(b.anchored)viewport.scrollLeft=b.width;};
    const navigate=b.navigate=(direction,input='touch')=>{
      if(active!==b||!anchor(b))return;
      if(!direction||!b.enabled()){recenter();resolveIdle(b);return;}
      // Copy the selected preview before step() can update logical neighbours.
      // Input ownership is already complete, so image preparation can paint.
      holdPreview(b,viewport.children[direction>0?0:2]);recenter();resolveIdle(b);b.pending++;
      stage.setAttribute('data-gallery-last-input',input);stage.setAttribute('data-gallery-last-action',direction>0?'next':'previous');
      const action=input==='touch'?(b.touchStep||b.step):b.step;
      let request;try{request=action(direction,{native:true,queued:true,input});}catch{request=null;}
      Promise.resolve(request).catch(()=>{}).finally(()=>{if(active!==b)return;b.pending--;if(!b.pending&&!b.busy?.())clearCover(b);});
    };
    const nativeControl=event=>{
      const target=event.target;
      b.protectedMatch=null;let nonEditable=false;
      const protect=(node,reason)=>{b.protectedMatch=targetLabel(node)+' role='+(node.getAttribute?.('role')||'none')+' contenteditable='+(node.getAttribute?.('contenteditable')??'none')+' '+reason;return true;};
      // Controls outside this viewer cannot own its image gestures. In
      // particular, contenteditable="false" is not an editing control.
      for(let node=target;node&&node!==stage;node=node.parentNode){
        if(!stage.contains(node))break;
        const editable=node.getAttribute?.('contenteditable');
        if(editable==='false')nonEditable=true;
        if(node.matches?.('img,video,.native-photo-strip,.native-photo-pane,.face-photo-scroll,.face-photo-surface'))continue;
        if(node.matches?.('a,input,textarea,select,iframe,[data-face-handle],.face-picker,.face-name,.face-label-list,.face-adjust-guide,button:not(.face-hit)'))return protect(node,'control');
        if(!nonEditable&&(editable===''||editable==='true'||editable==='plaintext-only'))return protect(node,'editable');
        if(node.getAttribute?.('role')==='textbox')return protect(node,'textbox');
      }
      const video=target?.closest?.('video'),rect=video&&stage.contains(video)?video.getBoundingClientRect?.():null;return Boolean(rect&&event.clientY>=rect.bottom-72&&protect(video,'native-video-controls'));
    };
    b.isProtected=nativeControl;
    const endContact=()=>{const g=b.contact;b.contact=null;clearTimeout(b.contactTimer);releaseCapture(b,g);stage.classList.remove('photo-pointer-dragging');return g;};
    const touchQuiet=g=>{
      clearTimeout(b.contactTimer);
      b.contactTimer=setTimeout(()=>{if(active===b&&b.contact===g&&g.pointerId==null)b.release();},350);
    };
    const finishWheel=()=>{
      const wheel=b.wheel;if(!wheel)return;b.wheel=null;clearTimeout(b.wheelTimer);
      finishWheelEpisode(stage,wheel.episode);window.FamilyGalleryInput?.finishWheelDirection?.();
      navigate(Math.sign(wheel.dx),'wheel');
    };
    b.cancel=()=>{endContact();b.wheel=null;clearTimeout(b.wheelTimer);recenter();resolveIdle(b);};
    const draw=g=>{viewport.scrollLeft=Math.max(0,Math.min(b.width*2,b.width-g.dx));};
    b.move=event=>{
      const g=b.contact;if(!g||!coordinate(event)||active!==b)return;
      record(b,'move',event,'contact-moving');
      if(!b.enabled()){b.lastDecision='disabled-cancel';b.cancel();return;}
      clearTimeout(b.contactTimer);g.dx=event.clientX-g.x;g.dy=event.clientY-g.y;
      // A compatibility stream can continue after Windows cancelled its
      // pointer, then omit touchend. Actual touch positions extend its quiet
      // deadline; a healthy held pointer never gets this fallback deadline.
      if(g.pointerId==null&&!g.group)touchQuiet(g);
      if(!g.axis||g.axis==='y'&&Math.abs(g.dx)>=16&&Math.abs(g.dx)>=Math.abs(g.dy)*1.2){
        if(Math.abs(g.dx)>=8&&Math.abs(g.dx)>=Math.abs(g.dy)*.8)g.axis='x';
        else if(Math.abs(g.dy)>=24&&Math.abs(g.dy)>=Math.abs(g.dx)*1.4)g.axis='y';
        if(g.axis==='x'){
          stage.classList.add('photo-pointer-dragging');
          if(g.pointerId!=null)try{stage.setPointerCapture?.(g.pointerId);}catch{}
        }
      }
      if(g.axis==='y'){b.lastDecision='vertical';blockClick(b);prevent(event);b.vertical?.(g.lastY-event.clientY);g.lastY=event.clientY;return;}
      if(g.axis!=='x'){b.lastDecision='await-axis';return;}
      b.lastDecision='horizontal';
      blockClick(b);prevent(event);draw(g);
    };
    b.release=event=>{
      if(!b.contact)return;b.move(event);const g=endContact();if(!g)return;
      const threshold=Math.max(32,Math.min(56,b.width*.06));
      const direction=g.axis==='x'&&Math.abs(g.dx)>=threshold?Math.sign(g.dx):0;
      b.lastDecision=direction?'touch-commit-'+(direction>0?'next':'previous'):'touch-cancel';
      if(g.axis==='x'){blockClick(b);prevent(event);}
      navigate(direction);
    };
    b.pointerCancelled=event=>{
      const g=b.contact;if(!g)return;record(b,'pointercancel',event,'pointer-cancel');
      const threshold=Math.max(32,Math.min(56,b.width*.06));
      if(g.touchId!=null&&Math.abs(g.dx)<threshold){
        releaseCapture(b,g);g.pointerId=null;b.lastDecision='touch-fallback';touchQuiet(g);return;
      }
      b.release();
    };
    const pair=touches=>{
      const [a,c]=touches,dx=c.clientX-a.clientX,dy=c.clientY-a.clientY;
      return {clientX:(a.clientX+c.clientX)/2,clientY:(a.clientY+c.clientY)/2,distance:Math.hypot(dx,dy),angle:Math.atan2(dy,dx)};
    };
    b.cancelGroup=event=>{ignoreTouchTail(stage,event.touches);b.lastDecision='multitouch-or-pinch-cancel';b.cancel();};
    b.beginGroup=event=>{
      record(b,'touchstart',event,'group-start');
      if(!b.enabled()){b.lastDecision='disabled';return;}
      if(!anchor(b)){b.lastDecision='zero-width';return;}
      if(nativeControl(event)){b.lastDecision='protected-control';return;}
      if(![...event.touches].every(coordinate)){b.lastDecision='invalid-coordinates';return;}
      const ids=[...event.touches].map(touch=>touch.identifier);
      if(b.contact?.group&&b.contact.group.ids.every(id=>ids.includes(id)))return;
      const point=pair([...event.touches]),old=b.contact,offset=!old?.group&&old?.axis==='x'?old.dx:0;
      endContact();
      b.contact={pointerId:null,touchId:null,group:{ids,distance:point.distance,angle:point.angle},x:point.clientX-offset,y:point.clientY,lastY:point.clientY,dx:offset,dy:0,axis:!old?.group&&old?.axis==='x'?'x':null};
      b.lastDecision='two-touch-started';
      // A different pair proves the preceding group ended even when Windows
      // omitted its TouchEnd. Reserve the replacement before queued painting.
      if(old?.group){const threshold=Math.max(32,Math.min(56,b.width*.06));navigate(old.axis==='x'&&Math.abs(old.dx)>=threshold?Math.sign(old.dx):0);}
      if(b.wheel)finishWheel();
    };
    b.moveGroup=(event,positions=event.touches)=>{
      const g=b.contact;if(!g?.group)return;
      const touches=g.group.ids.map(id=>[...positions].find(touch=>touch.identifier===id));
      if(positions.length>2||touches.some(touch=>!coordinate(touch))){b.cancelGroup(event);return;}
      const point=pair(touches),span=Math.abs(point.distance-g.group.distance),rotation=Math.abs(Math.atan2(Math.sin(point.angle-g.group.angle),Math.cos(point.angle-g.group.angle)));
      if(span>12&&span>g.group.distance*.12||point.distance>12&&g.group.distance>12&&rotation>Math.PI/15){record(b,'touchmove',event,'pinch-or-rotation');b.cancelGroup(event);return;}
      b.move({clientX:point.clientX,clientY:point.clientY,target:event.target,cancelable:event.cancelable,preventDefault:()=>event.preventDefault?.()});
    };
    b.endGroup=event=>{
      const g=b.contact;if(!g?.group||![...event.changedTouches].some(touch=>g.group.ids.includes(touch.identifier)))return;
      // Keep both final positions while membership changes, avoiding a false
      // centroid jump when one finger lifts. Ignore its remaining tail even
      // when step() synchronously replaces the controller and current image.
      const positions=[...event.touches,...event.changedTouches].filter((touch,index,all)=>all.findIndex(other=>other.identifier===touch.identifier)===index);
      b.moveGroup(event,positions);if(b.contact!==g)return;
      ignoreTouchTail(stage,event.touches);b.release();
    };
    const begin=b.begin=(event,pointer=true)=>{
      record(b,pointer?'pointerdown':'touchstart',event,'start');
      if(active!==b)return;
      if(!b.enabled()){b.lastDecision='disabled';return;}
      if(!anchor(b)){b.lastDecision='zero-width';return;}
      if(!coordinate(event)){b.lastDecision='invalid-coordinates';return;}
      if(nativeControl(event)){b.lastDecision='protected-control';return;}
      if(event.isPrimary===false){b.lastDecision='multitouch-cancel';b.cancel();return;}
      const completed=b.contact?.group?endContact():null;
      if(b.contact){
        // Pointer and compatibility TouchEvents describe one contact. Joining
        // the second stream must never replace its origin or select an item.
        if(pointer&&b.contact.pointerId==null){b.contact.pointerId=event.pointerId;clearTimeout(b.contactTimer);b.lastDecision='joined-pointer';return;}
        if(!pointer){b.contact.touchId=event.identifier;b.lastDecision='joined-touch';return;}
        if(b.contact.pointerId===event.pointerId)return;
        b.cancel();
      }
      b.contact={pointerId:pointer?event.pointerId:null,touchId:pointer?null:event.identifier,x:event.clientX,y:event.clientY,lastY:event.clientY,dx:0,dy:0,axis:null};b.lastDecision='contact-started';
      // A new primary pointer or one-contact TouchStart cannot be a member of
      // the preceding two-contact group. Its live ownership must be visible
      // before completing that group's last controlled position.
      if(completed){const threshold=Math.max(32,Math.min(56,b.width*.06));navigate(completed.axis==='x'&&Math.abs(completed.dx)>=threshold?Math.sign(completed.dx):0);}
      // Reserve the new finger before completing an earlier wheel burst; a
      // warm cached target must wait for this new contact to be released.
      if(b.wheel)finishWheel();
      if(!pointer){const g=b.contact;b.contactTimer=setTimeout(()=>{if(active===b&&b.contact===g&&!g.axis)b.cancel();},650);}
    };
    b.handleWheel=event=>{
      record(b,'wheel',event,'wheel-start');
      if(event.ctrlKey||event.metaKey){b.lastDecision='pinch-or-modifier';return;}
      if(nativeControl(event)){b.lastDecision='protected-control';return;}
      if(active!==b)return;
      if(!b.enabled()){b.lastDecision='disabled';return;}
      if(!anchor(b)){b.lastDecision='zero-width';return;}
      const unit=event.deltaMode===1?16:event.deltaMode===2?b.width:1,rawDX=(event.deltaX||event.shiftKey&&event.deltaY||0)*unit,dy=(event.shiftKey&&!event.deltaX?0:event.deltaY||0)*unit;
      if(!Number.isFinite(rawDX)||!rawDX){b.lastDecision='no-horizontal-delta';return;}
      if(!b.wheel&&Math.abs(rawDX)<Math.abs(dy)*.8){b.lastDecision='vertical-wheel';return;}
      const dx=window.FamilyGalleryInput?.wheelDelta?.(rawDX)??rawDX;
      if(!Number.isFinite(dx)||!dx){b.lastDecision='invalid-mapped-delta';return;}
      prevent(event);blockClick(b);
      const sample=wheelSample(stage,dx);
      if(sample.ignore){b.lastDecision='wheel-momentum-ignored';if(b.wheel){clearTimeout(b.wheelTimer);b.wheelTimer=setTimeout(()=>{if(active===b)finishWheel();},80);}return;}
      if(sample.replace&&b.wheel)b.wheel.dx=0;
      if(b.contact){
        // Wheel input proves a new owner. Finish a real horizontal finger
        // stroke, while making the newly reserved wheel visible to whenIdle.
        b.wheel={dx:0,episode:sample.episode};const g=endContact(),threshold=Math.max(32,Math.min(56,b.width*.06));
        navigate(g?.axis==='x'&&Math.abs(g.dx)>=threshold?Math.sign(g.dx):0);
      }
      if(b.wheel?.dx&&sample.split){
        const previous=b.wheel;b.wheel={dx:0,episode:sample.episode};clearTimeout(b.wheelTimer);finishWheelEpisode(stage,previous.episode);navigate(Math.sign(previous.dx),'wheel');
      }
      if(active!==b)return;b.wheel||={dx:0,episode:sample.episode};b.wheel.dx+=dx;
      b.lastDecision='wheel-owned';
      // Pad paint uses physical CSS translation, separately from its already
      // calibrated navigation action. Screen-touch painting stays on v11's
      // existing finger-following rail path.
      viewport.scrollLeft=b.width;
      const x=Math.max(-b.width,Math.min(b.width,b.wheel.dx));
      for(const pane of viewport.children){pane.style.willChange='transform';pane.style.transform='translateX('+x+'px)';}
      clearTimeout(b.wheelTimer);b.wheelTimer=setTimeout(()=>{if(active===b)finishWheel();},80);
    };
    bindStage(stage);
    // Browser scroll events are deliberately observational only. The rail is
    // not horizontally scrollable by the browser, even for declined inputs.
    if(typeof ResizeObserver!=='undefined'){b.resize=new ResizeObserver(()=>{if(active===b)anchor(b);});b.resize.observe(viewport);}
    return true;
  }
  function diagnostics(stage){const b=active?.stage===stage?active:null;return {mounted:Boolean(b),enabled:Boolean(b?.enabled()),lastDecision:b?.lastDecision||'unmounted',lastEvent:b?.lastEvent||'none',protectedMatch:b?.protectedMatch||null,phase:b?.contact?(b.contact.axis==='x'?'horizontal':b.contact.axis==='y'?'vertical':'contact-pending'):b?.wheel?'wheel':'idle',pointer:b?.contact?.pointerId!=null,touch:b?.contact?.touchId!=null||Boolean(b?.contact?.group),wheel:Boolean(b?.wheel),width:b?.width||0,lastInput:stage?.getAttribute?.('data-gallery-last-input')||'none',lastAction:stage?.getAttribute?.('data-gallery-last-action')||'none'};}
  window.FamilyPhotoNative={version:13,mount,reset,has,claim,note,supported,diagnostics,wheelSample,finishWheelEpisode,clearWheelEpisode,preview:stage=>active?.stage===stage?active.previewImage:null,isActive:stage=>active?.stage===stage&&inputActive(active),whenIdle:stage=>active?.stage===stage&&inputActive(active)?new Promise(resolve=>active.idle.add(resolve)):null};
})();
