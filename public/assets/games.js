import {mountPuzzle,pausePuzzle} from './puzzle.js?v=return-lobby-v3';
import {mountJachnun,pauseJachnun} from './jachnun.js?v=leaderboard-v3';
import {mountRex,pauseRex} from './rex.js?v=4';
import {mountSoup,pauseSoup} from './soup.js?v=clear-feedback-v10';
import {mountNorth,pauseNorth} from './north.js?v=2';
import {mountNetoTetris,pauseNetoTetris} from './neto-tetris.js?v=4';
import {mountRutiHouse,pauseRutiHouse} from './ruti-house.js?v=9';
import {quizGrade} from './quiz.mjs';
import {makeChickQuiz,withinChickTarget} from './chick.mjs?v=family-search-v4';
import './differences.js?v=20261104.2';

const I=window.FamilyI18n,$=id=>document.getElementById(id),tr=(he,en)=>I.isEnglish?en:he;
const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ROUND_SECONDS=15;
const state={view:'tree',phase:'welcome',game:null,questions:[],index:0,answers:[],imageReady:false,deadline:null,error:'',serial:0,renderToken:0,zoom:1,cursor:{x:.5,y:.5},lastRemaining:60,mistakes:0,autoNextAt:null};
let clock=null,advanceClock=null,nextPhoto=null,preloaded='';
let initialSoupLink=new URL(window.location.href).searchParams.get('game')==='soup';
let initialNorthLink=new URL(window.location.href).searchParams.get('game')==='north';
let initialNetoLink=new URL(window.location.href).searchParams.get('game')==='neto-tetris';
let initialRutiLink=new URL(window.location.href).searchParams.get('game')==='ruti-house';
const editor={language:I.isEnglish?'en':'he',languageChosen:false,question:'',options:['','','',''],correctIndex:null,requestId:null,saving:false,status:'',error:''};
const name=person=>I.personName(person);
function stopClock(){if(clock!==null)clearInterval(clock);if(advanceClock!==null)clearInterval(advanceClock);clock=null;advanceClock=null;}
const isKinship=()=>state.game==='kinship';
const isMissing=()=>state.game==='missing';
const isTrivia=()=>state.game==='trivia';
const isChick=()=>state.game==='chick';
const isTextGame=()=>isKinship()||isTrivia();
const total=()=>state.questions.length;
const roundSeconds=()=>isChick()?60:ROUND_SECONDS;
const gameTitle=()=>isChick()?tr('איפה הגוזל?','Where’s the little bird?'):isKinship()?tr('מה הקשר?','What’s the relation?'):isMissing()?tr('מי חסר?','Who’s missing?'):isTrivia()?tr('טריוויה משפחתית','Family Trivia'):tr('מי זה?','Who is it?');
const photoPrompt=()=>isMissing()?tr('מי חסר?','Who’s missing?'):tr('מי מופיע בתמונה?','Who appears in this photo?');
function sideDancer(side){
  return `<figure class="game-lobby-welcome game-lobby-side game-lobby-side-${side}" data-dancing="true"><figcaption class="game-side-speech">${tr('בואו נשחק!','Let’s play!')}</figcaption><div class="game-lobby-dancer" role="img" aria-label="${tr('סבא שלמה רוקד','Grandpa Shlomo dancing')}"><span class="shlomo-dance-frames" aria-hidden="true"></span></div><button type="button" class="game-dance-toggle" data-shlomo-dance aria-pressed="true">${tr('עצירת הריקוד','Pause dance')}</button></figure>`;
}
function welcome(){
  const games=[['jachnun','games',tr('תפוס תג׳חנון','Catch the Jachnun'),tr('אספו ג׳חנונים והאריכו את שרשרת הראשים.','Collect jachnun and grow a chain of heads.')],['photos','photos',tr('מי זה?','Who is it?'),tr('זהו מי מופיע בתמונות המשפחתיות.','Recognize faces in family photos.')],['kinship','tree',tr('מה הקשר?','What’s the relation?'),tr('גלו את הקשרים בין בני המשפחה.','Discover how family members are related.')],['missing','directory',tr('מי חסר?','Who’s missing?'),tr('תמונה וארבעה שמות — מי לא מופיע בה?','Four names. Who is missing from the photo?')],['trivia','calendar',tr('טריוויה משפחתית','Family Trivia'),tr('בחנו את הידע שלכם על המשפחה.','Test your knowledge of our family.')],['puzzle','photos',tr('פאזל משפחתי','Family Puzzle'),tr('הרכיבו תמונה משפחתית, חלק אחר חלק.','Piece together a family photograph.')],['chick','games',tr('איפה הגוזל?','Where’s the little bird?'),tr('מצאו את הדמות המשפחתית בתוך הקהל.','Find a familiar face in the busy crowd.')],['differences','photos',tr('מצא את ההבדלים','Spot the differences'),tr('גלו מה השתנה בין שתי התמונות.','Spot what changed between two photos.')],['rex','games',tr('תימנירקס','Yemeanite Rex'),tr('קפצו מעל גת ואספו מטעמים תימניים.','Jump over khat and collect Yemeni treats.')],['soup','games',tr('המתכון הסודי','The Secret Recipe'),tr('פצחו את סוד המרק התימני של סבתא יונה','Crack the secret of Grandma Yona’s Yemeni soup.')]];
  games.unshift(['neto-tetris','games',tr('חשמל נטו טטריס','Hashmal Neto Tetris'),tr('טטריס עם מוצרי החשמל של חשמל נטו.','Tetris with Hashmal Neto appliances.')]);
  games.unshift(['north','games',tr('נוסעים לצפון','Heading North'),tr('נוסעים בקרוז למפגש המשפחתי — לזכרו של רועי חריזי ז״ל.','Drive the Cruze to our family gathering — in loving memory of Roei Harizi.')]);
  games.unshift(['ruti-house','home',tr('הבית של רותי','Ruti’s House'),tr('משקים, מנקים ומארחים באהבה — והחתולים בחוץ!','Water, clean and welcome the family with love — keep the cats outside!')]);
  return `<header class="family-game-intro"><span class="game-medallion" aria-hidden="true">❖</span><span class="small-eyebrow">${tr('המשפחה שלנו, מזווית קצת אחרת','Our family, from a different angle')}</span><h3>${tr('במה משחקים היום?','What shall we play?')}</h3><p>${tr('מזהים פנים או מפענחים קשרים? בחרו את האתגר שלכם.','Recognize faces or untangle family ties? Choose your challenge.')}</p></header><div class="game-lobby-desktop-stage">${sideDancer('left')}${sideDancer('right')}<div class="family-game-choices">${games.map(([id,icon,title,description])=>`<button type="button" class="family-game-choice game-choice-${id}" data-game-start="${id}" ${id==='trivia'?'data-game-home="trivia"':''} ${state.phase==='loading'?'disabled':''}><span class="game-choice-icon" aria-hidden="true"><svg viewBox="0 0 48 48">${id==='ruti-house'?'<path d="m5 23 19-16 19 16M10 19v22h28V19M20 41V29h9v12" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 22c-6-4-4-10 1-7 5-3 7 3-1 7Z"/>':id==='neto-tetris'?'<path d="M8 8h10v10H8zm10 0h10v10H18zm0 10h10v10H18zm10 0h10v10H28z"/><path d="m8 37 5-8h-5l5-8" fill="none"/>':id==='north'?'<path d="M11 35V16l4-9h18l4 9v19M11 21h26M16 29h4m8 0h4M15 35v5m18-5v5M17 12h14"/><path d="m24 18 4 5h-8Z"/>':id==='soup'?'<path d="M10 21h28v17q-14 9-28 0Z"/><ellipse cx="24" cy="21" rx="14" ry="5"/><path d="M10 25H4v9h6m28-9h6v9h-6M16 14q-5-5 0-9m8 9q-5-5 0-9m8 9q-5-5 0-9" fill="none"/>':id==='rex'?'<path d="M7 36h9l5-9 7 6h8M20 27V17m-1 7-8 4m9-5 9-4" fill="none" stroke-linecap="round" stroke-width="4"/><circle cx="21" cy="10" r="7"/><path d="M38 39V22m0 9-7-6m7 2 6-8m-6 2-5-6" fill="none" stroke-linecap="round"/>':id==='jachnun'?'<path d="M7 33c-7-12 7-18 16-12l12-10c9-7 16 5 10 11L25 39c-7 6-14 2-18-6Z"/><path d="M12 30c-2-5 5-8 9-4s1 9-3 9-5-4-2-5" fill="none"/>':id==='puzzle'?'<path d="M5 6h13v4a5 5 0 1 0 10 0V6h14v13h-4a5 5 0 1 0 0 10h4v13H28v-4a5 5 0 1 0-10 0v4H5V29h4a5 5 0 1 0 0-10H5Z"/>':`<use href="assets/home-icons.svg#${icon}"></use>`}</svg></span><span><strong>${title}</strong><span class="game-choice-description">${description}</span><b>${state.phase==='loading'&&state.game===id?tr('מכין את האתגר…','Preparing your challenge…'):tr('בואו נשחק','Let’s play')} ${I.isEnglish?'→':'←'}</b></span></button>`).join('')}</div></div><figure class="game-lobby-welcome" data-dancing="true"><img src="assets/games/yemeni-courtyard.webp" width="1536" height="1024" loading="eager" decoding="async" alt="${tr('בניינים תימניים מסורתיים וחצר מוארת','Traditional Yemeni buildings and a sunlit courtyard')}"><div class="game-lobby-dancer" role="img" aria-label="${tr('סבא שלמה עם תרבוש אדום רוקד צעד תימני','Grandpa Shlomo in a red fez dances a Yemeni step')}"><span class="shlomo-dance-frames" aria-hidden="true"></span></div><figcaption class="game-lobby-speech">${tr('בואו נשחק!','Let’s play!')}</figcaption><button type="button" class="game-dance-toggle" data-shlomo-dance aria-pressed="true">${tr('עצירת הריקוד','Pause dance')}</button></figure>${state.error?`<p class="game-error" role="alert">${safe(state.error)}</p>`:''}`;
}
function openTrivia(){stopClock();state.serial++;Object.assign(state,{game:'trivia',phase:'trivia-home',questions:[],answers:[],deadline:null,error:''});render();}
function triviaHome(){
  const disabled=editor.saving?'disabled':'';
  return `<button type="button" class="game-lobby-button" data-game-lobby>${I.isEnglish?'←':'→'} ${tr('חזרה ללוח בחירת המשחקים','Back to game selection')}</button><header class="family-game-intro"><span class="game-medallion" aria-hidden="true">❖</span><h3>${tr('טריוויה משפחתית','Family Trivia')}</h3><p>${tr('ימי הולדת, סדר הלידה, שנות עלייה והשאלות שלכם.','Birthdays, birth order, immigration years and your own questions.')}</p></header><div class="game-welcome"><p>${tr('10 שאלות אקראיות, 15 שניות לשאלה. התשובות והמשוב מחכים בסוף.','10 random questions, 15 seconds per question. Answers and feedback appear at the end.')}</p><button type="button" class="primary-button" data-game-start="trivia">${tr('מתחילים לשחק','Let’s play')}</button>${state.error?`<p class="game-error" role="alert">${safe(state.error)}</p>`:''}</div><section class="trivia-builder"><header><h4>${tr('מוסיפים שאלה משלנו','Add a family question')}</h4><p>${tr('כתבו שאלה וארבע תשובות, וסמנו את התשובה הנכונה. היא תצטרף למאגר המשותף ותוכל להופיע במשחקים הבאים.','Write a question and four choices, and mark the correct answer. It will join the shared bank for future games.')}</p></header><form data-trivia-question-form><label for="triviaQuestionLanguage">${tr('שפת השאלה','Question language')}</label><select id="triviaQuestionLanguage" ${disabled}><option value="he" ${editor.language==='he'?'selected':''}>עברית</option><option value="en" ${editor.language==='en'?'selected':''}>English</option></select><small id="triviaLanguageHint">${triviaLanguageHint()}</small><label for="triviaNewQuestion">${tr('השאלה שלכם','Your question')}</label><textarea id="triviaNewQuestion" dir="auto" rows="3" minlength="5" maxlength="500" required ${disabled}>${safe(editor.question)}</textarea><fieldset ${disabled}><legend>${tr('ארבע התשובות — סמנו את הנכונה','Four choices — mark the correct one')}</legend>${editor.options.map((value,index)=>`<div class="trivia-builder-option"><label class="trivia-correct-choice"><input type="radio" name="triviaCorrect" data-trivia-correct="${index}" value="${index}" ${editor.correctIndex===index?'checked':''} required><span class="visually-hidden">${tr('תשובה ','Answer ')}${index+1}${tr(' היא הנכונה',' is correct')}</span></label><label class="visually-hidden" for="triviaAnswer${index}">${tr('תשובה ','Answer ')}${index+1}</label><input type="text" dir="auto" id="triviaAnswer${index}" value="${safe(value)}" maxlength="160" required placeholder="${tr('תשובה ','Answer ')}${index+1}"></div>`).join('')}</fieldset><p class="game-error" role="alert">${safe(editor.error)}</p><p class="trivia-builder-status" role="status">${safe(editor.status)}</p><button type="submit" class="primary-button" ${disabled}>${editor.saving?tr('מוסיפים למאגר…','Adding to the bank…'):tr('הוספת השאלה למאגר','Add question to the bank')}</button></form></section>`;
}
function triviaLanguageHint(){return editor.language==='he'?tr('השאלה תופיע רק במשחק בעברית.','This question will appear only in the Hebrew game.'):tr('השאלה תופיע רק במשחק באנגלית.','This question will appear only in the English game.');}
async function saveTriviaQuestion(event){
  event.preventDefault();if(editor.saving)return;
  if(editor.correctIndex===null){editor.error=tr('סמנו את התשובה הנכונה.','Mark the correct answer.');render();return;}
  editor.requestId??=crypto.randomUUID().replaceAll('-','');editor.saving=true;editor.error='';editor.status='';
  const body={language:editor.language,question:editor.question,options:[...editor.options],correctIndex:editor.correctIndex,requestId:editor.requestId};render();
  try{const response=await I.fetch('api/games/trivia/questions',{method:'POST',headers:{'Content-Type':'application/json','X-Family-Token':window.FAMILY_API_TOKEN},body:JSON.stringify(body)}),data=await response.json();if(!response.ok)throw Error(I.error(data.error));Object.assign(editor,{question:'',options:['','','',''],correctIndex:null,requestId:null,languageChosen:false,status:tr('השאלה נוספה למאגר ✓ ','Question added to the bank ✓ ')+triviaLanguageHint()});}
  catch(error){editor.error=error.message;}
  finally{editor.saving=false;if(state.phase==='trivia-home')render();}
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
function chickClue(q){
  return `<img class="chick-clue chick-reference-portrait" src="${safe(q.portrait)}" alt="${safe(tr('דיוקן של ','Portrait of ')+name(q.subject))}" width="600" height="600" decoding="async">`;
}
function chickRing(q){const t=q.target;return `<span class="chick-reveal-ring" aria-hidden="true" style="left:${(t.x-t.w/2)*100}%;top:${(t.y-t.h/2)*100}%;width:${t.w*100}%;height:${t.h*100}%"></span>`;}
function chickQuestion(q){
  const revealed=state.phase==='revealed',found=state.answers[state.index]?.correct;
  return `<h3 class="game-question-title" tabindex="-1">${tr('איפה הגוזל? מצאו את ','Where’s the little bird? Find ')}${safe(name(q.subject))}</h3><div class="chick-hunt-guide">${chickClue(q)}<div><strong>${safe(name(q.subject))}</strong><p>${tr('מצאו את הגרסה המאוירת בקהל: התנוחה והלבוש עשויים להשתנות. אפשר להגדיל ולגלול.','Find the illustrated version in the crowd: its pose and clothes may differ. Zoom in and scroll to search.')}</p></div><span class="chick-mistakes" id="chickMistakes">${tr('טעויות: ','Mistakes: ')}${state.mistakes} / 3</span><button type="button" class="secondary-button chick-zoom" data-game-find-zoom aria-pressed="${state.zoom>1}">${state.zoom>1?tr('הקטנה −','Zoom out −'):tr('הגדלה +','Zoom in +')}</button></div><p class="visually-hidden" id="chickKeyboardHint">${tr('במקלדת: הזיזו את הסמן בחיצים ולחצו Enter כדי לבחור.','Keyboard: move the marker with the arrow keys, then press Enter to select.')}</p><div class="chick-scene-scroll" id="chickSceneScroll" dir="ltr"><div class="chick-scene-stage" id="chickSceneStage" data-game-find-stage style="width:${state.zoom*100}%" tabindex="${revealed?'-1':'0'}" role="button" aria-label="${safe(tr('מצאו את ','Find ')+name(q.subject))}" aria-describedby="chickKeyboardHint"><img id="familyGamePhoto" src="${safe(q.src)}" width="${q.width}" height="${q.height}" alt="${safe(tr(q.title,q.titleEn))}" decoding="async" draggable="false"><span class="chick-probe" id="chickProbe" aria-hidden="true" hidden></span>${revealed?chickRing(q):''}</div></div><p class="game-image-error" id="gameImageError" role="alert" hidden>${tr('האיור לא נטען.','The illustration could not load.')} <button type="button" data-game-retry-image>${tr('טעינה מחדש','Try again')}</button></p><div class="chick-feedback${revealed&&found?' chick-found':''}" id="chickFeedback" role="status" tabindex="-1">${revealed?`${chickClue(q)}<strong>${found?tr('יפה מאוד, מצאת את ','Well done, you found '):state.mistakes>=3?tr('שלוש טעויות — עוברים לתמונה הבאה. הנה ','Three mistakes — moving to the next illustration. Here is '):tr('הזמן נגמר! הנה ','Time’s up! Here is ')}${safe(name(q.subject))}${found?'!':' — '+tr('מסומן באיור.','marked in the illustration.')}</strong><button type="button" class="primary-button" data-game-find-next>${state.index===total()-1?tr('לתוצאות','See results'):tr('לאיור הבא','Next illustration')}</button>`:''}</div>`;
}
function finishChick(found,round=state.index){
  if(!isChick()||state.phase!=='playing'||state.view!=='games'||round!==state.index||!state.deadline)return;
  const expired=Date.now()>=state.deadline;if(!state.imageReady||!found&&!expired&&state.mistakes<3)return;
  found=Boolean(found&&!expired);const q=state.questions[state.index],scroll=$('chickSceneScroll'),position={left:scroll?.scrollLeft||0,top:scroll?.scrollTop||0};
  stopClock();state.lastRemaining=Math.max(0,Math.ceil((state.deadline-Date.now())/1000));state.answers.push({id:q.id,correct:found,timedOut:!found&&expired,mistakes:state.mistakes,selectedId:found?q.subject.id:null});state.phase='revealed';state.deadline=null;state.imageReady=false;state.autoNextAt=!found&&state.mistakes>=3?Date.now()+1200:null;render();
  const viewport=$('chickSceneScroll');if(viewport){viewport.scrollLeft=position.left;viewport.scrollTop=position.top;}
  $('familyGamesContent').querySelector('.chick-reveal-ring')?.scrollIntoView({block:'nearest',inline:'nearest'});$('chickFeedback')?.scrollIntoView({block:'nearest'});$('chickFeedback')?.focus({preventScroll:true});
}
function findChick(x,y){
  if(!isChick()||state.phase!=='playing'||!state.imageReady)return;
  if(withinChickTarget(state.questions[state.index].target,x,y)){finishChick(true);return;}
  if(state.deadline&&Date.now()>=state.deadline){finishChick(false);return;}
  if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||x>1||y<0||y>1)return;
  state.mistakes++;if(state.mistakes>=3){finishChick(false);return;}
  $('chickMistakes').textContent=tr('טעויות: ','Mistakes: ')+state.mistakes+' / 3';
  const marker=$('chickProbe');if(marker){marker.hidden=false;marker.style.left=x*100+'%';marker.style.top=y*100+'%';}
  $('chickFeedback').textContent=tr('עוד לא… נסו שוב, השעון ממשיך!','Not yet… try again, the clock is still running!');
}
function scrollToRound(){$('familyGamesContent').querySelector('.game-question-top')?.scrollIntoView({block:'start'});}
function nextChick(){
  if(!isChick()||state.phase!=='revealed')return;
  state.autoNextAt=null;state.mistakes=0;
  if(state.index===total()-1)state.phase='finished';else{state.index++;state.phase='playing';state.zoom=1;state.cursor={x:.5,y:.5};}
  render();if(state.phase==='playing')scrollToRound();$('familyGamesContent').querySelector(state.phase==='finished'?'[data-game-result]':'.game-question-title')?.focus({preventScroll:true});
}
function scheduleChickAdvance(){
  if(advanceClock!==null){clearInterval(advanceClock);advanceClock=null;}
  if(!isChick()||state.phase!=='revealed'||!state.autoNextAt||state.view!=='games'||document.visibilityState==='hidden')return;
  const advance=()=>{if(state.view==='games'&&state.phase==='revealed'&&state.autoNextAt&&Date.now()>=state.autoNextAt)nextChick();};
  advanceClock=setInterval(advance,100);
}

function review(){
  return `<details class="kinship-review game-review"><summary>${tr('השאלות והתשובות הנכונות','Review questions and correct answers')}</summary><ol>${state.questions.map((q,index)=>{
    const answer=q.options.find(option=>option.id===q.correctId),record=state.answers[index],selected=q.options.find(option=>option.id===record.selectedId);
    const prompt=isChick()?tr('איפה מתחבא/ת ','Where is ')+name(q.subject)+(I.isEnglish?' hiding?':'?'):isTrivia()?tr(q.prompt,q.promptEn):isKinship()?(I.isEnglish?`How is ${name(q.subject)} related to ${name(q.reference)}?`:`מה הקשר של ${name(q.subject)} ל${name(q.reference)}?`):photoPrompt();
    const sentence=isKinship()?(I.isEnglish?`${name(q.subject)} is ${name(q.reference)}’s ${answer.nameEn.toLowerCase()}.`:`${name(q.subject)} ${q.subject.gender==='f'?'היא':'הוא'} ${answer.name} של ${name(q.reference)}.`):tr('התשובה הנכונה: ','Correct answer: ')+name(answer);
    return `<li data-game-review-question="${index+1}"><span class="kinship-review-mark" aria-hidden="true">${record.correct?'✓':'·'}</span><div class="game-review-question"><strong>${index+1}. ${safe(prompt)}</strong>${isTextGame()&&q.subject?`<div class="game-review-people">${portrait(q.subject)}${isKinship()?portrait(q.reference):''}</div>`:q.src?`<div class="game-review-scene${isChick()?' chick-review-scene':''}"><img class="game-review-photo" src="${safe(q.src)}" alt="${tr('התמונה משאלה','Photo from question')} ${index+1}" loading="lazy" decoding="async">${isChick()?chickRing(q):''}</div>`:''}<p>${safe(sentence)}</p><small>${record.timedOut?tr('הזמן הסתיים ללא תשובה','Time ran out without an answer'):isChick()&&record.mistakes>=3?tr('שלוש טעויות — ללא נקודה','Three mistakes — no point'):tr('בחרתם: ','Your answer: ')+safe(name(selected))}${record.correct?' '+tr('— נכון!','— correct!'):''}</small></div></li>`;
  }).join('')}</ol></details>`;
}
function resultShareData(){
  const grade=quizGrade(state.answers.filter(answer=>answer.correct).length,total()),title=gameTitle();
  const url=new URL(window.location.pathname,window.location.origin);url.searchParams.set('lang',I.language||(I.isEnglish?'en-US':'he'));url.hash='games';
  const text=tr(`שיחקתי ב״${title}״ וקיבלתי ${grade.score}/100 — ${grade.correct} ${grade.correct===1?'תשובה נכונה':'תשובות נכונות'} מתוך ${total()}!\nחושבים שתצליחו יותר? בואו לשחק במשחקי המשפחה 👨‍👩‍👧‍👦`,`I scored ${grade.score}/100 in “${title}” — ${grade.correct} correct ${grade.correct===1?'answer':'answers'} out of ${total()}!\nThink you can do better? Try the Family Games 👨‍👩‍👧‍👦`);
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
  const seconds=state.phase==='revealed'?state.lastRemaining:roundSeconds();
  return `<div class="game-timer" id="familyGameTimer" role="timer" aria-live="off" aria-label="${tr('זמן נותר: ','Time remaining: ')+seconds+tr(' שניות',' seconds')}" data-running="false" style="--game-time-remaining:${seconds/roundSeconds()}"><svg class="game-hourglass" viewBox="0 0 32 40" aria-hidden="true" focusable="false"><path class="hourglass-sand hourglass-sand-top" d="M9 9h14l-7 9Z"/><path class="hourglass-sand hourglass-sand-bottom" d="M9 32h14l-7-9Z"/><path class="hourglass-stream" d="M16 19v7"/><path class="hourglass-frame" d="M5 3h22M5 37h22M8 3v8c0 4 5 6 8 9-3 3-8 5-8 9v8M24 3v8c0 4-5 6-8 9 3 3 8 5 8 9v8"/></svg><span><bdi class="game-time-value" id="familyGameSeconds">${seconds}</bdi><small>${tr('שניות','seconds')}</small></span></div>`;
}
function question(){
  const q=state.questions[state.index],label=tr('תמונה ','Photo ')+(state.index+1)+tr(' מתוך ',' of ')+total()+'. '+photoPrompt();
  const top=`<button type="button" class="game-lobby-button" data-game-lobby>${I.isEnglish?'←':'→'} ${tr('חזרה ללוח בחירת המשחקים','Back to game selection')}</button><div class="game-question-top"><span class="game-round">${isChick()?tr('איור','Illustration'):isTextGame()?tr('שאלה','Question'):tr('תמונה','Photo')} <bdi>${state.index+1} / ${total()}</bdi></span>${timer()}</div><progress class="game-progress" max="${total()}" value="${state.index+1}" aria-label="${tr('התקדמות במשחק','Game progress')}"></progress>`;
  if(isChick())return top+chickQuestion(q);
  if(isKinship())return top+kinshipQuestion(q);
  if(isTrivia())return `${top}<h3 class="game-question-title trivia-question-title" tabindex="-1">${safe(tr(q.prompt,q.promptEn))}</h3>${q.subject?`<div class="trivia-person">${portrait(q.subject)}</div>`:'<span class="trivia-custom-ornament" aria-hidden="true">❖</span>'}${optionsHTML(q)}`;
  return `${top}<h3 class="game-question-title" tabindex="-1" aria-label="${label}">${photoPrompt()}</h3>${isMissing()?`<p class="game-question-hint">${tr('שלושה מהשמות מופיעים בתמונה. בחרו את מי שחסר.','Three of these people are in the photo. Choose who is missing.')}</p>`:''}<div class="game-photo"><img id="familyGamePhoto" src="${safe(q.src)}" alt="${tr('תמונה משפחתית לשאלה','Family photo for question')} ${state.index+1}" decoding="async"></div><p class="game-image-error" id="gameImageError" role="alert" hidden>${tr('התמונה לא נטענה.','The photo could not load.')} <button type="button" data-game-retry-image>${tr('טעינה מחדש','Try again')}</button></p>${optionsHTML(q)}`;
}
function result(){
  const grade=quizGrade(state.answers.filter(a=>a.correct).length,total()),timeouts=state.answers.filter(a=>a.timedOut).length;
  const messages=isChick()?{expert:[tr('עיני נץ משפחתיות!','The family’s eagle eyes!'),tr('בין כל הפרטים הקטנים, הגוזלים לא הצליחו להתחבא מכם.','Among all those tiny details, the little birds could not hide from you.')],familiar:[tr('יש לכם עין חדה!','You have a sharp eye!'),tr('כבר מצאתם לא מעט. עוד סיבוב ותגלו את כל הגוזלים.','You found quite a few. Another round and you will spot every little bird.')],reunion:[tr('הגוזלים הצליחו להתחבא הפעם 😉','The little birds hid well this time 😉'),tr('קחו עוד מבט — המשפחה מחכה שתמצאו אותה בין כל הפרטים.','Take another look — the family is waiting among all those little details.')]}:isKinship()?{expert:[tr('מומחי הקשרים במשפחה!','Family connections experts!'),tr('גם נכד של דודה לא מבלבל אתכם. אתם יודעים לחבר את כל הענפים.','Even an aunt’s grandson cannot confuse you. You can connect every branch.')],familiar:[tr('כבר מחברים את הענפים!','You’re connecting the branches!'),tr('יש לכם חוש משפחתי טוב. עוד סיבוב בעץ, ותפענחו גם את הקשרים המפתיעים.','You have a good family instinct. Another visit to the tree will help with the surprising connections too.')],reunion:[tr('זמן לעוד מפגש משפחתי 😉','Time for another family gathering 😉'),tr('עוד כמה שיחות סביב השולחן, ופתאום כולם יתחברו לכם.','A few more conversations around the table and the connections will fall into place.')]}:isTrivia()?{expert:[tr('אוצרי הידע המשפחתי!','Keepers of the family knowledge!'),tr('שנים, חודשים וסיפורים — אתם זוכרים את הפרטים הקטנים של המשפחה.','Years, months and stories — you remember all the little family details.')],familiar:[tr('יש לכם זיכרון משפחתי טוב!','You have a good family memory!'),tr('עוד כמה סיפורים סביב השולחן ואתם בדרך לציון מושלם.','A few more stories around the table will put you on the path to a perfect score.')],reunion:[tr('זמן לעוד מפגש משפחתי 😉','Time for another family gathering 😉'),tr('זו הזדמנות לשמוע שוב את הסיפורים ולשאול את המשפחה על הפרטים.','A perfect chance to hear the stories again and ask the family about the details.')]}:isMissing()?{expert:[tr('בלשים משפחתיים מצטיינים!','Outstanding family detectives!'),tr('שום פרט לא נעלם מכם — גם כשצריך לזהות מי חסר.','You never miss a detail — even when it is someone who is missing.')],familiar:[tr('יש לכם עין משפחתית טובה!','You have a good eye for the family!'),tr('כבר שמים לב לפרטים. עוד סיבוב ותמצאו את כל מי שחסר.','You are spotting the details. Another round and you will find everyone who is missing.')],reunion:[tr('מחכים לכם במפגש המשפחתי הבא 😉','See you at the next family gathering 😉'),tr('עוד כמה מפגשים משפחתיים ותזהו מיד מי לא נכנס לפריים.','A few more family gatherings and you will know who did not make it into the frame.')]}:{expert:[tr('אנציקלופדיה משפחתית!','A family encyclopedia!'),tr('אין פנים שלא תזהו. אפשר למנות אתכם לאחראי התיוגים במשפחה.','No face escapes you. You could be the family’s official photo tagger.')],familiar:[tr('מכירים לא מעט!','You know the family!'),tr('עוד כמה אלבומים ומפגש משפחתי אחד, ואתם בדרך לציון מושלם.','A few more albums and one family gathering will put you on the path to a perfect score.')],reunion:[tr('מחכים לכם במפגש המשפחתי הבא 😉','See you at the next family gathering 😉'),tr('נראה שהגיע הזמן להגיע ליותר אירועים משפחתיים… בינתיים, סיבוב בגלריה יעשה פלאים!','It may be time to come to more family events… A stroll through the gallery will help in the meantime!')]},[title,message]=messages[grade.level];
  return `<div class="game-result" data-game-result tabindex="-1"><span class="game-medallion" aria-hidden="true">${grade.level==='expert'?'✦':grade.level==='familiar'?'❖':'♡'}</span><p class="small-eyebrow">${tr('הציון המשפחתי שלכם','Your family score')}</p><div class="game-score"><strong>${grade.score}</strong><span>/ 100</span></div><p>${grade.correct} ${grade.correct===1?tr('תשובה נכונה מתוך ','correct answer out of '):tr('תשובות נכונות מתוך ','correct answers out of ')}${total()}</p>${timeouts?`<p class="game-timeouts">${timeouts===1?(isTextGame()?tr('שאלה אחת הסתיימה ללא תשובה בזמן','One question timed out without an answer'):tr('תמונה אחת הסתיימה ללא תשובה בזמן','One photo timed out without an answer')):timeouts+' '+(isTextGame()?tr('שאלות הסתיימו ללא תשובה בזמן','questions timed out without an answer'):tr('תמונות הסתיימו ללא תשובה בזמן','photos timed out without an answer'))}</p>`:''}<h3>${title}</h3><p>${message}</p><div class="game-result-actions"><button type="button" class="primary-button" data-game-start="${state.game}">${isChick()?tr('עוד סיבוב של חיפושים','Search again'):isKinship()?tr('עוד סיבוב עם קשרים חדשים','Play again with new connections'):isTrivia()?tr('עוד סיבוב עם שאלות חדשות','Play again with new questions'):tr('עוד סיבוב עם תמונות חדשות','Play again with new photos')}</button><button type="button" class="secondary-button" data-game-lobby>${tr('חזרה ללוח בחירת המשחקים','Back to game selection')}</button><button type="button" class="secondary-button" data-view="gallery">${tr('לאלבום המשפחתי','Visit the Family Gallery')}</button></div>${resultSharing()}${review()}</div>`;
}
function finishRound(answerId=null,round=state.index){
  if(state.phase!=='playing'||state.view!=='games'||round!==state.index||!state.deadline)return;
  const q=state.questions[state.index],expired=Date.now()>=state.deadline;
  if(answerId!==null&&(!state.imageReady||!q.options.some(p=>p.id===answerId)))return;
  if(answerId===null&&!expired)return;
  const selected=expired?null:answerId;
  stopClock();state.answers.push({id:q.id,correct:selected!==null&&selected===q.correctId,timedOut:selected===null,selectedId:selected});
  state.deadline=null;state.imageReady=false;
  if(state.index===total()-1)state.phase='finished';else state.index++;
  render();if(state.phase==='playing')scrollToRound();$('familyGamesContent').querySelector(state.phase==='finished'?'[data-game-result]':'.game-question-title')?.focus({preventScroll:true});
}
function updateClock(){
  if(state.view!=='games'||state.phase!=='playing'||!state.deadline)return;
  const remaining=Math.max(0,Math.ceil((state.deadline-Date.now())/1000)),timer=$('familyGameTimer'),seconds=$('familyGameSeconds');
  if(timer&&seconds){seconds.textContent=String(remaining);timer.dataset.running='true';timer.dataset.urgent=String(remaining<=5);timer.style.setProperty('--game-time-remaining',String(remaining/roundSeconds()));timer.setAttribute('aria-label',tr('זמן נותר: ','Time remaining: ')+remaining+tr(' שניות',' seconds'));}
  if(remaining===0){if(isChick())finishChick(false);else finishRound(null);}
}
function startClock(){
  if(state.view!=='games'||state.phase!=='playing'||!state.imageReady||document.visibilityState==='hidden')return;
  state.deadline??=Date.now()+roundSeconds()*1000;
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
  if(state.phase==='ruti-house'){pauseNetoTetris();pauseNorth();pauseSoup();pauseRex();pauseJachnun();pausePuzzle();mountRutiHouse($('familyGamesContent'),()=>{state.phase='welcome';state.game=null;render();});return;}
  pauseRutiHouse();
  if(state.phase==='neto-tetris'){pauseNorth();pauseSoup();pauseRex();pauseJachnun();pausePuzzle();mountNetoTetris($('familyGamesContent'),()=>{state.phase='welcome';state.game=null;render();});return;}
  pauseNetoTetris();
  if(state.phase==='north'){pausePuzzle();pauseJachnun();pauseRex();pauseSoup();mountNorth($('familyGamesContent'),()=>{state.phase='welcome';state.game=null;render();});return;}
  pauseNorth();
  if(state.phase==='soup'){pausePuzzle();pauseJachnun();pauseRex();mountSoup($('familyGamesContent'),()=>{state.phase='welcome';state.game=null;render();});return;}
  pauseSoup();
  if(state.phase==='rex'){pausePuzzle();pauseJachnun();mountRex($('familyGamesContent'),()=>{state.phase='welcome';state.game=null;render();});return;}
  pauseRex();
  if(state.phase==='jachnun'){pausePuzzle();mountJachnun($('familyGamesContent'),()=>{state.phase='welcome';state.game=null;render();});return;}
  pauseJachnun();
  if(state.phase==='puzzle'){mountPuzzle($('familyGamesContent'),()=>{state.phase='welcome';state.game=null;render();});return;}
  pausePuzzle();
  const token=++state.renderToken,index=state.index;
  $('familyGamesContent').innerHTML=(state.phase==='playing'||state.phase==='revealed')?question():state.phase==='finished'?result():state.phase==='trivia-home'?triviaHome():welcome();
  scheduleChickAdvance();
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
  if(game==='ruti-house'){stopClock();state.serial++;state.game='ruti-house';state.phase='ruti-house';render();return;}
  if(game==='neto-tetris'){stopClock();state.serial++;state.game='neto-tetris';state.phase='neto-tetris';render();return;}
  if(game==='north'){stopClock();state.serial++;state.game='north';state.phase='north';render();return;}
  if(game==='soup'){stopClock();pausePuzzle();pauseJachnun();pauseRex();state.serial++;state.game='soup';state.phase='soup';render();return;}
  if(game==='rex'){stopClock();pausePuzzle();pauseJachnun();state.serial++;state.game='rex';state.phase='rex';render();return;}
  if(game==='jachnun'){stopClock();pausePuzzle();state.serial++;state.game='jachnun';state.phase='jachnun';render();return;}
  if(game==='puzzle'){stopClock();state.serial++;state.game='puzzle';state.phase='puzzle';render();return;}
  pausePuzzle();
  if(game==='differences'){stopClock();state.serial++;state.phase='welcome';window.FamilyDifferences?.open();return;}
  if(state.phase==='loading')return;stopClock();const serial=++state.serial;state.game=['photos','kinship','missing','trivia','chick'].includes(game)?game:'photos';state.phase='loading';state.error='';render();
  try{let data;if(isChick())data={questions:makeChickQuiz()};else{const response=await I.fetch(isKinship()?'api/games/relationships':isMissing()?'api/games/who-is-missing':isTrivia()?'api/games/trivia?lang='+encodeURIComponent(I.language||'he'):'api/games/who-is-it',{cache:'no-store'});data=await response.json();if(!response.ok)throw Error(I.error(data.error));}if(serial!==state.serial)return;
    if(data.questions?.length!==10&&isTextGame())throw Error(tr('לא נמצאו מספיק שאלות כרגע. נסו שוב.','There are not enough questions available right now. Please try again.'));
    if(isMissing()&&!data.questions?.length)throw Error(tr('למשחק הזה צריך תמונות עם לפחות חמישה מתויגים. הוסיפו תיוגים בגלריה ונסו שוב.','This game needs photos with at least five tagged people. Add tags in the gallery and try again.'));
    if(!isMissing()&&!isChick()&&data.questions?.length!==10)throw Error(tr('כדי להתחיל צריך 10 תמונות מתאימות עם תיוגים בגלריה. כרגע זמינות למשחק ','The game needs 10 suitable tagged gallery photos. Currently available: ')+(data.available||0)+'.');
    Object.assign(state,{phase:'playing',questions:data.questions,index:0,answers:[],imageReady:false,deadline:null,zoom:1,cursor:{x:.5,y:.5},mistakes:0,autoNextAt:null});render();scrollToRound();
  }catch(error){if(serial===state.serial){state.phase=isTrivia()?'trivia-home':'welcome';state.error=error.message;render();}}
}
function activate(view){
  if(view!=='games')pauseRutiHouse();
  if(view!=='games')pauseNetoTetris();
  if(view!=='games')pauseNorth();
  if(view!=='games')pauseSoup();
  if(view!=='games')pauseRex();
  if(view!=='games')pauseJachnun();
  stopClock();state.view=view;$('gamesView').hidden=view!=='games';if(view!=='games')pausePuzzle();if(window.FamilyDifferences?.activate(view))return;if(view!=='games')return;
  if(initialRutiLink){initialRutiLink=false;start('ruti-house');return;}
  if(initialNetoLink){initialNetoLink=false;start('neto-tetris');return;}
  if(initialSoupLink){initialSoupLink=false;start('soup');return;}
  if(initialNorthLink){initialNorthLink=false;start('north');return;}
  if(state.phase==='playing'&&state.deadline&&Date.now()>=state.deadline){if(isChick())finishChick(false);else finishRound(null);return;}render();
}
function init(){
  $('familyGamesContent').addEventListener('click',event=>{
    const startButton=event.target.closest('[data-game-start]');if(startButton){if(startButton.dataset?.gameHome==='trivia')openTrivia();else start(startButton.dataset?.gameStart||state.game||'photos');return;}
    const dance=event.target.closest('[data-shlomo-dance]');if(dance){const stage=dance.closest('.game-lobby-welcome'),running=stage.dataset.dancing!=='true';stage.dataset.dancing=String(running);dance.setAttribute('aria-pressed',String(running));dance.textContent=running?tr('עצירת הריקוד','Pause dance'):tr('ממשיכים לרקוד','Resume dance');return;}
    if(event.target.closest('[data-game-lobby]')){showLobby();return;}
    if(event.target.closest('[data-game-share-messenger]')){shareMessenger(event);return;}
    if(event.target.closest('[data-game-find-next]')){nextChick();return;}
    if(event.target.closest('[data-game-find-zoom]')&&isChick()&&['playing','revealed'].includes(state.phase)){state.zoom=state.zoom===1?2.25:1;const stage=$('chickSceneStage');stage.style.width=state.zoom*100+'%';const button=event.target.closest('[data-game-find-zoom]');button.textContent=state.zoom>1?tr('הקטנה −','Zoom out −'):tr('הגדלה +','Zoom in +');button.setAttribute('aria-pressed',String(state.zoom>1));return;}
    const stage=event.target.closest('[data-game-find-stage]');if(stage&&event.detail<2){const box=stage.getBoundingClientRect();findChick((event.clientX-box.left)/box.width,(event.clientY-box.top)/box.height);return;}
    const choice=event.target.closest('[data-game-option]');
    if(choice&&event.detail<2){finishRound(choice.dataset.gameOption,Number(choice.dataset.gameRound));return;}
    if(event.target.closest('[data-game-retry-image]')&&state.phase==='playing'){$('gameImageError').hidden=true;$('familyGamePhoto').src=state.questions[state.index].src+'?retry='+Date.now();}
  });
  $('familyGamesContent').addEventListener('submit',event=>{if(event.target.matches('[data-trivia-question-form]'))saveTriviaQuestion(event);});
  $('familyGamesContent').addEventListener('input',event=>{
    if(event.target.id==='triviaNewQuestion'){editor.question=event.target.value;editor.requestId=null;if(!editor.languageChosen){const he=(editor.question.match(/[\u05d0-\u05ea]/g)||[]).length,en=(editor.question.match(/[a-z]/gi)||[]).length;if(he||en){editor.language=he>=en?'he':'en';$('triviaQuestionLanguage').value=editor.language;$('triviaLanguageHint').textContent=triviaLanguageHint();}}}
    const answer=/^triviaAnswer([0-3])$/.exec(event.target.id||'');if(answer){editor.options[Number(answer[1])]=event.target.value;editor.requestId=null;}
  });
  $('familyGamesContent').addEventListener('change',event=>{if(event.target.id==='triviaQuestionLanguage'){editor.language=event.target.value;editor.languageChosen=true;editor.requestId=null;$('triviaLanguageHint').textContent=triviaLanguageHint();}if(event.target.dataset?.triviaCorrect!==undefined){editor.correctIndex=Number(event.target.dataset.triviaCorrect);editor.requestId=null;}});
  $('familyGamesContent').addEventListener('keydown',event=>{
    if(!event.target.closest('[data-game-find-stage]')||!isChick()||state.phase!=='playing')return;
    if(['Enter',' '].includes(event.key)){event.preventDefault();findChick(state.cursor.x,state.cursor.y);return;}
    const direction={ArrowLeft:[-.02,0],ArrowRight:[.02,0],ArrowUp:[0,-.03],ArrowDown:[0,.03]}[event.key];if(!direction)return;event.preventDefault();state.cursor={x:Math.max(0,Math.min(1,state.cursor.x+direction[0])),y:Math.max(0,Math.min(1,state.cursor.y+direction[1]))};const marker=$('chickProbe');marker.hidden=false;marker.style.left=state.cursor.x*100+'%';marker.style.top=state.cursor.y*100+'%';marker.scrollIntoView({block:'nearest',inline:'nearest'});
  });
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'){stopClock();return;}if(state.view!=='games')return;if(state.phase==='revealed'){scheduleChickAdvance();return;}if(state.phase!=='playing')return;if(state.deadline&&Date.now()>=state.deadline){if(isChick())finishChick(false);else finishRound(null);}else startClock();});
  activate(window.FamilyApp.getView());
}
function showLobby(){stopClock();window.FamilyDifferences?.close();state.serial++;Object.assign(state,{phase:'welcome',game:null,questions:[],answers:[],deadline:null,imageReady:false,error:'',mistakes:0,autoNextAt:null});render();}
window.FamilyGames={activate,showLobby};document.addEventListener('DOMContentLoaded',init);
