import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import worker,{FamilyState,PUBLIC_WRITE_TOKEN} from '../src/worker.mjs';
import family from '../src/family.mjs';
import {NAKASH_WRITE_TOKEN} from '../src/nakash-shell.mjs';
import {createFamily} from '../public/nakash/family-data.mjs';
import {createExtendedFamily,EXTENDED_BRANCHES,EXTENDED_NAME} from '../public/keha-extended/family-data.mjs';
import {toOriginalFamilyData} from '../public/nakash/tree-data-adapter.mjs';
import {extendedKehaHTML,shlomoKehaHTML,branchPortalHTML} from '../src/extended-keha.mjs';
import {BRANCH_PORTALS,createBranchPortal} from '../public/keha-extended/branch-portals.mjs';
import {createShlomoFamily,SHLOMO_NAME,SHLOMO_HOME} from '../public/keha-extended/shlomo-data.mjs';
import {familyApp} from '../family-apps/worker.mjs';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';

const originalHTML=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
const photo=await readFile(new URL('./fixtures/photo.jpg',import.meta.url));
const manifest=JSON.parse(await readFile(new URL('../public/keha-extended/manifest.webmanifest',import.meta.url)));
const site=path=>'/keha-extended/api/compat/api/'+path;
const shlomoSite=path=>SHLOMO_HOME+'api/compat/api/'+path;

test('the confirmed 1949 household joins Sarah and Esther to Shlomo without inventing exact birth dates',()=>{
  const tree=createExtendedFamily(family);
  assert.deepEqual(tree.units['u-kehat-shlomo'].people,['kehat-shlomo','kehat-shlomo-sarah']);
  assert.deepEqual(tree.units['u-kehat-shlomo'].children,['u-kehat-esther']);
  assert.equal(tree.units['u-kehat-esther'].parent,'u-kehat-shlomo');
  for(const [id,year] of [['kehat-shlomo-sarah',1900],['kehat-esther',1930]]){
    assert.equal(tree.people[id].birthYear,year);assert.notEqual(tree.people[id].birthday,'1.1.'+year);
  }
  assert.equal(tree.people['kehat-shlomo'].birthYearMin,1896);assert.equal(tree.people['kehat-shlomo'].birthYearMax,1903);
  assert.equal(tree.people['kehat-shlomo'].birthYear,null);
  assert.match(tree.people['kehat-shlomo'].researchNotes,/1903/);
  assert.equal(tree.units['u-kehat-shlomo'].parent,'u-keha-kehat');
});
function fixture(){
  const database=new DatabaseSync(':memory:');
  const storage={sql:{exec(query,...args){const statement=database.prepare(query);const rows=statement.columns().length?statement.all(...args):(statement.run(...args),[]);return {toArray:()=>rows};}},
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
  const call=(path,{method='GET',body,headers:extra={},token=path.startsWith('/keha-extended/')?NAKASH_WRITE_TOKEN:PUBLIC_WRITE_TOKEN}={})=>{
    const headers={...extra,...(method==='POST'?{Origin:'https://family.example','X-Family-Token':token}:{})};
    if(body instanceof Uint8Array){headers['Content-Type']='image/jpeg';headers['Content-Length']=String(body.length);}
    else if(body){headers['Content-Type']='application/json';body=JSON.stringify(body);}
    return worker.fetch(new Request('https://family.example'+path,{method,body,headers}),env,{waitUntil(){}});
  };
  const json=async(path,options)=>{const response=await call(path,options),body=await response.json();assert.ok(response.ok,JSON.stringify({path,status:response.status,...body}));return body;};
  return {call,json,objects,database,restart(){state=new FamilyState({storage},env);},close(){globalThis.fetch=originalFetch;database.close();}};
}

test('Tri follows Saadia’s Kehat ancestry while Yissachar and the older roots stay independent',()=>{
  const tree=createExtendedFamily(family),data=toOriginalFamilyData(tree);
  assert.equal(data.title,EXTENDED_NAME);
  assert.equal(data.branches.length,5);
  assert.equal(data.units['u-root'].parent,'u-keha-zechariah-father');
  assert.equal(data.units['u-keha-zechariah'].parent,'u-saadia-elder');
  for(const id of ['u-kehat-tzadok-elder','u-kehat-aharon-elder','u-keha-zechariah-father','u-saadia-elder'])assert.equal(data.units[id].parent,null);
  assert.equal(data.units['u-keha-kehat'].parent,'u-kehat-aharon-elder');
  assert.equal(data.people['zecharia-nakash'],undefined);
  assert.equal(data.people['margalit-nakash'],undefined);
  assert.deepEqual(data.units['u-keha-zechariah'].people,['keha-zechariah','keha-yehudit']);
  assert.equal(data.units['u-keha-kehat'].children.length,8);
  assert.equal(data.units['u-kehat-zechariah'].children.length,10);
  assert.equal(data.units['u-kehat-zechariah'].parent,'u-keha-kehat');
  assert.deepEqual(data.units['u-kehat-zechariah'].people,['kehat-zechariah','tri-yona']);
  assert.equal(data.units['u-keha-yissachar'].parent,null);
  assert.ok(data.people['kehat-hadassah'].aliases.includes('הדוס'));
  assert.notEqual(data.people['kehat-miriam'].id,data.people['kehat-yaakov-miriam'].id);
  assert.equal(data.people.ora.id,family.people.ora.id);
  assert.equal(data.people['kehat-tzion'].branch,'kehat');
  assert.equal(createFamily(family).people['kehat-jidaan'],undefined);
});

test('the 1954 questionnaire connects Ora’s ten siblings to their parents in birth order',async()=>{
  const data=toOriginalFamilyData(createExtendedFamily(family)),window={};
  vm.runInNewContext(await readFile(new URL('../public/assets/relations.js',import.meta.url),'utf8'),{window});
  const relatives=id=>JSON.parse(JSON.stringify(window.FamilyRelations.forPerson(data,id)));
  const ids=data.units['u-kehat-zechariah'].children.map(unit=>data.units[unit].people[0]);
  assert.deepEqual(ids.map(id=>data.people[id].name),['מנחם','אסתר','יוסף טרי (קהא)','בנימין קהתי','יששכר טרי','רחל','רונית','דוד','מרים','חנה']);
  assert.equal(new Set(ids).size,10);
  assert.equal(ids.filter(id=>data.people[id].gender==='m').length,5);
  assert.equal(ids.filter(id=>data.people[id].gender==='f').length,5);
  for(const id of ids){
    assert.deepEqual(relatives(id).parents,['kehat-zechariah','tri-yona']);
    assert.deepEqual(relatives(id).siblings,ids.filter(other=>other!==id));
  }
  assert.deepEqual(relatives('kehat-zechariah').children,ids);
  assert.deepEqual(relatives('tri-yona').children,ids);
  assert.deepEqual(ids.map(id=>data.people[id].birthYear),[1932,1934,1937,1941,1943,1945,1947,1949,1952,1954]);
  assert.equal(data.people['tri-yona'].birthYear,1912);
  assert.equal(data.people['kehat-zechariah'].birthYear,1902);
  assert.notEqual(data.people['tri-yona'].id,data.people.yona.id);
  assert.equal(data.people['tri-menachem'].birthPlace,'עדן, תימן');
  assert.ok(data.people['tri-ronit'].aliases.includes('רינה'));
  const portal=toOriginalFamilyData(createBranchPortal(family,'kehat'));
  for(const id of [...ids,'tri-yona','kehat-zechariah'])assert.ok(portal.people[id],id);
  assert.equal(portal.people['tri-yona'].branch,'kehat');
  assert.deepEqual(relatives('kehat-zechariah').parents,['kehat-jidaan','kehat-first-wife']);
  assert.deepEqual(relatives('kehat-jidaan').parents,['kehat-aharon-elder']);
  assert.equal(data.units['u-keha-yissachar'].parent,null);
  assert.deepEqual(relatives('yissachar-yosef').children.map(id=>data.people[id].name),['דודי','ממי','אביחי','דרורי','אורי']);
  assert.deepEqual(relatives('yissachar-yosef').partners,['yissachar-tzvia']);
  assert.deepEqual(relatives('yissachar-yosef').parents,[]);
  assert.equal(data.people['yissachar-yosef'].branch,'yissachar');
  assert.ok(!portal.people['yissachar-yosef']);
  assert.equal(data.people['tri-menachem'].maritalStatus,'unmarried');
  assert.match(data.people['tri-menachem'].researchNotes,/72/);
  assert.match(data.people['tri-menachem'].researchNotes,/77/);
  assert.equal(data.people['tri-binyamin'].burialDate,'2.4.2014');
  assert.equal(data.people['tri-binyamin'].deathDate,undefined,'Burial dates must not be labeled as death dates');
  assert.equal(data.people['tri-shifra'].deathDate,undefined);
  for(const id of ['keha-yosef-yissachar','tri-yissachar','tri-binyamin']){
    assert.equal(data.people[id].recordedParents.father,'זכריה');
    assert.ok(data.people[id].researchSources.length>0);
  }
});

test('Shifra’s son Hezi does not acquire an unconfirmed father through her marriage',async()=>{
  const data=toOriginalFamilyData(createExtendedFamily(family)),window={};
  vm.runInNewContext(await readFile(new URL('../public/assets/relations.js',import.meta.url),'utf8'),{window});
  const relatives=id=>JSON.parse(JSON.stringify(window.FamilyRelations.forPerson(data,id)));
  assert.deepEqual(relatives('tri-hezi').parents,['tri-shifra']);
  assert.deepEqual(relatives('tri-shifra').children,['tri-hezi']);
  assert.deepEqual(relatives('tri-binyamin').children,[]);
  assert.deepEqual(relatives('tri-binyamin').partners,['tri-shifra']);
  assert.deepEqual(relatives('tri-shifra').partners,['tri-binyamin']);
  assert.deepEqual(relatives('tri-shifra').siblings,[]);
});

test('correcting Yosef’s combined label retains his profile, family edits and original tagged media',async()=>{
  const f=fixture();try{
    const id='keha-yosef-yissachar',before={id,name:'יוסף יששכר',nameEn:'Yosef Yissachar',about:'זיכרון שהמשפחה כתבה',birthday:'2.3.1938',profileId:'existing-portrait',extra:true};
    f.database.prepare('INSERT INTO people (id,data) VALUES (?,?)').run(id,JSON.stringify(before));
    const after=(await f.json(site('people/'+id+'/page'))).person;
    assert.equal(after.id,id);assert.equal(after.name,'יוסף טרי (קהא)');
    assert.equal(after.nameEn,'Yosef Tri (Keha)');
    for(const key of ['birthday','about'])assert.equal(after[key],before[key]);
    assert.equal(after.birthYear,1937);
    assert.match(after.researchNotes,/2\.3\.1938/);
    const saved=JSON.parse(f.database.prepare('SELECT data FROM people WHERE id=?').get(id).data);
    assert.equal(saved.profileId,before.profileId);
    const backup=JSON.parse(f.database.prepare('SELECT value FROM meta WHERE id=?').get('extended-tri-ten-siblings-2026-11-21-v1:backup:'+id).value);
    assert.equal(backup.name,before.name);
    const restored=(await f.json(site('people/yissachar-yosef/page'))).person;
    assert.equal(restored.name,'יוסף יששכר');assert.equal(restored.about,before.about);assert.equal(restored.birthday,before.birthday);
    const uploaded=await f.json(site('people/'+id+'/photos?filename=yosef.jpg'),{method:'POST',body:photo});
    const mediaId=uploaded.albums.photos.items[0].id;
    f.restart();
    const page=await f.json(site('people/'+id+'/page'));
    assert.equal(page.person.id,id);assert.equal(page.albums.photos.items[0].id,mediaId);
    assert.deepEqual(new Uint8Array(await (await f.call('/media/'+mediaId)).arrayBuffer()),new Uint8Array(photo));
    // Simulate upgrading a site where the parallel archival migration ran first.
    f.database.prepare('DELETE FROM meta WHERE id=?').run('extended-tri-confirmed-parentage-yissachar-2026-11-21-v2');
    f.restart();
    const upgraded=await f.json(site('people/'+id+'/page'));
    assert.equal(upgraded.person.birthYear,1937);
    assert.equal(upgraded.person.birthday,before.birthday);
    assert.match(upgraded.person.researchNotes,/2\.3\.1938/);
    assert.equal(upgraded.albums.photos.items[0].id,mediaId);
    assert.equal(f.database.prepare('SELECT COUNT(*) AS n FROM people WHERE id=?').get('tri-siblings-group').n,0,'The group header must never become a person record');
  }finally{f.close();}
});

test('desktop and mobile show the ten children under Zechariah inside Kehat',async()=>{
  const source=await readFile(new URL('../public/assets/app.js',import.meta.url),'utf8');
  for(const phone of [false,true]){
    const {document,window:dom}=parseHTML(extendedKehaHTML(originalHTML));
    const data=toOriginalFamilyData(createExtendedFamily(family));
    const window={FAMILY_DATA:data,addEventListener(){},dispatchEvent(){},scrollTo(){}};
    window.FamilyI18n={isEnglish:false,t:value=>value,html:(parts,...values)=>parts.reduce((output,part,index)=>output+part+(values[index]??''),''),personName:person=>person.name,branchName:branch=>branch?.title,searchNames:person=>person.name,date:value=>value};
    window.FamilyDates={age:()=>null,parse:()=>null};
    const context=vm.createContext({window,document,location:{hash:'#tree/kehat'},history:{pushState(){}},matchMedia:query=>({matches:phone&&query.includes('700px')}),requestAnimationFrame(){},cancelAnimationFrame(){},setInterval(){},innerWidth:phone?390:1280,innerHeight:900,CustomEvent:dom.CustomEvent});
    vm.runInContext(source,context);
    assert.equal(document.querySelector('.tree-sibling-group'),null);
    for(const id of ['kehat-zechariah','tri-yona'])assert.ok(document.querySelector('#treeNodes [data-person="'+id+'"]'));
    assert.match(document.getElementById('treeNodes').textContent,/1932/);
    assert.match(document.getElementById('treeNodes').textContent,/1954/);
    assert.equal(document.querySelector('#treeNodes [data-person="tri-siblings-group"]'),null);
    for(const unit of data.units['u-kehat-zechariah'].children)assert.ok(document.querySelector('#treeNodes [data-person="'+data.units[unit].people[0]+'"]'));
    assert.ok(document.querySelector('#treeNodes [data-person="tri-shifra"]'));
    assert.ok(document.querySelector('#treeNodes [data-person="tri-hezi"]'));
    assert.ok(!document.getElementById('treeNodes').textContent.includes('undefined'));
    assert.doesNotMatch(document.getElementById('treeNodes').textContent,/נישואים לפי עדות אורה/);
    assert.match(document.getElementById('treeBreadcrumb').textContent,/סעדיה/);
    window.FamilyApp.setView('directory');
    assert.equal(document.querySelector('#directoryGrid [data-person="tri-siblings-group"]'),null);
  }
});

test('Tzadok and Aharon have separate sons and no invented kinship between their branches',async()=>{
  const data=toOriginalFamilyData(createExtendedFamily(family)),window={};
  vm.runInNewContext(await readFile(new URL('../public/assets/relations.js',import.meta.url),'utf8'),{window});
  const relatives=id=>JSON.parse(JSON.stringify(window.FamilyRelations.forPerson(data,id)));
  assert.deepEqual(relatives('kehat-tzadok-elder').children,['kehat-zechariah-ben-tzadok']);
  assert.deepEqual(relatives('kehat-aharon-elder').children,['kehat-jidaan']);
  assert.deepEqual(relatives('kehat-zechariah-ben-tzadok').parents,['kehat-tzadok-elder']);
  assert.deepEqual(relatives('kehat-jidaan').parents,['kehat-aharon-elder']);
  for(const id of ['kehat-tzadok-elder','kehat-aharon-elder']){
    assert.deepEqual(relatives(id).parents,[]);
    assert.deepEqual(relatives(id).siblings,[]);
    assert.deepEqual(relatives(id).partners,[]);
  }
  assert.equal(data.people['kehat-zechariah-ben-tzadok'].branch,'kehat-tzadok');
  assert.equal(data.people['kehat-jidaan'].branch,'kehat');
  assert.equal(data.people['kehat-jidaan'].name,'סעדיה (ג׳ידעאן) בן אהרון קהא');
  assert.deepEqual(relatives('kehat-jidaan').children,['kehat-yaakov','kehat-zechariah','kehat-aharon','kehat-shlomo','kehat-tzion','kehat-shula','kehat-tzvia','kehat-hadassah']);
  const secondChildren=['kehat-tzion','kehat-shula','kehat-tzvia','kehat-hadassah'];
  assert.deepEqual(relatives('kehat-miriam').children,secondChildren);
  for(const id of secondChildren){
    assert.deepEqual(relatives(id).parents,['kehat-jidaan','kehat-miriam']);
    assert.equal(data.people[id].branch,'kehat');
  }
  assert.deepEqual(relatives('kehat-first-wife').children,['kehat-yaakov','kehat-zechariah','kehat-aharon','kehat-shlomo']);
  assert.notEqual(data.people['kehat-zechariah'].id,data.people['kehat-zechariah-ben-tzadok'].id);
  assert.ok(!relatives('kehat-jidaan').children.includes('kehat-zechariah-ben-tzadok'));
});

test('the confirmed Tzadok record expands both of Zechariah’s marriages and retains source precision',()=>{
  const data=toOriginalFamilyData(createBranchPortal(family,'zechariah-tzadok'));
  assert.equal(data.people['kehat-tzadok'].birthYearMin,1915);assert.equal(data.people['kehat-tzadok'].birthYearMax,1917);
  assert.equal(data.people['kehat-tzadok'].birthday,'1.1.1111');
  assert.match(data.people['kehat-tzadok'].researchNotes,/3479/);
  assert.match(data.people['kehat-tzadok'].researchNotes,/1915–1916/);
  assert.equal(data.units['u-kehat-tzadok'].weddingDate,'7.1.1944');
  assert.equal(data.units['u-kehat-naomi'].weddingDate,'21.6.1946');
  const marriages=data.units['u-kehat-zechariah-ben-tzadok'].relationships;
  assert.deepEqual(marriages[0].people,['kehat-zechariah-ben-tzadok','kehat-amna']);
  assert.deepEqual(marriages[0].children,['u-kehat-tzadok','u-kehat-naomi']);
  assert.deepEqual(marriages[1].people,['kehat-zechariah-ben-tzadok','kehat-tziona']);
  assert.deepEqual(marriages[1].children,['u-kehat-zechariah-yehudit','u-kehat-shori','u-kehat-varda']);
  assert.ok(data.people['kehat-tzadok'].researchSources.every(s=>s.url.startsWith('https://journaliststudio.google.com/')));
});

test('the marriage bridge uses one set of people and keeps both spouses’ own parents',async()=>{
  const data=toOriginalFamilyData(createExtendedFamily(family)),window={};
  vm.runInNewContext(await readFile(new URL('../public/assets/relations.js',import.meta.url),'utf8'),{window});
  const rel=id=>JSON.parse(JSON.stringify(window.FamilyRelations.forPerson(data,id)));
  assert.deepEqual(rel('kehat-yaakov').parents,['kehat-jidaan','kehat-first-wife']);
  assert.deepEqual(rel('kehat-yaakov-yehudit').parents,['kehat-zechariah-ben-tzadok','kehat-tziona']);
  assert.deepEqual(rel('kehat-gila').parents,['kehat-yaakov','kehat-yaakov-yehudit']);
  assert.deepEqual(rel('kehat-shori').parents,['kehat-zechariah-ben-tzadok','kehat-tziona']);
  assert.deepEqual(rel('kehat-mordechai').parents,['kehat-zechariah-ben-tzadok','kehat-tziona']);
  assert.deepEqual(rel('kehat-tziona').children,['kehat-yaakov-yehudit','kehat-shori','kehat-mordechai']);
  assert.deepEqual(rel('kehat-amna').children,['kehat-tzadok','kehat-naomi']);
  for(const id of ['kehat-yaakov-yehudit','kehat-shori','kehat-mordechai']){
    assert.deepEqual(rel(id).siblings,['kehat-tzadok','kehat-naomi','kehat-yaakov-yehudit','kehat-shori','kehat-mordechai'].filter(other=>other!==id));
  }
  assert.deepEqual(rel('kehat-mordechai').partners,['kehat-varda']);
  assert.deepEqual(rel('kehat-varda').parents,[]);
  assert.deepEqual(rel('kehat-varda').partners,['kehat-mordechai']);
  for(const id of ['kehat-merav','kehat-sharon-varda','kehat-adi-varda','kehat-tal-varda']){
    assert.deepEqual(rel(id).parents,['kehat-mordechai','kehat-varda']);
  }
  assert.deepEqual(rel('kehat-mordechai').children.map(id=>data.people[id].name),['מירב','שרון','עדי','טל']);
  assert.deepEqual(rel('kehat-shori').partners,[]);
  assert.deepEqual(rel('kehat-yaakov-miriam').partners,[]);
  assert.deepEqual(rel('kehat-yehudit').parents,[]);
  for(const [parent,children] of [['kehat-jidaan',['kehat-yaakov']],['kehat-zechariah-ben-tzadok',['kehat-yaakov-yehudit']],['kehat-yaakov',['kehat-havazelet','kehat-ari','kehat-gila']],['kehat-yaakov-yehudit',['kehat-havazelet','kehat-ari','kehat-gila']]])for(const child of children)assert.ok(rel(parent).children.includes(child));
  assert.equal(data.people['kehat-yaakov'].branch,'kehat');
  assert.equal(data.people['kehat-yaakov-yehudit'].branch,'kehat-tzadok');
  for(const id of ['kehat-havazelet','kehat-ari','kehat-gila']){
    assert.deepEqual([...data.people[id].branches].sort(),['kehat','kehat-tzadok']);
    assert.equal(Object.values(data.people).filter(person=>person.id===id).length,1);
  }
});

test('Uri’s transcription correction retains the existing profile and its family edits',async()=>{
  const f=fixture();try{
    const id='kehat-ari',before={id,name:'ארי קהת',nameEn:'Ari Kehat',birthday:'2.3.1950',about:'זיכרון משפחתי',profileId:'existing-portrait',extra:true};
    f.database.prepare('INSERT INTO people (id,data) VALUES (?,?)').run(id,JSON.stringify(before));
    const after=(await f.json('/keha-extended/kehat/api/compat/api/people/'+id+'/page')).person;
    assert.equal(after.name,'אורי קהת');assert.equal(after.nameEn,'Uri Kehat');
    for(const key of ['id','birthday','about'])assert.equal(after[key],before[key]);
    const saved=JSON.parse(f.database.prepare('SELECT data FROM people WHERE id=?').get(id).data);
    assert.equal(saved.profileId,before.profileId);
    assert.ok(saved.aliases.includes('ארי קהת'));
    const backup=JSON.parse(f.database.prepare('SELECT value FROM meta WHERE id=?').get('extended-kehat-uri-transcription-2026-11-20-v1:backup:'+id).value);
    assert.equal(backup.name,'ארי קהת');
  }finally{f.close();}
});

test('Ron is a grandson with an unresolved father, never a third son or sibling of Reuven and Shimon',async()=>{
  const data=toOriginalFamilyData(createBranchPortal(family,'zechariah-tzadok')),window={};
  vm.runInNewContext(await readFile(new URL('../public/assets/relations.js',import.meta.url),'utf8'),{window});
  const rel=id=>JSON.parse(JSON.stringify(window.FamilyRelations.forPerson(data,id)));
  assert.deepEqual(rel('kehat-tzadok').children,['kehat-reuven','kehat-shimon']);
  assert.deepEqual(rel('kehat-tzadok').grandchildren,['kehat-ron']);
  assert.deepEqual(rel('kehat-ron').parents,[]);
  assert.deepEqual(rel('kehat-ron').grandparents,['kehat-tzadok']);
  assert.deepEqual(rel('kehat-ron').siblings,[]);
  assert.deepEqual(rel('kehat-reuven').siblings,['kehat-shimon']);
  assert.deepEqual(rel('kehat-gur').parents,['kehat-ron']);
  assert.equal(data.people['kehat-ron'].generation,data.people['kehat-tzadok'].generation+2);
  assert.equal(data.people['kehat-gur'].generation,data.people['kehat-tzadok'].generation+3);
  assert.deepEqual(rel('kehat-simha-magila').children,[],'A documented wedding does not prove maternity of already-known children');
});

test('research updates preserve names, dates, biography and portraits edited by the family',async()=>{
  const f=fixture();try{
    const id='kehat-tzadok',before={id,name:'צדוק במשפחה',nameEn:'Family name for Tzadok',about:'סיפור שהמשפחה כתבה',birthday:'2.3.1917',profileId:'existing-portrait',extra:true};
    f.database.prepare('INSERT INTO people (id,data) VALUES (?,?)').run(id,JSON.stringify(before));
    const after=(await f.json('/keha-extended/zechariah-tzadok/api/compat/api/people/'+id+'/page')).person;
    assert.equal(after.name,before.name);assert.equal(after.birthday,before.birthday);assert.equal(after.about,before.about);
    assert.equal(after.birthYearMin,1915);assert.equal(after.birthYearMax,1917);assert.match(after.researchNotes,/H57320/);
    const row=JSON.parse(f.database.prepare('SELECT data FROM people WHERE id=?').get(id).data);assert.equal(row.profileId,'existing-portrait');
    const backup='extended-kehat-certificate-families-2026-11-20-v1:backup:'+id;
    assert.equal(JSON.parse(f.database.prepare('SELECT value FROM meta WHERE id=?').get(backup).value).about,before.about);
    f.restart();assert.equal((await f.json(site('people/'+id+'/page'))).person.about,before.about);
    assert.equal(f.database.prepare('SELECT COUNT(*) AS n FROM meta WHERE id=?').get(backup).n,1);
  }finally{f.close();}
});

test('Tziona parentage correction replaces the deployed Amna assumption once and preserves family edits',async()=>{
  const f=fixture();try{
    const id='kehat-yaakov-yehudit',migration='extended-kehat-tziona-three-siblings-2026-11-20-v1';
    const before={id,name:'יהודית שלנו',nameEn:'Our Yehudit',birthday:'2.3.1923',about:'זיכרונות אישיים של המשפחה',profileId:'portrait-to-preserve',researchNotes:'בתם של זכריה ואמנה',extra:true};
    f.database.prepare('INSERT INTO people (id,data) VALUES (?,?)').run(id,JSON.stringify(before));
    f.database.prepare('INSERT INTO meta (id,value) VALUES (?,?)').run('extended-kehat-certificate-families-2026-11-20-v1','done');
    f.database.prepare('INSERT INTO meta (id,value) VALUES (?,?)').run('extended-kehat-yehudit-amna-2026-11-20-v1','done');
    const after=(await f.json('/keha-extended/zechariah-tzadok/api/compat/api/people/'+id+'/page')).person;
    for(const key of ['name','nameEn','birthday','about'])assert.equal(after[key],before[key]);
    assert.match(after.researchNotes,/זכריה בן צדוק קהא וציונה/);
    assert.match(after.researchNotes,/ציונה היא אמה הביולוגית/);
    assert.doesNotMatch(after.researchNotes,/אמנה|השערה משפחתית/);
    const backup=JSON.parse(f.database.prepare('SELECT value FROM meta WHERE id=?').get(migration+':backup:'+id).value);
    assert.equal(backup.researchNotes,before.researchNotes);
    const saved=JSON.parse(f.database.prepare('SELECT data FROM people WHERE id=?').get(id).data);
    assert.equal(saved.profileId,before.profileId);
    saved.researchNotes='הערת מחקר שנערכה לאחר התיקון';
    f.database.prepare('UPDATE people SET data=? WHERE id=?').run(JSON.stringify(saved),id);
    f.restart();
    assert.equal((await f.json(site('people/'+id+'/page'))).person.researchNotes,saved.researchNotes);
  }finally{f.close();}
});

test('the family corrections retain Suri, Dvora and Merav’s saved profiles and make Mordechai the father',async()=>{
  const f=fixture();try{
    const migration='extended-kehat-tziona-three-siblings-2026-11-20-v1';
    for(const id of ['extended-kehat-certificate-families-2026-11-20-v1','extended-kehat-yehudit-amna-2026-11-20-v1']){
      f.database.prepare('INSERT INTO meta (id,value) VALUES (?,?)').run(id,'done');
    }
    for(const [id,name,nameEn] of [['kehat-shori','שורי קהת','Shori Kehat'],['kehat-varda','ורדה קהת','Varda Kehat'],['kehat-merav','מרב','Merav']]){
      f.database.prepare('INSERT INTO people (id,data) VALUES (?,?)').run(id,JSON.stringify({id,name,nameEn,englishName:nameEn,birthday:'2.3.1930',about:'סיפור משפחתי שמור',profileId:'portrait-'+id,extra:true}));
    }
    for(const [id,name,nameEn] of [['kehat-shori','סורי קהת','Suri Kehat'],['kehat-varda','דבורה קהת','Dvora Kehat'],['kehat-merav','מירב','Merav']]){
      const page=await f.json('/keha-extended/zechariah-tzadok/api/compat/api/people/'+id+'/page');
      assert.equal(page.person.name,name);assert.equal(page.person.nameEn,nameEn);
      assert.equal(page.person.birthday,'2.3.1930');assert.equal(page.person.about,'סיפור משפחתי שמור');
      const saved=JSON.parse(f.database.prepare('SELECT data FROM people WHERE id=?').get(id).data);
      assert.equal(saved.profileId,'portrait-'+id);
      const backupMigration=id==='kehat-merav'?'extended-kehat-merav-spelling-2026-11-21-v1':migration;
      assert.equal(JSON.parse(f.database.prepare('SELECT value FROM meta WHERE id=?').get(backupMigration+':backup:'+id).value).profileId,saved.profileId);
    }
    const father=(await f.json('/keha-extended/zechariah-tzadok/api/compat/api/people/kehat-mordechai/page')).person;
    assert.equal(father.name,'מרדכי קהת');
    f.restart();
    assert.equal((await f.json('/keha-extended/zechariah-tzadok/api/compat/api/people/kehat-varda/page')).person.name,'דבורה קהת');
  }finally{f.close();}
});

test('confirmed death dates migrate once while candidate gravestones never replace life dates',async()=>{
  const f=fixture();try{
    const id='kehat-tzion';
    f.database.prepare('INSERT INTO people (id,data) VALUES (?,?)').run(id,JSON.stringify({id,name:'ציון קהת',birthday:'1.1.1111',extra:true}));
    const get=async id=>(await f.json('/keha-extended/kehat/api/compat/api/people/'+id+'/page')).person;
    const tzion=await get(id),hadassah=await get('kehat-hadassah'),jidaan=await get('kehat-jidaan');
    assert.equal(tzion.birthYear,1936);assert.equal(tzion.deathDate,'3.8.2015');assert.equal(tzion.deceased,true);
    assert.equal(hadassah.birthYear,1941);assert.equal(hadassah.deathDate,'12.7.2015');
    assert.equal(jidaan.deathDate,'9.12.1962');assert.equal(jidaan.birthday,'1.1.1111');
    assert.equal(jidaan.birthYearMin,1870);assert.equal(jidaan.birthYearMax,1877);
    assert.equal(jidaan.lifeRecords[0].status,'confirmed');
    assert.equal(jidaan.lifeRecords[0].deathDate,'9.12.1962');
    assert.equal((await get('kehat-aharon')).deathDate,undefined,'An unresolved grave is not promoted to a confirmed date');
    f.database.prepare('UPDATE people SET data=? WHERE id=?').run(JSON.stringify({...tzion,deathDate:'4.8.2015'}),id);
    f.restart();assert.equal((await get(id)).deathDate,'4.8.2015','A later family correction is preserved');
  }finally{f.close();}
});

test('identifying Jidaan as Saadia preserves his shared profile, albums and subsequent name edits',async()=>{
  const f=fixture();try{
    const id='kehat-jidaan';
    f.database.prepare('INSERT INTO people (id,data) VALUES (?,?)').run(id,JSON.stringify({id,name:'ג׳ידעאן קהת',nameEn:'Jidaan Kehat',about:'סיפור שכבר נכתב',birthday:'2.3.1900',extra:true,profileId:null}));
    const first=await f.json(site('people/'+id+'/page'));
    assert.equal(first.person.name,'סעדיה (ג׳ידעאן) בן אהרון קהא');
    assert.equal(first.person.birthday,'2.3.1900');
    assert.equal(first.person.about,'סיפור שכבר נכתב');
    const portrait=await f.json(site('people/'+id+'/photos?filename=saadia.jpg'),{method:'POST',body:photo});
    const saved=JSON.parse(f.database.prepare('SELECT data FROM people WHERE id=?').get(id).data);
    saved.name='סעדיה קהת — שם מעודכן';
    f.database.prepare('UPDATE people SET data=? WHERE id=?').run(JSON.stringify(saved),id);
    f.restart();
    const next=await f.json(site('people/'+id+'/page'));
    assert.equal(next.person.name,saved.name);
    assert.equal(next.person.profileMediaId,portrait.person.profileMediaId);
    assert.equal(next.albums.photos.total,1);
  }finally{f.close();}
});

test('Saadia’s chart retains five subbranches, correct generations and the explicit privacy request',async()=>{
  const data=toOriginalFamilyData(createExtendedFamily(family)),window={};
  vm.runInNewContext(await readFile(new URL('../public/assets/relations.js',import.meta.url),'utf8'),{window});
  const relatives=id=>JSON.parse(JSON.stringify(window.FamilyRelations.forPerson(data,id)));
  assert.deepEqual(relatives('keha-zechariah-father').siblings,['saadia-elder']);
  assert.deepEqual(relatives('saadia-elder').children,['keha-zechariah']);
  assert.deepEqual(relatives('shlomo').parents,['keha-zechariah-father']);
  assert.deepEqual(relatives('yona').parents,[],'Yona does not inherit Shlomo’s father');
  assert.deepEqual(relatives('keha-zechariah').parents,['saadia-elder']);
  assert.equal(data.people['keha-zechariah'].name,'זכריה קהא הבן');
  for(const id of ['keha-zechariah-father','saadia-elder']){
    assert.equal(data.people[id].deceased,true);
    assert.match(data.people[id].about,/נפטר בתימן/);
    assert.deepEqual(relatives(id).partners,[],'Unknown wives are not invented');
  }
  assert.equal(data.units['u-keha-zechariah'].children.length,5);
  assert.deepEqual(relatives('keha-zechariah').children,['saadia-kadya','saadia-shalom','saadia-saadia','saadia-israel']);
  assert.deepEqual(relatives('keha-zechariah').adoptedChildren,['saadia-aharon']);
  assert.deepEqual(relatives('saadia-aharon').parents,[]);
  assert.deepEqual(relatives('saadia-aharon').adoptedParents,['keha-zechariah']);
  assert.equal(relatives('keha-yehudit').adoptedChildren,undefined,'Only Zechariah is named as adoptive parent');
  assert.deepEqual(relatives('saadia-oded').children,['saadia-inbar','saadia-maor']);
  assert.deepEqual(relatives('saadia-noam').children,['saadia-dalia-noam']);
  assert.deepEqual(relatives('saadia-daniel').children,['saadia-amir','saadia-michael']);
  assert.deepEqual(relatives('saadia-liron').children,['saadia-ori']);
  assert.equal(data.people['saadia-dalia-noam'].generation,5);
  assert.ok(!Object.values(data.people).some(person=>person.name.includes('תקוה')||person.name.includes('תקווה')));
  assert.match(data.people['saadia-ofir'].about,/אמו תקוה/);
  assert.deepEqual(data.units['u-saadia-roni'].children,[],'Unnamed six or seven children are not fabricated');
  assert.equal(data.people['saadia-dagnit'].deathDate,undefined,'A funeral date is not a death date');
  assert.deepEqual(relatives('saadia-rachel').parents,['saadia-kapra-zechariah','saadia-kapra-sara']);
  assert.deepEqual(relatives('saadia-kapra-zechariah').parents,['saadia-kapra-chaim']);
  assert.deepEqual(relatives('saadia-kapra-zechariah').children,['saadia-rachel']);
  assert.deepEqual(relatives('saadia-saida').parents,['saadia-saida-father','saadia-saida-mother']);
  assert.deepEqual(relatives('saadia-saadia').parents,['keha-zechariah','keha-yehudit'],'The husband keeps his own parents');
  for(const person of Object.values(data.people))assert.ok(data.units[person.unit]);
  for(const unit of Object.values(data.units))for(const child of unit.children)assert.equal(data.units[child].parent,unit.mirrorOf||unit.id);
});

test('existing Saida and Boaz portraits, media and edits remain shared through their historical person IDs',async()=>{
  const f=fixture();try{
    const pairs=[['saadia-saida','extra-b3318c4c12cc4e83886ee902','סעידה קהא'],['saadia-boaz','extra-b2c26d6299d747f083bf9490','בועז קהא']];
    const portraits=[];
    for(const [seed,id,name] of pairs){
      f.database.prepare('INSERT INTO people (id,data) VALUES (?,?)').run(id,JSON.stringify({id,name,extra:true,birthday:'4.5.1920',profileId:null,revision:'before'}));
      const uploaded=await f.json('/api/people/'+id+'/photos?filename=historical.jpg',{method:'POST',body:photo});
      portraits.push(uploaded.person.profileMediaId);
    }
    const script=await(await f.call('/keha-extended/site-data.js')).text();
    const data=JSON.parse(script.split('\n')[0].slice('window.FAMILY_DATA='.length,-1));
    for(const [index,[seed,id]] of pairs.entries()){
      assert.equal(data.identities[seed],id);
      assert.ok(!data.people[seed]);
      assert.equal(data.people[id].profileMediaId,portraits[index]);
      const page=await f.json(site('people/'+seed+'/page'));
      assert.equal(page.person.id,id);
      assert.equal(page.albums.photos.total,1);
      await f.json(site('people/'+seed+'/about'),{method:'POST',body:{about:'סיפור משותף',expectedAbout:page.person.about||'',language:'he'}});
      assert.equal((await f.json('/api/people/'+id+'/page')).person.about,'סיפור משותף');
    }
    const relativesWindow={};vm.runInNewContext(await readFile(new URL('../public/assets/relations.js',import.meta.url),'utf8'),{window:relativesWindow});
    assert.deepEqual([...relativesWindow.FamilyRelations.forPerson(data,pairs[0][1]).parents],['saadia-saida-father','saadia-saida-mother']);
    assert.equal(data.people[pairs[1][1]].deceased,true);
    const gallery=await f.json(site('collections/gallery?size=all'));
    assert.ok(portraits.every(id=>gallery.items.some(item=>item.id===id)));
    f.restart();
    assert.equal((await f.json(site('people/'+pairs[0][0]+'/page'))).person.profileMediaId,portraits[0]);
    assert.equal(f.objects.size,2,'Existing bytes are reused; linking creates no extra uploads');
  }finally{f.close();}
});

test('the chart rename preserves the existing Zechariah ID, portrait, biography and later manual edits',async()=>{
  const f=fixture();try{
    // Simulate the already deployed seed before this chart was added.
    const id='keha-zechariah';
    f.database.prepare('INSERT INTO people (id,data) VALUES (?,?)').run(id,JSON.stringify({id,name:'זכריה קהא',nameEn:'Zechariah Keha',about:'זיכרון קיים',birthday:'3.4.1900',extra:true,profileId:null}));
    await f.call('/keha-extended/site-data.js');
    const initial=await f.json(site('people/'+id+'/page'));
    assert.equal(initial.person.name,'זכריה קהא הבן');
    assert.equal(initial.person.about,'זיכרון קיים');
    assert.equal(initial.person.birthday,'3.4.1900');
    const portrait=await f.json(site('people/'+id+'/photos?filename=zechariah.jpg'),{method:'POST',body:photo});
    const saved=JSON.parse(f.database.prepare('SELECT data FROM people WHERE id=?').get(id).data);
    saved.name='זכריה קהא הבן — שם משפחתי';
    f.database.prepare('UPDATE people SET data=? WHERE id=?').run(JSON.stringify(saved),id);
    f.restart();
    const next=await f.json(site('people/'+id+'/page'));
    assert.equal(next.person.name,saved.name);
    assert.equal(next.person.profileMediaId,portrait.person.profileMediaId);
    assert.equal((await f.json(site('people/saadia-ofir/page'))).person.extra,false);
  }finally{f.close();}
});

test('Shlomo’s portal keeps its family and adds the scoped stories and documents tabs',()=>{
  const tree=toOriginalFamilyData(createShlomoFamily(family));
  assert.equal(tree.title,SHLOMO_NAME);
  assert.equal(tree.units['u-root'].parent,null);
  for(const id of ['shlomo','yona','ruti','ora'])assert.ok(tree.people[id]);
  for(const id of ['margalit-nakash','yehuda-nakash','ruma-nakash','joseph-medina','kehat-hadassah','keha-zechariah'])assert.equal(tree.people[id],undefined);
  assert.equal(tree.branches.length,6);
  const {document}=parseHTML(shlomoKehaHTML(originalHTML,'https://shlomo.example'));
  assert.equal(document.title,SHLOMO_NAME);
  assert.equal(document.documentElement.dataset.nakashHome,SHLOMO_HOME);
  assert.equal(document.documentElement.dataset.nakashEntryView,'home');
  assert.equal(document.documentElement.dataset.nakashOrigin,'https://shlomo.example');
  assert.deepEqual([...document.querySelectorAll('#mainNav [data-view]')].map(node=>node.dataset.view),['tree','directory','videos','gallery','stories','documents']);
  assert.ok(!document.getElementById('extendedKehaHub'));
  assert.ok(!document.querySelector('a.branch-chip[href*="/nakash/"]'));
  assert.equal(document.querySelector('link[rel=manifest]').getAttribute('href'),SHLOMO_HOME+'manifest.webmanifest');
  const hub=parseHTML(extendedKehaHTML(originalHTML,'https://extended.example','https://shlomo.example')).document;
  assert.equal(hub.documentElement.dataset.kehaShlomoHome,'https://shlomo.example'+SHLOMO_HOME);
});

test('Shlomo’s scope shares real Keha portraits and edits while excluding the other family rosters and unrelated uploads',async()=>{
  const f=fixture();try{
    const script=await (await f.call(SHLOMO_HOME+'site-data.js')).text();
    const tree=JSON.parse(script.split('\n')[0].slice('window.FAMILY_DATA='.length,-1));
    assert.equal(tree.title,SHLOMO_NAME);
    assert.equal(tree.people['kehat-jidaan'],undefined);
    const people=await f.json(shlomoSite('tag-people'));
    assert.ok(people.people.some(p=>p.id==='ora'));
    assert.ok(!people.people.some(p=>['yehuda-nakash','ruma-nakash','kehat-jidaan'].includes(p.id)));
    const original=await f.json('/api/people/ora/page');
    await f.json(shlomoSite('people/ora/birthday'),{method:'POST',body:{birthday:'2.3.1950',expectedBirthday:original.person.birthday}});
    assert.equal((await f.json('/api/people/ora/page')).person.birthday,'2.3.1950');
    const portrait=await f.json('/api/people/ora/photos?filename=ora.jpg',{method:'POST',body:photo});
    assert.equal((await f.json(shlomoSite('people/ora/page'))).person.profileMediaId,null,'An untagged portrait stays in the original app');
    const portraitId=portrait.person.profileMediaId;
    await f.json('/api/media/'+portraitId+'/tags/patch',{method:'POST',body:{changes:[{personId:'ora',tagged:true}]}});
    const details=await f.json('/api/media/'+portraitId+'/faces');
    await f.json('/api/media/'+portraitId+'/faces/review',{method:'POST',body:{complete:true,photoRevision:'original',tagsRevision:details.item.tagsRevision}});
    assert.equal((await f.json(shlomoSite('people/ora/page'))).person.profileMediaId,portrait.person.profileMediaId);
    await f.json(shlomoSite('collections/gallery/upload?filename=ours.jpg'),{method:'POST',body:photo});
    await f.json(site('collections/gallery/upload?filename=other-branch.jpg'),{method:'POST',body:photo});
    const own=await f.json(shlomoSite('collections/gallery?size=all'));
    assert.equal(own.count,0,'An untagged upload or a child-only portrait cannot enter the founders’ main gallery');
    assert.equal((await f.json(site('collections/gallery?size=all'))).count,3);
    assert.equal((await f.call(shlomoSite('people/kehat-hadassah/page'))).status,404);
    f.restart();
    assert.equal((await f.json(shlomoSite('people/ora/page'))).person.birthday,'2.3.1950');
  }finally{f.close();}
});

test('Shlomo’s installation has its own family name and launch URL',async()=>{
  const manifest=JSON.parse(await readFile(new URL('../public/keha-extended/shlomo/manifest.webmanifest',import.meta.url)));
  const app=familyApp('shlomo',()=>Response.json(manifest));
  const root=await app.fetch(new Request('https://shlomo.example/'));
  assert.equal(new URL(root.headers.get('Location')).pathname,SHLOMO_HOME);
  const installed=await (await app.fetch(new Request('https://shlomo.example/manifest.webmanifest'))).json();
  assert.equal(installed.name,SHLOMO_NAME);
  assert.equal(installed.related_applications[0].id,'https://shlomo.example'+SHLOMO_HOME);
});

test('the Shlomo portal shares original movies only when a founder is tagged and no outsider is tagged',async()=>{
  const f=fixture();try{
    const before=(await f.json(shlomoSite('collections/videos'))).count;
    for(const [id,category] of [['c'.repeat(32),'nostalgia'],['d'.repeat(32),'nakash:yehuda']]){
      const item={id,category,kind:'video',mime:'video/mp4',file:'family.mp4',key:'legacy/'+id+'.mp4',filename:'family.mp4',createdAt:'2026-11-01T10:00:00Z'};
      f.database.prepare('INSERT INTO media (id,category,person_id,data) VALUES (?,?,?,?)').run(id,category,null,JSON.stringify(item));
    }
    const videos=await f.json(shlomoSite('collections/videos'));
    assert.equal(videos.count,before);
    assert.ok(!videos.items.some(item=>item.id==='c'.repeat(32)));
    assert.ok(!videos.items.some(item=>item.id==='d'.repeat(32)));
    assert.equal((await f.json(site('collections/videos'))).count,before);
    f.database.prepare('INSERT INTO media_tags (media_id,person_id) VALUES (?,?)').run('c'.repeat(32),'ora');
    assert.equal((await f.json(shlomoSite('collections/videos'))).count,before);
    f.database.prepare('INSERT INTO media_tags (media_id,person_id) VALUES (?,?)').run('c'.repeat(32),'yona');
    assert.equal((await f.json(shlomoSite('collections/videos'))).count,before+1);
    assert.equal((await f.json(site('collections/videos'))).count,before+1);
    f.database.prepare('INSERT INTO media_tags (media_id,person_id) VALUES (?,?)').run('c'.repeat(32),'eldad');
    assert.equal((await f.json(shlomoSite('collections/videos'))).count,before);
  }finally{f.close();}
});

test('Shlomo’s mobile and desktop tree keep all six descendant branches, including the final mobile row',async()=>{
  const source=await readFile(new URL('../public/assets/app.js',import.meta.url),'utf8');
  for(const phone of [false,true]){
    const {document,window:dom}=parseHTML(shlomoKehaHTML(originalHTML));
    const window={FAMILY_DATA:toOriginalFamilyData(createShlomoFamily(family)),addEventListener(){},dispatchEvent(){},scrollTo(){}};
    window.FamilyI18n={isEnglish:false,t:s=>s,html:(parts,...values)=>parts.reduce((out,part,index)=>out+part+(values[index]??''),''),personName:p=>p.name,branchName:b=>b?.title,searchNames:p=>p.name,date:s=>s};
    window.FamilyDates={age:()=>null,parse:()=>null};
    const context=vm.createContext({window,document,location:{hash:'#tree'},history:{pushState(){}},matchMedia:query=>({matches:phone&&query.includes('700px')}),requestAnimationFrame(){},cancelAnimationFrame(){},setInterval(){},innerWidth:phone?390:1280,innerHeight:900,CustomEvent:dom.CustomEvent});
    vm.runInContext(source,context);
    assert.equal(document.querySelectorAll('#treeNodes [data-open-branch]').length,6);
    assert.equal(document.querySelector('#treeNodes [data-person="yehuda-nakash"]'),null);
    assert.ok(document.querySelector('#treeNodes [data-person="shlomo"]'));
    if(phone)assert.equal(document.getElementById('treeWorld').style.height,'740px');
  }
});

test('one blue portal keeps the original editors, one central hub, and its own installation identity',()=>{
  const html=extendedKehaHTML(originalHTML,'https://extended.example');
  assert.ok(html.includes('<title>'+EXTENDED_NAME+'</title>'));
  assert.ok(html.includes('data-nakash-home="/keha-extended/"'));
  assert.ok(html.includes('data-nakash-origin="https://extended.example"'));
  assert.ok(html.includes('/keha-extended/brand.svg'));
  assert.ok(html.includes('/keha-extended/manifest.webmanifest'));
  assert.ok(html.indexOf('/keha-extended/hub.js')<html.indexOf('/assets/app.js'));
  assert.ok(html.includes('id="extendedKehaHub"'));
  assert.ok(html.includes('id="birthdayDialog"'));
  assert.ok(!html.includes('/nakash/'));
  assert.equal(manifest.name,EXTENDED_NAME);
  assert.equal(manifest.id,'/keha-extended/');
  assert.equal(manifest.scope,'/keha-extended/');
  assert.equal(new URL(manifest.start_url,'https://extended.example').hash,'#tree');
  assert.notEqual(manifest.theme_color,'#536641');
});

test('new family profiles persist edits and share the same dates and original portrait bytes with the Keha site',async()=>{
  const f=fixture();try{
    const response=await f.call('/keha-extended/site-data.js');
    const script=await response.text(),tree=JSON.parse(script.split('\n')[0].slice('window.FAMILY_DATA='.length,-1));
    assert.equal(tree.people['kehat-tzion'].name,'ציון קהת');
    const edit=await f.json(site('people/kehat-tzion/birthday'),{method:'POST',body:{birthday:'2.3.1930',expectedBirthday:'1.1.1111'}});
    assert.equal(edit.person.extra,false);
    assert.equal((await f.json('/api/people/kehat-tzion/page')).person.birthday,'2.3.1930');
    const uploaded=await f.json(site('people/kehat-tzion/photos?filename=tzion.jpg'),{method:'POST',body:photo});
    const root=await f.json('/api/people/kehat-tzion/page');
    assert.equal(root.person.profileMediaId,uploaded.person.profileMediaId);
    assert.equal(root.albums.photos.total,1);
    assert.equal((await f.json(site('people/kehat-tzion/page'))).person.profileMediaId,root.person.profileMediaId);
    assert.deepEqual(new Uint8Array(await (await f.call('/media/'+root.person.profileMediaId)).arrayBuffer()),new Uint8Array(photo));
    await f.json('/api/people/kehat-tzion/about',{method:'POST',body:{about:'הסיפור המשפחתי',expectedAbout:'',language:'he'}});
    f.restart();
    assert.equal((await f.json(site('people/kehat-tzion/page'))).person.about,'הסיפור המשפחתי');
    assert.equal((await f.json(site('people/kehat-tzion/page'))).person.birthday,'2.3.1930');
    assert.equal(f.objects.size,1);
    const denied=await f.call(site('people/kehat-tzion/birthday'),{method:'POST',token:'wrong',body:{birthday:'1.1.1900'}});
    assert.equal(denied.status,403);
  }finally{f.close();}
});

test('the central gallery shares tagged Keha photos and new uploads while its roster excludes Nakash branches',async()=>{
  const f=fixture();try{
    const tagged=await f.json('/api/people/ora/photos?filename=ora.jpg',{method:'POST',body:photo});
    await f.json(site('collections/gallery/upload?filename=shared.jpg'),{method:'POST',body:photo});
    const gallery=await f.json(site('collections/gallery?size=all'));
    assert.equal(gallery.count,2);
    assert.ok(gallery.items.some(item=>item.id===tagged.person.profileMediaId));
    for(const item of gallery.items)assert.ok(item.src.startsWith('/media/'));
    const roster=await f.json(site('tag-people'));
    assert.ok(roster.people.some(person=>person.id==='kehat-jidaan'));
    assert.ok(!roster.people.some(person=>person.id==='yehuda-nakash'));
    const nakash=await f.json('/nakash/api/compat/yehuda/api/tag-people');
    assert.ok(!nakash.people.some(person=>person.id==='kehat-jidaan'));
    const search=await f.json(site('search?q='+encodeURIComponent('הדוס')));
    assert.ok(search.items.some(item=>item.person?.id==='kehat-hadassah'));
  }finally{f.close();}
});

test('the extended installation launches its own hub and never uses the root Keha manifest',async()=>{
  let requested='';
  const app=familyApp('extended',async request=>{requested=request.url;return Response.json(manifest);});
  const home=await app.fetch(new Request('https://extended.example/'));
  assert.equal(new URL(home.headers.get('Location')).pathname,'/keha-extended/');
  assert.equal(new URL(home.headers.get('Location')).hash,'#tree');
  const response=await app.fetch(new Request('https://extended.example/manifest.webmanifest'));
  const installed=await response.json();
  assert.equal(new URL(requested).pathname,'/keha-extended/manifest.webmanifest');
  assert.equal(installed.related_applications[0].id,'https://extended.example/keha-extended/');
  assert.equal(installed.name,EXTENDED_NAME);
});

test('desktop and mobile separate the four family corners and keep Yissachar below them',async()=>{
  const appSource=await readFile(new URL('../public/assets/app.js',import.meta.url),'utf8');
  const hubSource=await readFile(new URL('../public/keha-extended/hub.js',import.meta.url),'utf8');
  for(const phone of [false,true]){
    const {document,window:dom}=parseHTML(extendedKehaHTML(originalHTML));
    const window={FAMILY_DATA:toOriginalFamilyData(createExtendedFamily(family)),addEventListener(){},dispatchEvent(){},scrollTo(){}};
    window.FamilyI18n={isEnglish:false,t:v=>v,html:(parts,...values)=>parts.reduce((out,part,i)=>out+part+(values[i]??''),''),personName:p=>p.name,branchName:b=>b?.title,searchNames:p=>p.name,date:v=>v};
    window.FamilyDates={age:()=>null,parse:()=>null};
    const context=vm.createContext({window,document,location:{hash:'#tree'},history:{pushState(){}},matchMedia:q=>({matches:phone&&q.includes('700px')}),requestAnimationFrame(){},cancelAnimationFrame(){},setInterval(){},innerWidth:phone?390:1280,innerHeight:900,CustomEvent:dom.CustomEvent});
    vm.runInContext(hubSource,context);vm.runInContext(appSource,context);
    assert.equal(document.querySelectorAll('#extendedKehaHub [data-family-corner]').length,4);
    for(const [id,href]of [['shlomo','/keha-extended/shlomo/#home'],['zechariah','/keha-extended/zechariah/#home'],['kehat-tzadok','/keha-extended/zechariah-tzadok/#home'],['kehat','/keha-extended/kehat/#home']])assert.equal(document.querySelector('#extendedKehaHub [data-family-corner="'+id+'"]').getAttribute('href'),href);
    assert.equal(document.querySelectorAll('#extendedKehaHub .extended-ancestor').length,2);
    assert.match(document.querySelector('#extendedKehaHub .extended-cousin-link').textContent,/בני דודים/);
    assert.match(document.querySelector('#extendedKehaHub .extended-connection-note').textContent,/קשר משפחתי ידוע/);
    assert.match(document.querySelector('#extendedKehaHub .extended-related-families').textContent,/משפחת יששכר/);
    assert.equal(document.getElementById('workspaceSubtitle').textContent,'');
    document.querySelector('#extendedKehaHub [data-branch="yissachar"]').click();
    for(const id of ['yissachar-yosef','yissachar-tzvia','yissachar-dudi','yissachar-mami','yissachar-avihai','yissachar-drori','yissachar-uri'])assert.ok(document.querySelector('#treeNodes [data-person="'+id+'"]'),id);
    assert.equal(document.querySelector('#treeNodes [data-person="tri-yissachar"]'),null);
    document.querySelector('#extendedKehaHub [data-branch="all"]').click();
    assert.equal(document.querySelectorAll('#extendedKehaHub [data-family-corner]').length,4);
    window.FamilyApp.setView('home');document.querySelector('#extendedKehaHomeHub [data-branch="yissachar"]').click();
    assert.equal(window.FamilyApp.getView(),'tree');
    assert.ok(document.querySelector('#treeNodes [data-person="yissachar-yosef"]'));
  }
});

test('the new portals retain independent identities and add stories and documents to their navigation',async()=>{
  for(const portal of Object.values(BRANCH_PORTALS)){
    const data=toOriginalFamilyData(createBranchPortal(family,portal.id));
    assert.equal(data.title,portal.name);
    assert.ok(!data.people.shlomo&&!data.people.yona&&!data.people['yehuda-nakash']);
    const expected=portal.id==='zechariah'?'saadia-aviva':portal.id==='kehat'?'kehat-jidaan':'kehat-zechariah-ben-tzadok';
    assert.ok(data.people[expected]);
    const {document}=parseHTML(branchPortalHTML(originalHTML,portal.id,'https://'+portal.id+'.example'));
    assert.equal(document.title,portal.name);
    assert.equal(document.documentElement.dataset.nakashHome,portal.home);
    assert.equal(document.documentElement.dataset.nakashEntryView,'home');
    assert.equal(document.documentElement.dataset.nakashOrigin,'https://'+portal.id+'.example');
    assert.deepEqual([...document.querySelectorAll('#mainNav [data-view]')].map(node=>node.dataset.view),['tree','directory','videos','gallery','stories','documents']);
    assert.ok(document.getElementById('homeTiles'));
    assert.equal(document.querySelector('meta[name="theme-color"]').getAttribute('content'),portal.color);
    assert.ok(document.querySelector('a.branch-chip[href="https://family-extended.eldadkeha.workers.dev/keha-extended/#tree"]'));
    const ownManifest=JSON.parse(await readFile(new URL('../public'+portal.home+'manifest.webmanifest',import.meta.url)));
    const app=familyApp(portal.id,()=>Response.json(ownManifest));
    const response=await app.fetch(new Request('https://'+portal.id+'.example/manifest.webmanifest'));
    const installed=await response.json();
    assert.equal(installed.name,portal.name);assert.equal(installed.id,portal.home);
    assert.equal(installed.related_applications[0].id,'https://'+portal.id+'.example'+portal.home);
    assert.match(installed.start_url,new RegExp('familyApp='+portal.id));
    const {document:page,window:dom}=parseHTML(branchPortalHTML(originalHTML,portal.id));
    const window={FAMILY_DATA:data,addEventListener(){},dispatchEvent(){},scrollTo(){}};
    window.FamilyI18n={isEnglish:false,t:v=>v,html:(parts,...values)=>parts.reduce((out,part,index)=>out+part+(values[index]??''),''),personName:p=>p.name,branchName:b=>b?.title,searchNames:p=>p.name,date:v=>v};window.FamilyDates={age:()=>null,parse:()=>null};
    const context=vm.createContext({window,document:page,location:{hash:'#home'},history:{pushState(){}},matchMedia:()=>({matches:false}),requestAnimationFrame(){},cancelAnimationFrame(){},setInterval(){},innerWidth:1280,innerHeight:900,CustomEvent:dom.CustomEvent});
    vm.runInContext(await readFile(new URL('../public/assets/app.js',import.meta.url),'utf8'),context);
    window.FamilyApp.setView('tree');
    assert.equal(page.getElementById('workspaceSubtitle').textContent,portal.tagline);
    window.FamilyApp.getView=()=>'tree';
    context.clearTimeout=()=>{};context.setTimeout=()=>{};
    vm.runInContext(await readFile(new URL('../public/assets/home.js',import.meta.url),'utf8'),context);
    page.dispatchEvent(new dom.Event('DOMContentLoaded'));
    assert.equal(page.querySelectorAll('#homeTiles .home-tile').length,6);
    if(portal.id==='kehat')assert.match(page.querySelector('#homeTiles .home-tile-tree').textContent,/סעדיה/);
  }
});

test('each portal can edit profiles and upload documents/photos while the central hub shares their records',async()=>{
  const f=fixture();try{
    const path=(branch,part)=>BRANCH_PORTALS[branch].home+'api/compat/api/'+part;
    for(const [branch,id,other] of [['zechariah','saadia-aviva','kehat-jidaan'],['kehat','kehat-hadassah','kehat-naomi'],['zechariah-tzadok','kehat-naomi','kehat-jidaan']]){
      const before=await f.json(path(branch,'people/'+id+'/page'));
      await f.json(path(branch,'people/'+id+'/about'),{method:'POST',body:{about:'סיפור משפחתי חדש',expectedAbout:before.person.about||'',language:'he'}});
      assert.equal((await f.json(site('people/'+id+'/page'))).person.about,'סיפור משפחתי חדש');
      await f.json(path(branch,'people/'+id+'/documents?filename=marriage.jpg'),{method:'POST',body:photo});
      assert.equal((await f.json(site('people/'+id+'/page'))).albums.documents.total,before.albums.documents.total+1);
      await f.json(path(branch,'collections/gallery/upload?filename=family.jpg'),{method:'POST',body:photo});
      const gallery=await f.json(path(branch,'collections/gallery?size=all'));
      assert.equal(gallery.count,1);
      await f.json(path(branch,'media/'+gallery.items[0].id+'/tags/patch'),{method:'POST',body:{changes:[{name:'קרוב נוסף '+branch,tagged:true}]}});
      assert.ok((await f.json(site('tag-people'))).people.some(p=>p.name==='קרוב נוסף '+branch));
      assert.equal((await f.call(path(branch,'people/'+other+'/page'))).status,404);
      const roster=await f.json(path(branch,'tag-people'));
      assert.ok(roster.people.some(p=>p.id===id));assert.ok(!roster.people.some(p=>p.id===other));
    }
    assert.equal((await f.json(site('collections/gallery?size=all'))).count,3);
    f.restart();
    assert.equal((await f.json(path('zechariah','people/saadia-aviva/page'))).albums.documents.total,1);
  }finally{f.close();}
});

test('the separated Kehat and Tzadok portals render their complete trees on desktop and mobile',async()=>{
  const app=await readFile(new URL('../public/assets/app.js',import.meta.url),'utf8'),hook=await readFile(new URL('../public/keha-extended/portal-tree.js',import.meta.url),'utf8');
  for(const portal of ['kehat','zechariah-tzadok'])for(const phone of [false,true]){
    const {document,window:dom}=parseHTML(branchPortalHTML(originalHTML,portal));
    const data=toOriginalFamilyData(createBranchPortal(family,portal));
    const window={FAMILY_DATA:data,addEventListener(){},dispatchEvent(){},scrollTo(){}};
    window.FamilyI18n={isEnglish:false,t:v=>v,html:(parts,...values)=>parts.reduce((out,part,i)=>out+part+(values[i]??''),''),personName:p=>p.name,branchName:b=>b?.title,searchNames:p=>p.name,date:v=>v};window.FamilyDates={age:()=>null,parse:()=>null};
    const context=vm.createContext({window,document,location:{hash:'#tree'},history:{pushState(){}},matchMedia:q=>({matches:phone&&q.includes('700px')}),requestAnimationFrame(){},cancelAnimationFrame(){},setInterval(){},innerWidth:phone?390:1280,innerHeight:900,CustomEvent:dom.CustomEvent});
    vm.runInContext(hook,context);vm.runInContext(app,context);
    assert.equal(document.querySelector('#kehatPortalOverview'),null);
    const expected=portal==='kehat'?['kehat-aharon-elder','kehat-jidaan','kehat-zechariah','tri-yona','tri-menachem','tri-hana']:['kehat-tzadok-elder','kehat-zechariah-ben-tzadok','kehat-shori','kehat-mordechai','kehat-naomi'];
    for(const id of [...expected,'kehat-yaakov','kehat-yaakov-yehudit','kehat-gila'])assert.ok(document.querySelector('#treeNodes [data-person="'+id+'"]'),portal+': '+id);
    const absent=portal==='kehat'?'kehat-zechariah-ben-tzadok':'kehat-jidaan';
    assert.equal(document.querySelector('#treeNodes [data-person="'+absent+'"]'),null);
    assert.equal(document.querySelectorAll('#treeNodes [data-person="kehat-yaakov"]').length,1);
    assert.equal(document.querySelectorAll('#treeNodes [data-person="kehat-yaakov-yehudit"]').length,1);
    assert.ok(document.querySelector('[data-extended-install-link]').getAttribute('href').endsWith('/keha-extended/?install=1#home'));
  }
});

test('Jidaan stays below Aharon with each marriage’s descendants on its own side',async()=>{
  const app=await readFile(new URL('../public/assets/app.js',import.meta.url),'utf8');
  for(const portal of [false,true])for(const phone of [false,true])for(const english of [false,true])for(const text of [100,160]){
    const {document,window:dom}=parseHTML(portal?branchPortalHTML(originalHTML,'kehat'):extendedKehaHTML(originalHTML));
    const data=toOriginalFamilyData(portal?createBranchPortal(family,'kehat'):createExtendedFamily(family));
    const window={FAMILY_DATA:data,addEventListener(){},dispatchEvent(){},scrollTo(){},FamilyAccessibility:{getSettings:()=>({text})}};
    window.FamilyI18n={isEnglish:english,t:v=>v,html:(parts,...values)=>parts.reduce((out,part,index)=>out+part+(values[index]??''),''),personName:p=>p.name,branchName:b=>b?.title,searchNames:p=>p.name,date:v=>v};
    window.FamilyDates={age:()=>null,parse:()=>null};
    vm.runInNewContext(app,{window,document,location:{hash:'#tree'},history:{pushState(){}},matchMedia:q=>({matches:phone&&q.includes('700px')}),requestAnimationFrame(){},cancelAnimationFrame(){},setInterval(){},innerWidth:phone?390:1280,innerHeight:900,CustomEvent:dom.CustomEvent});
    document.querySelector('#branchBar [data-branch="kehat"]').click();
    const bounds=id=>{
      const node=document.querySelector('#treeNodes [data-unit="'+(id===data.root?'u-root':id)+'"]');
      const left=parseFloat(node.style.left),width=parseFloat(node.style.width);
      return {left,right:left+width,center:left+width/2};
    };
    const main=bounds('u-keha-kehat'),ancestor=bounds('u-kehat-aharon-elder');
    assert.ok(Math.abs(ancestor.center-main.center)<0.001,'The ancestor connects straight down to Jidaan');
    const cards=[...document.querySelectorAll('[data-unit="u-keha-kehat"] [data-person-card]')].map(node=>node.dataset.personCard);
    assert.deepEqual(cards,['kehat-first-wife','kehat-jidaan','kehat-miriam']);
    const [first,second]=data.units['u-keha-kehat'].relationships;
    assert.equal(data.units['u-keha-kehat'].relationships.length,2);
    const descendants=ids=>ids.flatMap(id=>[id,...descendants(data.units[id].children)]);
    for(const [relation,right] of [[first,!english],[second,english]]){
      for(const id of descendants(relation.children)){
        const child=bounds(id);
        assert.ok(right?child.left>main.right:child.right<main.left,'Every descendant stays on their mother’s side: '+id);
      }
      const connector=document.querySelector('[data-parent-unit="u-keha-kehat"][data-parent-people="'+relation.people.join(' ')+'"]');
      assert.equal(connector.dataset.childUnits,relation.children.join(' '));
    }
    assert.deepEqual(second.children,['u-kehat-tzion','u-kehat-shula','u-kehat-tzvia','u-kehat-hadassah']);
    const centers=second.children.map(id=>bounds(id).center);
    assert.ok(centers.every((center,index)=>index===0||(english?center>centers[index-1]:center<centers[index-1])),'The four second-marriage branches follow the confirmed order');
    assert.equal(document.querySelectorAll('[data-unit="u-keha-kehat"] .tree-partnerships path').length,2);
  }
});


test('archival birth years migrate once, retaining later family edits and year precision',async()=>{
  const f=fixture();try{
    const path='/keha-extended/kehat/api/compat/api/people/tri-esther/page';
    const page=await f.json(path);
    assert.equal(page.person.birthYear,1934);
    assert.equal(page.person.birthday,'1.1.1111');
    assert.match(page.person.birthYearSource,/1954/);
    const saved=JSON.parse(f.database.prepare('SELECT data FROM people WHERE id=?').get('tri-esther').data);
    saved.birthYear=1935;saved.about='A later family correction';
    f.database.prepare('UPDATE people SET data=? WHERE id=?').run(JSON.stringify(saved),saved.id);
    f.restart();
    const again=await f.json(path);
    assert.equal(again.person.birthYear,1935);
    assert.equal(again.person.about,'A later family correction');
  }finally{f.close();}
});

test('the new Yona profile receives the same uploaded scan without duplicating or replacing its original',async()=>{
  const f=fixture();try{
    const id='993b035c6bdf42fdb37950489f291c92';
    const item={id,category:'personal',personId:'kehat-zechariah',documentPeople:['kehat-zechariah','tri-menachem'],kind:'document',mime:'application/pdf',filename:'Yona_Keha_Tiri_Childbirth_Prize_1954_1955.pdf',file:id+'.pdf',key:'documents/original.pdf',size:1153063,caption:'The original archival description',createdAt:'2026-11-21T00:00:00Z'};
    f.database.prepare('INSERT INTO media(id,category,person_id,data) VALUES(?,?,?,?)').run(id,item.category,item.personId,JSON.stringify(item));
    const page=await f.json('/keha-extended/kehat/api/compat/api/people/tri-yona/page');
    assert.equal(page.albums.documents.total,1);
    assert.equal(page.albums.documents.items[0].id,id);
    assert.equal(page.albums.documents.items[0].caption,item.caption);
    const saved=JSON.parse(f.database.prepare('SELECT data FROM media WHERE id=?').get(id).data);
    assert.equal(saved.key,item.key);
    assert.deepEqual(saved.documentPeople,['kehat-zechariah','tri-menachem','tri-yona']);
    f.restart();
    assert.equal((await f.json('/keha-extended/kehat/api/compat/api/people/tri-yona/page')).albums.documents.total,1);
    assert.equal(f.database.prepare('SELECT COUNT(*) AS n FROM media WHERE id=?').get(id).n,1);
  }finally{f.close();}
});


test('separate family projections share the marriage couple without importing the other founder or creating duplicate units',async()=>{
  const source=createExtendedFamily(family);
  for(const [portal,founder,absent]of [['kehat','kehat-jidaan','kehat-zechariah-ben-tzadok'],['zechariah-tzadok','kehat-zechariah-ben-tzadok','kehat-jidaan']]){
    const tree=createBranchPortal(family,portal),data=toOriginalFamilyData(tree);
    assert.ok(data.people[founder]);assert.equal(data.people[absent],undefined);
    for(const id of ['kehat-yaakov','kehat-yaakov-yehudit','kehat-havazelet','kehat-ari','kehat-gila']){
      assert.equal(data.people[id].id,source.people[id].id);
      assert.ok(data.units[data.people[id].unit]);
    }
    const pair=Object.values(data.units).filter(u=>u.people.includes('kehat-yaakov')&&u.people.includes('kehat-yaakov-yehudit'));
    assert.equal(pair.length,1);
    assert.equal(data.people['kehat-yaakov'].generation,data.people['kehat-yaakov-yehudit'].generation);
    assert.equal(data.people['kehat-gila'].generation,data.people['kehat-yaakov'].generation+1);
    for(const child of pair[0].children)assert.equal(data.units[child].parent,pair[0].id);
  }
});

test('Yosef and Tzvia Yissachar remain distinct from both Tri brothers and have no invented ancestors',()=>{
  const data=toOriginalFamilyData(createExtendedFamily(family));
  assert.deepEqual(data.units['u-keha-yissachar'].people,['yissachar-yosef','yissachar-tzvia']);
  assert.equal(data.units['u-keha-yissachar'].parent,null);
  assert.deepEqual(data.units['u-keha-yissachar'].children.map(id=>data.people[data.units[id].people[0]].name),['דודי','ממי','אביחי','דרורי','אורי']);
  assert.equal(data.people['yissachar-yosef'].parents,undefined);
  assert.notEqual(data.people['yissachar-yosef'].id,data.people['keha-yosef-yissachar'].id);
  assert.notEqual(data.people['yissachar-yosef'].id,data.people['tri-yissachar'].id);
  assert.equal(data.people['yissachar-yosef'].branch,'yissachar');
  assert.equal(createBranchPortal(family,'kehat').people['yissachar-yosef'],undefined);
});

test('the eight family sites have distinct palettes and each branch keeps its own installation identity',async()=>{
  const {BRANCHES}=await import('../public/nakash/family-data.mjs');
  const {EXTENDED_COLOR}=await import('../public/keha-extended/family-data.mjs');
  const colors=[...BRANCHES.map(b=>b.color),EXTENDED_COLOR,...Object.values(BRANCH_PORTALS).map(p=>p.color)];
  assert.equal(colors.length,8);assert.equal(new Set(colors.map(c=>c.toLowerCase())).size,8);
  for(const portal of Object.values(BRANCH_PORTALS)){
    const manifest=JSON.parse(await readFile(new URL('../public'+portal.home+'manifest.webmanifest',import.meta.url)));
    assert.equal(manifest.theme_color,portal.color);assert.equal(manifest.background_color,portal.color);
    assert.equal(manifest.scope,portal.home);assert.equal(manifest.id,portal.home);
  }
});

test('public Keha trees keep life years concise in both languages and omit younger couples’ wedding years',async()=>{
  const app=await readFile(new URL('../public/assets/app.js',import.meta.url),'utf8'),dates=await readFile(new URL('../public/assets/dates.js',import.meta.url),'utf8');
  for(const phone of [false,true])for(const english of [false,true]){
    const {document,window:dom}=parseHTML(branchPortalHTML(originalHTML,'kehat'));
    const data=toOriginalFamilyData(createBranchPortal(family,'kehat'));
    data.units['u-tri-binyamin'].weddingYear=1968;
    const esther=data.people['tri-esther'];esther.birthday='17.3.1980';
    data.people['test-young-partner']={id:'test-young-partner',name:'בת זוג לדוגמה',englishName:'Example partner',birthday:'1.1.1981',gender:'f',unit:'u-tri-esther',branch:'kehat'};
    Object.assign(data.units['u-tri-esther'],{people:['tri-esther','test-young-partner'],relationship:'spouse',weddingYear:2010});
    data.people['tri-hana'].deathYear=2020;data.people['tri-hana'].deceased=true;
    const window={FAMILY_DATA:data,addEventListener(){},dispatchEvent(){},scrollTo(){}};
    window.FamilyI18n={isEnglish:english,locale:english?'en-GB':'he-IL',t:v=>v,html:(parts,...values)=>parts.reduce((out,part,index)=>out+part+(values[index]??''),''),personName:p=>english?(p.englishName||p.name):p.name,branchName:b=>b?.title,searchNames:p=>p.name,date:v=>v};
    const context=vm.createContext({window,document,navigator:{userAgent:'Windows'},location:{hash:'#tree/kehat'},history:{pushState(){}},matchMedia:q=>({matches:phone&&q.includes('700px')}),requestAnimationFrame(){},cancelAnimationFrame(){},setInterval(){},innerWidth:phone?390:1280,innerHeight:900,CustomEvent:dom.CustomEvent});
    context.Date=class extends Date{constructor(...args){super(...(args.length?args:[2026,10,21]));}};
    vm.runInContext(dates,context);vm.runInContext(app,context);
    const card=id=>document.querySelector('#treeNodes [data-person-card="'+id+'"]');
    assert.equal(card('tri-esther').querySelector('[data-tree-birth-year]').textContent,(english?'Born: ':'לידה: ')+'1980');
    assert.equal(card('tri-esther').querySelector('.person-partnership'),null);
    assert.equal(card('test-young-partner').querySelector('.person-partnership'),null);
    assert.equal(card('tri-shifra').querySelector('.person-partnership').textContent,(english?'Married: ':'נישואין: ')+'1968');
    assert.equal(card('tri-hana').querySelector('[data-tree-death-year]').textContent,(english?'Died: ':'פטירה: ')+'2020');
    assert.doesNotMatch(document.getElementById('treeNodes').textContent,/שאלון|פרס ילודה|Calculated age|Would be|Moved to Israel|\d{1,2}\.\d{1,2}\.\d{4}/);
    window.FamilyApp.updatePerson('tri-esther',{birthday:'8.9.1979'});
    assert.equal(card('tri-esther').querySelector('[data-tree-birth-year]').textContent,(english?'Born: ':'לידה: ')+'1979');
    assert.match(window.FamilyApp.birthdayHTML('tri-esther'),/8\.9\.1979/,'The profile keeps the full date');
  }
});

test('known Tri death dates populate existing profiles once and preserve family corrections',async()=>{
  const f=fixture();try{
    const id='keha-yosef-yissachar';
    f.database.prepare('INSERT INTO people (id,data) VALUES (?,?)').run(id,JSON.stringify({id,name:'יוסף טרי (קהא)',birthday:'1.1.1111',about:'זיכרון משפחתי',profileId:'portrait-to-preserve'}));
    const first=await f.json(site('people/'+id+'/page'));
    assert.equal(first.person.deathDate,'15.7.1985');assert.equal(first.person.about,'זיכרון משפחתי');
    assert.equal((await f.json(site('people/tri-yissachar/page'))).person.deathDate,'13.4.1996');
    const saved=JSON.parse(f.database.prepare('SELECT data FROM people WHERE id=?').get(id).data);
    assert.equal(saved.profileId,'portrait-to-preserve');saved.deathDate='16.7.1985';
    f.database.prepare('UPDATE people SET data=? WHERE id=?').run(JSON.stringify(saved),id);
    f.restart();assert.equal((await f.json(site('people/'+id+'/page'))).person.deathDate,'16.7.1985');
  }finally{f.close();}
});

test('historical year enrichment reaches already deployed profiles once and retains exact family dates and portraits',async()=>{
  const f=fixture();try{
    // These earlier migrations have already run in production.
    for(const migration of ['extended-kehat-certificate-families-2026-11-20-v1','extended-kehat-shlomo-sarah-esther-2026-11-21-v1','extended-tri-childbirth-archive-1954-2026-11-21-v1'])f.database.prepare('INSERT INTO meta(id,value) VALUES(?,?)').run(migration,'done');
    const before={id:'kehat-jidaan',name:'סעדיה המשפחתי',birthday:'1.1.1111',about:'זיכרון אישי שמור',profileId:'existing-portrait'};
    f.database.prepare('INSERT INTO people(id,data) VALUES(?,?)').run(before.id,JSON.stringify(before));
    const father=(await f.json(site('people/kehat-jidaan/page'))).person;
    assert.equal(father.name,before.name);assert.equal(father.about,before.about);
    assert.equal(father.birthYearMin,1870);assert.equal(father.birthYearMax,1877);assert.equal(father.birthYear,null);
    assert.equal(father.deathDate,'9.12.1962');assert.equal(father.deceased,true);
    assert.equal((await f.json(site('people/kehat-miriam/page'))).person.birthYear,1912);
    const son=(await f.json(site('people/kehat-zechariah/page'))).person;
    assert.equal(son.deathYear,1979);assert.equal(son.deathDate,undefined,'A year is not converted to a fabricated full date');
    const source=f.database.prepare('SELECT data FROM people WHERE id=?').get(before.id),saved=JSON.parse(source.data);
    assert.equal(saved.profileId,before.profileId);
    const backupKey='extended-historical-life-years-2026-11-21-v1:backup:'+before.id;
    assert.equal(JSON.parse(f.database.prepare('SELECT value FROM meta WHERE id=?').get(backupKey).value).profileId,before.profileId);
    saved.birthday='3.4.1874';saved.deathDate='10.12.1962';saved.researchNotes='תיקון מחקר מאוחר';
    f.database.prepare('UPDATE people SET data=? WHERE id=?').run(JSON.stringify(saved),before.id);
    f.restart();const later=(await f.json(site('people/kehat-jidaan/page'))).person;
    assert.equal(later.birthday,saved.birthday);assert.equal(later.deathDate,saved.deathDate);assert.equal(later.researchNotes,saved.researchNotes);
    assert.equal(f.database.prepare('SELECT COUNT(*) AS n FROM meta WHERE id=?').get(backupKey).n,1);
  }finally{f.close();}
});

test('concise life and marriage years reach both independent Kehat families and the other public Keha trees',async()=>{
  const app=await readFile(new URL('../public/assets/app.js',import.meta.url),'utf8'),dates=await readFile(new URL('../public/assets/dates.js',import.meta.url),'utf8');
  for(const portal of ['kehat','zechariah-tzadok','zechariah','shlomo'])for(const phone of [false,true])for(const english of [false,true]){
    const {document,window:dom}=parseHTML(portal==='shlomo'?shlomoKehaHTML(originalHTML):branchPortalHTML(originalHTML,portal));
    const data=toOriginalFamilyData(portal==='shlomo'?createShlomoFamily(family):createBranchPortal(family,portal));
    const window={FAMILY_DATA:data,addEventListener(){},dispatchEvent(){},scrollTo(){}};
    window.FamilyI18n={isEnglish:english,locale:english?'en-GB':'he-IL',t:v=>v,html:(parts,...values)=>parts.reduce((out,part,index)=>out+part+(values[index]??''),''),personName:p=>english?(p.englishName||p.name):p.name,branchName:b=>b?.title,searchNames:p=>p.name,date:v=>v};
    const context=vm.createContext({window,document,navigator:{userAgent:'Windows'},location:{hash:'#tree'},history:{pushState(){}},matchMedia:q=>({matches:phone&&q.includes('700px')}),requestAnimationFrame(){},cancelAnimationFrame(){},setInterval(){},innerWidth:phone?390:1280,innerHeight:900,CustomEvent:dom.CustomEvent});
    context.Date=class extends Date{constructor(...args){super(...(args.length?args:[2026,10,21]));}};
    vm.runInContext(dates,context);vm.runInContext(app,context);document.getElementById('fullTreeButton').click();
    const card=id=>document.querySelector('#treeNodes [data-person-card="'+id+'"]');
    const born=(id,year)=>assert.equal(card(id).querySelector('[data-tree-birth-year]').textContent,(english?'Born: ':'לידה: ')+year);
    const died=(id,year)=>assert.equal(card(id).querySelector('[data-tree-death-year]').textContent,(english?'Died: ':'פטירה: ')+year);
    const married=year=>assert.ok([...document.querySelectorAll('#treeNodes .person-partnership')].some(e=>e.textContent===(english?'Married: ':'נישואין: ')+year),portal+': '+year);
    if(portal==='kehat'){
      born('kehat-zechariah',1902);born('tri-yona',1912);born('tri-esther',1934);
      born('kehat-jidaan','1870–1877');died('kehat-jidaan',1962);born('kehat-miriam',1912);
      born('kehat-shlomo','1896–1903');died('kehat-zechariah',1979);
      born('kehat-aharon','1904–1906');died('kehat-aharon','1977?');
      assert.ok(card('kehat-aharon').querySelector('[data-tree-death-year][data-year-candidate] abbr[title]'));
      assert.equal(card('kehat-jidaan').querySelector('[data-year-candidate]'),null);
      assert.match(window.FamilyApp.birthdayHTML('kehat-zechariah'),english?/Died in <bdi dir="ltr">1979/:/נפטר ב־<bdi dir="ltr">1979/);
      died('kehat-hadassah',2015);died('keha-yosef-yissachar',1985);died('tri-yissachar',1996);married(1947);
      assert.equal(card('tri-binyamin').querySelector('[data-tree-death-year]'),null,'Burial is not a death date');
    }else if(portal==='zechariah-tzadok'){
      born('kehat-tzadok','1915–1917');born('kehat-yaakov-yehudit','1923–1924');
      for(const year of [1944,1946,1947])married(year);
      assert.equal(card('kehat-amna').querySelector('[data-tree-death-year]'),null,'A death bound is not an exact death year');
      died('kehat-naomi','1982?');died('kehat-israel-mizrahi','1990?');
      born('kehat-zechariah-ben-tzadok','1891–1892?');died('kehat-zechariah-ben-tzadok','1947?');
      assert.ok(card('kehat-naomi').querySelector('[data-tree-death-year][data-year-candidate]'));
    }else if(portal==='zechariah'){
      born('saadia-shalom',1923);born('saadia-saadia',1918);married(1949);married(1945);
    }else{
      born('shlomo',1907);born('yona',1921);died('shlomo',1996);died('yona',2010);married(1938);
    }
    assert.doesNotMatch(document.getElementById('treeNodes').textContent,/שאלון|פרס ילודה|פנקס|גיל מחושב|בחיים היום|Calculated age|Would be|Moved to Israel|\d{1,2}\.\d{1,2}\.\d{4}/);
  }
});

test('the public tree reuses saved wedding years and respects a deliberately cleared date',async()=>{
  const f=fixture();try{
    const path='/keha-extended/shlomo/site-data.js';
    await f.call(path);
    const change=(id,date)=>{
      const record=JSON.parse(f.database.prepare('SELECT data FROM weddings WHERE id=?').get(id).data);record.date=date;
      f.database.prepare('UPDATE weddings SET data=? WHERE id=?').run(JSON.stringify(record),id);
    };
    change('u-fish','9.9.1980');change('u-root','');
    const window={};vm.runInNewContext(await (await f.call(path)).text(),{window});
    assert.equal(window.FAMILY_DATA.units['u-fish'].weddingYear,1980);
    assert.equal(window.FAMILY_DATA.units['u-fish'].weddingDate,'9.9.1980');
    assert.equal(window.FAMILY_DATA.units['u-root'].weddingYear,undefined);
    assert.equal(window.FAMILY_DATA.units['u-root'].weddingDate,'');
  }finally{f.close();}
});

test('Saadia remains Keha after the children’s surname changes and an already deployed profile is corrected once',async()=>{
  const f=fixture();try{
    const id='kehat-jidaan',path=site('people/'+id+'/page');
    await f.json(path);
    const saved=JSON.parse(f.database.prepare('SELECT data FROM people WHERE id=?').get(id).data);
    Object.assign(saved,{name:'סעדיה (ג׳ידעאן) בן אהרון קהת',nameEn:'Saadia (Jidaan) Kehat, son of Aharon',englishName:'Saadia (Jidaan) Kehat, son of Aharon',firstName:'סעדיה (ג׳ידעאן)',lastName:'קהת',profileId:'existing-saadia-portrait',about:'זיכרון משפחתי שמור',aliases:['סעדיה בן אהרון קהת','שם מחקר נוסף']});
    f.database.prepare('UPDATE people SET data=? WHERE id=?').run(JSON.stringify(saved),id);
    const migration='extended-saadia-jidaan-keha-surname-2026-11-21-v1';
    f.database.prepare('DELETE FROM meta WHERE id=? OR id=?').run(migration,migration+':backup:'+id);
    f.restart();
    const corrected=(await f.json(path)).person;
    assert.equal(corrected.id,id);assert.equal(corrected.name,'סעדיה (ג׳ידעאן) בן אהרון קהא');
    assert.equal(corrected.nameEn,'Saadia (Jidaan) Keha, son of Aharon');
    assert.equal(corrected.firstName,undefined);assert.equal(corrected.lastName,undefined);
    assert.equal(corrected.birthYearMin,1870);assert.equal(corrected.birthYearMax,1877);
    assert.equal(corrected.deathDate,'9.12.1962');assert.equal(corrected.about,saved.about);
    assert.ok(corrected.aliases.includes('שם מחקר נוסף'));assert.ok(!corrected.aliases.some(alias=>/קהת|Kehat/.test(alias)));
    const stored=JSON.parse(f.database.prepare('SELECT data FROM people WHERE id=?').get(id).data);
    assert.equal(stored.profileId,'existing-saadia-portrait');
    assert.match((await f.json(site('people/kehat-yaakov/page'))).person.name,/קהת/);
    const tree=createExtendedFamily(family);
    assert.equal(tree.people['kehat-jidaan'].name,'סעדיה (ג׳ידעאן) בן אהרון קהא');
    assert.equal(tree.people['kehat-yaakov'].name,'יעקב קהת');
    assert.equal(tree.people['kehat-shlomo'].name,'שלמה קהת');
    const backup=migration+':backup:'+id;
    assert.equal(JSON.parse(f.database.prepare('SELECT value FROM meta WHERE id=?').get(backup).value).profileId,'existing-saadia-portrait');
    f.restart();assert.equal((await f.json(path)).person.name,corrected.name);
  }finally{f.close();}
});
