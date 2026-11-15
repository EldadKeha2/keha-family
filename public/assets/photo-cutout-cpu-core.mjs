// U²-Net portable normalization, matching rembg's published U2netpSession.
export function cutoutInput(rgba,width=320,height=320){
  const area=width*height;if(rgba.length!==area*4)throw Error('Invalid cutout input');
  let maximum=1;for(let i=0;i<rgba.length;i+=4)maximum=Math.max(maximum,rgba[i],rgba[i+1],rgba[i+2]);
  const input=new Float32Array(area*3),means=[.485,.456,.406],std=[.229,.224,.225];
  for(let i=0;i<area;i++)for(let channel=0;channel<3;channel++)input[channel*area+i]=(rgba[i*4+channel]/maximum-means[channel])/std[channel];
  return input;
}
export function cutoutOutput(values,width=320,height=320){
  if(values.length!==width*height)throw Error('Invalid cutout output');let min=Infinity,max=-Infinity;
  for(const value of values){if(!Number.isFinite(value))throw Error('Invalid mask confidence');min=Math.min(min,value);max=Math.max(max,value);}
  const data=new Uint8Array(values.length),span=max-min;
  for(let i=0;i<values.length;i++)data[i]=span<1e-9?(max>.5?255:0):Math.round(Math.max(0,Math.min(1,(values[i]-min)/span))*255);
  return {width,height,data};
}
