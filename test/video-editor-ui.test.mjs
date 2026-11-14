import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../public/assets/video-editor.js',import.meta.url),'utf8');
function model(){const window={FamilyI18n:{isEnglish:false}},document={addEventListener(){}};vm.runInNewContext(source,{window,document});return window.FamilyVideoEditor;}
test('video ranges accept minute and hour positions, reject ambiguous seconds, and preserve fractional marks',()=>{
 const api=model();assert.equal(api.seconds('01:02.25'),62.25);assert.equal(api.seconds('1:02:03.5'),3723.5);assert.equal(api.seconds('2,75'),2.75);assert.ok(Number.isNaN(api.seconds('1:62')));assert.ok(Number.isNaN(api.seconds('')));assert.equal(api.clock(3723.5),'1:02:03.50');
});
test('the same edit action is offered in every video collection, including uploaded and linked films',()=>{
 const api=model();for(const scope of ['nostalgia','videos','personal:tomer','wedding:root','nursery:tomer'])assert.match(api.controls({id:'film',kind:'video'},scope),new RegExp('data-video-scope="'+scope+'"'));
 assert.equal(api.controls({id:'photo',kind:'photo'},'nostalgia'),'');assert.match(api.controls({id:'youtube',kind:'video',provider:'youtube'},'videos'),/data-video-edit="youtube"/);
});
