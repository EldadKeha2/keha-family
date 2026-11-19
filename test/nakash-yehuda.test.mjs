import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
import {createFamily, findPeople, branchForPerson} from '../public/nakash/family-data.mjs';
import {toOriginalFamilyData} from '../public/nakash/tree-data-adapter.mjs';
import {nakashHTML} from '../src/nakash-shell.mjs';

const family = toOriginalFamilyData(createFamily());
const [html, appSource, relationsSource, peopleSource] = await Promise.all([
  'public/index.html', 'public/assets/app.js', 'public/assets/relations.js', 'public/assets/people.js',
].map(path => readFile(new URL('../' + path, import.meta.url), 'utf8')));
const window = {};
vm.runInNewContext(relationsSource, {window});
const relatives = id => JSON.parse(JSON.stringify(window.FamilyRelations.forPerson(family, id)));
const households = [
  ['naomi-malkhi', 'shalom-malkhi', ['ofir-malkhi', 'ravit-malkhi', 'golan-malkhi']],
  ['yechiel-nakash', 'claudia-nakash', ['natalia-nakash', 'talia-nakash', 'michel-nakash']],
  ['moshe-nakash', 'eti-nakash', ['yehuda-moshe-nakash', 'keren-nakash']],
  ['yigal-nakash', 'sara-nakash', ['sharon-nakash', 'anati-nakash', 'dror-nakash']],
  ['margalit-rajwan', 'yehoram-rajwan', ['eyal-rajwan', 'ohad-rajwan', 'hila-rajwan', 'ortal-rajwan']],
  ['yifat-handels', 'mark-handels', ['shani-handels', 'shnir-haim-handels', 'elior-handels']],
  ['rafi-nakash', 'ahuva-nakash', ['tomer-nakash', 'zohar-nakash', 'dana-nakash']],
];

test('Yehuda has exactly the seven named children in order, with spouses and 21 grandchildren connected to their own parents', () => {
  const siblings = households.map(([id]) => id);
  assert.deepEqual(relatives('yehuda-nakash').children, siblings);
  assert.deepEqual(relatives('zehor').children, siblings);
  assert.equal(households.flatMap(([, , children]) => children).length, 21);
  for (const [id, spouse, children] of households) {
    assert.deepEqual(relatives(id).parents, ['yehuda-nakash', 'zehor']);
    assert.deepEqual(relatives(id).siblings, siblings.filter(other => other !== id));
    assert.deepEqual(relatives(spouse).parents, [], 'Spouses do not become children of Yehuda');
    assert.deepEqual(relatives(id).children, children);
    assert.deepEqual(relatives(spouse).children, children);
    for (const child of children) {
      assert.deepEqual(relatives(child).parents, [id, spouse]);
      assert.deepEqual(relatives(child).siblings, children.filter(other => other !== child));
      assert.deepEqual(relatives(child).children, []);
      assert.deepEqual(family.units[family.people[child].unit].people, [child], 'Each grandchild can receive their own next generation');
    }
  }
  assert.equal(family.people['yechiel-nakash'].deceased, true);
  assert.equal(family.people['shnir-haim-handels'].firstName, 'שניר חיים');
  assert.equal(family.people['shnir-haim-handels'].lastName, 'הנדלס');
});

test('Rafi has a current wife and an ex-wife, with only Rafi and Ahuva parenting their children', () => {
  assert.deepEqual(relatives('rafi-nakash').partners, ['orly-nakash']);
  assert.deepEqual(relatives('rafi-nakash').formerPartners, ['ahuva-nakash']);
  assert.deepEqual(relatives('ahuva-nakash').partners, []);
  assert.deepEqual(relatives('ahuva-nakash').formerPartners, ['rafi-nakash']);
  assert.deepEqual(relatives('orly-nakash').partners, ['rafi-nakash']);
  assert.deepEqual(relatives('orly-nakash').formerPartners, []);
  assert.deepEqual(relatives('orly-nakash').children, []);
  for (const child of ['tomer-nakash', 'zohar-nakash', 'dana-nakash']) {
    assert.deepEqual(relatives(child).parents, ['rafi-nakash', 'ahuva-nakash']);
  }
  for (const id of Object.keys(family.people)) {
    for (const parent of relatives(id).parents) assert.ok(relatives(parent).children.includes(id));
  }
});

test('all new profiles are scoped and searchable, and the two Yehudas keep different identities', () => {
  const roster = createFamily();
  for (const [id, spouse, children] of households) {
    for (const member of [id, spouse, ...children]) {
      assert.equal(branchForPerson(roster, member), 'yehuda');
      assert.ok(findPeople(roster, roster.people[member].name, 'yehuda').some(person => person.id === member));
    }
  }
  assert.deepEqual(new Set(findPeople(roster, 'יהודה נקאש', 'yehuda').map(person => person.id)), new Set(['yehuda-nakash', 'yehuda-moshe-nakash']));
  for (const query of ['רפי נקאש', 'רפאל נקאש', 'Rafi Nakash', 'Rafael Nakash']) {
    assert.equal(findPeople(roster, query, 'yehuda')[0].id, 'rafi-nakash');
  }
  assert.ok(!findPeople(roster, 'רפי נקאש', 'haim').length);
});

function browserFixture({phone = false, english = false, profile} = {}) {
  const {document, window: dom} = parseHTML(nakashHTML(html, 'yehuda'));
  const location = {hash: profile ? '#person/' + profile : '#tree/yehuda', search: '', origin: 'https://family.example'};
  const window = {FAMILY_DATA: family, addEventListener(){}, dispatchEvent(){}, scrollTo(){}};
  window.FamilyI18n = {isEnglish: english, language: english ? 'en' : 'he', t: value => value,
    html: (parts, ...values) => parts.reduce((output, part, index) => output + part + (values[index] ?? ''), ''),
    personName: person => english ? person.nameEn : person.name, branchName: branch => branch?.title,
    searchNames: person => person.name, date: value => value, error: String,
    fetch: async () => Response.json({person: family.people[profile], revision: 'fixture',
      albums: Object.fromEntries(['photos', 'videos', 'documents'].map(key => [key, {items: [], page: 1, pages: 1, total: 0}]))}),
  };
  window.FamilyDates = {age: () => null, parse: () => null};
  const context = vm.createContext({document, window, location, history: {pushState(){}},
    matchMedia: query => ({matches: phone && query.includes('700px')}),
    requestAnimationFrame(){}, cancelAnimationFrame(){}, setInterval(){}, setTimeout, clearTimeout,
    innerWidth: phone ? 390 : 1280, innerHeight: 900, CustomEvent: dom.CustomEvent, URLSearchParams, URL});
  if (profile) {
    window.FamilyApp = {getPerson: id => family.people[id], getPersonSummary: id => family.people[id],
      nameOf: id => english ? family.people[id].nameEn : family.people[id].name, birthdayHTML: () => '',
      updatePerson(){}, getView: () => 'person', setView: view => window.FamilyPeople.activate(view)};
    vm.runInContext(relationsSource, context);
    vm.runInContext(peopleSource, context);
    document.dispatchEvent(new dom.Event('DOMContentLoaded'));
  } else {
    window.LOCAL_FAMILY_SERVER = false;
    vm.runInContext(appSource, context);
  }
  return document;
}

test('desktop and phone trees render every member once, with both unions labeled and space for the children', () => {
  for (const phone of [false, true]) for (const english of [false, true]) {
    const document = browserFixture({phone, english});
    assert.equal(document.querySelectorAll('#treeNodes [data-person]').length, 38);
    const unit = document.querySelector('[data-unit="u-nakash-rafi"]');
    assert.equal(unit.querySelectorAll('[data-person="rafi-nakash"]').length, 1);
    assert.match(unit.querySelector('[data-person-card="ahuva-nakash"]').textContent, english ? /Ex-wife and mother of his children/ : /גרושתו ואם ילדיו/);
    assert.match(unit.querySelector('[data-person-card="orly-nakash"]').textContent, english ? /Current wife/ : /אשתו כיום/);
    assert.equal(unit.querySelectorAll('.tree-partnerships path').length, 2);
    assert.equal(unit.querySelectorAll('.tree-partnerships .former').length, 1);
    assert.ok(parseFloat(unit.style.width) >= (phone ? 256 : 494));
    const child = document.querySelector('[data-unit="u-nakash-tomer"]');
    assert.ok(parseFloat(child.style.top) - parseFloat(unit.style.top) >= (phone ? 295 : 340));
    assert.ok(document.querySelector('[data-person-card="yechiel-nakash"].memorial'));
  }
});

test('personal pages show current and former partners separately and the children show only their parents', async () => {
  for (const english of [false, true]) {
    const document = browserFixture({profile: 'rafi-nakash', english});
    await new Promise(resolve => setImmediate(resolve));
    const partners = document.querySelector('[data-relative-kind="partners"]');
    const former = document.querySelector('[data-relative-kind="formerPartners"]');
    assert.deepEqual([...partners.querySelectorAll('[data-person]')].map(node => node.dataset.person), ['orly-nakash']);
    assert.deepEqual([...former.querySelectorAll('[data-person]')].map(node => node.dataset.person), ['ahuva-nakash']);
    assert.match(former.textContent, english ? /Former partner/ : /בן\/בת זוג לשעבר/);
  }
  const document = browserFixture({profile: 'tomer-nakash'});
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual([...document.querySelectorAll('[data-relative-kind="parents"] [data-person]')].map(node => node.dataset.person), ['rafi-nakash', 'ahuva-nakash']);
});
