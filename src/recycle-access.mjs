import {HttpError,equal,sha256,hex,uid} from './http.mjs';

// A public digest of a high-entropy, single-use setup key. Password verifiers
// and sessions are configured only in private Durable Object storage.
const SETUP_DIGEST='a336ccc93e016f624d29ef0305ed1d0ce96ebe11d08a79429cff42463d638d7a';
export const TRASH_SESSION_SECONDS=2*60*60;
const WINDOW=15*60*1000;
async function verifier(password,salt){
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
  return hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:new TextEncoder().encode(salt),iterations:100000},key,256));
}
function passwordValue(value){
  if(typeof value!=='string'||value.length<4||value.length>128)throw new HttpError(400,'הזינו סיסמה תקינה.');
  return value;
}
export class RecycleAccess {
  constructor(state){this.state=state;this.sql=state.sql;}
  get(id){const row=this.state.rows('SELECT value FROM trash_auth WHERE id=?',id)[0];return row?JSON.parse(row.value):null;}
  set(id,value){this.sql.exec('INSERT OR REPLACE INTO trash_auth(id,value) VALUES(?,?)',id,JSON.stringify(value));}
  async setup(p){
    if(this.get('config'))throw new HttpError(409,'הגישה לסל המחזור כבר הוגדרה.');
    if(typeof p.setupKey!=='string'||p.setupKey.length!==64||!equal(await sha256(p.setupKey),this.state.env.TRASH_SETUP_DIGEST||SETUP_DIGEST))throw new HttpError(403,'מפתח ההגדרה אינו תקין.');
    const salt=uid()+uid(),hash=await verifier(passwordValue(p.password),salt);
    this.state.ctx.storage.transactionSync(()=>{
      if(this.get('config'))throw new HttpError(409,'הגישה לסל המחזור כבר הוגדרה.');
      this.set('config',{salt,hash});
    });
    return {configured:true};
  }
  async login(p){
    const config=this.get('config');if(!config)throw new HttpError(503,'הגישה לסל המחזור עדיין בהגדרה.');
    const password=passwordValue(p.password),client='attempt:'+await sha256(String(p.client||'unknown'));
    const now=Date.now(),keys=[client,'attempt:global'];
    this.state.ctx.storage.transactionSync(()=>{
      for(const key of keys){const record=this.get(key);if(record&&record.until>now&&record.count>=(key===client?5:30)){const error=new HttpError(429,'בוצעו יותר מדי ניסיונות. נסו שוב בעוד כמה דקות.');error.retryAfter=Math.ceil((record.until-now)/1000);throw error;}}
      this.sql.exec('DELETE FROM trash_auth WHERE expires_at>0 AND expires_at<=?',now);
      for(const key of keys){const old=this.get(key),next=old?.until>now?{...old,count:old.count+1}:{count:1,until:now+WINDOW};this.set(key,next);this.sql.exec('UPDATE trash_auth SET expires_at=? WHERE id=?',next.until,key);}
    });
    if(!equal(await verifier(password,config.salt),config.hash))throw new HttpError(401,'הסיסמה אינה נכונה.');
    const token=uid()+uid(),id='session:'+await sha256(token),expires=Date.now()+TRASH_SESSION_SECONDS*1000;
    this.state.ctx.storage.transactionSync(()=>{
      this.sql.exec('DELETE FROM trash_auth WHERE id=?',client);
      this.set(id,{expires});this.sql.exec('UPDATE trash_auth SET expires_at=? WHERE id=?',expires,id);
    });
    return {token,expires};
  }
  async authorize(token){
    if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))throw new HttpError(401,'יש להיכנס לסל המחזור עם הסיסמה.');
    const id='session:'+await sha256(token),session=this.get(id);
    if(!session||session.expires<=Date.now())throw new HttpError(401,'יש להיכנס לסל המחזור עם הסיסמה.');
    return id;
  }
  async logout(token){const id=await this.authorize(token);this.sql.exec('DELETE FROM trash_auth WHERE id=?',id);return {locked:true};}
}
