// Searchable language labels; stored values remain plain strings for older clients.
const rows=[
 ['he','עברית','Hebrew','IL','עברית'],
 ['en','אנגלית','English','GB','en-GB|British English|אנגלית בריטית|אנגלית (בריטניה)'],
 ['en-US','אנגלית (ארה״ב)','English (US)','US','American English|אנגלית אמריקאית|English (United States)'],
 ['fr','צרפתית','French','FR','français|francais'],
 ['es','ספרדית','Spanish','ES','español|espanol'],
 ['ar','ערבית','Arabic','SA','العربية'],
 ['ar-YE','ערבית תימנית','Yemeni Arabic','YE','Arabic (Yemen)|תימנית'],
 ['ru','רוסית','Russian','RU','русский'],
 ['pt','פורטוגזית','Portuguese','PT','português|portugues'],
 ['pt-BR','פורטוגזית ברזילאית','Brazilian Portuguese','BR','Portuguese (Brazil)|פורטוגזית (ברזיל)'],
 ['de','גרמנית','German','DE','Deutsch'],
 ['it','איטלקית','Italian','IT','italiano'],
 ['nl','הולנדית','Dutch','NL','Nederlands'],
 ['yi','יידיש','Yiddish',null,'אידיש|ייִדיש'],
 ['am','אמהרית','Amharic','ET','አማርኛ'],
 ['fa','פרסית','Persian','IR','Farsi|فارسی'],
 ['tr','טורקית','Turkish','TR','Türkçe|תורכית'],
 ['pl','פולנית','Polish','PL','polski'],
 ['uk','אוקראינית','Ukrainian','UA','українська'],
 ['ro','רומנית','Romanian','RO','română'],
 ['hu','הונגרית','Hungarian','HU','magyar'],
 ['el','יוונית','Greek','GR','Ελληνικά'],
 ['zh','סינית','Chinese','CN','Mandarin|מנדרינית|中文|zh-CN'],
 ['zh-HK','קנטונזית','Cantonese','HK','粵語|Chinese (Cantonese)'],
 ['ja','יפנית','Japanese','JP','日本語'],
 ['ko','קוריאנית','Korean','KR','한국어'],
 ['hi','הינדי','Hindi','IN','हिन्दी'],
 ['ur','אורדו','Urdu','PK','اردو'],
 ['th','תאית','Thai','TH','ภาษาไทย|תאילנדית'],
 ['vi','וייטנאמית','Vietnamese','VN','Tiếng Việt'],
 ['id','אינדונזית','Indonesian','ID','Bahasa Indonesia'],
 ['ms','מלאית','Malay','MY','Bahasa Melayu'],
 ['tl','טגלוג','Tagalog','PH','Filipino|פיליפינית'],
 ['bn','בנגלית','Bengali','BD','বাংলা'],
 ['ta','טמילית','Tamil','IN','தமிழ்'],
 ['ne','נפאלית','Nepali','NP','नेपाली'],
 ['si','סינהלית','Sinhala','LK','සිංහල'],
 ['sw','סוואהילי','Swahili','KE','Kiswahili'],
 ['bg','בולגרית','Bulgarian','BG','български'],
 ['cs','צ׳כית','Czech','CZ',"צ'כית|čeština"],
 ['sk','סלובקית','Slovak','SK','slovenčina'],
 ['sr','סרבית','Serbian','RS','српски'],
 ['hr','קרואטית','Croatian','HR','hrvatski'],
 ['sv','שוודית','Swedish','SE','svenska|שבדית'],
 ['da','דנית','Danish','DK','dansk'],
 ['no','נורווגית','Norwegian','NO','norsk'],
 ['fi','פינית','Finnish','FI','suomi'],
 ['is','איסלנדית','Icelandic','IS','íslenska'],
 ['ka','גאורגית','Georgian','GE','ქართული|גרוזינית'],
 ['hy','ארמנית','Armenian','AM','Հայերեն'],
 ['ku','כורדית','Kurdish',null,'Kurdî|کوردی'],
 ['eo','אספרנטו','Esperanto',null,'Esperanto']
];
export const languageCatalog=Object.freeze(rows.map(([code,he,en,country,aliases])=>Object.freeze({code,he,en,country,aliases:aliases.split('|')})));
const normalize=value=>String(value??'').normalize('NFKD').replace(/\p{M}/gu,'').replace(/[׳״'"()]/g,'').replace(/\s+/g,' ').trim().toLowerCase();
const byAlias=new Map();
for(const language of languageCatalog)for(const alias of [language.code,language.he,language.en,...language.aliases])byAlias.set(normalize(alias),language);
export const resolveLanguage=value=>byAlias.get(normalize(value))||null;
export const languageKey=value=>resolveLanguage(value)?.code||normalize(value);
export const languageLabel=(value,english=false)=>{const language=resolveLanguage(value);return language?(english?language.en:language.he):String(value??'');};
export function searchLanguages(query,selected=[],english=false){
 const q=normalize(query),chosen=new Set(selected.map(languageKey));
 return languageCatalog.filter(language=>!chosen.has(language.code)&&(!q||[language.code,language.he,language.en,...language.aliases].some(value=>normalize(value).includes(q))));
}
