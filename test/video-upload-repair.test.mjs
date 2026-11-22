import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {mp4AvcSampleTables} from '../public/assets/mp4-clip.mjs';
import {repairAvcRecording} from '../public/assets/video-upload-repair.mjs';
import {verifyUploadPlayback} from '../public/assets/video-upload-check.mjs';

const healthy = await readFile(new URL('./fixtures/living-family-5s.mp4',import.meta.url));
const file = bytes => new File([bytes], 'capture.mp4', {type:'video/mp4', lastModified:1000});

// The public test movie has a single video chunk. Append the same empty
// capture-device slice to its second picture; every original pixel is retained.
async function withEmptySlice(atStart = false) {
  const bytes = Buffer.from(healthy);
  const [track] = await mp4AvcSampleTables((start,end) => bytes.subarray(start,end+1), bytes.length);
  const index = 1;
  const sizeTable = bytes.indexOf('stsz'), mdatLength = bytes.indexOf('mdat') - 4;
  assert.equal(bytes.readUInt32BE(sizeTable+8),0);
  assert.equal(bytes.readUInt32BE(mdatLength),bytes.length-mdatLength);
  const padding = Buffer.from([0,0,0,2,0x21,0x60,0,0,0,2,0x21,0x20]);
  assert.equal(bytes.readUInt32BE(sizeTable+16+index*4),track.sizes[index]);
  bytes.writeUInt32BE(track.sizes[index]+padding.length,sizeTable+16+index*4);
  bytes.writeUInt32BE(bytes.length-mdatLength+padding.length,mdatLength);
  const offset = track.offsets[index] + (atStart ? 0 : track.sizes[index]);
  return {bytes:Buffer.concat([bytes.subarray(0,offset), padding, bytes.subarray(offset)]),offset};
}

test('repair preserves the movie, timestamps and real slices, including on a second pass',async()=>{
  const {bytes,offset} = await withEmptySlice();
  const input = file(bytes), result = await repairAvcRecording(input);
  assert.equal(result.repaired,2);
  assert.equal(result.file.name,input.name);
  assert.equal(result.file.lastModified,input.lastModified);
  const expected = Buffer.from(bytes);
  Buffer.from([0x0c,0x80]).copy(expected, offset+4);
  Buffer.from([0x0c,0x80]).copy(expected, offset+10);
  assert.deepEqual(Buffer.from(await result.file.arrayBuffer()),expected);
  assert.equal((await repairAvcRecording(result.file)).file,result.file);
  const untouched = file(healthy);
  assert.equal((await repairAvcRecording(untouched)).file,untouched);
});

test('a missing primary slice cannot be safely replaced with padding',async()=>{
  const {bytes} = await withEmptySlice(true);
  await assert.rejects(repairAvcRecording(file(bytes)),{code:'VIDEO_DAMAGED'});
});

function probe() {
  let revoked=0;
  const node={currentTime:0, duration:30, readyState:2, videoWidth:100, count:0,
    getVideoPlaybackQuality(){return {totalVideoFrames:this.count};},
    play(){return Promise.resolve();},pause(){},load(){},removeAttribute(){}};
  const result=verifyUploadPlayback(file(healthy),new AbortController().signal,()=>node,
    {createObjectURL:()=>'blob:test',revokeObjectURL:()=>revoked++});
  return {node,result,revoked:()=>revoked};
}

test('a duration alone cannot pass the check; real playback must advance at each sampling point',async()=>{
  const {node,result,revoked}=probe();
  node.onloadedmetadata();
  node.currentTime=1;node.ontimeupdate();
  assert.equal(revoked(),0);
  node.count=25;node.ontimeupdate();assert.equal(node.currentTime,15);
  node.currentTime=16;node.count=50;node.ontimeupdate();assert.equal(node.currentTime,28.6);
  node.currentTime=29.6;node.count=75;node.ontimeupdate();
  assert.equal(await result,true);assert.equal(revoked(),1);
});

test('an explicit native decoding error after metadata fails the playback check',async()=>{
  const {node,result,revoked}=probe();
  node.onloadedmetadata();node.error={code:3};node.onerror();
  await assert.rejects(result,{code:'VIDEO_DECODE'});assert.equal(revoked(),1);
});
