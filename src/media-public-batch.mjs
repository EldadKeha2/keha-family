import {FACE_SCAN_VERSION} from '../public/assets/face-coverage.mjs';

// Read only metadata for this bounded slice. JSON parameters avoid SQLite's
// bind-variable limit, and chunks bound temporary memory for legacy full albums.
export const MEDIA_PUBLIC_BATCH_SIZE=200;
export function mediaPublicMetadata(owner,items){
  const result=new Map(items.map(item=>[item.id,{tags:[],tagCount:0,tagsRevision:'empty',collections:[],face:null}]));
  if(!items.length)return result;
  const ids=JSON.stringify([...result.keys()]);
  for(const row of owner.rows('SELECT t.media_id,p.data FROM media_tags t LEFT JOIN people p ON p.id=t.person_id WHERE t.media_id IN (SELECT value FROM json_each(?)) ORDER BY t.rowid DESC',ids)){
    const record=result.get(row.media_id);record.tagCount++;
    if(row.data){const p=JSON.parse(row.data);record.tags.push({id:p.id,name:p.name,nameEn:p.nameEn||null,birthday:p.birthday||null,extra:Boolean(p.extra)});}
  }
  for(const row of owner.rows("SELECT id,value FROM meta WHERE id IN (SELECT 'tags:'||value FROM json_each(?))",ids))result.get(row.id.slice(5)).tagsRevision=row.value||'empty';
  for(const row of owner.rows('SELECT media_id,collection FROM media_collections WHERE media_id IN (SELECT value FROM json_each(?)) ORDER BY media_id,collection',ids))result.get(row.media_id).collections.push(row.collection);
  const photos=items.filter(item=>(item.kind||(item.mime?.startsWith('image/')?'photo':null))==='photo'),photoById=new Map(photos.map(item=>[item.id,item]));
  if(!photos.length)return result;
  const photoIds=JSON.stringify(photos.map(item=>item.id));
  for(const item of photos)result.get(item.id).face={scan:null,reviewed:false,tagCount:result.get(item.id).tagCount,faces:[],ignored:[]};
  for(const row of owner.rows('SELECT * FROM media_face_scans WHERE media_id IN (SELECT value FROM json_each(?)) AND version=?',photoIds,FACE_SCAN_VERSION)){
    if(row.photo_revision===(photoById.get(row.media_id).photoRevision||'original'))result.get(row.media_id).face.scan={...JSON.parse(row.data),total:row.face_count,unmatched:row.unmatched_count};
  }
  for(const row of owner.rows('SELECT media_id,photo_revision,tags_revision FROM media_face_reviews WHERE media_id IN (SELECT value FROM json_each(?))',photoIds)){
    const record=result.get(row.media_id);
    record.face.reviewed=row.photo_revision===(photoById.get(row.media_id).photoRevision||'original')&&row.tags_revision===record.tagsRevision;
  }
  const detail=photos.filter(item=>{const face=result.get(item.id).face;return face.reviewed&&!face.scan||owner.unassignedFaces(item).length;}),retained=photos.filter(item=>!result.get(item.id).face.reviewed&&owner.unassignedFaces(item).length);
  if(detail.length)for(const row of owner.rows('SELECT f.media_id,f.data FROM media_faces f JOIN people p ON p.id=f.person_id WHERE f.media_id IN (SELECT value FROM json_each(?)) AND EXISTS (SELECT 1 FROM media_tags t WHERE t.media_id=f.media_id AND t.person_id=f.person_id) ORDER BY f.rowid',JSON.stringify(detail.map(item=>item.id))))result.get(row.media_id).face.faces.push(JSON.parse(row.data));
  if(retained.length)for(const row of owner.rows('SELECT media_id,photo_revision,data FROM media_face_ignores WHERE media_id IN (SELECT value FROM json_each(?))',JSON.stringify(retained.map(item=>item.id)))){
    if(row.photo_revision===(photoById.get(row.media_id).photoRevision||'original'))result.get(row.media_id).face.ignored=JSON.parse(row.data);
  }
  return result;
}
