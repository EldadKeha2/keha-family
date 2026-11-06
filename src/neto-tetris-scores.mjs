import {HttpError,text} from './http.mjs';

export const NETO_TETRIS_SCORE_LIMIT=20;
const stats=['score','lines','level','pieces','zaps'];

export function netoTetrisScore(value){
  if(!value||typeof value!=='object'||Array.isArray(value)||typeof value.requestId!=='string'||!/^[a-f0-9]{32}$/.test(value.requestId))throw new HttpError(400,'יש להתחיל משחק חדש ולנסות שוב.');
  const name=text(value.name,'שם השחקן או השחקנית',60,true).normalize('NFKC').replace(/\s+/g,' ');
  if(!name||name.length>60||/[\u0000-\u001f\u007f]/.test(name))throw new HttpError(400,'יש להזין שם תקין באורך של עד 60 תווים.');
  if(stats.some(key=>!Number.isSafeInteger(value[key])||value[key]<0)||value.level!==1+Math.floor(value.lines/10))throw new HttpError(400,'נתוני המשחק אינם תקינים.');
  // A cleared line is worth 100 to 200 points times its level. ZAP clears
  // never award points. BigInt keeps bounds exact even for very long runs.
  const score=BigInt(value.score),lines=BigInt(value.lines),level=BigInt(value.level);
  if(value.score%100!==0||score<100n*lines||score>200n*lines*level)throw new HttpError(400,'הניקוד אינו תואם לשורות שנוקו.');
  return {id:value.requestId,name,...Object.fromEntries(stats.map(key=>[key,value[key]]))};
}
