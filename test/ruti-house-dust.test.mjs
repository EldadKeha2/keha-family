import {test} from 'node:test';
import assert from 'node:assert/strict';
import {drawDustSignal} from '../public/assets/ruti-house-dust.mjs';

function canvas(){
 const texts=[],numbers=[],strokes=[],shadows=[];
 const ctx=new Proxy({fillText(value){texts.push(String(value));},stroke(){strokes.push({color:this.strokeStyle,width:this.lineWidth});}}, {
  get(target,key){if(key in target)return target[key];return (...args)=>{numbers.push(...args.filter(v=>typeof v==='number'));};},
  set(target,key,value){target[key]=value;if(key==='shadowBlur')shadows.push(value);return true;}
 });
 return {ctx,texts,numbers,strokes,shadows};
}

test('dust keeps its white outline, dark border, label and deadline through every pulse',()=>{
 for(const size of [30,37,55])for(const time of [0,.28,.56,.83])for(const english of [false,true]){
  const c=canvas(),task={remaining:8.2,total:24};
  drawDustSignal(c.ctx,48,330,size,task,time,{english,width:320});
  assert.ok(c.texts.includes(english?'Dust!':'אבק!'));assert.ok(!c.texts.some(text=>/^[0-9]+$/.test(text)||text==='∞'));
  assert.ok(c.strokes.some(s=>s.color==='#ffffff'&&s.width===7));
  assert.ok(c.strokes.some(s=>s.color==='#274b51'&&s.width===3));
  assert.ok(c.numbers.length>0&&c.numbers.every(Number.isFinite));
  assert.deepEqual(task,{remaining:8.2,total:24},'rendering must not change game deadlines');
 }
});

test('reduced motion holds the complete dust signal steady while deadlines remain legible',()=>{
 const a=canvas(),b=canvas(),task={remaining:2,total:24};
 drawDustSignal(a.ctx,280,200,37,task,0,{reduced:true,width:320});
 drawDustSignal(b.ctx,280,200,37,task,12.6,{reduced:true,width:320});
 assert.deepEqual(a.numbers,b.numbers);assert.deepEqual(a.shadows,b.shadows);
 assert.ok(a.strokes.some(s=>s.color==='#8b234c'));
 assert.ok(!a.texts.includes('2'),'only the time bar shows the deadline');
});

test('untimed dust stays visible without numbers or a countdown bar',()=>{
 const c=canvas();drawDustSignal(c.ctx,160,200,37,{untimed:true,remaining:1,total:1},1,{width:320});
 assert.ok(!c.texts.includes('∞'));assert.ok(c.texts.includes('אבק!'));
 assert.ok(!c.strokes.some(s=>s.width===2&&s.color==='#ffffff'));
});


test('quiet dust keeps its silhouette and time bar after its word label is learned',()=>{
 const c=canvas();drawDustSignal(c.ctx,160,200,37,{remaining:5,total:24},1,{width:320,showLabel:false});
 assert.equal(c.texts.length,0);assert.ok(c.strokes.some(s=>s.width===7&&s.color==='#ffffff'));
 assert.ok(c.strokes.some(s=>s.width===2&&s.color==='#ffffff'),'the deadline bar remains visible');
});
