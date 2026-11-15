import {LOOKS,ART,LIGHT,FRAMES,TUNING,defaults,normalizeEffects,renderEffects} from './photo-effects-core.mjs?v=2';
import {PhotoFunEditor} from './photo-fun.js?v=2';

const I=window.FamilyI18n,$=id=>document.getElementById('photoEffects'+id),tr=(he,en)=>I.isEnglish?en:he;
const wand='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 20 12-12 3 3L7 23ZM13 11l3 3M6 2v4M4 4h4M19 1v4M17 3h4M20 17v4M18 19h4"/></svg>';
const icons={undo:'M8 4 3 9l5 5M3 9h10a7 7 0 0 1 0 14',redo:'m16 4 5 5-5 5m5-5H11a7 7 0 0 0 0 14',reset:'M4 10a8 8 0 1 1 1 8M4 4v6h6',close:'m6 6 12 12M18 6 6 18',compare:'M12 3v18M4 5h16v14H4Z',save:'M12 3v12m-5-5 5 5 5-5M5 17v4h14v-4'};
const svg=id=>'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="'+icons[id]+'"/></svg>';
const groups=[['look','סגנונות','Looks',LOOKS],['art','אמנות','Art',ART],['light','אור','Light',LIGHT],['frame','מסגרות','Frames',FRAMES],['tune','כיוונון','Adjust',TUNING],['fun','כיף','Fun',[]]];
let dialog=null,session=null,paintFrame=0,thumbSerial=0,funEditor=null;
function mount(){
  if(dialog)return;
  dialog=document.createElement('dialog');dialog.id='photoEffectsEditor';dialog.className='photo-effects-editor';dialog.dataset.i18nSkip='';dialog.setAttribute('aria-labelledby','photoEffectsTitle');dialog.dir=I.isEnglish?'ltr':'rtl';
  dialog.innerHTML=`<header class="pe-header"><div class="pe-heading"><span class="pe-diamond" aria-hidden="true">◇</span><div><h2 id="photoEffectsTitle">${tr('אשף עיצוב תמונה','Photo design studio')}</h2><p>${tr('קצת קסם לזיכרונות שלכם','A little magic for your memories')}</p></div></div><button type="button" id="photoEffectsClose" class="pe-icon" aria-label="${tr('סגירה','Close')}">${svg('close')}</button></header>
  <div class="pe-stage" id="photoEffectsStage"><canvas id="photoEffectsCanvas" aria-label="${tr('תצוגה מקדימה של העיצוב','Design preview')}" hidden></canvas><p id="photoEffectsLoading" role="status">${tr('טוען את התמונה באיכות מלאה…','Loading the full quality photo…')}</p><span id="photoEffectsBadge" class="pe-badge" hidden>${tr('תמונת המקור','Original photo')}</span><span id="photoEffectsSize" class="pe-size"></span></div>
  <div class="pe-tools"><div class="pe-history"><button type="button" id="photoEffectsUndo" class="pe-icon" title="${tr('ביטול פעולה','Undo')}" aria-label="${tr('ביטול פעולה','Undo')}">${svg('undo')}</button><button type="button" id="photoEffectsRedo" class="pe-icon" title="${tr('ביצוע חוזר','Redo')}" aria-label="${tr('ביצוע חוזר','Redo')}">${svg('redo')}</button><button type="button" id="photoEffectsReset" class="pe-icon" title="${tr('איפוס העיצוב','Reset design')}" aria-label="${tr('איפוס העיצוב','Reset design')}">${svg('reset')}</button></div><button type="button" id="photoEffectsCompare" class="pe-compare" aria-pressed="false">${svg('compare')}<span>${tr('השוואה למקור','Compare original')}</span></button></div>
  <section class="pe-controls" aria-label="${tr('אפקטים וכיוונונים','Effects and adjustments')}"><div id="photoEffectsTabs" class="pe-tabs" role="tablist" aria-label="${tr('סוגי אפקטים','Effect categories')}">${groups.map(([id,he,en])=>`<button type="button" id="photoEffectsTab-${id}" role="tab" data-effects-tab="${id}" aria-controls="${id==='fun'?'photoEffectsFun':'photoEffectsPanel'}" aria-selected="${id==='look'}" tabindex="${id==='look'?0:-1}">${tr(he,en)}</button>`).join('')}</div>
  <div id="photoEffectsFun" class="pe-fun" role="tabpanel" aria-labelledby="photoEffectsTab-fun" hidden></div><div class="pe-panel" id="photoEffectsPanel" role="tabpanel" aria-labelledby="photoEffectsTab-look"><div id="photoEffectsChoices" class="pe-choices"></div><nav class="pe-pages" aria-label="${tr('עמודי אפקטים','Effect pages')}" dir="ltr"><button type="button" id="photoEffectsPrevious" aria-label="${tr('אפקטים קודמים','Previous effects')}">‹</button><span id="photoEffectsPage" aria-live="polite"></span><button type="button" id="photoEffectsNext" aria-label="${tr('אפקטים נוספים','More effects')}">›</button></nav></div>
  <div class="pe-slider-row"><label for="photoEffectsRange" id="photoEffectsRangeLabel"></label><input type="range" id="photoEffectsRange" min="0" max="100" value="100"><output id="photoEffectsValue" for="photoEffectsRange"></output></div></section>
  <p id="photoEffectsError" class="pe-error" role="alert" hidden></p><footer class="pe-footer"><button type="button" id="photoEffectsSave">${svg('save')}<span>${tr('שמירה כתמונה נפרדת','Save as a separate photo')}</span></button></footer>`;
  document.body.append(dialog);
  funEditor=new PhotoFunEditor($('Fun'),$('Stage'),$('Canvas'),{tr,changed:()=>{if(session){commit();schedule();}},paint:()=>{if(session){session.compare=false;schedule();}},busy:()=>update()});
  $('Close').addEventListener('click',close);dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  dialog.addEventListener('keydown',event=>{
    // Gallery navigation shortcuts must not consume arrows while designing.
    if(event.key==='Escape'){event.stopPropagation();return;}
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();history(event.shiftKey?1:-1);}
  });
  $('Tabs').addEventListener('click',event=>{const tab=event.target.closest('[data-effects-tab]');if(tab)setGroup(tab.dataset.effectsTab);});
  $('Tabs').addEventListener('keydown',event=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault();const index=groups.findIndex(([id])=>id===session?.group),direction=(event.key==='ArrowRight'?1:-1)*(I.isEnglish?1:-1),next=event.key==='Home'?0:event.key==='End'?groups.length-1:(index+direction+groups.length)%groups.length;
    setGroup(groups[next][0]);dialog.querySelector('[data-effects-tab="'+groups[next][0]+'"]').focus();
  });
  $('Choices').addEventListener('click',event=>{
    const tile=event.target.closest('[data-effects-choice]');if(!canEdit()||!tile)return;
    if(session.group==='tune'){session.tuning=tile.dataset.effectsChoice;choices(false);slider();return;}
    session.settings[session.group]=tile.dataset.effectsChoice;commit();choices(false);slider();schedule();
  });
  $('Previous').addEventListener('click',()=>page(-1));$('Next').addEventListener('click',()=>page(1));
  $('Undo').addEventListener('click',()=>history(-1));$('Redo').addEventListener('click',()=>history(1));
  $('Reset').addEventListener('click',()=>{if(!canEdit())return;session.settings=defaults();funEditor.reset();commit();choices(false);slider();schedule();});
  $('Compare').addEventListener('click',()=>{if(!canEdit())return;session.compare=!session.compare;update();schedule();});
  $('Range').addEventListener('input',()=>{if(!canEdit())return;session.compare=false;session.settings[session.group==='tune'?session.tuning:'intensity']=Number($('Range').value);$('Value').value=$('Range').value+(session.group==='tune'?'':'%');schedule();});
  $('Range').addEventListener('change',()=>{if(!canEdit())return;commit();choices(false);});
  $('Save').addEventListener('click',save);
}
const canEdit=()=>Boolean(session?.source&&!session.saving);
function problem(message=''){$('Error').textContent=message;$('Error').hidden=!message;}
function update(){
  if(!session)return;const ready=canEdit();dialog.setAttribute('aria-busy',String(session.saving||!session.source&&!session.failed));
  for(const button of dialog.querySelectorAll('button'))button.disabled=!ready;
  $('Close').disabled=Boolean(session.saving);$('Undo').disabled=!ready||session.position<1;$('Redo').disabled=!ready||session.position>=session.history.length-1;
  $('Range').disabled=!ready;$('Previous').disabled=!ready||session.page===0;$('Next').disabled=!ready||session.page>=Math.ceil(groups.find(([id])=>id===session.group)[3].length/8)-1;
  $('Compare').setAttribute('aria-pressed',String(session.compare));$('Badge').hidden=!session.compare;
  $('Save').querySelector('span').textContent=session.saving?tr('שומר עותק חדש…','Saving a new copy…'):tr('שמירה כתמונה נפרדת','Save as a separate photo');
  funEditor.setVisible(session.group==='fun',session.compare);funEditor.lock(!ready);$('Save').disabled=!ready||funEditor.busy;
}
function commit(){
  const value=JSON.stringify({settings:normalizeEffects(session.settings),fun:funEditor.snapshot()});if(value===session.history[session.position])return;
  session.history=session.history.slice(0,session.position+1);session.history.push(value);if(session.history.length>40)session.history.shift();session.position=session.history.length-1;session.compare=false;update();
}
function history(direction){
  if(!canEdit())return;const index=session.position+direction;if(index<0||index>=session.history.length)return;
  session.position=index;const value=JSON.parse(session.history[index]);session.settings=value.settings;funEditor.restore(value.fun);session.compare=false;choices(false);slider();schedule();
}
function slider(){
  $('Range').parentNode.hidden=session.group==='fun';if(session.group==='fun'){update();return;}
  const tuning=session.group==='tune'?TUNING.find(([id])=>id===session.tuning):['intensity','עוצמת האפקטים','Effect strength',0,100];
  $('Range').min=tuning[3];$('Range').max=tuning[4];$('Range').value=session.settings[tuning[0]];$('RangeLabel').textContent=tr(tuning[1],tuning[2]);$('Value').value=$('Range').value+(tuning[0]==='intensity'?'%':'');update();
}
function setGroup(group){
  if(!canEdit())return;session.group=group;session.page=0;
  for(const tab of $('Tabs').querySelectorAll('button')){const active=tab.dataset.effectsTab===group;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;}
  $('Panel').setAttribute('aria-labelledby','photoEffectsTab-'+group);choices();slider();
}
function page(direction){if(!canEdit())return;session.page+=direction;choices();update();}
function choices(redraw=true){
  if(!session)return;const owner=session;const fun=owner.group==='fun';$('Panel').hidden=fun;if(fun){funEditor.render();update();return;}const group=groups.find(([id])=>id===owner.group),entries=group[3].slice(owner.page*8,owner.page*8+8),tune=owner.group==='tune';
  if(!redraw&&$('Choices').dataset.group===owner.group&&$('Choices').dataset.page===String(owner.page)){
    for(const tile of $('Choices').children)tile.setAttribute('aria-pressed',String(tile.dataset.effectsChoice===(tune?owner.tuning:owner.settings[owner.group])));
    update();return;
  }
  $('Choices').replaceChildren();$('Choices').dataset.group=owner.group;$('Choices').dataset.page=owner.page;$('Choices').classList.toggle('pe-tuning',tune);
  for(const [id,he,en]of entries){
    const button=document.createElement('button');button.type='button';button.dataset.effectsChoice=id;button.setAttribute('aria-pressed',String(id===(tune?owner.tuning:owner.settings[owner.group])));button.setAttribute('aria-label',tr(he,en));
    if(!tune){const canvas=document.createElement('canvas');canvas.width=96;canvas.height=60;canvas.setAttribute('aria-hidden','true');button.append(canvas);}else{const symbol=document.createElement('span');symbol.className='pe-tune-symbol';symbol.textContent={exposure:'☀',contrast:'◐',saturation:'◉',warmth:'♨',shadows:'◒',sharpness:'✧',vignette:'◌',grain:'⠿'}[id];symbol.setAttribute('aria-hidden','true');button.append(symbol);}
    const label=document.createElement('span');label.textContent=tr(he,en);button.append(label);$('Choices').append(button);
  }
  const total=Math.ceil(group[3].length/8);$('Page').textContent=(owner.page+1)+' / '+total;$('Panel').classList.toggle('pe-one-page',total===1);update();
  const serial=++thumbSerial;
  if(!tune&&owner.source)requestAnimationFrame(()=>{
    if(session!==owner||serial!==thumbSerial)return;
    try{for(const button of $('Choices').children)renderEffects(button.querySelector('canvas'),owner.source,{...defaults(),[owner.group]:button.dataset.effectsChoice},112);}catch{/* The full preview reports rendering errors. */}
  });
}
function schedule(){
  if(paintFrame)cancelAnimationFrame(paintFrame);const owner=session;
  paintFrame=requestAnimationFrame(()=>{paintFrame=0;if(session!==owner||!owner?.source)return;
    try{const mobile=matchMedia('(max-width:700px)').matches,edge=owner.settings.art==='none'?(mobile?820:1200):(mobile?640:900),base=!owner.compare&&funEditor.hasContent()?funEditor.compose(owner.source,edge):owner.source;renderEffects($('Canvas'),base,owner.compare?defaults():owner.settings,edge);if(base!==owner.source)base.width=base.height=1;$('Canvas').hidden=false;update();funEditor.layout();}
    catch{problem(tr('לא ניתן להציג את האפקט. נסו לאפס את העיצוב.','This effect could not be displayed. Try resetting the design.'));}
  });
}
async function responseJSON(response){let result;try{result=await response.json();}catch{throw Error(tr('לא התקבל אישור מהשרת. נסו שוב.','No confirmation was received. Please try again.'));}if(!response.ok)throw Error(I.error(result.error)||tr('לא ניתן לשמור כרגע.','Unable to save right now.'));return result;}
async function open(item){
  if(session||item?.kind!=='photo'||!item.id)return;
  if(window.FamilyMedia?.photoState().busy)return;
  if(window.FamilyFaces?.canNavigate?.(document.getElementById('mediaStage'))===false){window.FamilyMedia?.notify(tr('השלימו את עריכת התיוג לפני עיצוב התמונה.','Finish editing the face tag before designing the photo.'));return;}
  const focus=document.activeElement;if(window.FamilyPhotoFullscreen?.isActive())window.FamilyPhotoFullscreen.exit();
  mount();funEditor.close();const owner=session={item:{...item},focus,settings:defaults(),history:[JSON.stringify({settings:defaults(),fun:funEditor.snapshot()})],position:0,group:'look',page:0,tuning:'exposure',compare:false,saving:false,abort:new AbortController()};
  $('Canvas').hidden=true;$('Loading').hidden=false;$('Loading').textContent=tr('טוען את התמונה באיכות מלאה…','Loading the full quality photo…');$('Size').textContent='';problem();choices();slider();dialog.showModal();$('Close').focus();
  try{
    const result=await responseJSON(await I.fetch('api/media/'+item.id+'/versions',{cache:'no-store',signal:owner.abort.signal}));if(session!==owner)return;
    const current=result.versions.find(version=>version.id===result.currentVersion);if(!current)throw Error(tr('גרסת התמונה אינה זמינה.','This photo version is unavailable.'));owner.version=result.currentVersion;
    const response=await I.fetch(current.src,{cache:'no-store',signal:owner.abort.signal});if(!response.ok)throw Error(tr('לא ניתן לטעון את התמונה. סגרו ונסו שוב.','The photo could not load. Close and try again.'));
    const blob=await response.blob();if(session!==owner)return;owner.mime=blob.type;owner.filename=current.filename||item.filename||'photo';
    let source;
    if(window.createImageBitmap)try{source=await createImageBitmap(blob,{imageOrientation:'from-image'});}catch{}
    if(!source){owner.url=URL.createObjectURL(blob);source=new Image();source.src=owner.url;await source.decode();}
    if(session!==owner){source.close?.();return;}owner.source=source;funEditor.start(source,item,owner.abort.signal);
    const width=source.naturalWidth||source.width,height=source.naturalHeight||source.height;owner.maxEdge=Math.min(Math.max(width,height),Math.sqrt(24000000/(width*height))*Math.max(width,height));
    const scale=Math.min(1,owner.maxEdge/Math.max(width,height));$('Size').textContent=Math.round(width*scale)+' × '+Math.round(height*scale);$('Loading').hidden=true;choices();slider();schedule();
  }catch(error){if(session===owner&&error.name!=='AbortError'){owner.failed=true;problem(error.message);$('Loading').hidden=true;update();}}
}
async function save(){
  if(!canEdit()||funEditor.busy)return;commit();const owner=session;owner.saving=true;problem();update();
  try{
    // Paint the saving state before processing the full-resolution pixels.
    await new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));
    const canvas=document.createElement('canvas'),base=funEditor.hasContent()?funEditor.compose(owner.source,owner.maxEdge):owner.source;renderEffects(canvas,base,owner.settings,owner.maxEdge);if(base!==owner.source)base.width=base.height=1;
    const type=owner.mime==='image/png'?'image/png':'image/jpeg';const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(Error(tr('לא ניתן ליצור את הקובץ. נסו עיצוב אחר.','The image could not be encoded. Try another design.'))),type,.95));canvas.width=canvas.height=1;
    const filename=owner.filename.replace(/\.[^.]*$/,'')+'-design-'+Date.now()+(type==='image/png'?'.png':'.jpg');
    // This editor has only the copy route. It cannot submit an overwrite.
    const params=new URLSearchParams({saveAs:'copy',expectedVersion:owner.version,baseVersion:owner.version,rotation:'0',crop:JSON.stringify({x:0,y:0,width:1,height:1}),filename});
    const result=await responseJSON(await I.fetch('api/media/'+owner.item.id+'/edit?'+params,{method:'POST',headers:{'Content-Type':blob.type,'X-Family-Token':window.FAMILY_API_TOKEN},body:blob}));
    window.dispatchEvent(new CustomEvent('family-media-changed',{detail:result}));
    for(const [scope,collection]of Object.entries(result.albumUpdates||{}))if(scope!==result.scope)window.dispatchEvent(new CustomEvent('family-media-changed',{detail:{...result,scope,collection,people:undefined,person:undefined}}));
    owner.saving=false;close();window.FamilyMedia?.notify(tr('העיצוב נשמר כתמונה נפרדת באותם אלבומים ✓','Your design was saved as a separate photo in the same albums ✓'));
  }catch(error){if(session===owner){owner.saving=false;problem(error.message||tr('השמירה נכשלה. העיצוב נשאר כאן ואפשר לנסות שוב.','Saving failed. Your design is still here; you can retry.'));update();}}
}
function close(){
  if(!session||session.saving)return;const owner=session;session=null;owner.abort.abort();funEditor.close();owner.source?.close?.();if(owner.url)URL.revokeObjectURL(owner.url);++thumbSerial;if(paintFrame)cancelAnimationFrame(paintFrame);paintFrame=0;
  dialog.close();$('Canvas').width=$('Canvas').height=1;$('Choices').replaceChildren();if(owner.focus?.isConnected)owner.focus.focus({preventScroll:true});sync();
}
function sync(){
  const viewer=document.getElementById('mediaViewer'),stage=document.getElementById('mediaStage'),item=window.FamilyMedia?.current();if(!viewer||!stage)return;
  let button=stage.querySelector('[data-photo-magic]');
  if(!viewer.open||item?.kind!=='photo'||!item.id){button?.remove();return;}
  if(!button){button=document.createElement('button');button.type='button';button.className='photo-magic-wand';button.dataset.photoMagic='';button.dataset.i18nSkip='';button.innerHTML=wand;button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();open(window.FamilyMedia.current());});stage.append(button);}
  const label=tr('אשף עיצוב תמונה · אפקטים ומסגרות','Photo design studio · effects and frames');button.title=label;button.setAttribute('aria-label',label);button.disabled=Boolean(window.FamilyMedia.photoState().busy);
  const image=stage._familyFaceContext?.image||stage.querySelector('.native-photo-pane:nth-child(2) img')||stage.querySelector('img');
  if(image){const bounds=stage.getBoundingClientRect(),photo=image.getBoundingClientRect();if(photo.width&&photo.height){button.style.left=Math.min(Math.max(8,photo.left-bounds.left+8),Math.max(8,bounds.width-50))+'px';button.style.top=Math.min(Math.max(8,photo.top-bounds.top+8),Math.max(8,bounds.height-50))+'px';}}
}
window.FamilyPhotoEffects={open,sync,isOpen:()=>Boolean(session)};
function init(){const viewer=document.getElementById('mediaViewer');if(!viewer)return;new MutationObserver(sync).observe(viewer,{childList:true,subtree:true,attributes:true,attributeFilter:['open']});viewer.addEventListener('load',sync,true);window.addEventListener('resize',sync);sync();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
