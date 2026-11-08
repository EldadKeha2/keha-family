import family from './family.mjs';
import {HttpError,json,fail,text,birthday,calendarDate,uid,stateFailure} from './http.mjs';
import {couples,couple,weddingCollection,validCollection} from './weddings.mjs';
import {featuredVideos} from './featured-videos.mjs';
import {birthdayCorrections,correctionKey,grandparentCorrections,grandparentCorrectionKey,birthdayMonthDayCorrections,memorialCorrectionKey,memorialCorrections} from './date-corrections.mjs';
import {biographyDefaults,biographyValue,contentField} from './biography.mjs';
import {memorialPeriod} from './memorial.mjs';
import {makeQuiz,makeMissingQuiz} from '../public/assets/quiz.mjs';
import {makeKinshipQuiz,kinshipPool} from '../public/assets/kinship.mjs';
import {makeTriviaQuiz,triviaPool} from '../public/assets/trivia.mjs';
import {triviaLanguage,validateTriviaQuestion,mixTriviaQuestions} from './trivia-questions.mjs';
import {jachnunScore,JACHNUN_SCORE_LIMIT} from './jachnun-scores.mjs';
import {rexScore,REX_SCORE_LIMIT} from './rex-scores.mjs';
import {netoTetrisScore,NETO_TETRIS_SCORE_LIMIT} from './neto-tetris-scores.mjs';
import {rutiHouseScore,RUTI_HOUSE_SCORE_LIMIT,RUTI_HOUSE_SCORE_FIELDS} from './ruti-house-scores.mjs';
import {nurseryCollection} from './nursery.mjs';
import {faceRect,sameFaceRegion,FACE_LIMIT} from './faces.mjs';
import {FACE_SCAN_VERSION,GALLERY_FILTER_VERSION,faceCoverage,detectionRegions,withoutIgnored} from '../public/assets/face-coverage.mjs';
import {photoVersionId,photoSource,photoTransform,transformPhotoFaces} from './photo-versions.mjs';
import {galleryRefinement,galleryRevision,galleryLabels,galleryOrdering} from './gallery.mjs';
import {PHOTO_LABELS,photoLabels} from '../public/assets/photo-labels-catalog.mjs';
import {photoDate} from '../public/assets/photo-date.mjs';
import {nameCorrectionKey,normalizedName,matchingPeople,correctPersonName,correctNamedContent} from './name-corrections.mjs';
const mediaKind=item=>item.kind||(item.mime.startsWith('image/')?'photo':item.mime.startsWith('video/')?'video':'document');

// One SQLite-backed object serializes updates for this family. Binary files live in HF.
export class FamilyState {
  constructor(ctx,env){
    this.ctx=ctx;this.env=env;this.sql=ctx.storage.sql;this.peopleRevision=uid();this.peopleCache=null;
    this.initializationError=null;this.nextInitializationAttempt=0;this.initializeState();
  }
  initializeState(){
    try{this.initialize();this.initializationError=null;this.nextInitializationAttempt=0;}
    catch(error){
      this.peopleCache=null;this.initializationError=stateFailure(error,true);
      const now=Date.now();
      this.nextInitializationAttempt=this.initializationError.code==='DAILY_STORAGE_LIMIT'?now-now%86400000+86401000:now+60000;
    }
  }
  initialize(){
    this.sql.exec('CREATE TABLE IF NOT EXISTS people(id TEXT PRIMARY KEY,data TEXT NOT NULL)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS memorial_candles(person_id TEXT NOT NULL,period TEXT NOT NULL,visitor_id TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(person_id,period,visitor_id))');
    this.sql.exec('CREATE TABLE IF NOT EXISTS trivia_questions(id TEXT PRIMARY KEY,language TEXT NOT NULL,data TEXT NOT NULL,created_at TEXT NOT NULL)');
    this.sql.exec('CREATE INDEX IF NOT EXISTS trivia_question_language ON trivia_questions(language,created_at)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS jachnun_scores(id TEXT PRIMARY KEY,name TEXT NOT NULL,score INTEGER NOT NULL,head_id TEXT NOT NULL,created_at TEXT NOT NULL)');
    this.sql.exec('CREATE INDEX IF NOT EXISTS jachnun_scores_ranking ON jachnun_scores(score DESC,created_at,id)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS rex_scores(id TEXT PRIMARY KEY,name TEXT NOT NULL,score INTEGER NOT NULL,head_id TEXT NOT NULL,basket TEXT NOT NULL,created_at TEXT NOT NULL)');
    this.sql.exec('CREATE INDEX IF NOT EXISTS rex_scores_ranking ON rex_scores(score DESC,created_at,id)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS neto_tetris_scores(id TEXT PRIMARY KEY,name TEXT NOT NULL,score INTEGER NOT NULL,lines INTEGER NOT NULL,level INTEGER NOT NULL,pieces INTEGER NOT NULL,zaps INTEGER NOT NULL,created_at TEXT NOT NULL)');
    this.sql.exec('CREATE INDEX IF NOT EXISTS neto_tetris_scores_ranking ON neto_tetris_scores(score DESC,created_at,id)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS ruti_house_scores(id TEXT PRIMARY KEY,name TEXT NOT NULL,score INTEGER NOT NULL,level INTEGER NOT NULL,meals INTEGER NOT NULL,snacks INTEGER NOT NULL,plants INTEGER NOT NULL,dust INTEGER NOT NULL,cats INTEGER NOT NULL,dishes INTEGER NOT NULL,bestCombo INTEGER NOT NULL,elapsed INTEGER NOT NULL,created_at TEXT NOT NULL)');
    this.sql.exec('CREATE INDEX IF NOT EXISTS ruti_house_scores_ranking ON ruti_house_scores(score DESC,created_at,id)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS ruti_house_score_details(id TEXT PRIMARY KEY,version INTEGER NOT NULL,completed_levels INTEGER NOT NULL,stage_scores TEXT NOT NULL)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS ruti_house_ora_bonuses(id TEXT PRIMARY KEY,wins INTEGER NOT NULL)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS ruti_house_run_metrics(id TEXT PRIMARY KEY,missed INTEGER NOT NULL)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS ruti_house_completion_bonuses(id TEXT PRIMARY KEY,stage_results TEXT NOT NULL)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS media(id TEXT PRIMARY KEY,category TEXT NOT NULL,person_id TEXT,data TEXT NOT NULL)');
    this.sql.exec('CREATE INDEX IF NOT EXISTS media_owner ON media(person_id)');
    this.sql.exec('CREATE INDEX IF NOT EXISTS media_category ON media(category)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS media_collections(media_id TEXT NOT NULL,collection TEXT NOT NULL,added_at TEXT NOT NULL,PRIMARY KEY(media_id,collection))');
    this.sql.exec('CREATE INDEX IF NOT EXISTS media_collections_album ON media_collections(collection,media_id)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS media_tags(media_id TEXT NOT NULL,person_id TEXT NOT NULL,PRIMARY KEY(media_id,person_id))');
    this.sql.exec('CREATE INDEX IF NOT EXISTS media_tags_person ON media_tags(person_id,media_id)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS media_faces(media_id TEXT NOT NULL,id TEXT NOT NULL,person_id TEXT NOT NULL,data TEXT NOT NULL,PRIMARY KEY(media_id,id))');
    this.sql.exec('CREATE TABLE IF NOT EXISTS media_face_scans(media_id TEXT PRIMARY KEY,photo_revision TEXT NOT NULL,version TEXT NOT NULL,data TEXT NOT NULL,face_count INTEGER NOT NULL,unmatched_count INTEGER NOT NULL)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS media_face_reviews(media_id TEXT PRIMARY KEY,photo_revision TEXT NOT NULL,tags_revision TEXT NOT NULL,completed_at TEXT NOT NULL)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS album_covers(collection TEXT PRIMARY KEY,media_id TEXT NOT NULL)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS media_face_ignores(media_id TEXT NOT NULL,photo_revision TEXT NOT NULL,data TEXT NOT NULL,PRIMARY KEY(media_id,photo_revision))');
    this.sql.exec('CREATE TABLE IF NOT EXISTS photo_versions(media_id TEXT NOT NULL,id TEXT NOT NULL,data TEXT NOT NULL,PRIMARY KEY(media_id,id))');
    this.sql.exec('CREATE TABLE IF NOT EXISTS media_trash(id TEXT PRIMARY KEY,data TEXT NOT NULL,deleted_at TEXT NOT NULL,profile_selected INTEGER NOT NULL DEFAULT 0)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS stories(id TEXT PRIMARY KEY,data TEXT NOT NULL)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS meta(id TEXT PRIMARY KEY,value TEXT NOT NULL)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS weddings(id TEXT PRIMARY KEY,data TEXT NOT NULL)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS greetings(id TEXT PRIMARY KEY,wedding_id TEXT NOT NULL,data TEXT NOT NULL)');
    this.sql.exec('CREATE INDEX IF NOT EXISTS greetings_wedding ON greetings(wedding_id)');
    this.ctx.storage.transactionSync(()=>{
      let labelsChanged=false;const revised=new Set();
      for(const p of Object.values(family.people)){
        this.sql.exec('INSERT OR IGNORE INTO people(id,data) VALUES(?,?)',p.id,JSON.stringify({id:p.id,name:p.name,birthday:p.birthday||'1.1.1111',profileId:null,revision:uid()}));
        // Names come from the family tree; keep birthdays and uploaded albums intact.
        const person=this.person(p.id);
        const nameChanged=person.name!==p.name||person.nameEn!==p.nameEn||(p.id==='roi'&&(person.firstName!==p.firstName||person.lastName!==p.lastName));
        if(nameChanged||Boolean(person.extended)!==Boolean(p.extended)||person.deceased!==Boolean(p.deceased)||person.deathDate===undefined||(p.aliyahYear&&person.aliyahYear!==p.aliyahYear)||(p.aliyahMonth&&person.aliyahMonth!==p.aliyahMonth)){
          person.name=p.name;person.nameEn=p.nameEn;person.extended=Boolean(p.extended);person.deceased=Boolean(p.deceased);
          if(p.id==='roi'){person.firstName=p.firstName;person.lastName=p.lastName;}
          if(person.deathDate===undefined)person.deathDate=p.deathDate||null;
          if(p.aliyahYear)person.aliyahYear=p.aliyahYear;
          if(p.aliyahMonth)person.aliyahMonth=p.aliyahMonth;
          this.savePerson(person);
          revised.add(p.id);if(nameChanged)labelsChanged=true;
        }
      }
      if(!this.rows('SELECT value FROM meta WHERE id=?',correctionKey).length){
        for(const [id,date]of birthdayCorrections){const person=this.person(id);person.birthday=date;this.savePerson(person);}
        this.sql.exec('INSERT INTO meta(id,value) VALUES(?,?)',correctionKey,'applied');
      }
      if(!this.rows('SELECT value FROM meta WHERE id=?',grandparentCorrectionKey).length){
        for(const [id,fields]of Object.entries(grandparentCorrections)){const person=this.person(id);Object.assign(person,fields);this.savePerson(person);}
        this.sql.exec('INSERT INTO meta(id,value) VALUES(?,?)',grandparentCorrectionKey,'applied');
      }
      if(!this.rows('SELECT value FROM meta WHERE id=?',memorialCorrectionKey).length){
        for(const [id,fields]of Object.entries(memorialCorrections)){const person=this.person(id);Object.assign(person,fields);this.savePerson(person);}
        this.sql.exec('INSERT INTO meta(id,value) VALUES(?,?)',memorialCorrectionKey,'applied');
      }
      for(const correction of birthdayMonthDayCorrections){
        if(this.rows('SELECT value FROM meta WHERE id=?',correction.key).length)continue;
        const person=this.person(correction.id),match=/^\d{1,2}\.\d{1,2}\.(\d{4})$/.exec(person.birthday||'');
        if(!match||person.birthday==='1.1.1111')continue;
        let date;try{calendarDate(person.birthday,'תאריך לידה');date=calendarDate(correction.day+'.'+correction.month+'.'+match[1],'תאריך לידה');}catch{continue;}
        if(person.birthday!==date){person.birthday=date;this.savePerson(person);}
        this.sql.exec('INSERT INTO meta(id,value) VALUES(?,?)',correction.key,'applied');
      }
      for(const item of couples)this.sql.exec('INSERT OR IGNORE INTO weddings(id,data) VALUES(?,?)',item.id,JSON.stringify({id:item.id,date:'',revision:uid()}));
      // Insert the oldest first because shared albums display the newest row first.
      for(const item of [...featuredVideos].reverse()){
        if(this.rows('SELECT id FROM media_trash WHERE id=?',item.id).length)continue;
        if(this.rows('SELECT id FROM media WHERE id=?',item.id).length){const old=this.media(item.id);if(old.nameEn!==item.nameEn){old.nameEn=item.nameEn;this.sql.exec('UPDATE media SET data=? WHERE id=?',JSON.stringify(old),old.id);labelsChanged=true;}continue;}
        this.sql.exec('INSERT INTO media(id,category,person_id,data) VALUES(?,?,NULL,?)',item.id,item.category,JSON.stringify(item));this.touch('videos');
      }
      if(labelsChanged){
        // Invalidate each person's cache once. Never visit or retag every photo on startup.
        for(const row of this.rows('SELECT data FROM people')){const person=JSON.parse(row.data);if(!revised.has(person.id))this.savePerson(person);}
        const collections=new Set(['gallery','photos','videos','nostalgia',...couples.map(pair=>weddingCollection(pair.id)),...this.rows("SELECT id FROM meta WHERE id LIKE 'collection:%'").map(row=>row.id.slice(11))]);
        for(const kind of collections)this.touch(kind);
      }
      this.correctStoredNames();
    });
  }
  correctStoredNames(){
    if(this.rows('SELECT value FROM meta WHERE id=?',nameCorrectionKey).length)return;
    // This one-time pass updates authored text, including deleted photos and history,
    // without retagging, copying or rewriting any binary photo.
    for(const table of ['people','media','media_trash','photo_versions','stories','weddings','greetings','trivia_questions']){
      for(const row of this.rows('SELECT rowid AS row_id,data FROM '+table+' WHERE data LIKE ? OR data LIKE ?','%חריזי%','%Harizi%')){
        const previous=JSON.parse(row.data),item=correctNamedContent(previous);
        if(JSON.stringify(item)===JSON.stringify(previous))continue;
        if(table==='people'){this.savePerson(item);continue;}
        if(table==='stories')item.updatedAt=new Date(Math.max(Date.now(),Date.parse(item.updatedAt)||0)+1).toISOString();
        if(table==='weddings')item.revision=uid();
        this.sql.exec('UPDATE '+table+' SET data=? WHERE rowid=?',JSON.stringify(item),row.row_id);
        if(table==='media')this.touchMedia(item);
        if(table==='stories')this.sql.exec("INSERT INTO meta(id,value) VALUES('stories',?) ON CONFLICT(id) DO UPDATE SET value=excluded.value",uid());
      }
    }
    for(const table of ['jachnun_scores','rex_scores','neto_tetris_scores','ruti_house_scores']){
      for(const row of this.rows('SELECT id,name FROM '+table+' WHERE name LIKE ? OR name LIKE ?','%חריזי%','%Harizi%')){
        const name=correctPersonName(row.name);if(name!==row.name)this.sql.exec('UPDATE '+table+' SET name=? WHERE id=?',name,row.id);
      }
    }
    this.sql.exec('INSERT INTO meta(id,value) VALUES(?,?)',nameCorrectionKey,'applied');
  }
  rows(query,...args){return this.sql.exec(query,...args).toArray();}
  person(id){const row=this.rows('SELECT data FROM people WHERE id=?',id)[0];if(!row)throw new HttpError(404,'האדם לא נמצא באילן המשפחה.');return JSON.parse(row.data);}
  savePerson(item){item.revision=uid();this.sql.exec('UPDATE people SET data=? WHERE id=?',JSON.stringify(item),item.id);this.peopleRevision=uid();this.peopleCache=null;}
  media(id){const row=this.rows('SELECT data FROM media WHERE id=?',id)[0];if(!row)throw new HttpError(404,'הקובץ לא נמצא.');return JSON.parse(row.data);}
  photo(id){const item=this.media(id);if(mediaKind(item)!=='photo'||item.provider)throw new HttpError(400,'אפשר לערוך תמונות בלבד.');return item;}
  currentPhotoVersion(item){return {id:item.photoRevision||'original',key:item.key,mime:item.mime,size:item.size,filename:item.filename,createdAt:item.photoEditedAt||item.createdAt,faces:this.faces(item.id,true).map(({person,...face})=>face),...(item.photoEdit?{edit:item.photoEdit}:{})};}
  photoVersion(item,id){
    if(!photoVersionId(id))throw new HttpError(400,'גרסת התמונה אינה תקינה.');
    if(id===(item.photoRevision||'original'))return this.currentPhotoVersion(item);
    const row=this.rows('SELECT data FROM photo_versions WHERE media_id=? AND id=?',item.id,id)[0];if(!row)throw new HttpError(404,'גרסת התמונה לא נמצאה.');return JSON.parse(row.data);
  }
  photoVersions(item){
    const current=this.currentPhotoVersion(item),versions=this.rows('SELECT data FROM photo_versions WHERE media_id=? ORDER BY rowid DESC',item.id).map(row=>JSON.parse(row.data));
    if(!versions.some(version=>version.id===current.id))versions.unshift(current);
    return {item:this.mediaPublic(item),currentVersion:current.id,versions:versions.map(version=>({id:version.id,createdAt:version.createdAt,mime:version.mime,size:version.size,filename:version.filename,current:version.id===current.id,original:version.id==='original',src:'/media/'+item.id+'?version='+version.id}))};
  }
  preparePhoto(p){
    const item=this.photo(p.id);if(!photoVersionId(p.expectedVersion)||p.expectedVersion!==(item.photoRevision||'original'))throw new HttpError(409,'התמונה נערכה בינתיים. פתחו את העורך מחדש לפני שמירה.');
    return {item,base:this.photoVersion(item,p.baseVersion),edit:photoTransform(p.rotation,p.crop)};
  }
  savePhotoVersion(item,version,faces){
    const previous=this.currentPhotoVersion(item);
    const reviewed=this.rows('SELECT media_id FROM media_face_reviews WHERE media_id=? AND photo_revision=? AND tags_revision=?',item.id,previous.id,this.tagsRevision(item.id))[0];
    this.sql.exec('INSERT INTO photo_versions(media_id,id,data) VALUES(?,?,?) ON CONFLICT(media_id,id) DO UPDATE SET data=excluded.data',item.id,previous.id,JSON.stringify(previous));
    const now=new Date().toISOString(),next={...version,createdAt:now,faces:faces.map(face=>({...face,revision:uid(),updatedAt:now}))};
    this.sql.exec('INSERT INTO photo_versions(media_id,id,data) VALUES(?,?,?)',item.id,next.id,JSON.stringify(next));
    Object.assign(item,{key:next.key,mime:next.mime,size:next.size,filename:next.filename,photoRevision:next.id,photoEditedAt:now,photoEdit:next.edit,updatedAt:now});
    this.sql.exec('UPDATE media SET data=? WHERE id=?',JSON.stringify(item),item.id);
    this.sql.exec('DELETE FROM media_face_scans WHERE media_id=?',item.id);
    this.sql.exec('DELETE FROM media_faces WHERE media_id=?',item.id);
    for(const face of next.faces)this.sql.exec('INSERT INTO media_faces(media_id,id,person_id,data) VALUES(?,?,?,?)',item.id,face.id,face.personId,JSON.stringify(face));
    this.touchTags(item.id);
    // Editing moves existing labels with the pixels. Carry the visitor's valid
    // completion check forward while keeping its original confirmation date.
    if(reviewed)this.sql.exec('UPDATE media_face_reviews SET photo_revision=?,tags_revision=? WHERE media_id=?',next.id,this.tagsRevision(item.id),item.id);
    this.touchMedia(item);
    return {...this.mediaChanged(item,'photo-edit'),...this.photoVersions(item)};
  }
  personMedia(id){return this.rows("SELECT m.data FROM media m WHERE m.id IN (SELECT id FROM media WHERE person_id=? AND category='personal' UNION SELECT media_id FROM media_tags WHERE person_id=?) ORDER BY m.rowid",id,id).map(row=>JSON.parse(row.data));}
  personPhotos(id){return this.personMedia(id).filter(item=>mediaKind(item)==='photo');}
  tagIds(id){return this.rows('SELECT person_id FROM media_tags WHERE media_id=? ORDER BY rowid',id).map(row=>row.person_id);}
  tags(id){return this.rows('SELECT p.id,p.data FROM media_tags t JOIN people p ON p.id=t.person_id WHERE t.media_id=? ORDER BY t.rowid DESC',id).map(row=>{const person=JSON.parse(row.data);return {id:person.id,name:person.name,nameEn:person.nameEn||null,birthday:person.birthday||null,extra:Boolean(person.extra)};});}
  tagsRevision(id){return this.rows('SELECT value FROM meta WHERE id=?','tags:'+id)[0]?.value||'empty';}
  faces(id,includeHidden=false){
    // Ordinary tag removal hides matching face labels. Undo can restore the same coordinates.
    return this.rows('SELECT f.data,p.data AS person FROM media_faces f JOIN people p ON p.id=f.person_id WHERE f.media_id=?'+(includeHidden?'':' AND EXISTS (SELECT 1 FROM media_tags t WHERE t.media_id=f.media_id AND t.person_id=f.person_id)')+' ORDER BY f.rowid',id).map(row=>{const face=JSON.parse(row.data),person=JSON.parse(row.person);return {...face,person:{id:person.id,name:person.name,nameEn:person.nameEn||null,extra:Boolean(person.extra)}};});
  }
  removeUnusedFaceTag(item,personId){
    if(!personId||this.rows('SELECT id FROM media_faces WHERE media_id=? AND person_id=? LIMIT 1',item.id,personId).length)return null;
    if(!this.rows('SELECT person_id FROM media_tags WHERE media_id=? AND person_id=?',item.id,personId).length)return null;
    return this.patchTags(item.id,[{personId,tagged:false}]);
  }
  saveFace(p){
    const item=this.media(p.id);if(mediaKind(item)!=='photo')throw new HttpError(400,'אפשר לתייג פנים בתמונות בלבד.');
    if(typeof p.faceId!=='string'||!/^[a-f0-9]{32}$/.test(p.faceId))throw new HttpError(400,'אזור הפנים אינו תקין.');
    const faces=this.faces(item.id,true),previous=faces.find(face=>face.id===p.faceId);
    if((previous?.revision||null)!==p.expectedRevision)throw new HttpError(409,'תיוג הפנים עודכן בינתיים. פתחו אותו מחדש לפני שמירה.');
    if(p.personId===null&&p.name===undefined){
      if(previous)return {...this.ignoreFace({id:item.id,rect:previous.rect,ignored:true,photoRevision:item.photoRevision||'original',faceId:previous.id,expectedRevision:previous.revision}),operation:'faces',face:null};
      return {saved:true,operation:'faces',scope:this.mediaScope(item),item:this.mediaPublic(item),faces:this.faces(item.id),face:null};
    }
    if(p.name!==undefined?(p.personId!==undefined||typeof p.name!=='string'):typeof p.personId!=='string')throw new HttpError(400,'בחרו אדם מהרשימה או הזינו שם חדש.');
    const selection=p.name===undefined?{personId:p.personId}:{name:p.name},rect=faceRect(p.rect);
    const tagged=new Set(this.tagIds(item.id)),replaced=faces.filter(face=>face.id!==p.faceId&&!tagged.has(face.personId)&&sameFaceRegion(face.rect,rect));
    if(!previous&&faces.length-replaced.length>=FACE_LIMIT)throw new HttpError(400,'אפשר לתייג עד 150 אזורי פנים בתמונה.');
    if(faces.some(face=>face.id!==p.faceId&&tagged.has(face.personId)&&sameFaceRegion(face.rect,rect)))throw new HttpError(409,'אזור הפנים הזה כבר תויג. פתחו אותו מחדש כדי לשנות את השם.');
    // A face label and its ordinary photo tag are saved in the same transaction.
    // Resolve free names through the same roster as ordinary tags, so existing
    // names are reused and an invalid or conflicting face cannot leave an orphan.
    const replaceLast=previous&&!faces.some(other=>other.id!==previous.id&&other.personId===previous.personId);
    // Remove then add in one patch, including when a photo already has 150 tags.
    // Choosing the same name (or its alias) leaves that ordinary tag intact.
    const result=this.patchTags(item.id,[...(replaceLast?[{personId:previous.personId,tagged:false}]:[]),{...selection,tagged:true}]),personId=result.taggedPeople.at(-1).id;
    const now=new Date().toISOString(),face={id:p.faceId,rect,personId,revision:uid(),createdAt:previous?.createdAt||now,updatedAt:now};
    // An explicit new label can reuse a previously dismissed position.
    const ignoredFaces=this.setIgnoredFace(item,rect,false);
    for(const old of replaced)this.sql.exec('DELETE FROM media_faces WHERE media_id=? AND id=?',item.id,old.id);
    this.sql.exec('INSERT INTO media_faces(media_id,id,person_id,data) VALUES(?,?,?,?) ON CONFLICT(media_id,id) DO UPDATE SET person_id=excluded.person_id,data=excluded.data',item.id,face.id,face.personId,JSON.stringify(face));
    this.touchTags(item.id);this.touchMedia(item);
    const saved=this.faces(item.id);return {...result,taggedPeople:[result.taggedPeople.at(-1)],item:this.mediaPublic(item),operation:'faces',faces:saved,ignoredFaces,face:saved.find(item=>item.id===face.id)};
  }
  faceScan(item){
    const row=this.rows('SELECT * FROM media_face_scans WHERE media_id=? AND photo_revision=? AND version=?',item.id,item.photoRevision||'original',FACE_SCAN_VERSION)[0];
    return row?{...JSON.parse(row.data),total:row.face_count,unmatched:row.unmatched_count}:null;
  }
  ignoredFaces(item){const row=this.rows('SELECT data FROM media_face_ignores WHERE media_id=? AND photo_revision=?',item.id,item.photoRevision||'original')[0];return row?JSON.parse(row.data):[];}
  setIgnoredFace(item,rect,value){
    const previous=this.ignoredFaces(item),matching=previous.filter(other=>withoutIgnored([{rect}],[other]).length===0);
    const ignored=value?(matching.length?previous:[...previous,rect]):previous.filter(other=>!matching.includes(other));
    if(ignored.length>FACE_LIMIT)throw new HttpError(400,'אפשר לשמור עד 150 זיהויים מוסתרים בתמונה.');
    if(JSON.stringify(ignored)!==JSON.stringify(previous))this.sql.exec('INSERT INTO media_face_ignores(media_id,photo_revision,data) VALUES(?,?,?) ON CONFLICT(media_id,photo_revision) DO UPDATE SET data=excluded.data',item.id,item.photoRevision||'original',JSON.stringify(ignored));
    return ignored;
  }
  ignoreFace(p){
    const item=this.photo(p.id);
    if(p.photoRevision!==(item.photoRevision||'original'))throw new HttpError(409,'התמונה השתנתה. פתחו אותה מחדש לפני שינוי הזיהוי.');
    if(typeof p.ignored!=='boolean')throw new HttpError(400,'יש לבחור אם להתעלם מהזיהוי.');
    const rect=faceRect(p.rect),faces=this.faces(item.id,true),selected=p.faceId===undefined?null:faces.find(face=>face.id===p.faceId);
    if(p.faceId!==undefined&&(!selected||selected.revision!==p.expectedRevision))throw new HttpError(409,'תיוג הפנים עודכן בינתיים. פתחו אותו מחדש לפני הסרה.');
    const ignored=this.setIgnoredFace(item,rect,p.ignored),removed=p.ignored?faces.filter(face=>selected?face.id===selected.id:withoutIgnored([face],[rect]).length===0):[];
    for(const face of removed)this.sql.exec('DELETE FROM media_faces WHERE media_id=? AND id=?',item.id,face.id);
    const affectedPersonIds=new Set();
    for(const personId of new Set(removed.map(face=>face.personId))){const result=this.removeUnusedFaceTag(item,personId);for(const id of result?.affectedPersonIds||[])affectedPersonIds.add(id);}
    if(removed.length)this.touchTags(item.id);
    this.recountFaces(item.id);this.touchMedia(item);
    return {saved:true,operation:'face-ignore',scope:this.mediaScope(item),item:this.mediaPublic(item),faces:this.faces(item.id),detectedFaces:withoutIgnored(this.faceScan(item)?.faces||[],ignored),ignoredFaces:ignored,affectedPersonIds:[...affectedPersonIds]};
  }
  faceSummary(item){
    const scan=this.faceScan(item),reviewed=Boolean(this.rows('SELECT media_id FROM media_face_reviews WHERE media_id=? AND photo_revision=? AND tags_revision=?',item.id,item.photoRevision||'original',this.tagsRevision(item.id))[0]);
    if(reviewed)return {total:scan?.total??this.faces(item.id).length,unmatched:0,partial:false,scanned:Boolean(scan),reviewed:true};
    const tagged=this.tagIds(item.id).length;
    if(!scan&&!tagged)return null;
    return {total:scan?.total??null,unmatched:scan?.unmatched??null,partial:tagged>0,scanned:Boolean(scan),reviewed:false};
  }
  reviewFaces(p){
    const item=this.photo(p.id);
    if(typeof p.complete!=='boolean')throw new HttpError(400,'יש לבחור אם כל הפרצופים תויגו.');
    if(p.photoRevision!==(item.photoRevision||'original')||p.tagsRevision!==this.tagsRevision(item.id))throw new HttpError(409,'התמונה או התיוגים השתנו. פתחו אותה מחדש לפני האישור.');
    if(p.complete)this.sql.exec('INSERT INTO media_face_reviews(media_id,photo_revision,tags_revision,completed_at) VALUES(?,?,?,?) ON CONFLICT(media_id) DO UPDATE SET photo_revision=excluded.photo_revision,tags_revision=excluded.tags_revision,completed_at=excluded.completed_at',item.id,p.photoRevision,p.tagsRevision,new Date().toISOString());
    else this.sql.exec('DELETE FROM media_face_reviews WHERE media_id=?',item.id);
    this.touchMedia(item);
    return {saved:true,operation:'face-review',scope:this.mediaScope(item),item:this.mediaPublic(item)};
  }
  recountFaces(id){
    const row=this.rows('SELECT data FROM media_face_scans WHERE media_id=?',id)[0];if(!row)return;
    const coverage=faceCoverage(this.faces(id),withoutIgnored(JSON.parse(row.data).faces,this.ignoredFaces(this.media(id))),this.tagIds(id).length);
    this.sql.exec('UPDATE media_face_scans SET face_count=?,unmatched_count=? WHERE media_id=?',coverage.total,coverage.unmatched,id);
  }
  saveFaceScan(p){
    const item=this.photo(p.id);
    if(p.photoRevision!==(item.photoRevision||'original')||p.version!==FACE_SCAN_VERSION)throw new HttpError(409,'התמונה השתנתה. יש לסרוק את הגרסה הנוכחית.');
    if(!Array.isArray(p.faces)||p.faces.length>FACE_LIMIT)throw new HttpError(400,'תוצאת סריקת הפנים אינה תקינה.');
    const faces=detectionRegions(p.faces.map(face=>{
      if(!face||typeof face.score!=='number'||!Number.isFinite(face.score)||face.score<0||face.score>1)throw new HttpError(400,'תוצאת סריקת הפנים אינה תקינה.');
      return {rect:faceRect(face.rect),score:face.score};
    })),previous=this.faceScan(item);
    // Concurrent visitors must not replace a complete index with a smaller scan.
    const combined=previous?detectionRegions([...previous.faces,...faces]):faces;
    const visible=withoutIgnored(combined,this.ignoredFaces(item)),data={faces:combined,scannedAt:new Date().toISOString()},coverage=faceCoverage(this.faces(item.id),visible,this.tagIds(item.id).length);
    if(!previous||JSON.stringify(previous.faces)!==JSON.stringify(combined)){
      this.sql.exec('INSERT INTO media_face_scans(media_id,photo_revision,version,data,face_count,unmatched_count) VALUES(?,?,?,?,?,?) ON CONFLICT(media_id) DO UPDATE SET photo_revision=excluded.photo_revision,version=excluded.version,data=excluded.data,face_count=excluded.face_count,unmatched_count=excluded.unmatched_count',item.id,p.photoRevision,FACE_SCAN_VERSION,JSON.stringify(data),coverage.total,coverage.unmatched);
      for(const kind of this.mediaCollections(item))this.touch(kind);
    }
    return {saved:true,operation:'face-detection',scope:this.mediaScope(item),item:this.mediaPublic(item),detectedFaces:visible};
  }
  galleryFaceScan(p){
    const after=Number(p.after||0);if(!Number.isSafeInteger(after)||after<0)throw new HttpError(400,'בחרו מיקום סריקה תקין.');
    const reviewed="NOT EXISTS (SELECT 1 FROM media_face_reviews r WHERE r.media_id=m.id AND r.photo_revision=coalesce(json_extract(m.data,'$.photoRevision'),'original') AND r.tags_revision=coalesce((SELECT value FROM meta WHERE id='tags:'||m.id),'empty'))";
    const pending="m.category='gallery' AND "+reviewed+" AND NOT EXISTS (SELECT 1 FROM media_face_scans s WHERE s.media_id=m.id AND s.photo_revision=coalesce(json_extract(m.data,'$.photoRevision'),'original') AND s.version=?)";
    const count=this.rows('SELECT count(*) AS n FROM media m WHERE '+pending,FACE_SCAN_VERSION)[0].n;
    const items=this.rows('SELECT m.rowid AS cursor,m.data FROM media m WHERE '+pending+' AND m.rowid>? ORDER BY m.rowid LIMIT 5',FACE_SCAN_VERSION,after).map(row=>({...this.mediaPublic(JSON.parse(row.data)),cursor:row.cursor}));
    return {items,pending:count,version:FACE_SCAN_VERSION};
  }
  touchTags(id){this.sql.exec('INSERT INTO meta(id,value) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value','tags:'+id,uid());this.recountFaces(id);}
  relatedPeople(item,tagIds=this.tagIds(item.id)){return [...new Set([...(item.category==='personal'?[item.personId]:[]),...tagIds])];}
  touchPeople(ids,clearProfile=null){for(const id of new Set(ids)){const person=this.person(id);if(clearProfile&&person.profileId===clearProfile)person.profileId=null;this.savePerson(person);}}
  mediaScope(item){return item.category==='personal'?'personal:'+item.personId:item.category;}
  mediaCollections(item){return [...new Set([...(item.category==='personal'?[]:[item.category]),...this.rows('SELECT collection FROM media_collections WHERE media_id=?',item.id).map(row=>row.collection)])];}
  mediaPublic(item){return {id:item.id,scope:this.mediaScope(item),file:item.file,filename:item.filename,name:item.name,nameEn:item.nameEn||null,caption:item.caption||'',size:item.size,mime:item.mime,kind:mediaKind(item),src:photoSource(item),...(item.photoRevision?{photoRevision:item.photoRevision}:{}),uploadedAt:item.createdAt,tags:this.tags(item.id),tagsRevision:this.tagsRevision(item.id),
    collections:this.mediaCollections(item),modifiedAt:item.modifiedAt||item.updatedAt||item.photoEditedAt||item.createdAt,
    ...(mediaKind(item)==='photo'?{faceSummary:this.faceSummary(item),labels:photoLabels(item.labels),takenDate:photoDate(item.takenDate),takenDateRevision:item.takenDateRevision||'empty'}:{}),
    ...(item.category==='videos'?{videoCategory:item.videoCategory||'family'}:{}),
    ...(item.provider==='youtube'?{provider:'youtube',youtubeId:item.youtubeId,watchUrl:'https://www.youtube.com/watch?v='+item.youtubeId,poster:'https://i.ytimg.com/vi/'+item.youtubeId+'/hqdefault.jpg'}:{})};}
  mediaChanged(item,operation,ids=this.relatedPeople(item)){
    const scope=this.mediaScope(item);
    const people=Object.fromEntries([...new Set(ids)].map(id=>[id,this.snapshot(this.person(id),this.personMedia(id))]));
    return {saved:true,operation,scope,item:this.mediaPublic(item),people,
      ...(item.category==='personal'?{person:people[item.personId]}:{collection:this.collection(item.category)}),
      ...(item.category.startsWith('wedding:')?{wedding:this.wedding(item.category.slice(8))}:{})};
  }
  patchTags(id,changes){
    const item=this.media(id);
    if(!['photo','video'].includes(mediaKind(item)))throw new HttpError(400,'אפשר לתייג אנשים בתמונות ובסרטונים.');
    if(!Array.isArray(changes)||!changes.length||changes.length>150)throw new HttpError(400,'אפשר לתייג עד 150 אנשים בפריט.');
    const oldIds=this.tagIds(id),ids=new Set(oldIds),resolved=[];let roster=null;
    for(const change of changes){
      if(!change||typeof change.tagged!=='boolean'||Boolean(change.personId)===Boolean(change.name))throw new HttpError(400,'יש לבחור אדם אחד לתיוג או להסרת תיוג.');
      let person;
      if(change.personId){if(typeof change.personId!=='string')throw new HttpError(400,'האדם לא נמצא.');person=this.person(change.personId);}
      else{
        if(!change.tagged)throw new HttpError(400,'יש לבחור את האדם שאת התיוג שלו רוצים להסיר.');
        const name=text(change.name,'שם',120,true).replace(/\s+/g,' '),key=normalizedName(name);
        if(!key)throw new HttpError(400,'יש להזין שם מלא.');
        roster??=this.rows('SELECT data FROM people').map(row=>JSON.parse(row.data));
        const matches=matchingPeople(roster,name);
        if(matches.length>1)throw new HttpError(409,'יש כמה אנשים בשם '+name+'. בחרו את האדם המתאים מהרשימה.');
        person=matches[0];
        if(!person){person={id:'extra-'+uid().slice(0,24),name,extra:true,birthday:'1.1.1111',profileId:null,revision:uid(),createdAt:new Date().toISOString()};this.sql.exec('INSERT INTO people(id,data) VALUES(?,?)',person.id,JSON.stringify(person));roster.push(person);}
      }
      if(change.tagged)ids.add(person.id);else ids.delete(person.id);
      resolved.push({key:typeof change.key==='string'?change.key.slice(0,150):person.id,id:person.id,name:person.name,nameEn:person.nameEn||null,extra:Boolean(person.extra)});
    }
    if(ids.size>150)throw new HttpError(400,'אפשר לתייג עד 150 אנשים בפריט.');
    const removed=oldIds.filter(id=>!ids.has(id)),added=[...ids].filter(id=>!oldIds.includes(id));
    const affected=this.relatedPeople(item,[...oldIds,...ids]);
    if(removed.length||added.length){
      for(const personId of removed)this.sql.exec('DELETE FROM media_tags WHERE media_id=? AND person_id=?',id,personId);
      for(const personId of added)this.sql.exec('INSERT INTO media_tags(media_id,person_id) VALUES(?,?)',id,personId);
      this.touchTags(id);
      this.touchPeople(removed.filter(personId=>!(item.category==='personal'&&item.personId===personId)),id);
      this.touchMedia(item,affected);
    }
    // The changed image is sufficient. Never rebuild the gallery or tagged albums on a tag click.
    return {saved:true,operation:'tags',scope:this.mediaScope(item),item:this.mediaPublic(item),affectedPersonIds:affected,taggedPeople:resolved};
  }
  touchMedia(item,ids=this.relatedPeople(item)){
    item.modifiedAt=new Date(Math.max(Date.now(),(Date.parse(item.modifiedAt)||0)+1)).toISOString();
    this.sql.exec('UPDATE media SET data=? WHERE id=?',JSON.stringify(item),item.id);
    this.touchPeople(ids);for(const kind of this.mediaCollections(item))this.touch(kind);
  }
  snapshot(person,items,includeGallery=true){
    const photos=items.filter(item=>mediaKind(item)==='photo'),videos=items.filter(item=>mediaKind(item)==='video');
    const selected=photos.find(photo=>photo.id===person.profileId),profile=selected||photos.find(photo=>photo.category==='personal'&&photo.personId===person.id)||photos[0];
    return {...person,invalidBirthday:false,profile:profile?photoSource(profile):null,profileFile:profile?.file||null,profileIsManual:Boolean(selected),photoCount:photos.length,videoCount:videos.length,documentCount:items.filter(item=>mediaKind(item)==='document').length,mediaCount:items.length,
      ...(includeGallery?{gallery:items.map(item=>({...this.mediaPublic(item),linked:this.mediaScope(item)!=='personal:'+person.id}))}:{})};
  }
  personPage(id,options={}){
    const person=this.person(id),owner="m.id IN (SELECT id FROM media WHERE category='personal' AND person_id=? UNION SELECT t.media_id FROM media_tags t JOIN media live ON live.id=t.media_id WHERE t.person_id=?)";
    const kind="COALESCE(json_extract(m.data,'$.kind'),CASE WHEN json_extract(m.data,'$.mime') LIKE 'image/%' THEN 'photo' WHEN json_extract(m.data,'$.mime') LIKE 'video/%' THEN 'video' ELSE 'document' END)";
    const counts=Object.fromEntries(this.rows('SELECT '+kind+' AS kind,count(*) AS n FROM media m WHERE '+owner+' GROUP BY '+kind,id,id).map(row=>[row.kind,row.n]));
    const albums={};
    for(const [key,type]of [['photos','photo'],['videos','video'],['documents','document']]){
      const requested=Number(options[key]||1);if(!Number.isSafeInteger(requested)||requested<1)throw new HttpError(400,'בחרו מספר עמוד תקין.');
      const total=counts[type]||0,pages=Math.max(1,Math.ceil(total/10)),page=Math.min(requested,pages);
      const items=this.rows('SELECT m.data FROM media m WHERE '+owner+' AND '+kind+'=? ORDER BY m.rowid DESC LIMIT 10 OFFSET ?',id,id,type,(page-1)*10).map(row=>this.mediaPublic(JSON.parse(row.data)));
      albums[key]={items,page,pages,total,size:10};
    }
    const row=this.rows('SELECT m.data FROM media m WHERE '+owner+" AND "+kind+"='photo' ORDER BY CASE WHEN m.id=? THEN 0 WHEN m.category='personal' AND m.person_id=? THEN 1 ELSE 2 END,m.rowid LIMIT 1",id,id,person.profileId||'',id)[0];
    const profile=row?JSON.parse(row.data):null;
    return {person:{...person,about:person.about||'',profile:profile?photoSource(profile):null,profileFile:profile?.file||null,profileIsManual:Boolean(profile&&profile.id===person.profileId),photoCount:counts.photo||0,videoCount:counts.video||0,documentCount:counts.document||0,mediaCount:Object.values(counts).reduce((n,v)=>n+v,0)},albums};
  }
  collection(kind,options={}){
    validCollection(kind);
    const revision=this.rows('SELECT value FROM meta WHERE id=?','collection:'+kind)[0]?.value||'empty';
    if(kind.startsWith('nursery:')){
      const requested=Number(options.page||1),size=10;
      if(!Number.isSafeInteger(requested)||requested<1)throw new HttpError(400,'בחרו מספר עמוד תקין.');
      const total=this.rows('SELECT count(*) AS n FROM media m WHERE m.category=? OR m.id IN (SELECT media_id FROM media_collections WHERE collection=?)',kind,kind)[0].n,pages=Math.max(1,Math.ceil(total/size)),page=Math.min(requested,pages);
      const items=this.rows('SELECT m.data FROM media m WHERE m.category=? OR m.id IN (SELECT media_id FROM media_collections WHERE collection=?) ORDER BY m.rowid DESC LIMIT ? OFFSET ?',kind,kind,size,(page-1)*size).map(row=>this.mediaPublic(JSON.parse(row.data)));
      return {kind,items,count:total,cover:this.albumCover(kind),revision:revision+':'+page,pagination:{page,pages,size,total}};
    }
    if(kind!=='gallery'){
      const items=this.rows('SELECT m.data FROM media m WHERE m.category=? OR m.id IN (SELECT media_id FROM media_collections WHERE collection=?) ORDER BY m.rowid DESC',kind,kind).map(row=>this.mediaPublic(JSON.parse(row.data)));
      return {kind,items,count:items.length,revision,...(kind.startsWith('wedding:')?{cover:this.albumCover(kind,items.find(item=>item.kind==='photo')?.src||null)}:{})};
    }
    const size=Number(options.size||100),requestedPage=Number(options.page||1),query=text(options.query||'','חיפוש',120),filter=options.filter||'all',order=galleryOrdering(options);
    if(!['all','untagged','partial','complete'].includes(filter))throw new HttpError(400,'בחרו סינון תמונות תקין.');
    if(![100,200,300,400,500].includes(size)||!Number.isSafeInteger(requestedPage)||requestedPage<1)throw new HttpError(400,'בחרו עמוד תקין ועד 500 תמונות בעמוד.');
    const like='%'+query.replace(/[\\%_]/g,'\\$&')+'%',args=[kind];
    let where='m.category=?';
    const refinement=galleryRefinement(options);
    const labels=galleryLabels(options.labels);
    if(refinement.people.length){
      if(this.rows('SELECT id FROM people WHERE id IN (SELECT value FROM json_each(?))',JSON.stringify(refinement.people)).length!==refinement.people.length)throw new HttpError(400,'בחרו אדם מהרשימה.');
    }
    if(refinement.members.length){where+=' AND EXISTS (SELECT 1 FROM media_tags f WHERE f.media_id=m.id AND f.person_id IN (SELECT value FROM json_each(?)))';args.push(JSON.stringify(refinement.members));}
    if(labels.length){where+=" AND EXISTS (SELECT 1 FROM json_each(m.data,'$.labels') label WHERE label.value IN (SELECT value FROM json_each(?)))";args.push(JSON.stringify(labels));}
    const unfinished="NOT EXISTS (SELECT 1 FROM media_face_reviews r WHERE r.media_id=m.id AND r.photo_revision=coalesce(json_extract(m.data,'$.photoRevision'),'original') AND r.tags_revision=coalesce((SELECT value FROM meta WHERE id='tags:'||m.id),'empty'))";
    const tagged="EXISTS (SELECT 1 FROM media_tags tagged WHERE tagged.media_id=m.id)",untagged='NOT '+tagged+' AND '+unfinished;
    if(filter==='untagged')where+=' AND '+untagged;
    const partial=tagged+' AND '+unfinished;
    if(filter==='partial')where+=' AND '+partial;
    if(filter==='complete')where+=' AND NOT ('+unfinished+')';
    if(query){
      where+=" AND (lower(json_extract(m.data,'$.name')) LIKE lower(?) ESCAPE '\\' OR lower(json_extract(m.data,'$.caption')) LIKE lower(?) ESCAPE '\\' OR EXISTS (SELECT 1 FROM media_tags t JOIN people p ON p.id=t.person_id WHERE t.media_id=m.id AND (lower(json_extract(p.data,'$.name')) LIKE lower(?) ESCAPE '\\' OR lower(json_extract(p.data,'$.nameEn')) LIKE lower(?) ESCAPE '\\')))";
      args.push(like,like,like,like);
    }
    if(options.selection)return {ids:this.rows('SELECT m.id FROM media m WHERE '+where+' ORDER BY m.rowid DESC',...args).map(row=>row.id)};
    const counts=this.rows('SELECT count(*) AS all_count,coalesce(sum(CASE WHEN '+untagged+' THEN 1 ELSE 0 END),0) AS untagged_count FROM media m WHERE m.category=?',kind)[0];
    const filterCounts={all:counts.all_count,untagged:counts.untagged_count,complete:this.rows('SELECT count(*) AS n FROM media m WHERE m.category=? AND NOT ('+unfinished+')',kind)[0].n,partial:this.rows('SELECT count(*) AS n FROM media m WHERE m.category=? AND '+partial,kind)[0].n};
    const total=query||refinement.person||refinement.unit||labels.length?this.rows('SELECT count(*) AS n FROM media m WHERE '+where,...args)[0].n:filterCounts[filter];
    const pages=Math.max(1,Math.ceil(total/size)),page=Math.min(requestedPage,pages);
    const items=this.rows('SELECT m.data FROM media m WHERE '+where+' ORDER BY '+order.sql+' LIMIT ? OFFSET ?',...args,...order.args,size,(page-1)*size).map(row=>this.mediaPublic(JSON.parse(row.data)));
    const criteria={page,size,query,filter,...refinement,labels:labels.join(','),sort:order.sort,seed:order.seed};
    return {kind,items,count:total,filterCounts,revision:galleryRevision(revision,criteria),pagination:{page,size,total,pages,query,filter,person:refinement.person,unit:refinement.unit,labels:criteria.labels,sort:order.sort,seed:order.seed}};
  }
  touch(kind){this.sql.exec('INSERT INTO meta(id,value) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value','collection:'+kind,uid());}
  albumCover(kind,fallback){
    const selected=this.rows("SELECT m.data FROM album_covers c JOIN media m ON m.id=c.media_id WHERE c.collection=? AND (m.category=c.collection OR EXISTS (SELECT 1 FROM media_collections x WHERE x.media_id=m.id AND x.collection=c.collection)) AND COALESCE(json_extract(m.data,'$.kind'),'photo')='photo'",kind)[0];
    if(selected)return photoSource(JSON.parse(selected.data));
    if(fallback!==undefined)return fallback;
    const latest=this.rows("SELECT m.data FROM media m WHERE (m.category=? OR EXISTS (SELECT 1 FROM media_collections x WHERE x.media_id=m.id AND x.collection=?)) AND COALESCE(json_extract(m.data,'$.kind'),'photo')='photo' ORDER BY m.rowid DESC LIMIT 1",kind,kind)[0];
    return latest?photoSource(JSON.parse(latest.data)):null;
  }
  wedding(id,details=false){
    const pair=couple(id),record=JSON.parse(this.rows('SELECT data FROM weddings WHERE id=?',id)[0].data);
    const collection=this.collection(weddingCollection(id));
    const greetings=this.rows('SELECT data FROM greetings WHERE wedding_id=? ORDER BY rowid DESC',id).map(row=>JSON.parse(row.data));
    return {...pair,...record,mediaCount:collection.count,greetingCount:greetings.length,cover:collection.cover,
      ...(details?{collection,greetings}:{})};
  }
  candleState(person,visitorId){
    const cycle=memorialPeriod(person.deathDate),row=this.rows('SELECT count(*) AS n FROM memorial_candles WHERE person_id=? AND period=?',person.id,cycle.period)[0];
    const lit=Boolean(visitorId&&this.rows('SELECT 1 AS lit FROM memorial_candles WHERE person_id=? AND period=? AND visitor_id=?',person.id,cycle.period,visitorId).length);
    return {...cycle,count:row.n,lit};
  }
  run(action,p){
    switch(action){
      case 'nursery':{
        const albums={};
        // One bounded index query supplies covers and counts, without reading other galleries.
        for(const row of this.rows("SELECT latest.category,latest.n,m.data FROM (SELECT category,count(*) AS n,max(media_row) AS newest FROM (SELECT category,rowid AS media_row,id FROM media WHERE category>='nursery:' AND category<'nursery;' UNION SELECT c.collection AS category,m.rowid AS media_row,m.id FROM media_collections c JOIN media m ON m.id=c.media_id WHERE c.collection>='nursery:' AND c.collection<'nursery;') GROUP BY category) latest JOIN media m ON m.rowid=latest.newest")){
          const id=row.category.slice(8);try{nurseryCollection(id);}catch{continue;}
          const item=JSON.parse(row.data);albums[id]={count:row.n,cover:photoSource(item)};
        }
        for(const row of this.rows("SELECT c.collection,m.data FROM album_covers c JOIN media m ON m.id=c.media_id WHERE c.collection>='nursery:' AND c.collection<'nursery;' AND (m.category=c.collection OR EXISTS (SELECT 1 FROM media_collections x WHERE x.media_id=m.id AND x.collection=c.collection))")){
          const id=row.collection.slice(8);if(albums[id])albums[id].cover=photoSource(JSON.parse(row.data));
        }
        return {albums};
      }
      case 'memorial':return {candles:Object.fromEntries(this.rows("SELECT data FROM people WHERE json_extract(data,'$.deceased')=1").map(row=>{const person=JSON.parse(row.data);return [person.id,this.candleState(person,p.visitorId)];}))};
      case 'candle.light':{
        const person=this.person(p.id);if(!person.deceased)throw new HttpError(400,'אפשר להדליק נר בעמוד לזכרם בלבד.');
        if(typeof p.visitorId!=='string'||!/^[a-f0-9]{32}$/.test(p.visitorId))throw new HttpError(400,'לא ניתן לזהות את ההדלקה. רעננו את העמוד ונסו שוב.');
        const {period}=memorialPeriod(person.deathDate);
        this.sql.exec('INSERT OR IGNORE INTO memorial_candles(person_id,period,visitor_id,created_at) VALUES(?,?,?,?)',person.id,period,p.visitorId,new Date(Date.now()).toISOString());
        return {saved:true,id:person.id,candle:this.candleState(person,p.visitorId)};
      }
      case 'game.jachnun.scores':return {scores:this.rows('SELECT id,name,score,head_id AS headId,created_at AS createdAt FROM jachnun_scores ORDER BY score DESC,created_at,id LIMIT ?',JACHNUN_SCORE_LIMIT),limit:JACHNUN_SCORE_LIMIT};
      case 'game.jachnun.score.add':{
        const entry=jachnunScore(p),previous=this.rows('SELECT name,score,head_id AS headId FROM jachnun_scores WHERE id=?',entry.id)[0];
        if(previous&&(previous.name!==entry.name||previous.score!==entry.score||previous.headId!==entry.headId))throw new HttpError(409,'התוצאה של המשחק הזה כבר נשמרה.');
        if(!previous)this.sql.exec('INSERT INTO jachnun_scores(id,name,score,head_id,created_at) VALUES(?,?,?,?,?)',entry.id,entry.name,entry.score,entry.headId,new Date().toISOString());
        const rank=this.rows('SELECT count(*) AS n FROM jachnun_scores s JOIN jachnun_scores own ON own.id=? WHERE s.score>own.score OR (s.score=own.score AND (s.created_at<own.created_at OR (s.created_at=own.created_at AND s.id<own.id)))',entry.id)[0].n+1;
        return {saved:true,id:entry.id,rank,...this.run('game.jachnun.scores')};
      }
      case 'game.rex.scores':return {scores:this.rows('SELECT id,name,score,head_id AS headId,basket,created_at AS createdAt FROM rex_scores ORDER BY score DESC,created_at,id LIMIT ?',REX_SCORE_LIMIT).map(row=>({...row,basket:JSON.parse(row.basket)})),limit:REX_SCORE_LIMIT};
      case 'game.rex.score.add':{
        const entry=rexScore(p),previous=this.rows('SELECT name,score,head_id AS headId,basket FROM rex_scores WHERE id=?',entry.id)[0];
        const basket=JSON.stringify(entry.basket);
        if(previous&&(previous.name!==entry.name||previous.score!==entry.score||previous.headId!==entry.headId||previous.basket!==basket))throw new HttpError(409,'התוצאה של המשחק הזה כבר נשמרה.');
        if(!previous)this.sql.exec('INSERT INTO rex_scores(id,name,score,head_id,basket,created_at) VALUES(?,?,?,?,?,?)',entry.id,entry.name,entry.score,entry.headId,basket,new Date().toISOString());
        const rank=this.rows('SELECT count(*) AS n FROM rex_scores s JOIN rex_scores own ON own.id=? WHERE s.score>own.score OR (s.score=own.score AND (s.created_at<own.created_at OR (s.created_at=own.created_at AND s.id<own.id)))',entry.id)[0].n+1;
        return {saved:true,id:entry.id,rank,...this.run('game.rex.scores')};
      }
      case 'game.neto-tetris.scores':return {scores:this.rows('SELECT id,name,score,lines,level,pieces,zaps,created_at AS createdAt FROM neto_tetris_scores ORDER BY score DESC,created_at,id LIMIT ?',NETO_TETRIS_SCORE_LIMIT),limit:NETO_TETRIS_SCORE_LIMIT};
      case 'game.neto-tetris.score.add':{
        const entry=netoTetrisScore(p),previous=this.rows('SELECT name,score,lines,level,pieces,zaps FROM neto_tetris_scores WHERE id=?',entry.id)[0];
        if(previous&&['name','score','lines','level','pieces','zaps'].some(key=>previous[key]!==entry[key]))throw new HttpError(409,'התוצאה של המשחק הזה כבר נשמרה.');
        if(!previous)this.sql.exec('INSERT INTO neto_tetris_scores(id,name,score,lines,level,pieces,zaps,created_at) VALUES(?,?,?,?,?,?,?,?)',entry.id,entry.name,entry.score,entry.lines,entry.level,entry.pieces,entry.zaps,new Date().toISOString());
        const rank=this.rows('SELECT count(*) AS n FROM neto_tetris_scores s JOIN neto_tetris_scores own ON own.id=? WHERE s.score>own.score OR (s.score=own.score AND (s.created_at<own.created_at OR (s.created_at=own.created_at AND s.id<own.id)))',entry.id)[0].n+1;
        return {saved:true,id:entry.id,rank,...this.run('game.neto-tetris.scores')};
      }
      case 'game.ruti-house.scores':return {scores:this.rows('SELECT s.id,s.name,s.score,s.level,s.meals,s.snacks,s.plants,s.dust,s.cats,s.dishes,s.bestCombo,s.elapsed,s.created_at AS createdAt,d.version,d.completed_levels AS completedLevels,d.stage_scores AS stageScores,COALESCE(o.wins,0) AS oraWins,COALESCE(m.missed,0) AS missed,b.stage_results AS stageResults FROM ruti_house_scores s LEFT JOIN ruti_house_score_details d ON d.id=s.id LEFT JOIN ruti_house_ora_bonuses o ON o.id=s.id LEFT JOIN ruti_house_run_metrics m ON m.id=s.id LEFT JOIN ruti_house_completion_bonuses b ON b.id=s.id ORDER BY s.score DESC,s.created_at,s.id LIMIT ?',RUTI_HOUSE_SCORE_LIMIT).map(row=>({...row,stageScores:row.stageScores===null?null:JSON.parse(row.stageScores),stageResults:row.stageResults===null?null:JSON.parse(row.stageResults)})),limit:RUTI_HOUSE_SCORE_LIMIT};
      case 'game.ruti-house.score.add':{
        const entry=rutiHouseScore(p),previous=this.rows('SELECT name,score,level,meals,snacks,plants,dust,cats,dishes,bestCombo,elapsed FROM ruti_house_scores WHERE id=?',entry.id)[0];
        if(previous&&['name',...RUTI_HOUSE_SCORE_FIELDS].some(key=>previous[key]!==entry[key]))throw new HttpError(409,'התוצאה של המשחק הזה כבר נשמרה.');
        const details=this.rows('SELECT version,completed_levels AS completedLevels,stage_scores AS stageScores FROM ruti_house_score_details WHERE id=?',entry.id)[0];
        if(previous&&((details?.version??null)!==entry.version||(details?.completedLevels??null)!==entry.completedLevels||(details?.stageScores??null)!==(entry.stageScores===null?null:JSON.stringify(entry.stageScores))))throw new HttpError(409,'התוצאה של המשחק הזה כבר נשמרה.');
        const priorMissed=this.rows('SELECT missed FROM ruti_house_run_metrics WHERE id=?',entry.id)[0]?.missed??0;
        if(previous&&priorMissed!==entry.missed)throw new HttpError(409,'התוצאה של המשחק הזה כבר נשמרה.');
        const priorOra=this.rows('SELECT wins FROM ruti_house_ora_bonuses WHERE id=?',entry.id)[0]?.wins??0;
        if(previous&&priorOra!==entry.oraWins)throw new HttpError(409,'התוצאה של המשחק הזה כבר נשמרה.');
        const priorResults=this.rows('SELECT stage_results FROM ruti_house_completion_bonuses WHERE id=?',entry.id)[0]?.stage_results??null;
        if(previous&&priorResults!==(entry.stageResults===null?null:JSON.stringify(entry.stageResults)))throw new HttpError(409,'התוצאה של המשחק הזה כבר נשמרה.');
        if(!previous)this.sql.exec('INSERT INTO ruti_house_scores(id,name,score,level,meals,snacks,plants,dust,cats,dishes,bestCombo,elapsed,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',entry.id,entry.name,...RUTI_HOUSE_SCORE_FIELDS.map(key=>entry[key]),new Date().toISOString());
        if(!previous&&entry.version!==null)this.sql.exec('INSERT INTO ruti_house_score_details(id,version,completed_levels,stage_scores) VALUES(?,?,?,?)',entry.id,entry.version,entry.completedLevels,JSON.stringify(entry.stageScores));
        if(!previous&&[4,5,6,7].includes(entry.version))this.sql.exec('INSERT INTO ruti_house_ora_bonuses(id,wins) VALUES(?,?)',entry.id,entry.oraWins);
        if(!previous&&[5,6,7].includes(entry.version))this.sql.exec('INSERT INTO ruti_house_run_metrics(id,missed) VALUES(?,?)',entry.id,entry.missed);
        if(!previous&&[6,7].includes(entry.version))this.sql.exec('INSERT INTO ruti_house_completion_bonuses(id,stage_results) VALUES(?,?)',entry.id,JSON.stringify(entry.stageResults));
        const rank=this.rows('SELECT count(*) AS n FROM ruti_house_scores s JOIN ruti_house_scores own ON own.id=? WHERE s.score>own.score OR (s.score=own.score AND (s.created_at<own.created_at OR (s.created_at=own.created_at AND s.id<own.id)))',entry.id)[0].n+1;
        return {saved:true,id:entry.id,rank,...this.run('game.ruti-house.scores')};
      }
      case 'game.kinship':return {questions:makeKinshipQuiz(family,this.run('people').people),available:kinshipPool(family).length,required:10};
      case 'game.trivia':{
        const language=triviaLanguage(p.language),people=this.run('people').people,custom=this.rows('SELECT id,data FROM trivia_questions WHERE language=? ORDER BY random() LIMIT 30',language).map(row=>({id:row.id,...JSON.parse(row.data)}));
        const questions=mixTriviaQuestions(makeTriviaQuiz(family,people),custom);
        return {questions:questions.length===10?questions:[],available:triviaPool(family,people).pool.length+this.rows('SELECT count(*) n FROM trivia_questions WHERE language=?',language)[0].n,required:10};
      }
      case 'trivia.question.add':{
        const question=validateTriviaQuestion(p),previous=this.rows('SELECT data FROM trivia_questions WHERE id=?',p.requestId)[0];
        if(previous&&previous.data!==JSON.stringify(question))throw new HttpError(409,'הבקשה כבר נשמרה עם תוכן אחר. רעננו את הטופס.');
        if(!previous)this.sql.exec('INSERT INTO trivia_questions(id,language,data,created_at) VALUES(?,?,?,?)',p.requestId,question.language,JSON.stringify(question),new Date(Date.now()).toISOString());
        return {saved:true,id:p.requestId,language:question.language};
      }
      case 'game.missing':
      case 'game.quiz':{
        const missing=action==='game.missing';
        const roster=Object.fromEntries(this.rows('SELECT id,data FROM people').map(row=>[row.id,{...family.people[row.id],...JSON.parse(row.data)}]));
        const tagged=missing?'(SELECT count(*) FROM media_tags t WHERE t.media_id=m.id)>4':'EXISTS (SELECT 1 FROM media_tags t WHERE t.media_id=m.id)';
        const rows=this.rows("SELECT m.data FROM media m WHERE m.category='gallery' AND COALESCE(json_extract(m.data,'$.kind'),'photo')='photo' AND "+tagged+" ORDER BY random() LIMIT 60");
        const tags=new Map();
        if(rows.length){const ids=rows.map(row=>JSON.parse(row.data).id);for(const row of this.rows('SELECT media_id,person_id FROM media_tags WHERE media_id IN ('+ids.map(()=>'?').join(',')+')',...ids)){if(!tags.has(row.media_id))tags.set(row.media_id,[]);tags.get(row.media_id).push(row.person_id);}}
        const questions=(missing?makeMissingQuiz:makeQuiz)(rows.map(row=>{const item=JSON.parse(row.data);return {id:item.id,kind:'photo',tags:tags.get(item.id)||[]};}),roster);
        return {questions:missing||questions.length===10?questions:[],available:questions.length,required:missing?1:10};
      }
      case 'health':this.rows('SELECT value FROM meta WHERE id=?',correctionKey);return {available:true};
      case 'people':{
        if(this.peopleCache)return this.peopleCache;
        const byPerson=new Map();
        for(const row of this.rows('SELECT m.data,t.person_id AS tagged_person FROM media m LEFT JOIN media_tags t ON t.media_id=m.id ORDER BY m.rowid')){
          const item=JSON.parse(row.data);
          for(const id of [...(item.category==='personal'?[item.personId]:[]),...(row.tagged_person?[row.tagged_person]:[])]){
            if(!byPerson.has(id))byPerson.set(id,new Map());byPerson.get(id).set(item.id,item);
          }
        }
        const people=Object.fromEntries(this.rows('SELECT id,data FROM people').map(row=>[row.id,this.snapshot(JSON.parse(row.data),[...(byPerson.get(row.id)?.values()||[])],false)]));
        return this.peopleCache={people,revision:this.peopleRevision};
      }
      case 'people.revision':return {revision:this.peopleRevision};
      case 'person':return this.snapshot(this.person(p.id),this.personMedia(p.id));
      case 'person.page':return this.personPage(p.id,p);
      case 'person.revision':return {revision:this.person(p.id).revision};
      case 'person.about':{
        const person=this.person(p.id),about=text(p.about,'אודות',10000),field=contentField('about',p.language);
        if((person[field]||'')!==p.expectedAbout)throw new HttpError(409,'טקסט האודות השתנה. פתחו שוב את העריכה לפני שמירה.');
        person[field]=about;this.savePerson(person);return {saved:true,person:{...person}};
      }
      case 'person.biography':{
        const person=this.person(p.id),value=biographyValue(p.section,p.value),expected=biographyValue(p.section,p.expectedValue);
        const field=contentField(p.section,p.language),current=person[field]??biographyDefaults[p.section];
        if(JSON.stringify(current)!==JSON.stringify(expected))throw new HttpError(409,'הפרטים השתנו. פתחו שוב את העריכה לפני שמירה.');
        if(JSON.stringify(current)!==JSON.stringify(value)){person[field]=value;this.savePerson(person);}
        return {saved:true,person:{...person}};
      }
      case 'media.public':return {item:this.mediaPublic(this.media(p.id))};
      case 'photo.versions':return this.photoVersions(this.photo(p.id));
      case 'photo.version':{const item=this.photo(p.id),version=this.photoVersion(item,p.versionId);return {...item,...version,id:item.id};}
      case 'photo.prepare':return this.preparePhoto(p);
      case 'photo.save':{
        const {item,base,edit}=this.preparePhoto(p),version=p.version;
        if(!version||typeof version.id!=='string'||!/^[a-f0-9]{32}$/.test(version.id)||!version.key?.startsWith('photo-versions/'+item.id+'/'+version.id+'.'))throw new HttpError(400,'גרסת התמונה אינה תקינה.');
        return this.savePhotoVersion(item,{...version,edit:{...edit,baseVersion:base.id}},transformPhotoFaces(base.faces,edit));
      }
      case 'photo.restore':{
        const item=this.photo(p.id);if(p.expectedVersion!==(item.photoRevision||'original'))throw new HttpError(409,'התמונה נערכה בינתיים. פתחו את העורך מחדש לפני שחזור.');
        const version=this.photoVersion(item,p.versionId);if(version.id===(item.photoRevision||'original'))return {saved:true,...this.photoVersions(item)};
        return this.savePhotoVersion(item,{...version,id:uid(),edit:{restoredFrom:version.id}},version.faces);
      }
      case 'media.collection.add':{
        const item=this.media(p.id),kind=validCollection(p.collection);
        if(mediaKind(item)!=='photo')throw new HttpError(400,'אפשר להוסיף לאלבומים האלה תמונות בלבד.');
        const included=p.included===undefined?true:p.included;
        if(typeof included!=='boolean'||(!included&&kind!=='photos'))throw new HttpError(400,'אפשר להסיר כאן שיוך לתמונות משפחתיות בלבד.');
        if(kind!=='photos'){
          const personId=typeof p.scope==='string'&&p.scope.startsWith('personal:')?p.scope.slice(9):null;
          if(!personId||!this.relatedPeople(item).includes(personId))throw new HttpError(400,'בחרו תמונה מתוך הפרופיל של האדם המתאים.');
          if(kind.startsWith('nursery:')){
            if(nurseryCollection(personId)!==kind)throw new HttpError(400,'בחרו את אלבום התינוקייה של האדם בפרופיל.');
          }else if(kind.startsWith('wedding:')){
            if(!couple(kind.slice(8)).people.includes(personId))throw new HttpError(400,'בחרו את החתונה של האדם בפרופיל.');
          }else throw new HttpError(400,'בחרו תמונות משפחתיות, תינוקייה או חתונה.');
        }
        const present=this.mediaCollections(item).includes(kind);
        if(included&&!present){
          this.sql.exec('INSERT OR IGNORE INTO media_collections(media_id,collection,added_at) VALUES(?,?,?)',item.id,kind,new Date().toISOString());
          this.touchMedia(item);
        }
        if(!included&&present){
          this.sql.exec('DELETE FROM media_collections WHERE media_id=? AND collection=?',item.id,kind);
          if(item.category==='photos'){
            item.category='gallery';item.updatedAt=new Date().toISOString();
            this.sql.exec('UPDATE media SET category=?,data=? WHERE id=?',item.category,JSON.stringify(item),item.id);
          }
          this.touch(kind);this.touchMedia(item);
        }
        return {saved:true,operation:'collection',scope:kind,included,item:this.mediaPublic(item),collection:this.collection(kind),affectedPersonIds:this.relatedPeople(item),...(kind.startsWith('wedding:')?{wedding:this.wedding(kind.slice(8))}:{})};
      }
      case 'gallery.face.scan':return this.galleryFaceScan(p);
      case 'media.face.scan.save':return this.saveFaceScan(p);
      case 'media.face.review':return this.reviewFaces(p);
      case 'media.faces':{const item=this.media(p.id);if(mediaKind(item)!=='photo')throw new HttpError(400,'אפשר לתייג פנים בתמונות בלבד.');const ignoredFaces=this.ignoredFaces(item);return {mediaId:item.id,item:this.mediaPublic(item),faces:this.faces(item.id),detectedFaces:withoutIgnored(this.faceScan(item)?.faces||[],ignoredFaces),ignoredFaces};}
      case 'media.face.ignore':return this.ignoreFace(p);
      case 'media.face.save':return this.saveFace(p);
      case 'media.labels.patch':{
        const item=this.photo(p.id);
        if(typeof p.tagged!=='boolean'||!PHOTO_LABELS.some(label=>label.id===p.label))throw new HttpError(400,'בחרו תגית מהרשימה.');
        const labels=new Set(photoLabels(item.labels));if(p.tagged)labels.add(p.label);else labels.delete(p.label);
        item.labels=photoLabels([...labels]);item.updatedAt=new Date().toISOString();this.sql.exec('UPDATE media SET data=? WHERE id=?',JSON.stringify(item),item.id);this.touchMedia(item);
        return {saved:true,operation:'labels',scope:this.mediaScope(item),item:this.mediaPublic(item)};
      }
      case 'media.caption.id':{
        const item=this.media(p.id),caption=text(p.caption,'כיתוב',5000);
        if((item.caption||'')!==p.expectedCaption)throw new HttpError(409,'הכיתוב השתנה. פתחו שוב את העריכה לפני שמירה.');
        item.caption=caption;item.updatedAt=new Date().toISOString();this.sql.exec('UPDATE media SET data=? WHERE id=?',JSON.stringify(item),item.id);this.touchMedia(item);return this.mediaChanged(item,'caption');
      }
      case 'tag.people':return {people:this.rows('SELECT data FROM people').map(row=>{const item=JSON.parse(row.data);return {id:item.id,name:item.name,nameEn:item.nameEn||null,extra:Boolean(item.extra),branch:family.people[item.id]?.branch||null};})};
      case 'birthday':{
        const person=this.person(p.id);if(person.birthday!==p.expectedBirthday)throw new HttpError(409,'התאריך עודכן בינתיים. סגרו את העריכה ופתחו אותה מחדש לפני שמירה.');
        const value=birthday(p.birthday),deathDate=person.deathDate;
        const time=date=>{const [d,m,y]=date.split('.').map(Number);return Date.UTC(y,m-1,d);};
        if(value!=='1.1.1111'&&deathDate&&time(value)>time(deathDate))throw new HttpError(400,'תאריך הלידה צריך להיות לפני תאריך הפטירה.');
        person.birthday=value;this.savePerson(person);return {saved:true,person:this.snapshot(person,this.personMedia(p.id))};
      }
      case 'death.date':{
        const person=this.person(p.id);
        if(!person.deceased)throw new HttpError(400,'תאריך פטירה זמין לאדם המסומן כמי שנפטר.');
        if((person.deathDate||'')!==p.expectedDate)throw new HttpError(409,'התאריך עודכן בינתיים. סגרו את העריכה ופתחו אותה מחדש לפני שמירה.');
        const date=p.date?calendarDate(p.date,'תאריך פטירה'):null;
        const time=value=>{const [d,m,y]=value.split('.').map(Number);return Date.UTC(y,m-1,d);};
        if(date&&person.birthday!=='1.1.1111'&&time(date)<time(person.birthday))throw new HttpError(400,'תאריך הפטירה צריך להיות אחרי תאריך הלידה.');
        person.deathDate=date;this.savePerson(person);return {saved:true,person:this.snapshot(person,this.personMedia(p.id))};
      }
      case 'media.add':{
        const item=p.item;
        if(item.category==='personal')this.person(item.personId);
        else validCollection(item.category);
        this.sql.exec('INSERT INTO media(id,category,person_id,data) VALUES(?,?,?,?)',item.id,item.category,item.personId||null,JSON.stringify(item));
        if(p.familyPhoto===true&&item.category!=='photos')this.sql.exec('INSERT INTO media_collections(media_id,collection,added_at) VALUES(?,?,?)',item.id,'photos',item.createdAt);
        if(p.faces?.length){
          const faces=p.faces.map(face=>({...face,rect:faceRect(face.rect)}));
          if(faces.length>FACE_LIMIT||faces.some((face,index)=>faces.slice(0,index).some(other=>sameFaceRegion(face.rect,other.rect))))throw new HttpError(400,'אזור הפנים הזה כבר תויג.');
          const result=this.patchTags(item.id,faces.map((face,index)=>({key:String(index),tagged:true,...(face.personId?{personId:face.personId}:{name:face.name})})));
          for(const [index,input]of faces.entries()){
            const person=result.taggedPeople.find(person=>person.key===String(index)),face={id:uid(),rect:input.rect,personId:person.id,revision:uid(),createdAt:item.createdAt,updatedAt:item.createdAt};
            this.sql.exec('INSERT INTO media_faces(media_id,id,person_id,data) VALUES(?,?,?,?)',item.id,face.id,person.id,JSON.stringify(face));
          }
        }
        if(p.complete===true)this.sql.exec('INSERT INTO media_face_reviews(media_id,photo_revision,tags_revision,completed_at) VALUES(?,?,?,?)',item.id,item.photoRevision||'original',this.tagsRevision(item.id),item.createdAt);
        this.touchMedia(item);
        return {saved:true};
      }
      case 'media.get':return this.media(p.id);
      case 'media.tags':{
        const item=this.media(p.id);if(!['photo','video'].includes(mediaKind(item)))throw new HttpError(400,'אפשר לתייג אנשים בתמונות ובסרטונים.');
        return {item:this.mediaPublic(item)};
      }
      case 'media.photo-date':{
        const item=this.photo(p.id);
        if(p.expectedRevision!==(item.takenDateRevision||'empty'))throw new HttpError(409,'תאריך הצילום עודכן בינתיים. סגרו ופתחו את העריכה מחדש.');
        let date;try{if(!p.date)throw Error();date=photoDate(p.date);}catch{throw new HttpError(400,'תאריך הצילום אינו תקין. אפשר להשאיר שדות לא ידועים ריקים.');}
        if(JSON.stringify(date)!==JSON.stringify(photoDate(item.takenDate))){
          item.takenDate=date;item.takenDateRevision=uid();
          this.sql.exec('UPDATE media SET data=? WHERE id=?',JSON.stringify(item),item.id);this.touchMedia(item);
        }
        return {saved:true,operation:'photo-date',scope:this.mediaScope(item),item:this.mediaPublic(item),affectedPersonIds:this.relatedPeople(item)};
      }
      case 'media.tags.patch':return this.patchTags(p.id,p.changes);
      case 'media.tag':{
        const item=this.media(p.id);
        if(typeof p.tagged!=='boolean'||(Boolean(p.personId)===Boolean(p.name)))throw new HttpError(400,'יש לבחור אדם אחד לתיוג או להסרת תיוג.');
        const ids=new Set(this.tagIds(item.id));
        if(p.personId){if(typeof p.personId!=='string')throw new HttpError(400,'האדם לא נמצא.');this.person(p.personId);if(p.tagged)ids.add(p.personId);else ids.delete(p.personId);}
        else if(!p.tagged)throw new HttpError(400,'יש לבחור את האדם שאת התיוג שלו רוצים להסיר.');
        const result=this.run('media.tags.save',{id:item.id,personIds:[...ids],newNames:p.name?[p.name]:[],expectedRevision:this.tagsRevision(item.id)});
        const person=p.personId?this.person(p.personId):matchingPeople(result.item.tags,p.name)[0];
        return {...result,tagged:p.tagged,taggedPerson:{id:person.id,name:person.name,nameEn:person.nameEn||null,extra:Boolean(person.extra)}};
      }
      case 'media.tags.save':{
        const item=this.media(p.id);if(!['photo','video'].includes(mediaKind(item)))throw new HttpError(400,'אפשר לתייג אנשים בתמונות ובסרטונים.');
        if(p.expectedRevision!==this.tagsRevision(item.id))throw new HttpError(409,'התיוגים עודכנו בינתיים. פתחו שוב את התיוגים לפני השמירה.');
        if(!Array.isArray(p.personIds)||!Array.isArray(p.newNames)||p.personIds.length+p.newNames.length>150||p.newNames.length>50)throw new HttpError(400,'אפשר לתייג עד 150 אנשים בפריט.');
        const ids=new Set();
        for(const id of p.personIds){if(typeof id!=='string')throw new HttpError(400,'יש לבחור אנשים מהרשימה.');this.person(id);ids.add(id);}
        const roster=p.newNames.length?this.rows('SELECT data FROM people').map(row=>JSON.parse(row.data)):[];
        for(const value of p.newNames){
          const name=text(value,'שם',120,true).replace(/\s+/g,' '),normalized=normalizedName(name);
          if(!normalized)throw new HttpError(400,'יש להזין שם מלא.');
          const matching=matchingPeople(roster,name);
          if(matching.length>1)throw new HttpError(409,'יש כמה אנשים בשם '+name+'. בחרו את האדם המתאים מהרשימה.');
          let person=matching[0];
          if(!person){person={id:'extra-'+uid().slice(0,24),name,extra:true,birthday:'1.1.1111',profileId:null,revision:uid(),createdAt:new Date().toISOString()};this.sql.exec('INSERT INTO people(id,data) VALUES(?,?)',person.id,JSON.stringify(person));roster.push(person);}
          ids.add(person.id);
        }
        const oldIds=this.tagIds(item.id),affected=this.relatedPeople(item,[...oldIds,...ids]);
        if(oldIds.length!==ids.size||oldIds.some(id=>!ids.has(id))){
          for(const id of oldIds)if(!ids.has(id))this.sql.exec('DELETE FROM media_tags WHERE media_id=? AND person_id=?',item.id,id);
          for(const id of ids)if(!oldIds.includes(id))this.sql.exec('INSERT INTO media_tags(media_id,person_id) VALUES(?,?)',item.id,id);
          this.touchTags(item.id);
          this.touchPeople(oldIds.filter(id=>!ids.has(id)&&!(item.category==='personal'&&item.personId===id)),item.id);
          this.touchMedia(item,affected);
        }
        return this.mediaChanged(item,'tags',affected);
      }
      case 'media.untag':
      case 'media.retag':{
        const item=this.media(p.id),personId=typeof p.scope==='string'&&p.scope.startsWith('personal:')?p.scope.slice(9):null;
        if(!personId||!['photo','video'].includes(mediaKind(item))||(item.category==='personal'&&item.personId===personId))throw new HttpError(400,'יש לערוך את התיוגים של הפריט באלבום הזה.');
        const person=this.person(personId),ids=this.tagIds(item.id),affected=this.relatedPeople(item,[...ids,personId]);
        const wasProfile=person.profileId===item.id;
        if(action==='media.untag'){
          if(!ids.includes(personId))throw new HttpError(404,'הפריט כבר לא מופיע באלבום הזה.');
          this.sql.exec('DELETE FROM media_tags WHERE media_id=? AND person_id=?',item.id,personId);
          if(wasProfile){person.profileId=null;this.savePerson(person);}
        }else{
          this.sql.exec('INSERT OR IGNORE INTO media_tags(media_id,person_id) VALUES(?,?)',item.id,personId);
          if(p.restoreProfile===true&&mediaKind(item)==='photo'&&!person.profileId){person.profileId=item.id;this.savePerson(person);}
        }
        this.touchTags(item.id);this.touchMedia(item,affected);
        return {...this.mediaChanged(item,action.slice(6),affected),wasProfile,contextScope:p.scope};
      }
      case 'media.delete':{
        const item=this.media(p.id);
        if(this.mediaScope(item)!==p.scope)throw new HttpError(404,'הפריט לא נמצא באלבום הזה.');
        if(item.category==='attachment')throw new HttpError(400,'מסמך זה הוא חלק מסיפור.');
        if(item.category!=='personal')validCollection(item.category);
        const affected=this.relatedPeople(item),selected=affected.filter(id=>this.person(id).profileId===item.id);
        this.sql.exec('INSERT INTO media_trash(id,data,deleted_at,profile_selected) VALUES(?,?,?,?)',item.id,JSON.stringify({...item,_profilePeople:selected}),new Date().toISOString(),selected.includes(item.personId)?1:0);
        this.sql.exec('DELETE FROM media WHERE id=?',item.id);
        this.touchPeople(selected,item.id);this.touchMedia(item,affected);
        return this.mediaChanged(item,'delete',affected);
      }
      case 'media.restore':{
        const row=this.rows('SELECT data,profile_selected FROM media_trash WHERE id=?',p.id)[0];
        if(!row)throw new HttpError(404,'לא נמצא פריט שניתן לשחזר.');
        const {_profilePeople,...item}=JSON.parse(row.data);
        if(this.mediaScope(item)!==p.scope)throw new HttpError(404,'הפריט לא נמצא באלבום הזה.');
        this.sql.exec('INSERT INTO media(id,category,person_id,data) VALUES(?,?,?,?)',item.id,item.category,item.personId||null,JSON.stringify(item));
        this.sql.exec('DELETE FROM media_trash WHERE id=?',item.id);
        for(const id of _profilePeople||(row.profile_selected&&item.personId?[item.personId]:[])){const person=this.person(id);if(!person.profileId&&this.personPhotos(id).some(photo=>photo.id===item.id)){person.profileId=item.id;this.savePerson(person);}}
        this.touchMedia(item);
        return this.mediaChanged(item,'restore');
      }
      case 'media.caption':{
        const caption=text(p.caption,'תיאור',5000),category=p.personId?'personal':p.kind;
        const candidates=p.personId?this.personMedia(p.personId):this.rows('SELECT m.data FROM media m WHERE m.category=? OR m.id IN (SELECT media_id FROM media_collections WHERE collection=?)',category,category).map(row=>JSON.parse(row.data));
        const item=candidates.find(item=>item.file===p.file);if(!item)throw new HttpError(404,'הקובץ לא נמצא באלבום הזה.');
        item.caption=caption;item.updatedAt=new Date().toISOString();this.sql.exec('UPDATE media SET data=? WHERE id=?',JSON.stringify(item),item.id);
        this.touchMedia(item);return this.mediaChanged(item,'caption');
      }
      case 'profile':{
        const person=this.person(p.id),photos=this.personPhotos(p.id),item=photos.find(item=>item.file===p.file);
        if(!item)throw new HttpError(404,'בחרו תמונה מהאלבום של האדם הזה.');
        person.profileId=item.id;this.savePerson(person);return {saved:true,person:this.snapshot(person,this.personMedia(p.id))};
      }
      case 'gallery.selection':return this.collection('gallery',{...p,filter:'all',selection:true});
      case 'gallery.download':{
        if(!Array.isArray(p.ids)||!p.ids.length||p.ids.length>50000||p.ids.some(id=>typeof id!=='string'||!/^([a-f0-9]{32})$/.test(id)))throw new HttpError(400,'בחרו תמונות להורדה.');
        const ids=[...new Set(p.ids)],found=new Map();
        for(let i=0;i<ids.length;i+=80){const batch=ids.slice(i,i+80);for(const row of this.rows("SELECT id,data FROM media WHERE category='gallery' AND id IN ("+batch.map(()=>'?').join(',')+")",...batch)){const item=JSON.parse(row.data);if(mediaKind(item)==='photo')found.set(row.id,item);}}
        if(found.size!==ids.length)throw new HttpError(409,'חלק מהתמונות אינן זמינות. רעננו את הבחירה ונסו שוב.');
        return {items:ids.map(id=>found.get(id))};
      }
      case 'collection':return this.collection(p.kind,p);
      case 'collection.cover':{
        const kind=validCollection(p.kind);
        if(!kind.startsWith('wedding:')&&!kind.startsWith('nursery:'))throw new HttpError(400,'בחרו אלבום חתונה או אלבום תינוקייה.');
        if(typeof p.mediaId!=='string'||!/^[a-f0-9]{32}$/.test(p.mediaId))throw new HttpError(400,'בחרו תמונה מתוך האלבום הזה.');
        const item=this.photo(p.mediaId);
        if(!this.mediaCollections(item).includes(kind))throw new HttpError(404,'בחרו תמונה מתוך האלבום הזה.');
        const previous=this.rows('SELECT media_id FROM album_covers WHERE collection=?',kind)[0];
        if(previous?.media_id!==item.id){this.sql.exec('INSERT INTO album_covers(collection,media_id) VALUES(?,?) ON CONFLICT(collection) DO UPDATE SET media_id=excluded.media_id',kind,item.id);this.touch(kind);}
        return {saved:true,operation:'album-cover',scope:kind,item:this.mediaPublic(item),collection:this.collection(kind),...(kind.startsWith('wedding:')?{wedding:this.wedding(kind.slice(8))}:{})};
      }
      case 'collection.revision':validCollection(p.kind);return {revision:this.rows('SELECT value FROM meta WHERE id=?','collection:'+p.kind)[0]?.value||'empty'};
      case 'dates':return {people:this.rows('SELECT data FROM people').map(row=>JSON.parse(row.data)),weddings:this.rows('SELECT data FROM weddings').map(row=>JSON.parse(row.data))};
      case 'weddings':return {weddings:couples.map(item=>this.wedding(item.id))};
      case 'wedding':return this.wedding(p.id,true);
      case 'wedding.date':{
        const old=this.wedding(p.id);
        if(old.revision!==p.expectedRevision)throw new HttpError(409,'יום הנישואים עודכן בינתיים. פתחו שוב את העריכה לפני שמירה.');
        if(typeof p.date!=='string')throw new HttpError(400,'יש להזין יום נישואים.');
        const date=p.date.trim()?calendarDate(p.date,'יום נישואים'):'';
        if(date==='1.1.1111')throw new HttpError(400,'בחרו שנה אמיתית, או סמנו שהתאריך לא ידוע.');
        this.sql.exec('UPDATE weddings SET data=? WHERE id=?',JSON.stringify({id:p.id,date,revision:uid()}),p.id);
        return {saved:true,wedding:this.wedding(p.id)};
      }
      case 'greeting.add':{
        couple(p.id);
        const item={id:uid().slice(0,24),weddingId:p.id,author:text(p.author||'','שם המברכים',100)||'מהמשפחה',body:text(p.body,'תוכן הברכה',10000,true),createdAt:new Date().toISOString()};
        this.sql.exec('INSERT INTO greetings(id,wedding_id,data) VALUES(?,?,?)',item.id,p.id,JSON.stringify(item));
        return {saved:true,greeting:item};
      }
      case 'stories':return {stories:this.rows('SELECT data FROM stories').map(row=>JSON.parse(row.data)).sort((a,b)=>a.year-b.year||a.createdAt.localeCompare(b.createdAt)),revision:this.rows("SELECT value FROM meta WHERE id='stories'")[0]?.value||'empty'};
      case 'story.save':{
        const fields=p.fields,title=text(fields.title,'כותרת',200,true),author=text(fields.author||'','שם המספר או המספרת',100),body=text(fields.body||'','תוכן הסיפור',100000);
        const year=Number(fields.year);if(!Number.isInteger(year)||year<1||year>new Date().getUTCFullYear())throw new HttpError(400,'יש להזין שנה אמיתית עד השנה הנוכחית.');
        const old=p.id?this.rows('SELECT data FROM stories WHERE id=?',p.id)[0]:null;
        if(p.id&&!old)throw new HttpError(404,'הסיפור לא נמצא.');
        const previous=old?JSON.parse(old.data):null;
        if(previous&&fields.expectedUpdatedAt!==previous.updatedAt)throw new HttpError(409,'הסיפור עודכן בינתיים. סגרו את העריכה ופתחו אותה מחדש לפני שמירה.');
        const attachments=[...(previous?.attachments||[]),...(p.attachments||[])];
        if(attachments.length>10)throw new HttpError(400,'אפשר לצרף עד עשרה מסמכים לסיפור.');
        if(!body&&!attachments.length)throw new HttpError(400,'כתבו את הסיפור או צרפו מסמך.');
        const now=new Date(Math.max(Date.now(),previous?Date.parse(previous.updatedAt)+1:0)).toISOString();
        const item={id:p.id||uid().slice(0,24),year,title,author,body,attachments,createdAt:previous?.createdAt||now,updatedAt:now};
        for(const file of p.files||[])this.sql.exec('INSERT INTO media(id,category,person_id,data) VALUES(?,?,NULL,?)',file.id,'attachment',JSON.stringify(file));
        this.sql.exec('INSERT INTO stories(id,data) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data',item.id,JSON.stringify(item));
        this.sql.exec("INSERT INTO meta(id,value) VALUES('stories',?) ON CONFLICT(id) DO UPDATE SET value=excluded.value",uid());
        return {saved:true,story:item};
      }
      case 'export':return {schemaVersion:3,faceIgnores:this.rows('SELECT media_id AS mediaId,photo_revision AS photoRevision,data FROM media_face_ignores').map(row=>({mediaId:row.mediaId,photoRevision:row.photoRevision,rects:JSON.parse(row.data)})),albumCovers:this.rows('SELECT collection,media_id AS mediaId FROM album_covers'),faceReviews:this.rows('SELECT media_id AS mediaId,photo_revision AS photoRevision,tags_revision AS tagsRevision,completed_at AS completedAt FROM media_face_reviews'),faceScans:this.rows('SELECT s.media_id AS mediaId,s.photo_revision AS photoRevision,s.version,s.data FROM media_face_scans s JOIN media m ON m.id=s.media_id').map(row=>({mediaId:row.mediaId,photoRevision:row.photoRevision,version:row.version,...JSON.parse(row.data)})),photoVersions:this.rows('SELECT v.media_id AS mediaId,v.data FROM photo_versions v JOIN media m ON m.id=v.media_id').map(row=>({mediaId:row.mediaId,...JSON.parse(row.data)})),exportedAt:new Date().toISOString(),people:this.rows('SELECT data FROM people').map(row=>JSON.parse(row.data)),media:this.rows('SELECT data FROM media').map(row=>JSON.parse(row.data)),tags:this.rows('SELECT t.media_id AS mediaId,t.person_id AS personId FROM media_tags t JOIN media m ON m.id=t.media_id'),mediaCollections:this.rows('SELECT c.media_id AS mediaId,c.collection,c.added_at AS addedAt FROM media_collections c JOIN media m ON m.id=c.media_id'),stories:this.rows('SELECT data FROM stories').map(row=>JSON.parse(row.data)),weddings:this.rows('SELECT data FROM weddings').map(row=>JSON.parse(row.data)),greetings:this.rows('SELECT data FROM greetings').map(row=>JSON.parse(row.data)),triviaQuestions:this.rows('SELECT id,data,created_at FROM trivia_questions').map(row=>({id:row.id,...JSON.parse(row.data),createdAt:row.created_at})),faceTags:this.rows('SELECT media_id AS mediaId,data FROM media_faces').map(row=>({mediaId:row.mediaId,...JSON.parse(row.data)}))};
      default:throw new HttpError(404,'הפעולה אינה זמינה.');
    }
  }
  async fetch(request){
    try{
      if(this.initializationError&&Date.now()>=this.nextInitializationAttempt)this.initializeState();
      if(this.initializationError)throw this.initializationError;
      const {action,...p}=await request.json();return json(this.ctx.storage.transactionSync(()=>this.run(action,p)));
    }
    catch(error){return fail(error);}
  }
}
