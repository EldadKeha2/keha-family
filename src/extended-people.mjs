import {createExtendedFamily, EXTENDED_BRANCHES, EXTENDED_HOME} from '../public/keha-extended/family-data.mjs';
import {BRANCH_PORTALS} from '../public/keha-extended/branch-portals.mjs';
import {SHLOMO_HOME} from '../public/keha-extended/shlomo-data.mjs';

const homes={extended:EXTENDED_HOME,shlomo:SHLOMO_HOME,...Object.fromEntries(
  Object.entries(BRANCH_PORTALS).map(([id,portal])=>[id,portal.home])
)};

export function extendedContactBranch(person){
  return [person.nakashBranch,...(person.familyApps||[])].find(id=>Object.hasOwn(homes,id));
}

// Cross-branch lookups need names, aliases and a link to the home profile.
// Albums, portraits and the canvas still come from their own branch.
export function otherExtendedPeople(original,local,branch,origins){
  const sharedPeople=original.directorySource||original.sharedPeople||{};
  const tree=createExtendedFamily({...original,sharedPeople}),result={};
  function add(person,branchId,portal){
    if(local[person.id]||person.placeholder||person.mergedInto||person.archiveOnly)return;
    const label=EXTENDED_BRANCHES.find(item=>item.id===branchId);
    result[person.id]={
      id:person.id,name:person.name,nameEn:person.nameEn||person.englishName,aliases:person.aliases||[],
      gender:person.gender,extra:Boolean(person.extra),branch:branchId,branchLabel:label?.shortLabel,branchLabelEn:label?.titleEn,
      profileHref:(origins[portal]||origins.extended||'')+homes[portal]+'#person/'+encodeURIComponent(person.id),
    };
  }
  for(const person of Object.values(tree.people)){
    const branchId=tree.branchIds.get(person.id);
    const portal=branchId==='kehat-tzadok'?'zechariah-tzadok':Object.hasOwn(homes,branchId)?branchId:'extended';
    add(person,branchId,portal);
  }
  for(const person of Object.values(sharedPeople)){
    if(!person.extra||tree.people[person.id])continue;
    const portal=extendedContactBranch(person);
    if(portal&&branch!=='extended'&&portal!==branch&&!person.familyApps?.includes(branch))add(person,portal,portal);
  }
  return result;
}
