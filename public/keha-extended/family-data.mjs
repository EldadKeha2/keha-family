import {SAADIA_PEOPLE,SAADIA_UNITS,ZECHARIAH_CHILDREN} from './saadia-data.mjs';
import {KEHAT_RESEARCH_PEOPLE,applyKehatResearchUnits} from './kehat-research.mjs';
import {TRI_RESEARCH_PEOPLE,applyTriUnits} from './tri-data.mjs';
import {YISSACHAR_PEOPLE,applyYissacharUnits} from './yissachar-data.mjs';
import {enrichHistoricalLifeEvidence} from './life-evidence.mjs';
import {applyRegistryEvidence} from './registry-evidence.mjs';
import {cleanProfileDescriptions} from './profile-descriptions.mjs';

export const EXTENDED_NAME = 'משפחת קהא המורחבת';
export const EXTENDED_COLOR = '#345d83';
export const EXTENDED_HOME = '/keha-extended/';
export const EXTENDED_BRANCHES = Object.freeze([
  {id:'shlomo', unit:'u-root', label:'משפחת שלמה קהא', shortLabel:'שלמה בן זכריה', titleEn:'Shlomo Keha Family', color:'#536641', mark:'❖'},
  {id:'zechariah', unit:'u-keha-zechariah', label:'המשפחה של זכריה (בן שלום) קהא', shortLabel:'זכריה בן שלום', titleEn:'Keha family — Zechariah, son of Shalom', color:'#913951', mark:'❖'},
  {id:'kehat-tzadok', unit:'u-kehat-tzadok-elder', label:'המשפחה של זכריה (בן צדוק) קהא', shortLabel:'זכריה בן צדוק', titleEn:'Keha family — Zechariah, son of Tzadok', color:'#b4523b', mark:'❖'},
  {id:'kehat', unit:'u-kehat-aharon-elder', label:'המשפחה של סעדיה (ג׳ידעאן) קהא', shortLabel:'סעדיה (ג׳ידעאן)', titleEn:'Kehat family — Saadia (Jidaan)', color:'#167d9a', mark:'❖'},
  {id:'yissachar', unit:'u-keha-yissachar', label:'משפחת יששכר · יוסף וצביה', shortLabel:'משפחת יששכר', titleEn:'Yissachar family · Yosef and Tzvia', color:'#6b645b', mark:'❖'},
].map(Object.freeze));

// The supplied family chart is the source for these names and marriages.
// The owner identified Jidaan as Saadia, son of Aharon. Tzadok and Aharon's
// branches remain independent until their relationship is established.
const people = [
  ['keha-zechariah','זכריה קהא בן שלום','Zechariah Keha, son of Shalom','m','u-keha-zechariah',['זכריה קהא','זכריה קהא הבן'],{deceased:true,about:'בנו של שלום קהא, בן דודו של שלמה קהא ובעלה של יהודית בת סעדיה. זוהה במשפחה עם רשומת הבוחרים מ־1949 ועם הקבר של זכריה בן שלום. הקשר לרשומת זכריה בן סעדיה מ־1936 טרם הוכרע.'}],
  ['keha-yehudit','יהודית קהא','Yehudit Keha','f','u-keha-zechariah'],
  ['keha-zechariah-father','זכריה קהא האב','Zechariah Keha the Elder','m','u-keha-zechariah-father',[],{deceased:true,siblings:['saadia-elder'],about:'אביו של שלמה קהא. לפי עדות המשפחה, זכריה בן שלום הוא אחיינו ובן דודו של שלמה. נפטר בתימן לפני העלייה ולא זכה לעלות ארצה. שם אשתו טרם ידוע.'}],
  ['kehat-tzadok-elder','צדוק קהא','Tzadok Keha','m','u-kehat-tzadok-elder'],
  ['kehat-zechariah-ben-tzadok','זכריה בן צדוק קהת','Zechariah Kehat, son of Tzadok','m','u-kehat-zechariah-ben-tzadok',['זכריה בן צדוק קהא']],
  ['kehat-aharon-elder','אהרון קהא','Aharon Keha','m','u-kehat-aharon-elder'],
  ['kehat-jidaan','סעדיה (ג׳ידעאן) בן אהרון קהא','Saadia (Jidaan) Keha, son of Aharon','m','u-keha-kehat',['ג׳ידעאן קהא','ג׳ימען קהא','גימען קהא','גידעאן קהא','סעדיה בן אהרון קהא']],
  ['kehat-first-wife','שם האישה הראשונה טרם נמסר','First wife — name not yet known','f','u-keha-kehat',[],{placeholder:true}],
  ['kehat-miriam','מרים קהת','Miriam Kehat','f','u-keha-kehat'],
  ['kehat-yaakov','יעקב קהת','Yaakov Kehat','m','u-kehat-yaakov'],
  ['kehat-yaakov-miriam','מרים','Miriam','f','u-kehat-yaakov'],
  ['kehat-zechariah','זכריה קהת','Zechariah Kehat','m','u-kehat-zechariah'],
  ['kehat-aharon','אהרון קהת','Aharon Kehat','m','u-kehat-aharon'],
  ['kehat-yehudit','יהודית קהת','Yehudit Kehat','f','u-kehat-yehudit'],
  ['kehat-hadassah','הדסה אנגלסברג','Hadassah Engelsberg','f','u-kehat-hadassah',['הדוס','הדוס קהא','הדסה קהת','הדסה קהא']],
  ['kehat-yossi','יוסי אנגלסברג','Yossi Engelsberg','m','u-kehat-hadassah'],
  ['kehat-shula','שולה עפג׳ין','Shula Afjin','f','u-kehat-shula'],
  ['kehat-shlomo-afjin','שלמה עפג׳ין','Shlomo Afjin','m','u-kehat-shula'],
  ['kehat-tzion','ציון קהת','Tzion Kehat','m','u-kehat-tzion',['ציון כהה']],
  ['kehat-bracha','ברכה קהת','Bracha Kehat','f','u-kehat-tzion'],
  ['kehat-tzvia','צביה קהת','Tzvia Kehat','f','u-kehat-tzvia'],
  ['kehat-sami','סמי אנגלסברג','Sami Engelsberg','m','u-kehat-sami'],
  ['kehat-keren','קרן אנגלסברג','Keren Engelsberg','f','u-kehat-keren'],
  ['kehat-rona','רונה אנגלסברג','Rona Engelsberg','f','u-kehat-rona'],
  ['kehat-avi','אבי עפג׳ין','Avi Afjin','m','u-kehat-avi'],
  ['kehat-ofir','אופיר עפג׳ין','Ofir Afjin','','u-kehat-ofir'],
  ['kehat-oren','אורן קהת','Oren Kehat','m','u-kehat-oren'],
  ['kehat-tali','טלי קהת','Tali Kehat','f','u-kehat-tali'],
  ['kehat-lihi','ליהי קהת','Lihi Kehat','f','u-kehat-lihi'],
];
const seedPeople=new Map([...people.map(([id,name,englishName,gender,unit,aliases=[],details={}]) =>
  ({id,name,englishName,nameEn:englishName,gender,unit,aliases,...details})),...SAADIA_PEOPLE].map(p=>[p.id,{...p}]));
for(const update of [...KEHAT_RESEARCH_PEOPLE,...TRI_RESEARCH_PEOPLE,...YISSACHAR_PEOPLE]){const before=seedPeople.get(update.id)||{};seedPeople.set(update.id,{...before,...update,aliases:[...new Set([...(before.aliases||[]),...(update.aliases||[])])]});}
enrichHistoricalLifeEvidence(seedPeople);
applyRegistryEvidence(seedPeople);
export const EXTENDED_PEOPLE = Object.freeze([...seedPeople.values()].map(person=>Object.freeze(cleanProfileDescriptions(person))));

const firstChildren = ['yaakov','zechariah','aharon','yehudit'].map(id=>'u-kehat-'+id);
// The owner confirmed all four children of Saadia and Miriam, in this order.
const secondChildren = ['tzion','shula','tzvia','hadassah'].map(id=>'u-kehat-'+id);
const units = [
  ['u-keha-zechariah-father',['keha-zechariah-father'],['u-root'],null,{generation:0}],
  ['u-keha-zechariah',['keha-zechariah','keha-yehudit'],ZECHARIAH_CHILDREN,'u-saadia-elder',{
    relationships:[
      {people:['keha-zechariah','keha-yehudit'],children:ZECHARIAH_CHILDREN.filter(id=>id!=='u-saadia-aharon'),relationship:'spouse'},
      {people:['keha-zechariah'],children:['u-saadia-aharon'],relationship:'adopted',label:'בן מאומץ',labelEn:'Adopted son'},
    ],
  }],
  ['u-kehat-tzadok-elder',['kehat-tzadok-elder'],['u-kehat-zechariah-ben-tzadok'],null,{generation:0}],
  ['u-kehat-zechariah-ben-tzadok',['kehat-zechariah-ben-tzadok'],[],'u-kehat-tzadok-elder'],
  ['u-kehat-aharon-elder',['kehat-aharon-elder'],['u-keha-kehat'],null,{generation:0}],
  ['u-keha-kehat',['kehat-jidaan','kehat-first-wife','kehat-miriam'],[...firstChildren,...secondChildren],'u-kehat-aharon-elder',{
    displayPeople:['kehat-first-wife','kehat-jidaan','kehat-miriam'],
    splitPartnerships:true,
    relationships:[
      {people:['kehat-jidaan','kehat-first-wife'],children:firstChildren,relationship:'spouse',label:'נישואין ראשונים',labelEn:'First marriage'},
      {people:['kehat-jidaan','kehat-miriam'],children:secondChildren,relationship:'spouse',label:'נישואין שניים',labelEn:'Second marriage'},
    ],
  }],
  ['u-kehat-yaakov',['kehat-yaakov','kehat-yaakov-miriam'],[],'u-keha-kehat'],
  ['u-kehat-zechariah',['kehat-zechariah'],[],'u-keha-kehat'],
  ['u-kehat-aharon',['kehat-aharon'],[],'u-keha-kehat'],
  ['u-kehat-yehudit',['kehat-yehudit'],[],'u-keha-kehat'],
  ['u-kehat-hadassah',['kehat-hadassah','kehat-yossi'],['u-kehat-sami','u-kehat-keren','u-kehat-rona'],'u-keha-kehat'],
  ['u-kehat-shula',['kehat-shula','kehat-shlomo-afjin'],['u-kehat-avi','u-kehat-ofir'],'u-keha-kehat'],
  ['u-kehat-tzion',['kehat-tzion','kehat-bracha'],['u-kehat-oren','u-kehat-tali','u-kehat-lihi'],'u-keha-kehat'],
  ['u-kehat-tzvia',['kehat-tzvia'],[],'u-keha-kehat'],
  ...['sami','keren','rona'].map(id=>['u-kehat-'+id,['kehat-'+id],[],'u-kehat-hadassah']),
  ...['avi','ofir'].map(id=>['u-kehat-'+id,['kehat-'+id],[],'u-kehat-shula']),
  ...['oren','tali','lihi'].map(id=>['u-kehat-'+id,['kehat-'+id],[],'u-kehat-tzion']),
  ['u-keha-yissachar',['yissachar-yosef','yissachar-tzvia'],[],null],
];

export function applySavedWeddingDates(units,weddings=[]){
  for(const wedding of weddings){
    const unit=units[wedding.id];if(!unit||unit.hasWedding===false)continue;
    unit.weddingDate=wedding.date;
    const year=/(?:^|\.)(\d{4})$/.exec(wedding.date||'');
    if(year)unit.weddingYear=Number(year[1]);else delete unit.weddingYear;
  }
}

export function createExtendedFamily(original = {}) {
  const roster = original.sharedPeople || {};
  const result = {title:EXTENDED_NAME, root:'u-root', people:{}, units:{}, branches:EXTENDED_BRANCHES, branchIds:new Map(), identities:{}};
  for (const [id,members,children,parent,details={}] of units) result.units[id] = {id,people:[...members],children:[...children],parent,relationship:members.length>1?'spouse':'single',...structuredClone(details)};
  for (const unit of SAADIA_UNITS) result.units[unit.id]=structuredClone(unit);
  applyKehatResearchUnits(result.units);
  applyTriUnits(result.units);
  applyYissacharUnits(result.units);
  for (const seed of EXTENDED_PEOPLE){
    const id=original.identities?.[seed.id] || (seed.sharedProfileId&&roster[seed.sharedProfileId]?seed.sharedProfileId:seed.id);
    if(id!==seed.id)result.identities[seed.id]=id;
    result.people[id] = {...seed,...roster[id],id,englishName:roster[id]?.nameEn||seed.englishName,extra:false,extended:false,unit:seed.unit};
  }
  const canonical=id=>result.identities[id]||id;
  for(const person of Object.values(result.people))for(const field of ['parents','siblings'])if(person[field])person[field]=person[field].map(canonical);
  for(const unit of Object.values(result.units)){
    unit.people=unit.people.map(canonical);
    if(unit.displayPeople)unit.displayPeople=unit.displayPeople.map(canonical);
    for(const relationship of unit.relationships||[])relationship.people=relationship.people.map(canonical);
  }
  function copy(id,parent=null) {
    const unit=original.units?.[id];
    if (!unit || result.units[id]) return;
    result.units[id]={...structuredClone(unit),parent,children:[...unit.children]};
    for (const personId of unit.people) {
      const seed=original.people[personId];
      result.people[personId]={...seed,...roster[personId],englishName:roster[personId]?.nameEn || seed.englishName || seed.nameEn,unit:id,extra:false,extended:false};
    }
    unit.children.forEach(child=>copy(child,id));
  }
  copy('u-root');
  // Reuse saved wedding dates for the same canonical couples. An explicit
  // cleared date takes precedence over the original fallback year.
  applySavedWeddingDates(result.units,original.sharedWeddings);
  // Only the owner's confirmed paternal connection is added. Reorder this root
  // in the extended projection so Yona does not inherit Shlomo's father.
  if(result.units['u-root']){
    result.units['u-root'].parent='u-keha-zechariah-father';
    result.units['u-root'].people=['shlomo',...result.units['u-root'].people.filter(id=>id!=='shlomo')];
  }
  result.branchIds.set('keha-zechariah-father','shlomo');
  result.branchIds.set('saadia-elder','zechariah');
  for(const seed of SAADIA_PEOPLE)result.branchIds.set(canonical(seed.id),'zechariah');
  for(const seed of EXTENDED_PEOPLE)if(seed.researchBranch)result.branchIds.set(canonical(seed.id),seed.researchBranch);
  // Tri descends from Zechariah son of Saadia; Yissachar remains independent.
  for(const person of Object.values(result.people))person.branches=[];
  for (const branch of EXTENDED_BRANCHES) {
    const todo=[branch.unit],seen=new Set();
    while(todo.length){
      const unitId=todo.pop();if(seen.has(unitId))continue;seen.add(unitId);
      const unit=result.units[unitId];if(!unit)continue;
      for(const id of unit.people){
        if(result.people[id].unit===unit.id||!result.branchIds.has(id))result.branchIds.set(id,branch.id);
        if(!result.people[id].branches.includes(branch.id))result.people[id].branches.push(branch.id);
      }
      todo.push(...unit.children);
    }
  }
  return result;
}
