import {HttpError, equal} from './http.mjs';

const PAGE_SIZE = 60;

export async function handleNakashState(state, action, args, RecycleAccess) {
  const {sql} = state;
  sql.exec('CREATE TABLE IF NOT EXISTS nakash_upload_codes (branch TEXT PRIMARY KEY, digest TEXT NOT NULL)');
  sql.exec('CREATE TABLE IF NOT EXISTS nakash_media (id TEXT PRIMARY KEY, kind TEXT NOT NULL, data TEXT NOT NULL, created_at INTEGER NOT NULL)');
  sql.exec('CREATE TABLE IF NOT EXISTS nakash_media_branches (media_id TEXT NOT NULL, branch TEXT NOT NULL, PRIMARY KEY (media_id, branch))');
  sql.exec('CREATE INDEX IF NOT EXISTS nakash_branch_lookup ON nakash_media_branches (branch, media_id)');
  sql.exec('CREATE TABLE IF NOT EXISTS nakash_profiles (person_id TEXT PRIMARY KEY, data TEXT NOT NULL)');
  sql.exec('CREATE TABLE IF NOT EXISTS nakash_video_categories (branch TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY (branch,id))');

  switch (action) {
    case 'nakash.admin':
    case 'nakash.code': {
      await new RecycleAccess(state).authorize(args.session);
      if (action === 'nakash.code') {
        sql.exec('INSERT INTO nakash_upload_codes (branch, digest) VALUES (?, ?) ON CONFLICT(branch) DO UPDATE SET digest = excluded.digest', args.branch, args.digest);
      }
      return {authorized: true};
    }
    case 'nakash.authorize': {
      const stored = state.rows('SELECT digest FROM nakash_upload_codes WHERE branch = ?', args.branch)[0];
      if (!stored) throw new HttpError(403, 'טרם הוגדר קוד העלאה לענף הזה.');
      if (!equal(stored.digest, args.digest)) throw new HttpError(403, 'קוד ההעלאה של הענף אינו תקין.');
      return {authorized: true};
    }
    case 'nakash.list': {
      const results = state.rows(`SELECT media.data FROM nakash_media AS media
        JOIN nakash_media_branches AS linked ON linked.media_id = media.id
        WHERE linked.branch = ? AND media.kind = ?
        ORDER BY media.created_at DESC, media.id
        LIMIT ? OFFSET ?`, args.branch, args.kind, PAGE_SIZE + 1, (args.page - 1) * PAGE_SIZE);
      return {items: results.slice(0, PAGE_SIZE).map(row => JSON.parse(row.data)), hasMore: results.length > PAGE_SIZE};
    }
    case 'nakash.get': {
      const row = state.rows('SELECT data FROM nakash_media WHERE id = ?', args.id)[0];
      if (!row) throw new HttpError(404, 'הקובץ המבוקש לא נמצא.');
      return {item: JSON.parse(row.data)};
    }
    case 'nakash.compat.items': {
      const where = ['1=1'];
      const values = [];
      if (args.branch) {
        where.push('EXISTS (SELECT 1 FROM nakash_media_branches AS link WHERE link.media_id = m.id AND link.branch = ?)');
        values.push(args.branch);
      }
      if (args.kind) {
        where.push('m.kind = ?');
        values.push(args.kind);
      }
      if (args.personId) {
        where.push("(json_extract(m.data, '$.personId') = ? OR EXISTS (SELECT 1 FROM json_each(m.data, '$.people') WHERE value = ?))");
        values.push(args.personId, args.personId);
      }
      return {items: state.rows('SELECT m.data FROM nakash_media AS m WHERE ' + where.join(' AND ') + ' ORDER BY m.created_at DESC, m.id', ...values).map(row => JSON.parse(row.data))};
    }
    case 'nakash.compat.profiles': {
      const profiles = Object.fromEntries(state.rows('SELECT person_id, data FROM nakash_profiles').map(row => [row.person_id, JSON.parse(row.data)]));
      return {profiles};
    }
    case 'nakash.compat.categories':
      return {categories:state.rows('SELECT data FROM nakash_video_categories WHERE branch=? ORDER BY rowid',args.branch).map(row=>JSON.parse(row.data))};
    case 'nakash.compat.category.create':
      sql.exec('INSERT INTO nakash_video_categories (branch,id,data) VALUES (?,?,?)',args.branch,args.category.id,JSON.stringify(args.category));
      return {category:args.category};
    case 'nakash.compat.profile.save': {
      const {id, field, value, expected, fallback, revision, changes} = args;
      return state.ctx.storage.transactionSync(() => {
        const row = state.rows('SELECT data FROM nakash_profiles WHERE person_id = ?', id)[0];
        const profile = row ? JSON.parse(row.data) : {};
        const current = Object.hasOwn(profile, field) ? profile[field] : fallback;
        if (Object.hasOwn(args, 'expected') && JSON.stringify(current) !== JSON.stringify(expected)) {
          throw new HttpError(409, 'פרטי הפרופיל השתנו. פתחו שוב את העריכה.');
        }
        if(changes)Object.assign(profile,changes);
        else profile[field] = value;
        profile.revision = revision;
        sql.exec('INSERT INTO nakash_profiles (person_id, data) VALUES (?, ?) ON CONFLICT(person_id) DO UPDATE SET data = excluded.data', id, JSON.stringify(profile));
        return {profile};
      });
    }
    case 'nakash.compat.portraits': {
      const {people} = state.run('people');
      return {portraits:Object.fromEntries(args.ids.filter(id=>people[id]?.profileMediaId).map(id=>[id,people[id].profileFraming||null]))};
    }
    case 'nakash.compat.portrait': {
      const {people} = state.run('people');
      const id=people[args.id]?.profileMediaId;
      const item=id?state.media(id):null;
      if (!item?.mime?.startsWith('image/') || !item.key) {
        throw new HttpError(404, 'תמונת הפרופיל אינה זמינה.');
      }
      return {item};
    }
    case 'nakash.compat.update': {
      const {id, branch, changes, expected, people} = args;
      return state.ctx.storage.transactionSync(() => {
        const row = state.rows('SELECT data FROM nakash_media WHERE id = ?', id)[0];
        if (!row) throw new HttpError(404, 'הקובץ המבוקש לא נמצא.');
        const item = JSON.parse(row.data);
        if (item.branch !== branch) throw new HttpError(403, 'עריכת הקובץ זמינה בענף שהעלה אותו.');
        for (const [field, value] of Object.entries(expected || {})) {
          if (JSON.stringify(item[field] ?? null) !== JSON.stringify(value)) throw new HttpError(409, 'הקובץ השתנה. פתחו אותו מחדש לפני שמירה.');
        }
        Object.assign(item, changes);
        for(const person of people||[])sql.exec('INSERT OR IGNORE INTO nakash_profiles (person_id,data) VALUES (?,?)',person.id,JSON.stringify(person));
        sql.exec('UPDATE nakash_media SET data = ? WHERE id = ?', JSON.stringify(item), id);
        if (Object.hasOwn(changes, 'branches')) {
          sql.exec('DELETE FROM nakash_media_branches WHERE media_id = ?', id);
          for (const branchId of item.branches) sql.exec('INSERT INTO nakash_media_branches (media_id, branch) VALUES (?, ?)', id, branchId);
        }
        return {item};
      });
    }
    case 'nakash.add': {
      const {item,people} = args;
      state.ctx.storage.transactionSync(() => {
        for(const person of people||[])sql.exec('INSERT OR IGNORE INTO nakash_profiles (person_id,data) VALUES (?,?)',person.id,JSON.stringify(person));
        sql.exec('INSERT INTO nakash_media (id, kind, data, created_at) VALUES (?, ?, ?, ?)', item.id, item.kind, JSON.stringify(item), Date.now());
        for (const branch of item.branches) sql.exec('INSERT INTO nakash_media_branches (media_id, branch) VALUES (?, ?)', item.id, branch);
      });
      return {saved: true};
    }
    default:
      throw new HttpError(404, 'פעולת האחסון לא נמצאה.');
  }
}
