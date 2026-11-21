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
    root.innerHTML=`<div class="pdf-reader-actions"><a class="pdf-download-button" data-pdf-download download="${safe(item.filename||'document.pdf')}">${downloadIcon}<span>${t('הורדת המסמך','Download document')}</span></a><button type="button" data-pdf-action="share" class="pdf-share-button">${shareIcon}<span>${t('שיתוף המסמך','Share document')}</span></button></div><div class="pdf-reader-tools" role="group" aria-label="${t('כלי קריאה','Reading tools')}"><label>${t('עמוד','Page')} <input class="pdf-page-number" type="number" min="1" value="1" inputmode="numeric" aria-label="${t('מספר העמוד','Page number')}"> <span class="pdf-page-total"></span></label><span class="pdf-zoom-tools"><button type="button" data-pdf-action="out" aria-label="${t('הקטנה','Zoom out')}">−</button><span class="pdf-zoom-label">100%</span><button type="button" data-pdf-action="in" aria-label="${t('הגדלה','Zoom in')}">＋</button><button type="button" data-pdf-action="fit">${t('התאמה לרוחב','Fit width')}</button></span></div><p class="pdf-reader-status" role="status" aria-live="polite"></p><input class="pdf-share-fallback" readonly hidden aria-label="${t('קישור לשיתוף','Sharing link')}"><div class="pdf-page-scroll" tabindex="0" aria-label="${t('כל עמודי המסמך — גלילה רציפה וזום בשתי אצבעות','All document pages — continuous scrolling and two-finger zoom')}"><div class="pdf-page-surface"></div></div><details class="pdf-reader-text" hidden><summary>${t('טקסט העמוד','Page text')}</summary><p dir="auto"></p></details>`;
    const find=selector=>root.querySelector(selector),status=find('.pdf-reader-status'),surface=find('.pdf-page-surface'),scroll=find('.pdf-page-scroll'),pageInput=find('.pdf-page-number');
    host.replaceChildren(root);find('[data-pdf-download]').href=fileURL(item,true);
    const requestFrame=window.requestAnimationFrame?.bind(window)||(fn=>setTimeout(fn,16));
    const cancelFrame=window.cancelAnimationFrame?.bind(window)||clearTimeout;
    let disposed=false,task,pdf,revision=0,pageNumber=1,zoom=1,fitWidth=0,resizeTimer,zoomTimer,scrollFrame,textSequence=0,activeRenders=0,pinch=null,safariGesture=null,zoomPending=false;
    let pages=[],wanted=new Set();
    const viewportWidth=()=>Math.max(180,scroll.clientWidth||host.clientWidth||750);
    const viewportHeight=()=>scroll.clientHeight||600;
    const busy=value=>{root.setAttribute('aria-busy',String(value));for(const button of root.querySelectorAll('.pdf-reader-tools button'))button.disabled=!pdf;pageInput.disabled=!pdf;};
    function controls(){
      if(!pdf)return;
      if(document.activeElement!==pageInput)pageInput.value=String(pageNumber);
      pageInput.max=String(pdf.numPages);find('.pdf-page-total').textContent=t('מתוך ','of ')+pdf.numPages;
      find('[data-pdf-action=out]').disabled=zoom<=.5;find('[data-pdf-action=in]').disabled=zoom>=8;find('.pdf-zoom-label').textContent=Math.round(zoom*100)+'%';
    }
    function pageAt(y){
      let low=0,high=pages.length-1;
      while(low<high){const middle=Math.floor((low+high+1)/2);if(pages[middle].top<=y)low=middle;else high=middle-1;}
      return pages[low];
    }
    function captureAnchor(point){
      if(!pages.length)return null;
      const rect=scroll.getBoundingClientRect(),x=point?point.x-rect.left:viewportWidth()/2,y=point?point.y-rect.top:viewportHeight()/2;
      const row=pageAt((scroll.scrollTop||0)+y),left=(Math.max(viewportWidth(),row.width+24)-row.width)/2;
      return {row,x,y,fractionX:((scroll.scrollLeft||0)+x-left)/row.width,fractionY:((scroll.scrollTop||0)+y-row.top)/row.height};
    }
    function restoreAnchor(anchor){
      if(!anchor)return;
      const row=anchor.row,left=(Math.max(viewportWidth(),row.width+24)-row.width)/2;
      scroll.scrollLeft=Math.max(0,left+anchor.fractionX*row.width-anchor.x);scroll.scrollTop=Math.max(0,row.top+anchor.fractionY*row.height-anchor.y);
    }
    function layout(anchor){
      fitWidth=viewportWidth()-24;const width=fitWidth*zoom;let top=12;
      surface.style.width=Math.max(viewportWidth(),width+24)+'px';
      for(const row of pages){row.width=width;row.height=width*row.ratio;row.top=top;row.node.style.width=width+'px';row.frame.style.height=row.height+'px';top+=row.height+28+16;}
      restoreAnchor(anchor);
    }
    function release(row){
      row.token++;row.renderTask?.cancel();row.failedRevision=-1;
      if(row.canvas){row.canvas.width=0;row.canvas.height=0;row.canvas.remove();row.canvas=null;row.note.hidden=false;}
      row.note.textContent=t('טוענים עמוד…','Loading page…');row.node.setAttribute('aria-busy','true');
      row.paintedRevision=-1;
      if(!row.rendering)row.proxy?.cleanup?.();
    }
    async function pageText(row){
      const current=++textSequence;
      find('.pdf-reader-text').hidden=true;
      if(!row?.proxy)return;
      try{
        row.textPromise||=row.proxy.getTextContent().then(text=>text.items.map(entry=>entry.str+(entry.hasEOL?'\n':' ')).join(''));
        const text=await row.textPromise;if(disposed||current!==textSequence||pageNumber!==row.number)return;
        find('.pdf-reader-text p').textContent=text;find('.pdf-reader-text').hidden=!text.trim();
      }catch{}
    }
    function updateWindow(){
      if(disposed||!pages.length)return;
      const top=scroll.scrollTop||0,height=viewportHeight(),first=pageAt(Math.max(0,top-height)).number-1,last=pageAt(top+height*2).number-1;
      const next=new Set(pages.slice(first,last+1));
      for(const row of wanted)if(!next.has(row))release(row);
      wanted=next;
      const current=pageAt(top+Math.min(80,height*.2));
      if(current.number!==pageNumber){pageNumber=current.number;controls();void pageText(current);}
      if(!zoomPending)pump();
    }
    function pump(){
      if(disposed||zoomPending)return;
      while(activeRenders<2){
        const row=[...wanted].filter(row=>!row.rendering&&row.paintedRevision!==revision&&row.failedRevision!==revision).sort((a,b)=>Math.abs(a.number-pageNumber)-Math.abs(b.number-pageNumber))[0];
        if(!row)return;
        void renderPage(row);
      }
    }
    async function renderPage(row){
      row.rendering=true;activeRenders++;const generation=revision,token=++row.token;let canvas;
      const valid=()=>!disposed&&generation===revision&&token===row.token&&wanted.has(row);
      try{
        row.proxyPromise||=pdf.getPage(row.number);row.proxy=await row.proxyPromise;if(!valid())return;
        const base=row.proxy.getViewport({scale:1}),ratio=base.height/base.width;
        if(Math.abs(row.ratio-ratio)>.0001){const anchor=captureAnchor();row.ratio=ratio;layout(anchor);updateWindow();if(!valid())return;}
        const viewport=row.proxy.getViewport({scale:row.width/base.width}),density=Math.min(window.devicePixelRatio||1,2,Math.sqrt(6000000/(viewport.width*viewport.height)));
        canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width*density);canvas.height=Math.ceil(viewport.height*density);canvas.setAttribute('aria-label',title(item)+' · '+t('עמוד ','Page ')+row.number);
        row.renderTask=row.proxy.render({canvas,canvasContext:canvas.getContext('2d'),viewport,transform:density===1?null:[density,0,0,density,0,0]});await row.renderTask.promise;
        if(!valid())return;
        if(row.canvas){row.canvas.width=0;row.canvas.height=0;row.canvas.remove();}
        row.canvas=canvas;canvas=null;row.frame.append(row.canvas);row.note.hidden=true;row.paintedRevision=revision;
        row.node.setAttribute('aria-busy','false');busy(false);controls();if(pageNumber===row.number)void pageText(row);
      }catch(error){
        if(valid()&&error.name!=='RenderingCancelledException'){row.failedRevision=revision;row.note.hidden=false;row.note.textContent=t('לא ניתן להציג עמוד זה כרגע. אפשר להוריד את המקור.','This page could not be displayed. You can download the original.');row.node.setAttribute('aria-busy','false');busy(false);}
      }finally{
        if(canvas){canvas.width=0;canvas.height=0;}
        row.renderTask=null;row.rendering=false;activeRenders--;
        if(!wanted.has(row))row.proxy?.cleanup?.();
        pump();
      }
    }
    function settleZoom(delay=130){
      clearTimeout(zoomTimer);zoomPending=delay>0;
      if(delay>0)zoomTimer=setTimeout(()=>{zoomPending=false;updateWindow();},delay);else updateWindow();
    }
    function setZoom(value,anchor=captureAnchor(),defer=false){
      if(!pdf||disposed||!Number.isFinite(value))return;
      const next=Math.min(8,Math.max(.5,value));
      if(Math.abs(next-zoom)>.0001){zoom=next;revision++;for(const row of pages)row.renderTask?.cancel();layout(anchor);controls();}
      else restoreAnchor(anchor);
      zoomPending=defer;updateWindow();settleZoom(defer?130:0);
    }
    root.addEventListener('click',event=>{
      const action=event.target.closest('[data-pdf-action]')?.dataset.pdfAction;if(!action)return;
      if(action==='share'){void share(item,status,find('.pdf-share-fallback'));return;}
      if(action==='in')setZoom(zoom+.25);
      if(action==='out')setZoom(zoom-.25);
      if(action==='fit')setZoom(1);
    });
    const changePage=()=>{
      if(!pdf)return;const value=Number(pageInput.value);
      if(Number.isInteger(value)&&value>=1&&value<=pdf.numPages){pageNumber=value;scroll.scrollTop=pages[value-1].top;controls();void pageText(pages[value-1]);updateWindow();}
      else pageInput.value=String(pageNumber);
    };
    pageInput.addEventListener('change',changePage);pageInput.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();changePage();}});
    root.addEventListener('keydown',event=>{
      if(['ArrowLeft','ArrowRight'].includes(event.key))event.stopPropagation();
      if(event.target.closest('input,textarea,select')||event.altKey)return;
      if(['+','=','-'].includes(event.key)){event.preventDefault();event.stopPropagation();setZoom(zoom+(event.key==='-'?-.25:.25));}
    });
    scroll.addEventListener('scroll',()=>{if(scrollFrame)return;scrollFrame=requestFrame(()=>{scrollFrame=null;updateWindow();});},{passive:true});
    scroll.addEventListener('wheel',event=>{
      // Precision-pad pinches arrive as Ctrl+wheel. Ordinary two-finger
      // scrolling remains native, with its normal momentum and direction.
      if(!pdf||!(event.ctrlKey||event.metaKey)||event.altKey||!Number.isFinite(event.deltaY)||!event.deltaY)return;
      if(event.cancelable!==false)event.preventDefault();event.stopPropagation();
      const unit=event.deltaMode===1?16:event.deltaMode===2?viewportHeight():1,delta=Math.max(-160,Math.min(160,event.deltaY*unit));
      const point=Number.isFinite(event.clientX)&&Number.isFinite(event.clientY)?{x:event.clientX,y:event.clientY}:undefined;
      setZoom(zoom*Math.exp(-delta*.004),captureAnchor(point),true);
    },{capture:true,passive:false});
    const touchPoint=touches=>({x:(touches[0].clientX+touches[1].clientX)/2,y:(touches[0].clientY+touches[1].clientY)/2,distance:Math.hypot(touches[0].clientX-touches[1].clientX,touches[0].clientY-touches[1].clientY)});
    scroll.addEventListener('touchstart',event=>{
      if(!pdf||event.touches.length!==2)return;
      const point=touchPoint(event.touches);if(point.distance<1)return;
      if(event.cancelable!==false)event.preventDefault();
      pinch={distance:point.distance,zoom,anchor:captureAnchor(point)};safariGesture=null;
    },{passive:false});
    scroll.addEventListener('touchmove',event=>{
      if(!pinch||event.touches.length!==2)return;
      if(event.cancelable!==false)event.preventDefault();event.stopPropagation();
      const point=touchPoint(event.touches),rect=scroll.getBoundingClientRect();
      setZoom(pinch.zoom*point.distance/pinch.distance,{...pinch.anchor,x:point.x-rect.left,y:point.y-rect.top},true);
    },{passive:false});
    const finishTouch=event=>{if(pinch&&event.touches.length<2){pinch=null;settleZoom(0);}};
    scroll.addEventListener('touchend',finishTouch,{passive:true});scroll.addEventListener('touchcancel',()=>{pinch=null;settleZoom(0);},{passive:true});
    scroll.addEventListener('gesturestart',event=>{if(!pdf)return;event.preventDefault();if(!pinch)safariGesture={zoom,anchor:captureAnchor(Number.isFinite(event.clientX)?{x:event.clientX,y:event.clientY}:undefined)};},{passive:false});
    scroll.addEventListener('gesturechange',event=>{if(!pdf)return;event.preventDefault();if(!pinch&&safariGesture&&Number.isFinite(event.scale))setZoom(safariGesture.zoom*event.scale,safariGesture.anchor,true);},{passive:false});
    scroll.addEventListener('gestureend',event=>{if(!pdf)return;event.preventDefault();safariGesture=null;if(!pinch)settleZoom(0);},{passive:false});
    const resize=typeof ResizeObserver==='function'?new ResizeObserver(()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{
      if(disposed||!pdf)return;
      if(Math.abs(viewportWidth()-24-fitWidth)>2){const anchor=captureAnchor();revision++;for(const row of pages)row.renderTask?.cancel();layout(anchor);}
      updateWindow();
    },120);}):null;resize?.observe(scroll);
    const destroy=()=>{disposed=true;revision++;textSequence++;clearTimeout(resizeTimer);clearTimeout(zoomTimer);if(scrollFrame)cancelFrame(scrollFrame);resize?.disconnect();wanted.clear();for(const row of pages)release(row);void task?.destroy().catch(()=>{});};
    readers.set(host,{destroy});busy(true);status.textContent=t('פותחים את המסמך…','Opening document…');
    void (async()=>{
      try{
        const lib=await pdfLibrary();if(disposed)return;task=lib.getDocument(loadOptions(item));
        task.onPassword=()=>{if(!disposed){status.textContent=t('המסמך מוגן בסיסמה. אפשר להוריד אותו ולפתוח במציג PDF.','This document is password protected. Download it to open in a PDF reader.');busy(false);}void task.destroy().catch(()=>{});};
        const loaded=await task.promise;if(disposed)return;
        const first=await loaded.getPage(1);if(disposed)return;pdf=loaded;const base=first.getViewport({scale:1});
        pages=Array.from({length:pdf.numPages},(_,index)=>{
          const node=document.createElement('article');node.className='pdf-document-page';node.dataset.pdfPage=String(index+1);node.setAttribute('aria-label',t('עמוד ','Page ')+(index+1));node.setAttribute('aria-busy','true');
          node.innerHTML=`<div class="pdf-page-frame"><span class="pdf-page-loading">${t('טוענים עמוד…','Loading page…')}</span></div><span class="pdf-page-caption">${t('עמוד ','Page ')+(index+1)} ${t('מתוך ','of ')+pdf.numPages}</span>`;surface.append(node);
          return {number:index+1,node,frame:node.querySelector('.pdf-page-frame'),note:node.querySelector('.pdf-page-loading'),ratio:base.height/base.width,proxy:index===0?first:null,proxyPromise:index===0?Promise.resolve(first):null,token:0,paintedRevision:-1,failedRevision:-1,rendering:false};
        });
        scroll.scrollTop=0;scroll.scrollLeft=0;layout();status.textContent='';busy(false);controls();updateWindow();
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
