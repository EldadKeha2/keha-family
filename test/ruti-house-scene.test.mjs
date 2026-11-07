import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RECIPES} from '../public/assets/ruti-house-engine.mjs';
import {PLANT_VARIETIES,getHouseLayout,getTaskLocation,findHousePath,renderHouse,getRutiWateringGeometry,drawRutiCelebration} from '../public/assets/ruti-house-scene.mjs';

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

test('four distinct permanent pots and counter anchors retain their positions when tasks expire or stages change',()=>{
 for(const [width,height] of sizes){
  const first=getHouseLayout(width,height),again=getHouseLayout(width,height);
  assert.equal(first.plants.length,4);assert.deepEqual(first.plants.map(p=>p.variety),['geranium','petunia','fern','pothos']);assert.deepEqual(Object.keys(first.recipes),RECIPES.map(recipe=>recipe.id));
  assert.deepEqual(first.plants,again.plants);assert.deepEqual(first.recipes,again.recipes);
  const plantPositions=new Set(first.plants.map(p=>`${p.x}:${p.y}`));assert.equal(plantPositions.size,4);
  for(let slot=0;slot<4;slot++){
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

test('untimed practice targets omit timer labels and deadline arcs without an approaching cat',()=>{
 const written=[],strokes=[];const gradient={addColorStop(){}};
 const ctx=new Proxy({canvas:{width:1000,height:580},createLinearGradient(){return gradient;},createRadialGradient(){return gradient;},fillText(value){written.push(value);},stroke(){strokes.push(this.strokeStyle);}},{get:(target,key)=>key in target?target[key]:(()=>{})});
 const tasks=[{id:'p',type:'plant',slot:0},{id:'d',type:'dust',position:{x:.43,y:.60}},{id:'g',type:'guest',door:0,guest:'hila',recipeId:'tahini'},{id:'c',type:'cat',door:1,waiting:0}].map(task=>({...task,untimed:true,total:1,remaining:.01}));
 const game={level:1,tutorial:{kind:'plant'},tasks,inventory:{},kitchen:{}};
 renderHouse(ctx,game,{actor:{x:.4,y:.5}},{width:1000,height:580,time:100,images:{}});
 assert.ok(!written.includes('∞'),'task badges remain uncluttered during practice');
 assert.ok(written.includes('מחכה בחוץ…'),'the tutorial cat stays outside even with zero waiting seconds');
 assert.ok(!written.includes('!'),'the waiting cat does not enter its alarm pose');
 assert.ok(!strokes.some(color=>['#c94a3e','#df9f36','#67885a'].includes(color)),'practice never draws a draining or urgent deadline ring');
 written.length=0;strokes.length=0;tasks.forEach(task=>task.untimed=false);
 renderHouse(ctx,game,{actor:{x:.4,y:.5}},{width:1000,height:580,time:101,images:{}});
 assert.ok(strokes.includes('#c94a3e'),'regular timed tasks retain their deadline feedback');
 assert.ok(!written.includes('∞'));
});

function renderRecord(game,options={},visual={}){
 const written=[],strokes=[],fills=[];const gradient={addColorStop(){}};
 const width=options.width||390,height=options.height||570;
 const ctx=new Proxy({canvas:{width,height},createLinearGradient(){return gradient;},createRadialGradient(){return gradient;},beginPath(){this.pathArc=null;},arc(x,y,r){this.pathArc={x,y,r};},stroke(){strokes.push({color:this.strokeStyle,width:this.lineWidth,arc:this.pathArc});},fill(){fills.push(this.fillStyle);},fillText(text,x,y){written.push({text,x,y});}},{get:(target,key)=>key in target?target[key]:(()=>{})});
 renderHouse(ctx,game,{actor:{x:.4,y:.5},...visual},{width,height,time:options.time??2,images:{},...options});
 return {written,strokes,fills};
}

test('four plants retain distinct flower, leaf and pot artwork without species labels',()=>{
 const expected=['geranium','petunia','fern','pothos'];assert.deepEqual(PLANT_VARIETIES.map(p=>p.id),expected);
 for(const english of [false,true]){
  const r=renderRecord({level:1,tasks:[],inventory:{},kitchen:{}},{english});
  for(const plant of PLANT_VARIETIES)assert.ok(!r.written.some(t=>t.text===plant.he||t.text===plant.en),'plant species names are not drawn on the game scene');
  for(const color of ['#d91f3b','#8f32d2','#55a641','#238f4c','#bd573f','#315cb2','#e7d3a4','#238c83'])assert.ok(r.fills.includes(color)||r.strokes.some(s=>s.color===color),`the distinct plant artwork includes ${color}`);
 }
});

test('watering requests stay strongly outlined in every pulse phase and become static under reduced motion',()=>{
 const game={level:1,tasks:[{id:'p',type:'plant',slot:0,untimed:true,total:1,remaining:1}],inventory:{},kitchen:{}};
 const outlineRadius=[];
 for(const time of [0,.2,.65]){
  const r=renderRecord(game,{time});
  for(const color of ['#123e4b','#ffffff','#00aee5'])assert.ok(r.strokes.some(s=>s.color===color),'high contrast rings never blink off');
  assert.ok(r.fills.some(color=>['#fff18fea','#fffbd9f2'].includes(color)),'persistent bright spotlight separates the pot from the room');
  assert.ok(r.written.some(t=>t.text==='מים!'));assert.ok(!r.written.some(t=>t.text==='∞'));
  outlineRadius.push(r.strokes.find(s=>s.color==='#00aee5').arc.r);
 }
 assert.ok(new Set(outlineRadius).size>1,'normal motion gently pulses the watering outline');
 const first=renderRecord(game,{time:0,reduced:true}),later=renderRecord(game,{time:100,reduced:true});
 assert.equal(first.strokes.find(s=>s.color==='#00aee5').arc.r,later.strokes.find(s=>s.color==='#00aee5').arc.r,'reduced motion uses an equally clear static outline');
});

test('urgent plant requests keep clear words and deadline bars without numeric countdowns',()=>{
 for(const [width,height] of [...sizes,[280,500]]){
  const layout=getHouseLayout(width,height),tasks=layout.plants.map(p=>({id:`p-${p.slot}`,type:'plant',slot:p.slot,total:12,remaining:2.2}));
  const r=renderRecord({level:1,tasks,inventory:{},kitchen:{}},{width,height,english:true});
  const badges=r.written.filter(t=>t.text==='Hurry!');
  assert.equal(badges.length,4);assert.ok(!r.written.some(t=>/^[0-9]+s?$/.test(t.text)||t.text==='∞'));assert.ok(r.fills.includes('#f65c62'),'the draining deadline bar remains visible');
  assert.ok(badges.every(t=>t.x>=28&&t.x<=width-28),'urgent words stay within the screen even for edge pots');
  assert.ok(r.fills.includes('#f65c62'),'the countdown bar also marks the short remaining window');
 }
});

test('early stages keep an empty counter and later hospitality uses one prepared platter without recipes or stock badges',()=>{
 for(const level of [1,2,3,4]){
  const r=renderRecord({level,unlockedTools:['water','broom'],tasks:[],inventory:{tahini:3},kitchen:{}});
  assert.ok(!r.written.some(t=>['מטעמי הבית','טחינה','גזר וצימוקים','קובנה','חצילים','לזניה','3'].includes(t.text)),'early stages have no food menu or stock counters');
 }
 const r=renderRecord({level:5,unlockedTools:['water','broom','hand','serve'],tasks:[],inventory:{tahini:3},kitchen:{}});
 assert.equal(r.written.filter(t=>t.text==='מטעמי הבית').length,1);
 assert.ok(!r.written.some(t=>['טחינה','גזר וצימוקים','קובנה','חצילים','לזניה','3'].includes(t.text)),'prepared food is one simple action, not a recipe grid');
});

test('missed watering briefly wilts the correct pot and shows an explicit failure badge',()=>{
 const game={level:1,tasks:[],inventory:{},kitchen:{}};
 const active=renderRecord(game,{}, {departures:[{type:'plant-missed',slot:2,age:.3,duration:1.8}]});
 assert.equal(active.written.filter(t=>t.text==='פספסתם').length,1);
 const expired=renderRecord(game,{}, {departures:[{type:'plant-missed',slot:2,age:1.8,duration:1.8}]});
 assert.ok(!expired.written.some(t=>t.text==='פספסתם'));
 const reduced=renderRecord(game,{reduced:true,english:true},{departures:[{type:'plant-missed',slot:2,age:.3,duration:1.8}]});
 assert.ok(reduced.written.some(t=>t.text==='Missed'),'failure remains explicit without animation');
});


test('Ruti’s transparent head keeps its natural outline, aspect ratio and neck connection while guest portraits retain their crop',()=>{
 const ruti={complete:true,naturalWidth:300,naturalHeight:400},guest={complete:true,naturalWidth:600,naturalHeight:600};
 const calls=[],clips=[],ellipses=[],gradient={addColorStop(){}};
 let path=null;
 const ctx=new Proxy({canvas:{width:1000,height:580},createLinearGradient(){return gradient;},createRadialGradient(){return gradient;},beginPath(){path=null;},ellipse(...args){path={kind:'ellipse',args};ellipses.push(args);},rect(...args){path={kind:'rect',args};},clip(){clips.push(path);},drawImage(...args){calls.push(args);}},{get:(target,key)=>key in target?target[key]:(()=>{})});
 const game={level:1,tasks:[]};
 renderHouse(ctx,game,{actor:{x:.4,y:.5}},{width:1000,height:580,images:{ruti},reduced:true});
 const head=calls.find(call=>call[0]===ruti);assert.ok(head,'the actual transparent sprite is rendered');
 assert.equal(head.length,5,'the complete alpha image is drawn, without a round portrait crop');
 const [,x,y,w,h]=head;
 assert.ok(Math.abs(w/h-300/400)<1e-10,'the head is not stretched');
 assert.ok(w<=56&&h<=62);assert.equal(x,-w/2);assert.equal(y+h,-62,'the neck meets the body shoulders instead of floating above them');
 assert.ok(!clips.some(p=>p?.kind==='ellipse'),'Ruti is not put inside any circular mask');
 assert.ok(!ellipses.some(a=>a[0]===0&&a[1]===-80&&a[2]===18&&a[3]===20),'no opaque oval sits behind the transparent head');
 calls.length=0;clips.length=0;
 const task={id:'guest',type:'guest',guest:'hila',door:0,total:50,remaining:45};
 renderHouse(ctx,{level:5,tasks:[task]},{actor:{x:.4,y:.5}},{width:1000,height:580,images:{ruti,family:{hila:guest}},reduced:true});
 assert.equal(calls.find(call=>call[0]===guest)?.length,9,'guest portrait source cropping is unchanged');
 assert.ok(clips.some(p=>p?.kind==='ellipse'),'guest portraits retain their existing mask');
});


test('watering faces and lands on every physical pot even if the last walking step faced away',()=>{
 for(const [width,height] of sizes){
  const layout=getHouseLayout(width,height),M=Math.min(width,height),actorHeight=Math.max(layout.portrait?94:102,Math.min(layout.portrait?116:140,M*(layout.portrait?.28:.245)));
  for(const plant of layout.plants){
   const actor={x:plant.anchor.x*width,y:plant.anchor.y*height,facing:plant.x<plant.anchor.x?1:-1};
   const target={x:plant.x*width,y:plant.y*height+M*(layout.portrait?.15:.12)*.125};
   const geometry=getRutiWateringGeometry(actor,target,actorHeight,{lean:.008,breath:1.006});
   assert.equal(geometry.facing,target.x<actor.x?-1:1);
   assert.equal(geometry.facing,-actor.facing,'the arrival direction cannot point the can away from the pot');
   assert.deepEqual(geometry.end,target,'the stream lands inside the selected pot rim');
   assert.ok((geometry.start.x-actor.x)*geometry.facing>0,'the can nozzle is on the target side');
   assert.ok(geometry.start.y<geometry.end.y,'the stream falls down into the pot');
   assert.ok(Object.values(geometry.start).concat(Object.values(geometry.control)).every(Number.isFinite));
  }
 }
});

test('the enlarged broom dancer preserves full-width head art and narrows only the connected body',()=>{
 const atlas={complete:true,naturalWidth:1448,naturalHeight:1086},calls=[],numbers=[],gradient={addColorStop(){}};
 const ctx=new Proxy({createRadialGradient(){return gradient;},drawImage(...args){calls.push(args);}}, {get:(target,key)=>key in target?target[key]:(...args)=>numbers.push(...args.filter(x=>typeof x==='number'))});
 for(const [width,height] of sizes){
  calls.length=0;drawRutiCelebration(ctx,{width,height,time:2,progress:.6,reduced:true,images:{rutiAtlas:atlas},actor:{}});
  assert.ok(calls.length>=8,'the head, neck and connected body are drawn from the same atlas pose');
  const head=calls[0],body=calls.at(-1);
  assert.equal(head[1],.5,'the dancer uses the original broom pose in column one');
  assert.equal(head[2],362.5,'the dancer uses the original broom pose in row two');
  const headScale=head[7]/head[3],bodyScale=body[7]/body[3];
  assert.ok(Math.abs(bodyScale/headScale-.91)<1e-10,'only the body becomes slightly narrower');
  assert.ok(head[8]>0&&body[8]>0);assert.ok(numbers.every(Number.isFinite));
 }
});
