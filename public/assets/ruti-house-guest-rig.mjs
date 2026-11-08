// Joints are measured in the original 384 × 512 walking cell. The arm is
// removed from that cell and its own sleeve, forearm and hand pixels move
// around these joints. No second painted arm is added to the character.
const rig=(shoulder,elbow,wrist,grip,mouth,width=15)=>Object.freeze({shoulder,elbow,wrist,grip,mouth,width});
export const GUEST_ARM_RIGS=Object.freeze({
 roi:rig([251,151],[275,218],[305,251],[313,270],[225,85]),
 hila:rig([245,160],[259,221],[288,255],[297,278],[181,92],17),
 rivi:rig([226,154],[244,221],[279,260],[289,281],[177,90],17),
 lihi:rig([229,160],[245,225],[274,263],[283,283],[165,91],14),
 'visitor-man':rig([247,150],[271,219],[301,260],[310,279],[212,89]),
 'visitor-hila':rig([246,151],[264,222],[291,266],[300,289],[184,94],17),
 'visitor-rivi':rig([223,151],[243,222],[279,266],[289,286],[177,91],17),
 'visitor-lihi':rig([228,153],[245,225],[276,267],[284,289],[166,91],14),
 eldad:rig([248,151],[263,214],[295,250],[303,268],[205,87],16),
 avigail:rig([246,155],[261,221],[286,255],[293,276],[183,90],17),
 eddie:rig([242,145],[259,211],[285,252],[293,272],[190,94]),
 yarden:rig([245,148],[259,213],[284,249],[293,269],[194,87],13),
 raya:rig([242,161],[257,223],[288,270],[298,291],[193,97],14),
 elinor:rig([239,154],[254,218],[282,262],[290,282],[191,94],13),
 ora:rig([244,165],[260,230],[290,270],[299,292],[191,101],18),
 'ariel-n':rig([247,164],[266,232],[296,269],[305,291],[196,98],19),
 tomer:rig([247,154],[264,216],[294,251],[302,272],[199,92],16),
 amir:rig([243,151],[260,213],[274,244],[281,264],[192,96],16),
 orit:rig([237,155],[250,216],[269,255],[278,276],[192,102],12),
 'ariel-f':rig([248,158],[266,221],[287,253],[295,274],[194,94],18)
});
const distance=(a,b)=>Math.hypot(b[0]-a[0],b[1]-a[1]);
const angle=(a,b)=>Math.atan2(b[1]-a[1],b[0]-a[0]);
function outline(points,widths){
 const sides=points.map((p,i)=>{const before=points[Math.max(0,i-1)],after=points[Math.min(points.length-1,i+1)],a=angle(before,after)+Math.PI/2;
  return [[p[0]+Math.cos(a)*widths[i],p[1]+Math.sin(a)*widths[i]],[p[0]-Math.cos(a)*widths[i],p[1]-Math.sin(a)*widths[i]]];});
 return [...sides.map(pair=>pair[0]),...sides.map(pair=>pair[1]).reverse()];
}
function armPieces(rig){
 const [sx,sy]=rig.shoulder,[ex,ey]=rig.elbow,[wx,wy]=rig.wrist,[gx,gy]=rig.grip;
 const seam=[[sx-9,sy+8],[sx-12,sy+30],[ex-20,ey+12],[wx-18,wy+5],[gx-24,gy+34]];
 // Include the complete outside of the sleeve and all fingertips. A narrow
 // capsule leaves stray finger/outline pixels behind in the original pose.
 return {
  outline:[...seam,[384,gy+40],[384,sy+8]],
  upper:[seam[0],seam[1],seam[2],[384,ey+12],[384,sy+8]],
  lower:[[ex-20,ey-8],seam[2],seam[3],seam[4],[384,gy+40],[384,ey-8]]
 };
}
export function guestArmOutline(rig){return armPieces(rig).outline;}
export function guestArmPose(rig,target){
 const shoulder=rig.shoulder,upper=distance(shoulder,rig.elbow),lower=distance(rig.elbow,rig.grip);
 const dx=target[0]-shoulder[0],dy=target[1]-shoulder[1],d=Math.max(Math.abs(upper-lower)+.1,Math.min(upper+lower-.1,Math.hypot(dx,dy)));
 const a=Math.atan2(dy,dx),bend=Math.acos(Math.max(-1,Math.min(1,(upper*upper+d*d-lower*lower)/(2*upper*d))));
 const elbow=[shoulder[0]+Math.cos(a+bend)*upper,shoulder[1]+Math.sin(a+bend)*upper];
 const hand=[shoulder[0]+Math.cos(a)*d,shoulder[1]+Math.sin(a)*d];
 return {shoulder,elbow,hand,upperAngle:angle(shoulder,elbow)-angle(shoulder,rig.elbow),lowerAngle:angle(elbow,hand)-angle(rig.elbow,rig.grip)};
}
function path(ctx,points){ctx.beginPath();ctx.moveTo(...points[0]);for(const p of points.slice(1))ctx.lineTo(...p);ctx.closePath();}
/** Draw the two original image pieces, with their shared elbow kept joined. */
export function drawGuestOriginalArm(ctx,atlas,column,rig,pose){
 const cw=atlas.naturalWidth/4,ch=atlas.naturalHeight/2;
 const piece=(points,pivot,placed,rotation)=>{
  ctx.save();ctx.translate(...placed);ctx.rotate(rotation);ctx.translate(-pivot[0],-pivot[1]);path(ctx,points);ctx.clip();
  ctx.drawImage(atlas,column*cw+.5,ch+.5,cw-1,ch-1,0,0,384,512);ctx.restore();
 };
 const pieces=armPieces(rig);
 piece(outline([rig.shoulder,rig.elbow],[rig.width,rig.width+1]),rig.shoulder,pose.shoulder,pose.upperAngle);
 piece(pieces.lower,rig.elbow,pose.elbow,pose.lowerAngle);
}
