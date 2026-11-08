import {test} from 'node:test';
import assert from 'node:assert/strict';
import {photoTransform,transformPhotoFaces} from '../src/photo-versions.mjs';

test('face labels rotate with the image, crop to the retained area and keep their identity',()=>{
  const face={id:'face',personId:'yona',rect:{x:.1,y:.2,width:.2,height:.3}};
  const [turned]=transformPhotoFaces([face],photoTransform(1,{x:0,y:0,width:1,height:1}));
  assert.equal(turned.id,face.id);assert.equal(turned.personId,'yona');
  for(const [key,value] of Object.entries({x:.5,y:.1,width:.3,height:.2}))assert.ok(Math.abs(turned.rect[key]-value)<1e-10);
  const [cropped]=transformPhotoFaces([face],photoTransform(0,{x:.2,y:.1,width:.4,height:.5}));
  for(const [key,value] of Object.entries({x:0,y:.2,width:.25,height:.6}))assert.ok(Math.abs(cropped.rect[key]-value)<1e-10);
  assert.equal(transformPhotoFaces([face],photoTransform(0,{x:.5,y:.5,width:.5,height:.5})).length,0);
});
test('invalid crop geometry and rotations cannot produce a new saved version',()=>{
  for(const rotation of [-1,4,.5,NaN])assert.throws(()=>photoTransform(rotation,{x:0,y:0,width:1,height:1}));
  for(const crop of [null,{}, {x:-.1,y:0,width:1,height:1},{x:0,y:0,width:0,height:1},{x:.5,y:0,width:1,height:1},{x:0,y:NaN,width:1,height:1}])assert.throws(()=>photoTransform(0,crop));
});
