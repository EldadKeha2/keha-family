import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHouseActor,createHouseMotion,houseWalkingSpeed} from '../public/assets/ruti-house-motion.mjs';
import {getHouseLayout,findHousePath} from '../public/assets/ruti-house-scene.mjs';

function finish(motion,step=1/60){
  for(let i=0;i<2000;i++){const result=motion.tick(step);if(result)return result;}
  assert.fail('The actor did not finish a bounded path');
}

test('walking takes real time, accelerates and leaves a stable idle actor',()=>{
  const actor=createHouseActor({x:.1,y:.2}),motion=createHouseMotion(actor);
  assert.equal(motion.walkTo({x:.8,y:.2}),true);
  assert.equal(actor.x,.1);assert.equal(actor.walking,true);
  motion.tick(.05);const first=actor.x-.1;
  assert.ok(first>0&&first<.02);
  motion.tick(.05);assert.ok(actor.x-.1-first>first,'The next step should accelerate');
  finish(motion);
  assert.equal(actor.x,.8);assert.equal(actor.y,.2);
  assert.equal(motion.busy,false);assert.equal(motion.state,'idle');
  assert.equal(actor.walking,false);assert.ok(actor.walkTime>1);
});

test('the actor follows every route corner instead of crossing furniture diagonally',()=>{
  const actor=createHouseActor({x:.1,y:.1});
  const motion=createHouseMotion(actor,()=>[{x:.1,y:.1},{x:.5,y:.1},{x:.5,y:.6},{x:.8,y:.6}],{speed:1});
  motion.walkTo({x:.8,y:.6});let sawVertical=false;
  for(let i=0;i<400&&motion.busy;i++){
    motion.tick(.01);
    const onFirst=Math.abs(actor.y-.1)<1e-7&&actor.x<=.5;
    const onMiddle=Math.abs(actor.x-.5)<1e-7&&actor.y>=.1&&actor.y<=.6;
    const onLast=Math.abs(actor.y-.6)<1e-7&&actor.x>=.5;
    assert.ok(onFirst||onMiddle||onLast,'Every rendered position must be on the supplied path');
    if(onMiddle&&actor.y>.2&&actor.y<.5)sawVertical=true;
  }
  assert.ok(sawVertical);assert.equal(actor.x,.8);assert.equal(actor.y,.6);
});

test('interruptions start at the current location and cancel the old completion',()=>{
  const actor=createHouseActor({x:.1,y:.8}),motion=createHouseMotion(actor);
  motion.walkTo({x:.9,y:.8},{payload:'old'});motion.tick(.3);
  const current={x:actor.x,y:actor.y};
  motion.walkTo({x:.05,y:.2},{action:'fetch',duration:.35,payload:'new'});
  assert.deepEqual({x:actor.x,y:actor.y},current);
  const result=finish(motion);
  assert.deepEqual(result,{payload:'new',action:'fetch'});
  assert.equal(actor.facing,-1);assert.equal(actor.x,.05);assert.equal(actor.y,.2);
  assert.equal(motion.tick(10),null,'The cancelled command must never complete later');
});

test('arrival runs a timed pose before completing exactly once',()=>{
  const actor=createHouseActor({x:.4,y:.4}),motion=createHouseMotion(actor);
  actor.tool='water';
  motion.walkTo({x:.4,y:.4},{action:'water',duration:.8,payload:{targetId:'plant1'}});
  assert.equal(motion.state,'acting');assert.equal(actor.action,'water');
  assert.equal(motion.tick(.2),null);assert.ok(Math.abs(actor.actionProgress-.25)<1e-8);
  assert.equal(actor.walking,false);assert.equal(actor.walkTime,0);assert.equal(actor.tool,'water');
  assert.deepEqual(motion.tick(.6),{payload:{targetId:'plant1'},action:'water'});
  assert.equal(actor.action,null);assert.equal(actor.actionProgress,0);
  assert.equal(motion.tick(.8),null);
});

test('remaining frame time is applied to the action after a short walk',()=>{
  const actor=createHouseActor({x:.1,y:.1}),motion=createHouseMotion(actor,undefined,{speed:1});
  motion.walkTo({x:.2,y:.1},{action:'hand',duration:.5,payload:'cat'});
  const result=motion.tick(2);
  assert.deepEqual(result,{payload:'cat',action:'hand'});
  assert.equal(actor.x,.2);assert.equal(motion.busy,false);
});

test('normalized horizontal speed accounts for scene aspect ratio',()=>{
  const wide=createHouseActor({x:.1,y:.5}),square=createHouseActor({x:.1,y:.5});
  const a=createHouseMotion(wide,undefined,{aspect:()=>2}),b=createHouseMotion(square,undefined,{aspect:()=>1});
  a.walkTo({x:.9,y:.5});b.walkTo({x:.9,y:.5});a.tick(.5);b.tick(.5);
  assert.ok(wide.x<square.x);assert.ok(wide.x>.1);
});

test('cancel and invalid paths cannot teleport or produce stale completions',()=>{
  const actor=createHouseActor({x:.2,y:.3}),motion=createHouseMotion(actor,()=>[]);
  assert.equal(motion.walkTo({x:.9,y:.9}),false);
  assert.equal(actor.x,.2);assert.equal(actor.y,.3);assert.equal(motion.busy,false);
  assert.equal(motion.walkTo({x:NaN,y:.4}),false);
  motion.walkTo({x:.2,y:.3},{action:'fetch',duration:1});motion.tick(.2);motion.cancel();
  assert.equal(actor.action,null);assert.equal(actor.walking,false);assert.equal(motion.tick(5),null);
});

test('pausing by omitting ticks preserves movement and action progress',()=>{
  const actor=createHouseActor({x:.3,y:.7}),motion=createHouseMotion(actor);
  motion.walkTo({x:.3,y:.7},{action:'broom',duration:1});motion.tick(.25);
  const before={...actor};
  assert.equal(motion.tick(-1),null);assert.equal(motion.tick(Infinity),null);
  assert.deepEqual(actor,before);
  motion.tick(.25);assert.ok(Math.abs(actor.actionProgress-.5)<1e-8);
});

test('desktop movement removes the long cross-screen wait while phone pacing and action duration remain unchanged',()=>{
  const times=[];
  for(const [width,height]of [[390,570],[960,600],[1130,530],[1440,750]]){
    const layout=getHouseLayout(width,height);
    const elapsed=layout.plants.map(plant=>{
      const actor=createHouseActor({x:.51,y:.83}),controller=createHouseMotion(actor,(from,to)=>findHousePath(layout,from,to),{speed:()=>houseWalkingSpeed({width,height,desktop:width>700}),aspect:()=>width/height});
      controller.walkTo(plant.anchor,{action:'water',duration:1.05});let time=0,actingTime=0;
      while(controller.busy&&time<30){const wasActing=controller.state==='acting';controller.tick(1/120);time+=1/120;if(wasActing)actingTime+=1/120;}
      assert.ok(actingTime>=1.03&&actingTime<=1.06,'watering itself retains its real duration');
      assert.equal(actor.x,plant.anchor.x);assert.equal(actor.y,plant.anchor.y);return time;
    });
    times.push(elapsed);
  }
  assert.equal(houseWalkingSpeed({width:390,desktop:false}),.68);assert.equal(houseWalkingSpeed({width:700,desktop:false}),.68);
  for(const desktop of times.slice(1))for(let i=0;i<4;i++)assert.ok(desktop[i]<=times[0][i]+.08,'a corresponding desktop plant no longer takes longer to reach');
});

test('responsive speed changes keep the current route and pending action instead of resetting or duplicating it',()=>{
  const actor=createHouseActor({x:.1,y:.5});let width=390;const height=570;
  const controller=createHouseMotion(actor,undefined,{speed:()=>houseWalkingSpeed({width,height,desktop:width>700})});
  controller.walkTo({x:.9,y:.5},{action:'water',duration:.5,payload:'one'});controller.tick(.1);
  const before=actor.x;width=1130;controller.tick(.1);assert.ok(actor.x>before);
  assert.equal(actor.action,null);assert.deepEqual(finish(controller),{action:'water',payload:'one'});
  assert.equal(controller.tick(2),null);
});

test('desktop speed compensates for wide rooms and adapts mid-walk without altering the action clock',()=>{
 let desktop=false,width=390,height=570;
 const actor=createHouseActor({x:.1,y:.5}),motion=createHouseMotion(actor,undefined,{speed:()=>houseWalkingSpeed({width,height,desktop}),aspect:()=>width/height});
 motion.walkTo({x:.9,y:.5},{action:'water',duration:1,payload:'plant'});motion.tick(.1);const before=actor.x;
 desktop=true;width=1130;height=530;motion.tick(.25);assert.ok(actor.x>before+.3);while(actor.walking)motion.tick(.01);
 const actionStart=actor.actionProgress;motion.tick(.2);assert.ok(Math.abs(actor.actionProgress-actionStart-.2)<1e-8,'speed applies to walking only');
 assert.equal(houseWalkingSpeed({width:1130,height:530,desktop:false}),.68);
 assert.ok(Math.abs(houseWalkingSpeed({width:Infinity,height:0,desktop:true})-3.4)<1e-10);
});
