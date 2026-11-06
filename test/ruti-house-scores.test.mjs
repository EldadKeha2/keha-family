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
