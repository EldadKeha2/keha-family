(() => {
 'use strict';
 const $=id=>document.getElementById(id),I=window.FamilyI18n,tr=(he,en)=>I.isEnglish?en:he;
 const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const editIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4v14a2 2 0 0 0 2 2h14M8 2v14h14M3 8h13V3M16 8l4 4m-9 4 2-5 6-6a2.8 2.8 0 0 1 4 4l-6 6-6 1Z"/></svg>';
 const pencilIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5 4 4M4 20l4-1 12-12a2.8 2.8 0 0 0-4-4L4 15v5Z"/></svg>';

 let active=null,dialog=null,player=null,saving=false,queuedSeek=null;
 const clock=value=>{value=Math.max(0,Number(value)||0);const hours=Math.floor(value/3600),minutes=Math.floor(value/60)%60,seconds=(value%60).toFixed(2).padStart(5,'0');return (hours?String(hours)+':':'')+String(minutes).padStart(2,'0')+':'+seconds;};
 function seconds(value){const parts=String(value).trim().replace(',','.').split(':');if(!parts.length||parts.length>3||parts.some(p=>!/^\d+(?:\.\d+)?$/.test(p)))return NaN;if(parts.length>1&&parts.slice(1).some(p=>Number(p)>=60))return NaN;return parts.reduce((n,p)=>n*60+Number(p),0);}
 function controls(item,scope){return item.id&&item.kind==='video'?`<button type="button" class="video-edit-button" data-video-edit="${safe(item.id)}" data-video-scope="${safe(scope)}" aria-label="${tr('עריכת הסרטון','Edit video')}">${editIcon}<span>${tr('עריכה','Edit')}</span></button>`:'';}
 function youtubeFrame(start,end){return 'https://www.youtube-nocookie.com/embed/'+active.item.youtubeId+'?rel=0&start='+Math.floor((active.item.youtubeStart||0)+start)+(end?'&end='+Math.ceil((active.item.youtubeStart||0)+end):'');}
 function feedback(message='',failed=false){$('videoClipStatus').textContent=message;$('videoClipStatus').classList.toggle('is-error',failed);}
 function fitName(){
  if(!active||!dialog?.open)return;
  const field=$('videoClipName'),style=typeof getComputedStyle==='function'?getComputedStyle(field):null;
  if(field.hidden)return;
  const minimum=parseFloat(style?.minHeight)||40,maximum=parseFloat(style?.maxHeight)||180,border=(parseFloat(style?.borderTopWidth)||0)+(parseFloat(style?.borderBottomWidth)||0);
  field.style.height='auto';field.style.height=Math.min(maximum,Math.max(minimum,Math.ceil((field.scrollHeight||0)+border)))+'px';
 }
 function editName(editing){
  if(!active)return;
  active.nameExpanded=editing;$('videoClipName').hidden=!editing;$('videoClipSubtitle').hidden=editing||!$('videoClipName').value.trim();
  $('videoClipEditName').setAttribute('aria-expanded',String(editing));
  if(editing){fitName();$('videoClipName').focus();}
 }
 function pausePlayer(){if(player?.tagName==='VIDEO')player.pause();}
 function flushSeek(){
  const request=queuedSeek;if(!request||request.player!==player||!active)return;
  if(player.readyState<1||player.seeking)return;
  try{player.currentTime=request.time;queuedSeek=null;}catch{}
 }
 function showFrame(time){
  if(!active||player?.tagName!=='VIDEO'||!Number.isFinite(time))return;
  pausePlayer();queuedSeek={player,time:Math.max(0,Math.min(time,Math.max(0,active.duration-.01)))};flushSeek();
 }
 function sync(source='fields',boundary=null){
  if(!active)return;let start=source==='ranges'?Number($('videoClipStartRange').value):seconds($('videoClipStart').value),end=source==='ranges'?Number($('videoClipEndRange').value):seconds($('videoClipEnd').value);
  if(source==='ranges'){if(start>=end){if(boundary==='start')start=Math.max(0,end-.1);else end=Math.min(active.duration,start+.1);}$('videoClipStart').value=clock(start);$('videoClipEnd').value=clock(end);}
  const valid=Number.isFinite(start)&&Number.isFinite(end)&&start>=0&&end-start>=.099&&(!active.knownDuration||end<=active.duration+.01);
  active.start=start;active.end=end;active.valid=valid;
  const name=$('videoClipName').value.trim();$('videoClipSubtitle').textContent=name;$('videoClipSubtitle').hidden=active.nameExpanded||!name;
  $('videoClipSave').disabled=saving||!valid||!name;$('videoClipSaveNew').disabled=saving||!valid||!name;
  if(valid){$('videoClipStartRange').value=start;$('videoClipEndRange').value=end;}
  const max=Math.max(active.duration,end||0,1);$('videoClipSelection').style.left=(Math.max(0,start)/max*100)+'%';$('videoClipSelection').style.width=(Math.max(0,end-start)/max*100)+'%';
  $('videoClipLength').textContent=valid?clock(end-start):'—';
  $('videoClipLength').setAttribute('aria-label',valid?tr('אורך הסרטון: ','Video length: ')+clock(end-start):tr('בחרו זמן התחלה וסיום תקינים','Choose a valid start and end'));
  if(boundary&&valid)showFrame(boundary==='end'?end:start);
 }
 function close(){if(saving)return;const previous=active;queuedSeek=null;pausePlayer();window.FamilyTags?.clearInline($('videoClipTags'));dialog.close();if(player?.tagName==='VIDEO'){player.removeAttribute('src');player.load();}else if(player)player.removeAttribute('src');active=null;if(previous?.objectURL)URL.revokeObjectURL(previous.objectURL);previous?.onCancel?.();}
 function viewer(item,scope){const button=$('editOpenedVideo');if(button){button.hidden=item.kind!=='video'||!item.id;const photo=$('editOpenedPhoto');if(photo){button.innerHTML=photo.innerHTML;button.className=photo.className;}button.setAttribute('aria-label',tr('עריכת הסרטון','Edit video'));button.dataset.videoEdit=item.id||'';button.dataset.videoScope=scope||item.scope||'';}}
 function categoryPicker(item,scope){const source=['videos','nostalgia'].includes(scope)?scope:item.scope;return source==='videos'?window.FamilyVideoCategories:source==='nostalgia'?window.FamilyNostalgia:null;}
 function editCategory(){
  if(saving||!active||active.selectionOnly)return;
  queuedSeek=null;pausePlayer();
  categoryPicker(active.item,active.scope)?.openAssign?.(active.item.id);
 }
 function open(item,scope,options={}){
  if(!item?.id||item.kind!=='video'||saving)return;for(const video of document.querySelectorAll('video'))if(!video.paused)video.pause();
  queuedSeek=null;active={item,scope,start:options.range?.start||0,end:options.range?.end||item.duration||60,duration:item.duration||60,knownDuration:Boolean(item.duration),valid:false,clipId:crypto.randomUUID().replaceAll('-',''),payload:null,...options};
  $('videoClipCategory').hidden=Boolean(options.selectionOnly)||!categoryPicker(item,scope)?.openAssign;
  $('videoClipName').maxLength=options.selectionOnly?140:5000;$('videoClipName').value=(options.name||item.caption||I.mediaName(item)||tr('סרטון','Video')).slice(0,$('videoClipName').maxLength);$('videoClipStart').value=clock(active.start);$('videoClipEnd').value=clock(active.end);
  editName(false);dialog.classList.toggle('is-selection',Boolean(options.selectionOnly));
  active.initialStart=active.start;active.initialEnd=seconds(clock(active.end));
  $('videoClipPlayer').replaceChildren();feedback();$('videoClipSave').textContent=options.selectionOnly?tr('החלת בחירת הקטע','Apply selection'):tr('שמור','Save');$('videoClipSaveNew').hidden=Boolean(options.selectionOnly);$('videoClipTags').hidden=Boolean(options.selectionOnly);$('videoClipTags').inert=false;
  if(options.selectionOnly)window.FamilyTags?.clearInline($('videoClipTags'));else window.FamilyTags?.mountDraft($('videoClipTags'),item);
  player=document.createElement(item.provider==='youtube'?'iframe':'video');player.className='video-clip-player';
  const editor=active,media=player,ownsPlayer=()=>active===editor&&player===media;
  if(item.provider==='youtube'){player.src=youtubeFrame(0,0);player.title=I.mediaName(item);player.allow='autoplay; encrypted-media; picture-in-picture; fullscreen';player.allowFullscreen=true;player.referrerPolicy='strict-origin-when-cross-origin';}
  else{player.controls=true;player.playsInline=true;player.preload='metadata';player.src=item.src;player.setAttribute('aria-label',tr('הסרטון במצב עריכה','Video in edit mode'));player.addEventListener('loadedmetadata',()=>{if(!ownsPlayer()||!Number.isFinite(media.duration)||media.duration<=0)return;active.duration=media.duration;active.knownDuration=true;active.end=active.range?.end||media.duration;active.initialEnd=seconds(clock(active.end));for(const id of ['videoClipStartRange','videoClipEndRange'])$(id).max=media.duration;$('videoClipEnd').value=clock(active.end);sync('fields','start');});for(const event of ['seeked','loadeddata'])media.addEventListener(event,()=>{if(ownsPlayer())flushSeek();});player.addEventListener('error',()=>{if(ownsPlayer())feedback(tr('לא ניתן לטעון את הסרטון כרגע. סגרו ונסו שוב.','The video could not load. Close and try again.'),true);});}
  $('videoClipPlayer').appendChild(player);$('videoClipMarkStart').hidden=$('videoClipMarkEnd').hidden=item.provider==='youtube';$('videoClipStartLabel').hidden=$('videoClipEndLabel').hidden=item.provider!=='youtube';$('videoClipTimeline').hidden=item.provider==='youtube';
  for(const id of ['videoClipStartRange','videoClipEndRange'])$(id).max=active.duration;$('videoClipStartRange').value=active.start;$('videoClipEndRange').value=active.end;
  sync();dialog.showModal();fitName();
 }
 async function save(event){
  event.preventDefault();sync();if(!active?.valid||saving)return;
  if(active.selectionOnly){const confirm=active.onConfirm,selection={start:active.start,end:active.end,duration:active.duration,name:$('videoClipName').value.trim()};active.onCancel=null;close();confirm?.(selection);return;}
  const saveAsNew=event.submitter?.id==='videoClipSaveNew';
  saving=true;queuedSeek=null;pausePlayer();$('videoClipSave').disabled=$('videoClipSaveNew').disabled=$('videoClipClose').disabled=true;$('videoClipTags').inert=true;dialog.setAttribute('aria-busy','true');feedback(tr('שומר את השינויים…','Saving changes…'));
  try{
   const tags=await window.FamilyTags?.draftSelection($('videoClipTags'))||{},caption=$('videoClipName').value.trim(),name=caption.slice(0,140),changedRange=Math.abs(active.start-active.initialStart)>.0001||Math.abs(active.end-active.initialEnd)>.0001;
   const payload={name,caption,...tags,expectedName:active.item.name,expectedCaption:active.item.caption||'',expectedVideoRevision:active.item.videoRevision||'original',...(saveAsNew?{clipId:active.clipId,start:active.start,end:active.end}:{operationId:active.clipId,range:changedRange?{start:active.start,end:active.end}:null})};
   const signature=JSON.stringify({...payload,clipId:'',operationId:''});if(active.payload&&active.payload!==signature){active.clipId=crypto.randomUUID().replaceAll('-','');if(saveAsNew)payload.clipId=active.clipId;else payload.operationId=active.clipId;}active.payload=signature;
   const response=await I.fetch('api/media/'+encodeURIComponent(active.item.id)+(saveAsNew?'/clip':'/video-edit'),{method:'POST',headers:{'Content-Type':'application/json','X-Family-Token':window.FAMILY_API_TOKEN},body:JSON.stringify(payload)});
   let result;try{result=await response.json();}catch{throw Error(tr('לא התקבל אישור שמירה. נסו שוב.','No save confirmation was received. Try again.'));}
   if(!response.ok)throw Error(I.error(result.error)||tr('לא ניתן לשמור את הקטע.','The clip could not be saved.'));
   window.dispatchEvent(new CustomEvent('family-media-changed',{detail:result}));
   window.FamilyApp?.toast(saveAsNew?tr('הקטע נשמר כסרטון נוסף באותה תיקייה ✓','The clip was saved as another video in this folder ✓'):tr('השינויים בסרטון נשמרו ✓','Video changes saved ✓'));
   saving=false;close();
  }catch(error){feedback(error.message,true);}finally{saving=false;$('videoClipClose').disabled=false;$('videoClipTags').inert=false;dialog.removeAttribute('aria-busy');if(active)sync();}
 }
 function init(){
  dialog=document.createElement('dialog');dialog.id='videoClipEditor';dialog.className='photo-upload-editor video-clip-editor is-existing';dialog.setAttribute('data-i18n-skip','');dialog.setAttribute('aria-labelledby','videoClipTitle');
  dialog.innerHTML=`<form id="videoClipForm">
   <header><div class="video-clip-heading">
    <div class="video-clip-title-row"><span class="section-diamond" aria-hidden="true">◇</span><h2 id="videoClipTitle">${tr('עריכת הסרטון','Edit video')}</h2></div>
    <div class="video-clip-subtitle-row"><button type="button" id="videoClipEditName" aria-label="${tr('עריכת שם הסרטון','Edit video name')}" aria-controls="videoClipName" aria-expanded="false">${pencilIcon}</button><p id="videoClipSubtitle" dir="auto"></p><textarea id="videoClipName" rows="1" maxlength="5000" dir="auto" required hidden aria-label="${tr('שם הסרטון','Video name')}"></textarea></div>
   </div><button type="button" id="videoClipClose" aria-label="${tr('סגירת עורך הסרטונים','Close video editor')}">×</button></header>
   <div id="videoClipPlayer"></div>
   <div class="video-clip-timeline" id="videoClipTimeline"><div class="video-clip-track"><span id="videoClipSelection"></span></div><label>${tr('תחילת הקטע','Clip start')}<input type="range" min="0" max="60" step=".01" value="0" id="videoClipStartRange" aria-label="${tr('תחילת הקטע בציר הזמן','Clip start on timeline')}"></label><label>${tr('סיום הקטע','Clip end')}<input type="range" min="0" max="60" step=".01" value="60" id="videoClipEndRange" aria-label="${tr('סיום הקטע בציר הזמן','Clip end on timeline')}"></label></div>
   <div class="video-clip-timing"><div class="video-clip-times">
    <div class="video-clip-time-row"><button type="button" id="videoClipMarkStart">${tr('סימון התחלה כאן','Set start here')}</button><label id="videoClipStartLabel" for="videoClipStart" hidden>${tr('תחילת הקטע','Clip start')}</label><input type="text" id="videoClipStart" value="00:00.00" dir="ltr" inputmode="decimal" aria-label="${tr('זמן תחילת הקטע','Clip start time')}"></div>
    <div class="video-clip-time-row"><button type="button" id="videoClipMarkEnd">${tr('סימון סיום כאן','Set end here')}</button><label id="videoClipEndLabel" for="videoClipEnd" hidden>${tr('סיום הקטע','Clip end')}</label><input type="text" id="videoClipEnd" value="01:00.00" dir="ltr" inputmode="decimal" aria-label="${tr('זמן סיום הקטע','Clip end time')}"></div>
   </div><div class="video-clip-duration"><span>${tr('אורך הסרטון','Video length')}</span><output id="videoClipLength" for="videoClipStart videoClipEnd" dir="ltr" role="status" aria-live="polite"></output></div></div>
   <div class="video-clip-completion"><div id="videoClipTags" class="video-clip-tags"></div>
    <footer><button type="submit" class="primary-button" id="videoClipSave">${tr('שמור','Save')}</button><button type="submit" class="secondary-button" id="videoClipSaveNew">${tr('שמור כקובץ חדש','Save as new clip')}</button><button type="button" class="secondary-button video-clip-category" id="videoClipCategory" hidden>${tr('שיוך לקטגוריה אחרת','Change video category')}</button></footer>
    <p id="videoClipStatus" role="status" aria-live="polite"></p>
   </div></form>`;
  document.body.appendChild(dialog);$('videoClipClose').addEventListener('click',close);$('videoClipCategory').addEventListener('click',editCategory);dialog.addEventListener('cancel',event=>{event.preventDefault();close();});$('videoClipForm').addEventListener('submit',save);
  dialog.addEventListener('keydown',event=>event.stopPropagation());
  for(const [id,boundary]of [['videoClipStart','start'],['videoClipEnd','end']])$(id).addEventListener('input',()=>sync('fields',boundary));
  $('videoClipName').addEventListener('input',()=>{fitName();sync();});
  $('videoClipName').addEventListener('keydown',event=>window.FamilyPhotoKeyboard?.saveDescription(event,()=>{if(!$('videoClipSave').disabled)$('videoClipForm').requestSubmit();}));
  $('videoClipEditName').addEventListener('click',()=>editName(!active?.nameExpanded));
  if(typeof ResizeObserver==='function'){let width=0;new ResizeObserver(entries=>{const next=entries[0]?.contentRect.width;if(next&&next!==width){width=next;fitName();}}).observe($('videoClipName'));}
  for(const [id,boundary]of [['videoClipStartRange','start'],['videoClipEndRange','end']])$(id).addEventListener('input',()=>sync('ranges',boundary));
  $('videoClipMarkStart').addEventListener('click',()=>{if(player?.tagName!=='VIDEO')return;$('videoClipStart').value=clock(player.currentTime);pausePlayer();sync();});
  $('videoClipMarkEnd').addEventListener('click',()=>{if(player?.tagName!=='VIDEO')return;$('videoClipEnd').value=clock(player.currentTime);pausePlayer();sync();});
  document.addEventListener('click',event=>{const button=event.target.closest?.('[data-video-edit]');if(!button)return;const item=window.FamilyMedia?.lookup(button.dataset.videoScope,button.dataset.videoEdit)||window.FamilyMedia?.current?.();if(item?.id===button.dataset.videoEdit)open(item,button.dataset.videoScope);});
 }
 window.FamilyVideoEditor={controls,viewer,open,clock,seconds,icon:editIcon,select:(file,options={})=>new Promise(resolve=>{const objectURL=URL.createObjectURL(file);open({id:crypto.randomUUID().replaceAll('-',''),kind:'video',name:file.name.replace(/\.[^.]+$/,''),filename:file.name,mime:file.type,src:objectURL,duration:options.duration},options.scope||'upload',{...options,objectURL,selectionOnly:true,onCancel:()=>resolve(null),onConfirm:resolve});})};document.addEventListener('DOMContentLoaded',init);
})();
