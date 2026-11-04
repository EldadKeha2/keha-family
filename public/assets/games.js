import {quizGrade} from './quiz.mjs';
import {makeChickQuiz,withinChickTarget} from './chick.mjs';

const I=window.FamilyI18n,$=id=>document.getElementById(id),tr=(he,en)=>I.isEnglish?en:he;
const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ROUND_SECONDS=15;
const state={view:'tree',phase:'welcome',game:null,questions:[],index:0,answers:[],imageReady:false,deadline:null,error:'',serial:0,renderToken:0,zoom:1,cursor:{x:.5,y:.5},lastRemaining:60};
let clock=null,nextPhoto=null,preloaded='';
const editor={language:I.isEnglish?'en':'he',languageChosen:false,question:'',options:['','','',''],correctIndex:null,requestId:null,saving:false,status:'',error:''};
const name=person=>I.personName(person);
function stopClock(){if(clock!==null)clearInterval(clock);clock=null;}
const isKinship=()=>state.game==='kinship';
const isMissing=()=>state.game==='missing';
const isTrivia=()=>state.game==='trivia';
const isChick=()=>state.game==='chick';
const isTextGame=()=>isKinship()||isTrivia();
const total=()=>state.questions.length;
const roundSeconds=()=>isChick()?60:ROUND_SECONDS;
const gameTitle=()=>isChick()?tr('איפה הגוזל?','Where’s the little bird?'):isKinship()?tr('מה הקשר?','What’s the relation?'):isMissing()?tr('מי חסר?','Who’s missing?'):isTrivia()?tr('טריוויה משפחתית','Family Trivia'):tr('מי זה?','Who is it?');
const photoPrompt=()=>isMissing()?tr('מי חסר?','Who’s missing?'):tr('מי מופיע בתמונה?','Who appears in this photo?');
function welcome(){
  const games=[['photos','photos',tr('מי זה?','Who is it?'),tr('מזהים את הפנים בתמונות מהגלריה המשפחתית.','Recognize the faces in photos from the Family Gallery.')],['kinship','tree',tr('מה הקשר?','What’s the relation?'),tr('מחברים בין בני המשפחה, מקשרים קרובים ועד נכד של דודה.','Connect the family, from close relatives to an aunt’s grandson.')],['missing','directory',tr('מי חסר?','Who’s missing?'),tr('תמונה, ארבעה שמות — מי מהם לא מופיע בה?','One photo, four names — which person is not in it?')],['trivia','calendar',tr('טריוויה משפחתית','Family Trivia'),tr('ימי הולדת, סדר הלידה ושנות עלייה — כמה אתם זוכרים?','Birthdays, birth order and immigration years — how much do you remember?')],['chick','games',tr('איפה הגוזל?','Where’s the little bird?'),tr('מצאו את הקריקטורה המשפחתית באיור עמוס. דקה לחיפוש ומשוב מיד כשמוצאים!','Find the family caricature in a busy illustration. One minute to search and instant feedback!')]];
  return `<header class="family-game-intro"><span class="game-medallion" aria-hidden="true">❖</span><span class="small-eyebrow">${tr('המשפחה שלנו, מזווית קצת אחרת','Our family, from a different angle')}</span><h3>${tr('במה משחקים היום?','What shall we play?')}</h3><p>${tr('מזהים פנים או מפענחים קשרים? בחרו את האתגר שלכם.','Recognize faces or untangle family ties? Choose your challenge.')}</p></header><div class="family-game-choices">${games.map(([id,icon,title,description])=>`<button type="button" class="family-game-choice game-choice-${id}" data-game-start="${id}" ${id==='trivia'?'data-game-home="trivia"':''} ${state.phase==='loading'?'disabled':''}><span class="game-choice-icon" aria-hidden="true"><svg viewBox="0 0 48 48"><use href="assets/home-icons.svg#${icon}"></use></svg></span><span><strong>${title}</strong><span>${description}</span><b>${state.phase==='loading'&&state.game===id?tr('מכין את האתגר…','Preparing your challenge…'):tr('בואו נשחק','Let’s play')} ${I.isEnglish?'→':'←'}</b></span></button>`).join('')}</div><div class="game-welcome game-lobby-rules"><div class="game-rules"><span><b>${tr('עד 10','Up to 10')}</b>${tr('שאלות בכל סיבוב','questions per round')}</span><span><b>4</b>${tr('אפשרויות במשחקי הבחירה','choices in the quiz games')}</span><span><b>15</b>${tr('שניות לכל שאלה','seconds per question')}</span></div><p>${tr('בוחרים תשובה וממשיכים מיד לשאלה הבאה. הציון והמשוב מחכים לכם בסוף! ב״איפה הגוזל?״ מקבלים משוב מיד.','Choose an answer and move straight to the next question. Your score and feedback await at the end! In ‘Where’s the little bird?’ you get instant feedback.')}</p>${state.error?`<p class="game-error" role="alert">${safe(state.error)}</p>`:''}</div>`;
}
function openTrivia(){stopClock();state.serial++;Object.assign(state,{game:'trivia',phase:'trivia-home',questions:[],answers:[],deadline:null,error:''});render();}
function triviaHome(){
  const disabled=editor.saving?'disabled':'';
  return `<button type="button" class="game-lobby-button" data-game-lobby>${I.isEnglish?'←':'→'} ${tr('בחירת משחק','Choose a game')}</button><header class="family-game-intro"><span class="game-medallion" aria-hidden="true">❖</span><h3>${tr('טריוויה משפחתית','Family Trivia')}</h3><p>${tr('ימי הולדת, סדר הלידה, שנות עלייה והשאלות שלכם.','Birthdays, birth order, immigration years and your own questions.')}</p></header><div class="game-welcome"><p>${tr('10 שאלות אקראיות, 15 שניות לשאלה. התשובות והמשוב מחכים בסוף.','10 random questions, 15 seconds per question. Answers and feedback appear at the end.')}</p><button type="button" class="primary-button" data-game-start="trivia">${tr('מתחילים לשחק','Let’s play')}</button>${state.error?`<p class="game-error" role="alert">${safe(state.error)}</p>`:''}</div><section class="trivia-builder"><header><h4>${tr('מוסיפים שאלה משלנו','Add a family question')}</h4><p>${tr('כתבו שאלה וארבע תשובות, וסמנו את התשובה הנכונה. היא תצטרף למאגר המשותף ותוכל להופיע במשחקים הבאים.','Write a question and four choices, and mark the correct answer. It will join the shared bank for future games.')}</p></header><form data-trivia-question-form><label for="triviaQuestionLanguage">${tr('שפת השאלה','Question language')}</label><select id="triviaQuestionLanguage" ${disabled}><option value="he" ${editor.language==='he'?'selected':''}>עברית</option><option value="en" ${editor.language==='en'?'selected':''}>English</option></select><small id="triviaLanguageHint">${triviaLanguageHint()}</small><label for="triviaNewQuestion">${tr('השאלה שלכם','Your question')}</label><textarea id="triviaNewQuestion" dir="auto" rows="3" minlength="5" maxlength="500" required ${disabled}>${safe(editor.question)}</textarea><fieldset ${disabled}><legend>${tr('ארבע התשובות — סמנו את הנכונה','Four choices — mark the correct one')}</legend>${editor.options.map((value,index)=>`<div class="trivia-builder-option"><label class="trivia-correct-choice"><input type="radio" name="triviaCorrect" data-trivia-correct="${index}" value="${index}" ${editor.correctIndex===index?'checked':''} required><span class="visually-hidden">${tr('תשובה ','Answer ')}${index+1}${tr(' היא הנכונה',' is correct')}</span></label><label class="visually-hidden" for="triviaAnswer${index}">${tr('תשובה ','Answer ')}${index+1}</label><input type="text" dir="auto" id="triviaAnswer${index}" value="${safe(value)}" maxlength="160" required placeholder="${tr('תשובה ','Answer ')}${index+1}"></div>`).join('')}</fieldset><p class="game-error" role="alert">${safe(editor.error)}</p><p class="trivia-builder-status" role="status">${safe(editor.status)}</p><button type="submit" class="primary-button" ${disabled}>${editor.saving?tr('מוסיפים למאגר…','Adding to the bank…'):tr('הוספת השאלה למאגר','Add question to the bank')}</button></form></section>`;
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
  const t=q.target,left=(t.x-t.w/2)*q.width,top=(t.y-t.h/2)*q.height;
  return `<svg class="chick-clue" viewBox="${left} ${top} ${t.w*q.width} ${t.h*q.height}" role="img" aria-label="${tr('הקריקטורה שצריך למצוא','The caricature to find')}"><image href="${safe(q.src)}" width="${q.width}" height="${q.height}"/></svg>`;
}
function chickRing(q){const t=q.target;return `<span class="chick-reveal-ring" aria-hidden="true" style="left:${(t.x-t.w/2)*100}%;top:${(t.y-t.h/2)*100}%;width:${t.w*100}%;height:${t.h*100}%"></span>`;}
function chickQuestion(q){
  const revealed=state.phase==='revealed',found=state.answers[state.index]?.correct;
  return `<h3 class="game-question-title" tabindex="-1">${tr('איפה הגוזל? מצאו את ','Where’s the little bird? Find ')}${safe(name(q.subject))}</h3><div class="chick-hunt-guide">${chickClue(q)}<div><strong>${safe(name(q.subject))}</strong><p>${tr('לחצו על הקריקטורה באיור. אפשר להגדיל ולגלול כדי לחפש.','Tap the caricature in the illustration. You can zoom in and scroll to search.')}</p></div><button type="button" class="secondary-button chick-zoom" data-game-find-zoom aria-pressed="${state.zoom>1}">${state.zoom>1?tr('הקטנה −','Zoom out −'):tr('הגדלה +','Zoom in +')}</button></div><p class="visually-hidden" id="chickKeyboardHint">${tr('במקלדת: הזיזו את הסמן בחיצים ולחצו Enter כדי לבחור.','Keyboard: move the marker with the arrow keys, then press Enter to select.')}</p><div class="chick-scene-scroll" id="chickSceneScroll" dir="ltr"><div class="chick-scene-stage" id="chickSceneStage" data-game-find-stage style="width:${state.zoom*100}%" tabindex="${revealed?'-1':'0'}" role="button" aria-label="${safe(tr('מצאו את ','Find ')+name(q.subject))}" aria-describedby="chickKeyboardHint"><img id="familyGamePhoto" src="${safe(q.src)}" width="${q.width}" height="${q.height}" alt="${safe(tr(q.title,q.titleEn))}" decoding="async" draggable="false"><span class="chick-probe" id="chickProbe" aria-hidden="true" hidden></span>${revealed?chickRing(q):''}</div></div><p class="game-image-error" id="gameImageError" role="alert" hidden>${tr('האיור לא נטען.','The illustration could not load.')} <button type="button" data-game-retry-image>${tr('טעינה מחדש','Try again')}</button></p><div class="chick-feedback${revealed&&found?' chick-found':''}" id="chickFeedback" role="status" tabindex="-1">${revealed?`${chickClue(q)}<strong>${found?tr('יפה מאוד, מצאת את ','Well done, you found '):tr('הזמן נגמר! הנה ','Time’s up! Here is ')}${safe(name(q.subject))}${found?'!':' — '+tr('מסומן באיור.','marked in the illustration.')}</strong><button type="button" class="primary-button" data-game-find-next>${state.index===total()-1?tr('לתוצאות','See results'):tr('לאיור הבא','Next illustration')}</button>`:''}</div>`;
}
function finishChick(found,round=state.index){
  if(!isChick()||state.phase!=='playing'||state.view!=='games'||round!==state.index||!state.deadline)return;
  const expired=Date.now()>=state.deadline;if(!state.imageReady||!found&&!expired)return;
  found=Boolean(found&&!expired);const q=state.questions[state.index],scroll=$('chickSceneScroll'),position={left:scroll?.scrollLeft||0,top:scroll?.scrollTop||0};
  stopClock();state.lastRemaining=Math.max(0,Math.ceil((state.deadline-Date.now())/1000));state.answers.push({id:q.id,correct:found,timedOut:!found,selectedId:found?q.subject.id:null});state.phase='revealed';state.deadline=null;state.imageReady=false;render();
  const viewport=$('chickSceneScroll');if(viewport){viewport.scrollLeft=position.left;viewport.scrollTop=position.top;}
  $('familyGamesContent').querySelector('.chick-reveal-ring')?.scrollIntoView({block:'nearest',inline:'nearest'});$('chickFeedback')?.scrollIntoView({block:'nearest'});$('chickFeedback')?.focus({preventScroll:true});
}
function findChick(x,y){
  if(!isChick()||state.phase!=='playing'||!state.imageReady)return;
  if(withinChickTarget(state.questions[state.index].target,x,y)){finishChick(true);return;}
  if(state.deadline&&Date.now()>=state.deadline){finishChick(false);return;}
  const marker=$('chickProbe');if(marker){marker.hidden=false;marker.style.left=x*100+'%';marker.style.top=y*100+'%';}
  $('chickFeedback').textContent=tr('עוד לא… נסו שוב, השעון ממשיך!','Not yet… try again, the clock is still running!');
}
function scrollToRound(){$('familyGamesContent').querySelector('.game-question-top')?.scrollIntoView({block:'start'});}
function nextChick(){
  if(!isChick()||state.phase!=='revealed')return;
  if(state.index===total()-1)state.phase='finished';else{state.index++;state.phase='playing';state.zoom=1;state.cursor={x:.5,y:.5};}
  render();if(state.phase==='playing')scrollToRound();$('familyGamesContent').querySelector(state.phase==='finished'?'[data-game-result]':'.game-question-title')?.focus({preventScroll:true});
}
function review(){
  return `<details class="kinship-review game-review"><summary>${tr('השאלות והתשובות הנכונות','Review questions and correct answers')}</summary><ol>${state.questions.map((q,index)=>{
    const answer=q.options.find(option=>option.id===q.correctId),record=state.answers[index],selected=q.options.find(option=>option.id===record.selectedId);
    const prompt=isChick()?tr('איפה מתחבא/ת ','Where is ')+name(q.subject)+(I.isEnglish?' hiding?':'?'):isTrivia()?tr(q.prompt,q.promptEn):isKinship()?(I.isEnglish?`How is ${name(q.subject)} related to ${name(q.reference)}?`:`מה הקשר של ${name(q.subject)} ל${name(q.reference)}?`):photoPrompt();
    const sentence=isKinship()?(I.isEnglish?`${name(q.subject)} is ${name(q.reference)}’s ${answer.nameEn.toLowerCase()}.`:`${name(q.subject)} ${q.subject.gender==='f'?'היא':'הוא'} ${answer.name} של ${name(q.reference)}.`):tr('התשובה הנכונה: ','Correct answer: ')+name(answer);
    return `<li data-game-review-question="${index+1}"><span class="kinship-review-mark" aria-hidden="true">${record.correct?'✓':'·'}</span><div class="game-review-question"><strong>${index+1}. ${safe(prompt)}</strong>${isTextGame()&&q.subject?`<div class="game-review-people">${portrait(q.subject)}${isKinship()?portrait(q.reference):''}</div>`:q.src?`<div class="game-review-scene${isChick()?' chick-review-scene':''}"><img class="game-review-photo" src="${safe(q.src)}" alt="${tr('התמונה משאלה','Photo from question')} ${index+1}" loading="lazy" decoding="async">${isChick()?chickRing(q):''}</div>`:''}<p>${safe(sentence)}</p><small>${record.timedOut?tr('הזמן הסתיים ללא תשובה','Time ran out without an answer'):tr('בחרתם: ','Your answer: ')+safe(name(selected))}${record.correct?' '+tr('— נכון!','— correct!'):''}</small></div></li>`;
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
  const top=`<button type="button" class="game-lobby-button" data-game-lobby>${I.isEnglish?'←':'→'} ${tr('בחירת משחק','Choose a game')}</button><div class="game-question-top"><span class="game-round">${isChick()?tr('איור','Illustration'):isTextGame()?tr('שאלה','Question'):tr('תמונה','Photo')} <bdi>${state.index+1} / ${total()}</bdi></span>${timer()}</div><progress class="game-progress" max="${total()}" value="${state.index+1}" aria-label="${tr('התקדמות במשחק','Game progress')}"></progress>`;
  if(isChick())return top+chickQuestion(q);
  if(isKinship())return top+kinshipQuestion(q);
  if(isTrivia())return `${top}<h3 class="game-question-title trivia-question-title" tabindex="-1">${safe(tr(q.prompt,q.promptEn))}</h3>${q.subject?`<div class="trivia-person">${portrait(q.subject)}</div>`:'<span class="trivia-custom-ornament" aria-hidden="true">❖</span>'}${optionsHTML(q)}`;
  return `${top}<h3 class="game-question-title" tabindex="-1" aria-label="${label}">${photoPrompt()}</h3>${isMissing()?`<p class="game-question-hint">${tr('שלושה מהשמות מופיעים בתמונה. בחרו את מי שחסר.','Three of these people are in the photo. Choose who is missing.')}</p>`:''}<div class="game-photo"><img id="familyGamePhoto" src="${safe(q.src)}" alt="${tr('תמונה משפחתית לשאלה','Family photo for question')} ${state.index+1}" decoding="async"></div><p class="game-image-error" id="gameImageError" role="alert" hidden>${tr('התמונה לא נטענה.','The photo could not load.')} <button type="button" data-game-retry-image>${tr('טעינה מחדש','Try again')}</button></p>${optionsHTML(q)}`;
}
function result(){
  const grade=quizGrade(state.answers.filter(a=>a.correct).length,total()),timeouts=state.answers.filter(a=>a.timedOut).length;
  const messages=isChick()?{expert:[tr('עיני נץ משפחתיות!','The family’s eagle eyes!'),tr('בין כל הפרטים הקטנים, הגוזלים לא הצליחו להתחבא מכם.','Among all those tiny details, the little birds could not hide from you.')],familiar:[tr('יש לכם עין חדה!','You have a sharp eye!'),tr('כבר מצאתם לא מעט. עוד סיבוב ותגלו את כל הגוזלים.','You found quite a few. Another round and you will spot every little bird.')],reunion:[tr('הגוזלים הצליחו להתחבא הפעם 😉','The little birds hid well this time 😉'),tr('קחו עוד מבט — המשפחה מחכה שתמצאו אותה בין כל הפרטים.','Take another look — the family is waiting among all those little details.')]}:isKinship()?{expert:[tr('מומחי הקשרים במשפחה!','Family connections experts!'),tr('גם נכד של דודה לא מבלבל אתכם. אתם יודעים לחבר את כל הענפים.','Even an aunt’s grandson cannot confuse you. You can connect every branch.')],familiar:[tr('כבר מחברים את הענפים!','You’re connecting the branches!'),tr('יש לכם חוש משפחתי טוב. עוד סיבוב בעץ, ותפענחו גם את הקשרים המפתיעים.','You have a good family instinct. Another visit to the tree will help with the surprising connections too.')],reunion:[tr('זמן לעוד מפגש משפחתי 😉','Time for another family gathering 😉'),tr('עוד כמה שיחות סביב השולחן, ופתאום כולם יתחברו לכם.','A few more conversations around the table and the connections will fall into place.')]}:isTrivia()?{expert:[tr('אוצרי הידע המשפחתי!','Keepers of the family knowledge!'),tr('שנים, חודשים וסיפורים — אתם זוכרים את הפרטים הקטנים של המשפחה.','Years, months and stories — you remember all the little family details.')],familiar:[tr('יש לכם זיכרון משפחתי טוב!','You have a good family memory!'),tr('עוד כמה סיפורים סביב השולחן ואתם בדרך לציון מושלם.','A few more stories around the table will put you on the path to a perfect score.')],reunion:[tr('זמן לעוד מפגש משפחתי 😉','Time for another family gathering 😉'),tr('זו הזדמנות לשמוע שוב את הסיפורים ולשאול את המשפחה על הפרטים.','A perfect chance to hear the stories again and ask the family about the details.')]}:isMissing()?{expert:[tr('בלשים משפחתיים מצטיינים!','Outstanding family detectives!'),tr('שום פרט לא נעלם מכם — גם כשצריך לזהות מי חסר.','You never miss a detail — even when it is someone who is missing.')],familiar:[tr('יש לכם עין משפחתית טובה!','You have a good eye for the family!'),tr('כבר שמים לב לפרטים. עוד סיבוב ותמצאו את כל מי שחסר.','You are spotting the details. Another round and you will find everyone who is missing.')],reunion:[tr('מחכים לכם במפגש המשפחתי הבא 😉','See you at the next family gathering 😉'),tr('עוד כמה מפגשים משפחתיים ותזהו מיד מי לא נכנס לפריים.','A few more family gatherings and you will know who did not make it into the frame.')]}:{expert:[tr('אנציקלופדיה משפחתית!','A family encyclopedia!'),tr('אין פנים שלא תזהו. אפשר למנות אתכם לאחראי התיוגים במשפחה.','No face escapes you. You could be the family’s official photo tagger.')],familiar:[tr('מכירים לא מעט!','You know the family!'),tr('עוד כמה אלבומים ומפגש משפחתי אחד, ואתם בדרך לציון מושלם.','A few more albums and one family gathering will put you on the path to a perfect score.')],reunion:[tr('מחכים לכם במפגש המשפחתי הבא 😉','See you at the next family gathering 😉'),tr('נראה שהגיע הזמן להגיע ליותר אירועים משפחתיים… בינתיים, סיבוב בגלריה יעשה פלאים!','It may be time to come to more family events… A stroll through the gallery will help in the meantime!')]},[title,message]=messages[grade.level];
  return `<div class="game-result" data-game-result tabindex="-1"><span class="game-medallion" aria-hidden="true">${grade.level==='expert'?'✦':grade.level==='familiar'?'❖':'♡'}</span><p class="small-eyebrow">${tr('הציון המשפחתי שלכם','Your family score')}</p><div class="game-score"><strong>${grade.score}</strong><span>/ 100</span></div><p>${grade.correct} ${grade.correct===1?tr('תשובה נכונה מתוך ','correct answer out of '):tr('תשובות נכונות מתוך ','correct answers out of ')}${total()}</p>${timeouts?`<p class="game-timeouts">${timeouts===1?(isTextGame()?tr('שאלה אחת הסתיימה ללא תשובה בזמן','One question timed out without an answer'):tr('תמונה אחת הסתיימה ללא תשובה בזמן','One photo timed out without an answer')):timeouts+' '+(isTextGame()?tr('שאלות הסתיימו ללא תשובה בזמן','questions timed out without an answer'):tr('תמונות הסתיימו ללא תשובה בזמן','photos timed out without an answer'))}</p>`:''}<h3>${title}</h3><p>${message}</p><div class="game-result-actions"><button type="button" class="primary-button" data-game-start="${state.game}">${isChick()?tr('עוד סיבוב של חיפושים','Search again'):isKinship()?tr('עוד סיבוב עם קשרים חדשים','Play again with new connections'):isTrivia()?tr('עוד סיבוב עם שאלות חדשות','Play again with new questions'):tr('עוד סיבוב עם תמונות חדשות','Play again with new photos')}</button><button type="button" class="secondary-button" data-game-lobby>${tr('בחירת משחק','Choose a game')}</button><button type="button" class="secondary-button" data-view="gallery">${tr('לאלבום המשפחתי','Visit the Family Gallery')}</button></div>${resultSharing()}${review()}</div>`;
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
  const token=++state.renderToken,index=state.index;
  $('familyGamesContent').innerHTML=(state.phase==='playing'||state.phase==='revealed')?question():state.phase==='finished'?result():state.phase==='trivia-home'?triviaHome():welcome();
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
  if(state.phase==='loading')return;stopClock();const serial=++state.serial;state.game=['photos','kinship','missing','trivia','chick'].includes(game)?game:'photos';state.phase='loading';state.error='';render();
  try{let data;if(isChick())data={questions:makeChickQuiz()};else{const response=await I.fetch(isKinship()?'api/games/relationships':isMissing()?'api/games/who-is-missing':isTrivia()?'api/games/trivia?lang='+encodeURIComponent(I.language||'he'):'api/games/who-is-it',{cache:'no-store'});data=await response.json();if(!response.ok)throw Error(I.error(data.error));}if(serial!==state.serial)return;
    if(data.questions?.length!==10&&isTextGame())throw Error(tr('לא נמצאו מספיק שאלות כרגע. נסו שוב.','There are not enough questions available right now. Please try again.'));
    if(isMissing()&&!data.questions?.length)throw Error(tr('למשחק הזה צריך תמונות עם לפחות חמישה מתויגים. הוסיפו תיוגים בגלריה ונסו שוב.','This game needs photos with at least five tagged people. Add tags in the gallery and try again.'));
    if(!isMissing()&&!isChick()&&data.questions?.length!==10)throw Error(tr('כדי להתחיל צריך 10 תמונות מתאימות עם תיוגים בגלריה. כרגע זמינות למשחק ','The game needs 10 suitable tagged gallery photos. Currently available: ')+(data.available||0)+'.');
    Object.assign(state,{phase:'playing',questions:data.questions,index:0,answers:[],imageReady:false,deadline:null,zoom:1,cursor:{x:.5,y:.5}});render();scrollToRound();
  }catch(error){if(serial===state.serial){state.phase=isTrivia()?'trivia-home':'welcome';state.error=error.message;render();}}
}
function activate(view){
  stopClock();state.view=view;$('gamesView').hidden=view!=='games';if(view!=='games')return;
  if(state.phase==='playing'&&state.deadline&&Date.now()>=state.deadline){if(isChick())finishChick(false);else finishRound(null);return;}render();
}
function init(){
  $('familyGamesContent').addEventListener('click',event=>{
    const startButton=event.target.closest('[data-game-start]');if(startButton){if(startButton.dataset?.gameHome==='trivia')openTrivia();else start(startButton.dataset?.gameStart||state.game||'photos');return;}
    if(event.target.closest('[data-game-lobby]')){stopClock();state.serial++;Object.assign(state,{phase:'welcome',game:null,questions:[],answers:[],deadline:null,imageReady:false,error:''});render();return;}
    if(event.target.closest('[data-game-share-messenger]')){shareMessenger(event);return;}
    if(event.target.closest('[data-game-find-next]')){nextChick();return;}
    if(event.target.closest('[data-game-find-zoom]')&&isChick()&&['playing','revealed'].includes(state.phase)){state.zoom=state.zoom===1?2.25:1;const stage=$('chickSceneStage');stage.style.width=state.zoom*100+'%';const button=event.target.closest('[data-game-find-zoom]');button.textContent=state.zoom>1?tr('הקטנה −','Zoom out −'):tr('הגדלה +','Zoom in +');button.setAttribute('aria-pressed',String(state.zoom>1));return;}
    const stage=event.target.closest('[data-game-find-stage]');if(stage){const box=stage.getBoundingClientRect();findChick((event.clientX-box.left)/box.width,(event.clientY-box.top)/box.height);return;}
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
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'){stopClock();return;}if(state.view!=='games'||state.phase!=='playing')return;if(state.deadline&&Date.now()>=state.deadline){if(isChick())finishChick(false);else finishRound(null);}else startClock();});
  activate(window.FamilyApp.getView());
}
window.FamilyGames={activate};document.addEventListener('DOMContentLoaded',init);
