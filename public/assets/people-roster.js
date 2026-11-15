(() => {
  'use strict';
  // One in-memory roster for tagging and both media filters. No family data is
  // written to persistent browser storage, and each consumer keeps its ranking.
  const people=new Map(),changedAt=new Map(),listeners=new Set(),ttl=300000;
  const fields=['id','name','nameEn','aliases','extra','extended','branch','generation','placeholder','unit','parents','siblings','profile'];
  let loaded=false,checkedAt=Date.now(),etag=null,pending=null,version=0;
  const snapshot=()=>[...people.values()];
  const failed=()=>Error(window.FamilyI18n.t?.('לא התקבלה תשובה מהשרת. נסו שוב.')||'The people list could not load.');
  function merge(person,stamp=version){
    if(!person?.id)return false;
    const previous=people.get(person.id)||{},next={...previous};
    for(const field of fields)if(field in person)next[field]=person[field];
    if(JSON.stringify(previous)===JSON.stringify(next))return false;
    people.set(person.id,next);changedAt.set(person.id,stamp);return true;
  }
  for(const person of Object.values(window.FAMILY_DATA?.people||{}))merge(person);
  function notify(){const current=snapshot();for(const listener of listeners)try{listener(current);}catch{}}
  function invalidate(){checkedAt=-Infinity;etag=null;version++;}
  function update(items){
    const values=Array.isArray(items)?items:items?.id?[items]:Object.values(items||{});let changed=false;
    const stamp=version+1;for(const person of values)changed=merge(person,stamp)||changed;
    if(changed){invalidate();notify();}return snapshot();
  }
  function load({force=false,requireComplete=true}={}){
    if(pending)return pending;
    if(!force&&(loaded||!requireComplete&&people.size)&&Date.now()-checkedAt<ttl)return Promise.resolve(snapshot());
    const started=version,headers=etag?{'If-None-Match':etag}:{};
    pending=(async()=>{
      const response=await window.FamilyI18n.fetch('api/tag-people',{cache:'no-store',headers});
      if(response.status===304){
        if(!loaded)throw failed();
        if(version===started)checkedAt=Date.now();return snapshot();
      }
      const result=await response.json();
      if(!response.ok)throw Error(window.FamilyI18n.error?.(result.error)||result.error||'The people list could not load.');
      if(!Array.isArray(result.people))throw failed();
      let changed=false;
      // Preserve newer names from a save that finished during this download.
      for(const person of result.people)if((changedAt.get(person.id)||0)<=started)changed=merge(person,started)||changed;
      loaded=true;
      if(version===started){etag=response.headers?.get('ETag')||null;checkedAt=Date.now();}
      if(changed)notify();return snapshot();
    })().finally(()=>{pending=null;});
    return pending;
  }
  function subscribe(listener){listeners.add(listener);listener(snapshot());return ()=>listeners.delete(listener);}
  function personChanged(event){
    const id=event.detail?.id,person=event.detail?.person||window.FamilyApp?.getPersonSummary?.(id)||window.FAMILY_DATA?.people?.[id];
    if(person)update(person);invalidate();
  }
  window.addEventListener('family-person-changed',personChanged);
  window.addEventListener('family-people-loaded',()=>{
    const items=Object.values(window.FAMILY_DATA?.people||{}).map(person=>({...person,...window.FamilyApp?.getPersonSummary?.(person.id)}));
    update(items);invalidate();
  });
  window.addEventListener('family-media-changed',event=>{
    const result=event.detail||{};
    update([...(result.taggedPeople||[]),...Object.values(result.people||{}),...(result.person?[result.person]:[])]);
  });
  window.FamilyPeopleRoster={snapshot,load,update,invalidate,subscribe};
})();
