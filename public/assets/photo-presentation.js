(() => {
  'use strict';
  const prepared=new Map();let motion=null,dragged=null,serial=0;
  function prepare(item,priority='high'){
    if(item?.kind!=='photo'||typeof Image==='undefined')return null;
    if(prepared.has(item.src))return prepared.get(item.src);
    const promise=new Promise((resolve,reject)=>{
      const image=new Image();image.decoding='async';image.fetchPriority=priority;
      const timeout=setTimeout(()=>reject(Error('Photo preparation timed out')),10000);
      image.onload=async()=>{clearTimeout(timeout);try{await image.decode?.();}catch{}if(image.naturalWidth)resolve(image);else reject(Error('Photo unavailable'));};
      image.onerror=()=>{clearTimeout(timeout);reject(Error('Photo unavailable'));};image.src=item.src;
    });
    prepared.set(item.src,promise);
    promise.catch(()=>{if(prepared.get(item.src)===promise)prepared.delete(item.src);});
    // Keep only the current/next decoded photo, rather than a whole large album.
    while(prepared.size>2)prepared.delete(prepared.keys().next().value);
    return promise;
  }
  function preload(items,index){
    const connection=navigator.connection;
    if(items.length<2||connection?.saveData||/^(slow-)?2g$/.test(connection?.effectiveType||''))return;
    const next=items[(index+1)%items.length];
    if(next?.kind==='photo'&&!(next.size>16*1024*1024))prepare(next,'low')?.catch(()=>{});
  }
  function cancelDrag(){
    if(!dragged)return;dragged.node.style.transform='';dragged.stage.classList.remove('photo-dragging');dragged=null;
  }
  function cancel(){
    cancelDrag();if(!motion)return;const previous=motion;motion=null;clearTimeout(previous.timer);
    for(const animation of previous.animations)animation.cancel();previous.ghost.remove();previous.stage.classList.remove('photo-slide-running');
  }
  function drag(stage,dx){
    const node=stage.querySelector('.face-photo-scroll')||stage.querySelector('img');if(!node?.style)return;
    if(motion)cancel();if(dragged?.node!==node){cancelDrag();dragged={node,stage};}
    stage.classList.add('photo-dragging');node.style.transform='translateX('+Math.max(-stage.clientWidth,Math.min(stage.clientWidth,dx))+'px)';
  }
  function settle(){
    if(!dragged)return;const {node}=dragged,from=node.style.transform;cancelDrag();
    if(from&&!matchMedia('(prefers-reduced-motion: reduce)').matches)node.animate?.([{transform:from},{transform:'translateX(0)'}],{duration:160,easing:'ease-out'});
  }
  function snapshot(stage){
    const image=stage.querySelector('img');if(!image?.getBoundingClientRect||!image.naturalWidth||!image.animate||matchMedia('(prefers-reduced-motion: reduce)').matches)return null;
    const r=image.getBoundingClientRect(),s=stage.getBoundingClientRect(),ghost=document.createElement('div');
    ghost.className='media-slide-outgoing';ghost.setAttribute('aria-hidden','true');
    Object.assign(ghost.style,{position:'absolute',left:r.left-s.left+'px',top:r.top-s.top+'px',width:r.width+'px',height:r.height+'px',backgroundImage:'url('+JSON.stringify(image.currentSrc||image.src)+')',backgroundSize:'100% 100%',backgroundRepeat:'no-repeat',pointerEvents:'none',zIndex:'6'});
    return ghost;
  }
  function slide(stage,ghost,direction){
    if(!ghost)return;cancel();const image=stage.querySelector('img');if(!image?.animate)return;
    const distance=stage.clientWidth*direction,id=++serial;stage.classList.add('photo-slide-running');stage.append(ghost);
    const options={duration:360,easing:'cubic-bezier(.22,.61,.36,1)',fill:'both'};
    const animations=[ghost.animate([{transform:'translateX(0)'},{transform:'translateX('+(-distance)+'px)'}],options),image.animate([{transform:'translateX('+distance+'px)'},{transform:'translateX(0)'}],options)];
    const finish=()=>{if(motion?.id!==id)return;cancel();window.FamilyFaces?.fit();};
    motion={id,stage,ghost,animations,timer:setTimeout(finish,400)};
    Promise.all(animations.map(animation=>animation.finished.catch(()=>{}))).then(finish);
  }
  window.FamilyPhotoPresentation={prepare,preload,snapshot,slide,drag,settle,cancel};
})();
