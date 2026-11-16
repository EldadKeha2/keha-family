import {HttpError,json,uid} from './http.mjs';
import {configured,putObject,deleteObject} from './hf.mjs';
import {sniffAudio} from './memories.mjs';

export async function uploadRecording(request,env,db,ctx,streamUpload){
  if(!configured(env))throw new HttpError(503,'יש להשלים את חיבור האחסון לפני העלאת הקלטות.');
  const params=new URL(request.url).searchParams,id=params.get('uploadId'),filename=String(params.get('filename')||'recording').split(/[\\/]/).pop().replace(/[\x00-\x1f<>:"|?*]/g,'_').slice(0,200);
  let fields;
  try{
    const raw=request.headers.get('X-Family-Recording');if(!raw||raw.length>65536)throw Error();
    fields=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(raw),c=>c.charCodeAt(0))));
    if(!fields||typeof fields!=='object'||Array.isArray(fields))throw Error();
  }catch{throw new HttpError(400,'פרטי ההקלטה אינם תקינים. נסו שוב.');}
  const prepared=await db('recording.prepare',{id,filename,size:Number(request.headers.get('Content-Length')),fields});
  if(prepared.existing){await request.body?.cancel();return json({saved:true,recording:prepared.existing});}
  const media=await streamUpload(request,90*1024*1024);let format;
  try{format=sniffAudio(media.head,filename);}catch(error){await media.body.cancel();throw error;}
  // Each attempt stages a unique object. A retry cannot overwrite registered audio.
  const key='recordings/'+id+'/'+uid()+format.ext;let body=media.body,transfer=Promise.resolve();
  if(typeof FixedLengthStream!=='undefined'){const fixed=new FixedLengthStream(media.size);transfer=body.pipeTo(fixed.writable);body=fixed.readable;transfer.catch(()=>{});}
  try{await Promise.all([putObject(env,key,body,media.size,format.mime),transfer]);}
  catch(error){ctx.waitUntil(deleteObject(env,key).catch(()=>{}));throw error;}
  try{
    const result=await db('recording.add',{id,filename,size:media.size,mime:format.mime,key,fields:prepared.fields});
    // Concurrent duplicate attempts keep the first registration and discard only their own staged bytes.
    const registered=await db('recording.get',{id});if(registered.key!==key)ctx.waitUntil(deleteObject(env,key).catch(()=>{}));
    return json(result,201);
  }catch(error){
    // A transport failure can hide a successful commit; preserve staged bytes then.
    if(error.status>=400&&error.status<500)ctx.waitUntil(deleteObject(env,key).catch(()=>{}));throw error;
  }
}
