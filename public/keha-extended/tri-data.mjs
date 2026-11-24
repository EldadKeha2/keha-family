// The owner confirmed Zechariah, son of Saadia (Jimaan), son of Aharon.
// The 1954 questionnaire names both parents and ten children; Yissachar is separate.
const grave=id=>'https://billiongraves.com/grave/'+id;
const land='https://apps.land.gov.il/IturTabotData/nispachim/merkaz/4023136/20.pdf';
const source=(label,labelEn,url)=>({label,labelEn,url});
const triple=source('מצבת זכריה בן סעדיה, יונה חממה ומנחם · זיהוי בבירור','Zechariah, Yona Hamama and Menachem · candidate gravestone',grave('זכריה-קהא-טרי/21007123'));
export const TRI_ARCHIVE_SOURCE=source('ארכיון המדינה · ג־405/156 · שאלון פרס ילודה, עמ׳ 9','Israel State Archives · G-405/156 · childbirth-prize questionnaire, page 9','https://www.archives.gov.il/details/002jxqv');
export const TRI_BIRTH_YEARS=Object.freeze({'tri-menachem':1932,'tri-esther':1934,'keha-yosef-yissachar':1937,'tri-binyamin':1941,'tri-yissachar':1943,'tri-rachel':1945,'tri-ronit':1947,'tri-david':1949,'tri-miriam':1952,'tri-hana':1954});
export const TRI_SIBLINGS=Object.freeze(Object.keys(TRI_BIRTH_YEARS));
const unitId=id=>id==='keha-yosef-yissachar'?'u-tri-yosef':'u-'+id;
const person=(id,name,englishName,gender,details={})=>({id,name,englishName,nameEn:englishName,gender,unit:unitId(id),triFamily:true,...details});
const siblingNote='אחד מעשרת ילדיהם של זכריה ויונה קהא טירי, לפי שאלון פרס הילודה מ־1954 (ארכיון המדינה, ג־405/156, עמ׳ 9) והצלבת עדות אורה. אלדד זיהה את האב כזכריה בן סעדיה בן אהרון, מנישואיו הראשונים של סעדיה.';
const sister=(id,name,en,candidate)=>person(id,name,en,'f',{
  researchNotes:'בתם של זכריה ויונה קהא טירי, ואחת מחמש האחיות בעדות אורה. שמה ושנת לידתה מופיעים בשאלון פרס הילודה מ־1954. בטבלת הקרקע הרשמית מופיע השם ״'+candidate+'״ כמועמדת לזיהוי שם הנישואים; השם המאוחר עדיין להשוואה.',
  researchSources:[source('טבלת הקצאה ואיזון · עמ׳ 15–16 · התאמה לבדיקה','Official land register · pages 15–16 · candidate match',land)],
});
// Each row is one household from the family's chart. The archival order of
// the ten siblings is independent of the order of their children's rows.
const households = [
  {sibling:'keha-yosef-yissachar', partner:['tri-yosef-rachel','רחל','Rachel','f'], children:[
    ['tri-sagit','שגית','Sagit','f'], ['tri-yosef-avi','אבי','Avi','m'],
    ['tri-oded','עודד','Oded','m'], ['tri-elad','אלעד','Elad','m'],
  ]},
  {sibling:'tri-yissachar', partner:['tri-yissachar-yehudit','יהודית טרי','Yehudit Tri','f'], children:[
    ['tri-revital','רויטל','Revital','f'], ['tri-saadia-adi','סעדיה (עדי)','Saadia (Adi)','m',{aliases:['עדי','סעדיה']}],
    ['tri-arik','אריק','Arik','m'], ['tri-aviv','אביב','Aviv'],
  ]},
  {sibling:'tri-binyamin', partner:['tri-shifra'], children:[
    ['tri-sigalit','סיגלית','Sigalit','f'], ['tri-hezi'], ['tri-shahar','שחר','Shahar'],
  ]},
  {sibling:'tri-david', children:[
    ['tri-david-daughter','בתו של דוד (השם טרם נמסר)','David’s daughter (name unknown)','f'],
    ['tri-david-zaki','זכי','Zaki','m'], ['tri-david-yossi','יוסי','Yossi','m'],
  ]},
  {sibling:'tri-rachel', partner:['tri-rachel-avi','אבי','Avi','m'], children:[
    ['tri-barak','ברק','Barak','m',{deceased:true}], ['tri-lahav','להב','Lahav','',{deceased:true}],
    ['tri-guy','גיא','Guy'],
  ]},
  {sibling:'tri-ronit', partner:['tri-avraham-yaakobi','אברהם יעקובי','Avraham Yaakobi','m'], children:[
    ['tri-eran','ערן','Eran','m'], ['tri-iris','איריס','Iris','f'],
    ['tri-ido','עידו','Ido','m'], ['tri-reut','רעות','Reut','f'],
  ]},
  {sibling:'tri-miriam', partner:['tri-roni-peretz','רוני פרץ','Roni Peretz','m'], children:[
    ['tri-aner','ענר','Aner'], ['tri-anat','ענת','Anat','f'], ['tri-inbar','ענבר','Inbar','f'],
  ]},
  {sibling:'tri-esther', partner:['tri-moshe-dahari','משה דהרי','Moshe Dahari','m',{deceased:true}], children:[
    ['tri-orly','אורלי','Orly','f'], ['tri-oren','אורן','Oren'], ['tri-ilan','אילן','Ilan','m'], ['tri-ilanit','אילנית','Ilanit','f'],
  ]},
  {sibling:'tri-hana', partner:['tri-hanania','חנניה','Hanania','m'], children:[
    ['tri-liat','ליאת','Liat','f'], ['tri-ofir','אופיר','Ofir','m'],
  ]},
  {sibling:'tri-hana', partner:['tri-shuki','שוקי','Shuki','m'], children:[
    ['tri-moran','מורן','Moran','f'], ['tri-dor','דור','Dor','m'], ['tri-yaniv','יניב','Yaniv','m'],
    ['tri-lior','ליאור','Lior'], ['tri-hana-adi','עדי','Adi'],
  ]},
];

const householdPeople = [];
for (const {sibling, partner, children} of households) {
  // Shifra and Hezi already have profiles with portraits and source records.
  if (partner?.length > 1) {
    const [id, name, english, gender, details] = partner;
    householdPeople.push(person(id, name, english, gender, {...details, unit:unitId(sibling)}));
  }
  for (const [id, name, english, gender='', details] of children) {
    if (name) householdPeople.push(person(id, name, english, gender, details));
  }
}

export const TRI_RESEARCH_PEOPLE=Object.freeze([
  person('tri-yona','יונה קהא טירי','Yona Keha Tiri','f',{unit:'u-kehat-zechariah',aliases:['יונה טירי קהא','יונה טרי','יונה טורי','יונה קהא'],birthYear:1912,aliyahYear:1933,archiveBirthEvidence:true,birthYearSource:'שאלון פרס ילודה, 1954',birthYearSourceEn:'1954 childbirth-prize questionnaire',researchNotes:'אשתו של זכריה קהא טירי בן סעדיה, לפי זיהוי אלדד. זו יונה נוספת, נפרדת מיונה נקאש קהא אשת שלמה. בשאלון פרס הילודה מ־1954 נרשמה כילידת 1912, תימן, שעלתה ב־1933; עקרת בית משעריים, רחוב רבי עקיבא 38. השאלון מונה את עשרת ילדיה. בקשה לפרס נשלחה ב־12.11.1954, אושרה קבלתה ב־25.11.1954, ובתיק קבלה על 100 לירות מ־19.7.1955. הזיהוי עם יונה חממה במצבה המשולשת נשמר להשוואה: הגיל שם אינו תואם במדויק את שנת 1912 שבשאלון.',researchSources:[TRI_ARCHIVE_SOURCE,triple]}),
  person('tri-menachem','מנחם טרי','Menachem Tri','m',{aliases:['מנחם','מנחם קהא טרי'],deceased:true,maritalStatus:'unmarried',researchNotes:siblingNote+' לפי אורה היה הבכור ולא נישא. מצבת מנחם קהא טרי בן זכריה היא מועמדת בלבד: גילו הרשום 72 בפטירתו בתשמ״ה אינו מתיישב עם גיל 77 של זכריה בן סעדיה בפטירתו ב־1979 ועם גיל 75 של יונה חממה בתשמ״ה. ייתכן גיל שגוי או זיהוי אחר של מנחם או אביו; אין להסיק מכאן תאריכי לידה או הורות.',researchSources:[triple]}),
  person('tri-binyamin','בנימין קהתי','Binyamin Kehati','m',{deceased:true,recordedParents:{father:'זכריה',mother:'חממה'},burialDate:'2.4.2014',researchNotes:siblingNote+' לפי אורה בנימין היה נשוי לשפרה, אמו של חזי הספר. ברישום חברה קדישא רחובות: בנימין קהתי בן זכריה וחממה, נקבר ב־2.4.2014 בגיל 73, בית העלמין מזרח, חלקה ס, שורה א, מקום 33. תאריך זה הוא תאריך קבורה. שפרה קהתי במקום 34 הסמוך; הסמיכות תומכת בעדות המשפחתית, ואינה תעודת נישואים. המשפחה אישרה את ילדיהם של בנימין ושפרה: סיגלית, חזי ושחר.',researchSources:[source('חברה קדישא רחובות · בנימין בן זכריה וחממה','Rehovot burial record · Binyamin, son of Zechariah and Hamama','https://kdr.org.il/deceased/קהתי-בנימין/'),source('חברה קדישא רחובות · שפרה קהתי','Rehovot burial record · Shifra Kehati','https://kdr.org.il/deceased/קהתי-שפרה/')]}),
  person('tri-yissachar','יששכר טרי','Yissachar Tri','m',{deceased:true,deathDate:'13.4.1996',recordedParents:{father:'זכריה'},researchNotes:siblingNote+' במצבת יששכר טרי נכתב בן זכריה, נפטר בכ״ד בניסן תשנ״ו (13.4.1996), בן 52. זהו אדם נפרד מיוסף טרי (קהא); מצבתו ותאריך פטירתו שונים. התאמת המצבה לאח שבעדות נשענת על הצטלבות השם, המשפחה ושם האב.',researchSources:[source('מצבת יששכר טרי בן זכריה · 13.4.1996','Yissachar Tri, son of Zechariah · gravestone, 13 April 1996',grave('יששכר-טרי/20992894'))]}),
  person('tri-david','דוד טרי','David Tri','m',{aliases:['דוד'],deceased:true,researchNotes:siblingNote+' גליה מספרת שדוד עזר ליוסי בכרם. השם ״טורי דוד״ מופיע בטבלת הקרקע כמועמד להשוואה; אין עדיין מצבה או עוגן הורות מאומת. אין לזהותו עם דוד קהא בן דוד שנקבר ב־1942, או עם דוד טריירל בן פישל ופרומה.',researchSources:[source('טבלת הקרקע · טורי דוד · התאמה לבדיקה','Land register · David Tori · candidate match',land)]}),
  // Keep the original profile ID, including any portraits, edits and media.
  person('keha-yosef-yissachar','יוסף טרי (קהא)','Yosef Tri (Keha)','m',{deceased:true,deathDate:'15.7.1985',aliases:['יוסי טרי','יוסף קהא','יוסף טירי'],recordedParents:{father:'זכריה'},researchNotes:siblingNote+' לפי אורה וגליה יוסף, המכונה יוסי, נהרג בהתהפכות טרקטור; גליה מזכירה כרם ענבים. במצבת יוסף נכתב במפורש ״טרי (קהא)״, בן זכריה, כ״ו בתמוז תשמ״ה (15.7.1985), בן 47. אשכול הענבים במצבה מתאים לסיפור הכרם אך אינו מוכיח את התאונה. יוסף ויששכר הם שני אחים נפרדים; הכינוי ״יוסף יששכר״ ברישום המוקדם שילב שני אחים שונים.',researchSources:[source('מצבת יוסף טרי (קהא) בן זכריה · 15.7.1985','Yosef Tri (Keha), son of Zechariah · gravestone, 15 July 1985',grave('יוסף-טרי/20994129'))]}),
  person('tri-esther','אסתר טרי (דהרי)','Esther Tri (Dahari)','f',{aliases:['אסתר','אסתר טרי','אסתר דהרי','דהרי אסתר'],researchNotes:'המשפחה אישרה את שמה ואת נישואיה למשה דהרי.'}),
  sister('tri-rachel','רחל טרי','Rachel Tri','נוני רחל'),
  person('tri-ronit','רונית טרי (יעקובי)','Ronit Tri (Yaakobi)','f',{aliases:['רונית','רונית טרי','רונית יעקובי']}),
  person('tri-miriam','מרים טרי (פרץ)','Miriam Tri (Peretz)','f',{aliases:['מרים','מירי','מרים קהא','מרים טרי','מרים פרץ','מירי פרץ','פרץ מרים'],researchNotes:'המשפחה אישרה את שמה ואת נישואיה לרוני פרץ. בטבלה המשפחתית היא מופיעה גם בשם מירי.'}),
  sister('tri-hana','חנה טרי','Hana Tri','ביסטריצר בוצר חנה'),
  person('tri-shifra','שפרה קהתי','Shifra Kehati','f',{unit:'u-tri-binyamin',deceased:true,recordedParents:{father:'יחזקאל',mother:'טפחה'},burialDate:'7.12.2015',researchNotes:'לפי אורה, שפרה הייתה נשואה לבנימין והיא אמו של חזי הספר. ברישום חברה קדישא רחובות: שפרה קהתי בת יחזקאל וטפחה, נקברה ב־7.12.2015 בגיל 69, בית העלמין מזרח, חלקה ס, שורה א, מקום 34; לצד בנימין במקום 33. זהו תאריך קבורה. הקשר לחזי נסמך על העדות המשפחתית.',researchSources:[source('חברה קדישא רחובות · שפרה קהתי','Rehovot burial record · Shifra Kehati','https://kdr.org.il/deceased/קהתי-שפרה/')]}),
  person('tri-hezi','חזי קהתי','Hezi Kehati','m',{occupation:'ספר',aliases:['חזי','חזי הספר'],researchNotes:'לפי אורה הוא בנה של שפרה, שהייתה נשואה לבנימין. נמצא רישום ציבורי של חזי קהתי כמעצב שיער, המתאים לרמז המקצועי. המשפחה זיהתה אותו כבנם של בנימין ושפרה, בין סיגלית לשחר לפי סדר הלידה.',researchSources:[source('חזי קהתי · מעצב שיער · הצלבת העיסוק','Hezi Kehati · hairdresser · occupation match','https://www.d.co.il/19325400/30540/')]}),
  ...householdPeople,
  {id:'kehat-zechariah',triFamily:true,researchNotes:'בנו של סעדיה (ג׳ימעאן), ונפרד מזכריה בן צדוק שבענף השני. השם נמסר בתרשים המוקדם ונזכר בין בני ג׳ימעאן בתעתיק המכתב מ־1944. זכריה קהא טרי בן סעדיה, שבמצבה המשולשת, הוא מועמד לחיבור ענף עשרת האחים מעדות אורה: יוסף, יששכר ובנימין מופיעים במקורות עם אב בשם זכריה; אצל בנימין נרשמה גם האם חממה. הזיהוי המדויק ושיוך כל העשרה אליו עדיין בבירור, ובפרט סתירת גילו של מנחם. עשרת האחים מוצגים בקבוצה נפרדת עד להשלמת ההורות.',researchSources:[triple,source('ענף טרי · עשרת האחים · ההורות בבירור','Tri family · ten siblings · parentage under research','https://family-extended.eldadkeha.workers.dev/keha-extended/#tree/yissachar')]},
].map(p=>{
  if(p.id==='kehat-zechariah')p={...p,name:'זכריה קהא טירי',englishName:'Zechariah Keha Tiri',nameEn:'Zechariah Keha Tiri',unit:'u-kehat-zechariah',aliases:['זכריה טרי','זכריה טירי','זכריה בן סעדיה בן אהרון','זכריה קהת','זכריה קהא טרי','זכריה טירי קהא','זכריה טורי קהא'],birthYear:1902,aliyahYear:1933,occupation:'חקלאי',archiveBirthEvidence:true,birthYearSource:'שאלון פרס ילודה, 1954',birthYearSourceEn:'1954 childbirth-prize questionnaire',researchNotes:'בנו של סעדיה (ג׳ימעאן) בן אהרון ואשתו הראשונה שושנה, לפי זיהוי אלדד והתרשים המשפחתי. נפרד מזכריה בן צדוק ומזכריה קהא הבן שבענף המקביל. בשאלון פרס הילודה מ־1954 נרשם לצד אשתו יונה קהא טירי ועשרת ילדיהם: יליד 1902, תימן, חקלאי, שנת עלייה 1933, שעריים, רחוב רבי עקיבא 38. התיק מאשר את חיבור עשרת האחים מעדות אורה לענף זה. שנת 1932 של מנחם בשאלון סותרת את הגיל 72 שיוחס לו בקריאת המצבה המועמדת; אין לחשב את לידתו מחדש מהגיל במצבה.',researchSources:[TRI_ARCHIVE_SOURCE,triple]};
  if(TRI_BIRTH_YEARS[p.id]){
    const notes={
      'tri-menachem':'בשאלון נרשם יליד 1932, תימן — עדן, חקלאי ורווק. לפי אורה היה הבכור ולא נישא. שנת 1932 אינה מתיישבת עם גיל 72 בקריאה הקודמת של מצבת מנחם; גיל האב 77 ב־1979 ופרטי המצבה נשמרים כמקור נפרד לבירור.',
      'keha-yosef-yissachar':'בשאלון נרשמה שנת 1937. לפי אורה וגליה, יוסי נהרג בהתהפכות טרקטור בכרם. במצבת יוסף טרי (קהא) בן זכריה: 15.7.1985, בן 47. הפער האפשרי בין הגיל במצבה לשנת השאלון נשמר במקורות. יוסף ויששכר הם שני אחים נפרדים; משפחת יששכר של יוסף וצביה היא ענף עצמאי ונפרד מהם.',
      'tri-binyamin':'בשאלון נרשמה שנת 1941. לפי אורה היה נשוי לשפרה. בחברה קדישא רחובות נרשם בן זכריה וחממה, קבורה ב־2.4.2014 בגיל 73. זהו תאריך הקבורה. המשפחה אישרה את ילדיהם של בנימין ושפרה: סיגלית, חזי ושחר.',
      'tri-yissachar':'בשאלון נרשמה שנת 1943. במצבת יששכר טרי בן זכריה: 13.4.1996, בן 52. יששכר נפרד מאחיו יוסף.',
      'tri-hana':'המשפחה מסרה שחנה נישאה תחילה לחנניה ולאחר מכן לשוקי. ליאת ואופיר נולדו מנישואיה לחנניה. מורן, דור, יניב, ליאור ועדי נולדו מנישואיה לשוקי.',
      'tri-david':'בשאלון נרשמה שנת 1949. לפי גליה עזר ליוסי בכרם. השם טורי דוד בטבלת הקרקע הוא מקור להשוואה, ולא מקור נוסף לשנת הלידה.',
      'tri-ronit':'בטבלת הילדים נרשם השם רינה ושנת 1947; בעדות אורה נקראה רונית. הפרופיל הקיים נשמר, ורינה נוספה כשם נוסף. המשפחה אישרה את השם רונית טרי (יעקובי) ואת נישואיה לאברהם יעקובי.',
    };
    p={...p,archiveBirthEvidence:true,birthYear:TRI_BIRTH_YEARS[p.id],birthYearSource:'שאלון פרס ילודה, 1954',birthYearSourceEn:'1954 childbirth-prize questionnaire',parents:['kehat-zechariah','tri-yona'],recordedParents:{father:'זכריה',mother:'יונה'},birthPlace:p.id==='tri-menachem'?'עדן, תימן':'שעריים, רחובות',researchNotes:siblingNote+' '+(notes[p.id]||p.researchNotes),researchSources:[TRI_ARCHIVE_SOURCE,...(p.researchSources||[])]};
    if(p.id==='tri-ronit')p.aliases=[...(p.aliases||[]),'רינה','רינה טירי','רינה קהא טירי'];
  }
  return Object.freeze(p.id==='tri-rachel'?{...p,deceased:true}:p);
}));

export function applyTriUnits(units){
  const children=TRI_SIBLINGS.map(unitId);
  const parents=['kehat-zechariah','tri-yona'];
  units['u-kehat-zechariah']={id:'u-kehat-zechariah',people:parents,children,parent:'u-keha-kehat',relationship:'spouse'};
  for(const id of TRI_SIBLINGS){const u=unitId(id);units[u]={id:u,people:[id],children:[],parent:'u-kehat-zechariah',relationship:'single'};}
  for (const {sibling, partner, children} of households) {
    const unit = units[unitId(sibling)];
    const childUnits = children.map(([id]) => unitId(id));
    for (const [id] of children) {
      const key = unitId(id);
      units[key] = {id:key, people:[id], children:[], parent:unit.id, relationship:'single'};
    }
    unit.children.push(...childUnits);
    if (!partner) continue;
    unit.relationship = 'spouse';
    unit.people.push(partner[0]);
    if (sibling === 'tri-hana') {
      const first = !unit.relationships;
      unit.relationships ??= [];
      unit.relationships.push({
        people:[sibling,partner[0]], children:childUnits, relationship:'spouse',
        label:first?'נישואים ראשונים':'נישואים שניים', labelEn:first?'First marriage':'Second marriage',
      });
      unit.splitPartnerships = true;
      unit.displayPeople = ['tri-hanania',sibling,'tri-shuki'];
    }
  }
}
