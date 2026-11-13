import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {multipartVideo,VIDEO_PART_SIZE} from '../src/video-multipart.mjs';
import {signedRequest} from '../src/hf.mjs';
import {HttpError} from '../src/http.mjs';

const limit=500*1024*1024;
const head=Buffer.from('000000206674797069736f6d0000020069736f6d69736f32617663316d703431','hex');
function sniff(bytes){if(Buffer.from(bytes).subarray(4,8).toString()!=='ftyp')throw new HttpError(415,'Invalid video');return {ext:'.mp4',mime:'video/mp4'};}
function fixture(){
  const env={HF_NAMESPACE:'test-owner',HF_BUCKET:'keha-family',HF_ACCESS_KEY_ID:'HFAK_TEST_ONLY',HF_SECRET_ACCESS_KEY:'test-only-secret'},uploads=new Map(),objects=new Map(),catalog=new Map(),requests=[];
  const originalFetch=globalThis.fetch;let next=0,failDatabase=0,completeError=false,completions=0;
  globalThis.fetch=async request=>{
    const url=new URL(request.url);requests.push({method:request.method,url:request.url});
    if(url.hostname==='cdn.example'){
      assert.equal(request.headers.get('Authorization'),null);
      const bytes=objects.get(url.pathname);return new Response(request.method==='HEAD'?null:bytes,{headers:{'Content-Length':String(bytes.length)}});
    }
    assert.equal(url.hostname,'s3.hf.co');assert.match(request.headers.get('Authorization'),/^AWS4-HMAC-SHA256 Credential=HFAK_TEST_ONLY\//);
    if(request.method==='POST'&&url.searchParams.has('uploads')){
      const uploadId='upload+'+(++next)+'/==';uploads.set(uploadId,{key:url.pathname,parts:new Map()});
      return new Response('<InitiateMultipartUploadResult><UploadId>'+uploadId+'</UploadId></InitiateMultipartUploadResult>');
    }
    const uploadId=url.searchParams.get('uploadId'),upload=uploads.get(uploadId);
    if(uploadId){
      if(!upload)return new Response('<Error><Code>NoSuchUpload</Code></Error>',{status:404});
      assert.equal(upload.key,url.pathname);
      if(request.method==='PUT'){
        const number=Number(url.searchParams.get('partNumber')),bytes=Buffer.from(await request.arrayBuffer()),etag='"'+createHash('md5').update(bytes).digest('hex')+'"';
        assert.equal(Number(request.headers.get('Content-Length')),bytes.length);upload.parts.set(number,{number,bytes,etag});return new Response(null,{headers:{ETag:etag}});
      }
      if(request.method==='GET')return new Response('<ListPartsResult><IsTruncated>false</IsTruncated>'+[...upload.parts.values()].map(p=>'<Part><PartNumber>'+p.number+'</PartNumber><Size>'+p.bytes.length+'</Size><ETag>&quot;'+p.etag.slice(1,-1)+'&quot;</ETag></Part>').join('')+'</ListPartsResult>');
      if(request.method==='POST'){
        completions++;if(completeError)return new Response('<Error><Code>InternalError</Code></Error>');
        const xml=await request.text(),numbers=[...xml.matchAll(/<PartNumber>(\d+)<\/PartNumber>/g)].map(m=>Number(m[1]));
        objects.set(url.pathname,Buffer.concat(numbers.map(number=>upload.parts.get(number).bytes)));uploads.delete(uploadId);
        return new Response('<CompleteMultipartUploadResult><ETag>complete</ETag></CompleteMultipartUploadResult>');
      }
      if(request.method==='DELETE'){uploads.delete(uploadId);return new Response(null,{status:204});}
    }
    if(!objects.has(url.pathname))return new Response(null,{status:404});
    return new Response(null,{status:302,headers:{Location:'https://cdn.example'+url.pathname}});
  };
  async function db(action,p){
    if(action==='media.get'){if(!catalog.has(p.id))throw new HttpError(404,'Missing');return catalog.get(p.id);}
    if(action==='media.add'){if(failDatabase){failDatabase--;throw new HttpError(503,'Temporarily unavailable');}assert.ok(!catalog.has(p.item.id));catalog.set(p.item.id,p.item);return {saved:true};}
    if(action==='collection')return {items:[...catalog.values()],count:catalog.size};
    throw Error(action);
  }
  async function call(action,body,headers={}){
    const binary=body instanceof Uint8Array;
    const request=new Request('https://family.example/api/nostalgia/multipart/'+action,{method:'POST',headers:{'Content-Type':binary?'application/octet-stream':'application/json',...(binary?{'Content-Length':String(body.length)}:{}),...headers},body:binary?body:JSON.stringify(body)});
    return multipartVideo(request,env,db,{waitUntil(){}},{action,sniff,limit});
  }
  async function start(size=VIDEO_PART_SIZE+7){return (await call('start',{filename:'יום הולדת רחלי - קטע 1.mp4',size,head:head.toString('base64')})).json();}
  async function part(session,number,bytes,headers={}){return call('part',bytes,{'X-Upload-Session':session,'X-Upload-Part':String(number),...headers});}
  return {env,call,start,part,uploads,objects,catalog,requests,failNextDatabase(){failDatabase++;},failCompletion(){completeError=true;},get completions(){return completions;},close(){globalThis.fetch=originalFetch;}};
}
function movie(size){const bytes=Buffer.alloc(size);for(let i=0;i<size;i++)bytes[i]=i%251;head.copy(bytes);return bytes;}
async function uploadAll(f,bytes){const upload=await f.start(bytes.length);for(let offset=0,n=1;offset<bytes.length;offset+=upload.partSize,n++)await f.part(upload.session,n,bytes.subarray(offset,offset+upload.partSize));return upload;}

test('multipart joins out-of-order pieces into the exact original video, publishes once, and keeps an unknown recording date empty',async()=>{
  const f=fixture();try{
    const bytes=movie(2*VIDEO_PART_SIZE+731),upload=await f.start(bytes.length);assert.equal(upload.parts,3);assert.ok(!upload.session.includes(f.env.HF_SECRET_ACCESS_KEY));
    await f.part(upload.session,2,bytes.subarray(VIDEO_PART_SIZE,2*VIDEO_PART_SIZE));await f.part(upload.session,1,bytes.subarray(0,VIDEO_PART_SIZE));
    await assert.rejects(f.call('complete',{session:upload.session}),e=>e.status===409&&e.code==='VIDEO_INCOMPLETE');assert.equal(f.catalog.size,0);
    await f.part(upload.session,3,bytes.subarray(2*VIDEO_PART_SIZE));const response=await f.call('complete',{session:upload.session});assert.equal(response.status,201);
    const saved=await response.json();assert.equal(saved.collection.count,1);assert.equal(f.completions,1);
    const stored=[...f.objects.values()][0];assert.equal(createHash('sha256').update(stored).digest('hex'),createHash('sha256').update(bytes).digest('hex'));
    const item=[...f.catalog.values()][0];assert.equal(item.mime,'video/mp4');assert.equal(item.size,bytes.length);assert.equal(item.takenDate,undefined);assert.equal(item.name,'יום הולדת רחלי - קטע 1');
    assert.equal((await f.call('complete',{session:upload.session})).status,200);assert.equal(f.catalog.size,1);assert.equal(f.completions,1);
  }finally{f.close();}
});
test('multipart rejects forged and expired sessions, invalid video bytes, missing bytes and parts outside the declared file',async()=>{
  const f=fixture(),oldNow=Date.now;try{
    const upload=await f.start();const [payload,mac]=upload.session.split('.'),claim=JSON.parse(Buffer.from(payload,'base64'));claim.size=1;
    const forged=Buffer.from(JSON.stringify(claim)).toString('base64')+'.'+mac;
    await assert.rejects(f.part(forged,1,head),e=>e.status===403);
    await assert.rejects(f.part(upload.session,3,head),e=>e.status===400);
    await assert.rejects(f.part(upload.session,1,Buffer.alloc(VIDEO_PART_SIZE)),e=>e.status===415);
    await assert.rejects(f.part(upload.session,1,head,{'Content-Length':String(VIDEO_PART_SIZE)}),e=>e.status===400);
    Date.now=()=>claim.expires+1;await assert.rejects(f.call('complete',{session:upload.session}),e=>e.status===410);Date.now=oldNow;
    const before=f.requests.length;
    await assert.rejects(f.call('start',{filename:'bad.mp4',size:limit+1,head:head.toString('base64')}),e=>e.status===413);
    await assert.rejects(f.call('start',{filename:'bad.mp4',size:100,head:Buffer.alloc(32).toString('base64')}),e=>e.status===415);
    assert.equal(f.requests.length,before);assert.equal(f.catalog.size,0);assert.equal(f.objects.size,0);
  }finally{Date.now=oldNow;f.close();}
});
test('a 200 storage Error response cannot publish a broken video',async()=>{
  const f=fixture();try{
    const upload=await uploadAll(f,movie(256));f.failCompletion();await assert.rejects(f.call('complete',{session:upload.session}),e=>e.status===502);assert.equal(f.catalog.size,0);assert.equal(f.objects.size,0);
  }finally{f.close();}
});
test('retrying completion after a database interruption retains completed bytes and recovers without uploading or completing twice',async()=>{
  const f=fixture();try{
    const upload=await uploadAll(f,movie(1024));f.failNextDatabase();await assert.rejects(f.call('complete',{session:upload.session}),e=>e.status===503);
    assert.equal(f.objects.size,1);assert.equal(f.catalog.size,0);assert.equal(f.completions,1);
    assert.equal((await f.call('complete',{session:upload.session})).status,201);assert.equal(f.catalog.size,1);assert.equal(f.completions,1);
    const cancel=await(await f.call('abort',{session:upload.session})).json();assert.equal(cancel.saved,true);assert.equal(f.objects.size,1);
  }finally{f.close();}
});
test('aborting an unfinished upload removes staged parts without publishing a film',async()=>{
  const f=fixture();try{
    const upload=await uploadAll(f,movie(128));assert.equal(f.uploads.size,1);const result=await(await f.call('abort',{session:upload.session})).json();assert.equal(result.cancelled,true);assert.equal(f.uploads.size,0);assert.equal(f.objects.size,0);assert.equal(f.catalog.size,0);
  }finally{f.close();}
});
test('S3 signing encodes multipart query values and binds the signature to the part number',async()=>{
  const f=fixture();try{
    const options={method:'PUT',query:{uploadId:'x+y/==',partNumber:2},now:new Date('2026-11-13T12:00:00Z')};
    const a=await signedRequest(f.env,'nostalgia/shared/video.mp4',options),b=await signedRequest(f.env,'nostalgia/shared/video.mp4',{...options,query:{uploadId:'x+y/==',partNumber:3}});
    assert.equal(new URL(a.url).search,'?partNumber=2&uploadId=x%2By%2F%3D%3D');assert.notEqual(a.headers.get('Authorization'),b.headers.get('Authorization'));
  }finally{f.close();}
});
