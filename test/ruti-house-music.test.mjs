import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRutiSong,RUTI_SONG_SOURCE} from '../public/assets/ruti-house-music.mjs';

function fixture({src='/test-song.mp3',random=()=>.5,blocked=false,deferred=false}={}){
 const audios=[],pending=[];
 class Audio{
  constructor(){this.listeners=new Map();this.duration=NaN;this.currentTime=0;this.paused=true;this.readyState=0;this.loads=0;this.plays=0;this.pauses=0;audios.push(this);}
  addEventListener(type,fn){this.listeners.set(type,fn);}
  removeEventListener(type,fn){if(this.listeners.get(type)===fn)this.listeners.delete(type);}
  load(){this.loads++;}
  pause(){this.paused=true;this.pauses++;}
  play(){this.plays++;if(blocked)return Promise.reject(Error('Autoplay blocked'));if(deferred)return new Promise(resolve=>pending.push(()=>{this.paused=false;resolve();}));this.paused=false;return Promise.resolve();}
  removeAttribute(name){if(name==='src')this.src='';}
  metadata(duration){this.duration=duration;this.readyState=1;this.listeners.get('loadedmetadata')?.();}
  error(){this.listeners.get('error')?.();}
 }
 const song=createRutiSong({src,random,Audio,document:null});
 return {song,audios,pending,flush:()=>new Promise(resolve=>setImmediate(resolve))};
}

test('no configured song makes no request, creates no player UI and stays silent',()=>{
 assert.equal(RUTI_SONG_SOURCE,null);const f=fixture({src:null});assert.equal(f.song.mount(null),false);
 f.song.setEnabled(true);f.song.update(1);assert.equal(f.audios.length,0);assert.equal(f.song.time(),null);
 f.song.pause();f.song.stop();
});

test('the audio-only song starts at a random position after metadata and loops without controls',async()=>{
 const f=fixture();assert.equal(f.song.mount(null),true);const audio=f.audios[0];
 assert.equal(audio.src,'/test-song.mp3');assert.equal(audio.preload,'metadata');assert.equal(audio.loop,true);assert.equal(audio.controls,false);assert.equal(audio.loads,1);assert.equal(audio.plays,0);
 audio.metadata(120);await f.flush();assert.equal(audio.currentTime,54);assert.equal(audio.plays,1);assert.equal(audio.paused,false);assert.equal(f.song.time(),54);
 audio.currentTime=58.2;assert.equal(f.song.time(),58.2);
 f.song.mount(null);f.song.update(100);assert.equal(f.audios.length,1);assert.equal(audio.currentTime,58.2);assert.equal(audio.plays,1);
});

test('each new celebration chooses a new random start while pausing and resuming preserves position',async()=>{
 const fractions=[.1,.8];const f=fixture({random:()=>fractions.shift()});
 f.song.mount(null);const first=f.audios[0];first.metadata(112);await f.flush();assert.equal(first.currentTime,10);
 first.currentTime=13;f.song.pause();assert.equal(first.paused,true);f.song.mount(null,{paused:false});await f.flush();assert.equal(first.currentTime,13);assert.equal(f.audios.length,1);
 f.song.stop();assert.equal(first.src,'');assert.equal(f.song.time(),null);
 f.song.mount(null);const second=f.audios[1];second.metadata(112);await f.flush();assert.equal(second.currentTime,80);assert.equal(f.audios.length,2);
});

test('initially disabled or paused music does not create or load audio until explicitly enabled',async()=>{
 for(const options of [{enabled:false},{paused:true}]){
  const f=fixture();assert.equal(f.song.mount(null,options),true);assert.equal(f.audios.length,0);
  f.song.mount(null,{enabled:true,paused:false});assert.equal(f.audios.length,1);f.audios[0].metadata(120);await f.flush();assert.equal(f.audios[0].paused,false);
 }
 const f=fixture();f.song.setEnabled(true);assert.equal(f.audios.length,0,'sound toggles outside a celebration cannot start loading');
});

test('muting and pausing before late metadata keep playback quiet; unmuting a paused song does not resume it',async()=>{
 const f=fixture();f.song.mount(null);const audio=f.audios[0];f.song.setEnabled(false);audio.metadata(120);await f.flush();assert.equal(audio.plays,0);assert.equal(audio.paused,true);assert.equal(audio.muted,true);
 f.song.pause();f.song.setEnabled(true);await f.flush();assert.equal(audio.plays,0);assert.equal(audio.paused,true);
 f.song.mount(null,{paused:false,enabled:true});await f.flush();assert.equal(audio.plays,1);assert.equal(audio.muted,false);
 f.song.setEnabled(false);assert.equal(audio.paused,true);assert.equal(audio.muted,true);
});

test('Next releases audio and stale metadata cannot start a removed or later celebration',async()=>{
 const f=fixture();f.song.mount(null);const old=f.audios[0],late=old.listeners.get('loadedmetadata');f.song.stop();old.duration=120;late();await f.flush();assert.equal(old.plays,0);assert.equal(old.src,'');assert.equal(old.listeners.size,0);
 f.song.mount(null);const current=f.audios[1];late();assert.equal(current.plays,0);current.metadata(120);await f.flush();assert.equal(current.plays,1);assert.equal(old.plays,0);
});

test('late play promises cannot restart music after Next, mute or pause',async()=>{
 for(const operation of ['stop','pause','mute']){
  const f=fixture({deferred:true});f.song.mount(null);const audio=f.audios[0];audio.metadata(120);assert.equal(f.pending.length,1);
  if(operation==='mute')f.song.setEnabled(false);else f.song[operation]();f.pending.shift()();await f.flush();assert.equal(audio.paused,true);
 }
});

test('blocked playback and invalid or short durations fail gracefully without retries or unhandled rejections',async()=>{
 const f=fixture({blocked:true});f.song.mount(null);const audio=f.audios[0];audio.metadata(10);await f.flush();assert.equal(audio.currentTime,0);assert.equal(audio.paused,true);
 for(let i=0;i<100;i++)f.song.update(i);assert.equal(audio.plays,1);audio.error();assert.equal(f.song.time(),null);
 for(const duration of [NaN,Infinity,-1]){const x=fixture();x.song.mount(null);x.audios[0].metadata(duration);await x.flush();assert.equal(x.audios[0].currentTime,0);}
});

test('source alias works and a missing audio environment leaves the game usable',()=>{
 const f=fixture();const song=createRutiSong({source:'/approved.mp3',Audio:null,document:null});assert.equal(song.mount(null),true);assert.equal(song.time(),null);song.pause();song.setEnabled(false);song.stop();assert.equal(f.audios.length,0);
});
