// Three lives, cumulative food points, and a wall-clock deadline.
export const ROUND_MS=5*60*1000;
export const RUNNER_LIVES=3;
export const MIN_ENCOUNTER_GAP=1.2;
export const MAX_ENCOUNTER_FOODS=5;
export const MAX_COLLECTIBLES=Math.ceil(ROUND_MS/1000/MIN_ENCOUNTER_GAP)*MAX_ENCOUNTER_FOODS;
export const GROUND=338;
export const WORLD_HEIGHT=410;
export const PLAYER={x:96,width:42,height:84};
export const FOODS=Object.freeze([
  Object.freeze({id:'jachnun',he:'ג׳חנון',en:'Jachnun',points:4,radius:13}),
  Object.freeze({id:'lahoh',he:'לחוח',en:'Lahoh',points:3,radius:18}),
  Object.freeze({id:'kubaneh',he:'קובנה',en:'Kubaneh',points:2,radius:21}),
  Object.freeze({id:'malawach',he:'מלאווח',en:'Malawach',points:1,radius:25})
]);
export const emptyBasket=()=>Object.fromEntries(FOODS.map(food=>[food.id,0]));
export const basketPoints=basket=>FOODS.reduce((sum,food)=>sum+(basket[food.id]||0)*food.points,0);
export const runnerSpeed=game=>Math.min(330,230+game.distance*.008);
export const remainingMs=(game,now)=>Math.max(0,game.deadline-now);
export function createRunner({now=Date.now(),width=960}={}){
  return {phase:'playing',reason:null,deadline:now+ROUND_MS,width:Math.max(620,width),player:{...PLAYER,y:GROUND-PLAYER.height,vy:0},score:0,basket:emptyBasket(),lives:RUNNER_LIVES,crashes:0,distance:0,plants:[],foods:[],nextSpawn:.75,recoverUntil:0,events:[],sequence:0,patternBag:[],encounters:0};
}
export function jumpRunner(game,now=Date.now()){
  if(game.phase!=='playing'||now>=game.deadline||now<game.recoverUntil||game.player.vy!==0||game.player.y<GROUND-PLAYER.height-.1)return false;
  game.player.vy=-640;return true;
}
export function crashRunner(game,now){
  if(game.phase!=='playing')return;
  game.crashes++;game.lives=Math.max(0,game.lives-1);
  game.plants=[];game.foods=[];game.nextSpawn=.65;game.recoverUntil=now+1100;
  game.player={...PLAYER,y:GROUND-PLAYER.height,vy:0};game.events.push({type:'crash',lives:game.lives});
  if(!game.lives){game.phase='finished';game.reason='lives';game.events.push({type:'finish',reason:'lives'});}
}
export const ENCOUNTER_PATTERNS=Object.freeze(['single','close-pair','stepping-pair','rhythm','food-trail','temptation']);
export function makeEncounter({speed=230,pattern='single',random=Math.random}={}){
  const sample=()=>Math.max(0,Math.min(.999999,random()));
  const plants=[],foods=[];
  const plant=(x,short=false)=>{const shrub={x,width:short?27+sample()*4:30+sample()*8,height:short?45+sample()*10:52+sample()*19};plants.push(shrub);return shrub;};
  const food=(x,y,kind=null,risky=false)=>{const type=kind?FOODS.find(type=>type.id===kind):FOODS[Math.floor(sample()*FOODS.length)];foods.push({x,y,kind:type.id,radius:type.radius,risky});};
  const above=shrub=>food(shrub.x+shrub.width/2,GROUND-shrub.height-50);
  if(pattern==='close-pair'){
    // This entire cluster fits inside the safe flight window, even at minimum speed.
    const a=plant(0,true),b=plant(a.width+14+sample()*5,true);
    if(sample()<.65)food((a.width+b.x)/2,GROUND-125);
  }else if(pattern==='temptation'){
    const a=plant(0),b=plant(speed*(1+sample()*.1));
    a.height=b.height=71;
    // A low bite just before the second bush can be taken, but leaves too little
    // take-off distance to clear that bush. Skipping it permits two safe jumps.
    food(b.x-3,GROUND-20,'jachnun',true);
    if(sample()<.5)above(a);
  }else if(pattern==='stepping-pair'||pattern==='rhythm'){
    const count=pattern==='rhythm'?3:2;let x=0;
    for(let i=0;i<count;i++){
      const shrub=plant(x);if(sample()<.5)above(shrub);
      if(i<count-1){const gap=speed*(.9+sample()*.14);if(sample()<.65)food(x+gap*.64,GROUND-35);x+=gap;}
    }
  }else if(pattern==='food-trail'){
    const startHigh=sample()<.5;
    for(let i=0;i<4;i++)food(i*(61+speed*.06),GROUND-((i%2===0)===startHigh?140:34));
  }else{
    const shrub=plant(0);
    const layout=sample();
    if(layout<.28)above(shrub);
    else if(layout<.57)food(-75-sample()*30,GROUND-35);
    else if(layout<.82)food(shrub.width+75+sample()*25,GROUND-125);
    // Some bushes deliberately have no collectible.
    if(sample()<.25)food(shrub.width+140,GROUND-36);
  }
  const span=Math.max(0,...plants.map(p=>p.x+p.width),...foods.map(f=>f.x+f.radius));
  return {pattern,plants,foods,span};
}
function spawn(game,random){
  const sample=()=>Math.max(0,Math.min(.999999,random()));
  if(!game.patternBag.length){
    game.patternBag=[...ENCOUNTER_PATTERNS];
    for(let i=game.patternBag.length-1;i>0;i--){const j=Math.floor(sample()*(i+1));[game.patternBag[i],game.patternBag[j]]=[game.patternBag[j],game.patternBag[i]];}
  }
  const encounter=makeEncounter({speed:runnerSpeed(game),pattern:game.patternBag.pop(),random});
  const start=game.width+155;
  for(const plant of encounter.plants)game.plants.push({...plant,x:start+plant.x,id:++game.sequence,encounter:game.encounters});
  for(const food of encounter.foods)game.foods.push({...food,x:start+food.x,id:++game.sequence,encounter:game.encounters});
  game.encounters++;game.lastPattern=encounter.pattern;
  game.nextSpawn=encounter.span/runnerSpeed(game)+MIN_ENCOUNTER_GAP+sample()*.45;
}
const intersects=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
export function advanceRunner(game,seconds,now=Date.now(),random=Math.random){
  game.events=[];
  if(game.phase!=='playing')return game;
  if(now>=game.deadline){game.phase='finished';game.reason='time';game.events.push({type:'finish',reason:'time'});return game;}
  if(now<game.recoverUntil)return game;
  // Small physics steps prevent missed food or tunnelling through narrow plants.
  let left=Math.max(0,Math.min(.1,seconds));
  while(left>0){
    const dt=Math.min(1/120,left);left-=dt;
    const move=runnerSpeed(game)*dt,p=game.player;
    game.distance+=move;p.y+=p.vy*dt+875*dt*dt;p.vy+=1750*dt;
    if(p.y>=GROUND-p.height){p.y=GROUND-p.height;p.vy=0;}
    game.nextSpawn-=dt;if(game.nextSpawn<=0)spawn(game,random);
    for(const plant of game.plants)plant.x-=move;
    for(const food of game.foods)food.x-=move;
    const hitbox={x:p.x+8,y:p.y+8,width:p.width-16,height:p.height-12};
    if(game.plants.some(plant=>intersects(hitbox,{x:plant.x+5,y:GROUND-plant.height+9,width:plant.width-10,height:plant.height-9}))){crashRunner(game,now);return game;}
    for(const food of game.foods){
      if(food.collected)continue;
      const x=Math.max(hitbox.x,Math.min(food.x,hitbox.x+hitbox.width)),y=Math.max(hitbox.y,Math.min(food.y,hitbox.y+hitbox.height));
      if((food.x-x)**2+(food.y-y)**2<=food.radius**2){
        food.collected=true;const type=FOODS.find(type=>type.id===food.kind);
        game.basket[type.id]++;game.score+=type.points;game.events.push({type:'food',kind:type.id,points:type.points,x:food.x,y:food.y});
      }
    }
    game.plants=game.plants.filter(plant=>plant.x+plant.width>-40);
    game.foods=game.foods.filter(food=>!food.collected&&food.x+food.radius>-40);
  }
  return game;
}
