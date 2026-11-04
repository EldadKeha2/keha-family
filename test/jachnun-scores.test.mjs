import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import worker,{FamilyState,PUBLIC_WRITE_TOKEN} from '../src/worker.mjs';

function fixture(){
  const db=new DatabaseSync(':memory:');
  const storage={sql:{exec(query,...args){const statement=db.prepare(query),rows=statement.columns().length?statement.all(...args):(statement.run(...args),[]);return {toArray:()=>rows};}},transactionSync(fn){db.exec('BEGIN');try{const result=fn();db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}}};
  const env={};let state=new FamilyState({storage},env);
  env.FAMILY_STATE={idFromName:n=>n,get:()=>state};
  async function call(body,headers={}){return worker.fetch(new Request('https://family.example/api/games/jachnun/scores',{method:body===undefined?'GET':'POST',headers:{Origin:'https://family.example','X-Family-Token':PUBLIC_WRITE_TOKEN,'Content-Type':'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body)}),env,{waitUntil(){}});}
  return {call,db,restart(){state=new FamilyState({storage},env);},close:()=>db.close()};
}
const entry=(n,score,headId='yona')=>({requestId:n.toString(16).padStart(32,'0'),name:'שחקן '+n,score,headId});

test('shared scores sort by food eaten, preserve the chosen head and survive a state restart',async()=>{
  const f=fixture();try{
    assert.deepEqual(await (await f.call()).json(),{scores:[],limit:20});
    for(const data of [entry(1,9),entry(2,21,'eldad'),entry(3,12)])assert.equal((await f.call(data)).status,200);
    f.restart();const result=await (await f.call()).json();
    assert.deepEqual(result.scores.map(s=>s.score),[21,12,9]);assert.equal(result.scores[0].name,'שחקן 2');assert.equal(result.scores[0].headId,'eldad');assert.ok(result.scores.every(s=>!Number.isNaN(Date.parse(s.createdAt))));
  }finally{f.close();}
});
test('a retried save creates one row and cannot overwrite a completed run with another name, score or head',async()=>{
  const f=fixture();try{
    const body=entry(1,0);let result=await (await f.call(body)).json();assert.equal(result.saved,true);assert.equal(result.rank,1);
    assert.equal((await f.call(body)).status,200);assert.equal(f.db.prepare('SELECT count(*) n FROM jachnun_scores').get().n,1);
    for(const changed of [{name:'Different name'},{score:3},{headId:'eldad'}])assert.equal((await f.call({...body,...changed})).status,409);
    assert.deepEqual((await (await f.call()).json()).scores.map(s=>s.score),[0]);
  }finally{f.close();}
});
test('only the top twenty rows are read; ties and the saved position follow the same deterministic order',async()=>{
  const f=fixture();try{
    for(let n=1;n<=24;n++)assert.equal((await f.call(entry(n,n))).status,200);
    let result=await (await f.call()).json();assert.equal(result.scores.length,20);assert.equal(result.scores[0].score,24);assert.equal(result.scores.at(-1).score,5);
    result=await (await f.call(entry(25,0))).json();assert.equal(result.rank,25);assert.equal(result.scores.length,20);
    const same=await (await f.call(entry(26,24,'ruti'))).json();assert.equal(same.rank,2);assert.deepEqual(same.scores.slice(0,2).map(s=>s.id),[entry(24,24).requestId,entry(26,24).requestId]);
  }finally{f.close();}
});
test('invalid scores, names, heads and request markers are rejected without writes; origin and request-token checks remain enforced',async()=>{
  const f=fixture();try{
    const valid=entry(1,6);
    for(const change of [{score:-1},{score:964},{score:1.5},{score:'7'},{score:null},{headId:'unknown'},{headId:'../../photo'},{name:''},{name:' '.repeat(3)},{name:'x'.repeat(61)},{requestId:'invalid'}])assert.equal((await f.call({...valid,...change})).status,400,JSON.stringify(change));
    assert.equal((await f.call(valid,{Origin:'https://other.example'})).status,403);
    assert.equal((await f.call(valid,{'X-Family-Token':'wrong'})).status,403);
    assert.equal((await f.call({...valid,name:'x'.repeat(5000)})).status,413);
    assert.equal(f.db.prepare('SELECT count(*) n FROM jachnun_scores').get().n,0);
  }finally{f.close();}
});
