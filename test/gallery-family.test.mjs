import{test}from'node:test';import assert from'node:assert/strict';
import family from'../src/family.mjs';import{familyMemberIds,familyOptions}from'../public/assets/gallery-family.mjs';import{crc32,zipStream}from'../src/zip.mjs';

test('all six second-generation families narrow third and fourth generation options without crossing branches',()=>{
 assert.equal(familyOptions(family,2).length,6);
 assert.deepEqual(new Set(familyOptions(family,3,'u-harizi').map(u=>u.id)),new Set(['u-rivi','u-hila','u-roi']));
 assert.deepEqual(new Set(familyMemberIds(family,'u-matan-g')),new Set(['matan-g','camille','shay','leni','itay']));
 const moran=new Set(familyMemberIds(family,'u-moran'));for(const id of ['moran','maya','yuli','omer','max'])assert.ok(moran.has(id));for(const id of ['tomer','tedi','ruti'])assert.equal(moran.has(id),false);
 assert.ok(familyOptions(family,4,'u-rivi').some(u=>u.id==='u-matan-g'));assert.ok(!familyOptions(family,4,'u-moran').some(u=>u.id==='u-matan-g'));
 const extra=structuredClone(family);extra.people.extra={id:'extra',parents:['moran']};assert.ok(familyMemberIds(extra,'u-fish').includes('extra'));
});
test('ZIP CRC supports incremental streams, cancellation stops opening later files, and a missing file fails the archive',async()=>{
 const bytes=new TextEncoder().encode('123456789');assert.equal(crc32(bytes),0xcbf43926);assert.equal(crc32(bytes.subarray(4),crc32(bytes.subarray(0,4))),0xcbf43926);
 const opened=[],entries=[0,1].map(i=>({name:'photo.jpg',open:async()=>{opened.push(i);return new Response(new Uint8Array([1,2,3]));}}));
 const reader=zipStream(entries).getReader();await reader.read();await reader.cancel();assert.deepEqual(opened,[0]);
 await assert.rejects(()=>new Response(zipStream([{name:'missing.jpg',open:async()=>new Response(null,{status:404})}])).arrayBuffer(),/unavailable/);
});
