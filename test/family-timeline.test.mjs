import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {familyTimeline,timelineDate,timelineDecade,timelineTracks,timelineGeneration,nearestTimelineYear} from '../public/assets/family-timeline-data.mjs';
import family from '../src/family.mjs';
import vm from 'node:vm';
import {browserHistory,navigationSource} from './helpers/browser-history.mjs';

const today=new Date(2026,10,11);
const people=[
  {...family.people.shlomo}, {...family.people.yona},
  {id:'thirties',name:'אחת',birthday:'31.12.1939'},
  {id:'forties',name:'שניים',birthday:'1.1.1940'},
  {id:'eighties',name:'שלוש',birthday:'29.2.1984'},
  {id:'recent',name:'ארבע',birthday:'1.2.2021'}
];

test('roots share one opening chapter, and every birth belongs to the decade of its actual year',()=>{
  const model=familyTimeline({people,today});
  assert.deepEqual(model.chapters[0].events.map(e=>[e.person.id,e.year]),[['shlomo',1907],['yona',1921]]);
  assert.deepEqual(model.chapters.map(c=>c.id),['before-1930','1930','1940','1950','1960','1970','1980','1990','2000','2010','2020']);
  assert.equal(model.birthCount,6);
  for(const [id,decade] of [['thirties','1930'],['forties','1940'],['eighties','1980'],['recent','2020']])assert.equal(model.chapters.find(c=>c.events.some(e=>e.person?.id===id&&e.kind==='birth')).id,decade);
  assert.equal(timelineDecade(1929),'before-1930');assert.equal(timelineDecade(2000),'2000');
});

test('immigration keeps the known month/year precision and an unknown wedding year is never invented',()=>{
  const model=familyTimeline({people,wedding:{id:'u-root',date:'',cover:'/actual-wedding'},today});
  const arrivals=model.events.filter(e=>e.kind==='aliyah');
  assert.deepEqual(arrivals.map(e=>[e.person.id,e.year,e.month,e.day,e.precision]),[['shlomo',1932,null,null,'year'],['yona',1934,12,null,'month']]);
  assert.equal(model.marriage,null);assert.ok(!model.events.some(e=>e.kind==='wedding'));
  assert.equal(model.chapters.find(c=>c.id==='1930').events.filter(e=>e.kind==='aliyah').length,2);
});

test('recorded wedding dates move into their chronological decade, including year-only dates',()=>{
  for(const [date,decade,precision] of [['12.8.1938','1930','day'],['1941','1940','year'],['1934-12','1930','month']]){
    const model=familyTimeline({people,wedding:{id:'u-root',date,cover:'/wedding'},today});
    assert.equal(model.marriage.precision,precision);
    assert.equal(model.chapters.find(c=>c.events.some(e=>e.kind==='wedding')).id,decade);
    assert.equal(model.marriage.wedding.cover,'/wedding');
  }
});

test('unrecorded, invalid, future and manual-only dates cannot turn into birthdays on the timeline',()=>{
  const invalid=[
    {id:'unset',birthday:'1.1.1111'}, {id:'bad-day',birthday:'31.2.1980'},
    {id:'invalid',birthday:'1.1.1970',invalidBirthday:true}, {id:'future',birthday:'12.11.2026'},
    {id:'future-year',birthday:'1.1.2030'}, {id:'friend',birthday:'1.1.1980',extra:true},
    {id:'extended',birthday:'1.1.1980',extended:true}, {id:'placeholder',birthday:'1.1.1111',placeholder:true}
  ];
  const model=familyTimeline({people:invalid,today});
  assert.equal(model.birthCount,0);assert.equal(model.events.length,0);
  assert.deepEqual(model.unknown.map(p=>p.id),['unset','bad-day','invalid','future','future-year']);
  assert.equal(timelineDate('29.2.1983'),null);assert.equal(timelineDate('1980-13'),null);
  assert.deepEqual(timelineDate('1984-02-29'),{year:1984,month:2,day:29,precision:'day'});
});

test('overlapping birth years stay with their family generation, and descendants share the fourth rail from 1988',()=>{
  const relatives=[
    {...family.people.shlomo},{...family.people.yona},
    {id:'child',generation:2,birthday:'1942'},
    {...family.people.orit,birthday:'1990'},
    {...family.people.amit,birthday:'1988'},
    {id:'same-year',generation:4,birthday:'1988'},
    {...family.people.rami,birthday:'2024'}
  ];
  const model=familyTimeline({people:relatives,wedding:{date:'1938'},today}),tracks=timelineTracks(model);
  assert.deepEqual(tracks.map(t=>t.generation),[1,2,3,4]);
  assert.deepEqual(tracks[2].events.map(e=>[e.person.id,e.year]),[['orit',1990]]);
  assert.equal(tracks[3].start,1988);
  assert.deepEqual(tracks[3].years,[1988,2024]);
  assert.deepEqual(tracks[3].events.filter(e=>e.year===1988).map(e=>e.person.id).sort(),['amit','same-year']);
  assert.equal(tracks[3].events.find(e=>e.person.id==='rami').year,2024);
  assert.equal(timelineGeneration(family.people.rami),4);
  assert.deepEqual(tracks[0].events.filter(e=>e.kind!=='birth').map(e=>e.kind),['aliyah','aliyah','wedding']);
  const births=tracks.flatMap(t=>t.events.filter(e=>e.kind==='birth').map(e=>e.person.id));
  assert.equal(births.length,model.birthCount);assert.equal(new Set(births).size,model.birthCount);
  assert.deepEqual(model.chapters.find(c=>c.id==='1980').events.filter(e=>e.kind==='birth').map(e=>e.person.id).sort(),['amit','same-year']);
  assert.deepEqual(model.chapters.find(c=>c.id==='1990').events.filter(e=>e.kind==='birth').map(e=>e.person.id),['orit']);
});

test('year jumps clamp to recorded events and empty generations remain usable',()=>{
  const years=[1988,1990,2004];
  for(const [target,expected] of [[1800,1988],[1989,1988],[1999,2004],[2100,2004]])assert.equal(nearestTimelineYear(years,target),expected);
  assert.equal(nearestTimelineYear([],1988),null);
  const tracks=timelineTracks(familyTimeline({today}));
  assert.ok(tracks.every(t=>t.years.length===0&&t.events.length===0&&t.end>t.start));
  assert.equal(tracks[3].start,1988);
});

test('back from a person or wedding returns to the timeline in phone and desktop history',async()=>{
  for(const phone of [false,true]){
    const browser=browserHistory('https://family.test/?lang=he#timeline'),window={location:browser.location,addEventListener:browser.addEventListener};
    vm.runInNewContext(navigationSource,{window,location:browser.location,history:browser.history,URL,matchMedia:()=>({matches:phone})});
    assert.equal(browser.location.hash,'#timeline');
    window.FamilyNavigation.go('#person/yona');browser.history.back();await browser.flush();assert.equal(browser.location.hash,'#timeline');
    window.FamilyNavigation.go('#weddings/u-root');browser.history.back();await browser.flush();assert.equal(browser.location.hash,'#timeline');
    browser.history.back();await browser.flush();assert.equal(browser.location.hash,phone?'#home':'#tree');
  }
});

test('the new page is wired into the shared navigation, search and phone home menu',async()=>{
  const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
  const app=await readFile(new URL('../public/assets/app.js',import.meta.url),'utf8');
  const home=await readFile(new URL('../public/assets/home.js',import.meta.url),'utf8');
  assert.match(html,/data-view="timeline"[^>]*>ציר זמן משפחתי/);
  assert.match(html,/id="timelineView"/);assert.match(html,/family-timeline\.js\?v=foliage-portraits-v6/);
  assert.match(app,/FamilyTimeline\?\.activate\(state.view\)/);assert.match(app,/FamilyTimeline\?\.search\(state.query\)/);
  assert.match(home,/\['timeline',I18n.t\('ציר זמן משפחתי'\)/);
});
