import {photoLabels,photoLabelName,photoLabelOptions,photoLabelFromName,photoLabelKey,rememberPhotoLabels,loadPhotoLabelCatalog} from './photo-labels-catalog.mjs?v=2';
const I=window.FamilyI18n,$=id=>document.getElementById(id),tr=(he,en)=>I.isEnglish?en:he;
const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3h8l10 10-8 8L3 11Z"/><circle cx="7.5" cy="7.5" r="1.3"/></svg>';
const stores=new Map();let item=null,open=false,fitFrame;
function mobileFrame(){const nav=window.navigator;return nav?Boolean(nav.userAgentData?.mobile||/Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(nav.userAgent||'')||(/Macintosh/i.test(nav.userAgent||'')&&nav.maxTouchPoints>1)):matchMedia('(max-width:700px)').matches;}
function store(photo){
  let entry=stores.get(photo.id);
  if(!entry){entry={id:photo.id,saved:photoLabels(photo.labels),queue:[],active:null,error:'',running:false,customOpen:false,customName:''};stores.set(photo.id,entry);}
  return entry;
}
function selected(entry){
  const labels=new Set(entry.saved);
  for(const op of [entry.active,...entry.queue].filter(Boolean))if(op.tagged)labels.add(op.label);else labels.delete(op.label);
  return photoLabels([...labels]);
}
function fit(){
  fitFrame=null;const viewer=$('mediaViewer');if(!viewer?.open||!viewer.classList.contains('mobile-photo-frame'))return;
  const height=window.innerHeight||window.visualViewport?.height,header=viewer.querySelector('.media-viewer-header'),width=$('mediaStage')?.clientWidth||document.documentElement?.clientWidth||window.innerWidth||Infinity;
  // One frame per phone viewport, independent of photo shape and tag count.
  const available=Math.max(100,Math.min(width,440,height*.52,height-header.getBoundingClientRect().height-48));
  const value=Math.floor(available)+'px';if(viewer.style.getPropertyValue('--photo-fit-height')===value)return;
  viewer.style.setProperty('--photo-fit-height',value);window.FamilyFaces?.fit?.();
}
function scheduleFit(){if(!fitFrame)fitFrame=requestAnimationFrame(fit);}
function render(){
  const host=$('mediaPhotoLabels');if(!host)return;
  host.hidden=!item||item.kind!=='photo';$('mediaViewer')?.classList.toggle('has-photo-labels',!host.hidden);$('mediaViewer')?.classList.toggle('mobile-photo-frame',!host.hidden&&mobileFrame());if(host.hidden){host.replaceChildren();return;}
  const entry=store(item),labels=selected(entry),options=open?photoLabelOptions(labels):[],focus=document.activeElement?.dataset.photoLabelOption,typing=document.activeElement?.id==='photoCustomLabelName',cursor=document.activeElement?.selectionStart,disabled=window.FamilyApp?.apiEnabled?'':'disabled';
  host.innerHTML=`<div class="photo-label-heading"><button type="button" class="photo-label-toggle" data-photo-label-toggle aria-expanded="${open}" aria-controls="photoLabelChoices">${icon}<span>${tr('תגיות','Labels')}</span><span aria-hidden="true">${open?'⌃':'⌄'}</span></button><div class="photo-label-chips">${labels.map(label=>`<span class="photo-label-chip" dir="auto">${safe(photoLabelName(label,I.isEnglish))}</span>`).join('')}</div></div><div id="photoLabelChoices" class="photo-label-choices" ${open?'':'hidden'}>${options.map(label=>`<label><input type="checkbox" data-photo-label-option="${safe(label.id)}" ${labels.includes(label.id)?'checked':''} ${disabled}><span dir="auto">${safe(photoLabelName(label,I.isEnglish))}</span></label>`).join('')}<button type="button" class="photo-label-add" data-photo-label-add ${disabled}>＋ ${tr('הוסף תגיות נוספות','Add more labels')}</button><form class="photo-custom-label-form" data-photo-label-form ${entry.customOpen?'':'hidden'}><span>${tr('שם התגית החדשה','New label name')}</span><div><input id="photoCustomLabelName" data-photo-label-name type="text" dir="${I.isEnglish?'ltr':'rtl'}" maxlength="60" value="${safe(entry.customName)}" aria-label="${tr('שם התגית החדשה','New label name')}" autocomplete="off" required ${disabled}><button type="submit" ${disabled}>${tr('הוסף','Add')}</button><button type="button" data-photo-label-cancel>${tr('ביטול','Cancel')}</button></div></form></div><p class="photo-label-status${entry.error?' is-error':''}" role="status" ${entry.error||entry.running?'':'hidden'}>${safe(entry.error||(entry.running?tr('שומר…','Saving…'):''))}</p>`;
  if(focus)[...host.querySelectorAll('[data-photo-label-option]')].find(node=>node.dataset.photoLabelOption===focus)?.focus();
  if(typing&&entry.customOpen){const input=$('photoCustomLabelName');input?.focus();if(typeof cursor==='number')input?.setSelectionRange?.(cursor,cursor);}scheduleFit();
}
async function flush(entry){
  if(entry.running)return;entry.running=true;
  while(entry.queue.length){
    entry.active=entry.queue.shift();render();
    try{
      const response=await I.fetch('api/media/'+entry.id+'/labels',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json','X-Family-Token':window.FAMILY_API_TOKEN},body:JSON.stringify({label:entry.active.label,tagged:entry.active.tagged})});
      const result=await response.json();if(!response.ok)throw Error(I.error(result.error)||tr('התגית לא נשמרה. נסו שוב.','The label was not saved. Please try again.'));
      entry.saved=photoLabels(result.item.labels);if(entry.customName===entry.active.draft)entry.customName='';entry.active=null;entry.error='';rememberPhotoLabels(entry.saved);
      window.dispatchEvent(new CustomEvent('family-media-changed',{detail:result}));
    }catch(error){entry.error=error.message;if(entry.active?.draft){entry.customName=entry.active.draft;entry.customOpen=true;}entry.active=null;entry.queue=[];}
  }
  entry.running=false;render();
}
function mount(photo){
  if(item?.id!==photo.id)open=false;item=photo;
  const entry=store(photo);if(!entry.running&&!entry.error)entry.saved=photoLabels(photo.labels);render();
}
function init(){
  const host=$('mediaPhotoLabels');if(!host)return;
  host.addEventListener('click',event=>{
    if(event.target.closest('[data-photo-label-toggle]')){open=!open;render();if(open){const id=item?.id;loadPhotoLabelCatalog().then(()=>{if(item?.id===id&&open)render();});}}
    if(event.target.closest('[data-photo-label-add]')&&window.FamilyApp?.apiEnabled){const entry=store(item);entry.customOpen=true;entry.error='';render();$('photoCustomLabelName')?.focus();}
    if(event.target.closest('[data-photo-label-cancel]')){const entry=store(item);entry.customOpen=false;entry.customName='';entry.error='';render();}
  });
  host.addEventListener('input',event=>{if(item&&event.target.matches('[data-photo-label-name]'))store(item).customName=event.target.value;});
  host.addEventListener('submit',event=>{
    if(!event.target.matches('[data-photo-label-form]'))return;event.preventDefault();if(!item||!window.FamilyApp?.apiEnabled)return;
    const entry=store(item),draft=entry.customName.trim();let label=photoLabelFromName(draft);
    if(!label){entry.error=tr('הזינו שם תגית באורך של עד 60 תווים.','Enter a label name of up to 60 characters.');render();return;}
    label=photoLabelOptions(selected(entry)).find(option=>photoLabelKey(option.id)===photoLabelKey(label))?.id||label;
    if(selected(entry).some(id=>photoLabelKey(id)===photoLabelKey(label))){entry.error=tr('התגית כבר קיימת בתמונה.','This photo already has that label.');render();return;}
    entry.error='';entry.customOpen=false;entry.queue.push({label,tagged:true,draft});flush(entry);
  });
  host.addEventListener('change',event=>{
    const label=event.target.dataset.photoLabelOption;if(!item||!label||!window.FamilyApp?.apiEnabled)return;
    const entry=store(item);entry.error='';entry.queue.push({label,tagged:event.target.checked});flush(entry);
  });
  window.addEventListener('family-media-changed',event=>{
    const photo=event.detail.item;if(!photo||event.detail.operation!=='labels')return;
    const entry=store(photo);entry.saved=photoLabels(photo.labels);if(item?.id===photo.id){item={...item,...photo};render();}
  });
  window.addEventListener('family-photo-label-catalog',()=>{if(open)render();});
  $('mediaViewer').addEventListener('close',()=>{open=false;});
  window.addEventListener('resize',scheduleFit);window.visualViewport?.addEventListener('resize',scheduleFit);
  if(typeof ResizeObserver!=='undefined'){const observer=new ResizeObserver(scheduleFit);observer.observe($('mediaViewer'));observer.observe($('mediaViewer').querySelector('.media-viewer-footer'));}
  const opened=window.FamilyMedia?.current?.();if(opened&&$('mediaViewer').open)mount(opened);
}
window.FamilyPhotoLabels={mount};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
