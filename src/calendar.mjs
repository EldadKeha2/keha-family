import {HttpError} from './http.mjs';

const DAY=86400000;
const heFormat=new Intl.DateTimeFormat('he-IL-u-ca-hebrew',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});
const heFormats=new Map([['he-IL',heFormat]]);
const enMonth=new Intl.DateTimeFormat('en-US',{month:'long',year:'numeric',timeZone:'UTC'});
const holidayCache=new Map(),holidayRequests=new Map();
export const iso=date=>date.toISOString().slice(0,10);
export function civilDate(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))throw new HttpError(400,'יש לבחור תאריך תקין בלוח השנה.');
  const date=new Date(value+'T12:00:00Z');
  if(!Number.isFinite(+date)||iso(date)!==value||date.getUTCFullYear()<1900||date.getUTCFullYear()>2200)throw new HttpError(400,'אפשר להציג שנים בין 1900 ל־2200.');
  return date;
}
export function hebrewDate(date,locale='he-IL'){
  let format=heFormats.get(locale);if(!format){format=new Intl.DateTimeFormat(locale+'-u-ca-hebrew',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});heFormats.set(locale,format);}
  const parts=Object.fromEntries(format.formatToParts(date).filter(part=>part.type!=='literal').map(part=>[part.type,part.value]));
  return {day:Number(parts.day),month:parts.month,year:Number(parts.year)};
}
export function hebrewNumber(value){
  let n=Number(value)%1000,result='';
  for(const [number,letter]of [[400,'ת'],[300,'ש'],[200,'ר'],[100,'ק'],[90,'צ'],[80,'פ'],[70,'ע'],[60,'ס'],[50,'נ'],[40,'מ'],[30,'ל'],[20,'כ']])while(n>=number){result+=letter;n-=number;}
  if(n===15){result+='טו';n=0;}if(n===16){result+='טז';n=0;}
  for(const [number,letter]of [[10,'י'],[9,'ט'],[8,'ח'],[7,'ז'],[6,'ו'],[5,'ה'],[4,'ד'],[3,'ג'],[2,'ב'],[1,'א']])if(n>=number){result+=letter;n-=number;}
  return result.length>1?result.slice(0,-1)+'״'+result.slice(-1):result+'׳';
}
export function monthWindow(anchor,mode='gregorian',language='he'){
  const locale=language==='en-GB'?'en-GB':language.startsWith('en')?'en-US':'he-IL',english=locale!=='he-IL';
  const date=civilDate(anchor);if(!['gregorian','hebrew'].includes(mode))throw new HttpError(400,'יש לבחור לוח עברי או לועזי.');
  let start,end;
  if(mode==='gregorian'){start=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),1,12));end=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,1,12));}
  else{
    const target=hebrewDate(date),key=item=>{const h=hebrewDate(item);return h.year+':'+h.month;},targetKey=target.year+':'+target.month;
    start=new Date(date);while(key(new Date(+start-DAY))===targetKey)start=new Date(+start-DAY);
    end=new Date(+start+DAY);while(key(end)===targetKey)end=new Date(+end+DAY);
  }
  const last=new Date(+end-DAY),gridStart=new Date(+start-start.getUTCDay()*DAY),length=Math.ceil(((+end-+start)/DAY+start.getUTCDay())/7)*7;
  const firstHebrew=hebrewDate(start,locale),lastHebrew=hebrewDate(last,locale);
  const hebrewLabel=(firstHebrew.month===lastHebrew.month?firstHebrew.month:firstHebrew.month+' – '+lastHebrew.month)+' '+(english?lastHebrew.year:hebrewNumber(lastHebrew.year));
  const firstEnglish=enMonth.format(start),lastEnglish=enMonth.format(last),gregorianLabel=firstEnglish===lastEnglish?firstEnglish:firstEnglish+' – '+lastEnglish;
  return {mode,anchor:iso(start)<'1900-01-01'?anchor:iso(start),previous:iso(new Date(+start-DAY)),next:iso(end),start:iso(start),end:iso(last),label:mode==='hebrew'?hebrewLabel:gregorianLabel,hebrewLabel,gregorianLabel,dates:Array.from({length},(_,i)=>iso(new Date(+gridStart+i*DAY)))};
}
function birthdayParts(value){
  const match=/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(String(value));if(!match)return null;
  const [day,month,year]=match.slice(1).map(Number),date=new Date(Date.UTC(year,month-1,day,12));
  return year!==1111&&year>=1000&&date.getUTCFullYear()===year&&date.getUTCMonth()===month-1&&date.getUTCDate()===day?{day,month,year}:null;
}
export function familyCalendar(anchor,mode,people,holidays=[],today,language='he'){
  const locale=language==='en-GB'?'en-GB':language.startsWith('en')?'en-US':'he-IL',english=locale!=='he-IL';
  const month=monthWindow(anchor,mode,language),members=Object.values(people).filter(person=>!person.extra),known=members.map(person=>({person,born:birthdayParts(person.birthday)})).filter(item=>item.born);
  const holidayDays=new Map();
  for(const holiday of holidays){if(!holidayDays.has(holiday.date))holidayDays.set(holiday.date,[]);holidayDays.get(holiday.date).push(holiday);}
  const days=month.dates.map(value=>{
    const date=new Date(value+'T12:00:00Z'),year=date.getUTCFullYear(),hebrew=hebrewDate(date,locale),birthdays=[];
    for(const {person,born}of known){
      const leap=new Date(Date.UTC(year,1,29,12)).getUTCMonth()===1,observedDay=born.month===2&&born.day===29&&!leap?28:born.day;
      if(year<born.year||date.getUTCMonth()+1!==born.month||date.getUTCDate()!==observedDay)continue;
      birthdays.push({id:person.id,name:english&&person.nameEn?person.nameEn:person.name,nameEn:person.nameEn||null,birthday:person.birthday,age:person.deceased?null:year-born.year,deceased:Boolean(person.deceased),leapDayObserved:observedDay!==born.day});
    }
    return {date:value,day:date.getUTCDate(),hebrew:{...hebrew,dayLabel:english?String(hebrew.day):hebrewNumber(hebrew.day)},inMonth:value>=month.start&&value<=month.end,today:value===today,birthdays:birthdays.sort((a,b)=>a.name.localeCompare(b.name,locale)),holidays:holidayDays.get(value)||[]};
  });
  return {...month,today,days,knownBirthdays:known.length,unknownBirthdays:members.length-known.length,birthdayCount:days.filter(day=>day.inMonth).reduce((n,day)=>n+day.birthdays.length,0)};
}
export function holidayUrl(year){return 'https://www.hebcal.com/hebcal?'+new URLSearchParams({v:'1',cfg:'json',year:String(year),month:'x',maj:'on',min:'on',mod:'on',nx:'on',mf:'on',ss:'on',i:'on',c:'off',s:'off',lg:'s'});}
async function yearHolidays(year,ctx){
  const cached=holidayCache.get(year);if(cached?.expires>Date.now())return cached.items;
  if(holidayRequests.has(year))return holidayRequests.get(year);
  const task=(async()=>{
    const url=holidayUrl(year),cache=globalThis.caches?.default,key=new Request(url);
    let response=cache?await cache.match(key):null;
    if(!response){
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),7000);
      try{response=await fetch(url,{signal:controller.signal,headers:{Accept:'application/json'}});}finally{clearTimeout(timer);}
      if(!response.ok)throw Error('Holiday service unavailable');
      if(cache){const stored=new Response(response.clone().body,{headers:{'Content-Type':'application/json','Cache-Control':'public, max-age=86400'}});const save=cache.put(key,stored).catch(()=>{});if(ctx?.waitUntil)ctx.waitUntil(save);else await save;}
    }
    const result=await response.json();if(!Array.isArray(result.items))throw Error('Invalid holiday response');
    const items=result.items.filter(item=>/^\d{4}-\d{2}-\d{2}$/.test(item.date)&&['holiday','roshchodesh'].includes(item.category)).map(item=>({date:item.date,name:String(item.hebrew||item.title).replace(/[\u0591-\u05bd\u05bf-\u05c7]/g,''),category:item.category,subcat:item.subcat||'',title:item.title}));
    holidayCache.set(year,{items,expires:Date.now()+86400000});if(holidayCache.size>12)holidayCache.delete(holidayCache.keys().next().value);return items;
  })();
  holidayRequests.set(year,task);try{return await task;}finally{holidayRequests.delete(year);}
}
export async function calendarResponse(anchor,mode,people,ctx,language='he'){
  if(!['he','en-US','en-GB'].includes(language))language='he';
  const window=monthWindow(anchor,mode,language),years=[...new Set(window.dates.map(date=>Number(date.slice(0,4))))];
  const results=await Promise.allSettled(years.map(year=>yearHolidays(year,ctx))),holidays=results.filter(result=>result.status==='fulfilled').flatMap(result=>result.value);
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jerusalem',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  return {...familyCalendar(anchor,mode,people,language==='he'?holidays:holidays.map(item=>({...item,name:item.title||item.name})),today,language),holidaysAvailable:results.every(result=>result.status==='fulfilled'),holidaySource:'https://www.hebcal.com/'};
}
