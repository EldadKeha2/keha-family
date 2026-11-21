(() => {
  'use strict';
  const assetRoot='/assets/pdfjs/6.5.438/';
  const t=(he,en)=>window.FamilyI18n?.isEnglish?en:he;
  const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const title=item=>item.title||item.name||item.filename||t('מסמך PDF','PDF document');
  const isPDF=item=>/^application\/pdf(?:;|$)/i.test(item?.mime||'')||[item?.filename,item?.name,item?.src].some(value=>/\.pdf(?:[?#]|$)/i.test(value||''));
  let library;
  function pdfLibrary(){
    if(!library)library=import(assetRoot+'pdf.mjs').then(pdf=>{pdf.GlobalWorkerOptions.workerSrc=assetRoot+'pdf.worker.mjs';return pdf;}).catch(error=>{library=null;throw error;});
    return library;
  }
  function fileURL(item,download=false){
    const url=new URL(item.src,location.href);
    if(!['https:','http:'].includes(url.protocol)||url.origin!==location.origin)throw Error('Invalid PDF source');
    url.searchParams.delete(download?'inline':'download');url.searchParams.set(download?'download':'inline','1');
    const branch=document.documentElement.dataset.nakashBranch;
    if(branch&&branch!=='keha'&&url.pathname.startsWith('/media/'))url.searchParams.set('familyScope',branch);
    return url.href;
  }
  function shareURL(item){
    const site=document.documentElement.dataset,url=new URL(site.nakashHome||location.pathname,site.nakashOrigin||location.origin);
    const source=new URL(fileURL(item));source.searchParams.delete('inline');source.searchParams.delete('download');
    url.searchParams.set('pdf',source.pathname+source.search);
    url.searchParams.set('pdfName',item.filename||item.name||'document.pdf');url.searchParams.set('pdfTitle',title(item));
    if(window.FamilyI18n?.language)url.searchParams.set('lang',window.FamilyI18n.language);
    url.hash='documents';return url.href;
  }
  function loadOptions(item){return {url:fileURL(item),cMapUrl:assetRoot+'cmaps/',cMapPacked:true,standardFontDataUrl:assetRoot+'standard_fonts/',wasmUrl:assetRoot+'wasm/',useWorkerFetch:true,enableScripting:false};}
  const downloadIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/></svg>';
  const shareIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m9 10 6-4M9 14l6 4"/></svg>';
  function preview(item){return `<span class="pdf-thumbnail" data-pdf-thumbnail="${safe(item.src)}" data-pdf-name="${safe(item.filename||item.name||'document.pdf')}"><span class="pdf-thumbnail-note">${t('טוענים תצוגה מקדימה…','Loading preview…')}</span><span class="pdf-thumbnail-badge">PDF · ${t('פתיחה לקריאה','Open to read')}</span></span>`;}
  function attachment(item){return `<button type="button" class="pdf-attachment" data-pdf-open="${safe(item.src)}" data-pdf-name="${safe(item.filename||item.name||'document.pdf')}" data-pdf-title="${safe(title(item))}">${preview(item)}<span class="pdf-attachment-title" dir="auto">${safe(title(item))}</span></button>`;}

  const readers=new WeakMap();
  function mount(host,item){
    unmount(host);
    const root=document.createElement('section');root.className='pdf-reader';root.setAttribute('aria-label',t('מציג PDF','PDF viewer'));
    root.innerHTML=`<div class="pdf-reader-actions"><a class="pdf-download-button" data-pdf-download download="${safe(item.filename||'document.pdf')}">${downloadIcon}<span>${t('הורדת המסמך','Download document')}</span></a><button type="button" data-pdf-action="share" class="pdf-share-button">${shareIcon}<span>${t('שיתוף המסמך','Share document')}</span></button></div><div class="pdf-reader-tools" role="group" aria-label="${t('כלי קריאה','Reading tools')}"><button type="button" data-pdf-action="previous">${t('הקודם','Previous')}</button><label>${t('עמוד','Page')} <input class="pdf-page-number" type="number" min="1" value="1" inputmode="numeric" aria-label="${t('מספר העמוד','Page number')}"> <span class="pdf-page-total"></span></label><button type="button" data-pdf-action="next">${t('הבא','Next')}</button><span class="pdf-zoom-tools"><button type="button" data-pdf-action="out" aria-label="${t('הקטנה','Zoom out')}">−</button><span class="pdf-zoom-label">100%</span><button type="button" data-pdf-action="in" aria-label="${t('הגדלה','Zoom in')}">＋</button><button type="button" data-pdf-action="fit">${t('התאמה לרוחב','Fit width')}</button></span></div><p class="pdf-reader-status" role="status" aria-live="polite"></p><input class="pdf-share-fallback" readonly hidden aria-label="${t('קישור לשיתוף','Sharing link')}"><div class="pdf-page-scroll" tabindex="0" aria-label="${t('עמוד המסמך — אפשר לגלול ולהגדיל','Document page — scroll or zoom to read')}"><div class="pdf-page-surface"></div></div><details class="pdf-reader-text" hidden><summary>${t('טקסט העמוד','Page text')}</summary><p dir="auto"></p></details>`;
    const find=selector=>root.querySelector(selector),status=find('.pdf-reader-status'),surface=find('.pdf-page-surface'),scroll=find('.pdf-page-scroll'),pageInput=find('.pdf-page-number');
    host.replaceChildren(root);find('[data-pdf-download]').href=fileURL(item,true);
    let disposed=false,task,pdf,renderTask,sequence=0,pageNumber=1,zoom=1,resizeTimer,lastWidth=0;
    const busy=value=>{root.setAttribute('aria-busy',String(value));for(const button of root.querySelectorAll('.pdf-reader-tools button'))button.disabled=!pdf;pageInput.disabled=!pdf;};
    const controls=()=>{pageInput.value=String(pageNumber);pageInput.max=String(pdf.numPages);find('.pdf-page-total').textContent=t('מתוך ','of ')+pdf.numPages;find('[data-pdf-action=previous]').disabled=pageNumber<=1;find('[data-pdf-action=next]').disabled=pageNumber>=pdf.numPages;find('[data-pdf-action=out]').disabled=zoom<=.5;find('[data-pdf-action=in]').disabled=zoom>=3;find('.pdf-zoom-label').textContent=Math.round(zoom*100)+'%';};
    async function render(){
      if(disposed||!pdf)return;
      const current=++sequence;renderTask?.cancel();busy(true);controls();status.textContent=t('טוענים עמוד…','Loading page…');
      try{
        const page=await pdf.getPage(pageNumber);if(disposed||current!==sequence)return;
        const base=page.getViewport({scale:1}),width=Math.max(180,scroll.clientWidth||host.clientWidth||750)-24;
        lastWidth=width;const viewport=page.getViewport({scale:width/base.width*zoom});
        const pixelRatio=Math.min(window.devicePixelRatio||1,2,Math.sqrt(10000000/(viewport.width*viewport.height)));
        const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width*pixelRatio);canvas.height=Math.ceil(viewport.height*pixelRatio);canvas.style.width=viewport.width+'px';canvas.style.height=viewport.height+'px';canvas.setAttribute('aria-label',title(item)+' · '+t('עמוד ','Page ')+pageNumber);
        const rendering=page.render({canvas,canvasContext:canvas.getContext('2d'),viewport,transform:pixelRatio===1?null:[pixelRatio,0,0,pixelRatio,0,0]});renderTask=rendering;await rendering.promise;
        if(disposed||current!==sequence)return;
        surface.replaceChildren(canvas);status.textContent='';busy(false);controls();
        const text=await page.getTextContent();if(disposed||current!==sequence)return;
        const content=text.items.map(entry=>entry.str+(entry.hasEOL?'\n':' ')).join('');find('.pdf-reader-text p').textContent=content;find('.pdf-reader-text').hidden=!content.trim();
      }catch(error){if(disposed||current!==sequence||error.name==='RenderingCancelledException')return;busy(false);status.textContent=t('לא ניתן להציג את העמוד כרגע. אפשר לנסות שוב או להוריד את המסמך.','This page could not be displayed. Try again or download the document.');}
    }
    root.addEventListener('click',event=>{
      const action=event.target.closest('[data-pdf-action]')?.dataset.pdfAction;if(!action)return;
      if(action==='share'){void share(item,status,find('.pdf-share-fallback'));return;}
      if(!pdf)return;
      if(action==='previous')pageNumber=Math.max(1,pageNumber-1);
      if(action==='next')pageNumber=Math.min(pdf.numPages,pageNumber+1);
      if(action==='in')zoom=Math.min(3,zoom+.25);
      if(action==='out')zoom=Math.max(.5,zoom-.25);
      if(action==='fit')zoom=1;
      scroll.scrollTop=0;void render();
    });
    const changePage=()=>{if(!pdf)return;const value=Number(pageInput.value);if(Number.isInteger(value)&&value>=1&&value<=pdf.numPages){pageNumber=value;scroll.scrollTop=0;void render();}else pageInput.value=String(pageNumber);};
    pageInput.addEventListener('change',changePage);pageInput.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();changePage();}});
    root.addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight'].includes(event.key))event.stopPropagation();});
    const resize=typeof ResizeObserver==='function'?new ResizeObserver(()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(Math.abs(scroll.clientWidth-24-lastWidth)>2)void render();},120);}):null;resize?.observe(scroll);
    const destroy=()=>{disposed=true;sequence++;clearTimeout(resizeTimer);resize?.disconnect();renderTask?.cancel();void task?.destroy().catch(()=>{});};readers.set(host,{destroy});
    busy(true);status.textContent=t('פותחים את המסמך…','Opening document…');
    void (async()=>{
      try{
        const lib=await pdfLibrary();if(disposed)return;task=lib.getDocument(loadOptions(item));
        task.onPassword=()=>{if(!disposed){status.textContent=t('המסמך מוגן בסיסמה. אפשר להוריד אותו ולפתוח במציג PDF.','This document is password protected. Download it to open in a PDF reader.');busy(false);}void task.destroy().catch(()=>{});};
        pdf=await task.promise;if(!disposed)await render();
      }catch{if(!disposed){busy(false);status.textContent=t('לא ניתן לפתוח את המסמך כרגע. כפתורי ההורדה והשיתוף זמינים למעלה.','The document could not be opened. Download and share are available above.');}}
    })();
    return destroy;
  }
  function unmount(host){readers.get(host)?.destroy();readers.delete(host);}
  async function share(item,status,fallback){
    const url=shareURL(item);fallback.hidden=true;
    try{
      if(navigator.share){await navigator.share({title:title(item),url});status.textContent='';return;}
      if(!navigator.clipboard?.writeText)throw Error('Clipboard unavailable');
      await navigator.clipboard.writeText(url);status.textContent=t('הקישור למסמך הועתק. אפשר להדביק ולשתף אותו.','Document link copied. Paste it to share.');
    }catch(error){if(error.name==='AbortError')return;fallback.value=url;fallback.hidden=false;fallback.focus();fallback.select();status.textContent=t('העתיקו את הקישור כדי לשתף את המסמך.','Copy this link to share the document.');}
  }

  let dialog,body,opener;
  function open(item){
    // Only documents hosted by this site may enter the renderer or shared links.
    try{fileURL(item);}catch{return false;}
    if(!dialog){
      dialog=document.createElement('dialog');dialog.className='pdf-document-dialog';dialog.id='pdfDocumentViewer';dialog.setAttribute('aria-labelledby','pdfDocumentTitle');
      dialog.innerHTML=`<header><h2 id="pdfDocumentTitle" dir="auto"></h2><button type="button" class="pdf-close" aria-label="${t('סגירה','Close')}">×</button></header><div class="pdf-dialog-body"></div>`;document.body.append(dialog);body=dialog.querySelector('.pdf-dialog-body');
      dialog.querySelector('.pdf-close').addEventListener('click',()=>dialog.close());
      dialog.addEventListener('close',()=>{unmount(body);body.replaceChildren();const url=new URL(location.href);if(url.searchParams.has('pdf')){for(const key of ['pdf','pdfName','pdfTitle'])url.searchParams.delete(key);history.replaceState(history.state,'',url);}if(opener?.isConnected)opener.focus();});
    }
    if(!dialog.open)opener=document.activeElement;
    dialog.querySelector('h2').textContent=title(item);if(!dialog.open)dialog.showModal();mount(body,item);return true;
  }

  const thumbnailCache=new Map(),thumbnailQueue=[];let activeThumbnails=0;
  async function thumbnail(node){
    const item={src:node.dataset.pdfThumbnail,filename:node.dataset.pdfName},key=fileURL(item);
    if(thumbnailCache.has(key)){showThumbnail(node,thumbnailCache.get(key));return;}
    let task;
    try{
      const lib=await pdfLibrary();if(!node.isConnected)return;
      task=lib.getDocument(loadOptions(item));task.onPassword=()=>void task.destroy().catch(()=>{});
      const pdf=await task.promise,page=await pdf.getPage(1),base=page.getViewport({scale:1});
      const viewport=page.getViewport({scale:Math.min(560/base.width,420/base.height)}),canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
      await page.render({canvas,canvasContext:canvas.getContext('2d'),viewport}).promise;
      const src=canvas.toDataURL('image/webp',.82);if(thumbnailCache.size>=80)thumbnailCache.delete(thumbnailCache.keys().next().value);thumbnailCache.set(key,src);if(node.isConnected)showThumbnail(node,src);
    }catch{if(node.isConnected)node.querySelector('.pdf-thumbnail-note').textContent=t('PDF · לחצו לפתיחת המסמך','PDF · Open document');}
    finally{await task?.destroy().catch(()=>{});}
  }
  function showThumbnail(node,src){const img=document.createElement('img');img.src=src;img.alt=t('תצוגה מקדימה של העמוד הראשון','Preview of the first page');node.querySelector('.pdf-thumbnail-note')?.remove();node.prepend(img);}
  function drainThumbnails(){while(activeThumbnails<2&&thumbnailQueue.length){const node=thumbnailQueue.shift();if(!node.isConnected)continue;activeThumbnails++;void thumbnail(node).catch(()=>{}).finally(()=>{activeThumbnails--;drainThumbnails();});}}
  const observer=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){observer.unobserve(entry.target);thumbnailQueue.push(entry.target);}drainThumbnails();},{rootMargin:'120px'}):null;
  function scan(root=document){
    const thumbnails=[...(root.matches?.('[data-pdf-thumbnail]:not([data-pdf-observed])')?[root]:[]),...root.querySelectorAll('[data-pdf-thumbnail]:not([data-pdf-observed])')];
    for(const node of thumbnails){node.dataset.pdfObserved='true';if(observer)observer.observe(node);else{thumbnailQueue.push(node);drainThumbnails();}}
    // Older story and document links carry their PDF filename in download/text.
    // Enhance those too, so existing records use the same reader.
    const selector='a[href]:not([data-pdf-download]):not([data-pdf-open]):not(#mediaOriginal):not(#downloadForInstagram):not(.document-download)';
    for(const link of [...(root.matches?.(selector)?[root]:[]),...root.querySelectorAll(selector)]){
      const src=link.getAttribute('href'),name=link.getAttribute('download')||link.textContent.trim();
      if(!isPDF({src})&&!/\.pdf$/i.test(name))continue;
      try{fileURL({src});}catch{continue;}
      link.dataset.pdfOpen=src;link.dataset.pdfName=name;link.dataset.pdfTitle=name;link.removeAttribute('download');link.removeAttribute('target');
      if(!link.querySelector('[data-pdf-thumbnail]'))link.insertAdjacentHTML('afterbegin',preview({src,filename:name}));
      scan(link);
    }
  }
  document.addEventListener('click',event=>{
    const link=event.target.closest('[data-pdf-open]');if(!link||event.defaultPrevented||event.button>0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
    if(open({src:link.dataset.pdfOpen,filename:link.dataset.pdfName,title:link.dataset.pdfTitle})){event.preventDefault();event.stopPropagation();}
  });
  window.FamilyPDF={isPDF,preview,attachment,mount,unmount,open,shareURL,fileURL,scan};
  scan();
  if(typeof MutationObserver==='function')new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)if(node.nodeType===1&&(node.matches('[data-pdf-thumbnail],a[href]')||node.querySelector('[data-pdf-thumbnail],a[href]')))scan(node);}).observe(document.body,{childList:true,subtree:true});
  const direct=new URL(location.href),src=direct.searchParams.get('pdf');
  if(src&&(/\.pdf(?:[?#]|$)/i.test(src)||/^\/media\/[a-f0-9]{32}(?:\?|$)/.test(src)))open({src,filename:direct.searchParams.get('pdfName')||'document.pdf',title:direct.searchParams.get('pdfTitle')||t('מסמך משפחתי','Family document')});
})();
