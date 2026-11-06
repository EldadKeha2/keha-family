import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GROUND,FOODS,MAX_ENCOUNTER_FOODS,MIN_ENCOUNTER_GAP,ENCOUNTER_PATTERNS,makeEncounter,createRunner,advanceRunner} from '../public/assets/rex.mjs';

const seeded=initial=>{let seed=initial>>>0;return ()=>((seed=(1664525*seed+1013904223)>>>0)/2**32);};
const overlapsShrub=(food,plant)=>{
  const x=Math.max(plant.x,Math.min(food.x,plant.x+plant.width)),y=Math.max(GROUND-plant.height,Math.min(food.y,GROUND));
  return (food.x-x)**2+(food.y-y)**2<food.radius**2-1e-7;
};

test('procedural layouts cover a broad continuous range of reachable food positions for every food type',()=>{
  assert.ok(ENCOUNTER_PATTERNS.includes('scatter'));
  assert.ok(ENCOUNTER_PATTERNS.includes('mixed'));
  const heights=new Set(),heightBins=new Set(),positions=new Set(),kinds=new Map(FOODS.map(f=>[f.id,new Set()]));
  let low=0,middle=0,high=0;
  for(let seed=1;seed<=160;seed++)for(const pattern of ENCOUNTER_PATTERNS){
    const encounter=makeEncounter({speed:230+(seed%101),pattern,random:seeded(seed*7919+pattern.length)});
    assert.ok(encounter.foods.length<=MAX_ENCOUNTER_FOODS,pattern);
    if(pattern==='scatter'){assert.equal(encounter.plants.length,0);assert.ok(encounter.foods.length>=1);}
    if(pattern==='mixed')assert.ok(encounter.plants.length>=1&&encounter.plants.length<=3);
    for(const food of encounter.foods){
      assert.ok(Number.isFinite(food.x)&&Number.isFinite(food.y));
      assert.ok(kinds.has(food.kind),food.kind);
      assert.equal(food.radius,FOODS.find(type=>type.id===food.kind).radius);
      if(food.risky)continue;
      assert.ok(food.y>=158-1e-7&&food.y<=308+1e-7,`${pattern}: unreachable height ${food.y}`);
      heights.add(food.y.toFixed(4));heightBins.add(Math.floor((food.y-158)/5));positions.add(`${food.x.toFixed(3)},${food.y.toFixed(3)}`);
      kinds.get(food.kind).add(food.y.toFixed(4));
      if(food.y<208)high++;else if(food.y<258)middle++;else low++;
    }
  }
  assert.ok(heights.size>500,`Only ${heights.size} distinct heights`);
  assert.ok(heightBins.size>=26,`Only ${heightBins.size} five-pixel bands used`);
  assert.ok(positions.size>800,`Only ${positions.size} distinct positions`);
  for(const [kind,values] of kinds)assert.ok(values.size>75,`${kind} is tied to too few heights: ${values.size}`);
  assert.ok(Math.min(low,middle,high)>100,`Coverage low/middle/high: ${low}/${middle}/${high}`);
});

test('varied encounters keep collectible circles separate and normal food clear of shrubs',()=>{
  for(const speed of [230,275,330])for(let seed=1;seed<=120;seed++)for(const pattern of ENCOUNTER_PATTERNS){
    const encounter=makeEncounter({speed,pattern,random:seeded(seed*104729+Math.round(speed))});
    assert.ok(encounter.foods.length<=MAX_ENCOUNTER_FOODS);
    for(let i=0;i<encounter.foods.length;i++){
      const a=encounter.foods[i];
      assert.ok(a.y+a.radius<=GROUND+1e-7,`${pattern}: food extends below ground`);
      if(!a.risky)for(const plant of encounter.plants)assert.equal(overlapsShrub(a,plant),false,`${pattern}: food ${i} hidden in shrub`);
      for(const b of encounter.foods.slice(i+1))assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>=a.radius+b.radius-1e-7,`${pattern}: overlapping food`);
    }
  }
});

test('objects enter from offscreen and encounter timing varies without a forced six-layout cycle',()=>{
  for(const width of [620,960]){
    const game=createRunner({width,now:0}),random=seeded(91373+width),timings=new Set(),patterns=[];
    for(let n=0;n<96;n++){
      // Isolate successive generator choices without making fake collisions or
      // waiting for the long simulated runs covered in rex.test.mjs.
      game.plants=[];game.foods=[];game.nextSpawn=0;
      advanceRunner(game,.001,n+1,random);
      assert.equal(game.encounters,n+1);
      assert.ok(game.nextSpawn>=MIN_ENCOUNTER_GAP,`Too little recovery time: ${game.nextSpawn}`);
      for(const plant of game.plants)assert.ok(plant.x>game.width,'A shrub appeared inside the visible playfield');
      for(const food of game.foods)assert.ok(food.x-food.radius>game.width,'Food appeared inside the visible playfield');
      assert.ok(game.foods.length<=MAX_ENCOUNTER_FOODS);
      patterns.push(game.lastPattern);timings.add(game.nextSpawn.toFixed(4));
    }
    assert.ok(timings.size>75,`Too few independent spawn timings: ${timings.size}`);
    assert.equal(new Set(patterns).size,ENCOUNTER_PATTERNS.length);
    const blocks=Array.from({length:16},(_,i)=>patterns.slice(i*6,i*6+6));
    assert.ok(blocks.some(block=>new Set(block).size<6),'The generator still cycles through fixed six-pattern bags');
  }
});
