import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {countryCodes} from '../public/assets/countries.mjs';
const source=(await readFile(new URL('../public/assets/biography.js',import.meta.url),'utf8')).replace(/^import[^\n]+\n/,'');
function fixture(english=false){
 const handlers=new Map(),requests=[],saved=[],people={a:{id:'a'},b:{id:'b'}};let person=people.a,finishCount=0;
 const window={FamilyI18n:{isEnglish:english,locale:english?'en-US':'he-IL'}};
 vm.runInContext(source,vm.createContext({window,countryCodes,Intl,console}));
 const bio=window.FamilyBiography,root={addEventListener:(type,handler)=>handlers.set(type,handler),querySelector:()=>({focus(){}})};
 bio.attach(root,{person:()=>person,isBlocked:()=>false,render(){},save(id,body){return new Promise((resolve,reject)=>requests.push({id,body,resolve,reject}));},saved:(id,value)=>{saved.push({id,value});Object.assign(people[id],value);},finished(){finishCount++;}});
 const event=(selector,properties={})=>({preventDefault(){},target:{closest:s=>s===selector?{...properties}:null,matches:s=>s===selector,...properties}});
 return {bio,people,requests,saved,handlers,event,switchTo(id){bio.reset();person=people[id];},get finishCount(){return finishCount;}};
}
test('biography renders localized country flags and read-only details safely in both interface languages',()=>{
 for(const english of [false,true]){
  const f=fixture(english),p={id:'a',residences:[{country:'IL',fromYear:1990,toYear:null,current:true}],languages:['עברית','<script>'],occupation:'A & B',jobs:[{employer:'Family studio',role:'Designer',fromYear:2000,toYear:2010,current:false}]};
  const html=f.bio.render(p);assert.match(html,/country-flags\.svg#IL/);assert.match(html,english?/Israel/:/ישראל/);assert.match(html,/&lt;script&gt;/);assert.match(html,/A &amp; B/);assert.ok(!html.includes('<input'));assert.ok(!html.includes('<textarea'));assert.match(html,english?/Work history/:/עבודות שבהן עבדתי/);
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
