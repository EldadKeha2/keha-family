export const BACKGROUNDS=[['none','הרקע המקורי','Original','↩'],['beach','חוף טרופי','Tropical beach','🏝️'],['space','על הירח','On the moon','🚀'],['paris','פריז','Paris','🗼'],['snow','הרים מושלגים','Snowy mountains','🏔️'],['forest','יער קסום','Magic forest','🌳'],['desert','שקיעה במדבר','Desert sunset','🌵'],['party','מסיבת דיסקו','Disco party','🪩']];
export const HEADS=[['lion','ראש אריה','Lion','🦁'],['robot','ראש רובוט','Robot','🤖'],['alien','חייזר','Alien','👽'],['cat','ראש חתול','Cat','🐱'],['panda','פנדה','Panda','🐼'],['laugh','מצחיק בטירוף','Laughing','😂'],['dog','ראש כלב','Dog','🐶'],['disguise','בלש סמוי','Disguise','🥸']];
export const PROPS=[['glasses','משקפי שמש','Sunglasses','🕶️'],['crown','כתר מלכותי','Royal crown','👑'],['mustache','שפם מפואר','Mustache','🥸'],['hat','כובע מסיבה','Party hat','🥳'],['bunny','אוזני ארנב','Bunny ears','🐰'],['pirate','רטיית פיראט','Pirate patch','🏴‍☠️'],['bowtie','פפיון','Bow tie','🎀'],['bubble','בועת דיבור','Speech bubble','💬']];
export const EMOJIS=['❤️','😂','🥳','⭐','🌈','🦄','🔥','💩','🎈','💋','🌸','🦋','🍉','🍕','🏆','🎉','😍','🤩','🤪','😱','👻','🛸','☀️','🌙','🎵','💎','🫶','🐣','💐','🕊️','💥','☕'].map((glyph,i)=>['emoji-'+i,glyph,glyph,glyph]);
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const number=(value,fallback,min,max)=>Number.isFinite(Number(value))?clamp(Number(value),min,max):fallback;
export const funDefaults=()=>({background:'none',stickers:[],strokes:[],feather:2});
export function normalizeFun(input={}){
  const out=funDefaults();if(BACKGROUNDS.some(([id])=>id===input.background))out.background=input.background;
  out.feather=number(input.feather,2,0,12);
  out.stickers=(Array.isArray(input.stickers)?input.stickers:[]).slice(0,40).filter(s=>s&&['emoji','prop','text'].includes(s.kind)).map((s,i)=>({id:String(s.id||'sticker-'+i).slice(0,80),kind:s.kind,glyph:String(s.glyph||'⭐').slice(0,20),prop:PROPS.some(([id])=>id===s.prop)?s.prop:'glasses',text:String(s.text||'איזה קטע!').slice(0,72),x:number(s.x,.5,0,1),y:number(s.y,.35,0,1),size:number(s.size,.24,.04,1.3),rotation:number(s.rotation,0,-180,180)}));
  out.strokes=(Array.isArray(input.strokes)?input.strokes:[]).slice(-160).filter(s=>s&&Array.isArray(s.points)).map(s=>({mode:s.mode==='restore'?'restore':'erase',size:number(s.size,.08,.01,.4),points:s.points.slice(0,600).filter(p=>Number.isFinite(p?.x)&&Number.isFinite(p?.y)).map(p=>({x:clamp(p.x,0,1),y:clamp(p.y,0,1)}))})).filter(s=>s.points.length);
  return out;
}
export function hitSticker(stickers,point,width,height){
  const short=Math.min(width,height);
  for(let i=stickers.length-1;i>=0;i--){const s=stickers[i],angle=-s.rotation*Math.PI/180,dx=(point.x-s.x)*width,dy=(point.y-s.y)*height,x=dx*Math.cos(angle)-dy*Math.sin(angle),y=dx*Math.sin(angle)+dy*Math.cos(angle),size=s.size*short;
    if(Math.abs(x)<=size*.58&&Math.abs(y)<=size*(s.kind==='text'?.38:.58))return s;
  }
  return null;
}
export function placedSticker(preset,kind,face,width,height,id){
  const rect=face?.rect||face,short=Math.min(width,height),hasFace=rect&&rect.width>0&&rect.height>0;
  const s={id,kind:kind==='head'||kind==='sticker'?'emoji':preset[0]==='bubble'?'text':'prop',glyph:preset[3],prop:preset[0],text:'איזה קטע!',x:.5,y:.35,size:kind==='prop'?.3:.26,rotation:0};
  if(hasFace){s.x=rect.x+rect.width/2;s.y=rect.y+rect.height*.48;s.size=rect.width*width/short*(kind==='head'?1.55:1.25);
    if(kind==='prop'){const pos={crown:[-.17,1.4],hat:[-.22,1.5],bunny:[-.22,1.5],mustache:[.76,.8],bowtie:[1.3,.8],bubble:[-.3,2.6],glasses:[.42,1.18],pirate:[.42,1.25]}[preset[0]]||[.45,1.2];s.y=rect.y+rect.height*pos[0];s.size=rect.width*width/short*pos[1];}
  }
  return normalizeFun({stickers:[s]}).stickers[0];
}
function random(seed=13){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
function gradient(ctx,w,h,stops){const g=ctx.createLinearGradient(0,0,0,h);for(const [at,color]of stops)g.addColorStop(at,color);ctx.fillStyle=g;ctx.fillRect(0,0,w,h);}
function circle(ctx,x,y,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}
function polygon(ctx,points,color){ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(...points[0]);for(const p of points.slice(1))ctx.lineTo(...p);ctx.closePath();ctx.fill();}
export function drawBackground(ctx,w,h,id){
  const rand=random(),m=Math.min(w,h);ctx.save();
  if(id==='beach'){
    gradient(ctx,w,h,[[0,'#85d5ed'],[.46,'#d1f4ef'],[.47,'#57cdd0'],[.7,'#23aab8'],[.71,'#f1d59c'],[1,'#fff0c4']]);circle(ctx,w*.78,h*.2,m*.09,'#fff9cf');
    for(let j=0;j<7;j++){ctx.strokeStyle=j%2?'#defaf18a':'#86e3dc9c';ctx.lineWidth=m*.005;ctx.beginPath();ctx.moveTo(0,h*(.51+j*.028));ctx.bezierCurveTo(w*.3,h*(.49+j*.028),w*.6,h*(.54+j*.028),w,h*(.5+j*.028));ctx.stroke();}
    ctx.strokeStyle='#786146';ctx.lineWidth=m*.03;ctx.beginPath();ctx.moveTo(w*.08,h);ctx.quadraticCurveTo(w*.13,h*.7,w*.18,h*.3);ctx.stroke();
    for(let j=0;j<9;j++){const a=j*Math.PI/5;ctx.strokeStyle=j%2?'#1c8062':'#2c9b69';ctx.lineWidth=m*.014;ctx.beginPath();ctx.moveTo(w*.18,h*.3);ctx.quadraticCurveTo(w*.18+Math.cos(a)*m*.16,h*.3+Math.sin(a)*m*.1,w*.18+Math.cos(a)*m*.3,h*.3+Math.sin(a)*m*.2+m*.05);ctx.stroke();}
  }else if(id==='space'){
    gradient(ctx,w,h,[[0,'#080b25'],[.55,'#2a1853'],[1,'#171c3f']]);for(let i=0;i<230;i++)circle(ctx,rand()*w,rand()*h,m*(.0008+rand()*.002),'#e6e9ff'+(i%2?'aa':'ff'));
    const px=w*.78,py=h*.24,r=m*.15,g=ctx.createRadialGradient(px-r*.4,py-r*.5,0,px,py,r);g.addColorStop(0,'#ffe5ba');g.addColorStop(.6,'#cc8a86');g.addColorStop(1,'#72516e');circle(ctx,px,py,r,g);ctx.strokeStyle='#dfbca28c';ctx.lineWidth=m*.025;ctx.beginPath();ctx.ellipse(px,py,r*1.7,r*.32,-.4,0,Math.PI*2);ctx.stroke();
    ctx.fillStyle='#989ba8';ctx.beginPath();ctx.ellipse(w*.5,h*1.1,w*.8,h*.28,0,0,Math.PI*2);ctx.fill();for(let j=0;j<32;j++)circle(ctx,rand()*w,h*(.89+rand()*.14),m*(.008+rand()*.025),'#686c8038');
  }else if(id==='paris'){
    gradient(ctx,w,h,[[0,'#d9a5b5'],[.5,'#f8d8c2'],[.77,'#eed9b4'],[1,'#587e89']]);circle(ctx,w*.2,h*.23,m*.075,'#ffefca');
    for(let j=0;j<36;j++){const x=j*w/35,bh=h*(.04+rand()*.15);ctx.fillStyle=j%2?'#ad958f':'#c1aaa0';ctx.fillRect(x,h*.78-bh,w*.038,bh);polygon(ctx,[[x,h*.78-bh],[x+w*.019,h*.75-bh],[x+w*.038,h*.78-bh]],'#857b80');}
    const x=w*.76,top=h*.18,bottom=h*.82,tw=m*.24;ctx.strokeStyle='#695961';ctx.lineWidth=m*.013;ctx.beginPath();ctx.moveTo(x,top);ctx.lineTo(x-tw/2,bottom);ctx.moveTo(x,top);ctx.lineTo(x+tw/2,bottom);ctx.stroke();
    for(let j=1;j<8;j++){const yy=top+(bottom-top)*j/8,ww=tw*j/8;ctx.lineWidth=m*.005;ctx.beginPath();ctx.moveTo(x-ww/2,yy);ctx.lineTo(x+ww/2,yy);ctx.moveTo(x-ww/2,yy);ctx.lineTo(x+ww*.4,yy-(bottom-top)/8);ctx.stroke();}ctx.lineWidth=m*.012;ctx.beginPath();ctx.arc(x,bottom,tw*.25,Math.PI,0);ctx.stroke();
    ctx.fillStyle='#c6b199';ctx.fillRect(0,h*.81,w,h*.025);
  }else if(id==='snow'){
    gradient(ctx,w,h,[[0,'#81b9da'],[.55,'#d6e8ee'],[1,'#f2f4f0']]);
    for(let layer=0;layer<3;layer++)for(let j=0;j<5;j++){const x=(j*.3-.15+layer*.05)*w,y=h*(.23+layer*.15),r=w*.25;polygon(ctx,[[x-r,h],[x,y],[x+r,h]],['#91aabd','#6b91a7','#d8e5e9'][layer]);polygon(ctx,[[x-r*.3,y+h*.19],[x,y],[x+r*.3,y+h*.19],[x+r*.08,y+h*.14],[x-r*.07,y+h*.2]],'#fffdf6');}
    for(let i=0;i<70;i++)circle(ctx,rand()*w,rand()*h,m*(.001+rand()*.003),'#ffffffb8');
  }else if(id==='forest'){
    gradient(ctx,w,h,[[0,'#2e7d76'],[.5,'#9bc9a0'],[1,'#284b52']]);
    for(let j=0;j<24;j++){const x=rand()*w,bw=m*(.025+rand()*.04);ctx.fillStyle=j%2?'#285e5c80':'#163e4580';ctx.fillRect(x,0,bw,h);for(let k=0;k<4;k++)circle(ctx,x+(rand()-.5)*m*.3,rand()*h*.38,m*(.05+rand()*.13),'#367e6180');}
    ctx.fillStyle='#a9d2c6';ctx.beginPath();ctx.moveTo(w*.53,h*.55);ctx.bezierCurveTo(w*.2,h*.75,w*.8,h*.8,w*.3,h);ctx.lineTo(w*.7,h);ctx.bezierCurveTo(w*.9,h*.8,w*.35,h*.73,w*.53,h*.55);ctx.fill();for(let i=0;i<65;i++)circle(ctx,rand()*w,h*(.3+rand()*.65),m*(.0015+rand()*.003),'#ffe5a8b8');
  }else if(id==='desert'){
    gradient(ctx,w,h,[[0,'#6d6093'],[.42,'#ec9c94'],[.69,'#ffc28c'],[1,'#8e586e']]);circle(ctx,w*.75,h*.42,m*.15,'#ffe6ab');
    for(let j=0;j<4;j++){ctx.fillStyle=['#dca089','#ca8a79','#ae6d70','#824d69'][j];ctx.beginPath();ctx.moveTo(0,h);ctx.lineTo(0,h*(.58+j*.1));ctx.bezierCurveTo(w*.3,h*(.8-j*.01),w*.5,h*(.4+j*.1),w,h*(.65+j*.08));ctx.lineTo(w,h);ctx.fill();}
  }else if(id==='party'){
    gradient(ctx,w,h,[[0,'#391d5f'],[.5,'#8e447d'],[1,'#342348']]);for(let j=0;j<5;j++){ctx.fillStyle=['#3cafd12b','#e3b9ff30','#ffdb6f24'][j%3];polygon(ctx,[[w*(.1+j*.2),0],[w*(j*.25-.2),h],[w*(j*.25+.3),h]],ctx.fillStyle);}
    circle(ctx,w*.5,h*.16,m*.12,'#d7cbe6');for(let y=-4;y<=4;y++)for(let x=-4;x<=4;x++)if(x*x+y*y<17){ctx.fillStyle=(x+y)%2?'#8e84ae':'#f4e7ed';ctx.fillRect(w*.5+x*m*.024,h*.16+y*m*.024,m*.019,m*.019);}
    for(let j=0;j<95;j++){ctx.save();ctx.translate(rand()*w,rand()*h);ctx.rotate(rand()*4);ctx.fillStyle=['#e7ba72','#85d7ce','#e887ad','#ab91de'][j%4];ctx.fillRect(0,0,m*.008,m*.023);ctx.restore();}
  }else gradient(ctx,w,h,[[0,'#e7e1d3'],[1,'#f5eddd']]);ctx.restore();
}
function bubble(ctx,s,size){
  ctx.fillStyle='#fffdf7';ctx.strokeStyle='#544b66';ctx.lineWidth=.014;ctx.beginPath();ctx.moveTo(-.4,-.27);ctx.lineTo(.4,-.27);ctx.quadraticCurveTo(.5,-.27,.5,-.17);ctx.lineTo(.5,.13);ctx.quadraticCurveTo(.5,.23,.4,.23);ctx.lineTo(-.4,.23);ctx.quadraticCurveTo(-.5,.23,-.5,.13);ctx.lineTo(-.5,-.17);ctx.quadraticCurveTo(-.5,-.27,-.4,-.27);ctx.fill();ctx.stroke();polygon(ctx,[[.08,.22],[.15,.38],[.27,.22]],'#fffdf7');
  ctx.shadowColor='transparent';ctx.fillStyle='#50425c';ctx.textAlign='center';ctx.textBaseline='middle';const lines=s.text.length>25?[s.text.slice(0,Math.ceil(s.text.length/2)),s.text.slice(Math.ceil(s.text.length/2))]:[s.text];ctx.scale(1/size,1/size);ctx.font='600 '+Math.min(.16,1.6/Math.max(1,...lines.map(l=>l.length)))*size+'px Arial,sans-serif';
  lines.forEach((line,i)=>ctx.fillText(line,0,(i-(lines.length-1)/2)*.18*size,.88*size));
}
export function drawSticker(ctx,s,w,h){
  const size=s.size*Math.min(w,h);ctx.save();ctx.translate(s.x*w,s.y*h);ctx.rotate(s.rotation*Math.PI/180);ctx.shadowColor='#22132b33';ctx.shadowBlur=.02*size;ctx.shadowOffsetY=.012*size;
  if(s.kind==='emoji'){ctx.font=size+'px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(s.glyph,0,0);}
  else if(s.kind==='text'){ctx.scale(size,size);bubble(ctx,s,size);}
  else{ctx.scale(size,size);ctx.lineJoin='round';ctx.lineCap='round';ctx.lineWidth=.025;
    if(s.prop==='glasses'){ctx.fillStyle='#17242f';ctx.strokeStyle='#101923';for(const x of [-.27,.27]){ctx.beginPath();ctx.ellipse(x,0,.22,.17,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.strokeStyle='#a2d0d1';ctx.lineWidth=.018;ctx.beginPath();ctx.moveTo(x-.12,-.08);ctx.lineTo(x+.06,-.13);ctx.stroke();ctx.strokeStyle='#101923';}ctx.lineWidth=.04;ctx.beginPath();ctx.moveTo(-.06,-.04);ctx.quadraticCurveTo(0,-.1,.06,-.04);ctx.moveTo(-.49,-.06);ctx.lineTo(-.56,-.15);ctx.moveTo(.49,-.06);ctx.lineTo(.56,-.15);ctx.stroke();}
    if(s.prop==='crown'){polygon(ctx,[[-.48,.2],[-.5,-.3],[-.22,-.06],[0,-.43],[.22,-.06],[.5,-.3],[.48,.2]],'#eac568');ctx.fillStyle='#b98732';ctx.fillRect(-.48,.16,.96,.1);for(const x of [-.3,0,.3])circle(ctx,x,.04,.047,x?'#cd7188':'#64a5a3');}
    if(s.prop==='mustache'){ctx.fillStyle='#372b29';ctx.beginPath();ctx.moveTo(0,-.07);ctx.bezierCurveTo(-.2,-.28,-.25,.18,-.5,-.02);ctx.bezierCurveTo(-.46,.35,-.12,.3,0,.1);ctx.bezierCurveTo(.12,.3,.46,.35,.5,-.02);ctx.bezierCurveTo(.25,.18,.2,-.28,0,-.07);ctx.fill();}
    if(s.prop==='hat'){polygon(ctx,[[-.4,.34],[0,-.48],[.4,.34]],'#b588d2');ctx.save();ctx.beginPath();ctx.moveTo(-.4,.34);ctx.lineTo(0,-.48);ctx.lineTo(.4,.34);ctx.clip();ctx.strokeStyle='#edba6e';ctx.lineWidth=.09;for(let i=-2;i<4;i++){ctx.beginPath();ctx.moveTo(-.7,i*.2);ctx.lineTo(.7,i*.2+.4);ctx.stroke();}ctx.restore();circle(ctx,0,-.48,.075,'#ffe09b');}
    if(s.prop==='bunny'){for(const x of [-.23,.23]){ctx.fillStyle='#fff0dc';ctx.strokeStyle='#c3a6a0';ctx.beginPath();ctx.ellipse(x,0,.14,.49,x*.6,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#edb3bd';ctx.beginPath();ctx.ellipse(x,-.02,.07,.34,x*.6,0,Math.PI*2);ctx.fill();}}
    if(s.prop==='pirate'){ctx.strokeStyle='#2a2531';ctx.lineWidth=.035;ctx.beginPath();ctx.moveTo(-.53,-.25);ctx.lineTo(.5,.2);ctx.stroke();ctx.fillStyle='#27232c';ctx.beginPath();ctx.ellipse(.2,0,.22,.2,-.1,0,Math.PI*2);ctx.fill();circle(ctx,.2,-.02,.045,'#eee4db');}
    if(s.prop==='bowtie'){polygon(ctx,[[0,0],[-.48,-.28],[-.48,.28]],'#c4617d');polygon(ctx,[[0,0],[.48,-.28],[.48,.28]],'#ad4f74');circle(ctx,0,0,.12,'#e292a6');}
  }
  ctx.restore();
}
export function paintMask(ctx,width,height,mask,strokes=[]){
  ctx.clearRect(0,0,width,height);ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height);
  if(mask){const small=typeof OffscreenCanvas==='function'?new OffscreenCanvas(mask.width,mask.height):document.createElement('canvas');small.width=mask.width;small.height=mask.height;const sc=small.getContext('2d'),data=sc.createImageData(mask.width,mask.height);for(let i=0;i<mask.data.length;i++){data.data[i*4]=data.data[i*4+1]=data.data[i*4+2]=255;data.data[i*4+3]=mask.data[i];}sc.putImageData(data,0,0);ctx.clearRect(0,0,width,height);ctx.drawImage(small,0,0,width,height);small.width=small.height=1;}
  for(const stroke of strokes){ctx.save();ctx.globalCompositeOperation=stroke.mode==='erase'?'destination-out':'source-over';ctx.strokeStyle=ctx.fillStyle='#fff';ctx.lineWidth=stroke.size*Math.min(width,height);ctx.lineCap=ctx.lineJoin='round';const points=stroke.points;ctx.beginPath();ctx.moveTo(points[0].x*width,points[0].y*height);for(const p of points.slice(1))ctx.lineTo(p.x*width,p.y*height);if(points.length===1)circle(ctx,points[0].x*width,points[0].y*height,ctx.lineWidth/2,'#fff');else ctx.stroke();ctx.restore();}
}
