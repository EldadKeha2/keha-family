import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {FamilyState} from '../src/state.mjs';
import {nameCorrectionKey} from '../src/name-corrections.mjs';

test('Yona name migration updates live and deleted descriptions once while preserving profiles, dates and storage keys',()=>{
 const database=new DatabaseSync(':memory:');
 const sql={exec(query,...args){const s=database.prepare(query),rows=s.columns().length?s.all(...args):(s.run(...args),[]);return{toArray:()=>rows};}};
 const ctx={storage:{sql,transactionSync(fn){database.exec('BEGIN');try{const result=fn();database.exec('COMMIT');return result;}catch(error){database.exec('ROLLBACK');throw error;}}}};
 try{
  assert.equal(new FamilyState(ctx,{}).initializationError,null);
  const person=JSON.parse(database.prepare('SELECT data FROM people WHERE id=?').get('yona').data);
  const before={...person,name:'יונה נקאש',nameEn:'Yona Nakash',lastName:'נקאש',about:'יונה נקאש עם המשפחה',profileId:'kept-profile',birthday:'16.10.1921'};
  database.prepare('UPDATE people SET data=? WHERE id=?').run(JSON.stringify(before),'yona');
  const item={id:'a'.repeat(32),category:'gallery',kind:'photo',key:'gallery/יונה_נקאש.jpg',file:'יונה_נקאש.jpg',filename:'יונה_נקאש.jpg',caption:'עם יונה נקאש / Yona Nakash',mime:'image/jpeg',size:123,createdAt:'2026-01-01T00:00:00Z'};
  database.prepare('INSERT INTO media(id,category,person_id,data) VALUES(?,?,NULL,?)').run(item.id,'gallery',JSON.stringify(item));
  database.prepare('INSERT INTO media_trash(id,data,deleted_at) VALUES(?,?,?)').run('b'.repeat(32),JSON.stringify({...item,id:'b'.repeat(32)}),item.createdAt);
  database.prepare('DELETE FROM meta WHERE id=?').run(nameCorrectionKey);
  assert.equal(new FamilyState(ctx,{}).initializationError,null);
  const after=JSON.parse(database.prepare('SELECT data FROM people WHERE id=?').get('yona').data);
  assert.equal(after.name,'יונה נקאש קהא');assert.equal(after.nameEn,'Yona Nakash Keha');assert.equal(after.lastName,'נקאש קהא');assert.equal(after.about,'יונה נקאש קהא עם המשפחה');
  for(const field of ['id','birthday','deathDate','profileId'])assert.equal(after[field],before[field]);
  for(const [table,id]of [['media',item.id],['media_trash','b'.repeat(32)]]){
   const row=JSON.parse(database.prepare('SELECT data FROM '+table+' WHERE id=?').get(id).data);
   assert.equal(row.caption,'עם יונה נקאש קהא / Yona Nakash Keha');assert.equal(row.filename,'יונה_נקאש_קהא.jpg');assert.equal(row.key,item.key);assert.equal(row.file,item.file);assert.equal(row.size,123);
  }
  const saved=database.prepare('SELECT data FROM people WHERE id=?').get('yona').data;
  assert.equal(new FamilyState(ctx,{}).initializationError,null);assert.equal(database.prepare('SELECT data FROM people WHERE id=?').get('yona').data,saved);
 }finally{database.close();}
});
