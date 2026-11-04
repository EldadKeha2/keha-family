import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import worker,{FamilyState,PUBLIC_WRITE_TOKEN} from '../src/worker.mjs';
import {validateTriviaQuestion,triviaLanguage,mixTriviaQuestions} from '../src/trivia-questions.mjs';

const he={language:'he',question:'מי עלה לארץ בשנת 1932?',options:['שלמה קהא','יונה נקאש','רותי חריזי','אלדד קהא'],correctIndex:0,requestId:'a'.repeat(32)};
const en={language:'en',question:'Who immigrated to Israel in 1932?',options:['Shlomo Keha','Yona Nakash','Ruth Harizi','Eldad Keha'],correctIndex:0,requestId:'b'.repeat(32)};
function fixture(){
  const database=new DatabaseSync(':memory:'),storage={sql:{exec(q,...args){const s=database.prepare(q),rows=s.columns().length?s.all(...args):(s.run(...args),[]);return {toArray:()=>rows};}},transactionSync(f){database.exec('BEGIN');try{const value=f();database.exec('COMMIT');return value;}catch(error){database.exec('ROLLBACK');throw error;}}};
  let state=new FamilyState({storage},{});const env={FAMILY_STATE:{idFromName:n=>n,get:()=>state},ASSETS:{fetch:async()=>new Response('site')}};
  return {database,restart(){state=new FamilyState({storage},{});},close(){database.close();},call(path,body,headers={}){return worker.fetch(new Request('https://family.test'+path,{method:body===undefined?'GET':'POST',headers:{...(body===undefined?{}:{'Content-Type':'application/json','X-Family-Token':PUBLIC_WRITE_TOKEN,Origin:'https://family.test'}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})}),env,{waitUntil(){}});}};
}
test('question validation requires an explicit supported language, four distinct answers and a correct-answer selection',()=>{
  assert.equal(triviaLanguage('en-US'),'en');assert.equal(triviaLanguage('en-GB'),'en');assert.equal(validateTriviaQuestion(he).question,he.question);
  for(const body of [null,[],{...he,language:'fr'},{...he,question:'?'},{...he,options:['one',' ONE ','three','four']},{...he,options:['one','two','three']},{...he,correctIndex:4},{...he,correctIndex:'0'},{...he,requestId:'bad'}])assert.throws(()=>validateTriviaQuestion(body),{status:400});
});
test('saved questions are durable and idempotent, and each language reads only its own bank',async t=>{
  t.mock.method(Math,'random',()=>0);const f=fixture();try{
    for(const body of [he,en,he])assert.equal((await f.call('/api/games/trivia/questions',body)).status,200);assert.equal(f.database.prepare('SELECT count(*) n FROM trivia_questions').get().n,2);
    assert.equal((await f.call('/api/games/trivia/questions',{...he,correctIndex:1})).status,409);f.restart();
    for(const [lang,question,wrong]of [['he',he.question,en.question],['en-US',en.question,he.question],['en-GB',en.question,he.question]]){
      const response=await f.call('/api/games/trivia?lang='+lang);assert.equal(response.status,200);const data=await response.json();assert.equal(data.questions.length,10);assert.ok(data.questions.some(q=>q.prompt===question));assert.ok(!data.questions.some(q=>q.prompt===wrong));const own=data.questions.find(q=>q.prompt===question);assert.equal(own.subject,null);assert.equal(own.options.find(o=>o.id===own.correctId).name,lang==='he'?'שלמה קהא':'Shlomo Keha');
    }
    const backup=await(await f.call('/api/export')).json();assert.equal(backup.triviaQuestions.length,2);
  }finally{f.close();}
});
test('invalid requests or foreign origins cannot write a question',async()=>{
  const f=fixture();try{for(const body of [{...he,options:['','','','']},{...he,language:'de'},{...he,correctIndex:null}])assert.equal((await f.call('/api/games/trivia/questions',body)).status,400);assert.equal((await f.call('/api/games/trivia/questions',he,{Origin:'https://other.test'})).status,403);assert.equal((await f.call('/api/games/trivia/questions',he,{'X-Family-Token':'bad'})).status,403);assert.equal(f.database.prepare('SELECT count(*) n FROM trivia_questions').get().n,0);}
  finally{f.close();}
});
test('mixing the question bank keeps question text unchanged and the correct answer attached while shuffling choices',()=>{
  const [q]=mixTriviaQuestions([],[{id:'q',...en}],10,()=>0);assert.equal(q.prompt,en.question);assert.equal(q.promptEn,en.question);assert.equal(q.options.length,4);assert.equal(q.options.find(o=>o.id===q.correctId).name,'Shlomo Keha');assert.equal(new Set(q.options.map(o=>o.name)).size,4);
});
