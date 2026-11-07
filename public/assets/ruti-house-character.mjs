// Twelve complete, connected human poses in a four-column, three-row atlas.
// Secondary motion is driven by game time, so pausing freezes the whole actor.
export const RUTI_ATLAS=Object.freeze({columns:4,rows:3});

export function rutiPose(actor={},time=0,{reduced=false}={}){
 const action=actor.action,walking=actor.walking&&!reduced;
 const talking=!!actor.speaking&&time<(actor.speechUntil??0);
 let frame=0;
 if(action==='water')frame=3;
 else if(action==='broom')frame=4;
 else if(action==='hand')frame=5;
 else if(action==='serve'||action==='peanuts')frame=6;
 else if(walking)frame=Math.floor((actor.walkTime??time)*6)%2?1:2;
 else if(talking&&!reduced)frame=[7,0,8,0][Math.floor(time*8+(actor.talkBeat||0))%4];
 else if(time<(actor.expressionUntil??0))frame=actor.expression==='cheer'?9:actor.expression==='concern'?10:0;
 else if(!reduced&&time%4.7>4.52)frame=11;
 const cycle=reduced?0:Math.sin(time*(walking?12:1.9));
 return {frame,lift:walking?Math.abs(cycle)*1.8:0,lean:reduced?0:action==='broom'?Math.sin(time*10)*.028:action==='hand'?Math.sin(time*14)*.025:cycle*.008,
  breath:reduced?1:1+Math.sin(time*1.9)*.006,talking};
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
 function react(kind,{force=false}={}){
  const actor=getActor?.();if(!actor)return false;
  const time=clock();actor.expression=kind==='concern'?'concern':kind==='cheer'?'cheer':'smile';actor.expressionUntil=time+(kind==='cheer'?1.8:1.5);
  const lines=LINES[kind];if(!lines||(!force&&(current||time-lastLine<5)))return false;
  clearVoice();const index=counts.get(kind)||0;counts.set(kind,index+1);
  const text=lines[index%lines.length][english()?1:0],duration=Math.max(2.8,Math.min(5,text.length*.075+1.4));
  actor.speechText=text;actor.speechUntil=time+duration;actor.talkBeat=0;lastLine=time;
  if(!enabled||!unlocked||!synthesis||!Utterance)return true;
  try{
   const language=english()?'en':'he';
   const voices=synthesis.getVoices().filter(voice=>new RegExp(`^${language}(?:-|_|$)`,'i').test(voice.lang));
   if(!voices.length)return true;
   const voice=voices.find(v=>/carmit|hila|samantha|zira|female|shelley/i.test(v.name))||voices[0];
   const utterance=new Utterance(text),token=serial;current=utterance;
   utterance.lang=voice.lang;utterance.voice=voice;utterance.rate=.96;utterance.pitch=1.04;utterance.volume=.8;
   utterance.onstart=()=>{if(token!==serial)return;started=true;actor.speaking=true;actor.speechUntil=clock()+duration;};
   utterance.onboundary=()=>{if(token===serial)actor.talkBeat++;};
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
