import {makePuzzle,fitsPuzzleSlot,shuffledPieces,PUZZLE_LEVELS} from './puzzle.mjs';

const I=window.FamilyI18n,tr=(he,en)=>I.isEnglish?en:he;
const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state={phase:'setup',photos:[],photo:null,count:10,layout:null,placed:new Set(),order:[],selected:null,cursor:0,elapsed:0,started:null,hint:false,zoom:1,edgesOnly:false,loading:false,error:'',serial:0};
let host=null,back=null,events=null,timer=null,drag=null;
const $=selector=>host?.querySelector(selector);
const title=()=>tr('פאזל משפחתי','Family Puzzle');
const mark='<svg class="puzzle-mark" viewBox="0 0 48 48" aria-hidden="true"><path d="M5 6h13v4a5 5 0 1 0 10 0V6h14v13h-4a5 5 0 1 0 0 10h4v13H28v-4a5 5 0 1 0-10 0v4H5V29h4a5 5 0 1 0 0-10H5Z"/></svg>';
const photoLabel=(photo,index=0)=>photo.caption||tr('רגע משפחתי ','A family moment ')+(index+1);
const time=value=>Math.floor(value/60000)+':'+String(Math.floor(value/1000)%60).padStart(2,'0');
const elapsed=()=>state.elapsed+(state.started===null?0:Date.now()-state.started);

function pauseTime(){if(state.started!==null){state.elapsed+=Date.now()-state.started;state.started=null;}clearInterval(timer);timer=null;}
function startTime(){if(state.phase!=='playing'||document.visibilityState==='hidden')return;if(state.started===null)state.started=Date.now();clearInterval(timer);timer=setInterval(()=>{const node=$('[data-puzzle-time]');if(node)node.textContent=time(elapsed());},1000);}
function cancelDrag(){if(!drag)return;drag.ghost?.remove();drag.button?.classList.remove('is-dragging');drag=null;}
export function pausePuzzle(){pauseTime();cancelDrag();events?.abort();events=null;host?.classList.remove('has-family-puzzle');host=null;}

export function mountPuzzle(root,onBack){
  pausePuzzle();host=root;back=onBack;host.classList.add('has-family-puzzle');events=new AbortController();
  const on=(node,type,callback)=>node.addEventListener(type,callback,{signal:events.signal});
  on(host,'click',click);on(host,'pointerdown',pointerDown);on(host,'pointermove',pointerMove);on(host,'pointerup',pointerUp);on(host,'pointercancel',cancelDrag);on(host,'keydown',keyboard);
  on(document,'visibilitychange',()=>{if(document.visibilityState==='hidden'){pauseTime();cancelDrag();}else startTime();});
  render();$(state.phase==='setup'?'.puzzle-intro':state.phase==='finished'?'.puzzle-completion':'.puzzle-game-header')?.scrollIntoView({block:'start',behavior:'smooth'});if(!state.photos.length&&!state.loading)loadPhotos();
}

async function loadPhotos(){
  state.loading=true;state.error='';render();
  try{
    let response=await I.fetch('api/collections/photos',{cache:'no-store'}),data=await response.json();
    if(!response.ok)throw Error(I.error(data.error));
    let photos=(data.items||[]).filter(photo=>photo.kind==='photo');
    if(!photos.length){response=await I.fetch('api/collections/gallery?size=100',{cache:'no-store'});data=await response.json();if(!response.ok)throw Error(I.error(data.error));photos=(data.items||[]).filter(photo=>photo.kind==='photo');}
    state.photos=photos;state.photo=photos.find(photo=>photo.id==='4c7bfe305fdd4358bb26e8b64081a276')||photos[0]||null;
    if(!photos.length)state.error=tr('אין עדיין תמונות לפאזל. הוסיפו תמונות משפחתיות ונסו שוב.','There are no puzzle photos yet. Add family photos and try again.');
  }catch(error){state.error=error.message;}
  finally{state.loading=false;if(host&&state.phase==='setup')render();}
}

function setup(){
  return `<button class="game-lobby-button" type="button" data-puzzle-back>${I.isEnglish?'←':'→'} ${tr('בחירת משחק','Choose a game')}</button><header class="puzzle-intro">${mark}<span class="small-eyebrow">${tr('כל חלק מחבר אותנו','Every piece brings us together')}</span><h3>${title()}</h3><p>${tr('מרכיבים יחד את הרגעים של כולנו. בחרו תמונה ורמת קושי.','Piece together the moments we share. Choose a photo and a difficulty.')}</p></header><section class="puzzle-setup"><div class="puzzle-setup-preview">${state.photo?`<img src="${safe(state.photo.src)}" alt="${safe(photoLabel(state.photo,state.photos.indexOf(state.photo)))}"><span>${safe(photoLabel(state.photo,state.photos.indexOf(state.photo)))}</span>`:`<div class="puzzle-loading">${mark}<p role="status">${state.loading?tr('אוספים את הרגעים המשפחתיים…','Gathering the family moments…'):tr('התמונות יופיעו כאן','Your photos will appear here')}</p></div>`}</div><div class="puzzle-setup-controls"><span class="small-eyebrow">${tr('האתגר שלכם','Your challenge')}</span><h4>${tr('כמה חלקים מרכיבים?','How many pieces?')}</h4><div class="puzzle-levels" role="group" aria-label="${tr('רמת קושי','Difficulty')}">${PUZZLE_LEVELS.map((count,index)=>`<button type="button" data-puzzle-level="${count}" aria-pressed="${state.count===count}"><strong>${count}</strong><span>${tr(['קל','בינוני','מאתגר'][index],['Easy','Medium','Challenging'][index])}</span></button>`).join('')}</div><p>${tr('גוררים חלק למקומו והוא יתחבר כשמתקרבים. אין לחץ של זמן — פשוט נהנים מהתמונה שמתגלה.','Drag each piece into place and it will snap in when you get close. There’s no time limit — enjoy watching the picture appear.')}</p><button type="button" class="primary-button puzzle-start" data-puzzle-play ${!state.photo||state.loading?'disabled':''}>${state.loading?tr('מכינים את הפאזל…','Preparing the puzzle…'):tr('מתחילים להרכיב','Start piecing it together')} ${I.isEnglish?'→':'←'}</button><p class="puzzle-error" role="alert">${safe(state.error)}</p></div></section><section class="puzzle-photo-choices"><h4>${tr('באיזה רגע משחקים?','Which moment shall we piece together?')}</h4><p>${tr('התמונות מגיעות מאלבום התמונות המשפחתיות, גם ללא תיוגים.','Photos come from the shared family photo album, including photos without tags.')}</p><div class="puzzle-photo-grid">${state.photos.map((photo,index)=>`<button type="button" data-puzzle-photo="${safe(photo.id)}" aria-pressed="${state.photo?.id===photo.id}"><img src="${safe(photo.src)}" alt="${safe(photoLabel(photo,index))}" loading="lazy"><span>${safe(photoLabel(photo,index))}</span></button>`).join('')}</div>${state.error&&!state.photos.length?`<button class="secondary-button" type="button" data-puzzle-retry>${tr('טעינה מחדש','Try again')}</button>`:''}</section>`;
}

function pieceSVG(piece,placed=false){
  const l=state.layout,p=l.pad,id='puzzle-clip-'+state.serial+'-'+piece.id+(placed?'-placed':'');
  return `<svg viewBox="${-p} ${-p} ${l.cw+2*p} ${l.ch+2*p}" aria-hidden="true" focusable="false"><defs><clipPath id="${id}"><path d="${piece.path}" fill="white" stroke="none"/></clipPath></defs><image href="${safe(state.photo.src)}" x="${-piece.x}" y="${-piece.y}" width="${l.width}" height="${l.height}" preserveAspectRatio="none" clip-path="url(#${id})"/><path class="puzzle-piece-outline" d="${piece.path}"/></svg>`;
}
function placedPiece(piece){const l=state.layout;return `<span class="puzzle-placed-piece" data-puzzle-placed="${piece.id}" style="left:${(piece.x-l.pad)/l.width*100}%;top:${(piece.y-l.pad)/l.height*100}%;width:${(l.cw+2*l.pad)/l.width*100}%;height:${(l.ch+2*l.pad)/l.height*100}%">${pieceSVG(piece,true)}</span>`;}
function pieceButton(piece){const l=state.layout,edge=Object.values(piece.edges).includes(0);return `<button type="button" class="puzzle-piece${state.selected===piece.id?' is-selected':''}" data-puzzle-piece="${piece.id}" data-row="${piece.row}" data-col="${piece.col}" data-edge="${edge}" aria-pressed="${state.selected===piece.id}" aria-label="${tr('חלק ','Piece ')}${piece.id+1}" style="aspect-ratio:${(l.cw+2*l.pad)/(l.ch+2*l.pad)}">${pieceSVG(piece)}</button>`;}

function play(){
  const l=state.layout,done=state.phase==='finished';
  return `<div class="puzzle-game-header"><button type="button" class="game-lobby-button" data-puzzle-settings>${I.isEnglish?'←':'→'} ${tr('תמונה ורמת קושי','Photo and difficulty')}</button><h3>${mark}${title()}</h3><span class="puzzle-time"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/></svg><bdi data-puzzle-time>${time(elapsed())}</bdi></span></div><div class="puzzle-progress-row"><span data-puzzle-progress>${progressText()}</span><progress data-puzzle-progress-bar max="${l.count}" value="${state.placed.size}" aria-label="${tr('התקדמות הפאזל','Puzzle progress')}"></progress><button class="quiet-button" type="button" data-puzzle-hint aria-pressed="${state.hint}">${tr('תמונת עזר','Picture hint')}</button><button class="quiet-button" type="button" data-puzzle-zoom aria-pressed="${state.zoom>1}">${state.zoom>1?tr('הקטנה −','Zoom out −'):tr('הגדלה +','Zoom in +')}</button></div><p class="puzzle-how" id="puzzleHow">${tr('גררו חלק מהמגש אל הלוח. אפשר גם לבחור חלק ואז ללחוץ על מקומו בלוח. במקלדת: בחרו חלק, עברו ללוח, הזיזו בחיצים ואשרו ב־Enter.','Drag a piece from the tray to the board. You can also select a piece, then click its place on the board. Keyboard: select a piece, focus the board, use the arrows and press Enter.')}</p><div class="puzzle-workbench"><div class="puzzle-board-scroll"><div class="puzzle-board${done?' is-complete':''}" data-puzzle-board tabindex="0" role="button" aria-label="${tr('לוח הפאזל','Puzzle board')}" aria-describedby="puzzleHow" data-cols="${l.cols}" data-rows="${l.rows}" style="aspect-ratio:${l.width/l.height};width:${state.zoom*100}%;--puzzle-cols:${l.cols};--puzzle-rows:${l.rows}"><img class="puzzle-picture-hint${state.hint?' is-visible':''}" src="${safe(state.photo.src)}" alt="" draggable="false">${[...state.placed].map(id=>placedPiece(l.pieces[id])).join('')}<span class="puzzle-board-cursor" data-puzzle-cursor hidden></span>${done?`<img class="puzzle-complete-photo" src="${safe(state.photo.src)}" alt="${safe(photoLabel(state.photo))}">`:''}</div></div><aside class="puzzle-tray-panel"><div class="puzzle-tray-heading"><h4>${tr('מגש החלקים','Piece tray')}</h4><span data-puzzle-remaining>${l.count-state.placed.size}</span></div><div class="puzzle-tray-tools"><button type="button" data-puzzle-edges aria-pressed="${state.edgesOnly}">${tr('חלקי מסגרת','Edge pieces')}</button><button type="button" data-puzzle-shuffle>${tr('ערבוב','Shuffle')}</button></div><div class="puzzle-tray${state.edgesOnly?' edges-only':''}" data-puzzle-tray>${state.order.filter(id=>!state.placed.has(id)).map(id=>pieceButton(l.pieces[id])).join('')}</div></aside></div><p class="puzzle-status" data-puzzle-status role="status" aria-live="polite"></p><section class="puzzle-completion" data-puzzle-completion tabindex="-1" ${done?'':'hidden'}>${done?completion():''}</section>`;
}
function progressText(){return tr('חלקים במקום: ','Pieces placed: ')+state.placed.size+' / '+state.count;}
function shareText(){return tr('הרכבתי פאזל משפחתי של ','I completed a Family Puzzle with ')+state.count+tr(' חלקים ב־',' pieces in ')+time(elapsed())+'!\n'+new URL('?lang='+encodeURIComponent(I.language||'he')+'#games',window.location.origin).href;}
function completion(){const text=shareText();return `${mark}<span class="small-eyebrow">${tr('התמונה שלמה, והלב גם','Picture complete. Heart full.')}</span><h4>${tr('כל החלקים במקום!','Every piece in its place!')}</h4><p>${tr('הרכבתם ','You assembled ')}${state.count}${tr(' חלקים בזמן שלכם — ',' pieces at your own pace — ')}<bdi>${time(elapsed())}</bdi>.</p><div class="puzzle-finish-actions"><button class="primary-button" type="button" data-puzzle-settings>${tr('לפאזל הבא','Choose another puzzle')}</button><button class="secondary-button" type="button" data-puzzle-play>${tr('אותה תמונה, עוד פעם','Play this photo again')}</button></div><p>${tr('משתפים את ההצלחה','Share your achievement')}</p><div class="game-share-icons"><a class="game-share-icon game-share-whatsapp" href="https://wa.me/?text=${encodeURIComponent(text)}" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp"><svg viewBox="0 0 24 24"><use href="assets/share-icons.svg#whatsapp"/></svg></a><a class="game-share-icon game-share-email" href="mailto:?subject=${encodeURIComponent(title())}&body=${encodeURIComponent(text)}" aria-label="${tr('מייל','Email')}"><svg viewBox="0 0 24 24"><use href="assets/share-icons.svg#email"/></svg></a><button class="game-share-icon game-share-messenger" type="button" data-puzzle-share aria-label="Messenger"><svg viewBox="0 0 24 24"><use href="assets/share-icons.svg#messenger"/></svg></button></div><p data-puzzle-share-status role="status"></p>`;}

function render(){
  if(!host)return;cancelDrag();host.innerHTML=`<div class="family-puzzle">${state.phase==='setup'?setup():play()}</div>`;
  if(state.phase==='playing')startTime();
}
async function startPuzzle(){
  if(!state.photo||state.loading)return;pauseTime();const serial=++state.serial;state.loading=true;state.error='';state.phase='setup';render();
  const image=new Image();
  try{
    await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error(tr('התמונה לא נטענה. בחרו תמונה אחרת או נסו שוב.','The photo could not load. Choose another photo or try again.')));image.src=state.photo.src;});
    if(serial!==state.serial)return;
    state.layout=makePuzzle(state.count,image.naturalWidth/image.naturalHeight);state.placed=new Set();state.order=shuffledPieces(state.layout.pieces).map(piece=>piece.id);state.selected=null;state.cursor=0;state.elapsed=0;state.zoom=1;state.hint=false;state.edgesOnly=false;state.phase='playing';state.loading=false;render();$('.puzzle-game-header')?.scrollIntoView({block:'start',behavior:'smooth'});
  }catch(error){if(serial===state.serial){state.loading=false;state.error=error.message;render();}}
}
function announce(message){const node=$('[data-puzzle-status]');if(node)node.textContent=message;}
function selectPiece(id){
  if(state.phase!=='playing'||state.placed.has(id))return;state.selected=id;
  for(const node of host.querySelectorAll('[data-puzzle-piece]')){node.classList.toggle('is-selected',Number(node.dataset.puzzlePiece)===id);node.setAttribute('aria-pressed',String(Number(node.dataset.puzzlePiece)===id));}
  announce(tr('נבחר חלק ','Selected piece ')+(id+1)+tr('. גררו אותו או לחצו על מקומו בלוח.','. Drag it or click its place on the board.'));
}
function place(id,x,y){
  if(state.phase!=='playing'||state.placed.has(id))return false;
  const piece=state.layout.pieces[id];if(!fitsPuzzleSlot(state.layout,piece,x,y)){announce(tr('עוד קצת… נסו מקום אחר לחלק הזה.','Nearly… try another spot for this piece.'));return false;}
  state.placed.add(id);state.selected=null;$(`[data-puzzle-piece="${id}"]`)?.remove();$('[data-puzzle-board]').insertAdjacentHTML('beforeend',placedPiece(piece));
  $('[data-puzzle-progress]').textContent=progressText();$('[data-puzzle-progress-bar]').value=state.placed.size;$('[data-puzzle-remaining]').textContent=state.count-state.placed.size;announce(tr('מתחבר! ','A perfect fit! ')+progressText());
  if(state.placed.size===state.count){pauseTime();state.phase='finished';const board=$('[data-puzzle-board]');board.classList.add('is-complete');board.insertAdjacentHTML('beforeend',`<img class="puzzle-complete-photo" src="${safe(state.photo.src)}" alt="${safe(photoLabel(state.photo))}">`);const result=$('[data-puzzle-completion]');result.hidden=false;result.innerHTML=completion();result.focus({preventScroll:true});result.scrollIntoView({block:'nearest',behavior:'smooth'});}
  return true;
}
function click(event){
  if(event.target.closest('[data-puzzle-back]')){pausePuzzle();back?.();return;}
  if(event.target.closest('[data-puzzle-settings]')){pauseTime();state.serial++;state.loading=false;state.phase='setup';render();$('.puzzle-intro')?.scrollIntoView({block:'start',behavior:'smooth'});return;}
  const level=event.target.closest('[data-puzzle-level]');if(level){if(state.loading)return;state.count=Number(level.dataset.puzzleLevel);render();return;}
  const photo=event.target.closest('[data-puzzle-photo]');if(photo){if(state.loading)return;state.photo=state.photos.find(item=>item.id===photo.dataset.puzzlePhoto);render();return;}
  if(event.target.closest('[data-puzzle-play]')){startPuzzle();return;}
  if(event.target.closest('[data-puzzle-retry]')){loadPhotos();return;}
  if(event.target.closest('[data-puzzle-hint]')){state.hint=!state.hint;$('[data-puzzle-hint]').setAttribute('aria-pressed',String(state.hint));$('.puzzle-picture-hint').classList.toggle('is-visible',state.hint);return;}
  if(event.target.closest('[data-puzzle-zoom]')){state.zoom=state.zoom===1?1.8:1;const button=$('[data-puzzle-zoom]');button.textContent=state.zoom>1?tr('הקטנה −','Zoom out −'):tr('הגדלה +','Zoom in +');button.setAttribute('aria-pressed',String(state.zoom>1));$('[data-puzzle-board]').style.width=state.zoom*100+'%';return;}
  if(event.target.closest('[data-puzzle-edges]')){state.edgesOnly=!state.edgesOnly;$('[data-puzzle-edges]').setAttribute('aria-pressed',String(state.edgesOnly));$('[data-puzzle-tray]').classList.toggle('edges-only',state.edgesOnly);return;}
  if(event.target.closest('[data-puzzle-shuffle]')){state.order=shuffledPieces(state.layout.pieces).map(piece=>piece.id);$('[data-puzzle-tray]').innerHTML=state.order.filter(id=>!state.placed.has(id)).map(id=>pieceButton(state.layout.pieces[id])).join('');return;}
  if(event.target.closest('[data-puzzle-share]')){shareResult();return;}
  const piece=event.target.closest('[data-puzzle-piece]');if(piece){selectPiece(Number(piece.dataset.puzzlePiece));if(event.detail===0)$('[data-puzzle-board]')?.focus({preventScroll:true});return;}
  const board=event.target.closest('[data-puzzle-board]');if(board&&state.selected!==null&&!drag&&event.detail!==0){const r=board.getBoundingClientRect();place(state.selected,(event.clientX-r.left)/r.width,(event.clientY-r.top)/r.height);}
}
function pointerDown(event){
  const button=event.target.closest('[data-puzzle-piece]');if(!button||state.phase!=='playing'||event.button!==0)return;
  const r=button.getBoundingClientRect();selectPiece(Number(button.dataset.puzzlePiece));drag={id:Number(button.dataset.puzzlePiece),pointer:event.pointerId,button,startX:event.clientX,startY:event.clientY,grabX:(event.clientX-r.left)/r.width,grabY:(event.clientY-r.top)/r.height,moved:false,ghost:null};button.setPointerCapture(event.pointerId);event.preventDefault();
}
function pointerMove(event){
  if(!drag||event.pointerId!==drag.pointer)return;event.preventDefault();
  if(!drag.moved&&Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)<4)return;
  const l=state.layout,r=$('[data-puzzle-board]').getBoundingClientRect(),scale=r.width/l.width;
  if(!drag.ghost){drag.moved=true;drag.ghost=document.createElement('div');drag.ghost.className='puzzle-drag-ghost';drag.ghost.innerHTML=pieceSVG(l.pieces[drag.id],true);drag.ghost.style.width=(l.cw+2*l.pad)*scale+'px';drag.ghost.style.height=(l.ch+2*l.pad)*scale+'px';document.body.append(drag.ghost);drag.button.classList.add('is-dragging');}
  drag.left=event.clientX-drag.grabX*(l.cw+2*l.pad)*scale;drag.top=event.clientY-drag.grabY*(l.ch+2*l.pad)*scale;drag.ghost.style.transform=`translate(${drag.left}px,${drag.top}px)`;
}
function pointerUp(event){
  if(!drag||event.pointerId!==drag.pointer)return;const current=drag,l=state.layout,board=$('[data-puzzle-board]').getBoundingClientRect(),scale=board.width/l.width;
  if(current.moved){const x=(current.left+(l.pad+l.cw/2)*scale-board.left)/board.width,y=(current.top+(l.pad+l.ch/2)*scale-board.top)/board.height;cancelDrag();place(current.id,x,y);}
  else{cancelDrag();selectPiece(current.id);}
}
function keyboard(event){
  if(!event.target.closest('[data-puzzle-board]')||state.phase!=='playing')return;
  if(event.key==='Enter'||event.key===' '){event.preventDefault();if(state.selected!==null)place(state.selected,(state.cursor%state.layout.cols+.5)/state.layout.cols,(Math.floor(state.cursor/state.layout.cols)+.5)/state.layout.rows);return;}
  const delta={ArrowLeft:-1,ArrowRight:1,ArrowUp:-state.layout.cols,ArrowDown:state.layout.cols}[event.key];if(delta===undefined)return;event.preventDefault();state.cursor=Math.max(0,Math.min(state.count-1,state.cursor+delta));const marker=$('[data-puzzle-cursor]');marker.hidden=false;marker.style.cssText=`left:${state.cursor%state.layout.cols/state.layout.cols*100}%;top:${Math.floor(state.cursor/state.layout.cols)/state.layout.rows*100}%;width:${100/state.layout.cols}%;height:${100/state.layout.rows}%`;announce(tr('משבצת ','Slot ')+(state.cursor+1));
}
async function shareResult(){
  const text=shareText();try{if(navigator.share){await navigator.share({title:title(),text});return;}await navigator.clipboard.writeText(text);$('[data-puzzle-share-status]').textContent=tr('התוצאה הועתקה. אפשר להדביק אותה ב־Messenger.','Result copied. Paste it into Messenger.');}catch(error){if(error.name!=='AbortError')$('[data-puzzle-share-status]').textContent=tr('השיתוף אינו זמין כרגע. אפשר להשתמש בווטסאפ או במייל.','Sharing is unavailable right now. Use WhatsApp or email.');}
}
