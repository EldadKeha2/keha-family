import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile} from 'node:fs/promises';
import worker,{FamilyState,LIMITS,sniff} from '../src/worker.mjs';
import {signedRequest} from '../src/hf.mjs';
import {fail} from '../src/http.mjs';
import family from '../src/family.mjs';
import {FACE_SCAN_VERSION} from '../public/assets/face-coverage.mjs';

function fixture(){
  const database=new DatabaseSync(':memory:');
  const sql={exec(query,...args){const statement=database.prepare(query);const rows=statement.columns().length?statement.all(...args):(statement.run(...args),[]);return {toArray:()=>rows};}};
  const storage={sql,transactionSync(callback){database.exec('BEGIN');try{const result=callback();database.exec('COMMIT');return result;}catch(error){database.exec('ROLLBACK');throw error;}}};
  const env={HF_NAMESPACE:'example-owner',HF_BUCKET:'keha-family',HF_ACCESS_KEY_ID:'HFAK_TEST_ONLY',HF_SECRET_ACCESS_KEY:'example-test-secret'};
  let state=new FamilyState({storage},env);
  env.FAMILY_STATE={idFromName:name=>name,get:()=>state};
  env.ASSETS={fetch:async()=>new Response('static assets',{headers:{'Content-Type':'text/html'}})};
  const tasks=[],ctx={waitUntil(promise){tasks.push(promise);}},objects=new Map(),network=[];
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async(input,options)=>{
    const request=input instanceof Request?input:new Request(input,options),url=new URL(request.url);network.push(request);
    if(url.hostname==='www.hebcal.com'){
      assert.equal(url.searchParams.get('i'),'on','Use the Israel holiday calendar');
      assert.equal(url.searchParams.get('lg'),'s','Fetch English titles alongside the Hebrew field');
      if(env.FAIL_HOLIDAYS)return new Response('Unavailable',{status:503});
      const year=url.searchParams.get('year');
      return Response.json({items:[{date:year+'-07-21',hebrew:'ראש חודש',title:'Rosh Chodesh',category:'roshchodesh'},{date:year+'-11-10',hebrew:'רֹאשׁ חוֹדֶשׁ כִּסְלֵו',title:'Rosh Chodesh Kislev',category:'roshchodesh'},{date:year+'-07-21T20:00:00+03:00',title:'Candle lighting',category:'candles'}]});
    }
    if(url.hostname==='s3.hf.co'){
      assert.match(request.headers.get('Authorization')||'',/^AWS4-HMAC-SHA256 Credential=HFAK_TEST_ONLY\//);
      if(request.method==='PUT'){objects.set(url.pathname,{bytes:new Uint8Array(await request.arrayBuffer()),mime:request.headers.get('Content-Type')});return new Response(null,{status:200});}
      if(request.method==='DELETE'){objects.delete(url.pathname);return new Response(null,{status:204});}
      if(!objects.has(url.pathname))return new Response(null,{status:404});
      return new Response(null,{status:302,headers:{Location:'https://cdn.example'+url.pathname}});
    }
    assert.equal(url.hostname,'cdn.example');assert.equal(request.headers.get('Authorization'),null,'Storage credentials must not be forwarded to a CDN');
    const file=objects.get(url.pathname);if(!file)return new Response(null,{status:404});
    let start=0,end=file.bytes.length-1,status=200;const headers={'Content-Type':file.mime,'Accept-Ranges':'bytes'};
    const range=request.headers.get('Range');
    if(range){const [,first,last]=/^bytes=(\d*)-(\d*)$/.exec(range)||[];if(first===''){start=Math.max(0,file.bytes.length-Number(last));}else{start=Number(first);if(last)end=Math.min(end,Number(last));}if(start>end||start>=file.bytes.length)return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+file.bytes.length}});status=206;headers['Content-Range']=`bytes ${start}-${end}/${file.bytes.length}`;}
    const bytes=file.bytes.slice(start,end+1);headers['Content-Length']=String(bytes.byteLength);
    return new Response(request.method==='HEAD'?null:bytes,{status,headers});
  };
  let csrf='';
  async function call(path,{method='GET',body,headers={},clientHeaders=true}={}){
    const h=new Headers(headers);
    if(method==='POST'){h.set('Origin',h.get('Origin')||'https://family.example');if(clientHeaders&&csrf&&!h.has('X-Family-Token'))h.set('X-Family-Token',csrf);}
    if(body&&typeof body==='object'&&!(body instanceof FormData)&&!(body instanceof ArrayBuffer)&&!ArrayBuffer.isView(body)&&!(body instanceof ReadableStream)){h.set('Content-Type','application/json');body=JSON.stringify(body);}
    return worker.fetch(new Request('https://family.example'+path,{method,body,headers:h,...(body instanceof ReadableStream?{duplex:'half'}:{})}),env,ctx);
  }
  async function connect(){
    const bootstrap=await call('/family-data.js');assert.equal(bootstrap.status,200);
    const script=await bootstrap.text();csrf=JSON.parse(/window.FAMILY_API_TOKEN=("[^"]+")/.exec(script)[1]);return script;
  }
  return {env,call,connect,objects,network,database,storage,ownerBirthday(path,{body}){const id=path.split('/')[3];return state.fetch(new Request('https://state.internal/',{method:'POST',body:JSON.stringify({action:'birthday',id,...body})}));},restart(){state=new FamilyState({storage},env);},flush:()=>Promise.allSettled(tasks),async close(){await Promise.allSettled(tasks);globalThis.fetch=originalFetch;database.close();}};
}
const photo=await readFile(new URL('./fixtures/photo.jpg',import.meta.url));
const video=await readFile(new URL('./fixtures/video.mp4',import.meta.url));

async function photoEdit(f,item,{expectedVersion='original',baseVersion=expectedVersion,rotation=1,crop={x:0,y:0,width:1,height:1},bytes=Buffer.concat([photo,Buffer.from('edited')]),clientHeaders=true}={}){
  const query=new URLSearchParams({expectedVersion,baseVersion,rotation,crop:JSON.stringify(crop),filename:'edited.jpg'});
  return f.call('/api/media/'+item.id+'/edit?'+query,{method:'POST',body:bytes,clientHeaders,headers:{'Content-Type':'image/jpeg','Content-Length':String(bytes.length)}});
}
test('editing one photo keeps its original bytes, profile, tags, captions and album membership',async()=>{
 const f=fixture();try{
  await f.connect();const item=await taggedUpload(f,'/api/collections/gallery');await setTags(f,item,['tomer']);
  await f.call('/api/media/'+item.id+'/caption',{method:'POST',body:{caption:'Keep this description',expectedCaption:''}});
  await f.call('/api/media/'+item.id+'/collections',{method:'POST',body:{collection:'photos',scope:'gallery'}});
  await f.call('/api/people/tomer/profile',{method:'POST',body:{file:item.file}});
  const initial=await(await f.call('/api/media/'+item.id+'/versions')).json();assert.equal(initial.currentVersion,'original');assert.equal(initial.versions.length,1);assert.equal(f.objects.size,1);
  const response=await photoEdit(f,item);assert.equal(response.status,201,await response.clone().text());const saved=await response.json();
  assert.equal(saved.item.id,item.id);assert.equal(saved.item.file,item.file);assert.equal(saved.item.caption,'Keep this description');assert.deepEqual(saved.item.tags.map(person=>person.id),['tomer']);assert.deepEqual(new Set(saved.item.collections),new Set(['gallery','photos']));
  assert.equal(saved.versions.length,2);assert.match(saved.currentVersion,/^[a-f0-9]{32}$/);assert.equal(saved.people.tomer.profile,saved.item.src);assert.match(saved.item.src,/\?v=/);
  assert.deepEqual(Buffer.from(await(await f.call('/media/'+item.id+'?version=original')).arrayBuffer()),photo);
  assert.deepEqual(Buffer.from(await(await f.call(saved.item.src)).arrayBuffer()),Buffer.concat([photo,Buffer.from('edited')]));
  for(const kind of ['gallery','photos']){const album=await(await f.call('/api/collections/'+kind)).json();assert.equal(album.count,1);assert.equal(album.items[0].src,saved.item.src);}
  const album=await(await f.call('/api/people/tomer/page')).json();assert.equal(album.person.profile,saved.item.src);assert.equal(album.albums.photos.items[0].src,saved.item.src);
  assert.equal(f.objects.size,2);assert.equal(f.database.prepare('SELECT count(*) AS n FROM media').get().n,7);
  f.restart();const history=await(await f.call('/api/media/'+item.id+'/versions')).json();assert.equal(history.versions.length,2);assert.equal(history.currentVersion,saved.currentVersion);
  assert.equal((await(await f.call('/api/export')).json()).photoVersions.length,2);
 }finally{await f.close();}
});
test('restoring an older photo preserves later versions and restores its face coordinates',async()=>{
 const f=fixture();try{
  await f.connect();const item=await taggedUpload(f);await setTags(f,item,['yona']);
  const faceId='e'.repeat(32),rect={x:.1,y:.2,width:.2,height:.3};
  await f.call('/api/media/'+item.id+'/faces/save',{method:'POST',body:{faceId,personId:'yona',rect,expectedRevision:null}});
  const before=await(await f.call('/api/media/'+item.id+'/faces')).json();const saved=await(await photoEdit(f,item)).json();let faces=await(await f.call('/api/media/'+item.id+'/faces')).json();assert.equal(faces.faces[0].personId,'yona');assert.ok(Math.abs(faces.faces[0].rect.x-.5)<1e-9);assert.notEqual(faces.item.tagsRevision,before.item.tagsRevision);
  const restored=await f.call('/api/media/'+item.id+'/versions/original/restore',{method:'POST',body:{expectedVersion:saved.currentVersion}});assert.equal(restored.status,200,await restored.clone().text());const result=await restored.json();
  assert.equal(result.versions.length,3);assert.notEqual(result.currentVersion,'original');assert.notEqual(result.currentVersion,saved.currentVersion);assert.equal(f.objects.size,2,'Restoration reuses existing bytes');
  assert.deepEqual(Buffer.from(await(await f.call(result.item.src)).arrayBuffer()),photo);
  faces=await(await f.call('/api/media/'+item.id+'/faces')).json();assert.deepEqual(faces.faces[0].rect,rect);assert.equal(faces.faces[0].id,faceId);
  const cropped=await(await photoEdit(f,item,{expectedVersion:result.currentVersion,rotation:0,crop:{x:.5,y:.5,width:.5,height:.5}})).json();
  assert.equal((await(await f.call('/api/media/'+item.id+'/faces')).json()).faces.length,0);assert.deepEqual(cropped.item.tags.map(person=>person.id),['yona'],'Cropping never removes ordinary person tags');
  const back=await f.call('/api/media/'+item.id+'/versions/'+saved.currentVersion+'/restore',{method:'POST',body:{expectedVersion:cropped.currentVersion}});assert.equal(back.status,200);
  assert.ok(Math.abs((await(await f.call('/api/media/'+item.id+'/faces')).json()).faces[0].rect.x-.5)<1e-9);
 }finally{await f.close();}
});
test('concurrent edits reject the stale version without deleting the winner or the original',async()=>{
 const f=fixture();try{
  await f.connect();const item=await taggedUpload(f);const edits=await Promise.all([photoEdit(f,item),photoEdit(f,item)]);
  assert.deepEqual(edits.map(response=>response.status).sort(),[201,409]);await f.flush();assert.equal(f.objects.size,2);
  const history=await(await f.call('/api/media/'+item.id+'/versions')).json();assert.equal(history.versions.length,2);
  assert.equal((await photoEdit(f,item)).status,409);assert.equal((await f.call('/api/media/'+item.id+'/versions/original/restore',{method:'POST',body:{expectedVersion:'original'}})).status,409);
  for(const version of history.versions)assert.equal((await f.call(version.src)).status,200);
 }finally{await f.close();}
});
test('photo history validates writes, isolates photo versions and follows deletion and undo',async()=>{
 const f=fixture();try{
  await f.connect();const item=await taggedUpload(f),other=await taggedUpload(f);
  assert.equal((await photoEdit(f,item,{clientHeaders:false})).status,403);assert.equal((await photoEdit(f,item,{crop:{x:-1,y:0,width:1,height:1}})).status,400);
  assert.equal((await photoEdit(f,item,{bytes:Buffer.from('not an image')})).status,415);assert.equal(f.objects.size,2);
  const saved=await(await photoEdit(f,item)).json();
  assert.equal((await f.call('/media/'+other.id+'?version='+saved.currentVersion)).status,404);assert.equal((await f.call('/media/'+item.id+'?version=../../secret')).status,400);
  const clip=await taggedUpload(f,'/api/collections/videos',video,'film.mp4');assert.equal((await photoEdit(f,clip)).status,400);assert.equal((await f.call('/api/media/'+clip.id+'/versions')).status,400);
  await f.call('/api/media/'+item.id+'/delete',{method:'POST',body:{scope:'photos'}});
  assert.equal((await f.call('/api/media/'+item.id+'/versions')).status,404);assert.equal((await f.call('/media/'+item.id+'?version=original')).status,404);assert.ok(!(await(await f.call('/api/export')).json()).photoVersions.some(version=>version.mediaId===item.id));
  await f.call('/api/media/'+item.id+'/restore',{method:'POST',body:{scope:'photos'}});
  assert.equal((await(await f.call('/api/media/'+item.id+'/versions')).json()).versions.length,2);assert.equal((await f.call('/media/'+item.id+'?version=original')).status,200);
 }finally{await f.close();}
});

test('photo album shortcuts link the original to family photos, its own nursery and its own wedding exactly once',async()=>{
 const f=fixture();try{
  await f.connect();const item=await taggedUpload(f,'/api/collections/gallery');await setTags(f,item,['tomer','shani']);
  const add=collection=>f.call('/api/media/'+item.id+'/collections',{method:'POST',body:{collection,scope:'personal:tomer'}});
  for(const collection of ['photos','nursery:tomer','wedding:u-tomer']){
   const response=await add(collection);assert.equal(response.status,200,await response.clone().text());
   const result=await response.json();assert.ok(result.item.collections.includes(collection));assert.equal(result.collection.items[0].id,item.id);
   const revision=result.collection.revision;assert.equal((await(await add(collection)).json()).collection.revision,revision,'Repeated taps must not write duplicates or refresh the album revision');
  }
  f.restart();
  const personal=await(await f.call('/api/people/tomer/page')).json(),saved=personal.albums.photos.items[0];
  assert.deepEqual(new Set(saved.collections),new Set(['gallery','photos','nursery:tomer','wedding:u-tomer']));
  assert.equal((await(await f.call('/api/collections/gallery')).json()).count,1);
  assert.equal((await(await f.call('/api/nursery')).json()).albums.tomer.count,1);
  assert.equal((await(await f.call('/api/nursery/tomer')).json()).count,1);
  assert.equal((await(await f.call('/api/weddings/u-tomer')).json()).mediaCount,1);
  assert.equal(f.objects.size,1);assert.equal(f.database.prepare('SELECT count(*) AS n FROM media').get().n,7,'Memberships never duplicate a media record');
  assert.equal(f.database.prepare('SELECT count(*) AS n FROM media_collections').get().n,3);
  assert.equal((await(await f.call('/api/export')).json()).mediaCollections.length,3);
  const caption=await f.call('/api/weddings/u-tomer/caption',{method:'POST',body:{file:item.file,caption:'One original, shared description'}});assert.equal(caption.status,200);
  assert.equal((await(await f.call('/api/nursery/tomer')).json()).items[0].caption,'One original, shared description');
 }finally{await f.close();}
});
test('album shortcuts reject wrong people, unrelated weddings, nonphotos and forged writes',async()=>{
 const f=fixture();try{
  await f.connect();const item=await taggedUpload(f,'/api/collections/gallery');await setTags(f,item,['tomer']);
  const add=(collection,scope='personal:tomer',extra={})=>f.call('/api/media/'+item.id+'/collections',{method:'POST',body:{collection,scope},...extra});
  assert.equal((await add('nursery:shani')).status,400);
  assert.equal((await add('wedding:u-root')).status,400);
  assert.equal((await add('nursery:tomer','personal:shani')).status,400);
  assert.equal((await add('nursery:tomer','gallery')).status,400);
  assert.equal((await add('videos')).status,400);
  assert.equal((await add('photos','gallery',{clientHeaders:false})).status,403);
  const clip=await taggedUpload(f,'/api/collections/videos',video,'memory.mp4');
  assert.equal((await f.call('/api/media/'+clip.id+'/collections',{method:'POST',body:{collection:'photos',scope:'gallery'}})).status,400);
  assert.equal(f.database.prepare('SELECT count(*) AS n FROM media_collections').get().n,0);
 }finally{await f.close();}
});
test('album membership survives deletion and undo while native album photos are already selected',async()=>{
 const f=fixture();try{
  await f.connect();const item=await taggedUpload(f);assert.deepEqual(item.collections,['photos']);
  await setTags(f,item,['tomer']);
  for(const collection of ['nursery:tomer','wedding:u-tomer'])assert.equal((await f.call('/api/media/'+item.id+'/collections',{method:'POST',body:{collection,scope:'personal:tomer'}})).status,200);
  const before=await f.call('/api/nursery/tomer');
  assert.equal((await f.call('/api/media/'+item.id+'/delete',{method:'POST',body:{scope:'photos'}})).status,200);
  assert.equal((await(await f.call('/api/nursery/tomer')).json()).count,0);
  assert.equal((await(await f.call('/api/nursery')).json()).albums.tomer,undefined);
  assert.equal((await(await f.call('/api/weddings/u-tomer')).json()).mediaCount,0);
  assert.equal((await f.call('/api/nursery/tomer',{headers:{'If-None-Match':before.headers.get('ETag')}})).status,200);
  assert.equal((await f.call('/api/media/'+item.id+'/restore',{method:'POST',body:{scope:'photos'}})).status,200);
  assert.equal((await(await f.call('/api/nursery/tomer')).json()).count,1);
  assert.equal((await(await f.call('/api/weddings/u-tomer')).json()).mediaCount,1);
  assert.equal(f.objects.size,1);
 }finally{await f.close();}
});

test('a face label atomically adds an ordinary tag, preserves other people, and follows the same photo across albums',async()=>{
 const f=fixture();try{
  await f.connect();const item=await taggedUpload(f),faceId='a'.repeat(32),rect={x:.2,y:.1,width:.17,height:.22};await setTags(f,item,['shlomo']);
  const response=await f.call('/api/media/'+item.id+'/faces/save',{method:'POST',body:{faceId,personId:'yona',rect,expectedRevision:null}});assert.equal(response.status,200);const result=await response.json();
  assert.equal(result.operation,'faces');assert.deepEqual(result.item.tags.map(p=>p.id),['yona','shlomo']);assert.equal(result.face.person.id,'yona');assert.deepEqual(result.face.rect,rect);assert.equal(result.face.id,faceId);
  for(const id of ['yona','shlomo']){const person=await(await f.call('/api/people/'+id+'/page')).json();assert.equal(person.albums.photos.items[0].id,item.id);}
  f.restart();const saved=await(await f.call('/api/media/'+item.id+'/faces')).json();assert.equal(saved.faces[0].id,faceId);assert.equal(saved.faces[0].person.nameEn,'Yona Nakash');
  const backup=await(await f.call('/api/export')).json();assert.equal(backup.faceTags[0].mediaId,item.id);assert.equal(backup.faceTags[0].personId,'yona');assert.equal(f.objects.size,1,'Face coordinates must not duplicate photo files');
 }finally{await f.close();}
});
test('small background faces and substantially overlapping people keep distinct names after save and restart',async()=>{
 const f=fixture();try{
  await f.connect();const item=await taggedUpload(f);
  const boxes=[{x:.1,y:.2,width:.1,height:.1},{x:.12,y:.2,width:.1,height:.1},{x:.8,y:.2,width:6/4096,height:8/3072}];
  for(const [index,personId] of ['yona','shlomo','ruti'].entries()){
   const response=await f.call('/api/media/'+item.id+'/faces/save',{method:'POST',body:{faceId:String(index+1).repeat(32),personId,rect:boxes[index],expectedRevision:null}});
   assert.equal(response.status,200,await response.clone().text());
  }
  f.restart();const saved=await(await f.call('/api/media/'+item.id+'/faces')).json();
  assert.deepEqual(saved.faces.map(face=>face.personId),['yona','shlomo','ruti']);assert.ok(saved.faces[2].rect.width<.005);
  const duplicate=await f.call('/api/media/'+item.id+'/faces/save',{method:'POST',body:{faceId:'4'.repeat(32),personId:'yona',rect:boxes[0],expectedRevision:null}});
  assert.equal(duplicate.status,409,'The same face still cannot be saved twice');
 }finally{await f.close();}
});
test('face edits reject stale or duplicate regions, remain isolated by photo, and clearing the last face removes its name',async()=>{
 const f=fixture();try{
  await f.connect();const a=await taggedUpload(f),b=await taggedUpload(f),id='b'.repeat(32),rect={x:.1,y:.2,width:.2,height:.3};
  const save=(item,body)=>f.call('/api/media/'+item.id+'/faces/save',{method:'POST',body:{faceId:id,personId:'yona',rect,expectedRevision:null,...body}});
  let response=await save(a,{});const face=(await response.json()).face;assert.ok(face.revision);
  assert.equal((await save(a,{personId:'shlomo'})).status,409);assert.equal((await save(a,{faceId:'c'.repeat(32)})).status,409);
  response=await save(a,{personId:'shlomo',expectedRevision:face.revision});assert.equal(response.status,200);const edited=(await response.json()).face;assert.equal(edited.person.id,'shlomo');assert.notEqual(edited.revision,face.revision);
  assert.equal((await(await f.call('/api/media/'+b.id+'/faces')).json()).faces.length,0);
  assert.equal((await save(a,{personId:null,expectedRevision:edited.revision})).status,200);
  const tags=(await(await f.call('/api/media/'+a.id+'/tags')).json()).item.tags;assert.deepEqual(tags.map(p=>p.id),[]);assert.equal((await(await f.call('/api/media/'+a.id+'/faces')).json()).faces.length,0);
 }finally{await f.close();}
});
test('a new face name becomes one extra album person, persists after restart and is reused across photos',async()=>{
 const f=fixture();try{
  await f.connect();const a=await taggedUpload(f),b=await taggedUpload(f),rect={x:.2,y:.1,width:.17,height:.22},name='חברה חדשה מהטיול';
  const response=await f.call('/api/media/'+a.id+'/faces/save',{method:'POST',body:{faceId:'e'.repeat(32),name:'  חברה   חדשה מהטיול  ',rect,expectedRevision:null}});assert.equal(response.status,200);const result=await response.json(),person=result.face.person;
  assert.equal(person.name,name);assert.equal(person.extra,true);assert.match(person.id,/^extra-/);assert.equal(result.face.personId,person.id);assert.deepEqual(result.item.tags.map(p=>p.id),[person.id]);assert.deepEqual(result.face.rect,rect);assert.equal(family.people[person.id],undefined);
  const album=await(await f.call('/api/people/'+person.id+'/page')).json();assert.equal(album.albums.photos.items[0].id,a.id);
  f.restart();const reopened=await(await f.call('/api/media/'+a.id+'/faces')).json();assert.equal(reopened.faces[0].person.name,name);assert.equal(reopened.faces[0].personId,person.id);
  const second=await f.call('/api/media/'+b.id+'/faces/save',{method:'POST',body:{faceId:'f'.repeat(32),name,rect,expectedRevision:null}});assert.equal(second.status,200);assert.equal((await second.json()).face.personId,person.id);
  const roster=await(await f.call('/api/tag-people')).json();assert.equal(roster.people.filter(p=>p.name===name).length,1);assert.equal(f.objects.size,2,'Face labels must not duplicate photo files');
 }finally{await f.close();}
});
test('free face names reuse existing aliases and invalid or conflicting saves leave no extra people',async()=>{
 const f=fixture();try{
  await f.connect();const item=await taggedUpload(f),rect={x:.2,y:.1,width:.17,height:.22},faceId='e'.repeat(32);
  const save=body=>f.call('/api/media/'+item.id+'/faces/save',{method:'POST',body:{faceId,rect,expectedRevision:null,...body}});
  const count=()=>f.database.prepare('SELECT COUNT(*) AS n FROM people').get().n,initial=count();
  for(const body of [{name:'   '},{name:123},{name:'א'.repeat(121)},{name:'חדש',personId:'yona'},{name:'חדש',personId:null},{name:'חדש',rect:{...rect,width:0}}])assert.equal((await save(body)).status,400);
  assert.equal(count(),initial);assert.equal((await(await f.call('/api/media/'+item.id+'/faces')).json()).faces.length,0);
  let response=await save({name:'Yona Nakash'});assert.equal(response.status,200);const saved=(await response.json()).face;assert.equal(saved.personId,'yona');assert.equal(count(),initial);
  assert.equal((await save({name:'אדם שלא ייווצר'})).status,409);
  assert.equal((await save({name:'אדם שלא ייווצר',faceId:'f'.repeat(32)})).status,409);assert.equal(count(),initial);
  response=await save({name:'שם נוסף תקין',expectedRevision:saved.revision});assert.equal(response.status,200);const changed=(await response.json()).face;assert.equal(changed.person.name,'שם נוסף תקין');assert.notEqual(changed.personId,'yona');assert.equal(changed.id,faceId);
 }finally{await f.close();}
});
test('face inputs are bounded, invalid saves are atomic, and ordinary tag removal and undo also hide and restore face labels',async()=>{
 const f=fixture();try{
  await f.connect();const item=await taggedUpload(f),faceId='d'.repeat(32),rect={x:.4,y:.2,width:.1,height:.2};
  const save=body=>f.call('/api/media/'+item.id+'/faces/save',{method:'POST',body:{faceId,personId:'yona',rect,expectedRevision:null,...body}});
  for(const bad of [{rect:{...rect,x:-.1}},{rect:{...rect,width:0}},{rect:{...rect,x:.99}},{personId:'missing-person'},{faceId:'not-an-id'}])assert.ok((await save(bad)).status>=400);
  assert.equal((await(await f.call('/api/media/'+item.id+'/tags')).json()).item.tags.length,0);assert.equal((await(await f.call('/api/media/'+item.id+'/faces')).json()).faces.length,0);
  assert.equal((await save({})).status,200);
  assert.equal((await f.call('/api/media/'+item.id+'/untag',{method:'POST',body:{scope:'personal:yona'}})).status,200);assert.equal((await(await f.call('/api/media/'+item.id+'/faces')).json()).faces.length,0);
  assert.equal((await f.call('/api/media/'+item.id+'/retag',{method:'POST',body:{scope:'personal:yona'}})).status,200);assert.equal((await(await f.call('/api/media/'+item.id+'/faces')).json()).faces[0].id,faceId);
  assert.equal((await f.call('/api/media/'+item.id+'/delete',{method:'POST',body:{scope:item.scope}})).status,200);assert.equal((await f.call('/api/media/'+item.id+'/faces')).status,404);
  assert.equal((await f.call('/api/media/'+item.id+'/restore',{method:'POST',body:{scope:item.scope}})).status,200);assert.equal((await(await f.call('/api/media/'+item.id+'/faces')).json()).faces[0].personId,'yona');
  const film=(await(await f.call('/api/collections/videos')).json()).items[0];assert.equal((await f.call('/api/media/'+film.id+'/faces')).status,400);
 }finally{await f.close();}
});

test('nursery albums isolate baby photos from profile pictures and other albums, and use the existing gallery actions',async()=>{
 const f=fixture();try{
  await f.connect();assert.deepEqual(await(await f.call('/api/nursery')).json(),{albums:{}});
  const upload=async(id,n)=>{const response=await f.call('/api/nursery/'+id+'/upload?filename=baby-'+n+'.jpg',{method:'POST',body:photo,headers:{'Content-Length':String(photo.length)}});assert.equal(response.status,201);return (await response.json()).collection.items[0];};
  const first=await upload('yona',1),second=await upload('yona',2),other=await upload('shlomo',3);
  assert.equal(first.scope,'nursery:yona');assert.equal(other.scope,'nursery:shlomo');assert.equal(first.kind,'photo');
  let album=await(await f.call('/api/nursery/yona')).json();assert.deepEqual(album.items.map(item=>item.id),[second.id,first.id]);assert.equal(album.count,2);
  let summary=(await(await f.call('/api/nursery')).json()).albums;assert.deepEqual(summary.yona,{count:2,cover:second.src});assert.equal(summary.shlomo.cover,other.src);
  for(const id of ['yona','shlomo']){const p=await(await f.call('/api/people/'+id+'/page')).json();assert.equal(p.person.profile,null);assert.equal(p.albums.photos.total,0);}
  assert.equal((await(await f.call('/api/collections/gallery')).json()).count,0);
  let response=await f.call('/api/media/'+second.id+'/caption',{method:'POST',body:{caption:'A first smile',expectedCaption:''}});assert.equal(response.status,200);assert.equal((await response.json()).collection.items[0].caption,'A first smile');
  assert.equal((await f.call('/api/media/'+first.id+'/delete',{method:'POST',body:{scope:'nursery:shlomo'}})).status,404);
  assert.equal((await f.call('/api/media/'+second.id+'/delete',{method:'POST',body:{scope:'nursery:yona'}})).status,200);
  summary=(await(await f.call('/api/nursery')).json()).albums;assert.equal(summary.yona.count,1);assert.equal(summary.yona.cover,first.src);
  assert.equal((await f.call('/api/media/'+second.id+'/restore',{method:'POST',body:{scope:'nursery:yona'}})).status,200);
  f.restart();album=await(await f.call('/api/nursery/yona')).json();assert.equal(album.count,2);assert.equal(album.items.find(item=>item.id===second.id).caption,'A first smile');
  const exportData=await(await f.call('/api/export')).json();assert.equal(exportData.media.filter(item=>item.category==='nursery:yona').length,2);
  assert.equal((await f.call(first.src)).status,200);
 }finally{await f.close();}
});
test('nursery accepts newly added core relatives automatically, rejects extended or tag-only relatives and only accepts photos',async()=>{
 const f=fixture(),id='nursery-future-test';try{
  await f.connect();const extended=Object.values(family.people).find(p=>p.extended);assert.ok(extended);
  for(const personId of [extended.id,'extra-guest','not-a-relative']){
   assert.equal((await f.call('/api/nursery/'+personId)).status,404);
   assert.equal((await f.call('/api/nursery/'+personId+'/upload?filename=baby.jpg',{method:'POST',body:photo,headers:{'Content-Length':String(photo.length)}})).status,404);
  }
  assert.equal(f.objects.size,0,'Ineligible members must be rejected before uploading bytes');
  family.people[id]={id,name:'קרובת משפחה חדשה',nameEn:'New relative',birthday:'1.1.2026',gender:'f',branch:'keha',generation:6};f.restart();
  assert.equal((await f.call('/api/nursery/'+id)).status,200);
  assert.equal((await f.call('/api/nursery/'+id+'/upload?filename=new-baby.jpg',{method:'POST',body:photo,headers:{'Content-Length':String(photo.length)}})).status,201);
  assert.equal((await(await f.call('/api/nursery')).json()).albums[id].count,1);
  assert.equal((await f.call('/api/nursery/yona/upload?filename=video.mp4',{method:'POST',body:video,headers:{'Content-Length':String(video.length)}})).status,415);
 }finally{delete family.people[id];await f.close();}
});
test('wedding and nursery cover photos are selected from their own albums and survive uploads, edits, deletion and restore',async()=>{
 const f=fixture();try{
  await f.connect();const weddingId=family.root,scopes=['wedding:'+weddingId,'nursery:yona'];
  const upload=async(scope,n)=>{
   const base=scope.startsWith('wedding:')?'/api/weddings/'+scope.slice(8):'/api/nursery/'+scope.slice(8);
   const response=await f.call(base+'/upload?filename=cover-'+n+'.jpg',{method:'POST',body:photo,headers:{'Content-Length':String(photo.length)}});assert.equal(response.status,201);return(await response.json()).collection.items[0];
  };
  const covers=[];
  for(const scope of scopes){
   const first=await upload(scope,1);await upload(scope,2);
   const response=await f.call('/api/collections/cover',{method:'POST',body:{collection:scope,mediaId:first.id}});assert.equal(response.status,200);const result=await response.json();assert.equal(result.operation,'album-cover');assert.equal(result.collection.cover,first.src);covers.push(first);
   await upload(scope,3);
  }
  f.restart();assert.equal((await(await f.call('/api/weddings/'+weddingId)).json()).cover,covers[0].src);assert.equal((await(await f.call('/api/nursery')).json()).albums.yona.cover,covers[1].src);
  assert.equal((await(await f.call('/api/people/yona/page')).json()).person.profile,null,'Baby covers never replace the ordinary person profile');
  assert.equal((await f.call('/api/collections/cover',{method:'POST',body:{collection:scopes[0],mediaId:covers[1].id}})).status,404);
  assert.equal((await f.call('/api/collections/cover',{method:'POST',body:{collection:'gallery',mediaId:covers[0].id}})).status,400);
  assert.equal((await f.call('/api/collections/cover',{method:'POST',body:{collection:scopes[0],mediaId:covers[0].id},clientHeaders:false})).status,403);
  assert.equal((await photoEdit(f,covers[0])).status,201);let wedding=await(await f.call('/api/weddings/'+weddingId)).json();assert.match(wedding.cover,new RegExp('^'+covers[0].src+'\\?v='));
  const date=wedding.date;assert.equal((await f.call('/api/weddings/'+weddingId+'/date',{method:'POST',body:{date,expectedRevision:wedding.revision}})).status,200);assert.equal((await(await f.call('/api/weddings/'+weddingId)).json()).cover,wedding.cover);
  await f.call('/api/media/'+covers[1].id+'/delete',{method:'POST',body:{scope:scopes[1]}});assert.notEqual((await(await f.call('/api/nursery')).json()).albums.yona.cover,covers[1].src);
  await f.call('/api/media/'+covers[1].id+'/restore',{method:'POST',body:{scope:scopes[1]}});assert.equal((await(await f.call('/api/nursery')).json()).albums.yona.cover,covers[1].src);
  assert.equal((await(await f.call('/api/export')).json()).albumCovers.length,2);
 }finally{await f.close();}
});
test('nursery galleries paginate ten photos at a time and keep other family members separate',async()=>{
 const f=fixture();try{
  await f.connect();const files=[];
  for(let n=0;n<12;n++){const response=await f.call('/api/nursery/yona/upload?filename=baby-'+n+'.jpg',{method:'POST',body:photo,headers:{'Content-Length':String(photo.length)}});assert.equal(response.status,201);files.unshift((await response.json()).file);}
  const page1=await(await f.call('/api/nursery/yona')).json(),page2=await(await f.call('/api/nursery/yona?page=2')).json();
  assert.deepEqual(page1.items.map(item=>item.file),files.slice(0,10));assert.deepEqual(page2.items.map(item=>item.file),files.slice(10));assert.equal(page1.pagination.pages,2);assert.equal(page1.pagination.total,12);
  assert.equal((await f.call('/api/nursery/yona?page=0')).status,400);assert.equal((await f.call('/api/nursery/yona?page=1.5')).status,400);
  assert.equal((await(await f.call('/api/nursery/shlomo')).json()).count,0);
  assert.equal((await f.call('/api/nursery/yona',{headers:{'If-None-Match':'"'+page1.revision+'"'}})).status,304);
 }finally{await f.close();}
});

test('renaming canonical people on startup has bounded work independent of thousands of tagged images',async()=>{
 const f=fixture();try{
  await f.connect();const item=await taggedUpload(f);await setTags(f,item,['yona','shlomo']);
  assert.equal((await f.call('/api/people/yona/profile',{method:'POST',body:{file:item.file}})).status,200);
  const insert=f.database.prepare('INSERT INTO media(id,category,person_id,data) VALUES(?,?,?,?)'),tag=f.database.prepare('INSERT INTO media_tags(media_id,person_id) VALUES(?,?)');
  f.database.exec('BEGIN');
  for(let n=1000;n<4000;n++){
   const id=n.toString(16).padStart(32,'0');insert.run(id,'gallery',null,JSON.stringify({id,category:'gallery',file:id+'.jpg',mime:'image/jpeg',kind:'photo',name:'Saved photo',caption:'Saved caption'}));
   for(const person of ['yona','shlomo','yehiel','ruti','avishai','camille','sam','mark'])tag.run(id,person);
  }
  for(const row of f.database.prepare('SELECT id,data FROM people').all()){const p=JSON.parse(row.data);delete p.nameEn;if(p.id==='yona')p.about='Saved biography';f.database.prepare('UPDATE people SET data=? WHERE id=?').run(JSON.stringify(p),p.id);}
  f.database.exec('COMMIT');
  const mediaBefore=f.database.prepare('SELECT id,data FROM media ORDER BY id').all(),tagsBefore=f.database.prepare('SELECT media_id,person_id FROM media_tags ORDER BY media_id,person_id').all();
  const original=f.storage.sql.exec;let writes=0,returnedRows=0;const queries=[];
  f.storage.sql.exec=(query,...args)=>{queries.push(query);if(/^UPDATE people/.test(query))writes++;const r=original(query,...args);returnedRows+=r.toArray().length;return r;};
  f.restart();f.storage.sql.exec=original;
  assert.ok(writes<200,'A rename must not write each tagged album: '+writes);assert.ok(returnedRows<500,'Startup must not read every tagged image: '+returnedRows);
  assert.ok(!queries.some(q=>/JOIN media_tags/.test(q)),'A canonical rename must not traverse media-tag links');
  assert.deepEqual(f.database.prepare('SELECT id,data FROM media ORDER BY id').all(),mediaBefore);assert.deepEqual(f.database.prepare('SELECT media_id,person_id FROM media_tags ORDER BY media_id,person_id').all(),tagsBefore);
  const page=await(await f.call('/api/people/yona/page')).json();assert.equal(page.person.nameEn,'Yona Nakash');assert.equal(page.person.profile,item.src);assert.equal(page.person.about,'Saved biography');assert.equal(page.person.birthday,'16.10.1921');assert.equal(page.person.photoCount,3001);
 }finally{await f.close();}
});
test('a quota failure during initialization is safely reported, does not repeat initialization and recovers after UTC reset',async t=>{
 const f=fixture();try{
  const original=f.storage.sql.exec;let queries=0;
  f.storage.sql.exec=(q,...args)=>{queries++;if(q.startsWith('SELECT'))throw Error('SQLITE_ERROR: rows read limit exceeded for this account');return original(q,...args);};
  f.restart();const afterInit=queries;
  for(let n=0;n<3;n++){const response=await f.call('/api/health');assert.equal(response.status,503);assert.equal((await response.json()).code,'DAILY_STORAGE_LIMIT');}
  assert.equal(queries,afterInit,'Failed initialization must not be retried for every request');
  f.storage.sql.exec=original;const now=Date.now(),nextDay=now-now%86400000+86402000;t.mock.method(Date,'now',()=>nextDay);
  const recovered=await f.call('/api/health');assert.equal(recovered.status,200);assert.deepEqual(await recovered.json(),{available:true});
 }finally{await f.close();}
});
test('initialization errors expose only a fixed category and retry after a bounded cooldown',async t=>{
 const f=fixture();try{
  const original=f.storage.sql.exec;let queries=0;
  f.storage.sql.exec=(q,...args)=>{queries++;if(q.startsWith('SELECT'))throw Error('no such column: private-record-should-never-be-returned');return original(q,...args);};
  f.restart();const afterInit=queries,response=await f.call('/api/health'),body=await response.json();assert.equal(response.status,503);assert.equal(body.code,'STATE_SCHEMA_ERROR');assert.ok(!JSON.stringify(body).includes('private-record'));assert.equal(queries,afterInit);
  f.storage.sql.exec=original;const later=Date.now()+60001;t.mock.method(Date,'now',()=>later);assert.equal((await f.call('/api/health')).status,200);
 }finally{await f.close();}
});

test('biography sections persist independently, reject stale writes and never update another person',async()=>{
 const f=fixture();try{
  await f.connect();const save=(section,value,expectedValue,id='yehiel')=>f.call('/api/people/'+id+'/biography',{method:'POST',body:{section,value,expectedValue}});
  const residences=[{country:'IL',fromYear:1970,toYear:1995,current:false},{country:'GB',fromYear:1995,toYear:null,current:true}];
  let r=await save('residences',residences,[]);assert.equal(r.status,200);assert.deepEqual((await r.json()).person.residences,residences);
  r=await save('languages',[' עברית ','English','English'],[]);assert.equal(r.status,200);assert.deepEqual((await r.json()).person.languages,['עברית','English']);
  assert.equal((await save('occupation','Engineer <authored>','')).status,200);
  const jobs=[{employer:'A & B',role:'Engineer',fromYear:1990,toYear:2000,current:false},{employer:'Family studio',role:'',fromYear:2001,toYear:null,current:true}];
  assert.equal((await save('jobs',jobs,[])).status,200);
  assert.equal((await save('residences',[],[])).status,409,'Another section being saved must not disable stale checks');
  assert.equal((await save('occupation','Different profession','')).status,409);
  assert.equal((await save('languages',['Français'],[],'camille')).status,200);
  f.restart();const p=(await(await f.call('/api/people/yehiel/page')).json()).person;
  assert.deepEqual(p.residences,residences);assert.deepEqual(p.jobs,jobs);assert.equal(p.occupation,'Engineer <authored>');assert.deepEqual(p.languages,['עברית','English']);
  const other=(await(await f.call('/api/people/camille/page')).json()).person;assert.deepEqual(other.languages,['Français']);assert.equal(other.residences,undefined);assert.equal(other.occupation,undefined);
  const exported=await(await f.call('/api/export')).json();assert.deepEqual(exported.people.find(p=>p.id==='yehiel').jobs,jobs);
  const saved=await(await save('jobs',[],jobs)).json();assert.deepEqual(saved.person.jobs,[]);assert.deepEqual(saved.person.residences,residences);
 }finally{await f.close();}
});
test('biography validation rejects malformed countries, years and sections without partially changing saved data',async()=>{
 const f=fixture();try{
  await f.connect();const save=(section,value,expectedValue=[])=>f.call('/api/people/yehiel/biography',{method:'POST',body:{section,value,expectedValue}});
  const residence={country:'IL',fromYear:1980,toYear:1990,current:false};
  for(const bad of [{...residence,country:'ZZ'},{...residence,fromYear:2000},{...residence,toYear:9999},{...residence,current:true},{...residence,fromYear:'1980'}])assert.equal((await save('residences',[residence,bad])).status,400);
  for(const [section,value,expected]of [['__proto__',[],[]],['languages',['x'.repeat(81)],[]],['languages',['English',42],[]],['languages',Array(31).fill('English'),[]],['occupation','x'.repeat(201),''],['jobs',[{employer:'',role:'',fromYear:null,toYear:null,current:false}],[]]])assert.equal((await save(section,value,expected)).status,400);
  assert.equal((await f.call('/api/people/yehiel/biography',{method:'POST',body:{section:'languages',value:['English']}})).status,400);
  const person=(await(await f.call('/api/people/yehiel/page')).json()).person;for(const field of ['residences','languages','occupation','jobs'])assert.equal(person[field],undefined);
  assert.equal((await f.call('/api/people/yehiel/biography',{method:'POST',clientHeaders:false,body:{section:'languages',value:['English'],expectedValue:[]}})).status,403);
 }finally{await f.close();}
});
test('Elisheva memorial dates migrate existing records once while preserving profiles, authored content and later edits',async()=>{
 const f=fixture();try{
  await f.connect();const id='becker-parent';
  const uploaded=await(await f.call('/api/people/'+id+'/photos?filename=memory.jpg',{method:'POST',body:photo,headers:{'Content-Length':String(photo.length)}})).json();
  const old=JSON.parse(f.database.prepare('SELECT data FROM people WHERE id=?').get(id).data);old.birthday='1.1.1111';old.deathDate=null;old.about='A family memory';old.languages=['עברית'];
  f.database.prepare('UPDATE people SET data=? WHERE id=?').run(JSON.stringify(old),id);f.database.prepare('DELETE FROM meta WHERE id=?').run('elisheva-memorial-2026-11-03-owner-v1');
  f.restart();let p=(await(await f.call('/api/people/'+id+'/page')).json()).person;
  assert.equal(p.birthday,'23.3.1942');assert.equal(p.deathDate,'8.5.1998');assert.equal(p.deceased,true);assert.equal(p.profile,uploaded.person.profile);assert.equal(p.about,'A family memory');assert.deepEqual(p.languages,['עברית']);
  const bootstrap=JSON.parse(/window.FAMILY_DATA=(.+);/.exec(await f.connect())[1]);assert.equal(bootstrap.people[id].deceased,true);assert.equal(bootstrap.people[id].deathDate,'8.5.1998');
  assert.equal((await f.call('/api/people/'+id+'/death-date',{method:'POST',body:{date:'9.5.1998',expectedDate:'8.5.1998'}})).status,200);
  assert.equal((await f.ownerBirthday('/api/people/'+id+'/birthday',{method:'POST',body:{birthday:'24.3.1942',expectedBirthday:'23.3.1942'}})).status,200);
  f.restart();p=(await(await f.call('/api/people/'+id+'/page')).json()).person;assert.equal(p.birthday,'24.3.1942');assert.equal(p.deathDate,'9.5.1998');
 }finally{await f.close();}
});

test('visitors can open the site and data without a password or cookie',async()=>{
  const f=fixture();try{
    const home=await f.call('/');assert.equal(home.status,200);assert.equal(await home.text(),'static assets');
    assert.equal((await f.call('/assets/style.css')).status,200);
    const script=await f.connect();assert.match(script,/window.LOCAL_FAMILY_SERVER=true/);assert.equal(script.includes(f.env.HF_SECRET_ACCESS_KEY),false);
    assert.equal(Object.keys((await (await f.call('/api/media')).json()).people).length,Object.keys(family.people).length);
    assert.equal((await f.call('/api/stories')).status,200);
    assert.equal((await f.call('/api/export')).status,200);
    f.env.FAMILY_PASSWORD='a-leftover-setting-is-ignored';assert.equal((await f.call('/')).status,200);
  }finally{await f.close();}
});
test('birthdays are read-only for all public visitors while biography editing retains origin and token protection',async()=>{
  const f=fixture();try{
    await f.connect();const before=(await(await f.call('/api/people/yona')).json()).birthday;
    for(const birthday of ['1.1.2000','',before]){
      const result=await f.call('/api/people/yona/birthday',{method:'POST',body:{birthday,expectedBirthday:before}});
      assert.equal(result.status,403);assert.equal((await result.json()).code,'BIRTHDAY_READ_ONLY');
    }
    assert.equal((await(await f.call('/api/people/yona')).json()).birthday,before);
    const body={about:'A family story',expectedAbout:'',language:'he'};
    assert.equal((await f.call('/api/people/yona/about',{method:'POST',body,clientHeaders:false})).status,403);
    assert.equal((await f.call('/api/people/yona/about',{method:'POST',body,headers:{'X-Family-Token':'wrong'}})).status,403);
    assert.equal((await f.call('/api/people/yona/about',{method:'POST',body,headers:{Origin:'https://other.example'}})).status,403);
    const result=await f.call('/api/people/yona/about',{method:'POST',body});assert.equal(result.status,200);assert.equal((await result.json()).person.about,body.about);
  }finally{await f.close();}
});
test('owner birthday updates retain validation, stale-write conflicts and durable reload',async()=>{
  const f=fixture();try{
    await f.connect();
    const body={birthday:'29.2.2000',expectedBirthday:'16.10.1921'};
    let response=await f.ownerBirthday('/api/people/yona/birthday',{method:'POST',body});assert.equal(response.status,200);assert.equal((await response.json()).person.birthday,'29.2.2000');
    assert.equal((await f.ownerBirthday('/api/people/yona/birthday',{method:'POST',body})).status,409);
    for(const value of ['29.2.2001','1.1.9999','bad'])assert.equal((await f.ownerBirthday('/api/people/yona/birthday',{method:'POST',body:{birthday:value,expectedBirthday:'29.2.2000'}})).status,400);
    f.restart();assert.equal((await (await f.call('/api/people/yona')).json()).birthday,'29.2.2000');
    response=await f.ownerBirthday('/api/people/yona/birthday',{method:'POST',body:{birthday:'',expectedBirthday:'29.2.2000'}});assert.equal((await response.json()).person.birthday,'1.1.1111');
  }finally{await f.close();}
});
test('tree corrections update existing names and add a spouse without changing saved family content',async()=>{
  const f=fixture();try{
    await f.connect();
    let response=await f.ownerBirthday('/api/people/bosmat/birthday',{method:'POST',body:{birthday:'2.3.1980',expectedBirthday:'1.1.1111'}});assert.equal(response.status,200);
    response=await f.call('/api/people/bosmat/photos?filename=family.jpg',{method:'POST',body:photo,headers:{'Content-Length':String(photo.length)}});assert.equal(response.status,201);
    const file=(await response.json()).file;
    response=await f.call('/api/people/bosmat/profile',{method:'POST',body:{file}});assert.equal(response.status,200);
    response=await f.call('/api/people/bosmat/caption',{method:'POST',body:{file,caption:'תיאור שנשמר לפני תיקון השם'}});assert.equal(response.status,200);
    response=await f.call('/api/stories',{method:'POST',body:{title:'זיכרון משפחתי',year:2000,body:'סיפור שנשמר לפני העדכון'}});assert.equal(response.status,201);
    const before=await (await f.call('/api/people/bosmat')).json();
    const tagged=await taggedUpload(f);await setTags(f,tagged,['memo','camille']);
    const beforeTagged=await f.call('/api/collections/photos');
    for(const [id,name] of [['bosmat','בשמת מאיר'],['itzik','איציק'],['rami','רמי'],['memo','ממו וארגאס'],['camille','קמיל דה ווילה']]){
      const person=JSON.parse(f.database.prepare('SELECT data FROM people WHERE id=?').get(id).data);person.name=name;
      f.database.prepare('UPDATE people SET data=? WHERE id=?').run(JSON.stringify(person),id);
    }
    f.database.prepare('DELETE FROM people WHERE id=?').run('rachel-katan');
    f.restart();
    const after=await (await f.call('/api/people/bosmat')).json();
    assert.equal(after.name,'בשמת קהא');assert.equal(after.birthday,before.birthday);assert.equal(after.profile,before.profile);assert.equal(after.profileIsManual,true);assert.deepEqual(after.gallery,before.gallery);
    assert.equal((await (await f.call('/api/people/itzik')).json()).name,'איציק מאיר');
    assert.equal((await (await f.call('/api/people/rami')).json()).name,'רמי גנדלמן');
    const graph=JSON.parse(/window.FAMILY_DATA=(.+);/.exec(await f.connect())[1]);
    assert.equal(graph.people.chantal.name,'שנטל פירוז');assert.equal(graph.people.camille.name,'קמיל דה ויטה');assert.equal(graph.people.memo.name,'גיירמו וארגאס');assert.equal(graph.people.memo.firstName,'גיירמו');assert.equal(graph.people['rachel-katan'].name,'רחל קטן');assert.deepEqual(graph.units['u-yehiel'].people,['yehiel','rachel-katan']);
    const renamedTags=await f.call('/api/collections/photos',{headers:{'If-None-Match':beforeTagged.headers.get('ETag')}});assert.equal(renamedTags.status,200,'A rename must refresh existing cached tag labels');
    const taggedPhoto=(await renamedTags.json()).items[0];assert.equal(taggedPhoto.id,tagged.id);assert.deepEqual(taggedPhoto.tags.map(person=>person.name),['קמיל דה ויטה','גיירמו וארגאס']);
    const roster=(await (await f.call('/api/tag-people')).json()).people;assert.equal(roster.find(person=>person.id==='memo').name,'גיירמו וארגאס');assert.equal(roster.find(person=>person.id==='camille').name,'קמיל דה ויטה');
    assert.equal((await (await f.call('/api/stories')).json()).stories[0].body,'סיפור שנשמר לפני העדכון');
    assert.deepEqual(new Uint8Array(await (await f.call(after.gallery[0].src)).arrayBuffer()),new Uint8Array(photo));
    f.restart();assert.equal((await (await f.call('/api/people/bosmat')).json()).revision,after.revision,'Applying the same tree twice must not change the person again');
  }finally{await f.close();}
});
test('personal uploads, captions, profile selection and ownership checks',async()=>{
  const f=fixture();try{
    await f.connect();let response=await f.call('/api/people/yona/photos?filename=family.jpg',{method:'POST',body:photo,headers:{'Content-Length':String(photo.length)}});
    assert.equal(response.status,201);const result=await response.json(),key=result.file;assert.equal(result.person.photoCount,1);
    response=await f.call('/api/people/yona/caption',{method:'POST',body:{file:key,caption:'תיאור משפחתי'}});assert.equal(response.status,200);
    response=await f.call('/api/people/yona/profile',{method:'POST',body:{file:key}});assert.equal((await response.json()).person.profileIsManual,true);
    const other=Object.keys((await (await f.call('/api/media')).json()).people).find(id=>id!=='yona');
    assert.equal((await f.call('/api/people/'+other+'/profile',{method:'POST',body:{file:key}})).status,404);
    const gallery=await (await f.call('/api/people/yona')).json();assert.equal(gallery.gallery[0].caption,'תיאור משפחתי');
    const bytes=new Uint8Array(await (await f.call(gallery.gallery[0].src)).arrayBuffer());assert.deepEqual(bytes,new Uint8Array(photo));
    f.restart();assert.equal((await (await f.call('/api/people/yona')).json()).profileIsManual,true);
  }finally{await f.close();}
});
test('shared video upload streams intact and the private proxy supports seeking',async()=>{
  const f=fixture();try{
    await f.connect();const response=await f.call('/api/collections/videos/upload?filename=family.mp4',{method:'POST',body:video,headers:{'Content-Length':String(video.length)}});
    assert.equal(response.status,201);const result=await response.json(),item=result.collection.items[0];assert.equal(item.mime,'video/mp4');
    let media=await f.call(item.src,{headers:{Range:'bytes=0-31'}});assert.equal(media.status,206);assert.deepEqual(new Uint8Array(await media.arrayBuffer()),new Uint8Array(video.subarray(0,32)));
    media=await f.call(item.src,{headers:{Range:'bytes=-16'}});assert.equal(media.status,206);assert.deepEqual(new Uint8Array(await media.arrayBuffer()),new Uint8Array(video.subarray(-16)));
    assert.equal((await f.call(item.src,{headers:{Range:'bytes=99999999-'}})).status,416);
    assert.equal((await f.call(item.src,{method:'HEAD'})).headers.get('Content-Length'),String(video.length));
    const snap=await f.call('/api/collections/videos');assert.equal((await f.call('/api/collections/videos',{headers:{'If-None-Match':snap.headers.get('ETag')}})).status,304);
  }finally{await f.close();}
});
test('journal creation, editing, TXT import and attachment rollback',async()=>{
  const f=fixture();try{
    await f.connect();let response=await f.call('/api/stories',{method:'POST',body:{title:'הסיפור שלנו',year:'1998',author:'המשפחה',body:'סיפור משפחתי'}});
    assert.equal(response.status,201);const original=(await response.json()).story;
    const updated={...original,year:1999,expectedUpdatedAt:original.updatedAt};response=await f.call('/api/stories/'+original.id,{method:'POST',body:updated});assert.equal(response.status,200);
    assert.equal((await f.call('/api/stories/'+original.id,{method:'POST',body:updated})).status,409);
    const form=new FormData();form.set('title','סיפור מקובץ');form.set('year','1975');form.set('body','');form.append('files',new File(['טקסט בעברית'],'story.txt',{type:'text/plain'}));
    response=await f.call('/api/stories',{method:'POST',body:form});assert.equal(response.status,201);const story=(await response.json()).story;assert.equal(story.body,'טקסט בעברית');assert.equal(story.attachments.length,1);
    const attachment=await f.call(story.attachments[0].src);assert.match(attachment.headers.get('Content-Disposition'),/^attachment;/);assert.equal(await attachment.text(),'טקסט בעברית');
    const stale=new FormData();stale.set('title','התנגשות');stale.set('year','1990');stale.set('body','בדיקה');stale.set('expectedUpdatedAt','wrong');stale.append('files',new File(['new'],'new.txt',{type:'text/plain'}));
    const objectCount=f.objects.size;response=await f.call('/api/stories/'+original.id,{method:'POST',body:stale});assert.equal(response.status,409);
    await f.flush();assert.equal(f.objects.size,objectCount);
    const all=await (await f.call('/api/stories')).json();assert.deepEqual(all.stories.map(item=>item.year),[1975,1999]);
  }finally{await f.close();}
});
test('missing storage configuration preserves text editing and explains upload limits',async()=>{
  const f=fixture();try{
    await f.connect();f.env.HF_ACCESS_KEY_ID='';assert.equal((await (await f.call('/api/setup')).json()).mediaConfigured,false);
    assert.equal((await f.call('/api/stories',{method:'POST',body:{title:'ללא קובץ',year:2000,body:'תוכן'}})).status,201);
    assert.equal((await f.call('/api/collections/photos/upload?filename=x.jpg',{method:'POST',body:photo,headers:{'Content-Length':String(photo.length)}})).status,503);
    f.env.HF_ACCESS_KEY_ID='HFAK_TEST_ONLY';
    assert.equal((await f.call('/api/collections/videos/upload?filename=x.mp4',{method:'POST',body:'x',headers:{'Content-Length':String(LIMITS.video+1)}})).status,413);
    assert.equal((await f.call('/api/collections/photos/upload?filename=x.jpg',{method:'POST',body:'not an image',headers:{'Content-Length':'12'}})).status,415);
    const backup=await f.call('/api/export');assert.match(backup.headers.get('Content-Disposition'),/family-backup.json/);assert.equal((await backup.json()).people.length,Object.keys(family.people).length);
  }finally{await f.close();}
});
test('S3 signing scopes requests to the configured private bucket',async()=>{
  const env={HF_NAMESPACE:'example',HF_BUCKET:'family',HF_ACCESS_KEY_ID:'HFAK_TEST',HF_SECRET_ACCESS_KEY:'secret'};
  const request=await signedRequest(env,'photos/shared/abc.jpg',{now:new Date('2026-10-31T12:00:00Z')});
  assert.equal(request.url,'https://s3.hf.co/example/family/photos/shared/abc.jpg');
  assert.match(request.headers.get('Authorization'),/Credential=HFAK_TEST\/20261031\/us-east-1\/s3\/aws4_request/);
  assert.equal(request.headers.get('x-amz-date'),'20261031T120000Z');
  await assert.rejects(signedRequest(env,'../outside'),/הגדרת האחסון/);
  assert.throws(()=>sniff(new TextEncoder().encode('bad')),/בחרו תמונת/);
});
test('weddings include all couples and retain valid anniversary dates across restarts',async()=>{
  const f=fixture();try{
    await f.connect();const list=await (await f.call('/api/weddings')).json();assert.equal(list.weddings.length,23);
    assert.ok(list.weddings.every(item=>item.people.length===2&&item.date===''));
    assert.deepEqual(list.weddings.find(item=>item.id==='u-yehiel').people,['yehiel','rachel-katan']);
    assert.equal((await f.call('/api/weddings/u-naama')).status,404);
    const original=list.weddings.find(item=>item.id==='u-yehiel');
    let response=await f.call('/api/weddings/u-yehiel/date',{method:'POST',body:{date:'1.1.2000',expectedRevision:original.revision}});assert.equal(response.status,200);
    const changed=(await response.json()).wedding;assert.equal(changed.date,'1.1.2000');
    assert.equal((await f.call('/api/weddings/u-yehiel/date',{method:'POST',body:{date:'2.1.2000',expectedRevision:original.revision}})).status,409);
    for(const date of ['31.4.2000','29.2.2001','1.1.9999','1.1.1111','wrong',42])assert.equal((await f.call('/api/weddings/u-yehiel/date',{method:'POST',body:{date,expectedRevision:changed.revision}})).status,400);
    f.restart();const restored=await (await f.call('/api/weddings/u-yehiel')).json();assert.equal(restored.date,'1.1.2000');assert.equal(restored.revision,changed.revision);
    response=await f.call('/api/weddings/u-yehiel/date',{method:'POST',body:{date:'',expectedRevision:changed.revision}});assert.equal(response.status,200);assert.equal((await response.json()).wedding.date,'');
    assert.equal((await f.call('/api/weddings/u-naama/date',{method:'POST',body:{date:'1.1.2000',expectedRevision:'x'}})).status,404);
  }finally{await f.close();}
});
test('wedding galleries isolate couples, stream mixed media and retain captions',async()=>{
  const f=fixture();try{
    await f.connect();const root='/api/weddings/u-yehiel',other='/api/weddings/u-bosmat';
    const pdf=new TextEncoder().encode('%PDF-1.4\nA wedding blessing\n%%EOF');
    let photoFile;
    for(const [name,bytes,kind]of [['ceremony.jpg',photo,'photo'],['celebration.mp4',video,'video'],['blessing.pdf',pdf,'document']]){
      const response=await f.call(root+'/upload?filename='+name,{method:'POST',body:bytes,headers:{'Content-Length':String(bytes.length)}});assert.equal(response.status,201);
      const uploaded=await response.json(),item=uploaded.collection.items[0];assert.equal(item.kind,kind);
      assert.deepEqual(new Uint8Array(await (await f.call(item.src)).arrayBuffer()),new Uint8Array(bytes));
      if(kind==='photo')photoFile=item.file;
      if(kind==='document')assert.match((await f.call(item.src)).headers.get('Content-Disposition'),/^attachment;/);
      if(kind==='video'){const part=await f.call(item.src,{headers:{Range:'bytes=0-15'}});assert.equal(part.status,206);assert.deepEqual(new Uint8Array(await part.arrayBuffer()),new Uint8Array(video.subarray(0,16)));}
    }
    assert.equal((await f.call(root+'/caption',{method:'POST',body:{file:photoFile,caption:'בדרך לחופה'}})).status,200);
    assert.equal((await f.call(other+'/caption',{method:'POST',body:{file:photoFile,caption:'Wrong couple'}})).status,404);
    const metadata=await (await f.call(root)).json();assert.equal(metadata.mediaCount,3);assert.equal(metadata.collection.items.find(item=>item.file===photoFile).caption,'בדרך לחופה');
    assert.equal((await (await f.call(other)).json()).mediaCount,0);
    assert.equal((await (await f.call('/api/collections/photos')).json()).count,0);
    assert.ok([...f.objects.keys()].every(key=>key.startsWith('/example-owner/keha-family/weddings/u-yehiel/')));
    const count=f.objects.size;assert.equal((await f.call('/api/weddings/u-naama/upload?filename=x.jpg',{method:'POST',body:photo,headers:{'Content-Length':String(photo.length)}})).status,404);assert.equal(f.objects.size,count);
    f.restart();assert.equal((await (await f.call(root)).json()).mediaCount,3);
  }finally{await f.close();}
});
test('wedding greetings are durable, separate for every couple and exported with anniversaries',async()=>{
  const f=fixture();try{
    await f.connect();const path='/api/weddings/u-eldad';
    let response=await f.call(path+'/greetings',{method:'POST',body:{author:'משפחת קהא',body:'מזל טוב <3\nשתמיד תשמחו יחד!'}});assert.equal(response.status,201);
    assert.equal((await response.json()).greeting.body,'מזל טוב <3\nשתמיד תשמחו יחד!');
    for(const body of ['',null,'x'.repeat(10001)])assert.equal((await f.call(path+'/greetings',{method:'POST',body:{body}})).status,400);
    assert.equal((await f.call('/api/weddings/u-naama/greetings',{method:'POST',body:{body:'מזל טוב'}})).status,404);
    f.restart();const wedding=await (await f.call(path)).json();assert.equal(wedding.greetingCount,1);assert.equal(wedding.greetings[0].author,'משפחת קהא');
    assert.equal((await (await f.call('/api/weddings/u-bosmat')).json()).greetingCount,0);
    const backup=await (await f.call('/api/export')).json();assert.equal(backup.schemaVersion,3);assert.equal(backup.weddings.length,23);assert.equal(backup.greetings.length,1);assert.equal(backup.people.length,Object.keys(family.people).length);
  }finally{await f.close();}
});
test('nostalgia supports photos, video and downloadable documents without altering other albums',async()=>{
  const f=fixture();try{
    await f.connect();const doc=new Uint8Array([208,207,17,224,161,177,26,225,0,0,0,0]);
    const examples=[['old-photo.jpg',photo,'photo'],['old-film.mp4',video,'video'],['letter.txt',new TextEncoder().encode('מכתב משפחתי ישן'),'document'],['letter.doc',doc,'document']];
    for(const[name,bytes,kind]of examples){
      const response=await f.call('/api/nostalgia/upload?filename='+name,{method:'POST',body:bytes,headers:{'Content-Length':String(bytes.length)}});assert.equal(response.status,201);
      const item=(await response.json()).collection.items[0];assert.equal(item.kind,kind);const content=await f.call(item.src);assert.deepEqual(new Uint8Array(await content.arrayBuffer()),new Uint8Array(bytes));
      if(kind==='document')assert.match(content.headers.get('Content-Disposition'),/^attachment;/);
    }
    const initial=await (await f.call('/api/nostalgia')).json();assert.equal(initial.count,4);
    const file=initial.items[0].file;assert.equal((await f.call('/api/nostalgia/caption',{method:'POST',body:{file,caption:'מכתב מהבית הישן'}})).status,200);
    const snapshot=await f.call('/api/nostalgia');assert.equal((await f.call('/api/nostalgia',{headers:{'If-None-Match':snapshot.headers.get('ETag')}})).status,304);
    f.restart();assert.equal((await (await f.call('/api/nostalgia')).json()).items[0].caption,'מכתב מהבית הישן');
    assert.equal((await (await f.call('/api/collections/videos')).json()).count,6);assert.equal((await (await f.call('/api/weddings/u-root')).json()).mediaCount,0);
    assert.equal((await f.call('/api/nostalgia/caption',{method:'POST',body:{file,caption:'x'},headers:{Origin:'https://foreign.example'}})).status,403);
  }finally{await f.close();}
});
test('mixed galleries reject invalid document signatures and enforce per-type upload limits',async()=>{
  const f=fixture();try{
    await f.connect();const pdf=new TextEncoder().encode(('%PDF-1.4\nExample').padEnd(200,' '));
    for(const name of ['bad.pdf','bad.docx','bad.doc','page.html']){
      const bytes=new TextEncoder().encode('This is not the specified document');assert.equal((await f.call('/api/nostalgia/upload?filename='+name,{method:'POST',body:bytes,headers:{'Content-Length':String(bytes.length)}})).status,415);
    }
    assert.equal((await f.call('/api/nostalgia/upload?filename=big.pdf',{method:'POST',body:pdf,headers:{'Content-Length':String(LIMITS.attachment+1)}})).status,413);
    assert.equal((await f.call('/api/weddings/u-root/upload?filename=big.jpg',{method:'POST',body:photo,headers:{'Content-Length':String(LIMITS.photo+1)}})).status,413);
    assert.equal(f.objects.size,0);
    f.env.HF_ACCESS_KEY_ID='';assert.equal((await f.call('/api/nostalgia/upload?filename=photo.jpg',{method:'POST',body:photo,headers:{'Content-Length':String(photo.length)}})).status,503);
    assert.equal((await f.call('/api/weddings/u-root/greetings',{method:'POST',body:{body:'ברכה ללא קובץ'}})).status,201);
  }finally{await f.close();}
});
test('Yona death information is visible in family data and preserves existing birthdays',async()=>{
  const f=fixture();try{
    await f.connect();const person=await (await f.call('/api/people/yona')).json();assert.equal(person.deceased,true);assert.equal(person.deathDate,'16.6.2010');
    const bootstrap=JSON.parse(/window.FAMILY_DATA=(.+);/.exec(await f.connect())[1]);assert.equal(bootstrap.people.yona.deathDate,'16.6.2010');
    assert.equal((await f.ownerBirthday('/api/people/yona/birthday',{method:'POST',body:{birthday:'1.1.2015',expectedBirthday:person.birthday}})).status,400);
    const response=await f.ownerBirthday('/api/people/yona/birthday',{method:'POST',body:{birthday:'1.1.1930',expectedBirthday:person.birthday}});assert.equal(response.status,200);
    f.restart();const restored=await (await f.call('/api/people/yona')).json();assert.equal(restored.birthday,'1.1.1930');assert.equal(restored.deathDate,'16.6.2010');
  }finally{await f.close();}
});
test('special birthdays contain six unique YouTube videos and deletions survive deployment',async()=>{
  const f=fixture();try{
    await f.connect();const response=await f.call('/api/collections/videos'),initial=await response.json();
    assert.equal(initial.count,6);assert.equal(new Set(initial.items.map(item=>item.youtubeId)).size,6);
    assert.deepEqual(initial.items.map(item=>item.youtubeId),['LTTdcZUSF7A','bbsWuwVwHks','CqkreY-_mSs','KUP1WtKCtec','UerqNt1Hhc0','pws4Fk1jSFo']);
    assert.ok(initial.items.every(item=>item.provider==='youtube'&&item.videoCategory==='special-birthdays'&&item.scope==='videos'&&/^[a-f0-9]{32}$/.test(item.id)));
    const ora=initial.items.find(item=>item.youtubeId==='CqkreY-_mSs');assert.equal(ora.name,'אורה בת 60');
    const redirect=await f.call(ora.src);assert.equal(redirect.status,302);assert.equal(redirect.headers.get('Location'),'https://www.youtube.com/watch?v=CqkreY-_mSs');
    assert.equal(f.network.length,0,'Embedded videos do not upload or retrieve binary files');
    assert.equal((await f.call('/api/media/'+ora.id+'/delete',{method:'POST',body:{scope:'photos'}})).status,404);
    assert.equal((await f.call('/api/media/'+ora.id+'/delete',{method:'POST',body:{scope:'videos'},headers:{Origin:'https://foreign.example'}})).status,403);
    const deleted=await (await f.call('/api/media/'+ora.id+'/delete',{method:'POST',body:{scope:'videos'}})).json();assert.equal(deleted.collection.count,5);
    assert.notEqual(deleted.collection.revision,initial.revision);assert.equal((await f.call(ora.src)).status,404);
    assert.equal((await f.call('/api/collections/videos',{headers:{'If-None-Match':response.headers.get('ETag')}})).status,200);
    f.restart();assert.equal((await (await f.call('/api/collections/videos')).json()).count,5,'A source seed must not resurrect deleted videos');
    assert.ok(!(await (await f.call('/api/export')).json()).media.some(item=>item.id===ora.id));
    const restored=await (await f.call('/api/media/'+ora.id+'/restore',{method:'POST',body:{scope:'videos'}})).json();assert.equal(restored.collection.count,6);
    f.restart();assert.equal((await (await f.call('/api/collections/videos')).json()).count,6);
    assert.match((await f.call('/')).headers.get('Content-Security-Policy'),/frame-src 'self' https:\/\/www.youtube-nocookie.com/);
  }finally{await f.close();}
});
test('personal photo deletion updates portraits, preserves dates and supports conservative undo',async()=>{
  const f=fixture();try{
    await f.connect();await f.ownerBirthday('/api/people/chantal/birthday',{method:'POST',body:{birthday:'2.3.1980',expectedBirthday:'1.1.1111'}});
    for(const name of ['first.jpg','second.jpg'])assert.equal((await f.call('/api/people/chantal/photos?filename='+name,{method:'POST',body:photo,headers:{'Content-Length':String(photo.length)}})).status,201);
    let person=await (await f.call('/api/people/chantal')).json();const [first,second]=person.gallery;
    await f.call('/api/people/chantal/profile',{method:'POST',body:{file:first.file}});
    const path='/api/media/'+first.id,body={scope:'personal:chantal'};
    assert.equal((await f.call(path+'/delete',{method:'POST',body:{scope:'personal:yona'}})).status,404);
    person=(await (await f.call(path+'/delete',{method:'POST',body})).json()).person;
    assert.equal(person.name,'שנטל פירוז');assert.equal(person.birthday,'2.3.1980');assert.equal(person.photoCount,1);assert.equal(person.profile,second.src);assert.equal(person.profileIsManual,false);
    assert.equal((await f.call(first.src)).status,404);assert.equal(f.objects.size,2,'Deleting a gallery item is reversible without removing the stored original');
    f.restart();assert.equal((await (await f.call('/api/people/chantal')).json()).profile,second.src);
    person=(await (await f.call(path+'/restore',{method:'POST',body})).json()).person;assert.equal(person.profile,first.src);assert.equal(person.profileIsManual,true);
    await f.call(path+'/delete',{method:'POST',body});await f.call('/api/people/chantal/profile',{method:'POST',body:{file:second.file}});
    person=(await (await f.call(path+'/restore',{method:'POST',body})).json()).person;assert.equal(person.profile,second.src,'Undo must not replace a new profile choice');
    assert.deepEqual(new Uint8Array(await (await f.call(first.src)).arrayBuffer()),new Uint8Array(photo));
    assert.equal((await (await f.call('/api/people/yona')).json()).photoCount,0);
  }finally{await f.close();}
});
test('delete and restore isolate shared, wedding and nostalgia galleries and keep counters current',async()=>{
  const f=fixture();try{
    await f.connect();
    for(const [root,scope]of [['/api/collections/photos','photos'],['/api/weddings/u-yehiel','wedding:u-yehiel'],['/api/nostalgia','nostalgia']]){
      const result=await (await f.call(root+'/upload?filename=memory.jpg',{method:'POST',body:photo,headers:{'Content-Length':String(photo.length)}})).json(),item=result.collection.items[0];
      const body={scope},path='/api/media/'+item.id;
      assert.equal((await f.call(path+'/delete',{method:'POST',body,clientHeaders:false})).status,403);
      let response=await f.call(path+'/delete',{method:'POST',body});assert.equal(response.status,200);let changed=await response.json();assert.equal(changed.collection.count,0);assert.notEqual(changed.collection.revision,result.collection.revision);
      if(scope.startsWith('wedding:')){assert.equal(changed.wedding.mediaCount,0);assert.equal(changed.wedding.cover,null);}
      f.restart();assert.equal((await f.call(item.src)).status,404);
      assert.equal((await f.call(path+'/restore',{method:'POST',body:{scope:'videos'}})).status,404);
      response=await f.call(path+'/restore',{method:'POST',body});assert.equal(response.status,200);changed=await response.json();assert.equal(changed.collection.count,1);
      if(changed.wedding){assert.equal(changed.wedding.mediaCount,1);assert.equal(changed.wedding.cover,item.src);}
      assert.deepEqual(new Uint8Array(await (await f.call(item.src)).arrayBuffer()),new Uint8Array(photo));
    }
    assert.equal((await (await f.call('/api/weddings/u-bosmat')).json()).mediaCount,0);assert.equal((await (await f.call('/api/collections/videos')).json()).count,6);
    const form=new FormData();form.set('title','סיפור');form.set('year','2000');form.append('files',new File(['זיכרון'],'story.txt',{type:'text/plain'}));
    const story=(await (await f.call('/api/stories',{method:'POST',body:form})).json()).story,id=story.attachments[0].src.split('/').pop();
    assert.equal((await f.call('/api/media/'+id+'/delete',{method:'POST',body:{scope:'attachment'}})).status,400);
    assert.equal((await f.call(story.attachments[0].src)).status,200);
  }finally{await f.close();}
});
test('new video uploads keep their chosen birthday category',async()=>{
  const f=fixture();try{
    await f.connect();
    const result=await (await f.call('/api/collections/videos/upload?filename=birthday.mp4&group=special-birthdays',{method:'POST',body:video,headers:{'Content-Length':String(video.length)}})).json();
    assert.equal(result.collection.count,7);assert.equal(result.collection.items[0].videoCategory,'special-birthdays');assert.equal(result.collection.items[0].provider,undefined);
    f.restart();assert.equal((await (await f.call('/api/collections/videos')).json()).items[0].videoCategory,'special-birthdays');
    assert.equal((await f.call('/api/collections/videos/upload?filename=bad.mp4&group=other',{method:'POST',body:video,headers:{'Content-Length':String(video.length)}})).status,400);
    assert.equal(f.objects.size,1);
  }finally{await f.close();}
});
async function taggedUpload(f,path='/api/collections/photos',bytes=photo,name='together.jpg'){
  const response=await f.call(path+'/upload?filename='+name,{method:'POST',body:bytes,headers:{'Content-Length':String(bytes.length)}});assert.equal(response.status,201);
  const result=await response.json();return result.collection.items[0];
}
async function setTags(f,item,personIds,newNames=[],revision){
  const before=revision===undefined?(await (await f.call('/api/media/'+item.id+'/tags')).json()).item.tagsRevision:revision;
  return f.call('/api/media/'+item.id+'/tags',{method:'POST',body:{personIds,newNames,expectedRevision:before}});
}
test('one shared photo appears immediately in every tagged personal album without copying it',async()=>{
  const f=fixture();try{
    await f.connect();const item=await taggedUpload(f),before=await f.call('/api/people/chantal');
    const response=await setTags(f,item,['chantal','camille','chantal']);assert.equal(response.status,200);const changed=await response.json();
    assert.deepEqual(changed.item.tags.map(person=>person.name),['קמיל דה ויטה','שנטל פירוז']);
    for(const id of ['chantal','camille']){const person=changed.people[id];assert.equal(person.photoCount,1);assert.equal(person.mediaCount,1);assert.equal(person.gallery[0].id,item.id);assert.equal(person.gallery[0].src,item.src);assert.equal(person.gallery[0].linked,true);assert.equal(person.gallery[0].scope,'photos');}
    assert.equal((await f.call('/api/people/chantal',{headers:{'If-None-Match':before.headers.get('ETag')}})).status,200);
    assert.equal(f.objects.size,1);assert.equal(f.database.prepare('SELECT count(*) AS n FROM media WHERE id=?').get(item.id).n,1);
    const source=await (await f.call('/api/collections/photos')).json();assert.equal(source.count,1);assert.deepEqual(source.items[0].tags,changed.item.tags);
    const revision=changed.item.tagsRevision;const same=await (await setTags(f,item,['camille','chantal'])).json();assert.equal(same.item.tagsRevision,revision,'Saving the same membership must not create duplicates or unnecessary revisions');
    f.restart();const restored=await (await f.call('/api/people/camille')).json();assert.equal(restored.gallery[0].id,item.id);assert.equal(restored.photoCount,1);
    assert.equal((await (await f.call('/api/media')).json()).people.chantal.photoCount,1);
  }finally{await f.close();}
});
test('tagging an owner deduplicates the album, and captions stay shared across personal albums',async()=>{
  const f=fixture();try{
    await f.connect();const uploaded=await (await f.call('/api/people/chantal/photos?filename=mine.jpg',{method:'POST',body:photo,headers:{'Content-Length':String(photo.length)}})).json(),item=uploaded.person.gallery[0];
    assert.equal((await setTags(f,item,['chantal','camille'])).status,200);
    assert.equal((await (await f.call('/api/people/chantal')).json()).photoCount,1);assert.equal((await (await f.call('/api/people/camille')).json()).photoCount,1);
    const response=await f.call('/api/people/camille/caption',{method:'POST',body:{file:item.file,caption:'שתינו יחד'}});assert.equal(response.status,200);
    assert.equal((await (await f.call('/api/people/chantal')).json()).gallery[0].caption,'שתינו יחד');
    await setTags(f,item,[]);assert.equal((await (await f.call('/api/people/chantal')).json()).photoCount,1,'The original owner keeps a photo even when their explicit tag is removed');assert.equal((await (await f.call('/api/people/camille')).json()).photoCount,0);
    assert.equal((await f.call(item.src)).status,200);assert.equal(f.objects.size,1);
  }finally{await f.close();}
});
test('tagged YouTube and uploaded videos appear as videos and never become profile photos',async()=>{
  const f=fixture();try{
    await f.connect();const youtube=(await (await f.call('/api/collections/videos')).json()).items[0];
    await setTags(f,youtube,['yehiel']);let person=await (await f.call('/api/people/yehiel')).json();assert.equal(person.videoCount,1);assert.equal(person.photoCount,0);assert.equal(person.profile,null);assert.equal(person.gallery[0].provider,'youtube');
    assert.equal((await f.call('/api/people/yehiel/profile',{method:'POST',body:{file:youtube.file}})).status,404);
    const film=await taggedUpload(f,'/api/nostalgia',video,'old-film.mp4');await setTags(f,film,['yehiel']);person=await (await f.call('/api/people/yehiel')).json();assert.equal(person.videoCount,2);assert.equal(person.mediaCount,2);
    f.restart();assert.equal((await (await f.call('/api/people/yehiel')).json()).videoCount,2);assert.equal(f.objects.size,1);
  }finally{await f.close();}
});
test('adding a name creates a durable album and reuses existing canonical or newly added names',async()=>{
  const f=fixture();try{
    await f.connect();const item=await taggedUpload(f);
    let response=await setTags(f,item,[],['שנטל פירוז','אורח חדש',' אורח   חדש ']);assert.equal(response.status,200);let changed=await response.json();assert.equal(changed.item.tags.length,2);
    const added=changed.item.tags.find(person=>person.extra);assert.ok(added.id.startsWith('extra-'));assert.equal(changed.people[added.id].photoCount,1);
    assert.equal((await (await f.call('/api/tag-people')).json()).people.length,Object.keys(family.people).length+1);assert.equal((await (await f.call('/api/weddings')).json()).weddings.length,23);
    const bootstrap=JSON.parse(/window.FAMILY_DATA=(.+);/.exec(await f.connect())[1]);assert.equal(bootstrap.people[added.id].name,'אורח חדש');assert.equal(bootstrap.people[added.id].extra,true);assert.ok(!Object.values(bootstrap.units).some(unit=>unit.people.includes(added.id)));
    f.restart();response=await setTags(f,item,[],['אורח חדש']);changed=await response.json();assert.equal(changed.item.tags[0].id,added.id);assert.equal((await (await f.call('/api/tag-people')).json()).people.length,Object.keys(family.people).length+1);
    assert.equal((await f.call('/api/people/'+added.id+'/photos?filename=portrait.jpg',{method:'POST',body:photo,headers:{'Content-Length':String(photo.length)}})).status,201);
    const backup=await (await f.call('/api/export')).json();assert.ok(backup.people.some(person=>person.id===added.id));assert.deepEqual(backup.tags,[{mediaId:item.id,personId:added.id}]);
  }finally{await f.close();}
});
test('removing a linked item only removes that person\'s tag, with undo and profile fallback',async()=>{
  const f=fixture();try{
    await f.connect();const item=await taggedUpload(f,'/api/weddings/u-yehiel');await setTags(f,item,['chantal','camille']);
    await f.call('/api/people/chantal/profile',{method:'POST',body:{file:item.file}});
    let response=await f.call('/api/media/'+item.id+'/untag',{method:'POST',body:{scope:'personal:chantal'}});assert.equal(response.status,200);let result=await response.json();assert.equal(result.wasProfile,true);assert.equal(result.people.chantal.photoCount,0);assert.equal(result.people.chantal.profile,null);assert.equal(result.people.camille.photoCount,1);assert.equal(result.collection.count,1);
    assert.equal((await f.call(item.src)).status,200);f.restart();assert.equal((await (await f.call('/api/people/chantal')).json()).photoCount,0);
    response=await f.call('/api/media/'+item.id+'/retag',{method:'POST',body:{scope:'personal:chantal',restoreProfile:true}});result=await response.json();assert.equal(result.people.chantal.profile,item.src);assert.equal(result.people.chantal.profileIsManual,true);assert.equal(result.people.chantal.photoCount,1);
    assert.equal((await f.call('/api/media/'+item.id+'/delete',{method:'POST',body:{scope:'personal:chantal'}})).status,404,'A linked view cannot accidentally delete the master file');
    assert.equal((await (await f.call('/api/weddings/u-yehiel')).json()).mediaCount,1);
    await setTags(f,item,['camille']);assert.equal((await (await f.call('/api/people/chantal')).json()).profile,null,'Removing a tag through the editor also clears a selected linked profile');
  }finally{await f.close();}
});
test('global deletion and restoration update every tagged album and preserve manual profile choices',async()=>{
  const f=fixture();try{
    await f.connect();const item=await taggedUpload(f);await setTags(f,item,['chantal','camille']);
    for(const id of ['chantal','camille'])await f.call('/api/people/'+id+'/profile',{method:'POST',body:{file:item.file}});
    let result=await (await f.call('/api/media/'+item.id+'/delete',{method:'POST',body:{scope:'photos'}})).json();assert.equal(result.people.chantal.photoCount,0);assert.equal(result.people.camille.profile,null);
    assert.equal((await (await f.call('/api/export')).json()).tags.length,0);assert.equal((await f.call('/api/media/'+item.id+'/tags')).status,404);
    const second=await (await f.call('/api/people/chantal/photos?filename=new.jpg',{method:'POST',body:photo,headers:{'Content-Length':String(photo.length)}})).json();
    await f.call('/api/people/chantal/profile',{method:'POST',body:{file:second.file}});
    f.restart();result=await (await f.call('/api/media/'+item.id+'/restore',{method:'POST',body:{scope:'photos'}})).json();
    assert.equal(result.people.camille.profile,item.src);assert.equal(result.people.camille.profileIsManual,true);assert.equal(result.people.chantal.profile,second.person.gallery[0].src);assert.equal(result.people.chantal.photoCount,2);assert.equal(result.item.tags.length,2);assert.equal(f.objects.size,2);
  }finally{await f.close();}
});
test('tagging validates input, prevents stale overwrites and rolls back invalid new names',async()=>{
  const f=fixture();try{
    await f.connect();const item=await taggedUpload(f),path='/api/media/'+item.id+'/tags';
    const body={personIds:['chantal'],newNames:[],expectedRevision:'empty'};
    assert.equal((await f.call(path,{method:'POST',body,clientHeaders:false})).status,403);assert.equal((await f.call(path,{method:'POST',body,headers:{Origin:'https://other.example'}})).status,403);
    assert.equal((await f.call(path,{method:'POST',body})).status,200);
    assert.equal((await f.call(path,{method:'POST',body:{...body,personIds:['camille'],newNames:['שם שלא יישמר']}})).status,409);
    assert.equal((await (await f.call('/api/tag-people')).json()).people.length,Object.keys(family.people).length);assert.equal((await (await f.call('/api/media/'+item.id+'/tags')).json()).item.tags[0].id,'chantal');
    assert.equal((await setTags(f,item,['missing-person'])).status,404);
    assert.equal((await setTags(f,item,[],['שם חדש',42])).status,400,'An invalid name rolls the whole operation back');
    assert.equal((await (await f.call('/api/tag-people')).json()).people.length,Object.keys(family.people).length);
    assert.equal((await setTags(f,item,[],Array(51).fill('שם'))).status,400);assert.equal((await setTags(f,item,[],[' '.repeat(5)])).status,400);
    const doc=await taggedUpload(f,'/api/nostalgia',new TextEncoder().encode('מכתב נוסטלגי'),'letter.txt');assert.equal((await f.call('/api/media/'+doc.id+'/tags')).status,400);
    const row=JSON.parse(f.database.prepare('SELECT data FROM people WHERE id=?').get('camille').data);row.name='שנטל פירוז';f.database.prepare('UPDATE people SET data=? WHERE id=?').run(JSON.stringify(row),'camille');
    assert.equal((await setTags(f,item,[],['שנטל פירוז'])).status,409,'Ambiguous names require an explicit identity choice');
  }finally{await f.close();}
});


test('gallery uploads stay separate and automatic tag deltas preserve other people and durable album links',async()=>{
  const f=fixture();try{
    await f.connect();
    const upload=await f.call('/api/collections/gallery/upload?filename=gallery.jpg',{method:'POST',body:photo,headers:{'Content-Length':String(photo.length)}});assert.equal(upload.status,201);
    let collection=(await upload.json()).collection,item=collection.items[0];
    assert.equal(collection.kind,'gallery');
    const id=item.id,storageCount=f.objects.size;
    const tag=(body)=>f.call('/api/media/'+id+'/tag',{method:'POST',body});
    const results=await Promise.all([tag({personId:'yona',tagged:true}),tag({personId:'yehiel',tagged:true})]);
    for(const response of results)assert.equal(response.status,200);
    item=(await (await f.call('/api/media/'+id+'/tags')).json()).item;
    assert.deepEqual(new Set(item.tags.map(person=>person.id)),new Set(['yona','yehiel']));
    let result=await (await tag({name:'שם נוסף לבדיקה',tagged:true})).json();const extraId=result.taggedPerson.id;
    assert.match(extraId,/^extra-/);result=await (await tag({name:'שם נוסף לבדיקה',tagged:true})).json();assert.equal(result.taggedPerson.id,extraId);
    assert.equal((await tag({personId:'yona',tagged:false})).status,200);
    assert.equal((await (await f.call('/api/people/yona')).json()).mediaCount,0);
    assert.equal((await (await f.call('/api/people/yehiel')).json()).gallery[0].id,id);
    assert.equal((await (await f.call('/api/collections/photos')).json()).items.length,0);
    assert.equal(f.objects.size,storageCount,'Tagging must never duplicate files');
    for(const body of [{personId:'yona'},{personId:'yona',name:'other',tagged:true},{name:'extra',tagged:false},{name:4,tagged:true}])assert.equal((await tag(body)).status,400);
    assert.equal((await tag({personId:'bad-id',tagged:true})).status,404);
    f.restart();assert.equal((await (await f.call('/api/people/'+extraId)).json()).gallery[0].id,id);
    assert.equal((await f.call('/api/media/'+id+'/delete',{method:'POST',body:{scope:'gallery'}})).status,200);
    assert.equal((await (await f.call('/api/people/yehiel')).json()).mediaCount,0);
    assert.equal((await f.call('/api/media/'+id+'/restore',{method:'POST',body:{scope:'gallery'}})).status,200);
    assert.equal((await (await f.call('/api/people/yehiel')).json()).gallery[0].id,id);
    assert.equal((await f.call('/api/collections/gallery/upload?filename=video.mp4',{method:'POST',body:video,headers:{'Content-Length':String(video.length)}})).status,415);
  }finally{await f.close();}
});
test('Roi death date is canonical and limits birthdays without overwriting saved values',async()=>{
  const f=fixture();try{
    await f.connect();let person=await(await f.call('/api/people/roi')).json();assert.equal(person.deathDate,'21.7.2024');
    let response=await f.ownerBirthday('/api/people/roi/birthday',{method:'POST',body:{birthday:'20.7.2000',expectedBirthday:person.birthday}});assert.equal(response.status,200);
    f.restart();person=await(await f.call('/api/people/roi')).json();assert.equal(person.birthday,'20.7.2000');assert.equal(person.deathDate,'21.7.2024');
    assert.equal((await f.ownerBirthday('/api/people/roi/birthday',{method:'POST',body:{birthday:'22.7.2024',expectedBirthday:person.birthday}})).status,400);
  }finally{await f.close();}
});
test('calendar API reads edited birthdays, uses Israel holidays and survives the holiday service being unavailable',async()=>{
  const f=fixture();try{
    await f.connect();
    for(const id of ['yehiel','ora']){const person=await(await f.call('/api/people/'+id)).json();assert.equal((await f.ownerBirthday('/api/people/'+id+'/birthday',{method:'POST',body:{birthday:'21.7.1970',expectedBirthday:person.birthday}})).status,200);}
    let response=await f.call('/api/calendar?date=2026-07-02&mode=gregorian');assert.equal(response.status,200);let result=await response.json(),day=result.days.find(day=>day.date==='2026-07-21');
    assert.equal(result.holidaysAvailable,true);assert.deepEqual(day.birthdays.map(person=>person.name).sort(),['אורה פיש','יחיאל קהא'].sort());assert.equal(day.holidays.length,1);assert.equal(day.birthdays[0].age,56);
    response=await f.call('/api/calendar?date=2024-03-25&mode=hebrew');assert.equal(response.status,200);result=await response.json();assert.match(result.label,/אדר/);
    f.env.FAIL_HOLIDAYS=true;result=await(await f.call('/api/calendar?date=2049-07-01')).json();assert.equal(result.holidaysAvailable,false);assert.equal(result.days.find(day=>day.date==='2049-07-21').birthdays.length,2);
    for(const value of ['2026-02-30','bad','1800-01-01'])assert.equal((await f.call('/api/calendar?date='+value)).status,400);
    assert.equal((await f.call('/api/calendar?date=2026-07-01&mode=bad')).status,400);
  }finally{await f.close();}
});

test('Hebrew and English tags resolve to one canonical person and additional names keep their original language',async()=>{
 const f=fixture();try{
  await f.connect();const upload=await f.call('/api/collections/gallery/upload?filename=bilingual.jpg',{method:'POST',body:photo,headers:{'Content-Length':String(photo.length)}});assert.equal(upload.status,201);const item=(await upload.json()).collection.items[0];
  const add=name=>f.call('/api/media/'+item.id+'/tag',{method:'POST',body:{name,tagged:true}});
  let result=await(await add('יחיאל קהא')).json();assert.equal(result.taggedPerson.id,'yehiel');
  result=await(await add('Yehiel Keha')).json();assert.equal(result.taggedPerson.id,'yehiel');assert.equal(result.item.tags.length,1);assert.equal(result.item.tags[0].name,'יחיאל קהא');assert.equal(result.item.tags[0].nameEn,'Yehiel Keha');
  result=await(await add('Camille De Vita')).json();assert.equal(result.taggedPerson.id,'camille');assert.equal((await(await f.call('/api/people/camille')).json()).gallery[0].id,item.id);
  result=await(await add('אורחת חדשה')).json();const guest=result.taggedPerson.id;assert.equal(result.taggedPerson.name,'אורחת חדשה');assert.equal(result.taggedPerson.nameEn,null);
  result=await(await add('A new guest')).json();assert.notEqual(result.taggedPerson.id,guest);assert.equal(result.taggedPerson.name,'A new guest');assert.equal(result.taggedPerson.nameEn,null);
  assert.equal((await(await f.call('/api/tag-people')).json()).people.length,Object.keys(family.people).length+2);
  f.restart();result=await(await f.call('/api/media/'+item.id+'/tags')).json();assert.equal(result.item.tags.find(p=>p.id==='yehiel').nameEn,'Yehiel Keha');assert.equal(result.item.tags.find(p=>p.id===guest).name,'אורחת חדשה');
  const calendar=await(await f.call('/api/calendar?date=2026-11-01&lang=en-GB')).json();assert.equal(calendar.holidaysAvailable,true);assert.match(calendar.hebrewLabel,/Heshvan|Cheshvan|Kislev/);assert.equal(calendar.days.find(d=>d.date==='2026-11-10').holidays[0].name,'Rosh Chodesh Kislev');
  const bootstrap=await(await f.call('/family-data.js')).text();assert.match(bootstrap,/Camille De Vita/);assert.match(bootstrap,/קמיל דה ויטה/);
 }finally{await f.close();}
});

test('new gallery uploads stay first after tagging, caption edits and a durable reload',async()=>{
 const f=fixture();try{
  await f.connect();const files=[];
  for(const name of ['older.jpg','first-new.jpg','second-new.jpg']){
   const response=await f.call('/api/collections/gallery/upload?filename='+name,{method:'POST',body:photo,headers:{'Content-Length':String(photo.length)}});assert.equal(response.status,201);const result=await response.json();files.push(result.file);assert.equal(result.collection.items[0].file,result.file);
  }
  const order=[...files].reverse(),collection=await(await f.call('/api/collections/gallery')).json();assert.deepEqual(collection.items.map(item=>item.file),order);
  const older=collection.items.find(item=>item.file===files[0]);
  assert.equal((await f.call('/api/media/'+older.id+'/tag',{method:'POST',body:{personId:'yehiel',tagged:true}})).status,200);
  assert.equal((await f.call('/api/collections/gallery/caption',{method:'POST',body:{file:older.file,caption:'An older family photo'}})).status,200);
  f.restart();assert.deepEqual((await(await f.call('/api/collections/gallery')).json()).items.map(item=>item.file),order);
 }finally{await f.close();}
});

test('gallery pagination defaults to 100, caps at 500, searches all pages and keeps new uploads first',async()=>{
 const f=fixture();try{
  for(let i=0;i<623;i++){
   const id=i.toString(16).padStart(32,'0'),item={id,category:'gallery',file:id+'.jpg',name:'Photo '+i,caption:i===3?'Unique distant caption':'',mime:'image/jpeg',kind:'photo',key:'gallery/'+id,createdAt:new Date(2026,0,1,0,0,i).toISOString()};
   f.database.prepare('INSERT INTO media(id,category,data) VALUES(?,?,?)').run(id,'gallery',JSON.stringify(item));
  }
  const first=await (await f.call('/api/collections/gallery')).json();assert.equal(first.items.length,100);assert.equal(first.count,623);assert.equal(first.pagination.pages,7);assert.equal(first.items[0].name,'Photo 622');
  const next=await (await f.call('/api/collections/gallery?page=2&size=100')).json();assert.equal(next.items[0].name,'Photo 522');assert.ok(next.items.every(item=>!first.items.some(p=>p.id===item.id)));
  const large=await (await f.call('/api/collections/gallery?page=2&size=500')).json();assert.equal(large.items.length,123);assert.equal(large.pagination.pages,2);
  assert.equal((await f.call('/api/collections/gallery?size=501')).status,400);assert.equal((await f.call('/api/collections/gallery?page=0')).status,400);
  const search=await (await f.call('/api/collections/gallery?q=Unique')).json();assert.equal(search.count,1);assert.equal(search.items[0].name,'Photo 3');
  const tagId=(3).toString(16).padStart(32,'0');f.database.prepare('INSERT INTO media_tags(media_id,person_id) VALUES(?,?)').run(tagId,'yehiel');
  assert.equal((await (await f.call('/api/collections/gallery?q=Yehiel')).json()).count,1);assert.equal((await (await f.call('/api/collections/gallery?q='+encodeURIComponent('יחיאל'))).json()).count,1);
  assert.equal((await (await f.call('/api/collections/gallery?q=%25')).json()).count,0,'Search treats SQL wildcards literally');
  assert.equal((await (await f.call('/api/collections/gallery?page=999')).json()).pagination.page,7);
 }finally{await f.close();}
});
test('unfinished gallery filtering covers every page, combines with search and waits for explicit completion',async()=>{
 const f=fixture();try{
  await f.connect();const insert=f.database.prepare('INSERT INTO media(id,category,data) VALUES(?,?,?)'),tag=f.database.prepare('INSERT INTO media_tags(media_id,person_id) VALUES(?,?)'),id=n=>n.toString(16).padStart(32,'0');
  for(let n=0;n<205;n++){
   const item={id:id(n),category:'gallery',file:id(n)+'.jpg',name:'Photo '+n,caption:n===2?'Distant untagged memory':'',mime:'image/jpeg',kind:'photo'};insert.run(item.id,'gallery',JSON.stringify(item));if(n%2){tag.run(item.id,'yona');f.database.prepare('INSERT INTO media_face_reviews(media_id,photo_revision,tags_revision,completed_at) VALUES(?,?,?,?)').run(item.id,'original','empty','2026-11-08');}
  }
  const all=await f.call('/api/collections/gallery'),allEtag=all.headers.get('ETag');
  const response=await f.call('/api/collections/gallery?filter=untagged',{headers:{'If-None-Match':allEtag}});assert.equal(response.status,200,'All-photo and untagged snapshots use different cache keys');const etag=response.headers.get('ETag'),first=await response.json();
  assert.equal(first.count,103);assert.deepEqual(first.filterCounts,{all:205,untagged:103,partial:0,complete:102});assert.equal(first.pagination.pages,2);assert.equal(first.pagination.filter,'untagged');assert.equal(first.items.length,100);assert.equal(first.items[0].id,id(204));assert.ok(first.items.every(item=>item.tags.length===0));
  const last=await(await f.call('/api/collections/gallery?filter=untagged&page=2')).json();assert.deepEqual(last.items.map(item=>item.id),[id(4),id(2),id(0)]);
  const fullyTagged=await(await f.call('/api/collections/gallery?filter=complete&page=2')).json();assert.equal(fullyTagged.count,102);assert.deepEqual(fullyTagged.items.map(item=>item.id),[id(3),id(1)]);assert.deepEqual((await(await f.call('/api/collections/gallery?filter=complete&q=Photo%20203')).json()).items.map(item=>item.id),[id(203)]);
  const search='/api/collections/gallery?filter=untagged&q=Distant',searched=await(await f.call(search)).json();assert.equal(searched.items[0].id,id(2));assert.deepEqual(searched.filterCounts,{all:205,untagged:103,partial:0,complete:102});
  assert.equal((await f.call('/api/collections/gallery?filter=untagged',{headers:{'If-None-Match':etag}})).status,304);
  const patch=tagged=>f.call('/api/media/'+id(2)+'/tags/patch',{method:'POST',body:{changes:[{personId:'yona',tagged}]}});
  assert.equal((await patch(true)).status,200);const changed=await f.call('/api/collections/gallery?filter=untagged',{headers:{'If-None-Match':etag}});assert.equal(changed.status,200);assert.equal((await changed.json()).count,102,'A name moves this photo exclusively to partial');assert.equal((await(await f.call(search)).json()).count,0);
  const current=(await(await f.call('/api/media/'+id(2)+'/faces')).json()).item;assert.equal((await f.call('/api/media/'+current.id+'/faces/review',{method:'POST',body:{complete:true,photoRevision:'original',tagsRevision:current.tagsRevision}})).status,200);assert.equal((await(await f.call(search)).json()).count,0);
  assert.equal((await patch(false)).status,200);f.restart();assert.equal((await(await f.call(search)).json()).count,1);assert.equal((await(await f.call('/api/collections/gallery')).json()).count,205);
  for(let n=0;n<205;n+=2){tag.run(id(n),'yona');const revision=f.database.prepare('SELECT value FROM meta WHERE id=?').get('tags:'+id(n))?.value||'empty';f.database.prepare('INSERT INTO media_face_reviews(media_id,photo_revision,tags_revision,completed_at) VALUES(?,?,?,?) ON CONFLICT(media_id) DO UPDATE SET tags_revision=excluded.tags_revision').run(id(n),'original',revision,'2026-11-08');}const empty=await(await f.call('/api/collections/gallery?filter=untagged&page=2')).json();assert.equal(empty.count,0);assert.deepEqual(empty.filterCounts,{all:205,untagged:0,partial:0,complete:205});assert.equal(empty.pagination.page,1);assert.deepEqual(empty.items,[]);
  assert.equal((await f.call('/api/collections/gallery?filter=other')).status,400);
 }finally{await f.close();}
});
test('editable death dates retain birthday validation, stale checks and saved data through redeployment',async()=>{
 const f=fixture();try{
  await f.connect();const p=await (await f.call('/api/people/roi')).json();
  const r=await f.call('/api/people/roi/death-date',{method:'POST',body:{date:'22.7.2024',expectedDate:p.deathDate}});assert.equal(r.status,200);assert.equal((await r.json()).person.deathDate,'22.7.2024');
  assert.equal((await f.call('/api/people/roi/death-date',{method:'POST',body:{date:'23.7.2024',expectedDate:p.deathDate}})).status,409);
  f.restart();assert.equal((await (await f.call('/api/people/roi')).json()).deathDate,'22.7.2024');assert.match(await f.connect(),/22\.7\.2024/);
  assert.equal((await f.call('/api/people/yehiel/death-date',{method:'POST',body:{date:'22.7.2024',expectedDate:''}})).status,400);
 }finally{await f.close();}
});
test('unchanged gallery polling checks only its revision instead of loading the page again',async()=>{
 const f=fixture();try{
  const first=await f.call('/api/collections/gallery');const tag=first.headers.get('ETag');assert.equal(first.status,200);
  const original=f.storage.sql.exec;let pageReads=0;f.storage.sql.exec=(q,...args)=>{if(q.startsWith('SELECT m.data FROM media m WHERE')||q.startsWith('SELECT count(*) AS n FROM media m WHERE'))pageReads++;return original(q,...args);};
  const unchanged=await f.call('/api/collections/gallery',{headers:{'If-None-Match':tag}});assert.equal(unchanged.status,304);assert.equal(pageReads,0);
  assert.equal((await f.call('/api/collections/gallery?size=500',{headers:{'If-None-Match':tag}})).status,200);assert.ok(pageReads>0);
 }finally{await f.close();}
});

test('personal pages paginate owned and tagged media by type with ten items and no duplicate links',async()=>{
 const f=fixture();try{
  for(let i=1;i<=25;i++){const id=(10000+i).toString(16).padStart(32,'0'),kind=i<=23?'photo':'video',item={id,category:'personal',personId:'yehiel',file:id+'.'+(kind==='photo'?'jpg':'mp4'),name:'Personal '+i,mime:kind==='photo'?'image/jpeg':'video/mp4',kind,createdAt:new Date().toISOString()};f.database.prepare('INSERT INTO media(id,category,person_id,data) VALUES(?,?,?,?)').run(id,'personal','yehiel',JSON.stringify(item));}
  const id=(10001).toString(16).padStart(32,'0');f.database.prepare('INSERT INTO media_tags(media_id,person_id) VALUES(?,?)').run(id,'yehiel');
  const p1=await f.call('/api/people/yehiel/page'),data=await p1.json();assert.equal(data.albums.photos.total,23);assert.equal(data.albums.photos.items.length,10);assert.equal(data.albums.photos.pages,3);assert.equal(data.albums.videos.total,2);assert.equal(data.albums.documents.total,0);assert.equal(data.person.photoCount,23);assert.equal(data.person.gallery,undefined);
  const p2=await (await f.call('/api/people/yehiel/page?photos=2')).json();assert.equal(p2.albums.photos.items.length,10);assert.ok(p2.albums.photos.items.every(item=>!data.albums.photos.items.some(p=>p.id===item.id)));
  const p3=await (await f.call('/api/people/yehiel/page?photos=999')).json();assert.equal(p3.albums.photos.page,3);assert.equal(p3.albums.photos.items.length,3);
  assert.equal((await f.call('/api/people/yehiel/page',{headers:{'If-None-Match':p1.headers.get('ETag')}})).status,304);
  assert.equal((await f.call('/api/people/yehiel/page?photos=-1')).status,400);
 }finally{await f.close();}
});
test('biographies store authored text, reject stale changes, and persist independently of dates and albums',async()=>{
 const f=fixture();try{await f.connect();const first=await f.call('/api/people/yehiel/about',{method:'POST',body:{about:'My story <literal>\nשורה שנייה',expectedAbout:''}});assert.equal(first.status,200);
  assert.equal((await f.call('/api/people/yehiel/about',{method:'POST',body:{about:'stale',expectedAbout:''}})).status,409);
  f.restart();const data=await (await f.call('/api/people/yehiel/page')).json();assert.equal(data.person.about,'My story <literal>\nשורה שנייה');assert.equal(data.albums.photos.total,0);
  assert.equal((await f.call('/api/people/yehiel/about',{method:'POST',body:{about:'x'.repeat(10001),expectedAbout:data.person.about}})).status,400);
  const exported=await (await f.call('/api/export')).json();assert.equal(exported.people.find(p=>p.id==='yehiel').about,data.person.about);
 }finally{await f.close();}
});
test('personal video and document uploads retain ownership, preview passive formats and exclude certificate scans from portraits',async()=>{
 const f=fixture();try{
  await f.connect();const upload=(kind,name,body)=>f.call('/api/people/yehiel/'+kind+'?layout=page&filename='+encodeURIComponent(name),{method:'POST',body,headers:{'Content-Length':String(body.length)}});
  const v=await upload('videos','family.mp4',video);assert.equal(v.status,201);const vids=await v.json();assert.equal(vids.person.videoCount,1);assert.equal(vids.albums.videos.items.length,1);assert.equal(vids.person.gallery,undefined);
  const pdf=new TextEncoder().encode('%PDF-1.7\nExample certificate\n%%EOF'),d=await upload('documents','certificate.pdf',pdf);assert.equal(d.status,201);const doc=await d.json();assert.equal(doc.person.documentCount,1);assert.equal(doc.person.profile,null);
  const item=doc.albums.documents.items[0],download=await f.call(item.src);assert.match(download.headers.get('Content-Disposition'),/^attachment/);
  const inline=await f.call(item.src+'?inline=1');assert.match(inline.headers.get('Content-Disposition'),/^inline/);assert.equal(inline.headers.get('Content-Type'),'application/pdf');
  const scan=await upload('documents','certificate.jpg',photo);assert.equal(scan.status,201);const scanned=await scan.json();assert.equal(scanned.person.documentCount,2);assert.equal(scanned.person.photoCount,0);assert.equal(scanned.person.profile,null);
  assert.equal((await f.call('/api/people/yehiel/profile',{method:'POST',body:{file:scanned.albums.documents.items[0].file}})).status,404);
  assert.equal((await upload('documents','video.mp4',video)).status,415);
  assert.equal((await (await f.call('/api/people/camille/page')).json()).albums.documents.total,0);
 }finally{await f.close();}
});
test('opened-media captions update the shared item and social links expose no storage keys',async()=>{
 const f=fixture();try{
  await f.connect();const uploaded=await (await f.call('/api/collections/gallery/upload?filename=memory.jpg',{method:'POST',body:photo,headers:{'Content-Length':String(photo.length)}})).json(),item=uploaded.collection.items[0];
  const result=await f.call('/api/media/'+item.id+'/caption',{method:'POST',body:{caption:'A <family> & memory',expectedCaption:''}});assert.equal(result.status,200);
  assert.equal((await f.call('/api/media/'+item.id+'/caption',{method:'POST',body:{caption:'stale',expectedCaption:''}})).status,409);
  const view=await (await f.call('/api/media/'+item.id+'/view')).json();assert.equal(view.item.caption,'A <family> & memory');assert.equal(view.item.key,undefined);
  f.env.ASSETS.fetch=async()=>new Response('<html><head><title>Family</title></head><body>Family</body></html>');
  const shared=await f.call('/?media='+item.id+'&lang=en-US'),html=await shared.text();assert.equal(shared.status,200);assert.match(html,/property="og:image"/);assert.match(html,/A &lt;family&gt; &amp; memory/);assert.ok(!html.includes(f.env.HF_SECRET_ACCESS_KEY));
 }finally{await f.close();}
});
test('five explicit birth date corrections apply once and English spellings retain existing tag identities',async()=>{
 const f=fixture();try{
  const dates={avishai:'17.8.1933',shosh:'27.6.1951',mark:'20.1.1951',camille:'20.10.1993',sam:'18.10.1992'};
  for(const [id,date]of Object.entries(dates))assert.equal((await (await f.call('/api/people/'+id)).json()).birthday,date);
  const roster=(await (await f.call('/api/tag-people')).json()).people;for(const [id,name]of Object.entries({itay:'Itai Gandelman',leni:'Leni Gandelman',shay:'Shai Gandelman'}))assert.equal(roster.find(p=>p.id===id).nameEn,name);
  await f.connect();assert.equal((await f.ownerBirthday('/api/people/camille/birthday',{method:'POST',body:{birthday:'21.10.1993',expectedBirthday:dates.camille}})).status,200);f.restart();assert.equal((await (await f.call('/api/people/camille')).json()).birthday,'21.10.1993');
  const cal=await (await f.call('/api/calendar?date=2026-08-01')).json();assert.ok(cal.days.find(day=>day.date==='2026-08-17').birthdays.some(p=>p.id==='avishai'));
 }finally{await f.close();}
});

test('grandparent corrections migrate existing records once and preserve later edits, profiles and removed tags',async()=>{
 const f=fixture();try{
  await f.connect();const item=await taggedUpload(f);await setTags(f,item,['yona']);await setTags(f,item,[]);
  const marker='grandparents-2026-11-03-owner-v1';f.database.prepare('DELETE FROM meta WHERE id=?').run(marker);
  for(const id of ['yona','shlomo']){const p=JSON.parse(f.database.prepare('SELECT data FROM people WHERE id=?').get(id).data);p.birthday='1.1.1111';p.aliyahYear=id==='yona'?1937:1935;p.deathDate=null;f.database.prepare('UPDATE people SET data=? WHERE id=?').run(JSON.stringify(p),id);}
  f.restart();const yona=await(await f.call('/api/people/yona/page')).json(),shlomo=await(await f.call('/api/people/shlomo/page')).json();
  assert.equal(yona.person.birthday,'16.10.1921');assert.equal(yona.person.aliyahYear,1934);assert.equal(yona.person.aliyahMonth,12);assert.equal(shlomo.person.birthday,'1.1.1907');assert.equal(shlomo.person.deathDate,'12.11.1996');assert.equal(shlomo.person.deceased,true);assert.equal(shlomo.person.aliyahYear,1932);
  assert.equal((await(await f.call('/api/media/'+item.id+'/tags')).json()).item.tags.length,0);
  assert.equal((await f.ownerBirthday('/api/people/shlomo/birthday',{method:'POST',body:{birthday:'2.1.1907',expectedBirthday:'1.1.1907'}})).status,200);
  f.restart();assert.equal((await(await f.call('/api/people/shlomo/page')).json()).person.birthday,'2.1.1907');
  const bootstrap=JSON.parse(/window.FAMILY_DATA=(.+);/.exec(await f.connect())[1]);assert.equal(bootstrap.people.yona.aliyahMonth,12);assert.equal(bootstrap.people.shlomo.deceased,true);
 }finally{await f.close();}
});
test('tag batches touch only their image, preserve concurrent selections, are idempotent and return no albums',async()=>{
 const f=fixture();try{
  await f.connect();const a=await taggedUpload(f),b=await taggedUpload(f),patch=(item,changes)=>f.call('/api/media/'+item.id+'/tags/patch',{method:'POST',body:{changes}});
  let r=await patch(a,[{personId:'yona',tagged:true},{personId:'shlomo',tagged:true}]);assert.equal(r.status,200);let result=await r.json();assert.equal(result.collection,undefined);assert.equal(result.people,undefined);assert.deepEqual(result.item.tags.map(p=>p.id),['shlomo','yona']);
  const revision=result.item.tagsRevision;
  result=await(await patch(a,[{personId:'yona',tagged:true}])).json();assert.equal(result.item.tagsRevision,revision);assert.deepEqual(result.item.tags.map(p=>p.id),['shlomo','yona'],'Repeating an existing tag must not change its position');
  await Promise.all([patch(a,[{personId:'yona',tagged:false}]),patch(a,[{personId:'roi',tagged:true}]),patch(b,[{personId:'camille',tagged:true}])]);
  assert.deepEqual((await(await f.call('/api/media/'+a.id+'/tags')).json()).item.tags.map(p=>p.id),['roi','shlomo']);assert.deepEqual((await(await f.call('/api/media/'+b.id+'/tags')).json()).item.tags.map(p=>p.id),['camille']);
  assert.equal((await patch(a,[{personId:'yona',tagged:true},{name:42,tagged:true}])).status,400);assert.ok(!(await(await f.call('/api/media/'+a.id+'/tags')).json()).item.tags.some(p=>p.id==='yona'),'An invalid batch rolls back every change');
  result=await(await patch(a,[{personId:'yona',tagged:true}])).json();assert.deepEqual(result.item.tags.map(p=>p.id),['yona','roi','shlomo'],'A removed tag added again becomes the newest');
  f.restart();assert.deepEqual((await(await f.call('/api/media/'+a.id+'/tags')).json()).item.tags.map(p=>p.id),['yona','roi','shlomo'],'Newest-first order survives a restart');
  const guest=await(await patch(b,[{key:'new:1',name:'A guest',tagged:true},{key:'new:2',name:'A guest',tagged:true}])).json();assert.equal(guest.taggedPeople[0].id,guest.taggedPeople[1].id);assert.equal(guest.item.tags.length,2);
  assert.equal((await patch(b,[{personId:'camille',tagged:false}])).status,200);f.restart();assert.ok(!(await(await f.call('/api/media/'+b.id+'/tags')).json()).item.tags.some(p=>p.id==='camille'));
 }finally{await f.close();}
});
test('tagging stays small with thousands of unrelated images, and unchanged people refreshes read no albums',async()=>{
 const f=fixture();try{
  await f.connect();const item=await taggedUpload(f);
  const insert=f.database.prepare('INSERT INTO media(id,category,person_id,data) VALUES(?,?,?,?)'),tag=f.database.prepare('INSERT INTO media_tags(media_id,person_id) VALUES(?,?)');
  f.database.exec('BEGIN');for(let n=1000;n<4000;n++){const id=n.toString(16).padStart(32,'0');insert.run(id,'gallery',null,JSON.stringify({id,category:'gallery',file:id+'.jpg',mime:'image/jpeg',kind:'photo',name:'Memory'}));tag.run(id,'yehiel');}f.database.exec('COMMIT');
  const original=f.storage.sql.exec;let rows=0,queries=0;f.storage.sql.exec=(q,...args)=>{const result=original(q,...args);rows+=result.toArray().length;queries++;return result;};
  const response=await f.call('/api/media/'+item.id+'/tags/patch',{method:'POST',body:{changes:[{personId:'camille',tagged:true}]}});assert.equal(response.status,200);const body=await response.text();assert.ok(body.length<2000,body.length);assert.ok(rows<30,'Tagging read '+rows+' returned rows across '+queries+' queries');
  const first=await f.call('/api/media'),etag=first.headers.get('ETag');assert.equal(first.status,200);rows=0;queries=0;
  assert.equal((await f.call('/api/media',{headers:{'If-None-Match':etag}})).status,304);assert.equal(rows,0);assert.equal(queries,0);
  rows=0;const script=await f.connect();assert.match(script,/window.FAMILY_DATA_AVAILABLE=true/);assert.ok(rows<150,'Bootstrap must not load media or tags');
 }finally{await f.close();}
});
test('the family tree still receives valid JavaScript when database reads are unavailable',async()=>{
 const f=fixture();try{
  f.env.FAMILY_STATE.get=()=>({fetch:async()=>Response.json({error:'Unavailable'},{status:503})});
  const response=await f.call('/family-data.js');assert.equal(response.status,200);assert.match(response.headers.get('Content-Type'),/javascript/);const script=await response.text();assert.match(script,/window.FAMILY_DATA_AVAILABLE=false/);assert.match(script,/16\.10\.1921/);assert.match(script,/12\.11\.1996/);
 }finally{await f.close();}
});
test('daily storage limits reach the maintenance screen without exposing internal errors',async()=>{
 const f=fixture();try{
  const initial=await f.call('/api/health');assert.equal(initial.status,200);assert.deepEqual(await initial.json(),{available:true});
  f.env.FAMILY_STATE.get=()=>({fetch:async()=>fail(new Error('SQLITE_ERROR: rows read limit exceeded for this account'))});
  const limited=await f.call('/api/health');assert.equal(limited.status,503);assert.equal(limited.headers.get('X-Family-Storage-Limit'),'daily');const body=await limited.json();assert.equal(body.code,'DAILY_STORAGE_LIMIT');assert.ok(!body.error.includes('SQLITE'));
  assert.equal((await f.call('/api/setup')).status,200,'Configuration alone does not prove the database has recovered');
  f.env.FAMILY_STATE.get=()=>({fetch:async()=>{throw new Error('Durable Object storage daily read limit reached');}});
  assert.equal((await f.call('/api/health')).status,503,'Constructor failures must also be classified');
  f.env.FAMILY_STATE.get=()=>({fetch:async()=>{throw new Error('Unexpected query failure');}});const unrelated=await f.call('/api/health');assert.equal(unrelated.status,503);assert.equal(unrelated.headers.get('X-Family-Storage-Limit'),null);assert.equal((await unrelated.json()).code,'STATE_UNREACHABLE');
 }finally{await f.close();}
});
test('Mila birthday correction keeps the stored year, applies once and does not invent an unknown year',async()=>{
 const f=fixture();try{
  const marker='birthday-mila-2026-11-03-owner-v1';assert.equal(f.database.prepare('SELECT value FROM meta WHERE id=?').get(marker),undefined);
  const person=JSON.parse(f.database.prepare('SELECT data FROM people WHERE id=?').get('mila').data);person.birthday='7.9.2022';person.about='A saved biography';f.database.prepare('UPDATE people SET data=? WHERE id=?').run(JSON.stringify(person),'mila');
  f.restart();let result=await(await f.call('/api/people/mila/page')).json();assert.equal(result.person.birthday,'9.7.2022');assert.equal(result.person.about,'A saved biography');
  const revision=result.person.revision;f.restart();result=await(await f.call('/api/people/mila/page')).json();assert.equal(result.person.revision,revision);
  await f.connect();assert.equal((await f.ownerBirthday('/api/people/mila/birthday',{method:'POST',body:{birthday:'10.7.2022',expectedBirthday:'9.7.2022'}})).status,200);f.restart();assert.equal((await(await f.call('/api/people/mila/page')).json()).person.birthday,'10.7.2022');
 }finally{await f.close();}
});


const detectedGalleryFaces=[{rect:{x:.1,y:.1,width:.1,height:.15},score:.9},{rect:{x:.4,y:.1,width:.1,height:.15},score:.9},{rect:{x:.7,y:.1,width:.1,height:.15},score:.9}];
async function saveGalleryScan(f,item,faces=detectedGalleryFaces,extra={}){
 return f.call('/api/media/'+item.id+'/faces/detection',{method:'POST',body:{photoRevision:item.photoRevision||'original',version:FACE_SCAN_VERSION,faces,...extra}});
}
async function galleryPhoto(f,name='Faces.jpg'){
 const response=await f.call('/api/collections/gallery/upload?filename='+name,{method:'POST',body:photo,headers:{'Content-Type':'image/jpeg','Content-Length':String(photo.length)}});assert.equal(response.status,201);const result=await response.json();return result.collection.items.find(item=>item.file===result.file);
}
test('manual names populate their own tagged albums and follow face tags, untagging, deletion and restoration',async()=>{
 const f=fixture();try{
  await f.connect();const a=await galleryPhoto(f,'Guest-a.jpg'),b=await galleryPhoto(f,'Guest-b.jpg'),other=await galleryPhoto(f,'Unrelated.jpg');
  const first=await(await f.call('/api/media/'+a.id+'/faces/save',{method:'POST',body:{faceId:'e'.repeat(32),name:'חבר חדש',rect:detectedGalleryFaces[0].rect,expectedRevision:null}})).json();
  const id=first.face.personId;assert.equal((await f.call('/api/media/'+b.id+'/tags/patch',{method:'POST',body:{changes:[{name:'חבר חדש',tagged:true}]}})).status,200);
  let roster=await(await f.call('/api/media')).json();assert.equal(roster.people[id].extra,true);assert.equal(roster.people[id].photoCount,2);assert.equal(roster.people[id].mediaCount,2);
  let page=await(await f.call('/api/people/'+id+'/page')).json();assert.equal(page.albums.photos.total,2);assert.deepEqual(new Set(page.albums.photos.items.map(i=>i.id)),new Set([a.id,b.id]));assert.ok(!page.albums.photos.items.some(i=>i.id===other.id));
  await f.call('/api/media/'+a.id+'/tag',{method:'POST',body:{personId:id,tagged:false}});page=await(await f.call('/api/people/'+id+'/page')).json();assert.deepEqual(page.albums.photos.items.map(i=>i.id),[b.id]);
  await f.call('/api/media/'+b.id+'/delete',{method:'POST',body:{scope:'gallery'}});roster=await(await f.call('/api/media')).json();assert.equal(roster.people[id].mediaCount,0);
  await f.call('/api/media/'+b.id+'/restore',{method:'POST',body:{scope:'gallery'}});f.restart();roster=await(await f.call('/api/media')).json();assert.equal(roster.people[id].photoCount,1);
 }finally{await f.close();}
});
test('zero-tag photos never become partial; tagged photos stay unfinished until manual completion',async()=>{
 const f=fixture();try{
  await f.connect();const item=await galleryPhoto(f),path='/api/collections/gallery?filter=partial';
  assert.equal((await(await f.call(path)).json()).count,0,'Unscanned is unknown, never a completed zero-face scan');
  const before=(await f.call(path)).headers.get('ETag');assert.equal((await saveGalleryScan(f,item)).status,200);
  let response=await f.call(path,{headers:{'If-None-Match':before}}),result=await response.json();assert.equal(response.status,200);assert.equal(result.count,0);assert.deepEqual(result.filterCounts,{all:1,untagged:1,partial:0,complete:0});
  const unlabelled=await(await f.call('/api/media/'+item.id+'/faces')).json();assert.equal(unlabelled.item.faceSummary.total,3);assert.equal(unlabelled.item.faceSummary.partial,false);
  assert.equal((await(await f.call('/api/collections/gallery?filter=untagged')).json()).count,1);
  let saved;
  for(const [index,personId] of ['yona','shlomo','ruti'].entries()){
   response=await f.call('/api/media/'+item.id+'/faces/save',{method:'POST',body:{faceId:String(index+1).repeat(32),personId,rect:detectedGalleryFaces[index].rect,expectedRevision:null}});assert.equal(response.status,200,await response.clone().text());saved=await response.json();
   assert.equal(saved.item.faceSummary.unmatched,2-index);assert.equal(saved.item.faceSummary.partial,true);
   result=await(await f.call(path)).json();assert.equal(result.count,1);assert.equal(result.filterCounts.all,1);
  }
  assert.equal((await(await f.call('/api/collections/gallery?filter=untagged')).json()).count,0);f.restart();assert.equal((await(await f.call(path)).json()).count,1);
  assert.equal((await f.call('/api/media/'+item.id+'/faces/review',{method:'POST',body:{complete:true,photoRevision:'original',tagsRevision:saved.item.tagsRevision}})).status,200);assert.equal((await(await f.call(path)).json()).count,0);assert.equal((await(await f.call('/api/collections/gallery?filter=untagged')).json()).count,0);
  await f.call('/api/media/'+item.id+'/tag',{method:'POST',body:{personId:'shlomo',tagged:false}});
  result=await(await f.call(path)).json();assert.equal(result.count,1);assert.equal(result.items[0].faceSummary.unmatched,1);
  await f.call('/api/media/'+item.id+'/retag',{method:'POST',body:{scope:'personal:shlomo'}});assert.equal((await(await f.call(path)).json()).count,1,'Retagging still requires explicit completion');
 }finally{await f.close();}
});
test('legacy whole-photo tags count for classification but are never guessed onto faces',async()=>{
 const f=fixture();try{
  await f.connect();const item=await galleryPhoto(f);await saveGalleryScan(f,item);
  for(const personId of ['yona','shlomo','ruti'])await f.call('/api/media/'+item.id+'/tag',{method:'POST',body:{personId,tagged:true}});
  assert.equal((await(await f.call('/api/collections/gallery?filter=partial')).json()).count,1);
  const faces=await(await f.call('/api/media/'+item.id+'/faces')).json();assert.deepEqual(faces.faces,[]);assert.equal(faces.detectedFaces.length,3,'Old ordinary tags have no invented coordinates');
  assert.equal((await f.call('/api/media/'+item.id+'/faces/review',{method:'POST',body:{complete:true,photoRevision:'original',tagsRevision:faces.item.tagsRevision}})).status,200);
  const other=await galleryPhoto(f,'Repeated-person.jpg');await saveGalleryScan(f,other,detectedGalleryFaces.slice(0,2));
  for(const [index,face] of detectedGalleryFaces.slice(0,2).entries())assert.equal((await f.call('/api/media/'+other.id+'/faces/save',{method:'POST',body:{faceId:String(index+4).repeat(32),personId:'yona',rect:face.rect,expectedRevision:null}})).status,200);
  assert.equal((await(await f.call('/api/collections/gallery?filter=partial')).json()).count,1,'Even two fully labelled regions wait for manual completion');
  const repeated=await(await f.call('/api/media/'+other.id+'/faces')).json();assert.equal(repeated.faces.length,2);assert.equal((await f.call('/api/media/'+other.id+'/faces/review',{method:'POST',body:{complete:true,photoRevision:'original',tagsRevision:repeated.item.tagsRevision}})).status,200);assert.equal((await(await f.call('/api/collections/gallery?filter=partial')).json()).count,0);
 }finally{await f.close();}
});
test('face scan queue covers the entire gallery and partial pagination combines with name and caption search',async()=>{
 const f=fixture();try{
  await f.connect();const insert=f.database.prepare('INSERT INTO media(id,category,data) VALUES(?,?,?)'),scan=f.database.prepare('INSERT INTO media_face_scans(media_id,photo_revision,version,data,face_count,unmatched_count) VALUES(?,?,?,?,?,?)');
  const id=n=>n.toString(16).padStart(32,'0');for(let n=1;n<=207;n++){
   const item={id:id(n),category:'gallery',file:id(n)+'.jpg',name:'Group '+n,caption:n===2?'An old celebration':'',mime:'image/jpeg',kind:'photo'};insert.run(item.id,'gallery',JSON.stringify(item));
   if(n<=205)f.database.prepare('INSERT INTO media_tags(media_id,person_id) VALUES(?,?)').run(item.id,'yona');
   if(n<=205)scan.run(item.id,'original',FACE_SCAN_VERSION,JSON.stringify({faces:detectedGalleryFaces}),3,3);
  }
  let result=await(await f.call('/api/collections/gallery?filter=partial&page=3')).json();assert.equal(result.count,205);assert.equal(result.pagination.pages,3);assert.deepEqual(result.items.map(item=>item.id),[5,4,3,2,1].map(id));
  result=await(await f.call('/api/collections/gallery?filter=partial&q=celebration')).json();assert.equal(result.count,1);assert.equal(result.items[0].id,id(2));
  let queue=await(await f.call('/api/gallery/face-scan')).json();assert.equal(queue.pending,2);assert.deepEqual(queue.items.map(item=>item.id),[id(206),id(207)]);
  assert.equal((await saveGalleryScan(f,queue.items[0],[])).status,200);queue=await(await f.call('/api/gallery/face-scan?after='+queue.items[0].cursor)).json();assert.equal(queue.pending,1);assert.equal(queue.items[0].id,id(207));
  const zero=await(await f.call('/api/media/'+id(206)+'/faces')).json();assert.equal(zero.item.faceSummary.scanned,true);assert.equal(zero.item.faceSummary.total,0);
  assert.equal((await f.call('/api/gallery/face-scan?after=-1')).status,400);
 }finally{await f.close();}
});
test('face scans validate source revisions, stay durable, preserve concurrent results and invalidate after cropping',async()=>{
 const f=fixture();try{
  await f.connect();const item=await galleryPhoto(f),other=await galleryPhoto(f,'Other.jpg');
  await f.call('/api/media/'+item.id+'/tag',{method:'POST',body:{personId:'yona',tagged:true}});
  assert.equal((await saveGalleryScan(f,item,detectedGalleryFaces,{photoRevision:'old'})).status,409);
  assert.equal((await saveGalleryScan(f,item,detectedGalleryFaces,{version:'old'})).status,409);
  assert.equal((await saveGalleryScan(f,item,[{rect:{x:2},score:.9}])).status,400);
  assert.equal((await saveGalleryScan(f,item,[{rect:detectedGalleryFaces[0].rect,score:2}])).status,400);
  assert.equal((await saveGalleryScan(f,item,Array.from({length:151},()=>detectedGalleryFaces[0]))).status,400);
  assert.equal((await f.call('/api/media/'+item.id+'/faces/detection',{method:'POST',body:{photoRevision:'original',version:FACE_SCAN_VERSION,faces:detectedGalleryFaces},clientHeaders:false})).status,403);
  assert.equal((await saveGalleryScan(f,item)).status,200);
  await saveGalleryScan(f,item,detectedGalleryFaces.slice(0,1));f.restart();let faces=await(await f.call('/api/media/'+item.id+'/faces')).json();assert.equal(faces.detectedFaces.length,3);
  const etag=(await f.call('/api/collections/gallery?filter=partial')).headers.get('ETag');assert.equal((await f.call('/api/collections/gallery?filter=partial',{headers:{'If-None-Match':etag}})).status,304);assert.equal((await f.call('/api/collections/gallery',{headers:{'If-None-Match':etag}})).status,200);
  assert.equal((await(await f.call('/api/media/'+other.id+'/faces')).json()).detectedFaces.length,0);
  await f.call('/api/media/'+item.id+'/delete',{method:'POST',body:{scope:'gallery'}});assert.equal((await(await f.call('/api/collections/gallery?filter=partial')).json()).count,0);
  await f.call('/api/media/'+item.id+'/restore',{method:'POST',body:{scope:'gallery'}});assert.equal((await(await f.call('/api/collections/gallery?filter=partial')).json()).count,1);
  assert.equal((await photoEdit(f,item)).status,201);faces=await(await f.call('/api/media/'+item.id+'/faces')).json();assert.deepEqual(faces.item.faceSummary,{partial:true,reviewed:false,scanned:false,total:null,unmatched:null});assert.deepEqual(faces.detectedFaces,[]);
  assert.equal((await saveGalleryScan(f,item)).status,409,'Late old pixels cannot repopulate the edited photo index');
  assert.equal((await(await f.call('/api/gallery/face-scan')).json()).pending,2);
 }finally{await f.close();}
});

test('manual all-faces confirmation persists, excludes partial and scan queues, supports undo and rejects stale tags',async()=>{
 const f=fixture();try{
  await f.connect();const a=await galleryPhoto(f,'Reviewed.jpg'),b=await galleryPhoto(f,'Unreviewed.jpg');await saveGalleryScan(f,a);await saveGalleryScan(f,b);
  const taggedB=await(await f.call('/api/media/'+b.id+'/tag',{method:'POST',body:{personId:'yona',tagged:true}})).json();b.tagsRevision=taggedB.item.tagsRevision;
  const review=(item,complete=true,extra={})=>f.call('/api/media/'+item.id+'/faces/review',{method:'POST',body:{photoRevision:item.photoRevision||'original',tagsRevision:item.tagsRevision,complete,...extra}});
  let response=await review(a);assert.equal(response.status,200);const done=await response.json();assert.equal(done.item.faceSummary.reviewed,true);assert.equal(done.item.faceSummary.partial,false);assert.equal(done.item.faceSummary.unmatched,0);assert.equal(done.item.tags.length,0,'confirmation never invents tags');
  let partial=await(await f.call('/api/collections/gallery?filter=partial')).json();assert.deepEqual(partial.items.map(i=>i.id),[b.id]);assert.deepEqual(partial.filterCounts,{all:2,untagged:0,partial:1,complete:1});
  f.restart();assert.equal((await(await f.call('/api/media/'+a.id+'/faces')).json()).item.faceSummary.reviewed,true);
  await saveGalleryScan(f,a,[...detectedGalleryFaces,{rect:{x:.3,y:.6,width:.1,height:.1},score:.99}]);assert.equal((await(await f.call('/api/collections/gallery?filter=partial')).json()).count,1,'a later automated scan cannot undo human confirmation');
  f.database.prepare('DELETE FROM media_face_scans WHERE media_id=?').run(a.id);assert.ok(!(await(await f.call('/api/gallery/face-scan')).json()).items.some(i=>i.id===a.id),'confirmed photos stay out of rescanning even after model changes');
  await saveGalleryScan(f,a);assert.equal((await review(a,false)).status,200);assert.equal((await(await f.call('/api/collections/gallery?filter=partial')).json()).count,1,'An unreviewed zero-tag photo is still untagged, not partially tagged');
  assert.equal((await review(a)).status,200);await f.call('/api/media/'+a.id+'/tag',{method:'POST',body:{personId:'yona',tagged:true}});assert.equal((await review(a)).status,409);assert.equal((await(await f.call('/api/collections/gallery?filter=partial')).json()).count,2,'changed tags require a new confirmation');
  assert.equal((await review(b,true,{complete:'yes'})).status,400);assert.equal((await review(b,true,{photoRevision:'old'})).status,409);
 }finally{await f.close();}
});

test('ignored false detections persist only for that photo revision, survive rescanning and support Undo without removing names',async()=>{
 const f=fixture();try{
  await f.connect();const item=await galleryPhoto(f,'Ignore.jpg'),other=await galleryPhoto(f,'Unaffected.jpg');await saveGalleryScan(f,item);await saveGalleryScan(f,other);
  const saved=await(await f.call('/api/media/'+item.id+'/faces/save',{method:'POST',body:{faceId:'a'.repeat(32),personId:'yona',rect:detectedGalleryFaces[0].rect,expectedRevision:null}})).json();
  const ignore=(rect,ignored=true,extra={})=>f.call('/api/media/'+item.id+'/faces/ignore',{method:'POST',body:{rect,ignored,photoRevision:'original',...extra}});
  assert.equal((await ignore(detectedGalleryFaces[1].rect,true,{photoRevision:'stale'})).status,409);assert.equal((await ignore(detectedGalleryFaces[1].rect,'yes')).status,400);assert.equal((await ignore({x:2})).status,400);
  assert.equal((await f.call('/api/media/'+item.id+'/faces/ignore',{method:'POST',body:{rect:detectedGalleryFaces[1].rect,ignored:true,photoRevision:'original'},clientHeaders:false})).status,403);
  const before=(await f.call('/api/collections/gallery')).headers.get('ETag');let result=await(await ignore(detectedGalleryFaces[1].rect)).json();assert.equal(result.operation,'face-ignore');assert.equal(result.detectedFaces.length,2);assert.equal(result.item.faceSummary.total,2);assert.deepEqual(result.faces,saved.faces);assert.equal(result.item.tags[0].id,'yona');
  assert.equal((await f.call('/api/collections/gallery',{headers:{'If-None-Match':before}})).status,200);
  await ignore(detectedGalleryFaces[1].rect);f.restart();result=await(await f.call('/api/media/'+item.id+'/faces')).json();assert.equal(result.ignoredFaces.length,1,'Repeated Ignore is idempotent');assert.equal(result.detectedFaces.length,2);
  await saveGalleryScan(f,item);result=await(await f.call('/api/media/'+item.id+'/faces')).json();assert.equal(result.detectedFaces.length,2,'The next scan cannot reintroduce the ignored region');assert.equal((await(await f.call('/api/media/'+other.id+'/faces')).json()).detectedFaces.length,3);
  const backup=await(await f.call('/api/export')).json();assert.deepEqual(backup.faceIgnores,[{mediaId:item.id,photoRevision:'original',rects:[detectedGalleryFaces[1].rect]}]);
  result=await(await ignore(detectedGalleryFaces[1].rect,false)).json();assert.equal(result.detectedFaces.length,3);assert.equal(result.ignoredFaces.length,0);
  await ignore(detectedGalleryFaces[0].rect);result=await(await f.call('/api/media/'+item.id+'/faces')).json();assert.equal(result.faces[0].personId,'yona','Ignore never removes an existing named face');assert.equal(result.item.tags.length,1);
  assert.equal((await photoEdit(f,item)).status,201);result=await(await f.call('/api/media/'+item.id+'/faces')).json();assert.deepEqual(result.ignoredFaces,[],'Coordinates from old pixels cannot hide a face in an edited photo');assert.equal((await ignore(detectedGalleryFaces[1].rect)).status,409);
 }finally{await f.close();}
});

test('untagged and partial are disjoint before any scan; ordinary names await confirmation and old filter caches refresh',async()=>{
 const f=fixture();try{
  await f.connect();const a=await galleryPhoto(f,'Ordinary-tag.jpg'),b=await galleryPhoto(f,'No-tags.jpg');
  const untagged=()=>f.call('/api/collections/gallery?filter=untagged'),partial=()=>f.call('/api/collections/gallery?filter=partial');
  const first=await untagged(),etag=first.headers.get('ETag');assert.equal((await first.json()).count,2);
  assert.equal((await f.call('/api/collections/gallery?filter=untagged',{headers:{'If-None-Match':etag.replace(':tagging-v3',':tagging-v2')}})).status,200,'A cached overlapping-filter response must never return 304');
  const tagged=await(await f.call('/api/media/'+a.id+'/tags/patch',{method:'POST',body:{changes:[{personId:'yona',tagged:true}]}})).json();
  let left=await(await untagged()).json(),right=await(await partial()).json();assert.deepEqual(left.items.map(i=>i.id),[b.id]);assert.deepEqual(right.items.map(i=>i.id),[a.id]);assert.deepEqual(right.filterCounts,{all:2,untagged:1,partial:1,complete:0});assert.ok(left.items.every(i=>!right.items.some(j=>j.id===i.id)));
  assert.equal(right.items[0].faceSummary.scanned,false,'No face scan is needed to classify an ordinary tag');assert.deepEqual((await(await f.call('/api/media/'+a.id+'/faces')).json()).faces,[]);
  const review=complete=>f.call('/api/media/'+a.id+'/faces/review',{method:'POST',body:{complete,photoRevision:'original',tagsRevision:tagged.item.tagsRevision}});
  assert.equal((await review(true)).status,200);const full=await(await f.call('/api/collections/gallery?filter=complete')).json();assert.deepEqual(full.items.map(i=>i.id),[a.id]);assert.deepEqual(full.filterCounts,{all:2,untagged:1,partial:0,complete:1});assert.equal((await(await f.call('/api/people/yona/page')).json()).albums.photos.items.some(i=>i.id===a.id),true,'Completion preserves ordinary tags and personal albums');assert.equal((await(await partial()).json()).count,0);assert.equal((await(await untagged()).json()).count,1);
  await review(false);assert.equal((await(await partial()).json()).count,1);await f.call('/api/media/'+a.id+'/tags/patch',{method:'POST',body:{changes:[{personId:'yona',tagged:false}]}});
  left=await(await untagged()).json();right=await(await partial()).json();assert.equal(left.count,2);assert.equal(right.count,0);f.restart();assert.equal((await(await untagged()).json()).count,2);
 }finally{await f.close();}
});

test('correcting a face removes the mistaken name and album link only after its last occurrence, preserving other tags and photos',async()=>{
 const f=fixture();try{
  await f.connect();const a=await galleryPhoto(f,'Correct-name.jpg'),b=await galleryPhoto(f,'Other-name.jpg');await f.call('/api/media/'+a.id+'/tag',{method:'POST',body:{personId:'ruti',tagged:true}});await f.call('/api/media/'+b.id+'/tag',{method:'POST',body:{personId:'yona',tagged:true}});
  const save=(faceId,personId,rect,expectedRevision=null)=>f.call('/api/media/'+a.id+'/faces/save',{method:'POST',body:{faceId,personId,rect,expectedRevision}});
  let left=await(await save('1'.repeat(32),'yona',detectedGalleryFaces[0].rect)).json();const right=await(await save('2'.repeat(32),'yona',detectedGalleryFaces[1].rect)).json();
  left=await(await f.call('/api/media/'+a.id+'/faces/save',{method:'POST',body:{faceId:left.face.id,name:family.people.yona.nameEn,rect:left.face.rect,expectedRevision:left.face.revision}})).json();assert.equal(left.face.personId,'yona','Selecting the same person by an English alias preserves their tag');
  let corrected=await(await save(left.face.id,'shlomo',left.face.rect,left.face.revision)).json();assert.deepEqual(new Set(corrected.item.tags.map(p=>p.id)),new Set(['ruti','yona','shlomo']));assert.equal(corrected.faces.find(p=>p.id===right.face.id).personId,'yona');
  corrected=await(await save(right.face.id,'shlomo',right.face.rect,right.face.revision)).json();assert.deepEqual(new Set(corrected.item.tags.map(p=>p.id)),new Set(['ruti','shlomo']));assert.ok(corrected.affectedPersonIds.includes('yona'));assert.ok(corrected.affectedPersonIds.includes('shlomo'));
  let page=await(await f.call('/api/people/yona/page')).json();assert.deepEqual(page.albums.photos.items.map(i=>i.id),[b.id]);page=await(await f.call('/api/people/shlomo/page')).json();assert.deepEqual(page.albums.photos.items.map(i=>i.id),[a.id]);
  assert.equal((await save(right.face.id,'ruti',right.face.rect,right.face.revision)).status,409,'A stale correction cannot remove the latest correct name');
  let removed=await(await save(corrected.face.id,null,corrected.face.rect,corrected.face.revision)).json();assert.ok(removed.item.tags.some(p=>p.id==='shlomo'),'A second labelled occurrence keeps the person tagged');
  const last=removed.faces.find(p=>p.personId==='shlomo');removed=await(await save(last.id,null,last.rect,last.revision)).json();assert.deepEqual(removed.item.tags.map(p=>p.id),['ruti']);assert.deepEqual(removed.faces,[]);assert.equal((await(await f.call('/api/people/shlomo/page')).json()).albums.photos.total,0);
  f.restart();assert.deepEqual((await(await f.call('/api/media/'+a.id+'/tags')).json()).item.tags.map(p=>p.id),['ruti']);assert.deepEqual((await(await f.call('/api/media/'+b.id+'/tags')).json()).item.tags.map(p=>p.id),['yona']);
 }finally{await f.close();}
});

test('family filters include partners and descendants across every gallery page, and select-all returns the same complete result',async()=>{
 const f=fixture();try{
  const insert=f.database.prepare('INSERT INTO media(id,category,person_id,data) VALUES(?,?,?,?)'),tag=f.database.prepare('INSERT INTO media_tags(media_id,person_id) VALUES(?,?)'),id=n=>n.toString(16).padStart(32,'0');
  for(let n=1;n<=209;n++){
   const item={id:id(n),category:'gallery',file:id(n)+'.jpg',mime:'image/jpeg',kind:'photo',name:n<=205?'Memory '+n:'Other'};insert.run(item.id,'gallery',null,JSON.stringify(item));
   tag.run(item.id,n<=100?'matan-g':n<=160?'camille':n<=205?'shay':n===206?'rivi':n===207?'moran':n===208?'maya':'yona');
  }
  const path='/api/collections/gallery?unit=u-matan-g';let r=await f.call(path),etag=r.headers.get('ETag'),result=await r.json();assert.equal(result.count,205);assert.equal(result.items.length,100);assert.equal(result.pagination.pages,3);
  result=await(await f.call(path+'&page=3')).json();assert.equal(result.items.length,5);
  const selection=await(await f.call('/api/gallery/selection?unit=u-matan-g')).json();assert.equal(selection.ids.length,205);assert.equal(new Set(selection.ids).size,205);assert.deepEqual(selection.ids.slice(-5),result.items.map(p=>p.id));
  assert.equal((await f.call(path,{headers:{'If-None-Match':etag}})).status,304);
  assert.equal((await f.call('/api/collections/gallery?unit=u-moran',{headers:{'If-None-Match':etag}})).status,200);
  for(const unit of ['u-rivi','u-harizi'])assert.equal((await(await f.call('/api/collections/gallery?unit='+unit)).json()).count,206);
  assert.equal((await(await f.call('/api/collections/gallery?unit=u-moran')).json()).count,2);
  assert.equal((await(await f.call(path+'&person=shay')).json()).count,205,'An overlapping person does not narrow or duplicate a family');
  assert.equal((await(await f.call(path+'&person=yona')).json()).count,206,'An additional person adds their photos');
  tag.run(id(209),'shay');
  const combined='unit=u-matan-g,u-moran,u-rivi&person=yona,rivi,yona';
  r=await f.call('/api/collections/gallery?'+combined);result=await r.json();const combinedTag=r.headers.get('ETag');
  assert.equal(result.count,209);assert.equal(result.items.length,100);assert.equal(result.pagination.pages,3);
  const combinedSelection=await(await f.call('/api/gallery/selection?'+combined)).json();
  assert.equal(combinedSelection.ids.length,209);assert.equal(new Set(combinedSelection.ids).size,209);
  const lastPage=await(await f.call('/api/collections/gallery?'+combined+'&page=3')).json();assert.equal(lastPage.items.length,9);assert.deepEqual(lastPage.items.map(p=>p.id),combinedSelection.ids.slice(200));
  assert.equal((await f.call('/api/collections/gallery?unit=u-rivi,u-moran,u-matan-g&person=rivi,yona',{headers:{'If-None-Match':combinedTag}})).status,304);
  assert.equal((await(await f.call('/api/collections/gallery?person=moran,maya')).json()).count,2);
  const personId='extra-gallery-person';f.database.prepare('INSERT INTO people(id,data) VALUES(?,?)').run(personId,JSON.stringify({id:personId,name:'Additional guest'}));tag.run(id(206),personId);
  assert.equal((await(await f.call('/api/collections/gallery?person=moran,'+personId)).json()).count,2,'People added through tagging remain selectable');
  assert.equal((await(await f.call(path+'&q=Memory%20205')).json()).count,1);
  assert.deepEqual((await(await f.call('/api/gallery/selection?unit=u-matan-g&q=Memory%20205')).json()).ids,[id(205)]);
  for(const query of ['unit=u-root','unit=u-shay','unit=unknown','unit=u-roi','unit=u-matan-g,unknown','person=missing','person=yona,missing','person=%27%20OR%201%3D1'])assert.equal((await f.call('/api/collections/gallery?'+query)).status,400);
  await f.connect();const zip=await f.call('/api/gallery/download',{method:'POST',body:new URLSearchParams({ids:JSON.stringify(selection.ids),token:'family-public-v1'}).toString()});assert.equal(zip.status,200);await zip.body.cancel();
 }finally{await f.close();}
});

test('ZIP downloads stream exactly the selected gallery photos, deduplicate names and protect other albums and invalid selections',async()=>{
 const f=fixture();try{
  await f.connect();const a=await galleryPhoto(f,'family.jpg'),b=await galleryPhoto(f,'family.jpg'),other=await taggedUpload(f);
  const download=(ids,token='family-public-v1',origin='https://family.example')=>f.call('/api/gallery/download',{method:'POST',body:new URLSearchParams({ids:JSON.stringify(ids),token}).toString(),headers:{'Content-Type':'application/x-www-form-urlencoded','Origin':origin}});
  const response=await download([b.id,a.id,b.id]);assert.equal(response.status,200);assert.equal(response.headers.get('Content-Type'),'application/zip');assert.match(response.headers.get('Content-Disposition'),/attachment; filename="Keha-Family-Photos-/);
  const bytes=Buffer.from(await response.arrayBuffer());assert.equal(bytes.readUInt32LE(0),0x04034b50);const names=[];let start=0;
  while((start=bytes.indexOf(Buffer.from([0x50,0x4b,0x01,0x02]),start))>=0){const length=bytes.readUInt16LE(start+28);names.push(bytes.subarray(start+46,start+46+length).toString('utf8'));start+=46+length;}
  assert.deepEqual(names,['0001-family.jpg','0002-family.jpg']);assert.equal(f.objects.size,3,'Downloading never creates stored ZIP copies');
  assert.equal((await download([])).status,400);assert.equal((await download(['invalid'])).status,400);
  assert.equal((await download([other.id])).status,409);assert.equal((await download([a.id],'wrong')).status,403);assert.equal((await download([a.id],'family-public-v1','https://unrelated.example')).status,403);
  await f.call('/api/media/'+a.id+'/delete',{method:'POST',body:{scope:'gallery'}});assert.equal((await download([a.id,b.id])).status,409);
 }finally{await f.close();}
});
