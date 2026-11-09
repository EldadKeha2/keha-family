import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import worker,{FamilyState,PUBLIC_WRITE_TOKEN} from '../src/worker.mjs';
import {quizAnswerPoints,quizScoreSummary} from '../public/assets/quiz-scoring.mjs';

const paths=['who-is-it','relationships','who-is-missing','trivia'];
function fixture(){
  const db=new DatabaseSync(':memory:');
  const storage={sql:{exec(query,...args){const stmt=db.prepare(query),rows=stmt.columns().length?stmt.all(...args):(stmt.run(...args),[]);return {toArray:()=>rows};}},transactionSync(fn){db.exec('BEGIN');try{const result=fn();db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}}};
  let state=new FamilyState({storage},{});const env={FAMILY_STATE:{idFromName:n=>n,get:()=>state}};
  for(let n=0;n<9;n++){const person={id:'quiz-person-'+n,name:'Quiz Person '+n,nameEn:'Quiz Person '+n,gender:'m',birthday:'1.1.1980'};db.prepare('INSERT INTO people(id,data) VALUES(?,?)').run(person.id,JSON.stringify(person));}
  for(let n=0;n<10;n++){const media={id:'quiz-photo-'+n,kind:'photo',mime:'image/jpeg'};db.prepare('INSERT INTO media(id,category,data) VALUES(?,?,?)').run(media.id,'gallery',JSON.stringify(media));for(let p=0;p<5;p++)db.prepare('INSERT INTO media_tags(media_id,person_id) VALUES(?,?)').run(media.id,'quiz-person-'+p);}
  const call=(path,body,headers={},method=body===undefined?'GET':'POST')=>worker.fetch(new Request('https://family.example/api/games/'+path,{method,headers:{Origin:'https://family.example','X-Family-Token':PUBLIC_WRITE_TOKEN,'Content-Type':'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body)}),env,{waitUntil(){}});
  const round=async(path,elapsedMs=1500,wrong=0)=>{const response=await call(path),data=await response.json();assert.equal(response.status,200);assert.equal(data.questions.length,10);assert.match(data.runId,/^[a-f0-9]{32}$/);const answers=data.questions.map((q,i)=>({id:q.id,selectedId:i<wrong?q.options.find(o=>o.id!==q.correctId).id:q.correctId,elapsedMs}));return {requestId:data.runId,name:'  משפחת   קהא  ',score:(10-wrong)*quizAnswerPoints(true,elapsedMs),answers};};
  return {db,call,round,restart(){state=new FamilyState({storage},env);},close(){db.close();}};
}

test('speed points decrease with elapsed time, never reward wrong or late answers, and retain base points',()=>{
  assert.equal(quizAnswerPoints(true,0),200);assert.equal(quizAnswerPoints(true,1500),190);assert.equal(quizAnswerPoints(true,7500),150);assert.equal(quizAnswerPoints(true,14999),100);assert.equal(quizAnswerPoints(true,15000),0);assert.equal(quizAnswerPoints(false,0),0);
  assert.deepEqual(quizScoreSummary([{correct:true,elapsedMs:1500},{correct:false,elapsedMs:15000}]),{score:190,correct:1,total:2,base:100,bonus:90,elapsedMs:16500});
});

test('all four quizzes persist independent shared leaderboards and recompute scores using the issued answer key',async()=>{
  const f=fixture();try{
    for(const path of paths){
      assert.deepEqual(await (await f.call(path+'/scores')).json(),{scores:[],limit:20});
      const slow=await f.round(path,7500),fast=await f.round(path,1500);
      assert.equal((await f.call(path+'/scores',slow)).status,200);const response=await f.call(path+'/scores',fast),result=await response.json();assert.equal(response.status,200);assert.equal(result.rank,1);assert.deepEqual(result.scores.map(r=>r.score),[1900,1500]);assert.equal(result.scores[0].correct,10);assert.equal(result.scores[0].total,10);assert.equal(result.scores[0].elapsedMs,15000);assert.equal(result.scores[0].name,'משפחת קהא');
      const duplicate=await f.call(path+'/scores',fast);assert.equal(duplicate.status,200);assert.equal((await duplicate.json()).rank,1);assert.equal((await f.call(path+'/scores',{...fast,name:'Other'})).status,409);
    }
    f.restart();for(const path of paths)assert.equal((await (await f.call(path+'/scores')).json()).scores.length,2);
    assert.equal(f.db.prepare('SELECT count(*) n FROM quiz_scores').get().n,8);
    for(const other of ['rex','jachnun','neto-tetris','ruti-house'])assert.equal((await (await f.call(other+'/scores')).json()).scores.length,0);
  }finally{f.close();}
});

test('a quiz score requires a complete genuine round, correct game, valid timings, names and matching arithmetic',async()=>{
  const f=fixture();try{
    const good=await f.round('trivia'),changes=[{requestId:'bad'},{requestId:'f'.repeat(32)},{name:''},{name:'x'.repeat(61)},{name:'Bad\u0001name'},{score:2001},{score:'1900'},{score:NaN},{answers:[]},{answers:good.answers.slice(1)}];
    for(const bad of changes)assert.equal((await f.call('trivia/scores',{...good,...bad})).status,400,JSON.stringify(bad));
    for(const bad of [{id:'unissued'},{selectedId:'unlisted'},{elapsedMs:-1},{elapsedMs:15001},{elapsedMs:.5},{elapsedMs:'1500'},{selectedId:null,elapsedMs:1},{elapsedMs:15000}])assert.equal((await f.call('trivia/scores',{...good,answers:good.answers.map((a,i)=>i? a:{...a,...bad})})).status,400,JSON.stringify(bad));
    assert.equal((await f.call('relationships/scores',good)).status,400);
    const forged={...good,score:0,answers:good.answers.map(a=>({...a,correct:false}))};assert.equal((await f.call('trivia/scores',forged)).status,400,'Client correctness flags cannot change the issued answer key');
    assert.equal(f.db.prepare('SELECT count(*) n FROM quiz_scores').get().n,0);
    const expired={...good,score:0,answers:good.answers.map(a=>({...a,selectedId:null,elapsedMs:15000}))};assert.equal((await f.call('trivia/scores',expired)).status,200);const row=(await (await f.call('trivia/scores')).json()).scores[0];assert.equal(row.score,0);assert.equal(row.correct,0);assert.equal(row.elapsedMs,150000);
  }finally{f.close();}
});

test('leaderboards return twenty scores, use response time to break ties and keep rank consistent with order',async()=>{
  const f=fixture();try{
    for(let i=0;i<22;i++){const body=await f.round('trivia',1000+i*150);body.name='Player '+i;assert.equal((await f.call('trivia/scores',body)).status,200);}
    const rows=(await (await f.call('trivia/scores')).json()).scores;assert.equal(rows.length,20);assert.equal(rows[0].name,'Player 0');assert.equal(rows[19].name,'Player 19');
    const body=await f.round('trivia',1050);body.name='Tie';const response=await (await f.call('trivia/scores',body)).json();assert.equal(response.rank,2);assert.equal(response.scores[1].id,body.requestId);assert.equal(response.scores[0].score,response.scores[1].score);assert.ok(response.scores[0].elapsedMs<response.scores[1].elapsedMs);
  }finally{f.close();}
});

test('abandoned runs expire after one day while saved results remain retryable, and short photo games remain practice',async()=>{
  const f=fixture();try{
    const abandoned=await f.round('trivia'),saved=await f.round('trivia');assert.equal((await f.call('trivia/scores',saved)).status,200);f.db.prepare('UPDATE quiz_runs SET created_at=?').run('2000-01-01T00:00:00.000Z');await f.round('trivia');assert.equal((await f.call('trivia/scores',abandoned)).status,400);assert.equal((await f.call('trivia/scores',saved)).status,200);
    f.db.prepare("DELETE FROM media WHERE id!='quiz-photo-0'").run();const practice=await (await f.call('who-is-missing')).json();assert.equal(practice.questions.length,1);assert.equal(practice.runId,null);
  }finally{f.close();}
});

test('quiz leaderboard writes enforce existing origin and token checks and bound request sizes',async()=>{
  const f=fixture();try{
    const body=await f.round('trivia');assert.equal((await f.call('trivia/scores',body,{Origin:'https://other.example'})).status,403);assert.equal((await f.call('trivia/scores',body,{'X-Family-Token':'wrong'})).status,403);assert.equal((await f.call('trivia/scores',body,{},'PUT')).status,405);assert.equal((await f.call('trivia/scores',undefined,{},'HEAD')).status,405);assert.equal((await f.call('trivia/scores',{...body,padding:'x'.repeat(9000)})).status,413);
  }finally{f.close();}
});
