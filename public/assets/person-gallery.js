(() => {
  'use strict';
  const I=window.FamilyI18n,tr=(he,en)=>I.isEnglish?en:he,$=id=>document.getElementById(id);
  const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const ui={},chevron='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
  let helpers;
  const keyState=key=>ui[key]||=( {open:false,expanded:new Set(),search:''} );
  const options=key=>window.FamilyPeople.galleryOptions(key);
  function defaults(){return Object.fromEntries(['photos','videos'].flatMap(key=>[[key+'Size',100],[key+'Sort','random'],[key+'Seed',Math.floor(Math.random()*0x100000000)]]));}
  function pager(key,album){
    // Reuse the gallery's actual controls, including its sort and page-size options.
    const nav=document.querySelector('#galleryView [data-gallery-pager]').cloneNode(true);
    nav.hidden=false;nav.removeAttribute('data-gallery-pager');nav.dataset.personPager=key;
    nav.setAttribute('aria-label',tr('דפדוף באלבום','Album pages'));
    const size=nav.querySelector('[data-gallery-size]');size.removeAttribute('data-gallery-size');size.dataset.personSize=key;for(const option of size.querySelectorAll('option'))option.toggleAttribute('selected',option.value===String(options(key).size));
    size.setAttribute('aria-label',key==='photos'?tr('תמונות בעמוד','Photos per page'):tr('סרטונים בעמוד','Videos per page'));
    nav.querySelector('.gallery-page-size>span>span').textContent=key==='photos'?tr('תמונות','Photos'):tr('סרטונים','Videos');
    const sort=nav.querySelector('[data-gallery-sort]');sort.removeAttribute('data-gallery-sort');sort.dataset.personSort=key;for(const option of sort.querySelectorAll('option'))option.toggleAttribute('selected',option.value===options(key).sort);
    const label=nav.querySelector('[data-gallery-page-label]');label.removeAttribute('data-gallery-page-label');label.dataset.personPageLabel='';
    const first=album.total?(album.page-1)*album.size+1:0,last=Math.min(album.page*album.size,album.total);
    label.textContent=tr('עמוד ','Page ')+album.page+' / '+album.pages+' · '+first+'–'+last+tr(' מתוך ',' of ')+album.total+' '+(key==='photos'?tr('תמונות','photos'):tr('סרטונים','videos'));
    for(const [attribute,step]of [['data-gallery-prev',-1],['data-gallery-next',1]]){
      const button=nav.querySelector('['+attribute+']');button.removeAttribute(attribute);button.dataset.personPage=key;button.dataset.step=step;button.disabled=album.pages<2;
    }
    return nav.outerHTML;
  }
  function panel(key){
    const template=$('galleryFilterPanel').cloneNode(true),prefix='personGallery-'+key+'-';
    template.id=prefix+'panel';template.hidden=!keyState(key).open;template.classList.add('person-gallery-filter');template.dataset.personFilterPanel=key;
    template.setAttribute('aria-label',tr('סינון האלבום האישי','Filter personal album'));
    for(const node of template.querySelectorAll('[id]'))node.id=prefix+node.id;
    for(const node of template.querySelectorAll('[for]'))node.htmlFor=prefix+node.htmlFor;
    for(const node of template.querySelectorAll('details')){node.name=prefix+'choices';node.dataset.personDetails=node.id;node.open=keyState(key).expanded.has(node.id);}
    const search=template.querySelector('input[type=search]');search.setAttribute('value',keyState(key).search);search.dataset.personSearch=key;
    const reset=template.querySelector('.gallery-filter-reset');reset.dataset.personReset=key;reset.hidden=!['person','unit','labels'].some(field=>options(key)[field]);
    return template.outerHTML;
  }
  function controls(key,album){
    const open=keyState(key).open;
    return `<div class="person-gallery-toolbar"><div class="media-grid-header-actions"><button type="button" class="gallery-refine-toggle" data-person-filter-toggle="${key}" aria-controls="personGallery-${key}-panel" aria-expanded="${open}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h18l-7 8v6l-4 2v-8Z"/></svg><span>${tr('סינון','Filter')}</span></button></div></div>${pager(key,album)}${panel(key)}`;
  }
  function checkboxes(host,items,selected,field){
    if(!host)return;
    host.innerHTML=items.map(item=>`<label class="gallery-check-option"><input type="checkbox" data-person-refine="${field}" value="${safe(item.id)}"${selected.has(item.id)?' checked':''}><span>${safe(item.label)}</span></label>`).join('')||`<p class="gallery-filter-empty">${tr('לא נמצאו התאמות','No matches found')}</p>`;
  }
  function fill(key){
    const host=$('personGallery-'+key+'-panel');if(!host||!helpers)return;
    const [family,labels]=helpers,q=options(key),data=window.FAMILY_DATA;
    const selected=field=>new Set((q[field]||'').split(',').filter(Boolean)),people=selected('person'),units=selected('unit'),tags=selected('labels');
    const normalize=value=>String(value||'').normalize('NFKD').replace(/[\u0591-\u05c7'"׳״]/g,'').toLowerCase(),search=normalize(keyState(key).search);
    const roster=window.FamilyPeopleRoster.snapshot().filter(p=>!p.placeholder).filter(p=>people.has(p.id)||!search||normalize(I.searchNames(p)).includes(search)).map(p=>({id:p.id,label:I.personName(p)})).sort((a,b)=>a.label.localeCompare(b.label,I.locale));
    const node=id=>$('personGallery-'+key+'-'+id);
    checkboxes(node('galleryPersonFilter'),roster,people,'person');node('galleryPeopleChoiceCount').textContent=people.size?'('+people.size+')':'';
    for(const generation of [2,3,4]){
      const items=family.familyOptions(data,generation).map(unit=>({id:unit.id,label:family.familyLabel(data,unit,p=>I.personName(p),I.isEnglish)})).sort((a,b)=>a.label.localeCompare(b.label,I.locale));
      checkboxes(node('galleryFamily'+generation),items,units,'unit');const count=items.filter(item=>units.has(item.id)).length;node('galleryFamily'+generation+'ChoiceCount').textContent=count?'('+count+')':'';
    }
    checkboxes(node('galleryLabelFilter'),labels.photoLabelOptions([...tags]).map(label=>({id:label.id,label:labels.photoLabelName(label,I.isEnglish)})),tags,'labels');node('galleryLabelChoiceCount').textContent=tags.size?'('+tags.size+')':'';
  }
  async function prepareFilters(){
    helpers||=await Promise.all([import('./gallery-family.mjs?v=2'),import('./photo-labels-catalog.mjs?v=2')]);
    await Promise.allSettled([window.FamilyPeopleRoster.load(),helpers[1].loadPhotoLabelCatalog()]);
    for(const key of ['photos','videos'])if(keyState(key).open)fill(key);
  }
  function preserve(root,html){
    const grids=new Map([...root.querySelectorAll('[data-person-grid]')].map(grid=>[grid.dataset.personOwner+':'+grid.dataset.personGrid,grid]));
    const active=document.activeElement,focus=active?.dataset.personSearch,selection=focus?[active.selectionStart,active.selectionEnd]:null;
    root.innerHTML=html;
    for(const next of root.querySelectorAll('[data-person-grid]')){
      const grid=grids.get(next.dataset.personOwner+':'+next.dataset.personGrid);if(!grid)continue;
      const old=new Map([...grid.children].map(card=>[card.dataset.personCard,card]));
      const cards=[...next.children].map(card=>{const previous=old.get(card.dataset.personCard);return previous?.dataset.personVersion===card.dataset.personVersion?previous:card;});
      grid.replaceChildren(...cards);next.replaceWith(grid);
    }
    for(const key of ['photos','videos'])if(keyState(key).open)fill(key);
    if(focus){const input=root.querySelector('[data-person-search="'+focus+'"]');if(input){input.focus({preventScroll:true});if(selection)input.setSelectionRange?.(...selection);}}
    window.FamilyVideoPreviews?.watch(root);window.FamilyMediaSelection?.refresh();
  }
  function init(){
    const root=$('personPageContent');
    root.addEventListener('click',event=>{
      const toggle=event.target.closest('[data-person-filter-toggle]');if(toggle){const key=toggle.dataset.personFilterToggle;keyState(key).open=!keyState(key).open;window.FamilyPeople.render();if(keyState(key).open)prepareFilters().catch(error=>window.FamilyApp.toast(error.message));}
      const reset=event.target.closest('[data-person-reset]');if(reset)window.FamilyPeople.refineAlbum(reset.dataset.personReset,{person:'',unit:'',labels:''});
    });
    root.addEventListener('input',event=>{const key=event.target.dataset.personSearch;if(key){keyState(key).search=event.target.value;fill(key);}});
    root.addEventListener('toggle',event=>{const details=event.target;if(!details.dataset.personDetails)return;const key=details.closest('[data-person-filter-panel]').dataset.personFilterPanel;keyState(key).expanded[details.open?'add':'delete'](details.id);},true);
    root.addEventListener('change',event=>{
      const node=event.target,key=node.dataset.personSize||node.dataset.personSort;
      if(key){const change=node.dataset.personSize?{size:node.value}:{sort:node.value,...(node.value==='random'?{seed:Math.floor(Math.random()*0x100000000)}:{})};window.FamilyPeople.refineAlbum(key,change);return;}
      const field=node.dataset.personRefine;if(!field)return;
      const album=node.closest('[data-person-filter-panel]').dataset.personFilterPanel,selected=new Set((options(album)[field]||'').split(',').filter(Boolean));selected[node.checked?'add':'delete'](node.value);window.FamilyPeople.refineAlbum(album,{[field]:[...selected].sort().join(',')});
    });
    window.FamilyPeopleRoster?.subscribe(()=>{for(const key of ['photos','videos'])if(keyState(key).open)fill(key);});
    window.addEventListener('family-photo-label-catalog',()=>{for(const key of ['photos','videos'])if(keyState(key).open)fill(key);});
  }
  window.FamilyPersonGallery={defaults,controls,pager,preserve,reset:()=>{for(const key of Object.keys(ui))delete ui[key];}};
  document.addEventListener('DOMContentLoaded',init);
})();
