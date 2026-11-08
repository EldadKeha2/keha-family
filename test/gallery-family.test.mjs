import{test}from'node:test';import assert from'node:assert/strict';
import family from'../src/family.mjs';import{familyMemberIds,familyOptions,familyLabel}from'../public/assets/gallery-family.mjs';import{galleryRefinement,galleryRevision}from'../src/gallery.mjs';import{crc32,zipStream}from'../src/zip.mjs';

test('all six second-generation families narrow third and fourth generation options without crossing branches',()=>{
 assert.equal(familyOptions(family,2).length,6);
 assert.deepEqual(new Set(familyOptions(family,3,'u-harizi').map(u=>u.id)),new Set(['u-rivi','u-hila']));
 assert.deepEqual(new Set(familyMemberIds(family,'u-matan-g')),new Set(['matan-g','camille','shay','leni','itay']));
 const moran=new Set(familyMemberIds(family,'u-moran'));for(const id of ['moran','maya','yuli','omer','max'])assert.ok(moran.has(id));for(const id of ['tomer','tedi','ruti'])assert.equal(moran.has(id),false);
 assert.ok(familyOptions(family,4,'u-rivi').some(u=>u.id==='u-matan-g'));assert.ok(!familyOptions(family,4,'u-moran').some(u=>u.id==='u-matan-g'));
 const extra=structuredClone(family);extra.people.extra={id:'extra',parents:['moran']};assert.ok(familyMemberIds(extra,'u-fish').includes('extra'));
});
test('family choices in every generation exclude single people and use the primary member’s full name',()=>{
 for(const generation of [2,3,4]){
  const sample=structuredClone(family);
  sample.units['u-single']={id:'u-single',generation,people:['yarden'],children:[]};
  sample.units['u-parent']={id:'u-parent',generation,people:['matan-g'],children:['u-shay']};
  sample.units['u-partner']={id:'u-partner',generation,people:['eldad','adi'],children:[]};
  sample.units['u-linked-parent']={id:'u-linked-parent',generation,people:['robin'],children:[]};
  sample.units['u-placeholder']={id:'u-placeholder',generation,people:['yarden','unknown'],children:[]};
  sample.people.unknown={id:'unknown',placeholder:true};
  const ids=familyOptions(sample,generation).map(u=>u.id);
  assert.ok(!ids.includes('u-single'));assert.ok(!ids.includes('u-placeholder'));
  for(const id of ['u-parent','u-partner','u-linked-parent'])assert.ok(ids.includes(id),id);
 }
 assert.equal(familyLabel(family,family.units['u-matan-g']),'המשפחה של מתן גנדלמן');
 assert.equal(familyLabel(family,family.units['u-matan-g'],p=>p.nameEn,true),'Family of Matan Gandelman');
});
test('multiple people and families form a unique union and stable revisions regardless of selection order',()=>{
 const options={person:'yona,shay,yona',unit:'u-rivi,u-matan-g,u-moran,u-rivi'},result=galleryRefinement(options);
 assert.equal(result.person,'shay,yona');assert.equal(result.unit,'u-matan-g,u-moran,u-rivi');
 for(const id of ['yona','shay','matan-g','camille','rivi','gabi','moran','maya'])assert.ok(result.members.includes(id),id);
 assert.equal(result.members.length,new Set(result.members).size);
 const reordered={person:'shay,yona',unit:'u-moran,u-matan-g,u-rivi'};
 assert.equal(galleryRevision('v',options),galleryRevision('v',reordered));
 assert.notEqual(galleryRevision('v',options),galleryRevision('v',{...options,person:'yona'}));
 for(const unit of ['u-roi','u-naama','u-yarden'])assert.throws(()=>galleryRefinement({unit}),error=>error.status===400);
});
test('ZIP CRC supports incremental streams, cancellation stops opening later files, and a missing file fails the archive',async()=>{
 const bytes=new TextEncoder().encode('123456789');assert.equal(crc32(bytes),0xcbf43926);assert.equal(crc32(bytes.subarray(4),crc32(bytes.subarray(0,4))),0xcbf43926);
 const opened=[],entries=[0,1].map(i=>({name:'photo.jpg',open:async()=>{opened.push(i);return new Response(new Uint8Array([1,2,3]));}}));
 const reader=zipStream(entries).getReader();await reader.read();await reader.cancel();assert.deepEqual(opened,[0]);
 await assert.rejects(()=>new Response(zipStream([{name:'missing.jpg',open:async()=>new Response(null,{status:404})}])).arrayBuffer(),/unavailable/);
});
