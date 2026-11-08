import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHouse,advanceHouse,advanceStage,selectTool,actHouse,STAGES,HOUSE_FAMILY_GUESTS,HOUSE_VISITORS} from '../public/assets/ruti-house-engine.mjs';
import {HOUSE_STAGE_GOALS,houseTasksThroughLevel} from '../public/assets/ruti-house-levels.mjs';
import {houseStageBonuses} from '../public/assets/ruti-house-bonuses.mjs';
import {rutiHouseScore} from '../src/ruti-house-scores.mjs';
import {yemeniteCircleStep,yemeniteCircleDancers} from '../public/assets/ruti-house-dance.mjs';
import {GUEST_ARM_RIGS,guestArmPose} from '../public/assets/ruti-house-guest-rig.mjs';
import {HOUSE_FINALE_DANCERS,drawHouseFinale,drawHouseGuest} from '../public/assets/ruti-house-scene.mjs';
import {rutiPose} from '../public/assets/ruti-house-character.mjs';

test('levels thirteen through twenty raise deadlines and task pressure without adding a mechanic',()=>{
 assert.deepEqual(STAGES.map(s=>s.goal),[...Array(12).fill(30),40,40,50,50,50,60,60,60]);
 assert.deepEqual(STAGES.map(s=>s.goal),HOUSE_STAGE_GOALS);assert.equal(houseTasksThroughLevel(20),770);
 for(let index=12;index<20;index++){
  const previous=STAGES[index-1],plan=STAGES[index];
  assert.deepEqual(plan.types,STAGES[11].types);assert.deepEqual(plan.unlockedTools,STAGES[11].unlockedTools);
  assert.equal(plan.newFeature,null);assert.equal(plan.guestMode,'mixed');
  assert.ok(plan.spawnDelay<previous.spawnDelay);assert.ok(plan.catWait<previous.catWait);
  for(const kind of ['plant','dust','cat','guest'])assert.ok(plan.deadlines[kind]<previous.deadlines[kind]);
 }
 for(const goal of [30,40,50,60]){
  const summary={plants:goal-6,dust:6,missedPlants:0,missedDust:0,completed:goal};
  assert.equal(houseStageBonuses(summary,goal).total,3500);
  assert.equal(houseStageBonuses({...summary,completed:goal-1},goal).all,0);
 }
});

function completeRun({missOnePerStage=false}={}){
 const g=createHouse({random:()=>.5});let guard=0,missedLevel=0;
 while(g.phase!=='finished'&&guard++<100000){
  if(g.phase==='stage-complete'){advanceStage(g);continue;}
  if(g.phase==='ora-bonus'){advanceHouse(g,5);continue;}
  if(g.ora){selectTool(g,'argue');actHouse(g,g.ora.id);continue;}
  if(!g.tasks.length){advanceHouse(g,.1);continue;}
  const task=g.tasks[0];
  if(missOnePerStage&&missedLevel!==g.level&&task.type==='dust'){
   missedLevel=g.level;task.remaining=.001;advanceHouse(g,.01);continue;
  }
  selectTool(g,task.type==='guest'?task.food:{plant:'water',dust:'broom',cat:'hand'}[task.type]);actHouse(g,task.id);
 }
 assert.ok(guard<100000);assert.equal(g.won,true);return g;
}
function scorePayload(g){return {requestId:'7'.repeat(32),name:'אלופת הבית',version:7,score:g.score,level:g.level,
 completedLevels:g.completedLevels,stageScores:g.stageScores,stageResults:g.stageResults,elapsed:Math.floor(g.elapsed),bestCombo:g.bestCombo,
 ...g.stats};}

test('full twenty-stage runs validate after 770 tasks, including misses, renewed guests and per-stage bonuses',()=>{
 for(const missOnePerStage of [false,true]){
  const g=completeRun({missOnePerStage}),payload=scorePayload(g),row=rutiHouseScore(payload);
  assert.equal(row.level,20);assert.equal(row.completedLevels,20);assert.equal(row.stageScores.length,20);
  assert.deepEqual(row.stageResults,g.stageResults);assert.equal(g.stageResolved,60);assert.equal(g.stageIssued,60);
  assert.equal(g.stats.missed,missOnePerStage?20:0);
  assert.equal(g.stageResults.reduce((n,s)=>n+s.completed,0)+g.stats.missed,770);
  assert.ok(g.familyVisits.length>4);assert.equal(new Set(g.familyVisits).size,g.familyVisits.length);
  for(const changes of [{level:21},{completedLevels:19},{version:6},{missed:g.stats.missed+1},{stageResults:g.stageResults.slice(0,12)}])
   assert.throws(()=>rutiHouseScore({...payload,...changes}),{status:400});
  const bad=g.stageResults.map(s=>({...s}));bad[12].completed=41;
  assert.throws(()=>rutiHouseScore({...payload,stageResults:bad}),{status:400});
 }
});

test('all twenty-one dancers fit both displays, share the Yemenite held beat and continue around the circle',()=>{
 assert.equal(HOUSE_FINALE_DANCERS.length,21);
 assert.deepEqual(new Set(HOUSE_FINALE_DANCERS),new Set(['ruti',...HOUSE_FAMILY_GUESTS,...HOUSE_VISITORS]));
 assert.equal(yemeniteCircleStep(1.24).turn,yemeniteCircleStep(1.56).turn);
 assert.equal(yemeniteCircleStep(1.24).pulse,0);
 assert.ok(yemeniteCircleStep(3.2).turn>yemeniteCircleStep(0).turn);
 for(const [width,height] of [[1130,530],[390,570],[320,500]])for(const elapsed of [0,.3,.7,1,1.4,20,200]){
  const poses=yemeniteCircleDancers(HOUSE_FINALE_DANCERS,{width,height,elapsed});
  assert.equal(poses.length,21);assert.equal(new Set(poses.map(p=>p.id)).size,21);
  for(const p of poses){assert.ok(p.x>0&&p.x<width);assert.ok(p.y-p.height>height*.3);assert.ok(p.y<height*.9);}
  const frozen=yemeniteCircleDancers(HOUSE_FINALE_DANCERS,{width,height,elapsed,reduced:true});
  assert.deepEqual(frozen,yemeniteCircleDancers(HOUSE_FINALE_DANCERS,{width,height,elapsed:0,reduced:true}));
 }
 const pose=rutiPose({celebrating:true,circleDance:true},1);assert.equal(pose.frame,0);assert.equal(pose.circleDance,true);
});

test('every guest reuses two pieces from its original arm, keeps its elbow joined and reaches its own mouth',()=>{
 const atlas={complete:true,naturalWidth:1536,naturalHeight:1024},calls=[],clips=[];
 const ctx=new Proxy({drawImage(...args){calls.push(args);},clip(rule){clips.push(rule);}},{get:(target,key)=>key in target?target[key]:()=>{}});
 const images={familyAtlas:atlas,visitorAtlas:atlas,familyExtraAtlases:{a:atlas,b:atlas,c:atlas}};
 for(const id of [...HOUSE_FAMILY_GUESTS,...HOUSE_VISITORS]){
  const rig=GUEST_ARM_RIGS[id];assert.ok(rig,id);const pose=guestArmPose(rig,rig.mouth);
  assert.ok(Math.hypot(pose.hand[0]-rig.mouth[0],pose.hand[1]-rig.mouth[1])<.1,id+' reaches its own mouth');
  assert.ok(pose.elbow[1]>pose.shoulder[1],'the eating elbow stays below the shoulder');
  assert.ok(Math.abs(pose.upperAngle)<Math.PI/4,'the sleeve never flips up beside the face');
  calls.length=0;clips.length=0;
  assert.equal(drawHouseGuest(ctx,100,200,140,id,images,10,{sitting:1,food:'tahini',eating:{active:true,bite:1,remaining:1}}),true);
  assert.equal(calls.length,4);assert.ok(calls.every(c=>c[0]===atlas));
  assert.equal(clips.filter(c=>c==='evenodd').length,2,'both body slices exclude the original stationary arm');
 }
});

test('eating stays connected through every intermediate pose without folding or stretching the sleeve sideways',()=>{
 const atlas={complete:true,naturalWidth:1536,naturalHeight:1024},images={familyAtlas:atlas,visitorAtlas:atlas,familyExtraAtlases:{a:atlas,b:atlas,c:atlas}};
 const point=(m,p)=>[m[0]*p[0]+m[2]*p[1]+m[4],m[1]*p[0]+m[3]*p[1]+m[5]];
 const near=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1])<.001;
 function recorder(){
  let m=[1,0,0,1,0,0];const stack=[],draws=[];
  const multiply=n=>{const [a,b,c,d,e,f]=m,[g,h,i,j,k,l]=n;m=[a*g+c*h,b*g+d*h,a*i+c*j,b*i+d*j,a*k+c*l+e,b*k+d*l+f];};
  const ctx=new Proxy({save(){stack.push([...m]);},restore(){m=stack.pop();},translate(x,y){multiply([1,0,0,1,x,y]);},scale(x,y){multiply([x,0,0,y,0,0]);},rotate(a){multiply([Math.cos(a),Math.sin(a),-Math.sin(a),Math.cos(a),0,0]);},drawImage(){draws.push([...m]);}},
   {get:(target,key)=>key in target?target[key]:()=>{}});
  return {ctx,draws};
 }
 for(const id of [...HOUSE_FAMILY_GUESTS,...HOUSE_VISITORS])for(const facing of [-1,1])for(const food of ['tahini','peanuts']){
  let previousHand=null;const rig=GUEST_ARM_RIGS[id];
  for(let index=0;index<=100;index++){
   const lift=index/100,{ctx,draws}=recorder();
   drawHouseGuest(ctx,100,220,140,id,images,10,{sitting:1,facing,food,eating:{active:true,bite:lift,remaining:1}});
   assert.equal(draws.length,4);const upper=draws[2],forearm=draws[3];
   assert.ok(near(point(upper,rig.elbow),point(forearm,rig.elbow)),id+' has a joined elbow throughout the bite');
   // The transform must retain the original sleeve width. Only its projected
   // length changes as the elbow moves forward, never a sideways shear.
   const axis=[rig.elbow[0]-rig.shoulder[0],rig.elbow[1]-rig.shoulder[1]],length=Math.hypot(...axis),normal=[-axis[1]/length,axis[0]/length];
   const width=Math.hypot(upper[0]*normal[0]+upper[2]*normal[1],upper[1]*normal[0]+upper[3]*normal[1]);
   assert.ok(width>.25&&width<.35,id+' keeps its original sleeve width');
   const shoulder=point(upper,rig.shoulder),elbow=point(upper,rig.elbow);
   assert.ok(elbow[1]>shoulder[1],id+' does not raise the elbow above its shoulder');
   const hand=point(forearm,rig.grip);
   if(previousHand)assert.ok(Math.hypot(hand[0]-previousHand[0],hand[1]-previousHand[1])<1.6,id+' moves continuously');previousHand=hand;
  }
 }
});

test('the finale uses the tool-free original Ruti cell and all guest atlases',()=>{
 const atlas={complete:true,naturalWidth:1536,naturalHeight:1024},ruti={...atlas,naturalWidth:1448,naturalHeight:1086},calls=[];
 const gradient={addColorStop(){}};
 const ctx=new Proxy({drawImage(...args){calls.push(args);},createRadialGradient(){return gradient;}},{get:(target,key)=>key in target?target[key]:()=>{}});
 drawHouseFinale(ctx,{width:1000,height:580,time:20,images:{rutiAtlas:ruti,familyAtlas:atlas,visitorAtlas:atlas,familyExtraAtlases:{a:atlas,b:atlas,c:atlas}},actor:{celebrationStartedAt:0}});
 const rutiCalls=calls.filter(c=>c[0]===ruti);assert.ok(rutiCalls.length>0);
 assert.ok(rutiCalls.every(c=>c[1]<362&&c[2]<362),'only neutral Ruti cell zero is sampled, never the broom cell');
 assert.equal(calls.filter(c=>c[0]===atlas).length,60,'all twenty guests have a body and two original moving feet');
});
