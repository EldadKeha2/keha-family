export function separatePerson(source,signal){
  if(signal?.aborted)return Promise.reject(new DOMException('Cancelled','AbortError'));
  return new Promise((resolve,reject)=>{
    let worker,settled=false;const finish=(error,result)=>{if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);worker?.terminate();error?reject(error):resolve(result);},abort=()=>finish(new DOMException('Cancelled','AbortError')),timer=setTimeout(()=>finish(Error('Person separation timed out')),40000);
    signal?.addEventListener('abort',abort,{once:true});
    (async()=>{try{
      worker=new Worker(new URL('./photo-fun-worker.mjs?v=1',import.meta.url),{type:'module'});worker.onerror=()=>finish(Error('Person separation unavailable'));worker.onmessage=event=>{const mask=event.data.mask;if(event.data.error||!mask||mask.width<1||mask.height<1||mask.width>2048||mask.height>2048||mask.data?.length!==mask.width*mask.height)finish(Error('Invalid person mask'));else finish(null,mask);};
      const width=source.naturalWidth||source.width,height=source.naturalHeight||source.height,scale=Math.min(1,1024/Math.max(width,height)),bitmap=await createImageBitmap(source,{resizeWidth:Math.max(1,Math.round(width*scale)),resizeHeight:Math.max(1,Math.round(height*scale)),resizeQuality:'high'});
      if(settled){bitmap.close();return;}worker.postMessage({id:1,bitmap},[bitmap]);
    }catch(error){finish(error);}})();
  });
}
