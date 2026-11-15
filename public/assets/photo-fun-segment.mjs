function segmentWithWorker(source,signal,cpu=false){
  if(signal?.aborted)return Promise.reject(new DOMException('Cancelled','AbortError'));
  return new Promise((resolve,reject)=>{
    let worker,settled=false;const finish=(error,result)=>{if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);worker?.terminate();error?reject(error):resolve(result);},abort=()=>finish(new DOMException('Cancelled','AbortError')),timer=setTimeout(()=>finish(Error('Person separation timed out')),cpu?60000:40000);
    signal?.addEventListener('abort',abort,{once:true});
    (async()=>{try{
      worker=new Worker(new URL(cpu?'./photo-cutout-cpu-worker.mjs?v=1':'./photo-fun-worker.mjs?v=2',import.meta.url),{type:'module'});worker.onerror=event=>finish(Error('Person separation worker unavailable: '+(event.message||'')));worker.onmessage=event=>{const mask=event.data.mask;if(event.data.error)finish(Error(event.data.error));else if(!mask||mask.width<1||mask.height<1||mask.width>2048||mask.height>2048||mask.data?.length!==mask.width*mask.height)finish(Error('Invalid person mask'));else finish(null,mask);};
      if(cpu){const canvas=document.createElement('canvas');canvas.width=canvas.height=320;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(source,0,0,320,320);const pixels=ctx.getImageData(0,0,320,320).data;canvas.width=canvas.height=1;if(!settled)worker.postMessage({id:1,pixels,width:320,height:320},[pixels.buffer]);return;}
      const width=source.naturalWidth||source.width,height=source.naturalHeight||source.height,scale=Math.min(1,1024/Math.max(width,height)),bitmap=await createImageBitmap(source,{resizeWidth:Math.max(1,Math.round(width*scale)),resizeHeight:Math.max(1,Math.round(height*scale)),resizeQuality:'high'});
      if(settled){bitmap.close();return;}worker.postMessage({id:1,bitmap},[bitmap]);
    }catch(error){finish(error);}})();
  });
}
export function separatePerson(source,signal){return segmentWithWorker(source,signal).catch(error=>{if(error.name==='AbortError'||signal?.aborted)throw error;return segmentWithWorker(source,signal,true);});}
