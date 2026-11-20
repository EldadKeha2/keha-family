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
import {extendedKehaHTML,shlomoKehaHTML} from '../src/extended-keha.mjs';
import {createShlomoFamily,SHLOMO_NAME,SHLOMO_HOME} from '../public/keha-extended/shlomo-data.mjs';
import {familyApp} from '../family-apps/worker.mjs';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';

const originalHTML=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
const photo=await readFile(new URL('./fixtures/photo.jpg',import.meta.url));
const manifest=JSON.parse(await readFile(new URL('../public/keha-extended/manifest.webmanifest',import.meta.url)));
const site=path=>'/keha-extended/api/compat/api/'+path;
const shlomoSite=path=>SHLOMO_HOME+'api/compat/api/'+path;
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

test('only the two confirmed cousin branches share paternal kinship; Kehat and Yissachar remain independent',()=>{
  const tree=createExtendedFamily(family),data=toOriginalFamilyData(tree);
  assert.equal(data.title,EXTENDED_NAME);
  assert.equal(data.branches.length,4);
  assert.equal(data.units['u-root'].parent,'u-keha-zechariah-father');
  assert.equal(data.units['u-keha-zechariah'].parent,'u-saadia-elder');
  for(const id of ['u-keha-kehat','u-keha-yissachar','u-keha-zechariah-father','u-saadia-elder'])assert.equal(data.units[id].parent,null);
  assert.equal(data.people['zecharia-nakash'],undefined);
  assert.equal(data.people['margalit-nakash'],undefined);
  assert.deepEqual(data.units['u-keha-zechariah'].people,['keha-zechariah','keha-yehudit']);
  assert.equal(data.units['u-keha-kehat'].children.length,8);
  assert.equal(data.units['u-keha-yissachar'].children.length,0);
  assert.ok(data.people['kehat-hadassah'].aliases.includes('הדוס'));
  assert.notEqual(data.people['kehat-miriam'].id,data.people['kehat-yaakov-miriam'].id);
  assert.equal(data.people.ora.id,family.people.ora.id);
  assert.equal(data.people['kehat-tzion'].branch,'kehat');
  assert.equal(createFamily(family).people['kehat-jidaan'],undefined);
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
  for(const person of Object.values(data.people))assert.ok(data.units[person.unit]);
  for(const unit of Object.values(data.units))for(const child of unit.children)assert.equal(data.units[child].parent,unit.id);
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

test('Shlomo’s portal contains only Yona, Shlomo and their descendants, with the four familiar tabs',()=>{
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
  assert.deepEqual([...document.querySelectorAll('#mainNav [data-view]')].map(node=>node.dataset.view),['tree','directory','videos','gallery']);
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
    assert.equal((await f.json(shlomoSite('people/ora/page'))).person.profileMediaId,portrait.person.profileMediaId);
    await f.json(shlomoSite('collections/gallery/upload?filename=ours.jpg'),{method:'POST',body:photo});
    await f.json(site('collections/gallery/upload?filename=other-branch.jpg'),{method:'POST',body:photo});
    const own=await f.json(shlomoSite('collections/gallery?size=all'));
    assert.equal(own.count,2);
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

test('the Shlomo portal includes original untagged family movies without importing other families’ uploads',async()=>{
  const f=fixture();try{
    const before=(await f.json(shlomoSite('collections/videos'))).count;
    for(const [id,category] of [['c'.repeat(32),'nostalgia'],['d'.repeat(32),'nakash:yehuda']]){
      const item={id,category,kind:'video',mime:'video/mp4',file:'family.mp4',key:'legacy/'+id+'.mp4',filename:'family.mp4',createdAt:'2026-11-01T10:00:00Z'};
      f.database.prepare('INSERT INTO media (id,category,person_id,data) VALUES (?,?,?,?)').run(id,category,null,JSON.stringify(item));
    }
    const videos=await f.json(shlomoSite('collections/videos'));
    assert.equal(videos.count,before+1);
    assert.ok(videos.items.some(item=>item.id==='c'.repeat(32)));
    assert.ok(!videos.items.some(item=>item.id==='d'.repeat(32)));
    assert.equal((await f.json(site('collections/videos'))).count,before+1);
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
  const response=await app.fetch(new Request('https://extended.example/manifest.webmanifest'));
  const installed=await response.json();
  assert.equal(new URL(requested).pathname,'/keha-extended/manifest.webmanifest');
  assert.equal(installed.related_applications[0].id,'https://extended.example/keha-extended/');
  assert.equal(installed.name,EXTENDED_NAME);
});

test('desktop and mobile keep all four circles on one hub, expand each branch in place, and open branches from Home',async()=>{
  const appSource=await readFile(new URL('../public/assets/app.js',import.meta.url),'utf8');
  const hubSource=await readFile(new URL('../public/keha-extended/hub.js',import.meta.url),'utf8');
  for(const phone of [false,true]){
    const {document,window:dom}=parseHTML(extendedKehaHTML(originalHTML));
    const window={FAMILY_DATA:toOriginalFamilyData(createExtendedFamily(family)),addEventListener(){},dispatchEvent(){},scrollTo(){}};
    window.FamilyI18n={isEnglish:false,t:value=>value,html:(parts,...values)=>parts.reduce((output,part,index)=>output+part+(values[index]??''),''),personName:person=>person.name,branchName:branch=>branch?.title,searchNames:person=>person.name,date:value=>value};
    window.FamilyDates={age:()=>null,parse:()=>null};
    const location={hash:'#tree'};
    const context=vm.createContext({window,document,location,history:{pushState(){}},matchMedia:query=>({matches:phone&&query.includes('700px')}),requestAnimationFrame(){},cancelAnimationFrame(){},setInterval(){},innerWidth:phone?390:1280,innerHeight:900,CustomEvent:dom.CustomEvent});
    vm.runInContext(hubSource,context);vm.runInContext(appSource,context);
    assert.equal(document.querySelectorAll('#extendedKehaHub .extended-branch-circle').length,4);
    assert.equal(document.querySelectorAll('#extendedKehaHub .extended-ancestor').length,2);
    assert.match(document.querySelector('#extendedKehaHub .extended-cousin-label').textContent,/בני דודים/);
    assert.ok(document.querySelector('#extendedKehaHub [data-person="saadia-elder"]'));
    assert.ok(document.querySelector('#extendedKehaHub a[href="/keha-extended/shlomo/#home"]'));
    for(const [branch,person] of [['zechariah','keha-zechariah'],['kehat','kehat-hadassah'],['yissachar','keha-yosef-yissachar']]){
      document.querySelector('#extendedKehaHub [data-branch="'+branch+'"]').click();
      assert.ok(document.querySelector('#treeNodes [data-person="'+person+'"]'),branch);
      assert.ok(document.getElementById('treeBreadcrumb').textContent.startsWith(EXTENDED_NAME+' › '));
      assert.equal(document.querySelectorAll('#extendedKehaHub .extended-branch-circle').length,4);
      document.querySelector('#extendedKehaHub [data-branch="all"]').click();
      assert.equal(document.body.dataset.extendedBranch,'all');
    }
    window.FamilyApp.setView('home');
    document.querySelector('#extendedKehaHomeHub [data-branch="kehat"]').click();
    assert.equal(window.FamilyApp.getView(),'tree');
    assert.ok(document.querySelector('#treeNodes [data-person="kehat-hadassah"]'));
  }
});
