import {differencePuzzles,differenceLevels,createDifferenceRound,beginDifferenceRound,checkDifferenceTime,markDifference} from './differences.mjs';
import {shuffled} from './quiz.mjs';

const I=window.FamilyI18n,tr=(he,en)=>I.isEnglish?en:he,$=id=>document.getElementById(id);
const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const levels={easy:['קל','Easy'],medium:['בינוני','Medium'],hard:['קשה','Hard']};
const state={active:false,view:'tree',phase:'setup',level:'easy',puzzles:[],index:0,answers:[],round:null,token:0,zoom:false,error:'',imagesReady:false,autoNextAt:null,cursor:{x:.5,y:.5}};
let clock=null;
const root=()=>$('familyGamesContent');
const levelName=()=>tr(...levels[state.level]);
function stop(){if(clock!==null)clearInterval(clock);clock=null;}
function close(){stop();state.active=false;state.token++;state.autoNextAt=null;}
function open(){close();Object.assign(state,{active:true,view:'games',phase:'setup',round:null,answers:[],error:''});render();}
function tags(puzzle){return puzzle.tags.map(id=>window.FAMILY_DATA?.people?.[id]).filter(Boolean).map(p=>`<span>${safe(I.personName(p))}</span>`).join('');}
function lobbyButton(){return `<button type="button" class="game-lobby-button" data-diff-lobby>${I.isEnglish?'←':'→'} ${tr('חזרה ללוח בחירת המשחקים','Back to game selection')}</button>`;}
function setup(){
  return `${lobbyButton()}<header class="family-game-intro"><span class="game-medallion" aria-hidden="true">◈</span><h3>${tr('מצא את ההבדלים','Spot the differences')}</h3><p>${tr('אותם רגעים משפחתיים, חמישה פרטים שהשתנו.','The same family moments, with five details changed.')}</p></header><div class="diff-setup"><fieldset class="diff-levels"><legend>${tr('בחרו רמת קושי','Choose your difficulty')}</legend>${differenceLevels.map(level=>`<label><input type="radio" name="differenceLevel" value="${level}" data-diff-level ${level===state.level?'checked':''}><span>${tr(...levels[level])}</span></label>`).join('')}</fieldset><div class="game-rules"><span><b>5</b>${tr('תמונות משפחתיות','family photos')}</span><span><b>5</b>${tr('הבדלים בכל תמונה','differences per photo')}</span><span><b>2</b>${tr('דקות לכל תמונה','minutes per photo')}</span></div><p>${tr('לחצו על ההבדלים באחת התמונות. שלוש טעויות או סוף הזמן מסיימים את התמונה ללא נקודה, וממשיכים לתמונה הבאה. מציאת כל חמשת ההבדלים מזכה בנקודה.','Tap a difference in either photo. Three mistakes or running out of time ends the photo with no point and moves to the next. Find all five differences to earn a point.')}</p><div class="diff-thumbnails" aria-hidden="true">${differencePuzzles.map(p=>`<img src="${p.original}" alt="" width="${p.width}" height="${p.height}" loading="lazy">`).join('')}</div><button type="button" class="primary-button" data-diff-start>${tr('מתחילים לחפש','Start searching')}</button></div>`;
}
function photoPanel(puzzle,edited){
  const id=`differenceClip${state.token}`,label=edited?tr('התמונה השונה','Changed photo'):tr('התמונה המקורית','Original photo');
  const rects=puzzle.differences[state.level].map(d=>`<rect x="${(d.x-d.w/2)*puzzle.width}" y="${(d.y-d.h/2)*puzzle.height}" width="${d.w*puzzle.width}" height="${d.h*puzzle.height}"/>`).join('');
  return `<figure class="diff-panel"><figcaption>${label}</figcaption><div class="diff-photo-scroll" dir="ltr"><div class="diff-photo-stage" data-diff-stage role="button" tabindex="0" aria-label="${label} — ${tr('לחצו על הבדל','select a difference')}" aria-describedby="diffKeyboardHelp" style="width:${state.zoom?200:100}%">${edited?`<svg viewBox="0 0 ${puzzle.width} ${puzzle.height}" width="${puzzle.width}" height="${puzzle.height}" role="img" aria-label="${label}"><defs><filter id="${id}Feather"><feGaussianBlur stdDeviation="${state.level==='hard'?.7:1.3}"/></filter><mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="${puzzle.width}" height="${puzzle.height}"><g fill="white" filter="url(#${id}Feather)">${rects}</g></mask></defs><image href="${puzzle.original}" width="${puzzle.width}" height="${puzzle.height}"/><image href="${puzzle.edited}" width="${puzzle.width}" height="${puzzle.height}" mask="url(#${id})"/></svg>`:`<img src="${puzzle.original}" width="${puzzle.width}" height="${puzzle.height}" alt="${label}" draggable="false">`}<span data-diff-markers aria-hidden="true"></span><span class="diff-probe" data-diff-probe hidden aria-hidden="true"></span></div></div><div class="diff-tags" aria-label="${tr('המתויגים בתמונה','People tagged in this photo')}">${tags(puzzle)}</div></figure>`;
}
function question(){
  const p=state.round.puzzle;
  return `${lobbyButton()}<div class="game-question-top diff-hud"><span class="game-round">${tr('תמונה','Photo')} <bdi>${state.index+1} / ${state.puzzles.length}</bdi><small>${levelName()}</small></span><span class="diff-count" id="diffCount">0 / 5</span><span id="diffMistakes">${tr('טעויות: ','Mistakes: ')}0 / 3</span><strong class="diff-time" id="diffTime" role="timer" aria-live="off">2:00</strong></div><h3 class="game-question-title" tabindex="-1">${tr('מצאו חמישה הבדלים','Find five differences')}</h3><div class="diff-toolbar"><p>${tr('אפשר ללחוץ על כל אחת מהתמונות.','Tap either photo to mark a difference.')}</p><button type="button" class="secondary-button" data-diff-zoom aria-pressed="${state.zoom}">${state.zoom?tr('הקטנה −','Zoom out −'):tr('הגדלה +','Zoom in +')}</button></div><p class="visually-hidden" id="diffKeyboardHelp">${tr('במקלדת: הזיזו את הסמן בחיצים ולחצו Enter לבחירה.','Keyboard: move the marker with the arrow keys, then press Enter to select.')}</p><div class="diff-photos">${photoPanel(p,false)}${photoPanel(p,true)}</div><div class="diff-status" id="diffStatus" role="status"></div><div class="diff-round-actions"><button type="button" class="primary-button" data-diff-next hidden>${state.index===state.puzzles.length-1?tr('לתוצאות','See results'):tr('לתמונה הבאה','Next photo')}</button><button type="button" class="secondary-button" data-diff-retry hidden>${tr('טעינה מחדש','Try again')}</button></div>`;
}
function result(){
  const correct=state.answers.filter(a=>a.correct).length;
  return `${lobbyButton()}<div class="game-result" data-diff-result tabindex="-1"><span class="game-medallion" aria-hidden="true">✦</span><p class="small-eyebrow">${tr('מצא את ההבדלים','Spot the differences')} · ${levelName()}</p><div class="game-score"><strong>${correct*20}</strong><span>/ 100</span></div><h3>${tr('מצאתם את כל ההבדלים ב־','You completed ')}${correct}${tr(' מתוך חמש תמונות',' of five photos')}</h3><p>${tr('רק תמונה שבה נמצאו כל חמשת ההבדלים מזכה בנקודה.','A point is earned only when all five differences in a photo are found.')}</p><div class="game-result-actions"><button type="button" class="primary-button" data-diff-again>${tr('עוד סיבוב','Play again')}</button><button type="button" class="secondary-button" data-diff-lobby>${tr('חזרה ללוח בחירת המשחקים','Back to game selection')}</button></div><ol class="diff-results">${state.answers.map((a,i)=>`<li><span>${tr('תמונה ','Photo ')}${i+1}</span><b>${a.correct?'✓':a.reason==='mistakes'?tr('שלוש טעויות','Three mistakes'):tr('הזמן נגמר','Time’s up')}</b><small>${a.found} / 5</small></li>`).join('')}</ol></div>`;
}
function render(){
  if(!state.active||state.view!=='games')return;
  root().innerHTML=state.phase==='setup'?setup():state.phase==='finished'?result():question();
  if(state.phase==='round')updateView();
}
function updateView(){
  const r=state.round;if(!r||state.view!=='games'||!state.active||state.phase!=='round')return;
  $('diffCount').textContent=`${r.found.length} / 5`;
  $('diffMistakes').textContent=tr('טעויות: ','Mistakes: ')+r.mistakes+' / 3';
  const seconds=r.deadline?Math.max(0,Math.ceil((r.deadline-Date.now())/1000)):120;
  $('diffTime').textContent=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
  $('diffTime').dataset.urgent=String(seconds<=20);
  const shown=r.puzzle.differences[r.level].filter(d=>r.found.includes(d.id)||r.status==='lost');
  const markers=shown.map((d,i)=>`<span class="diff-ring${r.found.includes(d.id)?'':' diff-revealed'}" style="left:${d.x*100}%;top:${d.y*100}%;width:${d.w*100}%;height:${d.h*100}%"><b>${i+1}</b></span>`).join('');
  for(const node of root().querySelectorAll('[data-diff-markers]'))node.innerHTML=markers;
  for(const node of root().querySelectorAll('[data-diff-stage]')){node.setAttribute('aria-disabled',String(r.status!=='playing'));node.setAttribute('aria-busy',String(r.status==='loading'));}
  const status=$('diffStatus');status.classList.toggle('diff-success',r.status==='won');
  status.textContent=state.error|| (r.status==='loading'?tr('טוענים את שתי התמונות…','Loading both photos…'):r.status==='won'?tr('מצאתם את כל חמשת ההבדלים! קיבלתם נקודה.','All five differences found! You earned a point.'):r.status==='lost'?(r.reason==='mistakes'?tr('שלוש טעויות — התמונה לא מזכה בנקודה. עוברים לתמונה הבאה…','Three mistakes — no point for this photo. Moving to the next…'):tr('הזמן נגמר — עוברים לתמונה הבאה ללא נקודה…','Time’s up — moving to the next photo with no point…')):r.found.length?tr('יפה! ממשיכים לחפש.','Good find! Keep searching.'):tr('השעון התחיל. בהצלחה!','The clock has started. Good luck!'));
  root().querySelector('[data-diff-next]').hidden=r.status!=='won';
  root().querySelector('[data-diff-retry]').hidden=!state.error;
}
function settle(){
  const r=state.round;if(!r||!['won','lost'].includes(r.status)||state.answers[state.index])return;
  state.answers.push({correct:r.status==='won',found:r.found.length,reason:r.reason});
  state.autoNextAt=r.status==='lost'?Date.now()+1400:null;
}
function tick(){
  if(!state.active||state.view!=='games'||document.visibilityState==='hidden'||state.phase!=='round')return;
  if(state.round.status==='playing'){checkDifferenceTime(state.round);settle();}
  if(state.autoNextAt&&Date.now()>=state.autoNextAt){next();return;}
  updateView();
}
function resume(){
  stop();if(!state.active||state.view!=='games'||document.visibilityState==='hidden'||state.phase!=='round')return;
  if(state.imagesReady&&state.round.status==='loading')beginDifferenceRound(state.round);
  tick();
  if(state.phase==='round'&&(state.round.status==='playing'||state.autoNextAt))clock=setInterval(tick,100);
}
function loadImage(src){return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve();image.onerror=()=>reject(Error('image'));image.src=src;});}
async function loadRound(){
  const token=++state.token,puzzle=state.puzzles[state.index];stop();state.autoNextAt=null;state.error='';state.imagesReady=false;state.zoom=false;state.cursor={x:.5,y:.5};state.round=createDifferenceRound(puzzle,state.level);render();
  root().querySelector('.diff-hud')?.scrollIntoView({block:'start'});
  root().querySelector('.game-question-title')?.focus({preventScroll:true});
  try{await Promise.all([loadImage(puzzle.original),loadImage(puzzle.edited)]);if(token!==state.token||!state.active)return;state.imagesReady=true;resume();}
  catch{if(token!==state.token||!state.active)return;state.error=tr('לא הצלחנו לטעון את התמונות. נסו שוב.','The photos could not load. Please try again.');updateView();}
}
function start(){state.puzzles=shuffled(differencePuzzles);state.answers=[];state.index=0;state.phase='round';loadRound();}
function next(){
  if(!state.active||state.phase!=='round'||!state.answers[state.index])return;
  stop();state.autoNextAt=null;
  if(state.index===state.puzzles.length-1){state.phase='finished';state.token++;render();root().querySelector('[data-diff-result]')?.focus({preventScroll:true});}
  else{state.index++;loadRound();}
}
function select(x,y){
  if(!state.active||state.view!=='games'||state.phase!=='round')return;
  const result=markDifference(state.round,x,y);settle();updateView();resume();
  if(result.kind==='miss')for(const p of root().querySelectorAll('[data-diff-probe]')){p.hidden=false;p.style.left=x*100+'%';p.style.top=y*100+'%';}
}
function activate(view){
  state.view=view;stop();if(!state.active)return false;
  if(view==='games'){render();resume();}return true;
}
function init(){
  root().addEventListener('click',event=>{
    if(!state.active)return;
    if(event.target.closest('[data-diff-lobby]')){window.FamilyGames.showLobby();return;}
    if(event.target.closest('[data-diff-start]')){start();return;}
    if(event.target.closest('[data-diff-again]')){open();return;}
    if(event.target.closest('[data-diff-next]')){next();return;}
    if(event.target.closest('[data-diff-retry]')){loadRound();return;}
    if(event.target.closest('[data-diff-zoom]')){state.zoom=!state.zoom;for(const stage of root().querySelectorAll('[data-diff-stage]'))stage.style.width=(state.zoom?200:100)+'%';const b=event.target.closest('[data-diff-zoom]');b.textContent=state.zoom?tr('הקטנה −','Zoom out −'):tr('הגדלה +','Zoom in +');b.setAttribute('aria-pressed',String(state.zoom));return;}
    const stage=event.target.closest('[data-diff-stage]');if(stage&&event.detail<2){const box=stage.getBoundingClientRect();select((event.clientX-box.left)/box.width,(event.clientY-box.top)/box.height);}
  });
  root().addEventListener('change',event=>{if(state.active&&event.target.matches('[data-diff-level]')&&differenceLevels.includes(event.target.value))state.level=event.target.value;});
  root().addEventListener('keydown',event=>{
    if(!state.active||state.round?.status!=='playing'||!event.target.closest('[data-diff-stage]'))return;
    if(['Enter',' '].includes(event.key)){event.preventDefault();select(state.cursor.x,state.cursor.y);return;}
    const move={ArrowLeft:[-.015,0],ArrowRight:[.015,0],ArrowUp:[0,-.015],ArrowDown:[0,.015]}[event.key];if(!move)return;event.preventDefault();state.cursor={x:Math.max(0,Math.min(1,state.cursor.x+move[0])),y:Math.max(0,Math.min(1,state.cursor.y+move[1]))};
    const p=event.target.closest('[data-diff-stage]').querySelector('[data-diff-probe]');p.hidden=false;p.style.left=state.cursor.x*100+'%';p.style.top=state.cursor.y*100+'%';p.scrollIntoView({block:'nearest',inline:'nearest'});
  });
  document.addEventListener('visibilitychange',()=>document.visibilityState==='hidden'?stop():resume());
}
window.FamilyDifferences={open,close,activate};document.addEventListener('DOMContentLoaded',init);
