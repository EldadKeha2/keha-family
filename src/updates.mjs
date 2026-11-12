import {HttpError,json,fail,sha256,hmac,readJSON,boundedBody} from './http.mjs';
import {couples} from './weddings.mjs';

const encoder=new TextEncoder(),decoder=new TextDecoder();
const token=()=>crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','');
const hex=value=>Array.from(value,b=>b.toString(16).padStart(2,'0')).join('');
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const langs=new Set(['he','en-US','en-GB']);
export const HEAD_REQUEST_RECIPIENT='eldadkeha@gmail.com';
export function headRequestName(value){
  if(typeof value!=='string'||/[\u0000-\u001f\u007f]/.test(value))throw new HttpError(400,'יש להזין שם מלא תקין.');
  const name=value.normalize('NFKC').trim().replace(/\s+/g,' ');
  if(name.length<2||name.length>100||(name.match(/\p{L}/gu)||[]).length<2)throw new HttpError(400,'יש להזין שם מלא באורך 2–100 תווים.');
  return name;
}
export function headRequestEmail(name,language='he'){
  const en=language!=='he',subject=en?'Head request — Catch the Jachnun':'בקשת ראש — תפוס תג׳חנון';
  const line=en?'A family member asked to join the game’s head list.':'בן או בת משפחה ביקשו להצטרף לרשימת הראשים במשחק.';
  return {subject,html:shell(language,subject,`<h2>${escape(subject)}</h2><p>${line}</p><p style="font-size:23px;font-weight:bold" dir="auto">${escape(name)}</p><p>${en?'Choose a clear portrait, prepare the head and add it to the game.':'יש לבחור תמונת פנים ברורה, להכין את הראש ולהוסיף אותו למשחק.'}</p>`),text:subject+'\n\n'+line+'\n\n'+name};
}
const provider=env=>env.EMAIL_PROVIDER||(env.BREVO_API_KEY?'brevo':'resend');
export function updatesConfigured(env){
  try{return Boolean(env.FAMILY_UPDATES&&(['brevo','resend'].includes(provider(env)))&&(provider(env)==='brevo'?env.BREVO_API_KEY:env.RESEND_API_KEY)&&/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(env.EMAIL_FROM||'')&&env.UPDATES_SECRET?.length>=32&&new URL(env.SITE_ORIGIN).protocol==='https:'&&env.UPDATES_ENABLED==='true');}catch{return false;}
}
export function normalizeEmail(value){
  if(typeof value!=='string'||value.length>254||!/^\S+@[^\s@]+\.[^\s@]+$/.test(value.trim())||/[<>\r\n\x00-\x20]/.test(value.trim()))throw new HttpError(400,'יש להזין כתובת מייל תקינה.');
  return value.trim().toLowerCase();
}
export function preferences(value,people){
  if(!value||typeof value!=='object')throw new HttpError(400,'בחרו אילו עדכונים לקבל.');
  const result={},peopleIds=new Set(people.map(p=>p.id)),coupleIds=new Set(couples.map(p=>p.id));
  for(const key of ['birthdays','anniversaries','memorials']){
    const input=value[key];if(!input||typeof input.enabled!=='boolean'||!(input.ids===null||Array.isArray(input.ids)))throw new HttpError(400,'בחרו אילו עדכונים לקבל.');
    const valid=key==='anniversaries'?coupleIds:peopleIds;
    if(input.ids!==null&&(input.ids.length>300||input.ids.some(id=>typeof id!=='string'||!valid.has(id))))throw new HttpError(400,'בחרו אנשים וזוגות מהרשימה.');
    result[key]={enabled:input.enabled,ids:input.ids===null?null:[...new Set(input.ids)]};
  }
  if(!Object.values(result).some(item=>item.enabled&&(item.ids===null||item.ids.length)))throw new HttpError(400,'בחרו לפחות עדכון אחד.');
  return result;
}
export function localDay(date=new Date()){
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jerusalem',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(date).map(p=>[p.type,p.value]));
  return {day:`${parts.year}-${parts.month}-${parts.day}`,hour:Number(parts.hour)};
}
function occurrence(value,day){
  const m=/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(value||'');if(!m)return null;
  const [d,month,year]=m.slice(1).map(Number),date=new Date(Date.UTC(year,month-1,d));
  if(year===1111||date.getUTCFullYear()!==year||date.getUTCMonth()+1!==month||date.getUTCDate()!==d)return null;
  const y=Number(day.slice(0,4)),leap=new Date(Date.UTC(y,1,29)).getUTCMonth()===1;
  return day===`${y}-${String(month).padStart(2,'0')}-${String(month===2&&d===29&&!leap?28:d).padStart(2,'0')}`&&y>year?y-year:null;
}
export function eventsForDay(day,people,weddings){
  const events=[],byId=new Map(people.map(p=>[p.id,p]));
  for(const person of people){
    if(person.extra)continue;
    const age=occurrence(person.birthday,day),years=occurrence(person.deathDate,day);
    if(!person.deceased&&age!==null)events.push({type:'birthdays',id:person.id,names:[person],years:age});
    if(person.deceased&&years!==null)events.push({type:'memorials',id:person.id,names:[person],years});
  }
  for(const record of weddings){
    const pair=couples.find(pair=>pair.id===record.id),years=occurrence(record.date,day);
    if(pair&&years!==null&&pair.people.every(id=>byId.has(id)&&!byId.get(id).deceased))events.push({type:'anniversaries',id:record.id,names:pair.people.map(id=>byId.get(id)),years});
  }
  return events;
}
export function matchingEvents(events,prefs){return events.filter(event=>prefs[event.type]?.enabled&&(prefs[event.type].ids===null||prefs[event.type].ids.includes(event.id)));}
function shell(language,title,body,footer=''){
  const en=language!=='he';
  return `<!doctype html><html lang="${language}" dir="${en?'ltr':'rtl'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title></head><body style="margin:0;background:#f5f0e4;color:#493e30;font-family:Arial,sans-serif"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 12px"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:100%;background:#fffdf7;border:1px solid #d9c59d;border-radius:14px;overflow:hidden"><tr><td style="text-align:center;padding:22px;background:#e7eddf;border-bottom:4px double #aa8b51"><span style="color:#a08146;letter-spacing:8px">◆ ◇ ◆ ◇ ◆</span><h1 style="font-size:26px;margin:12px 0 5px;color:#4e6741">Keha Family</h1><p style="margin:0;font-size:14px">${en?'Our family, our moments':'המשפחה שלנו, הרגעים שלנו'}</p></td></tr><tr><td style="padding:28px 22px">${body}</td></tr><tr><td style="text-align:center;padding:20px;background:#f5f0e4;font-size:12px;line-height:1.9;color:#6d604c">${footer}<br><span style="color:#a08146;letter-spacing:5px">◇ ◆ ◇</span></td></tr></table></td></tr></table></body></html>`;
}
const button=(link,label)=>`<p style="text-align:center;margin:24px 0"><a href="${escape(link)}" style="display:inline-block;padding:14px 24px;background:#5d754e;color:white;text-decoration:none;border-radius:7px;font-weight:bold">${escape(label)}</a></p>`;
export function confirmationEmail(language,link){
  const en=language!=='he',subject=en?'Confirm your Keha Family updates':'אישור הרשמה לעדכוני המשפחה';
  const text=en?'Confirm your email to receive the family reminders you selected. This link expires in 24 hours. If you did not request this, ignore this message.':'כדי לקבל את התזכורות המשפחתיות שבחרתם, יש לאשר את כתובת המייל. הקישור תקף ל־24 שעות. אם לא ביקשתם להירשם, אפשר להתעלם מההודעה.';
  return {subject,html:shell(language,subject,`<h2 style="text-align:center">${en?'A little closer to the family':'עוד קצת קרוב למשפחה'} 💌</h2><p style="line-height:1.9">${text}</p>${button(link,en?'Confirm my subscription':'אישור ההרשמה')}`,en?'No reminders are sent before confirmation.':'לא יישלחו תזכורות לפני אישור ההרשמה.'),text:subject+'\n\n'+text+'\n\n'+link};
}
export function managementEmail(language,link){
  const en=language!=='he',subject=en?'Your Keha Family preferences':'ההעדפות שלכם בעדכוני המשפחה',body=en?'Use your private link to choose your reminders or unsubscribe. Please keep this link private.':'בקישור האישי תוכלו לבחור אילו תזכורות לקבל או להסיר את ההרשמה. שמרו את הקישור לעצמכם.';
  return {subject,html:shell(language,subject,`<h2>${escape(subject)}</h2><p style="line-height:1.9">${body}</p>${button(link,en?'Update preferences or unsubscribe':'עדכון העדפות או הסרה מרשימת התפוצה')}`,subscriptionFooter(language,link,link)),text:subject+'\n'+body+'\n'+link};
}
function subscriptionFooter(language,manageLink,unsubscribeLink){
  const en=language!=='he';
  return `<div style="font-size:14px;line-height:2"><a href="${escape(manageLink)}" style="color:#4e6741;font-weight:bold">${en?'Update preferences':'עדכון העדפות'}</a> · <a href="${escape(unsubscribeLink)}" style="color:#765640;font-weight:bold">${en?'Unsubscribe':'הסרה מרשימת התפוצה'}</a></div>${en?'Both links open your private subscription page on the family website.':'שני הקישורים מובילים לעמוד ניהול ההרשמה האישי באתר המשפחה.'}`;
}
export function eventEmail(language,events,manageLink,unsubscribeLink,siteOrigin=manageLink){
  const en=language!=='he',subject=events.length===1?(events[0].type==='birthdays'?(en?'🎂 A family birthday today':'🎂 יום הולדת במשפחה היום'):events[0].type==='anniversaries'?(en?'💐 A family anniversary today':'💐 יום נישואים במשפחה היום'):(en?'🕯 In loving memory':'🕯 זוכרים באהבה')):(en?'Today in the Keha family':'היום במשפחת קהא');
  const lines=[],cards=events.map(event=>{
    const names=event.names.map(p=>en?p.nameEn||p.name:p.name).join(en?' & ':' ו'),memorial=event.type==='memorials',wedding=event.type==='anniversaries';
    const title=memorial?(en?'In loving memory':'זוכרים באהבה'):wedding?(en?'Happy anniversary!':'יום נישואים שמח!'):(en?'Happy birthday!':'יום הולדת שמח!');
    const body=memorial?(en?`${event.years} years have passed. Forever in our hearts.`:`${event.years} שנים לפטירה. תמיד בלב שלנו.`):wedding?(en?`${event.years} years together. Wishing you love, happiness and many more shared memories.`:`${event.years} שנות אהבה. מאחלים עוד הרבה אושר ורגעים משותפים.`):(en?`Celebrating ${event.years} today! Wishing you health, joy and a year full of wonderful moments.`:`חוגגים היום ${event.years}! מאחלים בריאות, שמחה ושנה מלאה ברגעים יפים.`);
    let candleLink='',candleLabel='';
    if(memorial){
      const url=new URL('/',siteOrigin),id=event.id||event.names[0]?.id;
      url.searchParams.set('lang',language);url.hash='memorial'+(id?'/'+encodeURIComponent(id):'');candleLink=url.href;
      const gender=event.names[0]?.gender;
      candleLabel=en?'Light a candle in their memory':gender==='f'?'הדלקת נר לזכרה':gender==='m'?'הדלקת נר לזכרו':'הדלקת נר זיכרון';
    }
    lines.push(title+' '+names+'\n'+body+(memorial?'\n'+candleLabel+': '+candleLink:''));
    return `<div style="padding:24px 16px;text-align:center;margin:0 0 20px;border:1px solid ${memorial?'#d4c9b7':'#dac99e'};border-radius:12px;background:${memorial?'#f3efe7':'#fcf0da'}"><div style="font-size:38px;letter-spacing:5px">${memorial?'🕯':wedding?'💐 💛 💐':'🎈 🎈 🎂 🎈 🎈'}</div><h2 style="font-size:25px;color:${memorial?'#61574a':'#7d5a36'}">${title}</h2><h3 style="font-size:22px">${escape(names)}</h3><p style="font-size:16px;line-height:1.9">${escape(body)}</p>${memorial?button(candleLink,candleLabel):'<div style="font-size:25px">'+(wedding?'✨ 💕 ✨':'🎉 🎁 🎈 🎉')+'</div>'}</div>`;
  }).join('');
  const footer=subscriptionFooter(language,manageLink,unsubscribeLink)+`<br>${en?'You are receiving this because you confirmed your subscription.':'המייל נשלח כי אישרתם הרשמה לעדכונים.'}`;
  return {subject,html:shell(language,subject,cards,footer),text:subject+'\n\n'+lines.join('\n\n')+'\n\n'+(en?'Manage preferences: ':'ניהול העדכונים: ')+manageLink+'\n'+(en?'Unsubscribe: ':'הסרה: ')+unsubscribeLink};
}

export class FamilyUpdates {
  constructor(ctx,env){
    this.ctx=ctx;this.env=env;this.sql=ctx.storage.sql;
    this.sql.exec('CREATE TABLE IF NOT EXISTS subscribers(id TEXT PRIMARY KEY,data TEXT,pending TEXT,status TEXT NOT NULL,confirm_hash TEXT,confirm_expires INTEGER,manage_hash TEXT,revision TEXT NOT NULL,updated INTEGER NOT NULL)');
    this.sql.exec('CREATE UNIQUE INDEX IF NOT EXISTS subscriber_confirm ON subscribers(confirm_hash)');
    this.sql.exec('CREATE UNIQUE INDEX IF NOT EXISTS subscriber_manage ON subscribers(manage_hash)');
    this.sql.exec('CREATE INDEX IF NOT EXISTS subscriber_status ON subscribers(status)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS rate_limits(id TEXT PRIMARY KEY,n INTEGER NOT NULL,expires INTEGER NOT NULL)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS mail_requests(id TEXT PRIMARY KEY,status TEXT NOT NULL,started INTEGER NOT NULL)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS deliveries(id TEXT NOT NULL,day TEXT NOT NULL,status TEXT NOT NULL,data TEXT,revision TEXT,PRIMARY KEY(id,day))');
  }
  rows(q,...args){return this.sql.exec(q,...args).toArray();}
  tx(callback){return this.ctx.storage.transactionSync(callback);}
  async digest(value){return hex(await hmac(this.env.UPDATES_SECRET,value));}
  async key(){return crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',encoder.encode('keha-updates-aes-v1:'+this.env.UPDATES_SECRET)),'AES-GCM',false,['encrypt','decrypt']);}
  async encrypt(value){const iv=crypto.getRandomValues(new Uint8Array(12)),body=await crypto.subtle.encrypt({name:'AES-GCM',iv},await this.key(),encoder.encode(JSON.stringify(value)));return JSON.stringify({iv:hex(iv),body:hex(new Uint8Array(body))});}
  async decrypt(value){const p=JSON.parse(value),bytes=s=>Uint8Array.from(s.match(/../g),b=>parseInt(b,16));return JSON.parse(decoder.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(p.iv)},await this.key(),bytes(p.body))));}
  rate(id,limit,span,now){
    const window=Math.floor(now/span),key=id+':'+window,row=this.rows('SELECT n FROM rate_limits WHERE id=?',key)[0];
    if((row?.n||0)>=limit)return false;
    this.sql.exec('INSERT INTO rate_limits(id,n,expires) VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET n=n+1',key,(window+1)*span);return true;
  }
  async mail(email,message,id,unsubscribe){
    const service=provider(this.env),now=Date.now(),maximum=service==='brevo'?290:90;
    const existing=this.rows('SELECT * FROM mail_requests WHERE id=?',id)[0];
    if(existing?.status==='sent')return;
    if(existing?.status==='sending'&&now-existing.started<20000)throw new HttpError(503,'שליחת המייל עדיין מתבצעת.','UPDATES_MAIL_PENDING');
    // An ambiguous attempt is only retried inside the provider's deduplication window.
    if(existing&&now-existing.started>(service==='brevo'?25*60000:23*3600000))throw new HttpError(503,'שליחת המייל לא הושלמה. נסו שוב מאוחר יותר.','UPDATES_MAIL_UNCERTAIN');
    const {day}=localDay(),limit=Math.min(maximum,Math.max(1,Number(this.env.EMAIL_DAILY_LIMIT)||maximum));
    if(!this.tx(()=>this.rate('mail:'+day,limit,86400000,now)))throw new HttpError(503,'מכסת השליחה היומית התמלאה. נסו שוב מחר.','UPDATES_MAIL_DAILY_LIMIT');
    this.sql.exec("INSERT INTO mail_requests(id,status,started) VALUES(?,'sending',?) ON CONFLICT(id) DO UPDATE SET status='sending'",id,now);
    const headers=unsubscribe?{'List-Unsubscribe':'<'+unsubscribe+'>','List-Unsubscribe-Post':'List-Unsubscribe=One-Click'}:{};
    let response;
    try{
      if(service==='brevo'){
        const digest=await sha256(id),uuid=digest.slice(0,8)+'-'+digest.slice(8,12)+'-4'+digest.slice(13,16)+'-a'+digest.slice(17,20)+'-'+digest.slice(20,32);
        response=await fetch('https://api.brevo.com/v3/smtp/email',{method:'POST',headers:{'Content-Type':'application/json','api-key':this.env.BREVO_API_KEY},body:JSON.stringify({sender:{name:'Keha Family',email:this.env.EMAIL_FROM},to:[{email}],subject:message.subject,htmlContent:message.html,textContent:message.text,headers:{...headers,idempotencyKey:uuid}}),signal:AbortSignal.timeout(15000)});
        if(!response.ok){let error;try{error=await response.clone().json();}catch{}if(error?.code==='duplicate_parameter'){this.sql.exec("UPDATE mail_requests SET status='sent' WHERE id=?",id);return;}}
      }else response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+this.env.RESEND_API_KEY,'Idempotency-Key':id},body:JSON.stringify({from:'Keha Family <'+this.env.EMAIL_FROM+'>',to:[email],...message,...(unsubscribe?{headers}:{})}),signal:AbortSignal.timeout(15000)});
    }catch(error){this.sql.exec("UPDATE mail_requests SET status='uncertain' WHERE id=?",id);throw new HttpError(503,'שליחת המייל לא הושלמה. נסו שוב מאוחר יותר.','UPDATES_MAIL_FAILED');}
    if(!response.ok){
      if(response.status>=400&&response.status<500)this.sql.exec('DELETE FROM mail_requests WHERE id=?',id);
      else this.sql.exec("UPDATE mail_requests SET status='uncertain' WHERE id=?",id);
      if(response.status===401||response.status===403)throw new HttpError(503,'שירות המייל דחה את ההרשאה לשליחה. יש לבדוק את הגדרות שירות המייל.','UPDATES_MAIL_AUTH');
      if(response.status===429)throw new HttpError(503,'שירות המייל הגיע למגבלת שליחה זמנית. נסו שוב מאוחר יותר.','UPDATES_MAIL_PROVIDER_LIMIT');
      throw new HttpError(503,'שליחת המייל לא הושלמה. נסו שוב מאוחר יותר.','UPDATES_MAIL_FAILED');
    }
    this.sql.exec("UPDATE mail_requests SET status='sent' WHERE id=?",id);
  }

  async subscriber(raw){
    if(typeof raw!=='string'||! /^[a-f0-9]{64}$/.test(raw))throw new HttpError(404,'הקישור אינו תקף. בקשו קישור חדש במייל.');
    const row=this.rows('SELECT * FROM subscribers WHERE manage_hash=?',await sha256(raw))[0];
    if(!row||row.status!=='active')throw new HttpError(404,'הקישור אינו תקף. בקשו קישור חדש במייל.');
    return row;
  }
  async headRequest(p){
    const name=headRequestName(p.name);
    if(typeof p.requestId!=='string'||!/^[a-f0-9]{32}$/.test(p.requestId))throw new HttpError(400,'יש לרענן את הטופס ולנסות שוב.');
    const language=langs.has(p.language)?p.language:'he',now=Date.now();
    const fingerprint=await this.digest('head-name:'+HEAD_REQUEST_RECIPIENT+':'+name.toLocaleLowerCase()),id='head-request/'+p.requestId+'/'+fingerprint;
    const existing=this.rows('SELECT * FROM mail_requests WHERE id=?',id)[0];
    if(existing?.status==='sent')return {sent:true};
    if(!existing){
      const ip=await this.digest('head-ip:'+p.ip);
      this.tx(()=>{
        for(const [key,limit,span] of [['head-ip:'+ip,12,3600000],['head-name:'+fingerprint,5,3600000],['head-all',30,86400000]])
          if(!this.rate(key,limit,span,now))throw new HttpError(429,'כבר נשלחה בקשה לאחרונה. נסו שוב מאוחר יותר.');
      });
    }
    await this.mail(HEAD_REQUEST_RECIPIENT,headRequestEmail(name,language),id);
    return {sent:true};
  }
  links(data){const base=new URL(this.env.SITE_ORIGIN).origin+'/?lang='+data.language,manage=base+'#updates/manage/'+data.manageToken;return {manage,unsubscribe:manage,oneClick:new URL(this.env.SITE_ORIGIN).origin+'/api/updates/one-click?token='+data.manageToken};}
  requestAllowed(id,ip,now){
    const limits=[['ip:'+ip,15,3600000],['email:'+id,8,3600000],['email-minute:'+id,1,60000],['signups',45,86400000]];
    this.tx(()=>{
      let retryAfter=0;
      for(const [key,limit,span] of limits){
        const window=Math.floor(now/span),row=this.rows('SELECT n FROM rate_limits WHERE id=?',key+':'+window)[0];
        if((row?.n||0)>=limit)retryAfter=Math.max(retryAfter,Math.ceil(((window+1)*span-now)/1000));
      }
      if(retryAfter){const error=new HttpError(429,'נשלחו יותר מדי בקשות. נסו שוב מאוחר יותר.','UPDATES_RATE_LIMIT');error.retryAfter=retryAfter;throw error;}
      for(const [key,limit,span] of limits)this.rate(key,limit,span,now);
    });
  }
  async sendManagementLink(row,email,now){
    const data=await this.decrypt(row.data);
    await this.mail(email,managementEmail(data.language,this.links(data).manage),'manage/'+row.id+'/'+row.revision+'/'+Math.floor(now/60000));
  }
  async register(p){
    const email=normalizeEmail(p.email);if(p.consent!==true)throw new HttpError(400,'יש לאשר קבלת עדכונים במייל.');
    const prefs=preferences(p.preferences,p.people),language=langs.has(p.language)?p.language:'he',now=Date.now(),id=await this.digest('email:'+email),ip=await this.digest('ip:'+p.ip);
    this.requestAllowed(id,ip,now);
    const manageToken=token(),confirmToken=token(),payload=await this.encrypt({email,language,preferences:prefs,manageToken}),hash=await sha256(confirmToken);
    // Check inside the write transaction: a confirmation may finish during encryption.
    const active=this.tx(()=>{
      const current=this.rows('SELECT * FROM subscribers WHERE id=?',id)[0];
      if(current?.status==='active')return current;
      this.sql.exec("INSERT INTO subscribers(id,pending,status,confirm_hash,confirm_expires,revision,updated) VALUES(?,?,'pending',?,?,?,?) ON CONFLICT(id) DO UPDATE SET pending=excluded.pending,status='pending',confirm_hash=excluded.confirm_hash,confirm_expires=excluded.confirm_expires,updated=excluded.updated",id,payload,hash,now+86400000,token(),now);
      return null;
    });
    // Only the mailbox owner receives the existing private link. Public responses stay identical.
    if(active){await this.sendManagementLink(active,email,now);return {saved:true,pending:true};}
    const link=new URL(this.env.SITE_ORIGIN).origin+'/?lang='+language+'#updates/confirm/'+confirmToken;
    await this.mail(email,confirmationEmail(language,link),'confirm/'+hash);return {saved:true,pending:true};
  }
  async confirm(p){
    if(typeof p.token!=='string'||!/^[a-f0-9]{64}$/.test(p.token))throw new HttpError(404,'קישור האישור אינו תקף או שפג תוקפו.');
    const hash=await sha256(p.token),row=this.rows('SELECT * FROM subscribers WHERE confirm_hash=?',hash)[0];
    if(!row?.pending||row.confirm_expires<Date.now())throw new HttpError(404,'קישור האישור אינו תקף או שפג תוקפו.');
    const pending=await this.decrypt(row.pending),manageHash=await sha256(pending.manageToken);
    const revision=token();
    const activated=this.tx(()=>{
      const current=this.rows('SELECT * FROM subscribers WHERE id=?',row.id)[0];if(current?.confirm_hash!==hash)throw new HttpError(409,'הקישור הוחלף. פתחו את המייל האחרון שקיבלתם.');
      // Old duplicate-registration emails must also preserve the active subscription.
      if(current.status==='active'){
        this.sql.exec('UPDATE subscribers SET pending=NULL,confirm_hash=NULL,confirm_expires=NULL WHERE id=?',row.id);
        return {data:current.data,revision:current.revision};
      }
      this.sql.exec("UPDATE subscribers SET data=pending,pending=NULL,status='active',confirm_hash=NULL,confirm_expires=NULL,manage_hash=?,revision=?,updated=? WHERE id=?",manageHash,revision,Date.now(),row.id);
      return {data:current.pending,revision};
    });
    const data=await this.decrypt(activated.data);
    return {saved:true,confirmed:true,token:data.manageToken,email:data.email,preferences:data.preferences,language:data.language,revision:activated.revision};
  }
  async requestLink(p){
    const email=normalizeEmail(p.email),id=await this.digest('email:'+email),ip=await this.digest('ip:'+p.ip),now=Date.now();
    this.requestAllowed(id,ip,now);
    const row=this.rows('SELECT * FROM subscribers WHERE id=?',id)[0];
    if(row?.status==='active')await this.sendManagementLink(row,email,now);
    return {saved:true};
  }
  async getPreferences(p){const row=await this.subscriber(p.token),data=await this.decrypt(row.data);return {email:data.email,preferences:data.preferences,language:data.language,revision:row.revision};}
  async savePreferences(p){
    const row=await this.subscriber(p.token),data=await this.decrypt(row.data),prefs=preferences(p.preferences,p.people),revision=token();
    data.preferences=prefs;if(langs.has(p.language))data.language=p.language;const encrypted=await this.encrypt(data);
    this.tx(()=>{const current=this.rows('SELECT revision,status FROM subscribers WHERE id=?',row.id)[0];if(current.status!=='active'||current.revision!==p.revision)throw new HttpError(409,'ההעדפות השתנו. פתחו שוב את הקישור האישי.');this.sql.exec('UPDATE subscribers SET data=?,revision=?,updated=? WHERE id=?',encrypted,revision,Date.now(),row.id);});
    return {saved:true,revision};
  }
  async unsubscribe(p){
    if(typeof p.token!=='string'||!/^[a-f0-9]{64}$/.test(p.token))throw new HttpError(404,'הקישור אינו תקף.');
    const hash=await sha256(p.token);
    this.tx(()=>{const row=this.rows('SELECT id FROM subscribers WHERE manage_hash=?',hash)[0];if(!row)return;this.sql.exec("UPDATE subscribers SET status='unsubscribed',data=NULL,pending=NULL,confirm_hash=NULL,confirm_expires=NULL,updated=? WHERE id=?",Date.now(),row.id);this.sql.exec('DELETE FROM deliveries WHERE id=?',row.id);});
    return {saved:true,unsubscribed:true};
  }
  async dispatch(p){
    const time=localDay(new Date(p.now||Date.now()));if(time.hour<9)return {sent:0};
    const events=eventsForDay(time.day,p.people,p.weddings);if(!events.length)return {sent:0};
    const rows=this.rows("SELECT * FROM subscribers WHERE status='active'"),jobs=[];
    for(const row of rows){
      const data=await this.decrypt(row.data),selected=matchingEvents(events,data.preferences);if(!selected.length)continue;
      let job=this.rows('SELECT * FROM deliveries WHERE id=? AND day=?',row.id,time.day)[0];
      if(job?.status==='sent'||job?.status==='cancelled')continue;
      if(!job){const links=this.links(data),envelope=await this.encrypt({email:data.email,message:eventEmail(data.language,selected,links.manage,links.unsubscribe,this.env.SITE_ORIGIN),oneClick:links.oneClick});this.sql.exec("INSERT OR IGNORE INTO deliveries(id,day,status,data,revision) VALUES(?,?,'pending',?,?)",row.id,time.day,envelope,row.revision);job=this.rows('SELECT * FROM deliveries WHERE id=? AND day=?',row.id,time.day)[0];}
      jobs.push(job);
    }
    let sent=0;
    for(const job of jobs.slice(0,20)){
      const current=this.rows('SELECT status,revision FROM subscribers WHERE id=?',job.id)[0];
      if(current?.status!=='active'||current.revision!==job.revision){this.sql.exec("UPDATE deliveries SET status='cancelled',data=NULL WHERE id=? AND day=?",job.id,time.day);continue;}
      const payload=await this.decrypt(job.data);
      try{await this.mail(payload.email,payload.message,'daily/'+time.day+'/'+job.id,payload.oneClick);this.sql.exec("UPDATE deliveries SET status='sent',data=NULL WHERE id=? AND day=?",job.id,time.day);sent++;}
      catch{break;}
    }
    return {sent};
  }
  async fetch(request){
    try{
      const {action,...p}=await request.json();
      if(!updatesConfigured(this.env))throw new HttpError(503,'שליחת העדכונים עדיין בהגדרה. ההרשמה תיפתח בקרוב.','UPDATES_NOT_CONFIGURED');
      const now=Date.now();this.sql.exec('DELETE FROM mail_requests WHERE started<?',now-7*86400000);this.sql.exec('DELETE FROM rate_limits WHERE expires<?',now);this.sql.exec("DELETE FROM subscribers WHERE status='pending' AND confirm_expires<?",now);this.sql.exec('DELETE FROM deliveries WHERE day<?',new Date(now-7*86400000).toISOString().slice(0,10));
      const methods={register:'register',confirm:'confirm','request-link':'requestLink',preferences:'getPreferences',save:'savePreferences',unsubscribe:'unsubscribe',dispatch:'dispatch','head-request':'headRequest'};
      if(!methods[action])throw new HttpError(404,'הפעולה אינה זמינה.');return json(await this[methods[action]](p));
    }catch(error){return fail(error);}
  }
}

export async function headRequestRoute(request,env){
  if(request.method!=='POST')throw new HttpError(405,'הפעולה אינה נתמכת.');
  if(!updatesConfigured(env))throw new HttpError(503,'לא ניתן לשלוח את הבקשה כרגע. נסו שוב מאוחר יותר.');
  const body=await readJSON(request,2000);
  // The recipient is fixed on the server; visitors can submit only a name.
  const payload={action:'head-request',name:body.name,language:body.language,requestId:body.requestId,ip:request.headers.get('CF-Connecting-IP')||'unknown'};
  return env.FAMILY_UPDATES.get(env.FAMILY_UPDATES.idFromName('keha-updates')).fetch(new Request('https://updates.internal/',{method:'POST',body:JSON.stringify(payload)}));
}

export async function updatesRoute(request,env,db){
  const url=new URL(request.url),path=url.pathname;
  if(path==='/api/updates/config'&&request.method==='GET')return json({enabled:updatesConfigured(env),sender:'Keha Family',hour:9,timeZone:'Asia/Jerusalem'});
  if(path==='/api/updates/preview'&&request.method==='GET'){
    const type=['birthdays','anniversaries','memorials'].includes(url.searchParams.get('type'))?url.searchParams.get('type'):'birthdays',language=langs.has(url.searchParams.get('lang'))?url.searchParams.get('lang'):'he';
    let names=[{name:'בן משפחה',nameEn:'A family member'}];if(type==='anniversaries')names.push({name:'בת משפחה',nameEn:'A family member'});
    if(type==='memorials'){const person=(await db('dates',{})).people.find(person=>person.deceased&&!person.extra);if(person)names=[person];}
    const message=eventEmail(language,[{type,id:names[0].id,names,years:type==='birthdays'?40:10}],'#updates','#updates',env.SITE_ORIGIN||url.origin);
    return new Response(message.html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'self'; base-uri 'none'; form-action 'none'"}});
  }
  const action=path.slice('/api/updates/'.length);
  if(request.method!=='POST'||!['register','confirm','request-link','preferences','save','unsubscribe','one-click'].includes(action))throw new HttpError(404,'הפעולה אינה זמינה.');
  if(!updatesConfigured(env))throw new HttpError(503,'שליחת העדכונים עדיין בהגדרה. ההרשמה תיפתח בקרוב.','UPDATES_NOT_CONFIGURED');
  const oneClick=action==='one-click';let body;
  if(oneClick){const raw=decoder.decode(await boundedBody(request,128));if(raw!=='List-Unsubscribe=One-Click')throw new HttpError(400,'הפעולה אינה תקינה.');body={token:url.searchParams.get('token')};}
  else body=await readJSON(request,16000);
  const dates=['register','save'].includes(action)?await db('dates'):{};
  const payload={...body,action:oneClick?'unsubscribe':action,people:dates.people,ip:request.headers.get('CF-Connecting-IP')||'unknown'};
  return env.FAMILY_UPDATES.get(env.FAMILY_UPDATES.idFromName('keha-updates')).fetch(new Request('https://updates.internal/',{method:'POST',body:JSON.stringify(payload)}));
}
export async function dispatchUpdates(env,db,now){
  if(!updatesConfigured(env))return;
  const {day,hour}=localDay(new Date(now));if(hour<9)return;
  const dates=await db('dates');
  return env.FAMILY_UPDATES.get(env.FAMILY_UPDATES.idFromName('keha-updates')).fetch(new Request('https://updates.internal/',{method:'POST',body:JSON.stringify({action:'dispatch',...dates,now})}));
}
