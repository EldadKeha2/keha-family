(() => {
  'use strict';
  const prepared=new Map();let motion=null,dragged=null,serial=0;
  const source=item=>item.previewSrc||item.src;
  const photoImage=stage=>stage._familyFaceContext?.image||stage.querySelector('.face-photo-scroll img')||stage.querySelector('.native-photo-pane:nth-child(2) img')||stage.querySelector('img');
  function prepare(item,priority='high',original=false){
    if(item?.kind!=='photo'||typeof Image==='undefined')return null;
    const src=original?item.src:source(item);
    if(prepared.has(src))return prepared.get(src);
    const promise=new Promise((resolve,reject)=>{
      const image=new Image();image.decoding='async';image.fetchPriority=priority;
      const timeout=setTimeout(()=>reject(Error('Photo preparation timed out')),original?30000:10000);
      image.onload=async()=>{clearTimeout(timeout);try{await image.decode?.();}catch{}if(image.naturalWidth)resolve(image);else reject(Error('Photo unavailable'));};
      image.onerror=()=>{clearTimeout(timeout);reject(Error('Photo unavailable'));};image.src=src;
    });
    prepared.set(src,promise);
    promise.catch(()=>{if(prepared.get(src)===promise)prepared.delete(src);});
    while(prepared.size>3)prepared.delete(prepared.keys().next().value);
    return promise;
  }
  function preload(items,index){
    const connection=navigator.connection;
    if(items.length<2||connection?.saveData||/^(slow-)?2g$/.test(connection?.effectiveType||''))return;
    for(const direction of [-1,1]){const next=items[(index+direction+items.length)%items.length];if(next?.kind==='photo'&&!(Number(next.previewSize||next.size)>16*1024*1024))prepare(next,'low')?.catch(()=>{});}
  }
  function cancelDrag(){
    if(!dragged)return;dragged.node.style.transform='';dragged.stage.classList.remove('photo-dragging');dragged=null;
  }
  function cancel(){
    window.FamilyPhotoNative?.reset();
    cancelDrag();if(!motion)return;const previous=motion;motion=null;clearTimeout(previous.timer);
    for(const animation of previous.animations)animation.cancel();previous.ghost.remove();previous.stage.classList.remove('photo-slide-running');
  }
  function drag(stage,dx){
    const node=stage.querySelector('.face-photo-scroll')||stage.querySelector('img');if(!node?.style)return;
    if(motion)cancel();if(dragged?.node!==node){cancelDrag();dragged={node,stage};}
    dragged.dx=Math.max(-stage.clientWidth,Math.min(stage.clientWidth,dx));stage.classList.add('photo-dragging');node.style.transform='translateX('+dragged.dx+'px)';
  }
  function settle(){
    if(!dragged)return;const {node}=dragged,from=node.style.transform;cancelDrag();
    if(from&&!matchMedia('(prefers-reduced-motion: reduce)').matches)node.animate?.([{transform:from},{transform:'translateX(0)'}],{duration:160,easing:'ease-out'});
  }
  function snapshot(stage){
    const image=photoImage(stage);if(!image?.getBoundingClientRect||!image.naturalWidth||!image.animate||matchMedia('(prefers-reduced-motion: reduce)').matches)return null;
    const r=image.getBoundingClientRect(),s=stage.getBoundingClientRect(),ghost=document.createElement('div');
    ghost.className='media-slide-outgoing';ghost.setAttribute('aria-hidden','true');
    ghost.swipeOffset=dragged?.stage===stage?dragged.dx||0:0;
    Object.assign(ghost.style,{position:'absolute',left:r.left-s.left+'px',top:r.top-s.top+'px',width:r.width+'px',height:r.height+'px',backgroundImage:'url('+JSON.stringify(image.currentSrc||image.src)+')',backgroundSize:'100% 100%',backgroundRepeat:'no-repeat',pointerEvents:'none',zIndex:'6'});
    return ghost;
  }
  function slide(stage,ghost,direction){
    if(!ghost)return;cancel();const image=photoImage(stage);if(!image?.animate)return;
    const distance=stage.clientWidth*direction,offset=ghost.swipeOffset||0,id=++serial;stage.classList.add('photo-slide-running');stage.append(ghost);
    const options={duration:Math.max(140,Math.min(300,300*(1-Math.min(.6,Math.abs(offset)/stage.clientWidth)))),easing:'cubic-bezier(.22,.61,.36,1)',fill:'both'};
    const animations=[ghost.animate([{transform:'translateX(0)'},{transform:'translateX('+(-distance-offset)+'px)'}],options),image.animate([{transform:'translateX('+(distance+offset)+'px)'},{transform:'translateX(0)'}],options)];
    const finish=()=>{if(motion?.id!==id)return;cancel();window.FamilyFaces?.fit();window.FamilyMedia?.refreshPhotoPresentation?.();};
    motion={id,stage,ghost,animations,timer:setTimeout(finish,400)};
    Promise.all(animations.map(animation=>animation.finished.catch(()=>{}))).then(finish);
  }
  window.FamilyPhotoPresentation={source,prepare,preload,snapshot,slide,drag,settle,cancel};
})();
