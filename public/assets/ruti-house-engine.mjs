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
export const HOUSE_SLOTS=Object.freeze({plant:5,dust:6,cat:3,guest:3});
export const HOUSE_GUESTS=Object.freeze(['roi','hila','rivi']);
export const STOCK_LIMIT=3;
export const LEVEL_SECONDS=24;
const toolIds=new Set(TOOLS.map(tool=>tool.id));
const recipeById=new Map(RECIPES.map(recipe=>[recipe.id,recipe]));
const statsKey={meal:'meals',snack:'snacks',plant:'plants',dust:'dust',cat:'cats',dish:'dishes'};
const needTool={plant:'water',dust:'broom',cat:'hand'};

function random(g){const n=Number(g.random());return Number.isFinite(n)?Math.max(0,Math.min(.999999999,n)):.5;}
function choose(g,list){return list[Math.floor(random(g)*list.length)];}
function emit(g,event){const value={at:g.elapsed,...event};g.events.push(value);if(g.events.length>256)g.events.splice(0,g.events.length-256);return value;}
function difficulty(g){return Math.min(12,g.level)-1;}
function interval(g,type){
  const d=difficulty(g),base={plant:5.8,dust:4,guest:7.2,cat:11.5}[type],floor={plant:2.5,dust:1.7,guest:3.5,cat:3.8}[type];
  return Math.max(floor,base-d*{plant:.34,dust:.24,guest:.4,cat:.78}[type])*(.82+random(g)*.36);
}
function lifetime(g,type){
  const d=difficulty(g);
  return Math.max({plant:9,dust:3.4,guest:11,cat:4.2}[type],{plant:19,dust:8,guest:26,cat:10}[type]-d*{plant:.9,dust:.45,guest:1.3,cat:.55}[type]);
}
function spawn(g,type,options={}){
  const free=Array.from({length:HOUSE_SLOTS[type]},(_,i)=>i).filter(slot=>!g.tasks.some(task=>task.type===type&&task.slot===slot));
  if(!free.length)return null;
  const total=lifetime(g,type),task={id:`${type}-${++g.serial}`,type,slot:choose(g,free),remaining:total,total};
  if(type==='guest'){
    const available=HOUSE_GUESTS.filter(guest=>!g.tasks.some(other=>other.type==='guest'&&other.guest===guest));
    if(!available.length)return null;
    task.guest=choose(g,available);task.recipeId=options.recipeId||choose(g,RECIPES).id;
  }
  g.tasks.push(task);emit(g,{type:'spawn',kind:type,targetId:task.id});return task;
}
function success(g,kind,targetId,extra={}){
  g.combo++;g.bestCombo=Math.max(g.bestCombo,g.combo);g.comboRemaining=8;
  g.multiplier=1+Math.min(4,Math.floor(g.combo/5))*.25;
  const points=Math.round(POINTS[kind]*g.multiplier);
  g.score+=points;g.stats[statsKey[kind]]++;
  return emit(g,{type:'success',kind,points,targetId,combo:g.combo,multiplier:g.multiplier,ok:true,...extra});
}
function breakCombo(g){g.combo=0;g.multiplier=1;g.comboRemaining=0;}

export function createHouse({random:source=Math.random}={}){
  const g={phase:'playing',elapsed:0,level:1,score:0,strikes:0,combo:0,bestCombo:0,multiplier:1,comboRemaining:0,selected:'bowl',
    inventory:Object.fromEntries(RECIPES.map(recipe=>[recipe.id,1])),kitchen:Object.fromEntries(RECIPES.map(recipe=>[recipe.id,{step:0,remaining:0,state:'prep'}])),
    tasks:[],stats:{meals:0,snacks:0,plants:0,dust:0,cats:0,dishes:0,missed:0},events:[],serial:0,
    schedule:{plant:4.8,dust:2.7,guest:6.5,cat:7.5},random:typeof source==='function'?source:Math.random};
  spawn(g,'plant');spawn(g,'dust');spawn(g,'guest',{recipeId:'tahini'});return g;
}

export function selectTool(g,id){
  if(g.phase!=='playing'||!toolIds.has(id))return false;
  g.selected=id;return true;
}

export function actHouse(g,targetId){
  if(g.phase!=='playing')return null;
  if(typeof targetId!=='string')return null;
  if(targetId.startsWith('cook-')){
    const recipe=recipeById.get(targetId.slice(5));if(!recipe)return null;
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
  g.elapsed=Math.round((g.elapsed+dt)*1e9)/1e9;
  const level=1+Math.floor(g.elapsed/LEVEL_SECONDS);
  if(level!==g.level){g.level=level;emit(g,{type:'level',level});}
  if(g.comboRemaining>0){g.comboRemaining=Math.max(0,g.comboRemaining-dt);if(g.comboRemaining<1e-8)breakCombo(g);}
  for(const recipe of RECIPES){
    const kitchen=g.kitchen[recipe.id];if(kitchen.state!=='cooking')continue;
    kitchen.remaining=Math.max(0,kitchen.remaining-dt);
    if(kitchen.remaining<1e-8){kitchen.remaining=0;kitchen.step=0;kitchen.state='prep';g.inventory[recipe.id]=Math.min(STOCK_LIMIT,g.inventory[recipe.id]+1);success(g,'dish',`cook-${recipe.id}`,{recipeId:recipe.id,ready:true});}
  }
  for(const task of [...g.tasks]){
    task.remaining=Math.max(0,task.remaining-dt);if(task.remaining>=1e-8)continue;
    g.tasks.splice(g.tasks.indexOf(task),1);g.stats.missed++;breakCombo(g);
    if(task.type==='cat'){
      g.strikes++;emit(g,{type:'strike',kind:'cat',targetId:task.id,strikes:g.strikes});
      if(g.strikes===3){g.phase='finished';emit(g,{type:'finished',score:g.score});return;}
    }else emit(g,{type:'missed',kind:task.type,targetId:task.id,guest:task.guest});
  }
  for(const type of Object.keys(g.schedule)){
    g.schedule[type]-=dt;
    if(g.schedule[type]<=1e-8){spawn(g,type);g.schedule[type]=interval(g,type);}
  }
}

export function advanceHouse(g,seconds){
  if(g.phase!=='playing'||!Number.isFinite(seconds)||seconds<=0)return g;
  // A suspended browser never receives an unbounded backlog of events.
  let remaining=Math.min(seconds,60);
  while(remaining>1e-8&&g.phase==='playing'){const dt=Math.min(.1,remaining);tick(g,dt);remaining-=dt;}
  return g;
}
