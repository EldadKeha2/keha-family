import {HttpError} from './http.mjs';
import {resumeSegmentWork,saveSegmentWork} from './video-segment-work.mjs';

const day = 86400000;
export function initVideoSources(state) {
  state.sql.exec('CREATE TABLE IF NOT EXISTS video_sources(id TEXT PRIMARY KEY, expires INTEGER NOT NULL, data TEXT NOT NULL)');
  state.sql.exec('CREATE INDEX IF NOT EXISTS video_source_expiry ON video_sources(expires)');
}

export function videoSourceState(state, action, p) {
  const now = Date.now();
  const write = (source, expires = now + 2 * day) => {
    state.sql.exec('INSERT OR REPLACE INTO video_sources(id,expires,data) VALUES(?,?,?)',source.id,expires,JSON.stringify(source));
    return source;
  };
  if (action === 'expired') {
    return state.rows('SELECT data FROM video_sources WHERE expires<=? ORDER BY expires LIMIT 6',now)
      .map(row => write({...JSON.parse(row.data),phase:'discarded'},now + 60000));
  }
  const row = state.rows('SELECT expires,data FROM video_sources WHERE id=?',p.id)[0];
  let source = row ? JSON.parse(row.data) : null;
  if (action === 'forget') {
    if (source?.phase === 'discarded') state.sql.exec('DELETE FROM video_sources WHERE id=?',p.id);
    return {};
  }
  if (action === 'discard') {
    if (!source) return {};
    return write({...source,phase:'discarded'},now + 300000);
  }
  if (source && (source.phase === 'discarded' || row.expires <= now)) throw new HttpError(410,'פג תוקף הטיוטה. בחרו את הסרטון מחדש.');
  if (action === 'begin') {
    if (!source) return write({...p.source,id:p.id,phase:'uploading'});
    if (['filename','size','scope','ext'].some(key => source[key] !== p.source[key])) throw new HttpError(409,'נבחר קובץ אחר עבור אותה העלאה.');
    return source;
  }
  if (action === 'resume') {
    const {item,published} = resumeSegmentWork(state,p.workId,p.branch);
    if (source && source.fullId !== item.id) throw new HttpError(409,'טיוטת הסרטון כבר בשימוש.');
    write({id:p.id,originId:item.videoSourceId,fullId:item.id,phase:'ready',joined:true,scope:item.category,key:item.key,
      size:item.size,mime:item.mime,ext:item.file.slice(item.file.lastIndexOf('.')),filename:item.filename});
    return {workRevision:item.segmentWork.revision,snapshot:item.segmentWork.snapshot,published,scope:item.category,
      file:{name:item.filename,size:item.size,type:item.mime}};
  }
  if (!source) {
    if (action === 'find') return null;
    throw new HttpError(404,'טיוטת הסרטון לא נמצאה.');
  }
  if (action === 'find' || action === 'get') {
    if (row.expires < now + day) write(source);
    return source;
  }
  if (action === 'ready') return write({...source,phase:'ready',joined:true});
  if (source.phase !== 'ready') throw new HttpError(409,'יש להמתין לסיום העלאת המקור.','SOURCE_PENDING');
  if (action === 'checkpoint') {
    const result = saveSegmentWork(state,source,p.body);
    // The album now owns the original. Expiring either editing session only retires its upload capability.
    write({...source,fullId:p.body.workId});
    return result;
  }
  const existing = state.rows('SELECT data FROM media WHERE id=?',p.mediaId)[0];
  if (existing) {
    const item = JSON.parse(existing.data);
    if (item.videoSourceId !== (source.originId || source.id) || item.videoUploadEdit?.operationId !== p.operationId ||
        item.videoUploadEdit.fingerprint !== JSON.stringify(p.metadata)) throw new HttpError(409,'פרטי השמירה השתנו. פתחו את המקטע מחדש.');
    return {existing:true,...state.mediaChanged(item,'video-upload'),file:item.file,storedKey:item.key};
  }
  if (!p.metadata.range && source.fullId && source.fullId !== p.mediaId) throw new HttpError(409,'הסרטון המלא כבר נשמר.');
  if (action === 'prepare') return source;
  if (action !== 'publish') throw new HttpError(404,'הפעולה לא נמצאה.');
  // Both operations run inside FamilyState's single SQLite transaction. A
  // partial upload or a metadata error never creates an entry in the library.
  const item = {id:p.mediaId,category:source.scope,personId:null,kind:'video',filename:source.filename,
    name:p.metadata.name,file:p.mediaId+source.ext,key:source.key,mime:source.mime,size:source.size,
    createdAt:new Date(now).toISOString(),videoSourceId:source.originId || source.id};
  state.run('media.add',{item});
  const result = state.run('video.upload.save',{id:item.id,sourceKey:source.key,sourceSize:source.size,
    operationId:p.operationId,metadata:p.metadata,rendered:p.rendered});
  if (!p.metadata.range) source.fullId = item.id;
  write(source);
  return result;
}
