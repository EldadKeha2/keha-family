import {timelineTracks} from './family-timeline-data.mjs?v=shared-axis-v5';

// All generations use one date-to-pixel mapping, including the 1988 descendants.
export function overviewLayout(model,width,zoom=1,today=new Date()){
  const years=model.events.map(e=>e.year),start=Math.floor(Math.min(...years,today.getFullYear())/10)*10;
  const end=Math.max(start+10,Math.ceil(Math.max(...years,today.getFullYear())/10)*10),canvasWidth=Math.max(200,width)*zoom;
  const x=year=>28+(year-start)/(end-start)*(canvasWidth-56);
  const tracks=timelineTracks(model).map(track=>{
    const groups=[];
    for(const event of track.events){
      let group=groups.at(-1);
      if(!group||x(event.year)-group.x>=66){group={key:`${track.generation}-${groups.length}`,generation:track.generation,start:event.year,end:event.year,x:x(event.year),events:[]};groups.push(group);}
      group.events.push(event);group.end=event.year;group.x=group.events.reduce((sum,e)=>sum+x(e.year),0)/group.events.length;
    }
    for(const group of groups){group.x=group.events.reduce((sum,e)=>sum+x(e.year),0)/group.events.length;group.label=group.start===group.end?String(group.start):`${group.start}–${group.end}`;}
    return {...track,groups,origin:start,axisEnd:end};
  });
  return {start,end,width:canvasWidth,tracks,x};
}

export function mountTimelineOverview(root,{model,view,labels,preview,details,eventLabel,href,tr}){
  let layout,width=0,groups=new Map(),selection=null,drag=null,suppressClick=false;
  root.innerHTML=`<div class="ft-overview-tools" role="group" aria-label="${tr('גודל תצוגת הציר','Timeline zoom')}"><button type="button" data-overview-zoom="out" aria-label="${tr('הרחקת ציר הזמן','Zoom out')}">−</button><button type="button" data-overview-zoom="fit" aria-label="${tr('כל השנים במסך','Fit all years')}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4H4v4m12-4h4v4M4 16v4h4m12-4v4h-4"/></svg></button><button type="button" data-overview-zoom="in" aria-label="${tr('הגדלת ציר הזמן','Zoom in')}">+</button></div><div class="ft-overview-board"><div class="ft-overview-labels"><div class="ft-overview-label-spacer"></div>${labels.map((label,i)=>`<div class="ft-overview-label ft-generation-${i+1}"><span>${label}</span></div>`).join('')}</div><div class="ft-overview-viewport" tabindex="0" role="group" aria-label="${tr('ארבעת הדורות על סרגל שנים משותף. אפשר להגדיל ולגרור ימינה ושמאלה.','Four generations on one time scale. Zoom in and drag left or right.')}"><div class="ft-overview-ruler"></div><div class="ft-overview-rows"></div></div><div class="ft-overview-detail" hidden><button type="button" class="ft-overview-close" aria-label="${tr('סגירת פרטי השנה','Close year details')}">×</button><strong class="ft-overview-detail-year"></strong><ul class="ft-overview-detail-events"></ul></div></div>`;
  const viewport=root.querySelector('.ft-overview-viewport'),ruler=root.querySelector('.ft-overview-ruler'),rows=root.querySelector('.ft-overview-rows'),detail=root.querySelector('.ft-overview-detail');
  const close=()=>{detail.hidden=true;selection=null;};
  function position(){
    const max=Math.max(0,layout.width-width);view.offset=Math.max(0,Math.min(max,view.offset));
    for(const world of root.querySelectorAll('[data-overview-world]'))world.style.transform=`translateX(${-view.offset}px)`;
    root.classList.toggle('is-zoomed',view.zoom>1);
    root.querySelector('[data-overview-zoom="out"]').disabled=view.zoom<=1;
    root.querySelector('[data-overview-zoom="in"]').disabled=view.zoom>=4;
  }
  function paint(){
    close();width=viewport.clientWidth||640;layout=overviewLayout(model,width,view.zoom);groups=new Map(layout.tracks.flatMap(t=>t.groups.map(g=>[g.key,g])));
    const interval=layout.x(layout.start+10)-layout.x(layout.start)<66?20:10,ticks=[];
    for(let year=layout.start;year<=layout.end;year++){
      const major=year%10===0,label=year===layout.start||year%interval===0;
      ticks.push(`<span class="ft-overview-tick${major?' is-major':year%5===0?' is-half':''}" style="left:${layout.x(year)}px" data-overview-year="${year}">${label?`<bdi>${year}</bdi>`:''}</span>`);
    }
    ruler.innerHTML=`<div data-overview-world style="width:${layout.width}px">${ticks.join('')}</div>`;
    rows.innerHTML=layout.tracks.map(track=>`<div class="ft-overview-row ft-generation-${track.generation}" data-overview-generation="${track.generation}"><div data-overview-world style="width:${layout.width}px;--decade-width:${layout.x(layout.start+10)-layout.x(layout.start)}px"><span class="ft-overview-line" aria-hidden="true"></span>${track.years.map(year=>`<i class="ft-overview-anchor" data-birth-year="${year}" style="left:${layout.x(year)}px" aria-hidden="true"></i>`).join('')}${track.groups.map(group=>{
      const url=group.events.length===1?href(group.events[0]):null,tag=url?'a':'button';
      return `<${tag}${url?` href="${url}"`:' type="button"'} class="ft-overview-node${group.events.length>1?' is-cluster':''}" data-overview-group="${group.key}" style="left:${group.x}px" aria-label="${eventLabel(group.events)}"><span class="ft-overview-thumbs">${preview(group.events)}</span>${group.events.length>1?`<span class="ft-overview-count">${group.events.length}</span>`:''}<bdi>${group.label}</bdi></${tag}>`;
    }).join('')}</div></div>`).join('');position();
  }
  function show(node){
    const group=groups.get(node.dataset.overviewGroup);if(!group||selection===group.key&&!detail.hidden)return;
    selection=group.key;detail.querySelector('.ft-overview-detail-year').textContent=group.label;detail.querySelector('ul').innerHTML=details(group.events);detail.hidden=false;
    const board=root.querySelector('.ft-overview-board').getBoundingClientRect(),rect=node.getBoundingClientRect(),card=detail.getBoundingClientRect();
    detail.style.left=Math.max(8,Math.min(board.width-card.width-8,rect.left+rect.width/2-board.left-card.width/2))+'px';
    const below=rect.bottom-board.top+9,above=rect.top-board.top-card.height-9;
    detail.style.top=(below+card.height>board.height&&above>=0?above:below)+'px';
  }
  function onClick(event){
    const control=event.target.closest('[data-overview-zoom]');
    if(control){
      const old=view.zoom,next=control.dataset.overviewZoom==='fit'?1:Math.max(1,Math.min(4,old+(control.dataset.overviewZoom==='in'?.5:-.5)));
      const center=(view.offset+width/2)/(width*old);view.zoom=next;view.offset=next===1?0:center*width*next-width/2;paint();return;
    }
    if(event.target.closest('.ft-overview-close')){close();return;}
    const node=event.target.closest('[data-overview-group]');if(node)show(node);
  }
  function onPointerDown(event){
    suppressClick=false;if(event.isPrimary===false){endPan();return;}
    if(event.button!==0||view.zoom<=1||!event.target.closest('.ft-overview-viewport'))return;
    drag={id:event.pointerId,x:event.clientX,y:event.clientY,offset:view.offset,moved:false};
  }
  function onPointerMove(event){
    if(!drag||drag.id!==event.pointerId)return;
    const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
    if(!drag.moved){if(Math.max(Math.abs(dx),Math.abs(dy))<7)return;if(Math.abs(dy)>Math.abs(dx)){drag=null;return;}drag.moved=true;viewport.setPointerCapture(event.pointerId);root.classList.add('is-panning');close();}
    event.preventDefault();view.offset=drag.offset-dx;position();
  }
  function endPan(event){
    if(!drag||event&&drag.id!==event.pointerId)return;
    const previous=drag;drag=null;suppressClick=previous.moved;root.classList.remove('is-panning');
    if(viewport.hasPointerCapture?.(previous.id))viewport.releasePointerCapture(previous.id);
  }
  function onCaptureClick(event){if(suppressClick&&event.detail!==0){suppressClick=false;event.preventDefault();event.stopImmediatePropagation();}}
  function onHover(event){if(event.pointerType==='touch')return;const node=event.target.closest('[data-overview-group]');if(node&&!drag)show(node);}
  function onFocus(event){const node=event.target.closest('[data-overview-group]');if(node)show(node);}
  function onKey(event){if(event.key==='Escape')close();if(event.target===viewport&&['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();close();view.offset+=(event.key==='ArrowRight'?1:-1)*width/4;position();}}
  function onWheel(event){if(event.ctrlKey||view.zoom<=1)return;const delta=event.shiftKey&&!event.deltaX?event.deltaY:event.deltaX;if(!delta||!event.shiftKey&&Math.abs(event.deltaY)>Math.abs(delta))return;event.preventDefault();close();view.offset+=delta*(event.deltaMode===1?16:event.deltaMode===2?width:1);position();}
  function onOutside(event){if(!root.contains(event.target))close();}
  function onDragStart(event){if(event.target.closest('.ft-overview-viewport'))event.preventDefault();}
  const events=[['click',onClick],['click',onCaptureClick,true],['pointerdown',onPointerDown],['pointermove',onPointerMove,{passive:false}],['pointerup',endPan],['pointercancel',endPan],['lostpointercapture',endPan],['pointerover',onHover],['focusin',onFocus],['keydown',onKey],['dragstart',onDragStart]];
  for(const [type,fn,options]of events)root.addEventListener(type,fn,options);
  viewport.addEventListener('wheel',onWheel,{passive:false});document.addEventListener('pointerdown',onOutside);
  const observer=new ResizeObserver(()=>{if(viewport.clientWidth>0&&Math.abs(viewport.clientWidth-width)>1)paint();});observer.observe(viewport);paint();
  return ()=>{observer.disconnect();endPan();for(const [type,fn,options]of events)root.removeEventListener(type,fn,options);viewport.removeEventListener('wheel',onWheel);document.removeEventListener('pointerdown',onOutside);};
}
