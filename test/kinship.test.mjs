import {test} from 'node:test';
import assert from 'node:assert/strict';
import family from '../src/family.mjs';
import {kinshipRelation,kinshipPool,makeKinshipQuiz} from '../public/assets/kinship.mjs';

test('the requested cousin and aunt’s-grandson examples have the correct direction',()=>{
  assert.equal(kinshipRelation(family,'rivi','eldad').name,'בת דודה');
  assert.equal(kinshipRelation(family,'eldad','rivi').name,'בן דוד');
  for(const id of ['yonatan-d','yonatan-f'])assert.equal(kinshipRelation(family,id,'eldad').name,'נכד של דודה');
  assert.equal(kinshipRelation(family,'eldad','yonatan-d').name,'בן דוד של אמא');
  assert.equal(kinshipRelation(family,'eldad','yonatan-f').name,'בן דוד של אבא');
});
test('parents, children, siblings, partners, grandparents, aunts, and nephews use known tree links',()=>{
  for(const [a,b,label]of [['rachel-katan','eldad','אמא'],['yehiel','eldad','אבא'],['eldad','rachel-katan','בן'],['bosmat','eldad','אחות'],['adi','eldad','בת זוג'],['shlomo','eldad','סבא'],['eldad','shlomo','נכד'],['ruti','eldad','דודה'],['eldad','ruti','אחיין'],['itzhak-katan','eldad','דוד'],['natan-fish','amir','דוד']])assert.equal(kinshipRelation(family,a,b).name,label,a+' / '+b);
  assert.equal(kinshipRelation(family,'rachel-katan','rivi').name,'בת זוג של דוד');
  assert.equal(kinshipRelation(family,'missing','eldad'),null);assert.equal(kinshipRelation(family,'eldad','eldad'),null);
});
test('more distant generations and affinity remain specific rather than inheriting a partner’s blood relation',()=>{
  assert.equal(kinshipRelation(family,'shlomo','naomi').name,'סבא רבא');
  assert.equal(kinshipRelation(family,'naomi','shlomo').name,'נינה');
  assert.equal(kinshipRelation(family,'adi','rivi').name,'בת זוג של בן דוד');
  assert.equal(kinshipRelation(family,'eldad','fiona').name,'בן דוד של בן הזוג');
  assert.equal(kinshipRelation(family,'avishai','rachel-katan'),null,'Do not guess relationships between the unrelated partners of siblings');
});
test('the question bank is large, excludes self-pairs and unknown people, and does not include Yona',()=>{
  const pool=kinshipPool(family);assert.ok(pool.length>1000);assert.equal(new Set(pool.map(q=>q.id)).size,pool.length);
  for(const q of pool){assert.notEqual(q.subjectId,q.referenceId);assert.ok(family.people[q.subjectId]);assert.ok(family.people[q.referenceId]);assert.ok(![q.subjectId,q.referenceId].includes('yona'));assert.ok(!family.people[q.subjectId].extended&&!family.people[q.referenceId].extended);}
});
test('every game has ten random unique pairs, four unambiguous choices, and a mix of difficulty levels',()=>{
  const pool=kinshipPool(family),labelStructures=new Map();
  for(const item of pool){const key=item.catalogKey+'|'+item.answer.name+'|'+item.answer.nameEn;if(!labelStructures.has(key))labelStructures.set(key,new Set());labelStructures.get(key).add(item.answer.structure);}
  const snapshots=[];
  for(let n=0;n<40;n++){
    const round=makeKinshipQuiz(family);assert.equal(round.length,10);assert.equal(new Set(round.map(q=>[q.subject.id,q.reference.id].sort().join('|'))).size,10);assert.deepEqual([0,1,2].map(level=>round.filter(q=>q.difficulty===level).length),[3,3,4]);
    for(const q of round){
      const correct=kinshipRelation(family,q.subject.id,q.reference.id),answer=q.options.find(a=>a.id===q.correctId),catalogKey=q.subject.gender+':'+correct.group;
      assert.equal(answer.name,correct.name);assert.equal(answer.nameEn,correct.nameEn);assert.equal(q.options.length,4);assert.equal(new Set(q.options.map(a=>a.id)).size,4);assert.equal(new Set(q.options.map(a=>a.name)).size,4);assert.equal(new Set(q.options.map(a=>a.nameEn)).size,4);
      for(const option of q.options.filter(a=>a.id!==q.correctId))assert.ok(!labelStructures.get(catalogKey+'|'+option.name+'|'+option.nameEn)?.has(correct.structure),'A gender variant of the same family path must never be a wrong answer');
    }
    snapshots.push(round.map(q=>q.id).join('|'));
  }
  assert.ok(new Set(snapshots).size>1);
});
test('profile photos and names are reused without exposing other profile content or modifying the family',()=>{
  const before=JSON.stringify(family),profiles=Object.fromEntries(Object.keys(family.people).map(id=>[id,{profile:'/media/'+id,about:'PRIVATE BIOGRAPHY'}]));
  for(const q of makeKinshipQuiz(family,profiles)){assert.equal(q.subject.profile,'/media/'+q.subject.id);assert.equal(q.reference.profile,'/media/'+q.reference.id);assert.ok(!JSON.stringify(q).includes('PRIVATE BIOGRAPHY'));}
  assert.equal(JSON.stringify(family),before);
});
