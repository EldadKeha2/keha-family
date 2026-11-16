import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import worker,{FamilyState} from '../src/worker.mjs';
import {suggestPeople} from '../public/assets/site-search-core.mjs';

function fixture(){
  const database=new DatabaseSync(':memory:');
  const sql={exec(query,...args){const s=database.prepare(query),rows=s.columns().length?s.all(...args):(s.run(...args),[]);return {toArray:()=>rows};}};
  const state=new FamilyState({storage:{sql,transactionSync:callback=>callback()}},{});
  const env={FAMILY_STATE:{idFromName:name=>name,get:()=>state},ASSETS:{fetch:()=>new Response('assets')}};
  const call=async options=>{
    const query=new URLSearchParams(options),response=await worker.fetch(new Request('https://family.example/api/search?'+query),env,{});
    return {status:response.status,data:await response.json()};
  };
  let n=0;
  function media({type='photo',personId,tag='roi',labels=[],year=1998,caption='רגע משפחתי',category,events=[]}={}){
    const id=(++n).toString(16).padStart(32,'0'),item={id,category:category||(personId?'personal':'gallery'),personId:personId||null,kind:type,mime:{photo:'image/jpeg',video:'video/mp4',document:'application/pdf'}[type],file:id+'.jpg',key:'PRIVATE-KEY-'+id,filename:'scan.jpg',name:'רגע משפחתי',caption,labels,takenDate:year?{year}:null,createdAt:'2026-11-01T00:00:00.000Z',nostalgiaEventIds:events};
    database.prepare('INSERT INTO media(id,category,person_id,data) VALUES(?,?,?,?)').run(id,item.category,personId||null,JSON.stringify(item));
    if(tag)database.prepare('INSERT INTO media_tags(media_id,person_id) VALUES(?,?)').run(id,tag);
    state.peopleCache=null;return item;
  }
  return {database,state,call,media,close:()=>database.close()};
}
test('phone suggestions prefer complete names, aliases and core family members',()=>{
  const people=[{id:'friend',name:'רועי חבר',extra:true},{id:'roi',name:'רועי אלחריזי',nameEn:'Roei Elharizi'},{id:'tedi',name:'תדהר פיש',aliases:['תדי','טדי']}];
  assert.equal(suggestPeople(people,'רועי')[0].id,'roi');
  assert.equal(suggestPeople(people,'Roei')[0].id,'roi');
  assert.equal(suggestPeople(people,'טדי')[0].id,'tedi');
  assert.equal(suggestPeople(people,'רועי חבר')[0].id,'friend');
  assert.deepEqual(suggestPeople(people,''),[]);
});
test('the shared people endpoint supplies real profile portraits and alias names on a fresh visit',async()=>{
  const f=fixture();try{
    const picture=f.media();
    const result=await worker.fetch(new Request('https://family.example/api/tag-people'),{FAMILY_STATE:{idFromName:name=>name,get:()=>f.state}},{});
    const people=(await result.json()).people,roi=people.find(p=>p.id==='roi');
    assert.equal(result.status,200);assert.equal(roi.profile,'/media/'+picture.id);assert.equal(roi.profileMediaId,picture.id);assert.equal(roi.branch,'harizi');
    assert.ok(people.find(p=>p.id==='tidhar').aliases.includes('תדי'));
  }finally{f.close();}
});
test('the HTTP search finds tagged and personal content across albums, even without a textual name',async()=>{
  const f=fixture();try{
    const photo=f.media(),video=f.media({type:'video',category:'nostalgia'}),document=f.media({type:'document',tag:null,personId:'roi'}),unrelated=f.media({tag:'tomer'});
    const {status,data}=await f.call({q:'רועי אלחריזי',person:'roi'});
    assert.equal(status,200);assert.equal(data.person.id,'roi');
    for(const id of [photo.id,video.id,document.id])assert.ok(data.items.some(item=>item.id===id),id);
    assert.equal(data.items.some(item=>item.id===unrelated.id),false);
    assert.ok(data.items.some(item=>item.type==='person'&&item.id==='roi'));
    assert.doesNotMatch(JSON.stringify(data),/PRIVATE-KEY/);
    const free=(await f.call({q:'רועי'})).data;assert.ok(free.items.some(item=>item.id===photo.id));
    const english=(await f.call({q:'Roei Elharizi'})).data;assert.ok(english.items.some(item=>item.id===photo.id));
  }finally{f.close();}
});
test('free text, selected people, tags, branch, year and type filters compose before pagination',async()=>{
  const f=fixture();try{
    const target=f.media({labels:['holidays'],caption:'ערב חג בירושלים'});
    f.media({year:2001,labels:['holidays'],caption:'ערב חג בירושלים'});f.media({tag:'tomer',labels:['holidays'],caption:'ערב חג בירושלים'});f.media({type:'video',labels:['holidays'],caption:'ערב חג בירושלים'});
    const {data}=await f.call({q:'ירושלים',person:'roi',type:'photo',branch:'harizi',year:'1998',label:'holidays'});
    assert.deepEqual(data.items.map(item=>item.id),[target.id]);assert.equal(data.count,1);
    assert.equal(data.facets.types.find(item=>item.id==='video').count,1);
    assert.equal(data.facets.years.find(item=>item.id==='2001').count,1);
    const unknown=f.media({year:null,caption:'תאריך לא ידוע'});
    assert.ok((await f.call({q:'תאריך לא ידוע',year:'2026'})).data.items.every(item=>item.id!==unknown.id));
  }finally{f.close();}
});
test('full searches include stories, recordings, wedding references and event metadata without keys',async()=>{
  const f=fixture();try{
    const story={id:'memory-1',title:'סיפור קטן',body:'זיכרון שאינו מזכיר שם',personIds:['roi'],year:2000,author:'משפחה',createdAt:'2026-11-01'};
    f.database.prepare('INSERT INTO stories(id,data) VALUES(?,?)').run(story.id,JSON.stringify(story));
    const voice={id:'voice-1',title:'הקלטה ישנה',body:'קול מהעבר',personIds:['roi'],year:2000,createdAt:'2026-11-01',key:'PRIVATE-KEY-voice'};
    f.database.prepare('INSERT INTO recordings(id,data) VALUES(?,?)').run(voice.id,JSON.stringify(voice));
    const {data}=await f.call({person:'roi'});assert.ok(data.items.some(item=>item.id===story.id&&item.type==='story'));assert.ok(data.items.some(item=>item.id===voice.id&&item.type==='voice'));assert.doesNotMatch(JSON.stringify(data),/PRIVATE-KEY/);
    assert.ok((await f.call({q:'תומר'})).data.items.some(item=>item.type==='wedding'&&item.id==='u-tomer'));
    assert.ok((await f.call({q:'מסיבת השחרור'})).data.items.some(item=>item.type==='event'&&item.href==='#nostalgia/event/ora-release-1988'));
    assert.ok((await f.call({q:'שאינו מזכיר'})).data.items.some(item=>item.id===story.id));
  }finally{f.close();}
});
test('a person search includes textual references and narrows additional keywords',async()=>{
  const f=fixture();try{
    const mention=f.media({tag:null,caption:'רועי אלחריזי בטיול לירושלים'}),tagged=f.media({caption:'טיול בחיפה'});
    assert.ok((await f.call({person:'roi'})).data.items.some(item=>item.id===mention.id));
    assert.ok((await f.call({person:'roi',branch:'harizi'})).data.items.some(item=>item.id===mention.id));
    const {data}=await f.call({person:'roi',q:'ירושלים'});assert.ok(data.items.some(item=>item.id===mention.id));assert.equal(data.items.some(item=>item.id===tagged.id),false);
  }finally{f.close();}
});
test('pagination is stable and unique, facet counts span all pages, and removed metadata stays excluded',async()=>{
  const f=fixture();try{
    for(let n=0;n<31;n++)f.media();
    const removed=f.media();f.database.prepare('DELETE FROM media WHERE id=?').run(removed.id);
    f.database.prepare('INSERT INTO media_trash(id,data,deleted_at) VALUES(?,?,?)').run(removed.id,JSON.stringify(removed),'2026-11-01');
    const first=(await f.call({person:'roi',type:'photo',size:'12'})).data,second=(await f.call({person:'roi',type:'photo',size:'12',page:'2'})).data,third=(await f.call({person:'roi',type:'photo',size:'12',page:'3'})).data;
    assert.equal(first.count,31);assert.equal(first.pages,3);assert.equal(first.facets.types.find(item=>item.id==='photo').count,31);
    const ids=[...first.items,...second.items,...third.items].map(item=>item.id);assert.equal(new Set(ids).size,31);assert.equal(ids.includes(removed.id),false);
  }finally{f.close();}
});
test('search rejects malformed refinements and returns an empty start state for an empty query',async()=>{
  const f=fixture();try{
    for(const options of [{type:'secrets'},{sort:'drop'},{size:'9999'},{page:'-1'},{year:'1111'},{branch:'unknown'},{label:'invalid'}])assert.equal((await f.call({q:'רועי',...options})).status,400);
    assert.equal((await f.call({person:'nonexistent'})).status,404);
    assert.deepEqual((await f.call({})).data.items,[]);
  }finally{f.close();}
});
