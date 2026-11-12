import {fullCrop,turns,isPhoto,normalizeCrop,rotateCrop,rotatedSize,pixelCrop,moveCrop,changed,outputFormat,outputName,drawPhoto} from './photo-edit-core.mjs';
import {filenamePhotoDate,normalizeUploadMetadata,photoUploadPayload} from './photo-upload-metadata.mjs?v=4';

import {createUploadFaceAdapter,faceDraftPeople,transformedUploadFaces} from './photo-upload-faces.mjs?v=2';
import {MAX_PHOTO_LABELS,photoLabels,photoLabelName,photoLabelOptions,photoLabelFromName,photoLabelKey,rememberPhotoLabels,loadPhotoLabelCatalog} from './photo-labels-catalog.mjs?v=2';

const I=window.FamilyI18n,tr=(he,en)=>I.isEnglish?en:he;
const safe=value=>String(value??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
const desktop=()=>matchMedia('(min-width:701px)').matches;
const jobs=[];
const fileMetadata=new WeakMap();
let session=null,dialog,source=null,sourceUrl=null,loadId=0,drag=null;
const get=id=>document.getElementById('photoEdit'+id);
const draft=()=>session?.drafts[session.index];

function labelStatus(message=''){
  get('LabelStatus').textContent=message;get('LabelStatus').hidden=!message;
}
function renderEventChoices(){
  const d=draft();if(!d?.metadata||session.mode==='existing')return;
  const selected=new Set(d.metadata.labels||[]),disabled=session.loading||session.saving?'disabled':'';
  const options=photoLabelOptions(session.drafts.flatMap(item=>item.metadata?.labels||[]));
  get('EventChoices').innerHTML=options.map(label=>`<label><input type="checkbox" data-upload-label="${safe(label.id)}" ${selected.has(label.id)?'checked':''} ${disabled}><span dir="auto">${safe(photoLabelName(label,I.isEnglish))}</span></label>`).join('');
}
function addUploadLabel(event){
  event.preventDefault();const d=draft();if(!d?.metadata||session.loading||session.saving||session.mode==='existing')return;
  const value=get('CustomLabelName').value,id=photoLabelFromName(value);
  if(!id){labelStatus(tr('כתבו שם תגית באורך של עד 60 תווים.','Enter a label name of up to 60 characters.'));get('CustomLabelName').focus();return;}
  const key=photoLabelKey(id),known=photoLabelOptions().find(label=>photoLabelKey(label.id)===key),label=known?.id||id;
  const labels=d.metadata.labels||[],already=labels.some(current=>photoLabelKey(current)===key);
  if(!already&&labels.length>=MAX_PHOTO_LABELS){labelStatus(tr('אפשר לבחור עד 32 תגיות לתמונה.','You can choose up to 32 labels per photo.'));return;}
  d.metadata.labels=photoLabels([...labels,label]);d.customLabelName='';get('CustomLabelName').value='';
  rememberPhotoLabels([label]);renderEventChoices();renderDraftTags();
  labelStatus(already?tr('התגית כבר נבחרה לתמונה הזו.','This label is already selected for this photo.'):tr('התגית נוספה לתמונה הזו. היא תישמר עם ההעלאה.','Label added to this photo. It will be saved with the upload.'));
  get('CustomLabelName').focus();
}
function renderDraftTags(){
  const d=draft();if(!d?.metadata)return;
  const people=faceDraftPeople(d);get('PeopleSection').hidden=!people.length;
  get('PeopleTags').innerHTML=people.map(person=>`<button type="button" data-upload-remove-person="${safe(person.id)}" aria-label="${safe(tr('הסרת התיוג של ','Remove tag for ')+I.personName(person))}"><span dir="auto">${safe(I.personName(person))}</span><span aria-hidden="true">×</span></button>`).join('');
  get('EventTags').innerHTML=(d.metadata.labels||[]).map(label=>`<span>${safe(photoLabelName(label,I.isEnglish))}</span>`).join('');
}
function renderTagControls(){
  const d=draft(),enabled=Boolean(d&&!d.cropping&&session.mode!=='existing');
  dialog.classList.toggle('is-face-tagging',enabled);get('TaggingToggle').setAttribute('aria-pressed',String(enabled));get('FamilyPhotoChoice').hidden=session.mode==='existing'||session.scope==='photos'||!desktop();
}
function stopFaces(){if(session?.faceActive){session.faceActive=false;window.FamilyFaces?.clear();}}
function startFaces(){
  stopFaces();const owner=session,d=draft();
  if(!owner||owner.mode==='existing'||!d||!source||!window.FamilyFaces)return;
  const adapter=createUploadFaceAdapter(d,{tr,findPeople:(query,preferred)=>window.FamilyTags.findPeople(query,preferred),getPerson:id=>window.FamilyApp?.getPersonSummary?.(id),onChange:result=>{
    if(session!==owner||draft()!==d)return;
    renderDraftTags();renderTagControls();
    if(!result.item.faceSummary?.reviewed||!owner.onUpload||!(window.FamilyPhotoKeyboard?.desktop?.()??desktop()))return;
    // Let the confirmation finish painting before saving this photo and moving on.
    queueMicrotask(()=>{if(session===owner&&draft()===d&&d.facesComplete&&!owner.loading&&!owner.saving)void saveCurrent();});
  }});
  adapter.enabled=()=>session===owner&&draft()===d&&!d.cropping&&!owner.loading&&!owner.saving;
  owner.faceActive=true;
  window.FamilyFaces.mount(get('Image'),get('Canvas'),{id:d.key,kind:'photo',faceSummary:{reviewed:d.facesComplete}},{adapter,dialog,reviewHost:get('FaceTools'),reviewLabel:true,zoom:false,detectionImage:source}).catch(error=>{if(session===owner&&draft()===d)get('Error').textContent=error.message;});
}
const metadataForDraft=d=>normalizeUploadMetadata({...d.metadata,faces:d.faceTags?.length?transformedUploadFaces(d):[],complete:Boolean(d.facesComplete)});

function mount(){
  if(dialog)return;
  dialog=document.createElement('dialog');dialog.id='photoUploadEditor';dialog.className='photo-upload-editor';dialog.dataset.i18nSkip='';dialog.dir=I.isEnglish?'ltr':'rtl';
  dialog.setAttribute('aria-labelledby','photoEditTitle');dialog.setAttribute('aria-describedby','photoEditHint');
  dialog.innerHTML=`<header class="photo-edit-header"><div class="photo-edit-heading"><span class="section-diamond photo-edit-emblem" aria-hidden="true">◇</span><div><span class="photo-edit-eyebrow" hidden></span><h2 id="photoEditTitle">${tr('אשף העלאת התמונות','Photo Upload Wizard')}</h2></div></div><button type="button" id="photoEditClose" class="photo-edit-close" aria-label="${tr('ביטול ההעלאה','Cancel upload')}"><span class="photo-edit-close-text" aria-hidden="true">×</span><svg class="photo-edit-close-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m4 4 16 16M20 4 4 20"/></svg></button></header>
    <p id="photoEditHint" class="photo-edit-hint" hidden></p>
    <div id="photoEditHistory" class="photo-edit-history" hidden><label for="photoEditVersion">${tr('גרסאות התמונה','Photo versions')}</label><select id="photoEditVersion"></select><span id="photoEditVersionStatus" role="status"></span></div>
    <nav class="photo-edit-pager" aria-label="${tr('התמונות שנבחרו להעלאה','Photos selected for upload')}"><button type="button" id="photoEditPrevious" class="secondary-button">${tr('הקודמת','Previous')}</button><div><strong id="photoEditCounter" aria-live="polite"></strong><span id="photoEditFilename" dir="auto"></span></div><button type="button" id="photoEditNext" class="secondary-button">${tr('הבאה','Next')}</button></nav>
    <section id="photoEditMetadata" class="photo-edit-metadata"><div class="photo-edit-date" role="group" aria-labelledby="photoEditDateLabel"><span id="photoEditDateLabel" class="photo-edit-date-label"><span>${tr('תאריך','Photo')}</span> <span>${tr('צילום','date')}</span></span><div class="photo-edit-date-fields">${[['day',tr('יום','Day'),1,31],['month',tr('חודש','Month'),1,12],['year',tr('שנה','Year'),1910,new Date().getFullYear()]].map(([field,label,min,max])=>`<label for="photoEditDate${field}">${label}<input id="photoEditDate${field}" type="number" inputmode="numeric" min="${min}" max="${max}" step="1" aria-describedby="photoEditDateError" placeholder="—" autocomplete="off"></label>`).join('')}<button type="button" id="photoEditCopyDate" class="photo-edit-copy-date" title="${tr('העתקת התאריך מהתמונה הקודמת','Copy date from previous photo')}" aria-label="${tr('העתקת התאריך מהתמונה הקודמת','Copy date from previous photo')}"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M7 2v4m10-4v4M3 9h18m-10 4-3 3 3 3m-3-3h5a3 3 0 0 1 3 3"/></svg></button></div><p id="photoEditDateError" class="photo-edit-date-error" role="alert" hidden></p><p id="photoEditDateSource" class="photo-edit-date-source" role="status" hidden></p></div><label class="photo-edit-caption" for="photoEditCaption"><span class="photo-edit-caption-label"><span>${tr('תיאור','Photo')}</span> <span>${tr('התמונה','description')}</span></span><textarea id="photoEditCaption" dir="auto" rows="2" maxlength="5000" placeholder="${tr('לחצו כאן להקלדת תיאור...','Tap here to enter a description...')}" autocomplete="off"></textarea></label></section>
    <div id="photoEditViewport" class="photo-edit-viewport"><p id="photoEditLoading" role="status"></p><div id="photoEditImage" class="photo-edit-image" hidden><canvas id="photoEditCanvas" role="img" aria-label="${tr('תצוגה מקדימה של התמונה לפני ההעלאה','Photo preview before upload')}"></canvas><div id="photoEditCropLayer" class="photo-edit-crop-layer" hidden><div id="photoEditCrop" class="photo-edit-crop" data-handle="move" tabindex="0" role="group" aria-label="${tr('מסגרת החיתוך. גררו להזזה או השתמשו במקשי החצים.','Crop area. Drag to move or use the arrow keys.')}">${['nw','n','ne','e','se','s','sw','w'].map(handle=>`<button type="button" class="photo-edit-handle handle-${handle}" data-handle="${handle}" aria-label="${handleLabel(handle)}"></button>`).join('')}<span class="photo-edit-thirds" aria-hidden="true"></span></div></div></div></div>
    <div class="photo-edit-toolbar" id="photoEditToolbar"><button type="button" id="photoEditLeft" class="secondary-button"><span class="photo-edit-mobile-icon" aria-hidden="true">↶</span><svg class="photo-edit-desktop-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10a8 8 0 1 1 1 8M4 4v6h6"/></svg><span class="photo-edit-action-label"><span>${tr('סיבוב','Rotate')}</span> <span>${tr('שמאלה','left')}</span></span></button><button type="button" id="photoEditRight" class="secondary-button"><span class="photo-edit-mobile-icon" aria-hidden="true">↷</span><svg class="photo-edit-desktop-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10a8 8 0 1 0-1 8M20 4v6h-6"/></svg><span class="photo-edit-action-label"><span>${tr('סיבוב','Rotate')}</span> <span>${tr('ימינה','right')}</span></span></button><button type="button" id="photoEditCropToggle" class="secondary-button" aria-pressed="false"><svg class="photo-edit-desktop-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3v13a2 2 0 0 0 2 2h13M3 6h13a2 2 0 0 1 2 2v13"/></svg><span class="photo-edit-action-label">${tr('חיתוך','Crop')}</span></button><button type="button" id="photoEditReset" class="photo-edit-text-button"><svg class="photo-edit-desktop-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10a8 8 0 1 1 1 8M4 4v6h6"/><path d="M12 8v4l3 2"/></svg><span class="photo-edit-action-label">${tr('איפוס','Reset')}</span></button><label id="photoEditFamilyPhotoChoice" class="photo-edit-family-choice" for="photoEditFamilyPhoto"><input id="photoEditFamilyPhoto" type="checkbox" aria-label="${tr('הוספה לתמונות משפחתיות','Add to Family photos')}"><span class="photo-edit-family-symbol" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="6" cy="7" r="3"/><circle cx="18" cy="7" r="3"/><circle cx="12" cy="13" r="2.5"/><path d="M1 20v-4a5 5 0 0 1 7-4m15 8v-4a5 5 0 0 0-7-4M7 22v-2a5 5 0 0 1 10 0v2"/></svg></span><span class="photo-edit-family-text">${tr('הוספה לתמונות משפחתיות','Add to Family photos')}</span></label><button type="button" id="photoEditTaggingToggle" class="secondary-button" hidden aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="9" r="6"/><path d="M9 8h.01M15 8h.01M9 11a4 4 0 0 0 6 0M3 3h4M3 3v4m18-4h-4m4 0v4M3 21h4m-4 0v-4m18 4h-4m4 0v-4"/></svg><span>${tr('תיוג פנים','Tag faces')}</span></button><span id="photoEditFaceTools" class="photo-edit-face-tools"></span></div>
    <section id="photoEditTags" class="photo-edit-tags" hidden><div id="photoEditPeopleSection"><strong>${tr('אנשים בתמונה','People in this photo')}</strong><div id="photoEditPeopleTags" class="photo-edit-tag-chips"></div></div><details><summary>${tr('אירועים ותגיות','Events and labels')}</summary><div id="photoEditEventChoices" class="photo-edit-event-choices"></div><form id="photoEditCustomLabelForm" class="photo-edit-custom-label"><label for="photoEditCustomLabelName">${tr('תגית נוספת','Another label')}</label><div><input id="photoEditCustomLabelName" type="text" dir="${I.isEnglish?'ltr':'rtl'}" maxlength="60" autocomplete="off" placeholder="${tr('שם התגית החדשה…','New label name…')}"><button type="submit" class="secondary-button">＋ ${tr('הוספת תגית','Add label')}</button></div></form><p id="photoEditLabelStatus" class="photo-edit-label-status" role="status" aria-live="polite" hidden></p></details><div id="photoEditEventTags" class="photo-edit-tag-chips"></div></section><p id="photoEditUploadStatus" class="photo-edit-upload-status" role="status"></p>
    <div id="photoEditCropHelp" class="photo-edit-crop-help" hidden><p>${tr('גררו את פינות המסגרת לחיתוך, או את המרכז להזזה. במקלדת: חצים; Shift לצעד גדול.','Drag the corners to crop, or the centre to move. Keyboard: arrows; Shift for a larger step.')}</p><button type="button" id="photoEditFull" class="photo-edit-text-button">${tr('החזרת התמונה המלאה','Use full photo')}</button></div>
    <div id="photoEditInfo" class="photo-edit-info"><span id="photoEditDimensions" dir="ltr" aria-live="polite"></span><span id="photoEditAnimation"></span></div><p id="photoEditError" class="photo-edit-error" role="alert"></p>
    <footer class="photo-edit-footer"><button type="button" id="photoEditSaveCurrent" class="secondary-button" hidden></button><button type="button" id="photoEditSave" class="primary-button"></button><button type="button" id="photoEditCancel" class="secondary-button">${tr('ביטול ההעלאה','Cancel upload')}</button><button type="button" id="photoEditRemove" class="photo-edit-remove" aria-label="${tr('הסרת התמונה הנוכחית מההעלאה','Remove the current photo from this upload')}"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6m4-6v6"/></svg><span>${tr('הסרת תמונה','Remove photo')}</span></button></footer>`;
  document.body.append(dialog);
  get('Close').addEventListener('click',cancel);get('Cancel').addEventListener('click',cancel);
  dialog.addEventListener('cancel',event=>{event.preventDefault();cancel();});
  get('Previous').addEventListener('click',()=>navigate(-1));get('Next').addEventListener('click',()=>navigate(1));
  get('CopyDate').addEventListener('click',copyPreviousDate);
  get('Left').addEventListener('click',()=>rotate(-1));get('Right').addEventListener('click',()=>rotate(1));
  get('CropToggle').addEventListener('click',()=>{draft().cropping=!draft().cropping;if(draft().cropping){draft().tagging=false;window.FamilyFaces?.dismiss?.();}renderCrop();renderTagControls();});
  get('Reset').addEventListener('click',()=>{Object.assign(draft(),{rotation:0,crop:fullCrop(),cropping:false});render();startFaces();});
  get('Full').addEventListener('click',()=>{draft().crop=fullCrop();renderCrop();});
  get('Remove').addEventListener('click',remove);get('Save').addEventListener('click',save);get('SaveCurrent').addEventListener('click',saveCurrent);
  get('PeopleTags').addEventListener('click',event=>{const button=event.target.closest('[data-upload-remove-person]');if(!button||session.saving)return;const d=draft();d.faceTags=d.faceTags.filter(face=>face.person.id!==button.dataset.uploadRemovePerson);d.facesComplete=false;renderDraftTags();startFaces();});
  get('EventChoices').addEventListener('change',event=>{const label=event.target.dataset.uploadLabel;if(!label||!draft()?.metadata||session.loading||session.saving)return;const labels=new Set(draft().metadata.labels||[]);if(event.target.checked&&labels.size>=MAX_PHOTO_LABELS&&!labels.has(label)){event.target.checked=false;labelStatus(tr('אפשר לבחור עד 32 תגיות לתמונה.','You can choose up to 32 labels per photo.'));return;}if(event.target.checked)labels.add(label);else labels.delete(label);draft().metadata.labels=photoLabels([...labels]);labelStatus();renderDraftTags();});
  get('CustomLabelForm').addEventListener('submit',addUploadLabel);
  get('CustomLabelName').addEventListener('input',event=>{if(draft()?.metadata){draft().customLabelName=event.target.value;labelStatus();}});
  window.addEventListener('family-photo-label-catalog',()=>{if(session&&session.mode!=='existing')renderEventChoices();});
  get('Version').addEventListener('change',()=>loadVersion(get('Version').value));
  for(const field of ['day','month','year'])get('Date'+field).addEventListener('input',event=>{const d=draft();if(!d?.metadata)return;d.metadata.date[field]=event.target.validity?.badInput?NaN:event.target.value===''?null:Number(event.target.value);d.dateEdited=true;get('DateSource').hidden=true;clearDateError();get('Error').textContent='';});
  get('Caption').addEventListener('input',event=>{if(draft()?.metadata)draft().metadata.caption=event.target.value;fitCaption();});
  get('Caption').addEventListener('keydown',event=>window.FamilyPhotoKeyboard?.saveDescription(event,()=>{
    if(!draft()?.metadata||session.loading||session.saving)return;
    draft().metadata.caption=get('Caption').value;get('Caption').blur();
  }));
  get('Caption').addEventListener('focus',()=>{fitCaption();requestAnimationFrame(revealMetadata);});
  get('Caption').addEventListener('blur',()=>fitCaption());
  get('FamilyPhoto').addEventListener('change',event=>{if(draft()?.metadata)draft().metadata.familyPhoto=event.target.checked;});
  get('Metadata').addEventListener('focusin',()=>{fitEditor();requestAnimationFrame(revealMetadata);});
  window.addEventListener('resize',fitEditor);window.visualViewport?.addEventListener('resize',()=>{fitEditor();requestAnimationFrame(revealMetadata);});
  window.addEventListener('keydown',keyNavigate);
  window.FamilyPhotoKeyboard?.bindNavigation({available:canControlNavigate,capture:()=>({owner:session,draft:draft()}),navigate:controlNavigate});
  const layer=get('CropLayer');layer.addEventListener('pointerdown',pointerStart);layer.addEventListener('pointermove',pointerMove);
  layer.addEventListener('pointerup',pointerEnd);layer.addEventListener('pointercancel',pointerEnd);layer.addEventListener('lostpointercapture',()=>{drag=null;});
  layer.addEventListener('keydown',keyCrop);
  new ResizeObserver(()=>{if(source&&session)render();}).observe(get('Viewport'));
}
function handleLabel(handle){
  const labels={nw:['פינה שמאלית עליונה','Top left corner'],n:['קצה עליון','Top edge'],ne:['פינה ימנית עליונה','Top right corner'],e:['קצה ימני','Right edge'],se:['פינה ימנית תחתונה','Bottom right corner'],s:['קצה תחתון','Bottom edge'],sw:['פינה שמאלית תחתונה','Bottom left corner'],w:['קצה שמאלי','Left edge']};
  return tr(...labels[handle])+tr('. השתמשו במקשי החצים לחיתוך.','. Use arrow keys to crop.');
}
function release(){source?.close?.();source=null;if(sourceUrl)URL.revokeObjectURL(sourceUrl);sourceUrl=null;}
async function decode(file){
  if(window.createImageBitmap){try{return await createImageBitmap(file,{imageOrientation:'from-image'});}catch{/* Use the browser image decoder when bitmap decoding is unavailable. */}}
  const img=new Image();sourceUrl=URL.createObjectURL(file);img.src=sourceUrl;await img.decode();return img;
}
const dimensions=image=>({width:image.naturalWidth||image.width,height:image.naturalHeight||image.height});
function setBusy(busy){
  session.loading=busy;
  for(const el of dialog.querySelectorAll('button,input,textarea'))el.disabled=busy;
  // Cancellation is safe while decoding; saving pixels is kept atomic.
  if(!session.saving){get('Close').disabled=false;get('Cancel').disabled=false;}
  get('Previous').disabled=busy||session.drafts.length<2;get('Next').disabled=busy||session.drafts.length<2;
  get('Version').disabled=busy;renderDateCopy();
}
function fitEditor(){
  if(!session||!dialog?.open||session.mode==='existing')return;
  dialog.style.setProperty('--photo-editor-height',(window.visualViewport?.height||window.innerHeight)+'px');
  dialog.style.setProperty('--photo-editor-top',(window.visualViewport?.offsetTop||0)+'px');
  fitCaption();renderTagControls();if(!session.saving)saveLabel();
  if(!session.faceActive&&source)startFaces();
}
function fitCaption(){
  if(!session||session.mode==='existing')return;const input=get('Caption');
  input.placeholder=tr('לחצו כאן להקלדת תיאור...','Tap here to enter a description...');
  if(!desktop()){
    input.dir=I.isEnglish?'ltr':'rtl';
    const editing=document.activeElement===input;input.rows=editing?3:1;input.wrap=editing?'soft':'off';input.style.removeProperty('height');
    if(editing){input.style.height='auto';input.style.height=Math.min(140,Math.max(76,(input.scrollHeight||0)+2))+'px';}
    return;
  }
  input.dir='auto';input.rows=1;input.wrap='soft';
  // Native resizing writes an inline height. Keep that choice on typing, blur and viewport changes.
  const currentHeight=parseFloat(input.style.height);
  if(Number.isFinite(session.captionAutoHeight)&&Number.isFinite(currentHeight)&&Math.abs(currentHeight-session.captionAutoHeight)>1)session.captionManualHeight=currentHeight;
  if(session.captionManualHeight){input.style.height=session.captionManualHeight+'px';return;}
  input.style.height='auto';session.captionAutoHeight=Math.min(180,Math.max(38,(input.scrollHeight||0)+2));input.style.height=session.captionAutoHeight+'px';
}
function revealMetadata(){if(session&&get('Metadata').contains(document.activeElement))document.activeElement.scrollIntoView?.({block:'nearest',behavior:'auto'});}
function dateProblem(d){
  const date=d.metadata.date,currentYear=new Date().getFullYear();
  for(const [field,min,max,message]of [
    ['year',1910,currentYear,tr('השנה בתאריך הצילום חייבת להיות בין 1910 ל־','The photo year must be between 1910 and ')+currentYear+'.'],
    ['month',1,12,tr('החודש בתאריך הצילום חייב להיות בין 1 ל־12.','The photo month must be between 1 and 12.')],
    ['day',1,31,tr('היום בתאריך הצילום חייב להיות בין 1 ל־31, בהתאם לחודש.','The photo day must be between 1 and 31, depending on the month.')]
  ]){
    const value=date[field];if(value!==null&&value!==undefined&&(!Number.isInteger(value)||value<min||value>max))return {field,message};
  }
  if(date.day&&date.month){
    const max=new Date(Date.UTC(date.year||2000,date.month,0)).getUTCDate();
    if(date.day>max)return {field:'day',message:tr('תאריך הצילום אינו תקין: בחודש שנבחר יש לכל היותר ','Invalid photo date: the selected month has at most ')+max+tr(' ימים.',' days.')};
  }
  return null;
}
function clearDateError(){
  get('DateError').textContent='';get('DateError').hidden=true;
  for(const field of ['day','month','year'])get('Date'+field).setAttribute('aria-invalid','false');
}
function showDateProblem(problem){
  if(!problem)return false;
  get('DateError').textContent=problem.message;get('DateError').hidden=false;
  const input=get('Date'+problem.field);input.setAttribute('aria-invalid','true');input.focus();input.scrollIntoView?.({block:'nearest'});
  return true;
}
function previousPhotoDate(){
  const current=draft();if(!current?.metadata||session.mode==='existing')return null;
  // Keep uploaded predecessors available; photos explicitly removed are excluded.
  const previous=session.dateSources.filter(item=>item.fileIndex<current.fileIndex).at(-1);
  const date=previous?.metadata.date;
  return date&&Object.values(date).some(value=>value!==null)&&!dateProblem(previous)?date:null;
}
function renderDateCopy(){
  get('CopyDate').disabled=!session||session.loading||session.saving||!previousPhotoDate();
}
function copyPreviousDate(){
  if(!session||session.loading||session.saving)return;
  const date=previousPhotoDate();if(!date)return;
  draft().metadata.date={...date};draft().dateEdited=true;clearDateError();get('Error').textContent='';renderMetadata();
}
function renderMetadata(){
  const d=draft();get('Metadata').hidden=session.mode==='existing';if(!d?.metadata||session.mode==='existing')return;
  clearDateError();
  for(const field of ['day','month','year'])get('Date'+field).value=d.metadata.date[field]??'';
  get('Dateyear').max=new Date().getFullYear();renderDateCopy();
  get('Caption').value=d.metadata.caption;fitCaption();
  get('FamilyPhotoChoice').hidden=session.scope==='photos';get('FamilyPhoto').checked=d.metadata.familyPhoto;
  renderEventChoices();get('CustomLabelName').value=d.customLabelName||'';labelStatus();
  renderDraftTags();renderTagControls();
  const messages={full:tr('התאריך זוהה משם הקובץ. אפשר לערוך אותו.','Date filled from the filename. You can edit it.'),partial:tr('תאריך חלקי משם הקובץ. אפשר להשלים את מה שידוע.','Partial date from the filename. Add any other details you know.'),ambiguous:tr('בשם הקובץ יש כמה אפשרויות תאריך. מולאו רק החלקים המשותפים.','The filename contains alternative dates. Only shared parts were filled in.'),invalid:tr('התאריך בשם הקובץ אינו תקין. אפשר להזין תאריך ידנית.','The filename date is invalid. You can enter the date manually.')};
  get('DateSource').textContent=d.dateEdited?'':messages[d.dateSource]||'';get('DateSource').hidden=!get('DateSource').textContent;
}
function saveLabel(){
  if(session.mode==='existing'){
    const d=draft();get('Save').textContent=d&&changed(d.rotation,d.crop)?tr('שמירת גרסה חדשה','Save new version'):d?.baseVersion!==session.expectedVersion?tr('שחזור גרסה זו','Restore this version'):tr('סיום','Done');return;
  }
  const count=session.files.filter((file,index)=>!isPhoto(file)||session.drafts.some(item=>item.fileIndex===index)).length;
  get('SaveCurrent').textContent=desktop()?tr('שמירה והעלאה של תמונה זו','Save and upload this photo'):tr('העלאת תמונה זו','Upload this photo');
  get('SaveCurrent').hidden=!session.onUpload||!draft();get('SaveCurrent').disabled=session.loading||session.saving||!draft();
  get('Save').textContent=desktop()?tr('שמירה והעלאה של הכל','Save and upload all'):tr('העלאת הכל','Upload all');
  get('Save').textContent+=(count>1?` (${count})`:'');
}
async function load(){
  const id=++loadId;drag=null;stopFaces();release();get('Image').hidden=true;get('Error').textContent='';get('Loading').hidden=false;
  get('Loading').textContent=tr('טוען תצוגה מקדימה…','Loading preview…');setBusy(true);saveLabel();
  get('Counter').textContent=I.isEnglish?`Photo ${session.index+1} of ${session.drafts.length}`:`תמונה ${session.index+1} מתוך ${session.drafts.length}`;
  get('Filename').textContent=draft().file.name;
  renderMetadata();
  try{
    const image=await decode(draft().file);if(id!==loadId){image.close?.();return;}
    source=image;const size=dimensions(image);if(!size.width||!size.height)throw Error();
    Object.assign(draft(),size);setBusy(false);get('Loading').hidden=true;get('Image').hidden=false;render();startFaces();
  }catch{
    if(id!==loadId)return;release();setBusy(false);get('Loading').hidden=true;
    get('Error').textContent=tr('לא ניתן לפתוח את התמונה הזו. הסירו אותה מההעלאה או בחרו קובץ JPG, PNG או WebP.','This photo could not be opened. Remove it from this upload or choose a JPG, PNG or WebP file.');
    for(const name of ['Save','SaveCurrent','Left','Right','CropToggle','Reset','TaggingToggle'])get(name).disabled=true;
  }
}
function render(){
  const d=draft();if(!d||!source)return;
  const size=rotatedSize(d.width,d.height,d.rotation),viewport=get('Viewport');
  const padding=session.mode==='existing'?40:0;
  const fit=Math.min(Math.max(1,viewport.clientWidth-padding)/size.width,Math.max(1,viewport.clientHeight-padding)/size.height,session.mode==='existing'?1:Infinity);
  get('Image').style.width=Math.max(1,size.width*fit)+'px';get('Image').style.height=Math.max(1,size.height*fit)+'px';
  const canvas=get('Canvas'),scale=Math.min(1,1600/Math.max(size.width,size.height));
  canvas.width=Math.max(1,Math.round(size.width*scale));canvas.height=Math.max(1,Math.round(size.height*scale));
  drawPhoto(canvas.getContext('2d'),source,d.width,d.height,d.rotation,fullCrop(),scale);renderCrop();if(session.faceActive)window.FamilyFaces?.fit?.();
}
function renderCrop(){
  const d=draft();if(!d)return;const c=normalizeCrop(d.crop),box=get('Crop');
  box.style.left=c.x*100+'%';box.style.top=c.y*100+'%';box.style.width=c.width*100+'%';box.style.height=c.height*100+'%';
  // Keep the selected boundary visible even when the crop tools are collapsed.
  get('CropLayer').hidden=!d.cropping&&!changed(0,c);box.classList.toggle('is-editing',d.cropping);
  get('CropLayer').classList.toggle('is-editing',d.cropping);get('CropHelp').hidden=!d.cropping;
  get('CropToggle').setAttribute('aria-pressed',String(d.cropping));
  for(const handle of box.querySelectorAll('button'))handle.disabled=!d.cropping;
  box.tabIndex=d.cropping?0:-1;
  const existing=session.mode==='existing';get('Dimensions').hidden=!existing;
  if(existing&&d.width){const rect=pixelCrop(d.width,d.height,d.rotation,c);get('Dimensions').textContent=`${rect.width} × ${rect.height} px`;}
  get('Animation').textContent=/image\/gif/i.test(d.file.type)||/\.gif$/i.test(d.file.name)?tr('סיבוב או חיתוך של GIF ישמרו תמונה ללא אנימציה.','Rotating or cropping a GIF saves a still image.'):'';
  get('Info').hidden=!existing&&!get('Animation').textContent;
  saveLabel();renderTagControls();
}
function configure(){
  const existing=session.mode==='existing';dialog.dir=I.isEnglish?'ltr':'rtl';dialog.classList.toggle('is-existing',existing);
  const eyebrow=dialog.querySelector('.photo-edit-eyebrow');eyebrow.hidden=!existing;eyebrow.textContent=existing?tr('המקור והגרסאות נשמרים','Original and previous versions are kept'):'';
  get('Title').textContent=existing?tr('עריכת תמונה','Edit photo'):tr('אשף העלאת התמונות','Photo Upload Wizard');
  get('Hint').hidden=!existing;get('Hint').textContent=existing?tr('כל שמירה יוצרת גרסה חדשה. בחרו גרסה קודמת לצפייה או לשחזור.','Each save creates a new version. Choose a previous version to view or restore it.') :'';
  dialog.setAttribute('aria-describedby',existing?'photoEditHint':'');
  for(const name of ['Close','Cancel']){get(name).setAttribute('aria-label',existing?tr('ביטול העריכה','Cancel editing'):tr('ביטול ההעלאה','Cancel upload'));if(name==='Cancel')get(name).textContent=tr('ביטול','Cancel');}
  get('History').hidden=!existing;dialog.querySelector('.photo-edit-pager').hidden=existing;get('Remove').hidden=existing;
  get('Metadata').hidden=existing;get('SaveCurrent').hidden=existing||!session.onUpload;get('TaggingToggle').hidden=true;get('FamilyPhotoChoice').hidden=existing||session.scope==='photos';get('Tags').hidden=existing||!desktop();get('UploadStatus').textContent='';renderTagControls();
  get('Canvas').setAttribute('aria-label',tr('תצוגה מקדימה של התמונה','Photo preview'));
}
async function responseJSON(response){
  let result;try{result=await response.json();}catch{throw Error(tr('לא התקבל אישור מהשרת. נסו שוב.','No confirmation was received. Please try again.'));}
  if(!response.ok)throw Error(I.error(result.error)||tr('התמונה לא נשמרה.','The photo was not saved.'));return result;
}
function failLoad(message){
  if(!session)return;setBusy(false);get('Loading').hidden=true;get('Error').textContent=message;
  for(const name of ['Save','Left','Right','CropToggle','Reset','Version'])get(name).disabled=true;
}
async function loadHistory(){
  const owner=session;owner.abort=new AbortController();owner.transforms=new Map();
  release();get('Image').hidden=true;get('Error').textContent='';get('Loading').hidden=false;get('Loading').textContent=tr('טוען גרסאות…','Loading versions…');get('Version').replaceChildren();get('VersionStatus').textContent='';setBusy(true);
  try{
    const result=await responseJSON(await I.fetch('api/media/'+owner.item.id+'/versions',{cache:'no-store',signal:owner.abort.signal}));
    if(session!==owner)return;owner.expectedVersion=result.currentVersion;owner.versions=result.versions;
    for(const [index,version] of result.versions.entries()){
      const option=document.createElement('option');option.value=version.id;
      const date=new Date(version.createdAt),label=version.original?tr('מקור','Original'):tr('גרסה ','Version ')+(result.versions.length-index-1);
      option.textContent=label+(Number.isFinite(date.getTime())?' · '+date.toLocaleString(I.isEnglish?'en-US':'he-IL',{dateStyle:'short',timeStyle:'short'}):'')+(version.current?tr(' · נוכחית',' · Current'):'');get('Version').append(option);
    }
    get('Version').value=result.currentVersion;await loadVersion(result.currentVersion);
  }catch(error){if(session===owner&&error.name!=='AbortError')failLoad(error.message);}
}
async function loadVersion(id){
  const owner=session;if(!owner||owner.saving)return;const version=owner.versions?.find(version=>version.id===id);if(!version)return;
  const previous=draft();if(previous)owner.transforms.set(previous.baseVersion,{rotation:previous.rotation,crop:{...previous.crop},cropping:previous.cropping});
  const sequence=++loadId;release();get('Image').hidden=true;get('Loading').hidden=false;get('Loading').textContent=tr('טוען תצוגה מקדימה…','Loading preview…');get('Error').textContent='';setBusy(true);
  get('VersionStatus').textContent=version.current?'':tr('צפייה בגרסה קודמת','Viewing a previous version');
  try{
    const response=await I.fetch(version.src,{cache:'no-store',signal:owner.abort.signal});if(!response.ok)throw Error(tr('לא ניתן לפתוח את הגרסה הזו כרגע.','This version could not be opened right now.'));
    const blob=await response.blob();if(session!==owner||sequence!==loadId)return;
    const file=new File([blob],version.filename||owner.item.filename||'photo',{type:version.mime||blob.type});
    owner.files=[file];owner.drafts=[{file,fileIndex:0,rotation:0,crop:fullCrop(),cropping:false,...owner.transforms.get(id),baseVersion:id}];owner.index=0;await load();
  }catch(error){if(session===owner&&sequence===loadId&&error.name!=='AbortError')failLoad(error.message);}
}
function navigate(step){if(!session||session.loading||session.saving||!session.drafts.length)return;if(step>0&&session.mode!=='existing'&&showDateProblem(dateProblem(draft())))return;session.index=(session.index+step+session.drafts.length)%session.drafts.length;load();}
function canControlNavigate(){return Boolean(session&&session.mode!=='existing'&&dialog?.open&&!session.loading&&!session.saving&&session.drafts.length>1&&!drag);}
async function controlNavigate(direction,tap){
  const active=()=>session===tap.owner&&draft()===tap.draft&&canControlNavigate();
  if(!active())return;
  try{await window.FamilyFaces?.flush?.();if(active())navigate(direction);}
  catch(error){if(active())get('Error').textContent=error.message||tr('לא ניתן להשלים את התיוג כרגע.','The tag could not be completed.');}
}
function keyNavigate(event){
  if(!session||session.mode==='existing'||!dialog?.open||!desktop()||session.loading||session.saving||session.drafts.length<2||draft()?.cropping||event.defaultPrevented||event.isComposing||event.ctrlKey||event.metaKey||event.altKey||event.shiftKey||!['ArrowLeft','ArrowRight'].includes(event.key))return;
  const target=event.target,activeDialog=target?.closest?.('dialog[open],[role="dialog"]');
  if(activeDialog&&activeDialog!==dialog||target?.isContentEditable||target?.closest?.('input,textarea,select,[role="textbox"],.face-selection,.face-picker'))return;
  event.preventDefault();event.stopPropagation();navigate(event.key==='ArrowRight'?1:-1);
}
function rotate(direction){const d=draft();d.rotation=turns(d.rotation+direction);d.crop=rotateCrop(d.crop,direction);render();startFaces();}
function pointerStart(event){
  if(!draft()?.cropping||session.loading||session.saving||!event.isPrimary||event.button!==0)return;
  event.preventDefault();const rect=get('Image').getBoundingClientRect(),handle=event.target.closest('[data-handle]')?.dataset.handle;
  if(handle){drag={id:event.pointerId,x:event.clientX,y:event.clientY,rect,handle,crop:{...draft().crop}};}
  else{
    const x=Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width)),y=Math.max(0,Math.min(1,(event.clientY-rect.top)/rect.height));
    drag={id:event.pointerId,x:event.clientX,y:event.clientY,rect,handle:'new',start:{x,y}};
  }
  get('CropLayer').setPointerCapture(event.pointerId);
}
function pointerMove(event){
  if(!drag||event.pointerId!==drag.id)return;
  const dx=(event.clientX-drag.x)/drag.rect.width,dy=(event.clientY-drag.y)/drag.rect.height;
  if(drag.handle==='new'){
    const x=Math.max(0,Math.min(1,drag.start.x+dx)),y=Math.max(0,Math.min(1,drag.start.y+dy));
    if(Math.abs(dx)<0.01||Math.abs(dy)<0.01)return;
    draft().crop=normalizeCrop({x:Math.min(x,drag.start.x),y:Math.min(y,drag.start.y),width:Math.abs(x-drag.start.x),height:Math.abs(y-drag.start.y)});
  }else draft().crop=moveCrop(drag.crop,drag.handle,dx,dy,Math.min(.02,30/drag.rect.width),Math.min(.02,30/drag.rect.height));
  renderCrop();
}
function pointerEnd(event){if(drag?.id===event.pointerId){pointerMove(event);drag=null;if(get('CropLayer').hasPointerCapture(event.pointerId))get('CropLayer').releasePointerCapture(event.pointerId);}}
function keyCrop(event){
  const direction={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key],handle=event.target.closest('[data-handle]')?.dataset.handle;
  if(!direction||!handle||!draft()?.cropping||session.saving)return;
  event.preventDefault();event.stopPropagation();const step=event.shiftKey ? .05 : .005;
  draft().crop=moveCrop(draft().crop,handle,direction[0]*step,direction[1]*step);renderCrop();
}
function remove(){
  if(session.loading||session.saving)return;const removed=draft();session.dateSources=session.dateSources.filter(item=>item!==removed);session.drafts.splice(session.index,1);
  if(!session.drafts.length){finish(session.files.filter(file=>!isPhoto(file)));return;}
  session.index=Math.min(session.index,session.drafts.length-1);load();
}
async function encode(d,image){
  const rect=pixelCrop(d.width,d.height,d.rotation,d.crop),canvas=document.createElement('canvas');canvas.width=rect.width;canvas.height=rect.height;
  try{
    const ctx=canvas.getContext('2d');if(!ctx||canvas.width!==rect.width||canvas.height!==rect.height)throw Error();
    drawPhoto(ctx,image,d.width,d.height,d.rotation,d.crop);
    const blob=await new Promise((resolve,reject)=>{try{canvas.toBlob(value=>value?resolve(value):reject(Error()),outputFormat(d.file),.96);}catch(error){reject(error);}});
    if(blob.size>50*1024*1024)throw Error(tr('התמונה הערוכה גדולה מ־50MB. חתכו מעט יותר או בחרו תמונה קטנה יותר.','The edited photo exceeds 50MB. Crop further or choose a smaller photo.'));
    return new File([blob],outputName(d.file.name,blob.type),{type:blob.type,lastModified:Date.now()});
  }finally{canvas.width=canvas.height=1;}
}
async function prepareDraft(d){
  if(d.file.size>50*1024*1024)throw Error(tr('אפשר להעלות תמונה עד 50MB.','Photos can be up to 50MB.'));
  let file;
  if(!changed(d.rotation,d.crop))file=new File([d.file],d.file.name,{type:d.file.type,lastModified:d.file.lastModified});
  else{release();source=await decode(d.file);Object.assign(d,dimensions(source));file=await encode(d,source);}
  fileMetadata.set(file,metadataForDraft(d));return file;
}
async function invalidMetadata(d,index){
  const problem=dateProblem(d);
  if(!problem){try{normalizeUploadMetadata(d.metadata);return false;}catch{/* Show metadata errors before any file is uploaded. */}}
  if(session.index!==index){session.index=index;await load();}
  if(!showDateProblem(problem)){get('Error').textContent=tr('בדקו את פרטי התמונה. התיאור מוגבל ל־5,000 תווים.','Check the photo details. Descriptions can be up to 5,000 characters.');get('Caption').focus();}
  return true;
}
async function recoverSave(owner,error){
  if(session!==owner)return;owner.saving=false;await load();if(session===owner)get('Error').textContent=error.message||tr('לא ניתן לשמור כרגע. נסו שוב.','Could not save. Please try again.');
}
async function saveCurrent(){
  const owner=session,d=draft();if(!owner||!d||owner.mode==='existing'||owner.loading||owner.saving||!owner.onUpload)return;
  await window.FamilyFaces?.flush?.();if(session!==owner||draft()!==d||owner.saving)return;
  if(await invalidMetadata(d,owner.index))return;
  if(session!==owner||draft()!==d||owner.saving)return;
  owner.saving=true;stopFaces();setBusy(true);get('Error').textContent='';
  try{
    const file=await prepareDraft(d);
    await owner.onUpload(file,percent=>{if(session===owner)get('SaveCurrent').textContent=tr('מעלה ','Uploading ')+percent+'%';});
    if(session!==owner)return;
    owner.drafts=owner.drafts.filter(other=>other!==d);owner.saving=false;
    get('UploadStatus').textContent=tr('התמונה הועלתה ✓ ','Photo uploaded ✓ ')+d.file.name;
    if(!owner.drafts.length){
      if(!owner.files.some(file=>!isPhoto(file))){finish([]);return;}
      stopFaces();release();get('Image').hidden=true;get('Metadata').hidden=true;get('Tags').hidden=true;get('FamilyPhotoChoice').hidden=true;get('TaggingToggle').hidden=true;get('Loading').hidden=false;get('Loading').textContent=tr('התמונות הועלו. נותרו קבצים נוספים. ״שמירה והעלאה של הכל״ תעלה אותם.','Photos uploaded. Other files remain. Choose “Save and upload all” to upload them.');
      setBusy(false);for(const name of ['Left','Right','CropToggle','Reset','Full','Remove'])get(name).disabled=true;saveLabel();return;
    }
    owner.index=owner.index%owner.drafts.length;await load();
  }catch(error){await recoverSave(owner,error);}
}
async function save(){
  const owner=session;if(!owner||owner.loading||owner.saving)return;
  if(owner.mode==='existing'){await saveExisting();return;}
  await window.FamilyFaces?.flush?.();if(session!==owner||owner.saving)return;
  for(const [index,d]of owner.drafts.entries())if(await invalidMetadata(d,index))return;
  owner.saving=true;stopFaces();setBusy(true);get('Error').textContent='';const prepared=new Map();
  try{
    for(const [index,d]of owner.drafts.entries()){
      get('Save').textContent=tr('מכין תמונה ','Preparing photo ')+(index+1)+' / '+owner.drafts.length+'…';
      prepared.set(d.fileIndex,await prepareDraft(d));
    }
    finish(owner.files.flatMap((file,index)=>isPhoto(file)?(prepared.has(index)?[prepared.get(index)]:[]):[file]));
  }catch(error){await recoverSave(owner,error);}
}
async function saveExisting(){
  const owner=session,d=draft(),modified=changed(d.rotation,d.crop);
  if(!modified&&d.baseVersion===owner.expectedVersion){finish(null);return;}
  owner.saving=true;setBusy(true);get('Error').textContent='';get('Save').textContent=tr('שומר…','Saving…');
  try{
    let response;
    if(!modified)response=await I.fetch('api/media/'+owner.item.id+'/versions/'+d.baseVersion+'/restore',{method:'POST',headers:{'Content-Type':'application/json','X-Family-Token':window.FAMILY_API_TOKEN},body:JSON.stringify({expectedVersion:owner.expectedVersion})});
    else{
      release();source=await decode(d.file);Object.assign(d,dimensions(source));const file=await encode(d,source);
      const query=new URLSearchParams({expectedVersion:owner.expectedVersion,baseVersion:d.baseVersion,rotation:d.rotation,crop:JSON.stringify(d.crop),filename:file.name});
      response=await I.fetch('api/media/'+owner.item.id+'/edit?'+query,{method:'POST',headers:{'Content-Type':file.type,'X-Family-Token':window.FAMILY_API_TOKEN},body:file});
    }
    const result=await responseJSON(response);finish(result);
  }catch(error){
    owner.saving=false;await load();if(session===owner)get('Error').textContent=error.message||tr('לא ניתן לשמור כרגע. נסו שוב.','The photo could not be saved. Please try again.');
  }
}
function cancel(){if(session?.saving)return;finish(null);}
function finish(files){
  if(!session)return;const resolve=session.resolve,focus=session.focus;session.abort?.abort();stopFaces();session=null;++loadId;drag=null;release();dialog.close();
  get('Canvas').width=get('Canvas').height=1;resolve(files);focus?.focus?.({preventScroll:true});queueMicrotask(run);
}
function run(){
  if(session||!jobs.length)return;mount();session=jobs.shift();session.focus=document.activeElement;session.index=0;session.loading=false;session.saving=false;
  configure();dialog.showModal();fitEditor();if(session.mode==='existing')loadHistory();else{const owner=session;void loadPhotoLabelCatalog().then(()=>{if(session===owner)renderEventChoices();});load();}
}
function prepare(input,{scope,onUpload}={}){
  const files=[...input],drafts=files.flatMap((file,fileIndex)=>{if(!isPhoto(file))return [];const inferred=filenamePhotoDate(file.name);return [{key:'upload-'+crypto.randomUUID().replaceAll('-',''),file,fileIndex,faceTags:[],facesComplete:false,tagging:false,rotation:0,crop:fullCrop(),cropping:false,metadata:{date:inferred.date,caption:'',familyPhoto:scope==='photos',labels:[]},dateSource:inferred.status,dateEdited:false}];});
  if(!drafts.length)return Promise.resolve(files);
  return new Promise(resolve=>{jobs.push({files,drafts,dateSources:[...drafts],resolve,scope,onUpload});run();});
}
window.addEventListener('beforeunload',event=>{if(session&&(session.mode!=='existing'||session.saving||session.drafts.some(d=>changed(d.rotation,d.crop)))||jobs.some(job=>job.mode!=='existing')){event.preventDefault();event.returnValue='';}});
function edit(item){
  if(!item?.id||item.kind!=='photo')return Promise.resolve(null);
  return new Promise(resolve=>{jobs.push({mode:'existing',item,files:[],drafts:[],resolve});run();});
}
window.FamilyPhotoEditor={prepare,edit,upload:file=>photoUploadPayload(file,fileMetadata.get(file))};
