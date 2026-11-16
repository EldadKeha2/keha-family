import {photoDate} from './photo-date.mjs';
import {videoCategoryId} from './video-category-catalog.mjs';
export function videoUploadMetadata(value){
 if(!value||typeof value!=='object'||Array.isArray(value))throw new RangeError('Invalid video details');
 const name=value.name??'',caption=value.caption??'';
 if(typeof name!=='string'||!name.trim()||name.length>140||typeof caption!=='string'||caption.length>5000)throw new RangeError('Invalid video name or description');
 const date=photoDate(value.date);if(date.year&&(date.year<1910||date.year>new Date().getFullYear()))throw new RangeError('Invalid recording year');
 const result={name:name.trim(),caption:caption.trim(),date,people:[]};
 if(value.range!==undefined&&value.range!==null){const {start,end,remove}=value.range;if(remove!==undefined&&typeof remove!=='boolean')throw new RangeError('Invalid selected clip action');if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end-start<.1||end>86400)throw new RangeError('Invalid selected clip');result.range={start,end,...(remove?{remove:true}:{})};}
 if(value.eventId!==undefined){if(typeof value.eventId!=='string'||value.eventId.length>64)throw new RangeError('Invalid event');result.eventId=value.eventId;}
 if(value.group!==undefined)result.group=videoCategoryId(value.group);
 if(value.people!==undefined){if(!Array.isArray(value.people)||value.people.length>150)throw new RangeError('Invalid people');result.people=value.people.map(person=>{if(!person||Boolean(person.personId)===Boolean(person.name))throw new RangeError('Invalid person');const field=person.personId?'personId':'name',text=person[field];if(typeof text!=='string'||!text.trim()||text.length>120)throw new RangeError('Invalid person');return {[field]:text.trim()};});}
 return result;
}
