import {HttpError,json,readJSON,uid,fail} from './http.mjs';
import {getObject,putObject,deleteObject} from './hf.mjs';
import {planMp4Clip} from './mp4-clip.mjs';

function plannedStream(plan,ranged,sourceSize,onProgress){
 let first=true,index=0,reader=null,total=0,expected=0,processed=0;
 const report=bytes=>{processed+=bytes;onProgress?.(5+Math.floor(89*processed/plan.size),'processing');};
 return new ReadableStream({async pull(controller){try{
  if(first){first=false;controller.enqueue(plan.prefix);report(plan.prefix.byteLength);return;}
  while(true){
   if(!reader){if(index===plan.ranges.length){controller.close();return;}const range=plan.ranges[index++],response=await ranged(range.start,range.end);expected=range.end-range.start+1;total=0;
    if(response.status!==206||response.headers.get('Content-Range')!==`bytes ${range.start}-${range.end}/${sourceSize}`||Number(response.headers.get('Content-Length'))!==expected){await response.body?.cancel();throw new HttpError(502,'הקטע המסומן לא התקבל במלואו. נסו שוב.');}reader=response.body.getReader();}
   const next=await reader.read();if(next.done){reader.releaseLock();reader=null;if(total!==expected)throw Error('Incomplete source range');continue;}
   total+=next.value.byteLength;if(total>expected)throw Error('Oversized source range');controller.enqueue(next.value);report(next.value.byteLength);return;
  }
 }catch(error){await reader?.cancel().catch(()=>{});controller.error(error);}},async cancel(reason){await reader?.cancel(reason);}});
}
export async function renderVideoRange(request,env,ctx,source,range,ownerId,onProgress){
 let plan,key;
  if(!['video/mp4','video/quicktime'].includes(source.mime))throw new HttpError(415,'לעריכת קטעים העלו סרטון בפורמט MP4 או MOV.','VIDEO_CLIP_FORMAT');
  const ranged=(start,end)=>getObject(env,source,new Request(request.url,{headers:{Range:`bytes=${start}-${end}`}}));
  const read=async(start,end)=>{const response=await ranged(start,end);if(response.status!==206||response.headers.get('Content-Range')!==`bytes ${start}-${end}/${source.size}`){await response.body?.cancel();throw new HttpError(502,'לא ניתן לקרוא את הקטע המסומן כרגע. נסו שוב.');}const bytes=new Uint8Array(await response.arrayBuffer());if(bytes.length!==end-start+1)throw new HttpError(502,'נתוני הסרטון לא התקבלו במלואם.');return bytes;};
  plan=await planMp4Clip(read,source.size,range);
  onProgress?.(5,'processing');
  key='video-clips/'+ownerId+'/'+uid()+'.mp4';let stream=plannedStream(plan,ranged,source.size,onProgress),transfer=Promise.resolve();
  if(typeof FixedLengthStream!=='undefined'){const fixed=new FixedLengthStream(plan.size);transfer=stream.pipeTo(fixed.writable);stream=fixed.readable;transfer.catch(()=>{});}
  try{await Promise.all([putObject(env,key,stream,plan.size,'video/mp4'),transfer]);}catch(error){ctx.waitUntil(deleteObject(env,key).catch(()=>{}));throw error;}
 return {key,size:plan.size,mime:'video/mp4',duration:plan.duration};
}
export async function videoClipRoute(request,env,db,ctx,id){
 const body=await readJSON(request,100000),prepared=await db('video.clip.prepare',{...body,id});
 if(prepared.existing)return json(prepared.existing,200);
 const source=prepared.source;let plan=null,key=null;
 if(source.provider!=='youtube'){
  const rendered=await renderVideoRange(request,env,ctx,source,{start:prepared.start,end:prepared.end},prepared.clipId);key=rendered.key;plan=rendered;
 }
 try{
  const result=await db('video.clip.save',{id,...prepared,sourceKey:source.key||null,item:key?{key,size:plan.size,mime:'video/mp4',duration:plan.duration}:{duration:prepared.end-prepared.start}});
  if(key&&result.item?.id===prepared.clipId&&result.storedKey!==key)ctx.waitUntil(deleteObject(env,key).catch(()=>{}));
  const {storedKey,...publicResult}=result;return json(publicResult,result.alreadySaved?200:201);
 }catch(error){if(key&&error.status>=400&&error.status<500)ctx.waitUntil(deleteObject(env,key).catch(()=>{}));throw error;}
}

export async function videoEditRoute(request,env,db,ctx,id,{removeOnly=false}={}){
 const body=await readJSON(request,100000);
 if(removeOnly&&body.range?.remove!==true)throw new HttpError(400,'סמנו את הקטע שברצונכם למחוק.');
 const prepared=await db('video.edit.prepare',{...body,id});
 if(prepared.existing)return json(prepared.existing);
 const edit=async onProgress=>{
  const source=prepared.source;let rendered=null;
  if(prepared.range&&source.provider!=='youtube')rendered=await renderVideoRange(request,env,ctx,source,prepared.range,id,onProgress);
  try{
   onProgress?.(97,'saving');
   const result=await db('video.edit.save',{id,...prepared,sourceKey:source.key||null,rendered});
   if(rendered&&result.storedKey!==rendered.key)ctx.waitUntil(deleteObject(env,rendered.key).catch(()=>{}));
   const {storedKey,...publicResult}=result;return publicResult;
  }catch(error){if(rendered&&error.status>=400&&error.status<500)ctx.waitUntil(deleteObject(env,rendered.key).catch(()=>{}));throw error;}
 };
 if(!removeOnly||!request.headers.get('Accept')?.includes('application/x-ndjson'))return json(await edit());
 // Opt-in streaming leaves existing clients and validation responses unchanged.
 // Progress follows output bytes; 100 is sent only after the state commit.
 let connected=true,last=-1;const encoder=new TextEncoder();
 const stream=new ReadableStream({start(controller){
  const send=event=>{if(connected)controller.enqueue(encoder.encode(JSON.stringify(event)+'\n'));};
  const progress=(percent,stage)=>{if(percent>last){last=percent;send({type:'progress',percent,stage});}};
  progress(1,'preparing');
  const task=(async()=>{
   try{const result=await edit(progress);send({type:'complete',percent:100,result});}
   catch(error){send({type:'error',...await fail(error).json()});}
   finally{if(connected){connected=false;controller.close();}}
  })();ctx.waitUntil(task);
 },cancel(){connected=false;}});
 return new Response(stream,{headers:{'Content-Type':'application/x-ndjson; charset=utf-8','Cache-Control':'no-store, no-transform','X-Content-Type-Options':'nosniff'}});
}

export async function videoUploadFinalize(request,env,db,ctx,id,{removeOnly=false}={}){
 const body=await readJSON(request,100000);
 if(removeOnly&&body.metadata?.range?.remove!==true)throw new HttpError(400,'סמנו את הקטע שברצונכם למחוק.');
 const prepared=await db('video.upload.prepare',{...body,id});
 if(prepared.existing)return json(prepared.existing);
 const source=prepared.source;let rendered=null;
 if(prepared.metadata.range)rendered=await renderVideoRange(request,env,ctx,source,prepared.metadata.range,id);
 try{
  const result=await db('video.upload.save',{id,operationId:prepared.operationId,metadata:prepared.metadata,sourceKey:source.key,sourceSize:source.size,rendered});
  if(rendered&&result.storedKey!==rendered.key)ctx.waitUntil(deleteObject(env,rendered.key).catch(()=>{}));
  if(result.obsoleteKey)ctx.waitUntil(deleteObject(env,result.obsoleteKey).catch(()=>{}));
  const {storedKey,obsoleteKey,...publicResult}=result;return json(publicResult);
 }catch(error){if(rendered&&error.status>=400&&error.status<500)ctx.waitUntil(deleteObject(env,rendered.key).catch(()=>{}));throw error;}
}
