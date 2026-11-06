import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RECIPES} from '../public/assets/ruti-house-engine.mjs';
import {getHouseLayout,getTaskLocation,findHousePath,renderHouse} from '../public/assets/ruti-house-scene.mjs';

const sizes=[[1000,580],[390,570],[320,500]];
const inside=(point,obstacle,margin=0)=>point.x>obstacle.x-margin&&point.x<obstacle.x+obstacle.w+margin&&point.y>obstacle.y-margin&&point.y<obstacle.y+obstacle.h+margin;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

function checkWalk(layout,from,to){
 const path=findHousePath(layout,from,to);
 assert.ok(path.length>0,'every physical interaction needs a path');
 assert.ok(distance(path.at(-1),to)<1e-8,'the actor reaches the requested interaction anchor');
 let start=from;
 for(const end of path){
  // Check the route between waypoints as well as the waypoint positions: a
  // simplified route must never cut diagonally through a sofa, pot or table.
  for(let sample=0;sample<=50;sample++){
   const t=sample/50,p={x:start.x+(end.x-start.x)*t,y:start.y+(end.y-start.y)*t};
   assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));
   assert.ok(!layout.obstacles.some(o=>inside(p,o,.005)),`walk crosses furniture at ${p.x},${p.y}`);
   assert.ok(p.x>=layout.walkBounds.left-.001&&p.x<=layout.walkBounds.right+.001);
   assert.ok(p.y>=layout.walkBounds.top-.001&&p.y<=layout.walkBounds.bottom+.001);
  }
  start=end;
 }
 return path;
}

test('five permanent pots and five physical dishes retain their positions when tasks expire or stages change',()=>{
 for(const [width,height] of sizes){
  const first=getHouseLayout(width,height),again=getHouseLayout(width,height);
  assert.equal(first.plants.length,5);assert.deepEqual(Object.keys(first.recipes),RECIPES.map(recipe=>recipe.id));
  assert.deepEqual(first.plants,again.plants);assert.deepEqual(first.recipes,again.recipes);
  const plantPositions=new Set(first.plants.map(p=>`${p.x}:${p.y}`));assert.equal(plantPositions.size,5);
  for(let slot=0;slot<5;slot++){
   const active=getTaskLocation({id:`plant-${slot}`,type:'plant',slot,remaining:20,total:20},first);
   const expiring=getTaskLocation({id:`later-${slot}`,type:'plant',slot,remaining:.01,total:5},again);
   assert.deepEqual(active,first.plants[slot]);assert.deepEqual(expiring,active);
  }
  const stoneBottom=first.counter.y+first.counter.h*.43;
  for(const food of Object.values(first.recipes)){assert.ok(food.y>first.counter.y&&food.y<stoneBottom,'food rests on the stone counter');assert.ok(food.x>first.counter.x&&food.x<first.counter.x+first.counter.w);}
 }
});

test('main and side entrances are distinct and share guest/cat physical positions at each doorway',()=>{
 for(const [width,height] of sizes){
  const layout=getHouseLayout(width,height);assert.equal(layout.doors.length,2);assert.ok(layout.doors[0].x>.85);assert.ok(layout.doors[1].x<.15);
  assert.ok(distance(layout.doors[0],layout.doors[1])>.7);
  for(const door of [0,1]){
   const guest=getTaskLocation({type:'guest',door,slot:1-door},layout),cat=getTaskLocation({type:'cat',door,slot:1-door,waiting:6},layout);
   assert.deepEqual(guest,cat);assert.equal(cat.x,layout.doors[door].x,'explicit door takes precedence over an unrelated task slot');
   assert.deepEqual(cat.anchor,layout.doors[door].anchor);
  }
 }
});

test('all recipe, pot, tool shelf and doorway anchors are reachable without cutting through furniture',()=>{
 for(const [width,height] of sizes){
  const layout=getHouseLayout(width,height),targets=[...Object.values(layout.recipes),...layout.plants,...layout.doors,layout.pickup];
  for(const start of [layout.spawn,{x:.51,y:.83}])for(const target of targets)checkWalk(layout,start,target.anchor);
  // A diagonal direct route between these corners would cut through both
  // dining furniture and the sofa; the returned route must go around them.
  const route=checkWalk(layout,{x:.19,y:.89},{x:.82,y:.37});assert.ok(route.length>=2);
 }
});

test('continuous dust positions remain varied, stable, accessible and outside every furniture footprint',()=>{
 for(const [width,height] of sizes){
  const layout=getHouseLayout(width,height),positions=new Set();
  for(let i=0;i<80;i++){
   const task={id:`dust-${i}`,type:'dust',slot:i%6,position:{x:.18+(i*37%79)/79*.64,y:.29+(i*53%79)/79*.42},remaining:10,total:10};
   const p=getTaskLocation(task,layout);positions.add(`${p.x.toFixed(4)}:${p.y.toFixed(4)}`);
   assert.deepEqual(p,getTaskLocation({...task,remaining:.01},layout),'a cloud must not jump as its timer changes');
   assert.ok(!layout.obstacles.some(o=>inside(p,o,.012)),'cloud is mapped onto an open floor area');
   assert.deepEqual(p.anchor,{x:p.x,y:p.y});assert.ok(p.hitRadius>0&&p.hitRadius<.15);
   if(i%10===0)checkWalk(layout,layout.spawn,p.anchor);
  }
  assert.ok(positions.size>60,'dust must use continuous positions rather than six repeated spots');
 }
});

test('all physical interaction areas provide finite radii suitable for a 44 CSS pixel minimum touch target',()=>{
 for(const [width,height] of sizes){
  const l=getHouseLayout(width,height),min=Math.min(width,height);
  for(const target of [...Object.values(l.recipes),...l.plants,...l.doors,l.pickup,getTaskLocation({type:'dust',position:{x:.43,y:.6}},l)]){
   assert.ok(Number.isFinite(target.hitRadius)&&target.hitRadius>0);
   const diameter=Math.max(44,target.hitRadius*2*min);assert.ok(diameter>=44&&diameter<=min*.25);
   assert.ok(target.x>=0&&target.x<=1&&target.y>=0&&target.y<=1);
  }
 }
});

test('interaction reach remains close to physical pots and doors when the canvas becomes wide',()=>{
 for(const [width,height] of [[1130,580],[390,570],[320,500]]){
  const layout=getHouseLayout(width,height);
  for(const target of [...layout.plants,...layout.doors]){
   const reach=Math.hypot((target.x-target.anchor.x)*width,(target.y-target.anchor.y)*height);
   assert.ok(reach<=65&&reach>=30,`physical interaction reach is ${reach} CSS pixels`);
  }
 }
});

test('waiting cats announce that they are outside and the label disappears when their approach starts',()=>{
 const written=[];const gradient={addColorStop(){}};
 const ctx=new Proxy({canvas:{width:1000,height:580},createLinearGradient(){return gradient;},createRadialGradient(){return gradient;},fillText(value){written.push(value);}},{get:(target,key)=>key in target?target[key]:(()=>{})});
 const cat={id:'cat-test',type:'cat',door:0,slot:0,waiting:6,waitingTotal:6,total:38,remaining:38};
 const g={tasks:[cat],inventory:{},kitchen:{}};
 renderHouse(ctx,g,{actor:{x:.4,y:.5}},{width:1000,height:580,time:1,images:{}});
 assert.ok(written.includes('מחכה בחוץ…'));assert.ok(written.includes('ברוכים הבאים'));assert.ok(written.includes('דלת צדדית'));
 written.length=0;cat.waiting=0;renderHouse(ctx,g,{actor:{x:.4,y:.5}},{width:1000,height:580,time:2,images:{},english:true});
 assert.ok(!written.includes('Waiting…'));assert.ok(!written.includes('מחכה בחוץ…'));
});

test('served guests thank Ruti while entering; retreating and entering cats render with finite poses',()=>{
 const written=[],numbers=[];const gradient={addColorStop(){}};
 const ctx=new Proxy({canvas:{width:1000,height:580},createLinearGradient(){return gradient;},createRadialGradient(){return gradient;},fillText(value){written.push(value);},translate(x,y){numbers.push(x,y);}}, {get:(target,key)=>key in target?target[key]:(()=>{})});
 const departures=[{type:'guest',guest:'hila',door:0,age:.4,duration:1.5},{type:'cat',door:1,age:.4,duration:1},{type:'cat-enter',door:0,age:.4,duration:1.3}];
 const game={tasks:[],inventory:{},kitchen:{}};
 for(const [width,height] of sizes)renderHouse(ctx,game,{actor:{x:.4,y:.5},departures},{width,height,time:3,images:{}});
 assert.ok(written.includes('תודה רותי!'));assert.ok(numbers.length>0&&numbers.every(Number.isFinite));
 written.length=0;departures[0].age=1.5;renderHouse(ctx,game,{actor:{x:.4,y:.5},departures},{width:1000,height:580,time:4,images:{}});
 assert.ok(!written.includes('תודה רותי!'),'a completed departure disappears');
});
