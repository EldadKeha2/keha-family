// Year precision follows the records. A range spans conflicting evidence;
// an unconfirmed grave remains a candidate even when its years are displayed.
const voters='https://journaliststudio.google.com/backlight/download-file?document_id=9ec5c52474ae0455_651618796c280a6a#page=301';
const grave=id=>'https://billiongraves.com/grave/'+id;
export const HISTORICAL_LIFE_UPDATES=Object.freeze({
  'kehat-jidaan':{
    birthYear:null,birthYearMin:1870,birthYearMax:1877,
    birthYearSource:'טווח משוער · 1870 בפנקס תש״ב; 1876–1877 לפי הגיל במצבה',
    birthYearSourceEn:'Estimated range · 1870 in the 1941–1942 register; 1876–1877 from the gravestone age',
    deceased:true,deathDate:'9.12.1962',deathYearSource:'מצבה · י״ב בכסלו תשכ״ג',deathYearSourceEn:'Gravestone · 12 Kislev 5723',
    researchNotes:'בנו של אהרון ואביהם של זכריה (הבכור), אהרון, יהודית ויעקב מנישואיו הראשונים לשושנה, ושל ציון, שולה, צביה והדסה מנישואיו למרים. בתעודת נישואי יעקב מ־14.3.1947 נכתב ״סעדיה בן אהרון קהא״. אלדד זיהה את מצבת סעדיה קהא טירי בן אהרון עם סעדיה (ג׳ימעאן) שבעץ וביקש להזין ממנה את שנת הפטירה. במצבה: י״ב בכסלו תשכ״ג, 9.12.1962, בן 85. בפנקס תש״ב, שורה 3497, נרשמה שנת 1870; הגיל במצבה מצביע על 1876–1877. מוצג טווח משוער 1870–1877, ולא תאריך לידה מלא. ברישום 1936, שורה 77, מופיע סעדיה גאה בן אהרן ללא שנת לידה. קטע הבחירות המקומיות שבו נרשם גיל 53 נשמר להשוואה; תקופת התיק אינה שנת הרשימה ולכן אין לחשב ממנו שנת לידה מדויקת. אין לערבב עם סעדיה בן סעדיה יליד 1883 או עם סעדיה בן זכריה.',
    extraSources:[{label:'פנקס תש״ב · דף 59 · סעדיה בן אהרן, שורה 3497',labelEn:'1941–1942 register · page 59 · Saadia, son of Aharon, line 3497',url:voters}],
    graveStatus:'confirmed',
  },
  'kehat-miriam':{
    birthYear:1912,birthYearSource:'פנקס תש״ב · מרים בת משה, שורה 3496',birthYearSourceEn:'1941–1942 register · Miriam, daughter of Moshe, line 3496',
    researchNotes:'אשתו השנייה של סעדיה (ג׳ימעאן), ואמם של ציון, שולה, צביה והדסה לפי אישור המשפחה. בפנקס 1936 נרשמה מרים גאה בת משה בשורה 78, מיד אחרי סעדיה בן אהרן. בפנקס תש״ב, שורה 3496, נרשמה מרים קהה בת משה, ילידת 1912. ההצלבה היא לפי שמה ושם אביה; אין לאחד אותה עם מרים בת סעדיה, ילידת 1885, בשורה 3489. בקטע הבחירות המקומיות היא נרשמה בת 33, אך שנת עריכת הרשימה לא נקבעה. שנת פטירה לא ידועה.',
    extraSources:[{label:'פנקס תש״ב · דף 59 · מרים בת משה, שורה 3496',labelEn:'1941–1942 register · page 59 · Miriam, daughter of Moshe, line 3496',url:voters}],
  },
  'kehat-tzadok':{
    birthYear:null,birthYearMin:1915,birthYearMax:1917,
    birthYearSource:'טווח · גיל 28 בנישואי 1944; שנת 1917 בפנקס תש״ב',birthYearSourceEn:'Range · age 28 at the 1944 wedding; 1917 in the 1941–1942 register',
  },
  'kehat-aharon':{
    birthYearMin:1904,birthYearMax:1906,
    birthYearSource:'טווח משוער · רישומי 1905–1906 בפנקס והגיל 72 במצבה',birthYearSourceEn:'Estimated range · 1905–1906 register entries and age 72 on the gravestone',
    showGraveYears:true,
  },
  'kehat-aharon-saida':{
    lifeRecords:[{birthYearMin:1897,birthYearMax:1898,deathYear:1988,deathHebrew:'ח׳ באדר ב׳ תשמ״ח',ageAtDeath:90,showYears:true,note:'בתצלום המצבה המשותפת עם אהרון בן סעדיה: סעידה קהא בת יוסף ונכלה מחדון, בת 90. ההתאמה לבת הזוג שבתרשים נשמרת כהצלבה, ולא כתאריך לידה מלא.',url:grave('אהרון-קהא/20705567')}],
    showGraveYears:true,
  },
  'kehat-zechariah-ben-tzadok':{showGraveYears:true},
  'kehat-tziona':{showGraveYears:true},
  'kehat-naomi':{showGraveYears:true},
  'kehat-israel-mizrahi':{showGraveYears:true},
  'kehat-zechariah':{
    deceased:true,deathYear:1979,deathYearSource:'מצבת זכריה קהא טרי בן סעדיה · ז׳ בתמוז תשל״ט',deathYearSourceEn:'Zechariah Keha Tri, son of Saadia · gravestone, 7 Tammuz 5739',
    evidenceNote:'במצבה המשותפת נכתב זכריה קהא טרי בן סעדיה, נפטר בז׳ בתמוז תשל״ט (1979), בן 77. הגיל תואם את שנת 1902 שבשאלון פרס הילודה. שנת הפטירה מוזנת ברמת שנה בלבד.',
    extraSources:[{label:'מצבת זכריה בן סעדיה · פטירה בשנת 1979',labelEn:'Zechariah, son of Saadia · gravestone, death in 1979',url:grave('זכריה-קהא-טרי/21007123')}],
  },
  'tri-yona':{
    lifeRecords:[{birthYearMin:1909,birthYearMax:1910,deathYear:1985,ageAtDeath:75,showYears:true,note:'ברישום המצבה המשולשת: יונה חממה בת יוסף כובשי, נפטרה בתשמ״ה, בת 75. שנת 1912 שבשאלון נשמרת כשנת הלידה הראשית; פער הגיל וזיהוי המצבה עדיין בבירור.',url:grave('זכריה-קהא-טרי/21007123')}],
    showGraveYears:true,
  },
  'tri-menachem':{
    lifeRecords:[{birthYearMin:1912,birthYearMax:1913,deathYear:1985,ageAtDeath:72,showYears:true,note:'המצבה המועמדת מציינת מנחם בן זכריה, נפטר בתשמ״ה בגיל 72. הגיל סותר את שנת 1932 בשאלון המשפחתי; שנת 1932 נשמרת כשנת הלידה, ושנת הפטירה מן המצבה מוצגת עם סימן שאלה עד להכרעת הזיהוי.',url:grave('זכריה-קהא-טרי/21007123')}],
    showGraveYears:true,
  },
  'tri-shifra':{
    birthYearMin:1945,birthYearMax:1946,birthYearSource:'משוער לפי גיל 69 ברישום הקבורה מ־7.12.2015',birthYearSourceEn:'Estimated from age 69 in the burial record of 7 December 2015',
  },
});

export function enrichHistoricalLifeEvidence(people){
  for(const [id,update] of Object.entries(HISTORICAL_LIFE_UPDATES)){
    const person=people.get(id);if(!person)continue;
    const {showGraveYears,graveStatus,evidenceNote,extraSources,...fields}=update;
    Object.assign(person,structuredClone(fields),{historicalLifeEvidence:true});
    if(evidenceNote)person.researchNotes=(person.researchNotes||'')+' '+evidenceNote;
    if(extraSources)person.researchSources=[...(person.researchSources||[]),...extraSources];
    if(person.lifeRecords)person.lifeRecords=person.lifeRecords.map(record=>({...record,...(showGraveYears?{showYears:true}:{}),...(graveStatus?{status:graveStatus,note:'מצבת סעדיה קהא טירי בן אהרון שזוהתה במשפחה. הגיל 85 מצביע על 1876–1877; בפנקס תש״ב נרשמה 1870.'}:{})}));
    if(graveStatus==='confirmed')person.researchSources=person.researchSources?.map(source=>source.url?.includes('/21004018')?{...source,label:'מצבת סעדיה קהא טירי בן אהרון · פטירה 1962',labelEn:'Saadia Keha Tiri, son of Aharon · gravestone, death in 1962'}:source);
  }
}
