import {test} from 'node:test';
import assert from 'node:assert/strict';
import {puzzleGrid,makePuzzle,fitsPuzzleSlot,shuffledPieces} from '../public/assets/puzzle.mjs';

test('each difficulty creates exactly the requested number of interlocking pieces without cropping the photo',()=>{
  for(const count of [10,50,100])for(const aspect of [.7,1,1.5,2.4]){
    const p=makePuzzle(count,aspect,()=>.3);
    assert.equal(p.pieces.length,count);assert.equal(p.cols*p.rows,count);assert.equal(new Set(p.pieces.map(piece=>piece.id)).size,count);
    assert.ok(Math.abs(p.width/p.height-aspect)<1e-10);
    for(const piece of p.pieces){
      assert.doesNotMatch(piece.path,/NaN|Infinity|undefined/);assert.ok(piece.path.endsWith('Z'));
      assert.equal(piece.row===0,piece.edges.top===0);assert.equal(piece.col===0,piece.edges.left===0);
      assert.equal(piece.row===p.rows-1,piece.edges.bottom===0);assert.equal(piece.col===p.cols-1,piece.edges.right===0);
      if(piece.col<p.cols-1)assert.equal(piece.edges.right,-p.pieces[piece.id+1].edges.left);
      if(piece.row<p.rows-1)assert.equal(piece.edges.bottom,-p.pieces[piece.id+p.cols].edges.top);
      assert.ok(fitsPuzzleSlot(p,piece,(piece.col+.5)/p.cols,(piece.row+.5)/p.rows));
    }
  }
});
test('pieces snap only into their own slot and reject nearby wrong cells and points outside the board',()=>{
  for(const count of [10,50,100]){
    const layout=makePuzzle(count),piece=layout.pieces[0];
    assert.equal(fitsPuzzleSlot(layout,piece,.5/layout.cols,.5/layout.rows),true);
    assert.equal(fitsPuzzleSlot(layout,piece,1.5/layout.cols,.5/layout.rows),false);
    for(const [x,y]of [[-1,0],[1.1,0],[0,-.1],[0,1.1],[NaN,0],[Infinity,0]])assert.equal(fitsPuzzleSlot(layout,piece,x,y),false);
  }
});
test('shuffling preserves every piece, leaves the layout intact and validates difficulty input',()=>{
  const puzzle=makePuzzle(50),ids=puzzle.pieces.map(p=>p.id),shuffled=shuffledPieces(puzzle.pieces,()=>.25);
  assert.deepEqual(puzzle.pieces.map(p=>p.id),ids);assert.deepEqual(shuffled.map(p=>p.id).sort((a,b)=>a-b),ids);assert.notDeepEqual(shuffled.map(p=>p.id),ids);
  assert.throws(()=>puzzleGrid(20),RangeError);assert.throws(()=>puzzleGrid(10,0),RangeError);
});
