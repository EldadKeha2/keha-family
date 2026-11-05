(() => {
  'use strict';
  const I=window.FamilyI18n,tr=(he,en)=>I.isEnglish?en:he;
  const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const labels=new Map();let current=null,serial=0,geometry=null;
  const remember=(id,faces,item)=>{labels.set(id,{faces,time:Date.now(),tagsRevision:item?.tagsRevision});if(labels.size>128)labels.delete(labels.keys().next().value);};
  const helpers=()=>geometry||=import('./face-geometry.mjs?v=1');
  const uuid=()=>crypto.randomUUID?crypto.randomUUID().replaceAll('-',''):[...crypto.getRandomValues(new Uint8Array(16))].map(byte=>byte.toString(16).padStart(2,'0')).join('');
  const touchMode=event=>event?.pointerType==='touch'||matchMedia('(hover:none), (max-width:700px)').matches;
  const live=c=>current===c&&!c.events.signal.aborted;
  const photoName=face=>face.person?I.personName(face.person):'';
  async function request(path,options={}){
    const response=await I.fetch(path,{cache:'no-store',...options,headers:{...(options.body?{'Content-Type':'application/json','X-Family-Token':window.FAMILY_API_TOKEN}:{}),...options.headers}});
    let result;try{result=await response.json();}catch{throw Error(tr('לא התקבל אישור מהשרת. נסו שוב.','No confirmation was received. Please try again.'));}
    if(!response.ok)throw Error(I.error(result.error)||tr('תיוג הפנים לא נשמר.','The face tag was not saved.'));return result;
  }
  function announce(c,message){if(live(c))c.status.textContent=message;}
  function closePopup(c){
    clearTimeout(c.labelTimer);c.labelTimer=null;c.popup?.remove();c.popup=null;c.active=null;if(c.selection)c.selection.hidden=true;c.adjust=false;c.drag=null;c.stage.classList.remove('face-adjusting');if(c.guide)c.guide.hidden=true;
  }
  function clear(){
    const c=current;if(!c)return;current=null;c.events.abort();c.resize?.disconnect();clearTimeout(c.labelTimer);c.popup?.remove();c.layer?.remove();c.status?.remove();c.stage.classList.remove('has-face-layer','face-adjusting');
  }
  function viewport(){const v=window.visualViewport;return {left:v?.offsetLeft||0,top:v?.offsetTop||0,width:Math.min(v?.width||innerWidth,document.documentElement.clientWidth||innerWidth),height:v?.height||innerHeight};}
  function imageArea(c){
    const r=c.image.getBoundingClientRect(),ratio=c.image.naturalWidth/c.image.naturalHeight;let width=r.width,height=r.height;
    if(width/height>ratio)width=height*ratio;else height=width/ratio;
    return {x:r.left+(r.width-width)/2,y:r.top+(r.height-height)/2,width,height};
  }
  function screenFace(c,face){const image=imageArea(c),r=face.rect;return {x:image.x+r.x*image.width,y:image.y+r.y*image.height,width:r.width*image.width,height:r.height*image.height};}
  function place(c){
    if(!live(c)||!c.image.naturalWidth)return;const image=imageArea(c),stage=c.stage.getBoundingClientRect();
    Object.assign(c.hits.style,{left:(image.x-stage.left)+'px',top:(image.y-stage.top)+'px',width:image.width+'px',height:image.height+'px'});
    if(c.active&&!c.selection.hidden)Object.assign(c.selection.style,{left:c.active.rect.x*100+'%',top:c.active.rect.y*100+'%',width:c.active.rect.width*100+'%',height:c.active.rect.height*100+'%'});
    if(c.popup&&c.active){
      const v=viewport(),r=c.popup.getBoundingClientRect(),p=c.geom.popoverPosition(screenFace(c,c.active),{width:r.width||270,height:r.height||180},v);
      Object.assign(c.popup.style,{left:p.x+'px',top:p.y+'px',maxHeight:p.maxHeight+'px',maxWidth:p.width+'px'});
    }
  }
  function paint(c){
    if(!live(c))return;c.faces=c.geom.mergeFaces(c.saved,c.detected);c.buttons.replaceChildren();
    for(const face of c.faces){
      const button=document.createElement('button');button.type='button';button.className='face-hit';button.dataset.faceId=face.id;button.setAttribute('aria-label',face.person?tr('פנים בתמונה: ','Face in photo: ')+photoName(face):tr('תיוג הפנים האלה','Tag this face'));
      Object.assign(button.style,{left:face.rect.x*100+'%',top:face.rect.y*100+'%',width:face.rect.width*100+'%',height:face.rect.height*100+'%'});
      button.addEventListener('pointerenter',event=>{if(!touchMode(event)&&face.person&&!c.popup?.classList.contains('face-picker'))showLabel(c,face,false);},{signal:c.events.signal});
      button.addEventListener('pointerleave',event=>{if(!touchMode(event)&&c.popup?.classList.contains('face-name'))closePopup(c);},{signal:c.events.signal});
      button.addEventListener('focus',()=>{if(face.person&&!c.popup?.classList.contains('face-picker'))showLabel(c,face,touchMode());},{signal:c.events.signal});
      button.addEventListener('blur',event=>{if(!c.popup?.contains(event.relatedTarget)&&c.popup?.classList.contains('face-name'))closePopup(c);},{signal:c.events.signal});
      c.buttons.append(button);
    }
    place(c);
  }
  function apply(c,faces){
    c.saved=faces;if(c.active){const updated=faces.find(face=>face.id===c.active.id);if(updated)c.active=updated;else if(c.active.person&&!c.saving)closePopup(c);}
    paint(c);
  }
  async function load(c,force=false){
    const cached=labels.get(c.item.id);
    if(!force&&cached&&cached.tagsRevision===c.item.tagsRevision&&Date.now()-cached.time<30000){apply(c,cached.faces);c.ready=true;return;}
    const result=await request('api/media/'+c.item.id+'/faces',{signal:c.events.signal});
    if(!live(c))return;remember(c.item.id,result.faces,result.item);c.ready=true;c.loadError=false;apply(c,result.faces);
    if(result.item&&result.item.tagsRevision!==c.item.tagsRevision)window.dispatchEvent(new CustomEvent('family-media-changed',{detail:{operation:'faces',scope:result.item.scope,item:result.item,faces:result.faces}}));
  }
  function showLabel(c,face,touch){
    if(!live(c)||!face.person)return;closePopup(c);c.active=face;
    const bubble=document.createElement('div');bubble.className='face-popover face-name';bubble.setAttribute('role','group');bubble.setAttribute('aria-label',tr('מי בתמונה','Who is in the photo'));bubble.dir=I.isEnglish?'ltr':'rtl';
    bubble.innerHTML=`<span dir="auto">${safe(photoName(face))}</span>${touch?`<button type="button" data-face-edit aria-label="${tr('עריכת תיוג הפנים','Edit face tag')}">✎</button>`:''}`;
    if(touch)bubble.querySelector('[data-face-edit]').addEventListener('click',()=>openPicker(c,face));
    c.popup=bubble;c.dialog.append(bubble);place(c);if(touch)c.labelTimer=setTimeout(()=>{if(live(c)&&c.popup===bubble)closePopup(c);},3000);
  }
  async function results(c,query){
    const panel=c.popup;if(!panel?.classList.contains('face-picker'))return;const sequence=++c.searchSequence,host=panel.querySelector('[data-face-results]');
    try{
      const people=await window.FamilyTags.findPeople(query,(c.item.tags||[]).map(person=>person.id));if(!live(c)||c.popup!==panel||sequence!==c.searchSequence)return;
      host.innerHTML=people.map(person=>`<button class="face-person-option" type="button" role="option" data-face-person="${safe(person.id)}" aria-selected="${person.id===c.active?.personId}"><span class="face-person-check" aria-hidden="true">${person.id===c.active?.personId?'✓':'＋'}</span><span><strong dir="auto">${safe(I.personName(person))}</strong><small>${safe(person.context)}</small></span></button>`).join('')||`<p class="face-no-results">${tr('לא נמצא שם מתאים.','No matching name.')}</p>`;
      for(const button of host.querySelectorAll('[data-face-person]'))button.addEventListener('click',()=>save(c,button.dataset.facePerson));place(c);
    }catch(error){if(live(c)&&c.popup===panel)panel.querySelector('[data-face-status]').textContent=error.message;}
  }
  async function openPicker(c,face){
    if(!live(c)||c.saving)return;closePopup(c);c.active=face;c.selection.hidden=false;
    if(c.loadError){c.loadError=false;c.loading=load(c,true).catch(error=>{c.loadError=true;throw error;});c.loading.catch(()=>{});}
    const panel=document.createElement('div');panel.className='face-popover face-picker';panel.setAttribute('role','dialog');panel.setAttribute('aria-label',tr('תיוג פנים בתמונה','Tag a face in the photo'));panel.dir=I.isEnglish?'ltr':'rtl';
    panel.innerHTML=`<header><strong>${tr('מי בתמונה?','Who is this?')}</strong><button type="button" data-face-close aria-label="${tr('סגירה','Close')}">×</button></header>${face.person?`<p class="face-current-name" dir="auto">${safe(photoName(face))}</p>`:''}<label class="visually-hidden" for="facePersonSearch">${tr('חיפוש שם בן או בת משפחה','Search for a family member')}</label><input id="facePersonSearch" type="search" autocomplete="off" maxlength="120" placeholder="${tr('הקלידו שם בן משפחה…','Type a family member’s name…')}" aria-controls="facePersonResults" aria-autocomplete="list"><div id="facePersonResults" class="face-person-results" data-face-results role="listbox" aria-label="${tr('בני משפחה','Family members')}"></div><p class="face-save-status" data-face-status role="status"></p><div class="face-picker-actions"><button type="button" data-face-adjust>${tr('דיוק אזור הפנים','Adjust face area')}</button>${face.person?`<button type="button" data-face-remove>${tr('ניקוי תיוג הפנים','Clear face label')}</button>`:''}</div>`;
    c.popup=panel;c.dialog.append(panel);place(c);
    const input=panel.querySelector('input');input.addEventListener('input',()=>results(c,input.value));
    input.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closePopup(c);}if(event.key==='ArrowDown'){event.preventDefault();panel.querySelector('[data-face-person]')?.focus();}});
    panel.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closePopup(c);}else if(['ArrowDown','ArrowUp'].includes(event.key)&&event.target.matches('[data-face-person]')){event.preventDefault();const buttons=[...panel.querySelectorAll('[data-face-person]')],index=buttons.indexOf(event.target);buttons[(index+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus();}});
    panel.querySelector('[data-face-close]').addEventListener('click',()=>closePopup(c));
    panel.querySelector('[data-face-adjust]').addEventListener('click',()=>{panel.remove();c.popup=null;c.adjust=true;c.guide.hidden=false;c.stage.classList.add('face-adjusting');place(c);});
    panel.querySelector('[data-face-remove]')?.addEventListener('click',()=>save(c,null));
    input.focus({preventScroll:true});results(c,'');
    try{
      await c.loading;if(!live(c)||c.popup!==panel)return;
      const stored=c.saved.find(saved=>c.geom.sameRegion(saved.rect,face.rect));if(stored){c.active=stored;place(c);}
    }catch(error){if(live(c)&&c.popup===panel)panel.querySelector('[data-face-status]').textContent=tr('לא ניתן לקרוא את תיוגי הפנים כרגע. סגרו ונסו שוב.','Face labels are currently unavailable. Close and try again.');}
  }
  async function save(c,personId){
    if(!live(c)||c.saving||!c.active)return;const panel=c.popup,face={...c.active};c.saving=true;
    if(panel){panel.querySelector('[data-face-status]').textContent=tr('שומר את התיוג…','Saving the tag…');for(const button of panel.querySelectorAll('button'))button.disabled=true;}
    try{
      await c.loading;await window.FamilyTags.flush(c.item.id);
      const known=c.saved.find(saved=>saved.id===face.id||c.geom.sameRegion(saved.rect,face.rect));
      const result=await request('api/media/'+c.item.id+'/faces/save',{method:'POST',body:JSON.stringify({faceId:known?.id||face.id,personId,rect:face.rect,expectedRevision:known?.revision||null})});
      remember(c.item.id,result.faces,result.item);window.dispatchEvent(new CustomEvent('family-media-changed',{detail:result}));
      if(live(c)){c.saving=false;apply(c,result.faces);closePopup(c);announce(c,personId?tr('תיוג הפנים נשמר ונוסף גם לתיוגי התמונה.','Face label saved and added to the photo’s tags.'):tr('הקישור לפנים הוסר. התיוג הכללי של התמונה נשאר.','The face label was cleared. The photo’s ordinary tag remains.'));if(result.face)showLabel(c,result.face,touchMode());}
    }catch(error){if(live(c)&&c.popup===panel&&panel){panel.querySelector('[data-face-status]').textContent=error.message;for(const button of panel.querySelectorAll('button'))button.disabled=false;}}
    finally{c.saving=false;}
  }
  function point(c,event){if(!c.image.naturalWidth)return null;const r=imageArea(c);if(event.clientX<r.x||event.clientX>r.x+r.width||event.clientY<r.y||event.clientY>r.y+r.height)return null;return {x:(event.clientX-r.x)/r.width,y:(event.clientY-r.y)/r.height};}
  async function mount(stage,image,item){
    clear();if(item.kind!=='photo'||!item.id||!window.FamilyApp?.apiEnabled)return;
    const c={serial:++serial,stage,image,item,dialog:document.getElementById('mediaViewer'),events:new AbortController(),saved:[],detected:[],faces:[],active:null,popup:null,ready:false,searchSequence:0,saving:false,adjust:false,drag:null,skipClick:false};current=c;
    c.geom=await helpers();if(!live(c))return;
    c.layer=document.createElement('div');c.layer.className='face-layer';c.hits=document.createElement('div');c.hits.className='face-image-area';c.buttons=document.createElement('div');c.buttons.className='face-hit-buttons';c.selection=document.createElement('div');c.selection.className='face-selection';c.selection.hidden=true;c.hits.append(c.buttons,c.selection);c.layer.append(c.hits);
    c.guide=document.createElement('div');c.guide.className='face-adjust-guide';c.guide.hidden=true;c.guide.innerHTML=`<span>${tr('סמנו מסביב לפנים בעזרת גרירה','Drag around the face')}</span><button type="button">${tr('ביטול','Cancel')}</button>`;c.guide.querySelector('button').addEventListener('click',()=>closePopup(c));c.layer.append(c.guide);
    c.status=document.createElement('p');c.status.className='visually-hidden';c.status.setAttribute('role','status');c.status.setAttribute('aria-live','polite');stage.append(c.layer,c.status);stage.classList.add('has-face-layer');
    const on=(target,type,callback,options={})=>target.addEventListener(type,callback,{...options,signal:c.events.signal});
    on(stage,'click',event=>{
      if(!live(c)||c.saving||event.target.closest('.face-adjust-guide')||c.adjust)return;
      if(c.skipClick){c.skipClick=false;return;}
      const keyboard=event.detail===0&&event.target.matches('.face-hit');const p=keyboard?null:point(c,event);if(!keyboard&&!p)return;
      const area=imageArea(c),face=keyboard?c.faces.find(face=>face.id===event.target.dataset.faceId):c.geom.chooseFace(c.faces,p,area)||{id:uuid(),rect:c.geom.manualRect(p,area),revision:null};
      if(!face)return;event.preventDefault();if(face.person&&touchMode(event)&&!keyboard)showLabel(c,face,true);else openPicker(c,face);
    });
    on(stage,'pointerdown',event=>{if(!c.adjust||event.target.closest('.face-adjust-guide'))return;const p=point(c,event);if(!p)return;event.preventDefault();c.drag=p;stage.setPointerCapture?.(event.pointerId);});
    on(stage,'pointermove',event=>{if(!c.adjust||!c.drag)return;const p=point(c,event);if(!p)return;event.preventDefault();c.active.rect=c.geom.clampRect({x:Math.min(p.x,c.drag.x),y:Math.min(p.y,c.drag.y),width:Math.abs(p.x-c.drag.x),height:Math.abs(p.y-c.drag.y)});c.selection.hidden=false;place(c);});
    on(stage,'pointerup',event=>{if(!c.adjust||!c.drag)return;event.preventDefault();c.drag=null;c.adjust=false;c.skipClick=true;stage.classList.remove('face-adjusting');c.guide.hidden=true;const face=c.active;openPicker(c,face);});
    on(stage,'pointercancel',()=>{if(c.adjust){c.drag=null;closePopup(c);}});
    on(document,'pointerdown',event=>{if(c.popup&&!c.popup.contains(event.target)&&!stage.contains(event.target))closePopup(c);},{capture:true});
    on(document,'pointermove',event=>{if(!c.active||!c.popup?.classList.contains('face-name')||touchMode(event))return;const r=screenFace(c,c.active);if(event.clientX<r.x||event.clientX>r.x+r.width||event.clientY<r.y||event.clientY>r.y+r.height)closePopup(c);},{passive:true});
    on(document,'keydown',event=>{if(event.key==='Escape'&&(c.popup||c.adjust)){event.preventDefault();closePopup(c);}},{capture:true});
    on(c.dialog,'scroll',()=>{if(c.popup?.classList.contains('face-name'))closePopup(c);else place(c);},{passive:true});
    on(window,'resize',()=>place(c));if(window.visualViewport){on(window.visualViewport,'resize',()=>place(c));on(window.visualViewport,'scroll',()=>place(c));}
    if(typeof ResizeObserver!=='undefined'){c.resize=new ResizeObserver(()=>place(c));c.resize.observe(image);c.resize.observe(stage);}
    c.loading=load(c).catch(error=>{c.loadError=true;if(error.name!=='AbortError')announce(c,tr('אפשר להוסיף תיוג פנים אחרי שהחיבור יחזור.','Face tags can be added when the connection returns.'));throw error;});c.loading.catch(()=>{});
    const imageReady=()=>new Promise(resolve=>{if(image.complete&&image.naturalWidth)resolve();else on(image,'load',resolve,{once:true});});
    await imageReady();if(!live(c))return;place(c);
    try{const detector=await import('./face-detector.mjs?v=2'),found=await detector.detectFaces(item.id,image,c.events.signal);if(!live(c))return;c.detected=found.map(face=>({id:uuid(),rect:face.rect,score:face.score,revision:null}));stage.dataset.faceDetection='ready';stage.dataset.faceEngine=found.engine;paint(c);}
    catch(error){if(live(c)&&error.name!=='AbortError'){stage.dataset.faceDetection='manual';console.warn('Face detection unavailable:',error.message);announce(c,tr('אפשר ללחוץ על הפנים בתמונה ולתייג גם ידנית.','You can click a face to tag it manually.'));}}
  }
  function update(item){if(current?.item.id===item.id)current.item=item;}
  document.addEventListener('DOMContentLoaded',()=>{
    window.addEventListener('family-media-changed',event=>{
      const result=event.detail,id=result.item?.id;if(!id)return;
      if(result.faces)remember(id,result.faces,result.item);else if(['tags','untag','retag','delete','restore'].includes(result.operation))labels.delete(id);
      const c=current;if(!c||c.item.id!==id)return;
      if(result.faces)apply(c,result.faces);else if(['tags','untag','retag','restore'].includes(result.operation))load(c,true).catch(()=>{});
    });
  });
  window.FamilyFaces={mount,clear,update};
})();
