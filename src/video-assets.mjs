import {HttpError,json,uid} from './http.mjs';
import {putObject,deleteObject} from './hf.mjs';
import {VIDEO_ASSET_VARIANTS,currentVideoAsset} from './video-assets-state.mjs';

const MiB=1024*1024;
export const VIDEO_ASSET_LIMITS={poster:2*MiB,faststart:502*MiB,low:500*MiB,medium:500*MiB};
export function resolveVideoAsset(item,params){
  if(!params.has('videoAsset'))return null;
  const variant=params.get('videoAsset'),revision=params.get('v');
  if(!VIDEO_ASSET_VARIANTS.includes(variant))throw new HttpError(400,'גרסת הסרטון אינה תקינה.');
  if(revision!==(item.videoRevision||'original'))throw new HttpError(409,'הסרטון השתנה בינתיים.');
  const asset=currentVideoAsset(item,variant,revision);if(!asset)throw new HttpError(404,'הגרסה המקדימה אינה זמינה עדיין.');
  return {...item,...asset,kind:variant==='poster'?'photo':'video',filename:variant+(variant==='poster'?'.jpg':'.mp4'),videoAsset:variant};
}
export async function videoAssetBody(request,maximum,variant){
  const raw=request.headers.get('Content-Length'),size=Number(raw);
  if(raw===null||!/^\d+$/.test(raw)||!Number.isSafeInteger(size))throw new HttpError(411,'לא התקבל גודל הקובץ.');
  if(size<12||size>maximum)throw new HttpError(size>maximum?413:400,'גודל הגרסה המקדימה אינו תקין.');
  const reader=request.body?.getReader();if(!reader)throw new HttpError(400,'הקובץ לא התקבל.');
  const first=[];let buffered=0;
  try{
    while(buffered<12){const next=await reader.read();if(next.done)throw new HttpError(400,'ההעלאה לא הושלמה.');first.push(next.value);buffered+=next.value.byteLength;if(buffered>size)throw new HttpError(400,'גודל הקובץ אינו מתאים לנתונים שהתקבלו.');}
    const head=new Uint8Array(12);let copied=0;for(const chunk of first){const take=Math.min(12-copied,chunk.byteLength);head.set(chunk.subarray(0,take),copied);copied+=take;if(copied===12)break;}
    const valid=variant==='poster'?head[0]===255&&head[1]===216&&head[2]===255:new TextDecoder().decode(head.subarray(4,8))==='ftyp'&&!['avif','avis','heic','heix','mif1','msf1'].includes(new TextDecoder().decode(head.subarray(8,12)));
    if(!valid)throw new HttpError(415,variant==='poster'?'יש לצרף תמונת JPEG.':'יש לצרף סרטון MP4.');
  }catch(error){await reader.cancel().catch(()=>{});throw error;}
  let total=0,index=0;
  const body=new ReadableStream({async pull(controller){try{const next=index<first.length?{done:false,value:first[index++]}:await reader.read();if(next.done){if(total!==size)throw new HttpError(400,'ההעלאה לא הושלמה.');controller.close();return;}total+=next.value.byteLength;if(total>size)throw new HttpError(400,'גודל הקובץ אינו מתאים לנתונים שהתקבלו.');controller.enqueue(next.value);}catch(error){await reader.cancel().catch(()=>{});controller.error(error);}},cancel:reason=>reader.cancel(reason)});
  return {size,body};
}
function metadata(params){
  const result={};for(const [key,max]of [['width',16384],['height',16384],['duration',86400],['bitrate',1000000000]])if(params.has(key)){const value=Number(params.get(key));if(!Number.isFinite(value)||value<=0||value>max)throw new HttpError(400,'פרטי הגרסה המקדימה אינם תקינים.');result[key]=value;}return result;
}
export async function saveVideoAssetRoute(request,env,db,ctx,id,variant){
  if(!VIDEO_ASSET_VARIANTS.includes(variant))throw new HttpError(400,'גרסת הסרטון אינה תקינה.');
  const params=new URL(request.url).searchParams,revision=params.get('revision'),item=await db('media.get',{id});
  if(item.provider||!item.mime?.startsWith('video/'))throw new HttpError(400,'אפשר להכין גרסה מקדימה לסרטון מקומי בלבד.');
  if(revision!==(item.videoRevision||'original'))throw new HttpError(409,'הסרטון השתנה בינתיים.');
  if(item.videoAssets?.[variant]?.revision===revision){await request.body?.cancel();return json({saved:false,item:(await db('media.public',{id})).item});}
  const skip=params.get('skip');
  if(skip){
    if(!['not-smaller','unsupported','already-faststart','not-needed'].includes(skip))throw new HttpError(400,'סיבת הדילוג אינה תקינה.');
    await request.body?.cancel();const result=await db('video.asset.save',{id,variant,revision,asset:{revision,skipped:true,reason:skip}});
    if(result.obsoleteKey)ctx.waitUntil(deleteObject(env,result.obsoleteKey).catch(()=>{}));
    const {obsoleteKey,...publicResult}=result;return json(publicResult);
  }
  const details=metadata(params),maximum=Math.min(VIDEO_ASSET_LIMITS[variant],variant==='poster'?Infinity:variant==='faststart'?item.size+2*MiB:item.size-1);
  const upload=await videoAssetBody(request,maximum,variant),key='video-assets/'+id+'/'+revision+'/'+variant+'/'+uid()+(variant==='poster'?'.jpg':'.mp4'),mime=variant==='poster'?'image/jpeg':'video/mp4';
  let body=upload.body,transfer=Promise.resolve();
  if(typeof FixedLengthStream!=='undefined'){const fixed=new FixedLengthStream(upload.size);transfer=body.pipeTo(fixed.writable);body=fixed.readable;transfer.catch(()=>{});}
  try{await Promise.all([putObject(env,key,body,upload.size,mime),transfer]);}
  catch(error){ctx.waitUntil(deleteObject(env,key).catch(()=>{}));throw error;}
  try{
    const result=await db('video.asset.save',{id,variant,revision,asset:{key,size:upload.size,mime,revision,...details}});
    if(!result.saved)ctx.waitUntil(deleteObject(env,key).catch(()=>{}));
    if(result.obsoleteKey)ctx.waitUntil(deleteObject(env,result.obsoleteKey).catch(()=>{}));
    const {obsoleteKey,...publicResult}=result;return json(publicResult);
  }catch(error){if(error.status>=400&&error.status<500)ctx.waitUntil(deleteObject(env,key).catch(()=>{}));throw error;}
}
