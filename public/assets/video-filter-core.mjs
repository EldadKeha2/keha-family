import {familyMemberIds} from './gallery-family.mjs';

export const VIDEO_SORTS=['uploaded-desc','uploaded-asc','modified-desc','modified-asc','taken-desc','taken-asc','tags-desc','tags-asc','random'];
function rank(id,seed){let value=seed>>>0;for(const char of String(id))value=Math.imul(value^char.charCodeAt(0),16777619);value=Math.imul(value^(value>>>16),0x21f0aaad);return (value^(value>>>15))>>>0;}
function orderValue(item,sort,seed){
 if(sort==='random')return rank(item.id||item.file,seed);
 if(sort.startsWith('tags-'))return item.tags?.length||0;
 if(sort.startsWith('taken-')){const date=item.takenDate;return date?.year?date.year*10000+(date.month||1)*100+(date.day||1):null;}
 const value=Date.parse(sort.startsWith('modified-')?item.modifiedAt||item.updatedAt||item.uploadedAt||item.createdAt:item.uploadedAt||item.createdAt);
 return Number.isFinite(value)?value:null;
}
export function filterVideos(items,{people=[],families=[],categories=[],sort='uploaded-desc',seed=0}={},family={}){
 const members=new Set([...people,...[...families].flatMap(id=>familyMemberIds(family,id))]),groups=new Set(categories);
 const order=VIDEO_SORTS.includes(sort)?sort:'uploaded-desc',direction=order.endsWith('-desc')?-1:1;
 return items.filter(item=>(!groups.size||groups.has(item.videoCategory||'family'))&&(!members.size||(item.tags||[]).some(person=>members.has(person.id))))
  .map((item,index)=>({item,index,value:orderValue(item,order,seed)}))
  .sort((a,b)=>a.value===null&&b.value!==null?1:b.value===null&&a.value!==null?-1:(a.value-b.value)*direction||a.index-b.index)
  .map(entry=>entry.item);
}
