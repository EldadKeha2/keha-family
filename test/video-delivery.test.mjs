import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../public/assets/video-delivery.js',import.meta.url),'utf8');
const movie=(overrides={})=>({id:'family-film',kind:'video',src:'/media/original',mime:'video/mp4',faststartSrc:'/media/faststart',poster:'/media/poster',playbackSources:[{quality:'low',src:'/media/low',mime:'video/mp4'},{quality:'medium',src:'/media/medium',mime:'video/mp4'}],...overrides});
function fixture(connection){
  let now=0,nextTimer=0;const timers=new Map();
  const window={navigator:{connection}};
  vm.runInNewContext(source,{window,setTimeout(fn,delay){const id=++nextTimer;timers.set(id,{fn,at:now+delay});return id;},clearTimeout:id=>timers.delete(id)});
  class Video extends EventTarget{
    constructor({lazy=false}={}){super();this.attributes=new Map();this.dataset={};this.poster='';this.isConnected=true;this.currentTime=0;this.playbackRate=1;this.volume=1;this.muted=false;this.paused=true;this.duration=120;this.readyState=1;this.loads=[];this.plays=0;this.writes=[];this.listeners=new Map();if(lazy){this.attributes.set('data-preview-src','pending');this.dataset.previewSrc='pending';}}
    addEventListener(name,fn){if(!this.listeners.has(name))this.listeners.set(name,new Set());this.listeners.get(name).add(fn);super.addEventListener(name,fn);}
    removeEventListener(name,fn){this.listeners.get(name)?.delete(fn);super.removeEventListener(name,fn);}
    set src(value){this.attributes.set('src',value);this.writes.push(value);}
    get src(){return this.attributes.get('src')||'';}
    hasAttribute(name){return this.attributes.has(name);}
    getAttribute(name){return this.attributes.get(name)??null;}
    load(){this.loads.push(this.src);this.currentTime=0;this.paused=true;this.playbackRate=1;this.volume=1;this.muted=false;this.readyState=0;}
    play(){this.plays++;this.paused=false;return Promise.resolve();}
    emit(type){return this.dispatchEvent(new Event(type));}
    get listenerCount(){return [...this.listeners.values()].reduce((sum,items)=>sum+items.size,0);}
  }
  return {api:window.FamilyVideoDelivery,Video,timers,advance(ms){const end=now+ms;while(true){const due=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];if(!due||due[1].at>end)break;timers.delete(due[0]);now=due[1].at;due[1].fn();}now=end;}};
}
test('initial video quality follows data saving, connection speed and available copies',()=>{
  for(const [connection,expected]of [[undefined,'faststart'],[{},'faststart'],[{effectiveType:'4g',downlink:10},'faststart'],[{saveData:true,effectiveType:'4g'},'low'],[{effectiveType:'slow-2g'},'low'],[{effectiveType:'2g'},'low'],[{effectiveType:'3g'},'low'],[{effectiveType:'4g',downlink:1},'medium']]){
    const f=fixture(connection);assert.equal(f.api.src(movie()),'/media/'+expected);
  }
  const slow=fixture({saveData:true});assert.equal(slow.api.src(movie({playbackSources:[{quality:'medium',src:'/media/medium'}]})),'/media/medium');
  assert.equal(slow.api.src(movie({playbackSources:[],faststartSrc:null})),'/media/original');
  assert.equal(fixture().api.src(movie({faststartSrc:null})),'/media/original');
});
test('video cards keep selected sources lazy and receive a poster without starting media downloads',()=>{
  const f=fixture({saveData:true}),video=new f.Video({lazy:true});f.api.bind(video,movie());
  assert.equal(video.dataset.previewSrc,'/media/low');assert.equal(video.getAttribute('src'),null);assert.deepEqual(video.loads,[]);assert.equal(video.poster,'/media/poster');
  video.emit('error');assert.equal(video.getAttribute('src'),null);
});
test('a sustained stall steps down smoothly and restores time, speed, volume, mute and playback intent',()=>{
  const f=fixture(),video=new f.Video();f.api.bind(video,movie());Object.assign(video,{currentTime:42,playbackRate:1.5,volume:.25,muted:true,paused:false,readyState:2});
  video.emit('waiting');video.emit('waiting');assert.equal(f.timers.size,1);f.advance(4999);assert.deepEqual(video.loads,[]);
  f.advance(1);assert.deepEqual(video.loads,['/media/medium']);assert.equal(video.currentTime,0);video.emit('loadedmetadata');
  assert.equal(video.currentTime,42);assert.equal(video.playbackRate,1.5);assert.equal(video.volume,.25);assert.equal(video.muted,true);assert.equal(video.paused,false);assert.equal(video.plays,1);
  video.readyState=2;video.emit('waiting');f.advance(5000);assert.equal(video.src,'/media/low');video.emit('loadedmetadata');video.readyState=2;video.emit('waiting');f.advance(30000);assert.deepEqual(video.loads,['/media/medium','/media/low']);
});
test('ordinary buffering, seeking, recovery and paused players do not trigger unnecessary source changes',()=>{
  for(const event of ['playing','canplay','pause','ended','seeking','emptied']){
    const f=fixture(),video=new f.Video();f.api.bind(video,movie());video.paused=false;video.emit('waiting');video.emit(event);f.advance(5000);assert.deepEqual(video.loads,[],event);assert.equal(f.timers.size,0,event);
  }
  const f=fixture(),video=new f.Video();f.api.bind(video,movie());video.emit('waiting');assert.equal(f.timers.size,0);video.paused=false;video.emit('waiting');video.readyState=3;f.advance(5000);assert.deepEqual(video.loads,[]);
});
test('fallback preserves paused state and clamps the original playback position to the replacement duration',()=>{
  const f=fixture(),video=new f.Video();f.api.bind(video,movie());Object.assign(video,{currentTime:119,paused:true,volume:.4,playbackRate:2,muted:true});video.emit('error');video.duration=100;video.emit('loadedmetadata');
  assert.equal(video.currentTime,99.95);assert.equal(video.paused,true);assert.equal(video.plays,0);assert.equal(video.volume,.4);assert.equal(video.playbackRate,2);assert.equal(video.muted,true);
});
test('chained source errors preserve the initial playback snapshot and eventually surface an error once options are exhausted',()=>{
  const f=fixture(),video=new f.Video();f.api.bind(video,movie());Object.assign(video,{currentTime:53,paused:false,volume:.3,playbackRate:1.75,muted:true});let unhandled=0;video.addEventListener('error',()=>unhandled++);
  video.emit('error');assert.equal(video.src,'/media/medium');video.emit('error');assert.equal(video.src,'/media/low');video.emit('error');assert.equal(video.src,'/media/original');assert.equal(unhandled,0);
  video.emit('loadedmetadata');assert.equal(video.currentTime,53);assert.equal(video.paused,false);assert.equal(video.volume,.3);assert.equal(video.playbackRate,1.75);assert.equal(video.muted,true);
  video.emit('error');assert.equal(unhandled,1);const count=video.loads.length;for(let i=0;i<10;i++)video.emit('error');assert.equal(video.loads.length,count);assert.equal(unhandled,11);assert.equal(f.timers.size,0);
});
test('rebinding the same video revision updates the poster without resetting playback or duplicating listeners',()=>{
  const f=fixture(),video=new f.Video(),first=f.api.bind(video,movie());Object.assign(video,{currentTime:21,paused:false});const listenerCount=video.listenerCount;
  assert.equal(f.api.bind(video,movie({poster:'/media/new-poster'})),first);assert.equal(video.poster,'/media/new-poster');assert.equal(video.currentTime,21);assert.equal(video.paused,false);assert.equal(video.writes.length,1);assert.equal(video.listenerCount,listenerCount);
  f.api.bind(video,movie({videoRevision:'edited',src:'/media/edited',faststartSrc:null}));assert.equal(video.src,'/media/edited');assert.equal(video.listenerCount,listenerCount);
});
test('release clears pending work and all listeners, and detached players cannot trigger fallbacks',()=>{
  const f=fixture(),video=new f.Video();f.api.bind(video,movie());video.paused=false;video.emit('waiting');assert.equal(f.timers.size,1);f.api.release(video);assert.equal(video.listenerCount,0);assert.equal(f.timers.size,0);video.emit('error');f.advance(10000);assert.deepEqual(video.loads,[]);
  const detached=new f.Video();f.api.bind(detached,movie());detached.isConnected=false;detached.paused=false;detached.emit('waiting');f.advance(5000);detached.emit('error');assert.deepEqual(detached.loads,[]);
});
test('disposing an old binding again cannot release the newer revision binding',()=>{
  const f=fixture(),video=new f.Video(),old=f.api.bind(video,movie());f.api.bind(video,movie({videoRevision:'new'}));old.dispose();f.api.release(video);assert.equal(video.listenerCount,0);
});
test('YouTube and nonvideo media do not acquire adaptive player listeners or sources',()=>{
  const f=fixture(),video=new f.Video();f.api.bind(video,movie({provider:'youtube'}));f.api.bind(video,{kind:'photo',src:'/media/photo'});assert.equal(video.src,'');assert.equal(video.listenerCount,0);
});

test('a new video revision with no poster clears the previous revision cover',()=>{
  const f=fixture(),video=new f.Video();f.api.bind(video,movie());assert.equal(video.poster,'/media/poster');
  f.api.bind(video,movie({id:'another-film',videoRevision:'new',poster:null}));assert.equal(video.poster,'');
});
test('a blocked resume promise is handled and infinite-duration media retains its playback position',async()=>{
  const f=fixture(),video=new f.Video();f.api.bind(video,movie());Object.assign(video,{currentTime:105,paused:false,duration:Infinity});
  video.play=()=>Promise.reject(Error('Playback needs a gesture'));video.emit('error');video.emit('loadedmetadata');await Promise.resolve();await Promise.resolve();assert.equal(video.currentTime,105);assert.equal(video.src,'/media/medium');
});
