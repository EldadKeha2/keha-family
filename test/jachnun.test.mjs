import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_CHARACTER,SNAKE_LIVES,createSnake,turnSnake,advanceSnake,continueSnake,placeJachnun,snakeDelay,headCrop,snakeCharacters} from '../public/assets/jachnun.mjs';

test('Grandma Yona is the default character and a new game has three lives and three heads',()=>{
  const game=createSnake();assert.equal(DEFAULT_CHARACTER,'yona');assert.equal(game.lives,3);assert.equal(SNAKE_LIVES,3);assert.equal(game.score,0);assert.equal(game.body.length,3);assert.equal(game.phase,'ready');
});
test('eating one jachnun adds exactly one head and one point; ordinary movement preserves length',()=>{
  let g=createSnake();g={...g,phase:'playing',food:{x:g.body[0].x+1,y:g.body[0].y}};
  const after=advanceSnake(g,()=>0);assert.equal(after.body.length,4);assert.equal(after.score,1);assert.deepEqual(g.body[0],{x:9,y:9});assert.ok(!after.body.some(p=>p.x===after.food.x&&p.y===after.food.y));
  const moved=advanceSnake(after);assert.equal(moved.body.length,4);assert.equal(moved.score,1);
});
test('a wall costs exactly one life and each new life preserves the score; the third crash ends the game',()=>{
  let g={...createSnake(),score:7,phase:'playing'};
  for(let lives=2;lives>=0;lives--){g={...g,body:[{x:g.size-1,y:5},{x:g.size-2,y:5},{x:g.size-3,y:5}],direction:'right',turns:[],phase:'playing'};g=advanceSnake(g);assert.equal(g.lives,lives);assert.equal(g.score,7);assert.equal(g.phase,lives?'lost':'finished');assert.equal(advanceSnake(g),g);if(lives){g=continueSnake(g);assert.equal(g.body.length,3);assert.equal(g.phase,'ready');assert.equal(g.lives,lives);}}
  assert.equal(continueSnake(g),g);
});
test('self-collisions count but moving into the departing tail is legal',()=>{
  const g={...createSnake(),phase:'playing',direction:'up',turns:[],body:[{x:3,y:3},{x:3,y:4},{x:2,y:4},{x:2,y:3}],food:{x:9,y:9}};
  const tail=advanceSnake(turnSnake(g,'left'));assert.equal(tail.phase,'playing');assert.equal(tail.lives,3);assert.deepEqual(tail.body[0],{x:2,y:3});
  const self=advanceSnake({...g,direction:'down'});assert.equal(self.phase,'lost');assert.equal(self.reason,'self');assert.equal(self.lives,2);
});
test('rapid turns remain ordered and cannot reverse or skip straight into the chain',()=>{
  let g={...createSnake(),phase:'playing'};assert.equal(turnSnake(g,'left'),g);assert.equal(turnSnake(g,'invalid'),g);
  g=turnSnake(turnSnake(g,'up'),'left');assert.deepEqual(g.turns,['up','left']);assert.equal(turnSnake(g,'down'),g);
  const one=advanceSnake(g);assert.equal(one.direction,'up');assert.deepEqual(one.turns,['left']);const two=advanceSnake(one);assert.equal(two.direction,'left');assert.deepEqual(two.turns,[]);
});
test('jachnun never spawns on a head, including the last free cell, and filling the board wins',()=>{
  const body=[{x:0,y:0},{x:1,y:0},{x:0,y:1}];assert.deepEqual(placeJachnun(body,2,()=>1),{x:1,y:1});assert.equal(placeJachnun([...body,{x:1,y:1}],2),null);
  const g={...createSnake(),size:2,phase:'playing',direction:'right',body:[{x:0,y:1},{x:0,y:0},{x:1,y:0}],food:{x:1,y:1}};
  const won=advanceSnake(g);assert.equal(won.phase,'finished');assert.equal(won.reason,'filled');assert.equal(won.lives,3);assert.equal(won.score,1);assert.equal(won.body.length,4);
});
test('head cropping stays within portrait and landscape photos, including manual edge positions',()=>{
  for(const [w,h] of [[414,444],[1200,400],[300,900]])for(const zoom of [1,1.35,3])for(const x of [0,.5,1])for(const y of [0,.34,1]){const c=headCrop(w,h,{zoom,x,y});assert.ok(c.x>=0&&c.y>=0);assert.ok(c.x+c.size<=w+.001&&c.y+c.size<=h+.001);}
});
test('only reviewed snapshots are offered and a changed profile cannot alter their images or crops',()=>{
  const family={yona:{id:'yona',name:'יונה',nameEn:'Yona',profile:'/changed'},eldad:{id:'eldad',name:'אלדד',profile:'/good-live-but-not-reviewed'},placeholder:{id:'placeholder',placeholder:true},extra:{id:'extra',extra:true}};
  const prepared=[{id:'yona',src:'assets/games/heads/yona.png',crop:{zoom:1.35,x:.58,y:.43}},{id:'placeholder',src:'/placeholder'},{id:'extra',src:'/extra'}];
  const people=snakeCharacters(family,prepared);assert.deepEqual(people.map(p=>p.id),['yona']);assert.equal(people[0].profile,'assets/games/heads/yona.png');assert.equal(people[0].nameEn,'Yona');assert.deepEqual(people[0].preparedCrop,prepared[0].crop);assert.equal(family.yona.profile,'/changed');assert.ok(snakeDelay(90)>=105);assert.ok(snakeDelay(0)>snakeDelay(12));
});

test('every prepared head has an independent local image and explicit reviewed crop coordinates',async()=>{
  const {PREPARED_HEADS}=await import('../public/assets/jachnun-heads.mjs');const {readFile}=await import('node:fs/promises');
  assert.ok(PREPARED_HEADS.length>=10);assert.equal(PREPARED_HEADS[0].id,'yona');assert.equal(new Set(PREPARED_HEADS.map(h=>h.id)).size,PREPARED_HEADS.length);
  for(const head of PREPARED_HEADS){assert.match(head.src,/^assets\/games\/heads\/[a-z-]+\.(png|jpg)$/);assert.ok(head.crop.zoom>=1&&head.crop.zoom<=3);assert.ok(head.crop.x>=0&&head.crop.x<=1);assert.ok(head.crop.y>=0&&head.crop.y<=1);const bytes=await readFile(new URL('../public/'+head.src,import.meta.url));assert.ok(bytes.length>1000);assert.ok(bytes[0]===137||bytes[0]===255);}
});
