import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile} from 'node:fs/promises';
import worker,{FamilyState,PUBLIC_WRITE_TOKEN} from '../src/worker.mjs';
import {NAKASH_WRITE_TOKEN,nakashHTML} from '../src/nakash-shell.mjs';
import {extendedKehaHTML} from '../src/extended-keha.mjs';
import {familyApp} from '../family-apps/worker.mjs';
import {MISATTRIBUTED_YONA_DOCUMENT,contentContext,storyInContext} from '../src/family-content.mjs';
import {parseHTML} from 'linkedom';

const scope=(branch,path)=>['extended','shlomo','zechariah','kehat'].includes(branch)?'/keha-extended/'+(branch==='extended'?'':branch+'/')+'api/compat/api/'+path:'/nakash/api/compat/'+branch+'/api/'+path;
function fixture(){
  const sql=new DatabaseSync(':memory:');
  const storage={sql:{exec(query,...args){const p=sql.prepare(query),rows=p.columns().length?p.all(...args):(p.run(...args),[]);return {toArray:()=>rows};}},transactionSync(fn){sql.exec('BEGIN');try{const value=fn();sql.exec('COMMIT');return value;}catch(error){sql.exec('ROLLBACK');throw error;}}};
  const env={HF_NAMESPACE:'fixture',HF_BUCKET:'fixture',HF_ACCESS_KEY_ID:'test',HF_SECRET_ACCESS_KEY:'test'};
  let state=new FamilyState({storage},env);env.FAMILY_STATE={idFromName:n=>n,get:()=>state};
  const objects=new Map(),oldFetch=globalThis.fetch;
  globalThis.fetch=async request=>{const key=new URL(request.url).pathname;if(request.method==='PUT'){objects.set(key,new Uint8Array(await request.arrayBuffer()));return new Response(null,{status:200});}if(request.method==='DELETE'){objects.delete(key);return new Response(null,{status:204});}return new Response(objects.get(key)||new Uint8Array([1]),{status:200});};
  const call=(path,{method='GET',body,headers={}}={})=>{
    if(method==='POST')headers={Origin:'https://family.example','X-Family-Token':path.includes('/compat')?NAKASH_WRITE_TOKEN:PUBLIC_WRITE_TOKEN,...headers};
    if(body&&!ArrayBuffer.isView(body)){body=JSON.stringify(body);headers['Content-Type']='application/json';}
    return worker.fetch(new Request('https://family.example'+path,{method,body,headers}),env,{waitUntil(){}});
  };
  const json=async(path,options)=>{const response=await call(path,options),data=await response.json();assert.ok(response.ok,JSON.stringify({path,status:response.status,data}));return data;};
  let serial=1;
  function media(personId,{type='photo',name='record',filename=name+'.jpg',tags=[],...more}={}){
    const id=(serial++).toString(16).padStart(32,'0');
    const item={id,category:'personal',personId,file:id+'.jpg',filename,name,key:'fixture/'+id,mime:type==='photo'?'image/jpeg':'application/pdf',kind:type,size:100,createdAt:'2026-11-01T00:00:00Z',...more};
    sql.prepare('INSERT INTO media(id,category,person_id,data) VALUES(?,?,?,?)').run(id,item.category,personId,JSON.stringify(item));
    for(const p of tags)sql.prepare('INSERT INTO media_tags(media_id,person_id) VALUES(?,?)').run(id,p);
    return item;
  }
  return {sql,media,call,json,objects,get state(){return state;},restart(){state=new FamilyState({storage},env);},close(){globalThis.fetch=oldFetch;sql.close();}};
}

test('extended stories stop at historical children and exclude Yona and younger descendants',()=>{
  const c=contentContext('extended');
  for(const id of ['shlomo','keha-zechariah','saadia-elder','saadia-israel','kehat-jidaan','kehat-naomi','kehat-yaakov','kehat-yaakov-yehudit'])assert.equal(storyInContext({personIds:[id]},c),true,id);
  for(const id of ['yona','eldad','saadia-aviva','kehat-gila'])assert.equal(storyInContext({personIds:[id]},c),false,id);
});

test('new family stories use the existing editor contract and remain relevant to their own families',async()=>{
  const f=fixture();try{
    const story=await f.json(scope('haim','stories'),{method:'POST',body:{title:'A Haim memory',body:'A story from this branch',category:'family',personIds:['avner-nakash']}});
    assert.equal((await f.json(scope('haim','stories'))).stories.some(s=>s.id===story.story.id),true);
    for(const branch of ['yehuda','medina','extended'])assert.equal((await f.json(scope(branch,'stories'))).stories.some(s=>s.id===story.story.id),false);
    assert.equal((await f.json('/api/stories')).stories.some(s=>s.id===story.story.id),false);
    assert.equal((await f.json(scope('keha','stories?familyScope=nakash'))).stories.some(s=>s.id===story.story.id),true);
    const grandma=await f.json(scope('keha','stories'),{method:'POST',body:{title:'Yona memory',body:'From her childhood',category:'roots',personIds:['yona']}});
    assert.equal((await f.json('/api/stories')).stories.some(s=>s.id===grandma.story.id),true);
    assert.equal((await f.json(scope('extended','stories'))).stories.some(s=>s.id===grandma.story.id),false);
    const blocked=await f.call(scope('extended','stories'),{method:'POST',body:{title:'Younger generation',body:'A new story',personIds:['eldad']}});
    assert.equal(blocked.status,400);
    const parent=await f.json(scope('extended','stories'),{method:'POST',body:{title:'Shlomo memory',body:'An old family memory',personIds:['shlomo'],category:'roots'}});
    assert.equal((await f.json(scope('extended','stories'))).stories.some(s=>s.id===parent.story.id),true);
  }finally{f.close();}
});

test('documents retain original grandparent records, deduplicate shared scans, and exclude obituaries and younger descendants',async()=>{
  const f=fixture();try{
    await f.json(scope('extended','tag-people'));
    const shlomo=f.media('shlomo',{type:'document',name:'תכנית הבית',filename:'house.pdf'});
    f.media('yona',{type:'document',name:'תכנית הבית',filename:'house.pdf'});
    const yona=f.media('yona',{type:'document',name:'תעודת עלייה'});
    f.media('yona',{type:'document',name:'מודעת אבל - יונה'});
    f.media('ruti',{type:'document',name:'תעודת כניסה'});
    f.media('saadia-aviva',{type:'document',name:'תעודה מהדור הבא'});
    const father=f.media('kehat-naomi',{type:'document',name:'תעודת נישואים היסטורית'});
    const own=await f.json('/api/documents');assert.equal(own.items.length,2);assert.ok(own.items.some(d=>d.id===yona.id));
    const house=own.items.find(d=>d.id===shlomo.id);assert.deepEqual(house.personIds,['shlomo','yona']);assert.equal(house.tags.length,2);
    const extended=await f.json(scope('extended','documents'));assert.deepEqual(new Set(extended.items.map(d=>d.id)),new Set([shlomo.id,father.id]));
    const kehat=await f.json(scope('kehat','documents'));assert.deepEqual(kehat.items.map(d=>d.id),[father.id]);
    assert.ok((await f.json(scope('keha','documents'))).items.some(d=>d.id===yona.id));
    assert.equal((await f.json(scope('haim','documents'))).items.length,0);
  }finally{f.close();}
});

test('public family profiles keep founder and child photos and portraits while younger albums and selections stay empty',async()=>{
  const f=fixture();try{
    await f.json(scope('extended','tag-people'));
    const younger=f.media('eldad');const child=f.media('ora');const grandfather=f.media('shlomo',{tags:['eldad']});
    const original=await f.json('/api/people/eldad/page');assert.equal(original.albums.photos.total,2);
    for(const branch of ['keha','shlomo','extended']){
      const page=await f.json(scope(branch,'people/eldad/page'));assert.equal(page.albums.photos.total,0);assert.equal(page.person.photoCount,0);assert.ok(page.person.profile);
      assert.deepEqual((await f.json(scope(branch,'people/eldad/selection?kind=photos'))).ids,[]);
      assert.equal((await f.json(scope(branch,'people/ora/page'))).albums.photos.total,1);
      assert.equal((await f.json(scope(branch,'people/shlomo/page'))).albums.photos.total,1);
      const gallery=await f.json(scope(branch,'collections/gallery?size=all'));assert.ok(!gallery.items.some(item=>item.id===younger.id));assert.ok(gallery.items.some(item=>item.id===child.id));assert.ok(gallery.items.some(item=>item.id===grandfather.id));
    }
    for(const branch of ['haim','yehuda','medina','kehat','zechariah'])assert.equal((await f.json(scope(branch,'collections/gallery?size=all'))).items.length,0,'unrelated galleries do not import the original family photos');
    assert.equal((await f.call('/media/'+younger.id,{headers:{'X-Family-Content-Scope':'shlomo'}})).status,404);
    assert.equal((await f.call('/media/'+younger.id+'?portrait=eldad',{headers:{'X-Family-Content-Scope':'shlomo'}})).status,200);
    assert.equal((await f.call('/media/'+younger.id+'?portrait=ora',{headers:{'X-Family-Content-Scope':'shlomo'}})).status,404);
  }finally{f.close();}
});

test('the mistaken inheritance attribution is removed once without deleting its original file',async()=>{
  const f=fixture();try{
    const item={id:MISATTRIBUTED_YONA_DOCUMENT,category:'personal',personId:'yona',kind:'document',mime:'image/png',key:'archive/original.png',filename:'עיזבון.png'};
    f.sql.prepare('INSERT INTO media(id,category,person_id,data) VALUES(?,?,?,?)').run(item.id,item.category,item.personId,JSON.stringify(item));
    f.sql.prepare("DELETE FROM meta WHERE id='family-content-attribution-2026-11-21-v1'").run();f.restart();
    assert.equal((await f.json('/api/people/yona/page')).albums.documents.total,0);
    assert.equal((await f.json('/api/documents')).items.length,0);
    const saved=JSON.parse(f.sql.prepare('SELECT data FROM media WHERE id=?').get(item.id).data);assert.equal(saved.key,item.key);assert.equal(saved.personId,undefined);assert.equal(saved.archiveExcluded,true);
    const backup=f.sql.prepare('SELECT value FROM meta WHERE id=?').get('family-content-attribution-2026-11-21-v1:backup').value;assert.equal(JSON.parse(backup).personId,'yona');f.restart();assert.equal(f.sql.prepare('SELECT value FROM meta WHERE id=?').get('family-content-attribution-2026-11-21-v1:backup').value,backup);
    assert.equal(f.objects.size,0);
  }finally{f.close();}
});

test('documents upload original PDF and audio bytes once and share their subjects across the right archives',async()=>{
  const f=fixture();try{
    const upload=async(branch,filename,bytes,personIds)=>f.json(branch==='original'?'/api/documents/upload?filename='+filename:scope(branch,'documents/upload?filename='+filename),{method:'POST',body:bytes,headers:{'Content-Length':String(bytes.length),'X-Family-Document':encodeURIComponent(JSON.stringify({title:'תיעוד מהמשפחה',caption:'המקור ללא שינוי',personIds}))}});
    const pdf=new TextEncoder().encode('%PDF-1.4\nOriginal certificate\n%%EOF');
    await upload('original','certificate.pdf',pdf,['shlomo','yona']);
    assert.equal((await f.json('/api/documents')).items.length,1);assert.equal((await f.json(scope('extended','documents'))).items.length,1);assert.equal((await f.json(scope('keha','documents'))).items.length,1);
    const mp3=new TextEncoder().encode('ID3\x04\0\0original audio');await upload('kehat','rare.mp3',mp3,['kehat-jidaan']);
    assert.ok((await f.json(scope('kehat','documents'))).items.some(item=>item.kind==='audio'));
    assert.ok((await f.json(scope('extended','documents'))).items.some(item=>item.kind==='audio'));
    assert.equal((await f.json('/api/documents')).items.length,1);
    assert.deepEqual([...f.objects.values()].map(v=>[...v]),[[...pdf],[...mp3]]);
  }finally{f.close();}
});

test('scoped navigation never links to the complete original app and the separate family origins reject original API routes',async()=>{
  const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
  for(const source of [nakashHTML(html,'haim'),nakashHTML(html,'inside',true),extendedKehaHTML(html)]){
    const {document}=parseHTML(source);assert.ok(document.querySelector('#mainNav [data-view=stories]'));assert.ok(document.querySelector('#mainNav [data-view=documents]'));assert.ok(!document.querySelector('.original-family-tab'));assert.ok(!source.includes('https://keha-family.eldadkeha.workers.dev/#home'));assert.ok(document.querySelector('script[src*="memories.js"]'));assert.ok(document.querySelector('script[src*="family-documents.js"]'));
  }
  const app=familyApp('haim',()=>{throw Error('Unscoped API reached the backend');});
  for(const path of ['/api/export','/api/media','/api/people/eldad/page','/family-data.js'])assert.equal((await app.fetch(new Request('https://haim.example'+path))).status,404);
});
