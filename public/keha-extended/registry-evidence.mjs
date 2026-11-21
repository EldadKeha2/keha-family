// Source transcription is separate from the family's identification of a row.
// Keep existing profile IDs so portraits, tags and documents remain attached.
const source={label:'פנקס הבוחרים תש״ט · רחובות · דפים 18–19',labelEn:'1949 Rehovot electoral register · pages 18–19',url:'/media/b074b0e8e7fa4279b70a29472b7c8d28'};
export const KEHA_1949_RECORDS=Object.freeze([
  {personId:'keha-zechariah',name:'זכריה',surname:'קהא',father:'שלום',birthYear:1888,registration:'505026',address:'כרם סיניקין, סעדיה קהא',pdfPage:180},
  {personId:'keha-yehudit',name:'יהודית',surname:'קהא',father:'סעדיה',birthYear:1893,registration:'505027',address:'כרם סיניקין, סעדיה קהא',pdfPage:180},
  {personId:'saadia-saadia',name:'סעדיה',surname:'קהא',father:'זכריה',birthYear:1910,registration:'505023',address:'כרם סיניקין, פרטי',pdfPage:181},
  {personId:'saadia-saida',name:'סעידה',surname:'קהא',father:'יוסף',birthYear:1918,registration:'505024',address:'כרם סיניקין, פרטי',pdfPage:181},
  {personId:'shlomo',name:'שלמה',surname:'קהא',father:'זכריה',birthYear:1907,registration:'505006',address:'כרם סיניקין, פרטי',pdfPage:181},
  {personId:'yona',name:'יונה',surname:'קהא',father:'זכריה',birthYear:1921,registration:'505007',address:'כרם סיניקין, פרטי',pdfPage:181},
].map(Object.freeze));

export const REGISTRY_CORRECTION_IDS=Object.freeze(['keha-zechariah','keha-yehudit','saadia-elder','keha-zechariah-father','saadia-saadia','saadia-saida','saadia-kadya','kehat-zechariah','tri-yona','kehat-yaakov-yehudit']);
export const REGISTRY_CORRECTION_FIELDS=Object.freeze(['researchNotes','researchSources','recordedParents','registryRecords','registryIdentityCorrection','birthYear','birthYearSource','birthYearSourceEn','lifeRecords']);

export function applyRegistryEvidence(people){
  const add=(id,fields)=>{const p=people.get(id);if(p)Object.assign(p,fields,{registryIdentityCorrection:true});};
  for(const row of KEHA_1949_RECORDS){
    const p=people.get(row.personId);if(!p)continue;
    p.registryRecords=[{...row,sourceYear:1949,sourceUrl:source.url}];
    p.researchSources=[...(p.researchSources||[]),source];
  }
  add('keha-zechariah',{
    birthYear:1888,birthYearSource:'פנקס תש״ט · מספר רישום 505026',birthYearSourceEn:'1949 register · registration 505026',deathDate:'23.11.1957',deathYear:1957,deceased:true,
    recordedParents:{father:'שלום'},
    researchNotes:'בן שלום, כפי שנכתב בפנקס תש״ט (1888; מספר רישום 505026), ובן דודו של שלמה לפי זיהוי המשפחה. בתש״ב, שורה 3487, נרשם זכריה בן שלום יליד 1890; שתי שנות המקור נשמרות. הזיהוי הקודם כבן סעדיה הוסר בעקבות ההצלבה המשפחתית. יהודית בת סעדיה, 1893, מספר 505027, היא אשתו לפי הזיהוי המשפחתי; שני המספרים העוקבים והכתובת המשותפת תומכים בזיהוי. המשפחה אישרה את שיוך הקבר שנמצא במרמורק; בתמלול הקודם: זכריה בן שלום, פטירה 23.11.1957, בן 72, ולכן אין לחשב ממנו שנת לידה מדויקת. אין לזהותו עם זכריה קהא טירי בן סעדיה (ג׳ידעאן), יליד 1902, בעלה של יונה. זכריה גהא בן סעדיה משורה 82 ב־1936 נשאר רשומה נפרדת שזהותה טרם הוכרעה.',
    lifeRecords:[{deathYear:1957,ageAtDeath:72,status:'confirmed',showYears:true,note:'שיוך המצבה לזכריה בן שלום אושר במשפחה ב־21.11.2026. תמלול המחקר הקודם: 23.11.1957, בן 72; שנת 1888 בפנקס אינה נגזרת מגיל זה.',url:'https://billiongraves.com/grave/זכריה-קהא/21007643'}],
  });
  add('keha-yehudit',{
    birthYear:1893,birthYearSource:'פנקס תש״ט · מספר רישום 505027',birthYearSourceEn:'1949 register · registration 505027',
    recordedParents:{father:'סעדיה עדואן'},deathYear:1971,deceased:true,
    researchNotes:'יהודית קהא בת סעדיה, ילידת 1893, מספר רישום 505027 בפנקס תש״ט, כרם סיניקין, סעדיה קהא. אשתו של זכריה בן שלום לפי זיהוי המשפחה, בתמיכת המספרים העוקבים והכתובת המשותפת. ברשומת תש״ב 3488 מופיעה יהודית בת סעדיה ילידת 1922; הפער של 29 שנים אינו מוכרע כהעתקה שגויה או כאישה אחרת. יהודית גהא מ־1936 רשומה בת זכריה, ולכן אין לשייך אותה אוטומטית לכאן. נפרדת מיהודית בת זכריה בן צדוק וציונה, אשת יעקב קהת מ־1947. שנת פטירתה לא הושלמה ללא תמלול קבר מאומת.',
  });
  const yehudit=people.get('keha-yehudit');
  if(yehudit){
    yehudit.researchNotes=yehudit.researchNotes.replace('שנת פטירתה לא הושלמה ללא תמלול קבר מאומת.','ברשומת הקבורה 21007644 היא מקושרת במפורש לזכריה באותה מצבה. שם אביה סעדיה עדואן; פטירה בכסלו תשל״ב (1971), ללא יום ידוע.');
    yehudit.researchSources=[...(yehudit.researchSources||[]),{label:'מצבת יהודית בת סעדיה עדואן · כסלו תשל״ב',labelEn:'Yehudit, daughter of Saadia Adwan · Kislev 5732',url:'https://billiongraves.com/grave/יהודית-קהא/21007644'}];
  }
  add('saadia-elder',{
    recordedParents:{},
    researchNotes:'שם אביו של זכריה, בן דודו של שלמה, תוקן מסעדיה לשלום לפי רישום 505026 בפנקס תש״ט ורשומת תש״ב 3487. הקשר בין שני ענפי בני הדודים נשען על עדות המשפחה. אין להעביר לשלום פרטי חיים שיוחסו בעבר לסעדיה, ואין לזהותו עם סעדיה (ג׳ידעאן) בן אהרון.',
  });
  add('keha-zechariah-father',{researchNotes:'אביו של שלמה. הקשר המשפחתי לבן דודו זכריה נשמר לפי עדות המשפחה; שם אביו של בן הדוד הוא שלום בפנקסי תש״ב ותש״ט. השם סעדיה ששויך קודם לאבי בן הדוד הוסר.'});
  const saadia=people.get('saadia-saadia');
  add('saadia-saadia',{
    recordedParents:{father:'זכריה',mother:'יהודית'},
    researchNotes:'שנת 1918 אושרה בידי בתו אביבה. בתעודת נישואיו מ־21.2.1945, H69399, היה בן 26 והוריו יחיא קהא ויהודית; גיל זה מתאים ל־1918–1919. ברשומת תש״ב 3490 נרשמה 1920. ברשומת תש״ט 505023 נרשמה 1910, לצד סעידה בת יוסף, 505024, 1918. שלוש שנות המקור נשמרות בלי להחליף את שנת 1918 שאושרה במשפחה. הזיהוי של סעדיה גהא בן זכריה משורה 85 ב־1936 ומרשומת 790 ב־1937 אינו מוכיח שזכריה בן סעדיה מ־1936 הוא אביו. הסמיכות ב־1936 אינה מכריעה את זהות האב.',
  });
  if(saadia)saadia.birthYear=1918;
  add('saadia-saida',{
    birthYear:1918,birthYearSource:'פנקס תש״ט · מספר רישום 505024',birthYearSourceEn:'1949 register · registration 505024',recordedParents:{father:'יוסף',mother:'שרה'},
    researchNotes:'סעידה קהא בת יוסף, ילידת 1918, מספר 505024 בפנקס תש״ט; לצד סעדיה בן זכריה, 505023. השיוך לזוג נשען על הזיהוי המשפחתי, שם האב והרצף במספרים. בתעודת נישואי סעדיה מ־21.2.1945, H69399, הכלה בת 22 והוריה יוסף ושרה; הגיל מצביע על 1922–1923 ואינו תואם את 1918 בפנקס. שני המקורות נשמרים לבירור, בלי תאריך לידה מלא.',
  });
  add('saadia-kadya',{researchNotes:'בתם הבכורה של זכריה ויהודית לפי עדות המשפחה. לאחר נישואיה נודעה גם בשם קדימה מזרחי. קדיה גהא בת זכריה, שורה 84 ב־1936, היא מועמדת לזיהוי בלבד; לא אותר עדיין רישום נוסף הקושר אותה במפורש לאותו זוג. אין להסיק מסמיכות שורות 82–85 שזכריה בן סעדיה הוא אביה.'});
  for(const [id,note] of [
    ['kehat-zechariah',' נפרד במפורש מזכריה בן שלום, בן דודו של שלמה, ומאשתו יהודית בת סעדיה. רשומת זכריה בן סעדיה יליד 1911 בתש״ב ורשומת 1936 הן מועמדות להשוואה, ללא איחוד על סמך שם האב בלבד.'],
    ['tri-yona',' יהודית בת זכריה בן צדוק אינה מזוהה כאשתו של זכריה: בתעודת 1947 היא אשת יעקב. השאלון מ־1954 מתעד כאן את הזוג זכריה ויונה.'],
    ['kehat-yaakov-yehudit',' היא בתו של זכריה בן צדוק, כלומר נכדת צדוק, ונפרדת מיהודית בת סעדיה ילידת 1893. אין לזהותה כאשת זכריה בן סעדיה על סמך הסמיכות בפנקס 1936.'],
  ]){const p=people.get(id);if(p)add(id,{researchNotes:(p.researchNotes||'')+note});}
}
