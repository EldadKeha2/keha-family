import {countryCodes} from '../public/assets/countries.mjs';
import {HttpError,text} from './http.mjs';

const countries=new Set(countryCodes);
export const biographyDefaults={residences:[],languages:[],occupation:'',jobs:[]};
function invalid(){throw new HttpError(400,'פרטי האודות אינם תקינים.');}
function year(value){
  if(value===null||value==='')return null;
  if(!Number.isSafeInteger(value)||value<1000||value>new Date().getUTCFullYear())throw new HttpError(400,'יש להזין שנה תקינה שאינה בעתיד.');
  return value;
}
function period(item){
  if(typeof item.current!=='boolean')invalid();
  const fromYear=year(item.fromYear),toYear=year(item.toYear);
  if((item.current&&toYear!==null)||(fromYear!==null&&toYear!==null&&fromYear>toYear))throw new HttpError(400,'שנת הסיום צריכה להיות מאוחרת משנת ההתחלה או זהה לה.');
  return {fromYear,toYear,current:item.current};
}
export function biographyValue(section,value){
  if(!Object.hasOwn(biographyDefaults,section))invalid();
  if(section==='occupation')return text(value,'מקצוע',200);
  if(!Array.isArray(value)||value.length>(section==='languages'?30:40))invalid();
  if(section==='languages'){
    const result=[],seen=new Set();
    for(const item of value){const name=text(item,'שפה',80,true),key=name.normalize('NFKC').toLocaleLowerCase();if(!seen.has(key)){seen.add(key);result.push(name);}}
    return result;
  }
  return value.map(item=>{
    if(!item||typeof item!=='object'||Array.isArray(item))invalid();
    const dates=period(item);
    if(section==='residences'){
      if(typeof item.country!=='string'||!countries.has(item.country))throw new HttpError(400,'יש לבחור מדינה מהרשימה.');
      return {country:item.country,...dates};
    }
    const employer=text(item.employer,'מקום עבודה',200),role=text(item.role,'תפקיד',200);
    if(!employer&&!role)throw new HttpError(400,'יש להזין מקום עבודה או תפקיד.');
    return {employer,role,...dates};
  });
}
