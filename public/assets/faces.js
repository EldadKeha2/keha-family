(() => {
  'use strict';
  const I=window.FamilyI18n,tr=(he,en)=>I.isEnglish?en:he;
  const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normalizeName=value=>String(value??'').normalize('NFKD').replace(/[\u0591-\u05c7'"׳״]/g,'').replace(/\s+/g,' ').toLowerCase().trim();
  const choices='[data-face-person],[data-face-add]';
  const labels=new Map();let current=null,serial=0,geometry=null;
  const remember=(id,faces,item,detectedFaces=labels.get(id)?.detectedFaces||[],ignoredFaces=labels.get(id)?.ignoredFaces||[])=>{labels.set(id,{faces,detectedFaces,ignoredFaces,time:Date.now(),tagsRevision:item?.tagsRevision,reviewed:Boolean(item?.faceSummary?.reviewed)});if(labels.size>128)labels.delete(labels.keys().next().value);};
  const helpers=()=>geometry||=import('./face-geometry.mjs?v=6');
  const uuid=()=>crypto.randomUUID?crypto.randomUUID().replaceAll('-',''):[...crypto.getRandomValues(new Uint8Array(16))].map(byte=>byte.toString(16).padStart(2,'0')).join('');
  const touchMode=event=>event?.pointerType==='touch'||matchMedia('(hover:none), (max-width:700px)').matches;
  const desktopResize=()=>!touchMode();
  const live=c=>current===c&&!c.events.signal.aborted;
  const imageWidth=image=>image.naturalWidth||image.width;
  const imageHeight=image=>image.naturalHeight||image.height;
  const photoName=face=>face.person?I.personName(face.person):'';
  const profileFor=face=>{const person=window.FamilyApp?.getPerson?.(face.personId||face.person?.id);return person&&!person.extra&&!face.person?.extra?person:null;};
  function nameHTML(face,links=true){
    const profile=links&&profileFor(face),name=safe(photoName(face));
    return profile?`<a class="face-profile-link" data-face-profile href="#person/${encodeURIComponent(profile.id)}" dir="auto" aria-label="${safe(tr('פתיחת הפרופיל של ','Open the profile of ')+photoName(face))}">${name}</a>`:`<span dir="auto">${name}</span>`;
  }
  function bindProfile(c,host,face){
    const profile=profileFor(face);if(!profile||c.adapter)return;
    host.querySelector('[data-face-profile]').addEventListener('click',event=>{
      if(event.button>0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
      event.preventDefault();event.stopPropagation();if(live(c)&&profileFor(face))window.FamilyApp.openPerson(profile.id);
    });
  }
  async function request(path,options={}){
    const response=await I.fetch(path,{cache:'no-store',...options,headers:{...(options.body?{'Content-Type':'application/json','X-Family-Token':window.FAMILY_API_TOKEN}:{}),...options.headers}});
    let result;try{result=await response.json();}catch{throw Error(tr('לא התקבל אישור מהשרת. נסו שוב.','No confirmation was received. Please try again.'));}
    if(!response.ok)throw Error(I.error(result.error)||tr('תיוג הפנים לא נשמר.','The face tag was not saved.'));return result;
  }
  function announce(c,message){if(live(c))c.status.textContent=message;}
  function changed(c,result){if(c.adapter){c.item={...c.item,...result.item};c.reviewed=Boolean(c.item.faceSummary?.reviewed);}else window.dispatchEvent(new CustomEvent('family-media-changed',{detail:result}));}
  function closePopup(c){
    clearTimeout(c.labelTimer);c.labelTimer=null;c.popup?.remove();c.popup=null;c.active=null;if(c.selection)c.selection.hidden=true;c.adjust=false;c.drag=null;c.resizeDrag=null;c.stage.classList.remove('face-adjusting','face-resizing');if(c.guide)c.guide.hidden=true;
  }
  function keepLabel(c){clearTimeout(c.labelTimer);c.labelTimer=null;}
  function dismissLabelSoon(c){
    if(c.labelTimer||!c.popup?.classList.contains('face-name'))return;const bubble=c.popup;
    c.labelTimer=setTimeout(()=>{c.labelTimer=null;if(live(c)&&c.popup===bubble&&!bubble.contains(document.activeElement))closePopup(c);},250);
  }
  function clear(){
    const c=current;if(!c)return;current=null;c.events.abort();c.resize?.disconnect();clearTimeout(c.labelTimer);c.popup?.remove();c.layer?.remove();c.guide?.remove();c.status?.remove();c.toolbar?.remove();c.missingNote?.remove();c.reviewButton?.remove();c.reviewStatus?.remove();c.scroller?.replaceWith(c.image);c.stage.classList.remove('has-face-layer','face-adjusting','face-resizing','has-face-zoom');window.dispatchEvent(new CustomEvent('family-face-viewer',{detail:{active:false}}));
  }
  function viewport(){const v=window.visualViewport;return {left:v?.offsetLeft||0,top:v?.offsetTop||0,width:Math.min(v?.width||innerWidth,document.documentElement.clientWidth||innerWidth),height:v?.height||innerHeight};}
  function imageArea(c){
    const r=c.image.getBoundingClientRect(),ratio=imageWidth(c.image)/imageHeight(c.image);let width=r.width,height=r.height;
    if(width/height>ratio)width=height*ratio;else height=width/ratio;
    return {x:r.left+(r.width-width)/2,y:r.top+(r.height-height)/2,width,height};
  }
  function screenFace(c,face){const image=imageArea(c),r=face.rect;return {x:image.x+r.x*image.width,y:image.y+r.y*image.height,width:r.width*image.width,height:r.height*image.height};}
  function place(c){
    if(!live(c)||!imageWidth(c.image))return;const image=imageArea(c),stage=(c.surface||c.stage).getBoundingClientRect();
    Object.assign(c.hits.style,{left:(image.x-stage.left)+'px',top:(image.y-stage.top)+'px',width:image.width+'px',height:image.height+'px'});
    for(const {node,face}of c.annotationNodes||[]){
      node.style.maxWidth=Math.min(200,image.width)+'px';const r=node.getBoundingClientRect();
      Object.assign(node.style,{left:Math.max(0,Math.min(image.width-r.width,(face.rect.x+face.rect.width/2)*image.width-r.width/2))+'px',top:Math.max(0,face.rect.y*image.height-r.height-3)+'px'});
    }
    if(c.active&&!c.selection.hidden)Object.assign(c.selection.style,{left:c.active.rect.x*100+'%',top:c.active.rect.y*100+'%',width:c.active.rect.width*100+'%',height:c.active.rect.height*100+'%'});
    if(c.popup&&c.active){
      const v=viewport(),r=c.popup.getBoundingClientRect(),p=c.geom.popoverPosition(screenFace(c,c.active),{width:r.width||270,height:r.height||180},v);
      Object.assign(c.popup.style,{left:p.x+'px',top:p.y+'px',maxHeight:p.maxHeight+'px',maxWidth:p.width+'px'});
    }
  }
  function fitZoom(c){
    if(!c.surface)return;const maxHeight=parseFloat(getComputedStyle(c.scroller).maxHeight)||innerHeight*.48;
    const scale=Math.min(1,c.scroller.clientWidth/imageWidth(c.image),maxHeight/imageHeight(c.image));
    c.base={width:imageWidth(c.image)*scale,height:imageHeight(c.image)*scale};
    Object.assign(c.surface.style,{width:c.base.width*c.zoom+'px',height:c.base.height*c.zoom+'px'});place(c);
  }
  function setZoom(c,value){
    if(c.saving)return;const before=imageArea(c),r=c.scroller.getBoundingClientRect(),anchor={x:r.left+c.scroller.clientWidth/2,y:r.top+c.scroller.clientHeight/2};
    const p={x:(anchor.x-before.x)/before.width,y:(anchor.y-before.y)/before.height};
    closePopup(c);c.zoom=value;fitZoom(c);const after=imageArea(c);
    c.scroller.scrollLeft+=after.x+p.x*after.width-anchor.x;c.scroller.scrollTop+=after.y+p.y*after.height-anchor.y;
    c.toolbar.querySelector('[data-face-zoom-level]').textContent=Math.round(value*100)+'%';c.toolbar.querySelector('[data-face-zoom-out]').disabled=value===1;c.toolbar.querySelector('[data-face-zoom-in]').disabled=value===8;
    c.toolbar.querySelector('[data-face-zoom-reset]').disabled=value===1;place(c);
  }
  function setupZoom(c){
    c.zoom=1;c.scroller=document.createElement('div');c.scroller.className='face-photo-scroll';c.scroller.dir='ltr';c.scroller.tabIndex=0;c.scroller.setAttribute('aria-label',tr('התמונה לתיוג. בהגדלה אפשר לגלול לכל אזור.','Photo for tagging. Scroll to any area when enlarged.'));
    c.surface=document.createElement('div');c.surface.className='face-photo-surface';c.surface.append(c.image,c.layer);c.scroller.append(c.surface);c.stage.append(c.scroller,c.guide);c.stage.classList.add('has-face-zoom');
    c.toolbar=document.createElement('div');c.toolbar.className='face-zoom-toolbar';c.toolbar.setAttribute('role','group');c.toolbar.setAttribute('aria-label',tr('הגדלה לדיוק תיוג פנים','Zoom for precise face tagging'));
    c.toolbar.innerHTML=`<span>${tr('פנים קטנות? הגדילו לתּיוג מדויק','Small faces? Zoom in to tag precisely')}</span><div><button type="button" data-face-zoom-out disabled aria-label="${tr('הקטנת התמונה','Zoom out')}">−</button><output data-face-zoom-level aria-live="polite">100%</output><button type="button" data-face-zoom-in aria-label="${tr('הגדלת התמונה','Zoom in')}">＋</button><button type="button" data-face-zoom-reset disabled>${tr('התאמה למסך','Fit photo')}</button><button type="button" data-face-ignore-undo hidden>${tr('ביטול התעלמות מזיהוי','Undo ignored detection')}</button></div>`;
    c.stage.before(c.toolbar);const levels=[1,1.5,2,3,4,6,8];
    c.toolbar.querySelector('[data-face-zoom-in]').addEventListener('click',()=>setZoom(c,levels[Math.min(levels.length-1,levels.indexOf(c.zoom)+1)]));
    c.toolbar.querySelector('[data-face-zoom-out]').addEventListener('click',()=>setZoom(c,levels[Math.max(0,levels.indexOf(c.zoom)-1)]));
    c.toolbar.querySelector('[data-face-zoom-reset]').addEventListener('click',()=>setZoom(c,1));
    c.ignoreUndo=c.toolbar.querySelector('[data-face-ignore-undo]');c.ignoreUndo.hidden=!c.ignored.length;c.ignoreUndo.addEventListener('click',()=>ignore(c,c.ignored.at(-1),false));
    c.scroller.addEventListener('scroll',()=>place(c),{passive:true,signal:c.events.signal});
    c.scroller.addEventListener('pointerdown',event=>{c.scrollStart={x:c.scroller.scrollLeft,y:c.scroller.scrollTop};},{passive:true,signal:c.events.signal});
    fitZoom(c);
  }
  function paint(c){
    if(!live(c))return;c.faces=c.geom.mergeFaces(c.saved,c.reviewed?[]:c.detected.filter(face=>!c.ignored.some(rect=>c.geom.labelledRegion(rect,face.rect))));if(c.reviewButton){const label=c.reviewed?tr('כל הפרצופים תויגו · לחצו לביטול האישור','All faces tagged · Click to undo confirmation'):tr('אישור שכל הפרצופים תויגו','Confirm all faces are tagged');c.reviewButton.setAttribute('aria-label',label);c.reviewButton.title=label;c.reviewButton.setAttribute('aria-pressed',String(c.reviewed));}c.buttons.replaceChildren();
    for(const face of c.faces){
      const button=document.createElement('button');button.type='button';button.className='face-hit';if(c.highlightMissing&&!face.person)button.classList.add('face-missing');button.dataset.faceId=face.id;button.setAttribute('aria-label',face.person?tr('פנים בתמונה: ','Face in photo: ')+photoName(face):tr('תיוג הפנים האלה','Tag this face'));
      Object.assign(button.style,{left:face.rect.x*100+'%',top:face.rect.y*100+'%',width:face.rect.width*100+'%',height:face.rect.height*100+'%'});
      button.addEventListener('pointerenter',event=>{if(!touchMode(event)&&face.person&&!c.popup?.classList.contains('face-picker'))showLabel(c,face,false);},{signal:c.events.signal});
      button.addEventListener('pointerleave',event=>{if(!touchMode(event)&&c.popup?.classList.contains('face-name')&&!c.popup.contains(event.relatedTarget))dismissLabelSoon(c);},{signal:c.events.signal});
      button.addEventListener('focus',()=>{if(face.person&&!c.popup?.classList.contains('face-picker'))showLabel(c,face,touchMode());},{signal:c.events.signal});
      button.addEventListener('blur',event=>{if(!c.popup?.contains(event.relatedTarget)&&c.popup?.classList.contains('face-name'))closePopup(c);},{signal:c.events.signal});
      c.buttons.append(button);
    }
    if(c.missingNote)c.missingNote.hidden=c.reviewed;
    if(c.missingNote&&c.reviewed)c.missingNote.textContent='';
    else if(c.missingNote){const count=c.faces.filter(face=>!face.person).length;c.missingNote.textContent=count?tr('פנים ללא תיוג: ','Faces without labels: ')+count+tr(' · לחצו על המסגרת והוסיפו שם.',' · Select a frame and add a name.'):c.faces.length?tr('כל הפנים שזוהו מתויגות ✓','All detected faces are labelled ✓'):tr('מזהים פנים בתמונה…','Finding faces in the photo…');}
    if(c.ignoreUndo)c.ignoreUndo.hidden=!c.ignored.length;paintAnnotations(c);place(c);
  }
  function paintAnnotations(c){
    if(!live(c)||!c.annotations)return;c.annotations.replaceChildren();c.annotationNodes=[];
    const options=window.FamilyPhotoDate?.overlays?.(c.item.id);if(!options?.showNames&&!options?.showAges)return;
    for(const face of c.faces){
      if(!face.person)continue;const age=options.showAges?window.FamilyPhotoDate.ageFor(face.person,c.item):null;
      if(!options.showNames&&!age)continue;
      const node=document.createElement('div');node.className='face-visible-label';node.dataset.faceId=face.id;node.dir=I.isEnglish?'ltr':'rtl';
      node.innerHTML=(options.showNames?nameHTML(face):'')+(age?`<span class="face-visible-age" dir="auto" title="${safe(age.title)}">${safe(age.text)}</span>`:'');
      if(options.showNames)bindProfile(c,node,face);c.annotations.append(node);c.annotationNodes.push({node,face});
    }
  }
  function apply(c,faces){
    c.saved=faces;if(c.active){const updated=faces.find(face=>face.id===c.active.id);if(updated)c.active=updated;else if(c.active.person&&!c.saving)closePopup(c);}
    paint(c);
  }
  async function load(c,force=false){
    if(c.adapter){const result=await c.adapter.load();if(!live(c))return;changed(c,result);c.ignored=result.ignoredFaces||[];c.ready=true;apply(c,result.faces);return;}
    const cached=labels.get(c.item.id);
    if(!force&&cached&&cached.tagsRevision===c.item.tagsRevision&&cached.reviewed===Boolean(c.item.faceSummary?.reviewed)&&Date.now()-cached.time<30000){c.reviewed=cached.reviewed;c.ignored=cached.ignoredFaces||[];if(!c.detected.length)c.detected=cached.detectedFaces.map(face=>({...face,id:uuid()}));apply(c,cached.faces);c.ready=true;return;}
    const result=await request('api/media/'+c.item.id+'/faces',{signal:c.events.signal});
    if(!live(c))return;const priorRevision=c.item.tagsRevision,priorReview=c.reviewed;if(result.item){c.item={...c.item,...result.item};c.reviewed=Boolean(result.item.faceSummary?.reviewed);}c.ignored=result.ignoredFaces||[];remember(c.item.id,result.faces,result.item,result.detectedFaces,c.ignored);if(!c.detected.length)c.detected=(result.detectedFaces||[]).map(face=>({...face,id:uuid()}));c.ready=true;c.loadError=false;apply(c,result.faces);
    if(result.item&&(result.item.tagsRevision!==priorRevision||c.reviewed!==priorReview))window.dispatchEvent(new CustomEvent('family-media-changed',{detail:{operation:'faces',scope:result.item.scope,item:result.item,faces:result.faces}}));
  }
  function showLabel(c,face,touch){
    if(!live(c)||!face.person)return;closePopup(c);c.active=face;
    const bubble=document.createElement('div');bubble.className='face-popover face-name';bubble.setAttribute('role','group');bubble.setAttribute('aria-label',tr('מי בתמונה','Who is in the photo'));bubble.dir=I.isEnglish?'ltr':'rtl';
    bubble.innerHTML=nameHTML(face,!c.adapter)+(touch?`<button type="button" data-face-edit aria-label="${tr('עריכת תיוג הפנים','Edit face tag')}">✎</button>`:'');bindProfile(c,bubble,face);
    bubble.addEventListener('pointerenter',()=>keepLabel(c));
    bubble.addEventListener('pointerleave',event=>{if(!touchMode(event))dismissLabelSoon(c);});
    bubble.addEventListener('focusin',()=>keepLabel(c));
    bubble.addEventListener('focusout',event=>{if(!bubble.contains(event.relatedTarget))closePopup(c);});
    if(touch)bubble.querySelector('[data-face-edit]').addEventListener('click',()=>openPicker(c,face));
    c.popup=bubble;c.dialog.append(bubble);place(c);if(touch)c.labelTimer=setTimeout(()=>{if(live(c)&&c.popup===bubble)closePopup(c);},3000);
  }
  async function results(c,query){
    const panel=c.popup;if(c.saving||!panel?.classList.contains('face-picker'))return;const sequence=++c.searchSequence,host=panel.querySelector('[data-face-results]');
    host.replaceChildren();host.setAttribute('aria-busy','true');
    try{
      const people=await (c.adapter?.findPeople||window.FamilyTags.findPeople)(query,(c.item.tags||[]).map(person=>person.id));if(!live(c)||c.saving||c.popup!==panel||sequence!==c.searchSequence)return;
      const name=String(query).trim().replace(/\s+/g,' '),key=normalizeName(name),exact=people.some(person=>[person.name,person.nameEn].filter(Boolean).some(alias=>normalizeName(alias)===key));
      host.innerHTML=people.map(person=>`<button class="face-person-option" type="button" role="option" data-face-person="${safe(person.id)}" aria-selected="${person.id===c.active?.personId}"><span class="face-person-check" aria-hidden="true">${person.id===c.active?.personId?'✓':'＋'}</span><span><strong dir="auto">${safe(I.personName(person))}</strong><small>${safe(person.context)}</small></span></button>`).join('')||`<p class="face-no-results">${tr('לא נמצא שם מתאים. אפשר להוסיף שם חדש.','No matching name. You can add a new name.')}</p>`;
      if(key&&!exact)host.innerHTML+=`<button class="face-person-option face-add-name" type="button" role="option" data-face-add aria-selected="false"><span class="face-person-check" aria-hidden="true">＋</span><span><strong dir="auto">${tr('הוספת השם ״','Add “')}${safe(name)}${tr('״','”')}</strong><small>${tr('תיוג הפנים בשם חדש','Tag this face with a new name')}</small></span></button>`;
      for(const button of host.querySelectorAll('[data-face-person]'))button.addEventListener('click',()=>save(c,{personId:button.dataset.facePerson}));
      host.querySelector('[data-face-add]')?.addEventListener('click',()=>save(c,{name}));place(c);
      host.setAttribute('aria-busy','false');
    }catch(error){if(live(c)&&c.popup===panel&&sequence===c.searchSequence){host.setAttribute('aria-busy','false');panel.querySelector('[data-face-status]').textContent=error.message;}}
  }
  async function openPicker(c,face,{preserveRect=false}={}){
    if(!live(c)||c.saving)return;closePopup(c);c.active=face;c.selection.hidden=false;
    if(c.loadError){c.loadError=false;c.loading=load(c,true).catch(error=>{c.loadError=true;throw error;});c.loading.catch(()=>{});}
    const panel=document.createElement('div');panel.className='face-popover face-picker';panel.setAttribute('role','dialog');panel.setAttribute('aria-label',tr('תיוג פנים בתמונה','Tag a face in the photo'));panel.dir=I.isEnglish?'ltr':'rtl';
    panel.innerHTML=`<header><strong>${tr('מי בתמונה?','Who is this?')}</strong><button type="button" data-face-close aria-label="${tr('סגירה','Close')}">×</button></header>${face.person?`<p class="face-current-name" dir="auto">${safe(photoName(face))}</p>`:''}<label class="visually-hidden" for="facePersonSearch">${tr('חיפוש או הוספת שם','Search or add a name')}</label><input id="facePersonSearch" type="search" autocomplete="off" maxlength="120" placeholder="${tr('חפשו או הוסיפו שם…','Search or add a name…')}" aria-controls="facePersonResults" aria-autocomplete="list"><div id="facePersonResults" class="face-person-results" data-face-results role="listbox" aria-label="${tr('שמות לתיוג הפנים','Names for this face')}"></div><p class="face-save-status" data-face-status role="status"></p><div class="face-picker-actions"><button type="button" data-face-adjust>${tr('דיוק אזור הפנים','Adjust face area')}</button>${face.person?`<button type="button" data-face-remove>${tr('הסרת התיוג הזה','Remove this tag')}</button>`:`<button type="button" data-face-ignore>${tr('התעלמות מהזיהוי הזה','Ignore this detection')}</button>`}</div>`;
    c.popup=panel;c.dialog.append(panel);place(c);
    const input=panel.querySelector('input');input.addEventListener('input',()=>results(c,input.value));
    input.addEventListener('keydown',event=>{if(event.isComposing)return;if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closePopup(c);}if(event.key==='ArrowDown'){event.preventDefault();panel.querySelector(choices)?.focus();}if(event.key==='Enter'){event.preventDefault();event.stopPropagation();const options=[...panel.querySelectorAll(choices)];if(options.length===1)options[0].click();else options[0]?.focus();}});
    panel.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closePopup(c);}else if(['ArrowDown','ArrowUp'].includes(event.key)&&event.target.matches(choices)){event.preventDefault();const buttons=[...panel.querySelectorAll(choices)],index=buttons.indexOf(event.target);buttons[(index+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus();}});
    panel.querySelector('[data-face-close]').addEventListener('click',()=>closePopup(c));
    panel.querySelector('[data-face-adjust]').addEventListener('click',()=>{panel.remove();c.popup=null;c.active={...c.active,rect:{...c.active.rect}};c.adjust=true;c.guide.hidden=false;c.stage.classList.add('face-adjusting');place(c);});
    panel.querySelector('[data-face-remove]')?.addEventListener('click',()=>save(c,{personId:null}));
    panel.querySelector('[data-face-ignore]')?.addEventListener('click',()=>ignore(c,face.rect,true));
    input.focus({preventScroll:true});results(c,'');
    try{
      await c.loading;if(!live(c)||c.popup!==panel)return;
      const stored=c.saved.find(saved=>saved.id===face.id||c.geom.sameRegion(saved.rect,face.rect));if(stored){c.active=preserveRect?{...stored,rect:face.rect}:stored;place(c);}
    }catch(error){if(live(c)&&c.popup===panel)panel.querySelector('[data-face-status]').textContent=tr('לא ניתן לקרוא את תיוגי הפנים כרגע. סגרו ונסו שוב.','Face labels are currently unavailable. Close and try again.');}
  }
  async function ignore(c,rect,ignored){
    if(!live(c)||c.saving||!rect)return;const panel=c.popup;c.saving=true;if(c.ignoreUndo)c.ignoreUndo.disabled=true;
    try{
      await c.loading;if(!live(c))return;
      const payload={rect,ignored,photoRevision:c.item.photoRevision||'original'},result=c.adapter?await c.adapter.ignore(payload):await request('api/media/'+c.item.id+'/faces/ignore',{method:'POST',body:JSON.stringify(payload)});
      changed(c,result);
      if(live(c)){c.ignored=result.ignoredFaces;closePopup(c);paint(c);window.FamilyApp?.toast?.(ignored?tr('הזיהוי הוסתר בתמונה הזו. אפשר לבטל בסרגל ההגדלה.','Detection ignored in this photo. Undo is available in the zoom toolbar.'):tr('ההתעלמות מהזיהוי בוטלה.','Ignored detection restored.'));}
    }catch(error){if(live(c)){if(panel?.querySelector('[data-face-status]'))panel.querySelector('[data-face-status]').textContent=error.message;else announce(c,error.message);}}
    finally{c.saving=false;if(c.ignoreUndo)c.ignoreUndo.disabled=false;}
  }
  async function resized(c,face){
    if(!live(c))return;c.resizeDrag=null;c.stage.classList.remove('face-resizing');c.skipClick=true;setTimeout(()=>{if(live(c))c.skipClick=false;},0);
    c.adjusted.set(face.id,{original:c.adjusted.get(face.id)?.original||c.faces.find(other=>other.id===face.id)?.rect||face.rect,rect:face.rect});
    c.detected=c.detected.map(other=>other.id===face.id?{...other,rect:face.rect}:other);
    await openPicker(c,face,{preserveRect:true});if(live(c)&&face.personId)await save(c,{personId:face.personId});
  }
  function save(c,selection){const pending=saveFace(c,selection);c.pendingSave=pending;return pending;}
  async function saveFace(c,selection){
    if(!live(c)||c.saving||!c.active)return;const panel=c.popup,face={...c.active};c.saving=true;
    if(panel){panel.querySelector('[data-face-status]').textContent=tr('שומר את התיוג…','Saving the tag…');for(const control of panel.querySelectorAll('button,input'))control.disabled=true;}
    try{
      await c.loading;if(!c.adapter)await window.FamilyTags.flush(c.item.id);if(!live(c))return;
      const known=c.saved.find(saved=>saved.id===face.id||c.geom.sameRegion(saved.rect,face.rect));
      const payload={faceId:known?.id||face.id,...selection,rect:face.rect,expectedRevision:known?.revision||null},result=c.adapter?await c.adapter.save(payload):await request('api/media/'+c.item.id+'/faces/save',{method:'POST',body:JSON.stringify(payload)});
      if(!c.adapter)remember(c.item.id,result.faces,result.item);changed(c,result);
      if(live(c)){c.saving=false;apply(c,result.faces);closePopup(c);announce(c,result.face?tr('תיוג הפנים נשמר ונוסף גם לתיוגי התמונה.','Face label saved and added to the photo’s tags.'):tr('התיוג הוסר מהפנים. אם אין לאדם תיוג פנים נוסף בתמונה, הוא הוסר גם מרשימת השמות.','Face tag removed. If this person has no other labelled face in the photo, their name was also removed.'));if(result.face)showLabel(c,result.face,touchMode());}
    }catch(error){if(live(c)&&c.popup===panel&&panel){panel.querySelector('[data-face-status]').textContent=error.message;for(const control of panel.querySelectorAll('button,input'))control.disabled=false;}}
    finally{c.saving=false;}
  }
  function point(c,event,clamp=false){if(!imageWidth(c.image))return null;const r=imageArea(c);if(!clamp&&(event.clientX<r.x||event.clientX>r.x+r.width||event.clientY<r.y||event.clientY>r.y+r.height))return null;return {x:Math.max(0,Math.min(1,(event.clientX-r.x)/r.width)),y:Math.max(0,Math.min(1,(event.clientY-r.y)/r.height))};}
  async function mount(stage,image,item,{highlightMissing=false,adapter=null,dialog:hostDialog,reviewHost=null,zoom=true,detectionImage=null}={}){
    clear();if(item.kind!=='photo'||!item.id||!window.FamilyApp?.apiEnabled)return;
    const c={serial:++serial,stage,image,item,adapter,highlightMissing,reviewed:Boolean(item.faceSummary?.reviewed),dialog:hostDialog||document.getElementById('mediaViewer'),events:new AbortController(),saved:[],detected:[],ignored:[],adjusted:new Map(),faces:[],active:null,popup:null,ready:false,searchSequence:0,saving:false,adjust:false,drag:null,skipClick:false};current=c;window.dispatchEvent(new CustomEvent('family-face-viewer',{detail:{active:true}}));
    c.geom=await helpers();if(!live(c))return;
    c.layer=document.createElement('div');c.layer.className='face-layer';c.hits=document.createElement('div');c.hits.className='face-image-area';c.buttons=document.createElement('div');c.buttons.className='face-hit-buttons';c.annotations=document.createElement('div');c.annotations.className='face-visible-labels';c.annotationNodes=[];c.selection=document.createElement('div');c.selection.className='face-selection';c.selection.hidden=true;c.hits.append(c.buttons,c.annotations,c.selection);c.layer.append(c.hits);
    if(desktopResize())for(const handle of ['nw','n','ne','e','se','s','sw','w']){const node=document.createElement('button');node.type='button';node.className='face-resize-handle face-handle-'+handle;node.dataset.faceHandle=handle;node.setAttribute('aria-label',tr('שינוי גודל מסגרת הפנים','Resize face frame'));node.addEventListener('keydown',event=>{if(!c.active||c.saving||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();event.stopPropagation();const r=c.active.rect,area=imageArea(c),step=event.shiftKey?10:1,p={x:handle.includes('w')?r.x:r.x+r.width,y:handle.includes('n')?r.y:r.y+r.height};p.x+=(event.key==='ArrowLeft'?-step:event.key==='ArrowRight'?step:0)/area.width;p.y+=(event.key==='ArrowUp'?-step:event.key==='ArrowDown'?step:0)/area.height;resized(c,{...c.active,rect:c.geom.resizeFaceRect(r,handle,p)});});c.selection.append(node);}
    c.guide=document.createElement('div');c.guide.className='face-adjust-guide';c.guide.hidden=true;c.guide.innerHTML=`<span>${tr('סמנו מסביב לפנים בעזרת גרירה','Drag around the face')}</span><button type="button">${tr('ביטול','Cancel')}</button>`;c.guide.querySelector('button').addEventListener('click',()=>closePopup(c));c.layer.append(c.guide);
    c.status=document.createElement('p');c.status.className='visually-hidden';c.status.setAttribute('role','status');c.status.setAttribute('aria-live','polite');stage.append(c.layer,c.status);stage.classList.add('has-face-layer');
    if(highlightMissing){c.missingNote=document.createElement('p');c.missingNote.className='face-missing-note';c.missingNote.setAttribute('role','status');stage.before(c.missingNote);}
    const on=(target,type,callback,options={})=>target.addEventListener(type,callback,{...options,signal:c.events.signal});
    if(adapter||item.scope==='gallery'||item.collections?.includes('gallery')){
      c.reviewButton=document.createElement('button');c.reviewButton.type='button';c.reviewButton.className='face-review-button';
      c.reviewButton.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="10" cy="10" r="7.5"/><path d="M7 8h.01M13 8h.01M7 11.5a3.3 3.3 0 0 0 5.5.7"/><circle class="face-review-badge" cx="18" cy="17.5" r="5.5"/><path class="face-review-check" d="m15.5 17.5 1.7 1.7 3.3-3.5"/></svg>';
      if(reviewHost)reviewHost.append(c.reviewButton);else document.getElementById('mediaViewerTitle').insertBefore(c.reviewButton,document.getElementById('editOpenedPhoto'));
      c.reviewStatus=document.createElement('span');c.reviewStatus.className='face-review-status';c.reviewStatus.hidden=true;c.reviewStatus.setAttribute('role','status');stage.before(c.reviewStatus);
      on(c.reviewButton,'click',async()=>{
        if(!live(c)||c.reviewSaving||c.saving)return;c.reviewSaving=true;c.reviewButton.disabled=true;c.reviewButton.setAttribute('aria-busy','true');c.reviewStatus.hidden=true;c.reviewStatus.textContent='';
        try{
          await c.loading;if(!c.adapter)await window.FamilyTags?.flush?.(c.item.id);if(!live(c))return;
          const payload={complete:!c.reviewed,photoRevision:c.item.photoRevision||'original',tagsRevision:c.item.tagsRevision||'empty'},result=c.adapter?await c.adapter.review(payload):await request('api/media/'+item.id+'/faces/review',{method:'POST',body:JSON.stringify(payload)});
          changed(c,result);
          if(live(c)){c.item={...c.item,...result.item};c.reviewed=Boolean(result.item.faceSummary?.reviewed);closePopup(c);paint(c);announce(c,c.reviewed?tr('כל הפרצופים תויגו.','All faces tagged.'):tr('אישור התיוג בוטל.','Tagging confirmation removed.'));}
        }catch(error){if(live(c)){c.reviewStatus.hidden=false;c.reviewStatus.textContent=error.message;}}
        finally{c.reviewSaving=false;if(live(c)){c.reviewButton.disabled=false;c.reviewButton.setAttribute('aria-busy','false');}}
      });
      paint(c);
    }

    on(stage,'click',event=>{
      if(!live(c)||c.saving||(c.adapter&&!c.adapter.enabled())||event.target.closest('.face-adjust-guide')||event.target.closest('[data-face-handle]')||c.adjust)return;
      if(c.skipClick){c.skipClick=false;return;}
      if(c.scrollStart&&c.scroller&&(Math.abs(c.scroller.scrollLeft-c.scrollStart.x)>5||Math.abs(c.scroller.scrollTop-c.scrollStart.y)>5)){c.scrollStart=null;return;}c.scrollStart=null;
      const keyboard=event.detail===0&&event.target.matches('.face-hit');const p=keyboard?null:point(c,event);if(!keyboard&&!p)return;
      const area=imageArea(c),face=keyboard?c.faces.find(face=>face.id===event.target.dataset.faceId):c.geom.chooseFace(c.faces,p,area)||{id:uuid(),rect:c.geom.manualRect(p,area),revision:null};
      if(!face)return;event.preventDefault();if(face.person&&touchMode(event)&&!keyboard)showLabel(c,face,true);else openPicker(c,face);
    });
    on(stage,'pointerdown',event=>{
      const handle=event.target.closest('[data-face-handle]');
      if(handle&&desktopResize()&&c.active&&!c.saving){const p=point(c,event);if(!p)return;event.preventDefault();c.resizeDrag={handle:handle.dataset.faceHandle,rect:{...c.active.rect}};c.active={...c.active,rect:{...c.active.rect}};c.popup?.remove();c.popup=null;c.stage.classList.add('face-resizing');stage.setPointerCapture?.(event.pointerId);return;}
      if(!c.adjust||event.target.closest('.face-adjust-guide'))return;const p=point(c,event);if(!p)return;event.preventDefault();c.drag=p;stage.setPointerCapture?.(event.pointerId);
    });
    on(stage,'pointermove',event=>{const p=point(c,event,Boolean(c.resizeDrag));if(c.resizeDrag&&p){event.preventDefault();c.active.rect=c.geom.resizeFaceRect(c.resizeDrag.rect,c.resizeDrag.handle,p);place(c);return;}if(!c.adjust||!c.drag||!p)return;event.preventDefault();c.active.rect=c.geom.clampRect({x:Math.min(p.x,c.drag.x),y:Math.min(p.y,c.drag.y),width:Math.abs(p.x-c.drag.x),height:Math.abs(p.y-c.drag.y)});c.selection.hidden=false;place(c);});
    on(stage,'pointerup',event=>{if(c.resizeDrag){event.preventDefault();resized(c,c.active);return;}if(!c.adjust||!c.drag)return;event.preventDefault();c.drag=null;c.adjust=false;c.skipClick=true;stage.classList.remove('face-adjusting');c.guide.hidden=true;const face=c.active;openPicker(c,face,{preserveRect:true});});
    on(stage,'pointercancel',()=>{if(c.adjust||c.resizeDrag){c.drag=null;closePopup(c);}});
    on(document,'pointerdown',event=>{if(c.popup&&!c.popup.contains(event.target)&&!stage.contains(event.target))closePopup(c);},{capture:true});
    on(document,'pointermove',event=>{if(!c.active||!c.popup?.classList.contains('face-name')||touchMode(event))return;const r=screenFace(c,c.active);if(c.popup.contains(event.target)||(event.clientX>=r.x&&event.clientX<=r.x+r.width&&event.clientY>=r.y&&event.clientY<=r.y+r.height))keepLabel(c);else dismissLabelSoon(c);},{passive:true});
    on(document,'keydown',event=>{if(event.key==='Escape'&&(c.popup||c.adjust)){event.preventDefault();event.stopPropagation();closePopup(c);}},{capture:true});
    on(c.dialog,'scroll',()=>{if(c.popup?.classList.contains('face-name'))closePopup(c);else place(c);},{passive:true});
    on(window,'resize',()=>{fitZoom(c);place(c);});if(window.visualViewport){on(window.visualViewport,'resize',()=>place(c));on(window.visualViewport,'scroll',()=>place(c));}
    if(typeof ResizeObserver!=='undefined'){c.resize=new ResizeObserver(()=>place(c));c.resize.observe(image);c.resize.observe(stage);}
    c.loading=load(c).catch(error=>{c.loadError=true;if(error.name!=='AbortError')announce(c,tr('אפשר להוסיף תיוג פנים אחרי שהחיבור יחזור.','Face tags can be added when the connection returns.'));throw error;});c.loading.catch(()=>{});
    const imageReady=()=>new Promise(resolve=>{if(imageWidth(image)&&(image.complete||image.tagName?.toLowerCase()==='canvas'))resolve();else on(image,'load',resolve,{once:true});});
    await imageReady();if(!live(c))return;if(zoom)setupZoom(c);place(c);stage.dataset.faceDetection='scanning';
    const detected=found=>{if(!live(c))return;const used=new Set(),visible=c.highlightMissing&&Array.isArray(found.galleryFaces)?found.galleryFaces:found;c.detected=visible.map(face=>{const override=[...c.adjusted].find(([,change])=>c.geom.sameRegion(change.original,face.rect)),previous=c.detected.find(previous=>!used.has(previous.id)&&c.geom.sameRegion(previous.rect,face.rect)),id=override?.[0]||previous?.id||uuid();used.add(id);return {id,rect:override?.[1].rect||face.rect,score:face.score,revision:null};});stage.dataset.faceEngine=found.engine;paint(c);};
    const receive=found=>{if(c.adapter){const mapped=c.adapter.mapDetections(found);mapped.engine=found.engine;detected(mapped);}else detected(found);};
    try{const detector=await import('./face-detector.mjs?v=12'),found=await detector.detectFaces(item.id+':'+(adapter?'upload':item.photoRevision||'original'),detectionImage||image,c.events.signal,receive);if(!live(c))return;receive(found);stage.dataset.faceDetection='ready';if(!adapter)window.FamilyGalleryFaces?.save(item,found,c.events.signal).catch(()=>{});}
    catch(error){if(live(c)&&error.name!=='AbortError'){stage.dataset.faceDetection='manual';console.warn('Face detection unavailable:',error.message);announce(c,tr('אפשר ללחוץ על הפנים בתמונה ולתייג גם ידנית.','You can click a face to tag it manually.'));}}
  }
  function update(item){if(current?.item.id===item.id){current.item=item;current.reviewed=Boolean(item.faceSummary?.reviewed);paint(current);}}
  document.addEventListener('DOMContentLoaded',()=>{
    window.addEventListener('family-photo-overlays-changed',event=>{const c=current;if(c?.item.id===event.detail.id){paintAnnotations(c);if(c.hits)place(c);}});
    window.addEventListener('family-media-changed',event=>{
      const result=event.detail,id=result.item?.id;if(!id)return;
      if(result.faces)remember(id,result.faces,result.item,result.detectedFaces,result.ignoredFaces);else if(['tags','untag','retag','delete','restore','photo-edit'].includes(result.operation))labels.delete(id);
      const c=current;if(!c||c.item.id!==id)return;c.item={...c.item,...result.item};c.reviewed=Boolean(result.item.faceSummary?.reviewed);if(result.operation==='face-review'){labels.delete(id);paint(c);}
      if(result.ignoredFaces){c.ignored=result.ignoredFaces;paint(c);}
      if(result.operation==='face-ignore'&&result.detectedFaces){for(const face of result.detectedFaces)if(!c.detected.some(previous=>c.geom.sameRegion(previous.rect,face.rect)))c.detected.push({...face,id:uuid()});paint(c);}
      else if(result.detectedFaces){c.detected=result.detectedFaces.map(face=>({...face,id:c.detected.find(previous=>c.geom.sameRegion(previous.rect,face.rect))?.id||uuid()}));paint(c);}
      if(result.faces)apply(c,result.faces);else if(['tags','untag','retag','restore'].includes(result.operation))load(c,true).catch(()=>{});
    });
  });
  window.FamilyFaces={mount,clear,update,async flush(){await current?.pendingSave;},dismiss(){if(current)closePopup(current);},fit(){if(current&&imageWidth(current.image)){fitZoom(current);place(current);}}};
})();
