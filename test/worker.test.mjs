import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile} from 'node:fs/promises';
import worker,{FamilyState,LIMITS,sniff} from '../src/worker.mjs';
import {signedRequest} from '../src/hf.mjs';
import {fail} from '../src/http.mjs';

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
    if(url.hostname==='www.hebcal.com'){
      assert.equal(url.searchParams.get('i'),'on','Use the Israel holiday calendar');
      assert.equal(url.searchParams.get('lg'),'s','Fetch English titles alongside the Hebrew field');
      if(env.FAIL_HOLIDAYS)return new Response('Unavailable',{status:503});
      const year=url.searchParams.get('year');
      return Response.json({items:[{date:year+'-07-21',hebrew:'ראש חודש',title:'Rosh Chodesh',category:'roshchodesh'},{date:year+'-11-10',hebrew:'רֹאשׁ חוֹדֶשׁ כִּסְלֵו',title:'Rosh Chodesh Kislev',category:'roshchodesh'},{date:year+'-07-21T20:00:00+03:00',title:'Candle lighting',category:'candles'}]});
    }
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
    await f.connect();const body={birthday:'1.1.2000',expectedBirthday:'16.10.1921'};
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
    const body={birthday:'29.2.2000',expectedBirthday:'16.10.1921'};
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
    const tagged=await taggedUpload(f);await setTags(f,tagged,['memo','camille']);
    const beforeTagged=await f.call('/api/collections/photos');
    for(const [id,name] of [['bosmat','בשמת מאיר'],['itzik','איציק'],['rami','רמי'],['memo','ממו וארגאס'],['camille','קמיל דה ווילה']]){
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
    assert.equal(graph.people.chantal.name,'שנטל פירוז');assert.equal(graph.people.camille.name,'קמיל דה ויטה');assert.equal(graph.people.memo.name,'גיירמו וארגאס');assert.equal(graph.people.memo.firstName,'גיירמו');assert.equal(graph.people['rachel-katan'].name,'רחל קטן');assert.deepEqual(graph.units['u-yehiel'].people,['yehiel','rachel-katan']);
    const renamedTags=await f.call('/api/collections/photos',{headers:{'If-None-Match':beforeTagged.headers.get('ETag')}});assert.equal(renamedTags.status,200,'A rename must refresh existing cached tag labels');
    const taggedPhoto=(await renamedTags.json()).items[0];assert.equal(taggedPhoto.id,tagged.id);assert.deepEqual(taggedPhoto.tags.map(person=>person.name),['גיירמו וארגאס','קמיל דה ויטה']);
    const roster=(await (await f.call('/api/tag-people')).json()).people;assert.equal(roster.find(person=>person.id==='memo').name,'גיירמו וארגאס');assert.equal(roster.find(person=>person.id==='camille').name,'קמיל דה ויטה');
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
test('weddings include all couples and retain valid anniversary dates across restarts',async()=>{
  const f=fixture();try{
    await f.connect();const list=await (await f.call('/api/weddings')).json();assert.equal(list.weddings.length,23);
    assert.ok(list.weddings.every(item=>item.people.length===2&&item.date===''));
    assert.deepEqual(list.weddings.find(item=>item.id==='u-yehiel').people,['yehiel','rachel-katan']);
    assert.equal((await f.call('/api/weddings/u-naama')).status,404);
    const original=list.weddings.find(item=>item.id==='u-yehiel');
    let response=await f.call('/api/weddings/u-yehiel/date',{method:'POST',body:{date:'1.1.2000',expectedRevision:original.revision}});assert.equal(response.status,200);
    const changed=(await response.json()).wedding;assert.equal(changed.date,'1.1.2000');
    assert.equal((await f.call('/api/weddings/u-yehiel/date',{method:'POST',body:{date:'2.1.2000',expectedRevision:original.revision}})).status,409);
    for(const date of ['31.4.2000','29.2.2001','1.1.9999','1.1.1111','wrong',42])assert.equal((await f.call('/api/weddings/u-yehiel/date',{method:'POST',body:{date,expectedRevision:changed.revision}})).status,400);
    f.restart();const restored=await (await f.call('/api/weddings/u-yehiel')).json();assert.equal(restored.date,'1.1.2000');assert.equal(restored.revision,changed.revision);
    response=await f.call('/api/weddings/u-yehiel/date',{method:'POST',body:{date:'',expectedRevision:changed.revision}});assert.equal(response.status,200);assert.equal((await response.json()).wedding.date,'');
    assert.equal((await f.call('/api/weddings/u-naama/date',{method:'POST',body:{date:'1.1.2000',expectedRevision:'x'}})).status,404);
  }finally{await f.close();}
});
test('wedding galleries isolate couples, stream mixed media and retain captions',async()=>{
  const f=fixture();try{
    await f.connect();const root='/api/weddings/u-yehiel',other='/api/weddings/u-bosmat';
    const pdf=new TextEncoder().encode('%PDF-1.4\nA wedding blessing\n%%EOF');
    let photoFile;
    for(const [name,bytes,kind]of [['ceremony.jpg',photo,'photo'],['celebration.mp4',video,'video'],['blessing.pdf',pdf,'document']]){
      const response=await f.call(root+'/upload?filename='+name,{method:'POST',body:bytes,headers:{'Content-Length':String(bytes.length)}});assert.equal(response.status,201);
      const uploaded=await response.json(),item=uploaded.collection.items[0];assert.equal(item.kind,kind);
      assert.deepEqual(new Uint8Array(await (await f.call(item.src)).arrayBuffer()),new Uint8Array(bytes));
      if(kind==='photo')photoFile=item.file;
      if(kind==='document')assert.match((await f.call(item.src)).headers.get('Content-Disposition'),/^attachment;/);
      if(kind==='video'){const part=await f.call(item.src,{headers:{Range:'bytes=0-15'}});assert.equal(part.status,206);assert.deepEqual(new Uint8Array(await part.arrayBuffer()),new Uint8Array(video.subarray(0,16)));}
    }
    assert.equal((await f.call(root+'/caption',{method:'POST',body:{file:photoFile,caption:'בדרך לחופה'}})).status,200);
    assert.equal((await f.call(other+'/caption',{method:'POST',body:{file:photoFile,caption:'Wrong couple'}})).status,404);
    const metadata=await (await f.call(root)).json();assert.equal(metadata.mediaCount,3);assert.equal(metadata.collection.items.find(item=>item.file===photoFile).caption,'בדרך לחופה');
    assert.equal((await (await f.call(other)).json()).mediaCount,0);
    assert.equal((await (await f.call('/api/collections/photos')).json()).count,0);
    assert.ok([...f.objects.keys()].every(key=>key.startsWith('/example-owner/keha-family/weddings/u-yehiel/')));
    const count=f.objects.size;assert.equal((await f.call('/api/weddings/u-naama/upload?filename=x.jpg',{method:'POST',body:photo,headers:{'Content-Length':String(photo.length)}})).status,404);assert.equal(f.objects.size,count);
    f.restart();assert.equal((await (await f.call(root)).json()).mediaCount,3);
  }finally{await f.close();}
});
test('wedding greetings are durable, separate for every couple and exported with anniversaries',async()=>{
  const f=fixture();try{
    await f.connect();const path='/api/weddings/u-eldad';
    let response=await f.call(path+'/greetings',{method:'POST',body:{author:'משפחת קהא',body:'מזל טוב <3\nשתמיד תשמחו יחד!'}});assert.equal(response.status,201);
    assert.equal((await response.json()).greeting.body,'מזל טוב <3\nשתמיד תשמחו יחד!');
    for(const body of ['',null,'x'.repeat(10001)])assert.equal((await f.call(path+'/greetings',{method:'POST',body:{body}})).status,400);
    assert.equal((await f.call('/api/weddings/u-naama/greetings',{method:'POST',body:{body:'מזל טוב'}})).status,404);
    f.restart();const wedding=await (await f.call(path)).json();assert.equal(wedding.greetingCount,1);assert.equal(wedding.greetings[0].author,'משפחת קהא');
    assert.equal((await (await f.call('/api/weddings/u-bosmat')).json()).greetingCount,0);
    const backup=await (await f.call('/api/export')).json();assert.equal(backup.schemaVersion,2);assert.equal(backup.weddings.length,23);assert.equal(backup.greetings.length,1);assert.equal(backup.people.length,82);
  }finally{await f.close();}
});
test('nostalgia supports photos, video and downloadable documents without altering other albums',async()=>{
  const f=fixture();try{
    await f.connect();const doc=new Uint8Array([208,207,17,224,161,177,26,225,0,0,0,0]);
    const examples=[['old-photo.jpg',photo,'photo'],['old-film.mp4',video,'video'],['letter.txt',new TextEncoder().encode('מכתב משפחתי ישן'),'document'],['letter.doc',doc,'document']];
    for(const[name,bytes,kind]of examples){
      const response=await f.call('/api/nostalgia/upload?filename='+name,{method:'POST',body:bytes,headers:{'Content-Length':String(bytes.length)}});assert.equal(response.status,201);
      const item=(await response.json()).collection.items[0];assert.equal(item.kind,kind);const content=await f.call(item.src);assert.deepEqual(new Uint8Array(await content.arrayBuffer()),new Uint8Array(bytes));
      if(kind==='document')assert.match(content.headers.get('Content-Disposition'),/^attachment;/);
    }
    const initial=await (await f.call('/api/nostalgia')).json();assert.equal(initial.count,4);
    const file=initial.items[0].file;assert.equal((await f.call('/api/nostalgia/caption',{method:'POST',body:{file,caption:'מכתב מהבית הישן'}})).status,200);
    const snapshot=await f.call('/api/nostalgia');assert.equal((await f.call('/api/nostalgia',{headers:{'If-None-Match':snapshot.headers.get('ETag')}})).status,304);
    f.restart();assert.equal((await (await f.call('/api/nostalgia')).json()).items[0].caption,'מכתב מהבית הישן');
    assert.equal((await (await f.call('/api/collections/videos')).json()).count,6);assert.equal((await (await f.call('/api/weddings/u-root')).json()).mediaCount,0);
    assert.equal((await f.call('/api/nostalgia/caption',{method:'POST',body:{file,caption:'x'},headers:{Origin:'https://foreign.example'}})).status,403);
  }finally{await f.close();}
});
test('mixed galleries reject invalid document signatures and enforce per-type upload limits',async()=>{
  const f=fixture();try{
    await f.connect();const pdf=new TextEncoder().encode(('%PDF-1.4\nExample').padEnd(200,' '));
    for(const name of ['bad.pdf','bad.docx','bad.doc','page.html']){
      const bytes=new TextEncoder().encode('This is not the specified document');assert.equal((await f.call('/api/nostalgia/upload?filename='+name,{method:'POST',body:bytes,headers:{'Content-Length':String(bytes.length)}})).status,415);
    }
    assert.equal((await f.call('/api/nostalgia/upload?filename=big.pdf',{method:'POST',body:pdf,headers:{'Content-Length':String(LIMITS.attachment+1)}})).status,413);
    assert.equal((await f.call('/api/weddings/u-root/upload?filename=big.jpg',{method:'POST',body:photo,headers:{'Content-Length':String(LIMITS.photo+1)}})).status,413);
    assert.equal(f.objects.size,0);
    f.env.HF_ACCESS_KEY_ID='';assert.equal((await f.call('/api/nostalgia/upload?filename=photo.jpg',{method:'POST',body:photo,headers:{'Content-Length':String(photo.length)}})).status,503);
    assert.equal((await f.call('/api/weddings/u-root/greetings',{method:'POST',body:{body:'ברכה ללא קובץ'}})).status,201);
  }finally{await f.close();}
});
test('Yona death information is visible in family data and preserves existing birthdays',async()=>{
  const f=fixture();try{
    await f.connect();const person=await (await f.call('/api/people/yona')).json();assert.equal(person.deceased,true);assert.equal(person.deathDate,'16.6.2010');
    const bootstrap=JSON.parse(/window.FAMILY_DATA=(.+);/.exec(await f.connect())[1]);assert.equal(bootstrap.people.yona.deathDate,'16.6.2010');
    assert.equal((await f.call('/api/people/yona/birthday',{method:'POST',body:{birthday:'1.1.2015',expectedBirthday:person.birthday}})).status,400);
    const response=await f.call('/api/people/yona/birthday',{method:'POST',body:{birthday:'1.1.1930',expectedBirthday:person.birthday}});assert.equal(response.status,200);
    f.restart();const restored=await (await f.call('/api/people/yona')).json();assert.equal(restored.birthday,'1.1.1930');assert.equal(restored.deathDate,'16.6.2010');
  }finally{await f.close();}
});
test('special birthdays contain six unique YouTube videos and deletions survive deployment',async()=>{
  const f=fixture();try{
    await f.connect();const response=await f.call('/api/collections/videos'),initial=await response.json();
    assert.equal(initial.count,6);assert.equal(new Set(initial.items.map(item=>item.youtubeId)).size,6);
    assert.deepEqual(initial.items.map(item=>item.youtubeId),['LTTdcZUSF7A','bbsWuwVwHks','CqkreY-_mSs','KUP1WtKCtec','UerqNt1Hhc0','pws4Fk1jSFo']);
    assert.ok(initial.items.every(item=>item.provider==='youtube'&&item.videoCategory==='special-birthdays'&&item.scope==='videos'&&/^[a-f0-9]{32}$/.test(item.id)));
    const ora=initial.items.find(item=>item.youtubeId==='CqkreY-_mSs');assert.equal(ora.name,'אורה בת 60');
    const redirect=await f.call(ora.src);assert.equal(redirect.status,302);assert.equal(redirect.headers.get('Location'),'https://www.youtube.com/watch?v=CqkreY-_mSs');
    assert.equal(f.network.length,0,'Embedded videos do not upload or retrieve binary files');
    assert.equal((await f.call('/api/media/'+ora.id+'/delete',{method:'POST',body:{scope:'photos'}})).status,404);
    assert.equal((await f.call('/api/media/'+ora.id+'/delete',{method:'POST',body:{scope:'videos'},headers:{Origin:'https://foreign.example'}})).status,403);
    const deleted=await (await f.call('/api/media/'+ora.id+'/delete',{method:'POST',body:{scope:'videos'}})).json();assert.equal(deleted.collection.count,5);
    assert.notEqual(deleted.collection.revision,initial.revision);assert.equal((await f.call(ora.src)).status,404);
    assert.equal((await f.call('/api/collections/videos',{headers:{'If-None-Match':response.headers.get('ETag')}})).status,200);
    f.restart();assert.equal((await (await f.call('/api/collections/videos')).json()).count,5,'A source seed must not resurrect deleted videos');
    assert.ok(!(await (await f.call('/api/export')).json()).media.some(item=>item.id===ora.id));
    const restored=await (await f.call('/api/media/'+ora.id+'/restore',{method:'POST',body:{scope:'videos'}})).json();assert.equal(restored.collection.count,6);
    f.restart();assert.equal((await (await f.call('/api/collections/videos')).json()).count,6);
    assert.match((await f.call('/')).headers.get('Content-Security-Policy'),/frame-src 'self' https:\/\/www.youtube-nocookie.com/);
  }finally{await f.close();}
});
test('personal photo deletion updates portraits, preserves dates and supports conservative undo',async()=>{
  const f=fixture();try{
    await f.connect();await f.call('/api/people/chantal/birthday',{method:'POST',body:{birthday:'2.3.1980',expectedBirthday:'1.1.1111'}});
    for(const name of ['first.jpg','second.jpg'])assert.equal((await f.call('/api/people/chantal/photos?filename='+name,{method:'POST',body:photo,headers:{'Content-Length':String(photo.length)}})).status,201);
    let person=await (await f.call('/api/people/chantal')).json();const [first,second]=person.gallery;
    await f.call('/api/people/chantal/profile',{method:'POST',body:{file:first.file}});
    const path='/api/media/'+first.id,body={scope:'personal:chantal'};
    assert.equal((await f.call(path+'/delete',{method:'POST',body:{scope:'personal:yona'}})).status,404);
    person=(await (await f.call(path+'/delete',{method:'POST',body})).json()).person;
    assert.equal(person.name,'שנטל פירוז');assert.equal(person.birthday,'2.3.1980');assert.equal(person.photoCount,1);assert.equal(person.profile,second.src);assert.equal(person.profileIsManual,false);
    assert.equal((await f.call(first.src)).status,404);assert.equal(f.objects.size,2,'Deleting a gallery item is reversible without removing the stored original');
    f.restart();assert.equal((await (await f.call('/api/people/chantal')).json()).profile,second.src);
    person=(await (await f.call(path+'/restore',{method:'POST',body})).json()).person;assert.equal(person.profile,first.src);assert.equal(person.profileIsManual,true);
    await f.call(path+'/delete',{method:'POST',body});await f.call('/api/people/chantal/profile',{method:'POST',body:{file:second.file}});
    person=(await (await f.call(path+'/restore',{method:'POST',body})).json()).person;assert.equal(person.profile,second.src,'Undo must not replace a new profile choice');
    assert.deepEqual(new Uint8Array(await (await f.call(first.src)).arrayBuffer()),new Uint8Array(photo));
    assert.equal((await (await f.call('/api/people/yona')).json()).photoCount,0);
  }finally{await f.close();}
});
test('delete and restore isolate shared, wedding and nostalgia galleries and keep counters current',async()=>{
  const f=fixture();try{
    await f.connect();
    for(const [root,scope]of [['/api/collections/photos','photos'],['/api/weddings/u-yehiel','wedding:u-yehiel'],['/api/nostalgia','nostalgia']]){
      const result=await (await f.call(root+'/upload?filename=memory.jpg',{method:'POST',body:photo,headers:{'Content-Length':String(photo.length)}})).json(),item=result.collection.items[0];
      const body={scope},path='/api/media/'+item.id;
      assert.equal((await f.call(path+'/delete',{method:'POST',body,clientHeaders:false})).status,403);
      let response=await f.call(path+'/delete',{method:'POST',body});assert.equal(response.status,200);let changed=await response.json();assert.equal(changed.collection.count,0);assert.notEqual(changed.collection.revision,result.collection.revision);
      if(scope.startsWith('wedding:')){assert.equal(changed.wedding.mediaCount,0);assert.equal(changed.wedding.cover,null);}
      f.restart();assert.equal((await f.call(item.src)).status,404);
      assert.equal((await f.call(path+'/restore',{method:'POST',body:{scope:'videos'}})).status,404);
      response=await f.call(path+'/restore',{method:'POST',body});assert.equal(response.status,200);changed=await response.json();assert.equal(changed.collection.count,1);
      if(changed.wedding){assert.equal(changed.wedding.mediaCount,1);assert.equal(changed.wedding.cover,item.src);}
      assert.deepEqual(new Uint8Array(await (await f.call(item.src)).arrayBuffer()),new Uint8Array(photo));
    }
    assert.equal((await (await f.call('/api/weddings/u-bosmat')).json()).mediaCount,0);assert.equal((await (await f.call('/api/collections/videos')).json()).count,6);
    const form=new FormData();form.set('title','סיפור');form.set('year','2000');form.append('files',new File(['זיכרון'],'story.txt',{type:'text/plain'}));
    const story=(await (await f.call('/api/stories',{method:'POST',body:form})).json()).story,id=story.attachments[0].src.split('/').pop();
    assert.equal((await f.call('/api/media/'+id+'/delete',{method:'POST',body:{scope:'attachment'}})).status,400);
    assert.equal((await f.call(story.attachments[0].src)).status,200);
  }finally{await f.close();}
});
test('new video uploads keep their chosen birthday category',async()=>{
  const f=fixture();try{
    await f.connect();
    const result=await (await f.call('/api/collections/videos/upload?filename=birthday.mp4&group=special-birthdays',{method:'POST',body:video,headers:{'Content-Length':String(video.length)}})).json();
    assert.equal(result.collection.count,7);assert.equal(result.collection.items[0].videoCategory,'special-birthdays');assert.equal(result.collection.items[0].provider,undefined);
    f.restart();assert.equal((await (await f.call('/api/collections/videos')).json()).items[0].videoCategory,'special-birthdays');
    assert.equal((await f.call('/api/collections/videos/upload?filename=bad.mp4&group=other',{method:'POST',body:video,headers:{'Content-Length':String(video.length)}})).status,400);
    assert.equal(f.objects.size,1);
  }finally{await f.close();}
});
async function taggedUpload(f,path='/api/collections/photos',bytes=photo,name='together.jpg'){
  const response=await f.call(path+'/upload?filename='+name,{method:'POST',body:bytes,headers:{'Content-Length':String(bytes.length)}});assert.equal(response.status,201);
  const result=await response.json();return result.collection.items[0];
}
async function setTags(f,item,personIds,newNames=[],revision){
  const before=revision===undefined?(await (await f.call('/api/media/'+item.id+'/tags')).json()).item.tagsRevision:revision;
  return f.call('/api/media/'+item.id+'/tags',{method:'POST',body:{personIds,newNames,expectedRevision:before}});
}
test('one shared photo appears immediately in every tagged personal album without copying it',async()=>{
  const f=fixture();try{
    await f.connect();const item=await taggedUpload(f),before=await f.call('/api/people/chantal');
    const response=await setTags(f,item,['chantal','camille','chantal']);assert.equal(response.status,200);const changed=await response.json();
    assert.deepEqual(changed.item.tags.map(person=>person.name),['שנטל פירוז','קמיל דה ויטה']);
    for(const id of ['chantal','camille']){const person=changed.people[id];assert.equal(person.photoCount,1);assert.equal(person.mediaCount,1);assert.equal(person.gallery[0].id,item.id);assert.equal(person.gallery[0].src,item.src);assert.equal(person.gallery[0].linked,true);assert.equal(person.gallery[0].scope,'photos');}
    assert.equal((await f.call('/api/people/chantal',{headers:{'If-None-Match':before.headers.get('ETag')}})).status,200);
    assert.equal(f.objects.size,1);assert.equal(f.database.prepare('SELECT count(*) AS n FROM media WHERE id=?').get(item.id).n,1);
    const source=await (await f.call('/api/collections/photos')).json();assert.equal(source.count,1);assert.deepEqual(source.items[0].tags,changed.item.tags);
    const revision=changed.item.tagsRevision;const same=await (await setTags(f,item,['camille','chantal'])).json();assert.equal(same.item.tagsRevision,revision,'Saving the same membership must not create duplicates or unnecessary revisions');
    f.restart();const restored=await (await f.call('/api/people/camille')).json();assert.equal(restored.gallery[0].id,item.id);assert.equal(restored.photoCount,1);
    assert.equal((await (await f.call('/api/media')).json()).people.chantal.photoCount,1);
  }finally{await f.close();}
});
test('tagging an owner deduplicates the album, and captions stay shared across personal albums',async()=>{
  const f=fixture();try{
    await f.connect();const uploaded=await (await f.call('/api/people/chantal/photos?filename=mine.jpg',{method:'POST',body:photo,headers:{'Content-Length':String(photo.length)}})).json(),item=uploaded.person.gallery[0];
    assert.equal((await setTags(f,item,['chantal','camille'])).status,200);
    assert.equal((await (await f.call('/api/people/chantal')).json()).photoCount,1);assert.equal((await (await f.call('/api/people/camille')).json()).photoCount,1);
    const response=await f.call('/api/people/camille/caption',{method:'POST',body:{file:item.file,caption:'שתינו יחד'}});assert.equal(response.status,200);
    assert.equal((await (await f.call('/api/people/chantal')).json()).gallery[0].caption,'שתינו יחד');
    await setTags(f,item,[]);assert.equal((await (await f.call('/api/people/chantal')).json()).photoCount,1,'The original owner keeps a photo even when their explicit tag is removed');assert.equal((await (await f.call('/api/people/camille')).json()).photoCount,0);
    assert.equal((await f.call(item.src)).status,200);assert.equal(f.objects.size,1);
  }finally{await f.close();}
});
test('tagged YouTube and uploaded videos appear as videos and never become profile photos',async()=>{
  const f=fixture();try{
    await f.connect();const youtube=(await (await f.call('/api/collections/videos')).json()).items[0];
    await setTags(f,youtube,['yehiel']);let person=await (await f.call('/api/people/yehiel')).json();assert.equal(person.videoCount,1);assert.equal(person.photoCount,0);assert.equal(person.profile,null);assert.equal(person.gallery[0].provider,'youtube');
    assert.equal((await f.call('/api/people/yehiel/profile',{method:'POST',body:{file:youtube.file}})).status,404);
    const film=await taggedUpload(f,'/api/nostalgia',video,'old-film.mp4');await setTags(f,film,['yehiel']);person=await (await f.call('/api/people/yehiel')).json();assert.equal(person.videoCount,2);assert.equal(person.mediaCount,2);
    f.restart();assert.equal((await (await f.call('/api/people/yehiel')).json()).videoCount,2);assert.equal(f.objects.size,1);
  }finally{await f.close();}
});
test('adding a name creates a durable album and reuses existing canonical or newly added names',async()=>{
  const f=fixture();try{
    await f.connect();const item=await taggedUpload(f);
    let response=await setTags(f,item,[],['שנטל פירוז','אורח חדש',' אורח   חדש ']);assert.equal(response.status,200);let changed=await response.json();assert.equal(changed.item.tags.length,2);
    const added=changed.item.tags.find(person=>person.extra);assert.ok(added.id.startsWith('extra-'));assert.equal(changed.people[added.id].photoCount,1);
    assert.equal((await (await f.call('/api/tag-people')).json()).people.length,83);assert.equal((await (await f.call('/api/weddings')).json()).weddings.length,23);
    const bootstrap=JSON.parse(/window.FAMILY_DATA=(.+);/.exec(await f.connect())[1]);assert.equal(bootstrap.people[added.id].name,'אורח חדש');assert.equal(bootstrap.people[added.id].extra,true);assert.ok(!Object.values(bootstrap.units).some(unit=>unit.people.includes(added.id)));
    f.restart();response=await setTags(f,item,[],['אורח חדש']);changed=await response.json();assert.equal(changed.item.tags[0].id,added.id);assert.equal((await (await f.call('/api/tag-people')).json()).people.length,83);
    assert.equal((await f.call('/api/people/'+added.id+'/photos?filename=portrait.jpg',{method:'POST',body:photo,headers:{'Content-Length':String(photo.length)}})).status,201);
    const backup=await (await f.call('/api/export')).json();assert.ok(backup.people.some(person=>person.id===added.id));assert.deepEqual(backup.tags,[{mediaId:item.id,personId:added.id}]);
  }finally{await f.close();}
});
test('removing a linked item only removes that person\'s tag, with undo and profile fallback',async()=>{
  const f=fixture();try{
    await f.connect();const item=await taggedUpload(f,'/api/weddings/u-yehiel');await setTags(f,item,['chantal','camille']);
    await f.call('/api/people/chantal/profile',{method:'POST',body:{file:item.file}});
    let response=await f.call('/api/media/'+item.id+'/untag',{method:'POST',body:{scope:'personal:chantal'}});assert.equal(response.status,200);let result=await response.json();assert.equal(result.wasProfile,true);assert.equal(result.people.chantal.photoCount,0);assert.equal(result.people.chantal.profile,null);assert.equal(result.people.camille.photoCount,1);assert.equal(result.collection.count,1);
    assert.equal((await f.call(item.src)).status,200);f.restart();assert.equal((await (await f.call('/api/people/chantal')).json()).photoCount,0);
    response=await f.call('/api/media/'+item.id+'/retag',{method:'POST',body:{scope:'personal:chantal',restoreProfile:true}});result=await response.json();assert.equal(result.people.chantal.profile,item.src);assert.equal(result.people.chantal.profileIsManual,true);assert.equal(result.people.chantal.photoCount,1);
    assert.equal((await f.call('/api/media/'+item.id+'/delete',{method:'POST',body:{scope:'personal:chantal'}})).status,404,'A linked view cannot accidentally delete the master file');
    assert.equal((await (await f.call('/api/weddings/u-yehiel')).json()).mediaCount,1);
    await setTags(f,item,['camille']);assert.equal((await (await f.call('/api/people/chantal')).json()).profile,null,'Removing a tag through the editor also clears a selected linked profile');
  }finally{await f.close();}
});
test('global deletion and restoration update every tagged album and preserve manual profile choices',async()=>{
  const f=fixture();try{
    await f.connect();const item=await taggedUpload(f);await setTags(f,item,['chantal','camille']);
    for(const id of ['chantal','camille'])await f.call('/api/people/'+id+'/profile',{method:'POST',body:{file:item.file}});
    let result=await (await f.call('/api/media/'+item.id+'/delete',{method:'POST',body:{scope:'photos'}})).json();assert.equal(result.people.chantal.photoCount,0);assert.equal(result.people.camille.profile,null);
    assert.equal((await (await f.call('/api/export')).json()).tags.length,0);assert.equal((await f.call('/api/media/'+item.id+'/tags')).status,404);
    const second=await (await f.call('/api/people/chantal/photos?filename=new.jpg',{method:'POST',body:photo,headers:{'Content-Length':String(photo.length)}})).json();
    await f.call('/api/people/chantal/profile',{method:'POST',body:{file:second.file}});
    f.restart();result=await (await f.call('/api/media/'+item.id+'/restore',{method:'POST',body:{scope:'photos'}})).json();
    assert.equal(result.people.camille.profile,item.src);assert.equal(result.people.camille.profileIsManual,true);assert.equal(result.people.chantal.profile,second.person.gallery[0].src);assert.equal(result.people.chantal.photoCount,2);assert.equal(result.item.tags.length,2);assert.equal(f.objects.size,2);
  }finally{await f.close();}
});
test('tagging validates input, prevents stale overwrites and rolls back invalid new names',async()=>{
  const f=fixture();try{
    await f.connect();const item=await taggedUpload(f),path='/api/media/'+item.id+'/tags';
    const body={personIds:['chantal'],newNames:[],expectedRevision:'empty'};
    assert.equal((await f.call(path,{method:'POST',body,clientHeaders:false})).status,403);assert.equal((await f.call(path,{method:'POST',body,headers:{Origin:'https://other.example'}})).status,403);
    assert.equal((await f.call(path,{method:'POST',body})).status,200);
    assert.equal((await f.call(path,{method:'POST',body:{...body,personIds:['camille'],newNames:['שם שלא יישמר']}})).status,409);
    assert.equal((await (await f.call('/api/tag-people')).json()).people.length,82);assert.equal((await (await f.call('/api/media/'+item.id+'/tags')).json()).item.tags[0].id,'chantal');
    assert.equal((await setTags(f,item,['missing-person'])).status,404);
    assert.equal((await setTags(f,item,[],['שם חדש',42])).status,400,'An invalid name rolls the whole operation back');
    assert.equal((await (await f.call('/api/tag-people')).json()).people.length,82);
    assert.equal((await setTags(f,item,[],Array(51).fill('שם'))).status,400);assert.equal((await setTags(f,item,[],[' '.repeat(5)])).status,400);
    const doc=await taggedUpload(f,'/api/nostalgia',new TextEncoder().encode('מכתב נוסטלגי'),'letter.txt');assert.equal((await f.call('/api/media/'+doc.id+'/tags')).status,400);
    const row=JSON.parse(f.database.prepare('SELECT data FROM people WHERE id=?').get('camille').data);row.name='שנטל פירוז';f.database.prepare('UPDATE people SET data=? WHERE id=?').run(JSON.stringify(row),'camille');
    assert.equal((await setTags(f,item,[],['שנטל פירוז'])).status,409,'Ambiguous names require an explicit identity choice');
  }finally{await f.close();}
});


test('gallery uploads stay separate and automatic tag deltas preserve other people and durable album links',async()=>{
  const f=fixture();try{
    await f.connect();
    const upload=await f.call('/api/collections/gallery/upload?filename=gallery.jpg',{method:'POST',body:photo,headers:{'Content-Length':String(photo.length)}});assert.equal(upload.status,201);
    let collection=(await upload.json()).collection,item=collection.items[0];
    assert.equal(collection.kind,'gallery');
    const id=item.id,storageCount=f.objects.size;
    const tag=(body)=>f.call('/api/media/'+id+'/tag',{method:'POST',body});
    const results=await Promise.all([tag({personId:'yona',tagged:true}),tag({personId:'yehiel',tagged:true})]);
    for(const response of results)assert.equal(response.status,200);
    item=(await (await f.call('/api/media/'+id+'/tags')).json()).item;
    assert.deepEqual(new Set(item.tags.map(person=>person.id)),new Set(['yona','yehiel']));
    let result=await (await tag({name:'שם נוסף לבדיקה',tagged:true})).json();const extraId=result.taggedPerson.id;
    assert.match(extraId,/^extra-/);result=await (await tag({name:'שם נוסף לבדיקה',tagged:true})).json();assert.equal(result.taggedPerson.id,extraId);
    assert.equal((await tag({personId:'yona',tagged:false})).status,200);
    assert.equal((await (await f.call('/api/people/yona')).json()).mediaCount,0);
    assert.equal((await (await f.call('/api/people/yehiel')).json()).gallery[0].id,id);
    assert.equal((await (await f.call('/api/collections/photos')).json()).items.length,0);
    assert.equal(f.objects.size,storageCount,'Tagging must never duplicate files');
    for(const body of [{personId:'yona'},{personId:'yona',name:'other',tagged:true},{name:'extra',tagged:false},{name:4,tagged:true}])assert.equal((await tag(body)).status,400);
    assert.equal((await tag({personId:'bad-id',tagged:true})).status,404);
    f.restart();assert.equal((await (await f.call('/api/people/'+extraId)).json()).gallery[0].id,id);
    assert.equal((await f.call('/api/media/'+id+'/delete',{method:'POST',body:{scope:'gallery'}})).status,200);
    assert.equal((await (await f.call('/api/people/yehiel')).json()).mediaCount,0);
    assert.equal((await f.call('/api/media/'+id+'/restore',{method:'POST',body:{scope:'gallery'}})).status,200);
    assert.equal((await (await f.call('/api/people/yehiel')).json()).gallery[0].id,id);
    assert.equal((await f.call('/api/collections/gallery/upload?filename=video.mp4',{method:'POST',body:video,headers:{'Content-Length':String(video.length)}})).status,415);
  }finally{await f.close();}
});
test('Roi death date is canonical and limits birthdays without overwriting saved values',async()=>{
  const f=fixture();try{
    await f.connect();let person=await(await f.call('/api/people/roi')).json();assert.equal(person.deathDate,'21.7.2024');
    let response=await f.call('/api/people/roi/birthday',{method:'POST',body:{birthday:'20.7.2000',expectedBirthday:person.birthday}});assert.equal(response.status,200);
    f.restart();person=await(await f.call('/api/people/roi')).json();assert.equal(person.birthday,'20.7.2000');assert.equal(person.deathDate,'21.7.2024');
    assert.equal((await f.call('/api/people/roi/birthday',{method:'POST',body:{birthday:'22.7.2024',expectedBirthday:person.birthday}})).status,400);
  }finally{await f.close();}
});
test('calendar API reads edited birthdays, uses Israel holidays and survives the holiday service being unavailable',async()=>{
  const f=fixture();try{
    await f.connect();
    for(const id of ['yehiel','ora']){const person=await(await f.call('/api/people/'+id)).json();assert.equal((await f.call('/api/people/'+id+'/birthday',{method:'POST',body:{birthday:'21.7.1970',expectedBirthday:person.birthday}})).status,200);}
    let response=await f.call('/api/calendar?date=2026-07-02&mode=gregorian');assert.equal(response.status,200);let result=await response.json(),day=result.days.find(day=>day.date==='2026-07-21');
    assert.equal(result.holidaysAvailable,true);assert.deepEqual(day.birthdays.map(person=>person.name).sort(),['אורה פיש','יחיאל קהא'].sort());assert.equal(day.holidays.length,1);assert.equal(day.birthdays[0].age,56);
    response=await f.call('/api/calendar?date=2024-03-25&mode=hebrew');assert.equal(response.status,200);result=await response.json();assert.match(result.label,/אדר/);
    f.env.FAIL_HOLIDAYS=true;result=await(await f.call('/api/calendar?date=2049-07-01')).json();assert.equal(result.holidaysAvailable,false);assert.equal(result.days.find(day=>day.date==='2049-07-21').birthdays.length,2);
    for(const value of ['2026-02-30','bad','1800-01-01'])assert.equal((await f.call('/api/calendar?date='+value)).status,400);
    assert.equal((await f.call('/api/calendar?date=2026-07-01&mode=bad')).status,400);
  }finally{await f.close();}
});

test('Hebrew and English tags resolve to one canonical person and additional names keep their original language',async()=>{
 const f=fixture();try{
  await f.connect();const upload=await f.call('/api/collections/gallery/upload?filename=bilingual.jpg',{method:'POST',body:photo,headers:{'Content-Length':String(photo.length)}});assert.equal(upload.status,201);const item=(await upload.json()).collection.items[0];
  const add=name=>f.call('/api/media/'+item.id+'/tag',{method:'POST',body:{name,tagged:true}});
  let result=await(await add('יחיאל קהא')).json();assert.equal(result.taggedPerson.id,'yehiel');
  result=await(await add('Yehiel Keha')).json();assert.equal(result.taggedPerson.id,'yehiel');assert.equal(result.item.tags.length,1);assert.equal(result.item.tags[0].name,'יחיאל קהא');assert.equal(result.item.tags[0].nameEn,'Yehiel Keha');
  result=await(await add('Camille De Vita')).json();assert.equal(result.taggedPerson.id,'camille');assert.equal((await(await f.call('/api/people/camille')).json()).gallery[0].id,item.id);
  result=await(await add('אורחת חדשה')).json();const guest=result.taggedPerson.id;assert.equal(result.taggedPerson.name,'אורחת חדשה');assert.equal(result.taggedPerson.nameEn,null);
  result=await(await add('A new guest')).json();assert.notEqual(result.taggedPerson.id,guest);assert.equal(result.taggedPerson.name,'A new guest');assert.equal(result.taggedPerson.nameEn,null);
  assert.equal((await(await f.call('/api/tag-people')).json()).people.length,84);
  f.restart();result=await(await f.call('/api/media/'+item.id+'/tags')).json();assert.equal(result.item.tags.find(p=>p.id==='yehiel').nameEn,'Yehiel Keha');assert.equal(result.item.tags.find(p=>p.id===guest).name,'אורחת חדשה');
  const calendar=await(await f.call('/api/calendar?date=2026-11-01&lang=en-GB')).json();assert.equal(calendar.holidaysAvailable,true);assert.match(calendar.hebrewLabel,/Heshvan|Cheshvan|Kislev/);assert.equal(calendar.days.find(d=>d.date==='2026-11-10').holidays[0].name,'Rosh Chodesh Kislev');
  const bootstrap=await(await f.call('/family-data.js')).text();assert.match(bootstrap,/Camille De Vita/);assert.match(bootstrap,/קמיל דה ויטה/);
 }finally{await f.close();}
});

test('new gallery uploads stay first after tagging, caption edits and a durable reload',async()=>{
 const f=fixture();try{
  await f.connect();const files=[];
  for(const name of ['older.jpg','first-new.jpg','second-new.jpg']){
   const response=await f.call('/api/collections/gallery/upload?filename='+name,{method:'POST',body:photo,headers:{'Content-Length':String(photo.length)}});assert.equal(response.status,201);const result=await response.json();files.push(result.file);assert.equal(result.collection.items[0].file,result.file);
  }
  const order=[...files].reverse(),collection=await(await f.call('/api/collections/gallery')).json();assert.deepEqual(collection.items.map(item=>item.file),order);
  const older=collection.items.find(item=>item.file===files[0]);
  assert.equal((await f.call('/api/media/'+older.id+'/tag',{method:'POST',body:{personId:'yehiel',tagged:true}})).status,200);
  assert.equal((await f.call('/api/collections/gallery/caption',{method:'POST',body:{file:older.file,caption:'An older family photo'}})).status,200);
  f.restart();assert.deepEqual((await(await f.call('/api/collections/gallery')).json()).items.map(item=>item.file),order);
 }finally{await f.close();}
});

test('gallery pagination defaults to 100, caps at 500, searches all pages and keeps new uploads first',async()=>{
 const f=fixture();try{
  for(let i=0;i<623;i++){
   const id=i.toString(16).padStart(32,'0'),item={id,category:'gallery',file:id+'.jpg',name:'Photo '+i,caption:i===3?'Unique distant caption':'',mime:'image/jpeg',kind:'photo',key:'gallery/'+id,createdAt:new Date(2026,0,1,0,0,i).toISOString()};
   f.database.prepare('INSERT INTO media(id,category,data) VALUES(?,?,?)').run(id,'gallery',JSON.stringify(item));
  }
  const first=await (await f.call('/api/collections/gallery')).json();assert.equal(first.items.length,100);assert.equal(first.count,623);assert.equal(first.pagination.pages,7);assert.equal(first.items[0].name,'Photo 622');
  const next=await (await f.call('/api/collections/gallery?page=2&size=100')).json();assert.equal(next.items[0].name,'Photo 522');assert.ok(next.items.every(item=>!first.items.some(p=>p.id===item.id)));
  const large=await (await f.call('/api/collections/gallery?page=2&size=500')).json();assert.equal(large.items.length,123);assert.equal(large.pagination.pages,2);
  assert.equal((await f.call('/api/collections/gallery?size=501')).status,400);assert.equal((await f.call('/api/collections/gallery?page=0')).status,400);
  const search=await (await f.call('/api/collections/gallery?q=Unique')).json();assert.equal(search.count,1);assert.equal(search.items[0].name,'Photo 3');
  const tagId=(3).toString(16).padStart(32,'0');f.database.prepare('INSERT INTO media_tags(media_id,person_id) VALUES(?,?)').run(tagId,'yehiel');
  assert.equal((await (await f.call('/api/collections/gallery?q=Yehiel')).json()).count,1);assert.equal((await (await f.call('/api/collections/gallery?q='+encodeURIComponent('יחיאל'))).json()).count,1);
  assert.equal((await (await f.call('/api/collections/gallery?q=%25')).json()).count,0,'Search treats SQL wildcards literally');
  assert.equal((await (await f.call('/api/collections/gallery?page=999')).json()).pagination.page,7);
 }finally{await f.close();}
});
test('editable death dates retain birthday validation, stale checks and saved data through redeployment',async()=>{
 const f=fixture();try{
  await f.connect();const p=await (await f.call('/api/people/roi')).json();
  const r=await f.call('/api/people/roi/death-date',{method:'POST',body:{date:'22.7.2024',expectedDate:p.deathDate}});assert.equal(r.status,200);assert.equal((await r.json()).person.deathDate,'22.7.2024');
  assert.equal((await f.call('/api/people/roi/death-date',{method:'POST',body:{date:'23.7.2024',expectedDate:p.deathDate}})).status,409);
  f.restart();assert.equal((await (await f.call('/api/people/roi')).json()).deathDate,'22.7.2024');assert.match(await f.connect(),/22\.7\.2024/);
  assert.equal((await f.call('/api/people/yehiel/death-date',{method:'POST',body:{date:'22.7.2024',expectedDate:''}})).status,400);
 }finally{await f.close();}
});
test('unchanged gallery polling checks only its revision instead of loading the page again',async()=>{
 const f=fixture();try{
  const first=await f.call('/api/collections/gallery');const tag=first.headers.get('ETag');assert.equal(first.status,200);
  const original=f.storage.sql.exec;let pageReads=0;f.storage.sql.exec=(q,...args)=>{if(q.startsWith('SELECT m.data FROM media m WHERE')||q.startsWith('SELECT count(*) AS n FROM media m WHERE'))pageReads++;return original(q,...args);};
  const unchanged=await f.call('/api/collections/gallery',{headers:{'If-None-Match':tag}});assert.equal(unchanged.status,304);assert.equal(pageReads,0);
  assert.equal((await f.call('/api/collections/gallery?size=500',{headers:{'If-None-Match':tag}})).status,200);assert.ok(pageReads>0);
 }finally{await f.close();}
});

test('personal pages paginate owned and tagged media by type with ten items and no duplicate links',async()=>{
 const f=fixture();try{
  for(let i=1;i<=25;i++){const id=(10000+i).toString(16).padStart(32,'0'),kind=i<=23?'photo':'video',item={id,category:'personal',personId:'yehiel',file:id+'.'+(kind==='photo'?'jpg':'mp4'),name:'Personal '+i,mime:kind==='photo'?'image/jpeg':'video/mp4',kind,createdAt:new Date().toISOString()};f.database.prepare('INSERT INTO media(id,category,person_id,data) VALUES(?,?,?,?)').run(id,'personal','yehiel',JSON.stringify(item));}
  const id=(10001).toString(16).padStart(32,'0');f.database.prepare('INSERT INTO media_tags(media_id,person_id) VALUES(?,?)').run(id,'yehiel');
  const p1=await f.call('/api/people/yehiel/page'),data=await p1.json();assert.equal(data.albums.photos.total,23);assert.equal(data.albums.photos.items.length,10);assert.equal(data.albums.photos.pages,3);assert.equal(data.albums.videos.total,2);assert.equal(data.albums.documents.total,0);assert.equal(data.person.photoCount,23);assert.equal(data.person.gallery,undefined);
  const p2=await (await f.call('/api/people/yehiel/page?photos=2')).json();assert.equal(p2.albums.photos.items.length,10);assert.ok(p2.albums.photos.items.every(item=>!data.albums.photos.items.some(p=>p.id===item.id)));
  const p3=await (await f.call('/api/people/yehiel/page?photos=999')).json();assert.equal(p3.albums.photos.page,3);assert.equal(p3.albums.photos.items.length,3);
  assert.equal((await f.call('/api/people/yehiel/page',{headers:{'If-None-Match':p1.headers.get('ETag')}})).status,304);
  assert.equal((await f.call('/api/people/yehiel/page?photos=-1')).status,400);
 }finally{await f.close();}
});
test('biographies store authored text, reject stale changes, and persist independently of dates and albums',async()=>{
 const f=fixture();try{await f.connect();const first=await f.call('/api/people/yehiel/about',{method:'POST',body:{about:'My story <literal>\nשורה שנייה',expectedAbout:''}});assert.equal(first.status,200);
  assert.equal((await f.call('/api/people/yehiel/about',{method:'POST',body:{about:'stale',expectedAbout:''}})).status,409);
  f.restart();const data=await (await f.call('/api/people/yehiel/page')).json();assert.equal(data.person.about,'My story <literal>\nשורה שנייה');assert.equal(data.albums.photos.total,0);
  assert.equal((await f.call('/api/people/yehiel/about',{method:'POST',body:{about:'x'.repeat(10001),expectedAbout:data.person.about}})).status,400);
  const exported=await (await f.call('/api/export')).json();assert.equal(exported.people.find(p=>p.id==='yehiel').about,data.person.about);
 }finally{await f.close();}
});
test('personal video and document uploads retain ownership, preview passive formats and exclude certificate scans from portraits',async()=>{
 const f=fixture();try{
  await f.connect();const upload=(kind,name,body)=>f.call('/api/people/yehiel/'+kind+'?layout=page&filename='+encodeURIComponent(name),{method:'POST',body,headers:{'Content-Length':String(body.length)}});
  const v=await upload('videos','family.mp4',video);assert.equal(v.status,201);const vids=await v.json();assert.equal(vids.person.videoCount,1);assert.equal(vids.albums.videos.items.length,1);assert.equal(vids.person.gallery,undefined);
  const pdf=new TextEncoder().encode('%PDF-1.7\nExample certificate\n%%EOF'),d=await upload('documents','certificate.pdf',pdf);assert.equal(d.status,201);const doc=await d.json();assert.equal(doc.person.documentCount,1);assert.equal(doc.person.profile,null);
  const item=doc.albums.documents.items[0],download=await f.call(item.src);assert.match(download.headers.get('Content-Disposition'),/^attachment/);
  const inline=await f.call(item.src+'?inline=1');assert.match(inline.headers.get('Content-Disposition'),/^inline/);assert.equal(inline.headers.get('Content-Type'),'application/pdf');
  const scan=await upload('documents','certificate.jpg',photo);assert.equal(scan.status,201);const scanned=await scan.json();assert.equal(scanned.person.documentCount,2);assert.equal(scanned.person.photoCount,0);assert.equal(scanned.person.profile,null);
  assert.equal((await f.call('/api/people/yehiel/profile',{method:'POST',body:{file:scanned.albums.documents.items[0].file}})).status,404);
  assert.equal((await upload('documents','video.mp4',video)).status,415);
  assert.equal((await (await f.call('/api/people/camille/page')).json()).albums.documents.total,0);
 }finally{await f.close();}
});
test('opened-media captions update the shared item and social links expose no storage keys',async()=>{
 const f=fixture();try{
  await f.connect();const uploaded=await (await f.call('/api/collections/gallery/upload?filename=memory.jpg',{method:'POST',body:photo,headers:{'Content-Length':String(photo.length)}})).json(),item=uploaded.collection.items[0];
  const result=await f.call('/api/media/'+item.id+'/caption',{method:'POST',body:{caption:'A <family> & memory',expectedCaption:''}});assert.equal(result.status,200);
  assert.equal((await f.call('/api/media/'+item.id+'/caption',{method:'POST',body:{caption:'stale',expectedCaption:''}})).status,409);
  const view=await (await f.call('/api/media/'+item.id+'/view')).json();assert.equal(view.item.caption,'A <family> & memory');assert.equal(view.item.key,undefined);
  f.env.ASSETS.fetch=async()=>new Response('<html><head><title>Family</title></head><body>Family</body></html>');
  const shared=await f.call('/?media='+item.id+'&lang=en-US'),html=await shared.text();assert.equal(shared.status,200);assert.match(html,/property="og:image"/);assert.match(html,/A &lt;family&gt; &amp; memory/);assert.ok(!html.includes(f.env.HF_SECRET_ACCESS_KEY));
 }finally{await f.close();}
});
test('five explicit birth date corrections apply once and English spellings retain existing tag identities',async()=>{
 const f=fixture();try{
  const dates={avishai:'17.8.1933',shosh:'27.6.1951',mark:'20.1.1951',camille:'20.10.1993',sam:'18.10.1992'};
  for(const [id,date]of Object.entries(dates))assert.equal((await (await f.call('/api/people/'+id)).json()).birthday,date);
  const roster=(await (await f.call('/api/tag-people')).json()).people;for(const [id,name]of Object.entries({itay:'Itai Gandelman',leni:'Leni Gandelman',shay:'Shai Gandelman'}))assert.equal(roster.find(p=>p.id===id).nameEn,name);
  await f.connect();assert.equal((await f.call('/api/people/camille/birthday',{method:'POST',body:{birthday:'21.10.1993',expectedBirthday:dates.camille}})).status,200);f.restart();assert.equal((await (await f.call('/api/people/camille')).json()).birthday,'21.10.1993');
  const cal=await (await f.call('/api/calendar?date=2026-08-01')).json();assert.ok(cal.days.find(day=>day.date==='2026-08-17').birthdays.some(p=>p.id==='avishai'));
 }finally{await f.close();}
});

test('grandparent corrections migrate existing records once and preserve later edits, profiles and removed tags',async()=>{
 const f=fixture();try{
  await f.connect();const item=await taggedUpload(f);await setTags(f,item,['yona']);await setTags(f,item,[]);
  const marker='grandparents-2026-11-03-owner-v1';f.database.prepare('DELETE FROM meta WHERE id=?').run(marker);
  for(const id of ['yona','shlomo']){const p=JSON.parse(f.database.prepare('SELECT data FROM people WHERE id=?').get(id).data);p.birthday='1.1.1111';p.aliyahYear=id==='yona'?1937:1935;p.deathDate=null;f.database.prepare('UPDATE people SET data=? WHERE id=?').run(JSON.stringify(p),id);}
  f.restart();const yona=await(await f.call('/api/people/yona/page')).json(),shlomo=await(await f.call('/api/people/shlomo/page')).json();
  assert.equal(yona.person.birthday,'16.10.1921');assert.equal(yona.person.aliyahYear,1934);assert.equal(yona.person.aliyahMonth,12);assert.equal(shlomo.person.birthday,'1.1.1907');assert.equal(shlomo.person.deathDate,'12.11.1996');assert.equal(shlomo.person.deceased,true);assert.equal(shlomo.person.aliyahYear,1932);
  assert.equal((await(await f.call('/api/media/'+item.id+'/tags')).json()).item.tags.length,0);
  assert.equal((await f.call('/api/people/shlomo/birthday',{method:'POST',body:{birthday:'2.1.1907',expectedBirthday:'1.1.1907'}})).status,200);
  f.restart();assert.equal((await(await f.call('/api/people/shlomo/page')).json()).person.birthday,'2.1.1907');
  const bootstrap=JSON.parse(/window.FAMILY_DATA=(.+);/.exec(await f.connect())[1]);assert.equal(bootstrap.people.yona.aliyahMonth,12);assert.equal(bootstrap.people.shlomo.deceased,true);
 }finally{await f.close();}
});
test('tag batches touch only their image, preserve concurrent selections, are idempotent and return no albums',async()=>{
 const f=fixture();try{
  await f.connect();const a=await taggedUpload(f),b=await taggedUpload(f),patch=(item,changes)=>f.call('/api/media/'+item.id+'/tags/patch',{method:'POST',body:{changes}});
  let r=await patch(a,[{personId:'yona',tagged:true},{personId:'shlomo',tagged:true}]);assert.equal(r.status,200);let result=await r.json();assert.equal(result.collection,undefined);assert.equal(result.people,undefined);assert.deepEqual(result.item.tags.map(p=>p.id),['yona','shlomo']);
  const revision=result.item.tagsRevision;
  result=await(await patch(a,[{personId:'yona',tagged:true}])).json();assert.equal(result.item.tagsRevision,revision);
  await Promise.all([patch(a,[{personId:'yona',tagged:false}]),patch(a,[{personId:'roi',tagged:true}]),patch(b,[{personId:'camille',tagged:true}])]);
  assert.deepEqual((await(await f.call('/api/media/'+a.id+'/tags')).json()).item.tags.map(p=>p.id),['shlomo','roi']);assert.deepEqual((await(await f.call('/api/media/'+b.id+'/tags')).json()).item.tags.map(p=>p.id),['camille']);
  assert.equal((await patch(a,[{personId:'yona',tagged:true},{name:42,tagged:true}])).status,400);assert.ok(!(await(await f.call('/api/media/'+a.id+'/tags')).json()).item.tags.some(p=>p.id==='yona'),'An invalid batch rolls back every change');
  const guest=await(await patch(b,[{key:'new:1',name:'A guest',tagged:true},{key:'new:2',name:'A guest',tagged:true}])).json();assert.equal(guest.taggedPeople[0].id,guest.taggedPeople[1].id);assert.equal(guest.item.tags.length,2);
  assert.equal((await patch(b,[{personId:'camille',tagged:false}])).status,200);f.restart();assert.ok(!(await(await f.call('/api/media/'+b.id+'/tags')).json()).item.tags.some(p=>p.id==='camille'));
 }finally{await f.close();}
});
test('tagging stays small with thousands of unrelated images, and unchanged people refreshes read no albums',async()=>{
 const f=fixture();try{
  await f.connect();const item=await taggedUpload(f);
  const insert=f.database.prepare('INSERT INTO media(id,category,person_id,data) VALUES(?,?,?,?)'),tag=f.database.prepare('INSERT INTO media_tags(media_id,person_id) VALUES(?,?)');
  f.database.exec('BEGIN');for(let n=1000;n<4000;n++){const id=n.toString(16).padStart(32,'0');insert.run(id,'gallery',null,JSON.stringify({id,category:'gallery',file:id+'.jpg',mime:'image/jpeg',kind:'photo',name:'Memory'}));tag.run(id,'yehiel');}f.database.exec('COMMIT');
  const original=f.storage.sql.exec;let rows=0,queries=0;f.storage.sql.exec=(q,...args)=>{const result=original(q,...args);rows+=result.toArray().length;queries++;return result;};
  const response=await f.call('/api/media/'+item.id+'/tags/patch',{method:'POST',body:{changes:[{personId:'camille',tagged:true}]}});assert.equal(response.status,200);const body=await response.text();assert.ok(body.length<2000,body.length);assert.ok(rows<30,'Tagging read '+rows+' returned rows across '+queries+' queries');
  const first=await f.call('/api/media'),etag=first.headers.get('ETag');assert.equal(first.status,200);rows=0;queries=0;
  assert.equal((await f.call('/api/media',{headers:{'If-None-Match':etag}})).status,304);assert.equal(rows,0);assert.equal(queries,0);
  rows=0;const script=await f.connect();assert.match(script,/window.FAMILY_DATA_AVAILABLE=true/);assert.ok(rows<150,'Bootstrap must not load media or tags');
 }finally{await f.close();}
});
test('the family tree still receives valid JavaScript when database reads are unavailable',async()=>{
 const f=fixture();try{
  f.env.FAMILY_STATE.get=()=>({fetch:async()=>Response.json({error:'Unavailable'},{status:503})});
  const response=await f.call('/family-data.js');assert.equal(response.status,200);assert.match(response.headers.get('Content-Type'),/javascript/);const script=await response.text();assert.match(script,/window.FAMILY_DATA_AVAILABLE=false/);assert.match(script,/16\.10\.1921/);assert.match(script,/12\.11\.1996/);
 }finally{await f.close();}
});
test('daily storage limits reach the maintenance screen without exposing internal errors',async()=>{
 const f=fixture();try{
  const initial=await f.call('/api/health');assert.equal(initial.status,200);assert.deepEqual(await initial.json(),{available:true});
  f.env.FAMILY_STATE.get=()=>({fetch:async()=>fail(new Error('SQLITE_ERROR: rows read limit exceeded for this account'))});
  const limited=await f.call('/api/health');assert.equal(limited.status,503);assert.equal(limited.headers.get('X-Family-Storage-Limit'),'daily');const body=await limited.json();assert.equal(body.code,'DAILY_STORAGE_LIMIT');assert.ok(!body.error.includes('SQLITE'));
  assert.equal((await f.call('/api/setup')).status,200,'Configuration alone does not prove the database has recovered');
  f.env.FAMILY_STATE.get=()=>({fetch:async()=>{throw new Error('Durable Object storage daily read limit reached');}});
  assert.equal((await f.call('/api/health')).status,503,'Constructor failures must also be classified');
  f.env.FAMILY_STATE.get=()=>({fetch:async()=>{throw new Error('Unexpected query failure');}});const unrelated=await f.call('/api/health');assert.equal(unrelated.status,500);assert.equal(unrelated.headers.get('X-Family-Storage-Limit'),null);
 }finally{await f.close();}
});
test('Mila birthday correction keeps the stored year, applies once and does not invent an unknown year',async()=>{
 const f=fixture();try{
  const marker='birthday-mila-2026-11-03-owner-v1';assert.equal(f.database.prepare('SELECT value FROM meta WHERE id=?').get(marker),undefined);
  const person=JSON.parse(f.database.prepare('SELECT data FROM people WHERE id=?').get('mila').data);person.birthday='7.9.2022';person.about='A saved biography';f.database.prepare('UPDATE people SET data=? WHERE id=?').run(JSON.stringify(person),'mila');
  f.restart();let result=await(await f.call('/api/people/mila/page')).json();assert.equal(result.person.birthday,'9.7.2022');assert.equal(result.person.about,'A saved biography');
  const revision=result.person.revision;f.restart();result=await(await f.call('/api/people/mila/page')).json();assert.equal(result.person.revision,revision);
  await f.connect();assert.equal((await f.call('/api/people/mila/birthday',{method:'POST',body:{birthday:'10.7.2022',expectedBirthday:'9.7.2022'}})).status,200);f.restart();assert.equal((await(await f.call('/api/people/mila/page')).json()).person.birthday,'10.7.2022');
 }finally{await f.close();}
});
