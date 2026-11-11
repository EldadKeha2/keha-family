import {test} from 'node:test';
import assert from 'node:assert/strict';
import {enchantedTreeLayout,enchantedCohortLayout,treeBoughPaths} from '../public/assets/family-timeline-tree.mjs';

const counts=[2,2,7,4,4,4,20,6,5,13,15];
const chapters=counts.map((count,index)=>({id:index?String(1920+index*10):'before-1930',events:Array.from({length:count},(_,n)=>({id:`${index}-${n}`,kind:'birth',year:1907+index*10+n%10,person:{id:`person-${index}-${n}`}}))}));

test('every birth has its own place on a branch, with oldest decades near the roots',()=>{
  const layout=enchantedTreeLayout(chapters);
  assert.equal(layout.people.length,82);assert.equal(new Set(layout.people.map(p=>p.event.person.id)).size,82);
  assert.equal(layout.decades.length,11);
  for(const p of layout.people){
    assert.ok(p.x>50&&p.x<layout.width-50);assert.ok(p.y>30&&p.y<layout.height-80);
    assert.equal(p.branchY-p.y,35);
  }
  const oldest=layout.people.filter(p=>p.decade===chapters[0].id),newest=layout.people.filter(p=>p.decade===chapters.at(-1).id);
  assert.ok(Math.min(...oldest.map(p=>p.y))>Math.max(...newest.map(p=>p.y)));
  for(let i=0;i<layout.people.length;i++)for(let j=i+1;j<layout.people.length;j++){
    const a=layout.people[i],b=layout.people[j];assert.ok(Math.abs(a.x-b.x)>=72||Math.abs(a.y-b.y)>=80,`${a.event.id} overlaps ${b.event.id}`);
  }
});

test('a dense decade keeps every person in the phone tree with room for touch targets',()=>{
  const chapter=chapters.find(c=>c.events.length===20),layout=enchantedCohortLayout(chapter);
  assert.equal(layout.people.length,20);assert.equal(layout.boughs.length,4);
  assert.deepEqual(layout.people.map(p=>p.event.id),chapter.events.map(e=>e.id));
  for(const p of layout.people){assert.ok(p.x>=44&&p.x<=layout.width-44);assert.ok(p.y>=60&&p.y<=layout.height-80);}
  for(let i=0;i<layout.people.length;i++)for(let j=i+1;j<layout.people.length;j++){
    const a=layout.people[i],b=layout.people[j];assert.ok(Math.abs(a.x-b.x)>=64||Math.abs(a.y-b.y)>=78);
  }
  assert.ok(enchantedCohortLayout(chapters[0]).people.every(p=>p.y>450));
});

test('an empty decade remains selectable and decorative branch SVG carries no links or invented faces',()=>{
  const chapter={id:'1950',events:[{kind:'aliyah',year:1951}]},layout=enchantedTreeLayout([chapter]);
  assert.equal(layout.people.length,0);assert.equal(layout.decades[0].count,0);
  assert.equal(enchantedCohortLayout(chapter).people.length,0);
  const svg=treeBoughPaths(layout,'qa','1950');assert.match(svg,/aria-hidden="true"/);assert.match(svg,/is-lit/);
  assert.doesNotMatch(svg,/<(?:a|image)\b/);
});
