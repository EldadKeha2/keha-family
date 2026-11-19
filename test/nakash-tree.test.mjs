import assert from 'node:assert/strict';
import {access, readFile} from 'node:fs/promises';
import {test} from 'node:test';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
import keha from '../src/family.mjs';
import {BRANCHES, createFamily, findPeople} from '../public/nakash/family-data.mjs';
import {renderDirectory, renderProfile, renderTree} from '../public/nakash/tree-view.mjs';

const publicRoot = new URL('../public/', import.meta.url);
const html = await readFile(new URL('nakash/index.html', publicRoot), 'utf8');
const script = (await readFile(new URL('nakash/site.mjs', publicRoot), 'utf8'))
  .replace(/^import .+;\n/gm, '');
const origin = 'https://family.example';
const flush = () => new Promise(resolve => setImmediate(resolve));

async function portal(path, referrer = '') {
  const {window, document} = parseHTML(html);
  const location = new URL(path, origin);
  const requests = [];
  const shares = [];
  Object.defineProperty(document, 'referrer', {value: referrer});
  vm.runInNewContext(script, {
    window, document, location, URL, navigator: {share: async payload => shares.push(payload)},
    BRANCHES, createFamily, findPeople, renderDirectory, renderProfile, renderTree,
    fetch: async path => {
      requests.push(path);
      // The legacy family fixture intentionally contains more than the public
      // projection. Verify those fields are also omitted by the display layer.
      return {ok: true, json: async () => ({keha})};
    },
  }, {filename: 'nakash/site.mjs'});
  await flush();
  const view = document.querySelector('#view');
  return {
    document,
    view,
    requests,
    shares,
    route(hash) {
      location.hash = hash;
      window.dispatchEvent(new window.Event('hashchange'));
    },
    search(query) {
      const input = document.querySelector('#search-input');
      input.value = query;
      input.dispatchEvent(new window.Event('input'));
      return Array.from(document.querySelectorAll('#search-results a'), link => link.getAttribute('href'));
    },
  };
}

function showsKehaReturn(page) {
  const link = page.document.querySelector('#back-keha');
  return Boolean(link && !link.hidden && link.hasAttribute('href'));
}

test('direct Nakash pages keep the branch identity and display the shared genealogy without legacy private fields', async () => {
  const page = await portal('/nakash/medina/');
  assert.equal(page.document.querySelector('#brand-name').textContent, 'משפחת מדינה');
  assert.equal(showsKehaReturn(page), false);
  assert.deepEqual(page.requests, ['/nakash/api/family']);
  const parentNames = Array.from(page.view.querySelectorAll('.nk-chart > .nk-couple .nk-person-name'), element => element.textContent);
  assert.deepEqual(parentNames, ['מרגלית נקאש', 'זכריה נקאש']);
  const branchCouples = Array.from(page.view.querySelectorAll('.nk-overview-branch'), couple =>
    Array.from(couple.querySelectorAll('.nk-person-name'), member => member.textContent));
  assert.deepEqual(branchCouples, [['רומה נקאש', 'יוסף מדינה'], ['יונה נקאש קהא', 'שלמה קהא'], ['יהודה נקאש', 'זהור'], ['חיים נקאש', 'שושנה']]);
  assert.deepEqual(page.search('Joseph'), ['/nakash/medina/#person/joseph-medina']);
  assert.deepEqual(page.search('אבנר'), []);

  const examples = [
    ['medina', 'roni-medina', ['רוני מדינה', 'לאה']],
    ['haim', 'avner-nakash', ['אבנר נקאש', 'רבקה נקאש']],
    ['yehuda', 'naomi-malkhi', ['נעמי מלכי', 'שלום מלכי']],
  ];
  for (const [branch, personId, names] of examples) {
    page.route('#tree/' + branch);
    assert.deepEqual(Array.from(page.view.querySelectorAll('.nk-tree-generation .nk-person-name'), name => name.textContent), names);
    assert.ok(page.view.querySelector(`a[href="/nakash/medina/#person/${personId}"]`));
  }
  page.route('#person/roni-medina');
  assert.match(page.view.textContent, /בני זוג לשעבר.*לאה/);
  assert.match(page.view.textContent, /אין ילדים משותפים/);
  page.route('#people');
  assert.ok(page.view.querySelector('a[href="/nakash/medina/#person/avner-nakash"]'));
  assert.ok(page.view.querySelector('a[href="/nakash/medina/#person/ruti"]'));
  page.route('#person/ruti');
  assert.equal(page.view.querySelector('h1').textContent, keha.people.ruti.name);
  assert.ok(page.view.querySelector('a[href="/nakash/medina/#tree/keha"]'));
  assert.ok(!page.view.innerHTML.includes(keha.people.ruti.folder));
  assert.ok(!page.view.textContent.includes(keha.people.ruti.birthday));
  assert.ok(!Object.hasOwn(createFamily(keha).people, 'robin'), 'Extended people outside the shared tree do not become public profiles');

  for (const branch of [null, ...BRANCHES]) {
    const path = '/nakash/' + (branch ? `${branch.id}/` : '');
    const manifestPath = path + 'manifest.webmanifest';
    const manifest = JSON.parse(await readFile(new URL(manifestPath.slice(1), publicRoot), 'utf8'));
    assert.equal(manifest.id, path);
    assert.equal(manifest.scope, path);
    assert.equal(manifest.start_url, path);
    assert.equal(manifest.name, branch?.label || 'משפחת נקאש');
    assert.ok(manifest.icons.length);
    for (const icon of manifest.icons) {
      assert.ok(icon.src.startsWith(`/nakash/brand-${branch?.id || 'nakash'}`));
      await access(new URL(icon.src.slice(1), publicRoot));
    }
    const direct = await portal(path);
    assert.equal(direct.document.querySelector('link[rel="manifest"]').getAttribute('href'), manifestPath);
    assert.equal(direct.document.querySelector('#brand-name').textContent, manifest.name);
    assert.equal(showsKehaReturn(direct), false);
  }

  const inside = await portal('/nakash/inside/#tree/haim', origin + '/');
  assert.equal(showsKehaReturn(inside), true);
  assert.ok(inside.view.querySelector('a[href="/nakash/inside/#person/avner-nakash"]'));
  inside.document.querySelector('#share').click();
  await flush();
  assert.equal(inside.shares[0].url, origin + '/nakash/#tree/haim');
  const shared = await portal(new URL(inside.shares[0].url).pathname + '#tree/haim', 'https://elsewhere.example/');
  assert.equal(showsKehaReturn(shared), false);
  assert.ok(shared.view.querySelector('a[href="/nakash/#person/avner-nakash"]'));
});
