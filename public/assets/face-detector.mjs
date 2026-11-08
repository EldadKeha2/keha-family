import {detectionSize} from './face-scan.mjs?v=2';
const cache=new Map();let worker=null,active=null,queued=null,nextId=0;
function finish(error,faces){
  const job=active;if(!job)return;clearTimeout(job.timer);job.signal?.removeEventListener('abort',job.cancel);active=null;
  if(error)job.reject(error);else{if(faces.complete!==false){cache.set(job.key,faces);if(cache.size>32)cache.delete(cache.keys().next().value);}job.resolve(faces);}
  run();
}
async function run(){
  if(active||!queued)return;const job=queued;queued=null;
  if(job.signal?.aborted){job.reject(new DOMException('Cancelled','AbortError'));return run();}
  active=job;
  try{
    if(!worker){worker=new Worker(new URL('./face-detection-worker.mjs?v=10',import.meta.url),{type:'module'});worker.onmessage=event=>{if(event.data.id!==active?.id)return;const {faces,engine,partial,galleryFaces}=event.data;if(faces){faces.engine=engine||'mediapipe';faces.complete=!partial;faces.galleryFaces=galleryFaces;if(partial){active.partial=faces;active.onProgress?.(faces);return;}}finish(event.data.error?Error(event.data.error):null,faces);};worker.onerror=()=>{worker?.terminate();worker=null;finish(active?.partial?.length?null:Error('Face detection is unavailable'),active?.partial);};}
    const size=detectionSize(job.image.naturalWidth,job.image.naturalHeight),bitmap=await createImageBitmap(job.image,{resizeWidth:size.width,resizeHeight:size.height,resizeQuality:'high'});
    if(active!==job){bitmap.close();return;}
    if(job.signal?.aborted){bitmap.close();return finish(new DOMException('Cancelled','AbortError'));}
    job.timer=setTimeout(()=>{worker?.terminate();worker=null;finish(job.partial?.length?null:Error('Face detection timed out'),job.partial);},90000);
    worker.postMessage({id:job.id,bitmap},[bitmap]);
  }catch(error){if(active===job)finish(error);}
}
export function detectFaces(key,image,signal,onProgress){
  if(signal?.aborted)return Promise.reject(new DOMException('Cancelled','AbortError'));
  if(cache.has(key))return Promise.resolve(cache.get(key));
  return new Promise((resolve,reject)=>{
    if(queued){queued.signal?.removeEventListener('abort',queued.cancel);queued.reject(new DOMException('Cancelled','AbortError'));}
    const job={id:++nextId,key,image,signal,resolve,reject,onProgress};
    job.cancel=()=>{if(queued===job){queued=null;signal.removeEventListener('abort',job.cancel);reject(new DOMException('Cancelled','AbortError'));}else if(active===job){worker?.terminate();worker=null;finish(new DOMException('Cancelled','AbortError'));}};
    signal?.addEventListener('abort',job.cancel,{once:true});queued=job;run();
  });
}
