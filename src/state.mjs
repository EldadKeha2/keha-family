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
import {nurseryCollection} from './nursery.mjs';
import {faceRect,overlap,FACE_LIMIT} from './faces.mjs';
const normalizedName=value=>value.normalize('NFKD').replace(/[\u0591-\u05c7'"׳״]/g,'').replace(/\s+/g,' ').toLowerCase().trim();
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
    this.sql.exec('CREATE TABLE IF NOT EXISTS media(id TEXT PRIMARY KEY,category TEXT NOT NULL,person_id TEXT,data TEXT NOT NULL)');
    this.sql.exec('CREATE INDEX IF NOT EXISTS media_owner ON media(person_id)');
    this.sql.exec('CREATE INDEX IF NOT EXISTS media_category ON media(category)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS media_tags(media_id TEXT NOT NULL,person_id TEXT NOT NULL,PRIMARY KEY(media_id,person_id))');
    this.sql.exec('CREATE INDEX IF NOT EXISTS media_tags_person ON media_tags(person_id,media_id)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS media_faces(media_id TEXT NOT NULL,id TEXT NOT NULL,person_id TEXT NOT NULL,data TEXT NOT NULL,PRIMARY KEY(media_id,id))');
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
        const nameChanged=person.name!==p.name||person.nameEn!==p.nameEn;
        if(nameChanged||Boolean(person.extended)!==Boolean(p.extended)||person.deceased!==Boolean(p.deceased)||person.deathDate===undefined||(p.aliyahYear&&person.aliyahYear!==p.aliyahYear)||(p.aliyahMonth&&person.aliyahMonth!==p.aliyahMonth)){
          person.name=p.name;person.nameEn=p.nameEn;person.extended=Boolean(p.extended);person.deceased=Boolean(p.deceased);
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
        for(const kind of ['gallery','photos','videos','nostalgia',...couples.map(pair=>weddingCollection(pair.id))])this.touch(kind);
      }
    });
  }
  rows(query,...args){return this.sql.exec(query,...args).toArray();}
  person(id){const row=this.rows('SELECT data FROM people WHERE id=?',id)[0];if(!row)throw new HttpError(404,'האדם לא נמצא באילן המשפחה.');return JSON.parse(row.data);}
  savePerson(item){item.revision=uid();this.sql.exec('UPDATE people SET data=? WHERE id=?',JSON.stringify(item),item.id);this.peopleRevision=uid();this.peopleCache=null;}
  media(id){const row=this.rows('SELECT data FROM media WHERE id=?',id)[0];if(!row)throw new HttpError(404,'הקובץ לא נמצא.');return JSON.parse(row.data);}
  personMedia(id){return this.rows("SELECT m.data FROM media m WHERE m.id IN (SELECT id FROM media WHERE person_id=? AND category='personal' UNION SELECT media_id FROM media_tags WHERE person_id=?) ORDER BY m.rowid",id,id).map(row=>JSON.parse(row.data));}
  personPhotos(id){return this.personMedia(id).filter(item=>mediaKind(item)==='photo');}
  tagIds(id){return this.rows('SELECT person_id FROM media_tags WHERE media_id=? ORDER BY rowid',id).map(row=>row.person_id);}
  tags(id){return this.rows('SELECT p.id,p.data FROM media_tags t JOIN people p ON p.id=t.person_id WHERE t.media_id=? ORDER BY t.rowid DESC',id).map(row=>{const person=JSON.parse(row.data);return {id:person.id,name:person.name,nameEn:person.nameEn||null,extra:Boolean(person.extra)};});}
  tagsRevision(id){return this.rows('SELECT value FROM meta WHERE id=?','tags:'+id)[0]?.value||'empty';}
  faces(id,includeHidden=false){
    // Ordinary tag removal hides matching face labels. Undo can restore the same coordinates.
    return this.rows('SELECT f.data,p.data AS person FROM media_faces f JOIN people p ON p.id=f.person_id WHERE f.media_id=?'+(includeHidden?'':' AND EXISTS (SELECT 1 FROM media_tags t WHERE t.media_id=f.media_id AND t.person_id=f.person_id)')+' ORDER BY f.rowid',id).map(row=>{const face=JSON.parse(row.data),person=JSON.parse(row.person);return {...face,person:{id:person.id,name:person.name,nameEn:person.nameEn||null,extra:Boolean(person.extra)}};});
  }
  saveFace(p){
    const item=this.media(p.id);if(mediaKind(item)!=='photo')throw new HttpError(400,'אפשר לתייג פנים בתמונות בלבד.');
    if(typeof p.faceId!=='string'||!/^[a-f0-9]{32}$/.test(p.faceId))throw new HttpError(400,'אזור הפנים אינו תקין.');
    const faces=this.faces(item.id,true),previous=faces.find(face=>face.id===p.faceId);
    if((previous?.revision||null)!==p.expectedRevision)throw new HttpError(409,'תיוג הפנים עודכן בינתיים. פתחו אותו מחדש לפני שמירה.');
    if(p.personId===null){
      if(previous)this.sql.exec('DELETE FROM media_faces WHERE media_id=? AND id=?',item.id,p.faceId);
      return {saved:true,operation:'faces',scope:this.mediaScope(item),item:this.mediaPublic(item),faces:this.faces(item.id),face:null};
    }
    if(typeof p.personId!=='string')throw new HttpError(400,'בחרו אדם מרשימת בני המשפחה.');
    this.person(p.personId);const rect=faceRect(p.rect);
    const tagged=new Set(this.tagIds(item.id)),replaced=faces.filter(face=>face.id!==p.faceId&&!tagged.has(face.personId)&&overlap(face.rect,rect)>.6);
    if(!previous&&faces.length-replaced.length>=FACE_LIMIT)throw new HttpError(400,'אפשר לתייג עד 150 אזורי פנים בתמונה.');
    if(faces.some(face=>face.id!==p.faceId&&tagged.has(face.personId)&&overlap(face.rect,rect)>.6))throw new HttpError(409,'אזור הפנים הזה כבר תויג. פתחו אותו מחדש כדי לשנות את השם.');
    const now=new Date().toISOString(),face={id:p.faceId,rect,personId:p.personId,revision:uid(),createdAt:previous?.createdAt||now,updatedAt:now};
    // A face label and its ordinary photo tag are saved in the same transaction.
    const result=this.patchTags(item.id,[{personId:p.personId,tagged:true}]);
    for(const old of replaced)this.sql.exec('DELETE FROM media_faces WHERE media_id=? AND id=?',item.id,old.id);
    this.sql.exec('INSERT INTO media_faces(media_id,id,person_id,data) VALUES(?,?,?,?) ON CONFLICT(media_id,id) DO UPDATE SET person_id=excluded.person_id,data=excluded.data',item.id,face.id,face.personId,JSON.stringify(face));
    const saved=this.faces(item.id);return {...result,operation:'faces',faces:saved,face:saved.find(item=>item.id===face.id)};
  }
  touchTags(id){this.sql.exec('INSERT INTO meta(id,value) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value','tags:'+id,uid());}
  relatedPeople(item,tagIds=this.tagIds(item.id)){return [...new Set([...(item.category==='personal'?[item.personId]:[]),...tagIds])];}
  touchPeople(ids,clearProfile=null){for(const id of new Set(ids)){const person=this.person(id);if(clearProfile&&person.profileId===clearProfile)person.profileId=null;this.savePerson(person);}}
  mediaScope(item){return item.category==='personal'?'personal:'+item.personId:item.category;}
  mediaPublic(item){return {id:item.id,scope:this.mediaScope(item),file:item.file,filename:item.filename,name:item.name,nameEn:item.nameEn||null,caption:item.caption||'',size:item.size,mime:item.mime,kind:mediaKind(item),src:'/media/'+item.id,uploadedAt:item.createdAt,tags:this.tags(item.id),tagsRevision:this.tagsRevision(item.id),
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
        const matches=roster.filter(p=>[p.name,p.nameEn].filter(Boolean).some(alias=>normalizedName(alias)===key));
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
  touchMedia(item,ids=this.relatedPeople(item)){this.touchPeople(ids);if(item.category!=='personal')this.touch(item.category);}
  snapshot(person,items,includeGallery=true){
    const photos=items.filter(item=>mediaKind(item)==='photo'),videos=items.filter(item=>mediaKind(item)==='video');
    const selected=photos.find(photo=>photo.id===person.profileId),profile=selected||photos.find(photo=>photo.category==='personal'&&photo.personId===person.id)||photos[0];
    return {...person,invalidBirthday:false,profile:profile?'/media/'+profile.id:null,profileFile:profile?.file||null,profileIsManual:Boolean(selected),photoCount:photos.length,videoCount:videos.length,documentCount:items.filter(item=>mediaKind(item)==='document').length,mediaCount:items.length,
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
    return {person:{...person,about:person.about||'',profile:profile?'/media/'+profile.id:null,profileFile:profile?.file||null,profileIsManual:Boolean(profile&&profile.id===person.profileId),photoCount:counts.photo||0,videoCount:counts.video||0,documentCount:counts.document||0,mediaCount:Object.values(counts).reduce((n,v)=>n+v,0)},albums};
  }
  collection(kind,options={}){
    validCollection(kind);
    const revision=this.rows('SELECT value FROM meta WHERE id=?','collection:'+kind)[0]?.value||'empty';
    if(kind.startsWith('nursery:')){
      const requested=Number(options.page||1),size=10;
      if(!Number.isSafeInteger(requested)||requested<1)throw new HttpError(400,'בחרו מספר עמוד תקין.');
      const total=this.rows('SELECT count(*) AS n FROM media WHERE category=?',kind)[0].n,pages=Math.max(1,Math.ceil(total/size)),page=Math.min(requested,pages);
      const items=this.rows('SELECT data FROM media WHERE category=? ORDER BY rowid DESC LIMIT ? OFFSET ?',kind,size,(page-1)*size).map(row=>this.mediaPublic(JSON.parse(row.data)));
      return {kind,items,count:total,revision:revision+':'+page,pagination:{page,pages,size,total}};
    }
    if(kind!=='gallery'){
      const items=this.rows('SELECT data FROM media WHERE category=? ORDER BY rowid DESC',kind).map(row=>this.mediaPublic(JSON.parse(row.data)));
      return {kind,items,count:items.length,revision};
    }
    const size=Number(options.size||100),requestedPage=Number(options.page||1),query=text(options.query||'','חיפוש',120),filter=options.filter||'all';
    if(!['all','untagged'].includes(filter))throw new HttpError(400,'בחרו סינון תמונות תקין.');
    if(![100,200,300,400,500].includes(size)||!Number.isSafeInteger(requestedPage)||requestedPage<1)throw new HttpError(400,'בחרו עמוד תקין ועד 500 תמונות בעמוד.');
    const like='%'+query.replace(/[\\%_]/g,'\\$&')+'%',args=[kind];
    let where='m.category=?';
    if(filter==='untagged')where+=' AND NOT EXISTS (SELECT 1 FROM media_tags untagged WHERE untagged.media_id=m.id)';
    if(query){
      where+=" AND (lower(json_extract(m.data,'$.name')) LIKE lower(?) ESCAPE '\\' OR lower(json_extract(m.data,'$.caption')) LIKE lower(?) ESCAPE '\\' OR EXISTS (SELECT 1 FROM media_tags t JOIN people p ON p.id=t.person_id WHERE t.media_id=m.id AND (lower(json_extract(p.data,'$.name')) LIKE lower(?) ESCAPE '\\' OR lower(json_extract(p.data,'$.nameEn')) LIKE lower(?) ESCAPE '\\')))";
      args.push(like,like,like,like);
    }
    const counts=this.rows('SELECT count(*) AS all_count,coalesce(sum(CASE WHEN NOT EXISTS (SELECT 1 FROM media_tags t WHERE t.media_id=m.id) THEN 1 ELSE 0 END),0) AS untagged_count FROM media m WHERE m.category=?',kind)[0];
    const filterCounts={all:counts.all_count,untagged:counts.untagged_count};
    const total=query?this.rows('SELECT count(*) AS n FROM media m WHERE '+where,...args)[0].n:filterCounts[filter];
    const pages=Math.max(1,Math.ceil(total/size)),page=Math.min(requestedPage,pages);
    const items=this.rows('SELECT m.data FROM media m WHERE '+where+' ORDER BY m.rowid DESC LIMIT ? OFFSET ?',...args,size,(page-1)*size).map(row=>this.mediaPublic(JSON.parse(row.data)));
    return {kind,items,count:total,filterCounts,revision:revision+':'+page+':'+size+':'+encodeURIComponent(query)+(filter==='untagged'?':untagged':''),pagination:{page,size,total,pages,query,filter}};
  }
  touch(kind){this.sql.exec('INSERT INTO meta(id,value) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value','collection:'+kind,uid());}
  wedding(id,details=false){
    const pair=couple(id),record=JSON.parse(this.rows('SELECT data FROM weddings WHERE id=?',id)[0].data);
    const collection=this.collection(weddingCollection(id));
    const greetings=this.rows('SELECT data FROM greetings WHERE wedding_id=? ORDER BY rowid DESC',id).map(row=>JSON.parse(row.data));
    return {...pair,...record,mediaCount:collection.count,greetingCount:greetings.length,cover:collection.items.find(item=>item.kind==='photo')?.src||null,
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
        for(const row of this.rows("SELECT latest.category,latest.n,m.data FROM (SELECT category,count(*) AS n,max(rowid) AS newest FROM media WHERE category>='nursery:' AND category<'nursery;' GROUP BY category) latest JOIN media m ON m.rowid=latest.newest")){
          const id=row.category.slice(8);try{nurseryCollection(id);}catch{continue;}
          const item=JSON.parse(row.data);albums[id]={count:row.n,cover:'/media/'+item.id};
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
      case 'media.faces':{const item=this.media(p.id);if(mediaKind(item)!=='photo')throw new HttpError(400,'אפשר לתייג פנים בתמונות בלבד.');return {mediaId:item.id,item:this.mediaPublic(item),faces:this.faces(item.id)};}
      case 'media.face.save':return this.saveFace(p);
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
        this.touchMedia(item);
        return {saved:true};
      }
      case 'media.get':return this.media(p.id);
      case 'media.tags':{
        const item=this.media(p.id);if(!['photo','video'].includes(mediaKind(item)))throw new HttpError(400,'אפשר לתייג אנשים בתמונות ובסרטונים.');
        return {item:this.mediaPublic(item)};
      }
      case 'media.tags.patch':return this.patchTags(p.id,p.changes);
      case 'media.tag':{
        const item=this.media(p.id);
        if(typeof p.tagged!=='boolean'||(Boolean(p.personId)===Boolean(p.name)))throw new HttpError(400,'יש לבחור אדם אחד לתיוג או להסרת תיוג.');
        const ids=new Set(this.tagIds(item.id));
        if(p.personId){if(typeof p.personId!=='string')throw new HttpError(400,'האדם לא נמצא.');this.person(p.personId);if(p.tagged)ids.add(p.personId);else ids.delete(p.personId);}
        else if(!p.tagged)throw new HttpError(400,'יש לבחור את האדם שאת התיוג שלו רוצים להסיר.');
        const result=this.run('media.tags.save',{id:item.id,personIds:[...ids],newNames:p.name?[p.name]:[],expectedRevision:this.tagsRevision(item.id)});
        const person=p.personId?this.person(p.personId):result.item.tags.find(person=>[person.name,person.nameEn].filter(Boolean).some(alias=>normalizedName(alias)===normalizedName(p.name.trim().replace(/\s+/g,' '))));
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
          const matching=roster.filter(person=>[person.name,person.nameEn].filter(Boolean).some(alias=>normalizedName(alias)===normalized));
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
        const candidates=p.personId?this.personMedia(p.personId):this.rows('SELECT data FROM media WHERE category=?',category).map(row=>JSON.parse(row.data));
        const item=candidates.find(item=>item.file===p.file);if(!item)throw new HttpError(404,'הקובץ לא נמצא באלבום הזה.');
        item.caption=caption;item.updatedAt=new Date().toISOString();this.sql.exec('UPDATE media SET data=? WHERE id=?',JSON.stringify(item),item.id);
        this.touchMedia(item);return this.mediaChanged(item,'caption');
      }
      case 'profile':{
        const person=this.person(p.id),photos=this.personPhotos(p.id),item=photos.find(item=>item.file===p.file);
        if(!item)throw new HttpError(404,'בחרו תמונה מהאלבום של האדם הזה.');
        person.profileId=item.id;this.savePerson(person);return {saved:true,person:this.snapshot(person,this.personMedia(p.id))};
      }
      case 'collection':return this.collection(p.kind,p);
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
      case 'export':return {schemaVersion:2,exportedAt:new Date().toISOString(),people:this.rows('SELECT data FROM people').map(row=>JSON.parse(row.data)),media:this.rows('SELECT data FROM media').map(row=>JSON.parse(row.data)),tags:this.rows('SELECT t.media_id AS mediaId,t.person_id AS personId FROM media_tags t JOIN media m ON m.id=t.media_id'),stories:this.rows('SELECT data FROM stories').map(row=>JSON.parse(row.data)),weddings:this.rows('SELECT data FROM weddings').map(row=>JSON.parse(row.data)),greetings:this.rows('SELECT data FROM greetings').map(row=>JSON.parse(row.data)),triviaQuestions:this.rows('SELECT id,data,created_at FROM trivia_questions').map(row=>({id:row.id,...JSON.parse(row.data),createdAt:row.created_at})),faceTags:this.rows('SELECT media_id AS mediaId,data FROM media_faces').map(row=>({mediaId:row.mediaId,...JSON.parse(row.data)}))};
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
