import {TRI_SIBLINGS} from './tri-data.mjs';

const yonaChildren=new Set(TRI_SIBLINGS);
const descriptionFields=['about','aboutEn','researchNotes','researchNotesEn'];

// Research provenance is attributed to family testimony, rather than to the
// organizer. Person names, dates, relationships and source documents are separate.
export function neutralProfileDescription(value){
  if(typeof value!=='string')return value;
  return value
    .replaceAll('אלדד זיהה את מצבת סעדיה קהא טירי בן אהרון עם סעדיה (ג׳ידעאן) שבעץ וביקש להזין ממנה את שנת הפטירה','מצבת סעדיה קהא טירי בן אהרון זוהתה במשפחה כמצבת סעדיה (ג׳ידעאן) שבעץ')
    .replaceAll('לפי התיקון שאישר אלדד','לפי התיקון המשפחתי')
    .replaceAll('לפי זיהוי אלדד והתרשים המשפחתי','לפי הזיהוי והתרשים המשפחתי')
    .replaceAll('לפי זיהוי אלדד','לפי הזיהוי המשפחתי')
    .replaceAll('לפי אישור אלדד','לפי אישור המשפחה')
    .replaceAll('אלדד אישר שזה','לפי האישור המשפחתי, זהו')
    .replaceAll('אלדד אישר את זיהויו עם','בתיעוד המשפחתי אושר זיהויו עם')
    .replaceAll('אלדד אישר את הזיהוי עם','בתיעוד המשפחתי אושר הזיהוי עם')
    .replaceAll('אלדד זיהה את האב כ','האב זוהה במשפחה כ')
    .replaceAll(' ונמסרה בידי אלדד','')
    .replaceAll('אושרו בידי אלדד','אושרו במשפחה')
    .replaceAll('אושר בידי אלדד','אושר במשפחה')
    .replaceAll('נמסר בידי אלדד','נמסר בעדות המשפחתית')
    .replace(/\bEldad(?: Keha)? confirmed\b/gi,'The family confirmed')
    .replace(/\b(?:confirmed|identified) by Eldad(?: Keha)?\b/gi,match=>match.startsWith('identified')?'identified by the family':'confirmed by the family')
    .replace(/אלדד(?: קהא)?/g,'בן המשפחה')
    .replace(/\bEldad(?: Keha)?\b/gi,'a family member');
}

export function cleanProfileDescriptions(person){
  const cleaned={...person},clear=yonaChildren.has(person.id);
  for(const field of descriptionFields){
    if(clear)cleaned[field]='';
    else if(typeof person[field]==='string')cleaned[field]=neutralProfileDescription(person[field]);
  }
  if(person.lifeRecords)cleaned.lifeRecords=person.lifeRecords.map(record=>({
    ...record,...(typeof record.note==='string'?{note:clear?'':neutralProfileDescription(record.note)}:{}),
  }));
  return cleaned;
}
