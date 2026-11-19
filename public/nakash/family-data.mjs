export const ROOT_UNIT = 'u-nakash-root';

export const BRANCHES = Object.freeze([
  {id: 'medina', label: 'משפחת מדינה', shortLabel: 'מדינה', unit: 'u-nakash-medina', color: '#9b561f', mark: '◆'},
  {id: 'keha', label: 'משפחת קהא', shortLabel: 'קהא', unit: 'u-root', color: '#536641', mark: '❖'},
  {id: 'yehuda', label: 'משפחת נקאש (יהודה)', shortLabel: 'נקאש (יהודה)', unit: 'u-nakash-yehuda', color: '#715477', mark: '✦'},
  {id: 'haim', label: 'משפחת נקאש (חיים)', shortLabel: 'נקאש (חיים)', unit: 'u-nakash-haim', color: '#366d69', mark: '✧'},
].map(Object.freeze));

const PEOPLE = [
  ['margalit-nakash', 'מרגלית נקאש', 'Margalit Nakash', 'f', ROOT_UNIT],
  ['zecharia-nakash', 'זכריה נקאש', 'Zecharia Nakash', 'm', ROOT_UNIT],
  ['ruma-nakash', 'רומה נקאש', 'Ruma Nakash', 'f', 'u-nakash-medina'],
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
  ['yair-medina-wife', 'אשתו של יאיר', "Yair's wife", 'f', 'u-nakash-yair', [], {placeholder: true}],
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
  // Immediate family from Haim and Shoshana's handwritten diagram. Keep the
  // established Avner/Rivka IDs; the less legible descendant links need review.
  ['doron-nir', 'דורון ניר', 'Doron Nir', 'm', 'u-nakash-doron', ['דורון נקאש', 'Doron Nakash']],
  ['dvora-nir', 'דבורה', 'Dvora', 'f', 'u-nakash-doron'],
  ['yossi-nakash', 'יוסי נקאש', 'Yossi Nakash', 'm', 'u-nakash-yossi'],
  ['yona-yaakobi', 'יונה יעקבי', 'Yona Yaakobi', 'f', 'u-nakash-yona', ['יונה נקאש יעקבי']],
  ['david-yaakobi', 'דוד יעקבי', 'David Yaakobi', 'm', 'u-nakash-yona', [], {deceased:true}],
  ['alona-shai', 'אלונה', 'Alona', 'f', 'u-nakash-alona', ['אלונה שי', 'אלונה נקאש']],
  ['yaakov-shai', 'יעקב שי', 'Yaakov Shai', 'm', 'u-nakash-alona'],
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
  ['u-nakash-avner', ['avner-nakash', 'rivka-nakash'], [], 'u-nakash-haim'],
  ['u-nakash-doron', ['doron-nir', 'dvora-nir'], [], 'u-nakash-haim'],
  ['u-nakash-yossi', ['yossi-nakash'], [], 'u-nakash-haim'],
  ['u-nakash-yona', ['yona-yaakobi', 'david-yaakobi'], [], 'u-nakash-haim'],
  ['u-nakash-alona', ['alona-shai', 'yaakov-shai'], [], 'u-nakash-haim'],
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

  const branchIds = new Map();
  for (const branch of BRANCHES) {
    const todo = [branch.unit];
    while (todo.length) {
      const unit = units[todo.pop()];
      for (const id of unit.people) branchIds.set(id, branch.id);
      todo.push(...unit.children);
    }
  }
  return {people, units, root: ROOT_UNIT, branches: BRANCHES, branchIds};
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
    .filter(person => !branch || branchForPerson(family, person.id) === branch)
    .map(person => {
      const names = [person.name, person.englishName, ...(person.aliases || [])].map(normalize);
      const matches = terms.every(term => names.some(name => name.includes(term)));
      const rank = normalized && names.some(name => name === normalized) ? 0 : normalized && names.some(name => name.startsWith(normalized)) ? 1 : 2;
      return {person, matches, rank};
    })
    .filter(result => result.matches)
    .sort((a, b) => a.rank - b.rank || collator.compare(a.person.name, b.person.name))
    .map(result => result.person);
}
