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
