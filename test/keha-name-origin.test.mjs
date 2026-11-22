import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
import {extendedKehaHTML, shlomoKehaHTML, branchPortalHTML} from '../src/extended-keha.mjs';
import {nakashHTML} from '../src/nakash-shell.mjs';
import {BRANCH_PORTALS} from '../public/keha-extended/branch-portals.mjs';

const read = path => readFile(new URL('../public/' + path, import.meta.url), 'utf8');
const original = await read('index.html');
const home = '/keha-extended/';
const article = await read('keha-extended/name-origin/index.html');
const shareCode = await read('keha-extended/name-origin/share.js');
const canonical = 'https://family-extended.eldadkeha.workers.dev/keha-extended/name-origin/';

test('the article is a scoped tab and every branch can open the same static page inside its app', async () => {
  const shells = [
    [home, extendedKehaHTML(original)],
    [home + 'shlomo/', shlomoKehaHTML(original)],
    ...Object.values(BRANCH_PORTALS).map(portal => [portal.home, branchPortalHTML(original, portal.id)]),
  ];
  for (const [branch, shell] of shells) {
    const {document} = parseHTML(shell);
    const link = document.querySelector('#mainNav #nameOriginTab');
    assert.equal(link.textContent, 'מקור השם קהא');
    assert.equal(link.getAttribute('href'), branch + 'name-origin/');
    assert.equal(await read(branch.slice(1) + 'name-origin/index.html'), article);
    const roots = document.querySelector('#storiesView #storyNameOriginSource a');
    if (branch === home + 'shlomo/') assert.equal(roots.getAttribute('href'), link.getAttribute('href') + '#stories');
    else assert.equal(roots, null);
  }
  for (const shell of [original, nakashHTML(original, 'keha'), nakashHTML(original, 'haim')]) {
    assert.equal(parseHTML(shell).document.getElementById('nameOriginTab'), null);
  }
});

function sharePage(browser) {
  const {document} = parseHTML(article);
  const input = document.querySelector('.share-address');
  let selected = false;
  input.select = () => { selected = true; };
  vm.runInNewContext(shareCode, {document, navigator:browser});
  return {document, input, selected:() => selected};
}

test('all familiar share channels target the published article and retain a manual copy fallback', async () => {
  const sent = [], copied = [];
  const {document, input} = sharePage({share:async data => sent.push(data), clipboard:{writeText:async url => copied.push(url)}});
  assert.equal(document.querySelector('link[rel=canonical]').getAttribute('href'), canonical);
  assert.equal(document.querySelector('meta[property="og:url"]').getAttribute('content'), canonical);
  assert.doesNotMatch(article, /chatgpt\.com\/library|טיוטה משפחתית פרטית/);
  assert.equal(new URL(document.querySelector('[data-channel=facebook]').getAttribute('href')).searchParams.get('u'), canonical);
  for (const [channel, key] of [['whatsapp','text'],['email','body']]) {
    assert.ok(new URL(document.querySelector('[data-channel=' + channel + ']').getAttribute('href')).searchParams.get(key).includes(canonical));
  }
  for (const channel of ['messenger','instagram']) {
    const link = document.querySelector('[data-channel=' + channel + ']');
    assert.match(link.href, /messages|direct\/inbox/);
    link.click();
  }
  document.querySelector('[data-share-copy]').click();
  const native = document.querySelector('[data-share-native]');
  assert.equal(native.hidden, false);
  native.click();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(copied, [canonical, canonical, canonical]);
  assert.equal(sent[0].url, canonical);
  assert.equal(sent[0].title, 'מקור השם קהא');
  assert.equal(input.hidden, true);
  const fallback = sharePage({});
  assert.equal(fallback.document.querySelector('[data-share-native]').hidden, true);
  fallback.document.querySelector('[data-share-copy]').click();
  assert.equal(fallback.input.hidden, false);
  assert.equal(fallback.input.value, canonical);
  assert.equal(fallback.selected(), true);
});
