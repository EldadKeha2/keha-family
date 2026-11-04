import {HttpError,text} from './http.mjs';
import {PREPARED_HEADS} from '../public/assets/jachnun-heads.mjs';

export const JACHNUN_SCORE_LIMIT=20;
const heads=new Set(PREPARED_HEADS.map(head=>head.id));
// Each of the three lives can grow from three cells to the full 18 × 18 board.
const maximumScore=3*(18*18-3);

export function jachnunScore(value){
  if(typeof value.requestId!=='string'||!/^[a-f0-9]{32}$/.test(value.requestId))throw new HttpError(400,'יש להתחיל משחק חדש ולנסות שוב.');
  const name=text(value.name,'שם השחקן או השחקנית',60,true).normalize('NFKC').replace(/\s+/g,' ');
  if(!name||name.length>60||/[\u0000-\u001f\u007f]/.test(name))throw new HttpError(400,'יש להזין שם תקין באורך של עד 60 תווים.');
  if(!Number.isSafeInteger(value.score)||value.score<0||value.score>maximumScore)throw new HttpError(400,'מספר הג׳חנונים אינו תקין.');
  if(!heads.has(value.headId))throw new HttpError(400,'הראש שנבחר אינו ברשימת הראשים של המשחק.');
  return {id:value.requestId,name,score:value.score,headId:value.headId};
}
