import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../public/assets/nostalgia-library.js',import.meta.url),'utf8');
function model(){const window={FamilyI18n:{isEnglish:false}},document={addEventListener(){}};vm.runInNewContext(source,{window,document});return window.FamilyNostalgia;}
test('each event exposes only its own files, including shared clips, and unclassified files remain separate',()=>{
 const api=model(),collection={items:[{id:'loose',name:'A'},{id:'a',nostalgiaEventIds:['ora']},{id:'both',nostalgiaEventIds:['ora','holiday']},{id:'b',nostalgiaEventIds:['holiday']}]};
 assert.deepEqual(Array.from(api.viewItems(collection,null),i=>i.id),['loose']);assert.deepEqual(Array.from(api.viewItems(collection,'ora'),i=>i.id),['a','both']);assert.deepEqual(Array.from(api.viewItems(collection,'holiday'),i=>i.id),['both','b']);assert.equal(collection.items.length,4);
});
test('numbered event clips stay in their original sequence even when uploaded out of order',()=>{
 const api=model(),items=[19,2,10,1].map(n=>({id:String(n),name:'מסיבת השחרור של אורה - קטע '+String(n).padStart(2,'0'),nostalgiaEventIds:['ora']}));
 assert.deepEqual(Array.from(api.viewItems({items},'ora'),i=>i.id),['1','2','10','19']);assert.deepEqual(items.map(i=>i.id),['19','2','10','1']);
});
