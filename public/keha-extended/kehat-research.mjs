// Owner confirmations, family charts and certificates H57320, H77495, H88579.
// Dates from voter registers retain year precision. Candidate tombstones never
// become exact birth dates, and unresolved names retain their existing IDs.
const weddingFile='https://journaliststudio.google.com/backlight/download-file?document_id=b70e69d5ac1fec2e_294dece0e6a0b728#page=72';
const tzadokFile='https://journaliststudio.google.com/backlight/download-file?document_id=bcabe2ef7e3d3a93_294dece0e6a0b728#page=81';
const naomiFile='https://journaliststudio.google.com/backlight/download-file?document_id=dd8f9b00a00d250d_294dece0e6a0b728#page=153';
export const KEHAT_RESEARCH_PEOPLE=[
  {id:'kehat-aharon-elder',researchNotes:'אביו של סעדיה, המוכר במשפחה כג׳ימעאן. זהו אהרון מהדור המבוגר; הוא אינו אהרון בן סעדיה, נכדו. שם אשתו טרם אומת.'},
  {id:'kehat-jidaan',aliases:['ג׳ימעאן טירי','סעדיה קהא טירי','סעדיה קהה','סעדיה גאה'],researchNotes:'בנו של אהרון. ילדיו מנישואיו הראשונים לשושנה, לפי סדר הלידה, הם זכריה, אהרון, יהודית ויעקב. בתעודת נישואי יעקב מ־14.3.1947 נכתב ״סעדיה בן אהרון קהא״. בפנקס 1936: סעדיה גאה בן אהרן, שורה 77. בתש״ב מופיע מועמד מקביל: סעדיה קהה בן אהרן, יליד 1870, שורה 3497. מצבת סעדיה קהא טירי בן אהרון, שנפטר ב־9.12.1962 בגיל 85, היא מועמדת לזיהויו; הגיל מצביע על לידה משוערת סביב 1877. שתי השנים נשמרות כמקורות נפרדים, ללא תאריך לידה מומצא.',researchSources:[{label:'תעודת נישואי יעקב ויהודית · H88579 · עמ׳ 72',labelEn:'Yaakov and Yehudit’s marriage certificate · H88579 · page 72',url:weddingFile},{label:'מצבת סעדיה קהא טירי בן אהרון · לזיהוי',labelEn:'Saadia Keha Tiri, son of Aharon · candidate gravestone',url:'https://billiongraves.com/grave/סעדיה-קהא-טירי/21004018'}]},
  {id:'kehat-first-wife',name:'שושנה קהא',englishName:'Shoshana Keha',nameEn:'Shoshana Keha',placeholder:false,deceased:true,researchNotes:'אשתו הראשונה של סעדיה לפי התרשים המשפחתי. שמה מופיע כאמו של יעקב בתעודת נישואיו מ־14.3.1947. שיוך שאר הילדים לנישואים הראשונים נשען על התרשים; שם משפחתה לפני הנישואין טרם ידוע.'},
  {id:'kehat-yaakov',researchNotes:'בנם של סעדיה בן אהרון קהא ושל שושנה. אלדד אישר שזה יעקב שבתעודת H88579. נישא ליהודית בת זכריה בן צדוק וציונה ב־14.3.1947 בשעריים, בגיל 25. ציונה היא אמה הביולוגית של יהודית, כפי שנרשם בתעודה ואושר בתיקון המשפחתי. כבר בתעודה זו שם משפחתו קהת, בעוד אביו רשום קהא. חבצלת, אורי וגילה הם ילדיהם לפי העדות המשפחתית. השם מרים שנרשם בתרשים מוקדם כבת זוגו נשמר לבירור, ואינו מוצג כנישואים נוספים מוכחים.',researchSources:[{label:'תעודת הנישואין · 14.3.1947 · H88579',labelEn:'Marriage certificate · 14 March 1947 · H88579',url:weddingFile}]},
  {id:'kehat-yaakov-miriam',unit:'u-kehat-unresolved-miriam',researchBranch:'kehat',researchNotes:'בתרשים מוקדם מופיע השם מרים לצד יעקב. בתעודת הנישואין המאומתת מ־1947 אשתו יהודית. זהותה של מרים והאם התקיימו נישואים נוספים עדיין בבירור; אין לחבר אותה כאשת יעקב או כאמו על סמך השם בלבד.'},
  {id:'kehat-yehudit',researchBranch:'kehat',researchNotes:'בתם של סעדיה (ג׳ימעאן) בן אהרון ושושנה. לפי עדות המשפחה נולדה אחרי זכריה ואהרון ולפני יעקב. גיסתה יהודית בת זכריה בן צדוק נישאה לאחיה יעקב ב־1947.'},
  {id:'kehat-aharon',researchNotes:'בנו של סעדיה (ג׳ימעאן), ונכדו של אהרון. לפי התרשים נשוי לסעידה מחדון. בפנקס תש״ב מופיעים אהרן קהא בן סעדיה, 1906, שורה 3480, ואהרן קהה בן סעדיה, 1905, שורה 3500. ייתכן רישום כפול; לא הוכרע. מצבת אהרון קהא בן סעדיה, שנפטר בב׳ בכסלו תשל״ח בגיל 72 לצד סעידה בת יוסף ונכלה מחדון, מתאימה כרונולוגית ללידה סביב 1905. זו התאמה תומכת, ולא תאריך לידה מדויק.',researchSources:[{label:'מצבת אהרון בן סעדיה וסעידה · להשוואה',labelEn:'Aharon, son of Saadia, and Saida · gravestone comparison',url:'https://billiongraves.com/grave/אהרון-קהא/20705567'}]},
  {id:'kehat-zechariah',researchNotes:'בנו של סעדיה (ג׳ימעאן). הוא נפרד מזכריה בן צדוק, שבענף השני. השם נמסר בתרשים המוקדם ונזכר גם בין בני ג׳ימעאן בתעתיק המכתב מ־1944; פרטי צאצאיו טרם אומתו.'},
  {id:'kehat-shula',aliases:['שרה עפג׳ין','שרה קהא','שולה קהא']},
  {id:'kehat-tzion',birthYear:1936,researchNotes:'בנם של סעדיה ומרים, בעלה של ברכה ואביהם של אורן, טלי וליהי. אלדד אישר את הזיהוי עם הודעת שינוי השם: ציון כהה נעשה ציון קהת בדצמבר 1958; פורסם בילקוט הפרסומים 682, עמ׳ 1487, ב־29.6.1959. שנת 1936 מופיעה בתיעוד הקבורה; יום וחודש הלידה אינם ידועים.',researchSources:[{label:'הודעת שינוי השם · ילקוט 682, עמ׳ 1487',labelEn:'Name-change notice · Gazette 682, page 1487',url:'http://ivrut.onweb.com/result.php?word=%D7%A7%D7%94%D7%AA#page=11'}]},
  {id:'kehat-hadassah',researchNotes:'בתם של סעדיה ומרים, המוכרת במשפחה גם כהדוס. בתגובה מ־14.7.2015 תוארה כחברת ילדות ובת כיתה בתיכון בשם ״הדוס קהא״. זוהי עדות זיכרון מאוחרת, ולא הוכחה לשם הרשמי ביום נישואיה.',researchSources:[{label:'עדות חברת ילדות · ״הדוס קהא״',labelEn:'Childhood recollection · “Hados Keha”',url:'https://www.be106.net/233/9257'}]},
  {id:'kehat-zechariah-ben-tzadok',aliases:['זכריה בן צדוק קהתי'],researchNotes:'בנו של צדוק מהדור המבוגר. אמנה היא אם צדוק ונעמי בתעודות נישואיהם מ־1944 ומ־1946. ציונה, אשתו השנייה, היא אמם של יהודית, שורי ומרדכי לפי התיקון המשפחתי; היא נרשמה גם כאם יהודית בתעודת נישואיה מ־1947. אין לזהותו עם זכריה בן סעדיה. נישואי בתו יהודית ליעקב בן סעדיה מחברים בין שני הענפים, אך אינם מוכיחים שאהרון וצדוק הסבים היו אחים.'},
];
const p=(id,name,englishName,gender,unit,details={})=>({id,name,englishName,nameEn:englishName,gender,unit,...details});
KEHAT_RESEARCH_PEOPLE.push(
  p('kehat-aharon-saida','סעידה מחדון קהא','Saida Madhun Keha','f','u-kehat-aharon',{aliases:['סעידה מחדון'],researchNotes:'בת זוגו של אהרון בן סעדיה לפי התרשים. במצבה המועמדת מופיעה סעידה בת יוסף ונכלה מחדון.'}),
  p('kehat-amna','אמנה קהא','Amna Keha','f','u-kehat-zechariah-ben-tzadok',{deceased:true,researchNotes:'אמם של צדוק ונעמי מנישואיו הראשונים של זכריה בן צדוק. בתעודת נישואי צדוק H57320 מ־7.1.1944 נרשמה אמנה ז״ל. בתעודת נעמי H77495 מ־21.6.1946 מופיעים שוב ההורים זכריה ואמנה. שיוכה הקודם כאם יהודית תוקן לפי אישור אלדד: אמה של יהודית היא ציונה. שם משפחתה של אמנה לפני הנישואין אינו ידוע.'}),
  p('kehat-tziona','ציונה קהא','Tziona Keha','f','u-kehat-zechariah-ben-tzadok',{aliases:['ציניה קהא'],researchNotes:'אשתו השנייה של זכריה בן צדוק ואמם הביולוגית של יהודית, שורי ומרדכי, לפי התיקון שאישר אלדד. בתעודת נישואי יהודית H88579 מ־14.3.1947 נרשמה ציונה כאמה. במצבה המועמדת נכתב ציניה בת צדוק; אין להסיק שזה אותו צדוק שהיה אביו של זכריה.'}),
  p('kehat-tzadok','צדוק קהת','Tzadok Kehat','m','u-kehat-tzadok',{aliases:['צדוק קהא','צדוק קהתי'],birthYear:1917,birthYearSource:'פנקס תש״ב',birthYearSourceEn:'1941–1942 register',researchNotes:'בנם של זכריה בן צדוק ושל אמנה. אלדד אישר את זיהויו עם שורה 3479 בפנקס תש״ב: צדוק קהא, אב זכריה, יליד 1917, שערים, דף מודפס 58, עמ׳ PDF 300. בתעודת H57320 נישא לשמחה מגילה ב־7.1.1944; שם החתן קהתי, אביו זכריה בן צדוק קהתי ואמו אמנה ז״ל. בתעודה גילו 28, המרמז על 1915–1916; פער זה נשמר לצד שנת הפנקס. ראובן ושמעון הם בניו לפי התרשים. רון נמסר כנכדו וגור כנינו; עדיין לא הוכרע מי משני הבנים הוא אביו של רון.'}),
  p('kehat-simha-magila','שמחה מגילה קהתי','Simha Magila Kehati','f','u-kehat-tzadok',{aliases:['שמחה מגילה'],researchNotes:'נישאה לצדוק קהתי ב־7.1.1944, לפי תעודת H57320. בתעודה בת 27, תושבת ירושלים; אביה ראובן מגילה ז״ל. שם אמה לא מולא. אימהותה לילדי צדוק טרם תועדה בנפרד.'}),
  p('kehat-yaakov-ben-zechariah','יעקב קהא','Yaakov Keha','m','u-kehat-yaakov-ben-zechariah',{aliases:['יעקב בן זכריה קהא','יעקב קהת'],researchNotes:'בנם של זכריה בן צדוק ואמנה, ואחיהם של צדוק ונעמי מנישואיו הראשונים של זכריה, לפי העדות המשפחתית. נשוי למרים זרחי. לא היו לו ילדים ביולוגיים; תחיה היא בתה של מרים מנישואים קודמים ובתו החורגת. הוא אדם נפרד מיעקב בן סעדיה ושושנה, בעלה של יהודית.'}),
  p('kehat-miriam-zarhi','מרים זרחי','Miriam Zarhi','f','u-kehat-yaakov-ben-zechariah',{researchNotes:'אשתו של יעקב בן זכריה בן צדוק קהא, ואמה של תחיה מנישואים קודמים, לפי העדות המשפחתית. אין שיוך של תחיה כבתו הביולוגית של יעקב.'}),
  p('kehat-tehiya','תחיה','Tehiya','f','u-kehat-tehiya',{researchNotes:'בתה של מרים זרחי מנישואים קודמים ובתו החורגת של יעקב בן זכריה בן צדוק קהא, לפי העדות המשפחתית. שם אביה הביולוגי ושם משפחתה טרם נמסרו.'}),
  p('kehat-naomi','נעמי מזרחי','Naomi Mizrahi','f','u-kehat-naomi',{aliases:['נעמי קהא'],researchNotes:'בתם של זכריה ואמנה לפי תעודת H77495. נישאה לישראל מזרחי ב־21.6.1946 בשעריים, בגיל 30. היא נפרדת מנעמי בת מסעוד ורומה שנישאה לזכריה גמליאל ב־1944.'}),
  p('kehat-israel-mizrahi','ישראל מזרחי','Israel Mizrahi','m','u-kehat-naomi',{researchNotes:'נישא לנעמי קהא ב־21.6.1946, לפי תעודת H77495. בן 48 בעת הנישואין; הוריו עובדיה מזרחי וחמאמה.'}),
  p('kehat-shori','שורי קהת','Shori Kehat','f','u-kehat-shori',{aliases:['שורי קהת','שורי','סורי'],researchNotes:'בתם של זכריה בן צדוק וציונה ואחותם של יהודית ומרדכי, לפי התיקון המשפחתי. לא נישאה. יהודית היא אמה של גילה, ולכן שורי היא דודתה של גילה מצד אמה.'}),
  p('kehat-mordechai','מרדכי קהא','Mordechai Keha','m','u-kehat-varda',{researchNotes:'בנם של זכריה בן צדוק וציונה ואחיהן של יהודית ושורי, לפי אישור אלדד. נשוי לדבורה; ילדיהם מירב, שרון, עדי וטל.'}),
  p('kehat-varda','דבורה קהא','Dvora Keha','f','u-kehat-varda',{aliases:['ורדה קהת'],researchNotes:'אשתו של מרדכי קהא ואמם של מירב, שרון, עדי וטל, לפי העדות המשפחתית. בתרשים הקודם נרשמה בשם ורדה; שיוכה כבתם של זכריה וציונה תוקן.'}),
  p('kehat-yaakov-yehudit','יהודית קהא קהת','Yehudit Keha Kehat','f','u-kehat-zechariah-yehudit',{aliases:['יהודית קהא','יהודית קהת'],researchNotes:'בתם של זכריה בן צדוק קהא וציונה, ואחותם של שורי ומרדכי, לפי התיקון שאישר אלדד. ציונה היא אמה הביולוגית, כפי שנרשם בתעודת נישואיה H88579. נישאה ליעקב קהת בן סעדיה ושושנה ב־14.3.1947. חבצלת, אורי וגילה הם ילדיהם לפי העדות המשפחתית.',researchSources:[{label:'תעודת הנישואין · H88579 · עמ׳ 72',labelEn:'Marriage certificate · H88579 · page 72',url:weddingFile}]}),
  ...[['reuven','ראובן','Reuven','m'],['shimon','שמעון','Shimon','m'],['ron','רון','Ron','m'],['gur','גור קהתי','Gur Kehati','m'],['havazelet','חבצלת קהת','Havazelet Kehat','f'],['ari','אורי קהת','Uri Kehat','m'],['gila','גילה קהת','Gila Kehat','f'],['merav','מירב','Merav','f'],['sharon-varda','שרון','Sharon',''],['adi-varda','עדי','Adi',''],['tal-varda','טל','Tal','']].map(([key,name,en,gender])=>p('kehat-'+key,name,en,gender,'u-kehat-'+key,key==='merav'?{aliases:['מרב']}:key==='tal-varda'?{deceased:true}:key==='gila'?{aliases:['גילי קהת','גילי']}:{})),
);
for(const id of ['kehat-tzadok','kehat-simha-magila','kehat-amna']){
  const person=KEHAT_RESEARCH_PEOPLE.find(p=>p.id===id);person.researchSources=[{label:'תעודת צדוק ושמחה · 7.1.1944 · H57320 · עמ׳ 81',labelEn:'Tzadok and Simha’s marriage · 7 January 1944 · H57320 · page 81',url:tzadokFile}];
}
for(const id of ['kehat-naomi','kehat-israel-mizrahi','kehat-amna','kehat-zechariah-ben-tzadok']){
  const person=KEHAT_RESEARCH_PEOPLE.find(p=>p.id===id);person.researchSources=[...(person.researchSources||[]),{label:'תעודת נעמי וישראל · 21.6.1946 · H77495 · עמ׳ 153',labelEn:'Naomi and Israel’s marriage · 21 June 1946 · H77495 · page 153',url:naomiFile}];
}
// Exact deaths are entered only for confirmed identities. Ages in certificates
// produce year ranges; possible gravestones remain separate research records.
const lifeEvidence={
  'kehat-hadassah':{birthYear:1941,birthYearSource:'מצבה',birthYearSourceEn:'Gravestone',deceased:true,deathDate:'12.7.2015'},
  'kehat-tzion':{birthYear:1936,birthYearSource:'מצבה',birthYearSourceEn:'Gravestone',deceased:true,deathDate:'3.8.2015'},
  'kehat-yaakov':{birthYearMin:1921,birthYearMax:1922,birthYearSource:'לפי גיל 25 בנישואי 1947',birthYearSourceEn:'From age 25 at the 1947 wedding'},
  'kehat-yaakov-yehudit':{birthYearMin:1923,birthYearMax:1924,birthYearSource:'לפי גיל 23 בנישואי 1947',birthYearSourceEn:'From age 23 at the 1947 wedding'},
  'kehat-simha-magila':{birthYearMin:1916,birthYearMax:1917,birthYearSource:'לפי גיל 27 בנישואי 1944',birthYearSourceEn:'From age 27 at the 1944 wedding'},
  'kehat-naomi':{birthYearMin:1915,birthYearMax:1916,birthYearSource:'לפי גיל 30 בנישואי 1946',birthYearSourceEn:'From age 30 at the 1946 wedding',lifeRecords:[{birthYearMin:1909,birthYearMax:1910,deathDate:'7.9.1982',ageAtDeath:72,note:'מצבת נעמי מזרחי בת זכריה, לצד ישראל בן עובדיה. שנת הלידה המשוערת שונה מן הגיל בתעודת 1946 ומרישום 1912 בפנקס; נדרש בירור.',url:'https://billiongraves.com/grave/נעמי-מזרחי/21003416'}]},
  'kehat-israel-mizrahi':{birthYearMin:1897,birthYearMax:1898,birthYearSource:'לפי גיל 48 בנישואי 1946',birthYearSourceEn:'From age 48 at the 1946 wedding',lifeRecords:[{birthYearMin:1895,birthYearMax:1896,deathDate:'10.4.1990',ageAtDeath:94,note:'מצבת ישראל מזרחי בן עובדיה, לצד נעמי בת זכריה. קיימת סטייה בין הגיל בתעודת הנישואין לבין הגיל במצבה.',url:'https://billiongraves.com/grave/ישראל-מזרחי/21003417'}]},
  'kehat-amna':{deathBefore:'7.1.1944'},
  'kehat-jidaan':{lifeRecords:[{birthYearMin:1876,birthYearMax:1877,deathDate:'9.12.1962',ageAtDeath:85,note:'סעדיה קהא טירי בן אהרון. זו מצבה מועמדת לזיהוי ג׳ימעאן; ברישום תש״ב המקביל מופיעה שנת 1870.',url:'https://billiongraves.com/grave/סעדיה-קהא-טירי/21004018'}]},
  'kehat-aharon':{lifeRecords:[{birthYearMin:1904,birthYearMax:1905,deathYear:1977,deathHebrew:'ב׳ בכסלו תשל״ח',ageAtDeath:72,note:'אהרון בן סעדיה, לצד סעידה בת יוסף ונכלה מחדון. התאמה תומכת לרישומי 1905 ו־1906; זהות המצבה עדיין בבירור.',url:'https://billiongraves.com/grave/אהרון-קהא/20705567'}]},
  'kehat-zechariah-ben-tzadok':{lifeRecords:[{birthYearMin:1891,birthYearMax:1892,deathDate:'10.6.1947',ageAtDeath:55,note:'מצבת זכריה קהא בן צדוק. אין לזהותה עם רשומת יליד 1914 בפנקס: פער הגילים מהותי.',url:'https://billiongraves.com/grave/זכריה-קהא/20995690'}]},
  'kehat-tziona':{lifeRecords:[{birthYearMin:1903,birthYearMax:1904,deathDate:'20.5.1994',ageAtDeath:90,note:'מצבת ציניה קהא בת צדוק. התאמת ציניה לציונה שבתעודת הנישואין עוד טעונה אישור.',url:'https://billiongraves.com/grave/ציניה-קהא/20995691'}]},
};
for(const person of KEHAT_RESEARCH_PEOPLE)if(lifeEvidence[person.id])Object.assign(person,lifeEvidence[person.id]);
for(const [id,url] of [['kehat-hadassah','https://billiongraves.com/grave/הדסה-אנגלסברג-קהת/20993719'],['kehat-tzion','https://billiongraves.com/grave/ציון-קהת/20997010']]){
  const person=KEHAT_RESEARCH_PEOPLE.find(p=>p.id===id);
  person.researchSources=[...(person.researchSources||[]),{label:'מצבה · שנות חיים ותאריך פטירה',labelEn:'Gravestone · life years and death date',url}];
}
export function applyKehatResearchUnits(units){
  const set=(id,people,children=[],parent=null,details={})=>units[id]={id,people,children,parent,relationship:people.length>1?'spouse':'single',...details};
  set('u-kehat-aharon',['kehat-aharon','kehat-aharon-saida'],[],'u-keha-kehat');
  set('u-kehat-unresolved-miriam',['kehat-yaakov-miriam']);
  const coupleKids=['havazelet','ari','gila'].map(k=>'u-kehat-'+k);
  // The same canonical couple is reached from each spouse's own parents.
  // Each view begins with its descendant; profiles, albums and IDs stay shared.
  set('u-kehat-yaakov',['kehat-yaakov','kehat-yaakov-yehudit'],coupleKids,'u-keha-kehat',{weddingDate:'14.3.1947',weddingYear:1947});
  set('u-kehat-zechariah-yehudit',['kehat-yaakov-yehudit','kehat-yaakov'],coupleKids,'u-kehat-zechariah-ben-tzadok',{mirrorOf:'u-kehat-yaakov',weddingDate:'14.3.1947',weddingYear:1947});
  for(const id of coupleKids)set(id,[id.slice(2)],[],'u-kehat-yaakov');
  const amnaKids=['u-kehat-tzadok','u-kehat-yaakov-ben-zechariah','u-kehat-naomi'],tzionaKids=['u-kehat-zechariah-yehudit','u-kehat-shori','u-kehat-varda'];
  set('u-kehat-zechariah-ben-tzadok',['kehat-zechariah-ben-tzadok','kehat-amna','kehat-tziona'],[...amnaKids,...tzionaKids],'u-kehat-tzadok-elder',{splitPartnerships:true,displayPeople:['kehat-amna','kehat-zechariah-ben-tzadok','kehat-tziona'],relationships:[
    {people:['kehat-zechariah-ben-tzadok','kehat-amna'],children:amnaKids,relationship:'spouse',label:'נישואין ראשונים',labelEn:'First marriage'},
    {people:['kehat-zechariah-ben-tzadok','kehat-tziona'],children:tzionaKids,relationship:'spouse',label:'נישואין שניים',labelEn:'Second marriage'},
  ]});
  // Tehiya belongs to Miriam's earlier marriage; the connection starts only
  // at her mother and does not give Yaakov a biological child.
  set('u-kehat-yaakov-ben-zechariah',['kehat-yaakov-ben-zechariah','kehat-miriam-zarhi'],['u-kehat-tehiya'],'u-kehat-zechariah-ben-tzadok',{relationships:[
    {people:['kehat-yaakov-ben-zechariah','kehat-miriam-zarhi'],children:[],relationship:'spouse'},
    {people:['kehat-miriam-zarhi'],children:['u-kehat-tehiya'],relationship:'parent',label:'בתה של מרים מנישואים קודמים',labelEn:'Miriam’s daughter from a previous marriage'},
  ]});
  set('u-kehat-tehiya',['kehat-tehiya'],[],'u-kehat-yaakov-ben-zechariah');
  set('u-kehat-naomi',['kehat-naomi','kehat-israel-mizrahi'],[],'u-kehat-zechariah-ben-tzadok',{weddingDate:'21.6.1946',weddingYear:1946});
  set('u-kehat-shori',['kehat-shori'],[],'u-kehat-zechariah-ben-tzadok');
  const vardaKids=['merav','sharon-varda','adi-varda','tal-varda'].map(k=>'u-kehat-'+k);
  // Retain the existing unit and Dvora's profile IDs, including media tags.
  // Mordechai is the descendant; Dvora is his wife, not a fourth sibling.
  set('u-kehat-varda',['kehat-mordechai','kehat-varda'],vardaKids,'u-kehat-zechariah-ben-tzadok');
  for(const id of vardaKids)set(id,[id.slice(2)],[],'u-kehat-varda');
  const sons=['u-kehat-reuven','u-kehat-shimon'];
  set('u-kehat-tzadok',['kehat-tzadok','kehat-simha-magila'],[...sons,'u-kehat-ron'],'u-kehat-zechariah-ben-tzadok',{weddingDate:'7.1.1944',weddingYear:1944,relationships:[
    {people:['kehat-tzadok','kehat-simha-magila'],children:[],relationship:'spouse',label:'נישאו ב־7.1.1944',labelEn:'Married 7 January 1944'},
    {people:['kehat-tzadok'],children:sons,relationship:'parent',label:'',labelEn:''},
    {people:['kehat-tzadok'],children:['u-kehat-ron'],relationship:'grandparent',label:'נכד · האב בבירור',labelEn:'Grandson · father under research'},
  ]});
  for(const id of sons)set(id,[id.slice(2)],[],'u-kehat-tzadok');
  set('u-kehat-ron',['kehat-ron'],['u-kehat-gur'],'u-kehat-tzadok',{parentage:'grandchild'});
  set('u-kehat-gur',['kehat-gur'],[],'u-kehat-ron');
}
