import {HttpError,json,readJSON} from './http.mjs';
import {getObject} from './hf.mjs';
import {TRASH_SESSION_SECONDS} from './recycle-access.mjs';
const COOKIE='__Host-FamilyTrash';
const cookie=(token,age)=>`${COOKIE}=${token}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${age}`;
export async function recycleRoute(request,env,db){
  const url=new URL(request.url),path=url.pathname,session=request.headers.get('Cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith(COOKIE+'='))?.slice(COOKIE.length+1)||'';
  if(path==='/api/trash/setup'&&request.method==='POST'){const body=await readJSON(request,2048);return json(await db('trash.setup',{setupKey:body.setupKey,password:body.password}));}
  if(path==='/api/trash/login'&&request.method==='POST'){
    const body=await readJSON(request,2048),result=await db('trash.login',{password:body.password,client:request.headers.get('CF-Connecting-IP')||'unknown'});
    return json({unlocked:true,expires:result.expires},200,{'Set-Cookie':cookie(result.token,TRASH_SESSION_SECONDS)});
  }
  if(path==='/api/trash/logout'&&request.method==='POST'){
    const result=await db('trash.logout',{session});return json(result,200,{'Set-Cookie':cookie('',0)});
  }
  if(path==='/api/trash'&&request.method==='GET')return json(await db('trash.list',{session,page:url.searchParams.get('page'),kind:url.searchParams.get('kind'),query:url.searchParams.get('q')}));
  const match=/^\/api\/trash\/([a-f0-9]{32})\/(file|restore)$/.exec(path);
  if(match?.[2]==='restore'&&request.method==='POST')return json(await db('trash.restore',{session,id:match[1]}));
  if(match?.[2]==='file'&&['GET','HEAD'].includes(request.method)){
    const {item}=await db('trash.get',{session,id:match[1]});if(!item.key)throw new HttpError(404,'אין קובץ לתצוגה מקדימה.');
    const response=await getObject(env,item,request),headers=new Headers(response.headers);
    headers.set('Vary','Cookie');headers.set('Cross-Origin-Resource-Policy','same-origin');headers.set('Referrer-Policy','no-referrer');
    return new Response(response.body,{status:response.status,headers});
  }
  throw new HttpError(404,'הפעולה לא נמצאה.');
}
