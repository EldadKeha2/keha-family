import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeMissingQuiz} from '../public/assets/quiz.mjs';

const people=Object.fromEntries(Array.from({length:12},(_,i)=>['p'+i,{id:'p'+i,name:'אדם '+i,nameEn:'Person '+i}]));
const photos=Array.from({length:15},(_,i)=>({id:'group-'+i,kind:'photo',tags:Array.from({length:5+i%3},(_,j)=>({id:'p'+j}))}));
test('missing-person rounds contain ten unique group photos and exactly one untagged answer',()=>{
  const before=JSON.stringify({photos,people}),rounds=[];
  for(let n=0;n<40;n++){
    const questions=makeMissingQuiz([...photos,photos[0]],people);assert.equal(questions.length,10);assert.equal(new Set(questions.map(q=>q.id)).size,10);
    for(const q of questions){
      const tags=new Set(photos.find(p=>p.id===q.id).tags.map(t=>t.id));assert.ok(tags.size>=5);assert.equal(q.kind,'missing');assert.equal(q.options.length,4);assert.equal(new Set(q.options.map(p=>p.id)).size,4);assert.equal(new Set(q.options.map(p=>p.name)).size,4);assert.equal(q.options.filter(p=>tags.has(p.id)).length,3);assert.ok(!tags.has(q.correctId));assert.ok(q.options.some(p=>p.id===q.correctId));assert.equal(q.src,'/media/'+q.id);assert.equal(q.tags,undefined);
    }
    rounds.push(questions.map(q=>q.id).join('|'));
  }
  assert.ok(new Set(rounds).size>1);assert.equal(JSON.stringify({photos,people}),before);
});
test('fewer than five distinct tags, videos, unknown names, and a roster with no absent person are skipped',()=>{
  const tags=['p0','p1','p2','p3'];assert.deepEqual(makeMissingQuiz([{id:'small',kind:'photo',tags:[...tags,'p0']},{id:'video',kind:'video',tags:photos[0].tags}],people),[]);
  assert.deepEqual(makeMissingQuiz([{id:'unknown',kind:'photo',tags:['p0','p1','unknown-a','unknown-b','unknown-c']}],people),[]);
  assert.deepEqual(makeMissingQuiz([photos[0]],Object.fromEntries(Object.entries(people).slice(0,5))),[]);
});
test('Yona is never an answer option and names matching anyone tagged cannot become the absent answer',()=>{
  const roster={...people,yona:{id:'yona',name:'יונה נקאש',nameEn:'Yona Nakash'},duplicate:{id:'duplicate',name:'אדם 0',nameEn:'Person 0'}};
  const photo={id:'group',kind:'photo',tags:['p0','p1','p2','p3','yona']};
  for(let n=0;n<40;n++){const [q]=makeMissingQuiz([photo],roster);assert.ok(q);assert.ok(!q.options.some(p=>p.id==='yona'));assert.notEqual(q.correctId,'duplicate');}
});
