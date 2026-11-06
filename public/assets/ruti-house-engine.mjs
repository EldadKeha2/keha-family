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
  {id:'bowl',he:'קערה וכף',en:'Bowl & spoon',emoji:'🥣'},
  {id:'knife',he:'סכין',en:'Knife',emoji:'🔪'},
  {id:'oven',he:'כפפת תנור',en:'Oven mitt',emoji:'🧤'},
  {id:'serve',he:'מגש אוכל',en:'Serving tray',emoji:'🍽️'},
  {id:'peanuts',he:'בוטנים',en:'Peanuts',emoji:'🥜'},
  {id:'water',he:'משפך',en:'Watering can',emoji:'🚿'},
  {id:'broom',he:'מטאטא',en:'Broom',emoji:'🧹'},
  {id:'hand',he:'לכו מפה!',en:'Shoo!',emoji:'✋'}
].map(Object.freeze));
export const POINTS=Object.freeze({meal:300,snack:200,plant:40,dust:20,cat:60,dish:20});
export const HOUSE_SLOTS=Object.freeze({plant:5,dust:6,cat:2,guest:2});
export const HOUSE_GUESTS=Object.freeze(['roi','hila','rivi']);
export const STOCK_LIMIT=3;
const baseTools=['water','broom'];
const kitchenTools=['bowl','knife','serve','peanuts'];
const stage=(level,he,en,hintHe,hintEn,goal,maxActive,order,deadlines,catWait,spawnDelay,recipes)=>Object.freeze({
  level,he,en,hintHe,hintEn,goal,maxActive,types:Object.freeze([...new Set(order)]),order:Object.freeze(order),
  deadlines:Object.freeze({plant:45,dust:35,guest:55,cat:38,...deadlines}),catWait,spawnDelay,
  unlockedTools:Object.freeze(level===1?['water']:level===2?baseTools:level===3?[...baseTools,...kitchenTools]:[...baseTools,...kitchenTools,'oven','hand']),
  unlockedRecipes:Object.freeze(recipes)
});
export const STAGES=Object.freeze([
  stage(1,'מתחילים בעציץ אחד','One plant at a time','קחו את המשפך והשקו את העציץ. יש לכם דקה שלמה.','Pick up the watering can and water the plant. You have a full minute.',1,1,['plant'],{plant:60},0,4,[]),
  stage(2,'פינה נקייה','A clean corner','קחו את המטאטא ונקו שלוש פינות, אחת בכל פעם.','Pick up the broom and clean three corners, one at a time.',3,1,['dust'],{dust:40},0,3,[]),
  stage(3,'מישהו בא הביתה','Someone is coming home','קחו מגש והגישו את המנה המבוקשת, או בוטנים. אל תשכחו את העציצים.','Take the tray and serve the requested dish, or peanuts. Remember the plants.',5,2,['guest','plant','plant','guest'],{guest:55,plant:45},0,4.5,['tahini','carrot']),
  stage(4,'חתול ליד הדלת','A cat at the door','החתול מחכה בחוץ לפני שהוא מתקרב. קחו את היד וגרשו אותו בזמן.','The cat waits outside before approaching. Take the hand and shoo it away in time.',7,2,['cat','guest','dust','plant'],{cat:38,guest:50,plant:40,dust:32},6,4,['tahini','carrot','kubaneh']),
  stage(5,'ריח של בישולים','Something delicious cooking','גם סלט החצילים מצטרף. מכינים בזמן שהבית ממשיך לחיות.','Eggplant salad joins the kitchen. Prepare it while the house keeps moving.',9,3,['guest','plant','cat','dust','guest'],{cat:30,guest:45,plant:34,dust:26},5.5,3.8,['tahini','carrot','kubaneh','eggplant']),
  stage(6,'עוד מקום סביב השולחן','Room around the table','הלזניה בתנור, המשפחה בדלת. מתכננים צעד אחד קדימה.','Lasagna in the oven, family at the door. Think one step ahead.',11,3,['guest','dust','cat','plant','guest'],{cat:25,guest:40,plant:30,dust:22},5,3.5,['tahini','carrot','kubaneh','eggplant','lasagna']),
  stage(7,'הבית מתמלא','A bustling home','ארבע משימות לכל היותר. בחרו מה דחוף ומה יכול לחכות.','Up to four tasks. Decide what is urgent and what can wait.',13,4,['cat','guest','plant','dust','guest','plant'],{cat:20,guest:35,plant:26,dust:18},4.5,3.2,['tahini','carrot','kubaneh','eggplant','lasagna']),
  stage(8,'בקצב של רותי','Ruti’s rhythm','הכלים חוזרים למקום והאוכל ממשיך להתבשל. שומרים על הקצב.','Tools return to their places and food keeps cooking. Keep the rhythm.',15,4,['guest','cat','dust','plant','guest','dust'],{cat:15,guest:30,plant:23,dust:15},4,2.9,['tahini','carrot','kubaneh','eggplant','lasagna']),
  stage(9,'כולם בדרך','Everyone is on the way','חמש משימות לכל היותר. המגש והיד הולכים לעבוד.','Up to five tasks. The tray and the hand have work to do.',17,5,['cat','guest','plant','dust','guest','cat','plant'],{cat:10,guest:25,plant:20,dust:12},3.5,2.6,['tahini','carrot','kubaneh','eggplant','lasagna']),
  stage(10,'הלב של הבית','The heart of the home','האתגר האחרון: עשרים משימות, בית מלא חיים ולב גדול.','The final challenge: twenty tasks, a lively house and a big heart.',20,6,['guest','cat','plant','dust','guest','cat','dust','plant'],{cat:6,guest:22,plant:17,dust:10},3,2.3,['tahini','carrot','kubaneh','eggplant','lasagna'])
]);
const toolIds=new Set(TOOLS.map(tool=>tool.id));
const recipeById=new Map(RECIPES.map(recipe=>[recipe.id,recipe]));
const statsKey={meal:'meals',snack:'snacks',plant:'plants',dust:'dust',cat:'cats',dish:'dishes'};
const needTool={plant:'water',dust:'broom',cat:'hand'};
const round=n=>Math.round(n*1e9)/1e9;
function random(g){const n=Number(g.random());return Number.isFinite(n)?Math.max(0,Math.min(.999999999,n)):.5;}
function choose(g,list){return list[Math.floor(random(g)*list.length)];}
function emit(g,event){const value={at:g.elapsed,...event};g.events.push(value);if(g.events.length>256)g.events.splice(0,g.events.length-256);return value;}
function breakCombo(g){g.combo=0;g.multiplier=1;g.comboRemaining=0;}

function dustPosition(g){
  // Continuous locations, kept away from the two doorways and the lower tools.
  // Scene code may map these normalized indoor positions to its floor plan.
  const clear=position=>g.tasks.filter(t=>t.type==='dust').every(t=>Math.hypot(t.position.x-position.x,t.position.y-position.y)>.1);
  let position={x:.5,y:.5};
  for(let tries=0;tries<24;tries++){
    position={x:.18+random(g)*.64,y:.29+random(g)*.42};
    if(clear(position))return position;
  }
  // Keep scripted/reproducible random sources from stacking identical dust.
  for(const y of [.31,.45,.59,.7])for(const x of [.2,.34,.48,.62,.76])if(clear({x,y}))return {x,y};
  return position;
}
function spawn(g,type){
  if(g.tasks.length>=g.stage.maxActive)return null;
  const isDoor=type==='cat'||type==='guest';
  const free=Array.from({length:HOUSE_SLOTS[type]},(_,i)=>i).filter(slot=>!g.tasks.some(task=>task.slot===slot&&(isDoor?task.type==='cat'||task.type==='guest':task.type===type)));
  if(!free.length)return null;
  const total=g.stage.deadlines[type],task={id:`${type}-${++g.serial}`,type,slot:g.level===1?0:choose(g,free),remaining:total,total};
  if(isDoor)task.door=task.slot;
  if(type==='cat'){task.waiting=g.stage.catWait;task.waitingTotal=task.waiting;task.state=task.waiting>0?'waiting':'approaching';}
  if(type==='dust')task.position=dustPosition(g);
  if(type==='guest'){
    const available=HOUSE_GUESTS.filter(guest=>!g.tasks.some(other=>other.type==='guest'&&other.guest===guest));
    if(!available.length)return null;
    task.guest=choose(g,available);task.recipeId=choose(g,g.unlockedRecipes);
  }
  g.tasks.push(task);g.spawned++;emit(g,{type:'spawn',kind:type,targetId:task.id});return task;
}
function nextTask(g){
  const order=g.stage.order;
  for(let attempt=0;attempt<order.length;attempt++){
    const type=order[g.typeCursor++%order.length];
    if(spawn(g,type))return true;
  }
  return false;
}
function startStage(g,index){
  const plan=STAGES[index];g.stage=plan;g.level=plan.level;g.phase='playing';g.stageCompleted=0;g.stageElapsed=0;g.tasks=[];g.selected=null;g.typeCursor=0;g.spawned=0;g.spawnRemaining=plan.spawnDelay;breakCombo(g);
  g.unlockedTools=[...plan.unlockedTools];g.unlockedRecipes=[...plan.unlockedRecipes];
  for(const id of plan.unlockedRecipes)if(!g.seededRecipes.includes(id)){g.inventory[id]=1;g.seededRecipes.push(id);}
  nextTask(g);emit(g,{type:'stage-start',level:g.level,goal:plan.goal});
}
function finishStage(g){
  g.completedLevels=g.level;g.tasks=[];g.spawnRemaining=0;
  if(g.level===STAGES.length){g.phase='finished';g.won=true;}else g.phase='stage-complete';
  emit(g,{type:'stage-clear',level:g.level,stageScore:g.stageScores[g.level-1],won:g.won});
  if(g.won)emit(g,{type:'finished',score:g.score,won:true});
}
function success(g,kind,targetId,extra={}){
  g.combo++;g.bestCombo=Math.max(g.bestCombo,g.combo);g.comboRemaining=g.level<5?16:12;
  g.multiplier=1+Math.min(4,Math.floor(g.combo/5))*.25;
  const points=Math.round(POINTS[kind]*g.multiplier);g.score+=points;g.stageScores[g.level-1]+=points;g.stats[statsKey[kind]]++;
  const event=emit(g,{type:'success',kind,points,targetId,combo:g.combo,multiplier:g.multiplier,ok:true,...extra});
  if(kind!=='dish'){
    g.stageCompleted++;g.spawnRemaining=Math.min(g.spawnRemaining||g.stage.spawnDelay,g.stage.spawnDelay);
    if(g.stageCompleted>=g.stage.goal)finishStage(g);
  }
  return event;
}

export function createHouse({random:source=Math.random}={}){
  const g={phase:'playing',won:false,elapsed:0,stageElapsed:0,level:1,score:0,strikes:0,combo:0,bestCombo:0,multiplier:1,comboRemaining:0,selected:null,
    stageCompleted:0,completedLevels:0,stageScores:Array(10).fill(0),unlockedTools:[],unlockedRecipes:[],seededRecipes:[],
    inventory:Object.fromEntries(RECIPES.map(recipe=>[recipe.id,0])),kitchen:Object.fromEntries(RECIPES.map(recipe=>[recipe.id,{step:0,remaining:0,state:'prep'}])),
    tasks:[],stats:{meals:0,snacks:0,plants:0,dust:0,cats:0,dishes:0,missed:0},events:[],serial:0,random:typeof source==='function'?source:Math.random};
  startStage(g,0);return g;
}
export function advanceStage(g){
  if(g.phase!=='stage-complete'||g.level>=STAGES.length)return false;
  startStage(g,g.level);return true;
}
export function selectTool(g,id){
  if(g.phase!=='playing'||!toolIds.has(id)||!g.unlockedTools.includes(id))return false;
  g.selected=id;return true;
}
export function actHouse(g,targetId){
  if(g.phase!=='playing'||typeof targetId!=='string')return null;
  if(targetId.startsWith('cook-')){
    const recipe=recipeById.get(targetId.slice(5));if(!recipe)return null;
    if(!g.unlockedRecipes.includes(recipe.id))return emit(g,{type:'locked',kind:'dish',targetId,recipeId:recipe.id,ok:false});
    const kitchen=g.kitchen[recipe.id];
    if(kitchen.state==='cooking')return emit(g,{type:'busy',kind:'dish',targetId,recipeId:recipe.id,ok:false});
    if(g.inventory[recipe.id]>=STOCK_LIMIT)return emit(g,{type:'full',kind:'dish',targetId,recipeId:recipe.id,ok:false});
    const next=recipe.steps[kitchen.step];
    if(g.selected!==next.tool)return emit(g,{type:'wrong',kind:'dish',targetId,recipeId:recipe.id,required:next.tool,ok:false});
    kitchen.step++;
    if(kitchen.step===recipe.steps.length){kitchen.state='cooking';kitchen.remaining=recipe.duration;return emit(g,{type:'cooking',kind:'dish',targetId,recipeId:recipe.id,ok:true});}
    return emit(g,{type:'prep',kind:'dish',targetId,recipeId:recipe.id,step:kitchen.step,required:recipe.steps[kitchen.step].tool,ok:true});
  }
  const index=g.tasks.findIndex(task=>task.id===targetId);if(index<0)return null;
  const task=g.tasks[index];
  if(task.type==='guest'){
    if(g.selected==='serve'){
      if(g.inventory[task.recipeId]<=0)return emit(g,{type:'empty',kind:'guest',targetId,recipeId:task.recipeId,ok:false});
      g.inventory[task.recipeId]--;g.tasks.splice(index,1);return success(g,'meal',targetId,{guest:task.guest,recipeId:task.recipeId});
    }
    if(g.selected==='peanuts'){g.tasks.splice(index,1);return success(g,'snack',targetId,{guest:task.guest});}
    return emit(g,{type:'wrong',kind:'guest',targetId,required:'serve',ok:false});
  }
  if(g.selected!==needTool[task.type])return emit(g,{type:'wrong',kind:task.type,targetId,required:needTool[task.type],ok:false});
  g.tasks.splice(index,1);return success(g,task.type,targetId);
}
function tick(g,dt){
  g.elapsed=round(g.elapsed+dt);g.stageElapsed=round(g.stageElapsed+dt);
  if(g.comboRemaining>0){g.comboRemaining=Math.max(0,g.comboRemaining-dt);if(g.comboRemaining<1e-8)breakCombo(g);}
  for(const recipe of RECIPES){
    const kitchen=g.kitchen[recipe.id];if(kitchen.state!=='cooking')continue;
    kitchen.remaining=Math.max(0,kitchen.remaining-dt);
    if(kitchen.remaining<1e-8){kitchen.remaining=0;kitchen.step=0;kitchen.state='prep';g.inventory[recipe.id]=Math.min(STOCK_LIMIT,g.inventory[recipe.id]+1);success(g,'dish',`cook-${recipe.id}`,{recipeId:recipe.id,ready:true});}
  }
  for(const task of [...g.tasks]){
    let approachDt=dt;
    if(task.type==='cat'&&task.waiting>0){
      const wait=Math.min(task.waiting,dt);task.waiting=Math.max(0,round(task.waiting-wait));approachDt-=wait;
      if(task.waiting===0){task.state='approaching';emit(g,{type:'cat-approach',kind:'cat',targetId:task.id});}
    }
    task.remaining=Math.max(0,task.remaining-approachDt);if(task.remaining>=1e-8)continue;
    g.tasks.splice(g.tasks.indexOf(task),1);g.stats.missed++;breakCombo(g);g.spawnRemaining=g.stage.spawnDelay;
    if(task.type==='cat'){
      g.strikes++;emit(g,{type:'strike',kind:'cat',targetId:task.id,strikes:g.strikes});
      if(g.strikes===3){g.phase='finished';g.won=false;g.tasks=[];emit(g,{type:'finished',score:g.score,won:false});return;}
    }else emit(g,{type:'missed',kind:task.type,targetId:task.id,guest:task.guest});
  }
  if(g.tasks.length<g.stage.maxActive){
    g.spawnRemaining=Math.max(0,round(g.spawnRemaining-dt));
    if(g.spawnRemaining===0){nextTask(g);g.spawnRemaining=g.stage.spawnDelay;}
  }
}
export function advanceHouse(g,seconds){
  if(g.phase!=='playing'||!Number.isFinite(seconds)||seconds<=0)return g;
  // Bound suspended-browser catch-up; normal UI frames are much shorter.
  let remaining=Math.min(seconds,60);
  while(remaining>1e-8&&g.phase==='playing'){const dt=Math.min(.1,remaining);tick(g,dt);remaining-=dt;}
  return g;
}
