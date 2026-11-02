import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import family from '../src/family.mjs';
import {familyCalendar} from '../src/calendar.mjs';
const translations=await readFile(new URL('../public/assets/translations.js',import.meta.url),'utf8'),runtime=await readFile(new URL('../public/assets/i18n.js',import.meta.url),'utf8');
export function languageContext(language,preference){
 const document={documentElement:{lang:'he',dir:'rtl'},createTreeWalker:()=>({nextNode:()=>null}),querySelectorAll:()=>[],querySelector:()=>null,getElementById:()=>null};
 const saved={},location={href:'https://family.example/'+(language?'?lang='+language:''),origin:'https://family.example',search:language?'?lang='+language:'',assign(url){saved.url=url;}};
 const context=vm.createContext({window:{FAMILY_DATA:family},document,location,localStorage:{getItem:()=>preference,setItem(k,v){saved[k]=v;}},URL,URLSearchParams,Headers,Response,Intl,NodeFilter:{SHOW_TEXT:4},fetch:async()=>Response.json({error:'יש להזין תאריך לידה.'},{status:400})});
 vm.runInContext(translations,context);vm.runInContext(runtime,context);return {i18n:context.window.FamilyI18n,document,saved,context};
}
test('Hebrew is the default, English variants persist and language changes retain the current page',()=>{
 const he=languageContext();assert.equal(he.i18n.language,'he');assert.equal(he.document.documentElement.dir,'rtl');assert.equal(he.i18n.t('שמירה'),'שמירה');
 const en=languageContext(null,'en-GB');assert.equal(en.i18n.locale,'en-GB');assert.equal(en.document.documentElement.dir,'ltr');en.i18n.setLanguage('en-US');assert.equal(en.saved['keha-family-language'],'en-US');assert.match(en.saved.url,/lang=en-US/);
 assert.equal(languageContext('he','en-US').i18n.language,'he');
});
test('English localizes interface templates and errors without translating user content or new names',async()=>{
 const {i18n}=languageContext('en-US');assert.equal(i18n.t('✓ התיוג נשמר בהצלחה'),'✓ Tag saved successfully');assert.equal(i18n.t('כל סימון נשמר אוטומטית. שם חדש יקבל אלבום משלו.'),'Every selection saves automatically. A new name gets its own album.');
 const authored=i18n.html(['<label>כיתוב ל','</label>'],'שלום משפחתי');assert.equal(authored,'<label>Caption for שלום משפחתי</label>');
 assert.equal(i18n.personName({id:'yehiel',name:'יחיאל קהא'}),'Yehiel Keha');assert.equal(i18n.personName({id:'extra-test',name:'שם אורח'}),'שם אורח');
 const response=await i18n.fetch('api/test');assert.equal((await response.json()).error,'Enter a birth date.');
 assert.match(i18n.searchNames(family.people.camille),/קמיל דה ויטה/);assert.match(i18n.searchNames(family.people.camille),/Camille De Vita/);
});
test('all canonical people have English names and the user-specified spellings remain attached to stable identities',()=>{
 assert.equal(Object.keys(family.people).length,82);for(const person of Object.values(family.people))assert.ok(person.nameEn?.trim(),person.id);
 for(const [id,name]of Object.entries({adi:'Adi Mosacho',matteo:'Mathieu Pino',leni:'Lenny Gandelman',rivi:'Revital Gandelman',hila:'Hila Harizi','ariel-n':'Ariele Noble','ariel-f':'Ariel Fish',tidhar:'Tedi Fish',eddie:'Adi Fish',memo:'Gillermo Vargas'}))assert.equal(family.people[id].nameEn,name);
 assert.equal(family.people.memo.name,'גיירמו וארגאס');assert.equal(family.people.camille.name,'קמיל דה ויטה');
});
test('US and UK dates have distinct formatting and both calendar languages keep the same birthday identity',()=>{
 assert.equal(languageContext('en-US').i18n.date('21.7.2024'),'Jul 21, 2024');assert.equal(languageContext('en-GB').i18n.date('21.7.2024'),'21 Jul 2024');
 const people={a:{id:'yehiel',name:'יחיאל קהא',nameEn:'Yehiel Keha',birthday:'21.7.1970'}};
 const he=familyCalendar('2026-07-21','hebrew',people,[],undefined,'he'),en=familyCalendar('2026-07-21','hebrew',people,[],undefined,'en-GB');
 assert.deepEqual(en.days.map(d=>d.date),he.days.map(d=>d.date));assert.equal(en.days.find(d=>d.date==='2026-07-21').birthdays[0].name,'Yehiel Keha');assert.equal(he.days.find(d=>d.date==='2026-07-21').birthdays[0].name,'יחיאל קהא');assert.match(en.label,/Av/);
});
