import {test} from 'node:test';
import assert from 'node:assert/strict';
import {clampRect,mergeFaces,chooseFace,manualRect,popoverPosition,unrotateRect,sameRegion,separateFaces,labelledRegion,resizeFaceRect,layoutFaceLabels,intersection,annotationFaceRect,labelLeader,labelLeadersConflict} from '../public/assets/face-geometry.mjs';
import {faceCoverage} from '../public/assets/face-coverage.mjs';
import {detectionSize,detectionRegions} from '../public/assets/face-scan.mjs';
import {faceRect} from '../src/faces.mjs';
import {crowdPhotoFaces,crowdPhotoAspect} from './helpers/crowd-photo.mjs';

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
 assert.deepEqual(faceCoverage([saved],[broad],1),{total:1,unmatched:0,partial:true});
 assert.deepEqual(faceCoverage([saved],[broad],1,{reviewed:true}),{total:1,unmatched:0,partial:false});
 assert.deepEqual(mergeFaces([saved],[broad,neighbour]).map(face=>face.id),['label','neighbour']);
 assert.deepEqual(faceCoverage([saved],[broad,neighbour],1),{total:2,unmatched:1,partial:true});
 assert.equal(faceCoverage([],[broad,neighbour],0).partial,false);
});
test('frame handles resize the selected sides, preserve opposite edges and stay inside the photo',()=>{
 const rect={x:.2,y:.3,width:.25,height:.3};
 for(const handle of ['nw','n','ne','e','se','s','sw','w']){
  const resized=resizeFaceRect(rect,handle,{x:handle.includes('w')?.1:.6,y:handle.includes('n')?.2:.7});
  assert.doesNotThrow(()=>faceRect(resized));
  if(!handle.includes('w'))assert.equal(resized.x,rect.x);
  if(!handle.includes('n'))assert.equal(resized.y,rect.y);
  if(!handle.includes('e'))assert.ok(Math.abs(resized.x+resized.width-(rect.x+rect.width))<1e-12);
  if(!handle.includes('s'))assert.ok(Math.abs(resized.y+resized.height-(rect.y+rect.height))<1e-12);
 }
 for(const handle of ['nw','se'])for(const point of [{x:-1,y:-1},{x:2,y:2}]){
  const resized=resizeFaceRect(rect,handle,point);assert.doesNotThrow(()=>faceRect(resized));assert.ok(resized.x>=0&&resized.y>=0&&resized.x+resized.width<=1&&resized.y+resized.height<=1);
 }
 assert.deepEqual(rect,{x:.2,y:.3,width:.25,height:.3},'Dragging does not mutate the saved rectangle before a successful save');
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
test('the picker uses space beside, above or below a face without covering any of it, including above a phone keyboard',()=>{
 const panel={width:280,height:340};
 for(const viewport of [{width:1200,height:800},{width:360,height:800},{width:360,height:280},{width:320,height:568},{width:812,height:375},{width:375,height:280,top:120}]){
  const left=viewport.left||0,top=viewport.top||0;
  for(const [x,y]of [[left+8,top+8],[left+viewport.width-78,top+8],[left+viewport.width/2-35,top+viewport.height-78],[left+viewport.width/2-35,top+viewport.height/2-35]]){
   const face={x,y,width:70,height:70},p=popoverPosition(face,panel,viewport),box={x:p.x,y:p.y,width:p.width,height:Math.min(panel.height,p.maxHeight)};
   assert.ok(p.x>=left+8&&p.x+p.width<=left+viewport.width-8);
   assert.ok(p.y>=top+8&&p.y+box.height<=top+viewport.height-8);
   assert.equal(intersection(box,face),0,JSON.stringify({viewport,face,box}));
  }
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

test('simultaneous face labels never overlap, stay within the photo and have a safe dense-photo fallback',()=>{
 for(const bounds of [{width:360,height:270},{width:1280,height:900},{width:270,height:360}]){
  const labels=Array.from({length:8},(_,i)=>({width:100,height:24,face:{x:bounds.width*(.1+(i%4)*.22),y:bounds.height*(.2+Math.floor(i/4)*.35),width:30,height:40}})),placed=layoutFaceLabels(labels,bounds);assert.ok(placed);
  for(let i=0;i<placed.length;i++){const a=placed[i];assert.ok(a.x>=0&&a.y>=0&&a.x+a.width<=bounds.width&&a.y+a.height<=bounds.height);for(const b of placed.slice(i+1))assert.ok(a.x+a.width+4<=b.x||b.x+b.width+4<=a.x||a.y+a.height+4<=b.y||b.y+b.height+4<=a.y);}
 }
 assert.equal(layoutFaceLabels(Array.from({length:150},()=>({width:200,height:40,face:{x:100,y:100,width:20,height:25}})),{width:320,height:200}),null);
});

test('labels prefer free space above a head and use measured wrapping to fit between neighbouring faces',()=>{
 const face={x:125,y:100,width:40,height:50},faces=[{x:20,y:25,width:75,height:100},{x:205,y:25,width:75,height:100}],labels=[{width:150,height:24,variants:[{width:150,height:24},{width:70,height:42}],face}];
 const [box]=layoutFaceLabels(labels,{width:300,height:180,faces});assert.equal(box.variant,1);assert.ok(box.y+box.height<face.y);
 for(const other of [face,...faces])assert.equal(intersection(box,other),0);
 const [roomy]=layoutFaceLabels([{width:110,height:24,face:{x:140,y:160,width:45,height:50}}],{width:400,height:300});assert.ok(roomy.y+roomy.height<160);
});
test('both small age labels and names go below a face when another head blocks the space above',()=>{
 const face={x:140,y:160,width:40,height:50},obstacle={x:105,y:65,width:110,height:78};
 for(const width of [36,96]){
  const [box]=layoutFaceLabels([{width,height:24,face}],{width:320,height:280,faces:[obstacle]});assert.ok(box.y>=face.y+face.height);assert.equal(intersection(box,obstacle),0);
  assert.ok(box.leader.to.y>=face.y+face.height,'Connectors stop outside the chin, not in the middle of the face');
 }
});
test('a multi-row family photo protects all faces, including unlabelled people, at desktop and phone sizes',()=>{
 const scene=[[15,112,70,115],[140,149,73,91],[226,143,55,91],[288,177,58,85],[379,182,81,91],[537,144,71,93],[668,208,63,86],[756,201,65,91],[804,294,56,70],[934,127,70,94],[1023,183,71,80],[1032,292,70,85],[115,315,74,91],[211,408,62,75],[609,491,72,90],[819,472,69,85]];
 for(const width of [1120,560,360]){
  const scale=width/1120,faces=scene.map(([x,y,w,h])=>({x:x*scale,y:y*scale,width:w*scale,height:h*scale})),labels=faces.slice(0,12).map(face=>({width:132,height:24,variants:[{width:132,height:24},{width:88,height:40},{width:64,height:56}],face})),bounds={width,height:794*scale,faces};
  const layout=layoutFaceLabels(labels,bounds);
  if(!layout){assert.equal(width,360,'Only a dense phone photo should need the external legend');const markers=layoutFaceLabels(labels.map(label=>({...label,variants:undefined,width:18,height:18})),bounds);if(markers)for(const box of markers)for(const face of faces)assert.equal(intersection(box,face),0);continue;}
  assert.deepEqual(layoutFaceLabels(labels,bounds),layout,'Placement stays stable when nothing moved');
  for(let i=0;i<layout.length;i++){const box=layout[i];for(const face of faces)assert.equal(intersection(box,face),0);for(const other of layout.slice(i+1))assert.equal(intersection(box,other),0);}
 }
});

test('connector endpoints stay just outside the central part of their own face edge',()=>{
 const face={x:100,y:100,width:40,height:50};
 const above=labelLeader({x:145,y:25,width:60,height:24},face).to;
 assert.equal(above.y,97.5);assert.ok(above.x>=111.2&&above.x<=128.8);
 const below=labelLeader({x:10,y:180,width:60,height:24},face).to;
 assert.equal(below.y,152.5);assert.ok(below.x>=111.2&&below.x<=128.8);
 const side=labelLeader({x:10,y:110,width:60,height:24},face).to;
 assert.equal(side.x,97.5);assert.ok(side.y>=115&&side.y<=135);
});
test('broad saved regions use one precise same-person reference without moving tags or guessing another head',()=>{
 const broad={personId:'one',rect:{x:.575329,y:.336013,width:.219191,height:.219554}},precise={personId:'one',rect:{x:.635861,y:.319793,width:.054013,height:.06846}},neighbour={personId:'two',rect:{x:.708726,y:.31057,width:.035957,height:.04257}},before=structuredClone(broad);
 assert.deepEqual(annotationFaceRect(broad,[broad,precise,neighbour]),precise.rect);assert.deepEqual(broad,before);
 assert.deepEqual(annotationFaceRect(broad,[broad,{...precise,personId:'two'}]),broad.rect);
 const secondOccurrence={personId:'one',rect:{x:.73,y:.43,width:.04,height:.05}};
 assert.deepEqual(annotationFaceRect(broad,[broad,precise,secondOccurrence]),broad.rect,'Two distinct same-person occurrences are ambiguous');
 assert.deepEqual(annotationFaceRect(neighbour,[broad,precise,neighbour]),neighbour.rect);
});
test('connector conflicts include crossings, shared ends and close parallel runs',()=>{
 const a={from:{x:0,y:0},to:{x:20,y:20}};
 assert.equal(labelLeadersConflict(a,{from:{x:0,y:20},to:{x:20,y:0}}),true);
 assert.equal(labelLeadersConflict(a,{from:{x:20,y:20},to:{x:30,y:20}}),true);
 assert.equal(labelLeadersConflict({from:{x:0,y:0},to:{x:20,y:0}},{from:{x:2,y:2},to:{x:18,y:2}}),true);
 assert.equal(labelLeadersConflict(a,{from:{x:30,y:0},to:{x:30,y:20}}),false);
});

test('one unrouteable face never hides safe numbered markers for the rest of the photo',()=>{
 const labels=[{width:18,height:18,face:{x:100,y:100,width:10,height:10}},{width:18,height:18,face:{x:220,y:80,width:20,height:30}}],bounds={width:300,height:200,faces:[{x:90,y:90,width:30,height:30}]};
 assert.equal(layoutFaceLabels(labels,bounds),null);
 const partial=layoutFaceLabels(labels,{...bounds,partial:true});assert.equal(partial.length,2);assert.equal(partial[0],null);assert.ok(partial[1]?.leader);
 const afterRemoval=layoutFaceLabels(labels.slice(1),{...bounds,partial:true});assert.equal(afterRemoval.length,1);assert.ok(afterRemoval[0]?.leader);
});

test('removing two precise duplicate tags keeps all remaining crowd markers at desktop and phone sizes',()=>{
 const original=crowdPhotoFaces(),removed=[original[20].id,original[23].id];
 for(const width of [360,450,748,1120])for(const count of [1,2]){
  const saved=original.filter(face=>!removed.slice(0,count).includes(face.id)),height=width*crowdPhotoAspect,project=face=>{const r=annotationFaceRect(face,saved);return{x:r.x*width,y:r.y*height,width:r.width*width,height:r.height*height};},faces=saved.map(project),labels=saved.filter(face=>face.person).map(face=>({width:18,height:18,face:project(face)}));
  const layout=layoutFaceLabels(labels,{width,height,faces,partial:true});assert.equal(layout.filter(Boolean).length,26-count,width+'px after '+count+' removals');
  for(let i=0;i<layout.length;i++)for(const other of layout.slice(i+1))assert.equal(labelLeadersConflict(layout[i].leader,other.leader),false);
 }
});

test('crowd markers connect to precise saved heads without crossing each other, another label or another face',()=>{
 const saved=crowdPhotoFaces();
 const sampleHits=(line,box)=>{const n=Math.max(1,Math.ceil(Math.hypot(line.to.x-line.from.x,line.to.y-line.from.y)*2));for(let i=1;i<n;i++){const t=i/n,x=line.from.x+(line.to.x-line.from.x)*t,y=line.from.y+(line.to.y-line.from.y)*t;if(x>box.x&&x<box.x+box.width&&y>box.y&&y<box.y+box.height)return true;}return false;};
 for(const width of [360,450,748,1120]){
  const height=width*.99837,faces=saved.map(face=>{const r=annotationFaceRect(face,saved);return{x:r.x*width,y:r.y*height,width:r.width*width,height:r.height*height};}),labels=faces.slice(0,26).map(face=>({width:18,height:18,face})),layout=layoutFaceLabels(labels,{width,height,faces});
  assert.ok(layout,'Numbered crowd markers should fit at '+width+'px');
  for(let i=0;i<layout.length;i++){
   const box=layout[i];assert.ok(box.leader);const face=faces[i],p=box.leader.to,d=Math.hypot(Math.max(face.x-p.x,0,p.x-face.x-face.width),Math.max(face.y-p.y,0,p.y-face.y-face.height));assert.ok(d>=2.4&&d<=2.6);
   for(let j=0;j<faces.length;j++)if(JSON.stringify(faces[j])!==JSON.stringify(face)){
    const other=faces[j],distance=Math.hypot(Math.max(other.x-p.x,0,p.x-other.x-other.width),Math.max(other.y-p.y,0,p.y-other.y-other.height));assert.ok(distance>=3.5,'The endpoint must be visibly closer to its own head');
    assert.equal(sampleHits(box.leader,other),false,'A line may not enter a different face');
   }
   for(let j=0;j<layout.length;j++)if(i!==j)assert.equal(sampleHits(box.leader,layout[j]),false,'A line may not pass under another marker');
   for(const other of layout.slice(i+1))assert.equal(labelLeadersConflict(box.leader,other.leader),false,'Leaders must be separated');
  }
 }
});
