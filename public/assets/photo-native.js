(() => {
  'use strict';
  let active=null;
  const desktop=()=>!matchMedia('(max-width:700px)').matches&&!/Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(navigator.userAgent||'');
  function reset(stage){
    if(!active||stage&&active.stage!==stage)return;
    const b=active;active=null;clearTimeout(b.timer);b.resize?.disconnect();
    b.viewport.before(b.node);b.viewport.remove();b.stage.classList.remove('has-native-photo-strip');
  }
  function has(stage){return active?.stage===stage;}
  function mount(stage,{previous,next,isEnglish,enabled,step}){
    if(stage?.nodeType!==1||!desktop()||!enabled()){reset(stage);return false;}
    const node=stage.querySelector('.face-photo-scroll')||(!stage._familyFaceContext?stage.querySelector('img'):null);
    if(!node)return false;
    if(active?.stage===stage&&active.node===node)return true;
    reset();const viewport=document.createElement('div');viewport.className='native-photo-strip';viewport.dir='ltr';
    const left=document.createElement('div'),center=document.createElement('div'),right=document.createElement('div');
    for(const pane of [left,center,right]){pane.className='native-photo-pane';viewport.append(pane);}
    const side=(pane,item)=>{
      pane.setAttribute('aria-hidden','true');if(!item)return;
      const image=document.createElement('img');image.alt='';image.decoding='async';image.fetchPriority='low';image.draggable=false;
      const source=item.previewSrc||item.thumbnailSrc||(item.size<1000000?item.src:null);
      if(source&&item.kind==='photo'){image.src=source;pane.append(image);}
    };
    side(left,isEnglish?previous:next);side(right,isEnglish?next:previous);
    node.before(viewport);center.append(node);stage.classList.add('has-native-photo-strip');
    const b=active={stage,node,viewport,center,width:viewport.clientWidth,locked:false,timer:null};
    viewport.scrollLeft=b.width;
    const finish=()=>{
      if(active!==b||b.locked||!b.width)return;
      const page=Math.round(viewport.scrollLeft/b.width);
      if(page===1)return;
      if(!enabled()){viewport.scrollLeft=b.width;return;}
      b.locked=true;
      const direction=(page>1?1:-1)*(isEnglish?1:-1);
      Promise.resolve(step(direction,{native:true})).finally(()=>{if(active===b){b.locked=false;viewport.scrollLeft=b.width;}});
    };
    viewport.addEventListener('scroll',()=>{if(active!==b||b.locked)return;clearTimeout(b.timer);b.timer=setTimeout(finish,120);},{passive:true});
    viewport.addEventListener('scrollend',finish,{passive:true});
    if(typeof ResizeObserver!=='undefined'){
      b.resize=new ResizeObserver(()=>{if(active===b&&!b.locked&&Math.abs(viewport.clientWidth-b.width)>1){b.width=viewport.clientWidth;viewport.scrollLeft=b.width;}});b.resize.observe(viewport);
    }
    return true;
  }
  window.FamilyPhotoNative={mount,reset,has};
})();
