import {test} from 'node:test';
import assert from 'node:assert/strict';
import family from '../src/family.mjs';
import {correctNamedContent,matchingPeople} from '../src/name-corrections.mjs';

test('the surname correction changes display text while preserving storage references and other Harizi relatives',()=>{
  const source={id:'Roei_Harizi',key:'photos/רועי_חריזי.jpg',file:'Roei_Harizi.jpg',folder:'020_רועי_חריזי',url:'https://example.com/Roei_Harizi',filename:'רועי_חריזי.jpg',caption:'עם רועי חריזי ורותי חריזי',aboutEn:'Roei Harizi and Ruth Harizi',options:['Roi Harizi','Ruth Harizi'],faces:[{personId:'roi',rect:{x:.1,y:.2,width:.3,height:.4}}]};
  const result=correctNamedContent(source);
  assert.equal(result.caption,'עם רועי אלחריזי ורותי חריזי');assert.equal(result.aboutEn,'Roei Elharizi and Ruth Harizi');assert.equal(result.filename,'רועי_אלחריזי.jpg');assert.deepEqual(result.options,['Roei Elharizi','Ruth Harizi']);
  for(const key of ['id','key','file','folder','url','faces'])assert.deepEqual(result[key],source[key]);
  assert.deepEqual(correctNamedContent(result),result);assert.equal(source.caption,'עם רועי חריזי ורותי חריזי');
  assert.equal(correctNamedContent({caption:'Roei Harizian'}).caption,'Roei Harizian');
});

test('old and current names resolve to the stable Roi ID without selecting a duplicate extra person',()=>{
  const roster=[{id:'extra-old',name:'רועי חריזי'},family.people.roi,family.people.ruti];
  assert.equal(family.people.roi.name,'רועי אלחריזי');assert.equal(family.people.roi.lastName,'אלחריזי');assert.equal(family.people.roi.nameEn,'Roei Elharizi');
  for(const name of ['רועי חריזי','רועי אלחריזי','Roei Harizi','Roi Harizi','  ROEI   ELHARIZI ','Roi Elharizi'])assert.deepEqual(matchingPeople(roster,name).map(person=>person.id),['roi']);
  assert.deepEqual(matchingPeople(roster,'Ruth Harizi').map(person=>person.id),['ruti']);
});
