import {HttpError} from './http.mjs';

export const DOCUMENT_CATEGORIES=[
  {id:'marriage',he:'תעודות נישואין',en:'Marriage certificates'},
  {id:'graves',he:'קברים',en:'Graves'},
  {id:'aliyah',he:'תעודות עליה',en:'Immigration certificates'},
  {id:'death',he:'תעודות פטירה',en:'Death certificates'},
  {id:'other',he:'אחר',en:'Other'},
];

export function checkDocumentCategory(value){
  if(!DOCUMENT_CATEGORIES.some(c=>c.id===value))throw new HttpError(400,'בחרו תגית מהרשימה.');
  return value;
}

// Use the record's own label first. A gravestone caption can also cite a marriage or death certificate.
const types=[
  ['graves',/(?:מצב(?:ה|ת|ות)|קבר(?:ים|י)?|בית (?:העלמין|הקברות)|\b(?:grave(?:s|stone)?|headstone|tombstone|cemetery|burial)\b|billiongraves)/i],
  ['marriage',/(?:נישואי[ןם]?|נשואי[ןם]?|נישאי[ןם]|כתובה|\b(?:marriage|ketubah|wedding (?:certificate|record))\b)/i],
  ['death',/(?:(?:תעוד[הת]|תעודות|רישום|רשומת|אישור|מרשם) (?:ה)?פטיר[הת]|\bdeath (?:certificate|record|register)s?\b)/i],
  ['aliyah',/(?:(?:תעוד[הת]|תעודות|רישיון|רשיון|אישור|פנקס|רשימת|כרטיס|סרטיפיקט) (?:ה)?(?:עלי{1,2}ה|עול[הים]+|הגירה)|\b(?:aliyah|immigration|immigrant|landing) (?:certificate|card|permit|record|list)s?\b)/i],
];

export function documentCategory(item){
  if(item.documentCategory)return item.documentCategory;
  if(item.kind==='audio'||item.mime?.startsWith('audio/'))return 'other';
  const caption=String(item.caption||'').trim();
  const recordDescription=/^(?:(?:צילום|תצלום|סריקה של|סריקת|העתק של|העתק) (?:של )?)?(?:תעוד|רישום|מצב[הת]|ה?קבר|נישואי|פנקס עול)/.test(caption)?caption.split(/[.;\n]/,1)[0]:'';
  for(const field of [item.name,item.title,item.filename,recordDescription]){
    const label=String(field||'').normalize('NFKD').replace(/[_־–—-]+/g,' ').replace(/[\u0591-\u05c7]/g,'').replace(/\s+/g,' ');
    const match=types.find(([,pattern])=>pattern.test(label));
    if(match)return match[0];
  }
  return 'other';
}
