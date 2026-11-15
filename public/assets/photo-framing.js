import {HOLD_MS,normalizeFrame,dragFrame} from './photo-framing-core.mjs?v=1';
const I=window.FamilyI18n,tr=(he,en)=>I.isEnglish?en:he;
const records=new Map(),drafts=new Map(),queues=new Map();
const selector='img[data-photo-frame],.person-page-portrait img,.person-media-photos img,.nursery-frame img,.nursery-photo-card .gallery-image img,img.profile-photo';
const mediaId=source=>/\/media\/([a-f0-9]{32})(?:[?#]|$)/.exec(String(source||''))?.[1];
const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let gesture=null,toolbar=null,active=null,hideTimer=null,blocked=null;
function effective(id){return drafts.get(id)||records.get(id)||normalizeFrame();}
function attributes(item){
  const id=item?.id||mediaId(item?.src);if(!/^[a-f0-9]{32}$/.test(id||''))return '';
  if(item.framing)records.set(id,normalizeFrame(item.framing));const frame=effective(id);
  return `data-photo-frame="${id}" data-photo-frame-value="${safe(JSON.stringify(frame))}" style="object-position:${frame.x*100}% ${frame.y*100}%;object-fit:${frame.fit}"`;
}
function profile(person){return attributes({id:person?.profileMediaId||mediaId(person?.profile),src:person?.profile,framing:person?.profileFraming});}
function paint(image,id){const frame=effective(id);image.style.objectPosition=frame.x*100+'% '+frame.y*100+'%';image.style.objectFit=frame.fit;image.dataset.photoFrameValue=JSON.stringify(frame);}
function repaint(id){for(const image of document.querySelectorAll('img[data-photo-frame]'))if(image.dataset.photoFrame===id)paint(image,id);}
function scan(root=document){
  const images=[...(root.matches?.(selector)?[root]:[]),...root.querySelectorAll(selector)];
  for(const image of images){
    const id=image.dataset.photoFrame||mediaId(image.getAttribute('src'));if(!id)continue;
    if(!records.has(id)&&image.dataset.photoFrameValue)try{records.set(id,normalizeFrame(JSON.parse(image.dataset.photoFrameValue)));}catch{}
    image.dataset.photoFrame=id;image.draggable=false;paint(image,id);
    const owner=image.closest('button,a')||image;if(owner.closest('[aria-hidden=true]'))continue;
    owner.setAttribute('aria-keyshortcuts','Alt+ArrowUp Alt+ArrowDown Alt+ArrowLeft Alt+ArrowRight');
    if(!owner.dataset.frameHint){owner.dataset.frameHint='';owner.title=(owner.title?owner.title+' · ':'')+tr('למיקום התמונה: גררו בעכבר. בטלפון החזיקו שנייה וחצי ואז גררו.','Position photo: drag with the mouse. On a phone, hold for 1.5 seconds, then drag.');}
  }
}
function rememberProfiles(){
  const app=window.FamilyApp;if(!app?.getPeople)return;
  for(const person of app.getPeople()){const p=app.getPersonSummary(person.id),id=p.profileMediaId||mediaId(p.profile);if(id&&p.profileFraming){records.set(id,normalizeFrame(p.profileFraming));repaint(id);}}
}
function targetImage(target){
  const image=target.closest?.('img[data-photo-frame]')||target.closest?.('.person-page-portrait,.person-media-photos,.nursery-frame,.nursery-photo-card .gallery-image')?.querySelector('img[data-photo-frame]');
  return image?.isConnected&&!image.closest('dialog')&&image.naturalWidth?image:null;
}
function positionToolbar(){
  if(!toolbar||toolbar.hidden||!active?.isConnected)return;
  const r=active.getBoundingClientRect(),width=Math.min(360,innerWidth-16),height=toolbar.offsetHeight||74;
  toolbar.style.width=width+'px';toolbar.style.left=Math.max(8,Math.min(innerWidth-width-8,r.left+r.width/2-width/2))+'px';toolbar.style.top=Math.max(8,Math.min(innerHeight-height-8,r.bottom+8))+'px';
}
function controls(image){
  active=image;clearTimeout(hideTimer);
  if(!toolbar){toolbar=document.createElement('div');toolbar.className='photo-framing-toolbar';toolbar.dir=I.isEnglish?'ltr':'rtl';toolbar.setAttribute('role','toolbar');toolbar.setAttribute('aria-label',tr('מיקום התמונה במסגרת','Photo framing'));toolbar.innerHTML=`<span role="status">${tr('גררו למיקום התמונה','Drag to position the photo')}</span><div><button type="button" data-frame-fit>${tr('כל התמונה','Whole photo')}</button><button type="button" data-frame-center>${tr('מרכוז','Center')}</button><button type="button" data-frame-close>${tr('סיום','Done')}</button></div>`;document.body.append(toolbar);
    toolbar.addEventListener('click',event=>{if(!active)return;const id=active.dataset.photoFrame,frame=effective(id);if(event.target.closest('[data-frame-close]')){hide();return;}if(event.target.closest('[data-frame-fit]'))void save(id,{...frame,fit:frame.fit==='cover'?'contain':'cover'});if(event.target.closest('[data-frame-center]'))void save(id,{...frame,x:.5,y:.5});updateToolbar();});
  }
  toolbar.hidden=false;updateToolbar();positionToolbar();
}
function updateToolbar(){if(!toolbar||!active)return;const fit=effective(active.dataset.photoFrame).fit==='contain',button=toolbar.querySelector('[data-frame-fit]');button.textContent=fit?tr('מילוי המסגרת','Fill frame'):tr('כל התמונה','Whole photo');button.setAttribute('aria-pressed',String(fit));}
function hide(){clearTimeout(hideTimer);if(toolbar)toolbar.hidden=true;active=null;}
async function save(id,value){
  const frame=normalizeFrame(value);drafts.set(id,frame);repaint(id);
  const queue=queues.get(id)||{running:false,latest:null};queues.set(id,queue);queue.latest=frame;if(queue.running)return;queue.running=true;
  let failed=false;try{while(queue.latest){const sent=queue.latest;queue.latest=null;
    const response=await I.fetch('api/media/'+id+'/framing',{method:'POST',headers:{'Content-Type':'application/json','X-Family-Token':window.FAMILY_API_TOKEN},body:JSON.stringify({framing:sent})}),result=await response.json();if(!response.ok)throw Error(I.error(result.error));records.set(id,normalizeFrame(result.item.framing));
    if(!queue.latest)drafts.delete(id);repaint(id);window.dispatchEvent(new CustomEvent('family-media-changed',{detail:result}));
  }}catch(error){failed=true;queue.latest=null;drafts.delete(id);repaint(id);window.FamilyApp?.toast(error.message||tr('המיקום לא נשמר. נסו שוב.','Position could not be saved. Please try again.'));}
  finally{queue.running=false;if(!gesture&&toolbar&&!toolbar.hidden){toolbar.querySelector('[role=status]').textContent=failed?tr('המיקום לא נשמר','Position was not saved'):tr('מיקום התמונה נשמר','Photo position saved');hideTimer=setTimeout(hide,5000);}}
}
function activate(g){
  if(gesture!==g||!g.image.isConnected)return;g.active=true;g.image.classList.add('photo-framing-active');try{g.image.setPointerCapture(g.pointer);}catch{}controls(g.image);
}
function cancel(){const g=gesture;if(!g)return;clearTimeout(g.timer);gesture=null;g.image.classList.remove('photo-framing-active');if(g.active){drafts.delete(g.id);repaint(g.id);}try{g.image.releasePointerCapture(g.pointer);}catch{}}
function down(event){
  if(event.button>0||event.isPrimary===false||event.ctrlKey||event.metaKey||event.target.closest?.('.photo-framing-toolbar'))return;
  const image=targetImage(event.target);if(!image)return;cancel();
  const r=image.getBoundingClientRect(),g=gesture={image,id:image.dataset.photoFrame,pointer:event.pointerId,touch:event.pointerType!=='mouse',x:event.clientX,y:event.clientY,frame:effective(image.dataset.photoFrame),box:{width:r.width,height:r.height},imageSize:{width:image.naturalWidth,height:image.naturalHeight},active:false};
  if(g.touch)g.timer=setTimeout(()=>activate(g),HOLD_MS);
}
function move(event){
  const g=gesture;if(!g||g.pointer!==event.pointerId)return;const dx=event.clientX-g.x,dy=event.clientY-g.y;
  if(!g.active){if(g.touch){if(Math.hypot(dx,dy)>8)cancel();return;}if(Math.hypot(dx,dy)<5)return;activate(g);}
  event.preventDefault();event.stopPropagation();drafts.set(g.id,dragFrame(g.frame,dx,dy,g.box,g.imageSize));repaint(g.id);
}
function up(event){
  const g=gesture;if(!g||g.pointer!==event.pointerId)return;clearTimeout(g.timer);gesture=null;g.image.classList.remove('photo-framing-active');try{g.image.releasePointerCapture(g.pointer);}catch{}
  if(!g.active)return;event.preventDefault();event.stopPropagation();blocked={id:g.id,until:Date.now()+800};const frame=effective(g.id);if(JSON.stringify(frame)!==JSON.stringify(g.frame))void save(g.id,frame);else hideTimer=setTimeout(hide,5000);
}
function init(){
  rememberProfiles();scan();
  document.addEventListener('pointerdown',down,true);document.addEventListener('pointermove',move,{capture:true,passive:false});document.addEventListener('pointerup',up,true);document.addEventListener('pointercancel',cancel,true);
  document.addEventListener('touchmove',event=>{if(gesture?.active)event.preventDefault();},{capture:true,passive:false});
  document.addEventListener('contextmenu',event=>{if(targetImage(event.target))event.preventDefault();},true);
  document.addEventListener('dragstart',event=>{if(targetImage(event.target))event.preventDefault();},true);
  document.addEventListener('click',event=>{if(blocked&&Date.now()<blocked.until&&targetImage(event.target)?.dataset.photoFrame===blocked.id){event.preventDefault();event.stopImmediatePropagation();blocked=null;}},true);
  document.addEventListener('keydown',event=>{if(event.key==='Escape'){cancel();hide();return;}if(!event.altKey||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;const image=targetImage(event.target);if(!image)return;event.preventDefault();event.stopImmediatePropagation();controls(image);const frame=effective(image.dataset.photoFrame),box=image.getBoundingClientRect(),step=10;void save(image.dataset.photoFrame,dragFrame(frame,event.key==='ArrowLeft'?-step:event.key==='ArrowRight'?step:0,event.key==='ArrowUp'?-step:event.key==='ArrowDown'?step:0,box,{width:image.naturalWidth,height:image.naturalHeight}));},true);
  new MutationObserver(records=>{for(const r of records)for(const n of r.addedNodes)if(n.nodeType===1)scan(n);}).observe(document.body,{childList:true,subtree:true});
  window.addEventListener('family-people-loaded',rememberProfiles);window.addEventListener('family-person-changed',rememberProfiles);window.addEventListener('family-profile-changed',rememberProfiles);
  window.addEventListener('family-media-changed',event=>{const item=event.detail.item;if(item?.framing){records.set(item.id,normalizeFrame(item.framing));repaint(item.id);}});
  for(const type of ['scroll','resize'])window.addEventListener(type,()=>{if(!gesture)hide();else positionToolbar();},{passive:true});
  window.addEventListener('hashchange',()=>{cancel();hide();});window.addEventListener('blur',cancel);window.dispatchEvent(new CustomEvent('family-framing-ready'));
}
window.FamilyPhotoFraming={attributes,profile};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
