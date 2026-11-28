import {updateWorkDestination} from './video-segment-work.mjs';
import {HttpError,text,uid} from './http.mjs';
import {DEFAULT_VIDEO_CATEGORIES} from '../public/assets/video-category-catalog.mjs';

const key='video-categories-v1';
const normalized=value=>value.normalize('NFKC').replace(/\s+/gu,' ').trim().toLocaleLowerCase();
export class VideoCategories {
 constructor(owner){this.owner=owner;}
 snapshot(){
  const value=this.owner.rows('SELECT value FROM meta WHERE id=?',key)[0]?.value;
  return [...DEFAULT_VIDEO_CATEGORIES.map(category=>({...category})),...(value?JSON.parse(value):[])];
 }
 category(id){
  const category=this.snapshot().find(category=>category.id===id);
  if(!category)throw new HttpError(400,'קטגוריית הסרטון אינה מוכרת.');
  return category;
 }
 create(p){
  const name=text(p.name,'שם הקטגוריה',80,true),nameEn=text(p.nameEn||'','שם הקטגוריה באנגלית',80),categories=this.snapshot();
  const labels=[name,nameEn].filter(Boolean).map(normalized);
  if(categories.some(category=>[category.name,category.nameEn].filter(Boolean).some(label=>labels.includes(normalized(label)))))throw new HttpError(409,'כבר קיימת קטגוריה בשם הזה.');
  if(categories.length>=100)throw new HttpError(400,'אפשר ליצור עד 100 קטגוריות סרטונים.');
  const category={id:uid(),name,nameEn:nameEn||null,createdAt:new Date().toISOString()};
  const custom=[...categories.filter(category=>!DEFAULT_VIDEO_CATEGORIES.some(original=>original.id===category.id)),category];
  this.owner.sql.exec('INSERT INTO meta(id,value) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value',key,JSON.stringify(custom));
  this.owner.touch('videos');
  return {saved:true,operation:'video-category-create',scope:'videos',category,collection:this.owner.collection('videos')};
 }
 assign(p){
  const item=this.owner.media(p.id);
  if(item.category!=='videos'||item.kind!=='video'&&!item.mime?.startsWith('video/'))throw new HttpError(400,'בחרו סרטון מטאב הסרטונים.');
  const category=this.category(p.group),previous=item.videoCategory||'family';
  if(p.expectedGroup!==previous)throw new HttpError(409,'קטגוריית הסרטון השתנתה. פתחו את הבחירה מחדש.');
  if(category.id!==previous){
   updateWorkDestination(item,'group',category.id);
   item.videoCategory=category.id;item.modifiedAt=new Date().toISOString();
   this.owner.sql.exec('UPDATE media SET data=? WHERE id=?',JSON.stringify(item),item.id);this.owner.touchMedia(item);
  }
  return this.owner.mediaChanged(item,'video-category');
 }
}
