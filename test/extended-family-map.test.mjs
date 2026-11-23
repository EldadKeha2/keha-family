import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, access} from 'node:fs/promises';
import {parseHTML} from 'linkedom';
import {extendedKehaHTML, shlomoKehaHTML, branchPortalHTML} from '../src/extended-keha.mjs';
import {nakashHTML} from '../src/nakash-shell.mjs';
import {frame, zoomAt, locatorBox} from '../public/keha-extended/atlas/cartography.mjs';
import {walkEstimate} from '../public/keha-extended/atlas/walking.mjs';

const dir=new URL('../public/keha-extended/atlas/',import.meta.url);
const json=name=>readFile(new URL(name,dir),'utf8').then(JSON.parse);
const [{places,sources,scans},regions,locators]=await Promise.all(['places.json','regions.json','locators.json'].map(json));

test('the family atlas is a native tab on the extended home only',async()=>{
  const original=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
  const {document}=parseHTML(extendedKehaHTML(original));
  assert.equal(document.querySelector('#mainNav [data-view="family-map"]').textContent,'משפחת קהא על המפה');
  assert.ok(document.documentElement.dataset.nakashViews.split(' ').includes('family-map'));
  assert.ok(document.getElementById('familyMapView').hidden);
  for (const html of [original,shlomoKehaHTML(original),branchPortalHTML(original,'kehat'),nakashHTML(original,'keha')])
    assert.doesNotMatch(html,/familyMapView|data-view="family-map"|\/atlas\/atlas\.mjs/);
});

test('all map markers, geographic assets, public evidence and distance pairs resolve',async()=>{
  const seen=new Set(),coords=new Set();
  for (const [id,r] of Object.entries(regions)) {
    await Promise.all([id+'.webp',id+'-boundaries.svg'].map(f=>access(new URL(f,dir))));
    for (const m of r.markers) {
      assert.ok(places[m.to]&&r.ids.includes(m.to)); assert.ok(m.x>=0&&m.x<=920&&m.y>=0&&m.y<=550);
      if (m.pos) coords.add(m.id);
      seen.add(m.to);
    }
    assert.deepEqual(new Set(r.ids),new Set(r.markers.map(m=>m.to)));
  }
  for (const r of Object.values(regions)) for (const pair of r.distances) assert.ok(pair.every(id=>coords.has(id)));
  assert.deepEqual(seen,new Set(Object.keys(places)));
  for (const r of Object.values(places)) {
    for (const item of r.items) {assert.ok(item.sources.length);assert.ok(item.sources.every(id=>sources[id]));}
    if(r.georef)assert.ok(sources[r.georef]);
    for (const photo of r.scans||[]) {assert.ok(sources[scans[photo].source]);await access(new URL(photo+'.webp',dir));}
  }
  for (const src of Object.values(sources)) if(src.url) assert.match(src.url,/^(https:\/\/(?!chatgpt\.com\/)|\/keha-extended\/)/);
  assert.ok(places.aden.items.some(row=>row.kind==='לידה'));
  assert.ok(places.aden.items.some(row=>row.kind==='תחנת מעבר'));
  assert.ok(places.sanaa.items.every(row=>row.group==='other'));
  assert.deepEqual(regions.yemen.markers.find(m=>m.to==='sanaa').tags,['other']);
  assert.ok(!regions.yemen.ids.includes('taiz'));
  assert.doesNotMatch(JSON.stringify({places,sources,scans}),/נקאש|שבזי|עבודת השורשים של תמי/);
});

test('national overview tracks the exact pan and zoom in each region',()=>{
  for(const [key,r] of Object.entries(regions)){
    const loc=key==='israel'?locators.israel:locators.yemen;
    const all=locatorBox(frame(),r.projection,loc),detail=locatorBox(zoomAt(frame(),2,.75,.25),r.projection,loc);
    assert.ok(all.x>=0&&all.y>=0&&all.x+all.w<=300&&all.y+all.h<=162,key);
    assert.equal(detail.w,all.w/2);
    assert.ok(Math.abs(detail.x-all.x-all.w*.375)<1e-8);
    if (r.projection.north === undefined) {
      assert.ok(Math.abs(detail.y-all.y-all.h*.125)<1e-8);
    } else {
      const latitude=r.projection.north+(r.projection.south-r.projection.north)*.125;
      const ordinate=Math.log(Math.tan((90+latitude)*Math.PI/360))*180/Math.PI;
      assert.ok(Math.abs(detail.y-(loc.top-ordinate)*300/loc.span)<1e-8);
    }
    const right=frame(6,1e4,-2);
    assert.equal(right.x+right.w,920);assert.equal(right.y,0);
  }
});

test('family index links only supported places and preserves differing evidence for siblings',async()=>{
  const people=await json('people.json');
  for(const p of Object.values(people)){
    assert.ok(p.sources.length && p.sources.every(k=>sources[k]));
    for(const [region,id,kind,note] of p.places){assert.ok(regions[region].ids.includes(id));assert.ok(kind&&note);}
    assert.ok((p.related||[]).every(k=>people[k]));
  }
  assert.deepEqual(people.rumia.places.map(row=>row[1]),['aden']);
  assert.ok(people.rashid.places.some(row=>row[1]==='khawlan'));
  assert.deepEqual(people.badra.places,[]);
  assert.deepEqual(people['musa-jimaan'].places,[]);
  assert.doesNotMatch(JSON.stringify(people),/נקאש|chatgpt\.com/);
  const markers=regions.base.markers;
  assert.equal(markers.filter(m=>m.pos).length,22);
  assert.deepEqual(markers.filter(m=>m.letter).map(m=>m.to),['saada','sharmat','khawlan']);
  assert.notEqual(markers.find(m=>m.id==='modernSh').to,'sharmat');
  const guide=await json('regional-guide.json');
  assert.equal(guide.districts.length,15);
  assert.ok(guide.areas.every(area=>area.sources.length&&area.sources.every(k=>sources[k])));
  for(const name of ['saada-districts.svg','saada-family-atlas.pdf','saada-family-map.jpg'])await access(new URL(name,dir));
});

test('walking estimates cover every pair, reverse ascent and explain missing road coverage',async()=>{
  const walking=await json('walking.json'), ids=Object.keys(walking.places);
  assert.deepEqual(new Set(ids),new Set(regions.base.markers.filter(m=>m.pos).map(m=>m.id)));
  assert.equal(Object.keys(walking.pairs).length,231);
  assert.equal(Object.values(walking.pairs).filter(p=>p.road).length,105);
  assert.equal(walkEstimate(walking,'saada','saada'),null);
  for(const [i,a] of ids.entries())for(const b of ids.slice(i+1)){
    const ab=walkEstimate(walking,a,b),ba=walkEstimate(walking,b,a),terrain=walkEstimate(walking,a,b,'terrain');
    assert.equal(ab.route.km,ba.route.km);assert.equal(ab.up+ba.up,ab.route.up+ab.route.down);
    assert.ok(ab.lo<=ab.hi&&ab.lo>0);assert.equal(terrain.mode,'terrain');
    assert.ok(ab.route.path.startsWith('M')&&terrain.route.path.startsWith('M'));
  }
  const trip=walkEstimate(walking,'saada','haydan');
  assert.equal(trip.mode,'road');assert.equal(Math.round(trip.route.km),67);assert.deepEqual([trip.lo,trip.hi],[19,25]);
});
