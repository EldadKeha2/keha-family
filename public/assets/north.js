import {WORLD_WIDTH,WORLD_HEIGHT,ROAD,PLAYER,ROUTE_SECONDS,TRIP_LIMIT,SCROLL_SPEED,createTrip,steerTrip,triggerTurbo,stepTrip,tripRemaining} from './north.mjs?v=1';

const I=window.FamilyI18n,tr=(he,en)=>I.isEnglish?en:he;
const ART='assets/games/north/';
const state={phase:'intro',game:null,sound:true,toast:'',toastUntil:0};
const images=new Map(),keys=new Set();
let host=null,back=null,events=null,frame=null,lastFrame=0,audio=null,audioNodes=[],held=0,dragging=false,applauseFor=null;
const $=selector=>host?.querySelector(selector);
const clock=value=>{const seconds=Math.max(0,Math.ceil(value-1e-6));return Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');};
const reduced=()=>document.documentElement.hasAttribute('data-a11y-motion')||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const title=()=>tr('נוסעים לצפון','Heading North');
const tribute=()=>tr('לזכרו של רועי חריזי ז״ל','In loving memory of Roei Harizi');
function stopFrame(){if(frame!==null)cancelAnimationFrame(frame);frame=null;lastFrame=0;keys.clear();held=0;dragging=false;}
function stopAudio(){for(const node of audioNodes){try{node.stop();}catch{}}audioNodes=[];}
export function pauseNorth(){if(state.phase==='playing')state.phase='paused';stopFrame();stopAudio();events?.abort();events=null;host?.classList.remove('has-family-north');host=null;}
export function mountNorth(root,onBack){
  pauseNorth();host=root;back=onBack;host.classList.add('has-family-north');events=new AbortController();
  const on=(node,type,fn,options={})=>node.addEventListener(type,fn,{...options,signal:events.signal});
  on(host,'click',click);on(host,'dblclick',event=>{if(event.target.closest('[data-north-board]')){event.preventDefault();turbo();}});
  on(host,'pointerdown',pointerDown,{passive:false});on(host,'pointermove',pointerMove,{passive:false});
  on(document,'pointerup',release);on(document,'pointercancel',release);on(host,'lostpointercapture',release);
  on(document,'keydown',keydown);on(document,'keyup',event=>keys.delete(event.code));
  on(window,'blur',()=>pause());on(document,'visibilitychange',()=>{if(document.visibilityState==='hidden')pause();});
  on(window,'family-accessibility-changed',()=>draw());
  render();loadImages();$('.north-heading')?.scrollIntoView({block:'start'});
}
function loadImages(){
  for(const [key,file] of [['roi','roi-profile.webp'],['car','cruze-roi.webp'],['family','family-clapping.webp']]){
    if(images.has(key))continue;
    const img=new Image();images.set(key,img);img.onload=()=>{if(host)draw();};img.onerror=()=>{img.failed=true;};img.src=ART+file;
  }
}
function memory(){return `<aside class="north-story"><div class="north-memory"><img class="north-portrait" src="${ART}roi-profile.webp" width="251" height="358" alt="${tr('רועי חריזי מחייך','Roei Harizi smiling')}"><p>${tr('כל מי שהכיר את רועי ידע: הוא היה חולה הגה אמיתי. השברולט קרוז המיתולוגית שלו הייתה חלק בלתי נפרד ממנו, וכשהוא היה מאחורי ההגה — תמיד הרגשנו שאנחנו בידיים טובות.','Everyone who knew Roei knew how much he loved to drive. His legendary Chevrolet Cruze was part of who he was, and with him behind the wheel, we always felt we were in good hands.')}</p><p>${tr('רועי אהב לעבוד, ולמפגשים המשפחתיים הגדולים בצפון הוא היה מגיע לא פעם באיחור. הפעם כולנו כבר מחכים לו. היכנסו לקרוז, עזרו לו לעקוף את המכשולים והביאו אותו למפגש בזמן.','Roei loved his work, and he often arrived late to our big family gatherings in the north. This time, everyone is already waiting. Get into the Cruze, weave past the obstacles, and help him reach the family in time.')}</p><span class="north-memory-signature">${tr('עוד נסיעה אחת, יחד איתך ♡','One more drive, together with you ♡')}</span></div></aside>`;}
function guide(){return `<aside class="north-guide"><span class="north-eyebrow">${tr('הדרך למפגש המשפחתי','The road to our family gathering')}</span><div class="north-route-card"><strong>${tr('כולם כבר מחכים בצפון','Everyone is waiting up north')}</strong><ol class="north-route-stops"><li>${tr('מסיימים לעבוד ויוצאים','Finish work and set off')}</li><li>${tr('עוקפים, מתקדמים ונזהרים','Overtake and find your way')}</li><li>${tr('מגיעים לחיבוק המשפחתי','Arrive for a family hug')}</li></ol></div><ul class="north-rules"><li><b>${tr('3 דקות','3 minutes')}</b><span>${tr('זה כל הזמן שיש עד המפגש.','That’s all the time you have.')}</span></li><li><b>${tr('5 שניות עצירה','5-second stop')}</b><span>${tr('על כל התנגשות. השעון ממשיך.','For each collision. The clock keeps ticking.')}</span></li><li><b>${tr('טורבו אחד','One turbo')}</b><span>${tr('חמש שניות של מהירות כפולה.','Five seconds at double speed.')}</span></li></ul><p class="north-tip">${tr('שתי התנגשויות? רק הטורבו יציל את ההגעה בזמן. שלוש התנגשויות? הפעם נגיע אחרי כולם.','Two collisions? You’ll need your turbo to arrive in time. Three collisions? This time you’ll be late.')}</p><details class="north-help"><summary>${tr('איך נוהגים?','How to drive')}</summary><p>${tr('מחשב: הזיזו את העכבר על הכביש, או השתמשו ב־← / → וב־A / D. טורבו: דאבל קליק על הכביש, רווח או Shift. בטלפון: גררו על הכביש או החזיקו את כפתורי החצים; לחצו על כפתור הטורבו. P או Esc להשהיה.','Computer: move the mouse over the road, or use ← / → and A / D. Turbo: double-click the road, Space, or Shift. Phone: drag on the road or hold an arrow button; tap Turbo. P or Esc pauses.')}</p></details></aside>`;}
function overlay(){
  if(state.phase==='playing')return '';
  const phase=state.phase,finished=phase==='won'||phase==='lost',g=state.game;
  let heading=tr('רועי, יוצאים לצפון?','Roei, ready to head north?'),body=tr('הקרוז מוכנה. המשפחה מחכה. שלוש דקות יוצאות לדרך.','The Cruze is ready. The family is waiting. Your three-minute journey starts here.');
  if(phase==='paused'){heading=tr('עוצרים לרגע','Taking a short break');body=tr('הנסיעה והשעון מושהים. ממשיכים בדיוק מאותה נקודה.','The journey and clock are paused. Continue from the same spot.');}
  if(phase==='won'){heading=tr('רועי הגיע! אפשר להתחיל!','Roei is here! Let the gathering begin!');body=tr('כל המשפחה על הרגליים, מוחאת כפיים ומריעה. איזה כיף שהגעת.','The whole family is on its feet, clapping and cheering. We’re so glad you made it.');}
  if(phase==='lost'){heading=tr('המשפחה התחילה בלעדינו…','The family got started without us…');body=tr('לא הספקנו הפעם, אבל אצלנו תמיד שומרים לרועי מקום. ננסה שוב להגיע בזמן?','We didn’t make it this time, but our family always saves a place for Roei. Shall we try again?');}
  return `<div class="north-overlay"><div class="north-overlay-card" tabindex="-1" data-north-overlay><span class="north-eyebrow">${tribute()}</span><h4>${heading}</h4><p>${body}</p>${phase==='won'?`<div class="north-family-celebration" role="img" aria-label="${tr('קריקטורות של בני המשפחה, מדורות שונים, מחכות ומוחאות כפיים לרועי','Caricatures of family members across generations welcome Roei with applause')}"><span aria-hidden="true"></span></div>`:''}${finished?`<div class="north-result-stats"><span><b>${clock(g.elapsed)}</b>${tr('זמן נסיעה','Journey time')}</span><span><b>${g.collisions}</b>${tr('התנגשויות','Collisions')}</span><span><b>${g.turboUsed?tr('נוצל','Used'):tr('נשמר','Saved')}</b>${tr('טורבו','Turbo')}</span></div>`:''}<button type="button" class="north-button" data-north-${phase==='paused'?'resume':'start'}>${phase==='paused'?tr('ממשיכים צפונה','Keep heading north'):finished?tr('עוד נסיעה עם רועי','Another drive with Roei'):tr('יאללה, נוסעים לצפון!','Let’s head north!')}</button>${finished?`<button type="button" class="north-button north-button-secondary" data-north-back>${tr('חזרו ללוח בחירת המשחקים','Back to game selection')}</button>`:''}</div></div>`;
}
function render(){
  if(!host)return;
  host.innerHTML=`<section class="family-north" data-phase="${state.phase}"><div class="north-topbar"><button type="button" class="game-lobby-button" data-north-back>${I.isEnglish?'←':'→'} ${tr('חזרו ללוח בחירת המשחקים','Back to game selection')}</button><button type="button" class="north-sound north-button north-button-secondary" data-north-sound aria-pressed="${state.sound}">${state.sound?tr('צלילים: פעילים','Sound: on'):tr('צלילים: כבויים','Sound: off')}</button></div><header class="north-heading" tabindex="-1"><span class="north-eyebrow">${tribute()}</span><h3>${title()}</h3><p>${tr('הקרוז של רועי. הדרך לצפון. המשפחה מחכה.','Roei’s Cruze. Our road. The whole family waiting at the end.')}</p></header><div class="north-layout">${memory()}<div class="north-cockpit"><div class="north-hud"><div><small>${tr('עד המפגש','Until the gathering')}</small><strong data-north-time role="timer" aria-live="off" dir="ltr">3:00</strong></div><div><small>${tr('התנגשויות','Collisions')}</small><strong data-north-crashes>0</strong></div><div><small>${tr('טורבו','Turbo')}</small><strong data-north-turbos>1</strong></div></div><div class="north-road-shell"><canvas data-north-board width="${WORLD_WIDTH}" height="${WORLD_HEIGHT}" tabindex="0" aria-label="${tr('כביש לצפון. חצים שמאלה וימינה להיגוי. רווח לטורבו. P להשהיה.','Road to the north. Left and Right arrows steer. Space activates turbo. P pauses.')}" aria-describedby="northControlHint"></canvas><div class="north-driver-badge"><img src="${ART}roi-profile.webp" width="40" height="40" alt=""><span>${tr('רועי בדרך','Roei is on his way')}</span><b aria-hidden="true">N ↑</b></div><div class="north-toast" data-north-toast hidden></div>${overlay()}</div><div class="north-progress"><progress data-north-progress max="${ROUTE_SECONDS}" value="0" aria-label="${tr('ההתקדמות לצפון','Progress towards the north')}"></progress><span><small>${tr('יוצאים לדרך','Setting off')}</small><small data-north-progress-label>0%</small><small>${tr('המשפחה מחכה ♡','Family awaits ♡')}</small></span></div><div class="north-controls" dir="ltr"><button type="button" class="north-button north-steer" data-north-steer="-1" aria-label="${tr('היגוי שמאלה','Steer left')}">←</button><button type="button" class="north-button north-turbo" data-north-turbo>${tr('טורבו','Turbo')} <b>×1</b></button><button type="button" class="north-button north-steer" data-north-steer="1" aria-label="${tr('היגוי ימינה','Steer right')}">→</button></div><div class="north-pause-row"><p id="northControlHint">${tr('עכבר / חצים להיגוי · דאבל קליק / רווח לטורבו','Mouse / arrows to steer · Double-click / Space for turbo')}<small>${tr('בטלפון: גררו או השתמשו בחצים ובטורבו.','Phone: drag, or use the arrows and Turbo.')}</small></p><button type="button" class="north-button north-button-secondary" data-north-pause>${state.phase==='paused'?tr('המשך נסיעה','Resume'):tr('השהיה','Pause')}</button></div><p class="visually-hidden" data-north-live role="status" aria-live="polite" aria-atomic="true"></p></div>${guide()}</div></section>`;
  sync();draw();
}
function sync(){
  const g=state.game,playing=state.phase==='playing';if(!host)return;
  const section=$('.family-north');section.dataset.phase=state.phase;section.dataset.turbo=String(!!g?.turboRemaining);section.dataset.stopped=String(!!g?.stopRemaining);
  $('[data-north-time]').textContent=clock(g?tripRemaining(g):TRIP_LIMIT);$('[data-north-time]').dataset.urgent=String(g&&tripRemaining(g)<20);
  $('[data-north-crashes]').textContent=String(g?.collisions||0);$('[data-north-turbos]').textContent=g?.turboUsed?'0':'1';
  $('[data-north-progress]').value=g?.distance||0;$('[data-north-progress-label]').textContent=Math.min(100,Math.floor((g?.distance||0)/ROUTE_SECONDS*100))+'%';
  const turboButton=$('[data-north-turbo]');turboButton.disabled=!playing||!!g?.turboUsed||!!g?.stopRemaining;turboButton.innerHTML=g?.turboRemaining?tr('טורבו פעיל!','Turbo active!'):g?.turboUsed?tr('הטורבו נוצל','Turbo used'):tr('טורבו ×1','Turbo ×1');
  for(const button of host.querySelectorAll('[data-north-steer]'))button.disabled=!playing;
  $('[data-north-pause]').disabled=!['playing','paused'].includes(state.phase);
  const toast=$('[data-north-toast]');const stopped=playing&&g?.stopRemaining>0;
  toast.hidden=!stopped&&(!state.toast||performance.now()>state.toastUntil);
  toast.textContent=stopped?tr('עוצרים ל־','Stopped for ')+Math.ceil(g.stopRemaining)+tr(' שניות · השעון ממשיך',' seconds · The clock keeps ticking'):state.toast;
}
function announce(message){const node=$('[data-north-live]');if(node)node.textContent=message;}
function notify(message){state.toast=message;state.toastUntil=performance.now()+2400;announce(message);}
function click(event){
  if(event.target.closest('[data-north-back]')){pauseNorth();back?.();return;}
  if(event.target.closest('[data-north-sound]')){state.sound=!state.sound;if(!state.sound)stopAudio();else unlockAudio();const button=$('[data-north-sound]');button.setAttribute('aria-pressed',String(state.sound));button.textContent=state.sound?tr('צלילים: פעילים','Sound: on'):tr('צלילים: כבויים','Sound: off');return;}
  if(event.target.closest('[data-north-start]')){start();return;}
  if(event.target.closest('[data-north-resume]')){resume();return;}
  if(event.target.closest('[data-north-pause]')){if(state.phase==='paused')resume();else pause();return;}
  if(event.target.closest('[data-north-turbo]')){turbo();return;}
  const steer=event.target.closest('[data-north-steer]');if(steer&&event.detail===0&&state.phase==='playing')steerTrip(state.game,state.game.player.x+Number(steer.dataset.northSteer)*65);
}
function start(){stopFrame();stopAudio();state.game=createTrip();state.phase='playing';state.toast='';applauseFor=null;unlockAudio();render();$('[data-north-board]')?.focus({preventScroll:true});$('[data-north-board]')?.scrollIntoView({block:'center'});animate();}
function pause(){if(state.phase!=='playing'||!host)return;state.phase='paused';stopFrame();stopAudio();render();$('[data-north-resume]')?.focus({preventScroll:true});}
function resume(){if(state.phase!=='paused'||!host)return;state.phase='playing';render();$('[data-north-board]')?.focus({preventScroll:true});animate();}
function turbo(){if(state.phase!=='playing')return;if(triggerTurbo(state.game)){notify(tr('טורבו! חמש שניות של תנופה צפונה','Turbo! Five seconds of northbound boost'));sync();}}
function blockedTarget(event){return event.target.closest?.('input,textarea,select,a,dialog,[contenteditable="true"]')||document.querySelector('dialog[open]');}
function keydown(event){
  if(blockedTarget(event))return;
  if(['Escape','KeyP'].includes(event.code)&&['playing','paused'].includes(state.phase)){event.preventDefault();if(!event.repeat){if(state.phase==='playing')pause();else resume();}return;}
  if(state.phase!=='playing')return;
  if(['ArrowLeft','ArrowRight','KeyA','KeyD'].includes(event.code)){event.preventDefault();keys.add(event.code);return;}
  if(['Space','ShiftLeft','ShiftRight'].includes(event.code)&&!event.target.closest?.('button')){event.preventDefault();if(!event.repeat)turbo();}
}
function pointerDown(event){
  if(state.phase!=='playing'||event.isPrimary===false||event.button>0)return;
  const button=event.target.closest('[data-north-steer]'),board=event.target.closest('[data-north-board]');
  if(button){event.preventDefault();held=Number(button.dataset.northSteer);button.setPointerCapture?.(event.pointerId);return;}
  if(board){event.preventDefault();dragging=true;board.setPointerCapture?.(event.pointerId);pointTo(event,board);board.focus({preventScroll:true});}
}
function pointerMove(event){const board=event.target.closest('[data-north-board]');if(state.phase==='playing'&&board&&(event.pointerType==='mouse'||dragging)){event.preventDefault();pointTo(event,board);}}
function pointTo(event,board){const box=board.getBoundingClientRect();steerTrip(state.game,(event.clientX-box.left)/box.width*WORLD_WIDTH);}
function release(){held=0;dragging=false;}
function animate(){if(frame!==null||!host||state.phase!=='playing')return;lastFrame=0;frame=requestAnimationFrame(tick);}
function tick(now){
  frame=null;if(!host||state.phase!=='playing')return;
  const dt=lastFrame?(now-lastFrame)/1000:0;lastFrame=now;
  if(dt>1){pause();return;}
  const g=state.game,before=g.collisions,wasTurbo=g.turboRemaining>0;
  const direction=held+(keys.has('ArrowRight')||keys.has('KeyD')?1:0)-(keys.has('ArrowLeft')||keys.has('KeyA')?1:0);
  if(direction)steerTrip(g,g.player.x+Math.sign(direction)*300*dt);
  stepTrip(g,dt);
  if(g.collisions!==before)announce(tr('התנגשות. עצירה של חמש שניות. מספר התנגשויות: ','Collision. Five-second stop. Collisions: ')+g.collisions);
  if(wasTurbo&&!g.turboRemaining)notify(tr('הטורבו הסתיים — ממשיכים צפונה','Turbo finished — keep heading north'));
  if(g.phase==='won'||g.phase==='lost'){finish(g.phase);return;}
  sync();draw();frame=requestAnimationFrame(tick);
}
function finish(phase){state.phase=phase;stopFrame();render();$('[data-north-overlay]')?.focus({preventScroll:true});announce(phase==='won'?tr('הגעתם בזמן! המשפחה מריעה לרועי!','You arrived in time! The family cheers for Roei!'):tr('תם הזמן. המשפחה תמיד שומרת לרועי מקום.','Time is up. The family always saves Roei a place.'));if(phase==='won'&&applauseFor!==state.game){applauseFor=state.game;applause();}}
function unlockAudio(){if(!state.sound)return;const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;try{audio??=new Audio();if(audio.state==='suspended')audio.resume().catch(()=>{});}catch{}}
function applause(){
  if(!state.sound||!audio)return;stopAudio();
  // Soft overlapping, band-limited handclaps; no sound files or network requests.
  const now=audio.currentTime,buffer=audio.createBuffer(1,Math.floor(audio.sampleRate*.12),audio.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/data.length,2);
  for(let i=0;i<75;i++){const source=audio.createBufferSource(),gain=audio.createGain(),filter=audio.createBiquadFilter();source.buffer=buffer;filter.type='bandpass';filter.frequency.value=1100+Math.random()*1700;filter.Q.value=.5;gain.gain.value=.08+Math.random()*.08;source.connect(filter);filter.connect(gain);gain.connect(audio.destination);source.start(now+Math.random()*4);audioNodes.push(source);}
}
function round(ctx,x,y,w,h,r,fill){ctx.fillStyle=fill;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}
function poly(ctx,points,fill){ctx.fillStyle=fill;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();}
function drawRoad(ctx,g){
  const distance=g?.distance||0,scroll=distance*SCROLL_SPEED,mood=Math.min(1,distance/ROUTE_SECONDS);
  ctx.fillStyle=mood>.65?'#6f935f':mood>.3?'#a9b579':'#c5b381';ctx.fillRect(0,0,WORLD_WIDTH,WORLD_HEIGHT);
  for(let i=0;i<19;i++){
    const side=i%2===0,x=side?15+(i*17)%37:428+(i*13)%32,y=(i*137+scroll*.75)%900-70;
    ctx.fillStyle='#44694d';ctx.beginPath();ctx.ellipse(x,y,12+i%3*3,17,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#70916a';ctx.beginPath();ctx.ellipse(x-3,y-5,7,11,-.2,0,Math.PI*2);ctx.fill();
    if(i%4===0){round(ctx,x-12,y+60,24,38,2,'#d9c6a1');poly(ctx,[[x-16,y+61],[x,y+48],[x+16,y+61]],'#9f654e');}
  }
  ctx.fillStyle='#3b4650';ctx.fillRect(ROAD.left,0,ROAD.right-ROAD.left,WORLD_HEIGHT);
  ctx.fillStyle='#27343c';ctx.fillRect(ROAD.left-7,0,7,WORLD_HEIGHT);ctx.fillRect(ROAD.right,0,7,WORLD_HEIGHT);
  ctx.fillStyle='#e8dfb9';ctx.fillRect(ROAD.left+5,0,3,WORLD_HEIGHT);ctx.fillRect(ROAD.right-8,0,3,WORLD_HEIGHT);
  ctx.fillStyle='#d9e1d3';for(let lane=1;lane<3;lane++){const x=ROAD.left+(ROAD.right-ROAD.left)*lane/3;for(let y=scroll%92-92;y<WORLD_HEIGHT;y+=92)ctx.fillRect(x-1.5,y,3,43);}
  for(let y=scroll%48-48;y<WORLD_HEIGHT;y+=48){ctx.fillStyle=Math.floor((y-scroll%48)/48)%2?'#d3d9cd':'#757d72';ctx.fillRect(ROAD.left-14,y,5,24);ctx.fillRect(ROAD.right+9,y,5,24);}
  if(distance<8||distance>ROUTE_SECONDS-14){const y=distance<8?(scroll*.7)%1100-70:(distance-(ROUTE_SECONDS-14))*57-40;round(ctx,ROAD.right+8,y,55,36,3,'#236452');ctx.fillStyle='#fff8dc';ctx.textAlign='center';ctx.font='bold 11px sans-serif';ctx.fillText(tr('צפון ↑','NORTH ↑'),ROAD.right+35,y+22);}
  if(distance>ROUTE_SECONDS-5){const y=610-(ROUTE_SECONDS-distance)*180;for(let row=0;row<2;row++)for(let col=0;col<17;col++)ctx.fillStyle=(row+col)%2?'#eef0df':'#233a3b',ctx.fillRect(ROAD.left+col*20,y+row*18,20,18);}
}
function drawCar(ctx,x,y,w,h,color,player=false){
  const sprite=images.get('car');
  if(player&&sprite?.complete&&sprite.naturalWidth&&!sprite.failed){ctx.drawImage(sprite,x-6,y-7,w+12,h+14);return;}
  round(ctx,x+3,y+4,w,h,13,'#17252e55');round(ctx,x-3,y+14,7,h*.16,3,'#16242b');round(ctx,x+w-4,y+14,7,h*.16,3,'#16242b');round(ctx,x-3,y+h*.68,7,h*.16,3,'#16242b');round(ctx,x+w-4,y+h*.68,7,h*.16,3,'#16242b');
  round(ctx,x,y,w,h,10,color);round(ctx,x+5,y+7,w-10,h-14,8,player?'#c1d3dc':color);round(ctx,x+7,y+h*.24,w-14,h*.2,5,'#233e4f');round(ctx,x+7,y+h*.48,w-14,h*.27,4,player?'#dce2e1':'#ffffff35');round(ctx,x+8,y+h*.78,w-16,h*.12,3,'#29434e');
  round(ctx,x+5,y+3,10,4,1,'#fff3bf');round(ctx,x+w-15,y+3,10,4,1,'#fff3bf');round(ctx,x+5,y+h-7,9,3,1,'#d96e50');round(ctx,x+w-14,y+h-7,9,3,1,'#d96e50');
  if(player)poly(ctx,[[x+w/2-9,y+13],[x+w/2-3,y+13],[x+w/2-3,y+10],[x+w/2+3,y+10],[x+w/2+3,y+13],[x+w/2+9,y+13],[x+w/2+9,y+17],[x+w/2+3,y+17],[x+w/2+3,y+20],[x+w/2-3,y+20],[x+w/2-3,y+17],[x+w/2-9,y+17]],'#d4b05e');
}
function drawObstacle(ctx,o){
  const {width:w,height:h}=o,x=o.x-w/2,y=o.y-h/2,kind=o.kind||o.type;
  if(kind==='car'||kind==='traffic'||kind==='van'){drawCar(ctx,x,y,w,h,o.color||['#b65343','#e2d6b1','#5c8d8e','#7e7498','#556f9c','#b68d50','#bfc7c9'][o.colour||0]);return;}
  if(kind==='island'){round(ctx,x,y,w,h,w/2,'#e3d5ac');round(ctx,x+5,y+5,w-10,h-10,Math.max(2,w/2-5),'#71885a');ctx.fillStyle='#d3bb82';ctx.beginPath();ctx.arc(x+w/2,y+Math.min(18,h/2),8,0,Math.PI*2);ctx.fill();return;}
  if(kind==='pothole'){ctx.fillStyle='#263139';ctx.beginPath();ctx.ellipse(x+w/2,y+h/2,w/2,h/2,.2,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#747d7e';ctx.lineWidth=3;ctx.stroke();return;}
  if(kind==='cone'||kind==='cones'){round(ctx,x,y+h*.7,w,h*.3,3,'#322e29');poly(ctx,[[x+2,y+h*.8],[x+w/2,y],[x+w-2,y+h*.8]],'#dd8c4a');poly(ctx,[[x+w*.25,y+h*.5],[x+w*.38,y+h*.27],[x+w*.62,y+h*.27],[x+w*.75,y+h*.5]],'#fff2d0');return;}
  round(ctx,x,y,w,h,5,'#d9b55d');ctx.save();ctx.beginPath();ctx.roundRect(x,y,w,h,5);ctx.clip();ctx.strokeStyle='#684d3e';ctx.lineWidth=13;for(let i=-h;i<w+h;i+=28){ctx.beginPath();ctx.moveTo(x+i,y+h);ctx.lineTo(x+i+h,y);ctx.stroke();}ctx.restore();
}
function draw(){
  const canvas=$('[data-north-board]');if(!canvas)return;const ctx=canvas.getContext('2d'),g=state.game;
  ctx.clearRect(0,0,WORLD_WIDTH,WORLD_HEIGHT);drawRoad(ctx,g);
  if(g?.distance>ROUTE_SECONDS-5){const family=images.get('family');if(family?.complete&&family.naturalWidth&&!family.failed){const y=610-(ROUTE_SECONDS-g.distance)*180,frameIndex=reduced()?0:Math.floor(g.elapsed/.28)%2;ctx.drawImage(family,frameIndex*768,0,768,512,ROAD.left+8,y-205,ROAD.right-ROAD.left-16,210);}}
  if(g)for(const o of g.obstacles){ctx.save();if(o.hit)ctx.globalAlpha=.35;drawObstacle(ctx,o);ctx.restore();}else [{x:120,y:110,width:48,height:88,kind:'car',color:'#b66050'},{x:306,y:340,width:46,height:82,kind:'car',color:'#d4bd8d'},{x:203,y:250,width:34,height:128,kind:'island'}].forEach(o=>drawObstacle(ctx,o));
  const center=g?.player||{x:WORLD_WIDTH/2,y:PLAYER.y,width:PLAYER.width,height:PLAYER.height},p={...center,x:center.x-center.width/2,y:center.y-center.height/2};
  if(g?.turboRemaining>0&&!reduced()){
    ctx.fillStyle='#edb95599';for(const dx of [-13,13])poly(ctx,[[p.x+p.width/2+dx-5,p.y+p.height-3],[p.x+p.width/2+dx+5,p.y+p.height-3],[p.x+p.width/2+dx,p.y+p.height+19+Math.sin(g.elapsed*40)*7]],'#efc86f');
  }
  ctx.save();if(g?.recoveryRemaining>0&&!g.stopRemaining)ctx.globalAlpha=.65;drawCar(ctx,p.x,p.y,p.width,p.height,'#97bacb',true);
  const roi=images.get('roi'),sprite=images.get('car');if((!sprite?.naturalWidth||sprite.failed)&&roi?.complete&&roi.naturalWidth&&!roi.failed){const r=13,cx=p.x+p.width*.5,cy=p.y+p.height*.39;ctx.save();ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.clip();ctx.drawImage(roi,17,5,roi.naturalWidth-34,(roi.naturalWidth-34),cx-r,cy-r,r*2,r*2);ctx.restore();ctx.strokeStyle='#f8e1a1';ctx.lineWidth=2;ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.stroke();}
  ctx.restore();
}
