(() => {
 'use strict';
 const $=id=>document.getElementById(id),I=window.FamilyI18n,tr=(he,en)=>I.isEnglish?en:he;
 const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const scissors='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="m8.5 7.5 12 13m-12-4 12-13M14 12l-3 3"/></svg>';
 let active=null,dialog=null,player=null,saving=false,previewing=false;
 const clock=value=>{value=Math.max(0,Number(value)||0);const hours=Math.floor(value/3600),minutes=Math.floor(value/60)%60,seconds=(value%60).toFixed(2).padStart(5,'0');return (hours?String(hours)+':':'')+String(minutes).padStart(2,'0')+':'+seconds;};
 function seconds(value){const parts=String(value).trim().replace(',','.').split(':');if(!parts.length||parts.length>3||parts.some(p=>!/^\d+(?:\.\d+)?$/.test(p)))return NaN;if(parts.length>1&&parts.slice(1).some(p=>Number(p)>=60))return NaN;return parts.reduce((n,p)=>n*60+Number(p),0);}
 function controls(item,scope){return item.id&&item.kind==='video'?`<button type="button" class="video-edit-button" data-video-edit="${safe(item.id)}" data-video-scope="${safe(scope)}" aria-label="${tr('עריכת הסרטון','Edit video')}">${scissors}<span>${tr('מצב עריכה','Edit video')}</span></button>`:'';}
 function youtubeFrame(start,end){return 'https://www.youtube-nocookie.com/embed/'+active.item.youtubeId+'?rel=0&start='+Math.floor((active.item.youtubeStart||0)+start)+(end?'&end='+Math.ceil((active.item.youtubeStart||0)+end):'');}
 function feedback(message='',failed=false){$('videoClipStatus').textContent=message;$('videoClipStatus').classList.toggle('is-error',failed);}
 function stopPreview(){previewing=false;if(player?.tagName==='VIDEO')player.pause();$('videoClipPreview').textContent=tr('▶ תצוגה מקדימה של הקטע','▶ Preview selection');}
 function sync(source='fields',seek=false){
  if(!active)return;let start=source==='ranges'?Number($('videoClipStartRange').value):seconds($('videoClipStart').value),end=source==='ranges'?Number($('videoClipEndRange').value):seconds($('videoClipEnd').value);
  if(source==='ranges'){if(start>=end){if(document.activeElement===$('videoClipStartRange'))start=Math.max(0,end-.1);else end=Math.min(active.duration,start+.1);}$('videoClipStart').value=clock(start);$('videoClipEnd').value=clock(end);}
  const valid=Number.isFinite(start)&&Number.isFinite(end)&&start>=0&&end-start>=.099&&(!active.knownDuration||end<=active.duration+.01);
  active.start=start;active.end=end;active.valid=valid;
  $('videoClipSave').disabled=saving||!valid||!$('videoClipName').value.trim();$('videoClipPreview').disabled=saving||!valid;
  if(source!=='ranges'&&valid){$('videoClipStartRange').value=start;$('videoClipEndRange').value=end;}
  const max=Math.max(active.duration,end||0,1);$('videoClipSelection').style.left=(Math.max(0,start)/max*100)+'%';$('videoClipSelection').style.width=(Math.max(0,end-start)/max*100)+'%';
  $('videoClipLength').textContent=valid?tr('אורך הקטע: ','Clip length: ')+clock(end-start):tr('בחרו זמן התחלה וסיום תקינים','Choose a valid start and end');
  if(seek&&valid&&player?.tagName==='VIDEO'){stopPreview();player.currentTime=document.activeElement===$('videoClipEndRange')?Math.min(end,active.duration-.01):start;}
 }
 function close(){if(saving)return;stopPreview();dialog.close();if(player?.tagName==='VIDEO'){player.removeAttribute('src');player.load();}else if(player)player.removeAttribute('src');active=null;}
 function viewer(item,scope){const button=$('editOpenedVideo');if(button){button.hidden=item.kind!=='video'||!item.id;button.querySelector('span').textContent=tr('מצב עריכה','Edit video');button.setAttribute('aria-label',tr('עריכת הסרטון','Edit video'));button.dataset.videoEdit=item.id||'';button.dataset.videoScope=scope||item.scope||'';}}
 function open(item,scope){
  if(!item?.id||item.kind!=='video'||saving)return;for(const video of document.querySelectorAll('video'))if(!video.paused)video.pause();
  active={item,scope,start:0,end:item.duration||60,duration:item.duration||60,knownDuration:Boolean(item.duration),valid:false,clipId:crypto.randomUUID().replaceAll('-',''),payload:null};
  $('videoClipName').value=(I.mediaName(item)||tr('סרטון','Video')).slice(0,120)+' — '+tr('קטע','clip');$('videoClipSource').textContent=I.mediaName(item);$('videoClipStart').value=clock(0);$('videoClipEnd').value=clock(active.end);
  $('videoClipPlayer').replaceChildren();feedback();$('videoClipSave').textContent=tr('שמירת קטע באותה תיקייה','Save clip in this folder');
  player=document.createElement(item.provider==='youtube'?'iframe':'video');player.className='video-clip-player';
  if(item.provider==='youtube'){player.src=youtubeFrame(0,0);player.title=I.mediaName(item);player.allow='autoplay; encrypted-media; picture-in-picture; fullscreen';player.allowFullscreen=true;player.referrerPolicy='strict-origin-when-cross-origin';}
  else{player.controls=true;player.playsInline=true;player.preload='metadata';player.src=item.src;player.setAttribute('aria-label',tr('הסרטון במצב עריכה','Video in edit mode'));player.addEventListener('loadedmetadata',()=>{if(!active||!Number.isFinite(player.duration)||player.duration<=0)return;active.duration=player.duration;active.knownDuration=true;active.end=player.duration;for(const id of ['videoClipStartRange','videoClipEndRange'])$(id).max=player.duration;$('videoClipEnd').value=clock(player.duration);sync();});player.addEventListener('timeupdate',()=>{if(!active)return;$('videoClipPlayhead').textContent=clock(player.currentTime);if(previewing&&player.currentTime>=active.end-.02)stopPreview();});player.addEventListener('error',()=>feedback(tr('לא ניתן לטעון את הסרטון כרגע. סגרו ונסו שוב.','The video could not load. Close and try again.'),true));}
  $('videoClipPlayer').appendChild(player);$('videoClipMarkStart').hidden=$('videoClipMarkEnd').hidden=item.provider==='youtube';$('videoClipTimeline').hidden=item.provider==='youtube';
  for(const id of ['videoClipStartRange','videoClipEndRange'])$(id).max=active.duration;$('videoClipStartRange').value=0;$('videoClipEndRange').value=active.end;
  sync();dialog.showModal();
 }
 async function save(event){
  event.preventDefault();sync();if(!active?.valid||saving)return;
  const payload={clipId:active.clipId,start:active.start,end:active.end,name:$('videoClipName').value.trim()};
  if(active.payload&&JSON.stringify({...active.payload,clipId:''})!==JSON.stringify({...payload,clipId:''})){active.clipId=payload.clipId=crypto.randomUUID().replaceAll('-','');}
  active.payload=payload;saving=true;stopPreview();$('videoClipSave').disabled=true;$('videoClipClose').disabled=true;dialog.setAttribute('aria-busy','true');feedback(tr('שומר את הקטע המסומן…','Saving the selected clip…'));
  try{
   const response=await I.fetch('api/media/'+encodeURIComponent(active.item.id)+'/clip',{method:'POST',headers:{'Content-Type':'application/json','X-Family-Token':window.FAMILY_API_TOKEN},body:JSON.stringify(payload)});
   let result;try{result=await response.json();}catch{throw Error(tr('לא התקבל אישור שמירה. נסו שוב.','No save confirmation was received. Try again.'));}
   if(!response.ok)throw Error(I.error(result.error)||tr('לא ניתן לשמור את הקטע.','The clip could not be saved.'));
   window.dispatchEvent(new CustomEvent('family-media-changed',{detail:result}));
   window.FamilyApp?.toast(tr('הקטע נשמר כסרטון נוסף באותה תיקייה ✓','The clip was saved as another video in this folder ✓'));
   saving=false;close();
  }catch(error){feedback(error.message,true);}finally{saving=false;$('videoClipClose').disabled=false;dialog.removeAttribute('aria-busy');if(active)sync();}
 }
 function init(){
  dialog=document.createElement('dialog');dialog.id='videoClipEditor';dialog.className='video-clip-editor';dialog.setAttribute('data-i18n-skip','');dialog.setAttribute('aria-labelledby','videoClipTitle');
  dialog.innerHTML=`<form id="videoClipForm"><header><div><span class="small-eyebrow">${tr('שומרים את הרגע שבחרתם','Keep the moment you choose')}</span><h3 id="videoClipTitle">${tr('עריכת קטע מהסרטון','Edit a video clip')}</h3><p id="videoClipSource"></p></div><button type="button" id="videoClipClose" aria-label="${tr('סגירת עורך הסרטונים','Close video editor')}">×</button></header><div id="videoClipPlayer"></div><div class="video-clip-timeline" id="videoClipTimeline"><div class="video-clip-track"><span id="videoClipSelection"></span></div><label>${tr('תחילת הקטע','Clip start')}<input type="range" min="0" max="60" step=".01" value="0" id="videoClipStartRange" aria-label="${tr('תחילת הקטע בציר הזמן','Clip start on timeline')}"></label><label>${tr('סיום הקטע','Clip end')}<input type="range" min="0" max="60" step=".01" value="60" id="videoClipEndRange" aria-label="${tr('סיום הקטע בציר הזמן','Clip end on timeline')}"></label></div><div class="video-clip-times"><label>${tr('התחלה','Start')}<input type="text" id="videoClipStart" value="00:00.00" dir="ltr" inputmode="decimal" aria-label="${tr('זמן תחילת הקטע','Clip start time')}"></label><button type="button" id="videoClipMarkStart">${tr('סימון התחלה כאן','Set start here')}</button><label>${tr('סיום','End')}<input type="text" id="videoClipEnd" value="01:00.00" dir="ltr" inputmode="decimal" aria-label="${tr('זמן סיום הקטע','Clip end time')}"></label><button type="button" id="videoClipMarkEnd">${tr('סימון סיום כאן','Set end here')}</button></div><div class="video-clip-preview-row"><button type="button" id="videoClipPreview">${tr('▶ תצוגה מקדימה של הקטע','▶ Preview selection')}</button><span id="videoClipLength"></span><output id="videoClipPlayhead" dir="ltr"></output></div><label class="video-clip-name">${tr('שם הקטע החדש','New clip name')}<input id="videoClipName" maxlength="140" required></label><p id="videoClipStatus" role="status" aria-live="polite"></p><footer><span>${tr('הקטע יתווסף לצד הסרטון המלא באותה תיקייה.','The clip will be added beside the full video in this folder.')}</span><button type="submit" class="primary-button" id="videoClipSave">${tr('שמירת קטע באותה תיקייה','Save clip in this folder')}</button></footer></form>`;
  document.body.appendChild(dialog);$('videoClipClose').addEventListener('click',close);dialog.addEventListener('cancel',event=>{event.preventDefault();close();});$('videoClipForm').addEventListener('submit',save);
  dialog.addEventListener('keydown',event=>event.stopPropagation());
  for(const id of ['videoClipStart','videoClipEnd','videoClipName'])$(id).addEventListener('input',()=>{stopPreview();sync();});
  for(const id of ['videoClipStartRange','videoClipEndRange'])$(id).addEventListener('input',()=>sync('ranges',true));
  $('videoClipMarkStart').addEventListener('click',()=>{if(player?.tagName!=='VIDEO')return;$('videoClipStart').value=clock(player.currentTime);stopPreview();sync();});
  $('videoClipMarkEnd').addEventListener('click',()=>{if(player?.tagName!=='VIDEO')return;$('videoClipEnd').value=clock(player.currentTime);stopPreview();sync();});
  $('videoClipPreview').addEventListener('click',()=>{sync();if(!active?.valid)return;if(active.item.provider==='youtube'){player.src=youtubeFrame(active.start,active.end)+'&autoplay=1';return;}if(previewing){stopPreview();return;}player.currentTime=active.start;previewing=true;$('videoClipPreview').textContent=tr('❚❚ עצירה','❚❚ Pause');player.play().catch(()=>stopPreview());});
  document.addEventListener('click',event=>{const button=event.target.closest?.('[data-video-edit]');if(!button)return;const item=window.FamilyMedia?.lookup(button.dataset.videoScope,button.dataset.videoEdit)||window.FamilyMedia?.current?.();if(item?.id===button.dataset.videoEdit)open(item,button.dataset.videoScope);});
 }
 window.FamilyVideoEditor={controls,viewer,open,clock,seconds};document.addEventListener('DOMContentLoaded',init);
})();
