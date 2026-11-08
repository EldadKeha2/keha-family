import {HttpError,text} from './http.mjs';
import {houseStageBonuses} from '../public/assets/ruti-house-bonuses.mjs';
import {HOUSE_STAGE_GOALS,houseTasksThroughLevel} from '../public/assets/ruti-house-levels.mjs';

export const RUTI_HOUSE_SCORE_LIMIT=20;
export const RUTI_HOUSE_SCORE_FIELDS=['score','level','meals','snacks','plants','dust','cats','dishes','bestCombo','elapsed'];

function completionResults(value){
  const goals=value.version===7?HOUSE_STAGE_GOALS:Array(12).fill(30);
  if(!Number.isSafeInteger(value.completedLevels)||value.completedLevels<0||value.completedLevels>goals.length||!Array.isArray(value.stageResults)||value.stageResults.length!==goals.length)throw new HttpError(400,'נתוני בונוס השלבים אינם תקינים.');
  const keys=['plants','dust','missedPlants','missedDust','completed'];
  const results=value.stageResults.map((row,index)=>{
    if(index>=value.completedLevels){if(row!==null)throw new HttpError(400,'בונוס ניתן רק לשלב שהושלם.');return null;}
    const goal=goals[index];
    if(!row||typeof row!=='object'||Array.isArray(row)||keys.some(key=>!Number.isSafeInteger(row[key])||row[key]<0||row[key]>goal)||row.plants+row.dust>row.completed||row.missedPlants+row.missedDust>goal-row.completed)throw new HttpError(400,'סיכום מטלות השלב אינו תקין.');
    return Object.fromEntries(keys.map(key=>[key,row[key]]));
  });
  const sum=key=>results.reduce((total,row)=>total+(row?.[key]||0),0);
  const completed=sum('completed'),missed=goals.slice(0,value.completedLevels).reduce((total,goal)=>total+goal,0)-completed;
  if(sum('plants')>value.plants||sum('dust')>value.dust||missed>value.missed||completed-sum('plants')-sum('dust')>value.cats+value.meals+value.snacks+value.oraWins)throw new HttpError(400,'סיכום השלבים אינו תואם למטלות שבוצעו.');
  return {results,bonuses:results.map((row,index)=>houseStageBonuses(row,goals[index]).total)};
}

export function rutiHouseScore(value){
  if(!value||typeof value!=='object'||Array.isArray(value)||typeof value.requestId!=='string'||!/^[a-f0-9]{32}$/.test(value.requestId))throw new HttpError(400,'יש להתחיל משחק חדש ולנסות שוב.');
  const name=text(value.name,'שם השחקן או השחקנית',60,true).normalize('NFKC').replace(/\s+/g,' ');
  if(!name||name.length>60||/[\u0000-\u001f\u007f]/.test(name))throw new HttpError(400,'יש להזין שם תקין באורך של עד 60 תווים.');
  if(RUTI_HOUSE_SCORE_FIELDS.some(key=>!Number.isSafeInteger(value[key])||value[key]<0)||value.level<1)throw new HttpError(400,'נתוני המשחק אינם תקינים.');
  const counts=['meals','snacks','plants','dust','cats','dishes'],weights=[300n,200n,40n,20n,60n,20n];
  const actions=counts.reduce((sum,key)=>sum+BigInt(value[key]),0n),base=counts.reduce((sum,key,index)=>sum+BigInt(value[key])*weights[index],0n),score=BigInt(value.score);
  const oraWins=[4,5,6,7].includes(value.version)?value.oraWins:0;
  if(!Number.isSafeInteger(oraWins)||oraWins<0||oraWins>(value.version===7?17:[5,6].includes(value.version)?9:7))throw new HttpError(400,'נתוני הבונוס אינם תקינים.');
  const completion=[6,7].includes(value.version)?completionResults(value):null;
  const bonusTotal=completion?.bonuses.reduce((total,bonus)=>total+bonus,0)||0;
  const ordinaryScore=score-BigInt(oraWins)*5000n-BigInt(bonusTotal),maxMultiplier=[3,4,5,6,7].includes(value.version)?4n:2n;
  if(ordinaryScore<base||ordinaryScore>base*maxMultiplier||BigInt(value.bestCombo)>actions)throw new HttpError(400,'הניקוד אינו תואם לפעולות שבוצעו במשחק.');
  const missed=[5,6,7].includes(value.version)?value.missed:0;
  if(!Number.isSafeInteger(missed)||missed<0)throw new HttpError(400,'נתוני המטלות אינם תקינים.');
  let details={version:null,completedLevels:null,stageScores:null,stageResults:null,oraWins,missed};
  if(value.version===undefined){
    if(value.level!==1+Math.floor(value.elapsed/24))throw new HttpError(400,'נתוני המשחק אינם תקינים.');
  }else{
    const levelCount=value.version===7?HOUSE_STAGE_GOALS.length:[5,6].includes(value.version)?12:10;
    if(![2,3,4,5,6,7].includes(value.version)||value.level>levelCount||!Number.isSafeInteger(value.completedLevels)||value.completedLevels<0||value.completedLevels>levelCount||value.completedLevels>value.level||!Array.isArray(value.stageScores)||value.stageScores.length!==levelCount||value.stageScores.some((n,index)=>!Number.isSafeInteger(n)||n<0||(index>=value.level&&n!==0)||n<(completion?.bonuses[index]||0)))throw new HttpError(400,'נתוני השלבים אינם תקינים.');
    if(value.stageScores.reduce((sum,n)=>sum+BigInt(n),0n)!==score)throw new HttpError(400,'ניקוד השלבים אינו תואם לתוצאה הכוללת.');
    if(value.version===4){
      const completedTasks=value.plants+value.dust+value.cats+value.meals+value.snacks+oraWins-value.completedLevels*30,won=value.level===10&&value.completedLevels===10;
      const eligible=Math.max(0,value.completedLevels-3)+(value.level>=4&&completedTasks>=11?1:0);
      if((!won&&value.completedLevels!==value.level-1)||completedTasks<0||completedTasks>(won?0:29)||oraWins>eligible)throw new HttpError(400,'נתוני המטלות או הבונוס אינם תקינים.');
    }
    if([5,6,7].includes(value.version)){
      const resolved=value.version===7?houseTasksThroughLevel(value.completedLevels):value.completedLevels*30;
      const partial=BigInt(value.plants)+BigInt(value.dust)+BigInt(value.cats)+BigInt(value.meals)+BigInt(value.snacks)+BigInt(oraWins)+BigInt(missed)-BigInt(resolved);
      const won=value.level===levelCount&&value.completedLevels===levelCount;
      const eligible=Math.max(0,value.completedLevels-3)+(value.level>=4&&partial>=11n?1:0);
      const goal=value.version===7?HOUSE_STAGE_GOALS[value.level-1]:30;
      if((!won&&value.completedLevels!==value.level-1)||partial<0n||partial>(won?0n:BigInt(goal))||oraWins>eligible)throw new HttpError(400,'נתוני המטלות או הבונוס אינם תקינים.');
    }
    details={version:value.version,completedLevels:value.completedLevels,stageScores:[...value.stageScores],stageResults:completion?.results||null,oraWins,missed};
  }
  return {id:value.requestId,name,...Object.fromEntries(RUTI_HOUSE_SCORE_FIELDS.map(key=>[key,value[key]])),...details};
}
