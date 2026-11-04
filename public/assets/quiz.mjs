export function shuffled(values,random=Math.random){
  const result=[...values];for(let i=result.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}return result;
}
const normalize=value=>String(value||'').normalize('NFKC').toLocaleLowerCase().trim();
export function quizAge(person,now=new Date(Date.now())){
  const match=/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(person.birthday||'');if(!match||person.birthday==='1.1.1111')return null;
  const [day,month,year]=match.slice(1).map(Number),check=new Date(Date.UTC(year,month-1,day));
  if(check.getUTCFullYear()!==year||check.getUTCMonth()!==month-1||check.getUTCDate()!==day)return null;
  let age=now.getUTCFullYear()-year;if(now.getUTCMonth()+1<month||now.getUTCMonth()+1===month&&now.getUTCDate()<day)age--;
  return age>=0&&age<=120?age:null;
}
export function makeQuiz(items,people,count=10,random=Math.random,now=new Date(Date.now())){
  const roster=Object.values(people),byId=new Map(roster.map(p=>[p.id,p])),questions=[],seen=new Set();
  const ages=new Map(roster.map(p=>[p.id,quizAge(p,now)])),eligible=p=>p.id!=='yona'&&['m','f'].includes(p.gender)&&ages.get(p.id)!==null;
  const stage=age=>age<13?'child':age<18?'teen':'adult';
  for(const item of shuffled(items,random)){
    if(seen.has(item.id)||item.kind!=='photo')continue;
    const tagged=new Set((item.tags||[]).map(p=>typeof p==='string'?p:p.id));
    let correct,options;
    for(const target of shuffled([...tagged].map(id=>byId.get(id)).filter(p=>p&&eligible(p)),random)){
      const age=ages.get(target.id),span=age<18?4:10;
      const candidates=roster.filter(p=>eligible(p)&&!tagged.has(p.id)&&p.gender===target.gender&&stage(ages.get(p.id))===stage(age));
      for(const start of shuffled(Array.from({length:span+1},(_,i)=>age-span+i),random)){
        const choices=[target],names=new Set([normalize(target.name),normalize(target.nameEn)].filter(Boolean));
        for(const person of shuffled(candidates.filter(p=>ages.get(p.id)>=start&&ages.get(p.id)<=start+span),random)){
          const aliases=[normalize(person.name),normalize(person.nameEn)].filter(Boolean);if(aliases.some(name=>names.has(name)))continue;
          choices.push(person);aliases.forEach(name=>names.add(name));if(choices.length===4)break;
        }
        if(choices.length===4){correct=target;options=choices;break;}
      }
      if(options)break;
    }
    if(!options)continue;
    seen.add(item.id);questions.push({id:item.id,src:item.src||'/media/'+item.id,correctId:correct.id,options:shuffled(options,random).map(({id,name,nameEn})=>({id,name,nameEn}))});
    if(questions.length===count)break;
  }
  return questions;
}
export function quizGrade(correct,total=10){
  if(!Number.isInteger(correct)||!Number.isInteger(total)||total<1||correct<0||correct>total)throw Error('Invalid score');
  const score=Math.round(correct/total*100);return {correct,total,score,level:score>=80?'expert':score>=40?'familiar':'reunion'};
}
