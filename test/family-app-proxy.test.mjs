import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import worker, {familyApp, UPSTREAM} from '../family-apps/worker.mjs';

test('the production proxy uses the existing backend service binding', async () => {
  let received;
  const response = await worker.fetch(new Request('https://haim.example/nakash/haim/'), {
    FAMILY_BRANCH:'haim', FAMILY_SITE:{async fetch(request) {received = request; return new Response('shared backend');}},
  });
  assert.equal(received.url, UPSTREAM + '/nakash/haim/');
  assert.equal(await response.text(), 'shared backend');
});

test('each dedicated family origin opens its own existing portal', async () => {
  for (const branch of ['haim', 'yehuda', 'medina', 'keha']) {
    const origin = 'https://' + branch + '.example';
    const app = familyApp(branch, () => { throw Error('Unexpected backend request'); });
    const response = await app.fetch(new Request(origin + '/?install=1&lang=en-US'));
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('Location'), origin + '/nakash/' + branch + '/?install=1&lang=en-US#home');
  }
});

test('same backend serves profiles, media ranges and streamed uploads', async () => {
  let received;
  const app = familyApp('yehuda', async request => {
    received = request;
    return new Response('saved', {status: 201, headers: {'X-Saved': 'true'}});
  });
  const response = await app.fetch(new Request('https://yehuda.example/api/media?branch=yehuda', {
    method: 'POST', body: 'a shared profile upload', headers: {Origin: 'https://yehuda.example', Referer: 'https://yehuda.example/nakash/yehuda/#gallery', 'Content-Type': 'image/jpeg', 'X-Family-Token': 'existing-token'},
  }));
  assert.equal(received.url, UPSTREAM + '/api/media?branch=yehuda');
  assert.equal(received.headers.get('Origin'), UPSTREAM);
  assert.equal(received.headers.get('Referer'), UPSTREAM + '/nakash/yehuda/');
  assert.equal(received.headers.get('X-Family-Token'), 'existing-token');
  assert.equal(await received.text(), 'a shared profile upload');
  assert.equal(response.status, 201);
  assert.equal(await response.text(), 'saved');
  const video = familyApp('haim', async request => {
    assert.equal(request.headers.get('Range'), 'bytes=100-199');
    return new Response('chunk', {status: 206, headers: {'Content-Range': 'bytes 100-199/1000'}});
  });
  const range = await video.fetch(new Request('https://haim.example/media/video.mp4', {headers: {Range: 'bytes=100-199'}}));
  assert.equal(range.status, 206);
  assert.equal(range.headers.get('Content-Range'), 'bytes 100-199/1000');
});

test('root aliases never install the original Keha app on another family origin', async () => {
  const manifest = JSON.parse(await readFile(new URL('../public/nakash/medina/manifest.webmanifest', import.meta.url), 'utf8'));
  const app = familyApp('medina', request => {
    assert.equal(request.url, UPSTREAM + '/nakash/medina/manifest.webmanifest');
    assert.equal(request.headers.get('If-None-Match'), null);
    assert.equal(request.headers.get('If-Modified-Since'), null);
    return Response.json(manifest);
  });
  const redirect = await app.fetch(new Request('https://medina.example/index.html?lang=he'));
  assert.equal(redirect.headers.get('Location'), 'https://medina.example/nakash/medina/?lang=he#home');
  const response = await app.fetch(new Request('https://medina.example/manifest.webmanifest', {
    headers: {'If-None-Match':'keha-manifest', 'If-Modified-Since':'Thu, 19 Nov 2026 12:00:00 GMT'},
  }));
  const actual = await response.json();
  assert.equal(actual.name, 'משפחת מדינה');
  assert.equal(actual.related_applications[0].id, 'https://medina.example/nakash/medina/');
});

test('foreign-origin writes are rejected before any backend request', async () => {
  const app = familyApp('medina', () => { throw Error('CSRF reached the backend'); });
  for (const method of ['POST', 'PATCH', 'DELETE']) {
    const response = await app.fetch(new Request('https://medina.example/api/people/person', {method, headers: {Origin: 'https://unrelated.example'}}));
    assert.equal(response.status, 403);
  }
});

test('family manifests describe independent origins with their own existing brand', async () => {
  for (const branch of ['haim', 'yehuda', 'medina', 'keha']) {
    const original = JSON.parse(await readFile(new URL('../public/nakash/' + branch + '/manifest.webmanifest', import.meta.url), 'utf8'));
    const app = familyApp(branch, () => Response.json(original, {headers: {ETag: 'old-manifest', 'Content-Length': '1', 'Content-Encoding': 'gzip'}}));
    const origin = 'https://' + branch + '.example';
    const response = await app.fetch(new Request(origin + '/nakash/' + branch + '/manifest.webmanifest'));
    const manifest = await response.json();
    assert.deepEqual({...manifest, related_applications: original.related_applications}, original);
    assert.deepEqual(manifest.related_applications, [{platform: 'webapp', url: origin + manifest.scope + 'manifest.webmanifest', id: origin + manifest.id}]);
    assert.equal(new URL(manifest.start_url, origin).origin, origin);
    assert.equal(response.headers.get('ETag'), null);
    assert.equal(response.headers.get('Content-Length'), null);
    assert.equal(response.headers.get('Content-Encoding'), null);
  }
});

test('backend redirects stay within the family origin and external media URLs remain external', async () => {
  for (const target of [UPSTREAM + '/nakash/yehuda/?lang=he#tree', '/nakash/yehuda/?lang=he#tree', 'https://media.example/video.mp4']) {
    const app = familyApp('yehuda', () => Response.redirect(target.startsWith('/') ? UPSTREAM + target : target, 307));
    const response = await app.fetch(new Request('https://yehuda.example/nakash/yehuda'));
    assert.equal(response.status, 307);
    assert.equal(response.headers.get('Location'), target.includes('media.example') ? target : 'https://yehuda.example/nakash/yehuda/?lang=he#tree');
  }
});
