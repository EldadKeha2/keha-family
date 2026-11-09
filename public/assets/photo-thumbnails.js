(() => {
  'use strict';
  const scheduled=new Map(),attempted=new Set();let busy=false;
  function schedule(item,image){
    if(item?.kind!=='photo'||item.thumbnailSrc||!item.id||!window.FamilyApp?.apiEnabled||attempted.has(item.src)||scheduled.has(item.src)||scheduled.size>=3||!image?.naturalWidth)return;
    if(!(item.size>250000||image.naturalWidth*image.naturalHeight>2000000)||item.mime==='image/gif')return;
    scheduled.set(item.src,{item,image});setTimeout(run,1000);
  }
  async function run(){
    if(busy||!scheduled.size||document.hidden)return;busy=true;
    const [src,{item,image}]=scheduled.entries().next().value;scheduled.delete(src);attempted.add(src);
    try{
      // This copy is only for the grid. Viewing, zoom, editing and downloads
      // continue to use item.src, which always identifies the full original.
      const ratio=Math.min(1,640/Math.max(image.naturalWidth,image.naturalHeight)),canvas=document.createElement('canvas');
      canvas.width=Math.max(1,Math.round(image.naturalWidth*ratio));canvas.height=Math.max(1,Math.round(image.naturalHeight*ratio));
      canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.82));canvas.width=canvas.height=1;
      if(!blob||item.size>0&&blob.size>=item.size||blob.size>1024*1024)return;
      const response=await window.FamilyI18n.fetch('api/media/'+item.id+'/thumbnail?revision='+encodeURIComponent(item.photoRevision||'original'),{method:'POST',headers:{'Content-Type':blob.type,'X-Family-Token':window.FAMILY_API_TOKEN},body:blob});
      if(!response.ok)throw Error('Thumbnail unavailable');const result=await response.json();
      if(result.item?.thumbnailSrc){
        item.thumbnailSrc=result.item.thumbnailSrc;item.thumbnailSize=result.item.thumbnailSize;
        for(const image of document.querySelectorAll('img[data-thumbnail-id]'))if(image.dataset.thumbnailId===item.id){image.src=item.thumbnailSrc;image.removeAttribute('data-thumbnail-id');}
        window.dispatchEvent(new CustomEvent('family-thumbnail-ready',{detail:result}));
      }
    }catch{}
    finally{busy=false;watch(document);if(scheduled.size)setTimeout(run,250);}
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
  window.FamilyPhotoThumbnails={schedule,attributes,watch};
})();
