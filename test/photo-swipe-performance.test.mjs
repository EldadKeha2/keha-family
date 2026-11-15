import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../public/assets/photo-swipe.js',import.meta.url),'utf8');

function fixture(){
 const surface=()=>({handlers:new Map(),addEventListener(type,fn){const list=this.handlers.get(type)||[];list.push(fn);this.handlers.set(type,list);},emit(type,event){for(const fn of this.handlers.get(type)||[])fn(event);}});
 const document=surface(),window=surface(),stage=surface(),target={closest:()=>null},frames=new Map(),moves=[],steps=[];
 let nextFrame=0,cancels=0,widthReads=0;
 stage.classList={add(){},remove(){}};Object.defineProperty(stage,'clientWidth',{get(){widthReads++;return 400;}});
 const context={document,window,setTimeout,clearTimeout,requestAnimationFrame:fn=>{const id=++nextFrame;frames.set(id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id)};
 vm.runInNewContext(source,context);
 const api=window.FamilyPhotoSwipe.bind(stage,{enabled:()=>true,claim:()=> 'queued',move:dx=>moves.push(dx),step:direction=>steps.push({direction,lastMove:moves.at(-1)}),cancel:()=>cancels++});
 const pointer=(type,x=100,y=100)=>{const event={target,pointerType:'touch',pointerId:7,isPrimary:true,button:0,clientX:x,clientY:y,cancelable:true,preventDefault(){}};if(type==='pointerdown')document.emit(type,event);(type==='pointerdown'?stage:document).emit(type,event);};
 const touch=(type,x=100,y=100)=>{const point={identifier:7,clientX:x,clientY:y,target};(type==='touchstart'?stage:document).emit(type,{target,touches:type==='touchend'?[]:[point],changedTouches:[point],cancelable:true,preventDefault(){}});};
 const paint=()=>{const batch=[...frames.values()];frames.clear();for(const fn of batch)fn();};
 return {api,document,stage,pointer,touch,paint,moves,steps,frames,get cancels(){return cancels;},get widthReads(){return widthReads;}};
}

test('high-frequency finger samples paint once per frame and release commits the latest preview before navigation',()=>{
 const f=fixture();f.pointer('pointerdown');
 for(let x=111;x<=250;x++)f.pointer('pointermove',x);
 assert.equal(f.frames.size,1);assert.deepEqual(f.moves,[]);f.paint();assert.deepEqual(f.moves,[150]);
 f.pointer('pointermove',260);f.pointer('pointermove',270);assert.equal(f.frames.size,1);f.pointer('pointerup',270);
 assert.deepEqual(f.moves,[150,170]);assert.deepEqual(f.steps,[{direction:1,lastMove:170}]);assert.equal(f.frames.size,0);
 assert.equal(f.widthReads,1,'The distance threshold is measured once per gesture, not after preview style writes');
 f.paint();assert.deepEqual(f.moves,[150,170],'No stale frame can repaint over the newly selected photo');
});

test('real touch input owns a mixed browser stream without duplicate pointer previews or early navigation',()=>{
 const f=fixture();f.pointer('pointerdown');f.touch('touchstart');
 f.pointer('pointermove',240);assert.equal(f.frames.size,0,'The companion pointer stream does no rendering work');
 f.touch('touchmove',230);f.pointer('pointermove',250);f.paint();assert.deepEqual(f.moves,[130]);
 f.pointer('pointerup',250);assert.deepEqual(f.steps,[],'The actual touch release owns the final position');
 f.touch('touchmove',260);f.touch('touchend',260);f.pointer('pointerup',260);
 assert.deepEqual(f.moves,[130,160]);assert.deepEqual(f.steps,[{direction:1,lastMove:160}]);
});

test('cancelled strokes discard queued rendering and inactive surfaces ignore unrelated multi-touch movement',()=>{
 const f=fixture();f.pointer('pointerdown');f.pointer('pointermove',240);assert.equal(f.frames.size,1);
 f.pointer('pointercancel',240);f.paint();assert.deepEqual(f.moves,[]);f.pointer('pointerup',240);assert.deepEqual(f.steps,[]);
 f.api.reset();const before=f.cancels;f.document.emit('touchmove',{touches:[{},{}]});
 assert.equal(f.cancels,before,'A pinch elsewhere must not settle every inactive gallery and upload surface');
 f.pointer('pointerdown');f.pointer('pointermove',230);f.api.reset();f.paint();assert.deepEqual(f.moves,[]);
});
