import {test} from 'node:test';
import assert from 'node:assert/strict';
import family from '../src/family.mjs';
import {triviaPool,makeTriviaQuiz} from '../public/assets/trivia.mjs';

const now=new Date('2026-11-04T12:00:00Z');
const example={people:Object.fromEntries(Array.from({length:7},(_,i)=>['p'+i,{id:'p'+i,name:'אדם '+i,nameEn:'Person '+i,gender:i%2?'f':'m',birthday:`${i+1}.${i+1}.${1960+i}`,aliyahYear:i===0?1980:undefined}])),units:{parents:{children:['u2','u0','u1','u3']},u0:{people:['p0']},u1:{people:['p1']},u2:{people:['p2']},u3:{people:['p3']}}};
test('trivia derives birth years, months, birth order and immigration years from known data',()=>{
  const {pool}=triviaPool(example,{},now),lookup=(id,topic)=>pool.find(q=>q.personId===id&&q.topic===topic);
  assert.equal(lookup('p0','birth-year').value,1960);assert.equal(lookup('p1','birth-month').value,2);assert.equal(lookup('p0','aliyah-year').value,1980);
  for(let i=0;i<4;i++)assert.equal(lookup('p'+i,'birth-order').value,i+1,'Use dates, not the order of tree units');
  const canonical=triviaPool(family,{},now).pool;assert.equal(canonical.find(q=>q.personId==='yona'&&q.topic==='aliyah-year').value,1934);assert.equal(canonical.find(q=>q.personId==='shlomo'&&q.topic==='aliyah-year').value,1932);
});
test('unknown, invalid and future dates are excluded; missing siblings or twins never acquire guessed birth order',()=>{
  let {pool}=triviaPool(example,{p0:{birthday:'1.1.1111'},p4:{birthday:'31.2.2000'},p5:{birthday:'1.1.2030'},p6:{aliyahYear:1900}},now);
  assert.ok(!pool.some(q=>q.topic==='birth-order'));assert.ok(!pool.some(q=>['p0','p4','p5'].includes(q.personId)&&q.topic.startsWith('birth-')));assert.ok(!pool.some(q=>q.personId==='p6'&&q.topic==='aliyah-year'));
  ({pool}=triviaPool(example,{p1:{birthday:example.people.p2.birthday}},now));assert.ok(!pool.some(q=>['p1','p2'].includes(q.personId)&&q.topic==='birth-order'));assert.equal(pool.find(q=>q.personId==='p3'&&q.topic==='birth-order').value,4);
});
test('saved profile edits replace seeded facts and profiles without revealing biography content or mutating inputs',()=>{
  const records={p0:{birthday:'10.9.1969',aliyahYear:1990,profile:'/media/p0',about:'PRIVATE BIOGRAPHY'}};const before=JSON.stringify({example,records});
  const bank=triviaPool(example,records,now).pool;assert.equal(bank.find(q=>q.personId==='p0'&&q.topic==='birth-year').value,1969);assert.equal(bank.find(q=>q.personId==='p0'&&q.topic==='birth-month').value,9);assert.equal(bank.find(q=>q.personId==='p0'&&q.topic==='birth-order').value,4);
  const game=makeTriviaQuiz(example,records,100,Math.random,now);for(const q of game.filter(q=>q.subject.id==='p0'))assert.equal(q.subject.profile,'/media/p0');assert.ok(!JSON.stringify(game).includes('PRIVATE BIOGRAPHY'));assert.equal(JSON.stringify({example,records}),before);
});
test('ten random questions cover available topics with four unique choices and exactly one correct answer',()=>{
  const rounds=[];for(let n=0;n<40;n++){
    const questions=makeTriviaQuiz(example,{},10,Math.random,now);assert.equal(questions.length,10);assert.equal(new Set(questions.map(q=>q.id)).size,10);assert.equal(new Set(questions.map(q=>q.topic)).size,4);
    for(const q of questions){assert.equal(q.options.length,4);assert.equal(new Set(q.options.map(o=>o.id)).size,4);assert.equal(new Set(q.options.map(o=>o.name)).size,4);assert.equal(new Set(q.options.map(o=>o.nameEn)).size,4);assert.equal(q.options.filter(o=>o.id===q.correctId).length,1);assert.ok(q.prompt&&q.promptEn);if(q.topic.endsWith('year'))for(const o of q.options)assert.ok(Number(o.name)<=2026);}
    rounds.push(questions.map(q=>q.id).join('|'));
  }
  assert.ok(new Set(rounds).size>1);
});
