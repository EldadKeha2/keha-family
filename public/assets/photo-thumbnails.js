(() => {
  'use strict';
  const scheduled=new Map(),attempted=new Set();let busy=false,pauseTimer=null;
  function schedule(item,image){
    if(item?.kind!=='photo'||item.thumbnailSrc&&(item.previewSrc||!(item.size>1000000))||!item.id||!window.FamilyApp?.apiEnabled||attempted.has(item.src)||scheduled.has(item.src)||scheduled.size>=3||!image?.naturalWidth)return;
    if(!(item.size>250000||image.naturalWidth*image.naturalHeight>2000000)||item.mime==='image/gif')return;
    scheduled.set(item.src,{item,image});setTimeout(run,1000);
  }
  async function run(){
    if(busy||!scheduled.size||document.hidden)return;busy=true;
    if(window.FamilyMedia?.isPhotoBrowsing?.()){busy=false;if(!pauseTimer)pauseTimer=setTimeout(()=>{pauseTimer=null;run();},400);return;}
    const [src,job]=scheduled.entries().next().value;const {item}=job;let image=job.image;scheduled.delete(src);attempted.add(src);
    try{
      if(!image)image=await createImageBitmap(job.file);
      const width=image.naturalWidth||image.width,height=image.naturalHeight||image.height;
      for(const [variant,edge,quality]of [['thumbnail',640,.82],['preview',2048,.85]]){
        if(variant==='thumbnail'&&item.thumbnailSrc||variant==='preview'&&(item.previewSrc||!(item.size>1000000)))continue;
        const ratio=Math.min(1,edge/Math.max(width,height)),canvas=document.createElement('canvas');
        canvas.width=Math.max(1,Math.round(width*ratio));canvas.height=Math.max(1,Math.round(height*ratio));canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
        const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',quality));canvas.width=canvas.height=1;
        if(!blob||item.size>0&&blob.size>=item.size||blob.size>(variant==='preview'?4:1)*1024*1024)continue;
        const response=await window.FamilyI18n.fetch('api/media/'+item.id+'/'+variant+'?revision='+encodeURIComponent(item.photoRevision||'original'),{method:'POST',headers:{'Content-Type':blob.type,'X-Family-Token':window.FAMILY_API_TOKEN},body:blob});
        if(!response.ok)throw Error('Photo copy unavailable');const result=await response.json();
        if(result.item){
          for(const key of ['thumbnailSrc','thumbnailSize','previewSrc','previewSize'])if(result.item[key]!==undefined)item[key]=result.item[key];
          if(item.thumbnailSrc)for(const image of document.querySelectorAll('img[data-thumbnail-id]'))if(image.dataset.thumbnailId===item.id){image.src=item.thumbnailSrc;image.removeAttribute('data-thumbnail-id');}
          window.dispatchEvent(new CustomEvent('family-thumbnail-ready',{detail:result}));
        }
      }
    }catch{}
    finally{if(job.file)image?.close?.();job.resolve?.();busy=false;watch(document);if(scheduled.size)setTimeout(run,100);}
  }
  function fromUpload(result,file){
    if(!file?.type?.startsWith('image/')||file.type==='image/gif'||typeof createImageBitmap!=='function')return;
    const items=[...(result.collection?.items||[]),...(result.person?.gallery||[]),...Object.values(result.albums||{}).flatMap(album=>album.items||[])],item=items.find(item=>item.file===result.file)||result.item;
    if(!item||!(item.size>250000)||scheduled.size>=3||attempted.has(item.src)||scheduled.has(item.src))return;
    return new Promise(resolve=>{scheduled.set(item.src,{item,file,resolve});run();});
  }
  // Existing photos acquire their thumbnail the first time their original is
  // read. Later visits to any grid download only the small shared copy.
  function watch(root){
    for(const image of root.querySelectorAll('img[data-thumbnail-id]')){
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
    if(typeof MutationObserver!=='undefined')new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)if(node.nodeType===1)watch(node.parentElement||node);}).observe(document.body,{childList:true,subtree:true});
  });
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)run();});
  window.FamilyPhotoThumbnails={schedule,attributes,watch,fromUpload};
})();
