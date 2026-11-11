import {test} from 'node:test';
import assert from 'node:assert/strict';
import {bindTimelinePan} from '../public/assets/family-timeline-pan.mjs';
import {nearestTimelineYear} from '../public/assets/family-timeline-data.mjs';

function harness(){
  const listeners=new Map(),selected=new Map([[1,1907],[4,1988]]),moves=[],pending=new Map();let timer=0;
  const tracks=new Map([[1,{start:1900,years:[1907,1921,1932,1934]}],[4,{start:1988,years:[1988,1992,2024]}]]);
  const viewports=new Map([...tracks.keys()].map(g=>{
    const classes=new Set(),capture=new Set(),world={style:{}};
    const viewport={clientWidth:800,classList:{add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c)},
      closest:s=>s==='.ft-rail-viewport'?viewport:s==='[data-rail]'?{dataset:{rail:String(g)}}:null,
      querySelector:()=>world,setPointerCapture:id=>capture.add(id),hasPointerCapture:id=>capture.has(id),releasePointerCapture:id=>capture.delete(id)};
    return [g,viewport];
  }));
  const root={addEventListener:(type,handler)=>{if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(handler);}};
  const timers={setTimeout:fn=>{pending.set(++timer,fn);return timer;},clearTimeout:id=>pending.delete(id)};
  bindTimelinePan(root,{getTrack:g=>tracks.get(g),getYear:g=>selected.get(g),pixelsPerYear:64,timers,
    moveYear:(g,target,options={})=>{selected.set(g,nearestTimelineYear(tracks.get(g).years,target));moves.push({g,target,...options});}});
  function emit(type,overrides={}){
    const event={target:viewports.get(1),pointerId:1,pointerType:'mouse',isPrimary:true,button:0,clientX:400,clientY:80,detail:1,deltaX:0,deltaY:0,deltaMode:0,
      preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;},...overrides};
    for(const handler of listeners.get(type)||[])handler(event);return event;
  }
  return {emit,viewports,selected,moves,flush(){for(const [id,fn] of pending){pending.delete(id);fn();}}};
}

test('mouse drag moves the rail continuously, snaps across sparse years and keeps the other generation in place',()=>{
  const h=harness(),v=h.viewports.get(1);
  h.emit('pointerdown');const move=h.emit('pointermove',{clientX:200});
  assert.equal(move.prevented,true);assert.equal(v.classList.contains('is-dragging'),true);
  assert.equal(v.querySelector().style.transform,'translateX(-648px)');
  h.emit('pointerup',{clientX:200});
  assert.equal(h.selected.get(1),1921);assert.equal(h.selected.get(4),1988);
  assert.equal(v.classList.contains('is-dragging'),false);assert.equal(v.hasPointerCapture(1),false);
  const click=h.emit('click');assert.equal(click.prevented,true);assert.equal(click.stopped,true);
  h.emit('pointerdown');h.emit('pointerup');assert.equal(h.emit('click').prevented,undefined);
  h.emit('pointerdown',{clientX:200});h.emit('pointermove',{clientX:400});h.emit('pointerup',{clientX:400});
  assert.equal(h.selected.get(1),1907);
});

test('touch panning works both ways while vertical swipes, taps, cancellation and extra fingers stay safe',()=>{
  const h=harness(),v=h.viewports.get(4),touch={target:v,pointerType:'touch'};
  h.emit('pointerdown',touch);
  assert.equal(h.emit('pointermove',{...touch,clientX:395,clientY:150}).prevented,undefined);
  h.emit('pointerup',touch);assert.equal(h.moves.length,0);
  h.emit('pointerdown',touch);h.emit('pointerup',touch);assert.equal(h.emit('click',{target:v}).prevented,undefined);
  h.emit('pointerdown',touch);h.emit('pointermove',{...touch,clientX:250});h.emit('pointerup',touch);
  assert.equal(h.selected.get(4),1992);
  h.emit('pointerdown',touch);h.emit('pointermove',{...touch,clientX:550});h.emit('pointerup',touch);
  assert.equal(h.selected.get(4),1988);
  h.emit('pointerdown',touch);h.emit('pointermove',{...touch,clientX:5000});h.emit('pointerup',touch);
  assert.equal(h.selected.get(4),1988);
  h.emit('pointerdown',touch);h.emit('pointermove',{...touch,clientX:350});h.emit('pointercancel',touch);
  assert.equal(h.selected.get(4),1988);assert.equal(v.classList.contains('is-dragging'),false);
  h.emit('pointerdown',touch);h.emit('pointermove',{...touch,clientX:350});h.emit('pointerdown',{...touch,pointerId:2,isPrimary:false});
  assert.equal(v.classList.contains('is-dragging'),false);assert.equal(h.selected.get(4),1988);
});

test('horizontal trackpad scrolling pans and settles; vertical scroll and pinch zoom pass through',()=>{
  const h=harness();
  assert.equal(h.emit('wheel',{deltaY:120}).prevented,undefined);
  assert.equal(h.emit('wheel',{deltaX:100,deltaY:0,ctrlKey:true}).prevented,undefined);
  assert.equal(h.emit('wheel',{deltaX:120}).prevented,true);
  assert.equal(h.moves.at(-1).scrubbing,true);h.flush();assert.equal(h.selected.get(1),1921);
  h.emit('wheel',{deltaY:-120,shiftKey:true});h.flush();assert.equal(h.selected.get(1),1907);
  h.emit('wheel',{target:h.viewports.get(4),deltaX:4,deltaMode:2});h.flush();assert.equal(h.selected.get(4),2024);
});

test('an overflowing same-year portrait list can still be dragged to reach every person',()=>{
  const h=harness(),v=h.viewports.get(1),list={scrollWidth:600,clientWidth:200,scrollLeft:0};
  const target={closest:s=>s==='[data-rail-focus]'?list:v.closest(s)};
  h.emit('pointerdown',{target});h.emit('pointermove',{target,clientX:550});h.emit('pointerup',{target});
  assert.equal(list.scrollLeft,-150);assert.equal(h.moves.length,0);
  assert.equal(h.emit('click',{target}).prevented,true);
  assert.equal(h.emit('wheel',{target,deltaX:100}).prevented,undefined);
});
