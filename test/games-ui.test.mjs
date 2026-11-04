import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {quizGrade} from '../public/assets/quiz.mjs';

const source=(await readFile(new URL('../public/assets/games.js',import.meta.url),'utf8')).replace(/^import[^\n]+\n/gm,'');
const questions=Array.from({length:10},(_,i)=>({id:'photo-'+i,src:'/media/photo-'+i,correctId:'p0',options:Array.from({length:4},(_,j)=>({id:'p'+j,name:'אדם '+j,nameEn:'Person '+j}))}));
const kinshipQuestions=questions.map(q=>({...q,kind:'kinship',subject:{id:'rivi',name:'ריוי גנדלמן',nameEn:'Revital Gandelman',gender:'f',profile:'/media/rivi'},reference:{id:'eldad',name:'אלדד קהא',nameEn:'Eldad Keha',gender:'m',profile:'/media/eldad'},options:[{id:'p0',name:'בת דודה',nameEn:'First cousin'},{id:'p1',name:'אחות',nameEn:'Sister'},{id:'p2',name:'אחיינית',nameEn:'Niece'},{id:'p3',name:'נכדה',nameEn:'Granddaughter'}]}));
function fixture({english=false,autoImages=true,count=10}={}){
  let now=100000,intervalId=0;const intervals=new Map(),nodes=new Map(),documentEvents=new Map(),requests=[];
  class Node{
    constructor(){this.handlers=new Map();this.dataset={};this.style={setProperty(){}};this.attributes={};this.disabled=false;this.hidden=false;this.complete=autoImages;this.naturalWidth=autoImages?100:0;this.textContent='';}
    addEventListener(kind,callback){this.handlers.set(kind,callback);}
    setAttribute(name,value){this.attributes[name]=value;}
    focus(){}
    querySelector(selector){return selector==='[data-game-result]'?nodes.get('result'):selector==='.game-question-title'?nodes.get('heading'):null;}
    querySelectorAll(selector){return selector==='[data-game-option]'?this.options||[]:[];}
    set innerHTML(value){
      this.html=value;this.options=[];if(!value.includes('id="familyGameTimer"'))return;
      const image=new Node(),timer=new Node(),seconds=new Node();seconds.textContent='15';
      nodes.set('familyGamePhoto',image);nodes.set('familyGameTimer',timer);nodes.set('familyGameSeconds',seconds);
      nodes.set('gameImageError',new Node());nodes.set('heading',new Node());
      this.options=[...value.matchAll(/data-game-option="([^"]+)" data-game-round="(\d+)"/g)].map(match=>{const node=new Node();node.dataset={gameOption:match[1],gameRound:match[2]};node.disabled=true;return node;});
    }
    get innerHTML(){return this.html||'';}
  }
  for(const id of ['familyGamesContent','gamesView','result'])nodes.set(id,new Node());
  const document={visibilityState:'visible',getElementById:id=>nodes.get(id),addEventListener:(kind,callback)=>documentEvents.set(kind,callback)};
  const window={FamilyI18n:{isEnglish:english,personName:p=>english?p.nameEn:p.name,error:String,fetch:async path=>{requests.push(path);return {ok:true,json:async()=>({questions:(path.endsWith('relationships')?kinshipQuestions:questions).slice(0,count),available:count})};}},FamilyApp:{getView:()=> 'games'}};
  const FakeDate=class extends Date{static now(){return now;}};
  vm.runInNewContext(source,{window,document,quizGrade,Date:FakeDate,Image:class{},setInterval(callback,ms){const id=++intervalId;intervals.set(id,{callback,ms,next:now+ms});return id;},clearInterval:id=>intervals.delete(id)});
  documentEvents.get('DOMContentLoaded')();
  const root=nodes.get('familyGamesContent'),flush=()=>new Promise(resolve=>setImmediate(resolve));
  async function click(selector,node={},detail=1){root.handlers.get('click')({detail,target:{closest:s=>s===selector?node:null}});await flush();}
  return {window,nodes,intervals,document,requests,get html(){return root.innerHTML;},get round(){return root.options?.[0]?.dataset.gameRound;},get seconds(){return nodes.get('familyGameSeconds')?.textContent;},
    start:(game='photos')=>click('[data-game-start]',{dataset:{gameStart:game}}),lobby:()=>click('[data-game-lobby]'),choose:(id='p0',round=Number(root.options[0].dataset.gameRound),detail=1)=>click('[data-game-option]',{dataset:{gameOption:id,gameRound:String(round)}},detail),
    load(image=nodes.get('familyGamePhoto')){image.handlers.get('load')();},error(image=nodes.get('familyGamePhoto')){image.handlers.get('error')();},
    jump(ms){now+=ms;for(const interval of intervals.values())interval.next=Math.max(interval.next,now);},
    advance(ms){const target=now+ms;while(true){const due=[...intervals.entries()].sort((a,b)=>a[1].next-b[1].next)[0];if(!due||due[1].next>target)break;now=due[1].next;due[1].next+=due[1].ms;due[1].callback();}now=target;},
    visibility(value){document.visibilityState=value;documentEvents.get('visibilitychange')();}
  };
}
test('both languages explain fifteen seconds and hide age and gender selection rules, including errors',async()=>{
  for(const english of [false,true]){
    const f=fixture({english,count:9});assert.match(f.html,/15/);assert.doesNotMatch(f.html,/מגדר|גילים|gender|similar ages/);
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
  assert.match(f.html,/data-game-result/);assert.match(f.html,/<strong>100<\/strong>/);assert.match(f.html,/10 תשובות נכונות מתוך 10/);assert.equal(f.intervals.size,0);f.advance(60000);assert.match(f.html,/<strong>100<\/strong>/);
});
test('timeouts count as zero and all ten timed-out rounds finish with feedback only at the end',async()=>{
  const f=fixture();await f.start();f.advance(150000);assert.match(f.html,/data-game-result/);assert.match(f.html,/<strong>0<\/strong>/);assert.match(f.html,/10 תמונות הסתיימו ללא תשובה בזמן/);assert.equal(f.intervals.size,0);
});
test('a late answer, old image callback, stale click, or double click cannot score or skip an extra round',async()=>{
  const f=fixture();await f.start();const old=f.nodes.get('familyGamePhoto');f.jump(15001);await f.choose();assert.equal(f.round,'1');
  f.advance(5000);f.load(old);assert.equal(f.seconds,'10');await f.choose('p0',0);assert.equal(f.round,'1');await f.choose('p0',1,2);assert.equal(f.round,'1');
  for(let i=1;i<10;i++)await f.choose();assert.match(f.html,/<strong>90<\/strong>/);assert.match(f.html,/תמונה אחת הסתיימה ללא תשובה בזמן/);
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
    assert.match(f.html,/<strong>100<\/strong>/);assert.match(f.html,/kinship-review/);assert.match(f.html,english?/Revital Gandelman is Eldad Keha’s first cousin/:/ריוי גנדלמן היא בת דודה של אלדד קהא/);assert.equal(f.intervals.size,0);
    await f.lobby();assert.match(f.html,/data-game-start="photos"/);assert.equal(f.intervals.size,0);await f.start('photos');assert.equal(f.requests.at(-1),'api/games/who-is-it');
  }
});
test('relationship timeouts advance without feedback and choosing another game clears the running clock',async()=>{
  const f=fixture();await f.start('kinship');f.advance(15000);assert.equal(f.round,'1');assert.doesNotMatch(f.html,/kinship-review|class="game-score"/);await f.lobby();assert.equal(f.intervals.size,0);f.advance(60000);assert.match(f.html,/family-game-choices/);
});
