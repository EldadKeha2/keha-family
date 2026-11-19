import {branchForPerson, findPeople} from './family-data.mjs';

function element(doc, tag, className, content) {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (content) node.textContent = content;
  return node;
}

function anchor(doc, href, className, label) {
  const link = element(doc, 'a', className, label);
  link.href = href;
  return link;
}

function branchAccent(node, branch) {
  if (branch) node.style.setProperty('--nk-family', branch.color);
  return node;
}

function portrait(doc, person) {
  const mark = person.name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => Array.from(part)[0]).join('');
  const badge = element(doc, 'span', 'nk-monogram', mark);
  badge.setAttribute('aria-hidden', 'true');
  return badge;
}

function personLink(doc, person, linkPerson, description) {
  const link = anchor(doc, linkPerson(person.id), 'nk-person-link');
  link.append(portrait(doc, person), element(doc, 'strong', 'nk-person-name', person.name));
  if (description) link.append(element(doc, 'span', 'nk-person-context', description));
  return link;
}

function couple(doc, family, unit, linkPerson, branch) {
  const box = branchAccent(element(doc, 'div', 'nk-couple'), branch);
  for (const id of unit.people) box.append(personLink(doc, family.people[id], linkPerson));
  if (unit.people.length > 1) {
    const former = unit.relationship === 'former';
    const status = element(doc, 'span', `nk-union${former ? ' nk-former' : ''}`, former ? 'גרושים' : '◇');
    if (!former) status.setAttribute('aria-hidden', 'true');
    box.append(status);
  }
  return box;
}

function branchNav(doc, family, selected, linkTree) {
  const nav = element(doc, 'nav', 'nk-tree-nav');
  nav.setAttribute('aria-label', 'ענפי אילן היוחסין');
  for (const branch of [{id: null, label: 'כל המשפחה'}, ...family.branches]) {
    const link = branchAccent(anchor(doc, linkTree(branch.id), 'nk-branch-nav-link', branch.label), branch.color ? branch : null);
    if (branch.id === selected) link.setAttribute('aria-current', 'page');
    nav.append(link);
  }
  return nav;
}

function descendant(doc, family, unit, linkPerson, branch, depth) {
  const item = element(doc, 'li', 'nk-descendant');
  item.append(couple(doc, family, unit, linkPerson, branch));
  if (unit.children.length) {
    const more = element(doc, 'details', 'nk-descendant-details');
    more.open = depth === 0 && unit.children.length <= 3;
    more.append(element(doc, 'summary', 'nk-descendant-summary', 'לדורות הבאים'));
    const children = element(doc, 'ul', 'nk-descendant-list');
    for (const id of unit.children) children.append(descendant(doc, family, family.units[id], linkPerson, branch, depth + 1));
    more.append(children);
    item.append(more);
  }
  return item;
}

export function renderTree(container, {family, branch = null, linkPerson, linkTree}) {
  const doc = container.ownerDocument;
  const selected = family.branches.find(item => item.id === branch);
  const unit = family.units[selected?.unit || family.root];
  const layout = branchAccent(element(doc, 'section', 'nk-tree'), selected);
  const title = element(doc, 'h1', 'nk-view-title', selected ? `אילן היוחסין של ${selected.label}` : 'אילן היוחסין של משפחת נקאש');
  layout.append(title, branchNav(doc, family, selected?.id || null, linkTree));

  const chart = element(doc, 'div', 'nk-chart');
  chart.append(couple(doc, family, unit, linkPerson, selected));
  if (!selected) {
    const list = element(doc, 'ul', 'nk-overview-branches');
    for (const familyBranch of family.branches) {
      const item = branchAccent(element(doc, 'li', 'nk-overview-branch'), familyBranch);
      item.append(couple(doc, family, family.units[familyBranch.unit], linkPerson, familyBranch));
      item.append(anchor(doc, linkTree(familyBranch.id), 'nk-branch-open', familyBranch.label));
      list.append(item);
    }
    chart.append(list);
  } else if (unit.children.length) {
    const list = element(doc, 'ul', 'nk-tree-generation');
    for (const id of unit.children) list.append(descendant(doc, family, family.units[id], linkPerson, selected, 0));
    chart.append(list);
  }
  layout.append(chart);
  container.replaceChildren(layout);
  return layout;
}

export function renderDirectory(container, {family, linkPerson, query = '', branch = null}) {
  const doc = container.ownerDocument;
  const directory = element(doc, 'section', 'nk-directory');
  const people = findPeople(family, query, branch);
  directory.append(element(doc, 'h1', 'nk-view-title', query.trim() ? 'תוצאות חיפוש' : 'בני המשפחה'));
  if (!people.length) {
    directory.append(element(doc, 'p', 'nk-empty', 'לא נמצאו שמות מתאימים.'));
  } else {
    const list = element(doc, 'ul', 'nk-directory-grid');
    for (const person of people) {
      const familyBranch = family.branches.find(item => item.id === branchForPerson(family, person.id));
      const item = branchAccent(element(doc, 'li', 'nk-directory-card'), familyBranch);
      item.append(personLink(doc, person, linkPerson, familyBranch?.label || 'משפחת נקאש'));
      list.append(item);
    }
    directory.append(list);
  }
  container.replaceChildren(directory);
  return directory;
}

export function renderProfile(container, {family, id, linkPerson, linkTree}) {
  const doc = container.ownerDocument;
  const person = Object.hasOwn(family.people, id) ? family.people[id] : null;
  if (!person) return false;
  const familyBranch = family.branches.find(item => item.id === branchForPerson(family, id));
  const unit = family.units[person.unit];
  const parent = unit.people[0] === id ? family.units[unit.parent] : null;
  const profile = branchAccent(element(doc, 'article', 'nk-family-profile'), familyBranch);
  const header = element(doc, 'header', 'nk-profile-header');
  header.append(portrait(doc, person), element(doc, 'h1', 'nk-view-title', person.name));
  if (person.englishName) {
    const englishName = element(doc, 'p', 'nk-profile-english', person.englishName);
    englishName.lang = 'en';
    englishName.dir = 'ltr';
    header.append(englishName);
  }
  if (person.deceased) header.append(element(doc, 'span', 'nk-person-context', 'ז״ל'));
  const branchLink = anchor(doc, linkTree(familyBranch?.id || null), 'nk-branch-open', familyBranch?.label || 'אילן היוחסין של משפחת נקאש');
  header.append(branchLink);
  profile.append(header);

  const relations = [
    [unit.relationship === 'former' ? 'בני זוג לשעבר' : 'בני זוג', unit.people.filter(relative => relative !== id)],
    ['הורים', parent?.people || []],
    ['אחים ואחיות', parent?.children.filter(child => child !== unit.id).map(child => family.units[child].people[0]) || []],
    ['ילדים', unit.children.map(child => family.units[child].people[0])],
  ];
  for (const [label, relatives] of relations) {
    if (!relatives.length) continue;
    const group = element(doc, 'section', 'nk-profile-relation');
    group.append(element(doc, 'h2', 'nk-relation-title', label));
    const list = element(doc, 'ul', 'nk-relatives');
    for (const relative of relatives) {
      const item = element(doc, 'li', 'nk-relative');
      item.append(personLink(doc, family.people[relative], linkPerson));
      list.append(item);
    }
    group.append(list);
    profile.append(group);
  }
  if (unit.relationship === 'former' && unit.id === 'u-nakash-roni') {
    profile.append(element(doc, 'p', 'nk-profile-note', 'לרוני ולאה אין ילדים משותפים.'));
  }
  container.replaceChildren(profile);
  return profile;
}
