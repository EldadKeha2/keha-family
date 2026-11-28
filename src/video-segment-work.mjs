import {HttpError,uid} from './http.mjs';

const validId = value => typeof value === 'string' && /^[a-f0-9]{32}$/.test(value);
const invalid = () => { throw new HttpError(400,'פרטי העבודה בחלוקת הסרטון אינם תקינים.'); };
function string(value,maximum) {
  if (typeof value !== 'string' || value.length > maximum) invalid();
  return value;
}
function draftDetails(value) {
  const {name,caption,date} = value || {};
  const parts = {};
  for (const key of ['day','month','year']) {
    const part = date?.[key] ?? null;
    if (part !== null && !Number.isFinite(part)) invalid();
    parts[key] = part;
  }
  return {name:string(name,140),caption:string(caption,5000),date:parts};
}
function draftMetadata(value) {
  const result = draftDetails(value);
  if (!Array.isArray(value.people) || value.people.length > 150) invalid();
  result.people = value.people.map(person => {
    if (!person || Boolean(person.personId) === Boolean(person.name)) invalid();
    const entry = person.personId ? {personId:string(person.personId,120)} : {name:string(person.name,120)};
    if (person.label) entry.label = string(person.label,250);
    return entry;
  });
  if (value.eventId !== undefined) result.eventId = string(value.eventId,64);
  if (value.group !== undefined) result.group = string(value.group,64);
  return result;
}
function validateSnapshot(value) {
  const {duration,index,position,nextNumber,original,segments} = value || {};
  if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(position) || position < 0 || position > duration ||
      !Array.isArray(segments) || !segments.length || !Number.isSafeInteger(index) || index < 0 || index >= segments.length ||
      !Number.isSafeInteger(nextNumber) || !validId(original?.uploadId)) invalid();
  const ids = new Set([original.uploadId]), numbers = new Set();
  const drafts = segments.map(d => {
    const s = d?.segment;
    if (!s || !validId(d.uploadId) || ids.has(d.uploadId) || !Number.isSafeInteger(s.number) || s.number < 1 ||
        s.number >= nextNumber || numbers.has(s.number)) invalid();
    ids.add(d.uploadId); numbers.add(s.number);
    const segment = {number:s.number};
    for (const edge of ['start','end']) {
      if (s[edge] !== null && !Number.isFinite(s[edge])) invalid();
      segment[edge] = s[edge];
      if (s[edge+'Text'] != null) segment[edge+'Text'] = string(s[edge+'Text'],128);
    }
    segment.followsPrevious = s.followsPrevious === true;
    segment.pinned = s.pinned === true;
    return {uploadId:d.uploadId,metadata:draftMetadata(d.metadata),segment,eventChosen:d.eventChosen === true,
      ...(d.savedDetails ? {savedDetails:draftDetails(d.savedDetails)} : {})};
  });
  const originalMetadata=draftMetadata(original.metadata);
  if (original.metadata.range) {
    const {start,end,remove}=original.metadata.range;
    if (!Number.isFinite(start) || !Number.isFinite(end) || start<0 || end<=start || end>duration+.005) invalid();
    originalMetadata.range={start,end,...(remove===true?{remove:true}:{})};
  }
  return {duration,index,position,nextNumber,original:{uploadId:original.uploadId,metadata:originalMetadata},segments:drafts};
}

export function saveSegmentWork(state,source,body) {
  const {workId,revision} = body;
  if (!validId(workId) || (revision !== null && !validId(revision))) invalid();
  const snapshot = validateSnapshot(body.snapshot);
  if (snapshot.original.uploadId === workId || snapshot.segments.some(d => d.uploadId === workId)) invalid();
  const stored = state.rows('SELECT data FROM media WHERE id=?',workId)[0];
  let item = stored && JSON.parse(stored.data);
  if ((source.fullId && source.fullId !== workId) || (item && (!item.segmentWork || item.key !== source.key || item.category !== source.scope)))
    throw new HttpError(409,'הסרטון שייך לעבודה אחרת.');
  if (!item && (source.fullId || revision || state.rows('SELECT id FROM media_trash WHERE id=?',workId).length))
    throw new HttpError(410,'העבודה השמורה הוסרה מהאלבום.');
  const same = item && JSON.stringify(item.segmentWork.snapshot) === JSON.stringify(snapshot);
  if (item && item.segmentWork.revision !== revision && !same)
    throw new HttpError(409,'העבודה עודכנה מאז שנפתחה. פתחו את העותק השמור כדי להמשיך ממנו.');
  if (!same) {
    const destination = snapshot.segments[snapshot.index].metadata;
    const name = snapshot.original.metadata.name.trim() || source.filename;
    const work = {revision:uid(),snapshot};
    if (destination.group && source.scope === 'videos') state.videoCategories.category(destination.group);
    if (destination.eventId && source.scope === 'nostalgia') state.nostalgiaLibrary.event(destination.eventId);
    if (!item) {
      item = {id:workId,category:source.scope,personId:null,kind:'video',filename:source.filename,file:workId+source.ext,
        key:source.key,mime:source.mime,size:source.size,duration:snapshot.duration,videoSourceId:source.originId || source.id,
        createdAt:new Date().toISOString()};
    }
    Object.assign(item,{name,segmentWork:work});
    if (source.scope === 'nostalgia') item.nostalgiaEventIds = destination.eventId ? [destination.eventId] : [];
    if (source.scope === 'videos') item.videoCategory = destination.group || 'family';
    if (stored) state.touchMedia(item);
    else state.run('media.add',{item});
  }
  return {...state.mediaChanged(item,'video-segment-work'),workRevision:item.segmentWork.revision};
}

// Keep an album-side move and the destination displayed on resuming in sync.
export function updateWorkDestination(item,key,value,removedEvent) {
  if (!item.segmentWork) return false;
  const snapshot=item.segmentWork.snapshot, active=snapshot.segments[snapshot.index];
  const previous=active.metadata[key] || '';
  let changed=false;
  for (const draft of [snapshot.original,...snapshot.segments]) {
    const inherits=!draft.eventChosen && (draft.metadata[key] || '')===previous;
    const affected=removedEvent ? draft.metadata[key]===removedEvent : draft===active || inherits;
    if (affected && draft.metadata[key]!==value) {
      draft.metadata[key]=value;
      changed=true;
    }
  }
  if (changed) item.segmentWork.revision=uid();
  return changed;
}

export function resumeSegmentWork(state,workId,branch) {
  if (!validId(workId)) invalid();
  if (branch) state.run('content.media.authorize',{id:workId,branch});
  const item = state.media(workId);
  if (!item.segmentWork) throw new HttpError(404,'העבודה השמורה לא נמצאה.');
  const published = state.rows("SELECT data FROM media WHERE json_extract(data,'$.segmentProject.id')=?",workId)
    .map(row => JSON.parse(row.data)).map(clip => ({id:clip.id,name:clip.name,caption:clip.caption || '',date:clip.takenDate || {}}));
  return {item,published};
}
