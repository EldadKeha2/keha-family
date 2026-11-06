(() => {
  'use strict';
  const messages = {
    he: {
      pageTitle:'ניסוי הוספה לאייפון · בית משפחת קהא',brand:'בית משפחת קהא',badge:'אפשרות ניסוי · iPhone / iPad',title:'הבית שלנו במסך הבית',intro:'מנסים להוסיף אייקון לאתר באמצעות פרופיל קיצור דרך.',yona:'סבתא יונה מזמינה אתכם',noticeTitle:'לפני ההורדה',notice:'זהו פרופיל לא חתום. האייפון עשוי להציג אזהרה ולבקש את קוד נעילת המכשיר בהגדרות. הפרופיל מוסיף רק קיצור דרך שניתן להסיר — ללא ניהול מכשיר, תעודות או שינויי רשת.',download:'הורדת פרופיל קיצור הדרך',deviceNote:'פתחו את העמוד ב־Safari באייפון או באייפד. ההורדה לבדה אינה משלימה את ההוספה.',stepsTitle:'מה עושים אחרי הלחיצה?',step1Title:'מאשרים הורדה',step1:'אם האייפון מבקש אישור להורדת הפרופיל, בוחרים ״אפשר״.',step2Title:'פותחים את הגדרות האייפון',step2:'בוחרים ״פרופיל שהורד״. אם הוא לא מופיע, נכנסים לכללי ← VPN וניהול מכשיר.',step3Title:'בודקים ומתקינים',step3:'פותחים את פרופיל משפחת קהא, בודקים שהוא מכיל קיצור דרך לאתר ובוחרים ״התקן״. משלימים את האישורים שהאייפון מציג.',expiry:'לפי Apple, צריך להתקין את הפרופיל בתוך 8 דקות מהורדתו. לאחר מכן אפשר להוריד אותו שוב.',detailsTitle:'מה מותקן ואיך מסירים?',details:'מותקן קיצור אחד לאתר בית משפחת קהא, עם סמל האתר ופתיחה בחלון עצמאי. אפשר להסיר את האייקון ממסך הבית או להסיר את הפרופיל בהגדרות ← כללי ← VPN וניהול מכשיר.',comparison:'זו אפשרות ניסוי: מספר האישורים משתנה בין מכשירים, ולכן עדיין לא ידוע אם היא תחסוך לחיצות לעומת ההוספה הרגילה ב־Safari.',standard:'חזרה לאפשרות ההוספה הרגילה',browse:'להמשיך לאתר',requested:'נפתחה בקשת הורדה. אם האייפון אישר שהפרופיל הורד, המשיכו להתקנה בהגדרות. עדיין אין אישור שהאייקון נוסף.'
    },
    en: {
      pageTitle:'iPhone shortcut trial · Keha Family Home',brand:'Keha Family Home',badge:'Trial option · iPhone / iPad',title:'Our home on your Home Screen',intro:'Try adding the website icon using a shortcut profile.',yona:'Grandma Yona invites you',noticeTitle:'Before you download',notice:'This profile is unsigned. Your iPhone may show a warning and ask for your device passcode in Settings. The profile adds only one removable shortcut — no device management, certificates, or network changes.',download:'Download the shortcut profile',deviceNote:'Open this page in Safari on your iPhone or iPad. Downloading alone does not finish adding the shortcut.',stepsTitle:'What happens after you tap?',step1Title:'Allow the download',step1:'If your iPhone asks to download the profile, choose “Allow”.',step2Title:'Open iPhone Settings',step2:'Choose “Profile Downloaded”. If it is missing, go to General → VPN & Device Management.',step3Title:'Review and install',step3:'Open the Keha Family profile, check that it contains a website shortcut, and choose “Install”. Complete the confirmations shown by your iPhone.',expiry:'Apple requires installation within 8 minutes of downloading the profile. You can download it again if it expires.',detailsTitle:'What is installed, and how do I remove it?',details:'One shortcut to Keha Family Home is installed, using the website icon and a standalone window. You can remove the icon from your Home Screen or remove the profile in Settings → General → VPN & Device Management.',comparison:'This is a trial: the number of confirmations varies between devices, so we do not yet know whether it saves taps compared with adding through Safari.',standard:'Back to the usual installation option',browse:'Continue to the website',requested:'A download was requested. If your iPhone confirmed the profile download, continue in Settings. The website has not confirmed that an icon was added.'
    }
  };
  const params=new URLSearchParams(location.search);
  let language=['he','en-US','en-GB'].includes(params.get('lang'))?params.get('lang'):'he',requested=false;
  const download=document.querySelector('[data-profile-download]'),status=document.querySelector('[data-download-status]'),toggle=document.querySelector('[data-language-toggle]');
  function render(){
    const english=language!=='he',copy=messages[english?'en':'he'];
    document.documentElement.lang=language;document.documentElement.dir=english?'ltr':'rtl';document.title=copy.pageTitle;
    for(const element of document.querySelectorAll('[data-copy]'))element.textContent=copy[element.dataset.copy];
    document.querySelector('[data-yona]').alt=copy.yona;document.querySelector('[data-notice]').setAttribute('aria-label',copy.noticeTitle);
    toggle.textContent=english?'עברית':'English';toggle.lang=english?'he':'en';toggle.dir=english?'rtl':'ltr';
    download.href='/install/keha-family-'+language+'.mobileconfig';
    for(const link of document.querySelectorAll('[data-home-link]'))link.href='/?lang='+language+'#home';
    document.querySelector('[data-standard-link]').href='/?lang='+language+'&install=1#home';
    status.textContent=requested?copy.requested:'';
  }
  toggle.addEventListener('click',()=>{language=language==='he'?'en-US':'he';render();});
  // Keep a normal HTTPS navigation so Safari can handle the profile itself.
  // A click is only a download request, never confirmation of installation.
  download.addEventListener('click',()=>{requested=true;render();});
  render();
})();
