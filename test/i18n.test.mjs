import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import family from '../src/family.mjs';
import {familyCalendar} from '../src/calendar.mjs';
const translations=await readFile(new URL('../public/assets/translations.js',import.meta.url),'utf8'),runtime=await readFile(new URL('../public/assets/i18n.js',import.meta.url),'utf8');
export function languageContext(language,preference,options={}){
 const document={documentElement:{lang:'he',dir:'rtl'},createTreeWalker:()=>({nextNode:()=>null}),querySelectorAll:()=>[],querySelector:()=>null,getElementById:()=>null};
 const saved={},location={href:'https://family.example/'+(language?'?lang='+language:''),origin:'https://family.example',search:language?'?lang='+language:'',assign(url){saved.url=url;}};
 const context=vm.createContext({window:{FAMILY_DATA:family},document,location,localStorage:{getItem:()=>preference,setItem(k,v){saved[k]=v;}},URL,URLSearchParams,Headers,Response,Intl,NodeFilter:{SHOW_TEXT:4},...(options.RegExp?{RegExp:options.RegExp}:{}),fetch:async()=>Response.json({error:'יש להזין תאריך לידה.'},{status:400})});
 vm.runInContext(translations,context);if(options.dictionary!==undefined)context.window.FAMILY_TRANSLATIONS=options.dictionary;vm.runInContext(runtime,context);return {i18n:context.window.FamilyI18n,document,saved,context};
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
 assert.equal(Object.keys(family.people).length,90);for(const person of Object.values(family.people))assert.ok(person.nameEn?.trim(),person.id);
 for(const [id,name]of Object.entries({adi:'Adi Mosacho',matteo:'Mathieu Pino',leni:'Leni Gandelman',rivi:'Revital Gandelman',hila:'Hila Harizi','ariel-n':'Ariele Noble','ariel-f':'Ariel Fish',tidhar:'Tedi Fish',eddie:'Adi Fish',memo:'Gillermo Vargas',itay:'Itai Gandelman',shay:'Shai Gandelman'}))assert.equal(family.people[id].nameEn,name);
 assert.equal(family.people.memo.name,'גיירמו וארגאס');assert.equal(family.people.camille.name,'קמיל דה ויטה');
});
test('US and UK dates have distinct formatting and both calendar languages keep the same birthday identity',()=>{
 assert.equal(languageContext('en-US').i18n.date('21.7.2024'),'Jul 21, 2024');assert.equal(languageContext('en-GB').i18n.date('21.7.2024'),'21 Jul 2024');
 const people={a:{id:'yehiel',name:'יחיאל קהא',nameEn:'Yehiel Keha',birthday:'21.7.1970'}};
 const he=familyCalendar('2026-07-21','hebrew',people,[],undefined,'he'),en=familyCalendar('2026-07-21','hebrew',people,[],undefined,'en-GB');
 assert.deepEqual(en.days.map(d=>d.date),he.days.map(d=>d.date));assert.equal(en.days.find(d=>d.date==='2026-07-21').birthdays[0].name,'Yehiel Keha');assert.equal(he.days.find(d=>d.date==='2026-07-21').birthdays[0].name,'יחיאל קהא');assert.match(en.label,/Av/);
});

function noLookbehind(pattern,flags){if(String(pattern).includes('(?<'))throw new SyntaxError('Lookbehind is not supported');return new RegExp(pattern,flags);}
const fragmentDictionary={שמירה:'Save','שמירה בשם':'Save as',שם:'Name','אב גד':'AB GD',גד:'GD','פריט (א)':'Item (A)','א.ב':'Initials','שאלה?':'Question?'};
test('Hebrew and English bootstrap without lookbehind support and keep names and authored content intact',()=>{
 for(const language of ['he','en-US','en-GB']){
  const {i18n,document}=languageContext(language,undefined,{RegExp:noLookbehind});assert.ok(i18n);assert.equal(i18n.language,language);assert.equal(document.documentElement.lang,language);assert.equal(document.documentElement.dir,language==='he'?'rtl':'ltr');assert.equal(i18n.t('שמירה'),language==='he'?'שמירה':'Save');
  const person={id:'extra-local',name:'שמירה שם',nameEn:'Authored Name'};assert.equal(i18n.personName(person),language==='he'?'שמירה שם':'Authored Name');assert.equal(i18n.personName({id:'extra-local',name:'שמירה שם'}),'שמירה שם');assert.equal(i18n.mediaName({name:'שמירה שם'}),'שמירה שם');
  assert.equal(i18n.html(['<label>שמירה: ','</label>'],'שמירה שם'),language==='he'?'<label>שמירה: שמירה שם</label>':'<label>Save: שמירה שם</label>');
 }
});

test('fragment translation preserves Hebrew word boundaries, punctuation and adjacent repeated labels',()=>{
 const {i18n}=languageContext('en-US',undefined,{RegExp:noLookbehind,dictionary:fragmentDictionary});
 for(const [input,expected] of [
  ['השמירה שמירהשמירה שמירהש שמירה','השמירה שמירהשמירה שמירהש Save'],
  ['אְשמירה שמירהְ שמירה','אְשמירה שמירהְ Save'],
  ['שמירה,שמירה;שמירה/שמירה–שמירה—שמירה','Save,Save;Save/Save–Save—Save'],
  ['שמירה שם,שמירה שם','Save Name,Save Name'],
  ['לפני: שמירה בשם; שמירה, שם.','לפני: Save as; Save, Name.'],
  ['יאב גד','יאב GD'],
  ['לפני פריט (א); א.ב; שאלה? אחרי','לפני Item (A); Initials; Question? אחרי'],
  ['לפני פריט א; אXב אחרי','לפני פריט א; אXב אחרי']
 ])assert.equal(i18n.t(input),expected,input);
 assert.equal(i18n.t('שמירה + שמירה'),'Save + Save');assert.equal(i18n.t('שמירה + שמירה'),'Save + Save');
});

test('empty dictionaries and empty keys never insert undefined or stall the fragment scan',()=>{
 for(const dictionary of [{},{'':'Empty'}]){const {i18n}=languageContext('en-US',undefined,{RegExp:noLookbehind,dictionary});for(const input of ['שמירה, שם.','English only','שמירה | שם'])assert.equal(i18n.t(input),input);}
 const {i18n}=languageContext('en-US',undefined,{RegExp:noLookbehind,dictionary:{'':'Empty',שמירה:'Save'}});assert.equal(i18n.t('שמירה, שמירה'),'Save, Save');
});

function lookbehindReference(dictionary){
 const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k),escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),hebrew=/[\u05d0-\u05ea][\u0590-\u05ff\s.,!?;:…()–—/\-]*/g,ending=/[\s.,!?;:…()–—/\-]+$/;
 const fragments=new RegExp('(?<![\\u0590-\\u05ff])(?:'+Object.keys(dictionary).sort((a,b)=>b.length-a.length).map(escape).join('|')+')(?![\\u0590-\\u05ff])','g');
 return value=>{if(typeof value!=='string'||!/[\u05d0-\u05ea]/.test(value))return value;if(own(dictionary,value))return dictionary[value];return value.replace(hebrew,part=>{const key=part.trim().replace(ending,'');return own(dictionary,key)?dictionary[key]+part.slice(key.length):part.replace(fragments,key=>dictionary[key]);});};
}
test('the compatible scanner matches the prior longest-match semantics for authored dictionary fragments',()=>{
 for(const dictionary of [fragmentDictionary,languageContext('en-US').context.window.FAMILY_TRANSLATIONS]){
  const reference=lookbehindReference(dictionary),{i18n}=languageContext('en-US',undefined,{RegExp:noLookbehind,dictionary});
  for(const key of Object.keys(dictionary))for(const input of [`לפני: ${key}; ${key} אחרי.`,`א${key} ב${key}`,`${key}|${key}`,`לפני ${key}ש אחרי`])assert.equal(i18n.t(input),reference(input),input);
 }
});
