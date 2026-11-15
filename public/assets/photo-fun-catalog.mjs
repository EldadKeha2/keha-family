// Compact, local presets: only the eight visible thumbnails are painted.
export const BACKGROUNDS=[
  ['none','הרקע המקורי','Original','↩'],['beach','חוף טרופי','Tropical beach','🏝️'],['space','על הירח','On the moon','🚀'],['paris','פריז','Paris','🗼'],['snow','הרים מושלגים','Snowy mountains','🏔️'],['forest','יער קסום','Magic forest','🌳'],['desert','שקיעה במדבר','Desert sunset','🌵'],['party','מסיבת דיסקו','Disco party','🪩'],
  ['reef','מתחת למים','Coral reef','🐠'],['aurora','הזוהר הצפוני','Northern lights','🌌'],['japan','פריחת הדובדבן','Cherry blossoms','🌸'],['venice','ונציה','Venice','🛶'],['new-york','ניו יורק','New York','🗽'],['tokyo','טוקיו בלילה','Tokyo at night','🏙️'],['jerusalem','ירושלים של זהב','Golden Jerusalem','🕍'],['greece','אי יווני','Greek island','🏛️'],
  ['tuscany','גבעות טוסקנה','Tuscan hills','🍇'],['london','לונדון','London','🇬🇧'],['pyramids','הפירמידות','The pyramids','🐪'],['safari','ספארי','Safari','🦒'],['waterfall','מפל בג׳ונגל','Jungle waterfall','💦'],['lavender','שדה לבנדר','Lavender fields','💜'],['sunflowers','שדה חמניות','Sunflower field','🌻'],['mushrooms','ארץ הפטריות','Mushroom forest','🍄'],
  ['castle','טירת אגדות','Fairytale castle','🏰'],['rainbow','מעל הקשת','Over the rainbow','🌈'],['candy','ארץ הממתקים','Candy land','🍭'],['volcano','אי געשי','Volcanic island','🌋'],['mars','על מאדים','On Mars','🔴'],['saturn','טבעות שבתאי','Rings of Saturn','🪐'],['galaxy','לב הגלקסיה','Deep galaxy','✨'],['station','תחנת חלל','Space station','🛰️'],
  ['pirate-island','אי הפיראטים','Pirate island','🏴‍☠️'],['lighthouse','המגדלור','Lighthouse coast','⚓'],['rain-city','עיר בגשם','Rainy city','☔'],['winter-village','כפר בחורף','Winter village','☃️'],['autumn','פארק בסתיו','Autumn park','🍂'],['meadow','אחו פורח','Spring meadow','🌼'],['harbor','נמל מפרשיות','Sailboat harbor','⛵'],['ski','חופשת סקי','Ski resort','🎿'],
  ['theater','על הבמה','Theater stage','🎭'],['stadium','אצטדיון מלא','Packed stadium','🏟️'],['red-carpet','שטיח אדום','Red carpet','📸'],['gallery','בתוך מוזיאון','Art museum','🖼️'],['library','ספרייה קסומה','Enchanted library','📚'],['bamboo','יער במבוק','Bamboo forest','🎋'],['balloons','כדורים פורחים','Hot air balloons','🎈'],['ice-palace','ארמון הקרח','Ice palace','❄️']
];
export const HEADS=[
  ['lion','ראש אריה','Lion','🦁'],['robot','ראש רובוט','Robot','🤖'],['alien','חייזר','Alien','👽'],['cat','ראש חתול','Cat','🐱'],['panda','פנדה','Panda','🐼'],['laugh','מצחיק בטירוף','Laughing','😂'],['dog','ראש כלב','Dog','🐶'],['disguise','בלש סמוי','Disguise','🥸'],
  ['fox','שועל','Fox','🦊'],['tiger','נמר','Tiger','🐯'],['bear','דוב','Bear','🐻'],['koala','קואלה','Koala','🐨'],['rabbit','ארנבון','Rabbit','🐰'],['mouse','עכבר','Mouse','🐭'],['hamster','אוגר','Hamster','🐹'],['monkey','קוף','Monkey','🐵'],
  ['gorilla','גורילה','Gorilla','🦍'],['orangutan','אורנגאוטן','Orangutan','🦧'],['wolf','זאב','Wolf','🐺'],['cow','פרה','Cow','🐮'],['pig','חזרזיר','Pig','🐷'],['horse','סוס','Horse','🐴'],['zebra','זברה','Zebra','🦓'],['giraffe','ג׳ירפה','Giraffe','🦒'],
  ['deer','אייל','Deer','🦌'],['moose','אייל קורא','Moose','🫎'],['unicorn','חד קרן','Unicorn','🦄'],['dragon','דרקון','Dragon','🐲'],['frog','צפרדע','Frog','🐸'],['crocodile','תנין','Crocodile','🐊'],['turtle','צב','Turtle','🐢'],['octopus','תמנון','Octopus','🐙'],
  ['shark','כריש','Shark','🦈'],['fish','דג טרופי','Tropical fish','🐠'],['dolphin','דולפין','Dolphin','🐬'],['whale','לווייתן','Whale','🐳'],['penguin','פינגווין','Penguin','🐧'],['owl','ינשוף','Owl','🦉'],['eagle','נשר','Eagle','🦅'],['duck','ברווז','Duck','🦆'],
  ['chick','אפרוח','Chick','🐥'],['chicken','תרנגולת','Chicken','🐔'],['flamingo','פלמינגו','Flamingo','🦩'],['parrot','תוכי','Parrot','🦜'],['seal','כלב ים','Seal','🦭'],['otter','לוטרה','Otter','🦦'],['sloth','עצלן','Sloth','🦥'],['hedgehog','קיפוד','Hedgehog','🦔'],
  ['raccoon','דביבון','Raccoon','🦝'],['skunk','בואש','Skunk','🦨'],['badger','גירית','Badger','🦡'],['polar-bear','דוב קוטב','Polar bear','🐻‍❄️'],['clown','ליצן','Clown','🤡'],['ghost','רוח רפאים','Ghost','👻'],['pumpkin','דלעת מחייכת','Pumpkin','🎃'],['ogre','מפלצת אדומה','Ogre','👹'],
  ['goblin','שד שובב','Goblin','👺'],['space-invader','חייזר פיקסלים','Space invader','👾'],['devil','שדון מחייך','Little devil','😈'],['angel','מלאך תמים','Angel','😇'],['cool','הכי קול','Cool','😎'],['star-eyes','עיני כוכבים','Star eyes','🤩'],['heart-eyes','מאוהב','Heart eyes','😍'],['silly','פרצוף שטותי','Silly','🤪'],
  ['upside-down','הפוך על הפוך','Upside down','🙃'],['wink','קריצה','Wink','😉'],['tongue','לשון בחוץ','Tongue out','😜'],['surprised','מופתע','Surprised','😲'],['scream','בהלם','Shocked','😱'],['sleepy','ישנוני','Sleepy','😴'],['party-face','פנים של מסיבה','Party face','🥳'],['cowboy-face','קאובוי מחייך','Cowboy smile','🤠'],
  ['nerd','החנון הגאה','Proud nerd','🤓'],['money-face','מיליונר','Millionaire','🤑'],['zip-mouth','שומר סוד','Secret keeper','🤐'],['melting','נמס מצחוק','Melting','🫠'],['salute','מצדיע','Saluting','🫡'],['peek','מציץ','Peeking','🫣'],['exploding','המוח התפוצץ','Mind blown','🤯'],['kiss','נשיקה','Blowing a kiss','😘']
];
// renderer, colors and face-relative anchor are shared by preview, placement and export.
const propRows=[
  ['glasses','משקפי שמש','Sunglasses','🕶️'],['crown','כתר מלכותי','Royal crown','👑'],['mustache','שפם מפואר','Mustache','🥸'],['hat','כובע מסיבה','Party hat','🥳'],['bunny','אוזני ארנב','Bunny ears','🐰'],['pirate','רטיית פיראט','Pirate patch','🏴‍☠️'],['bowtie','פפיון','Bow tie','🎀'],['bubble','בועת דיבור','Speech bubble','💬'],
  ['heart-glasses','משקפי לבבות','Heart glasses','💕',{shape:'glasses',variant:'heart',color:'#e85580',anchor:[.42,1.22]}],
  ['star-glasses','משקפי כוכבים','Star glasses','⭐',{shape:'glasses',variant:'star',color:'#e8b83e',anchor:[.42,1.25]}],
  ['round-glasses','משקפיים עגולים','Round spectacles','🤓',{shape:'glasses',variant:'round',color:'#805944',anchor:[.42,1.16]}],
  ['pixel-glasses','משקפי פיקסלים','Pixel shades','👾',{shape:'glasses',variant:'pixel',color:'#242438',anchor:[.42,1.25]}],
  ['ski-goggles','משקפת סקי','Ski goggles','🥽',{shape:'goggles',color:'#d75878',anchor:[.42,1.2]}],
  ['snorkel','שנורקל','Snorkel','🤿',{shape:'snorkel',color:'#33b9ad',anchor:[.48,1.5]}],
  ['monocle','מונוקל','Monocle','🧐',{shape:'monocle',color:'#d0a44d',anchor:[.43,1.05]}],
  ['lashes','ריסים דרמטיים','Dramatic lashes','👁️',{shape:'lashes',color:'#342033',anchor:[.39,1.1]}],
  ['super-mask','מסכת גיבור','Superhero mask','🦸',{shape:'mask',color:'#378bba',anchor:[.43,1.2]}],
  ['top-hat','כובע צילינדר','Top hat','🎩',{shape:'hat',variant:'top',color:'#292638',accent:'#c95171',anchor:[-.27,1.5]}],
  ['cowboy-hat','כובע קאובוי','Cowboy hat','🤠',{shape:'hat',variant:'cowboy',color:'#b27b46',accent:'#65462d',anchor:[-.17,1.65]}],
  ['wizard-hat','כובע קוסם','Wizard hat','🧙',{shape:'hat',variant:'wizard',color:'#6556ad',accent:'#f2cc66',anchor:[-.3,1.65]}],
  ['santa-hat','כובע חג','Santa hat','🎅',{shape:'hat',variant:'santa',color:'#dc4b53',accent:'#fff7e9',anchor:[-.22,1.5]}],
  ['chef-hat','כובע שף','Chef hat','🧑‍🍳',{shape:'hat',variant:'chef',color:'#fff9e9',accent:'#d9cfb9',anchor:[-.24,1.45]}],
  ['graduation','כובע בוגר','Graduation cap','🎓',{shape:'hat',variant:'graduate',color:'#323848',accent:'#e5b54b',anchor:[-.12,1.65]}],
  ['beret','ברט צרפתי','French beret','🥐',{shape:'hat',variant:'beret',color:'#a63c58',accent:'#612b3e',anchor:[-.12,1.4]}],
  ['cap','כובע מצחייה','Baseball cap','🧢',{shape:'hat',variant:'cap',color:'#368a93',accent:'#22616b',anchor:[-.1,1.45]}],
  ['viking','קסדת ויקינג','Viking helmet','⚔️',{shape:'viking',color:'#8994aa',anchor:[-.07,1.75]}],
  ['halo','הילה של מלאך','Angel halo','😇',{shape:'halo',color:'#f3ca51',anchor:[-.3,1.25]}],
  ['horns','קרני שדון','Devil horns','😈',{shape:'horns',color:'#d34662',anchor:[-.12,1.3]}],
  ['cat-ears','אוזני חתול','Cat ears','🐱',{shape:'ears',color:'#54415f',accent:'#eaa7bb',anchor:[-.15,1.4]}],
  ['antlers','קרני אייל','Reindeer antlers','🦌',{shape:'antlers',color:'#98704c',anchor:[-.24,1.6]}],
  ['tiara','נזר נסיכות','Princess tiara','💎',{shape:'tiara',color:'#c7dce6',accent:'#9b82cf',anchor:[-.06,1.25]}],
  ['flower-crown','זר פרחים','Flower crown','🌺',{shape:'flowers',color:'#f5a3be',accent:'#ffe8a5',anchor:[-.07,1.45]}],
  ['rainbow-crown','כתר קשת','Rainbow crown','🌈',{shape:'rainbow',color:'#e97093',anchor:[-.22,1.5]}],
  ['clown-nose','אף של ליצן','Clown nose','🔴',{shape:'nose',color:'#e54e66',anchor:[.63,.43]}],
  ['blush','לחיים ורודות','Rosy cheeks','☺️',{shape:'blush',color:'#ee8faa',anchor:[.64,1.1]}],
  ['freckles','נמשים','Freckles','✨',{shape:'freckles',color:'#ad704c',anchor:[.62,1.1]}],
  ['fangs','ניבי ערפד','Vampire fangs','🧛',{shape:'fangs',color:'#fff9ec',anchor:[.8,.55]}],
  ['beard','זקן מפואר','Full beard','🧔',{shape:'beard',color:'#65452e',anchor:[.95,1.15]}],
  ['white-beard','זקן של חכם','Wise white beard','🧙‍♂️',{shape:'beard',color:'#eee5d3',anchor:[1.02,1.2]}],
  ['goatee','זקן תיש','Goatee','🐐',{shape:'goatee',color:'#3e3032',anchor:[.99,.5]}],
  ['curly-mustache','שפם מסולסל','Curly mustache','〰️',{shape:'curly',color:'#8a582f',anchor:[.76,.95]}],
  ['tie','עניבה חגיגית','Fancy tie','👔',{shape:'tie',color:'#4d80ac',anchor:[1.42,.85]}],
  ['gold-necklace','שרשרת זהב','Gold necklace','📿',{shape:'necklace',color:'#dcad42',anchor:[1.25,1.3]}],
  ['medal','מדליית אלוף','Champion medal','🥇',{shape:'medal',color:'#e1b84b',anchor:[1.48,.9]}],
  ['scarf','צעיף צבעוני','Colorful scarf','🧣',{shape:'scarf',color:'#c65975',accent:'#edb55c',anchor:[1.2,1.5]}],
  ['headphones','אוזניות די ג׳יי','DJ headphones','🎧',{shape:'headphones',color:'#775ba8',anchor:[.33,1.55]}],
  ['butterfly-mask','מסכת פרפר','Butterfly mask','🦋',{shape:'mask',variant:'butterfly',color:'#a479c4',anchor:[.43,1.35]}],
  ['carnival-mask','מסכת קרנבל','Carnival mask','🎭',{shape:'mask',variant:'carnival',color:'#41a99c',anchor:[.43,1.3]}],
  ['eye-sparkles','נצנוצים בעיניים','Eye sparkles','✨',{shape:'sparkles',color:'#f4c854',anchor:[.35,1.35]}],
  ['ribbon','סרט בשיער','Hair ribbon','🎀',{shape:'glyph',glyph:'🎀',anchor:[-.05,.65],x:.82}],
  ['hair-flower','פרח בשיער','Hair flower','🌺',{shape:'glyph',glyph:'🌺',anchor:[.08,.65],x:.05}],
  ['butterfly','פרפר בשיער','Hair butterfly','🦋',{shape:'glyph',glyph:'🦋',anchor:[-.12,.75],x:.8}],
  ['microphone','מיקרופון','Microphone','🎤',{shape:'glyph',glyph:'🎤',anchor:[1.1,.95],x:1.02}],
  ['lollipop','סוכרייה ענקית','Giant lollipop','🍭',{shape:'glyph',glyph:'🍭',anchor:[1,.95],x:1.02}],
  ['ice-cream','גלידת ענק','Giant ice cream','🍦',{shape:'glyph',glyph:'🍦',anchor:[1,.95],x:-.05}],
  ['balloon','בלון חגיגי','Party balloon','🎈',{shape:'glyph',glyph:'🎈',anchor:[.15,1.25],x:1.25}],
  ['magic-wand','שרביט קסמים','Magic wand','🪄',{shape:'glyph',glyph:'🪄',anchor:[.85,1.15],x:1.08}],
  ['sword','חרב אבירים','Knight sword','🗡️',{shape:'glyph',glyph:'🗡️',anchor:[1,1.15],x:-.15}],
  ['shield','מגן אבירים','Knight shield','🛡️',{shape:'glyph',glyph:'🛡️',anchor:[1.3,1.3]}],
  ['bouquet','זר חגיגי','Flower bouquet','💐',{shape:'glyph',glyph:'💐',anchor:[1.3,1.25],x:1.03}],
  ['trophy','גביע המנצח','Winner trophy','🏆',{shape:'glyph',glyph:'🏆',anchor:[1.15,1.25],x:1.12}],
  ['guitar','גיטרה','Guitar','🎸',{shape:'glyph',glyph:'🎸',anchor:[1.5,1.65]}],
  ['camera','מצלמת וינטג׳','Vintage camera','📷',{shape:'glyph',glyph:'📷',anchor:[1.45,1.2]}],
  ['wings','כנפי מלאך','Angel wings','🪽',{shape:'wings',color:'#f8f0df',anchor:[1.2,2.8]}]
];
export const PROPS=propRows.map(row=>row.slice(0,4));
export const PROP_STYLES=Object.fromEntries(propRows.filter(row=>row[4]).map(row=>[row[0],row[4]]));
const glyphs=[
  '❤️','😂','🥳','⭐','🌈','🦄','🔥','💩','🎈','💋','🌸','🦋','🍉','🍕','🏆','🎉','😍','🤩','🤪','😱','👻','🛸','☀️','🌙','🎵','💎','🫶','🐣','💐','🕊️','💥','☕',
  '💖','💘','💝','💕','💞','💓','💗','💜','💙','💚','💛','🧡','🤍','🖤','🤎','💔',
  '✨','🌟','💫','⚡','☄️','🌠','🪐','🌌','🌞','🌛','🌝','☁️','⛅','🌧️','❄️','☃️',
  '🌻','🌺','🌷','🌹','🪻','🌼','🍀','🌿','🌴','🌵','🍄','🍁','🍂','🐚','🪸','🪷',
  '🐶','🐱','🦊','🐼','🐨','🐸','🐵','🦁','🐯','🐷','🐮','🐰','🦉','🐧','🐬','🦖',
  '🦕','🐉','🐙','🦩','🦜','🐢','🐠','🪼','🦀','🐝','🐞','🦔','🦥','🦦','🐾','🐤',
  '🍓','🍒','🍍','🥑','🍋','🍊','🍇','🍩','🍪','🧁','🎂','🍰','🍦','🍭','🍿','🥨',
  '🎊','🎁','🎀','🪩','🎭','🎨','🎬','🎤','🎧','🎸','🎷','🎺','🥁','🎻','🎹','🎶',
  '👑','🎩','🕶️','🪄','🔮','🧿','🪬','🕯️','🚀','🛶','⛵','✈️','🚁','🚂','🚲','🏰',
  '👍','👏','🙌','✌️','🤟','🤙','💪','💃','🕺','🏄','🤸','🧘','⚽','🏀','🎯','🥇'
];
export const EMOJIS=glyphs.map((glyph,i)=>['emoji-'+i,glyph,glyph,glyph]);
export const PALETTE_SIZE=8;
export const palettePages=count=>Math.max(1,Math.ceil(count/PALETTE_SIZE));
export function palettePage(page,delta,count){const pages=palettePages(count);return ((page+delta)%pages+pages)%pages;}
