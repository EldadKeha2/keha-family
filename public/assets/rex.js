import {FOODS,GROUND,WORLD_HEIGHT,PLAYER,RUNNER_LIVES,makeEncounter,createRunner,jumpRunner,advanceRunner} from './rex.mjs?v=4';
import {DEFAULT_CHARACTER,headCrop,snakeCharacters} from './jachnun.mjs?v=2';
import {PREPARED_HEADS} from './jachnun-heads.mjs?v=1';

const I=window.FamilyI18n,tr=(he,en)=>I.isEnglish?en:he;
const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const title=()=>tr('תימנירקס','Yemeanite Rex');
const state={phase:'setup',selected:DEFAULT_CHARACTER,query:'',game:null,people:[],imageError:'',loading:false,ready:false,demo:null};
const scores={rows:[],loaded:false,loading:false,error:'',serial:0};
const images=new Map();
const runId=()=>crypto.randomUUID?crypto.randomUUID().replaceAll('-',''):[...crypto.getRandomValues(new Uint8Array(16))].map(byte=>byte.toString(16).padStart(2,'0')).join('');
let host=null,back=null,events=null,frame=null,lastFrame=0,head=null,imageSerial=0,run=null,floats=[];
const $=selector=>host?.querySelector(selector);
const selected=()=>state.people.find(p=>p.id===state.selected);
const name=person=>person?.id===DEFAULT_CHARACTER?tr('סבתא יונה','Grandma Yona'):I.personName(person||{});
const foodName=food=>I.isEnglish?food.en:food.he;
const worldWidth=()=>host&&host.clientWidth<700?620:960;

function stop(){if(frame!==null)cancelAnimationFrame(frame);frame=null;lastFrame=0;}
// Keep the run and accumulated points when leaving the game.
export function pauseRex(){stop();events?.abort();events=null;host?.classList.remove('has-family-rex');host=null;}
export function mountRex(root,onBack){
  pauseRex();host=root;back=onBack;state.demo=makeEncounter({pattern:'mixed'});host.classList.add('has-family-rex');events=new AbortController();
  const on=(node,type,fn,options={})=>node.addEventListener(type,fn,{...options,signal:events.signal});
  state.people=snakeCharacters(window.FAMILY_DATA?.people||{},PREPARED_HEADS);
  state.people.sort((a,b)=>a.id===DEFAULT_CHARACTER?-1:b.id===DEFAULT_CHARACTER?1:name(a).localeCompare(name(b),I.locale));
  on(host,'click',click);on(host,'input',input);on(host,'change',change);
  on(host,'submit',event=>{if(event.target.matches('[data-rex-score-form]'))saveScore(event);});
  on(host,'pointerdown',event=>{if(event.target.closest('[data-rex-board],[data-rex-jump]')&&state.phase==='playing'&&event.isPrimary!==false&&event.button<=0){event.preventDefault();jump();}},{passive:false});
  on(document,'keydown',event=>{
    if(state.phase!=='playing'||event.target.closest?.('input,textarea,select,button,a')||!['Space','ArrowUp','KeyW'].includes(event.code)&&![' ','ArrowUp','w','W'].includes(event.key))return;
    event.preventDefault();if(!event.repeat)jump();
  });
  on(document,'visibilitychange',()=>{if(document.visibilityState==='hidden'){stop();}else if(host&&state.phase==='playing'){lastFrame=0;animate();}});
  render();
  loadHead();if(!scores.loaded&&!scores.loading)loadScores();
  $('.rex-heading')?.scrollIntoView({block:'start'});if(state.phase==='playing')animate();
}
function portrait(){return '<canvas class="rex-portrait" data-rex-head width="160" height="160" aria-hidden="true"></canvas>';}
function foodIcons(){for(const canvas of host?.querySelectorAll('[data-rex-food]')||[]){const ctx=canvas.getContext('2d');ctx.clearRect(0,0,80,66);drawFood(ctx,canvas.dataset.rexFood,40,34,1.15);}}
function lifeHeads(lives){return `<span class="rex-life-heads" aria-hidden="true">${Array.from({length:RUNNER_LIVES},(_,i)=>`<span class="rex-life" data-rex-life="${i}" data-lost="${i>=lives}">${portrait()}</span>`).join('')}</span>`;}
function pointsCards(){return `<div class="rex-menu" aria-label="${tr('הניקוד לכל מאכל','Points for each food')}">${FOODS.map(food=>`<div class="rex-menu-item"><canvas width="80" height="66" data-rex-food="${food.id}" aria-hidden="true"></canvas><strong>${foodName(food)}</strong><span><b>${food.points}</b> ${food.points===1?tr('נקודה','point'):tr('נקודות','points')}</span></div>`).join('')}</div>`;}
function options(){const query=state.query.trim().toLocaleLowerCase();return state.people.filter(p=>p.id===state.selected||[name(p),p.name,p.nameEn].join(' ').toLocaleLowerCase().includes(query)).map(p=>`<option value="${safe(p.id)}" ${p.id===state.selected?'selected':''}>${safe(name(p))}</option>`).join('');}
function setup(){return `<header class="rex-heading" tabindex="-1"><span class="small-eyebrow">${tr('בלי הגבלת זמן. הרבה גת. עוד ביס אחד.','No time limit. Plenty of khat. One more bite.')}</span><h3>${title()}<span aria-hidden="true">✦</span></h3><p>${tr('הדינו המשפחתי: קופצים מעל צמחי גת, אוספים מטעמים תימניים ומנסים להגיע לראש הטבלה.','Our family Dino game: jump over khat plants, collect Yemeni treats, and race to the top of the leaderboard.')}</p></header><section class="rex-setup"><div class="rex-character"><span class="rex-character-ring">${portrait()}</span><strong data-rex-character-name>${safe(name(selected()))}</strong><small>${tr('ברירת המחדל: סבתא יונה','Default character: Grandma Yona')}</small><label for="rexSearch">${tr('מי יוצא לריצה?','Who’s going for a run?')}</label><input type="search" id="rexSearch" autocomplete="off" placeholder="${tr('חיפוש בן או בת משפחה','Search family members')}" value="${safe(state.query)}"><label class="visually-hidden" for="rexCharacter">${tr('בחירת דמות','Choose a character')}</label><select id="rexCharacter">${options()}</select><p class="game-error" role="alert" data-rex-image-status></p><button type="button" class="quiet-button" data-rex-retry hidden>${tr('טעינת הראש מחדש','Retry portrait')}</button></div><div class="rex-rules"><h4>${tr('מה אוספים וכמה זה שווה?','What’s on the menu?')}</h4>${pointsCards()}<ol><li>${tr('רצים בלי הגבלת זמן ואוספים כמה שיותר נקודות. ג׳חנון הוא הכי קטן — והכי משתלם!','Run without a time limit and collect as many points as possible. Jachnun is the smallest — and worth the most!')}</li><li><strong>${tr('שלוש פסילות — הניקוד והמאכלים נשמרים!','Three lives — keep every point and every bite!')}</strong> ${tr('נגעתם בגת? מאבדים פסילה אחת וממשיכים עם כל הניקוד והמאכלים שאספתם.','Touched the khat? Lose one life and keep running with every point and food you collected.')}</li><li>${tr('הסיבוב מסתיים רק בפסילה השלישית. הזינו שם ושמרו את הניקוד הסופי בטבלת השיאים.','The round ends only on your third crash. Enter your name and save your final score on the leaderboard.')}</li><li>${tr('שיחים בודדים, זוגות וקפיצות רצופות. האוכל מפוזר גם בין השיחים ובגבהים שונים — לפעמים כדאי לוותר על ביס כדי להציל פסילה.','Single bushes, pairs and consecutive jumps. Food also appears between bushes and at different heights — sometimes skipping a bite saves a life.')}</li></ol><p class="rex-controls-hint">${tr('במחשב: רווח, חץ למעלה או W. בטלפון: נגיעה בלוח או בכפתור קפיצה.','Computer: Space, ↑ or W. Phone: tap the board or the Jump button.')}</p><button class="primary-button rex-start" type="button" data-rex-start disabled>${tr('טוענים את הראש…','Loading portrait…')}</button></div></section><div class="rex-stage rex-demo" aria-hidden="true"><canvas data-rex-demo width="960" height="310"></canvas></div>${leaderboard()}`;}
function basketSummary(basket,compact=false){return `<div class="rex-basket${compact?' is-compact':''}">${FOODS.map(food=>`<span><canvas width="80" height="66" data-rex-food="${food.id}" aria-hidden="true"></canvas><span>${foodName(food)} <b data-rex-count="${food.id}">${basket[food.id]}</b>${compact?'':`<small> × ${food.points} = ${basket[food.id]*food.points}</small>`}</span></span>`).join('')}</div>`;}
function play(){const game=state.game;return `<header class="rex-heading rex-play-heading"><h3>${title()}</h3><span>${portrait()}${safe(name(selected()))}</span></header><div class="rex-hud"><div class="rex-score"><small>${tr('הניקוד שלכם','Your score')}</small><b data-rex-points>${game.score}</b></div><div class="rex-crashes"><small>${tr('פסילות נותרו','Lives left')}</small><b data-rex-lives>${game.lives}</b>${lifeHeads(game.lives)}</div></div><div class="rex-stage" style="aspect-ratio:${game.width}/${WORLD_HEIGHT}"><canvas data-rex-board width="${game.width}" height="${WORLD_HEIGHT}" tabindex="0" aria-label="${tr('לוח תימנירקס. רווח או חץ למעלה לקפיצה.','Yemeanite Rex game board. Press Space or Up to jump.')}" aria-describedby="rexPlayHint"></canvas><div class="rex-crash-note" data-rex-crash hidden><strong data-rex-crash-title>${tr('אופס, גת! ממשיכים לרוץ','Oops, khat! Keep running')}</strong><span>${tr('הניקוד נשמר · ממשיכים לרוץ','Score kept · Keep running')}</span></div></div>${basketSummary(game.basket,true)}<div class="rex-play-controls"><p id="rexPlayHint">${tr('רווח / ↑ / W לקפיצה · בטלפון נוגעים בלוח','Space / ↑ / W to jump · On a phone, tap the board')}<small>${tr('בלי הגבלת זמן. הסיבוב מסתיים רק בפסילה השלישית. כל הנקודות נשמרות.','No time limit. The round ends only on your third crash. Every point is kept.')}</small></p><button type="button" class="primary-button rex-jump" data-rex-jump>${tr('קפיצה!','Jump!')} <span aria-hidden="true">↑</span></button></div><p class="visually-hidden" data-rex-status role="status"></p>`;}
function result(){const game=state.game;return `<header class="rex-heading rex-finish" tabindex="-1"><span class="small-eyebrow">${tr('נגמרו הפסילות!','That was your third life!')}</span><h3>${title()}</h3><span class="rex-result-face">${portrait()}</span><p>${tr('רצתם עם ','You ran with ')}<strong>${safe(name(selected()))}</strong></p><div class="rex-final-points"><b>${game.score}</b> ${tr('נקודות','points')}</div><p>${tr('כל מה שאספתם לאורך הסיבוב — גם לפני הפסילות.','Everything collected throughout the round — including before each crash.')}</p></header>${basketSummary(game.basket)}<section class="rex-submit-panel"><div data-rex-score-entry>${scoreForm()}</div><div class="rex-result-actions"><button type="button" class="primary-button" data-rex-restart>${tr('עוד סיבוב!','Another run!')}</button><button type="button" class="secondary-button" data-rex-settings>${tr('בחירת דמות אחרת','Choose another character')}</button></div></section>${leaderboard()}`;}
function scoreForm(){
  if(!run)return '';
  if(run.saved)return `<p class="rex-saved" role="status">${tr('התוצאה של ','The score for ')}<strong>${safe(run.name)}</strong>${tr(' נשמרה! המקום שלכם: ',' is saved! Your rank: ')}<b>${run.rank}</b></p>`;
  return `<form data-rex-score-form><label for="rexScoreName">${tr('מי עומד מאחורי התיאבון? השם שלכם בטבלת השיאים','Who’s behind that appetite? Your name on the leaderboard')}</label><div class="rex-score-row"><input type="text" id="rexScoreName" name="name" dir="auto" autocomplete="name" required maxlength="60" value="${safe(run.name)}" ${run.busy?'disabled':''}><button type="submit" class="primary-button" ${run.busy?'disabled':''}>${run.busy?tr('שומרים…','Saving…'):tr('שמירת התוצאה וגילוי המוביל','Save score & reveal the leader')}</button></div><p class="game-error" role="alert">${safe(run.error)}</p></form>`;
}
function leader(){const top=scores.rows[0];if(!top)return '';const leaders=scores.rows.filter(row=>row.score===top.score);return `<div class="rex-winner" role="status"><span aria-hidden="true">♛</span><div><small>${leaders.length>1?tr('מובילים יחד בראש הטבלה','Sharing the lead'):tr('בראש הטבלה המשפחתית','Leading the family leaderboard')}</small><strong>${leaders.map(row=>safe(row.name)).join(' · ')}</strong><span>${top.score} ${tr('נקודות','points')}</span></div></div>`;}
function leaderboard(){return `<section class="rex-leaderboard" data-rex-leaderboard>${leaderboardInner()}</section>`;}
function leaderboardInner(){return `<div class="rex-leaderboard-heading"><h4>${tr('שיאי המשפחה · תימנירקס','Family records · Yemeanite Rex')}</h4><button type="button" class="quiet-button" data-rex-refresh ${scores.loading?'disabled':''}>${scores.loading?tr('טוענים…','Loading…'):tr('רענון','Refresh')}</button></div><p>${tr('התוצאות מכל המשפחה. בלי הגבלת זמן, עד הפסילה השלישית; כל המאכלים והנקודות נשמרים.','Scores from the whole family. No time limit, just three lives; every food and point counts.')}</p>${scores.error?`<p class="game-error" role="alert">${safe(scores.error)}</p>`:''}${leader()}${scores.rows.length?`<div class="rex-table-scroll"><table><thead><tr><th>${tr('מקום','Rank')}</th><th>${tr('שם','Name')}</th><th>${tr('נקודות','Points')}</th><th>${tr('הדמות','Character')}</th><th>${tr('בסל','Basket')}</th></tr></thead><tbody>${scores.rows.map((row,index)=>`<tr${run?.saved&&row.id===run.id?' class="is-yours"':''}><td>${index+1}</td><th scope="row" dir="auto">${safe(row.name)}</th><td><b>${row.score}</b></td><td>${safe(name(state.people.find(person=>person.id===row.headId)))}</td><td>${FOODS.filter(food=>row.basket?.[food.id]).map(food=>`${foodName(food)} × ${row.basket[food.id]}`).join(' · ')||'—'}</td></tr>`).join('')}</tbody></table></div>`:`<p>${scores.loading?tr('טוענים את שיאי המשפחה…','Loading family records…'):tr('הטבלה מחכה לשיא הראשון שלכם!','The first family record could be yours!')}</p>`}`;}
function render(){
  if(!host)return;
  host.innerHTML=`<section class="family-rex"><button type="button" class="game-lobby-button" data-rex-back>${I.isEnglish?'←':'→'} ${tr('חזרו ללוח בחירת המשחקים','Back to game selection')}</button>${state.phase==='setup'?setup():state.phase==='finished'?result():play()}</section>`;
  foodIcons();drawHeads();syncImage();draw();
}
function drawHeads(){for(const canvas of host?.querySelectorAll('[data-rex-head]')||[]){const ctx=canvas.getContext('2d');ctx.clearRect(0,0,160,160);if(head)ctx.drawImage(head,0,0,160,160);}}
function syncImage(){const button=$('[data-rex-start]');if(button){button.disabled=!state.ready;button.textContent=state.ready?tr('יאללה, תימנירקס!','Let’s run, Yemeanite Rex!'):tr('טוענים את הראש…','Loading portrait…');}const error=$('[data-rex-image-status]');if(error)error.textContent=state.imageError;const retry=$('[data-rex-retry]');if(retry)retry.hidden=!state.imageError;}
function loadHead(){
  const person=selected(),token=++imageSerial;state.ready=false;state.imageError='';head=null;syncImage();
  if(!person){state.imageError=tr('הדמות אינה זמינה כרגע. נסו לבחור דמות אחרת.','This character is unavailable. Try another character.');syncImage();return;}
  const prepare=image=>{if(token!==imageSerial)return;const canvas=document.createElement('canvas');canvas.width=canvas.height=160;const ctx=canvas.getContext('2d'),crop=headCrop(image.naturalWidth,image.naturalHeight,person.preparedCrop);ctx.save();ctx.beginPath();ctx.ellipse(80,80,77,80,0,0,Math.PI*2);ctx.clip();ctx.drawImage(image,crop.x,crop.y,crop.size,crop.size,0,0,160,160);ctx.restore();head=canvas;state.ready=true;syncImage();drawHeads();draw();};
  if(images.has(person.id)){prepare(images.get(person.id));return;}
  const image=new Image();image.decoding='async';image.onload=()=>{images.set(person.id,image);prepare(image);};image.onerror=()=>{if(token!==imageSerial)return;state.imageError=tr('הראש לא נטען. נסו שוב או בחרו דמות אחרת.','The portrait could not load. Try again or choose another character.');syncImage();};image.src=person.profile;
}
function begin(){if(!state.ready)return;stop();floats=[];state.game=createRunner({now:Date.now(),width:worldWidth()});state.phase='playing';run={id:runId(),headId:state.selected,name:'',busy:false,saved:false,error:'',rank:null};render();$('[data-rex-board]')?.focus({preventScroll:true});$('.rex-hud')?.scrollIntoView({block:'start'});animate();}
function finish(){if(state.phase!=='playing'||state.game.lives>0)return;stop();state.phase='finished';floats=[];render();$('.rex-finish')?.focus({preventScroll:true});$('.rex-finish')?.scrollIntoView({block:'start'});loadScores(true);}
function animate(){if(!host||state.phase!=='playing'||document.visibilityState==='hidden')return;if(frame===null)frame=requestAnimationFrame(tick);}
function tick(timestamp){
  frame=null;if(!host||state.phase!=='playing'||document.visibilityState==='hidden')return;
  const now=Date.now(),dt=lastFrame?Math.min(.06,(timestamp-lastFrame)/1000):0;lastFrame=timestamp;
  advanceRunner(state.game,dt,now);
  if(state.game.phase==='finished'){finish();return;}
  for(const event of state.game.events){
    if(event.type==='crash'){floats=[];syncBasket();const note=$('[data-rex-crash-title]');if(note)note.textContent=tr('אופס! נותרו ','Oops! ')+state.game.lives+tr(' פסילות',' lives left');const status=$('[data-rex-status]');if(status)status.textContent=tr('פסילה. הניקוד והמאכלים נשמרו. ממשיכים לרוץ.','Crash. Your score and food are kept. Keep running.');}
    if(event.type==='food'){floats.push({...event,until:now+850});syncBasket();const status=$('[data-rex-status]');if(status)status.textContent=foodName(FOODS.find(food=>food.id===event.kind))+' +'+event.points;}
  }
  const crash=$('[data-rex-crash]');if(crash)crash.hidden=now>=state.game.recoverUntil;
  draw();animate();
}
function syncBasket(){const points=$('[data-rex-points]'),lives=$('[data-rex-lives]');if(points)points.textContent=String(state.game.score);if(lives)lives.textContent=String(state.game.lives);for(const icon of host?.querySelectorAll('[data-rex-life]')||[])icon.dataset.lost=String(Number(icon.dataset.rexLife)>=state.game.lives);for(const food of FOODS){const node=$(`[data-rex-count="${food.id}"]`);if(node)node.textContent=String(state.game.basket[food.id]);}}
function jump(){if(state.phase==='playing')jumpRunner(state.game,Date.now());}
function click(event){
  if(event.target.closest('[data-rex-back]')){pauseRex();back?.();return;}
  if(event.target.closest('[data-rex-start],[data-rex-restart]')){begin();return;}
  if(event.target.closest('[data-rex-settings]')){stop();state.phase='setup';state.game=null;render();return;}
  if(event.target.closest('[data-rex-jump]')){jump();return;}
  if(event.target.closest('[data-rex-refresh]'))loadScores(true);
  if(event.target.closest('[data-rex-retry]'))loadHead();
}
function input(event){if(event.target.id==='rexScoreName'&&run&&!run.busy&&!run.saved)run.name=event.target.value;if(event.target.id==='rexSearch'){state.query=event.target.value;const select=$('#rexCharacter');if(select)select.innerHTML=options();}}
function change(event){if(event.target.id!=='rexCharacter'||state.phase!=='setup')return;state.selected=event.target.value;render();loadHead();}
function syncScores(){const panel=$('[data-rex-leaderboard]');if(panel)panel.innerHTML=leaderboardInner();}
async function loadScores(force=false){
  if(scores.loading||scores.loaded&&!force)return;const serial=++scores.serial;scores.loading=true;scores.error='';syncScores();
  try{const response=await I.fetch('api/games/rex/scores'),data=await response.json();if(!response.ok||!Array.isArray(data.scores))throw Error();if(serial!==scores.serial)return;scores.rows=data.scores;scores.loaded=true;}
  catch{if(serial===scores.serial)scores.error=tr('לא ניתן לטעון את השיאים כרגע. אפשר לרענן ולנסות שוב.','Records could not load. Refresh to try again.');}
  finally{if(serial===scores.serial){scores.loading=false;syncScores();}}
}
async function saveScore(event){
  event.preventDefault();const entry=run;if(state.phase!=='finished'||!entry||entry.busy||entry.saved)return;
  const playerName=entry.name.normalize('NFKC').trim().replace(/\s+/g,' ');if(!playerName||playerName.length>60||/[\u0000-\u001f\u007f]/.test(playerName)){entry.error=tr('הזינו שם באורך של עד 60 תווים.','Enter a name using up to 60 characters.');syncScoreForm();return;}
  const body={requestId:entry.id,name:playerName,headId:entry.headId,score:state.game.score,basket:{...state.game.basket}};
  entry.busy=true;entry.error='';syncScoreForm();
  try{const response=await I.fetch('api/games/rex/scores',{method:'POST',headers:{'Content-Type':'application/json','X-Family-Token':window.FAMILY_API_TOKEN},body:JSON.stringify(body)}),data=await response.json();if(!response.ok||data.saved!==true||!Array.isArray(data.scores))throw Error();entry.saved=true;entry.name=playerName;entry.rank=data.rank;scores.serial++;scores.loading=false;scores.rows=data.scores;scores.loaded=true;scores.error='';}
  catch{entry.error=tr('התוצאה לא נשמרה כרגע. השם והניקוד נשמרו כאן — נסו שוב.','Your score could not be saved. Your name and score are kept here — please try again.');}
  finally{entry.busy=false;if(host&&state.phase==='finished'&&entry===run){syncScoreForm();syncScores();}}
}
function syncScoreForm(){const panel=$('[data-rex-score-entry]');if(panel)panel.innerHTML=scoreForm();}

function path(ctx,points,fill){ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle=fill;ctx.fill();}
function scene(ctx,width,height,distance){
  const sky=ctx.createLinearGradient(0,0,0,height);sky.addColorStop(0,'#faf1d8');sky.addColorStop(1,'#fffdf4');ctx.fillStyle=sky;ctx.fillRect(0,0,width,height);
  ctx.fillStyle='#e8c982';ctx.beginPath();ctx.arc(width*.76,65,34,0,Math.PI*2);ctx.fill();
  const offset=distance*.13%300;
  for(let x=-300-offset;x<width+300;x+=300){path(ctx,[[x,GROUND],[x+128,148],[x+273,GROUND]],'#e7d9b8');path(ctx,[[x+100,GROUND],[x+267,191],[x+390,GROUND]],'#dacda9');}
  const town=distance*.3%380;
  for(let x=-380-town;x<width+380;x+=380){
    for(let i=0;i<3;i++){const bx=x+i*58,by=GROUND-100-i%2*34;ctx.fillStyle=i%2?'#ceb58f':'#d8c49e';ctx.fillRect(bx,by,48,GROUND-by);ctx.fillStyle='#f5ead1';ctx.fillRect(bx-2,by-4,52,6);for(let row=0;row<3;row++)for(let col=0;col<2;col++){ctx.fillStyle='#a08f6d';ctx.beginPath();ctx.roundRect(bx+10+col*20,by+15+row*27,9,14,[5,5,0,0]);ctx.fill();ctx.strokeStyle='#f0e0bf';ctx.lineWidth=2;ctx.stroke();}}
  }
  ctx.fillStyle='#c8b583';ctx.fillRect(0,GROUND,width,3);ctx.fillStyle='#eee2c6';ctx.fillRect(0,GROUND+3,width,height-GROUND-3);
  ctx.fillStyle='#ccb98f';for(let i=0;i<width/38+2;i++){const x=i*38-distance%38;ctx.fillRect(x,GROUND+18+(i%3)*11,8+i%3*3,2);}
}
function drawKhat(ctx,plant){
  ctx.save();ctx.translate(plant.x+plant.width/2,GROUND);const h=plant.height;ctx.strokeStyle='#5b7950';ctx.lineWidth=3;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(0,0);ctx.quadraticCurveTo(-3,-h*.5,2,-h);ctx.stroke();
  for(let i=0;i<4;i++){const y=-12-i*h*.19;for(const sign of [-1,1]){ctx.save();ctx.translate(0,y);ctx.rotate(sign*.65);path(ctx,[[0,0],[sign*9,-4],[sign*8,-8],[sign*15,-13],[sign*12,-17],[sign*16,-23],[sign*6,-20],[sign*5,-23],[0,-13]],i%2?'#68864f':'#819758');ctx.strokeStyle='#b1bd83';ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(sign*12,-20);ctx.stroke();ctx.restore();}}
  path(ctx,[[0,-h+6],[-5,-h-3],[2,-h-15],[8,-h-3]],'#6d8d53');ctx.restore();
}
function drawFood(ctx,kind,x,y,scale=1){
  ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ctx.lineWidth=1.5;
  if(kind==='jachnun'){
    ctx.rotate(-.55);ctx.fillStyle='#ad632f';ctx.beginPath();ctx.roundRect(-12,-8,26,16,5);ctx.fill();ctx.fillStyle='#e6b16b';ctx.beginPath();ctx.ellipse(-10,0,6,8,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#9a5529';ctx.beginPath();for(let t=0;t<13;t+=.15){const r=4.8*(1-t/13),px=-10+Math.cos(t)*r,py=Math.sin(t)*r*1.3;if(t===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);}ctx.stroke();ctx.strokeStyle='#d39753';ctx.beginPath();ctx.moveTo(-1,-7);ctx.lineTo(2,7);ctx.moveTo(6,-7);ctx.lineTo(9,7);ctx.stroke();
  }else if(kind==='kubaneh'){
    ctx.fillStyle='#a56332';ctx.beginPath();ctx.roundRect(-20,-10,40,29,[5,5,10,10]);ctx.fill();ctx.strokeStyle='#d69c59';for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(-12+i*12,0);ctx.lineTo(-12+i*12,15);ctx.stroke();}for(const [cx,cy] of [[-10,-10],[10,-10],[0,0]]){ctx.fillStyle='#dc9f58';ctx.beginPath();ctx.arc(cx,cy,11,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#b4773c';ctx.stroke();ctx.strokeStyle='#f6cd8a';ctx.beginPath();ctx.arc(cx-1,cy,6,Math.PI,Math.PI*1.8);ctx.stroke();}
  }else{
    const r=kind==='malawach'?25:18;ctx.fillStyle=kind==='malawach'?'#bd7e37':'#cdaf74';ctx.beginPath();ctx.ellipse(0,3,r,r*.66,0,0,Math.PI*2);ctx.fill();ctx.fillStyle=kind==='malawach'?'#efc779':'#f1ddb1';ctx.beginPath();ctx.ellipse(0,0,r,r*.66,0,0,Math.PI*2);ctx.fill();
    if(kind==='lahoh'){for(let i=0;i<30;i++){const a=i*2.4,rr=Math.sqrt(i/30)*r*.85;ctx.fillStyle=i%3?'#c9af7d':'#e0c591';ctx.beginPath();ctx.ellipse(Math.cos(a)*rr,Math.sin(a)*rr*.62,1.4,1.1,0,0,Math.PI*2);ctx.fill();}}
    else{ctx.strokeStyle='#ce9549';for(let i=0;i<3;i++){ctx.beginPath();ctx.ellipse(0,0,r-4-i*5,(r-4-i*5)*.62,.12*i,0,Math.PI*2);ctx.stroke();}ctx.fillStyle='#b77a34';for(const [bx,by] of [[-12,-5],[8,7],[5,-8],[-4,5]]){ctx.beginPath();ctx.ellipse(bx,by,3,1.6,.5,0,Math.PI*2);ctx.fill();}}
  }
  ctx.restore();
}
function drawRunner(ctx,player,distance,now,recoverUntil=0){
  const p=player,airborne=p.y<GROUND-p.height-1,step=airborne?.65:Math.sin(distance*.105),cx=p.x+p.width/2;
  ctx.save();ctx.translate(cx,p.y);if(now<recoverUntil)ctx.globalAlpha=.65;
  ctx.fillStyle='#8b7c5926';ctx.beginPath();ctx.ellipse(-10,GROUND-p.y+2,38,5,0,0,Math.PI*2);ctx.fill();
  // Long balancing tail, heavy hips, short forearms and two clawed T. rex legs.
  const tailLift=airborne?-5:Math.sin(distance*.045)*2;
  ctx.fillStyle='#647c49';ctx.beginPath();ctx.moveTo(-8,43);ctx.bezierCurveTo(-30,50,-55,45,-75,31+tailLift);ctx.bezierCurveTo(-62,57,-34,69,-9,64);ctx.closePath();ctx.fill();
  ctx.strokeStyle='#52683e';ctx.lineWidth=10;ctx.lineCap='round';ctx.lineJoin='round';
  ctx.beginPath();ctx.moveTo(-9,57);ctx.lineTo(-17-step*9,67);ctx.lineTo(-8-step*6,79);ctx.stroke();
  path(ctx,[[-14-step*6,77],[1-step*6,78],[5-step*6,84],[-16-step*6,84]],'#52683e');
  ctx.fillStyle='#80955e';ctx.beginPath();ctx.ellipse(-2,48,23,18,-.3,0,Math.PI*2);ctx.fill();
  path(ctx,[[4,48],[9,23],[24,24],[19,52],[6,60]],'#80955e');
  ctx.fillStyle='#b2bb85';ctx.beginPath();ctx.ellipse(9,49,10,15,.45,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#758b52';ctx.lineWidth=10;ctx.beginPath();ctx.moveTo(3,57);ctx.lineTo(14+step*8,68);ctx.lineTo(6+step*7,80);ctx.stroke();
  path(ctx,[[1+step*7,77],[17+step*7,78],[23+step*7,84],[-2+step*7,84]],'#758b52');
  ctx.strokeStyle='#f2e5bc';ctx.lineWidth=1.7;for(const side of [-1,1]){const base=side<0?-8-step*6:11+step*7;for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(base+i*4,80);ctx.lineTo(base+i*4+2,83);ctx.stroke();}}
  ctx.strokeStyle='#647c49';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(16,40);ctx.lineTo(27,43);ctx.lineTo(26,48);ctx.moveTo(22,42);ctx.lineTo(33,44);ctx.lineTo(33,49);ctx.stroke();
  for(const [x,y] of [[-44,48],[-28,52],[-12,42],[-2,38]])path(ctx,[[x-3,y],[x,y-5],[x+4,y]],'#9aaa73');
  if(head)ctx.drawImage(head,-7,-7,49,51);else{ctx.fillStyle='#b6bc87';ctx.beginPath();ctx.ellipse(17,16,23,25,0,0,Math.PI*2);ctx.fill();}
  ctx.restore();
}
function draw(){
  const canvas=$('[data-rex-board]')||$('[data-rex-demo]');if(!canvas)return;const ctx=canvas.getContext('2d'),game=state.game,now=Date.now(),demo=state.phase==='setup',distance=demo?0:game.distance;
  ctx.clearRect(0,0,canvas.width,canvas.height);ctx.save();if(demo)ctx.translate(0,-90);scene(ctx,canvas.width,demo?410:canvas.height,distance);
  if(demo){drawRunner(ctx,{...PLAYER,y:GROUND-PLAYER.height},0,now);const layout=state.demo;for(const plant of layout.plants)drawKhat(ctx,{...plant,x:300+plant.x});for(const food of layout.foods)drawFood(ctx,food.kind,300+food.x,food.y);}
  else{for(const plant of game.plants)drawKhat(ctx,plant);for(const food of game.foods)drawFood(ctx,food.kind,food.x,food.y);drawRunner(ctx,game.player,game.distance,now,game.recoverUntil);floats=floats.filter(item=>item.until>now);for(const item of floats){ctx.globalAlpha=(item.until-now)/850;ctx.fillStyle='#506e3f';ctx.font='bold 24px sans-serif';ctx.textAlign='center';ctx.fillText('+'+item.points,item.x,item.y-(850-(item.until-now))*.045);ctx.globalAlpha=1;}}
  ctx.restore();
}
