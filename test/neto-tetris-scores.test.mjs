import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import worker,{FamilyState,PUBLIC_WRITE_TOKEN} from '../src/worker.mjs';
import {netoTetrisScore} from '../src/neto-tetris-scores.mjs';

function fixture(){
  const db=new DatabaseSync(':memory:');
  const storage={sql:{exec(query,...args){const stmt=db.prepare(query),rows=stmt.columns().length?stmt.all(...args):(stmt.run(...args),[]);return {toArray:()=>rows};}},transactionSync(fn){db.exec('BEGIN');try{const result=fn();db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}}};
  let state=new FamilyState({storage},{});const env={FAMILY_STATE:{idFromName:n=>n,get:()=>state}};
  const call=(body,headers={},path='neto-tetris',method=body===undefined?'GET':'POST')=>worker.fetch(new Request('https://family.example/api/games/'+path+'/scores',{method,headers:{Origin:'https://family.example','X-Family-Token':PUBLIC_WRITE_TOKEN,'Content-Type':'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body)}),env,{waitUntil(){}});
  return {db,call,restart(){state=new FamilyState({storage},env);},close(){db.close();}};
}
const entry=(n,lines=1)=>({requestId:n.toString(16).padStart(32,'0'),name:'Player '+n,score:lines*100,lines,level:1+Math.floor(lines/10),pieces:lines*3,zaps:2});

test('Neto Tetris scores rank across visitors, retain all counters after restart and stay separate from other games',async()=>{
  const f=fixture();try{
    assert.deepEqual(await (await f.call()).json(),{scores:[],limit:20});
    for(const n of [1,3,2])assert.equal((await f.call(entry(n,n))).status,200);
    f.restart();const result=await (await f.call()).json();assert.deepEqual(result.scores.map(row=>row.score),[300,200,100]);
    const top=result.scores[0];assert.equal(top.name,'Player 3');assert.equal(top.lines,3);assert.equal(top.level,1);assert.equal(top.pieces,9);assert.equal(top.zaps,2);assert.ok(top.createdAt);
    for(const other of ['rex','jachnun'])assert.deepEqual((await (await f.call(undefined,{},other)).json()).scores,[]);
  }finally{f.close();}
});

test('Neto Tetris saves once per run, ranks ties consistently, and returns only the top twenty',async()=>{
  const f=fixture();try{
    for(let n=1;n<=22;n++)assert.equal((await f.call(entry(n,n))).status,200);
    const body=entry(22,22),result=await (await f.call(body)).json();assert.equal(result.rank,1);assert.equal(result.scores.length,20);assert.equal(result.limit,20);
    assert.equal(f.db.prepare('SELECT count(*) n FROM neto_tetris_scores').get().n,22);
    const tie=await (await f.call(entry(23,22))).json();assert.equal(tie.rank,2);assert.equal(tie.scores[0].id,body.requestId);
    for(const change of [{name:'Other'},{score:2300},{lines:23,score:2300},{level:4,lines:30,score:3000},{pieces:999},{zaps:3}])assert.equal((await f.call({...body,...change})).status,409,JSON.stringify(change));
    assert.equal(f.db.prepare('SELECT count(*) n FROM neto_tetris_scores').get().n,23);
    const zero={...entry(24,0),pieces:0,zaps:0};assert.equal((await f.call(zero)).status,200);assert.equal((await (await f.call(zero)).json()).rank,24);
  }finally{f.close();}
});

test('Neto Tetris rejects malformed, unsafe, unweighted and impossible scores before writing',async()=>{
  const f=fixture();try{
    const good=entry(1);
    const invalid=[{requestId:'bad'},{requestId:'A'.repeat(32)},{name:''},{name:'x'.repeat(61)},{name:'Bad\u0001name'},
      {score:-100},{score:1},{score:'100'},{score:300},{score:0},{score:Number.MAX_SAFE_INTEGER+1},{score:Infinity},
      {lines:-1},{lines:1.5},{lines:'1'},{lines:Number.MAX_SAFE_INTEGER+1},{level:0},{level:2},{level:1.1},
      {pieces:-1},{pieces:.5},{pieces:null},{pieces:Number.MAX_SAFE_INTEGER+1},{zaps:-1},{zaps:.1},{zaps:Infinity},
      {lines:0,score:100},{lines:100,level:11,score:9900},{lines:Number.MAX_SAFE_INTEGER,level:1+Math.floor(Number.MAX_SAFE_INTEGER/10),score:100}];
    for(const bad of invalid)assert.equal((await f.call({...good,...bad})).status,400,JSON.stringify(bad));
    for(const body of [null,[],{},'bad'])assert.equal((await f.call(body)).status,400);
    assert.equal(f.db.prepare('SELECT count(*) n FROM neto_tetris_scores').get().n,0);
  }finally{f.close();}
});

test('Neto Tetris accepts long untimed sessions, exact integer storage and normalized names',async()=>{
  const f=fixture();try{
    const body={...entry(100,100000),name:'  משפחת   פיש  ',score:2000000000,pieces:400000,zaps:20000};
    assert.equal((await f.call(body)).status,200);f.restart();const [saved]=(await (await f.call()).json()).scores;
    assert.equal(saved.name,'משפחת פיש');assert.equal(saved.score,2000000000);assert.equal(saved.lines,100000);assert.equal(saved.pieces,400000);assert.equal(saved.zaps,20000);assert.equal(saved.level,10001);
    assert.equal((await f.call({...body,name:'משפחת פיש'})).status,200);
    const safe={...entry(101,1),pieces:Number.MAX_SAFE_INTEGER,zaps:Number.MAX_SAFE_INTEGER};assert.equal((await f.call(safe)).status,200);f.restart();const row=f.db.prepare('SELECT pieces,zaps FROM neto_tetris_scores WHERE id=?').get(safe.requestId);assert.equal(row.pieces,Number.MAX_SAFE_INTEGER);assert.equal(row.zaps,Number.MAX_SAFE_INTEGER);
    assert.throws(()=>netoTetrisScore({}),{status:400});
  }finally{f.close();}
});

test('Neto Tetris writes require the existing same-origin marker and reject unsupported methods and oversized input',async()=>{
  const f=fixture();try{
    assert.equal((await f.call(entry(1),{Origin:'https://other.example'})).status,403);
    assert.equal((await f.call(entry(1),{'Sec-Fetch-Site':'cross-site'})).status,403);
    assert.equal((await f.call(entry(1),{'X-Family-Token':'wrong'})).status,403);
    assert.equal((await f.call(entry(1),{},'neto-tetris','PUT')).status,405);
    assert.equal((await f.call(undefined,{},'neto-tetris','HEAD')).status,405);
    assert.equal((await f.call({...entry(1),extra:'x'.repeat(5000)})).status,413);
    assert.equal(f.db.prepare('SELECT count(*) n FROM neto_tetris_scores').get().n,0);
  }finally{f.close();}
});
