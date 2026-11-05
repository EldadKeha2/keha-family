import test from 'node:test';
import assert from 'node:assert/strict';
import {TRIP_LIMIT,ROUTE_SECONDS,TURBO_SECONDS,CRASH_SECONDS,ROAD,PLAYER,SCROLL_SPEED,createTrip,steerTrip,triggerTurbo,stepTrip,collideTrip,tripRemaining,arrivalSeconds} from '../public/assets/north.mjs';
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-6,`${actual} ≈ ${expected}`);
function forcedTrip(crashes,turbo,{chunk=1/60}={}){
  const g=createTrip(123,{traffic:false});
  const marks=[20,65,115];let next=0;
  while(g.phase==='playing'){
    if(next<crashes&&g.distance>=marks[next]-1e-8&&!g.stopRemaining&&!g.recoveryRemaining){assert.equal(collideTrip(g),true);next++;}
    if(turbo&&g.distance>=145&&!g.turboUsed&&!g.stopRemaining)assert.equal(triggerTurbo(g),true);
    stepTrip(g,chunk);
  }
  return g;
}
test('180 second budget permits exactly the requested collision/turbo outcomes',()=>{
  assert.equal(TRIP_LIMIT,180);assert.equal(CRASH_SECONDS,5);assert.equal(TURBO_SECONDS,5);
  for(const [crashes,turbo,won,time] of [[0,false,true,173],[1,false,true,178],[2,false,false,180],[2,true,true,178],[3,true,false,180],[3,false,false,180]]){
    const g=forcedTrip(crashes,turbo);assert.equal(g.phase,won?'won':'lost',`${crashes} collisions, turbo=${turbo}`);close(g.elapsed,time);assert.equal(g.collisions,crashes);
  }
  assert.equal(arrivalSeconds(2,false),183);assert.equal(arrivalSeconds(2,true),178);assert.equal(arrivalSeconds(3,true),183);
});
test('travel, timer and one turbo have the same results with coarse and irregular steps',()=>{
  for(const chunk of [1/120,1/30,.37,2.3]){const g=createTrip(12,{traffic:false});stepTrip(g,10);assert.equal(triggerTurbo(g),true);while(g.phase==='playing')stepTrip(g,chunk);assert.equal(g.phase,'won');close(g.elapsed,168);close(g.distance,ROUTE_SECONDS);}
  const g=createTrip(5,{traffic:false});assert.equal(triggerTurbo(g),true);assert.equal(triggerTurbo(g),false);stepTrip(g,7);assert.equal(triggerTurbo(g),false);close(g.distance,12);close(g.turboRemaining,0);
});
test('a collision costs a full five seconds with no road, steering or turbo movement',()=>{
  const g=createTrip(2,{traffic:false});stepTrip(g,10);triggerTurbo(g);stepTrip(g,1);steerTrip(g,100);const x=g.player.x,distance=g.distance,boost=g.turboRemaining;
  assert.equal(collideTrip(g),true);assert.equal(collideTrip(g),false);assert.equal(triggerTurbo(g),false);
  stepTrip(g,4.9);close(g.distance,distance);close(g.player.x,x);close(g.turboRemaining,boost);close(g.stopRemaining,.1);
  stepTrip(g,.2);close(g.distance,distance+.2);close(g.turboRemaining,boost-.1);close(g.elapsed,16.1);assert.equal(g.collisions,1);
});
test('collision recovery prevents one obstacle from registering repeated impacts',()=>{
  const g=createTrip(1,{traffic:false});g.obstacles.push({id:1,kind:'car',x:g.player.x,y:g.player.y-20,width:54,height:96});
  stepTrip(g,.01);assert.equal(g.collisions,1);assert.equal(g.obstacles[0].hit,true);stepTrip(g,5.5);assert.equal(g.collisions,1);assert.equal(collideTrip(g),false);stepTrip(g,.5);assert.equal(collideTrip(g),true);assert.equal(g.collisions,2);
});
test('steering is continuous, bounded, independent of frame rate and frozen at terminal state',()=>{
  const a=createTrip(1,{traffic:false}),b=createTrip(1,{traffic:false});steerTrip(a,-100);steerTrip(b,-100);stepTrip(a,.2);for(let i=0;i<20;i++)stepTrip(b,.01);close(a.player.x,b.player.x);assert.ok(a.player.x>ROAD.left+PLAYER.width/2);stepTrip(a,1);close(a.player.x,ROAD.left+PLAYER.width/2+4);steerTrip(a,99999);stepTrip(a,2);close(a.player.x,ROAD.right-PLAYER.width/2-4);stepTrip(a,999);assert.equal(a.phase,'won');const snapshot=JSON.stringify(a);stepTrip(a,5);assert.equal(JSON.stringify(a),snapshot);assert.equal(triggerTurbo(a),false);
});
test('seeded obstacle rows vary positions and reserve reachable, growing-density traffic',()=>{
  const g=createTrip(8371),h=createTrip(8371);const rows=[];let oldWaves=0;
  for(let i=0;i<12000&&g.phase==='playing';i++){
    // Automatic safe steering is used only to inspect generation, not gameplay.
    steerTrip(g,g.lastCorridor);steerTrip(h,h.lastCorridor);g.recoveryRemaining=999;h.recoveryRemaining=999;
    stepTrip(g,1/60);stepTrip(h,1/60);
    if(g.waves!==oldWaves){const row=g.obstacles.filter(o=>Math.abs(o.bornDistance-g.distance)<.025);for(const o of row){assert.ok(o.x-o.width/2>=ROAD.left);assert.ok(o.x+o.width/2<=ROAD.right);assert.ok(Math.abs(o.x-g.lastCorridor)>=52+o.width/2);}rows.push({distance:g.distance,centre:g.lastCorridor,count:row.length,x:row.map(o=>o.x)});oldWaves=g.waves;}
  }
  assert.equal(g.phase,'won');assert.deepEqual(g,h);assert.ok(rows.length>60);assert.ok(new Set(rows.flatMap(r=>r.x.map(x=>Math.round(x)))).size>80);
  for(let i=1;i<rows.length;i++){assert.ok(Math.abs(rows[i].centre-rows[i-1].centre)<=62.001);assert.ok((rows[i].distance-rows[i-1].distance)*SCROLL_SPEED>220);}
  const first=rows.filter(r=>r.distance<40),last=rows.filter(r=>r.distance>130);assert.ok(last.length/43>first.length/40);assert.ok(last.reduce((n,r)=>n+r.count,0)/last.length>first.reduce((n,r)=>n+r.count,0)/first.length);
});
test('invalid deltas never move the game; deadline wins over unfinished route',()=>{
  const g=createTrip(4,{traffic:false});for(const n of [-1,NaN,Infinity,0])stepTrip(g,n);assert.equal(g.elapsed,0);assert.equal(g.distance,0);g.elapsed=179;g.distance=160;stepTrip(g,10);assert.equal(g.phase,'lost');assert.equal(tripRemaining(g),0);assert.equal(collideTrip(g),false);
});
