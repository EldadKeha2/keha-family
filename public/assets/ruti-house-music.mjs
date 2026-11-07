// Set this to an audio file supplied for the game. An absent source stays silent
// and makes no media request; celebration animation does not depend on audio.
export const RUTI_SONG_SOURCE=null;

export function createRutiSong({source,src=source??RUTI_SONG_SOURCE,random=Math.random,
 Audio:AudioClass=globalThis.Audio,document:doc=globalThis.document}={}){
 const track=typeof src==='string'&&src.trim()?src.trim():null;
 let audio=null,enabled=true,paused=false,mounted=false,generation=0,playSerial=0;
 let metadataReady=false,pendingPlay=false,failed=false,metadataHandler=null,errorHandler=null;
 const desired=()=>mounted&&enabled&&!paused&&!failed;
 function pauseAudio(owned=audio){try{owned?.pause();}catch{}}
 function apply(){
  if(!desired()){if(audio)audio.muted=!enabled;pauseAudio();return;}
  if(!audio&&!createAudio())return;
  audio.muted=false;
  if(!metadataReady||pendingPlay||audio.paused===false)return;
  const owned=audio,token=generation,attempt=++playSerial;pendingPlay=true;
  try{
   Promise.resolve(owned.play()).then(()=>{
    if(owned===audio&&attempt===playSerial)pendingPlay=false;
    // A late play() promise cannot restart an old, paused or muted celebration.
    if(owned!==audio||token!==generation||!desired())pauseAudio(owned);
   },()=>{if(owned===audio&&attempt===playSerial)pendingPlay=false;});
  }catch{pendingPlay=false;}
 }
 function createAudio(){
  let owned;
  try{owned=typeof AudioClass==='function'?new AudioClass():doc?.createElement?.('audio');}catch{return false;}
  if(!owned)return false;
  const token=++generation;audio=owned;metadataReady=false;failed=false;
  owned.preload='metadata';owned.loop=true;owned.controls=false;owned.muted=!enabled;
  metadataHandler=()=>{
   if(audio!==owned||generation!==token||metadataReady)return;
   const duration=Number(owned.duration);let fraction=0;
   try{const value=Number(random());if(Number.isFinite(value))fraction=Math.max(0,Math.min(.999999999,value));}catch{}
   const position=Number.isFinite(duration)&&duration>0?fraction*Math.max(0,duration-12):0;
   try{owned.currentTime=position;}catch{}
   metadataReady=true;apply();
  };
  errorHandler=()=>{if(audio!==owned||generation!==token)return;failed=true;pendingPlay=false;pauseAudio(owned);};
  owned.addEventListener?.('loadedmetadata',metadataHandler);owned.addEventListener?.('error',errorHandler);
  try{owned.src=track;owned.load?.();if(owned.readyState>=1)metadataHandler();}
  catch{failed=true;pauseAudio(owned);return false;}
  return true;
 }
 function mount(_container,{enabled:value=true,paused:isPaused=false}={}){
  enabled=!!value;paused=!!isPaused;
  if(!track){stop();return false;}
  mounted=true;apply();return true;
 }
 function pause(){paused=true;apply();}
 function setEnabled(value){enabled=!!value;apply();}
 function stop(){
  mounted=false;generation++;playSerial++;pendingPlay=false;
  const owned=audio;audio=null;pauseAudio(owned);
  if(owned){
   owned.removeEventListener?.('loadedmetadata',metadataHandler);owned.removeEventListener?.('error',errorHandler);
   // Drop the media resource as well as pausing it, so Next ends pending loads.
   try{if(owned.removeAttribute)owned.removeAttribute('src');else owned.src='';owned.load?.();}catch{}
  }
  metadataHandler=null;errorHandler=null;metadataReady=false;failed=false;
 }
 function time(){const value=audio?.currentTime;return audio&&metadataReady&&!failed&&Number.isFinite(value)?value:null;}
 // Kept for the game-clock API; HTMLAudioElement owns playback and needs no
 // polling timers, metadata retries, background requests or external player UI.
 function update(){}
 return {mount,pause,setEnabled,stop,time,update};
}
