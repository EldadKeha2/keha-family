export const nameCorrectionKey='name-roei-elharizi-2026-11-08-v1';

export const normalizedName=value=>value.normalize('NFKD').replace(/[\u0591-\u05c7'"׳״]/g,'').replace(/\s+/g,' ').toLowerCase().trim();
const roeiAliases=new Set(['רועי חריזי','רועי אלחריזי','roei harizi','roi harizi','roei elharizi','roi elharizi']);

// Old names still select the same person when tagging from an older open page.
export function matchingPeople(roster,name){
  const key=normalizedName(name),roei=roeiAliases.has(key)&&roster.find(person=>person.id==='roi');
  return roei?[roei]:roster.filter(person=>[person.name,person.nameEn].filter(Boolean).some(alias=>normalizedName(alias)===key));
}

export function correctPersonName(value){
  return value.replace(/רועי([\s_-]+)חריזי(?![\p{L}\p{N}])/gu,'רועי$1אלחריזי')
    .replace(/(?<![\p{L}\p{N}])(?:Roei|Roi)([\s_-]+)Harizi(?![\p{L}\p{N}])/giu,'Roei$1Elharizi');
}

const displayFields=new Set(['name','nameEn','caption','title','titleEn','body','bodyEn','author','about','aboutEn','description','descriptionEn','text','textEn','notes','notesEn','message','filename','label','labelEn','occupation','occupationEn','employer','role','question','options','answers','explanation','hint']);
// Only display text changes. Storage keys, URLs, IDs and photo edit metadata stay intact.
export function correctNamedContent(value,field=''){
  if(typeof value==='string')return displayFields.has(field)?correctPersonName(value):value;
  if(Array.isArray(value))return value.map(item=>correctNamedContent(item,field));
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,correctNamedContent(item,key)]));
  return value;
}
