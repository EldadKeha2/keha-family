(() => {
  'use strict';
  const hint=document.getElementById('homeMoreHint'),end=document.getElementById('homeScrollEnd'),home=document.getElementById('homeView');
  if(!hint||!end||!home)return;
  const phoneQuery=matchMedia('(max-width: 700px)'),motionQuery=matchMedia('(prefers-reduced-motion: reduce)');
  const english=window.FamilyI18n?.isEnglish;
  hint.innerHTML='<span>'+(english?'More pages below':'יש עוד עמודים למטה')+'</span><svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="m5 7 5 5 5-5"/></svg>';
  let scheduled=false;
  const viewport=()=>({height:window.visualViewport?.height||window.innerHeight,offset:window.visualViewport?.offsetTop||0});
  function update(){
    const visible=viewport();
    hint.hidden=!phoneQuery.matches||document.body.dataset.activeView!=='home'||home.hidden||document.visibilityState==='hidden'||Boolean(document.querySelector('dialog[open]'))||end.getBoundingClientRect().bottom<=visible.offset+visible.height;
  }
  function schedule(){
    if(scheduled)return;
    scheduled=true;requestAnimationFrame(()=>{scheduled=false;update();});
  }
  hint.addEventListener('click',()=>{
    if(hint.hidden)return;
    const reduced=window.FamilyAccessibility?.isReducedMotion?.()??motionQuery.matches;
    window.scrollBy({top:Math.max(1,Math.round(viewport().height*.65)),behavior:reduced?'instant':'smooth'});
    schedule();
  });
  window.addEventListener('scroll',schedule,{passive:true});
  window.addEventListener('resize',schedule,{passive:true});
  window.addEventListener('pageshow',schedule);
  window.addEventListener('family-accessibility-changed',schedule);
  window.visualViewport?.addEventListener('resize',schedule,{passive:true});
  window.visualViewport?.addEventListener('scroll',schedule,{passive:true});
  document.addEventListener('visibilitychange',schedule);
  phoneQuery.addEventListener?.('change',schedule);
  motionQuery.addEventListener?.('change',schedule);
  if(typeof MutationObserver==='function')new MutationObserver(schedule).observe(document.body,{attributes:true,subtree:true,attributeFilter:['data-active-view','open']});
  if(typeof ResizeObserver==='function')new ResizeObserver(schedule).observe(home);
  if(typeof IntersectionObserver==='function')new IntersectionObserver(schedule).observe(end);
  update();
})();
