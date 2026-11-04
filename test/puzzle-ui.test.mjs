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
