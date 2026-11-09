(() => {
  'use strict';
  const $=id=>document.getElementById(id),tr=(he,en)=>window.FamilyI18n.isEnglish?en:he;
  const compact=matchMedia('(max-width:700px), (display-mode:standalone), (display-mode:fullscreen)');
  const moved=new Map();let faces=null,viewer,header,strip,icons,feedback,fit,fitLabel,zoomValue,zoomGroup,busy=false,active=false,photoId=null,headingLabel;

  // Move the actual controls so their listeners, pending writes and focus stay
  // attached. Anchors restore the normal desktop and non-photo layouts.
  function move(node,parent,before=null){
    if(!node||!parent||node===before||node.parentNode===parent&&node.nextSibling===before)return;
    if(!moved.has(node)&&node.parentNode){const anchor=document.createComment('photo-control');node.before(anchor);moved.set(node,anchor);}
    parent.insertBefore(node,before);
  }
  function arrange(parent,nodes){
    let before=null;
    for(const node of nodes.filter(Boolean).reverse()){move(node,parent,before);before=node;}
  }
  function restore(){
    for(const button of icons.querySelectorAll('[data-photo-album-kind="baby"],[data-photo-album-kind="wedding"]'))button.hidden=false;
    for(const [node,anchor]of [...moved].reverse()){
      if(anchor.isConnected&&node.isConnected)anchor.replaceWith(node);else anchor.remove();
    }
    moved.clear();strip.hidden=true;zoomGroup.hidden=true;viewer.classList.remove('photo-controls-below');
    if(headingLabel===null)$('mediaViewerTitle').removeAttribute('aria-label');else $('mediaViewerTitle').setAttribute('aria-label',headingLabel);
    active=false;photoId=null;
  }
  function fitOptionalAlbums(){
    const optional=[...icons.querySelectorAll('[data-photo-album-kind="baby"],[data-photo-album-kind="wedding"]')];
    for(const button of optional)button.hidden=true;
    const gap=parseFloat(getComputedStyle(icons).columnGap)||0,buttons=[...icons.querySelectorAll('button,a')].filter(node=>node.getBoundingClientRect().width>0);
    let used=buttons.reduce((total,node)=>total+node.getBoundingClientRect().width,0)+Math.max(0,buttons.length-1)*gap,count=buttons.length;
    const available=icons.getBoundingClientRect().width;
    for(const button of optional){
      if(!button.dataset.photoCollection)continue;button.hidden=false;const width=button.getBoundingClientRect().width,next=used+(count?gap:0)+width;
      if(next>available+.5)button.hidden=true;else{used=next;count++;}
    }
  }
  function sync(){
    if(!viewer||busy)return;busy=true;const focused=document.activeElement;
    try{
      const item=window.FamilyMedia?.current?.(),enabled=viewer.open&&item?.kind==='photo'&&(compact.matches||navigator.standalone===true);
      if(!enabled){if(active||moved.size)restore();return;}
      active=true;viewer.classList.add('photo-controls-below');strip.hidden=false;zoomGroup.hidden=false;
      $('mediaViewerTitle').setAttribute('aria-label',tr('תצוגת תמונה','Photo viewer'));
      fitLabel.textContent=tr('התאמה למסך','Fit photo');fit.title=tr('התאמת התמונה למסך','Fit the photo to the screen');
      icons.setAttribute('aria-label',tr('פעולות בתמונה','Photo actions'));
      // New metadata can replace the names/date buttons while a face save is
      // still active. Keep the face control itself and discard obsolete anchors.
      for(const [node,anchor]of moved)if(!anchor.isConnected){anchor.remove();moved.delete(node);}
      const moment=$('photoMomentTools'),names=$('togglePhotoNames'),ages=$('togglePhotoAges'),date=$('editPhotoDate');
      const controls=faces?.item.id===item.id?faces:null;
      if(moment&&date){
        move(ages,moment,date);if(controls?.regionsButton)move(controls.regionsButton,moment,ages||date);
        move(names,moment,controls?.regionsButton||ages||date);
      }
      if(controls?.toolbar){
        move(controls.toolbar,zoomGroup);
        controls.toolbar.querySelector('[data-face-zoom-out]').dataset.zoomLabel=tr('הקטן','Zoom out');
        controls.toolbar.querySelector('[data-face-zoom-in]').dataset.zoomLabel=tr('הגדל','Zoom in');
      }
      arrange(icons,[moment,$('mediaViewerCollections'),controls?.reviewButton,$('editOpenedPhoto'),$('mediaOriginal')]);
      arrange(feedback,[controls?.regionsNote,controls?.reviewStatus]);fitOptionalAlbums();
      const reset=controls?.toolbar?.querySelector('[data-face-zoom-reset]');fit.disabled=!reset||reset.disabled;
      zoomValue.textContent=controls?.toolbar?.querySelector('[data-face-zoom-level]')?.textContent||'100%';
      if(photoId!==item.id){photoId=item.id;strip.scrollLeft=0;}
    }finally{if(viewer.open&&focused?.isConnected&&viewer.contains(focused)&&document.activeElement!==focused)focused.focus({preventScroll:true});busy=false;}
  }
  function faceControls(controller,owner){
    if(controller&&controller.dialog!==viewer)return;
    if(!controller&&owner&&faces!==owner)return;
    faces=controller;sync();
  }
  function init(){
    viewer=$('mediaViewer');if(!viewer)return;header=viewer.querySelector('.media-viewer-header');headingLabel=$('mediaViewerTitle').getAttribute('aria-label');
    zoomGroup=document.createElement('div');zoomGroup.id='mediaPhotoZoomGroup';zoomGroup.hidden=true;
    fit=document.createElement('button');fit.type='button';fit.id='mediaPhotoFit';fitLabel=document.createElement('span');zoomValue=document.createElement('span');zoomValue.id='mediaPhotoZoomValue';
    fit.append(fitLabel,zoomValue);zoomGroup.append(fit);header.append(zoomGroup);
    fit.addEventListener('click',()=>faces?.toolbar?.querySelector('[data-face-zoom-reset]')?.click());
    const panel=document.createElement('div');panel.id='mediaPhotoToolbar';
    strip=document.createElement('div');strip.id='mediaPhotoIconScroll';strip.hidden=true;
    icons=document.createElement('div');icons.id='mediaPhotoIcons';icons.setAttribute('role','group');
    feedback=document.createElement('div');feedback.id='mediaPhotoToolbarFeedback';strip.append(icons);panel.append(strip,feedback);$('mediaStage').after(panel);
    viewer.addEventListener('close',()=>{faces=null;restore();});window.addEventListener('resize',sync);compact.addEventListener('change',sync);sync();
  }
  window.FamilyPhotoViewerLayout={sync,faceControls};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
