import {PHOTO_LABELS,photoLabels,photoLabelName} from './photo-labels-catalog.mjs?v=1';
const I=window.FamilyI18n,$=id=>document.getElementById(id),tr=(he,en)=>I.isEnglish?en:he;
const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3h8l10 10-8 8L3 11Z"/><circle cx="7.5" cy="7.5" r="1.3"/></svg>';
const stores=new Map();let item=null,open=false,fitFrame;
function store(photo){
  let entry=stores.get(photo.id);
  if(!entry){entry={id:photo.id,saved:photoLabels(photo.labels),queue:[],active:null,error:'',running:false};stores.set(photo.id,entry);}
  return entry;
}
function selected(entry){
  const labels=new Set(entry.saved);
  for(const op of [entry.active,...entry.queue].filter(Boolean))if(op.tagged)labels.add(op.label);else labels.delete(op.label);
  return photoLabels([...labels]);
}
function fit(){
  fitFrame=null;const viewer=$('mediaViewer');if(!viewer?.open||!viewer.classList.contains('has-photo-labels')||!matchMedia('(max-width:700px)').matches)return;
  const height=window.visualViewport?.height||window.innerHeight,header=viewer.querySelector('.media-viewer-header'),footer=viewer.querySelector('.media-viewer-footer'),toolbar=viewer.querySelector('.face-zoom-toolbar');
  const available=Math.max(80,Math.min(height*.43,height-header.getBoundingClientRect().height-footer.getBoundingClientRect().height-(toolbar?.getBoundingClientRect().height||0)-30));
  const value=Math.floor(available)+'px';if(viewer.style.getPropertyValue('--photo-fit-height')===value)return;
  viewer.style.setProperty('--photo-fit-height',value);window.FamilyFaces?.fit?.();
}
function scheduleFit(){if(!fitFrame)fitFrame=requestAnimationFrame(fit);}
function render(){
  const host=$('mediaPhotoLabels');if(!host)return;
  host.hidden=!item||item.kind!=='photo';$('mediaViewer')?.classList.toggle('has-photo-labels',!host.hidden);if(host.hidden){host.replaceChildren();return;}
  const entry=store(item),labels=selected(entry),focus=document.activeElement?.dataset.photoLabelOption;
  host.innerHTML=`<div class="photo-label-heading"><button type="button" class="photo-label-toggle" data-photo-label-toggle aria-expanded="${open}" aria-controls="photoLabelChoices">${icon}<span>${tr('תגיות','Labels')}</span><span aria-hidden="true">${open?'⌃':'⌄'}</span></button><div class="photo-label-chips">${PHOTO_LABELS.filter(label=>labels.includes(label.id)).map(label=>`<span class="photo-label-chip">${safe(photoLabelName(label,I.isEnglish))}</span>`).join('')}</div></div><div id="photoLabelChoices" class="photo-label-choices" ${open?'':'hidden'}>${PHOTO_LABELS.map(label=>`<label><input type="checkbox" data-photo-label-option="${label.id}" ${labels.includes(label.id)?'checked':''} ${window.FamilyApp?.apiEnabled?'':'disabled'}><span>${safe(photoLabelName(label,I.isEnglish))}</span></label>`).join('')}</div><p class="photo-label-status${entry.error?' is-error':''}" role="status" ${entry.error||entry.running?'':'hidden'}>${safe(entry.error||(entry.running?tr('שומר…','Saving…'):''))}</p>`;
  if(focus)host.querySelector('[data-photo-label-option="'+focus+'"]')?.focus();scheduleFit();
}
async function flush(entry){
  if(entry.running)return;entry.running=true;
  while(entry.queue.length){
    entry.active=entry.queue.shift();render();
    try{
      const response=await I.fetch('api/media/'+entry.id+'/labels',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json','X-Family-Token':window.FAMILY_API_TOKEN},body:JSON.stringify(entry.active)});
      const result=await response.json();if(!response.ok)throw Error(I.error(result.error)||tr('התגית לא נשמרה. נסו שוב.','The label was not saved. Please try again.'));
      entry.saved=photoLabels(result.item.labels);entry.active=null;entry.error='';
      window.dispatchEvent(new CustomEvent('family-media-changed',{detail:result}));
    }catch(error){entry.error=error.message;entry.active=null;entry.queue=[];}
  }
  entry.running=false;render();
}
function mount(photo){
  if(item?.id!==photo.id)open=false;item=photo;
  const entry=store(photo);if(!entry.running&&!entry.error)entry.saved=photoLabels(photo.labels);render();
}
function init(){
  const host=$('mediaPhotoLabels');if(!host)return;
  host.addEventListener('click',event=>{if(event.target.closest('[data-photo-label-toggle]')){open=!open;render();}});
  host.addEventListener('change',event=>{
    const label=event.target.dataset.photoLabelOption;if(!item||!label||!window.FamilyApp?.apiEnabled)return;
    const entry=store(item);entry.error='';entry.queue.push({label,tagged:event.target.checked});flush(entry);
  });
  window.addEventListener('family-media-changed',event=>{
    const photo=event.detail.item;if(!photo||event.detail.operation!=='labels')return;
    const entry=store(photo);entry.saved=photoLabels(photo.labels);if(item?.id===photo.id){item={...item,...photo};render();}
  });
  $('mediaViewer').addEventListener('close',()=>{open=false;});
  window.addEventListener('resize',scheduleFit);window.visualViewport?.addEventListener('resize',scheduleFit);
  if(typeof ResizeObserver!=='undefined'){const observer=new ResizeObserver(scheduleFit);observer.observe($('mediaViewer'));observer.observe($('mediaViewer').querySelector('.media-viewer-footer'));}
}
window.FamilyPhotoLabels={mount};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
