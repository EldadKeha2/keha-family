import {HttpError} from './http.mjs';
import {planMp4Clip} from './mp4-clip.mjs';

export const LIVING_VIDEO_MAX_BYTES=25*1024*1024;
const decode=new TextDecoder();
const bad=()=>new HttpError(415,'בחרו סרטון MP4 קצר בקידוד H.264.','LIVING_FORMAT');
function boxes(bytes,start=0,end=bytes.byteLength){
  const result=[],view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let offset=start;
  while(offset<end){
    if(result.length>=4096||end-offset<8)throw bad();
    const short=view.getUint32(offset),header=short===1?16:8;if(end-offset<header)throw bad();
    const size=short===1?Number(view.getBigUint64(offset+8)):short||end-offset;
    if(!Number.isSafeInteger(size)||size<header||offset+size>end)throw bad();
    result.push({type:decode.decode(bytes.subarray(offset+4,offset+8)),data:offset+header,end:offset+size});offset+=size;
  }
  return result;
}
function inside(bytes,box){if(!box)throw bad();return boxes(bytes,box.data,box.end);}
export async function livingVideoInfo(bytes){
  if(!(bytes instanceof Uint8Array)||bytes.byteLength<32||bytes.byteLength>LIVING_VIDEO_MAX_BYTES)throw bad();
  const top=boxes(bytes),moov=top.find(box=>box.type==='moov');
  if(!top.some(box=>box.type==='ftyp')||!top.some(box=>box.type==='mdat')||!moov||top.some(box=>box.type==='moof'))throw bad();
  let tracks=0;
  for(const track of inside(bytes,moov).filter(box=>box.type==='trak')){
    const media=inside(bytes,inside(bytes,track).find(box=>box.type==='mdia')),handler=media.find(box=>box.type==='hdlr');
    if(!handler||handler.end-handler.data<12)throw bad();
    if(decode.decode(bytes.subarray(handler.data+8,handler.data+12))!=='vide')continue;
    const descriptions=inside(bytes,inside(bytes,media.find(box=>box.type==='minf')).find(box=>box.type==='stbl')).find(box=>box.type==='stsd');
    if(!descriptions||descriptions.end-descriptions.data<8)throw bad();
    const entries=boxes(bytes,descriptions.data+8,descriptions.end);
    if(!entries.length||entries.some(box=>!['avc1','avc3'].includes(box.type)))throw bad();tracks++;
  }
  if(!tracks)throw bad();
  let plan;try{plan=await planMp4Clip(async(start,end)=>bytes.subarray(start,end+1),bytes.byteLength,{start:0,end:1});}catch{throw bad();}
  const duration=plan.sourceDuration;
  if(!Number.isFinite(duration)||duration<.5||duration>15.15)throw new HttpError(400,'בחרו הנפשה באורך עד 15 שניות.','LIVING_DURATION');
  return {duration,codec:'h264',mime:'video/mp4',size:bytes.byteLength};
}
