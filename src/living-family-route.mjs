import {HttpError,json,boundedBody,sha256} from './http.mjs';
import {configured,putObject,getObject,deleteObject} from './hf.mjs';
import {livingVideoInfo,LIVING_VIDEO_MAX_BYTES} from './living-family-video.mjs';
import {livingSourceInfo,LIVING_SOURCE_MAX_BYTES} from './living-family-source.mjs';

const cleanName=value=>String(value||'family-memory.mp4').split(/[\\/]/).pop().replace(/[\x00-\x1f<>:"|?*]/g,'_').slice(0,180)||'family-memory.mp4';
export async function livingFamilyRoute(request,env,db,ctx,fetcher=fetch){
  const url=new URL(request.url),path=url.pathname;let match;
  if(path==='/api/family-ai/featured'&&request.method==='GET')return json(await db('family-ai.living.list'));
  if((match=/^\/api\/family-ai\/photos\/([a-f0-9]{32})\/source$/.exec(path))&&request.method==='POST'){
    if(!configured(env))throw new HttpError(503,'שמירת התמונה אינה זמינה כרגע.','LIVING_STORAGE');
    const bytes=await boundedBody(request,LIVING_SOURCE_MAX_BYTES),input={id:match[1],...livingSourceInfo(bytes),digest:await sha256(bytes)};
    const prepared=await db('family-ai.living.source.prepare',input);
    if(prepared.alreadySaved)return json({saved:true,...prepared});
    const key='family-ai/'+input.id+'/source/'+input.digest+'.png';
    await putObject(env,key,bytes,bytes.byteLength,'image/png',fetcher);
    const result=await db('family-ai.living.source.save',{...input,key});
    return json({saved:true,...result},result.alreadySaved?200:201);
  }
  if((match=/^\/api\/family-ai\/photos\/([a-f0-9]{32})\/clips\/(smile|wave|dance)$/.exec(path))&&request.method==='POST'){
    if(!configured(env))throw new HttpError(503,'שמירת הסרטונים אינה זמינה כרגע.','LIVING_STORAGE');
    const id=match[1],action=match[2],revision=url.searchParams.get('revision'),operation=url.searchParams.get('operation'),expected=url.searchParams.get('expected');
    if(!revision||!/^[A-Za-z0-9_-]{1,80}$/.test(revision)||!/^[a-f0-9]{32}$/.test(operation||'')||!(expected==='none'||/^[a-f0-9]{32}$/.test(expected||'')))throw new HttpError(400,'פרטי שמירת ההנפשה אינם תקינים.','LIVING_IMPORT');
    const source=await db('media.get',{id});if((source.photoRevision||'original')!==revision)throw new HttpError(409,'התמונה נערכה מאז הכנת ההנפשה.','LIVING_SOURCE_CHANGED');
    const declared=request.headers.get('Content-Length');
    if(declared!==null&&(!/^\d+$/.test(declared)||Number(declared)>LIVING_VIDEO_MAX_BYTES))throw new HttpError(413,'אפשר להעלות הנפשה עד 25MB.','LIVING_SIZE');
    const bytes=await boundedBody(request,LIVING_VIDEO_MAX_BYTES);
    if(!bytes.byteLength||declared!==null&&Number(declared)!==bytes.byteLength)throw new HttpError(400,'הסרטון לא התקבל במלואו.','LIVING_SIZE');
    const input={id,variant:action,revision,operation,expected:expected==='none'?null:expected,filename:cleanName(url.searchParams.get('filename')),...await livingVideoInfo(bytes),digest:await sha256(bytes)};
    const prepared=await db('family-ai.living.prepare',input);
    const publicResult=result=>({saved:true,alreadySaved:Boolean(result.alreadySaved),clip:{action:result.clip.action,status:'ready',version:result.clip.version,duration:result.clip.video.duration,videoSrc:'/api/family-ai/video/'+id+'/'+action+'?v='+result.clip.version}});
    if(prepared.alreadySaved)return json(publicResult(prepared));
    const assetHash=await sha256(prepared.input.fingerprint),key='family-ai/'+id+'/actions/'+action+'/'+operation+'-'+assetHash+'.mp4';
    await putObject(env,key,bytes,bytes.byteLength,'video/mp4',fetcher);
    try{const result=await db('family-ai.living.save',{...input,key,assetHash});return json(publicResult(result),result.alreadySaved?200:201);}
    catch(error){if(error.status>=400&&error.status<500)ctx.waitUntil(deleteObject(env,key,fetcher).catch(()=>{}));throw error;}
  }
  if((match=/^\/api\/family-ai\/video\/([a-f0-9]{32})\/(smile|wave|dance)$/.exec(path))&&['GET','HEAD'].includes(request.method)){
    const {clip}=await db('family-ai.living.get',{id:match[1],variant:match[2]});
    if(!clip)throw new HttpError(404,'ההנפשה הזאת עדיין בהכנה.','LIVING_PENDING');
    if(url.searchParams.has('v')&&url.searchParams.get('v')!==clip.version)throw new HttpError(409,'ההנפשה עודכנה. רעננו את העמוד.','LIVING_CLIP_CHANGED');
    const response=await getObject(env,clip.video,request,fetcher),headers=new Headers(response.headers);
    if(url.searchParams.get('download')==='1')headers.set('Content-Disposition','attachment; filename="family-memory-'+match[1]+'-'+match[2]+'.mp4"');
    return new Response(response.body,{status:response.status,headers});
  }
  return null;
}
