import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile} from 'node:fs/promises';
import worker,{FamilyState,PUBLIC_WRITE_TOKEN} from '../src/worker.mjs';
import {NAKASH_WRITE_TOKEN,nakashHTML} from '../src/nakash-shell.mjs';
import {extendedKehaHTML} from '../src/extended-keha.mjs';
import {familyApp} from '../family-apps/worker.mjs';
import {MISATTRIBUTED_YONA_DOCUMENT,UNVERIFIED_YONA_MARRIAGE_DOCUMENT,UNATTRIBUTED_KEHAT_REGISTER,contentContext,storyInContext} from '../src/family-content.mjs';
import {parseHTML} from 'linkedom';
import {KEHAT_DOCUMENTS} from '../src/kehat-documents.mjs';
import {ALIYAH_MEMORY_ID} from '../src/memories.mjs';
import {sha256} from '../src/http.mjs';
import {nameCorrectionKey} from '../src/name-corrections.mjs';
const researchIds=new Set(KEHAT_DOCUMENTS.map(item=>item.id));
const addedItems=result=>result.items.filter(item=>!researchIds.has(item.id));
async function ownerPassword(f){
  const setupKey='2'.repeat(64);f.state.env.FAMILY_AI_REMOVAL_SETUP_DIGEST=await sha256(setupKey);
  await f.json('/api/family-ai/removal/setup',{method:'POST',body:{setupKey,password:'archive-owner-test'}});
}

const scope=(branch,path)=>['extended','shlomo','zechariah','zechariah-tzadok','kehat'].includes(branch)?'/keha-extended/'+(branch==='extended'?'':branch+'/')+'api/compat/api/'+path:'/nakash/api/compat/'+branch+'/api/'+path;
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
    const id=more.id||(serial++).toString(16).padStart(32,'0');
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

test('the shared Shori correction updates existing profiles, captions and research notes without changing IDs or portraits',async()=>{
  const f=fixture();try{
    await f.json(scope('extended','tag-people'));
    const id='kehat-shori',person=f.state.person(id);
    f.sql.prepare('UPDATE people SET data=? WHERE id=?').run(JSON.stringify({...person,name:'סורי קהת',nameEn:'Suri Kehat',englishName:'Suri Kehat',birthday:'2.3.1930',about:'סורי עם יהודית',researchNotes:'יהודית וסורי הן אחיות',profileId:'kept-shori-portrait'}),id);
    const image=f.media(id,{tags:[id],caption:'סורי קהת',key:'originals/סורי.jpg'});
    f.sql.prepare('DELETE FROM meta WHERE id=?').run(nameCorrectionKey);f.restart();
    for(const branch of ['extended','zechariah-tzadok']){
      const page=await f.json(scope(branch,'people/'+id+'/page'));
      assert.equal(page.person.id,id);assert.equal(page.person.name,'שורי קהת');assert.equal(page.person.nameEn,'Shori Kehat');assert.equal(page.person.birthday,'2.3.1930');assert.equal(page.person.about,'שורי עם יהודית');
      const roster=await f.json(scope(branch,'tag-people'));assert.equal(roster.people.find(person=>person.id===id).name,'שורי קהת');
    }
    const saved=f.state.person(id);assert.equal(saved.profileId,'kept-shori-portrait');assert.equal(saved.researchNotes,'יהודית ושורי הן אחיות');
    assert.equal(f.state.media(image.id).caption,'שורי קהת');assert.equal(f.state.media(image.id).key,'originals/סורי.jpg');assert.deepEqual(f.state.tagIds(image.id),[id]);
    f.restart();assert.equal((await f.json('/api/people/'+id+'/page')).person.name,'שורי קהת');
  }finally{f.close();}
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

test('the aliyah collection survives a category change and restart as one editable memory',async()=>{
  const f=fixture();try{
    const story=(await f.json('/api/stories')).stories.find(item=>item.id===ALIYAH_MEMORY_ID);
    assert.equal(story.category,'roots');assert.equal(story.filmCollection,'aliyah');
    const changed=await f.json('/api/stories/'+story.id+'/category',{method:'POST',body:{category:'family',expectedUpdatedAt:story.updatedAt}});
    assert.equal(changed.story.filmCollection,'aliyah');
    f.restart();
    const matches=(await f.json('/api/stories')).stories.filter(item=>item.filmCollection==='aliyah');
    assert.equal(matches.length,1);assert.equal(matches[0].category,'family');
    assert.deepEqual(matches[0].personIds,['shlomo','yona']);
    const result=(await f.json('/api/search?type=story&q='+encodeURIComponent('מן ההרים אל רחובות'))).items.find(row=>row.id===story.id);
    assert.equal(result.href,'#stories/'+story.id);
  }finally{f.close();}
});

test('archive tags classify existing scans, persist manual changes and respect each family scope',async()=>{
  const f=fixture();try{
    const labels=['נישואי יעקב ויהודית','מצבת אהרון','תעודת העלייה של יונה','תעודת פטירה - שלמה','מסמך מקרקעין'];
    const ids=labels.map(name=>f.media('yona',{type:'document',name}).id);
    const items=await f.json('/api/documents');
    assert.deepEqual(ids.map(id=>items.items.find(item=>item.id===id).documentCategory),['marriage','graves','aliyah','death','other']);
    assert.deepEqual(items.categories.map(c=>c.he),['תעודות נישואין','קברים','תעודות עליה','תעודות פטירה','אחר']);
    const change={method:'POST',body:{category:'death',expectedCategory:'other'}};
    const route='documents/'+ids[4]+'/category';
    assert.equal((await f.call(scope('haim',route),change)).status,404);
    await f.json(scope('keha',route),change);f.restart();
    assert.equal((await f.json('/api/documents')).items.find(item=>item.id===ids[4]).documentCategory,'death');
    assert.equal((await f.call('/api/'+route,{method:'POST',body:{category:'graves',expectedCategory:'other'}})).status,409);
    assert.equal((await f.call('/api/'+route,{method:'POST',body:{category:'invalid',expectedCategory:'death'}})).status,400);
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
    const kehat=await f.json(scope('kehat','documents'));assert.deepEqual(kehat.items,[]);
    const tzadok=await f.json(scope('zechariah-tzadok','documents'));assert.deepEqual(tzadok.items.map(d=>d.id),[father.id]);
    assert.ok((await f.json(scope('keha','documents'))).items.some(d=>d.id===yona.id));
    assert.equal((await f.json(scope('haim','documents'))).items.length,0);
  }finally{f.close();}
});

test('public family profiles keep founder and child photos and portraits while younger albums and selections stay empty',async()=>{
  const f=fixture();try{
    await f.json(scope('extended','tag-people'));
    const younger=f.media('eldad');const child=f.media('ora',{tags:['ora']});const grandfather=f.media('shlomo',{tags:['eldad']});
    const original=await f.json('/api/people/eldad/page');assert.equal(original.albums.photos.total,2);
    for(const branch of ['keha','extended']){
      const page=await f.json(scope(branch,'people/eldad/page'));assert.equal(page.albums.photos.total,0);assert.equal(page.person.photoCount,0);assert.ok(page.person.profile);
      assert.deepEqual((await f.json(scope(branch,'people/eldad/selection?kind=photos'))).ids,[]);
      assert.equal((await f.json(scope(branch,'people/ora/page'))).albums.photos.total,1);
      assert.equal((await f.json(scope(branch,'people/shlomo/page'))).albums.photos.total,1);
      const gallery=await f.json(scope(branch,'collections/gallery?size=all'+(branch==='extended'?'&generation=second':'')));assert.ok(!gallery.items.some(item=>item.id===younger.id));assert.ok(gallery.items.some(item=>item.id===child.id));assert.equal(gallery.items.some(item=>item.id===grandfather.id),branch!=='extended');
    }
    for(const branch of ['haim','yehuda','medina','kehat','zechariah'])assert.equal((await f.json(scope(branch,'collections/gallery?size=all'))).items.length,0,'unrelated galleries do not import the original family photos');
    assert.equal((await f.call('/media/'+younger.id,{headers:{'X-Family-Content-Scope':'shlomo'}})).status,404);
    assert.equal((await f.call('/media/'+younger.id+'?portrait=eldad',{headers:{'X-Family-Content-Scope':'shlomo'}})).status,404);
    assert.equal((await f.call('/media/'+younger.id+'?portrait=ora',{headers:{'X-Family-Content-Scope':'shlomo'}})).status,404);
  }finally{f.close();}
});

test('extended gallery excludes every younger generation even in founder group photos and explicitly shared uploads',async()=>{
  const f=fixture();try{
    await f.json(scope('extended','tag-people'));
    const founder=f.media('eldad',{category:'gallery',tags:['shlomo','yona']});
    const child=f.media('ora',{category:'gallery',tags:['ora']});
    const otherBranch=f.media('kehat-naomi',{tags:['kehat-naomi']});
    const hidden=[
      f.media('shlomo',{category:'gallery',tags:['shlomo','eldad']}),
      f.media(null,{category:'nakash:extended',tags:['amit'],familyScopes:['extended']}),
      f.media(null,{category:'nakash:kehat',tags:['kehat-naomi','rami']}),
      f.media('eldad',{category:'nakash:extended'}),
    ];
    const gallery=await f.json(scope('extended','collections/gallery?size=all&generation=second'));
    const expected=new Set([founder.id,child.id,otherBranch.id]);
    assert.deepEqual(new Set(gallery.items.map(item=>item.id)),expected);
    assert.equal(gallery.count,3);assert.equal(gallery.filterCounts.all,3);
    assert.deepEqual(new Set((await f.json(scope('extended','gallery/selection?generation=second'))).ids),expected);
    assert.equal((await f.json(scope('extended','collections/gallery?person=eldad'))).count,0);
    assert.equal((await f.json(scope('extended','collections/gallery?unit=u-eldad'))).count,0);
    for(const branch of ['original','keha']){
      const path=branch==='original'?'/api/collections/gallery?size=all':scope(branch,'collections/gallery?size=all');
      assert.ok((await f.json(path)).items.some(item=>item.id===hidden[0].id));
    }
    for(const item of hidden)assert.equal((await f.call('/media/'+item.id)).status,200,'Original files are retained');
    await f.json('/api/media/'+founder.id+'/tags/patch',{method:'POST',body:{changes:[{personId:'eldad',tagged:true}]}});
    const tagged=await f.json(scope('extended','collections/gallery?size=all&generation=second'));
    assert.equal(tagged.count,2);assert.ok(!tagged.items.some(item=>item.id===founder.id));
    await f.json('/api/media/'+founder.id+'/tags/patch',{method:'POST',body:{changes:[{personId:'eldad',tagged:false}]}});
    assert.equal((await f.json(scope('extended','collections/gallery?size=all&generation=second'))).count,3);
    f.restart();assert.equal((await f.json(scope('extended','collections/gallery?size=all&generation=second'))).count,3);
  }finally{f.close();}
});

test('the shared archive starts with tagged pre-1940 people and reveals only their next generation on request',async()=>{
  const f=fixture();try{
    await f.json(scope('extended','tag-people'));
    const photo=(tags,more={})=>f.media(null,{category:'nakash:extended',tags,...more});
    const grandparents=photo(['shlomo','yona']);
    const avishai=photo(['avishai']);
    const ruti=photo(['ruti']);
    const parents=photo(['yehiel','ora']);
    const mixed=photo(['yona','ruti']);
    const grandchild=photo(['shlomo','eldad']);
    const untagged=photo([],{faceSummary:{reviewed:true}});
    const late=photo(['tri-hana']);
    const unsupported=photo(['saadia-ronit']);
    const first=await f.json(scope('extended','collections/gallery?size=all'));
    assert.deepEqual(new Set(first.items.map(item=>item.id)),new Set([grandparents.id,avishai.id]));
    assert.equal(first.pagination.generation,'first');assert.equal(first.filterCounts.untagged,0);
    const second=await f.json(scope('extended','collections/gallery?size=all&generation=second'));
    assert.deepEqual(new Set(second.items.map(item=>item.id)),new Set([grandparents.id,avishai.id,ruti.id,parents.id,mixed.id,late.id]));
    assert.equal(second.pagination.generation,'second');
    assert.deepEqual(new Set((await f.json(scope('extended','gallery/selection?generation=second'))).ids),new Set(second.items.map(item=>item.id)));
    for(const suffix of ['&generation=all','&generation=third','&person=ruti'])assert.deepEqual(new Set((await f.json(scope('extended','collections/gallery?size=all'+suffix))).items.map(item=>item.id)),suffix.includes('person=')?new Set():new Set([grandparents.id,avishai.id]));
    for(const item of [grandchild,untagged,unsupported])assert.ok(!second.items.some(found=>found.id===item.id));
    const empty=await f.json(scope('extended','collections/gallery?filter=untagged&generation=second'));assert.equal(empty.count,0);
    assert.equal((await f.json(scope('extended','collections/photos'))).count,2,'The main-page slideshow uses the first generation as well');
    await f.json('/api/media/'+grandparents.id+'/tags/patch',{method:'POST',body:{changes:[{personId:'ora',tagged:true}]}});
    assert.equal((await f.json(scope('extended','collections/gallery?size=all'))).count,1);
    assert.equal((await f.json(scope('extended','collections/gallery?size=all&generation=second'))).count,6);
    f.restart();assert.equal((await f.json(scope('extended','collections/gallery?size=all'))).count,1);
  }finally{f.close();}
});

test('Shlomo lite shares only reviewed, explicitly tagged founders and children across galleries, profiles, search and direct files',async()=>{
  const f=fixture();try{
    await f.json(scope('shlomo','tag-people'));
    const review=item=>f.state.run('media.face.review',{id:item.id,photoRevision:item.photoRevision||'original',tagsRevision:f.state.tagsRevision(item.id),complete:true});
    const photo=(owner,tags,more={})=>f.media(owner,{category:'gallery',tags,name:'lite-privacy-probe',...more});
    const shared=photo('shlomo',['shlomo','yona','ora']);review(shared);
    const child=f.media('ora',{tags:['ora'],name:'lite-privacy-probe'});review(child);
    const partial=photo('shlomo',['shlomo']);
    const untagged=photo('shlomo',[]);review(untagged);
    const mixed=photo('shlomo',['shlomo','eldad']);review(mixed);
    const ownedElsewhere=photo('eldad',['shlomo']);review(ownedElsewhere);
    const stale=photo('yona',['yona'],{faceSummary:{reviewed:true}});
    const scopedOnly=photo(null,[],{category:'nakash:shlomo',familyScopes:['shlomo']});
    const younger=f.media('eldad',{tags:['eldad']});review(younger);
    const blocked=[partial,untagged,mixed,stale,scopedOnly,younger];
    const gallery=await f.json(scope('shlomo','collections/gallery?size=all'));
    assert.deepEqual(new Set(gallery.items.map(item=>item.id)),new Set([shared.id,ownedElsewhere.id]),'Explicit face tags determine subjects, rather than album ownership');
    assert.equal(gallery.filterCounts.complete,2);assert.equal(gallery.filterCounts.partial,0);assert.equal(gallery.filterCounts.untagged,0);
    assert.match(gallery.items[0].src,/familyScope=shlomo/);
    assert.deepEqual(new Set((await f.json(scope('shlomo','gallery/selection'))).ids),new Set([shared.id,ownedElsewhere.id]));
    const album=await f.json(scope('shlomo','people/ora/page?photosSize=all'));
    assert.deepEqual(new Set(album.albums.photos.items.map(item=>item.id)),new Set([shared.id,child.id]));
    assert.equal(album.person.profileMediaId,child.id);
    assert.equal((await f.json(scope('shlomo','people/shlomo/page'))).person.photoCount,2);
    const hidden=await f.json(scope('shlomo','people/eldad/page'));
    assert.equal(hidden.person.profile,null);assert.equal(hidden.person.photoCount,0);assert.equal(hidden.albums.photos.total,0);
    assert.deepEqual((await f.json(scope('shlomo','people/eldad/selection?kind=photos'))).ids,[]);
    const script=await (await f.call('/keha-extended/shlomo/site-data.js')).text();
    const initial=JSON.parse(script.split('\n')[0].slice('window.FAMILY_DATA='.length,-1));
    assert.equal(initial.people.eldad.profile,null);assert.equal(initial.people.ora.profileMediaId,child.id);
    const roster=await f.json(scope('shlomo','tag-people'));
    assert.equal(roster.people.find(p=>p.id==='eldad').profile,null);
    const search=await f.json(scope('shlomo','search?q=lite-privacy-probe'));
    assert.deepEqual(new Set(search.items.filter(item=>item.media).map(item=>item.id)),new Set([shared.id,ownedElsewhere.id]));
    for(const item of blocked){
      assert.equal((await f.call('/media/'+item.id+'?familyScope=shlomo')).status,404,item.id);
      assert.equal((await f.call('/media/'+item.id+'?familyScope=shlomo&thumbnail=1&portrait=eldad')).status,404,item.id);
      assert.equal((await f.call(scope('shlomo','media/'+item.id+'/view'))).status,404,item.id);
    }
    assert.equal((await f.call('/media/'+child.id+'?portrait=ora&familyScope=shlomo')).status,200);
    assert.equal((await f.call('/media/'+child.id+'?version='+'a'.repeat(32)+'&familyScope=shlomo')).status,404,'A review of the current image does not authorize earlier image versions');
    assert.equal((await f.call('/nakash/api/profile-photo/eldad',{headers:{'X-Family-Content-Scope':'shlomo'}})).status,404);
    assert.equal((await f.call(scope('shlomo','people/ora/profile'),{method:'POST',body:{file:mixed.id}})).status,404);
    const original=await f.json('/api/people/eldad/page');assert.ok(original.person.profile);assert.ok(original.albums.photos.total>0);
    const changed=await f.json(scope('shlomo','people/ora/birthday'),{method:'POST',body:{birthday:'2.3.1950',expectedBirthday:album.person.birthday}});
    assert.equal(changed.person.photoCount,2);assert.deepEqual(changed.person.gallery,[]);
    await f.json('/api/media/'+shared.id+'/tags/patch',{method:'POST',body:{changes:[{personId:'eldad',tagged:true}]}});
    assert.equal((await f.json(scope('shlomo','collections/gallery?size=all'))).count,1);
    review(shared);assert.equal((await f.json(scope('shlomo','collections/gallery?size=all'))).count,1,'Full review cannot override an outsider tag');
    await f.json('/api/media/'+shared.id+'/tags/patch',{method:'POST',body:{changes:[{personId:'eldad',tagged:false}]}});
    assert.equal((await f.json(scope('shlomo','collections/gallery?size=all'))).count,1,'A changed tag set needs a fresh full review');
    review(shared);assert.equal((await f.json(scope('shlomo','collections/gallery?size=all'))).count,2);
    f.restart();assert.equal((await f.json(scope('shlomo','collections/gallery?size=all'))).count,2);
    assert.ok((await f.json('/api/collections/gallery?size=all')).items.some(item=>item.id===mixed.id),'Original media is retained');
  }finally{f.close();}
});

test('Shlomo lite stories select only Shlomo and cannot create or edit memories about anyone else',async()=>{
  const f=fixture();try{
    const save=personIds=>f.json('/api/stories',{method:'POST',body:{title:'Existing memory',body:'A family account',category:'roots',personIds}});
    const father=await save(['shlomo']),mother=await save(['yona']),mixed=await save(['shlomo','yona']),unknown=await save([]);
    const before=await f.json('/api/stories');
    const stories=await f.json(scope('shlomo','stories'));
    assert.deepEqual(stories.stories.map(item=>item.id),[father.story.id]);
    assert.deepEqual(stories.allowedPersonIds,['shlomo']);
    for(const personIds of [[],['yona'],['ora'],['shlomo','yona']])assert.equal((await f.call(scope('shlomo','stories'),{method:'POST',body:{title:'Not permitted',body:'Not a Shlomo story',personIds}})).status,400);
    for(const item of [mother,mixed,unknown])assert.equal((await f.call(scope('shlomo','stories/'+item.story.id),{method:'POST',body:{title:'Do not change',body:'Other family story',personIds:['shlomo'],expectedUpdatedAt:item.story.updatedAt}})).status,404);
    assert.deepEqual((await f.json('/api/stories')).stories,before.stories,'Reading and rejecting writes leave all existing stories unchanged');
    const created=await f.json(scope('shlomo','stories'),{method:'POST',body:{title:'A Shlomo memory',body:'About Shlomo',personIds:['shlomo']}});
    assert.ok((await f.json(scope('shlomo','stories'))).stories.some(item=>item.id===created.story.id));
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

test('the deployed Jimaan family drops the register household and fixes stored captions without losing scans or portraits',async()=>{
  const f=fixture();
  try{
    await f.json(scope('kehat','documents'));
    const retired=['kehat-shlomo','kehat-shlomo-sarah','kehat-esther'];
    const names=['שלמה קהת','שרה קהת','אסתר קהת'];
    for(const [index,id] of retired.entries()){
      const person={id,name:names[index],extra:true,extendedKeha:true,familyApps:['kehat'],unit:'u-kehat-shlomo'};
      f.sql.prepare('INSERT INTO people(id,data) VALUES(?,?)').run(id,JSON.stringify(person));
    }
    const scan=f.media(retired[0],{id:UNATTRIBUTED_KEHAT_REGISTER,type:'document',name:'שלמה, שרה ואסתר קהת',documentPeople:retired,familyScopes:['kehat'],tags:retired});
    const father=f.state.person('kehat-jidaan'),daughter=f.state.person('kehat-yehudit');
    Object.assign(father,{name:'סעדיה (ג׳ידעאן) בן אהרון קהא',nameEn:'Saadia (Jidaan) Keha',aliases:["ג'ידען קהא",'גידעאן קהא'],researchNotes:'בנו של אהרון ואביהם של שלמה, יעקב, זכריה ואהרון מנישואיו הראשונים לשושנה.',profileId:'our-portrait'});
    f.state.savePerson(father);
    daughter.researchNotes='השם יהודית הופיע בין ילדי סעדיה בתרשים המוקדם, אך לא אושר בתרשים המאוחר.';f.state.savePerson(daughter);
    const other=f.media(father.id,{type:'document',name:'תעודה על ג׳ידעאן',caption:"על ג'ידען ושושנה",tags:[father.id]});
    f.sql.prepare('DELETE FROM meta WHERE id IN (?,?,?)').run('names-jimaan-2026-11-22-v1','kehat-jimaan-children-2026-11-22-v1','family-content-kehat-register-unattributed-2026-11-22-v1');
    f.restart();
    for(const branch of ['kehat','extended']){
      const {people}=await f.json(scope(branch,'tag-people'));
      assert.ok(retired.every(id=>!people.some(p=>p.id===id)));
      const current=people.find(p=>p.id===father.id);
      assert.match(current.name,/ג׳ימעאן/);assert.match(current.nameEn,/Jimaan/);
      assert.match(current.researchNotes,/אהרון \(הבכור\), זכריה, יהודית ויעקב/);
      assert.ok(current.aliases.every(alias=>!alias.includes('ידע')));
      assert.match(people.find(p=>p.id===daughter.id).researchNotes,/גיסתה יהודית בת זכריה בן צדוק/);
      const docs=(await f.json(scope(branch,'documents'))).items;
      assert.ok(!docs.some(d=>d.id===scan.id));
      assert.equal(docs.find(d=>d.id===other.id).caption,'על ג׳ימעאן ושושנה');
      assert.equal((await f.call(scope(branch,'people/kehat-shlomo/page'))).status,404);
    }
    assert.equal((await f.call('/api/people/kehat-shlomo/page')).status,404);
    const search=await f.json('/api/search?q='+encodeURIComponent('שלמה קהת'));
    assert.ok(!search.items.some(item=>retired.includes(item.id)||item.id===scan.id));
    const filed=f.state.media(scan.id);
    assert.equal(filed.category,'research:unattributed');assert.equal(filed.key,scan.key);
    assert.deepEqual(f.state.tagIds(scan.id),[]);assert.equal(filed.documentPeople,undefined);
    assert.equal(f.state.person(father.id).profileId,'our-portrait');
    const corrected=f.state.person(daughter.id);corrected.about='זיכרון משפחתי';f.state.savePerson(corrected);
    f.restart();assert.equal(f.state.media(scan.id).modifiedAt,filed.modifiedAt);
    assert.equal(f.state.person(daughter.id).about,corrected.about);
  }finally{f.close();}
});

test('H72727 loses its unverified Shlomo attribution in existing deployments while the scan and confirmed records survive',async()=>{
  const f=fixture();try{
    await f.json(scope('extended','tag-people'));
    const confirmed=f.media('kehat-yaakov',{type:'document',name:'תעודת הנישואין של יעקב'});
    const tri=f.media('tri-yona',{type:'document',name:'יונה וזכריה · פרס ילודה'});
    const grandma=f.media('yona',{type:'document',name:'תעודת העלייה של יונה נקאש קהא'});
    const item={id:UNVERIFIED_YONA_MARRIAGE_DOCUMENT,category:'personal',personId:'kehat-shlomo',documentPeople:['kehat-shlomo'],familyScopes:['kehat'],kind:'document',mime:'image/jpeg',key:'documents/original-H72727.jpg',filename:'Yona_bat_Shlomo_and_Sarah_marriage_1945_H72727.jpeg',name:'נישואי יונה קהא, בת שלמה ושרה — 5.3.1945',caption:'Original certificate description',createdAt:'2026-11-21T03:56:14.158Z',size:73049};
    f.sql.prepare('INSERT INTO media(id,category,person_id,data) VALUES(?,?,?,?)').run(item.id,item.category,item.personId,JSON.stringify(item));
    f.sql.prepare('INSERT INTO media_tags(media_id,person_id) VALUES(?,?)').run(item.id,'kehat-shlomo');
    f.sql.prepare('INSERT INTO media_collections(media_id,collection,added_at) VALUES(?,?,?)').run(item.id,'nakash:kehat',item.createdAt);
    const migration='family-content-yona-h72727-unattributed-2026-11-21-v1';
    // The old inheritance correction has already run on the live deployment.
    assert.ok(f.sql.prepare('SELECT id FROM meta WHERE id=?').get('family-content-attribution-2026-11-21-v1'));
    f.sql.prepare('DELETE FROM meta WHERE id=?').run(migration);f.restart();
    for(const branch of ['kehat','extended','zechariah','zechariah-tzadok','shlomo']){
      assert.equal((await f.json(scope(branch,'documents'))).items.some(d=>d.id===item.id),false,branch);
    }
    assert.equal((await f.json('/api/documents')).items.some(d=>d.id===item.id),false);
    for(const path of ['/api/people/kehat-yaakov/page',scope('kehat','people/kehat-yaakov/page'),scope('extended','people/kehat-yaakov/page')]){
      const page=await f.json(path);assert.equal(page.albums.documents.total,1,path);assert.equal(page.person.documentCount,1,path);
    }
    assert.ok((await f.json(scope('kehat','documents'))).items.some(d=>d.id===confirmed.id));
    assert.ok((await f.json(scope('kehat','documents'))).items.some(d=>d.id===tri.id));
    assert.ok((await f.json('/api/documents')).items.some(d=>d.id===grandma.id));
    const saved=f.state.media(item.id);
    for(const key of ['id','key','filename','mime','size','caption'])assert.equal(saved[key],item[key],key);
    assert.equal(saved.category,'research:unattributed');assert.equal(saved.archiveExcluded,true);
    for(const key of ['personId','people','personIds','documentPeople','familyScopes'])assert.equal(saved[key],undefined,key);
    assert.deepEqual(f.state.tagIds(item.id),[]);
    assert.equal(f.sql.prepare('SELECT person_id FROM media WHERE id=?').get(item.id).person_id,null);
    assert.equal(f.sql.prepare('SELECT count(*) AS n FROM media_collections WHERE media_id=?').get(item.id).n,0);
    assert.equal(f.sql.prepare('SELECT count(*) AS n FROM media_trash WHERE id=?').get(item.id).n,0);
    const backup=f.sql.prepare('SELECT value FROM meta WHERE id=?').get(migration+':backup').value;
    assert.deepEqual(JSON.parse(backup),item);
    assert.deepEqual(JSON.parse(f.sql.prepare('SELECT value FROM meta WHERE id=?').get(migration+':tags').value),['kehat-shlomo']);
    assert.equal(JSON.parse(f.sql.prepare('SELECT value FROM meta WHERE id=?').get(migration+':collections').value)[0].collection,'nakash:kehat');
    f.restart();await f.json(scope('kehat','documents'));
    assert.equal(f.sql.prepare('SELECT value FROM meta WHERE id=?').get(migration+':backup').value,backup);
    assert.equal(f.state.media(item.id).modifiedAt,saved.modifiedAt);
    assert.equal(f.objects.size,0);
  }finally{f.close();}
});

test('documents upload original PDF and audio bytes once and share their subjects across the right archives',async()=>{
  const f=fixture();try{
    const upload=async(branch,filename,bytes,personIds)=>f.json(branch==='original'?'/api/documents/upload?filename='+filename:scope(branch,'documents/upload?filename='+filename),{method:'POST',body:bytes,headers:{'Content-Length':String(bytes.length),'X-Family-Document':encodeURIComponent(JSON.stringify({title:'תיעוד מהמשפחה',caption:'המקור ללא שינוי',personIds}))}});
    const pdf=new TextEncoder().encode('%PDF-1.4\nOriginal certificate\n%%EOF');
    await upload('original','certificate.pdf',pdf,['shlomo','yona']);
    assert.equal((await f.json('/api/documents')).items.length,1);assert.equal(addedItems(await f.json(scope('extended','documents'))).length,1);assert.equal((await f.json(scope('keha','documents'))).items.length,1);
    const mp3=new TextEncoder().encode('ID3\x04\0\0original audio');await upload('kehat','rare.mp3',mp3,['kehat-jidaan']);
    assert.ok((await f.json(scope('kehat','documents'))).items.some(item=>item.kind==='audio'));
    assert.ok((await f.json(scope('extended','documents'))).items.some(item=>item.kind==='audio'));
    assert.equal((await f.json('/api/documents')).items.length,1);
    assert.deepEqual([...f.objects.values()].map(v=>[...v]),[[...pdf],[...mp3]]);
  }finally{f.close();}
});

test('password protection covers archive and album routes, and removed records stay removed after restart',async()=>{
  const f=fixture();try{
    await f.json(scope('kehat','documents'));await ownerPassword(f);
    const record=f.media('kehat-havazelet',{type:'document',name:'A family record',tags:['kehat-yaakov','kehat-yaakov-yehudit']});
    for(const password of [undefined,'incorrect'])assert.equal((await f.call(scope('kehat','documents/'+record.id+'/delete'),{method:'POST',body:{password}})).status,401);
    const scopeValue='personal:kehat-havazelet';
    assert.equal((await f.call('/api/media/'+record.id+'/delete',{method:'POST',body:{scope:scopeValue}})).status,401);
    assert.equal((await f.call(scope('kehat','media/'+record.id+'/delete'),{method:'POST',body:{scope:scopeValue}})).status,401);
    assert.equal((await f.call(scope('haim','documents/'+record.id+'/delete'),{method:'POST',body:{password:'archive-owner-test'}})).status,404);
    assert.equal((await f.json(scope('kehat','documents'))).items.some(item=>item.id===record.id),true);
    await f.json(scope('kehat','documents/'+record.id+'/delete'),{method:'POST',body:{password:'archive-owner-test'}});
    assert.equal((await f.call('/media/'+record.id)).status,404);
    assert.equal((await f.json(scope('extended','people/kehat-havazelet/page'))).albums.documents.total,0);
    f.restart();
    assert.equal((await f.json(scope('kehat','documents'))).items.some(item=>item.id===record.id),false);
    assert.ok(f.sql.prepare('SELECT id FROM media_trash WHERE id=?').get(record.id));
  }finally{f.close();}
});

test('password-protected removal handles shared duplicate scans, story attachments and rare audio',async()=>{
  const f=fixture();try{
    await f.json(scope('kehat','documents'));await ownerPassword(f);
    const first=f.media('shlomo',{type:'document',name:'Shared scan',filename:'shared.pdf'});
    const second=f.media('yona',{type:'document',name:'Shared scan',filename:'shared.pdf'});
    assert.equal((await f.json('/api/documents')).items.filter(item=>item.filename==='shared.pdf').length,1);
    await f.json('/api/documents/'+first.id+'/delete',{method:'POST',body:{password:'archive-owner-test'}});
    for(const id of [first.id,second.id])assert.ok(f.sql.prepare('SELECT id FROM media_trash WHERE id=?').get(id));
    assert.equal((await f.json('/api/documents')).items.some(item=>item.filename==='shared.pdf'),false);
    const attachment=f.media(null,{type:'document',name:'Attachment',category:'attachment'});
    f.sql.prepare('INSERT INTO stories(id,data) VALUES(?,?)').run('9'.repeat(24),JSON.stringify({id:'9'.repeat(24),title:'An old story',body:'Memory',personIds:['kehat-jidaan'],attachments:[{src:'/media/'+attachment.id,name:'Old record'}]}));
    await f.json(scope('kehat','documents/'+attachment.id+'/delete'),{method:'POST',body:{password:'archive-owner-test'}});
    assert.deepEqual(JSON.parse(f.sql.prepare('SELECT data FROM stories WHERE id=?').get('9'.repeat(24)).data).attachments,[]);
    const id='f'.repeat(32);
    f.state.run('recording.add',{id,key:'recordings/'+id+'/original.mp3',size:25,mime:'audio/mpeg',filename:'original.mp3',fields:{title:'Rare recording',personIds:['kehat-jidaan']}});
    assert.ok((await f.json(scope('kehat','documents'))).items.some(item=>item.id===id));
    await f.json(scope('kehat','documents/'+id+'/delete'),{method:'POST',body:{password:'archive-owner-test'}});
    assert.equal((await f.call('/api/voices/'+id+'/audio')).status,404);
    assert.ok(!JSON.stringify(f.state.run('export')).includes('archive-owner-test'));
  }finally{f.close();}
});

test('existing certificate uploads keep their original file and ID while gaining confirmed attribution',async()=>{
  const f=fixture();try{
    const seed=KEHAT_DOCUMENTS.find(item=>item.name.includes('יעקב'));
    const id=seed.id;
    const original={id,personId:'kehat-yaakov',category:'personal',kind:'document',mime:'application/pdf',key:'documents/original-wedding.pdf',file:'original-wedding.pdf',filename:'original-wedding.pdf',size:12345};
    f.sql.prepare('INSERT INTO media(id,category,person_id,data) VALUES(?,?,?,?)').run(id,original.category,original.personId,JSON.stringify(original));
    const records=(await f.json(scope('kehat','documents'))).items;
    assert.equal(records.length,1);assert.equal(records.filter(item=>item.id===id).length,1);
    const updated=records.find(item=>item.id===id);
    assert.equal(updated.sourceUrl,seed.sourceUrl);assert.deepEqual(updated.personIds,seed.documentPeople);
    const stored=f.state.media(id);assert.equal(stored.key,original.key);assert.equal(stored.size,original.size);assert.equal(stored.mime,'application/pdf');
    f.restart();assert.equal((await f.json(scope('kehat','documents'))).items.length,1);
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


test('the separate Tzadok and Kehat archives retain their own records while one marriage document and profile serve both',async()=>{
  const f=fixture();try{
    await f.json(scope('extended','tag-people'));
    const upload=async(branch,title,personIds)=>{
      const bytes=new TextEncoder().encode('%PDF-1.4\n'+title+'\n%%EOF');
      return f.json(scope(branch,'documents/upload?filename='+title+'.pdf'),{method:'POST',body:bytes,headers:{'Content-Length':String(bytes.length),'X-Family-Document':encodeURIComponent(JSON.stringify({title,caption:'original source',personIds}))}});
    };
    const shared=await upload('kehat','wedding',['kehat-yaakov','kehat-yaakov-yehudit']);
    const first=await upload('kehat','saadia',['kehat-jidaan']);
    const second=await upload('zechariah-tzadok','zechariah',['kehat-zechariah-ben-tzadok']);
    const ids=async branch=>(await f.json(scope(branch,'documents'))).items.map(x=>x.id);
    assert.deepEqual(new Set(await ids('kehat')),new Set([shared.item.id,first.item.id]));
    assert.deepEqual(new Set(await ids('zechariah-tzadok')),new Set([shared.item.id,second.item.id]));
    assert.deepEqual(new Set(await ids('extended')),new Set([shared.item.id,first.item.id,second.item.id]));
    await f.json(scope('zechariah-tzadok','people/kehat-yaakov-yehudit/about'),{method:'POST',body:{about:'Our shared biography',expectedAbout:'',language:'he'}});
    assert.equal((await f.json(scope('kehat','people/kehat-yaakov-yehudit/page'))).person.about,'Our shared biography');
    f.restart();
    assert.equal((await f.json(scope('zechariah-tzadok','people/kehat-yaakov/page'))).albums.documents.total,1);
    assert.equal((await f.json(scope('kehat','people/kehat-yaakov/page'))).albums.documents.total,1);
    assert.equal(f.objects.size,3);
    assert.equal((await f.call(scope('kehat','people/kehat-naomi/page'))).status,404);
    assert.equal((await f.call(scope('zechariah-tzadok','people/kehat-jidaan/page'))).status,404);
  }finally{f.close();}
});
