export const PHOTO_DROP_LIMIT=50*1024*1024;

export function draggedFileCount(transfer){
  const items=Array.from(transfer?.items||[]).filter(item=>item.kind==='file');
  return items.length||Number(transfer?.files?.length)||0;
}
const aborted=signal=>{if(signal?.aborted)throw new DOMException('Cancelled','AbortError');};
function fileError(code,file){const error=new Error(code);error.code=code;error.filename=file.name;return error;}

// Read one stream at a time, keeping original Files and their pixels untouched.
export async function readDroppedPhotos(input,{signal,onProgress=()=>{}}={}){
  const files=Array.from(input),total=files.reduce((sum,file)=>sum+file.size,0);let loaded=0;
  for(const file of files){
    if(file.size>PHOTO_DROP_LIMIT)throw fileError('PHOTO_TOO_LARGE',file);
    if(!Number.isSafeInteger(file.size)||file.size<=0)throw fileError('PHOTO_UNREADABLE',file);
  }
  aborted(signal);
  const report=(index,complete=false)=>onProgress({loaded,total,count:files.length,current:Math.min(index+1,files.length),filename:files[index]?.name||'',percent:complete?100:Math.min(99,total?Math.floor(loaded/total*100):0)});
  report(0);
  for(const [index,file]of files.entries()){
    aborted(signal);report(index);let size=0;
    try{
      if(file.stream){
        const reader=file.stream().getReader();let done=false;
        const cancel=()=>{reader.cancel().catch(()=>{});};signal?.addEventListener('abort',cancel,{once:true});
        try{
          while(true){
            aborted(signal);const part=await reader.read();aborted(signal);
            if(part.done){done=true;break;}
            size+=part.value.byteLength;loaded+=part.value.byteLength;
            if(size>file.size)throw fileError('PHOTO_UNREADABLE',file);report(index);
          }
        }finally{signal?.removeEventListener('abort',cancel);if(!done)await reader.cancel().catch(()=>{});reader.releaseLock();}
      }else{
        const bytes=await file.arrayBuffer();aborted(signal);size=bytes.byteLength;loaded+=size;report(index);
      }
      if(size!==file.size)throw fileError('PHOTO_UNREADABLE',file);
    }catch(error){if(error.name==='AbortError')throw error;throw fileError('PHOTO_UNREADABLE',file);}
  }
  aborted(signal);report(files.length-1,true);return files;
}
