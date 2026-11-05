import {test} from 'node:test';
import assert from 'node:assert/strict';
import {clampRect,mergeFaces,chooseFace,manualRect,popoverPosition} from '../public/assets/face-geometry.mjs';
import {faceRect} from '../src/faces.mjs';

test('normalized face positions survive portrait, landscape and phone display sizes',()=>{
 const rect={x:.2,y:.1,width:.17,height:.24};
 for(const size of [{width:320,height:220},{width:1440,height:960},{width:220,height:640}]){
  const displayed={x:rect.x*size.width,y:rect.y*size.height,width:rect.width*size.width,height:rect.height*size.height};
  assert.deepEqual(faceRect({x:displayed.x/size.width,y:displayed.y/size.height,width:displayed.width/size.width,height:displayed.height/size.height}),rect);
 }
 assert.deepEqual(clampRect({x:-.02,y:.94,width:.3,height:.4}),{x:0,y:.94,width:.3,height:1-.94});
});
test('saved names stay attached to their own rectangles and detections never assign a name by array order',()=>{
 const saved=[{id:'known',rect:{x:.1,y:.2,width:.2,height:.2},personId:'one'}],detected=[{id:'other',rect:{x:.6,y:.2,width:.2,height:.2}},{id:'duplicate',rect:{x:.11,y:.2,width:.19,height:.2}}];
 const merged=mergeFaces(saved,detected);assert.deepEqual(merged.map(face=>face.id),['known','other']);assert.equal(merged[0].personId,'one');assert.equal(merged[1].personId,undefined);
});
test('touching small nearby faces picks the closest centre instead of a neighbouring overlapping hit target',()=>{
 const faces=[{id:'left',rect:{x:.1,y:.1,width:.03,height:.03}},{id:'right',rect:{x:.15,y:.1,width:.03,height:.03}}],size={width:320,height:320};
 assert.equal(chooseFace(faces,{x:.165,y:.115},size).id,'right');assert.equal(chooseFace(faces,{x:.115,y:.115},size).id,'left');assert.equal(chooseFace(faces,{x:.8,y:.8},size),null);
});
test('the name picker prefers the right of a face and stays within narrow or keyboard-reduced viewports',()=>{
 const desktop=popoverPosition({x:200,y:100,width:90,height:100},{width:280,height:340},{width:1280,height:800});assert.equal(desktop.x,298);
 for(const viewport of [{width:320,height:568},{width:375,height:280,top:120},{width:812,height:375}])for(const face of [{x:0,y:0,width:70,height:70},{x:260,y:500,width:75,height:70}]){
  const p=popoverPosition(face,{width:280,height:340},viewport);assert.ok(p.x>=8);assert.ok(p.x+p.width<=viewport.width-8);assert.ok(p.y>=(viewport.top||0)+8);assert.ok(p.y+Math.min(340,p.maxHeight)<=(viewport.top||0)+viewport.height-8);
 }
});
test('a manually selected face at an image edge remains a valid server rectangle',()=>{
 for(const size of [{width:250,height:700},{width:900,height:250}])for(const point of [{x:0,y:0},{x:1,y:1},{x:.5,y:.5}])assert.doesNotThrow(()=>faceRect(manualRect(point,size)));
});
