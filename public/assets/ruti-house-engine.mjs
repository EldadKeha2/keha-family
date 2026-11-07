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
  {id:'hand',he:'לכו מפה',en:'Shoo!',emoji:'✋'},
  {id:'argue',he:'ויכוח',en:'Argument',emoji:'🗣️'},
  {id:'serve',he:'אוכל',en:'Food',emoji:'🍽️'},
  {id:'peanuts',he:'בוטנים',en:'Peanuts',emoji:'🥜'}
].map(Object.freeze));
export const POINTS=Object.freeze({meal:300,snack:200,plant:40,dust:20,cat:60,dish:20});
export const HOUSE_SLOTS=Object.freeze({plant:4,dust:6,cat:2,guest:2});
export const HOUSE_GUESTS=Object.freeze(['roi','hila','rivi','lihi']);
export const HOUSE_VISITORS=Object.freeze(['visitor-man','visitor-hila','visitor-rivi','visitor-lihi']);
export const STOCK_LIMIT=3;
export const ORA_BONUS=5000;
export const CAT_COATS=Object.freeze([
  {body:'#c49b6f',head:'#d5b48b',edge:'#76583e',patch:'#98623d',pattern:'tabby'},
  {body:'#767e8b',head:'#a4aab5',edge:'#39414d',patch:'#454b57',pattern:'tabby'},
  {body:'#f4ece0',head:'#fff7eb',edge:'#847767',patch:'#c17f46',pattern:'spots'},
  {body:'#353a43',head:'#4d535d',edge:'#222831',patch:'#f1eee5',pattern:'tuxedo'},
  {body:'#d5c8ad',head:'#f0e4cf',edge:'#6c6151',patch:'#7e5942',pattern:'spots'}
].map(Object.freeze));
export const oraWindow=level=>level===4?6:Math.max(1.6,4.4-(level-5)*.55);
const stage=(level,he,en,newFeature,goal,maxActive,order,deadlines,catWait,spawnDelay,{requiredDish=null,requiredMeal=false}={})=>Object.freeze({
  level,he,en,newFeature,goal,maxActive,types:Object.freeze([...new Set([...order,...(level>=6?['guest']:[])])]),order:Object.freeze(order),deadlines:Object.freeze(deadlines),catWait,spawnDelay,
  untimed:false,requiredDish,requiredMeal,guestMode:level>=11?'mixed':level>=6?'family':null,
  hintHe:level===1?'מטפלים בארבעת העציצים ובבית. מתחילים בנחת; בהמשך מגיבים להבהוב בזמן ומטאטאים כשמופיע אבק.':level===2?'אותם ארבעה עציצים ואותו מטאטא, בקצב מהיר יותר. משלימים מטלות נוספות.':level===3?'משקים, מטאטאים ומבריחים חתולים משתי הכניסות.':level===4?'אותם כלים, יותר בקשות ופחות זמן. שומרים גם על שתי הכניסות.':requiredMeal?'בוחרים אוכל ולוחצים על האורח. רותי מגישה לו אחד מהמטעמים שלה.':'ניגשים למשימות ושומרים על בית מלא חיים.',
  hintEn:level===1?'Care for the four plants and the home. Start gently, then respond to their flashing signals before time runs out and sweep when dust appears.':level===2?'The same four plants and broom, at a faster pace. Complete more household tasks.':level===3?'Water, sweep and shoo cats away from both entrances.':level===4?'The same tools, more requests and less time. Watch both entrances.':requiredMeal?'Choose Food and tap the guest. Ruti serves one of her delicious dishes.':'Care for each task and keep the home full of life.',
  unlockedTools:Object.freeze(['water','broom',...(level>=3?['hand']:[]),...(level>=4?['argue']:[]),...(level>=6?['serve']:[]),...(level>=11?['peanuts']:[])]),
  unlockedRecipes:Object.freeze([])
});
export const STAGES=Object.freeze([
  stage(1,'הגינה מתעוררת','The garden wakes up','water',30,2,['plant','dust'],{plant:20,dust:24},0,2.3),
  stage(2,'הגינה בקצב מהיר','The garden picks up the pace',null,30,3,['plant','plant','plant','dust','plant'],{plant:11,dust:14},0,1.2),
  stage(3,'חתולים בשתי הכניסות','Cats at both entrances','cat',30,3,['cat','plant','plant','dust','plant'],{plant:18,dust:22,cat:38},3,1.8),
  stage(4,'הבית מגביר קצב','The house picks up the pace',null,30,4,['cat','plant','plant','dust','plant'],{plant:12,dust:16,cat:25},2,1.2),
  stage(5,'הקצב עולה','Picking up the pace',null,30,4,['cat','plant','plant','dust','plant'],{plant:10,dust:13,cat:21},1.6,1),
  stage(6,'משהו טעים למשפחה','A treat for the family','guests',30,3,['plant','dust','cat','plant'],{plant:30,dust:26,cat:32,guest:55},5,1.8,{requiredMeal:true}),
  stage(7,'עוד משפחה בדלת','More family at the door',null,30,4,['plant','cat','dust','plant'],{plant:27,dust:23,cat:27,guest:48},4.5,1.6),
  stage(8,'בקצב של רותי','Ruti’s rhythm',null,30,4,['cat','plant','dust','plant'],{plant:24,dust:20,cat:22,guest:42},4,1.4),
  stage(9,'כולם בדרך','Everyone is on the way',null,30,5,['cat','plant','dust','plant','cat','plant'],{plant:21,dust:17,cat:17,guest:36},3.5,1.2),
  stage(10,'הלב של הבית','The heart of the home',null,30,5,['cat','plant','dust','plant','cat','dust','plant'],{plant:19,dust:15,cat:13,guest:31},3,1.1),
  stage(11,'מי בא להתארח?','Who is visiting?','peanuts',30,5,['cat','plant','dust','plant','cat','dust','plant'],{plant:18,dust:14,cat:12,guest:28},2.5,1),
  stage(12,'דלת פתוחה','An open door',null,30,6,['cat','plant','dust','plant','cat','dust','plant'],{plant:16,dust:12,cat:10,guest:24},2,.9)
]);
// One extended opening lesson: six relaxed waterings, then progressively
// shorter response windows that still allow Ruti to fetch a tool and walk.
const FIRST_STAGE_PACES=Object.freeze([
  Object.freeze({phase:0,from:0,maxActive:1,spawnDelay:2.3,plant:20,dust:24,untimed:true}),
  Object.freeze({phase:1,from:6,maxActive:1,spawnDelay:2,plant:20,dust:24,untimed:false}),
  Object.freeze({phase:2,from:15,maxActive:2,spawnDelay:3,plant:16,dust:20,untimed:false}),
  Object.freeze({phase:3,from:24,maxActive:2,spawnDelay:2.5,plant:12,dust:16,untimed:false})
]);
export function firstStagePace(g){return FIRST_STAGE_PACES.findLast(p=>(g.stageResolved??g.stageCompleted)>=p.from)||FIRST_STAGE_PACES[0];}
// The second round repeats the opening tasks without the relaxed practice.
// Halfway through it adds one more overlapping request and shorter windows.
export function secondStagePace(g){return (g.stageResolved??g.stageCompleted)<15?{phase:0,maxActive:2,spawnDelay:1.2,plant:11,dust:14,untimed:false}:{phase:1,maxActive:3,spawnDelay:1,plant:9,dust:12,untimed:false};}
function pace(g){return g.level===1?firstStagePace(g):g.level===2?secondStagePace(g):{...g.stage,untimed:false,...g.stage.deadlines};}
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
  const current=pace(g);if(g.tasks.length>=current.maxActive||g.stageIssued>=g.stage.goal)return null;
  const isDoor=type==='cat'||type==='guest',free=Array.from({length:HOUSE_SLOTS[type]},(_,i)=>i).filter(slot=>!g.tasks.some(t=>t.slot===slot&&(isDoor?t.type==='cat'||t.type==='guest':t.type===type)));
  if(!free.length)return null;
  let slot=choose(g,free);
  if(g.level<=2&&type==='plant'){
    if(!g.plantDeck.length)g.plantDeck=shuffledPlants(g);
    let index=g.plantDeck.findIndex(value=>free.includes(value)&&value!==g.lastPlantSlot);
    if(index<0)index=g.plantDeck.findIndex(value=>free.includes(value));
    if(index<0){g.plantDeck=shuffledPlants(g).filter(value=>free.includes(value));index=g.plantDeck.findIndex(value=>value!==g.lastPlantSlot);if(index<0)index=0;}
    slot=g.plantDeck.splice(index,1)[0];g.lastPlantSlot=slot;
  }
  if(type==='cat'){const otherDoor=free.filter(value=>value!==g.lastCatDoor);if(otherDoor.length)slot=choose(g,otherDoor);g.lastCatDoor=slot;}
  const total=current[type],task={id:`${type}-${++g.serial}`,type,slot,remaining:total,total,createdAt:g.elapsed};
  if(current.untimed)task.untimed=true;
  if(isDoor)task.door=task.slot;
  if(type==='cat'){task.waiting=g.stage.catWait;task.waitingTotal=task.waiting;task.state=task.waiting>0?'waiting':'approaching';task.coat=Math.floor(random(g)*CAT_COATS.length);task.size=choose(g,[.8,1,1.18]);}
  if(type==='dust')task.position=dustPosition(g);
  if(type==='guest'){const pool=g.stage.guestMode==='mixed'?[...HOUSE_GUESTS,...HOUSE_VISITORS]:HOUSE_GUESTS;const available=pool.filter(guest=>!g.tasks.some(t=>t.type==='guest'&&t.guest===guest));if(!available.length)return null;task.guest=choose(g,available);task.food=HOUSE_VISITORS.includes(task.guest)?'peanuts':'serve';task.recipeId=task.food==='serve'?choose(g,RECIPES).id:null;}
  g.tasks.push(task);g.spawned++;g.stageIssued++;emit(g,{type:'spawn',kind:type,targetId:task.id});return task;
}
function nextTask(g){const order=g.level===1?(g.stageResolved<6?['plant']:['plant','plant','plant','dust','plant']):g.stage.order;for(let n=0;n<order.length;n++){if(spawn(g,order[g.typeCursor++%order.length]))return true;}return false;}
function startStage(g,index){
  const plan=STAGES[index];Object.assign(g,{stage:plan,level:plan.level,phase:'playing',stageCompleted:0,stageIssued:0,stageResolved:0,stageElapsed:0,tasks:[],selected:null,typeCursor:0,spawned:0,spawnRemaining:plan.spawnDelay,tutorial:null,lastCatDoor:null});breakCombo(g);
  g.stageStats={meals:0,snacks:0,plants:0,dust:0,cats:0,dishes:0,oraWins:0};
  g.ora=null;g.oraAttempted=false;g.oraAt=plan.level>=4?10+Math.floor(random(g)*13):Infinity;g.oraBonusRemaining=0;g.nextGuestAt=plan.guestMode?15.4+random(g)*7.6:Infinity;
  g.unlockedTools=[...plan.unlockedTools];g.unlockedRecipes=[...plan.unlockedRecipes];
  g.requiredDishComplete=!plan.requiredDish;g.requiredMealComplete=!plan.requiredMeal;g.cookingFocus=plan.requiredDish;
  g.lessonObjective=plan.requiredDish?{kind:'dish',recipeId:plan.requiredDish,complete:false}:plan.requiredMeal?{kind:'meal',complete:false}:null;
  for(const id of plan.unlockedRecipes)if(!g.seededRecipes.includes(id)){g.inventory[id]=1;g.seededRecipes.push(id);}
  if(index<=1){g.plantDeck=shuffledPlants(g);g.lastPlantSlot=null;}
  if(index===0){g.wateredSlots=[];g.practicePhase=0;}
  // Cooking and baking begin with the new dish in focus, before household
  // requests arrive. Other stages introduce their new task immediately.
  if(!plan.requiredDish)nextTask(g);
  emit(g,{type:'stage-start',level:g.level,goal:plan.goal,newFeature:plan.newFeature});
}
function finishStage(g){
  g.completedLevels=g.level;g.tasks=[];g.ora=null;g.spawnRemaining=0;
  if(g.level===STAGES.length){g.phase='finished';g.won=true;}else g.phase='stage-complete';
  emit(g,{type:'stage-clear',level:g.level,stageScore:g.stageScores[g.level-1],won:g.won});if(g.won)emit(g,{type:'finished',score:g.score,won:true});
}
function responseReward(g,task,respondedAt){
  // Use active game time at the correct click, before Ruti walks or animates.
  // Cat waiting is part of its visible response window; practice still has
  // no deadline, but earns a smaller bonus if the player takes more time.
  const at=Number.isFinite(respondedAt)?Math.min(g.elapsed,respondedAt):g.elapsed;
  const responseSeconds=Math.max(0,round(at-(task.createdAt??0)));
  const window=task.total+(task.waitingTotal||0);
  const speedMultiplier=1+(window>0?Math.max(0,1-responseSeconds/window):0);
  return {responseSeconds,speedMultiplier};
}
function success(g,kind,targetId,extra={}){
  g.combo++;g.bestCombo=Math.max(g.bestCombo,g.combo);g.comboRemaining=g.level<5?16:12;g.multiplier=1+Math.min(4,Math.floor(g.combo/5))*.25;
  const points=Math.round(POINTS[kind]*g.multiplier*(extra.speedMultiplier??1));g.score+=points;g.stageScores[g.level-1]+=points;g.stats[statsKey[kind]]++;g.stageStats[statsKey[kind]]++;
  const event=emit(g,{type:'success',kind,points,targetId,combo:g.combo,multiplier:g.multiplier,ok:true,...extra});
  const counts=kind!=='dish';
  if(kind==='dish'&&!g.requiredDishComplete&&extra.recipeId===g.stage.requiredDish){g.requiredDishComplete=true;g.cookingFocus=null;g.lessonObjective.complete=true;emit(g,{type:'lesson-complete',kind:'dish',recipeId:extra.recipeId});}
  if(kind==='meal'&&!g.requiredMealComplete){g.requiredMealComplete=true;g.lessonObjective.complete=true;emit(g,{type:'lesson-complete',kind:'meal'});}
  if(counts){g.stageCompleted++;resolveTask(g);}
  return event;
}
function spawnOra(g){
  if(g.level<4||g.oraAttempted||g.stageResolved<g.oraAt||g.stageIssued>=g.stage.goal)return;
  g.oraAttempted=true;const total=oraWindow(g.level);let position;
  if(random(g)<.85){
    const edge=Math.floor(random(g)*4);
    position=edge<2?{x:edge===0?.09+random(g)*.06:.85+random(g)*.06,y:.36+random(g)*.49}:{x:.12+random(g)*.76,y:edge===2?.30+random(g)*.05:.85+random(g)*.05};
  }else position={x:.27+random(g)*.46,y:.42+random(g)*.32};
  g.ora={id:`ora-${++g.serial}`,type:'ora',position,remaining:total,total,armed:false};g.stageIssued++;
  emit(g,{type:'ora-spawn',targetId:g.ora.id});
}
function resolveTask(g,{deferFinish=false}={}){
  g.stageResolved++;
  if(g.level===2)g.spawnRemaining=Math.min(g.spawnRemaining,secondStagePace(g).spawnDelay);
  if(g.level===1){const current=firstStagePace(g);g.spawnRemaining=Math.min(g.spawnRemaining,current.spawnDelay);if(current.phase!==g.practicePhase){g.practicePhase=current.phase;emit(g,{type:'pace-up',kind:'plant',phase:current.phase});}}
  if(g.stageResolved>=g.stage.goal){if(!deferFinish)finishStage(g);}
  else spawnOra(g);
}
export function createHouse({random:source=Math.random}={}){
  const g={phase:'playing',won:false,elapsed:0,stageElapsed:0,level:1,score:0,strikes:0,combo:0,bestCombo:0,multiplier:1,comboRemaining:0,selected:null,
    stageCompleted:0,completedLevels:0,stageScores:Array(STAGES.length).fill(0),unlockedTools:[],unlockedRecipes:[],seededRecipes:[],tutorial:null,plantDeck:[],wateredSlots:[],
    inventory:Object.fromEntries(RECIPES.map(r=>[r.id,0])),kitchen:Object.fromEntries(RECIPES.map(r=>[r.id,{step:0,remaining:0,state:'prep'}])),tasks:[],catsInside:[],stats:{meals:0,snacks:0,plants:0,dust:0,cats:0,dishes:0,missed:0,oraWins:0},events:[],serial:0,random:typeof source==='function'?source:Math.random};
  startStage(g,0);return g;
}
export function advanceStage(g){if(g.phase!=='stage-complete'||g.level>=STAGES.length)return false;startStage(g,g.level);return true;}
export function selectTool(g,id){if(g.phase!=='playing'||!toolIds.has(id)||!g.unlockedTools.includes(id)||(id==='argue'&&!g.ora))return false;g.selected=id;if(id==='argue')g.ora.armed=true;return true;}
export function actHouse(g,targetId,{respondedAt}={}){
  if(g.phase!=='playing'||typeof targetId!=='string')return null;
  if(g.ora?.id===targetId){
    if(g.selected!=='argue'||!g.ora.armed)return emit(g,{type:'wrong',kind:'ora',targetId,required:'argue',ok:false});
    g.ora=null;g.selected=null;g.score+=ORA_BONUS;g.stageScores[g.level-1]+=ORA_BONUS;g.stats.oraWins++;g.stageStats.oraWins++;g.stageCompleted++;resolveTask(g,{deferFinish:true});g.phase='ora-bonus';g.oraBonusRemaining=5;
    return emit(g,{type:'ora-win',kind:'ora',points:ORA_BONUS,targetId,ok:true});
  }
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
    const required=task.food||'serve';if(g.selected===required){g.tasks.splice(index,1);return success(g,required==='peanuts'?'snack':'meal',targetId,{guest:task.guest,recipeId:task.recipeId,...responseReward(g,task,respondedAt)});}return emit(g,{type:'wrong',kind:'guest',targetId,required,ok:false});
  }
  if(g.selected!==needTool[task.type])return emit(g,{type:'wrong',kind:task.type,targetId,required:needTool[task.type],ok:false});
  g.tasks.splice(index,1);if(g.level===1&&task.type==='plant')g.wateredSlots.push(task.slot);return success(g,task.type,targetId,responseReward(g,task,respondedAt));
}
function tick(g,dt){
  g.elapsed=round(g.elapsed+dt);g.stageElapsed=round(g.stageElapsed+dt);
  if(g.ora){g.ora.remaining=Math.max(0,round(g.ora.remaining-dt));if(g.ora.remaining===0){const targetId=g.ora.id;g.ora=null;if(g.selected==='argue')g.selected=null;g.stats.missed++;emit(g,{type:'ora-missed',targetId});resolveTask(g);if(g.phase!=='playing')return;}}
  if(!pace(g).untimed&&g.comboRemaining>0){g.comboRemaining=Math.max(0,g.comboRemaining-dt);if(g.comboRemaining<1e-8)breakCombo(g);}
  for(const r of RECIPES){const k=g.kitchen[r.id];if(k.state!=='cooking')continue;k.remaining=Math.max(0,k.remaining-dt);if(k.remaining<1e-8){k.remaining=0;k.step=0;k.state='prep';g.inventory[r.id]=Math.min(STOCK_LIMIT,g.inventory[r.id]+1);success(g,'dish',`cook-${r.id}`,{recipeId:r.id,ready:true});if(g.phase!=='playing')return;}}
  for(const task of [...g.tasks]){
    if(task.untimed)continue;let approachDt=dt;
    if(task.type==='cat'&&task.waiting>0){const wait=Math.min(task.waiting,dt);task.waiting=Math.max(0,round(task.waiting-wait));approachDt-=wait;if(task.waiting===0){task.state='approaching';emit(g,{type:'cat-approach',kind:'cat',targetId:task.id});}}
    task.remaining=Math.max(0,task.remaining-approachDt);if(task.remaining>=1e-8)continue;g.tasks.splice(g.tasks.indexOf(task),1);g.stats.missed++;breakCombo(g);g.spawnRemaining=pace(g).spawnDelay;
    if(task.type==='cat'){g.catsInside.push({id:task.id,coat:task.coat,size:task.size,door:task.door,enteredAt:g.elapsed,pathSeed:random(g)});g.strikes++;emit(g,{type:'strike',kind:'cat',targetId:task.id,strikes:g.strikes});if(g.strikes===3){g.stageResolved++;g.phase='finished';g.won=false;g.tasks=[];g.ora=null;emit(g,{type:'finished',score:g.score,won:false});return;}}
    else emit(g,{type:'missed',kind:task.type,targetId:task.id,guest:task.guest});
    resolveTask(g);if(g.phase!=='playing')return;
  }
  if(g.stage.guestMode&&g.stageElapsed>=g.nextGuestAt&&g.stageIssued<g.stage.goal){if(spawn(g,'guest'))g.nextGuestAt=g.stageElapsed+12+random(g)*14;}
  const current=pace(g);if(g.tasks.length<current.maxActive){g.spawnRemaining=Math.max(0,round(g.spawnRemaining-dt));if(g.spawnRemaining===0){nextTask(g);g.spawnRemaining=current.spawnDelay;}}
}
export function advanceHouse(g,seconds){
  if(g.phase==='ora-bonus'&&Number.isFinite(seconds)&&seconds>0){g.oraBonusRemaining=Math.max(0,round(g.oraBonusRemaining-seconds));if(g.oraBonusRemaining===0){g.phase='playing';emit(g,{type:'ora-bonus-end'});if(g.stageResolved>=g.stage.goal)finishStage(g);}return g;}
  if(g.phase!=='playing'||!Number.isFinite(seconds)||seconds<=0)return g;let remaining=Math.min(seconds,60);
  while(remaining>1e-8&&g.phase==='playing'){const dt=Math.min(.1,remaining);tick(g,dt);remaining-=dt;}return g;
}
