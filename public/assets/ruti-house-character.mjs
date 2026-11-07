// Twelve complete, connected human poses in a four-column, three-row atlas.
// Secondary motion is driven by game time, so pausing freezes the whole actor.
export const RUTI_ATLAS=Object.freeze({columns:4,rows:3});

export function rutiPose(actor={},time=0,{reduced=false}={}){
 const action=actor.action,walking=actor.walking&&!reduced,celebrating=!!actor.celebrating;
 const talking=!!actor.speaking&&time<(actor.speechUntil??0);
 const speechAge=Math.max(0,time-(actor.speechStartedAt??0));
 const boundaryAge=Number.isFinite(actor.speechBoundaryAt)?Math.max(0,time-actor.speechBoundaryAt):Infinity;
 const accent=talking?Math.exp(-boundaryAge*8):0;
 // The blink intervals vary, including one occasional double blink. They are
 // deterministic on game time, so a paused/resumed face never jumps ahead.
 const blinkTime=((time%19.8)+19.8)%19.8;
 const blinking=!reduced&&[3.4,7.6,12.9,13.15,18.1].some(start=>blinkTime>=start&&blinkTime<start+.12);
 let frame=0;
 if(celebrating)frame=4;
 else if(action==='water')frame=3;
 else if(action==='broom')frame=4;
 else if(action==='hand')frame=5;
 else if(action==='serve'||action==='peanuts')frame=6;
 else if(walking)frame=Math.floor((actor.walkTime??time)*6)%2?1:2;
 else if(talking&&!reduced){
  const syllableAge=Number.isFinite(actor.speechBoundaryAt)?boundaryAge:speechAge;
  // Word boundaries start a fresh articulation, with short closed-mouth beats
  // between vowels instead of one endlessly repeating four-frame loop.
  frame=[7,0,8,0,7,8,0,7][(Math.floor(syllableAge*8)+(actor.talkBeat||0))%8];
  if(blinking&&syllableAge>.3)frame=11;
 }
 else if(time<(actor.expressionUntil??0))frame=actor.expression==='cheer'?9:actor.expression==='concern'?10:0;
 else if(blinking)frame=11;
 const cycle=reduced?0:Math.sin(time*(walking?12:1.9));
 const dance=reduced?0:Math.sin(time*7.8);
 return {frame,lift:reduced?0:celebrating?Math.abs(dance)*4.5:walking?Math.abs(cycle)*1.8:accent*.45,
  lean:reduced?0:celebrating?dance*.045:action==='broom'?Math.sin(time*10)*.028:action==='hand'?Math.sin(time*14)*.025:cycle*.008+(talking?Math.sin(speechAge*3.1)*.009+accent*.006:0),
  breath:reduced?1:1+Math.sin(time*1.9)*.006+(celebrating?Math.sin(time*7.8)*.002:0),talking,
  headTilt:reduced?0:(talking?Math.sin(speechAge*3.1)*.008+accent*.004:Math.sin(time*.83)*.004),
  headLift:reduced?0:(talking?accent*.0025:Math.sin(time*1.9)*.0008)};
}

const LINES=Object.freeze({
 welcome:[['בואו, נעשה כאן נעים!','Come in! Let’s make this home lovely.']],
 water:[['כל טיפה באהבה.','Every drop with love.'],['יופי, עכשיו הם שמחים!','Lovely! The plants are happy.'],['תראו איך הכול פורח!','Look how everything blooms!']],
 broom:[['ככה אני אוהבת, נקי ונעים!','Just how I like it, clean and cosy!'],['עוד פינה מבריקה!','Another sparkling corner!']],
 hand:[['לכו מפה, חתולים!','Shoo, cats!'],['החתולים נשארים בחוץ!','The cats stay outside!']],
 serve:[['בואו לאכול, הכנתי לכם!','Come and eat! I made this for you.'],['בתיאבון, יקירים שלי!','Enjoy, my dears!']],
 concern:[['לא נורא, ננסה שוב.','Never mind. Let’s try again.'],['רגע, עוד נספיק!','We still have time!']],
 cheer:[['איזה יופי! כל הכבוד לכם!','Wonderful! Well done, everyone!']],
 'select-water':[['קדימה, נשקה את העציצים.','Let’s water the plants.']],
 'select-broom':[['נעשה כאן קצת סדר.','Let’s tidy up a little.']]
});

// Browser speech is optional. Captions and expressions work on every device;
// never send Hebrew to an English-only voice or queue overlapping sentences.
export function createRutiPerformance({getActor,clock=()=>0,english=()=>false,
 synthesis=globalThis.speechSynthesis,Utterance=globalThis.SpeechSynthesisUtterance}={}){
 let enabled=true,unlocked=false,lastLine=-Infinity,serial=0,current=null,started=false;
 const counts=new Map();
 function clearVoice(){
  serial++;const owned=current;current=null;started=false;
  const actor=getActor?.();if(actor)actor.speaking=false;
  if(owned){try{synthesis?.cancel();}catch{}}
 }
 function stop(){clearVoice();const actor=getActor?.();if(actor){actor.speechText='';actor.speechUntil=0;}}
 function setEnabled(value){enabled=!!value;if(!enabled)clearVoice();}
 function unlock(){unlocked=true;}
 function react(kind,{force=false,caption=true}={}){
  const actor=getActor?.();if(!actor)return false;
  const time=clock();actor.expression=kind==='concern'?'concern':kind==='cheer'?'cheer':'smile';actor.expressionUntil=time+(kind==='cheer'?1.8:1.5);
  if(!caption)actor.speechText='';
  const lines=LINES[kind];if(!lines||(!force&&(current||time-lastLine<5)))return false;
  clearVoice();const index=counts.get(kind)||0;counts.set(kind,index+1);
  const text=lines[index%lines.length][english()?1:0],duration=Math.max(2.8,Math.min(5,text.length*.075+1.4));
  actor.speechText=caption?text:'';actor.speechUntil=time+duration;actor.talkBeat=0;actor.speechStartedAt=time;actor.speechBoundaryAt=null;lastLine=time;
  if(!enabled||!unlocked||!synthesis||!Utterance)return true;
  try{
   const language=english()?'en':'he';
   const voices=synthesis.getVoices().filter(voice=>new RegExp(`^${language}(?:-|_|$)`,'i').test(voice.lang));
   if(!voices.length)return true;
   const voice=voices.find(v=>/carmit|hila|samantha|zira|female|shelley/i.test(v.name))||voices[0];
   const utterance=new Utterance(text),token=serial;current=utterance;
   utterance.lang=voice.lang;utterance.voice=voice;utterance.rate=.96;utterance.pitch=1.04;utterance.volume=.8;
   utterance.onstart=()=>{if(token!==serial)return;started=true;actor.speaking=true;actor.speechStartedAt=clock();actor.speechBoundaryAt=clock();actor.speechUntil=clock()+duration;};
   utterance.onboundary=()=>{if(token===serial){actor.talkBeat++;actor.speechBoundaryAt=clock();}};
   const end=()=>{if(token===serial){current=null;started=false;actor.speaking=false;}};
   utterance.onend=end;utterance.onerror=end;synthesis.speak(utterance);
  }catch{clearVoice();}
  return true;
 }
 function update(){
  const actor=getActor?.();if(!actor)return;
  // A speech engine that never starts/finishes cannot strand an open mouth.
  if(current&&(clock()>actor.speechUntil||(!started&&clock()>lastLine+2)))clearVoice();
  if(clock()>actor.speechUntil){actor.speechText='';actor.speaking=false;}
 }
 function reset(){stop();lastLine=-Infinity;counts.clear();}
 return {react,unlock,setEnabled,stop,reset,update};
}
