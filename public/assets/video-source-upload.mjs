import {MAX_VIDEO_SOURCE_BYTES} from './video-source-limits.mjs';

const pause = ms => new Promise(resolve=>setTimeout(resolve,ms));
export function createVideoSource(file,{scope,request,writeToken,tr,changed,delay=pause,baseURL=document.baseURI}) {
  const token = (crypto.randomUUID()+crypto.randomUUID()).replaceAll('-','');
  const controller = new AbortController(), confirmed = new Set();
  let running=null, initiated=false, sent=false, partSize=0, parts=0;
  const source={file,phase:'starting',received:0,error:'',url:null,ensure,save,discard};
  function update(phase) { source.phase=phase; changed(source); }
  async function post(action,data,part) {
    const binary=part!==undefined,headers={'X-Family-Token':writeToken,'X-Video-Source':token,
      'Content-Type':binary?'application/octet-stream':'application/json'};
    if(binary)headers['X-Upload-Part']=String(part);
    const response=await request('/api/video-sources/'+action,{method:'POST',headers,
      body:binary?data:JSON.stringify(data||{}),signal:action==='discard'?undefined:controller.signal,
      ...(action==='discard'?{keepalive:true}:{})});
    let value;try{value=await response.json();}catch{throw Object.assign(Error(tr('השרת לא אישר את הבקשה. אפשר לנסות שוב.','The server did not acknowledge the request. Please retry.')),{status:response.status});}
    if(!response.ok)throw Object.assign(Error(value.error||tr('ההעלאה נקטעה.','Upload interrupted.')),{status:response.status,code:value.code});
    return value;
  }
  async function retry(action) {
    for(let attempt=0;;attempt++){
      try{return await action();}catch(error){
        if(controller.signal.aborted||attempt>=2||!(error instanceof TypeError||error.status>=500||error.status===429||error.status===408||error.code==='VIDEO_INCOMPLETE'))throw error;
        await delay(500*2**attempt);
      }
    }
  }
  const partBytes = n => Math.min(partSize,file.size-(n-1)*partSize);
  function acknowledge(n) { if(!confirmed.has(n)){confirmed.add(n);source.received+=partBytes(n);} }
  async function upload() {
    if(file.size>MAX_VIDEO_SOURCE_BYTES)throw Error(tr('אפשר להעלות קובץ מקור עד 4 GiB.','Original recordings up to 4 GiB are supported.'));
    const resuming=initiated;
    if(!initiated){
      const bytes=new Uint8Array(await file.slice(0,128).arrayBuffer());
      if(controller.signal.aborted)throw controller.signal.reason;
      sent=true;
      const reply=await retry(()=>post('start',{scope,filename:file.name,size:file.size,head:btoa(String.fromCharCode(...bytes))}));
      partSize=reply.partSize;parts=reply.parts;
      if(!(partSize>0)||parts!==Math.ceil(file.size/partSize))throw Error(tr('השרת החזיר פרטי העלאה שגויים.','Invalid upload details from the server.'));
      initiated=true;
      if(reply.ready)return;
    }
    if(resuming && confirmed.size<parts){
      const state=await retry(()=>post('status'));
      if(state.ready)return;
      confirmed.clear();source.received=0;
      for(const n of state.completed)acknowledge(n);
    }
    update('uploading');
    let next=1, failure=null;
    async function sendParts() {
      while(next<=parts&&!controller.signal.aborted&&!failure){
        const n=next++;
        if(confirmed.has(n))continue;
        try{
          const blob=file.slice((n-1)*partSize,(n-1)*partSize+partBytes(n));
          const ack=await retry(()=>post('part',blob,n));
          if(ack.part!==n)throw Error(tr('השרת לא אישר את חלק הסרטון.','The video part was not acknowledged.'));
          acknowledge(n);changed(source);
        }catch(error){failure=error;}
      }
    }
    await Promise.all([sendParts(),sendParts()]);
    if(failure)throw failure;
    if(controller.signal.aborted)throw controller.signal.reason;
    update('assembling');const reply=await retry(()=>post('complete'));
    if(!reply.ready)throw Error(tr('ממתין לאישור איחוד הסרטון. נסו שוב.','The joined video has not been confirmed. Please retry.'));
  }
  function ensure() {
    if(source.phase==='ready')return Promise.resolve(source);
    if(controller.signal.aborted)return Promise.reject(controller.signal.reason);
    if(!running){
      source.error='';update('starting');
      running=upload().then(()=>{
        if(controller.signal.aborted)throw controller.signal.reason;
        source.received=file.size;source.url=new URL('/api/video-sources/'+token+'/play',baseURL).href;
        update('ready');return source;
      }).catch(error=>{
        if(!controller.signal.aborted){source.error=error.message;update('failed');}
        throw error;
      }).finally(()=>{running=null;});
    }
    return running;
  }
  async function save(data){await ensure();return retry(()=>post('save',data));}
  function discard(){
    if(controller.signal.aborted)return;
    controller.abort();
    if(sent)return post('discard').catch(()=>{});
  }
  return source;
}
