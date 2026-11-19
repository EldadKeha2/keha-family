import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {handleNakashState} from '../src/nakash-state.mjs';
import {nakashProjection, nakashRoute} from '../src/nakash.mjs';
import family from '../src/family.mjs';

test('Nakash stores one upload with only the intended branches and uses the owner session to issue distinct codes', async () => {
  const sql = new DatabaseSync(':memory:');
  const state = {
    sql: {exec: (query, ...values) => sql.prepare(query).run(...values)},
    rows: (query, ...values) => sql.prepare(query).all(...values),
    ctx: {storage: {transactionSync: fn => fn()}},
  };
  const access = class {
    authorize(session) {
      if (session !== 'owner') throw Object.assign(Error('owner login required'), {status: 401});
    }
  };
  const db = (action, args) => handleNakashState(state, action, args, access);
  await assert.rejects(db('nakash.code', {branch: 'haim', digest: 'haim-code', session: ''}), {status: 401});
  await db('nakash.code', {branch: 'haim', digest: 'haim-code', session: 'owner'});
  await db('nakash.code', {branch: 'keha', digest: 'keha-code', session: 'owner'});
  await assert.rejects(db('nakash.authorize', {branch: 'keha', digest: 'haim-code'}), {status: 403});
  await db('nakash.authorize', {branch: 'keha', digest: 'keha-code'});

  const put = item => db('nakash.add', {item});
  await put({id: 'first', kind: 'photo', branches: ['keha'], people: ['yona']});
  await put({id: 'shared', kind: 'photo', branches: ['keha','haim'], people: ['yona','avner-nakash']});
  await put({id: 'video', kind: 'video', branches: ['yehuda'], people: []});

  const ids = async (branch, kind) => (await db('nakash.list', {branch, kind, page: 1})).items.map(item => item.id).sort();
  assert.deepEqual(await ids('keha','photo'), ['first','shared']);
  assert.deepEqual(await ids('haim','photo'), ['shared']);
  assert.deepEqual(await ids('medina','photo'), []);
  assert.deepEqual(await ids('yehuda','photo'), []);
  assert.deepEqual(await ids('yehuda','video'), ['video']);
  await assert.rejects(db('nakash.get', {id: 'legacy-keha-photo'}), {status: 404});
  sql.close();
});

test('Nakash route projects the Keha family tree and only serves the dedicated Nakash shell', async () => {
  const projected = nakashProjection(family, new Map([['yona', 'יונה נקאש קהא']]));
  assert.ok(projected.units['u-root'].children.length);
  assert.equal(projected.people.yona.name, 'יונה נקאש קהא');
  assert.equal(Object.hasOwn(projected.people.yona, 'birthday'), false);
  assert.equal(Object.hasOwn(projected.people.yona, 'profile'), false);
  const env = {ASSETS: {fetch: request => Response.json({asset: new URL(request.url).pathname})}};
  const db = async (action) => {
    if (action === 'nakash.compat.portraits') return {portraits:{}};
    assert.equal(action, 'dates');
    return {people:[{id:'yona', name:'יונה נקאש קהא', birthday:'private'}]};
  };
  const route = path => nakashRoute(new Request('https://example.test' + path), env, db, {}, {family});
  for (const path of ['/nakash/', '/nakash/haim/', '/nakash/yehuda/', '/nakash/medina/', '/nakash/keha/', '/nakash/inside/']) {
    assert.deepEqual(await (await route(path)).json(), {asset:'/nakash/'});
  }
  assert.equal((await route('/nakash/haim')).status, 308);
  await assert.rejects(route('/nakash/api/export'), {status: 404});
  const payload = await (await route('/nakash/api/family')).json();
  assert.equal(payload.people.yona.name, 'יונה נקאש קהא');
  assert.equal(Object.hasOwn(payload.people.yona, 'birthday'), false);
});

test('Shared Nakash upload and profile contracts keep branch media and profile edits isolated', async () => {
  const {default:worker,PUBLIC_WRITE_TOKEN}=await import('../src/worker.mjs');
  const {NAKASH_WRITE_TOKEN}=await import('../src/nakash-shell.mjs');
  const {fail,json}=await import('../src/http.mjs');
  const storage=new DatabaseSync(':memory:');
  const mainPortrait={id:'a'.repeat(32),key:'original/portrait.png',mime:'image/png',size:68};
  const state={
    sql:{exec:(query,...values)=>storage.prepare(query).run(...values)},
    rows:(query,...values)=>storage.prepare(query).all(...values),
    ctx:{storage:{transactionSync(fn){
      storage.exec('BEGIN');
      try{const value=fn();storage.exec('COMMIT');return value;}
      catch(error){storage.exec('ROLLBACK');throw error;}
    }}},
    run:()=>({people:{yona:{id:'yona',name:'יונה נקאש קהא',profileMediaId:mainPortrait.id,profileFraming:{x:.45,y:.5}}}}),
    media:id=>id===mainPortrait.id?mainPortrait:null,
  };
  const doBinding={async fetch(request) {
    const {action,...args}=await request.json();
    try {
      if(action==='dates')return json({people:[{id:'yona',name:'יונה נקאש קהא',birthday:'16.10.1921'}]});
      return json(await handleNakashState(state,action,args));
    }catch(error){return fail(error);}
  }};
  const env={FAMILY_STATE:{get:()=>doBinding,idFromName:name=>name},HF_NAMESPACE:'fixture',HF_BUCKET:'fixture',HF_ACCESS_KEY_ID:'demo',HF_SECRET_ACCESS_KEY:'demo'};
  const bytes=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jNTsAAAAASUVORK5CYII=', 'base64'));
  const objects=new Map([['/fixture/fixture/'+mainPortrait.key,bytes]]);
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async request=>{
    const url=new URL(request.url);assert.equal(url.hostname,'s3.hf.co');
    if(request.method==='PUT'){objects.set(url.pathname,new Uint8Array(await request.arrayBuffer()));return new Response('');}
    if(request.method==='DELETE'){objects.delete(url.pathname);return new Response('');}
    return new Response(objects.get(url.pathname),{status:objects.has(url.pathname)?200:404});
  };
  const origin='https://family.example',ctx={waitUntil(){}};
  const go=(path,options)=>worker.fetch(new Request(origin+path,options),env,ctx);
  const branch=(id,path)=>'/nakash/api/compat/'+id+'/api/'+path;
  const post=(id,path,value)=>go(branch(id,path),{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-Family-Token':NAKASH_WRITE_TOKEN},body:JSON.stringify(value)});
  const gallery=async(id,filter='all')=>(await go(branch(id,'collections/gallery?filter='+filter))).json();
  try {
    const marker=await (await go('/nakash/api/site-data.js')).text();
    assert.ok(marker.includes(NAKASH_WRITE_TOKEN));
    assert.ok(!marker.includes(PUBLIC_WRITE_TOKEN));
    assert.equal((await go('/nakash/api/profile-photo/yona')).status,200);
    assert.equal((await go('/nakash/api/profile-photo/avner-nakash')).status,404);
    assert.equal((await gallery('keha')).items.length,0);

    const uploaded=await go(branch('haim','collections/gallery/upload?filename=fixture.png'),{
      method:'POST',headers:{Origin:origin,'Content-Type':'image/png','Content-Length':String(bytes.length),'X-Family-Token':NAKASH_WRITE_TOKEN},body:bytes,
    });
    assert.equal(uploaded.status,201);
    const image=(await uploaded.json()).collection.items[0];
    assert.ok(image.src.startsWith('/nakash/api/media/'));
    assert.equal((await gallery('haim','untagged')).items.length,1);
    assert.equal((await gallery('keha')).items.length,0);
    assert.equal((await post('haim','media/'+image.id+'/tags/patch',{changes:[{personId:'yona',tagged:true}]})).status,200);
    assert.equal((await gallery('haim')).items.length,0);
    assert.equal((await gallery('keha','partial')).items.length,1);
    assert.equal((await post('haim','media/'+image.id+'/tags/patch',{changes:[{personId:'avner-nakash',tagged:true}]})).status,200);
    assert.equal((await gallery('haim','partial')).items.length,1);
    assert.equal((await gallery('keha','partial')).items.length,1);
    assert.equal((await gallery('medina')).items.length,0);
    assert.equal((await post('haim','media/'+image.id+'/faces/review',{complete:true})).status,200);
    assert.equal((await gallery('haim','complete')).items.length,1);
    assert.equal((await go(branch('yehuda','media/'+image.id+'/view'))).status,404);

    for(const [path,body] of [
      ['birthday',{birthday:'2.3.1980',expectedBirthday:'1.1.1111'}],
      ['about',{about:'סיפור בדיקה',expectedAbout:'',language:'he'}],
      ['biography',{section:'occupation',value:'מורה',expectedValue:'',language:'he'}],
      ['biography',{section:'languages',value:['עברית'],expectedValue:[],language:'he'}],
    ]) assert.equal((await post('haim','people/avner-nakash/'+path,body)).status,200,path);
    const data=await (await go(branch('medina','people/avner-nakash/page'))).json();
    assert.equal(data.person.birthday,'2.3.1980');
    assert.equal(data.person.about,'סיפור בדיקה');
    assert.equal(data.person.occupation,'מורה');
    assert.deepEqual(data.person.languages,['עברית']);
    assert.equal((await go('/api/people/avner-nakash/about',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-Family-Token':NAKASH_WRITE_TOKEN},body:'{}'})).status,403);
  } finally {
    globalThis.fetch=originalFetch;
    storage.close();
  }
});
