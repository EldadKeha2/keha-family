const WIDTH=1120,ROW_GAP=96,PER_BOUGH=7;
const chunks=(items,size)=>Array.from({length:Math.ceil(items.length/size)},(_,i)=>items.slice(i*size,(i+1)*size));

// Oldest births take root below; newer decades grow toward the crown.
export function enchantedTreeLayout(chapters){
  const rows=chapters.reduce((sum,c)=>sum+Math.max(1,Math.ceil(c.events.filter(e=>e.kind==='birth').length/PER_BOUGH)),0);
  const height=Math.max(1320,rows*ROW_GAP+180),boughs=[],people=[],decades=[];let y=height-150;
  chapters.forEach((chapter,chapterIndex)=>{
    const births=chapter.events.filter(e=>e.kind==='birth'),groups=chunks(births,PER_BOUGH);
    decades.push({id:chapter.id,x:chapterIndex%2?972:10,y:y-28,count:births.length});
    for(const [row,group] of (groups.length?groups:[[]]).entries()){
      const bend=22+(chapterIndex%3)*7,left=110+((chapterIndex+row)%3)*12,right=1010-((chapterIndex+row)%2)*17;
      boughs.push({decade:chapter.id,left,right,y,bend});
      const span=group.length>1?Math.min(650,Math.max(220,(group.length-1)*108)):0;
      group.forEach((event,index)=>{
        const x=WIDTH/2-span/2+(group.length>1?span*index/(group.length-1):0),t=(x-left)/(right-left);
        people.push({event,decade:chapter.id,x,y:y+4*bend*t*(1-t)-35,branchY:y+4*bend*t*(1-t)});
      });
      y-=ROW_GAP;
    }
  });
  return {width:WIDTH,height,boughs,people,decades};
}

export function enchantedCohortLayout(chapter){
  const births=chapter?.events.filter(e=>e.kind==='birth')||[],width=380,height=660,groups=chunks(births,5),people=[],boughs=[];
  const root=chapter?.id==='before-1930';
  groups.forEach((group,row)=>{
    const base=root?472:groups.length===1?245:415-row*Math.min(105,285/(groups.length-1)),span=group.length>1?Math.min(286,Math.max(112,(group.length-1)*67)):0;
    boughs.push({decade:chapter.id,left:29,right:351,y:base+28,bend:17});
    group.forEach((event,index)=>{
      const x=width/2-span/2+(group.length>1?span*index/(group.length-1):0),t=(x-29)/322;
      people.push({event,decade:chapter.id,x,y:base+4*17*t*(1-t)-7,branchY:base+28+4*17*t*(1-t)});
    });
  });
  return {width,height,people,boughs};
}

export function treeBoughPaths(layout,prefix,active='all'){
  return `<svg class="ft-magic-wood" viewBox="0 0 ${layout.width} ${layout.height}" aria-hidden="true" focusable="false"><defs><linearGradient id="${prefix}-bark" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#b39a65"/><stop offset=".4" stop-color="#947446"/><stop offset="1" stop-color="#6f583b"/></linearGradient></defs>${layout.boughs.map((b,index)=>{
    const middle=(b.left+b.right)/2,path=`M${b.left} ${b.y} Q${middle} ${b.y+2*b.bend} ${b.right} ${b.y}`;
    return `<g data-tree-bough="${b.decade}" class="ft-magic-bough${active==='all'||active===b.decade?' is-lit':''}"><path d="${path}" stroke="#614b32" stroke-width="10" opacity=".5"/><path d="${path}" stroke="url(#${prefix}-bark)" stroke-width="7"/><path d="${path}" stroke="#d6bd7c" stroke-width="1" opacity=".65"/><path d="M${layout.width/2} ${b.y+70} Q${layout.width/2-17} ${b.y+44} ${middle} ${b.y+b.bend}" stroke="url(#${prefix}-bark)" stroke-width="6"/>${[b.left,b.right].map((x,i)=>`<g class="ft-magic-leaf" style="--leaf-delay:${index*.37}s"><path d="M${x} ${b.y} q${i?-22:22} -36 ${i?-37:37} -25 q${i?4:-4} 24 ${i?37:-37} 25" fill="${index%2?'#93a17b':'#7b9166'}"/><path d="M${x} ${b.y} l${i?-28:28} -24" stroke="#b6bd91" stroke-width=".8"/></g>`).join('')}</g>`;
  }).join('')}${layout.people.map(p=>`<path class="ft-magic-twig${active==='all'||active===p.decade?' is-lit':''}" data-tree-bough="${p.decade}" d="M${p.x} ${p.branchY} q7 -12 0 -21" stroke="#ab8d55" stroke-width="2"/>`).join('')}</svg>`;
}
