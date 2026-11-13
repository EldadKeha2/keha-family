import {test} from 'node:test';
import assert from 'node:assert/strict';
import {decodeYuNet,projectYuNet,sameDetection,suppressDetections,confirmYuNet,plausibleFaceLandmarks,unrotateYuNet,separateYuNetRegions} from '../public/assets/face-yunet.mjs';
import {sameRegion,mergeFaces} from '../public/assets/face-geometry.mjs';
import {faceRect} from '../src/faces.mjs';
import {detectionRegions} from '../public/assets/face-scan.mjs';

const face=(x=.1,score=.7)=>({rect:{x,y:.2,width:.1,height:.1},score,landmarks:[[.25,.3],[.70,.3],[.48,.53],[.32,.75],[.65,.75]].map(([dx,dy])=>({x:x+dx*.1,y:.2+dy*.1}))});
test('overlapping half-faces with distinct landmarks survive suppression while repeated detections merge',()=>{
 const front=face(),behind={...face(.13),rect:{...front.rect}},duplicate=structuredClone(front);duplicate.score=.6;
 assert.equal(sameRegion(front.rect,behind.rect),true);assert.equal(sameDetection(front,behind),false);
 assert.equal(sameDetection(front,duplicate),true);assert.deepEqual(suppressDetections([front,behind,duplicate]),[front,behind]);
});
test('a weak face needs independent agreeing views and a strong face is shown immediately',()=>{
 const candidates=[],weak=face(.1,.53),strong=face(.6,.9);
 assert.equal(confirmYuNet(candidates,[weak,strong],1).length,1);
 assert.equal(confirmYuNet(candidates,[weak],1).length,1,'Repeated proposals in one inference are not independent');
 assert.equal(confirmYuNet(candidates,[weak],2).length,2);
 assert.equal(confirmYuNet([], [face(.1,.47)],1).length,0);
});
test('mirrored padded crops project boxes and landmark ordering onto the original pixels',()=>{
 const original=face(),region={x:200,y:100,width:384,height:192},size={width:4096,height:3072},drawn={width:640,height:320};
 const pixels={rect:{x:80,y:60,width:50,height:70},score:.9,landmarks:[{x:90,y:75},{x:120,y:75},{x:105,y:90},{x:95,y:110},{x:115,y:110}]};
 const projected=projectYuNet(pixels,region,size,drawn),mirrored={...pixels,rect:{...pixels.rect,x:640-80-50},landmarks:[1,0,2,4,3].map(i=>({x:640-pixels.landmarks[i].x,y:pixels.landmarks[i].y}))};
 assert.deepEqual(projectYuNet(mirrored,region,size,drawn,true),projected);
 assert.equal(projectYuNet({...pixels,rect:{x:80,y:400,width:50,height:70}},region,size,drawn),null,'Do not detect in letterbox padding');
 assert.doesNotThrow(()=>faceRect(projected.rect));
 assert.equal(projectYuNet({...pixels,rect:{x:590,y:60,width:45,height:70}},region,size,drawn),null,'Discard a sliver of one face cut by an internal tile seam');
 assert.ok(projectYuNet({...pixels,rect:{x:590,y:60,width:45,height:70}},{x:0,y:0,width:384,height:192},{width:384,height:192},drawn),'Faces at a real photograph edge remain detectable');
});
test('aligned local verification maps a tilted face back to its original photo without mirroring landmarks',()=>{
 const drawn={width:640,height:640},angle=Math.PI/4,original={rect:{x:240,y:220,width:100,height:130},score:.9,landmarks:[{x:260,y:250},{x:310,y:250},{x:285,y:280},{x:265,y:320},{x:305,y:320}]};
 const aligned={...original,landmarks:original.landmarks.map(p=>({x:320+Math.cos(angle)*(p.x-320)-Math.sin(angle)*(p.y-320),y:320+Math.sin(angle)*(p.x-320)+Math.cos(angle)*(p.y-320)}))};
 const restored=unrotateYuNet(aligned,angle,drawn);
 for(const[i,point]of original.landmarks.entries()){assert.ok(Math.abs(point.x-restored.landmarks[i].x)<1e-8);assert.ok(Math.abs(point.y-restored.landmarks[i].y)<1e-8);}
});
test('tiny distant faces can be saved precisely and do not duplicate at subpixel normalized areas',()=>{
 const a={id:'a',rect:{x:.1,y:.2,width:6/4096,height:8/3072}},b={id:'b',rect:{x:.103,y:.2,width:6/4096,height:8/3072}};
 assert.doesNotThrow(()=>faceRect(a.rect));assert.equal(sameRegion(a.rect,a.rect),true);
 assert.equal(mergeFaces([a],[b]).length,2);assert.throws(()=>faceRect({...a.rect,width:.0001}));
});
test('fine YuNet crops preserve seam coverage for distant faces across the complete image',()=>{
 const width=4096,height=2929,regions=detectionRegions(width,height,[1024,384]),fine=regions.filter(r=>r.width===384&&r.height===384);
 assert.ok(regions.length<220);
 for(let y=0;y<height-24;y+=43)for(let x=0;x<width-24;x+=43)assert.ok(fine.some(r=>r.x<=x&&r.y<=y&&r.x+r.width>=x+24&&r.y+r.height>=y+24));
});
test('YuNet decoder uses the model BGR-grid output geometry and rejects invalid boxes',()=>{
 const outputs={};for(const stride of [8,16,32])for(const [name,depth] of [['cls',1],['obj',1],['bbox',4],['kps',10]])outputs[name+'_'+stride]={data:new Float32Array((640/stride)**2*depth)};
 const i=12*80+10;outputs.cls_8.data[i]=.9;outputs.obj_8.data[i]=.9;
 outputs.bbox_8.data.set([.5,.5,Math.log(4),Math.log(5)],i*4);
 const [decoded]=decodeYuNet(outputs);assert.ok(Math.abs(decoded.rect.x-68)<1e-5);assert.ok(Math.abs(decoded.rect.y-80)<1e-5);assert.ok(Math.abs(decoded.rect.width-32)<1e-5);assert.equal(decoded.landmarks.length,5);
 outputs.bbox_8.data[i*4+2]=Infinity;assert.equal(decodeYuNet(outputs).length,0);
});


test('anatomical validation rejects collapsed or collinear hand and fabric proposals while retaining small profile faces',()=>{
 const real=face(.1,.8);assert.equal(plausibleFaceLandmarks(real),true);
 for(const landmarks of [Array(5).fill({x:.15,y:.25}),Array.from({length:5},(_,i)=>({x:.12+i*.01,y:.22+i*.01}))]){
  const falsePositive={...real,landmarks};assert.equal(plausibleFaceLandmarks(falsePositive),false);const candidates=[];confirmYuNet(candidates,[falsePositive],1);assert.deepEqual(confirmYuNet(candidates,[falsePositive],2),[]);
 }
 const tiny={rect:{x:.4,y:.3,width:.002,height:.003},score:.8};tiny.landmarks=[[.34,.33],[.42,.34],[.55,.53],[.38,.75],[.55,.74]].map(([x,y])=>({x:tiny.rect.x+x*tiny.rect.width,y:tiny.rect.y+y*tiny.rect.height}));assert.equal(plausibleFaceLandmarks(tiny),true);
});

test('close profile faces with touching noses retain separate feature regions through rectangle-only storage',()=>{
 const a=face(),b={...structuredClone(a),landmarks:a.landmarks.map((p,i)=>({...p,x:p.x+(i<2?.035:i>=3?.025:0)}))};
 assert.equal(sameDetection(a,b),false);const separated=separateYuNetRegions([a,b]);assert.equal(sameRegion(separated[0].rect,separated[1].rect),false);assert.equal(mergeFaces([],separated).length,2);
 assert.deepEqual(separateYuNetRegions([a,{...a,score:.7}]).map(f=>f.rect),[a.rect,a.rect],'Repeated views of one head do not shrink its box');
});
