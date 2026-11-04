import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ROUND_MS,GROUND,PLAYER,FOODS,emptyBasket,basketPoints,createRunner,jumpRunner,advanceRunner,crashRunner,runnerSpeed,remainingMs} from '../public/assets/rex.mjs';

test('a round lasts exactly five minutes and the menu has the requested values and sizes',()=>{
  const game=createRunner({now:1000,width:620});assert.equal(game.deadline,301000);assert.equal(ROUND_MS,300000);
  assert.deepEqual(FOODS.map(food=>[food.id,food.points]),[['jachnun',4],['lahoh',3],['kubaneh',2],['malawach',1]]);
  assert.equal(FOODS[0].radius,Math.min(...FOODS.map(food=>food.radius)));
  advanceRunner(game,.02,300999);assert.equal(game.phase,'playing');advanceRunner(game,.02,301000);assert.equal(game.phase,'finished');
  assert.equal(remainingMs(game,301001),0);assert.equal(jumpRunner(game,301001),false);
});
test('each food contributes its own weighted value and can only be collected once',()=>{
  const game=createRunner({now:0});game.nextSpawn=100;
  for(const food of FOODS){game.foods=[{kind:food.id,x:120,y:GROUND-40,radius:food.radius}];advanceRunner(game,1/120,1);assert.equal(game.basket[food.id],1);assert.equal(game.events[0].points,food.points);advanceRunner(game,1/120,2);assert.equal(game.basket[food.id],1);}
  assert.equal(game.score,10);assert.equal(game.score,basketPoints(game.basket));
});
test('one crash clears points, every food count, distance and obstacles but preserves the deadline',()=>{
  const game=createRunner({now:1000});game.basket={jachnun:3,lahoh:2,kubaneh:1,malawach:4};game.score=basketPoints(game.basket);game.distance=20000;
  game.plants=[{x:105,width:40,height:70}];game.foods=[{kind:'jachnun',x:120,y:250,radius:13}];const deadline=game.deadline;
  advanceRunner(game,.01,5000);assert.equal(game.crashes,1);assert.equal(game.score,0);assert.deepEqual(game.basket,emptyBasket());assert.equal(game.distance,0);assert.equal(runnerSpeed(game),230);assert.equal(game.deadline,deadline);assert.equal(game.phase,'playing');assert.deepEqual(game.plants,[]);assert.deepEqual(game.foods,[]);
  assert.equal(jumpRunner(game,5200),false);advanceRunner(game,.02,5600);assert.equal(game.distance,0);assert.equal(remainingMs(game,5600),deadline-5600);
  advanceRunner(game,.02,6200);assert.ok(game.distance>0);assert.equal(jumpRunner(game,6200),true);
});
test('jumps land, cannot be stacked in midair, and expire even during crash recovery or a hidden-tab gap',()=>{
  const game=createRunner({now:0});game.nextSpawn=100;
  assert.equal(jumpRunner(game,0),true);assert.equal(jumpRunner(game,0),false);
  advanceRunner(game,.1,100);assert.equal(jumpRunner(game,100),false);
  for(let i=2;i<=10;i++)advanceRunner(game,.1,i*100);
  assert.equal(game.player.y,GROUND-PLAYER.height);assert.equal(game.player.vy,0);
  crashRunner(game,299900);advanceRunner(game,0,300001);assert.equal(game.phase,'finished');assert.equal(game.score,0);
  const hidden=createRunner({now:0});hidden.score=4;hidden.basket.jachnun=1;advanceRunner(hidden,0,ROUND_MS+90000);assert.equal(hidden.phase,'finished');assert.equal(hidden.score,4);
});
test('all four collectible types are reachable above khat, with safe jump gaps for a full five-minute run on desktop and phone',()=>{
  for(const width of [620,960]){
    let seed=33;const random=()=>((seed=(1664525*seed+1013904223)>>>0)/2**32),game=createRunner({now:0,width});
    for(let frame=1;frame<=18000;frame++){
      const now=frame*1000/60,plant=game.plants.find(plant=>plant.x+plant.width>PLAYER.x+10);
      if(plant&&plant.x+plant.width/2-(PLAYER.x+PLAYER.width/2)<runnerSpeed(game)*.4)jumpRunner(game,now);
      advanceRunner(game,1/60,now,random);
    }
    assert.equal(game.phase,'finished');assert.equal(game.crashes,0,'every generated obstacle should be jumpable');
    for(const food of FOODS)assert.ok(game.basket[food.id]>0,food.id+' must be collectible');
    assert.ok(game.score>100);assert.equal(game.score,basketPoints(game.basket));
  }
});
