import {createHouseActor,createHouseMotion} from './ruti-house-motion.mjs?v=2';

export const BRIDGE_PLAY_SECONDS=20;
const ease=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};

// A self-contained interlude: the caller freezes household time while this
// controller moves four players to the real table, then resumes automatically.
export function createBridgeBreak(ruti,getLayout,{findPath,getSeat}={}){
  const home={x:ruti.x,y:ruti.y,tool:ruti.tool},players=[];
  let phase='arriving',phaseTime=0,playedSeconds=0;
  const motion=actor=>createHouseMotion(actor,(from,to)=>findPath(getLayout(),from,to),{speed:.58,aspect:()=>getLayout().width/getLayout().height});
  const layout=getLayout(),door=layout.doors[0];
  const make=(actor,seat,guest=null)=>{
    const p={actor,seat,guest,motion:motion(actor),arrived:false,seated:false,blend:0};
    actor.tool=null;actor.action=null;actor.sitting=0;
    p.motion.walkTo(getSeat(seat,layout).anchor,{payload:{type:'seat'}});players.push(p);return p;
  };
  const host=make(ruti,7);
  ['visitor-hila','visitor-rivi','visitor-lihi'].forEach((guest,index)=>make(createHouseActor({x:Math.min(1,door.x+.05+index*.015),y:door.y+index*.028}),[4,6,1][index],guest));
  function moveToSeats(dt){
    for(const p of players){
      if(!p.arrived&&p.motion.tick(dt)){p.arrived=true;p.from={x:p.actor.x,y:p.actor.y};}
      if(!p.arrived)continue;
      p.blend=Math.min(1,p.blend+dt/.55);const t=ease(p.blend),seat=getSeat(p.seat,getLayout());
      p.actor.x=p.from.x+(seat.x-p.from.x)*t;p.actor.y=p.from.y+(seat.y-p.from.y)*t;p.actor.sitting=t;p.actor.walking=false;p.actor.facing=p.seat===6||p.seat===7?-1:1;
      p.seated=p.blend===1;
    }
    if(players.every(p=>p.seated)){phase='playing';phaseTime=0;}
  }
  function beginDeparture(){phase='standing';phaseTime=0;for(const p of players)p.from={x:p.actor.x,y:p.actor.y};}
  function stand(dt){
    phaseTime=Math.min(.55,phaseTime+dt);const t=ease(phaseTime/.55);
    for(const p of players){const seat=getSeat(p.seat,getLayout());p.actor.sitting=1-t;p.actor.x=p.from.x+(seat.anchor.x-p.from.x)*t;p.actor.y=p.from.y+(seat.anchor.y-p.from.y)*t;}
    if(phaseTime<.55)return;
    phase='leaving';for(const p of players){p.finished=false;p.motion.walkTo(p===host?home:getLayout().doors[0].anchor,{payload:{type:'leave'}});}
  }
  function tick(dt){
    if(!Number.isFinite(dt)||dt<=0||phase==='done')return;
    if(phase==='arriving')moveToSeats(dt);
    else if(phase==='playing'){playedSeconds=Math.min(BRIDGE_PLAY_SECONDS,playedSeconds+dt);if(playedSeconds>=BRIDGE_PLAY_SECONDS)beginDeparture();}
    else if(phase==='standing')stand(dt);
    else if(phase==='leaving'){
      for(const p of players)if(!p.finished&&p.motion.tick(dt))p.finished=true;
      if(players.every(p=>p.finished)){phase='done';ruti.tool=home.tool;ruti.sitting=0;ruti.walking=false;ruti.action=null;}
    }
  }
  function visual(){return {phase,playedSeconds,players:players.filter(p=>p.guest&&!p.finished).map(p=>({guest:p.guest,...p.actor})),host:{...ruti},active:phase!=='done'};}
  return {tick,visual,get done(){return phase==='done';},get phase(){return phase;},get playedSeconds(){return playedSeconds;}};
}
