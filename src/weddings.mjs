import family from './family.mjs';
import {HttpError,calendarDate} from './http.mjs';
import {nurseryCollection} from './nursery.mjs';

// Stable family-unit IDs keep wedding dates and albums attached to the same couple.
export const couples=Object.values(family.units)
  .filter(unit=>unit.people.length===2)
  .sort((a,b)=>a.generation-b.generation)
  .map(unit=>({id:unit.id,people:[...unit.people],branch:unit.branch,generation:unit.generation,date:unit.weddingYear?String(unit.weddingYear):''}));
export function weddingDate(value){
  if(typeof value!=='string')throw new HttpError(400,'יש להזין יום נישואים או שנת נישואים.');
  const date=value.trim();if(!date)return '';
  if(/^\d{4}$/.test(date)){
    const year=Number(date);
    if(year<1000||year===1111||year>new Date().getUTCFullYear())throw new HttpError(400,'יש להזין שנת נישואים אמיתית שאינה בעתיד.');
    return date;
  }
  const full=calendarDate(date,'יום נישואים');
  if(full==='1.1.1111')throw new HttpError(400,'בחרו שנה אמיתית, או סמנו שהתאריך לא ידוע.');
  return full;
}
const byId=new Map(couples.map(couple=>[couple.id,couple]));
export function couple(id){
  const result=byId.get(id);if(!result)throw new HttpError(404,'הזוג לא נמצא ברשימת החתונות.');return result;
}
export const weddingCollection=id=>'wedding:'+couple(id).id;
export function validCollection(kind){
  if(['photos','videos','gallery','nostalgia'].includes(kind))return kind;
  if(typeof kind==='string'&&kind.startsWith('nursery:'))return nurseryCollection(kind.slice(8));
  if(typeof kind==='string'&&kind.startsWith('wedding:'))return weddingCollection(kind.slice(8));
  throw new HttpError(404,'הגלריה לא נמצאה.');
}
