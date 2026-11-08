import {test} from 'node:test';
import assert from 'node:assert/strict';
import {filenamePhotoDate,normalizeUploadMetadata,photoUploadPayload,decodeUploadMetadata,PHOTO_METADATA_HEADER} from '../public/assets/photo-upload-metadata.mjs';

test('upload dates recognize full and partial scan filenames without turning page numbers into dates',()=>{
  for(const [name,date]of [
    ['23_11_1986_P25_03.png',{day:23,month:11,year:1986}],
    ['XX_08_1992_P19_02.png',{day:null,month:8,year:1992}],
    ['14_XX_XXXX_P03_01.png',{day:14,month:null,year:null}],
    ['XX_XX_1999_P01_01.png',{day:null,month:null,year:1999}],
    ['1980.jpg',{day:null,month:null,year:1980}],
    ['אירוע_29-02-2000.JPG',{day:29,month:2,year:2000}],
    ['IMG_20261108_123456.jpg',{day:8,month:11,year:2026}],
    ['photo_2020-02-29.jpg',{day:29,month:2,year:2020}]
  ])assert.deepEqual(filenamePhotoDate(name).date,date,name);
  for(const name of ['Photo_001_P01_02.png','209801.jpg','scan.png','IMG_12345678.jpg'])assert.equal(filenamePhotoDate(name).status,'none');
});

test('alternative date names fill only shared components and invalid dates stay blank',()=>{
  const result=filenamePhotoDate('03_09_1999_or_09_03_1999_P08_03.png');
  assert.equal(result.status,'ambiguous');assert.deepEqual(result.date,{day:null,month:null,year:1999});
  assert.deepEqual(filenamePhotoDate('23_11_1986_or_23_11_1987.jpg').date,{day:23,month:11,year:null});
  assert.equal(filenamePhotoDate('12_12_1980_or_12_12_1980.jpg').status,'full');
  for(const name of ['31_02_1999.png','29_02_1900.png','00_01_1980.png','IMG_20260231.jpg']){
    assert.equal(filenamePhotoDate(name).status,'invalid');assert.deepEqual(filenamePhotoDate(name).date,{day:null,month:null,year:null});
  }
});

test('photo metadata travels with the body, preserving original bytes and long multilingual descriptions',async()=>{
  const original=new File([new Uint8Array([255,216,255,0,4,8,12])],'23_11_1986.jpg',{type:'image/jpeg'});
  const metadata={date:{day:23,month:11,year:1986},caption:('משפחה יקרה ♥\n').repeat(400).slice(0,5000)};
  const payload=photoUploadPayload(original,metadata),bytes=new Uint8Array(await payload.body.arrayBuffer()),length=Number(payload.headers[PHOTO_METADATA_HEADER]);
  assert.deepEqual(decodeUploadMetadata(bytes.subarray(0,length)),metadata);
  assert.deepEqual(bytes.subarray(length),new Uint8Array(await original.arrayBuffer()));
  assert.equal(payload.body.size,length+original.size);assert.equal(payload.body.type,'image/jpeg');
  assert.deepEqual(photoUploadPayload(original,null),{body:original,headers:{}});
  for(const value of [{date:{day:31,month:4}},{caption:42},{caption:'a'.repeat(5001)},{familyPhoto:'true'},null,[]])assert.throws(()=>normalizeUploadMetadata(value));
  assert.throws(()=>decodeUploadMetadata(new Uint8Array([255,255])));
});
test('family photo selection stays attached to each upload without changing legacy metadata',async()=>{
  const file=new File(['pixels'],'photo.png',{type:'image/png'});
  for(const familyPhoto of [true,false]){
    const payload=photoUploadPayload(file,{date:{year:1980},caption:'Family',familyPhoto}),bytes=new Uint8Array(await payload.body.arrayBuffer()),length=Number(payload.headers[PHOTO_METADATA_HEADER]);
    assert.deepEqual(decodeUploadMetadata(bytes.subarray(0,length)),{date:{day:null,month:null,year:1980},caption:'Family',familyPhoto});
  }
  assert.equal(Object.hasOwn(normalizeUploadMetadata({caption:''}),'familyPhoto'),false);
});
