(() => {
  'use strict';
  const $=id=>document.getElementById(id),app=()=>window.FamilyApp;
  const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normalize=value=>String(value).normalize('NFKD').replace(/[\u0591-\u05c7'"׳״]/g,'').replace(/\s+/g,' ').toLowerCase().trim();
  const stores=new Map(),roster=new Map();let rosterPromise=null,rosterTime=0,rosterVersion=0,modalWidget=null,modalStore=null,closeRequested=false,newCounter=0;
  async function request(path,options={}){
    const response=await fetch(path,{cache:'no-store',...options,headers:{...(options.body?{'Content-Type':'application/json','X-Family-Token':window.FAMILY_API_TOKEN}:{}),...options.headers}});
    let result;try{result=await response.json();}catch{throw Error('לא התקבלה תשובה מהשרת. נסו שוב.');}
    if(!response.ok)throw Error(result.error||'התיוג לא נשמר.');return result;
  }
  function addPerson(person){if(!person?.id)return;const old=roster.get(person.id);roster.set(person.id,{...old,...person});rosterVersion++;}
  async function loadRoster(){
    if(rosterPromise)return rosterPromise;if(roster.size&&Date.now()-rosterTime<60000)return;
    rosterPromise=request('api/tag-people').then(result=>{result.people.forEach(addPerson);rosterTime=Date.now();}).finally(()=>{rosterPromise=null;});return rosterPromise;
  }
  class TagStore {
    constructor(id,item){this.id=id;this.item=item||{id,tags:[]};this.saved=new Map((item?.tags||[]).map(person=>[person.id,person]));this.queue=[];this.active=null;this.aliases=new Map();this.listeners=new Set();this.error='';this.status='';this.ready=false;}
    get busy(){return Boolean(this.active||this.queue.length);}
    selected(){const selected=new Map(this.saved);for(const op of [this.active,...this.queue].filter(Boolean)){const key=this.aliases.get(op.key)||op.key;if(op.tagged)selected.set(key,{...roster.get(key),id:key,name:op.name,isNew:key.startsWith('new:')});else selected.delete(key);}return selected;}
    emit(){for(const listener of this.listeners)listener();if(closeRequested&&modalStore===this&&!this.busy&&!this.error)closeModal();}
    async load(){
      this.status='loading';this.emit();
      try{const [,result]=await Promise.all([loadRoster(),request('api/media/'+this.id+'/tags')]);if(!this.busy){this.item=result.item;this.saved=new Map(result.item.tags.map(person=>[person.id,person]));}this.ready=true;this.status='';this.error='';this.emit();this.run();}
      catch(error){this.error=error.message;this.status='error';this.emit();}
    }
    enqueue(person,tagged){
      const selected=this.selected();if(tagged&&!selected.has(person.id)&&selected.size>=150){this.error='אפשר לתייג עד 150 אנשים בפריט.';this.emit();return;}
      this.queue.push({key:person.id,name:person.name,tagged});this.error='';this.status='saving';this.emit();this.run();
    }
    async run(){
      if(this.active||this.error||!this.ready||!this.queue.length)return;
      const op=this.queue.shift();this.active=op;this.status='saving';this.emit();
      try{
        const key=this.aliases.get(op.key)||op.key,body=key.startsWith('new:')?{name:op.name,tagged:op.tagged}:{personId:key,tagged:op.tagged};
        const result=await request('api/media/'+this.id+'/tag',{method:'POST',keepalive:true,body:JSON.stringify(body)});
        if(op.key.startsWith('new:'))this.aliases.set(op.key,result.taggedPerson.id);
        addPerson(result.taggedPerson);this.item=result.item;this.saved=new Map(result.item.tags.map(person=>[person.id,person]));this.active=null;this.status=this.queue.length?'saving':'saved';
        window.dispatchEvent(new CustomEvent('family-media-changed',{detail:result}));this.emit();this.run();
      }catch(error){this.active=null;this.queue.unshift(op);this.error=error.message;this.status='error';this.emit();if(![...this.listeners].length)app()?.toast('תיוג לא נשמר: '+error.message);}
    }
    retry(){if(!this.ready){this.load();return;}this.error='';this.status='saving';this.emit();this.run();}
    discard(){if(this.active)return;this.queue=[];this.error='';this.status='';this.emit();}
  }
  function storeFor(id,item){if(!stores.has(id))stores.set(id,new TagStore(id,item));return stores.get(id);}
  class TagWidget {
    constructor(host,store,inline=false){
      this.host=host;this.store=store;this.inline=inline;this.query='';this.version=-1;this.lastSelection='';
      const prefix=inline?'inline':'modal';
      host.innerHTML=`<div class="tag-widget${inline?' inline-tag-widget':''}"><div class="tag-widget-heading"><h3>${inline?'מי מופיע כאן?':'בוחרים אנשים מהרשימה'}</h3><span data-tag-count></span></div><div class="selected-people" data-selected-people></div><p class="tag-autosave-status" data-tag-save-status role="status" aria-live="polite"></p><label class="tag-search-label" for="${prefix}TagPersonSearch">חיפוש או הוספת שם<input type="search" id="${prefix}TagPersonSearch" data-tag-search maxlength="120" placeholder="הקלידו שם פרטי או שם משפחה…" autocomplete="off"></label><p class="tag-search-count" data-tag-search-count></p><div class="tag-people-results" data-tag-results></div><button type="button" class="tag-add-name" data-tag-add hidden></button><p class="tag-add-help">כל סימון נשמר אוטומטית. שם חדש יקבל אלבום משלו.</p><div class="tag-error-actions" data-tag-error-actions hidden><button type="button" class="secondary-button" data-tag-retry>ניסיון נוסף</button><button type="button" data-tag-discard>ביטול השינוי שלא נשמר</button></div></div>`;
      this.input=host.querySelector('[data-tag-search]');this.results=host.querySelector('[data-tag-results]');this.selectedHost=host.querySelector('[data-selected-people]');this.status=host.querySelector('[data-tag-save-status]');
      this.listener=()=>this.render();store.listeners.add(this.listener);
      this.input.addEventListener('input',()=>{this.query=this.input.value;this.renderResults();});
      this.input.addEventListener('keydown',event=>{if(event.key!=='Enter')return;event.preventDefault();const query=normalize(this.query),matches=[...roster.values()].filter(person=>normalize(person.name).includes(query));if(matches.length===1)this.choose(matches[0],true);else if(!host.querySelector('[data-tag-add]').hidden)this.addName();});
      host.addEventListener('change',event=>{if(event.target.matches('[data-tag-person]'))this.choose(roster.get(event.target.dataset.tagPerson),event.target.checked);});
      host.addEventListener('click',event=>{
        const remove=event.target.closest('[data-remove-person-tag]');if(remove){const person=store.selected().get(remove.dataset.removePersonTag);if(person)store.enqueue(person,false);return;}
        if(event.target.closest('[data-tag-add]'))this.addName();
        if(event.target.closest('[data-tag-retry]'))store.retry();
        if(event.target.closest('[data-tag-discard]'))store.discard();
      });
      this.render();store.load();
    }
    choose(person,tagged){if(!person)return;this.store.enqueue(person,tagged);if(tagged){this.query='';this.input.value='';this.renderResults();this.input.focus({preventScroll:true});}}
    addName(){
      const name=this.query.trim().replace(/\s+/g,' ');if(!normalize(name)||name.length>120)return;
      let person=[...roster.values()].find(person=>normalize(person.name)===normalize(name));
      if(!person){const previous=[this.store.active,...this.store.queue].filter(Boolean).find(op=>normalize(op.name)===normalize(name));person={id:previous?.key||'new:'+newCounter++,name,isNew:true};}
      this.choose(person,true);
    }
    renderResults(){
      const query=normalize(this.query),selected=this.store.selected(),names=[...roster.values()].filter(person=>!query||normalize(person.name).includes(query)).sort((a,b)=>a.name.localeCompare(b.name,'he'));
      this.results.hidden=this.inline&&!query;
      const position=this.results.scrollTop;
      this.results.innerHTML=names.slice(0,150).map(person=>`<label class="tag-person-option"><input type="checkbox" data-tag-person="${safe(person.id)}" ${selected.has(person.id)?'checked':''}><span><strong>${safe(person.name)}</strong><small>${safe(person.extra?'שם נוסף באלבומים':window.FAMILY_DATA.branches.find(branch=>branch.id===person.branch)?.title||'השורשים של כולנו')}</small></span></label>`).join('')||'<p class="tag-no-results">לא נמצא שם מתאים. אפשר להוסיף שם חדש.</p>';
      this.results.scrollTop=position;
      this.host.querySelector('[data-tag-search-count]').textContent=this.inline&&!query?'':`${names.length} שמות ברשימה`;
      const add=this.host.querySelector('[data-tag-add]');add.hidden=!this.store.ready||!query||names.length>0||[...selected.values()].some(person=>normalize(person.name)===query);add.textContent='＋ הוספת השם ״'+this.query.trim()+'״';this.version=rosterVersion;
    }
    render(){
      if(!this.host.isConnected)return;
      const selected=this.store.selected(),signature=JSON.stringify([...selected].map(([key,person])=>[key,person.name]));
      if(this.lastSelection!==signature){this.selectedHost.innerHTML=[...selected].map(([key,person])=>`<button type="button" class="selected-person-tag" data-remove-person-tag="${safe(key)}" aria-label="הסרת התיוג של ${safe(person.name)}">${safe(person.name)}${person.isNew?'<small>שומר…</small>':''}<span aria-hidden="true">×</span></button>`).join('')||'<span class="tag-selection-empty">בחרו את האנשים שמופיעים כאן.</span>';this.lastSelection=signature;}
      this.host.querySelector('[data-tag-count]').textContent=selected.size===1?'אדם אחד תויג':selected.size+' מתויגים';
      const state=this.store;this.input.disabled=!state.ready;this.status.className='tag-autosave-status '+(state.error?'failed':state.status);
      this.status.textContent=state.error?'התיוג לא נשמר: '+state.error:state.status==='loading'?'טוען את רשימת האנשים…':state.busy?'שומר את התיוג…':state.status==='saved'?'✓ התיוג נשמר בהצלחה':'התיוגים נשמרים אוטומטית';
      this.host.querySelector('[data-tag-error-actions]').hidden=!state.error;
      if(this.version!==rosterVersion)this.renderResults();
      for(const checkbox of this.results.querySelectorAll('[data-tag-person]')){checkbox.checked=selected.has(checkbox.dataset.tagPerson);checkbox.disabled=!state.ready;}
    }
    destroy(){this.store.listeners.delete(this.listener);}
  }
  function taggable(item){return Boolean(item.id)&&['photo','video'].includes(item.kind);}
  function controls(item){return taggable(item)?`<button class="media-tag-button" data-edit-media-tags="${safe(item.id)}">${item.tags?.length?'תיוג אנשים ('+item.tags.length+')':'＋ תיוג אנשים'}</button>`:'';}
  function labels(item){return `<div class="media-people-tags" data-media-tags-for="${safe(item.id)}">${(item.tags||[]).map(person=>`<button data-open-tag-person="${safe(person.id)}" aria-label="פתיחת האלבום של ${safe(person.name)}">${safe(person.name)}</button>`).join('')}</div>`;}
  function refresh(root,items){
    const byId=new Map(items.map(item=>[item.id,item]));
    for(const row of root.querySelectorAll('[data-media-tags-for]')){const item=byId.get(row.dataset.mediaTagsFor);if(!item)continue;const signature=JSON.stringify(item.tags||[]);if(row.dataset.signature!==signature){row.innerHTML=(item.tags||[]).map(person=>`<button data-open-tag-person="${safe(person.id)}" aria-label="פתיחת האלבום של ${safe(person.name)}">${safe(person.name)}</button>`).join('');row.dataset.signature=signature;}}
    for(const button of root.querySelectorAll('[data-edit-media-tags]')){const item=byId.get(button.dataset.editMediaTags);if(item)button.textContent=item.tags?.length?'תיוג אנשים ('+item.tags.length+')':'＋ תיוג אנשים';}
    for(const label of root.querySelectorAll('[data-compact-tag-count]')){const item=byId.get(label.dataset.compactTagCount);if(item)label.textContent=item.tags?.length?'♧ '+item.tags.length+' מתויגים':'לתצוגה ותיוג';}
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
    document.addEventListener('click',async event=>{
      const edit=event.target.closest('[data-edit-media-tags]');if(edit){open(edit.dataset.editMediaTags);return;}
      const person=event.target.closest('[data-open-tag-person]');if(person){const id=person.dataset.openTagPerson;try{if(!app().getPerson(id))app().updatePerson(id,await request('api/people/'+encodeURIComponent(id)));if($('mediaViewer').open)$('mediaViewer').close();app().openPerson(id);}catch(error){window.FamilyMedia.notify(error.message);}}
    });
    for(const id of ['closePeopleTags','donePeopleTags'])$(id).addEventListener('click',requestClose);
    $('tagPeopleDialog').addEventListener('cancel',event=>{event.preventDefault();requestClose();});
    $('tagPeopleDialog').addEventListener('close',()=>{if(modalWidget?.titleListener)modalStore.listeners.delete(modalWidget.titleListener);modalWidget?.destroy();modalWidget=null;modalStore=null;});
    window.addEventListener('beforeunload',event=>{if([...stores.values()].some(store=>store.busy)){event.preventDefault();event.returnValue='';}});
  }
  window.FamilyTags={controls,labels,refresh,open,taggable,mountInline,clearInline};document.addEventListener('DOMContentLoaded',init);
})();
