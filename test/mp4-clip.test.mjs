import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {planMp4Clip} from '../src/mp4-clip.mjs';
const original=new Uint8Array(await readFile(new URL('./fixtures/video-clip-source.mp4',import.meta.url)));
const reader=bytes=>async(a,b)=>bytes.subarray(a,b+1);
const materialize=(bytes,plan)=>{const out=new Uint8Array(plan.size);out.set(plan.prefix);out.set(bytes.subarray(plan.rangeStart,plan.rangeEnd+1),plan.prefix.length);return out;};
test('a precise clip retains the original compressed media bytes and contains an independent playable movie',async()=>{
 const plan=await planMp4Clip(reader(original),original.length,{start:2.125,end:5.875});
 assert.equal(plan.duration,3.75);assert.equal(plan.sourceDuration,8);
 assert.ok(plan.size<original.length);assert.ok(plan.rangeStart>0);
 const clip=materialize(original,plan);
 assert.deepEqual(clip.subarray(plan.prefix.length),original.subarray(plan.rangeStart,plan.rangeEnd+1));
 const whole=await planMp4Clip(reader(clip),clip.length,{start:0,end:3.75});assert.equal(whole.sourceDuration,3.75);
 const nested=await planMp4Clip(reader(clip),clip.length,{start:.75,end:2.25});assert.equal(nested.duration,1.5);
 const second=materialize(clip,nested),secondPlan=await planMp4Clip(reader(second),second.length,{start:0,end:1.5});assert.equal(secondPlan.sourceDuration,1.5);
});
test('start, end, source duration and metadata boundaries are validated before a clip is written',async()=>{
 for(const range of [{start:-1,end:2},{start:2,end:2},{start:NaN,end:2},{start:0,end:9}])await assert.rejects(planMp4Clip(reader(original),original.length,range),error=>error.status===400);
 const truncated=original.subarray(0,20);await assert.rejects(planMp4Clip(reader(truncated),truncated.length,{start:0,end:1}),error=>error.status===415);
});
