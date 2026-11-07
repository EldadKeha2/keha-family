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
