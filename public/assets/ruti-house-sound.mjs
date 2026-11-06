// Small, self-contained instruments for Ruti's house. Audio is only created
// after unlock() is called from a player gesture; there are no background timers.
export function createHouseSound(){
  let context=null,master=null,noise=null,enabled=true,awake=false,disposed=false;
  const sources=new Set(),lastPlayed=new Map();
  const frequency=note=>440*Math.pow(2,(note-69)/12);

  function makeContext(){
    if(context)return true;
    const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;
    if(!Audio||disposed)return false;
    try{
      context=new Audio({latencyHint:'interactive'});
      master=context.createGain();master.gain.value=.25;
      const compressor=context.createDynamicsCompressor();
      compressor.threshold.value=-16;compressor.knee.value=16;
      compressor.ratio.value=4;compressor.attack.value=.004;compressor.release.value=.16;
      master.connect(compressor);compressor.connect(context.destination);
      noise=context.createBuffer(1,context.sampleRate,context.sampleRate);
      const data=noise.getChannelData(0);
      for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
      return true;
    }catch{context=null;master=null;return false;}
  }

  function track(source,connections){
    // Keep rapid multi-task bursts bounded, even on a device that suspends audio.
    if(sources.size>=64){const oldest=sources.values().next().value;try{oldest.stop();}catch{}sources.delete(oldest);}
    sources.add(source);
    source.onended=()=>{sources.delete(source);for(const node of [source,...connections]){try{node.disconnect();}catch{}}};
  }

  function tone(hz,at,duration=.17,{wave='sine',volume=.3,to=null,attack=.007,filter=null}={}){
    const source=context.createOscillator(),gain=context.createGain(),nodes=[gain];
    source.type=wave;source.frequency.setValueAtTime(hz,at);
    if(to)source.frequency.exponentialRampToValueAtTime(Math.max(20,to),at+duration*.85);
    gain.gain.setValueAtTime(.0001,at);
    gain.gain.exponentialRampToValueAtTime(Math.max(.0001,volume),at+attack);
    gain.gain.exponentialRampToValueAtTime(.0001,at+duration);
    if(filter){const lowpass=context.createBiquadFilter();lowpass.type='lowpass';lowpass.frequency.value=filter;source.connect(lowpass);lowpass.connect(gain);nodes.push(lowpass);}
    else source.connect(gain);
    gain.connect(master);track(source,nodes);source.start(at);source.stop(at+duration+.025);
  }

  function hush(at,duration,{volume=.12,type='lowpass',hz=1300,to=null}={}){
    const source=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain();
    source.buffer=noise;filter.type=type;filter.frequency.setValueAtTime(hz,at);
    if(to)filter.frequency.exponentialRampToValueAtTime(to,at+duration);
    gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(volume,at+.018);
    gain.gain.exponentialRampToValueAtTime(.0001,at+duration);
    source.connect(filter);filter.connect(gain);gain.connect(master);
    track(source,[filter,gain]);source.start(at,Math.random()*.1);source.stop(at+duration+.025);
  }

  function notes(values,at,{gap=.09,duration=.26,volume=.19,wave='sine'}={}){
    values.forEach((note,i)=>{
      tone(frequency(note),at+i*gap,duration,{volume,wave});
      // A soft octave partial gives the rewards a small ceramic-bell timbre.
      tone(frequency(note+12),at+i*gap,duration*.65,{volume:volume*.2});
    });
  }

  function meow(at,quiet=false){
    const loud=quiet?.085:.16;
    tone(quiet?650:810,at,.18,{wave:'triangle',volume:loud,to:quiet?900:1020,filter:1900});
    tone(quiet?900:1020,at+.14,.24,{wave:'triangle',volume:loud*.75,to:quiet?560:470,filter:1700});
  }

  function unlock(){
    if(!enabled||disposed||!makeContext())return Promise.resolve(false);
    awake=true;
    try{return Promise.resolve(context.state==='suspended'?context.resume():undefined).then(()=>true,()=>false);}
    catch{return Promise.resolve(false);}
  }

  function stop(){
    awake=false;lastPlayed.clear();
    for(const source of sources){try{source.stop();}catch{}try{source.disconnect();}catch{}}
    sources.clear();
  }

  function setEnabled(value){enabled=!!value;if(!enabled)stop();return enabled;}

  function play(kind){
    if(!enabled||!awake||!context||disposed)return;
    if(globalThis.document?.visibilityState==='hidden')return;
    const now=context.currentTime,previous=lastPlayed.get(kind);
    if(previous!==undefined&&now-previous<(kind==='select'?.04:.075))return;
    lastPlayed.set(kind,now);const at=now+.008;
    try{
      switch(kind){
        case 'step':tone(135,at,.045,{wave:'triangle',volume:.025,to:85});hush(at,.025,{hz:500,to:180,volume:.018});break;
        case 'select':tone(680,at,.07,{wave:'triangle',volume:.18,to:420});break;
        case 'wrong':notes([53,51],at,{gap:.095,duration:.13,volume:.1,wave:'triangle'});break;
        case 'meal':notes([72,76,79,84,88,91],at,{gap:.065,duration:.34,volume:.18});
          [60,64,67].forEach(note=>tone(frequency(note),at+.27,.48,{volume:.085,wave:'triangle'}));break;
        case 'snack':notes([72,76,79,84],at,{gap:.07,duration:.23,volume:.17});break;
        case 'water':hush(at,.42,{hz:1700,to:450,volume:.15});
          [0,.09,.21].forEach((offset,i)=>tone(1280-i*180,at+offset,.085,{volume:.075,to:700-i*70}));break;
        case 'dust':hush(at,.18,{type:'highpass',hz:1600,to:5000,volume:.11});
          hush(at+.13,.2,{type:'highpass',hz:2800,to:6000,volume:.085});
          notes([88,93],at+.2,{gap:.07,duration:.15,volume:.07});break;
        case 'cat':meow(at);hush(at+.1,.15,{hz:900,to:350,volume:.055});break;
        case 'ready':notes([79,84,79,84],at,{gap:.105,duration:.19,volume:.13});break;
        case 'guest':notes([79,72],at,{gap:.2,duration:.38,volume:.17});break;
        case 'spawn-cat':meow(at,true);break;
        case 'level':notes([72,76,79,84,79,84,88],at,{gap:.075,duration:.32,volume:.16});break;
        case 'strike':notes([62,58,53],at,{gap:.12,duration:.25,volume:.16,wave:'triangle'});break;
        case 'finish':notes([76,79,84,79,76,72],at,{gap:.13,duration:.4,volume:.13});
          [48,55,60,64].forEach(note=>tone(frequency(note),at+.7,.7,{volume:.075,wave:'triangle'}));break;
        case 'bowl':hush(at,.13,{hz:1000,to:2300,volume:.09});tone(470,at,.09,{volume:.08,to:620});break;
        case 'knife':tone(1040,at,.045,{wave:'triangle',volume:.11,to:360});hush(at,.055,{hz:1100,volume:.035});break;
        case 'oven':notes([67,72],at,{gap:.065,duration:.12,volume:.1});break;
        default:break;
      }
    }catch{/* Browsers without a working output device still keep the game playable. */}
  }

  function dispose(){stop();disposed=true;if(context){try{const closing=context.close();closing?.catch?.(()=>{});}catch{}}context=null;master=null;noise=null;}
  return {unlock,setEnabled,play,stop,dispose};
}
