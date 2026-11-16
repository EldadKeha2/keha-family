import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';

const source=await readFile(new URL('../public/assets/video-delivery.js',import.meta.url),'utf8');
function fixture(){
 const {document}=parseHTML('<html><body></body></html>'),listeners=new Map(),window={navigator:{}};
 document.addEventListener=(type,handler)=>listeners.set(type,handler);
 vm.runInNewContext(source,{window,document,setTimeout,clearTimeout});
 const api=window.FamilyVideoDelivery;
 const item=extra=>({id:'film',kind:'video',mime:'video/mp4',src:'/media/film',poster:'/poster/film.jpg',videoRevision:'original',...extra});
 function tile(value){const node=document.createElement('div');node.className='video-tile-cover';node.innerHTML=api.durationBadge(value);document.body.append(node);return node;}
 return {api,item,tile,metadata(video,duration){Object.defineProperty(video,'duration',{value:duration,configurable:true});listeners.get('loadedmetadata')({target:video});}};
}
test('prepared video durations appear immediately without opening a player or requesting video metadata',()=>{
 const f=fixture();
 for(const duration of [24.52,147.605,412.2,3601.1]){
  const item=f.item({playbackSources:[{quality:'low',duration}]}),markup=f.api.durationBadge(item);
  assert.equal(f.api.duration(item),duration);assert.doesNotMatch(markup,/<video| hidden/);assert.match(markup,/>\d+:\d{2}<\/span>/);
 }
 assert.match(f.api.durationBadge(f.item({duration:21,playbackSources:[{duration:147}]})),/>0:21<\/span>/,'An explicitly edited clip duration takes precedence');
 assert.equal(f.api.duration(f.item({provider:'youtube',youtubeStart:10,youtubeEnd:75})),65);
});
test('a local poster missing its duration queues one invisible metadata probe and updates every matching tile',()=>{
 const f=fixture(),item=f.item(),first=f.tile(item),second=f.tile(item),probe=first.querySelector('video');
 assert.ok(probe);assert.equal(probe.getAttribute('preload'),'none');assert.equal(probe.dataset.previewSrc,'/media/film');
 assert.equal(first.querySelector('.video-tile-duration').hidden,true);f.metadata(probe,147.605);
 for(const tile of [first,second]){const badge=tile.querySelector('.video-tile-duration');assert.equal(badge.hidden,false);assert.equal(badge.textContent,'2:27');}
 assert.equal(f.api.duration(item),147.605);assert.doesNotMatch(f.api.durationBadge(item),/<video/,'Rerendering reuses the metadata rather than starting another probe');
 assert.equal(item.duration,undefined,'Metadata discovery does not rewrite the source item or its saved description');
});
test('duration metadata remains scoped to its media revision and cannot label a newly edited video',()=>{
 const f=fixture(),old=f.tile(f.item()),next=f.tile(f.item({videoRevision:'edited'}));
 f.metadata(old.querySelector('video'),150);assert.equal(old.querySelector('.video-tile-duration').textContent,'2:30');assert.equal(next.querySelector('.video-tile-duration').hidden,true);
 assert.equal(f.api.duration(f.item({videoRevision:'edited'})),null);f.metadata(next.querySelector('video'),30);assert.equal(next.querySelector('.video-tile-duration').textContent,'0:30');
 assert.equal(f.api.duration(f.item()),150);assert.equal(f.api.duration(f.item({videoRevision:'edited'})),30);
 assert.equal(f.api.duration(f.item({id:'other',videoRevision:'edited',playbackSources:[{src:'/media/other?videoAsset=low&v=original',duration:150}]})),null,'A retained stale playback source cannot supply the edited clip length');
});
test('unknown durations never display invented zeroes and remote YouTube posters do not trigger local probes',()=>{
 const f=fixture();
 for(const duration of [null,undefined,0,-1,Infinity,NaN,'invalid']){const item=f.item({duration});assert.equal(f.api.duration(item),null);assert.match(f.api.durationBadge(item),/ hidden/);}
 const remote=f.api.durationBadge(f.item({provider:'youtube',src:'https://www.youtube.com/watch?v=example'}));assert.doesNotMatch(remote,/<video/);
});
