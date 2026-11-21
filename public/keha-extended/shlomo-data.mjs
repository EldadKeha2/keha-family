import {applySavedWeddingDates} from './family-data.mjs';

export const SHLOMO_NAME='משפחת שלמה קהא';
export const SHLOMO_HOME='/keha-extended/shlomo/';
export const SHLOMO_COLOR='#536641';

// This is the existing Yona–Shlomo subtree, with the same canonical person IDs.
// None of the Nakash/Medina ancestors or the other paternal roots are grafted on.
export function createShlomoFamily(original={}) {
  const result={title:SHLOMO_NAME,root:'u-root',people:{},units:{},branches:[],branchIds:new Map(),identities:{}};
  const shared=original.sharedPeople || {};
  function visit(id,parent=null){
    if(result.units[id])return;
    const source=original.units?.[id];if(!source)return;
    const unit=result.units[id]={...structuredClone(source),parent,relationship:source.relationship || (source.hasWedding===false?'partner':source.people.length>1?'spouse':'single')};
    for(const personId of source.people){
      const seed=original.people[personId],saved=shared[personId] || {};
      result.people[personId]={...seed,...saved,unit:id,extra:false,englishName:saved.nameEn || seed.englishName || seed.nameEn};
    }
    unit.children.forEach(child=>visit(child,id));
  }
  visit(result.root);
  applySavedWeddingDates(result.units,original.sharedWeddings);
  result.branches=(original.branches || []).filter(branch=>result.units[branch.unit]).map(branch=>({
    ...branch,label:branch.label || branch.title,shortLabel:branch.shortLabel || branch.short,mark:branch.mark || branch.emblem,
  }));
  for(const branch of result.branches){
    const todo=[branch.unit];
    while(todo.length){const unit=result.units[todo.pop()];for(const id of unit.people)result.branchIds.set(id,branch.id);todo.push(...unit.children);}
  }
  return result;
}
