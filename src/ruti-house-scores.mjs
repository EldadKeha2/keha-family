import {HttpError,text} from './http.mjs';

export const RUTI_HOUSE_SCORE_LIMIT=20;
export const RUTI_HOUSE_SCORE_FIELDS=['score','level','meals','snacks','plants','dust','cats','dishes','bestCombo','elapsed'];

export function rutiHouseScore(value){
  if(!value||typeof value!=='object'||Array.isArray(value)||typeof value.requestId!=='string'||!/^[a-f0-9]{32}$/.test(value.requestId))throw new HttpError(400,'יש להתחיל משחק חדש ולנסות שוב.');
  const name=text(value.name,'שם השחקן או השחקנית',60,true).normalize('NFKC').replace(/\s+/g,' ');
  if(!name||name.length>60||/[\u0000-\u001f\u007f]/.test(name))throw new HttpError(400,'יש להזין שם תקין באורך של עד 60 תווים.');
  if(RUTI_HOUSE_SCORE_FIELDS.some(key=>!Number.isSafeInteger(value[key])||value[key]<0)||value.level<1)throw new HttpError(400,'נתוני המשחק אינם תקינים.');
  const counts=['meals','snacks','plants','dust','cats','dishes'],weights=[300n,200n,40n,20n,60n,20n];
  const actions=counts.reduce((sum,key)=>sum+BigInt(value[key]),0n),base=counts.reduce((sum,key,index)=>sum+BigInt(value[key])*weights[index],0n),score=BigInt(value.score);
  if(score<base||score>base*2n||BigInt(value.bestCombo)>actions)throw new HttpError(400,'הניקוד אינו תואם לפעולות שבוצעו במשחק.');
  let details={version:null,completedLevels:null,stageScores:null};
  if(value.version===undefined){
    if(value.level!==1+Math.floor(value.elapsed/24))throw new HttpError(400,'נתוני המשחק אינם תקינים.');
  }else{
    if(value.version!==2||value.level>10||!Number.isSafeInteger(value.completedLevels)||value.completedLevels<0||value.completedLevels>10||value.completedLevels>value.level||!Array.isArray(value.stageScores)||value.stageScores.length!==10||value.stageScores.some((n,index)=>!Number.isSafeInteger(n)||n<0||(index>=value.level&&n!==0)))throw new HttpError(400,'נתוני השלבים אינם תקינים.');
    if(value.stageScores.reduce((sum,n)=>sum+BigInt(n),0n)!==score)throw new HttpError(400,'ניקוד השלבים אינו תואם לתוצאה הכוללת.');
    details={version:2,completedLevels:value.completedLevels,stageScores:[...value.stageScores]};
  }
  return {id:value.requestId,name,...Object.fromEntries(RUTI_HOUSE_SCORE_FIELDS.map(key=>[key,value[key]])),...details};
}
