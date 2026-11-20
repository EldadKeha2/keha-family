import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {prepareFamilyApps} from '../scripts/prepare-family-apps.mjs';

const production = {WORKERS_CI:'1', WORKERS_CI_BRANCH:'main', WRANGLER_COMMAND:'deploy', CLOUDFLARE_ACCOUNT_ID:'test-account', CLOUDFLARE_API_TOKEN:'test-credential'};

function fixture({existing = false, badIdentity = false, failUpload = false, extendedReady = false} = {}) {
  const calls = [], writes = [], logs = [];
  async function apiFetch(url, options) {
    calls.push({url, options});
    assert.equal(options.headers.get('Authorization'), 'Bearer test-credential');
    assert.ok(url.startsWith('https://api.cloudflare.com/client/v4/accounts/test-account/workers/'));
    const path = new URL(url).pathname;
    if (path.endsWith('/workers/subdomain')) return Response.json({success:true, result:{subdomain:'family-test'}});
    if (path.endsWith('/settings')) return existing ? Response.json({success:true, result:{bindings:[]}}) : new Response('', {status:404});
    assert.ok(/\/scripts\/family-(haim|yehuda|medina|extended)(\/subdomain)?$/.test(path));
    if (options.method === 'PUT') {
      if (failUpload) return Response.json({success:false, errors:[{code:10000}]}, {status:403});
      const branch = path.split('family-').at(-1);
      const metadata = JSON.parse(await options.body.get('metadata').text());
      assert.deepEqual(metadata.bindings, [{type:'plain_text', name:'FAMILY_BRANCH', text:branch}, {type:'service', name:'FAMILY_SITE', service:'keha-family'}]);
      assert.equal(metadata.main_module, 'worker.mjs');
      assert.ok((await options.body.get('worker.mjs').text()).includes('env.FAMILY_SITE'));
    } else {
      assert.equal(options.method, 'POST');
      assert.deepEqual(JSON.parse(options.body), {enabled:true, previews_enabled:false});
    }
    return Response.json({success:true, result:{}});
  }
  async function verifyFetch(url, options) {
    assert.equal(new Headers(options.headers).has('Authorization'), false);
    const parsed = new URL(url), branch = parsed.hostname.split('.')[0].slice('family-'.length);
    if(parsed.hostname==='keha-family.eldadkeha.workers.dev')return extendedReady?Response.json(JSON.parse(await readFile(new URL('../public/keha-extended/manifest.webmanifest',import.meta.url)))):new Response('',{status:404});
    const manifest = JSON.parse(await readFile(new URL(branch==='extended'?'../public/keha-extended/manifest.webmanifest':'../public/nakash/' + branch + '/manifest.webmanifest', import.meta.url), 'utf8'));
    if (parsed.pathname.endsWith('manifest.webmanifest')) {
      manifest.related_applications = [{platform:'webapp', id:parsed.origin + manifest.id}];
      if (badIdentity) manifest.name = 'Another family';
      return Response.json(manifest);
    }
    if (parsed.pathname.endsWith('.png')) return new Response('icon', {headers:{'Content-Type':'image/png'}});
    return new Response('<title>' + manifest.name + '</title>');
  }
  return {calls, writes, logs, options:{env:production, apiFetch, verifyFetch, write:async (...args) => writes.push(args), pause:async () => {}, log:message => logs.push(message)}};
}

test('local checks and preview branches cannot publish family apps', async () => {
  for (const changes of [{WORKERS_CI:undefined}, {WORKERS_CI_BRANCH:'preview'}, {WRANGLER_COMMAND:'dev'}, {WRANGLER_COMMAND:undefined}]) {
    const f = fixture();
    assert.deepEqual(await prepareFamilyApps({...f.options, env:{...production, ...changes}}), {});
    assert.equal(f.calls.length, 0);
    assert.equal(f.writes.length, 0);
  }
});

test('the existing production connection deploys only the three additional apps and activates verified origins', async () => {
  const f = fixture(), result = await prepareFamilyApps(f.options);
  assert.deepEqual(Object.keys(result).sort(), ['haim', 'medina', 'yehuda']);
  assert.equal(f.calls.filter(call => call.options.method === 'PUT').length, 3);
  assert.equal(f.writes.length, 1);
  for (const branch of Object.keys(result)) assert.equal(result[branch], 'https://family-' + branch + '.family-test.workers.dev');
  assert.ok(f.writes[0][1].includes(JSON.stringify(result, null, 2)));
  assert.ok(f.logs.every(message => !message.includes(production.CLOUDFLARE_API_TOKEN)));
});

test('unrelated existing Workers, denied uploads and failed live checks leave installation links untouched', async () => {
  for (const options of [{existing:true}, {failUpload:true}, {badIdentity:true}]) {
    const f = fixture(options);
    await assert.rejects(prepareFamilyApps(f.options));
    assert.equal(f.writes.length, 0);
    if (options.existing) assert.equal(f.calls.filter(call => call.options.method === 'PUT').length, 0);
  }
});

test('the extended installation is activated only after its own route, manifest, icon and independent origin pass live checks',async()=>{
  const f=fixture({extendedReady:true}),result=await prepareFamilyApps(f.options);
  assert.deepEqual(Object.keys(result).sort(),['extended','haim','medina','yehuda']);
  assert.equal(result.extended,'https://family-extended.family-test.workers.dev');
  assert.equal(f.calls.filter(call=>call.options.method==='PUT').length,4);
  assert.ok(f.writes[0][1].includes('"extended"'));
});
