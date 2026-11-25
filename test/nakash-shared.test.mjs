import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile} from 'node:fs/promises';
import worker, {FamilyState, PUBLIC_WRITE_TOKEN} from '../src/worker.mjs';
import {NAKASH_WRITE_TOKEN} from '../src/nakash-shell.mjs';
import {suggestPeople} from '../public/assets/site-search-core.mjs';

const photo=await readFile(new URL('./fixtures/photo.jpg',import.meta.url));
const video=await readFile(new URL('./fixtures/video.mp4',import.meta.url));
function fixture(){
  const database=new DatabaseSync(':memory:');
  const storage={sql:{exec(query,...args){const stmt=database.prepare(query);const rows=stmt.columns().length?stmt.all(...args):(stmt.run(...args),[]);return {toArray:()=>rows};}},
    transactionSync(fn){database.exec('BEGIN');try{const result=fn();database.exec('COMMIT');return result;}catch(error){database.exec('ROLLBACK');throw error;}}};
  const env={HF_NAMESPACE:'fixture',HF_BUCKET:'fixture',HF_ACCESS_KEY_ID:'test',HF_SECRET_ACCESS_KEY:'test'};
  let state=new FamilyState({storage},env);
  env.FAMILY_STATE={idFromName:name=>name,get:()=>state};
  const objects=new Map(),originalFetch=globalThis.fetch;
  globalThis.fetch=async request=>{
    assert.equal(new URL(request.url).hostname,'s3.hf.co');
    const path=new URL(request.url).pathname;
    if(request.method==='PUT'){objects.set(path,new Uint8Array(await request.arrayBuffer()));return new Response(null,{status:200});}
    if(request.method==='DELETE'){objects.delete(path);return new Response(null,{status:204});}
    return new Response(objects.get(path),{status:objects.has(path)?200:404});
  };
  const call=(path,{method='GET',body,headers:extraHeaders={},token=path.startsWith('/nakash/')?NAKASH_WRITE_TOKEN:PUBLIC_WRITE_TOKEN}={})=>{
    const headers={...extraHeaders,...(method==='POST'?{Origin:'https://family.example','X-Family-Token':token}:{})};
    if(body instanceof Uint8Array){headers['Content-Type']=path.includes('.mp4')?'video/mp4':'image/jpeg';headers['Content-Length']=String(body.length);}
    else if(body){headers['Content-Type']='application/json';body=JSON.stringify(body);}
    return worker.fetch(new Request('https://family.example'+path,{method,body,headers}),env,{waitUntil(){}});
  };
  const json=async(path,options)=>{const response=await call(path,options),body=await response.json();assert.ok(response.ok,JSON.stringify({path,status:response.status,...body}));return body;};
  const site=(branch,path)=>'/nakash/api/compat/'+branch+'/api/'+path;
  return {call,json,site,objects,database,state:()=>state,restart(){state=new FamilyState({storage},env);},close(){globalThis.fetch=originalFetch;database.close();}};
}

for (const [id, oldName, oldNameEn, name, nameEn, branch, unit, members] of [
  ['yair-medina-wife', 'אשתו של יאיר', "Yair's wife", 'יעל', 'Yael', 'medina', 'u-nakash-yair', ['yair-medina', 'yair-medina-wife']],
  ['avner-former-wife', 'אמה של מור', "Mor's mother", 'יפה', 'Yafa', 'haim', 'u-nakash-avner', ['avner-nakash', 'rivka-nakash', 'avner-former-wife']],
  ['avrahumi-medina', 'אברהומי מדינה', 'Avrahumi Medina', 'אברהם מדינה', 'Avraham Medina', 'medina', 'u-nakash-avrahumi', ['avrahumi-medina']],
  ['aharon-gueta', 'אהרון גואטה', 'Aharon Gueta', 'אריק גואטה', 'Arik Gueta', 'medina', 'u-nakash-yoni', ['yoni-gueta', 'aharon-gueta']],
  ['hen-pazarkar', 'חן פזרקר', 'Hen Pazarkar', 'בן-חן פזרקר', 'Ben-Chen Pazarkar', 'haim', 'u-nakash-mor', ['mor-pazarkar', 'hen-pazarkar']],
  ['zecharia-nakash', 'זכריה נקאש', 'Zecharia Nakash', 'זכריה (יחיא) נקאש', 'Zecharia (Yihya) Nakash', 'yehuda', 'u-nakash-root', ['margalit-nakash', 'zecharia-nakash']],
  ['ofer-nir', 'עופר ניר', 'Ofer Nir', 'איל ניר', 'Eyal Nir', 'haim', 'u-nakash-ofer', ['ofer-nir']],
  ['yuli-gaz', 'יולי גז', 'Yuli Gaz', 'יהלי גז', 'Yahli Gaz', 'haim', 'u-nakash-yuli-gaz', ['yuli-gaz']],
]) test(nameEn+' replaces the retired name on the same shared profile without losing its details or portrait',async()=>{
  const f=fixture();try{
    f.database.prepare('INSERT INTO people (id,data) VALUES (?,?)').run(id,JSON.stringify({id,name:oldName,nameEn:oldNameEn,firstName:oldName.split(' ')[0],lastName:oldName.split(' ').slice(1).join(' '),placeholder:true,extra:true,birthday:'2.3.1970',about:'פרטים קיימים',profileId:null,revision:'old-placeholder'}));
    f.database.prepare('INSERT INTO meta (id,value) VALUES (?,?)').run('nakash-confirmed-names-2026-11-20-v4','done');
    if (['ofer-nir','yuli-gaz'].includes(id)) f.database.prepare('INSERT INTO meta (id,value) VALUES (?,?)').run('nakash-confirmed-names-2026-11-21-v5','done');
    const uploaded=await f.json('/api/people/'+id+'/photos?filename=portrait.jpg',{method:'POST',body:photo});
    const page=await f.json(f.site(branch,'people/'+id+'/page'));
    assert.equal(page.person.id,id);
    assert.equal(page.person.name,name);
    assert.equal(page.person.nameEn,nameEn);
    if (id==='ofer-nir') assert.equal(page.person.gender,'m');
    if (id==='yuli-gaz') assert.equal(page.person.gender,'f');
    assert.equal(page.person.firstName,name.split(' ')[0]);
    assert.equal(page.person.lastName,name.split(' ').slice(1).join(' '));
    if(id==='zecharia-nakash')for(const query of ['יחיא נקאש','זכריה נקאש','Yihya Nakash'])assert.equal(suggestPeople([page.person],query)[0]?.id,id);
    assert.notEqual(page.person.placeholder,true);
    assert.equal(page.person.birthday,'2.3.1970');
    assert.equal(page.person.about,'פרטים קיימים');
    assert.equal(page.person.profileMediaId,uploaded.person.profileMediaId);
    const script=await (await f.call('/nakash/api/site-data.js')).text();
    const tree=JSON.parse(script.split('\n')[0].slice('window.FAMILY_DATA='.length,-1));
    assert.deepEqual(tree.units[unit].people,members);
    assert.equal(tree.people[id].name,name);
    assert.notEqual(tree.people[id].placeholder,true);
    const saved=JSON.parse(f.database.prepare('SELECT data FROM people WHERE id=?').get(id).data);
    f.database.prepare('UPDATE people SET data=? WHERE id=?').run(JSON.stringify({...saved,name:name+' (עריכה שמורה)'}),id);
    f.restart();
    assert.equal((await f.json(f.site(branch,'people/'+id+'/page'))).person.name,name+' (עריכה שמורה)');
    assert.equal(f.objects.size,1);
  }finally{f.close();}
});

test('Roma keeps her historical ID and shares original photos, biography, birth dates and portraits in both directions',async()=>{
  const f=fixture();try{
    f.database.prepare('INSERT INTO people (id,data) VALUES (?,?)').run('extra-roma',JSON.stringify({id:'extra-roma',name:'רומה מדינה',extra:true,birthday:'1.1.1111',profileId:null,revision:'initial'}));
    const uploaded=await f.json('/api/people/extra-roma/photos?filename=roma.jpg',{method:'POST',body:photo});
    const originalId=uploaded.person.profileMediaId;
    const dataScript=await (await f.call('/nakash/api/site-data.js')).text();
    const tree=JSON.parse(dataScript.split('\n')[0].slice('window.FAMILY_DATA='.length,-1));
    assert.deepEqual(tree.units['u-nakash-medina'].people,['extra-roma','joseph-medina']);
    assert.equal(tree.people['ruma-nakash'],undefined);
    assert.ok(tree.people['extra-roma'].aliases.includes('רומה נקאש'));
    const medina=await f.json(f.site('medina','people/extra-roma/page'));
    assert.equal(medina.albums.photos.total,1);
    assert.equal(medina.person.profileMediaId,originalId);
    assert.equal(medina.person.extra,false);
    const alias=await f.json(f.site('medina','people/ruma-nakash/page'));
    assert.equal(alias.person.id,'extra-roma');
    const response=await f.call(f.site('medina','people/extra-roma/page'));
    assert.equal((await f.call(f.site('medina','people/extra-roma/page'),{headers:{'If-None-Match':response.headers.get('ETag')}})).status,304);
    const saved=await f.json(f.site('medina','people/extra-roma/birthday'),{method:'POST',body:{birthday:'2.3.1920',expectedBirthday:'1.1.1111'}});
    assert.equal(saved.person.birthday,'2.3.1920');
    assert.equal(saved.person.extra,false);
    assert.equal((await f.json('/api/people/extra-roma/page')).person.birthday,'2.3.1920');
    assert.equal((await f.call(f.site('haim','people/extra-roma/birthday'),{method:'POST',body:{birthday:'4.3.1920',expectedBirthday:'1.1.1111'}})).status,409);
    await f.json('/api/people/extra-roma/about',{method:'POST',body:{about:'הסיפור של רומה',expectedAbout:'',language:'he'}});
    assert.equal((await f.json(f.site('medina','people/extra-roma/page'))).person.about,'הסיפור של רומה');
    const second=await f.json(f.site('medina','people/extra-roma/photos?filename=roma-new.jpg'),{method:'POST',body:photo});
    assert.equal(second.albums.photos.total,2);
    await f.json(f.site('medina','people/extra-roma/profile'),{method:'POST',body:{file:second.file}});
    const selected=(await f.json('/api/people/extra-roma/page')).person;
    assert.notEqual(selected.profileMediaId,originalId);
    assert.equal(selected.profileIsManual,true);
    await f.json('/api/people/extra-roma/profile',{method:'POST',body:{file:uploaded.file}});
    assert.equal((await f.json(f.site('medina','people/extra-roma/page'))).person.profileMediaId,originalId);
    assert.equal(f.objects.size,2,'the shared profiles reference the same bytes');
    f.restart();
    assert.equal((await f.json(f.site('medina','people/extra-roma/page'))).albums.photos.total,2);
    assert.equal((await f.json(f.site('medina','people/extra-roma/page'))).person.birthday,'2.3.1920');
  }finally{f.close();}
});

test('Margalit Lulva links an already-created tree profile to her historical album without losing media or the selected portrait',async()=>{
  const f=fixture();try{
    const oldId='margalit-nakash', id='extra-3051638a17004175b329422f';
    for(const person of [
      {id,name:'מרגלית נקאש (לולוה)',extra:true,birthday:'1.1.1111',profileId:null,about:'הפרופיל המקורי',revision:'historical'},
      {id:oldId,name:'מרגלית נקאש',extra:true,birthday:'2.3.1880',about:'פרטים מהעץ',profileId:null,revision:'tree'},
    ]) f.database.prepare('INSERT INTO people (id,data) VALUES (?,?)').run(person.id,JSON.stringify(person));
    const historical=await f.json('/api/people/'+id+'/photos?filename=portrait.jpg',{method:'POST',body:photo});
    await f.json('/api/people/'+id+'/profile',{method:'POST',body:{file:historical.file}});
    const treePhoto=await f.json('/api/people/'+oldId+'/photos?filename=tree.jpg',{method:'POST',body:photo});
    const mediaId=treePhoto.person.profileMediaId,faceId='f'.repeat(32);
    for(const personId of [oldId,id])f.database.prepare('INSERT OR IGNORE INTO media_tags (media_id,person_id) VALUES (?,?)').run(mediaId,personId);
    const face={id:faceId,personId:oldId,rect:{x:.2,y:.2,width:.3,height:.4},revision:'face'};
    f.database.prepare('INSERT INTO media_faces (media_id,id,person_id,data) VALUES (?,?,?,?)').run(mediaId,faceId,oldId,JSON.stringify(face));
    f.database.prepare('INSERT INTO photo_versions (media_id,id,data) VALUES (?,?,?)').run(mediaId,'original',JSON.stringify({id:'original',faces:[face]}));
    f.database.prepare('INSERT INTO stories (id,data) VALUES (?,?)').run('margalit-memory',JSON.stringify({id:'margalit-memory',title:'זיכרון',personIds:[oldId,id]}));
    f.database.prepare('CREATE TABLE nakash_identities (person_id TEXT PRIMARY KEY,canonical_id TEXT NOT NULL)').run();
    f.database.prepare('INSERT INTO nakash_identities (person_id,canonical_id) VALUES (?,?)').run(oldId,oldId);
    const script=await (await f.call('/nakash/api/site-data.js')).text();
    const tree=JSON.parse(script.split('\n')[0].slice('window.FAMILY_DATA='.length,-1));
    assert.deepEqual(tree.units[tree.root].people,[id,'zecharia-nakash']);
    assert.equal(tree.people[oldId],undefined);
    assert.equal(tree.people[id].profileMediaId,historical.person.profileMediaId);
    const page=await f.json('/api/people/'+id+'/page');
    assert.equal(page.albums.photos.total,2);
    assert.equal(page.person.profileIsManual,true);
    assert.equal(page.person.birthday,'2.3.1880');
    assert.equal(page.person.about,'הפרופיל המקורי');
    assert.equal((await f.json('/api/people/'+oldId+'/page')).person.id,id);
    assert.equal((await f.json(f.site('haim','people/'+oldId+'/page'))).person.id,id);
    assert.deepEqual(f.state().tagIds(mediaId),[id]);
    assert.equal(f.state().faces(mediaId)[0].personId,id);
    const saved=JSON.parse(f.database.prepare('SELECT data FROM photo_versions WHERE media_id=?').get(mediaId).data);
    assert.equal(saved.faces[0].personId,id);
    const story=JSON.parse(f.database.prepare('SELECT data FROM stories WHERE id=?').get('margalit-memory').data);
    assert.deepEqual(story.personIds,[id]);
    const roster=await f.json('/api/tag-people');
    assert.equal(roster.people.some(person=>person.id===oldId),false);
    assert.equal(roster.people.filter(person=>person.id===id).length,1);
    const old=JSON.parse(f.database.prepare('SELECT data FROM people WHERE id=?').get(oldId).data);
    assert.equal(old.mergedInto,id);
    assert.equal(old.about,'פרטים מהעץ');
    f.restart();
    assert.equal((await f.json('/api/people/'+oldId+'/page')).person.id,id);
    assert.equal((await f.json(f.site('medina','people/'+id+'/page'))).albums.photos.total,2);
    assert.equal(f.objects.size,2,'linking profiles never copies their photo bytes');
  }finally{f.close();}
});

test('Ora tagged in Yehuda appears in Keha, edits and removals stay shared, and deleted media never reappears on restart',async()=>{
  const f=fixture();try{
    const uploaded=await f.json(f.site('yehuda','collections/gallery/upload?filename=ora.jpg'),{method:'POST',body:photo});
    const id=uploaded.collection.items[0].id;
    assert.equal((await f.json('/api/people/ora/page')).albums.photos.total,0);
    await f.json(f.site('yehuda','media/'+id+'/tags/patch'),{method:'POST',body:{changes:[{personId:'ora',tagged:true}]}});
    const page=await f.json('/api/people/ora/page');
    assert.equal(page.albums.photos.total,1);
    assert.equal(page.albums.photos.items[0].id,id);
    assert.equal(page.person.profileMediaId,id);
    assert.equal((await f.json(f.site('keha','people/ora/page'))).albums.photos.items[0].id,id);
    assert.equal((await f.json('/api/collections/gallery')).count,0,'unrelated main gallery is not filled by branch uploads');
    await f.json('/api/media/'+id+'/caption',{method:'POST',body:{caption:'אורה במשפחה',expectedCaption:''}});
    const gallery=await f.json(f.site('keha','collections/gallery'));
    assert.equal(gallery.items[0].caption,'אורה במשפחה');
    await f.json('/api/media/'+id+'/tags/patch',{method:'POST',body:{changes:[{personId:'ora',tagged:false}]}});
    assert.equal((await f.json(f.site('keha','people/ora/page'))).albums.photos.total,0);
    assert.equal((await f.json(f.site('keha','collections/gallery'))).count,0);
    await f.json(f.site('yehuda','media/'+id+'/delete'),{method:'POST',body:{scope:'nakash:yehuda'}});
    f.restart();
    assert.equal((await f.json(f.site('yehuda','collections/gallery'))).count,0);
    assert.equal((await f.call('/media/'+id)).status,404);
  }finally{f.close();}
});

test('Date validation and write protection apply to the shared birthday editor',async()=>{
  const f=fixture();try{
    await f.json(f.site('haim','people/avner-nakash/page'));
    const path=f.site('haim','people/avner-nakash/birthday');
    assert.equal((await f.call(path,{method:'POST',body:{birthday:'31.2.1980',expectedBirthday:'1.1.1111'}})).status,400);
    assert.equal((await f.call(path,{method:'POST',body:{birthday:'2.3.1980',expectedBirthday:'1.1.1111'},token:''})).status,403);
    await f.json(path,{method:'POST',body:{birthday:'2.3.1980',expectedBirthday:'1.1.1111'}});
    assert.equal((await f.json(f.site('medina','people/avner-nakash/page'))).person.birthday,'2.3.1980');
    await f.json(path,{method:'POST',body:{birthday:'1.1.1111',expectedBirthday:'2.3.1980'}});
    assert.equal((await f.json('/api/people/avner-nakash/page')).person.birthday,'1.1.1111');
  }finally{f.close();}
});

test('Tagged videos share the same original record and bytes across family profiles',async()=>{
  const f=fixture();try{
    const uploaded=await f.json(f.site('yehuda','collections/videos/upload?filename=ora.mp4'),{method:'POST',body:video});
    const id=uploaded.collection.items[0].id;
    await f.json(f.site('yehuda','media/'+id+'/tags/patch'),{method:'POST',body:{changes:[{personId:'ora',tagged:true}]}});
    const main=await f.json('/api/people/ora/page'),branch=await f.json(f.site('keha','people/ora/page'));
    assert.equal(main.albums.videos.total,1);
    assert.equal(branch.albums.videos.items[0].id,main.albums.videos.items[0].id);
    assert.deepEqual(new Uint8Array(await (await f.call(main.albums.videos.items[0].src)).arrayBuffer()),new Uint8Array(video));
    assert.equal(f.objects.size,1);
  }finally{f.close();}
});

test('Existing branch profiles, tags, faces and selected portraits migrate once and preserve later shared edits',async()=>{
  const f=fixture();try{
    f.database.exec('CREATE TABLE nakash_media (id TEXT PRIMARY KEY,kind TEXT NOT NULL,data TEXT NOT NULL,created_at INTEGER NOT NULL); CREATE TABLE nakash_profiles (person_id TEXT PRIMARY KEY,data TEXT NOT NULL)');
    const id='a'.repeat(32),item={id,kind:'photo',mime:'image/jpeg',size:photo.length,key:'nakash/legacy.jpg',file:'legacy.jpg',filename:'legacy.jpg',branch:'haim',branches:['haim','keha'],people:['avner-nakash','yona'],createdAt:'2026-11-19T00:00:00Z',
      faces:[{id:'old-face',personId:'avner-nakash',rect:{x:.1,y:.1,width:.2,height:.2},revision:'old'}],faceSummary:{reviewed:true}};
    f.database.prepare('INSERT INTO nakash_media (id,kind,data,created_at) VALUES (?,?,?,?)').run(id,'photo',JSON.stringify(item),1);
    f.database.prepare('INSERT INTO nakash_profiles (person_id,data) VALUES (?,?)').run('avner-nakash',JSON.stringify({birthday:'2.3.1980',about:'הסיפור הקיים',profileMediaId:id}));
    const branch=await f.json(f.site('haim','people/avner-nakash/page'));
    assert.equal(branch.person.birthday,'2.3.1980');
    assert.equal(branch.person.about,'הסיפור הקיים');
    assert.equal(branch.person.profileMediaId,id);
    assert.equal((await f.json('/api/people/yona/page')).albums.photos.total,1);
    const faces=await f.json(f.site('haim','media/'+id+'/faces'));
    assert.equal(faces.faces[0].id,'old-face');
    assert.equal(faces.faces[0].personId,'avner-nakash');
    await f.json(f.site('haim','people/avner-nakash/birthday'),{method:'POST',body:{birthday:'4.5.1980',expectedBirthday:'2.3.1980'}});
    f.restart();
    assert.equal((await f.json(f.site('haim','people/avner-nakash/page'))).person.birthday,'4.5.1980');
    assert.equal(f.database.prepare('SELECT count(*) AS n FROM media WHERE id=?').get(id).n,1);
  }finally{f.close();}
});

test('Family search prioritizes the local family without hiding other relatives or overriding an exact full name',()=>{
  const people=[{id:'local',name:'נעמי מלכי',branch:'yehuda'},{id:'remote',name:'נעמי מדינה',branch:'medina'}];
  assert.deepEqual(suggestPeople(people,'נעמי',6,'yehuda').map(p=>p.id),['local','remote']);
  assert.deepEqual(suggestPeople(people,'נעמי',6,'medina').map(p=>p.id),['remote','local']);
  assert.equal(suggestPeople(people,'נעמי מלכי',6,'medina')[0].id,'local');
});

test('Two Yehudas with the same name keep separate connected profiles and dates',async()=>{
  const f=fixture();try{
    const parent=await f.json(f.site('yehuda','people/yehuda-nakash/page'));
    const grandchild=await f.json(f.site('yehuda','people/yehuda-moshe-nakash/page'));
    assert.notEqual(parent.person.id,grandchild.person.id);
    await f.json(f.site('yehuda','people/yehuda-moshe-nakash/birthday'),{method:'POST',body:{birthday:'1.2.1980',expectedBirthday:'1.1.1111'}});
    assert.equal((await f.json(f.site('yehuda','people/yehuda-nakash/page'))).person.birthday,'1.1.1111');
    assert.equal((await f.json(f.site('yehuda','people/yechiel-nakash/page'))).person.deceased,true);
  }finally{f.close();}
});

test('Haim diagram name corrections retain canonical profile IDs, dates and portraits and run only once',async()=>{
  const f=fixture();try{
    f.database.exec('CREATE TABLE nakash_identities (person_id TEXT PRIMARY KEY,canonical_id TEXT NOT NULL)');
    const insertPerson=f.database.prepare('INSERT INTO people (id,data) VALUES (?,?)');
    const insertIdentity=f.database.prepare('INSERT INTO nakash_identities (person_id,canonical_id) VALUES (?,?)');
    for(const [seed,id,name,nameEn] of [
      ['doron-nir','extra-zion','דורון ניר','Doron Nir'],
      ['alona-shai','extra-ilana','אלונה','Alona'],
    ]){
      insertPerson.run(id,JSON.stringify({id,name,nameEn,aliases:[name,nameEn],extra:true,birthday:'2.3.1940',about:'הסיפור הקיים',profileId:null,revision:'old'}));
      insertIdentity.run(seed,id);
    }
    const upload=await f.json('/api/people/extra-zion/photos?filename=zion.jpg',{method:'POST',body:photo});
    const portrait=upload.person.profileMediaId;
    const dataScript=await (await f.call('/nakash/api/site-data.js')).text();
    const tree=JSON.parse(dataScript.split('\n')[0].slice('window.FAMILY_DATA='.length,-1));
    assert.equal(tree.people['extra-zion'].name,'ציון ניר');
    assert.equal(tree.people['extra-zion'].nameEn,'Zion Nir');
    assert.equal(tree.people['extra-ilana'].name,'אילנה שי');
    assert.equal(tree.people['extra-ilana'].nameEn,'Ilana Shai');
    assert.equal(tree.people['doron-nir'],undefined);
    assert.equal(tree.people['alona-shai'],undefined);
    const page=await f.json(f.site('haim','people/doron-nir/page'));
    assert.equal(page.person.id,'extra-zion');
    assert.equal(page.person.name,'ציון ניר');
    assert.equal(page.person.profileMediaId,portrait);
    assert.equal(page.person.birthday,'2.3.1940');
    assert.equal(page.person.about,'הסיפור הקיים');
    assert.equal(page.albums.photos.total,1);
    assert.ok(!page.person.aliases.includes('דורון ניר'));
    assert.equal(f.objects.size,1);
    const saved=f.state().person('extra-zion');
    saved.name='ציון (ציוני) ניר';
    f.state().savePerson(saved);
    f.restart();
    const next=await f.json(f.site('haim','people/doron-nir/page'));
    assert.equal(next.person.name,'ציון (ציוני) ניר');
    assert.equal(next.person.profileMediaId,portrait);
    assert.equal(next.albums.photos.total,1);
  }finally{f.close();}
});
