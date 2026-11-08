import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createUploadFaceAdapter,faceDraftPeople,transformedUploadFaces} from '../public/assets/photo-upload-faces.mjs';
import {normalizeUploadMetadata,photoUploadPayload,PHOTO_METADATA_HEADER,decodeUploadMetadata} from '../public/assets/photo-upload-metadata.mjs';

const person={id:'yona',name:'יונה',nameEn:'Yona'},rect={x:.2,y:.3,width:.1,height:.2};
const draft=()=>({key:crypto.randomUUID(),width:1000,height:800,rotation:0,crop:{x:0,y:0,width:1,height:1}});
const adapter=d=>createUploadFaceAdapter(d,{findPeople:async query=>!query||query==='Yona'?[person]:[],getPerson:id=>id==='yona'?person:null});
test('draft names are isolated, aliases reuse an existing person, and free names remain local until upload',async()=>{
 const a=draft(),b=draft(),one=adapter(a),two=adapter(b);
 await one.save({faceId:'a',name:'Yona',rect});assert.equal(faceDraftPeople(a)[0].id,'yona');assert.deepEqual(faceDraftPeople(b),[]);
 await one.save({faceId:'b',name:'אורח חדש',rect:{...rect,x:.6}});assert.equal(transformedUploadFaces(a)[1].name,'אורח חדש');assert.equal(Object.hasOwn(transformedUploadFaces(a)[1],'personId'),false);
 await one.review({complete:true});await one.save({faceId:'a',personId:null});assert.equal(a.facesComplete,false);assert.equal(faceDraftPeople(a).length,1);assert.equal((await two.load()).faces.length,0);
});
test('face coordinates survive rotation, crop clipping and returning to the original crop without accumulated loss',async()=>{
 const d=draft(),a=adapter(d);await a.save({faceId:'a',personId:'yona',rect});d.rotation=1;
 const displayed=(await a.load()).faces[0].rect;assert.ok(Math.abs(displayed.x-.5)<1e-12);assert.ok(Math.abs(displayed.y-.2)<1e-12);
 await a.save({faceId:'a',personId:'yona',rect:displayed});assert.ok(Math.abs(d.faceTags[0].rect.y-.3)<1e-12);
 d.crop={x:.5,y:0,width:.5,height:1};const saved=transformedUploadFaces(d)[0];assert.ok(Math.abs(saved.rect.x)<1e-12);assert.ok(Math.abs(saved.rect.width-.4)<1e-12);
 d.crop={x:0,y:0,width:.25,height:1};assert.deepEqual(transformedUploadFaces(d),[]);d.crop={x:0,y:0,width:1,height:1};assert.equal(transformedUploadFaces(d).length,1);
});
test('dismissing a rotated duplicate removes only its label and preserves that decision in the upload draft',async()=>{
 const d=draft(),a=adapter(d);await a.save({faceId:'first',personId:'yona',rect});await a.save({faceId:'second',personId:'yona',rect:{...rect,x:.6}});d.rotation=1;
 let state=await a.load();const selected=state.faces.find(face=>face.id==='second');state=await a.ignore({faceId:selected.id,rect:selected.rect,ignored:true});assert.equal(state.faces.length,1);assert.equal(state.faces[0].id,'first');assert.equal(faceDraftPeople(d).length,1);assert.deepEqual(state.ignoredFaces,[selected.rect]);
 state=await a.load();assert.equal(state.faces.length,1);assert.equal(state.ignoredFaces.length,1);await a.save({faceId:'replacement',personId:'yona',rect:selected.rect});assert.equal((await a.load()).ignoredFaces.length,0);assert.equal(transformedUploadFaces(d).length,2);
});
test('bounded upload metadata retains large face groups and rejects malformed labels, confirmations and coordinates',async()=>{
 const faces=Array.from({length:150},(_,i)=>({personId:'extra-'+i,rect:{x:.1,y:.1,width:.01,height:.01}})),value={caption:'א'.repeat(5000),faces,labels:['holidays'],complete:true};
 const payload=photoUploadPayload(new File(['pixels'],'one.jpg',{type:'image/jpeg'}),value),bytes=new Uint8Array(await payload.body.arrayBuffer()),n=Number(payload.headers[PHOTO_METADATA_HEADER]);assert.equal(decodeUploadMetadata(bytes.slice(0,n)).faces.length,150);
 for(const bad of [{faces:[{personId:'yona',rect:{...rect,x:-1}}]},{faces:[{personId:'yona',name:'Name',rect}]},{faces:[{name:'',rect}]},{faces:Array(151).fill({personId:'yona',rect})},{labels:['unknown']},{complete:'yes'}])assert.throws(()=>normalizeUploadMetadata(bad));
});
