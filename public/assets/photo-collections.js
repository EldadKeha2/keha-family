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
  const personName=id=>window.FamilyApp?.nameOf?.(id)||I.personName?.(window.FAMILY_DATA?.people?.[id])||window.FAMILY_DATA?.people?.[id]?.name||id;
  function targets(scope,viewer=false,desktop=false){
    if(viewer&&desktop&&!scope?.startsWith('personal:')){
      const family={icon:'family',collection:'photos',label:tr('תמונות משפחתיות','Family photos')};
      if(scope?.startsWith('nursery:'))return [family,{icon:'baby',collection:scope,removeOnly:true,label:tr('אלבום התינוקייה של ','Baby album for ')+personName(scope.slice(8))}];
      if(scope?.startsWith('wedding:')){
        const pair=Object.values(window.FAMILY_DATA?.units||{}).find(unit=>unit.id===scope.slice(8));
        return [family,{icon:'wedding',collection:scope,removeOnly:true,label:tr('אלבום החתונה של ','Wedding album for ')+(pair?pairName(pair):scope.slice(8))}];
      }
      return [family];
    }
    const id=scope?.startsWith('personal:')?scope.slice(9):null;
    const family=window.FAMILY_DATA,person=id&&(window.FamilyApp?.getPerson?.(id)||family?.people?.[id]);
    const pair=id&&Object.values(family?.units||{}).find(unit=>unit.people?.length===2&&unit.people.includes(id));
    return [...(viewer?[{icon:'family',collection:'photos',label:tr('תמונות משפחתיות','Family photos')}]:[]),...(id?[
      {icon:'baby',collection:person&&!person.extended&&!person.extra?'nursery:'+id:null,label:tr('אלבום התינוקייה של ','Baby album for ')+personName(id)},
      {icon:'wedding',collection:pair&&pair.hasWedding!==false?'wedding:'+pair.id:null,label:pair?tr('אלבום החתונה של ','Wedding album for ')+pairName(pair):tr('אלבום החתונה של ','Wedding album for ')+personName(id)}
    ]:[])];
  }
  function remember(item,change=null){
    const previous=items.get(item.id),collections=new Set([...(previous?.collections||[]),...(item.collections||[item.scope])]),confirmed=new Map(previous?.confirmed||[]);
    if(change?.scope&&typeof change.included==='boolean')confirmed.set(change.scope,change.included);
    for(const [kind,included]of confirmed)if(included)collections.add(kind);else collections.delete(kind);
    items.set(item.id,{...item,collections:[...collections],confirmed});
    if(items.size>512)items.delete(items.keys().next().value);
  }
  function weddingTargets(scope){
    const context=scope?.replace(/^link:/,''),family=window.FAMILY_DATA;
    const owner=context?.startsWith('personal:')?context.slice(9):context?.startsWith('nursery:')?context.slice(8):null;
    const wedding=context?.startsWith('wedding:')?context.slice(8):null;
    if(!owner&&!wedding)return [];
    return Object.values(family?.units||{}).filter(pair=>pair.people?.length===2&&pair.hasWedding!==false&&(owner?pair.people.includes(owner):pair.id===wedding));
  }
  const pairName=pair=>pair.people.map(personName).join(tr(' ו',' & '));
  function weddingLink(pair,withName=false){const label=tr('עמוד החתונה של ','Wedding page for ')+pairName(pair);return `<a class="photo-collection-button" data-photo-wedding-link href="#weddings/${encodeURIComponent(pair.id)}" data-photo-album-kind="wedding" aria-label="${safe(label)}" title="${safe(label)}"><svg viewBox="0 0 24 24" aria-hidden="true">${icons.wedding}</svg>${withName?`<span>${safe(pairName(pair))}</span>`:''}</a>`;}
  function weddingControl(item,scope){
    const pairs=weddingTargets(scope);
    if(!pairs.length){
      const context=scope?.replace(/^link:/,''),owner=context?.match(/^(?:personal|nursery):(.+)$/)?.[1];
      if(!owner)return '';
      const label=tr('אין אלבום חתונה זמין עבור ','No wedding album is available for ')+personName(owner);
      return `<button type="button" class="photo-collection-button" data-photo-album-kind="wedding" disabled aria-label="${safe(label)}" title="${safe(label)}"><svg viewBox="0 0 24 24" aria-hidden="true">${icons.wedding}</svg></button>`;
    }
    if(pairs.length===1)return weddingLink(pairs[0]);
    const label=tr('עמודי החתונות של המתויגים בתמונה','Wedding pages for people in this photo');
    return `<button type="button" class="photo-collection-button" data-photo-wedding-choices data-photo-album-kind="wedding" aria-haspopup="dialog" aria-label="${label}" title="${label}"><svg viewBox="0 0 24 24" aria-hidden="true">${icons.wedding}</svg></button>`;
  }
  function buttons(item,scope,viewer=false,desktop=false){
    const memberships=items.get(item.id)?.collections||item.collections||[item.scope];
    return targets(scope,viewer,desktop).filter(target=>!viewer||target.icon!=='wedding'||desktop&&target.removeOnly).map(target=>{
      const active=memberships.includes(target.collection),busy=pending.has(item.id+':'+target.collection);
      const family=target.collection==='photos';
      const label=target.collection?(active?tr('הסרה מ','Remove from '):target.removeOnly?tr('התמונה הוסרה מ','Photo removed from '):tr('הוספה ל','Add to '))+target.label:tr('אין לאדם זה אלבום מתאים: ','No album is available for this person: ')+target.label;
      return `<button type="button" class="photo-collection-button${family?' photo-collection-family':''}${active?' is-linked':''}" data-photo-collection="${safe(target.collection||'')}" data-photo-album-kind="${target.icon}" aria-label="${safe(label)}" title="${safe(label)}" aria-pressed="${active}" ${busy?'aria-busy="true" ':''}${!target.collection||busy||target.removeOnly&&!active?'disabled':''}><svg viewBox="0 0 24 24" aria-hidden="true">${icons[target.icon]}</svg>${family?`<span class="photo-collection-name">${target.label}</span>`:''}</button>`;
    }).join('')+(viewer&&(!desktop||scope?.startsWith('personal:'))?weddingControl(item,scope):'');
  }
  function controls(item,scope,{viewer=false}={}){
    if(item.kind!=='photo'||!item.id||(!viewer&&!scope?.startsWith('personal:')))return '';
    remember(item);
    return `<div class="photo-collections" data-collection-photo="${safe(item.id)}" data-collection-scope="${safe(scope)}"${viewer?' data-collection-viewer="true"':''} role="group" aria-label="${tr('אלבומי התמונה','Photo albums')}">${buttons(item,scope,viewer)}</div>`;
  }
  function renderGroup(group,item){
    const markup=buttons(item,group.dataset.collectionScope,group.dataset.collectionViewer==='true',group.dataset.collectionDesktop==='true');
    if(group.dataset.collectionDesktop!=='true'||!group.firstElementChild){group.innerHTML=markup;return;}
    // Membership changes update the existing button and SVG in the desktop
    // rail. Replacing their markup restarts painting and flashes the icons.
    const template=document.createElement('div');template.innerHTML=markup;
    const key=node=>node.tagName+':'+node.dataset.photoAlbumKind;
    const existing=new Map([...group.children].map(node=>[key(node),node]));let index=0;
    for(const next of [...template.children]){
      const button=existing.get(key(next))||next;existing.delete(key(next));
      if(button!==next){
        for(const name of button.getAttributeNames())if(!next.hasAttribute(name))button.removeAttribute(name);
        for(const name of next.getAttributeNames())if(button.getAttribute(name)!==next.getAttribute(name))button.setAttribute(name,next.getAttribute(name));
        const label=button.querySelector('.photo-collection-name');if(label)label.textContent=next.querySelector('.photo-collection-name')?.textContent||'';
      }
      if(group.children[index]!==button)group.insertBefore(button,group.children[index]||null);index++;
    }
    for(const node of existing.values())node.remove();
  }
  function mountViewer(host,item,scope){
    const desktop=document.getElementById('mediaViewer')?.classList.contains('personal-photo-desktop');
    if(!desktop||item.kind!=='photo'||!item.id){host.innerHTML=controls(item,scope,{viewer:true});return;}
    remember(item);
    if(!host.firstElementChild)host.innerHTML=controls(item,scope,{viewer:true});
    const group=host.firstElementChild;
    group.dataset.collectionPhoto=item.id;group.dataset.collectionScope=scope;group.dataset.collectionViewer='true';group.dataset.collectionDesktop='true';
    group.setAttribute('aria-label',tr('אלבומי התמונה','Photo albums'));renderGroup(group,item);
  }
  function refresh(){
    for(const group of document.querySelectorAll('[data-collection-photo]')){
      const item=items.get(group.dataset.collectionPhoto);if(item)renderGroup(group,item);
    }
    window.FamilyPhotoViewerLayout?.sync();
  }
  async function add(button){
    const group=button.closest('[data-collection-photo]'),id=group?.dataset.collectionPhoto,collection=button.dataset.photoCollection,scope=group?.dataset.collectionScope;
    const active=button.getAttribute('aria-pressed')==='true';
    if(!id||!collection||button.disabled)return;
    if(!window.FamilyApp?.apiEnabled){window.FamilyApp?.toast(tr('השמירה אינה זמינה כרגע. נסו לרענן.','Saving is currently unavailable. Please refresh.'));return;}
    const key=id+':'+collection;if(pending.has(key))return;pending.add(key);button.disabled=true;button.setAttribute('aria-busy','true');
    try{
      const response=await I.fetch('api/media/'+id+'/collections',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json','X-Family-Token':window.FAMILY_API_TOKEN},body:JSON.stringify({collection,scope,included:!active})});
      const result=await response.json();if(!response.ok)throw Error(I.error(result.error));
      window.dispatchEvent(new CustomEvent('family-media-changed',{detail:result}));
      window.FamilyApp.toast(active?tr('התמונה הוסרה מהאלבום ✓','Photo removed from the album ✓'):tr('התמונה נוספה לאלבום ✓','Photo added to the album ✓'));
    }catch(error){window.FamilyApp?.toast(error.message||tr('השינוי לא נשמר. נסו שוב.','The change was not saved. Please try again.'));}
    finally{pending.delete(key);button.disabled=false;button.removeAttribute('aria-busy');refresh();}
  }
  window.addEventListener('family-media-changed',event=>{const item=event.detail.item;if(item){remember(item,event.detail.operation==='collection'?event.detail:null);refresh();}});
  document.addEventListener('click',event=>{
    const link=event.target.closest('[data-photo-wedding-link]');if(link&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&!event.altKey){document.getElementById('photoWeddingChoices')?.close();document.getElementById('mediaViewer')?.close();return;}
    if(event.target.closest('[data-close-photo-weddings]')){document.getElementById('photoWeddingChoices')?.close();return;}
    const choices=event.target.closest('[data-photo-wedding-choices]');if(choices){
      event.preventDefault();const group=choices.closest('[data-collection-photo]'),item=items.get(group?.dataset.collectionPhoto);if(!item)return;
      let dialog=document.getElementById('photoWeddingChoices');if(!dialog){dialog=document.createElement('dialog');dialog.id='photoWeddingChoices';dialog.className='portal-dialog';dialog.setAttribute('aria-labelledby','photoWeddingChoicesTitle');document.body.append(dialog);}
      dialog.innerHTML=`<button type="button" class="dialog-close" data-close-photo-weddings aria-label="${tr('סגירה','Close')}">×</button><h2 id="photoWeddingChoicesTitle">${tr('לאיזה עמוד חתונה לעבור?','Choose a wedding page')}</h2><div class="photo-wedding-options">${weddingTargets(group.dataset.collectionScope).map(pair=>weddingLink(pair,true)).join('')}</div>`;dialog.showModal();return;
    }
    const button=event.target.closest('[data-photo-collection]');if(button){event.preventDefault();event.stopPropagation();add(button);}
  });
  function setViewerDesktop(enabled){
    const value=String(enabled===true);
    for(const group of document.querySelectorAll('[data-collection-photo]')){
      if(group.dataset.collectionViewer!=='true'||group.dataset.collectionDesktop===value)continue;
      group.dataset.collectionDesktop=value;
      const item=items.get(group.dataset.collectionPhoto);if(item)renderGroup(group,item);
    }
  }
  window.FamilyPhotoCollections={controls,mountViewer,setViewerDesktop};
})();
