// Dust remains an object on the floor. A persistent pale silhouette and dark
// edges distinguish it from the wooden boards even at the dimmest pulse.
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
function ellipse(ctx,x,y,rx,ry,fill){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();}
function cloud(ctx,size){
 ctx.beginPath();ctx.moveTo(-size*.64,size*.08);
 ctx.bezierCurveTo(-size*.88,-size*.07,-size*.73,-size*.36,-size*.43,-size*.31);
 ctx.bezierCurveTo(-size*.44,-size*.65,-size*.03,-size*.72,size*.14,-size*.43);
 ctx.bezierCurveTo(size*.38,-size*.62,size*.71,-size*.41,size*.66,-size*.16);
 ctx.bezierCurveTo(size*.94,-size*.08,size*.81,size*.26,size*.54,size*.26);
 ctx.bezierCurveTo(size*.39,size*.45,size*.16,size*.43,size*.04,size*.28);
 ctx.bezierCurveTo(-size*.18,size*.48,-size*.44,size*.36,-size*.47,size*.22);
 ctx.bezierCurveTo(-size*.68,size*.33,-size*.82,size*.16,-size*.64,size*.08);
 ctx.closePath();
}
function text(ctx,value,x,y,size){
 ctx.direction=/[\u0590-\u05ff]/.test(value)?'rtl':'ltr';ctx.font=`800 ${size}px system-ui,sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(value,x,y);
}

export function drawDustSignal(ctx,x,y,size,task,time,{reduced=false,english=false,width=1000,showLabel=true}={}){
 const ratio=task.untimed?1:clamp(task.total>0?task.remaining/task.total:0,0,1);
 const urgent=!task.untimed&&ratio<.25,pulse=reduced?.5:.5+.5*Math.sin(time*Math.PI*2*.9);
 const edge=urgent?'#8b234c':'#274b51',accent=urgent?'#ee759c':'#9bdde8';
 ctx.save();ctx.translate(x,y);ctx.lineJoin='round';ctx.lineCap='round';
 // The highlight always stays visible; it never flashes the cloud off.
 ctx.shadowColor='#fff4bc';ctx.shadowBlur=10+pulse*8;
 ellipse(ctx,0,size*.17,size*(.83+pulse*.035),size*.43,'#fff4d994');ctx.shadowBlur=0;
 cloud(ctx,size);ctx.fillStyle='#f4e8d0';ctx.fill();ctx.strokeStyle='#ffffff';ctx.lineWidth=7;ctx.stroke();
 ctx.strokeStyle=edge;ctx.lineWidth=3;ctx.stroke();
 // Warm flecks keep the object recognizable as loose dust, not a water drop.
 for(let i=0;i<9;i++){
  const a=i*2.399,r=size*(.10+(i%3)*.12);
  ellipse(ctx,Math.cos(a)*r,Math.sin(a)*r*.55-size*.08,Math.max(1.5,size*.035),Math.max(1.5,size*.028),i%2?'#9e7046':'#b78c5b');
 }
 ctx.beginPath();ctx.moveTo(-size*.37,size*.07);ctx.bezierCurveTo(-size*.30,-size*.09,-size*.24,size*.19,-size*.15,size*.06);
 ctx.moveTo(size*.12,-size*.21);ctx.bezierCurveTo(size*.17,-size*.33,size*.28,-size*.10,size*.33,-size*.20);ctx.strokeStyle='#ac8156';ctx.lineWidth=1.4;ctx.stroke();
 for(let i=0;i<3;i++){
  const px=size*(-.48+i*.45),py=-size*(.38+(i%2)*.20)-(reduced?0:Math.sin(time*1.7+i)*2);
  ellipse(ctx,px,py,1.8,1.8,'#9c754c');
 }
 ctx.restore();

 const labelY=Math.max(12,y-size*1.25),labelX=clamp(x,30,width-30);
 ctx.save();ctx.lineWidth=2;
 // Plain ink introduces the dust without putting another framed card or
 // glow behind the word. The physical cloud above stays strongly outlined.
 if(showLabel){ctx.fillStyle=edge;text(ctx,english?'Dust!':'אבק!',labelX,labelY,13);}
 if(!task.untimed){
  const barWidth=size*1.34,barY=y+size*.63;
  ctx.beginPath();ctx.roundRect(x-barWidth/2,barY,barWidth,7,3);ctx.fillStyle=edge;ctx.fill();ctx.strokeStyle='#ffffff';ctx.lineWidth=2;ctx.stroke();
  if(ratio>0){ctx.beginPath();ctx.roundRect(x-barWidth/2+1,barY+1,(barWidth-2)*ratio,5,2);ctx.fillStyle=accent;ctx.fill();}
 }
 ctx.restore();
}
