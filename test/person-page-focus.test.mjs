import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import worker,{FamilyState} from '../src/worker.mjs';

function fixture(){
 const database=new DatabaseSync(':memory:'),queries=[];
 const storage={sql:{exec(query,...args){queries.push({query,args});const statement=database.prepare(query),rows=statement.columns().length?statement.all(...args):(statement.run(...args),[]);return {toArray:()=>rows};}},transactionSync(callback){database.exec('BEGIN');try{const value=callback();database.exec('COMMIT');return value;}catch(error){database.exec('ROLLBACK');throw error;}}};
 const state=new FamilyState({storage},{}),env={FAMILY_STATE:{idFromName:name=>name,get:()=>state},ASSETS:{fetch:async()=>new Response('site')}};
 const insert=(n,{kind='photo',personId='yona',tagged=false,legacy=false}={})=>{
  const id=n.toString(16).padStart(32,'0'),item={id,category:personId?'personal':'gallery',personId,file:id+(kind==='video'?'.mp4':kind==='document'?'.pdf':'.jpg'),filename:'memory',name:'Memory '+n,mime:kind==='video'?'video/mp4':kind==='document'?'application/pdf':'image/jpeg',kind,size:1000,key:'media/'+id,createdAt:'2000-01-01T00:00:00Z'};
  if(legacy)delete item.kind;
  database.prepare('INSERT INTO media(id,category,person_id,data) VALUES(?,?,?,?)').run(id,item.category,personId,JSON.stringify(item));
  if(tagged)database.prepare('INSERT INTO media_tags(media_id,person_id) VALUES(?,?)').run(id,'yona');
  return item;
 };
 const call=(path,headers={})=>worker.fetch(new Request('https://family.test'+path,{headers}),env,{waitUntil(){}});
 return {database,state,queries,insert,call,close:()=>database.close()};
}

test('a focused personal photo opens its actual page using bounded album reads',()=>{
 const f=fixture();try{
  const photos=Array.from({length:60},(_,i)=>f.insert(i+1,{personId:i%2?'yona':null,tagged:true,legacy:i===0}));
  for(let i=0;i<13;i++)f.insert(100+i,{kind:'video'});
  for(let i=0;i<14;i++)f.insert(200+i,{kind:'document'});
  for(let i=0;i<600;i++)f.insert(1000+i,{personId:'shlomo'});
  f.queries.length=0;
  const result=f.state.personPage('yona',{focus:photos[0].id,videos:2,documents:2});
  assert.equal(result.focusId,photos[0].id);
  assert.equal(result.albums.photos.page,3);assert.equal(result.albums.photos.total,60);assert.equal(result.albums.photos.size,25);
  assert.deepEqual(result.albums.photos.items.map(item=>item.id),photos.slice(0,10).reverse().map(item=>item.id));
  assert.equal(result.albums.videos.page,2);assert.equal(result.albums.videos.items.length,3);
  assert.equal(result.albums.documents.page,2);assert.equal(result.albums.documents.items.length,4);
  const mediaReads=f.queries.filter(({query})=>/^SELECT m\.data FROM media m/.test(query));
  assert.equal(mediaReads.length,4,'Only three selected pages and the profile candidate are materialized');
  assert.ok(mediaReads.every(({query})=>query.includes(' LIMIT ')),'Focus ranking must not load every album item');
  assert.equal(f.queries.filter(({query})=>query.includes('m.rowid>?')).length,1,'Only the focused kind needs a rank query');
 }finally{f.close();}
});

test('video and document focus select their own page without changing the other album pages',()=>{
 const f=fixture();try{
  for(let i=1;i<=60;i++)f.insert(i);
  const videos=Array.from({length:13},(_,i)=>f.insert(100+i,{kind:'video',personId:i%2?'yona':null,tagged:true}));
  const documents=Array.from({length:14},(_,i)=>f.insert(200+i,{kind:'document'}));
  const video=f.state.personPage('yona',{focus:videos[0].id,photos:2,documents:2});
  assert.equal(video.albums.videos.page,2);assert.ok(video.albums.videos.items.some(item=>item.id===videos[0].id));assert.equal(video.albums.photos.page,2);assert.equal(video.albums.documents.page,2);
  const document=f.state.personPage('yona',{focus:documents[0].id,photos:3,videos:2});
  assert.equal(document.albums.documents.page,2);assert.ok(document.albums.documents.items.some(item=>item.id===documents[0].id));assert.equal(document.albums.photos.page,3);assert.equal(document.albums.videos.page,2);
 }finally{f.close();}
});

test('unknown or unrelated focus never inserts a foreign item or changes requested pages',()=>{
 const f=fixture();try{
  for(let i=1;i<=30;i++)f.insert(i);
  const foreign=f.insert(100,{personId:'shlomo'}),expected=f.state.personPage('yona',{photos:2});
  for(const focus of [foreign.id,'f'.repeat(32)]){
   const result=f.state.personPage('yona',{focus,photos:2});assert.equal(result.focusId,undefined);assert.deepEqual(result.albums,expected.albums);
  }
  for(const focus of ['not-an-id','A'.repeat(32),{},100])assert.throws(()=>f.state.personPage('yona',{focus}),error=>error.status===400);
 }finally{f.close();}
});

test('focused page requests cannot reuse an unfocused cache response and retain normal validators',async()=>{
 const f=fixture();try{
  const photos=Array.from({length:60},(_,i)=>f.insert(i+1));
  const unfocused=await f.call('/api/people/yona/page'),etag=unfocused.headers.get('ETag');assert.equal(unfocused.status,200);
  const url='/api/people/yona/page?focus='+photos[0].id;
  const focused=await f.call(url,{'If-None-Match':etag});assert.equal(focused.status,200);const data=await focused.json();
  assert.equal(data.albums.photos.page,3);assert.equal(data.focusId,photos[0].id);assert.notEqual(focused.headers.get('ETag'),etag);
  assert.match(focused.headers.get('ETag'),/:focus:/);
  assert.equal((await f.call(url,{'If-None-Match':focused.headers.get('ETag')})).status,304);
  assert.equal((await f.call('/api/people/yona/page',{'If-None-Match':etag})).status,304);
  assert.equal((await f.call('/api/people/yona/page?focus=bad')).status,400);
 }finally{f.close();}
});

test('nursery focus resolves owned and linked photos to their ten-photo page without loading the album',()=>{
 const f=fixture();try{
  const photos=Array.from({length:25},(_,i)=>{
   const item=f.insert(i+1,{personId:null});
   if(i%2)f.database.prepare('INSERT INTO media_collections(media_id,collection,added_at) VALUES(?,?,?)').run(item.id,'nursery:yona','2000');
   else {item.category='nursery:yona';f.database.prepare('UPDATE media SET category=?,data=? WHERE id=?').run(item.category,JSON.stringify(item),item.id);}
   return item;
  });
  // An owned photo linked to its own nursery remains one album item.
  f.database.prepare('INSERT INTO media_collections(media_id,collection,added_at) VALUES(?,?,?)').run(photos[0].id,'nursery:yona','2000');
  const foreign=f.insert(100,{personId:'shlomo'});
  f.queries.length=0;
  const result=f.state.collection('nursery:yona',{focus:photos[0].id});
  assert.equal(result.focusId,photos[0].id);assert.deepEqual(result.pagination,{page:3,pages:3,size:10,total:25});
  assert.deepEqual(result.items.map(item=>item.id),photos.slice(0,5).reverse().map(item=>item.id));
  assert.equal(f.queries.filter(({query})=>query.includes('m.rowid>?')).length,1);
  const pageReads=f.queries.filter(({query})=>/^SELECT m\.data FROM media m WHERE/.test(query));
  assert.equal(pageReads.length,2,'Only the selected ten-photo page and one cover candidate are materialized');assert.ok(pageReads.every(({query})=>query.includes(' LIMIT ')));
  const pageRead=pageReads.find(({query})=>query.includes(' OFFSET '));assert.match(pageRead.query,/LIMIT \? OFFSET \?/);assert.equal(pageRead.args.at(-2),10);
  const second=f.state.collection('nursery:yona',{page:2});assert.deepEqual(second.items.map(item=>item.id),photos.slice(5,15).reverse().map(item=>item.id));
  for(const focus of [foreign.id,'f'.repeat(32)]){const ignored=f.state.collection('nursery:yona',{page:2,focus});assert.equal(ignored.focusId,undefined);assert.deepEqual(ignored.items,second.items);assert.equal(ignored.pagination.page,2);}
  assert.throws(()=>f.state.collection('nursery:yona',{focus:'bad'}),error=>error.status===400);
 }finally{f.close();}
});

test('nursery focused requests have independent validators and normal paging is unchanged',async()=>{
 const f=fixture();try{
  const photos=Array.from({length:25},(_,i)=>{
   const item=f.insert(i+1,{personId:null});f.database.prepare('INSERT INTO media_collections(media_id,collection,added_at) VALUES(?,?,?)').run(item.id,'nursery:yona','2000');return item;
  });
  const ordinary=await f.call('/api/nursery/yona'),etag=ordinary.headers.get('ETag'),first=await ordinary.json();assert.equal(first.pagination.page,1);assert.equal(first.items.length,10);
  const url='/api/nursery/yona?focus='+photos[0].id,focused=await f.call(url,{'If-None-Match':etag});assert.equal(focused.status,200);
  const result=await focused.json();assert.equal(result.pagination.page,3);assert.equal(result.items.length,5);assert.equal(result.focusId,photos[0].id);assert.notEqual(focused.headers.get('ETag'),etag);
  assert.equal((await f.call(url,{'If-None-Match':focused.headers.get('ETag')})).status,304);
  assert.equal((await f.call('/api/nursery/yona',{'If-None-Match':etag})).status,304);
  const second=await(await f.call('/api/nursery/yona?page=2')).json();assert.equal(second.pagination.page,2);assert.equal(second.items.length,10);
  assert.equal((await f.call('/api/nursery/yona?focus=bad')).status,400);
 }finally{f.close();}
});

test('personal album page sizes include 10, 20, 50 and 100 with correct page boundaries and validators',async()=>{
 const f=fixture();try{
  for(let n=1;n<=63;n++)f.insert(n);
  for(const size of [10,20,50,100]){
   const response=await f.call('/api/people/yona/page?photosSize='+size),first=await response.json();
   assert.equal(response.status,200);assert.equal(first.albums.photos.size,size);assert.equal(first.albums.photos.items.length,Math.min(size,63));assert.equal(first.albums.photos.pages,Math.ceil(63/size));assert.equal(first.albums.photos.total,63);
   const second=await(await f.call('/api/people/yona/page?photosSize='+size+'&photos=2')).json();
   if(size<63){assert.equal(second.albums.photos.page,2);assert.equal(second.albums.photos.items.length,Math.min(size,63-size));assert.ok(second.albums.photos.items.every(item=>!first.albums.photos.items.some(other=>other.id===item.id)));}
   assert.equal((await f.call('/api/people/yona/page?photosSize='+size,{'If-None-Match':response.headers.get('ETag')})).status,304);
  }
  const smaller=await f.call('/api/people/yona/page?photosSize=20');assert.equal((await f.call('/api/people/yona/page?photosSize=50',{'If-None-Match':smaller.headers.get('ETag')})).status,200);
 }finally{f.close();}
});
