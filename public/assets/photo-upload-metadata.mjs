import {photoDate} from './photo-date.mjs';

export const PHOTO_METADATA_HEADER='X-Family-Photo-Metadata-Length';
export const MAX_PHOTO_METADATA_BYTES=32768;

export function filenamePhotoDate(filename){
  const stem=String(filename||'').split(/[\\/]/).pop().replace(/\.[a-z0-9]+$/i,''),found=[];
  const part=value=>/^x+$/i.test(value)?null:Number(value);
  const add=(day,month,year)=>{try{found.push(photoDate({day:part(day),month:part(month),year:part(year)}));}catch{found.push(null);}};
  // Accept explicit dates and the partial/alternative names in scanned-photo ZIPs.
  for(const match of stem.matchAll(/(?:^|[^0-9])([0-9]{1,2}|X{1,2})[_.-]([0-9]{1,2}|X{1,2})[_.-]([0-9]{4}|X{4})(?=$|[^0-9])/gi))add(match[1],match[2],match[3]);
  for(const match of stem.matchAll(/(?:^|[^0-9])([0-9]{4})[_.-]([0-9]{1,2}|X{1,2})[_.-]([0-9]{1,2}|X{1,2})(?=$|[^0-9])/gi))add(match[3],match[2],match[1]);
  if(!found.length){
    const camera=/^(?:IMG|PXL|DSC|PHOTO)[_-]?((?:19|20)[0-9]{2})([0-9]{2})([0-9]{2})(?=$|[_ .-])/i.exec(stem);
    if(camera)add(camera[3],camera[2],camera[1]);
    else if(/^[0-9]{4}$/.test(stem))add('XX','XX',stem);
  }
  const empty=photoDate(null);
  if(!found.length)return {date:empty,status:'none'};
  if(found.some(date=>!date))return {date:empty,status:'invalid'};
  const date=Object.fromEntries(['day','month','year'].map(field=>[field,found.every(value=>value[field]===found[0][field])?found[0][field]:null]));
  const disagreement=found.some(value=>['day','month','year'].some(field=>value[field]!==found[0][field]));
  return {date,status:disagreement?'ambiguous':Object.values(date).every(value=>value===null)?'none':Object.values(date).some(value=>value===null)?'partial':'full'};
}

export function normalizeUploadMetadata(value){
  if(!value||typeof value!=='object'||Array.isArray(value))throw new RangeError('Invalid photo metadata');
  const caption=value.caption??'';
  if(typeof caption!=='string'||caption.length>5000)throw new RangeError('Invalid photo caption');
  return {date:photoDate(value.date),caption};
}

export function photoUploadPayload(file,metadata){
  if(!metadata)return {body:file,headers:{}};
  const bytes=new TextEncoder().encode(JSON.stringify(normalizeUploadMetadata(metadata)));
  if(bytes.byteLength>MAX_PHOTO_METADATA_BYTES)throw new RangeError('Photo metadata too large');
  // A bounded JSON prefix keeps captions out of URLs and leaves image bytes intact.
  return {body:new Blob([bytes,file],{type:file.type||'application/octet-stream'}),headers:{[PHOTO_METADATA_HEADER]:String(bytes.byteLength)}};
}

export function decodeUploadMetadata(bytes){
  if(!bytes?.byteLength||bytes.byteLength>MAX_PHOTO_METADATA_BYTES)throw new RangeError('Invalid photo metadata');
  return normalizeUploadMetadata(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)));
}
