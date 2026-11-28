const key = name => String(name ?? '').normalize('NFKD').replace(/[\u0591-\u05c7'"׳״]/g,'').replace(/\s+/g,' ').trim().toLowerCase();
const names = person => [person.name,person.nameEn,person.label,...(person.aliases || [])].filter(Boolean).map(key);

export function taggedPeople(tags) {
  const ids = new Set(), allNames = new Set(), freeNames = new Set();
  for (const tag of tags) {
    const id = tag.personId || tag.id;
    if (id) ids.add(id);
    for (const name of names(tag)) {
      allNames.add(name);
      if (!id || tag.draftName || tag.isNew) freeNames.add(name);
    }
  }
  return {
    has(person) {
      const id = person.personId || person.id;
      // Identified relatives can share a name. Only a free-text tag needs
      // to be matched to a roster profile by its spelling.
      return (id && ids.has(id)) || names(person).some(name => (id ? freeNames : allNames).has(name));
    }
  };
}

export function tagChoices(found,tags,query,limit = 50) {
  const selected = taggedPeople(tags), name = key(query);
  const people = found.filter(person => !selected.has(person)).slice(0,limit);
  const matchesTag = person => person.searchRank < 1 || names(person).includes(name) ||
    (selected.has(person) && (person.searchRank < 5 || names(person).some(alias => alias.includes(name))));
  return {people,canAddName:Boolean(name) && !selected.has({name}) && !found.some(matchesTag)};
}
