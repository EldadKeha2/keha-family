import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {FamilyState} from '../src/state.mjs';
import {photoLabelFromName} from '../public/assets/photo-labels-catalog.mjs';
import {uid} from '../src/http.mjs';

function fixture(){
  const database=new DatabaseSync(':memory:');
  const sql={exec(query,...args){const statement=database.prepare(query),rows=statement.columns().length?statement.all(...args):(statement.run(...args),[]);return {toArray:()=>rows};}};
  const storage={sql,transactionSync(callback){database.exec('BEGIN');try{const result=callback();database.exec('COMMIT');return result;}catch(error){database.exec('ROLLBACK');throw error;}}};
  let state=new FamilyState({storage},{});
  return {database,get state(){return state;},run(action,p={}){return storage.transactionSync(()=>state.run(action,p));},restart(){state=new FamilyState({storage},{});},add(extra={}){const id=uid(),item={id,category:'gallery',filename:'family.jpg',name:'Family photo',file:id+'.jpg',key:'photos/'+id+'.jpg',mime:'image/jpeg',kind:'photo',size:1000,caption:'',createdAt:new Date().toISOString(),...extra};database.prepare('INSERT INTO media(id,category,person_id,data) VALUES(?,?,?,?)').run(id,item.category,item.personId||null,JSON.stringify(item));return item;},close(){database.close();}};
}
test('AI album requires black-and-white sources across albums; vintage labels and dates alone never qualify',()=>{
  const f=fixture();try{
    const mono=f.add({labels:['black-and-white']}),vintage=f.add({category:'personal',personId:'yona',labels:['black-and-white',photoLabelFromName("וינטג'")]}),english=f.add({labels:[photoLabelFromName('ViNtAgE')]}),old=f.add({category:'photos',labels:['black-and-white'],takenDate:{year:1969}});
    const colorVintage=f.add({labels:[photoLabelFromName("וינטג'")]}),colorOld=f.add({takenDate:{year:1940}});
    f.add({takenDate:{year:1970}});f.add({takenDate:{year:1111}});f.add({kind:'video',mime:'video/mp4',labels:['black-and-white']});f.add({category:'attachment',kind:'document',mime:'application/pdf',labels:['black-and-white']});f.add({labels:[photoLabelFromName('unrelated')]});
    const list=f.run('family-ai.list');assert.equal(list.count,3);assert.deepEqual(new Set(list.items.map(item=>item.id)),new Set([mono.id,vintage.id,old.id]));assert.equal(list.items.find(item=>item.id===vintage.id).scope,'personal:yona');assert.match(list.items[0].src,/^\/media\//);assert.equal('key' in list.items[0],false);
    assert.equal(f.run('family-ai.list',{filter:'black-and-white'}).count,3);assert.equal(f.run('family-ai.list',{filter:'vintage'}).count,2);
    for(const photo of [english,colorVintage,colorOld])assert.throws(()=>f.run('family-ai.job.claim',{id:photo.id,revision:'original',claimId:uid()}),e=>e.code==='AI_PHOTO_UNAVAILABLE');
    assert.equal(f.run('family-ai.list',{query:'%'}).count,0);assert.throws(()=>f.run('family-ai.list',{size:999}),e=>e.status===400);
    for(let n=0;n<15;n++)f.add({labels:['black-and-white']});const first=f.run('family-ai.list',{size:12}),second=f.run('family-ai.list',{size:12,page:2});assert.equal(first.items.length,12);assert.equal(second.items.length,6);assert.equal(new Set([...first.items,...second.items].map(item=>item.id)).size,18);
  }finally{f.close();}
});
test('removing an AI album photo is durable and reversible without changing original gallery data',()=>{
  const f=fixture();try{
    const photo=f.add({labels:['black-and-white']}),original=f.database.prepare('SELECT data FROM media WHERE id=?').get(photo.id).data;
    let result=f.run('family-ai.exclude',{id:photo.id,excluded:true});assert.equal(result.excluded,true);assert.equal(result.item.aiExcluded,true);assert.equal(f.run('family-ai.list').count,0);assert.equal(f.run('family-ai.list').excludedCount,1);assert.equal(f.run('family-ai.list',{excluded:true}).items[0].id,photo.id);
    f.restart();assert.equal(f.run('family-ai.list').count,0);assert.equal(f.database.prepare('SELECT data FROM media WHERE id=?').get(photo.id).data,original);
    result=f.run('family-ai.exclude',{id:photo.id,excluded:false});assert.equal(result.item.aiExcluded,false);assert.equal(f.run('family-ai.list').count,1);assert.equal(f.run('family-ai.list',{excluded:true}).count,0);
  }finally{f.close();}
});
test('durable generation claims avoid duplicate charges, enforce daily quota, and require explicit failed retries',()=>{
  const f=fixture();try{
    const photo=f.add({labels:['black-and-white']}),claimId=uid(),claim={id:photo.id,claimId,revision:'original',dailyLimit:2};
    let result=f.run('family-ai.job.claim',claim);assert.equal(result.claimed,true);assert.equal(result.job.status,'SUBMITTING');assert.equal(f.run('family-ai.job.claim',{...claim,claimId:uid()}).claimed,false);
    f.run('family-ai.job.update',{id:photo.id,claimId,patch:{status:'FAILED',errorCode:'PROVIDER_FAILED'}});assert.equal(f.run('family-ai.job.claim',{...claim,claimId:uid()}).claimed,false);
    const retryId=uid();result=f.run('family-ai.job.claim',{...claim,claimId:retryId,retry:true});assert.equal(result.claimed,true);
    assert.equal(f.run('family-ai.job.update',{id:photo.id,claimId,patch:{status:'SUCCEEDED'}}).updated,false,'An old request must not overwrite its replacement');
    f.run('family-ai.job.update',{id:photo.id,claimId:retryId,patch:{status:'FAILED'}});assert.throws(()=>f.run('family-ai.job.claim',{...claim,claimId:uid(),retry:true}),e=>e.status===429&&e.code==='AI_DAILY_LIMIT');
    f.restart();assert.equal(f.run('family-ai.job.get',{id:photo.id}).job.claimId,retryId);assert.equal(f.run('export').familyAi.claims.length,2);
  }finally{f.close();}
});
test('poll leases, source revisions and safe output records preserve completed videos',()=>{
  const f=fixture();try{
    const photo=f.add({labels:['black-and-white']}),claimId=uid(),claim={id:photo.id,claimId,revision:'original'};
    f.run('family-ai.job.claim',claim);f.run('family-ai.job.update',{id:photo.id,claimId,patch:{status:'RUNNING',taskId:'provider-task'}});
    assert.equal(f.run('family-ai.job.poll',{id:photo.id,claimId}).poll,true);assert.equal(f.run('family-ai.job.poll',{id:photo.id,claimId}).poll,false);assert.equal(f.run('family-ai.job.pending').jobs.length,1);
    const edited={...photo,photoRevision:uid()};f.database.prepare('UPDATE media SET data=? WHERE id=?').run(JSON.stringify(edited),photo.id);
    assert.equal(f.run('family-ai.job.claim',{...claim,claimId:uid(),revision:edited.photoRevision}).claimed,false,'An in-flight old revision still blocks another charge');
    f.run('family-ai.job.update',{id:photo.id,claimId,patch:{status:'SUCCEEDED',progress:1,video:{key:'family-ai/private.mp4',mime:'video/mp4',size:100,duration:10},outputUrl:'https://temporary.example/private'}});
    const list=f.run('family-ai.list',{filter:'ready'}),job=list.items[0].aiJob;assert.equal(job.videoSrc,'/api/family-ai/video/'+photo.id);assert.equal(job.stale,true);assert.equal('taskId' in job,false);assert.equal('video' in job,false);assert.equal('outputUrl' in job,false);assert.equal(f.run('family-ai.job.pending').jobs.length,0);
    assert.equal(f.run('family-ai.job.update',{id:photo.id,claimId,patch:{status:'FAILED'}}).updated,false,'A late provider error must not discard a saved movie');
    assert.equal(f.run('family-ai.job.claim',{...claim,claimId:uid(),revision:edited.photoRevision}).claimed,true,'A completed older version may be regenerated intentionally');
    assert.throws(()=>f.run('family-ai.job.claim',{...claim,claimId:uid()}),e=>e.code==='AI_PHOTO_CHANGED');
  }finally{f.close();}
});
test('poll leases reject overlapping output saves and stale writes after lease takeover',()=>{
  const f=fixture();try{
    const photo=f.add({labels:['black-and-white']}),claimId=uid();f.run('family-ai.job.claim',{id:photo.id,claimId,revision:'original'});f.run('family-ai.job.update',{id:photo.id,claimId,patch:{taskId:'provider-task',status:'RUNNING'}});
    const first=f.run('family-ai.job.poll',{id:photo.id,claimId});assert.equal(first.poll,true);assert.match(first.pollToken,/^[a-f0-9]{32}$/);assert.ok(first.job.pollLeaseUntil>Date.now()+110000);
    assert.equal(f.run('family-ai.job.poll',{id:photo.id,claimId}).poll,false);
    let record=f.run('family-ai.job.get',{id:photo.id}).job;record.lastPollAt=Date.now()-130000;record.pollLeaseUntil=Date.now()-1;f.database.prepare('UPDATE family_ai_jobs SET data=? WHERE media_id=?').run(JSON.stringify(record),photo.id);
    const second=f.run('family-ai.job.poll',{id:photo.id,claimId});assert.equal(second.poll,true);assert.notEqual(second.pollToken,first.pollToken);
    assert.equal(f.run('family-ai.job.update',{id:photo.id,claimId,pollToken:first.pollToken,patch:{status:'FAILED'},releasePoll:true}).updated,false,'The previous poll cannot write after another poll takes its expired lease');
    assert.equal(f.run('family-ai.job.update',{id:photo.id,claimId,pollToken:second.pollToken,patch:{status:'SAVING'}}).updated,true);
    assert.equal(f.run('family-ai.job.poll',{id:photo.id,claimId}).poll,false,'A download retains the lease while SAVING');
    assert.equal(f.run('family-ai.job.update',{id:photo.id,claimId,pollToken:second.pollToken,patch:{status:'SUCCEEDED',video:{key:'family-ai/video.mp4',mime:'video/mp4',size:10,duration:10}},releasePoll:true}).updated,true);
    assert.equal(f.run('family-ai.job.update',{id:photo.id,claimId,pollToken:second.pollToken,patch:{status:'FAILED'}}).updated,false);
    record=f.run('family-ai.job.get',{id:photo.id}).job;assert.equal(record.status,'SUCCEEDED');assert.equal(record.pollToken,null);assert.equal(record.pollLeaseUntil,0);
  }finally{f.close();}
});

test('nickname searches find Tidhar photos across server-paginated gallery and vintage albums',()=>{
 const f=fixture();try{
  const photo=f.add({labels:['black-and-white']});f.add({labels:['black-and-white']});
  f.database.prepare('INSERT INTO media_tags(media_id,person_id) VALUES(?,?)').run(photo.id,'tidhar');
  for(const query of ['טדי','תדי','טדי פיש','תדי פיש','Tedi','Teddy']){
   assert.deepEqual(f.run('collection',{kind:'gallery',query}).items.map(item=>item.id),[photo.id]);
   assert.deepEqual(f.run('family-ai.list',{query}).items.map(item=>item.id),[photo.id]);
  }
  assert.equal(f.run('collection',{kind:'gallery',query:'טדי%'}).count,0);
 }finally{f.close();}
});
