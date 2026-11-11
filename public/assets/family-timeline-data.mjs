// Calendar dates stay at their recorded precision; unknown years never get a slot.
export function timelineDate(value) {
  const text=String(value??'').trim();
  let match=/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(text);
  if(match){
    const [day,month,year]=match.slice(1).map(Number),date=new Date(Date.UTC(year,month-1,day));
    if(year===1111||year<1800||date.getUTCFullYear()!==year||date.getUTCMonth()+1!==month||date.getUTCDate()!==day)return null;
    return {year,month,day,precision:'day'};
  }
  match=/^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(text);
  if(!match)return null;
  const year=Number(match[1]),month=match[2]?Number(match[2]):null,day=match[3]?Number(match[3]):null;
  if(year===1111||year<1800||month!==null&&(month<1||month>12))return null;
  if(day!==null)return timelineDate(`${day}.${month}.${year}`);
  return {year,month,day:null,precision:month===null?'year':'month'};
}

export const timelineDecade=year=>year<1930?'before-1930':String(Math.floor(year/10)*10);
const compare=(a,b)=>a.year-b.year||(a.month??0)-(b.month??0)||(a.day??0)-(b.day??0)||a.id.localeCompare(b.id);

export function familyTimeline({people=[],wedding=null,today=new Date()}={}) {
  const year=today.getFullYear(),lastDay=Date.UTC(year,today.getMonth(),today.getDate());
  const allowed=date=>date&&date.year<=year&&Date.UTC(date.year,(date.month||1)-1,date.day||1)<=lastDay;
  const members=people.filter(p=>!p.extra&&!p.extended),events=[],unknown=[];
  for(const person of members){
    const born=timelineDate(person.birthday);
    if(allowed(born)&&!person.invalidBirthday)events.push({id:'birth-'+person.id,kind:'birth',person,...born});
    else if(!person.placeholder)unknown.push(person);
    if(!['yona','shlomo'].includes(person.id))continue;
    const arrival=timelineDate(person.aliyahYear+(person.aliyahMonth?'-'+String(person.aliyahMonth).padStart(2,'0'):''));
    if(allowed(arrival))events.push({id:'aliyah-'+person.id,kind:'aliyah',person,...arrival});
  }
  const married=timelineDate(wedding?.date||wedding?.year);
  const marriage=allowed(married)?{id:'wedding-u-root',kind:'wedding',wedding,...married}:null;
  if(marriage)events.push(marriage);
  events.sort(compare);
  const chapters=[{id:'before-1930',start:null,end:1929,events:[]}];
  for(let start=1930;start<=Math.max(1930,Math.floor(year/10)*10);start+=10)chapters.push({id:String(start),start,end:start+9,events:[]});
  const chapterMap=new Map(chapters.map(c=>[c.id,c]));
  for(const event of events)chapterMap.get(timelineDecade(event.year))?.events.push(event);
  return {chapters,events,unknown,marriage,birthCount:events.filter(e=>e.kind==='birth').length};
}

export function timelineGeneration(person) {
  if(['yona','shlomo'].includes(person?.id))return 1;
  const generation=Number(person?.generation);
  return generation>=4?4:generation===2||generation===3?generation:null;
}

export function nearestTimelineYear(years,target) {
  return years.reduce((best,year)=>best===null||Math.abs(year-target)<Math.abs(best-target)?year:best,null);
}

export function timelineTracks(model) {
  return [1,2,3,4].map(generation=>{
    const events=model.events.filter(event=>event.kind==='wedding'?generation===1:timelineGeneration(event.person)===generation);
    const years=[...new Set(events.map(event=>event.year))].sort((a,b)=>a-b);
    const start=generation===4?1988:years.length?Math.floor(years[0]/10)*10:1930+(generation-2)*30;
    const end=Math.max(start+10,Math.ceil((years.at(-1)||start+10)/10)*10);
    return {generation,events,years,start,end,birthCount:events.filter(event=>event.kind==='birth').length};
  });
}
