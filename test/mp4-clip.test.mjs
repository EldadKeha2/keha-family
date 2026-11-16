import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {planMp4Clip} from '../src/mp4-clip.mjs';
const original=new Uint8Array(await readFile(new URL('./fixtures/video-clip-source.mp4',import.meta.url)));
const reader=bytes=>async(a,b)=>bytes.subarray(a,b+1);
const materialize=(bytes,plan)=>{const out=new Uint8Array(plan.size);out.set(plan.prefix);let offset=plan.prefix.length;for(const range of plan.ranges){out.set(bytes.subarray(range.start,range.end+1),offset);offset+=range.end-range.start+1;}return out;};
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
test('deleting a middle segment joins the two retained parts, preserves compressed samples and supports repeated edits',async()=>{
 const plan=await planMp4Clip(reader(original),original.length,{start:2.125,end:5.875,remove:true});
 assert.equal(plan.duration,4.25);assert.equal(plan.ranges.length,2);assert.ok(plan.size<original.length);
 const output=materialize(original,plan);let offset=plan.prefix.length;
 for(const range of plan.ranges){assert.deepEqual(output.subarray(offset,offset+range.end-range.start+1),original.subarray(range.start,range.end+1));offset+=range.end-range.start+1;}
 const second=await planMp4Clip(reader(output),output.length,{start:1,end:3,remove:true});assert.equal(second.sourceDuration,4.25);assert.equal(second.duration,2.25);
 const again=materialize(output,second),trim=await planMp4Clip(reader(again),again.length,{start:.25,end:1.75});assert.equal(trim.duration,1.5);
});
test('deleting the start or end keeps the opposite side and deleting the whole movie is rejected',async()=>{
 assert.equal((await planMp4Clip(reader(original),original.length,{start:0,end:2,remove:true})).duration,6);
 assert.equal((await planMp4Clip(reader(original),original.length,{start:6,end:8,remove:true})).duration,6);
 await assert.rejects(planMp4Clip(reader(original),original.length,{start:0,end:8,remove:true}),error=>error.status===400);
});
