import {HttpError,text,uid} from './http.mjs';

export const MEMORY_CATEGORIES=['roots','people','family','childhood','funny'];
export const LEGACY_ALIYAH_MEMORY_ID='53455de497f1386c77d0c8f5';
export const ALIYAH_FILM_STORIES={
  shlomo:{
    id:'a98e784b78060d941831791c',title:'מן ההרים אל רחובות — סרט העלייה של סבא שלמה',author:'שלמה קהא',year:1932,
    body:'סבא שלמה מספר בקולו על חייו בצעדא, על הדרך לעדן כדי לקבל אישור עלייה, ועל ההפלגה לארץ ישראל בשנת 1932.',
  },
  yona:{
    id:'9db38776edfa50f829e727b4',title:'סיפורים מעבר לים — סרט העלייה של סבתא יונה',author:'יונה נקאש קהא',year:1934,
    body:'סבתא יונה מספרת בקולה על ילדותה בצנעא, על תנורי החרס שהכינה עם אמה ועל המסע דרך עדן לארץ ישראל בשנת 1934.',
  },
};

export function initializeAliyahFilmStories(state){
  const migration='aliyah-film-stories-v1';
  if(state.rows('SELECT id FROM meta WHERE id=?',migration).length)return;
  const previous=state.rows('SELECT data FROM stories WHERE id=?',LEGACY_ALIYAH_MEMORY_ID)[0];
  const isCollection=previous&&JSON.parse(previous.data).filmCollection==='aliyah';
  const now=new Date().toISOString();
  for(const [filmId,details] of Object.entries(ALIYAH_FILM_STORIES)){
    const story={...details,filmId,category:'roots',personIds:[filmId],familyScopes:['original'],attachments:[],createdAt:now,updatedAt:now};
    state.sql.exec('INSERT OR IGNORE INTO stories(id,data) VALUES(?,?)',story.id,JSON.stringify(story));
  }
  // Archive the former combined record in the same transaction, including any edits or attachments.
  state.sql.exec('INSERT INTO meta(id,value) VALUES(?,?)',migration,isCollection?previous.data:'applied');
  if(isCollection)state.sql.exec('DELETE FROM stories WHERE id=?',LEGACY_ALIYAH_MEMORY_ID);
  state.sql.exec("INSERT INTO meta(id,value) VALUES('stories',?) ON CONFLICT(id) DO UPDATE SET value=excluded.value",uid());
}
export function memoryCategory(value='family'){
  if(!MEMORY_CATEGORIES.includes(value))throw new HttpError(400,'בחרו קטגוריה לזיכרון.');
  return value;
}
export function memoryYear(value){
  if(value===undefined||value===null||value==='')return null;
  const year=Number(value);
  if(!Number.isInteger(year)||year<1||year>new Date().getUTCFullYear())throw new HttpError(400,'יש להזין שנה אמיתית עד השנה הנוכחית.');
  return year;
}
export function memoryPeople(value,person){
  if(!Array.isArray(value)||value.length>150||value.some(id=>typeof id!=='string'))throw new HttpError(400,'בחרו עד 150 אנשים מהרשימה.');
  const ids=[...new Set(value)];ids.forEach(id=>person(id));return ids;
}
export function memoryTags(ids,person){return (ids||[]).map(id=>{const p=person(id);return {id:p.id,name:p.name,nameEn:p.nameEn||null};});}
export function publicStory(item,person){return {...item,category:MEMORY_CATEGORIES.includes(item.category)?item.category:'family',personIds:item.personIds||[],tags:memoryTags(item.personIds,person)};}
export function recordingFields(fields,person){
  return {title:text(fields.title,'כותרת ההקלטה',200,true),body:text(fields.body||'','תיאור ההקלטה',10000),author:text(fields.author||'','שם המשתף או המשתפת',100),year:memoryYear(fields.year),personIds:memoryPeople(fields.personIds||[],person)};
}
// Separate records keep audio out of existing photo/video albums and their counts.
export class RecordingLibrary{
  constructor(state){this.state=state;}
  initialize(){this.state.sql.exec('CREATE TABLE IF NOT EXISTS recordings(id TEXT PRIMARY KEY,data TEXT NOT NULL)');}
  raw(id){const row=this.state.rows('SELECT data FROM recordings WHERE id=?',id)[0];if(!row)throw new HttpError(404,'ההקלטה לא נמצאה.');return JSON.parse(row.data);}
  public(item){const {key,uploadFields,...data}=item;return {...data,src:'/api/voices/'+item.id+'/audio',tags:memoryTags(item.personIds,id=>this.state.person(id))};}
  list(){return {recordings:this.state.rows('SELECT data FROM recordings ORDER BY rowid DESC').map(row=>this.public(JSON.parse(row.data))),revision:this.state.rows("SELECT value FROM meta WHERE id='recordings'")[0]?.value||'empty'};}
  prepare(p){
    if(!/^[a-f0-9]{32}$/.test(p.id)||!Number.isSafeInteger(p.size)||p.size<=0||p.size>90*1024*1024)throw new HttpError(400,'פרטי ההקלטה אינם תקינים.');
    const fields=recordingFields(p.fields,id=>this.state.person(id)),row=this.state.rows('SELECT data FROM recordings WHERE id=?',p.id)[0];
    if(!row)return {fields};
    const item=JSON.parse(row.data);
    if(item.size!==p.size||item.filename!==p.filename||JSON.stringify(item.uploadFields)!==JSON.stringify(fields))throw new HttpError(409,'פרטי ההקלטה השתנו. בחרו שוב את הקובץ.');
    return {existing:this.public(item),fields};
  }
  add(p){
    const prepared=this.prepare(p);if(prepared.existing)return {saved:true,recording:prepared.existing};
    if(!p.key?.startsWith('recordings/'+p.id+'/')||!p.mime?.startsWith('audio/'))throw new HttpError(400,'קובץ ההקלטה אינו תקין.');
    const now=new Date().toISOString(),item={id:p.id,...prepared.fields,uploadFields:prepared.fields,key:p.key,mime:p.mime,size:p.size,filename:p.filename,createdAt:now,updatedAt:now};
    this.state.sql.exec('INSERT INTO recordings(id,data) VALUES(?,?)',item.id,JSON.stringify(item));this.touch();
    return {saved:true,recording:this.public(item)};
  }
  edit(p){
    const item=this.raw(p.id);if(p.expectedUpdatedAt!==item.updatedAt)throw new HttpError(409,'ההקלטה עודכנה בינתיים. פתחו מחדש את העריכה.');
    Object.assign(item,recordingFields(p,id=>this.state.person(id)),{updatedAt:new Date(Math.max(Date.now(),Date.parse(item.updatedAt)+1)).toISOString()});
    this.state.sql.exec('UPDATE recordings SET data=? WHERE id=?',JSON.stringify(item),item.id);this.touch();return {saved:true,recording:this.public(item)};
  }
  touch(){this.state.sql.exec("INSERT INTO meta(id,value) VALUES('recordings',?) ON CONFLICT(id) DO UPDATE SET value=excluded.value",uid());}
}

export function sniffAudio(head,name){
  const word=(start,end)=>new TextDecoder().decode(head.subarray(start,end)),starts=bytes=>bytes.every((value,index)=>head[index]===value),ext=String(name).match(/\.[^.]+$/)?.[0].toLowerCase();
  if(word(0,4)==='RIFF'&&word(8,12)==='WAVE')return {ext:'.wav',mime:'audio/wav'};
  if(word(0,4)==='OggS')return {ext:'.ogg',mime:'audio/ogg'};
  if(word(0,4)==='fLaC')return {ext:'.flac',mime:'audio/flac'};
  if(word(0,3)==='ID3'||head[0]===255&&(head[1]&224)===224&&(head[1]&6)!==0)return {ext:'.mp3',mime:'audio/mpeg'};
  if(head[0]===255&&(head[1]&246)===240)return {ext:'.aac',mime:'audio/aac'};
  if(word(4,8)==='ftyp'&&(['M4A ','M4B ','F4A '].includes(word(8,12))||['.m4a','.m4b'].includes(ext)&&['isom','iso2','mp41','mp42'].includes(word(8,12))))return {ext:'.m4a',mime:'audio/mp4'};
  if(starts([26,69,223,163])&&word(0,128).includes('webm')&&['.webm','.weba'].includes(ext))return {ext:'.webm',mime:'audio/webm'};
  throw new HttpError(415,'בחרו הקלטת MP3, M4A, WAV, OGG, AAC, FLAC או WebM.');
}
