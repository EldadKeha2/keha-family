import {draggedFileCount,readDroppedPhotos} from './photo-drop-core.mjs';

const I=window.FamilyI18n,tr=(he,en)=>I.isEnglish?en:he;
const desktop=()=>matchMedia('(hover: hover) and (pointer: fine)').matches;
const arrow='<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M7 27v7h26v-7M20 28V6m-8 8 8-8 8 8"/></svg>';
let layer,dialog,active,expiry;
const get=id=>document.getElementById('photoDrop'+id);
function mount(){
  if(layer)return;
  layer=document.createElement('div');layer.id='desktopPhotoDrop';layer.className='desktop-photo-drop';layer.hidden=true;layer.dataset.i18nSkip='';
  layer.innerHTML=`<div class="photo-drop-card"><div class="photo-drop-symbol">${arrow}<b id="photoDropCount" hidden></b></div><strong id="photoDropTitle"></strong><span id="photoDropSelection" role="status" aria-live="polite"></span></div>`;
  dialog=document.createElement('dialog');dialog.id='photoDropPreparation';dialog.className='photo-drop-preparation';dialog.dataset.i18nSkip='';dialog.setAttribute('aria-labelledby','photoDropPreparationTitle');
  dialog.innerHTML=`<div class="photo-drop-symbol">${arrow}</div><h2 id="photoDropPreparationTitle"></h2><p id="photoDropReading" role="status"></p><div class="photo-drop-percentage" id="photoDropPercent" aria-hidden="true">0%</div><progress id="photoDropProgress" max="100" value="0"></progress><p id="photoDropFilename" dir="auto"></p><button type="button" id="photoDropCancel" class="secondary-button"></button>`;
  document.body.append(layer,dialog);
  get('Cancel').addEventListener('click',()=>active?.abort());
  dialog.addEventListener('cancel',event=>{event.preventDefault();active?.abort();});
}
function hide(){clearTimeout(expiry);if(layer)layer.hidden=true;}
function show(event){
  if(!desktop()||active)return;
  const transfer=event?.dataTransfer,count=draggedFileCount(transfer);
  if(!count&&!Array.from(transfer?.types||[]).includes('Files'))return;
  mount();layer.dir=I.isEnglish?'ltr':'rtl';layer.hidden=false;
  get('Title').textContent=tr('שחררו את התמונות כאן','Drop your photos here');
  const label=count?count+' '+tr(count===1?'פריט נגרר':'פריטים נגררים',count===1?'item selected':'items selected'):tr('הוספת תמונות לגלריה','Add photos to the gallery');
  if(get('Selection').textContent!==label)get('Selection').textContent=label;
  get('Count').textContent=count;get('Count').hidden=!count;
  try{transfer.dropEffect='copy';}catch{/* Some browser drag sessions expose read-only effects. */}
  clearTimeout(expiry);expiry=setTimeout(hide,1500);
}
async function prepare(files){
  if(!desktop())return files;
  if(active)throw Error(tr('מסיימים קודם את הכנת התמונות שנבחרו.','Finish preparing the selected photos first.'));
  mount();hide();const controller=new AbortController();active=controller;
  const focus=document.activeElement;dialog.dir=I.isEnglish?'ltr':'rtl';
  get('PreparationTitle').textContent=tr('מכינים את התמונות לעריכה','Preparing your photos for editing');
  get('Cancel').textContent=tr('ביטול','Cancel');get('Progress').setAttribute('aria-label',tr('התקדמות הכנת התמונות','Photo preparation progress'));
  get('Progress').value=0;get('Percent').textContent='0%';get('Reading').textContent='';get('Filename').textContent='';dialog.showModal();
  try{
    // Paint the preparation screen before starting disk reads.
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const result=await readDroppedPhotos(files,{signal:controller.signal,onProgress:value=>{
      get('Progress').value=value.percent;get('Percent').textContent=value.percent+'%';
      const reading=tr('תמונה ','Photo ')+value.current+tr(' מתוך ',' of ')+value.count;
      if(get('Reading').textContent!==reading)get('Reading').textContent=reading;
      get('Filename').textContent=value.filename;
    }});
    // Show the real completion state before the editor takes over.
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    if(controller.signal.aborted)return null;return result;
  }catch(error){
    if(error.name==='AbortError')return null;
    throw Error((error.filename?error.filename+': ':'')+(error.code==='PHOTO_TOO_LARGE'?tr('אפשר להעלות תמונה עד 50MB.','Photos can be up to 50MB.'):tr('לא ניתן לקרוא את התמונה. בחרו אותה מחדש ונסו שוב.','This photo could not be read. Select it again and retry.')));
  }finally{active=null;dialog.close();focus?.focus?.({preventScroll:true});}
}
document.addEventListener('drop',hide);
document.addEventListener('dragend',hide);
document.addEventListener('dragleave',event=>{if(!event.relatedTarget&&(event.clientX<=0||event.clientY<=0||event.clientX>=window.innerWidth||event.clientY>=window.innerHeight))hide();});
document.addEventListener('keydown',event=>{if(event.key==='Escape')hide();});
window.addEventListener('blur',hide);window.addEventListener('hashchange',hide);
window.FamilyPhotoDrop={show,hide,prepare};
