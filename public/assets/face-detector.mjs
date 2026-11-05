const cache=new Map();let worker=null,active=null,queued=null,nextId=0;
function finish(error,faces){
  const job=active;if(!job)return;clearTimeout(job.timer);active=null;
  if(error)job.reject(error);else{cache.set(job.key,faces);if(cache.size>32)cache.delete(cache.keys().next().value);job.resolve(faces);}
  run();
}
async function run(){
  if(active||!queued)return;const job=queued;queued=null;
  if(job.signal?.aborted){job.reject(new DOMException('Cancelled','AbortError'));return run();}
  active=job;
  try{
    if(!worker){worker=new Worker(new URL('./face-detection-worker.mjs?v=2',import.meta.url),{type:'module'});worker.onmessage=event=>{if(event.data.id!==active?.id)return;if(event.data.faces)event.data.faces.engine=event.data.engine||'mediapipe';finish(event.data.error?Error(event.data.error):null,event.data.faces);};worker.onerror=()=>{worker?.terminate();worker=null;finish(Error('Face detection is unavailable'));};}
    const scale=Math.min(1,1920/Math.max(job.image.naturalWidth,job.image.naturalHeight)),bitmap=await createImageBitmap(job.image,{resizeWidth:Math.max(1,Math.round(job.image.naturalWidth*scale)),resizeHeight:Math.max(1,Math.round(job.image.naturalHeight*scale))});
    if(job.signal?.aborted){bitmap.close();return finish(new DOMException('Cancelled','AbortError'));}
    job.timer=setTimeout(()=>{worker?.terminate();worker=null;finish(Error('Face detection timed out'));},25000);
    worker.postMessage({id:job.id,bitmap},[bitmap]);
  }catch(error){finish(error);}
}
export function detectFaces(key,image,signal){
  if(cache.has(key))return Promise.resolve(cache.get(key));
  return new Promise((resolve,reject)=>{if(queued)queued.reject(new DOMException('Cancelled','AbortError'));queued={id:++nextId,key,image,signal,resolve,reject};run();});
}
