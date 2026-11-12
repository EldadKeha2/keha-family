(() => {
  'use strict';
  const $=id=>document.getElementById(id),tr=(he,en)=>window.FamilyI18n?.isEnglish?en:he;
  const narrow=matchMedia('(max-width:700px)'),ua=navigator.userAgent||'';
  const mobile=navigator.userAgentData?.mobile===true||/Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(ua)||(/Macintosh/i.test(ua)&&navigator.maxTouchPoints>1);
  const moved=new Map();let viewer,active=false,busy=false,controller=null,photoId=null,roots=[],heading,counter,frame,leftRail,rightRail,albums,zoom,fit,fitLabel,info,actions,primary,reviewDock,editDock,trashDock,trash,below,details,feedback,labelledBy;
  function move(node,parent,before=null){
    if(!node||!parent||node===before||node.parentNode===parent&&node.nextSibling===before)return;
    if(!moved.has(node)&&node.parentNode){const anchor=document.createComment('personal-photo-control');node.before(anchor);moved.set(node,anchor);}
    parent.insertBefore(node,before);
  }
  function arrange(parent,nodes){let before=null;for(const node of nodes.filter(Boolean).reverse()){move(node,parent,before);before=node;}}
  function element(tag,id,parent){const node=document.createElement(tag);node.id=id;if(parent)parent.append(node);return node;}
  function positionControls(changed){
    const style=getComputedStyle(frame),gap=parseFloat(style.columnGap)||12;
    const padding=(parseFloat(style.paddingLeft)||0)+(parseFloat(style.paddingRight)||0);
    const verticalPadding=(parseFloat(style.paddingTop)||0)+(parseFloat(style.paddingBottom)||0);
    const height=Math.max(100,(frame.clientHeight||innerHeight*.55)-verticalPadding);
    // Reserve the same viewport for every photo, including while it is loading.
    // Browser zoom changes the CSS viewport; keep the controls at their normal size.
    // Short viewports scroll each rail instead of squeezing buttons and their SVGs.
    const rail=56,railColumn=rail+12;
    const width=Math.max(1,(frame.clientWidth||document.documentElement.clientWidth)-padding-railColumn*2-gap*2);
    const sizeChanged=[['--personal-photo-width',width],['--personal-photo-height',height]].some(([key,value])=>!frame.style.getPropertyValue(key)||Math.abs(parseFloat(frame.style.getPropertyValue(key))-value)>.5);
    frame.style.setProperty('--personal-rail',rail+'px');frame.style.setProperty('--personal-photo-width',width+'px');frame.style.setProperty('--personal-photo-height',height+'px');
    if(controller&&(changed||sizeChanged))window.FamilyFaces?.fit?.();
    const albumCount=[...albums.querySelectorAll('[data-photo-album-kind]')].filter(button=>!button.hidden).length;
    const leftHeight=rail*4+gap*3,zoomHeight=rail*3+gap*2;
    const controlsTop=Math.max(0,(height-leftHeight)/2);
    const zoomTop=Math.max(54+gap,controlsTop);
    const trashTop=Math.max(height-rail,zoomTop+zoomHeight+gap+rail+gap),editTop=trashTop-gap-rail;
    frame.style.setProperty('--personal-review-top',controlsTop+'px');
    frame.style.setProperty('--personal-albums-top',(controlsTop+rail+gap)+'px');
    frame.style.setProperty('--personal-albums-height',Math.max(0,albumCount*rail+gap*(albumCount-1))+'px');
    frame.style.setProperty('--personal-edit-top',Math.max(0,editTop)+'px');frame.style.setProperty('--personal-trash-top',Math.max(0,trashTop)+'px');
    frame.style.setProperty('--personal-zoom-top',zoomTop+'px');
  }
  function restore(){
    if(!active)return;
    window.FamilyPhotoCollections?.setViewerDesktop?.(false);
    for(const [node,anchor]of [...moved].reverse()){
      if(anchor.isConnected&&node.isConnected)anchor.replaceWith(node);else anchor.remove();
    }
    moved.clear();for(const root of roots)root.remove();roots=[];
    viewer.classList.remove('personal-photo-desktop');viewer.classList.remove('personal-photo-shared');
    if(labelledBy===null)viewer.removeAttribute('aria-labelledby');else viewer.setAttribute('aria-labelledby',labelledBy);
    active=false;controller=null;photoId=null;
  }
  function create(){
    const header=viewer.querySelector('.media-viewer-header'),footer=viewer.querySelector('.media-viewer-footer'),stage=$('mediaStage');
    labelledBy=viewer.getAttribute('aria-labelledby');
    heading=element('div','personalPhotoHeading',header);heading.setAttribute('role','heading');heading.setAttribute('aria-level','2');
    counter=element('span','personalPhotoCounter',heading);
    frame=element('div','personalPhotoFrame');stage.before(frame);
    leftRail=element('div','personalPhotoLeft',frame);rightRail=element('div','personalPhotoRight',frame);
    reviewDock=element('div','personalPhotoReview',leftRail);albums=element('div','personalPhotoAlbums',leftRail);
    zoom=element('div','personalPhotoZoom',rightRail);trashDock=element('div','personalPhotoTrash',rightRail);editDock=element('div','personalPhotoEdit',rightRail);
    trash=element('button','personalPhotoTrashButton',trashDock);trash.type='button';
    trash.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6m4-6v6"/></svg>';
    trash.addEventListener('click',()=>$('mediaViewerDelete')?.click());
    zoom.setAttribute('role','group');
    fit=element('button','personalPhotoFit',zoom);fit.type='button';
    fit.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/></svg>';
    fitLabel=element('span','personalPhotoFitLabel',fit);
    fit.addEventListener('click',()=>controller?.toolbar?.querySelector('[data-face-zoom-reset]')?.click());
    below=element('div','personalPhotoBelow');footer.insertBefore(below,footer.firstChild);
    details=element('div','personalPhotoDetails',below);info=element('div','personalPhotoInformation',details);actions=element('div','personalPhotoActions',details);
    primary=element('div','personalPhotoPrimary',actions);
    feedback=element('div','personalPhotoFeedback',below);
    roots=[heading,frame,below];active=true;viewer.classList.add('personal-photo-desktop');viewer.setAttribute('aria-labelledby','personalPhotoHeading');
  }
  function sync(faces){
    viewer=$('mediaViewer');if(!viewer||busy)return;
    const item=window.FamilyMedia?.current?.(),scope=viewer.getAttribute('data-media-scope')||'';
    const supported=/^(?:personal:.+|gallery|photos|wedding:.+|nursery:.+|link:.+)$/.test(scope);
    if(!viewer.open||viewer.classList.contains('photo-fullscreen')||item?.kind!=='photo'||!supported||mobile||narrow.matches){restore();return;}
    busy=true;const focused=document.activeElement,entering=!active;
    try{
      if(!active)create();
      if(scope.startsWith('personal:'))viewer.classList.remove('personal-photo-shared');else viewer.classList.add('personal-photo-shared');
      window.FamilyPhotoCollections?.setViewerDesktop?.(true);
      for(const [node,anchor]of moved)if(!anchor.isConnected){anchor.remove();moved.delete(node);}
      const changed=controller!==faces;controller=faces?.item?.id===item.id&&faces.dialog===viewer?faces:null;
      move($('mediaHeaderCaption'),heading,counter);
      const position=($('mediaViewerCounter')?.textContent||'').match(/(\d+)\s*\/\s*(\d+)/);
      counter.textContent=position?tr('תמונה '+position[1]+' מתוך '+position[2],'Photo '+position[1]+' of '+position[2]):$('mediaViewerCounter')?.textContent||'';
      heading.setAttribute('aria-label',[$('mediaHeaderCaption')?.textContent||tr('תמונה','Photo'),counter.textContent].filter(Boolean).join(' · '));
      move($('mediaStage'),frame,rightRail);move($('mediaViewerCollections'),albums);
      const collection=$('mediaViewerCollections')?.querySelector('.photo-collections');
      if(collection)arrange(collection,[collection.querySelector('[data-photo-album-kind="family"]'),collection.querySelector('[data-photo-album-kind="baby"]'),collection.querySelector('[data-photo-album-kind="wedding"]')]);
      const moment=$('photoMomentTools');move(moment,info);
      if(controller?.regionsButton)move(controller.regionsButton,moment);
      const taken=moment?.querySelector('.photo-taken-date');if(taken)move(taken,$('editPhotoDate'));
      arrange(primary,[$('mediaViewerDelete'),$('openedProfilePhoto'),$('editOpenedCaption')]);
      arrange(editDock,[$('editOpenedPhoto')]);arrange(reviewDock,[controller?.reviewButton]);
      const sharing=$('mediaShareActions'),copy=$('copyMediaLink'),download=$('mediaOriginal');
      move(copy,sharing,$('shareMediaWhatsApp'));move(download,sharing,copy);
      move(sharing,below,feedback);move($('openedCaptionForm'),actions,primary);
      const footer=viewer.querySelector('.media-viewer-footer');
      move($('mediaPhotoLabels'),footer,below);
      move(controller?.labelList,footer,$('mediaTagPanel'));
      if(photoId!==item.id){photoId=item.id;viewer.scrollTop=0;footer.scrollTop=0;}
      arrange(feedback,[controller?.regionsNote,controller?.reviewStatus]);
      if(controller?.toolbar)move(controller.toolbar,zoom);
      fitLabel.textContent=tr('התאמה למסך','Fit photo');fit.title=tr('התאמת התמונה למסך','Fit the photo to the screen');zoom.setAttribute('aria-label',fit.title);
      const reset=controller?.toolbar?.querySelector('[data-face-zoom-reset]');fit.disabled=!reset||reset.disabled;
      const remove=$('mediaViewerDelete'),removeLabel=remove?.getAttribute('aria-label')||remove?.title||remove?.textContent||tr('הסרה מהאלבום','Remove from album');
      trash.title=removeLabel;trash.setAttribute('aria-label',removeLabel);trash.disabled=!remove||remove.disabled;trash.hidden=!remove||remove.hidden;
      positionControls(entering||changed);
    }finally{if(focused?.isConnected&&viewer.contains(focused)&&document.activeElement!==focused)focused.focus({preventScroll:true});busy=false;}
  }
  window.FamilyPersonalPhotoLayout={sync,restore};
  function init(){viewer=$('mediaViewer');viewer?.addEventListener('close',restore);window.FamilyPhotoViewerLayout?.sync();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
