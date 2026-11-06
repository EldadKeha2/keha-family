import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RECIPES,TOOLS,POINTS,HOUSE_SLOTS,STAGES,STOCK_LIMIT,createHouse,advanceHouse,advanceStage,selectTool,actHouse} from '../public/assets/ruti-house-engine.mjs';

const game=()=>createHouse({random:()=>.5});
const needed=t=>({plant:'water',dust:'broom',cat:'hand',guest:'peanuts'}[t.type]);
function clearTask(g,task=g.tasks[0],tool=needed(task)){assert.equal(selectTool(g,tool),true);return actHouse(g,task.id);}
function prepare(g,recipe){for(const step of recipe.steps.slice(g.kitchen[recipe.id].step)){assert.equal(selectTool(g,step.tool),true);assert.equal(actHouse(g,`cook-${recipe.id}`).ok,true);}}
function finishStage(g){let attempts=0;while(g.phase==='playing'&&attempts++<2000){
  if(!g.requiredDishComplete){const r=RECIPES.find(r=>r.id===g.stage.requiredDish);prepare(g,r);advanceHouse(g,r.duration);}
  else if(g.tasks.length){const guest=g.tasks.find(t=>t.type==='guest');if(!g.requiredMealComplete&&guest)clearTask(g,guest,'serve');else clearTask(g);}
  else advanceHouse(g,.1);
}assert.ok(attempts<2000);}
function atStage(level){const g=game();while(g.level<level){finishStage(g);assert.equal(advanceStage(g),true);}return g;}
function fillNormalGoal(g){let guard=0;while(g.stageCompleted<g.stage.goal&&guard++<2000){if(g.tasks.length)clearTask(g);else advanceHouse(g,.1);}assert.ok(guard<2000);}

test('the curriculum introduces plants, dust, cats, cooking, guests and baking in the specified order',()=>{
  assert.deepEqual(STAGES.map(s=>s.goal),[5,4,5,6,7,9,11,13,16,20]);assert.deepEqual(STAGES.map(s=>s.maxActive),[1,1,2,2,2,3,4,4,5,6]);
  assert.deepEqual(STAGES.map(s=>s.newFeature),['water','dust','cat','combined','cooking','guests','oven',null,null,null]);
  assert.deepEqual(STAGES.slice(0,4).map(s=>s.types),[['plant'],['dust','plant'],['cat','plant'],['dust','plant','cat']]);
  assert.ok(STAGES.slice(0,5).every(s=>!s.types.includes('guest')));assert.ok(STAGES[5].types.includes('guest'));assert.equal(STAGES[4].requiredDish,'tahini');assert.equal(STAGES[5].requiredMeal,true);assert.equal(STAGES[6].requiredDish,'kubaneh');assert.equal(STAGES.filter(s=>s.untimed).length,1);
});

test('level one waters all five different pots once, one at a time, with unlimited time',()=>{
  const g=game(),slots=[];assert.equal(g.selected,null);assert.deepEqual(g.unlockedTools,['water']);assert.equal(g.tutorial,null);
  for(let n=0;n<5;n++){
    assert.equal(g.tasks.length,1);const task=g.tasks[0];slots.push(task.slot);assert.equal(task.type,'plant');assert.equal(task.untimed,true);assert.equal(task.total,1);assert.equal(task.remaining,1);
    for(let minute=0;minute<10;minute++)advanceHouse(g,60);
    assert.equal(g.tasks.length,1);assert.equal(g.tasks[0],task);assert.equal(task.remaining,1);assert.equal(g.strikes,0);assert.equal(g.stats.missed,0);assert.equal(g.level,1);
    const combo=g.combo;clearTask(g);assert.equal(g.stageCompleted,n+1);assert.equal(g.combo,combo+1);
    if(n<4){assert.equal(g.phase,'playing');assert.equal(g.tasks.length,0);advanceHouse(g,2);}
  }
  assert.equal(new Set(slots).size,5);assert.deepEqual([...slots].sort(),[0,1,2,3,4]);assert.deepEqual(g.wateredSlots,slots);assert.equal(g.phase,'stage-complete');assert.equal(g.completedLevels,1);assert.equal(g.plantDeck.length,0);assert.equal(g.stats.plants,5);
});

test('plant decks vary between random seeds without repeating or missing a fixed pot',()=>{
  const a=createHouse({random:()=>0}),b=createHouse({random:()=>.999});const deck=g=>[g.tasks[0].slot,...g.plantDeck];assert.notDeepEqual(deck(a),deck(b));assert.deepEqual([...deck(a)].sort(),[0,1,2,3,4]);assert.deepEqual([...deck(b)].sort(),[0,1,2,3,4]);
});

test('wrong tools, locked recipes and duplicate arrivals cannot skip work or gain points',()=>{
  const g=game(),id=g.tasks[0].id;assert.equal(selectTool(g,'broom'),false);assert.equal(selectTool(g,'fake'),false);assert.equal(actHouse(g,id).type,'wrong');assert.equal(g.score,0);assert.equal(g.stageCompleted,0);assert.equal(actHouse(g,'cook-tahini').type,'locked');
  clearTask(g);const score=g.score;assert.equal(actHouse(g,id),null);assert.equal(g.score,score);assert.equal(g.stageCompleted,1);
});

test('mechanics and dishes remain locked until their own introduction stages',()=>{
  for(const n of [1,2,3,4]){const g=atStage(n);assert.deepEqual(g.unlockedRecipes,[]);assert.equal(selectTool(g,'bowl'),false);assert.equal(selectTool(g,'serve'),false);assert.equal(actHouse(g,'cook-carrot').type,'locked');}
  const five=atStage(5);assert.deepEqual(five.unlockedRecipes,['tahini','carrot']);assert.equal(selectTool(five,'bowl'),true);assert.equal(selectTool(five,'knife'),true);assert.equal(selectTool(five,'oven'),false);assert.equal(selectTool(five,'serve'),false);assert.equal(five.tasks.length,0);assert.equal(five.cookingFocus,'tahini');
  const six=atStage(6);assert.equal(six.tasks[0].type,'guest');assert.equal(selectTool(six,'serve'),true);assert.equal(selectTool(six,'peanuts'),true);assert.equal(selectTool(six,'oven'),false);
  const seven=atStage(7);assert.equal(seven.unlockedRecipes.length,5);assert.equal(selectTool(seven,'oven'),true);assert.equal(seven.tasks.length,0);assert.equal(seven.cookingFocus,'kubaneh');
});

test('cooking must finish the correct tahini recipe before level five can end',()=>{
  const g=atStage(5);assert.deepEqual(g.lessonObjective,{kind:'dish',recipeId:'tahini',complete:false});assert.equal(g.requiredDishComplete,false);fillNormalGoal(g);assert.equal(g.phase,'playing');assert.equal(g.stageCompleted,g.stage.goal);assert.equal(g.requiredDishComplete,false);
  const r=RECIPES.find(r=>r.id==='tahini');selectTool(g,'knife');assert.equal(actHouse(g,'cook-tahini').type,'wrong');prepare(g,r);assert.equal(g.requiredDishComplete,false);assert.equal(g.phase,'playing');assert.equal(g.kitchen.tahini.state,'cooking');advanceHouse(g,r.duration-.1);assert.equal(g.requiredDishComplete,false);advanceHouse(g,.1);
  assert.equal(g.requiredDishComplete,true);assert.equal(g.lessonObjective.complete,true);assert.equal(g.cookingFocus,null);assert.equal(g.phase,'stage-complete');assert.equal(g.events.filter(e=>e.type==='lesson-complete'&&e.kind==='dish').length,1);
});

test('the mandatory dish counts one objective; another prepared dish cannot substitute for it',()=>{
  const g=atStage(5),carrot=RECIPES.find(r=>r.id==='carrot'),tahini=RECIPES.find(r=>r.id==='tahini');prepare(g,carrot);advanceHouse(g,carrot.duration);assert.equal(g.stageCompleted,0);assert.equal(g.requiredDishComplete,false);
  prepare(g,tahini);advanceHouse(g,tahini.duration);assert.equal(g.stageCompleted,1);assert.equal(g.requiredDishComplete,true);prepare(g,tahini);advanceHouse(g,tahini.duration);assert.equal(g.stageCompleted,1);assert.equal(g.inventory.tahini,3);assert.equal(actHouse(g,'cook-tahini').type,'full');
});

test('peanuts are valuable hospitality but cannot replace the mandatory meal in level six',()=>{
  const g=atStage(6);assert.equal(g.requiredMealComplete,false);assert.deepEqual(g.lessonObjective,{kind:'meal',complete:false});const first=g.tasks[0],before=g.stats.snacks;clearTask(g,first,'peanuts');assert.equal(g.stats.snacks,before+1);assert.equal(g.requiredMealComplete,false);
  fillNormalGoal(g);assert.equal(g.phase,'playing');assert.equal(g.requiredMealComplete,false);let guard=0;while(!g.tasks.some(t=>t.type==='guest')&&guard++<1000){if(g.tasks.length)clearTask(g);else advanceHouse(g,.1);}assert.ok(guard<1000);
  const guest=g.tasks.find(t=>t.type==='guest'),stock=g.inventory[guest.recipeId];assert.ok(stock>0);const event=clearTask(g,guest,'serve');assert.equal(event.kind,'meal');assert.equal(g.inventory[guest.recipeId],stock-1);assert.equal(g.requiredMealComplete,true);assert.equal(g.lessonObjective.complete,true);assert.equal(g.phase,'stage-complete');
});

test('level seven requires the newly introduced kubaneh and oven, while earlier dishes cannot satisfy it',()=>{
  const g=atStage(7),tahini=RECIPES.find(r=>r.id==='tahini'),kubaneh=RECIPES.find(r=>r.id==='kubaneh');assert.equal(g.requiredDishComplete,false);prepare(g,tahini);advanceHouse(g,tahini.duration);assert.equal(g.requiredDishComplete,false);
  const stock=g.inventory.kubaneh;selectTool(g,'bowl');assert.equal(actHouse(g,'cook-kubaneh').type,'prep');assert.equal(g.kitchen.kubaneh.step,1);assert.equal(actHouse(g,'cook-kubaneh').type,'wrong');selectTool(g,'oven');assert.equal(actHouse(g,'cook-kubaneh').type,'cooking');advanceHouse(g,kubaneh.duration);assert.equal(g.inventory.kubaneh,stock+1);assert.equal(g.requiredDishComplete,true);assert.equal(g.stageCompleted,1);
});

test('all five dishes follow their tool sequence, replenish stock once and award no ordinary objective points',()=>{
  for(const r of RECIPES){
    const g=atStage(8),stock=g.inventory[r.id],count=g.stats.dishes,before=g.stageCompleted;for(const s of r.steps)assert.ok(TOOLS.some(t=>t.id===s.tool));prepare(g,r);assert.equal(g.kitchen[r.id].state,'cooking');assert.equal(g.inventory[r.id],stock);assert.equal(actHouse(g,`cook-${r.id}`).type,'busy');advanceHouse(g,r.duration-.1);assert.equal(g.inventory[r.id],stock);advanceHouse(g,.1);assert.equal(g.inventory[r.id],stock+1);assert.equal(g.stats.dishes,count+1);assert.equal(g.stageCompleted,before);assert.equal(g.kitchen[r.id].state,'prep');advanceHouse(g,.5);assert.equal(g.stats.dishes,count+1);g.inventory[r.id]=STOCK_LIMIT;assert.equal(actHouse(g,`cook-${r.id}`).type,'full');
  }
});

test('family meals use the requested dish and earn more than household chores',()=>{
  const g=atStage(6),guest=g.tasks[0],stock=g.inventory[guest.recipeId],before=g.score;selectTool(g,'water');assert.equal(actHouse(g,guest.id).type,'wrong');clearTask(g,guest,'serve');assert.equal(g.score-before,POINTS.meal);assert.equal(g.inventory[guest.recipeId],stock-1);assert.ok(POINTS.snack>2*Math.max(POINTS.cat,POINTS.plant,POINTS.dust,POINTS.dish));
  const other=atStage(6),t=other.tasks[0];other.inventory[t.recipeId]=0;selectTool(other,'serve');assert.equal(actHouse(other,t.id).type,'empty');assert.ok(other.tasks.includes(t));clearTask(other,t,'peanuts');assert.equal(other.requiredMealComplete,false);
});

test('the first cats wait eight seconds before a generous sixty-second approach, and level three has no dust',()=>{
  const g=atStage(3),cat=g.tasks[0];assert.equal(cat.type,'cat');assert.equal(cat.waiting,8);assert.equal(cat.remaining,60);advanceHouse(g,8);assert.equal(cat.state,'approaching');assert.equal(cat.waiting,0);assert.equal(cat.remaining,60);advanceHouse(g,10);assert.ok(Math.abs(cat.remaining-50)<1e-8);assert.equal(g.strikes,0);assert.ok(g.tasks.every(t=>t.type!=='dust'));clearTask(g,cat);assert.equal(g.stats.cats,1);assert.equal(g.strikes,0);
});

test('later stages respect concurrency, fixed slots and shared doorways while difficulty rises',()=>{
  for(let n=2;n<=10;n++){
    const g=atStage(n);for(let k=0;k<100;k++){advanceHouse(g,.2);for(const cat of g.tasks.filter(t=>t.type==='cat'&&t.waiting===0&&t.remaining<1))clearTask(g,cat);assert.ok(g.tasks.length<=g.stage.maxActive);const doors=g.tasks.filter(t=>t.type==='cat'||t.type==='guest').map(t=>t.door);assert.equal(new Set(doors).size,doors.length);for(const type of ['plant','dust']){const slots=g.tasks.filter(t=>t.type===type).map(t=>t.slot);assert.equal(new Set(slots).size,slots.length);assert.ok(slots.length<=HOUSE_SLOTS[type]);}}
    assert.equal(g.level,n);
  }
  assert.ok(STAGES[7].deadlines.cat>STAGES[8].deadlines.cat&&STAGES[8].deadlines.cat>STAGES[9].deadlines.cat);assert.ok(STAGES[7].spawnDelay>STAGES[9].spawnDelay);
});

test('three cat entries end the run and prior strikes survive a completed stage',()=>{
  const g=atStage(3);for(let n=1;n<=2;n++){g.tasks=[{id:`cat-${n}`,type:'cat',slot:0,door:0,waiting:0,state:'approaching',total:.1,remaining:.1}];advanceHouse(g,.1);assert.equal(g.strikes,n);assert.equal(g.phase,'playing');}
  finishStage(g);advanceStage(g);assert.equal(g.level,4);assert.equal(g.strikes,2);g.tasks=[{id:'last-cat',type:'cat',slot:0,door:0,waiting:0,state:'approaching',total:.1,remaining:.1}];advanceHouse(g,.1);assert.equal(g.phase,'finished');assert.equal(g.strikes,3);assert.equal(g.won,false);assert.equal(g.completedLevels,3);const frozen=JSON.stringify(g);advanceHouse(g,60);advanceStage(g);actHouse(g,'cook-tahini');assert.equal(JSON.stringify(g),frozen);
});

test('all ten stages can be completed with exact persistent score accounting and one win event',()=>{
  const g=game();for(let n=1;n<=10;n++){finishStage(g);assert.equal(g.completedLevels,n);assert.equal(g.stageCompleted,STAGES[n-1].goal);assert.ok(g.stageScores[n-1]>0);assert.equal(g.requiredDishComplete,true);assert.equal(g.requiredMealComplete,true);if(n<10){assert.equal(g.phase,'stage-complete');const frozen=JSON.stringify(g);advanceHouse(g,60);assert.equal(JSON.stringify(g),frozen);assert.equal(advanceStage(g),true);}}
  assert.equal(g.phase,'finished');assert.equal(g.won,true);assert.equal(g.level,10);assert.equal(g.stageScores.reduce((a,b)=>a+b,0),g.score);assert.equal(g.events.filter(e=>e.type==='finished').length,1);assert.equal(advanceStage(g),false);
});

test('invalid deltas preserve clocks and split frames produce the same fixed tutorial task',()=>{
  const g=game();for(const dt of [0,-1,NaN,Infinity,undefined])advanceHouse(g,dt);assert.equal(g.elapsed,0);const a=game(),b=game();advanceHouse(a,7);for(let n=0;n<70;n++)advanceHouse(b,.1);assert.equal(a.elapsed,b.elapsed);assert.deepEqual(a.tasks,b.tasks);
});
