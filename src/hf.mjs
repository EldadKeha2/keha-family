import {HttpError,hmac,sha256,hex} from './http.mjs';
const encode=value=>encodeURIComponent(value).replace(/[!'()*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase());
export function configured(env){return ['HF_NAMESPACE','HF_BUCKET','HF_ACCESS_KEY_ID','HF_SECRET_ACCESS_KEY'].every(key=>typeof env[key]==='string'&&env[key].trim());}
export async function signedRequest(env,key,{method='GET',body=null,headers={},size=null,query={},now=new Date()}={}){
  if(!configured(env))throw new HttpError(503,'יש להשלים את חיבור האחסון כדי להעלות ולצפות בקבצים.');
  if(!/^[A-Za-z0-9_-]+$/.test(env.HF_NAMESPACE)||!/^[A-Za-z0-9_.-]+$/.test(env.HF_BUCKET)||key.split('/').some(p=>!p||p==='.'||p==='..'||/[\\\x00]/.test(p)))throw new HttpError(500,'הגדרת האחסון אינה תקינה.');
  const path='/'+[env.HF_NAMESPACE,env.HF_BUCKET,...key.split('/')].map(encode).join('/');
  const date=now.toISOString().replace(/[:-]|\.\d{3}/g,''),day=date.slice(0,8),scope=day+'/us-east-1/s3/aws4_request';
  const values=new Headers(headers);values.set('host','s3.hf.co');values.set('x-amz-date',date);values.set('x-amz-content-sha256','UNSIGNED-PAYLOAD');
  if(size!==null)values.set('Content-Length',String(size));
  const names=['host','x-amz-content-sha256','x-amz-date'];
  const canonical=names.map(name=>name+':'+values.get(name).trim()+'\n').join('');
  const search=Object.entries(query).map(([key,value])=>[encode(key),encode(String(value))]).sort(([a,av],[b,bv])=>a<b?-1:a>b?1:av<bv?-1:av>bv?1:0).map(([key,value])=>key+'='+value).join('&');
  const request=[method,path,search,canonical,names.join(';'),'UNSIGNED-PAYLOAD'].join('\n');
  const toSign=['AWS4-HMAC-SHA256',date,scope,await sha256(request)].join('\n');
  const kDate=await hmac('AWS4'+env.HF_SECRET_ACCESS_KEY,day),kRegion=await hmac(kDate,'us-east-1'),kService=await hmac(kRegion,'s3'),kSigning=await hmac(kService,'aws4_request');
  values.set('Authorization',`AWS4-HMAC-SHA256 Credential=${env.HF_ACCESS_KEY_ID}/${scope}, SignedHeaders=${names.join(';')}, Signature=${hex(await hmac(kSigning,toSign))}`);
  values.delete('host');
  return new Request('https://s3.hf.co'+path+(search?'?'+search:''),{method,headers:values,body,redirect:'manual',...(body instanceof ReadableStream?{duplex:'half'}:{})});
}

const unxml=value=>value.replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
const xml=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
function xmlValue(body,tag){const match=new RegExp('<'+tag+'(?:\\s[^>]*)?>([\\s\\S]*?)</'+tag+'>').exec(body);return match?unxml(match[1].trim()):null;}
async function multipartXML(env,key,options,fetcher){
  const response=await fetcher(await signedRequest(env,key,options));
  const body=await response.text();
  // S3 may return an Error document after sending a 200 status.
  if(!response.ok||/<Error(?:\s|>)/.test(body))throw new HttpError(502,'האחסון לא אישר את העלאת הסרטון. אפשר לנסות שוב.','VIDEO_STORAGE_FAILED');
  return body;
}
export async function createMultipartUpload(env,key,mime,fetcher=fetch){
  const body=await multipartXML(env,key,{method:'POST',query:{uploads:''},headers:{'Content-Type':mime},size:0},fetcher);
  const uploadId=xmlValue(body,'UploadId');
  if(!uploadId||uploadId.length>2048)throw new HttpError(502,'האחסון לא התחיל את העלאת הסרטון. נסו שוב.');
  return uploadId;
}
export async function uploadMultipartPart(env,key,uploadId,partNumber,bytes,fetcher=fetch){
  const response=await fetcher(await signedRequest(env,key,{method:'PUT',query:{uploadId,partNumber},body:bytes,size:bytes.byteLength,headers:{'Content-Type':'application/octet-stream'}}));
  const etag=response.headers.get('ETag');await response.body?.cancel();
  if(!response.ok||!etag)throw new HttpError(502,'חלק מהסרטון לא נשמר. אפשר לנסות שוב.','VIDEO_PART_FAILED');
  return etag;
}
export async function listMultipartParts(env,key,uploadId,fetcher=fetch){
  const body=await multipartXML(env,key,{query:{uploadId}},fetcher);
  if(xmlValue(body,'IsTruncated')==='true')throw new HttpError(502,'לא התקבלה רשימת חלקים מלאה. נסו שוב.');
  return [...body.matchAll(/<Part(?:\s[^>]*)?>([\s\S]*?)<\/Part>/g)].map(([,part])=>({number:Number(xmlValue(part,'PartNumber')),size:Number(xmlValue(part,'Size')),etag:xmlValue(part,'ETag')}));
}
export async function completeMultipartUpload(env,key,uploadId,parts,fetcher=fetch){
  const body='<CompleteMultipartUpload>'+parts.map(part=>'<Part><PartNumber>'+part.number+'</PartNumber><ETag>'+xml(part.etag)+'</ETag></Part>').join('')+'</CompleteMultipartUpload>';
  const result=await multipartXML(env,key,{method:'POST',query:{uploadId},body,size:new TextEncoder().encode(body).byteLength,headers:{'Content-Type':'application/xml'}},fetcher);
  if(!/<CompleteMultipartUploadResult(?:\s|>)/.test(result))throw new HttpError(502,'לא התקבל אישור להשלמת הסרטון. נסו שוב.');
}
export async function abortMultipartUpload(env,key,uploadId,fetcher=fetch){
  const response=await fetcher(await signedRequest(env,key,{method:'DELETE',query:{uploadId}}));await response.body?.cancel();
  if(!response.ok&&response.status!==404)throw new HttpError(502,'לא ניתן לבטל את העלאת הסרטון כרגע.');
}
export async function putObject(env,key,body,size,mime,fetcher=fetch){
  const response=await fetcher(await signedRequest(env,key,{method:'PUT',body,size,headers:{'Content-Type':mime}}));
  if(!response.ok){await response.body?.cancel();throw new HttpError(502,'האחסון לא אישר את השמירה. בדקו את הגדרות החיבור ונסו שוב.');}
  await response.body?.cancel();
}
export async function deleteObject(env,key,fetcher=fetch){const response=await fetcher(await signedRequest(env,key,{method:'DELETE'}));await response.body?.cancel();}
export async function getObject(env,item,request,fetcher=fetch){
  const method=request.method==='HEAD'?'HEAD':'GET',headers={};
  // Only public photo responses use the browser's private cache. Trash previews
  // and documents keep their existing no-store policy. Keys identify pixels,
  // so edits and restored versions receive the correct validator.
  const cachePhoto=(item.kind||(item.mime?.startsWith('image/')?'photo':null))==='photo'&&new URL(request.url).pathname.startsWith('/media/');
  const etag=cachePhoto?'"photo-'+await sha256(item.key+'|'+item.size+'|'+item.mime)+'"':null;
  const cacheControl=cachePhoto?'private, max-age=300, must-revalidate':'private, no-store';
  if(etag&&!request.headers.has('Range')&&request.headers.get('If-None-Match')?.split(',').some(value=>value.trim().replace(/^W\//,'')===etag||value.trim()==='*'))return new Response(null,{status:304,headers:{ETag:etag,'Cache-Control':cacheControl}});
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
  const output=new Headers({'Content-Type':item.mime,'Cache-Control':cacheControl,'X-Content-Type-Options':'nosniff','Accept-Ranges':'bytes'});
  for(const name of ['Content-Length','Content-Range','ETag','Last-Modified'])if(response.headers.has(name))output.set(name,response.headers.get(name));
  if(etag)output.set('ETag',etag);
  if(item.category==='attachment'||item.kind==='document'){const inline=new URL(request.url).searchParams.get('inline')==='1'&&/^(application\/pdf|text\/plain|text\/markdown|image\/(jpeg|png|webp|gif|avif))$/.test(item.mime);output.set('Content-Disposition',`${inline?'inline':'attachment'}; filename*=UTF-8''${encode(item.filename)}`);output.set('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'self'");}
  return new Response(method==='HEAD'?null:response.body,{status:response.status,headers:output});
}
