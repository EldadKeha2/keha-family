import {test} from 'node:test';
import assert from 'node:assert/strict';
import {overviewLayout,foliageLayout} from '../public/assets/family-timeline-overview.mjs';
import {familyTimeline} from '../public/assets/family-timeline-data.mjs';
import family from '../src/family.mjs';

const today=new Date(2026,10,11);
const people=[...Object.values(family.people).filter(p=>!p.extra&&!p.extended).map((p,index)=>({...p,birthday:String(index<2?1907+index*14:p.generation===2?1933+index%23:p.generation===3?1956+index%35:1988+index%39)}))];
const model=familyTimeline({people,wedding:{id:'u-root',date:'1938'},today});

test('all four generations align to the same full-century scale, including the 1988 descendants and 1938 wedding',()=>{
  const layout=overviewLayout(model,1000,1,today);
  assert.equal(layout.start,1900);assert.equal(layout.end,2030);
  assert.ok(layout.tracks.every(track=>track.origin===1900&&track.axisEnd===2030));
  assert.equal(layout.x(1900),28);assert.equal(layout.x(2030),972);
  assert.ok(layout.tracks[3].events.every(e=>e.year>=1988));
  assert.equal(layout.tracks[0].events.find(e=>e.kind==='wedding').year,1938);
  assert.equal(layout.tracks[0].events.find(e=>e.kind==='wedding').precision,'year');
});

test('portrait branches use empty years without overlapping or losing any event',()=>{
  for(const width of [350,640,1000,1600])for(const track of overviewLayout(model,width,1,today).tracks){
    const foliage=foliageLayout(track,width);assert.ok(foliage.size>=42&&foliage.size<=56);
    assert.equal(foliage.boughs.length,track.groups.length);
    for(const [index,bough]of foliage.boughs.entries()){
      assert.equal(bough.leaves.length+bough.hiddenCount,bough.events.length);
      assert.ok(bough.left>=31.99&&bough.left+bough.span<=width-31.99);
      if(index)assert.ok(bough.left>=foliage.boughs[index-1].left+foliage.boughs[index-1].span+11.99);
      for(const y of [28,90]){
        const leaves=bough.leaves.filter(leaf=>leaf.y===y);
        for(let i=1;i<leaves.length;i++)assert.ok(leaves[i].x-leaves[i-1].x>=foliage.size+7.99);
      }
    }
  }
});

test('desktop boughs show every portrait when space permits; narrow boughs retain accessible overflow',()=>{
  const tracks=overviewLayout(model,1028,1,today).tracks;
  for(const track of tracks)assert.equal(foliageLayout(track,1028).boughs.reduce((n,b)=>n+b.leaves.length,0),track.events.length);
  const dense={groups:[{key:'dense',x:300,events:Array.from({length:100},(_,i)=>({id:String(i),year:2000}))}]};
  const bough=foliageLayout(dense,640).boughs[0];
  assert.ok(bough.hiddenCount>0);assert.equal(bough.hiddenCount+bough.leaves.length,100);
});

test('dense years remain complete and separate at different widths; zoom reveals more individual years',()=>{
  for(const width of [350,640,1000,1600]){
    const fit=overviewLayout(model,width,1,today),zoomed=overviewLayout(model,width,4,today);
    const expected=model.events.map(e=>e.id).sort(),actual=fit.tracks.flatMap(t=>t.groups.flatMap(g=>g.events.map(e=>e.id))).sort();
    assert.deepEqual(actual,expected);
    assert.ok(zoomed.tracks.flatMap(t=>t.groups).length>=fit.tracks.flatMap(t=>t.groups).length);
    for(const track of fit.tracks){
      for(const [index,group] of track.groups.entries()){
        assert.ok(group.events.every(e=>e.year>=group.start&&e.year<=group.end));
        assert.ok(group.x>=0&&group.x<=fit.width);
        if(index)assert.ok(group.x-track.groups[index-1].x>=66-1e-8);
      }
    }
  }
});
