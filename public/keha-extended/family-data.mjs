import {SAADIA_PEOPLE,SAADIA_UNITS,ZECHARIAH_CHILDREN} from './saadia-data.mjs';

export const EXTENDED_NAME = 'משפחת קהא המורחבת';
export const EXTENDED_COLOR = '#345d83';
export const EXTENDED_HOME = '/keha-extended/';
export const EXTENDED_BRANCHES = Object.freeze([
  {id:'shlomo', unit:'u-root', label:'משפחת שלמה קהא', shortLabel:'שלמה קהא', titleEn:'Shlomo Keha Family', color:EXTENDED_COLOR, mark:'❖'},
  {id:'zechariah', unit:'u-keha-zechariah', label:'משפחת זכריה קהא הבן', shortLabel:'זכריה קהא הבן', titleEn:'Family of Zechariah Keha the Younger', color:'#597d98', mark:'❖'},
  {id:'kehat-tzadok', unit:'u-kehat-tzadok-elder', label:'משפחת קהת — צדוק', shortLabel:'צדוק · זכריה', titleEn:'Kehat family — Tzadok', color:'#537b82', mark:'❖'},
  {id:'kehat', unit:'u-kehat-aharon-elder', label:'משפחת קהת — אהרון', shortLabel:'אהרון · סעדיה', titleEn:'Kehat family — Aharon', color:'#537b82', mark:'❖'},
  {id:'yissachar', unit:'u-keha-yissachar', label:'יוסף יששכר', shortLabel:'יוסף יששכר', titleEn:'Yosef Yissachar', color:'#757d98', mark:'❖'},
].map(Object.freeze));

// The supplied family chart is the source for these names and marriages.
// The owner identified Jidaan as Saadia, son of Aharon. Tzadok and Aharon's
// branches remain independent until their relationship is established.
const people = [
  ['keha-zechariah','זכריה קהא הבן','Zechariah Keha the Younger','m','u-keha-zechariah',['זכריה קהא'],{about:'בנו של סעדיה קהא ואחיינו של זכריה קהא האב. בן דודו של שלמה קהא, ולא בנו של זכריה קהא האב. נשוי ליהודית קהא.'}],
  ['keha-yehudit','יהודית קהא','Yehudit Keha','f','u-keha-zechariah'],
  ['keha-zechariah-father','זכריה קהא האב','Zechariah Keha the Elder','m','u-keha-zechariah-father',[],{deceased:true,siblings:['saadia-elder'],about:'אביו של שלמה קהא ואחיו של סעדיה קהא. נפטר בתימן לפני העלייה ולא זכה לעלות ארצה. שם אשתו טרם ידוע. זכריה קהא הבן הוא אחיינו, בנו של סעדיה.'}],
  ['kehat-tzadok-elder','צדוק קהא','Tzadok Keha','m','u-kehat-tzadok-elder'],
  ['kehat-zechariah-ben-tzadok','זכריה בן צדוק קהת','Zechariah Kehat, son of Tzadok','m','u-kehat-zechariah-ben-tzadok',['זכריה בן צדוק קהא']],
  ['kehat-aharon-elder','אהרון קהא','Aharon Keha','m','u-kehat-aharon-elder'],
  ['kehat-jidaan','סעדיה (ג׳ידעאן) בן אהרון קהת','Saadia (Jidaan) Kehat, son of Aharon','m','u-keha-kehat',['ג׳ידעאן קהת','ג׳ימען קהת','גימען קהת','גידעאן קהת','סעדיה בן אהרון קהא','סעדיה בן אהרון קהת']],
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
  ['keha-yosef-yissachar','יוסף יששכר','Yosef Yissachar','m','u-keha-yissachar'],
];
export const EXTENDED_PEOPLE = Object.freeze([...people.map(([id,name,englishName,gender,unit,aliases=[],details={}]) =>
  Object.freeze({id,name,englishName,nameEn:englishName,gender,unit,aliases,...details})),...SAADIA_PEOPLE]);

const firstChildren = ['yaakov','zechariah','aharon','yehudit'].map(id=>'u-kehat-'+id);
const secondChildren = ['hadassah','shula','tzion'].map(id=>'u-kehat-'+id);
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
  ['u-keha-kehat',['kehat-jidaan','kehat-first-wife','kehat-miriam'],[...firstChildren,...secondChildren,'u-kehat-tzvia'],'u-kehat-aharon-elder',{
    relationships:[
      {people:['kehat-jidaan','kehat-first-wife'],children:firstChildren,relationship:'spouse',label:'נישואין ראשונים',labelEn:'First marriage'},
      {people:['kehat-jidaan','kehat-miriam'],children:secondChildren,relationship:'spouse',label:'נישואין שניים',labelEn:'Second marriage'},
      // Tzvia’s mother was not specified; connect her only to her father.
      {people:['kehat-jidaan'],children:['u-kehat-tzvia'],relationship:'parent',label:'',labelEn:''},
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
  ['u-keha-yissachar',['keha-yosef-yissachar'],[],null],
];

export function createExtendedFamily(original = {}) {
  const roster = original.sharedPeople || {};
  const result = {title:EXTENDED_NAME, root:'u-root', people:{}, units:{}, branches:EXTENDED_BRANCHES, branchIds:new Map(), identities:{}};
  for (const [id,members,children,parent,details={}] of units) result.units[id] = {id,people:[...members],children:[...children],parent,relationship:members.length>1?'spouse':'single',...structuredClone(details)};
  for (const unit of SAADIA_UNITS) result.units[unit.id]=structuredClone(unit);
  for (const seed of EXTENDED_PEOPLE) result.people[seed.id] = {...seed,...roster[seed.id],extra:false,extended:false,unit:seed.unit};
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
  // Only the owner's confirmed paternal connection is added. Reorder this root
  // in the extended projection so Yona does not inherit Shlomo's father.
  if(result.units['u-root']){
    result.units['u-root'].parent='u-keha-zechariah-father';
    result.units['u-root'].people=['shlomo',...result.units['u-root'].people.filter(id=>id!=='shlomo')];
  }
  result.branchIds.set('keha-zechariah-father','shlomo');
  result.branchIds.set('saadia-elder','zechariah');
  // Kehat and Yissachar remain independent; no common ancestor is inferred.
  for (const branch of EXTENDED_BRANCHES) {
    const todo=[branch.unit];
    while(todo.length){
      const unit=result.units[todo.pop()];if(!unit)continue;
      for(const id of unit.people)result.branchIds.set(id,branch.id);
      todo.push(...unit.children);
    }
  }
  return result;
}
