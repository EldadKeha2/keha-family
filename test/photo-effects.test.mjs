import {test} from 'node:test';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {LOOKS,ART,LIGHT,FRAMES,defaults,normalizeEffects,effectPixels,renderEffects} from '../public/assets/photo-effects-core.mjs';

const width=12,height=9,pixels=Uint8ClampedArray.from({length:width*height*4},(_,i)=>i%4===3?(i*37)%256:(i*53+19)%256);
test('the untouched image and zero-strength effects retain every source pixel and alpha',()=>{
  const before=pixels.slice();
  assert.deepEqual(effectPixels(pixels,width,height),pixels);
  assert.deepEqual(effectPixels(pixels,width,height,{look:'vintage',art:'comic',intensity:0,sharpness:90,grain:70}),pixels);
  assert.deepEqual(pixels,before,'Preview must never mutate the source buffer');
});
test('all photo and art treatments produce deterministic pixels without changing dimensions or transparency',()=>{
  for(const [group,list]of [['look',LOOKS],['art',ART]])for(const [id]of list){
    const settings={...defaults(),[group]:id,exposure:9,grain:15},first=effectPixels(pixels,width,height,settings);
    assert.equal(first.length,pixels.length);assert.deepEqual(first,effectPixels(pixels,width,height,settings));
    for(let i=3;i<first.length;i+=4)assert.equal(first[i],pixels[i]);
  }
});
test('brightness, monochrome and effect mixing change actual exported color values',()=>{
  const source=Uint8ClampedArray.from([80,120,160,255]);
  const bright=effectPixels(source,1,1,{exposure:60});assert.ok(bright[0]>source[0]&&bright[1]>source[1]&&bright[2]>source[2]);
  const noir=effectPixels(source,1,1,{look:'noir'});assert.equal(noir[0],noir[1]);assert.equal(noir[1],noir[2]);
  const all=effectPixels(source,1,1,{look:'sepia'}),half=effectPixels(source,1,1,{look:'sepia',intensity:50});
  for(let i=0;i<3;i++)assert.ok(Math.abs(half[i]-(all[i]+source[i])/2)<=1);
  assert.throws(()=>effectPixels(source,2,2));
});
test('untrusted effect settings are bounded before allocation and processing',()=>{
  const settings=normalizeEffects({look:'unknown',exposure:Infinity,contrast:-9999,sharpness:9999,intensity:250});
  assert.equal(settings.look,'original');assert.equal(settings.exposure,0);assert.equal(settings.contrast,-100);assert.equal(settings.sharpness,100);assert.equal(settings.intensity,100);
});
test('preview and export share the renderer, constrain resolution and preserve image geometry for face tags',()=>{
  const calls=[],ctx={save(){},restore(){},drawImage(){},getImageData(x,y,w,h){return {data:new Uint8ClampedArray(w*h*4)};},putImageData(){},fillRect(){calls.push('paint');},strokeRect(){calls.push('frame');},beginPath(){},moveTo(){},lineTo(){},closePath(){},stroke(){},fill(){},arc(){},setLineDash(){},createRadialGradient(){return {addColorStop(){}};},createLinearGradient(){return {addColorStop(){}};}};
  const canvas={getContext:()=>ctx},source={width:600,height:400};
  for(const [group,list]of [['light',LIGHT],['frame',FRAMES]])for(const [id]of list){
    renderEffects(canvas,source,{[group]:id},120);assert.equal(canvas.width,120);assert.equal(canvas.height,80);
  }
  renderEffects(canvas,source,{frame:'ornament'},1200);assert.equal(canvas.width,600);assert.equal(canvas.height,400);assert.ok(calls.includes('frame')&&calls.includes('paint'));
  calls.length=0;renderEffects(canvas,source,{frame:'ornament',light:'sun',intensity:0},120);assert.equal(calls.length,0,'Zero strength also removes light overlays and frames');
});
test('a phone-sized complex preview stays bounded in memory and completes',()=>{
  const w=480,h=320,buffer=new Uint8ClampedArray(w*h*4).fill(140),start=performance.now(),result=effectPixels(buffer,w,h,{look:'golden',art:'watercolor',sharpness:20});
  assert.equal(result.length,buffer.length);assert.ok(performance.now()-start<10000,'Preview should remain usable on ordinary devices');
});
