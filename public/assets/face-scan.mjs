// Keep source detail; model input size is fixed, so small overlapping crops matter
// more than enlarging the same full-photo inference.
export function detectionSize(width,height){
  const scale=Math.min(1,4096/Math.max(width,height),Math.sqrt(12_000_000/(width*height)));
  return {width:Math.max(1,Math.round(width*scale)),height:Math.max(1,Math.round(height*scale))};
}
function positions(length,edge){
  const count=Math.ceil((length-edge)/(edge*.75))+1;
  return Array.from({length:count},(_,i)=>Math.round(i*(length-edge)/Math.max(1,count-1)));
}
export function detectionRegions(width,height,edges=[1152,512]){
  const regions=[{x:0,y:0,width,height}];
  for(const edge of edges){
    if(Math.max(width,height)<=edge)continue;
    const w=Math.min(width,edge),h=Math.min(height,edge);
    for(const y of positions(height,h))for(const x of positions(width,w))regions.push({x,y,width:w,height:h});
  }
  return regions;
}
