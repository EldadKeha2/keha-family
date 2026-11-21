// Cohorts belong to the shared archive, independently of a person's tree depth.
// Exact saved birthdays take precedence over source years and research ranges.
function birthYear(person){
  const saved=Number(person.birthday?.split('.').at(-1));
  const year=saved>1111?saved:Number(person.birthYear||person.birthYearMax);
  return Number.isInteger(year)&&year>1111?year:null;
}

export function extendedGalleryGenerations(tree,sharedPeople={},blocked=new Set()){
  const people={...sharedPeople,...tree.people};
  const eligible=id=>people[id]&&!people[id].placeholder&&!blocked.has(id);
  const first=new Set(Object.keys(people).filter(id=>eligible(id)&&id!=='ruti'&&birthYear(people[id])!==null&&birthYear(people[id])<1940));
  const second=new Set(first);
  // The next cohort consists of the founders' spouses and immediate children,
  // including their partners. A documented grandchild link is never a child.
  for(const unit of Object.values(tree.units)){
    if(!unit.people.some(id=>first.has(id)))continue;
    for(const id of unit.people)if(eligible(id))second.add(id);
    for(const childId of unit.children||[]){
      const child=tree.units[childId];
      if(!child||child.parentage==='grandchild'||unit.relationships?.some(relationship=>relationship.relationship==='grandparent'&&relationship.children?.includes(childId)))continue;
      for(const id of child.people)if(eligible(id))second.add(id);
    }
  }
  return {first,second};
}

export function extendedGalleryPhoto(item,cohorts,generation='first',canonical=id=>id){
  const tags=(item.people||[]).map(canonical),allowed=cohorts[generation==='second'?'second':'first'];
  return tags.length>0&&tags.every(id=>allowed.has(id));
}
