import {photoLabelOptions,photoLabelName,photoLabelFromName,loadPhotoLabelCatalog} from './photo-labels-catalog.mjs?v=2';

const I=window.FamilyI18n,tr=(he,en)=>I.isEnglish?en:he;
const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state={scope:null,grid:null,ids:new Set(),items:new Map(),busy:false,epoch:0,context:''};
const cardSelector='.shared-media-card,.compact-gallery-card,.gallery-photo,.living-card,.family-ai-card';
const icons={select:'<rect x="3" y="3" width="18" height="18" rx="3"/><path d="m7 12 3 3 7-7"/>',download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',trash:'<path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6m4-6v6"/>',label:'<path d="M3 3h8l10 10-8 8L3 11Z"/><circle cx="7.5" cy="7.5" r="1.3"/>'};
const icon=name=>`<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name]}</svg>`;
let bar,confirmation,labelDialog,press=null,suppress=null,frame=null,resizeObserver;
const pendingPointers=new Set();
const menus=new Map();
const desktop=()=>window.FamilyPhotoKeyboard?.desktop?.()??matchMedia('(min-width:701px)').matches;
const lookup=(scope,id)=>window.FamilyMedia?.lookup(scope,id);
const context=scope=>{if(state.grid?.dataset.personGrid)return window.FamilyPeople.selectionContext(state.grid);if(scope!=='gallery')return '';const q=window.FamilyPortal.galleryQuery();return JSON.stringify([q.query,q.person,q.unit,q.labels||'',q.filter||'all']);};
const cards=()=>[...document.querySelectorAll('[data-select-id]')];
function candidate(card){
  const personal=card.querySelector('[data-person-item]');
  if(personal){const grid=card.parentElement,id=personal.dataset.personItem,item=window.FamilyPeople?.selectionItem(grid,id);return item?.id&&['photo','video'].includes(item.kind)?{id:item.id,scope:'personal:'+grid.dataset.personOwner,item,grid}:null;}
  const open=card.querySelector('[data-media-open],[data-living-original],[data-ai-open]');
  if(!open)return null;
  const id=open.dataset.mediaOpen||open.dataset.livingOriginal||open.dataset.aiOpen;
  const scope=open.dataset.mediaScope||(open.dataset.livingOriginal?'living-family':'family-ai');
  const item=lookup(scope,id);
  return item?.id&&['photo','video'].includes(item.kind)?{id:item.id,scope,item,grid:card.parentElement}:null;
}
function cardFor(target){return target?.closest?.('[data-select-id]');}
function status(message='',error=false){if(!bar)return;bar.querySelector('[data-selection-status]').textContent=message;bar.classList.toggle('has-error',error);}
function clear(){
  if(state.busy)return;
  state.epoch++;state.ids.clear();state.items.clear();state.scope=null;state.grid=null;
  status();render();
}
function startSelection(grid){
  if(state.busy)return;
  cancelPress();suppress=null;
  if(state.grid===grid){clear();return;}
  const card=cards().find(card=>card.parentElement===grid),data=card&&candidate(card);if(!data)return;
  clear();state.scope=data.scope;state.grid=grid;state.context=context(data.scope);status();render();
}
function mountMenu(grid){
  const existing=menus.get(grid);if(existing?.button.isConnected)return;
  const siblings=[...grid.parentElement.children],preceding=siblings.slice(0,siblings.indexOf(grid));
  let host=preceding.find(node=>node.matches('.person-gallery-toolbar'))?.querySelector('.media-grid-header-actions')||preceding.find(node=>node.matches('.gallery-category-row')),fallback=false;
  if(host&&!host.matches('.media-grid-header-actions')){
    const row=host;host=row.querySelector('.media-grid-header-actions');
    if(!host){host=document.createElement('div');host.className='media-grid-header-actions';const filter=row.querySelector('.gallery-refine-toggle');row.append(host);if(filter)host.append(filter);}
  }else if(!host)host=[...preceding].reverse().find(node=>node.matches('.video-filter-toolbar,.collection-heading,.archive-toolbar,.archive-filters,.family-ai-toolbar,.living-family-meta'));
  if(!host){host=document.createElement('div');host.className='media-grid-selection-menu';grid.before(host);fallback=true;}
  const button=document.createElement('button');button.type='button';button.className='media-grid-selection-toggle';button.dataset.selectionStart='';button.setAttribute('data-i18n-skip','');button.setAttribute('aria-controls','mediaSelectionActions');button.innerHTML=icon('select')+'<span></span>';
  button.addEventListener('click',()=>startSelection(grid));host.append(button);menus.set(grid,{host,button,fallback});
}
function enter(card){
  if(state.busy)return;
  const data=candidate(card);if(!data)return;
  if(state.grid!==data.grid){clear();state.scope=data.scope;state.grid=data.grid;state.context=context(data.scope);}
  state.ids.add(data.id);state.items.set(data.id,data.item);status();render();
}
function toggle(card){
  if(state.busy||card.parentElement!==state.grid)return;
  const data=candidate(card);if(!data)return;
  if(state.ids.has(data.id)){state.ids.delete(data.id);state.items.delete(data.id);}
  else{state.ids.add(data.id);state.items.set(data.id,data.item);}
  status();render();
}
function render(){
  if(!bar)return;
  if(state.grid&&!state.busy&&state.context!==context(state.scope)){clear();return;}
  const active=Boolean(state.grid?.isConnected);
  if(state.grid&&!active&&!state.busy){state.scope=null;state.grid=null;state.ids.clear();state.items.clear();state.epoch++;}
  bar.hidden=!active;
  if(active){
    if(bar.parentElement!==state.grid.parentElement||bar.nextElementSibling!==state.grid)state.grid.before(bar);
    bar.querySelector('[data-selection-count]').textContent=tr('נבחרו ','Selected: ')+state.ids.size;
    for(const button of bar.querySelectorAll('button'))button.disabled=state.busy||(!state.ids.size&&button.matches('[data-selection-download],[data-selection-delete],[data-selection-label]'));
  }
  for(const card of cards()){
    const selectable=active&&card.parentElement===state.grid,selected=selectable&&state.ids.has(card.dataset.selectId);
    card.classList.toggle('is-selecting',selectable);card.classList.toggle('is-media-selected',selected);
    const check=card.querySelector('[data-selection-check]');
    if(check){check.hidden=!selectable;check.setAttribute('aria-pressed',String(selected));check.disabled=state.busy;}
  }
  const show=desktop();
  for(const [grid,{host,button,fallback}]of menus){
    const selecting=active&&state.grid===grid,label=selecting?tr('סיום בחירה','Done selecting'):tr('בחירה','Select');
    button.hidden=!show&&!grid.dataset.personGrid;button.disabled=state.busy;button.setAttribute('aria-pressed',String(selecting));button.setAttribute('aria-label',label);button.title=label;button.querySelector('span').textContent=label;
    if(fallback)host.hidden=!show;
  }
}
function placeCheck(card){
  const check=card.querySelector('[data-selection-check]'),media=card.querySelector('.gallery-image,.living-photo,.family-ai-photo,.video-tile-preview,.personal-video-cover,video');
  if(!check||!media?.getBoundingClientRect)return;
  const rect=media.getBoundingClientRect();if(rect.height){check.style.top=Math.max(4,Math.round(rect.bottom-card.getBoundingClientRect().top-35))+'px';check.style.bottom='auto';}
}
function scan(){
  frame=null;const grids=new Set();
  for(const card of document.querySelectorAll(cardSelector)){
    const data=candidate(card);if(!data)continue;grids.add(data.grid);
    card.dataset.selectId=data.id;card.dataset.selectScope=data.scope;
    card.classList.add('media-select-card');
    if(!card.querySelector('[data-selection-check]')){
      const check=document.createElement('button');check.type='button';check.className='media-selection-check';check.dataset.selectionCheck='';check.textContent='✓';check.hidden=true;
      check.setAttribute('aria-label',tr('בחירת הפריט: ','Select item: ')+(data.item.caption||I.mediaName(data.item)));card.append(check);
      resizeObserver?.observe(card);
    }
    placeCheck(card);
  }
  for(const [grid,{host,button,fallback}]of menus)if(!grids.has(grid)||!button.isConnected){button.remove();if(fallback)host.remove();menus.delete(grid);}
  for(const grid of grids)mountMenu(grid);
  render();
}
function refresh(){if(frame===null)frame=requestAnimationFrame(scan);}
function cancelPress(){if(press)clearTimeout(press.timer);press=null;}
function pointerDown(event){
  pendingPointers.add(event.pointerId);
  if(pendingPointers.size>1){cancelPress();return;}
  if(event.button!==0||event.isPrimary===false||state.busy)return;
  const card=cardFor(event.target);if(!card)return;
  if(event.target.closest('input,textarea,select,[contenteditable=true]'))return;
  // Small edit, delete and fullscreen tools keep their usual click behavior.
  const tool=event.target.closest('button,a');
  if(tool&&!tool.matches('[data-media-open],[data-person-item],[data-living-original],[data-ai-open],[data-selection-check]')&&event.target.tagName!=='VIDEO')return;
  cancelPress();const pending={card,id:event.pointerId,x:event.clientX,y:event.clientY,fired:false,timer:null};press=pending;
  pending.timer=setTimeout(()=>{
    if(press!==pending||!card.isConnected)return;
    pending.fired=true;enter(card);suppress={card,until:Date.now()+1600};
    try{card.setPointerCapture?.(pending.id);}catch{}
    card.querySelector('video')?.pause();
  },event.pointerType==='mouse'?1000:600);
}
function pointerMove(event){if(press?.id===event.pointerId&&!press.fired&&Math.hypot(event.clientX-press.x,event.clientY-press.y)>10)cancelPress();}
function pointerEnd(event){pendingPointers.delete(event.pointerId);if(press?.id===event.pointerId){if(press.fired)suppress={card:press.card,until:Date.now()+900};cancelPress();}}
function captureClick(event){
  const card=cardFor(event.target);if(!card)return;
  if(suppress?.card===card&&Date.now()<suppress.until){event.preventDefault();event.stopImmediatePropagation();suppress=null;return;}
  const check=event.target.closest('[data-selection-check]');
  if(check||state.grid===card.parentElement&&!event.target.closest('input,textarea,select,a,[data-media-delete],[data-video-edit],[data-living-action],[data-living-remove],[data-ai-create],[data-ai-remove],[data-ai-restore]')){
    event.preventDefault();event.stopImmediatePropagation();if(state.grid===card.parentElement)toggle(card);else enter(card);
  }
}
async function selectAll(){
  if(!state.grid||state.busy)return;
  const epoch=state.epoch;state.busy=true;render();
  try{
    let ids;
    if(state.scope==='gallery'){
      const q=window.FamilyPortal.galleryQuery(),response=await I.fetch('api/gallery/selection?'+new URLSearchParams({q:q.query,person:q.person,unit:q.unit,labels:q.labels||'',filter:q.filter||'all',...(q.generation?{generation:q.generation}:{})}),{cache:'no-store'}),result=await response.json();
      if(!response.ok)throw Error(I.error(result.error));ids=result.ids;
    }else if(state.grid.dataset.personGrid)ids=await window.FamilyPeople.selectAlbum(state.grid);
    else ids=cards().filter(card=>card.parentElement===state.grid).map(card=>card.dataset.selectId);
    if(epoch!==state.epoch)return;
    for(const id of ids){state.ids.add(id);const item=state.grid.dataset.personGrid?window.FamilyPeople.selectionItem(state.grid,id):lookup(state.scope,id);if(item)state.items.set(id,item);}status();
  }catch(error){status(error.message,true);}finally{state.busy=false;render();}
}
function download(){
  if(!state.ids.size||state.busy)return;
  let frame=document.getElementById('mediaSelectionDownload');
  if(!frame){frame=document.createElement('iframe');frame.id=frame.name='mediaSelectionDownload';frame.hidden=true;frame.title=tr('הורדת הפריטים שנבחרו','Selected media download');document.body.append(frame);frame.addEventListener('load',()=>{try{const result=JSON.parse(frame.contentDocument.body.textContent);if(result.error)status(I.error(result.error),true);}catch{}});}
  const form=document.createElement('form'),branch=document.documentElement?.dataset?.nakashBranch;
  form.method='POST';form.action=branch?'/nakash/api/compat/'+branch+'/api/media/download':'api/media/download';form.target=frame.name;form.hidden=true;
  for(const [name,value]of Object.entries({ids:JSON.stringify([...state.ids]),token:window.FAMILY_API_TOKEN})){const field=document.createElement('input');field.type='hidden';field.name=name;field.value=value;form.append(field);}
  document.body.append(form);form.submit();form.remove();status(tr('הורדת קובץ ה־ZIP החלה.','Your ZIP download has started.'));
}
async function post(id,action,body){
  const response=await I.fetch('api/media/'+id+'/'+action,{method:'POST',headers:{'Content-Type':'application/json','X-Family-Token':window.FAMILY_API_TOKEN},body:JSON.stringify(body)});
  const result=await response.json();if(!response.ok)throw Error(I.error(result.error)||tr('הפעולה לא נשמרה.','The change was not saved.'));return result;
}
async function apply(action,label){
  if(!state.ids.size||state.busy)return;
  const ids=[...state.ids],results=[];state.busy=true;render();labelDialog?.close();confirmation?.close();
  try{
    for(const [index,id]of ids.entries()){
      status(tr('שומר ','Saving ')+(index+1)+' / '+ids.length);
      results.push(await post(id,action,action==='labels'?{label,tagged:true}:{scope:state.scope?.startsWith('personal:')?state.scope:state.items.get(id)?.scope||state.scope}));
      state.ids.delete(id);state.items.delete(id);
    }
    status(tr('הפעולה הושלמה ✓','Changes saved ✓'));
  }catch(error){status(error.message+tr(' הפריטים שנותרו מסומנים טרם עודכנו.',' The remaining selected items have not been updated.'),true);}
  finally{
    // Notify only after the loop: filter reloads cannot remove the next item
    // from the operation or reset the selection during a partial failure.
    for(const result of results)window.dispatchEvent(new CustomEvent('family-media-changed',{detail:result}));
    state.busy=false;render();
  }
}
function confirmDelete(){
  if(!state.ids.size||state.busy)return;
  if(['family-ai','living-family'].includes(state.scope)){
    const items=[...state.ids].map(id=>state.items.get(id)||lookup(state.scope,id)).filter(Boolean);
    window.FamilyAI?.removeMany?.(items,clear);return;
  }
  if(!confirmation){
    confirmation=document.createElement('dialog');confirmation.className='media-selection-dialog';confirmation.setAttribute('data-i18n-skip','');confirmation.setAttribute('aria-labelledby','mediaSelectionDeleteTitle');
    confirmation.innerHTML=`<h2 id="mediaSelectionDeleteTitle">${tr('למחוק את הפריטים שנבחרו?','Delete selected items?')}</h2><p data-selection-delete-count></p><p>${tr('הפריטים יוסרו מכל האלבומים ויועברו לסל המחזור.','These items will be removed from all albums and moved to the recycle bin.')}</p><div class="media-selection-dialog-actions"><button type="button" class="secondary-button" data-selection-cancel>${tr('ביטול','Cancel')}</button><button type="button" class="media-selection-danger" data-selection-confirm>${tr('מחק את הנבחרים','Delete selected')}</button></div>`;
    document.body.append(confirmation);confirmation.querySelector('[data-selection-cancel]').addEventListener('click',()=>confirmation.close());confirmation.querySelector('[data-selection-confirm]').addEventListener('click',()=>void apply('delete'));
  }
  confirmation.querySelector('p:not([data-selection-delete-count])').textContent=state.scope?.startsWith('personal:')?tr('פריטים שהועלו ישירות לאלבום יועברו לסל המחזור. פריטים מקושרים יוסרו מהאלבום האישי בלבד.','Items uploaded to this album will move to the recycle bin. Linked items will only be removed from this personal album.'):tr('הפריטים יוסרו מכל האלבומים ויועברו לסל המחזור.','These items will be removed from all albums and moved to the recycle bin.');
  confirmation.querySelector('[data-selection-delete-count]').textContent=tr('נבחרו ','Selected: ')+state.ids.size;confirmation.showModal();confirmation.querySelector('[data-selection-cancel]').focus();
}
async function chooseLabel(){
  if(!state.ids.size||state.busy)return;
  if(!labelDialog){
    labelDialog=document.createElement('dialog');labelDialog.className='media-selection-dialog';labelDialog.setAttribute('data-i18n-skip','');labelDialog.setAttribute('aria-labelledby','mediaSelectionLabelTitle');
    labelDialog.innerHTML=`<form><h2 id="mediaSelectionLabelTitle">${tr('הוספת תגית לכל הנבחרים','Add a label to all selected items')}</h2><div class="media-selection-labels"></div><label>${tr('או תגית חדשה','Or a new label')}<input type="text" maxlength="60" name="label" autocomplete="off"></label><p role="alert" data-selection-label-error></p><div class="media-selection-dialog-actions"><button type="button" class="secondary-button" data-selection-cancel>${tr('ביטול','Cancel')}</button><button type="submit" class="primary-button">${tr('הוספה לכל הנבחרים','Add to all selected')}</button></div></form>`;
    document.body.append(labelDialog);labelDialog.querySelector('[data-selection-cancel]').addEventListener('click',()=>labelDialog.close());
    labelDialog.addEventListener('submit',event=>{event.preventDefault();const value=labelDialog.querySelector('input[name=label]').value.trim(),label=value?photoLabelFromName(value):labelDialog.querySelector('input[name=choice]:checked')?.value;if(!label){labelDialog.querySelector('[data-selection-label-error]').textContent=tr('בחרו תגית או הזינו שם חדש.','Choose a label or enter a new name.');return;}void apply('labels',label);});
  }
  await loadPhotoLabelCatalog().catch(()=>{});if(!state.ids.size)return;
  labelDialog.querySelector('.media-selection-labels').innerHTML=photoLabelOptions().map(label=>`<label><input type="radio" name="choice" value="${safe(label.id)}"><span>${safe(photoLabelName(label,I.isEnglish))}</span></label>`).join('');
  labelDialog.querySelector('input[name=label]').value='';labelDialog.querySelector('[data-selection-label-error]').textContent='';labelDialog.showModal();
}
function init(){
  bar=document.createElement('div');bar.id='mediaSelectionActions';bar.className='media-selection-bar';bar.hidden=true;bar.setAttribute('data-i18n-skip','');bar.setAttribute('role','region');bar.setAttribute('aria-label',tr('פעולות על הפריטים שנבחרו','Selected media actions'));
  bar.innerHTML=`<strong data-selection-count aria-live="polite"></strong><button type="button" data-selection-all>${tr('בחר הכל','Select all')}</button><button type="button" data-selection-done>${tr('סיום בחירה','Done selecting')}</button><button type="button" data-selection-download>${icon('download')}${tr('הורדה','Download')}</button><button type="button" data-selection-label>${icon('label')}${tr('הוספת תגית','Add label')}</button><button type="button" data-selection-delete>${icon('trash')}${tr('מחיקה','Delete')}</button><p data-selection-status role="status"></p>`;
  document.body.append(bar);
  bar.addEventListener('click',event=>{if(event.target.closest('[data-selection-done]'))clear();else if(event.target.closest('[data-selection-all]'))void selectAll();else if(event.target.closest('[data-selection-download]'))download();else if(event.target.closest('[data-selection-delete]'))confirmDelete();else if(event.target.closest('[data-selection-label]'))void chooseLabel();});
  document.addEventListener('pointerdown',pointerDown,true);document.addEventListener('pointermove',pointerMove,{capture:true,passive:true});document.addEventListener('pointerup',pointerEnd,true);document.addEventListener('pointercancel',pointerEnd,true);
  document.addEventListener('scroll',()=>{if(press&&!press.fired)cancelPress();},{capture:true,passive:true});
  document.addEventListener('contextmenu',event=>{const card=cardFor(event.target);if(card){event.preventDefault();if(press&&!press.fired){clearTimeout(press.timer);press.fired=true;enter(card);suppress={card,until:Date.now()+1600};}}},true);
  document.addEventListener('dragstart',event=>{if(cardFor(event.target)){event.preventDefault();cancelPress();}},true);
  document.addEventListener('click',captureClick,true);
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&state.grid&&!document.querySelector('dialog[open]'))clear();if(event.key===' '&&event.shiftKey){const card=cardFor(event.target);if(card){event.preventDefault();state.grid===card.parentElement?toggle(card):enter(card);}}});
  window.addEventListener('resize',refresh);
  window.addEventListener('blur',()=>{cancelPress();pendingPointers.clear();});window.addEventListener('hashchange',()=>{cancelPress();clear();});
  window.addEventListener('family-media-changed',event=>{const item=event.detail?.item;if(item){if(event.detail.operation==='delete'){state.ids.delete(item.id);state.items.delete(item.id);}else if(state.ids.has(item.id))state.items.set(item.id,item);}refresh();});
  if(typeof ResizeObserver!=='undefined')resizeObserver=new ResizeObserver(entries=>{for(const entry of entries)if(entry.target.isConnected)placeCheck(entry.target);else resizeObserver.unobserve(entry.target);});
  new MutationObserver(records=>{if(records.some(record=>[...record.addedNodes,...record.removedNodes].some(node=>node.nodeType===1&&!node.matches('.media-selection-bar,.media-selection-check')&&(node.matches(cardSelector)||node.querySelector(cardSelector)||node.matches('[data-media-open],[data-living-original],[data-ai-open]')))))refresh();}).observe(document.body,{childList:true,subtree:true});
  scan();
}
window.FamilyMediaSelection={refresh,clear,clearScope:scope=>{if(state.scope===scope)clear();},download,ids:()=>[...state.ids]};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
