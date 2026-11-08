import {test} from 'node:test';
import assert from 'node:assert/strict';
import {houseStageBonuses} from '../public/assets/ruti-house-bonuses.mjs';
import {createHouse,advanceHouse,advanceStage,selectTool,actHouse} from '../public/assets/ruti-house-engine.mjs';

function completeStage(g,{miss=null}={}){
 let missed=false,steps=0;
 while(g.phase==='playing'&&steps++<12000){
  if(!g.tasks.length){advanceHouse(g,.1);continue;}
  const task=g.tasks[0];
  if(!missed&&task.type===miss&&!task.untimed){task.remaining=.001;advanceHouse(g,.01);missed=true;continue;}
  selectTool(g,{plant:'water',dust:'broom',cat:'hand',guest:task.food||'serve'}[task.type]);actHouse(g,task.id);
 }
 assert.equal(g.phase,'stage-complete');return g.events.findLast(e=>e.type==='stage-clear');
}

test('category bonuses accumulate to 3500, require real tasks and exclude categories with a miss',()=>{
 const good={plants:24,dust:6,missedPlants:0,missedDust:0,completed:30};
 assert.deepEqual(houseStageBonuses(good),{plants:1000,dust:500,all:2000,total:3500});
 assert.equal(houseStageBonuses({...good,completed:29,missedDust:1}).total,1000);
 assert.equal(houseStageBonuses({...good,completed:29,missedPlants:1}).total,500);
 assert.equal(houseStageBonuses({...good,completed:28,missedPlants:1,missedDust:1}).total,0);
 assert.deepEqual(houseStageBonuses(null),{dust:0,plants:0,all:0,total:0});
 assert.equal(houseStageBonuses({...good,plants:0,dust:0,completed:0}).total,0);
});

test('each stage awards its completion bonuses exactly once and resets its category misses for the next stage',()=>{
 for(const [miss,expected]of [[null,3500],['dust',1000],['plant',500]]){
  const g=createHouse({random:()=>.5}),event=completeStage(g,{miss});
  assert.equal(event.bonus.total,expected);assert.equal(g.stageScores[0],g.score);
  const taskPoints=g.events.filter(e=>e.type==='success').reduce((sum,e)=>sum+e.points,0);
  assert.equal(g.score,taskPoints+expected);assert.equal(g.stageResults[0].completed,miss?29:30);
  const score=g.score,result={...g.stageResults[0]};advanceHouse(g,60);assert.equal(g.score,score);
  assert.equal(advanceStage(g),true);assert.deepEqual(g.stageMisses,{plant:0,dust:0});assert.deepEqual(g.stageResults[0],result);assert.equal(g.stageResults[1],null);
 }
});
