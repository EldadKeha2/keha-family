// Shared name matching for the phone search and the complete content index.
export const normalizeSearch=value=>String(value??'').normalize('NFKD').replace(/[\u0591-\u05c7'"׳״’]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
export function searchNames(person){return [person.name,person.nameEn,...(person.aliases||[])].filter(Boolean);}
export function personRank(person,query){
  const q=normalizeSearch(query);if(!q||person.placeholder)return 0;
  const names=searchNames(person).map(normalizeSearch),words=q.split(' ');
  const score=names.some(name=>name===q)?100:names.some(name=>name.startsWith(q))?80:names.some(name=>words.every(word=>name.split(' ').some(part=>part.startsWith(word))))?65:names.some(name=>name.includes(q))?50:0;
  return score?score-(person.extra?10:person.extended?5:0):0;
}
export function suggestPeople(people,query,limit=6){return people.map(person=>({person,score:personRank(person,query)})).filter(item=>item.score>0).sort((a,b)=>b.score-a.score||String(a.person.name).localeCompare(String(b.person.name),'he')).slice(0,limit).map(item=>item.person);}
export const SEARCH_TYPES=['person','photo','video','document','story','voice','wedding','event'];
