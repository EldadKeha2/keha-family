(() => {
  'use strict';
  const scheduled=new Map(),attempted=new Set(),rejectedPreviews=new Set(),visibility=new WeakMap();let busy=false,pauseTimer=null;
  const constrained=()=>typeof navigator!=='undefined'&&(navigator.connection?.saveData||/^(slow-)?2g$/.test(navigator.connection?.effectiveType||''));
  function source(item){return item.previewSrc&&!rejectedPreviews.has(item.previewSrc)?item.previewSrc:item.src;}
  function visiblePixels(image){
    if(!(image?.naturalWidth||image?.width))return false;
    const key=image.currentSrc||image.src||'',cached=visibility.get(image);if(cached?.key===key)return cached.visible;
    let visible=true;
    try{const c=document.createElement('canvas');c.width=c.height=16;const ctx=c.getContext('2d');ctx.drawImage(image,0,0,16,16);const pixels=ctx.getImageData(0,0,16,16).data;visible=false;for(let i=3;i<pixels.length;i+=4)if(pixels[i]){visible=true;break;}c.width=c.height=1;}catch{/* Cross-origin images keep their normal loading path. */}
    visibility.set(image,{key,visible});return visible;
  }
  function rejectPreview(item){if(item.previewSrc){rejectedPreviews.add(item.previewSrc);attempted.delete(item.src);}}
  function bind(item,image){
    if(!item.previewSrc)return;
    const recover=()=>{if(image.getAttribute('src')!==item.src){rejectPreview(item);image.src=item.src;return true;}return false;};
    image.addEventListener('error',recover);
    image.addEventListener('load',()=>{if(!visiblePixels(image))recover();});
    if(image.complete&&image.naturalWidth&&!visiblePixels(image))recover();
  }
  function schedule(item,image){
    if(item?.kind!=='photo'||item.thumbnailSrc&&(source(item)!==item.src||!(item.size>1000000))||!item.id||!window.FamilyApp?.apiEnabled||attempted.has(item.src)||scheduled.has(item.src)||scheduled.size>=3||!image?.naturalWidth)return;
    if(!(item.size>250000||image.naturalWidth*image.naturalHeight>2000000)||item.mime==='image/gif')return;
    scheduled.set(item.src,{item,image});setTimeout(run,1000);
  }
  async function run(){
    if(busy||!scheduled.size||document.hidden||constrained())return;busy=true;
    if(window.FamilyMedia?.isPhotoBrowsing?.()){busy=false;if(!pauseTimer)pauseTimer=setTimeout(()=>{pauseTimer=null;run();},400);return;}
    const [src,job]=scheduled.entries().next().value;const {item}=job;let image=job.image,bitmap=null,snapshot=null;scheduled.delete(src);attempted.add(src);
    try{
      if(!image)image=bitmap=await createImageBitmap(job.file);
      // The live grid image can change src after its thumbnail is saved. Freeze
      // its decoded pixels before the first await so the preview cannot go blank.
      const originalWidth=image.naturalWidth||image.width,originalHeight=image.naturalHeight||image.height,scale=Math.min(1,2048/Math.max(originalWidth,originalHeight));
      snapshot=document.createElement('canvas');snapshot.width=Math.max(1,Math.round(originalWidth*scale));snapshot.height=Math.max(1,Math.round(originalHeight*scale));snapshot.getContext('2d').drawImage(image,0,0,snapshot.width,snapshot.height);bitmap?.close?.();bitmap=null;
      if(!visiblePixels(snapshot))return;image=snapshot;
      const width=image.width,height=image.height;
      for(const [variant,edge,quality]of [['thumbnail',640,.82],['preview',2048,.85]]){
        if(variant==='thumbnail'&&item.thumbnailSrc||variant==='preview'&&(source(item)!==item.src||!(item.size>1000000)))continue;
        const ratio=Math.min(1,edge/Math.max(width,height)),canvas=document.createElement('canvas');
        canvas.width=Math.max(1,Math.round(width*ratio));canvas.height=Math.max(1,Math.round(height*ratio));canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
        const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',quality));canvas.width=canvas.height=1;
        if(!blob||item.size>0&&blob.size>=item.size||blob.size>(variant==='preview'?4:1)*1024*1024)continue;
        const response=await window.FamilyI18n.fetch('api/media/'+item.id+'/'+variant+'?revision='+encodeURIComponent(item.photoRevision||'original')+(variant==='preview'&&rejectedPreviews.has(item.previewSrc)?'&replace=1':''),{method:'POST',headers:{'Content-Type':blob.type,'X-Family-Token':window.FAMILY_API_TOKEN},body:blob});
        if(!response.ok)throw Error('Photo copy unavailable');const result=await response.json();
        if(result.item){
          for(const key of ['thumbnailSrc','thumbnailSize','previewSrc','previewSize'])if(result.item[key]!==undefined)item[key]=result.item[key];
          if(item.thumbnailSrc)for(const image of document.querySelectorAll('img[data-thumbnail-id]'))if(image.dataset.thumbnailId===item.id){image.src=item.thumbnailSrc;image.removeAttribute('data-thumbnail-id');}
          window.dispatchEvent(new CustomEvent('family-thumbnail-ready',{detail:result}));
        }
      }
    }catch{}
    finally{bitmap?.close?.();if(snapshot)snapshot.width=snapshot.height=1;busy=false;watch(document);if(scheduled.size)setTimeout(run,100);}
  }
  function fromUpload(result,file){
    if(!file?.type?.startsWith('image/')||file.type==='image/gif'||typeof createImageBitmap!=='function')return;
    const items=[...(result.collection?.items||[]),...(result.person?.gallery||[]),...Object.values(result.albums||{}).flatMap(album=>album.items||[])],item=items.find(item=>item.file===result.file)||result.item;
    if(!item||!(item.size>250000)||scheduled.size>=3||attempted.has(item.src)||scheduled.has(item.src))return;
    // Copies are optional background work. Never make the next upload wait for
    // a visible page, idle browsing, image decoding or canvas encoding. The
    // bounded queue resumes on visibilitychange; other photos get copies when
    // their originals are first viewed, through watch()/schedule().
    scheduled.set(item.src,{item,file});void run();
  }
  // Existing photos acquire their thumbnail the first time their original is
  // read. Later visits to any grid download only the small shared copy.
  function watch(root){
    for(const image of [...(root.matches?.('img[data-thumbnail-id]')?[root]:[]),...root.querySelectorAll('img[data-thumbnail-id]')]){
      const ready=()=>{
        if(!image.isConnected)return;
        schedule({id:image.dataset.thumbnailId,kind:'photo',mime:image.dataset.thumbnailMime,size:Number(image.dataset.thumbnailSize)||0,src:image.getAttribute('src'),photoRevision:image.dataset.thumbnailRevision},image);
      };
      if(image.complete&&image.naturalWidth)ready();else if(!image.dataset.thumbnailWatching){image.dataset.thumbnailWatching='true';image.addEventListener('load',ready,{once:true});}
    }
  }
  function attributes(item){
    if(item.thumbnailSrc||item.kind!=='photo'||item.mime==='image/gif')return '';
    const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    return `data-thumbnail-id="${esc(item.id)}" data-thumbnail-size="${Number(item.size)||0}" data-thumbnail-mime="${esc(item.mime)}" data-thumbnail-revision="${esc(item.photoRevision||'original')}"`;
  }
  document.addEventListener('DOMContentLoaded',()=>{
    watch(document);
    if(typeof MutationObserver!=='undefined')new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)if(node.nodeType===1)watch(node);}).observe(document.body,{childList:true,subtree:true});
  });
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)run();});
  if(typeof navigator!=='undefined')navigator.connection?.addEventListener?.('change',()=>run());
  window.FamilyPhotoThumbnails={schedule,attributes,watch,fromUpload,source,visiblePixels,rejectPreview,bind};
})();
