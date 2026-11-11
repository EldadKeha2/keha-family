'use strict';
const {app,BrowserWindow,Menu,screen,shell,session} = require('electron');
const path = require('node:path');
const {SITE_HOME,trustedSite,externalLink,readState,writeState,showSavedWindow,captureState} = require('./window-state.cjs');

let mainWindow;
app.setName('בית משפחת קהא');
app.setAppUserModelId('com.eldadkeha.family');
app.enableSandbox();

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();mainWindow.focus();
  });
  app.whenReady().then(createWindow);
  app.on('window-all-closed', () => app.quit());
}

function createWindow() {
  const displays = [screen.getPrimaryDisplay(), ...screen.getAllDisplays().filter(display=>display.id!==screen.getPrimaryDisplay().id)];
  const filename = path.join(app.getPath('userData'),'window-state.json');
  const saved = readState(filename, displays);
  let maximizedBeforeFullscreen = saved.maximized, saveTimer, shown = false;
  const browserSession = session.fromPartition('persist:keha-family');
  browserSession.setUserAgent(browserSession.getUserAgent() + ' KehaFamilyDesktop/' + app.getVersion());
  browserSession.setPermissionCheckHandler((contents,permission,origin) => trustedSite(origin) && ['fullscreen','clipboard-sanitized-write'].includes(permission));
  browserSession.setPermissionRequestHandler((contents,permission,callback,details) => {
    callback(trustedSite(details.requestingUrl || contents.getURL()) && ['fullscreen','clipboard-sanitized-write'].includes(permission));
  });
  const win = mainWindow = new BrowserWindow({
    ...saved.bounds, show:false, backgroundColor:'#f7f3e9', title:'בית משפחת קהא',
    icon:path.join(app.getAppPath(),'icon.png'), autoHideMenuBar:true,
    minWidth:Math.min(760,displays[0].workArea.width), minHeight:Math.min(480,displays[0].workArea.height),
    webPreferences:{session:browserSession,nodeIntegration:false,nodeIntegrationInWorker:false,nodeIntegrationInSubFrames:false,contextIsolation:true,sandbox:true,webSecurity:true,allowRunningInsecureContent:false,webviewTag:false}
  });
  function show() { if (!shown && !win.isDestroyed()) { shown=true;showSavedWindow(win,saved); } }
  function persist() {
    if (win.isDestroyed()) return;
    try { writeState(filename,captureState(win,maximizedBeforeFullscreen)); } catch { /* A read-only user profile must not stop the app opening. */ }
  }
  function scheduleSave() { clearTimeout(saveTimer);saveTimer=setTimeout(persist,200); }
  function reload() { if (trustedSite(win.webContents.getURL())) win.webContents.reload(); else void win.loadURL(SITE_HOME); }
  function openExternal(value) { const target=externalLink(value);if(target)void shell.openExternal(target).catch(()=>{}); }
  win.once('ready-to-show',show);
  const showTimer=setTimeout(show,8000);
  win.on('maximize',()=>{maximizedBeforeFullscreen=true;scheduleSave();});
  win.on('unmaximize',()=>{if(!win.isFullScreen())maximizedBeforeFullscreen=false;scheduleSave();});
  for (const event of ['resize','move','enter-full-screen','leave-full-screen']) win.on(event,scheduleSave);
  win.on('close',()=>{clearTimeout(saveTimer);persist();});
  win.on('closed',()=>{clearTimeout(showTimer);clearTimeout(saveTimer);mainWindow=null;});
  win.webContents.setWindowOpenHandler(({url})=>{openExternal(url);return {action:'deny'};});
  win.webContents.on('will-navigate',(event,url)=>{if(!trustedSite(url)){event.preventDefault();openExternal(url);}});
  win.webContents.on('will-redirect',(event,url)=>{if(!trustedSite(url))event.preventDefault();});
  win.webContents.on('will-attach-webview',event=>event.preventDefault());
  win.webContents.on('did-fail-load',(_event,code,_description,_url,isMainFrame)=>{
    if (isMainFrame && code!==-3 && !win.isDestroyed()) void win.loadFile(path.join(app.getAppPath(),'offline.html')).then(show).catch(show);
  });
  win.webContents.on('render-process-gone',()=>{if(!win.isDestroyed())void win.loadFile(path.join(app.getAppPath(),'offline.html')).then(show).catch(show);});
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {label:'בית משפחת קהא',submenu:[
      {label:'הבית / Home',accelerator:'Alt+Home',click:()=>{void win.loadURL(SITE_HOME);}},
      {label:'רענון / Reload',accelerator:'CmdOrCtrl+R',click:reload},
      {type:'separator'},
      {label:'הגדלת החלון / Maximize',click:()=>{win.setFullScreen(false);win.maximize();}},
      {label:'מסך מלא / Full screen',accelerator:'F11',click:()=>win.setFullScreen(!win.isFullScreen())},
      {type:'separator'},
      {label:'פתיחה בדפדפן / Open in browser',click:()=>openExternal(SITE_HOME)},
      {role:'quit',label:'סגירה / Quit'}
    ]},
    {label:'עריכה / Edit',submenu:[{role:'undo'},{role:'redo'},{type:'separator'},{role:'cut'},{role:'copy'},{role:'paste'},{role:'selectAll'}]},
    {label:'תצוגה / View',submenu:[{role:'zoomIn'},{role:'zoomOut'},{role:'resetZoom'}]}
  ]));
  void win.loadURL(SITE_HOME).catch(()=>{});
}
