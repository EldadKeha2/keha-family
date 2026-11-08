import {EXTRA_FAMILY_GUESTS} from '../public/assets/ruti-house-guests.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RECIPES,TOOLS,POINTS,HOUSE_SLOTS,STAGES,firstStagePace,secondStagePace,createHouse,advanceHouse,advanceStage,selectTool,actHouse} from '../public/assets/ruti-house-engine.mjs';

const game=()=>createHouse({random:()=>.5});
const needed=t=>t.type==='guest'?(t.food||'serve'):({plant:'water',dust:'broom',cat:'hand'}[t.type]);
function clearTask(g,task=g.tasks[0],tool=needed(task)){assert.equal(selectTool(g,tool),true);return actHouse(g,task.id);}
function waterUntil(g,count){let attempts=0;while(g.stageCompleted<count&&g.phase==='playing'&&attempts++<12000){if(g.tasks.length)clearTask(g);else advanceHouse(g,.1);}assert.ok(attempts<12000);}
function finishStage(g){let attempts=0;while(['playing','ora-bonus'].includes(g.phase)&&attempts++<12000){if(g.phase==='ora-bonus')advanceHouse(g,5);else if(g.ora){selectTool(g,'argue');actHouse(g,g.ora.id);}else if(g.tasks.length)clearTask(g);else advanceHouse(g,.1);}assert.ok(attempts<12000);}
function atStage(level){const g=game();while(g.level<level){finishStage(g);assert.equal(advanceStage(g),true);}return g;}

test('the opening has four pots, thirty waterings and only the tools for its two tasks',()=>{
  assert.equal(HOUSE_SLOTS.plant,4);assert.equal(STAGES[0].goal,30);assert.deepEqual(STAGES[0].types,['plant','dust']);
  assert.deepEqual(TOOLS.map(t=>t.id),['water','broom','hand','argue','serve','peanuts']);assert.deepEqual(game().unlockedTools,['water','broom']);
  for(const s of STAGES){assert.ok(s.unlockedTools.length<=6);assert.ok(s.unlockedTools.every(id=>TOOLS.some(t=>t.id===id)));assert.deepEqual(s.unlockedRecipes,[]);assert.equal(s.requiredDish,null);}
  assert.equal(STAGES.find(s=>s.types.includes('guest')).level,6);assert.equal(STAGES[5].requiredMeal,true);
});

test('the first six waterings are relaxed, cover all four pots and do not end the lesson',()=>{
  const g=game(),slots=[];assert.equal(g.selected,null);assert.equal(firstStagePace(g).phase,0);
  for(let n=0;n<6;n++){
    assert.equal(g.tasks.length,1);const task=g.tasks[0];slots.push(task.slot);assert.equal(task.type,'plant');assert.equal(task.untimed,true);
    const initial=task.remaining;for(let minute=0;minute<3;minute++)advanceHouse(g,60);
    assert.equal(g.tasks[0],task);assert.equal(task.remaining,initial);assert.equal(g.stats.missed,0);assert.equal(g.strikes,0);
    clearTask(g);assert.equal(g.stageCompleted,n+1);assert.equal(g.phase,'playing');
    if(n<5)advanceHouse(g,2.3);
  }
  assert.deepEqual([...slots.slice(0,4)].sort(),[0,1,2,3]);assert.equal(firstStagePace(g).phase,1);
  assert.equal(g.stats.plants,6);assert.equal(g.completedLevels,0);
});

test('thirty successful household tasks combine watering and sweeping over the same four pots',()=>{
  const g=game();let swept=0,attempts=0;
  while(g.phase==='playing'&&attempts++<12000){
    if(!g.tasks.length){advanceHouse(g,.1);continue;}
    const task=g.tasks[0],before=g.stageCompleted;clearTask(g,task);
    if(task.type==='dust')swept++;assert.equal(g.stageCompleted,before+1);
  }
  assert.ok(attempts<12000);assert.ok(swept>0);assert.equal(g.stats.plants+g.stats.dust,30);assert.equal(g.wateredSlots.length,g.stats.plants);
  assert.ok(g.wateredSlots.every(slot=>slot>=0&&slot<4));assert.equal(new Set(g.wateredSlots).size,4);
  assert.equal(g.stageCompleted,30);assert.equal(g.phase,'stage-complete');assert.equal(g.completedLevels,1);
});

test('the long first level gradually introduces deadlines and two simultaneous requests',()=>{
  const g=game();waterUntil(g,6);advanceHouse(g,2.3);
  assert.equal(firstStagePace(g).maxActive,1);assert.equal(g.tasks.length,1);assert.ok(g.tasks.every(t=>!t.untimed));assert.equal(g.tasks[0].total,20);
  waterUntil(g,15);assert.equal(firstStagePace(g).phase,2);advanceHouse(g,6.1);
  assert.equal(g.tasks.length,2);assert.ok(g.tasks.every(t=>t.total===16||t.total===20));assert.equal(new Set(g.tasks.filter(t=>t.type==='plant').map(t=>t.slot)).size,g.tasks.filter(t=>t.type==='plant').length);
  waterUntil(g,24);assert.equal(firstStagePace(g).phase,3);const before=g.serial;advanceHouse(g,3.1);
  const newest=g.tasks.filter(t=>Number(t.id.split('-').at(-1))>before);assert.ok(newest.length);assert.ok(newest.every(t=>t.total===(t.type==='plant'?12:16)));
  assert.ok(g.tasks.length<=2);assert.deepEqual(g.events.filter(e=>e.type==='pace-up').map(e=>e.phase),[1,2,3]);
});

test('a missed flashing plant breaks the streak, then another chance can still complete all thirty waterings',()=>{
  const g=game();waterUntil(g,6);advanceHouse(g,2.3);const missed=g.tasks[0];assert.equal(missed.type,'plant');assert.ok(!missed.untimed);
  advanceHouse(g,missed.total);assert.ok(!g.tasks.includes(missed));assert.ok(g.stats.missed>0);assert.equal(g.stageCompleted,6);assert.equal(g.strikes,0);assert.equal(g.combo,0);
  assert.ok(g.events.some(e=>e.type==='missed'&&e.targetId===missed.id));finishStage(g);
  assert.equal(g.stats.plants+g.stats.dust+g.stats.missed,30);assert.equal(g.stageResolved,30);assert.equal(g.phase,'stage-complete');
});

test('random plant decks vary while avoiding duplicate active slots',()=>{
  const a=createHouse({random:()=>0}),b=createHouse({random:()=>.999});const deck=g=>[g.tasks[0].slot,...g.plantDeck];
  assert.notDeepEqual(deck(a),deck(b));assert.deepEqual([...deck(a)].sort(),[0,1,2,3]);assert.deepEqual([...deck(b)].sort(),[0,1,2,3]);
  waterUntil(a,15);for(let n=0;n<100;n++){advanceHouse(a,.5);const slots=a.tasks.filter(t=>t.type==='plant').map(t=>t.slot);assert.equal(new Set(slots).size,slots.length);assert.ok(a.tasks.length<=2);}
});

test('wrong and unavailable tools, recipe targets and duplicate clicks cannot skip tasks or gain points',()=>{
  const g=game(),id=g.tasks[0].id;assert.equal(selectTool(g,'broom'),true);assert.equal(selectTool(g,'fake'),false);assert.equal(actHouse(g,id).type,'wrong');assert.equal(g.score,0);assert.equal(g.stageCompleted,0);
  for(const id of ['bowl','knife','oven','peanuts','serve','hand'])assert.equal(selectTool(g,id),false);
  assert.equal(actHouse(g,'cook-tahini').type,'locked');clearTask(g);const score=g.score;assert.equal(actHouse(g,id),null);assert.equal(g.score,score);
});

test('one Food tool directly serves a random valid delicacy without picking up dishes or maintaining stock',()=>{
  const g=atStage(6);while(!g.tasks.some(t=>t.type==='guest'))advanceHouse(g,.1);const guest=g.tasks.find(t=>t.type==='guest');assert.equal(guest.type,'guest');assert.ok(RECIPES.some(r=>r.id===guest.recipeId));
  assert.ok(Object.values(g.inventory).every(n=>n===0));assert.equal(g.requiredMealComplete,false);const before=g.score;
  selectTool(g,'water');assert.equal(actHouse(g,guest.id).type,'wrong');const event=clearTask(g,guest,'serve');
  assert.equal(event.kind,'meal');assert.equal(event.recipeId,guest.recipeId);assert.equal(g.score-before,POINTS.meal*2);assert.equal(g.stats.meals,1);
  assert.equal(g.requiredMealComplete,true);assert.equal(g.lessonObjective.complete,true);assert.ok(Object.values(g.inventory).every(n=>n===0));
  assert.equal(selectTool(g,'peanuts'),false);assert.equal(g.stats.snacks,0);
});

test('served family and visitors keep separate seats without duplicating people or scoring twice',()=>{
 const g=atStage(11),ids=['roi','hila','rivi','lihi','visitor-man','visitor-hila','visitor-rivi','visitor-lihi'];
 for(const [index,guest] of ids.entries()){
  const task={id:`seat-${guest}`,type:'guest',guest,food:index<4?'serve':'peanuts',recipeId:index<4?'tahini':null,slot:0,door:index%2,total:28,remaining:28,createdAt:g.elapsed};
  g.tasks.push(task);g.stageIssued++;const before=g.guestsInside.length;
  selectTool(g,'water');assert.equal(actHouse(g,task.id).ok,false);assert.equal(g.guestsInside.length,before);
  clearTask(g,task);const resident=g.guestsInside.find(p=>p.guest===guest);assert.ok(resident);assert.equal(resident.lastServedAt,g.elapsed);
  const score=g.score;assert.equal(actHouse(g,task.id),null);assert.equal(g.score,score,'seating and duplicate clicks never award more points');
 }
 assert.equal(g.guestsInside.length,8);assert.equal(new Set(g.guestsInside.map(p=>p.guest)).size,8);assert.equal(new Set(g.guestsInside.map(p=>p.seat)).size,8);
 const seats=()=>g.guestsInside.map(({guest,seat,servedAt})=>({guest,seat,servedAt}));
 const seated=seats();assert.equal(seated.length,8);finishStage(g);assert.deepEqual(seats(),[]);assert.equal(advanceStage(g),true);assert.deepEqual(seats(),[]);
 assert.deepEqual(game().guestsInside,[],'a fresh game starts with an empty house');
});

test('only two random family guests can arrive per stage and a fed guest never asks again',()=>{
 const g=atStage(6),selected=[...g.stageGuestChoices],seen=new Set();let guard=0;
 assert.equal(selected.length,2);assert.equal(new Set(selected).size,2);
 while(['playing','ora-bonus'].includes(g.phase)&&guard++<10000){
  if(g.phase==='ora-bonus'){advanceHouse(g,5);continue;}
  if(g.ora){selectTool(g,'argue');actHouse(g,g.ora.id);continue;}
  for(const task of [...g.tasks]){if(task.type==='guest'){assert.ok(selected.includes(task.guest));assert.ok(!seen.has(task.guest));seen.add(task.guest);assert.ok(!task.resident);}clearTask(g,task);}
  advanceHouse(g,.1);
 }
 assert.ok(seen.size>=1&&seen.size<=2);assert.equal(g.stats.meals,seen.size);assert.ok([...seen].every(id=>g.familyVisits.includes(id)));
 assert.deepEqual(g.guestsInside,[]);assert.equal(advanceStage(g),true);assert.ok(g.stageGuestChoices.every(id=>!seen.has(id)));
});

test('the first four family visitors are followed by additional relatives without repeated admissions',()=>{
 const g=game();while(g.level<6){finishStage(g);advanceStage(g);}const admitted=[];
 while(g.level<=12){
  const choices=[...g.stageGuestChoices];assert.ok(choices.length<=2);assert.equal(new Set(choices).size,choices.length);
  for(const id of choices){assert.ok(!g.familyVisits.includes(id));if(admitted.length<4)assert.ok(['roi','hila','rivi','lihi'].includes(id));}
  const before=new Set(g.familyVisits);finishStage(g);admitted.push(...g.familyVisits.filter(id=>!before.has(id)));assert.deepEqual(g.guestsInside,[]);
  if(!advanceStage(g))break;
 }
 assert.ok(admitted.length>4);assert.equal(new Set(admitted).size,admitted.length);assert.ok(admitted.slice(4).every(id=>EXTRA_FAMILY_GUESTS.some(person=>person.id===id)));
});

test('cats use only doors before guests arrive and both windows become eligible from level six',()=>{
 const entries=new Set();
 for(let seed=1;seed<=8;seed++){
  let n=seed;const g=createHouse({random:()=>((n=(n*1664525+1013904223)>>>0)/2**32)});
  while(g.level<6){for(const t of g.tasks)if(t.type==='cat')assert.equal(t.window,undefined);finishStage(g);advanceStage(g);}
  let guard=0;while(['playing','ora-bonus'].includes(g.phase)&&guard++<10000){if(g.phase==='ora-bonus'){advanceHouse(g,5);continue;}if(g.ora){selectTool(g,'argue');actHouse(g,g.ora.id);continue;}for(const task of [...g.tasks]){if(task.type==='cat')entries.add(Number.isInteger(task.window)?'window'+task.window:'door'+task.door);clearTask(g,task);}advanceHouse(g,.1);}
 }
 assert.deepEqual(entries,new Set(['door0','door1','window0','window1']));
});

test('all serving stages stay completable without cooking tools or inventory',()=>{
  for(const n of [6,7,8,9,10,11,12]){const g=atStage(n);assert.equal(selectTool(g,'serve'),true);assert.ok(!g.unlockedTools.includes('bowl'));assert.deepEqual(g.unlockedRecipes,[]);finishStage(g);assert.equal(g.completedLevels,n);}
});

test('the first cats wait briefly and then visibly sneak toward a doorway over a generous response window',()=>{
  const g=atStage(3),cat=g.tasks[0];assert.equal(cat.type,'cat');assert.equal(cat.waiting,3);assert.equal(cat.remaining,38);
  advanceHouse(g,3);assert.equal(cat.state,'approaching');assert.equal(cat.waiting,0);assert.equal(cat.remaining,38);
  advanceHouse(g,10);assert.ok(Math.abs(cat.remaining-28)<1e-8);assert.equal(g.strikes,0);
  assert.deepEqual(g.stage.types,['cat','plant','dust']);assert.deepEqual(g.unlockedTools,['water','broom','hand']);
  clearTask(g,cat);assert.equal(g.stats.cats,1);assert.equal(g.strikes,0);
});

test('later stages respect concurrency, four fixed pots and shared doorways while difficulty rises',()=>{
  for(let n=2;n<=10;n++){
    const g=atStage(n);for(let k=0;k<100;k++){advanceHouse(g,.2);for(const cat of g.tasks.filter(t=>t.type==='cat'&&t.waiting===0&&t.remaining<1))clearTask(g,cat);assert.ok(g.tasks.length<=g.stage.maxActive);const doors=g.tasks.filter(t=>t.type==='cat'||t.type==='guest').map(t=>t.door);assert.equal(new Set(doors).size,doors.length);for(const type of ['plant','dust']){const slots=g.tasks.filter(t=>t.type===type).map(t=>t.slot);assert.equal(new Set(slots).size,slots.length);assert.ok(slots.length<=HOUSE_SLOTS[type]);}assert.ok(g.tasks.filter(t=>t.type==='plant').every(t=>t.slot<4));}
    assert.equal(g.level,n);
  }
  assert.ok(STAGES[7].deadlines.cat>STAGES[8].deadlines.cat&&STAGES[8].deadlines.cat>STAGES[9].deadlines.cat);assert.ok(STAGES[7].spawnDelay>STAGES[9].spawnDelay);
});

test('three cat entries end the run and prior strikes survive a completed stage',()=>{
  const g=atStage(3);for(let n=1;n<=2;n++){g.tasks=[{id:`cat-${n}`,type:'cat',slot:0,door:0,waiting:0,state:'approaching',total:.1,remaining:.1}];advanceHouse(g,.1);assert.equal(g.strikes,n);assert.equal(g.phase,'playing');}
  finishStage(g);advanceStage(g);assert.equal(g.level,4);assert.equal(g.strikes,2);g.tasks=[{id:'last-cat',type:'cat',slot:0,door:0,waiting:0,state:'approaching',total:.1,remaining:.1}];advanceHouse(g,.1);assert.equal(g.phase,'finished');assert.equal(g.strikes,3);assert.equal(g.won,false);assert.equal(g.completedLevels,3);const frozen=JSON.stringify(g);advanceHouse(g,60);advanceStage(g);actHouse(g,'cook-tahini');assert.equal(JSON.stringify(g),frozen);
});

test('all twelve stages retain exact score accounting, paused transition clocks and one win event',()=>{
  const g=game();for(let n=1;n<=12;n++){finishStage(g);assert.equal(g.completedLevels,n);assert.equal(g.stageCompleted,STAGES[n-1].goal);assert.ok(g.stageScores[n-1]>0);assert.equal(g.requiredDishComplete,true);if(n<12){assert.equal(g.phase,'stage-complete');const frozen=JSON.stringify(g);advanceHouse(g,60);assert.equal(JSON.stringify(g),frozen);assert.equal(advanceStage(g),true);}}
  assert.equal(g.phase,'finished');assert.equal(g.won,true);assert.equal(g.level,12);assert.equal(g.stageScores.reduce((a,b)=>a+b,0),g.score);assert.equal(g.events.filter(e=>e.type==='finished').length,1);assert.equal(advanceStage(g),false);
});

test('invalid deltas preserve clocks and split frames produce the same tutorial task',()=>{
  const g=game();for(const dt of [0,-1,NaN,Infinity,undefined])advanceHouse(g,dt);assert.equal(g.elapsed,0);const a=game(),b=game();advanceHouse(a,7);for(let n=0;n<70;n++)advanceHouse(b,.1);assert.equal(a.elapsed,b.elapsed);assert.deepEqual(a.tasks,b.tasks);
});


test('level two repeats thirty waterings and sweeping at a substantially faster pace without a relaxed opening',()=>{
 const g=game();finishStage(g);const openingElapsed=g.stageElapsed,plantsBefore=g.stats.plants;
 assert.equal(advanceStage(g),true);assert.equal(g.level,2);assert.equal(g.stage.goal,30);
 assert.deepEqual(g.stage.types,['plant','dust']);assert.deepEqual(g.unlockedTools,['water','broom']);assert.equal(g.stage.newFeature,null);
 assert.equal(g.tasks[0].type,'plant');assert.equal(g.tasks[0].untimed,undefined);assert.equal(g.tasks[0].total,11);
 const initialPace=secondStagePace(g);assert.equal(initialPace.maxActive,2);assert.equal(initialPace.spawnDelay,1.2);
 const slots=[],sweeps=[];let guard=0;
 while(g.phase==='playing'&&guard++<3000){
  if(!g.tasks.length){advanceHouse(g,.1);continue;}
  const task=g.tasks[0],before=g.stageCompleted;
  if(task.type==='plant')slots.push(task.slot);else sweeps.push(task.id);
  clearTask(g,task);
  assert.equal(g.stageCompleted,before+1);
  if(g.stageCompleted>=15&&g.phase==='playing'){const faster=secondStagePace(g);assert.equal(faster.maxActive,3);assert.equal(faster.plant,9);assert.equal(faster.dust,12);assert.equal(faster.spawnDelay,1);}
 }
 assert.ok(guard<3000);assert.equal(g.stats.plants-plantsBefore+sweeps.length,30);assert.equal(slots.length,g.stats.plants-plantsBefore);assert.equal(new Set(slots).size,4);assert.ok(sweeps.length>0);
 assert.ok(g.stageElapsed<openingElapsed*.65,'the repeated stage should finish substantially faster at the same perfect-response speed');assert.equal(g.completedLevels,2);
});

test('only stage three introduces cats, both entrances get visitors, and stage four repeats the same tasks faster',()=>{
 for(const plan of STAGES.slice(0,2))assert.ok(!plan.types.includes('cat'));
 assert.equal(STAGES[2].newFeature,'cat');assert.equal(STAGES[3].newFeature,null);
 assert.deepEqual(STAGES[3].types,STAGES[2].types);assert.deepEqual(STAGES[3].unlockedTools,[...STAGES[2].unlockedTools,'argue']);
 assert.equal(STAGES[3].goal,30);assert.equal(STAGES[2].goal,30);assert.ok(STAGES[3].maxActive>STAGES[2].maxActive);assert.ok(STAGES[3].spawnDelay<STAGES[2].spawnDelay);
 for(const kind of ['cat','plant','dust'])assert.ok(STAGES[3].deadlines[kind]<STAGES[2].deadlines[kind]);
 for(const level of [3,4]){
  const g=atStage(level),doors=[];let guard=0;
  while(g.phase==='playing'&&guard++<3000){if(!g.tasks.length){advanceHouse(g,.1);continue;}const t=g.tasks[0];if(t.type==='cat')doors.push(t.door);clearTask(g,t);}
  assert.ok(guard<3000);assert.deepEqual(new Set(doors),new Set([0,1]));
  assert.ok(doors.every((door,index)=>index===0||door!==doors[index-1]),'cats use the other available entrance on their next visit');
 }
});

test('faster responses earn progressively more points at the same success streak',()=>{
  const scores=[];
  for(const delay of [0,5,10,19.5]){
    const g=game(),task=g.tasks[0];advanceHouse(g,delay);
    const result=clearTask(g,task);scores.push(result.points);
    assert.equal(result.responseSeconds,delay);assert.equal(result.combo,1);
    assert.equal(g.score,result.points);assert.equal(g.stageScores[0],result.points);
  }
  assert.deepEqual(scores,[80,70,60,41]);
});

test('reaction bonus uses the correct click time rather than walking time and pauses freeze its clock',()=>{
  const g=game(),task=g.tasks[0];advanceHouse(g,2);
  selectTool(g,'broom');assert.equal(actHouse(g,task.id).ok,false);
  selectTool(g,'water');const clickedAt=g.elapsed;
  // Animate a long walk after the accepted response.
  advanceHouse(g,8);const result=actHouse(g,task.id,{respondedAt:clickedAt});
  assert.equal(result.responseSeconds,2);assert.equal(result.points,76);
  assert.equal(actHouse(g,task.id,{respondedAt:clickedAt}),null);
  // No active-game ticks are delivered while paused; wall time is irrelevant.
  const paused=game(),pausedTask=paused.tasks[0];advanceHouse(paused,2);
  advanceHouse(paused,0);assert.equal(clearTask(paused,pausedTask).points,76);
});

test('dust, cats and guests all receive speed bonuses, including the cat waiting window',()=>{
  for(const [level,type,kind] of [[2,'dust','dust'],[3,'cat','cat'],[6,'guest','meal']]){
    const g=atStage(level);let attempts=0;
    while(!g.tasks.some(t=>t.type===type)&&attempts++<1000){if(type!=='guest'&&g.tasks.length)clearTask(g);else advanceHouse(g,.1);}
    const task=g.tasks.find(t=>t.type===type);assert.ok(task);
    g.combo=0;g.comboRemaining=0;
    const delay=2;advanceHouse(g,delay);const result=clearTask(g,task);
    assert.equal(result.kind,kind);assert.equal(result.responseSeconds,delay);
    assert.ok(result.points>POINTS[kind]&&result.points<POINTS[kind]*2);
    if(type==='cat')assert.equal(result.speedMultiplier,1+(1-delay/(task.total+task.waitingTotal)));
  }
});

test('every level caps issued tasks at thirty and resets its per-type success counts',()=>{
 const g=game();
 for(let level=1;level<=12;level++){
  const total=()=>['plants','dust','cats','meals','snacks','oraWins'].reduce((n,k)=>n+g.stats[k],0),initial=total();assert.equal(g.stage.goal,30);assert.ok(Object.values(g.stageStats).every(n=>n===0));let guard=0;
  while(['playing','ora-bonus'].includes(g.phase)&&guard++<15000){
   if(g.phase==='ora-bonus'){advanceHouse(g,5);continue;}if(g.ora){selectTool(g,'argue');actHouse(g,g.ora.id);continue;}
   if(g.tasks.length){const task=g.tasks[0],before=g.stageCompleted;clearTask(g,task);assert.equal(g.stageCompleted,before+1);}
   else advanceHouse(g,.2);
  }
  assert.ok(guard<15000);assert.equal(g.stageCompleted,30);assert.equal(total()-initial,30);assert.equal(Object.values(g.stageStats).reduce((a,b)=>a+b,0),30);
  if(level<12)assert.equal(advanceStage(g),true);
 }
 assert.equal(['plants','dust','cats','meals','snacks','oraWins'].reduce((n,k)=>n+g.stats[k],0),360);assert.ok(g.stats.plants<360);assert.equal(g.won,true);
});

function findOra(g){let guard=0;while(!g.ora&&g.phase==='playing'&&guard++<15000){if(g.tasks.length)clearTask(g);else advanceHouse(g,.1);}assert.ok(g.ora,'Ora appears before level completion');return g.ora;}

test('Ora starts after ten or more tasks in level four, appears once per level and has a shorter later window',()=>{
 const thresholds=new Set();
 for(const random of [()=>0,()=>.5,()=>.999]){
  const g=createHouse({random});while(g.level<4){finishStage(g);advanceStage(g);}
  thresholds.add(g.oraAt);assert.ok(g.oraAt>=10&&g.oraAt<=22);waterUntil(g,9);assert.equal(g.ora,null);assert.equal(selectTool(g,'argue'),false);
  const ora=findOra(g);assert.equal(g.stageCompleted,g.oraAt);assert.equal(ora.total,6);
  advanceHouse(g,ora.total+.01);assert.equal(g.ora,null);assert.equal(g.stats.oraWins,0);assert.equal(g.phase,'playing');finishStage(g);assert.equal(g.events.filter(e=>e.type==='ora-spawn').length,1);
 }
 assert.equal(thresholds.size,3);
 const later=atStage(10);assert.ok(findOra(later).total<2);
});

test('Ora requires icon then head, pays exactly 5000 once, and freezes all household clocks during the five-second countdown',()=>{
 const g=atStage(4),ora=findOra(g),before=g.score,stageScore=g.stageScores[3],progress=g.stageCompleted;
 selectTool(g,'water');assert.equal(actHouse(g,ora.id).ok,false);assert.equal(g.score,before);
 selectTool(g,'argue');assert.equal(g.score,before,'choosing the icon alone earns no points');assert.equal(g.ora,ora);const result=actHouse(g,ora.id);assert.equal(result.points,5000);assert.equal(g.score-before,5000);assert.equal(g.stageScores[3]-stageScore,5000);assert.equal(g.stats.oraWins,1);assert.equal(g.stageCompleted,progress+1);assert.equal(g.stageStats.oraWins,1);assert.equal(g.phase,'ora-bonus');
 const clocks=JSON.stringify({elapsed:g.elapsed,stageElapsed:g.stageElapsed,tasks:g.tasks,combo:g.comboRemaining});
 advanceHouse(g,2);assert.equal(g.oraBonusRemaining,3);assert.equal(actHouse(g,ora.id),null);
 advanceHouse(g,2.99);assert.equal(g.phase,'ora-bonus');assert.equal(g.oraBonusRemaining,.01);
 advanceHouse(g,.01);assert.equal(g.phase,'playing');assert.equal(g.oraBonusRemaining,0);assert.equal(g.stats.oraWins,1);
 assert.equal(JSON.stringify({elapsed:g.elapsed,stageElapsed:g.stageElapsed,tasks:g.tasks,combo:g.comboRemaining}),clocks);
 advanceHouse(g,.1);assert.ok(g.elapsed>JSON.parse(clocks).elapsed);
});

test('cat appearances vary in coat and size while each live cat keeps its own appearance',()=>{
 let seed=7;const random=()=>((seed=(seed*1664525+1013904223)>>>0)/2**32),g=createHouse({random});
 while(g.level<3){finishStage(g);advanceStage(g);}
 const coats=new Set(),sizes=new Set();let cats=0,guard=0;
 while(cats<20&&guard++<15000){
  if(g.tasks.length){const task=g.tasks[0];if(task.type==='cat'){cats++;coats.add(task.coat);sizes.add(task.size);const appearance={coat:task.coat,size:task.size};advanceHouse(g,.1);assert.deepEqual({coat:task.coat,size:task.size},appearance);}clearTask(g,task);}
  else advanceHouse(g,.2);
  if(g.phase==='stage-complete')advanceStage(g);
 }
 assert.equal(cats,20);assert.ok(coats.size>=4);assert.equal(sizes.size,3);
});

test('Ora can complete the thirtieth task, with level completion delayed until the bonus countdown ends',()=>{
 const g=atStage(4),ora=findOra(g);ora.remaining=100;waterUntil(g,29);
 selectTool(g,'argue');actHouse(g,ora.id);assert.equal(g.stageCompleted,30);assert.equal(g.phase,'ora-bonus');assert.equal(g.completedLevels,3);
 advanceHouse(g,5);assert.equal(g.phase,'stage-complete');assert.equal(g.completedLevels,4);assert.equal(Object.values(g.stageStats).reduce((a,b)=>a+b,0),30);
});

test('thirty resolved tasks include misses, never issue a thirty-first task and display only successes',()=>{
 const g=game();waterUntil(g,6);const initialMissed=g.stats.missed;
 for(let guard=0;g.phase==='playing'&&guard<10000;guard++)advanceHouse(g,1);
 assert.equal(g.phase,'stage-complete');assert.equal(g.stageIssued,30);assert.equal(g.stageResolved,30);assert.equal(g.stageCompleted,6);assert.equal(g.stats.missed-initialMissed,24);assert.equal(g.tasks.length,0);
 assert.equal(Object.values(g.stageStats).reduce((a,b)=>a+b,0),6);
 advanceStage(g);assert.equal(g.stageCompleted,0);assert.equal(g.stageResolved,0);
 for(let guard=0;g.phase==='playing'&&guard<10000;guard++)advanceHouse(g,1);
 assert.equal(g.stageIssued,30);assert.equal(g.stageResolved,30);assert.equal(g.stageCompleted,0);assert.equal(g.completedLevels,2);
});

test('stage five repeats stage four faster, without meals, and Ora favors the visible periphery',()=>{
 assert.equal(STAGES.length,12);const [four,five]=STAGES.slice(3,5);
 assert.deepEqual(five.unlockedTools,four.unlockedTools);assert.ok(!five.types.includes('guest'));assert.equal(five.guestMode,null);
 assert.ok(five.spawnDelay<four.spawnDelay);for(const type of ['plant','dust','cat'])assert.ok(five.deadlines[type]<four.deadlines[type]);
 const fourth=findOra(atStage(4)),fifth=findOra(atStage(5));assert.ok(fifth.total<fourth.total);
 let peripheral=0;
 for(let seed=1;seed<=100;seed++){
  let state=seed;const g=createHouse({random:()=>((state=(state*1664525+1013904223)>>>0)/2**32)});
  while(g.level<4){finishStage(g);advanceStage(g);}const {x,y}=findOra(g).position;
  if(x<.17||x>.83||y<.36||y>.84)peripheral++;
 }
 assert.ok(peripheral>=72&&peripheral<=96,`${peripheral}/100 peripheral appearances`);
});

test('cats that get inside persist with their own coat and size into the following stage',()=>{
 const g=atStage(3),cat=g.tasks[0];cat.waiting=0;cat.remaining=.01;const appearance={coat:cat.coat,size:cat.size};advanceHouse(g,.1);
 assert.equal(g.catsInside.length,1);const resident=g.catsInside[0];assert.equal(resident.id,cat.id);assert.deepEqual({coat:resident.coat,size:resident.size},appearance);assert.equal(resident.enteredAt,g.elapsed);
 finishStage(g);advanceStage(g);assert.equal(g.catsInside[0],resident);assert.equal(g.strikes,1);
});

test('feeding is rare, randomly scheduled after fifteen seconds and distinguishes family from other visitors',()=>{
 const arrivals=[],foods=new Set(),identities=new Set();
 for(let seed=20;seed<84;seed++){
  let state=seed;const g=createHouse({random:()=>((state=(state*1664525+1013904223)>>>0)/2**32)});
  while(g.level<11){finishStage(g);advanceStage(g);}const stageStart=g.elapsed,seen=new Set();
  while(['playing','ora-bonus'].includes(g.phase)){
   if(g.phase==='ora-bonus'){advanceHouse(g,5);continue;}
   if(g.ora){selectTool(g,'argue');actHouse(g,g.ora.id);continue;}
   for(const task of [...g.tasks]){
    if(task.type==='guest'){
     if(!seen.has(task.id)){arrivals.push(task.createdAt-stageStart);seen.add(task.id);}
     foods.add(task.food);identities.add(task.guest);assert.ok(task.createdAt-stageStart>=15);
     selectTool(g,task.food==='peanuts'?'serve':'peanuts');assert.equal(actHouse(g,task.id).type,'wrong');assert.ok(g.tasks.includes(task));
     const event=clearTask(g,task);assert.equal(event.kind,task.food==='peanuts'?'snack':'meal');
    }else clearTask(g,task);
   }
   advanceHouse(g,.1);
  }
  assert.ok(seen.size>=1&&seen.size<=3,'guests are occasional, not part of the regular task sequence');assert.equal(g.stageResolved,30);
 }
 assert.ok(new Set(arrivals.map(n=>n.toFixed(1))).size>10,'arrival times vary between runs');assert.deepEqual(foods,new Set(['serve','peanuts']));assert.ok([...identities].some(id=>EXTRA_FAMILY_GUESTS.some(p=>p.id===id)));assert.ok(identities.size>=8);
});

test('Ora expiry resolves one of the thirty tasks without adding a household success or cat strike',()=>{
 const g=atStage(4),ora=findOra(g),resolved=g.stageResolved,completed=g.stageCompleted,missed=g.stats.missed;
 // Preserve other issued tasks while this deliberately missed bonus expires.
 for(const task of g.tasks)task.untimed=true;
 advanceHouse(g,ora.total);assert.equal(g.stageResolved,resolved+1);assert.equal(g.stageCompleted,completed);assert.equal(g.stats.missed,missed+1);assert.equal(g.strikes,0);
 finishStage(g);assert.equal(g.stageResolved,30);assert.equal(g.stageCompleted,29);assert.equal(g.stageIssued,30);
});
