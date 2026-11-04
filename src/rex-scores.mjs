import {HttpError,text} from './http.mjs';
import {PREPARED_HEADS} from '../public/assets/jachnun-heads.mjs';
import {FOODS,basketPoints,MAX_COLLECTIBLES} from '../public/assets/rex.mjs';

export const REX_SCORE_LIMIT=20;
export function rexScore(value){
  if(typeof value.requestId!=='string'||!/^[a-f0-9]{32}$/.test(value.requestId))throw new HttpError(400,'יש להתחיל משחק חדש ולנסות שוב.');
  const name=text(value.name,'שם השחקן או השחקנית',60,true).normalize('NFKC').replace(/\s+/g,' ');
  if(!name||name.length>60||/[\u0000-\u001f\u007f]/.test(name))throw new HttpError(400,'יש להזין שם תקין באורך של עד 60 תווים.');
  if(!PREPARED_HEADS.some(head=>head.id===value.headId))throw new HttpError(400,'הראש שנבחר אינו ברשימת הראשים של המשחק.');
  if(!value.basket||typeof value.basket!=='object'||Array.isArray(value.basket))throw new HttpError(400,'סל המאכלים אינו תקין.');
  const basket={};
  // Includes food-only sections and all food retained across the three lives.
  for(const food of FOODS){const count=value.basket[food.id];if(!Number.isSafeInteger(count)||count<0||count>MAX_COLLECTIBLES)throw new HttpError(400,'סל המאכלים אינו תקין.');basket[food.id]=count;}
  if(Object.values(basket).reduce((a,b)=>a+b,0)>MAX_COLLECTIBLES||value.score!==basketPoints(basket))throw new HttpError(400,'הניקוד אינו תואם למאכלים שנאספו.');
  return {id:value.requestId,name,score:value.score,headId:value.headId,basket};
}
