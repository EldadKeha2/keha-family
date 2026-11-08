// Coordinates are normalized to the scene. The supplied pathfinder owns walls
// and furniture; this controller owns walking, carried-tool poses and timing.
export function createHouseActor(start={x:.5,y:.8}){
  return {
    x:coordinate(start.x,.5),y:coordinate(start.y,.8),facing:1,
    walking:false,action:null,tool:null,walkTime:0,actionProgress:0
  };
}

const EPSILON=1e-7;
const coordinate=(value,fallback)=>Number.isFinite(value)?Math.max(0,Math.min(1,value)):fallback;
const validPoint=point=>point&&Number.isFinite(point.x)&&Number.isFinite(point.y);

// A wide board needs much longer pointer travel. Keep phone pacing and give
// desktop walking a separate boost; action and household clocks stay real time.
export function houseWalkingSpeed(width=390){return .68*(Number.isFinite(width)&&width>700?3.5:1);}

export function createHouseMotion(actor,findPath=(from,to)=>[to],{speed=.65,aspect=()=>1}={}){
  function maximumSpeed(){const value=typeof speed==='function'?speed():speed;return Number.isFinite(value)&&value>0?value:.65;}
  let route=[],cursor=0,velocity=0,phase='idle',command=null,actionTime=0;

  function ratio(){
    const value=typeof aspect==='function'?aspect():aspect;
    return Number.isFinite(value)&&value>0?Math.max(.25,Math.min(4,value)):1;
  }
  const distance=(from,to,scale)=>Math.hypot((to.x-from.x)*scale,to.y-from.y);

  function cancel(){
    route=[];cursor=0;velocity=0;phase='idle';command=null;actionTime=0;
    actor.walking=false;actor.action=null;actor.actionProgress=0;
  }

  function arrive(){
    velocity=0;phase='acting';actor.walking=false;
    actor.action=command.action;actor.actionProgress=0;actionTime=0;
  }

  function walkTo(destination,{action=null,duration=0,payload=null}={}){
    cancel();
    if(!validPoint(destination))return false;
    const target={x:coordinate(destination.x,actor.x),y:coordinate(destination.y,actor.y)};
    let points;
    try{points=findPath({x:actor.x,y:actor.y},target);}catch{return false;}
    if(!Array.isArray(points)||points.some(point=>!validPoint(point)))return false;
    route=points.map(point=>({x:coordinate(point.x,actor.x),y:coordinate(point.y,actor.y)}));
    // An empty path only means "already there", never "teleport through a wall".
    if(!route.length&&distance(actor,target,ratio())>EPSILON)return false;
    command={action,duration:Number.isFinite(duration)?Math.max(0,duration):0,payload};
    while(cursor<route.length&&distance(actor,route[cursor],ratio())<EPSILON)cursor++;
    if(cursor===route.length)arrive();
    else{phase='walking';actor.walking=true;actor.action=null;actor.actionProgress=0;}
    return true;
  }

  function remainingDistance(scale){
    let result=0,previous=actor;
    for(let i=cursor;i<route.length;i++){result+=distance(previous,route[i],scale);previous=route[i];}
    return result;
  }

  function move(amount,scale){
    while(cursor<route.length){
      const target=route[cursor],segment=distance(actor,target,scale);
      if(segment<EPSILON){actor.x=target.x;actor.y=target.y;cursor++;continue;}
      const dx=target.x-actor.x;
      if(Math.abs(dx)>EPSILON)actor.facing=dx>0?1:-1;
      if(amount>=segment){actor.x=target.x;actor.y=target.y;amount-=segment;cursor++;}
      else{const progress=amount/segment;actor.x+=(target.x-actor.x)*progress;actor.y+=(target.y-actor.y)*progress;break;}
    }
  }

  function complete(){
    const result={payload:command.payload,action:command.action};
    cancel();return result;
  }

  function tick(dt){
    if(!command||!Number.isFinite(dt)||dt<0)return null;
    // Callers pause by not ticking. A very stale frame cannot fast-forward an
    // unbounded amount of work, while ordinary long ticks retain leftover time.
    let time=Math.min(dt,60);
    while(command){
      if(phase==='acting'){
        if(command.duration<=actionTime+EPSILON)return complete();
        if(time<=EPSILON)return null;
        const used=Math.min(time,command.duration-actionTime);
        actionTime+=used;time-=used;
        actor.actionProgress=Math.min(1,actionTime/command.duration);
        if(actionTime+EPSILON>=command.duration)return complete();
        return null;
      }
      if(time<=EPSILON)return null;
      const scale=ratio(),left=remainingDistance(scale),limit=maximumSpeed(),acceleration=limit*6;
      if(left<EPSILON){arrive();continue;}
      // Short integration steps make acceleration and braking independent of
      // display refresh rate, and keep every corner on the pathfinder's route.
      const step=Math.min(time,1/90);
      const desired=Math.min(limit,Math.sqrt(2*acceleration*left));
      const next=velocity+Math.max(-acceleration*step,Math.min(acceleration*step,desired-velocity));
      const travel=(velocity+next)*.5*step;
      const used=travel>=left?step*(left/travel):step;
      move(Math.min(travel,left),scale);actor.walkTime+=used;time-=used;velocity=next;
      if(cursor>=route.length)arrive();
    }
    return null;
  }

  return {walkTo,tick,cancel,get busy(){return command!==null;},get state(){return phase;}};
}
