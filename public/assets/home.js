(() => {
  'use strict';
  const I18n=window.FamilyI18n;
  const $=id=>document.getElementById(id),app=()=>window.FamilyApp;
  const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const destinations=[['tree',I18n.t('אילן היוחסין'),I18n.t('משורש אחד, משפחה שלמה')],['gallery',I18n.t('הגלריה המשפחתית'),I18n.t('תמונות ותיוגים, רגע אחרי רגע')],['calendar',I18n.t('לוח שנה משפחתי'),I18n.t('ימי הולדת, חגים וסיבות לחגוג')],['directory',I18n.t('בני המשפחה'),I18n.t('האנשים והאלבומים של כולנו')],['photos',I18n.t('תמונות משפחתיות'),I18n.t('האלבום המשותף שלנו')],['videos',(I18n.isEnglish?'Videos':I18n.t('סרטונים')),I18n.t('הקולות והצחוק שנשארים')],['weddings',I18n.t('חתונות'),I18n.t('סיפורי האהבה שלנו')],['stories',I18n.t('הסיפורים שלנו'),I18n.t('זיכרונות שעוברים מדור לדור')],['nostalgia',I18n.t('פינת הנוסטלגיה'),I18n.t('עוד מבט ברגעים של פעם')],['updates',I18n.t('הרשמה לעדכונים'),I18n.t('התזכורות המשפחתיות שלנו')],['games',I18n.isEnglish?'Family Games':'משחקי משפחה',I18n.isEnglish?'How well do you know the family?':'כמה טוב אתם מכירים את המשפחה?'],['nursery',I18n.t('התינוקייה'),I18n.t('החיוכים הראשונים של כולנו')],['memorial',I18n.t('לזכרם'),I18n.t('מדליקים נר לזכרם')]];
  const motionQuery=matchMedia('(prefers-reduced-motion: reduce)'),reducedMotion=()=>window.FamilyAccessibility?.isReducedMotion()??motionQuery.matches;
  const TRANSITION_MS=650,CAPTION_DELAY_MS=1300,HOLD_MS=3500,FILM_SPEED=38;
  const state={view:'tree',ready:false,items:[],index:0,target:0,current:null,paused:false,loading:false,loadedAt:0,serial:0,advanceTimer:null,captionTimer:null,transitionTimer:null};
  const prepared=new Map();
  const desktopCarouselQuery=matchMedia('(min-width: 701px)');
  const desktopDevice=()=>typeof navigator==='undefined'?desktopCarouselQuery.matches:!(navigator.userAgentData?.mobile===true||/Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(navigator.userAgent||'')||/Macintosh/i.test(navigator.userAgent||'')&&navigator.maxTouchPoints>1);
  const requestFrame=callback=>typeof requestAnimationFrame==='function'?requestAnimationFrame(callback):setTimeout(()=>callback(Date.now()),16);
  const cancelFrame=id=>typeof cancelAnimationFrame==='function'?cancelAnimationFrame(id):clearTimeout(id);
  const carousel={enabled:false,center:0,index:0,id:null,serial:0,slots:new Map(),sizes:new Map(),positions:new Map(),travel:0,focused:null,frame:null,lastFrame:null,painting:false,trimTimer:null};
  // The slideshow has its own cache; it must never replace the Family Photos
  // grid's viewer list, especially before the home screen has been loaded.
  const viewerScope='home:photos';
  function disableCarousel(){
    const stage=$('homeSlideStage'),rail=$('homeCarouselRail');
    if(!stage||!rail)return;
    const wasEnabled=carousel.enabled;stopFilm();carousel.enabled=false;carousel.travel=0;carousel.focused=null;carousel.positions.clear();carousel.serial++;clearTimeout(carousel.trimTimer);carousel.trimTimer=null;
    stage.dataset.carousel='false';rail.hidden=true;
    for(const slot of carousel.slots.values())slot.button.remove();carousel.slots.clear();carousel.sizes.clear();
    $('homeSlideOpen').removeAttribute('aria-hidden');$('homeSlideOpen').removeAttribute('tabindex');$('homeSlideCaption').removeAttribute('aria-hidden');controls();if(wasEnabled)scheduleAdvance();
  }
  function paintCarousel(){
    let nearest=carousel.center,distance=Infinity;
    for(const [key,slot]of carousel.slots){const x=(carousel.positions.get(key)||0)-carousel.travel;slot.button.style.setProperty('--home-card-x',x+'px');if(Math.abs(x)<distance){nearest=key;distance=Math.abs(x);}}
    carousel.focused=nearest;
    for(const [key,slot]of carousel.slots){
      const active=key===nearest;if(slot.button.dataset.active===String(active))continue;
      slot.button.dataset.active=String(active);slot.button.setAttribute('aria-current',String(active));
      slot.button.setAttribute('aria-label',(active?(I18n.isEnglish?'Open photo: ':'פתיחת התמונה: '):(I18n.isEnglish?'Show photo: ':'הצגת התמונה: '))+(slot.item.caption||I18n.mediaName(slot.item)));
      slot.button.tabIndex=Math.abs(key-nearest)<=1?0:-1;
    }
    const item=carousel.slots.get(nearest)?.item;if(item){$('homeSlideOpen').dataset.photoId=item.id;const index=state.items.findIndex(photo=>photo.id===item.id),text=`${index+1} / ${state.items.length}`;if($('homeSlideCounter').textContent!==text)$('homeSlideCounter').textContent=text;}
  }
  function carouselPositions(height,width){
    const rail=$('homeCarouselRail'),keys=[...carousel.slots.keys()].sort((a,b)=>a-b),positions=new Map([[carousel.center,0]]);
    const cardWidth=key=>Math.max(90,Math.min(width*.55,height*(carousel.sizes.get(carousel.slots.get(key)?.item.src)||4/3)));
    for(let key=carousel.center+1;key<=keys.at(-1);key++)positions.set(key,positions.get(key-1)+(cardWidth(key-1)+cardWidth(key))/2+12);
    for(let key=carousel.center-1;key>=keys[0];key--)positions.set(key,positions.get(key+1)-(cardWidth(key+1)+cardWidth(key))/2-12);
    for(const [key,slot] of carousel.slots){
      slot.button.style.setProperty('--home-card-width',cardWidth(key)+'px');slot.button.dataset.active='';
    }
    const previousDistance=carousel.positions.get(carousel.center+1);if(carousel.width!==width||carousel.height!==height){if(previousDistance)carousel.travel*=positions.get(carousel.center+1)/previousDistance;carousel.width=width;carousel.height=height;}
    carousel.positions=positions;paintCarousel();
    rail.style.setProperty('--home-carousel-duration',TRANSITION_MS+'ms');
  }
  function stopFilm(){if(carousel.frame!==null)cancelFrame(carousel.frame);carousel.frame=null;carousel.lastFrame=null;}
  function startFilm(){
    if(carousel.frame!==null||carousel.painting||!carousel.enabled||$('homeCarouselRail')?.dataset.animate==='true'||!canAdvance())return;
    const run=time=>{
      carousel.frame=null;if(!carousel.enabled||!canAdvance()){carousel.lastFrame=null;return;}
      const next=carousel.slots.get(carousel.center+1),distance=carousel.positions.get(carousel.center+1);
      if(next?.button.dataset.ready==='failed'){carousel.lastFrame=null;slide(state.index+1,1);return;}
      if(!distance||next?.button.dataset.ready!=='true'){carousel.lastFrame=null;return;}
      const elapsed=carousel.lastFrame===null?0:Math.max(0,Math.min(64,time-carousel.lastFrame));carousel.lastFrame=time;carousel.travel+=elapsed*FILM_SPEED/1000;carousel.painting=true;
      if(carousel.travel>=distance){
        carousel.travel-=distance;carousel.center++;state.serial++;cleanTransition();hideCaption();state.index=state.target=(state.index+1)%state.items.length;state.current=next.item;carousel.index=state.index;carousel.id=next.item.id;
        const image=$('homeSlideImage');image.src=next.photo.src;image.alt=next.item.caption||I18n.mediaName(next.item);controls();syncCarousel();
      }else paintCarousel();
      carousel.painting=false;if(carousel.enabled&&canAdvance())carousel.frame=requestFrame(run);
    };
    carousel.lastFrame=null;carousel.frame=requestFrame(run);
  }
  function centeredPhoto(){
    if(!carousel.enabled)return state.current;
    const stage=$('homeSlideStage').getBoundingClientRect(),center=stage.left+stage.width/2;let nearest=carousel.slots.get(carousel.focused)?.item||state.current,distance=Infinity;
    for(const slot of carousel.slots.values()){const rect=slot.button.getBoundingClientRect(),delta=Math.abs(rect.left+rect.width/2-center);if(rect.width>0&&delta<distance){distance=delta;nearest=slot.item;}}
    return nearest;
  }
  function syncCarousel(direction=1,animate=false){
    const stage=$('homeSlideStage'),rail=$('homeCarouselRail'),image=$('homeSlideImage');if(!stage||!rail)return;
    if(state.view!=='home')return;
    const {width,height}=stage.getBoundingClientRect(),ratio=carousel.sizes.get(state.current?.src)||image?.naturalWidth/image?.naturalHeight,photoWidth=Math.min(width,height*ratio);
    const eligible=desktopDevice()&&state.items.length>=2&&state.current&&Number.isFinite(ratio)&&width>0&&height>0;
    if(!eligible){disableCarousel();return;}
    const wasEnabled=carousel.enabled,oldCenter=carousel.center,serial=++carousel.serial;
    clearTimeout(carousel.trimTimer);carousel.trimTimer=null;
    if(!wasEnabled){carousel.center=state.index;carousel.id=state.current.id;carousel.travel=0;}
    else if(carousel.id!==state.current.id){
      let distance=state.index-carousel.index;
      if(direction>0&&distance<0)distance+=state.items.length;
      if(direction<0&&distance>0)distance-=state.items.length;
      carousel.center+=distance;carousel.travel=0;
    }
    carousel.enabled=true;carousel.index=state.index;carousel.id=state.current.id;
    carousel.sizes.set(state.current.src,ratio);stage.dataset.carousel='true';rail.hidden=false;
    rail.dataset.animate=String(wasEnabled&&animate&&!reducedMotion());
    $('homeSlideOpen').setAttribute('aria-hidden','true');$('homeSlideOpen').setAttribute('tabindex','-1');$('homeSlideCaption').setAttribute('aria-hidden','true');controls();
    const radius=Math.min(8,Math.max(2,Math.ceil(width/(2*Math.max(90,photoWidth)))+2)),first=carousel.center-radius,last=carousel.center+radius;
    const moving=rail.dataset.animate==='true',from=moving?Math.min(first,oldCenter-radius):first,to=moving?Math.max(last,oldCenter+radius):last;
    const pending=new Map();
    for(let key=from;key<=to;key++){
      const index=(((state.index+key-carousel.center)%state.items.length)+state.items.length)%state.items.length,item=state.items[index];let slot=carousel.slots.get(key);
      if(slot&&(slot.item.id!==item.id||slot.item.src!==item.src)){slot.button.remove();carousel.slots.delete(key);slot=null;}
      if(!slot){
        const button=document.createElement('button'),photo=document.createElement('img'),caption=document.createElement('span');
        button.type='button';button.className='home-carousel-card';button.dataset.ready='false';
        photo.alt='';photo.decoding='async';photo.draggable=false;caption.className='home-carousel-caption';
        button.append(photo,caption);rail.append(button);slot={button,photo,caption,item};carousel.slots.set(key,slot);
        button.addEventListener('click',()=>{
          if(state.view!=='home'||!carousel.enabled)return;
          const offset=key-carousel.center;
          if(key!==carousel.focused){slide(state.index+offset,Math.sign(offset));return;}
          const visible=state.items.findIndex(p=>p.id===slot.item.id);if(visible<0)return;stopAdvance();window.FamilyMedia.open(state.items,visible,viewerScope);
        });
      }
      slot.item=item;slot.caption.textContent=item.caption||'';slot.caption.hidden=!item.caption;
      if(key===carousel.center){slot.photo.src=image.src;slot.button.dataset.ready='true';}
      else if(slot.button.dataset.ready!=='true'){
        if(!pending.has(item.src))pending.set(item.src,prepare(item));
        pending.get(item.src).then(loaded=>{
          if(serial!==carousel.serial||!carousel.enabled||state.view!=='home'||carousel.slots.get(key)!==slot)return;
          carousel.sizes.set(item.src,loaded.naturalWidth/loaded.naturalHeight||4/3);slot.photo.src=loaded.src;slot.button.dataset.ready='true';carouselPositions(height,width);startFilm();
        }).catch(()=>{if(serial===carousel.serial&&carousel.slots.get(key)===slot){slot.button.dataset.ready='failed';startFilm();}});
      }
    }
    carouselPositions(height,width);
    const trim=()=>{
      if(serial!==carousel.serial)return;
      for(const [key,slot] of carousel.slots)if(key<first||key>last){slot.button.remove();carousel.slots.delete(key);}
      const sources=new Set([...carousel.slots.values()].map(slot=>slot.item.src));for(const src of carousel.sizes.keys())if(!sources.has(src))carousel.sizes.delete(src);
    };
    if(moving)carousel.trimTimer=setTimeout(trim,TRANSITION_MS+100);else trim();startFilm();
  }
  const tiles=()=>destinations.map(([view,title,description],index)=>`<button class="home-tile home-tile-${view}" data-view="${view}" style="--tile-delay:${index*35}ms"><span class="home-tile-icon" aria-hidden="true"><svg viewBox="0 0 48 48" focusable="false"><use href="assets/home-icons.svg#${view}"></use></svg></span><span><strong>${title}</strong><small>${description}</small></span><span class="home-tile-arrow" aria-hidden="true">←</span></button>`).join('');
  const canAdvance=()=>state.view==='home'&&!state.paused&&!reducedMotion()&&state.items.length>1&&document.visibilityState==='visible'&&!$('mediaViewer')?.open;
  function stopAdvance(){clearTimeout(state.advanceTimer);state.advanceTimer=null;stopFilm();}
  function scheduleAdvance(){
    stopAdvance();if(!canAdvance())return;if(carousel.enabled){$('homeCarouselRail').dataset.animate='false';startFilm();return;}state.advanceTimer=setTimeout(()=>{state.advanceTimer=null;if(canAdvance())slide(state.index+1,1);},HOLD_MS);
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
    state.serial++;state.target=state.index;stopAdvance();clearTimeout(state.captionTimer);state.captionTimer=null;cleanTransition();carousel.serial++;clearTimeout(carousel.trimTimer);carousel.trimTimer=null;
  }
  function prepare(item){
    if(prepared.has(item.src))return prepared.get(item.src);
    const pending=new Promise((resolve,reject)=>{
      const image=new Image();image.decoding='async';
      image.onload=async()=>{try{await image.decode?.();}catch{}if(image.naturalWidth)resolve(image);else reject(Error('Photo unavailable'));};
      image.onerror=()=>reject(Error('Photo unavailable'));image.src=item.previewSrc||item.src;
    });
    prepared.set(item.src,pending);pending.catch(()=>{if(prepared.get(item.src)===pending)prepared.delete(item.src);});
    while(prepared.size>(desktopDevice()?8:3))prepared.delete(prepared.keys().next().value);
    return pending;
  }
  function preloadNext(){
    if(state.items.length>1)prepare(state.items[(state.index+1)%state.items.length]).catch(()=>{});
  }
  function controls(){
    const item=state.current,index=state.items.findIndex(photo=>photo.id===item?.id);
    $('homeSlideOpen').dataset.photoAlbum=viewerScope;$('homeSlideOpen').dataset.photoId=item?.id||'';
    $('homeSlideOpen').disabled=index<0||carousel.enabled;
    $('homeSlidePrevious').disabled=$('homeSlideNext').disabled=state.items.length<2;
    $('homeSlideCounter').textContent=index<0?'':`${index+1} / ${state.items.length}`;
  }
  function finish(item,serial){
    if(serial!==state.serial)return;cleanTransition();showCaptionLater(item,serial);scheduleAdvance();preloadNext();
  }
  async function slide(index,direction=1,failures=0){
    const serial=++state.serial;stopAdvance();clearTimeout(state.captionTimer);state.captionTimer=null;cleanTransition();
    if(!state.items.length){
      state.current=null;state.index=state.target=0;hideCaption();$('homeSlideImage').hidden=true;$('homeSlidePlaceholder').hidden=false;disableCarousel();controls();return;
    }
    state.target=(index+state.items.length)%state.items.length;const target=state.target,item=state.items[target];controls();
    if(state.current?.id===item.id&&state.current.src===item.src){
      const unchanged=state.current.caption===item.caption&&!$('homeSlideCaption').hidden;state.index=target;state.current=item;controls();
      if(!unchanged){hideCaption();showCaptionLater(item,serial);}syncCarousel(direction);scheduleAdvance();preloadNext();return;
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
      syncCarousel(direction,animate);
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
  function motionChanged(){updatePauseControl();syncCarousel();if(reducedMotion()){cleanTransition();stopAdvance();if(state.current&&$('homeSlideCaption').hidden)showCaptionLater(state.current,state.serial);}else scheduleAdvance();}
  function init(){
    state.ready=true;updatePauseControl();$('homeTiles').innerHTML=tiles();$('mobileMenuTiles').innerHTML=tiles();
    $('mobileMenuToggle').addEventListener('click',()=>$('mobileNavDialog').showModal());$('closeMobileMenu').addEventListener('click',()=>$('mobileNavDialog').close());
    $('homeSlidePrevious').addEventListener('click',()=>slide(state.target-1,-1));$('homeSlideNext').addEventListener('click',()=>slide(state.target+1,1));$('homeSlidePause').addEventListener('click',togglePause);
    $('homeSlideOpen').addEventListener('click',()=>{const index=state.items.findIndex(item=>item.id===state.current?.id);if(index<0)return;stopAdvance();window.FamilyMedia.open(state.items,index,viewerScope);});
    $('mediaViewer')?.addEventListener('close',scheduleAdvance);
    window.addEventListener('family-accessibility-changed',motionChanged);motionQuery.addEventListener?.('change',motionChanged);
    window.addEventListener('resize',()=>syncCarousel());desktopCarouselQuery.addEventListener?.('change',()=>syncCarousel());
    if(typeof ResizeObserver!=='undefined'&&$('homeSlideStage'))new ResizeObserver(()=>syncCarousel()).observe($('homeSlideStage'));
    window.addEventListener('family-media-changed',event=>{const result=event.detail;if(result.scope!=='photos')return;const old=state.items[state.index]?.id;state.items=result.collection?.items||state.items.map(item=>item.id===result.item?.id?{...item,...result.item}:item);window.FamilyMedia.register(viewerScope,state.items);if(state.view==='home')slide(Math.max(0,state.items.findIndex(item=>item.id===old)));});
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState!=='visible'){suspend();return;}if(state.view==='home'){slide(state.index);if(Date.now()-state.loadedAt>30000)load();}});window.addEventListener('pagehide',suspend);activate(app().getView());
  }
  window.FamilyHome={activate,centeredPhoto};document.addEventListener('DOMContentLoaded',init);
})();
