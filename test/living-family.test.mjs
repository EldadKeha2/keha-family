import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import {FamilyState} from '../src/state.mjs';
import {livingPhotos,livingActions} from '../src/living-family-catalog.mjs';
import {livingFamilyRoute} from '../src/living-family-route.mjs';
import {livingVideoInfo} from '../src/living-family-video.mjs';
import {uid,HttpError,sha256} from '../src/http.mjs';

const video=new Uint8Array(await readFile(new URL('./fixtures/living-family-5s.mp4',import.meta.url)));
const longVideo=new Uint8Array(await readFile(new URL('./fixtures/living-family-too-long.mp4',import.meta.url)));
function fixture(){
  const database=new DatabaseSync(':memory:');
  const sql={exec(query,...args){const statement=database.prepare(query),rows=statement.columns().length?statement.all(...args):(statement.run(...args),[]);return {toArray:()=>rows};}};
  const storage={sql,transactionSync(callback){database.exec('BEGIN');try{const result=callback();database.exec('COMMIT');return result;}catch(error){database.exec('ROLLBACK');throw error;}}};
  const state=new FamilyState({storage},{}),objects=new Map(),calls=[],pending=[];
  const run=(action,p={})=>storage.transactionSync(()=>state.run(action,p));
  for(const photo of livingPhotos){const item={id:photo.id,category:'gallery',filename:'family.jpg',name:photo.title,file:photo.id+'.jpg',key:'photos/'+photo.id+'.jpg',mime:'image/jpeg',kind:'photo',size:1000,labels:['black-and-white'],createdAt:'2026-11-15T12:00:00Z'};database.prepare('INSERT INTO media(id,category,data) VALUES(?,?,?)').run(photo.id,'gallery',JSON.stringify(item));}
  const env={HF_NAMESPACE:'test-family',HF_BUCKET:'photos',HF_ACCESS_KEY_ID:'fake-test-key',HF_SECRET_ACCESS_KEY:'fake-test-secret'};
  const ctx={waitUntil(promise){pending.push(promise);}};
  const fetcher=async request=>{
    calls.push({method:request.method,url:request.url});const key=new URL(request.url).pathname;
    if(request.method==='PUT'){objects.set(key,new Uint8Array(await request.arrayBuffer()));return new Response('',{status:200});}
    if(request.method==='DELETE'){objects.delete(key);return new Response('',{status:200});}
    const bytes=objects.get(key);if(!bytes)return new Response('',{status:404});
    const range=request.headers.get('Range');if(range){const [,start,end]=/^bytes=(\d+)-(\d+)$/.exec(range);return new Response(bytes.slice(Number(start),Number(end)+1),{status:206,headers:{'Content-Range':`bytes ${start}-${end}/${bytes.length}`,'Content-Length':String(Number(end)-Number(start)+1)}});}
    return new Response(request.method==='HEAD'?null:bytes,{headers:{'Content-Length':String(bytes.length)}});
  };
  const call=async(path,{bytes=video,method='GET',headers={}}={})=>livingFamilyRoute(new Request('https://family.test'+path,{method,headers,...(method==='POST'?{body:bytes}:{})}),env,async(action,p)=>{const response=await state.fetch(new Request('https://state.internal/',{method:'POST',body:JSON.stringify({...p,action}),headers:{'Content-Type':'application/json'}}));const result=await response.json();if(!response.ok)throw new HttpError(response.status,result.error,result.code);return result;},ctx,fetcher);
  const path=(id,action,operation=uid(),expected='none',revision='original')=>`/api/family-ai/photos/${id}/clips/${action}?revision=${revision}&operation=${operation}&expected=${expected}&filename=memory.mp4`;
  return {state,database,run,objects,calls,pending,call,path,close(){database.close();}};
}

test('the curated album has nineteen photos, three honest pending actions, and leaves gallery metadata intact',()=>{
  const f=fixture();try{
    assert.equal(livingPhotos.length,19);assert.deepEqual(livingActions.map(a=>a.id),['smile','wave','dance']);assert.ok(livingPhotos.filter(p=>!p.requestedColorException).every(p=>p.originalBlackAndWhite===true));assert.deepEqual(livingPhotos.filter(p=>p.requestedColorException).map(p=>p.id),['d76e78dc736a404fac0f36d68d2a760f','89b5dd6a048342ecb9cd4b29b73ca197',...livingPhotos.filter(p=>p.ownerUploadedSource).map(p=>p.id)]);assert.ok(!livingPhotos.some(p=>['a1e9162209384402b481b7a487ca5cf9','7f80a774ddd94d2c8ae629264f284b27'].includes(p.id)));
    const before=f.database.prepare('SELECT data FROM media ORDER BY id').all();const album=f.run('family-ai.living.list');
    assert.equal(album.total,19);assert.equal(album.totalClips,57);assert.equal(album.readyClips,0);assert.ok(album.items.every(item=>item.animations.length===3&&item.animations.every(a=>a.status==='pending'&&!a.videoSrc)));
    assert.equal('key'in album.items[0],false);assert.deepEqual(f.database.prepare('SELECT data FROM media ORDER BY id').all(),before);
  }finally{f.close();}
});

test('the owner-restored source replaces only its AI card and never adds a gallery or personal-album duplicate',async()=>{
  const f=fixture(),id='d76e78dc736a404fac0f36d68d2a760f',oldId='7f80a774ddd94d2c8ae629264f284b27';try{
    f.database.prepare('DELETE FROM media WHERE id=?').run(id);
    const portrait=JSON.stringify({id:oldId,category:'personal',personId:'shlomo',filename:'original.png',file:oldId+'.png',kind:'photo',mime:'image/png',size:100,key:'portrait.png'});
    f.database.prepare('INSERT INTO media(id,category,person_id,data) VALUES(?,?,?,?)').run(oldId,'personal','shlomo',portrait);
    const galleryCount=f.database.prepare("SELECT count(*) AS n FROM media WHERE category='gallery'").get().n;
    const png=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j0GQAAAAASUVORK5CYII=','base64'));
    const path='/api/family-ai/photos/'+id+'/source';let response=await f.call(path,{method:'POST',bytes:png});assert.equal(response.status,201);const result=await response.json();assert.equal(result.item.scope,'family-ai');
    assert.equal(f.database.prepare("SELECT count(*) AS n FROM media WHERE category='gallery'").get().n,galleryCount);
    assert.equal(f.database.prepare('SELECT data FROM media WHERE id=?').get(oldId).data,portrait);
    assert.equal(f.database.prepare('SELECT count(*) AS n FROM media_collections WHERE media_id=?').get(id).n,0);
    const featured=f.run('family-ai.living.list');assert.ok(featured.items.some(p=>p.id===id&&p.animations.every(a=>a.status==='pending')));assert.ok(!featured.items.some(p=>p.id===oldId));
    response=await f.call(path,{method:'POST',bytes:png});assert.equal((await response.json()).alreadySaved,true);assert.equal(f.calls.filter(c=>c.method==='PUT').length,1);
    await assert.rejects(f.call('/api/family-ai/photos/'+oldId+'/source',{method:'POST',bytes:png}),e=>e.code==='LIVING_SOURCE');
    const changed=png.slice();changed[changed.length-1]^=1;await assert.rejects(f.call(path,{method:'POST',bytes:changed}),e=>e.code==='LIVING_SOURCE_CHANGED');
    await assert.rejects(f.call(path,{method:'POST',bytes:new TextEncoder().encode('not a PNG')}),e=>e.code==='LIVING_SOURCE_FORMAT');
  }finally{f.close();}
});

test('the replaced color sources cannot be featured, animated, or served as prepared clips',async()=>{
  const f=fixture();try{
    for(const id of ['69af11cd81634789b926acff99dd37b1','593ae5f58cb74de389ab387b0e6c8eff','8002969bd642436089a78b045da2d4fe','38526015914c4738943e7ad543275d2a','0427f8c68f454d50b2f867ce4f24675f','193c0accaa7a41e8bd3c2b0a6f5e71be']){
      assert.ok(!livingPhotos.some(photo=>photo.id===id));
      await assert.rejects(f.call(`/api/family-ai/video/${id}/smile`),e=>e.code==='LIVING_PHOTO');
    }
  }finally{f.close();}
});

test('real short H.264 files are accepted and malformed or overlong videos are rejected',async()=>{
  const info=await livingVideoInfo(video);assert.ok(Math.abs(info.duration-5.0625)<.001);assert.equal(info.codec,'h264');
  await assert.rejects(livingVideoInfo(new TextEncoder().encode('not a video')),e=>e.status===415);
  await assert.rejects(livingVideoInfo(longVideo),e=>e.code==='LIVING_DURATION');
});

test('each action imports independently, survives retries, and plays from durable storage with range and download support',async()=>{
  const f=fixture(),id=livingPhotos[0].id;try{
    const operation=uid(),path=f.path(id,'smile',operation);let response=await f.call(path,{method:'POST'});assert.equal(response.status,201);let saved=await response.json();
    assert.equal(saved.clip.action,'smile');assert.ok(saved.clip.duration>5);assert.match(saved.clip.videoSrc,/\/smile\?v=/);
    response=await f.call(path,{method:'POST'});assert.equal(response.status,200);assert.equal((await response.json()).alreadySaved,true);assert.equal(f.calls.filter(c=>c.method==='PUT').length,1);
    await f.call(f.path(id,'wave'),{method:'POST'});await f.call(f.path(id,'dance'),{method:'POST'});
    const album=f.run('family-ai.living.list');assert.equal(album.readyClips,3);assert.equal(album.items[0].animations.filter(a=>a.status==='ready').length,3);assert.equal(album.items[1].animations.filter(a=>a.status==='ready').length,0);
    for(const action of album.items[0].animations){assert.ok(action.videoSrc.includes('/'+action.id+'?v='));response=await f.call(action.videoSrc);assert.equal(response.status,200);assert.equal((await response.arrayBuffer()).byteLength,video.byteLength);}
    response=await f.call(saved.clip.videoSrc,{headers:{Range:'bytes=0-9'}});assert.equal(response.status,206);assert.equal((await response.arrayBuffer()).byteLength,10);assert.match(response.headers.get('Content-Range'),/^bytes 0-9\//);
    response=await f.call(saved.clip.videoSrc+'&download=1');assert.match(response.headers.get('Content-Disposition'),/attachment;.*smile/);
    response=await f.call(saved.clip.videoSrc,{method:'HEAD'});assert.equal(response.status,200);assert.equal((await response.arrayBuffer()).byteLength,0);
    assert.ok(f.calls.every(c=>new URL(c.url).hostname==='s3.hf.co'));assert.ok(!JSON.stringify(album).includes('fake-test-secret'));assert.equal(f.run('export').familyAi.living.clips.length,3);
  }finally{f.close();}
});

test('a delayed import cannot replace a newer action or reuse its operation for another action',async()=>{
  const f=fixture(),id=livingPhotos[0].id;try{
    const oldPath=f.path(id,'smile');const first=await(await f.call(oldPath,{method:'POST'})).json();
    const second=await(await f.call(f.path(id,'smile',uid(),first.clip.version),{method:'POST'})).json();
    const retry=await(await f.call(oldPath,{method:'POST'})).json();assert.equal(retry.clip.version,second.clip.version);assert.equal(f.run('family-ai.living.get',{id,variant:'smile'}).clip.version,second.clip.version);
    await assert.rejects(f.call(f.path(id,'smile'),{method:'POST'}),e=>e.code==='LIVING_CLIP_CHANGED');
    await assert.rejects(f.call(oldPath.replace('/smile?','/wave?'),{method:'POST'}),e=>e.code==='LIVING_OPERATION');
    await assert.rejects(f.call(first.clip.videoSrc),e=>e.code==='LIVING_CLIP_CHANGED');
  }finally{f.close();}
});

test('source edits, exclusion, and absent actions remain visible as stale, hidden, or pending without changing originals',async()=>{
  const f=fixture(),id=livingPhotos[0].id;try{
    const saved=await(await f.call(f.path(id,'smile'),{method:'POST'})).json();
    await assert.rejects(f.call(`/api/family-ai/video/${id}/wave`),e=>e.code==='LIVING_PENDING');
    const row=f.database.prepare('SELECT data FROM media WHERE id=?').get(id),item=JSON.parse(row.data);item.photoRevision='edited';f.database.prepare('UPDATE media SET data=? WHERE id=?').run(JSON.stringify(item),id);
    assert.equal(f.run('family-ai.living.list').items[0].animations[0].stale,true);
    await assert.rejects(f.call(f.path(id,'wave'),{method:'POST'}),e=>e.code==='LIVING_SOURCE_CHANGED');
    f.run('family-ai.exclude',{id,excluded:true});assert.equal(f.run('family-ai.living.list').total,18);await assert.rejects(f.call(saved.clip.videoSrc),e=>e.code==='LIVING_PHOTO');
    assert.ok(f.database.prepare('SELECT data FROM media WHERE id=?').get(id));
  }finally{f.close();}
});


test('AI removal requires the private configured password, persists and leaves originals and other albums intact',async()=>{
  const f=fixture(),id=livingPhotos.find(p=>p.ownerUploadedSource).id;
  const call=async(action,p={})=>f.state.fetch(new Request('https://state.internal/',{method:'POST',body:JSON.stringify({action,...p})}));
  try{
    const setupKey='1'.repeat(64);f.state.env.FAMILY_AI_REMOVAL_SETUP_DIGEST=await sha256(setupKey);
    assert.equal((await call('family-ai.removal.setup',{setupKey:'wrong',password:'test-removal-password'})).status,403);
    assert.equal((await call('family-ai.removal.setup',{setupKey,password:'test-removal-password'})).status,200);
    assert.equal((await call('family-ai.removal.setup',{setupKey,password:'0000'})).status,409);
    const original=f.database.prepare('SELECT data FROM media WHERE id=?').get(id).data;
    assert.equal((await call('media.delete',{id,scope:'living-family',client:'owner'})).status,401);
    assert.equal((await call('media.delete',{id,scope:'family-ai',password:'test-removal-password',client:'owner'})).status,200);
    assert.equal(f.database.prepare('SELECT data FROM media WHERE id=?').get(id).data,original);
    assert.equal((await call('family-ai.exclude',{id,excluded:false})).status,200);
    for(const password of [undefined,'0000'])assert.equal((await call('family-ai.exclude',{id,excluded:true,password,client:'owner'})).status,401);
    assert.ok(f.run('family-ai.living.list').items.some(p=>p.id===id));
    const result=await call('family-ai.exclude',{id,excluded:true,password:'test-removal-password',client:'owner'});assert.equal(result.status,200);
    assert.ok(!f.run('family-ai.living.list').items.some(p=>p.id===id));
    assert.equal(f.database.prepare('SELECT data FROM media WHERE id=?').get(id).data,original);
    await assert.rejects(f.call(f.path(id,'smile'),{method:'POST'}),error=>error.code==='LIVING_PHOTO');
    assert.equal((await call('family-ai.exclude',{id,excluded:false})).status,200);
    assert.ok(f.run('family-ai.living.list').items.some(p=>p.id===id));
    for(let i=0;i<5;i++)assert.equal((await call('family-ai.exclude',{id,excluded:true,password:'wrong',client:'guesser'})).status,401);
    const limited=await call('family-ai.exclude',{id,excluded:true,password:'test-removal-password',client:'guesser'});assert.equal(limited.status,429);assert.ok(limited.headers.get('Retry-After'));
    assert.ok(!JSON.stringify(f.run('export')).includes('test-removal-password'));
    assert.ok(!f.database.prepare('SELECT value FROM family_ai_access WHERE id=?').get('config').value.includes('test-removal-password'));
  }finally{f.close();}
});

test('explicit uploaded sources are bound to the exact owner-selected digest and cannot be substituted',()=>{
  const f=fixture(),entry=livingPhotos.find(p=>p.ownerUploadedSource);
  try{
    f.database.prepare('DELETE FROM media WHERE id=?').run(entry.id);
    const input={id:entry.id,digest:'a'.repeat(64),mime:'image/png',size:100};
    assert.throws(()=>f.run('family-ai.living.source.prepare',input),error=>error.code==='LIVING_SOURCE_CHANGED');
    input.digest=entry.sourceDigest;
    assert.equal(f.run('family-ai.living.source.prepare',input).alreadySaved,false);
    const saved=f.run('family-ai.living.source.save',{...input,key:'family-ai/'+entry.id+'/source/'+entry.sourceDigest+'.png'});
    assert.equal(saved.item.scope,'family-ai');assert.equal(saved.item.filename,entry.sourceFilename);
    assert.equal(f.run('family-ai.living.source.prepare',input).alreadySaved,true);
    assert.equal(f.database.prepare('SELECT count(*) AS n FROM media_collections WHERE media_id=?').get(entry.id).n,0);
    assert.ok(f.run('family-ai.list',{excluded:false}).items.some(p=>p.id===entry.id));
  }finally{f.close();}
});
