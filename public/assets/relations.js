(() => {
  'use strict';
  function forPerson(family,personId) {
    const empty=()=>({partners:[],parents:[],children:[],siblings:[]}),people=family?.people||{},units=family?.units||{},person=people[personId];
    if(!person)return empty();
    const unit=units[person.unit]||Object.values(units).find(item=>item.people?.includes(personId));
    if(!unit?.people?.includes(personId))return empty();
    const known=ids=>[...new Set(ids)].filter(id=>id!==personId&&Object.hasOwn(people,id));
    // A child unit begins with the descendant; its other member is their partner.
    const childIds=parent=>(parent?.children||[]).map(id=>units[id]?.people?.[0]);
    const parent=unit.people[0]===personId?units[unit.parent]:null;
    return {
      partners:known(unit.people),
      parents:known(parent?.people||[]),
      children:known(childIds(unit)),
      siblings:known(parent?childIds(parent).filter(id=>id!==unit.people[0]):[])
    };
  }
  window.FamilyRelations=Object.freeze({forPerson});
})();
