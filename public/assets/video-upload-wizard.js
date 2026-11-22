import {bindSegmentTimeline, markedRange, prepareSegmentFile, segmentControlsHTML, segmentHue} from './video-upload-segments.mjs?v=playback-1';
import {bindUploadPreview} from './video-upload-preview.mjs?v=upload-repair-1';
import {startUploadCheck} from './video-upload-check.mjs';
import {createVideoSource} from './video-source-upload.mjs';
import {MAX_VIDEO_SOURCE_BYTES} from './video-source-limits.mjs';
import {videoUploadMetadata} from './video-upload-metadata.mjs?v=categories-v1';
import {filenamePhotoDate} from './photo-upload-metadata.mjs?v=4';
const I=window.FamilyI18n,tr=(he,en)=>I.isEnglish?en:he;
const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const isVideo=file=>/^video\//i.test(file.type)||/\.(mp4|mov|webm|m4v)$/i.test(file.name),queue=[];
const uuid=()=>crypto.randomUUID().replaceAll('-','');
let session=null,dialog=null,background=null,preview=null,renderedDraft=null,searchSerial=0,swipe=null,timeline=null;
const get=id=>document.getElementById('videoUpload'+id),draft=()=>session?.drafts[session.index];
function destinations(){return window.FamilyNostalgia?.uploadEvents?.()||[];}
function collect(){const d=draft();if(!d||d.saved||d.frozen)return;d.metadata.name=get('Name').value;d.metadata.caption=get('Caption').value;d.metadata.date=Object.fromEntries(['day','month','year'].map(part=>[part,get('Date'+part).validity?.badInput?NaN:get('Date'+part).value===''?null:Number(get('Date'+part).value)]));if(session.options.scope==='videos')d.metadata.group=get('Target').value;}
function eventMenu(open){
 get('EventChoices').hidden=!open;
 get('EventTrigger').setAttribute('aria-expanded',String(open));
}
function renderEventChoice(){
 eventMenu(false);
 const id=draft().metadata.eventId,library=window.FamilyNostalgia;
 const event=destinations().find(item=>item.id===id)||session.chosenEvents?.get(id);
 let label=tr('ללא שיוך','Unassigned');
 if(id&&id===library?.directUploadId)label=tr('החיים עצמם','Life itself');
 else if(event)label=library.uploadEventLabel(event);
 else if(id)label=tr('אירוע משויך','Assigned event');
 get('EventValue').textContent=label;
 get('EventClear').hidden=!id;
}
function assignEvent(id,event){
 const d=draft();
 if(!d||d.saved||d.frozen||session.saving)return;
 collect();
 d.metadata.eventId=id;
 d.eventChosen=true;
 if(event){
  (session.chosenEvents??=new Map()).set(id,event);
  if(event.date&&!Object.values(d.metadata.date).some(Boolean)){
   d.metadata.date={...event.date};
   for(const part of ['day','month','year'])get('Date'+part).value=d.metadata.date[part]||'';
  }
 }
 if(session.split){
  for(const following of session.drafts.slice(session.index+1)){
   if(following.eventChosen||following.saved||following.frozen||following.uploaded)break;
   following.metadata.eventId=id;
  }
 }
 renderEventChoice();
 get('EventTrigger').focus();
}
function sourceProgress(source) {
 const mb=n=>Math.round(n/1024/1024).toLocaleString(I.isEnglish?'en-US':'he-IL');
 const total=mb(source.file.size),received=mb(source.received);
 if(source.phase==='failed')return tr('העלאת המקור נעצרה. ','Original upload stopped. ')+source.error;
 if(source.phase==='ready')return tr('המקור התקבל באתר','Original received by the site')+' · '+total+' MiB';
 if(source.phase==='assembling')return tr('כל החלקים התקבלו. מאחד את הסרטון באתר…','All parts received. Joining the video on the site…');
 if(source.phase==='starting')return tr('מתחיל להעלות את קובץ המקור…','Starting the original upload…');
 return tr('התקבלו באתר ','Received by the site ')+received+' / '+total+' MiB · '+Math.min(99,Math.floor(100*source.received/source.file.size))+'%';
}
function showSource(source) {
 get('SourcePanel').hidden=!source;
 if(!source)return;
 const done=source.phase==='ready',active=!done&&source.phase!=='failed';
 get('SourceStatus').textContent=sourceProgress(source);
 get('SourceProgress').hidden=!active;get('SourceProgress').value=source.received/source.file.size*100;
 get('SourceRetry').hidden=source.phase!=='failed';get('SourceMinimize').hidden=!active||session.saving;
 get('SourcePlay').hidden=!done;
 if(done)preview.provideRemote(source.file,source.url);
 if(session.saving&&active){get('Progress').value=get('SourceProgress').value;session.percent=get('Progress').value;}
 updateBackground();
}
function stageFor(owner,file) {
 if(!owner.options.stageSources)return null;
 let source=owner.sources.get(file);
 if(source)return source;
 const factory=typeof owner.options.stageSources==='function'?owner.options.stageSources:createVideoSource;
 source=factory(file,{scope:owner.options.scope,request:(...args)=>I.fetch(...args),writeToken:window.FAMILY_API_TOKEN,tr,
   changed:item=>{if(session===owner&&draft()?.file===item.file)showSource(item);}});
 owner.sources.set(file,source);
 void source.ensure().catch(()=>{});
 return source;
}
function checkMessage(check) {
 if(check.phase==='checking')return tr('בודק את קידוד הסרטון… ','Checking video encoding… ')+check.percent+'%';
 if(check.phase==='verifying')return check.repaired?
  tr('תוקנו שגיאות בקידוד. בודק את הניגון…','Encoding errors repaired. Checking playback…'):
  tr('בודק ניגון של הסרטון…','Checking video playback…');
 if(check.phase==='failed'){
  if(check.error?.code==='VIDEO_SOURCE_SIZE')return tr('אפשר להעלות קובץ מקור עד 4 GiB.','Original recordings up to 4 GiB are supported.');
  if(check.error?.code==='VIDEO_STALL')return tr('הניגון לא התקדם בבדיקה. אפשר לבדוק שוב או לבחור קובץ אחר.','Playback stalled during verification. Retry the check or select another file.');
  if(check.error?.code==='VIDEO_DECODE'||check.error?.code==='VIDEO_DAMAGED')return tr('הסרטון לא עבר את בדיקת הניגון. התיקון האוטומטי לא הספיק. בחרו עותק אחר להעלאה.','The video failed its playback check. Automatic repair could not make it playable. Choose another copy to upload.');
  return tr('קריאת הסרטון נקטעה. אפשר לנסות שוב.','The video could not be read. Please retry.');
 }
 if(check.repaired)return check.verified?
  tr('שגיאות הקידוד תוקנו והניגון נבדק. העותק המתוקן ישמש להעלאה ולמקטעים.','Encoding errors repaired and playback checked. Uploads and clips use the repaired file.'):
  tr('שגיאות הקידוד תוקנו. הניגון במכשיר זה דורש בדיקה ידנית.','Encoding errors repaired. Check playback manually on this device.');
 return check.verified?'':tr('בדיקת הניגון האוטומטית לא הסתיימה במכשיר זה. ניתן לבדוק בנגן.','Automatic playback verification was unavailable on this device. You can check in the player.');
}
function showCheckedSource(owner,d) {
 const check=d.check,active=check.phase==='checking'||check.phase==='verifying',message=checkMessage(check);
 get('CheckPanel').hidden=!message;
 get('CheckStatus').textContent=message;
 get('CheckRetry').hidden=check.phase!=='failed';
 get('CheckMinimize').hidden=!active||owner.saving;
 if(check.phase!=='ready'){
  if(preview.displayFile())preview.suspend();
  showSource(null);updateBackground();
  return false;
 }
 d.file=check.file;
 const changed=preview.open(d.file,d.duration);
 showSource(stageFor(owner,d.file));
 return changed;
}
function checkDraft(owner,d) {
 if(!d.check){
  d.check=startUploadCheck(d.file,item=>{
   if(session!==owner||d.check!==item)return;
   if(item.phase==='ready')d.file=item.file;
   if(draft()===d){showCheckedSource(owner,d);locks();}
  },owner.options.stageSources?MAX_VIDEO_SOURCE_BYTES:Infinity);
  owner.checks.add(d.check);
 }
 return showCheckedSource(owner,d);
}
function updateBackground(){
 if(!background)return;background.hidden=!session||dialog.open;if(!session)return;
 const marked=session.split?session.drafts.filter(markedRange):session.drafts;
 const completed=marked.filter(d=>d.saved).length,total=marked.length||1;
 const label=session.split?segmentLabel(draft()):tr('סרטון ','Video ')+(session.index+1)+tr(' מתוך ',' of ')+total;
 const stage=session.sources?.get(draft()?.file);
 const check=draft()?.check,checking=check&&check.phase!=='ready';
 const status=checking?checkMessage(check):!session.saving&&stage&&stage.phase!=='ready'?sourceProgress(stage):session.error?tr('ההעלאה נעצרה — לחצו לניסיון נוסף','Upload paused — click to retry'):session.saving?label+' · '+(session.percent||0)+'%':session.split?tr('חזרה למקטעים','Return to segments'):tr('סרטונים ממתינים לשמירה','Videos waiting to be saved');
 get('BackgroundStatus').textContent=status;get('BackgroundProgress').value=checking?check.percent:stage&&!session.saving&&stage.phase!=='ready'?100*stage.received/stage.file.size:(completed+(session.saving&&!draft().saved?(session.percent||0)/100:0))/total*100;
 background.classList.toggle('has-error',Boolean(session.error));
}
function minimize(){if(!session)return;get('Player').pause();dialog.close();updateBackground();}
function restore(){if(!session||dialog.open)return;dialog.showModal();updateBackground();}
function busy(value){session.saving=value;if(value)swipe?.reset();dialog.setAttribute('aria-busy',String(value));for(const node of dialog.querySelectorAll('input,textarea,select,button'))node.disabled=value;get('Close').disabled=false;get('Close').setAttribute('aria-label',value?tr('המשך העלאה ברקע','Continue upload in the background'):tr('סגירת אשף העלאת הסרטונים','Close video upload wizard'));get('Progress').hidden=!value;if(!value)locks();updateBackground();}
const segmentLabel=d=>tr('מקטע ','Segment ')+d.segment.number;
function markedBy(d,cutoff){
 const range=markedRange(d);
 return Boolean(range&&(cutoff===undefined||range.end<=cutoff+.005));
}
function uploadCutoff(){
 return window.FamilyVideoEditor.seconds(get('CutoffTime').value);
}
function locks(){
 if(!session||session.saving)return;
 const d=draft(),locked=Boolean(d.saved||d.frozen),split=session.split,range=split&&markedRange(d);
 for(const node of dialog.querySelectorAll('[data-video-draft-field]'))node.disabled=locked;
 for(const node of get('PeopleTags').querySelectorAll('button'))node.disabled=locked;
 for(const node of dialog.querySelectorAll('[data-video-boundary]'))node.disabled=locked||Boolean(d.uploaded);
 get('SaveCurrent').disabled=d.saved||d.check?.phase==='failed'||(split&&!range);
 get('SaveAll').disabled=split&&!session.drafts.some(item=>!item.saved&&markedRange(item));
 get('BatchOptions').hidden=!split||session.drafts.length<2;
 if(split){
  const cutoff=uploadCutoff();
  get('SaveThrough').disabled=!Number.isFinite(cutoff)||cutoff<0||cutoff>d.duration+.005||!session.drafts.some(item=>!item.saved&&markedBy(item,cutoff));
 }
 const ready=d.check?.phase==='ready';
 for(const id of ['PreviewMode','PreviewPick','PreviewPlay'])get(id).disabled=!ready;
 get('Edit').disabled=!ready||(split?!range:locked||!d.duration);
 get('Reset').disabled=locked||Boolean(d.uploaded);
 get('Split').hidden=!session.singleVideo;
 get('Split').disabled=split?false:!ready||locked||Boolean(d.uploaded)||!(d.duration>=.1);
 get('Remove').hidden=Boolean(d.saved||d.uploaded||d.frozen);
 get('Done').hidden=!split||!session.drafts.every(item=>item.saved);
 get('CopyDate').disabled=session.index===0||locked;
 get('Previous').disabled=session.index===0;
 get('Next').disabled=session.index===session.drafts.length-1&&(!split||!range);
}
function renderPeople(){const d=draft();get('PeopleTags').innerHTML=d.metadata.people.map((person,index)=>`<button type="button" class="video-upload-person" data-video-remove-person="${index}" ${d.saved||d.frozen?'disabled':''}><span>${safe(person.label||person.name||person.personId)}</span><span aria-hidden="true">×</span></button>`).join('');}
function rangeText(){const d=draft();
 if(session.split){
  const range=markedRange(d);
  get('Range').textContent=range?tr('משך המקטע · ','Segment length · ')+window.FamilyVideoEditor.clock(range.end-range.start):
   d.segment.end===null&&!d.segment.endText?tr('סמנו את סוף המקטע','Mark the end of the segment'):tr('יש לסמן התחלה וסיום בהפרש של עשירית שנייה לפחות','Choose a start and end at least 0.1 seconds apart');
  return;
 }
 get('Range').textContent=d.metadata.range?tr(d.metadata.range.remove?'הקטע למחיקה: ':'הקטע שנבחר: ',d.metadata.range.remove?'Segment to delete: ':'Selected clip: ')+window.FamilyVideoEditor.clock(d.metadata.range.start)+' – '+window.FamilyVideoEditor.clock(d.metadata.range.end):tr('הסרטון המלא','Full video');}
function render(){
 const d=draft();if(!d)return;swipe?.reset();searchSerial++;session.matches=[];
 const split=session.split;
 dialog.classList.toggle('is-splitting',split);
 get('Title').textContent=split?segmentLabel(d):tr('אשף העלאת הסרטונים','Video Upload Wizard');
 get('Split').setAttribute('aria-pressed',String(split));
 get('SplitLabel').textContent=split?tr('חזרה לסרטון המלא','Back to full video'):tr('חלוקת סרטון למקטעים','Split video into segments');
 get('EditIcon').innerHTML=split?'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 4 13 8-13 8Z"/></svg>':window.FamilyVideoEditor.icon;
 get('NameLabel').textContent=split?tr('שם המקטע','Segment name'):tr('שם הסרטון','Video name');
 get('CaptionLabel').textContent=split?tr('תיאור המקטע','Segment description'):tr('תיאור הסרטון','Video description');
 get('TagsLabel').textContent=split?tr('תיוג אנשים במקטע','Tag people in the segment'):tr('תיוג אנשים בסרטון','Tag people in the video');
 get('EditLabel').textContent=split?tr('ניגון המקטע','Play segment'):tr('עריכת הסרטון','Edit video');
 get('Previous').textContent=split?tr('המקטע הקודם','Previous segment'):tr('הקודם','Previous');
 get('Next').textContent=split?tr('המקטע הבא','Next segment'):tr('הבא','Next');
 get('Remove').textContent=split?tr('הסרת המקטע','Remove segment'):tr('הסרת הסרטון מההעלאה','Remove video from upload');
 get('CopyDate').setAttribute('aria-label',split?tr('העתקת התאריך מהמקטע הקודם','Copy date from previous segment'):tr('העתקת התאריך מהסרטון הקודם','Copy date from previous video'));
 if(split)dialog.style.setProperty('--segment-hue',segmentHue(d.segment.number));
 get('Counter').textContent=split?tr('חלוקת סרטון למקטעים','Split video into segments'):tr('סרטון ','Video ')+(session.index+1)+tr(' מתוך ',' of ')+session.drafts.length+(d.saved?' ✓':'');get('Filename').textContent=d.file.name;get('Name').value=d.metadata.name;get('Caption').value=d.metadata.caption;
 for(const part of ['day','month','year'])get('Date'+part).value=d.metadata.date[part]||'';
 const nostalgia=session.options.scope==='nostalgia',videos=session.options.scope==='videos';
 get('EventRow').hidden=!nostalgia;get('TargetRow').hidden=!videos;
 if(nostalgia)renderEventChoice();
 if(videos){
  get('Target').innerHTML=window.FamilyVideoCategories?.options({allowCreate:true})||`<option value="family">${tr('סרטונים משפחתיים','Family videos')}</option><option value="special-birthdays">${tr('ימי הולדת עגולים','Milestone birthdays')}</option>`;
  get('Target').value=d.metadata.group||'family';
 }
 get('Search').value='';get('Results').replaceChildren();get('Error').textContent='';get('Status').textContent=d.saved?(split?tr('המקטע הועלה ✓','Segment uploaded ✓'):tr('הסרטון נשמר ✓','Video saved ✓')):d.uploaded?tr('הסרטון התקבל. אפשר לנסות שוב את שמירת הפרטים.','The video was received. You can retry saving its details.') :'';renderPeople();rangeText();
 const changedFile=checkDraft(session,d),changedDraft=renderedDraft!==d;
 renderedDraft=d;
 timeline.show(split?session.drafts:[],session.index);
 if(split&&changedDraft&&!changedFile)timeline.seekStart();
 get('Progress').hidden=true;locks();
 get('SaveAll').textContent=split?tr('העלאת כל המקטעים שסומנו','Upload all marked segments'):tr('שמירה והעלאה של הכול','Save and upload all');
 get('SaveCurrent').textContent=split?tr('שמירה והעלאת המקטע','Save and upload this segment'):tr('שמירה והעלאת סרטון זה','Save and upload this video');
}
function createSegment(previous){
 const source=session.original,number=session.nextNumber++,first=!previous;
 const base=source.metadata,suffix=' – '+tr('מקטע ','Segment ')+number;
 const metadata={name:base.name.trim().slice(0,140-suffix.length)+suffix,
  caption:first?base.caption:'',date:{...(previous?.metadata.date||base.date)},
  people:first?base.people.map(p=>({...p})):[]};
 const defaults=previous?.metadata||base;
 if(defaults.eventId!==undefined)metadata.eventId=defaults.eventId;
 if(defaults.group!==undefined)metadata.group=defaults.group;
 const initial=first&&!base.range?.remove?base.range:null;
 const previousEnd=previous?.segment.end??0;
 const start=initial?.start??(previousEnd<=source.duration-.1?previousEnd:0);
 return {file:source.file,check:source.check,metadata,uploadId:uuid(),uploaded:null,saved:false,duration:source.duration,frozen:null,
  segment:{number,start,end:initial?.end??null},preparedFile:null};
}
function toggleSplit(){
 if(!session?.singleVideo||session.saving||get('Split').disabled)return;
 collect();
 if(session.split){
  session.segmentIndex=session.index;session.drafts=[session.original];session.index=0;session.split=false;
 }else{
  session.original=draft();
  if(!session.segments.length)session.segments.push(createSegment());
  session.drafts=session.segments;session.index=session.segmentIndex;session.split=true;
 }
 session.error=null;render();
}
function goTo(index){
 if(!session||session.saving||index===session.index||index<0||index>=session.drafts.length)return;
 collect();session.index=index;render();
}
function navigate(direction){
 if(!session||session.saving)return;
 const index=session.index+direction;
 if(session.split&&index===session.drafts.length&&markedRange(draft())){
  collect();session.drafts.push(createSegment(draft()));session.index=index;render();return;
 }
 goTo(index);
}
function finish(cancelled=false){const owner=session;timeline.show([],0);searchSerial++;for(const check of owner.checks)check.discard();for(const source of owner.sources.values())source.discard();preview.clear();renderedDraft=null;dialog.close();session=null;updateBackground();owner.resolve(cancelled?[]:owner.rest);void next();}
function cancel(){
 if(!session)return;
 if(session.saving){minimize();return;}
 collect();
 if(session.split&&session.drafts.every(d=>d.saved)){finish();return;}
 if(window.confirm(tr('לסגור את אשף העלאת הסרטונים?','Close the video upload wizard?')))finish(true);
}
function mount(){
 if(dialog)return;dialog=document.createElement('dialog');dialog.id='videoUploadWizard';dialog.className='photo-upload-editor video-upload-wizard';dialog.dir=I.isEnglish?'ltr':'rtl';dialog.dataset.i18nSkip='';dialog.setAttribute('aria-labelledby','videoUploadTitle');
 dialog.innerHTML=`<header class="photo-edit-header"><div class="photo-edit-heading"><span class="section-diamond photo-edit-emblem" aria-hidden="true">◇</span><h2 id="videoUploadTitle" aria-live="polite">${tr('אשף העלאת הסרטונים','Video Upload Wizard')}</h2></div><button type="button" id="videoUploadClose" class="photo-edit-close" aria-label="${tr('סגירת אשף העלאת הסרטונים','Close video upload wizard')}"><svg class="photo-edit-close-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m4 4 16 16M20 4 4 20"/></svg></button></header>
 <nav class="photo-edit-pager" aria-label="${tr('הסרטונים שנבחרו להעלאה','Videos selected for upload')}"><button type="button" id="videoUploadPrevious" class="secondary-button">${tr('הקודם','Previous')}</button><div><strong id="videoUploadCounter" aria-live="polite"></strong><span id="videoUploadFilename" dir="auto"></span></div><button type="button" id="videoUploadNext" class="secondary-button">${tr('הבא','Next')}</button></nav>
 <section class="photo-edit-metadata video-upload-metadata"><div class="photo-edit-date"><span class="photo-edit-date-label">${tr('תאריך צילום','Recording date')}</span><div class="photo-edit-date-fields">${[['day',tr('יום','Day'),1,31],['month',tr('חודש','Month'),1,12],['year',tr('שנה','Year'),1910,new Date().getFullYear()]].map(([part,label,min,max])=>`<label>${label}<input id="videoUploadDate${part}" type="number" inputmode="numeric" min="${min}" max="${max}" placeholder="—" data-video-draft-field></label>`).join('')}<button type="button" id="videoUploadCopyDate" class="photo-edit-copy-date" aria-label="${tr('העתקת התאריך מהסרטון הקודם','Copy date from previous video')}"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M7 2v4m10-4v4M3 9h18m-10 4-3 3 3 3m-3-3h5a3 3 0 0 1 3 3"/></svg></button></div></div><label class="photo-edit-caption"><span id="videoUploadCaptionLabel" class="photo-edit-caption-label">${tr('תיאור הסרטון','Video description')}</span><textarea id="videoUploadCaption" dir="auto" rows="2" maxlength="5000" placeholder="${tr('לחצו כאן להקלדת תיאור...','Tap here to enter a description...')}" data-video-draft-field></textarea></label></section>
 <div id="videoUploadViewport" class="photo-edit-viewport video-upload-viewport"><video id="videoUploadPlayer" controls playsinline preload="auto" aria-label="${tr('תצוגה מקדימה של הסרטון לפני ההעלאה','Video preview before upload')}"></video></div>
 <div class="photo-edit-toolbar video-upload-toolbar"><button type="button" class="secondary-button" id="videoUploadEdit"><span id="videoUploadEditIcon"></span><span id="videoUploadEditLabel">${tr('עריכת הסרטון','Edit video')}</span></button><button type="button" class="secondary-button" id="videoUploadReset"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10a8 8 0 1 1 1 8M4 4v6h6M12 8v4l3 2"/></svg><span>${tr('איפוס הקטע','Reset selection')}</span></button><button type="button" class="secondary-button" id="videoUploadSplit" aria-pressed="false" aria-controls="videoUploadSegments" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="m8.5 7.5 12 11M8.5 16.5 20.5 5"/></svg><span id="videoUploadSplitLabel"></span></button><span id="videoUploadRange" dir="auto"></span></div>
 <div id="videoUploadCheckPanel" class="video-preview-tools" hidden><span id="videoUploadCheckStatus" role="status"></span><button type="button" id="videoUploadCheckRetry" class="secondary-button" hidden>${tr('בדיקה חוזרת','Check again')}</button><button type="button" id="videoUploadCheckMinimize" class="video-preview-pick" hidden>${tr('המשך ברקע','Continue in background')}</button></div>
 <div id="videoUploadSourcePanel" class="video-preview-tools" hidden><span id="videoUploadSourceStatus" role="status"></span><progress id="videoUploadSourceProgress" max="100" value="0" aria-label="${tr('העלאת המקור לאתר','Original upload to site')}"></progress><button type="button" id="videoUploadSourcePlay" class="secondary-button" hidden>${tr('ניגון מהאתר','Play from site')}</button><button type="button" id="videoUploadSourceRetry" class="secondary-button" hidden>${tr('המשך העלאה','Resume upload')}</button><button type="button" id="videoUploadSourceMinimize" class="video-preview-pick" hidden>${tr('המשך ברקע','Continue in background')}</button></div>
 <div class="video-preview-tools"><button type="button" id="videoUploadPreviewPlay" class="secondary-button">${tr('▶ ניגון','▶ Play')}</button><button type="button" id="videoUploadPreviewMode" class="secondary-button" aria-pressed="false"></button><button type="button" id="videoUploadPreviewPick" class="video-preview-pick">${tr('בחירת עותק קל מהמכשיר','Choose a lightweight copy')}</button><input type="file" id="videoUploadPreviewFile" accept="video/*,.mp4,.m4v,.mov,.webm" hidden><progress id="videoUploadPreviewProgress" max="100" value="0" hidden aria-label="${tr('הכנת תצוגה קלה','Preparing lightweight preview')}"></progress><span id="videoUploadPreviewStatus" role="status" hidden></span></div>
 ${segmentControlsHTML(tr)}
 <div class="video-upload-details"><label><span id="videoUploadNameLabel"></span><input id="videoUploadName" maxlength="140" data-video-draft-field></label><label id="videoUploadTargetRow">${tr('תיקיית היעד','Destination folder')}<select id="videoUploadTarget" data-video-draft-field></select></label>
 <div id="videoUploadEventRow" hidden><label id="videoUploadEventLabel" for="videoUploadEventTrigger">${tr('שיוך לאירוע','Event assignment')}</label>
 <button type="button" id="videoUploadEventTrigger" aria-expanded="false" aria-controls="videoUploadEventChoices" aria-labelledby="videoUploadEventLabel videoUploadEventValue" data-video-draft-field><span id="videoUploadEventValue"></span></button>
 <div id="videoUploadEventChoices" hidden>
 <button type="button" id="videoUploadEventNew" aria-haspopup="dialog"><span aria-hidden="true">＋</span> <strong>${tr('הוספת אירוע חדש','Add a new event')}</strong></button>
 <button type="button" id="videoUploadEventLife">${tr('החיים עצמם','Life itself')}</button>
 <button type="button" id="videoUploadEventClear" hidden>${tr('ללא שיוך','Unassigned')}</button>
 </div></div></div>
 <details class="photo-edit-tags video-upload-people"><summary id="videoUploadTagsLabel"></summary><label>${tr('חיפוש או הוספת שם','Search or add a name')}<input type="search" id="videoUploadSearch" autocomplete="off" maxlength="120" data-video-draft-field></label><div id="videoUploadResults" class="video-upload-results"></div><div id="videoUploadPeopleTags" class="photo-edit-tag-chips"></div></details>
 <p id="videoUploadError" class="photo-edit-error" role="alert"></p><p id="videoUploadStatus" class="photo-edit-upload-status" role="status" aria-live="polite"></p><progress id="videoUploadProgress" max="100" value="0" hidden aria-label="${tr('התקדמות העלאת הסרטון','Video upload progress')}"></progress>
 <footer class="photo-edit-footer"><button type="button" id="videoUploadSaveCurrent" class="secondary-button"></button><button type="button" id="videoUploadSaveAll" class="primary-button"></button><button type="button" id="videoUploadRemove" class="photo-edit-remove">${tr('הסרת הסרטון מההעלאה','Remove video from upload')}</button><button type="button" id="videoUploadDone" class="secondary-button" hidden>${tr('סיום','Done')}</button></footer>`;
 document.body.append(dialog);
 preview=bindUploadPreview({get,tr,urls:URL,createProbe:()=>document.createElement('video'),
  canResume:()=>dialog.open&&!session?.saving&&!document.getElementById('videoClipEditor')?.open,
  onDuration:(file,duration)=>{
   const d=draft();if(d?.file!==file)return;
   d.duration=duration;if(session.original)session.original.duration=duration;
   if(session.split)timeline.show(session.drafts,session.index);
   locks();
  }});
 timeline=bindSegmentTimeline({get,tr,editor:window.FamilyVideoEditor,select:goTo,seekTo:preview.seek,playbackError:preview.playbackError,saving:()=>Boolean(session?.saving),
  changed:()=>{if(!session?.split)return;session.error=null;get('Error').textContent='';rangeText();locks();}});
 get('SourcePlay').addEventListener('click',()=>preview.playRemote());
 get('SourceRetry').addEventListener('click',()=>{const source=stageFor(session,draft().file);void source?.ensure().catch(()=>{});});
 get('SourceMinimize').addEventListener('click',minimize);
 get('CheckMinimize').addEventListener('click',minimize);
 get('CheckRetry').addEventListener('click',()=>{
  const d=draft();if(session.saving||d?.check?.phase!=='failed')return;
  session.checks.delete(d.check);d.check.discard();d.check=null;
  checkDraft(session,d);locks();
 });
 get('Split').addEventListener('click',toggleSplit);
 get('CutoffTime').addEventListener('input',locks);
 get('CutoffHere').addEventListener('click',()=>{
  get('CutoffTime').value=window.FamilyVideoEditor.clock(Math.round(get('Player').currentTime*100)/100);
  locks();
 });
 get('SaveThrough').addEventListener('click',()=>save(true,uploadCutoff()));
 get('Done').addEventListener('click',()=>{if(session?.split&&!session.saving&&session.drafts.every(d=>d.saved))finish();});
 background=document.createElement('button');background.id='videoUploadBackground';background.type='button';background.hidden=true;background.dir=I.isEnglish?'ltr':'rtl';background.dataset.i18nSkip='';background.setAttribute('aria-label',tr('פתיחת מצב העלאת הסרטונים','Open video upload status'));background.innerHTML=`<span id="videoUploadBackgroundStatus" role="status" aria-live="polite"></span><progress id="videoUploadBackgroundProgress" max="100" value="0" aria-label="${tr('התקדמות העלאת הסרטונים','Video upload progress')}"></progress>`;document.body.append(background);background.addEventListener('click',restore);
 get('Close').addEventListener('click',cancel);dialog.addEventListener('cancel',event=>{event.preventDefault();cancel();});dialog.addEventListener('close',()=>{swipe?.reset();updateBackground();});get('Previous').addEventListener('click',()=>navigate(-1));get('Next').addEventListener('click',()=>navigate(1));
 swipe=window.FamilyPhotoSwipe?.bind(get('Viewport'),{
  enabled:()=>Boolean(session&&dialog.open&&!session.saving&&(session.drafts.length>1||session.split)&&!(window.visualViewport?.scale>1)&&!document.getElementById('videoClipEditor')?.open),
  strictStart:true,
  videoSurface:()=>get('Player'),
  right:()=>{if(!get('Next').disabled)navigate(1);},left:()=>{if(!get('Previous').disabled)navigate(-1);}
 });
 get('CopyDate').addEventListener('click',()=>{collect();draft().metadata.date={...session.drafts[session.index-1].metadata.date};for(const part of ['day','month','year'])get('Date'+part).value=draft().metadata.date[part]||'';});
 get('Edit').addEventListener('click',async()=>{if(session.split){timeline.play();return;}collect();const d=draft(),owner=session;get('Player').pause();const selection=await window.FamilyVideoEditor.select(d.file,{previewUrl:preview.displayUrl(),previewFile:preview.displayFile(),scope:owner.options.scope,duration:d.duration,range:d.metadata.range,name:d.metadata.name});if(session!==owner||draft()!==d||!selection)return;d.metadata.range={start:selection.start,end:selection.end,...(selection.remove?{remove:true}:{})};d.metadata.name=selection.name;get('Name').value=selection.name;rangeText();});
 get('Reset').addEventListener('click',()=>{
  if(session.split){collect();const segment=draft().segment;Object.assign(segment,{start:0,end:null,startText:null,endText:null});render();timeline.seekStart();}
  else{draft().metadata.range=null;rangeText();}
 });get('SaveCurrent').addEventListener('click',()=>save(false));get('SaveAll').addEventListener('click',()=>save(true));
 get('Remove').addEventListener('click',()=>{if(session.saving)return;collect();const removed=draft();session.drafts.splice(session.index,1);
  if(!session.split&&!session.drafts.some(d=>d.file===removed.file)){removed.check?.discard();session.checks.delete(removed.check);session.sources.get(removed.file)?.discard();session.sources.delete(removed.file);}
  if(session.split&&!session.drafts.length){session.drafts=[session.original];session.split=false;session.index=session.segmentIndex=0;session.nextNumber=1;render();return;}
  if(!session.drafts.length||(!session.split&&session.drafts.every(d=>d.saved))){finish();return;}session.index=Math.min(session.index,session.drafts.length-1);render();});
 get('Target').addEventListener('change',()=>{
  const d=draft(),owner=session;
  if(window.FamilyVideoCategories?.createFromSelect(get('Target'),{previous:d.metadata.group||'family',onSelect:group=>{if(session===owner&&draft()===d&&!d.saved&&!d.frozen&&!owner.saving)d.metadata.group=group;}}))return;
  collect();
 });
 get('EventTrigger').addEventListener('click',()=>eventMenu(get('EventChoices').hidden));
 get('EventNew').addEventListener('click',()=>{
  const d=draft(),owner=session;
  eventMenu(false);
  get('EventTrigger').focus();
  get('Player').pause();
  window.FamilyNostalgia.createUploadEvent(d.metadata.eventId,event=>{
   if(session===owner&&draft()===d)assignEvent(event.id,event);
  });
 });
 get('EventLife').addEventListener('click',()=>assignEvent(window.FamilyNostalgia.directUploadId));
 get('EventClear').addEventListener('click',()=>assignEvent(''));
 const eventRow=get('EventRow');
 eventRow.addEventListener('focusout',event=>{if(event.relatedTarget&&!eventRow.contains(event.relatedTarget))eventMenu(false);});
 dialog.addEventListener('pointerdown',event=>{if(!get('EventChoices').hidden&&!eventRow.contains(event.target))eventMenu(false);});
 eventRow.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&!get('EventChoices').hidden){event.preventDefault();event.stopPropagation();eventMenu(false);get('EventTrigger').focus();}
  if(event.key==='ArrowDown'&&event.target===get('EventTrigger')){event.preventDefault();eventMenu(true);get('EventNew').focus();}
 });
 for(const part of ['day','month','year'])get('Date'+part).addEventListener('keydown',event=>{if(event.key===' '){event.preventDefault();get('Date'+({day:'month',month:'year',year:'year'}[part])).focus();}});
 get('Caption').addEventListener('keydown',event=>window.FamilyPhotoKeyboard?.saveDescription(event,()=>{collect();get('Caption').blur();}));
 dialog.addEventListener('keydown',event=>{if(event.key==='Control'&&!session.saving){event.preventDefault();navigate(event.shiftKey?-1:1);}event.stopPropagation();});
 get('Search').addEventListener('input',async()=>{const query=get('Search').value.trim(),serial=++searchSerial;if(!query){get('Results').replaceChildren();return;}const people=await window.FamilyTags.findPeople(query);if(!session||serial!==searchSerial||get('Search').value.trim()!==query||session.saving||draft().saved||draft().frozen)return;session.matches=people.slice(0,12);get('Results').innerHTML=session.matches.map((p,index)=>`<button type="button" data-video-add-person="${index}">${safe(I.personName(p))}</button>`).join('')+(people.length?'':`<button type="button" data-video-add-name>${tr('הוספת ','Add ')}${safe(query)}</button>`);});
 dialog.addEventListener('click',event=>{if(!session||session.saving||draft().saved||draft().frozen)return;const add=event.target.closest?.('[data-video-add-person],[data-video-add-name]'),remove=event.target.closest?.('[data-video-remove-person]');if(add){const p=add.hasAttribute('data-video-add-name')?{name:get('Search').value.trim()}:{personId:session.matches[Number(add.dataset.videoAddPerson)].id,label:I.personName(session.matches[Number(add.dataset.videoAddPerson)])};const d=draft();if(!d.metadata.people.some(v=>(v.personId||v.name)===(p.personId||p.name)))d.metadata.people.push(p);get('Search').value='';get('Results').replaceChildren();renderPeople();}if(remove){draft().metadata.people.splice(Number(remove.dataset.videoRemovePerson),1);renderPeople();}});
}
async function saveFromSource(d,owner,source,split){
 d.frozen ||= {operationId:uuid(),metadata:videoUploadMetadata(d.metadata)};
 const range=split?markedRange(d):d.frozen.metadata.range;
 const payload={mediaId:d.uploadId,operationId:d.frozen.operationId,metadata:{...d.frozen.metadata,...(range?{range}:{})}};
 get('Status').textContent=source.phase==='ready'?tr('שומר מהמקור שבאתר…','Saving from the uploaded original…'):tr('ממתין להשלמת העלאת המקור…','Waiting for the original upload…');
 await source.ensure();
 get('Status').textContent=range?tr('שומר את המקטע מהמקור…','Saving the segment from the original…'):tr('שומר את הסרטון…','Saving the video…');
 if(!d.derivedSource){
  try{return await source.save(payload);}
  catch(error){if(error.code!=='VIDEO_CLIP_FORMAT'||!range||range.remove)throw error;}
  const clip=await prepareSegmentFile({file:d.file,name:d.frozen.metadata.name,range,maxBytes:MAX_VIDEO_SOURCE_BYTES},fraction=>{
   get('Progress').value=fraction*100;get('Status').textContent=tr('מכין את המקטע…','Preparing the segment…')+' '+Math.round(fraction*100)+'%';
  });
  d.derivedSource=stageFor(owner,clip);
 }
 const {range:applied,...metadata}=payload.metadata;
 return d.derivedSource.save({...payload,metadata});
}
async function saveLocal(d,owner,split,maxMB){
   if(split&&!d.uploaded&&!d.preparedFile){
    const prepLabel=tr('מכין את ','Preparing ')+segmentLabel(d);
    get('Status').textContent=prepLabel+'…';
    try{
     d.preparedFile=await prepareSegmentFile({file:d.file,name:d.metadata.name,range:markedRange(d),maxBytes:maxMB*1024*1024},fraction=>{
      get('Status').textContent=prepLabel+' · '+Math.round(fraction*100)+'%';
     });
    }catch(error){
     throw Error(error.code==='SEGMENT_SIZE'?tr('המקטע גדול מ־','This segment exceeds ')+maxMB+tr(' MB. קצרו אותו ונסו שוב.',' MB. Shorten it and try again.'):
      tr('הדפדפן לא הצליח לחתוך את הסרטון בפורמט הזה. נסו גרסת MP4 רגילה.','This browser could not cut this recording. Try a standard MP4 version.'));
    }
   }
   const file=d.preparedFile||d.file;
   if(!d.uploaded){
    // An interrupted request may already have been committed. Retry the same
    // bytes, upload ID and destination until the server acknowledges the clip.
    if(split)d.frozen ||= {operationId:uuid(),metadata:videoUploadMetadata(d.metadata)};
    const destination={eventId:d.metadata.eventId||null,group:d.metadata.group||'family',uploadId:d.uploadId};
    get('Status').textContent=tr('מעלה ','Uploading ')+(split?segmentLabel(d):file.name)+'…';
    d.uploaded=await owner.options.upload(file,percent=>{
     owner.percent=percent;get('Progress').value=percent;
     get('Status').textContent=percent===100?tr('הסרטון התקבל, שומר את הפרטים…','Video received, saving details…'):tr('מעלה ','Uploading ')+percent+'%';
     updateBackground();
    },destination);
   }
   const item=d.uploaded.item||d.uploaded.collection?.items.find(v=>v.file===d.uploaded.file)||d.uploaded.person?.gallery?.find(v=>v.file===d.uploaded.file);
   if(!item?.id)throw Error(tr('לא התקבל אישור לסרטון שהועלה.','No video upload confirmation was received.'));
   d.frozen ||= {operationId:uuid(),metadata:videoUploadMetadata(d.metadata)};
   get('Status').textContent=tr('שומר את הסרטון והפרטים…','Saving the video and details…');
   const response=await I.fetch('api/media/'+item.id+(d.frozen.metadata.range?.remove?'/video-upload-remove':'/video-upload'),{
    method:'POST',headers:{'Content-Type':'application/json','X-Family-Token':window.FAMILY_API_TOKEN},body:JSON.stringify(d.frozen)
   });
   let result;try{result=await response.json();}catch{throw Error(tr('לא התקבל אישור שמירה. נסו שוב.','No save confirmation was received. Please retry.'));}
   if(!response.ok)throw Object.assign(Error(I.error(result.error)),{status:response.status});
 return result;
}
async function save(all,cutoff){
 if(!session||session.saving)return;
 collect();
 const owner=session,split=owner.split,maxMB=owner.options.scope==='nostalgia'?500:90;
 const pending=d=>!d.saved&&(!split||markedBy(d,cutoff));
 const indices=all?owner.drafts.map((_,i)=>i).filter(i=>pending(owner.drafts[i])):pending(draft())?[owner.index]:[];
 if(!indices.length)return;
 const startingIndex=owner.index;
 let activeIndex=startingIndex;
 try{
  for(const index of indices){
   activeIndex=index;
   const d=owner.drafts[index];
   videoUploadMetadata(d.frozen?.metadata||d.metadata);
   if(!owner.options.stageSources&&!split&&d.file.size>maxMB*1024*1024)throw Error(tr('הסרטון גדול מהמגבלה: ','Video exceeds the limit: ')+maxMB+'MB');
  }
  get('Player').pause();
  for(const index of indices){
   activeIndex=index;owner.index=index;owner.percent=0;owner.error=null;render();
   const d=draft();busy(true);get('Progress').value=0;
   if(d.check.phase!=='ready'){
    await d.check.ready;
    if(d.check.phase!=='ready')throw Error(checkMessage(d.check));
   }
   const source=stageFor(owner,d.file);
   const result=source?await saveFromSource(d,owner,source,split):await saveLocal(d,owner,split,maxMB);
   d.saved=true;d.preparedFile=null;owner.options.onSaved?.(result);window.dispatchEvent(new CustomEvent('family-media-changed',{detail:result}));busy(false);
  }
  if(split){
   owner.index=startingIndex;render();
   if(all)get('Status').textContent=indices.length===1?tr('מקטע אחד הועלה ✓','One segment uploaded ✓'):tr('הועלו ','Uploaded ')+indices.length+tr(' מקטעים ✓',' segments ✓');
   return;
  }
  if(owner.drafts.every(d=>d.saved)){window.FamilyApp?.toast(tr('הסרטונים נשמרו ✓','Videos saved ✓'));finish();return;}
  owner.index=owner.drafts.findIndex((d,i)=>!d.saved&&i>owner.index);if(owner.index<0)owner.index=owner.drafts.findIndex(d=>!d.saved);render();
 }catch(error){
  owner.index=activeIndex;const d=draft();
  if(error.status>=400&&error.status<500&&error.status!==409){d.frozen=null;if(!d.uploaded)d.preparedFile=null;if(d.derivedSource){d.derivedSource.discard();owner.sources.delete(d.derivedSource.file);d.derivedSource=null;}}
  render();owner.error=error.name==='RangeError'?tr('בדקו את תאריך הצילום, השם או הקטע שסומן.','Check the recording date, name or selected range.'):error.message||tr('הסרטון לא נשמר. נסו שוב.','The video was not saved. Please retry.');
  get('Error').textContent=owner.error;
 }finally{if(session===owner)busy(false);}
}
async function next(){if(session||!queue.length)return;mount();get('CutoffTime').value='';get('BatchOptions').open=false;const job=queue.shift(),videos=job.files.filter(isVideo);session={...job,sources:new Map(),checks:new Set(),index:0,saving:false,matches:[],singleVideo:videos.length===1,split:false,segments:[],segmentIndex:0,nextNumber:1,drafts:videos.map(file=>{const metadata={name:file.name.replace(/\.[^.]*$/,'').slice(0,140),caption:'',date:filenamePhotoDate(file.name).date,people:[]};if(job.options.scope==='nostalgia'){metadata.eventId=job.options.eventId||'';const event=destinations().find(e=>e.id===metadata.eventId);if(event?.date&&!Object.values(metadata.date).some(Boolean))metadata.date={...event.date};}if(job.options.scope==='videos')metadata.group=job.options.group||'family';return {file,metadata,uploadId:uuid(),uploaded:null,saved:false,duration:null,frozen:null};}),rest:job.files.filter(file=>!isVideo(file))};render();dialog.showModal();}
function prepare(files,options){const list=Array.from(files);if(!list.some(isVideo))return Promise.resolve(list);return new Promise(resolve=>{queue.push({files:list,options,resolve});void next();});}
window.FamilyVideoUpload={prepare,isVideo,metadata:videoUploadMetadata};
window.addEventListener('beforeunload',event=>{if(session||queue.length){event.preventDefault();event.returnValue='';}});
