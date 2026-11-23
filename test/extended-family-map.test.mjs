import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, access} from 'node:fs/promises';
import {parseHTML} from 'linkedom';
import {extendedKehaHTML, shlomoKehaHTML, branchPortalHTML} from '../src/extended-keha.mjs';
import {nakashHTML} from '../src/nakash-shell.mjs';
import {frame, zoomAt, locatorBox} from '../public/keha-extended/atlas/cartography.mjs';

const dir=new URL('../public/keha-extended/atlas/',import.meta.url);
const json=name=>readFile(new URL(name,dir),'utf8').then(JSON.parse);
const [{places,sources,scans},regions,locators]=await Promise.all(['places.json','regions.json','locators.json'].map(json));

test('the family atlas is a native tab on the extended home only',async()=>{
  const original=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
  const {document}=parseHTML(extendedKehaHTML(original));
  assert.equal(document.querySelector('#mainNav [data-view="family-map"]').textContent,'מפת המשפחה');
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
  assert.ok(places.aden.items.filter(row=>row.group==='family').length>=3);
  assert.ok(places.sanaa.items.some(row=>row.group==='family') && places.sanaa.items.some(row=>row.group==='other'));
  assert.ok(places.taiz.items.some(row=>row.kind==='ביקור בדרך למצרים'));
});

test('national overview tracks the exact pan and zoom in each region',()=>{
  for(const [key,r] of Object.entries(regions)){
    const loc=key==='israel'?locators.israel:locators.yemen;
    const all=locatorBox(frame(),r.projection,loc),detail=locatorBox(zoomAt(frame(),2,.75,.25),r.projection,loc);
    assert.ok(all.x>=0&&all.y>=0&&all.x+all.w<=300&&all.y+all.h<=162,key);
    assert.equal(detail.w,all.w/2);
    assert.ok(Math.abs(detail.x-all.x-all.w*.375)<1e-8);
    assert.ok(Math.abs(detail.y-all.y-all.h*.125)<1e-8);
    const right=frame(6,1e4,-2);
    assert.equal(right.x+right.w,920);assert.equal(right.y,0);
  }
});
