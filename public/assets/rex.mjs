// The round uses a wall-clock deadline. Losing resets the run, never that deadline.
export const ROUND_MS=5*60*1000;
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
  return {phase:'playing',deadline:now+ROUND_MS,width:Math.max(620,width),player:{...PLAYER,y:GROUND-PLAYER.height,vy:0},score:0,basket:emptyBasket(),crashes:0,distance:0,plants:[],foods:[],nextSpawn:1.1,recoverUntil:0,events:[],sequence:0};
}
export function jumpRunner(game,now=Date.now()){
  if(game.phase!=='playing'||now>=game.deadline||now<game.recoverUntil||game.player.vy!==0||game.player.y<GROUND-PLAYER.height-.1)return false;
  game.player.vy=-640;return true;
}
export function crashRunner(game,now){
  game.score=0;game.basket=emptyBasket();game.crashes++;game.distance=0;
  game.plants=[];game.foods=[];game.nextSpawn=.8;game.recoverUntil=now+1100;
  game.player={...PLAYER,y:GROUND-PLAYER.height,vy:0};game.events.push({type:'crash'});
}
function spawn(game,random){
  const sample=()=>Math.max(0,Math.min(.999999,random()));
  const height=54+sample()*20,width=32+sample()*10,x=game.width+54;
  const food=FOODS[Math.floor(sample()*FOODS.length)];
  game.plants.push({x,width,height,id:++game.sequence});
  game.foods.push({x:x+width/2,y:GROUND-height-50,kind:food.id,radius:food.radius,id:game.sequence});
  // At maximum speed there is still ample time to land before the next jump.
  game.nextSpawn=1.35+sample()*.5;
}
const intersects=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
export function advanceRunner(game,seconds,now=Date.now(),random=Math.random){
  game.events=[];
  if(game.phase!=='playing')return game;
  if(now>=game.deadline){game.phase='finished';game.events.push({type:'finish'});return game;}
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
