import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import family from '../src/family.mjs';

const relationsSource=await readFile(new URL('../public/assets/relations.js',import.meta.url),'utf8');
const peopleSource=await readFile(new URL('../public/assets/people.js',import.meta.url),'utf8');
async function fixture(id='eldad',{english=false,overrides={}}={}){
  const nodes=new Map(),listeners=new Map(),requests=[],location={hash:'#person/'+id,origin:'https://family.test'},callbacks=new Map();
  function node(name){if(!nodes.has(name))nodes.set(name,{innerHTML:'',hidden:false,open:false,addEventListener:(kind,callback)=>listeners.set(name+':'+kind,callback),querySelector:()=>null});return nodes.get(name);}
  const summary=id=>({...family.people[id],...overrides[id]});
  const window={FAMILY_DATA:family,FamilyI18n:{isEnglish:english,language:english?'en-US':'he',error:String,fetch:async url=>{
    requests.push(String(url));const id=decodeURIComponent(String(url).match(/api\/people\/([^/]+)\/page/)[1]);
    return {ok:true,status:200,json:async()=>({person:summary(id),revision:id,albums:Object.fromEntries(['photos','videos','documents'].map(key=>[key,{items:[],page:1,pages:1,total:0}]))})};
  }},scrollTo(){},addEventListener:(event,callback)=>callbacks.set(event,callback)};
  window.FamilyApp={getPerson:id=>family.people[id],getPersonSummary:summary,nameOf:id=>english?summary(id).nameEn:summary(id).name,birthdayHTML:()=>'',updatePerson(){},getView:()=> 'person',setView:view=>window.FamilyPeople.activate(view)};
  const document={getElementById:node,addEventListener:(event,callback)=>callbacks.set(event,callback),querySelector:()=>null,visibilityState:'visible'};
  const context=vm.createContext({window,document,location,history:{pushState(_a,_b,hash){location.hash=hash;}},URLSearchParams,URL,console,setInterval:()=>0,setTimeout,clearTimeout});
  vm.runInContext(relationsSource,context);vm.runInContext(peopleSource,context);callbacks.get('DOMContentLoaded')();
  const flush=()=>new Promise(resolve=>setImmediate(resolve));await flush();
  return {window,location,requests,flush,get html(){return node('personPageContent').innerHTML;},async clickRelative(id,modifier=false){
    let prevented=false,stopped=false;
    await listeners.get('personPageContent:click')({button:0,ctrlKey:modifier,preventDefault(){prevented=true;},stopPropagation(){stopped=true;},target:{closest:selector=>selector==='[data-person-relative]'?{dataset:{personRelative:id}}:null}});
    await flush();return {prevented,stopped};
  }};
}
const group=(html,key)=>html.match(new RegExp('<section class="person-family-group" data-relative-kind="'+key+'"[\\s\\S]*?<\\/section>'))[0];

test('personal pages show three localized family groups with cached profile photos and one page request',async()=>{
  for(const english of [false,true]){
    const f=await fixture('eldad',{english,overrides:{adi:{profile:'/media/adi.jpg'}}});
    assert.match(f.html,english?/Close family/:/משפחה קרובה/);
    assert.match(group(f.html,'partners'),/href="#person\/adi"/);
    assert.match(group(f.html,'partners'),/src="\/media\/adi.jpg"/);
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
  assert.match(group(f.html,'children'),/href="#person\/naomi"/);
  assert.match(group(f.html,'children'),/href="#person\/noga"/);
});
