import {quizGrade} from './quiz.mjs';

const I=window.FamilyI18n,$=id=>document.getElementById(id),tr=(he,en)=>I.isEnglish?en:he;
const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state={view:'tree',phase:'welcome',questions:[],index:0,answers:[],selected:null,imageReady:false,error:'',serial:0};
const name=person=>I.personName(person);
function welcome(){
  return `<header class="family-game-intro"><span class="game-medallion" aria-hidden="true">❖</span><span class="small-eyebrow">${tr('הפנים שלנו, הסיפורים שלנו','Our faces, our stories')}</span><h3>${tr('מי זה?','Who is it?')}</h3><p>${tr('כמה טוב אתם מכירים את המשפחה?','How well do you know the family?')}</p></header><div class="game-welcome"><div class="game-rules"><span><b>10</b>${tr('תמונות מהגלריה','gallery photos')}</span><span><b>4</b>${tr('אפשרויות בכל שאלה','choices per question')}</span><span><b>100</b>${tr('נקודות אפשריות','possible points')}</span></div><p>${tr('בכל תמונה בוחרים אדם אחד שמופיע בה. האפשרויות מאותו מגדר ובגילים דומים. תשובה נכונה שווה עשר נקודות.','Choose one person who appears in each photo. All choices have the same gender and similar ages. Each correct answer earns ten points.')}</p><button type="button" class="primary-button game-start" data-game-start ${state.phase==='loading'?'disabled':''}>${state.phase==='loading'?tr('בוחר תמונות…','Choosing photos…'):tr('בואו נשחק','Let’s play')} <span aria-hidden="true">${I.isEnglish?'→':'←'}</span></button>${state.error?`<p class="game-error" role="alert">${safe(state.error)}</p>`:''}<small>${tr('התשובות מבוססות על התיוגים הקיימים בגלריה המשפחתית.','Answers are based on the tags in the Family Gallery.')}</small></div>`;
}
function question(){
  const q=state.questions[state.index],answered=state.selected!==null,correct=q.options.find(p=>p.id===q.correctId),isCorrect=state.selected===q.correctId;
  return `<div class="game-question-top"><span class="game-round">${tr('תמונה','Photo')} <bdi>${state.index+1} / 10</bdi></span><strong>${state.answers.filter(a=>a.correct).length*10} ${tr('נקודות','points')}</strong></div><progress class="game-progress" max="10" value="${state.index+1}" aria-label="${tr('התקדמות במשחק','Game progress')}"></progress><h3 class="game-question-title">${tr('מי מופיע בתמונה?','Who appears in this photo?')}</h3><div class="game-photo"><img id="familyGamePhoto" src="${safe(q.src)}" alt="${tr('תמונה משפחתית לשאלה','Family photo for question')} ${state.index+1}" decoding="async"></div><p class="game-image-error" id="gameImageError" role="alert" hidden>${tr('התמונה לא נטענה.','The photo could not load.')} <button type="button" data-game-retry-image>${tr('טעינה מחדש','Try again')}</button></p><div class="game-options" role="group" aria-label="${tr('בחירת תשובה','Choose an answer')}">${q.options.map((person,index)=>`<button type="button" data-game-option="${safe(person.id)}" class="game-option${answered&&person.id===q.correctId?' correct':''}${answered&&person.id===state.selected&&!isCorrect?' incorrect':''}" ${answered||!state.imageReady?'disabled':''}><span class="game-option-letter" aria-hidden="true">${I.isEnglish?'ABCD'[index]:'אבגד'[index]}</span><span>${safe(name(person))}</span>${answered&&person.id===q.correctId?'<span aria-hidden="true">✓</span>':''}</button>`).join('')}</div>${answered?`<div class="game-feedback${isCorrect?' is-correct':''}" data-game-feedback role="status" tabindex="-1"><strong>${isCorrect?tr('נכון! עוד פנים מוכרות במשפחה.','Correct! Another familiar family face.'):tr('הפעם התשובה היא ','This time, the answer is ')+safe(name(correct))}</strong><button type="button" class="primary-button" data-game-next>${state.index===9?tr('לציון שלי','See my score'):tr('לתמונה הבאה','Next photo')} ${I.isEnglish?'→':'←'}</button></div>`:''}`;
}
function result(){
  const grade=quizGrade(state.answers.filter(a=>a.correct).length),messages={expert:[tr('אנציקלופדיה משפחתית!','A family encyclopedia!'),tr('אין פנים שלא תזהו. אפשר למנות אתכם לאחראי התיוגים במשפחה.','No face escapes you. You could be the family’s official photo tagger.')],familiar:[tr('מכירים לא מעט!','You know the family!'),tr('עוד כמה אלבומים ומפגש משפחתי אחד, ואתם בדרך לציון מושלם.','A few more albums and one family gathering will put you on the path to a perfect score.')],reunion:[tr('מחכים לכם במפגש המשפחתי הבא 😉','See you at the next family gathering 😉'),tr('נראה שהגיע הזמן להגיע ליותר אירועים משפחתיים… בינתיים, סיבוב בגלריה יעשה פלאים!','It may be time to come to more family events… A stroll through the gallery will help in the meantime!')]},[title,message]=messages[grade.level];
  return `<div class="game-result" data-game-result tabindex="-1"><span class="game-medallion" aria-hidden="true">${grade.level==='expert'?'✦':grade.level==='familiar'?'❖':'♡'}</span><p class="small-eyebrow">${tr('הציון המשפחתי שלכם','Your family score')}</p><div class="game-score"><strong>${grade.score}</strong><span>/ 100</span></div><p>${grade.correct} ${tr('תשובות נכונות מתוך 10','correct answers out of 10')}</p><h3>${title}</h3><p>${message}</p><div class="game-result-actions"><button type="button" class="primary-button" data-game-start>${tr('עוד סיבוב עם תמונות חדשות','Play again with new photos')}</button><button type="button" class="secondary-button" data-view="gallery">${tr('לאלבום המשפחתי','Visit the Family Gallery')}</button></div></div>`;
}
function imageReady(){state.imageReady=true;for(const button of $('familyGamesContent').querySelectorAll('[data-game-option]'))button.disabled=state.selected!==null;}
function render(){
  if(state.view!=='games')return;
  $('familyGamesContent').innerHTML=state.phase==='playing'?question():state.phase==='finished'?result():welcome();
  if(state.phase==='playing'){
    const image=$('familyGamePhoto');image.addEventListener('load',imageReady);image.addEventListener('error',()=>{state.imageReady=false;$('gameImageError').hidden=false;for(const button of $('familyGamesContent').querySelectorAll('[data-game-option]'))button.disabled=true;});
    if(image.complete&&image.naturalWidth)imageReady();
  }
}
async function start(){
  if(state.phase==='loading')return;const serial=++state.serial;state.phase='loading';state.error='';render();
  try{const response=await I.fetch('api/games/who-is-it',{cache:'no-store'}),data=await response.json();if(!response.ok)throw Error(I.error(data.error));if(serial!==state.serial)return;
    if(data.questions?.length!==10)throw Error(tr('כדי להתחיל צריך 10 תמונות מתויגות עם מספיק אפשרויות מאותו מגדר ובגילים דומים. כרגע מתאימות למשחק ','The game needs 10 tagged photos with enough choices of the same gender and similar ages. Currently eligible: ')+(data.available||0)+'.');
    Object.assign(state,{phase:'playing',questions:data.questions,index:0,answers:[],selected:null,imageReady:false});render();
  }catch(error){if(serial===state.serial){state.phase='welcome';state.error=error.message;render();}}
}
function activate(view){state.view=view;$('gamesView').hidden=view!=='games';render();}
function init(){
  $('familyGamesContent').addEventListener('click',event=>{
    if(event.target.closest('[data-game-start]')){start();return;}
    const choice=event.target.closest('[data-game-option]');
    if(choice&&state.phase==='playing'&&state.selected===null&&state.imageReady){const q=state.questions[state.index];if(!q.options.some(p=>p.id===choice.dataset.gameOption))return;state.selected=choice.dataset.gameOption;state.answers.push({id:q.id,correct:state.selected===q.correctId});render();$('familyGamesContent').querySelector('[data-game-feedback]')?.focus();return;}
    if(event.target.closest('[data-game-next]')&&state.selected!==null){if(state.index===9)state.phase='finished';else{state.index++;state.selected=null;state.imageReady=false;}render();$('familyGamesContent').querySelector('[data-game-result]')?.focus();return;}
    if(event.target.closest('[data-game-retry-image]')){$('gameImageError').hidden=true;$('familyGamePhoto').src=state.questions[state.index].src+'?retry='+Date.now();}
  });
  activate(window.FamilyApp.getView());
}
window.FamilyGames={activate};document.addEventListener('DOMContentLoaded',init);
