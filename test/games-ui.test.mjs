import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {quizGrade} from '../public/assets/quiz.mjs';
import {QUIZ_ROUND_MS,quizScoreSummary} from '../public/assets/quiz-scoring.mjs';
import {makeChickQuiz,withinChickTarget} from '../public/assets/chick.mjs';
import {webcrypto} from 'node:crypto';
import {browserHistory,navigationSource} from './helpers/browser-history.mjs';

const source=(await readFile(new URL('../public/assets/games.js',import.meta.url),'utf8')).replace(/^import[^\n]+\n/gm,'');
const questions=Array.from({length:10},(_,i)=>({id:'photo-'+i,src:'/media/photo-'+i,correctId:'p0',options:Array.from({length:4},(_,j)=>({id:'p'+j,name:'אדם '+j,nameEn:'Person '+j}))}));
const kinshipQuestions=questions.map(q=>({...q,kind:'kinship',subject:{id:'rivi',name:'ריוי גנדלמן',nameEn:'Revital Gandelman',gender:'f',profile:'/media/rivi'},reference:{id:'eldad',name:'אלדד קהא',nameEn:'Eldad Keha',gender:'m',profile:'/media/eldad'},options:[{id:'p0',name:'בת דודה',nameEn:'First cousin'},{id:'p1',name:'אחות',nameEn:'Sister'},{id:'p2',name:'אחיינית',nameEn:'Niece'},{id:'p3',name:'נכדה',nameEn:'Granddaughter'}]}));
const triviaQuestions=questions.map(q=>({...q,kind:'trivia',subject:kinshipQuestions[0].subject,prompt:'באיזו שנה נולדה ריוי גנדלמן?',promptEn:'In which year was Revital Gandelman born?',options:q.options.map((o,i)=>({...o,name:String(1970+i),nameEn:String(1970+i)}))}));
function fixture({navigation=false,phone=false,entryUrl=null,english=false,autoImages=true,count=10,nativeShare=false,shareError=null,clipboardError=false,customTrivia=false,scoreSaveFailures=0,scoreLoadFailures=0}={}){
  let now=100000,intervalId=0,prevented=false,puzzleMounts=0,puzzlePauses=0,puzzleBack=null,jachnunMounts=0,jachnunPauses=0,jachnunBack=null,rexMounts=0,rexPauses=0,rexBack=null,soupMounts=0,soupPauses=0,soupBack=null,northMounts=0,northPauses=0,northBack=null,netoMounts=0,netoPauses=0,netoBack=null,rutiMounts=0,rutiPauses=0,rutiBack=null;const intervals=new Map(),nodes=new Map(),documentEvents=new Map(),requests=[],shared=[],copied=[],writes=[];
  const chickQuestions=makeChickQuiz(()=>.5);
  class Node{
    constructor(){this.handlers=new Map();this.dataset={};this.style={setProperty(){}};this.attributes={};this.disabled=false;this.hidden=false;this.complete=autoImages;this.naturalWidth=autoImages?100:0;this.textContent='';}
    addEventListener(kind,callback){this.handlers.set(kind,callback);}
    setAttribute(name,value){this.attributes[name]=value;}
    focus(){}
    select(){}
    scrollIntoView(){}
    getBoundingClientRect(){return {left:0,top:0,width:1000,height:700};}
    querySelector(selector){return selector==='[data-game-result]'?nodes.get('result'):selector==='.game-question-title'?nodes.get('heading'):null;}
    querySelectorAll(selector){return selector==='[data-game-option]'?this.options||[]:[];}
    set innerHTML(value){
      this.html=value;this.options=[];for(const match of value.matchAll(/id="([^"]+)"/g))if(!nodes.has(match[1]))nodes.set(match[1],new Node());if(!value.includes('id="familyGameTimer"'))return;
      const image=new Node(),timer=new Node(),seconds=new Node();seconds.textContent=value.match(/id="familyGameSeconds">(\d+)/)[1];
      nodes.set('familyGamePhoto',image);nodes.set('familyGameTimer',timer);nodes.set('familyGameSeconds',seconds);
      nodes.set('gameImageError',new Node());nodes.set('heading',new Node());
      this.options=[...value.matchAll(/data-game-option="([^"]+)" data-game-round="(\d+)"/g)].map(match=>{const node=new Node();node.dataset={gameOption:match[1],gameRound:match[2]};node.disabled=true;return node;});
    }
    get innerHTML(){return this.html||'';}
  }
  for(const id of ['familyGamesContent','gamesView','result','gameShareStatus','gameShareFallback'])nodes.set(id,new Node());
  nodes.get('gameShareFallback').hidden=true;
  const document={visibilityState:'visible',getElementById:id=>nodes.get(id),addEventListener:(kind,callback)=>documentEvents.set(kind,callback)};
  const browser=navigation?browserHistory(entryUrl||'https://family.test/?lang='+(english?'en-US':'he')+'#games'):null;let view='games';
  const window={location:browser?.location||{origin:'https://family.test',pathname:'/',href:entryUrl||'https://family.test/?media=private-image&lang=he#games'},FAMILY_API_TOKEN:'test',FamilyI18n:{isEnglish:english,language:english?'en-US':'he',personName:p=>english?p?.nameEn:p?.name,error:String,fetch:async(path,options)=>{requests.push(path);if(path.endsWith('/scores')){if(options?.method==='POST'){const body=JSON.parse(options.body);writes.push({path,body});if(scoreSaveFailures-->0)return {ok:false,json:async()=>({})};return {ok:true,json:async()=>({saved:true,rank:1,scores:[{id:body.requestId,name:body.name,score:body.score,correct:10,total:10,elapsedMs:body.answers.reduce((sum,a)=>sum+a.elapsedMs,0)}]})};}if(scoreLoadFailures-->0)return {ok:false,json:async()=>({})};return {ok:true,json:async()=>({scores:[],limit:20})};}if(options?.method==='POST'){const body=JSON.parse(options.body);writes.push({path,body});return {ok:true,json:async()=>({saved:true,language:body.language})};}const base=path.split('?')[0],selected=base.endsWith('relationships')?kinshipQuestions:base.endsWith('/trivia')?triviaQuestions:questions;return {ok:true,json:async()=>({questions:selected.slice(0,count).map(q=>customTrivia&&base.endsWith('/trivia')?{...q,subject:null,prompt:'שאלה מותאמת <script>',promptEn:'Custom question <script>'}:q),available:count,runId:count===10?'a'.repeat(32):null})};}},FamilyApp:{getView:()=> 'games'}};
  if(browser){
    window.addEventListener=browser.addEventListener;window.FamilyApp.getView=()=>view;
    window.FamilyApp.setView=(next,sync=true)=>{if(sync)window.FamilyNavigation.go('#'+next);view=next;window.FamilyGames?.activate(next);};
    browser.addEventListener('popstate',()=>{const next=browser.location.hash.slice(1).split('/')[0];if(next!==view)window.FamilyApp.setView(next,false);});
  }
  const navigator={clipboard:{async writeText(value){if(clipboardError)throw Error('Clipboard unavailable');copied.push(value);}}};
  if(nativeShare)navigator.share=async data=>{shared.push(data);if(shareError)throw Object.assign(Error('Share unavailable'),{name:shareError});};
  const FakeDate=class extends Date{static now(){return now;}};
  const context=vm.createContext({window,document,navigator,URL,location:browser?.location,history:browser?.history,matchMedia:()=>({matches:phone}),crypto:webcrypto,mountPuzzle(_root,onBack){puzzleMounts++;puzzleBack=onBack;},pausePuzzle(){puzzlePauses++;},mountJachnun(_root,onBack){jachnunMounts++;jachnunBack=onBack;},pauseJachnun(){jachnunPauses++;},mountRex(_root,onBack){rexMounts++;rexBack=onBack;},pauseRex(){rexPauses++;},mountSoup(_root,onBack){soupMounts++;soupBack=onBack;},pauseSoup(){soupPauses++;},mountNorth(_root,onBack){northMounts++;northBack=onBack;},pauseNorth(){northPauses++;},mountNetoTetris(_root,onBack){netoMounts++;netoBack=onBack;},pauseNetoTetris(){netoPauses++;},mountRutiHouse(_root,onBack){rutiMounts++;rutiBack=onBack;},pauseRutiHouse(){rutiPauses++;},quizGrade,QUIZ_ROUND_MS,quizScoreSummary,makeChickQuiz:()=>chickQuestions,withinChickTarget,Date:FakeDate,Image:class{},setInterval(callback,ms){const id=++intervalId;intervals.set(id,{callback,ms,next:now+ms});return id;},clearInterval:id=>intervals.delete(id)});
  if(browser)vm.runInContext(navigationSource,context);vm.runInContext(source,context);
  documentEvents.get('DOMContentLoaded')();
  const root=nodes.get('familyGamesContent'),flush=()=>new Promise(resolve=>setImmediate(resolve));
  async function click(selector,node={},detail=1,position={}){prevented=false;root.handlers.get('click')({...position,detail,preventDefault(){prevented=true;},target:{closest:s=>s===selector?node:null}});await flush();}
  return {window,browser,get view(){return view;},nodes,intervals,document,requests,shared,copied,writes,chickQuestions,get rutiMounts(){return rutiMounts;},get rutiPauses(){return rutiPauses;},backFromRuti(){rutiBack();},get netoMounts(){return netoMounts;},get netoPauses(){return netoPauses;},backFromNeto(){netoBack();},get northMounts(){return northMounts;},get northPauses(){return northPauses;},backFromNorth(){northBack();},get soupMounts(){return soupMounts;},get soupPauses(){return soupPauses;},backFromSoup(){soupBack();},get rexMounts(){return rexMounts;},get rexPauses(){return rexPauses;},backFromRex(){rexBack();},get jachnunMounts(){return jachnunMounts;},get jachnunPauses(){return jachnunPauses;},backFromJachnun(){jachnunBack();},get puzzleMounts(){return puzzleMounts;},get puzzlePauses(){return puzzlePauses;},backFromPuzzle(){puzzleBack();},get prevented(){return prevented;},get html(){return root.innerHTML;},get round(){return root.options?.[0]?.dataset.gameRound;},get seconds(){return nodes.get('familyGameSeconds')?.textContent;},
    messenger:()=>click('[data-game-share-messenger]'),
    openTrivia:()=>click('[data-game-start]',{dataset:{gameStart:'trivia',gameHome:'trivia'}}),
    click,input(id,value){nodes.get(id).value=value;root.handlers.get('input')({target:{id,value}});},
    correct(index){root.handlers.get('change')({target:{dataset:{triviaCorrect:String(index)}}});},
    async submit(selector='[data-trivia-question-form]'){root.handlers.get('submit')({preventDefault(){},target:{matches:s=>s===selector}});await flush();},
    find:(x,y)=>click('[data-game-find-stage]',nodes.get('chickSceneStage'),1,{clientX:x*1000,clientY:y*700}),
    next:()=>click('[data-game-find-next]'),
    zoom:()=>click('[data-game-find-zoom]',new Node()),
    keyboard(key){root.handlers.get('keydown')({key,preventDefault(){},target:{closest:s=>s==='[data-game-find-stage]'?nodes.get('chickSceneStage'):null}});},
    start:(game='photos')=>click('[data-game-start]',{dataset:{gameStart:game}}),lobby:()=>click('[data-game-lobby]'),choose:(id='p0',round=Number(root.options[0].dataset.gameRound),detail=1)=>click('[data-game-option]',{dataset:{gameOption:id,gameRound:String(round)}},detail),
    load(image=nodes.get('familyGamePhoto')){image.handlers.get('load')();},error(image=nodes.get('familyGamePhoto')){image.handlers.get('error')();},
    jump(ms){now+=ms;for(const interval of intervals.values())interval.next=Math.max(interval.next,now);},
    advance(ms){const target=now+ms;while(true){const due=[...intervals.entries()].sort((a,b)=>a[1].next-b[1].next)[0];if(!due||due[1].next>target)break;now=due[1].next;due[1].next+=due[1].ms;due[1].callback();}now=target;},
    visibility(value){document.visibilityState=value;documentEvents.get('visibilitychange')();}
  };
}
test('both languages omit the general lobby rules and hide age and gender selection criteria, including errors',async()=>{
  for(const english of [false,true]){
    const f=fixture({english,count:9});assert.doesNotMatch(f.html,/game-lobby-rules|מגדר|גילים|gender|similar ages/);
    await f.start();assert.match(f.html,/game-error/);assert.doesNotMatch(f.html,/מגדר|גילים|gender|similar ages/);
  }
});
test('the clock starts after the image loads and automatically advances at exactly fifteen seconds',async()=>{
  const f=fixture({autoImages:false});await f.start();assert.equal(f.intervals.size,0);f.advance(20000);assert.equal(f.round,'0');assert.equal(f.seconds,'15');
  f.load();assert.equal(f.intervals.size,1);f.advance(14900);assert.equal(f.round,'0');assert.equal(f.seconds,'1');
  f.advance(100);assert.equal(f.round,'1');assert.equal(f.seconds,'15');assert.equal(f.intervals.size,0,'The next photo must load before its clock begins');assert.doesNotMatch(f.html,/data-game-feedback|game-score/);
});
test('each answer advances immediately without correctness, score, or a next button; feedback appears only after ten rounds',async()=>{
  const f=fixture();await f.start();
  for(let i=0;i<10;i++){
    assert.equal(f.round,String(i));assert.doesNotMatch(f.html,/data-game-next|data-game-feedback|class="game-score"|game-option (?:correct|incorrect)/);
    await f.choose();
  }
  assert.match(f.html,/data-game-result/);assert.match(f.html,/<b>100%<\/b>/);assert.match(f.html,/10 תשובות נכונות מתוך 10/);assert.equal(f.intervals.size,0);f.advance(60000);assert.match(f.html,/<b>100%<\/b>/);
});
test('timeouts count as zero and all ten timed-out rounds finish with feedback only at the end',async()=>{
  const f=fixture();await f.start();f.advance(150000);assert.match(f.html,/data-game-result/);assert.match(f.html,/<strong>0<\/strong>/);assert.match(f.html,/10 תמונות הסתיימו ללא תשובה בזמן/);assert.equal(f.intervals.size,0);
});
test('a late answer, old image callback, stale click, or double click cannot score or skip an extra round',async()=>{
  const f=fixture();await f.start();const old=f.nodes.get('familyGamePhoto');f.jump(15001);await f.choose();assert.equal(f.round,'1');
  f.advance(5000);f.load(old);assert.equal(f.seconds,'10');await f.choose('p0',0);assert.equal(f.round,'1');await f.choose('p0',1,2);assert.equal(f.round,'1');
  for(let i=1;i<10;i++)await f.choose();assert.match(f.html,/<b>90%<\/b>/);assert.match(f.html,/תמונה אחת הסתיימה ללא תשובה בזמן/);
});
test('leaving the game stops callbacks, preserves the deadline, and only expires the current round when returning',async()=>{
  const f=fixture();await f.start();f.advance(5000);f.window.FamilyGames.activate('tree');assert.equal(f.intervals.size,0);f.jump(30000);f.window.FamilyGames.activate('games');assert.equal(f.round,'1');assert.equal(f.seconds,'15');assert.equal(f.intervals.size,1);
  f.visibility('hidden');assert.equal(f.intervals.size,0);f.jump(20000);f.visibility('visible');assert.equal(f.round,'2');assert.equal(f.seconds,'15');
});
test('failed photos do not consume time and a later successful load gets the full fifteen seconds',async()=>{
  const f=fixture({autoImages:false});await f.start();f.error();f.advance(30000);assert.equal(f.round,'0');assert.equal(f.intervals.size,0);f.load();assert.equal(f.seconds,'15');f.advance(1000);assert.equal(f.seconds,'14');
});
test('players can choose either game, and the relationship quiz shows two profiles and hides feedback until the end',async()=>{
  for(const english of [false,true]){
    const f=fixture({english});assert.match(f.html,/data-game-start="photos"/);assert.match(f.html,/data-game-start="kinship"/);
    await f.start('kinship');assert.equal(f.requests[0],'api/games/relationships');assert.equal(f.seconds,'15');assert.match(f.html,/src="\/media\/rivi"/);assert.match(f.html,/src="\/media\/eldad"/);
    for(let i=0;i<10;i++){assert.equal(f.round,String(i));assert.doesNotMatch(f.html,/kinship-review|class="game-score"|data-game-feedback/);await f.choose();}
    assert.match(f.html,/<b>100%<\/b>/);assert.match(f.html,/kinship-review/);assert.match(f.html,english?/Revital Gandelman is Eldad Keha’s first cousin/:/ריוי גנדלמן היא בת דודה של אלדד קהא/);assert.equal(f.intervals.size,0);
    await f.lobby();assert.match(f.html,/data-game-start="photos"/);assert.equal(f.intervals.size,0);await f.start('photos');assert.equal(f.requests.at(-1),'api/games/who-is-it');
  }
});
test('relationship timeouts advance without feedback and choosing another game clears the running clock',async()=>{
  const f=fixture();await f.start('kinship');f.advance(15000);assert.equal(f.round,'1');assert.doesNotMatch(f.html,/kinship-review|class="game-score"/);await f.lobby();assert.equal(f.intervals.size,0);f.advance(60000);assert.match(f.html,/family-game-choices/);
});
test('all four games provide a ten-question review and localized score sharing only at the end',async()=>{
  for(const english of [false,true])for(const game of ['photos','kinship','missing','trivia']){
    const f=fixture({english});for(const id of ['photos','kinship','missing','trivia'])assert.match(f.html,new RegExp('data-game-start="'+id+'"'));
    await f.start(game);assert.equal(f.requests.at(-1),'api/games/'+({photos:'who-is-it',kinship:'relationships',missing:'who-is-missing',trivia:'trivia'})[game]+(game==='trivia'?'?lang='+(english?'en-US':'he'):''));
    if(game==='missing')assert.match(f.html,english?/Who’s missing\?/:/מי חסר\?/);
    if(game==='trivia'){assert.match(f.html,english?/In which year was Revital/:/באיזו שנה נולדה ריוי/);assert.match(f.html,/src="\/media\/rivi"/);}
    for(let i=0;i<10;i++){assert.doesNotMatch(f.html,/game-result-sharing|data-game-review-question|class="game-score"/);await f.choose(i<6?'p0':'p1');}
    assert.equal((f.html.match(/data-game-review-question=/g)||[]).length,10);assert.match(f.html,/<b>60%<\/b>/);assert.match(f.html,/game-share-whatsapp/);assert.match(f.html,/game-share-email/);assert.match(f.html,/data-game-share-messenger/);
    if(['photos','missing'].includes(game)){assert.equal((f.html.match(/class="game-review-photo"/g)||[]).length,10);assert.match(f.html,/loading="lazy"/);}
    const href=f.html.match(/href="(https:\/\/wa\.me\/\?text=[^"]+)"/)[1],text=new URL(href).searchParams.get('text');assert.match(text,/1,200/);assert.match(text,english?/6 correct out of/:/6 תשובות נכונות/);assert.ok(text.includes('https://family.test/?lang='+(english?'en-US':'he')+'#games'));assert.doesNotMatch(text,/private-image|media=/);
    const email=f.html.match(/href="(mailto:[^"]+)"/)[1].replaceAll('&amp;','&'),params=new URLSearchParams(email.split('?')[1]);assert.equal(params.get('body'),text);assert.ok(params.get('subject'));
    assert.equal(f.intervals.size,0);
  }
});
test('the missing-person timer waits for photos and the trivia timer starts on the question',async()=>{
  const photo=fixture({autoImages:false});await photo.start('missing');photo.advance(20000);assert.equal(photo.round,'0');assert.equal(photo.intervals.size,0);photo.load();photo.advance(15000);assert.equal(photo.round,'1');assert.doesNotMatch(photo.html,/data-game-review-question/);
  const trivia=fixture({autoImages:false});await trivia.start('trivia');assert.equal(trivia.intervals.size,1);trivia.advance(150000);assert.match(trivia.html,/<strong>0<\/strong>/);assert.match(trivia.html,/10 שאלות הסתיימו/);assert.equal((trivia.html.match(/הזמן הסתיים ללא תשובה/g)||[]).length,10);
});
test('Messenger shares the complete result natively or copies it for the Messenger conversation',async()=>{
  for(const nativeShare of [true,false]){
    const f=fixture({nativeShare});await f.messenger();assert.equal(f.shared.length,0);assert.equal(f.copied.length,0);
    await f.start('missing');for(let i=0;i<10;i++)await f.choose();await f.messenger();
    if(nativeShare){assert.equal(f.prevented,true);assert.equal(f.shared.length,1);assert.match(f.shared[0].title,/מי חסר/);assert.match(f.shared[0].text,/2,000/);assert.equal(f.shared[0].url,'https://family.test/?lang=he#games/missing');}
    else{assert.equal(f.prevented,false,'The Messenger link opens via the normal user click');assert.equal(f.copied.length,1);assert.match(f.copied[0],/2,000/);assert.match(f.nodes.get('gameShareStatus').textContent,/התוצאה הועתקה/);}
  }
});
test('share cancellation stays quiet and unavailable sharing or clipboard exposes selectable result text',async()=>{
  for(const setup of [{nativeShare:true,shareError:'AbortError'},{nativeShare:true,shareError:'NotAllowedError'},{clipboardError:true}]){
    const f=fixture(setup);await f.start('trivia');for(let i=0;i<10;i++)await f.choose();await f.messenger();
    if(setup.shareError==='AbortError'){assert.equal(f.nodes.get('gameShareStatus').textContent,'');assert.equal(f.nodes.get('gameShareFallback').hidden,true);}
    else{assert.equal(f.nodes.get('gameShareFallback').hidden,false);assert.match(f.nodes.get('gameShareFallback').value,/2,000/);assert.match(f.nodes.get('gameShareFallback').value,/טריוויה משפחתית/);}
  }
});
test('missing-person games work with the available group photos and calculate score and sharing with the actual total',async()=>{
  const f=fixture({count:1});await f.start('missing');assert.match(f.html,/1 \/ 1/);await f.choose();assert.match(f.html,/<b>100%<\/b>/);assert.match(f.html,/1 תשובה נכונה מתוך 1/);assert.equal((f.html.match(/data-game-review-question=/g)||[]).length,1);
});
test('all four timed quizzes distinguish equally accurate fast and slow rounds without revealing points during play',async()=>{
  for(const game of ['photos','kinship','missing','trivia']){
    for(const [delay,expected] of [[1500,'1,900'],[7500,'1,500']]){
      const f=fixture();await f.start(game);
      for(let i=0;i<10;i++){f.advance(delay);assert.doesNotMatch(f.html,/class="game-score"|quiz-score-entry|data-game-review-question/);await f.choose();}
      assert.match(f.html,new RegExp('<strong>'+expected+'</strong>'));assert.match(f.html,/10 תשובות נכונות מתוך 10/);assert.match(f.html,/בונוס מהירות/);assert.match(f.html,/data-quiz-score-form/);assert.equal(f.requests.filter(path=>!path.endsWith('/scores')).length,1);
      f.input('quizScoreName','אלדד');await f.submit('[data-quiz-score-form]');const saved=f.writes.at(-1);assert.equal(saved.body.score,Number(expected.replace(',','')));assert.equal(saved.body.answers.length,10);assert.equal(saved.body.answers[0].elapsedMs,delay);assert.match(f.nodes.get('quizScoreEntry').innerHTML,/נשמרה/);
    }
  }
});
test('photo download time is excluded from speed points and short missing-person rounds do not enter the leaderboard',async()=>{
  const f=fixture({autoImages:false});await f.start('photos');
  for(let i=0;i<10;i++){f.advance(45000);f.load();f.advance(1500);await f.choose();}
  assert.match(f.html,/<strong>1,900<\/strong>/);f.input('quizScoreName','Player');await f.submit('[data-quiz-score-form]');assert.ok(f.writes[0].body.answers.every(a=>a.elapsedMs===1500));
  const practice=fixture({count:2});await practice.start('missing');await practice.choose();await practice.choose();assert.match(practice.html,/<strong>400<\/strong>/);assert.doesNotMatch(practice.html,/data-quiz-score-form/);assert.match(practice.html,/סיבוב אימון קצר/);
});
test('leaderboards can be viewed from the lobby and a failed score save keeps the same run and name for retry',async()=>{
  const f=fixture({scoreSaveFailures:1,scoreLoadFailures:1});assert.match(f.html,/data-quiz-board="trivia"/);
  await f.click('[data-quiz-board]',{dataset:{quizBoard:'trivia'}});assert.equal(f.requests.at(-1),'api/games/trivia/scores');assert.match(f.nodes.get('quizLeaderboard').innerHTML,/הטבלה לא נטענה/);
  await f.click('[data-quiz-refresh]',{dataset:{quizRefresh:'trivia'}});assert.match(f.nodes.get('quizLeaderboard').innerHTML,/הטבלה מחכה/);
  await f.start('trivia');for(let i=0;i<10;i++)await f.choose();f.input('quizScoreName','Player <script>');await f.submit('[data-quiz-score-form]');assert.match(f.nodes.get('quizScoreEntry').innerHTML,/התוצאה לא נשמרה/);assert.match(f.nodes.get('quizScoreEntry').innerHTML,/Player &lt;script&gt;/);
  await f.submit('[data-quiz-score-form]');assert.equal(f.writes.length,2);assert.deepEqual(f.writes[0],f.writes[1]);assert.match(f.nodes.get('quizScoreEntry').innerHTML,/נשמרה/);assert.match(f.nodes.get('quizLeaderboard').innerHTML,/Player &lt;script&gt;/);assert.doesNotMatch(f.nodes.get('quizLeaderboard').innerHTML,/<script>/);
  await f.submit('[data-quiz-score-form]');assert.equal(f.writes.length,2);
});
test('wrong fast answers and timeouts earn zero speed points',async()=>{
  const f=fixture();await f.start('kinship');for(let i=0;i<9;i++)await f.choose('p1');f.advance(15000);assert.match(f.html,/<strong>0<\/strong>/);assert.match(f.html,/0 תשובות נכונות מתוך 10/);f.input('quizScoreName','Player');await f.submit('[data-quiz-score-form]');assert.equal(f.writes[0].body.score,0);assert.equal(f.writes[0].body.answers.at(-1).selectedId,null);assert.equal(f.writes[0].body.answers.at(-1).elapsedMs,15000);
});
test('the illustrated hunt gives sixty seconds after the image loads and immediate feedback when a target is found',async()=>{
  for(const english of [false,true]){
    const f=fixture({english,autoImages:false});assert.match(f.html,/data-game-start="chick"/);await f.start('chick');assert.equal(f.requests.length,0);assert.equal(f.seconds,'60');assert.equal(f.intervals.size,0);assert.match(f.html,/chick-clue/);f.load();assert.equal(f.intervals.size,1);await f.find(0,0);assert.match(f.nodes.get('chickFeedback').textContent,english?/try again/:/נסו שוב/);
    for(let i=0;i<5;i++){const q=f.chickQuestions[i];if(i>0)f.load();assert.equal(f.seconds,'60');await f.find(q.target.x,q.target.y);assert.equal(f.intervals.size,0);assert.match(f.html,english?/Well done, you found/:/יפה מאוד, מצאת את/);assert.match(f.html,/chick-reveal-ring/);assert.doesNotMatch(f.html,/class="game-score"/);await f.next();}
    assert.match(f.html,/<strong>100<\/strong>/);assert.match(f.html,/5 correct answers|5 תשובות נכונות/);assert.equal((f.html.match(/data-game-review-question=/g)||[]).length,5);assert.match(f.html,/game-share-whatsapp/);
  }
});
test('hunt timeouts reveal one target, late clicks cannot score, and zoom or keyboard searching keeps the clock running',async()=>{
  const f=fixture();await f.start('chick');f.keyboard('ArrowRight');assert.equal(f.nodes.get('chickProbe').hidden,false);await f.zoom();assert.equal(f.nodes.get('chickSceneStage').style.width,'225%');f.advance(59900);assert.equal(f.seconds,'1');assert.doesNotMatch(f.html,/הזמן נגמר/);f.advance(100);assert.match(f.html,/הזמן נגמר/);assert.equal(f.intervals.size,0);await f.find(f.chickQuestions[0].target.x,f.chickQuestions[0].target.y);await f.next();
  for(let i=1;i<5;i++){const q=f.chickQuestions[i];await f.find(q.target.x,q.target.y);await f.next();}assert.match(f.html,/<strong>80<\/strong>/);await f.lobby();assert.equal(f.intervals.size,0);
});
test('three hunt mistakes score zero and automatically advance once, including after leaving and returning',async()=>{
  const f=fixture();await f.start('chick');
  for(let i=0;i<3;i++)await f.find(0,0);
  assert.match(f.html,/שלוש טעויות/);assert.match(f.html,/chick-reveal-ring/);assert.equal(f.intervals.size,1);
  f.advance(1100);assert.match(f.html,/שלוש טעויות/);
  f.window.FamilyGames.activate('tree');assert.equal(f.intervals.size,0);f.jump(5000);f.window.FamilyGames.activate('games');f.advance(100);assert.doesNotMatch(f.html,/שלוש טעויות/);
  for(let i=1;i<5;i++){const q=f.chickQuestions[i];await f.find(q.target.x,q.target.y);await f.next();}
  assert.match(f.html,/<strong>80<\/strong>/);assert.equal(f.intervals.size,0);
  await f.lobby();f.advance(10000);assert.match(f.html,/family-game-choices/);
});
test('trivia landing page saves a user question in the detected language with the selected correct answer',async()=>{
  const f=fixture();await f.openTrivia();assert.match(f.html,/data-trivia-question-form/);assert.match(f.html,/data-game-start="trivia"/);assert.equal(f.requests.length,0);
  f.input('triviaNewQuestion','Who immigrated to Israel in 1932?');assert.equal(f.nodes.get('triviaQuestionLanguage').value,'en');for(let i=0;i<4;i++)f.input('triviaAnswer'+i,['Shlomo','Yona','Ruth','Eldad'][i]);f.correct(0);await f.submit();assert.equal(f.writes.length,1);assert.equal(f.writes[0].body.language,'en');assert.equal(f.writes[0].body.correctIndex,0);assert.equal(f.writes[0].body.options[0],'Shlomo');assert.match(f.html,/השאלה נוספה למאגר/);assert.match(f.html,/רק במשחק באנגלית/);
});
test('English trivia landing and custom-question rounds stay localized and safely render text-only questions',async()=>{
  const f=fixture({english:true,customTrivia:true});await f.openTrivia();assert.match(f.html,/Add a family question/);assert.match(f.html,/English game/);f.input('triviaNewQuestion','מי עלה לארץ בשנת 1932?');assert.equal(f.nodes.get('triviaQuestionLanguage').value,'he');await f.start('trivia');assert.match(f.html,/Custom question &lt;script&gt;/);assert.doesNotMatch(f.html,/src="undefined"|<script>/);for(let i=0;i<10;i++)await f.choose();assert.match(f.html,/Custom question &lt;script&gt;/);assert.doesNotMatch(f.html,/src="undefined"/);
});

test('the puzzle opens its own bilingual platform without quiz requests and pauses when leaving games',async()=>{
  for(const english of [false,true]){
    const f=fixture({english});assert.match(f.html,english?/Family Puzzle/:/פאזל משפחתי/);
    await f.start('puzzle');assert.equal(f.puzzleMounts,1);assert.equal(f.requests.length,0);const before=f.puzzlePauses;
    f.window.FamilyGames.activate('tree');assert.ok(f.puzzlePauses>before);f.window.FamilyGames.activate('games');assert.equal(f.puzzleMounts,2);
    f.backFromPuzzle();assert.match(f.html,/data-game-start="puzzle"/);assert.equal(f.requests.length,0);
  }
});

test('Catch the Jachnun opens from both game lobbies, pauses on leaving and returns to the lobby',async()=>{
  for(const english of [false,true]){
    const f=fixture({english});assert.match(f.html,english?/Catch the Jachnun/:/תפוס תג׳חנון/);await f.start('jachnun');assert.equal(f.jachnunMounts,1);assert.equal(f.requests.length,0);
    const before=f.jachnunPauses;f.window.FamilyGames.activate('tree');assert.ok(f.jachnunPauses>before);f.window.FamilyGames.activate('games');assert.equal(f.jachnunMounts,2);f.backFromJachnun();assert.match(f.html,/data-game-start="jachnun"/);
  }
});

 test('Yemeanite Rex is available in both languages, detaches on navigation and returns to the lobby',async()=>{
  for(const english of [false,true]){const f=fixture({english});assert.match(f.html,english?/Yemeanite Rex/:/תימנירקס/);await f.start('rex');assert.equal(f.rexMounts,1);assert.equal(f.requests.length,0);const before=f.rexPauses;f.window.FamilyGames.activate('tree');assert.ok(f.rexPauses>before);f.window.FamilyGames.activate('games');assert.equal(f.rexMounts,2);f.backFromRex();assert.match(f.html,/data-game-start="rex"/);}
});

test('the secret soup game has a bilingual tile and independent kitchen lifecycle with no quiz requests',async()=>{
 for(const english of [false,true]){const f=fixture({english});assert.match(f.html,english?/The Secret Recipe/:/המתכון הסודי/);assert.match(f.html,english?/Crack the secret of Grandma Yona’s Yemeni soup/:/פצחו את סוד המרק התימני של סבתא יונה/);assert.deepEqual([...f.html.matchAll(/data-game-start="([^"]+)"/g)].map(m=>m[1]).slice(-2),['rex','soup']);await f.start('soup');assert.equal(f.soupMounts,1);assert.equal(f.requests.length,0);const pauses=f.soupPauses;f.window.FamilyGames.activate('tree');assert.ok(f.soupPauses>pauses);f.window.FamilyGames.activate('games');assert.equal(f.soupMounts,2);f.backFromSoup();assert.match(f.html,/data-game-start="soup"/);}
});

test('Shlomo’s bilingual dance can be paused and resumed without starting a game or issuing a request',async()=>{
  for(const english of [false,true]){const f=fixture({english});assert.match(f.html,/shlomo-dance-frames/);assert.match(f.html,english?/Let’s play!/:/בואו נשחק!/);assert.doesNotMatch(f.html,/game-lobby-rules/);const stage={dataset:{dancing:'true'}},button={closest:()=>stage,setAttribute(name,value){this[name]=value;}};await f.click('[data-shlomo-dance]',button);assert.equal(stage.dataset.dancing,'false');assert.equal(button['aria-pressed'],'false');assert.equal(button.textContent,english?'Resume dance':'ממשיכים לרקוד');await f.click('[data-shlomo-dance]',button);assert.equal(stage.dataset.dancing,'true');assert.equal(button['aria-pressed'],'true');assert.equal(f.requests.length,0);}
});

test('a direct recipe link opens the kitchen intro in either language once and still allows returning to game selection',async()=>{
 for(const english of [false,true]){
  const f=fixture({english,entryUrl:'https://family.test/?lang='+(english?'en-US':'he')+'&game=soup#games'});
  assert.equal(f.soupMounts,1);assert.equal(f.requests.length,0);f.backFromSoup();assert.match(f.html,/family-game-choices/);assert.equal(f.soupMounts,1);f.window.FamilyGames.activate('games');assert.equal(f.soupMounts,1);assert.match(f.html,/family-game-choices/);
 }
 const unknown=fixture({entryUrl:'https://family.test/?game=unknown#games'});assert.equal(unknown.soupMounts,0);assert.match(unknown.html,/family-game-choices/);assert.equal(unknown.requests.length,0);
});


test('Heading North opens its own bilingual memorial game, pauses on navigation and returns without quiz requests',async()=>{
  for(const english of [false,true]){
    const f=fixture({english});assert.match(f.html,english?/Heading North/:/נוסעים לצפון/);assert.match(f.html,/data-game-start="north"/);
    await f.start('north');assert.equal(f.northMounts,1);assert.equal(f.requests.length,0);
    const pauses=f.northPauses;f.window.FamilyGames.activate('tree');assert.ok(f.northPauses>pauses);
    f.window.FamilyGames.activate('games');assert.equal(f.northMounts,2);f.backFromNorth();
    assert.match(f.html,/family-game-choices/);assert.equal(f.requests.length,0);
  }
});

test('a direct northbound link opens once and still allows staying in the game selection lobby',()=>{
  for(const english of [false,true]){
    const f=fixture({english,entryUrl:'https://family.test/?lang='+(english?'en-US':'he')+'&game=north#games'});
    assert.equal(f.northMounts,1);assert.equal(f.requests.length,0);f.backFromNorth();
    assert.match(f.html,/family-game-choices/);f.window.FamilyGames.activate('games');assert.equal(f.northMounts,1);
  }
});


test('Hashmal Neto Tetris has a bilingual lobby tile and an independent lifecycle without quiz requests',async()=>{
  for(const english of [false,true]){
    const f=fixture({english});assert.match(f.html,english?/Neto.*Tetris/:/חשמל נטו טטריס/);assert.match(f.html,/data-game-start="neto-tetris"/);
    await f.start('neto-tetris');assert.equal(f.netoMounts,1);assert.equal(f.requests.length,0);assert.equal(f.intervals.size,0);
    const pauses=f.netoPauses;f.window.FamilyGames.activate('tree');assert.ok(f.netoPauses>pauses);assert.equal(f.intervals.size,0);
    f.window.FamilyGames.activate('games');assert.equal(f.netoMounts,2);f.backFromNeto();
    assert.match(f.html,/family-game-choices/);assert.match(f.html,/data-game-start="neto-tetris"/);assert.equal(f.requests.length,0);assert.equal(f.intervals.size,0);
  }
});

test('a direct Neto Tetris link opens once in either language and allows staying in the lobby afterward',()=>{
  for(const english of [false,true]){
    const f=fixture({english,entryUrl:'https://family.test/?lang='+(english?'en-US':'he')+'&game=neto-tetris#games'});
    assert.equal(f.netoMounts,1);assert.equal(f.northMounts,0);assert.equal(f.soupMounts,0);assert.equal(f.requests.length,0);assert.equal(f.intervals.size,0);
    f.backFromNeto();assert.match(f.html,/family-game-choices/);f.window.FamilyGames.activate('games');assert.equal(f.netoMounts,1);assert.equal(f.intervals.size,0);
  }
  const unknown=fixture({entryUrl:'https://family.test/?game=unknown#games'});assert.equal(unknown.netoMounts,0);assert.match(unknown.html,/family-game-choices/);
});

test('switching to Neto Tetris clears quiz clocks and switching away detaches its controller',async()=>{
  const f=fixture();await f.start('photos');assert.equal(f.intervals.size,1);assert.equal(f.requests.length,1);
  await f.start('neto-tetris');assert.equal(f.netoMounts,1);assert.equal(f.intervals.size,0);assert.equal(f.requests.length,1);
  f.advance(600000);assert.equal(f.intervals.size,0);assert.equal(f.netoMounts,1);
  f.backFromNeto();assert.match(f.html,/family-game-choices/);assert.equal(f.intervals.size,0);
  const pauses=f.netoPauses;await f.start('trivia');assert.ok(f.netoPauses>pauses);assert.equal(f.intervals.size,1);
  await f.start('neto-tetris');assert.equal(f.netoMounts,2);assert.equal(f.intervals.size,0);
  const detached=f.netoPauses;await f.start('north');assert.ok(f.netoPauses>detached);assert.equal(f.northMounts,1);assert.equal(f.intervals.size,0);
});


test('Ruti’s House opens from the bilingual lobby, stops quiz clocks and pauses when leaving',async()=>{
  for(const english of [false,true]){
    const f=fixture({english});assert.match(f.html,english?/Ruti’s House/:/הבית של רותי/);assert.match(f.html,/data-game-start="ruti-house"/);
    await f.start('photos');assert.equal(f.intervals.size,1);const requests=f.requests.length;
    await f.start('ruti-house');assert.equal(f.rutiMounts,1);assert.equal(f.intervals.size,0);assert.equal(f.requests.length,requests);
    const pauses=f.rutiPauses;f.window.FamilyGames.activate('tree');assert.ok(f.rutiPauses>pauses);f.window.FamilyGames.activate('games');assert.equal(f.rutiMounts,2);
    f.backFromRuti();assert.match(f.html,/family-game-choices/);assert.equal(f.intervals.size,0);
  }
});

test('a direct Ruti’s House link opens only once and allows returning to game selection',()=>{
  for(const english of [false,true]){
    const f=fixture({english,entryUrl:'https://family.test/?lang='+(english?'en-US':'he')+'&game=ruti-house#games'});
    assert.equal(f.rutiMounts,1);assert.equal(f.netoMounts,0);assert.equal(f.requests.length,0);
    f.backFromRuti();assert.match(f.html,/family-game-choices/);f.window.FamilyGames.activate('games');assert.equal(f.rutiMounts,1);
  }
});

test('browser and phone Back return every routed game to the lobby; Forward restores the selected game once',async()=>{
  const ids=['photos','kinship','missing','trivia','chick','puzzle','jachnun','rex','soup','north','neto-tetris','ruti-house'];
  for(const phone of [false,true])for(const english of [false,true])for(const game of ids){
    const f=fixture({navigation:true,phone,english});
    await f.start(game);assert.equal(f.browser.location.hash,'#games/'+game);
    const length=f.browser.history.length;
    f.browser.history.back();await f.browser.flush();
    assert.equal(f.view,'games');assert.equal(f.browser.location.hash,'#games');
    assert.match(f.html,/family-game-choices/);assert.equal(f.intervals.size,0);
    f.browser.history.forward();await f.browser.flush();
    assert.equal(f.view,'games');assert.equal(f.browser.location.hash,'#games/'+game);
    const mountKey={puzzle:'puzzleMounts',jachnun:'jachnunMounts',rex:'rexMounts',soup:'soupMounts',north:'northMounts','neto-tetris':'netoMounts','ruti-house':'rutiMounts'}[game];
    if(mountKey)assert.equal(f[mountKey],2,game);else assert.doesNotMatch(f.html,/family-game-choices/,game);
    assert.equal(f.browser.history.length,length);
    f.browser.history.back();await f.browser.flush();f.browser.history.back();await f.browser.flush();
    assert.equal(f.view,phone?'home':'tree');assert.equal(f.intervals.size,0);
  }
});

test('all game back buttons use the existing lobby entry and a second Back leaves games',async()=>{
  for(const [game,back]of [['puzzle','backFromPuzzle'],['jachnun','backFromJachnun'],['rex','backFromRex'],['soup','backFromSoup'],['north','backFromNorth'],['neto-tetris','backFromNeto'],['ruti-house','backFromRuti'],['photos','lobby'],['trivia','lobby'],['chick','lobby']]){
    const f=fixture({navigation:true,phone:true});await f.start(game);f[back]();await f.browser.flush();
    assert.equal(f.browser.location.hash,'#games');assert.match(f.html,/family-game-choices/);
    f.browser.history.back();await f.browser.flush();assert.equal(f.view,'home');
  }
});

test('direct game links and legacy links return to the lobby without reopening the game on another visit',async()=>{
  for(const game of ['soup','north','neto-tetris','ruti-house','puzzle','chick','trivia'])for(const legacy of [false,true]){
    const f=fixture({navigation:true,phone:true,entryUrl:'https://family.test/?lang=en-GB'+(legacy?'&game='+game+'#games':'#games/'+game)});
    await f.browser.flush();assert.equal(f.browser.location.hash,'#games/'+game);assert.doesNotMatch(f.html,/family-game-choices/);
    f.browser.history.back();await f.browser.flush();assert.match(f.html,/family-game-choices/);
    f.window.FamilyApp.setView('gallery');f.window.FamilyApp.setView('games');await f.browser.flush();
    assert.match(f.html,/family-game-choices/);assert.equal(f.browser.location.search,'?lang=en-GB');
  }
});

test('Back from another section restores the game route and one more Back restores its lobby',async()=>{
  const f=fixture({navigation:true,phone:true});await f.start('ruti-house');const mounts=f.rutiMounts;
  f.window.FamilyApp.setView('gallery');assert.equal(f.view,'gallery');
  f.browser.history.back();await f.browser.flush();assert.equal(f.browser.location.hash,'#games/ruti-house');
  assert.equal(f.rutiMounts,mounts+1,'popstate and hashchange must not mount twice');
  f.browser.history.back();await f.browser.flush();assert.match(f.html,/family-game-choices/);
});
