// Shown immediately before a new activity is introduced, after the home screen.
// Familiar faster round (2) begin immediately, without repeating lessons.
// Stages 8–10 also build on familiar skills.
export const HOUSE_LESSONS = Object.freeze({
  1: {
    he: 'קודם, קצת מים לעציצים',
    en: 'First, a little water for the plants',
    icons: ['water', 'broom'],
    steps: [
      { he: 'לוחצים על המשפך למטה והוא מופיע מיד ביד של רותי.', en: 'Tap the watering can below and it appears in Ruti’s hand instantly.' },
      { he: 'לוחצים על העציץ הזוהר, ורותי ניגשת להשקות.', en: 'Tap the glowing plant and Ruti walks over to water it.' },
      { he: 'בבית ארבעה עציצים שונים. משלימים מטלות של השקיה וניקוי: מתחילים בנחת, ובהמשך מופיעים שעונים ובקשות חופפות. כשמופיע אבק, עוברים למטאטא.', en: 'There are four different plants. Complete watering and cleaning tasks: begin gently, then timers and overlapping requests appear. Switch to the broom when dust appears.' }
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
  4: {
    he:'אורה נכנסת לוויכוח',en:'Ora joins the argument',icons:['argue'],
    steps:[
      {he:'מעכשיו אורה עשויה להופיע בבית. סמל האיש שמתווכח נדלק כשהיא מופיעה.',en:'From now on, Ora may appear in the house. The arguing-person icon lights up when she appears.'},
      {he:'כדי לזכות ב־5,000 נקודות, לוחצים קודם על סמל האיש שמתווכח, ואז על אורה עצמה לפני שהיא נעלמת.',en:'To earn 5,000 points, first tap the arguing-person icon, then tap Ora herself before she disappears.'}
    ],
    question:{he:'איך מנצחים את אורה בוויכוח?',en:'How do you win the argument with Ora?'},
    answers:[{he:'סמל האיש שמתווכח, ואז הראש של אורה',en:'Arguing-person icon, then Ora’s head'},{he:'משפך, ואז אורה',en:'Watering can, then Ora'}],correctIndex:0,
    successHe:'בדיוק! הסמל ואז אורה, לפני שהיא נעלמת.',successEn:'Exactly! The icon, then Ora, before she disappears.',
    retryHe:'חפשו את סמל האיש שמתווכח. קודם הסמל, ואז אורה.',retryEn:'Look for the arguing-person icon. First the icon, then Ora.'
  },
  6: {
    he: 'מישהו הגיע לאכול',
    en: 'Someone has come for a meal',
    icons: ['serve', 'water', 'broom'],
    steps: [
      { he: 'אורחים מהמשפחה באים להתארח. בוחרים בסמל האוכל במדף.', en: 'Family guests come to visit. Choose the Food icon on the shelf.' },
      { he: 'לוחצים על האורח. רותי ניגשת ומגישה לו אחד ממטעמי הבית.', en: 'Tap the guest. Ruti walks over and serves one of her homemade treats.' }
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
  7: {
    he: 'בית מלא משפחה',
    en: 'A house full of family',
    icons: ['serve', 'water', 'broom', 'hand'],
    steps: [
      { he: 'ממשיכים עם משפך, מטאטא, יד ואוכל.', en: 'Keep using the watering can, broom, hand and Food.' },
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
  },
  11: {
    he:'מכירים את האורחים?',en:'Do you recognize the guests?',icons:['serve','peanuts'],
    steps:[
      {he:'עכשיו מגיעים גם אורחים אחרים. הם דומים לבני המשפחה, אז מסתכלים היטב על הפנים.',en:'Other visitors now arrive too. They resemble the family, so look carefully at their faces.'},
      {he:'לאורחים מהמשפחה מגישים אוכל עם סמל המגש. לכל אורח אחר מגישים בוטנים עם סמל הקערה.',en:'Serve family guests Food with the tray icon. Give every other visitor Peanuts with the bowl icon.'},
      {he:'הסמלים נשארים במקום הקבוע שלהם. בוחרים בכיבוד המתאים ואז לוחצים על האורח.',en:'The icons keep their fixed positions. Choose the matching refreshment, then tap the visitor.'}
    ],
    question:{he:'מה מגישים לאורח שאינו מהמשפחה?',en:'What do you serve a visitor who is not family?'},
    answers:[{he:'בוטנים',en:'Peanuts'},{he:'ארוחה מהמטבח',en:'A homemade meal'}],correctIndex:0,
    successHe:'נכון! אוכל למשפחה, בוטנים לאורחים האחרים.',successEn:'Right! Food for family, peanuts for other visitors.',
    retryHe:'את הארוחות שומרים למשפחה. אורחים אחרים מקבלים בוטנים.',retryEn:'Homemade meals are for family. Other visitors get peanuts.'
  }
});
