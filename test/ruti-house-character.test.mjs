import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RUTI_ATLAS,rutiPose,createRutiPerformance} from '../public/assets/ruti-house-character.mjs';

function fixture({english=false,voices=[{name:'Carmit',lang:'he-IL'},{name:'Samantha',lang:'en-US'}],available=true}={}){
 let time=0,actor={},cancels=0;
 const utterances=[];
 class Utterance{constructor(text){this.text=text;}}
 const synthesis={getVoices:()=>voices,speak(value){utterances.push(value);},cancel(){cancels++;}};
 const performance=createRutiPerformance({getActor:()=>actor,clock:()=>time,english:()=>english,synthesis:available?synthesis:null,Utterance:available?Utterance:null});
 return {performance,utterances,get actor(){return actor;},get cancels(){return cancels;},
  at(value){time=value;},replaceActor(){actor={};return actor;}};
}

test('every task has its own complete-body pose, with actions taking precedence over walking and speech',()=>{
 assert.equal(RUTI_ATLAS.columns*RUTI_ATLAS.rows,12);
 const seen=new Set();
 for(const [action,expected] of [['water',3],['broom',4],['hand',5],['serve',6]]){
  const pose=rutiPose({action,walking:true,speaking:true,speechUntil:10},1);
  assert.equal(pose.frame,expected);seen.add(pose.frame);
 }
 assert.equal(seen.size,4);
 assert.equal(rutiPose({action:'peanuts'},1).frame,6,'a snack uses the serving pose');
});

test('walking alternates steps while speech opens and closes the mouth only during a live utterance',()=>{
 const steps=[0,.2,.4,.6].map(walkTime=>rutiPose({walking:true,walkTime},1));
 assert.deepEqual(new Set(steps.map(p=>p.frame)),new Set([1,2]));
 assert.ok(steps.every(p=>p.lift>=0&&Number.isFinite(p.lean)&&Number.isFinite(p.breath)));
 const mouth=[0,.125,.25,.375].map(time=>rutiPose({speaking:true,speechUntil:2},time).frame);
 assert.deepEqual(new Set(mouth),new Set([0,7,8]));
 assert.equal(rutiPose({speaking:false,speechUntil:2},.25).frame,0);
 assert.equal(rutiPose({speaking:true,speechUntil:2},3).talking,false);
 assert.equal(rutiPose({speaking:true,speechUntil:2},3).frame,0);
});

test('reduced motion keeps task and emotion cues while stopping steps, mouth cycling, blinking and body motion',()=>{
 for(const actor of [{walking:true,walkTime:.2},{speaking:true,speechUntil:20},{},
  {action:'broom'},{expression:'concern',expressionUntil:20},{expression:'cheer',expressionUntil:20}]){
  const first=rutiPose(actor,1,{reduced:true}),later=rutiPose(actor,4.6,{reduced:true});
  assert.equal(first.frame,later.frame);assert.equal(first.lift,0);assert.equal(first.lean,0);assert.equal(first.breath,1);
 }
 assert.equal(rutiPose({action:'broom'},1,{reduced:true}).frame,4);
 assert.equal(rutiPose({expression:'concern',expressionUntil:20},1,{reduced:true}).frame,10);
 assert.equal(rutiPose({expression:'cheer',expressionUntil:20},1,{reduced:true}).frame,9);
});

test('captions and expressions work without a speech engine and expire on game time',()=>{
 const f=fixture({available:false});f.performance.unlock();
 assert.equal(f.performance.react('water'),true);assert.match(f.actor.speechText,/[\u0590-\u05ff]/);
 assert.equal(f.actor.expression,'smile');assert.ok(f.actor.expressionUntil>0);assert.notEqual(f.actor.speaking,true);
 f.at(f.actor.speechUntil+.01);f.performance.update();
 assert.equal(f.actor.speechText,'');assert.equal(f.actor.speaking,false);
 f.performance.react('concern',{force:true});assert.equal(f.actor.expression,'concern');
});

test('only matching-language voices speak; unavailable Hebrew keeps its visible caption instead of using English',()=>{
 const missing=fixture({voices:[{name:'Samantha',lang:'en-US'}]});missing.performance.unlock();missing.performance.react('welcome');
 assert.equal(missing.utterances.length,0);assert.match(missing.actor.speechText,/[\u0590-\u05ff]/);
 for(const english of [false,true]){
  const f=fixture({english});f.performance.unlock();f.performance.react('welcome');
  assert.equal(f.utterances.length,1);const spoken=f.utterances[0];
  assert.match(spoken.lang,english?/^en-/:/^he-/);assert.equal(spoken.text,f.actor.speechText);
  if(english)assert.doesNotMatch(spoken.text,/[\u0590-\u05ff]/);else assert.match(spoken.text,/[\u0590-\u05ff]/);
 }
});

test('speech begins only after a player gesture and the mouth follows start, boundary and end callbacks',()=>{
 const f=fixture();f.performance.react('water');assert.equal(f.utterances.length,0);
 f.performance.unlock();f.at(6);f.performance.react('water');const spoken=f.utterances[0];
 assert.notEqual(f.actor.speaking,true,'submitting a sentence does not pretend that audio has started');
 spoken.onstart();assert.equal(f.actor.speaking,true);assert.equal(f.actor.talkBeat,0);
 spoken.onboundary();assert.equal(f.actor.talkBeat,1);
 spoken.onend();assert.equal(f.actor.speaking,false);assert.ok(f.actor.speechText,'a completed sentence can keep its caption briefly');
 f.at(12);f.performance.react('broom');const erroring=f.utterances[1];erroring.onstart();erroring.onerror();assert.equal(f.actor.speaking,false);
});

test('ordinary reactions cannot queue overlapping speech and forced reactions cancel the owned sentence',()=>{
 const f=fixture();f.performance.unlock();f.performance.react('water');const old=f.utterances[0];old.onstart();
 f.at(1);assert.equal(f.performance.react('broom'),false);assert.equal(f.utterances.length,1);
 f.at(6);assert.equal(f.performance.react('water'),false,'a long-running sentence is not queued behind');
 assert.equal(f.performance.react('cheer',{force:true}),true);assert.equal(f.cancels,1);assert.equal(f.utterances.length,2);
 const next=f.utterances[1];next.onstart();assert.equal(f.actor.speaking,true);
 old.onend();assert.equal(f.actor.speaking,true,'a cancelled sentence cannot close a newer sentence’s mouth');
 old.onboundary();assert.equal(f.actor.talkBeat,0);next.onend();assert.equal(f.actor.speaking,false);
});

test('pause, mute and reset cancel speech and late callbacks cannot reactivate a stopped or replaced actor',()=>{
 for(const operation of ['stop','mute','reset']){
  const f=fixture();f.performance.unlock();f.performance.react('welcome');const old=f.utterances[0];old.onstart();
  if(operation==='mute')f.performance.setEnabled(false);else f.performance[operation]();
  assert.equal(f.actor.speaking,false);assert.equal(f.cancels,1);
  old.onstart();old.onboundary();assert.equal(f.actor.speaking,false);
  if(operation==='mute'){
   assert.ok(f.actor.speechText,'muting preserves visual dialogue');
   f.at(6);f.performance.react('water');assert.equal(f.utterances.length,1,'muting also prevents future sentences');
   f.performance.setEnabled(true);f.at(12);f.performance.react('water');assert.equal(f.utterances.length,2);
  }else assert.equal(f.actor.speechText,'');
 }
 const f=fixture();f.performance.unlock();f.performance.react('welcome');const old=f.utterances[0];
 const replacement=f.replaceActor();f.performance.reset();old.onstart();old.onend();assert.notEqual(replacement.speaking,true);
});

test('the watchdog cancels engines that never start or never finish without leaving a speaking face',()=>{
 const waiting=fixture();waiting.performance.unlock();waiting.performance.react('welcome');const late=waiting.utterances[0];
 waiting.at(2.1);waiting.performance.update();assert.equal(waiting.cancels,1);assert.equal(waiting.actor.speaking,false);
 late.onstart();assert.equal(waiting.actor.speaking,false);
 const hanging=fixture();hanging.performance.unlock();hanging.performance.react('welcome');hanging.utterances[0].onstart();
 hanging.at(hanging.actor.speechUntil+.1);hanging.performance.update();assert.equal(hanging.cancels,1);assert.equal(hanging.actor.speaking,false);assert.equal(hanging.actor.speechText,'');
});

test('celebration keeps the broom in hand and dances on game time while reduced motion holds a still pose',()=>{
 const actor={celebrating:true,action:'water',speaking:true,speechUntil:20};
 const poses=[0,.1,.2,.3].map(time=>rutiPose(actor,time));
 assert.ok(poses.every(pose=>pose.frame===4),'the celebration must visibly hold the real broom');
 assert.ok(new Set(poses.map(pose=>pose.lean)).size>1);
 assert.ok(poses.some(pose=>pose.lift>0));
 assert.deepEqual(rutiPose(actor,.2),rutiPose(actor,.2),'a paused game time freezes every movement');
 for(const time of [.1,1,4]){
  const pose=rutiPose(actor,time,{reduced:true});
  assert.equal(pose.frame,4);assert.equal(pose.lift,0);assert.equal(pose.lean,0);assert.equal(pose.headTilt,0);assert.equal(pose.headLift,0);
 }
});

test('spoken word boundaries refresh a brief connected head accent and speech end stops articulation',()=>{
 const f=fixture();f.performance.unlock();f.performance.react('water');
 f.at(.5);const spoken=f.utterances[0];spoken.onstart();
 f.at(.8);spoken.onboundary();
 assert.equal(f.actor.speechStartedAt,.5);assert.equal(f.actor.speechBoundaryAt,.8);
 const emphasized=rutiPose(f.actor,.8),later=rutiPose(f.actor,1.2);
 assert.ok(emphasized.headLift>later.headLift);assert.ok(Number.isFinite(emphasized.headTilt));
 spoken.onend();assert.equal(rutiPose(f.actor,1.2).talking,false);
});

test('repeated-action captions can disappear without suppressing the voice or expression',()=>{
 const f=fixture();f.performance.unlock();f.performance.react('water');f.utterances[0].onstart();
 f.at(.5);assert.equal(f.performance.react('water',{caption:false}),false);
 assert.equal(f.actor.speechText,'','a throttled reaction must still remove the previous bubble');
 assert.equal(f.actor.speaking,true);assert.equal(f.actor.expression,'smile');
 f.utterances[0].onend();f.at(6);
 assert.equal(f.performance.react('broom',{caption:false}),true);
 assert.equal(f.actor.speechText,'');assert.match(f.utterances[1].text,/[\u0590-\u05ff]/);
 f.utterances[1].onstart();assert.equal(f.actor.speaking,true);
});

test('celebration sings through changing head poses while the real broom body remains fixed',()=>{
 const actor={celebrating:true,celebrationStartedAt:10};
 const poses=[10.01,10.09,10.2,10.27].map(time=>rutiPose(actor,time));
 assert.ok(poses.every(pose=>pose.frame===4));
 assert.deepEqual(new Set(poses.map(pose=>pose.headFrame)),new Set([0,7,8]));
 assert.equal(rutiPose(actor,12.3).singing,false,'the phrase has a visible breathing rest');
 assert.equal(rutiPose(actor,14.49).singing,true,'a fresh phrase continues after the rest');
 assert.equal(rutiPose(actor,10.2,{reduced:true}).headFrame,0);
 const paused=rutiPose(actor,10.2);assert.deepEqual(rutiPose(actor,10.2),paused);
});

test('the Yemenite celebration takes three weight transfers then holds, and the next measure mirrors the leading foot',()=>{
 const actor={celebrating:true,celebrationStartedAt:0,celebrationBeatSeconds:.4};
 const right=[.28,.68,1.08].map(time=>rutiPose(actor,time));
 assert.deepEqual(right.map(pose=>pose.danceStep),[0,1,2]);
 assert.ok(right[0].danceX>0&&right[1].danceX<0&&right[2].danceX>0);
 assert.ok(right[0].footRightLift>0&&right[1].footLeftLift>0&&right[2].footRightLift>0);
 for(const time of [1.25,1.45,1.59]){
  const hold=rutiPose(actor,time);assert.equal(hold.danceStep,3);assert.ok(Math.abs(hold.danceX-right[2].danceX)<1e-12);
  assert.equal(hold.footRightLift,0);assert.equal(hold.footLeftLift,0);assert.equal(hold.lift,0);
 }
 const left=rutiPose(actor,1.88);assert.equal(left.danceSide,-1);assert.ok(left.footLeftLift>0);
 assert.ok(Math.abs(left.danceX+right[0].danceX)<1e-12);
 assert.ok(Math.abs(left.footLeftX+right[0].footRightX)<1e-12);
 for(const field of ['danceX','danceDepth','footLeftX','footRightX','footLeftLift','footRightLift'])assert.equal(rutiPose(actor,.28,{reduced:true})[field],0);
});
