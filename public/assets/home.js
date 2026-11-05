(() => {
  'use strict';
  const I18n=window.FamilyI18n;
  const $=id=>document.getElementById(id),app=()=>window.FamilyApp;
  const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const destinations=[['tree',I18n.t('אילן היוחסין'),I18n.t('משורש אחד, משפחה שלמה')],['gallery',I18n.t('הגלריה המשפחתית'),I18n.t('תמונות ותיוגים, רגע אחרי רגע')],['calendar',I18n.t('לוח שנה משפחתי'),I18n.t('ימי הולדת, חגים וסיבות לחגוג')],['directory',I18n.t('בני המשפחה'),I18n.t('האנשים והאלבומים של כולנו')],['photos',I18n.t('תמונות משפחתיות'),I18n.t('האלבום המשותף שלנו')],['videos',(I18n.isEnglish?'Videos':I18n.t('סרטונים')),I18n.t('הקולות והצחוק שנשארים')],['weddings',I18n.t('חתונות'),I18n.t('סיפורי האהבה שלנו')],['stories',I18n.t('הסיפורים שלנו'),I18n.t('זיכרונות שעוברים מדור לדור')],['nostalgia',I18n.t('פינת הנוסטלגיה'),I18n.t('עוד מבט ברגעים של פעם')],['updates',I18n.t('הרשמה לעדכונים'),I18n.t('התזכורות המשפחתיות שלנו')],['games',I18n.isEnglish?'Family Games':'משחקי משפחה',I18n.isEnglish?'How well do you know the family?':'כמה טוב אתם מכירים את המשפחה?'],['nursery',I18n.t('התינוקייה'),I18n.t('החיוכים הראשונים של כולנו')],['memorial',I18n.t('לזכרם'),I18n.t('מדליקים נר לזכרם')]];
  const motionQuery=matchMedia('(prefers-reduced-motion: reduce)'),reducedMotion=()=>window.FamilyAccessibility?.isReducedMotion()??motionQuery.matches;
  const state={view:'tree',ready:false,items:[],index:0,paused:false,loading:false,loadedAt:0,failures:0};
  const tiles=()=>destinations.map(([view,title,description],index)=>`<button class="home-tile home-tile-${view}" data-view="${view}" style="--tile-delay:${index*35}ms"><span class="home-tile-icon" aria-hidden="true"><svg viewBox="0 0 48 48" focusable="false"><use href="assets/home-icons.svg#${view}"></use></svg></span><span><strong>${title}</strong><small>${description}</small></span><span class="home-tile-arrow" aria-hidden="true">←</span></button>`).join('');
  function slide(index){
    if(!state.items.length){$('homeSlideImage').hidden=true;$('homeSlidePlaceholder').hidden=false;$('homeSlideCaption').textContent='';$('homeSlideCounter').textContent='';$('homeSlideOpen').disabled=true;return;}
    state.index=(index+state.items.length)%state.items.length;const item=state.items[state.index];$('homeSlideImage').hidden=false;$('homeSlidePlaceholder').hidden=true;$('homeSlideOpen').disabled=false;
    $('homeSlideImage').src=item.src;$('homeSlideImage').alt=item.caption||I18n.mediaName(item)||I18n.t('תמונה משפחתית');$('homeSlideCaption').textContent=item.caption||'';$('homeSlideCounter').textContent=`${state.index+1} / ${state.items.length}`;
    $('homeSlidePrevious').disabled=$('homeSlideNext').disabled=state.items.length<2;
    window.FamilyMedia.register('photos',state.items);
  }
  async function load(){
    if(state.loading)return;state.loading=true;
    try{const response=await I18n.fetch('api/collections/photos',{cache:'no-store'});if(!response.ok)throw Error();const data=await response.json(),old=state.items[state.index]?.id;state.items=data.items;state.loadedAt=Date.now();state.failures=0;slide(Math.max(0,state.items.findIndex(item=>item.id===old)));}
    catch{if(!state.items.length)slide(0);}finally{state.loading=false;}
  }
  function activate(view){state.view=view;$('homeView').hidden=view!=='home';if(!state.ready||view!=='home')return;slide(state.index);load();}
  function updatePauseControl(){
    if(!state.ready)return;
    const reduced=reducedMotion(),paused=state.paused||reduced,button=$('homeSlidePause');
    button.textContent=paused?'▶':'Ⅱ';button.disabled=reduced;
    const label=reduced?(I18n.isEnglish?'Automatic slideshow is paused to reduce motion. Use previous and next to browse.':'התמונות המתחלפות מושהות להפחתת תנועה. אפשר לדפדף בכפתורי הקודם והבא.'):paused?I18n.t('הפעלת התמונות המתחלפות'):I18n.t('השהיית התמונות המתחלפות');
    button.setAttribute('aria-label',label);button.title=reduced?label:'';
  }
  function togglePause(){if(reducedMotion())return;state.paused=!state.paused;updatePauseControl();}
  function init(){
    state.ready=true;updatePauseControl();$('homeTiles').innerHTML=tiles();$('mobileMenuTiles').innerHTML=tiles();
    $('mobileMenuToggle').addEventListener('click',()=>$('mobileNavDialog').showModal());$('closeMobileMenu').addEventListener('click',()=>$('mobileNavDialog').close());
    $('homeSlidePrevious').addEventListener('click',()=>slide(state.index-1));$('homeSlideNext').addEventListener('click',()=>slide(state.index+1));$('homeSlidePause').addEventListener('click',togglePause);
    $('homeSlideOpen').addEventListener('click',()=>window.FamilyMedia.open(state.items,state.index,'photos'));
    $('homeSlideImage').addEventListener('error',()=>{if(++state.failures<state.items.length)slide(state.index+1);else{$('homeSlideImage').hidden=true;$('homeSlidePlaceholder').hidden=false;}});
    setInterval(()=>{if(state.view==='home'&&!state.paused&&!reducedMotion()&&state.items.length>1&&document.visibilityState==='visible')slide(state.index+1);},6000);
    window.addEventListener('family-accessibility-changed',updatePauseControl);motionQuery.addEventListener?.('change',updatePauseControl);
    window.addEventListener('family-media-changed',event=>{const result=event.detail;if(result.scope!=='photos')return;const old=state.items[state.index]?.id;state.items=result.collection?.items||state.items.map(item=>item.id===result.item?.id?{...item,...result.item}:item);if(state.view==='home')slide(Math.max(0,state.items.findIndex(item=>item.id===old)));});
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&state.view==='home'&&Date.now()-state.loadedAt>30000)load();});activate(app().getView());
  }
  window.FamilyHome={activate};document.addEventListener('DOMContentLoaded',init);
})();
