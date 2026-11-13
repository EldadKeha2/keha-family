import {HttpError,json,uid,readJSON,boundedBody,hmac,hex,equal} from './http.mjs';
import {configured,createMultipartUpload,uploadMultipartPart,listMultipartParts,completeMultipartUpload,abortMultipartUpload,getObject} from './hf.mjs';

export const VIDEO_PART_SIZE=8*1024*1024;
const SESSION_LIFETIME=24*60*60*1000;
const nameOf=value=>String(value||'family-video.mp4').split(/[\\/]/).pop().replace(/[\x00-\x1f<>:"|?*]/g,'_').slice(0,200)||'family-video.mp4';
const pack=value=>btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(value))));
const unpack=value=>JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(value),c=>c.charCodeAt(0))));
const signature=(env,payload)=>hmac(env.HF_SECRET_ACCESS_KEY,'family-nostalgia-video-v1\n'+payload).then(hex);

async function signSession(env,session){const payload=pack(session);return payload+'.'+await signature(env,payload);}
async function readSession(env,token,limit){
  if(typeof token!=='string'||token.length>12000)throw new HttpError(403,'אישור ההעלאה אינו תקין. בחרו את הסרטון מחדש.');
  const [payload,mac,...extra]=token.split('.');
  if(extra.length||!payload||!/^[a-f0-9]{64}$/.test(mac||'')||!equal(mac,await signature(env,payload)))throw new HttpError(403,'אישור ההעלאה אינו תקין. בחרו את הסרטון מחדש.');
  let session;try{session=unpack(payload);}catch{throw new HttpError(403,'אישור ההעלאה אינו תקין.');}
  if(session.version!==1||!Number.isSafeInteger(session.size)||session.size<1||session.size>limit||session.partSize!==VIDEO_PART_SIZE||!/^[a-f0-9]{32}$/.test(session.id||'')||!['.mp4','.mov','.webm'].includes(session.ext)||session.key!=='nostalgia/shared/'+session.id+session.ext||typeof session.uploadId!=='string')throw new HttpError(403,'אישור ההעלאה אינו תקין.');
  if(!Number.isSafeInteger(session.expires)||session.expires<Date.now())throw new HttpError(410,'אישור ההעלאה פג. בחרו את הסרטון מחדש.');
  return session;
}
function mediaItem(session){return {id:session.id,category:'nostalgia',personId:null,filename:session.filename,name:session.filename.replace(/\.[^.]*$/,'').replaceAll('_',' '),file:session.id+session.ext,key:session.key,mime:session.mime,kind:'video',size:session.size,caption:'',createdAt:session.createdAt};}
async function existingItem(db,session){
  let item;try{item=await db('media.get',{id:session.id});}catch(error){if(error.status===404)return null;throw error;}
  if(item.key!==session.key||item.size!==session.size)throw new HttpError(409,'הסרטון השתנה. בחרו אותו מחדש.');
  return item;
}
const saved=async(db,session,status=201)=>json({saved:true,file:session.id+session.ext,collection:await db('collection',{kind:'nostalgia'})},status);
async function objectExists(env,session,request){
  let response;
  try{response=await getObject(env,mediaItem(session),new Request(request.url,{method:'HEAD'}));}
  catch(error){if(error.status===404)return false;throw error;}
  if(Number(response.headers.get('Content-Length'))!==session.size)throw new HttpError(502,'גודל הסרטון שנשמר אינו תואם למקור. נסו שוב.','VIDEO_SIZE_MISMATCH');
  return true;
}

// Only the existing nostalgia write route calls this handler, after the same
// Origin and public request-marker checks used for ordinary uploads.
export async function multipartVideo(request,env,db,ctx,{action,sniff,limit}){
  if(!configured(env))throw new HttpError(503,'יש להשלים את חיבור האחסון לפני העלאת קבצים.');
  if(action==='start'){
    const body=await readJSON(request,4096),size=body.size;
    if(!Number.isSafeInteger(size)||size<1||size>limit)throw new HttpError(413,'אפשר להעלות סרטון נוסטלגיה עד 500MB.');
    let head;try{if(typeof body.head!=='string'||body.head.length>172)throw Error();head=Uint8Array.from(atob(body.head),c=>c.charCodeAt(0));}catch{throw new HttpError(400,'לא התקבלה תחילת הסרטון. בחרו אותו מחדש.');}
    const format=sniff(head,true),id=uid(),filename=nameOf(body.filename),key='nostalgia/shared/'+id+format.ext;
    const uploadId=await createMultipartUpload(env,key,format.mime);
    const session={version:1,id,key,filename,size,mime:format.mime,ext:format.ext,uploadId,partSize:VIDEO_PART_SIZE,createdAt:new Date().toISOString(),expires:Date.now()+SESSION_LIFETIME};
    return json({session:await signSession(env,session),partSize:VIDEO_PART_SIZE,parts:Math.ceil(size/VIDEO_PART_SIZE)},201);
  }
  const body=action==='part'?null:await readJSON(request,14000);
  const session=await readSession(env,action==='part'?request.headers.get('X-Upload-Session'):body.session,limit);
  if(action==='part'){
    const raw=request.headers.get('X-Upload-Part'),number=Number(raw),count=Math.ceil(session.size/VIDEO_PART_SIZE);
    if(!/^[1-9][0-9]*$/.test(raw||'')||!Number.isInteger(number)||number>count)throw new HttpError(400,'מספר החלק אינו תקין.');
    const expected=Math.min(VIDEO_PART_SIZE,session.size-(number-1)*VIDEO_PART_SIZE);
    if(Number(request.headers.get('Content-Length'))!==expected)throw new HttpError(400,'גודל החלק אינו מתאים לסרטון.');
    const bytes=await boundedBody(request,VIDEO_PART_SIZE);
    if(bytes.byteLength!==expected)throw new HttpError(400,'החלק לא התקבל במלואו. נסו שוב.');
    if(number===1){const format=sniff(new Uint8Array(bytes).subarray(0,128),true);if(format.ext!==session.ext||format.mime!==session.mime)throw new HttpError(415,'תחילת הקובץ אינה תואמת לסרטון שנבחר.');}
    const etag=await uploadMultipartPart(env,session.key,session.uploadId,number,bytes);
    return json({saved:true,part:number,etag});
  }
  const existing=await existingItem(db,session);
  if(action==='abort'){
    if(!existing)await abortMultipartUpload(env,session.key,session.uploadId);
    return json({cancelled:!existing,saved:Boolean(existing)});
  }
  if(action!=='complete')throw new HttpError(404,'הפעולה לא נמצאה.');
  if(existing)return saved(db,session,200);
  // HEAD also recovers a successful storage completion whose database write or
  // HTTP acknowledgement was interrupted; the same upload can be retried.
  if(!await objectExists(env,session,request)){
    const parts=(await listMultipartParts(env,session.key,session.uploadId)).sort((a,b)=>a.number-b.number),count=Math.ceil(session.size/VIDEO_PART_SIZE);
    if(parts.length!==count||parts.some((part,index)=>part.number!==index+1||part.size!==Math.min(VIDEO_PART_SIZE,session.size-index*VIDEO_PART_SIZE)||typeof part.etag!=='string'||!part.etag.length))throw new HttpError(409,'הסרטון עדיין לא התקבל במלואו. נסו שוב.','VIDEO_INCOMPLETE');
    await completeMultipartUpload(env,session.key,session.uploadId,parts);
    if(!await objectExists(env,session,request))throw new HttpError(502,'הסרטון עדיין אינו זמין באחסון. נסו שוב.');
  }
  try{await db('media.add',{item:mediaItem(session)});}
  catch(error){
    // Retain completed bytes after an uncertain state-service result. Another
    // completion may already have registered this exact immutable upload.
    if(!await existingItem(db,session))throw error;
  }
  return saved(db,session);
}
