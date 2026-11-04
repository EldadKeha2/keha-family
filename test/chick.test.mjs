import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chickScenes,makeChickQuiz,withinChickTarget} from '../public/assets/chick.mjs';

test('ten portrait targets share five real illustrated scenes with bounded answers in both languages',async()=>{
  assert.equal(chickScenes.length,10);assert.equal(new Set(chickScenes.map(s=>s.id)).size,10);assert.equal(new Set(chickScenes.map(s=>s.src)).size,5);
  for(const scene of chickScenes){
    assert.ok(scene.person.name&&scene.person.nameEn&&scene.title&&scene.titleEn);assert.equal(scene.width,1536);assert.equal(scene.height,1024);
    const {x,y,w,h}=scene.target;assert.ok(x-w/2>=0&&x+w/2<=1&&y-h/2>=0&&y+h/2<=1);assert.ok(w>0&&h>0);
    const bytes=await readFile(new URL('../public/'+scene.src,import.meta.url));assert.equal(bytes.subarray(0,4).toString(),'RIFF');assert.equal(bytes.subarray(8,12).toString(),'WEBP');assert.ok(bytes.length>100000);
    const portrait=await readFile(new URL('../public/'+scene.portrait,import.meta.url));assert.equal(portrait.subarray(8,12).toString(),'WEBP');
  }
});
test('hit detection accepts the target and its edges but rejects the surrounding scene and invalid coordinates',()=>{
  for(const {target:t}of chickScenes){assert.equal(withinChickTarget(t,t.x,t.y),true);assert.equal(withinChickTarget(t,t.x+t.w/2-.0001,t.y),true);assert.equal(withinChickTarget(t,t.x+t.w/2+.0001,t.y),false);assert.equal(withinChickTarget(t,0,0),false);assert.equal(withinChickTarget(t,NaN,t.y),false);assert.equal(withinChickTarget(t,-1,t.y),false);}
});
test('a new hunt shuffles all scenes and retains the verified answer without changing the source bank',()=>{
  const before=JSON.stringify(chickScenes),orders=[];for(let i=0;i<15;i++){const round=makeChickQuiz();assert.equal(round.length,5);assert.equal(new Set(round.map(q=>q.src)).size,5);for(const q of round){assert.equal(q.correctId,q.subject.id);assert.equal(q.options[0].id,q.correctId);assert.equal(q.kind,'chick');}orders.push(round.map(q=>q.id).join('|'));}assert.ok(new Set(orders).size>1);assert.equal(JSON.stringify(chickScenes),before);
});
