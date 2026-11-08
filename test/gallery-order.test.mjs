import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {galleryOrdering,galleryRevision} from '../src/gallery.mjs';

test('photo ordering uses upload time, partial capture dates and distinct people, with unknown dates last in both directions',()=>{
  const db=new DatabaseSync(':memory:');
  try{
    db.exec('CREATE TABLE media(id TEXT PRIMARY KEY,data TEXT);CREATE TABLE media_tags(media_id TEXT,person_id TEXT,PRIMARY KEY(media_id,person_id))');
    const photos=[['a','2022-01-01',{year:1980,month:5,day:10},3],['b','2020-01-01',{year:1980},1],['c','2024-01-01',{year:1990,month:6},0],['d','2010-01-01',{month:7,day:1},2],['e','2030-01-01',{year:1970},2]];
    for(const [id,createdAt,takenDate,count]of photos){db.prepare('INSERT INTO media VALUES(?,?)').run(id,JSON.stringify({createdAt,takenDate}));for(let n=0;n<count;n++)db.prepare('INSERT INTO media_tags VALUES(?,?)').run(id,'person'+n);}
    const result=sort=>{const order=galleryOrdering({sort});return db.prepare('SELECT m.id FROM media m ORDER BY '+order.sql).all(...order.args).map(row=>row.id);};
    assert.deepEqual(result('uploaded-asc'),['d','b','a','c','e']);assert.deepEqual(result('uploaded-desc'),['e','c','a','b','d']);
    assert.deepEqual(result('taken-asc'),['e','b','a','c','d']);assert.deepEqual(result('taken-desc'),['c','a','b','e','d']);
    assert.deepEqual(result('tags-asc'),['c','b','e','d','a']);assert.deepEqual(result('tags-desc'),['a','e','d','b','c']);
  }finally{db.close();}
});
test('seeded random ordering is stable across every page and metadata edits, and another seed reshuffles the whole gallery',()=>{
  const db=new DatabaseSync(':memory:');
  try{
    db.exec('CREATE TABLE media(id TEXT PRIMARY KEY,data TEXT)');for(let n=0;n<205;n++)db.prepare('INSERT INTO media VALUES(?,?)').run(String(n),'{}');
    const page=(seed,offset=0,size=100)=>{const order=galleryOrdering({sort:'random',seed});return db.prepare('SELECT m.id FROM media m ORDER BY '+order.sql+' LIMIT ? OFFSET ?').all(...order.args,size,offset).map(row=>row.id);};
    const first=page(101),all=[...first,...page(101,100),...page(101,200)];assert.equal(all.length,205);assert.equal(new Set(all).size,205);assert.deepEqual(page(101,0,500),all);
    assert.ok(new Set(all.slice(1).map((id,index)=>Number(id)-Number(all[index]))).size>20,'Sequential uploads should not remain in repeating strides');
    db.prepare('UPDATE media SET data=? WHERE id=?').run('{"caption":"changed"}','7');assert.deepEqual(page(101),first);assert.notDeepEqual(page(102),first);
  }finally{db.close();}
});
test('last-modified ordering includes legacy edits and falls back to upload dates with a stable tie break',()=>{
 const db=new DatabaseSync(':memory:');try{
  db.exec('CREATE TABLE media(id TEXT PRIMARY KEY,data TEXT)');
  for(const [id,data]of [['uploaded',{createdAt:'2020-01-01'}],['edited',{createdAt:'2010-01-01',updatedAt:'2022-01-01'}],['tagged',{createdAt:'2005-01-01',modifiedAt:'2025-01-01'}],['same',{createdAt:'2000-01-01',modifiedAt:'2025-01-01'}]])db.prepare('INSERT INTO media VALUES(?,?)').run(id,JSON.stringify(data));
  const ordered=sort=>db.prepare('SELECT m.id FROM media m ORDER BY '+galleryOrdering({sort}).sql).all().map(row=>row.id);
  assert.deepEqual(ordered('modified-asc'),['uploaded','edited','same','tagged']);assert.deepEqual(ordered('modified-desc'),['same','tagged','edited','uploaded']);
  assert.notEqual(galleryRevision('v',{sort:'modified-desc'}),galleryRevision('v',{sort:'modified-asc'}));
 }finally{db.close();}
});
test('cache keys include order and random seed and reject invalid sort inputs before using SQL',()=>{
  const random={sort:'random',seed:123,page:2,size:100};
  assert.equal(galleryRevision('v',random),galleryRevision('v',{...random,seed:'123'}));
  for(const change of [{sort:'tags-desc'},{seed:124},{page:1}])assert.notEqual(galleryRevision('v',random),galleryRevision('v',{...random,...change}));
  for(const options of [{sort:'invalid'},{sort:'random',seed:-1},{sort:'random',seed:1.1},{sort:'random',seed:0x100000000},{sort:'random',seed:'bad'}])assert.throws(()=>galleryOrdering(options),error=>error.status===400);
  assert.equal(galleryOrdering().sort,'uploaded-desc');assert.equal(galleryOrdering({sort:'random',seed:0}).seed,0);
});
