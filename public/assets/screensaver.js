(() => {
  'use strict';
  const I=window.FamilyI18n,$=id=>document.getElementById(id),tr=(he,en)=>I.isEnglish?en:he;
  const scope='screensaver',seed=Math.floor(Math.random()*2147483647);
  const state={branch:'all',items:[],total:0,pending:false,loaded:false,error:'',preview:0,request:0,abort:null};
  let pageSelect,fullscreenSelect,fullscreenFamily;
  const isFullscreen=()=>window.FamilyPhotoFullscreen?.isActive()&&window.FamilyMedia?.photoState().scope===scope;
  const branches=()=>window.FAMILY_DATA?.branches||[];
  function fill(select){
    select.replaceChildren();
    for(const branch of [{id:'all',title:tr('הכל — כל המשפחה','All — the whole family')},...branches()]){
      const option=document.createElement('option');option.value=branch.id;option.textContent=branch.id==='all'?branch.title:I.branchName(branch);select.append(option);
    }
    select.value=state.branch;
  }
  function familyControl(className){
    const label=document.createElement('label');label.className=className;label.dir=I.isEnglish?'ltr':'rtl';
    const text=document.createElement('span');text.textContent=tr('ענף במשפחה','Family branch');
    const select=document.createElement('select');select.className='screensaver-family-select';select.setAttribute('aria-label',text.textContent);fill(select);
    select.addEventListener('change',()=>{state.branch=branches().some(branch=>branch.id===select.value)?select.value:'all';void load();});label.append(text,select);return {label,select};
  }
  function render(){
    if(!$('screensaverStart'))return;
    pageSelect.value=state.branch;if(fullscreenSelect)fullscreenSelect.value=state.branch;
    const item=state.items[state.preview]||state.items[0],image=$('screensaverPreview'),placeholder=$('screensaverPlaceholder');
    if(item&&!state.pending){const src=item.preview?.src||item.src;if(image.getAttribute('src')!==src)image.src=src;image.alt=item.caption||tr('תמונה מהאלבום המשפחתי','A photo from the family album');image.hidden=false;placeholder.hidden=true;}
    else{image.hidden=true;image.removeAttribute('src');placeholder.hidden=false;}
    const empty=tr('עדיין אין תמונות מתויגות בענף הזה. אפשר לבחור ענף אחר.','There are no tagged photos in this branch yet. Choose another branch.');
    $('screensaverPlaceholderText').textContent=state.pending?tr('מכינים את הרגעים המשפחתיים…','Preparing your family moments…'):state.error||empty;
    $('screensaverStart').disabled=state.pending||!state.items.length;
    $('screensaverStatus').textContent=state.error||(state.pending?tr('טוענים תמונות…','Loading photos…'):state.total?state.total.toLocaleString(I.locale)+tr(' תמונות בשומר המסך',' photos in the screensaver'):'');
    $('screensaverRetry').hidden=!state.error;
    if(fullscreenFamily)fullscreenFamily.querySelector('button').hidden=!state.error;
    const options=window.FamilyPhotoFullscreen.options();$('screensaverNames').checked=options.showNames;$('screensaverAges').checked=options.showAges;
    const text=item&&!state.pending?[item.caption,options.showNames||options.showAges?(item.tags||[]).map(person=>{
      const name=options.showNames?I.personName(person):'',age=options.showAges?window.FamilyPhotoDate?.ageFor(person,item):null;
      return [name,age?tr('גיל ','Age ')+age.text:''].filter(Boolean).join(' · ');
    }).filter(Boolean).join(' / '):''].filter(Boolean).join(' · '):'';
    $('screensaverPreviewCaption').textContent=text;$('screensaverPreviewCaption').hidden=!text;
  }
  async function load(){
    state.abort?.abort();const controller=state.abort=new AbortController(),request=++state.request;
    state.pending=true;state.loaded=false;state.error='';state.items=[];state.total=0;state.preview=0;
    const selected=branches().find(branch=>branch.id===state.branch),unit=selected?.unit||'';
    if(isFullscreen())window.FamilyPhotoFullscreen.setAlbumStatus(true,tr('טוענים תמונות מהענף שנבחר…','Loading photos from this branch…'));
    render();
    try{
      let pages=1;
      for(let page=1;page<=pages;page++){
        const query=new URLSearchParams({page:String(page),size:'500',filter:'all',unit,sort:'random',seed:String(seed)});
        const response=await I.fetch('api/collections/gallery?'+query,{cache:'no-store',signal:controller.signal});
        if(!response.ok)throw Error(tr('התמונות לא נטענו. נסו שוב.','Photos could not load. Please try again.'));
        const result=await response.json();if(request!==state.request||controller.signal.aborted)return;
        pages=result.pagination?.pages||1;state.total=result.pagination?.total??result.count??result.items.length;
        const seen=new Set(state.items.map(item=>item.id));state.items.push(...result.items.filter(item=>item.kind==='photo'&&!seen.has(item.id)));
        state.pending=false;state.loaded=true;
        if(isFullscreen()&&page===1){
          if(state.items.length){window.FamilyMedia.open([...state.items],0,scope);window.FamilyPhotoFullscreen.setAlbumStatus(false);}
          else window.FamilyPhotoFullscreen.setAlbumStatus(true,tr('אין תמונות בענף הזה. בחרו ענף אחר למעלה.','No photos in this branch. Choose another branch above.'));
        }
        // A private album keeps filtering and paging out of every gallery.
        if(state.items.length)window.FamilyMedia.register(scope,[...state.items]);
        render();
      }
    }catch(error){
      if(request!==state.request||controller.signal.aborted)return;
      state.pending=false;state.error=state.items.length?tr('חלק מהתמונות לא נטענו. אפשר להמשיך או לנסות שוב.','Some photos could not load. Continue or try again.'):tr('התמונות לא נטענו. נסו שוב.','Photos could not load. Please try again.');
      if(isFullscreen()&&!state.items.length)window.FamilyPhotoFullscreen.setAlbumStatus(true,state.error);render();
    }
  }
  function start(){
    if(state.pending||!state.items.length)return;
    if(window.FamilyMedia.open([...state.items],state.preview,scope)&&window.FamilyPhotoFullscreen.enter(false))window.FamilyPhotoFullscreen.play();
  }
  function mountFullscreen(bar){
    fullscreenFamily?.remove();fullscreenSelect=null;fullscreenFamily=null;
    if(window.FamilyMedia.photoState().scope!==scope)return;
    const control=familyControl('photo-fullscreen-family');fullscreenFamily=control.label;fullscreenSelect=control.select;
    const retry=document.createElement('button');retry.type='button';retry.textContent=tr('ניסיון נוסף','Retry');retry.hidden=!state.error;retry.addEventListener('click',()=>void load());fullscreenFamily.append(retry);bar.append(fullscreenFamily);
  }
  function fullscreenClosed(){
    fullscreenFamily?.remove();fullscreenFamily=null;fullscreenSelect=null;
    const id=window.FamilyMedia?.current()?.id,index=state.items.findIndex(item=>item.id===id);if(index>=0)state.preview=index;render();
  }
  function activate(view){
    const host=$('screensaverView');if(!host)return;host.hidden=view!=='screensaver';
    if(view==='screensaver'){if(!state.loaded&&!state.pending)void load();else render();}
  }
  function init(){
    const host=$('screensaverView');if(!host)return;
    host.innerHTML='<div class="screensaver-toolbar"><div id="screensaverFamily"></div><div class="screensaver-label-options"><label><input id="screensaverNames" type="checkbox">'+tr('תוויות שמות','Name labels')+'</label><label><input id="screensaverAges" type="checkbox">'+tr('גילים בזמן הצילום','Ages in the photo')+'</label></div></div><div class="screensaver-frame"><img id="screensaverPreview" alt="" hidden><div id="screensaverPlaceholder" class="screensaver-placeholder"><img src="assets/medallion.svg" alt="" width="76" height="76"><p id="screensaverPlaceholderText"></p></div><div class="screensaver-invitation"><span aria-hidden="true">✧ · ❖ · ✧</span><h3>'+tr('הרגעים שלנו, על כל המסך','Our moments, filling the screen')+'</h3><button id="screensaverStart" class="primary-button" type="button" disabled><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7Z"/></svg>'+tr('הפעלת שומר המסך','Start screensaver')+'</button></div></div><p id="screensaverPreviewCaption" class="screensaver-preview-caption" hidden></p><div class="screensaver-footer"><span id="screensaverStatus" role="status" aria-live="polite"></span><button id="screensaverRetry" class="secondary-button" type="button" hidden>'+tr('ניסיון נוסף','Try again')+'</button><p>'+tr('בחרו את כל המשפחה או אחד מששת הענפים, והזיכרונות יתחלפו מעצמם.','Choose the whole family or one of six branches, and let the memories unfold.')+'</p></div>';
    const control=familyControl('screensaver-family');pageSelect=control.select;$('screensaverFamily').append(control.label);
    $('screensaverStart').addEventListener('click',start);$('screensaverRetry').addEventListener('click',()=>void load());
    for(const [id,option]of [['screensaverNames','showNames'],['screensaverAges','showAges']])$(id).addEventListener('change',()=>{window.FamilyPhotoFullscreen.configure({[option]:$(id).checked});render();});
    render();if(window.FamilyApp?.getView()==='screensaver'||location.hash==='#screensaver')activate('screensaver');
  }
  window.FamilyScreensaver={activate,mountFullscreen,fullscreenClosed};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
