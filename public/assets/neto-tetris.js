import {COLS,ROWS,TETROMINOES,createTetris,moveTetris,rotateTetris,softDropTetris,hardDropTetris,advanceTetris,resumeTetris,beginZap,finishZap} from './neto-tetris.mjs?v=1';
import {NETO_PRODUCTS,NETO_STORE_URL} from './neto-products.mjs?v=1';
import {loadNetoImages,drawTetris,drawTetromino,drawZap} from './neto-tetris-art.mjs?v=1';

const I=window.FamilyI18n,tr=(he,en)=>I.isEnglish?en:he;
const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const title=()=>tr('חשמל נטו טטריס','Hashmal Neto Tetris');
const productName=type=>I.isEnglish?NETO_PRODUCTS[type].en:NETO_PRODUCTS[type].he;
const format=value=>Number(value).toLocaleString(I.isEnglish?'en-US':'he-IL');
const id=()=>crypto.randomUUID?crypto.randomUUID().replaceAll('-',''):[...crypto.getRandomValues(new Uint8Array(16))].map(n=>n.toString(16).padStart(2,'0')).join('');
const state={game:null,paused:false,zap:null,zapElapsed:0,run:null,loadedArt:false};
const scores={rows:[],loaded:false,loading:false,error:'',serial:0};
let host=null,back=null,events=null,frame=null,lastFrame=0,held=null,holdElapsed=0,holdStarted=false,toastUntil=0,hudKey=null;
const $=selector=>host?.querySelector(selector);
const reduced=()=>document.documentElement.hasAttribute('data-a11y-motion')||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
function stop(){if(frame!==null)cancelAnimationFrame(frame);frame=null;lastFrame=0;held=null;holdElapsed=0;holdStarted=false;}
export function pauseNetoTetris(){
  stop();if(state.game&&['playing','zapping'].includes(state.game.phase))state.paused=true;
  events?.abort();events=null;host?.classList.remove('has-neto-tetris');host=null;
}
export function mountNetoTetris(root,onBack){
  pauseNetoTetris();host=root;back=onBack;host.classList.add('has-neto-tetris');events=new AbortController();
  const on=(node,type,fn,options={})=>node.addEventListener(type,fn,{...options,signal:events.signal});
  on(host,'click',click);
  on(host,'input',event=>{if(event.target.id==='netoScoreName'&&state.run&&!state.run.busy&&!state.run.saved)state.run.name=event.target.value;});
  on(host,'submit',event=>{if(event.target.matches('[data-neto-score-form]'))saveScore(event);});
  on(host,'pointerdown',event=>{
    const button=event.target.closest('[data-neto-action]');if(!button||event.isPrimary===false||event.button>0||button.disabled)return;
    event.preventDefault();const action=button.dataset.netoAction;perform(action);
    if(['left','right','down'].includes(action)){held=action;holdElapsed=0;holdStarted=false;}
  },{passive:false});
  on(document,'pointerup',()=>{held=null;});on(document,'pointercancel',()=>{held=null;});
  on(document,'keydown',event=>{
    if(!state.game||event.target.closest?.('input,textarea,select,a,button'))return;
    const actions={ArrowLeft:'left',ArrowRight:'right',ArrowDown:'down',ArrowUp:'rotate',Space:'drop',KeyX:'rotate',KeyZ:'counter',KeyP:'pause',Escape:'pause',KeyB:'zap'};
    const action=actions[event.code]||({' ':'drop',ArrowLeft:'left',ArrowRight:'right',ArrowDown:'down',ArrowUp:'rotate',p:'pause',P:'pause',b:'zap',B:'zap',z:'counter',Z:'counter',x:'rotate',X:'rotate',Escape:'pause'})[event.key];
    if(!action)return;event.preventDefault();if(event.repeat&&!['left','right','down'].includes(action))return;
    if(action==='pause'){togglePause();return;}perform(action);
  });
  on(document,'visibilitychange',()=>{if(document.visibilityState==='hidden'&&state.game&&['playing','zapping'].includes(state.game.phase)){state.paused=true;stop();sync();}});
  on(window,'blur',()=>{held=null;});
  render();
  if(!state.loadedArt){state.loadedArt=true;loadNetoImages(()=>{if(host){draw();drawPreviews();}}).catch(()=>{});}
  if(!scores.loaded&&!scores.loading)loadScores();
  $('.neto-heading')?.scrollIntoView({block:'start'});animate();
}
function story(){return tr('חשמל נטו, העסק המשפחתי של משפחת פיש, הוא לא פחות ממוסד משפחתי. טלפון אחד לתומר והוא כבר ידאג לכל מה שצריך. תדי תמיד ידע לפנק במוצרי חשמל ובהפתעות. במסירות ובעבודה קשה בנו האחים פיש אימפריה שהיא גאווה משפחתית.','Hashmal Neto, the Fish family business, is a family institution. One call to Tomer and he will take care of whatever you need. Tedi always knew how to spoil us with appliances and surprises. Through dedication and hard work, the Fish brothers built an empire that makes the whole family proud.');}
function brand(){return `<a class="neto-brand" href="${NETO_STORE_URL}" target="_blank" rel="noopener noreferrer" aria-label="${tr('לאתר חשמל נטו','Visit Hashmal Neto')}"><img src="assets/games/neto/logo.webp" alt="חשמל נטו" width="210" height="78"><span>${tr('העסק המשפחתי של משפחת פיש','The Fish family business')}</span></a>`;}
function catalogue(){return `<div class="neto-catalogue">${Object.keys(NETO_PRODUCTS).map(type=>`<a class="neto-product" href="${safe(NETO_PRODUCTS[type].url)}" target="_blank" rel="noopener noreferrer"><canvas width="144" height="108" data-neto-preview="${type}" aria-hidden="true"></canvas><span><b>${type}</b> ${productName(type)}</span><small>${['I','O','T'].includes(type)?tr('מוצר אחד לצורה','One appliance per shape'):tr('ארבעה מאותו הדגם','Four of the same model')}</small></a>`).join('')}</div>`;}
function setup(){return `<header class="neto-heading neto-intro">${brand()}<span class="neto-eyebrow">${tr('המוצרים של חשמל נטו. המשחק של המשפחה.','Hashmal Neto appliances. A game for the family.')}</span><h3>${title()}</h3><p class="neto-story">${story()}</p><div class="neto-intro-actions"><button type="button" class="neto-primary" data-neto-start>${tr('פותחים את המחסן ומשחקים','Open the warehouse and play')}<span aria-hidden="true">↵</span></button><a href="${NETO_STORE_URL}" class="neto-shop" target="_blank" rel="noopener noreferrer">${tr('לביקור בחשמל נטו','Visit Hashmal Neto')} ↗</a></div></header><section class="neto-instructions"><div><span class="neto-step">01</span><h4>${tr('ממלאים שורות','Fill the rows')}</h4><p>${tr('שבע צורות טטריס מדויקות, כולן ממוצרי חשמל נטו. מסובבים, מסדרים ומשלימים שורות כדי לצבור נקודות.','Seven exact Tetris shapes, all made from Hashmal Neto appliances. Rotate, arrange and complete rows to score.')}</p></div><div><span class="neto-step">02</span><h4>${tr('שלוש פסילות.','Three lives.')}</h4><p>${tr('המחסן התמלא עד למעלה? מאבדים פסילה וממשיכים בלוח ריק. הניקוד נשמר. בפסילה השלישית המשחק מסתיים.','Warehouse filled to the top? Lose a life and continue with an empty board. Keep your score. The third loss ends the game.')}</p></div><div class="neto-zap-rule"><span class="neto-step">ZAP</span><h4>${tr('עדכון מחיר ב ZAP','Update price on ZAP')}</h4><p>${tr('לוחצים, המחירים צונחים והמון ידיים חוטפות את המוצרים. כל הלוח מתרוקן ואפשר להמשיך. הניקוי עצמו לא מוסיף נקודות.','Tap, prices plummet and a crowd of hands snatches the appliances. The whole board clears so you can keep playing. Clearing with ZAP adds no points.')}</p></div></section><section class="neto-shapes"><div class="neto-section-label"><h4>${tr('אותן צורות. מוצרי חשמל נטו.','Classic shapes. Hashmal Neto appliances.')}</h4><span>${tr('כל צורה והדגם שלה','One model for each shape')}</span></div>${catalogue()}</section>${leaderboard()}`;}
function lives(){return `<span class="neto-life-icons" aria-hidden="true">${Array.from({length:3},(_,n)=>`<svg viewBox="0 0 26 32" class="${n>=state.game.lives?'lost':''}"><path d="M8 2v8m10-8v8M5 10h16v7a8 8 0 0 1-7 8v5h-2v-5a8 8 0 0 1-7-8Z"/></svg>`).join('')}</span>`;}
function controls(){return `<div class="neto-touch-controls" dir="ltr"><button type="button" data-neto-action="left" aria-label="${tr('שמאלה','Move left')}">←</button><button type="button" data-neto-action="rotate" aria-label="${tr('סיבוב','Rotate')}">↻</button><button type="button" data-neto-action="right" aria-label="${tr('ימינה','Move right')}">→</button><button type="button" data-neto-action="down" aria-label="${tr('הורדה איטית','Soft drop')}">↓</button><button type="button" data-neto-action="drop" class="neto-hard-drop" aria-label="${tr('הורדה מידית','Hard drop')}">⇓</button></div>`;}
function sideBrand(side){return `<div class="neto-side-brand neto-side-brand-${side}" aria-hidden="true"><img src="assets/games/neto/logo.webp" alt="" width="629" height="213"></div>`;}
function play(){const g=state.game;return `<header class="neto-heading neto-play-heading"><div><span class="neto-eyebrow">${tr('המחסן של משפחת פיש','The Fish family warehouse')}</span><h3>${title()}</h3></div><button type="button" class="neto-pause" data-neto-pause>${tr('השהיה','Pause')} Ⅱ</button></header><div class="neto-play-stage">${sideBrand('left')}${sideBrand('right')}<div class="neto-game-layout"><aside class="neto-game-side"><div class="neto-stats"><div class="neto-score-stat"><small>${tr('הניקוד שלכם','Your score')}</small><strong data-neto-score>${format(g.score)}</strong></div><div><small>${tr('שורות','Rows')}</small><b data-neto-lines>${format(g.lines)}</b></div><div><small>${tr('רמה','Level')}</small><b data-neto-level>${g.level}</b></div><div class="neto-lives-stat"><small>${tr('פסילות נותרו','Lives left')}</small><b data-neto-lives>${g.lives}</b><span data-neto-life-icons>${lives()}</span></div></div><div class="neto-next"><h4>${tr('בדרך למחסן','Next delivery')}</h4><div data-neto-next>${nextPreviews()}</div></div><button type="button" class="neto-zap" data-neto-action="zap"><span class="neto-zap-word">ZAP <span aria-hidden="true">↓</span></span><strong>${tr('עדכון מחיר ב ZAP','Update price on ZAP')}</strong><small>${tr('המחיר צונח. הידיים חוטפות. הלוח מתרוקן.','Prices drop. Hands grab. The board clears.')}</small></button><a class="neto-store-link" href="${NETO_STORE_URL}" target="_blank" rel="noopener noreferrer">${tr('חשמל נטו. גאווה משפחתית.','Hashmal Neto. Family pride.')} ↗</a></aside><div class="neto-board-column"><div class="neto-board-shell"><div class="neto-board-top"><span>NETO TETRIS</span></div><canvas width="400" height="800" class="neto-board" data-neto-board tabindex="0" role="img" aria-label="${tr('לוח חשמל נטו טטריס. חיצים לתנועה, חץ למעלה לסיבוב ורווח להורדה מידית.','Hashmal Neto Tetris board. Arrow keys move, Up rotates, and Space drops.')}" aria-describedby="netoKeyboardHint"></canvas><div class="neto-board-overlay" data-neto-overlay hidden></div><div class="neto-price-drop" data-neto-price hidden aria-hidden="true"><span>₪₪₪</span><b>↓</b><strong>${tr('המחיר צונח!','Prices plummet!')}</strong><small>${tr('כולם חוטפים בחשמל נטו','Everyone is grabbing a deal at Hashmal Neto')}</small></div></div>${controls()}<p class="neto-keyboard-hint" id="netoKeyboardHint">${tr('חיצים לתנועה · ↑ לסיבוב · רווח להורדה · P להשהיה · B לעדכון מחיר','Arrows to move · ↑ to rotate · Space to drop · P to pause · B for ZAP')}</p><p class="neto-game-toast" data-neto-toast role="status" aria-live="polite"></p></div></div></div>`;}
function nextPreviews(){return state.game.next.slice(0,3).map((type,n)=>`<div class="neto-next-piece"><canvas width="144" height="108" data-neto-preview="${type}" aria-hidden="true"></canvas><span>${productName(type)}</span>${n===0?`<small>${tr('המשלוח הבא','Next')}</small>`:''}</div>`).join('');}
function result(){const g=state.game;return `<header class="neto-heading neto-result">${brand()}<span class="neto-eyebrow">${tr('שלוש פסילות. מחסן מלא בחוויות.','Three lives. A warehouse full of memories.')}</span><h3>${tr('כבוד למחסנאים!','Warehouse legends!')}</h3><p>${title()}</p><strong class="neto-final-score">${format(g.score)}</strong><span>${tr('נקודות','points')}</span><div class="neto-result-stats"><span><b>${format(g.lines)}</b> ${tr('שורות','rows')}</span><span><b>${g.level}</b> ${tr('רמה','level')}</span><span><b>${format(g.zaps)}</b> ${tr('עדכוני מחיר','price updates')}</span></div><p class="neto-kept-score">${tr('כל הנקודות משלוש הפסילות הן הניקוד הסופי שלכם.','Every point from all three lives counts towards your final score.')}</p></header><div class="neto-result-entry" data-neto-entry>${scoreForm()}</div><div class="neto-result-actions"><button type="button" class="neto-primary" data-neto-start>${tr('עוד משלוח. עוד משחק.','Another delivery. Another game.')}</button><button type="button" class="neto-secondary" data-neto-home>${tr('לסיפור של חשמל נטו','The Hashmal Neto story')}</button></div>${leaderboard()}`;}
function scoreForm(){const r=state.run;if(!r)return '';if(r.saved)return `<p class="neto-save-success" role="status">${tr('התוצאה של ','The score for ')}<strong>${safe(r.name)}</strong>${tr(' נשמרה. המקום שלכם בטבלה: ',' is saved. Your rank: ')}<b>${r.rank}</b></p>`;return `<form data-neto-score-form><label for="netoScoreName">${tr('איך קוראים לאלופי המחסן?','Who are our warehouse champions?')}</label><div><input id="netoScoreName" name="name" dir="auto" maxlength="60" required autocomplete="name" value="${safe(r.name)}" ${r.busy?'disabled':''}><button type="submit" class="neto-primary" ${r.busy?'disabled':''}>${r.busy?tr('שומרים…','Saving…'):tr('שמירת השיא','Save score')}</button></div><p class="neto-error" role="alert">${safe(r.error)}</p></form>`;}
function leaderboard(){return `<section class="neto-leaderboard" data-neto-leaderboard>${leaderboardInner()}</section>`;}
function leaderboardInner(){return `<header><div><span class="neto-eyebrow">${tr('גאווה משפחתית','Family pride')}</span><h4>${tr('אלופי המחסן','Warehouse champions')}</h4></div><button type="button" class="neto-secondary" data-neto-refresh ${scores.loading?'disabled':''}>${scores.loading?tr('טוענים…','Loading…'):tr('רענון','Refresh')}</button></header><p>${tr('טבלת השיאים של חשמל נטו טטריס מכל בני המשפחה.','The shared Hashmal Neto Tetris leaderboard for the whole family.')}</p>${scores.error?`<p class="neto-error" role="alert">${safe(scores.error)}</p>`:''}${scores.rows.length?`<div class="neto-table-wrap"><table><thead><tr><th>${tr('מקום','Rank')}</th><th>${tr('שם','Name')}</th><th>${tr('נקודות','Score')}</th><th>${tr('שורות','Rows')}</th><th>${tr('רמה','Level')}</th></tr></thead><tbody>${scores.rows.map((row,n)=>`<tr${state.run?.saved&&row.id===state.run.id?' class="neto-your-score"':''}><td>${n===0?'♛':n+1}</td><th scope="row" dir="auto">${safe(row.name)}</th><td><strong>${format(row.score)}</strong></td><td>${format(row.lines)}</td><td>${row.level}</td></tr>`).join('')}</tbody></table></div>`:`<div class="neto-empty-scores">${scores.loading?tr('פורקים את טבלת השיאים…','Unpacking the leaderboard…'):tr('מי יכבוש את המחסן ראשון?','Who will become the first warehouse champion?')}</div>`}`;}
function render(){
  if(!host)return;const g=state.game;
  hudKey=null;host.innerHTML=`<section class="family-neto" data-neto-phase="${g?.phase||'setup'}"><button type="button" class="game-lobby-button" data-neto-back>${I.isEnglish?'←':'→'} ${tr('חזרו ללוח בחירת המשחקים','Back to game selection')}</button>${!g?setup():g.phase==='finished'?result():play()}</section>`;
  drawPreviews();sync();draw();
}
function drawPreviews(){for(const canvas of host?.querySelectorAll('[data-neto-preview]')||[]){const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);const type=canvas.dataset.netoPreview,cells=TETROMINOES[type].cells,xs=cells.map(c=>c[0]),ys=cells.map(c=>c[1]),w=Math.max(...xs)-Math.min(...xs)+1,h=Math.max(...ys)-Math.min(...ys)+1,cell=Math.min(31,(canvas.width-16)/w,(canvas.height-16)/h);drawTetromino(ctx,type,(canvas.width-w*cell)/2,(canvas.height-h*cell)/2,cell);}}
function draw(){const canvas=$('[data-neto-board]');if(!canvas||!state.game)return;const ctx=canvas.getContext('2d');if(state.game.phase==='zapping'&&state.zap)drawZap(ctx,state.zap,Math.min(1,state.zapElapsed/(reduced()?.8:2.6)),{width:canvas.width,height:canvas.height,reduced:reduced()});else drawTetris(ctx,state.game,{width:canvas.width,height:canvas.height});}
function announce(message){const toast=$('[data-neto-toast]');if(toast){toast.textContent=message;toastUntil=performance.now()+2400;}}
function sync(){
  const g=state.game;if(!host||!g||g.phase==='finished')return;
  const key=[g.phase,state.paused,g.score,g.lines,g.level,g.lives].join('|');if(key===hudKey)return;hudKey=key;
  const score=$('[data-neto-score]');if(score)score.textContent=format(g.score);
  $('[data-neto-lines]').textContent=format(g.lines);$('[data-neto-level]').textContent=String(g.level);$('[data-neto-lives]').textContent=String(g.lives);$('[data-neto-life-icons]').innerHTML=lives();
  const paused=state.paused,playing=g.phase==='playing'&&!paused;
  for(const button of host.querySelectorAll('[data-neto-action]'))button.disabled=!playing;
  const zap=$('[data-neto-action="zap"]');if(zap)zap.disabled=!playing;
  const pause=$('[data-neto-pause]');pause.disabled=!['playing','zapping'].includes(g.phase);pause.textContent=paused?tr('המשך','Resume')+' ▷':tr('השהיה','Pause')+' Ⅱ';
  const overlay=$('[data-neto-overlay]');overlay.hidden=!paused&&g.phase!=='crashed';
  if(!overlay.hidden){overlay.innerHTML=g.phase==='crashed'?`<span class="neto-overlay-symbol">↻</span><h4>${tr('המחסן התמלא!','The warehouse is full!')}</h4><p>${tr('נותרו לכם ','You have ')}<b>${g.lives}</b> ${tr('פסילות. הניקוד שלכם נשמר.','lives left. Your score is kept.')}</p><button class="neto-primary" type="button" data-neto-continue>${tr('מפנים את המחסן וממשיכים','Clear the warehouse and continue')}</button>`:`<span class="neto-overlay-symbol">Ⅱ</span><h4>${tr('המשלוח ממתין','Delivery on hold')}</h4><p>${tr('מוכנים? ממשיכים מאותה נקודה.','Ready? Continue from where you stopped.')}</p><button class="neto-primary" type="button" data-neto-resume>${tr('ממשיכים לשחק','Keep playing')}</button>`;}
  const price=$('[data-neto-price]');price.hidden=g.phase!=='zapping'||paused;
  host.querySelector('.family-neto').dataset.netoPhase=g.phase;
}
function updateNext(){const next=$('[data-neto-next]');if(next){next.innerHTML=nextPreviews();drawPreviews();}}
function start(){stop();state.game=createTetris();state.paused=false;state.zap=null;state.zapElapsed=0;state.run={id:id(),name:'',saved:false,busy:false,error:'',rank:null};render();$('[data-neto-board]')?.focus({preventScroll:true});$('.neto-game-layout')?.scrollIntoView({block:'start'});animate();}
function togglePause(){if(!state.game||!['playing','zapping'].includes(state.game.phase))return;state.paused=!state.paused;stop();sync();draw();if(!state.paused){$('[data-neto-board]')?.focus({preventScroll:true});animate();}}
function perform(action){
  const g=state.game;if(!g||state.paused||g.phase!=='playing')return;
  if(action==='zap'){
    const snapshot=beginZap(g);if(!snapshot)return;state.zap=snapshot;state.zapElapsed=0;held=null;announce(tr('המחיר צונח! כולם חוטפים את המוצרים.','Prices plummet! Everyone is grabbing the appliances.'));sync();draw();animate();return;
  }
  if(action==='left')moveTetris(g,-1);else if(action==='right')moveTetris(g,1);else if(action==='rotate')rotateTetris(g,1);else if(action==='counter')rotateTetris(g,-1);else if(action==='down')softDropTetris(g);else if(action==='drop')hardDropTetris(g);
  processEvents();sync();draw();
}
function processEvents(){
  const g=state.game;if(!g)return;
  const list=g.events.splice(0);
  if(list.some(e=>e.type==='lines'))announce(tr('שורה מסודרת, המשפחה גאה!','Rows cleared. Making the family proud!'));
  if(list.some(e=>e.type==='lock'||e.type==='spawn'||e.type==='lines'))updateNext();
  if(g.phase==='crashed'){held=null;stop();announce(tr('המחסן התמלא. הניקוד נשמר.','The warehouse filled up. Your score is kept.'));sync();}
  if(g.phase==='finished'){stop();state.paused=false;render();$('.neto-result')?.scrollIntoView({block:'start'});loadScores(true);}
}
function animate(){if(!host||!state.game||state.paused||!['playing','zapping'].includes(state.game.phase)||document.visibilityState==='hidden')return;if(frame===null)frame=requestAnimationFrame(tick);}
function tick(timestamp){
  frame=null;if(!host||!state.game||state.paused||document.visibilityState==='hidden')return;
  const dt=lastFrame?Math.min(.07,Math.max(0,(timestamp-lastFrame)/1000)):0;lastFrame=timestamp;
  const g=state.game;
  if(g.phase==='zapping'){
    state.zapElapsed+=dt;const duration=reduced()?.8:2.6;
    if(state.zapElapsed>=duration){finishZap(g);state.zap=null;state.zapElapsed=0;updateNext();announce(tr('הכול נחטף. המחסן פנוי למשלוח הבא!','Everything is gone. Ready for the next delivery!'));sync();}
  }else if(g.phase==='playing'){
    if(held){holdElapsed+=dt;if(holdElapsed>=(holdStarted?.085:.22)){holdElapsed=0;holdStarted=true;perform(held);}}
    if(g.phase==='playing')advanceTetris(g,dt);
    processEvents();
  }
  if(g.phase==='finished')return;
  if(toastUntil&&timestamp>toastUntil){const toast=$('[data-neto-toast]');if(toast)toast.textContent='';toastUntil=0;}
  sync();draw();animate();
}
function click(event){
  if(event.target.closest('[data-neto-back]')){pauseNetoTetris();back?.();return;}
  if(event.target.closest('[data-neto-start]')){start();return;}
  if(event.target.closest('[data-neto-home]')){stop();state.game=null;state.run=null;state.zap=null;state.paused=false;render();return;}
  if(event.target.closest('[data-neto-pause],[data-neto-resume]')){togglePause();return;}
  if(event.target.closest('[data-neto-continue]')){if(state.game?.phase==='crashed'){resumeTetris(state.game);state.paused=false;render();$('[data-neto-board]')?.focus({preventScroll:true});animate();}return;}
  if(event.target.closest('[data-neto-refresh]')){loadScores(true);return;}
  const action=event.target.closest('[data-neto-action]');if(action&&event.detail===0)perform(action.dataset.netoAction);
}
function syncScores(){const panel=$('[data-neto-leaderboard]');if(panel)panel.innerHTML=leaderboardInner();}
async function loadScores(force=false){
  if(scores.loading||scores.loaded&&!force)return;const serial=++scores.serial;scores.loading=true;scores.error='';syncScores();
  try{const response=await I.fetch('api/games/neto-tetris/scores'),data=await response.json();if(!response.ok||!Array.isArray(data.scores))throw Error();if(serial!==scores.serial)return;scores.rows=data.scores;scores.loaded=true;}
  catch{if(serial===scores.serial)scores.error=tr('טבלת השיאים לא נטענה כרגע. נסו לרענן.','The leaderboard could not load. Try refreshing.');}
  finally{if(serial===scores.serial){scores.loading=false;syncScores();}}
}
async function saveScore(event){
  event.preventDefault();const r=state.run,g=state.game;if(g?.phase!=='finished'||!r||r.busy||r.saved)return;
  const name=r.name.normalize('NFKC').trim().replace(/\s+/g,' ');
  if(!name||name.length>60||/[\u0000-\u001f\u007f]/.test(name)){r.error=tr('הזינו שם באורך של עד 60 תווים.','Enter a name using up to 60 characters.');syncEntry();return;}
  const body={requestId:r.id,name,score:g.score,lines:g.lines,level:g.level,pieces:g.pieces,zaps:g.zaps};r.busy=true;r.error='';syncEntry();
  try{const response=await I.fetch('api/games/neto-tetris/scores',{method:'POST',headers:{'Content-Type':'application/json','X-Family-Token':window.FAMILY_API_TOKEN},body:JSON.stringify(body)}),data=await response.json();if(!response.ok||data.saved!==true||!Array.isArray(data.scores))throw Error();r.saved=true;r.name=name;r.rank=data.rank;scores.serial++;scores.loading=false;scores.rows=data.scores;scores.loaded=true;scores.error='';}
  catch{r.error=tr('השיא לא נשמר כרגע. השם והניקוד נשארו כאן ואפשר לנסות שוב.','Your score could not be saved. Your name and score are kept here so you can retry.');}
  finally{r.busy=false;if(host&&state.game?.phase==='finished'&&r===state.run){syncEntry();syncScores();}}
}
function syncEntry(){const panel=$('[data-neto-entry]');if(panel)panel.innerHTML=scoreForm();}
