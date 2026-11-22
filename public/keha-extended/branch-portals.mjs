import {createExtendedFamily,EXTENDED_BRANCHES} from './family-data.mjs';

export const BRANCH_PORTALS=Object.freeze({
  zechariah:Object.freeze({id:'zechariah',name:'משפחת קהא (זכריה בן שלום)',previousNames:['משפחת קהא (זכריה)','משפחת קהא (זכריה בן סעדיה)'],nameEn:'Keha Family (Zechariah, son of Shalom)',shortName:'קהא · בן שלום',home:'/keha-extended/zechariah/',color:'#913951',roots:['u-keha-zechariah'],branches:['zechariah'],tagline:'המשפחה של זכריה (בן שלום) קהא',taglineEn:'The family of Zechariah Keha, son of Shalom'}),
  'zechariah-tzadok':Object.freeze({id:'zechariah-tzadok',name:'משפחת קהא (זכריה בן צדוק)',nameEn:'Keha Family (Zechariah, son of Tzadok)',shortName:'קהא · בן צדוק',home:'/keha-extended/zechariah-tzadok/',color:'#b4523b',roots:['u-kehat-tzadok-elder'],branches:['kehat-tzadok'],tagline:'המשפחה של זכריה (בן צדוק) קהא',taglineEn:'The family of Zechariah Keha, son of Tzadok'}),
  kehat:Object.freeze({id:'kehat',name:'משפחת קהת',nameEn:'Kehat Family',shortName:'משפחת קהת',home:'/keha-extended/kehat/',color:'#167d9a',roots:['u-kehat-aharon-elder'],branches:['kehat'],tagline:'המשפחה של סעדיה (ג׳ימעאן) קהא',taglineEn:'The family of Saadia (Jimaan) Keha, son of Aharon'}),
});
const zechariahBranches=[
  ['kadya','קדיה מזרחי','Kadya Mizrahi'],['shalom','שלום ורחל קהא','Shalom & Rachel Keha'],
  ['saadia','סעדיה וסעידה קהא','Saadia & Saida Keha'],['israel','ישראל ונחמה קהא','Israel & Nechama Keha'],
  ['aharon','אהרון ויונה חובשי','Aharon & Yona Hovshi'],
];

// Each app has one family root and projects the existing canonical people.
// Yaakov, Yehudit and their children belong to both families through marriage.
export function createBranchPortal(original={},id){
  const portal=BRANCH_PORTALS[id];if(!portal)throw Error('Unknown branch portal');
  const source=createExtendedFamily(original),allowed=new Set(Object.keys(source.people).filter(personId=>[source.branchIds.get(personId),...(source.people[personId].branches||[])].some(branch=>portal.branches.includes(branch))));
  const result={title:portal.name,root:portal.roots[0],people:{},units:{},branches:[],branchIds:new Map(),identities:{}};
  for(const personId of allowed)result.people[personId]=structuredClone(source.people[personId]);
  for(const unit of Object.values(source.units))if(unit.people.length&&unit.people.every(personId=>allowed.has(personId)))result.units[unit.id]=structuredClone(unit);
  for(const unit of Object.values(result.units)){
    unit.children=unit.children.filter(child=>result.units[child]);
    if(!result.units[unit.parent])unit.parent=null;
    for(const relation of unit.relationships||[])relation.children=relation.children.filter(child=>result.units[child]);
  }
  for(const root of portal.roots)delete result.units[root].generation;
  const reachable=new Set();
  function descend(id){if(reachable.has(id)||!result.units[id])return;reachable.add(id);result.units[id].children.forEach(descend);}
  portal.roots.forEach(descend);
  // A spouse uses the couple's visible unit in this tree. Its counterpart in
  // the other family keeps the same profile IDs, with no duplicate roots.
  for(const person of Object.values(result.people))if(!reachable.has(person.unit)){
    const visible=[...reachable].find(id=>result.units[id].people.includes(person.id));
    if(visible)person.unit=visible;
  }
  for(const [unitId,unit]of Object.entries(result.units))if(!reachable.has(unitId)&&unit.people.every(id=>result.people[id].unit!==unitId))delete result.units[unitId];
  for(const unit of Object.values(result.units)){
    if(!result.units[unit.parent])unit.parent=[...reachable].find(id=>result.units[id]?.children.includes(unit.id))||null;
    if(unit.mirrorOf&&!result.units[unit.mirrorOf])delete unit.mirrorOf;
  }
  for(const person of Object.values(result.people))person.branches=[];
  result.identities=Object.fromEntries(Object.entries(source.identities).filter(([,canonical])=>allowed.has(canonical)));
  for(const id of allowed)if(source.people[id].researchBranch)result.branchIds.set(id,source.people[id].researchBranch);
  result.branches=id==='zechariah'?zechariahBranches.map(([key,label,titleEn])=>({id:'zechariah-'+key,unit:'u-saadia-'+key,label,shortLabel:label,titleEn,color:portal.color,mark:'❖'})):
    EXTENDED_BRANCHES.filter(branch=>portal.branches.includes(branch.id)).map(branch=>({...branch,color:portal.color}));
  for(const branch of result.branches){
    const seen=new Set();
    const visit=unitId=>{if(seen.has(unitId))return;seen.add(unitId);const unit=result.units[unitId];for(const personId of unit.people){if(result.people[personId].unit===unit.id||!result.branchIds.has(personId))result.branchIds.set(personId,branch.id);if(!result.people[personId].branches.includes(branch.id))result.people[personId].branches.push(branch.id);}unit.children.forEach(visit);};
    visit(branch.unit);
  }
  return result;
}
export const createZechariahFamily=original=>createBranchPortal(original,'zechariah');
export const createKehatFamily=original=>createBranchPortal(original,'kehat');
export const createTzadokFamily=original=>createBranchPortal(original,'zechariah-tzadok');
