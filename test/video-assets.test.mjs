import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {videoAssetsPublic,videoAssetsQueue,saveVideoAsset,currentVideoAsset} from '../src/video-assets-state.mjs';
import {videoAssetBody,resolveVideoAsset,saveVideoAssetRoute} from '../src/video-assets.mjs';
const id='a'.repeat(32),revision='original';
const video=()=>({id,key:'videos/original.mp4',size:100000,mime:'video/mp4',kind:'video',file:id+'.mp4',category:'videos'});
const asset=(variant,extra={})=>({revision,key:'video-assets/'+id+'/'+revision+'/'+variant+'/derived.'+(variant==='poster'?'jpg':'mp4'),mime:variant==='poster'?'image/jpeg':'video/mp4',size:1000,...extra});
function stateFixture(){
  const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE media(id TEXT PRIMARY KEY,data TEXT)');
  const state={rows:(sql,...params)=>db.prepare(sql).all(...params),sql:{exec:(sql,...params)=>db.prepare(sql).run(...params)},media:mediaId=>JSON.parse(db.prepare('SELECT data FROM media WHERE id=?').get(mediaId).data),mediaPublic:item=>({src:'/media/'+item.id,...videoAssetsPublic(item)}),touchPeople(){},relatedPeople:()=>[],mediaCollections:()=>['videos'],touch(){},mediaScope:()=> 'videos'};
  state.sql.exec('INSERT INTO media VALUES(?,?)',id,JSON.stringify(video()));return {state,close:()=>db.close()};
}
test('public video derivatives match the current revision and preserve the original URL',()=>{
  const item={...video(),videoAssets:{poster:asset('poster'),faststart:asset('faststart'),low:asset('low',{width:640,height:360,duration:30,bitrate:350000}),medium:asset('medium',{revision:'old'})}};
  const result=videoAssetsPublic(item);assert.match(result.poster,/videoAsset=poster&v=original/);assert.match(result.faststartSrc,/videoAsset=faststart/);assert.equal(result.playbackSources.length,1);assert.equal(result.playbackSources[0].height,360);assert.equal(item.key,'videos/original.mp4');
  item.videoRevision='b'.repeat(32);assert.deepEqual(videoAssetsPublic(item),{});assert.equal(currentVideoAsset(item,'poster'),null);
  assert.deepEqual(videoAssetsPublic({...item,provider:'youtube'}),{});
});
test('queue completion and skipped copies are revision scoped and never replace originals',()=>{
  const f=stateFixture();try{
    assert.equal(videoAssetsQueue(f.state).pending,1);
    saveVideoAsset(f.state,{id,variant:'poster',revision,asset:asset('poster')});
    for(const variant of ['faststart','low','medium'])saveVideoAsset(f.state,{id,variant,revision,asset:{revision,skipped:true,reason:'not-needed'}});
    assert.equal(videoAssetsQueue(f.state).pending,0);assert.equal(f.state.media(id).key,'videos/original.mp4');
    const changed={...f.state.media(id),videoRevision:'b'.repeat(32)};f.state.sql.exec('UPDATE media SET data=? WHERE id=?',JSON.stringify(changed),id);
    const queue=videoAssetsQueue(f.state);assert.equal(queue.pending,1);assert.equal(queue.items[0].poster,true);assert.equal(queue.items[0].revision,'b'.repeat(32));
    assert.throws(()=>saveVideoAsset(f.state,{id,variant:'poster',revision,asset:asset('poster')}),error=>error.status===409);
  }finally{f.close();}
});
test('derived media reads reject stale URLs, missing variants and invalid asset names',()=>{
  const item={...video(),videoAssets:{poster:asset('poster')}};
  assert.equal(resolveVideoAsset(item,new URLSearchParams()),null);
  assert.equal(resolveVideoAsset(item,new URLSearchParams('videoAsset=poster&v=original')).kind,'photo');
  assert.throws(()=>resolveVideoAsset(item,new URLSearchParams('videoAsset=poster&v=stale')),error=>error.status===409);
  assert.throws(()=>resolveVideoAsset(item,new URLSearchParams('videoAsset=low&v=original')),error=>error.status===404);
  assert.throws(()=>resolveVideoAsset(item,new URLSearchParams('videoAsset=../../original&v=original')),error=>error.status===400);
});
const mp4=Buffer.from('000000206674797069736f6d0000020069736f6d69736f32617663316d703431','hex');
test('video derivative uploads stream validated bytes and reject length/signature corruption',async()=>{
  const request=bytes=>new Request('https://family.example/upload',{method:'POST',headers:{'Content-Length':String(bytes.length)},body:bytes});
  const result=await videoAssetBody(request(mp4),1000,'low');assert.deepEqual(Buffer.from(await new Response(result.body).arrayBuffer()),mp4);
  await assert.rejects(()=>videoAssetBody(request(mp4),12,'low'),error=>error.status===413);
  await assert.rejects(()=>videoAssetBody(request(Buffer.alloc(40)),1000,'low'),error=>error.status===415);
  const truncated=new Request('https://family.example/upload',{method:'POST',headers:{'Content-Length':'100'},body:mp4});const body=await videoAssetBody(truncated,1000,'low');await assert.rejects(()=>new Response(body.body).arrayBuffer(),error=>error.status===400);
});
test('backend stores a derived file separately and deduplicates completed uploads without touching the original',async()=>{
  const originalFetch=globalThis.fetch,stored=[],deleted=[],tasks=[],f=stateFixture();
  const env={HF_NAMESPACE:'test',HF_BUCKET:'family',HF_ACCESS_KEY_ID:'test-only',HF_SECRET_ACCESS_KEY:'test-only'};
  globalThis.fetch=async request=>{if(request.method==='PUT'){stored.push({url:request.url,bytes:Buffer.from(await request.arrayBuffer())});return new Response(null,{status:200});}if(request.method==='DELETE'){deleted.push(request.url);return new Response(null,{status:204});}throw Error('Unexpected request');};
  const db=async(action,p)=>action==='media.get'?f.state.media(p.id):action==='media.public'?{item:f.state.mediaPublic(f.state.media(p.id))}:action==='video.asset.save'?saveVideoAsset(f.state,p):assert.fail(action);
  const call=variant=>saveVideoAssetRoute(new Request('https://family.example/api/media/'+id+'/video-assets/'+variant+'?revision=original&height=360',{method:'POST',headers:{'Content-Length':String(mp4.length)},body:mp4}),env,db,{waitUntil:promise=>tasks.push(promise)},id,variant);
  try{assert.equal((await(await call('low')).json()).saved,true);assert.equal(stored.length,1);assert.match(stored[0].url,/video-assets\//);assert.equal(f.state.media(id).key,'videos/original.mp4');assert.equal(f.state.media(id).videoAssets.low.height,360);assert.equal((await(await call('low')).json()).saved,false);assert.equal(stored.length,1);assert.equal(deleted.length,0);}finally{await Promise.allSettled(tasks);globalThis.fetch=originalFetch;f.close();}
});
test('a video edited during upload rejects the stale derivative and cleans only its newly uploaded key',async()=>{
  const originalFetch=globalThis.fetch,deleted=[],tasks=[],item=video(),env={HF_NAMESPACE:'test',HF_BUCKET:'family',HF_ACCESS_KEY_ID:'test-only',HF_SECRET_ACCESS_KEY:'test-only'};
  globalThis.fetch=async request=>{if(request.method==='PUT'){await request.arrayBuffer();return new Response(null,{status:200});}if(request.method==='DELETE'){deleted.push(request.url);return new Response(null,{status:204});}throw Error('Unexpected request');};
  const db=async(action)=>{if(action==='media.get')return item;if(action==='video.asset.save')throw Object.assign(new Error('Edited meanwhile'),{status:409});assert.fail(action);};
  try{await assert.rejects(()=>saveVideoAssetRoute(new Request('https://family.example/api/media/'+id+'/video-assets/low?revision=original',{method:'POST',headers:{'Content-Length':String(mp4.length)},body:mp4}),env,db,{waitUntil:promise=>tasks.push(promise)},id,'low'),error=>error.status===409);await Promise.all(tasks);assert.equal(deleted.length,1);assert.match(deleted[0],/video-assets\//);assert.doesNotMatch(deleted[0],/videos\/original/);assert.equal(item.key,'videos/original.mp4');}finally{globalThis.fetch=originalFetch;}
});
test('non-beneficial copies are completed with a revision-scoped skip without reading or uploading original bytes',async()=>{
  const f=stateFixture(),tasks=[];const db=async(action,p)=>action==='media.get'?f.state.media(p.id):action==='video.asset.save'?saveVideoAsset(f.state,p):assert.fail(action);
  try{const request=new Request('https://family.example/api/media/'+id+'/video-assets/low?revision=original&skip=not-smaller',{method:'POST'});const response=await saveVideoAssetRoute(request,{},db,{waitUntil:p=>tasks.push(p)},id,'low');assert.equal((await response.json()).saved,true);assert.equal(f.state.media(id).videoAssets.low.skipped,true);assert.equal(videoAssetsQueue(f.state).items[0].low,false);assert.equal(videoAssetsPublic(f.state.media(id)).playbackSources,undefined);}finally{f.close();}
});
