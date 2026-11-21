import {HttpError,json,uid,readJSON} from './http.mjs';
import {configured,putObject,deleteObject} from './hf.mjs';
import {sniffAudio} from './memories.mjs';

export async function deleteFamilyDocument(request,db,branch,id){
  const {password}=await readJSON(request,2048);
  return json(await db('content.document.delete',{branch,id,password,client:request.headers.get('CF-Connecting-IP')||'unknown'}));
}

export async function uploadFamilyDocument(request,env,db,ctx,options,branch='original'){
  if(!configured(env))throw new HttpError(503,'אחסון הקבצים אינו זמין כרגע.');
  const params=new URL(request.url).searchParams;
  const filename=String(params.get('filename')||'document').split(/[\\/]/).pop().replace(/[\x00-\x1f<>:"|?*]/g,'_').slice(0,200);
  let fields;
  try{fields=JSON.parse(decodeURIComponent(request.headers.get('X-Family-Document')||''));}catch{throw new HttpError(400,'פרטי המסמך אינם תקינים.');}
  const validated=await db('content.document.prepare',{branch,fields});
  const incoming=await options.streamUpload(request,90*1024*1024);
  let format;
  try{
    try{format={...sniffAudio(incoming.head,filename),maximum:90*1024*1024};}
    catch{format=options.archiveFormat(incoming.head,filename);if(format.kind==='video')throw new HttpError(415,'בחרו מסמך, צילום תעודה או הקלטה.');}
    if(incoming.size>format.maximum)throw new HttpError(413,'הקובץ גדול מדי. מסמכים עד 10MB, תמונות עד 50MB והקלטות עד 90MB.');
  }catch(error){await incoming.body.cancel().catch(()=>{});throw error;}
  const id=uid(),key='documents/'+id+format.ext;
  let body=incoming.body,transfer=Promise.resolve();
  if(typeof FixedLengthStream!=='undefined'){const fixed=new FixedLengthStream(incoming.size);transfer=body.pipeTo(fixed.writable);transfer.catch(()=>{});body=fixed.readable;}
  try{await Promise.all([putObject(env,key,body,incoming.size,format.mime),transfer]);}
  catch(error){ctx.waitUntil(deleteObject(env,key).catch(()=>{}));throw error;}
  try{
    const now=new Date().toISOString();
    return json(await db('content.document.add',{branch,fields:validated.fields,item:{id,key,filename,file:id+format.ext,mime:format.mime,kind:'document',size:incoming.size,createdAt:now,modifiedAt:now}}),201);
  }catch(error){if(error.status>=400&&error.status<500)ctx.waitUntil(deleteObject(env,key).catch(()=>{}));throw error;}
}
