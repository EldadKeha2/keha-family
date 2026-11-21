import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';

const source=await readFile(new URL('../public/assets/voice-player.js',import.meta.url),'utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture({count=1,supported=true,rejectPlay=false}={}){
  const {window,document}=parseHTML('<main>'+Array.from({length:count},(_,i)=>`<article><audio controls src="/voice-${i}.mp3"></audio></article>`).join('')+'</main>');
  const audios=[...document.querySelectorAll('audio')],nodes=[],contexts=[];
  for(const audio of audios){
    Object.assign(audio,{duration:90,currentTime:0,paused:true,ended:false,volume:1});
    audio.pause=()=>{audio.paused=true;audio.dispatchEvent(new window.Event('pause'));};
    audio.play=async()=>{if(rejectPlay)throw Error('Network error');audio.paused=false;audio.dispatchEvent(new window.Event('play'));};
  }
  class Context{
    constructor(){this.state='suspended';this.currentTime=0;this.sources=[];this.destination={};contexts.push(this);}
    async resume(){this.state='running';}
    node(){const node={connect(to){this.connected=to;return to;},disconnect(){this.disconnected=true;},gain:{value:0,setTargetAtTime(value){this.value=value;}},frequency:{value:0,setTargetAtTime(value){this.value=value;}},Q:{value:0}};nodes.push(node);return node;}
    createBiquadFilter(){return this.node();}createGain(){return this.node();}
    createMediaElementSource(audio){assert.ok(!this.sources.includes(audio),'only one source per audio element');this.sources.push(audio);return this.node();}
  }
  window.FamilyI18n={isEnglish:false};window.AudioContext=supported?Context:undefined;window.webkitAudioContext=undefined;
  vm.runInNewContext(source,{window,document});window.FamilyVoicePlayer.mount(document);
  const player=i=>document.querySelectorAll('.heirloom-player')[i||0];
  const click=selector=>{document.querySelector(selector).dispatchEvent(new window.Event('click'));};
  return {window,document,audios,player,click,nodes,contexts,tick};
}
test('seeking and skipping stay within the actual recording length',()=>{
  const f=fixture(),audio=f.audios[0],seek=f.player().querySelector('.voice-seek');
  assert.equal(audio.paused,true);assert.equal(seek.disabled,false);
  audio.currentTime=86;f.click('[data-skip="15"]');assert.equal(audio.currentTime,90);
  audio.currentTime=3;f.click('[data-skip="-15"]');assert.equal(audio.currentTime,0);
  seek.value='42.5';seek.dispatchEvent(new f.window.Event('input'));assert.equal(audio.currentTime,42.5);
  assert.equal(f.player().querySelector('[data-voice-elapsed]').textContent,'0:42');assert.equal(f.player().querySelector('[data-voice-duration]').textContent,'1:30');
  audio.duration=NaN;audio.dispatchEvent(new f.window.Event('durationchange'));assert.equal(seek.disabled,true);
});
test('starting a second interview pauses the first and cleanup disconnects its audio graph',async()=>{
  const f=fixture({count:2}),buttons=[...f.document.querySelectorAll('.voice-play')];
  buttons[0].dispatchEvent(new f.window.Event('click'));await f.tick();assert.equal(f.audios[0].paused,false);
  buttons[1].dispatchEvent(new f.window.Event('click'));await f.tick();assert.equal(f.audios[0].paused,true);assert.equal(f.audios[1].paused,false);
  f.click('.voice-tone-toggle');await f.tick();f.window.FamilyVoicePlayer.destroy(f.document);
  assert.ok(f.audios.every(a=>a.paused));assert.ok(f.nodes.every(n=>n.disconnected));assert.equal(f.document.querySelectorAll('.heirloom-player').length,0);assert.ok(f.audios[0].hasAttribute('controls'));
});
test('equalizer settings reach the signal chain and reopening does not duplicate the source',async()=>{
  const f=fixture();f.click('.voice-tone-toggle');await f.tick();
  assert.equal(f.contexts.length,1);assert.equal(f.contexts[0].state,'running');assert.equal(f.contexts[0].sources.length,1);
  f.click('[data-preset="speech"]');assert.deepEqual(f.nodes.slice(1,4).map(n=>n.gain.value),[-4,4,-1]);
  const volume=f.player().querySelector('.voice-volume input');volume.value='.4';volume.dispatchEvent(new f.window.Event('input'));assert.equal(f.nodes[4].gain.value,.4);
  f.click('.voice-tone-toggle');f.click('.voice-tone-toggle');await f.tick();assert.equal(f.contexts[0].sources.length,1);
});
test('unsupported equalizers retain ordinary playback and volume',async()=>{
  const f=fixture({supported:false});f.click('.voice-tone-toggle');await f.tick();
  assert.equal(f.player().querySelector('[data-preset]').disabled,true);assert.equal(f.player().querySelector('.voice-tone-note').hidden,false);
  const volume=f.player().querySelector('.voice-volume input');volume.value='.35';volume.dispatchEvent(new f.window.Event('input'));assert.equal(f.audios[0].volume,.35);
  f.click('.voice-play');await f.tick();assert.equal(f.audios[0].paused,false);
});
test('a rejected play request leaves an actionable retry and truthful player state',async()=>{
  const f=fixture({rejectPlay:true});f.click('.voice-play');await f.tick();
  assert.equal(f.player().querySelector('.voice-play').getAttribute('aria-pressed'),'false');assert.match(f.player().querySelector('[role="status"]').textContent,/לחצו שוב/);
});
