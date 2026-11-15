import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cutoutInput,cutoutOutput} from '../public/assets/photo-cutout-cpu-core.mjs';
import {cutoutModelResponse,CUTOUT_MODEL_SOURCE} from '../src/photo-cutout-model.mjs';

test('portable cutout input uses planar RGB normalization and does not consume alpha as a color',()=>{
  const input=cutoutInput(Uint8ClampedArray.from([255,128,0,19,0,64,255,0]),2,1);
  assert.equal(input.length,6);assert.ok(Math.abs(input[0]-(1-.485)/.229)<1e-6);assert.ok(Math.abs(input[2]-(128/255-.456)/.224)<1e-6);assert.ok(Math.abs(input[5]-(1-.406)/.225)<1e-6);
  const black=cutoutInput(new Uint8ClampedArray(16),2,2);assert.ok([...black].every(Number.isFinite));assert.throws(()=>cutoutInput(new Uint8Array(3),2,2));
});
test('CPU segmentation confidence becomes a foreground alpha mask, including uniform output',()=>{
  const middle=cutoutOutput(Float32Array.from([.2,.5,.8]),3,1).data;assert.equal(middle[0],0);assert.equal(middle[2],255);assert.ok(Math.abs(middle[1]-128)<=1);assert.deepEqual([...cutoutOutput(Float32Array.from([1,1]),2,1).data],[255,255]);assert.deepEqual([...cutoutOutput(Float32Array.from([0,0]),2,1).data],[0,0]);assert.throws(()=>cutoutOutput(Float32Array.from([NaN]),1,1));
});
test('the public cutout model route serves cached model bytes without forwarding a visitor request',async()=>{
  let fetched=false;const cached=new Response(new Uint8Array([3,4]),{headers:{'Content-Type':'application/octet-stream','Content-Length':'2'}}),cache={match:async key=>{assert.equal(new URL(key.url).pathname,'/api/photo-cutout/model-v1');assert.equal(key.headers.get('Cookie'),null);return cached.clone();}};
  const get=await cutoutModelResponse(new Request('https://family.example/api/photo-cutout/model-v1',{headers:{Cookie:'private'}}),{cache,fetcher:async()=>{fetched=true;}});assert.deepEqual([...new Uint8Array(await get.arrayBuffer())],[3,4]);assert.equal(fetched,false);
  const head=await cutoutModelResponse(new Request('https://family.example/api/photo-cutout/model-v1',{method:'HEAD'}),{cache});assert.equal(head.headers.get('Content-Length'),'2');assert.equal((await head.arrayBuffer()).byteLength,0);
});
test('the model downloader rejects substituted bytes and only fetches its fixed public source',async()=>{
  let fetched;await assert.rejects(cutoutModelResponse(new Request('https://family.example/api/photo-cutout/model-v1?url=https://evil.example'),{cache:null,fetcher:async(...args)=>{fetched=args;return new Response(new Uint8Array([1,2,3]));}}),error=>error.status===503);
  assert.equal(fetched[0],CUTOUT_MODEL_SOURCE);assert.equal(fetched[1].method,'GET');assert.deepEqual(fetched[1].headers,{Accept:'application/octet-stream'});
});
