import {HttpError,utf8,hex,hmac,sha256,equal,escapeHTML,uid,checkOrigin,boundedBody} from './http.mjs';
const COOKIE='family_session',AGE=7*24*60*60;
const passwordKey=async env=>sha256('keha-family-session-v1\0'+env.FAMILY_PASSWORD);
export async function makeSession(env,now=Math.floor(Date.now()/1000)){
  const content=`v1.${now+AGE}.${uid()}`;return content+'.'+hex(await hmac(await passwordKey(env),content));
}
export async function session(request,env,now=Math.floor(Date.now()/1000)){
  if(!env.FAMILY_PASSWORD)return null;
  const token=(request.headers.get('Cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
  if(!token)return null;
  const match=/^(v1\.([0-9]+)\.[a-f0-9]{32})\.([a-f0-9]{64})$/.exec(token);
  if(!match||Number(match[2])<=now||Number(match[2])>now+AGE)return null;
  if(!equal(match[3],hex(await hmac(await passwordKey(env),match[1]))))return null;
  return {token,csrf:hex(await hmac(await passwordKey(env),'csrf:'+token))};
}
export function requireWrite(request,current){checkOrigin(request);if(!equal(request.headers.get('X-Family-Token'),current.csrf))throw new HttpError(403,'יש לרענן את האתר לפני שמירת השינוי.');}
export function cookie(token){return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${token?AGE:0}`;}
export async function login(request,env,db){
  checkOrigin(request);
  if(!env.FAMILY_PASSWORD||env.FAMILY_PASSWORD.length<10)throw new HttpError(503,'צריך להשלים את הגדרת הכניסה לאתר.');
  const body=new URLSearchParams(new TextDecoder().decode(await boundedBody(request,4096)));
  const ip=await sha256((request.headers.get('CF-Connecting-IP')||'unknown')+':'+await passwordKey(env));
  await db('login.attempt',{ip});
  if(!equal(await sha256(body.get('password')||''),await sha256(env.FAMILY_PASSWORD)))return loginPage('הסיסמה אינה מתאימה. נסו שוב.',401);
  await db('login.clear',{ip});
  return new Response(null,{status:303,headers:{Location:'/', 'Set-Cookie':cookie(await makeSession(env)),'Cache-Control':'no-store'}});
}
export function loginPage(message='',status=200,setup=false){
  const heading=setup?'הבית שלנו כמעט מוכן':'ברוכים הבאים הביתה';
  return new Response(`<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#f7f3e9"><title>בית משפחת קהא</title><style>*{box-sizing:border-box}body{margin:0;min-height:100svh;display:grid;place-items:center;background:#f7f3e9;color:#46513d;font:18px/1.8 Arial,sans-serif;padding:24px}.box{width:min(440px,100%);background:#fffdf7;border:1px solid #daccb0;border-radius:14px;padding:38px 30px;text-align:center}.mark{font-size:42px;color:#a58b57}h1{font-size:29px;line-height:1.5;margin:12px 0}p{color:#8b7b5d;font-size:16px}label{display:block;text-align:right;font-size:16px}input,button{width:100%;padding:13px 15px;font:18px Arial,sans-serif;border-radius:7px}input{border:1px solid #d7ccb7;background:#fffef9;color:#46513d;margin:8px 0 17px;direction:ltr}button{border:0;background:#6b7b57;color:white;cursor:pointer}.error{color:#a05f44}</style><main class="box"><div class="mark" aria-hidden="true">❖</div><h1>${heading}</h1><p>${setup?'יש להשלים את הגדרת האתר ב־Cloudflare.':'השורשים, הזיכרונות והסיפורים של המשפחה שלנו'}</p>${message?`<p class="error" role="alert">${escapeHTML(message)}</p>`:''}${setup?'':'<form method="post" action="/auth/login"><label>הסיסמה המשפחתית<input type="password" name="password" autocomplete="current-password" required autofocus></label><button>כניסה לבית המשפחה</button></form>'}</main></html>`,{status,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'",'Referrer-Policy':'no-referrer'}});
}
