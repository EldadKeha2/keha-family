(() => {
  'use strict';
  const $=id=>document.getElementById(id),app=()=>window.FamilyApp;
  const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normalize=value=>String(value).normalize('NFKD').replace(/[\u0591-\u05c7'"׳״]/g,'').replace(/\s+/g,' ').toLowerCase().trim();
  const state={id:null,item:null,roster:[],selected:new Map(),revision:null,loading:false,saving:false,serial:0,newCount:0};
  function taggable(item){return Boolean(item.id)&&['photo','video'].includes(item.kind);}
  function controls(item){return taggable(item)?`<button class="media-tag-button" data-edit-media-tags="${safe(item.id)}">${item.tags?.length?'תיוג אנשים ('+item.tags.length+')':'＋ תיוג אנשים'}</button>`:'';}
  function labels(item){return `<div class="media-people-tags" data-media-tags-for="${safe(item.id)}">${(item.tags||[]).map(person=>`<button data-open-tag-person="${safe(person.id)}" aria-label="פתיחת האלבום של ${safe(person.name)}">${safe(person.name)}</button>`).join('')}</div>`;}
  function refresh(root,items){
    const byId=new Map(items.map(item=>[item.id,item]));
    for(const row of root.querySelectorAll('[data-media-tags-for]')){
      const item=byId.get(row.dataset.mediaTagsFor);if(!item)continue;
      const signature=JSON.stringify(item.tags||[]);if(row.dataset.signature===signature)continue;
      row.innerHTML=(item.tags||[]).map(person=>`<button data-open-tag-person="${safe(person.id)}" aria-label="פתיחת האלבום של ${safe(person.name)}">${safe(person.name)}</button>`).join('');row.dataset.signature=signature;
    }
    for(const button of root.querySelectorAll('[data-edit-media-tags]')){const item=byId.get(button.dataset.editMediaTags);if(item)button.textContent=item.tags?.length?'תיוג אנשים ('+item.tags.length+')':'＋ תיוג אנשים';}
  }
  async function request(path,options={}){
    const response=await fetch(path,{cache:'no-store',...options,headers:{...(options.body?{'Content-Type':'application/json','X-Family-Token':window.FAMILY_API_TOKEN}:{}),...options.headers}});
    let result;try{result=await response.json();}catch{throw Error('לא התקבלה תשובה מהשרת. נסו שוב.');}
    if(!response.ok)throw Error(result.error||'התיוגים לא נשמרו.');return result;
  }
  function selected(){
    $('selectedPeople').innerHTML=[...state.selected].map(([key,person])=>`<button type="button" class="selected-person-tag" data-remove-person-tag="${safe(key)}" aria-label="הסרת התיוג של ${safe(person.name)}">${safe(person.name)}${person.isNew?'<small>שם חדש</small>':''}<span aria-hidden="true">×</span></button>`).join('')||'<span class="tag-selection-empty">בחרו את האנשים שמופיעים כאן.</span>';
    $('tagSelectedCount').textContent=state.selected.size===1?'אדם אחד נבחר':state.selected.size+' אנשים נבחרו';
  }
  function renderResults(){
    const query=normalize($('tagPersonSearch').value),matches=state.roster.filter(person=>!query||normalize(person.name).includes(query));
    const names=matches.slice(0,150);
    $('tagPeopleResults').innerHTML=names.map(person=>{
      const branch=person.extra?'שם נוסף באלבומים':window.FAMILY_DATA.branches.find(branch=>branch.id===person.branch)?.title||'השורשים של כולנו';
      return `<label class="tag-person-option"><input type="checkbox" data-tag-person="${safe(person.id)}" ${state.selected.has(person.id)?'checked':''}><span><strong>${safe(person.name)}</strong><small>${safe(branch)}</small></span></label>`;
    }).join('')||'<p class="tag-no-results">לא נמצא שם מתאים. אפשר להוסיף אותו למטה.</p>';
    $('tagSearchCount').textContent=matches.length>150?`מוצגים 150 מתוך ${matches.length}. חפשו לפי שם לצמצום הרשימה.`:`${matches.length} שמות ברשימה`;
    const value=$('tagPersonSearch').value.trim().replace(/\s+/g,' '),exists=state.roster.some(person=>normalize(person.name)===query)||[...state.selected.values()].some(person=>normalize(person.name)===query);
    $('addTagPerson').hidden=!query||exists||matches.length>0||state.loading;
    $('addTagPerson').textContent='＋ הוספת השם ״'+value+'״';
  }
  function choose(id,checked){
    const person=state.roster.find(person=>person.id===id);if(!person)return;
    if(checked&&state.selected.size>=150){$('tagPeopleError').textContent='אפשר לתייג עד 150 אנשים בפריט.';renderResults();return;}
    if(checked)state.selected.set(id,person);else state.selected.delete(id);selected();
  }
  function addName(){
    const name=$('tagPersonSearch').value.trim().replace(/\s+/g,' ');
    if(!normalize(name)||name.length>120){$('tagPeopleError').textContent='יש להזין שם עד 120 תווים.';return;}
    const match=state.roster.filter(person=>normalize(person.name)===normalize(name));
    if(match.length===1)choose(match[0].id,true);
    else if(![...state.selected.values()].some(person=>normalize(person.name)===normalize(name))){
      if(state.selected.size>=150){$('tagPeopleError').textContent='אפשר לתייג עד 150 אנשים בפריט.';return;}
      state.selected.set('new:'+state.newCount++,{name,isNew:true});selected();
    }
    $('tagPersonSearch').value='';renderResults();$('tagPersonSearch').focus();
  }
  async function load(){
    const serial=++state.serial,id=state.id;state.loading=true;state.revision=null;state.selected.clear();
    $('savePeopleTags').disabled=true;$('tagPeopleError').textContent='';$('tagPeopleStatus').textContent='טוען את התיוגים ורשימת האנשים…';$('tagRetry').hidden=true;$('tagPersonSearch').disabled=true;$('addTagPerson').hidden=true;$('tagPeopleResults').replaceChildren();selected();
    try{
      const [roster,data]=await Promise.all([request('api/tag-people'),request('api/media/'+id+'/tags')]);
      if(serial!==state.serial||!$('tagPeopleDialog').open)return;
      state.roster=roster.people.sort((a,b)=>a.name.localeCompare(b.name,'he'));state.item=data.item;state.revision=data.item.tagsRevision;
      const byId=new Map(state.roster.map(person=>[person.id,person]));for(const person of data.item.tags)state.selected.set(person.id,byId.get(person.id)||person);
      $('tagMediaName').textContent=data.item.name;$('tagPeopleStatus').textContent='לאחר השמירה, הפריט יופיע אוטומטית באלבומים האישיים של המתויגים.';
      $('tagPersonSearch').disabled=false;$('savePeopleTags').disabled=false;state.loading=false;selected();renderResults();$('tagPersonSearch').focus();
    }catch(error){if(serial===state.serial){$('tagPeopleError').textContent=error.message;$('tagPeopleStatus').textContent='';$('tagRetry').hidden=false;}}
    finally{if(serial===state.serial)state.loading=false;}
  }
  function open(id){
    if(!app()?.apiEnabled){app()?.toast('השמירה אינה זמינה כרגע. נסו לרענן.');return;}
    state.id=id;$('tagPersonSearch').value='';$('tagMediaName').textContent='';$('tagPeopleDialog').showModal();load();
  }
  async function save(event){
    event.preventDefault();if(state.loading||state.saving||state.revision===null)return;
    state.saving=true;$('savePeopleTags').disabled=true;$('closePeopleTags').disabled=true;$('cancelPeopleTags').disabled=true;$('tagPeopleError').textContent='';
    const people=[...state.selected.values()];
    try{
      const result=await request('api/media/'+state.id+'/tags',{method:'POST',body:JSON.stringify({personIds:people.filter(person=>!person.isNew).map(person=>person.id),newNames:people.filter(person=>person.isNew).map(person=>person.name),expectedRevision:state.revision})});
      window.dispatchEvent(new CustomEvent('family-media-changed',{detail:result}));$('tagPeopleDialog').close();
      window.FamilyMedia.notify('התיוגים נשמרו והאלבומים האישיים עודכנו ✓');
    }catch(error){$('tagPeopleError').textContent=error.message;$('tagRetry').hidden=false;}
    finally{state.saving=false;$('savePeopleTags').disabled=false;$('closePeopleTags').disabled=false;$('cancelPeopleTags').disabled=false;}
  }
  function init(){
    document.addEventListener('click',async event=>{
      const edit=event.target.closest('[data-edit-media-tags]');if(edit){open(edit.dataset.editMediaTags);return;}
      const remove=event.target.closest('[data-remove-person-tag]');if(remove){state.selected.delete(remove.dataset.removePersonTag);selected();renderResults();return;}
      const person=event.target.closest('[data-open-tag-person]');if(person){
        const id=person.dataset.openTagPerson;
        try{if(!app().getPerson(id)){const snapshot=await request('api/people/'+encodeURIComponent(id));app().updatePerson(id,snapshot);}if($('mediaViewer').open)$('mediaViewer').close();app().openPerson(id);}
        catch(error){window.FamilyMedia.notify(error.message);}
      }
    });
    $('tagPersonSearch').addEventListener('input',renderResults);
    $('tagPersonSearch').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();if(!$('addTagPerson').hidden)addName();else{const exact=state.roster.filter(person=>normalize(person.name)===normalize($('tagPersonSearch').value));if(exact.length===1){choose(exact[0].id,true);renderResults();}}}});
    $('tagPeopleResults').addEventListener('change',event=>{if(event.target.matches('[data-tag-person]'))choose(event.target.dataset.tagPerson,event.target.checked);});
    $('addTagPerson').addEventListener('click',addName);$('tagPeopleForm').addEventListener('submit',save);$('tagRetry').addEventListener('click',load);
    for(const id of ['closePeopleTags','cancelPeopleTags'])$(id).addEventListener('click',()=>$('tagPeopleDialog').close());
    $('tagPeopleDialog').addEventListener('cancel',event=>{if(state.saving)event.preventDefault();});
    $('tagPeopleDialog').addEventListener('close',()=>{state.serial++;});
  }
  window.FamilyTags={controls,labels,refresh,open,taggable};
  document.addEventListener('DOMContentLoaded',init);
})();
