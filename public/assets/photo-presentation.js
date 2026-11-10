(() => {
  'use strict';
  const prepared=new Map(),originals=new Map();let motion=null,dragged=null,serial=0,handoff=null,lastSlide=0;
  const source=item=>item.previewSrc||item.src;
  const mobile=()=>navigator.userAgentData?.mobile===true||/Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(navigator.userAgent||'')||(/Macintosh/i.test(navigator.userAgent||'')&&navigator.maxTouchPoints>1);
  const copy=image=>image?.cloneNode?image.cloneNode(false):image;
  function trim(cache,keep){
    const limit=cache===originals?2:mobile()?5:8,budget=(mobile()?12:24)*1024*1024;
    let pixels=[...cache.values()].reduce((sum,entry)=>sum+entry.pixels,0);
    for(const [key,entry]of cache){if(cache.size<=limit&&pixels<=budget)break;if(key===keep)continue;cache.delete(key);pixels-=entry.pixels;}
  }
  function ready(item){const key=source(item),entry=prepared.get(key);if(!entry?.ready)return null;prepared.delete(key);prepared.set(key,entry);return copy(entry.image);}
  const photoImage=stage=>stage._familyFaceContext?.image||stage.querySelector('.face-photo-scroll img')||stage.querySelector('.native-photo-pane:nth-child(2) img')||stage.querySelector('img');
  function prepare(item,priority='high',original=false){
    if(item?.kind!=='photo'||typeof Image==='undefined')return null;
    const src=original?item.src:source(item),cache=original&&src!==source(item)?originals:prepared;
    if(cache.has(src)){const entry=cache.get(src);cache.delete(src);cache.set(src,entry);if(priority==='high')entry.image.fetchPriority='high';return entry.promise;}
    const image=new Image(),entry={image,promise:null,ready:false,pixels:0};
    const promise=entry.promise=new Promise((resolve,reject)=>{
      image.decoding='async';image.fetchPriority=priority;
      const timeout=setTimeout(()=>reject(Error('Photo preparation timed out')),original?30000:10000);
      image.onload=async()=>{clearTimeout(timeout);try{await image.decode?.();}catch{}if(image.naturalWidth){entry.ready=true;entry.pixels=image.naturalWidth*(image.naturalHeight||1);trim(cache,src);resolve(image);}else reject(Error('Photo unavailable'));};
      image.onerror=()=>{clearTimeout(timeout);reject(Error('Photo unavailable'));};image.src=src;
    });
    cache.set(src,entry);
    promise.catch(()=>{if(cache.get(src)===entry)cache.delete(src);});
    trim(cache,src);
    return promise;
  }
  function preload(items,index){
    const connection=navigator.connection;
    if(items.length<2||connection?.saveData||/^(slow-)?2g$/.test(connection?.effectiveType||''))return;
    const distances=mobile()?[1,-1,2]:[1,-1,2,3,-2,4],seen=new Set([source(items[index]||{})]);
    for(const distance of distances){const next=items[(index+distance+items.length)%items.length];if(next?.kind==='photo'&&!seen.has(source(next))&&!(Number(next.previewSize||next.size)>16*1024*1024)){seen.add(source(next));prepare(next,Math.abs(distance)===1?'high':'low')?.catch(()=>{});}}
  }
  function cancelDrag(){
    if(!dragged)return;dragged.node.style.transform='';dragged.stage.classList.remove('photo-dragging');dragged=null;
  }
  function clearHandoff(token=handoff){if(token&&handoff===token){handoff=null;token.node.remove();}}
  function holdNative(stage,fallback){
    const strip=stage.querySelector('.native-photo-strip'),host=stage.closest?.('#photoFullscreenRoot')||stage.closest?.('dialog');if(!strip||!host)return null;
    const page=Math.round(strip.scrollLeft/strip.clientWidth),shown=strip.children[page]?.querySelector('img'),image=shown?.naturalWidth?shown:fallback;
    if(!image?.naturalWidth||!image.naturalHeight)return null;
    const r=strip.getBoundingClientRect();if(!r.width||!r.height)return null;
    const node=document.createElement('div'),canvas=document.createElement('canvas'),ratio=Math.min(2,window.devicePixelRatio||1);
    canvas.width=Math.ceil(r.width*ratio);canvas.height=Math.ceil(r.height*ratio);const ctx=canvas.getContext('2d');if(!ctx)return null;
    const scale=Math.min(canvas.width/image.naturalWidth,canvas.height/image.naturalHeight),width=image.naturalWidth*scale,height=image.naturalHeight*scale;
    try{ctx.drawImage(image,(canvas.width-width)/2,(canvas.height-height)/2,width,height);}catch{return null;}
    clearHandoff();node.className='photo-transition-cover';node.setAttribute('aria-hidden','true');
    Object.assign(node.style,{position:'fixed',left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px',pointerEvents:'none',zIndex:'8',opacity:'.999',background:getComputedStyle(stage).backgroundColor});
    Object.assign(canvas.style,{display:'block',width:'100%',height:'100%'});node.append(canvas);host.append(node);
    return handoff={node,stage};
  }
  const paintedFrame=()=>new Promise(resolve=>typeof requestAnimationFrame==='function'?requestAnimationFrame(resolve):setTimeout(resolve,0));
  async function finishHandoff(token,image,ready){
    if(!token)return;try{await Promise.all([image.decode?.().catch(()=>{}),ready]);await paintedFrame();await paintedFrame();}finally{clearHandoff(token);}
  }
  function cancel({preserveHandoff=false}={}){
    window.FamilyPhotoNative?.reset();
    if(!preserveHandoff)clearHandoff();
    cancelDrag();if(!motion)return;const previous=motion;motion=null;clearTimeout(previous.timer);
    for(const animation of previous.animations)animation.cancel();previous.ghost.remove();previous.incoming.remove();previous.stage.classList.remove('photo-slide-running');
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
    Object.assign(ghost.style,{position:'absolute',left:r.left-s.left+'px',top:r.top-s.top+'px',width:r.width+'px',height:r.height+'px',backgroundImage:'url('+JSON.stringify(image.currentSrc||image.src)+')',backgroundSize:'contain',backgroundPosition:'center',backgroundColor:stage.closest?.('#photoFullscreenRoot')?'#08090b':'',backgroundRepeat:'no-repeat',pointerEvents:'none',zIndex:'6'});
    return ghost;
  }
  function slide(stage,ghost,direction){
    if(!ghost)return;cancel();const image=photoImage(stage);if(!image?.animate){ghost.remove();return;}
    const now=Date.now(),rapid=now-lastSlide<160&&!ghost.swipeOffset;lastSlide=now;
    if(rapid){ghost.remove();return;}
    // Animate independent pixels, never the image that the face editor resizes
    // and reparents. Fast repeated presses skip motion and show the latest photo.
    const incoming=document.createElement('div');incoming.className='media-slide-incoming';incoming.setAttribute('aria-hidden','true');
    Object.assign(incoming.style,{position:'absolute',inset:'0',backgroundImage:'url('+JSON.stringify(image.currentSrc||image.src)+')',backgroundSize:'contain',backgroundPosition:'center',backgroundRepeat:'no-repeat',backgroundColor:typeof getComputedStyle==='function'?getComputedStyle(stage).backgroundColor:'#ede5d4',pointerEvents:'none',zIndex:'7',willChange:'transform'});
    ghost.style.willChange='transform';
    const distance=stage.clientWidth*direction,offset=ghost.swipeOffset||0,id=++serial;stage.classList.add('photo-slide-running');stage.append(ghost,incoming);
    const options={duration:Math.max(90,160*(1-Math.min(.6,Math.abs(offset)/stage.clientWidth))),easing:'cubic-bezier(.22,.61,.36,1)',fill:'both'};
    const animations=[ghost.animate([{transform:'translateX(0)'},{transform:'translateX('+(-distance-offset)+'px)'}],options),incoming.animate([{transform:'translateX('+(distance+offset)+'px)'},{transform:'translateX(0)'}],options)];
    const finish=()=>{if(motion?.id!==id)return;cancel();window.FamilyFaces?.fit();window.FamilyMedia?.refreshPhotoPresentation?.();};
    motion={id,stage,ghost,incoming,animations,timer:setTimeout(finish,220)};
    Promise.all(animations.map(animation=>animation.finished.catch(()=>{}))).then(finish);
  }
  window.FamilyPhotoPresentation={source,prepare,ready,copy,preload,snapshot,slide,drag,settle,cancel,holdNative,finishHandoff};
})();
