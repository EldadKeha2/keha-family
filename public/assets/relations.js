(() => {
  'use strict';
  function forPerson(family,personId) {
    const empty=()=>({partners:[],parents:[],children:[],siblings:[]}),people=family?.people||{},units=family?.units||{},person=people[personId];
    if(!person)return empty();
    const unit=units[person.unit]||Object.values(units).find(item=>item.people?.includes(personId));
    const known=ids=>[...new Set(ids)].filter(id=>id!==personId&&Object.hasOwn(people,id));
    const explicitSiblings=known([...(person.siblings||[]),...Object.values(people).filter(item=>item.siblings?.includes(personId)).map(item=>item.id)]);
    if(!unit?.people?.includes(personId))return {...empty(),siblings:explicitSiblings};
    // A child unit begins with the descendant; its other member is their partner.
    const childIds=parent=>(parent?.children||[]).map(id=>units[id]?.people?.[0]);
    const parent=unit.people[0]===personId?units[unit.parent]:null;
    return {
      partners:known(unit.people),
      parents:known(parent?.people||[]),
      children:known(childIds(unit)),
      siblings:known([...(parent?childIds(parent).filter(id=>id!==unit.people[0]):[]),...explicitSiblings])
    };
  }
  window.FamilyRelations=Object.freeze({forPerson});
})();
