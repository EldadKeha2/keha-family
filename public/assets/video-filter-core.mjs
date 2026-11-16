import {familyMemberIds} from './gallery-family.mjs';

export const VIDEO_SORTS=['uploaded-desc','uploaded-asc','modified-desc','modified-asc','taken-desc','taken-asc','duration-asc','duration-desc','tags-desc','tags-asc','description-asc','description-desc','random'];
function rank(id,seed){let value=seed>>>0;for(const char of String(id))value=Math.imul(value^char.charCodeAt(0),16777619);value=Math.imul(value^(value>>>16),0x21f0aaad);return (value^(value>>>15))>>>0;}
function orderValue(item,sort,seed,getDuration){
 if(sort==='random')return rank(item.id||item.file,seed);
 if(sort.startsWith('duration-')){const value=Number(getDuration(item));return Number.isFinite(value)&&value>0?value:null;}
 if(sort.startsWith('description-'))return String(item.caption||'').trim()||null;
 if(sort.startsWith('tags-'))return item.tags?.length||0;
 if(sort.startsWith('taken-')){const date=item.takenDate;return date?.year?date.year*10000+(date.month||1)*100+(date.day||1):null;}
 const value=Date.parse(sort.startsWith('modified-')?item.modifiedAt||item.updatedAt||item.uploadedAt||item.createdAt:item.uploadedAt||item.createdAt);
 return Number.isFinite(value)?value:null;
}
export function sortVideos(items,{sort='uploaded-desc',seed=0,locale='he',getDuration=item=>item.duration}={}){
 const order=VIDEO_SORTS.includes(sort)?sort:'uploaded-desc',direction=order.endsWith('-desc')?-1:1;
 const collator=order.startsWith('description-')?new Intl.Collator(locale,{numeric:true,sensitivity:'base'}):null;
 return items.map((item,index)=>({item,index,value:orderValue(item,order,seed,getDuration)}))
  .sort((a,b)=>a.value===null&&b.value!==null?1:b.value===null&&a.value!==null?-1:((collator?collator.compare(a.value||'',b.value||''):a.value-b.value)*direction||a.index-b.index))
  .map(entry=>entry.item);
}
export function filterVideos(items,options={},family={}){
 const {people=[],families=[],categories=[]}=options;
 const members=new Set([...people,...[...families].flatMap(id=>familyMemberIds(family,id))]),groups=new Set(categories);
 return sortVideos(items.filter(item=>(!groups.size||groups.has(item.videoCategory||'family'))&&(!members.size||(item.tags||[]).some(person=>members.has(person.id)))),options);
}
