import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile} from 'node:fs/promises';
import worker,{FamilyState,LIMITS,sniff} from '../src/worker.mjs';
import {signedRequest} from '../src/hf.mjs';

function fixture(){
  const database=new DatabaseSync(':memory:');
  const sql={exec(query,...args){const statement=database.prepare(query);const rows=statement.columns().length?statement.all(...args):(statement.run(...args),[]);return {toArray:()=>rows};}};
  const storage={sql,transactionSync(callback){database.exec('BEGIN');try{const result=callback();database.exec('COMMIT');return result;}catch(error){database.exec('ROLLBACK');throw error;}}};
  const env={HF_NAMESPACE:'example-owner',HF_BUCKET:'keha-family',HF_ACCESS_KEY_ID:'HFAK_TEST_ONLY',HF_SECRET_ACCESS_KEY:'example-test-secret'};
  let state=new FamilyState({storage},env);
  env.FAMILY_STATE={idFromName:name=>name,get:()=>state};
  env.ASSETS={fetch:async()=>new Response('static assets',{headers:{'Content-Type':'text/html'}})};
  const tasks=[],ctx={waitUntil(promise){tasks.push(promise);}},objects=new Map(),network=[];
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async(input,options)=>{
    const request=input instanceof Request?input:new Request(input,options),url=new URL(request.url);network.push(request);
    if(url.hostname==='s3.hf.co'){
      assert.match(request.headers.get('Authorization')||'',/^AWS4-HMAC-SHA256 Credential=HFAK_TEST_ONLY\//);
      if(request.method==='PUT'){objects.set(url.pathname,{bytes:new Uint8Array(await request.arrayBuffer()),mime:request.headers.get('Content-Type')});return new Response(null,{status:200});}
      if(request.method==='DELETE'){objects.delete(url.pathname);return new Response(null,{status:204});}
      if(!objects.has(url.pathname))return new Response(null,{status:404});
      return new Response(null,{status:302,headers:{Location:'https://cdn.example'+url.pathname}});
    }
    assert.equal(url.hostname,'cdn.example');assert.equal(request.headers.get('Authorization'),null,'Storage credentials must not be forwarded to a CDN');
    const file=objects.get(url.pathname);if(!file)return new Response(null,{status:404});
    let start=0,end=file.bytes.length-1,status=200;const headers={'Content-Type':file.mime,'Accept-Ranges':'bytes'};
    const range=request.headers.get('Range');
    if(range){const [,first,last]=/^bytes=(\d*)-(\d*)$/.exec(range)||[];if(first===''){start=Math.max(0,file.bytes.length-Number(last));}else{start=Number(first);if(last)end=Math.min(end,Number(last));}if(start>end||start>=file.bytes.length)return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+file.bytes.length}});status=206;headers['Content-Range']=`bytes ${start}-${end}/${file.bytes.length}`;}
    const bytes=file.bytes.slice(start,end+1);headers['Content-Length']=String(bytes.byteLength);
    return new Response(request.method==='HEAD'?null:bytes,{status,headers});
  };
  let csrf='';
  async function call(path,{method='GET',body,headers={},clientHeaders=true}={}){
    const h=new Headers(headers);
    if(method==='POST'){h.set('Origin',h.get('Origin')||'https://family.example');if(clientHeaders&&csrf&&!h.has('X-Family-Token'))h.set('X-Family-Token',csrf);}
    if(body&&typeof body==='object'&&!(body instanceof FormData)&&!(body instanceof ArrayBuffer)&&!ArrayBuffer.isView(body)&&!(body instanceof ReadableStream)){h.set('Content-Type','application/json');body=JSON.stringify(body);}
    return worker.fetch(new Request('https://family.example'+path,{method,body,headers:h,...(body instanceof ReadableStream?{duplex:'half'}:{})}),env,ctx);
  }
  async function connect(){
    const bootstrap=await call('/family-data.js');assert.equal(bootstrap.status,200);
    const script=await bootstrap.text();csrf=JSON.parse(/window.FAMILY_API_TOKEN=("[^"]+")/.exec(script)[1]);return script;
  }
  return {env,call,connect,objects,network,database,storage,restart(){state=new FamilyState({storage},env);},flush:()=>Promise.allSettled(tasks),async close(){await Promise.allSettled(tasks);globalThis.fetch=originalFetch;database.close();}};
}
const photo=await readFile(new URL('./fixtures/photo.jpg',import.meta.url));
const video=await readFile(new URL('./fixtures/video.mp4',import.meta.url));

test('visitors can open the site and data without a password or cookie',async()=>{
  const f=fixture();try{
    const home=await f.call('/');assert.equal(home.status,200);assert.equal(await home.text(),'static assets');
    assert.equal((await f.call('/assets/style.css')).status,200);
    const script=await f.connect();assert.match(script,/window.LOCAL_FAMILY_SERVER=true/);assert.equal(script.includes(f.env.HF_SECRET_ACCESS_KEY),false);
    assert.equal(Object.keys((await (await f.call('/api/media')).json()).people).length,82);
    assert.equal((await f.call('/api/stories')).status,200);
    assert.equal((await f.call('/api/export')).status,200);
    f.env.FAMILY_PASSWORD='a-leftover-setting-is-ignored';assert.equal((await f.call('/')).status,200);
  }finally{await f.close();}
});
test('public visitors can save while cross-origin and malformed writes are rejected',async()=>{
  const f=fixture();try{
    await f.connect();const body={birthday:'1.1.2000',expectedBirthday:'1.1.1111'};
    assert.equal((await f.call('/api/people/yona/birthday',{method:'POST',body,clientHeaders:false})).status,403);
    assert.equal((await f.call('/api/people/yona/birthday',{method:'POST',body,headers:{'X-Family-Token':'wrong'}})).status,403);
    assert.equal((await f.call('/api/people/yona/birthday',{method:'POST',body,headers:{Origin:'https://other.example'}})).status,403);
    const result=await f.call('/api/people/yona/birthday',{method:'POST',body});assert.equal(result.status,200);
    assert.equal((await result.json()).person.birthday,'1.1.2000');
  }finally{await f.close();}
});
test('birthday validation, stale-write conflicts and durable reload',async()=>{
  const f=fixture();try{
    await f.connect();
    const body={birthday:'29.2.2000',expectedBirthday:'1.1.1111'};
    let response=await f.call('/api/people/yona/birthday',{method:'POST',body});assert.equal(response.status,200);assert.equal((await response.json()).person.birthday,'29.2.2000');
    assert.equal((await f.call('/api/people/yona/birthday',{method:'POST',body})).status,409);
    for(const value of ['29.2.2001','1.1.9999','bad'])assert.equal((await f.call('/api/people/yona/birthday',{method:'POST',body:{birthday:value,expectedBirthday:'29.2.2000'}})).status,400);
    f.restart();assert.equal((await (await f.call('/api/people/yona')).json()).birthday,'29.2.2000');
    response=await f.call('/api/people/yona/birthday',{method:'POST',body:{birthday:'',expectedBirthday:'29.2.2000'}});assert.equal((await response.json()).person.birthday,'1.1.1111');
  }finally{await f.close();}
});
test('tree corrections update existing names and add a spouse without changing saved family content',async()=>{
  const f=fixture();try{
    await f.connect();
    let response=await f.call('/api/people/bosmat/birthday',{method:'POST',body:{birthday:'2.3.1980',expectedBirthday:'1.1.1111'}});assert.equal(response.status,200);
    response=await f.call('/api/people/bosmat/photos?filename=family.jpg',{method:'POST',body:photo,headers:{'Content-Length':String(photo.length)}});assert.equal(response.status,201);
    const file=(await response.json()).file;
    response=await f.call('/api/people/bosmat/profile',{method:'POST',body:{file}});assert.equal(response.status,200);
    response=await f.call('/api/people/bosmat/caption',{method:'POST',body:{file,caption:'תיאור שנשמר לפני תיקון השם'}});assert.equal(response.status,200);
    response=await f.call('/api/stories',{method:'POST',body:{title:'זיכרון משפחתי',year:2000,body:'סיפור שנשמר לפני העדכון'}});assert.equal(response.status,201);
    const before=await (await f.call('/api/people/bosmat')).json();
    for(const [id,name] of [['bosmat','בשמת מאיר'],['itzik','איציק'],['rami','רמי']]){
      const person=JSON.parse(f.database.prepare('SELECT data FROM people WHERE id=?').get(id).data);person.name=name;
      f.database.prepare('UPDATE people SET data=? WHERE id=?').run(JSON.stringify(person),id);
    }
    f.database.prepare('DELETE FROM people WHERE id=?').run('rachel-katan');
    f.restart();
    const after=await (await f.call('/api/people/bosmat')).json();
    assert.equal(after.name,'בשמת קהא');assert.equal(after.birthday,before.birthday);assert.equal(after.profile,before.profile);assert.equal(after.profileIsManual,true);assert.deepEqual(after.gallery,before.gallery);
    assert.equal((await (await f.call('/api/people/itzik')).json()).name,'איציק מאיר');
    assert.equal((await (await f.call('/api/people/rami')).json()).name,'רמי גנדלמן');
    const graph=JSON.parse(/window.FAMILY_DATA=(.+);/.exec(await f.connect())[1]);
    assert.equal(graph.people['rachel-katan'].name,'רחל קטן');assert.deepEqual(graph.units['u-yehiel'].people,['yehiel','rachel-katan']);
    assert.equal((await (await f.call('/api/stories')).json()).stories[0].body,'סיפור שנשמר לפני העדכון');
    assert.deepEqual(new Uint8Array(await (await f.call(after.gallery[0].src)).arrayBuffer()),new Uint8Array(photo));
    f.restart();assert.equal((await (await f.call('/api/people/bosmat')).json()).revision,after.revision,'Applying the same tree twice must not change the person again');
  }finally{await f.close();}
});
test('personal uploads, captions, profile selection and ownership checks',async()=>{
  const f=fixture();try{
    await f.connect();let response=await f.call('/api/people/yona/photos?filename=family.jpg',{method:'POST',body:photo,headers:{'Content-Length':String(photo.length)}});
    assert.equal(response.status,201);const result=await response.json(),key=result.file;assert.equal(result.person.photoCount,1);
    response=await f.call('/api/people/yona/caption',{method:'POST',body:{file:key,caption:'תיאור משפחתי'}});assert.equal(response.status,200);
    response=await f.call('/api/people/yona/profile',{method:'POST',body:{file:key}});assert.equal((await response.json()).person.profileIsManual,true);
    const other=Object.keys((await (await f.call('/api/media')).json()).people).find(id=>id!=='yona');
    assert.equal((await f.call('/api/people/'+other+'/profile',{method:'POST',body:{file:key}})).status,404);
    const gallery=await (await f.call('/api/people/yona')).json();assert.equal(gallery.gallery[0].caption,'תיאור משפחתי');
    const bytes=new Uint8Array(await (await f.call(gallery.gallery[0].src)).arrayBuffer());assert.deepEqual(bytes,new Uint8Array(photo));
    f.restart();assert.equal((await (await f.call('/api/people/yona')).json()).profileIsManual,true);
  }finally{await f.close();}
});
test('shared video upload streams intact and the private proxy supports seeking',async()=>{
  const f=fixture();try{
    await f.connect();const response=await f.call('/api/collections/videos/upload?filename=family.mp4',{method:'POST',body:video,headers:{'Content-Length':String(video.length)}});
    assert.equal(response.status,201);const result=await response.json(),item=result.collection.items[0];assert.equal(item.mime,'video/mp4');
    let media=await f.call(item.src,{headers:{Range:'bytes=0-31'}});assert.equal(media.status,206);assert.deepEqual(new Uint8Array(await media.arrayBuffer()),new Uint8Array(video.subarray(0,32)));
    media=await f.call(item.src,{headers:{Range:'bytes=-16'}});assert.equal(media.status,206);assert.deepEqual(new Uint8Array(await media.arrayBuffer()),new Uint8Array(video.subarray(-16)));
    assert.equal((await f.call(item.src,{headers:{Range:'bytes=99999999-'}})).status,416);
    assert.equal((await f.call(item.src,{method:'HEAD'})).headers.get('Content-Length'),String(video.length));
    const snap=await f.call('/api/collections/videos');assert.equal((await f.call('/api/collections/videos',{headers:{'If-None-Match':snap.headers.get('ETag')}})).status,304);
  }finally{await f.close();}
});
test('journal creation, editing, TXT import and attachment rollback',async()=>{
  const f=fixture();try{
    await f.connect();let response=await f.call('/api/stories',{method:'POST',body:{title:'הסיפור שלנו',year:'1998',author:'המשפחה',body:'סיפור משפחתי'}});
    assert.equal(response.status,201);const original=(await response.json()).story;
    const updated={...original,year:1999,expectedUpdatedAt:original.updatedAt};response=await f.call('/api/stories/'+original.id,{method:'POST',body:updated});assert.equal(response.status,200);
    assert.equal((await f.call('/api/stories/'+original.id,{method:'POST',body:updated})).status,409);
    const form=new FormData();form.set('title','סיפור מקובץ');form.set('year','1975');form.set('body','');form.append('files',new File(['טקסט בעברית'],'story.txt',{type:'text/plain'}));
    response=await f.call('/api/stories',{method:'POST',body:form});assert.equal(response.status,201);const story=(await response.json()).story;assert.equal(story.body,'טקסט בעברית');assert.equal(story.attachments.length,1);
    const attachment=await f.call(story.attachments[0].src);assert.match(attachment.headers.get('Content-Disposition'),/^attachment;/);assert.equal(await attachment.text(),'טקסט בעברית');
    const stale=new FormData();stale.set('title','התנגשות');stale.set('year','1990');stale.set('body','בדיקה');stale.set('expectedUpdatedAt','wrong');stale.append('files',new File(['new'],'new.txt',{type:'text/plain'}));
    const objectCount=f.objects.size;response=await f.call('/api/stories/'+original.id,{method:'POST',body:stale});assert.equal(response.status,409);
    await f.flush();assert.equal(f.objects.size,objectCount);
    const all=await (await f.call('/api/stories')).json();assert.deepEqual(all.stories.map(item=>item.year),[1975,1999]);
  }finally{await f.close();}
});
test('missing storage configuration preserves text editing and explains upload limits',async()=>{
  const f=fixture();try{
    await f.connect();f.env.HF_ACCESS_KEY_ID='';assert.equal((await (await f.call('/api/setup')).json()).mediaConfigured,false);
    assert.equal((await f.call('/api/stories',{method:'POST',body:{title:'ללא קובץ',year:2000,body:'תוכן'}})).status,201);
    assert.equal((await f.call('/api/collections/photos/upload?filename=x.jpg',{method:'POST',body:photo,headers:{'Content-Length':String(photo.length)}})).status,503);
    f.env.HF_ACCESS_KEY_ID='HFAK_TEST_ONLY';
    assert.equal((await f.call('/api/collections/videos/upload?filename=x.mp4',{method:'POST',body:'x',headers:{'Content-Length':String(LIMITS.video+1)}})).status,413);
    assert.equal((await f.call('/api/collections/photos/upload?filename=x.jpg',{method:'POST',body:'not an image',headers:{'Content-Length':'12'}})).status,415);
    const backup=await f.call('/api/export');assert.match(backup.headers.get('Content-Disposition'),/family-backup.json/);assert.equal((await backup.json()).people.length,82);
  }finally{await f.close();}
});
test('S3 signing scopes requests to the configured private bucket',async()=>{
  const env={HF_NAMESPACE:'example',HF_BUCKET:'family',HF_ACCESS_KEY_ID:'HFAK_TEST',HF_SECRET_ACCESS_KEY:'secret'};
  const request=await signedRequest(env,'photos/shared/abc.jpg',{now:new Date('2026-10-31T12:00:00Z')});
  assert.equal(request.url,'https://s3.hf.co/example/family/photos/shared/abc.jpg');
  assert.match(request.headers.get('Authorization'),/Credential=HFAK_TEST\/20261031\/us-east-1\/s3\/aws4_request/);
  assert.equal(request.headers.get('x-amz-date'),'20261031T120000Z');
  await assert.rejects(signedRequest(env,'../outside'),/הגדרת האחסון/);
  assert.throws(()=>sniff(new TextEncoder().encode('bad')),/בחרו תמונת/);
});
