import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {FamilyState} from '../src/state.mjs';
import {FACE_SCAN_VERSION} from '../public/assets/face-coverage.mjs';
import {collectionPageRevision} from '../src/collection-pages.mjs';
import {galleryRevision} from '../src/gallery.mjs';

function fixture(){
  const database=new DatabaseSync(':memory:'),queries=[];
  const sql={exec(query,...args){queries.push({query,args});const statement=database.prepare(query),rows=statement.columns().length?statement.all(...args):(statement.run(...args),[]);return {toArray:()=>rows};}};
  const storage={sql,transactionSync(callback){database.exec('BEGIN');try{const result=callback();database.exec('COMMIT');return result;}catch(error){database.exec('ROLLBACK');throw error;}}};
  const state=new FamilyState({storage},{});
  function insert(n,fields={}){
    const id=n.toString(16).padStart(32,'0'),item={id,category:'photos',kind:'photo',file:id+'.jpg',filename:'memory.jpg',name:'Memory '+n,mime:'image/jpeg',key:'photos/'+id,size:500000,createdAt:'2000-01-01T00:00:00.000Z',...fields};
    database.prepare('INSERT INTO media(id,category,person_id,data) VALUES(?,?,?,?)').run(id,item.category,item.personId||null,JSON.stringify(item));return item;
  }
  return {database,state,queries,insert,close:()=>database.close()};
}

test('batched public metadata exactly matches single-item tags, face summaries, collections and media variants',()=>{
  const f=fixture();try{
    const rect={x:.1,y:.1,width:.2,height:.2},items=Array.from({length:8},(_,i)=>f.insert(i+1,i===7?{kind:'video',mime:'video/mp4',videoRevision:'edited'}:{}));
    items[1].photoRevision='current';items[2].unassignedFaces={original:[rect]};items[3].unassignedFaces={original:[rect]};
    items[6].category='personal';items[6].personId='yona';
    for(const item of items)f.database.prepare('UPDATE media SET data=? WHERE id=?').run(JSON.stringify(item),item.id);
    for(const item of items.slice(1)){
      f.database.prepare('INSERT INTO media_tags(media_id,person_id) VALUES(?,?)').run(item.id,'yona');
      f.database.prepare('INSERT INTO media_tags(media_id,person_id) VALUES(?,?)').run(item.id,'shlomo');
      f.database.prepare('INSERT INTO meta(id,value) VALUES(?,?)').run('tags:'+item.id,'tags-current');
      f.database.prepare('INSERT INTO media_collections(media_id,collection,added_at) VALUES(?,?,?)').run(item.id,'gallery','2000');
      f.database.prepare('INSERT INTO media_collections(media_id,collection,added_at) VALUES(?,?,?)').run(item.id,'wedding:u-root','2000');
      f.database.prepare('INSERT INTO media_faces(media_id,id,person_id,data) VALUES(?,?,?,?)').run(item.id,'face-'+item.id,'yona',JSON.stringify({id:'face-'+item.id,personId:'yona',rect}));
    }
    for(const i of [1,2,3,4,5])f.database.prepare('INSERT INTO media_face_scans VALUES(?,?,?,?,?,?)').run(items[i].id,i===1?'outdated':'original',FACE_SCAN_VERSION,JSON.stringify({faces:[{rect,score:.95}]}),1,0);
    f.database.prepare('INSERT INTO media_face_ignores VALUES(?,?,?)').run(items[3].id,'original',JSON.stringify([rect]));
    for(const i of [4,6])f.database.prepare('INSERT INTO media_face_reviews VALUES(?,?,?,?)').run(items[i].id,'original','tags-current','2000');
    f.database.prepare('INSERT INTO media_face_reviews VALUES(?,?,?,?)').run(items[5].id,'original','outdated-tags','2000');
    const expected=items.map(item=>f.state.mediaPublic(item));f.queries.length=0;
    assert.deepEqual(f.state.mediaPublicMany(items),expected);
    assert.ok(f.queries.length<=7,'Metadata should require a bounded set of batch queries, got '+f.queries.length);
    assert.deepEqual(expected[1].tags.map(person=>person.id),['shlomo','yona']);
    assert.equal(expected[1].faceSummary.scanned,false,'A scan for replaced pixels must stay hidden');
    assert.equal(expected[6].faceSummary.reviewed,true);
    assert.deepEqual(expected[6].collections,['gallery','wedding:u-root']);
  }finally{f.close();}
});

test('large albums use bounded metadata batches independent of unrelated gallery size',()=>{
  const f=fixture();try{
    const items=Array.from({length:401},(_,i)=>f.insert(i+100));
    for(let i=1000;i<2000;i++)f.insert(i,{category:'gallery'});
    f.queries.length=0;
    const result=f.state.mediaPublicMany(items);
    assert.deepEqual(result.map(item=>item.id),items.map(item=>item.id));
    assert.equal(f.queries.length,15,'Three 200-item batches require five metadata reads each for untagged photos');
    assert.ok(f.queries.every(({args})=>JSON.parse(args[0]).length<=200));
    assert.deepEqual(f.state.mediaPublicMany([]),[]);
  }finally{f.close();}
});

test('transparent album pages preserve legacy ordering, full counts, covers and collection revision',()=>{
  const f=fixture();try{
    for(let i=1;i<=61;i++)f.insert(i);
    const full=f.state.collection('photos'),pages=Array.from({length:3},(_,i)=>f.state.collection('photos',{paged:true,page:i+1,size:25}));
    assert.deepEqual(pages.flatMap(page=>page.items),full.items);
    for(const page of pages){assert.equal(page.count,full.count);assert.equal(page.collectionRevision,full.revision);assert.equal(page.revision,collectionPageRevision(full.revision,{paged:true,...page.pagination}));}
    assert.deepEqual(pages[0].pagination,{page:1,size:25,total:61,pages:3});
    assert.equal(f.state.collection('photos',{paged:true,page:99,size:25}).pagination.page,3);
    assert.throws(()=>f.state.collection('photos',{paged:true,size:500}),/200/);
    const event=f.state.nostalgiaLibrary.read().events[0].id;
    for(let i=100;i<130;i++)f.insert(i,{category:'nostalgia',nostalgiaEventIds:[event]});
    const nostalgia=f.state.collection('nostalgia'),first=f.state.collection('nostalgia',{paged:true,size:25}),last=f.state.collection('nostalgia',{paged:true,page:2,size:25});
    assert.deepEqual(first.library,nostalgia.library,'First transport page retains full event counts and covers');
    assert.deepEqual([...first.items,...last.items],nostalgia.items);assert.equal(last.library,undefined);
    for(let i=200;i<230;i++)f.insert(i,{category:'wedding:u-root'});
    const wedding=f.state.wedding('u-root',true),later=f.state.wedding('u-root',true,{paged:true,page:2,size:25});
    assert.equal(later.cover,wedding.cover);assert.equal(later.mediaCount,wedding.mediaCount);assert.equal(later.collection.items.length,5);
    const summary=f.state.wedding('u-root');assert.equal(summary.cover,wedding.cover);assert.equal(summary.mediaCount,wedding.mediaCount);assert.equal(summary.greetingCount,wedding.greetingCount);
  }finally{f.close();}
});

test('supplemental names invalidate the shared roster validator without per-check SQL',()=>{
  const f=fixture();try{
    const item=f.insert(1),before=f.state.run('tag.people').revision;
    f.state.patchTags(item.id,[{name:'New guest',tagged:true}]);
    const after=f.state.run('tag.people');assert.notEqual(after.revision,before);assert.ok(after.people.some(person=>person.name==='New guest'));
    f.queries.length=0;assert.equal(f.state.run('tag.people.revision').revision,after.revision);assert.equal(f.queries.length,0);
  }finally{f.close();}
});

test('all gallery photos exceed 500 while respecting search, person filters, ordering and cache validators',()=>{
 const f=fixture();try{
  const items=Array.from({length:605},(_,i)=>f.insert(i+1,{category:'gallery',caption:i%2?'other':'match',createdAt:new Date(Date.UTC(2000,0,i+1)).toISOString()}));
  for(const item of items.slice(0,5))f.database.prepare('INSERT INTO media_tags(media_id,person_id) VALUES(?,?)').run(item.id,'yona');
  const first=f.state.collection('gallery',{size:500}),last=f.state.collection('gallery',{size:500,page:2});
  const all=f.state.collection('gallery',{size:'all',page:8});
  assert.deepEqual(all.items,[...first.items,...last.items]);
  assert.equal(all.items.length,605);assert.equal(all.pagination.size,605);assert.equal(all.pagination.all,true);assert.equal(all.pagination.pages,1);assert.equal(all.pagination.page,1);
  const base=f.state.run('collection.revision',{kind:'gallery'}).revision;
  assert.equal(all.revision,galleryRevision(base,{size:'all',page:1}));assert.notEqual(all.revision,first.revision);assert.doesNotMatch(all.revision,/NaN/);
  const options={size:'all',person:'yona',query:'match',filter:'partial',sort:'uploaded-asc'},filtered=f.state.collection('gallery',options);
  assert.deepEqual(filtered.items.map(item=>item.id),[items[0].id,items[2].id,items[4].id]);
  assert.equal(filtered.pagination.size,3);assert.equal(filtered.pagination.all,true);assert.equal(filtered.revision,galleryRevision(base,{...options,page:1}));
  const empty=f.state.collection('gallery',{size:'all',query:'no such photo'});assert.equal(empty.items.length,0);assert.equal(empty.pagination.pages,1);assert.equal(empty.pagination.size,1);
  assert.equal(f.state.collection('gallery',{size:100}).items.length,100);
  for(const size of ['invalid',-1,501,Infinity])assert.throws(()=>f.state.collection('gallery',{size}),error=>error.status===400);
 }finally{f.close();}
});
