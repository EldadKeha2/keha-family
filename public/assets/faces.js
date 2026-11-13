(() => {
  'use strict';
  const I=window.FamilyI18n,tr=(he,en)=>I.isEnglish?en:he;
  const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normalizeName=value=>String(value??'').normalize('NFKD').replace(/[\u0591-\u05c7'"׳״]/g,'').replace(/\s+/g,' ').toLowerCase().trim();
  const choices='[data-face-person],[data-face-add]';
  const labels=new Map();let current=null,retained=null,serial=0,geometry=null,touchUntil=0;
  const controlRoots=['toolbar','missingNote','reviewButton','reviewStatus','regionsButton','regionsNote'];
  function releaseControls(){if(retained){for(const key of controlRoots)retained.controls[key]?.remove();retained=null;}}
  const remember=(id,faces,item,detectedFaces=labels.get(id)?.detectedFaces||[],ignoredFaces=labels.get(id)?.ignoredFaces||[],unassignedFaces=labels.get(id)?.unassignedFaces||[])=>{labels.set(id,{faces,detectedFaces,ignoredFaces,unassignedFaces,time:Date.now(),tagsRevision:item?.tagsRevision,photoRevision:item?.photoRevision||'original',reviewed:Boolean(item?.faceSummary?.reviewed)});if(labels.size>128)labels.delete(labels.keys().next().value);};
  const helpers=()=>geometry||=import('./face-geometry.mjs?v=11');
  const uuid=()=>crypto.randomUUID?crypto.randomUUID().replaceAll('-',''):[...crypto.getRandomValues(new Uint8Array(16))].map(byte=>byte.toString(16).padStart(2,'0')).join('');
  const touchMode=event=>event?.pointerType?['touch','pen'].includes(event.pointerType):event?.sourceCapabilities?.firesTouchEvents||Date.now()<touchUntil||matchMedia('(hover:none), (max-width:700px)').matches;
  // Editing capabilities belong to the device, not its most recent pointer.
  // Windows apps can report hover:none and a coarse pointer on touch laptops.
  const desktopResize=()=>{
    const nav=window.navigator||{},ua=nav.userAgent||'';
    const mobile=nav.userAgentData?.mobile===true||/Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(ua)||(/Macintosh/i.test(ua)&&nav.maxTouchPoints>1);
    return !mobile&&(/Windows/i.test(ua)||nav.userAgentData?.platform==='Windows'||!matchMedia('(max-width:700px)').matches);
  };
  const live=c=>Boolean(c&&current===c&&c.stage._familyFaceContext===c&&!c.events.signal.aborted);
  const imageWidth=image=>image.naturalWidth||image.width;
  const imageHeight=image=>image.naturalHeight||image.height;
  const photoName=face=>face.person?I.personName(face.person):'';
  const profileFor=face=>{const person=window.FamilyApp?.getPerson?.(face.personId||face.person?.id);return person&&!person.extra&&!face.person?.extra?person:null;};
  function nameHTML(face,links=true){
    const profile=links&&profileFor(face),name=safe(photoName(face));
    return profile?`<a class="face-profile-link" data-face-profile href="#person/${encodeURIComponent(profile.id)}" dir="auto" aria-label="${safe(tr('פתיחת הפרופיל של ','Open the profile of ')+photoName(face))}">${name}</a>`:`<span dir="auto">${name}</span>`;
  }
  function bindProfile(c,host,face){
    const profile=profileFor(face);if(!profile||c.adapter)return;
    host.querySelector('[data-face-profile]').addEventListener('click',event=>{
      if(event.button>0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
      event.preventDefault();event.stopPropagation();if(live(c)&&profileFor(face))window.FamilyApp.openPerson(profile.id);
    });
  }
  async function request(path,options={}){
    const response=await I.fetch(path,{cache:'no-store',...options,headers:{...(options.body?{'Content-Type':'application/json','X-Family-Token':window.FAMILY_API_TOKEN}:{}),...options.headers}});
    let result;try{result=await response.json();}catch{throw Error(tr('לא התקבל אישור מהשרת. נסו שוב.','No confirmation was received. Please try again.'));}
    if(!response.ok)throw Error(I.error(result.error)||tr('תיוג הפנים לא נשמר.','The face tag was not saved.'));return result;
  }
  function announce(c,message){if(live(c))c.status.textContent=message;}
  function changed(c,result){
    if(result.unassignedFaces)c.retained=result.unassignedFaces.map(face=>({...face,id:c.retained.find(previous=>c.geom.sameRegion(previous.rect,face.rect))?.id||c.detected.find(previous=>c.geom.sameRegion(previous.rect,face.rect))?.id||uuid()}));
    if(c.adapter){c.item={...c.item,...result.item};c.reviewed=Boolean(c.item.faceSummary?.reviewed);}else window.dispatchEvent(new CustomEvent('family-media-changed',{detail:result}));
  }
  function closePopup(c){
    clearTimeout(c.labelTimer);c.labelTimer=null;const popup=c.popup;c.popup=null;c.active=null;popup?.remove();if(c.selection)c.selection.hidden=true;c.adjust=false;c.drag=null;c.resizeDrag=null;c.stage.classList.remove('face-adjusting','face-resizing');if(c.guide)c.guide.hidden=true;
  }
  const sameTabFace=(c,a,b)=>a.id===b.id||c.geom.sameRegion(a.rect,b.rect);
  function tabFaces(c){
    // Saving moves named faces ahead of detections in the ordinary list. Keep
    // this session's order, including empty slots for faces removed meanwhile.
    c.tabFaces=(c.tabFaces||[]).map(previous=>c.faces.find(face=>sameTabFace(c,face,previous))||previous);
    for(const face of c.faces)if(!c.tabFaces.some(previous=>sameTabFace(c,face,previous)))c.tabFaces.push(face);
    return c.tabFaces;
  }
  function paintTabFace(c){
    for(const button of c.buttons?.children||[]){const face=c.faces.find(face=>face.id===button.dataset.faceId);button.classList.toggle('face-tab-current',Boolean(c.tabFace&&face&&sameTabFace(c,face,c.tabFace)));}
    const next=c.queuedFace&&c.faces.find(face=>!face.person&&sameTabFace(c,face,c.queuedFace));
    if(c.queuedFace&&!next)c.queuedFace=null;
    if(c.advanceButton){c.advanceButton.hidden=!next||Boolean(c.popup)||c.saving||c.reviewSaving||c.adjust;if(next){c.queuedFace=next;const area=imageArea(c);Object.assign(c.advanceButton.style,{left:(next.rect.x+next.rect.width/2)*100+'%',top:Math.min(next.rect.y+next.rect.height,1-30/Math.max(1,area.height))*100+'%'});}}
  }
  function rememberTabFace(c,face){
    if(!desktopResize())return;
    c.tabFace=face;const order=tabFaces(c),index=order.findIndex(previous=>sameTabFace(c,previous,face));
    if(index<0)order.push(face);else order[index]=face;paintTabFace(c);
  }
  function stopTabFaces(c){c.tabFace=null;c.tabFaces=null;c.queuedFace=null;c.shiftFaces=null;paintTabFace(c);}
  function focusTabFace(c,face){
    const button=[...c.buttons.children].find(node=>node.dataset.faceId===face.id);
    button?.focus({preventScroll:true});button?.scrollIntoView?.({block:'nearest',inline:'nearest'});
  }
  function revealFace(c,face){
    const button=[...c.buttons.children].find(node=>node.dataset.faceId===face.id);
    button?.scrollIntoView?.({block:'nearest',inline:'nearest'});
  }
  function advanceUnlabelledFace(c,saved){
    if(c.shiftFaces){
      while(c.shiftFaces.length){
        const candidate=c.shiftFaces.shift(),next=c.faces.find(face=>sameTabFace(c,face,candidate));if(!next)continue;
        closePopup(c);openPicker(c,next);return true;
      }
      c.shiftFaces=null;return false;
    }
    const order=tabFaces(c),index=order.findIndex(face=>sameTabFace(c,face,saved));
    for(let offset=1;offset<order.length;offset++){
      const candidate=order[(index+offset+order.length)%order.length],next=c.faces.find(face=>!face.person&&sameTabFace(c,face,candidate));
      if(!next||sameTabFace(c,next,saved))continue;
      closePopup(c);c.queuedFace=next;c.tabFace=next;paintTabFace(c);revealFace(c,next);openQueuedFace(c);
      announce(c,tr('הפנים הבאות ללא שם מוכנות לתיוג.','The next unlabelled face is ready to tag.'));return true;
    }
    return false;
  }
  function openQueuedFace(c){
    if(!live(c)||!c.queuedFace||c.advanceButton?.hidden||c.popup||c.saving||c.reviewSaving||c.adjust||c.resizeDrag||!c.dialog.open||c.dialog.closest('[hidden],[inert],[aria-hidden="true"]')||!c.stage.getClientRects().length||(c.adapter&&!c.adapter.enabled()))return false;
    const next=c.faces.find(face=>!face.person&&sameTabFace(c,face,c.queuedFace));if(!next)return false;
    openPicker(c,next);return true;
  }
  function canStartFaceSequence(c,target){
    if(!live(c)||!desktopResize()||!c.dialog.open||c.dialog.closest('[hidden],[inert],[aria-hidden="true"]')||!c.stage.getClientRects().length||c.saving||c.reviewSaving||c.adjust||c.resizeDrag||c.popup?.classList.contains('face-picker')||(c.adapter&&!c.adapter.enabled()))return false;
    const activeDialog=target?.closest?.('dialog[open]')||document.activeElement?.closest?.('dialog[open]')||[...document.querySelectorAll('dialog[open]')].at(-1);
    return !activeDialog||activeDialog===c.dialog;
  }
  function startFaceSequence(c,target){
    if(!canStartFaceSequence(c,target))return false;
    const first=c.faces.find(face=>!face.person)||c.faces[0];if(!first)return false;
    stopTabFaces(c);if(first.person)c.shiftFaces=c.faces.slice(1);
    focusTabFace(c,first);openPicker(c,first);return true;
  }
  function moveTabFace(c,event){
    if(!live(c)||!c.tabFace||!desktopResize()||!c.dialog.open||c.dialog.closest('[hidden],[inert],[aria-hidden="true"]')||!c.stage.getClientRects().length||c.adjust||c.resizeDrag||c.reviewSaving||(c.adapter&&!c.adapter.enabled()))return;
    const target=event.target;
    const activeDialog=target?.closest?.('dialog[open]')||document.activeElement?.closest?.('dialog[open]')||[...document.querySelectorAll('dialog[open]')].at(-1);
    if(activeDialog&&activeDialog!==c.dialog)return;
    // Results and editing buttons keep their native Tab order. ArrowDown from
    // the search field still reaches the name choices before Enter saves one.
    if(target!==c.popup?.querySelector('input')&&target!==document.body&&target!==c.stage&&target!==c.scroller&&!c.buttons.contains(target)&&!c.selection.contains(target))return;
    if(!c.faces.length)return;
    event.preventDefault();event.stopPropagation();if(c.saving)return;c.shiftFaces=null;
    const order=tabFaces(c),index=order.findIndex(face=>sameTabFace(c,face,c.tabFace)),step=event.shiftKey?-1:1;
    for(let offset=1;offset<=order.length;offset++){
      const candidate=order[(index+step*offset+order.length*2)%order.length],face=c.faces.find(face=>sameTabFace(c,face,candidate));
      if(!face)continue;
      focusTabFace(c,face);openPicker(c,face);
      announce(c,tr('פנים ','Face ')+(order.filter(entry=>c.faces.some(face=>sameTabFace(c,face,entry))).findIndex(entry=>sameTabFace(c,entry,face))+1)+tr(' מתוך ',' of ')+c.faces.length);return;
    }
  }
  function keepLabel(c){if(c.popup?.dataset.timedLabel)return;clearTimeout(c.labelTimer);c.labelTimer=null;}
  function dismissLabelSoon(c){
    if(c.labelTimer||!c.popup?.classList.contains('face-name'))return;const bubble=c.popup;
    c.labelTimer=setTimeout(()=>{c.labelTimer=null;if(live(c)&&c.popup===bubble&&!bubble.contains(document.activeElement))closePopup(c);},250);
  }
  function dispose(c,{preserveControls=false}={}){
    clearTimeout(c.detectionTimer);
    c.resolvePaint?.();
    window.FamilyPhotoNative?.reset(c.stage);
    cancelPress(c);
    if(current===c)current=null;if(c.stage._familyFaceContext===c)delete c.stage._familyFaceContext;c.events.abort();c.resize?.disconnect();clearTimeout(c.labelTimer);clearAnnotation(c,true);c.popup?.remove();c.layer?.remove();c.labelList?.remove();c.guide?.remove();c.status?.remove();
    if(preserveControls&&!c.adapter){releaseControls();retained={stage:c.stage,dialog:c.dialog,reviewLabel:c.reviewLabel,zoomEnabled:c.zoomEnabled,controls:Object.fromEntries([...controlRoots,'regionsText','reviewText'].map(key=>[key,c[key]]))};}
    else for(const key of controlRoots)c[key]?.remove();
    c.scroller?.replaceWith(c.image);c.stage.classList.remove('has-face-layer','face-adjusting','face-resizing','has-face-zoom','face-label-list-active','face-photo-enlarged');window.FamilyPhotoViewerLayout?.faceControls(null,c);window.dispatchEvent(new CustomEvent('family-face-viewer',{detail:{active:false}}));
  }
  function clear({preserveControls=false,item=null}={}){
    if(current)dispose(current,{preserveControls});
    if(!preserveControls){releaseControls();return;}
    // Photo controls stay mounted while the image and its editor change.
    // Old listeners are aborted; the next controller binds these same nodes.
    const controls=retained?.controls;if(!controls)return;
    if(controls.reviewButton){controls.reviewButton.hidden=!(item?.scope==='gallery'||item?.collections?.includes('gallery'));controls.reviewButton.disabled=false;controls.reviewButton.setAttribute('aria-busy','false');controls.reviewButton.setAttribute('aria-pressed',String(Boolean(item?.faceSummary?.reviewed)));}
    if(controls.reviewStatus){controls.reviewStatus.hidden=true;controls.reviewStatus.textContent='';}
    if(controls.regionsButton)controls.regionsButton.setAttribute('aria-pressed','false');
    if(controls.regionsNote)controls.regionsNote.hidden=true;
    if(controls.toolbar){controls.toolbar.querySelector('[data-face-zoom-level]').textContent='100%';controls.toolbar.querySelector('[data-face-zoom-out]').disabled=true;controls.toolbar.querySelector('[data-face-zoom-in]').disabled=false;controls.toolbar.querySelector('[data-face-zoom-reset]').disabled=true;}
  }
  function reconcileControls(c){
    // These controls live outside the photo stage. Reconcile them as well as
    // the pixels, so an interrupted refresh cannot leave an older copy behind.
    const owned=new Set([c.toolbar,c.missingNote,c.reviewButton,c.reviewStatus,c.regionsButton,c.regionsNote]);
    for(const node of c.dialog.querySelectorAll('.face-zoom-toolbar,.face-missing-note,.face-review-button,.face-review-status,.face-regions-toggle,.face-regions-note'))if(!owned.has(node))node.remove();
  }
  function viewport(){const v=window.visualViewport;return {left:v?.offsetLeft||0,top:v?.offsetTop||0,width:Math.min(v?.width||innerWidth,document.documentElement.clientWidth||innerWidth),height:v?.height||innerHeight,scale:Number.isFinite(v?.scale)&&v.scale>0?v.scale:1};}
  function imageArea(c){
    const r=c.image.getBoundingClientRect(),ratio=imageWidth(c.image)/imageHeight(c.image);let width=r.width,height=r.height;
    if(width/height>ratio)width=height*ratio;else height=width/ratio;
    return {x:r.left+(r.width-width)/2,y:r.top+(r.height-height)/2,width,height};
  }
  function screenFace(c,face){const image=imageArea(c),r=face.rect;return {x:image.x+r.x*image.width,y:image.y+r.y*image.height,width:r.width*image.width,height:r.height*image.height};}
  function place(c){
    if(!live(c)||!imageWidth(c.image))return;const image=imageArea(c),stage=(c.surface||c.stage).getBoundingClientRect();
    Object.assign(c.hits.style,{left:(image.x-stage.left)+'px',top:(image.y-stage.top)+'px',width:image.width+'px',height:image.height+'px'});
    placeAnnotations(c,image);
    if(c.active&&!c.selection.hidden)Object.assign(c.selection.style,{left:c.active.rect.x*100+'%',top:c.active.rect.y*100+'%',width:c.active.rect.width*100+'%',height:c.active.rect.height*100+'%'});
    if(c.popup&&c.active){
      // Native pinch zoom enlarges the document, including fixed elements.
      // Lay out the popup in screen-sized CSS pixels, then counter-scale only
      // the popup. Photo pixels, face coordinates and accessibility text sizes
      // keep their existing zoom behavior.
      const v=viewport(),scale=v.scale,visible={width:v.width*scale,height:v.height*scale};
      const onScreen=rect=>({x:(rect.x-v.left)*scale,y:(rect.y-v.top)*scale,width:rect.width*scale,height:rect.height*scale});
      Object.assign(c.popup.style,{transform:scale===1?'none':`scale(${1/scale})`,maxWidth:Math.max(0,visible.width-16)+'px',maxHeight:Math.max(0,visible.height-16)+'px'});
      const r=c.popup.getBoundingClientRect(),panel={width:r.width*scale||270,height:r.height*scale||180},selected=onScreen(screenFace(c,c.active));
      const faceOnScreen=c.popup.classList.contains('face-picker')?c.geom.labelFaceBounds(selected):selected;
      let p=c.geom.popoverPosition(faceOnScreen,panel,visible);
      if(c.popup.classList.contains('face-picker')){
        Object.assign(c.popup.style,{maxWidth:p.width+'px',maxHeight:p.maxHeight+'px'});
        const fitted=c.popup.getBoundingClientRect();
        p=c.geom.popoverPosition(faceOnScreen,{width:fitted.width*scale,height:fitted.height*scale},visible);
      }
      if(c.popup.classList.contains('face-name')){
        const face=onScreen(screenFace(c,{...c.active,rect:annotationRect(c,c.active)})),faces=annotationFaces(c,image).map(rect=>onScreen({...rect,x:rect.x+image.x,y:rect.y+image.y}));
        const placed=c.geom.layoutFaceLabels([{width:panel.width,height:panel.height,face}],{...visible,faces});
        if(placed){p.x=placed[0].x;p.y=placed[0].y;}
      }
      Object.assign(c.popup.style,{left:(v.left+p.x/scale)+'px',top:(v.top+p.y/scale)+'px',maxHeight:p.maxHeight+'px',maxWidth:p.width+'px'});
    }
  }
  function visibleFaces(c,reviewed=false){
    const dismissed=c.pendingDismiss,unassigned=c.pendingUnassign,saved=c.saved.filter(face=>(!dismissed||(dismissed.person?face.id!==dismissed.id:!c.geom.labelledRegion(dismissed.rect,face.rect)))&&(!unassigned||face.id!==unassigned.id)),ignored=dismissed?[...c.ignored,dismissed.rect]:c.ignored;
    const detected=[...c.detected];for(const face of [...c.retained,...(unassigned?[{id:unassigned.id,rect:unassigned.rect}]:[])])if(!detected.some(previous=>c.geom.sameRegion(previous.rect,face.rect)))detected.push(face);
    return c.geom.mergeFaces(saved,(reviewed?[]:detected).filter(face=>!ignored.some(rect=>c.geom.labelledRegion(rect,face.rect))));
  }
  const annotationRect=(c,face)=>c.geom.annotationFaceRect(face,c.saved);
  function annotationFaces(c,image){return visibleFaces(c).map(face=>{const r=annotationRect(c,face);return {x:r.x*image.width,y:r.y*image.height,width:r.width*image.width,height:r.height*image.height};});}
  function clearAnnotation(c,force=false){
    if(c.annotationTimer&&!force)return;clearTimeout(c.annotationTimer);c.annotationTimer=null;c.annotationFace=null;if(c.annotationTarget)c.annotationTarget.hidden=true;
    for(const entry of c.annotationNodes||[])for(const node of [entry.node,entry.marker,entry.line])node.classList.remove('face-annotation-active');
  }
  function renderAnnotationHighlight(c){
    const face=c.annotationFace;if(!face||!c.annotationTarget)return;c.annotationTarget.hidden=false;
    const r=annotationRect(c,face);Object.assign(c.annotationTarget.style,{left:r.x*100+'%',top:r.y*100+'%',width:r.width*100+'%',height:r.height*100+'%'});
    for(const entry of c.annotationNodes)for(const node of [entry.node,entry.marker,entry.line])node.classList.toggle('face-annotation-active',entry.face.id===face.id);
  }
  function highlightAnnotation(c,face,timed=false){
    if(!live(c)||!c.annotationNodes?.some(entry=>entry.face.id===face.id))return;
    if(!timed&&c.annotationFace?.id===face.id&&c.annotationTimer){renderAnnotationHighlight(c);return;}
    clearAnnotation(c,true);c.annotationFace=face;renderAnnotationHighlight(c);
    if(timed){c.annotationTarget.scrollIntoView?.({block:'nearest',inline:'nearest',behavior:'smooth'});c.annotationTimer=setTimeout(()=>clearAnnotation(c,true),2000);}
  }
  function placeAnnotations(c,image){
    const entries=c.annotationNodes||[];if(!entries.length){c.labelList.hidden=true;c.stage.classList.remove('face-label-list-active');return;}
    const measureKey=JSON.stringify([image.width,getComputedStyle(entries[0].node).fontSize]);
    if(c.annotationMeasurements?.key!==measureKey){
      const sizes=entries.map(()=>[]),limit=Math.max(1,Math.min(200,image.width-2));
      for(const {node} of entries){node.style.width='max-content';node.style.maxWidth=limit+'px';}
      entries.forEach(({node},i)=>{const r=node.getBoundingClientRect();sizes[i].push({width:r.width,height:r.height});});
      for(const ratio of [.72,.52]){
        entries.forEach(({node},i)=>{node.style.width=Math.min(limit,sizes[i][0].width,Math.max(58,sizes[i][0].width*ratio))+'px';});
        entries.forEach(({node},i)=>{const r=node.getBoundingClientRect();if(!sizes[i].some(size=>size.width===r.width&&size.height===r.height))sizes[i].push({width:r.width,height:r.height});});
      }
      c.annotationMeasurements={key:measureKey,sizes};
    }
    const boxes=entries.map(({face},i)=>{const r=annotationRect(c,face);return {...c.annotationMeasurements.sizes[i][0],variants:c.annotationMeasurements.sizes[i],face:{x:r.x*image.width,y:r.y*image.height,width:r.width*image.width,height:r.height*image.height}};}),faces=annotationFaces(c,image);
    const key=JSON.stringify([image.width,image.height,boxes,faces]);
    if(c.annotationLayout?.key!==key){const bounds={...image,faces},layout=c.geom.layoutFaceLabels(boxes,bounds),legend=entries.length>0&&!layout;c.annotationLayout={key,layout,legend,markers:legend?c.geom.layoutFaceLabels(boxes.map(box=>({width:18,height:18,face:box.face})),{...bounds,partial:true}):null};}
    const {layout,legend,markers}=c.annotationLayout;
    c.labelList.hidden=!legend;c.stage.classList.toggle('face-label-list-active',legend);
    for(let i=0;i<entries.length;i++){
      const {node,marker,line}=entries[i],box=legend?markers?.[i]:layout?.[i];
      if(node.parentNode!==(legend?c.labelList:c.annotations))(legend?c.labelList:c.annotations).append(node);
      node.style.left=legend?'':box.x+'px';node.style.top=legend?'':box.y+'px';
      node.style.width=legend?'max-content':box.width+'px';node.style.maxWidth=legend?Math.min(240,image.width)+'px':box.width+'px';
      marker.hidden=!legend||!box;
      if(legend&&box)Object.assign(marker.style,{left:box.x+'px',top:box.y+'px'});
      line.hidden=!box?.leader;if(!box?.leader)continue;
      const {from,to}=box.leader,x=from.x,y=from.y,dx=to.x-x,dy=to.y-y;
      Object.assign(line.style,{left:x+'px',top:(y-.75)+'px',width:Math.hypot(dx,dy)+'px',transform:'rotate('+Math.atan2(dy,dx)+'rad)'});
    }
  }
  function fitZoom(c){
    if(!c.surface)return;const maxHeight=(c.dialog.classList.contains('mobile-photo-frame')?c.scroller.clientHeight:parseFloat(getComputedStyle(c.scroller).maxHeight))||innerHeight*.48;
    const scale=Math.min(1,c.scroller.clientWidth/imageWidth(c.image),maxHeight/imageHeight(c.image));
    c.base={width:imageWidth(c.image)*scale,height:imageHeight(c.image)*scale};
    Object.assign(c.surface.style,{width:c.base.width*c.zoom+'px',height:c.base.height*c.zoom+'px'});place(c);
  }
  function setZoom(c,value){
    if(c.saving)return;const before=imageArea(c),r=c.scroller.getBoundingClientRect(),anchor={x:r.left+c.scroller.clientWidth/2,y:r.top+c.scroller.clientHeight/2};
    const p={x:(anchor.x-before.x)/before.width,y:(anchor.y-before.y)/before.height};
    closePopup(c);c.zoom=value;fitZoom(c);const after=imageArea(c);
    c.scroller.scrollLeft+=after.x+p.x*after.width-anchor.x;c.scroller.scrollTop+=after.y+p.y*after.height-anchor.y;
    c.stage.classList.toggle('face-photo-enlarged',value>1);
    if(value>1&&c.item.previewSrc&&!c.originalLoaded){
      const pending=c.originalImage||=window.FamilyPhotoPresentation?.prepare(c.item,'high',true);
      pending?.then(()=>{if(!live(c)||c.zoom<=1||c.originalLoaded)return;c.originalLoaded=true;c.image.addEventListener('load',()=>{if(live(c)){fitZoom(c);place(c);}},{once:true,signal:c.events.signal});c.image.src=c.item.src;}).catch(()=>announce(c,tr('לא ניתן לטעון כרגע את המקור המלא.','The full original is temporarily unavailable.')));
    }
    c.toolbar.querySelector('[data-face-zoom-level]').textContent=Math.round(value*100)+'%';c.toolbar.querySelector('[data-face-zoom-out]').disabled=value===1;c.toolbar.querySelector('[data-face-zoom-in]').disabled=value===8;
    c.toolbar.querySelector('[data-face-zoom-reset]').disabled=value===1;place(c);window.FamilyPhotoViewerLayout?.sync();window.FamilyMedia?.refreshPhotoPresentation?.();
  }
  function setupZoom(c){
    c.zoom=1;c.scroller=document.createElement('div');c.scroller.className='face-photo-scroll';c.scroller.dir='ltr';c.scroller.tabIndex=0;c.scroller.setAttribute('aria-label',tr('התמונה לתיוג. בהגדלה אפשר לגלול לכל אזור.','Photo for tagging. Scroll to any area when enlarged.'));
    c.surface=document.createElement('div');c.surface.className='face-photo-surface';c.surface.append(c.image,c.layer);c.scroller.append(c.surface);c.stage.append(c.scroller,c.guide,c.labelList);c.stage.classList.add('has-face-zoom');
    // Dense group-photo names belong below the controls, outside the fixed frame.
    if(c.dialog.classList.contains('mobile-photo-frame'))c.dialog.querySelector('#mediaTagPanel')?.before(c.labelList);
    if(!c.toolbar){
      c.toolbar=document.createElement('div');c.toolbar.className='face-zoom-toolbar';c.toolbar.setAttribute('role','group');c.toolbar.setAttribute('aria-label',tr('הגדלה לדיוק תיוג פנים','Zoom for precise face tagging'));
      c.toolbar.innerHTML=`<span class="face-zoom-help">${tr('פנים קטנות? הגדילו לתּיוג מדויק','Small faces? Zoom in to tag precisely')}</span><div><button type="button" data-face-zoom-out disabled aria-label="${tr('הקטנת התמונה','Zoom out')}">−</button><output data-face-zoom-level aria-live="polite">100%</output><button type="button" data-face-zoom-in aria-label="${tr('הגדלת התמונה','Zoom in')}">＋</button><button type="button" data-face-zoom-reset disabled>${tr('התאמה למסך','Fit photo')}</button></div>`;
      c.toolbar.insertBefore(c.regionsButton,c.toolbar.firstChild);c.toolbar.append(c.regionsNote);c.stage.before(c.toolbar);
    }
    const levels=[1,1.5,2,3,4,6,8],options={signal:c.events.signal};
    c.toolbar.querySelector('[data-face-zoom-in]').addEventListener('click',()=>setZoom(c,levels[Math.min(levels.length-1,levels.indexOf(c.zoom)+1)]),options);
    c.toolbar.querySelector('[data-face-zoom-out]').addEventListener('click',()=>setZoom(c,levels[Math.max(0,levels.indexOf(c.zoom)-1)]),options);
    c.toolbar.querySelector('[data-face-zoom-reset]').addEventListener('click',()=>setZoom(c,1),options);
    c.scroller.addEventListener('scroll',()=>place(c),{passive:true,signal:c.events.signal});
    c.scroller.addEventListener('pointerdown',event=>{c.scrollStart={x:c.scroller.scrollLeft,y:c.scroller.scrollTop};},{passive:true,signal:c.events.signal});
    fitZoom(c);
  }
  function setupRegions(c,on){
    c.showRegions=false;
    if(!c.regionsButton){
      c.regionsButton=document.createElement('button');c.regionsButton.type='button';c.regionsButton.className='face-regions-toggle';
      c.regionsButton.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="3" width="18" height="18" rx="5" stroke-dasharray="3 3"/><circle cx="12" cy="10" r="3"/><path d="M7 18a5 5 0 0 1 10 0"/></svg>';
      c.regionsText=document.createElement('span');c.regionsText.className='face-regions-text';c.regionsButton.append(c.regionsText);
      c.regionsNote=document.createElement('span');c.regionsNote.className='face-regions-note';c.regionsNote.hidden=true;c.regionsNote.id='faceRegionsNote-'+c.serial;c.regionsNote.setAttribute('role','status');c.regionsButton.setAttribute('aria-describedby',c.regionsNote.id);
    }
    if(!c.regionsButton.isConnected){if(c.reviewHost)c.reviewHost.append(c.regionsButton,c.regionsNote);else{c.stage.before(c.regionsButton);c.stage.before(c.regionsNote);}}
    on(c.regionsButton,'click',()=>{if(!live(c)||(c.adapter&&!c.adapter.enabled()))return;closePopup(c);c.showRegions=!c.showRegions;paint(c);});
  }
  function paint(c){
    if(!live(c)||!c.buttons)return;reconcileControls(c);c.faces=visibleFaces(c,c.reviewed);if(c.reviewButton){const label=c.reviewed?tr('כל הפרצופים תויגו · לחצו לביטול האישור','All faces tagged · Click to undo confirmation'):tr('אישור שכל הפרצופים תויגו','Confirm all faces are tagged');c.reviewButton.setAttribute('aria-label',label);c.reviewButton.title=label+' '+tr('(מקש קיצור: "\\")','(Shortcut key: "\\")');c.reviewButton.setAttribute('aria-pressed',String(c.reviewed));if(c.reviewText)c.reviewText.textContent=c.reviewed?tr('כל הפרצופים תויגו','All faces tagged'):tr('אישור תיוג מלא','Confirm all tagged');}
    const buttons=new Map([...c.buttons.children].map(node=>[node.dataset.faceId,node]));
    if(c.regionsButton){
      const label=c.showRegions?tr('הסתר אזורים מתויגים','Hide tagged areas'):tr('הצג אזורים מתויגים','Show tagged areas'),count=c.faces.filter(face=>face.person).length;
      c.regionsButton.setAttribute('aria-label',label);c.regionsButton.setAttribute('aria-pressed',String(c.showRegions));c.regionsButton.title=label;c.regionsText.textContent=label;c.regionsNote.hidden=!c.showRegions;
      c.regionsNote.textContent=!c.showRegions?'':count?(count===1?tr('אזור מתויג אחד','1 tagged area'):count+tr(' אזורים מתויגים',' tagged areas'))+tr(' · לחצו על מסגרת לעריכת התיוג.',' · Select a frame to edit its tag.'):tr('אין עדיין אזורים מתויגים בתמונה.','There are no tagged areas in this photo yet.');
    }
    for(const [index,face]of c.faces.entries()){
      const existing=buttons.get(face.id),button=existing||document.createElement('button');buttons.delete(face.id);button.type='button';button.className='face-hit';if(c.highlightMissing&&!face.person)button.classList.add('face-missing');if(c.showRegions&&face.person)button.classList.add('face-tagged-region');button.dataset.faceId=face.id;button.setAttribute('aria-label',face.person?(c.showRegions?tr('הסרת התיוג של ','Remove tag for '):tr('פנים בתמונה: ','Face in photo: '))+photoName(face):tr('תיוג הפנים האלה','Tag this face'));button.title=c.showRegions&&face.person?tr('הסרת התיוג של ','Remove tag for ')+photoName(face):'';
      Object.assign(button.style,{left:face.rect.x*100+'%',top:face.rect.y*100+'%',width:face.rect.width*100+'%',height:face.rect.height*100+'%'});
      if(!existing){
      const labelled=()=>c.faces.find(face=>face.id===button.dataset.faceId);
      button.addEventListener('pointerenter',event=>{const face=labelled();if(!c.showRegions&&!touchMode(event)&&face?.person&&!c.popup?.classList.contains('face-picker'))showLabel(c,face,false);},{signal:c.events.signal});
      button.addEventListener('pointerleave',event=>{if(!touchMode(event)&&c.popup?.classList.contains('face-name')&&!c.popup.contains(event.relatedTarget))dismissLabelSoon(c);},{signal:c.events.signal});
      button.addEventListener('focus',()=>{const face=labelled();if(!c.press&&!c.showRegions&&face?.person&&!c.popup?.classList.contains('face-picker'))showLabel(c,face,touchMode());},{signal:c.events.signal});
      button.addEventListener('blur',event=>{if(!c.popup?.dataset.timedLabel&&!c.popup?.contains(event.relatedTarget)&&c.popup?.classList.contains('face-name'))closePopup(c);},{signal:c.events.signal});
      }
      if(c.buttons.children[index]!==button)c.buttons.insertBefore(button,c.buttons.children[index]||null);
    }
    for(const node of buttons.values())node.remove();
    if(c.missingNote)c.missingNote.hidden=c.reviewed;
    if(c.missingNote&&c.reviewed)c.missingNote.textContent='';
    else if(c.missingNote){const count=c.faces.filter(face=>!face.person).length;c.missingNote.textContent=count?tr('פנים ללא תיוג: ','Faces without labels: ')+count+tr(' · לחצו על המסגרת והוסיפו שם.',' · Select a frame and add a name.'):c.faces.length?tr('כל הפנים שזוהו מתויגות ✓','All detected faces are labelled ✓'):tr('מזהים פנים בתמונה…','Finding faces in the photo…');}
    paintTabFace(c);paintAnnotations(c);place(c);if(c.initialized)window.FamilyPhotoViewerLayout?.faceControls(c);
  }
  function paintAnnotations(c){
    if(!live(c)||!c.annotations)return;c.annotations.replaceChildren();c.labelList.replaceChildren();c.annotationNodes=[];c.annotationMeasurements=null;c.annotationLayout=null;
    const options=window.FamilyPhotoDate?.overlays?.(c.item.id);if(!options?.showNames&&!options?.showAges){clearAnnotation(c,true);return;}
    for(const face of c.faces){
      if(!face.person)continue;const age=options.showAges?window.FamilyPhotoDate.ageFor(face.person,c.item):null;
      if(!options.showNames&&!age)continue;
      const node=document.createElement('div');node.className='face-visible-label';node.dataset.faceId=face.id;node.dir=I.isEnglish?'ltr':'rtl';
      const locateLabel=options.showNames?tr('הצגת הפנים של ','Locate the face of ')+photoName(face):tr('הדגשת הפנים בתמונה','Locate this face in the photo');
      node.classList.toggle('face-age-only',!options.showNames);const number=c.annotationNodes.length+1;node.innerHTML=`<button type="button" class="face-label-number" data-face-locate aria-label="${safe(locateLabel)}">${number}</button>`+(options.showNames?nameHTML(face):'')+(age?`<span class="face-visible-age" dir="auto" title="${safe(age.title)}">${safe(age.text)}</span>`:'');
      const marker=document.createElement('button');marker.type='button';marker.className='face-label-marker';marker.textContent=number;marker.hidden=true;marker.dataset.faceId=face.id;marker.setAttribute('aria-label',locateLabel);
      const line=document.createElement('span');line.className='face-label-leader';line.dataset.faceId=face.id;line.setAttribute('aria-hidden','true');
      const locate=event=>{event.preventDefault();event.stopPropagation();highlightAnnotation(c,face,true);};
      marker.addEventListener('click',locate);node.querySelector('[data-face-locate]').addEventListener('click',locate);
      for(const host of [marker,node]){host.addEventListener('pointerenter',()=>highlightAnnotation(c,face));host.addEventListener('pointerleave',()=>{if(c.annotationFace?.id===face.id)clearAnnotation(c);});host.addEventListener('focusin',()=>highlightAnnotation(c,face));host.addEventListener('focusout',event=>{if(!host.contains(event.relatedTarget)&&c.annotationFace?.id===face.id)clearAnnotation(c);});}
      if(options.showNames)bindProfile(c,node,face);c.annotations.append(line,marker,node);c.annotationNodes.push({node,face,marker,line});
    }
    if(c.annotationFace){const entry=c.annotationNodes.find(entry=>entry.face.id===c.annotationFace.id);if(entry){c.annotationFace=entry.face;renderAnnotationHighlight(c);}else clearAnnotation(c,true);}
  }
  function apply(c,faces){
    c.saved=faces;if(c.active){const updated=faces.find(face=>face.id===c.active.id);if(updated)c.active=updated;else if(c.active.person&&!c.saving)closePopup(c);}
    paint(c);
  }
  async function load(c,force=false){
    if(c.adapter){const result=await c.adapter.load();if(!live(c))return;changed(c,result);c.ignored=result.ignoredFaces||[];c.ready=true;apply(c,result.faces);return;}
    const cached=labels.get(c.item.id);
    if(!force&&cached&&cached.tagsRevision===c.item.tagsRevision&&cached.reviewed===Boolean(c.item.faceSummary?.reviewed)&&Date.now()-cached.time<30000){c.reviewed=cached.reviewed;c.retained=(cached.unassignedFaces||[]).map(face=>({...face,id:uuid()}));c.ignored=cached.ignoredFaces||[];if(!c.detected.length)c.detected=cached.detectedFaces.map(face=>({...face,id:uuid()}));apply(c,cached.faces);c.ready=true;return;}
    const result=await request('api/media/'+c.item.id+'/faces',{signal:c.events.signal});
    if(!live(c))return;const priorRevision=c.item.tagsRevision,priorReview=c.reviewed;if(result.item){c.item={...c.item,...result.item};c.reviewed=Boolean(result.item.faceSummary?.reviewed);}c.retained=(result.unassignedFaces||[]).map(face=>({...face,id:uuid()}));c.ignored=result.ignoredFaces||[];remember(c.item.id,result.faces,result.item,result.detectedFaces,c.ignored,result.unassignedFaces);if(!c.detected.length)c.detected=(result.detectedFaces||[]).map(face=>({...face,id:uuid()}));c.ready=true;c.loadError=false;apply(c,result.faces);
    if(result.item&&(result.item.tagsRevision!==priorRevision||c.reviewed!==priorReview))window.dispatchEvent(new CustomEvent('family-media-changed',{detail:{operation:'faces',scope:result.item.scope,item:result.item,faces:result.faces}}));
  }
  function showLabel(c,face,touch,feedback=false){
    if(!live(c)||!face.person||(!feedback&&c.popup?.dataset.tagFeedback&&c.active?.id===face.id))return;if(c.queuedFace)stopTabFaces(c);closePopup(c);c.active=face;
    const bubble=document.createElement('div');bubble.className='face-popover face-name';bubble.setAttribute('role','group');bubble.setAttribute('aria-label',tr('מי בתמונה','Who is in the photo'));bubble.dir=I.isEnglish?'ltr':'rtl';
    bubble.innerHTML=nameHTML(face,!c.adapter&&!feedback)+(touch&&!feedback?`<button type="button" data-face-edit aria-label="${tr('עריכת תיוג הפנים','Edit face tag')}">✎</button>`:'');if(!feedback)bindProfile(c,bubble,face);
    if(feedback||touch)bubble.dataset.timedLabel='true';if(feedback){bubble.dataset.tagFeedback='true';bubble.style.pointerEvents='none';}
    if(touch&&!feedback&&desktopResize())c.selection.hidden=false;
    bubble.addEventListener('pointerenter',()=>keepLabel(c));
    bubble.addEventListener('pointerleave',event=>{if(!touchMode(event))dismissLabelSoon(c);});
    bubble.addEventListener('focusin',()=>keepLabel(c));
    bubble.addEventListener('focusout',event=>{if(c.popup===bubble&&!bubble.contains(event.relatedTarget))closePopup(c);});
    if(!feedback){
      const bindAction=(selector,action)=>{const button=bubble.querySelector(selector);
      // Keep the label mounted from pointer press through click, including when
      // a touch browser does not transfer focus to an action button.
      button.addEventListener('pointerdown',event=>{event.preventDefault();event.stopPropagation();if(c.popup===bubble){clearTimeout(c.labelTimer);c.labelTimer=null;}});
      button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();if(live(c)&&c.popup===bubble&&(!c.adapter||c.adapter.enabled()))action();});};
      if(touch)bindAction('[data-face-edit]',()=>openPicker(c,face));
    }
    c.popup=bubble;c.dialog.append(bubble);place(c);if(feedback||touch)c.labelTimer=setTimeout(()=>{if(live(c)&&c.popup===bubble)closePopup(c);},feedback?500:2000);
  }
  function personAvatar(person){
    const summary=window.FamilyApp?.getPersonSummary?.(person.id),profile=summary?.profile!==undefined?summary.profile:person.profile;
    const initials=String(I.personName(person)||'').trim().split(/\s+/).filter(Boolean).slice(0,2).map(part=>Array.from(part)[0]).join('')||'?';
    let src=typeof profile==='string'?profile:'';
    if(/^\/media\/[a-f0-9]{32}(?:\?|$)/.test(src)&&!/[?&]thumbnail=/.test(src))src+=(src.includes('?')?'&':'?')+'thumbnail=1';
    return `<span class="face-person-avatar" aria-hidden="true"><span>${safe(initials)}</span>${src?`<img class="profile-photo" src="${safe(src)}" alt="" loading="lazy" decoding="async">`:''}</span>`;
  }
  async function results(c,query){
    const panel=c.popup;if(c.saving||!panel?.classList.contains('face-picker'))return;const sequence=++c.searchSequence,host=panel.querySelector('[data-face-results]');
    host.replaceChildren();host.setAttribute('aria-busy','true');
    try{
      const people=await (c.adapter?.findPeople||window.FamilyTags.findPeople)(query,(c.item.tags||[]).map(person=>person.id));if(!live(c)||c.saving||c.popup!==panel||sequence!==c.searchSequence)return;
      const name=String(query).trim().replace(/\s+/g,' '),key=normalizeName(name),exact=people.some(person=>[person.name,person.nameEn].filter(Boolean).some(alias=>normalizeName(alias)===key));
      host.innerHTML=people.map(person=>`<button class="face-person-option" type="button" role="option" data-face-person="${safe(person.id)}" aria-selected="${person.id===c.active?.personId}">${personAvatar(person)}<span><strong dir="auto">${safe(I.personName(person))}</strong></span></button>`).join('')||`<p class="face-no-results">${tr('לא נמצא שם מתאים. אפשר להוסיף שם חדש.','No matching name. You can add a new name.')}</p>`;
      if(key&&!exact)host.innerHTML+=`<button class="face-person-option face-add-name" type="button" role="option" data-face-add aria-selected="false"><span class="face-person-check" aria-hidden="true">＋</span><span><strong dir="auto">${tr('הוספת השם ״','Add “')}${safe(name)}${tr('״','”')}</strong></span></button>`;
      for(const button of host.querySelectorAll('[data-face-person]'))button.addEventListener('click',()=>save(c,{personId:button.dataset.facePerson}));
      host.querySelector('[data-face-add]')?.addEventListener('click',()=>save(c,{name}));place(c);
      host.setAttribute('aria-busy','false');
    }catch(error){if(live(c)&&c.popup===panel&&sequence===c.searchSequence){host.setAttribute('aria-busy','false');panel.querySelector('[data-face-status]').textContent=error.message;}}
  }
  async function openPicker(c,face,{preserveRect=false}={}){
    if(!live(c)||c.saving)return;c.queuedFace=null;if(c.advanceButton)c.advanceButton.hidden=true;closePopup(c);c.active=face;c.selection.hidden=false;rememberTabFace(c,face);
    revealFace(c,face);
    if(c.loadError){c.loadError=false;c.loading=load(c,true).catch(error=>{c.loadError=true;throw error;});c.loading.catch(()=>{});}
    const panel=document.createElement('div');panel.className='face-popover face-picker';panel.setAttribute('role','dialog');panel.setAttribute('aria-label',tr('תיוג פנים בתמונה','Tag a face in the photo'));panel.dir=I.isEnglish?'ltr':'rtl';
    panel.innerHTML=`<header><strong>${tr('מי בתמונה?','Who is this?')}</strong><button type="button" data-face-close aria-label="${tr('סגירה','Close')}">×</button></header>${face.person?`<p class="face-current-name" dir="auto">${safe(photoName(face))}</p>`:''}<label class="visually-hidden" for="facePersonSearch">${tr('חיפוש או הוספת שם','Search or add a name')}</label><input id="facePersonSearch" type="search" autocomplete="off" maxlength="120" placeholder="${tr('חפשו או הוסיפו שם…','Search or add a name…')}" aria-controls="facePersonResults" aria-autocomplete="list"><div id="facePersonResults" class="face-person-results" data-face-results role="listbox" aria-label="${tr('שמות לתיוג הפנים','Names for this face')}"></div><p class="face-save-status" data-face-status role="status"></p><div class="face-picker-actions"><button type="button" data-face-adjust>${tr('דיוק אזור הפנים','Adjust face area')}</button>${face.person?`<button type="button" data-face-remove>${tr('הסרת התיוג הזה','Remove this tag')}</button>`:`<button type="button" data-face-ignore>${tr('התעלמות מהזיהוי הזה','Ignore this detection')}</button>`}</div>`;
    if(desktopResize()){
      const hint=document.createElement('p');hint.className='face-tab-help';hint.id='faceTabHelp-'+c.serial;hint.textContent=tr('Tab: לפנים הבאות · Shift+Tab: אחורה · Esc: יציאה','Tab: next face · Shift+Tab: previous · Esc: exit');panel.append(hint);panel.querySelector('input').setAttribute('aria-describedby',hint.id);
    }
    c.popup=panel;c.dialog.append(panel);place(c);
    const input=panel.querySelector('input');input.addEventListener('input',()=>results(c,input.value));
    input.addEventListener('keydown',event=>{if(event.isComposing)return;if(event.key==='Escape'){event.preventDefault();event.stopPropagation();stopTabFaces(c);closePopup(c);}if(event.key==='ArrowDown'){event.preventDefault();panel.querySelector(choices)?.focus();}if(event.key==='Enter'){event.preventDefault();event.stopPropagation();const options=[...panel.querySelectorAll(choices)];if(options.length===1)options[0].click();else options[0]?.focus();}});
    panel.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();stopTabFaces(c);closePopup(c);}else if(['ArrowDown','ArrowUp'].includes(event.key)&&event.target.matches(choices)){event.preventDefault();const buttons=[...panel.querySelectorAll(choices)],index=buttons.indexOf(event.target);buttons[(index+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus();}});
    panel.querySelector('[data-face-close]').addEventListener('click',()=>{stopTabFaces(c);closePopup(c);});
    panel.querySelector('[data-face-adjust]').addEventListener('click',()=>{panel.remove();c.popup=null;c.active={...c.active,rect:{...c.active.rect}};c.adjust=true;c.guide.hidden=false;c.stage.classList.add('face-adjusting');place(c);});
    panel.querySelector('[data-face-remove]')?.addEventListener('click',()=>dismissFace(c));
    panel.querySelector('[data-face-ignore]')?.addEventListener('click',()=>dismissFace(c));
    input.focus({preventScroll:true});results(c,'');
    try{
      await c.loading;if(!live(c)||c.popup!==panel)return;
      const stored=c.saved.find(saved=>saved.id===face.id||c.geom.sameRegion(saved.rect,face.rect));if(stored){c.active=preserveRect?{...stored,rect:face.rect}:stored;place(c);}
    }catch(error){if(live(c)&&c.popup===panel)panel.querySelector('[data-face-status]').textContent=tr('לא ניתן לקרוא את תיוגי הפנים כרגע. סגרו ונסו שוב.','Face labels are currently unavailable. Close and try again.');}
  }
  function dismissFace(c){return c.active?.person?save(c,{personId:null}):ignoreDetection(c);}
  function ignoreDetection(c){const pending=ignore(c);c.pendingSave=pending;return pending;}
  async function ignore(c){
    if(!live(c)||c.saving||!c.active)return;const face={...c.active};c.saving=true;
    const order=tabFaces(c);if(!order.some(previous=>sameTabFace(c,previous,face)))order.push(face);
    // Remove the selected region and rebuild both number sets in this frame.
    c.pendingDismiss=face;closePopup(c);paint(c);
    try{
      await c.loading;if(!c.adapter)await window.FamilyTags.flush(c.item.id);if(!live(c))return;
      const payload={rect:face.rect,ignored:true,photoRevision:c.item.photoRevision||'original',...(face.person?{faceId:face.id,expectedRevision:face.revision}: {})},result=c.adapter?await c.adapter.ignore(payload):await request('api/media/'+c.item.id+'/faces/ignore',{method:'POST',body:JSON.stringify(payload)});
      changed(c,result);
      if(live(c)){c.saving=false;c.pendingDismiss=null;c.ignored=result.ignoredFaces||[];apply(c,result.faces);announce(c,tr('הסימון והתיוג הוסרו.','Face marker and label removed.'));advanceUnlabelledFace(c,face);}
    }catch(error){if(live(c)){c.pendingDismiss=null;paint(c);announce(c,error.message);window.FamilyApp?.toast?.(error.message);}}
    finally{c.saving=false;}
  }
  async function resized(c,face){
    if(!live(c))return;c.resizeDrag=null;c.stage.classList.remove('face-resizing');c.skipClick=true;setTimeout(()=>{if(live(c))c.skipClick=false;},0);
    c.adjusted.set(face.id,{original:c.adjusted.get(face.id)?.original||c.faces.find(other=>other.id===face.id)?.rect||face.rect,rect:face.rect});
    c.detected=c.detected.map(other=>other.id===face.id?{...other,rect:face.rect}:other);
    await openPicker(c,face,{preserveRect:true});if(live(c)&&face.personId)await save(c,{personId:face.personId},false);
  }
  function save(c,selection,advance=true){const pending=saveFace(c,selection,advance);c.pendingSave=pending;return pending;}
  async function saveFace(c,selection,advance=true){
    if(!live(c)||c.saving||!c.active)return;const panel=c.popup,face={...c.active};c.saving=true;
    if(advance&&selection?.personId!==null){const order=tabFaces(c);if(!order.some(previous=>sameTabFace(c,previous,face)))order.push(face);}
    const removing=selection?.personId===null;
    if(removing){c.pendingUnassign=face;c.reviewed=false;closePopup(c);paint(c);}
    if(panel){const status=panel.querySelector('[data-face-status]');if(status)status.textContent=tr('שומר את התיוג…','Saving the tag…');for(const control of panel.querySelectorAll('button,input'))control.disabled=true;}
    try{
      await c.loading;if(!c.adapter)await window.FamilyTags.flush(c.item.id);if(!live(c))return;
      const known=c.saved.find(saved=>saved.id===face.id||c.geom.sameRegion(saved.rect,face.rect));
      const payload={faceId:known?.id||face.id,...selection,rect:face.rect,expectedRevision:known?.revision||null},result=c.adapter?await c.adapter.save(payload):await request('api/media/'+c.item.id+'/faces/save',{method:'POST',body:JSON.stringify(payload)});
      changed(c,result);c.pendingUnassign=null;
      if(!c.adapter)remember(c.item.id,result.faces,result.item,c.detected,result.ignoredFaces,c.retained);
      if(live(c)){c.saving=false;if(result.ignoredFaces)c.ignored=result.ignoredFaces;apply(c,result.faces);closePopup(c);announce(c,result.face?tr('תיוג הפנים נשמר ונוסף גם לתיוגי התמונה.','Face label saved and added to the photo’s tags.'):tr('התיוג הוסר מהפנים. אם אין לאדם תיוג פנים נוסף בתמונה, הוא הוסר גם מרשימת השמות.','Face tag removed. If this person has no other labelled face in the photo, their name was also removed.'));if(result.face&&!(advance&&advanceUnlabelledFace(c,result.face))){showLabel(c,result.face,touchMode(),true);if(c.tabFace){rememberTabFace(c,result.face);focusTabFace(c,result.face);}}}
    }catch(error){if(live(c)&&removing){c.pendingUnassign=null;c.reviewed=Boolean(c.item.faceSummary?.reviewed);paint(c);announce(c,error.message);window.FamilyApp?.toast?.(error.message);}else if(live(c)&&c.popup===panel&&panel){panel.querySelector('[data-face-status]').textContent=error.message;for(const control of panel.querySelectorAll('button,input'))control.disabled=false;}}
    finally{c.saving=false;}
  }
  function point(c,event,clamp=false){if(!imageWidth(c.image))return null;const r=imageArea(c);if(!clamp&&(event.clientX<r.x||event.clientX>r.x+r.width||event.clientY<r.y||event.clientY>r.y+r.height))return null;return {x:Math.max(0,Math.min(1,(event.clientX-r.x)/r.width)),y:Math.max(0,Math.min(1,(event.clientY-r.y)/r.height))};}
  function faceAt(c,event){
    const hit=event.target.closest('.face-hit'),saved=hit&&c.faces.find(face=>face.id===hit.dataset.faceId);
    if(saved)return saved;const p=point(c,event);return p?c.geom.chooseFace(c.faces,p,imageArea(c)):null;
  }
  function cancelPress(c){clearTimeout(c.pressTimer);c.pressTimer=null;c.press=null;}
  async function mount(stage,image,item,{highlightMissing=false,adapter=null,dialog:hostDialog,reviewHost=null,reviewLabel=false,zoom=true,detectionImage=null}={}){
    const dialog=hostDialog||document.getElementById('mediaViewer'),existing=current;
    if(item.kind==='photo'&&window.FamilyApp?.apiEnabled&&live(existing)&&existing.initialized&&existing.stage===stage&&existing.image===image&&existing.item.id===item.id&&existing.item.photoRevision===item.photoRevision&&existing.adapter===adapter&&existing.highlightMissing===highlightMissing&&existing.dialog===dialog&&existing.reviewHost===reviewHost&&existing.reviewLabel===reviewLabel&&existing.zoomEnabled===zoom){update(item);return;}
    if(current)clear();stage._familyFaceContext?.dispose();if(item.kind!=='photo'||!item.id||!window.FamilyApp?.apiEnabled){clear();return;}
    if(retained&&(adapter||retained.stage!==stage||retained.dialog!==dialog||retained.reviewLabel!==reviewLabel||retained.zoomEnabled!==zoom))releaseControls();
    const controls=retained?.controls;retained=null;
    const c={serial:++serial,stage,image,item,adapter,highlightMissing,reviewHost,reviewLabel,zoomEnabled:zoom,reviewed:Boolean(item.faceSummary?.reviewed),dialog,events:new AbortController(),saved:[],detected:[],retained:[],ignored:[],adjusted:new Map(),faces:[],active:null,popup:null,ready:false,searchSequence:0,saving:false,adjust:false,drag:null,skipClick:false,...controls};current=c;stage._familyFaceContext=c;c.dispose=()=>dispose(c);window.dispatchEvent(new CustomEvent('family-face-viewer',{detail:{active:true}}));
    c.paintReady=new Promise(resolve=>{c.resolvePaint=resolve;});
    c.geom=await helpers();if(!live(c))return;
    c.layer=document.createElement('div');c.layer.className='face-layer';c.hits=document.createElement('div');c.hits.className='face-image-area';c.buttons=document.createElement('div');c.buttons.className='face-hit-buttons';c.annotations=document.createElement('div');c.annotations.className='face-visible-labels';c.annotationNodes=[];c.selection=document.createElement('div');c.selection.className='face-selection';c.selection.hidden=true;c.annotationTarget=document.createElement('span');c.annotationTarget.className='face-label-target';c.annotationTarget.hidden=true;c.annotationTarget.setAttribute('aria-hidden','true');c.hits.append(c.buttons,c.annotations,c.selection,c.annotationTarget);c.advanceButton=document.createElement('button');c.advanceButton.type='button';c.advanceButton.className='face-advance-button';c.advanceButton.hidden=true;c.advanceButton.setAttribute('aria-label',tr('פתיחת תיבת התיוג לפנים המסומנות','Open names for the selected face'));c.advanceButton.setAttribute('aria-keyshortcuts','ArrowDown');c.advanceButton.title=tr('פתיחת תיבת התיוג (↓)','Open face labels (↓)');c.advanceButton.innerHTML='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 7 5 5 5-5"/></svg>';c.hits.append(c.advanceButton);c.advanceButton.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();openQueuedFace(c);},{signal:c.events.signal});c.layer.append(c.hits);
    if(desktopResize()){
      c.selection.dataset.faceResizable='true';
      for(const handle of ['nw','n','ne','e','se','s','sw','w']){const node=document.createElement('button');node.type='button';node.className='face-resize-handle face-handle-'+handle;node.dataset.faceHandle=handle;node.setAttribute('aria-label',tr('שינוי גודל מסגרת הפנים','Resize face frame'));node.addEventListener('keydown',event=>{if(!c.active||c.saving||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();event.stopPropagation();const r=c.active.rect,area=imageArea(c),step=event.shiftKey?10:1,p={x:handle.includes('w')?r.x:r.x+r.width,y:handle.includes('n')?r.y:r.y+r.height};p.x+=(event.key==='ArrowLeft'?-step:event.key==='ArrowRight'?step:0)/area.width;p.y+=(event.key==='ArrowUp'?-step:event.key==='ArrowDown'?step:0)/area.height;resized(c,{...c.active,rect:c.geom.resizeFaceRect(r,handle,p)});});c.selection.append(node);}
    }
    c.guide=document.createElement('div');c.guide.className='face-adjust-guide';c.guide.hidden=true;c.guide.innerHTML=`<span>${tr('סמנו מסביב לפנים בעזרת גרירה','Drag around the face')}</span><button type="button">${tr('ביטול','Cancel')}</button>`;c.guide.querySelector('button').addEventListener('click',()=>closePopup(c));c.layer.append(c.guide);
    c.status=document.createElement('p');c.status.className='visually-hidden';c.status.setAttribute('role','status');c.status.setAttribute('aria-live','polite');c.labelList=document.createElement('div');c.labelList.className='face-label-list';c.labelList.hidden=true;c.labelList.setAttribute('aria-label',tr('שמות לפי המספרים על הפנים','Names matching the numbered faces'));stage.append(c.layer,c.status,c.labelList);stage.classList.add('has-face-layer');
    if(highlightMissing){if(!c.missingNote){c.missingNote=document.createElement('p');c.missingNote.className='face-missing-note';c.missingNote.setAttribute('role','status');stage.before(c.missingNote);}}else{c.missingNote?.remove();c.missingNote=null;}
    const on=(target,type,callback,options={})=>target.addEventListener(type,callback,{...options,signal:c.events.signal});
    setupRegions(c,on);
    if(adapter||item.scope==='gallery'||item.collections?.includes('gallery')){
      if(!c.reviewButton){
        c.reviewButton=document.createElement('button');c.reviewButton.type='button';c.reviewButton.className='face-review-button';c.reviewButton.setAttribute('aria-keyshortcuts','\\');
        c.reviewButton.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="10" cy="10" r="7.5"/><path d="M7 8h.01M13 8h.01M7 11.5a3.3 3.3 0 0 0 5.5.7"/><circle class="face-review-badge" cx="18" cy="17.5" r="5.5"/><path class="face-review-check" d="m15.5 17.5 1.7 1.7 3.3-3.5"/></svg>';
        if(reviewLabel){c.reviewText=document.createElement('span');c.reviewText.className='face-review-text';c.reviewButton.append(c.reviewText);}
        c.reviewStatus=document.createElement('span');c.reviewStatus.className='face-review-status';c.reviewStatus.hidden=true;c.reviewStatus.setAttribute('role','status');stage.before(c.reviewStatus);
      }
      c.reviewButton.hidden=false;
      if(!c.reviewButton.isConnected){if(reviewHost)reviewHost.append(c.reviewButton);else{const title=document.getElementById('mediaViewerTitle'),edit=document.getElementById('editOpenedPhoto');title.insertBefore(c.reviewButton,edit.parentNode===title?edit:null);}}
      on(c.reviewButton,'click',async()=>{
        if(!live(c)||c.reviewSaving||c.saving)return;c.reviewSaving=true;c.reviewButton.disabled=true;c.reviewButton.setAttribute('aria-busy','true');c.reviewStatus.hidden=true;c.reviewStatus.textContent='';
        try{
          await c.loading;if(!c.adapter)await window.FamilyTags?.flush?.(c.item.id);if(!live(c))return;
          const payload={complete:!c.reviewed,photoRevision:c.item.photoRevision||'original',tagsRevision:c.item.tagsRevision||'empty'},result=c.adapter?await c.adapter.review(payload):await request('api/media/'+item.id+'/faces/review',{method:'POST',body:JSON.stringify(payload)});
          changed(c,result);
          if(live(c)){c.item={...c.item,...result.item};c.reviewed=Boolean(result.item.faceSummary?.reviewed);closePopup(c);paint(c);announce(c,c.reviewed?tr('כל הפרצופים תויגו.','All faces tagged.'):tr('אישור התיוג בוטל.','Tagging confirmation removed.'));}
        }catch(error){if(live(c)){c.reviewStatus.hidden=false;c.reviewStatus.textContent=error.message;}}
        finally{c.reviewSaving=false;if(live(c)){c.reviewButton.disabled=false;c.reviewButton.setAttribute('aria-busy','false');if(!c.adapter)window.FamilyMedia?.refreshPhotoPresentation?.();}}
      });
    }else{c.reviewButton?.remove();c.reviewStatus?.remove();c.reviewButton=null;c.reviewStatus=null;c.reviewText=null;}
    paint(c);

    on(stage,'click',event=>{
      if(!live(c)||c.saving||c.reviewSaving||(c.adapter&&!c.adapter.enabled())||event.target.closest('.face-adjust-guide')||event.target.closest('[data-face-handle]')||c.adjust)return;
      if(event.detail!==0&&Date.now()<(c.pressClickUntil||0)){event.preventDefault();return;}
      if(c.skipClick){c.skipClick=false;return;}
      if(c.scrollStart&&c.scroller&&(Math.abs(c.scroller.scrollLeft-c.scrollStart.x)>5||Math.abs(c.scroller.scrollTop-c.scrollStart.y)>5)){c.scrollStart=null;return;}c.scrollStart=null;
      const region=c.showRegions?event.target.closest('.face-tagged-region'):null;
      if(region){const face=c.faces.find(face=>face.id===region.dataset.faceId&&face.person);if(face){event.preventDefault();if(touchMode(event)&&event.detail!==0)showLabel(c,face,true);else openPicker(c,face);}return;}
      const keyboard=event.detail===0&&event.target.matches('.face-hit'),known=faceAt(c,event),p=known||keyboard?null:point(c,event);if(!known&&!p)return;
      const area=imageArea(c),face=known||{id:uuid(),rect:c.geom.manualRect(p,area),revision:null};
      if(!face)return;event.preventDefault();if(face.person&&touchMode(event)&&!keyboard){rememberTabFace(c,face);showLabel(c,face,true);}else openPicker(c,face);
    });
    on(stage,'pointerdown',event=>{
      if(event.isPrimary===false||c.resizeDrag)return;
      if(['touch','pen'].includes(event.pointerType)||event.sourceCapabilities?.firesTouchEvents)touchUntil=Date.now()+1200;
      c.pressClickUntil=0;cancelPress(c);
      const handle=event.target.closest('[data-face-handle]');
      if(handle&&desktopResize()&&c.active&&!c.saving&&!c.reviewSaving&&!(c.adapter&&!c.adapter.enabled())&&!(event.button>0)){
        const p=point(c,event,true);if(!p)return;event.preventDefault();
        const edge=handle.dataset.faceHandle,rect={...c.active.rect};
        c.resizeDrag={pointerId:event.pointerId,handle:edge,rect,offset:{x:(edge.includes('w')?rect.x:rect.x+rect.width)-p.x,y:(edge.includes('n')?rect.y:rect.y+rect.height)-p.y}};
        c.active={...c.active,rect:{...rect}};clearTimeout(c.labelTimer);c.labelTimer=null;c.popup?.remove();c.popup=null;c.stage.classList.add('face-resizing');stage.setPointerCapture?.(event.pointerId);return;
      }
      if(!c.adjust){
        if(!(['touch','pen'].includes(event.pointerType)||event.sourceCapabilities?.firesTouchEvents)||event.isPrimary===false||event.button>0||c.saving||c.reviewSaving||event.target.closest('a,input,button:not(.face-hit),.face-popover'))return;
        const face=faceAt(c,event);if(!face?.person)return;
        const press=c.press={id:event.pointerId,x:event.clientX,y:event.clientY,face};
        c.pressTimer=setTimeout(()=>{if(!live(c)||c.press!==press||c.saving||c.adjust)return;press.fired=true;c.pressClickUntil=Date.now()+800;openPicker(c,c.faces.find(face=>face.id===press.face.id)||press.face);},550);
        return;
      }
      if(event.target.closest('.face-adjust-guide'))return;const p=point(c,event);if(!p)return;event.preventDefault();c.drag=p;stage.setPointerCapture?.(event.pointerId);
    });
    const moved=event=>{if(c.press&&event.pointerId===c.press.id&&Math.hypot(event.clientX-c.press.x,event.clientY-c.press.y)>10)cancelPress(c);};
    on(stage,'pointermove',event=>{moved(event);const drag=c.resizeDrag;if(drag&&event.pointerId!==drag.pointerId)return;const p=point(c,event,Boolean(drag));if(drag&&p){event.preventDefault();c.active.rect=c.geom.resizeFaceRect(drag.rect,drag.handle,{x:p.x+drag.offset.x,y:p.y+drag.offset.y});place(c);return;}if(!c.adjust||!c.drag||!p)return;event.preventDefault();c.active.rect=c.geom.clampRect({x:Math.min(p.x,c.drag.x),y:Math.min(p.y,c.drag.y),width:Math.abs(p.x-c.drag.x),height:Math.abs(p.y-c.drag.y)});c.selection.hidden=false;place(c);});
    const released=event=>{if(c.press?.id!==event.pointerId)return;if(c.press.fired){event.preventDefault();c.pressClickUntil=Date.now()+800;}cancelPress(c);};
    on(stage,'pointerup',event=>{released(event);if(c.resizeDrag){if(event.pointerId!==c.resizeDrag.pointerId)return;event.preventDefault();resized(c,c.active);return;}if(!c.adjust||!c.drag)return;event.preventDefault();c.drag=null;c.adjust=false;c.skipClick=true;stage.classList.remove('face-adjusting');c.guide.hidden=true;const face=c.active;openPicker(c,face,{preserveRect:true});});
    on(stage,'pointercancel',event=>{cancelPress(c);if(c.resizeDrag&&event.pointerId!==c.resizeDrag.pointerId)return;if(c.adjust||c.resizeDrag){c.drag=null;closePopup(c);}});
    on(stage,'contextmenu',event=>{if(c.press||Date.now()<(c.pressClickUntil||0))event.preventDefault();});
    on(document,'pointerdown',event=>{if(c.press&&event.pointerId!==c.press.id)cancelPress(c);if(!c.popup?.contains(event.target)&&!stage.contains(event.target)){stopTabFaces(c);if(c.popup)closePopup(c);}},{capture:true});
    on(document,'focusin',event=>{if(c.tabFace&&!c.popup?.contains(event.target)&&!stage.contains(event.target))stopTabFaces(c);});
    on(document,'pointermove',moved,{capture:true,passive:true});on(document,'pointerup',released);on(document,'pointercancel',()=>cancelPress(c));
    on(document,'pointermove',event=>{if(!c.active||!c.popup?.classList.contains('face-name')||touchMode(event))return;const r=screenFace(c,c.active);if(c.popup.contains(event.target)||(event.clientX>=r.x&&event.clientX<=r.x+r.width&&event.clientY>=r.y&&event.clientY<=r.y+r.height))keepLabel(c);else dismissLabelSoon(c);},{passive:true});
    on(document,'keydown',event=>{
      if(event.key==='Shift'){
        if(!event.repeat)c.shiftTap=!event.defaultPrevented&&!event.isComposing&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&canStartFaceSequence(c,event.target);
      }else c.shiftTap=false;
      if(event.key==='Escape'&&(c.popup||c.adjust||c.tabFace)){event.preventDefault();event.stopPropagation();stopTabFaces(c);closePopup(c);return;}
      if(event.key==='ArrowDown'&&!event.defaultPrevented&&!event.repeat&&!event.isComposing&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!event.shiftKey){
        const target=event.target,activeDialog=target?.closest?.('dialog[open]')||document.activeElement?.closest?.('dialog[open]')||[...document.querySelectorAll('dialog[open]')].at(-1);
        if((!activeDialog||activeDialog===c.dialog)&&!target?.isContentEditable&&!target?.closest?.('input,textarea,select,[role="textbox"]')&&(target===document.body||target===c.stage||target===c.scroller||c.stage.contains(target))&&openQueuedFace(c)){event.preventDefault();event.stopPropagation();return;}
      }
      if(event.key==='Tab'&&!event.defaultPrevented&&!event.isComposing&&!event.ctrlKey&&!event.metaKey&&!event.altKey){moveTabFace(c,event);return;}
      if((event.key!=='\\'&&!['Backslash','IntlBackslash'].includes(event.code))||event.defaultPrevented||event.repeat||event.isComposing||event.ctrlKey||event.metaKey||event.altKey||event.shiftKey||c.saving||c.reviewSaving||c.adjust||c.resizeDrag||c.popup?.classList.contains('face-picker'))return;
      const button=c.reviewButton,target=event.target,uploadMetadata=Boolean(c.adapter&&c.dialog.id==='photoUploadEditor'&&target?.closest?.('#photoEditMetadata'));
      if(!live(c)||!button||button.disabled||!button.isConnected||!c.dialog.open||button.closest('[hidden],[inert],[aria-hidden="true"]')||!button.getClientRects().length||((target?.isContentEditable||target?.closest?.('input,textarea,select,[role="textbox"]'))&&!uploadMetadata)||(c.adapter&&!c.adapter.enabled()))return;
      const activeDialog=target?.closest?.('dialog[open]')||document.activeElement?.closest?.('dialog[open]')||[...document.querySelectorAll('dialog[open]')].at(-1);
      if(activeDialog&&activeDialog!==c.dialog)return;
      event.preventDefault();event.stopPropagation();button.click();
    },{capture:true});
    on(document,'keyup',event=>{
      const tapped=c.shiftTap;c.shiftTap=false;
      if(event.key!=='Shift'||!tapped||event.defaultPrevented||event.isComposing||event.shiftKey||event.ctrlKey||event.metaKey||event.altKey)return;
      if(startFaceSequence(c,event.target)){event.preventDefault();event.stopPropagation();}
    },{capture:true});
    for(const type of ['blur','pointerdown','wheel'])on(window,type,()=>{c.shiftTap=false;},{capture:true,passive:true});
    on(c.dialog,'scroll',()=>place(c),{passive:true});
    on(window,'resize',()=>{fitZoom(c);place(c);});if(window.visualViewport){on(window.visualViewport,'resize',()=>{if(c.popup?.classList.contains('face-picker')&&c.active)revealFace(c,c.active);place(c);});on(window.visualViewport,'scroll',()=>place(c));}
    if(typeof ResizeObserver!=='undefined'){c.resize=new ResizeObserver(()=>place(c));c.resize.observe(image);c.resize.observe(stage);}
    c.loading=load(c).catch(error=>{c.loadError=true;if(error.name!=='AbortError')announce(c,tr('אפשר להוסיף תיוג פנים אחרי שהחיבור יחזור.','Face tags can be added when the connection returns.'));throw error;});c.loading.catch(()=>{});
    const imageReady=()=>new Promise(resolve=>{if(imageWidth(image)&&(image.complete||image.tagName?.toLowerCase()==='canvas'))resolve();else on(image,'load',resolve,{once:true});});
    await imageReady();if(!live(c))return;if(zoom)setupZoom(c);c.initialized=true;window.FamilyPhotoViewerLayout?.faceControls(c);place(c);window.FamilyMedia?.refreshPhotoPresentation?.();c.resolvePaint();
    c.runDetection=async()=>{
    clearTimeout(c.detectionTimer);c.detectionTimer=null;
    if(!live(c)||c.scanning)return;c.scanning=true;
    stage.dataset.faceDetection='scanning';
    const detected=found=>{if(!live(c))return;const used=new Set(),visible=c.highlightMissing&&Array.isArray(found.galleryFaces)?found.galleryFaces:found;c.detected=visible.map(face=>{const override=[...c.adjusted].find(([,change])=>c.geom.sameRegion(change.original,face.rect)),previous=c.detected.find(previous=>!used.has(previous.id)&&c.geom.sameRegion(previous.rect,face.rect)),id=override?.[0]||previous?.id||uuid();used.add(id);return {id,rect:override?.[1].rect||face.rect,score:face.score,revision:null};});stage.dataset.faceEngine=found.engine;paint(c);};
    const receive=found=>{if(c.adapter){const mapped=c.adapter.mapDetections(found);mapped.engine=found.engine;detected(mapped);}else detected(found);};
    try{const original=!adapter&&c.item.previewSrc?await window.FamilyPhotoPresentation?.prepare(c.item,'low',true):null;if(!live(c))return;const detector=await import('./face-detector.mjs?v=13'),found=await detector.detectFaces(item.id+':'+(adapter?'upload':item.photoRevision||'original'),detectionImage||original||image,c.events.signal,receive);if(!live(c))return;receive(found);stage.dataset.faceDetection='ready';if(!adapter)window.FamilyGalleryFaces?.save(item,found,c.events.signal).catch(()=>{});}
    catch(error){if(live(c)&&error.name!=='AbortError'){stage.dataset.faceDetection='manual';console.warn('Face detection unavailable:',error.message);announce(c,tr('אפשר ללחוץ על הפנים בתמונה ולתייג גם ידנית.','You can click a face to tag it manually.'));}}
    };
    c.scheduleDetection=()=>{
      if(!live(c)||c.reviewed||c.scanning||c.detectionTimer)return;
      // Let rapid browsing and preview downloads finish first. Saved
      // face regions and all editing controls are already available meanwhile.
      if(!adapter&&(dialog.classList.contains('personal-photo-desktop')||window.FamilyMedia?.isPhotoBrowsing?.()))c.detectionTimer=setTimeout(()=>{c.detectionTimer=null;if(live(c)&&!c.reviewed){if(window.FamilyMedia?.isPhotoBrowsing?.())c.scheduleDetection();else c.runDetection();}},650);
      else return c.runDetection();
    };
    // Completed photos use their saved regions; undoing confirmation can still
    // start the same detector later without rebuilding the interactive image.
    if(c.reviewed&&!adapter){stage.dataset.faceDetection='reviewed';return;}
    if(c.item.faceSummary?.scanned&&!adapter){stage.dataset.faceDetection='saved';return;}
    await c.scheduleDetection();
  }
  function update(item){if(current?.item.id===item.id){const wasReviewed=current.reviewed;current.item=item;current.reviewed=Boolean(item.faceSummary?.reviewed);paint(current);if(!current.reviewed&&(wasReviewed||!item.faceSummary?.scanned))current.scheduleDetection?.();}}
  document.addEventListener('DOMContentLoaded',()=>{
    window.addEventListener('family-photo-overlays-changed',event=>{const c=current;if(c?.item.id===event.detail.id){paintAnnotations(c);if(c.hits)place(c);}});
    window.addEventListener('family-media-changed',event=>{
      const result=event.detail,id=result.item?.id;if(!id)return;
      if(result.faces)remember(id,result.faces,result.item,result.detectedFaces,result.ignoredFaces,result.unassignedFaces);else if(['tags','untag','retag','delete','restore','photo-edit'].includes(result.operation))labels.delete(id);
      const c=current;if(!c||c.item.id!==id)return;if(result.unassignedFaces)c.retained=result.unassignedFaces.map(face=>({...face,id:c.retained.find(previous=>c.geom.sameRegion(previous.rect,face.rect))?.id||c.detected.find(previous=>c.geom.sameRegion(previous.rect,face.rect))?.id||uuid()}));c.item={...c.item,...result.item};c.reviewed=Boolean(result.item.faceSummary?.reviewed);if(result.operation==='face-review'){labels.delete(id);paint(c);}
      if(result.ignoredFaces){c.ignored=result.ignoredFaces;paint(c);}
      if(result.operation==='face-ignore'&&result.detectedFaces){for(const face of result.detectedFaces)if(!c.detected.some(previous=>c.geom.sameRegion(previous.rect,face.rect)))c.detected.push({...face,id:uuid()});paint(c);}
      else if(result.detectedFaces){c.detected=result.detectedFaces.map(face=>({...face,id:c.detected.find(previous=>c.geom.sameRegion(previous.rect,face.rect))?.id||uuid()}));paint(c);}
      if(result.faces)apply(c,result.faces);else if(['tags','untag','retag','restore'].includes(result.operation))load(c,true).catch(()=>{});
    });
  });
  async function saved(item,{signal}={}){
    if(!item?.id||item.kind!=='photo')return [];
    const cached=labels.get(item.id),revision=item.photoRevision||'original';
    if(cached&&cached.tagsRevision===item.tagsRevision&&cached.photoRevision===revision&&Date.now()-cached.time<30000)return cached.faces;
    const result=await request('api/media/'+item.id+'/faces',{signal});
    if(signal?.aborted||(result.item?.photoRevision||'original')!==revision)return [];
    const faces=result.faces||[];remember(item.id,faces,result.item||item,result.detectedFaces,result.ignoredFaces);return faces;
  }
  function canNavigate(stage){
    const c=stage._familyFaceContext;
    return !c||(!(c.zoom>1)&&!c.adjust&&!c.resizeDrag&&!c.saving&&!c.reviewSaving&&!c.popup?.classList.contains('face-picker'));
  }
  window.FamilyFaces={mount,clear,update,canNavigate,saved,whenReady(stage,image){const c=stage._familyFaceContext;return c?.image===image?c.paintReady:Promise.resolve();},async flush(){await current?.pendingSave;},dismiss(){if(current){stopTabFaces(current);closePopup(current);}},fit(){if(current?.initialized&&imageWidth(current.image)){fitZoom(current);place(current);}}};
})();
