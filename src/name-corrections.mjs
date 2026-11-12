export const nameCorrectionKey='names-roei-elharizi-yona-nakash-keha-2026-11-13-v2';

export const normalizedName=value=>value.normalize('NFKD').replace(/[\u0591-\u05c7'"׳״]/g,'').replace(/\s+/g,' ').toLowerCase().trim();
const roeiAliases=new Set(['רועי חריזי','רועי אלחריזי','roei harizi','roi harizi','roei elharizi','roi elharizi']);
const yonaAliases=new Set(['יונה נקאש','יונה נקאש קהא','yona nakash','yona nakash keha']);

// Old names still select the same person when tagging from an older open page.
export function matchingPeople(roster,name){
  const key=normalizedName(name),known=roeiAliases.has(key)?'roi':yonaAliases.has(key)?'yona':null,person=known&&roster.find(person=>person.id===known);
  return person?[person]:roster.filter(person=>[person.name,person.nameEn].filter(Boolean).some(alias=>normalizedName(alias)===key));
}

export function correctPersonName(value){
  return value.replace(/רועי([\s_-]+)חריזי(?![\p{L}\p{N}])/gu,'רועי$1אלחריזי')
    .replace(/(?<![\p{L}\p{N}])(?:Roei|Roi)([\s_-]+)Harizi(?![\p{L}\p{N}])/giu,'Roei$1Elharizi')
    .replace(/(?<![\p{L}\p{N}])יונה([\s_-]+)נקאש(?![\p{L}\p{N}])(?!(?:[\s_-]+)קהא(?![\p{L}\p{N}]))/gu,'יונה$1נקאש$1קהא')
    .replace(/(?<![\p{L}\p{N}])Yona([\s_-]+)Nakash(?![\p{L}\p{N}])(?!(?:[\s_-]+)Keha(?![\p{L}\p{N}]))/giu,'Yona$1Nakash$1Keha');
}

const displayFields=new Set(['name','nameEn','caption','title','titleEn','body','bodyEn','author','about','aboutEn','description','descriptionEn','text','textEn','notes','notesEn','message','filename','label','labelEn','occupation','occupationEn','employer','role','question','options','answers','explanation','hint']);
// Only display text changes. Storage keys, URLs, IDs and photo edit metadata stay intact.
export function correctNamedContent(value,field=''){
  if(typeof value==='string')return displayFields.has(field)?correctPersonName(value):value;
  if(Array.isArray(value))return value.map(item=>correctNamedContent(item,field));
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,correctNamedContent(item,key)]));
  return value;
}
