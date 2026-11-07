import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RECIPES} from '../public/assets/ruti-house-engine.mjs';
import {PLANT_VARIETIES,getHouseLayout,getTaskLocation,findHousePath,renderHouse,getRutiWateringGeometry,drawRutiCelebration,getHouseGuestSeat,residentGuestPose,drawHouseGuest} from '../public/assets/ruti-house-scene.mjs';

const sizes=[[1000,580],[390,570],[320,500]];
const inside=(point,obstacle,margin=0)=>point.x>obstacle.x-margin&&point.x<obstacle.x+obstacle.w+margin&&point.y>obstacle.y-margin&&point.y<obstacle.y+obstacle.h+margin;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

test('eight stable guest seats stay inside the room with reachable serving positions on desktop and mobile',()=>{
 for(const [width,height] of [...sizes,[1130,530]]){
  const layout=getHouseLayout(width,height),seats=layout.guestSeats.map((_,i)=>getHouseGuestSeat(i,layout));
  assert.equal(seats.length,8);assert.equal(new Set(seats.map(s=>`${s.x}:${s.y}`)).size,8);
  for(const [seat,position] of seats.entries()){
   assert.ok(position.x>.15&&position.x<.9&&position.y>.4&&position.y<.94);
   assert.deepEqual(getTaskLocation({type:'guest',resident:true,seat,door:0},layout),position);
   checkWalk(layout,layout.spawn,position.anchor);
  }
 }
});

test('served guests reach their own seats continuously and remain seated after animations and level changes',()=>{
 for(const [width,height] of sizes)for(let seat=0;seat<8;seat++){
  const layout=getHouseLayout(width,height),person={guest:'hila',seat,door:seat%2,servedAt:10};let previous;
  for(let elapsed=10;elapsed<=19;elapsed+=.05){
   const p=residentGuestPose(person,layout,elapsed);assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));
   if(previous)assert.ok(Math.hypot((p.x-previous.x)*width,(p.y-previous.y)*height)<Math.min(width,height)*.045,'the walk and sit transition never teleport');previous=p;
  }
  const settled=residentGuestPose(person,layout,100),later=residentGuestPose(person,layout,1000);
  assert.equal(settled.sitting,1);assert.equal(settled.walking,false);assert.deepEqual(later,settled);
  assert.deepEqual(residentGuestPose(person,layout,10,{reduced:true}),settled,'reduced motion seats people immediately');
 }
});

test('seated guests retain the original face, neck and torso at natural scale for all eight identities',()=>{
 const family={complete:true,naturalWidth:1536,naturalHeight:1024},visitors={...family},calls=[];
 const ctx=new Proxy({drawImage(...args){calls.push(args);}},{get:(target,key)=>key in target?target[key]:()=>{}});
 for(const [index,id] of ['roi','hila','rivi','lihi','visitor-man','visitor-hila','visitor-rivi','visitor-lihi'].entries()){
  calls.length=0;assert.equal(drawHouseGuest(ctx,100,200,110,id,{familyAtlas:family,visitorAtlas:visitors},12,{sitting:1}),true);
  assert.equal(calls.length,2);const upper=calls[0];assert.equal(upper[0],index<4?family:visitors);
  assert.equal(upper[1],(index%4)*384+.5);assert.equal(upper[2],.5);assert.ok(upper[4]>300,'the connected head, neck and upper body remain one image');
  assert.ok(Math.abs(upper[7]/384-upper[8]/upper[4])<.001,'the upper body keeps its proportions');
 }
});

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
  for(const target of [...layout.plants.filter(p=>p.slot!==1),...layout.doors]){
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
 assert.ok(written.includes('מחכה בחוץ…'));assert.ok(written.includes('ברוכים הבאים'));assert.ok(written.includes('דלת אחורית'));
 written.length=0;cat.waiting=0;renderHouse(ctx,g,{actor:{x:.4,y:.5}},{width:1000,height:580,time:2,images:{},english:true});
 assert.ok(!written.includes('Waiting…'));assert.ok(!written.includes('מחכה בחוץ…'));
});

test('served guests still render long after departure timers end and cats keep finite departure poses',()=>{
 const calls=[],numbers=[],atlas={complete:true,naturalWidth:1536,naturalHeight:1024},gradient={addColorStop(){}};
 const ctx=new Proxy({canvas:{width:1000,height:580},createLinearGradient(){return gradient;},createRadialGradient(){return gradient;},drawImage(...args){calls.push(args);},translate(x,y){numbers.push(x,y);}}, {get:(target,key)=>key in target?target[key]:(()=>{})});
 const departures=[{type:'cat',door:1,age:.4,duration:1},{type:'cat-enter',door:0,age:.4,duration:1.3}];
 const game={level:11,tasks:[],guestsInside:[{guest:'hila',seat:0,door:0,servedAt:0}],inventory:{},kitchen:{}};
 for(const [width,height] of sizes)for(const elapsed of [20,200]){
  calls.length=0;game.elapsed=elapsed;
  renderHouse(ctx,game,{actor:{x:.4,y:.5},departures},{width,height,time:elapsed,images:{familyAtlas:atlas}});
  assert.equal(calls.filter(c=>c[0]===atlas).length,2,'the seated guest never fades out');
 }
 assert.ok(numbers.length>0&&numbers.every(Number.isFinite));
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
 assert.equal(r.written.filter(t=>t.text==='מטעמי הבית').length,0,'later stages keep the food artwork without decorative words');assert.ok(r.fills.includes('#ce8b3e'),'the prepared platter remains on the counter');
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
   assert.ok(geometry.control.y<geometry.end.y,'the final stream segment falls down into the pot, including on the counter');
   assert.ok(Object.values(geometry.start).concat(Object.values(geometry.control)).every(Number.isFinite));
  }
 }
});

test('the dancer draws her head, neck and shoulders in one continuous original pose at every size',()=>{
 const atlas={complete:true,naturalWidth:1448,naturalHeight:1086},calls=[],numbers=[],gradient={addColorStop(){}};
 const ctx=new Proxy({createRadialGradient(){return gradient;},drawImage(...args){calls.push(args);}}, {get:(target,key)=>key in target?target[key]:(...args)=>numbers.push(...args.filter(x=>typeof x==='number'))});
 for(const [width,height] of sizes)for(const reduced of [false,true])for(const time of [.02,.11,.20,3.43]){
  calls.length=0;drawRutiCelebration(ctx,{width,height,time,progress:.6,reduced,images:{rutiAtlas:atlas},actor:{}});
  assert.equal(calls.length,4,'one continuous upper body and three strips for stepping feet and grounded broom');
  const body=calls[0];assert.equal(body[1],.5);assert.equal(body[2],362.5);
  assert.ok(body[3]>360&&body[4]>309,'the entire head, neck, collar, shoulders, hands and upper body come from the same image');
  for(const call of calls){assert.equal(call[0],atlas);assert.ok(Math.abs(call[7]/call[3]-call[8]/call[4])<1e-10,'head and body share their natural scale');}
  assert.ok(numbers.every(Number.isFinite));
 }
});

test('the large main entrance and smaller back door are visually distinct before any tasks begin',()=>{
 for(const [width,height] of sizes){
  const {doors}=getHouseLayout(width,height),[main,back]=doors;
  assert.equal(main.kind,'main');assert.equal(back.kind,'back');
  assert.ok(main.visualScale/back.visualScale>1.6,'the main door is clearly taller and wider');
  assert.ok(main.x>back.x);assert.ok(main.anchor.x<main.x&&back.anchor.x>back.x,'the original reachable indoor anchors are preserved');
 }
});

test('quiet task signals retain art and deadline bars while suppressing learned labels',()=>{
 const tasks=[{id:'p',type:'plant',slot:0},{id:'d',type:'dust',position:{x:.25,y:.6}},{id:'c',type:'cat',door:1,waiting:2}].map(t=>({...t,total:10,remaining:2}));
 const game={level:1,tasks},normal=renderRecord(game),quiet=renderRecord(game,{}, {showTaskLabels:{plant:false,dust:false,cat:false}});
 assert.ok(normal.written.some(t=>t.text==='מהר!'));assert.ok(normal.written.some(t=>t.text==='אבק!'));assert.ok(normal.written.some(t=>t.text==='מחכה בחוץ…'));
 for(const text of ['מים!','מהר!','אבק!','מחכה בחוץ…','!'])assert.ok(!quiet.written.some(t=>t.text===text),`${text} is no longer repeated after learning`);
 for(const color of ['#00aee5','#ffffff','#8b234c'])assert.ok(quiet.strokes.some(s=>s.color===color),'physical task signals remain visible');
 assert.ok(quiet.fills.includes('#f65c62'),'the watering deadline bar remains');
 assert.ok(quiet.fills.includes('#ee759c'),'the dust deadline bar remains');
});

test('Hebrew labels and speech use RTL punctuation while English remains LTR',()=>{
 const written=[],gradient={addColorStop(){}};
 const ctx=new Proxy({canvas:{width:390,height:570},createLinearGradient(){return gradient;},createRadialGradient(){return gradient;},measureText(text){return {width:text.length*6};},fillText(text){written.push({text,direction:this.direction,align:this.textAlign});}},{get:(target,key)=>key in target?target[key]:(()=>{})});
 const g={level:1,tasks:[{id:'p',type:'plant',slot:0,total:20,remaining:18},{id:'d',type:'dust',position:{x:.3,y:.6},total:20,remaining:18}]};
 for(const english of [false,true]){
  written.length=0;renderHouse(ctx,g,{actor:{x:.4,y:.5,speechText:english?'Every drop with love.':'כל טיפה באהבה.',speechUntil:10}},{width:390,height:570,time:2,english});
  assert.ok(written.length>2);
  for(const item of written)if(/[a-z\u0590-\u05ff]/i.test(item.text))assert.equal(item.direction,/[\u0590-\u05ff]/.test(item.text)?'rtl':'ltr');
  assert.ok(written.filter(item=>item.text.endsWith('!')||item.text.endsWith('.')).every(item=>item.align==='center'));
 }
});

test('singing never substitutes a detached speech head or changes the neck and shoulders',()=>{
 const atlas={complete:true,naturalWidth:1448,naturalHeight:1086},calls=[],gradient={addColorStop(){}};
 const ctx=new Proxy({createRadialGradient(){return gradient;},drawImage(...args){calls.push(args);}}, {get:(target,key)=>key in target?target[key]:(()=>{})});
 const upperBodies=[];
 for(const time of [.02,.11,.20,3.43]){
  calls.length=0;drawRutiCelebration(ctx,{width:390,height:570,time,images:{rutiAtlas:atlas},actor:{celebrationStartedAt:0}});
  upperBodies.push(calls[0].slice(1));
  assert.ok(calls.every(call=>call[2]>=362&&call[2]+call[4]<=725),'every body pixel stays in the original broom pose');
 }
 assert.ok(upperBodies.every(body=>JSON.stringify(body)===JSON.stringify(upperBodies[0])));
});

test('learned plant and dust words stop at half of stage one without relying on caller flags',()=>{
 const tasks=[{id:'plant',type:'plant',slot:0},{id:'dust',type:'dust',position:{x:.25,y:.6}},{id:'cat',type:'cat',door:1,waiting:2}].map(task=>({...task,total:20,remaining:16}));
 const game={level:1,stage:{goal:30},stageCompleted:14,tasks};
 const before=renderRecord(game);
 assert.ok(before.written.some(t=>t.text==='מים!'));assert.ok(before.written.some(t=>t.text==='אבק!'));
 const halfway=renderRecord({...game,stageCompleted:15});
 const staleCaller=renderRecord({...game,stageCompleted:15},{},{showTaskLabels:{plant:true,dust:true}});
 const laterStage=renderRecord({...game,level:2,stageCompleted:0});
 for(const result of [halfway,staleCaller,laterStage]){
  assert.ok(!result.written.some(t=>['מים!','מהר!','אבק!'].includes(t.text)),'learned words cannot return at halfway or in later stages');
  assert.ok(result.strokes.some(s=>s.color==='#00aee5'),'the plant glow remains');
  assert.ok(result.fills.includes('#00d5f1'),'the watering time bar remains');
  assert.ok(result.fills.includes('#9bdde8'),'the dust time bar remains');
  assert.equal(result.written.length,0,'the quiet scene contains no decorative canvas words');
 }
});


test('initial water and dust words are plain ink while the physical thirsty-plant halo remains intact',()=>{
 const tasks=[{id:'p',type:'plant',slot:0},{id:'d',type:'dust',position:{x:.25,y:.6}}].map(task=>({...task,total:20,remaining:16}));
 const initial=renderRecord({level:1,stage:{goal:30},stageCompleted:0,tasks},{time:2});
 assert.ok(initial.written.some(t=>t.text==='מים!'));assert.ok(initial.written.some(t=>t.text==='אבק!'));
 assert.ok(!initial.fills.includes('#00648c')&&!initial.fills.includes('#b9233d'),'word labels have no colored badge background');
 const quiet=renderRecord({level:1,stage:{goal:30},stageCompleted:15,tasks},{time:2});
 const initialHalo=initial.strokes.find(s=>s.color==='#00aee5'),quietHalo=quiet.strokes.find(s=>s.color==='#00aee5');
 assert.ok(initialHalo&&quietHalo,'the physical thirsty-plant halo is present in both modes');
 assert.deepEqual(initialHalo.arc,quietHalo.arc,'removing word decorations never changes the physical plant halo');
 assert.equal(initialHalo.width,quietHalo.width);assert.ok(quiet.fills.includes('#00a9d5'),'the water drop stays visible');
});

test('quiet mode removes every canvas word, bubble and missed badge while preserving live physical cues',()=>{
 const tasks=[{id:'p',type:'plant',slot:0},{id:'d',type:'dust',position:{x:.25,y:.6}},{id:'c',type:'cat',door:1,waiting:2},{id:'g',type:'guest',door:0,guest:'hila'}].map(task=>({...task,total:20,remaining:16}));
 const visual={actor:{x:.4,y:.5,action:'hand',tool:'hand',speechText:'לכו מפה, חתולים!',speechUntil:10},departures:[{type:'plant-missed',slot:2,age:.3,duration:1.8},{type:'guest',guest:'hila',door:0,age:.3,duration:1.5}]};
 for(const game of [{level:1,stage:{goal:30},stageCompleted:15,tasks,unlockedTools:['serve']},{level:3,tasks,unlockedTools:['serve']}]){
  const result=renderRecord(game,{time:2},visual);
  assert.equal(result.written.length,0,'no room labels, names, cat words, thanks or speech are drawn');
  assert.ok(!result.fills.includes('#a61f38'),'the missed-word badge is gone');
  for(const color of ['#00aee5','#ffffff','#274b51'])assert.ok(result.strokes.some(s=>s.color===color),'physical plant, dust and task cues remain');
  for(const color of ['#00a9d5','#00d5f1','#9bdde8','#ce8b3e'])assert.ok(result.fills.includes(color),'drops, time bars and food art remain');
 }
 const forced=renderRecord({level:1,stage:{goal:30},stageCompleted:0,tasks},{time:2},{...visual,quiet:true});
 assert.equal(forced.written.length,0,'an explicit quiet scene is honored before the automatic cutoff too');
});

test('the petunia pot rests on the kitchen stone with a reachable anchor in front, clear of the door',()=>{
 for(const [width,height] of sizes){
  const layout=getHouseLayout(width,height),plant=layout.plants[1],counter=layout.counter;
  assert.equal(plant.variety,'petunia');
  assert.ok(plant.x>counter.x&&plant.x<counter.x+counter.w);
  const potBottom=plant.y+Math.min(width,height)*(layout.portrait?.15:.12)*31/64/height;
  assert.ok(potBottom>counter.y&&potBottom<counter.y+counter.h*.43,'the pot base touches the stone surface');
  assert.ok(plant.anchor.y>=counter.y+counter.h,'Ruti stands on the floor in front of the counter');
  assert.ok(distance(plant,layout.doors[0])>.5,'the main doorway stays clear');
  checkWalk(layout,layout.spawn,plant.anchor);
 }
});

test('resident cats keep continuous paths around furniture and jump onto counter, sofa and table',async()=>{
 const {residentCatPose}=await import('../public/assets/ruti-house-scene.mjs');
 for(const [width,height] of sizes){
  const layout=getHouseLayout(width,height),cat={door:0,enteredAt:10,pathSeed:.4},surfaces=new Set();let previous;
  for(let t=10;t<=190;t+=.05){const p=residentCatPose(cat,layout,t);surfaces.add(p.surface);assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));assert.ok(p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1);
   if(!p.jumping&&p.surface==='floor')assert.ok(!layout.obstacles.some(o=>inside(p,o,.004)),'floor walking avoids furniture');
   if(previous)assert.ok(Math.hypot((p.x-previous.x)*width,(p.y-previous.y)*height)<Math.min(width,height)*.04,'no teleports between walking, jumping and resting');previous=p;
  }
  assert.deepEqual(surfaces,new Set(['floor','counter','sofa','table']));assert.deepEqual(residentCatPose(cat,layout,35),residentCatPose(cat,layout,35),'paused elapsed time preserves the cat pose');
 }
});

test('all eight guest identities use connected full-body atlas cells with consistent standing and walking scales',async()=>{
 const {drawHouseGuest}=await import('../public/assets/ruti-house-scene.mjs');const family={complete:true,naturalWidth:1536,naturalHeight:1024},strangers={...family},calls=[];
 const ctx=new Proxy({drawImage(...args){calls.push(args);}},{get:(target,key)=>key in target?target[key]:()=>{}});
 const ids=['roi','hila','rivi','lihi','visitor-man','visitor-hila','visitor-rivi','visitor-lihi'];
 for(const [index,id] of ids.entries())for(const walking of [false,true]){
  calls.length=0;assert.equal(drawHouseGuest(ctx,100,200,110,id,{familyAtlas:family,visitorAtlas:strangers},.3,{walking}),true);assert.equal(calls.length,1);
  const [image,sx,sy,sw,sh,,,dw,dh]=calls[0];assert.equal(image,index<4?family:strangers);assert.equal(sx,(index%4)*384+.5);assert.equal(sy,walking?512.5:.5);assert.equal(sw,383);assert.equal(sh,511);assert.ok(dw>85&&dw<95);assert.ok(dh>120&&dh<123);
 }
});
