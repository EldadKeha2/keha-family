import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHouseSound} from '../public/assets/ruti-house-sound.mjs';

function fixture(){
 const contexts=[],sources=[],nodes=[];let visible=true;
 const parameter=()=>({value:0,events:[],setValueAtTime(value,at){assert.ok(Number.isFinite(value)&&Number.isFinite(at));this.events.push([value,at]);},exponentialRampToValueAtTime(value,at){assert.ok(value>0&&Number.isFinite(at));this.events.push([value,at]);}});
 function node(kind){const value={kind,connections:[],disconnected:false,connect(target){this.connections.push(target);},disconnect(){this.disconnected=true;}};nodes.push(value);return value;}
 function source(kind){const value={...node(kind),starts:[],stops:[],start(at){this.starts.push(at);},stop(at){this.stops.push(at);}};sources.push(value);nodes[nodes.length-1]=value;return value;}
 class Audio{
  constructor(){this.currentTime=0;this.sampleRate=128;this.state='running';this.destination={};contexts.push(this);}
  createGain(){return Object.assign(node('gain'),{gain:parameter()});}
  createDynamicsCompressor(){return Object.assign(node('compressor'),Object.fromEntries(['threshold','knee','ratio','attack','release'].map(name=>[name,parameter()])));}
  createBuffer(_channels,length){return {getChannelData:()=>new Float32Array(length)};}
  createOscillator(){return Object.assign(source('oscillator'),{frequency:parameter()});}
  createBufferSource(){return source('buffer');}
  createBiquadFilter(){return Object.assign(node('filter'),{frequency:parameter(),Q:parameter()});}
  resume(){this.state='running';return Promise.resolve();}
  close(){this.state='closed';return Promise.resolve();}
 }
 const sound=createHouseSound({Audio,visible:()=>visible});
 return {sound,contexts,sources,nodes,setVisible(value){visible=value;},at(value){contexts[0].currentTime=value;}};
}

test('action sounds wait for a player gesture and rewards remain silent after mute, hidden output or disposal',async()=>{
 const f=fixture();for(const kind of ['water-action','dust-action','water-reward','dust-reward'])f.sound.play(kind);
 assert.equal(f.contexts.length,0);assert.equal(f.sources.length,0);
 await f.sound.unlock();f.setVisible(false);f.sound.play('water-action');assert.equal(f.sources.length,0);
 f.setVisible(true);f.sound.setEnabled(false);assert.equal(await f.sound.unlock(),false);f.sound.play('water-reward');assert.equal(f.sources.length,0);
 f.sound.setEnabled(true);await f.sound.unlock();f.sound.play('water-reward');assert.ok(f.sources.length>0);
 f.sound.dispose();const count=f.sources.length;assert.equal(await f.sound.unlock(),false);f.sound.play('dust-reward');assert.equal(f.sources.length,count);assert.equal(f.contexts[0].state,'closed');
});

test('watering pours for about .8 seconds and sweeping makes two separated physical swishes without reward notes',async()=>{
 const water=fixture();await water.sound.unlock();water.sound.play('water-action');
 assert.equal(water.sources.filter(value=>value.kind==='buffer').length,2,'flowing water has a continuous noise layer');
 assert.ok(water.sources.some(value=>value.kind==='oscillator'),'small downward droplets accompany the flow');
 const waterEnd=Math.max(...water.sources.map(value=>value.stops[0]));assert.ok(waterEnd>.78&&waterEnd<.85);
 const dust=fixture();await dust.sound.unlock();dust.sound.play('dust-action');
 assert.equal(dust.sources.length,2);assert.ok(dust.sources.every(value=>value.kind==='buffer'),'sweeping contains swishes rather than a success melody');
 assert.ok(dust.sources[1].starts[0]-dust.sources[0].stops[0]>.03,'the second brush stroke has a distinct onset');
 const dustEnd=Math.max(...dust.sources.map(value=>value.stops[0]));assert.ok(dustEnd>.62&&dustEnd<.7);
});

test('success rewards are short distinct pitches and never repeat the physical action sound',async()=>{
 const water=fixture();await water.sound.unlock();water.sound.play('water-reward');
 const dust=fixture();await dust.sound.unlock();dust.sound.play('dust-reward');
 for(const f of [water,dust]){
  assert.ok(f.sources.every(value=>value.kind==='oscillator'));
  assert.ok(Math.max(...f.sources.map(value=>value.stops[0]))<.32,'a reward stays shorter than one third of a second');
 }
 assert.equal(water.sources.length,6,'three light chimes each have a soft octave partial');
 assert.equal(dust.sources.length,2,'the warmer sweep reward is a two-note pluck');
 const waterNotes=water.sources.filter((_value,i)=>i%2===0).map(value=>value.frequency.events[0][0]);
 assert.ok(waterNotes[0]<waterNotes[1]&&waterNotes[1]<waterNotes[2]);
 assert.ok(dust.sources.every(value=>value.type==='triangle'));
 assert.ok(dust.sources[1].frequency.events[0][0]<waterNotes[0],'the dust reward sounds warmer and lower');
});

test('pause and mute cancel future rewards and disconnect every action source, gain and filter immediately',async()=>{
 for(const operation of ['pause','mute']){
  const f=fixture();await f.sound.unlock();const first=f.nodes.length;
  f.sound.play('water-action');f.sound.play('dust-action');f.sound.play('water-reward');f.sound.play('dust-reward');
  const graph=f.nodes.slice(first);assert.ok(graph.length>20);
  if(operation==='pause')f.sound.stop();else f.sound.setEnabled(false);
  assert.ok(f.sources.every(value=>value.stops.includes(undefined)),'scheduled and sounding sources stop at once');
  assert.ok(graph.every(value=>value.disconnected),'the whole voice graph disconnects without waiting for onended');
  const count=f.sources.length;f.at(10);f.sound.play('water-reward');assert.equal(f.sources.length,count);
  if(operation==='mute')f.sound.setEnabled(true);await f.sound.unlock();f.sound.play('dust-reward');assert.equal(f.sources.length,count+2);
 }
});

test('rapid repeated rewards cannot build an unbounded queue and finished sources disconnect their own graph',async()=>{
 const f=fixture();await f.sound.unlock();
 for(let i=0;i<100;i++){f.at(i*.1);f.sound.play('water-reward');}
 assert.ok(f.sources.filter(value=>!value.disconnected).length<=64);
 for(const source of f.sources)source.onended?.();
 assert.ok(f.nodes.slice(2).every(value=>value.disconnected));
});

test('the legacy water and dust names remain physical-only aliases and unsupported audio degrades gracefully',async()=>{
 for(const [legacy,current] of [['water','water-action'],['dust','dust-action']]){
  const a=fixture(),b=fixture();await a.sound.unlock();await b.sound.unlock();a.sound.play(legacy);b.sound.play(current);
  assert.deepEqual(a.sources.map(value=>[value.kind,value.starts,value.stops]),b.sources.map(value=>[value.kind,value.starts,value.stops]));
 }
 for(const Audio of [null,class {constructor(){throw Error('No audio device');}}]){
  const sound=createHouseSound({Audio});assert.equal(await sound.unlock(),false);
  assert.doesNotThrow(()=>{sound.play('water-action');sound.play('dust-reward');sound.stop();sound.dispose();});
 }
});
