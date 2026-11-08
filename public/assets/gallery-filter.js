import {familyOptions} from './gallery-family.mjs';
const I=window.FamilyI18n,$=id=>document.getElementById(id),tr=(he,en)=>I.isEnglish?en:he;
const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normalize=value=>String(value||'').normalize('NFKD').replace(/[\u0591-\u05c7'"׳״]/g,'').toLowerCase();
const state={open:false,person:'',family2:'',family3:'',family4:'',selected:new Set(),version:0,busy:false,resultsReady:false};
const downloadIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/></svg>';
const previewIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
let roster=[],ready=false;
function status(message='',error=false){const host=$('gallerySelectionStatus');if(!host)return;host.textContent=message;host.hidden=!message;host.classList.toggle('is-error',error);}
function clearSelection(){state.selected.clear();state.version++;state.busy=false;status();render();}
function unit(){return state.family4||state.family3||state.family2;}
function options(select,items,value,empty){select.innerHTML='<option value="">'+safe(empty)+'</option>'+items.map(item=>'<option value="'+safe(item.id)+'">'+safe(item.label)+'</option>').join('');select.value=value;}
function fillFamilies(){
  const data=window.FAMILY_DATA,name=id=>I.personName(data.people[id]);
  for(const generation of [2,3,4]){
    const parent=generation===3?state.family2:generation===4?state.family3||state.family2:'';
    const items=familyOptions(data,generation,parent).map(u=>({id:u.id,label:generation===2?I.branchName(data.branches.find(b=>b.unit===u.id)):tr('המשפחה של ','Family of ')+u.people.map(name).join(tr(' ו',' & '))}));
    if(generation!==2)items.sort((a,b)=>a.label.localeCompare(b.label,I.locale));
    options($('galleryFamily'+generation),items,state['family'+generation],tr('כל המשפחות','All families'));
  }
}
function fillPeople(){
  const query=normalize($('galleryPersonSearch').value),people=roster.filter(p=>p.id===state.person||!query||normalize(p.name+' '+(p.nameEn||'')).includes(query)).map(p=>({id:p.id,label:I.personName(p)})).sort((a,b)=>a.label.localeCompare(b.label,I.locale));
  options($('galleryPersonFilter'),people,state.person,tr('כל האנשים','Everyone'));
}
function ancestors(id){const data=window.FAMILY_DATA,seen=new Set();while(id&&!seen.has(id)){seen.add(id);const u=data.units[id];if(!u)break;if([2,3,4].includes(u.generation))state['family'+u.generation]=u.id;id=u.parent;}}
function apply(){clearSelection();fillFamilies();window.FamilyPortal.refineGallery({person:state.person,unit:unit()});}
function reset(){state.open=false;state.person=state.family2=state.family3=state.family4='';if(ready){$('galleryPersonSearch').value='';fillPeople();fillFamilies();}clearSelection();}
function category(filter){if(filter!=='all')reset();render();}
function render(){
  if(!ready)return;
  const all=window.FamilyPortal.galleryQuery().filter==='all',open=all&&state.open,toggle=$('galleryFilterToggle');
  const collection=window.FamilyPortal.getCollection('gallery'),q=window.FamilyPortal.galleryQuery(),p=collection.pagination;
  state.resultsReady=Boolean(p&&(p.person||'')===q.person&&(p.unit||'')===q.unit&&(p.query||'')===q.query.trim());
  toggle.hidden=!all;toggle.setAttribute('aria-expanded',String(open));$('galleryFilterPanel').hidden=!open;
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
    const q=window.FamilyPortal.galleryQuery(),response=await I.fetch('api/gallery/selection?'+new URLSearchParams({q:q.query,person:q.person,unit:q.unit}),{cache:'no-store'}),result=await response.json();
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
  const barHTML='<button type="button" data-gallery-select-all>'+tr('בחר הכל','Select all')+'</button><button type="button" data-gallery-clear-selection>'+tr('ביטול הבחירה','Clear selection')+'</button><span class="gallery-selection-count" data-gallery-selected-count></span><button type="button" class="gallery-download-selected" data-gallery-download>'+downloadIcon+'<span>'+tr('הורדת הנבחרות','Download selected')+'</span></button>';
  for(const id of ['gallerySelectionTop','gallerySelectionBottom'])$(id).innerHTML=barHTML;
  $('gallerySelectionTop').querySelector('[data-gallery-selected-count]').setAttribute('aria-live','polite');
  roster=Object.values(window.FAMILY_DATA.people).filter(p=>!p.placeholder);ready=true;fillFamilies();fillPeople();render();
  $('galleryFilterToggle').addEventListener('click',async()=>{
    if(state.open){reset();window.FamilyPortal.refineGallery({person:'',unit:''});return;}
    state.open=true;render();
    try{const response=await I.fetch('api/tag-people',{cache:'no-store'});if(response.ok){const result=await response.json();roster=result.people;fillPeople();}}catch{}
  });
  $('galleryPersonSearch').addEventListener('input',fillPeople);
  $('galleryPersonFilter').addEventListener('change',()=>{state.person=$('galleryPersonFilter').value;apply();});
  for(const generation of [2,3,4])$('galleryFamily'+generation).addEventListener('change',()=>{
    state['family'+generation]=$('galleryFamily'+generation).value;
    for(let next=generation+1;next<=4;next++)state['family'+next]='';
    if(state['family'+generation])ancestors(state['family'+generation]);apply();
  });
  $('clearGalleryFilter').addEventListener('click',()=>{state.person=state.family2=state.family3=state.family4='';$('galleryPersonSearch').value='';fillPeople();apply();});
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
