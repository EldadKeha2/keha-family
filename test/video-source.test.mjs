import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createVideoSource} from '../public/assets/video-source-upload.mjs';
import {VIDEO_PART_SIZE} from '../src/video-multipart.mjs';
import {expireVideoSources} from '../src/video-source-route.mjs';
import {videoSourceFixture} from './helpers/video-source-storage.mjs';

const clip = await readFile(new URL('./fixtures/video-clip-source.mp4',import.meta.url));
const publication = (name,range) => ({mediaId:crypto.randomUUID().replaceAll('-',''),operationId:crypto.randomUUID().replaceAll('-',''),
  metadata:{name,caption:'A family moment',date:{year:1989},people:[],...(range?{range}:{})}});
const options = f => ({scope:'nostalgia',baseURL:f.origin,request:f.request,writeToken:f.writeToken,tr:(_,en)=>en,delay:async()=>{},changed(){}});
const count = f => f.database.prepare('SELECT COUNT(*) AS n FROM media').get().n;

test('a staged original supports seeking, independent segment saves and an exact, idempotent full-video save', async t => {
  const f = await videoSourceFixture(); t.after(()=>f.close());
  const initial=count(f);
  const file = new File([clip],'recording.mp4',{type:'video/mp4'});
  const source = createVideoSource(file,options(f));
  await source.ensure();
  assert.equal(count(f),initial);
  assert.equal(source.phase,'ready');
  const missing = await f.request('/api/video-sources/'+'f'.repeat(64)+'/play');
  assert.equal(missing.status,404);
  const head = await f.request(source.url,{method:'HEAD'});
  assert.equal(Number(head.headers.get('Content-Length')),clip.length);
  const range = await f.request(source.url,{headers:{Range:'bytes=128-255'}});
  assert.equal(range.status,206);
  assert.deepEqual(Buffer.from(await range.arrayBuffer()),clip.subarray(128,256));
  const segment = publication('First segment',{start:1,end:3});
  const first = await source.save(segment);
  assert.equal(first.item.name,'First segment'); assert.equal(first.item.caption,'A family moment');
  assert.equal((await source.save(segment)).item.id,first.item.id);
  assert.equal(count(f),initial+1);
  const full = publication('The whole tape');
  const saved = await source.save(full);
  assert.equal((await source.save(full)).item.id,saved.item.id);
  const stored = f.scope.run('media.get',{id:full.mediaId});
  const short = f.scope.run('media.get',{id:segment.mediaId});
  assert.notEqual(stored.key,short.key);
  assert.ok(short.size<stored.size);assert.equal(short.duration,2);
  assert.equal(count(f),initial+2);
  await assert.rejects(source.save({...full,metadata:{...full.metadata,name:'Changed'}}),e=>e.status===409);
  await source.discard(); await f.settle();
  assert.equal((await f.request(source.url)).status,410);
  assert.deepEqual(await readFile(f.objectFile(stored.key)),clip);
  assert.equal(f.calls.filter(c=>c.action==='part').length,1);
});

test('interrupted transfer resumes only missing parts and cleans up a draft with no public entry',async t=>{
  const f=await videoSourceFixture(); t.after(()=>f.close());
  const initial=count(f);
  const file=new File([clip,new Uint8Array(VIDEO_PART_SIZE*2)],'long.mp4',{type:'video/mp4'});
  let interrupted=true, capability;
  const source=createVideoSource(file,{...options(f), request:async(path,opts)=>{
    capability=opts.headers['X-Video-Source'];
    if (interrupted && opts.headers['X-Upload-Part']==='2') return Response.json({error:'Connection lost'},{status:503});
    return f.request(path,opts);
  }});
  await assert.rejects(source.ensure(),/Connection lost/);assert.equal(source.phase,'failed');
  assert.ok(source.received>=VIDEO_PART_SIZE&&source.received<file.size);
  const headers={'X-Family-Token':f.writeToken,'X-Video-Source':capability,'Content-Type':'application/json'};
  assert.equal((await f.request('/api/video-sources/complete',{method:'POST',headers,body:'{}'})).status,409);
  assert.equal((await f.request('/api/video-sources/'+capability+'/play')).status,409);
  assert.equal(count(f),initial);
  interrupted=false;await source.ensure();
  assert.equal(source.received,file.size);
  assert.equal(f.calls.filter(c=>c.action==='status').length,1);
  for(const n of ['1','2','3'])assert.equal(f.calls.filter(c=>c.action==='part'&&c.part===n).length,1);
  assert.deepEqual(new Uint8Array(await (await f.request(source.url)).arrayBuffer()),new Uint8Array(await file.arrayBuffer()));
  const key=JSON.parse(f.database.prepare('SELECT data FROM video_sources').get().data).key;
  f.database.exec('UPDATE video_sources SET expires=0');
  await expireVideoSources(f.env,async(action,p={})=>f.scope.run(action,p));
  assert.equal(count(f),initial);await assert.rejects(readFile(f.objectFile(key)),{code:'ENOENT'});
  assert.equal((await f.request(source.url)).status,404);
});

test('4 GiB is accepted exactly and an oversized source cannot begin a transfer',async t=>{
  const f=await videoSourceFixture();t.after(()=>f.close());
  const max=4*1024**3, headers={'X-Family-Token':f.writeToken,'X-Video-Source':'8'.repeat(64),'Content-Type':'application/json'};
  const start=size=>f.request('/api/video-sources/start',{method:'POST',headers,body:JSON.stringify({scope:'videos',filename:'large.mp4',size,head:clip.subarray(0,128).toString('base64')})});
  assert.equal((await start(max+1)).status,413);
  const accepted=await start(max);assert.equal(accepted.status,201);assert.equal((await accepted.json()).parts,512);
  assert.equal(f.uploads.size,1);
  await f.request('/api/video-sources/discard',{method:'POST',headers,body:'{}'});await f.settle();assert.equal(f.uploads.size,0);
});

test('a saved split survives source cleanup, reopens the whole film and moves the same work between destinations',async t=>{
  const f=await videoSourceFixture();t.after(()=>f.close());
  const initial=count(f),id=()=>crypto.randomUUID().replaceAll('-',''),workId=id();
  const file=new File([clip],'family.mp4',{type:'video/mp4'}),source=createVideoSource(file,options(f));
  const metadata={name:'Family tape',date:{year:1998},caption:'',people:[],eventId:''};
  const snapshot={duration:12,position:3.25,index:1,nextNumber:3,original:{uploadId:id(),metadata},
    segments:[
      {uploadId:id(),metadata,segment:{number:1,start:0,end:2,pinned:true}},
      {uploadId:id(),metadata:{...metadata,name:'',caption:'Unfinished',people:[{name:'Guest'}]},segment:{number:2,start:2,end:null,endText:'00:',followsPrevious:true}}
    ]};
  const payload={workId,revision:null,snapshot};
  const first=await source.saveWork(payload);
  assert.deepEqual(first.item.nostalgiaEventIds,[]);
  assert.equal(first.collection.items.find(item=>item.id===workId).segmentWork.number,2);
  assert.equal(first.item.segmentWork.snapshot,undefined);
  assert.equal((await source.saveWork(payload)).workRevision,first.workRevision);
  assert.equal(count(f),initial+1);
  const published={mediaId:snapshot.segments[0].uploadId,operationId:id(),metadata:{...metadata,range:{start:0,end:2},segmentProject:{id:workId,number:1,start:0,end:2,duration:12}}};
  await source.save(published);
  const storageKey=f.scope.media(workId).key;
  await source.discard();await f.settle();
  f.database.exec('UPDATE video_sources SET expires=0');
  await expireVideoSources(f.env,async(action,p={})=>f.scope.run(action,p));
  assert.deepEqual(await readFile(f.objectFile(storageKey)),clip);
  const reopened=createVideoSource(null,options(f));
  const work=await reopened.resume(workId);
  assert.deepEqual(work.file,{name:file.name,size:file.size,type:file.type});
  assert.equal(work.snapshot.position,3.25);assert.equal(work.snapshot.index,1);
  assert.equal(work.snapshot.segments[1].segment.end,null);assert.equal(work.snapshot.segments[1].segment.endText,'00:');
  assert.deepEqual(work.snapshot.segments[1].metadata.people,[{name:'Guest'}]);
  assert.deepEqual(work.published.map(item=>item.id),[published.mediaId]);
  assert.deepEqual(Buffer.from(await (await f.request(reopened.url)).arrayBuffer()),clip);
  assert.equal((await reopened.save(published)).item.id,published.mediaId);
  const assigned=structuredClone(snapshot);
  assigned.segments[1].metadata.eventId='everyday-life-clips';assigned.position=4;
  const second=await reopened.saveWork({workId,revision:first.workRevision,snapshot:assigned});
  assert.deepEqual(second.item.nostalgiaEventIds,['everyday-life-clips']);
  assert.equal(second.collection.items.filter(item=>item.id===workId).length,1);
  assert.equal(second.item.segmentWork.position,4);
  assert.notEqual(second.workRevision,first.workRevision);
  await assert.rejects(reopened.saveWork({workId,revision:first.workRevision,snapshot}),e=>e.status===409);
  const event=f.scope.nostalgiaLibrary.read().events.find(e=>e.id!=='everyday-life-clips');
  assigned.segments[1].metadata.eventId=event.id;
  const moved=await reopened.saveWork({workId,revision:second.workRevision,snapshot:assigned});
  assert.deepEqual(moved.item.nostalgiaEventIds,[event.id]);
  const unassigned=f.scope.run('nostalgia.assign',{id:workId,remove:[event.id]});
  assert.deepEqual(unassigned.item.nostalgiaEventIds,[]);
  await reopened.discard();
  const last=createVideoSource(null,options(f));
  assert.equal((await last.resume(workId)).snapshot.segments[1].metadata.eventId,'');
  assert.equal(count(f),initial+2);
  assert.equal(f.calls.filter(c=>c.action==='part').length,1);
  await last.discard();await f.settle();
});
