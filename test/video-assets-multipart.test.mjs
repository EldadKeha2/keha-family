import {test} from 'node:test';
import assert from 'node:assert/strict';
import {multipartVideoAsset,VIDEO_ASSET_PART_SIZE} from '../src/video-assets-multipart.mjs';
import {videoAssetsPublic} from '../src/video-assets-state.mjs';
import {HttpError,hmac,hex} from '../src/http.mjs';
const id='a'.repeat(32),head=Buffer.from('000000206674797069736f6d0000020069736f6d69736f32617663316d703431','hex');
function fixture(){
  const originalFetch=globalThis.fetch,uploads=new Map(),objects=new Map(),deleted=[],tasks=[],item={id,key:'videos/original.mp4',size:500*1024*1024,mime:'video/mp4',kind:'video'},env={HF_NAMESPACE:'test',HF_BUCKET:'family',HF_ACCESS_KEY_ID:'test-only',HF_SECRET_ACCESS_KEY:'test-secret'};
  let number=0,completeCount=0,failNextSave=false,loseNextAck=false;
  globalThis.fetch=async request=>{
    const url=new URL(request.url);assert.equal(url.hostname,'s3.hf.co');assert.match(request.headers.get('Authorization'),/^AWS4-HMAC-SHA256 /);
    if(request.method==='POST'&&url.searchParams.has('uploads')){const uploadId='upload+'+(++number)+'/==';uploads.set(uploadId,{key:url.pathname,parts:new Map()});return new Response('<InitiateMultipartUploadResult><UploadId>'+uploadId+'</UploadId></InitiateMultipartUploadResult>');}
    const uploadId=url.searchParams.get('uploadId');
    if(uploadId){const upload=uploads.get(uploadId);if(!upload)return new Response(null,{status:404});assert.equal(upload.key,url.pathname);
      if(request.method==='PUT'){const bytes=Buffer.from(await request.arrayBuffer()),part=Number(url.searchParams.get('partNumber'));assert.equal(Number(request.headers.get('Content-Length')),bytes.length);const etag='"part-'+part+'"';upload.parts.set(part,{number:part,bytes,size:bytes.length,etag});return new Response(null,{headers:{ETag:etag}});}
      if(request.method==='GET')return new Response('<ListPartsResult><IsTruncated>false</IsTruncated>'+[...upload.parts.values()].map(p=>'<Part><PartNumber>'+p.number+'</PartNumber><Size>'+p.size+'</Size><ETag>&quot;part-'+p.number+'&quot;</ETag></Part>').join('')+'</ListPartsResult>');
      if(request.method==='POST'){completeCount++;const text=await request.text(),parts=[...text.matchAll(/<PartNumber>(\d+)<\/PartNumber>/g)].map(m=>upload.parts.get(Number(m[1])));objects.set(url.pathname,{size:parts.reduce((sum,p)=>sum+p.size,0)});uploads.delete(uploadId);return new Response('<CompleteMultipartUploadResult><ETag>complete</ETag></CompleteMultipartUploadResult>');}
      if(request.method==='DELETE'){uploads.delete(uploadId);return new Response(null,{status:204});}
    }
    if(request.method==='HEAD'){const object=objects.get(url.pathname);return object?new Response(null,{headers:{'Content-Length':String(object.size)}}):new Response(null,{status:404});}
    if(request.method==='DELETE'){deleted.push(url.pathname);objects.delete(url.pathname);return new Response(null,{status:204});}
    throw Error('Unexpected storage operation');
  };
  const db=async(action,p)=>{
    if(action==='media.get')return structuredClone(item);
    if(action==='media.public')return {item:{id,src:'/media/'+id,...videoAssetsPublic(item)}};
    if(action==='video.asset.save'){
      if(failNextSave){failNextSave=false;throw new HttpError(503,'Transient state error');}
      if(p.revision!==(item.videoRevision||'original'))throw new HttpError(409,'Edited');
      if(item.videoAssets?.[p.variant]?.revision===p.revision)return {saved:false,item:{id,...videoAssetsPublic(item)}};
      item.videoAssets={...item.videoAssets,[p.variant]:p.asset};
      if(loseNextAck){loseNextAck=false;throw new HttpError(503,'Lost acknowledgement');}
      return {saved:true,item:{id,...videoAssetsPublic(item)}};
    }
    throw Error(action);
  };
  async function call(action,body,{variant='faststart',ticket=null,partNumber=null,headers={}}={}){
    const params=new URLSearchParams();if(ticket)params.set('ticket',ticket);if(partNumber!==null)params.set('partNumber',partNumber);
    const binary=body instanceof Uint8Array;
    const request=new Request('https://family.example/api/media/'+id+'/video-assets/'+variant+'/multipart/'+action+(params.size?'?'+params:''),{method:'POST',headers:{'Content-Type':binary?'application/octet-stream':'application/json',...(binary?{'Content-Length':String(body.length)}:{}),...headers},body:binary?body:JSON.stringify(body)});
    return multipartVideoAsset(request,env,db,{waitUntil:p=>tasks.push(p)},{id,variant,action});
  }
  const start=async(size=VIDEO_ASSET_PART_SIZE+32)=> (await call('start',{revision:'original',size,head:head.toString('base64'),height:720,duration:30})).json();
  async function allParts(start){const count=start.parts;for(let partNumber=1;partNumber<=count;partNumber++){const bytes=partNumber===1?Buffer.concat([head,Buffer.alloc(VIDEO_ASSET_PART_SIZE-head.length)]):Buffer.alloc(32);await call('part',bytes,{ticket:start.ticket,partNumber});}}
  return{env,item,call,start,allParts,uploads,objects,deleted,get completes(){return completeCount;},failSave(){failNextSave=true;},loseAck(){loseNextAck=true;},flush:()=>Promise.allSettled(tasks),async close(){await Promise.allSettled(tasks);globalThis.fetch=originalFetch;}};
}

test('large derivatives upload in exact bounded parts and retries preserve registered originals and assets',async()=>{
  const f=fixture();try{const started=await f.start();assert.equal(started.partSize,8*1024*1024);assert.equal(started.parts,2);await f.allParts(started);
    assert.equal((await(await f.call('complete',{ticket:started.ticket})).json()).saved,true);assert.equal(f.item.key,'videos/original.mp4');assert.match(f.item.videoAssets.faststart.key,/^video-assets\//);assert.equal(f.item.videoAssets.faststart.height,720);assert.equal(f.completes,1);
    assert.equal((await(await f.call('complete',{ticket:started.ticket})).json()).saved,false);assert.equal(f.completes,1);
    const abort=await(await f.call('abort',{ticket:started.ticket})).json();assert.equal(abort.saved,true);assert.equal(abort.cancelled,false);assert.equal(f.objects.size,1);assert.equal(f.deleted.length,0);
  }finally{await f.close();}
});
test('500 MiB derivatives are supported without one oversized request',async()=>{
  const f=fixture();try{const started=await f.start(500*1024*1024);assert.equal(started.parts,63);assert.equal(started.partSize,8*1024*1024);assert.equal(f.objects.size,0);}finally{await f.close();}
});
test('tickets cannot be tampered with or reused for another variant and expired tickets fail closed',async()=>{
  const f=fixture();try{const started=await f.start();await assert.rejects(()=>f.call('complete',{ticket:started.ticket+'0'}),error=>error.status===403);await assert.rejects(()=>f.call('complete',{ticket:started.ticket},{variant:'low'}),error=>error.status===403);
    const payload=JSON.parse(Buffer.from(started.ticket.split('.')[0],'base64').toString());payload.expires=1;const encoded=Buffer.from(JSON.stringify(payload)).toString('base64'),expired=encoded+'.'+hex(await hmac(f.env.HF_SECRET_ACCESS_KEY,'family-video-assets-v1\n'+encoded));await assert.rejects(()=>f.call('complete',{ticket:expired}),error=>error.status===410);assert.equal(f.objects.size,0);
  }finally{await f.close();}
});
test('wrong part sizes, corrupted headers and incomplete completion cannot publish bytes',async()=>{
  const f=fixture();try{const started=await f.start();await assert.rejects(()=>f.call('part',head,{ticket:started.ticket,partNumber:1}),error=>error.status===400);await assert.rejects(()=>f.call('part',Buffer.alloc(VIDEO_ASSET_PART_SIZE),{ticket:started.ticket,partNumber:1}),error=>error.status===415);await assert.rejects(()=>f.call('complete',{ticket:started.ticket}),error=>error.status===409);assert.equal(f.completes,0);assert.equal(f.item.videoAssets,undefined);}finally{await f.close();}
});
test('state failures after storage completion recover through the same ticket without recompleting storage',async()=>{
  const f=fixture();try{const started=await f.start();await f.allParts(started);f.failSave();await assert.rejects(()=>f.call('complete',{ticket:started.ticket}),error=>error.status===503);assert.equal(f.objects.size,1);assert.equal(f.completes,1);assert.equal(f.deleted.length,0);assert.equal((await(await f.call('complete',{ticket:started.ticket})).json()).saved,true);assert.equal(f.completes,1);}finally{await f.close();}
});
test('lost state acknowledgements remain registered and abort never deletes their completed object',async()=>{
  const f=fixture();try{const started=await f.start();await f.allParts(started);f.loseAck();await assert.rejects(()=>f.call('complete',{ticket:started.ticket}),error=>error.status===503);assert.ok(f.item.videoAssets.faststart);assert.equal((await(await f.call('abort',{ticket:started.ticket})).json()).saved,true);assert.equal(f.objects.size,1);assert.equal(f.deleted.length,0);}finally{await f.close();}
});
test('editing the source before completion rejects stale assets and cleans only their derived storage key',async()=>{
  const f=fixture();try{const started=await f.start();await f.allParts(started);f.item.videoRevision='b'.repeat(32);await assert.rejects(()=>f.call('complete',{ticket:started.ticket}),error=>error.status===409);await f.flush();assert.equal(f.item.key,'videos/original.mp4');assert.equal(f.item.videoAssets,undefined);assert.equal(f.uploads.size,0);assert.ok(f.deleted.every(key=>key.includes('/video-assets/')));}finally{await f.close();}
});
