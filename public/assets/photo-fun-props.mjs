import {PROP_STYLES} from './photo-fun-catalog.mjs?v=1';
const circle=(ctx,x,y,r,color)=>{ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();};
const ellipse=(ctx,x,y,rx,ry,color,angle=0)=>{ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,rx,ry,angle,0,Math.PI*2);ctx.fill();};
const polygon=(ctx,points,color)=>{ctx.fillStyle=color;ctx.beginPath();points.forEach(([x,y],i)=>ctx[i?'lineTo':'moveTo'](x,y));ctx.closePath();ctx.fill();};
const line=(ctx,points,color,width=.025)=>{ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();points.forEach(([x,y],i)=>ctx[i?'lineTo':'moveTo'](x,y));ctx.stroke();};
function star(ctx,x,y,r,color){const points=[];for(let i=0;i<10;i++){const a=i*Math.PI/5-Math.PI/2,rr=i%2?r*.44:r;points.push([x+Math.cos(a)*rr,y+Math.sin(a)*rr]);}polygon(ctx,points,color);}
function heart(ctx,x,y,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(x,y+r*.8);ctx.bezierCurveTo(x-r*1.5,y-r*.15,x-r*.5,y-r*1.3,x,y-r*.5);ctx.bezierCurveTo(x+r*.5,y-r*1.3,x+r*1.5,y-r*.15,x,y+r*.8);ctx.fill();}
export function drawExtraProp(ctx,s,size){
  const spec=PROP_STYLES[s.prop];if(!spec)return false;
  if(spec.shape==='glyph'){ctx.font=size+'px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(spec.glyph,0,0);return true;}
  ctx.scale(size,size);ctx.lineCap=ctx.lineJoin='round';const c=spec.color,a=spec.accent||'#f5d28b';
  switch(spec.shape){
    case 'glasses':{
      for(const x of [-.27,.27]){
        if(spec.variant==='heart'){heart(ctx,x,0,.28,c);heart(ctx,x,0,.205,'#71344b');}
        else if(spec.variant==='star'){star(ctx,x,0,.29,c);star(ctx,x,0,.205,'#6d5a75');}
        else if(spec.variant==='pixel'){polygon(ctx,[[x-.24,-.15],[x+.24,-.15],[x+.24,.08],[x+.14,.08],[x+.14,.18],[x-.14,.18],[x-.14,.08],[x-.24,.08]],c);for(let i=0;i<3;i++){ctx.fillStyle='#f3e7ee';ctx.fillRect(x-.18+i*.09,-.1,.06,.05);}}
        else{circle(ctx,x,0,.215,c);circle(ctx,x,0,.18,'#c3dfe83b');line(ctx,[[x-.1,-.1],[x-.03,-.15]],'#fff5db',.014);}
      }line(ctx,[[-.05,-.03],[0,-.07],[.05,-.03]],c,.035);line(ctx,[[-.49,-.05],[-.56,-.12]],c);line(ctx,[[.49,-.05],[.56,-.12]],c);break;
    }
    case 'goggles':case 'snorkel':{
      line(ctx,[[-.52,-.02],[.52,-.02]],'#4e5d70',.09);ellipse(ctx,0,0,.46,.23,c);ellipse(ctx,0,-.015,.4,.17,'#a4e2e7');line(ctx,[[-.28,-.09],[-.1,-.13]],'#efffff',.02);line(ctx,[[-.02,-.15],[-.02,.12]],c,.035);
      if(spec.shape==='snorkel'){line(ctx,[[.33,.07],[.39,.4],[.53,.4],[.53,-.43]],c,.075);line(ctx,[[.53,-.43],[.61,-.43]],'#f7bf67',.08);line(ctx,[[.4,.4],[.28,.38]],'#344c63',.08);}break;
    }
    case 'monocle':{circle(ctx,.25,0,.23,c);circle(ctx,.25,0,.198,'#cfe6ed45');line(ctx,[[.38,.18],[.5,.28],[.4,.46],[.51,.53]],c,.012);line(ctx,[[.16,-.1],[.22,-.14]],'#fff7da',.014);break;}
    case 'lashes':{for(const x of [-.27,.27]){const ctx2=ctx;ctx2.strokeStyle=c;ctx2.lineWidth=.026;ctx2.beginPath();ctx2.moveTo(x-.18,.02);ctx2.quadraticCurveTo(x,-.13,x+.18,.02);ctx2.stroke();for(let j=-2;j<=2;j++)line(ctx,[[x+j*.064,-.035],[x+j*.087,-.17+Math.abs(j)*.018]],c,.02);}break;}
    case 'mask':{
      ctx.fillStyle=c;ctx.beginPath();const points=spec.variant==='butterfly'?[[-.04,-.06],[-.48,-.35],[-.52,.05],[-.37,.27],[0,.09],[.37,.27],[.52,.05],[.48,-.35]]:spec.variant==='carnival'?[[-.54,-.25],[-.24,-.12],[0,-.18],[.24,-.12],[.54,-.25],[.46,.19],[.15,.2],[0,.08],[-.15,.2],[-.46,.19]]:[[-.53,-.17],[0,-.12],[.53,-.17],[.45,.19],[.15,.2],[0,.08],[-.15,.2],[-.45,.19]];
      points.forEach(([x,y],i)=>ctx[i?'lineTo':'moveTo'](x,y));ctx.closePath();for(const x of [-.26,.26]){ctx.moveTo(x+.12,0);ctx.ellipse(x,0,.12,.07,0,0,Math.PI*2);}ctx.fill('evenodd');
      if(spec.variant)for(const x of [-.43,.43]){circle(ctx,x,-.1,.022,'#f8db96');star(ctx,x,.09,.035,'#f6d58c');}else star(ctx,0,-.08,.055,'#f8dc86');break;
    }
    case 'hat':{
      if(spec.variant==='top'){ctx.fillStyle=c;ctx.fillRect(-.29,-.45,.58,.67);ellipse(ctx,0,-.45,.29,.05,c);ellipse(ctx,0,.23,.52,.08,c);ctx.fillStyle=a;ctx.fillRect(-.29,.06,.58,.11);}
      else if(spec.variant==='cowboy'){ellipse(ctx,0,.2,.56,.13,c);polygon(ctx,[[-.28,.19],[-.27,-.29],[-.13,-.39],[0,-.3],[.13,-.39],[.27,-.29],[.28,.19]],c);ctx.fillStyle=a;ctx.fillRect(-.27,.06,.54,.075);line(ctx,[[-.55,.13],[-.41,.01]],a,.025);line(ctx,[[.55,.13],[.41,.01]],a,.025);}
      else if(spec.variant==='wizard'){polygon(ctx,[[-.43,.29],[-.11,-.49],[.1,-.41],[.18,-.27],[.34,.29]],c);ellipse(ctx,0,.3,.53,.08,c);for(const [x,y,r]of [[0,-.24,.06],[-.14,.12,.075],[.2,.18,.04]])star(ctx,x,y,r,a);}
      else if(spec.variant==='santa'){ctx.fillStyle=c;ctx.beginPath();ctx.moveTo(-.4,.2);ctx.bezierCurveTo(-.3,-.5,.12,-.5,.4,-.12);ctx.lineTo(.23,.02);ctx.quadraticCurveTo(.1,-.15,.07,.2);ctx.fill();ellipse(ctx,-.13,.2,.38,.095,a);circle(ctx,.37,-.06,.11,a);}
      else if(spec.variant==='chef'){ctx.fillStyle=c;ctx.fillRect(-.29,-.05,.58,.38);for(const [x,y,r]of [[-.27,-.17,.18],[0,-.28,.24],[.27,-.17,.18]])circle(ctx,x,y,r,c);line(ctx,[[-.29,.23],[.29,.23]],a,.025);for(const x of [-.14,0,.14])line(ctx,[[x,-.02],[x,.16]],a,.012);}
      else if(spec.variant==='graduate'){ellipse(ctx,0,.12,.24,.15,c);polygon(ctx,[[-.52,-.1],[0,-.38],[.52,-.1],[0,.16]],c);line(ctx,[[0,-.1],[.38,-.03],[.43,.37]],a,.018);circle(ctx,0,-.1,.025,a);line(ctx,[[.4,.36],[.46,.36],[.46,.46],[.4,.46]],a,.035);}
      else if(spec.variant==='beret'){ellipse(ctx,-.03,-.05,.47,.26,c,-.15);ellipse(ctx,0,.15,.29,.05,a);line(ctx,[[.05,-.3],[.02,-.39]],a,.04);}
      else if(spec.variant==='cap'){ellipse(ctx,-.06,-.02,.35,.29,c);ellipse(ctx,.21,.21,.35,.06,a,-.15);line(ctx,[[-.07,-.3],[-.07,.17]],a,.012);circle(ctx,-.07,-.31,.025,a);star(ctx,-.06,-.02,.065,'#f6ddaf');}break;
    }
    case 'viking':{for(const side of [-1,1]){ctx.fillStyle='#f5e5b8';ctx.beginPath();ctx.moveTo(side*.24,-.1);ctx.quadraticCurveTo(side*.59,-.1,side*.46,-.47);ctx.quadraticCurveTo(side*.72,.03,side*.33,.11);ctx.fill();}ellipse(ctx,0,.02,.35,.3,c);ctx.fillStyle='#b2b7c4';ctx.fillRect(-.35,.09,.7,.08);ctx.fillRect(-.035,-.27,.07,.44);for(const x of [-.27,-.14,0,.14,.27])circle(ctx,x,.13,.018,'#59647c');break;}
    case 'halo':{ctx.shadowColor='#f8d86e';ctx.shadowBlur=.07;ctx.strokeStyle=c;ctx.lineWidth=.055;ctx.beginPath();ctx.ellipse(0,0,.43,.12,-.1,0,Math.PI*2);ctx.stroke();line(ctx,[[-.23,-.05],[-.07,-.09]],'#fff6ca',.014);break;}
    case 'horns':{for(const side of [-1,1]){ctx.fillStyle=c;ctx.beginPath();ctx.moveTo(side*.13,.23);ctx.bezierCurveTo(side*.15,-.06,side*.44,-.21,side*.4,-.49);ctx.bezierCurveTo(side*.62,-.05,side*.49,.22,side*.32,.26);ctx.fill();}break;}
    case 'ears':{for(const side of [-1,1]){polygon(ctx,[[side*.14,.27],[side*.29,-.45],[side*.5,.29]],c);polygon(ctx,[[side*.22,.18],[side*.3,-.28],[side*.42,.2]],a);}line(ctx,[[-.48,.26],[0,.18],[.48,.26]],c,.035);break;}
    case 'antlers':{for(const side of [-1,1]){line(ctx,[[side*.17,.4],[side*.24,-.06],[side*.4,-.4]],c,.055);line(ctx,[[side*.26,-.07],[side*.08,-.25],[side*.08,-.44]],c,.035);line(ctx,[[side*.33,-.23],[side*.51,-.24],[side*.55,-.4]],c,.035);line(ctx,[[side*.21,.12],[side*.44,.02],[side*.51,-.1]],c,.035);}break;}
    case 'tiara':{line(ctx,[[-.47,.19],[-.35,-.07],[-.16,.02],[0,-.35],[.16,.02],[.35,-.07],[.47,.19]],c,.045);line(ctx,[[-.47,.19],[.47,.19]],c,.06);for(const x of [-.32,0,.32])polygon(ctx,[[x,-.13-(x?0:.16)],[x+.055,-.04-(x?0:.16)],[x,.05-(x?0:.16)],[x-.055,-.04-(x?0:.16)]],a);break;}
    case 'flowers':{line(ctx,[[-.5,.08],[-.25,-.07],[0,-.1],[.25,-.07],[.5,.08]],'#668d5f',.04);for(let i=0;i<6;i++){const x=-.42+i*.17,y=-.06+Math.abs(x)*.26;for(let j=0;j<5;j++){const t=j*1.257;circle(ctx,x+Math.cos(t)*.058,y+Math.sin(t)*.058,.047,i%2?c:'#e8b9d8');}circle(ctx,x,y,.035,a);}break;}
    case 'rainbow':{for(let i=0;i<6;i++){ctx.strokeStyle=['#e87d9a','#efa76f','#eacf6a','#81bb91','#79b4d0','#a18ac2'][i];ctx.lineWidth=.045;ctx.beginPath();ctx.ellipse(0,.18,.46-i*.045,.43-i*.045,0,Math.PI,Math.PI*2);ctx.stroke();}for(const x of [-.4,.4]){circle(ctx,x,.18,.09,'#fff6e7');circle(ctx,x*.83,.16,.075,'#fff6e7');}break;}
    case 'nose':{circle(ctx,0,0,.43,c);ellipse(ctx,-.12,-.14,.11,.06,'#ffb0bd',-.4);break;}
    case 'blush':{for(const x of [-.32,.32]){ellipse(ctx,x,0,.13,.065,c);for(let i=-1;i<=1;i++)line(ctx,[[x+i*.043-.008,-.027],[x+i*.043+.008,.027]],'#d27591',.009);}break;}
    case 'freckles':{for(const side of [-1,1])for(const [x,y,r]of [[.2,-.03,.016],[.28,.01,.013],[.35,-.045,.017],[.4,.025,.012],[.27,.065,.012]])circle(ctx,side*x,y,r,c);break;}
    case 'fangs':{for(const side of [-1,1])polygon(ctx,[[side*.16,-.18],[side*.37,-.14],[side*.26,.28]],c);line(ctx,[[-.4,-.18],[0,-.14],[.4,-.18]],'#a25b71',.02);break;}
    case 'beard':{ctx.fillStyle=c;ctx.beginPath();ctx.moveTo(-.42,-.3);ctx.quadraticCurveTo(-.46,.3,0,.48);ctx.quadraticCurveTo(.46,.3,.42,-.3);ctx.lineTo(.23,-.16);ctx.quadraticCurveTo(0,.02,-.23,-.16);ctx.closePath();ctx.fill();for(let i=-3;i<=3;i++)line(ctx,[[i*.09,-.02+Math.abs(i)*.01],[i*.07,.32-Math.abs(i)*.04]],'#ffffff20',.008);break;}
    case 'goatee':{polygon(ctx,[[-.24,-.17],[0,-.1],[.24,-.17],[.17,.28],[0,.48],[-.17,.28]],c);break;}
    case 'curly':{for(const side of [-1,1]){ctx.strokeStyle=c;ctx.lineWidth=.09;ctx.beginPath();ctx.moveTo(0,-.02);ctx.bezierCurveTo(side*.15,-.18,side*.23,.2,side*.42,.08);ctx.bezierCurveTo(side*.6,-.08,side*.4,-.23,side*.35,-.09);ctx.stroke();}break;}
    case 'tie':{polygon(ctx,[[-.13,-.45],[.13,-.45],[.09,-.26],[-.09,-.26]],c);polygon(ctx,[[-.07,-.24],[.07,-.24],[.2,.3],[0,.48],[-.2,.3]],c);for(let i=0;i<3;i++)line(ctx,[[-.06,.01+i*.1],[.08,.09+i*.1]],'#c5d9e4',.022);break;}
    case 'necklace':{ctx.strokeStyle=c;ctx.lineWidth=.025;ctx.beginPath();ctx.ellipse(0,-.07,.42,.3,0,0,Math.PI);ctx.stroke();for(let i=0;i<15;i++){const a=i*Math.PI/14;circle(ctx,Math.cos(a)*.42,-.07+Math.sin(a)*.3,.025,c);}polygon(ctx,[[0,.17],[.11,.29],[0,.44],[-.11,.29]],'#e8bf59');polygon(ctx,[[0,.21],[.06,.29],[0,.37],[-.06,.29]],'#8bbeb3');break;}
    case 'medal':{polygon(ctx,[[-.31,-.44],[-.13,-.44],[.08,.08],[-.08,.08]],'#628fba');polygon(ctx,[[.31,-.44],[.13,-.44],[-.08,.08],[.08,.08]],'#c76679');circle(ctx,0,.2,.24,c);circle(ctx,0,.2,.18,'#f5d77f');star(ctx,0,.2,.11,'#b78836');break;}
    case 'scarf':{ctx.fillStyle=c;ctx.fillRect(-.48,-.16,.96,.24);polygon(ctx,[[.08,.02],[.34,.02],[.46,.48],[.2,.48]],c);for(let i=0;i<4;i++)line(ctx,[[-.38+i*.24,-.16],[-.32+i*.24,.08]],a,.035);for(let i=0;i<3;i++)line(ctx,[[.18+i*.08,.13],[.22+i*.08,.44]],a,.026);for(let i=0;i<6;i++)line(ctx,[[.2+i*.05,.47],[.2+i*.05,.54]],c,.018);break;}
    case 'headphones':{ctx.strokeStyle=c;ctx.lineWidth=.08;ctx.beginPath();ctx.ellipse(0,.05,.41,.46,0,Math.PI,Math.PI*2);ctx.stroke();for(const side of [-1,1]){ellipse(ctx,side*.41,.14,.1,.22,c);ellipse(ctx,side*.37,.14,.055,.17,'#3e3b56');line(ctx,[[side*.45,.02],[side*.45,.23]],'#ac9ace',.014);}break;}
    case 'sparkles':{for(const [x,y,r]of [[-.33,-.1,.12],[.35,-.07,.16],[-.46,.13,.06],[.47,.19,.05]])star(ctx,x,y,r,c);break;}
    case 'wings':{for(const side of [-1,1]){for(let i=0;i<7;i++)ellipse(ctx,side*(.17+i*.04),.13-i*.065,.055,.26-i*.012,c,side*(.5+i*.09));line(ctx,[[side*.04,.3],[side*.19,-.03],[side*.38,-.29]],'#dbcfc0',.015);}break;}
  }
  return true;
}
