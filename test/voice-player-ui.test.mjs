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
    createDynamicsCompressor(){return Object.assign(this.node(),{threshold:{},knee:{},ratio:{},attack:{},release:{}});}
    createMediaElementSource(audio){assert.ok(!this.sources.includes(audio),'only one source per audio element');this.sources.push(audio);return this.node();}
  }
  window.FamilyI18n={isEnglish:false};window.AudioContext=supported?Context:undefined;window.webkitAudioContext=undefined;
  window.PointerEvent=window.Event;
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
  assert.equal(seek.getAttribute('step'),'1');
  seek.value='42';seek.dispatchEvent(new f.window.Event('input'));assert.equal(audio.currentTime,42);
  assert.equal(f.player().querySelector('[data-voice-elapsed]').textContent,'0:42');assert.equal(f.player().querySelector('[data-voice-duration]').textContent,'1:30');
  audio.duration=NaN;audio.dispatchEvent(new f.window.Event('durationchange'));assert.equal(seek.disabled,true);
});

function gesture(f,player,width,pointerType){
  const rail=player.querySelector('.voice-seek-rail');
  rail.getBoundingClientRect=()=>({left:0,width});
  rail.setPointerCapture=()=>{};
  return (type,x,id=1)=>{
    const event=Object.assign(new f.window.Event(type,{bubbles:true}),{
      clientX:x,pointerId:id,pointerType,isPrimary:id===1,button:0
    });
    rail.dispatchEvent(event);
  };
}
test('a small drag on an hour-long interview selects individual seconds on phone and desktop',()=>{
  for(const [width,type] of [[216,'touch'],[816,'mouse']]){
    const f=fixture(),audio=f.audios[0],player=f.player(),pointer=gesture(f,player,width,type);
    audio.duration=3600;audio.currentTime=1800.4;audio.dispatchEvent(new f.window.Event('durationchange'));
    const mid=width/2,readout=player.querySelector('.voice-seek-readout');
    pointer('pointerdown',mid);
    pointer('pointermove',mid+10);
    audio.dispatchEvent(new f.window.Event('timeupdate'));
    assert.equal(readout.textContent,'30:01');assert.equal(readout.hidden,false);
    assert.equal(player.querySelector('[data-voice-elapsed]').textContent,'30:01');
    assert.equal(audio.currentTime,1800.4);
    pointer('pointerup',mid+10);
    assert.equal(audio.currentTime,1801);assert.equal(readout.hidden,true);
    assert.equal(player.querySelector('.voice-seek').max,'3600');
    // A drag can also start away from the thumb without a jump to that point.
    pointer('pointerdown',mid/2);pointer('pointerup',mid/2-20);
    assert.equal(audio.currentTime,1799);
    // A simple tap away from the thumb still uses the whole recording.
    pointer('pointerdown',8+(width-16)/4);pointer('pointerup',8+(width-16)/4);
    assert.equal(audio.currentTime,900);assert.equal(audio.paused,true);
  }
});
test('a tap on the thumb, a cancelled drag, or a second finger leaves the recording where it was',()=>{
  const f=fixture(),audio=f.audios[0],player=f.player(),pointer=gesture(f,player,216,'touch');
  audio.duration=3600.6;audio.currentTime=1800.4;audio.dispatchEvent(new f.window.Event('durationchange'));
  pointer('pointerdown',120);pointer('pointerup',121);assert.equal(audio.currentTime,1800.4);
  for(const end of ['pointercancel','lostpointercapture']){
    pointer('pointerdown',108);pointer('pointermove',138);
    pointer('pointerup',168,2);pointer(end,138);pointer('pointerup',138);
    assert.equal(audio.currentTime,1800.4);assert.equal(player.querySelector('.voice-seek-readout').hidden,true);
  }
  pointer('pointerdown',208);pointer('pointerup',208);assert.equal(audio.currentTime,3600.6);
  pointer('pointerdown',208);pointer('pointerup',240);assert.equal(audio.currentTime,3600.6);
});
test('unmodified horizontal arrows seek exactly one second in the intended player and respect other controls',async()=>{
  const f=fixture({count:2}),[first,second]=f.audios;
  const arrow=(target,key,modifiers={})=>{
    const event=Object.assign(new f.window.Event('keydown',{bubbles:true,cancelable:true}),{key,...modifiers});
    target.dispatchEvent(event);return event.defaultPrevented;
  };
  first.currentTime=32.75;second.currentTime=28;
  assert.equal(arrow(f.player().querySelector('.voice-seek'),'ArrowRight'),true);assert.equal(first.currentTime,33.75);
  assert.equal(arrow(f.player().querySelector('.voice-play'),'ArrowLeft'),true);assert.equal(first.currentTime,32.75);
  for(const selector of ['.voice-boost select','.voice-speed select','.voice-volume input']){
    assert.equal(arrow(f.player().querySelector(selector),'ArrowRight'),false);
  }
  assert.equal(arrow(f.player().querySelector('.voice-seek'),'ArrowLeft',{altKey:true}),false);
  assert.equal(first.currentTime,32.75);
  await second.play();
  assert.equal(arrow(f.document,'ArrowRight'),true);assert.equal(second.currentTime,29);
  assert.equal(first.currentTime,32.75);
  second.currentTime=89.9;arrow(f.document,'ArrowRight');assert.equal(second.currentTime,90);
  second.currentTime=.2;arrow(f.document,'ArrowLeft');assert.equal(second.currentTime,0);
  f.player(1).parentElement.hidden=true;assert.equal(arrow(f.document,'ArrowRight'),false);
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
  assert.equal(f.player().querySelector('.voice-boost select').disabled,true);
  const volume=f.player().querySelector('.voice-volume input');volume.value='.35';volume.dispatchEvent(new f.window.Event('input'));assert.equal(f.audios[0].volume,.35);
  f.click('.voice-play');await f.tick();assert.equal(f.audios[0].paused,false);
});
test('boost amplifies only its recording and respects normal volume, mute and playback position',async()=>{
  const f=fixture({count:2}),boost=f.player().querySelector('.voice-boost select'),volume=f.player().querySelector('.voice-volume input');
  function input(control,value){control.value=value;control.dispatchEvent(new f.window.Event('input'));}
  function setBoost(value){boost.querySelector(`option[value="${value}"]`).selected=true;boost.dispatchEvent(new f.window.Event('change'));}
  assert.equal(boost.value,'100');assert.equal(f.contexts.length,0);
  assert.deepEqual(Array.from(boost.options,option=>Number(option.value)),Array.from({length:21},(_,i)=>100+25*i));
  f.click('.voice-play');await f.tick();f.audios[0].currentTime=24;
  setBoost(600);await f.tick();
  const gain=f.nodes[4],limiter=gain.connected;
  assert.equal(gain.gain.value,6);assert.equal(limiter.ratio.value,20);assert.equal(limiter.connected,f.contexts[0].destination);
  assert.equal(f.audios[0].volume,1);assert.equal(f.audios[0].paused,false);assert.equal(f.audios[0].currentTime,24);
  assert.equal(boost.value,'600');assert.equal(f.player(1).querySelector('.voice-boost select').value,'100');
  input(volume,'.5');assert.equal(gain.gain.value,3);
  input(volume,'0');assert.equal(gain.gain.value,0);
  input(volume,'1');setBoost(100);await f.tick();assert.equal(gain.gain.value,1);assert.equal(limiter.ratio.value,1);
  assert.deepEqual(f.contexts[0].sources,[f.audios[0]]);
});
test('a rejected play request leaves an actionable retry and truthful player state',async()=>{
  const f=fixture({rejectPlay:true});f.click('.voice-play');await f.tick();
  assert.equal(f.player().querySelector('.voice-play').getAttribute('aria-pressed'),'false');assert.match(f.player().querySelector('[role="status"]').textContent,/לחצו שוב/);
});
