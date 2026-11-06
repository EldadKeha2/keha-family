// Shown immediately before a new activity is introduced, after the home screen.
// Stages 8–10 build on these skills and introduce no additional lesson.
export const HOUSE_LESSONS = Object.freeze({
  1: {
    he: 'קודם, קצת מים לעציצים',
    en: 'First, a little water for the plants',
    icons: ['water', 'plant'],
    steps: [
      { he: 'בוחרים את המשפך במדף. רותי הולכת לקחת אותו.', en: 'Choose the watering can on the shelf. Ruti walks over to collect it.' },
      { he: 'לוחצים על העציץ הזוהר, ורותי ניגשת להשקות.', en: 'Tap the glowing plant and Ruti walks over to water it.' },
      { he: 'משקים חמישה עציצים שונים, אחד בכל פעם. אין מגבלת זמן.', en: 'Water five different plants, one at a time. There is no time limit.' }
    ],
    question: { he: 'באיזה כלי משקים את העציץ?', en: 'Which tool waters the plant?' },
    answers: [
      { he: 'משפך', en: 'Watering can' },
      { he: 'מטאטא', en: 'Broom' }
    ],
    correctIndex: 0,
    successHe: 'בדיוק! לוקחים את המשפך וניגשים לעציץ.',
    successEn: 'Exactly! Collect the watering can, then visit the plant.',
    retryHe: 'העציץ צריך מים. חפשו את המשפך ונסו שוב.',
    retryEn: 'The plant needs water. Look for the watering can and try again.'
  },
  2: {
    he: 'גם האבק צריך תשומת לב',
    en: 'The dust needs attention too',
    icons: ['broom', 'dust', 'water'],
    steps: [
      { he: 'ממשיכים להשקות את העציצים כשהם זוהרים.', en: 'Keep watering the plants when they glow.' },
      { he: 'כשמופיע אבק, לוקחים את המטאטא ולוחצים על ענן האבק.', en: 'When dust appears, collect the broom and tap the dust cloud.' },
      { he: 'האבק לא מחכה לנצח. מחליפים כלי לפי המשימה ומגיעים בזמן.', en: 'Dust will not wait forever. Switch tools to match the task and arrive in time.' }
    ],
    question: { he: 'באיזה כלי מנקים אבק?', en: 'Which tool cleans the dust?' },
    answers: [
      { he: 'מטאטא', en: 'Broom' },
      { he: 'משפך', en: 'Watering can' }
    ],
    correctIndex: 0,
    successHe: 'נכון! המטאטא מחזיר את הבית להיות מבריק.',
    successEn: 'Right! The broom makes the house sparkle again.',
    retryHe: 'המשפך מיועד לעציצים. בשביל האבק לוקחים מטאטא.',
    retryEn: 'The watering can is for plants. Dust needs the broom.'
  },
  3: {
    he: 'מי מחכה ליד הדלת?',
    en: 'Who is waiting by the door?',
    icons: ['hand', 'cat', 'water'],
    steps: [
      { he: 'שומרים על העציצים ומציצים גם בשתי הדלתות.', en: 'Care for the plants and keep an eye on both doors.' },
      { he: 'כשרואים חתול, בוחרים את היד עם הכיתוב ״לכו מפה!״.', en: 'When a cat appears, choose the hand marked “Shoo!”.' },
      { he: 'לוחצים על החתול. רותי ניגשת ומבריחה אותו לפני שייכנס.', en: 'Tap the cat. Ruti walks over and shoos it away before it gets inside.' }
    ],
    question: { he: 'מה לוקחים כדי להבריח חתול?', en: 'What do you collect to shoo a cat away?' },
    answers: [
      { he: 'היד של ״לכו מפה!״', en: 'The “Shoo!” hand' },
      { he: 'מגש אוכל', en: 'Serving tray' }
    ],
    correctIndex: 0,
    successHe: 'לכו מפה! עכשיו יודעים לשמור על הדלת.',
    successEn: 'Shoo! Now you know how to guard the door.',
    retryHe: 'את המגש שומרים למשפחה. חתולים מבריחים עם היד.',
    retryEn: 'Save the tray for the family. Shoo cats away with the hand.'
  },
  4: {
    he: 'העציצים, האבק והחתולים ביחד',
    en: 'Plants, dust and cats together',
    icons: ['water', 'broom', 'hand'],
    steps: [
      { he: 'משפך לעציצים, מטאטא לאבק, ויד כדי להבריח חתולים.', en: 'Watering can for plants, broom for dust, and hand to shoo cats.' },
      { he: 'בוחרים את הכלי הנכון, ואז את החפץ שצריך טיפול.', en: 'Choose the right tool, then the object that needs attention.' },
      { he: 'חתול שנכנס הוא פסילה. שלוש פסילות מסיימות את המשחק.', en: 'A cat entering costs a life. Three cats entering end the game.' }
    ],
    question: { he: 'איזה אירוע גורם לפסילה?', en: 'Which event costs a life?' },
    answers: [
      { he: 'חתול הצליח להיכנס לבית', en: 'A cat gets inside the house' },
      { he: 'ענן אבק נעלם לפני שניקינו', en: 'A dust cloud disappears before it is cleaned' }
    ],
    correctIndex: 0,
    successHe: 'נכון. שומרים במיוחד על הדלתות!',
    successEn: 'Right. Give the doors extra attention!',
    retryHe: 'אבק שפספסנו לא מוריד חיים. חתול שנכנס לבית כן.',
    retryEn: 'Missed dust does not cost a life. A cat getting inside does.'
  },
  5: {
    he: 'זמן לטחינה של רותי',
    en: 'Time for Ruti’s tahini',
    icons: ['bowl', 'knife', 'tahini', 'carrot'],
    steps: [
      { he: 'לוקחים קערה וכף וניגשים לטחינה הזוהרת במטבח.', en: 'Collect the bowl and spoon, then visit the glowing tahini in the kitchen.' },
      { he: 'לוחצים על הטחינה כדי לערבב, ואז שוב כדי להוסיף מים ולערבב.', en: 'Tap the tahini to mix, then tap again to add water and stir.' },
      { he: 'לסלט הגזר מתחילים בסכין וממשיכים בקערה. עוקבים אחרי הרמז של כל מנה.', en: 'Start the carrot salad with the knife, then use the bowl. Follow each dish’s hint.' }
    ],
    question: { he: 'באיזה כלי מתחילים להכין טחינה?', en: 'Which tool starts the tahini?' },
    answers: [
      { he: 'קערה וכף', en: 'Bowl and spoon' },
      { he: 'מטאטא', en: 'Broom' }
    ],
    correctIndex: 0,
    successHe: 'בדיוק! נכין טחינה ונמשיך לדאוג לבית.',
    successEn: 'Exactly! Make some tahini and keep caring for the house.',
    retryHe: 'את הטחינה מערבבים בקערה וכף. המטאטא נשאר לניקיון.',
    retryEn: 'Mix tahini with the bowl and spoon. Keep the broom for cleaning.'
  },
  6: {
    he: 'אף אחד לא יוצא מכאן רעב',
    en: 'Nobody leaves hungry',
    icons: ['serve', 'tahini', 'peanuts'],
    steps: [
      { he: 'האורח מראה איזו מנה הוא רוצה. לוקחים מגש מהמדף.', en: 'The guest shows the dish they want. Collect a tray from the shelf.' },
      { he: 'ניגשים למנה המבוקשת במטבח, אוספים אותה, ורק אז ניגשים לאורח.', en: 'Visit the requested dish in the kitchen, collect it, then take it to the guest.' },
      { he: 'ארוחה נותנת הכי הרבה נקודות. אפשר גם לקחת בוטנים ולהגיש ישירות.', en: 'A meal earns the most points. You can also collect peanuts and serve them directly.' }
    ],
    question: { he: 'איך מגישים לאורח ארוחה?', en: 'How do you serve a guest a meal?' },
    answers: [
      { he: 'מגש, אחריו המנה במטבח, ואז האורח', en: 'Collect a tray, collect the kitchen dish, then visit the guest' },
      { he: 'לוקחים מגש ריק וניגשים ישר לאורח', en: 'Take an empty tray straight to the guest' }
    ],
    correctIndex: 0,
    successHe: 'נכון! מגש עם אוכל, והרבה אהבה.',
    successEn: 'Right! A tray of food, and plenty of love.',
    retryHe: 'מגש ריק לא משביע. קודם אוספים את המנה המבוקשת במטבח.',
    retryEn: 'An empty tray will not fill anyone up. Collect the requested kitchen dish first.'
  },
  7: {
    he: 'ריח של קובנה מהתנור',
    en: 'The smell of kubaneh from the oven',
    icons: ['bowl', 'oven', 'kubaneh', 'eggplant', 'lasagna'],
    steps: [
      { he: 'לוקחים קערה וכף וניגשים לקובנה כדי ללוש את הבצק.', en: 'Collect the bowl and spoon and visit the kubaneh to knead the dough.' },
      { he: 'מחליפים לכפפת תנור, חוזרים לקובנה ומכניסים אותה לאפייה.', en: 'Switch to the oven mitt, return to the kubaneh and put it in the oven.' },
      { he: 'גם החצילים והלזניה מצטרפים. מחליפים כלים לפי הרמז ומטפלים בבית בזמן האפייה.', en: 'Eggplant and lasagna join the kitchen too. Follow their tool hints and care for the house while food bakes.' }
    ],
    question: { he: 'מה לוקחים כדי להכניס את הקובנה לתנור?', en: 'What do you collect to put the kubaneh in the oven?' },
    answers: [
      { he: 'כפפת תנור', en: 'Oven mitt' },
      { he: 'משפך', en: 'Watering can' }
    ],
    correctIndex: 0,
    successHe: 'נכון! הכפפה מוכנה, והקובנה בדרך לתנור.',
    successEn: 'Right! The mitt is ready and the kubaneh is on its way to the oven.',
    retryHe: 'המשפך נשאר לעציצים. בשביל התנור לוקחים את הכפפה.',
    retryEn: 'Keep the watering can for plants. Collect the mitt for the oven.'
  }
});
