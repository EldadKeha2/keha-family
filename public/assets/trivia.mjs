import {shuffled} from './quiz.mjs';

const monthsHe=['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
const monthsEn=['January','February','March','April','May','June','July','August','September','October','November','December'];
function birthDate(person,now){
  const match=/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(person.birthday||'');if(!match)return null;
  const [day,month,year]=match.slice(1).map(Number),stamp=Date.UTC(year,month-1,day),date=new Date(stamp);
  if(year<1800||stamp>now.getTime()||date.getUTCFullYear()!==year||date.getUTCMonth()!==month-1||date.getUTCDate()!==day)return null;
  return {day,month,year,stamp};
}
export function triviaPool(family,records={},now=new Date(Date.now())){
  const people={...family.people};for(const [id,record]of Object.entries(records))people[id]={...people[id],...record};
  const dates=new Map(Object.values(people).map(person=>[person.id,birthDate(person,now)])),pool=[];
  const add=(person,topic,value,extra={})=>pool.push({id:'trivia-'+topic+'-'+person.id,topic,personId:person.id,value,...extra});
  for(const person of Object.values(people)){
    if(person.placeholder||!(person.name||person.nameEn))continue;
    const date=dates.get(person.id);if(date){add(person,'birth-year',date.year);add(person,'birth-month',date.month);}
    const year=Number(person.aliyahYear);
    if(Number.isInteger(year)&&year>=1800&&year<=now.getUTCFullYear()&&(!date||year>=date.year))add(person,'aliyah-year',year,{minimumYear:date?.year||1800});
  }
  const seen=new Set();
  for(const unit of Object.values(family.units)){
    const ids=[...new Set((unit.children||[]).map(id=>family.units[id]?.people?.[0]).filter(Boolean))];
    if(ids.length<2||ids.some(id=>!people[id]||people[id].placeholder||!dates.get(id)))continue;
    const sorted=ids.map(id=>({id,stamp:dates.get(id).stamp})).sort((a,b)=>a.stamp-b.stamp);
    for(let index=0;index<sorted.length;index++){
      const child=sorted[index];if(seen.has(child.id)||sorted.some(other=>other.id!==child.id&&other.stamp===child.stamp))continue;
      seen.add(child.id);add(people[child.id],'birth-order',index+1,{siblings:ids.length});
    }
  }
  return {pool,people};
}
export function makeTriviaQuiz(family,records={},count=10,random=Math.random,now=new Date(Date.now())){
  const {pool,people}=triviaPool(family,records,now),chosen=[],seen=new Set(),appearances=new Map();
  const pick=(items,limit)=>{for(const item of shuffled(items,random)){if(chosen.length===count)return;if(seen.has(item.id)||(appearances.get(item.personId)||0)>=limit)continue;seen.add(item.id);chosen.push(item);appearances.set(item.personId,(appearances.get(item.personId)||0)+1);}};
  // Include each available topic, then fill from the entire bank with varied people.
  for(const topic of shuffled(['birth-year','birth-month','birth-order','aliyah-year'],random)){
    const candidates=shuffled(pool.filter(q=>q.topic===topic),random),item=candidates.find(q=>(appearances.get(q.personId)||0)<2)||candidates[0];
    if(item&&chosen.length<count){chosen.push(item);seen.add(item.id);appearances.set(item.personId,(appearances.get(item.personId)||0)+1);}
  }
  pick(pool,2);if(chosen.length<count)pick(pool,Infinity);
  return shuffled(chosen,random).map(item=>{
    const person=people[item.personId],subject={id:person.id,name:person.name,nameEn:person.nameEn,gender:person.gender,profile:person.profile||null};
    const he=person.name||person.nameEn,en=person.nameEn||person.name,born=person.gender==='f'?'נולדה':person.gender==='m'?'נולד':'נולד/ה',immigrated=person.gender==='f'?'עלתה':person.gender==='m'?'עלה':'עלה/עלתה';
    const prompts={
      'birth-year':[`באיזו שנה ${born} ${he}?`,`In which year was ${en} born?`],
      'birth-month':[`באיזה חודש ${born} ${he}?`,`In which month was ${en} born?`],
      'birth-order':[`מה המקום של ${he} בסדר הלידה בין האחים והאחיות?`,`What is ${en}’s birth order among their siblings?`],
      'aliyah-year':[`באיזו שנה ${immigrated} ${he} לארץ?`,`In which year did ${en} immigrate to Israel?`]
    };
    const minimum=item.topic==='aliyah-year'?item.minimumYear:1800,maximum=now.getUTCFullYear();
    let values;
    if(item.topic==='birth-month')values=Array.from({length:12},(_,i)=>i+1);
    else if(item.topic==='birth-order')values=Array.from({length:Math.max(4,item.siblings)},(_,i)=>i+1);
    else{values=[];for(let offset=1;offset<=10;offset++)for(const value of [item.value-offset,item.value+offset])if(value>=minimum&&value<=maximum)values.push(value);}
    const choices=shuffled([item.value,...shuffled(values.filter(value=>value!==item.value),random).slice(0,3)],random);
    const options=choices.map(value=>({id:item.topic+'-'+value,name:item.topic==='birth-month'?monthsHe[value-1]:item.topic==='birth-order'?'מקום '+value:String(value),nameEn:item.topic==='birth-month'?monthsEn[value-1]:item.topic==='birth-order'?'Number '+value:String(value)}));
    const [prompt,promptEn]=prompts[item.topic];
    return {id:item.id,kind:'trivia',topic:item.topic,subject,prompt,promptEn,correctId:item.topic+'-'+item.value,options};
  });
}
