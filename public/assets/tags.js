(() => {
  'use strict';
  const I18n=window.FamilyI18n;
  const $=id=>document.getElementById(id),app=()=>window.FamilyApp;
  const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normalize=value=>String(value).normalize('NFKD').replace(/[\u0591-\u05c7'"׳״]/g,'').replace(/\s+/g,' ').toLowerCase().trim();
  function matchRank(person,query){
    if(!query)return 5;
    const canonical=window.FAMILY_DATA.people[person.id],aliases=[person.name,person.nameEn,canonical?.name,canonical?.nameEn].filter(Boolean).map(normalize),words=query.split(' ');
    if(aliases.some(name=>name===query))return 0;
    if(aliases.some(name=>name.split(' ').includes(query)))return 1;
    if(aliases.some(name=>name.startsWith(query)))return 2;
    if(aliases.some(name=>words.every(word=>name.split(' ').some(part=>part.startsWith(word)))))return 3;
    return aliases.some(name=>name.includes(query))?4:Infinity;
  }
  function personContext(person){
    const data=window.FAMILY_DATA,p=data.people[person.id],unit=data.units?.[p?.unit],parent=unit?.people?.[0]===person.id?data.units[unit.parent]:null;
    const name=id=>I18n.personName(data.people[id]),branch=I18n.branchName(data.branches.find(b=>b.id===person.branch));
    if(parent)return [branch,(I18n.isEnglish?'Parents: ':'הורים: ')+parent.people.map(name).join(' / ')].filter(Boolean).join(' · ');
    const partner=unit?.people?.find(id=>id!==person.id);if(partner)return [branch,(I18n.isEnglish?'Partner: ':'בן/בת זוג: ')+name(partner)].filter(Boolean).join(' · ');
    if(p?.parents?.length)return (I18n.isEnglish?'Parents: ':'הורים: ')+p.parents.map(name).join(' / ');
    if(p?.siblings?.length)return (I18n.isEnglish?'Sibling of ':'אח/אחות של ')+p.siblings.map(name).join(' / ');
    return person.extra?I18n.t('שם נוסף באלבומים'):branch||I18n.t('השורשים של כולנו');
  }
  const stores=new Map(),roster=new Map();let rosterPromise=null,rosterTime=0,rosterFetched=false,rosterVersion=0,modalWidget=null,modalStore=null,closeRequested=false,newCounter=0;
  async function request(path,options={}){
    const response=await I18n.fetch(path,{cache:'no-store',...options,headers:{...(options.body?{'Content-Type':'application/json','X-Family-Token':window.FAMILY_API_TOKEN}:{}),...options.headers}});
    let result;try{result=await response.json();}catch{throw Error(I18n.t('לא התקבלה תשובה מהשרת. נסו שוב.'));}
    if(!response.ok)throw Error(I18n.error(result.error)||I18n.t('התיוג לא נשמר.'));return result;
  }
  function addPerson(person){if(!person?.id)return;const old=roster.get(person.id);roster.set(person.id,{...old,...person});rosterVersion++;}
  async function loadRoster(force=false){
    if(rosterPromise)return rosterPromise;if(!force&&roster.size&&Date.now()-rosterTime<300000)return;
    rosterPromise=request('api/tag-people').then(result=>{result.people.forEach(addPerson);rosterTime=Date.now();rosterFetched=true;}).finally(()=>{rosterPromise=null;});return rosterPromise;
  }
  class TagStore {
    constructor(id,item){this.id=id;this.item=item||{id,tags:[]};this.saved=new Map((item?.tags||[]).map(person=>[person.id,person]));this.queue=[];this.active=[];this.aliases=new Map();this.listeners=new Set();this.error='';this.status='';this.ready=Boolean(item?.tags&&item.tagsRevision);this.timer=null;this.loading=null;this.refreshPending=false;}
    get busy(){return Boolean(this.active.length||this.queue.length);}
    selected(){
      let selected=new Map(this.saved);
      for(const op of [...this.active,...this.queue]){
        const key=this.aliases.get(op.key)||op.key;
        if(op.tagged){
          const person={...roster.get(key),id:key,name:op.name,isNew:key.startsWith('new:')};
          if(selected.has(key))selected.set(key,person);else selected=new Map([[key,person],...selected]);
        }else selected.delete(key);
      }
      return selected;
    }
    emit(){for(const listener of this.listeners)listener();if(closeRequested&&modalStore===this&&!this.busy&&!this.error)closeModal();}
    async load(){
      if(this.loading)return this.loading;
      if(this.ready){try{await loadRoster();this.error='';}catch(error){this.error=error.message;this.status='error';}this.emit();return;}
      this.status='loading';this.emit();
      try{const [,result]=await Promise.all([loadRoster(),request('api/media/'+this.id+'/tags')]);if(!this.busy){this.item=result.item;this.saved=new Map(result.item.tags.map(person=>[person.id,person]));}this.ready=true;this.status='';this.error='';this.emit();this.run();}
      catch(error){this.error=error.message;this.status='error';this.emit();}
    }
    enqueue(person,tagged){
      const selected=this.selected();if(tagged&&!selected.has(person.id)&&selected.size>=150){this.error=I18n.t('אפשר לתייג עד 150 אנשים בפריט.');this.emit();return;}
      if(!tagged&&person.id.startsWith('new:')&&!this.aliases.has(person.id)&&!this.active.some(op=>op.key===person.id)){this.queue=this.queue.filter(op=>op.key!==person.id);this.error='';this.status=this.queue.length?'saving':'';this.emit();return;}
      this.queue=this.queue.filter(op=>op.key!==person.id);this.queue.push({key:person.id,name:person.name,tagged});this.error='';this.status='saving';this.emit();this.schedule();
    }
    schedule(){clearTimeout(this.timer);this.timer=setTimeout(()=>this.run(),650);}
    async run(){
      clearTimeout(this.timer);
      if(this.active.length||this.error||!this.ready||!this.queue.length)return;
      const batch=this.queue.splice(0);this.active=batch;this.status='saving';this.emit();
      try{
        const changes=batch.map(op=>{const key=this.aliases.get(op.key)||op.key;return {key:op.key,tagged:op.tagged,...(key.startsWith('new:')?{name:op.name}:{personId:key})};});
        const result=await request('api/media/'+this.id+'/tags/patch',{method:'POST',keepalive:true,body:JSON.stringify({changes})});
        if(result.item.id!==this.id)throw Error(I18n.t('התיוג לא נשמר.'));
        for(const person of result.taggedPeople){if(person.key.startsWith('new:'))this.aliases.set(person.key,person.id);addPerson(person);}
        if(this.refreshPending){const latest=await request('api/media/'+this.id+'/tags');result.item=latest.item;this.refreshPending=false;}
        this.item=result.item;this.saved=new Map(result.item.tags.map(person=>[person.id,person]));this.active=[];this.status=this.queue.length?'saving':'saved';
        window.dispatchEvent(new CustomEvent('family-media-changed',{detail:result}));this.emit();if(this.queue.length)this.schedule();
      }catch(error){this.active=[];this.queue=[...batch,...this.queue];this.error=error.message;this.status='error';this.emit();if(![...this.listeners].length)app()?.toast(I18n.t('תיוג לא נשמר: ')+error.message);}
    }
    retry(){if(!this.ready){this.load();return;}this.error='';this.status='saving';this.emit();this.run();}
    discard(){if(this.active.length)return;clearTimeout(this.timer);this.queue=[];this.error='';this.status='';this.emit();}
  }
  function storeFor(id,item){if(!stores.has(id))stores.set(id,new TagStore(id,item));return stores.get(id);}
  class TagWidget {
    constructor(host,store,inline=false){
      this.host=host;this.store=store;this.inline=inline;this.photoOnly=inline&&store.item.kind==='photo';this.query='';this.version=-1;this.lastSelection='';
      this.events=new AbortController();const on=(element,type,handler)=>element.addEventListener(type,handler,{signal:this.events.signal});
      const prefix=inline?'inline':'modal';
      host.innerHTML=I18n.html`<div class="tag-widget${inline?' inline-tag-widget':''}"><div class="tag-widget-heading"><h3><svg class="tag-heading-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 13l-7 7a2 2 0 0 1-3 0l-7-7V4h9l8 6a2 2 0 0 1 0 3Z"/><circle cx="7.5" cy="8" r="1"/></svg><span>${I18n.t(this.photoOnly?'המתויגים בתמונה':'תייגו מי מופיע כאן')}</span></h3><span data-tag-count></span></div>${this.photoOnly?'':I18n.html`<div class="tag-search-area" data-tag-search-area><label class="tag-search-label" for="${prefix}TagPersonSearch"><span class="visually-hidden">חיפוש או הוספת שם</span><input type="search" id="${prefix}TagPersonSearch" data-tag-search maxlength="120" placeholder="הקלידו שם פרטי או שם משפחה…" autocomplete="off"></label><p class="tag-search-count" data-tag-search-count></p><div class="tag-people-results" data-tag-results></div><button type="button" class="tag-add-name" data-tag-add hidden></button></div>`}<p class="tag-autosave-status" data-tag-save-status role="status" aria-live="polite"></p><div class="tag-error-actions" data-tag-error-actions hidden><button type="button" class="secondary-button" data-tag-retry>ניסיון נוסף</button><button type="button" data-tag-discard>ביטול השינוי שלא נשמר</button></div><div class="selected-people" data-selected-people></div></div>`;
      this.input=this.photoOnly?null:host.querySelector('[data-tag-search]');this.results=this.photoOnly?null:host.querySelector('[data-tag-results]');this.selectedHost=host.querySelector('[data-selected-people]');this.status=host.querySelector('[data-tag-save-status]');
      this.widget=host.querySelector('.tag-widget');this.searchArea=this.photoOnly?null:host.querySelector('[data-tag-search-area]');this.dialog=host.closest?.('dialog')||null;this.searchActive=false;this.searchFrame=null;
      this.listener=()=>this.render();store.listeners.add(this.listener);
      if(!this.photoOnly){
      on(this.input,'input',()=>{this.query=this.input.value;this.renderResults(true);this.revealSearch();});
      on(this.input,'focus',()=>this.revealSearch());
      on(this.input,'blur',event=>{if(event.relatedTarget&&host.contains(event.relatedTarget))return;if(event.relatedTarget?.closest?.('#closeMediaViewer,#closePeopleTags,#donePeopleTags'))return;this.endSearch();});
      if(this.dialog)on(this.dialog,'close',()=>this.endSearch());
      if(window.visualViewport)on(window.visualViewport,'resize',()=>{if(this.searchActive)this.revealSearch();});
      on(this.input,'keydown',event=>{if(event.key!=='Enter')return;event.preventDefault();const query=normalize(this.query),matches=[...roster.values()].filter(person=>Number.isFinite(matchRank(person,query))),exact=matches.filter(person=>matchRank(person,query)===0);if(exact.length===1)this.choose(exact[0],true);else if(matches.length===1)this.choose(matches[0],true);else if(!host.querySelector('[data-tag-add]').hidden)this.addName();});
      on(this.results,'pointerdown',event=>{if(event.button===0&&event.target.closest('.tag-person-option'))event.preventDefault();});
      }
      on(host,'change',event=>{if(!this.photoOnly&&event.target.matches('[data-tag-person]'))this.choose(roster.get(event.target.dataset.tagPerson),event.target.checked);});
      on(host,'click',event=>{
        const option=event.target.closest('.tag-person-option');
        if(option){
          const checkbox=option.querySelector('[data-tag-person]');
          if(event.target===checkbox)return;
          event.preventDefault();
          if(checkbox&&!checkbox.disabled){checkbox.checked=!checkbox.checked;this.choose(roster.get(checkbox.dataset.tagPerson),checkbox.checked);}
          return;
        }
        const remove=event.target.closest('[data-remove-person-tag]');if(remove){const person=store.selected().get(remove.dataset.removePersonTag);if(person)store.enqueue(person,false);return;}
        if(event.target.closest('[data-tag-add]'))this.addName();
        if(event.target.closest('[data-tag-retry]'))store.retry();
        if(event.target.closest('[data-tag-discard]'))store.discard();
      });
      this.render();store.load();
    }
    revealSearch(){
      if(this.photoOnly||!window.matchMedia?.('(max-width:700px)').matches)return;
      this.searchActive=true;this.widget.classList.add('is-searching');this.dialog?.classList.add('tag-search-active');
      if(this.searchFrame!==null)cancelAnimationFrame(this.searchFrame);
      this.searchFrame=requestAnimationFrame(()=>{
        this.searchFrame=null;if(!this.searchActive||!this.host.isConnected)return;
        const viewport=window.visualViewport,height=viewport?.height||window.innerHeight,top=viewport?.offsetTop||0;
        const header=this.dialog?.querySelector('.media-viewer-header')?.getBoundingClientRect().height||0,label=this.input.closest('label')?.getBoundingClientRect().height||76,target=this.dialog||this.widget;
        for(const [key,value]of Object.entries({'--tag-visible-height':height,'--tag-visible-top':top,'--tag-header-height':header,'--tag-results-height':Math.max(64,Math.min(230,height-header-label-40))}))target.style.setProperty(key,value+'px');
        if(this.dialog){const visibleTop=Math.max(top,this.dialog.getBoundingClientRect().top)+header+8,delta=this.searchArea.getBoundingClientRect().top-visibleTop;if(Math.abs(delta)>2)this.dialog.scrollBy({top:delta,behavior:'instant'});}
        else this.searchArea.scrollIntoView({block:'start',behavior:'instant'});
      });
    }
    endSearch(){
      if(this.searchFrame!==null){cancelAnimationFrame(this.searchFrame);this.searchFrame=null;}
      if(!this.searchActive)return;this.searchActive=false;this.widget.classList.remove('is-searching');this.dialog?.classList.remove('tag-search-active');
      const target=this.dialog||this.widget;for(const key of ['--tag-visible-height','--tag-visible-top','--tag-header-height','--tag-results-height'])target.style.removeProperty(key);
    }
    choose(person,tagged){if(this.photoOnly||!person)return;this.store.enqueue(person,tagged);if(tagged){this.query='';this.input.value='';this.renderResults();this.input.focus({preventScroll:true});}}
    addName(){
      if(this.photoOnly)return;
      const name=this.query.trim().replace(/\s+/g,' ');if(!normalize(name)||name.length>120)return;
      let person=[...roster.values()].find(person=>[person.name,person.nameEn].filter(Boolean).some(alias=>normalize(alias)===normalize(name)));
      if(!person){const previous=[...this.store.active,...this.store.queue].find(op=>normalize(op.name)===normalize(name));person={id:previous?.key||'new:'+newCounter++,name,isNew:true};}
      this.choose(person,true);
    }
    renderResults(resetScroll=false){
      if(this.photoOnly)return;
      const query=normalize(this.query),selected=this.store.selected(),names=[...roster.values()].filter(person=>Number.isFinite(matchRank(person,query))).sort((a,b)=>matchRank(a,query)-matchRank(b,query)||I18n.personName(a).localeCompare(I18n.personName(b),I18n.locale));
      this.results.hidden=this.inline&&!query;
      const position=resetScroll?0:this.results.scrollTop;
      this.results.innerHTML=names.slice(0,150).map(person=>`<label class="tag-person-option"><input type="checkbox" data-tag-person="${safe(person.id)}" ${selected.has(person.id)?'checked':''}><span><strong>${safe(I18n.personName(person))}</strong><small>${safe(personContext(person))}</small></span></label>`).join('')||I18n.t('<p class="tag-no-results">לא נמצא שם מתאים. אפשר להוסיף שם חדש.</p>');
      this.results.scrollTop=position;
      this.host.querySelector('[data-tag-search-count]').textContent=this.inline&&!query?'':I18n.html`${names.length} ${I18n.isEnglish?I18n.word(names.length,'name in the list','names in the list'):I18n.t('שמות ברשימה')}`;
      const add=this.host.querySelector('[data-tag-add]');add.hidden=!this.store.ready||!query||names.length>0||[...selected.values()].some(person=>[person.name,person.nameEn].filter(Boolean).some(alias=>normalize(alias)===query));add.textContent=I18n.t('＋ הוספת השם ״')+this.query.trim()+'״';this.version=rosterVersion;
    }
    render(){
      if(!this.host.isConnected)return;
      const selected=this.store.selected(),signature=JSON.stringify([...selected].map(([key,person])=>[key,person.name]));
      if(this.lastSelection!==signature){this.selectedHost.innerHTML=[...selected].map(([key,person])=>I18n.html`<button type="button" class="selected-person-tag" data-remove-person-tag="${safe(key)}" aria-label="הסרת התיוג של ${safe(I18n.personName(person))}">${safe(I18n.personName(person))}${person.isNew?I18n.t('<small>שומר…</small>'):''}<span aria-hidden="true">×</span></button>`).join('')||'';this.lastSelection=signature;}
      if(this.photoOnly)window.FamilyPhotoDate?.decorate(this.selectedHost,this.store.item,[...selected.values()]);
      this.host.querySelector('[data-tag-count]').textContent=selected.size===0?'':selected.size===1?I18n.t('אדם אחד תויג'):selected.size+I18n.t(' מתויגים');
      const state=this.store;if(this.input)this.input.disabled=!state.ready;this.status.className='tag-autosave-status '+(state.error?'failed':state.status);
      this.status.textContent=state.error?I18n.t('התיוג לא נשמר: ')+state.error:state.status==='loading'?I18n.t('טוען את רשימת האנשים…'):state.busy?I18n.t('שומר את התיוג…'):state.status==='saved'?I18n.t('✓ התיוג נשמר בהצלחה'):'';
      this.host.querySelector('[data-tag-error-actions]').hidden=!state.error;
      if(this.version!==rosterVersion)this.renderResults();
      for(const checkbox of this.results?.querySelectorAll('[data-tag-person]')||[]){checkbox.checked=selected.has(checkbox.dataset.tagPerson);checkbox.disabled=!state.ready;}
    }
    destroy(){this.endSearch();this.events.abort();this.store.listeners.delete(this.listener);}
  }
  function taggable(item){return Boolean(item.id)&&['photo','video'].includes(item.kind);}
  function controls(item){return taggable(item)&&item.kind!=='photo'?`<button class="media-tag-button" data-edit-media-tags="${safe(item.id)}">${item.tags?.length?I18n.t('תיוג אנשים (')+item.tags.length+')':I18n.t('＋ תיוג אנשים')}</button>`:'';}
  function labels(item){return `<div class="media-people-tags" data-media-tags-for="${safe(item.id)}">${(item.tags||[]).map(person=>I18n.html`<button data-open-tag-person="${safe(person.id)}" aria-label="פתיחת האלבום של ${safe(I18n.personName(person))}">${safe(I18n.personName(person))}</button>`).join('')}</div>`;}
  function refresh(root,items){
    const byId=new Map(items.map(item=>[item.id,item]));
    for(const row of root.querySelectorAll('[data-media-tags-for]')){const item=byId.get(row.dataset.mediaTagsFor);if(!item)continue;const signature=JSON.stringify(item.tags||[]);if(row.dataset.signature!==signature){row.innerHTML=(item.tags||[]).map(person=>I18n.html`<button data-open-tag-person="${safe(person.id)}" aria-label="פתיחת האלבום של ${safe(I18n.personName(person))}">${safe(I18n.personName(person))}</button>`).join('');row.dataset.signature=signature;}}
    for(const button of root.querySelectorAll('[data-edit-media-tags]')){const item=byId.get(button.dataset.editMediaTags);if(item)button.textContent=item.tags?.length?I18n.t('תיוג אנשים (')+item.tags.length+')':I18n.t('＋ תיוג אנשים');}
    for(const label of root.querySelectorAll('[data-compact-tag-count]')){const item=byId.get(label.dataset.compactTagCount);if(item)label.textContent=item.tags?.length?'♧ '+item.tags.length+I18n.t(' מתויגים'):I18n.t('לתצוגה ותיוג');}
  }
  function closeModal(){closeRequested=false;$('tagPeopleDialog').close();}
  function requestClose(){if(modalStore?.busy&&!modalStore.error){closeRequested=true;return;}if(modalStore?.error&&modalStore.busy)return;closeModal();}
  function open(id){
    if(!app()?.apiEnabled)return;
    if($('mediaViewer').open&&$('mediaTagPanel').dataset.media===id){$('mediaTagPanel').scrollIntoView({behavior:'instant',block:'nearest'});$('mediaTagPanel').querySelector('input')?.focus({preventScroll:true});return;}
    modalWidget?.destroy();modalStore=storeFor(id);closeRequested=false;$('tagMediaName').textContent=modalStore.item.name||'';$('tagPeopleDialog').showModal();modalWidget=new TagWidget($('tagModalMount'),modalStore);
    const title=()=>{$('tagMediaName').textContent=modalStore.item.name||'';};modalStore.listeners.add(title);modalWidget.titleListener=title;
  }
  function mountInline(host,item){
    if(!taggable(item)){clearInline(host);return;}
    if(host.dataset.media===item.id)return;
    clearInline(host);host.dataset.media=item.id;host._tagWidget=new TagWidget(host,storeFor(item.id,item),true);
  }
  function clearInline(host){host._tagWidget?.destroy();delete host._tagWidget;delete host.dataset.media;host.replaceChildren();}
  function init(){
    window.addEventListener('family-media-changed',event=>{
      const result=event.detail,item=result.item;if(result.operation!=='faces')return;
      for(const person of result.taggedPeople||[])addPerson(person);
      const store=item&&stores.get(item.id);if(!store)return;
      if(store.active.length)store.refreshPending=true;
      store.item=item;store.saved=new Map((item.tags||[]).map(person=>[person.id,person]));store.ready=true;store.emit();
    });
    window.addEventListener('pagehide',()=>{for(const store of stores.values())store.run();});
    document.addEventListener('click',async event=>{
      const edit=event.target.closest('[data-edit-media-tags]');if(edit){open(edit.dataset.editMediaTags);return;}
      const person=event.target.closest('[data-open-tag-person]');if(person){const id=person.dataset.openTagPerson;try{if(!app().getPerson(id))app().updatePerson(id,await request('api/people/'+encodeURIComponent(id)));if($('mediaViewer').open)$('mediaViewer').close();app().openPerson(id);}catch(error){window.FamilyMedia.notify(error.message);}}
    });
    for(const id of ['closePeopleTags','donePeopleTags'])$(id).addEventListener('click',requestClose);
    $('tagPeopleDialog').addEventListener('cancel',event=>{event.preventDefault();requestClose();});
    $('tagPeopleDialog').addEventListener('close',()=>{if(modalWidget?.titleListener)modalStore.listeners.delete(modalWidget.titleListener);modalWidget?.destroy();modalWidget=null;modalStore=null;});
    window.addEventListener('beforeunload',event=>{if([...stores.values()].some(store=>store.busy)){event.preventDefault();event.returnValue='';}});
  }
  for(const person of Object.values(window.FAMILY_DATA.people))addPerson(person);rosterTime=Date.now();
  async function findPeople(query='',preferred=[]){
    await loadRoster(!rosterFetched);const normalized=normalize(query),first=new Set(preferred);
    return [...roster.values()].filter(person=>Number.isFinite(matchRank(person,normalized))).sort((a,b)=>matchRank(a,normalized)-matchRank(b,normalized)||(first.has(b.id)-first.has(a.id))||I18n.personName(a).localeCompare(I18n.personName(b),I18n.locale)).slice(0,50).map(person=>({...person,context:personContext(person)}));
  }
  async function flush(id){
    const store=stores.get(id);if(!store)return;
    await store.load();if(store.error)throw Error(store.error);if(!store.busy)return;
    await new Promise((resolve,reject)=>{const check=()=>{if(store.error||!store.busy){store.listeners.delete(check);if(store.error)reject(Error(store.error));else resolve();}};store.listeners.add(check);store.run();check();});
  }
  window.FamilyTags={controls,labels,refresh,open,taggable,mountInline,clearInline,findPeople,flush};document.addEventListener('DOMContentLoaded',init);
})();
