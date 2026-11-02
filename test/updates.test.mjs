import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import worker,{FamilyState,FamilyUpdates,PUBLIC_WRITE_TOKEN} from '../src/worker.mjs';
import {eventsForDay,eventEmail,preferences,localDay} from '../src/updates.mjs';
import family from '../src/family.mjs';

function fixture(provider='resend'){
  const databases=[];
  function context(){const db=new DatabaseSync(':memory:');databases.push(db);const storage={sql:{exec(q,...args){const s=db.prepare(q),rows=s.columns().length?s.all(...args):(s.run(...args),[]);return {toArray:()=>rows};}},transactionSync(fn){db.exec('BEGIN');try{const v=fn();db.exec('COMMIT');return v;}catch(e){db.exec('ROLLBACK');throw e;}}};return {storage};}
  const env={UPDATES_ENABLED:'true',UPDATES_SECRET:'test-only-random-secret-of-at-least-thirty-two-characters',RESEND_API_KEY:'test-only-no-real-network',EMAIL_FROM:'family@example.com',SITE_ORIGIN:'https://family.example'};
  if(provider==='brevo'){env.EMAIL_PROVIDER='brevo';env.BREVO_API_KEY='test-brevo-key';delete env.RESEND_API_KEY;}
  const familyCtx=context(),updatesCtx=context(),state=new FamilyState(familyCtx,env),updates=new FamilyUpdates(updatesCtx,env);
  env.FAMILY_STATE={idFromName:n=>n,get:()=>state};env.FAMILY_UPDATES={idFromName:n=>n,get:()=>updates};env.ASSETS={fetch:async()=>new Response('site')};
  const messages=[],previous=globalThis.fetch;let sendFail=false;
  globalThis.fetch=async(url,options)=>{assert.equal(url,provider==='brevo'?'https://api.brevo.com/v3/smtp/email':'https://api.resend.com/emails');if(provider==='brevo')assert.equal(options.headers['api-key'],env.BREVO_API_KEY);else assert.equal(options.headers.Authorization,'Bearer '+env.RESEND_API_KEY);messages.push({body:JSON.parse(options.body),key:options.headers['Idempotency-Key']});return Response.json(sendFail?{error:'provider failed'}:{id:'test-message'},{status:sendFail?503:200});};
  async function call(path,body,headers={}){return worker.fetch(new Request('https://family.example'+path,{method:body===undefined?'GET':'POST',headers:{'X-Family-Token':PUBLIC_WRITE_TOKEN,Origin:'https://family.example','Content-Type':'application/json','CF-Connecting-IP':'192.0.2.1',...headers},body:body===undefined?undefined:JSON.stringify(body)}),env,{waitUntil(){}});}
  const all=()=>({birthdays:{enabled:true,ids:null},anniversaries:{enabled:true,ids:null},memorials:{enabled:true,ids:null}});
  async function register(email='visitor@example.net',prefs=all()){const r=await call('/api/updates/register',{email,preferences:prefs,language:'he',consent:true});assert.equal(r.status,200,await r.clone().text());return (messages.at(-1).body.text||messages.at(-1).body.textContent).match(/#updates\/confirm\/([a-f0-9]{64})/)[1];}
  async function confirm(email){const confirmToken=await register(email);const r=await call('/api/updates/confirm',{token:confirmToken});assert.equal(r.status,200);return {confirmToken,...await r.json()};}
  return {env,state,updates,call,messages,all,register,confirm,db:updatesCtx.storage.sql,fail(value){sendFail=value;},close(){globalThis.fetch=previous;databases.forEach(db=>db.close());}};
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
test('unconfirmed re-registration cannot change active preferences, and management rejects stale edits',async()=>{
 const f=fixture();try{
  const active=await f.confirm(),prefs=f.all();prefs.birthdays.ids=['yehiel'];
  await f.register('visitor@example.net',prefs);
  const before=await (await f.call('/api/updates/preferences',{token:active.token})).json();assert.equal(before.preferences.birthdays.ids,null);
  const saved=await f.call('/api/updates/save',{token:active.token,revision:before.revision,preferences:prefs,language:'en-GB'});assert.equal(saved.status,200);
  assert.equal((await f.call('/api/updates/save',{token:active.token,revision:before.revision,preferences:f.all()})).status,409);
  const after=await (await f.call('/api/updates/preferences',{token:active.token})).json();assert.deepEqual(after.preferences.birthdays.ids,['yehiel']);assert.equal(after.language,'en-GB');
  assert.throws(()=>preferences({birthdays:{enabled:true,ids:['not-a-person']}},Object.values(family.people)));
 }finally{f.close();}
});
test('unsubscribing removes the encrypted address, cancels pending confirmations and supports one-click POST',async()=>{
 const f=fixture();try{const active=await f.confirm();await f.register();const confirmToken=f.messages.at(-1).body.text.match(/#updates\/confirm\/([a-f0-9]{64})/)[1];
  const request=new Request('https://family.example/api/updates/one-click?token='+active.token,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'List-Unsubscribe=One-Click'});
  assert.equal((await worker.fetch(request,f.env,{})).status,200);assert.equal((await f.call('/api/updates/preferences',{token:active.token})).status,404);assert.equal((await f.call('/api/updates/confirm',{token:confirmToken})).status,404);assert.equal(f.db.exec('SELECT data,pending FROM subscribers').toArray()[0].data,null);assert.equal((await f.call('/api/updates/unsubscribe',{token:active.token})).status,200);
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
