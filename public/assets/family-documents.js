(() => {
  'use strict';
  const section=document.getElementById('documentsView');if(!section)return;
  const I=window.FamilyI18n,$=id=>document.getElementById(id),t=(he,en)=>I.isEnglish?en:he;
  const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normalize=value=>String(value??'').normalize('NFKD').replace(/[\u0591-\u05c7'"׳״]/g,'').toLowerCase().trim();
  const state={view:null,items:[],people:[],query:'',kind:'all',person:'all',loaded:false,loading:false,saving:false,deleting:false,deleteId:null,captureFile:null,captureURL:null};
  const emblem='<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M12 6h18l8 8v28H12ZM30 6v10h8M18 23h14M18 29h14M18 35h9"/><path d="m6 16-3 2v25h25"/></svg>';
  const uploadIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3H5v18h14V8ZM14 3v5h5M12 17v-6m-3 3 3-3 3 3"/></svg>';
  const cameraIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 1-2h6l1 2h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"/><circle cx="12" cy="12" r="4"/></svg>';
  const recordingIcon='<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M8 20v8m8-16v24m8-30v36m8-30v24m8-16v8"/></svg>';
  async function request(path,options={}){
    const response=await I.fetch(path,{cache:'no-store',...options,headers:{...(options.body?{'X-Family-Token':window.FAMILY_API_TOKEN}:{}),...options.headers}});
    let data;try{data=await response.json();}catch{throw Error(t('לא התקבלה תשובה מהשרת. נסו שוב.','The server did not respond. Please try again.'));}
    if(!response.ok)throw Error(I.error(data.error)||t('השינוי לא נשמר.','Your changes could not be saved.'));return data;
  }
  const audio=item=>item.kind==='audio'||item.mime?.startsWith('audio/');
  function render(){
    const query=normalize(state.query),items=state.items.filter(item=>(state.kind==='all'||(audio(item)?'audio':'document')===state.kind)&&(state.person==='all'||item.personIds?.includes(state.person)||item.tags?.some(p=>p.id===state.person))&&(!query||normalize([item.name,item.title,item.filename,item.caption,...(item.tags||[]).map(p=>p.name)].join(' ')).includes(query)));
    $('documentCount').textContent=t(`${items.length} פריטים`,`${items.length} records`);
    $('documentGrid').innerHTML=items.map(item=>{
      const title=item.name||item.title||item.filename,recording=audio(item),image=item.mime?.startsWith('image/')||item.documentPreview,pdf=window.FamilyPDF?.isPDF(item);
      const preview=pdf?`<button type="button" class="document-preview document-pdf-preview" data-document-open="${item.id}" aria-label="${safe(t('פתיחת ','Open ')+title)}">${window.FamilyPDF.preview(item)}</button>`:recording?`<div class="document-recording"><div class="document-audio">${emblem}<span>${t('קול מן העבר','A voice from the past')}</span><audio controls preload="none" src="${safe(item.src)}"></audio></div><button type="button" class="document-preview document-recording-preview" data-document-open="${item.id}" aria-label="${safe(t('האזנה ל','Listen to ')+title)}">${recordingIcon}</button></div>`:image?`<button type="button" class="document-preview" data-document-open="${item.id}" aria-label="${safe(t('פתיחת ','Open ')+title)}"><img src="${safe(item.documentPreview||item.src)}" alt="${safe(title)}" loading="lazy" decoding="async"></button>`:`<button type="button" class="document-preview document-paper" data-document-open="${item.id}" aria-label="${safe(t('פתיחת ','Open ')+title)}">${emblem}<span>${safe((item.filename?.split('.').at(-1)||'PDF').toUpperCase())}</span><small>${t('פתיחת המסמך','Open document')}</small></button>`;
      return `<article class="document-card">${preview}<div class="document-card-body"><h3>${safe(title)}</h3>${item.caption?`<p class="document-description" dir="auto">${safe(item.caption)}</p>`:''}${item.sourceUrl?`<a class="document-source" href="${safe(item.sourceUrl)}" target="_blank" rel="noopener">${safe(item.sourceLabel||t('מקור היסטורי','Historical source'))}</a>`:''}<div class="document-people">${(item.tags||[]).map(p=>`<a href="#person/${encodeURIComponent(p.id)}">${safe(I.personName(p))}</a>`).join('')}</div><div class="document-actions"><a class="document-download" href="${safe(item.src)}${item.src.includes('?')?'&':'?'}download=1" download="${safe(item.filename||title)}">${t('הורדת המקור','Download original')}</a><button type="button" class="document-delete" data-document-delete="${safe(item.id)}" aria-label="${safe(t('מחיקת התיעוד: ','Delete record: ')+title)}">${t('מחיקה','Delete')}</button></div></div></article>`;
    }).join('');
    $('documentsEmpty').hidden=items.length>0||!state.loaded;
  }
  async function refresh(){
    if(state.loading)return;state.loading=true;$('documentsStatus').textContent=t('פותחים את הארכיון…','Opening the archive…');
    try{
      const data=await request('api/documents');state.items=data.items;state.people=data.people;state.loaded=true;
      $('documentPersonFilter').innerHTML=`<option value="all">${t('כל האנשים','Everyone')}</option>`+state.people.map(p=>`<option value="${safe(p.id)}">${safe(p.name)}</option>`).join('');
      $('documentPersonFilter').value=state.person;render();syncDocumentRoute();$('documentsStatus').textContent='';
    }catch(error){$('documentsStatus').textContent=error.message;}finally{state.loading=false;}
  }
  function mount(){
    section.innerHTML=`<header class="documents-intro"><span class="documents-emblem">${emblem}</span><div class="documents-intro-copy"><span class="small-eyebrow">${t('מן המגירה המשפחתית, לדורות הבאים','From the family drawer, for generations to come')}</span><h2>${t('מסמכים ותיעודים','Our family archive')}</h2><p>${t('תעודות, מסמכים היסטוריים והקלטות נדירות — כל פריט והסיפור שהוא שומר.','Certificates, historical records and rare recordings — each with a story to preserve.')}</p></div><div class="document-upload-actions"><button class="primary-button" id="newDocument" type="button">${uploadIcon}<span>${t('העלה מסמך','Upload document')}</span></button><button class="primary-button document-camera-button" id="captureDocument" type="button">${cameraIcon}<span>${t('צלם מסמך','Scan document')}</span></button></div><input id="documentCamera" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" hidden></header><div class="document-filters"><div class="archive-filters" role="group" aria-label="${t('סוג התיעוד','Record type')}"><button type="button" data-document-kind="all" aria-pressed="true">${t('הכול','All')}</button><button type="button" data-document-kind="document" aria-pressed="false">${t('תעודות ומסמכים','Documents')}</button><button type="button" data-document-kind="audio" aria-pressed="false">${t('הקלטות נדירות','Rare recordings')}</button></div><label>${t('אנשים בתיעוד','People in the records')}<select id="documentPersonFilter"><option value="all">${t('כל האנשים','Everyone')}</option></select></label><span id="documentCount" role="status"></span></div><p id="documentsStatus" class="archive-status" role="status"></p><div class="document-grid" id="documentGrid"></div><div class="archive-empty" id="documentsEmpty" hidden><h3>${t('התיעוד המשפחתי מתחיל כאן','Our family archive begins here')}</h3><p>${t('תעודה מהמגירה, מסמך של הבית או הקלטה ישנה — יש להם מקום כאן.','A certificate, a house record or an old recording — there is a place for them here.')}</p></div>`;
    const editor=document.createElement('dialog');editor.id='documentEditor';editor.className='document-dialog';editor.setAttribute('aria-labelledby','documentEditorTitle');
    editor.innerHTML=`<form id="documentForm"><header><h2 id="documentEditorTitle">${t('הוספת תיעוד משפחתי','Add a family record')}</h2><button type="button" data-document-close aria-label="${t('סגירה','Close')}">×</button></header><label>${t('כותרת','Title')}<input id="documentTitle" maxlength="200" required dir="auto"></label><label>${t('הקובץ המקורי','Original file')}<input id="documentFile" type="file" accept=".pdf,.doc,.docx,.txt,.md,image/jpeg,image/png,image/webp,image/gif,image/avif,audio/*" required></label><div class="document-capture-preview" id="documentCapturePreview" hidden><img id="documentCaptureImage" alt="${t('המסמך שצולם','Captured document')}"><p id="documentCaptureName" dir="auto"></p></div><p class="document-file-hint">${t('מסמכים עד 10MB · תמונות עד 50MB · הקלטות עד 90MB','Documents up to 10MB · Images up to 50MB · Audio up to 90MB')}</p><fieldset><legend>${t('למי שייך התיעוד?','Who is this record about?')}</legend><input type="search" id="documentPeopleSearch" aria-label="${t('חיפוש אדם','Find a person')}" placeholder="${t('חיפוש שם…','Search names…')}"><div class="document-person-choices" id="documentPeople"></div></fieldset><label>${t('תיאור ומקור המסמך','Description and source')}<textarea id="documentCaption" maxlength="5000" rows="4" dir="auto"></textarea></label><p id="documentUploadStatus" role="status"></p><p id="documentError" role="alert"></p><button class="primary-button" type="submit" id="saveDocument">${t('שמירה והעלאה','Save and upload')}</button></form>`;
    document.body.append(editor);
    const viewer=document.createElement('dialog');viewer.id='documentViewer';viewer.className='document-dialog document-viewer';viewer.setAttribute('aria-labelledby','documentViewerTitle');viewer.innerHTML=`<header><h2 id="documentViewerTitle"></h2><button type="button" data-document-close aria-label="${t('סגירה','Close')}">×</button></header><div id="documentViewerBody"></div><a id="documentOriginal" target="_blank" rel="noopener">${t('פתיחת המקור בחלון נוסף','Open original in another tab')}</a>`;document.body.append(viewer);
    const removal=document.createElement('dialog');removal.id='documentRemoval';removal.className='document-dialog document-removal';removal.setAttribute('aria-labelledby','documentRemovalTitle');
    removal.innerHTML=`<form id="documentRemovalForm"><header><h2 id="documentRemovalTitle">${t('מחיקת תיעוד','Delete a record')}</h2><button type="button" data-document-cancel aria-label="${t('סגירה','Close')}">×</button></header><p id="documentRemovalName" dir="auto"></p><p>${t('כדי למחוק את התיעוד מכל המקומות שבהם הוא מופיע, הזינו את סיסמת המחיקה.','Enter the removal password to delete this record everywhere it appears.')}</p><label>${t('סיסמת מחיקה','Removal password')}<input id="documentRemovalPassword" type="password" autocomplete="current-password" required maxlength="128"></label><p id="documentRemovalError" role="alert"></p><div class="document-removal-actions"><button type="button" data-document-cancel>${t('ביטול','Cancel')}</button><button type="submit" class="document-delete" id="confirmDocumentRemoval">${t('מחיקת התיעוד','Delete record')}</button></div></form>`;document.body.append(removal);
    const clearRemoval=()=>{$('documentRemovalPassword').value='';state.deleteId=null;};
    for(const button of removal.querySelectorAll('[data-document-cancel]'))button.addEventListener('click',()=>{if(!state.deleting){clearRemoval();removal.close();}});
    removal.addEventListener('cancel',event=>{if(state.deleting)event.preventDefault();else clearRemoval();});
    removal.addEventListener('close',clearRemoval);
    $('documentRemovalForm').addEventListener('submit',async event=>{
      event.preventDefault();if(state.deleting||!state.deleteId)return;
      const id=state.deleteId,password=$('documentRemovalPassword').value;$('documentRemovalPassword').value='';
      if(!password){$('documentRemovalError').textContent=t('הזינו את סיסמת המחיקה.','Enter the removal password.');return;}
      state.deleting=true;$('confirmDocumentRemoval').disabled=true;$('documentRemovalError').textContent='';
      try{
        await request('api/documents/'+encodeURIComponent(id)+'/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})});
        state.items=state.items.filter(item=>item.id!==id);render();removal.close();clearRemoval();
        document.dispatchEvent(new CustomEvent('family-document-deleted',{detail:{id}}));
        await refresh();$('documentsStatus').textContent=t('התיעוד נמחק.','The record was deleted.');
      }catch(error){$('documentRemovalError').textContent=error.message;$('documentRemovalPassword').focus();}
      finally{state.deleting=false;$('confirmDocumentRemoval').disabled=false;}
    });
    function clearCapture(){
      if(state.captureURL)URL.revokeObjectURL(state.captureURL);
      state.captureURL=null;state.captureFile=null;$('documentCapturePreview').hidden=true;$('documentCaptureImage').removeAttribute('src');$('documentCaptureName').textContent='';$('documentFile').required=true;
    }
    async function openEditor(captured=null){
      if(!state.loaded)await refresh();if(!state.loaded)return;
      clearCapture();$('documentForm').reset();$('documentTitle').value='';$('documentError').textContent='';$('documentUploadStatus').textContent='';
      $('documentPeople').innerHTML=state.people.map(p=>`<label><input type="checkbox" value="${safe(p.id)}"><span>${safe(p.name)}</span></label>`).join('');
      if(captured){
        state.captureFile=captured;$('documentFile').required=false;$('documentTitle').value=captured.name.replace(/\.[^.]+$/,'');$('documentCaptureName').textContent=captured.name;$('documentCapturePreview').hidden=false;
        if(typeof URL!=='undefined'&&typeof URL.createObjectURL==='function'){state.captureURL=URL.createObjectURL(captured);$('documentCaptureImage').src=state.captureURL;}
      }
      editor.showModal();
    }
    $('newDocument').addEventListener('click',()=>{void openEditor();});
    $('captureDocument').addEventListener('click',()=>{
      // Open the native camera during the tap, before any async loading.
      $('documentCamera').value='';$('documentCamera').click();
    });
    $('documentCamera').addEventListener('change',()=>{const file=$('documentCamera').files[0];if(file)void openEditor(file);});
    editor.addEventListener('close',clearCapture);
    viewer.addEventListener('close',()=>{
      if(viewer.open)return;
      for(const node of $('documentViewerBody').querySelectorAll('audio'))node.pause?.();$('documentViewerBody').replaceChildren();
      if(documentRoute()===viewer.dataset.documentId)window.FamilyNavigation?.returnTo('#documents');
    });
    $('documentPeopleSearch').addEventListener('input',event=>{const query=normalize(event.target.value);for(const label of $('documentPeople').children)label.hidden=!normalize(label.textContent).includes(query);});
    $('documentFile').addEventListener('change',()=>{clearCapture();if(!$('documentTitle').value)$('documentTitle').value=$('documentFile').files[0]?.name.replace(/\.[^.]+$/,'')||'';});
    $('documentPersonFilter').addEventListener('change',event=>{state.person=event.target.value;render();});
    section.addEventListener('click',event=>{
      const filter=event.target.closest('[data-document-kind]');if(filter){state.kind=filter.dataset.documentKind;for(const button of section.querySelectorAll('[data-document-kind]'))button.setAttribute('aria-pressed',String(button===filter));render();}
      const remove=event.target.closest('[data-document-delete]');
      if(remove){
        const item=state.items.find(item=>item.id===remove.dataset.documentDelete);if(!item)return;
        state.deleteId=item.id;$('documentRemovalName').textContent=item.name||item.title||item.filename;$('documentRemovalPassword').value='';$('documentRemovalError').textContent='';removal.showModal();$('documentRemovalPassword').focus();return;
      }
      const button=event.target.closest('[data-document-open]');if(!button)return;
      const item=state.items.find(item=>item.id===button.dataset.documentOpen);if(!item)return;
      openDocument(item);
    });
    const dirtyDocument=()=>editor.open&&Boolean(state.captureFile||$('documentFile').files.length||$('documentTitle').value||$('documentCaption').value||$('documentPeople').querySelectorAll('input:checked').length);
    const canClose=dialog=>!state.saving&&(dialog!==editor||!dirtyDocument()||window.confirm(t('השינויים לא נשמרו. האם ברצונך לצאת?','Your changes have not been saved. Do you want to leave?')));
    for(const dialog of [editor,viewer]){dialog.querySelector('[data-document-close]').addEventListener('click',()=>{if(canClose(dialog))dialog.close();});dialog.addEventListener('cancel',event=>{if(!canClose(dialog))event.preventDefault();});}
    window.addEventListener('beforeunload',event=>{if(state.saving||dirtyDocument()){event.preventDefault();event.returnValue='';}});
    $('documentForm').addEventListener('submit',async event=>{
      event.preventDefault();if(state.saving)return;
      const personIds=[...$('documentPeople').querySelectorAll('input:checked')].map(node=>node.value),file=state.captureFile||$('documentFile').files[0];
      if(!personIds.length){$('documentError').textContent=t('בחרו לפחות אדם אחד שאליו שייך התיעוד.','Choose at least one person this record belongs to.');return;}
      if(!file)return;state.saving=true;$('saveDocument').disabled=true;$('documentError').textContent='';
      const fields={title:$('documentTitle').value,caption:$('documentCaption').value,personIds};
      try{
        await new Promise((resolve,reject)=>{
          const xhr=new XMLHttpRequest();xhr.open('POST','api/documents/upload?filename='+encodeURIComponent(file.name));xhr.setRequestHeader('X-Family-Token',window.FAMILY_API_TOKEN);xhr.setRequestHeader('X-Family-Document',encodeURIComponent(JSON.stringify(fields)));xhr.setRequestHeader('Content-Type','application/octet-stream');
          xhr.upload.onprogress=event=>{$('documentUploadStatus').textContent=t('מעלים את המקור… ','Uploading the original… ')+(event.lengthComputable?Math.round(100*event.loaded/event.total)+'%':'');};
          xhr.onload=()=>{let data;try{data=JSON.parse(xhr.responseText);}catch{reject(Error(t('לא התקבלה תשובה מהשרת.','The server did not respond.')));return;}if(xhr.status>=200&&xhr.status<300)resolve(data);else reject(Error(I.error(data.error)||t('הקובץ לא נשמר.','The file was not saved.')));};
          xhr.onerror=()=>reject(Error(t('החיבור נקטע. נסו שוב.','The connection was interrupted. Please try again.')));xhr.send(file);
        });
        editor.close();await refresh();
      }catch(error){$('documentError').textContent=error.message;}finally{state.saving=false;$('saveDocument').disabled=false;}
    });
  }
  const documentRoute=()=>location.hash.startsWith('#documents/')?location.hash.slice('#documents/'.length):'';
  function openDocument(item,sync=true){
    if(window.FamilyPDF?.isPDF(item)){
      if(!sync&&window.FamilyNavigation){window.FamilyNavigation.go('#documents',{replace:true});window.FamilyPDF.open(item,{replace:true});}
      else window.FamilyPDF.open(item);
      return;
    }
    const viewer=$('documentViewer');
    if(sync&&window.FamilyNavigation)window.FamilyNavigation.go('#documents/'+item.id);
    viewer.dataset.documentId=item.id;$('documentViewerTitle').textContent=item.name||item.title||item.filename;
    $('documentViewerBody').innerHTML=audio(item)?`<audio controls preload="metadata" src="${safe(item.src)}" aria-label="${safe(item.name||item.filename)}"></audio>`:item.mime?.startsWith('image/')?`<img src="${safe(item.src)}" alt="${safe(item.name||item.filename)}">`:item.mime==='application/pdf'?`<iframe src="${safe(item.src)}${item.src.includes('?')?'&':'?'}inline=1" title="${safe(item.name||item.filename)}"></iframe>`:`<p>${t('את הקובץ הזה אפשר לפתוח או להוריד בקישור למקור.','Open or download this file using the original link.')}</p>`;
    $('documentOriginal').href=item.src;if(!viewer.open)viewer.showModal();
  }
  function syncDocumentRoute(){
    const id=documentRoute(),viewer=$('documentViewer');
    if(!id){if(viewer.open)viewer.close();return;}
    if(state.view!=='documents'||viewer.open&&viewer.dataset.documentId===id)return;
    const item=state.items.find(item=>item.id===id);if(item)openDocument(item,false);
  }
  mount();
  window.addEventListener?.('popstate',syncDocumentRoute);window.addEventListener?.('hashchange',syncDocumentRoute);
  window.FamilyDocuments={activate(view){if(state.view!==view)state.query='';state.view=view;section.hidden=view!=='documents';if(view==='documents'){render();refresh();}syncDocumentRoute();},search(query){state.query=query;if(state.view==='documents')render();}};
  if(document.body.dataset.activeView==='documents')window.FamilyDocuments.activate('documents');
})();
