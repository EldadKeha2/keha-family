import {HttpError,equal,sha256,hex,uid} from './http.mjs';

// Single-use owner setup challenge. The password verifier stays in private storage.
const SETUP_DIGEST='5443fd98b5697a9d146a7436743f85a544acc883b2ceec816e0142d82647550f';
const WINDOW=15*60*1000;
async function verifier(password,salt){
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
  return hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:new TextEncoder().encode(salt),iterations:100000},key,256));
}
export class FamilyAiRemovalAccess {
  constructor(state){this.state=state;}
  get(id){const row=this.state.rows('SELECT value FROM family_ai_access WHERE id=?',id)[0];return row?JSON.parse(row.value):null;}
  set(id,value){this.state.sql.exec('INSERT OR REPLACE INTO family_ai_access(id,value) VALUES(?,?)',id,JSON.stringify(value));}
  async setup(p){
    if(this.get('config'))throw new HttpError(409,'סיסמת המחיקה כבר הוגדרה.','AI_REMOVAL_CONFIGURED');
    if(typeof p.setupKey!=='string'||p.setupKey.length!==64||!equal(await sha256(p.setupKey),this.state.env.FAMILY_AI_REMOVAL_SETUP_DIGEST||SETUP_DIGEST))throw new HttpError(403,'מפתח ההגדרה אינו תקין.','AI_REMOVAL_SETUP');
    if(typeof p.password!=='string'||p.password.length<4||p.password.length>128)throw new HttpError(400,'הזינו סיסמה תקינה.');
    const salt=uid()+uid(),hash=await verifier(p.password,salt);
    this.state.ctx.storage.transactionSync(()=>{
      if(this.get('config'))throw new HttpError(409,'סיסמת המחיקה כבר הוגדרה.','AI_REMOVAL_CONFIGURED');
      this.set('config',{salt,hash});
    });
    return {configured:true};
  }
  async authorize(p){
    const config=this.get('config');
    if(!config)throw new HttpError(503,'סיסמת המחיקה עדיין בהגדרה.','AI_REMOVAL_UNCONFIGURED');
    const client='attempt:'+await sha256(String(p.client||'unknown')),now=Date.now();
    this.state.ctx.storage.transactionSync(()=>{
      for(const key of [client,'attempt:global']){
        const record=this.get(key);
        if(record?.until>now&&record.count>=(key===client?5:30)){
          const error=new HttpError(429,'בוצעו יותר מדי ניסיונות. נסו שוב בעוד כמה דקות.','AI_REMOVAL_LIMIT');
          error.retryAfter=Math.ceil((record.until-now)/1000);throw error;
        }
      }
      this.state.sql.exec('DELETE FROM family_ai_access WHERE expires_at>0 AND expires_at<=?',now);
      for(const key of [client,'attempt:global']){
        const old=this.get(key),next=old?.until>now?{...old,count:old.count+1}:{count:1,until:now+WINDOW};
        this.set(key,next);this.state.sql.exec('UPDATE family_ai_access SET expires_at=? WHERE id=?',next.until,key);
      }
    });
    if(typeof p.password!=='string'||p.password.length>128||!equal(await verifier(p.password,config.salt),config.hash))throw new HttpError(401,'הסיסמה אינה נכונה.','AI_REMOVAL_PASSWORD');
    this.state.sql.exec('DELETE FROM family_ai_access WHERE id=?',client);
  }
}
