import {HttpError,text} from './http.mjs';
import {livingActions,livingPhotos} from './living-family-catalog.mjs';

export class LivingFamilyState {
  constructor(owner){this.owner=owner;}
  initialize(){
    this.owner.sql.exec('CREATE TABLE IF NOT EXISTS living_family_clips(media_id TEXT NOT NULL,action_id TEXT NOT NULL,data TEXT NOT NULL,PRIMARY KEY(media_id,action_id))');
    this.owner.sql.exec('CREATE TABLE IF NOT EXISTS living_family_receipts(operation_id TEXT PRIMARY KEY,media_id TEXT NOT NULL,action_id TEXT NOT NULL,data TEXT NOT NULL)');
  }
  photo(id){
    if(!livingPhotos.some(photo=>photo.id===id))throw new HttpError(404,'התמונה אינה חלק מהאוסף הזה.','LIVING_PHOTO');
    const item=this.owner.photo(id);
    if(this.owner.familyAi.isExcluded(id))throw new HttpError(404,'התמונה הוסרה מבינה משפחתית.','LIVING_PHOTO');
    return item;
  }
  action(id){if(!livingActions.some(action=>action.id===id))throw new HttpError(400,'בחרו אחת משלוש האפשרויות.','LIVING_ACTION');return id;}
  clip(id,action){this.action(action);const row=this.owner.rows('SELECT data FROM living_family_clips WHERE media_id=? AND action_id=?',id,action)[0];return row?JSON.parse(row.data):null;}
  publicClip(clip,item){
    if(!clip)return null;
    return {status:'ready',version:clip.version,revision:clip.revision,duration:clip.video.duration,stale:clip.revision!==(item.photoRevision||'original'),videoSrc:'/api/family-ai/video/'+clip.id+'/'+clip.variant+'?v='+clip.version};
  }
  featured(){
    const items=[];
    for(const entry of livingPhotos){
      let item;try{item=this.photo(entry.id);}catch(error){if(error.status===404)continue;throw error;}
      items.push({...this.owner.mediaPublic(item),title:entry.title,titleEn:entry.titleEn,generation:entry.generation,animations:livingActions.map(action=>({...action,...(this.publicClip(this.clip(item.id,action.id),item)||{status:'pending',duration:5})}))});
    }
    return {items,total:items.length,totalClips:items.length*livingActions.length,readyClips:items.reduce((n,item)=>n+item.animations.filter(action=>action.status==='ready').length,0)};
  }
  validate(p){
    this.action(p.variant);
    if(!/^[a-f0-9]{32}$/.test(p.id||'')||!/^[a-f0-9]{32}$/.test(p.operation||'')||!/^[a-f0-9]{64}$/.test(p.digest||''))throw new HttpError(400,'פרטי שמירת ההנפשה אינם תקינים.','LIVING_IMPORT');
    const revision=text(p.revision,'גרסת התמונה',80,true),filename=text(p.filename,'שם הסרטון',180,true);
    if(!Object.prototype.hasOwnProperty.call(p,'expected')||p.expected!==null&&!/^[a-f0-9]{32}$/.test(p.expected))throw new HttpError(400,'יש לרענן את פרטי ההנפשה.','LIVING_IMPORT');
    if(!Number.isSafeInteger(p.size)||p.size<1||p.size>25*1024*1024||!Number.isFinite(p.duration)||p.duration<.5||p.duration>15.15||p.codec!=='h264'||p.mime!=='video/mp4')throw new HttpError(400,'בחרו סרטון MP4 קצר בקידוד H.264.','LIVING_FORMAT');
    return {revision,filename,fingerprint:JSON.stringify([p.id,p.variant,revision,filename,p.expected,p.size,p.digest,p.duration,p.codec,p.mime])};
  }
  prepare(p){
    const input=this.validate(p),item=this.photo(p.id),row=this.owner.rows('SELECT media_id,action_id,data FROM living_family_receipts WHERE operation_id=?',p.operation)[0];
    if(row){
      const receipt=JSON.parse(row.data);
      if(row.media_id!==p.id||row.action_id!==p.variant||receipt.fingerprint!==input.fingerprint)throw new HttpError(409,'בקשת השמירה שייכת להנפשה אחרת.','LIVING_OPERATION');
      return {alreadySaved:true,clip:this.clip(p.id,p.variant),item};
    }
    if(input.revision!==(item.photoRevision||'original'))throw new HttpError(409,'התמונה נערכה מאז הכנת ההנפשה.','LIVING_SOURCE_CHANGED');
    const current=this.clip(p.id,p.variant);
    if((current?.version||null)!==p.expected)throw new HttpError(409,'האפשרות הזאת עודכנה בינתיים. רעננו לפני החלפה.','LIVING_CLIP_CHANGED');
    return {alreadySaved:false,item,input,clip:current};
  }
  save(p){
    const prepared=this.prepare(p);if(prepared.alreadySaved)return prepared;
    const key='family-ai/'+p.id+'/actions/'+p.variant+'/'+p.operation+'-'+p.assetHash+'.mp4';
    if(!/^[a-f0-9]{64}$/.test(p.assetHash||'')||p.key!==key)throw new HttpError(400,'פרטי הקובץ השמור אינם תקינים.','LIVING_IMPORT');
    const clip={id:p.id,action:p.variant,version:p.operation,revision:prepared.input.revision,createdAt:new Date().toISOString(),provider:'prepared',video:{key,size:p.size,mime:p.mime,kind:'video',duration:p.duration,filename:prepared.input.filename,digest:p.digest}};
    this.owner.sql.exec('INSERT INTO living_family_clips(media_id,action_id,data) VALUES(?,?,?) ON CONFLICT(media_id,action_id) DO UPDATE SET data=excluded.data',p.id,p.variant,JSON.stringify(clip));
    this.owner.sql.exec('INSERT INTO living_family_receipts(operation_id,media_id,action_id,data) VALUES(?,?,?,?)',p.operation,p.id,p.variant,JSON.stringify({fingerprint:prepared.input.fingerprint,createdAt:clip.createdAt}));
    return {saved:true,alreadySaved:false,clip,item:prepared.item};
  }
  get(p){const item=this.photo(p.id);return {item,clip:this.clip(p.id,p.variant)};}
  snapshot(){return {clips:this.owner.rows('SELECT data FROM living_family_clips').map(row=>JSON.parse(row.data)),receipts:this.owner.rows('SELECT operation_id AS operation,media_id AS id,action_id AS action,data FROM living_family_receipts').map(row=>({operation:row.operation,id:row.id,action:row.action,...JSON.parse(row.data)}))};}
}
