(() => {
  'use strict';
  const I=window.FamilyI18n,tr=(he,en)=>I.isEnglish?en:he;
  const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const items=new Map(),pending=new Set();
  const icons={
    family:'<circle cx="6" cy="7" r="3"/><circle cx="18" cy="7" r="3"/><circle cx="12" cy="13" r="2.5"/><path d="M1 20v-4a5 5 0 0 1 7-4m15 8v-4a5 5 0 0 0-7-4M7 22v-2a5 5 0 0 1 10 0v2"/>',
    baby:'<circle cx="12" cy="12" r="8"/><path d="M10 4c0 3 4 2 3 0M8 11h.01M16 11h.01M9 15c2 2 4 2 6 0M4 10c-3 0-3 5 0 5m16-5c3 0 3 5 0 5"/>',
    wedding:'<circle cx="9" cy="14" r="6"/><circle cx="16" cy="14" r="5"/><path d="m6 6 3-4 3 4-3 3Z"/>'
  };
  function targets(scope,viewer=false){
    const id=scope?.startsWith('personal:')?scope.slice(9):null;
    const family=window.FAMILY_DATA,person=id&&(window.FamilyApp?.getPerson?.(id)||family?.people?.[id]);
    const pair=id&&Object.values(family?.units||{}).find(unit=>unit.people?.length===2&&unit.people.includes(id));
    return [...(viewer?[{icon:'family',collection:'photos',label:tr('תמונות משפחתיות','Family photos')}]:[]),...(id?[
      {icon:'baby',collection:person&&!person.extended&&!person.extra?'nursery:'+id:null,label:tr('אלבום התינוקייה','Baby album')},
      {icon:'wedding',collection:pair?'wedding:'+pair.id:null,label:tr('אלבום החתונה','Wedding album')}
    ]:[])];
  }
  function remember(item,change=null){
    const previous=items.get(item.id),collections=new Set([...(previous?.collections||[]),...(item.collections||[item.scope])]);
    const familyPhoto=change?.scope==='photos'&&typeof change.included==='boolean'?change.included:previous?.familyPhoto??collections.has('photos');
    if(familyPhoto)collections.add('photos');else collections.delete('photos');
    items.set(item.id,{...item,collections:[...collections],familyPhoto});
    if(items.size>512)items.delete(items.keys().next().value);
  }
  function buttons(item,scope,viewer=false){
    const memberships=items.get(item.id)?.collections||item.collections||[item.scope];
    return targets(scope,viewer).map(target=>{
      const active=memberships.includes(target.collection),busy=pending.has(item.id+':'+target.collection);
      const family=target.collection==='photos';
      const label=target.collection?(active?(family?tr('הסרה מ','Remove from '):tr('מופיע ב','Included in ')):tr('הוספה ל','Add to '))+target.label:tr('אין לאדם זה אלבום מתאים: ','No album is available for this person: ')+target.label;
      return `<button type="button" class="photo-collection-button${family?' photo-collection-family':''}${active?' is-linked':''}" data-photo-collection="${safe(target.collection||'')}" aria-label="${safe(label)}" title="${safe(label)}" aria-pressed="${active}" ${busy?'aria-busy="true" ':''}${!target.collection||busy?'disabled':''}><svg viewBox="0 0 24 24" aria-hidden="true">${icons[target.icon]}</svg>${family?`<span class="photo-collection-name">${target.label}</span>`:''}</button>`;
    }).join('');
  }
  function controls(item,scope,{viewer=false}={}){
    if(item.kind!=='photo'||!item.id||(!viewer&&!scope?.startsWith('personal:')))return '';
    remember(item);
    return `<div class="photo-collections" data-collection-photo="${safe(item.id)}" data-collection-scope="${safe(scope)}"${viewer?' data-collection-viewer="true"':''} role="group" aria-label="${tr('אלבומי התמונה','Photo albums')}">${buttons(item,scope,viewer)}</div>`;
  }
  function refresh(){
    for(const group of document.querySelectorAll('[data-collection-photo]')){
      const item=items.get(group.dataset.collectionPhoto);if(item)group.innerHTML=buttons(item,group.dataset.collectionScope,group.dataset.collectionViewer==='true');
    }
  }
  async function add(button){
    const group=button.closest('[data-collection-photo]'),id=group?.dataset.collectionPhoto,collection=button.dataset.photoCollection,scope=group?.dataset.collectionScope;
    const active=button.getAttribute('aria-pressed')==='true';
    if(!id||!collection||button.disabled||(active&&collection!=='photos'))return;
    if(!window.FamilyApp?.apiEnabled){window.FamilyApp?.toast(tr('השמירה אינה זמינה כרגע. נסו לרענן.','Saving is currently unavailable. Please refresh.'));return;}
    const key=id+':'+collection;if(pending.has(key))return;pending.add(key);button.disabled=true;button.setAttribute('aria-busy','true');
    try{
      const response=await I.fetch('api/media/'+id+'/collections',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json','X-Family-Token':window.FAMILY_API_TOKEN},body:JSON.stringify({collection,scope,...(collection==='photos'?{included:!active}:{})})});
      const result=await response.json();if(!response.ok)throw Error(I.error(result.error));
      window.dispatchEvent(new CustomEvent('family-media-changed',{detail:result}));
      window.FamilyApp.toast(collection==='photos'&&active?tr('התמונה הוסרה מתמונות משפחתיות ✓','Photo removed from Family photos ✓'):tr('התמונה נוספה לאלבום ✓','Photo added to the album ✓'));
    }catch(error){window.FamilyApp?.toast(error.message||tr('השינוי לא נשמר. נסו שוב.','The change was not saved. Please try again.'));}
    finally{pending.delete(key);button.disabled=false;button.removeAttribute('aria-busy');refresh();}
  }
  window.addEventListener('family-media-changed',event=>{const item=event.detail.item;if(item){remember(item,event.detail.operation==='collection'?event.detail:null);refresh();}});
  document.addEventListener('click',event=>{const button=event.target.closest('[data-photo-collection]');if(button){event.preventDefault();event.stopPropagation();add(button);}});
  window.FamilyPhotoCollections={controls};
})();
