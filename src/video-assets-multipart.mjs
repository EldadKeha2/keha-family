import {HttpError,json,uid,readJSON,boundedBody,hmac,hex,equal} from './http.mjs';
import {configured,createMultipartUpload,uploadMultipartPart,listMultipartParts,completeMultipartUpload,abortMultipartUpload,getObject,deleteObject} from './hf.mjs';
import {VIDEO_ASSET_LIMITS} from './video-assets.mjs';
import {VIDEO_ASSET_VARIANTS,currentVideoAsset} from './video-assets-state.mjs';

export const VIDEO_ASSET_PART_SIZE=8*1024*1024;
const pack=value=>btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(value))));
const unpack=value=>JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(value),c=>c.charCodeAt(0))));
const signature=(env,payload)=>hmac(env.HF_SECRET_ACCESS_KEY,'family-video-assets-v1\n'+payload).then(hex);
const maximum=(item,variant)=>Math.min(VIDEO_ASSET_LIMITS[variant],variant==='poster'?Infinity:variant==='faststart'?item.size+2*1024*1024:item.size-1);
function validateHead(bytes,variant){
  const head=new Uint8Array(bytes);
  if(head.length<12||!(variant==='poster'?head[0]===255&&head[1]===216&&head[2]===255:new TextDecoder().decode(head.subarray(4,8))==='ftyp'&&!['avif','avis','heic','heix','mif1','msf1'].includes(new TextDecoder().decode(head.subarray(8,12)))))throw new HttpError(415,'תחילת הקובץ אינה תואמת לגרסה שנבחרה.');
}
function metadata(body){
  const result={};for(const [key,max]of [['width',16384],['height',16384],['duration',86400],['bitrate',1000000000]])if(body[key]!==undefined){if(typeof body[key]!=='number'||!Number.isFinite(body[key])||body[key]<=0||body[key]>max)throw new HttpError(400,'פרטי הגרסה המקדימה אינם תקינים.');result[key]=body[key];}return result;
}
async function readTicket(env,token,id,variant){
  if(typeof token!=='string'||token.length>12000)throw new HttpError(403,'אישור ההעלאה אינו תקין.');
  const [payload,mac,...extra]=token.split('.');if(extra.length||!payload||!/^[a-f0-9]{64}$/.test(mac||'')||!equal(mac,await signature(env,payload)))throw new HttpError(403,'אישור ההעלאה אינו תקין.');
  let ticket;try{ticket=unpack(payload);}catch{throw new HttpError(403,'אישור ההעלאה אינו תקין.');}
  const revision=ticket.revision,prefix='video-assets/'+id+'/'+revision+'/'+variant+'/',ext=variant==='poster'?'.jpg':'.mp4',suffix=ticket.key?.slice(prefix.length);
  if(ticket.version!==1||ticket.id!==id||ticket.variant!==variant||!(revision==='original'||/^[a-f0-9]{32}$/.test(revision||''))||!ticket.key?.startsWith(prefix)||!new RegExp('^[a-f0-9]{32}\\'+ext+'$').test(suffix||'')||!Number.isSafeInteger(ticket.size)||ticket.size<12||ticket.size>maximum({size:ticket.sourceSize},variant)||!Number.isSafeInteger(ticket.sourceSize)||ticket.sourceSize<1||typeof ticket.sourceKey!=='string'||typeof ticket.uploadId!=='string'||ticket.uploadId.length>2048||ticket.partSize!==VIDEO_ASSET_PART_SIZE)throw new HttpError(403,'אישור ההעלאה אינו תקין.');
  if(!Number.isSafeInteger(ticket.expires)||ticket.expires<Date.now())throw new HttpError(410,'אישור ההעלאה פג.');
  return ticket;
}
async function exists(env,ticket,request){
  try{const response=await getObject(env,{key:ticket.key,size:ticket.size,mime:ticket.variant==='poster'?'image/jpeg':'video/mp4',kind:ticket.variant==='poster'?'photo':'video',filename:'derived'},new Request(request.url,{method:'HEAD'}));if(Number(response.headers.get('Content-Length'))!==ticket.size)throw new HttpError(502,'גודל הגרסה שנשמרה אינו תקין.');return true;}
  catch(error){if(error.status===404)return false;throw error;}
}
const publicResult=async(db,id,saved)=>json({saved,item:(await db('media.public',{id})).item});
// Called only after the ordinary Origin/public write-marker checks. Each
// signed ticket owns one new immutable derived key and can never name an
// original, another media item's asset, or an arbitrary storage object.
export async function multipartVideoAsset(request,env,db,ctx,{id,variant,action}){
  if(!configured(env))throw new HttpError(503,'יש להשלים את חיבור האחסון.');
  if(!/^[a-f0-9]{32}$/.test(id)||!VIDEO_ASSET_VARIANTS.includes(variant)||!['start','part','complete','abort'].includes(action))throw new HttpError(404,'הפעולה לא נמצאה.');
  if(action==='start'){
    const body=await readJSON(request,4096),item=await db('media.get',{id}),revision=body.revision;
    if(item.provider||!item.mime?.startsWith('video/'))throw new HttpError(400,'הסרטון אינו מקומי.');
    if(revision!==(item.videoRevision||'original'))throw new HttpError(409,'הסרטון השתנה בינתיים.');
    if(item.videoAssets?.[variant]?.revision===revision)return publicResult(db,id,false);
    if(!Number.isSafeInteger(body.size)||body.size<12||body.size>maximum(item,variant))throw new HttpError(413,'גודל הגרסה המקדימה אינו תקין.');
    let head;try{if(typeof body.head!=='string'||body.head.length>172)throw Error();head=Uint8Array.from(atob(body.head),c=>c.charCodeAt(0));}catch{throw new HttpError(400,'לא התקבלה תחילת הקובץ.');}validateHead(head,variant);
    const meta=metadata(body),key='video-assets/'+id+'/'+revision+'/'+variant+'/'+uid()+(variant==='poster'?'.jpg':'.mp4'),mime=variant==='poster'?'image/jpeg':'video/mp4';
    const uploadId=await createMultipartUpload(env,key,mime),ticket={version:1,id,variant,revision,key,size:body.size,sourceKey:item.key,sourceSize:item.size,meta,uploadId,partSize:VIDEO_ASSET_PART_SIZE,expires:Date.now()+24*60*60*1000};
    const payload=pack(ticket);return json({ticket:payload+'.'+await signature(env,payload),partSize:VIDEO_ASSET_PART_SIZE,parts:Math.ceil(body.size/VIDEO_ASSET_PART_SIZE)},201);
  }
  const params=new URL(request.url).searchParams,body=action==='part'?null:await readJSON(request,14000),ticket=await readTicket(env,action==='part'?params.get('ticket'):body.ticket,id,variant);
  if(action==='part'){
    const raw=params.get('partNumber'),number=Number(raw),count=Math.ceil(ticket.size/VIDEO_ASSET_PART_SIZE);
    if(!/^[1-9][0-9]*$/.test(raw||'')||!Number.isSafeInteger(number)||number>count)throw new HttpError(400,'מספר החלק אינו תקין.');
    const expected=Math.min(VIDEO_ASSET_PART_SIZE,ticket.size-(number-1)*VIDEO_ASSET_PART_SIZE);
    if(Number(request.headers.get('Content-Length'))!==expected)throw new HttpError(400,'גודל החלק אינו תקין.');
    const bytes=await boundedBody(request,VIDEO_ASSET_PART_SIZE);if(bytes.byteLength!==expected)throw new HttpError(400,'החלק לא התקבל במלואו.');if(number===1)validateHead(new Uint8Array(bytes).subarray(0,128),variant);
    return json({saved:true,part:number,etag:await uploadMultipartPart(env,ticket.key,ticket.uploadId,number,bytes)});
  }
  let item;try{item=await db('media.get',{id});}catch(error){if(error.status!==404)throw error;}
  const current=item?currentVideoAsset(item,variant,ticket.revision):null;
  if(action==='abort'){
    if(current?.key===ticket.key)return json({saved:true,cancelled:false});
    // Abort pending parts only. A completed object may have committed even
    // if the acknowledgement or the later state read was interrupted.
    await abortMultipartUpload(env,ticket.key,ticket.uploadId);return json({saved:false,cancelled:true});
  }
  if(!item||item.key!==ticket.sourceKey||item.size!==ticket.sourceSize||(item.videoRevision||'original')!==ticket.revision){ctx.waitUntil(abortMultipartUpload(env,ticket.key,ticket.uploadId).catch(()=>{}));ctx.waitUntil(deleteObject(env,ticket.key).catch(()=>{}));throw new HttpError(item?409:404,'הסרטון השתנה בינתיים.');}
  if(item.videoAssets?.[variant]?.revision===ticket.revision){if(current?.key!==ticket.key){ctx.waitUntil(abortMultipartUpload(env,ticket.key,ticket.uploadId).catch(()=>{}));ctx.waitUntil(deleteObject(env,ticket.key).catch(()=>{}));}return publicResult(db,id,false);}
  if(!await exists(env,ticket,request)){
    const parts=(await listMultipartParts(env,ticket.key,ticket.uploadId)).sort((a,b)=>a.number-b.number),count=Math.ceil(ticket.size/VIDEO_ASSET_PART_SIZE);
    if(parts.length!==count||parts.some((part,index)=>part.number!==index+1||part.size!==Math.min(VIDEO_ASSET_PART_SIZE,ticket.size-index*VIDEO_ASSET_PART_SIZE)||typeof part.etag!=='string'||!part.etag))throw new HttpError(409,'הגרסה המקדימה עדיין לא התקבלה במלואה.','VIDEO_ASSET_INCOMPLETE');
    await completeMultipartUpload(env,ticket.key,ticket.uploadId,parts);if(!await exists(env,ticket,request))throw new HttpError(502,'הגרסה אינה זמינה באחסון.');
  }
  try{
    const result=await db('video.asset.save',{id,variant,revision:ticket.revision,asset:{key:ticket.key,size:ticket.size,mime:variant==='poster'?'image/jpeg':'video/mp4',revision:ticket.revision,...ticket.meta}});
    if(!result.saved){const live=await db('media.get',{id});if(live.videoAssets?.[variant]?.key!==ticket.key)ctx.waitUntil(deleteObject(env,ticket.key).catch(()=>{}));}
    if(result.obsoleteKey)ctx.waitUntil(deleteObject(env,result.obsoleteKey).catch(()=>{}));const {obsoleteKey,...output}=result;return json(output);
  }catch(error){if(error.status>=400&&error.status<500)ctx.waitUntil(deleteObject(env,ticket.key).catch(()=>{}));throw error;}
}
