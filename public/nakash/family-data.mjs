export const ROOT_UNIT = 'u-nakash-root';

export const BRANCHES = Object.freeze([
  {id: 'medina', label: 'משפחת מדינה', shortLabel: 'מדינה', unit: 'u-nakash-medina', color: '#9b561f', mark: '◆'},
  {id: 'keha', label: 'משפחת קהא', shortLabel: 'קהא', unit: 'u-root', color: '#536641', mark: '❖'},
  {id: 'yehuda', label: 'משפחת נקאש (יהודה)', shortLabel: 'נקאש (יהודה)', unit: 'u-nakash-yehuda', color: '#715477', mark: '✦'},
  {id: 'haim', label: 'משפחת נקאש (חיים)', shortLabel: 'נקאש (חיים)', unit: 'u-nakash-haim', color: '#366d69', mark: '✧'},
].map(Object.freeze));

const PEOPLE = [
  ['margalit-nakash', 'מרגלית נקאש (לולוה)', 'Margalit Lulva Nakash', 'f', ROOT_UNIT,
    ['מרגלית נקאש', 'מרגלית לולווה נקאש', 'מרגלית לולוה נקאש', 'מרגלית נקאש (לולווה)', 'Margalit Nakash'],
    {sharedProfileId: 'extra-3051638a17004175b329422f'}],
  ['zecharia-nakash', 'זכריה נקאש', 'Zecharia Nakash', 'm', ROOT_UNIT],
  ['ruma-nakash', 'רומה מדינה', 'Roma Medina', 'f', 'u-nakash-medina', ['רומה נקאש', 'Roma Nakash', 'Ruma Nakash', 'Ruma Medina']],
  ['joseph-medina', 'יוסף מדינה', 'Joseph Medina', 'm', 'u-nakash-medina'],
  ['yona', 'יונה נקאש קהא', 'Yona Nakash Keha', 'f', 'u-root', ['יונה נקאש', 'Yona Nakash']],
  ['shlomo', 'שלמה קהא', 'Shlomo Keha', 'm', 'u-root'],
  ['yehuda-nakash', 'יהודה נקאש', 'Yehuda Nakash', 'm', 'u-nakash-yehuda'],
  ['zehor', 'זהור', 'Zehor', 'f', 'u-nakash-yehuda'],
  ['haim-nakash', 'חיים נקאש', 'Haim Nakash', 'm', 'u-nakash-haim', ['Chaim Nakash']],
  ['shoshana', 'שושנה', 'Shoshana', 'f', 'u-nakash-haim'],
  ['roni-medina', 'רוני מדינה', 'Roni Medina', 'm', 'u-nakash-roni', [], {notes: 'ללא ילדים'}],
  ['leah-medina', 'לאה מדינה', 'Leah Medina', 'f', 'u-nakash-roni'],
  ['shoshana-melamed', 'שושנה מלמד', 'Shoshana Melamed', 'f', 'u-nakash-shoshana', ['שושי', 'שושי מלמד', 'שושנה מדינה', 'שושי מדינה', 'Shoshi Melamed']],
  ['tzvika-melamed', 'צביקה מלמד', 'Tzvika Melamed', 'm', 'u-nakash-shoshana'],
  ['yoni-gueta', 'יוני גואטה', 'Yoni Gueta', 'f', 'u-nakash-yoni', ['יוני מדינה', 'Yoni Medina']],
  ['aharon-gueta', 'אהרון גואטה', 'Aharon Gueta', 'm', 'u-nakash-yoni'],
  ['yair-medina', 'יאיר מדינה', 'Yair Medina', 'm', 'u-nakash-yair'],
  ['yair-medina-wife', 'יעל', 'Yael', 'f', 'u-nakash-yair'],
  ['avrahumi-medina', 'אברהומי מדינה', 'Avrahumi Medina', 'm', 'u-nakash-avrahumi', [], {deceased: true, notes: 'ללא ילדים'}],
  ['naomi-malkhi', 'נעמי מלכי', 'Naomi Malkhi', 'f', 'u-nakash-naomi'],
  ['shalom-malkhi', 'שלום מלכי', 'Shalom Malkhi', 'm', 'u-nakash-naomi'],
  ['ofir-malkhi', 'אופיר מלכי', 'Ofir Malkhi', '', 'u-nakash-ofir-malkhi'],
  ['ravit-malkhi', 'רוית מלכי', 'Ravit Malkhi', 'f', 'u-nakash-ravit-malkhi'],
  ['golan-malkhi', 'גולן מלכי', 'Golan Malkhi', 'm', 'u-nakash-golan-malkhi'],
  ['yechiel-nakash', 'יחיאל נקאש', 'Yechiel Nakash', 'm', 'u-nakash-yechiel', ['Yehiel Nakash'], {deceased: true}],
  ['claudia-nakash', 'קלאודיה נקאש', 'Claudia Nakash', 'f', 'u-nakash-yechiel'],
  ['natalia-nakash', 'נטליה נקאש', 'Natalia Nakash', 'f', 'u-nakash-natalia'],
  ['talia-nakash', 'טליה נקאש', 'Talia Nakash', 'f', 'u-nakash-talia'],
  ['michel-nakash', 'מישל נקאש', 'Michel Nakash', '', 'u-nakash-michel'],
  ['moshe-nakash', 'משה נקאש', 'Moshe Nakash', 'm', 'u-nakash-moshe'],
  ['eti-nakash', 'אתי נקאש', 'Eti Nakash', 'f', 'u-nakash-moshe'],
  ['yehuda-moshe-nakash', 'יהודה נקאש', 'Yehuda Nakash', 'm', 'u-nakash-yehuda-moshe'],
  ['keren-nakash', 'קרן נקאש', 'Keren Nakash', 'f', 'u-nakash-keren'],
  ['yigal-nakash', 'יגאל נקאש', 'Yigal Nakash', 'm', 'u-nakash-yigal'],
  ['sara-nakash', 'שרה נקאש', 'Sara Nakash', 'f', 'u-nakash-yigal'],
  ['sharon-nakash', 'שרון נקאש', 'Sharon Nakash', '', 'u-nakash-sharon'],
  ['anati-nakash', 'ענתי נקאש', 'Anati Nakash', 'f', 'u-nakash-anati'],
  ['dror-nakash', 'דרור נקאש', 'Dror Nakash', 'm', 'u-nakash-dror'],
  ['margalit-rajwan', "מרגלית רג'ואן", 'Margalit Rajwan', 'f', 'u-nakash-margalit-rajwan'],
  ['yehoram-rajwan', "יהורם רג'ואן", 'Yehoram Rajwan', 'm', 'u-nakash-margalit-rajwan'],
  ['eyal-rajwan', "אייל רג'ואן", 'Eyal Rajwan', 'm', 'u-nakash-eyal-rajwan'],
  ['ohad-rajwan', "אוהד רג'ואן", 'Ohad Rajwan', 'm', 'u-nakash-ohad-rajwan'],
  ['hila-rajwan', "הילה רג'ואן", 'Hila Rajwan', 'f', 'u-nakash-hila-rajwan'],
  ['ortal-rajwan', "אורטל רג'ואן", 'Ortal Rajwan', '', 'u-nakash-ortal-rajwan'],
  ['yifat-handels', 'יפעת הנדלס', 'Yifat Handels', 'f', 'u-nakash-yifat'],
  ['mark-handels', 'מארק הנדלס', 'Mark Handels', 'm', 'u-nakash-yifat'],
  ['shani-handels', 'שני הנדלס', 'Shani Handels', '', 'u-nakash-shani-handels'],
  ['shnir-haim-handels', 'שניר חיים הנדלס', 'Shnir Haim Handels', 'm', 'u-nakash-shnir-haim', [], {firstName: 'שניר חיים', lastName: 'הנדלס'}],
  ['elior-handels', 'אליאור הנדלס', 'Elior Handels', '', 'u-nakash-elior-handels'],
  ['rafi-nakash', 'רפאל (רפי) נקאש', 'Rafael (Rafi) Nakash', 'm', 'u-nakash-rafi', ['רפי נקאש', 'רפאל נקאש', 'Rafi Nakash', 'Rafael Nakash']],
  ['ahuva-nakash', 'אהובה נקאש', 'Ahuva Nakash', 'f', 'u-nakash-rafi'],
  ['orly-nakash', 'אורלי נקאש', 'Orly Nakash', 'f', 'u-nakash-rafi'],
  ['tomer-nakash', 'תומר נקאש', 'Tomer Nakash', '', 'u-nakash-tomer'],
  ['zohar-nakash', 'זוהר נקאש', 'Zohar Nakash', '', 'u-nakash-zohar'],
  ['dana-nakash', 'דנה נקאש', 'Dana Nakash', 'f', 'u-nakash-dana'],
  ['avner-nakash', 'אבנר נקאש', 'Avner Nakash', 'm', 'u-nakash-avner'],
  ['rivka-nakash', 'רבקה נקאש', 'Rivka Nakash', 'f', 'u-nakash-avner'],
  ['avner-former-wife', 'אמה של מור', "Mor's mother", 'f', 'u-nakash-avner', [], {placeholder:true}],
  // Retain IDs from the first diagram transcription so existing portraits,
  // dates and tags stay attached when the displayed names are corrected.
  ['doron-nir', 'ציון ניר', 'Zion Nir', 'm', 'u-nakash-doron', ['ציון נקאש', 'Tzion Nir', 'Zion Nakash']],
  ['dvora-nir', 'דבורה', 'Dvora', 'f', 'u-nakash-doron'],
  ['gonen-nir', 'גונן ניר', 'Gonen Nir', 'm', 'u-nakash-gonen'],
  ['yael-nir', 'יעל ניר', 'Yael Nir', 'f', 'u-nakash-gonen'],
  ['amit-nir', 'עמית ניר', 'Amit Nir', '', 'u-nakash-amit-nir'],
  ['omer-nir', 'עומר ניר', 'Omer Nir', '', 'u-nakash-omer-nir'],
  ['ofer-nir', 'עופר ניר', 'Ofer Nir', 'm', 'u-nakash-ofer'],
  ['dalit-nir', 'דלית ניר', 'Dalit Nir', 'f', 'u-nakash-dalit'],
  ['baruch-gaz', 'ברוך גז', 'Baruch Gaz', 'm', 'u-nakash-dalit'],
  ['itai-gaz', 'איתי גז', 'Itai Gaz', 'm', 'u-nakash-itai-gaz'],
  ['yuli-gaz', 'יולי גז', 'Yuli Gaz', '', 'u-nakash-yuli-gaz'],
  ['yossi-nakash', 'יוסי נקאש', 'Yossi Nakash', 'm', 'u-nakash-yossi', [], {notes:'רווק', notesEn:'Single'}],
  ['yona-yaakobi', 'יונה יעקבי', 'Yona Yaakobi', 'f', 'u-nakash-yona', ['יונה נקאש יעקבי']],
  ['david-yaakobi', 'דוד יעקבי', 'David Yaakobi', 'm', 'u-nakash-yona', [], {deceased:true}],
  ['odelia-yaakobi', 'אודליה יעקבי', 'Odelia Yaakobi', 'f', 'u-nakash-odelia'],
  ['mor-pazarkar', 'מור פזרקר', 'Mor Pazarkar', 'f', 'u-nakash-mor', ['מור נקאש', 'Mor Nakash']],
  ['hen-pazarkar', 'חן פזרקר', 'Hen Pazarkar', 'm', 'u-nakash-mor'],
  ['noam-pazarkar', 'נעם פזרקר', 'Noam Pazarkar', 'm', 'u-nakash-noam-pazarkar'],
  ['michal-pazarkar', 'מיכל פזרקר', 'Michal Pazarkar', 'f', 'u-nakash-michal-pazarkar'],
  ['shira-pazarkar', 'שירה פזרקר', 'Shira Pazarkar', 'f', 'u-nakash-shira-pazarkar'],
  ['eliya-nakash', 'אליה נקאש', 'Eliya Nakash', '', 'u-nakash-eliya'],
  ['neriya-nakash', 'נריה נקאש', 'Neriya Nakash', 'm', 'u-nakash-neriya', ['נרי נקאש', 'נרי', 'Neri Nakash']],
  ['tohar-nakash', 'טוהר', 'Tohar', 'f', 'u-nakash-neriya'],
  ['alona-shai', 'אילנה שי', 'Ilana Shai', 'f', 'u-nakash-alona', ['אילנה נקאש', 'Ilana Nakash']],
  ['yaakov-shai', 'יעקב שי', 'Yaakov Shai', 'm', 'u-nakash-alona'],
  ['gil-shai', 'גיל שי', 'Gil Shai', '', 'u-nakash-gil-shai'],
  ['vered-mualem', 'ורד מועלם', 'Vered Mualem', 'f', 'u-nakash-vered', ['ורד שי', 'Vered Shai']],
  ['ron-mualem', 'רון מועלם', 'Ron Mualem', 'm', 'u-nakash-vered'],
  ['ben-mualem', 'בן מועלם', 'Ben Mualem', 'm', 'u-nakash-ben-mualem'],
  ['tal-mualem', 'טל מועלם', 'Tal Mualem', 'f', 'u-nakash-tal-mualem'],
  ['omer-mualem', 'עומר מועלם', 'Omer Mualem', 'm', 'u-nakash-omer-mualem'],
];

const UNITS = [
  [ROOT_UNIT, ['margalit-nakash', 'zecharia-nakash'], BRANCHES.map(branch => branch.unit)],
  ['u-nakash-medina', ['ruma-nakash', 'joseph-medina'], ['u-nakash-roni', 'u-nakash-shoshana', 'u-nakash-yoni', 'u-nakash-yair', 'u-nakash-avrahumi'], ROOT_UNIT],
  ['u-root', ['yona', 'shlomo'], [], ROOT_UNIT],
  ['u-nakash-yehuda', ['yehuda-nakash', 'zehor'], ['u-nakash-naomi', 'u-nakash-yechiel', 'u-nakash-moshe', 'u-nakash-yigal', 'u-nakash-margalit-rajwan', 'u-nakash-yifat', 'u-nakash-rafi'], ROOT_UNIT],
  ['u-nakash-haim', ['haim-nakash', 'shoshana'], ['u-nakash-doron', 'u-nakash-yossi', 'u-nakash-yona', 'u-nakash-avner', 'u-nakash-alona'], ROOT_UNIT],
  ['u-nakash-roni', ['roni-medina', 'leah-medina'], [], 'u-nakash-medina', 'former'],
  // Shoshana, Yoni and Yair's children will be supplied later.
  // Roni and Avrahumi have no children.
  ['u-nakash-shoshana', ['shoshana-melamed', 'tzvika-melamed'], [], 'u-nakash-medina'],
  ['u-nakash-yoni', ['yoni-gueta', 'aharon-gueta'], [], 'u-nakash-medina'],
  ['u-nakash-yair', ['yair-medina', 'yair-medina-wife'], [], 'u-nakash-medina'],
  ['u-nakash-avrahumi', ['avrahumi-medina'], [], 'u-nakash-medina'],
  ['u-nakash-naomi', ['naomi-malkhi', 'shalom-malkhi'], ['u-nakash-ofir-malkhi', 'u-nakash-ravit-malkhi', 'u-nakash-golan-malkhi'], 'u-nakash-yehuda'],
  ['u-nakash-ofir-malkhi', ['ofir-malkhi'], [], 'u-nakash-naomi'],
  ['u-nakash-ravit-malkhi', ['ravit-malkhi'], [], 'u-nakash-naomi'],
  ['u-nakash-golan-malkhi', ['golan-malkhi'], [], 'u-nakash-naomi'],
  ['u-nakash-yechiel', ['yechiel-nakash', 'claudia-nakash'], ['u-nakash-natalia', 'u-nakash-talia', 'u-nakash-michel'], 'u-nakash-yehuda'],
  ['u-nakash-natalia', ['natalia-nakash'], [], 'u-nakash-yechiel'],
  ['u-nakash-talia', ['talia-nakash'], [], 'u-nakash-yechiel'],
  ['u-nakash-michel', ['michel-nakash'], [], 'u-nakash-yechiel'],
  ['u-nakash-moshe', ['moshe-nakash', 'eti-nakash'], ['u-nakash-yehuda-moshe', 'u-nakash-keren'], 'u-nakash-yehuda'],
  ['u-nakash-yehuda-moshe', ['yehuda-moshe-nakash'], [], 'u-nakash-moshe'],
  ['u-nakash-keren', ['keren-nakash'], [], 'u-nakash-moshe'],
  ['u-nakash-yigal', ['yigal-nakash', 'sara-nakash'], ['u-nakash-sharon', 'u-nakash-anati', 'u-nakash-dror'], 'u-nakash-yehuda'],
  ['u-nakash-sharon', ['sharon-nakash'], [], 'u-nakash-yigal'],
  ['u-nakash-anati', ['anati-nakash'], [], 'u-nakash-yigal'],
  ['u-nakash-dror', ['dror-nakash'], [], 'u-nakash-yigal'],
  ['u-nakash-margalit-rajwan', ['margalit-rajwan', 'yehoram-rajwan'], ['u-nakash-eyal-rajwan', 'u-nakash-ohad-rajwan', 'u-nakash-hila-rajwan', 'u-nakash-ortal-rajwan'], 'u-nakash-yehuda'],
  ['u-nakash-eyal-rajwan', ['eyal-rajwan'], [], 'u-nakash-margalit-rajwan'],
  ['u-nakash-ohad-rajwan', ['ohad-rajwan'], [], 'u-nakash-margalit-rajwan'],
  ['u-nakash-hila-rajwan', ['hila-rajwan'], [], 'u-nakash-margalit-rajwan'],
  ['u-nakash-ortal-rajwan', ['ortal-rajwan'], [], 'u-nakash-margalit-rajwan'],
  ['u-nakash-yifat', ['yifat-handels', 'mark-handels'], ['u-nakash-shani-handels', 'u-nakash-shnir-haim', 'u-nakash-elior-handels'], 'u-nakash-yehuda'],
  ['u-nakash-shani-handels', ['shani-handels'], [], 'u-nakash-yifat'],
  ['u-nakash-shnir-haim', ['shnir-haim-handels'], [], 'u-nakash-yifat'],
  ['u-nakash-elior-handels', ['elior-handels'], [], 'u-nakash-yifat'],
  // One descendant card, two distinct unions. Only the former union is the
  // parent of the three children; Orly is Rafi's current wife.
  ['u-nakash-rafi', ['rafi-nakash', 'ahuva-nakash', 'orly-nakash'], ['u-nakash-tomer', 'u-nakash-zohar', 'u-nakash-dana'], 'u-nakash-yehuda', 'spouse', {
    displayPeople: ['ahuva-nakash', 'rafi-nakash', 'orly-nakash'],
    relationships: [
      {people: ['rafi-nakash', 'ahuva-nakash'], relationship: 'former', children: ['u-nakash-tomer', 'u-nakash-zohar', 'u-nakash-dana'], label: 'גרושתו ואם ילדיו', labelEn: 'Ex-wife and mother of his children'},
      {people: ['rafi-nakash', 'orly-nakash'], relationship: 'spouse', children: [], label: 'אשתו כיום', labelEn: 'Current wife'},
    ],
  }],
  ['u-nakash-tomer', ['tomer-nakash'], [], 'u-nakash-rafi'],
  ['u-nakash-zohar', ['zohar-nakash'], [], 'u-nakash-rafi'],
  ['u-nakash-dana', ['dana-nakash'], [], 'u-nakash-rafi'],
  ['u-nakash-avner', ['avner-nakash', 'rivka-nakash', 'avner-former-wife'], ['u-nakash-mor', 'u-nakash-eliya', 'u-nakash-neriya'], 'u-nakash-haim', 'spouse', {
    displayPeople:['avner-former-wife', 'avner-nakash', 'rivka-nakash'],
    relationships:[
      {people:['avner-nakash', 'avner-former-wife'], relationship:'former', children:['u-nakash-mor'], label:'אשתו הקודמת ואמה של מור', labelEn:"Former wife and Mor's mother"},
      {people:['avner-nakash', 'rivka-nakash'], relationship:'spouse', children:['u-nakash-eliya', 'u-nakash-neriya'], label:'אשתו כיום', labelEn:'Current wife'},
    ],
  }],
  ['u-nakash-mor', ['mor-pazarkar', 'hen-pazarkar'], ['u-nakash-noam-pazarkar', 'u-nakash-michal-pazarkar', 'u-nakash-shira-pazarkar'], 'u-nakash-avner'],
  ['u-nakash-noam-pazarkar', ['noam-pazarkar'], [], 'u-nakash-mor'],
  ['u-nakash-michal-pazarkar', ['michal-pazarkar'], [], 'u-nakash-mor'],
  ['u-nakash-shira-pazarkar', ['shira-pazarkar'], [], 'u-nakash-mor'],
  ['u-nakash-eliya', ['eliya-nakash'], [], 'u-nakash-avner'],
  ['u-nakash-neriya', ['neriya-nakash', 'tohar-nakash'], [], 'u-nakash-avner'],
  ['u-nakash-doron', ['doron-nir', 'dvora-nir'], ['u-nakash-gonen', 'u-nakash-ofer', 'u-nakash-dalit'], 'u-nakash-haim'],
  ['u-nakash-gonen', ['gonen-nir', 'yael-nir'], ['u-nakash-amit-nir', 'u-nakash-omer-nir'], 'u-nakash-doron'],
  ['u-nakash-amit-nir', ['amit-nir'], [], 'u-nakash-gonen'],
  ['u-nakash-omer-nir', ['omer-nir'], [], 'u-nakash-gonen'],
  // Ofer's spouse and children's names still need clarification from the diagram.
  ['u-nakash-ofer', ['ofer-nir'], [], 'u-nakash-doron'],
  ['u-nakash-dalit', ['dalit-nir', 'baruch-gaz'], ['u-nakash-itai-gaz', 'u-nakash-yuli-gaz'], 'u-nakash-doron', 'former', {
    relationships: [{people:['dalit-nir', 'baruch-gaz'], relationship:'former', children:['u-nakash-itai-gaz', 'u-nakash-yuli-gaz'], label:'גרוש ואבי ילדיה', labelEn:'Ex-husband and father of her children'}],
  }],
  ['u-nakash-itai-gaz', ['itai-gaz'], [], 'u-nakash-dalit'],
  ['u-nakash-yuli-gaz', ['yuli-gaz'], [], 'u-nakash-dalit'],
  ['u-nakash-yossi', ['yossi-nakash'], [], 'u-nakash-haim', 'single'],
  ['u-nakash-yona', ['yona-yaakobi', 'david-yaakobi'], ['u-nakash-odelia'], 'u-nakash-haim'],
  ['u-nakash-odelia', ['odelia-yaakobi'], [], 'u-nakash-yona'],
  ['u-nakash-alona', ['alona-shai', 'yaakov-shai'], ['u-nakash-gil-shai', 'u-nakash-vered'], 'u-nakash-haim'],
  ['u-nakash-gil-shai', ['gil-shai'], [], 'u-nakash-alona'],
  ['u-nakash-vered', ['vered-mualem', 'ron-mualem'], ['u-nakash-ben-mualem', 'u-nakash-tal-mualem', 'u-nakash-omer-mualem'], 'u-nakash-alona'],
  ['u-nakash-ben-mualem', ['ben-mualem'], [], 'u-nakash-vered'],
  ['u-nakash-tal-mualem', ['tal-mualem'], [], 'u-nakash-vered'],
  ['u-nakash-omer-mualem', ['omer-mualem'], [], 'u-nakash-vered'],
];

export function createFamily(keha = {}) {
  const people = Object.assign(Object.create(null), Object.fromEntries(PEOPLE.map(([id, name, englishName, gender, unit, aliases, details = {}]) => [id, {...details, id, name, englishName, gender, unit, aliases}])));
  const units = Object.assign(Object.create(null), Object.fromEntries(UNITS.map(([id, members, children, parent = null, relationship = 'spouse', details = {}]) => [id, {...structuredClone(details), id, people: [...members], children: [...children], parent, relationship}])));

  // Read the existing Keha tree through its restricted projection. Traverse
  // only descendants of Yona and Shlomo, using the same identifiers for tags.
  const visited = new Set();
  function addKehaUnit(id, parent) {
    if (visited.has(id) || typeof id !== 'string') return false;
    visited.add(id);
    const unit = Object.hasOwn(keha.units || {}, id) ? keha.units[id] : null;
    if (!unit || (id !== 'u-root' && Object.hasOwn(units, id))) return false;
    const members = id === 'u-root' ? units[id].people : (Array.isArray(unit.people) ? unit.people : []);
    const included = members.filter(member => {
      if (typeof member !== 'string') return false;
      const person = Object.hasOwn(keha.people || {}, member) ? keha.people[member] : null;
      if (id === 'u-root' && !person) return true;
      if (!person || typeof person.name !== 'string' || !person.name.trim() || person.placeholder) return false;
      if (Object.hasOwn(people, member) && people[member].unit !== id) return false;
      people[member] = {
        ...people[member], id: member, unit: id, name: person.name,
        englishName: person.englishName || person.nameEn || people[member]?.englishName,
        gender: person.gender, deceased: person.deceased === true,
        ...(person.profile ? {profile:person.profile,profileFraming:person.profileFraming} : {}),
      };
      return true;
    });
    if (!included.length) return false;
    units[id] = {id, parent, people: included, children: [], relationship: unit.hasWedding === false || unit.relationship === 'partner' ? 'partner' : 'spouse'};
    for (const child of Array.isArray(unit.children) ? unit.children : []) {
      if (addKehaUnit(child, id)) units[id].children.push(child);
    }
    return true;
  }
  addKehaUnit('u-root', ROOT_UNIT);

  // Resolve a person already tagged on the original site to that existing ID.
  // Tree membership belongs to this tree; biography and media belong to the person.
  const identities = keha.identities || {};
  for (const [oldId, p] of Object.entries(people)) {
    const id = identities[oldId] || oldId, shared = keha.sharedPeople?.[id] || {};
    people[id] = {...p,...shared,id,unit:p.unit,gender:p.gender,deceased:shared.deceased ?? p.deceased,
      englishName:shared.nameEn || p.englishName,extra:false,extended:false,
      aliases:[...new Set([...(p.aliases || []),...(shared.aliases || [])])]};
    if(id !== oldId)delete people[oldId];
  }
  for(const unit of Object.values(units)){
    unit.people=unit.people.map(id=>identities[id] || id);
    if(unit.displayPeople)unit.displayPeople=unit.displayPeople.map(id=>identities[id] || id);
    for(const relationship of unit.relationships || [])relationship.people=relationship.people.map(id=>identities[id] || id);
  }

  const branchIds = new Map();
  for (const branch of BRANCHES) {
    const todo = [branch.unit];
    while (todo.length) {
      const unit = units[todo.pop()];
      for (const id of unit.people) branchIds.set(id, branch.id);
      todo.push(...unit.children);
    }
  }
  return {people, units, root: ROOT_UNIT, branches: BRANCHES, branchIds, identities};
}

export function branchForPerson(family, id) {
  return family.branchIds.get(id) || null;
}

const normalize = (value = '') => value.normalize('NFKD').replace(/[\u0591-\u05c7\u0300-\u036f'״׳’]/g, '').replace(/[-‐‑–]+/g, ' ').toLowerCase().trim();
const collator = new Intl.Collator('he', {sensitivity: 'base'});

export function findPeople(family, query = '', branch = null) {
  const normalized = normalize(query);
  const terms = normalized.split(/\s+/).filter(Boolean);
  return Object.values(family.people)
    .map(person => {
      const names = [person.name, person.englishName, ...(person.aliases || [])].map(normalize);
      const matches = terms.every(term => names.some(name => name.includes(term)));
      const rank = normalized && names.some(name => name === normalized) ? 0 : normalized && names.some(name => name.startsWith(normalized)) ? 1 : 2;
      return {person, matches, rank};
    })
    .filter(result => result.matches)
    .sort((a, b) => Number(Boolean(branch)&&branchForPerson(family,b.person.id)===branch)-Number(Boolean(branch)&&branchForPerson(family,a.person.id)===branch) || a.rank - b.rank || collator.compare(a.person.name, b.person.name))
    .map(result => result.person);
}
