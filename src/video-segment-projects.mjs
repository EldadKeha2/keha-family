import {HttpError,uid} from './http.mjs';
import {videoUploadMetadata} from '../public/assets/video-upload-metadata.mjs';
import {photoDate} from '../public/assets/photo-date.mjs';

export function segmentInfo(item) {
  if (item.segmentProject) return item.segmentProject;
  // Older staged cuts kept their original range in the upload receipt.
  if (!item.videoSourceId || !item.videoUploadEdit?.fingerprint) return null;
  let receipt;
  try { receipt = JSON.parse(item.videoUploadEdit.fingerprint); } catch { return null; }
  const {range,name} = receipt || {};
  if (!range || range.remove) return null;
  const number = Number(/(?:מקטע|Segment)\s+(\d+)$/i.exec(name)?.[1]) || null;
  return {id:item.videoSourceId,number,start:range.start,end:range.end};
}

export function segmentProject(anchor,items,describe) {
  const project = segmentInfo(anchor);
  if (!project) throw new HttpError(404,'חלוקת הסרטון לא נמצאה.');
  const members = items.map(item => ({item,info:segmentInfo(item)}))
    .filter(({info}) => info?.id === project.id);
  const numbered = members.every(({info}) => info.number);
  members.sort((a,b) => (numbered ? a.info.number-b.info.number : 0) || a.info.start-b.info.start);
  const used = new Set(members.map(({info}) => info.number).filter(Boolean));
  let fallback = 1;
  const segments = members.map(({item,info}) => {
    const {id,src,name,caption,takenDate} = describe(item);
    while (used.has(fallback)) fallback++;
    return {id,src,name,caption,date:photoDate(takenDate),number:info.number||fallback++,start:info.start,end:info.end};
  });
  if (!segments.some(s => s.id === anchor.id)) throw new HttpError(404,'המקטע לא נמצא.');
  const duration = members.reduce((last,{info}) => Math.max(last,info.duration || info.end),0);
  return {duration,segments};
}

// Compare only edited fields. A retry after a lost response is a no-op, and
// two editors can independently change the date and description of one clip.
export function segmentChanges(item,body) {
  if (!segmentInfo(item)) throw new HttpError(404,'המקטע לא נמצא.');
  let before,after;
  try {
    before = videoUploadMetadata(body.before);
    after = videoUploadMetadata(body.after);
  } catch { throw new HttpError(400,'בדקו את שם המקטע, התיאור ותאריך הצילום.'); }
  const changes = {}, expected = {};
  const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
  for (const [key,stored] of [['name','name'],['caption','caption'],['date','takenDate']]) {
    const current = key === 'date' ? photoDate(item.takenDate) : item[stored] || '';
    if (same(before[key],after[key]) || same(current,after[key])) continue;
    if (!same(current,before[key])) throw new HttpError(409,'פרטי המקטע השתנו. פתחו את המקטעים מחדש כדי לראות את העדכון.');
    expected[stored] = item[stored] ?? null;
    changes[stored] = after[key];
  }
  if ('name' in changes) changes.nameEn = null;
  if ('takenDate' in changes) changes.takenDateRevision = uid();
  return {changes,expected};
}
