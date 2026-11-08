import {photoDate,photoAge,photoDateText} from './photo-date.mjs?v=1';
const I=window.FamilyI18n,$=id=>document.getElementById(id),tr=(he,en)=>I.isEnglish?en:he;
const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const calendar='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18M7 15h2m3 0h2m3 0h.01M7 18h2m3 0h2"/></svg>';
const ages='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="7" r="3"/><path d="M2 20v-3a6 6 0 0 1 9-5"/><circle cx="16.5" cy="16.5" r="5.5"/><path d="M16.5 13v3.5l2 1"/></svg>';
let item=null,showAges=false,editing=null,saving=false;

function decorate(host,photo,people){
  const enabled=item?.id===photo?.id&&showAges&&Boolean(item.takenDate?.year);
  for(const button of host.querySelectorAll('[data-remove-person-tag]')){
    button.dataset.photoAgeLabel??=button.getAttribute('aria-label')||'';
    button.setAttribute('aria-label',button.dataset.photoAgeLabel);
    button.querySelector('.photo-person-age')?.remove();
    if(!enabled)continue;
    const person=people.find(person=>person.id===button.dataset.removePersonTag);
    const birthday=person?.birthday??item.tags?.find(tag=>tag.id===person?.id)?.birthday??window.FamilyApp?.getPerson?.(person?.id)?.birthday;
    const age=photoAge(birthday,item.takenDate),badge=document.createElement('small');badge.className='photo-person-age';
    const value=age?(age.years===0?tr('פחות משנה','Under 1'):String(age.years)):'—';
    badge.textContent=' · '+(age?.approximate?'≈ ':'')+value;
    badge.title=age?tr('גיל בזמן הצילום: ','Age in this photo: ')+(age.approximate?tr('לפחות ','At least '):'')+value:tr('אי אפשר לחשב גיל לפי תאריכי הצילום והלידה הידועים','Age cannot be calculated from the known photo and birth dates');
    button.setAttribute('aria-label',button.dataset.photoAgeLabel+' · '+badge.title);
    button.insertBefore(badge,button.querySelector('span[aria-hidden]'));
  }
}
function refreshAges(){
  const widget=$('mediaTagPanel')?._tagWidget;
  if(widget)decorate(widget.selectedHost,widget.store.item,[...widget.store.selected().values()]);
}
function render(){
  const host=$('photoMomentTools');if(!host)return;
  host.hidden=!item?.id||item.kind!=='photo';if(host.hidden){host.replaceChildren();return;}
  const known=Boolean(item.takenDate?.year),date=photoDateText(item.takenDate,I.locale);
  const dateLabel=tr('תאריך צילום','Photo date'),ageLabel=showAges&&known?tr('הסתרת גילים','Hide ages'):tr('הצגת גילים','Show ages');
  const ageHelp=known?ageLabel:tr('יש להזין שנת צילום כדי להציג גילים','Add the year the photo was taken to show ages');
  const focused=document.activeElement?.id;
  host.innerHTML=`<button id="editPhotoDate" class="photo-moment-button${date?' has-date':''}" type="button" aria-haspopup="dialog" aria-controls="photoDateDialog" aria-label="${dateLabel}${date?': '+safe(date):''}" title="${dateLabel}${date?': '+safe(date):''}" ${window.FamilyApp?.apiEnabled?'':'disabled'}>${calendar}<span class="photo-moment-label">${dateLabel}</span></button>${date?`<time class="photo-taken-date">${safe(date)}</time>`:''}<button id="togglePhotoAges" class="photo-moment-button photo-age-toggle" type="button" aria-pressed="${showAges&&known}" aria-label="${ageHelp}" title="${ageHelp}" ${known?'':'disabled'}>${ages}<span class="photo-moment-label">${ageLabel}</span></button>`;
  if(focused==='editPhotoDate'||focused==='togglePhotoAges')$(focused)?.focus({preventScroll:true});
  refreshAges();
}
function mount(photo){
  if(item?.id!==photo.id)showAges=false;
  item=photo;if(!item.takenDate?.year)showAges=false;render();
}
function openDate(){
  if(!item?.id||item.kind!=='photo'||saving||!window.FamilyApp?.apiEnabled)return;
  editing={id:item.id,revision:item.takenDateRevision||'empty'};
  const date=photoDate(item.takenDate);
  for(const field of ['day','month','year'])$('photoDate'+field).value=date[field]??'';
  $('photoDateError').textContent='';$('photoDateDialog').showModal();$('photoDateday').focus();
}
async function saveDate(event){
  event.preventDefault();if(!editing||saving)return;
  let date;
  try{date=photoDate(Object.fromEntries(['day','month','year'].map(field=>[field,$('photoDate'+field).value===''?null:Number($('photoDate'+field).value)])));}
  catch{$('photoDateError').textContent=tr('התאריך אינו תקין. אפשר להשאיר שדות לא ידועים ריקים.','Invalid date. Leave unknown fields blank.');return;}
  const target={...editing};saving=true;$('photoDateError').textContent='';
  $('photoDateForm').querySelectorAll('button,input').forEach(control=>{control.disabled=true;});
  try{
    const response=await I.fetch('api/media/'+target.id+'/photo-date',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json','X-Family-Token':window.FAMILY_API_TOKEN},body:JSON.stringify({date,expectedRevision:target.revision})});
    let result;try{result=await response.json();}catch{throw Error(tr('תאריך הצילום לא נשמר. נסו שוב.','The photo date was not saved. Please try again.'));}
    if(!response.ok){
      if(response.status===409){
        const latest=await I.fetch('api/media/'+target.id+'/view',{cache:'no-store'});
        if(latest.ok)window.dispatchEvent(new CustomEvent('family-media-changed',{detail:{operation:'photo-date',...(await latest.json())}}));
        throw Error(tr('התאריך עודכן בינתיים. סגרו ופתחו את העריכה מחדש.','The photo date changed. Close and reopen the editor.'));
      }
      throw Error(I.error(result.error)||tr('תאריך הצילום לא נשמר. נסו שוב.','The photo date was not saved. Please try again.'));
    }
    window.dispatchEvent(new CustomEvent('family-media-changed',{detail:result}));
    $('photoDateDialog').close();window.FamilyApp?.toast(tr('תאריך הצילום נשמר ✓','Photo date saved ✓'));
  }catch(error){$('photoDateError').textContent=error.message;}
  finally{saving=false;$('photoDateForm').querySelectorAll('button,input').forEach(control=>{control.disabled=false;});}
}
function init(){
  const viewer=$('mediaViewer');if(!viewer)return;
  const dialog=document.createElement('dialog');dialog.id='photoDateDialog';dialog.className='portal-dialog photo-date-dialog';dialog.setAttribute('aria-labelledby','photoDateTitle');dialog.setAttribute('data-i18n-skip','');
  dialog.innerHTML=`<h2 id="photoDateTitle">${tr('מתי התמונה צולמה?','When was this photo taken?')}</h2><p id="photoDateHint">${tr('מזינים רק מה שידוע. אפשר לשמור יום, חודש או שנה בנפרד.','Enter what you know. Day, month and year are all optional.')}</p><form id="photoDateForm" aria-describedby="photoDateHint"><div class="photo-date-fields">${[['day',tr('יום','Day'),1,31],['month',tr('חודש','Month'),1,12],['year',tr('שנה','Year'),1000,9999]].map(([field,label,min,max])=>`<label for="photoDate${field}">${label}<input id="photoDate${field}" name="${field}" type="number" inputmode="numeric" min="${min}" max="${max}" step="1" placeholder="—" autocomplete="off"></label>`).join('')}</div><p id="photoDateError" class="form-error" role="alert"></p><div class="photo-date-actions"><button type="submit" class="primary-button">${tr('שמירה','Save')}</button><button id="cancelPhotoDate" type="button" class="secondary-button">${tr('ביטול','Cancel')}</button><button id="clearPhotoDate" type="button">${tr('ניקוי התאריך','Clear date')}</button></div></form>`;
  document.body.append(dialog);
  $('photoMomentTools').addEventListener('click',event=>{
    if(event.target.closest('#editPhotoDate'))openDate();
    else if(event.target.closest('#togglePhotoAges')&&item?.takenDate?.year){showAges=!showAges;render();}
  });
  $('photoDateForm').addEventListener('submit',saveDate);
  $('cancelPhotoDate').addEventListener('click',()=>dialog.close());
  $('clearPhotoDate').addEventListener('click',()=>{for(const field of ['day','month','year'])$('photoDate'+field).value='';$('photoDateError').textContent='';$('photoDateday').focus();});
  dialog.addEventListener('cancel',event=>{if(saving)event.preventDefault();});
  dialog.addEventListener('close',()=>{editing=null;});
  viewer.addEventListener('close',()=>{item=null;showAges=false;if(dialog.open&&!saving)dialog.close();});
  window.addEventListener('family-media-changed',event=>{const photo=event.detail.item;if(photo?.id===item?.id){item={...item,...photo};if(!item.takenDate?.year)showAges=false;render();}});
  if(viewer.open&&window.FamilyMedia?.current?.())mount(window.FamilyMedia.current());
}
window.FamilyPhotoDate={mount,decorate};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
