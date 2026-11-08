const ease=n=>{const t=Math.max(0,Math.min(1,n));return t*t*(3-2*t);};
// Three grounded weight changes and a held fourth beat. Each measure advances
// around the circle; the middle step rocks back before the crossing step.
export function yemeniteCircleStep(elapsed,{beatSeconds=.4,reduced=false}={}){
 const beats=reduced?0:Math.max(0,elapsed)/beatSeconds,beat=Math.floor(beats),part=beats-beat,step=beat%4;
 const travel=[0,.65,.30,1,1],measure=Math.floor(beat/4),blend=step===3?1:ease(part/.78);
 return {step,part,turn:measure+travel[step]+(travel[step+1]-travel[step])*blend,
  pulse:reduced||step===3?0:Math.sin(part*Math.PI),activeFoot:step===1?'left':'right',
  rock:reduced?0:[-.012,.018,-.006,0][step]*Math.sin(part*Math.PI)};
}
export function yemeniteCircleDancers(ids,{width,height,elapsed=0,beatSeconds=.4,reduced=false}={}){
 const step=yemeniteCircleStep(elapsed,{beatSeconds,reduced});
 const rx=width*.40,ry=height*(width<600?.16:.135),cy=height*.70;
 const size=Math.min(132,height*.245,width*.225);
 return ids.map((id,index)=>{
  const angle=index/ids.length*Math.PI*2+step.turn*Math.PI*2/32,depth=(Math.sin(angle)+1)/2;
  return {id,index,angle,x:width*.5+Math.cos(angle)*rx,y:cy+Math.sin(angle)*ry,
   height:size*(.77+.23*depth),facing:Math.sin(angle)>0?1:-1,step:step.step,
   footLeftX:step.activeFoot==='left'?step.pulse*.028:0,
   footRightX:step.activeFoot==='right'?step.pulse*.028:0,
   footLeftLift:step.activeFoot==='left'?step.pulse*.013:0,
   footRightLift:step.activeFoot==='right'?step.pulse*.013:0,
   lean:step.rock,lift:step.pulse*1.2};
 }).sort((a,b)=>a.y-b.y);
}
