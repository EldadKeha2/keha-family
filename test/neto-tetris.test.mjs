import {test} from 'node:test';
import assert from 'node:assert/strict';
import {COLS,ROWS,TETROMINOES,TETRIS_LIVES,createTetris,pieceCells,moveTetris,rotateTetris,softDropTetris,hardDropTetris,advanceTetris,resumeTetris,beginZap,finishZap,ghostY,dropInterval} from '../public/assets/neto-tetris.mjs';

function random(seed=41){return ()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32);}
const tile=(type='J',group=999)=>({type,group,rotation:0,localX:0,localY:0});
function active(game,type,x=3,y=0,rotation=0){game.active={type,x,y,rotation,group:++game.sequence};game.gravity=game.lockTime=0;}
function forceTopOut(game){
  for(const y of [0,1])game.board[y]=Array.from({length:COLS},(_,x)=>x>=2&&x<=7?tile():null);
  active(game,'O',3,ROWS-2);hardDropTetris(game);
}
test('the seven-bag stream has one of each connected tetromino and five previews',()=>{
  const game=createTetris({random:random()}),sequence=[];
  assert.equal(game.board.length,ROWS);assert.ok(game.board.every(row=>row.length===COLS));assert.equal(game.lives,TETRIS_LIVES);assert.equal(TETRIS_LIVES,4);
  for(let i=0;i<56;i++){
    sequence.push(game.active.type);assert.equal(game.next.length,5);assert.equal(TETROMINOES[game.active.type].cells.length,4);
    beginZap(game);finishZap(game);
  }
  for(let start=0;start<sequence.length;start+=7)assert.deepEqual([...sequence.slice(start,start+7)].sort(),Object.keys(TETROMINOES).sort());
});
test('rotated cells retain their canonical appliance segments and rotate back after four turns',()=>{
  for(const type of Object.keys(TETROMINOES)){
    const game=createTetris();active(game,type,3,4);const original=pieceCells(game.active);
    for(let turn=0;turn<4;turn++){
      const cells=pieceCells(game.active);assert.equal(new Set(cells.map(cell=>cell.x+','+cell.y)).size,4);
      assert.deepEqual(cells.map(({localX,localY})=>[localX,localY]),TETROMINOES[type].cells);
      rotateTetris(game);
    }
    assert.deepEqual(pieceCells(game.active),original);
  }
});
test('movement respects walls and occupied cells, ghost and hard drop land on the same surface',()=>{
  const game=createTetris();active(game,'O',-1,3);
  assert.equal(moveTetris(game,-1),false);assert.equal(moveTetris(game,1),true);
  game.board[ROWS-2][1]=tile();const y=ghostY(game);assert.equal(y,ROWS-4);const group=game.active.group;
  hardDropTetris(game);const locked=[];game.board.forEach((row,y)=>row.forEach((cell,x)=>{if(cell?.group===group)locked.push({x,y});}));
  assert.equal(locked.length,4);assert.equal(Math.max(...locked.map(cell=>cell.y)),ROWS-3);assert.equal(game.score,0);assert.equal(game.pieces,1);
});
test('SRS kicks bring I and T pieces off the wall and floor without crossing occupied tiles',()=>{
  const game=createTetris();active(game,'I',-2,5,1);assert.equal(rotateTetris(game,-1),true);assert.ok(pieceCells(game.active).every(({x,y})=>x>=0&&x<COLS&&y<ROWS));
  active(game,'T',3,ROWS-2);assert.equal(rotateTetris(game),true);assert.ok(pieceCells(game.active).every(({x,y})=>x>=0&&x<COLS&&y<ROWS));
  const before={...game.active};for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++)game.board[y][x]=tile();assert.equal(rotateTetris(game),false);assert.deepEqual(game.active,before);
});
test('complete rows clear, cells above settle, and score uses the pre-clear level',()=>{
  const game=createTetris();game.lines=9;game.level=1;
  game.board[ROWS-1]=Array.from({length:COLS},(_,x)=>x>=4&&x<=7?null:tile());game.board[ROWS-3][0]=tile('S',42);
  active(game,'I',4,0);hardDropTetris(game);
  assert.equal(game.lines,10);assert.equal(game.level,2);assert.equal(game.score,100);assert.equal(game.board[ROWS-2][0]?.group,42);assert.ok(game.events.some(event=>event.type==='lines'&&event.count===1&&event.points===100));
  for(let y=ROWS-4;y<ROWS;y++)game.board[y]=Array.from({length:COLS},(_,x)=>x===5?null:tile());
  active(game,'I',3,0,1);hardDropTetris(game);assert.equal(game.lines,14);assert.equal(game.score,1700);assert.ok(game.events.some(event=>event.type==='lines'&&event.count===4));
});
test('gravity and a lock delay permit a grounded adjustment, with a bounded fall interval',()=>{
  const game=createTetris();active(game,'O',3,ROWS-2);const group=game.active.group;
  advanceTetris(game,.3);assert.equal(game.active.group,group);assert.equal(moveTetris(game,1),true);advanceTetris(game,.3);assert.equal(game.active.group,group);
  advanceTetris(game,.2);assert.notEqual(game.active.group,group);assert.equal(game.pieces,1);
  assert.ok(dropInterval({level:10})<dropInterval({level:1}));assert.equal(dropInterval({level:1000000}),.075);
});
test('each full stockroom loses one life and preserves cumulative score; only the fourth ends the game',()=>{
  const game=createTetris();game.score=2300;game.lines=23;game.level=3;
  for(let life=3;life>=0;life--){
    forceTopOut(game);assert.equal(game.lives,life);assert.equal(game.phase,life?'crashed':'finished');assert.equal(game.score,2300);assert.equal(game.lines,23);
    const count=game.pieces;advanceTetris(game,1);hardDropTetris(game);moveTetris(game,1);rotateTetris(game);softDropTetris(game);assert.equal(game.pieces,count);assert.equal(beginZap(game),null);
    if(life){assert.equal(resumeTetris(game),true);assert.equal(game.phase,'playing');assert.equal(game.board.flat().filter(Boolean).length,0);}
  }
  assert.equal(resumeTetris(game),false);assert.equal(finishZap(game),false);assert.equal(game.events.length,0);
});
test('locking above the display also costs exactly one life',()=>{
  const game=createTetris();active(game,'O',3,-1);game.board[1][4]=tile();game.board[1][5]=tile();
  softDropTetris(game);assert.equal(game.phase,'crashed');assert.equal(game.lives,3);assert.equal(game.pieces,1);
});
test('ZAP snapshots every visible product, freezes actions, clears once and awards no lines or points',()=>{
  const game=createTetris();game.score=500;game.lines=5;active(game,'T',3,4,1);game.board[19][0]=tile('J',8);game.board[18][0]=tile('J',8);
  const before=pieceCells(game.active),snapshot=beginZap(game);assert.equal(snapshot.length,6);assert.equal(game.phase,'zapping');assert.equal(game.zaps,1);
  assert.deepEqual(snapshot.filter(cell=>cell.group===game.active.group).map(({x,y,localX,localY})=>({x,y,localX,localY})),before);
  const group=game.active.group;assert.equal(moveTetris(game,1),false);assert.equal(rotateTetris(game),false);assert.equal(hardDropTetris(game),false);assert.equal(beginZap(game),null);advanceTetris(game,1);assert.equal(game.active.group,group);
  assert.equal(finishZap(game),true);assert.equal(finishZap(game),false);assert.equal(game.board.flat().filter(Boolean).length,0);assert.equal(game.score,500);assert.equal(game.lines,5);assert.equal(game.lives,4);assert.equal(game.pieces,0);assert.notEqual(game.active.group,group);
  assert.ok(beginZap(game));finishZap(game);assert.equal(game.zaps,2);
});
test('many hours of continued play have no deadline and no points from dropping or ZAP alone',()=>{
  const game=createTetris({random:random(12)});
  for(let step=0;step<25000;step++){
    advanceTetris(game,.4);if(step%12===0){hardDropTetris(game);beginZap(game);finishZap(game);}
    assert.equal(game.phase,'playing');
  }
  assert.equal('deadline' in game,false);assert.equal(game.lives,4);assert.equal(game.score,0);assert.equal(game.lines,0);assert.ok(game.pieces>1000);
});
