// Shown immediately before a new activity is introduced, after the home screen.
// Stages 8–10 build on these skills and introduce no additional lesson.
export const HOUSE_LESSONS = Object.freeze({
  1: {
    he: 'קודם, קצת מים לעציצים',
    en: 'First, a little water for the plants',
    icons: ['water', 'broom'],
    steps: [
      { he: 'לוחצים על המשפך למטה והוא מופיע מיד ביד של רותי.', en: 'Tap the watering can below and it appears in Ruti’s hand instantly.' },
      { he: 'לוחצים על העציץ הזוהר, ורותי ניגשת להשקות.', en: 'Tap the glowing plant and Ruti walks over to water it.' },
      { he: 'בבית ארבעה עציצים שונים. משלימים 30 השקיות בסך הכול: מתחילים בנחת, ובהמשך מופיעים שעונים ובקשות חופפות. כשמופיע אבק, עוברים למטאטא.', en: 'There are four different plants. Complete 30 waterings in total: begin gently, then timers and overlapping requests appear. Switch to the broom when dust appears.' }
    ],
    question: { he: 'באיזה כלי משקים את העציץ?', en: 'Which tool waters the plant?' },
    answers: [
      { he: 'משפך', en: 'Watering can' },
      { he: 'מטאטא', en: 'Broom' }
    ],
    correctIndex: 0,
    successHe: 'בדיוק! בוחרים במשפך ולוחצים על העציץ.',
    successEn: 'Exactly! Select the watering can, then tap the plant.',
    retryHe: 'העציץ צריך מים. חפשו את המשפך ונסו שוב.',
    retryEn: 'The plant needs water. Look for the watering can and try again.'
  },
  2: {
    he: 'עוד פינות נקיות בבית',
    en: 'More clean corners in the house',
    icons: ['broom', 'dust', 'water'],
    steps: [
      { he: 'ממשיכים להשקות את העציצים כשהם זוהרים.', en: 'Keep watering the plants when they glow.' },
      { he: 'כשמופיע אבק, בוחרים מטאטא ולוחצים על ענן האבק. הכלי מתחלף מיד ביד.', en: 'When dust appears, select the broom and tap the dust cloud. The tool switches in hand instantly.' },
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
    retryHe: 'המשפך מיועד לעציצים. בשביל האבק בוחרים מטאטא.',
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
    question: { he: 'מה בוחרים כדי להבריח חתול?', en: 'What do you select to shoo a cat away?' },
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
    he: 'מישהו הגיע לאכול',
    en: 'Someone has come for a meal',
    icons: ['serve', 'water', 'broom'],
    steps: [
      { he: 'כשמגיע אורח, בוחרים בסמל האוכל במדף.', en: 'When a guest arrives, choose the Food icon on the shelf.' },
      { he: 'לוחצים על האורח. רותי ניגשת ומגישה לו אחד ממטעמי הבית.', en: 'Tap the guest. Ruti walks over and serves one of her homemade treats.' },
      { he: 'אין צורך לבחור מנה או להכין מתכון. ממשיכים לדאוג גם לבית.', en: 'There is no dish selection or recipe to prepare. Keep caring for the house too.' }
    ],
    question: { he: 'איך מגישים אוכל לאורח?', en: 'How do you feed a guest?' },
    answers: [
      { he: 'בוחרים אוכל ולוחצים על האורח', en: 'Choose Food and tap the guest' },
      { he: 'בוחרים מטאטא ולוחצים על האורח', en: 'Choose the broom and tap the guest' }
    ],
    correctIndex: 0,
    successHe: 'בדיוק! אוכל אחד, לחיצה על האורח, והרבה אהבה.',
    successEn: 'Exactly! One Food button, one tap on the guest, and plenty of love.',
    retryHe: 'המטאטא לאבק. לאורח בוחרים את סמל האוכל.',
    retryEn: 'The broom is for dust. Choose the Food icon for a guest.'
  },
  6: {
    he: 'אף אחד לא יוצא מכאן רעב',
    en: 'Nobody leaves hungry',
    icons: ['serve', 'hand'],
    steps: [
      { he: 'ממשיכים להשקות, לנקות ולשמור על הדלתות.', en: 'Keep watering, cleaning and watching the doors.' },
      { he: 'כדי להגיש ארוחה, בוחרים אוכל ולוחצים ישירות על האורח.', en: 'To serve a meal, choose Food and tap the guest directly.' },
      { he: 'רותי בוחרת בעצמה אחד מהמטעמים. אירוח נותן הכי הרבה נקודות.', en: 'Ruti chooses a homemade treat herself. Feeding guests earns the most points.' }
    ],
    question: { he: 'צריך לבחור מנה במטבח לפני ההגשה?', en: 'Do you need to choose a kitchen dish before serving?' },
    answers: [
      { he: 'לא — אוכל, ואז לחיצה על האורח', en: 'No — choose Food, then tap the guest' },
      { he: 'כן — צריך לבחור מנה ולבשל אותה', en: 'Yes — choose a dish and cook it' }
    ],
    correctIndex: 0,
    successHe: 'נכון! רותי כבר דואגת למטעמים.',
    successEn: 'Right! Ruti takes care of the homemade treats.',
    retryHe: 'הפעם ההגשה פשוטה: אוכל, ואז האורח.',
    retryEn: 'Serving is simple: Food, then the guest.'
  },
  7: {
    he: 'בית מלא משפחה',
    en: 'A house full of family',
    icons: ['serve', 'water', 'broom', 'hand'],
    steps: [
      { he: 'נשארים עם אותם ארבעה כלים: משפך, מטאטא, יד ואוכל.', en: 'Keep using the same four tools: watering can, broom, hand and Food.' },
      { he: 'הבית נעשה עמוס יותר. שמים לב לטיפות, לשעונים ולדלתות.', en: 'The house gets busier. Watch the water drops, timers and doors.' },
      { he: 'אורח מקבל אוכל בלחיצה אחת אחרי שבוחרים בסמל האוכל.', en: 'A guest receives a meal with one tap after you choose the Food icon.' }
    ],
    question: { he: 'מה עושים כשמגיע אורח?', en: 'What do you do when a guest arrives?' },
    answers: [
      { he: 'בוחרים אוכל ולוחצים עליו', en: 'Choose Food and tap the guest' },
      { he: 'משקים אותו במשפך', en: 'Water the guest with the watering can' }
    ],
    correctIndex: 0,
    successHe: 'נכון! הבית מלא, והכלים נשארים פשוטים.',
    successEn: 'Right! A full house, with the same simple tools.',
    retryHe: 'המשפך לעציצים. לאורח מגישים אוכל.',
    retryEn: 'The watering can is for plants. Serve Food to a guest.'
  }
});
