'use strict';
// This integration check runs on the Windows build runner, outside the installer.
const {app,BrowserWindow}=require('electron');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {showSavedWindow,captureState,writeState,readState}=require('./window-state.cjs');
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'keha-desktop-smoke-'));
app.setPath('userData',folder);
const waitFor=async predicate=>{for(let i=0;i<50;i++){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,100));}assert.ok(predicate(),'The native Windows window did not reach the requested state.');};
let win;
function create(){win=new BrowserWindow({show:false,width:1000,height:700,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true}});void win.loadURL('data:text/html,<title>Keha Family window verification</title>');}
app.whenReady().then(async()=>{
  const file=path.join(folder,'window.json'),displays=[{workArea:{x:0,y:0,width:1920,height:1080}}];
  create();showSavedWindow(win,readState(file,displays));await waitFor(()=>win.isMaximized());
  win.setFullScreen(true);await waitFor(()=>win.isFullScreen());
  writeState(file,captureState(win,true));win.destroy();
  create();showSavedWindow(win,readState(file,displays));await waitFor(()=>win.isFullScreen());
  win.setFullScreen(false);await waitFor(()=>!win.isFullScreen());win.unmaximize();await waitFor(()=>!win.isMaximized());
  writeState(file,captureState(win,false));assert.equal(readState(file,displays).maximized,false);assert.equal(readState(file,displays).fullscreen,false);
  win.destroy();console.log('Native Windows maximize, fullscreen and saved-state checks passed.');app.exit(0);
}).catch(error=>{console.error(error);if(win&&!win.isDestroyed())win.destroy();app.exit(1);});
