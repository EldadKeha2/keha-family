(() => {
 'use strict';
 const $=id=>document.getElementById(id),tr=(he,en)=>window.FamilyI18n.isEnglish?en:he;
 const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const fullscreenIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3H3v6M3 3l7 7M15 3h6v6M21 3l-7 7M3 15v6h6M3 21l7-7M15 21h6v-6M21 21l-7-7"/></svg>';
 const galleryIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>';
 let root,anchor,active=false,hadNative=false;
 function controls(item,scope,{viewer=false}={}){
  const id=safe(item.id||item.file),context=safe(scope||item.scope||'videos'),galleryLabel=tr('פתיחה בגלריית הסרטונים','Open video gallery'),fullscreenLabel=tr('מסך מלא','Full screen');
  return `<div class="video-overlay-tools"><div class="video-overlay-editing">${window.FamilyVideoEditor?.controls(item,scope)||''}<button type="button" class="video-gallery-launch" ${viewer?'data-video-gallery-viewer':`data-media-open="${id}" data-media-scope="${context}"`} aria-label="${galleryLabel}" title="${galleryLabel}">${galleryIcon}</button></div><button type="button" class="video-fullscreen-launch" data-video-fullscreen="${id}" data-video-scope="${context}" aria-label="${fullscreenLabel}" title="${fullscreenLabel}">${fullscreenIcon}</button></div>`;
 }
 function tile(item,scope){
  const id=safe(item.id||item.file),context=safe(scope),title=item.caption||tr('ניגון הסרטון','Play video'),caption=item.caption||tr('הוספת תיאור','Add a description');
  const duration=Number(item.duration),time=Number.isFinite(duration)&&duration>0?Math.floor(duration/60)+':'+String(Math.floor(duration%60)).padStart(2,'0'):'';
  const preview=item.provider==='youtube'?`<img src="${safe(item.poster)}" alt="" loading="lazy" decoding="async">`:`<video muted playsinline preload="metadata" tabindex="-1" aria-hidden="true"><source src="${safe(item.src.split('#')[0]+'#t=0.1')}" type="${safe(item.mime)}"></video>`;
  return `<div class="video-tile-preview"><button type="button" class="video-tile-open" data-media-open="${id}" data-media-scope="${context}" aria-label="${safe(title)}"><span class="video-tile-cover"><span class="video-tile-placeholder" aria-hidden="true">▤</span>${preview}<span class="video-tile-play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m9 5 10 7-10 7Z"/></svg></span>${time?`<span class="video-tile-duration" aria-hidden="true">${time}</span>`:''}</span></button>${controls(item,scope)}</div><button type="button" class="video-tile-caption ${item.caption?'':'is-empty'}" data-video-caption="${id}" data-video-scope="${context}" dir="auto" title="${safe(caption)}">${safe(caption)}</button>`;
 }
 function mount(){
  if(root||!$('mediaViewer'))return;
  root=document.createElement('div');root.id='videoFullscreenRoot';root.hidden=true;root.setAttribute('role','group');root.setAttribute('aria-label',tr('סרטון במסך מלא','Fullscreen video'));
  root.innerHTML=`<button type="button" class="video-fullscreen-exit" aria-label="${tr('יציאה ממסך מלא','Exit fullscreen')}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button><button type="button" class="video-fullscreen-previous" aria-label="${tr('הסרטון הקודם','Previous video')}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg></button><button type="button" class="video-fullscreen-next" aria-label="${tr('הסרטון הבא','Next video')}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg></button>`;
  $('mediaViewer').append(root);
  root.querySelector('.video-fullscreen-exit').addEventListener('click',()=>exit());
  root.querySelector('.video-fullscreen-previous').addEventListener('click',()=>window.FamilyMedia.step(-1));
  root.querySelector('.video-fullscreen-next').addEventListener('click',()=>window.FamilyMedia.step(1));
  $('mediaViewer').addEventListener('cancel',event=>{if(active){event.preventDefault();exit();}});
  $('mediaViewer').addEventListener('close',()=>exit({focus:false}));
 }
 function exit({focus=true}={}){
  if(!active)return false;active=false;hadNative=false;
  if(document.fullscreenElement===root)Promise.resolve(document.exitFullscreen?.()).catch(()=>{});
  const stage=$('mediaStage');if(anchor?.parentNode){anchor.before(stage);anchor.remove();}anchor=null;
  root.hidden=true;$('mediaViewer').classList.remove('video-fullscreen');
  if(focus&&$('mediaViewer').open)stage.querySelector('[data-video-fullscreen]')?.focus({preventScroll:true});
  return true;
 }
 function enter(){
  mount();if(active||!root||!$('mediaViewer').open||window.FamilyMedia?.current()?.kind!=='video')return false;
  active=true;const stage=$('mediaStage');anchor=document.createComment('video-stage-position');stage.before(anchor);root.prepend(stage);root.hidden=false;$('mediaViewer').classList.add('video-fullscreen');
  root.querySelector('.video-fullscreen-exit').focus({preventScroll:true});
  try{const request=root.requestFullscreen?.();if(request)Promise.resolve(request).then(()=>{if(active)hadNative=true;else if(document.fullscreenElement===root)document.exitFullscreen?.();}).catch(()=>{});}catch{}
  return true;
 }
 function present(item,scope){
  mount();const video=item?.kind==='video';$('mediaViewer')?.classList.toggle('video-gallery-viewer',video);
  if(!video){exit({focus:false});return;}
  const stage=$('mediaStage');stage.querySelector('.video-overlay-tools')?.remove();stage.insertAdjacentHTML('beforeend',controls(item,scope,{viewer:true}));
  if(root)for(const selector of ['.video-fullscreen-previous','.video-fullscreen-next'])root.querySelector(selector).hidden=$('mediaNext').hidden;
 }
 document.addEventListener('click',event=>{
  const edit=event.target.closest('[data-video-edit]');if(!edit||!active)return;
  event.preventDefault();event.stopImmediatePropagation();const item=window.FamilyMedia.current(),scope=edit.dataset.videoScope;exit();window.FamilyVideoEditor.open(item,scope);
 },true);
 document.addEventListener('click',event=>{
  const fullscreen=event.target.closest('[data-video-fullscreen]');if(fullscreen){event.preventDefault();if(active){exit();return;}const media=window.FamilyMedia;if(!media.isOpen(fullscreen.dataset.videoScope)||media.current()?.id!==fullscreen.dataset.videoFullscreen)media.openFrom(fullscreen.dataset.videoScope,fullscreen.dataset.videoFullscreen);enter();return;}
  const gallery=event.target.closest('[data-video-gallery-viewer]');if(gallery){event.preventDefault();exit();$('mediaNext').focus({preventScroll:true});return;}
  const caption=event.target.closest('[data-video-caption]');if(caption){event.preventDefault();if(window.FamilyMedia.openFrom(caption.dataset.videoScope,caption.dataset.videoCaption))$('editOpenedCaption').click();}
 });
 document.addEventListener('fullscreenchange',()=>{if(document.fullscreenElement===root)hadNative=true;else if(active&&hadNative)exit();});
 document.addEventListener('DOMContentLoaded',mount);
 window.FamilyVideoPresentation={controls,tile,present,enter,exit,isActive:()=>active};
})();
