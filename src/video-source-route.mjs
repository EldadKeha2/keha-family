import {HttpError,json,readJSON,sha256,uid} from './http.mjs';
import {configured,createMultipartUpload,listMultipartParts,abortMultipartUpload,getObject,deleteObject} from './hf.mjs';
import {VIDEO_PART_SIZE,writeVideoPart,completeVideoObject} from './video-multipart.mjs';
import {renderVideoRange} from './video-clip-route.mjs';
import {validCollection} from './weddings.mjs';
import {MAX_VIDEO_SOURCE_BYTES} from '../public/assets/video-source-limits.mjs';
import {videoUploadMetadata} from '../public/assets/video-upload-metadata.mjs';

const removal = async (env,source) => {
  if (!source.joined) await abortMultipartUpload(env,source.key,source.uploadId);
  if (!source.fullId) await deleteObject(env,source.key,fetch,{verify:true});
};
export async function expireVideoSources(env,db) {
  const expired = await db('video.source.expired');
  for (const source of expired) {
    try { await removal(env,source); await db('video.source.forget',{id:source.id}); }
    catch { /* The next scheduled pass retries unconfirmed removals. */ }
  }
}
const summary = source => ({ready:source.phase === 'ready',partSize:VIDEO_PART_SIZE,parts:Math.ceil(source.size/VIDEO_PART_SIZE)});
export async function videoSourceRoute(request,env,db,ctx,action,sniff,readToken) {
  if (!configured(env)) throw new HttpError(503,'האחסון לא זמין כרגע.');
  // An unpublished source is addressed by a separate random bearer capability.
  // Its hash and storage key are unrelated to any eventually published media ID.
  const token = readToken || request.headers.get('X-Video-Source');
  if (!/^[a-f0-9]{64}$/.test(token||'')) throw new HttpError(403,'אישור הטיוטה אינו תקין.');
  const id = await sha256(token);
  if (action === 'start') {
    const {size,head,scope,filename} = await readJSON(request,4096);
    if (!Number.isSafeInteger(size)||size<1||size>MAX_VIDEO_SOURCE_BYTES) throw new HttpError(413,'אפשר להעלות קובץ מקור עד 4 GiB.');
    if (scope!=='nostalgia' && scope!=='videos' && !(typeof scope==='string' && scope.startsWith('wedding:'))) throw new HttpError(400,'יש לבחור אלבום סרטונים תקין.');
    validCollection(scope);
    if (typeof filename!=='string' || !filename.trim() || filename.length>512) throw new HttpError(400,'שם הקובץ אינו תקין.');
    if (typeof head!=='string' || !head.length || head.length>172) throw new HttpError(400,'לא התקבלה תחילת הסרטון.');
    let bytes;try {bytes=Uint8Array.from(atob(head),c=>c.charCodeAt(0));} catch {throw new HttpError(400,'לא התקבלה תחילת הסרטון.');}
    const format=sniff(bytes,true);
    const draft={...format,size,scope,filename:filename.split(/[\\/]/).pop().slice(0,200)};
    const previous = await db('video.source.find',{id});
    if (previous) return json(summary(await db('video.source.begin',{id,source:draft})));
    draft.key='video-sources/'+uid()+format.ext;
    draft.uploadId=await createMultipartUpload(env,draft.key,format.mime);
    let stored;
    try { stored=await db('video.source.begin',{id,source:draft}); }
    catch (error) {
      if (error.status>=400 && error.status<500) ctx.waitUntil(abortMultipartUpload(env,draft.key,draft.uploadId).catch(()=>{}));
      throw error;
    }
    if (stored.key!==draft.key) ctx.waitUntil(abortMultipartUpload(env,draft.key,draft.uploadId).catch(()=>{}));
    return json(summary(stored),201);
  }
  if (action==='discard') {
    const source=await db('video.source.discard',{id});
    if(source.key)ctx.waitUntil(removal(env,source).catch(()=>{}));
    return json({discarded:true});
  }
  const source=await db('video.source.get',{id});
  if (action==='play') {
    if(source.phase!=='ready')throw new HttpError(409,'המקור עדיין בהעלאה.');
    return getObject(env,{...source,kind:'video'},request);
  }
  if (action==='part') {
    if(source.phase==='ready')throw new HttpError(409,'העלאת המקור כבר הושלמה.');
    return writeVideoPart(request,env,source,sniff);
  }
  if (action==='status') {
    const completed=source.phase==='ready'?[]:(await listMultipartParts(env,source.key,source.uploadId))
      .filter(p=>p.number>0 && p.number<=Math.ceil(source.size/VIDEO_PART_SIZE) && p.size===Math.min(VIDEO_PART_SIZE,source.size-(p.number-1)*VIDEO_PART_SIZE)).map(p=>p.number);
    return json({...summary(source),completed});
  }
  if (action==='complete') {
    if(source.phase!=='ready'){
      await completeVideoObject(env,source,request);
      await db('video.source.ready',{id});
    }
    return json({ready:true});
  }
  if (action!=='save')throw new HttpError(404,'הפעולה לא נמצאה.');
  const body=await readJSON(request,100000);
  if(![body.mediaId,body.operationId].every(v=>typeof v==='string' && /^[a-f0-9]{32}$/.test(v)))throw new HttpError(400,'אישור השמירה אינו תקין.');
  let metadata;try{metadata=videoUploadMetadata(body.metadata);}catch{throw new HttpError(400,'בדקו את פרטי המקטע ואת סימוני הזמן.');}
  const data={id,mediaId:body.mediaId,operationId:body.operationId,metadata};
  const prepared=await db('video.source.prepare',data);
  const publicResult=({storedKey,obsoleteKey,existing,...result})=>result;
  if(prepared.existing)return json(publicResult(prepared));
  const rendered=metadata.range?await renderVideoRange(request,env,ctx,source,metadata.range,body.mediaId):null;
  try {
    const result=await db('video.source.publish',{...data,rendered});
    if(rendered && result.storedKey!==rendered.key)ctx.waitUntil(deleteObject(env,rendered.key).catch(()=>{}));
    return json(publicResult(result));
  } catch(error) {
    if(rendered && error.status>=400 && error.status<500)ctx.waitUntil(deleteObject(env,rendered.key).catch(()=>{}));
    throw error;
  }
}
