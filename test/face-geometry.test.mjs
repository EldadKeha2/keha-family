import {test} from 'node:test';
import assert from 'node:assert/strict';
import {clampRect,mergeFaces,chooseFace,manualRect,popoverPosition,unrotateRect,sameRegion,separateFaces,labelledRegion} from '../public/assets/face-geometry.mjs';
import {faceCoverage} from '../public/assets/face-coverage.mjs';
import {detectionSize,detectionRegions} from '../public/assets/face-scan.mjs';
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
test('a narrow saved face suppresses its broad duplicate in both the viewer and partial counts, while nearby people stay distinct',()=>{
 const saved={id:'label',personId:'one',rect:{x:.40,y:.30,width:.05,height:.065}};
 const broad={id:'broad',rect:{x:.38,y:.27,width:.09,height:.12},score:.95};
 const neighbour={id:'neighbour',rect:{x:.453,y:.30,width:.05,height:.065},score:.93};
 assert.equal(sameRegion(saved.rect,broad.rect),false);assert.equal(labelledRegion(saved.rect,broad.rect),true);
 assert.deepEqual(mergeFaces([saved],[broad]).map(face=>face.id),['label']);
 assert.deepEqual(faceCoverage([saved],[broad],1),{total:1,unmatched:0,partial:false});
 assert.deepEqual(mergeFaces([saved],[broad,neighbour]).map(face=>face.id),['label','neighbour']);
 assert.deepEqual(faceCoverage([saved],[broad,neighbour],1),{total:2,unmatched:1,partial:true});
 assert.equal(faceCoverage([],[broad,neighbour],0).partial,false);
});
test('touching small nearby faces picks the closest centre instead of a neighbouring overlapping hit target',()=>{
 const faces=[{id:'left',rect:{x:.1,y:.1,width:.03,height:.03}},{id:'right',rect:{x:.15,y:.1,width:.03,height:.03}}],size={width:320,height:320};
 assert.equal(chooseFace(faces,{x:.165,y:.115},size).id,'right');assert.equal(chooseFace(faces,{x:.115,y:.115},size).id,'left');assert.equal(chooseFace(faces,{x:.8,y:.8},size),null);
});
test('dense overlapping faces and small faces inside a broad box remain separate from saved names',()=>{
 const left={id:'left',personId:'one',rect:{x:.1,y:.2,width:.04,height:.05}},right={id:'right',rect:{x:.116,y:.2,width:.04,height:.05}},broad={id:'broad',rect:{x:.08,y:.18,width:.14,height:.16}};
 assert.equal(sameRegion(left.rect,right.rect),false);assert.equal(sameRegion(left.rect,broad.rect),false);
 assert.deepEqual(mergeFaces([left],[right,broad]).map(face=>face.id),['left','right','broad']);
 assert.equal(chooseFace([broad,right,left],{x:.12,y:.225},{width:320,height:320}).id,'left');
 assert.equal(chooseFace([broad,left,right],{x:.145,y:.225},{width:320,height:320}).id,'right');
 const tinyNeighbour={id:'nearby',rect:{x:.132,y:.2,width:.008,height:.01}};
 assert.equal(chooseFace([tinyNeighbour,left],{x:.127,y:.205},{width:320,height:320}).id,'left','A padded neighbour must never steal a tap inside the actual face');
});
test('manual selection shrinks with photo zoom so adjacent small faces can be tagged separately',()=>{
 const size={width:3200,height:2400},left=manualRect({x:.5,y:.5},size),right=manualRect({x:.516,y:.5},size);
 assert.equal(left.width*size.width,32);assert.equal(left.height*size.height,32);assert.equal(sameRegion(left,right),false);
 assert.doesNotThrow(()=>faceRect(left));assert.doesNotThrow(()=>faceRect(right));
});
test('a coarse detection around the two highest back-row heads cannot capture taps meant for either person',()=>{
 const left={id:'left',score:.95,rect:{x:.304729,y:.250508,width:.05159,height:.051676}},right={id:'right',score:.94,rect:{x:.378132,y:.259356,width:.047379,height:.047457}};
 const pair={id:'pair',score:.99,rect:{x:.258793,y:.18957,width:.227447,height:.227825}};
 assert.deepEqual(separateFaces([pair,left,right]).map(f=>f.id),['left','right']);
 assert.deepEqual(mergeFaces([],[pair,left,right]).map(f=>f.id),['left','right']);
 for(const width of [300,360,720,1800]){
   assert.equal(chooseFace([pair,left,right],{x:.33,y:.275},{width,height:width}).id,'left');
   assert.equal(chooseFace([pair,left,right],{x:.401,y:.283},{width,height:width}).id,'right');
 }
 assert.equal(chooseFace([pair,left,right],{x:.33,y:.245},{width:300,height:300}).id,'left');
 assert.equal(chooseFace([pair,left,right],{x:.401,y:.255},{width:300,height:300}).id,'right');
 assert.deepEqual(mergeFaces([{...pair,personId:'existing'}],[left,right]).map(f=>f.id),['pair','left','right'],'Never delete an existing face label');
 assert.equal(separateFaces([pair,{...left,score:.5},{...right,score:.5}]).length,3,'Weak guesses cannot remove a coarse face');
});
test('large photos retain detail within a bounded bitmap budget and every small face fits inside an overlapping fine tile',()=>{
 for(const [w,h] of [[6000,4000],[4000,6000],[8000,8000],[12000,1000],[320,240]]){
  const size=detectionSize(w,h),regions=detectionRegions(size.width,size.height);
  assert.ok(size.width<=w&&size.height<=h);assert.ok(Math.max(size.width,size.height)<=4096);assert.ok(size.width*size.height<12_010_000);assert.ok(regions.length<=128);
  if(w===6000)assert.ok(size.width>1920,'Do not discard high-resolution detail before the tiled scan');
  const fine=regions.filter(r=>Math.max(r.width,r.height)<=512);
  if(Math.max(size.width,size.height)<=512)continue;
  for(let y=0;y<=size.height-48;y+=37)for(let x=0;x<=size.width-48;x+=37)assert.ok(fine.some(r=>r.x<=x&&r.y<=y&&r.x+r.width>=x+48&&r.y+r.height>=y+48),`Missing seam coverage at ${x},${y}`);
 }
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
test('sideways and upside-down detection rectangles map back onto the unchanged original photo',()=>{
 const original={x:.13,y:.22,width:.17,height:.29};
 for(const [turn,rect]of [[90,{x:1-original.y-original.height,y:original.x,width:original.height,height:original.width}],[180,{x:1-original.x-original.width,y:1-original.y-original.height,width:original.width,height:original.height}],[270,{x:original.y,y:1-original.x-original.width,width:original.height,height:original.width}]]){
  const restored=unrotateRect(rect,turn);for(const key of Object.keys(original))assert.ok(Math.abs(restored[key]-original[key])<1e-12);assert.doesNotThrow(()=>faceRect(restored));
 }
});
