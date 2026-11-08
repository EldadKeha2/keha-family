export function descendantUnits(family,root){
  const found=new Set(),queue=[root];
  while(queue.length){const id=queue.shift(),unit=family.units?.[id];if(!unit||found.has(id))continue;found.add(id);queue.push(...(unit.children||[]));}
  return found;
}
export function familyMemberIds(family,root){
  const units=descendantUnits(family,root),members=new Set([...units].flatMap(id=>family.units[id].people||[]));
  // Explicit parent links also cover relatives added outside the original tree.
  let changed=true;
  while(changed){changed=false;for(const person of Object.values(family.people||{})){
    if(members.has(person.id)||!person.parents?.some(id=>members.has(id)))continue;
    members.add(person.id);changed=true;
    if(family.units?.[person.unit]?.people?.[0]===person.id)for(const unitId of descendantUnits(family,person.unit))for(const id of family.units[unitId].people||[])members.add(id);
  }}
  return [...members];
}
export function familyOptions(family,generation,parent=''){
  const allowed=parent?descendantUnits(family,parent):null;
  return Object.values(family.units||{}).filter(unit=>unit.generation===generation&&hasFamily(family,unit)&&(!allowed||allowed.has(unit.id)));
}
export function hasFamily(family,unit){
  const people=(unit?.people||[]).filter(id=>family.people?.[id]&&!family.people[id].placeholder);
  return people.length>1||Boolean(people.length&&((unit.children||[]).some(id=>family.units?.[id]?.people?.some(personId=>family.people?.[personId]&&!family.people[personId].placeholder))||Object.values(family.people||{}).some(person=>!person.placeholder&&person.parents?.some(id=>people.includes(id)))));
}
export function familyLabel(family,unit,name=person=>person.name,english=false){
  const person=(unit.people||[]).map(id=>family.people?.[id]).find(person=>person&&!person.placeholder);
  return (english?'Family of ':'המשפחה של ')+(person?name(person):'');
}
