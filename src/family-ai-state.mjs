import {aliasPersonIds} from './gallery.mjs';
import {HttpError,text,uid} from './http.mjs';
import {photoLabelFromName} from '../public/assets/photo-labels-catalog.mjs';
import {LivingFamilyState} from './living-family-state.mjs';

const vintageNames=['vintage','וינטג','וינטג׳',"וינטג'",'וינטג’','וינטאג','וינטאג׳',"וינטאג'",'וינטאג’'];
const vintageLabels=[...new Set(vintageNames.map(name=>photoLabelFromName(name).toLowerCase()))];
const states=new Set(['SUBMITTING','PENDING','THROTTLED','RUNNING','SAVING','SUCCEEDED','FAILED','CANCELLED']);
const active=job=>job&&!['SUCCEEDED','FAILED','CANCELLED'].includes(job.status);
const photoClause="COALESCE(json_extract(m.data,'$.kind'),CASE WHEN json_extract(m.data,'$.mime') LIKE 'image/%' THEN 'photo' ELSE '' END)='photo' AND json_extract(m.data,'$.provider') IS NULL";
const bwClause="EXISTS (SELECT 1 FROM json_each(m.data,'$.labels') l WHERE l.value='black-and-white')";
const vintageClause="(EXISTS (SELECT 1 FROM json_each(m.data,'$.labels') l WHERE lower(l.value) IN (SELECT value FROM json_each(?))) OR CAST(json_extract(m.data,'$.takenDate.year') AS INTEGER) BETWEEN 1910 AND 1969)";
// Vintage tags and an old date alone do not identify a black-and-white source.
const candidateClause=photoClause+' AND '+bwClause;
const excludedClause='EXISTS (SELECT 1 FROM family_ai_exclusions e WHERE e.media_id=m.id)';
const vintageArgs=()=>[JSON.stringify(vintageLabels)];

// Kept separate from media metadata: removing a photograph here never removes
// its pixels, tags, album membership, or original gallery entry.
export class FamilyAiState {
  constructor(owner){this.owner=owner;this.living=new LivingFamilyState(owner);}
  initialize(){
    this.living.initialize();
    this.owner.sql.exec('CREATE TABLE IF NOT EXISTS family_ai_exclusions(media_id TEXT PRIMARY KEY,created_at TEXT NOT NULL)');
    this.owner.sql.exec('CREATE TABLE IF NOT EXISTS family_ai_jobs(media_id TEXT PRIMARY KEY,data TEXT NOT NULL)');
    this.owner.sql.exec('CREATE TABLE IF NOT EXISTS family_ai_claims(claim_id TEXT PRIMARY KEY,media_id TEXT NOT NULL,created_at TEXT NOT NULL)');
    this.owner.sql.exec('CREATE INDEX IF NOT EXISTS family_ai_claims_created ON family_ai_claims(created_at)');
  }
  isExcluded(id){return Boolean(this.owner.rows('SELECT media_id FROM family_ai_exclusions WHERE media_id=?',id).length);}
  eligible(id){return Boolean(this.owner.rows('SELECT m.id FROM media m WHERE m.id=? AND '+candidateClause,id).length);}
  job(id){const row=this.owner.rows('SELECT data FROM family_ai_jobs WHERE media_id=?',id)[0];return row?JSON.parse(row.data):null;}
  publicJob(job,item){
    if(!job)return null;
    return {status:job.status,progress:job.progress||0,revision:job.revision,createdAt:job.createdAt,updatedAt:job.updatedAt,errorCode:job.errorCode||null,stale:job.revision!==(item.photoRevision||'original'),...(job.status==='SUCCEEDED'&&job.video?{videoSrc:'/api/family-ai/video/'+item.id,duration:10}:{})};
  }
  publicItem(item){return {...this.owner.mediaPublic(item),aiExcluded:this.isExcluded(item.id),aiJob:this.publicJob(this.job(item.id),item)};}
  list(p={}){
    const pageRequested=Number(p.page||1),size=Number(p.size||40),query=text(p.query||'','חיפוש',120),filter=p.filter||'all',excluded=p.excluded===true;
    if(!Number.isSafeInteger(pageRequested)||pageRequested<1||![12,24,40,80].includes(size))throw new HttpError(400,'בחרו עמוד תקין ועד 80 תמונות בעמוד.');
    if(!['all','black-and-white','vintage','ready'].includes(filter))throw new HttpError(400,'בחרו סינון תמונות תקין.');
    const bindings=[];let where=candidateClause+' AND '+(excluded?'':'NOT ')+excludedClause;
    if(filter==='black-and-white')where+=' AND '+bwClause;
    if(filter==='vintage'){where+=' AND '+vintageClause;bindings.push(...vintageArgs());}
    if(filter==='ready')where+=" AND EXISTS (SELECT 1 FROM family_ai_jobs j WHERE j.media_id=m.id AND json_extract(j.data,'$.status')='SUCCEEDED' AND json_extract(j.data,'$.video.key') IS NOT NULL)";
    if(query){
      const like='%'+query.replace(/[\\%_]/g,'\\$&')+'%';
      where+=" AND (COALESCE(json_extract(m.data,'$.name'),'') LIKE ? ESCAPE '\\' OR COALESCE(json_extract(m.data,'$.caption'),'') LIKE ? ESCAPE '\\' OR EXISTS (SELECT 1 FROM media_tags t JOIN people p ON p.id=t.person_id WHERE t.media_id=m.id AND (json_extract(p.data,'$.name') LIKE ? ESCAPE '\\' OR json_extract(p.data,'$.nameEn') LIKE ? ESCAPE '\\' OR p.id IN (SELECT value FROM json_each(?)))))";
      bindings.push(like,like,like,like,JSON.stringify(aliasPersonIds(query)));
    }
    const total=this.owner.rows('SELECT count(*) AS n FROM media m WHERE '+where,...bindings)[0].n,pages=Math.max(1,Math.ceil(total/size)),page=Math.min(pageRequested,pages);
    const items=this.owner.rows('SELECT m.data FROM media m WHERE '+where+' ORDER BY m.rowid DESC LIMIT ? OFFSET ?',...bindings,size,(page-1)*size).map(row=>this.publicItem(JSON.parse(row.data)));
    const excludedCount=this.owner.rows('SELECT count(*) AS n FROM media m WHERE '+candidateClause+' AND '+excludedClause)[0].n;
    return {items,count:total,excludedCount,pagination:{page,size,total,pages},filter};
  }
  exclude(p){
    const item=this.owner.photo(p.id);
    if(typeof p.excluded!=='boolean')throw new HttpError(400,'בחרו אם להסיר או להחזיר את התמונה.');
    if(!this.eligible(item.id)&&!this.isExcluded(item.id))throw new HttpError(400,'התמונה אינה חלק מבינה משפחתית.');
    if(p.excluded)this.owner.sql.exec('INSERT OR IGNORE INTO family_ai_exclusions(media_id,created_at) VALUES(?,?)',item.id,new Date().toISOString());
    else this.owner.sql.exec('DELETE FROM family_ai_exclusions WHERE media_id=?',item.id);
    return {saved:true,item:this.publicItem(item),excluded:p.excluded};
  }
  claim(p){
    const item=this.owner.photo(p.id),revision=item.photoRevision||'original';
    if(p.revision!==revision)throw new HttpError(409,'התמונה השתנתה. פתחו אותה מחדש לפני יצירת סרטון.','AI_PHOTO_CHANGED');
    if(!this.eligible(item.id)||this.isExcluded(item.id))throw new HttpError(400,'בחרו תמונה מתוך בינה משפחתית.','AI_PHOTO_UNAVAILABLE');
    if(typeof p.claimId!=='string'||!/^[a-f0-9]{32}$/.test(p.claimId))throw new HttpError(400,'בקשת היצירה אינה תקינה.');
    const previous=this.job(item.id);
    if(active(previous)||previous?.status==='SUCCEEDED'&&previous.revision===revision||previous&&previous.revision===revision&&p.retry!==true)return {claimed:false,job:previous,item};
    if(this.owner.rows('SELECT claim_id FROM family_ai_claims WHERE claim_id=?',p.claimId).length)throw new HttpError(409,'בקשת היצירה כבר נוצלה.');
    const rawLimit=Number(p.dailyLimit??20),limit=Number.isSafeInteger(rawLimit)?Math.max(1,Math.min(rawLimit,100)):20,now=new Date(),day=now.toISOString().slice(0,10);
    const count=this.owner.rows('SELECT count(*) AS n FROM family_ai_claims WHERE created_at>=?',day)[0].n;
    if(count>=limit)throw new HttpError(429,'מכסת יצירת הסרטונים היומית מוצתה. נסו שוב מחר.','AI_DAILY_LIMIT');
    const stamp=now.toISOString(),job={id:item.id,claimId:p.claimId,revision,status:'SUBMITTING',taskId:null,createdAt:stamp,updatedAt:stamp,lastPollAt:0,pollToken:null,pollLeaseUntil:0,progress:0,video:null,errorCode:null};
    this.owner.sql.exec('INSERT INTO family_ai_claims(claim_id,media_id,created_at) VALUES(?,?,?)',p.claimId,item.id,stamp);
    this.save(job);return {claimed:true,job,item};
  }
  save(job){this.owner.sql.exec('INSERT INTO family_ai_jobs(media_id,data) VALUES(?,?) ON CONFLICT(media_id) DO UPDATE SET data=excluded.data',job.id,JSON.stringify(job));}
  update(p){
    const job=this.job(p.id);if(!job||job.claimId!==p.claimId)return {updated:false,job};
    if(p.pollToken!==undefined&&p.pollToken!==job.pollToken)return {updated:false,job};
    if(!p.patch||typeof p.patch!=='object'||Array.isArray(p.patch))throw new HttpError(400,'עדכון הסרטון אינו תקין.');
    const allowed=['status','taskId','lastPollAt','progress','video','errorCode','outputUrl','failureCode','estimatedCost'];
    for(const key of Object.keys(p.patch))if(!allowed.includes(key))throw new HttpError(400,'עדכון הסרטון אינו תקין.');
    if(p.patch.status!==undefined&&!states.has(p.patch.status))throw new HttpError(400,'מצב הסרטון אינו תקין.');
    if(p.patch.progress!==undefined&&(!Number.isFinite(p.patch.progress)||p.patch.progress<0||p.patch.progress>1))throw new HttpError(400,'התקדמות הסרטון אינה תקינה.');
    if(job.status==='SUCCEEDED'&&p.patch.status&&p.patch.status!=='SUCCEEDED')return {updated:false,job};
    Object.assign(job,p.patch,{updatedAt:new Date().toISOString()});
    if(p.releasePoll===true){job.pollToken=null;job.pollLeaseUntil=0;}
    this.save(job);return {updated:true,job};
  }
  poll(p){
    this.owner.photo(p.id);const job=this.job(p.id),now=Date.now();
    if(!job||job.claimId!==p.claimId||!active(job)||!job.taskId||now<(job.pollLeaseUntil||0)||now-(job.lastPollAt||0)<30000)return {poll:false,job};
    job.lastPollAt=now;job.pollToken=uid();job.pollLeaseUntil=now+120000;this.save(job);return {poll:true,job,pollToken:job.pollToken};
  }
  pending(){return {jobs:this.owner.rows("SELECT j.data FROM family_ai_jobs j JOIN media m ON m.id=j.media_id WHERE json_extract(j.data,'$.status') NOT IN ('SUCCEEDED','FAILED','CANCELLED') AND json_extract(j.data,'$.taskId') IS NOT NULL ORDER BY json_extract(j.data,'$.createdAt') LIMIT 20").map(row=>JSON.parse(row.data))};}
  snapshot(){return {living:this.living.snapshot(),exclusions:this.owner.rows('SELECT media_id AS mediaId,created_at AS createdAt FROM family_ai_exclusions'),jobs:this.owner.rows('SELECT data FROM family_ai_jobs').map(row=>JSON.parse(row.data)),claims:this.owner.rows('SELECT claim_id AS claimId,media_id AS mediaId,created_at AS createdAt FROM family_ai_claims')};}
}
