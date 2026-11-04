export const PUZZLE_LEVELS=[10,50,100];

export function puzzleGrid(count,aspect=1.5){
  if(!PUZZLE_LEVELS.includes(count))throw new RangeError('Unsupported puzzle size');
  if(!Number.isFinite(aspect)||aspect<=0)throw new RangeError('Invalid photo dimensions');
  let best=null;
  for(let rows=1;rows<=count;rows++)if(count%rows===0){
    const cols=count/rows,score=Math.abs(Math.log((cols/rows)/aspect));
    if(!best||score<best.score)best={cols,rows,score};
  }
  return {cols:best.cols,rows:best.rows};
}

const number=value=>Number(value.toFixed(3));
// Each contour is symmetric, so reversing a shared edge produces an exact fit.
function edgePath(ax,ay,bx,by,nx,ny,sign,depth){
  const at=(t,d=0)=>number(ax+(bx-ax)*t+nx*d*sign)+' '+number(ay+(by-ay)*t+ny*d*sign);
  if(!sign)return 'L'+at(1);
  return 'L'+at(.35)+' C'+at(.4)+' '+at(.42)+' '+at(.42,depth*.2)+
    ' C'+at(.42,depth*.45)+' '+at(.36,depth*.55)+' '+at(.36,depth*.8)+
    ' C'+at(.36,depth*1.25)+' '+at(.64,depth*1.25)+' '+at(.64,depth*.8)+
    ' C'+at(.64,depth*.55)+' '+at(.58,depth*.45)+' '+at(.58,depth*.2)+
    ' C'+at(.58)+' '+at(.6)+' '+at(.65)+' L'+at(1);
}

export function makePuzzle(count,aspect=1.5,random=Math.random){
  const {cols,rows}=puzzleGrid(count,aspect),width=1000,height=width/aspect,cw=width/cols,ch=height/rows,depth=Math.min(cw,ch)*.19,pad=depth*1.4;
  const sign=()=>random()<.5?-1:1;
  const horizontal=Array.from({length:Math.max(0,rows-1)},()=>Array.from({length:cols},sign));
  const vertical=Array.from({length:rows},()=>Array.from({length:Math.max(0,cols-1)},sign));
  const pieces=Array.from({length:count},(_,id)=>{
    const row=Math.floor(id/cols),col=id%cols,edges={top:row?-horizontal[row-1][col]:0,right:col<cols-1?vertical[row][col]:0,bottom:row<rows-1?horizontal[row][col]:0,left:col?-vertical[row][col-1]:0};
    const path='M0 0 '+edgePath(0,0,cw,0,0,-1,edges.top,depth)+' '+edgePath(cw,0,cw,ch,1,0,edges.right,depth)+' '+edgePath(cw,ch,0,ch,0,1,edges.bottom,depth)+' '+edgePath(0,ch,0,0,-1,0,edges.left,depth)+' Z';
    return {id,row,col,edges,path,x:col*cw,y:row*ch};
  });
  return {count,cols,rows,width,height,cw,ch,pad,pieces};
}

export function fitsPuzzleSlot(layout,piece,x,y){
  return Number.isFinite(x)&&Number.isFinite(y)&&x>=0&&x<=1&&y>=0&&y<=1&&
    Math.abs(x-(piece.col+.5)/layout.cols)<=.48/layout.cols&&Math.abs(y-(piece.row+.5)/layout.rows)<=.48/layout.rows;
}

export function shuffledPieces(pieces,random=Math.random){
  const result=[...pieces];
  for(let i=result.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}
  return result;
}
