import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fullCrop,rotateCrop,rotatedSize,pixelCrop,moveCrop,changed,outputFormat,outputName,drawPhoto,isPhoto} from '../public/assets/photo-edit-core.mjs';

test('four quarter turns restore the original crop and one turn swaps portrait dimensions',()=>{
  const original={x:.1,y:.2,width:.5,height:.4};let crop=original;
  for(let i=0;i<4;i++)crop=rotateCrop(crop,1);
  for(const key of Object.keys(crop))assert.ok(Math.abs(crop[key]-original[key])<1e-10);
  assert.deepEqual(rotatedSize(600,400,1),{width:400,height:600});
  const back=rotateCrop(rotateCrop(original,1),-1);
  for(const key of Object.keys(back))assert.ok(Math.abs(back[key]-original[key])<1e-10);
});
test('cropping after rotation maps to the correct oriented pixel rectangle',()=>{
  assert.deepEqual(pixelCrop(800,400,1,{x:.25,y:.5,width:.5,height:.25}),{x:100,y:400,width:200,height:200});
  assert.deepEqual(pixelCrop(800,400,0,fullCrop()),{x:0,y:0,width:800,height:400});
  assert.deepEqual(pixelCrop(800,400,2,{x:.99999,y:.99999,width:0,height:0}),{x:799,y:399,width:1,height:1});
});
test('moving and resizing a crop never leave the image or produce an empty rectangle',()=>{
  assert.deepEqual(moveCrop({x:.2,y:.3,width:.5,height:.4},'move',20,-20),{x:.5,y:0,width:.5,height:.4});
  const c=moveCrop(fullCrop(),'nw',2,2);
  assert.ok(c.width>=.0099&&c.height>=.0099);assert.ok(c.x>=0&&c.y>=0&&c.x+c.width<=1&&c.y+c.height<=1);
  for(const h of ['nw','n','ne','e','se','s','sw','w','move']){
    for(const dx of [-10,-.3,0,.3,10])for(const dy of [-10,-.3,0,.3,10]){
      const crop=moveCrop({x:.2,y:.3,width:.5,height:.4},h,dx,dy);
      assert.ok(crop.width>0&&crop.height>0&&crop.x>=0&&crop.y>=0&&crop.x+crop.width<=1.000001&&crop.y+crop.height<=1.000001);
    }
  }
});
test('reset and four turns preserve original bytes; GIF and AVIF edits get a matching PNG filename',()=>{
  assert.equal(changed(4,fullCrop()),false);assert.equal(changed(1,fullCrop()),true);
  assert.equal(changed(0,{x:.1,y:0,width:.9,height:1}),true);
  assert.equal(outputFormat({name:'old.gif',type:'image/gif'}),'image/png');
  assert.equal(outputName('old.gif','image/png'),'old.png');
  assert.equal(outputName('scan.avif','image/png'),'scan.png');
  assert.equal(outputFormat({name:'portrait.JPG',type:''}),'image/jpeg');
  assert.equal(isPhoto({type:'video/mp4',name:'film.mp4'}),false);
});
test('export applies crop and clockwise rotation directly to canvas pixels',()=>{
  const calls=[],context=Object.fromEntries(['save','scale','translate','rotate','drawImage','restore'].map(key=>[key,(...args)=>calls.push([key,...args])]));
  drawPhoto(context,'decoded image',800,400,1,{x:.25,y:.5,width:.5,height:.25});
  assert.deepEqual(calls,[['save'],['scale',1,1],['translate',-100,-400],['translate',400,0],['rotate',Math.PI/2],['drawImage','decoded image',0,0,800,400],['restore']]);
});
