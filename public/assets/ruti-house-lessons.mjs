// Shown immediately before a new activity is introduced, after the home screen.
// Familiar faster rounds (2 and 4) begin immediately, without repeating lessons.
// Stages 8–10 also build on familiar skills.
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
  3: {
    he: 'מי מחכה ליד הדלת?',
    en: 'Who is waiting by the door?',
    icons: ['hand', 'cat', 'water'],
    steps: [
      { he: 'ממשיכים להשקות ולטאטא, ושומרים על הכניסה הראשית ועל הדלת האחורית הקטנה.', en: 'Keep watering and sweeping, and watch the main entrance and the small back door.' },
      { he: 'כשרואים חתול, בוחרים את היד עם הכיתוב ״לכו מפה״.', en: 'When a cat appears, choose the hand marked “Shoo!”.' },
      { he: 'החתולים מתגנבים לאט. לוחצים על החתול עם היד כדי להבריח אותו. שלושה חתולים שנכנסו מסיימים את המשחק.', en: 'The cats sneak in slowly. Choose the hand and tap a cat to shoo it away. Three cats inside end the game.' }
    ],
    question: { he: 'מה בוחרים כדי להבריח חתול?', en: 'What do you select to shoo a cat away?' },
    answers: [
      { he: 'היד של ״לכו מפה״', en: 'The “Shoo!” hand' },
      { he: 'מגש אוכל', en: 'Serving tray' }
    ],
    correctIndex: 0,
    successHe: 'לכו מפה! עכשיו יודעים לשמור על הדלת.',
    successEn: 'Shoo! Now you know how to guard the door.',
    retryHe: 'את המגש שומרים למשפחה. חתולים מבריחים עם היד.',
    retryEn: 'Save the tray for the family. Shoo cats away with the hand.'
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
