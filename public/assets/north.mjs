/** Deterministic simulation. Route time and visible road speed are independent:
 * 163 s driving + the mandatory 10 s station stop = 173 s without incidents.
 * The one 5 s turbo saves exactly 5 s; each impact adds 5 s of standstill.
 */
export const TRIP_LIMIT=180;
export const ROUTE_SECONDS=163;
export const STATION_SECONDS=10;
export const STATION_DISTANCE=ROUTE_SECONDS/2;
export const TURBO_SECONDS=5;
export const CRASH_SECONDS=5;
export const WORLD_WIDTH=480;
export const WORLD_HEIGHT=760;
export const ROAD=Object.freeze({left:70,right:410});
export const PLAYER=Object.freeze({width:54,height:96,y:620});
export const SCROLL_SPEED=210;
export const MAX_ROAD_SPEED=500;
export const STEER_SPEED=330;
const RECOVERY_SECONDS=.65,STEP=1/120,EPS=1e-9,SPAWN_Y=-126;
const KINDS=Object.freeze([
  {kind:'car',width:54,height:96}, {kind:'van',width:57,height:108},
  {kind:'island',width:55,height:110}, {kind:'barrier',width:65,height:42},
  {kind:'cones',width:40,height:66}, {kind:'pothole',width:48,height:38}
]);
const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
function random(g){let t=g.rngState=(g.rngState+0x6D2B79F5)>>>0;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;}
function seedValue(seed){if(typeof seed==='number'&&Number.isFinite(seed))return seed>>>0;let n=2166136261;for(const c of String(seed??Date.now()))n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;}
export const baseRoadSpeed=g=>SCROLL_SPEED+(MAX_ROAD_SPEED-SCROLL_SPEED)*Math.pow(clamp(g.distance/ROUTE_SECONDS,0,1),1.6);
// Exact antiderivative: road displacement remains identical across frame rates.
export const roadAt=distance=>SCROLL_SPEED*distance+(MAX_ROAD_SPEED-SCROLL_SPEED)*ROUTE_SECONDS/2.6*Math.pow(clamp(distance/ROUTE_SECONDS,0,1),2.6);
function routeAtRoad(road){let lo=0,hi=ROUTE_SECONDS;for(let i=0;i<40;i++){const mid=(lo+hi)/2;if(roadAt(mid)<road)lo=mid;else hi=mid;}return (lo+hi)/2;}
export const currentRoadSpeed=g=>g.phase!=='playing'||g.stopRemaining>EPS||g.stationRemaining>EPS?0:baseRoadSpeed(g)*(g.turboRemaining>EPS?2:1);
export function createTrip(seed=Date.now(),options={}){
  const g={phase:'playing',elapsed:0,distance:0,roadDistance:0,speed:SCROLL_SPEED,progress:0,collisions:0,stopRemaining:0,recoveryRemaining:0,turboRemaining:0,turboUsed:false,
    stationRemaining:0,stationElapsed:0,stationDone:false,stationStarted:false,
    player:{...PLAYER,x:WORLD_WIDTH/2},targetX:WORLD_WIDTH/2,obstacles:[],lastCollision:null,collisionSerial:0,
    traffic:options.traffic!==false,rngState:seedValue(seed),nextSpawnRoad:420,nextSpawnDistance:routeAtRoad(420),nextObstacleId:1,lastCorridor:WORLD_WIDTH/2,waves:0,wavePlans:[]};
  g.nextWave=waveSpec(g,0);return g;
}
export function steerTrip(g,targetX){if(Number.isFinite(targetX))g.targetX=clamp(targetX,ROAD.left+g.player.width/2+4,ROAD.right-g.player.width/2-4);return g;}
export function triggerTurbo(g){
  if(g.phase!=='playing'||g.turboUsed||g.stopRemaining>EPS||g.stationRemaining>EPS)return false;
  g.turboUsed=true;g.turboRemaining=TURBO_SECONDS;g.speed=currentRoadSpeed(g);return true;
}
export function collideTrip(g,obstacle=null){
  if(g.phase!=='playing'||g.stopRemaining>EPS||g.stationRemaining>EPS||g.recoveryRemaining>EPS)return false;
  g.collisions++;g.collisionSerial++;g.stopRemaining=CRASH_SECONDS;g.recoveryRemaining=RECOVERY_SECONDS;
  g.lastCollision={serial:g.collisionSerial,kind:obstacle?.kind||'obstacle',at:g.elapsed};
  if(obstacle)obstacle.hit=true;g.speed=0;return true;
}
export const tripRemaining=g=>Math.max(0,TRIP_LIMIT-g.elapsed);
export const arrivalSeconds=(collisions=0,turboUsed=false)=>ROUTE_SECONDS+STATION_SECONDS+Math.max(0,collisions)*CRASH_SECONDS-(turboUsed?TURBO_SECONDS:0);
function waveSpec(g,progress){
  const gated=progress>=.62&&random(g)>.16;
  const gap=gated?70:Math.max(76,122-progress*55);
  const lo=ROAD.left+gap/2+8,hi=ROAD.right-gap/2-8;
  let corridor;
  if(progress<.35)corridor=clamp(g.lastCorridor+(random(g)*2-1)*(65+progress*130),lo,hi);
  else{
    corridor=lo+random(g)*(hi-lo);
    // Deliberate left/right changes replace the old nearly central safe lane.
    if(progress>.6&&Math.abs(corridor-g.lastCorridor)<75)corridor=clamp(g.lastCorridor+(g.lastCorridor<(lo+hi)/2?1:-1)*(85+random(g)*95),lo,hi);
  }
  return {corridor,gap,gated,maxHeight:gated?42:110};
}
/** Every row leaves one clear passage. Inter-row spacing depends on the next
 * passage's horizontal displacement, both row heights and worst-case turbo
 * speed. A driver can clear one row and steer to the next passage before it
 * arrives, even at 1,000 px/s. Difficulty comes from pace and precision rather
 * than randomly generated unsteerable walls.
 */
function spawnWave(g){
  const progress=g.distance/ROUTE_SECONDS,spec=g.nextWave,{corridor,gap,gated}=spec,row=[],waveId=g.waves+1;
  const add=shape=>row.push({...shape,id:g.nextObstacleId++,waveId,y:SPAWN_Y,bornDistance:g.distance,bornRoadDistance:g.roadDistance,colour:Math.floor(random(g)*7),hit:false});
  if(gated){
    const leftWidth=corridor-gap/2-ROAD.left,rightStart=corridor+gap/2,rightWidth=ROAD.right-rightStart;
    add({kind:'barrier',gate:true,x:ROAD.left+leftWidth/2,width:leftWidth,height:42});
    add({kind:'barrier',gate:true,x:rightStart+rightWidth/2,width:rightWidth,height:42});
  }else{
    const count=progress>.35?4:progress>.12?3:2;
    for(let i=0;i<count;i++){
      const shape=KINDS[Math.floor(random(g)*KINDS.length)];
      for(let attempt=0;attempt<36;attempt++){
        const x=ROAD.left+shape.width/2+5+random(g)*(ROAD.right-ROAD.left-shape.width-10);
        if(Math.abs(x-corridor)<gap/2+shape.width/2)continue;
        if(row.some(o=>Math.abs(x-o.x)<(o.width+shape.width)/2+7))continue;
        add({...shape,x});break;
      }
    }
  }
  g.obstacles.push(...row);g.lastCorridor=corridor;g.waves++;
  const height=Math.max(...row.map(o=>o.height),spec.maxHeight);
  g.wavePlans.push({id:waveId,corridor,gap,gated,height,bornRoadDistance:g.roadDistance,bornDistance:g.distance});
  const next=waveSpec(g,Math.min(1,progress+.012)),delta=Math.abs(next.corridor-corridor);
  // Fifty milliseconds of additional steering margin covers sampled input.
  const needed=(height+next.maxHeight)/2+PLAYER.height+(delta/STEER_SPEED+.05)*MAX_ROAD_SPEED*2;
  const spacing=Math.max(380-progress*130,needed)+random(g)*34;
  g.nextWave=next;g.nextSpawnRoad=g.roadDistance+spacing;
  g.nextSpawnDistance=g.nextSpawnRoad<roadAt(ROUTE_SECONDS)?routeAtRoad(g.nextSpawnRoad):ROUTE_SECONDS+1;
}
function overlaps(player,o){
  if(o.hit)return false;
  const pw=player.width-12,ph=player.height-14,ow=o.width-(o.kind==='pothole'?12:8),oh=o.height-8;
  return Math.abs(player.x-o.x)<(pw+ow)/2&&Math.abs(player.y-o.y)<(ph+oh)/2;
}
function terminal(g){
  g.progress=clamp(g.distance/ROUTE_SECONDS,0,1);
  if(g.distance>=ROUTE_SECONDS-EPS&&g.elapsed<=TRIP_LIMIT+EPS){g.distance=ROUTE_SECONDS;g.progress=1;g.phase='won';}
  else if(g.elapsed>=TRIP_LIMIT-EPS){g.elapsed=TRIP_LIMIT;g.phase='lost';}
  g.speed=currentRoadSpeed(g);
}
function beginStation(g){if(!g.stationStarted&&g.distance>=STATION_DISTANCE-EPS){g.stationStarted=true;g.stationRemaining=STATION_SECONDS;g.speed=0;return true;}return false;}
export function stepTrip(g,dt){
  if(g.phase!=='playing'||!Number.isFinite(dt)||dt<=0)return g;
  let remaining=Math.min(dt,TRIP_LIMIT-g.elapsed);
  while(remaining>EPS&&g.phase==='playing'){
    if(g.stopRemaining>EPS){
      const slice=Math.min(remaining,g.stopRemaining,TRIP_LIMIT-g.elapsed);
      g.elapsed+=slice;g.stopRemaining=Math.max(0,g.stopRemaining-slice);if(g.stopRemaining<EPS)g.stopRemaining=0;remaining-=slice;terminal(g);continue;
    }
    beginStation(g);
    if(g.stationRemaining>EPS){
      const slice=Math.min(remaining,g.stationRemaining,TRIP_LIMIT-g.elapsed);
      g.elapsed+=slice;g.stationElapsed=Math.min(STATION_SECONDS,g.stationElapsed+slice);g.stationRemaining=Math.max(0,g.stationRemaining-slice);remaining-=slice;
      if(g.stationRemaining<EPS){g.stationRemaining=0;g.stationElapsed=STATION_SECONDS;g.stationDone=true;}terminal(g);continue;
    }
    if(g.traffic&&g.distance>=g.nextSpawnDistance-EPS)spawnWave(g);
    const boosted=g.turboRemaining>EPS,multiplier=boosted?2:1;
    let slice=Math.min(remaining,STEP,TRIP_LIMIT-g.elapsed,(ROUTE_SECONDS-g.distance)/multiplier);
    if(boosted)slice=Math.min(slice,g.turboRemaining);
    if(!g.stationStarted)slice=Math.min(slice,Math.max(EPS,(STATION_DISTANCE-g.distance)/multiplier));
    if(g.traffic)slice=Math.min(slice,Math.max(EPS,(g.nextSpawnDistance-g.distance)/multiplier));
    const previousRoad=g.roadDistance;g.elapsed+=slice;g.distance+=slice*multiplier;g.roadDistance=roadAt(g.distance);remaining-=slice;
    if(boosted)g.turboRemaining=Math.max(0,g.turboRemaining-slice);
    g.recoveryRemaining=Math.max(0,g.recoveryRemaining-slice);if(g.recoveryRemaining<EPS)g.recoveryRemaining=0;
    const delta=g.targetX-g.player.x;g.player.x+=Math.sign(delta)*Math.min(Math.abs(delta),STEER_SPEED*slice);
    for(const o of g.obstacles)o.y+=g.roadDistance-previousRoad;
    g.obstacles=g.obstacles.filter(o=>o.y-o.height/2<WORLD_HEIGHT+40);
    beginStation(g);terminal(g);
    if(g.phase==='playing'&&!g.stationRemaining&&g.recoveryRemaining<=EPS){const hit=g.obstacles.find(o=>overlaps(g.player,o));if(hit)collideTrip(g,hit);}
  }
  g.speed=currentRoadSpeed(g);return g;
}
