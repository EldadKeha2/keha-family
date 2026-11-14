import {DEFAULT_VIDEO_CATEGORIES} from './video-category-catalog.mjs';

const I=window.FamilyI18n,$=id=>document.getElementById(id),tr=(he,en)=>I.isEnglish?en:he;
const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const categoryIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5h7l2 2h9v13H3Z"/><path d="M8 13h8m-4-4v8"/></svg>';
let catalog=DEFAULT_VIDEO_CATEGORIES,createDialog,assignDialog,assignment,afterCreate;
const name=category=>I.isEnglish?category.nameEn||category.name:category.name;
function options(){return catalog.map(category=>`<option value="${safe(category.id)}">${safe(name(category))}</option>`).join('');}
function render(categories,selected='all'){
 if(Array.isArray(categories))catalog=categories;
 const tabs=$('videoCategories'),upload=$('videoUploadCategory');if(!tabs||!upload)return;
 const signature=JSON.stringify([I.isEnglish,catalog]);
 if(tabs.dataset.signature!==signature){
  tabs.innerHTML=`<button type="button" data-video-category="all">${tr('כל הסרטונים','All videos')}</button>`+catalog.map(category=>`<button type="button" data-video-category="${safe(category.id)}">${safe(name(category))}</button>`).join('')+`<button type="button" class="video-category-add" data-video-new-category>＋ ${tr('הוספת קטגוריה','Add category')}</button>`;
  const previous=upload.value;upload.innerHTML=options();upload.value=catalog.some(category=>category.id===previous)?previous:'family';tabs.dataset.signature=signature;
 }
 if(selected!=='all'&&catalog.some(category=>category.id===selected))upload.value=selected;
 for(const button of tabs.querySelectorAll('[data-video-category]'))button.setAttribute('aria-pressed',String(button.dataset.videoCategory===selected));
 if(assignDialog?.open){const value=$('videoCategoryChoice').value;$('videoCategoryChoice').innerHTML=options();$('videoCategoryChoice').value=value;}
}
async function post(path,body){
 const response=await I.fetch(path,{method:'POST',headers:{'Content-Type':'application/json','X-Family-Token':window.FAMILY_API_TOKEN},body:JSON.stringify(body)});
 let result;try{result=await response.json();}catch{throw Error(tr('לא התקבל אישור שמירה. נסו שוב.','No save confirmation was received. Please retry.'));}
 if(!response.ok)throw Error(I.error(result.error)||tr('השינוי לא נשמר.','The change was not saved.'));return result;
}
function changed(result){catalog=result.collection.categories;window.dispatchEvent(new CustomEvent('family-media-changed',{detail:result}));}
function mountCreate(){
 if(createDialog)return;
 createDialog=document.createElement('dialog');createDialog.id='videoCategoryEditor';createDialog.className='portal-dialog video-category-dialog';createDialog.dataset.i18nSkip='';createDialog.setAttribute('aria-labelledby','videoCategoryEditorTitle');
 createDialog.innerHTML=`<button type="button" class="dialog-close" aria-label="${tr('סגירה','Close')}">×</button><form><h2 id="videoCategoryEditorTitle">${tr('הוספת קטגוריה לסרטונים','Add a video category')}</h2><label>${tr('שם הקטגוריה','Category name')}<input id="videoCategoryName" dir="auto" maxlength="80" required autocomplete="off"></label><label>${tr('שם באנגלית (לא חובה)','English name (optional)')}<input id="videoCategoryNameEn" dir="ltr" maxlength="80" autocomplete="off"></label><p id="videoCategoryCreateError" class="form-error" role="alert"></p><div class="form-actions"><button type="submit" class="primary-button">${tr('יצירת קטגוריה','Create category')}</button><button type="button" class="secondary-button" data-video-category-cancel>${tr('ביטול','Cancel')}</button></div></form>`;
 document.body.append(createDialog);for(const button of createDialog.querySelectorAll('.dialog-close,[data-video-category-cancel]'))button.addEventListener('click',()=>createDialog.close());
 createDialog.querySelector('form').addEventListener('submit',async event=>{
  event.preventDefault();const button=createDialog.querySelector('[type=submit]');if(button.disabled)return;button.disabled=true;$('videoCategoryCreateError').textContent='';
  try{const result=await post('api/collections/videos/categories',{name:$('videoCategoryName').value,nameEn:$('videoCategoryNameEn').value});changed(result);createDialog.close();afterCreate?.(result.category);window.FamilyApp?.toast(tr('הקטגוריה נוספה ✓','Category added ✓'));}
  catch(error){$('videoCategoryCreateError').textContent=error.message;}finally{button.disabled=false;}
 });
}
function openCreate(callback=null){
 mountCreate();if(createDialog.open)return;afterCreate=callback;createDialog.dir=I.isEnglish?'ltr':'rtl';$('videoCategoryName').value=$('videoCategoryNameEn').value=$('videoCategoryCreateError').textContent='';createDialog.showModal();$('videoCategoryName').focus();
}
function mountAssign(){
 if(assignDialog)return;
 assignDialog=document.createElement('dialog');assignDialog.id='videoCategoryAssignment';assignDialog.className='portal-dialog video-category-dialog';assignDialog.dataset.i18nSkip='';assignDialog.setAttribute('aria-labelledby','videoCategoryAssignmentTitle');
 assignDialog.innerHTML=`<button type="button" class="dialog-close" aria-label="${tr('סגירה','Close')}">×</button><form><h2 id="videoCategoryAssignmentTitle">${tr('שיוך הסרטון לקטגוריה','Choose a video category')}</h2><p id="videoCategoryFilm" dir="auto"></p><label>${tr('קטגוריה','Category')}<select id="videoCategoryChoice"></select></label><button type="button" class="secondary-button" data-video-category-create-from-assign>＋ ${tr('הוספת קטגוריה','Add category')}</button><p id="videoCategoryAssignError" class="form-error" role="alert"></p><div class="form-actions"><button type="submit" class="primary-button">${tr('שמירת השיוך','Save category')}</button><button type="button" class="secondary-button" data-video-category-cancel>${tr('ביטול','Cancel')}</button></div></form>`;
 document.body.append(assignDialog);for(const button of assignDialog.querySelectorAll('.dialog-close,[data-video-category-cancel]'))button.addEventListener('click',()=>assignDialog.close());
 assignDialog.querySelector('[data-video-category-create-from-assign]').addEventListener('click',()=>openCreate(category=>{if(assignDialog.open){$('videoCategoryChoice').innerHTML=options();$('videoCategoryChoice').value=category.id;}}));
 assignDialog.querySelector('form').addEventListener('submit',async event=>{
  event.preventDefault();const button=assignDialog.querySelector('[type=submit]');if(button.disabled)return;const owner=assignment;button.disabled=true;$('videoCategoryAssignError').textContent='';
  try{const result=await post('api/media/'+owner.id+'/video-category',{group:$('videoCategoryChoice').value,expectedGroup:owner.videoCategory||'family'});changed(result);if(assignment===owner)assignDialog.close();window.FamilyApp?.toast(tr('השיוך נשמר ✓','Category saved ✓'));}
  catch(error){if(assignment===owner)$('videoCategoryAssignError').textContent=error.message;}finally{button.disabled=false;}
 });
}
function openAssign(id){
 const collection=window.FamilyPortal?.getCollection('videos'),item=collection?.items.find(item=>item.id===id);if(!item)return;
 if(collection.categories)catalog=collection.categories;mountAssign();if(assignDialog.open)return;assignment={...item};assignDialog.dir=I.isEnglish?'ltr':'rtl';$('videoCategoryFilm').textContent=item.caption||item.name;$('videoCategoryChoice').innerHTML=options();$('videoCategoryChoice').value=item.videoCategory||'family';$('videoCategoryAssignError').textContent='';assignDialog.showModal();
}
function controls(item,scope){
 if(scope!=='videos'||item.kind!=='video'||!item.id)return '';
 const label=tr('שיוך הסרטון לקטגוריה','Choose a video category');return `<button type="button" class="video-category-launch" data-video-assign-category="${safe(item.id)}" aria-label="${label}" title="${label}">${categoryIcon}</button>`;
}
document.addEventListener('click',event=>{const add=event.target.closest?.('[data-video-new-category]');if(add){openCreate();return;}const assign=event.target.closest?.('[data-video-assign-category]');if(assign)openAssign(assign.dataset.videoAssignCategory);});
window.FamilyVideoCategories={render,options,controls};
