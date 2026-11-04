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
  assert.deepEqual(relatives('rachel-katan'),{partners:['yehiel'],parents:[],children:['bosmat','eldad','naama'],siblings:[]});
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
