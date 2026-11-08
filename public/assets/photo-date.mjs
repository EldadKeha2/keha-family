const emptyDate=()=>({day:null,month:null,year:null});
const leap=year=>year%4===0&&(year%100!==0||year%400===0);
const daysInMonth=(month,year)=>month===2?(leap(year)?29:28):[4,6,9,11].includes(month)?30:31;

// Unknown components stay unknown; upload timestamps are never capture dates.
export function photoDate(value){
  if(value===null||value===undefined)return emptyDate();
  if(typeof value!=='object'||Array.isArray(value))throw new RangeError('Invalid photo date');
  const result=emptyDate();
  for(const [field,min,max]of [['day',1,31],['month',1,12],['year',1000,9999]]){
    const part=value[field];
    if(part===null||part===undefined||part==='')continue;
    if(typeof part!=='number'||!Number.isInteger(part)||part<min||part>max)throw new RangeError('Invalid photo date');
    result[field]=part;
  }
  if(result.day&&result.month&&result.day>daysInMonth(result.month,result.year||2000))throw new RangeError('Invalid photo date');
  return result;
}

export function photoAge(birthday,value){
  let taken;try{taken=photoDate(value);}catch{return null;}
  const match=/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/.exec(String(birthday||''));
  if(!taken.year||!match)return null;
  const [day,month,year]=match.slice(1).map(Number);
  if(year===1111||year<1000||month<1||month>12||day<1||day>daysInMonth(month,year))return null;
  const earliest={year:taken.year,month:taken.month||1,day:taken.day||1};
  const latest={year:taken.year,month:taken.month||12,day:taken.day||daysInMonth(taken.month||12,taken.year)};
  const order=date=>date.year*10000+date.month*100+date.day;
  if(order(latest)<order({day,month,year}))return null;
  let years=earliest.year-year;
  if(earliest.month<month||earliest.month===month&&earliest.day<day)years--;
  // A photograph taken in the birth year can show a baby aged under one.
  return {years:Math.max(0,years),approximate:!taken.month||!taken.day};
}

export function photoDateText(value,locale='he-IL'){
  const date=photoDate(value),english=locale.startsWith('en');
  if(date.day&&date.month&&date.year)return new Intl.DateTimeFormat(locale,{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(date.year,date.month-1,date.day)));
  if(date.month){
    const month=new Intl.DateTimeFormat(locale,{month:'short',timeZone:'UTC'}).format(new Date(Date.UTC(2000,date.month-1,1)));
    return [date.day,month,date.year].filter(Boolean).join(' ');
  }
  if(date.day)return (english?'Day ':'יום ')+date.day+(date.year?' · '+date.year:'');
  return date.year?String(date.year):'';
}
