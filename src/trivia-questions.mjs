import {HttpError} from './http.mjs';
import {shuffled} from '../public/assets/quiz.mjs';

export function triviaLanguage(value='he'){
  if(value==='he')return 'he';if(['en','en-US','en-GB'].includes(value))return 'en';
  throw new HttpError(400,'בחרו עברית או אנגלית לשאלה.');
}
const normalize=value=>value.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g,' ').trim();
export function validateTriviaQuestion(body){
  if(!body||typeof body!=='object'||Array.isArray(body))throw new HttpError(400,'מלאו את פרטי השאלה.');
  const language=triviaLanguage(body.language??null),question=typeof body.question==='string'?body.question.trim():'';
  if(question.length<5||question.length>500)throw new HttpError(400,'השאלה צריכה להכיל בין 5 ל־500 תווים.');
  if(!Array.isArray(body.options)||body.options.length!==4||body.options.some(value=>typeof value!=='string'||!value.trim()||value.trim().length>160))throw new HttpError(400,'מלאו ארבע תשובות, עד 160 תווים לכל תשובה.');
  const options=body.options.map(value=>value.trim());if(new Set(options.map(normalize)).size!==4)throw new HttpError(400,'ארבע התשובות צריכות להיות שונות זו מזו.');
  if(!Number.isInteger(body.correctIndex)||body.correctIndex<0||body.correctIndex>3)throw new HttpError(400,'סמנו איזו תשובה היא הנכונה.');
  if(typeof body.requestId!=='string'||!/^[a-f0-9]{32}$/.test(body.requestId))throw new HttpError(400,'רעננו את הטופס ונסו לשמור שוב.');
  return {language,question,options,correctIndex:body.correctIndex};
}
export function savedTriviaQuestion(record){
  const id='custom-'+record.id,options=record.options.map((value,index)=>({id:id+'-'+index,name:value,nameEn:value}));
  return {id,kind:'trivia',topic:'custom',language:record.language,subject:null,prompt:record.question,promptEn:record.question,correctId:options[record.correctIndex].id,options};
}
export function mixTriviaQuestions(automatic,custom,count=10,random=Math.random){
  return shuffled([...automatic,...custom.map(savedTriviaQuestion)],random).slice(0,count).map(question=>({...question,options:shuffled(question.options,random)}));
}
