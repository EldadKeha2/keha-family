(() => {
  'use strict';
  const $=id=>document.getElementById(id),app=()=>window.FamilyApp;
  const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const destinations=[['tree','♧','אילן היוחסין','משורש אחד, משפחה שלמה'],['gallery','▦','הגלריה','תמונות ותיוגים, רגע אחרי רגע'],['calendar','▣','לוח שנה משפחתי','ימי הולדת, חגים וסיבות לחגוג'],['directory','♡','בני המשפחה','האנשים והאלבומים של כולנו'],['photos','▧','תמונות משפחתיות','האלבום המשותף שלנו'],['videos','▷','סרטונים','הקולות והצחוק שנשארים'],['weddings','♧','חתונות','סיפורי האהבה שלנו'],['stories','✎','הסיפורים שלנו','זיכרונות שעוברים מדור לדור'],['nostalgia','❖','פינת הנוסטלגיה','עוד מבט ברגעים של פעם']];
  const state={view:'tree',ready:false,items:[],index:0,paused:matchMedia('(prefers-reduced-motion: reduce)').matches,loading:false,loadedAt:0,failures:0};
  const tiles=()=>destinations.map(([view,icon,title,description],index)=>`<button class="home-tile home-tile-${view}" data-view="${view}" style="--tile-delay:${index*35}ms"><span class="home-tile-icon" aria-hidden="true">${icon}</span><span><strong>${title}</strong><small>${description}</small></span><span class="home-tile-arrow" aria-hidden="true">←</span></button>`).join('');
  function slide(index){
    if(!state.items.length){$('homeSlideImage').hidden=true;$('homeSlidePlaceholder').hidden=false;$('homeSlideCaption').textContent='';$('homeSlideCounter').textContent='';$('homeSlideOpen').disabled=true;return;}
    state.index=(index+state.items.length)%state.items.length;const item=state.items[state.index];$('homeSlideImage').hidden=false;$('homeSlidePlaceholder').hidden=true;$('homeSlideOpen').disabled=false;
    $('homeSlideImage').src=item.src;$('homeSlideImage').alt=item.caption||item.name||'תמונה משפחתית';$('homeSlideCaption').textContent=item.caption||'';$('homeSlideCounter').textContent=`${state.index+1} / ${state.items.length}`;
    $('homeSlidePrevious').disabled=$('homeSlideNext').disabled=state.items.length<2;
    window.FamilyMedia.register('photos',state.items);
  }
  async function load(){
    if(state.loading)return;state.loading=true;
    try{const response=await fetch('api/collections/photos',{cache:'no-store'});if(!response.ok)throw Error();const data=await response.json(),old=state.items[state.index]?.id;state.items=data.items;state.loadedAt=Date.now();state.failures=0;slide(Math.max(0,state.items.findIndex(item=>item.id===old)));}
    catch{if(!state.items.length)slide(0);}finally{state.loading=false;}
  }
  function activate(view){state.view=view;$('homeView').hidden=view!=='home';if(!state.ready||view!=='home')return;slide(state.index);load();}
  function togglePause(){state.paused=!state.paused;$('homeSlidePause').textContent=state.paused?'▶':'Ⅱ';$('homeSlidePause').setAttribute('aria-label',state.paused?'הפעלת התמונות המתחלפות':'השהיית התמונות המתחלפות');}
  function init(){
    state.ready=true;$('homeSlidePause').textContent=state.paused?'▶':'Ⅱ';$('homeSlidePause').setAttribute('aria-label',state.paused?'הפעלת התמונות המתחלפות':'השהיית התמונות המתחלפות');$('homeTiles').innerHTML=tiles();$('mobileMenuTiles').innerHTML=tiles();
    $('mobileMenuToggle').addEventListener('click',()=>$('mobileNavDialog').showModal());$('closeMobileMenu').addEventListener('click',()=>$('mobileNavDialog').close());
    $('homeSlidePrevious').addEventListener('click',()=>slide(state.index-1));$('homeSlideNext').addEventListener('click',()=>slide(state.index+1));$('homeSlidePause').addEventListener('click',togglePause);
    $('homeSlideOpen').addEventListener('click',()=>window.FamilyMedia.open(state.items,state.index,'photos'));
    $('homeSlideImage').addEventListener('error',()=>{if(++state.failures<state.items.length)slide(state.index+1);else{$('homeSlideImage').hidden=true;$('homeSlidePlaceholder').hidden=false;}});
    setInterval(()=>{if(state.view==='home'&&!state.paused&&state.items.length>1&&document.visibilityState==='visible')slide(state.index+1);},6000);
    window.addEventListener('family-media-changed',event=>{if(event.detail.scope!=='photos')return;const old=state.items[state.index]?.id;state.items=event.detail.collection.items;if(state.view==='home')slide(Math.max(0,state.items.findIndex(item=>item.id===old)));});
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&state.view==='home'&&Date.now()-state.loadedAt>30000)load();});activate(app().getView());
  }
  window.FamilyHome={activate};document.addEventListener('DOMContentLoaded',init);
})();
