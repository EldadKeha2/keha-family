import {createExtendedFamily,EXTENDED_BRANCHES} from './family-data.mjs';

export const BRANCH_PORTALS=Object.freeze({
  zechariah:Object.freeze({id:'zechariah',name:'משפחת קהא (זכריה)',nameEn:'Keha Family (Zechariah)',shortName:'קהא · זכריה',home:'/keha-extended/zechariah/',color:'#875b79',roots:['u-keha-zechariah'],branches:['zechariah'],tagline:'זכריה ויהודית קהא וצאצאיהם'}),
  kehat:Object.freeze({id:'kehat',name:'משפחת קהת',nameEn:'Kehat Family',shortName:'משפחת קהת',home:'/keha-extended/kehat/',color:'#3f7e6f',roots:['u-kehat-tzadok-elder','u-kehat-aharon-elder'],branches:['kehat-tzadok','kehat'],tagline:"משפחות זכריה (בן צדוק) וסעדיה (ג'ידעאן) קהא"}),
});
const zechariahBranches=[
  ['kadya','קדיה מזרחי','Kadya Mizrahi'],['shalom','שלום ורחל קהא','Shalom & Rachel Keha'],
  ['saadia','סעדיה וסעידה קהא','Saadia & Saida Keha'],['israel','ישראל ונחמה קהא','Israel & Nechama Keha'],
  ['aharon','אהרון ויונה חובשי','Aharon & Yona Hovshi'],
];

// Each app projects the same canonical people and media. Kehat has two real
// roots; its overview never turns them into a couple or invents common parents.
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
  for(const person of Object.values(result.people))person.branches=[];
  result.identities=Object.fromEntries(Object.entries(source.identities).filter(([,canonical])=>allowed.has(canonical)));
  for(const id of allowed)if(source.people[id].researchBranch)result.branchIds.set(id,source.people[id].researchBranch);
  result.branches=id==='zechariah'?zechariahBranches.map(([key,label,titleEn])=>({id:'zechariah-'+key,unit:'u-saadia-'+key,label,shortLabel:label,titleEn,color:portal.color,mark:'❖'})):
    EXTENDED_BRANCHES.filter(branch=>portal.branches.includes(branch.id)).map(branch=>({...branch}));
  for(const branch of result.branches){
    const seen=new Set();
    const visit=unitId=>{if(seen.has(unitId))return;seen.add(unitId);const unit=result.units[unitId];for(const personId of unit.people){if(result.people[personId].unit===unit.id||!result.branchIds.has(personId))result.branchIds.set(personId,branch.id);if(!result.people[personId].branches.includes(branch.id))result.people[personId].branches.push(branch.id);}unit.children.forEach(visit);};
    visit(branch.unit);
  }
  return result;
}
export const createZechariahFamily=original=>createBranchPortal(original,'zechariah');
export const createKehatFamily=original=>createBranchPortal(original,'kehat');
