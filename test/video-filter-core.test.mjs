import {test} from 'node:test';
import assert from 'node:assert/strict';
import family from '../src/family.mjs';
import {filterVideos,sortVideos} from '../public/assets/video-filter-core.mjs';
const film=(id,person,videoCategory='family',extra={})=>({id,videoCategory,tags:person?[{id:person}]:[],...extra});
test('video refinements combine categories with the union of chosen people and descendant families without duplicates',()=>{
 const items=[film('parent','matan-g'),film('partner','camille','special-birthdays'),film('child','shay'),film('other','yona','special-birthdays'),film('untagged',null)];
 assert.deepEqual(filterVideos(items,{families:['u-matan-g'],people:['yona']},family).map(item=>item.id),['parent','partner','child','other']);
 assert.deepEqual(filterVideos(items,{families:['u-matan-g'],people:['yona'],categories:['special-birthdays']},family).map(item=>item.id),['partner','other']);
 assert.equal(filterVideos(items,{categories:['missing']},family).length,0);assert.equal(items.length,5);
});
test('video sorting uses upload, modification, capture dates and tag counts and leaves unknown dates last in either direction',()=>{
 const items=[film('older','yona','family',{uploadedAt:'2020-01-01',modifiedAt:'2026-01-01',takenDate:{year:1980}}),film('newer','shay','family',{uploadedAt:'2025-01-01',modifiedAt:'2025-01-01',takenDate:{year:1970}}),film('unknown',null)];
 const ids=sort=>filterVideos(items,{sort}).map(item=>item.id);
 assert.deepEqual(ids('uploaded-desc'),['newer','older','unknown']);assert.deepEqual(ids('uploaded-asc'),['older','newer','unknown']);
 assert.deepEqual(ids('modified-desc'),['older','newer','unknown']);assert.deepEqual(ids('taken-asc'),['newer','older','unknown']);assert.deepEqual(ids('taken-desc'),['older','newer','unknown']);assert.equal(ids('tags-asc')[0],'unknown');
});
test('random video order remains stable through searches and category filtering for the same shuffle',()=>{
 const items=Array.from({length:30},(_,i)=>film(String(i),null,i%2?'family':'special-birthdays'));
 const all=filterVideos(items,{sort:'random',seed:42}),subset=filterVideos(items,{sort:'random',seed:42,categories:['family']});
 assert.deepEqual(subset,all.filter(item=>item.videoCategory==='family'));assert.deepEqual(all,filterVideos(items,{sort:'random',seed:42}));assert.notDeepEqual(all,filterVideos(items,{sort:'random',seed:43}));
});
test('video length sorts both ways, uses available playback metadata, preserves ties and leaves unknown lengths last',()=>{
 const items=[{id:'unknown'},{id:'long',duration:165},{id:'cached'},{id:'short',duration:4},{id:'same',duration:4},{id:'invalid',duration:0}];
 const options={getDuration:item=>item.id==='cached'?63:item.duration};
 assert.deepEqual(sortVideos(items,{...options,sort:'duration-asc'}).map(item=>item.id),['short','same','cached','long','unknown','invalid']);
 assert.deepEqual(filterVideos(items,{...options,sort:'duration-desc'}).map(item=>item.id),['long','cached','short','same','unknown','invalid']);
 assert.equal(items[0].id,'unknown');
});
test('video descriptions use Hebrew alphabetic ordering in both directions and missing descriptions stay last',()=>{
 const items=[{id:'missing',name:'א'}, {id:'b',caption:' בנימין '},{id:'blank',caption:'  '},{id:'a',caption:'אורה'},{id:'c',caption:'גבי'}];
 assert.deepEqual(filterVideos(items,{sort:'description-asc'}).map(item=>item.id),['a','b','c','missing','blank']);
 assert.deepEqual(filterVideos(items,{sort:'description-desc'}).map(item=>item.id),['c','b','a','missing','blank']);
});
