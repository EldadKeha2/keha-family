import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import state from '../desktop/window-state.cjs';

const displays=[{workArea:{x:0,y:0,width:1920,height:1040}},{workArea:{x:-1280,y:0,width:1280,height:984}}];

test('Windows opens maximized on first launch and restores the saved normal, maximized and fullscreen states',()=>{
  const folder=mkdtempSync(path.join(tmpdir(),'keha-window-')),filename=path.join(folder,'window.json');
  try {
    const first=state.readState(filename,displays);assert.equal(first.maximized,true);assert.equal(first.fullscreen,false);
    const calls=[],win={maximize:()=>calls.push('maximize'),setFullScreen:value=>calls.push(['fullscreen',value]),show:()=>calls.push('show')};
    state.showSavedWindow(win,first);assert.deepEqual(calls,['maximize','show']);
    for(const mode of [{maximized:false,fullscreen:false},{maximized:true,fullscreen:false},{maximized:true,fullscreen:true}]){
      const wanted={version:1,bounds:{x:100,y:60,width:1100,height:750},...mode};
      state.writeState(filename,wanted);assert.deepEqual(state.readState(filename,displays),wanted);
    }
    calls.length=0;state.showSavedWindow(win,{maximized:true,fullscreen:true});assert.deepEqual(calls,['maximize',['fullscreen',true],'show']);
    writeFileSync(filename,'broken json');assert.equal(state.readState(filename,displays).maximized,true);
  } finally {rmSync(folder,{recursive:true,force:true});}
});

test('a disconnected monitor and corrupt window bounds cannot strand the app off-screen',()=>{
  const secondary=state.normalizeState({bounds:{x:-1200,y:40,width:1000,height:700},maximized:false},displays);
  assert.deepEqual(secondary.bounds,{x:-1200,y:40,width:1000,height:700});
  const moved=state.normalizeState(secondary,[displays[0]]);assert.ok(moved.bounds.x>=0);assert.ok(moved.bounds.x+moved.bounds.width<=1920);
  for(const bounds of [{x:NaN,y:5,width:Infinity,height:-5},{x:90000,y:90000,width:90000,height:90000},{x:0,y:0,width:1,height:1}]){
    const restored=state.normalizeState({bounds},[displays[0]]).bounds;
    assert.ok(restored.width>=760&&restored.width<=1920);assert.ok(restored.height>=480&&restored.height<=1040);
    assert.ok(restored.x>=0&&restored.y>=0);assert.ok(restored.x+restored.width<=1920&&restored.y+restored.height<=1040);
  }
});

test('fullscreen persistence retains the preceding maximized state and captures normal bounds',()=>{
  const win={getNormalBounds:()=>({x:50,y:50,width:1000,height:700}),isFullScreen:()=>true,isMaximized:()=>false};
  const captured=state.captureState(win,true);assert.equal(captured.maximized,true);assert.equal(captured.fullscreen,true);assert.equal(captured.bounds.width,1000);
});

test('desktop navigation permits only the actual family origin and safe external destinations',()=>{
  assert.equal(state.trustedSite(state.SITE_HOME),true);
  for(const url of ['https://keha-family.eldadkeha.workers.dev.evil.test/','https://evil.test/?next='+state.SITE_HOME,'http://keha-family.eldadkeha.workers.dev/','file:///C:/Windows/','javascript:alert(1)','https://user:password@keha-family.eldadkeha.workers.dev/'])assert.equal(state.trustedSite(url),false);
  assert.equal(state.externalLink('https://www.youtube.com/watch?v=family'),'https://www.youtube.com/watch?v=family');
  for(const url of ['file:///C:/Windows/','javascript:alert(1)','ms-settings:','https://youtube.com.evil.test/','https://user:password@youtube.com/'])assert.equal(state.externalLink(url),null);
});
