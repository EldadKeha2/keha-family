import {branchForPerson} from './family-data.mjs';

const english = {medina:'Medina Family',keha:'Keha Family',yehuda:'Nakash Family (Yehuda)',haim:'Nakash Family (Haim)'};

export function toOriginalFamilyData(family) {
  const branches = family.branches.map(({id, unit, label, shortLabel, color, mark}) =>
    ({id, unit, title:label, short:shortLabel, color, emblem:mark, titleEn:family.branches.find(branch=>branch.id===id)?.titleEn || english[id]}));
  const units = {};
  function visit(id, generation) {
    if (units[id]) return;
    const unit = family.units[id];
    if(unit.generation===0)generation=0;
    units[id] = {...unit, generation, branch:branchForPerson(family, unit.people[0]), hasWedding:unit.relationship==='spouse'};
    unit.children.forEach(child => visit(child, generation + 1));
  }
  visit(family.root, 1);
  for (const branch of family.branches) if (!units[branch.unit]) visit(branch.unit, 1);
  // An extended family can retain known ancestors outside its navigation roots.
  for (const id of Object.keys(family.units)) if (!units[id]) visit(id, family.units[id].generation ?? 1);
  const people = Object.fromEntries(Object.values(family.people).map(person => {
    const [firstName, ...rest] = person.name.split(' ');
    return [person.id, {...person, firstName:person.firstName || firstName, lastName:person.lastName ?? rest.join(' '), nameEn:person.englishName,
      branch:branchForPerson(family, person.id), generation:units[person.unit].generation, birthday:person.birthday || '1.1.1111'}];
  }));
  return {title:family.title || 'משפחת נקאש', people, units, root:family.root, branches, identities:family.identities || {}};
}
