import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {makePuzzle,fitsPuzzleSlot,shuffledPieces,PUZZLE_LEVELS} from '../public/assets/puzzle.mjs';

const source=(await readFile(new URL('../public/assets/puzzle.js',import.meta.url),'utf8')).replace(/^import[^\n]+\n/gm,'').replace(/export function /g,'function ');
test('difficulty selected while family photos are loading survives the pending response in both languages',async()=>{
  for(const english of [false,true]){
    let finish;const handlers=new Map(),root={innerHTML:'',classList:{add(){},remove(){}},addEventListener(type,handler){handlers.set(type,handler);},querySelector(){return{scrollIntoView(){}};}};
    const window={FamilyI18n:{isEnglish:english,error:String,fetch:()=>new Promise(resolve=>{finish=resolve;})}},document={visibilityState:'visible',addEventListener(){}};
    vm.runInNewContext(source+'\nwindow.puzzleTest={mountPuzzle,pausePuzzle};',{window,document,AbortController,clearInterval,setInterval,makePuzzle,fitsPuzzleSlot,shuffledPieces,PUZZLE_LEVELS});
    window.puzzleTest.mountPuzzle(root,()=>{});
    handlers.get('click')({target:{closest:selector=>selector==='[data-puzzle-level]'?{dataset:{puzzleLevel:'100'}}:null}});
    assert.match(root.innerHTML,/data-puzzle-level="100" aria-pressed="true"/);
    finish(Response.json({items:[{id:'family',kind:'photo',src:'/media/family',caption:''}]}));await new Promise(resolve=>setImmediate(resolve));
    assert.match(root.innerHTML,/data-puzzle-level="100" aria-pressed="true"/);assert.match(root.innerHTML,english?/Start piecing it together/:/מתחילים להרכיב/);
    window.puzzleTest.pausePuzzle();
  }
});

test('the active puzzle offers a direct return to game selection and stops its timer when used',async()=>{
  for(const english of [false,true]){
    const handlers=new Map(),timers=new Map();let timerId=0,backs=0;
    const root={innerHTML:'',classList:{add(){},remove(){}},addEventListener(type,fn){handlers.set(type,fn);},querySelector(){return {scrollIntoView(){},focus(){}};}};
    const window={FamilyI18n:{isEnglish:english,error:String,fetch:async()=>Response.json({items:[{id:'photo',kind:'photo',src:'/media/photo'}]})}},document={visibilityState:'visible',addEventListener(){}};
    class Image{constructor(){this.naturalWidth=1200;this.naturalHeight=800;}set src(value){queueMicrotask(()=>this.onload());}}
    vm.runInNewContext(source+'\nwindow.puzzleTest={mountPuzzle,pausePuzzle};',{window,document,Image,AbortController,URL,makePuzzle,fitsPuzzleSlot,shuffledPieces,PUZZLE_LEVELS,setInterval(fn){const id=++timerId;timers.set(id,fn);return id;},clearInterval(id){timers.delete(id);}});
    window.puzzleTest.mountPuzzle(root,()=>{backs++;});await new Promise(resolve=>setImmediate(resolve));
    const click=selector=>handlers.get('click')({target:{closest:s=>s===selector?{}:null}});
    click('[data-puzzle-play]');await new Promise(resolve=>setImmediate(resolve));
    assert.match(root.innerHTML,/data-puzzle-board/);assert.match(root.innerHTML,/data-puzzle-back/);assert.match(root.innerHTML,english?/Back to game selection/:/חזרה ללוח בחירת המשחקים/);assert.equal(timers.size,1);
    click('[data-puzzle-back]');assert.equal(backs,1);assert.equal(timers.size,0);
  }
});
