(() => {
  'use strict';
  const players=new WeakMap();
  const durations=new Map(),validDuration=value=>Number.isFinite(Number(value))&&Number(value)>0?Number(value):null;
  const durationKey=item=>String(item.id||item.file||item.src)+'|'+(item.videoRevision||'original');
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function duration(item){
    const explicit=validDuration(item.duration);if(explicit)return explicit;
    if(item.youtubeStart!==undefined&&item.youtubeEnd!==undefined){const clipped=validDuration(Number(item.youtubeEnd)-Number(item.youtubeStart));if(clipped)return clipped;}
    for(const source of item.playbackSources||[]){const revision=source?.src?.match(/[?&]v=([^&#]*)/);if(revision&&revision[1]!==encodeURIComponent(item.videoRevision||'original'))continue;const value=validDuration(source?.duration);if(value)return value;}
    return durations.get(durationKey(item))||null;
  }
  function durationText(value){const seconds=Math.floor(value);return Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');}
  function durationBadge(item){
    const value=duration(item),key=escape(durationKey(item));
    // Prepared posters carry no media metadata. Only a local film still
    // missing its duration needs a metadata request through the preview queue.
    const probe=!value&&item.poster&&item.provider!=='youtube'?`<video class="video-duration-probe" muted playsinline preload="none" tabindex="-1" aria-hidden="true" data-preview-src="${escape(src(item))}"></video>`:'';
    return probe+`<span class="video-tile-duration" data-video-duration="${key}" aria-hidden="true"${value?'':' hidden'}>${value?durationText(value):''}</span>`;
  }
  function rememberDuration(video,item=players.get(video)?.item){
    const value=validDuration(video?.duration);if(!value)return;
    const badge=video.closest?.('.video-tile-cover')?.querySelector('.video-tile-duration'),key=item?durationKey(item):badge?.dataset.videoDuration;if(!key)return;
    durations.delete(key);durations.set(key,value);if(durations.size>256)durations.delete(durations.keys().next().value);
    if(typeof document!=='undefined')for(const label of document.querySelectorAll?.('.video-tile-duration[data-video-duration]')||[])if(label.dataset.videoDuration===key){label.textContent=durationText(value);label.hidden=false;}
  }
  function sources(item){
    const rows=[{quality:'original',src:item.faststartSrc||item.src,mime:item.mime,rank:3}];
    for(const entry of item.playbackSources||[]){
      if(!entry?.src||!['low','medium'].includes(entry.quality))continue;
      rows.push({...entry,rank:entry.quality==='medium'?2:1});
    }
    return rows.filter((row,index,all)=>row.src&&all.findIndex(other=>other.src===row.src)===index).sort((a,b)=>a.rank-b.rank);
  }
  function desiredRank(){
    const link=window.navigator?.connection;
    if(link?.saveData||/^(slow-)?2g$/.test(link?.effectiveType||'')||link?.effectiveType==='3g')return 1;
    if(Number(link?.downlink)>0&&Number(link.downlink)<2)return 2;
    return 3;
  }
  function selected(item){
    const available=sources(item),rank=desiredRank();
    return available.filter(row=>row.rank<=rank).at(-1)||available[0];
  }
  function src(item){return selected(item)?.src||item.src;}
  function bind(video,item){
    if(!video||item?.kind!=='video'||item.provider==='youtube')return;
    const key=String(item.id||item.src)+'|'+(item.videoRevision||'original'),previous=players.get(video);
    if(previous?.key===key){if(item.poster)video.poster=item.poster;return previous;}
    previous?.dispose();
    const available=sources(item),initial=selected(item);if(!initial)return;
    let current=initial,disposed=false,restoring=null,stallTimer=null;
    const failed=new Set(),listeners=[];
    const on=(name,fn)=>{video.addEventListener(name,fn);listeners.push([name,fn]);};
    const clearStall=()=>{if(stallTimer!==null)clearTimeout(stallTimer);stallTimer=null;};
    function change(next){
      if(disposed||!next||next.src===current.src)return false;
      clearStall();
      restoring||={time:Number(video.currentTime)||0,playing:!video.paused,rate:video.playbackRate,volume:video.volume,muted:video.muted};
      current=next;video.src=next.src;video.load();return true;
    }
    on('loadedmetadata',()=>{
      rememberDuration(video,item);
      if(!restoring)return;const saved=restoring;restoring=null;
      try{video.currentTime=Number.isFinite(video.duration)?Math.min(saved.time,Math.max(0,video.duration-.05)):saved.time;}catch{}
      video.playbackRate=saved.rate;video.volume=saved.volume;video.muted=saved.muted;
      if(saved.playing)try{video.play()?.catch(()=>{});}catch{}
    });
    on('error',event=>{
      if(disposed||!video.isConnected||!video.getAttribute('src'))return;
      clearStall();failed.add(current.src);
      // Prepared copies are optional. A failed copy can always return to the
      // preserved original, even when a browser dislikes the derived codec.
      const candidates=[...available.filter(row=>row.rank<=current.rank).reverse(),...available.filter(row=>row.rank>current.rank)];
      let next=candidates.find(row=>!failed.has(row.src));
      if(!next&&item.src&&!failed.has(item.src))next={src:item.src,rank:3,quality:'original'};
      if(change(next))event.stopImmediatePropagation?.();
    });
    on('waiting',()=>{
      if(disposed||video.paused||restoring||stallTimer!==null)return;
      // Short seeks and ordinary buffering should not restart playback. Only
      // a sustained stall steps down, and quality never oscillates mid-video.
      stallTimer=setTimeout(()=>{
        stallTimer=null;if(disposed||!video.isConnected||video.paused||video.readyState>=3)return;
        const next=available.filter(row=>row.rank<current.rank&&!failed.has(row.src)).at(-1);change(next);
      },5000);
    });
    for(const event of ['playing','canplay','pause','ended','seeking','emptied'])on(event,clearStall);
    const state={item,key,dispose(){disposed=true;clearStall();restoring=null;for(const [name,fn]of listeners)video.removeEventListener(name,fn);if(players.get(video)===state)players.delete(video);}};
    players.set(video,state);
    video.poster=item.poster||'';
    if(video.hasAttribute('data-preview-src'))video.dataset.previewSrc=initial.src;else video.src=initial.src;
    return state;
  }
  function release(video){players.get(video)?.dispose();}
  if(typeof document!=='undefined')document.addEventListener('loadedmetadata',event=>rememberDuration(event.target),true);
  window.FamilyVideoDelivery={src,bind,release,duration,durationBadge};
})();
