import {fullCrop,turns,isPhoto,normalizeCrop,rotateCrop,rotatedSize,pixelCrop,moveCrop,changed,outputFormat,outputName,drawPhoto} from './photo-edit-core.mjs';
import {filenamePhotoDate,normalizeUploadMetadata,photoUploadPayload} from './photo-upload-metadata.mjs?v=2';

const I=window.FamilyI18n,tr=(he,en)=>I.isEnglish?en:he;
const jobs=[];
const fileMetadata=new WeakMap();
let session=null,dialog,source=null,sourceUrl=null,loadId=0,drag=null;
const get=id=>document.getElementById('photoEdit'+id);
const draft=()=>session?.drafts[session.index];

function mount(){
  if(dialog)return;
  dialog=document.createElement('dialog');dialog.id='photoUploadEditor';dialog.className='photo-upload-editor';dialog.dataset.i18nSkip='';dialog.dir=I.isEnglish?'ltr':'rtl';
  dialog.setAttribute('aria-labelledby','photoEditTitle');dialog.setAttribute('aria-describedby','photoEditHint');
  dialog.innerHTML=`<header class="photo-edit-header"><div><span class="photo-edit-eyebrow">${tr('רגע לפני ששומרים','Before you upload')}</span><h2 id="photoEditTitle">${tr('סיבוב וחיתוך תמונות','Rotate and crop photos')}</h2></div><button type="button" id="photoEditClose" class="photo-edit-close" aria-label="${tr('ביטול ההעלאה','Cancel upload')}">×</button></header>
    <p id="photoEditHint" class="photo-edit-hint">${tr('אפשר לסובב ולחתוך כאן לפני ההעלאה.','Rotate and crop here before uploading.')}</p>
    <div id="photoEditHistory" class="photo-edit-history" hidden><label for="photoEditVersion">${tr('גרסאות התמונה','Photo versions')}</label><select id="photoEditVersion"></select><span id="photoEditVersionStatus" role="status"></span></div>
    <nav class="photo-edit-pager" aria-label="${tr('התמונות שנבחרו להעלאה','Photos selected for upload')}"><button type="button" id="photoEditPrevious" class="secondary-button">${tr('הקודמת','Previous')}</button><div><strong id="photoEditCounter" aria-live="polite"></strong><span id="photoEditFilename" dir="auto"></span></div><button type="button" id="photoEditNext" class="secondary-button">${tr('הבאה','Next')}</button></nav>
    <section id="photoEditMetadata" class="photo-edit-metadata"><fieldset class="photo-edit-date"><legend>${tr('תאריך צילום','Photo date')}</legend><div class="photo-edit-date-fields">${[['day',tr('יום','Day'),1,31],['month',tr('חודש','Month'),1,12],['year',tr('שנה','Year'),1000,9999]].map(([field,label,min,max])=>`<label for="photoEditDate${field}">${label}<input id="photoEditDate${field}" type="number" inputmode="numeric" min="${min}" max="${max}" step="1" placeholder="—" autocomplete="off"></label>`).join('')}</div><p id="photoEditDateSource" class="photo-edit-date-source" role="status" hidden></p></fieldset><label class="photo-edit-caption" for="photoEditCaption">${tr('תיאור התמונה','Photo description')}<textarea id="photoEditCaption" dir="auto" rows="2" maxlength="5000" placeholder="${tr('מי בתמונה? איפה ומה הסיפור?','Who is pictured? Where was it taken?')}" autocomplete="off"></textarea></label><label id="photoEditFamilyPhotoChoice" class="photo-edit-family-choice" for="photoEditFamilyPhoto"><input id="photoEditFamilyPhoto" type="checkbox" aria-label="${tr('הוספה לתמונות משפחתיות','Add to Family photos')}"><span class="photo-edit-family-symbol" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="6" cy="7" r="3"/><circle cx="18" cy="7" r="3"/><circle cx="12" cy="13" r="2.5"/><path d="M1 20v-4a5 5 0 0 1 7-4m15 8v-4a5 5 0 0 0-7-4M7 22v-2a5 5 0 0 1 10 0v2"/></svg></span><span class="photo-edit-family-text">${tr('הוספה לתמונות משפחתיות','Add to Family photos')}</span></label></section>
    <div id="photoEditViewport" class="photo-edit-viewport"><p id="photoEditLoading" role="status"></p><div id="photoEditImage" class="photo-edit-image" hidden><canvas id="photoEditCanvas" role="img" aria-label="${tr('תצוגה מקדימה של התמונה לפני ההעלאה','Photo preview before upload')}"></canvas><div id="photoEditCropLayer" class="photo-edit-crop-layer" hidden><div id="photoEditCrop" class="photo-edit-crop" data-handle="move" tabindex="0" role="group" aria-label="${tr('מסגרת החיתוך. גררו להזזה או השתמשו במקשי החצים.','Crop area. Drag to move or use the arrow keys.')}">${['nw','n','ne','e','se','s','sw','w'].map(handle=>`<button type="button" class="photo-edit-handle handle-${handle}" data-handle="${handle}" aria-label="${handleLabel(handle)}"></button>`).join('')}<span class="photo-edit-thirds" aria-hidden="true"></span></div></div></div></div>
    <div class="photo-edit-toolbar"><button type="button" id="photoEditLeft" class="secondary-button"><span aria-hidden="true">↶</span> ${tr('סיבוב שמאלה','Rotate left')}</button><button type="button" id="photoEditRight" class="secondary-button"><span aria-hidden="true">↷</span> ${tr('סיבוב ימינה','Rotate right')}</button><button type="button" id="photoEditCropToggle" class="secondary-button" aria-pressed="false">${tr('חיתוך','Crop')}</button><button type="button" id="photoEditReset" class="photo-edit-text-button">${tr('איפוס','Reset')}</button></div>
    <div id="photoEditCropHelp" class="photo-edit-crop-help" hidden><p>${tr('גררו את פינות המסגרת לחיתוך, או את המרכז להזזה. במקלדת: חצים; Shift לצעד גדול.','Drag the corners to crop, or the centre to move. Keyboard: arrows; Shift for a larger step.')}</p><button type="button" id="photoEditFull" class="photo-edit-text-button">${tr('החזרת התמונה המלאה','Use full photo')}</button></div>
    <div class="photo-edit-info"><span id="photoEditDimensions" dir="ltr" aria-live="polite"></span><span id="photoEditAnimation"></span></div><p id="photoEditError" class="photo-edit-error" role="alert"></p>
    <footer class="photo-edit-footer"><button type="button" id="photoEditSave" class="primary-button"></button><button type="button" id="photoEditCancel" class="secondary-button">${tr('ביטול ההעלאה','Cancel upload')}</button><button type="button" id="photoEditRemove" class="photo-edit-remove" aria-label="${tr('הסרת התמונה הנוכחית מההעלאה','Remove the current photo from this upload')}"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6m4-6v6"/></svg><span>${tr('הסרת תמונה','Remove photo')}</span></button></footer>`;
  document.body.append(dialog);
  get('Close').addEventListener('click',cancel);get('Cancel').addEventListener('click',cancel);
  dialog.addEventListener('cancel',event=>{event.preventDefault();cancel();});
  get('Previous').addEventListener('click',()=>navigate(-1));get('Next').addEventListener('click',()=>navigate(1));
  get('Left').addEventListener('click',()=>rotate(-1));get('Right').addEventListener('click',()=>rotate(1));
  get('CropToggle').addEventListener('click',()=>{draft().cropping=!draft().cropping;renderCrop();});
  get('Reset').addEventListener('click',()=>{Object.assign(draft(),{rotation:0,crop:fullCrop(),cropping:false});render();});
  get('Full').addEventListener('click',()=>{draft().crop=fullCrop();renderCrop();});
  get('Remove').addEventListener('click',remove);get('Save').addEventListener('click',save);
  get('Version').addEventListener('change',()=>loadVersion(get('Version').value));
  for(const field of ['day','month','year'])get('Date'+field).addEventListener('input',event=>{const d=draft();if(!d?.metadata)return;d.metadata.date[field]=event.target.value===''?null:Number(event.target.value);d.dateEdited=true;get('DateSource').hidden=true;get('Error').textContent='';});
  get('Caption').addEventListener('input',event=>{if(draft()?.metadata)draft().metadata.caption=event.target.value;});
  get('FamilyPhoto').addEventListener('change',event=>{if(draft()?.metadata)draft().metadata.familyPhoto=event.target.checked;});
  get('Metadata').addEventListener('focusin',()=>{fitEditor();requestAnimationFrame(revealMetadata);});
  window.addEventListener('resize',fitEditor);window.visualViewport?.addEventListener('resize',()=>{fitEditor();requestAnimationFrame(revealMetadata);});
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
  get('Previous').disabled=busy||session.index===0;get('Next').disabled=busy||session.index===session.drafts.length-1;
  get('Version').disabled=busy;
}
function fitEditor(){
  if(!session||!dialog?.open||session.mode==='existing')return;
  dialog.style.setProperty('--photo-editor-height',(window.visualViewport?.height||window.innerHeight)+'px');
  dialog.style.setProperty('--photo-editor-top',(window.visualViewport?.offsetTop||0)+'px');
}
function revealMetadata(){if(session&&get('Metadata').contains(document.activeElement))document.activeElement.scrollIntoView?.({block:'nearest',behavior:'auto'});}
function renderMetadata(){
  const d=draft();get('Metadata').hidden=session.mode==='existing';if(!d?.metadata||session.mode==='existing')return;
  for(const field of ['day','month','year'])get('Date'+field).value=d.metadata.date[field]??'';
  get('Caption').value=d.metadata.caption;
  get('FamilyPhotoChoice').hidden=session.scope==='photos';get('FamilyPhoto').checked=d.metadata.familyPhoto;
  const messages={full:tr('התאריך זוהה משם הקובץ. אפשר לערוך אותו.','Date filled from the filename. You can edit it.'),partial:tr('תאריך חלקי משם הקובץ. אפשר להשלים את מה שידוע.','Partial date from the filename. Add any other details you know.'),ambiguous:tr('בשם הקובץ יש כמה אפשרויות תאריך. מולאו רק החלקים המשותפים.','The filename contains alternative dates. Only shared parts were filled in.'),invalid:tr('התאריך בשם הקובץ אינו תקין. אפשר להזין תאריך ידנית.','The filename date is invalid. You can enter the date manually.')};
  get('DateSource').textContent=d.dateEdited?'':messages[d.dateSource]||'';get('DateSource').hidden=!get('DateSource').textContent;
}
function saveLabel(){
  if(session.mode==='existing'){
    const d=draft();get('Save').textContent=d&&changed(d.rotation,d.crop)?tr('שמירת גרסה חדשה','Save new version'):d?.baseVersion!==session.expectedVersion?tr('שחזור גרסה זו','Restore this version'):tr('סיום','Done');return;
  }
  const count=session.files.filter((file,index)=>!isPhoto(file)||session.drafts.some(item=>item.fileIndex===index)).length;
  get('Save').textContent=tr('שמירה והעלאה','Save and upload')+(count>1?` (${count})`:'');
}
async function load(){
  const id=++loadId;drag=null;release();get('Image').hidden=true;get('Error').textContent='';get('Loading').hidden=false;
  get('Loading').textContent=tr('טוען תצוגה מקדימה…','Loading preview…');setBusy(true);saveLabel();
  get('Counter').textContent=I.isEnglish?`Photo ${session.index+1} of ${session.drafts.length}`:`תמונה ${session.index+1} מתוך ${session.drafts.length}`;
  get('Filename').textContent=draft().file.name;
  renderMetadata();
  try{
    const image=await decode(draft().file);if(id!==loadId){image.close?.();return;}
    source=image;const size=dimensions(image);if(!size.width||!size.height)throw Error();
    Object.assign(draft(),size);setBusy(false);get('Loading').hidden=true;get('Image').hidden=false;render();
  }catch{
    if(id!==loadId)return;release();setBusy(false);get('Loading').hidden=true;
    get('Error').textContent=tr('לא ניתן לפתוח את התמונה הזו. הסירו אותה מההעלאה או בחרו קובץ JPG, PNG או WebP.','This photo could not be opened. Remove it from this upload or choose a JPG, PNG or WebP file.');
    for(const name of ['Save','Left','Right','CropToggle','Reset'])get(name).disabled=true;
  }
}
function render(){
  const d=draft();if(!d||!source)return;
  const size=rotatedSize(d.width,d.height,d.rotation),viewport=get('Viewport');
  const fit=Math.min((viewport.clientWidth-40)/size.width,(viewport.clientHeight-40)/size.height,1);
  get('Image').style.width=Math.max(1,size.width*fit)+'px';get('Image').style.height=Math.max(1,size.height*fit)+'px';
  const canvas=get('Canvas'),scale=Math.min(1,1600/Math.max(size.width,size.height));
  canvas.width=Math.max(1,Math.round(size.width*scale));canvas.height=Math.max(1,Math.round(size.height*scale));
  drawPhoto(canvas.getContext('2d'),source,d.width,d.height,d.rotation,fullCrop(),scale);renderCrop();
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
  if(d.width){const rect=pixelCrop(d.width,d.height,d.rotation,c);get('Dimensions').textContent=`${rect.width} × ${rect.height} px`;}
  get('Animation').textContent=/image\/gif/i.test(d.file.type)||/\.gif$/i.test(d.file.name)?tr('סיבוב או חיתוך של GIF ישמרו תמונה ללא אנימציה.','Rotating or cropping a GIF saves a still image.'):'';
  saveLabel();
}
function configure(){
  const existing=session.mode==='existing';dialog.dir=I.isEnglish?'ltr':'rtl';dialog.classList.toggle('is-existing',existing);
  dialog.querySelector('.photo-edit-eyebrow').textContent=existing?tr('המקור והגרסאות נשמרים','Original and previous versions are kept'):tr('רגע לפני ששומרים','Before you upload');
  get('Title').textContent=existing?tr('עריכת תמונה','Edit photo'):tr('עריכת תמונות לפני העלאה','Edit photos before uploading');
  get('Hint').textContent=existing?tr('כל שמירה יוצרת גרסה חדשה. בחרו גרסה קודמת לצפייה או לשחזור.','Each save creates a new version. Choose a previous version to view or restore it.'):tr('אפשר להוסיף תאריך ותיאור, לסובב ולחתוך. כל השדות לבחירתכם.','Add a date and description, rotate or crop. All fields are optional.');
  for(const name of ['Close','Cancel']){get(name).setAttribute('aria-label',existing?tr('ביטול העריכה','Cancel editing'):tr('ביטול ההעלאה','Cancel upload'));if(name==='Cancel')get(name).textContent=tr('ביטול','Cancel');}
  get('History').hidden=!existing;dialog.querySelector('.photo-edit-pager').hidden=existing;get('Remove').hidden=existing;
  get('Metadata').hidden=existing;
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
function navigate(step){if(session.loading||session.saving)return;session.index+=step;load();}
function rotate(direction){const d=draft();d.rotation=turns(d.rotation+direction);d.crop=rotateCrop(d.crop,direction);render();}
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
  if(session.loading||session.saving)return;session.drafts.splice(session.index,1);
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
async function save(){
  if(!session||session.loading||session.saving)return;
  if(session.mode==='existing'){await saveExisting();return;}
  for(const [index,d]of session.drafts.entries()){
    try{normalizeUploadMetadata(d.metadata);}catch{session.index=index;await load();get('Error').textContent=tr('בדקו את תאריך הצילום. אפשר להשאיר כל שדה לא ידוע ריק. התיאור מוגבל ל־5,000 תווים.','Check the photo date. Leave any unknown field blank. Descriptions can be up to 5,000 characters.');get('Dateday').focus();return;}
  }
  session.saving=true;setBusy(true);get('Error').textContent='';const prepared=new Map();
  try{
    for(const [index,d]of session.drafts.entries()){
      get('Save').textContent=tr('מכין תמונה ','Preparing photo ')+(index+1)+' / '+session.drafts.length+'…';
      if(d.file.size>50*1024*1024)throw Error(tr('אפשר להעלות תמונה עד 50MB.','Photos can be up to 50MB.'));
      if(!changed(d.rotation,d.crop)){prepared.set(d.fileIndex,new File([d.file],d.file.name,{type:d.file.type,lastModified:d.file.lastModified}));continue;}
      // Decode one file at a time; keep only the current preview in memory.
      release();const image=await decode(d.file);source=image;Object.assign(d,dimensions(image));
      prepared.set(d.fileIndex,await encode(d,image));
    }
    for(const d of session.drafts)fileMetadata.set(prepared.get(d.fileIndex),normalizeUploadMetadata(d.metadata));
    finish(session.files.flatMap((file,index)=>isPhoto(file)?(prepared.has(index)?[prepared.get(index)]:[]):[file]));
  }catch(error){
    const failed=session;session.saving=false;await load();if(session!==failed)return;
    get('Error').textContent=error.message||tr('לא ניתן לשמור את העריכה. נסו חיתוך קטן יותר או תמונה אחרת.','The edit could not be saved. Try a smaller crop or another photo.');
  }
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
  if(!session)return;const resolve=session.resolve,focus=session.focus;session.abort?.abort();session=null;++loadId;drag=null;release();dialog.close();
  get('Canvas').width=get('Canvas').height=1;resolve(files);focus?.focus?.({preventScroll:true});queueMicrotask(run);
}
function run(){
  if(session||!jobs.length)return;mount();session=jobs.shift();session.focus=document.activeElement;session.index=0;session.loading=false;session.saving=false;
  configure();dialog.showModal();fitEditor();if(session.mode==='existing')loadHistory();else load();
}
function prepare(input,{scope}={}){
  const files=[...input],drafts=files.flatMap((file,fileIndex)=>{if(!isPhoto(file))return [];const inferred=filenamePhotoDate(file.name);return [{file,fileIndex,rotation:0,crop:fullCrop(),cropping:false,metadata:{date:inferred.date,caption:'',familyPhoto:scope==='photos'},dateSource:inferred.status,dateEdited:false}];});
  if(!drafts.length)return Promise.resolve(files);
  return new Promise(resolve=>{jobs.push({files,drafts,resolve,scope});run();});
}
window.addEventListener('beforeunload',event=>{if(session&&(session.mode!=='existing'||session.saving||session.drafts.some(d=>changed(d.rotation,d.crop)))||jobs.some(job=>job.mode!=='existing')){event.preventDefault();event.returnValue='';}});
function edit(item){
  if(!item?.id||item.kind!=='photo')return Promise.resolve(null);
  return new Promise(resolve=>{jobs.push({mode:'existing',item,files:[],drafts:[],resolve});run();});
}
window.FamilyPhotoEditor={prepare,edit,upload:file=>photoUploadPayload(file,fileMetadata.get(file))};
