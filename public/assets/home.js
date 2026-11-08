(() => {
  'use strict';
  const I18n=window.FamilyI18n;
  const $=id=>document.getElementById(id),app=()=>window.FamilyApp;
  const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const destinations=[['tree',I18n.t('אילן היוחסין'),I18n.t('משורש אחד, משפחה שלמה')],['gallery',I18n.t('הגלריה המשפחתית'),I18n.t('תמונות ותיוגים, רגע אחרי רגע')],['calendar',I18n.t('לוח שנה משפחתי'),I18n.t('ימי הולדת, חגים וסיבות לחגוג')],['directory',I18n.t('בני המשפחה'),I18n.t('האנשים והאלבומים של כולנו')],['photos',I18n.t('תמונות משפחתיות'),I18n.t('האלבום המשותף שלנו')],['videos',(I18n.isEnglish?'Videos':I18n.t('סרטונים')),I18n.t('הקולות והצחוק שנשארים')],['weddings',I18n.t('חתונות'),I18n.t('סיפורי האהבה שלנו')],['stories',I18n.t('הסיפורים שלנו'),I18n.t('זיכרונות שעוברים מדור לדור')],['nostalgia',I18n.t('פינת הנוסטלגיה'),I18n.t('עוד מבט ברגעים של פעם')],['updates',I18n.t('הרשמה לעדכונים'),I18n.t('התזכורות המשפחתיות שלנו')],['games',I18n.isEnglish?'Family Games':'משחקי משפחה',I18n.isEnglish?'How well do you know the family?':'כמה טוב אתם מכירים את המשפחה?'],['nursery',I18n.t('התינוקייה'),I18n.t('החיוכים הראשונים של כולנו')],['memorial',I18n.t('לזכרם'),I18n.t('מדליקים נר לזכרם')]];
  const motionQuery=matchMedia('(prefers-reduced-motion: reduce)'),reducedMotion=()=>window.FamilyAccessibility?.isReducedMotion()??motionQuery.matches;
  const TRANSITION_MS=650,CAPTION_DELAY_MS=1300,HOLD_MS=3500;
  const state={view:'tree',ready:false,items:[],index:0,target:0,current:null,paused:false,loading:false,loadedAt:0,serial:0,advanceTimer:null,captionTimer:null,transitionTimer:null};
  const prepared=new Map();
  // The slideshow has its own cache; it must never replace the Family Photos
  // grid's viewer list, especially before the home screen has been loaded.
  const viewerScope='home:photos';
  const tiles=()=>destinations.map(([view,title,description],index)=>`<button class="home-tile home-tile-${view}" data-view="${view}" style="--tile-delay:${index*35}ms"><span class="home-tile-icon" aria-hidden="true"><svg viewBox="0 0 48 48" focusable="false"><use href="assets/home-icons.svg#${view}"></use></svg></span><span><strong>${title}</strong><small>${description}</small></span><span class="home-tile-arrow" aria-hidden="true">←</span></button>`).join('');
  const canAdvance=()=>state.view==='home'&&!state.paused&&!reducedMotion()&&state.items.length>1&&document.visibilityState==='visible'&&!$('mediaViewer')?.open;
  function stopAdvance(){clearTimeout(state.advanceTimer);state.advanceTimer=null;}
  function scheduleAdvance(){
    stopAdvance();if(canAdvance())state.advanceTimer=setTimeout(()=>{state.advanceTimer=null;if(canAdvance())slide(state.index+1,1);},HOLD_MS);
  }
  function hideCaption(){clearTimeout(state.captionTimer);state.captionTimer=null;$('homeSlideCaption').hidden=true;$('homeSlideCaption').classList.remove('is-visible');$('homeSlideCaption').textContent='';}
  function showCaptionLater(item,serial){
    clearTimeout(state.captionTimer);
    if(!item.caption)return;
    state.captionTimer=setTimeout(()=>{
      if(serial!==state.serial||state.view!=='home'||document.visibilityState!=='visible')return;
      const caption=$('homeSlideCaption');caption.textContent=item.caption;caption.hidden=false;caption.classList.add('is-visible');
    },CAPTION_DELAY_MS);
  }
  function cleanTransition(){
    clearTimeout(state.transitionTimer);state.transitionTimer=null;
    for(const node of $('homeSlideOpen').querySelectorAll('.home-slide-outgoing'))node.remove();
    $('homeSlideImage')?.classList.remove('home-slide-incoming');
  }
  function suspend(){
    state.serial++;state.target=state.index;stopAdvance();clearTimeout(state.captionTimer);state.captionTimer=null;cleanTransition();
  }
  function prepare(item){
    if(prepared.has(item.src))return prepared.get(item.src);
    const pending=new Promise((resolve,reject)=>{
      const image=new Image();image.decoding='async';
      image.onload=async()=>{try{await image.decode?.();}catch{}if(image.naturalWidth)resolve(image);else reject(Error('Photo unavailable'));};
      image.onerror=()=>reject(Error('Photo unavailable'));image.src=item.src;
    });
    prepared.set(item.src,pending);pending.catch(()=>{if(prepared.get(item.src)===pending)prepared.delete(item.src);});
    while(prepared.size>3)prepared.delete(prepared.keys().next().value);
    return pending;
  }
  function preloadNext(){
    if(state.items.length>1)prepare(state.items[(state.index+1)%state.items.length]).catch(()=>{});
  }
  function controls(){
    const item=state.current,index=state.items.findIndex(photo=>photo.id===item?.id);
    $('homeSlideOpen').disabled=index<0;
    $('homeSlidePrevious').disabled=$('homeSlideNext').disabled=state.items.length<2;
    $('homeSlideCounter').textContent=index<0?'':`${index+1} / ${state.items.length}`;
  }
  function finish(item,serial){
    if(serial!==state.serial)return;cleanTransition();showCaptionLater(item,serial);scheduleAdvance();preloadNext();
  }
  async function slide(index,direction=1,failures=0){
    const serial=++state.serial;stopAdvance();clearTimeout(state.captionTimer);state.captionTimer=null;cleanTransition();
    if(!state.items.length){
      state.current=null;state.index=state.target=0;hideCaption();$('homeSlideImage').hidden=true;$('homeSlidePlaceholder').hidden=false;controls();return;
    }
    state.target=(index+state.items.length)%state.items.length;const target=state.target,item=state.items[target];controls();
    if(state.current?.id===item.id&&state.current.src===item.src){
      const unchanged=state.current.caption===item.caption&&!$('homeSlideCaption').hidden;state.index=target;state.current=item;controls();
      if(!unchanged){hideCaption();showCaptionLater(item,serial);}scheduleAdvance();preloadNext();return;
    }
    try{
      const image=await prepare(item);
      if(serial!==state.serial||state.view!=='home'||document.visibilityState!=='visible')return;
      prepared.delete(item.src);hideCaption();
      const previous=$('homeSlideImage'),animate=!reducedMotion(),outgoing=state.current&&!previous.hidden;
      previous.removeAttribute('id');previous.classList.remove('home-slide-incoming');previous.classList.add('home-slide-outgoing');previous.alt='';previous.setAttribute('aria-hidden','true');
      image.id='homeSlideImage';image.alt=item.caption||I18n.mediaName(item)||I18n.t('תמונה משפחתית');image.hidden=false;image.className=animate?'home-slide-incoming':'';
      $('homeSlideOpen').style.setProperty('--home-slide-duration',TRANSITION_MS+'ms');$('homeSlideOpen').style.setProperty('--home-slide-shift',direction<0?'-24px':'24px');$('homeSlideOpen').append(image);
      state.index=target;state.current=item;$('homeSlidePlaceholder').hidden=true;controls();
      if(!outgoing||!animate)previous.remove();
      if(animate){image.addEventListener('animationend',event=>{if(event.animationName==='homePhotoIn')finish(item,serial);},{once:true});state.transitionTimer=setTimeout(()=>finish(item,serial),TRANSITION_MS+100);}else finish(item,serial);
    }catch{
      if(serial!==state.serial||state.view!=='home')return;
      if(failures+1<state.items.length){slide(target+1,direction,failures+1);return;}
      // A failed download cannot put a new caption over the old picture.
      if(!state.current){$('homeSlideImage').hidden=true;$('homeSlidePlaceholder').hidden=false;hideCaption();}
      else showCaptionLater(state.current,serial);
    }
  }
  async function load(){
    if(state.loading)return;state.loading=true;
    try{const response=await I18n.fetch('api/collections/photos',{cache:'no-store'});if(!response.ok)throw Error();const data=await response.json(),old=state.items[state.index]?.id;state.items=data.items;state.loadedAt=Date.now();window.FamilyMedia.register(viewerScope,state.items);if(state.view==='home')slide(Math.max(0,state.items.findIndex(item=>item.id===old)));}
    catch{if(!state.items.length)slide(0);}finally{state.loading=false;}
  }
  function activate(view){state.view=view;$('homeView').hidden=view!=='home';if(!state.ready)return;if(view!=='home'){suspend();return;}slide(state.index);load();}
  function updatePauseControl(){
    if(!state.ready)return;
    const reduced=reducedMotion(),paused=state.paused||reduced,button=$('homeSlidePause');
    button.textContent=paused?'▶':'Ⅱ';button.disabled=reduced;
    const label=reduced?(I18n.isEnglish?'Automatic slideshow is paused to reduce motion. Use previous and next to browse.':'התמונות המתחלפות מושהות להפחתת תנועה. אפשר לדפדף בכפתורי הקודם והבא.'):paused?I18n.t('הפעלת התמונות המתחלפות'):I18n.t('השהיית התמונות המתחלפות');
    button.setAttribute('aria-label',label);button.title=reduced?label:'';
  }
  function togglePause(){if(reducedMotion())return;state.paused=!state.paused;updatePauseControl();if(state.paused)stopAdvance();else scheduleAdvance();}
  function motionChanged(){updatePauseControl();if(reducedMotion()){cleanTransition();stopAdvance();if(state.current&&$('homeSlideCaption').hidden)showCaptionLater(state.current,state.serial);}else scheduleAdvance();}
  function init(){
    state.ready=true;updatePauseControl();$('homeTiles').innerHTML=tiles();$('mobileMenuTiles').innerHTML=tiles();
    $('mobileMenuToggle').addEventListener('click',()=>$('mobileNavDialog').showModal());$('closeMobileMenu').addEventListener('click',()=>$('mobileNavDialog').close());
    $('homeSlidePrevious').addEventListener('click',()=>slide(state.target-1,-1));$('homeSlideNext').addEventListener('click',()=>slide(state.target+1,1));$('homeSlidePause').addEventListener('click',togglePause);
    $('homeSlideOpen').addEventListener('click',()=>{const index=state.items.findIndex(item=>item.id===state.current?.id);if(index<0)return;stopAdvance();window.FamilyMedia.open(state.items,index,viewerScope);});
    $('mediaViewer')?.addEventListener('close',scheduleAdvance);
    window.addEventListener('family-accessibility-changed',motionChanged);motionQuery.addEventListener?.('change',motionChanged);
    window.addEventListener('family-media-changed',event=>{const result=event.detail;if(result.scope!=='photos')return;const old=state.items[state.index]?.id;state.items=result.collection?.items||state.items.map(item=>item.id===result.item?.id?{...item,...result.item}:item);window.FamilyMedia.register(viewerScope,state.items);if(state.view==='home')slide(Math.max(0,state.items.findIndex(item=>item.id===old)));});
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState!=='visible'){suspend();return;}if(state.view==='home'){slide(state.index);if(Date.now()-state.loadedAt>30000)load();}});window.addEventListener('pagehide',suspend);activate(app().getView());
  }
  window.FamilyHome={activate};document.addEventListener('DOMContentLoaded',init);
})();
