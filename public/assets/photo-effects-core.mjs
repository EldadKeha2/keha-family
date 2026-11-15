// One deterministic pixel pipeline serves thumbnails, the live preview and export.
// Effects never change image geometry, so copied face regions stay in place.
export const LOOKS=[
  ['original','מקור','Original'],['vivid','צבע חי','Vivid'],['portrait','דיוקן רך','Soft portrait'],['cinema','קולנוע','Cinema'],
  ['golden','שעת זהב','Golden hour'],['cool','אור צפוני','Northern light'],['matte','מט עדין','Matte'],['film','פילם 35','35 mm film'],
  ['vintage','נוסטלגיה','Vintage'],['sepia','ספיה','Sepia'],['noir','שחור לבן דרמטי','Noir'],['silver','כסף','Silver'],
  ['faded','זיכרון דהוי','Faded memory'],['rose','ורוד עתיק','Antique rose'],['teal','טורקיז וענבר','Teal & amber'],['cyanotype','ציאנוטייפ','Cyanotype']
];
export const ART=[
  ['none','ללא','None'],['pencil','רישום בעיפרון','Pencil sketch'],['charcoal','פחם','Charcoal'],['watercolor','צבעי מים','Watercolor'],
  ['comic','קומיקס','Comic book'],['poster','פוסטר','Pop poster'],['duotone','דואוטון','Duotone'],['pixels','פיקסל ארט','Pixel art']
];
export const LIGHT=[
  ['none','ללא','None'],['glow','זוהר רך','Soft glow'],['sun','קרן שמש','Sunbeam'],['leak','זליגת אור','Light leak'],
  ['prism','פריזמה','Prism'],['spotlight','זרקור','Spotlight'],['dream','חלום','Dreamscape'],['bokeh','בוקה','Bokeh']
];
export const FRAMES=[
  ['none','ללא','None'],['ivory','שנהב','Ivory'],['polaroid','פולארויד','Polaroid'],['gold','זהב','Gold'],
  ['ornament','עיטור תימני','Yemenite ornament'],['film','סרט צילום','Film strip'],['gallery','פספרטו','Gallery mat'],['postcard','גלויה','Postcard']
];
export const TUNING=[
  ['exposure','בהירות','Brightness',-100,100],['contrast','ניגודיות','Contrast',-100,100],['saturation','רוויה','Saturation',-100,100],['warmth','חום','Warmth',-100,100],
  ['shadows','צללים','Shadows',-100,100],['sharpness','חדות','Sharpness',0,100],['vignette','הכהיית שוליים','Vignette',0,100],['grain','גרעיניות','Film grain',0,100]
];
export const defaults=()=>({look:'original',art:'none',light:'none',frame:'none',intensity:100,...Object.fromEntries(TUNING.map(([id])=>[id,0]))});
const clamp=(v,a=0,b=255)=>Math.max(a,Math.min(b,v));
export function normalizeEffects(input={}){
  const out=defaults();
  for(const [key,list]of [['look',LOOKS],['art',ART],['light',LIGHT],['frame',FRAMES]])if(list.some(([id])=>id===input[key]))out[key]=input[key];
  for(const [key,,,min,max]of [...TUNING,['intensity','','',0,100]])if(Number.isFinite(Number(input[key])))out[key]=clamp(Number(input[key]),min,max);
  return out;
}
export function effectPixels(pixels,width,height,input={}){
  if(pixels.length!==width*height*4)throw Error('Invalid image dimensions');
  const s=normalizeEffects(input),out=new Uint8ClampedArray(pixels.length),strength=s.intensity/100;
  if(!strength||s.look==='original'&&s.art==='none'&&TUNING.every(([key])=>s[key]===0)){out.set(pixels);return out;}
  const at=(x,y,c)=>pixels[(clamp(y,0,height-1)*width+clamp(x,0,width-1))*4+c];
  const preset={vivid:[1.03,1.14,1.3,1],portrait:[1.07,.95,.92,4],cinema:[.96,1.18,.85,-3],golden:[1.06,1.04,1.08,15],cool:[1.02,1.02,.95,-16],matte:[1.03,.82,.85,3],film:[1.02,1.1,.9,6],vintage:[1.02,.88,.72,12],sepia:[1,1,.1,0],noir:[1,1.36,0,0],silver:[1.07,1.06,0,0],faded:[1.08,.74,.64,7],rose:[1.04,.95,.84,2],teal:[1,1.14,1.1,-2],cyanotype:[1,1.06,0,0]}[s.look]||[1,1,1,0];
  const exposure=preset[0]*2**(s.exposure/100),contrast=preset[1]*(1+s.contrast/130),saturation=preset[2]*(1+s.saturation/100),warmth=preset[3]+s.warmth*.35;
  const edgeArt=['pencil','charcoal','comic','watercolor'].includes(s.art),smooth=s.art==='watercolor',block=Math.max(1,Math.round(width/85)),sharp=s.sharpness/100;
  const radius=Math.max(1,Math.round(Math.max(width,height)/1000)),gray=edgeArt?new Float32Array(width*height):null;
  if(gray)for(let i=0,j=0;i<pixels.length;i+=4,j++)gray[j]=.2126*pixels[i]+.7152*pixels[i+1]+.0722*pixels[i+2];
  const luma=(x,y)=>gray[clamp(y,0,height-1)*width+clamp(x,0,width-1)];
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const i=(y*width+x)*4,px=s.art==='pixels'?Math.floor(x/block)*block:x,py=s.art==='pixels'?Math.floor(y/block)*block:y;
    const sourceIndex=(py*width+px)*4;let r=pixels[sourceIndex],g=pixels[sourceIndex+1],b=pixels[sourceIndex+2];
    if(smooth||sharp){
      const avg=c=>(pixels[i+c]*4+at(x-radius,y,c)+at(x+radius,y,c)+at(x,y-radius,c)+at(x,y+radius,c))/8,ar=avg(0),ag=avg(1),ab=avg(2);
      if(smooth){r=r*.25+ar*.75;g=g*.25+ag*.75;b=b*.25+ab*.75;}
      if(sharp){r+=(r-ar)*sharp*3;g+=(g-ag)*sharp*3;b+=(b-ab)*sharp*3;}
    }
    r=(r*exposure-128)*contrast+128;g=(g*exposure-128)*contrast+128;b=(b*exposure-128)*contrast+128;
    let l=.2126*r+.7152*g+.0722*b,shadow=(1-clamp(l)/255)**2*s.shadows*.65;
    r=l+(r-l)*saturation+warmth+shadow;g=l+(g-l)*saturation+shadow;b=l+(b-l)*saturation-warmth+shadow;
    if(s.look==='sepia'){const v=.299*r+.587*g+.114*b;r=v*1.08+18;g=v*.93+9;b=v*.72;}
    if(['matte','faded','vintage'].includes(s.look)){r=r*.91+18;g=g*.92+15;b=b*.91+19;}
    if(s.look==='rose'){r+=12;b+=7;g-=4;}
    if(['cinema','teal'].includes(s.look)){const v=clamp(l)/255;r+=(v-.5)*19;g+=(1-v)*7;b+=(1-v)*16-v*8;}
    if(s.look==='cyanotype'){const v=clamp(l)/255;r=12+v*209;g=40+v*196;b=81+v*165;}
    let edge=0;
    if(edgeArt){const dx=luma(x+radius,y-radius)+2*luma(x+radius,y)+luma(x+radius,y+radius)-luma(x-radius,y-radius)-2*luma(x-radius,y)-luma(x-radius,y+radius),dy=luma(x-radius,y+radius)+2*luma(x,y+radius)+luma(x+radius,y+radius)-luma(x-radius,y-radius)-2*luma(x,y-radius)-luma(x+radius,y-radius);edge=clamp(Math.hypot(dx,dy)/3);}
    if(s.art==='pencil'){const v=clamp(255-edge*2.1-(255-clamp(l))*.17);r=v+3;g=v+1;b=v-5;}
    if(s.art==='charcoal'){const v=clamp(clamp(l)*.66-edge*1.65+43);r=g=b=v;}
    if(s.art==='watercolor'||s.art==='poster'||s.art==='comic'){
      const levels=s.art==='poster'?5:s.art==='comic'?7:14,quant=v=>Math.round(clamp(v)/255*levels)/levels*255;
      [r,g,b]=[quant(r),quant(g),quant(b)];
      if(s.art==='comic'&&edge>38)[r,g,b]=[r*.18,g*.18,b*.18];
      if(s.art==='watercolor'){const paper=(Math.sin(x*.8+y*.3)+Math.cos(y*.7-x*.2))*1.3;r+=paper+5;g+=paper+4;b+=paper;}
    }
    if(s.art==='duotone'){const v=clamp(.2126*r+.7152*g+.0722*b)/255;r=42+v*209;g=28+v*185;b=77+v*88;}
    const nx=(x/Math.max(1,width-1)-.5)*2,ny=(y/Math.max(1,height-1)-.5)*2;
    const v=1-Math.max(0,(nx*nx+ny*ny-.25)/1.75)*s.vignette*.007;
    let noise=0;if(s.grain||s.look==='film'){let seed=Math.imul(x+1,374761393)^Math.imul(y+1,668265263);seed=Math.imul(seed^(seed>>>13),1274126177);noise=((seed>>>0)/4294967295-.5)*(s.grain*.45+(s.look==='film'?7:0));}
    out[i]=pixels[i]+(r*v+noise-pixels[i])*strength;out[i+1]=pixels[i+1]+(g*v+noise-pixels[i+1])*strength;out[i+2]=pixels[i+2]+(b*v+noise-pixels[i+2])*strength;out[i+3]=pixels[i+3];
  }
  return out;
}
function lighting(ctx,w,h,s){
  const strength=s.intensity/100;if(s.light==='none'||!strength)return;
  ctx.save();ctx.globalAlpha=strength;ctx.globalCompositeOperation='screen';
  const radial=(x,y,r,color,alpha)=>{const g=ctx.createRadialGradient(w*x,h*y,0,w*x,h*y,Math.max(w,h)*r);g.addColorStop(0,color);g.addColorStop(1,'transparent');ctx.globalAlpha=strength*alpha;ctx.fillStyle=g;ctx.fillRect(0,0,w,h);};
  if(s.light==='glow'||s.light==='dream'){radial(.5,.3,.8,'#ffe2b4',.24);if(s.light==='dream'){radial(.1,.9,.7,'#a5adff',.27);radial(.9,.1,.7,'#ffb5d1',.25);}}
  if(s.light==='sun'){radial(.95,.02,.75,'#ffdc86',.65);const g=ctx.createLinearGradient(w,0,w*.2,h);g.addColorStop(0,'#fff4c58a');g.addColorStop(.55,'#ffdf9e18');g.addColorStop(1,'transparent');ctx.fillStyle=g;ctx.globalAlpha=strength;ctx.beginPath();ctx.moveTo(w*.88,0);ctx.lineTo(w,0);ctx.lineTo(w*.6,h);ctx.lineTo(w*.05,h);ctx.fill();}
  if(s.light==='leak'){radial(0,.3,.7,'#ff6241',.55);radial(.08,.02,.4,'#ffc772',.65);}
  if(s.light==='prism'){radial(0,.1,.6,'#e49bff',.4);radial(1,.8,.7,'#67d6ec',.35);}
  if(s.light==='bokeh')for(let j=0;j<17;j++){const x=((j*37+11)%101)/100,y=((j*67+17)%97)/96,r=Math.min(w,h)*(.016+j%4*.01);ctx.globalAlpha=strength*.14;ctx.fillStyle=j%2?'#ffdf91':'#fff3e7';ctx.beginPath();ctx.arc(x*w,y*h,r,0,Math.PI*2);ctx.fill();}
  if(s.light==='spotlight'){ctx.globalCompositeOperation='multiply';const g=ctx.createRadialGradient(w*.5,h*.42,Math.min(w,h)*.1,w*.5,h*.42,Math.max(w,h)*.7);g.addColorStop(0,'#ffffff');g.addColorStop(1,'#34314d');ctx.globalAlpha=strength*.65;ctx.fillStyle=g;ctx.fillRect(0,0,w,h);}
  ctx.restore();
}
function frame(ctx,w,h,id){
  if(id==='none')return;ctx.save();const m=Math.min(w,h),t=Math.max(2,m*.035),line=(inset,color,size)=>{ctx.strokeStyle=color;ctx.lineWidth=size;ctx.strokeRect(inset,inset,w-2*inset,h-2*inset);};
  if(['ivory','polaroid','gallery','postcard'].includes(id)){ctx.fillStyle=id==='gallery'?'#f1e6d1':'#fffaf0';ctx.fillRect(0,0,w,t);ctx.fillRect(0,h-t,w,t);ctx.fillRect(0,0,t,h);ctx.fillRect(w-t,0,t,h);if(id==='polaroid')ctx.fillRect(0,h-t*2.8,w,t*2.8);if(id==='gallery')line(t*.95,'#a99b7f',m*.003);if(id==='postcard'){ctx.setLineDash([m*.008,m*.008]);line(t*.48,'#a48a66',m*.003);}}
  if(id==='gold'||id==='ornament'){line(t*.45,'#bea06a',t*.65);line(t*.92,'#f6deb1',m*.003);line(t*1.1,'#725b35',m*.002);}
  if(id==='ornament'){
    ctx.strokeStyle='#604b2f';ctx.lineWidth=m*.002;const diamond=(x,y,r)=>{ctx.beginPath();ctx.moveTo(x,y-r);ctx.lineTo(x+r,y);ctx.lineTo(x,y+r);ctx.lineTo(x-r,y);ctx.closePath();ctx.stroke();};
    for(let x=t*2;x<w-t;x+=t*1.4){diamond(x,t*.45,t*.23);diamond(x,h-t*.45,t*.23);}for(let y=t*2;y<h-t;y+=t*1.4){diamond(t*.45,y,t*.23);diamond(w-t*.45,y,t*.23);}
  }
  if(id==='film'){ctx.fillStyle='#211d18';ctx.fillRect(0,0,t,h);ctx.fillRect(w-t,0,t,h);ctx.fillStyle='#eee4ce';for(let y=t*.5;y<h;y+=t*1.5){ctx.fillRect(t*.28,y,t*.44,t*.75);ctx.fillRect(w-t*.72,y,t*.44,t*.75);}}
  ctx.restore();
}
export function renderEffects(canvas,source,input={},maxEdge=1400){
  const s=normalizeEffects(input),sw=source.naturalWidth||source.width,sh=source.naturalHeight||source.height;
  if(!(sw>0&&sh>0))throw Error('Image unavailable');
  const scale=Math.min(1,maxEdge/Math.max(sw,sh));canvas.width=Math.max(1,Math.round(sw*scale));canvas.height=Math.max(1,Math.round(sh*scale));
  const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)throw Error('Canvas unavailable');
  ctx.drawImage(source,0,0,canvas.width,canvas.height);
  const data=ctx.getImageData(0,0,canvas.width,canvas.height);data.data.set(effectPixels(data.data,canvas.width,canvas.height,s));ctx.putImageData(data,0,0);
  lighting(ctx,canvas.width,canvas.height,s);frame(ctx,canvas.width,canvas.height,s.frame);return canvas;
}
