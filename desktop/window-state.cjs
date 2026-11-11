'use strict';
const fs = require('node:fs');
const path = require('node:path');

const SITE_ORIGIN = 'https://keha-family.eldadkeha.workers.dev';
const SITE_HOME = SITE_ORIGIN + '/?source=windows-app#home';

function trustedSite(value) {
  try { const url = new URL(value); return url.origin === SITE_ORIGIN && !url.username && !url.password; }
  catch { return false; }
}

function externalLink(value) {
  try {
    const url = new URL(value);
    if (url.username || url.password) return null;
    if (url.protocol === 'mailto:') return url.href;
    if (url.protocol !== 'https:') return null;
    const hosts = ['youtube.com','youtu.be','vimeo.com','facebook.com','messenger.com','instagram.com','wa.me','whatsapp.com','google.com','github.com'];
    return trustedSite(url.href) || hosts.some(host => url.hostname === host || url.hostname.endsWith('.' + host)) ? url.href : null;
  } catch { return null; }
}

function normalizeState(value, displays) {
  const areas = displays.map(display => display.workArea);
  const primary = areas[0];
  const old = value?.bounds;
  const valid = old && ['x','y','width','height'].every(key => Number.isFinite(old[key])) && old.width > 0 && old.height > 0;
  const area = valid && areas.find(a => Math.min(a.x+a.width,old.x+old.width)-Math.max(a.x,old.x)>=100 && Math.min(a.y+a.height,old.y+old.height)-Math.max(a.y,old.y)>=100) || primary;
  const width = Math.round(Math.min(area.width, Math.max(Math.min(760,area.width), valid ? old.width : 1200)));
  const height = Math.round(Math.min(area.height, Math.max(Math.min(480,area.height), valid ? old.height : 800)));
  const x = Math.round(Math.max(area.x, Math.min(area.x+area.width-width, valid && area!==primary ? old.x : valid && area===areas.find(a=>old.x>=a.x && old.x<a.x+a.width) ? old.x : area.x+(area.width-width)/2)));
  const y = Math.round(Math.max(area.y, Math.min(area.y+area.height-height, valid && old.y>=area.y && old.y<area.y+area.height ? old.y : area.y+(area.height-height)/2)));
  return {version:1, bounds:{x,y,width,height}, maximized:typeof value?.maximized==='boolean'?value.maximized:true, fullscreen:value?.fullscreen===true};
}

function readState(filename, displays) {
  let value;
  try { value = JSON.parse(fs.readFileSync(filename,'utf8')); } catch {}
  return normalizeState(value, displays);
}

function writeState(filename, state) {
  const temporary = filename + '.tmp';
  fs.mkdirSync(path.dirname(filename), {recursive:true});
  fs.writeFileSync(temporary, JSON.stringify(state), {mode:0o600});
  fs.renameSync(temporary, filename);
}

function showSavedWindow(win, state) {
  if (state.maximized) win.maximize();
  if (state.fullscreen) win.setFullScreen(true);
  win.show();
}

function captureState(win, maximizedBeforeFullscreen) {
  return {version:1, bounds:win.getNormalBounds(), maximized:win.isFullScreen()?maximizedBeforeFullscreen:win.isMaximized(), fullscreen:win.isFullScreen()};
}

module.exports = {SITE_ORIGIN,SITE_HOME,trustedSite,externalLink,normalizeState,readState,writeState,showSavedWindow,captureState};
