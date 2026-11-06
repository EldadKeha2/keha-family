// Endless running with three lives and cumulative food points.
export const RUNNER_LIVES=3;
export const MIN_ENCOUNTER_GAP=1.2;
export const MAX_ENCOUNTER_FOODS=5;
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
export function createRunner({now=Date.now(),width=960}={}){
  return {phase:'playing',reason:null,width:Math.max(620,width),player:{...PLAYER,y:GROUND-PLAYER.height,vy:0},score:0,basket:emptyBasket(),lives:RUNNER_LIVES,crashes:0,distance:0,plants:[],foods:[],nextSpawn:.75,recoverUntil:0,events:[],sequence:0,encounters:0};
}
export function jumpRunner(game,now=Date.now()){
  if(game.phase!=='playing'||now<game.recoverUntil||game.player.vy!==0||game.player.y<GROUND-PLAYER.height-.1)return false;
  game.player.vy=-640;return true;
}
export function crashRunner(game,now){
  if(game.phase!=='playing')return;
  game.crashes++;game.lives=Math.max(0,game.lives-1);
  game.plants=[];game.foods=[];game.nextSpawn=.65;game.recoverUntil=now+1100;
  game.player={...PLAYER,y:GROUND-PLAYER.height,vy:0};game.events.push({type:'crash',lives:game.lives});
  if(!game.lives){game.phase='finished';game.reason='lives';game.events.push({type:'finish',reason:'lives'});}
}
export const ENCOUNTER_PATTERNS=Object.freeze(['single','close-pair','stepping-pair','rhythm','food-trail','temptation','scatter','mixed']);
export function makeEncounter({speed=230,pattern='single',random=Math.random}={}){
  const sample=()=>Math.max(0,Math.min(.999999,random()));
  const plants=[],foods=[];
  const plant=(x,short=false)=>{const shrub={x,width:short?27+sample()*4:30+sample()*8,height:short?45+sample()*10:52+sample()*19};plants.push(shrub);return shrub;};
  const height=()=>GROUND-30-sample()*150;
  const food=(x,y,kind=null,risky=false)=>{
    if(foods.length>=MAX_ENCOUNTER_FOODS)return;
    const type=kind?FOODS.find(type=>type.id===kind):FOODS[Math.floor(sample()*FOODS.length)],radius=type.radius;
    if(foods.some(f=>Math.hypot(f.x-x,f.y-y)<f.radius+radius+10))return;
    // Keep optional food clear of foliage; only the deliberate temptation is risky.
    if(!risky&&plants.some(p=>{const cx=Math.max(p.x-10,Math.min(x,p.x+p.width+10)),cy=Math.max(GROUND-p.height-16,Math.min(y,GROUND));return Math.hypot(x-cx,y-cy)<radius+8;}))return;
    foods.push({x,y,kind:type.id,radius,risky});
  };
  const above=shrub=>food(shrub.x+shrub.width/2+(sample()-.5)*45,GROUND-Math.min(180,shrub.height+55+sample()*65));
  if(pattern==='close-pair'){
    // The whole cluster remains inside one safe flight window at minimum speed.
    const a=plant(0,true),b=plant(a.width+10+sample()*22,true);
    if(sample()<.75)food((a.width+b.x)/2,GROUND-112-sample()*68);
  }else if(pattern==='temptation'){
    const a=plant(0),b=plant(speed*(1+sample()*.6));a.height=b.height=71;
    food(b.x-3,GROUND-20,'jachnun',true);
    if(sample()<.6)above(a);
  }else if(pattern==='stepping-pair'||pattern==='rhythm'){
    const count=pattern==='rhythm'?3:2;let x=0;
    for(let i=0;i<count;i++){
      const shrub=plant(x);if(sample()<.65)above(shrub);
      if(i<count-1)x+=speed*(.9+sample()*.75);
    }
    // Food positions are independent of the gaps and can vary through the jump arc.
    for(let i=0;i<2;i++)if(sample()<.65)food(40+sample()*x,height());
  }else if(pattern==='food-trail'||pattern==='scatter'){
    const count=pattern==='scatter'?1+Math.floor(sample()*5):2+Math.floor(sample()*4),extent=speed*(.6+sample()*1.65);
    // Rejection sampling avoids a row of fixed slots or an alternating pair of heights.
    for(let tries=0;foods.length<count&&tries<70;tries++)food(sample()*extent,height());
  }else if(pattern==='mixed'){
    const count=1+Math.floor(sample()*3);let x=0;
    for(let i=0;i<count;i++){plant(x);if(i<count-1)x+=speed*(.9+sample()*.75);}
    const wanted=Math.floor(sample()*6),extent=x+speed*(.5+sample()*.7);
    for(let tries=0;foods.length<wanted&&tries<70;tries++)food(-110+sample()*(extent+110),height());
  }else{
    const shrub=plant(0),layout=sample();
    if(layout<.28)above(shrub);
    else if(layout<.57)food(-75-sample()*100,height());
    else if(layout<.82)food(shrub.width+55+sample()*150,height());
    if(sample()<.35)food(shrub.width+90+sample()*160,height());
  }
  const minX=Math.min(0,...plants.map(p=>p.x),...foods.map(f=>f.x-f.radius)),maxX=Math.max(0,...plants.map(p=>p.x+p.width),...foods.map(f=>f.x+f.radius));
  return {pattern,plants,foods,minX,span:maxX-minX};
}
function spawn(game,random){
  const sample=()=>Math.max(0,Math.min(.999999,random())),speed=runnerSpeed(game);
  // Pick afresh, rather than forcing every run through repeated six-item bags.
  const choices=ENCOUNTER_PATTERNS.filter(pattern=>pattern!==game.lastPattern);
  const encounter=makeEncounter({speed,pattern:choices[Math.floor(sample()*choices.length)],random});
  const rightmost=Math.max(0,...game.plants.map(p=>p.x+p.width),...game.foods.map(f=>f.x+f.radius));
  const firstX=Math.max(game.width+80+sample()*200,rightmost+speed*MIN_ENCOUNTER_GAP),start=firstX-encounter.minX;
  for(const plant of encounter.plants)game.plants.push({...plant,x:start+plant.x,id:++game.sequence,encounter:game.encounters});
  for(const food of encounter.foods)game.foods.push({...food,x:start+food.x,id:++game.sequence,encounter:game.encounters});
  game.encounters++;game.lastPattern=encounter.pattern;
  game.nextSpawn=encounter.span/speed+MIN_ENCOUNTER_GAP+sample()*1.8;
}
const intersects=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
export function advanceRunner(game,seconds,now=Date.now(),random=Math.random){
  game.events=[];
  if(game.phase!=='playing')return game;
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
