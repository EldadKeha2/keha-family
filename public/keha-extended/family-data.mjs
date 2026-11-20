export const EXTENDED_NAME = 'משפחת קהא המורחבת';
export const EXTENDED_COLOR = '#345d83';
export const EXTENDED_HOME = '/keha-extended/';
export const EXTENDED_BRANCHES = Object.freeze([
  {id:'shlomo', unit:'u-root', label:'הענף של שלמה קהא', shortLabel:'שלמה קהא', titleEn:'Shlomo Keha’s branch', color:EXTENDED_COLOR, mark:'❖'},
  {id:'zechariah', unit:'u-keha-zechariah', label:'זכריה ויהודית קהא', shortLabel:'זכריה ויהודית', titleEn:'Zechariah & Yehudit Keha', color:'#597d98', mark:'❖'},
  {id:'kehat', unit:'u-keha-kehat', label:'משפחת קהת — ג׳ידעאן', shortLabel:'משפחת קהת', titleEn:'Kehat family — Jidaan', color:'#537b82', mark:'❖'},
  {id:'yissachar', unit:'u-keha-yissachar', label:'יוסף יששכר', shortLabel:'יוסף יששכר', titleEn:'Yosef Yissachar', color:'#757d98', mark:'❖'},
].map(Object.freeze));

// The supplied family chart is the source for these names and marriages.
// Jidaan is a family nickname. No official name or common ancestor is inferred.
const people = [
  ['keha-zechariah','זכריה קהא','Zechariah Keha','m','u-keha-zechariah'],
  ['keha-yehudit','יהודית קהא','Yehudit Keha','f','u-keha-zechariah'],
  ['kehat-jidaan','ג׳ידעאן קהת','Jidaan Kehat','m','u-keha-kehat',['ג׳ימען קהת','גימען קהת','גידעאן קהת']],
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
export const EXTENDED_PEOPLE = Object.freeze(people.map(([id,name,englishName,gender,unit,aliases=[],details={}]) =>
  Object.freeze({id,name,englishName,nameEn:englishName,gender,unit,aliases,...details})));

const firstChildren = ['yaakov','zechariah','aharon','yehudit'].map(id=>'u-kehat-'+id);
const secondChildren = ['hadassah','shula','tzion'].map(id=>'u-kehat-'+id);
const units = [
  ['u-keha-zechariah',['keha-zechariah','keha-yehudit'],[],null],
  ['u-keha-kehat',['kehat-jidaan','kehat-first-wife','kehat-miriam'],[...firstChildren,...secondChildren,'u-kehat-tzvia'],null,{
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
  // Four independent roots. These are navigation branches, not an asserted pedigree.
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
