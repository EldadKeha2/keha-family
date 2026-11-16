import {familyOptions,familyLabel} from './gallery-family.mjs?v=2';
import {photoLabelOptions,photoLabelName,loadPhotoLabelCatalog} from './photo-labels-catalog.mjs?v=2';
const I=window.FamilyI18n,$=id=>document.getElementById(id),tr=(he,en)=>I.isEnglish?en:he;
const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normalize=value=>String(value||'').normalize('NFKD').replace(/[\u0591-\u05c7'"׳״]/g,'').toLowerCase();
const state={open:false,people:new Set(),families:new Set(),labels:new Set(),resultsReady:false};
let roster=[],ready=false;
function status(message='',error=false){const host=$('gallerySelectionStatus');if(!host)return;host.textContent=message;host.hidden=!message;host.classList.toggle('is-error',error);}
function clearSelection(){window.FamilyMediaSelection?.clearScope('gallery');status();render();}
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
  const query=normalize($('galleryPersonSearch').value),people=roster.filter(p=>state.people.has(p.id)||!query||normalize(I.searchNames(p)).includes(query)).map(p=>({id:p.id,label:I.personName(p)})).sort((a,b)=>a.label.localeCompare(b.label,I.locale));
  checkboxes($('galleryPersonFilter'),people,state.people,'person');
}
function apply(){clearSelection();window.FamilyPortal.refineGallery(criteria());}
function fillLabels(){checkboxes($('galleryLabelFilter'),photoLabelOptions([...state.labels]).map(label=>({id:label.id,label:photoLabelName(label,I.isEnglish)})),state.labels,'label');}
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
  for(const id of ['gallerySelectionTop','gallerySelectionBottom'])$(id).hidden=true;
  window.FamilyMediaSelection?.refresh();
}
function previewFiltered(id){
  if(!state.open||!state.resultsReady)return;
  const collection=window.FamilyPortal.getCollection('gallery');
  if(!collection.items.some(item=>item.id===id))return;
  // Register the matching page and its filter context before opening. Paging
  // continues through the same server-side filters instead of a stale album.
  window.FamilyMedia.register('gallery',collection.items,{pagination:collection.pagination});
  window.FamilyMedia.openFrom('gallery',id);
}
function init(){
  if(!$('galleryFilterToggle'))return;
  const filterButton=$('galleryFilterToggle'),filterHome=filterButton.parentElement,mobileDock=$('galleryMobileFilterDock');
  if(filterHome&&mobileDock&&window.matchMedia){
    const mobile=window.matchMedia('(max-width:700px)');
    const placeFilter=()=>{(mobile.matches?mobileDock:filterHome).append(filterButton);};
    placeFilter();mobile.addEventListener('change',placeFilter);
  }
  roster=window.FamilyPeopleRoster.snapshot().filter(p=>!p.placeholder);ready=true;fillFamilies();fillPeople();fillLabels();$('galleryLabelSummary').textContent=tr('תגיות','Labels');render();
  $('galleryFilterToggle').addEventListener('click',async()=>{
    if(state.open){reset();window.FamilyPortal.refineGallery({person:'',unit:'',labels:''});return;}
    state.open=true;fillPeople();render();
    loadPhotoLabelCatalog().then(fillLabels);
    try{await window.FamilyPeopleRoster.load();}catch{}
  });
  window.FamilyPeopleRoster.subscribe(people=>{roster=people.filter(person=>!person.placeholder);if(ready&&state.open)fillPeople();});
  $('galleryPersonSearch').addEventListener('input',fillPeople);
  window.addEventListener('family-photo-label-catalog',()=>{if(ready)fillLabels();});
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
    if(state.open&&!event.target.closest('#galleryFilterPanel .gallery-filter-field')){
      for(const field of $('galleryFilterPanel').querySelectorAll('details[open]'))field.open=false;
    }
    const preview=event.target.closest('[data-gallery-preview]');if(preview)previewFiltered(preview.dataset.galleryPreview);
  });
  window.addEventListener('family-media-changed',event=>{if(event.detail?.operation==='delete'&&event.detail.scope==='gallery'){render();}});
}
window.FamilyGalleryFilter={render,reset,category,clearSelection};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
