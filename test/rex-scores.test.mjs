import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import worker,{FamilyState,PUBLIC_WRITE_TOKEN} from '../src/worker.mjs';

function fixture(){
  const db=new DatabaseSync(':memory:');
  const storage={sql:{exec(query,...args){const stmt=db.prepare(query),rows=stmt.columns().length?stmt.all(...args):(stmt.run(...args),[]);return {toArray:()=>rows};}},transactionSync(fn){db.exec('BEGIN');try{const result=fn();db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}}};
  let state=new FamilyState({storage},{});const env={FAMILY_STATE:{idFromName:n=>n,get:()=>state}};
  const call=(body,headers={},path='rex')=>worker.fetch(new Request('https://family.example/api/games/'+path+'/scores',{method:body===undefined?'GET':'POST',headers:{Origin:'https://family.example','X-Family-Token':PUBLIC_WRITE_TOKEN,'Content-Type':'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body)}),env,{waitUntil(){}});
  return {db,call,restart(){state=new FamilyState({storage},env);},close(){db.close();}};
}
const entry=(n,count=1)=>({requestId:n.toString(16).padStart(32,'0'),name:'Player '+n,score:count*4,headId:'yona',basket:{jachnun:count,lahoh:0,kubaneh:0,malawach:0}});
test('Rex records retain weighted baskets and heads, rank across visitors, survive restart and stay separate from Jachnun',async()=>{
  const f=fixture();try{
    assert.deepEqual(await (await f.call()).json(),{scores:[],limit:20});
    for(const n of [1,3,2])assert.equal((await f.call({...entry(n,n),headId:n===3?'eldad':'yona'})).status,200);
    f.restart();const result=await (await f.call()).json();assert.deepEqual(result.scores.map(row=>row.score),[12,8,4]);assert.equal(result.scores[0].headId,'eldad');assert.equal(result.scores[0].basket.jachnun,3);
    assert.deepEqual((await (await f.call(undefined,{},'jachnun')).json()).scores,[]);
  }finally{f.close();}
});
test('retries are idempotent and cannot replace a saved player, head or basket; top twenty and rank agree',async()=>{
  const f=fixture();try{
    for(let n=1;n<=22;n++)assert.equal((await f.call(entry(n,n))).status,200);
    const result=await (await f.call(entry(22,22))).json();assert.equal(result.rank,1);assert.equal(result.scores.length,20);assert.equal(f.db.prepare('SELECT count(*) n FROM rex_scores').get().n,22);
    const tie=await (await f.call(entry(23,22))).json();assert.equal(tie.rank,2);
    for(const change of [{name:'Other'},{headId:'ruti'},{score:0,basket:{jachnun:0,lahoh:0,kubaneh:0,malawach:0}}])assert.equal((await f.call({...entry(22,22),...change})).status,409);
  }finally{f.close();}
});
test('invalid and unweighted baskets, impossible totals and bad write credentials are rejected',async()=>{
  const f=fixture();try{
    const good=entry(1);
    for(const bad of [{score:1},{score:'4'},{score:-1},{basket:null},{basket:[]},{basket:{jachnun:1}},{basket:{...good.basket,jachnun:1.1}},{basket:{...good.basket,jachnun:-1}},{score:896,basket:{...good.basket,jachnun:224}},{name:''},{name:'x'.repeat(61)},{headId:'unknown'},{requestId:'bad'}])assert.equal((await f.call({...good,...bad})).status,400,JSON.stringify(bad));
    assert.equal((await f.call(good,{Origin:'https://other.example'})).status,403);assert.equal((await f.call(good,{'X-Family-Token':'wrong'})).status,403);
    assert.equal(f.db.prepare('SELECT count(*) n FROM rex_scores').get().n,0);
    assert.equal((await f.call({...good,score:0,basket:{jachnun:0,lahoh:0,kubaneh:0,malawach:0}})).status,200);
  }finally{f.close();}
});
