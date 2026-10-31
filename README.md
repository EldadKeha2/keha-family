# בית משפחת קהא

אילן היוחסין, האלבומים, הסרטונים והיומן המשפחתי. גרסת האירוח משתמשת ב־Cloudflare Workers ובאחסון פרטי ב־Hugging Face.

## מבנה

- `public/`: הממשק הקיים, מותאם למחשב ולטלפון.
- `src/worker.mjs`: נתיבי האתר וה־API, העלאות וגישור למדיה.
- `src/state.mjs`: מסד SQLite ב־Cloudflare Durable Object. שומר תאריכים, כיתובים, בחירת תמונות פרופיל וסיפורים בעדכונים אטומיים.
- `src/hf.mjs`: חיבור S3 ל־Hugging Face Storage Bucket פרטי. סרטונים מועברים בזרם ותומכים בבקשות Range.
- `src/auth.mjs`: כניסה בסיסמה משפחתית, עוגייה חתומה, הגנת כתיבה והגבלת ניסיונות כניסה.
- `src/family.mjs`: הנתונים הראשוניים של 81 בני המשפחה. שינויים דרך האתר נשמרים במסד הנתונים ואינם מחליפים קובץ זה.

המאגר ציבורי לפי בחירת הבעלים. נתוני האילן הראשוניים זמינים בקוד; הסיסמה ומפתחות האחסון נשמרים רק בהגדרות Cloudflare. כל נתיבי האתר והמדיה עוברים דרך בדיקת הכניסה לפני ההגשה.

## חיבור Cloudflare דרך הדפדפן

1. פותחים חשבון ב־Cloudflare ונכנסים ל־Workers & Pages.
2. יוצרים Worker בחיבור GitHub ובוחרים `EldadKeha2/keha-family`.
3. שם ה־Worker: `keha-family`. ענף: `main`. תיקיית השורש: שורש המאגר.
4. פקודת build נשארת ריקה. פקודת deploy: `npx wrangler deploy`.
5. ההגדרה ב־`wrangler.jsonc` יוצרת את מסד הנתונים אוטומטית עם מיגרציית SQLite.
6. ב־Settings → Variables and Secrets מוסיפים Secret בשם `FAMILY_PASSWORD`, באורך של לפחות 10 תווים. זו סיסמת הכניסה של המשפחה.
7. מפרסמים מחדש לאחר שינוי ההגדרות. עד להגדרת הסיסמה מוצג מסך הגדרה, ללא גישה לנתוני האתר.

## חיבור Hugging Face

יוצרים **Storage Bucket פרטי** בשם `keha-family` בחשבון Hugging Face. החיבור הזה משתמש ב־Bucket, ולא ב־Dataset או Space. מתוך Access Tokens יוצרים token עם הרשאת כתיבה ל־Bucket, ובתפריט שלו בוחרים Generate S3 credentials.

מוסיפים ב־Cloudflare את הערכים הבאים:

| שם | סוג | תוכן |
| --- | --- | --- |
| `FAMILY_PASSWORD` | Secret | סיסמת הכניסה המשפחתית |
| `HF_NAMESPACE` | Variable | שם המשתמש או הארגון ב־Hugging Face |
| `HF_BUCKET` | Variable | `keha-family` |
| `HF_ACCESS_KEY_ID` | Secret | מפתח S3 שנוצר ב־Hugging Face, מתחיל ב־HFAK |
| `HF_SECRET_ACCESS_KEY` | Secret | מפתח S3 הסודי התואם |

מגדירים את המפתחות ישירות ב־Cloudflare ומפרסמים מחדש. אין לשמור ערכים אמיתיים בקוד או בקובץ `.dev.vars.example`. אזור S3 הוא `us-east-1`, וכתובת השער היא `https://s3.hf.co/<namespace>`.

אם רק הסיסמה הוגדרה, אפשר לעדכן תאריכים ולכתוב סיפורים ללא קבצים מצורפים. העלאות וצפייה בקבצים דורשות גם את חיבור האחסון. `GET /api/setup` מציג מצב חיבור לאחר כניסה.

## מגבלות גרסת האירוח

- תמונות: עד 50MB. JPG, PNG, WebP, GIF, AVIF; HEIC דורש המרה לפני העלאה.
- סרטונים: עד 90MB בבקשה אחת. MP4, WebM או MOV. נגינה תלויה בקידוד; מומלץ MP4 עם H.264. אין המרה אוטומטית.
- סיפורים: עד 100,000 תווים. עד עשרה מסמכים, עד 10MB למסמך ועד 20MB יחד.
- TXT ו־Markdown יכולים למלא את גוף הסיפור. PDF ו־DOCX נשמרים כקבצים להורדה.
- מכסות החינם של Cloudflare ושל Hugging Face חלות בהתאם לתוכניות החשבון. אין חיוב אוטומטי שמופעל באמצעות הקוד.

## גיבוי ותחזוקה

הקישור ״הורדת גיבוי נתונים״ בתחתית האתר מוריד JSON עם התאריכים, הכיתובים, הסיפורים והפניות למדיה. הוא אינו כולל את קובצי המדיה עצמם. יש לגבות גם את ה־Bucket הפרטי מתוך Hugging Face. שינוי הסיסמה המשפחתית מנתק את כל ההתחברויות הקיימות.

נתוני SQLite נשארים בין פריסות. אין למחוק את Durable Object או להחליף את שם המחלקה/המיגרציה בלי תהליך העברת נתונים.

## בדיקות

Node.js 22 ומעלה: `npm run check`. הבדיקות מפעילות את נתיבי ה־Worker עם SQLite אמיתי ושער אחסון מדומה, ובודקות שמירה, הרשאות, התנגשויות עריכה וחתימות S3. בדיקת חיבור אמיתי ל־Cloudflare ול־Hugging Face תבוצע אחרי הגדרת החשבונות.

תיעוד רשמי:

- https://developers.cloudflare.com/workers/static-assets/binding/
- https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/
- https://huggingface.co/docs/hub/storage-buckets-s3
