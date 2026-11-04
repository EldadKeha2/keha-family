export class HttpError extends Error {
  constructor(status,message,code=null){super(message);this.status=status;this.code=code;}
}
export const utf8=new TextEncoder();
export const hex=bytes=>Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
export const uid=()=>crypto.randomUUID().replaceAll('-','');
export const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const sha256=async value=>hex(await crypto.subtle.digest('SHA-256',typeof value==='string'?utf8.encode(value):value));
export async function hmac(key,value){
  const imported=await crypto.subtle.importKey('raw',typeof key==='string'?utf8.encode(key):key,{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC',imported,utf8.encode(value)));
}
export function equal(a,b){
  if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;
  let difference=0;for(let i=0;i<a.length;i++)difference|=a.charCodeAt(i)^b.charCodeAt(i);return difference===0;
}
export function json(value,status=200,headers={}){
  return new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
}
export function isDailyStorageLimit(error){
  return error?.code==='DAILY_STORAGE_LIMIT'||/(?:rows? read|rows? written).*(?:limit|quota)|(?:sql|sqlite|storage|durable object).*(?:daily|per day|free tier).*(?:limit|quota)|(?:daily|per day).*(?:read|write).*(?:limit|quota)|(?:exceeded|exceeds).*(?:reads?|writes?).*(?:daily|per day)/i.test(String(error?.message||''));
}
// Public diagnostics are fixed categories, never raw exceptions, records or credentials.
export function stateFailure(error,initializing=false){
  const message=String(error?.message||'');let code=initializing?'STATE_INITIALIZATION_FAILED':'STATE_UNREACHABLE';
  if(isDailyStorageLimit(error))code='DAILY_STORAGE_LIMIT';
  else if(/SQLITE_FULL|database or disk is full/i.test(message))code='STATE_STORAGE_FULL';
  else if(/no such (?:table|column)|has no column|syntax error/i.test(message))code='STATE_SCHEMA_ERROR';
  else if(error instanceof SyntaxError)code='STATE_INVALID_DATA';
  else if(initializing&&error instanceof HttpError&&error.status===404)code='STATE_REFERENCE_ERROR';
  else if(/exceeded.*CPU|CPU.*(?:limit|exceeded)/i.test(message))code='STATE_CPU_LIMIT';
  else if(/exceeded.*memory|memory.*(?:limit|exceeded)/i.test(message))code='STATE_MEMORY_LIMIT';
  else if(error?.overloaded)code='STATE_OVERLOADED';
  else if(/namespace.*(?:not found|not exist)|not bound|binding.*(?:missing|not found)/i.test(message))code='STATE_BINDING_ERROR';
  return new HttpError(503,'לא ניתן להשלים את הפעולה כרגע. נסו שוב.',code);
}
export function fail(error){
  if(isDailyStorageLimit(error))return json({error:'מכסת השימוש היומית מוצתה. נסו שוב לאחר איפוס המכסה.',code:'DAILY_STORAGE_LIMIT'},503,{'X-Family-Storage-Limit':'daily'});
  const handled=error instanceof HttpError,retryAfter=handled&&Number.isInteger(error.retryAfter)&&error.retryAfter>0?error.retryAfter:0;
  return json({error:handled?error.message:'לא ניתן להשלים את הפעולה כרגע. נסו שוב.',...(handled&&error.code?{code:error.code}:{}),...(retryAfter?{retryAfter}:{})},handled?error.status:500,{
    ...(handled&&error.code?.startsWith('UPDATES_')?{'X-Family-Service-Error':'updates'}:{}),...(retryAfter?{'Retry-After':String(retryAfter)}:{})
  });
}
export function text(value,label,max,required=false){
  if(typeof value!=='string')throw new HttpError(400,`${label}: יש להזין טקסט.`);
  value=value.trim();if((required&&!value)||value.length>max)throw new HttpError(400,`${label}: יש להזין ${required?'טקסט ועד':'עד'} ${max.toLocaleString('en-US')} תווים.`);
  return value;
}
export function calendarDate(value,label='תאריך'){
  if(typeof value!=='string')throw new HttpError(400,`יש להזין ${label}.`);
  const m=/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/.exec(value.trim());
  if(!m)throw new HttpError(400,`יש להזין ${label} תקין.`);
  const [d,mn,y]=m.slice(1).map(Number),date=new Date(Date.UTC(y,mn-1,d));
  const now=new Date(),today=Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate());
  if(y<1000||date.getUTCFullYear()!==y||date.getUTCMonth()!==mn-1||date.getUTCDate()!==d||date.getTime()>today)throw new HttpError(400,'יש להזין תאריך אמיתי שאינו בעתיד.');
  return `${d}.${mn}.${y}`;
}
export function birthday(value){
  if(typeof value!=='string')throw new HttpError(400,'יש להזין תאריך לידה.');
  if(value.trim()===''||value==='1.1.1111')return '1.1.1111';
  return calendarDate(value,'תאריך לידה');
}
export async function readJSON(request,max=1_000_000){
  const buffer=await boundedBody(request,max);
  try{const body=JSON.parse(new TextDecoder().decode(buffer));if(!body||typeof body!=='object'||Array.isArray(body))throw Error();return body;}
  catch{throw new HttpError(400,'הנתונים אינם תקינים.');}
}
export async function boundedBody(request,max){
  const declared=request.headers.get('Content-Length');
  if(declared!==null&&Number(declared)>max)throw new HttpError(413,'התוכן גדול מדי.');
  const reader=request.body?.getReader();if(!reader)return new Uint8Array();
  let length=0;const chunks=[];
  try{while(true){const {value,done}=await reader.read();if(done)break;length+=value.byteLength;if(length>max){await reader.cancel();throw new HttpError(413,'התוכן גדול מדי.');}chunks.push(value);}}
  finally{reader.releaseLock();}
  const result=new Uint8Array(length);let offset=0;for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.byteLength;}return result;
}
export function checkOrigin(request){
  const origin=request.headers.get('Origin');
  if(origin&&origin!==new URL(request.url).origin)throw new HttpError(403,'לא ניתן לשמור שינוי ממקור חיצוני.');
  if(request.headers.get('Sec-Fetch-Site')==='cross-site')throw new HttpError(403,'לא ניתן לשמור שינוי ממקור חיצוני.');
}
