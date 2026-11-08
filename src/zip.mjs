// Stored ZIP64 entries stream original image bytes with bounded memory.
const encoder=new TextEncoder(),table=Uint32Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
export function crc32(bytes,crc=0){crc^=0xffffffff;for(const byte of bytes)crc=table[(crc^byte)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
function record(size,write){const bytes=new Uint8Array(size);write(new DataView(bytes.buffer));return bytes;}
function filename(name,index){return String(index+1).padStart(4,'0')+'-'+String(name||'photo.jpg').normalize('NFC').replace(/[\x00-\x1f\x7f<>:"/\\|?*]/g,'_').replace(/[. ]+$/,'').slice(0,160);}
async function* archive(entries,signal){
  let offset=0n;const directory=[];
  for(const [index,entry]of entries.entries()){
    signal.throwIfAborted();const name=encoder.encode(filename(entry.name,index)),start=offset;
    const local=record(50+name.length,v=>{v.setUint32(0,0x04034b50,true);v.setUint16(4,45,true);v.setUint16(6,0x808,true);v.setUint16(12,33,true);v.setUint32(18,0xffffffff,true);v.setUint32(22,0xffffffff,true);v.setUint16(26,name.length,true);v.setUint16(28,20,true);new Uint8Array(v.buffer).set(name,30);v.setUint16(30+name.length,1,true);v.setUint16(32+name.length,16,true);});
    // Open before yielding the header so an unavailable photo fails the download.
    const response=await entry.open(signal);if(!response.ok||!response.body)throw Error('Photo unavailable');
    let crc=0,size=0n;const reader=response.body.getReader();
    try{yield local;offset+=BigInt(local.length);while(true){signal.throwIfAborted();const {done,value}=await reader.read();if(done)break;crc=crc32(value,crc);size+=BigInt(value.length);offset+=BigInt(value.length);yield value;}}
    finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
    const descriptor=record(24,v=>{v.setUint32(0,0x08074b50,true);v.setUint32(4,crc,true);v.setBigUint64(8,size,true);v.setBigUint64(16,size,true);});yield descriptor;offset+=24n;
    directory.push(record(74+name.length,v=>{v.setUint32(0,0x02014b50,true);v.setUint16(4,45,true);v.setUint16(6,45,true);v.setUint16(8,0x808,true);v.setUint16(14,33,true);v.setUint32(16,crc,true);v.setUint32(20,0xffffffff,true);v.setUint32(24,0xffffffff,true);v.setUint16(28,name.length,true);v.setUint16(30,28,true);v.setUint32(42,0xffffffff,true);new Uint8Array(v.buffer).set(name,46);const p=46+name.length;v.setUint16(p,1,true);v.setUint16(p+2,24,true);v.setBigUint64(p+4,size,true);v.setBigUint64(p+12,size,true);v.setBigUint64(p+20,start,true);}));
  }
  const central=offset;for(const entry of directory){yield entry;offset+=BigInt(entry.length);}
  const end=offset,count=BigInt(directory.length);
  yield record(56,v=>{v.setUint32(0,0x06064b50,true);v.setBigUint64(4,44n,true);v.setUint16(12,45,true);v.setUint16(14,45,true);v.setBigUint64(24,count,true);v.setBigUint64(32,count,true);v.setBigUint64(40,offset-central,true);v.setBigUint64(48,central,true);});
  yield record(20,v=>{v.setUint32(0,0x07064b50,true);v.setBigUint64(8,end,true);v.setUint32(16,1,true);});
  yield record(22,v=>{v.setUint32(0,0x06054b50,true);v.setUint16(8,Math.min(directory.length,65535),true);v.setUint16(10,Math.min(directory.length,65535),true);v.setUint32(12,0xffffffff,true);v.setUint32(16,0xffffffff,true);});
}
export function zipStream(entries){
  const controller=new AbortController(),iterator=archive(entries,controller.signal);
  return new ReadableStream({async pull(stream){try{const next=await iterator.next();if(next.done)stream.close();else stream.enqueue(next.value);}catch(error){controller.abort(error);stream.error(error);}},async cancel(reason){controller.abort(reason);await iterator.return();}},{highWaterMark:0});
}
