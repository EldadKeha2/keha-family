import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import family from '../src/family.mjs';
import {browserHistory,navigationSource} from './helpers/browser-history.mjs';

const relationsSource=await readFile(new URL('../public/assets/relations.js',import.meta.url),'utf8');
const peopleSource=await readFile(new URL('../public/assets/people.js',import.meta.url),'utf8');
async function fixture(id='eldad',{navigation=false,entryUrl,english=false,overrides={}}={}){
  const browser=navigation?browserHistory(entryUrl||'https://family.test/#person/'+id):null;let view=browser?browser.location.hash.slice(1).split('/')[0]:'person';
  const nodes=new Map(),listeners=new Map(),requests=[],location=browser?.location||{hash:'#person/'+id,origin:'https://family.test'},callbacks=new Map();
  function node(name){if(!nodes.has(name))nodes.set(name,{innerHTML:'',hidden:false,open:false,addEventListener:(kind,callback)=>listeners.set(name+':'+kind,callback),querySelector:()=>null});return nodes.get(name);}
  const summary=id=>({...family.people[id],...overrides[id]});
  const window={FAMILY_DATA:family,FamilyI18n:{isEnglish:english,language:english?'en-US':'he',error:String,fetch:async url=>{
    requests.push(String(url));if(String(url).startsWith('api/media/'))return {ok:true,json:async()=>({item:{id:String(url).split('/')[2],kind:'photo',src:'/media/current'}})};
    const id=decodeURIComponent(String(url).match(/api\/people\/([^/]+)\/page/)[1]);
    return {ok:true,status:200,json:async()=>({person:summary(id),revision:id,albums:Object.fromEntries(['photos','videos','documents'].map(key=>[key,{items:[],page:1,pages:1,total:0}]))})};
  }},scrollTo(){},addEventListener(event,callback){callbacks.set(event,callback);browser?.addEventListener(event,callback);}};
  window.FamilyApp={getPerson:id=>family.people[id],getPersonSummary:summary,nameOf:id=>english?summary(id).nameEn:summary(id).name,birthdayHTML:()=>'',updatePerson(){},getView:()=>view,setView(next,sync=true){if(browser&&sync)window.FamilyNavigation.go('#'+next);view=next;window.FamilyPeople.activate(next);}};
  const document={getElementById:node,addEventListener:(event,callback)=>callbacks.set(event,callback),querySelector:()=>null,visibilityState:'visible'};
  const context=vm.createContext({window,document,location,history:browser?.history||{pushState(_a,_b,hash){location.hash=hash;}},matchMedia:()=>({matches:false}),URLSearchParams,URL,console,setInterval:()=>0,setTimeout,clearTimeout});
  if(browser){vm.runInContext(navigationSource,context);browser.addEventListener('popstate',()=>{const next=location.hash.slice(1).split('/')[0];if(next!==view)window.FamilyApp.setView(next,false);});}
  vm.runInContext(relationsSource,context);vm.runInContext(peopleSource,context);callbacks.get('DOMContentLoaded')();
  const flush=()=>new Promise(resolve=>setImmediate(resolve));await flush();
  return {window,browser,get view(){return view;},clickPortrait(){return listeners.get('personPageContent:click')({target:{closest:selector=>selector==='[data-person-portrait]'?{}:null}});},back(){return listeners.get('personPageContent:click')({preventDefault(){},target:{closest:selector=>selector==='[data-person-back]'?{}:null}});},location,requests,flush,get html(){return node('personPageContent').innerHTML;},async clickRelative(id,modifier=false){
    let prevented=false,stopped=false;
    await listeners.get('personPageContent:click')({button:0,ctrlKey:modifier,preventDefault(){prevented=true;},stopPropagation(){stopped=true;},target:{closest:selector=>selector==='[data-person-relative]'?{dataset:{personRelative:id}}:null}});
    await flush();return {prevented,stopped};
  }};
}
const group=(html,key)=>html.match(new RegExp('<section class="person-family-group" data-relative-kind="'+key+'"[\\s\\S]*?<\\/section>'))[0];

test('an edited profile photo opens the same original media ID despite its display revision',async()=>{
 const id='a'.repeat(32),f=await fixture('eldad',{overrides:{eldad:{profile:'/media/'+id+'?v='+'b'.repeat(32)}}}),opened=[];
 f.window.FamilyMedia={open:(...args)=>opened.push(args)};await f.clickPortrait();
 assert.equal(f.requests.at(-1),'api/media/'+id+'/view');assert.equal(opened.length,1);assert.equal(opened[0][0][0].id,id);assert.equal(opened[0][2],'personal:eldad');
});

test('Back restores each relative page and then the actual source section; Forward renders the correct person',async()=>{
  for(const english of [false,true]){
    const f=await fixture('eldad',{navigation:true,english,entryUrl:'https://family.test/#calendar'});
    f.window.FamilyPeople.open('eldad');await f.flush();await f.clickRelative('yehiel');await f.clickRelative('yona');
    const length=f.browser.history.length;
    f.browser.history.back();await f.flush();assert.match(f.html,english?/Yehiel/:/יחיאל/);assert.equal(f.location.hash,'#person/yehiel');
    f.browser.history.back();await f.flush();assert.match(f.html,english?/Eldad/:/אלדד/);assert.equal(f.location.hash,'#person/eldad');
    await f.back();await f.flush();assert.equal(f.view,'calendar');assert.equal(f.location.hash,'#calendar');
    f.browser.history.forward();await f.flush();assert.equal(f.location.hash,'#person/eldad');assert.match(f.html,english?/Eldad/:/אלדד/);
    assert.equal(f.browser.history.length,length);
  }
});

test('the personal Back link has a useful parent on a fresh direct entry',async()=>{
  const f=await fixture('eldad',{navigation:true});await f.back();await f.flush();
  assert.equal(f.view,'directory');assert.equal(f.location.hash,'#directory');
});

test('personal pages show four localized family groups in order, with cached photos and one page request',async()=>{
  for(const english of [false,true]){
    const f=await fixture('eldad',{english,overrides:{adi:{profile:'/media/adi.jpg'}}});
    assert.match(f.html,english?/Close family/:/משפחה קרובה/);
    assert.match(group(f.html,'partners'),/href="#person\/adi"/);
    assert.match(group(f.html,'partners'),/src="\/media\/adi.jpg"/);
    assert.match(group(f.html,'parents'),/href="#person\/yehiel"/);
    assert.match(group(f.html,'parents'),/href="#person\/rachel-katan"/);
    assert.match(group(f.html,'parents'),english?/title="Father"/:/title="אבא"/);
    assert.match(group(f.html,'parents'),english?/title="Mother"/:/title="אמא"/);
    assert.match(group(f.html,'parents'),english?/>Parents<\//:/>הורים<\//);
    assert.deepEqual([...f.html.matchAll(/data-relative-kind="([^"]+)"/g)].map(match=>match[1]),['partners','parents','children','siblings']);
    assert.match(group(f.html,'siblings'),/href="#person\/bosmat"/);
    assert.match(group(f.html,'siblings'),/href="#person\/naama"/);
    assert.ok(!group(f.html,'children').includes('data-person-relative'));
    assert.ok(f.html.indexOf('class="person-family"')<f.html.indexOf('class="person-about"'));
    assert.equal(f.requests.length,1,'relative photos must reuse the cache rather than fetch every relative');
  }
});
test('relative names are escaped and missing photos have a profile placeholder',async()=>{
  const f=await fixture('eldad',{overrides:{adi:{name:'<script>Adi</script> & family'}}});
  assert.match(group(f.html,'partners'),/&lt;script&gt;Adi&lt;\/script&gt; &amp; family/);
  assert.ok(!f.html.includes('<script>Adi'));
  assert.match(group(f.html,'partners'),/person-relative-initials/);
});
test('a relative link opens the selected personal page once and preserves native modified clicks',async()=>{
  const f=await fixture();
  assert.deepEqual(await f.clickRelative('bosmat',true),{prevented:false,stopped:true});assert.equal(f.requests.length,1);
  assert.deepEqual(await f.clickRelative('bosmat'),{prevented:true,stopped:true});
  assert.equal(f.location.hash,'#person/bosmat');assert.equal(f.requests.length,2);
  assert.match(group(f.html,'partners'),/href="#person\/itzik"/);
  assert.match(group(f.html,'parents'),/href="#person\/yehiel"/);
  assert.match(group(f.html,'children'),/href="#person\/naomi"/);
  assert.match(group(f.html,'children'),/href="#person\/noga"/);
});
test('parent links open the parent page and unknown parents stay empty',async()=>{
  const f=await fixture();
  assert.deepEqual(await f.clickRelative('yehiel'),{prevented:true,stopped:true});
  assert.equal(f.location.hash,'#person/yehiel');
  assert.match(group(f.html,'parents'),/href="#person\/yona"/);
  assert.match(group(f.html,'parents'),/href="#person\/shlomo"/);
  await f.clickRelative('rachel-katan');
  assert.ok(!group(f.html,'parents').includes('data-person-relative'));
  assert.match(group(f.html,'parents'),/טרם נוספו פרטים/);
});
test('About displays the active language without falling back to text in the other language',async()=>{
  for(const english of [false,true]){
    const f=await fixture('eldad',{english,overrides:{eldad:{about:'סיפור בעברית בלבד',aboutEn:'English story only'}}});
    assert.ok(f.html.includes(english?'English story only':'סיפור בעברית בלבד'));
    assert.ok(!f.html.includes(english?'סיפור בעברית בלבד':'English story only'));
  }
  const empty=await fixture('eldad',{english:true,overrides:{eldad:{about:'סיפור בעברית בלבד'}}});assert.ok(!empty.html.includes('סיפור בעברית בלבד'));
});
test('a manually added acquaintance opens a tagged-media album without invented family or biography sections',async()=>{
 for(const english of[false,true]){
  const f=await fixture('eldad',{english,overrides:{eldad:{extra:true}}});
  assert.match(f.html,english?/Family friends and acquaintances/:/מכרים וחברי משפחה/);
  assert.match(f.html,/id="personAlbum-photos"/);assert.match(f.html,/data-person-back/);
  assert.doesNotMatch(f.html,/class="person-about"|class="person-family"|id="personPageBirthday"/);
 }
});
