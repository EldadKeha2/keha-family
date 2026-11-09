import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PHOTO_LABELS,MAX_PHOTO_LABELS,photoLabels,photoLabelFromName,photoLabelName,photoLabelOptions,normalizePhotoLabel} from '../public/assets/photo-labels-catalog.mjs';
import {normalizeUploadMetadata} from '../public/assets/photo-upload-metadata.mjs';

test('custom label IDs round-trip Hebrew and punctuation without becoming filter separators',()=>{
 for(const name of ['טיולים, חוף','משפחה & חברים','<יום מיוחד>','משפחה 😀']){
  const id=photoLabelFromName(name);assert.ok(id.startsWith('custom:'));assert.ok(!id.includes(','));assert.equal(photoLabelName(id),name);assert.equal(normalizePhotoLabel(id),id);
  assert.deepEqual(photoLabels([id,id]),[id]);assert.equal(photoLabelOptions([id]).at(-1).name,name);assert.deepEqual(normalizeUploadMetadata({labels:[id]}).labels,[id]);
 }
});
test('labels reuse built-ins, normalize names, deduplicate case and bound persisted data',()=>{
 assert.equal(photoLabelFromName('  פורים  '),'purim');assert.equal(photoLabelFromName('PURIM'),'purim');
 const first=photoLabelFromName('Family reunion'),second=photoLabelFromName('family   reunion');assert.deepEqual(photoLabels([first,second,'holidays']),['holidays',first]);
 for(const value of ['',null,'x'.repeat(61),'a\u0000b'])assert.equal(photoLabelFromName(value),null);
 for(const value of ['unknown','custom:%ZZ','custom:'])assert.equal(normalizePhotoLabel(value),null);
 assert.deepEqual(photoLabels(PHOTO_LABELS.map(label=>label.id)),PHOTO_LABELS.map(label=>label.id));
 assert.equal(photoLabels(Array.from({length:40},(_,i)=>photoLabelFromName('Label '+i))).length,MAX_PHOTO_LABELS);
 assert.throws(()=>normalizeUploadMetadata({labels:['custom:%ZZ']}),/Invalid photo labels/);
});
