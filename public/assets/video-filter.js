import {familyOptions,familyLabel} from './gallery-family.mjs?v=2';
import {filterVideos,VIDEO_SORTS} from './video-filter-core.mjs';
const I=window.FamilyI18n,$=id=>document.getElementById(id),tr=(he,en)=>I.isEnglish?en:he;
const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normalize=value=>String(value||'').normalize('NFKD').replace(/[\u0591-\u05c7'"׳״]/g,'').toLowerCase();
const state={open:false,people:new Set(),families:new Set(),categories:new Set(),sort:'uploaded-desc',seed:Math.floor(Math.random()*0x100000000)};
let ready=false,roster=[],catalog=[],catalogSignature='',rosterLoaded=false;
function choices(id,items,selected,kind){
 $(id).innerHTML=items.map(item=>`<label class="gallery-check-option"><input type="checkbox" data-video-filter-${kind}="${safe(item.id)}"${selected.has(item.id)?' checked':''}><span>${safe(item.label)}</span></label>`).join('')||`<p class="gallery-filter-empty">${tr('לא נמצאו התאמות','No matches found')}</p>`;
}
function fillPeople(){
 const query=normalize($('videoPersonSearch').value);
 choices('videoPersonFilter',roster.filter(person=>state.people.has(person.id)||!query||normalize(person.name+' '+(person.nameEn||'')).includes(query)).map(person=>({id:person.id,label:I.personName(person)})).sort((a,b)=>a.label.localeCompare(b.label,I.locale)),state.people,'person');
}
function fillFamilies(){for(const generation of [2,3,4])choices('videoFamily'+generation,familyOptions(window.FAMILY_DATA,generation).map(unit=>({id:unit.id,label:familyLabel(window.FAMILY_DATA,unit,person=>I.personName(person),I.isEnglish)})).sort((a,b)=>a.label.localeCompare(b.label,I.locale)),state.families,'family');}
function fillCategories(){choices('videoCategoryFilter',catalog.map(category=>({id:category.id,label:category.id==='special-birthdays'?tr('ימי הולדת עגולים','Milestone birthdays'):I.isEnglish?category.nameEn||category.name:category.name})),state.categories,'category');}
function refresh(){render();window.FamilyPortal?.refreshVideos();}
function render(categories){
 if(Array.isArray(categories))catalog=categories;
 if(!ready)return;
 const signature=JSON.stringify([I.isEnglish,catalog]);if(signature!==catalogSignature){catalogSignature=signature;fillCategories();}
 const active=Boolean(state.people.size||state.families.size||state.categories.size),toggle=$('videoFilterToggle');
 toggle.setAttribute('aria-expanded',String(state.open));toggle.classList.toggle('has-filters',active);$('videoFilterPanel').hidden=!state.open;$('clearVideoFilter').hidden=!active;
 $('videoPeopleChoiceCount').textContent=state.people.size?'('+state.people.size+')':'';
 $('videoCategoryChoiceCount').textContent=state.categories.size?'('+state.categories.size+')':'';
 for(const generation of [2,3,4]){const count=[...state.families].filter(id=>window.FAMILY_DATA.units[id]?.generation===generation).length;$('videoFamily'+generation+'ChoiceCount').textContent=count?'('+count+')':'';}
 for(const input of $('videoFilterPanel').querySelectorAll('input[type=checkbox]')){const kind=input.dataset.videoFilterPerson?'people':input.dataset.videoFilterFamily?'families':'categories',id=input.dataset.videoFilterPerson||input.dataset.videoFilterFamily||input.dataset.videoFilterCategory;input.checked=state[kind].has(id);}
 for(const button of $('videoCategories').querySelectorAll('[data-video-category]'))button.setAttribute('aria-pressed',String(state.categories.has(button.dataset.videoCategory)));
 $('videoSort').value=state.sort;
}
function setCategories(categories,{refresh:shouldRefresh=true}={}){state.categories=new Set(categories);if(shouldRefresh)refresh();else render();}
function toggleCategory(id){if(state.categories.has(id))state.categories.delete(id);else state.categories.add(id);if(state.categories.size===1)$('videoUploadCategory').value=[...state.categories][0];refresh();}
function init(){
 if(!$('videoFilterToggle'))return;
 roster=Object.values(window.FAMILY_DATA.people).filter(person=>!person.placeholder);ready=true;fillPeople();fillFamilies();render();
 $('videoFilterToggle').addEventListener('click',async()=>{
  state.open=!state.open;render();if(!state.open||rosterLoaded)return;
  try{const response=await I.fetch('api/tag-people',{cache:'no-store'});if(response.ok){roster=(await response.json()).people;rosterLoaded=true;fillPeople();}}catch{}
 });
 $('videoPersonSearch').addEventListener('input',fillPeople);
 $('videoSort').addEventListener('change',event=>{if(!VIDEO_SORTS.includes(event.target.value))return;state.sort=event.target.value;if(state.sort==='random')state.seed=Math.floor(Math.random()*0x100000000);refresh();});
 $('videoFilterPanel').addEventListener('change',event=>{
  const input=event.target,id=input.dataset.videoFilterPerson||input.dataset.videoFilterFamily||input.dataset.videoFilterCategory;if(!id)return;
  const selected=input.dataset.videoFilterPerson?state.people:input.dataset.videoFilterFamily?state.families:state.categories;
  if(input.checked)selected.add(id);else selected.delete(id);refresh();
 });
 $('clearVideoFilter').addEventListener('click',()=>{state.people.clear();state.families.clear();state.categories.clear();$('videoPersonSearch').value='';fillPeople();refresh();});
 document.addEventListener('click',event=>{if(state.open&&!event.target.closest('#videoFilterPanel .gallery-filter-field'))for(const field of $('videoFilterPanel').querySelectorAll('details[open]'))field.open=false;});
}
window.FamilyVideoFilter={filter:items=>filterVideos(items,state,window.FAMILY_DATA),render,setCategories,toggleCategory,categories:()=>[...state.categories]};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
