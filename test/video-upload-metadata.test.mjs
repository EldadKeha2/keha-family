import {test} from 'node:test';
import assert from 'node:assert/strict';
import {videoUploadMetadata} from '../public/assets/video-upload-metadata.mjs';
test('video drafts preserve unknown dates, chosen folder, captions, ranges and manual people without display-only labels',()=>{
 const m=videoUploadMetadata({name:' A film ',caption:' A memory ',date:{year:1990},eventId:'',people:[{personId:'yona',label:'יונה'},{name:'חברה'}],range:{start:1.25,end:4.5}});
 assert.equal(m.name,'A film');assert.equal(m.caption,'A memory');assert.deepEqual(m.date,{day:null,month:null,year:1990});assert.equal(m.eventId,'');assert.deepEqual(m.people,[{personId:'yona'},{name:'חברה'}]);assert.deepEqual(m.range,{start:1.25,end:4.5});
});
test('invalid calendar dates, future years, backwards ranges and ambiguous people are rejected before upload',()=>{
 const base={name:'Film'};for(const part of [{date:{day:31,month:2,year:1990}},{date:{year:new Date().getFullYear()+1}},{range:{start:5,end:1}},{people:[{personId:'yona',name:'Yona'}]},{eventId:7},{group:'not-a-group'}])assert.throws(()=>videoUploadMetadata({...base,...part}),RangeError);
});
