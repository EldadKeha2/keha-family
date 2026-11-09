import {HttpError,text} from './http.mjs';
import {QUIZ_LENGTH,QUIZ_ROUND_MS,quizScoreSummary} from '../public/assets/quiz-scoring.mjs';

export const QUIZ_SCORE_LIMIT=20;
export const QUIZ_GAMES=['photos','kinship','missing','trivia'];

export function quizScore(value,questions){
  if(!value||typeof value!=='object'||Array.isArray(value)||!QUIZ_GAMES.includes(value.game)||typeof value.requestId!=='string'||!/^[a-f0-9]{32}$/.test(value.requestId))throw new HttpError(400,'יש להתחיל משחק חדש ולנסות שוב.');
  const name=text(value.name,'שם השחקן או השחקנית',60,true).normalize('NFKC').replace(/\s+/g,' ').trim();
  if(!name||name.length>60||/[\u0000-\u001f\u007f]/.test(name))throw new HttpError(400,'יש להזין שם תקין באורך של עד 60 תווים.');
  if(!Array.isArray(questions)||questions.length!==QUIZ_LENGTH||!Array.isArray(value.answers)||value.answers.length!==QUIZ_LENGTH)throw new HttpError(400,'טבלת השיאים מיועדת לסיבוב מלא של 10 שאלות. התחילו משחק חדש.');
  const answers=value.answers.map((answer,index)=>{
    const question=questions[index];
    if(!answer||answer.id!==question.id||!Number.isInteger(answer.elapsedMs)||answer.elapsedMs<0||answer.elapsedMs>QUIZ_ROUND_MS||!(answer.selectedId===null?answer.elapsedMs===QUIZ_ROUND_MS:answer.elapsedMs<QUIZ_ROUND_MS&&question.optionIds.includes(answer.selectedId)))throw new HttpError(400,'נתוני התשובות או הזמנים אינם תקינים.');
    return {id:answer.id,selectedId:answer.selectedId,elapsedMs:answer.elapsedMs,correct:answer.selectedId!==null&&answer.selectedId===question.correctId};
  });
  const summary=quizScoreSummary(answers);
  if(!Number.isSafeInteger(value.score)||value.score!==summary.score)throw new HttpError(400,'הניקוד אינו תואם לתשובות ולזמני המענה.');
  return {id:value.requestId,game:value.game,name,answers,...summary};
}
