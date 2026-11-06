import {iconArtwork} from './ruti-house-art.mjs';

const FOOD_IDS=['tahini','carrot','kubaneh','eggplant','lasagna'];
const ICON_IDS=[...FOOD_IDS,'bowl','knife','oven','water','broom','hand','serve','peanuts','plant','dust','cat'];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const length=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const departureRoutes=new WeakMap();

/** Images are immediately usable when loaded; ready never rejects for optional art. */
export function createSceneAssets({family={}}={}){
 const images={ruti:null,icons:{},family:{}};const jobs=[];
 function load(url,put){if(typeof Image==='undefined')return;const image=new Image();put(image);jobs.push(new Promise(resolve=>{image.onload=resolve;image.onerror=resolve;}));image.src=url;}
 load('assets/games/portraits/ruti.webp',image=>images.ruti=image);
 for(const id of ICON_IDS)load('data:image/svg+xml;charset=utf-8,'+encodeURIComponent(iconArtwork(id)),image=>images.icons[id]=image);
 for(const [id,value] of Object.entries(family)){if(typeof value==='string')load(value,image=>images.family[id]=image);else if(value)images.family[id]=value;}
 images.ready=Promise.all(jobs).then(()=>images);return images;
}

/** x/y are normalized to width/height. hitRadius is normalized to the shorter side. */
export function getHouseLayout(width,height){
 const portrait=width/height<.95;
 const xs=portrait?[.12,.31,.50,.69,.88]:[.12,.265,.41,.555,.70];
 const recipeY=portrait?.17:.165,anchorY=portrait?.345:.36;
 const recipes=Object.fromEntries(FOOD_IDS.map((id,i)=>[id,{x:xs[i],y:recipeY,hitRadius:portrait?.07:.052,anchor:{x:xs[i],y:anchorY}}]));
 const plants=(portrait?[[.88,.39],[.89,.61],[.73,.87],[.12,.87],[.31,.53]]:[[.86,.335],[.91,.53],[.75,.86],[.12,.86],[.30,.53]])
  .map(([x,y],slot)=>({x,y,slot,hitRadius:portrait?.07:.053,anchor:{x:x+(x>.7?-55:55)/width,y:y+24/height}}));
 const doors=[{x:.945,y:.765,hitRadius:.071,anchor:{x:.945-55/width,y:.765},side:'right'},{x:.045,y:.55,hitRadius:.071,anchor:{x:.045+55/width,y:.55},side:'left'}];
 const sofa=portrait?{x:.48,y:.43,w:.28,h:.105}:{x:.50,y:.43,w:.26,h:.125};
 const table=portrait?{x:.45,y:.68,w:.26,h:.09}:{x:.47,y:.68,w:.25,h:.105};
 const counter={x:.045,y:.13,w:portrait?.91:.74,h:portrait?.155:.18};
 const obstacles=[counter,sofa,table,...plants.map(p=>({x:p.x-.033,y:p.y-.028,w:.066,h:.04}))];
 const layout={width,height,portrait,recipes,plants,doors,pickup:{x:.40,y:.90,hitRadius:.06,anchor:{x:.40,y:.84}},obstacles,sofa,table,counter,
  walkBounds:{left:.055,right:.945,top:portrait?.325:.34,bottom:.94},spawn:{x:.42,y:.51}};
 // Reach is measured in CSS pixels so a wider canvas never leaves Ruti a
 // metre from her watering target. Project awkward anchors onto open floor.
 for(const target of [...plants,...doors])target.anchor=nearestFloor(layout,target.anchor);
 return layout;
}

function blocked(layout,point,margin=0){return layout.obstacles.some(o=>point.x>o.x-margin&&point.x<o.x+o.w+margin&&point.y>o.y-margin&&point.y<o.y+o.h+margin);}
function nearestFloor(layout,point){
 const b=layout.walkBounds,p={x:clamp(point.x,b.left,b.right),y:clamp(point.y,b.top,b.bottom)};
 if(!blocked(layout,p,.015))return p;
 let best=null,bestDistance=Infinity;
 for(let row=0;row<=28;row++)for(let col=0;col<=32;col++){
  const q={x:b.left+(b.right-b.left)*col/32,y:b.top+(b.bottom-b.top)*row/28};if(blocked(layout,q,.018))continue;
  const d=length(p,q);if(d<bestDistance){bestDistance=d;best=q;}
 }
 return best||layout.spawn;
}

export function getTaskLocation(task,layout){
 if(task.type==='plant')return layout.plants[Math.abs(task.slot||0)%layout.plants.length];
 if(task.type==='dust'){
  const raw=task.position||{x:.15+((task.slot||0)*.137)% .70,y:.40+((task.slot||0)*.113)% .45};
  const p=nearestFloor(layout,raw);return {...p,hitRadius:layout.portrait?.070:.052,anchor:{...p}};
 }
 const index=Math.abs(task.door??task.doorIndex??task.slot??0)%layout.doors.length;
 const door=layout.doors[index];return {...door,anchor:{...door.anchor}};
}

/** Walkable-floor A* with inflated furniture boundaries and diagonal corner checks. */
export function findHousePath(layout,from,to){
 const start=nearestFloor(layout,from),goal=nearestFloor(layout,to),cols=44,rows=clamp(Math.round(cols*layout.height/layout.width),26,72),b=layout.walkBounds;
 const point=(x,y)=>({x:b.left+(b.right-b.left)*x/(cols-1),y:b.top+(b.bottom-b.top)*y/(rows-1)});
 const grid=p=>({x:clamp(Math.round((p.x-b.left)/(b.right-b.left)*(cols-1)),0,cols-1),y:clamp(Math.round((p.y-b.top)/(b.bottom-b.top)*(rows-1)),0,rows-1)});
 const walk=(x,y)=>x>=0&&y>=0&&x<cols&&y<rows&&!blocked(layout,point(x,y),.012);
 const key=(x,y)=>y*cols+x;let a=grid(start),z=grid(goal);
 function openCell(cell){if(walk(cell.x,cell.y))return cell;let best=null,d=Infinity;for(let y=0;y<rows;y++)for(let x=0;x<cols;x++)if(walk(x,y)){const n=Math.hypot(x-cell.x,y-cell.y);if(n<d){d=n;best={x,y};}}return best||cell;}
 a=openCell(a);z=openCell(z);
 const begin=key(a.x,a.y),end=key(z.x,z.y),open=new Set([begin]),cost=new Map([[begin,0]]),parents=new Map();
 const heuristic=n=>Math.hypot((n%cols)-z.x,Math.floor(n/cols)-z.y);
 let found=false;
 for(let guard=0;open.size&&guard<cols*rows;guard++){
  let current=null,score=Infinity;for(const n of open){const f=cost.get(n)+heuristic(n);if(f<score){score=f;current=n;}}
  if(current===end){found=true;break;}open.delete(current);const x=current%cols,y=Math.floor(current/cols);
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
   const nx=x+dx,ny=y+dy;if(!walk(nx,ny)||(dx&&dy&&(!walk(x+dx,y)||!walk(x,y+dy))))continue;
   const next=key(nx,ny),g=cost.get(current)+(dx&&dy?Math.SQRT2:1);if(g>=(cost.get(next)??Infinity))continue;
   parents.set(next,current);cost.set(next,g);open.add(next);
  }
 }
 if(!found)return [start];
 const chain=[];for(let n=end;n!==undefined;n=parents.get(n)){chain.push(point(n%cols,Math.floor(n/cols)));if(n===begin)break;}
 chain.reverse();const simplified=[];let previousDirection=null;
 for(let i=1;i<chain.length;i++){const dx=Math.sign(chain[i].x-chain[i-1].x),dy=Math.sign(chain[i].y-chain[i-1].y),direction=`${dx}:${dy}`;if(direction!==previousDirection&&i>1)simplified.push(chain[i-1]);previousDirection=direction;}
 if(chain.length)simplified.push(chain.at(-1));
 if(!blocked(layout,goal,.012)&&length(simplified.at(-1)||start,goal)>1e-8)simplified.push(goal);
 return simplified.length?simplified:[goal];
}

function rounded(ctx,x,y,w,h,r=8){ctx.beginPath();ctx.roundRect(x,y,w,h,r);}
function box(ctx,x,y,w,h,fill,stroke=null,r=8){rounded(ctx,x,y,w,h,r);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.stroke();}}
function ellipse(ctx,x,y,rx,ry,fill,stroke=null){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.stroke();}}
function line(ctx,x1,y1,x2,y2,color,width=2){ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();}
function polygon(ctx,points,fill,stroke=null){ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.stroke();}}
function imageReady(image){return image&&image.complete&&image.naturalWidth>0;}
function icon(ctx,images,id,x,y,size){const image=images?.icons?.[id];if(imageReady(image)){ctx.drawImage(image,x-size/2,y-size/2,size,size);return true;}return false;}
function label(ctx,text,x,y,{size=12,color='#574634',align='center',weight='600',halo=true}={}){ctx.font=`${weight} ${size}px system-ui,sans-serif`;ctx.textAlign=align;ctx.textBaseline='middle';if(halo){ctx.strokeStyle='#fff6df';ctx.lineWidth=4;ctx.strokeText(text,x,y);}ctx.fillStyle=color;ctx.fillText(text,x,y);}
function halo(ctx,x,y,r,time,color='#dfa742',urgent=false){const pulse=.5+.5*Math.sin(time*(urgent?9:4));const gradient=ctx.createRadialGradient(x,y,r*.15,x,y,r*1.8);gradient.addColorStop(0,color+'77');gradient.addColorStop(1,color+'00');ctx.fillStyle=gradient;ctx.beginPath();ctx.arc(x,y,r*(1.45+pulse*.15),0,Math.PI*2);ctx.fill();ctx.strokeStyle=color;ctx.lineWidth=2+pulse;ctx.setLineDash([5,5]);ctx.beginPath();ctx.arc(x,y,r*(1.05+pulse*.05),0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);}
function timer(ctx,x,y,r,task){const ratio=clamp(task.remaining/task.total,0,1);ctx.beginPath();ctx.arc(x,y,r,-Math.PI/2,-Math.PI/2+Math.PI*2*ratio);ctx.strokeStyle=ratio<.25?'#c94a3e':ratio<.5?'#df9f36':'#67885a';ctx.lineWidth=4;ctx.stroke();}

function drawPlant(ctx,x,y,size,index,thirsty,time){
 const pots=['#c27d56','#d8a267','#76968c','#bc745e','#bc9a64'];const leaf=['#658b51','#668968','#829752','#688c5e','#759e69'][index%5];
 ctx.save();ctx.translate(x,y);const s=size/64;ctx.scale(s,s);ctx.lineWidth=2;ctx.lineJoin='round';ctx.lineCap='round';
 ellipse(ctx,0,21,25,7,'#785b3a22');
 const sway=thirsty?Math.sin(time*5)*1.5:Math.sin(time*1.1+index)*.7;
 const droop=thirsty?9:0;
 for(let i=0;i<6;i++){
  const direction=i%2?-1:1,ax=direction*(12+(i%3)*6),ay=-5-i*6+droop;
  line(ctx,0,10,ax+sway,ay,'#57784c',2.5);
  ctx.save();ctx.translate(ax+sway,ay);ctx.rotate(direction*(.6+droop*.04));ellipse(ctx,0,0,6+index%3,13-(i%2)*3,thirsty?'#afa05b':leaf,'#57754a');line(ctx,0,-8,0,8,'#a8bb7d',1);ctx.restore();
 }
 polygon(ctx,[[-18,8],[18,8],[13,31],[-12,31]],pots[index%5],'#805f43');box(ctx,-21,5,42,9,pots[index%5],'#805f43',3);line(ctx,-9,17,-7,26,'#f7d8b044',3);
 if(index===4)for(const [fx,fy] of [[-15,-9],[12,-17],[0,-27]]){for(let p=0;p<5;p++)ellipse(ctx,fx+Math.cos(p*1.26)*4,fy+Math.sin(p*1.26)*4,3,3,'#d19a8d');ellipse(ctx,fx,fy,2,2,'#eccc75');}
 ctx.restore();
}

function drawDust(ctx,x,y,size,time,remaining){
 ctx.save();ctx.translate(x,y);ctx.globalAlpha=clamp(remaining/.5,.2,1);const palette=['#c2ad8c','#dfcfac','#b5a188'];
 for(let i=0;i<10;i++){const a=i*2.399+Math.sin(time)*.1,r=size*(.12+(i%4)*.075);ellipse(ctx,Math.cos(a)*r,Math.sin(a)*r*.55,size*(.12+(i%3)*.035),size*.11,palette[i%3]);}
 for(let i=0;i<7;i++){const a=i*2.1+time*.12;ellipse(ctx,Math.cos(a)*size*.55,Math.sin(a)*size*.25,1.8,1.8,'#a58f70');}
 ctx.restore();
}

function drawCat(ctx,x,y,size,time,progress,side){
 ctx.save();ctx.translate(x,y);if(side==='left')ctx.scale(-1,1);const s=size/64;ctx.scale(s,s);ctx.lineWidth=2;ctx.lineCap='round';
 ellipse(ctx,0,22,27,6,'#543d2926');
 ctx.save();ctx.translate(20,4);ctx.rotate(Math.sin(time*3)*.18);ctx.beginPath();ctx.moveTo(0,9);ctx.bezierCurveTo(22,7,19,-14,11,-15);ctx.strokeStyle='#aa8058';ctx.lineWidth=7;ctx.stroke();ctx.restore();
 ellipse(ctx,3,9,23,15,'#c49b6f','#76583e');
 const step=Math.sin(time*6)*Math.min(progress,.8)*3;line(ctx,-11,16,-13+step,26,'#ac8058',6);line(ctx,15,16,17-step,26,'#ac8058',6);
 polygon(ctx,[[-25,-8],[-27,-28],[-14,-20],[-5,-27],[-3,-7]],'#ccaa7f','#76583e');ellipse(ctx,-15,-7,17,14,'#d5b48b','#76583e');
 polygon(ctx,[[-24,-20],[-23,-13],[-18,-18]],'#d29b93');polygon(ctx,[[-7,-20],[-13,-18],[-8,-14]],'#d29b93');
 ellipse(ctx,-23,-8,2,2.6,'#4f4d36');ellipse(ctx,-10,-8,2,2.6,'#4f4d36');polygon(ctx,[[-18,-2],[-14,-2],[-16,1]],'#b47770');
 line(ctx,-27,-1,-37,-3,'#786249',1);line(ctx,-27,3,-37,5,'#786249',1);line(ctx,-7,0,2,-3,'#786249',1);
 if(progress>.7)label(ctx,'!',5,-34,{size:20,color:'#c14f35'});
 ctx.restore();
}

function routePosition(points,progress,width,height){
 const lengths=points.slice(1).map((p,i)=>Math.hypot((p.x-points[i].x)*width,(p.y-points[i].y)*height));
 let remaining=lengths.reduce((a,b)=>a+b,0)*progress;
 for(let i=0;i<lengths.length;i++){
  if(remaining<=lengths[i]||i===lengths.length-1){const t=lengths[i]?clamp(remaining/lengths[i],0,1):1;return {x:points[i].x+(points[i+1].x-points[i].x)*t,y:points[i].y+(points[i+1].y-points[i].y)*t,facing:points[i+1].x<points[i].x?-1:1};}
  remaining-=lengths[i];
 }
 return {...points.at(-1),facing:1};
}

function guestDeparturePosition(departure,layout,progress){
 const key=`${layout.width}:${layout.height}`;let cached=departureRoutes.get(departure);
 if(!cached||cached.key!==key){
  const door=layout.doors[Math.abs(departure.door??0)%2],sgn=door.side==='left'?1:-1,M=Math.min(layout.width,layout.height);
  const start={x:door.x+sgn*M*.04/layout.width,y:door.y+M*.04/layout.height};
  const goal=nearestFloor(layout,{x:.42,y:.64});
  cached={key,points:[start,door.anchor,...findHousePath(layout,door.anchor,goal)]};departureRoutes.set(departure,cached);
 }
 return routePosition(cached.points,progress,layout.width,layout.height);
}

function drawHuman(ctx,x,y,height,{portrait=null,guest=false,index=0,time=0,facing=1,walking=false,action=null,tool=null,carryDish=null,actionProgress=0,images=null,english=false}={}){
 ctx.save();ctx.translate(x,y);const s=height/100;ctx.scale(s,s);ctx.lineCap='round';ctx.lineJoin='round';
 const cycle=walking?Math.sin(time*13):0,bob=walking?Math.abs(cycle)*2:Math.sin(time*1.8)*.4;
 ellipse(ctx,0,0,22,5,'#4c382c35');ctx.translate(0,-bob);
 // Alternating feet and hem make movement visible even without a portrait.
 line(ctx,-9,-26,-11+cycle*8,-5,'#81573d',8);line(ctx,9,-26,11-cycle*8,-5,'#81573d',8);
 ellipse(ctx,-12+cycle*8,-3,8,3.5,'#584c3c');ellipse(ctx,12-cycle*8,-3,8,3.5,'#584c3c');
 const dress=guest?['#789292','#ba896b','#a77983'][index%3]:'#a36963';
 polygon(ctx,[[-13,-66],[13,-66],[21,-25],[-21,-25]],dress,'#6e5040');
 if(!guest){polygon(ctx,[[-8,-60],[9,-60],[14,-30],[-13,-30]],'#f1dfb7','#c4aa85');line(ctx,-9,-55,-18,-63,'#eeddb9',3);line(ctx,10,-55,17,-63,'#eeddb9',3);box(ctx,-7,-43,14,9,'#d2b68e',null,2);for(let i=0;i<3;i++)ellipse(ctx,-6+i*6,-49,1.2,1.5,'#a2a585');}
 const waving=action==='hand',sweeping=action==='broom',watering=action==='water',serving=action==='serve'||action==='peanuts';
 const direction=typeof facing==='number'?(facing<0?-1:1):facing==='left'?-1:1;
 let handX=direction*22,handY=-40;
 if(waving){handX=direction*(25+Math.sin(time*18)*5);handY=-73+Math.cos(time*18)*7;}
 else if(sweeping){handX=direction*(29+Math.sin(time*15)*7);handY=-38;}
 else if(watering||serving){handX=direction*35;handY=-48+Math.sin(time*8)*1.8;}
 else if(action){handX=direction*27;handY=-48+Math.sin(time*17)*4;}
 const armSwing=walking?cycle*7:0;
 line(ctx,-13,-60,-23-armSwing,-39,'#bc8a69',7);line(ctx,13*direction,-60,handX,handY,'#bc8a69',7);ellipse(ctx,handX,handY,4.5,4.5,'#d8a983');
 // Curly hair silhouette surrounds a recognizable round photograph.
 for(let i=0;i<11;i++){const a=Math.PI+i*Math.PI/10;ellipse(ctx,Math.cos(a)*17,-81+Math.sin(a)*18,7,7,guest?'#614b3d':'#60422f');}
 ellipse(ctx,0,-80,18,20,'#dab08b','#71513b');
 if(imageReady(portrait)){
  ctx.save();ctx.beginPath();ctx.ellipse(0,-80,17,19,0,0,Math.PI*2);ctx.clip();
  const iw=portrait.naturalWidth,ih=portrait.naturalHeight;ctx.drawImage(portrait,iw*.14,ih*.07,iw*.72,ih*.76,-20,-103,40,45);ctx.restore();
 }else{
  ellipse(ctx,-7,-82,2,2,'#574b3c');ellipse(ctx,7,-82,2,2,'#574b3c');
  ctx.beginPath();ctx.arc(0,-75,7,.2,Math.PI-.2);ctx.strokeStyle='#a46858';ctx.lineWidth=1.7;ctx.stroke();
  if(!guest){box(ctx,-15,-87,13,10,'#ffffff11','#665b4a',3);box(ctx,2,-87,13,10,'#ffffff11','#665b4a',3);line(ctx,-2,-83,2,-83,'#665b4a',1.5);}
 }
 if(!guest){ellipse(ctx,-18,-77,1.8,2.2,'#dac184');ellipse(ctx,18,-77,1.8,2.2,'#dac184');}
 if(tool||action){
  const active=action||tool;let px=handX+direction*8,py=handY+1;
  if(active==='broom'){
   const swing=sweeping?Math.sin(time*15)*.15:0;ctx.save();ctx.translate(handX,handY);ctx.rotate(direction*.28+swing);line(ctx,0,-13,0,34,'#ad7b51',4);polygon(ctx,[[-5,27],[6,27],[12,43],[-12,43]],'#d6b568','#967346');for(let i=-6;i<=6;i+=4)line(ctx,i,32,i*1.4,42,'#b08e48',1);ctx.restore();
   if(sweeping)for(let i=0;i<5;i++)ellipse(ctx,handX+Math.cos(time*9+i)*19,7+Math.sin(i)*3,2,1.4,'#c5b087');
  }else if(active==='hand'){
   icon(ctx,images,'hand',px,py-5,23);if(waving)label(ctx,english?'Shoo!':'לכו מפה!',0,-118,{size:13,color:'#a5553e'});
  }else{
   if(active==='serve'){
    ellipse(ctx,px,py+7,21,5,'#d8c99e','#837552');
    if(carryDish)icon(ctx,images,carryDish,px,py-3,31);
    else{ellipse(ctx,px,py+3,15,4,'#f5e8c4','#9b987a');line(ctx,px-18,py+10,px+18,py+10,'#a49773',1.5);}
   }else icon(ctx,images,active,px,py,serving?34:29);
   if(watering){for(let i=0;i<9;i++){const t=(time*2+i/9)%1;ellipse(ctx,px+direction*(12+t*17),py+6+t*t*40,1.4,2.2,'#74b9c8');}}
   if(active==='knife'&&action)line(ctx,px-12,py+18,px+13,py+18,'#bd8c5b',4);
   if((active==='bowl'||active==='oven')&&action)for(let i=0;i<3;i++)ellipse(ctx,px+Math.sin(time*6+i)*8,py-15-((time*11+i*5)%17),1.2,2.5,'#fff6d5aa');
  }
 }
 ctx.restore();
}

function drawRoom(ctx,l,{time,english,reduced}){
 const W=l.width,H=l.height,M=Math.min(W,H),P=(x,y)=>[x*W,y*H];ctx.lineWidth=Math.max(1,M/430);ctx.lineJoin='round';
 const wall=ctx.createLinearGradient(0,0,0,H*.36);wall.addColorStop(0,'#f9edd2');wall.addColorStop(1,'#e4d1ac');
 ctx.fillStyle=wall;ctx.fillRect(0,0,W,H);
 const floor=ctx.createLinearGradient(0,H*.29,W,H);floor.addColorStop(0,'#d5aa7c');floor.addColorStop(.5,'#dfba8b');floor.addColorStop(1,'#bc8b61');ctx.fillStyle=floor;ctx.fillRect(0,H*.30,W,H*.70);
 // Real floor boards, tiny knots, and soft light: not UI panels.
 ctx.save();ctx.beginPath();ctx.rect(0,H*.30,W,H*.70);ctx.clip();
 for(let y=H*.30,row=0;y<H;y+=M*.07,row++){line(ctx,0,y,W,y,'#9c71442c',1);const offset=(row%2)*M*.16;for(let x=offset;x<W;x+=M*.32){line(ctx,x,y,x,y+M*.07,'#9c714423',1);if(row%3===1)ellipse(ctx,x+M*.14,y+M*.028,M*.012,M*.002,'#a47c4a1a');}}
 ctx.restore();line(ctx,0,H*.30,W,H*.30,'#a98159',M*.012);line(ctx,0,H*.31,W,H*.31,'#f5ddb2',M*.006);
 // Wainscoting and kitchen tiles.
 for(let x=0;x<W*.79;x+=M*.06){line(ctx,x,H*.10,x,H*.30,'#a59f7926',1);line(ctx,x,H*.18,x+M*.06,H*.18,'#a59f7926',1);}
 const cabinetY=H*.025,cabinetH=H*.075,cabinetW=W*(l.portrait?.15:.115);
 for(let i=0;i<5;i++){const x=l.recipes[FOOD_IDS[i]].x*W-cabinetW/2;box(ctx,x,cabinetY,cabinetW,cabinetH,'#91a181','#65765b',M*.008);box(ctx,x+5,cabinetY+5,cabinetW-10,cabinetH-10,'#9eac8c','#b5c09f',3);line(ctx,x+cabinetW*.7,cabinetY+cabinetH*.7,x+cabinetW*.84,cabinetY+cabinetH*.7,'#e3cea2',M*.007);}
 // Counter lower cabinets and gently bevelled stone slab.
 const c=l.counter;const cx=c.x*W,cy=c.y*H,cw=c.w*W,ch=c.h*H;
 ctx.shadowColor='#65492d38';ctx.shadowBlur=9;ctx.shadowOffsetY=5;box(ctx,cx,cy+ch*.28,cw,ch*.74,'#8e9f7d','#687553',5);ctx.shadowBlur=0;ctx.shadowOffsetY=0;
 for(let i=1;i<5;i++){const x=cx+cw*i/5;line(ctx,x,cy+ch*.45,x,cy+ch*.95,'#657855',1.4);line(ctx,x-cw*.07,cy+ch*.49,x-cw*.035,cy+ch*.49,'#d6c79e',3);}
 const stone=ctx.createLinearGradient(0,cy,0,cy+ch*.45);stone.addColorStop(0,'#f5e9cd');stone.addColorStop(1,'#d7c3a0');box(ctx,cx-3,cy,cw+6,ch*.43,stone,'#a58e68',M*.008);
 for(let i=0;i<9;i++)line(ctx,cx+cw*i/9,cy+ch*.13,cx+cw*i/9+M*.025,cy+ch*.14,'#b4a07b21',1);
 // Stove front is part of the kitchen; cookware remains on top.
 const ovenX=l.recipes.kubaneh.x*W-cw*.07,ovenY=cy+ch*.45;box(ctx,ovenX,ovenY,cw*.14,ch*.56,'#e3d9bd','#7c775f',3);box(ctx,ovenX+5,ovenY+ch*.16,cw*.14-10,ch*.3,'#5e6959','#9c9e82',3);
 for(let i=0;i<3;i++)ellipse(ctx,ovenX+cw*(.025+i*.045),ovenY+ch*.09,M*.004,M*.004,'#7b6d51');
 // Kitchen shelf with hanging utensils and a vase.
 if(!l.portrait){line(ctx,W*.80,H*.10,W*.985,H*.10,'#a1744c',6);for(let i=0;i<5;i++){const x=W*(.815+i*.033);box(ctx,x,H*.035,W*.022,H*.058,['#b97860','#a9b18c','#d2b46e','#81988a','#cda17a'][i],null,2);}line(ctx,W*.785,H*.15,W*.785,H*.27,'#9a7957',2);ellipse(ctx,W*.785,H*.28,M*.013,M*.021,'#cfa174','#8d6a4a');}
 // Window framing, curtains, balcony rail and foliage outside.
 const wx=W*(l.portrait?.70:.81),wy=H*(l.portrait?.32:.14),ww=W*(l.portrait?.25:.17),wh=H*(l.portrait?.14:.17);
 box(ctx,wx-5,wy-5,ww+10,wh+10,'#c1a276','#8d7755',4);const glass=ctx.createLinearGradient(0,wy,0,wy+wh);glass.addColorStop(0,'#b5d3ce');glass.addColorStop(1,'#e4e5b7');box(ctx,wx,wy,ww,wh,glass,null,1);
 for(let i=0;i<4;i++)ellipse(ctx,wx+ww*(.15+i*.24),wy+wh*.75,ww*.18,wh*.20,['#9bb18a','#b2c597'][i%2]);
 line(ctx,wx+ww*.5,wy,wx+ww*.5,wy+wh,'#f5e8c9',4);line(ctx,wx,wy+wh*.52,wx+ww,wy+wh*.52,'#f5e8c9',4);
 polygon(ctx,[[wx-3,wy],[wx+ww*.21,wy],[wx+ww*.15,wy+wh*.72],[wx-3,wy+wh]],'#b0b894','#829377');polygon(ctx,[[wx+ww+3,wy],[wx+ww*.79,wy],[wx+ww*.85,wy+wh*.72],[wx+ww+3,wy+wh]],'#b0b894','#829377');
 // Small clock, hanging herbs and family photos.
 if(!l.portrait){ellipse(ctx,W*.80,H*.055,M*.027,M*.027,'#f7edd2','#9c8158');line(ctx,W*.80,H*.055,W*.80,H*.037,'#6e6047',2);line(ctx,W*.80,H*.055,W*.812,H*.06,'#6e6047',2);}
 const frameX=W*.4,frameY=H*.415;box(ctx,frameX-M*.05,frameY-M*.055,M*.08,M*.065,'#b58c5f','#785c40',3);box(ctx,frameX-M*.043,frameY-M*.048,M*.066,M*.051,'#f5e6bd',null,1);ellipse(ctx,frameX-M*.01,frameY-M*.03,M*.012,M*.012,'#c79b79');polygon(ctx,[[frameX-M*.033,frameY],[frameX-M*.01,frameY-M*.023],[frameX+M*.013,frameY]],'#91a18c');
 // The sofa is physical furniture with cushions and a throw.
 const s=l.sofa,x=s.x*W,y=s.y*H,w=s.w*W,h=s.h*H;
 ellipse(ctx,x+w/2,y+h*.94,w*.54,h*.18,'#6d4c2f20');box(ctx,x+4,y-h*.16,w-8,h*.55,'#b98960','#8c6649',M*.025);box(ctx,x,y+h*.2,w,h*.72,'#c7996d','#8c6649',M*.025);box(ctx,x+w*.13,y+h*.28,w*.74,h*.44,'#d5af7c','#b1875d',M*.018);box(ctx,x-4,y+h*.12,w*.14,h*.8,'#bb8b5f','#8c6649',M*.015);box(ctx,x+w*.86,y+h*.12,w*.14,h*.8,'#bb8b5f','#8c6649',M*.015);
 ctx.save();ctx.translate(x+w*.29,y+h*.24);ctx.rotate(-.12);box(ctx,-w*.09,-h*.14,w*.19,h*.43,'#9ba584','#6f7e60',M*.008);ctx.restore();ctx.save();ctx.translate(x+w*.72,y+h*.28);ctx.rotate(.14);box(ctx,-w*.09,-h*.14,w*.18,h*.4,'#bb7765','#9a6050',M*.008);ctx.restore();box(ctx,x+w*.48,y+h*.05,w*.16,h*.81,'#eee1be',null,2);for(let i=0;i<6;i++)line(ctx,x+w*.49,y+h*(.14+i*.11),x+w*.63,y+h*(.14+i*.11),'#c9ad83',1.2);
 // Rug and dining table, with four chairs and a little vase.
 const t=l.table,tx=t.x*W,ty=t.y*H,tw=t.w*W,th=t.h*H;
 ctx.save();ctx.translate(tx+tw/2,ty+th/2);ctx.rotate(-.03);box(ctx,-tw*.72,-th*.92,tw*1.44,th*1.84,'#b96852','#e9c98a',M*.008);for(let i=0;i<9;i++){const q=-tw*.65+i*tw*.16;polygon(ctx,[[q,0],[q+tw*.05,-th*.25],[q+tw*.10,0],[q+tw*.05,th*.25]],'#ddba7d');}ctx.restore();
 for(const [dx,dy] of [[.12,-.22],[.73,-.22],[.12,.90],[.73,.90]]){box(ctx,tx+tw*dx,ty+th*dy,tw*.17,th*.42,'#b68a5e','#805b3c',M*.01);}
 ellipse(ctx,tx+tw/2,ty+th*.88,tw*.56,th*.25,'#68492825');box(ctx,tx+tw*.10,ty+th*.6,tw*.05,th*.62,'#92683f',null,2);box(ctx,tx+tw*.84,ty+th*.6,tw*.05,th*.62,'#92683f',null,2);ellipse(ctx,tx+tw/2,ty+th*.40,tw*.55,th*.54,'#b38353','#8d633e');ellipse(ctx,tx+tw/2,ty+th*.29,tw*.55,th*.49,'#d3aa75','#946d46');
 box(ctx,tx+tw*.45,ty-th*.18,tw*.13,th*.85,'#efe0b7',null,1);for(const dx of [.16,.83])ellipse(ctx,tx+tw*dx,ty+th*.30,tw*.09,th*.14,'#f4e9c8','#9ba488');
 ellipse(ctx,tx+tw*.515,ty+th*.30,M*.013,M*.018,'#8f9c77','#6b7b5c');line(ctx,tx+tw*.515,ty+th*.20,tx+tw*.515,ty-th*.15,'#6f8b57',2);for(let i=0;i<3;i++){const fx=tx+tw*(.48+i*.035),fy=ty-th*(.13+(i%2)*.12);ellipse(ctx,fx,fy,M*.008,M*.007,['#d6a065','#c78c7d'][i%2]);}
 // Low bookshelf in the foreground gives depth to the room.
 const bx=W*.21,by=H*.933,bw=W*.34,bh=H*.049;box(ctx,bx,by,bw,bh,'#b88b5f','#8e6845',3);for(let i=0;i<12;i++){const x=bx+5+i*(bw-10)/12;box(ctx,x,by+5,(bw-16)/14,bh-9,['#809984','#ba8065','#d0af69','#a8b092'][i%4],null,1);}
 // Doorways physically open to a sunny strip of outdoor garden.
 for(const door of l.doors){const dx=door.x*W,dy=door.y*H,dw=M*.105,dh=M*.19,sgn=door.side==='left'?1:-1;
  box(ctx,dx-dw*.5,dy-dh,dw,dh+M*.02,'#b9ca9a','#977652',4);box(ctx,dx-dw*.38,dy-dh*.93,dw*.76,dh*.93,'#dce0b0',null,2);
  for(let i=0;i<3;i++)ellipse(ctx,dx+sgn*(dw*.12+i*dw*.1),dy-dh*.25-i*dh*.08,dw*.19,dh*.18,'#9fb57e66');
  polygon(ctx,[[dx+sgn*dw*.48,dy-dh],[dx+sgn*dw*.10,dy-dh*.82],[dx+sgn*dw*.10,dy],[dx+sgn*dw*.48,dy]],'#ad7e53','#80603f');ellipse(ctx,dx+sgn*dw*.18,dy-dh*.42,M*.005,M*.005,'#e5c58c');
  ellipse(ctx,dx-sgn*dw*.45,dy+M*.025,dw*.75,M*.026,'#b7885f','#946c46');line(ctx,dx-dw*.4,dy+M*.02,dx+dw*.4,dy+M*.02,'#d8b385',1.5);
  label(ctx,door.side==='right'?(english?'Welcome':'ברוכים הבאים'):(english?'Side door':'דלת צדדית'),dx-sgn*dw*.30,dy+M*.038,{size:clamp(M*.019,8,11),color:'#765c3e',weight:'500',halo:false});
 }
 // Soft diagonal sunlight and edge shading integrate the furniture.
 ctx.save();ctx.globalAlpha=.075;polygon(ctx,[[W*.84,H*.31],[W,H*.31],[W*.70,H*.94],[W*.42,H*.94]],'#fff4bf');ctx.restore();
 const vignette=ctx.createRadialGradient(W*.5,H*.5,M*.20,W*.5,H*.5,Math.max(W,H)*.76);vignette.addColorStop(0,'#69482700');vignette.addColorStop(1,'#6948271a');ctx.fillStyle=vignette;ctx.fillRect(0,0,W,H);
 label(ctx,english?'Ruti’s kitchen':'המטבח של רותי',W*.41,H*.113,{size:clamp(M*.025,11,16),color:'#756045',weight:'700'});
}

export function renderHouse(ctx,g,visual={},options={}){
 const width=options.width||ctx.canvas.width,height=options.height||ctx.canvas.height,time=options.time||0,reduced=!!options.reduced,images=options.images||{},english=!!options.english;
 const l=getHouseLayout(width,height),M=Math.min(width,height),pulseTime=reduced?0:time;
 ctx.save();ctx.clearRect(0,0,width,height);ctx.lineCap='round';drawRoom(ctx,l,{time:pulseTime,english,reduced});
 const activePlants=new Map((g?.tasks||[]).filter(t=>t.type==='plant').map(t=>[t.slot,t]));
 for(let i=0;i<l.plants.length;i++){
  const p=l.plants[i],task=activePlants.get(i),x=p.x*width,y=p.y*height,size=M*(l.portrait?.15:.12);
  if(task)halo(ctx,x,y-size*.18,size*.42,pulseTime,'#db9d35',task.remaining/task.total<.25);
  drawPlant(ctx,x,y,size,i,!!task,pulseTime);
  if(task){timer(ctx,x,y-size*.16,size*.52,task);label(ctx,english?'Water!':'מים!',x,y-size*.72,{size:clamp(M*.024,11,14),color:'#925c28'});}
 }
 // Five recognizable physical dishes stay in place throughout every stage.
 for(const id of FOOD_IDS){
  const p=l.recipes[id],x=p.x*width,y=p.y*height,size=M*(l.portrait?.125:.105),stock=g?.inventory?.[id]??0,kitchen=g?.kitchen?.[id];
  ellipse(ctx,x,y+size*.27,size*.46,size*.11,'#7f684527');
  if(kitchen?.state==='cooking')halo(ctx,x,y,size*.43,pulseTime,'#e4ad46');
  if(!icon(ctx,images,id,x,y,size)){ellipse(ctx,x,y,size*.43,size*.18,'#eee0b6','#9f8967');ellipse(ctx,x,y-size*.06,size*.34,size*.14,['#eee0b2','#df9d55','#c18b4d','#b7a282','#daa25a'][FOOD_IDS.indexOf(id)]);}
  const short=english?{tahini:'Tahini',carrot:'Carrot',kubaneh:'Kubaneh',eggplant:'Eggplant',lasagna:'Lasagna'}:{tahini:'טחינה',carrot:'גזר וצימוקים',kubaneh:'קובנה',eggplant:'חצילים',lasagna:'לזניה'};
  label(ctx,short[id],x,y+size*.67,{size:clamp(M*.022,10,13),color:'#63513b'});
  ellipse(ctx,x+size*.37,y-size*.30,size*.13,size*.13,stock?'#6f8c5b':'#b19770','#f4e4bf');label(ctx,String(stock),x+size*.37,y-size*.30,{size:clamp(size*.22,9,13),color:'#fff9e9',halo:false,weight:'800'});
  if(kitchen?.state==='cooking'){const total={tahini:2.5,carrot:3,kubaneh:8,eggplant:5,lasagna:9}[id];timer(ctx,x,y,size*.55,{remaining:total-kitchen.remaining,total});for(let i=0;i<3;i++){const t=(pulseTime*.5+i/3)%1;ellipse(ctx,x+(i-1)*size*.16+Math.sin(time*2+i)*2,y-size*(.33+t*.35),1.3,2.8,'#fffae7'+Math.round((1-t)*180).toString(16).padStart(2,'0'));}}
 }
 const actors=[];
 for(const task of g?.tasks||[]){
  const p=getTaskLocation(task,l),x=p.x*width,y=p.y*height;
  if(task.type==='dust'){halo(ctx,x,y,M*.046,pulseTime,'#d6b76b',task.remaining/task.total<.3);drawDust(ctx,x,y,M*.095,pulseTime,task.remaining);timer(ctx,x,y,M*.05,task);}
  if(task.type==='guest')actors.push({y,draw:()=>{
   const d=l.doors[Math.abs(task.door??task.slot??0)%2],arrival=clamp(task.total-task.remaining,0,1),guestX=x+(d.side==='left'?1:-1)*M*(.008+arrival*.032),guestY=y+M*.04;
   halo(ctx,guestX,guestY-M*.06,M*.065,pulseTime,'#f1ba49',task.remaining/task.total<.25);
   const portrait=images.family?.[task.guest]||images[task.guest];drawHuman(ctx,guestX,guestY,M*(l.portrait?.175:.17),{portrait,guest:true,index:task.guest==='hila'?1:task.guest==='rivi'?2:0,time:pulseTime,walking:arrival<1&&!reduced,facing:d.side==='left'?1:-1});
   const bubbleX=guestX+(d.side==='left'?1:-1)*M*.062,bubbleY=guestY-M*.145;ellipse(ctx,bubbleX,bubbleY,M*.035,M*.035,'#fff3d4','#c59b54');icon(ctx,images,task.recipeId,bubbleX,bubbleY,M*.06);
   const names=english?{roi:'Roei',roei:'Roei',hila:'Hila',rivi:'Rivi',revital:'Rivi'}:{roi:'רועי',roei:'רועי',hila:'הילה',rivi:'ריוי',revital:'ריוי'};label(ctx,names[task.guest]||task.guest,guestX,guestY+M*.027,{size:clamp(M*.024,11,14),color:'#6d5038'});timer(ctx,bubbleX,bubbleY,M*.040,task);
  }});
  if(task.type==='cat')actors.push({y:y+M*.03,draw:()=>{
   const d=l.doors[Math.abs(task.door??task.slot??0)%2],waiting=task.waiting>0,progress=waiting?0:1-task.remaining/task.total,sgn=d.side==='left'?1:-1;
   const catX=x+sgn*M*(-.025+progress*.09),catY=y+M*.015;
   halo(ctx,catX,catY-M*.012,M*.058,pulseTime,'#d26b44',progress>.65);drawCat(ctx,catX,catY,M*.115,pulseTime,progress,d.side);timer(ctx,catX,catY-M*.01,M*.066,task);
   if(waiting){
    const bx=catX+sgn*M*.068,by=catY-M*.092;
    ellipse(ctx,catX+sgn*M*.015,catY-M*.058,M*.005,M*.005,'#fff4d9','#c4a071');
    ellipse(ctx,catX+sgn*M*.030,catY-M*.073,M*.008,M*.008,'#fff4d9','#c4a071');
    ellipse(ctx,bx,by,M*.073,M*.027,'#fff4d9','#c4a071');
    label(ctx,english?'Waiting…':'מחכה בחוץ…',bx,by,{size:clamp(M*.021,9,12),color:'#8b6041',halo:false});
   }
  }});
 }
 // Short world-space departures keep completed interactions physical: guests
 // head toward the table, shooed cats run outdoors, and intruders slip inside.
 for(const departure of visual.departures||[]){
  const progress=clamp((departure.age||0)/(departure.duration||1.5),0,1);if(progress>=1)continue;
  const door=l.doors[Math.abs(departure.door??0)%2],sgn=door.side==='left'?1:-1;
  const fade=1-clamp((progress-.62)/.38,0,1);
  if(departure.type==='guest'){
   const p=guestDeparturePosition(departure,l,reduced?1:progress),px=p.x*width,py=p.y*height;
   actors.push({y:py,draw:()=>{ctx.save();ctx.globalAlpha=fade;drawHuman(ctx,px,py,M*(l.portrait?.175:.17),{portrait:images.family?.[departure.guest]||images[departure.guest],guest:true,index:departure.guest==='hila'?1:departure.guest==='rivi'?2:0,time:pulseTime,walking:!reduced,facing:p.facing});
    label(ctx,english?'Thank you!':'תודה רותי!',px,py-M*.20,{size:clamp(M*.025,11,15),color:'#6b8254'});ctx.restore();}});
  }else if(departure.type==='cat'||departure.type==='cat-enter'){
   const entering=departure.type==='cat-enter',p=reduced?1:progress;
   const px=door.x*width+sgn*M*(entering?.025+p*.18:.035-p*.19),py=door.y*height+M*(.015+(entering?p*.085:0));
   actors.push({y:py,draw:()=>{ctx.save();ctx.globalAlpha=fade;drawCat(ctx,px,py,M*.115,pulseTime*2,1,entering?door.side:(door.side==='left'?'right':'left'));ctx.restore();}});
  }
 }
 const actor=visual.actor||{...l.spawn};const actorX=(actor.x??l.spawn.x)*width,actorY=(actor.y??l.spawn.y)*height;
 actors.push({y:actorY,draw:()=>drawHuman(ctx,actorX,actorY,clamp(M*(l.portrait?.205:.19),l.portrait?66:76,l.portrait?84:102),{
  portrait:images.ruti,time:pulseTime,facing:actor.facing??1,walking:!!actor.walking,action:actor.action,tool:actor.tool,carryDish:actor.carryDish,actionProgress:actor.actionProgress||0,images,english})});
 actors.sort((a,b)=>a.y-b.y);for(const actor of actors)actor.draw();
 // Navigation destination marker remains part of the floor rather than a card.
 const destination=visual.destination||visual.targetPosition;
 if(destination&&actor.walking){const x=destination.x*width,y=destination.y*height;ctx.strokeStyle='#58785d';ctx.lineWidth=2;ctx.setLineDash([3,4]);ctx.beginPath();ctx.ellipse(x,y,M*.025,M*.012,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);}
 ctx.restore();return l;
}
