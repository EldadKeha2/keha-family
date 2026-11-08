import {test} from 'node:test';
import assert from 'node:assert/strict';
import {photoDate,photoAge,photoDateText} from '../public/assets/photo-date.mjs';

test('photo dates retain every combination of optional components without inventing a date',()=>{
  for(let mask=0;mask<8;mask++){
    const date={day:mask&1?16:null,month:mask&2?10:null,year:mask&4?1980:null};
    assert.deepEqual(photoDate(date),date);
  }
  assert.deepEqual(photoDate({year:1980}),{day:null,month:null,year:1980});
  assert.deepEqual(photoDate({day:29,month:2}),{day:29,month:2,year:null});
  assert.deepEqual(photoDate({day:29,month:2,year:2000}),{day:29,month:2,year:2000});
  for(const value of [{day:31,month:4},{day:29,month:2,year:1900},{day:0},{month:13},{year:99},{year:1980.5},{year:'1980'},[],true,'1980'])assert.throws(()=>photoDate(value));
});

test('ages use completed years at capture time, with conservative rounding for partial dates',()=>{
  const birthday='16.10.1921';
  assert.deepEqual(photoAge(birthday,{day:15,month:10,year:1980}),{years:58,approximate:false});
  assert.deepEqual(photoAge(birthday,{day:16,month:10,year:1980}),{years:59,approximate:false});
  assert.deepEqual(photoAge(birthday,{year:1980}),{years:58,approximate:true});
  assert.deepEqual(photoAge('1.1.1921',{year:1980}),{years:59,approximate:true});
  assert.deepEqual(photoAge(birthday,{year:1980,month:10}),{years:58,approximate:true});
  assert.deepEqual(photoAge(birthday,{year:1980,month:11}),{years:59,approximate:true});
  assert.deepEqual(photoAge(birthday,{year:1980,day:20}),{years:58,approximate:true});
  assert.deepEqual(photoAge('29.2.2000',{day:28,month:2,year:2021}),{years:20,approximate:false});
  assert.deepEqual(photoAge('29.2.2000',{day:1,month:3,year:2021}),{years:21,approximate:false});
});

test('babies are under one; missing years, unknown birthdays and dates before birth never invent an age',()=>{
  assert.deepEqual(photoAge('16.10.1921',{year:1921}),{years:0,approximate:true});
  assert.deepEqual(photoAge('16.10.1921',{day:17,month:10,year:1921}),{years:0,approximate:false});
  for(const [born,date]of [['16.10.1921',{year:1920}],['16.10.1921',{day:15,month:10,year:1921}],['1.1.1111',{year:1980}],['31.2.1980',{year:2000}],['',{year:2000}],['16.10.1921',{day:16,month:10}]])assert.equal(photoAge(born,date),null);
});

test('date labels faithfully display only known components in Hebrew and English',()=>{
  assert.equal(photoDateText({year:1980}),'1980');
  assert.equal(photoDateText({day:16},'en-US'),'Day 16');
  assert.equal(photoDateText({day:16,year:1980},'he-IL'),'יום 16 · 1980');
  assert.equal(photoDateText({}), '');
  assert.match(photoDateText({month:10,year:1980},'en-US'),/Oct.*1980/);
  assert.match(photoDateText({day:16,month:10,year:1980},'en-GB'),/16 Oct 1980/);
});
