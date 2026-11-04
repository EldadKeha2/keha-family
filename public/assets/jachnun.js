import {DEFAULT_CHARACTER,SNAKE_LIVES,createSnake,turnSnake,advanceSnake,continueSnake,snakeDelay,headCrop,snakeCharacters} from './jachnun.mjs?v=2';
import {PREPARED_HEADS} from './jachnun-heads.mjs?v=1';

const I=window.FamilyI18n,tr=(he,en)=>I.isEnglish?en:he;
const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const title=()=>tr('תפוס תג׳חנון','Catch the Jachnun');
const mark='<svg class="jachnun-mark" viewBox="0 0 64 48" aria-hidden="true"><path d="m13 33 26-22c9-7 24 8 16 15L29 46" fill="#b97435"/><ellipse cx="20" cy="34" rx="14" ry="10" transform="rotate(-35 20 34)" fill="#e9b66c"/><path d="M12 37c-3-4 6-12 12-10s4 9-1 11-8-1-6-4 6-3 6-1" fill="none" stroke="#87491e" stroke-width="2.5" stroke-linecap="round"/><path d="m30 20 12 10m-6-15 12 10" fill="none" stroke="#e9b66c" stroke-width="2"/></svg>';
const state={phase:'setup',selected:DEFAULT_CHARACTER,people:[],loading:false,loaded:false,error:'',imageError:'',query:'',game:createSnake(),crops:new Map()};
const request={name:'',requestId:null,busy:false,sent:false,error:''};
let host=null,back=null,events=null,clock=null,gesture=null,photo=null,head=null,imageSerial=0;
const $=selector=>host?.querySelector(selector);
const person=()=>state.people.find(p=>p.id===state.selected);
const personName=p=>p?.id===DEFAULT_CHARACTER?tr('סבתא יונה','Grandma Yona'):I.personName(p||{});
const crop=()=>state.crops.get(state.selected)||person()?.preparedCrop||{zoom:1.5,x:.5,y:.34};
function stopClock(){clearTimeout(clock);clock=null;}
export function pauseJachnun(){
  stopClock();if(state.phase==='playing')state.phase='paused';
  gesture=null;events?.abort();events=null;host?.classList.remove('has-family-jachnun');host=null;
}
export function mountJachnun(root,onBack){
  pauseJachnun();host=root;back=onBack;host.classList.add('has-family-jachnun');events=new AbortController();
  const on=(node,type,fn,options={})=>node.addEventListener(type,fn,{...options,signal:events.signal});
  on(host,'click',click);on(host,'change',change);on(host,'input',input);on(host,'keydown',keyboard);
  on(host,'submit',event=>{if(event.target.matches('[data-jachnun-request-form]'))sendHeadRequest(event);});
  on(host,'pointerdown',pointerDown);on(host,'pointermove',pointerMove,{passive:false});on(host,'pointerup',pointerUp);on(host,'pointercancel',()=>{gesture=null;});
  on(document,'visibilitychange',()=>{if(document.visibilityState==='hidden')pause();});
  render();$('.jachnun-heading')?.scrollIntoView({block:'start'});
  if(!state.loaded&&!state.loading)loadPeople();else if(person())loadHead();
}
async function loadPeople(){
  state.loading=true;state.error='';render();
  const family=window.FAMILY_DATA?.people||{};
  // Only reviewed snapshots are playable, regardless of current profile pictures.
  state.people=snakeCharacters(family,PREPARED_HEADS);
  state.people.sort((a,b)=>a.id===DEFAULT_CHARACTER?-1:b.id===DEFAULT_CHARACTER?1:personName(a).localeCompare(personName(b),I.locale));
  state.loaded=state.people.length>0;state.loading=false;
  if(!person()&&state.selected!==DEFAULT_CHARACTER)state.selected=DEFAULT_CHARACTER;
  if(!person()&&!state.error)state.error=tr('תמונת הראש של סבתא יונה אינה זמינה כרגע. אפשר לבחור בן משפחה אחר או לנסות שוב.','Grandma Yona’s portrait is unavailable right now. Choose another family member or try again.');
  if(host){render();if(person())loadHead();}
}
function faceCanvas(image){
  const c=document.createElement('canvas');c.width=c.height=160;const ctx=c.getContext('2d'),r=headCrop(image.naturalWidth,image.naturalHeight,crop());
  ctx.save();ctx.beginPath();ctx.ellipse(80,80,76,79,0,0,Math.PI*2);ctx.clip();ctx.drawImage(image,r.x,r.y,r.size,r.size,0,0,160,160);ctx.restore();return c;
}
async function loadHead(){
  const p=person(),token=++imageSerial;head=null;photo=null;state.imageError='';syncStart();draw();if(!p)return;
  const image=new Image();image.decoding='async';
  image.onload=()=>{if(token!==imageSerial)return;photo=image;head=faceCanvas(image);syncStart();drawHeads();draw();};
  image.onerror=()=>{if(token!==imageSerial)return;state.imageError=tr('תמונת הראש לא נטענה. נסו שוב או בחרו בן משפחה אחר.','The head photo could not load. Try again or choose another family member.');syncStart();};
  image.src=p.profile;
}
function syncStart(){
  const button=$('[data-jachnun-start]');if(button){button.disabled=!head||state.loading;button.textContent=head?tr('יאללה, לג׳חנון!','Let’s eat jachnun!'):tr('טוענים את הראש…','Loading the head…');}
  const status=$('[data-jachnun-image-status]');if(status){status.textContent=state.imageError;status.hidden=!state.imageError;}
  const retry=$('[data-jachnun-retry]');if(retry)retry.hidden=!state.error&&!state.imageError;
}
function headHTML(extra=''){return `<canvas width="160" height="160" class="jachnun-head ${extra}" data-jachnun-head role="img" aria-label="${safe(personName(person()))}"></canvas>`;}
function setup(){
  const selected=person();
  return `<header class="jachnun-heading" tabindex="-1"><span class="small-eyebrow">${tr('עוד ביס, עוד ראש','Another bite, another head')}</span><h3>${mark}${title()}</h3><p>${tr('הסנייק המשפחתי שלנו. אוספים ג׳חנונים, מגדלים שרשרת של ראשים ונזהרים מהקירות ומהשרשרת.','Our family’s take on Snake. Collect jachnun, grow a chain of heads, and avoid the walls and your own chain.')}</p></header><section class="jachnun-setup"><div class="jachnun-character-preview"><div class="jachnun-preview-chain">${headHTML('main-head')}${headHTML()}${headHTML()}${mark}</div><strong data-jachnun-name>${safe(personName(selected)||tr('סבתא יונה','Grandma Yona'))}</strong><span>${tr('ברירת המחדל: סבתא יונה','Default character: Grandma Yona')}</span></div><div class="jachnun-character-controls"><label for="jachnunSearch">${tr('עם מי משחקים?','Who’s playing?')}</label><input id="jachnunSearch" type="search" value="${safe(state.query)}" placeholder="${tr('חיפוש בן או בת משפחה','Search family members')}" autocomplete="off"><label for="jachnunCharacter" class="visually-hidden">${tr('בחירת בן משפחה','Choose a family member')}</label><select id="jachnunCharacter" ${state.loading?'disabled':''}>${options()}</select><p class="jachnun-three-lives">${lifeHeads(SNAKE_LIVES)} <span>${tr('שלוש פסילות. כל ג׳חנון מוסיף ראש אחד.','Three lives. Every jachnun adds one head.')}</span></p><details class="jachnun-crop"><summary>${tr('התאמת חיתוך הראש','Adjust head crop')}</summary>${[['zoom',tr('הגדלה','Zoom'),1,3,.05],['x',tr('מיקום אופקי','Horizontal position'),0,1,.01],['y',tr('מיקום אנכי','Vertical position'),0,1,.01]].map(([key,label,min,max,step])=>`<label>${label}<input type="range" data-jachnun-crop="${key}" min="${min}" max="${max}" step="${step}" value="${crop()[key]}"></label>`).join('')}</details><button type="button" class="primary-button" data-jachnun-start disabled>${tr('טוענים את הראש…','Loading the head…')}</button><p class="game-error" role="alert">${safe(state.error)}</p><p class="game-error" data-jachnun-image-status role="alert" hidden></p><button type="button" class="quiet-button" data-jachnun-retry hidden>${tr('טעינה מחדש','Try again')}</button></div></section><p class="jachnun-instructions">${tr('במחשב: חיצים או WASD. בטלפון: החליקו על הלוח או השתמשו בכפתורי הכיוון. רווח להשהיה.','Computer: arrow keys or WASD. Phone: swipe the board or use the direction buttons. Space to pause.')}</p>${requestForm()}`;
}
function options(){
  const query=state.query.trim().toLocaleLowerCase();
  const list=state.people.filter(p=>p.id===state.selected||!query||[I.personName(p),p.name,p.nameEn,personName(p)].join(' ').toLocaleLowerCase().includes(query));
  const missing=state.selected===DEFAULT_CHARACTER&&!person()?`<option value="yona" selected>${tr('סבתא יונה','Grandma Yona')}</option>`:'';
  return missing+list.map(p=>`<option value="${safe(p.id)}" ${p.id===state.selected?'selected':''}>${safe(personName(p))}</option>`).join('');
}
const directionLabels=()=>({up:tr('למעלה','Up'),right:tr('ימינה','Right'),down:tr('למטה','Down'),left:tr('שמאלה','Left')});
function board(){
  const g=state.game,labels=directionLabels();
  return `<header class="jachnun-heading jachnun-play-heading"><h3>${mark}${title()}</h3><span>${safe(personName(person()))}</span></header><div class="jachnun-hud"><span>${mark}<b data-jachnun-score>${g.score}</b><span>${tr('ג׳חנונים','jachnun')}</span></span>${lifeHeads(g.lives)}<button type="button" class="quiet-button" data-jachnun-pause ${!['playing','paused'].includes(state.phase)?'disabled':''}>${state.phase==='paused'?tr('ממשיכים','Resume'):tr('השהיה','Pause')}</button></div><div class="jachnun-board-wrap"><canvas class="jachnun-board" data-jachnun-board width="648" height="648" tabindex="0" role="img" aria-label="${safe(title()+': '+personName(person()))}" aria-describedby="jachnunHow"></canvas><div class="jachnun-overlay" data-jachnun-overlay ${state.phase==='playing'?'hidden':''}>${overlay()}</div></div><div class="jachnun-pad" dir="ltr" role="group" aria-label="${tr('כפתורי כיוון','Direction controls')}">${[['up','↑'],['left','←'],['down','↓'],['right','→']].map(([key,arrow])=>`<button type="button" data-jachnun-direction="${key}" aria-label="${labels[key]}" ${state.phase!=='playing'?'disabled':''}>${arrow}</button>`).join('')}</div><p id="jachnunHow" class="jachnun-instructions">${tr('חיצים או WASD · החלקה על הלוח · רווח להשהיה','Arrow keys or WASD · Swipe the board · Space to pause')}</p><p class="visually-hidden" role="status" data-jachnun-status></p>${state.phase==='finished'?completion():''}`;
}
function overlay(){
  if(state.phase==='paused')return `<h4>${tr('רגע לנשום','Take a breather')}</h4><p>${tr('הג׳חנונים יחכו לכם.','The jachnun can wait.')}</p><button type="button" class="primary-button" data-jachnun-pause>${tr('ממשיכים לשחק','Resume game')}</button>`;
  if(state.phase==='lost')return `<h4>${tr('אופס! עוד הזדמנות','Oops! Another chance')}</h4><p>${tr('נותרו ','You have ')}${state.game.lives}${tr(' פסילות. הג׳חנונים שאכלתם נשמרו.',' lives left. Your jachnun score is saved.')}</p><button type="button" class="primary-button" data-jachnun-continue>${tr('ממשיכים לג׳חנון הבא','Ready for more')}</button>`;
  if(state.phase==='finished')return `<h4>${state.game.reason==='filled'?tr('מילאתם את כל הלוח!','You filled the board!'):tr('נגמרו הפסילות','That was your third life')}</h4><p>${tr('אכלתם ','You ate ')}${state.game.score}${tr(' ג׳חנונים!',' jachnun!')}</p><button type="button" class="primary-button" data-jachnun-restart>${tr('עוד סיבוב','Play again')}</button>`;
  return '';
}
function shareText(){return tr('שיחקתי ב״תפוס תג׳חנון״ עם ','I played Catch the Jachnun with ')+personName(person())+tr(' ואכלתי ',' and ate ')+state.game.score+tr(' ג׳חנונים! נסו לעקוף אותי 🙂',' jachnun! Can you beat my score? 🙂')+'\n'+new URL('?lang='+encodeURIComponent(I.language||'he')+'#games',window.location.origin).href;}
function completion(){const text=shareText();return `<section class="jachnun-completion" tabindex="-1"><h4>${tr('איזה תיאבון!','What an appetite!')}</h4><p>${tr('משתפים את התוצאה','Share your result')}</p><div class="game-share-icons"><a class="game-share-icon game-share-whatsapp" href="https://wa.me/?text=${encodeURIComponent(text)}" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp"><svg viewBox="0 0 24 24"><use href="assets/share-icons.svg#whatsapp"/></svg></a><a class="game-share-icon game-share-email" href="mailto:?subject=${encodeURIComponent(title())}&body=${encodeURIComponent(text)}" aria-label="${tr('מייל','Email')}"><svg viewBox="0 0 24 24"><use href="assets/share-icons.svg#email"/></svg></a><button type="button" class="game-share-icon game-share-messenger" data-jachnun-share aria-label="Messenger"><svg viewBox="0 0 24 24"><use href="assets/share-icons.svg#messenger"/></svg></button></div><p data-jachnun-share-status role="status"></p><textarea data-jachnun-share-fallback readonly hidden aria-label="${tr('תוצאה לשיתוף','Result to share')}"></textarea><button type="button" class="secondary-button" data-jachnun-settings>${tr('בחירת בן משפחה אחר','Choose another family member')}</button></section>`;}
function render(){
  if(!host)return;
  host.innerHTML=`<section class="family-jachnun"><button type="button" class="game-lobby-button" data-jachnun-back>${I.isEnglish?'←':'→'} ${tr('בחירת משחק','Choose a game')}</button>${state.phase==='setup'?setup():board()}</section>`;
  syncStart();drawHeads();draw();
}
function drawHeads(){for(const canvas of host?.querySelectorAll('[data-jachnun-head]')||[]){const ctx=canvas.getContext('2d');ctx.clearRect(0,0,160,160);if(head)ctx.drawImage(head,0,0);}}
function draw(){
  const canvas=$('[data-jachnun-board]');if(!canvas)return;const ctx=canvas.getContext('2d'),g=state.game,c=canvas.width/g.size;
  ctx.fillStyle='#faf6e8';ctx.fillRect(0,0,canvas.width,canvas.height);
  for(let y=0;y<g.size;y++)for(let x=0;x<g.size;x++){if((x+y)%2===0){ctx.fillStyle='#eee8d466';ctx.fillRect(x*c,y*c,c,c);}}
  if(g.food)drawFood(ctx,(g.food.x+.5)*c,(g.food.y+.5)*c,c*.9);
  g.body.forEach((p,index)=>{const x=(p.x+.5)*c,y=(p.y+.5)*c;ctx.beginPath();ctx.arc(x,y,c*.47,0,Math.PI*2);ctx.fillStyle=index===0?'#b4c68e':'#ddd0ab';ctx.fill();if(head)ctx.drawImage(head,x-c*.44,y-c*.44,c*.88,c*.88);if(index===0){ctx.strokeStyle='#637e41';ctx.lineWidth=2;ctx.stroke();}});
}
function drawFood(ctx,x,y,size){
  ctx.save();ctx.translate(x,y);ctx.rotate(-.55);ctx.scale(size/36,size/36);
  ctx.fillStyle='#9f592a';ctx.beginPath();ctx.roundRect(-12,-9,28,19,7);ctx.fill();ctx.fillStyle='#c58b44';ctx.beginPath();ctx.roundRect(-11,-8,27,13,5);ctx.fill();
  ctx.fillStyle='#f0c983';ctx.beginPath();ctx.ellipse(-10,0,6.5,9,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#9a5a2a';ctx.lineWidth=1.8;ctx.beginPath();for(let t=0;t<Math.PI*4.3;t+=.1){const r=5*(1-t/(Math.PI*4.5));const px=-10+Math.cos(t)*r,py=Math.sin(t)*r*1.3;if(t===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);}ctx.stroke();ctx.restore();
}
function schedule(){stopClock();if(host&&state.phase==='playing'&&document.visibilityState!=='hidden')clock=setTimeout(tick,snakeDelay(state.game.score));}
function tick(){
  clock=null;if(!host||state.phase!=='playing'||document.visibilityState==='hidden')return;
  const before=state.game.score;state.game=advanceSnake(state.game);state.phase=state.game.phase;
  if(state.phase!=='playing'){render();$('[data-jachnun-overlay]')?.querySelector('button')?.focus({preventScroll:true});if(state.phase==='finished')$('.jachnun-completion')?.scrollIntoView({block:'nearest'});return;}
  if(state.game.score!==before){$('[data-jachnun-score]').textContent=String(state.game.score);$('[data-jachnun-status]').textContent=tr('עוד ג׳חנון! עכשיו יש ','Another jachnun! Your chain has ')+state.game.body.length+tr(' ראשים.',' heads.');}
  draw();schedule();
}
function begin(restart=false){if(!head)return;stopClock();if(restart)state.game=createSnake();state.phase='playing';state.game={...state.game,phase:'playing'};render();$('[data-jachnun-board]')?.focus({preventScroll:true});$('.jachnun-hud')?.scrollIntoView({block:'start'});schedule();}
function pause(){if(state.phase!=='playing')return;stopClock();state.phase='paused';render();}
function resume(){if(state.phase!=='paused')return;state.phase='playing';render();$('[data-jachnun-board]')?.focus({preventScroll:true});schedule();}
function change(event){if(event.target.id!=='jachnunCharacter'||state.phase!=='setup')return;state.selected=event.target.value;state.error='';state.imageError='';head=null;render();loadHead();}
function input(event){
  if(state.phase!=='setup')return;
  if(event.target.id==='jachnunRequestName'){request.name=event.target.value;request.requestId=null;request.sent=false;request.error='';syncRequest();return;}
  if(event.target.id==='jachnunSearch'){state.query=event.target.value;$('#jachnunCharacter').innerHTML=options();return;}
  const key=event.target.dataset?.jachnunCrop;if(key&&['x','y','zoom'].includes(key)){state.crops.set(state.selected,{...crop(),[key]:Number(event.target.value)});if(photo){head=faceCanvas(photo);drawHeads();}}
}
function click(event){
  const target=event.target;
  if(target.closest('[data-jachnun-back]')){pauseJachnun();state.phase='setup';back?.();return;}
  if(target.closest('[data-jachnun-start]')){begin(true);return;}
  if(target.closest('[data-jachnun-pause]')){state.phase==='playing'?pause():resume();return;}
  if(target.closest('[data-jachnun-continue]')&&state.phase==='lost'){state.game=continueSnake(state.game);begin();return;}
  if(target.closest('[data-jachnun-restart]')){begin(true);return;}
  if(target.closest('[data-jachnun-settings]')){stopClock();state.phase='setup';render();return;}
  if(target.closest('[data-jachnun-retry]')){state.loaded=false;loadPeople();return;}
  if(target.closest('[data-jachnun-share]')){share();return;}
  const direction=target.closest('[data-jachnun-direction]');if(direction&&state.phase==='playing'){state.game=turnSnake(state.game,direction.dataset.jachnunDirection);$('[data-jachnun-board]')?.focus({preventScroll:true});}
}
function keyboard(event){
  if(event.target.matches('input,select,textarea')||!['playing','paused'].includes(state.phase)||event.altKey||event.ctrlKey||event.metaKey)return;
  const direction={ArrowUp:'up',ArrowRight:'right',ArrowDown:'down',ArrowLeft:'left',w:'up',d:'right',s:'down',a:'left'}[event.key]||{KeyW:'up',KeyD:'right',KeyS:'down',KeyA:'left'}[event.code];
  if(event.key===' '){event.preventDefault();state.phase==='playing'?pause():resume();return;}
  if(!direction)return;event.preventDefault();if(state.phase==='playing')state.game=turnSnake(state.game,direction);
}
function pointerDown(event){if(state.phase==='playing'&&event.target.closest('[data-jachnun-board]')&&(event.button===undefined||event.button===0)){gesture={id:event.pointerId,x:event.clientX,y:event.clientY};event.target.setPointerCapture?.(event.pointerId);}}
function pointerMove(event){if(gesture?.id===event.pointerId)event.preventDefault();}
function pointerUp(event){
  if(!gesture||gesture.id!==event.pointerId)return;const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y;gesture=null;
  if(Math.max(Math.abs(dx),Math.abs(dy))<12||state.phase!=='playing')return;
  state.game=turnSnake(state.game,Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'down':'up');
}
async function share(){
  const text=shareText();try{if(navigator.share){await navigator.share({title:title(),text});return;}await navigator.clipboard.writeText(text);$('[data-jachnun-share-status]').textContent=tr('התוצאה הועתקה. הדביקו אותה בשיחה ב־Messenger.','Result copied. Paste it into your Messenger conversation.');}
  catch(error){if(error.name==='AbortError')return;const node=$('[data-jachnun-share-fallback]');if(node){node.hidden=false;node.value=text;node.focus();node.select();}}
}

function lifeHeads(lives){return `<span class="jachnun-lives" role="img" aria-label="${lives} ${tr('פסילות נותרו','lives remaining')}">${Array.from({length:SNAKE_LIVES},(_,i)=>`<span class="jachnun-life${i>=lives?' is-lost':''}" aria-hidden="true">${headHTML()}</span>`).join('')}</span>`;}
function requestLabel(){return request.busy?tr('שולחים בקשה…','Sending request…'):request.sent?tr('הבקשה נשלחה','Request sent'):tr('דרוש שהראש שלך יופיע','Request your head');}
function requestForm(){return `<section class="jachnun-request"><h4>${tr('הראש שלי לא נמצא ברשימת הראשים?','Is my head missing from the list?')}</h4><p>${tr('ברשימה מופיעים רק ראשים שהוכנו מתמונות פנים ברורות ומתאימות. אם הראש שלכם חסר, הזינו את שמכם ושלחו בקשה. אלדד יקבל מייל עם השם שהזנתם ויוכל להכין ראש נוסף.','The list includes heads prepared from clear, suitable portraits. If yours is missing, enter your name and send a request. Eldad will receive an email with your name so he can prepare another head.')}</p><form data-jachnun-request-form><label for="jachnunRequestName">${tr('השם המלא שלך','Your full name')}</label><div class="jachnun-request-row"><input id="jachnunRequestName" name="name" type="text" dir="auto" autocomplete="name" minlength="2" maxlength="100" required value="${safe(request.name)}" ${request.busy?'disabled':''}><button class="primary-button" type="submit" data-jachnun-request-submit ${request.busy||request.sent?'disabled':''}>${requestLabel()}</button></div><p class="game-error" data-jachnun-request-error role="alert">${safe(request.error)}</p><p class="jachnun-request-success" data-jachnun-request-status role="status">${request.sent?tr('הבקשה נשלחה לאלדד עם השם שהזנתם. תודה!','Your request was sent to Eldad with the name you entered. Thank you!'):''}</p></form></section>`;}
function syncRequest(){const button=$('[data-jachnun-request-submit]');if(button){button.disabled=request.busy||request.sent;button.textContent=requestLabel();}const error=$('[data-jachnun-request-error]'),status=$('[data-jachnun-request-status]');if(error)error.textContent=request.error;if(status)status.textContent=request.sent?tr('הבקשה נשלחה לאלדד עם השם שהזנתם. תודה!','Your request was sent to Eldad with the name you entered. Thank you!'):'';}
async function sendHeadRequest(event){
  event.preventDefault();if(request.busy||request.sent)return;
  const name=request.name.trim();
  if(name.length<2||name.length>100||(name.match(/\p{L}/gu)||[]).length<2){request.error=tr('יש להזין שם מלא תקין באורך 2–100 תווים.','Enter your full name using 2–100 characters.');syncRequest();return;}
  request.requestId??=crypto.randomUUID().replaceAll('-','');request.busy=true;request.error='';render();
  try{
    const response=await I.fetch('api/games/jachnun/head-request',{method:'POST',headers:{'Content-Type':'application/json','X-Family-Token':window.FAMILY_API_TOKEN},body:JSON.stringify({name,language:I.language||'he',requestId:request.requestId})});
    const data=await response.json();
    if(!response.ok)throw Error(response.status===429?tr('כבר נשלחה בקשה לאחרונה. נסו שוב מאוחר יותר.','A request was sent recently. Please try again later.'):response.status===400?tr('יש להזין שם מלא תקין באורך 2–100 תווים.','Enter your full name using 2–100 characters.'):tr('לא ניתן לשלוח את הבקשה כרגע. נסו שוב מאוחר יותר.','Your request could not be sent right now. Please try again later.'));
    if(data.sent!==true)throw Error(tr('השליחה לא אושרה. נסו שוב.','Delivery was not confirmed. Please try again.'));
    request.sent=true;
  }catch(error){request.error=error instanceof Error?error.message:tr('לא ניתן לשלוח את הבקשה כרגע. נסו שוב מאוחר יותר.','Your request could not be sent right now. Please try again later.');}
  finally{request.busy=false;if(host&&state.phase==='setup')render();}
}
