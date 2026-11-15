import {test} from 'node:test';
import assert from 'node:assert/strict';
import {familyAiRoute,familyAiTick,familyAiConfig,familyAiJob,familyAiRatio,FAMILY_AI_PROMPT} from '../src/family-ai-route.mjs';
import {fail,uid} from '../src/http.mjs';

function fixture(){
  const id=uid(),item={id,key:'gallery/'+id+'.jpg',size:4,mime:'image/jpeg',kind:'photo',photoRevision:'original'},env={RUNWAYML_API_SECRET:'runway-secret-test-only',FAMILY_AI_ACCESS_CODE:'family-code-test',HF_NAMESPACE:'family',HF_BUCKET:'archive',HF_ACCESS_KEY_ID:'HFAK_TEST',HF_SECRET_ACCESS_KEY:'hf-secret-test'};
  const jobs=new Map(),objects=new Map(),requests=[],tasks=[],ctx={waitUntil(task){tasks.push(task);}};
  let providerStatus='RUNNING',failStorage=false,networkError=false,providerError=0,taskCalls=0;
  const handle=async(action,p={})=>{
    if(action==='media.get'){assert.equal(p.id,id);return item;}
    if(action==='family-ai.job.get')return {job:jobs.get(p.id)||null};
    if(action==='family-ai.job.claim'){
      const existing=jobs.get(p.id);if(existing&&!(existing.status==='FAILED'&&p.retry))return {claimed:false,job:existing,item};
      const job={id:p.id,claimId:p.claimId,revision:p.revision,status:'SUBMITTING',taskId:null,progress:0,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),lastPollAt:0};jobs.set(p.id,job);return {claimed:true,job,item};
    }
    if(action==='family-ai.job.update'){
      const job=jobs.get(p.id);if(job?.claimId!==p.claimId||p.pollToken&&p.pollToken!==job.pollToken)return {updated:false,job};
      if(job.status==='SUCCEEDED'&&p.patch.status&&p.patch.status!=='SUCCEEDED')return {updated:false,job};
      Object.assign(job,p.patch,{updatedAt:new Date().toISOString()});if(p.releasePoll){job.pollToken=null;job.pollLeaseUntil=0;}return {updated:true,job};
    }
    if(action==='family-ai.job.poll'){
      const job=jobs.get(p.id),poll=job.claimId===p.claimId&&Date.now()-job.lastPollAt>=30000&&!(job.pollLeaseUntil>Date.now());
      if(poll){job.lastPollAt=Date.now();job.pollToken=uid();job.pollLeaseUntil=Date.now()+120000;}return {poll,job};
    }
    if(action==='family-ai.job.pending')return {jobs:[...jobs.values()].filter(job=>!['SUCCEEDED','FAILED'].includes(job.status))};
    throw new Error('Unexpected db action '+action);
  };
  const db=async(action,p)=>structuredClone(await handle(action,p));
  const fetcher=async(input,options)=>{
    const request=input instanceof Request?input:new Request(input,options),url=new URL(request.url);requests.push(request);
    if(url.hostname==='api.dev.runwayml.com'){
      assert.equal(request.headers.get('Authorization'),'Bearer '+env.RUNWAYML_API_SECRET);assert.equal(request.headers.get('X-Runway-Version'),'2024-11-06');
      if(request.method==='POST'){
        taskCalls++;if(networkError)throw new Error('Ambiguous network failure with sensitive details');
        if(providerError)return Response.json({error:'Private provider detail with API key'}, {status:providerError});
        return Response.json({id:'task-created'});
      }
      return Response.json({status:providerStatus,progress:.4,...(providerStatus==='SUCCEEDED'?{output:['https://generated.cloudfront.net/animation.mp4']}:{})});
    }
    if(url.hostname==='generated.cloudfront.net'){
      assert.equal(request.headers.get('Authorization'),null);return new Response(new Uint8Array([0,0,0,12,102,116,121,112,109,112,52,50]),{headers:{'Content-Type':'video/mp4','Content-Length':'12'}});
    }
    if(url.hostname==='s3.hf.co'){
      assert.match(request.headers.get('Authorization'),/^AWS4-HMAC-SHA256 Credential=HFAK_TEST\//);
      if(request.method==='PUT'){if(failStorage)return new Response(null,{status:503});objects.set(url.pathname,new Uint8Array(await request.arrayBuffer()));return new Response(null);}
      if(request.method==='DELETE'){objects.delete(url.pathname);return new Response(null,{status:204});}
      const bytes=objects.get(url.pathname)||new Uint8Array([255,216,255,0]);return new Response(request.method==='HEAD'?null:bytes,{headers:{'Content-Length':String(bytes.length),'Content-Type':url.pathname.endsWith('.mp4')?'video/mp4':'image/jpeg'}});
    }
    throw new Error('Unexpected external host '+url.hostname);
  };
  async function call(path,{method='GET',body}={}){try{return await familyAiRoute(new Request('https://family.example'+path,{method,...(body?{body:JSON.stringify(body),headers:{'Content-Type':'application/json'}}:{})}),env,db,ctx,fetcher);}catch(error){return fail(error);}}
  const generate=(extra={})=>call('/api/family-ai/generate',{method:'POST',body:{id,width:1600,height:1200,accessCode:env.FAMILY_AI_ACCESS_CODE,...extra}});
  return {id,item,env,jobs,objects,requests,generate,call,db,ctx,fetcher,get taskCalls(){return taskCalls;},set providerStatus(value){providerStatus=value;},set providerError(value){providerError=value;},set networkError(value){networkError=value;},set failStorage(value){failStorage=value;},unlock(){jobs.get(id).lastPollAt=0;jobs.get(id).pollLeaseUntil=0;},flush:()=>Promise.allSettled(tasks)};
}

test('video generation configuration never exposes credentials and requires provider, access code and durable storage',()=>{
  const f=fixture();assert.equal(familyAiConfig(f.env).enabled,true);assert.equal(familyAiConfig(f.env).duration,10);
  assert.ok(!JSON.stringify(familyAiConfig(f.env)).includes('secret'));delete f.env.RUNWAYML_API_SECRET;assert.equal(familyAiConfig(f.env).reason,'provider-not-configured');
  f.env.RUNWAYML_API_SECRET='test';f.env.FAMILY_AI_ACCESS_CODE='short';assert.equal(familyAiConfig(f.env).reason,'access-code-not-configured');
  f.env.FAMILY_AI_ACCESS_CODE='correct-length';delete f.env.HF_SECRET_ACCESS_KEY;assert.equal(familyAiConfig(f.env).reason,'storage-not-configured');
});
test('paid creation requires the separate family access code and never calls the provider on invalid input',async()=>{
  const f=fixture();let response=await f.generate({accessCode:'wrong'});assert.equal(response.status,403);assert.equal((await response.json()).code,'FAMILY_AI_ACCESS_CODE');
  response=await f.generate({id:'bad'});assert.equal(response.status,400);response=await f.generate({imageData:'data:image/jpeg;base64,bm90anBlZw=='});assert.equal(response.status,400);assert.equal(f.taskCalls,0);
});
test('generation submits real ten-second animation with a signed source and reuses an existing job',async()=>{
  const f=fixture();let response=await f.generate();assert.equal(response.status,202);const result=await response.json();assert.equal(result.job.status,'PENDING');assert.equal(result.job.videoSrc,null);
  assert.equal(result.job.claimId,undefined);assert.equal(result.job.taskId,undefined);assert.equal(f.taskCalls,1);
  const request=f.requests.find(request=>request.method==='POST'),body=await request.json();assert.equal(body.duration,10);assert.equal(body.model,'gen4_turbo');assert.equal(body.ratio,'1104:832');assert.equal(body.promptText,FAMILY_AI_PROMPT);
  const source=new URL(body.promptImage);assert.equal(source.hostname,'family.example');assert.equal(source.pathname,'/api/family-ai/source/'+f.id);assert.ok(source.searchParams.get('signature'));
  response=await f.call(source.pathname+source.search,{method:'HEAD'});assert.equal(response.status,200);assert.equal(response.headers.get('Content-Length'),'4');assert.equal(response.headers.get('Content-Type'),'image/jpeg');
  source.searchParams.set('revision','changed');assert.equal((await f.call(source.pathname+source.search)).status,403);
  response=await f.generate();assert.equal(response.status,200);assert.equal((await response.json()).reused,true);assert.equal(f.taskCalls,1);
});
test('unsupported originals can use a prepared JPEG while unprepared oversized originals fail before billing',async()=>{
  const f=fixture();f.item.mime='image/avif';f.item.size=20*1024*1024;
  assert.equal((await f.generate()).status,400);assert.equal(f.taskCalls,0);
  const imageData='data:image/jpeg;base64,'+btoa('\xff\xd8\xff\x00');assert.equal((await f.generate({imageData})).status,202);
  const body=await f.requests.find(request=>request.method==='POST').json();assert.equal(body.promptImage,imageData);
  assert.equal(familyAiRatio(400,1000),'720:1280');assert.equal(familyAiRatio(1000,1000),'960:960');
});
test('provider polling is leased, completed output is saved durably and served through the same origin',async()=>{
  const f=fixture();await f.generate();let response=await f.call('/api/family-ai/jobs/'+f.id);assert.equal((await response.json()).job.status,'RUNNING');
  const polls=f.requests.length;await f.call('/api/family-ai/jobs/'+f.id);assert.equal(f.requests.length,polls);
  f.unlock();f.providerStatus='SUCCEEDED';response=await f.call('/api/family-ai/jobs/'+f.id);const result=await response.json();assert.equal(result.job.status,'SUCCEEDED');assert.equal(result.job.videoSrc,'/api/family-ai/video/'+f.id);assert.equal(f.objects.size,1);
  const stored=f.jobs.get(f.id);assert.equal(stored.video.duration,10);assert.equal(stored.video.size,12);assert.ok(!JSON.stringify(result).includes('cloudfront'));
  response=await f.call(result.job.videoSrc);assert.equal(response.status,200);assert.equal((await response.arrayBuffer()).byteLength,12);assert.equal(response.headers.get('Content-Type'),'video/mp4');
  response=await f.call(result.job.videoSrc+'?download=1');assert.match(response.headers.get('Content-Disposition'),/^attachment;/);
  await f.generate();assert.equal(f.taskCalls,1);
});
test('failed permanent storage retries the same generated task, including from scheduled maintenance',async()=>{
  const f=fixture();await f.generate();f.providerStatus='SUCCEEDED';f.failStorage=true;
  let response=await f.call('/api/family-ai/jobs/'+f.id);let result=await response.json();assert.equal(result.job.status,'SAVING');assert.equal(result.job.errorCode,'OUTPUT_SAVE_FAILED');assert.equal(f.taskCalls,1);await f.flush();
  f.failStorage=false;f.unlock();await familyAiTick(f.env,f.db,f.ctx,f.fetcher);assert.equal(f.jobs.get(f.id).status,'SUCCEEDED');assert.equal(f.taskCalls,1);assert.equal(f.objects.size,1);
});
test('ambiguous submission failures cannot silently create duplicate charges and provider errors stay private',async()=>{
  const f=fixture();f.networkError=true;let response=await f.generate();let result=await response.json();assert.equal(result.job.status,'SUBMITTING');assert.equal(result.job.errorCode,'SUBMISSION_UNCERTAIN');
  f.networkError=false;await f.generate({retry:true});assert.equal(f.taskCalls,1);
  const g=fixture();g.providerError=402;response=await g.generate();result=await response.json();assert.equal(result.job.status,'FAILED');assert.equal(result.job.errorCode,'PROVIDER_CREDITS');assert.ok(!JSON.stringify(result).includes('Private provider'));
  g.providerError=0;await g.generate({retry:true});assert.equal(g.taskCalls,2);
});
test('public job serializers disclose only clip status and same-origin media links',()=>{
  assert.equal(familyAiJob(null),null);const safe=familyAiJob({id:'photo',claimId:'private',taskId:'provider-private',video:{key:'private-storage-key'},status:'SUCCEEDED',progress:10,revision:'original'});
  assert.equal(safe.progress,1);assert.equal(safe.videoSrc,'/api/family-ai/video/photo');assert.equal(safe.claimId,undefined);assert.equal(safe.taskId,undefined);assert.equal(safe.video,undefined);
});
