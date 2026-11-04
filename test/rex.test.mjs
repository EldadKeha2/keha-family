import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ROUND_MS,RUNNER_LIVES,GROUND,PLAYER,FOODS,basketPoints,createRunner,jumpRunner,advanceRunner,crashRunner,runnerSpeed,remainingMs,ENCOUNTER_PATTERNS,makeEncounter,MAX_ENCOUNTER_FOODS} from '../public/assets/rex.mjs';
function avoidPlants(game,now){
  const plants=game.plants.filter(p=>p.x+p.width>PLAYER.x+8).sort((a,b)=>a.x-b.x),first=plants[0];if(!first)return;
  let last=first;for(const next of plants.slice(1)){if(next.x-last.x>100)break;last=next;}
  if((first.x+last.x+last.width)/2-(PLAYER.x+PLAYER.width/2)<runnerSpeed(game)*.36)jumpRunner(game,now);
}
function setEncounter(game,encounter,offset=320){
  game.nextSpawn=1000;game.plants=encounter.plants.map((p,id)=>({...p,x:offset+p.x,id}));game.foods=encounter.foods.map((f,id)=>({...f,x:offset+f.x,id}));
}
test('three lives, five-minute deadline and the original menu values and sizes',()=>{
  const game=createRunner({now:1000,width:620});assert.equal(game.deadline,301000);assert.equal(ROUND_MS,300000);assert.equal(game.lives,RUNNER_LIVES);assert.equal(game.lives,3);
  assert.deepEqual(FOODS.map(food=>[food.id,food.points]),[['jachnun',4],['lahoh',3],['kubaneh',2],['malawach',1]]);assert.equal(FOODS[0].radius,Math.min(...FOODS.map(food=>food.radius)));
  advanceRunner(game,.02,300999);assert.equal(game.phase,'playing');advanceRunner(game,.02,301000);assert.equal(game.phase,'finished');assert.equal(game.reason,'time');assert.equal(remainingMs(game,301001),0);assert.equal(jumpRunner(game,301001),false);
});
test('each food contributes its weighted value once, including low food while running',()=>{
  const game=createRunner({now:0});game.nextSpawn=100;
  for(const food of FOODS){game.foods=[{kind:food.id,x:120,y:GROUND-30,radius:food.radius}];advanceRunner(game,1/120,1);assert.equal(game.basket[food.id],1);assert.equal(game.events[0].points,food.points);advanceRunner(game,1/120,2);assert.equal(game.basket[food.id],1);}
  assert.equal(game.score,10);assert.equal(game.score,basketPoints(game.basket));
});
test('a crash preserves every food, point, distance and deadline; the third crash ends the round',()=>{
  const game=createRunner({now:1000});game.basket={jachnun:3,lahoh:2,kubaneh:1,malawach:4};game.score=basketPoints(game.basket);game.distance=20000;
  const deadline=game.deadline,score=game.score,basket={...game.basket};
  for(let crash=1;crash<=3;crash++){
    const now=5000+crash*2000;game.plants=[{x:105,width:40,height:70}];advanceRunner(game,.01,now);
    assert.equal(game.crashes,crash);assert.equal(game.lives,3-crash);assert.equal(game.score,score);assert.deepEqual(game.basket,basket);assert.equal(game.deadline,deadline);assert.ok(game.distance>=20000);assert.deepEqual(game.plants,[]);
    if(crash<3){assert.equal(game.phase,'playing');assert.equal(jumpRunner(game,now+200),false);advanceRunner(game,.02,now+400);assert.equal(remainingMs(game,now+400),deadline-now-400);}
  }
  assert.equal(game.phase,'finished');assert.equal(game.reason,'lives');crashRunner(game,12000);assert.equal(game.crashes,3);
});
test('one grounded jump at a time; time expires even during recovery or a hidden-tab gap',()=>{
  const game=createRunner({now:0});game.nextSpawn=100;assert.equal(jumpRunner(game,0),true);assert.equal(jumpRunner(game,0),false);advanceRunner(game,.1,100);assert.equal(jumpRunner(game,100),false);
  for(let i=2;i<=10;i++)advanceRunner(game,.1,i*100);assert.equal(game.player.y,GROUND-PLAYER.height);assert.equal(game.player.vy,0);
  game.score=4;game.basket.jachnun=1;crashRunner(game,299900);advanceRunner(game,0,300001);assert.equal(game.phase,'finished');assert.equal(game.reason,'time');assert.equal(game.score,4);assert.equal(game.lives,2);
  const hidden=createRunner({now:0});hidden.score=7;advanceRunner(hidden,0,ROUND_MS+90000);assert.equal(hidden.phase,'finished');assert.equal(hidden.score,7);
});
test('encounters include empty bushes, a close pair, spaced jumps, a rhythm sequence, ground food and airborne food',()=>{
  const encounter=pattern=>makeEncounter({pattern,random:()=>.9});
  assert.equal(encounter('single').foods.length,0);assert.equal(encounter('close-pair').plants.length,2);assert.ok(encounter('close-pair').span<110);
  const spaced=encounter('stepping-pair');assert.equal(spaced.plants.length,2);assert.ok(spaced.plants[1].x-spaced.plants[0].x>200);assert.equal(encounter('rhythm').plants.length,3);
  const trail=encounter('food-trail');assert.equal(trail.plants.length,0);assert.equal(trail.foods.length,4);assert.equal(new Set(trail.foods.map(food=>food.y)).size,2);
  const risky=encounter('temptation');assert.ok(risky.foods.some(food=>food.risky&&food.x>risky.plants[0].x+risky.plants[0].width&&food.x<risky.plants[1].x));
  for(const pattern of ENCOUNTER_PATTERNS)assert.ok(encounter(pattern).foods.length<=MAX_ENCOUNTER_FOODS);
});
test('every pattern has a safe route at minimum and maximum speeds, including a single jump over the close pair',()=>{
  for(const speed of [230,275,330])for(const sample of [0,.5,.9999])for(const pattern of ENCOUNTER_PATTERNS){
    const game=createRunner({now:0});game.distance=(speed-230)/.008;setEncounter(game,makeEncounter({speed,pattern,random:()=>sample}));
    let jumps=0;for(let frame=1;frame<=480;frame++){const now=frame*1000/60,vy=game.player.vy;avoidPlants(game,now);if(vy===0&&game.player.vy<0)jumps++;advanceRunner(game,1/60,now);}
    assert.equal(game.crashes,0,`${pattern} at ${speed}, sample ${sample}`);assert.equal(game.plants.length,0);
    if(pattern==='close-pair')assert.equal(jumps,1);if(pattern==='stepping-pair'||pattern==='temptation')assert.equal(jumps,2);if(pattern==='rhythm')assert.equal(jumps,3);
  }
});
test('tempting low food requires trading a life for points; skipping it allows safe passage',()=>{
  for(const speed of [230,330]){
    const encounter=makeEncounter({speed,pattern:'temptation',random:()=>.8});
    const safe=createRunner({now:0});safe.distance=(speed-230)/.008;setEncounter(safe,encounter);
    for(let frame=1;frame<300;frame++){const now=frame*1000/60;avoidPlants(safe,now);advanceRunner(safe,1/60,now);}
    assert.equal(safe.crashes,0);assert.equal(safe.basket.jachnun,0);
    const hungry=createRunner({now:0});hungry.distance=(speed-230)/.008;setEncounter(hungry,encounter);
    for(let frame=1;frame<300&&!hungry.crashes;frame++){const now=frame*1000/60,first=hungry.plants.find(p=>p.id===0&&p.x+p.width>PLAYER.x+8);if(first&&first.x+first.width/2-(PLAYER.x+PLAYER.width/2)<runnerSpeed(hungry)*.36)jumpRunner(hungry,now);advanceRunner(hungry,1/60,now);}
    assert.equal(hungry.crashes,1);assert.equal(hungry.basket.jachnun,1);assert.equal(hungry.score,4,'the risked bite is retained after the crash');
  }
});
test('a five-minute desktop or phone run has shuffled variety, safe transitions and all four types of food',()=>{
  for(const width of [620,960])for(const initial of [33,91,750]){
    let seed=initial;const random=()=>((seed=(1664525*seed+1013904223)>>>0)/2**32),game=createRunner({now:0,width}),patterns=[];
    for(let frame=1;frame<=18000;frame++){
      const now=frame*1000/60,before=game.encounters;avoidPlants(game,now);advanceRunner(game,1/60,now,random);if(game.encounters!==before)patterns.push(game.lastPattern);
    }
    assert.equal(game.phase,'finished');assert.equal(game.reason,'time');assert.equal(game.crashes,0,`safe transitions at width ${width}, seed ${initial}`);
    for(let i=0;i+6<=patterns.length;i+=6)assert.equal(new Set(patterns.slice(i,i+6)).size,6,'each shuffled bag includes all six encounter types');
    for(const food of FOODS)assert.ok(game.basket[food.id]>0,food.id+' must be collectible');assert.ok(game.score>100);assert.equal(game.score,basketPoints(game.basket));
  }
});
