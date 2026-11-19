import {HttpError, equal} from './http.mjs';

const PAGE_SIZE = 60;

export async function handleNakashState(state, action, args, RecycleAccess) {
  const {sql} = state;
  sql.exec('CREATE TABLE IF NOT EXISTS nakash_upload_codes (branch TEXT PRIMARY KEY, digest TEXT NOT NULL)');
  sql.exec('CREATE TABLE IF NOT EXISTS nakash_media (id TEXT PRIMARY KEY, kind TEXT NOT NULL, data TEXT NOT NULL, created_at INTEGER NOT NULL)');
  sql.exec('CREATE TABLE IF NOT EXISTS nakash_media_branches (media_id TEXT NOT NULL, branch TEXT NOT NULL, PRIMARY KEY (media_id, branch))');
  sql.exec('CREATE INDEX IF NOT EXISTS nakash_branch_lookup ON nakash_media_branches (branch, media_id)');

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
    case 'nakash.add': {
      const {item} = args;
      state.ctx.storage.transactionSync(() => {
        sql.exec('INSERT INTO nakash_media (id, kind, data, created_at) VALUES (?, ?, ?, ?)', item.id, item.kind, JSON.stringify(item), Date.now());
        for (const branch of item.branches) sql.exec('INSERT INTO nakash_media_branches (media_id, branch) VALUES (?, ?)', item.id, branch);
      });
      return {saved: true};
    }
    default:
      throw new HttpError(404, 'פעולת האחסון לא נמצאה.');
  }
}
