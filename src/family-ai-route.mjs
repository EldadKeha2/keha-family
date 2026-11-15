import {HttpError,json,readJSON,uid,hmac,hex,equal} from './http.mjs';
import {configured,getObject,putObject,deleteObject} from './hf.mjs';

const API='https://api.dev.runwayml.com/v1',VERSION='2024-11-06';
const ACTIVE=new Set(['SUBMITTING','PENDING','THROTTLED','RUNNING','SAVING']);
const PHOTO_TYPES=new Set(['image/jpeg','image/png','image/webp']);
const MAX_INPUT=16*1024*1024,MAX_VIDEO=90*1024*1024;
export const FAMILY_AI_PROMPT="The people in this archival family photograph gently come to life with natural blinking, subtle breathing and small warm smiles. Preserve each person's facial features, age, clothing, the original composition and monochrome or vintage tones. Fixed camera. Gentle realistic motion. No speaking, no new people or objects, no scene changes.";
const ERRORS={
  PROVIDER_AUTH:'שירות יצירת הסרטונים אינו מחובר כרגע. יש לבדוק את חיבור השירות.',
  PROVIDER_CREDITS:'אין כרגע יתרה זמינה ליצירת סרטונים. אפשר לנסות שוב לאחר חידוש היתרה.',
  PROVIDER_BUSY:'שירות יצירת הסרטונים עמוס כרגע. אפשר לנסות שוב מאוחר יותר.',
  GENERATION_FAILED:'לא ניתן היה ליצור סרטון מהתמונה הזאת. אפשר לנסות שוב.',
  SUBMISSION_UNCERTAIN:'אישור הבקשה עדיין לא התקבל. לא נשלח בקשה נוספת כדי למנוע חיוב כפול.',
  OUTPUT_SAVE_FAILED:'הסרטון נוצר, אך השמירה טרם הושלמה. השמירה תתחדש אוטומטית.',
  SOURCE_CHANGED:'התמונה נערכה מאז תחילת היצירה. הסרטון מתייחס לגרסה הקודמת.'
};
function secret(env,name){return typeof env[name]==='string'?env[name].trim():'';}
export function familyAiConfig(env){
  const reason=!secret(env,'RUNWAYML_API_SECRET')?'provider-not-configured':secret(env,'FAMILY_AI_ACCESS_CODE').length<8?'access-code-not-configured':!configured(env)?'storage-not-configured':'ready';
  return {enabled:reason==='ready',reason,status:reason,duration:10,provider:'runway',requiresAccessCode:true,estimatedCostUsd:0.5};
}
export function familyAiJob(job){
  if(!job)return null;
  return {id:job.id,status:job.status,revision:job.revision,progress:Number.isFinite(job.progress)?Math.max(0,Math.min(1,job.progress)):0,createdAt:job.createdAt,updatedAt:job.updatedAt,duration:10,errorCode:job.errorCode||null,error:ERRORS[job.errorCode]||null,videoSrc:job.status==='SUCCEEDED'&&job.video?'/api/family-ai/video/'+job.id:null};
}
export function familyAiRatio(width,height){
  const ratios=['1280:720','720:1280','1104:832','832:1104','960:960','1584:672'];
  const desired=Number(width)>0&&Number(height)>0?Number(width)/Number(height):1104/832;
  return ratios.reduce((best,ratio)=>{const [w,h]=ratio.split(':').map(Number),[bw,bh]=best.split(':').map(Number);return Math.abs(Math.log(desired/(w/h)))<Math.abs(Math.log(desired/(bw/bh)))?ratio:best;});
}
function photoId(value){if(typeof value!=='string'||!/^[a-f0-9]{32}$/.test(value))throw new HttpError(400,'בחרו תמונה תקינה.','FAMILY_AI_PHOTO');return value;}
function photoSource(item){
  if((item.kind||(item.mime?.startsWith('image/')?'photo':''))!=='photo'||item.provider)throw new HttpError(400,'אפשר להחיות תמונות בלבד.','FAMILY_AI_PHOTO');
  if(PHOTO_TYPES.has(item.mime)&&item.size>0&&item.size<=MAX_INPUT)return {item,variant:'original'};
  const preview=item.preview;
  if(preview&&preview.revision===(item.photoRevision||'original')&&PHOTO_TYPES.has(preview.mime)&&preview.size>0&&preview.size<=MAX_INPUT)return {item:{...item,...preview},variant:'preview'};
  throw new HttpError(400,'יש להכין עותק JPG קטן יותר של התמונה לפני יצירת הסרטון.','FAMILY_AI_IMAGE_RESIZE');
}
function inputData(value){
  if(value===undefined)return null;
  if(typeof value!=='string'||value.length>5_000_000)throw new HttpError(413,'התמונה גדולה מדי. יש לבחור תמונה קטנה יותר.','FAMILY_AI_IMAGE_RESIZE');
  const match=/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if(!match||match[2].length%4!==0)throw new HttpError(400,'נתוני התמונה אינם תקינים.','FAMILY_AI_PHOTO');
  let head;try{head=atob(match[2].slice(0,128));}catch{throw new HttpError(400,'נתוני התמונה אינם תקינים.','FAMILY_AI_PHOTO');}
  const valid=match[1]==='image/jpeg'?head.startsWith('\xff\xd8\xff'):match[1]==='image/png'?head.startsWith('\x89PNG\r\n\x1a\n'):head.startsWith('RIFF')&&head.slice(8,12)==='WEBP';
  if(!valid)throw new HttpError(400,'נתוני התמונה אינם תקינים.','FAMILY_AI_PHOTO');
  return value;
}
async function sourceSignature(env,id,revision,variant,expires){return hex(await hmac(secret(env,'RUNWAYML_API_SECRET'),[id,revision,variant,expires].join('|')));}
async function promptImage(request,env,item,data){
  if(data)return data;
  const source=photoSource(item),revision=item.photoRevision||'original',expires=String(Math.floor(Date.now()/1000)+3600),url=new URL('/api/family-ai/source/'+item.id,request.url);
  for(const [key,value]of Object.entries({revision,variant:source.variant,expires,signature:await sourceSignature(env,item.id,revision,source.variant,expires)}))url.searchParams.set(key,value);
  return url.href;
}
function providerHeaders(env){return {'Authorization':'Bearer '+secret(env,'RUNWAYML_API_SECRET'),'X-Runway-Version':VERSION,'Content-Type':'application/json'};}
function providerError(status){return status===401||status===403?'PROVIDER_AUTH':status===402?'PROVIDER_CREDITS':status===429||status>=500?'PROVIDER_BUSY':'GENERATION_FAILED';}
function dailyLimit(env){const value=Number(env.FAMILY_AI_DAILY_LIMIT||20);return Number.isInteger(value)&&value>=1&&value<=100?value:20;}
async function patch(db,job,values,releasePoll=false){return db('family-ai.job.update',{id:job.id,claimId:job.claimId,...(job.pollToken?{pollToken:job.pollToken}:{}),...(releasePoll?{releasePoll:true}:{}),patch:values});}
function resultJob(result,fallback){return result?.job||fallback;}
async function submit(request,env,db,body,fetcher){
  if(!familyAiConfig(env).enabled)throw new HttpError(503,'יצירת הסרטונים עדיין אינה מחוברת.','FAMILY_AI_NOT_CONFIGURED');
  if(!equal(typeof body.accessCode==='string'?body.accessCode:'',secret(env,'FAMILY_AI_ACCESS_CODE')))throw new HttpError(403,'קוד היצירה אינו נכון.','FAMILY_AI_ACCESS_CODE');
  const id=photoId(body.id),item=await db('media.get',{id}),data=inputData(body.imageData);
  if(!data)photoSource(item);
  if((item.kind||(item.mime?.startsWith('image/')?'photo':''))!=='photo'||item.provider)throw new HttpError(400,'אפשר להחיות תמונות בלבד.','FAMILY_AI_PHOTO');
  const revision=item.photoRevision||'original',image=await promptImage(request,env,item,data),claimId=uid();
  const claim=await db('family-ai.job.claim',{id,revision,claimId,dailyLimit:dailyLimit(env),retry:body.retry===true});
  let job=claim.job;
  if(!claim.claimed)return json({job:familyAiJob(job),reused:true},200);
  let response;
  try{response=await fetcher(API+'/image_to_video',{method:'POST',headers:providerHeaders(env),body:JSON.stringify({model:'gen4_turbo',promptImage:image,promptText:FAMILY_AI_PROMPT,ratio:familyAiRatio(body.width,body.height),duration:10}),signal:AbortSignal.timeout(25000)});}
  catch{job=resultJob(await patch(db,job,{errorCode:'SUBMISSION_UNCERTAIN'}),job);return json({job:familyAiJob(job),reused:false},202);}
  if(!response.ok){await response.body?.cancel();job=resultJob(await patch(db,job,{status:'FAILED',errorCode:providerError(response.status)}),job);return json({job:familyAiJob(job),reused:false},202);}
  let result;try{result=await response.json();}catch{}
  if(!result||typeof result.id!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(result.id)){job=resultJob(await patch(db,job,{errorCode:'SUBMISSION_UNCERTAIN'}),job);return json({job:familyAiJob(job),reused:false},202);}
  const values={taskId:result.id,status:'PENDING',errorCode:null};
  try{job=resultJob(await patch(db,job,values),job);}catch{job=resultJob(await patch(db,job,values),job);}
  return json({job:familyAiJob(job),reused:false},202);
}
async function outputVideo(response,env,db,ctx,job,fetcher){
  const output=response.output?.[0];let remote;
  try{remote=new URL(output);if(remote.protocol!=='https:'||remote.username||remote.password||remote.port||!remote.hostname.includes('.')||/^(?:\d|localhost)/i.test(remote.hostname))throw Error();}
  catch{throw new HttpError(502,'הסרטון לא התקבל במלואו.','OUTPUT_SAVE_FAILED');}
  const source=await fetcher(remote.href,{signal:AbortSignal.timeout(25000)}),size=Number(source.headers.get('Content-Length'));
  if(!source.ok||!source.body||!Number.isSafeInteger(size)||size<=0||size>MAX_VIDEO||!/^video\/mp4(?:;|$)/i.test(source.headers.get('Content-Type')||'')){await source.body?.cancel();throw new HttpError(502,'הסרטון לא התקבל במלואו.','OUTPUT_SAVE_FAILED');}
  const key='family-ai/'+job.id+'/'+job.claimId+'.mp4';
  let stream=source.body,transfer=Promise.resolve();
  if(typeof FixedLengthStream!=='undefined'){const fixed=new FixedLengthStream(size);transfer=stream.pipeTo(fixed.writable);stream=fixed.readable;transfer.catch(()=>{});}
  // A retry reuses this object's key. Never schedule a delayed deletion after
  // an ambiguous upload failure: it could erase a later successful retry.
  const storageFetch=(input,options={})=>fetcher(input instanceof Request?new Request(input,{signal:AbortSignal.timeout(60000)}):input,{...options,signal:AbortSignal.timeout(60000)});
  await Promise.all([putObject(env,key,stream,size,'video/mp4',storageFetch),transfer]);
  // A database response can be lost after a successful commit. Keep the
  // deterministic object on ambiguous errors so a completed clip is never deleted.
  const saved=await patch(db,job,{status:'SUCCEEDED',progress:1,errorCode:null,video:{key,size,mime:'video/mp4',kind:'video',duration:10}},true);
  if(saved.updated===false&&saved.job?.claimId!==job.claimId&&saved.job?.video?.key!==key)ctx.waitUntil(deleteObject(env,key,fetcher).catch(()=>{}));
  return resultJob(saved,job);
}
async function advance(env,db,ctx,job,fetcher){
  if(!job||!ACTIVE.has(job.status)||!job.taskId||!secret(env,'RUNWAYML_API_SECRET'))return job;
  const lease=await db('family-ai.job.poll',{id:job.id,claimId:job.claimId});job=lease.job||job;if(!lease.poll)return job;
  let response;
  try{response=await fetcher(API+'/tasks/'+encodeURIComponent(job.taskId),{headers:providerHeaders(env),signal:AbortSignal.timeout(20000)});}catch{return resultJob(await patch(db,job,{},true),job);}
  if(!response.ok){await response.body?.cancel();if([401,402,403].includes(response.status))return resultJob(await patch(db,job,{errorCode:providerError(response.status)},true),job);return resultJob(await patch(db,job,{},true),job);}
  let detail;try{detail=await response.json();}catch{return resultJob(await patch(db,job,{},true),job);}
  if(detail.status==='SUCCEEDED'){
    const saving=await patch(db,job,{status:'SAVING',progress:1,errorCode:null});if(saving.updated===false)return resultJob(saving,job);job=resultJob(saving,job);
    try{return await outputVideo(detail,env,db,ctx,job,fetcher);}catch{return resultJob(await patch(db,job,{status:'SAVING',errorCode:'OUTPUT_SAVE_FAILED'},true),job);}
  }
  if(['FAILED','CANCELED','CANCELLED'].includes(detail.status))return resultJob(await patch(db,job,{status:'FAILED',errorCode:'GENERATION_FAILED'},true),job);
  if(['PENDING','THROTTLED','RUNNING'].includes(detail.status))return resultJob(await patch(db,job,{status:detail.status,errorCode:null,progress:Number.isFinite(detail.progress)?Math.max(0,Math.min(1,detail.progress)):job.progress||0},true),job);
  return resultJob(await patch(db,job,{},true),job);
}
export async function familyAiTick(env,db,ctx,fetcher=fetch){
  if(!secret(env,'RUNWAYML_API_SECRET')||!configured(env))return;
  const {jobs}=await db('family-ai.job.pending');
  // Bound parallel transfers while fitting the existing scheduled Worker budget.
  for(let index=0;index<(jobs||[]).length;index+=4)await Promise.allSettled(jobs.slice(index,index+4).map(job=>advance(env,db,ctx,job,fetcher)));
}
export async function familyAiRoute(request,env,db,ctx,fetcher=fetch){
  const url=new URL(request.url),path=url.pathname;
  if(path==='/api/family-ai/config'&&request.method==='GET')return json(familyAiConfig(env));
  if(path==='/api/family-ai/generate'&&request.method==='POST'){const body=await readJSON(request,5_100_000),task=submit(request,env,db,body,fetcher);ctx.waitUntil(task.then(()=>{},()=>{}));return task;}
  let match;
  if((match=/^\/api\/family-ai\/jobs\/([a-f0-9]{32})$/.exec(path))&&request.method==='GET'){
    await db('media.get',{id:match[1]});const {job}=await db('family-ai.job.get',{id:match[1]});
    const task=advance(env,db,ctx,job,fetcher);ctx.waitUntil(task.then(()=>{},()=>{}));return json({job:familyAiJob(await task)});
  }
  if((match=/^\/api\/family-ai\/video\/([a-f0-9]{32})$/.exec(path))&&['GET','HEAD'].includes(request.method)){
    await db('media.get',{id:match[1]});const {job}=await db('family-ai.job.get',{id:match[1]});
    if(job?.status!=='SUCCEEDED'||!job.video)throw new HttpError(404,'הסרטון עדיין אינו זמין.','FAMILY_AI_VIDEO');
    const response=await getObject(env,{...job.video,filename:'family-memory-'+match[1]+'.mp4'},request,fetcher),headers=new Headers(response.headers);
    if(url.searchParams.get('download')==='1')headers.set('Content-Disposition','attachment; filename="family-memory-'+match[1]+'.mp4"');
    return new Response(response.body,{status:response.status,headers});
  }
  if((match=/^\/api\/family-ai\/source\/([a-f0-9]{32})$/.exec(path))&&['GET','HEAD'].includes(request.method)){
    const id=match[1],revision=url.searchParams.get('revision')||'',variant=url.searchParams.get('variant')||'',expires=url.searchParams.get('expires')||'',signature=url.searchParams.get('signature')||'';
    if(!secret(env,'RUNWAYML_API_SECRET')||!/^\d{10}$/.test(expires)||Number(expires)<Date.now()/1000||Number(expires)>Date.now()/1000+7200||!equal(signature,await sourceSignature(env,id,revision,variant,expires)))throw new HttpError(403,'קישור התמונה אינו זמין.','FAMILY_AI_SOURCE');
    const item=await db('media.get',{id});if((item.photoRevision||'original')!==revision)throw new HttpError(409,'התמונה נערכה בינתיים.','FAMILY_AI_SOURCE');
    const source=photoSource(item);if(source.variant!==variant)throw new HttpError(409,'התמונה השתנתה בינתיים.','FAMILY_AI_SOURCE');
    const response=await getObject(env,source.item,new Request(request.url,{method:request.method}),fetcher),headers=new Headers(response.headers);headers.set('Content-Length',String(source.item.size));headers.set('Cache-Control','private, no-store');
    return new Response(response.body,{status:response.status,headers});
  }
  throw new HttpError(404,'הפעולה לא נמצאה.');
}
