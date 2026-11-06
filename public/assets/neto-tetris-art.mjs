import {TETROMINOES,pieceCells,ghostY,COLS,ROWS} from './neto-tetris.mjs?v=1';
import {NETO_PRODUCTS} from './neto-products.mjs?v=1';

const images=new Map(),loads=new Map();
const clamp=value=>Math.max(0,Math.min(1,value));
const ease=value=>{const t=clamp(value);return t*t*(3-2*t);};
const singleTypes=new Set(['I','O','T']);
const inks={I:'#74cdda',O:'#f0c45d',T:'#b6a0ed',J:'#80aaf0',L:'#e6ab70',S:'#91c7a7',Z:'#e3959b'};

export function loadNetoImages(onChange=()=>{}){
  return Promise.allSettled(Object.values(NETO_PRODUCTS).map(product=>{
    if(!product.image||typeof Image==='undefined')return Promise.resolve();
    if(!loads.has(product.image))loads.set(product.image,new Promise((resolve,reject)=>{
      const image=new Image();image.decoding='async';
      image.onload=()=>{images.set(product.image,image);resolve(image);};
      image.onerror=()=>reject(Error('Appliance image unavailable'));
      image.src=product.image;
    }));
    return loads.get(product.image).then(image=>{onChange();return image;},error=>{onChange();throw error;});
  }));
}

function roundRect(ctx,x,y,w,h,r,fill,stroke=null,line=1){
  ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=fill;ctx.fill();
  if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=line;ctx.stroke();}
}
function line(ctx,x1,y1,x2,y2,color,width=1){ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();}
function ellipse(ctx,x,y,rx,ry,fill,stroke=null,width=1){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}}
function bounds(type){
  const shape=TETROMINOES[type]?.cells||[[0,0]],xs=shape.map(p=>p[0]),ys=shape.map(p=>p[1]);
  const minX=Math.min(...xs),minY=Math.min(...ys);
  return {minX,minY,width:Math.max(...xs)-minX+1,height:Math.max(...ys)-minY+1};
}

// Fallback art retains the real appliance silhouettes when a catalogue photo is unavailable.
function appliance(ctx,kind,w,h){
  ctx.save();ctx.scale(w/100,h/100);ctx.lineCap='round';ctx.lineJoin='round';
  if(kind==='soundbar'){
    roundRect(ctx,2,17,96,66,11,'#2d3440','#121923',2);
    const gradient=ctx.createLinearGradient(0,16,0,83);gradient.addColorStop(0,'#68717c');gradient.addColorStop(.3,'#303843');gradient.addColorStop(1,'#151d28');
    roundRect(ctx,3,19,94,62,9,gradient);
    for(let x=7;x<94;x+=2.6)for(let y=28;y<75;y+=5.5)ellipse(ctx,x,y,.5,.9,'#929ca568');
    line(ctx,7,24,93,24,'#a7afb6',1.2);line(ctx,44,38,57,38,'#99a4ae',1.2);
    ellipse(ctx,87,48,1.2,1.8,'#7cd2ea');
  }else if(kind==='washer'){
    const gradient=ctx.createLinearGradient(3,0,95,100);gradient.addColorStop(0,'#f5f7f9');gradient.addColorStop(.55,'#d4dce3');gradient.addColorStop(1,'#a4aeb9');
    roundRect(ctx,8,2,84,96,7,gradient,'#71808b',1.6);roundRect(ctx,12,8,76,16,3,'#e9edf1');
    roundRect(ctx,16,13,20,5,1,'#acb8c3');ellipse(ctx,47,16,5,5,'#d2dbe2','#7e8a95');
    roundRect(ctx,63,12,18,7,1,'#2d3a43');line(ctx,66,15,72,15,'#8bd1d6',1);
    ellipse(ctx,50,58,32,31,'#8996a2','#66747f',1.5);ellipse(ctx,50,58,27,26,'#263d4c','#e3e8ed',3);
    const glass=ctx.createLinearGradient(27,36,74,81);glass.addColorStop(0,'#789ba9');glass.addColorStop(.45,'#304e60');glass.addColorStop(1,'#192b3b');
    ellipse(ctx,50,58,23,23,glass);ctx.beginPath();ctx.arc(48,56,17,Math.PI*1.06,Math.PI*1.65);ctx.strokeStyle='#9ac7d0';ctx.lineWidth=3;ctx.stroke();
    roundRect(ctx,76,52,6,14,3,'#aeb9c1','#70808b');line(ctx,17,89,83,89,'#8f9ba5');
  }else if(kind==='hood'){
    const gradient=ctx.createLinearGradient(0,0,0,100);gradient.addColorStop(0,'#e7edf0');gradient.addColorStop(.5,'#9caab7');gradient.addColorStop(1,'#d7e0e7');
    roundRect(ctx,35,1,30,56,2,gradient,'#71818e',1);ctx.beginPath();ctx.moveTo(34,51);ctx.lineTo(66,51);ctx.lineTo(98,84);ctx.lineTo(2,84);ctx.closePath();ctx.fillStyle=gradient;ctx.fill();ctx.strokeStyle='#7a8994';ctx.lineWidth=1.4;ctx.stroke();
    roundRect(ctx,1,82,98,14,3,'#313e48','#62727e',1.4);line(ctx,7,87,93,87,'#aebbc5');
    for(let x=38;x<63;x+=6)ellipse(ctx,x,90,1.1,1.2,'#e5d596');
  }else if(kind==='toaster'){
    ellipse(ctx,51,92,42,5,'#0e18201f');roundRect(ctx,9,27,81,59,14,'#d4dadc','#71818b',2);roundRect(ctx,14,29,71,10,5,'#eff1ee','#81919b',1.2);
    roundRect(ctx,22,22,20,14,5,'#c49f6a','#9b7547',1);roundRect(ctx,52,20,21,16,5,'#d1ac74','#9b7547',1);
    line(ctx,18,39,81,39,'#7e898f',2);roundRect(ctx,80,44,5,23,2,'#52616b');ellipse(ctx,75,71,7,7,'#5f707d','#dfe4e8',2);ellipse(ctx,75,71,2,2,'#d8a066');line(ctx,18,84,82,84,'#3b4d59',4);
  }else if(kind==='coffee'){
    ellipse(ctx,51,94,39,4,'#14263222');roundRect(ctx,14,10,72,80,8,'#34414b','#111d27',2);roundRect(ctx,22,17,56,17,3,'#b0b9be');roundRect(ctx,29,21,25,8,1,'#1c3b46');ellipse(ctx,66,25,4,4,'#d5dee3','#75838b');
    roundRect(ctx,27,38,47,37,2,'#101f29');roundRect(ctx,39,36,22,10,2,'#adb7bd');line(ctx,45,45,45,55,'#aebcc1',2);line(ctx,57,45,57,55,'#aebcc1',2);
    roundRect(ctx,36,58,28,23,3,'#e6e4dc','#c3c4bc');ctx.beginPath();ctx.arc(66,67,7,-Math.PI*.5,Math.PI*.5);ctx.strokeStyle='#deddd7';ctx.lineWidth=4;ctx.stroke();ellipse(ctx,50,59,13,3,'#76513d');
    roundRect(ctx,23,82,55,5,2,'#9da8b0');for(let x=30;x<75;x+=7)line(ctx,x,83,x,86,'#455660');
  }else if(kind==='blender'){
    ellipse(ctx,51,95,32,4,'#14263222');roundRect(ctx,22,69,57,22,8,'#6d8e9b','#4b6675',2);roundRect(ctx,29,16,43,53,3,'#d9ecedbb','#688a98',2);
    ctx.beginPath();ctx.moveTo(33,25);ctx.lineTo(68,25);ctx.lineTo(63,61);ctx.lineTo(38,61);ctx.closePath();ctx.fillStyle='#ce927e';ctx.fill();
    ctx.beginPath();ctx.moveTo(72,22);ctx.bezierCurveTo(94,20,94,58,70,55);ctx.strokeStyle='#6b8c99';ctx.lineWidth=5;ctx.stroke();
    roundRect(ctx,25,10,50,8,3,'#415d6d');roundRect(ctx,43,5,16,6,3,'#7f9ca8');ellipse(ctx,50,79,7,7,'#d8e2e6','#547181',1);line(ctx,50,73,50,78,'#506979',2);
    for(let y=30;y<60;y+=8)line(ctx,36,y,41,y,'#f7ffff',1.1);
  }else{
    // A compact electric kettle, with a spout and a clear separate handle.
    ellipse(ctx,47,94,35,4,'#14263222');ctx.beginPath();ctx.moveTo(32,23);ctx.bezierCurveTo(27,36,15,58,17,77);ctx.quadraticCurveTo(20,88,66,87);ctx.quadraticCurveTo(79,73,64,27);ctx.closePath();
    const gradient=ctx.createLinearGradient(15,30,75,85);gradient.addColorStop(0,'#e7eee9');gradient.addColorStop(.6,'#a9c5b7');gradient.addColorStop(1,'#729482');ctx.fillStyle=gradient;ctx.fill();ctx.strokeStyle='#57776b';ctx.lineWidth=2;ctx.stroke();
    ctx.beginPath();ctx.moveTo(65,33);ctx.bezierCurveTo(96,27,99,76,72,74);ctx.strokeStyle='#48695d';ctx.lineWidth=7;ctx.stroke();ctx.beginPath();ctx.moveTo(23,43);ctx.lineTo(7,32);ctx.lineTo(18,58);ctx.closePath();ctx.fillStyle='#a7c3b4';ctx.fill();ctx.strokeStyle='#57776b';ctx.lineWidth=2;ctx.stroke();
    roundRect(ctx,29,19,39,9,4,'#48695d');roundRect(ctx,42,12,14,8,4,'#668a78');roundRect(ctx,16,86,60,6,3,'#344f43');roundRect(ctx,43,38,8,34,4,'#dceae5','#7a9f8d',1);line(ctx,47,47,47,65,'#729d8b',2);
  }
  ctx.restore();
}
function photo(ctx,product,w,h){
  const image=images.get(product?.image);
  if(image&&image.naturalWidth){
    ctx.fillStyle='#f5f7f8';ctx.fillRect(0,0,w,h);
    const crop=product.crop||[0,0,image.naturalWidth,image.naturalHeight];
    const sx=Math.max(0,Math.min(image.naturalWidth-1,crop[0])),sy=Math.max(0,Math.min(image.naturalHeight-1,crop[1]));
    const sw=Math.max(1,Math.min(image.naturalWidth,crop[2])-sx),sh=Math.max(1,Math.min(image.naturalHeight,crop[3])-sy);
    const pad=Math.min(w,h)*.02,single=['soundbar','washer','hood'].includes(product.kind);
    const scale=Math.min((w-pad*2)/sw,(h-pad*2)/sh),dw=single?w-pad*2:sw*scale,dh=single?h-pad*2:sh*scale;
    ctx.drawImage(image,sx,sy,sw,sh,(w-dw)/2,(h-dh)/2,dw,dh);
  }else appliance(ctx,product?.kind||'kettle',w,h);
}
function tileArt(ctx,tile,x,y,cell){
  const product=NETO_PRODUCTS[tile.type]||{},b=bounds(tile.type),rotation=tile.type==='O'?0:(tile.rotation||0);
  ctx.save();ctx.beginPath();ctx.rect(x,y,cell,cell);ctx.clip();
  ctx.fillStyle='#f3f5f5';ctx.fillRect(x,y,cell,cell);
  ctx.translate(x+cell/2,y+cell/2);ctx.rotate(rotation*Math.PI/2);
  if(singleTypes.has(tile.type)){
    ctx.translate(-((tile.localX??b.minX)-b.minX+.5)*cell,-((tile.localY??b.minY)-b.minY+.5)*cell);
    photo(ctx,product,b.width*cell,b.height*cell);
  }else{
    const inset=cell*.06;ctx.translate(-cell/2+inset,-cell/2+inset);photo(ctx,product,cell-2*inset,cell-2*inset);
  }
  ctx.restore();
}
function drawTiles(ctx,tiles,cell,{ghost=false,active=false}={}){
  const occupied=new Map(tiles.map(tile=>[`${tile.x},${tile.y}`,tile]));
  for(const tile of tiles){
    const x=tile.x*cell,y=tile.y*cell;
    if(ghost){ctx.fillStyle='#dce8ed0c';ctx.fillRect(x+1,y+1,cell-2,cell-2);}
    else tileArt(ctx,tile,x,y,cell);
  }
  ctx.lineJoin='round';ctx.lineCap='square';ctx.lineWidth=active?2.5:ghost?1.3:1.6;
  if(ghost)ctx.setLineDash([4,4]);
  for(const tile of tiles){
    const x=tile.x*cell,y=tile.y*cell;
    ctx.strokeStyle=ghost?'#e2f2f35c':active?'#ffe1a0':inks[tile.type]||'#bac8d0';
    ctx.beginPath();
    for(const [dx,dy,ax,ay,bx,by]of [[0,-1,0,0,1,0],[1,0,1,0,1,1],[0,1,1,1,0,1],[-1,0,0,1,0,0]]){
      const next=occupied.get(`${tile.x+dx},${tile.y+dy}`);
      if(next&&next.group===tile.group)continue;
      ctx.moveTo(x+ax*cell,y+ay*cell);ctx.lineTo(x+bx*cell,y+by*cell);
    }
    ctx.stroke();
    if(!ghost&&!singleTypes.has(tile.type)){
      ctx.strokeStyle='#70849822';ctx.lineWidth=.7;ctx.strokeRect(x+1,y+1,cell-2,cell-2);ctx.lineWidth=active?2.5:1.6;
    }
  }
  ctx.setLineDash([]);
}
function boardBackground(ctx,width,height){
  ctx.clearRect(0,0,width,height);
  const gradient=ctx.createLinearGradient(0,0,width,height);gradient.addColorStop(0,'#172632');gradient.addColorStop(.6,'#111c27');gradient.addColorStop(1,'#1a2b38');ctx.fillStyle=gradient;ctx.fillRect(0,0,width,height);
  const cellW=width/COLS,cellH=height/ROWS;ctx.strokeStyle='#9cb6c31c';ctx.lineWidth=.6;ctx.beginPath();
  for(let x=1;x<COLS;x++){ctx.moveTo(x*cellW,0);ctx.lineTo(x*cellW,height);}for(let y=1;y<ROWS;y++){ctx.moveTo(0,y*cellH);ctx.lineTo(width,y*cellH);}ctx.stroke();
  ctx.fillStyle='#93b0bd13';for(let x=0;x<COLS;x++)for(let y=0;y<ROWS;y++)ctx.fillRect((x+.5)*cellW-.6,(y+.5)*cellH-.6,1.2,1.2);
}
function activeTiles(active,y=active?.y){
  if(!active)return [];
  return pieceCells({...active,y}).map(cell=>({...active,...cell}));
}
export function drawTetris(ctx,game,{width=400,height=800,ghost=true}={}){
  if(!ctx)return;boardBackground(ctx,width,height);if(!game)return;
  ctx.save();ctx.scale(width/(COLS*40),height/(ROWS*40));ctx.beginPath();ctx.rect(0,0,COLS*40,ROWS*40);ctx.clip();
  if(ghost&&game.active&&game.phase==='playing'){
    const y=ghostY(game);if(y>game.active.y)drawTiles(ctx,activeTiles(game.active,y),40,{ghost:true});
  }
  const fixed=[];for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){const tile=game.board?.[y]?.[x];if(tile)fixed.push({...tile,x,y});}
  drawTiles(ctx,fixed,40);
  if(game.active&&game.phase!=='finished'&&game.phase!=='zapping')drawTiles(ctx,activeTiles(game.active),40,{active:true});
  ctx.restore();
}
export function drawTetromino(ctx,type,x,y,cell,{rotation=0,ghost=false}={}){
  if(!ctx||!TETROMINOES[type])return {width:0,height:0};
  const raw=activeTiles({type,x:0,y:0,rotation,group:0}),minX=Math.min(...raw.map(p=>p.x)),minY=Math.min(...raw.map(p=>p.y));
  const tiles=raw.map(p=>({...p,x:p.x-minX,y:p.y-minY}));
  ctx.save();ctx.translate(x,y);drawTiles(ctx,tiles,cell,{ghost});ctx.restore();
  return {width:(Math.max(...tiles.map(p=>p.x))+1)*cell,height:(Math.max(...tiles.map(p=>p.y))+1)*cell};
}

const skinPalettes=[['#d9aa85','#b67c5b','#f2c9a6'],['#a9704e','#7b4d35','#d09b75'],['#f0cfb1','#c59b7d','#ffe3ca'],['#78513a','#4e3528','#a47452']];
const sleeves=['#3c6c8a','#9d4d46','#566c5d','#c3a26b','#665c89'];
function arm(ctx,x,y,fromX,fromY,variant,front=false,scale=1){
  const angle=Math.atan2(y-fromY,x-fromX),length=Math.hypot(x-fromX,y-fromY),[skin,shadow,light]=skinPalettes[variant%skinPalettes.length];
  ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.scale(scale,scale);ctx.lineCap='round';ctx.lineJoin='round';
  const span=length/scale;
  if(!front){
    line(ctx,-span,0,-40,0,'#0a111944',29);line(ctx,-span,0,-43,0,sleeves[variant%sleeves.length],25);
    line(ctx,-51,0,-5,0,shadow,21);line(ctx,-49,-2,-3,-2,skin,17);line(ctx,-48,-6,-10,-6,light,2.2);
    roundRect(ctx,-55,-14,14,28,3,sleeves[variant%sleeves.length],'#10223066',1);line(ctx,-44,-10,-44,10,'#ffffff44',1);
  }else{
    roundRect(ctx,-7,-12,24,26,9,skin,shadow,1.1);
    // Four bent fingers visibly curl around the edge of the appliance.
    for(let i=0;i<4;i++){
      const fy=-9+i*6;
      ctx.beginPath();ctx.moveTo(6,fy);ctx.bezierCurveTo(20,fy-3,24,fy+1,19,fy+5);ctx.strokeStyle=shadow;ctx.lineWidth=6;ctx.stroke();
      ctx.beginPath();ctx.moveTo(6,fy-1);ctx.bezierCurveTo(19,fy-3,21,fy+1,17,fy+3);ctx.strokeStyle=skin;ctx.lineWidth=4;ctx.stroke();
      line(ctx,17,fy+1,18.5,fy+1,light,1);
    }
    ctx.beginPath();ctx.moveTo(-2,6);ctx.quadraticCurveTo(9,24,19,14);ctx.strokeStyle=shadow;ctx.lineWidth=8;ctx.stroke();ctx.beginPath();ctx.moveTo(-2,5);ctx.quadraticCurveTo(9,21,18,13);ctx.strokeStyle=skin;ctx.lineWidth=6;ctx.stroke();
    line(ctx,-1,-7,4,-9,light,1.4);
  }
  ctx.restore();
}
const hash=value=>{let n=2166136261;for(const c of String(value)){n^=c.charCodeAt(0);n=Math.imul(n,16777619);}return n>>>0;};
export function drawZap(ctx,snapshot,progress,{width=400,height=800,reduced=false}={}){
  if(!ctx)return;boardBackground(ctx,width,height);const p=clamp(progress);if(p>=.98||!snapshot?.length)return;
  const groups=new Map();for(const tile of snapshot){const key=tile.group??`${tile.type}:${tile.x}:${tile.y}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(tile);}
  const cell=40,worldWidth=COLS*cell,worldHeight=ROWS*cell;
  const moving=[...groups].map(([id,tiles],index)=>{
    const seed=hash(id),cx=tiles.reduce((n,t)=>n+t.x+.5,0)/tiles.length*cell,cy=tiles.reduce((n,t)=>n+t.y+.5,0)/tiles.length*cell,side=seed%2?1:-1,delay=(seed%11)/110;
    const fall=clamp((p-.25-delay)/(.7-delay));
    const dx=reduced?0:side*worldWidth*.27*fall,dy=reduced?32*fall:worldHeight*1.4*fall*fall;
    return {id,tiles,index,seed,cx,cy,side,dx,dy,fall,angle:reduced?0:side*(.18+(seed%7)*.07)*fall};
  });
  ctx.save();ctx.scale(width/worldWidth,height/worldHeight);ctx.beginPath();ctx.rect(0,0,worldWidth,worldHeight);ctx.clip();
  if(reduced)ctx.globalAlpha=1-ease((p-.2)/.7);
  const hands=moving.filter((_g,i)=>i%Math.max(1,Math.ceil(moving.length/18))===0).slice(0,18);
  const reach=ease(p/.30),targets=hands.map(g=>{
    const startX=g.side<0?-70:worldWidth+70,startY=g.cy+((g.seed%5)-2)*25;
    const goalX=g.cx+g.dx,goalY=g.cy+g.dy;
    return {...g,startX,startY,x:startX+(goalX-startX)*reach,y:startY+(goalY-startY)*reach};
  });
  for(const target of targets)arm(ctx,target.x,target.y,target.startX,target.startY,target.index,false,.75+(target.seed%4)*.07);
  for(const g of moving){ctx.save();ctx.translate(g.cx+g.dx,g.cy+g.dy);ctx.rotate(g.angle);ctx.translate(-g.cx,-g.cy);drawTiles(ctx,g.tiles,cell);ctx.restore();}
  for(const target of targets)arm(ctx,target.x,target.y,target.startX,target.startY,target.index,true,.75+(target.seed%4)*.07);
  ctx.restore();
}
