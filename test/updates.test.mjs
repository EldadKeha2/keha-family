import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import worker,{FamilyState,FamilyUpdates,PUBLIC_WRITE_TOKEN} from '../src/worker.mjs';
import {eventsForDay,eventEmail,preferences,localDay,HEAD_REQUEST_RECIPIENT} from '../src/updates.mjs';
import family from '../src/family.mjs';

function fixture(provider='resend'){
  const previousNow=Date.now;let now=Date.parse('2026-11-04T03:10:00Z');Date.now=()=>now;
  const databases=[];
  function context(){const db=new DatabaseSync(':memory:');databases.push(db);const storage={sql:{exec(q,...args){const s=db.prepare(q),rows=s.columns().length?s.all(...args):(s.run(...args),[]);return {toArray:()=>rows};}},transactionSync(fn){db.exec('BEGIN');try{const v=fn();db.exec('COMMIT');return v;}catch(e){db.exec('ROLLBACK');throw e;}}};return {storage};}
  const env={UPDATES_ENABLED:'true',UPDATES_SECRET:'test-only-random-secret-of-at-least-thirty-two-characters',RESEND_API_KEY:'test-only-no-real-network',EMAIL_FROM:'family@example.com',SITE_ORIGIN:'https://family.example'};
  if(provider==='brevo'){env.EMAIL_PROVIDER='brevo';env.BREVO_API_KEY='test-brevo-key';delete env.RESEND_API_KEY;}
  const familyCtx=context(),updatesCtx=context(),state=new FamilyState(familyCtx,env),updates=new FamilyUpdates(updatesCtx,env);
  env.FAMILY_STATE={idFromName:n=>n,get:()=>state};env.FAMILY_UPDATES={idFromName:n=>n,get:()=>updates};env.ASSETS={fetch:async()=>new Response('site')};
  const messages=[],previous=globalThis.fetch;let sendFail=false;
  globalThis.fetch=async(url,options)=>{assert.equal(url,provider==='brevo'?'https://api.brevo.com/v3/smtp/email':'https://api.resend.com/emails');if(provider==='brevo')assert.equal(options.headers['api-key'],env.BREVO_API_KEY);else assert.equal(options.headers.Authorization,'Bearer '+env.RESEND_API_KEY);messages.push({body:JSON.parse(options.body),key:options.headers['Idempotency-Key']});return Response.json(sendFail?{error:'provider failed'}:{id:'test-message'},{status:sendFail||200});};
  async function call(path,body,headers={}){return worker.fetch(new Request('https://family.example'+path,{method:body===undefined?'GET':'POST',headers:{'X-Family-Token':PUBLIC_WRITE_TOKEN,Origin:'https://family.example','Content-Type':'application/json','CF-Connecting-IP':'192.0.2.1',...headers},body:body===undefined?undefined:JSON.stringify(body)}),env,{waitUntil(){}});}
  const all=()=>({birthdays:{enabled:true,ids:null},anniversaries:{enabled:true,ids:null},memorials:{enabled:true,ids:null}});
  async function register(email='visitor@example.net',prefs=all()){const r=await call('/api/updates/register',{email,preferences:prefs,language:'he',consent:true});assert.equal(r.status,200,await r.clone().text());return (messages.at(-1).body.text||messages.at(-1).body.textContent).match(/#updates\/confirm\/([a-f0-9]{64})/)[1];}
  async function confirm(email){const confirmToken=await register(email);const r=await call('/api/updates/confirm',{token:confirmToken});assert.equal(r.status,200);return {confirmToken,...await r.json()};}
  return {env,state,updates,call,messages,all,register,confirm,db:updatesCtx.storage.sql,advance(ms=60001){now+=ms;},fail(value){sendFail=value===true?503:value||0;},close(){Date.now=previousNow;globalThis.fetch=previous;databases.forEach(db=>db.close());}};
}

test('updates fail closed until sender setup and never pretend an email was sent',async()=>{
 const f=fixture();try{delete f.env.RESEND_API_KEY;assert.equal((await (await f.call('/api/updates/config')).json()).enabled,false);assert.equal((await f.call('/api/updates/register',{email:'a@example.com'})).status,503);assert.equal(f.messages.length,0);assert.equal(f.db.exec('SELECT count(*) AS n FROM subscribers').toArray()[0].n,0);const preview=await f.call('/api/updates/preview?type=memorials&lang=en-GB');assert.equal(preview.status,200);assert.match(await preview.text(),/In loving memory/);}finally{f.close();}
});
test('double opt-in encrypts addresses, stores only hashed tokens, and excludes subscribers from public exports',async()=>{
 const f=fixture();try{
  const confirmation=await f.register(),pending=f.db.exec('SELECT * FROM subscribers').toArray()[0];assert.equal(pending.status,'pending');assert.ok(!JSON.stringify(pending).includes('visitor@example.net'));assert.ok(!JSON.stringify(pending).includes(confirmation));
  assert.equal((await f.call('/api/updates/preferences',{token:confirmation})).status,404);
  const r=await f.call('/api/updates/confirm',{token:confirmation}),data=await r.json();assert.equal(r.status,200);assert.equal((await f.call('/api/updates/confirm',{token:confirmation})).status,404);
  assert.equal((await f.call('/api/updates/preferences',{token:data.token})).status,200);assert.equal((await f.call('/api/updates/preferences',{token:'0'.repeat(64)})).status,404);
  for(const path of ['/api/export','/api/media','/api/tag-people','/family-data.js']){const body=await (await f.call(path)).text();assert.ok(!body.includes('visitor@example.net'));assert.ok(!body.includes(data.token));assert.ok(!body.includes('subscribers'));}
  assert.equal(f.messages[0].body.from,'Keha Family <family@example.com>');assert.equal(f.messages[0].body.to.length,1);
 }finally{f.close();}
});
test('re-registering a normalized active address sends management without replacing its preferences or private link',async()=>{
 const f=fixture();try{
  const active=await f.confirm(),prefs=f.all(),original=f.db.exec('SELECT * FROM subscribers').toArray()[0];prefs.birthdays.ids=['yehiel'];
  f.advance();
  const duplicate=await f.call('/api/updates/register',{email:'  Visitor@EXAMPLE.NET  ',preferences:prefs,language:'en-US',consent:true});
  assert.equal(duplicate.status,200);assert.deepEqual(await duplicate.json(),{saved:true,pending:true});
  const mail=f.messages.at(-1).body;assert.match(mail.text,new RegExp('#updates/manage/'+active.token));assert.ok(!mail.text.includes('#updates/confirm/'));
  const rows=f.db.exec('SELECT * FROM subscribers').toArray();assert.equal(rows.length,1);assert.deepEqual(rows[0],original);
  const before=await (await f.call('/api/updates/preferences',{token:active.token})).json();assert.equal(before.preferences.birthdays.ids,null);
  assert.equal(before.email,'visitor@example.net');
  const saved=await f.call('/api/updates/save',{token:active.token,revision:before.revision,preferences:prefs,language:'en-GB'});assert.equal(saved.status,200);
  assert.equal((await f.call('/api/updates/save',{token:active.token,revision:before.revision,preferences:f.all()})).status,409);
  const after=await (await f.call('/api/updates/preferences',{token:active.token})).json();assert.deepEqual(after.preferences.birthdays.ids,['yehiel']);assert.equal(after.language,'en-GB');
  assert.throws(()=>preferences({birthdays:{enabled:true,ids:['not-a-person']}},Object.values(family.people)));
 }finally{f.close();}
});
test('unsubscribing removes the encrypted address, cancels pending confirmations and supports one-click POST',async()=>{
 const f=fixture();try{const confirmToken=await f.register(),legacy=f.db.exec('SELECT * FROM subscribers').toArray()[0],active=await (await f.call('/api/updates/confirm',{token:confirmToken})).json();
  // Simulate a pending duplicate confirmation created before the new registration flow.
  f.db.exec('UPDATE subscribers SET pending=?,confirm_hash=?,confirm_expires=?',legacy.pending,legacy.confirm_hash,legacy.confirm_expires);
  assert.equal((await f.call('/api/updates/one-click?token='+active.token)).status,404);
  assert.equal((await f.call('/api/updates/preferences',{token:active.token})).status,200);
  const request=new Request('https://family.example/api/updates/one-click?token='+active.token,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'List-Unsubscribe=One-Click'});
  assert.equal((await worker.fetch(request,f.env,{})).status,200);assert.equal((await f.call('/api/updates/preferences',{token:active.token})).status,404);assert.equal((await f.call('/api/updates/confirm',{token:confirmToken})).status,404);assert.equal(f.db.exec('SELECT data,pending FROM subscribers').toArray()[0].data,null);assert.equal((await f.call('/api/updates/unsubscribe',{token:active.token})).status,200);
 }finally{f.close();}
});
test('legacy duplicate confirmation preserves later choices and the original active management token',async()=>{
 const f=fixture();try{
  const raw=await f.register(),legacy=f.db.exec('SELECT * FROM subscribers').toArray()[0],active=await (await f.call('/api/updates/confirm',{token:raw})).json(),prefs=f.all();prefs.birthdays.ids=['yehiel'];
  const save=await (await f.call('/api/updates/save',{token:active.token,revision:active.revision,preferences:prefs,language:'en-GB'})).json();
  f.db.exec('UPDATE subscribers SET pending=?,confirm_hash=?,confirm_expires=?',legacy.pending,legacy.confirm_hash,legacy.confirm_expires);
  const response=await f.call('/api/updates/confirm',{token:raw}),confirmed=await response.json();
  assert.equal(response.status,200);assert.equal(confirmed.token,active.token);assert.equal(confirmed.revision,save.revision);assert.deepEqual(confirmed.preferences,prefs);assert.equal(confirmed.language,'en-GB');
  assert.equal(f.db.exec('SELECT pending FROM subscribers').toArray()[0].pending,null);assert.equal((await f.call('/api/updates/confirm',{token:raw})).status,404);
 }finally{f.close();}
});
test('a signup racing with confirmation detects the newly active subscription inside its transaction',async()=>{
 const f=fixture();try{
  const raw=await f.register(),originalEncrypt=f.updates.encrypt.bind(f.updates);let reached,release;
  f.advance();
  const encrypting=new Promise(resolve=>reached=resolve),resume=new Promise(resolve=>release=resolve);
  f.updates.encrypt=async value=>{const encrypted=await originalEncrypt(value);reached();await resume;return encrypted;};
  const duplicate=f.call('/api/updates/register',{email:'visitor@example.net',preferences:f.all(),consent:true});await encrypting;
  const active=await (await f.call('/api/updates/confirm',{token:raw})).json();release();assert.equal((await duplicate).status,200);
  const row=f.db.exec('SELECT * FROM subscribers').toArray()[0];assert.equal(row.status,'active');assert.equal(row.pending,null);assert.equal(row.revision,active.revision);assert.match(f.messages.at(-1).body.text,new RegExp('#updates/manage/'+active.token));
 }finally{f.close();}
});
test('management requests use the same private destination and report sending failures or throttling',async()=>{
 const f=fixture();try{
  const active=await f.confirm();f.advance();f.fail(true);
  assert.equal((await f.call('/api/updates/request-link',{email:'visitor@example.net'})).status,503);
  assert.equal((await f.call('/api/updates/request-link',{email:'visitor@example.net'})).status,429);
  f.fail(false);f.db.exec('DELETE FROM rate_limits');
  assert.deepEqual(await (await f.call('/api/updates/request-link',{email:'nobody@example.net'})).json(),{saved:true});
  const before=f.messages.length;assert.deepEqual(await (await f.call('/api/updates/request-link',{email:'visitor@example.net'})).json(),{saved:true});assert.equal(f.messages.length,before+1);
  const mail=f.messages.at(-1).body;assert.match(mail.html,/עדכון העדפות/);assert.match(mail.html,/הסרה מרשימת התפוצה/);assert.ok([...mail.html.matchAll(/href="([^"]+)"/g)].every(match=>match[1].endsWith('#updates/manage/'+active.token)));
 }finally{f.close();}
});
test('rapid requests return a local retry time and permitted management resends actually send new emails',async()=>{
 const f=fixture();try{
  const active=await f.confirm(),before=f.db.exec('SELECT * FROM rate_limits ORDER BY id').toArray();
  const blocked=await f.call('/api/updates/request-link',{email:'visitor@example.net'}),body=await blocked.json();
  assert.equal(blocked.status,429);assert.equal(body.code,'UPDATES_RATE_LIMIT');assert.equal(body.retryAfter,60);assert.equal(blocked.headers.get('Retry-After'),'60');assert.equal(blocked.headers.get('X-Family-Service-Error'),'updates');assert.equal(f.messages.length,1);
  assert.deepEqual(f.db.exec('SELECT * FROM rate_limits ORDER BY id').toArray(),before);
  for(let i=0;i<2;i++){f.advance();const sent=await f.call('/api/updates/request-link',{email:'visitor@example.net'});assert.equal(sent.status,200);}
  assert.equal(f.messages.length,3);assert.notEqual(f.messages[1].key,f.messages[2].key);assert.match(f.messages[2].body.text,new RegExp('#updates/manage/'+active.token));
 }finally{f.close();}
});
test('hourly and daily email limits remain enforced after allowing short-interval testing',async()=>{
 const f=fixture();try{
  await f.confirm();for(let i=0;i<7;i++){f.advance();assert.equal((await f.call('/api/updates/request-link',{email:'visitor@example.net'})).status,200);}
  f.advance();const blocked=await f.call('/api/updates/request-link',{email:'visitor@example.net'});assert.equal(blocked.status,429);assert.ok((await blocked.json()).retryAfter>60);assert.equal(f.messages.length,8);
  f.db.exec('DELETE FROM rate_limits');f.env.EMAIL_DAILY_LIMIT='1';f.advance();assert.equal((await f.call('/api/updates/request-link',{email:'visitor@example.net'})).status,200);
  f.advance();const daily=await f.call('/api/updates/request-link',{email:'visitor@example.net'});assert.equal(daily.status,503);assert.equal((await daily.json()).code,'UPDATES_MAIL_DAILY_LIMIT');assert.equal(daily.headers.get('X-Family-Service-Error'),'updates');
 }finally{f.close();}
});
test('provider failures are scoped to email while a real storage quota still signals site unavailability',async()=>{
 for(const status of [401,403,429,503]){
  const f=fixture('brevo');try{
   f.fail(status);const response=await f.call('/api/updates/register',{email:'visitor@example.net',preferences:f.all(),consent:true}),body=await response.json();
   assert.equal(response.status,503);assert.equal(response.headers.get('X-Family-Service-Error'),'updates');assert.equal(body.code,status===401||status===403?'UPDATES_MAIL_AUTH':status===429?'UPDATES_MAIL_PROVIDER_LIMIT':'UPDATES_MAIL_FAILED');assert.ok(!JSON.stringify(body).includes(f.env.BREVO_API_KEY));
  }finally{f.close();}
 }
 const f=fixture();try{
  f.db.exec=()=>{throw Error('SQLite daily read quota exceeded');};const response=await f.call('/api/updates/request-link',{email:'visitor@example.net'});
  assert.equal(response.status,503);assert.equal((await response.json()).code,'DAILY_STORAGE_LIMIT');assert.equal(response.headers.get('X-Family-Storage-Limit'),'daily');assert.equal(response.headers.get('X-Family-Service-Error'),null);
 }finally{f.close();}
});
test('resubscribing after removal requires a fresh confirmation and leaves old removal links harmless',async()=>{
 const f=fixture();try{
  const old=await f.confirm();await f.call('/api/updates/unsubscribe',{token:old.token});f.db.exec('DELETE FROM rate_limits');
  const raw=await f.register();assert.equal(f.db.exec('SELECT count(*) AS n FROM subscribers').toArray()[0].n,1);assert.equal(f.db.exec('SELECT status FROM subscribers').toArray()[0].status,'pending');
  const active=await (await f.call('/api/updates/confirm',{token:raw})).json();assert.notEqual(active.token,old.token);
  assert.equal((await f.call('/api/updates/unsubscribe',{token:old.token})).status,200);assert.equal((await f.call('/api/updates/preferences',{token:active.token})).status,200);
 }finally{f.close();}
});
test('confirmation expiry, consent, source checking, rate limits and provider failures are enforced',async()=>{
 const f=fixture();try{
  assert.equal((await f.call('/api/updates/register',{email:'a@example.com',preferences:f.all(),consent:false})).status,400);
  assert.equal((await f.call('/api/updates/register',{email:'a@example.com',preferences:f.all(),consent:true},{Origin:'https://evil.example'})).status,403);
  const token=await f.register();f.db.exec('UPDATE subscribers SET confirm_expires=1');assert.equal((await f.call('/api/updates/confirm',{token})).status,404);
  f.fail(true);assert.equal((await f.call('/api/updates/register',{email:'b@example.com',preferences:f.all(),consent:true})).status,503);
  f.fail(false);for(let i=0;i<8;i++)await f.call('/api/updates/register',{email:'c@example.com',preferences:f.all(),consent:true});assert.ok(f.messages.length<=4);
 }finally{f.close();}
});
test('daily mail uses current dates, selected people, one delivery per day and stops after removal',async()=>{
 const f=fixture();try{
  const active=await f.confirm(),p=f.state.person('yehiel');f.state.run('birthday',{id:p.id,birthday:'3.11.1970',expectedBirthday:p.birthday});
  const dates=f.state.run('dates',{}),dispatch=()=>f.updates.dispatch({...dates,now:Date.parse('2026-11-03T07:00:00Z')});
  await f.updates.dispatch({...dates,now:Date.parse('2026-11-03T06:00:00Z')});assert.equal(f.messages.length,1);
  await dispatch();assert.equal(f.messages.length,2);assert.match(f.messages[1].body.html,/יחיאל קהא/);assert.match(f.messages[1].body.html,/🎂/);assert.ok(f.messages[1].body.headers['List-Unsubscribe']);
  const eventMail=f.messages[1].body,links=[...eventMail.html.matchAll(/href="([^"]+)"/g)].map(match=>match[1]);assert.equal(links.length,2);assert.equal(links[0],links[1]);assert.ok(links[0].endsWith('#updates/manage/'+active.token));assert.equal((eventMail.text.match(new RegExp('#updates/manage/'+active.token,'g'))||[]).length,2);
  await dispatch();assert.equal(f.messages.length,2);
  await f.call('/api/updates/unsubscribe',{token:active.token});await f.updates.dispatch({...dates,now:Date.parse('2027-11-03T07:00:00Z')});assert.equal(f.messages.length,2);
 }finally{f.close();}
});
test('a failed daily send is retried with exactly the same payload and idempotency key',async()=>{
 const f=fixture();try{
  await f.confirm();const dates=f.state.run('dates',{});dates.people.find(p=>p.id==='yehiel').birthday='3.11.1970';const p={...dates,now:Date.parse('2026-11-03T07:00:00Z')};f.fail(true);await f.updates.dispatch(p);f.fail(false);dates.people.find(p=>p.id==='yehiel').name='Later name';await f.updates.dispatch(p);
  assert.equal(f.messages[1].key,f.messages[2].key);assert.deepEqual(f.messages[1].body,f.messages[2].body);
 }finally{f.close();}
});
test('recurrences handle leap days, memorials, unknown dates, full names and language safely',()=>{
 const people=[{id:'a',name:'<script>alert(1)</script>',nameEn:'Alice',birthday:'29.2.2000'},{id:'b',name:'זיכרון',nameEn:'Memory',deceased:true,birthday:'28.2.1960',deathDate:'28.2.2020'}];
 const events=eventsForDay('2026-02-28',people,[]);assert.deepEqual(events.map(e=>e.type),['birthdays','memorials']);assert.equal(events[0].years,26);
 const html=eventEmail('he',events,'https://example.com','https://example.com').html;assert.match(html,/&lt;script&gt;/);assert.ok(!html.includes('<script>'));assert.match(html,/🕯/);assert.match(eventEmail('en-GB',events,'#','#').html,/Alice/);
 assert.equal(localDay(new Date('2026-11-03T00:00:00Z')).hour,2);
});

test('Brevo supports the free-plan sender transport while retaining the same private opt-in flow',async()=>{
 const f=fixture('brevo');try{const active=await f.confirm();const mail=f.messages[0].body;assert.equal(mail.sender.name,'Keha Family');assert.equal(mail.sender.email,'family@example.com');assert.deepEqual(mail.to,[{email:'visitor@example.net'}]);assert.match(mail.headers.idempotencyKey,/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-a[a-f0-9]{3}-[a-f0-9]{12}$/);assert.equal((await f.call('/api/updates/preferences',{token:active.token})).status,200);}finally{f.close();}
});

test('head requests require a valid name and cannot change the fixed recipient or subscription state',async()=>{
  const f=fixture('brevo'),path='/api/games/jachnun/head-request',requestId='1'.repeat(32);
  try{
    for(const name of ['', '1', 'A', null, 'A\nB', 'a'.repeat(101)]){const r=await f.call(path,{name,requestId});assert.equal(r.status,400,await r.clone().text());}
    assert.equal(f.messages.length,0);assert.equal((await f.call(path)).status,405);
    const result=await f.call(path,{name:'  אלדד   קהא  ',language:'he',requestId,to:'attacker@example.com'});assert.equal(result.status,200,await result.clone().text());assert.deepEqual(await result.json(),{sent:true});
    const message=f.messages[0].body;assert.equal(message.to[0].email,HEAD_REQUEST_RECIPIENT);assert.equal(message.to[0].email,'eldadkeha@gmail.com');assert.match(message.subject,/תפוס תג׳חנון/);assert.match(message.textContent,/אלדד קהא/);assert.equal(f.db.exec('SELECT count(*) AS n FROM subscribers').toArray()[0].n,0);
    assert.equal((await f.call(path,{name:'אלדד קהא',requestId})).status,200);assert.equal(f.messages.length,1);
    assert.equal((await f.call(path,{name:'אלדד קהא',requestId:'2'.repeat(32)})).status,200);assert.equal(f.messages.length,2);
  }finally{f.close();}
});
test('head requests retain origin and token protection and safely escape the submitted name',async()=>{
  const f=fixture(),path='/api/games/jachnun/head-request',body={name:'<b>Dan</b>',language:'en-US',requestId:'3'.repeat(32)};
  try{
    assert.equal((await f.call(path,body,{Origin:'https://other.example'})).status,403);
    assert.equal((await f.call(path,body,{'X-Family-Token':'wrong'})).status,403);
    assert.equal(f.messages.length,0);const r=await f.call(path,body);assert.equal(r.status,200);
    const message=f.messages[0].body;assert.deepEqual(message.to,['eldadkeha@gmail.com']);assert.match(message.subject,/Catch the Jachnun/);assert.match(message.html,/&lt;b&gt;Dan&lt;\/b&gt;/);assert.doesNotMatch(message.html,/<b>Dan<\/b>/);assert.match(message.text,/<b>Dan<\/b>/);
  }finally{f.close();}
});
test('head requests enforce small rate limits and never report a failed provider send as success',async()=>{
  const f=fixture('brevo'),path='/api/games/jachnun/head-request';
  try{
    f.fail(true);const body={name:'Test Person',language:'en-GB',requestId:'4'.repeat(32)},failed=await f.call(path,body);assert.equal(failed.status,503);assert.notEqual((await failed.json()).sent,true);
    const key=f.messages[0].body.headers.idempotencyKey;f.fail(false);assert.equal((await f.call(path,body)).status,200);assert.equal(f.messages[1].body.headers.idempotencyKey,key);assert.equal((await f.call(path,body)).status,200);assert.equal(f.messages.length,2);
    for(let n=1;n<=11;n++)assert.equal((await f.call(path,{name:'Another Person '+n,requestId:(n+10).toString(16).padStart(32,'0')})).status,200);
    assert.equal((await f.call(path,{name:'Over Limit',requestId:'7'.repeat(32)})).status,429);assert.equal(f.messages.length,13);
    delete f.env.BREVO_API_KEY;const unconfigured=await f.call(path,{name:'Fifth Name',requestId:'8'.repeat(32)});assert.equal(unconfigured.status,503);assert.notEqual((await unconfigured.json()).sent,true);
  }finally{f.close();}
});


test('year-only weddings never create an anniversary reminder on any day of the year',()=>{
  const people=[{id:'yehiel',name:'First',deceased:false},{id:'rachel-katan',name:'Second',deceased:false}],weddings=[{id:'u-yehiel',date:'1938'}];
  for(let day=0;day<366;day++){
    const date=new Date(Date.UTC(2024,0,1+day)).toISOString().slice(0,10);
    assert.deepEqual(eventsForDay(date,people,weddings),[]);
  }
  assert.equal(eventsForDay('2024-01-01',people,[{id:'u-yehiel',date:'1.1.1938'}])[0].type,'anniversaries');
});
