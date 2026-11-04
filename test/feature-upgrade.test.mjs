import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import worker,{FamilyState,PUBLIC_WRITE_TOKEN} from '../src/worker.mjs';
import family from '../src/family.mjs';
import {memorialPeriod} from '../src/memorial.mjs';
import {makeQuiz,quizAge,quizGrade} from '../public/assets/quiz.mjs';

function fixture(){
  const database=new DatabaseSync(':memory:');
  const storage={sql:{exec(q,...args){const s=database.prepare(q),rows=s.columns().length?s.all(...args):(s.run(...args),[]);return {toArray:()=>rows};}},transactionSync(f){database.exec('BEGIN');try{const value=f();database.exec('COMMIT');return value;}catch(e){database.exec('ROLLBACK');throw e;}}};
  let state=new FamilyState({storage},{});const env={FAMILY_STATE:{idFromName:n=>n,get:()=>state},ASSETS:{fetch:async()=>new Response('site')}};
  async function call(path,{body,headers={}}={}){const method=body?'POST':'GET';return worker.fetch(new Request('https://family.test'+path,{method,headers:{...(body?{'Content-Type':'application/json','X-Family-Token':PUBLIC_WRITE_TOKEN,Origin:'https://family.test'}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})}),env,{waitUntil(){}});}
  return {database,call,restart(){state=new FamilyState({storage},{});},close(){database.close();}};
}
test('Hebrew and English biography text persist independently, including stale-write checks and both English variants',async()=>{
  const f=fixture();try{
    const save=(action,body)=>f.call('/api/people/eldad/'+action,{body});
    assert.equal((await save('about',{about:'הסיפור בעברית',expectedAbout:''})).status,200);
    assert.equal((await save('about',{about:'The English story',expectedAbout:'',language:'en-US'})).status,200);
    assert.equal((await save('about',{about:'Stale English',expectedAbout:'',language:'en-GB'})).status,409);
    for(const [language,value]of [['he','חוקר'],['en','Researcher']])assert.equal((await save('biography',{language,section:'occupation',value,expectedValue:''})).status,200);
    const hebrew=[{employer:'אוניברסיטה',role:'מרצה',fromYear:2020,toYear:null,current:true}],english=[{employer:'University',role:'Lecturer',fromYear:2020,toYear:null,current:true}];
    for(const [language,value]of [['he',hebrew],['en',english]])assert.equal((await save('biography',{language,section:'jobs',value,expectedValue:[]})).status,200);
    assert.equal((await save('biography',{language:'en',section:'languages',value:['English'],expectedValue:[]})).status,200);
    assert.equal((await save('about',{language:'fr',about:'Wrong language',expectedAbout:''})).status,400);
    f.restart();const p=(await(await f.call('/api/people/eldad/page')).json()).person;
    assert.equal(p.about,'הסיפור בעברית');assert.equal(p.aboutEn,'The English story');assert.equal(p.occupation,'חוקר');assert.equal(p.occupationEn,'Researcher');assert.deepEqual(p.jobs,hebrew);assert.deepEqual(p.jobsEn,english);assert.deepEqual(p.languages,['English']);
  }finally{f.close();}
});
test('memorial cycles reset at Israeli midnight and handle a leap-day anniversary',()=>{
  assert.equal(memorialPeriod('8.5.1998',new Date('2026-05-07T20:59:59Z')).period,'2025-05-08');
  assert.equal(memorialPeriod('8.5.1998',new Date('2026-05-07T21:00:00Z')).period,'2026-05-08');
  assert.equal(memorialPeriod('29.2.2000',new Date('2027-02-28T12:00:00Z')).period,'2027-02-28');
  assert.equal(memorialPeriod('29.2.2000',new Date('2028-02-28T12:00:00Z')).period,'2027-02-28');
  assert.deepEqual(memorialPeriod(null),{period:'all-time',resetsOn:null});
});
test('shared candle counts are idempotent per visitor, survive restarts, and renew independently on each anniversary',async t=>{
  let now=Date.parse('2026-05-07T20:59:00Z');t.mock.method(Date,'now',()=>now);
  const f=fixture(),a='a'.repeat(32),b='b'.repeat(32);try{
    const light=(id,visitorId)=>f.call('/api/memorial/'+id+'/candles',{body:{visitorId}}),counts=async()=> (await(await f.call('/api/memorial',{headers:{'X-Candle-Visitor':a}})).json()).candles;
    for(const response of await Promise.all(Array.from({length:8},()=>light('becker-parent',a))))assert.equal(response.status,200);
    assert.equal((await counts())['becker-parent'].count,1);
    await light('becker-parent',b);await light('yona',a);f.restart();
    let c=await counts();assert.equal(c['becker-parent'].count,2);assert.equal(c['becker-parent'].lit,true);assert.equal(c.yona.count,1);
    now=Date.parse('2026-05-07T21:00:00Z');c=await counts();assert.equal(c['becker-parent'].count,0);assert.equal(c['becker-parent'].lit,false);assert.equal(c.yona.count,1);
    assert.equal((await(await light('becker-parent',a)).json()).candle.count,1);
    now=Date.parse('2026-06-15T21:00:00Z');assert.equal((await counts()).yona.count,0);
    assert.equal((await light('eldad',a)).status,400);assert.equal((await light('yona','bad')).status,400);
    assert.equal((await f.call('/api/memorial/yona/candles',{body:{visitorId:a},headers:{Origin:'https://other.test'}})).status,403);
  }finally{f.close();}
});
test('additional relatives have personal pages, named sibling links, and no position in the tree',async()=>{
  const f=fixture();try{
    for(const [id,name,nameEn]of [['itzhak-katan','יצחק קטן','Itzhak Katan'],['natan-fish','נתן פיש','Natan Fish']]){
      const r=await f.call('/api/people/'+id+'/page');assert.equal(r.status,200);const {person}=await r.json();assert.equal(person.name,name);assert.equal(person.nameEn,nameEn);assert.equal(person.extended,true);
      assert.ok(!Object.values(family.units).some(u=>u.people.includes(id)));
    }
  }finally{f.close();}
});
const roster=Object.fromEntries(Array.from({length:24},(_,i)=>{const id='p'+i;return [id,{id,name:'אדם '+i,nameEn:'Person '+i,birthday:'1.1.'+(1980+i%8),gender:i<12?'m':'f'}];}));
const photos=Array.from({length:15},(_,i)=>({id:'image'+i,kind:'photo',tags:[{id:'p'+i%12},{id:'p'+(12+i%12)}]}));
test('quiz rounds have ten distinct photos, one tagged answer, and three untagged answers of the same gender and close age',()=>{
  for(let n=0;n<50;n++){
    const questions=makeQuiz(photos,{...roster,yona:{id:'yona',name:'יונה',nameEn:'Yona',birthday:'16.10.1921',gender:'f'}});assert.equal(questions.length,10);assert.equal(new Set(questions.map(q=>q.id)).size,10);
    for(const q of questions){const tagged=photos.find(p=>p.id===q.id).tags.map(p=>p.id);assert.equal(q.options.length,4);assert.equal(q.options.filter(p=>tagged.includes(p.id)).length,1);assert.ok(tagged.includes(q.correctId));assert.equal(new Set(q.options.map(p=>p.id)).size,4);assert.ok(!q.options.some(p=>p.id==='yona'));assert.equal(new Set(q.options.map(p=>roster[p.id].gender)).size,1);const ages=q.options.map(p=>quizAge(roster[p.id]));assert.ok(Math.max(...ages)-Math.min(...ages)<=10);}
  }
});
test('quiz excludes Yona-only photos, unknown ages and genders, mismatched age groups, and insufficient distractors',()=>{
  const p={...roster,yona:{id:'yona',name:'Yona',birthday:'16.10.1921',gender:'f'},unknown:{id:'unknown',name:'Unknown',birthday:'1.1.1111',gender:'m'},child:{id:'child',name:'Child',birthday:'1.1.2020',gender:'m'}};
  assert.deepEqual(makeQuiz([{id:'y',kind:'photo',tags:['yona']},{id:'u',kind:'photo',tags:['unknown']},{id:'c',kind:'photo',tags:['child']}],p),[]);
  assert.deepEqual(makeQuiz(photos,Object.fromEntries(Object.entries(roster).slice(0,3))),[]);
  const questions=makeQuiz([...photos,photos[0]],roster,20);assert.equal(questions.length,15);
});
test('game endpoint supplies ten valid questions without exposing album metadata or changing tags',async()=>{
  const f=fixture();try{
    const insert=f.database.prepare('INSERT INTO media(id,category,data) VALUES(?,?,?)'),tag=f.database.prepare('INSERT INTO media_tags(media_id,person_id) VALUES(?,?)');
    // User-entered birthdays live in the database and must override the seed's unknown dates.
    for(const row of f.database.prepare('SELECT id,data FROM people').all())if(family.people[row.id]?.gender==='m'&&row.id!=='shlomo'){
      const person=JSON.parse(row.data);person.birthday='1.1.1985';f.database.prepare('UPDATE people SET data=? WHERE id=?').run(JSON.stringify(person),row.id);
    }
    const eligible=family.people.eldad;
    for(let i=0;i<12;i++){const id=i.toString(16).padStart(32,'0');insert.run(id,'gallery',JSON.stringify({id,kind:'photo',mime:'image/jpeg',caption:'Answer must not leak here'}));tag.run(id,eligible.id);}
    let result=await(await f.call('/api/games/who-is-it')).json();assert.equal(result.questions.length,10);assert.ok(!JSON.stringify(result).includes('Answer must not leak'));assert.equal(f.database.prepare('SELECT count(*) n FROM media_tags').get().n,12);
    f.database.prepare('DELETE FROM media_tags WHERE media_id IN (SELECT id FROM media LIMIT 7)').run();result=await(await f.call('/api/games/who-is-it')).json();assert.deepEqual(result.questions,[]);assert.ok(result.available<10);
  }finally{f.close();}
});
test('three feedback levels cover every score from zero to ten',()=>{
  for(let n=0;n<=10;n++){const g=quizGrade(n);assert.equal(g.score,n*10);assert.equal(g.level,n>=8?'expert':n>=4?'familiar':'reunion');}
});
test('the relationship game API reuses saved portraits and never changes people or media',async()=>{
  const f=fixture();try{
    let i=100;for(const person of Object.values(family.people)){const id=(i++).toString(16).padStart(32,'0');f.database.prepare('INSERT INTO media(id,category,person_id,data) VALUES(?,?,?,?)').run(id,'personal',person.id,JSON.stringify({id,category:'personal',personId:person.id,kind:'photo',mime:'image/jpeg',file:'gallery/'+id+'.jpg'}));}
    const before=f.database.prepare('SELECT id,data FROM people ORDER BY id').all(),media=f.database.prepare('SELECT count(*) n FROM media').get().n;
    const response=await f.call('/api/games/relationships');assert.equal(response.status,200);const data=await response.json();assert.equal(data.questions.length,10);assert.ok(data.available>1000);
    for(const q of data.questions){assert.match(q.subject.profile,/^\/media\/[a-f0-9]{32}$/);assert.match(q.reference.profile,/^\/media\/[a-f0-9]{32}$/);assert.ok(q.options.some(o=>o.id===q.correctId));}
    assert.deepEqual(f.database.prepare('SELECT id,data FROM people ORDER BY id').all(),before);assert.equal(f.database.prepare('SELECT count(*) n FROM media').get().n,media);
  }finally{f.close();}
});
test('missing-person API uses only gallery photos with more than four tags and returns one absent choice',async()=>{
  const f=fixture();try{
    const insert=f.database.prepare('INSERT INTO media(id,category,data) VALUES(?,?,?)'),tag=f.database.prepare('INSERT INTO media_tags(media_id,person_id) VALUES(?,?)'),tagged=['eldad','bosmat','naama','rivi','amit'];
    for(let i=0;i<14;i++){const id=(i+200).toString(16).padStart(32,'0'),kind=i===13?'video':'photo';insert.run(id,i===12?'personal':'gallery',JSON.stringify({id,kind,mime:kind==='photo'?'image/jpeg':'video/mp4',caption:'Answer must not leak'}));for(const personId of tagged.slice(0,i===11?4:5))tag.run(id,personId);}
    const before=f.database.prepare('SELECT * FROM media_tags ORDER BY media_id,person_id').all(),response=await f.call('/api/games/who-is-missing');assert.equal(response.status,200);const result=await response.json();assert.equal(result.questions.length,10);assert.ok(!JSON.stringify(result).includes('Answer must not leak'));
    for(const q of result.questions){assert.ok(Number.parseInt(q.id,16)<211);assert.equal(q.options.filter(o=>tagged.includes(o.id)).length,3);assert.ok(!tagged.includes(q.correctId));assert.ok(!q.options.some(o=>o.id==='yona'));}
    assert.deepEqual(f.database.prepare('SELECT * FROM media_tags ORDER BY media_id,person_id').all(),before);
    f.database.prepare('DELETE FROM media_tags WHERE media_id=?').run((200).toString(16).padStart(32,'0'));f.database.prepare('DELETE FROM media_tags WHERE media_id=?').run((201).toString(16).padStart(32,'0'));
    const insufficient=await(await f.call('/api/games/who-is-missing')).json();assert.equal(insufficient.questions.length,9);assert.equal(insufficient.required,1);assert.equal(insufficient.available,9);
  }finally{f.close();}
});
test('trivia API uses current saved profile facts and leaves people and tags unchanged',async()=>{
  const f=fixture();try{
    for(const row of f.database.prepare('SELECT id,data FROM people').all()){
      const person=JSON.parse(row.data);person.birthday='9.11.1985';person.about='PRIVATE BIOGRAPHY';if(person.aliyahYear)person.aliyahYear=2001;f.database.prepare('UPDATE people SET data=? WHERE id=?').run(JSON.stringify(person),row.id);
    }
    const before=f.database.prepare('SELECT id,data FROM people ORDER BY id').all(),response=await f.call('/api/games/trivia');assert.equal(response.status,200);const result=await response.json();assert.equal(result.questions.length,10);assert.ok(result.available>=10);assert.ok(!JSON.stringify(result).includes('PRIVATE BIOGRAPHY'));
    for(const q of result.questions){const answer=q.options.find(o=>o.id===q.correctId);assert.equal(q.options.length,4);if(q.topic==='birth-year')assert.equal(answer.name,'1985');else if(q.topic==='birth-month')assert.equal(answer.name,'נובמבר');else if(q.topic==='aliyah-year')assert.equal(answer.name,'2001');else assert.fail('Birth order must not be guessed for same-date siblings');}
    assert.deepEqual(f.database.prepare('SELECT id,data FROM people ORDER BY id').all(),before);assert.equal(f.database.prepare('SELECT count(*) n FROM media_tags').get().n,0);
  }finally{f.close();}
});
