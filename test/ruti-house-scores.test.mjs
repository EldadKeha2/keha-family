import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import worker,{FamilyState,PUBLIC_WRITE_TOKEN} from '../src/worker.mjs';
import {rutiHouseScore,RUTI_HOUSE_SCORE_FIELDS} from '../src/ruti-house-scores.mjs';

function fixture(){
  const db=new DatabaseSync(':memory:');
  const storage={sql:{exec(query,...args){const stmt=db.prepare(query),rows=stmt.columns().length?stmt.all(...args):(stmt.run(...args),[]);return {toArray:()=>rows};}},transactionSync(fn){db.exec('BEGIN');try{const result=fn();db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}}};
  let state=new FamilyState({storage},{});const env={FAMILY_STATE:{idFromName:n=>n,get:()=>state}};
  const call=(body,headers={},path='ruti-house',method=body===undefined?'GET':'POST')=>worker.fetch(new Request('https://family.example/api/games/'+path+'/scores',{method,headers:{Origin:'https://family.example','X-Family-Token':PUBLIC_WRITE_TOKEN,'Content-Type':'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body)}),env,{waitUntil(){}});
  return {db,call,restart(){state=new FamilyState({storage},env);},close(){db.close();}};
}
const entry=(n,meals=n)=>({requestId:n.toString(16).padStart(32,'0'),name:'Player '+n,score:meals*300,level:2,meals,snacks:0,plants:0,dust:0,cats:0,dishes:0,bestCombo:meals,elapsed:40});

test('Ruti’s House ranks shared results and preserves every counter after restarting',async()=>{
  const f=fixture();try{
    assert.deepEqual(await (await f.call()).json(),{scores:[],limit:20});
    for(const n of [1,3,2])assert.equal((await f.call(entry(n))).status,200);
    const special={...entry(4),score:640,meals:1,snacks:1,plants:1,dust:1,cats:1,dishes:1,bestCombo:4};
    assert.equal((await f.call(special)).status,200);
    f.restart();const result=await (await f.call()).json();assert.deepEqual(result.scores.map(row=>row.score),[900,640,600,300]);
    const saved=result.scores.find(row=>row.id===special.requestId);for(const key of RUTI_HOUSE_SCORE_FIELDS)assert.equal(saved[key],special[key],key);assert.ok(saved.createdAt);
    for(const other of ['neto-tetris','rex','jachnun'])assert.deepEqual((await (await f.call(undefined,{},other)).json()).scores,[]);
  }finally{f.close();}
});

test('Ruti’s House retries safely, rejects changed submissions, and returns the top twenty',async()=>{
  const f=fixture();try{
    for(let n=1;n<=22;n++)assert.equal((await f.call(entry(n))).status,200);
    const body=entry(22),again=await (await f.call(body)).json();assert.equal(again.rank,1);assert.equal(again.scores.length,20);
    assert.equal(f.db.prepare('SELECT count(*) n FROM ruti_house_scores').get().n,22);
    const tie=await (await f.call(entry(23,22))).json();assert.equal(tie.rank,2);assert.equal(tie.scores[0].id,body.requestId);
    for(const change of [{name:'Other'},{score:6700},{elapsed:41},{bestCombo:21},{snacks:1,score:6800}])assert.equal((await f.call({...body,...change})).status,409,JSON.stringify(change));
    const zero={...entry(24,0),score:0,bestCombo:0,elapsed:0,level:1};assert.equal((await f.call(zero)).status,200);assert.equal((await (await f.call(zero)).json()).rank,24);
  }finally{f.close();}
});

test('Ruti’s House rejects invalid counters, unsafe numbers, mismatched score totals and malformed names',async()=>{
  const f=fixture();try{
    const good=entry(1);
    for(const field of RUTI_HOUSE_SCORE_FIELDS)for(const value of [-1,1.5,'2',null,Number.MAX_SAFE_INTEGER+1,Infinity])assert.equal((await f.call({...good,[field]:value})).status,400,field+':'+String(value));
    for(const bad of [{requestId:'bad'},{requestId:'A'.repeat(32)},{name:''},{name:'x'.repeat(61)},{name:'Bad\u0001name'},{level:0},{level:1},{score:299},{score:601},{bestCombo:2},{meals:0,score:1,bestCombo:0}])assert.equal((await f.call({...good,...bad})).status,400,JSON.stringify(bad));
    for(const body of [null,[],{},'bad'])assert.equal((await f.call(body)).status,400);
    assert.equal(f.db.prepare('SELECT count(*) n FROM ruti_house_scores').get().n,0);
    assert.throws(()=>rutiHouseScore({}),{status:400});
  }finally{f.close();}
});

test('Ruti’s House accepts combo bonuses, long sessions and normalized player names',async()=>{
  const f=fixture();try{
    const body={...entry(100,100000),name:'  משפחת   קהא  ',score:60000000,elapsed:1000000,level:1+Math.floor(1000000/24)};
    assert.equal((await f.call(body)).status,200);f.restart();const [saved]=(await (await f.call()).json()).scores;assert.equal(saved.name,'משפחת קהא');assert.equal(saved.score,60000000);assert.equal(saved.meals,100000);assert.equal(saved.elapsed,1000000);
    assert.equal((await f.call({...body,name:'משפחת קהא'})).status,200);
  }finally{f.close();}
});

test('Ruti’s House score writes preserve existing origin, marker, method and size protections',async()=>{
  const f=fixture();try{
    assert.equal((await f.call(entry(1),{Origin:'https://other.example'})).status,403);
    assert.equal((await f.call(entry(1),{'Sec-Fetch-Site':'cross-site'})).status,403);
    assert.equal((await f.call(entry(1),{'X-Family-Token':'wrong'})).status,403);
    assert.equal((await f.call(entry(1),{},'ruti-house','PUT')).status,405);
    assert.equal((await f.call(undefined,{},'ruti-house','HEAD')).status,405);
    assert.equal((await f.call({...entry(1),extra:'x'.repeat(5000)})).status,413);
    assert.equal(f.db.prepare('SELECT count(*) n FROM ruti_house_scores').get().n,0);
  }finally{f.close();}
});

const staged=(n,{level=3,completedLevels=2,stageScores=[300,300,300,0,0,0,0,0,0,0],elapsed=400}={})=>({...entry(n,stageScores.reduce((a,b)=>a+b,0)/300),version:2,score:stageScores.reduce((a,b)=>a+b,0),level,elapsed,completedLevels,stageScores});

test('Ruti’s House v2 saves explicit stages independently of elapsed time and preserves legacy entries',async()=>{
  const f=fixture();try{
    const old=entry(1);assert.equal((await f.call(old)).status,200);
    // Simulate an existing deployment whose score table predates the details table.
    f.db.exec('DROP TABLE ruti_house_score_details');f.restart();
    let oldRow=(await (await f.call()).json()).scores[0];assert.equal(oldRow.version,null);assert.equal(oldRow.completedLevels,null);assert.equal(oldRow.stageScores,null);
    assert.equal((await f.call(old)).status,200);
    const partial=staged(2),won=staged(3,{level:10,completedLevels:10,stageScores:Array(10).fill(300),elapsed:123});
    for(const body of [partial,won])assert.equal((await f.call(body)).status,200);
    f.restart();const rows=(await (await f.call()).json()).scores;assert.deepEqual(rows.map(row=>row.score),[3000,900,300]);
    for(const body of [partial,won]){
      const saved=rows.find(row=>row.id===body.requestId);assert.equal(saved.version,2);assert.equal(saved.level,body.level);assert.equal(saved.completedLevels,body.completedLevels);assert.deepEqual(saved.stageScores,body.stageScores);assert.equal(saved.elapsed,body.elapsed);
      assert.equal((await f.call(body)).status,200);
    }
  }finally{f.close();}
});

test('Ruti’s House v2 rejects malformed stages and mismatched totals without writing either table',async()=>{
  const f=fixture();try{
    const good=staged(1),invalid=[{version:1},{version:'2'},{level:11},{completedLevels:-1},{completedLevels:11},{completedLevels:4},{completedLevels:1.5},{completedLevels:null},{stageScores:null},{stageScores:[]},{stageScores:Array(9).fill(100)},{stageScores:[300,300,299,0,0,0,0,0,0,0]},{stageScores:[300,300,200,100,0,0,0,0,0,0]},{stageScores:[300,300,300,-1,0,0,0,0,0,0]},{stageScores:[300,300,300,0,0,0,0,0,0,'0']},{stageScores:[Number.MAX_SAFE_INTEGER+1,0,0,0,0,0,0,0,0,0]},{stageScores:[300.5,299.5,300,0,0,0,0,0,0,0]}];
    for(const bad of invalid)assert.equal((await f.call({...good,...bad})).status,400,JSON.stringify(bad));
    assert.equal(f.db.prepare('SELECT count(*) n FROM ruti_house_scores').get().n,0);assert.equal(f.db.prepare('SELECT count(*) n FROM ruti_house_score_details').get().n,0);
    const zero=staged(2,{level:1,completedLevels:0,stageScores:Array(10).fill(0),elapsed:0});assert.equal((await f.call(zero)).status,200);
  }finally{f.close();}
});

test('Ruti’s House v2 retries compare stage details and cannot replace legacy metadata',async()=>{
  const f=fixture();try{
    const body=staged(1);assert.equal((await f.call(body)).status,200);
    for(const change of [{completedLevels:1},{stageScores:[600,0,300,0,0,0,0,0,0,0]}])assert.equal((await f.call({...body,...change})).status,409);
    const legacy={...body};delete legacy.version;delete legacy.completedLevels;delete legacy.stageScores;legacy.elapsed=48;assert.equal((await f.call(legacy)).status,409);
    const old=entry(2);assert.equal((await f.call(old)).status,200);
    assert.equal((await f.call({...old,version:2,completedLevels:1,stageScores:[old.score,0,0,0,0,0,0,0,0,0]})).status,409);
    assert.equal(f.db.prepare('SELECT count(*) n FROM ruti_house_scores').get().n,2);assert.equal(f.db.prepare('SELECT count(*) n FROM ruti_house_score_details').get().n,1);
  }finally{f.close();}
});

test('v3 speed and combo rewards save, retry and survive restart without relaxing the v2 limit',async()=>{
  const f=fixture();try{
    const body={...staged(51,{level:1,completedLevels:0,stageScores:[1200,0,0,0,0,0,0,0,0,0]}),version:3,meals:1,bestCombo:1};
    assert.equal((await f.call(body)).status,200);
    assert.equal((await f.call(body)).status,200);
    f.restart();const saved=(await (await f.call()).json()).scores[0];
    assert.equal(saved.score,1200);assert.equal(saved.version,3);assert.deepEqual(saved.stageScores,body.stageScores);
    assert.equal((await f.call({...body,requestId:'a'.repeat(32),version:2})).status,400);
    assert.equal((await f.call({...body,requestId:'b'.repeat(32),score:1201,stageScores:[1201,0,0,0,0,0,0,0,0,0]})).status,400);
    assert.equal((await f.call({...body,version:2,score:600,stageScores:[600,0,0,0,0,0,0,0,0,0]})).status,409);
    assert.equal(f.db.prepare('SELECT count(*) n FROM ruti_house_scores').get().n,1);
  }finally{f.close();}
});

test('v4 persists exact Ora bonuses and thirty-task level totals, without changing legacy score validation',async()=>{
 const f=fixture();try{
  const body={...entry(201,0),version:4,score:9000,level:4,completedLevels:3,plants:100,oraWins:1,bestCombo:10,elapsed:350,stageScores:[1200,1200,1200,5400,0,0,0,0,0,0]};
  assert.equal((await f.call(body)).status,200);assert.equal((await f.call(body)).status,200);f.restart();
  const row=(await (await f.call()).json()).scores[0];assert.equal(row.oraWins,1);assert.equal(row.version,4);assert.deepEqual(row.stageScores,body.stageScores);
  assert.equal((await f.call({...body,oraWins:0})).status,409);
  for(const changes of [{oraWins:2},{oraWins:1.5},{oraWins:-1},{plants:99,score:8960,stageScores:[1200,1200,1200,5360,0,0,0,0,0,0]},{plants:121},{score:8999,stageScores:[1200,1200,1200,5399,0,0,0,0,0,0]}]){
   assert.equal((await f.call({...body,requestId:'b'.repeat(32),...changes})).status,400);
  }
  const won={...body,requestId:'c'.repeat(32),level:10,completedLevels:10,plants:293,oraWins:7,score:46720,stageScores:[1200,1200,1200,6160,6160,6160,6160,6160,6160,6160]};
  assert.equal((await f.call(won)).status,200);assert.equal((await f.call({...entry(202),version:3,completedLevels:1,stageScores:[60600,0,0,0,0,0,0,0,0,0]})).status,200);
 }finally{f.close();}
});

test('v5 stores twelve-stage runs with missed tasks, exact Ora bonuses, safe retries and legacy records',async()=>{
 const f=fixture();try{
  const partial={...entry(501,0),version:5,score:7800,level:4,completedLevels:3,plants:70,missed:30,oraWins:1,bestCombo:6,elapsed:400,stageScores:[1000,1000,800,5000,0,0,0,0,0,0,0,0]};
  assert.equal((await f.call(partial)).status,200);assert.equal((await f.call(partial)).status,200);
  assert.equal((await f.call({...partial,missed:31})).status,409,'an otherwise valid retry cannot replace its missed count');
  const won={...entry(502,8),version:5,score:72640,level:12,completedLevels:12,plants:200,dust:40,cats:27,snacks:5,missed:71,oraWins:9,bestCombo:20,elapsed:1100,stageScores:[...Array(11).fill(6000),6640]};
  assert.equal((await f.call(won)).status,200);assert.equal((await f.call(entry(503))).status,200);f.restart();
  const rows=(await (await f.call()).json()).scores;
  for(const input of [partial,won]){const row=rows.find(r=>r.id===input.requestId);assert.equal(row.version,5);assert.equal(row.missed,input.missed);assert.equal(row.oraWins,input.oraWins);assert.deepEqual(row.stageScores,input.stageScores);}
  assert.equal(rows.find(r=>r.id===entry(503).requestId).missed,0);
  for(const changes of [{missed:70},{missed:72},{missed:-1},{missed:1.5},{missed:undefined},{oraWins:10},{stageScores:Array(10).fill(7264)},{level:13},{version:4}])assert.equal((await f.call({...won,requestId:'e'.repeat(32),...changes})).status,400,JSON.stringify(changes));
  assert.equal(f.db.prepare('SELECT count(*) n FROM ruti_house_run_metrics').get().n,2);
 }finally{f.close();}
});

test('v6 saves cumulative stage bonuses with verified task summaries, legacy entries and idempotent retries',async()=>{
 const f=fixture();try{
  const summary={plants:24,dust:6,missedPlants:0,missedDust:0,completed:30};
  const body={...entry(601,0),version:6,score:4580,level:2,completedLevels:1,plants:24,dust:6,missed:0,oraWins:0,bestCombo:30,elapsed:100,stageScores:[4580,...Array(11).fill(0)],stageResults:[summary,...Array(11).fill(null)]};
  assert.equal((await f.call(body)).status,200);assert.equal((await f.call(body)).status,200);f.restart();
  const row=(await (await f.call()).json()).scores[0];assert.equal(row.version,6);assert.deepEqual(row.stageResults,body.stageResults);assert.equal(row.score,4580);
  for(const changes of [{stageResults:null},{stageResults:Array(12).fill(summary)},{stageResults:[{...summary,completed:31},...Array(11).fill(null)]},{stageResults:[{...summary,dust:7},...Array(11).fill(null)]},{score:4581,stageScores:[4581,...Array(11).fill(0)],plants:0,dust:0}])assert.equal((await f.call({...body,requestId:'e'.repeat(32),...changes})).status,400);
  const partial={...body,requestId:'d'.repeat(32),score:2060,plants:24,dust:5,missed:1,bestCombo:29,stageScores:[2060,...Array(11).fill(0)],stageResults:[{...summary,dust:5,missedDust:1,completed:29},...Array(11).fill(null)]};
  assert.equal((await f.call(partial)).status,200);
  const changed={...partial,stageResults:[{...partial.stageResults[0],missedPlants:1,missedDust:0},...Array(11).fill(null)]};
  assert.equal((await f.call(changed)).status,409,'a valid alternative summary cannot replace the saved run');
  assert.equal((await f.call(entry(602))).status,200);assert.equal(f.db.prepare('SELECT count(*) n FROM ruti_house_completion_bonuses').get().n,2);
 }finally{f.close();}
});

test('v7 persists longer stage goals, completion bonuses and missed counts across retry and restart',async()=>{
 const f=fixture();try{
  const first={plants:30,dust:0,missedPlants:0,missedDust:0,completed:30},long={plants:34,dust:6,missedPlants:0,missedDust:0,completed:40};
  const body={...entry(701,0),version:7,score:55380,level:14,completedLevels:13,plants:394,dust:6,missed:0,oraWins:0,bestCombo:400,elapsed:2000,
   stageScores:[...Array(12).fill(4200),4980,...Array(7).fill(0)],stageResults:[...Array.from({length:12},()=>({...first})),long,...Array(7).fill(null)]};
  assert.equal((await f.call(body)).status,200);f.restart();assert.equal((await f.call(body)).status,200);
  const saved=(await (await f.call()).json()).scores[0];assert.equal(saved.version,7);assert.equal(saved.missed,0);assert.equal(saved.oraWins,0);
  assert.deepEqual(saved.stageScores,body.stageScores);assert.deepEqual(saved.stageResults,body.stageResults);
  assert.equal(f.db.prepare('SELECT count(*) n FROM ruti_house_run_metrics').get().n,1);
  assert.equal(f.db.prepare('SELECT count(*) n FROM ruti_house_completion_bonuses').get().n,1);
  const changed={...body,stageScores:[...Array(12).fill(4200),5480,...Array(7).fill(0)],score:55880,oraWins:0};
  assert.equal((await f.call(changed)).status,409);
 }finally{f.close();}
});
