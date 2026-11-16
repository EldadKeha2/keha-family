// Shared name matching for the phone search and the complete content index.
export const normalizeSearch=value=>String(value??'').normalize('NFKD').replace(/[\u0300-\u036f\u0591-\u05c7'"׳״’]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
const hebrewKeys=Object.fromEntries(Array.from("qwertyuiopasdfghjkl;zxcvbnm,./'",(key,index)=>[key,Array.from("/'קראטוןםפשדגכעיחלךףזסבהנמצתץ.,")[index]]));
// Keep literal English matches first, then try the same keys on a Hebrew layout.
export function searchVariants(value){
  const raw=String(value??'').toLowerCase(),query=normalizeSearch(raw);
  if(!query)return [];
  const variants=[query];
  if(/[a-z]/.test(raw)){
    const hebrew=normalizeSearch(raw.replace(/[a-z;,./']/g,key=>hebrewKeys[key]));
    if(hebrew&&hebrew!==query)variants.push(hebrew);
  }
  return variants;
}
export function searchNames(person){return [person.name,person.nameEn,...(person.aliases||[])].filter(Boolean);}
export function personRank(person,query){
  const queries=searchVariants(query);if(!queries.length||person.placeholder)return 0;
  const names=searchNames(person).map(normalizeSearch);
  const score=Math.max(...queries.map((q,index)=>{
    const words=q.split(' '),match=names.some(name=>name===q)?100:names.some(name=>name.startsWith(q))?80:names.some(name=>words.every(word=>name.split(' ').some(part=>part.startsWith(word))))?65:names.some(name=>name.includes(q))?50:0;
    return match?match-index*15:0;
  }));
  return score?score-(person.extra?10:person.extended?5:0):0;
}
export function suggestPeople(people,query,limit=6){return people.map(person=>({person,score:personRank(person,query)})).filter(item=>item.score>0).sort((a,b)=>b.score-a.score||String(a.person.name).localeCompare(String(b.person.name),'he')).slice(0,limit).map(item=>item.person);}
export const SEARCH_TYPES=['person','photo','video','document','story','voice','wedding','event'];
