import {HttpError,escapeHTML} from './http.mjs';

export const STORY_RECIPIENT='eldadkeha@gmail.com';
export const STORY_PEOPLE=Object.freeze({shlomo:'סבא שלמה קהא',yona:'סבתא יונה קהא',both:'סבא שלמה וסבתא יונה קהא'});

export function storySubmission(value){
  if(typeof value.name!=='string'||/[\u0000-\u001f\u007f\u2028\u2029]/.test(value.name))throw new HttpError(400,'יש לכתוב שם פרטי ושם משפחה.');
  const name=value.name.normalize('NFKC').trim().replace(/\s+/g,' ');
  if(name.length>100||name.split(' ').filter(part=>/\p{L}/u.test(part)).length<2)throw new HttpError(400,'יש לכתוב שם פרטי ושם משפחה.');
  if(!Object.hasOwn(STORY_PEOPLE,value.person))throw new HttpError(400,'יש לבחור על מי הסיפור.');
  if(typeof value.story!=='string')throw new HttpError(400,'יש לכתוב את הסיפור.');
  const story=value.story.replace(/\r\n?/g,'\n').trim();
  if(!story||story.length>50000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(story))throw new HttpError(400,'יש לכתוב סיפור באורך של עד 50,000 תווים.');
  if(typeof value.requestId!=='string'||!/^[a-f0-9]{32}$/.test(value.requestId)||value.website)throw new HttpError(400,'לא ניתן לשלוח את הטופס. יש לרענן ולנסות שוב.');
  return {name,person:value.person,story,requestId:value.requestId};
}

export function storyEmail(value){
  const person=STORY_PEOPLE[value.person],subject=`סיפור על ${person} — מאת ${value.name}`;
  return {subject,text:`שם המספר/ת: ${value.name}\nעל מי הסיפור: ${person}\n\n${value.story}`,html:`<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><body style="font-family:Arial,sans-serif;line-height:1.8;color:#182d3b"><h1 style="font-size:24px">סיפור משפחתי חדש</h1><p><strong>שם המספר/ת:</strong> ${escapeHTML(value.name)}<br><strong>על מי הסיפור:</strong> ${escapeHTML(person)}</p><div dir="auto" style="white-space:pre-wrap;font-size:18px">${escapeHTML(value.story)}</div></body></html>`};
}
