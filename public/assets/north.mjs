/** Pure, deterministic simulation for “Driving North”. All times are seconds.
 * A perfect trip takes 173 s. The single 5 s turbo doubles forward speed and
 * saves exactly 5 s; each collision adds a complete 5 s standstill.
 */
export const TRIP_LIMIT=180;
export const ROUTE_SECONDS=173;
export const TURBO_SECONDS=5;
export const CRASH_SECONDS=5;
export const WORLD_WIDTH=480;
export const WORLD_HEIGHT=760;
export const ROAD=Object.freeze({left:70,right:410});
export const PLAYER=Object.freeze({width:54,height:96,y:620});
export const SCROLL_SPEED=182;
export const STEER_SPEED=330;
const RECOVERY_SECONDS=.85,STEP=1/120,EPS=1e-9;
const KINDS=Object.freeze([
  {kind:'car',width:54,height:96},
  {kind:'van',width:57,height:108},
  {kind:'island',width:55,height:110},
  {kind:'barrier',width:65,height:37},
  {kind:'cones',width:40,height:66},
  {kind:'pothole',width:48,height:38}
]);
const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
function random(g){let t=g.rngState=(g.rngState+0x6D2B79F5)>>>0;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;}
function seedValue(seed){if(typeof seed==='number'&&Number.isFinite(seed))return seed>>>0;let n=2166136261;for(const c of String(seed??Date.now()))n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;}
export function createTrip(seed=Date.now(),options={}){
  return {phase:'playing',elapsed:0,distance:0,progress:0,collisions:0,stopRemaining:0,recoveryRemaining:0,turboRemaining:0,turboUsed:false,
    player:{...PLAYER,x:WORLD_WIDTH/2},targetX:WORLD_WIDTH/2,obstacles:[],lastCollision:null,collisionSerial:0,
    traffic:options.traffic!==false,rngState:seedValue(seed),nextSpawnDistance:2.6,nextObstacleId:1,lastCorridor:WORLD_WIDTH/2,waves:0};
}
export function steerTrip(g,targetX){if(Number.isFinite(targetX))g.targetX=clamp(targetX,ROAD.left+g.player.width/2+4,ROAD.right-g.player.width/2-4);return g;}
export function triggerTurbo(g){
  if(g.phase!=='playing'||g.turboUsed||g.stopRemaining>EPS)return false;
  g.turboUsed=true;g.turboRemaining=TURBO_SECONDS;return true;
}
export function collideTrip(g,obstacle=null){
  if(g.phase!=='playing'||g.stopRemaining>EPS||g.recoveryRemaining>EPS)return false;
  g.collisions++;g.collisionSerial++;g.stopRemaining=CRASH_SECONDS;g.recoveryRemaining=RECOVERY_SECONDS;
  g.lastCollision={serial:g.collisionSerial,kind:obstacle?.kind||'obstacle',at:g.elapsed};
  if(obstacle)obstacle.hit=true;
  return true;
}
export const tripRemaining=g=>Math.max(0,TRIP_LIMIT-g.elapsed);
export const arrivalSeconds=(collisions=0,turboUsed=false)=>ROUTE_SECONDS+Math.max(0,collisions)*CRASH_SECONDS-(turboUsed?TURBO_SECONDS:0);
/** Each row reserves a wide clear corridor. Consecutive corridors shift by at
 * most 62 px and rows are separated by at least 229 px, even in turbo. This
 * leaves time to steer between them instead of producing random solid walls.
 * Horizontal obstacle positions are continuous, not fixed lane templates.
 */
function spawnWave(g){
  const progress=g.distance/ROUTE_SECONDS,halfGap=52;
  const corridor=clamp(g.lastCorridor+(random(g)*2-1)*62,ROAD.left+halfGap+5,ROAD.right-halfGap-5);
  const count=progress>.65?3:progress>.28?2:1;
  const row=[];
  for(let i=0;i<count;i++){
    const shape=KINDS[Math.floor(random(g)*KINDS.length)];
    for(let attempt=0;attempt<28;attempt++){
      const x=ROAD.left+shape.width/2+8+random(g)*(ROAD.right-ROAD.left-shape.width-16);
      if(Math.abs(x-corridor)<halfGap+shape.width/2)continue;
      if(row.some(o=>Math.abs(x-o.x)<(o.width+shape.width)/2+10))continue;
      row.push({...shape,id:g.nextObstacleId++,x,y:-126,bornDistance:g.distance,colour:Math.floor(random(g)*7),hit:false});break;
    }
  }
  // Wide corridors can leave room for fewer than the requested count. Keeping
  // the corridor always takes precedence over adding another obstacle.
  g.obstacles.push(...row);g.lastCorridor=corridor;g.waves++;
  g.nextSpawnDistance=g.distance+Math.max(1.35,2.7-progress*1.25)+(random(g)-.5)*.18;
}
function overlaps(player,o){
  if(o.hit)return false;
  // Insets keep a visible mirror or the rounded edge of a pothole forgiving.
  const pw=player.width-12,ph=player.height-14,ow=o.width-(o.kind==='pothole'?12:8),oh=o.height-8;
  return Math.abs(player.x-o.x)<(pw+ow)/2&&Math.abs(player.y-o.y)<(ph+oh)/2;
}
function terminal(g){
  g.progress=clamp(g.distance/ROUTE_SECONDS,0,1);
  if(g.distance>=ROUTE_SECONDS-EPS&&g.elapsed<=TRIP_LIMIT+EPS){g.distance=ROUTE_SECONDS;g.progress=1;g.phase='won';}
  else if(g.elapsed>=TRIP_LIMIT-EPS){g.elapsed=TRIP_LIMIT;g.phase='lost';}
}
export function stepTrip(g,dt){
  if(g.phase!=='playing'||!Number.isFinite(dt)||dt<=0)return g;
  let remaining=Math.min(dt,TRIP_LIMIT-g.elapsed);
  while(remaining>EPS&&g.phase==='playing'){
    if(g.stopRemaining>EPS){
      const slice=Math.min(remaining,g.stopRemaining,TRIP_LIMIT-g.elapsed);
      g.elapsed+=slice;g.stopRemaining=Math.max(0,g.stopRemaining-slice);if(g.stopRemaining<EPS)g.stopRemaining=0;remaining-=slice;terminal(g);continue;
    }
    if(g.traffic&&g.distance>=g.nextSpawnDistance-EPS)spawnWave(g);
    const boosted=g.turboRemaining>EPS,speed=boosted?2:1;
    let slice=Math.min(remaining,STEP,TRIP_LIMIT-g.elapsed,(ROUTE_SECONDS-g.distance)/speed);
    if(boosted)slice=Math.min(slice,g.turboRemaining);
    if(g.traffic)slice=Math.min(slice,Math.max(EPS,(g.nextSpawnDistance-g.distance)/speed));
    const travel=slice*speed;
    g.elapsed+=slice;g.distance+=travel;remaining-=slice;
    if(boosted)g.turboRemaining=Math.max(0,g.turboRemaining-slice);
    g.recoveryRemaining=Math.max(0,g.recoveryRemaining-slice);if(g.recoveryRemaining<EPS)g.recoveryRemaining=0;
    const delta=g.targetX-g.player.x;g.player.x+=Math.sign(delta)*Math.min(Math.abs(delta),STEER_SPEED*slice);
    for(const o of g.obstacles)o.y+=travel*SCROLL_SPEED;
    g.obstacles=g.obstacles.filter(o=>o.y-o.height/2<WORLD_HEIGHT+40);
    terminal(g);
    if(g.phase==='playing'&&g.recoveryRemaining<=EPS){const hit=g.obstacles.find(o=>overlaps(g.player,o));if(hit)collideTrip(g,hit);}
  }
  return g;
}
