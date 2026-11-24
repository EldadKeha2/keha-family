import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseHTML } from 'linkedom';
import { journeyFilm } from '../src/journey-films.mjs';

const site = 'https://family.test';
const assets = new URL('../public/aliyah/', import.meta.url);
const html = (path) => readFile(new URL(path, assets), 'utf8');

test('each film opens on its own page with the right edition, two caption tracks and a folder backlink', async () => {
  const { document: folder } = parseHTML(await html('index.html'));
  assert.equal(folder.querySelectorAll('.film-card').length, 2);
  for (const [id, version] of [
    ['shlomo', 4],
    ['yona', 2],
  ]) {
    assert.ok(folder.querySelector(`a.film-card[href="/aliyah/${id}/"]`));
    const { document: page } = parseHTML(await html(`${id}/index.html`));
    const player = page.querySelector('video');
    assert.equal(
      player.getAttribute('src'),
      `/api/journey-films/${id}/${version}`,
    );
    assert.ok(page.querySelector('a[href="/aliyah/"]'));
    assert.ok(
      page
        .querySelector('a[download]')
        .getAttribute('href')
        .startsWith(player.getAttribute('src')),
    );
    assert.equal(player.querySelectorAll('track').length, 2);
    const cues = JSON.parse(await html(`${id}-cues.json`));
    for (const [index, lang] of ['he', 'en'].entries()) {
      const vtt = await html(`${id}.${lang}.vtt`);
      assert.ok(player.querySelector(`track[srclang="${lang}"]`));
      assert.equal(vtt.split(' --> ').length - 1, cues.length);
      assert.ok(
        cues.every(
          (cue, n) =>
            cue[index + 2] &&
            cue[1] > cue[0] &&
            (!n || cue[0] >= cues[n - 1][1]),
        ),
      );
    }
    if (id === 'shlomo') {
      assert.equal(cues[0][0], 10);
      assert.equal(cues[1][1], 24);
      for (const wording of ['מלפנים ומאחור', 'על חמורים']) {
        assert.ok(cues.some((c) => c[4] === 'voice' && c[2].includes(wording)));
      }
      const wedding = cues.find((c) => c[2].includes('נישאו'));
      const ages = cues.find((c) => c[2].includes('בן 31') && c[2].includes('בת 17'));
      const family = cues.at(-1);
      assert.ok(wedding[1] <= ages[0] && ages[1] <= family[0]);
      assert.match(family[2], /1942/);
      assert.ok(cues.find((c) => c[4] === 'voice')[0] > 20);
    }
  }
});

test('edition streaming forwards byte ranges and rejects an unexpected publication without touching storage', async (t) => {
  const env = {
    HF_NAMESPACE: 'family',
    HF_BUCKET: 'films',
    HF_ACCESS_KEY_ID: 'example',
    HF_SECRET_ACCESS_KEY: 'example',
  };
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (req) => {
    calls++;
    assert.equal(req.method, 'GET');
    assert.equal(req.headers.get('Range'), 'bytes=0-3');
    return new Response(new Uint8Array([0, 0, 0, 32]), {
      status: 206,
      headers: { 'Content-Length': '4', 'Content-Range': 'bytes 0-3/19373845' },
    });
  });
  const path = '/api/journey-films/shlomo/3';
  const r = await journeyFilm(
    new Request(site + path + '?download=1', {
      headers: { Range: 'bytes=0-3' },
    }),
    env,
    'shlomo/3',
  );
  assert.equal(r.status, 206);
  assert.equal(r.headers.get('Content-Type'), 'video/mp4');
  assert.match(r.headers.get('Content-Disposition'), /Shlomo/);
  assert.equal((await r.arrayBuffer()).byteLength, 4);
  await assert.rejects(
    journeyFilm(
      new Request(site + path, {
        method: 'POST',
        body: 'no',
        headers: { 'Content-Length': '2' },
      }),
      env,
      'shlomo/3',
    ),
    { status: 400 },
  );
  await assert.rejects(
    journeyFilm(new Request(site + path), env, 'shlomo/999'),
    { status: 404 },
  );
  assert.equal(calls, 1);
});
