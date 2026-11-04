import {quizGrade} from './quiz.mjs';

const I=window.FamilyI18n,$=id=>document.getElementById(id),tr=(he,en)=>I.isEnglish?en:he;
const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ROUND_SECONDS=15;
const state={view:'tree',phase:'welcome',game:null,questions:[],index:0,answers:[],imageReady:false,deadline:null,error:'',serial:0,renderToken:0};
let clock=null,nextPhoto=null,preloaded='';
const name=person=>I.personName(person);
function stopClock(){if(clock!==null)clearInterval(clock);clock=null;}
const isKinship=()=>state.game==='kinship';
const isMissing=()=>state.game==='missing';
const isTrivia=()=>state.game==='trivia';
const isTextGame=()=>isKinship()||isTrivia();
const gameTitle=()=>isKinship()?tr('מה הקשר?','What’s the relation?'):isMissing()?tr('מי חסר?','Who’s missing?'):isTrivia()?tr('טריוויה משפחתית','Family Trivia'):tr('מי זה?','Who is it?');
const photoPrompt=()=>isMissing()?tr('מי חסר?','Who’s missing?'):tr('מי מופיע בתמונה?','Who appears in this photo?');
function welcome(){
  const games=[['photos','photos',tr('מי זה?','Who is it?'),tr('מזהים את הפנים בתמונות מהגלריה המשפחתית.','Recognize the faces in photos from the Family Gallery.')],['kinship','tree',tr('מה הקשר?','What’s the relation?'),tr('מחברים בין בני המשפחה, מקשרים קרובים ועד נכד של דודה.','Connect the family, from close relatives to an aunt’s grandson.')],['missing','directory',tr('מי חסר?','Who’s missing?'),tr('תמונה, ארבעה שמות — מי מהם לא מופיע בה?','One photo, four names — which person is not in it?')],['trivia','calendar',tr('טריוויה משפחתית','Family Trivia'),tr('ימי הולדת, סדר הלידה ושנות עלייה — כמה אתם זוכרים?','Birthdays, birth order and immigration years — how much do you remember?')]];
  return `<header class="family-game-intro"><span class="game-medallion" aria-hidden="true">❖</span><span class="small-eyebrow">${tr('המשפחה שלנו, מזווית קצת אחרת','Our family, from a different angle')}</span><h3>${tr('במה משחקים היום?','What shall we play?')}</h3><p>${tr('מזהים פנים או מפענחים קשרים? בחרו את האתגר שלכם.','Recognize faces or untangle family ties? Choose your challenge.')}</p></header><div class="family-game-choices">${games.map(([id,icon,title,description])=>`<button type="button" class="family-game-choice game-choice-${id}" data-game-start="${id}" ${state.phase==='loading'?'disabled':''}><span class="game-choice-icon" aria-hidden="true"><svg viewBox="0 0 48 48"><use href="assets/home-icons.svg#${icon}"></use></svg></span><span><strong>${title}</strong><span>${description}</span><b>${state.phase==='loading'&&state.game===id?tr('מכין את האתגר…','Preparing your challenge…'):tr('בואו נשחק','Let’s play')} ${I.isEnglish?'→':'←'}</b></span></button>`).join('')}</div><div class="game-welcome game-lobby-rules"><div class="game-rules"><span><b>10</b>${tr('שאלות בכל סיבוב','questions per round')}</span><span><b>4</b>${tr('אפשרויות בכל שאלה','choices per question')}</span><span><b>15</b>${tr('שניות לכל שאלה','seconds per question')}</span></div><p>${tr('בוחרים תשובה וממשיכים מיד לשאלה הבאה. הציון והמשוב מחכים לכם בסוף!','Choose an answer and move straight to the next question. Your score and feedback await at the end!')}</p>${state.error?`<p class="game-error" role="alert">${safe(state.error)}</p>`:''}</div>`;
}
function optionsHTML(q){return `<div class="game-options" role="group" aria-label="${tr('בחירת תשובה','Choose an answer')}">${q.options.map((option,index)=>`<button type="button" data-game-option="${safe(option.id)}" data-game-round="${state.index}" class="game-option" disabled><span class="game-option-letter" aria-hidden="true">${I.isEnglish?'ABCD'[index]:'אבגד'[index]}</span><span>${safe(name(option))}</span></button>`).join('')}</div>`;}
function portrait(person){
  const label=name(person),initials=label.split(/\s+/).filter(Boolean).map(s=>s[0]).slice(0,2).join('');
  return `<div class="kinship-person"><span class="kinship-portrait" aria-hidden="true"><span>${safe(initials)}</span>${person.profile?`<img data-kinship-photo src="${safe(person.profile)}" alt="" decoding="async" hidden>`:''}</span><strong>${safe(label)}</strong></div>`;
}
function kinshipQuestion(q){
  const prompt=I.isEnglish?`How is ${name(q.subject)} related to ${name(q.reference)}?`:`מה הקשר של ${name(q.subject)} ל${name(q.reference)}?`;
  return `<h3 class="game-question-title kinship-question-title" tabindex="-1">${safe(prompt)}</h3><div class="kinship-pair">${portrait(q.subject)}<span class="kinship-connection" aria-hidden="true"><svg viewBox="0 0 60 40"><path d="M2 20h16m24 0h16"/><path d="m30 8 12 12-12 12-12-12Z"/><circle cx="2" cy="20" r="2"/><circle cx="58" cy="20" r="2"/></svg></span>${portrait(q.reference)}</div>${optionsHTML(q)}`;
}
function review(){
  return `<details class="kinship-review game-review"><summary>${tr('השאלות והתשובות הנכונות','Review questions and correct answers')}</summary><ol>${state.questions.map((q,index)=>{
    const answer=q.options.find(option=>option.id===q.correctId),record=state.answers[index],selected=q.options.find(option=>option.id===record.selectedId);
    const prompt=isTrivia()?tr(q.prompt,q.promptEn):isKinship()?(I.isEnglish?`How is ${name(q.subject)} related to ${name(q.reference)}?`:`מה הקשר של ${name(q.subject)} ל${name(q.reference)}?`):photoPrompt();
    const sentence=isKinship()?(I.isEnglish?`${name(q.subject)} is ${name(q.reference)}’s ${answer.nameEn.toLowerCase()}.`:`${name(q.subject)} ${q.subject.gender==='f'?'היא':'הוא'} ${answer.name} של ${name(q.reference)}.`):tr('התשובה הנכונה: ','Correct answer: ')+name(answer);
    return `<li data-game-review-question="${index+1}"><span class="kinship-review-mark" aria-hidden="true">${record.correct?'✓':'·'}</span><div class="game-review-question"><strong>${index+1}. ${safe(prompt)}</strong>${isTextGame()?`<div class="game-review-people">${portrait(q.subject)}${isKinship()?portrait(q.reference):''}</div>`:`<img class="game-review-photo" src="${safe(q.src)}" alt="${tr('התמונה משאלה','Photo from question')} ${index+1}" loading="lazy" decoding="async">`}<p>${safe(sentence)}</p><small>${record.timedOut?tr('הזמן הסתיים ללא תשובה','Time ran out without an answer'):tr('בחרתם: ','Your answer: ')+safe(name(selected))}${record.correct?' '+tr('— נכון!','— correct!'):''}</small></div></li>`;
  }).join('')}</ol></details>`;
}
function resultShareData(){
  const grade=quizGrade(state.answers.filter(answer=>answer.correct).length),title=gameTitle();
  const url=new URL(window.location.pathname,window.location.origin);url.searchParams.set('lang',I.language||(I.isEnglish?'en-US':'he'));url.hash='games';
  const text=tr(`שיחקתי ב״${title}״ וקיבלתי ${grade.score}/100 — ${grade.correct} תשובות נכונות מתוך 10!\nחושבים שתצליחו יותר? בואו לשחק במשחקי המשפחה 👨‍👩‍👧‍👦`,`I scored ${grade.score}/100 in “${title}” — ${grade.correct} correct answers out of 10!\nThink you can do better? Try the Family Games 👨‍👩‍👧‍👦`);
  return {title:tr('התוצאה שלי ב','My score in ')+title,text,url:url.href,body:text+'\n'+url.href};
}
function resultSharing(){
  const share=resultShareData(),icon=(id,label,attrs)=>`<a class="game-share-icon game-share-${id}" ${attrs} aria-label="${safe(label)}" title="${safe(label)}"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="assets/share-icons.svg#${id}"></use></svg></a>`;
  return `<section class="game-result-sharing" aria-label="${tr('שיתוף התוצאה','Share your score')}"><p>${tr('שתפו את התוצאה','Share your score')}</p><div class="game-share-icons">${icon('whatsapp',tr('שיתוף התוצאה בוואטסאפ','Share your score on WhatsApp'),`href="https://wa.me/?text=${safe(encodeURIComponent(share.body))}" target="_blank" rel="noopener noreferrer"`)}${icon('email',tr('שיתוף התוצאה במייל','Share your score by email'),`href="mailto:?subject=${safe(encodeURIComponent(share.title))}&amp;body=${safe(encodeURIComponent(share.body))}"`)}${icon('messenger',tr('שיתוף התוצאה במסנג׳ר','Share your score on Messenger'),`href="https://www.facebook.com/messages/" target="_blank" rel="noopener noreferrer" data-game-share-messenger`)}</div><p class="game-share-status" id="gameShareStatus" role="status"></p><textarea id="gameShareFallback" class="game-share-fallback" aria-label="${tr('התוצאה להעתקה','Score to copy')}" readonly hidden></textarea></section>`;
}
async function shareMessenger(event){
  if(state.phase!=='finished'){event.preventDefault();return;}
  const share=resultShareData(),serial=state.serial;
  const status=(message,fallback=false)=>{if(state.phase!=='finished'||serial!==state.serial)return;const node=$('gameShareStatus');if(node)node.textContent=message;if(fallback){const field=$('gameShareFallback');field.value=share.body;field.hidden=false;field.focus();field.select();}};
  if(navigator.share){
    event.preventDefault();try{await navigator.share({title:share.title,text:share.text,url:share.url});}
    catch(error){if(error.name!=='AbortError')status(tr('העתיקו את התוצאה ושלחו אותה במסנג׳ר.','Copy your score and send it in Messenger.'),true);}return;
  }
  try{await navigator.clipboard.writeText(share.body);status(tr('התוצאה הועתקה. בחרו שיחה במסנג׳ר והדביקו אותה.','Score copied. Choose a Messenger conversation and paste it.'));}
  catch{status(tr('העתיקו את התוצאה מהשדה והדביקו בשיחה במסנג׳ר.','Copy the score below and paste it into a Messenger conversation.'),true);}
}
function timer(){
  return `<div class="game-timer" id="familyGameTimer" role="timer" aria-live="off" aria-label="${tr('זמן נותר: 15 שניות','Time remaining: 15 seconds')}" data-running="false" style="--game-time-remaining:1"><svg class="game-hourglass" viewBox="0 0 32 40" aria-hidden="true" focusable="false"><path class="hourglass-sand hourglass-sand-top" d="M9 9h14l-7 9Z"/><path class="hourglass-sand hourglass-sand-bottom" d="M9 32h14l-7-9Z"/><path class="hourglass-stream" d="M16 19v7"/><path class="hourglass-frame" d="M5 3h22M5 37h22M8 3v8c0 4 5 6 8 9-3 3-8 5-8 9v8M24 3v8c0 4-5 6-8 9 3 3 8 5 8 9v8"/></svg><span><bdi class="game-time-value" id="familyGameSeconds">15</bdi><small>${tr('שניות','seconds')}</small></span></div>`;
}
function question(){
  const q=state.questions[state.index],label=tr('תמונה ','Photo ')+(state.index+1)+tr(' מתוך 10. ',' of 10. ')+photoPrompt();
  const top=`<button type="button" class="game-lobby-button" data-game-lobby>${I.isEnglish?'←':'→'} ${tr('בחירת משחק','Choose a game')}</button><div class="game-question-top"><span class="game-round">${isTextGame()?tr('שאלה','Question'):tr('תמונה','Photo')} <bdi>${state.index+1} / 10</bdi></span>${timer()}</div><progress class="game-progress" max="10" value="${state.index+1}" aria-label="${tr('התקדמות במשחק','Game progress')}"></progress>`;
  if(isKinship())return top+kinshipQuestion(q);
  if(isTrivia())return `${top}<h3 class="game-question-title trivia-question-title" tabindex="-1">${safe(tr(q.prompt,q.promptEn))}</h3><div class="trivia-person">${portrait(q.subject)}</div>${optionsHTML(q)}`;
  return `${top}<h3 class="game-question-title" tabindex="-1" aria-label="${label}">${photoPrompt()}</h3>${isMissing()?`<p class="game-question-hint">${tr('שלושה מהשמות מופיעים בתמונה. בחרו את מי שחסר.','Three of these people are in the photo. Choose who is missing.')}</p>`:''}<div class="game-photo"><img id="familyGamePhoto" src="${safe(q.src)}" alt="${tr('תמונה משפחתית לשאלה','Family photo for question')} ${state.index+1}" decoding="async"></div><p class="game-image-error" id="gameImageError" role="alert" hidden>${tr('התמונה לא נטענה.','The photo could not load.')} <button type="button" data-game-retry-image>${tr('טעינה מחדש','Try again')}</button></p>${optionsHTML(q)}`;
}
function result(){
  const grade=quizGrade(state.answers.filter(a=>a.correct).length),timeouts=state.answers.filter(a=>a.timedOut).length;
  const messages=isKinship()?{expert:[tr('מומחי הקשרים במשפחה!','Family connections experts!'),tr('גם נכד של דודה לא מבלבל אתכם. אתם יודעים לחבר את כל הענפים.','Even an aunt’s grandson cannot confuse you. You can connect every branch.')],familiar:[tr('כבר מחברים את הענפים!','You’re connecting the branches!'),tr('יש לכם חוש משפחתי טוב. עוד סיבוב בעץ, ותפענחו גם את הקשרים המפתיעים.','You have a good family instinct. Another visit to the tree will help with the surprising connections too.')],reunion:[tr('זמן לעוד מפגש משפחתי 😉','Time for another family gathering 😉'),tr('עוד כמה שיחות סביב השולחן, ופתאום כולם יתחברו לכם.','A few more conversations around the table and the connections will fall into place.')]}:isTrivia()?{expert:[tr('אוצרי הידע המשפחתי!','Keepers of the family knowledge!'),tr('שנים, חודשים וסיפורים — אתם זוכרים את הפרטים הקטנים של המשפחה.','Years, months and stories — you remember all the little family details.')],familiar:[tr('יש לכם זיכרון משפחתי טוב!','You have a good family memory!'),tr('עוד כמה סיפורים סביב השולחן ואתם בדרך לציון מושלם.','A few more stories around the table will put you on the path to a perfect score.')],reunion:[tr('זמן לעוד מפגש משפחתי 😉','Time for another family gathering 😉'),tr('זו הזדמנות לשמוע שוב את הסיפורים ולשאול את המשפחה על הפרטים.','A perfect chance to hear the stories again and ask the family about the details.')]}:isMissing()?{expert:[tr('בלשים משפחתיים מצטיינים!','Outstanding family detectives!'),tr('שום פרט לא נעלם מכם — גם כשצריך לזהות מי חסר.','You never miss a detail — even when it is someone who is missing.')],familiar:[tr('יש לכם עין משפחתית טובה!','You have a good eye for the family!'),tr('כבר שמים לב לפרטים. עוד סיבוב ותמצאו את כל מי שחסר.','You are spotting the details. Another round and you will find everyone who is missing.')],reunion:[tr('מחכים לכם במפגש המשפחתי הבא 😉','See you at the next family gathering 😉'),tr('עוד כמה מפגשים משפחתיים ותזהו מיד מי לא נכנס לפריים.','A few more family gatherings and you will know who did not make it into the frame.')]}:{expert:[tr('אנציקלופדיה משפחתית!','A family encyclopedia!'),tr('אין פנים שלא תזהו. אפשר למנות אתכם לאחראי התיוגים במשפחה.','No face escapes you. You could be the family’s official photo tagger.')],familiar:[tr('מכירים לא מעט!','You know the family!'),tr('עוד כמה אלבומים ומפגש משפחתי אחד, ואתם בדרך לציון מושלם.','A few more albums and one family gathering will put you on the path to a perfect score.')],reunion:[tr('מחכים לכם במפגש המשפחתי הבא 😉','See you at the next family gathering 😉'),tr('נראה שהגיע הזמן להגיע ליותר אירועים משפחתיים… בינתיים, סיבוב בגלריה יעשה פלאים!','It may be time to come to more family events… A stroll through the gallery will help in the meantime!')]},[title,message]=messages[grade.level];
  return `<div class="game-result" data-game-result tabindex="-1"><span class="game-medallion" aria-hidden="true">${grade.level==='expert'?'✦':grade.level==='familiar'?'❖':'♡'}</span><p class="small-eyebrow">${tr('הציון המשפחתי שלכם','Your family score')}</p><div class="game-score"><strong>${grade.score}</strong><span>/ 100</span></div><p>${grade.correct} ${tr('תשובות נכונות מתוך 10','correct answers out of 10')}</p>${timeouts?`<p class="game-timeouts">${timeouts===1?(isTextGame()?tr('שאלה אחת הסתיימה ללא תשובה בזמן','One question timed out without an answer'):tr('תמונה אחת הסתיימה ללא תשובה בזמן','One photo timed out without an answer')):timeouts+' '+(isTextGame()?tr('שאלות הסתיימו ללא תשובה בזמן','questions timed out without an answer'):tr('תמונות הסתיימו ללא תשובה בזמן','photos timed out without an answer'))}</p>`:''}<h3>${title}</h3><p>${message}</p><div class="game-result-actions"><button type="button" class="primary-button" data-game-start="${state.game}">${isKinship()?tr('עוד סיבוב עם קשרים חדשים','Play again with new connections'):isTrivia()?tr('עוד סיבוב עם שאלות חדשות','Play again with new questions'):tr('עוד סיבוב עם תמונות חדשות','Play again with new photos')}</button><button type="button" class="secondary-button" data-game-lobby>${tr('בחירת משחק','Choose a game')}</button><button type="button" class="secondary-button" data-view="gallery">${tr('לאלבום המשפחתי','Visit the Family Gallery')}</button></div>${resultSharing()}${review()}</div>`;
}
function finishRound(answerId=null,round=state.index){
  if(state.phase!=='playing'||state.view!=='games'||round!==state.index||!state.deadline)return;
  const q=state.questions[state.index],expired=Date.now()>=state.deadline;
  if(answerId!==null&&(!state.imageReady||!q.options.some(p=>p.id===answerId)))return;
  if(answerId===null&&!expired)return;
  const selected=expired?null:answerId;
  stopClock();state.answers.push({id:q.id,correct:selected!==null&&selected===q.correctId,timedOut:selected===null,selectedId:selected});
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
  if(isTextGame())return;
  // Warm only the next photo; the timer never runs while waiting for an image.
  const next=state.questions[state.index+1],key=state.serial+':'+(state.index+1);
  if(next&&key!==preloaded){preloaded=key;nextPhoto=new Image();nextPhoto.decoding='async';nextPhoto.src=next.src;}
}
function render(){
  stopClock();if(state.view!=='games')return;
  const token=++state.renderToken,index=state.index;
  $('familyGamesContent').innerHTML=state.phase==='playing'?question():state.phase==='finished'?result():welcome();
  for(const image of $('familyGamesContent').querySelectorAll('[data-kinship-photo]')){image.addEventListener('load',()=>{image.hidden=false;});image.addEventListener('error',()=>image.remove());if(image.complete&&image.naturalWidth)image.hidden=false;}
  if(state.phase==='playing'){
    state.imageReady=false;
    if(isTextGame()){
      imageReady(index,token);return;
    }
    const image=$('familyGamePhoto');
    image.addEventListener('load',()=>imageReady(index,token));
    image.addEventListener('error',()=>{if(state.renderToken!==token||state.index!==index)return;stopClock();state.imageReady=false;state.deadline=null;$('gameImageError').hidden=false;for(const button of $('familyGamesContent').querySelectorAll('[data-game-option]'))button.disabled=true;});
    if(image.complete&&image.naturalWidth)imageReady(index,token);
  }
}
async function start(game='photos'){
  if(state.phase==='loading')return;stopClock();const serial=++state.serial;state.game=['photos','kinship','missing','trivia'].includes(game)?game:'photos';state.phase='loading';state.error='';render();
  try{const response=await I.fetch(isKinship()?'api/games/relationships':isMissing()?'api/games/who-is-missing':isTrivia()?'api/games/trivia':'api/games/who-is-it',{cache:'no-store'}),data=await response.json();if(!response.ok)throw Error(I.error(data.error));if(serial!==state.serial)return;
    if(data.questions?.length!==10&&isTextGame())throw Error(tr('לא נמצאו מספיק שאלות כרגע. נסו שוב.','There are not enough questions available right now. Please try again.'));
    if(data.questions?.length!==10&&isMissing())throw Error(tr('כדי לשחק צריך 10 תמונות עם לפחות חמישה מתויגים ואפשרויות מתאימות. כרגע זמינות ','This game needs 10 photos with at least five tagged people and suitable answer choices. Currently available: ')+(data.available||0)+'.');
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
    const startButton=event.target.closest('[data-game-start]');if(startButton){start(startButton.dataset?.gameStart||state.game||'photos');return;}
    if(event.target.closest('[data-game-lobby]')){stopClock();state.serial++;Object.assign(state,{phase:'welcome',game:null,questions:[],answers:[],deadline:null,imageReady:false,error:''});render();return;}
    if(event.target.closest('[data-game-share-messenger]')){shareMessenger(event);return;}
    const choice=event.target.closest('[data-game-option]');
    if(choice&&event.detail<2){finishRound(choice.dataset.gameOption,Number(choice.dataset.gameRound));return;}
    if(event.target.closest('[data-game-retry-image]')&&state.phase==='playing'){$('gameImageError').hidden=true;$('familyGamePhoto').src=state.questions[state.index].src+'?retry='+Date.now();}
  });
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'){stopClock();return;}if(state.view!=='games'||state.phase!=='playing')return;if(state.deadline&&Date.now()>=state.deadline)finishRound(null);else startClock();});
  activate(window.FamilyApp.getView());
}
window.FamilyGames={activate};document.addEventListener('DOMContentLoaded',init);
