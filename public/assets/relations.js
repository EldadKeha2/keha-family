(() => {
  'use strict';
  function forPerson(family,personId) {
    const empty=()=>({partners:[],parents:[],children:[],siblings:[]}),people=family?.people||{},units=family?.units||{},person=people[personId];
    if(!person)return empty();
    const unit=units[person.unit]||Object.values(units).find(item=>item.people?.includes(personId));
    const known=ids=>[...new Set(ids)].filter(id=>id!==personId&&Object.hasOwn(people,id));
    const explicitParents=known(person.parents||[]),explicitChildren=known(Object.values(people).filter(item=>item.parents?.includes(personId)).map(item=>item.id));
    const explicitSiblings=known([...(person.siblings||[]),...Object.values(people).filter(item=>item.siblings?.includes(personId)||item.parents?.some(id=>explicitParents.includes(id))).map(item=>item.id)]);
    if(!unit?.people?.includes(personId))return {...empty(),parents:explicitParents,children:explicitChildren,siblings:explicitSiblings};
    // A child unit begins with the descendant; its other member is their partner.
    const childIds=parent=>(parent?.children||[]).map(id=>units[id]?.people?.[0]);
    const parent=unit.people[0]===personId?units[unit.parent]:null;
    const unions=unit.relationships?.filter(item=>item.people.includes(personId));
    const parentUnions=parent?.relationships?.filter(item=>item.children.includes(unit.id));
    const parents=parentUnions?parentUnions.filter(item=>item.relationship!=='adopted').flatMap(item=>item.people):parent?.people||[];
    const adoptedParents=known((parentUnions||[]).filter(item=>item.relationship==='adopted').flatMap(item=>item.people));
    const adoptedChildren=known((unions||[]).filter(item=>item.relationship==='adopted').flatMap(item=>childIds(item)));
    return {
      partners:known(unions?unions.filter(item=>item.relationship!=='former').flatMap(item=>item.people):unit.people),
      ...(unions?{formerPartners:known(unions.filter(item=>item.relationship==='former').flatMap(item=>item.people))}:{}),
      parents:known([...parents,...explicitParents]),
      ...(adoptedParents.length?{adoptedParents}:{}),
      children:known([...(unions?unions.filter(item=>item.relationship!=='adopted').flatMap(item=>childIds(item)):childIds(unit)),...explicitChildren]),
      ...(adoptedChildren.length?{adoptedChildren}:{}),
      siblings:known([...(parent?childIds(parent).filter(id=>id!==unit.people[0]):[]),...explicitSiblings])
    };
  }
  window.FamilyRelations=Object.freeze({forPerson});
})();
