import {HttpError} from './http.mjs';

export const LIVING_SOURCE_MAX_BYTES=32*1024*1024;
export function livingSourceInfo(bytes){
  const bad=()=>{throw new HttpError(415,'בחרו תמונת PNG תקינה.','LIVING_SOURCE_FORMAT');};
  if(bytes.byteLength<57||bytes.byteLength>LIVING_SOURCE_MAX_BYTES||![137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n))bad();
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let offset=8,width=0,height=0,data=false,end=false;
  while(offset+12<=bytes.byteLength){
    const size=view.getUint32(offset),type=String.fromCharCode(...bytes.subarray(offset+4,offset+8));
    if(size>bytes.byteLength-offset-12)bad();
    if(offset===8){if(type!=='IHDR'||size!==13)bad();width=view.getUint32(offset+8);height=view.getUint32(offset+12);}
    if(type==='IDAT')data=true;
    offset+=size+12;
    if(type==='IEND'){if(size!==0||offset!==bytes.byteLength)bad();end=true;break;}
  }
  if(!data||!end||!width||!height||width*height>32_000_000)bad();
  return {size:bytes.byteLength,mime:'image/png',width,height};
}
