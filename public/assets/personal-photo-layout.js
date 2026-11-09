(() => {
  'use strict';
  const $=id=>document.getElementById(id),tr=(he,en)=>window.FamilyI18n?.isEnglish?en:he;
  const narrow=matchMedia('(max-width:700px)'),ua=navigator.userAgent||'';
  const mobile=navigator.userAgentData?.mobile===true||/Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(ua)||(/Macintosh/i.test(ua)&&navigator.maxTouchPoints>1);
  const moved=new Map();let viewer,active=false,busy=false,controller=null,roots=[],heading,counter,frame,leftRail,rightRail,albums,zoom,fit,fitLabel,info,actions,primary,reviewDock,editDock,below,feedback,labelledBy;
  function move(node,parent,before=null){
    if(!node||!parent||node===before||node.parentNode===parent&&node.nextSibling===before)return;
    if(!moved.has(node)&&node.parentNode){const anchor=document.createComment('personal-photo-control');node.before(anchor);moved.set(node,anchor);}
    parent.insertBefore(node,before);
  }
  function arrange(parent,nodes){let before=null;for(const node of nodes.filter(Boolean).reverse()){move(node,parent,before);before=node;}}
  function element(tag,id,parent){const node=document.createElement(tag);node.id=id;if(parent)parent.append(node);return node;}
  function restore(){
    if(!active)return;
    for(const [node,anchor]of [...moved].reverse()){
      if(anchor.isConnected&&node.isConnected)anchor.replaceWith(node);else anchor.remove();
    }
    moved.clear();for(const root of roots)root.remove();roots=[];
    viewer.classList.remove('personal-photo-desktop');
    if(labelledBy===null)viewer.removeAttribute('aria-labelledby');else viewer.setAttribute('aria-labelledby',labelledBy);
    active=false;controller=null;
  }
  function create(){
    const header=viewer.querySelector('.media-viewer-header'),footer=viewer.querySelector('.media-viewer-footer'),stage=$('mediaStage');
    labelledBy=viewer.getAttribute('aria-labelledby');
    heading=element('div','personalPhotoHeading',header);heading.setAttribute('role','heading');heading.setAttribute('aria-level','2');
    counter=element('span','personalPhotoCounter',heading);
    frame=element('div','personalPhotoFrame');stage.before(frame);
    leftRail=element('div','personalPhotoLeft',frame);rightRail=element('div','personalPhotoRight',frame);
    albums=element('div','personalPhotoAlbums',leftRail);reviewDock=element('div','personalPhotoReview',leftRail);
    zoom=element('div','personalPhotoZoom',rightRail);editDock=element('div','personalPhotoEdit',rightRail);
    zoom.setAttribute('role','group');
    fit=element('button','personalPhotoFit',zoom);fit.type='button';
    fit.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/></svg>';
    fitLabel=element('span','personalPhotoFitLabel',fit);
    fit.addEventListener('click',()=>controller?.toolbar?.querySelector('[data-face-zoom-reset]')?.click());
    below=element('div','personalPhotoBelow');footer.insertBefore(below,footer.firstChild);
    info=element('div','personalPhotoInformation',below);actions=element('div','personalPhotoActions',below);
    primary=element('div','personalPhotoPrimary',actions);
    feedback=element('div','personalPhotoFeedback',below);
    roots=[heading,frame,below];active=true;viewer.classList.add('personal-photo-desktop');viewer.setAttribute('aria-labelledby','personalPhotoHeading');
  }
  function sync(faces){
    viewer=$('mediaViewer');if(!viewer||busy)return;
    const item=window.FamilyMedia?.current?.(),scope=viewer.getAttribute('data-media-scope')||'';
    if(!viewer.open||item?.kind!=='photo'||!scope.startsWith('personal:')||mobile||narrow.matches){restore();return;}
    busy=true;const focused=document.activeElement,entering=!active;
    try{
      if(!active)create();
      for(const [node,anchor]of moved)if(!anchor.isConnected){anchor.remove();moved.delete(node);}
      const changed=controller!==faces;controller=faces?.item?.id===item.id&&faces.dialog===viewer?faces:null;
      move($('mediaHeaderCaption'),heading,counter);
      const position=($('mediaViewerCounter')?.textContent||'').match(/(\d+)\s*\/\s*(\d+)/);
      counter.textContent=position?tr('תמונה '+position[1]+' מתוך '+position[2],'Photo '+position[1]+' of '+position[2]):$('mediaViewerCounter')?.textContent||'';
      heading.setAttribute('aria-label',[$('mediaHeaderCaption')?.textContent||tr('תמונה','Photo'),counter.textContent].filter(Boolean).join(' · '));
      move($('mediaStage'),frame,rightRail);move($('mediaViewerCollections'),albums);
      const collection=$('mediaViewerCollections')?.querySelector('.photo-collections');
      if(collection)arrange(collection,[collection.querySelector('[data-photo-album-kind="wedding"]'),collection.querySelector('[data-photo-album-kind="family"]'),collection.querySelector('[data-photo-album-kind="baby"]')]);
      const moment=$('photoMomentTools');move(moment,info);
      if(controller?.regionsButton)move(controller.regionsButton,moment);
      const taken=moment?.querySelector('.photo-taken-date');if(taken)move(taken,$('editPhotoDate'));
      arrange(primary,[$('mediaViewerDelete'),$('editOpenedCaption'),$('openedProfilePhoto')]);
      arrange(editDock,[$('editOpenedPhoto')]);arrange(reviewDock,[controller?.reviewButton]);
      const sharing=$('mediaShareActions'),copy=$('copyMediaLink'),download=$('mediaOriginal');
      move(copy,sharing,$('shareMediaWhatsApp'));move(download,sharing,copy);
      move(sharing,below,feedback);move($('openedCaptionForm'),below,feedback);
      arrange(feedback,[controller?.regionsNote,controller?.reviewStatus]);
      if(controller?.toolbar)move(controller.toolbar,zoom);
      fitLabel.textContent=tr('התאמה למסך','Fit photo');fit.title=tr('התאמת התמונה למסך','Fit the photo to the screen');zoom.setAttribute('aria-label',fit.title);
      const reset=controller?.toolbar?.querySelector('[data-face-zoom-reset]');fit.disabled=!reset||reset.disabled;
      if((entering||changed)&&controller)window.FamilyFaces?.fit?.();
    }finally{if(focused?.isConnected&&viewer.contains(focused)&&document.activeElement!==focused)focused.focus({preventScroll:true});busy=false;}
  }
  window.FamilyPersonalPhotoLayout={sync,restore};
  function init(){viewer=$('mediaViewer');viewer?.addEventListener('close',restore);window.FamilyPhotoViewerLayout?.sync();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
