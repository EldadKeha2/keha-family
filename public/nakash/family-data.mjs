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
  ['roni-medina', 'רוני מדינה', 'Roni Medina', 'm', 'u-nakash-roni'],
  ['leah-medina', 'לאה', 'Leah', 'f', 'u-nakash-roni'],
  ['naomi-malkhi', 'נעמי מלכי', 'Naomi Malkhi', 'f', 'u-nakash-naomi'],
  ['shalom-malkhi', 'שלום מלכי', 'Shalom Malkhi', 'm', 'u-nakash-naomi'],
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
  ['u-nakash-medina', ['ruma-nakash', 'joseph-medina'], ['u-nakash-roni'], ROOT_UNIT],
  ['u-root', ['yona', 'shlomo'], [], ROOT_UNIT],
  ['u-nakash-yehuda', ['yehuda-nakash', 'zehor'], ['u-nakash-naomi'], ROOT_UNIT],
  ['u-nakash-haim', ['haim-nakash', 'shoshana'], ['u-nakash-doron', 'u-nakash-yossi', 'u-nakash-yona', 'u-nakash-avner', 'u-nakash-alona'], ROOT_UNIT],
  ['u-nakash-roni', ['roni-medina', 'leah-medina'], [], 'u-nakash-medina', 'former'],
  ['u-nakash-naomi', ['naomi-malkhi', 'shalom-malkhi'], [], 'u-nakash-yehuda'],
  ['u-nakash-avner', ['avner-nakash', 'rivka-nakash'], [], 'u-nakash-haim'],
  ['u-nakash-doron', ['doron-nir', 'dvora-nir'], [], 'u-nakash-haim'],
  ['u-nakash-yossi', ['yossi-nakash'], [], 'u-nakash-haim'],
  ['u-nakash-yona', ['yona-yaakobi', 'david-yaakobi'], [], 'u-nakash-haim'],
  ['u-nakash-alona', ['alona-shai', 'yaakov-shai'], [], 'u-nakash-haim'],
];

export function createFamily(keha = {}) {
  const people = Object.assign(Object.create(null), Object.fromEntries(PEOPLE.map(([id, name, englishName, gender, unit, aliases, details]) => [id, {id, name, englishName, gender, unit, aliases, ...details}])));
  const units = Object.assign(Object.create(null), Object.fromEntries(UNITS.map(([id, members, children, parent = null, relationship = 'spouse']) => [id, {id, people: [...members], children: [...children], parent, relationship}])));

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
