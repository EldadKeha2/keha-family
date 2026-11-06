import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RECIPES,TOOLS,POINTS,HOUSE_SLOTS,STOCK_LIMIT,LEVEL_SECONDS,createHouse,advanceHouse,selectTool,actHouse} from '../public/assets/ruti-house-engine.mjs';

const game=()=>createHouse({random:()=>.5});
const task=(g,type)=>g.tasks.find(item=>item.type===type);
const clearTask=(g,type,tool)=>{const target=task(g,type);selectTool(g,tool);return actHouse(g,target.id);};
function prepare(g,recipe){for(const step of recipe.steps){selectTool(g,step.tool);actHouse(g,`cook-${recipe.id}`);}}
function keepCatsOut(g){for(const cat of g.tasks.filter(item=>item.type==='cat')){selectTool(g,'hand');actHouse(g,cat.id);}}

test('all Ruti specialties and correct tools are present; the home starts with simultaneous needs',()=>{
  const g=game();assert.deepEqual(RECIPES.map(recipe=>recipe.id),['tahini','carrot','kubaneh','eggplant','lasagna']);
  assert.deepEqual(new Set(g.tasks.map(item=>item.type)),new Set(['plant','dust','guest']));
  assert.equal(g.tasks.find(item=>item.type==='guest').recipeId,'tahini');
  for(const recipe of RECIPES){assert.ok(recipe.steps.length>=2);for(const step of recipe.steps)assert.ok(TOOLS.some(tool=>tool.id===step.tool));assert.equal(g.inventory[recipe.id],1);}
});

test('each target requires the selected correct tool; wrong actions never remove tasks or create points',()=>{
  const g=game(),plant=task(g,'plant');const before=g.score;
  assert.equal(actHouse(g,plant.id).type,'wrong');assert.ok(g.tasks.includes(plant));assert.equal(g.score,before);
  assert.equal(selectTool(g,'fake'),false);assert.equal(g.selected,'bowl');
  selectTool(g,'water');const event=actHouse(g,plant.id);assert.equal(event.kind,'plant');assert.equal(event.points,POINTS.plant);assert.equal(g.stats.plants,1);assert.ok(!g.tasks.includes(plant));
  assert.equal(actHouse(g,plant.id),null);assert.equal(g.score,POINTS.plant);
});

test('feeding family earns more than chores, uses the exact requested dish and permits a peanut fallback',()=>{
  for(const [tool,kind,counter,base] of [['serve','meal','meals',POINTS.meal],['peanuts','snack','snacks',POINTS.snack]]){
    const g=game(),guest=task(g,'guest'),stock=g.inventory[guest.recipeId];selectTool(g,tool);
    const event=actHouse(g,guest.id);assert.equal(event.kind,kind);assert.equal(g.stats[counter],1);assert.equal(g.score,base);
    assert.equal(g.inventory[guest.recipeId],stock-(tool==='serve'?1:0));
  }
  assert.ok(POINTS.snack>2*Math.max(POINTS.plant,POINTS.dust,POINTS.cat,POINTS.dish));
  const g=game(),guest=task(g,'guest');g.inventory[guest.recipeId]=0;selectTool(g,'serve');assert.equal(actHouse(g,guest.id).type,'empty');assert.ok(g.tasks.includes(guest));
  selectTool(g,'peanuts');assert.equal(actHouse(g,guest.id).kind,'snack');
});

test('each recipe follows its tools, cooks over time, replenishes stock once and awards only one completion',()=>{
  for(const recipe of RECIPES){
    const g=game();selectTool(g,'hand');assert.equal(actHouse(g,`cook-${recipe.id}`).type,'wrong');assert.equal(g.kitchen[recipe.id].step,0);
    prepare(g,recipe);assert.equal(g.kitchen[recipe.id].state,'cooking');assert.equal(g.score,0);assert.equal(g.inventory[recipe.id],1);
    assert.equal(actHouse(g,`cook-${recipe.id}`).type,'busy');
    advanceHouse(g,recipe.duration-.1);assert.equal(g.inventory[recipe.id],1);advanceHouse(g,.1);assert.equal(g.inventory[recipe.id],2);assert.equal(g.stats.dishes,1);assert.equal(g.kitchen[recipe.id].state,'prep');
    advanceHouse(g,1);assert.equal(g.stats.dishes,1);
    g.inventory[recipe.id]=STOCK_LIMIT;selectTool(g,recipe.steps[0].tool);assert.equal(actHouse(g,`cook-${recipe.id}`).type,'full');
  }
});

test('fleeting dust, thirsty plants and hungry guests expire without consuming cat lives',()=>{
  const g=game();g.schedule={plant:999,dust:999,guest:999,cat:999};
  advanceHouse(g,27);assert.equal(g.strikes,0);assert.equal(g.phase,'playing');assert.equal(g.stats.missed,3);assert.equal(g.tasks.length,0);
});

test('a cat reaching the house costs one life and exactly three cats end the game',()=>{
  const g=game();g.tasks=[];g.schedule={plant:999,dust:999,guest:999,cat:999};
  for(let i=1;i<=3;i++){
    g.tasks.push({id:`cat-${i}`,type:'cat',slot:0,remaining:.1,total:.1});advanceHouse(g,.1);
    assert.equal(g.strikes,i);assert.equal(g.phase,i===3?'finished':'playing');
  }
  const frozen=JSON.stringify(g);advanceHouse(g,100);selectTool(g,'hand');actHouse(g,'cook-tahini');assert.equal(JSON.stringify(g),frozen);
});

test('shooing a cat prevents that strike; stale IDs and duplicate taps cannot score twice',()=>{
  const g=game();advanceHouse(g,7.5);const cat=task(g,'cat');assert.ok(cat);selectTool(g,'hand');assert.equal(actHouse(g,cat.id).kind,'cat');
  const score=g.score;assert.equal(actHouse(g,cat.id),null);assert.equal(g.score,score);g.schedule.cat=999;advanceHouse(g,11);assert.equal(g.strikes,0);
});

test('progression creates overlapping needs, uses distinct slots, and shortens deadlines with elapsed time',()=>{
  const g=game();let maxTasks=0;const firstDeadline=task(g,'guest').total;
  for(let n=0;n<240;n++){
    advanceHouse(g,.5);maxTasks=Math.max(maxTasks,g.tasks.length);keepCatsOut(g);
    for(const type of Object.keys(HOUSE_SLOTS)){const items=g.tasks.filter(item=>item.type===type);assert.ok(items.length<=HOUSE_SLOTS[type]);assert.equal(new Set(items.map(item=>item.slot)).size,items.length);}
  }
  assert.equal(g.level,1+Math.floor(g.elapsed/LEVEL_SECONDS));assert.ok(g.level>=5);assert.ok(maxTasks>=5);assert.ok(task(g,'guest').total<firstDeadline);assert.equal(g.phase,'playing');
});

test('combo rewards timely completions, caps at 2x and resets after inactivity or a missed task',()=>{
  const g=game();g.tasks=[];g.schedule={plant:999,dust:999,guest:999,cat:999};
  for(let i=0;i<30;i++){g.tasks.push({id:`d-${i}`,type:'dust',slot:0,total:8,remaining:8});selectTool(g,'broom');actHouse(g,`d-${i}`);}
  assert.equal(g.bestCombo,30);assert.equal(g.multiplier,2);assert.ok(g.score<=30*POINTS.dust*2);
  advanceHouse(g,8);assert.equal(g.combo,0);assert.equal(g.multiplier,1);
  g.tasks.push({id:'one',type:'dust',slot:0,total:8,remaining:8});clearTask(g,'dust','broom');assert.equal(g.combo,1);
  g.tasks.push({id:'miss',type:'plant',slot:0,total:.1,remaining:.1});advanceHouse(g,.1);assert.equal(g.combo,0);assert.equal(g.bestCombo,30);
});

test('invalid deltas cannot corrupt clocks and a long frame still handles deadlines',()=>{
  const g=game(),elapsed=g.elapsed;for(const dt of [0,-1,NaN,Infinity,undefined])advanceHouse(g,dt);assert.equal(g.elapsed,elapsed);
  advanceHouse(g,5);assert.ok(Math.abs(g.elapsed-5)<1e-8);assert.ok(g.tasks.every(item=>item.remaining>0));
  const a=game(),b=game();advanceHouse(a,7);for(let i=0;i<70;i++)advanceHouse(b,.1);
  assert.equal(a.tasks.length,b.tasks.length);assert.deepEqual(a.tasks.map(item=>[item.id,item.type,item.slot]),b.tasks.map(item=>[item.id,item.type,item.slot]));
});
