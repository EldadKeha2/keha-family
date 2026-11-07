// Play the requested recording in its official, visible YouTube player. The
// player stays mounted while a pause overlay changes, so resuming keeps time.
export const RUTI_SONG_VIDEO_ID='Xq-lyHpHpyo';
export const RUTI_SONG_ORIGIN='https://www.youtube-nocookie.com';

export function createRutiSong({english=()=>false,window:win=globalThis.window,document:doc=globalThis.document}={}){
 let frame=null,container=null,enabled=true,paused=false,generation=0,ready=false;
 let currentTime=null,lastHandshake=-Infinity,handshakeCount=0,loadHandler=null;

 function send(func,args=[]){
  if(!frame?.contentWindow)return;
  try{frame.contentWindow.postMessage(JSON.stringify({event:'command',func,args,id:'ruti-celebration-song'}),RUTI_SONG_ORIGIN);}catch{}
 }
 function apply(){
  if(!frame)return;
  if(enabled&&!paused){send('unMute');send('playVideo');}
  else{send('pauseVideo');if(!enabled)send('mute');}
 }
 function handshake(){
  if(!frame?.contentWindow)return;
  try{frame.contentWindow.postMessage(JSON.stringify({event:'listening',id:'ruti-celebration-song',channel:'widget'}),RUTI_SONG_ORIGIN);}catch{}
  send('addEventListener',['onReady']);send('addEventListener',['onStateChange']);
  handshakeCount++;
 }
 function message(event){
  if(!frame||event.origin!==RUTI_SONG_ORIGIN||event.source!==frame.contentWindow)return;
  let data=event.data;
  if(typeof data==='string'){try{data=JSON.parse(data);}catch{return;}}
  if(!data||typeof data!=='object')return;
  if(data.event==='onReady'||data.event==='initialDelivery'){
   ready=true;apply();
  }
  if(data.event==='infoDelivery'||data.event==='initialDelivery'){
   const value=data.info?.currentTime;
   if(typeof value==='number'&&Number.isFinite(value)&&value>=0)currentTime=value;
  }
  // Late player readiness/state messages cannot undo a pause or mute chosen
  // while the iframe was loading. Keep playback stopped until explicitly resumed.
  if(data.event==='onStateChange'&&data.info===1&&(!enabled||paused))apply();
 }
 function mount(node,{enabled:value=true,paused:isPaused=false}={}){
  if(!node||!doc?.createElement||!win?.addEventListener){stop();return false;}
  enabled=!!value;paused=!!isPaused;container=node;
  if(!frame){
   const token=++generation;
   frame=doc.createElement('iframe');
   const params=new URLSearchParams({enablejsapi:'1',autoplay:enabled&&!paused?'1':'0',loop:'1',playlist:RUTI_SONG_VIDEO_ID,playsinline:'1',controls:'1',rel:'0'});
   const origin=win.location?.origin;if(origin&&origin!=='null')params.set('origin',origin);
   frame.src=`${RUTI_SONG_ORIGIN}/embed/${RUTI_SONG_VIDEO_ID}?${params}`;
   frame.title=english()?'Zion Golan — Abba Shimon':'ציון גולן — אבא שמעון';
   frame.width='240';frame.height='200';
   frame.style.minWidth='200px';frame.style.minHeight='200px';frame.style.width='100%';frame.style.height='200px';frame.style.border='0';
   frame.allow='autoplay; encrypted-media; picture-in-picture';
   frame.allowFullscreen=true;frame.referrerPolicy='strict-origin-when-cross-origin';
   const owned=frame;
   loadHandler=()=>{if(token!==generation||frame!==owned)return;ready=false;lastHandshake=-Infinity;handshakeCount=0;handshake();apply();};
   frame.addEventListener('load',loadHandler);
   win.addEventListener('message',message);
   container.appendChild(frame);
  }else if(frame.parentNode!==container)container.appendChild(frame);
  apply();return true;
 }
 function pause(){paused=true;apply();}
 function setEnabled(value){enabled=!!value;apply();}
 function update(gameTime){
  // The ordinary game animation supplies the clock; no browser timers survive
  // navigation, and an unavailable player gets at most ten readiness retries.
  if(!frame||ready||handshakeCount>=10||!Number.isFinite(gameTime))return;
  if(gameTime-lastHandshake<1)return;
  lastHandshake=gameTime;handshake();apply();
 }
 function stop(){
  generation++;send('pauseVideo');send('stopVideo');
  win?.removeEventListener?.('message',message);
  if(frame){frame.removeEventListener?.('load',loadHandler);frame.remove();}
  frame=null;container=null;loadHandler=null;currentTime=null;ready=false;
  lastHandshake=-Infinity;handshakeCount=0;
 }
 return {mount,pause,setEnabled,stop,time:()=>currentTime,update};
}
