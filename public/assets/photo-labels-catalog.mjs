export const PHOTO_LABELS=[
  {id:'birthdays',name:'ימי הולדת',nameEn:'Birthdays'},
  {id:'bar-bat-mitzvah',name:'בר/בת מצווה',nameEn:'Bar/Bat Mitzvah'},
  {id:'purim',name:'פורים',nameEn:'Purim'},
  {id:'abroad',name:'חו״ל',nameEn:'Abroad'},
  {id:'black-and-white',name:'שחור לבן',nameEn:'Black and white'},
  {id:'holidays',name:'חגים',nameEn:'Holidays'}
];
export const MAX_PHOTO_LABELS=32;
const customPrefix='custom:';
const labelKey=value=>String(value).normalize('NFKC').replace(/\s+/g,' ').trim().toLocaleLowerCase();
export function photoLabelFromName(value){
  if(typeof value!=='string')return null;
  const name=value.normalize('NFKC').replace(/\s+/g,' ').trim();
  if(!name||Array.from(name).length>60||/[\u0000-\u001f\u007f-\u009f]/.test(name))return null;
  const known=PHOTO_LABELS.find(label=>[label.id,label.name,label.nameEn].some(alias=>labelKey(alias)===labelKey(name)));
  try{return known?.id||customPrefix+encodeURIComponent(name);}catch{return null;}
}
export function normalizePhotoLabel(value){
  if(PHOTO_LABELS.some(label=>label.id===value))return value;
  if(typeof value!=='string'||!value.startsWith(customPrefix))return null;
  try{return photoLabelFromName(decodeURIComponent(value.slice(customPrefix.length)));}catch{return null;}
}
export const photoLabelKey=value=>{const id=normalizePhotoLabel(value);return id?.startsWith(customPrefix)?customPrefix+labelKey(decodeURIComponent(id.slice(customPrefix.length))):id;};
export function photoLabels(value){
  const ids=[],seen=new Set();for(const raw of Array.isArray(value)?value:[]){const id=normalizePhotoLabel(raw),key=photoLabelKey(id);if(id&&!seen.has(key)){seen.add(key);ids.push(id);}}
  return [...PHOTO_LABELS.filter(label=>ids.includes(label.id)).map(label=>label.id),...ids.filter(id=>id.startsWith(customPrefix))].slice(0,MAX_PHOTO_LABELS);
}
export function photoLabelName(label,english=false){
  const id=typeof label==='string'?label:label.id,known=PHOTO_LABELS.find(option=>option.id===id);
  if(known)return english?known.nameEn:known.name;
  if(normalizePhotoLabel(id))return decodeURIComponent(id.slice(customPrefix.length));
  return (english?label.nameEn:label.name)||label.name||'';
}
let remembered=[],catalogPromise=null,catalogTime=0;
export function photoLabelOptions(extra=[]){
  const custom=new Map();for(const raw of [...remembered,...extra]){const id=normalizePhotoLabel(raw);if(id?.startsWith(customPrefix)&&!custom.has(photoLabelKey(id)))custom.set(photoLabelKey(id),id);}
  return [...PHOTO_LABELS,...[...custom.values()].map(id=>({id,name:photoLabelName(id),nameEn:photoLabelName(id)}))];
}
export function rememberPhotoLabels(values){
  const previous=remembered.join('\n');remembered=photoLabelOptions(values).filter(label=>label.id.startsWith(customPrefix)).map(label=>label.id);
  if(previous!==remembered.join('\n')&&typeof window!=='undefined')window.dispatchEvent(new CustomEvent('family-photo-label-catalog'));
}
export async function loadPhotoLabelCatalog(){
  if(catalogPromise)return catalogPromise;if(catalogTime&&Date.now()-catalogTime<300000)return photoLabelOptions();
  if(typeof window==='undefined'||!window.FamilyI18n?.fetch)return photoLabelOptions();
  catalogPromise=(async()=>{try{const response=await window.FamilyI18n.fetch('api/photo-labels',{cache:'no-store'});if(!response.ok)return photoLabelOptions();const result=await response.json();rememberPhotoLabels((result.labels||[]).map(label=>label.id));catalogTime=Date.now();}catch{}return photoLabelOptions();})().finally(()=>{catalogPromise=null;});return catalogPromise;
}
