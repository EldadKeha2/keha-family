export const DEFAULT_CHARACTER = 'yona';
export const SNAKE_LIVES = 3;
const directions = {up:[0,-1],right:[1,0],down:[0,1],left:[-1,0]};
const same = (a,b) => a.x === b.x && a.y === b.y;

export function placeJachnun(body,size,random=Math.random) {
  const occupied = new Set(body.map(p=>p.y*size+p.x)), free=[];
  for(let y=0;y<size;y++) for(let x=0;x<size;x++) if(!occupied.has(y*size+x)) free.push({x,y});
  if(!free.length) return null;
  return free[Math.min(free.length-1,Math.max(0,Math.floor(random()*free.length)))];
}
export function createSnake({size=18,lives=SNAKE_LIVES,score=0,random=Math.random}={}) {
  const x=Math.floor(size/2),y=Math.floor(size/2),body=[{x,y},{x:x-1,y},{x:x-2,y}];
  return {size,lives,score,body,direction:'right',turns:[],food:placeJachnun(body,size,random),phase:'ready',reason:null};
}
export function turnSnake(state,direction) {
  if(!directions[direction]||!['ready','playing'].includes(state.phase)||state.turns.length>=2) return state;
  const previous=state.turns.at(-1)||state.direction,a=directions[previous],b=directions[direction];
  if(previous===direction||a[0]+b[0]===0&&a[1]+b[1]===0) return state;
  return {...state,turns:[...state.turns,direction]};
}
export function advanceSnake(state,random=Math.random) {
  if(state.phase!=='playing') return state;
  const direction=state.turns[0]||state.direction,[dx,dy]=directions[direction];
  const head={x:state.body[0].x+dx,y:state.body[0].y+dy},eats=state.food&&same(head,state.food);
  const wall=head.x<0||head.y<0||head.x>=state.size||head.y>=state.size;
  const hit=(eats?state.body:state.body.slice(0,-1)).some(p=>same(p,head));
  if(wall||hit) return {...state,direction,turns:[],lives:Math.max(0,state.lives-1),phase:state.lives>1?'lost':'finished',reason:wall?'wall':'self'};
  const body=[head,...state.body];if(!eats)body.pop();
  const food=eats?placeJachnun(body,state.size,random):state.food;
  return {...state,body,direction,turns:state.turns.slice(1),food,score:state.score+(eats?1:0),phase:food?'playing':'finished',reason:food?null:'filled'};
}
export function continueSnake(state,random=Math.random) {
  return state.phase==='lost'&&state.lives>0?createSnake({size:state.size,lives:state.lives,score:state.score,random}):state;
}
export const snakeDelay = score => Math.max(105,215-Math.floor(score/3)*9);
export function headCrop(width,height,{zoom=1.5,x=.5,y=.34}={}) {
  const size=Math.min(width,height)/Math.max(1,Math.min(3,zoom));
  return {x:Math.max(0,Math.min(width-size,width*x-size/2)),y:Math.max(0,Math.min(height-size,height*y-size/2)),size};
}
export function snakeCharacters(family={},summaries={}) {
  return Object.values(family).map(p=>({...p,...summaries[p.id]})).filter(p=>p.id&&p.profile&&!p.placeholder&&!p.extra);
}
