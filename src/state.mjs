import family from './family.mjs';
import {HttpError,json,fail,text,birthday,calendarDate,uid} from './http.mjs';
import {couples,couple,weddingCollection,validCollection} from './weddings.mjs';
import {featuredVideos} from './featured-videos.mjs';

// One SQLite-backed object serializes updates for this family. Binary files live in HF.
export class FamilyState {
  constructor(ctx,env){
    this.ctx=ctx;this.env=env;this.sql=ctx.storage.sql;
    this.sql.exec('CREATE TABLE IF NOT EXISTS people(id TEXT PRIMARY KEY,data TEXT NOT NULL)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS media(id TEXT PRIMARY KEY,category TEXT NOT NULL,person_id TEXT,data TEXT NOT NULL)');
    this.sql.exec('CREATE INDEX IF NOT EXISTS media_owner ON media(person_id)');
    this.sql.exec('CREATE INDEX IF NOT EXISTS media_category ON media(category)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS media_trash(id TEXT PRIMARY KEY,data TEXT NOT NULL,deleted_at TEXT NOT NULL,profile_selected INTEGER NOT NULL DEFAULT 0)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS stories(id TEXT PRIMARY KEY,data TEXT NOT NULL)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS meta(id TEXT PRIMARY KEY,value TEXT NOT NULL)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS weddings(id TEXT PRIMARY KEY,data TEXT NOT NULL)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS greetings(id TEXT PRIMARY KEY,wedding_id TEXT NOT NULL,data TEXT NOT NULL)');
    this.sql.exec('CREATE INDEX IF NOT EXISTS greetings_wedding ON greetings(wedding_id)');
    this.ctx.storage.transactionSync(()=>{
      for(const p of Object.values(family.people)){
        this.sql.exec('INSERT OR IGNORE INTO people(id,data) VALUES(?,?)',p.id,JSON.stringify({id:p.id,name:p.name,birthday:p.birthday||'1.1.1111',profileId:null,revision:uid()}));
        // Names come from the family tree; keep birthdays and uploaded albums intact.
        const person=this.person(p.id);
        if(person.name!==p.name||person.deceased!==Boolean(p.deceased)||person.deathDate!==(p.deathDate||null)||(p.aliyahYear&&person.aliyahYear!==p.aliyahYear)){
          person.name=p.name;person.deceased=Boolean(p.deceased);person.deathDate=p.deathDate||null;
          if(p.aliyahYear)person.aliyahYear=p.aliyahYear;
          this.savePerson(person);
        }
      }
      for(const item of couples)this.sql.exec('INSERT OR IGNORE INTO weddings(id,data) VALUES(?,?)',item.id,JSON.stringify({id:item.id,date:'',revision:uid()}));
      // Insert the oldest first because shared albums display the newest row first.
      for(const item of [...featuredVideos].reverse()){
        if(this.rows('SELECT id FROM media WHERE id=?',item.id).length||this.rows('SELECT id FROM media_trash WHERE id=?',item.id).length)continue;
        this.sql.exec('INSERT INTO media(id,category,person_id,data) VALUES(?,?,NULL,?)',item.id,item.category,JSON.stringify(item));this.touch('videos');
      }
    });
  }
  rows(query,...args){return this.sql.exec(query,...args).toArray();}
  person(id){const row=this.rows('SELECT data FROM people WHERE id=?',id)[0];if(!row)throw new HttpError(404,'האדם לא נמצא באילן המשפחה.');return JSON.parse(row.data);}
  savePerson(item){item.revision=uid();this.sql.exec('UPDATE people SET data=? WHERE id=?',JSON.stringify(item),item.id);}
  media(id){const row=this.rows('SELECT data FROM media WHERE id=?',id)[0];if(!row)throw new HttpError(404,'הקובץ לא נמצא.');return JSON.parse(row.data);}
  personPhotos(id){return this.rows("SELECT data FROM media WHERE person_id=? AND category='personal' ORDER BY rowid",id).map(row=>JSON.parse(row.data));}
  mediaScope(item){return item.category==='personal'?'personal:'+item.personId:item.category;}
  mediaPublic(item){return {id:item.id,scope:this.mediaScope(item),file:item.file,filename:item.filename,name:item.name,caption:item.caption||'',size:item.size,mime:item.mime,kind:item.kind||(item.mime.startsWith('image/')?'photo':item.mime.startsWith('video/')?'video':'document'),src:'/media/'+item.id,uploadedAt:item.createdAt,
    ...(item.category==='videos'?{videoCategory:item.videoCategory||'family'}:{}),
    ...(item.provider==='youtube'?{provider:'youtube',youtubeId:item.youtubeId,watchUrl:'https://www.youtube.com/watch?v='+item.youtubeId,poster:'https://i.ytimg.com/vi/'+item.youtubeId+'/hqdefault.jpg'}:{})};}
  mediaChanged(item,operation){
    const scope=this.mediaScope(item);
    return {saved:true,operation,scope,item:this.mediaPublic(item),
      ...(item.category==='personal'?{person:this.snapshot(this.person(item.personId),this.personPhotos(item.personId))}:{collection:this.collection(item.category)}),
      ...(item.category.startsWith('wedding:')?{wedding:this.wedding(item.category.slice(8))}:{})};
  }
  touchMedia(item){if(item.category==='personal'){const person=this.person(item.personId);this.savePerson(person);}else this.touch(item.category);}
  snapshot(person,photos,includeGallery=true){
    const selected=photos.find(photo=>photo.id===person.profileId),profile=selected||photos[0];
    return {...person,invalidBirthday:false,profile:profile?'/media/'+profile.id:null,profileFile:profile?.file||null,profileIsManual:Boolean(selected),photoCount:photos.length,
      ...(includeGallery?{gallery:photos.map(photo=>this.mediaPublic(photo))}:{})};
  }
  collection(kind){
    validCollection(kind);
    const items=this.rows('SELECT data FROM media WHERE category=? ORDER BY rowid DESC',kind).map(row=>this.mediaPublic(JSON.parse(row.data)));
    return {kind,items,count:items.length,revision:this.rows('SELECT value FROM meta WHERE id=?','collection:'+kind)[0]?.value||'empty'};
  }
  touch(kind){this.sql.exec('INSERT INTO meta(id,value) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value','collection:'+kind,uid());}
  wedding(id,details=false){
    const pair=couple(id),record=JSON.parse(this.rows('SELECT data FROM weddings WHERE id=?',id)[0].data);
    const collection=this.collection(weddingCollection(id));
    const greetings=this.rows('SELECT data FROM greetings WHERE wedding_id=? ORDER BY rowid DESC',id).map(row=>JSON.parse(row.data));
    return {...pair,...record,mediaCount:collection.count,greetingCount:greetings.length,cover:collection.items.find(item=>item.kind==='photo')?.src||null,
      ...(details?{collection,greetings}:{})};
  }
  run(action,p){
    switch(action){
      case 'people':{
        const byPerson=new Map();
        for(const row of this.rows("SELECT person_id,data FROM media WHERE category='personal' ORDER BY rowid")){if(!byPerson.has(row.person_id))byPerson.set(row.person_id,[]);byPerson.get(row.person_id).push(JSON.parse(row.data));}
        const people=Object.fromEntries(this.rows('SELECT id,data FROM people').map(row=>[row.id,this.snapshot(JSON.parse(row.data),byPerson.get(row.id)||[],false)]));
        return {people};
      }
      case 'person':return this.snapshot(this.person(p.id),this.personPhotos(p.id));
      case 'birthday':{
        const person=this.person(p.id);if(person.birthday!==p.expectedBirthday)throw new HttpError(409,'התאריך עודכן בינתיים. סגרו את העריכה ופתחו אותה מחדש לפני שמירה.');
        const value=birthday(p.birthday),deathDate=family.people[p.id]?.deathDate;
        const time=date=>{const [d,m,y]=date.split('.').map(Number);return Date.UTC(y,m-1,d);};
        if(value!=='1.1.1111'&&deathDate&&time(value)>time(deathDate))throw new HttpError(400,'תאריך הלידה צריך להיות לפני תאריך הפטירה.');
        person.birthday=value;this.savePerson(person);return {saved:true,person:this.snapshot(person,this.personPhotos(p.id))};
      }
      case 'media.add':{
        const item=p.item;
        if(item.category==='personal')this.person(item.personId);
        else validCollection(item.category);
        this.sql.exec('INSERT INTO media(id,category,person_id,data) VALUES(?,?,?,?)',item.id,item.category,item.personId||null,JSON.stringify(item));
        if(item.category==='personal'){const person=this.person(item.personId);this.savePerson(person);}else this.touch(item.category);
        return {saved:true};
      }
      case 'media.get':return this.media(p.id);
      case 'media.delete':{
        const item=this.media(p.id);
        if(this.mediaScope(item)!==p.scope)throw new HttpError(404,'הפריט לא נמצא באלבום הזה.');
        if(item.category==='attachment')throw new HttpError(400,'מסמך זה הוא חלק מסיפור.');
        if(item.category!=='personal')validCollection(item.category);
        const person=item.personId?this.person(item.personId):null,selected=person?.profileId===item.id;
        this.sql.exec('INSERT INTO media_trash(id,data,deleted_at,profile_selected) VALUES(?,?,?,?)',item.id,JSON.stringify(item),new Date().toISOString(),selected?1:0);
        this.sql.exec('DELETE FROM media WHERE id=?',item.id);
        if(selected){person.profileId=null;this.savePerson(person);}else this.touchMedia(item);
        return this.mediaChanged(item,'delete');
      }
      case 'media.restore':{
        const row=this.rows('SELECT data,profile_selected FROM media_trash WHERE id=?',p.id)[0];
        if(!row)throw new HttpError(404,'לא נמצא פריט שניתן לשחזר.');
        const item=JSON.parse(row.data);
        if(this.mediaScope(item)!==p.scope)throw new HttpError(404,'הפריט לא נמצא באלבום הזה.');
        this.sql.exec('INSERT INTO media(id,category,person_id,data) VALUES(?,?,?,?)',item.id,item.category,item.personId||null,row.data);
        this.sql.exec('DELETE FROM media_trash WHERE id=?',item.id);
        const person=item.personId?this.person(item.personId):null;
        if(row.profile_selected&&person&&!person.profileId){person.profileId=item.id;this.savePerson(person);}else this.touchMedia(item);
        return this.mediaChanged(item,'restore');
      }
      case 'media.caption':{
        const caption=text(p.caption,'תיאור',5000),category=p.personId?'personal':p.kind;
        const candidates=p.personId?this.personPhotos(p.personId):this.rows('SELECT data FROM media WHERE category=?',category).map(row=>JSON.parse(row.data));
        const item=candidates.find(item=>item.file===p.file);if(!item)throw new HttpError(404,'הקובץ לא נמצא באלבום הזה.');
        item.caption=caption;item.updatedAt=new Date().toISOString();this.sql.exec('UPDATE media SET data=? WHERE id=?',JSON.stringify(item),item.id);
        if(p.personId){const person=this.person(p.personId);this.savePerson(person);}else this.touch(p.kind);
        return {saved:true};
      }
      case 'profile':{
        const person=this.person(p.id),photos=this.personPhotos(p.id),item=photos.find(item=>item.file===p.file);
        if(!item)throw new HttpError(404,'בחרו תמונה מהאלבום של האדם הזה.');
        person.profileId=item.id;this.savePerson(person);return {saved:true,person:this.snapshot(person,photos)};
      }
      case 'collection':return this.collection(p.kind);
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
      case 'export':return {schemaVersion:2,exportedAt:new Date().toISOString(),people:this.rows('SELECT data FROM people').map(row=>JSON.parse(row.data)),media:this.rows('SELECT data FROM media').map(row=>JSON.parse(row.data)),stories:this.rows('SELECT data FROM stories').map(row=>JSON.parse(row.data)),weddings:this.rows('SELECT data FROM weddings').map(row=>JSON.parse(row.data)),greetings:this.rows('SELECT data FROM greetings').map(row=>JSON.parse(row.data))};
      default:throw new HttpError(404,'הפעולה אינה זמינה.');
    }
  }
  async fetch(request){
    try{const {action,...p}=await request.json();return json(this.ctx.storage.transactionSync(()=>this.run(action,p)));}
    catch(error){return fail(error);}
  }
}
