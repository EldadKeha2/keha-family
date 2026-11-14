import {HttpError,json,readJSON,uid} from './http.mjs';
import {getObject,putObject,deleteObject} from './hf.mjs';
import {planMp4Clip} from './mp4-clip.mjs';

function prefixedStream(prefix,body,expected){
 const reader=body.getReader();let first=true,total=0;
 return new ReadableStream({async pull(controller){try{if(first){first=false;controller.enqueue(prefix);return;}const next=await reader.read();if(next.done){if(total!==expected)throw new Error('Incomplete source range');controller.close();return;}total+=next.value.byteLength;if(total>expected)throw new Error('Oversized source range');controller.enqueue(next.value);}catch(error){await reader.cancel().catch(()=>{});controller.error(error);}},cancel:reason=>reader.cancel(reason)});
}
export async function renderVideoRange(request,env,ctx,source,range,ownerId){
 let plan,key;
  if(!['video/mp4','video/quicktime'].includes(source.mime))throw new HttpError(415,'לעריכת קטעים העלו סרטון בפורמט MP4 או MOV.','VIDEO_CLIP_FORMAT');
  const ranged=(start,end)=>getObject(env,source,new Request(request.url,{headers:{Range:`bytes=${start}-${end}`}}));
  const read=async(start,end)=>{const response=await ranged(start,end);if(response.status!==206||response.headers.get('Content-Range')!==`bytes ${start}-${end}/${source.size}`){await response.body?.cancel();throw new HttpError(502,'לא ניתן לקרוא את הקטע המסומן כרגע. נסו שוב.');}const bytes=new Uint8Array(await response.arrayBuffer());if(bytes.length!==end-start+1)throw new HttpError(502,'נתוני הסרטון לא התקבלו במלואם.');return bytes;};
  plan=await planMp4Clip(read,source.size,{start:range.start,end:range.end});
  const response=await ranged(plan.rangeStart,plan.rangeEnd);
  if(response.status!==206||Number(response.headers.get('Content-Length'))!==plan.rangeEnd-plan.rangeStart+1){await response.body?.cancel();throw new HttpError(502,'הקטע המסומן לא התקבל במלואו. נסו שוב.');}
  key='video-clips/'+ownerId+'/'+uid()+'.mp4';let stream=prefixedStream(plan.prefix,response.body,plan.rangeEnd-plan.rangeStart+1),transfer=Promise.resolve();
  if(typeof FixedLengthStream!=='undefined'){const fixed=new FixedLengthStream(plan.size);transfer=stream.pipeTo(fixed.writable);stream=fixed.readable;transfer.catch(()=>{});}
  try{await Promise.all([putObject(env,key,stream,plan.size,'video/mp4'),transfer]);}catch(error){ctx.waitUntil(deleteObject(env,key).catch(()=>{}));throw error;}
 return {key,size:plan.size,mime:'video/mp4',duration:plan.duration};
}
export async function videoClipRoute(request,env,db,ctx,id){
 const body=await readJSON(request,4096),prepared=await db('video.clip.prepare',{...body,id});
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

export async function videoUploadFinalize(request,env,db,ctx,id){
 const body=await readJSON(request,100000),prepared=await db('video.upload.prepare',{...body,id});
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
