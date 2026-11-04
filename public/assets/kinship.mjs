import {shuffled} from './quiz.mjs';

const cache=new WeakMap();
const sex=p=>p?.gender==='f'?'f':p?.gender==='m'?'m':null;
const sibling=g=>g==='f'?['אחות','sister']:['אח','brother'];
const aunt=g=>g==='f'?['דודה','aunt']:['דוד','uncle'];
const cousin=g=>g==='f'?['בת דודה','first cousin']:['בן דוד','first cousin'];
const partner=g=>g==='f'?['בת זוג','partner']:['בן זוג','partner'];
const ancestor=(n,g)=>g==='f'?[null,['אמא','mother'],['סבתא','grandmother'],['סבתא רבתא','great-grandmother']][n]:[null,['אבא','father'],['סבא','grandfather'],['סבא רבא','great-grandfather']][n];
const descendant=(n,g)=>g==='f'?[null,['בת','daughter'],['נכדה','granddaughter'],['נינה','great-granddaughter']][n]:[null,['בן','son'],['נכד','grandson'],['נין','great-grandson']][n];
const titled=value=>value[0].toUpperCase()+value.slice(1);
function entry(structure,words,level=2,group='blood'){return {structure,name:words[0],nameEn:titled(words[1]),level,group};}

function indexFamily(family){
  const people=family?.people||{},parents=new Map(),siblings=new Map(),partners=new Map();
  const add=(map,a,b)=>{if(a===b||!people[a]||!people[b])return;if(!map.has(a))map.set(a,new Set());map.get(a).add(b);};
  for(const unit of Object.values(family?.units||{})){
    const members=(unit.people||[]).filter(id=>people[id]),children=(unit.children||[]).map(id=>family.units[id]?.people?.[0]).filter(id=>people[id]);
    for(const a of members)for(const b of members)add(partners,a,b);
    for(const child of children)for(const parent of members)add(parents,child,parent);
    for(const a of children)for(const b of children)add(siblings,a,b);
  }
  for(const person of Object.values(people))for(const id of person.siblings||[]){add(siblings,person.id,id);add(siblings,id,person.id);}
  const ancestry=new Map();
  for(const id of Object.keys(people)){
    const found=new Map([[id,{id,distance:0,path:[id]}]]),queue=[found.get(id)];
    for(let i=0;i<queue.length;i++){
      const current=queue[i];if(current.distance===4)continue;
      for(const parent of parents.get(current.id)||[]){if(found.has(parent)||current.path.includes(parent))continue;const item={id:parent,distance:current.distance+1,path:[...current.path,parent]};found.set(parent,item);queue.push(item);}
    }
    ancestry.set(id,found);
  }
  function blood(a,b){
    if(a===b||!sex(people[a]))return null;
    const aa=ancestry.get(a),bb=ancestry.get(b);if(!aa||!bb)return null;const g=sex(people[a]);
    if(bb.has(a)){const distance=bb.get(a).distance,words=ancestor(distance,g);return words?entry('ancestor:'+distance,words,distance<=2?0:1):null;}
    if(aa.has(b)){const distance=aa.get(b).distance,words=descendant(distance,g);return words?entry('descendant:'+distance,words,distance<=2?0:1):null;}
    const bridges=[];
    for(const left of aa.values())for(const right of bb.values())if(left.distance<=3&&right.distance<=3&&left.distance+right.distance<=4&&siblings.get(left.id)?.has(right.id))bridges.push({left,right});
    bridges.sort((a,b)=>a.left.distance+a.right.distance-b.left.distance-b.right.distance||Math.max(a.left.distance,a.right.distance)-Math.max(b.left.distance,b.right.distance));
    const bridge=bridges[0];if(!bridge)return null;
    const {left,right}=bridge,x=left.distance,y=right.distance,structure=`bridge:${x}:${y}`;
    if(x===0&&y===0)return entry(structure,sibling(g),0);
    if(x===0&&y===1)return entry(structure,aunt(g),1);
    if(x===1&&y===0)return entry(structure,g==='f'?['אחיינית','niece']:['אחיין','nephew'],1);
    if(x===1&&y===1)return entry(structure,cousin(g),1);
    if(x===0){const base=ancestor(y,sex(people[right.id]));if(!base)return null;const word=sibling(g);return entry(structure,[`${word[0]} של ${base[0]}`,`${base[1]}'s ${word[1]}`]);}
    if(y===0){const word=descendant(x,g),base=sibling(sex(people[left.id]));return entry(structure,[`${word[0]} של ${base[0]}`,`${base[1]}'s ${word[1]}`]);}
    if(x===1){const anchor=right.path[y-1],base=ancestor(y-1,sex(people[anchor])),word=cousin(g);return entry(structure,[`${word[0]} של ${base[0]}`,`${base[1]}'s ${word[1]}`]);}
    const word=descendant(x,g),base=aunt(sex(people[left.id]));
    if(y===1)return entry(structure,[`${word[0]} של ${base[0]}`,`${base[1]}'s ${word[1]}`]);
    const anchor=right.path[y-1],older=ancestor(y-1,sex(people[anchor]));
    return entry(structure,[`${word[0]} של ${base[0]} של ${older[0]}`,`${older[1]}'s ${base[1]}'s ${word[1]}`]);
  }
  function relation(a,b){
    const g=sex(people[a]);if(!g||a===b)return null;
    if(partners.get(a)?.has(b))return entry('partner',partner(g),0);
    const direct=blood(a,b);if(direct)return direct;
    for(const spouse of partners.get(a)||[]){const via=blood(spouse,b);if(via){const word=partner(g);return entry('affinity:subject:'+via.structure,[`${word[0]} של ${via.name}`,`${via.nameEn.toLowerCase()}'s partner`],2,'affinity');}}
    for(const spouse of partners.get(b)||[]){const via=blood(a,spouse);if(via){const word=partner(sex(people[spouse]));return entry('affinity:reference:'+via.structure,[`${via.name} של ${sex(people[spouse])==='f'?'בת הזוג':'בן הזוג'}`,`partner's ${via.nameEn.toLowerCase()}`],2,'affinity');}}
    return null;
  }
  return {people,relation};
}
function dataFor(family){
  if(cache.has(family))return cache.get(family);
  const index=indexFamily(family),members=Object.values(index.people).filter(p=>!p.extra&&!p.extended&&p.id!=='yona'),pool=[],catalogs=new Map(),labels=new Map();
  for(const subject of members)for(const reference of members){
    const value=index.relation(subject.id,reference.id);if(!value)continue;
    const labelKey=[sex(subject),value.group,value.name,value.nameEn].join('|');
    if(!labels.has(labelKey))labels.set(labelKey,{...value,id:'kinship-answer-'+labels.size});
    const answer=labels.get(labelKey),catalogKey=sex(subject)+':'+value.group;
    if(!catalogs.has(catalogKey))catalogs.set(catalogKey,new Map());catalogs.get(catalogKey).set(answer.id,answer);
    pool.push({id:'kinship-'+subject.id+'--'+reference.id,subjectId:subject.id,referenceId:reference.id,answer,catalogKey,level:value.level});
  }
  const data={...index,pool,catalogs};cache.set(family,data);return data;
}
export function kinshipRelation(family,subject,reference){return dataFor(family).relation(subject,reference);}
export function kinshipPool(family){return dataFor(family).pool;}
export function makeKinshipQuiz(family,profiles={},count=10,random=Math.random){
  const data=dataFor(family),selected=[],pairs=new Set(),appearances=new Map();
  function take(question,limit=true){
    const pair=[question.subjectId,question.referenceId].sort().join('|');
    if(pairs.has(pair)||limit&&[question.subjectId,question.referenceId].some(id=>(appearances.get(id)||0)>=3))return false;
    const candidates=shuffled([...data.catalogs.get(question.catalogKey).values()].filter(answer=>answer.structure!==question.answer.structure),random).sort((a,b)=>Math.abs(a.level-question.level)-Math.abs(b.level-question.level));
    const options=[question.answer],he=new Set([question.answer.name]),en=new Set([question.answer.nameEn]);
    for(const option of candidates){if(he.has(option.name)||en.has(option.nameEn))continue;options.push(option);he.add(option.name);en.add(option.nameEn);if(options.length===4)break;}
    if(options.length<4)return false;
    const person=id=>{const p={...data.people[id],...profiles[id]};return {id,name:p.name,nameEn:p.nameEn,gender:data.people[id].gender,profile:p.profile||null};};
    selected.push({id:question.id,kind:'kinship',subject:person(question.subjectId),reference:person(question.referenceId),correctId:question.answer.id,options:shuffled(options,random).map(({id,name,nameEn})=>({id,name,nameEn})),difficulty:question.level});
    pairs.add(pair);for(const id of [question.subjectId,question.referenceId])appearances.set(id,(appearances.get(id)||0)+1);return true;
  }
  for(const [level,amount]of [[0,3],[1,3],[2,4]]){let n=0;for(const question of shuffled(data.pool.filter(q=>q.level===level),random)){if(selected.length===count)break;if(take(question)&&++n===amount)break;}}
  for(const question of shuffled(data.pool,random)){if(selected.length===count)break;take(question,false);}
  return shuffled(selected,random);
}
