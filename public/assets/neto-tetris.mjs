// The display has no timer. Only a full stockroom costs a life.
export const COLS=10;
export const ROWS=20;
export const TETRIS_LIVES=4;
const definitions={
  I:{cells:[[0,1],[1,1],[2,1],[3,1]],size:4,color:'#70cde3'},
  O:{cells:[[1,0],[2,0],[1,1],[2,1]],size:4,color:'#f4ce68'},
  T:{cells:[[1,0],[0,1],[1,1],[2,1]],size:3,color:'#b9a2e8'},
  J:{cells:[[0,0],[0,1],[1,1],[2,1]],size:3,color:'#7dabe9'},
  L:{cells:[[2,0],[0,1],[1,1],[2,1]],size:3,color:'#f1ac70'},
  S:{cells:[[1,0],[2,0],[0,1],[1,1]],size:3,color:'#8fc5a5'},
  Z:{cells:[[0,0],[1,0],[1,1],[2,1]],size:3,color:'#e99aa4'}
};
export const TETROMINOES=Object.freeze(Object.fromEntries(Object.entries(definitions).map(([type,value])=>[type,Object.freeze({...value,cells:Object.freeze(value.cells.map(cell=>Object.freeze(cell)))})])));
const TYPES=Object.keys(TETROMINOES),LOCK_SECONDS=.45,MAX_LOCK_RESETS=15;
const emptyBoard=()=>Array.from({length:ROWS},()=>Array(COLS).fill(null));
const sample=game=>{const n=game.random();return Number.isFinite(n)?Math.max(0,Math.min(.999999999999,n)):.5;};

// SRS offsets use screen coordinates, so positive y points downwards.
const normalKicks={
  '0>1':[[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
  '1>0':[[0,0],[1,0],[1,1],[0,-2],[1,-2]],
  '1>2':[[0,0],[1,0],[1,1],[0,-2],[1,-2]],
  '2>1':[[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
  '2>3':[[0,0],[1,0],[1,-1],[0,2],[1,2]],
  '3>2':[[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
  '3>0':[[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
  '0>3':[[0,0],[1,0],[1,-1],[0,2],[1,2]]
};
const iKicks={
  '0>1':[[0,0],[-2,0],[1,0],[-2,1],[1,-2]],
  '1>0':[[0,0],[2,0],[-1,0],[2,-1],[-1,2]],
  '1>2':[[0,0],[-1,0],[2,0],[-1,-2],[2,1]],
  '2>1':[[0,0],[1,0],[-2,0],[1,2],[-2,-1]],
  '2>3':[[0,0],[2,0],[-1,0],[2,-1],[-1,2]],
  '3>2':[[0,0],[-2,0],[1,0],[-2,1],[1,-2]],
  '3>0':[[0,0],[1,0],[-2,0],[1,2],[-2,-1]],
  '0>3':[[0,0],[-1,0],[2,0],[-1,-2],[2,1]]
};

export function pieceCells(piece){
  if(!piece||!TETROMINOES[piece.type])return [];
  const shape=TETROMINOES[piece.type],turns=piece.type==='O'?0:((piece.rotation||0)%4+4)%4;
  return shape.cells.map(([localX,localY])=>{
    let x=localX,y=localY;
    for(let n=0;n<turns;n++)[x,y]=[shape.size-1-y,x];
    return {x:x+piece.x,y:y+piece.y,localX,localY};
  });
}
function fits(game,piece){
  return pieceCells(piece).every(({x,y})=>x>=0&&x<COLS&&y<ROWS&&(y<0||!game.board[y][x]));
}
function isGrounded(game){return !fits(game,{...game.active,y:game.active.y+1});}
function fillPreview(game){
  while(game.next.length<5){
    if(!game.bag.length){
      game.bag=[...TYPES];
      for(let i=game.bag.length-1;i>0;i--){const j=Math.floor(sample(game)*(i+1));[game.bag[i],game.bag[j]]=[game.bag[j],game.bag[i]];}
    }
    game.next.push(game.bag.shift());
  }
}
function crash(game){
  game.active=null;game.gravity=0;game.lockTime=0;game.lives=Math.max(0,game.lives-1);
  game.phase=game.lives?'crashed':'finished';
  game.events.push({type:game.lives?'crash':'finish',lives:game.lives,reason:'lives'});
}
function spawn(game){
  fillPreview(game);
  const type=game.next.shift(),shape=TETROMINOES[type];fillPreview(game);
  game.active={type,x:Math.floor((COLS-shape.size)/2),y:0,rotation:0,group:++game.sequence};
  game.gravity=0;game.lockTime=0;game.lockResets=0;
  if(!fits(game,game.active)){crash(game);return false;}
  game.events.push({type:'spawn',piece:type});return true;
}
export function createTetris({random=Math.random}={}){
  const game={board:emptyBoard(),active:null,next:[],bag:[],random,phase:'playing',score:0,lines:0,level:1,lives:TETRIS_LIVES,pieces:0,zaps:0,events:[],gravity:0,lockTime:0,lockResets:0,sequence:0};
  spawn(game);return game;
}
export const dropInterval=game=>Math.max(.075,.8*Math.pow(.82,game.level-1));
function adjustLock(game,wasGrounded){
  if(wasGrounded&&game.lockResets<MAX_LOCK_RESETS){game.lockTime=0;game.lockResets++;}
  else if(!isGrounded(game))game.lockTime=0;
}
function lock(game){
  const active=game.active,cells=pieceCells(active);
  game.pieces++;
  if(cells.some(cell=>cell.y<0)){crash(game);return;}
  for(const {x,y,localX,localY}of cells)game.board[y][x]={type:active.type,group:active.group,rotation:active.rotation,localX,localY};
  game.events.push({type:'lock',piece:active.type});
  const rows=[];for(let y=0;y<ROWS;y++)if(game.board[y].every(Boolean))rows.push(y);
  if(rows.length){
    const points=[0,100,300,500,800][rows.length]*game.level;
    const kept=game.board.filter((_,y)=>!rows.includes(y));
    game.board=[...Array.from({length:rows.length},()=>Array(COLS).fill(null)),...kept];
    game.score+=points;game.lines+=rows.length;game.level=1+Math.floor(game.lines/10);
    game.events.push({type:'lines',count:rows.length,rows,points});
  }
  spawn(game);
}
export function moveTetris(game,dx){
  if(game.phase!=='playing'||!Number.isInteger(dx)||!dx)return false;
  game.events=[];const next={...game.active,x:game.active.x+Math.sign(dx)};
  if(!fits(game,next))return false;
  const grounded=isGrounded(game);game.active=next;adjustLock(game,grounded);return true;
}
export function rotateTetris(game,direction=1){
  if(game.phase!=='playing'||game.active.type==='O')return false;
  game.events=[];const from=game.active.rotation,to=(from+(direction<0?3:1))%4,kicks=(game.active.type==='I'?iKicks:normalKicks)[from+'>'+to];
  for(const [dx,dy]of kicks){
    const next={...game.active,rotation:to,x:game.active.x+dx,y:game.active.y+dy};
    if(!fits(game,next))continue;
    const grounded=isGrounded(game);game.active=next;adjustLock(game,grounded);return true;
  }
  return false;
}
export function softDropTetris(game){
  if(game.phase!=='playing')return false;
  game.events=[];const next={...game.active,y:game.active.y+1};
  game.gravity=0;
  if(!fits(game,next)){lock(game);return false;}
  game.active=next;game.lockTime=0;return true;
}
export function ghostY(game){
  if(!game.active)return null;
  const next={...game.active};while(fits(game,{...next,y:next.y+1}))next.y++;
  return next.y;
}
export function hardDropTetris(game){
  if(game.phase!=='playing')return false;
  game.events=[];game.active.y=ghostY(game);lock(game);return true;
}
export function advanceTetris(game,seconds){
  game.events=[];
  if(game.phase!=='playing'||!Number.isFinite(seconds))return game;
  // A suspended tab cannot fast-forward the entire stockroom on return.
  let left=Math.max(0,Math.min(1,seconds));
  while(left>0&&game.phase==='playing'){
    const step=Math.min(1/60,left);left-=step;game.gravity+=step;
    const interval=dropInterval(game);
    while(game.gravity>=interval){
      game.gravity-=interval;const next={...game.active,y:game.active.y+1};
      if(!fits(game,next)){game.gravity=0;break;}game.active=next;
    }
    if(isGrounded(game)){game.lockTime+=step;if(game.lockTime+1e-9>=LOCK_SECONDS)lock(game);}
    else game.lockTime=0;
  }
  return game;
}
export function resumeTetris(game){
  if(game.phase!=='crashed')return false;
  game.events=[];game.board=emptyBoard();game.phase='playing';spawn(game);return true;
}
export function beginZap(game){
  if(game.phase!=='playing')return null;
  const snapshot=[];
  for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++)if(game.board[y][x])snapshot.push({...game.board[y][x],x,y});
  for(const cell of pieceCells(game.active))if(cell.y>=0)snapshot.push({...game.active,...cell});
  game.phase='zapping';game.zaps++;game.events=[{type:'zap'}];return snapshot;
}
export function finishZap(game){
  if(game.phase!=='zapping')return false;
  game.events=[];game.board=emptyBoard();game.active=null;game.phase='playing';spawn(game);return true;
}
