import {test} from 'node:test';
import assert from 'node:assert/strict';
import {draggedFileCount,readDroppedPhotos,PHOTO_DROP_LIMIT} from '../public/assets/photo-drop-core.mjs';

test('desktop drag counts protected file items without opening their contents or counting text',()=>{
  const item={kind:'file',getAsFile(){throw Error('Protected until drop');}};
  assert.equal(draggedFileCount({items:[item,{kind:'string'},item],files:[]}),2);
  assert.equal(draggedFileCount({files:[{},{}]}),2);assert.equal(draggedFileCount({types:['Files']}),0);
});
test('preparation reads bytes in order, reports real byte progress and keeps the original Files',async()=>{
  const one=new File([new Uint8Array(9)],'one.png',{type:'image/png'}),two=new File([new Uint8Array(3)],'two.jpg',{type:'image/jpeg'}),progress=[];
  const result=await readDroppedPhotos([one,two],{onProgress:value=>progress.push(value)});
  assert.equal(result[0],one);assert.equal(result[1],two);assert.equal(progress[0].percent,0);assert.equal(progress.at(-1).percent,100);
  assert.ok(progress.some(value=>value.loaded===9&&value.percent===75));assert.equal(progress.at(-1).loaded,12);
  assert.ok(progress.every(value=>value.total===12&&value.count===2));
  for(let i=1;i<progress.length;i++)assert.ok(progress[i].loaded>=progress[i-1].loaded);
  assert.equal(progress.filter(value=>value.percent===100).length,1);
});
test('cancel stops a pending read, releases the stream and never reports success',async()=>{
  const controller=new AbortController(),progress=[];let stop;
  const file={name:'large.png',size:9,stream:()=>new ReadableStream({start(stream){stream.enqueue(new Uint8Array(3));},cancel(){stop=true;}})};
  const pending=readDroppedPhotos([file],{signal:controller.signal,onProgress:value=>{progress.push(value);if(value.loaded===3)controller.abort();}});
  await assert.rejects(pending,{name:'AbortError'});assert.equal(stop,true);assert.ok(progress.every(value=>value.percent<100));
});
test('unreadable, empty and oversized images stop preparation before the editor, without retaining buffers',async()=>{
  for(const file of [
    {name:'empty.png',size:0},
    {name:'too-large.png',size:PHOTO_DROP_LIMIT+1},
    {name:'short.png',size:10,stream:()=>new ReadableStream({start(stream){stream.enqueue(new Uint8Array(3));stream.close();}})},
    {name:'lost.png',size:10,stream:()=>new ReadableStream({start(stream){stream.error(Error('Disk unavailable'));}})}
  ])await assert.rejects(readDroppedPhotos([file]),error=>error.filename===file.name&&['PHOTO_TOO_LARGE','PHOTO_UNREADABLE'].includes(error.code));
});
