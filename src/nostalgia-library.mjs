import {HttpError,text,uid} from './http.mjs';
import {photoDate} from '../public/assets/photo-date.mjs';

export const NOSTALGIA_LIBRARY_KEY='nostalgia-library-v1';
export const EVERYDAY_LIFE_DESTINATION='everyday-life-clips';
const everydayLifeDestination=()=>({id:EVERYDAY_LIFE_DESTINATION,categoryId:'everyday-life',name:'החיים עצמם',nameEn:'Life itself',date:null,location:'',directCategory:true,revision:uid(),createdAt:new Date().toISOString()});
const isVideo=item=>item.kind==='video'||/^video\//i.test(item.mime||'');
export const nostalgiaCategories=[
  {id:'birthdays',name:'ימי הולדת',nameEn:'Birthdays',icon:'cake',color:'rose'},
  {id:'holidays',name:'חגים ומועדים',nameEn:'Holidays and celebrations',icon:'lantern',color:'honey'},
  {id:'other-events',name:'אירועים נוספים',nameEn:'Other occasions',icon:'spark',color:'copper'},
  {id:'everyday-life',name:'החיים עצמם',nameEn:'Life itself',icon:'camera',color:'blue'},
  {id:'military',name:'מסיבות גיוס ושחרור',nameEn:'Enlistment and discharge parties',icon:'olive',color:'olive'},
  {id:'bar-bat-mitzvah',name:'בר ובת מצוות',nameEn:'Bar and Bat Mitzvahs',icon:'scroll',color:'plum'}
];
export const nostalgiaEvents=[
  {id:'amir-tomer-gulf-war',categoryId:'everyday-life',name:'אמיר ותומר במלחמת המפרץ',nameEn:'Amir and Tomer during the Gulf War',date:null,location:''},
  {id:'ora-release-1988',categoryId:'military',name:'מסיבת השחרור של אורה',nameEn:'Ora’s discharge party',date:{day:12,month:7,year:1988},location:'דשא בית זקס, גבעת ברנר'},
  {id:'moran-bar-mitzvah',categoryId:'bar-bat-mitzvah',name:'בר המצווה של מורן',nameEn:'Moran’s Bar Mitzvah',date:null,location:''},
  {id:'independence-1996',categoryId:'holidays',name:'יום העצמאות 1996',nameEn:'Independence Day 1996',date:{year:1996},location:''}
];
const normalized=value=>String(value||'').normalize('NFKD').replace(/[\u0591-\u05c7'"׳״]/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').toLowerCase().trim();
export function historicalNostalgiaEvent(item){
  const value=normalized((item.name||'')+' '+(item.filename||''));
  if(/אורה/.test(value)&&/מסיבת שחרור|מסיבת השחרור/.test(value))return 'ora-release-1988';
  if(/אמיר/.test(value)&&/תומר/.test(value)&&/מלחמת המפרץ/.test(value))return 'amir-tomer-gulf-war';
  if(/מורן|moran/.test(value)&&/בר מצווה|בר המצווה|bar mitzvah/.test(value))return 'moran-bar-mitzvah';
  if(/יום העצמאות/.test(value)&&(/1996/.test(value)||/רחלי/.test(value)))return 'independence-1996';
  return null;
}
export class NostalgiaLibrary{
  constructor(state){this.state=state;}
  read(){const row=this.state.rows('SELECT value FROM meta WHERE id=?',NOSTALGIA_LIBRARY_KEY)[0];if(!row)throw new HttpError(503,'ספריית האירועים עדיין אינה זמינה. נסו לרענן.');return JSON.parse(row.value);}
  write(library){library.revision=uid();this.state.sql.exec('INSERT INTO meta(id,value) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value',NOSTALGIA_LIBRARY_KEY,JSON.stringify(library));this.state.touch('nostalgia');}
  initialize(){
    const stored=this.state.rows('SELECT value FROM meta WHERE id=?',NOSTALGIA_LIBRARY_KEY);
    if(stored.length){
      const library=JSON.parse(stored[0].value);
      // Keep all historical assignments, while providing one direct category destination.
      if(!library.events.some(e=>e.id===EVERYDAY_LIFE_DESTINATION)){library.events.push(everydayLifeDestination());this.write(library);}
      return;
    }
    const library={categories:nostalgiaCategories.map(c=>({...c,revision:uid()})),events:[...nostalgiaEvents.map(e=>({...e,revision:uid(),createdAt:new Date().toISOString()})),everydayLifeDestination()]};
    this.write(library);
    // One migration for the explicitly identified historical events. Later,
    // unclassified uploads stay unclassified until someone selects an event.
    for(const row of this.state.rows("SELECT data FROM media WHERE category='nostalgia'")){
      const item=JSON.parse(row.data),eventId=historicalNostalgiaEvent(item);
      if(eventId&&!item.nostalgiaEventIds?.length){item.nostalgiaEventIds=[eventId];this.state.sql.exec('UPDATE media SET data=? WHERE id=?',JSON.stringify(item),item.id);}
    }
  }
  event(id){const event=this.read().events.find(e=>e.id===id);if(!event)throw new HttpError(404,'האירוע לא נמצא. בחרו אירוע מהרשימה.');return event;}
  attach(item,eventId){
    if(item.category!=='nostalgia')return;
    const ids=eventId?[eventId]:item.nostalgiaEventIds||[];
    if(!Array.isArray(ids)||ids.length>30)throw new HttpError(400,'בחרו עד 30 אירועים לפריט.');
    const events=ids.map(id=>this.event(id));item.nostalgiaEventIds=[...new Set(ids)];
    if(events.some(event=>event.id===EVERYDAY_LIFE_DESTINATION)&&!isVideo(item))throw new HttpError(400,'החיים עצמם מיועדת לסרטונים.');
    if(!item.takenDate&&events[0]?.date){item.takenDate=photoDate(events[0].date);item.takenDateRevision=uid();}
  }
  snapshot(items){
    const library=this.read(),byId=new Map(library.events.map(e=>[e.id,{...e,count:0,videoCount:0,cover:null,coverKind:null}]));
    for(const item of items)for(const id of item.nostalgiaEventIds||[]){const event=byId.get(id);if(!event)continue;event.count++;if(item.kind==='video')event.videoCount++;if(['photo','video'].includes(item.kind)&&(!event.cover||item.kind==='photo'&&event.coverKind!=='photo')){event.cover=item.kind==='photo'?(item.thumbnailSrc||item.src):(item.poster||item.src);event.coverKind=item.poster?'photo':item.kind;}}
    return {...library,events:[...byId.values()]};
  }
  categorySave(p){
    const library=this.read(),name=text(p.name,'שם הקטגוריה',80,true);
    if(library.categories.length>=40)throw new HttpError(400,'אפשר ליצור עד 40 קטגוריות.');
    if(library.categories.some(c=>normalized(c.name)===normalized(name)))throw new HttpError(409,'כבר קיימת קטגוריה בשם הזה.');
    const category={id:uid(),name,nameEn:null,icon:'spark',color:'copper',revision:uid()};library.categories.push(category);this.write(library);
    return {saved:true,category,collection:this.state.collection('nostalgia')};
  }
  eventSave(p){
    const library=this.read(),old=p.id?library.events.find(e=>e.id===p.id):null;
    if(p.id&&!old)throw new HttpError(404,'האירוע לא נמצא.');
    if(old&&p.expectedRevision!==old.revision)throw new HttpError(409,'פרטי האירוע עודכנו בינתיים. פתחו את העריכה מחדש.');
    if(!library.categories.some(c=>c.id===p.categoryId))throw new HttpError(400,'בחרו קטגוריה לאירוע.');
    if(p.id===EVERYDAY_LIFE_DESTINATION||!old&&p.categoryId==='everyday-life')throw new HttpError(400,'החיים עצמם מציגה סרטונים ישירות, ללא תיקיות אירועים.');
    const name=text(p.name,'שם האירוע',140,true),location=text(p.location||'','מיקום',240);let date;
    try{date=photoDate(p.date);}catch{throw new HttpError(400,'תאריך האירוע אינו תקין.');}
    if(library.events.some(e=>e.id!==p.id&&e.categoryId===p.categoryId&&normalized(e.name)===normalized(name)))throw new HttpError(409,'כבר קיים אירוע בשם הזה בקטגוריה.');
    if(!old&&library.events.length>=1500)throw new HttpError(400,'ספריית האירועים מלאה.');
    const event={...(old||{}),id:old?.id||uid(),categoryId:p.categoryId,name,nameEn:old?.name===name?old.nameEn:null,location,date,createdAt:old?.createdAt||new Date().toISOString(),revision:uid()};
    if(old)library.events[library.events.indexOf(old)]=event;else library.events.push(event);this.write(library);
    return {saved:true,event,collection:this.state.collection('nostalgia')};
  }
  assign(p){
    const item=this.state.media(p.id);if(item.category!=='nostalgia')throw new HttpError(400,'אפשר לשייך כאן פריטים מפינת הנוסטלגיה בלבד.');
    for(const values of [p.add||[],p.remove||[]])if(!Array.isArray(values)||values.length>30||values.some(id=>typeof id!=='string'))throw new HttpError(400,'בחרו אירועים תקינים.');
    for(const id of p.add||[]){this.event(id);if(id===EVERYDAY_LIFE_DESTINATION&&!isVideo(item))throw new HttpError(400,'החיים עצמם מיועדת לסרטונים.');}
    const ids=new Set(item.nostalgiaEventIds||[]);for(const id of p.remove||[])ids.delete(id);for(const id of p.add||[])ids.add(id);
    if(ids.size>30)throw new HttpError(400,'בחרו עד 30 אירועים לפריט.');
    item.nostalgiaEventIds=[...ids];this.state.sql.exec('UPDATE media SET data=? WHERE id=?',JSON.stringify(item),item.id);this.state.touch('nostalgia');
    return {saved:true,operation:'nostalgia-event',scope:'nostalgia',item:this.state.mediaPublic(item),collection:this.state.collection('nostalgia')};
  }
}
