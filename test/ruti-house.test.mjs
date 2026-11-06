import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RECIPES,TOOLS,POINTS,HOUSE_SLOTS,STAGES,STOCK_LIMIT,createHouse,advanceHouse,advanceStage,selectTool,actHouse} from '../public/assets/ruti-house-engine.mjs';

const game=()=>createHouse({random:()=>.5});
const needed=task=>({plant:'water',dust:'broom',cat:'hand',guest:'peanuts'}[task.type]);
function clearTask(g,task=g.tasks[0],tool=needed(task)){assert.equal(selectTool(g,tool),true);return actHouse(g,task.id);}
function finishStage(g){let attempts=0;while(g.phase==='playing'&&attempts++<1000){if(g.tasks.length)clearTask(g);else advanceHouse(g,.1);}assert.ok(attempts<1000);}
function atStage(level){const g=game();for(let n=1;n<level;n++){finishStage(g);assert.equal(advanceStage(g),true);}return g;}
function prepare(g,recipe){for(const step of recipe.steps){assert.equal(selectTool(g,step.tool),true);assert.equal(actHouse(g,`cook-${recipe.id}`).ok,true);}}

test('ten objective stages introduce one long watering task before anything else can happen',()=>{
  const g=game();assert.equal(STAGES.length,10);assert.deepEqual(STAGES.map(s=>s.goal),[1,3,5,7,9,11,13,15,17,20]);assert.deepEqual(STAGES.map(s=>s.maxActive),[1,1,2,2,3,3,4,4,5,6]);
  assert.equal(g.selected,null);assert.deepEqual(g.unlockedTools,['water']);assert.deepEqual(g.unlockedRecipes,[]);assert.equal(g.tasks.length,1);assert.equal(g.tasks[0].type,'plant');assert.equal(g.tasks[0].slot,0);assert.equal(g.tasks[0].remaining,60);
  assert.equal(selectTool(g,'broom'),false);assert.equal(actHouse(g,'cook-tahini').type,'locked');advanceHouse(g,30);assert.equal(g.tasks.length,1);assert.ok(Math.abs(g.tasks[0].remaining-30)<1e-8);assert.equal(g.level,1);
});

test('completion creates a real frozen break; only explicit continuation opens the next stage',()=>{
  const g=game();const event=clearTask(g);assert.equal(event.kind,'plant');assert.equal(g.phase,'stage-complete');assert.equal(g.stageCompleted,1);assert.equal(g.completedLevels,1);assert.equal(g.tasks.length,0);assert.equal(g.stageScores[0],POINTS.plant);
  const frozen=JSON.stringify(g);advanceHouse(g,60);selectTool(g,'water');actHouse(g,'cook-tahini');assert.equal(JSON.stringify(g),frozen);
  assert.equal(advanceStage(g),true);assert.equal(g.level,2);assert.equal(g.stageCompleted,0);assert.equal(g.selected,null);assert.equal(g.phase,'playing');assert.equal(g.tasks.length,1);assert.equal(g.tasks[0].type,'dust');assert.equal(g.tasks[0].total,40);assert.equal(advanceStage(g),false);
  assert.deepEqual(g.events.filter(e=>e.type==='stage-clear').map(e=>e.level),[1]);
});

test('each target requires a selected correct tool, and duplicate or stale arrivals cannot score twice',()=>{
  const g=game(),plant=g.tasks[0];assert.equal(actHouse(g,plant.id).type,'wrong');assert.equal(g.stageCompleted,0);assert.equal(g.score,0);assert.equal(g.tasks.length,1);
  assert.equal(selectTool(g,'fake'),false);assert.equal(selectTool(g,'water'),true);assert.equal(actHouse(g,plant.id).kind,'plant');const score=g.score;assert.equal(actHouse(g,plant.id),null);assert.equal(g.score,score);
});

test('stages unlock recipes gradually and seed only newly available meals once',()=>{
  assert.deepEqual(RECIPES.map(r=>r.id),['tahini','carrot','kubaneh','eggplant','lasagna']);for(const recipe of RECIPES)for(const step of recipe.steps)assert.ok(TOOLS.some(tool=>tool.id===step.tool));
  const g=atStage(3);assert.deepEqual(g.unlockedRecipes,['tahini','carrot']);assert.equal(g.inventory.tahini,1);assert.equal(g.inventory.carrot,1);assert.equal(g.inventory.kubaneh,0);assert.equal(selectTool(g,'oven'),false);assert.equal(actHouse(g,'cook-kubaneh').type,'locked');
  g.inventory.tahini=0;finishStage(g);advanceStage(g);assert.equal(g.inventory.tahini,0);assert.equal(g.inventory.kubaneh,1);assert.equal(selectTool(g,'hand'),true);assert.equal(selectTool(g,'oven'),true);
  const six=atStage(6);assert.equal(six.unlockedRecipes.length,5);assert.equal(six.inventory.lasagna,1);
});

test('family meals use the exact requested dish and peanuts remain a valuable fallback',()=>{
  for(const [tool,kind,counter,base] of [['serve','meal','meals',POINTS.meal],['peanuts','snack','snacks',POINTS.snack]]){
    const g=atStage(3),guest=g.tasks[0],before=g.score,stock=g.inventory[guest.recipeId];const event=clearTask(g,guest,tool);
    assert.equal(event.kind,kind);assert.equal(g.stats[counter],1);assert.equal(g.score-before,base);assert.equal(g.inventory[guest.recipeId],stock-(tool==='serve'?1:0));assert.equal(g.stageCompleted,1);
  }
  assert.ok(POINTS.snack>2*Math.max(POINTS.plant,POINTS.dust,POINTS.cat,POINTS.dish));const g=atStage(3),guest=g.tasks[0];g.inventory[guest.recipeId]=0;selectTool(g,'serve');assert.equal(actHouse(g,guest.id).type,'empty');assert.equal(g.stageCompleted,0);assert.ok(g.tasks.includes(guest));clearTask(g,guest,'peanuts');assert.equal(g.stats.snacks,1);
});

test('all five recipes require their real sequence, take cooking time and never count as stage objectives',()=>{
  for(const recipe of RECIPES){
    const g=atStage(6),beforeScore=g.score,beforeCount=g.stageCompleted;selectTool(g,'hand');assert.equal(actHouse(g,`cook-${recipe.id}`).type,'wrong');assert.equal(g.kitchen[recipe.id].step,0);
    prepare(g,recipe);assert.equal(g.kitchen[recipe.id].state,'cooking');assert.equal(g.score,beforeScore);assert.equal(g.inventory[recipe.id],1);assert.equal(actHouse(g,`cook-${recipe.id}`).type,'busy');
    advanceHouse(g,recipe.duration-.1);assert.equal(g.inventory[recipe.id],1);advanceHouse(g,.1);assert.equal(g.inventory[recipe.id],2);assert.equal(g.stats.dishes,1);assert.equal(g.stageCompleted,beforeCount);assert.equal(g.kitchen[recipe.id].state,'prep');
    assert.equal(g.events.filter(e=>e.ready&&e.recipeId===recipe.id).length,1);g.inventory[recipe.id]=STOCK_LIMIT;assert.equal(actHouse(g,`cook-${recipe.id}`).type,'full');
  }
});

test('cats wait visibly outside, then approach on a separate clock and can be shooed in either state',()=>{
  const g=atStage(4),cat=g.tasks[0];assert.equal(cat.type,'cat');assert.equal(cat.state,'waiting');assert.equal(cat.waiting,6);assert.equal(cat.remaining,38);assert.ok([0,1].includes(cat.door));
  advanceHouse(g,5);assert.equal(cat.waiting,1);assert.equal(cat.remaining,38);advanceHouse(g,1);assert.equal(cat.waiting,0);assert.equal(cat.state,'approaching');assert.equal(cat.remaining,38);advanceHouse(g,2);assert.ok(Math.abs(cat.remaining-36)<1e-8);assert.equal(g.strikes,0);
  clearTask(g,cat);assert.equal(g.stats.cats,1);assert.equal(g.strikes,0);const other=atStage(4);clearTask(other,other.tasks[0]);assert.equal(other.stats.cats,1);assert.equal(other.strikes,0);
});

test('deadlines and maximum concurrency become harder only after stage completion',()=>{
  for(const n of [3,4,5,6,7,8,9,10]){
    const g=atStage(n);assert.equal(g.tasks.length,1);assert.equal(g.level,n);assert.ok(g.stage.deadlines.dust>=10);assert.ok(g.stage.deadlines.plant>=17);
    for(let step=0;step<100;step++){
      advanceHouse(g,.2);for(const cat of g.tasks.filter(t=>t.type==='cat'&&t.waiting===0&&t.remaining<1))clearTask(g,cat);
      assert.ok(g.tasks.length<=g.stage.maxActive);const doors=g.tasks.filter(t=>t.type==='cat'||t.type==='guest').map(t=>t.door);assert.equal(new Set(doors).size,doors.length);
      for(const type of ['plant','dust']){const slots=g.tasks.filter(t=>t.type===type).map(t=>t.slot);assert.equal(new Set(slots).size,slots.length);assert.ok(slots.length<=HOUSE_SLOTS[type]);}
    }
    assert.equal(g.level,n);
  }
  assert.equal(STAGES[3].deadlines.cat,38);assert.equal(STAGES[9].deadlines.cat,6);assert.equal(STAGES[9].catWait,3);
});

test('missed early tasks respawn after a breath without strikes or accidental progress',()=>{
  const g=game(),old=g.tasks[0].id;advanceHouse(g,60);assert.equal(g.strikes,0);assert.equal(g.phase,'playing');assert.equal(g.stageCompleted,0);assert.equal(g.tasks.length,0);assert.equal(g.stats.missed,1);
  advanceHouse(g,4);assert.equal(g.tasks.length,1);assert.notEqual(g.tasks[0].id,old);assert.equal(g.tasks[0].type,'plant');assert.equal(g.tasks[0].total,60);assert.equal(g.level,1);
});

test('three cat entries end the whole run; earlier strikes persist through stage breaks',()=>{
  const g=atStage(4);for(let i=1;i<=2;i++){g.tasks=[{id:`cat-${i}`,type:'cat',slot:0,door:0,state:'approaching',waiting:0,remaining:.1,total:.1}];advanceHouse(g,.1);assert.equal(g.strikes,i);assert.equal(g.phase,'playing');}
  finishStage(g);assert.equal(g.phase,'stage-complete');advanceStage(g);assert.equal(g.strikes,2);g.tasks=[{id:'cat-last',type:'cat',slot:0,door:0,state:'approaching',waiting:0,remaining:.1,total:.1}];advanceHouse(g,.1);
  assert.equal(g.strikes,3);assert.equal(g.phase,'finished');assert.equal(g.won,false);assert.equal(g.completedLevels,4);const frozen=JSON.stringify(g);advanceHouse(g,60);actHouse(g,'cook-tahini');advanceStage(g);assert.equal(JSON.stringify(g),frozen);
});

test('clearing all ten stages wins once with exact per-stage and overall score accounting',()=>{
  const g=game();for(let n=1;n<=10;n++){
    finishStage(g);assert.equal(g.completedLevels,n);assert.equal(g.stageCompleted,STAGES[n-1].goal);assert.ok(g.stageScores[n-1]>0);
    if(n<10){assert.equal(g.phase,'stage-complete');assert.equal(g.won,false);assert.equal(advanceStage(g),true);}
  }
  assert.equal(g.phase,'finished');assert.equal(g.won,true);assert.equal(g.level,10);assert.equal(advanceStage(g),false);assert.equal(g.stageScores.reduce((a,b)=>a+b,0),g.score);assert.equal(g.completedLevels,10);
  const totalObjectives=Object.entries(g.stats).filter(([key])=>!['dishes','missed'].includes(key)).reduce((sum,[,value])=>sum+value,0);assert.equal(totalObjectives,STAGES.reduce((sum,s)=>sum+s.goal,0));assert.equal(g.events.filter(e=>e.type==='finished').length,1);
});

test('cooking and all clocks stay frozen at a stage break and resume in the same kitchen',()=>{
  const g=atStage(3);while(g.stageCompleted<g.stage.goal-1){if(g.tasks.length)clearTask(g);else advanceHouse(g,.1);}while(!g.tasks.length)advanceHouse(g,.1);
  prepare(g,RECIPES[0]);const before=g.kitchen.tahini.remaining;clearTask(g);assert.equal(g.phase,'stage-complete');const elapsed=g.elapsed;
  advanceHouse(g,60);assert.equal(g.elapsed,elapsed);assert.equal(g.kitchen.tahini.remaining,before);advanceStage(g);advanceHouse(g,before);assert.equal(g.kitchen.tahini.state,'prep');assert.ok(g.inventory.tahini>=1);assert.equal(g.stats.dishes,1);
});

test('invalid deltas leave clocks untouched, and deterministic split frames agree',()=>{
  const g=game();for(const dt of [0,-1,NaN,Infinity,undefined])advanceHouse(g,dt);assert.equal(g.elapsed,0);const a=game(),b=game();advanceHouse(a,7);for(let i=0;i<70;i++)advanceHouse(b,.1);assert.equal(a.elapsed,b.elapsed);assert.deepEqual(a.tasks,b.tasks);
  const stage2=atStage(2);clearTask(stage2);advanceHouse(stage2,3);assert.ok(stage2.tasks[0].position.x>=.18&&stage2.tasks[0].position.x<=.82);
});
