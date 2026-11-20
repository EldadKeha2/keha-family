import family from './family.mjs';
import {createFamily, branchForPerson} from '../public/nakash/family-data.mjs';
import {normalizeSearch, searchNames} from '../public/assets/site-search-core.mjs';
import {uid} from './http.mjs';

// Person IDs and media records are shared with the original site. The branch
// tables retain provenance; no image/video bytes are copied between sites.
export function initializeSharedNakash(state) {
  if (state.sharedNakashReady || typeof state.personMedia !== 'function') return;
  state.ctx.storage.transactionSync(() => {
    state.sql.exec('CREATE TABLE IF NOT EXISTS nakash_identities (person_id TEXT PRIMARY KEY, canonical_id TEXT NOT NULL)');
    const identities = Object.fromEntries(state.rows('SELECT person_id, canonical_id FROM nakash_identities').map(row => [row.person_id, row.canonical_id]));
    const tree = createFamily(family);
    // Include historical free-name tags before resolving tree identities.
    for (const row of state.rows('SELECT person_id,data FROM nakash_profiles')) {
      const saved=JSON.parse(row.data);
      if(saved.extra)state.sql.exec('INSERT OR IGNORE INTO people (id,data) VALUES (?,?)',row.person_id,JSON.stringify({...saved,id:row.person_id,nakashBranch:saved.branch || null,profileId:null}));
    }
    const roster = state.rows('SELECT data FROM people').map(row => JSON.parse(row.data));
    const claimed=new Set(Object.values(identities)),aliasOwners=new Map();
    for(const p of Object.values(tree.people))for(const name of searchNames({...p,nameEn:p.englishName}).map(normalizeSearch)){
      if(!aliasOwners.has(name))aliasOwners.set(name,new Set());
      aliasOwners.get(name).add(p.id);
    }
    for (const p of Object.values(tree.people)) {
      let id = identities[p.id];
      if (!id) {
        const aliases = new Set(searchNames({...p, nameEn:p.englishName}).map(normalizeSearch).filter(name => name.includes(' ')&&aliasOwners.get(name).size===1));
        const matches = roster.filter(person => person.extra && !claimed.has(person.id) && searchNames(person).some(name => aliases.has(normalizeSearch(name))));
        // A historical tag keeps its ID. Ambiguous names never merge people.
        id = roster.some(person => person.id === p.id) ? p.id : matches.length === 1 ? matches[0].id : p.id;
        state.sql.exec('INSERT INTO nakash_identities (person_id, canonical_id) VALUES (?, ?)', p.id, id);
        identities[p.id] = id;
        claimed.add(id);
      }
      let person = roster.find(person => person.id === id);
      if (!person) {
        person = {id, name:p.name, nameEn:p.englishName, birthday:'1.1.1111', extra:true, deceased:Boolean(p.deceased), gender:p.gender, profileId:null, revision:uid()};
        state.sql.exec('INSERT INTO people (id,data) VALUES (?,?)', id, JSON.stringify(person));
        roster.push(person);
      }
      const aliases = [...new Set([...(person.aliases || []), p.name, p.englishName, ...(p.aliases || [])].filter(Boolean))];
      const nakashBranch = branchForPerson(tree, p.id);
      if (person.nakashBranch !== nakashBranch || JSON.stringify(person.aliases) !== JSON.stringify(aliases) || p.deceased && !person.deceased) {
        Object.assign(person, {nakashBranch, aliases});
        if(p.deceased)person.deceased=true;
        state.savePerson(person);
      }
    }
    state.sharedNakashIdentities = identities;
    for (const row of state.rows('SELECT data FROM nakash_media ORDER BY created_at, id')) importNakashMedia(state, JSON.parse(row.data));
    const migration = 'nakash-shared-profiles-v1';
    if (!state.rows('SELECT id FROM meta WHERE id=?', migration).length) {
      for (const row of state.rows('SELECT person_id,data FROM nakash_profiles')) {
        const id = identities[row.person_id] || row.person_id, saved = JSON.parse(row.data);
        let person = roster.find(person => person.id === id);
        if (!person && saved.extra) {
          person = {...saved, id, profileId:null, nakashBranch:saved.branch || null};
          state.sql.exec('INSERT OR IGNORE INTO people (id,data) VALUES (?,?)', id, JSON.stringify(person));
        }
        if (!person) continue;
        for (const field of ['birthday','deathDate','about','aboutEn','languages','residences','occupation','occupationEn','jobs','jobsEn']) {
          const current = person[field];
          if (Object.hasOwn(saved,field) && (current == null || current === '' || current === '1.1.1111' || Array.isArray(current) && !current.length)) person[field] = saved[field];
        }
        if (!person.profileId && saved.profileMediaId && state.rows('SELECT id FROM media WHERE id=?',saved.profileMediaId).length) person.profileId = saved.profileMediaId;
        state.savePerson(person);
      }
      state.sql.exec('INSERT INTO meta (id,value) VALUES (?,?)', migration, 'done');
    }
    state.peopleRevision = uid();
    state.peopleCache = null;
  });
  state.sharedNakashReady = true;
}

export function importNakashMedia(state, source, {replace=false} = {}) {
  if (typeof state.personMedia !== 'function') return;
  const marker = 'nakash-shared-media:' + source.id;
  if (!replace && state.rows('SELECT id FROM meta WHERE id=?',marker).length) return;
  const identity = id => state.sharedNakashIdentities?.[id] || id;
  const people = [...new Set([...(source.people || []), ...(source.personId ? [source.personId] : [])].map(identity))];
  const item = {...source, category:'nakash:' + source.branch, personId:source.personId ? identity(source.personId) : null,
    file:source.file || source.id, createdAt:source.createdAt || new Date().toISOString()};
  delete item.deletedAt;
  if (!source.deletedAt) {
    state.sql.exec('INSERT INTO media (id,category,person_id,data) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data',item.id,item.category,item.personId,JSON.stringify(item));
    state.sql.exec('DELETE FROM media_tags WHERE media_id=?',item.id);
    for (const id of people) state.sql.exec('INSERT INTO media_tags (media_id,person_id) VALUES (?,?)',item.id,id);
    state.sql.exec('DELETE FROM media_faces WHERE media_id=?',item.id);
    for (const old of source.faces || []) {
      const face = {...old,personId:identity(old.personId)};
      state.sql.exec('INSERT INTO media_faces (media_id,id,person_id,data) VALUES (?,?,?,?)',item.id,face.id,face.personId,JSON.stringify(face));
    }
    for(const version of source.versions || [])state.sql.exec('INSERT OR IGNORE INTO photo_versions (media_id,id,data) VALUES (?,?,?)',item.id,version.id,JSON.stringify({...version,faces:(version.faces || []).map(face=>({...face,personId:identity(face.personId)}))}));
    state.touchTags(item.id);
    if (source.faceSummary?.reviewed) state.sql.exec('INSERT OR REPLACE INTO media_face_reviews (media_id,photo_revision,tags_revision,completed_at) VALUES (?,?,?,?)',item.id,item.photoRevision || 'original',state.tagsRevision(item.id),item.createdAt);
    state.touchPeople(people);
  }
  state.sql.exec('INSERT INTO meta (id,value) VALUES (?,?) ON CONFLICT(id) DO NOTHING',marker,'done');
}

export function sharedNakashItem(state, item) {
  const people = state.tagIds(item.id);
  const branches = [...new Set(people.map(id => state.person(id).nakashBranch).filter(Boolean))];
  return {...item,branch:item.category.slice(7),people,branches:branches.length ? branches : [item.category.slice(7)],
    faces:state.faces(item.id),faceSummary:state.faceSummary(item),tagsRevision:state.tagsRevision(item.id)};
}

export function sharedNakashItems(state, args={}) {
  const records = state.rows("SELECT data FROM media WHERE category LIKE 'nakash:%' ORDER BY rowid DESC");
  return records.map(row => JSON.parse(row.data)).filter(item => !args.kind || item.kind === args.kind)
    .map(item => sharedNakashItem(state,item))
    .filter(item => (!args.branch || item.branches.includes(args.branch)) && (!args.personId || item.personId === args.personId || item.people.includes(args.personId)));
}
