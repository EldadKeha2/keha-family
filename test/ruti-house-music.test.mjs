import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRutiSong,RUTI_SONG_VIDEO_ID,RUTI_SONG_ORIGIN} from '../public/assets/ruti-house-music.mjs';

function fixture({english=false}={}){
 const frames=[],posts=[],messages=new Set();
 const win={location:{origin:'https://family.example'},addEventListener(type,fn){if(type==='message')messages.add(fn);},removeEventListener(type,fn){if(type==='message')messages.delete(fn);}};
 function container(){return {children:[],appendChild(frame){frame.parentNode?.children.splice(frame.parentNode.children.indexOf(frame),1);this.children.push(frame);frame.parentNode=this;}};}
 const doc={createElement(tag){assert.equal(tag,'iframe');const listeners=new Map();const frame={style:{},parentNode:null,contentWindow:{postMessage(value,origin){posts.push({frame,data:JSON.parse(value),origin});}},addEventListener(type,fn){listeners.set(type,fn);},removeEventListener(type,fn){if(listeners.get(type)===fn)listeners.delete(type);},remove(){if(this.parentNode){this.parentNode.children.splice(this.parentNode.children.indexOf(this),1);this.parentNode=null;}},load(){listeners.get('load')?.();},get lateLoad(){return listeners.get('load');}};frames.push(frame);return frame;}};
 const song=createRutiSong({english:()=>english,window:win,document:doc});
 const emit=(data,{origin=RUTI_SONG_ORIGIN,source=frames.at(-1)?.contentWindow}={})=>{for(const fn of [...messages])fn({origin,source,data});};
 return {song,frames,posts,messages,container,emit,functions:()=>posts.map(p=>p.data.func).filter(Boolean)};
}

test('the requested song uses one visible official player with looping, controls and the current origin',()=>{
 for(const english of [false,true]){
  const f=fixture({english}),parent=f.container();assert.equal(f.song.mount(parent),true);const frame=f.frames[0],url=new URL(frame.src);
  assert.equal(url.origin,RUTI_SONG_ORIGIN);assert.equal(url.pathname,`/embed/${RUTI_SONG_VIDEO_ID}`);
  for(const key of ['enablejsapi','autoplay','loop','playsinline','controls'])assert.equal(url.searchParams.get(key),'1');
  assert.equal(url.searchParams.get('playlist'),RUTI_SONG_VIDEO_ID);assert.equal(url.searchParams.get('origin'),'https://family.example');
  assert.equal(frame.style.minWidth,'200px');assert.equal(frame.style.minHeight,'200px');assert.match(frame.allow,/autoplay/);assert.equal(frame.referrerPolicy,'strict-origin-when-cross-origin');
  assert.match(frame.title,english?/Zion Golan/:/ציון גולן/);
  f.song.mount(parent);f.song.mount(parent);assert.equal(f.frames.length,1);assert.equal(parent.children.length,1);assert.equal(f.messages.size,1);
  assert.ok(f.posts.every(p=>p.origin===RUTI_SONG_ORIGIN));
 }
});

test('pause and mute take effect before or after readiness without recreating or rewinding the player',()=>{
 const f=fixture(),parent=f.container();f.song.mount(parent);const frame=f.frames[0];
 f.song.pause();assert.equal(f.functions().at(-1),'pauseVideo');
 frame.load();f.emit({event:'onReady'});assert.equal(f.functions().at(-1),'pauseVideo');
 f.song.mount(parent,{enabled:true,paused:false});assert.deepEqual(f.functions().slice(-2),['unMute','playVideo']);
 f.song.setEnabled(false);assert.deepEqual(f.functions().slice(-2),['pauseVideo','mute']);
 f.emit({event:'onStateChange',info:1});assert.deepEqual(f.functions().slice(-2),['pauseVideo','mute']);
 f.song.pause();f.song.setEnabled(true);assert.equal(f.functions().at(-1),'pauseVideo','unmuting while paused cannot resume playback');
 f.song.mount(parent,{enabled:true,paused:false});assert.deepEqual(f.functions().slice(-2),['unMute','playVideo']);assert.equal(f.frames.length,1);
 f.song.stop();assert.equal(parent.children.length,0);assert.equal(f.messages.size,0);
});

test('muted or paused initial mounts disable autoplay, and a late load keeps them quiet',()=>{
 for(const options of [{enabled:false},{paused:true}]){
  const f=fixture();f.song.mount(f.container(),options);assert.equal(new URL(f.frames[0].src).searchParams.get('autoplay'),'0');
  f.frames[0].load();f.emit({event:'onReady'});assert.ok(!f.functions().includes('playVideo'));
 }
});

test('player time accepts only trusted messages from the mounted iframe and resets when the celebration ends',()=>{
 const f=fixture();f.song.mount(f.container());assert.equal(f.song.time(),null);
 f.emit({event:'infoDelivery',info:{currentTime:12}},{origin:'https://other.example'});assert.equal(f.song.time(),null);
 f.emit({event:'infoDelivery',info:{currentTime:12}},{source:{}});assert.equal(f.song.time(),null);
 f.emit('invalid-json');f.emit(null);f.emit({event:'unrelated',info:{currentTime:12}});assert.equal(f.song.time(),null);
 f.emit(JSON.stringify({event:'infoDelivery',info:{currentTime:12.5}}));assert.equal(f.song.time(),12.5);
 for(const value of ['13',-1,Infinity,NaN])f.emit({event:'infoDelivery',info:{currentTime:value}});
 assert.equal(f.song.time(),12.5);f.song.pause();assert.equal(f.song.time(),12.5);
 f.song.stop();assert.equal(f.song.time(),null);f.emit({event:'infoDelivery',info:{currentTime:20}});assert.equal(f.song.time(),null);
});

test('Next removes the player and stale load callbacks cannot restart it or a newer celebration',()=>{
 const f=fixture(),parent=f.container();f.song.mount(parent);const old=f.frames[0],lateLoad=old.lateLoad;
 f.song.stop();assert.deepEqual(f.functions().slice(-2),['pauseVideo','stopVideo']);const stoppedPosts=f.posts.length;lateLoad();assert.equal(f.posts.length,stoppedPosts);
 f.song.mount(parent);const current=f.frames[1],newPosts=f.posts.length;lateLoad();assert.equal(f.posts.length,newPosts);
 f.emit({event:'onReady'},{source:old.contentWindow});assert.equal(f.posts.length,newPosts);
 current.load();assert.ok(f.posts.slice(newPosts).every(p=>p.frame===current));assert.equal(parent.children.length,1);
});

test('readiness retries are bounded and use game time without background timers',()=>{
 const f=fixture();f.song.mount(f.container());f.posts.length=0;
 for(let i=0;i<500;i++)f.song.update(i/10);
 assert.equal(f.posts.filter(p=>p.data.event==='listening').length,10);
 const before=f.posts.length;f.song.update(Infinity);f.song.update(NaN);assert.equal(f.posts.length,before);
 f.emit({event:'onReady'});const after=f.posts.length;f.song.update(100);assert.equal(f.posts.length,after);
 f.song.stop();f.song.update(200);assert.equal(f.posts.length,after+2);
});

test('a missing browser environment leaves the game usable',()=>{
 const song=createRutiSong({window:null,document:null});assert.equal(song.mount({}),false);song.pause();song.setEnabled(false);song.update(10);song.stop();assert.equal(song.time(),null);
});
