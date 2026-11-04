import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {countryCodes} from '../public/assets/countries.mjs';
import {resolveLanguage,languageKey,languageLabel,searchLanguages} from '../public/assets/languages.mjs';
const source=(await readFile(new URL('../public/assets/biography.js',import.meta.url),'utf8')).replace(/^import[^\n]+\n/gm,'');
function fixture(english=false){
 const handlers=new Map(),requests=[],saved=[],people={a:{id:'a'},b:{id:'b'}};let person=people.a,finishCount=0;
 const window={FamilyI18n:{isEnglish:english,locale:english?'en-US':'he-IL'}};
 vm.runInContext(source,vm.createContext({window,countryCodes,resolveLanguage,languageKey,languageLabel,searchLanguages,Intl,console}));
 const bio=window.FamilyBiography,nodes=new Map(),root={addEventListener:(type,handler)=>handlers.set(type,handler),querySelector:selector=>{if(!nodes.has(selector))nodes.set(selector,{focus(){},setAttribute(){},removeAttribute(){},querySelector:()=>({scrollIntoView(){}})});return nodes.get(selector);}};
 bio.attach(root,{person:()=>person,isBlocked:()=>false,render(){},save(id,body){return new Promise((resolve,reject)=>requests.push({id,body,resolve,reject}));},saved:(id,value)=>{saved.push({id,value});Object.assign(people[id],value);},finished(){finishCount++;}});
 const event=(selector,properties={})=>({preventDefault(){},target:{closest:s=>s===selector?{...properties}:null,matches:s=>s===selector,...properties}});
 return {bio,people,requests,saved,handlers,event,switchTo(id){bio.reset();person=people[id];},get finishCount(){return finishCount;}};
}
test('biography renders localized country flags and read-only details safely in both interface languages',()=>{
 for(const english of [false,true]){
  const f=fixture(english),p={id:'a',residences:[{country:'IL',fromYear:1990,toYear:null,current:true}],languages:['עברית','<script>'],occupation:'A & B',jobs:[{employer:'Family studio',role:'Designer',fromYear:2000,toYear:2010,current:false}]};
  p.occupationEn=p.occupation;p.jobsEn=p.jobs;const html=f.bio.render(p);assert.match(html,/country-flags\.svg#IL/);assert.match(html,english?/Israel/:/ישראל/);assert.match(html,/&lt;script&gt;/);assert.match(html,/A &amp; B/);assert.ok(!html.includes('<input'));assert.ok(!html.includes('<textarea'));assert.match(html,english?/Work history/:/עבודות שבהן עבדתי/);
  const partial=f.bio.render(p,false);assert.ok(!partial.includes('Family studio'));assert.match(partial,/data-bio-edit="residences"[^>]*disabled/);
 }
});
test('an in-flight biography save remains attached to its original person after opening another editor',async()=>{
 const f=fixture();await f.handlers.get('click')(f.event('[data-bio-edit]',{dataset:{bioEdit:'occupation'},disabled:false}));
 f.handlers.get('input')(f.event('[data-bio-form]',{matches:s=>s==='[data-bio-value]',value:'Engineer'}));
 assert.equal(f.bio.isDirty(),true);const pending=f.handlers.get('submit')(f.event('[data-bio-form]'));
 assert.equal(f.requests.length,1);assert.equal(f.requests[0].id,'a');assert.equal(f.requests[0].body.value,'Engineer');
 f.switchTo('b');await f.handlers.get('click')(f.event('[data-bio-edit]',{dataset:{bioEdit:'occupation'},disabled:false}));
 f.handlers.get('input')(f.event('[data-bio-form]',{matches:s=>s==='[data-bio-value]',value:'Writer'}));
 f.requests[0].resolve({person:{id:'a',occupation:'Engineer'}});await pending;
 assert.equal(f.saved[0].id,'a');assert.equal(f.bio.isEditing(),true);assert.match(f.bio.render(f.people.b),/value="Writer"/);assert.equal(f.finishCount,0);
 const second=f.handlers.get('submit')(f.event('[data-bio-form]'));assert.equal(f.requests[1].id,'b');f.requests[1].reject(Error('Save failed'));await second;
 assert.equal(f.bio.isDirty(),true);assert.match(f.bio.render(f.people.b),/Save failed/);assert.match(f.bio.render(f.people.b),/value="Writer"/);
});
test('profession and work history display and edit only the active content language',async()=>{
  for(const english of [false,true]){
    const f=fixture(english);Object.assign(f.people.a,{occupation:'מקצוע עברי בלבד',occupationEn:'English profession only',jobs:[{employer:'עבודה עברית בלבד',role:'',fromYear:null,toYear:null,current:false}],jobsEn:[{employer:'English workplace only',role:'',fromYear:null,toYear:null,current:false}]});
    const html=f.bio.render(f.people.a);assert.ok(html.includes(english?'English profession only':'מקצוע עברי בלבד'));assert.ok(!html.includes(english?'מקצוע עברי בלבד':'English profession only'));assert.ok(html.includes(english?'English workplace only':'עבודה עברית בלבד'));assert.ok(!html.includes(english?'עבודה עברית בלבד':'English workplace only'));
    await f.handlers.get('click')(f.event('[data-bio-edit]',{dataset:{bioEdit:'occupation'},disabled:false}));
    const pending=f.handlers.get('submit')(f.event('[data-bio-form]'));assert.equal(f.requests[0].body.language,english?'en':'he');assert.equal(f.requests[0].body.expectedValue,english?'English profession only':'מקצוע עברי בלבד');f.requests[0].resolve({person:f.people.a});await pending;
  }
});
test('searchable language selection preserves existing text, prevents bilingual duplicates, and saves flags with labels',async()=>{
 const f=fixture();f.people.a.languages=['עברית','A family dialect'];
 await f.handlers.get('click')(f.event('[data-bio-edit]',{dataset:{bioEdit:'languages'},disabled:false}));
 const input=value=>f.event('[data-bio-form]',{matches:s=>s==='[data-bio-language-search]',value});
 f.handlers.get('input')(input('français'));
 await f.handlers.get('click')(f.event('[data-bio-language-add]',{dataset:{bioLanguageAdd:'0'}}));
 let html=f.bio.render(f.people.a);assert.match(html,/country-flags\.svg#FR/);assert.match(html,/צרפתית/);assert.match(html,/A family dialect/);assert.match(html,/role="combobox"/);
 f.handlers.get('input')(input('Hebrew'));await f.handlers.get('click')(f.event('[data-bio-language-add]',{dataset:{bioLanguageAdd:'0'}}));
 const pending=f.handlers.get('submit')(f.event('[data-bio-form]'));
 assert.deepEqual(JSON.parse(JSON.stringify(f.requests[0].body.value)),['עברית','A family dialect','French']);
 assert.deepEqual(JSON.parse(JSON.stringify(f.requests[0].body.expectedValue)),['עברית','A family dialect']);
 f.requests[0].resolve({person:{id:'a',languages:f.requests[0].body.value}});await pending;
 html=f.bio.render(f.people.a);assert.match(html,/country-flags\.svg#IL/);assert.match(html,/country-flags\.svg#FR/);assert.ok(!html.includes('<input'));
});
test('language options support keyboard selection and escaped custom languages without submitting the form',async()=>{
 const f=fixture(true);await f.handlers.get('click')(f.event('[data-bio-edit]',{dataset:{bioEdit:'languages'},disabled:false}));
 f.handlers.get('input')(f.event('[data-bio-form]',{matches:s=>s==='[data-bio-language-search]',value:'Spanish'}));
 await f.handlers.get('keydown')({...f.event('[data-bio-form]',{matches:s=>s==='[data-bio-language-search]'}),key:'Enter'});
 assert.match(f.bio.render(f.people.a),/country-flags\.svg#ES/);assert.equal(f.requests.length,0);assert.match(f.bio.render(f.people.a),/aria-expanded="false"/);
 await f.handlers.get('click')(f.event('[data-bio-language-search]'));assert.match(f.bio.render(f.people.a),/aria-expanded="true"/);
 f.handlers.get('input')(f.event('[data-bio-form]',{matches:s=>s==='[data-bio-language-search]',value:'<script>custom</script>'}));
 await f.handlers.get('click')(f.event('[data-bio-language-add]',{dataset:{bioLanguageAdd:'0'}}));
 const html=f.bio.render(f.people.a);assert.match(html,/&lt;script&gt;custom&lt;\/script&gt;/);assert.ok(!html.includes('<script>custom'));
 await f.handlers.get('click')(f.event('[data-bio-language-remove]',{dataset:{bioLanguageRemove:'0'}}));
 const afterRemoval=f.bio.render(f.people.a),selection=afterRemoval.match(/<ul class="biography-languages biography-language-selection">([\s\S]*?)<\/ul>/)[1];
 assert.ok(!selection.includes('country-flags.svg#ES'));assert.match(selection,/&lt;script&gt;custom&lt;\/script&gt;/);
});
