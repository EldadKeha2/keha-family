import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import {FamilyState} from '../src/state.mjs';
import {livingPhotos,livingActions} from '../src/living-family-catalog.mjs';
import {livingFamilyRoute} from '../src/living-family-route.mjs';
import {livingVideoInfo} from '../src/living-family-video.mjs';
import {uid} from '../src/http.mjs';

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
  const call=async(path,{bytes=video,method='GET',headers={}}={})=>livingFamilyRoute(new Request('https://family.test'+path,{method,headers,...(method==='POST'?{body:bytes}:{})}),env,async(action,p)=>run(action,p),ctx,fetcher);
  const path=(id,action,operation=uid(),expected='none',revision='original')=>`/api/family-ai/photos/${id}/clips/${action}?revision=${revision}&operation=${operation}&expected=${expected}&filename=memory.mp4`;
  return {state,database,run,objects,calls,pending,call,path,close(){database.close();}};
}

test('the curated album has ten photos, three honest pending actions, and leaves gallery metadata intact',()=>{
  const f=fixture();try{
    assert.equal(livingPhotos.length,10);assert.deepEqual(livingActions.map(a=>a.id),['smile','wave','dance']);assert.ok(livingPhotos.every(p=>[1,2].includes(p.generation)));
    const before=f.database.prepare('SELECT data FROM media ORDER BY id').all();const album=f.run('family-ai.living.list');
    assert.equal(album.total,10);assert.equal(album.totalClips,30);assert.equal(album.readyClips,0);assert.ok(album.items.every(item=>item.animations.length===3&&item.animations.every(a=>a.status==='pending'&&!a.videoSrc)));
    assert.equal('key'in album.items[0],false);assert.deepEqual(f.database.prepare('SELECT data FROM media ORDER BY id').all(),before);
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
    const retry=await(await f.call(oldPath,{method:'POST'})).json();assert.equal(retry.clip.version,second.clip.version);assert.equal(f.run('family-ai.living.get',{id,action:'smile'}).clip.version,second.clip.version);
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
    f.run('family-ai.exclude',{id,excluded:true});assert.equal(f.run('family-ai.living.list').total,9);await assert.rejects(f.call(saved.clip.videoSrc),e=>e.code==='LIVING_PHOTO');
    assert.ok(f.database.prepare('SELECT data FROM media WHERE id=?').get(id));
  }finally{f.close();}
});
