import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
import {createFamily} from '../public/nakash/family-data.mjs';
import {toOriginalFamilyData} from '../public/nakash/tree-data-adapter.mjs';
import {nakashHTML} from '../src/nakash-shell.mjs';

const family = toOriginalFamilyData(createFamily());
const [html, appSource, relationsSource] = await Promise.all([
  'public/index.html', 'public/assets/app.js', 'public/assets/relations.js',
].map(path => readFile(new URL('../' + path, import.meta.url), 'utf8')));
const relationsWindow = {};
vm.runInNewContext(relationsSource, {window:relationsWindow});
const relatives = id => JSON.parse(JSON.stringify(relationsWindow.FamilyRelations.forPerson(family, id)));

test('Mor belongs to Avner and Yafa, his former wife; Rivka parents only Eliya and Neriya', () => {
  assert.deepEqual(relatives('mor-pazarkar').parents, ['avner-nakash', 'avner-former-wife']);
  assert.deepEqual(relatives('avner-former-wife').children, ['mor-pazarkar']);
  assert.equal(family.people['avner-former-wife'].name, 'יפה');
  assert.equal(family.people['avner-former-wife'].nameEn, 'Yafa');
  assert.notEqual(family.people['avner-former-wife'].placeholder, true);
  assert.deepEqual(relatives('mor-pazarkar').partners, ['hen-pazarkar']);
  assert.deepEqual(relatives('avner-nakash').partners, ['rivka-nakash']);
  assert.deepEqual(relatives('avner-nakash').formerPartners, ['avner-former-wife']);
  assert.deepEqual(relatives('rivka-nakash').children, ['eliya-nakash', 'neriya-nakash']);
  for (const id of ['eliya-nakash', 'neriya-nakash']) {
    assert.deepEqual(relatives(id).parents, ['avner-nakash', 'rivka-nakash']);
  }
  assert.deepEqual(relatives('mor-pazarkar').children, ['noam-pazarkar', 'michal-pazarkar', 'shira-pazarkar']);
  for (const id of relatives('mor-pazarkar').children) assert.deepEqual(relatives(id).parents, ['mor-pazarkar', 'hen-pazarkar']);
  assert.deepEqual(['noam-pazarkar', 'michal-pazarkar', 'shira-pazarkar'].map(id => family.people[id].gender), ['m', 'f', 'f']);
  for (const id of Object.keys(family.people)) for (const parent of relatives(id).parents) {
    assert.ok(relatives(parent).children.includes(id));
  }
});

test('Dalit and Baruch remain former partners and both parent Itai and Yahli', () => {
  assert.deepEqual(relatives('dalit-nir').partners, []);
  assert.deepEqual(relatives('dalit-nir').formerPartners, ['baruch-gaz']);
  for (const id of ['itai-gaz', 'yuli-gaz']) assert.deepEqual(relatives(id).parents, ['dalit-nir', 'baruch-gaz']);
});

function treeDocument(phone, english) {
  const {document, window:dom} = parseHTML(nakashHTML(html, 'haim'));
  const window = {FAMILY_DATA:family, LOCAL_FAMILY_SERVER:false, addEventListener(){}, dispatchEvent(){}, scrollTo(){}};
  window.FamilyI18n = {isEnglish:english, t:value=>value,
    html:(parts,...values)=>parts.reduce((output,part,index)=>output+part+(values[index]??''),''),
    personName:person=>english?person.nameEn:person.name, branchName:branch=>branch?.title,
    searchNames:person=>person.name, date:value=>value};
  window.FamilyDates = {age:()=>null, parse:()=>null};
  vm.runInNewContext(appSource, {document, window, location:{hash:'#tree/haim'}, history:{pushState(){}},
    matchMedia:query=>({matches:phone&&query.includes('700px')}), requestAnimationFrame(){}, cancelAnimationFrame(){},
    setInterval(){}, innerWidth:phone?390:1280, innerHeight:900, CustomEvent:dom.CustomEvent});
  return document;
}

test('each marriage has its own continuous connector to its children on desktop and phone in both languages', () => {
  for (const phone of [false, true]) for (const english of [false, true]) {
    const document = treeDocument(phone, english);
    const parent = document.querySelector('[data-unit="u-nakash-avner"]');
    assert.equal(parent.querySelectorAll('[data-person="avner-nakash"]').length, 1);
    const groups = [...document.querySelectorAll('#treeConnectors g[data-parent-unit="u-nakash-avner"]')];
    assert.equal(groups.length, 2);
    const former = groups.find(group=>group.dataset.parentPeople.includes('avner-former-wife'));
    const current = groups.find(group=>group.dataset.parentPeople.includes('rivka-nakash'));
    assert.equal(former.dataset.childUnits, 'u-nakash-mor');
    assert.equal(current.dataset.childUnits, 'u-nakash-eliya u-nakash-neriya');
    assert.notEqual(former.querySelector('circle').getAttribute('cx'), current.querySelector('circle').getAttribute('cx'));
    const formerD = former.querySelectorAll('path')[1].getAttribute('d');
    const currentD = current.querySelectorAll('path')[1].getAttribute('d');
    const [, left, y, right] = /^M([\d.]+) ([\d.]+)H([\d.]+)$/.exec(formerD);
    const child = document.querySelector('[data-unit="u-nakash-mor"]');
    const descendant=former.querySelector('path[data-child-unit="u-nakash-mor"]');
    assert.equal(descendant.dataset.childPerson,'mor-pazarkar','Avner’s line reaches his daughter Mor through her shared profile');
    const childX=Number(/^M(-?[\d.]+)/.exec(descendant.getAttribute('d'))[1]);
    const coupleMiddle=parseFloat(child.style.left)+parseFloat(child.style.width)/2;
    assert.ok(english?childX<coupleMiddle:childX>coupleMiddle,'The branch reaches Mor rather than the midpoint between her and Chen');
    const sourceX = Number(former.querySelector('circle').getAttribute('cx'));
    assert.equal(Number(left), Math.min(childX, sourceX));
    assert.equal(Number(right), Math.max(childX, sourceX));
    assert.notEqual(y, /^M[\d.]+ ([\d.]+)H/.exec(currentD)[1], 'Separate unions do not share a horizontal trunk');
    assert.equal(document.querySelectorAll('#treeNodes [data-person]').length, 36);
  }
});
