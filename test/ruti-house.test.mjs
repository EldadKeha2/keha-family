import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RECIPES,TOOLS,POINTS,HOUSE_SLOTS,STAGES,firstStagePace,createHouse,advanceHouse,advanceStage,selectTool,actHouse} from '../public/assets/ruti-house-engine.mjs';

const game=()=>createHouse({random:()=>.5});
const needed=t=>({plant:'water',dust:'broom',cat:'hand',guest:'serve'}[t.type]);
function clearTask(g,task=g.tasks[0],tool=needed(task)){assert.equal(selectTool(g,tool),true);return actHouse(g,task.id);}
function waterUntil(g,count){let attempts=0;while(g.stageCompleted<count&&g.phase==='playing'&&attempts++<3000){if(g.tasks.length)clearTask(g);else advanceHouse(g,.1);}assert.ok(attempts<3000);}
function finishStage(g){let attempts=0;while(g.phase==='playing'&&attempts++<3000){if(g.tasks.length)clearTask(g);else advanceHouse(g,.1);}assert.ok(attempts<3000);}
function atStage(level){const g=game();while(g.level<level){finishStage(g);assert.equal(advanceStage(g),true);}return g;}

test('the opening has four pots, thirty waterings and only the tools for its two tasks',()=>{
  assert.equal(HOUSE_SLOTS.plant,4);assert.equal(STAGES[0].goal,30);assert.deepEqual(STAGES[0].types,['plant','dust']);
  assert.deepEqual(TOOLS.map(t=>t.id),['water','broom','hand','serve']);assert.deepEqual(game().unlockedTools,['water','broom']);
  for(const s of STAGES){assert.ok(s.unlockedTools.length<=4);assert.ok(s.unlockedTools.every(id=>TOOLS.some(t=>t.id===id)));assert.deepEqual(s.unlockedRecipes,[]);assert.equal(s.requiredDish,null);}
  assert.equal(STAGES.find(s=>s.types.includes('guest')).level,5);assert.equal(STAGES[5].requiredMeal,true);
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

test('thirty successful waterings repeat the four pots while sweeping adds no watering progress',()=>{
  const g=game();let swept=0,attempts=0;
  while(g.phase==='playing'&&attempts++<3000){
    if(!g.tasks.length){advanceHouse(g,.1);continue;}
    const task=g.tasks[0],before=g.stageCompleted;clearTask(g,task);
    if(task.type==='dust'){swept++;assert.equal(g.stageCompleted,before);}else assert.equal(g.stageCompleted,before+1);
  }
  assert.ok(attempts<3000);assert.ok(swept>0);assert.equal(g.stats.plants,30);assert.equal(g.wateredSlots.length,30);
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
  assert.equal(g.stats.plants,30);assert.equal(g.phase,'stage-complete');
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
  const g=atStage(5),guest=g.tasks[0];assert.equal(guest.type,'guest');assert.ok(RECIPES.some(r=>r.id===guest.recipeId));
  assert.ok(Object.values(g.inventory).every(n=>n===0));assert.equal(g.requiredMealComplete,false);const before=g.score;
  selectTool(g,'water');assert.equal(actHouse(g,guest.id).type,'wrong');const event=clearTask(g,guest,'serve');
  assert.equal(event.kind,'meal');assert.equal(event.recipeId,guest.recipeId);assert.equal(g.score-before,POINTS.meal);assert.equal(g.stats.meals,1);
  assert.equal(g.requiredMealComplete,true);assert.equal(g.lessonObjective.complete,true);assert.ok(Object.values(g.inventory).every(n=>n===0));
  assert.equal(selectTool(g,'peanuts'),false);assert.equal(g.stats.snacks,0);
});

test('all serving stages stay completable without cooking tools or inventory',()=>{
  for(const n of [5,6,7,8,9,10]){const g=atStage(n);assert.equal(selectTool(g,'serve'),true);assert.ok(!g.unlockedTools.includes('bowl'));assert.deepEqual(g.unlockedRecipes,[]);finishStage(g);assert.equal(g.completedLevels,n);}
});

test('the first cats wait eight seconds before a generous sixty-second approach, and level three has no dust',()=>{
  const g=atStage(3),cat=g.tasks[0];assert.equal(cat.type,'cat');assert.equal(cat.waiting,8);assert.equal(cat.remaining,60);advanceHouse(g,8);assert.equal(cat.state,'approaching');assert.equal(cat.waiting,0);assert.equal(cat.remaining,60);advanceHouse(g,10);assert.ok(Math.abs(cat.remaining-50)<1e-8);assert.equal(g.strikes,0);assert.ok(g.tasks.every(t=>t.type!=='dust'));clearTask(g,cat);assert.equal(g.stats.cats,1);assert.equal(g.strikes,0);
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

test('all ten stages retain exact score accounting, paused transition clocks and one win event',()=>{
  const g=game();for(let n=1;n<=10;n++){finishStage(g);assert.equal(g.completedLevels,n);assert.equal(g.stageCompleted,STAGES[n-1].goal);assert.ok(g.stageScores[n-1]>0);assert.equal(g.requiredDishComplete,true);assert.equal(g.requiredMealComplete,true);if(n<10){assert.equal(g.phase,'stage-complete');const frozen=JSON.stringify(g);advanceHouse(g,60);assert.equal(JSON.stringify(g),frozen);assert.equal(advanceStage(g),true);}}
  assert.equal(g.phase,'finished');assert.equal(g.won,true);assert.equal(g.level,10);assert.equal(g.stageScores.reduce((a,b)=>a+b,0),g.score);assert.equal(g.events.filter(e=>e.type==='finished').length,1);assert.equal(advanceStage(g),false);
});

test('invalid deltas preserve clocks and split frames produce the same tutorial task',()=>{
  const g=game();for(const dt of [0,-1,NaN,Infinity,undefined])advanceHouse(g,dt);assert.equal(g.elapsed,0);const a=game(),b=game();advanceHouse(a,7);for(let n=0;n<70;n++)advanceHouse(b,.1);assert.equal(a.elapsed,b.elapsed);assert.deepEqual(a.tasks,b.tasks);
});
