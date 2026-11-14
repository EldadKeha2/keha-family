// Lossless ISO-BMFF clips: keep the decode keyframe, hide preroll with an edit
// list, rebuild the sample tables, and stream one bounded source byte range.
import {HttpError} from './http.mjs';
const encoder=new TextEncoder(),decoder=new TextDecoder();
const MAX_METADATA=12*1024*1024,MAX_SAMPLES=1000000;
const error=()=>new HttpError(415,'עריכת קטעים זמינה לסרטוני MP4 ו־MOV רגילים. העלו גרסת MP4 אם הסרטון אינו נתמך.','VIDEO_CLIP_FORMAT');
const join=parts=>{const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let offset=0;for(const p of parts){out.set(p,offset);offset+=p.length;}return out;};
const uints=numbers=>{const bytes=new Uint8Array(numbers.length*4),v=new DataView(bytes.buffer);numbers.forEach((n,i)=>v.setUint32(i*4,n));return bytes;};
const u32=(...numbers)=>uints(numbers);
const view=bytes=>new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
const uint64=(v,offset)=>{const n=Number(v.getBigUint64(offset));if(!Number.isSafeInteger(n))throw error();return n;};
const int64=(v,offset)=>{const n=Number(v.getBigInt64(offset));if(!Number.isSafeInteger(n))throw error();return n;};
export function mp4Box(type,...parts){const data=join(parts);return join([u32(data.length+8),encoder.encode(type),data]);}
function boxes(bytes){
 const list=[];let offset=0;
 while(offset<bytes.length){if(bytes.length-offset<8)throw error();const v=view(bytes),small=v.getUint32(offset),header=small===1?16:8;if(bytes.length-offset<header)throw error();const size=small===1?uint64(v,offset+8):small||bytes.length-offset;
  if(size<header||offset+size>bytes.length)throw error();const raw=bytes.subarray(offset,offset+size);list.push({type:decoder.decode(raw.subarray(4,8)),data:raw.subarray(header),raw});offset+=size;
 }return list;
}
const child=(list,type)=>{const item=list.find(b=>b.type===type);if(!item)throw error();return item;};
function full(type,parts,version=0){return mp4Box(type,Uint8Array.of(version,0,0,0),...parts);}
function headerInfo(box){const v=view(box.data),version=box.data[0];if(version>1)throw error();const ts=version?20:12,dur=version?24:16;return {timescale:v.getUint32(ts),duration:version?uint64(v,dur):v.getUint32(dur)};}
function setDuration(box,value,track=false){const data=box.data.slice(),v=view(data),version=data[0],offset=track?(version?28:20):(version?24:16);if(version)v.setBigUint64(offset,BigInt(Math.round(value)));else{if(value>0xffffffff)throw error();v.setUint32(offset,Math.round(value));}return mp4Box(box.type,data);}
function runs(box,count,signed=false){const values=new Float64Array(count),v=view(box.data),n=v.getUint32(4);if(box.data.length!==8+n*8)throw error();let offset=0;for(let i=0;i<n;i++){const length=v.getUint32(8+i*8),value=signed?v.getInt32(12+i*8):v.getUint32(12+i*8);if(offset+length>count)throw error();values.fill(value,offset,offset+length);offset+=length;}if(offset!==count)throw error();return values;}
function runBox(type,values,version=0){const entries=[];for(const value of values){const last=entries.at(-1);if(last&&last[1]===value)last[0]++;else entries.push([1,value]);}return full(type,[u32(entries.length),uints(entries.flat())],version);}
function parseTrack(trak,movieTimescale){
 const children=boxes(trak.data),mdia=child(children,'mdia'),mdias=boxes(mdia.data),mdhd=child(mdias,'mdhd'),hdlr=child(mdias,'hdlr'),kind=decoder.decode(hdlr.data.subarray(8,12));if(!['vide','soun'].includes(kind))return null;
 const minf=child(mdias,'minf'),minfs=boxes(minf.data),stbl=child(minfs,'stbl'),tables=boxes(stbl.data),stsz=child(tables,'stsz'),sv=view(stsz.data),count=sv.getUint32(8),fixed=sv.getUint32(4);
 if(!count||count>MAX_SAMPLES||(!fixed&&stsz.data.length!==12+4*count)||tables.some(t=>['senc','saiz','saio'].includes(t.type)))throw error();
 const sizes=new Uint32Array(count);for(let i=0;i<count;i++)sizes[i]=fixed||sv.getUint32(12+4*i);
 const durations=runs(child(tables,'stts'),count),ctts=tables.find(b=>b.type==='ctts'),compositions=ctts?runs(ctts,count,ctts.data[0]===1):new Float64Array(count),dts=new Float64Array(count);let time=0;for(let i=0;i<count;i++){dts[i]=time;time+=durations[i];}
 const stsc=child(tables,'stsc'),scv=view(stsc.data),scCount=scv.getUint32(4),sc=[];if(stsc.data.length!==8+12*scCount||!scCount)throw error();for(let i=0;i<scCount;i++)sc.push({first:scv.getUint32(8+12*i),count:scv.getUint32(12+12*i),description:scv.getUint32(16+12*i)});
 if(sc[0].first!==1||sc.some((s,i)=>!s.count||s.description!==sc[0].description||(i&&s.first<=sc[i-1].first)))throw error();
 const co=tables.find(b=>['stco','co64'].includes(b.type));if(!co)throw error();const cov=view(co.data),chunkCount=cov.getUint32(4),width=co.type==='co64'?8:4;if(co.data.length!==8+width*chunkCount)throw error();
 const offsets=new Float64Array(count);let sample=0,entry=0;for(let i=0;i<chunkCount;i++){while(entry+1<sc.length&&sc[entry+1].first<=i+1)entry++;let offset=width===8?uint64(cov,8+8*i):cov.getUint32(8+4*i);for(let j=0;j<sc[entry].count;j++){if(sample>=count)throw error();offsets[sample]=offset;offset+=sizes[sample++];}}if(sample!==count)throw error();
 const stss=tables.find(b=>b.type==='stss');let sync=null;if(stss){const ssv=view(stss.data),n=ssv.getUint32(4);if(stss.data.length!==8+4*n)throw error();sync=new Set(Array.from({length:n},(_,i)=>ssv.getUint32(8+4*i)-1));}
 let mediaStart=0,movieOffset=0;const edts=children.find(b=>b.type==='edts');if(edts){const elst=boxes(edts.data).find(b=>b.type==='elst');if(elst){const ev=view(elst.data),version=elst.data[0],n=ev.getUint32(4),width=version?20:12;if(version>1||elst.data.length!==8+n*width)throw error();let edits=0;for(let i=0;i<n;i++){const offset=8+i*width,duration=version?uint64(ev,offset):ev.getUint32(offset),media=version?int64(ev,offset+8):ev.getInt32(offset+4),rate=ev.getInt32(offset+(version?16:8));if(rate!==65536)throw error();if(media===-1&&!edits)movieOffset+=duration/movieTimescale;else if(media>=0&&edits++===0)mediaStart=media;else throw error();}}}
 return {trak,children,mdia,mdias,mdhd,minf,minfs,tables,kind,count,sizes,durations,compositions,dts,offsets,sync,ctts,description:sc[0].description,mediaStart,movieOffset,...headerInfo(mdhd)};
}
function rebuildTrack(track,selection,movieDuration,baseOffset,rangeStart){
 const {first,last,t0}=selection,count=last-first+1,indices=Array.from({length:count},(_,i)=>first+i),durations=track.durations.subarray(first,last+1),decodeDuration=durations.reduce((n,d)=>n+d,0),mediaTime=Math.max(0,Math.round(t0-track.dts[first]));
 const elst=new Uint8Array(28),ev=view(elst);ev.setUint32(4,1);ev.setBigUint64(8,BigInt(movieDuration));ev.setBigInt64(16,BigInt(mediaTime));ev.setInt32(24,65536);elst[0]=1;
 const offsets=indices.map(i=>baseOffset+track.offsets[i]-rangeStart);if(offsets.some(n=>n<0||n>0xffffffff))throw error();
 const tableBoxes=[child(track.tables,'stsd').raw,runBox('stts',durations)];
 if(track.ctts)tableBoxes.push(runBox('ctts',track.compositions.subarray(first,last+1),track.ctts.data[0]));
 if(track.sync)tableBoxes.push(full('stss',[u32(indices.filter(i=>track.sync.has(i)).length),uints(indices.filter(i=>track.sync.has(i)).map(i=>i-first+1))]));
 tableBoxes.push(full('stsc',[u32(1,1,1,track.description)]),full('stsz',[u32(0,count),uints(track.sizes.subarray(first,last+1))]),full('stco',[u32(count),uints(offsets)]));
 const dependency=track.tables.find(b=>b.type==='sdtp');if(dependency&&dependency.data.length===4+track.count)tableBoxes.push(full('sdtp',[dependency.data.subarray(4+first,5+last)]));
 const stbl=mp4Box('stbl',...tableBoxes),minf=mp4Box('minf',...track.minfs.map(b=>b.type==='stbl'?stbl:b.raw)),mdia=mp4Box('mdia',...track.mdias.map(b=>b.type==='minf'?minf:b.type==='mdhd'?setDuration(b,decodeDuration):b.raw));
 const output=track.children.filter(b=>b.type!=='edts').map(b=>b.type==='mdia'?mdia:b.type==='tkhd'?setDuration(b,movieDuration,true):b.raw);output.splice(1,0,mp4Box('edts',elst.length?mp4Box('elst',elst):new Uint8Array()));return mp4Box('trak',...output);
}
export async function planMp4Clip(readRange,size,{start,end}){
 if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end-start<.1)throw new HttpError(400,'סמנו התחלה וסיום תקינים לקטע, באורך עשירית שנייה לפחות.');
 let position=0,moov=null,ftyp=null;for(let i=0;i<64&&position<size;i++){
  const head=await readRange(position,Math.min(position+15,size-1));if(head.length<8)throw error();const v=view(head),small=v.getUint32(0),length=small===1?uint64(v,8):small||size-position,type=decoder.decode(head.subarray(4,8));if(length<8||position+length>size)throw error();
  if(type==='moov'||type==='ftyp'){if(length>MAX_METADATA)throw error();const raw=await readRange(position,position+length-1);if(raw.length!==length)throw error();if(type==='moov')moov=boxes(raw)[0];else ftyp=raw;}
  if(type==='moof')throw error();position+=length;if(moov&&ftyp)break;
 }
 if(!moov)throw error();const movie=boxes(moov.data);if(movie.some(b=>b.type==='mvex'))throw error();const mvhd=child(movie,'mvhd'),info=headerInfo(mvhd),duration=info.duration/info.timescale;
 if(!info.timescale||!Number.isFinite(duration)||end>duration+.05||start>=duration)throw new HttpError(400,'הקטע המסומן חורג ממשך הסרטון.');end=Math.min(end,duration);
 const tracks=movie.filter(b=>b.type==='trak').map(t=>parseTrack(t,info.timescale)).filter(Boolean);if(!tracks.some(t=>t.kind==='vide'))throw error();
 const selections=tracks.map(track=>{const t0=(start-track.movieOffset)*track.timescale+track.mediaStart,t1=(end-track.movieOffset)*track.timescale+track.mediaStart;let first=0,last=-1;
  if(t0<0)throw error();if(track.kind==='vide'){for(let i=0;i<track.count;i++)if((!track.sync||track.sync.has(i))&&track.dts[i]+track.compositions[i]<=t0)first=i;if(track.sync&&!track.sync.has(first))throw error();}
  else{first=track.count;for(let i=0;i<track.count;i++)if(track.dts[i]+track.compositions[i]+track.durations[i]>t0){first=i;break;}}
  for(let i=first;i<track.count;i++)if(track.dts[i]+track.compositions[i]<t1)last=i;
  if(last<first)throw error();return {first,last,t0};
 });
 let rangeStart=Infinity,rangeEnd=0;for(let t=0;t<tracks.length;t++)for(let i=selections[t].first;i<=selections[t].last;i++){rangeStart=Math.min(rangeStart,tracks[t].offsets[i]);rangeEnd=Math.max(rangeEnd,tracks[t].offsets[i]+tracks[t].sizes[i]-1);}
 if(!Number.isSafeInteger(rangeStart)||rangeStart<0||rangeEnd>=size)throw error();const payloadSize=rangeEnd-rangeStart+1,movieDuration=Math.round((end-start)*info.timescale);
 ftyp ||= mp4Box('ftyp',encoder.encode('isom'),u32(512),encoder.encode('isomiso2mp41'));
 const makeMoov=base=>mp4Box('moov',setDuration(mvhd,movieDuration),...tracks.map((track,i)=>rebuildTrack(track,selections[i],movieDuration,base,rangeStart)));
 const placeholder=makeMoov(0),base=ftyp.length+placeholder.length+8,prefix=join([ftyp,makeMoov(base),u32(payloadSize+8),encoder.encode('mdat')]);
 return {prefix,rangeStart,rangeEnd,size:prefix.length+payloadSize,duration:end-start,sourceDuration:duration,start,end};
}
