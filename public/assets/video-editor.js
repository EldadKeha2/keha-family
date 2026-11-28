(() => {
 'use strict';
 const $=id=>document.getElementById(id),I=window.FamilyI18n,tr=(he,en)=>I.isEnglish?en:he;
 const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const editIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4v14a2 2 0 0 0 2 2h14M8 2v14h14M3 8h13V3M16 8l4 4m-9 4 2-5 6-6a2.8 2.8 0 0 1 4 4l-6 6-6 1Z"/></svg>';
 const pencilIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5 4 4M4 20l4-1 12-12a2.8 2.8 0 0 0-4-4L4 15v5Z"/></svg>';
 const trashIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6m4-6v6"/></svg>';

 let active=null,dialog=null,player=null,saving=false,queuedSeek=null,deleteDialog=null,pendingDelete=null,progressState=null;
 const clock=value=>{value=Math.max(0,Number(value)||0);const hours=Math.floor(value/3600),minutes=Math.floor(value/60)%60,seconds=(value%60).toFixed(2).padStart(5,'0');return (hours?String(hours)+':':'')+String(minutes).padStart(2,'0')+':'+seconds;};
 function seconds(value){const parts=String(value).trim().replace(',','.').split(':');if(!parts.length||parts.length>3||parts.some(p=>!/^\d+(?:\.\d+)?$/.test(p)))return NaN;if(parts.length>1&&parts.slice(1).some(p=>Number(p)>=60))return NaN;return parts.reduce((n,p)=>n*60+Number(p),0);}
 function controls(item,scope){
  if(!item.id||item.kind!=='video')return '';
  if(item.segmentWork)return `<button type="button" class="video-edit-button" data-segment-work="${safe(item.id)}">${editIcon}<span>${tr('המשך חלוקה למקטעים','Resume splitting')}</span></button>`;
  const label=tr('עריכת פרטי המקטעים','Edit segment details');
  const project=item.hasSegmentProject?`<button type="button" class="video-edit-button" data-video-project="${safe(item.id)}" aria-label="${label}" title="${label}"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M9 5v14m6-14v14"/></svg><span>${label}</span></button>`:'';
  return `<button type="button" class="video-edit-button" data-video-edit="${safe(item.id)}" data-video-scope="${safe(scope)}" aria-label="${tr('עריכת הסרטון','Edit video')}">${editIcon}<span>${tr('עריכה','Edit')}</span></button>`+project;
 }
 function youtubeFrame(start,end){return 'https://www.youtube-nocookie.com/embed/'+active.item.youtubeId+'?rel=0&start='+Math.floor((active.item.youtubeStart||0)+start)+(end?'&end='+Math.ceil((active.item.youtubeStart||0)+end):'');}
 function feedback(message='',failed=false){$('videoClipStatus').textContent=message;$('videoClipStatus').classList.toggle('is-error',failed);}
 function progressTime(){
  if(!progressState)return;
  const elapsed=Math.floor((Date.now()-progressState.started)/1000);
  $('videoClipElapsed').textContent=String(Math.floor(elapsed/60)).padStart(2,'0')+':'+String(elapsed%60).padStart(2,'0');
 }
 function resetProgress(){if(progressState)clearInterval(progressState.timer);progressState=null;$('videoClipProgress').hidden=true;}
 function updateProgress(percent,stage='processing'){
  if(!progressState||!Number.isFinite(percent))return;
  progressState.percent=Math.max(progressState.percent,Math.min(100,Math.floor(percent)));
  $('videoClipProgressBar').value=progressState.percent;$('videoClipPercent').textContent=progressState.percent+'%';
  $('videoClipProgressLabel').textContent=stage==='complete'?tr('הקטע נמחק והסרטון נשמר ✓','Segment deleted and video saved ✓'):stage==='saving'?tr('שומר את הסרטון…','Saving the video…'):stage==='preparing'?tr('מכין את הסרטון למחיקת הקטע…','Preparing to delete the segment…'):tr('מוחק את הקטע ומחבר את הסרטון…','Deleting the segment and joining the video…');
 }
 function startProgress(){
  resetProgress();progressState={started:Date.now(),percent:0};$('videoClipProgress').hidden=false;updateProgress(0,'preparing');progressTime();progressState.timer=setInterval(progressTime,1000);
 }
 async function saveResult(response){
  const missing=()=>Error(tr('לא התקבל אישור שמירה. נסו שוב.','No save confirmation was received. Try again.'));
  if(!response.headers.get('Content-Type')?.includes('application/x-ndjson')){
   let result;try{result=await response.json();}catch{throw missing();}
   if(!response.ok)throw Error(I.error(result.error)||tr('לא ניתן לשמור את הקטע.','The clip could not be saved.'));return result;
  }
  if(!response.ok||!response.body)throw missing();
  const reader=response.body.getReader(),decoder=new TextDecoder();let pending='',result;
  const consume=line=>{
   if(!line.trim())return;const event=JSON.parse(line);
   if(event.type==='error')throw Error(I.error(event.error)||tr('לא ניתן לשמור את הקטע.','The clip could not be saved.'));
   if(event.type==='progress')updateProgress(Math.min(99,event.percent),event.stage);
   if(event.type==='complete'&&event.result){result=event.result;}
  };
  try{
   while(true){const next=await reader.read();pending+=decoder.decode(next.value||new Uint8Array(),{stream:!next.done});let boundary;while((boundary=pending.indexOf('\n'))>=0){consume(pending.slice(0,boundary));pending=pending.slice(boundary+1);}if(next.done)break;}
   if(pending.trim())consume(pending);if(!result)throw missing();return result;
  }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
 }
 function fitName(){
  if(!active||!dialog?.open)return;
  const field=$('videoClipName'),style=typeof getComputedStyle==='function'?getComputedStyle(field):null;
  if(field.hidden)return;
  const minimum=parseFloat(style?.minHeight)||40,maximum=parseFloat(style?.maxHeight)||180,border=(parseFloat(style?.borderTopWidth)||0)+(parseFloat(style?.borderBottomWidth)||0);
  field.style.height='auto';field.style.height=Math.min(maximum,Math.max(minimum,Math.ceil((field.scrollHeight||0)+border)))+'px';
 }
 function editName(editing){
  if(!active||saving)return;
  active.nameExpanded=editing;$('videoClipName').hidden=!editing;$('videoClipSaveName').hidden=!editing;$('videoClipEditName').hidden=editing;$('videoClipSubtitle').hidden=editing||!$('videoClipName').value.trim();
  $('videoClipEditName').setAttribute('aria-expanded',String(editing));
  if(editing){feedback();fitName();$('videoClipName').focus();$('videoClipName').select();}
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
  if(boundary)active.deleteRequest=null;
  const name=$('videoClipName').value.trim();$('videoClipSubtitle').textContent=name;$('videoClipSubtitle').hidden=active.nameExpanded||!name;
  $('videoClipSave').disabled=saving||!valid||!name;$('videoClipSaveNew').disabled=saving||!valid||!name;
  $('videoClipSaveName').disabled=saving||!name;$('videoClipEditName').disabled=saving;$('videoClipName').readOnly=saving;
  for(const id of ['videoClipStart','videoClipEnd','videoClipStartRange','videoClipEndRange','videoClipCategory'])$(id).disabled=saving;
  const removing=Boolean(active.removeMode);
  dialog.classList.toggle('is-removing-segment',removing);
  $('videoClipDeleteRange').hidden=active.item.provider==='youtube';
  $('videoClipDeleteRange').disabled=saving||!valid||!active.knownDuration||active.duration-(end-start)<.099;
  $('videoClipDeleteRange').setAttribute('aria-pressed',String(removing));
  $('videoClipDeleteLabel').textContent=removing?tr('אשר מחיקה','Confirm deletion'):tr('מחיקת הקטע הנבחר','Delete selected segment');
  $('videoClipExitDelete').hidden=!removing;$('videoClipExitDelete').disabled=saving;
  $('videoClipSave').disabled=$('videoClipSave').disabled||removing;
  $('videoClipSaveNew').disabled=$('videoClipSaveNew').disabled||removing;
  if(valid){$('videoClipStartRange').value=start;$('videoClipEndRange').value=end;}
  const max=Math.max(active.duration,end||0,1);$('videoClipSelection').style.left=(Math.max(0,start)/max*100)+'%';$('videoClipSelection').style.width=(Math.max(0,end-start)/max*100)+'%';
  const length=removing?active.duration-(end-start):end-start;
  $('videoClipLength').textContent=valid?clock(length):'—';
  $('videoClipLength').setAttribute('aria-label',valid?tr('אורך הסרטון: ','Video length: ')+clock(length):tr('בחרו זמן התחלה וסיום תקינים','Choose a valid start and end'));
  if(boundary&&valid)showFrame(boundary==='end'?end:start);
 }
 function close(){if(saving)return;resetProgress();const previous=active;pendingDelete=null;deleteDialog?.close();queuedSeek=null;pausePlayer();window.FamilyTags?.clearInline($('videoClipTags'));dialog.close();if(player?.tagName==='VIDEO'){player.removeAttribute('src');player.load();}else if(player)player.removeAttribute('src');active=null;if(previous?.objectURL)URL.revokeObjectURL(previous.objectURL);previous?.onCancel?.();}
 function viewer(item,scope){const button=$('editOpenedVideo');if(button){button.hidden=item.kind!=='video'||!item.id;const photo=$('editOpenedPhoto');if(photo){button.innerHTML=photo.innerHTML;button.className=photo.className;}button.setAttribute('aria-label',tr('עריכת הסרטון','Edit video'));button.dataset.videoEdit=item.id||'';button.dataset.videoScope=scope||item.scope||'';}}
 function categoryPicker(item,scope){const source=['videos','nostalgia'].includes(scope)?scope:item.scope;return source==='videos'?window.FamilyVideoCategories:source==='nostalgia'?window.FamilyNostalgia:null;}
 function editCategory(){
  if(saving||!active||active.selectionOnly)return;
  queuedSeek=null;pausePlayer();
  categoryPicker(active.item,active.scope)?.openAssign?.(active.item.id);
 }
 function open(item,scope,options={}){
  if(!item?.id||item.kind!=='video'||saving)return;for(const video of document.querySelectorAll('video'))if(!video.paused)video.pause();
  resetProgress();queuedSeek=null;active={item,scope,start:options.range?.start||0,end:options.range?.end||item.duration||60,duration:item.duration||60,knownDuration:Boolean(item.duration),valid:false,removeMode:Boolean(options.range?.remove),clipId:crypto.randomUUID().replaceAll('-',''),payload:null,...options};
  $('videoClipProject').hidden=Boolean(options.selectionOnly)||!item.hasSegmentProject;
  $('videoClipCategory').hidden=Boolean(options.selectionOnly)||!categoryPicker(item,scope)?.openAssign;
  $('videoClipName').maxLength=options.selectionOnly?140:5000;$('videoClipName').value=(options.name||item.caption||I.mediaName(item)||tr('סרטון','Video')).slice(0,$('videoClipName').maxLength);$('videoClipStart').value=clock(active.start);$('videoClipEnd').value=clock(active.end);
  editName(false);dialog.classList.toggle('is-selection',Boolean(options.selectionOnly));
  active.initialStart=active.start;active.initialEnd=seconds(clock(active.end));
  $('videoClipPlayer').replaceChildren();feedback();$('videoClipSave').textContent=options.selectionOnly?tr('החלת בחירת הקטע','Apply selection'):tr('שמור','Save');$('videoClipSaveNew').hidden=Boolean(options.selectionOnly);$('videoClipTags').hidden=Boolean(options.selectionOnly);$('videoClipTags').inert=false;
  if(options.selectionOnly)window.FamilyTags?.clearInline($('videoClipTags'));else window.FamilyTags?.mountDraft($('videoClipTags'),item);
  player=document.createElement(item.provider==='youtube'?'iframe':'video');player.className='video-clip-player';
  const editor=active,media=player,ownsPlayer=()=>active===editor&&player===media;
  if(item.provider==='youtube'){player.src=youtubeFrame(0,0);player.title=I.mediaName(item);player.allow='autoplay; encrypted-media; picture-in-picture; fullscreen';player.allowFullscreen=true;player.referrerPolicy='strict-origin-when-cross-origin';}
  else{player.controls=true;player.playsInline=true;player.preload=options.selectionOnly?'auto':'metadata';player.setAttribute('aria-label',tr('הסרטון במצב עריכה','Video in edit mode'));player.addEventListener('loadedmetadata',()=>{if(!ownsPlayer()||!Number.isFinite(media.duration)||media.duration<=0)return;active.duration=options.selectionOnly&&item.duration>0?item.duration:media.duration;active.knownDuration=true;active.end=active.range?.end||active.duration;active.initialEnd=seconds(clock(active.end));for(const id of ['videoClipStartRange','videoClipEndRange'])$(id).max=active.duration;$('videoClipEnd').value=clock(active.end);sync('fields','start');});for(const event of ['seeked','loadeddata'])media.addEventListener(event,()=>{if(ownsPlayer())flushSeek();});player.addEventListener('error',()=>{if(ownsPlayer())feedback(tr('לא ניתן לטעון את הסרטון כרגע. סגרו ונסו שוב.','The video could not load. Close and try again.'),true);});player.src=item.src;}
  $('videoClipPlayer').appendChild(player);$('videoClipTimeline').hidden=item.provider==='youtube';
  for(const id of ['videoClipStartRange','videoClipEndRange'])$(id).max=active.duration;$('videoClipStartRange').value=active.start;$('videoClipEndRange').value=active.end;
  sync();dialog.showModal();fitName();
 }
 async function saveName(){
  if(!active||saving||!active.nameExpanded)return;
  const editor=active,field=$('videoClipName'),caption=field.value.trim(),name=caption.slice(0,140);
  if(!name){feedback(tr('הזינו כיתוב לסרטון.','Enter a video caption.'),true);field.focus();return;}
  if(editor.selectionOnly){editName(false);sync();$('videoClipEditName').focus({preventScroll:true});return;}
  const details={name,caption,range:null,expectedName:editor.item.name,expectedCaption:editor.item.caption||'',expectedVideoRevision:editor.item.videoRevision||'original'},signature=JSON.stringify(details);
  if(editor.nameRequest?.signature!==signature)editor.nameRequest={signature,operationId:crypto.randomUUID().replaceAll('-','')};
  saving=true;queuedSeek=null;pausePlayer();$('videoClipClose').disabled=true;dialog.setAttribute('aria-busy','true');feedback(tr('שומר את הכיתוב…','Saving caption…'));sync();
  try{
   const response=await I.fetch('api/media/'+encodeURIComponent(editor.item.id)+'/video-edit',{method:'POST',headers:{'Content-Type':'application/json','X-Family-Token':window.FAMILY_API_TOKEN},body:JSON.stringify({...details,operationId:editor.nameRequest.operationId})});
   let result;try{result=await response.json();}catch{throw Error(tr('לא התקבל אישור שמירה. נסו שוב.','No save confirmation was received. Try again.'));}
   if(!response.ok)throw Error(I.error(result.error)||tr('לא ניתן לשמור את הכיתוב.','The caption could not be saved.'));
   editor.item={...editor.item,...(result.item?.id===editor.item.id?result.item:{}),name,caption};editor.nameRequest=null;
   window.dispatchEvent(new CustomEvent('family-media-changed',{detail:result}));
   saving=false;editName(false);sync();feedback(tr('הכיתוב נשמר ✓','Caption saved ✓'));$('videoClipEditName').focus({preventScroll:true});
  }catch(error){feedback(error.message,true);}finally{saving=false;$('videoClipClose').disabled=false;dialog.removeAttribute('aria-busy');if(active)sync();}
 }
 async function save(event){
  event.preventDefault();sync();if(!active?.valid||saving)return;
  if(active.removeMode&&!event.deleteRange)return;
  if(event.deleteRange&&(!active.removeMode||active.duration-(active.end-active.start)<.099))return;
  if(active.selectionOnly){const confirm=active.onConfirm,selection={start:active.start,end:active.end,...(event.deleteRange?{remove:true}:{}),duration:active.duration,name:$('videoClipName').value.trim()};active.onCancel=null;close();confirm?.(selection);return;}
  const saveAsNew=event.submitter?.id==='videoClipSaveNew';
  saving=true;queuedSeek=null;pausePlayer();$('videoClipSave').disabled=$('videoClipSaveNew').disabled=$('videoClipClose').disabled=true;$('videoClipTags').inert=true;dialog.setAttribute('aria-busy','true');feedback(tr('שומר את השינויים…','Saving changes…'));sync();
  if(event.deleteRange)startProgress();else resetProgress();
  try{
   const tags=await window.FamilyTags?.draftSelection($('videoClipTags'))||{},caption=$('videoClipName').value.trim(),name=caption.slice(0,140),changedRange=Math.abs(active.start-active.initialStart)>.0001||Math.abs(active.end-active.initialEnd)>.0001;
   const payload={name,caption,...tags,expectedName:active.item.name,expectedCaption:active.item.caption||'',expectedVideoRevision:active.item.videoRevision||'original',...(saveAsNew?{clipId:active.clipId,start:active.start,end:active.end}:{operationId:active.clipId,range:changedRange||event.deleteRange?{start:active.start,end:active.end,...(event.deleteRange?{remove:true}:{})}:null})};
   const signature=JSON.stringify({...payload,clipId:'',operationId:''});if(active.payload&&active.payload!==signature){active.clipId=crypto.randomUUID().replaceAll('-','');if(saveAsNew)payload.clipId=active.clipId;else payload.operationId=active.clipId;}active.payload=signature;
   const response=await I.fetch('api/media/'+encodeURIComponent(active.item.id)+(event.deleteRange?'/video-remove':saveAsNew?'/clip':'/video-edit'),{method:'POST',headers:{'Content-Type':'application/json','X-Family-Token':window.FAMILY_API_TOKEN,...(event.deleteRange?{Accept:'application/x-ndjson'}:{})},body:JSON.stringify(payload)});
   const result=await saveResult(response);
   if(event.deleteRange){updateProgress(100,'complete');clearInterval(progressState.timer);progressTime();await new Promise(resolve=>setTimeout(resolve,450));}
   window.dispatchEvent(new CustomEvent('family-media-changed',{detail:result}));
   window.FamilyApp?.toast(event.deleteRange?tr('הקטע נמחק ושאר הסרטון חובר ונשמר ✓','The segment was deleted and the remaining video was joined and saved ✓'):saveAsNew?tr('הקטע נשמר כסרטון נוסף באותה תיקייה ✓','The clip was saved as another video in this folder ✓'):tr('השינויים בסרטון נשמרו ✓','Video changes saved ✓'));
   saving=false;close();
  }catch(error){feedback(error.message,true);if(progressState){clearInterval(progressState.timer);$('videoClipProgressLabel').textContent=tr('המחיקה לא הושלמה. אפשר לנסות שוב.','Deletion did not finish. You can try again.');}}finally{saving=false;$('videoClipClose').disabled=false;$('videoClipTags').inert=false;dialog.removeAttribute('aria-busy');if(active)sync();}
 }
 function exitDeleteMode(){
  if(!active||saving)return;
  pendingDelete=null;deleteDialog?.close();active.removeMode=false;feedback();sync();$('videoClipDeleteRange').focus({preventScroll:true});
 }
 function deleteRange(){
  if(!active||saving)return;sync();if($('videoClipDeleteRange').disabled)return;
  if(!active.removeMode){active.removeMode=true;pausePlayer();feedback();sync();return;}
  if(!deleteDialog){
   deleteDialog=document.createElement('dialog');deleteDialog.id='videoClipDeleteDialog';deleteDialog.className='media-selection-dialog';deleteDialog.setAttribute('data-i18n-skip','');deleteDialog.setAttribute('aria-labelledby','videoClipDeleteTitle');
   deleteDialog.innerHTML=`<h2 id="videoClipDeleteTitle">${tr('למחוק את הקטע הנבחר?','Delete the selected segment?')}</h2><p id="videoClipDeleteSummary"></p><div class="media-selection-dialog-actions"><button type="button" id="videoClipDeleteCancel" class="secondary-button">${tr('ביטול','Cancel')}</button><button type="button" id="videoClipDeleteConfirm" class="media-selection-danger">${tr('כן, מחק את הקטע','Yes, delete segment')}</button></div>`;
   document.body.appendChild(deleteDialog);
   $('videoClipDeleteCancel').addEventListener('click',exitDeleteMode);deleteDialog.addEventListener('cancel',event=>{event.preventDefault();exitDeleteMode();});
   $('videoClipDeleteConfirm').addEventListener('click',()=>{const pending=pendingDelete;pendingDelete=null;deleteDialog.close();if(!pending||pending.editor!==active||pending.start!==active.start||pending.end!==active.end)return;void save({preventDefault(){},deleteRange:true});});
  }
  pendingDelete={editor:active,start:active.start,end:active.end};
  $('videoClipDeleteSummary').textContent=tr('הקטע ','The segment ')+clock(active.start)+' – '+clock(active.end)+tr(' יימחק. הקטעים שלפניו ואחריו יחוברו לסרטון אחד.',' will be removed. The parts before and after it will be joined into one video.');
  deleteDialog.showModal();$('videoClipDeleteCancel').focus();
 }
 function init(){
  dialog=document.createElement('dialog');dialog.id='videoClipEditor';dialog.className='photo-upload-editor video-clip-editor is-existing';dialog.setAttribute('data-i18n-skip','');dialog.setAttribute('aria-labelledby','videoClipTitle');
  dialog.innerHTML=`<form id="videoClipForm">
   <header><div class="video-clip-heading">
    <div class="video-clip-title-row"><span class="section-diamond" aria-hidden="true">◇</span><h2 id="videoClipTitle">${tr('עריכת הסרטון','Edit video')}</h2></div>
    <div class="video-clip-subtitle-row"><button type="button" id="videoClipEditName" aria-label="${tr('עריכת שם הסרטון','Edit video name')}" aria-controls="videoClipName" aria-expanded="false">${pencilIcon}</button><button type="button" id="videoClipSaveName" hidden>${tr('שמירת הכיתוב','Save caption')}</button><p id="videoClipSubtitle" dir="auto"></p><textarea id="videoClipName" rows="1" maxlength="5000" dir="auto" required hidden aria-label="${tr('שם הסרטון','Video name')}"></textarea></div>
   </div><button type="button" id="videoClipClose" aria-label="${tr('סגירת עורך הסרטונים','Close video editor')}">×</button></header>
   <section id="videoClipProgress" class="video-clip-progress" hidden aria-label="${tr('התקדמות מחיקת הקטע','Segment deletion progress')}"><div class="video-clip-progress-heading"><span id="videoClipProgressLabel" role="status" aria-live="polite"></span><strong id="videoClipPercent" dir="ltr">0%</strong></div><progress id="videoClipProgressBar" max="100" value="0" aria-label="${tr('התקדמות מחיקת הקטע','Segment deletion progress')}"></progress><div class="video-clip-elapsed"><span>${tr('זמן שחלף','Elapsed time')}</span><output id="videoClipElapsed" dir="ltr">00:00</output></div></section>
   <div id="videoClipPlayer"></div>
   <div class="video-clip-timeline" id="videoClipTimeline"><div class="video-clip-track"><span id="videoClipSelection"></span></div><label>${tr('תחילת הקטע','Clip start')}<input type="range" min="0" max="60" step=".01" value="0" id="videoClipStartRange" aria-label="${tr('תחילת הקטע בציר הזמן','Clip start on timeline')}"></label><label>${tr('סיום הקטע','Clip end')}<input type="range" min="0" max="60" step=".01" value="60" id="videoClipEndRange" aria-label="${tr('סיום הקטע בציר הזמן','Clip end on timeline')}"></label></div>
   <div class="video-clip-timing"><div class="video-clip-times">
    <div class="video-clip-time-row"><label id="videoClipStartLabel" for="videoClipStart">${tr('התחלה','Start')}</label><input type="text" id="videoClipStart" value="00:00.00" dir="ltr" inputmode="decimal" aria-label="${tr('זמן תחילת הקטע','Clip start time')}"></div>
    <div class="video-clip-time-row"><label id="videoClipEndLabel" for="videoClipEnd">${tr('סיום','End')}</label><input type="text" id="videoClipEnd" value="01:00.00" dir="ltr" inputmode="decimal" aria-label="${tr('זמן סיום הקטע','Clip end time')}"></div>
   </div><div class="video-clip-duration"><span>${tr('אורך הסרטון','Video length')}</span><output id="videoClipLength" for="videoClipStart videoClipEnd" dir="ltr" role="status" aria-live="polite"></output></div><button type="button" id="videoClipDeleteRange" class="video-clip-delete-range" aria-pressed="false">${trashIcon}<span id="videoClipDeleteLabel">${tr('מחיקת הקטע הנבחר','Delete selected segment')}</span></button></div>
   <button type="button" id="videoClipExitDelete" class="video-clip-exit-delete" hidden>${tr('יציאה ממצב מחיקה','Exit deletion mode')}</button>
   <div class="video-clip-completion"><div id="videoClipTags" class="video-clip-tags"></div>
    <footer><button type="submit" class="primary-button" id="videoClipSave">${tr('שמור','Save')}</button><button type="submit" class="secondary-button" id="videoClipSaveNew">${tr('שמור כקובץ חדש','Save as new clip')}</button><button type="button" id="videoClipProject" class="secondary-button" hidden>${tr('עריכת פרטי המקטעים','Edit segment details')}</button><button type="button" class="secondary-button video-clip-category" id="videoClipCategory" hidden>${tr('שיוך לקטגוריה אחרת','Change video category')}</button></footer>
    <p id="videoClipStatus" role="status" aria-live="polite"></p>
   </div></form>`;
  document.body.appendChild(dialog);$('videoClipClose').addEventListener('click',close);$('videoClipDeleteRange').addEventListener('click',deleteRange);$('videoClipExitDelete').addEventListener('click',exitDeleteMode);$('videoClipCategory').addEventListener('click',editCategory);dialog.addEventListener('cancel',event=>{event.preventDefault();if(active?.removeMode)exitDeleteMode();else close();});$('videoClipForm').addEventListener('submit',save);
  $('videoClipProject').addEventListener('click',()=>{if(active&&!saving){pausePlayer();window.FamilyVideoUpload?.openProject(active.item.id);}});
  document.addEventListener('click',event=>{const button=event.target.closest?.('[data-video-project]');if(button)window.FamilyVideoUpload?.openProject(button.dataset.videoProject);});
  dialog.addEventListener('keydown',event=>event.stopPropagation());
  for(const [id,boundary]of [['videoClipStart','start'],['videoClipEnd','end']])$(id).addEventListener('input',()=>sync('fields',boundary));
  $('videoClipName').addEventListener('input',()=>{fitName();sync();});
  $('videoClipName').addEventListener('keydown',event=>{if(event.key!=='Enter'||event.shiftKey||event.ctrlKey||event.altKey||event.metaKey||event.isComposing||event.keyCode===229||event.defaultPrevented)return;event.preventDefault();event.stopPropagation();if(!event.repeat)return saveName();});
  $('videoClipSaveName').addEventListener('click',saveName);
  $('videoClipEditName').addEventListener('click',()=>editName(!active?.nameExpanded));
  if(typeof ResizeObserver==='function'){let width=0;new ResizeObserver(entries=>{const next=entries[0]?.contentRect.width;if(next&&next!==width){width=next;fitName();}}).observe($('videoClipName'));}
  for(const [id,boundary]of [['videoClipStartRange','start'],['videoClipEndRange','end']])$(id).addEventListener('input',()=>sync('ranges',boundary));
  document.addEventListener('click',event=>{const button=event.target.closest?.('[data-video-edit]');if(!button)return;const item=window.FamilyMedia?.lookup(button.dataset.videoScope,button.dataset.videoEdit)||window.FamilyMedia?.current?.();if(item?.id===button.dataset.videoEdit)open(item,button.dataset.videoScope);});
 }
 window.FamilyVideoEditor={controls,viewer,open,clock,seconds,icon:editIcon,select:(file,options={})=>new Promise(resolve=>{const objectURL=options.previewUrl?null:URL.createObjectURL(options.previewFile||file);open({id:crypto.randomUUID().replaceAll('-',''),kind:'video',name:file.name.replace(/\.[^.]+$/,''),filename:file.name,mime:file.type,src:options.previewUrl||objectURL,duration:options.duration},options.scope||'upload',{...options,objectURL,selectionOnly:true,onCancel:()=>resolve(null),onConfirm:resolve});})};document.addEventListener('DOMContentLoaded',init);
})();
