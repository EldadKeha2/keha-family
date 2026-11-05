import test from 'node:test';
import assert from 'node:assert/strict';
import {TRIP_LIMIT,ROUTE_SECONDS,STATION_SECONDS,STATION_DISTANCE,TURBO_SECONDS,CRASH_SECONDS,ROAD,PLAYER,MAX_ROAD_SPEED,STEER_SPEED,createTrip,steerTrip,triggerTurbo,stepTrip,collideTrip,tripRemaining,arrivalSeconds,baseRoadSpeed,currentRoadSpeed,roadAt} from '../public/assets/north.mjs';
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-6,`${actual} ≈ ${expected}`);
function forcedTrip(crashes,turbo,{chunk=1/60}={}){
  const g=createTrip(123,{traffic:false}),marks=[20,65,115];let next=0;
  while(g.phase==='playing'){
    if(next<crashes&&g.distance>=marks[next]-1e-8&&!g.stopRemaining&&!g.recoveryRemaining&&!g.stationRemaining){assert.equal(collideTrip(g),true);next++;}
    if(turbo&&g.distance>=135&&!g.turboUsed&&!g.stopRemaining&&!g.stationRemaining)assert.equal(triggerTurbo(g),true);
    stepTrip(g,chunk);
  }
  return g;
}
function driveSafely(seed,{turbo=true,chunk=1/60}={}){
  const g=createTrip(seed);
  while(g.phase==='playing'){
    // Collision checks remain fully enabled. Wait until the previous row's
    // complete visible rectangle has passed, then steer to the next opening.
    const next=g.wavePlans.find(row=>g.obstacles.some(o=>o.waveId===row.id&&o.y-o.height/2<=g.player.y+g.player.height/2));
    if(next)steerTrip(g,next.corridor);
    if(turbo&&g.distance>=135&&!g.turboUsed&&!g.stopRemaining&&!g.stationRemaining)triggerTurbo(g);
    stepTrip(g,chunk);
  }
  return g;
}
test('180 second budget includes the mandatory break and preserves all collision/turbo outcomes',()=>{
  assert.equal(TRIP_LIMIT,180);assert.equal(ROUTE_SECONDS,163);assert.equal(STATION_SECONDS,10);assert.equal(CRASH_SECONDS,5);assert.equal(TURBO_SECONDS,5);
  for(const [crashes,turbo,won,time] of [[0,false,true,173],[1,false,true,178],[2,false,false,180],[2,true,true,178],[3,true,false,180],[3,false,false,180]]){
    const g=forcedTrip(crashes,turbo);assert.equal(g.phase,won?'won':'lost',`${crashes} collisions, turbo=${turbo}`);close(g.elapsed,time);assert.equal(g.collisions,crashes);assert.equal(g.stationDone,true);assert.equal(g.stationElapsed,10);
  }
  assert.equal(arrivalSeconds(2,false),183);assert.equal(arrivalSeconds(2,true),178);assert.equal(arrivalSeconds(3,true),183);
});
test('midpoint station freezes road, player and turbo for exactly ten seconds while the clock advances',()=>{
  const g=createTrip(33,{traffic:false});stepTrip(g,80);assert.equal(g.stationStarted,false);assert.equal(triggerTurbo(g),true);stepTrip(g,.75);
  close(g.distance,STATION_DISTANCE);assert.equal(g.stationStarted,true);assert.equal(g.stationDone,false);assert.equal(g.stationRemaining,10);assert.equal(g.speed,0);
  const road=g.roadDistance,x=g.player.x,boost=g.turboRemaining;steerTrip(g,100);
  g.obstacles.push({id:44,kind:'car',x:g.player.x,y:g.player.y,width:54,height:96});const y=g.obstacles[0].y;
  assert.equal(collideTrip(g,g.obstacles[0]),false);assert.equal(triggerTurbo(g),false);stepTrip(g,9.99);
  close(g.elapsed,90.74);close(g.stationElapsed,9.99);close(g.stationRemaining,.01);close(g.roadDistance,road);close(g.player.x,x);close(g.turboRemaining,boost);close(g.obstacles[0].y,y);assert.equal(g.collisions,0);
  // Remove the deliberately overlapping test object before resuming travel.
  g.obstacles=[];stepTrip(g,.02);assert.equal(g.stationDone,true);close(g.stationElapsed,10);close(g.stationRemaining,0);close(g.distance,STATION_DISTANCE+.02);close(g.turboRemaining,boost-.01);assert.ok(g.player.x<x);assert.ok(g.speed>0);
  stepTrip(g,100);assert.equal(g.phase,'won');close(g.elapsed,168);assert.equal(g.stationElapsed,10);
});
test('coarse frames cross the station once and preserve exact route time and road displacement',()=>{
  for(const chunk of [1/120,1/30,.37,2.3,200]){
    const g=createTrip(12,{traffic:false});stepTrip(g,10);assert.equal(triggerTurbo(g),true);while(g.phase==='playing')stepTrip(g,chunk);
    assert.equal(g.phase,'won');close(g.elapsed,168);close(g.distance,ROUTE_SECONDS);close(g.roadDistance,roadAt(ROUTE_SECONDS));assert.equal(g.stationElapsed,10);assert.equal(g.stationDone,true);
  }
  const g=createTrip(5,{traffic:false});assert.equal(triggerTurbo(g),true);assert.equal(triggerTurbo(g),false);stepTrip(g,7);assert.equal(triggerTurbo(g),false);close(g.distance,12);close(g.turboRemaining,0);
});
test('visible speed accelerates sharply while route timing stays independent of road speed',()=>{
  close(baseRoadSpeed({distance:0}),210);close(baseRoadSpeed({distance:ROUTE_SECONDS}),500);assert.ok(baseRoadSpeed({distance:ROUTE_SECONDS*.75})>390);
  const g=createTrip(4,{traffic:false});close(currentRoadSpeed(g),210);triggerTurbo(g);close(g.speed,420);stepTrip(g,3);assert.ok(g.speed>420);close(g.distance,6);close(g.roadDistance,roadAt(6));assert.equal(collideTrip(g),true);assert.equal(g.speed,0);stepTrip(g,5);assert.ok(g.speed>420);
});
test('a collision costs five seconds with no road, steering or turbo movement',()=>{
  const g=createTrip(2,{traffic:false});stepTrip(g,10);triggerTurbo(g);stepTrip(g,1);steerTrip(g,100);const x=g.player.x,distance=g.distance,road=g.roadDistance,boost=g.turboRemaining;
  assert.equal(collideTrip(g),true);assert.equal(collideTrip(g),false);assert.equal(triggerTurbo(g),false);
  stepTrip(g,4.9);close(g.distance,distance);close(g.roadDistance,road);close(g.player.x,x);close(g.turboRemaining,boost);close(g.stopRemaining,.1);
  stepTrip(g,.2);close(g.distance,distance+.2);close(g.turboRemaining,boost-.1);close(g.elapsed,16.1);assert.equal(g.collisions,1);
});
test('collision recovery prevents one obstacle from registering repeated impacts',()=>{
  const g=createTrip(1,{traffic:false});g.obstacles.push({id:1,kind:'car',x:g.player.x,y:g.player.y-20,width:54,height:96});
  stepTrip(g,.01);assert.equal(g.collisions,1);assert.equal(g.obstacles[0].hit,true);stepTrip(g,5.4);assert.equal(g.collisions,1);assert.equal(collideTrip(g),false);stepTrip(g,.4);assert.equal(collideTrip(g),true);assert.equal(g.collisions,2);
});
test('steering is continuous, bounded, independent of frame rate and frozen at terminal state',()=>{
  const a=createTrip(1,{traffic:false}),b=createTrip(1,{traffic:false});steerTrip(a,-100);steerTrip(b,-100);stepTrip(a,.2);for(let i=0;i<20;i++)stepTrip(b,.01);close(a.player.x,b.player.x);assert.ok(a.player.x>ROAD.left+PLAYER.width/2);stepTrip(a,1);close(a.player.x,ROAD.left+PLAYER.width/2+4);steerTrip(a,99999);stepTrip(a,2);close(a.player.x,ROAD.right-PLAYER.width/2-4);stepTrip(a,999);assert.equal(a.phase,'won');const snapshot=JSON.stringify(a);stepTrip(a,5);assert.equal(JSON.stringify(a),snapshot);assert.equal(triggerTurbo(a),false);
});
test('real generated traffic remains winnable across twenty seeds without disabling collisions',()=>{
  for(let seed=0;seed<20;seed++){
    const g=driveSafely(seed);assert.equal(g.phase,'won',`seed ${seed}`);assert.equal(g.collisions,0,`seed ${seed}`);close(g.elapsed,168);assert.equal(g.stationDone,true);assert.ok(g.waves>75);
  }
});
test('late gates are genuinely narrow and alternate widely with sufficient steering room at maximum turbo speed',()=>{
  const g=driveSafely(8371),h=driveSafely(8371);assert.deepEqual(g,h);
  const rows=g.wavePlans,late=rows.filter(r=>r.bornDistance/ROUTE_SECONDS>.65),gates=late.filter(r=>r.gated),first=rows.filter(r=>r.bornDistance<40);
  assert.ok(gates.length>late.length*.65);assert.ok(gates.every(r=>r.gap===70));assert.ok(new Set(late.map(r=>Math.round(r.corridor))).size>18);
  assert.ok(Math.max(...late.map(r=>r.corridor))-Math.min(...late.map(r=>r.corridor))>180);
  const earlyIntervals=first.slice(1).map((r,i)=>r.bornDistance-first[i].bornDistance),lateIntervals=late.slice(1).map((r,i)=>r.bornDistance-late[i].bornDistance);
  const mean=a=>a.reduce((sum,n)=>sum+n,0)/a.length;assert.ok(mean(lateIntervals)<mean(earlyIntervals));
  for(let i=1;i<rows.length;i++){
    const prev=rows[i-1],next=rows[i],vertical=next.bornRoadDistance-prev.bornRoadDistance;
    const steeringTime=Math.abs(next.corridor-prev.corridor)/STEER_SPEED;
    const available=(vertical-(prev.height+next.height)/2-PLAYER.height)/(MAX_ROAD_SPEED*2);
    assert.ok(available>steeringTime+.049,`wave ${i} must permit steering even at full turbo`);
  }
  // Observe a live gate to verify its actual rectangles, rather than metadata.
  const live=createTrip(9);while(!live.obstacles.some(o=>o.gate)){
    const next=live.wavePlans.find(row=>live.obstacles.some(o=>o.waveId===row.id&&o.y-o.height/2<=live.player.y+live.player.height/2));if(next)steerTrip(live,next.corridor);stepTrip(live,1/60);
    assert.equal(live.phase,'playing');
  }
  const gate=live.obstacles.filter(o=>o.gate),pair=gate.filter(o=>o.waveId===gate[0].waveId).sort((a,b)=>a.x-b.x);
  assert.equal(pair.length,2);close(pair[0].x-pair[0].width/2,ROAD.left);close(pair[1].x+pair[1].width/2,ROAD.right);close(pair[1].x-pair[1].width/2-(pair[0].x+pair[0].width/2),70);close(pair[0].y,pair[1].y);
});
test('invalid deltas never move the game; the deadline ends unfinished travel or station stops',()=>{
  const g=createTrip(4,{traffic:false});for(const n of [-1,NaN,Infinity,0])stepTrip(g,n);assert.equal(g.elapsed,0);assert.equal(g.distance,0);g.elapsed=179;g.distance=160;stepTrip(g,10);assert.equal(g.phase,'lost');assert.equal(tripRemaining(g),0);assert.equal(collideTrip(g),false);
});
