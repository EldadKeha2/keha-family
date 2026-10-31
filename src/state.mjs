import family from './family.mjs';
import {HttpError,json,fail,text,birthday,uid} from './http.mjs';

// One SQLite-backed object serializes updates for this family. Binary files live in HF.
export class FamilyState {
  constructor(ctx,env){
    this.ctx=ctx;this.env=env;this.sql=ctx.storage.sql;
    this.sql.exec('CREATE TABLE IF NOT EXISTS people(id TEXT PRIMARY KEY,data TEXT NOT NULL)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS media(id TEXT PRIMARY KEY,category TEXT NOT NULL,person_id TEXT,data TEXT NOT NULL)');
    this.sql.exec('CREATE INDEX IF NOT EXISTS media_owner ON media(person_id)');
    this.sql.exec('CREATE INDEX IF NOT EXISTS media_category ON media(category)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS stories(id TEXT PRIMARY KEY,data TEXT NOT NULL)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS meta(id TEXT PRIMARY KEY,value TEXT NOT NULL)');
    for(const p of Object.values(family.people))this.sql.exec('INSERT OR IGNORE INTO people(id,data) VALUES(?,?)',p.id,JSON.stringify({id:p.id,name:p.name,birthday:p.birthday||'1.1.1111',profileId:null,revision:uid()}));
  }
  rows(query,...args){return this.sql.exec(query,...args).toArray();}
  person(id){const row=this.rows('SELECT data FROM people WHERE id=?',id)[0];if(!row)throw new HttpError(404,'האדם לא נמצא באילן המשפחה.');return JSON.parse(row.data);}
  savePerson(item){item.revision=uid();this.sql.exec('UPDATE people SET data=? WHERE id=?',JSON.stringify(item),item.id);}
  media(id){const row=this.rows('SELECT data FROM media WHERE id=?',id)[0];if(!row)throw new HttpError(404,'הקובץ לא נמצא.');return JSON.parse(row.data);}
  personPhotos(id){return this.rows("SELECT data FROM media WHERE person_id=? AND category='personal' ORDER BY rowid",id).map(row=>JSON.parse(row.data));}
  mediaPublic(item){return {file:item.file,filename:item.filename,name:item.name,caption:item.caption||'',size:item.size,mime:item.mime,src:'/media/'+item.id,uploadedAt:item.createdAt};}
  snapshot(person,photos,includeGallery=true){
    const selected=photos.find(photo=>photo.id===person.profileId),profile=selected||photos[0];
    return {...person,invalidBirthday:false,profile:profile?'/media/'+profile.id:null,profileFile:profile?.file||null,profileIsManual:Boolean(selected),photoCount:photos.length,
      ...(includeGallery?{gallery:photos.map(photo=>this.mediaPublic(photo))}:{})};
  }
  collection(kind){
    if(!['photos','videos'].includes(kind))throw new HttpError(404,'הגלריה לא נמצאה.');
    const items=this.rows('SELECT data FROM media WHERE category=? ORDER BY rowid DESC',kind).map(row=>this.mediaPublic(JSON.parse(row.data)));
    return {kind,items,count:items.length,revision:this.rows('SELECT value FROM meta WHERE id=?','collection:'+kind)[0]?.value||'empty'};
  }
  touch(kind){this.sql.exec('INSERT INTO meta(id,value) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value','collection:'+kind,uid());}
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
        person.birthday=birthday(p.birthday);this.savePerson(person);return {saved:true,person:this.snapshot(person,this.personPhotos(p.id))};
      }
      case 'media.add':{
        const item=p.item;
        if(item.category==='personal')this.person(item.personId);
        this.sql.exec('INSERT INTO media(id,category,person_id,data) VALUES(?,?,?,?)',item.id,item.category,item.personId||null,JSON.stringify(item));
        if(item.category==='personal'){const person=this.person(item.personId);this.savePerson(person);}else if(['photos','videos'].includes(item.category))this.touch(item.category);
        return {saved:true};
      }
      case 'media.get':return this.media(p.id);
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
      case 'export':return {schemaVersion:1,exportedAt:new Date().toISOString(),people:this.rows('SELECT data FROM people').map(row=>JSON.parse(row.data)),media:this.rows('SELECT data FROM media').map(row=>JSON.parse(row.data)),stories:this.rows('SELECT data FROM stories').map(row=>JSON.parse(row.data))};
      default:throw new HttpError(404,'הפעולה אינה זמינה.');
    }
  }
  async fetch(request){
    try{const {action,...p}=await request.json();return json(this.ctx.storage.transactionSync(()=>this.run(action,p)));}
    catch(error){return fail(error);}
  }
}
