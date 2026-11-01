import family from './family.mjs';
import {HttpError} from './http.mjs';

// Stable family-unit IDs keep wedding dates and albums attached to the same couple.
export const couples=Object.values(family.units)
  .filter(unit=>unit.people.length===2)
  .sort((a,b)=>a.generation-b.generation)
  .map(unit=>({id:unit.id,people:[...unit.people],branch:unit.branch,generation:unit.generation}));
const byId=new Map(couples.map(couple=>[couple.id,couple]));
export function couple(id){
  const result=byId.get(id);if(!result)throw new HttpError(404,'הזוג לא נמצא ברשימת החתונות.');return result;
}
export const weddingCollection=id=>'wedding:'+couple(id).id;
export function validCollection(kind){
  if(['photos','videos','nostalgia'].includes(kind))return kind;
  if(typeof kind==='string'&&kind.startsWith('wedding:'))return weddingCollection(kind.slice(8));
  throw new HttpError(404,'הגלריה לא נמצאה.');
}
