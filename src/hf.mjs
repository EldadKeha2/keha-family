import {HttpError,hmac,sha256,hex} from './http.mjs';
const encode=value=>encodeURIComponent(value).replace(/[!'()*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase());
export function configured(env){return ['HF_NAMESPACE','HF_BUCKET','HF_ACCESS_KEY_ID','HF_SECRET_ACCESS_KEY'].every(key=>typeof env[key]==='string'&&env[key].trim());}
export async function signedRequest(env,key,{method='GET',body=null,headers={},size=null,now=new Date()}={}){
  if(!configured(env))throw new HttpError(503,'יש להשלים את חיבור האחסון כדי להעלות ולצפות בקבצים.');
  if(!/^[A-Za-z0-9_-]+$/.test(env.HF_NAMESPACE)||!/^[A-Za-z0-9_.-]+$/.test(env.HF_BUCKET)||key.split('/').some(p=>!p||p==='.'||p==='..'||/[\\\x00]/.test(p)))throw new HttpError(500,'הגדרת האחסון אינה תקינה.');
  const path='/'+[env.HF_NAMESPACE,env.HF_BUCKET,...key.split('/')].map(encode).join('/');
  const date=now.toISOString().replace(/[:-]|\.\d{3}/g,''),day=date.slice(0,8),scope=day+'/us-east-1/s3/aws4_request';
  const values=new Headers(headers);values.set('host','s3.hf.co');values.set('x-amz-date',date);values.set('x-amz-content-sha256','UNSIGNED-PAYLOAD');
  if(size!==null)values.set('Content-Length',String(size));
  const names=['host','x-amz-content-sha256','x-amz-date'];
  const canonical=names.map(name=>name+':'+values.get(name).trim()+'\n').join('');
  const request=[method,path,'',canonical,names.join(';'),'UNSIGNED-PAYLOAD'].join('\n');
  const toSign=['AWS4-HMAC-SHA256',date,scope,await sha256(request)].join('\n');
  const kDate=await hmac('AWS4'+env.HF_SECRET_ACCESS_KEY,day),kRegion=await hmac(kDate,'us-east-1'),kService=await hmac(kRegion,'s3'),kSigning=await hmac(kService,'aws4_request');
  values.set('Authorization',`AWS4-HMAC-SHA256 Credential=${env.HF_ACCESS_KEY_ID}/${scope}, SignedHeaders=${names.join(';')}, Signature=${hex(await hmac(kSigning,toSign))}`);
  values.delete('host');
  return new Request('https://s3.hf.co'+path,{method,headers:values,body,redirect:'manual',...(body instanceof ReadableStream?{duplex:'half'}:{})});
}
export async function putObject(env,key,body,size,mime,fetcher=fetch){
  const response=await fetcher(await signedRequest(env,key,{method:'PUT',body,size,headers:{'Content-Type':mime}}));
  if(!response.ok){await response.body?.cancel();throw new HttpError(502,'האחסון לא אישר את השמירה. בדקו את הגדרות החיבור ונסו שוב.');}
  await response.body?.cancel();
}
export async function deleteObject(env,key,fetcher=fetch){const response=await fetcher(await signedRequest(env,key,{method:'DELETE'}));await response.body?.cancel();}
export async function getObject(env,item,request,fetcher=fetch){
  const method=request.method==='HEAD'?'HEAD':'GET',headers={};
  const range=request.headers.get('Range');if(range)headers.Range=range;
  let response=await fetcher(await signedRequest(env,item.key,{method,headers}));
  if([301,302,307,308].includes(response.status)){
    const location=response.headers.get('Location');await response.body?.cancel();
    let url;try{url=new URL(location);}catch{throw new HttpError(502,'הקובץ אינו זמין כרגע.');}
    if(url.protocol!=='https:')throw new HttpError(502,'הקובץ אינו זמין כרגע.');
    // Follow the signed CDN URL without forwarding the storage Authorization header.
    response=await fetcher(new Request(url,{method,headers,redirect:'follow'}));
  }
  if(!response.ok&&![304,416].includes(response.status)){await response.body?.cancel();throw new HttpError(response.status===404?404:502,'הקובץ אינו זמין כרגע.');}
  const output=new Headers({'Content-Type':item.mime,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Accept-Ranges':'bytes'});
  for(const name of ['Content-Length','Content-Range','ETag','Last-Modified'])if(response.headers.has(name))output.set(name,response.headers.get(name));
  if(item.category==='attachment'||item.kind==='document'){const inline=new URL(request.url).searchParams.get('inline')==='1'&&/^(application\/pdf|text\/plain|text\/markdown|image\/(jpeg|png|webp|gif|avif))$/.test(item.mime);output.set('Content-Disposition',`${inline?'inline':'attachment'}; filename*=UTF-8''${encode(item.filename)}`);output.set('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'self'");}
  return new Response(method==='HEAD'?null:response.body,{status:response.status,headers:output});
}
