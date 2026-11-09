export const QUIZ_ROUND_MS=15000;
export const QUIZ_BASE_POINTS=100;
export const QUIZ_SPEED_POINTS=100;
export const QUIZ_LENGTH=10;

export function quizAnswerPoints(correct,elapsedMs){
  if(!correct)return 0;
  const elapsed=Math.max(0,Math.min(QUIZ_ROUND_MS,elapsedMs));
  if(!Number.isFinite(elapsed)||elapsed>=QUIZ_ROUND_MS)return 0;
  return QUIZ_BASE_POINTS+Math.floor(QUIZ_SPEED_POINTS*(QUIZ_ROUND_MS-elapsed)/QUIZ_ROUND_MS);
}

export function quizScoreSummary(answers){
  const correct=answers.filter(answer=>answer.correct).length;
  const score=answers.reduce((sum,answer)=>sum+quizAnswerPoints(answer.correct,answer.elapsedMs),0);
  return {score,correct,total:answers.length,base:correct*QUIZ_BASE_POINTS,bonus:score-correct*QUIZ_BASE_POINTS,elapsedMs:answers.reduce((sum,answer)=>sum+answer.elapsedMs,0)};
}
