import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import family from '../src/family.mjs';
import {differencePuzzles,differenceLevels,createDifferenceRound,beginDifferenceRound,checkDifferenceTime,markDifference} from '../public/assets/differences.mjs';

test('each of five tagged family photos has exactly five separate differences at each difficulty',async()=>{
  assert.equal(differencePuzzles.length,5);
  for(const p of differencePuzzles){
    assert.ok(p.tags.length>=5);for(const id of p.tags)assert.ok(family.people[id],id);
    for(const src of [p.original,p.edited]){const bytes=await readFile(new URL('../public/'+src,import.meta.url));assert.equal(bytes.subarray(8,12).toString(),'WEBP');}
    for(const level of differenceLevels){const areas=p.differences[level];assert.equal(areas.length,5);assert.equal(new Set(areas.map(a=>a.id)).size,5);
      for(const a of areas){assert.ok(a.label&&a.labelEn);assert.ok(a.x-a.w/2>=0&&a.x+a.w/2<=1&&a.y-a.h/2>=0&&a.y+a.h/2<=1,`${p.id} ${a.id}`);}
      for(const [i,a]of areas.entries())for(const b of areas.slice(i+1))assert.ok(Math.abs(a.x-b.x)>(a.w+b.w)/2||Math.abs(a.y-b.y)>(a.h+b.h)/2,`${p.id}: ${a.id} overlaps ${b.id}`);
    }
  }
});
test('a round waits for both photos, starts with two minutes, and cannot be restarted to extend the deadline',()=>{
  const r=createDifferenceRound(differencePuzzles[0]);assert.equal(r.status,'loading');assert.equal(r.deadline,null);assert.equal(markDifference(r,0,0).kind,'ignored');
  beginDifferenceRound(r,1000);assert.equal(r.deadline,121000);beginDifferenceRound(r,60000);assert.equal(r.deadline,121000);
  assert.equal(checkDifferenceTime(r,120999),'playing');assert.equal(checkDifferenceTime(r,121000),'lost');assert.equal(r.reason,'timeout');
});
test('five unique finds earn a win, repeated finds and invalid coordinates never add mistakes',()=>{
  for(const puzzle of differencePuzzles)for(const level of differenceLevels){
    const r=createDifferenceRound(puzzle,level);beginDifferenceRound(r,0);
    for(const d of puzzle.differences[level]){assert.equal(markDifference(r,d.x,d.y,1).kind,'found');assert.equal(markDifference(r,d.x,d.y,1).kind,'ignored');}
    assert.equal(r.status,'won');assert.equal(r.found.length,5);assert.equal(r.mistakes,0);
    for(const [x,y]of [[NaN,.5],[-1,.5],[.5,Infinity],[2,2]])assert.equal(markDifference(r,x,y,2).kind,'ignored');
  }
});
test('three wrong selections lose the photo and later correct or expired clicks cannot score',()=>{
  const r=createDifferenceRound(differencePuzzles[0]);beginDifferenceRound(r,0);for(let i=0;i<3;i++)assert.equal(markDifference(r,0,0,1).kind,'miss');assert.equal(r.status,'lost');assert.equal(r.reason,'mistakes');
  const d=r.puzzle.differences.easy[0];assert.equal(markDifference(r,d.x,d.y,2).kind,'ignored');assert.equal(r.found.length,0);
  const expired=createDifferenceRound(r.puzzle);beginDifferenceRound(expired,0);assert.equal(markDifference(expired,d.x,d.y,120000).kind,'ignored');assert.equal(expired.reason,'timeout');
});
