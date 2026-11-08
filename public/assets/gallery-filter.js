import {familyOptions,familyLabel} from './gallery-family.mjs?v=2';
import {PHOTO_LABELS,photoLabelName} from './photo-labels-catalog.mjs?v=1';
const I=window.FamilyI18n,$=id=>document.getElementById(id),tr=(he,en)=>I.isEnglish?en:he;
const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normalize=value=>String(value||'').normalize('NFKD').replace(/[\u0591-\u05c7'"׳״]/g,'').toLowerCase();
const state={open:false,people:new Set(),families:new Set(),labels:new Set(),selected:new Set(),version:0,busy:false,resultsReady:false};
const downloadIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/></svg>';
const previewIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
let roster=[],ready=false;
function status(message='',error=false){const host=$('gallerySelectionStatus');if(!host)return;host.textContent=message;host.hidden=!message;host.classList.toggle('is-error',error);}
function clearSelection(){state.selected.clear();state.version++;state.busy=false;status();render();}
function criteria(){return {person:[...state.people].sort().join(','),unit:[...state.families].sort().join(','),labels:[...state.labels].sort().join(',')};}
function checkboxes(host,items,selected,kind){
  host.innerHTML=items.map(item=>'<label class="gallery-check-option"><input type="checkbox" data-gallery-'+kind+'="'+safe(item.id)+'"'+(selected.has(item.id)?' checked':'')+'><span>'+safe(item.label)+'</span></label>').join('')||'<p class="gallery-filter-empty">'+tr('לא נמצאו התאמות','No matches found')+'</p>';
}
function fillFamilies(){
  const data=window.FAMILY_DATA;
  for(const generation of [2,3,4]){
    const items=familyOptions(data,generation).map(u=>({id:u.id,label:familyLabel(data,u,p=>I.personName(p),I.isEnglish)}));
    items.sort((a,b)=>a.label.localeCompare(b.label,I.locale));
    checkboxes($('galleryFamily'+generation),items,state.families,'family');
  }
}
function fillPeople(){
  const query=normalize($('galleryPersonSearch').value),people=roster.filter(p=>state.people.has(p.id)||!query||normalize(p.name+' '+(p.nameEn||'')).includes(query)).map(p=>({id:p.id,label:I.personName(p)})).sort((a,b)=>a.label.localeCompare(b.label,I.locale));
  checkboxes($('galleryPersonFilter'),people,state.people,'person');
}
function apply(){clearSelection();window.FamilyPortal.refineGallery(criteria());}
function fillLabels(){checkboxes($('galleryLabelFilter'),PHOTO_LABELS.map(label=>({id:label.id,label:photoLabelName(label,I.isEnglish)})),state.labels,'label');}
function clearCriteria(){state.people.clear();state.families.clear();state.labels.clear();if(ready){$('galleryPersonSearch').value='';fillPeople();fillFamilies();fillLabels();}}
function reset(){state.open=false;for(const id of ['galleryPeopleChoices','galleryFamily2Choices','galleryFamily3Choices','galleryFamily4Choices','galleryLabelChoices'])$(id).open=false;clearCriteria();clearSelection();}
function category(filter){if(filter!=='all')reset();render();}
function render(){
  if(!ready)return;
  const all=window.FamilyPortal.galleryQuery().filter==='all',open=all&&state.open,toggle=$('galleryFilterToggle');
  const collection=window.FamilyPortal.getCollection('gallery'),q=window.FamilyPortal.galleryQuery(),p=collection.pagination;
  state.resultsReady=Boolean(p&&(p.person||'')===q.person&&(p.unit||'')===q.unit&&(p.labels||'')===(q.labels||'')&&(p.query||'')===q.query.trim());
  toggle.hidden=!all;toggle.setAttribute('aria-expanded',String(open));$('galleryFilterPanel').hidden=!open;
  $('clearGalleryFilter').hidden=!(state.people.size||state.families.size||state.labels.size);
  $('galleryPeopleChoiceCount').textContent=state.people.size?'('+state.people.size+')':'';
  $('galleryLabelChoiceCount').textContent=state.labels.size?'('+state.labels.size+')':'';
  for(const generation of [2,3,4]){
    const count=[...state.families].filter(id=>window.FAMILY_DATA.units[id]?.generation===generation).length;
    $('galleryFamily'+generation+'ChoiceCount').textContent=count?'('+count+')':'';
  }
  for(const id of ['gallerySelectionTop','gallerySelectionBottom']){
    const bar=$(id);bar.hidden=!open;
    bar.querySelector('[data-gallery-selected-count]').textContent=tr('נבחרו ','Selected: ')+state.selected.size;
    bar.querySelector('[data-gallery-download]').disabled=!state.selected.size||state.busy;
    bar.querySelector('[data-gallery-select-all]').disabled=state.busy||!state.resultsReady||!collection.count;
    bar.querySelector('[data-gallery-clear-selection]').disabled=!state.selected.size||state.busy;
  }
  const items=new Map(collection.items.map(item=>[item.id,item]));
  for(const button of $('sharedGalleryGrid').querySelectorAll('[data-media-open][data-media-scope="gallery"]')){
    const id=button.dataset.mediaOpen,item=items.get(id);if(!item)continue;
    button.classList.toggle('gallery-selectable',open);
    if(open){button.setAttribute('aria-pressed',String(state.selected.has(id)));button.setAttribute('aria-disabled',String(!state.resultsReady||state.busy));button.setAttribute('aria-label',tr('בחירת תמונה: ','Select photo: ')+(item.caption||item.name));}
    else{button.removeAttribute('aria-pressed');button.removeAttribute('aria-disabled');button.setAttribute('aria-label',tr('פתיחת התמונה ','Open photo ')+(item.caption||item.name));}
    const card=button.closest('.compact-gallery-card');let preview=card.querySelector('[data-gallery-preview]');
    if(!open){preview?.remove();continue;}
    if(!preview){preview=document.createElement('button');preview.type='button';preview.className='gallery-selection-preview';preview.dataset.galleryPreview=id;preview.innerHTML=previewIcon;preview.setAttribute('aria-label',tr('פתיחת התמונה ללא שינוי הבחירה','Open photo without changing selection'));card.append(preview);}
  }
}
async function selectAll(){
  if(state.busy)return;state.busy=true;const version=++state.version;status(tr('בוחרים את כל תוצאות הסינון…','Selecting all matching photos…'));render();
  try{
    const q=window.FamilyPortal.galleryQuery(),response=await I.fetch('api/gallery/selection?'+new URLSearchParams({q:q.query,person:q.person,unit:q.unit,labels:q.labels||''}),{cache:'no-store'}),result=await response.json();
    if(!response.ok)throw Error(I.error(result.error));if(version!==state.version)return;
    state.selected=new Set(result.ids);status();
  }catch(error){if(version===state.version)status(error.message,true);}
  finally{if(version===state.version){state.busy=false;render();}}
}
function download(){
  if(!state.selected.size||state.busy)return;
  let frame=$('galleryZipFrame');if(!frame){frame=document.createElement('iframe');frame.id='galleryZipFrame';frame.name='galleryZipFrame';frame.hidden=true;frame.title=tr('הורדת התמונות שנבחרו','Selected photo download');document.body.append(frame);
    frame.addEventListener('load',()=>{try{const message=JSON.parse(frame.contentDocument.body.textContent);if(message.error)status(I.error(message.error),true);}catch{}});
  }
  const form=document.createElement('form');form.method='POST';form.action='api/gallery/download';form.target=frame.name;form.hidden=true;
  for(const [name,value]of Object.entries({ids:JSON.stringify([...state.selected]),token:window.FAMILY_API_TOKEN})){const input=document.createElement('input');input.type='hidden';input.name=name;input.value=value;form.append(input);}
  document.body.append(form);form.submit();form.remove();const message=tr('הורדת קובץ ה־ZIP החלה.','Your ZIP download has started.');status(message);window.FamilyApp?.toast(message);
}
function init(){
  if(!$('galleryFilterToggle'))return;
  const filterButton=$('galleryFilterToggle'),filterHome=filterButton.parentElement,mobileDock=$('galleryMobileFilterDock');
  if(filterHome&&mobileDock&&window.matchMedia){
    const mobile=window.matchMedia('(max-width:700px)');
    const placeFilter=()=>{(mobile.matches?mobileDock:filterHome).append(filterButton);};
    placeFilter();mobile.addEventListener('change',placeFilter);
  }
  const barHTML='<button type="button" data-gallery-select-all>'+tr('בחר הכל','Select all')+'</button><button type="button" data-gallery-clear-selection>'+tr('ביטול הבחירה','Clear selection')+'</button><span class="gallery-selection-count" data-gallery-selected-count></span><button type="button" class="gallery-download-selected" data-gallery-download>'+downloadIcon+'<span>'+tr('הורדת הנבחרות','Download selected')+'</span></button>';
  for(const id of ['gallerySelectionTop','gallerySelectionBottom'])$(id).innerHTML=barHTML;
  $('gallerySelectionTop').querySelector('[data-gallery-selected-count]').setAttribute('aria-live','polite');
  roster=Object.values(window.FAMILY_DATA.people).filter(p=>!p.placeholder);ready=true;fillFamilies();fillPeople();fillLabels();$('galleryLabelSummary').textContent=tr('תגיות','Labels');render();
  $('galleryFilterToggle').addEventListener('click',async()=>{
    if(state.open){reset();window.FamilyPortal.refineGallery({person:'',unit:'',labels:''});return;}
    state.open=true;render();
    try{const response=await I.fetch('api/tag-people',{cache:'no-store'});if(response.ok){const result=await response.json();roster=result.people;fillPeople();}}catch{}
  });
  $('galleryPersonSearch').addEventListener('input',fillPeople);
  $('galleryFilterPanel').addEventListener('change',event=>{
    const input=event.target;
    const person=input.dataset.galleryPerson,family=input.dataset.galleryFamily,label=input.dataset.galleryLabel;
    if(!person&&!family&&!label)return;
    const selected=person?state.people:family?state.families:state.labels,id=person||family||label;
    if(input.checked)selected.add(id);else selected.delete(id);
    apply();
  });
  $('clearGalleryFilter').addEventListener('click',()=>{clearCriteria();apply();});
  document.addEventListener('click',event=>{
    if(event.target.closest('[data-gallery-select-all]'))selectAll();
    else if(event.target.closest('[data-gallery-clear-selection]'))clearSelection();
    else if(event.target.closest('[data-gallery-download]'))download();
    else{const preview=event.target.closest('[data-gallery-preview]');if(preview)window.FamilyMedia.openFrom('gallery',preview.dataset.galleryPreview);}
  });
  document.addEventListener('click',event=>{
    if(!state.open||window.FamilyPortal.galleryQuery().filter!=='all')return;
    const photo=event.target.closest('#sharedGalleryGrid [data-media-open][data-media-scope="gallery"]');if(!photo)return;
    event.preventDefault();event.stopImmediatePropagation();if(state.busy||!state.resultsReady)return;
    const id=photo.dataset.mediaOpen;if(state.selected.has(id))state.selected.delete(id);else state.selected.add(id);status();render();
  },true);
  window.addEventListener('family-media-changed',event=>{if(event.detail?.operation==='delete'&&event.detail.scope==='gallery'){state.selected.delete(event.detail.item.id);render();}});
}
window.FamilyGalleryFilter={render,reset,category,clearSelection};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
