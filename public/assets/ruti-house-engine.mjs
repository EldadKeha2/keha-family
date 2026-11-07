// Ruti's bustling home: all clocks are game time, so pausing needs no catch-up.
const step=(tool,he,en)=>Object.freeze({tool,he,en});
export const RECIPES=Object.freeze([
  {id:'tahini',he:'הטחינה של רותי',en:'Ruti’s tahini',emoji:'🥣',tool:'bowl',duration:2.5,steps:[step('bowl','מערבבים טחינה ולימון','Mix tahini and lemon'),step('bowl','מוסיפים מים ומערבבים','Add water and stir')]},
  {id:'carrot',he:'סלט גזר מתוק וצימוקים',en:'Sweet carrot & raisin salad',emoji:'🥕',tool:'knife',duration:3,steps:[step('knife','מגררים גזר','Grate carrots'),step('bowl','מערבבים צימוקים ותיבול','Mix in raisins and dressing')]},
  {id:'kubaneh',he:'קובנה',en:'Kubaneh',emoji:'🍞',tool:'bowl',duration:8,steps:[step('bowl','לשים בצק רך','Knead the dough'),step('oven','מכניסים לתנור','Put in the oven')]},
  {id:'eggplant',he:'סלט חצילים',en:'Eggplant salad',emoji:'🍆',tool:'oven',duration:5,steps:[step('oven','קולים את החציל','Roast the eggplant'),step('knife','קוצצים חציל','Chop the eggplant'),step('bowl','מערבבים ומתבלים','Mix and season')]},
  {id:'lasagna',he:'לזניה',en:'Lasagna',emoji:'🍲',tool:'knife',duration:9,steps:[step('knife','מכינים את המילוי','Prepare the filling'),step('bowl','מסדרים שכבות','Layer the lasagna'),step('oven','מכניסים לתנור','Put in the oven')]}
].map(recipe=>Object.freeze({...recipe,steps:Object.freeze(recipe.steps)})));

export const TOOLS=Object.freeze([
  {id:'water',he:'משפך',en:'Watering can',emoji:'🚿'},
  {id:'broom',he:'מטאטא',en:'Broom',emoji:'🧹'},
  {id:'hand',he:'לכו מפה!',en:'Shoo!',emoji:'✋'},
  {id:'serve',he:'אוכל',en:'Food',emoji:'🍽️'}
].map(Object.freeze));
export const POINTS=Object.freeze({meal:300,snack:200,plant:40,dust:20,cat:60,dish:20});
export const HOUSE_SLOTS=Object.freeze({plant:4,dust:6,cat:2,guest:2});
export const HOUSE_GUESTS=Object.freeze(['roi','hila','rivi']);
export const STOCK_LIMIT=3;
const stage=(level,he,en,newFeature,goal,maxActive,order,deadlines,catWait,spawnDelay,{requiredDish=null,requiredMeal=false}={})=>Object.freeze({
  level,he,en,newFeature,goal,maxActive,types:Object.freeze([...new Set(order)]),order:Object.freeze(order),deadlines:Object.freeze(deadlines),catWait,spawnDelay,
  untimed:false,requiredDish,requiredMeal,
  hintHe:level===1?'משקים 30 פעמים את ארבעת העציצים. מתחילים בנחת; בהמשך מגיבים להבהוב בזמן ומטאטאים כשמופיע אבק.':requiredMeal?'בוחרים אוכל ולוחצים על האורח. רותי מגישה לו אחד מהמטעמים שלה.':'ניגשים למשימות ושומרים על בית מלא חיים.',
  hintEn:level===1?'Water the four plants 30 times. Start gently, then respond to their flashing signals before time runs out and sweep when dust appears.':requiredMeal?'Choose Food and tap the guest. Ruti serves one of her delicious dishes.':'Care for each task and keep the home full of life.',
  unlockedTools:Object.freeze(['water','broom',...(level>=3?['hand']:[]),...(level>=5?['serve']:[])]),
  unlockedRecipes:Object.freeze([])
});
export const STAGES=Object.freeze([
  stage(1,'הגינה מתעוררת','The garden wakes up','water',30,2,['plant','dust'],{plant:20,dust:24},0,2.3),
  stage(2,'עציצים ופינות נקיות','Plants and clean corners','dust',4,1,['dust','plant'],{plant:60,dust:45},0,4.5),
  stage(3,'עציצים וחתולים','Plants and cats','cat',5,2,['cat','plant','plant'],{plant:55,cat:60},8,5),
  stage(4,'הבית מתעורר','The house comes alive','combined',6,2,['dust','plant','cat','plant'],{plant:50,dust:40,cat:45},7,4.5),
  stage(5,'משהו טעים לאורחים','A treat for our guests','guests',7,2,['guest','plant','dust','cat','plant'],{plant:45,dust:35,cat:40,guest:65},7,5,{requiredMeal:true}),
  stage(6,'כולם נשארים לאכול','Everyone stays for a meal','hospitality',9,3,['guest','plant','cat','dust','guest'],{plant:40,dust:30,cat:35,guest:65},6,4.5,{requiredMeal:true}),
  stage(7,'עוד משפחה בדלת','More family at the door','combined',11,4,['plant','guest','cat','dust','guest'],{plant:35,dust:26,cat:30,guest:55},6,4),
  stage(8,'בקצב של רותי','Ruti’s rhythm',null,13,4,['guest','cat','plant','dust','guest','plant'],{plant:30,dust:22,cat:22,guest:48},5,3.6),
  stage(9,'כולם בדרך','Everyone is on the way',null,16,5,['cat','guest','plant','dust','guest','cat','plant'],{plant:25,dust:17,cat:14,guest:40},4,3.1),
  stage(10,'הלב של הבית','The heart of the home',null,20,6,['guest','cat','plant','dust','guest','cat','dust','plant'],{plant:22,dust:14,cat:9,guest:35},3.5,2.6)
]);
// One extended opening lesson: six relaxed waterings, then progressively
// shorter response windows that still allow Ruti to fetch a tool and walk.
const FIRST_STAGE_PACES=Object.freeze([
  Object.freeze({phase:0,from:0,maxActive:1,spawnDelay:2.3,plant:20,dust:24,untimed:true}),
  Object.freeze({phase:1,from:6,maxActive:1,spawnDelay:2,plant:20,dust:24,untimed:false}),
  Object.freeze({phase:2,from:15,maxActive:2,spawnDelay:3,plant:16,dust:20,untimed:false}),
  Object.freeze({phase:3,from:24,maxActive:2,spawnDelay:2.5,plant:12,dust:16,untimed:false})
]);
export function firstStagePace(g){return FIRST_STAGE_PACES.findLast(p=>g.stageCompleted>=p.from)||FIRST_STAGE_PACES[0];}
function pace(g){return g.level===1?firstStagePace(g):{...g.stage,untimed:false,...g.stage.deadlines};}
const toolIds=new Set(TOOLS.map(tool=>tool.id));
const recipeById=new Map(RECIPES.map(recipe=>[recipe.id,recipe]));
const statsKey={meal:'meals',snack:'snacks',plant:'plants',dust:'dust',cat:'cats',dish:'dishes'};
const needTool={plant:'water',dust:'broom',cat:'hand'};
const round=n=>Math.round(n*1e9)/1e9;
function random(g){const n=Number(g.random());return Number.isFinite(n)?Math.max(0,Math.min(.999999999,n)):.5;}
function choose(g,list){return list[Math.floor(random(g)*list.length)];}
function emit(g,event){const value={at:g.elapsed,...event};g.events.push(value);if(g.events.length>256)g.events.splice(0,g.events.length-256);return value;}
function breakCombo(g){g.combo=0;g.multiplier=1;g.comboRemaining=0;}
function shuffledPlants(g){const deck=Array.from({length:HOUSE_SLOTS.plant},(_,i)=>i);for(let i=deck.length-1;i>0;i--){const j=Math.floor(random(g)*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]];}return deck;}
function dustPosition(g){
  const clear=p=>g.tasks.filter(t=>t.type==='dust').every(t=>Math.hypot(t.position.x-p.x,t.position.y-p.y)>.1);
  let p={x:.5,y:.5};for(let n=0;n<24;n++){p={x:.18+random(g)*.64,y:.29+random(g)*.42};if(clear(p))return p;}
  for(const y of [.31,.45,.59,.7])for(const x of [.2,.34,.48,.62,.76])if(clear({x,y}))return {x,y};return p;
}
function spawn(g,type){
  const current=pace(g);if(g.tasks.length>=current.maxActive)return null;
  const isDoor=type==='cat'||type==='guest',free=Array.from({length:HOUSE_SLOTS[type]},(_,i)=>i).filter(slot=>!g.tasks.some(t=>t.slot===slot&&(isDoor?t.type==='cat'||t.type==='guest':t.type===type)));
  if(!free.length)return null;
  let slot=choose(g,free);
  if(g.level===1&&type==='plant'){
    if(!g.plantDeck.length)g.plantDeck=shuffledPlants(g);
    let index=g.plantDeck.findIndex(value=>free.includes(value)&&value!==g.lastPlantSlot);
    if(index<0)index=g.plantDeck.findIndex(value=>free.includes(value));
    if(index<0){g.plantDeck=shuffledPlants(g).filter(value=>free.includes(value));index=g.plantDeck.findIndex(value=>value!==g.lastPlantSlot);if(index<0)index=0;}
    slot=g.plantDeck.splice(index,1)[0];g.lastPlantSlot=slot;
  }
  const total=current[type],task={id:`${type}-${++g.serial}`,type,slot,remaining:total,total};
  if(current.untimed)task.untimed=true;
  if(isDoor)task.door=task.slot;
  if(type==='cat'){task.waiting=g.stage.catWait;task.waitingTotal=task.waiting;task.state=task.waiting>0?'waiting':'approaching';}
  if(type==='dust')task.position=dustPosition(g);
  if(type==='guest'){const available=HOUSE_GUESTS.filter(guest=>!g.tasks.some(t=>t.type==='guest'&&t.guest===guest));if(!available.length)return null;task.guest=choose(g,available);task.recipeId=choose(g,RECIPES).id;}
  g.tasks.push(task);g.spawned++;emit(g,{type:'spawn',kind:type,targetId:task.id});return task;
}
function nextTask(g){const order=g.level===1?(g.stageCompleted<6?['plant']:['plant','plant','plant','dust','plant']):g.stage.order;for(let n=0;n<order.length;n++){if(spawn(g,order[g.typeCursor++%order.length]))return true;}return false;}
function startStage(g,index){
  const plan=STAGES[index];Object.assign(g,{stage:plan,level:plan.level,phase:'playing',stageCompleted:0,stageElapsed:0,tasks:[],selected:null,typeCursor:0,spawned:0,spawnRemaining:plan.spawnDelay,tutorial:null});breakCombo(g);
  g.unlockedTools=[...plan.unlockedTools];g.unlockedRecipes=[...plan.unlockedRecipes];
  g.requiredDishComplete=!plan.requiredDish;g.requiredMealComplete=!plan.requiredMeal;g.cookingFocus=plan.requiredDish;
  g.lessonObjective=plan.requiredDish?{kind:'dish',recipeId:plan.requiredDish,complete:false}:plan.requiredMeal?{kind:'meal',complete:false}:null;
  for(const id of plan.unlockedRecipes)if(!g.seededRecipes.includes(id)){g.inventory[id]=1;g.seededRecipes.push(id);}
  if(index===0){g.plantDeck=shuffledPlants(g);g.wateredSlots=[];g.lastPlantSlot=null;g.practicePhase=0;}
  // Cooking and baking begin with the new dish in focus, before household
  // requests arrive. Other stages introduce their new task immediately.
  if(!plan.requiredDish)nextTask(g);
  emit(g,{type:'stage-start',level:g.level,goal:plan.goal,newFeature:plan.newFeature});
}
function finishStage(g){
  g.completedLevels=g.level;g.tasks=[];g.spawnRemaining=0;
  if(g.level===STAGES.length){g.phase='finished';g.won=true;}else g.phase='stage-complete';
  emit(g,{type:'stage-clear',level:g.level,stageScore:g.stageScores[g.level-1],won:g.won});if(g.won)emit(g,{type:'finished',score:g.score,won:true});
}
function success(g,kind,targetId,extra={}){
  g.combo++;g.bestCombo=Math.max(g.bestCombo,g.combo);g.comboRemaining=g.level<5?16:12;g.multiplier=1+Math.min(4,Math.floor(g.combo/5))*.25;
  const points=Math.round(POINTS[kind]*g.multiplier);g.score+=points;g.stageScores[g.level-1]+=points;g.stats[statsKey[kind]]++;
  const event=emit(g,{type:'success',kind,points,targetId,combo:g.combo,multiplier:g.multiplier,ok:true,...extra});
  let counts=g.level===1?kind==='plant':kind!=='dish';
  if(kind==='dish'&&!g.requiredDishComplete&&extra.recipeId===g.stage.requiredDish){g.requiredDishComplete=true;g.cookingFocus=null;g.lessonObjective.complete=true;counts=true;emit(g,{type:'lesson-complete',kind:'dish',recipeId:extra.recipeId});}
  if(kind==='meal'&&!g.requiredMealComplete){g.requiredMealComplete=true;g.lessonObjective.complete=true;emit(g,{type:'lesson-complete',kind:'meal'});}
  if(counts)g.stageCompleted=Math.min(g.stage.goal,g.stageCompleted+1);
  if(g.level===1){const current=firstStagePace(g);g.spawnRemaining=Math.min(g.spawnRemaining,current.spawnDelay);if(current.phase!==g.practicePhase){g.practicePhase=current.phase;emit(g,{type:'pace-up',kind:'plant',phase:current.phase,remaining:g.stage.goal-g.stageCompleted});}}
  if(g.stageCompleted>=g.stage.goal&&g.requiredDishComplete&&g.requiredMealComplete)finishStage(g);
  return event;
}
export function createHouse({random:source=Math.random}={}){
  const g={phase:'playing',won:false,elapsed:0,stageElapsed:0,level:1,score:0,strikes:0,combo:0,bestCombo:0,multiplier:1,comboRemaining:0,selected:null,
    stageCompleted:0,completedLevels:0,stageScores:Array(10).fill(0),unlockedTools:[],unlockedRecipes:[],seededRecipes:[],tutorial:null,plantDeck:[],wateredSlots:[],
    inventory:Object.fromEntries(RECIPES.map(r=>[r.id,0])),kitchen:Object.fromEntries(RECIPES.map(r=>[r.id,{step:0,remaining:0,state:'prep'}])),tasks:[],stats:{meals:0,snacks:0,plants:0,dust:0,cats:0,dishes:0,missed:0},events:[],serial:0,random:typeof source==='function'?source:Math.random};
  startStage(g,0);return g;
}
export function advanceStage(g){if(g.phase!=='stage-complete'||g.level>=STAGES.length)return false;startStage(g,g.level);return true;}
export function selectTool(g,id){if(g.phase!=='playing'||!toolIds.has(id)||!g.unlockedTools.includes(id))return false;g.selected=id;return true;}
export function actHouse(g,targetId){
  if(g.phase!=='playing'||typeof targetId!=='string')return null;
  if(targetId.startsWith('cook-')){
    const r=recipeById.get(targetId.slice(5));if(!r)return null;
    if(!g.unlockedRecipes.includes(r.id))return emit(g,{type:'locked',kind:'dish',targetId,recipeId:r.id,ok:false});
    const k=g.kitchen[r.id];if(k.state==='cooking')return emit(g,{type:'busy',kind:'dish',targetId,recipeId:r.id,ok:false});
    if(g.inventory[r.id]>=STOCK_LIMIT)return emit(g,{type:'full',kind:'dish',targetId,recipeId:r.id,ok:false});
    const next=r.steps[k.step];if(g.selected!==next.tool)return emit(g,{type:'wrong',kind:'dish',targetId,recipeId:r.id,required:next.tool,ok:false});
    k.step++;if(k.step===r.steps.length){k.state='cooking';k.remaining=r.duration;return emit(g,{type:'cooking',kind:'dish',targetId,recipeId:r.id,ok:true});}
    return emit(g,{type:'prep',kind:'dish',targetId,recipeId:r.id,step:k.step,required:r.steps[k.step].tool,ok:true});
  }
  const index=g.tasks.findIndex(t=>t.id===targetId);if(index<0)return null;const task=g.tasks[index];
  if(task.type==='guest'){
    if(g.selected==='serve'){g.tasks.splice(index,1);return success(g,'meal',targetId,{guest:task.guest,recipeId:task.recipeId});}return emit(g,{type:'wrong',kind:'guest',targetId,required:'serve',ok:false});
  }
  if(g.selected!==needTool[task.type])return emit(g,{type:'wrong',kind:task.type,targetId,required:needTool[task.type],ok:false});
  g.tasks.splice(index,1);if(g.level===1&&task.type==='plant')g.wateredSlots.push(task.slot);return success(g,task.type,targetId);
}
function tick(g,dt){
  g.elapsed=round(g.elapsed+dt);g.stageElapsed=round(g.stageElapsed+dt);
  if(!pace(g).untimed&&g.comboRemaining>0){g.comboRemaining=Math.max(0,g.comboRemaining-dt);if(g.comboRemaining<1e-8)breakCombo(g);}
  for(const r of RECIPES){const k=g.kitchen[r.id];if(k.state!=='cooking')continue;k.remaining=Math.max(0,k.remaining-dt);if(k.remaining<1e-8){k.remaining=0;k.step=0;k.state='prep';g.inventory[r.id]=Math.min(STOCK_LIMIT,g.inventory[r.id]+1);success(g,'dish',`cook-${r.id}`,{recipeId:r.id,ready:true});if(g.phase!=='playing')return;}}
  for(const task of [...g.tasks]){
    if(task.untimed)continue;let approachDt=dt;
    if(task.type==='cat'&&task.waiting>0){const wait=Math.min(task.waiting,dt);task.waiting=Math.max(0,round(task.waiting-wait));approachDt-=wait;if(task.waiting===0){task.state='approaching';emit(g,{type:'cat-approach',kind:'cat',targetId:task.id});}}
    task.remaining=Math.max(0,task.remaining-approachDt);if(task.remaining>=1e-8)continue;g.tasks.splice(g.tasks.indexOf(task),1);g.stats.missed++;breakCombo(g);g.spawnRemaining=pace(g).spawnDelay;
    if(task.type==='cat'){g.strikes++;emit(g,{type:'strike',kind:'cat',targetId:task.id,strikes:g.strikes});if(g.strikes===3){g.phase='finished';g.won=false;g.tasks=[];emit(g,{type:'finished',score:g.score,won:false});return;}}
    else emit(g,{type:'missed',kind:task.type,targetId:task.id,guest:task.guest});
  }
  const current=pace(g);if(g.tasks.length<current.maxActive){g.spawnRemaining=Math.max(0,round(g.spawnRemaining-dt));if(g.spawnRemaining===0){nextTask(g);g.spawnRemaining=current.spawnDelay;}}
}
export function advanceHouse(g,seconds){
  if(g.phase!=='playing'||!Number.isFinite(seconds)||seconds<=0)return g;let remaining=Math.min(seconds,60);
  while(remaining>1e-8&&g.phase==='playing'){const dt=Math.min(.1,remaining);tick(g,dt);remaining-=dt;}return g;
}
