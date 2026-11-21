// Ora's family testimony identifies ten siblings, not one person named
// "Yosef Yissachar". Records name Zechariah as the father of three candidates;
// their identification with Zechariah son of Saadia remains under research.
const grave=id=>'https://billiongraves.com/grave/'+id;
const land='https://apps.land.gov.il/IturTabotData/nispachim/merkaz/4023136/20.pdf';
const source=(label,labelEn,url)=>({label,labelEn,url});
const triple=source('מצבת זכריה בן סעדיה, יונה חממה ומנחם · זיהוי בבירור','Zechariah, Yona Hamama and Menachem · candidate gravestone',grave('זכריה-קהא-טרי/21007123'));
export const TRI_SIBLINGS=Object.freeze(['tri-menachem','tri-binyamin','tri-yissachar','tri-david','keha-yosef-yissachar','tri-esther','tri-rachel','tri-ronit','tri-miriam','tri-hana']);
const unitId=id=>id==='keha-yosef-yissachar'?'u-tri-yosef':'u-'+id;
const person=(id,name,englishName,gender,details={})=>({id,name,englishName,nameEn:englishName,gender,unit:unitId(id),triFamily:true,...details});
const siblingNote='אחד מעשרת האחים והאחיות שמנתה אורה. שיוך קבוצת האחים לזכריה קהא טרי בן סעדיה והזיהוי של ההורים עדיין בבירור. סדר האחים בעץ אינו סדר לידה מאומת; מנחם נמסר כבכור.';
const sister=(id,name,en,candidate)=>person(id,name,en,'f',{
  researchNotes:'אחת מחמש האחיות בעדות אורה, לצד חמשת האחים. בטבלת הקרקע הרשמית מופיע השם ״'+candidate+'״ כמועמדת לזיהוי. שם המשפחה אינו מוצג כשם מאומת; שותפות בקרקע אינה הוכחת אחאות. ההורים עדיין בבירור.',
  researchSources:[source('טבלת הקצאה ואיזון · עמ׳ 15–16 · התאמה לבדיקה','Official land register · pages 15–16 · candidate match',land)],
});
export const TRI_RESEARCH_PEOPLE=Object.freeze([
  {id:'tri-siblings-group',name:'עשרת האחים',englishName:'Ten siblings',nameEn:'Ten siblings',gender:'',unit:'u-keha-yissachar',placeholder:true,structuralGroup:true,triFamily:true},
  person('tri-menachem','מנחם','Menachem','m',{deceased:true,maritalStatus:'unmarried',researchNotes:siblingNote+' לפי אורה היה הבכור ולא נישא. מצבת מנחם קהא טרי בן זכריה היא מועמדת בלבד: גילו הרשום 72 בפטירתו בתשמ״ה אינו מתיישב עם גיל 77 של זכריה בן סעדיה בפטירתו ב־1979 ועם גיל 75 של יונה חממה בתשמ״ה. ייתכן גיל שגוי או זיהוי אחר של מנחם או אביו; אין להסיק מכאן תאריכי לידה או הורות.',researchSources:[triple]}),
  person('tri-binyamin','בנימין קהתי','Binyamin Kehati','m',{deceased:true,recordedParents:{father:'זכריה',mother:'חממה'},burialDate:'2.4.2014',researchNotes:siblingNote+' לפי אורה בנימין היה נשוי לשפרה, אמו של חזי הספר. ברישום חברה קדישא רחובות: בנימין קהתי בן זכריה וחממה, נקבר ב־2.4.2014 בגיל 73, בית העלמין מזרח, חלקה ס, שורה א, מקום 33. תאריך זה הוא תאריך קבורה. שפרה קהתי במקום 34 הסמוך; הסמיכות תומכת בעדות המשפחתית, ואינה תעודת נישואים. אבהותו של בנימין לחזי לא אושרה בנפרד.',researchSources:[source('חברה קדישא רחובות · בנימין בן זכריה וחממה','Rehovot burial record · Binyamin, son of Zechariah and Hamama','https://kdr.org.il/deceased/קהתי-בנימין/'),source('חברה קדישא רחובות · שפרה קהתי','Rehovot burial record · Shifra Kehati','https://kdr.org.il/deceased/קהתי-שפרה/')]}),
  person('tri-yissachar','יששכר טרי','Yissachar Tri','m',{deceased:true,recordedParents:{father:'זכריה'},researchNotes:siblingNote+' במצבת יששכר טרי נכתב בן זכריה, נפטר בכ״ד בניסן תשנ״ו (13.4.1996), בן 52. זהו אדם נפרד מיוסף טרי (קהא); מצבתו ותאריך פטירתו שונים. התאמת המצבה לאח שבעדות נשענת על הצטלבות השם, המשפחה ושם האב.',researchSources:[source('מצבת יששכר טרי בן זכריה · 13.4.1996','Yissachar Tri, son of Zechariah · gravestone, 13 April 1996',grave('יששכר-טרי/20992894'))]}),
  person('tri-david','דוד','David','m',{deceased:true,researchNotes:siblingNote+' גליה מספרת שדוד עזר ליוסי בכרם. השם ״טורי דוד״ מופיע בטבלת הקרקע כמועמד להשוואה; אין עדיין מצבה או עוגן הורות מאומת. אין לזהותו עם דוד קהא בן דוד שנקבר ב־1942, או עם דוד טריירל בן פישל ופרומה.',researchSources:[source('טבלת הקרקע · טורי דוד · התאמה לבדיקה','Land register · David Tori · candidate match',land)]}),
  // Keep the original profile ID, including any portraits, edits and media.
  person('keha-yosef-yissachar','יוסף טרי (קהא)','Yosef Tri (Keha)','m',{deceased:true,aliases:['יוסי טרי','יוסף קהא','יוסף טירי'],recordedParents:{father:'זכריה'},researchNotes:siblingNote+' לפי אורה וגליה יוסף, המכונה יוסי, נהרג בהתהפכות טרקטור; גליה מזכירה כרם ענבים. במצבת יוסף נכתב במפורש ״טרי (קהא)״, בן זכריה, כ״ו בתמוז תשמ״ה (15.7.1985), בן 47. אשכול הענבים במצבה מתאים לסיפור הכרם אך אינו מוכיח את התאונה. יוסף ויששכר הם שני אחים נפרדים; הכינוי ״יוסף יששכר״ ברישום המוקדם שילב שני אחים שונים.',researchSources:[source('מצבת יוסף טרי (קהא) בן זכריה · 15.7.1985','Yosef Tri (Keha), son of Zechariah · gravestone, 15 July 1985',grave('יוסף-טרי/20994129'))]}),
  sister('tri-esther','אסתר','Esther','דהרי אסתר'),
  sister('tri-rachel','רחל','Rachel','נוני רחל'),
  sister('tri-ronit','רונית','Ronit','יעקב רונית רינה'),
  sister('tri-miriam','מרים','Miriam','פרץ מרים'),
  sister('tri-hana','חנה','Hana','ביסטריצר בוצר חנה'),
  person('tri-shifra','שפרה קהתי','Shifra Kehati','f',{unit:'u-tri-binyamin',deceased:true,recordedParents:{father:'יחזקאל',mother:'טפחה'},burialDate:'7.12.2015',researchNotes:'לפי אורה, שפרה הייתה נשואה לבנימין והיא אמו של חזי הספר. ברישום חברה קדישא רחובות: שפרה קהתי בת יחזקאל וטפחה, נקברה ב־7.12.2015 בגיל 69, בית העלמין מזרח, חלקה ס, שורה א, מקום 34; לצד בנימין במקום 33. זהו תאריך קבורה. הקשר לחזי נסמך על העדות המשפחתית.',researchSources:[source('חברה קדישא רחובות · שפרה קהתי','Rehovot burial record · Shifra Kehati','https://kdr.org.il/deceased/קהתי-שפרה/')]}),
  person('tri-hezi','חזי קהתי','Hezi Kehati','m',{occupation:'ספר',researchNotes:'לפי אורה הוא בנה של שפרה, שהייתה נשואה לבנימין. נמצא רישום ציבורי של חזי קהתי כמעצב שיער, המתאים לרמז המקצועי. אבהותו של בנימין לא אושרה בנפרד ולכן אינה מוצגת כהורות מאומתת.',researchSources:[source('חזי קהתי · מעצב שיער · הצלבת העיסוק','Hezi Kehati · hairdresser · occupation match','https://www.d.co.il/19325400/30540/')]}),
  {id:'kehat-zechariah',triFamily:true,researchNotes:'בנו של סעדיה (ג׳ידעאן), ונפרד מזכריה בן צדוק שבענף השני. השם נמסר בתרשים המוקדם ונזכר בין בני ג׳מעאן בתעתיק המכתב מ־1944. זכריה קהא טרי בן סעדיה, שבמצבה המשולשת, הוא מועמד לחיבור ענף עשרת האחים מעדות אורה: יוסף, יששכר ובנימין מופיעים במקורות עם אב בשם זכריה; אצל בנימין נרשמה גם האם חממה. הזיהוי המדויק ושיוך כל העשרה אליו עדיין בבירור, ובפרט סתירת גילו של מנחם. עשרת האחים מוצגים בקבוצה נפרדת עד להשלמת ההורות.',researchSources:[triple,source('ענף טרי · עשרת האחים · ההורות בבירור','Tri family · ten siblings · parentage under research','https://family-extended.eldadkeha.workers.dev/keha-extended/#tree/yissachar')]},
].map(p=>Object.freeze(p.id==='tri-rachel'?{...p,deceased:true}:p)));

export function applyTriUnits(units){
  const children=TRI_SIBLINGS.map(unitId);
  // This is a structural sibling group, not an invented parent or a couple.
  units['u-keha-yissachar']={id:'u-keha-yissachar',people:['tri-siblings-group'],children,parent:null,relationship:'group',siblingGroup:true};
  for(const id of TRI_SIBLINGS){const u=unitId(id);units[u]={id:u,people:[id],children:[],parent:'u-keha-yissachar',relationship:'single'};}
  units['u-tri-binyamin']={id:'u-tri-binyamin',people:['tri-binyamin','tri-shifra'],children:['u-tri-hezi'],parent:'u-keha-yissachar',relationship:'spouse',relationships:[
    {people:['tri-binyamin','tri-shifra'],children:[],relationship:'spouse'},
    {people:['tri-shifra'],children:['u-tri-hezi'],relationship:'parent',label:'בנה של שפרה',labelEn:'Shifra’s son'},
  ]};
  units['u-tri-hezi']={id:'u-tri-hezi',people:['tri-hezi'],children:[],parent:'u-tri-binyamin',relationship:'single'};
}
