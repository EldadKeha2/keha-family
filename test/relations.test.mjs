import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import family from '../src/family.mjs';

const window={};
vm.runInNewContext(await readFile(new URL('../public/assets/relations.js',import.meta.url),'utf8'),{window});
const relatives=(id,data=family)=>JSON.parse(JSON.stringify(window.FamilyRelations.forPerson(data,id)));

test('grandparents link to their partner and six children, excluding their children’s partners',()=>{
  assert.deepEqual(relatives('yona'),{partners:['shlomo'],parents:[],children:['ruti','becker-parent','yehiel','avigail','ora','shosh'],siblings:[]});
  assert.deepEqual(relatives('shlomo').children,relatives('yona').children);
});
test('Elisheva has her own siblings and children from the existing tree',()=>{
  assert.deepEqual(relatives('becker-parent'),{partners:['israel-becker'],parents:['yona','shlomo'],children:['yuval','tammy'],siblings:['ruti','yehiel','avigail','ora','shosh']});
});
test('a partner shares the children without inheriting their partner’s siblings',()=>{
  assert.deepEqual(relatives('rachel-katan'),{partners:['yehiel'],parents:[],children:['bosmat','eldad','naama'],siblings:['itzhak-katan']});
  assert.deepEqual(relatives('israel-becker'),{partners:['becker-parent'],parents:[],children:['yuval','tammy'],siblings:[]});
});
test('Eldad has Adi and his two siblings, with no children inferred',()=>{
  assert.deepEqual(relatives('eldad'),{partners:['adi'],parents:['yehiel','rachel-katan'],children:[],siblings:['bosmat','naama']});
  assert.deepEqual(relatives('adi'),{partners:['eldad'],parents:[],children:[],siblings:[]});
});
test('children and siblings work for Matan, Camille, and the next generation',()=>{
  assert.deepEqual(relatives('matan-g'),{partners:['camille'],parents:['rivi','gabi'],children:['shay','leni','itay'],siblings:['amit','yarden']});
  assert.deepEqual(relatives('camille'),{partners:['matan-g'],parents:[],children:['shay','leni','itay'],siblings:[]});
  assert.deepEqual(relatives('leni'),{partners:[],parents:['matan-g','camille'],children:[],siblings:['shay','itay']});
});
test('all family relationships contain existing distinct people and never the viewed person',()=>{
  for(const id of Object.keys(family.people))for(const values of Object.values(relatives(id))){
    assert.equal(values.length,new Set(values).size);
    assert.ok(!values.includes(id));
    for(const other of values)assert.ok(family.people[other]);
  }
});
test('unknown people and extra tagged albums do not acquire invented relationships',()=>{
  assert.deepEqual(relatives('missing'),{partners:[],parents:[],children:[],siblings:[]});
  assert.deepEqual(relatives('extra',{...family,people:{...family.people,extra:{id:'extra',extra:true}}}),{partners:[],parents:[],children:[],siblings:[]});
});
test('every known parent also lists the viewed person as a child',()=>{
  for(const id of Object.keys(family.people))for(const parent of relatives(id).parents){
    assert.ok(relatives(parent).children.includes(id),`${parent} must be a parent of ${id}`);
  }
});
test('additional relatives appear only as the explicitly linked person’s sibling',()=>{
  assert.deepEqual(relatives('itzhak-katan'),{partners:[],parents:[],children:[],siblings:['rachel-katan']});
  assert.deepEqual(relatives('natan-fish'),{partners:[],parents:[],children:['keren-fish','sivan-fish','sharon-fish'],siblings:['eddie']});
  assert.deepEqual(relatives('eddie').siblings,['natan-fish']);
  for(const id of ['eldad','yehiel','ora','yona'])assert.ok(!relatives(id).siblings.some(id=>['itzhak-katan','natan-fish'].includes(id)));
});
test('Natan Fish’s three daughters are distinct additional relatives with one known father',()=>{
 const daughters=['keren-fish','sivan-fish','sharon-fish'];
 const names=[['קרן פיש','Keren Fish'],['סיוון פיש','Sivan Fish'],['שרון פיש','Sharon Fish']];
 for(const [index,id] of daughters.entries()){
  assert.deepEqual(relatives(id),{partners:[],parents:['natan-fish'],children:[],siblings:daughters.filter(other=>other!==id)});
  const person=family.people[id];assert.equal(person.name,names[index][0]);assert.equal(person.nameEn,names[index][1]);
  assert.equal(person.extended,true);assert.equal(person.gender,'f');assert.equal(person.unit,undefined);
  assert.equal(person.birthday,'1.1.1111','Unknown birthdays retain the existing unknown-date marker');
  assert.ok(!Object.values(family.units).some(unit=>unit.people.includes(id)),'Additional relatives do not alter the main tree');
 }
 assert.equal(family.people.sharon.name,'שרון דיין','Sharon Fish does not overwrite Sharon Dayan');
 assert.equal(family.people.sharon.gender,'m');assert.equal(family.people['sharon-fish'].gender,'f');
 assert.deepEqual(relatives('eddie').children,['tidhar','moran','tomer','amir'],'Natan’s daughters are not children of his brother');
});
test('Robin and her children are additional relatives with only the explicitly supplied parents',()=>{
 assert.deepEqual(relatives('robin'),{partners:[],parents:['mark'],children:['matthew-robin','lily'],siblings:['ilan','raya','orit']});
 assert.deepEqual(relatives('matthew-robin'),{partners:[],parents:['robin'],children:[],siblings:['lily']});
 assert.deepEqual(relatives('lily'),{partners:[],parents:['robin'],children:[],siblings:['matthew-robin']});
 assert.deepEqual(relatives('mark').children,['ilan','raya','orit','robin']);assert.deepEqual(relatives('shosh').children,['ilan','raya','orit']);
 for(const id of ['ilan','raya','orit'])assert.ok(relatives(id).siblings.includes('robin'));
 for(const id of ['robin','matthew-robin','lily']){assert.equal(family.people[id].extended,true);assert.equal(family.people[id].unit,undefined);}
});
