import {quizGrade} from './quiz.mjs';

const I=window.FamilyI18n,$=id=>document.getElementById(id),tr=(he,en)=>I.isEnglish?en:he;
const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ROUND_SECONDS=15;
const state={view:'tree',phase:'welcome',questions:[],index:0,answers:[],imageReady:false,deadline:null,error:'',serial:0,renderToken:0};
let clock=null,nextPhoto=null,preloaded='';
const name=person=>I.personName(person);
function stopClock(){if(clock!==null)clearInterval(clock);clock=null;}
function welcome(){
  return `<header class="family-game-intro"><span class="game-medallion" aria-hidden="true">❖</span><span class="small-eyebrow">${tr('הפנים שלנו, הסיפורים שלנו','Our faces, our stories')}</span><h3>${tr('מי זה?','Who is it?')}</h3><p>${tr('כמה טוב אתם מכירים את המשפחה?','How well do you know the family?')}</p></header><div class="game-welcome"><div class="game-rules"><span><b>10</b>${tr('תמונות מהגלריה','gallery photos')}</span><span><b>4</b>${tr('אפשרויות בכל שאלה','choices per question')}</span><span><b>15</b>${tr('שניות לכל תמונה','seconds per photo')}</span></div><p>${tr('יש לכם 15 שניות לזהות אדם אחד בכל תמונה. בוחרים תשובה וממשיכים מיד לתמונה הבאה. הציון והמשוב מחכים לכם בסוף!','You have 15 seconds to identify one person in each photo. Choose an answer and move straight to the next photo. Your score and feedback await at the end!')}</p><button type="button" class="primary-button game-start" data-game-start ${state.phase==='loading'?'disabled':''}>${state.phase==='loading'?tr('בוחר תמונות…','Choosing photos…'):tr('בואו נשחק','Let’s play')} <span aria-hidden="true">${I.isEnglish?'→':'←'}</span></button>${state.error?`<p class="game-error" role="alert">${safe(state.error)}</p>`:''}<small>${tr('התשובות מבוססות על התיוגים הקיימים בגלריה המשפחתית.','Answers are based on the tags in the Family Gallery.')}</small></div>`;
}
function timer(){
  return `<div class="game-timer" id="familyGameTimer" role="timer" aria-live="off" aria-label="${tr('זמן נותר: 15 שניות','Time remaining: 15 seconds')}" data-running="false" style="--game-time-remaining:1"><svg class="game-hourglass" viewBox="0 0 32 40" aria-hidden="true" focusable="false"><path class="hourglass-sand hourglass-sand-top" d="M9 9h14l-7 9Z"/><path class="hourglass-sand hourglass-sand-bottom" d="M9 32h14l-7-9Z"/><path class="hourglass-stream" d="M16 19v7"/><path class="hourglass-frame" d="M5 3h22M5 37h22M8 3v8c0 4 5 6 8 9-3 3-8 5-8 9v8M24 3v8c0 4-5 6-8 9 3 3 8 5 8 9v8"/></svg><span><bdi class="game-time-value" id="familyGameSeconds">15</bdi><small>${tr('שניות','seconds')}</small></span></div>`;
}
function question(){
  const q=state.questions[state.index],label=tr('תמונה ','Photo ')+(state.index+1)+tr(' מתוך 10. מי מופיע בתמונה?',' of 10. Who appears in this photo?');
  return `<div class="game-question-top"><span class="game-round">${tr('תמונה','Photo')} <bdi>${state.index+1} / 10</bdi></span>${timer()}</div><progress class="game-progress" max="10" value="${state.index+1}" aria-label="${tr('התקדמות במשחק','Game progress')}"></progress><h3 class="game-question-title" tabindex="-1" aria-label="${label}">${tr('מי מופיע בתמונה?','Who appears in this photo?')}</h3><div class="game-photo"><img id="familyGamePhoto" src="${safe(q.src)}" alt="${tr('תמונה משפחתית לשאלה','Family photo for question')} ${state.index+1}" decoding="async"></div><p class="game-image-error" id="gameImageError" role="alert" hidden>${tr('התמונה לא נטענה.','The photo could not load.')} <button type="button" data-game-retry-image>${tr('טעינה מחדש','Try again')}</button></p><div class="game-options" role="group" aria-label="${tr('בחירת תשובה','Choose an answer')}">${q.options.map((person,index)=>`<button type="button" data-game-option="${safe(person.id)}" data-game-round="${state.index}" class="game-option" disabled><span class="game-option-letter" aria-hidden="true">${I.isEnglish?'ABCD'[index]:'אבגד'[index]}</span><span>${safe(name(person))}</span></button>`).join('')}</div>`;
}
function result(){
  const grade=quizGrade(state.answers.filter(a=>a.correct).length),timeouts=state.answers.filter(a=>a.timedOut).length;
  const messages={expert:[tr('אנציקלופדיה משפחתית!','A family encyclopedia!'),tr('אין פנים שלא תזהו. אפשר למנות אתכם לאחראי התיוגים במשפחה.','No face escapes you. You could be the family’s official photo tagger.')],familiar:[tr('מכירים לא מעט!','You know the family!'),tr('עוד כמה אלבומים ומפגש משפחתי אחד, ואתם בדרך לציון מושלם.','A few more albums and one family gathering will put you on the path to a perfect score.')],reunion:[tr('מחכים לכם במפגש המשפחתי הבא 😉','See you at the next family gathering 😉'),tr('נראה שהגיע הזמן להגיע ליותר אירועים משפחתיים… בינתיים, סיבוב בגלריה יעשה פלאים!','It may be time to come to more family events… A stroll through the gallery will help in the meantime!')]},[title,message]=messages[grade.level];
  return `<div class="game-result" data-game-result tabindex="-1"><span class="game-medallion" aria-hidden="true">${grade.level==='expert'?'✦':grade.level==='familiar'?'❖':'♡'}</span><p class="small-eyebrow">${tr('הציון המשפחתי שלכם','Your family score')}</p><div class="game-score"><strong>${grade.score}</strong><span>/ 100</span></div><p>${grade.correct} ${tr('תשובות נכונות מתוך 10','correct answers out of 10')}</p>${timeouts?`<p class="game-timeouts">${timeouts===1?tr('תמונה אחת הסתיימה ללא תשובה בזמן','One photo timed out without an answer'):timeouts+' '+tr('תמונות הסתיימו ללא תשובה בזמן','photos timed out without an answer')}</p>`:''}<h3>${title}</h3><p>${message}</p><div class="game-result-actions"><button type="button" class="primary-button" data-game-start>${tr('עוד סיבוב עם תמונות חדשות','Play again with new photos')}</button><button type="button" class="secondary-button" data-view="gallery">${tr('לאלבום המשפחתי','Visit the Family Gallery')}</button></div></div>`;
}
function finishRound(answerId=null,round=state.index){
  if(state.phase!=='playing'||state.view!=='games'||round!==state.index||!state.deadline)return;
  const q=state.questions[state.index],expired=Date.now()>=state.deadline;
  if(answerId!==null&&(!state.imageReady||!q.options.some(p=>p.id===answerId)))return;
  if(answerId===null&&!expired)return;
  const selected=expired?null:answerId;
  stopClock();state.answers.push({id:q.id,correct:selected!==null&&selected===q.correctId,timedOut:selected===null});
  state.deadline=null;state.imageReady=false;
  if(state.index===9)state.phase='finished';else state.index++;
  render();$('familyGamesContent').querySelector(state.phase==='finished'?'[data-game-result]':'.game-question-title')?.focus({preventScroll:true});
}
function updateClock(){
  if(state.view!=='games'||state.phase!=='playing'||!state.deadline)return;
  const remaining=Math.max(0,Math.ceil((state.deadline-Date.now())/1000)),timer=$('familyGameTimer'),seconds=$('familyGameSeconds');
  if(timer&&seconds){seconds.textContent=String(remaining);timer.dataset.running='true';timer.dataset.urgent=String(remaining<=5);timer.style.setProperty('--game-time-remaining',String(remaining/ROUND_SECONDS));timer.setAttribute('aria-label',tr('זמן נותר: ','Time remaining: ')+remaining+tr(' שניות',' seconds'));}
  if(remaining===0)finishRound(null);
}
function startClock(){
  if(state.view!=='games'||state.phase!=='playing'||!state.imageReady||document.visibilityState==='hidden')return;
  state.deadline??=Date.now()+ROUND_SECONDS*1000;
  const round=state.index;updateClock();
  if(state.phase==='playing'&&state.index===round&&state.deadline&&clock===null)clock=setInterval(updateClock,100);
}
function imageReady(index,token){
  if(state.phase!=='playing'||state.index!==index||state.renderToken!==token||state.view!=='games')return;
  state.imageReady=true;for(const button of $('familyGamesContent').querySelectorAll('[data-game-option]'))button.disabled=false;
  startClock();
  // Warm only the next photo; the timer never runs while waiting for an image.
  const next=state.questions[state.index+1],key=state.serial+':'+(state.index+1);
  if(next&&key!==preloaded){preloaded=key;nextPhoto=new Image();nextPhoto.decoding='async';nextPhoto.src=next.src;}
}
function render(){
  stopClock();if(state.view!=='games')return;
  const token=++state.renderToken,index=state.index;
  $('familyGamesContent').innerHTML=state.phase==='playing'?question():state.phase==='finished'?result():welcome();
  if(state.phase==='playing'){
    state.imageReady=false;const image=$('familyGamePhoto');
    image.addEventListener('load',()=>imageReady(index,token));
    image.addEventListener('error',()=>{if(state.renderToken!==token||state.index!==index)return;stopClock();state.imageReady=false;state.deadline=null;$('gameImageError').hidden=false;for(const button of $('familyGamesContent').querySelectorAll('[data-game-option]'))button.disabled=true;});
    if(image.complete&&image.naturalWidth)imageReady(index,token);
  }
}
async function start(){
  if(state.phase==='loading')return;stopClock();const serial=++state.serial;state.phase='loading';state.error='';render();
  try{const response=await I.fetch('api/games/who-is-it',{cache:'no-store'}),data=await response.json();if(!response.ok)throw Error(I.error(data.error));if(serial!==state.serial)return;
    if(data.questions?.length!==10)throw Error(tr('כדי להתחיל צריך 10 תמונות מתאימות עם תיוגים בגלריה. כרגע זמינות למשחק ','The game needs 10 suitable tagged gallery photos. Currently available: ')+(data.available||0)+'.');
    Object.assign(state,{phase:'playing',questions:data.questions,index:0,answers:[],imageReady:false,deadline:null});render();
  }catch(error){if(serial===state.serial){state.phase='welcome';state.error=error.message;render();}}
}
function activate(view){
  stopClock();state.view=view;$('gamesView').hidden=view!=='games';if(view!=='games')return;
  if(state.phase==='playing'&&state.deadline&&Date.now()>=state.deadline){finishRound(null);return;}render();
}
function init(){
  $('familyGamesContent').addEventListener('click',event=>{
    if(event.target.closest('[data-game-start]')){start();return;}
    const choice=event.target.closest('[data-game-option]');
    if(choice&&event.detail<2){finishRound(choice.dataset.gameOption,Number(choice.dataset.gameRound));return;}
    if(event.target.closest('[data-game-retry-image]')&&state.phase==='playing'){$('gameImageError').hidden=true;$('familyGamePhoto').src=state.questions[state.index].src+'?retry='+Date.now();}
  });
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'){stopClock();return;}if(state.view!=='games'||state.phase!=='playing')return;if(state.deadline&&Date.now()>=state.deadline)finishRound(null);else startClock();});
  activate(window.FamilyApp.getView());
}
window.FamilyGames={activate};document.addEventListener('DOMContentLoaded',init);
