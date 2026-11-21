import {HttpError,escapeHTML} from './http.mjs';

export const STORY_RECIPIENT='eldadkeha@gmail.com';
export const STORY_PEOPLE=Object.freeze({shlomo:'סבא שלמה קהא',yona:'סבתא יונה קהא',both:'סבא שלמה וסבתא יונה קהא',margalit:'סבתא מרגלית',yahia:'סבא יחיא (אבא של מרגלית)'});
export const STORY_FORMS=Object.freeze({
  grandparents:{label:'משפחת קהא',people:{shlomo:STORY_PEOPLE.shlomo,yona:STORY_PEOPLE.yona,margalit:STORY_PEOPLE.margalit,yahia:STORY_PEOPLE.yahia}},
  yehuda:{label:'זהור ודוד יהודה נקאש',people:{zehor:'זהור',yehuda:'דוד יהודה נקאש'}},
  haim:{label:'חיים ושושנה נקאש',people:{haim:'חיים נקאש',shoshana:'שושנה'}},
  medina:{label:'משפחת מדינה',people:{ruma:'רומה מדינה',yosef:'יוסף מדינה'}},
});

export function storyFormURL(branch){
  const suffix=['yehuda','haim','medina'].includes(branch)?branch+'/':['extended','zechariah','zechariah-tzadok','kehat'].includes(branch)?'extended/':'';
  return 'https://keha-family.eldadkeha.workers.dev/share-story/'+suffix;
}
export function withStoryFormLink(html,branch){
  return html.replace(/(<a\b[^>]*\bid="storyQuestionnaireLink"[^>]*\bhref=")[^"]*/,(_match,start)=>start+storyFormURL(branch));
}

export function storySubmission(value){
  if(typeof value.name!=='string'||/[\u0000-\u001f\u007f\u2028\u2029]/.test(value.name))throw new HttpError(400,'יש לכתוב שם פרטי ושם משפחה.');
  const name=value.name.normalize('NFKC').trim().replace(/\s+/g,' ');
  if(name.length>100||name.split(' ').filter(part=>/\p{L}/u.test(part)).length<2)throw new HttpError(400,'יש לכתוב שם פרטי ושם משפחה.');
  const scope=value.scope??'grandparents',extended=scope==='extended';
  if(!extended&&!Object.hasOwn(STORY_FORMS,scope))throw new HttpError(400,'הטופס אינו תקין. יש לרענן ולנסות שוב.');
  let personIds,legacy=false;
  if(!extended){
    const allowed=Object.keys(STORY_FORMS[scope].people);
    if(value.personIds!==undefined){
      if(!Array.isArray(value.personIds)||!value.personIds.length||value.personIds.length>allowed.length||value.personIds.some(id=>typeof id!=='string'||!allowed.includes(id)))throw new HttpError(400,'יש לסמן לפחות אדם אחד מהרשימה.');
      personIds=allowed.filter(id=>value.personIds.includes(id));
    }else if(scope==='grandparents'&&Object.hasOwn(STORY_PEOPLE,value.person))legacy=true;
    else throw new HttpError(400,'יש לבחור על מי הסיפור.');
  }
  let people='';
  if(extended){
    const raw=value.people??'';
    if(typeof raw!=='string'||raw.length>2000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(raw))throw new HttpError(400,'אפשר לכתוב שמות של אנשים באורך של עד 2,000 תווים, או להשאיר את השדה ריק.');
    people=raw.trim().replace(/\s+/g,' ');
  }
  if(typeof value.story!=='string')throw new HttpError(400,'יש לכתוב את הסיפור.');
  const story=value.story.replace(/\r\n?/g,'\n').trim();
  if(!story||story.length>50000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(story))throw new HttpError(400,'יש לכתוב סיפור באורך של עד 50,000 תווים.');
  if(typeof value.requestId!=='string'||!/^[a-f0-9]{32}$/.test(value.requestId)||value.website)throw new HttpError(400,'לא ניתן לשלוח את הטופס. יש לרענן ולנסות שוב.');
  return extended?{name,scope:'extended',people,story,requestId:value.requestId}:legacy?{name,person:value.person,story,requestId:value.requestId}:{name,scope,personIds,story,requestId:value.requestId};
}

export function storyEmail(value){
  const extended=value.scope==='extended',form=STORY_FORMS[value.scope||'grandparents'];
  const person=extended?(value.people||'לא צוינו'):value.personIds?value.personIds.map(id=>form.people[id]).join(', '):STORY_PEOPLE[value.person],label=extended?'אנשים שמוזכרים בסיפור':'על מי הסיפור',context=extended?'קהא המורחבת':value.scope?form.label:'';
  const subject=extended?`סיפור מקהא המורחבת — מאת ${value.name}`:`סיפור על ${person} — מאת ${value.name}`;
  return {subject,text:`שם המספר/ת: ${value.name}\n${context?context+'\n':''}${label}: ${person}\n\n${value.story}`,html:`<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><body style="font-family:Arial,sans-serif;line-height:1.8;color:#182d3b"><h1 style="font-size:24px">סיפור משפחתי חדש</h1>${context?'<p>'+context+'</p>':''}<p><strong>שם המספר/ת:</strong> ${escapeHTML(value.name)}<br><strong>${label}:</strong> ${escapeHTML(person)}</p><div dir="auto" style="white-space:pre-wrap;font-size:18px">${escapeHTML(value.story)}</div></body></html>`};
}
