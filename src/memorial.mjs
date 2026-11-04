// A remembrance year begins on the Gregorian death anniversary, at midnight in Israel.
export function memorialPeriod(deathDate,now=new Date(Date.now())){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jerusalem',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const today=Object.fromEntries(parts.map(p=>[p.type,p.value])),year=Number(today.year),date=`${today.year}-${today.month}-${today.day}`;
  const match=/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(deathDate||'');
  if(!match)return {period:'all-time',resetsOn:null};
  const day=Number(match[1]),month=Number(match[2]);
  const anniversary=y=>`${y}-${String(month).padStart(2,'0')}-${String(Math.min(day,new Date(Date.UTC(y,month,0)).getUTCDate())).padStart(2,'0')}`;
  const cycle=date>=anniversary(year)?year:year-1;
  return {period:anniversary(cycle),resetsOn:anniversary(cycle+1)};
}
