// Owner-supplied chart, 20 November 2026. This branch is independent of Kehat.
// Unknown dates, spouses, genders and unnamed children are deliberately absent.
const people=[], units=[];
function person(key,name,englishName,gender='',details={}) {
  const id='saadia-'+key;
  people.push({id,name,englishName,nameEn:englishName,gender,...details});
  return id;
}
function unit(key,members,children=[],parent=null,details={}) {
  const id='u-saadia-'+key;
  for(const personId of members)people.find(p=>p.id===personId).unit=id;
  units.push({id,people:members,children:children.map(key=>'u-saadia-'+key),parent:parent?'u-saadia-'+parent:null,relationship:members.length>1?'spouse':'single',...details});
  return id;
}
const dead={deceased:true};
const elder=person('elder','סעדיה קהא','Saadia Keha','m',{...dead,siblings:['keha-zechariah-father'],about:'אחיו של זכריה קהא האב ודודו של שלמה קהא. אביו של זכריה קהא הבן. נפטר בתימן לפני העלייה ולא זכה לעלות ארצה. שם אשתו טרם ידוע.'});
unit('elder',[elder],[],null,{children:['u-keha-zechariah'],generation:0});

const kadya=person('kadya','קדיה מזרחי','Kadya Mizrahi','f');
unit('kadya',[kadya],['yair','yaira','zaki']);
unit('yair',[person('yair','יאיר מזרחי','Yair Mizrahi','m',dead),person('carmela','כרמלה','Carmela','f')],['ofer','yehudit'],'kadya');
unit('ofer',[person('ofer','עופר מזרחי','Ofer Mizrahi','m',{occupation:'גיטריסט'})],[],'yair');
unit('yehudit',[person('yehudit','יהודית מזרחי','Yehudit Mizrahi','f',{about:'לפי המידע המשפחתי, מתגוררת בהולנד.'})],[],'yair');
unit('yaira',[person('yaira','יאירה מזרחי','Yaira Mizrahi','f',dead)],['giora','sharon'],'kadya');
unit('giora',[person('giora','גיורא (גיגי)','Giora (Gigi)','m',{aliases:['גיגי']})],[],'yaira');
unit('sharon',[person('sharon','שרון','Sharon')],[],'yaira');
unit('zaki',[person('zaki','זכי מזרחי','Zaki Mizrahi','m',dead),person('ofra','עפרה','Ofra','f',dead)],['asi','tal'],'kadya');
unit('asi',[person('asi','אסי','Asi','',dead)],[],'zaki');
unit('tal',[person('tal','טל','Tal')],[],'zaki');

const shalom=person('shalom','שלום קהא','Shalom Keha','m',{...dead,birthYear:1923,birthYearSource:'פנקס ותעודת נישואין',birthYearSourceEn:'Register and marriage certificate',aliases:['שולם קהא'],about:'בתרשים המשפחתי מופיע גם הכינוי ״בכרא מקומו״. נישא לרחל קפרא ב־21.6.1949 בשעריים, לפי תעודת הנישואין H 100067.'});
unit('shalom',[shalom,person('rachel','רחל קפרא קהא','Rachel Kapra Keha','f',{aliases:['רחל קפרא','רחל כפרא','רחל קהא'],about:'נישאה לשלום קהא ב־21.6.1949 בשעריים, לפי תעודת הנישואין H 100067.'})],['boaz','dalia','efi','yakira'],null,{weddingYear:1949,weddingDate:'21.6.1949'});
unit('boaz',[person('boaz','בועז קהא','Boaz Keha','m',{...dead,sharedProfileId:'extra-b2c26d6299d747f083bf9490'}),person('leah','לאה','Leah','f')],['inbal-boaz','ido','hila'],'shalom');
for(const [key,name,en,gender] of [['inbal-boaz','ענבל קהא','Inbal Keha','f'],['ido','עידו קהא','Ido Keha','m'],['hila','הילה קהא','Hila Keha','f']])unit(key,[person(key,name,en,gender)],[],'boaz');
unit('dalia',[person('dalia','דליה קהא','Dalia Keha','f',dead),person('karl','קרל','Karl','m')],['amos','noam'],'shalom');
unit('amos',[person('amos','עמוס','Amos','m',{about:'לפי המידע המשפחתי, מתגורר בהיידלברג. במחקר נמצא השם עמוס־קארל לאכט (ובכתיב לאכאט) לצד יורשי שלום קהא; זיהוי השם המלא עדיין טעון אישור משפחתי.'})],[],'dalia');
unit('noam',[person('noam','נועם','Noam','',{about:'לפי המידע המשפחתי, מתגורר בדיסלדורף. במחקר נמצא השם נועם־רחל לאכט (ובכתיב לאכאט) לצד יורשי שלום קהא; זיהוי השם המלא עדיין טעון אישור משפחתי.'})],['dalia-noam'],'dalia');
unit('dalia-noam',[person('dalia-noam','דליה','Dalia','f')],[],'noam');
unit('efi',[person('efi','אפי קהא האס','Efi Keha Haas','',{aliases:['אפי קהא הס'],about:'לפי המידע המשפחתי, מתגוררת בפרנקפורט. בתרשים מופיעה לצד רנה, בפרידה. במחקר נמצאה אפרת האס לצד יורשי שלום קהא; ההתאמה לאפי עדיין טעונה אישור משפחתי.'}),person('rene','רנה','Rene')],['ella','dana'],'shalom',{relationship:'former'});
unit('ella',[person('ella','אלה','Ella','f')],[],'efi');
unit('dana',[person('dana','דנה','Dana','f')],[],'efi');
unit('yakira',[person('yakira','יקירה וגנר','Yakira Wagner','f',{aliases:['יקירה קהא'],about:'בתרשים: יקירה וקובי (וגנר). במחקר נמצא גם הכתיב יקירה ונגר לצד יורשי שלום קהא; הכתיב המלא עדיין טעון אישור משפחתי.'}),person('kobi','קובי וגנר','Kobi Wagner','m')],['oded'],'shalom');
unit('oded',[person('oded','עודד וגנר','Oded Wagner','m'),person('daria','דריה','Daria','f')],['inbar','maor'],'yakira');
unit('inbar',[person('inbar','ענבר','Inbar')],[],'oded');
unit('maor',[person('maor','מאור','Maor')],[],'oded');

unit('saadia',[person('saadia','סעדיה קהא','Saadia Keha','m',{birthYear:1918,birthYearSource:'אישור בתו אביבה',birthYearSourceEn:'Confirmed by his daughter Aviva',researchNotes:'שנת 1918 אושרה בידי בתו אביבה ונמסרה בידי אלדד. בפנקס תש״ב מופיעה 1920; הפער נשמר לבירור. יום וחודש הלידה אינם ידועים.',about:'אביהם של אביבה, טוני ורמי. בנו של זכריה קהא הבן ונכדו של סעדיה קהא הדוד. מופיע בפנקס הבוחר בשעריים משנת 1937, שורה 790: קהא, סעדיה, זכריה, שערים. נישא לסעידה ב־21.2.1945, לפי תעודה H 69399.'}),person('saida','סעידה קהא','Saida Keha','f',{sharedProfileId:'extra-b3318c4c12cc4e83886ee902',parents:['saadia-saida-father','saadia-saida-mother'],about:'נישאה לסעדיה קהא ב־21.2.1945, לפי תעודת הנישואין H 69399. בתעודה נרשמו הוריה יוסף ושרה; פענוח שם המשפחה טרם הושלם.'})],['aviva','toni','rami'],null,{weddingYear:1945,weddingDate:'21.2.1945'});
unit('aviva',[person('aviva','אביבה ארצי','Aviva Arzi','f',{aliases:['אביבה קהא']}),person('alon','אלון ארצי','Alon Arzi','m')],['moshe-arzi','erez','oren'],'saadia');
unit('moshe-arzi',[person('moshe-arzi','תומר ארצי','Tomer Arzi','m'),person('orit','אורית','Orit','f')],[],'aviva');
unit('erez',[person('erez','ארז ארצי','Erez Arzi','m')],[],'aviva');
unit('oren',[person('oren','אורן ארצי','Oren Arzi','m')],[],'aviva');
unit('toni',[person('toni','טוני קהא','Toni Keha')],[],'saadia');
unit('rami',[person('rami','רמי קהא','Rami Keha','m',dead)],['ronit','roni','ofir'],'saadia');
unit('ronit',[person('ronit','רונית','Ronit','f',{about:'לפי המידע המשפחתי, חייתה בארצות הברית ועלתה ארצה. גרושה; שתי בנותיה, סימון ואיבון, נשארו בארצות הברית.'})],['simone','yvonne'],'rami');
unit('simone',[person('simone','סימון','Simone','f')],[],'ronit');
unit('yvonne',[person('yvonne','איבון','Yvonne','f')],[],'ronit');
unit('roni',[person('roni','רוני','Roni','m',{about:'לפי המידע המשפחתי, בצפת ולו שישה או שבעה ילדים. שמות הילדים ומספרם המדויק טרם נמסרו.'})],[],'rami');
// Explicit family request: Tikva is not a person, spouse, mother node or tag.
unit('ofir',[person('ofir','אופיר','Ofir','m',{about:'לפי המידע המשפחתי, חי עם אמו תקוה.'})],[],'rami');

unit('israel',[person('israel','ישראל קהא','Israel Keha','m'),person('nechama','נחמה קהא','Nechama Keha','f')],['michal','yifat','dagnit','galit']);
unit('michal',[person('michal','מיכל אביטן','Michal Avitan','f',{aliases:['מיכל קהא']}),person('moshe-avitan','משה אביטן','Moshe Avitan','m',dead)],['daniel','liron','ofir-avitan'],'israel');
unit('daniel',[person('daniel','דניאל אביטן','Daniel Avitan')],['amir','michael'],'michal');
unit('amir',[person('amir','אמיר','Amir','m')],[],'daniel');
unit('michael',[person('michael','מיכאל','Michael','m')],[],'daniel');
unit('liron',[person('liron','לירון אביטן','Liron Avitan','f')],['ori'],'michal');
unit('ori',[person('ori','אורי','Ori')],[],'liron');
unit('ofir-avitan',[person('ofir-avitan','אופיר אביטן','Ofir Avitan','f')],[],'michal');
unit('yifat',[person('yifat','יפעת עופר','Yifat Ofer','f',{aliases:['יפעת קהא'],about:'אחותן של מיכל אביטן ודגנית קהא. שם המשפחה עופר וקשר האחיות נזכרים גם בפסק הדין בתיק 1220-09, מיום 10.8.2011.'}),person('asaf','אסף','Asaf','m',{about:'לפי המידע המשפחתי, היה בעבר חבר קיבוץ יפתח.'})],[],'israel');
unit('dagnit',[person('dagnit','דגנית קהא','Dagnit Keha','f',{...dead,about:'פסק הדין בתיק 1220-09 מציין את הלווייתה ברחובות ב־1.9.2008. זהו תאריך ההלוויה; תאריך הפטירה המדויק עדיין לא אומת.'})],[],'israel');
unit('galit',[person('galit','גלית קהא','Galit Keha','f')],[],'israel');

unit('aharon',[person('aharon','אהרון חובשי','Aharon Hovshi','m',{aliases:['אהרן חובשי','אהרון קהא'],about:'לפי המידע המשפחתי, התייתם ואומץ בידי זכריה קהא הבן. בהמשך חזר לשם המשפחה חובשי. הקשר לזכריה הוא קשר אימוץ; שמות הוריו הביולוגיים טרם נמסרו.'}),person('yona-hovshi','יונה חובשי','Yona Hovshi','f')],['shlomo-hovshi','tzvia','orly'],null,{parentage:'adopted'});
for(const [key,name,en,gender] of [['shlomo-hovshi','שלמה חובשי','Shlomo Hovshi','m'],['tzvia','צביה חובשי','Tzvia Hovshi','f'],['orly','אורלי חובשי','Orly Hovshi','f']])unit(key,[person(key,name,en,gender)],[],'aharon');

// Primary evidence: parents' column of marriage certificates H 100067 and
// H 69399. These are the wives' own parents, never their husbands' parents.
people.find(p=>p.id==='saadia-rachel').parents=['saadia-kapra-zechariah','saadia-kapra-sara'];
unit('kapra-chaim',[person('kapra-chaim','חיים','Haim','m',{about:'אביו של זכריה בן חיים קפרא, לפי שם האב בתעודת הנישואין של רחל קפרא, H 100067. פרטים נוספים טרם נמסרו.'})],['kapra-parents'],null,{generation:0});
unit('kapra-parents',[person('kapra-zechariah','זכריה בן חיים קפרא','Zechariah Kapra, son of Haim','m',{about:'אביה של רחל קפרא, לפי תעודת נישואיה לשלום קהא, H 100067, מ־21.6.1949.'}),person('kapra-sara','שרה קפרא','Sara Kapra','f',{about:'אמה של רחל קפרא, לפי תעודת נישואיה H 100067, מ־21.6.1949. שם משפחתה לפני הנישואין אינו ידוע.'})],[],'kapra-chaim');
unit('saida-parents',[person('saida-father','יוסף','Yosef','m',{about:'אביה של סעידה קהא, לפי תעודת נישואיה H 69399, מ־21.2.1945. פענוח שם המשפחה טרם הושלם.'}),person('saida-mother','שרה','Sara','f',{about:'אמה של סעידה קהא, לפי תעודת נישואיה H 69399, מ־21.2.1945. פענוח שם המשפחה טרם הושלם.'})]);

export const SAADIA_PEOPLE=Object.freeze(people.map(Object.freeze));
export const SAADIA_UNITS=Object.freeze(units.map(item=>Object.freeze({...item,parent:['kadya','shalom','saadia','israel','aharon'].some(key=>item.id==='u-saadia-'+key)?'u-keha-zechariah':item.parent})));
export const ZECHARIAH_CHILDREN=Object.freeze(['kadya','shalom','saadia','israel','aharon'].map(key=>'u-saadia-'+key));
