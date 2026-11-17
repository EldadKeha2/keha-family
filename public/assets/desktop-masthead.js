(() => {
  'use strict';
  function init(){
    const header=document.querySelector('.page-shell>.site-header');
    const actions=header?.querySelector('[data-home-install-actions]');
    if(!header||!actions)return;
    const selectors=['[data-desktop-refresh]','[data-desktop-bookmark-action]','[data-home-install-share]','[data-desktop-install-action]'];
    const desktop=matchMedia('(min-width:701px)');
    let frame=0;
    function fit(){
      frame=0;
      const buttons=selectors.map(selector=>actions.querySelector(selector)).filter(Boolean);
      for(const button of buttons)button.removeAttribute('data-header-icon-only');
      if(!desktop.matches){
        header.style.removeProperty('--desktop-masthead-width');
        header.style.removeProperty('--desktop-masthead-margin');
        return;
      }
      // Measure the actual ornament edges, including browser zoom and scrollbars.
      // Only the masthead breaks out of the normal page content width.
      const left=document.querySelector('.edge-left')?.getBoundingClientRect();
      const right=document.querySelector('.edge-right')?.getBoundingClientRect();
      if(left&&right&&right.left>left.right){
        const shell=header.parentElement,style=getComputedStyle(shell);
        const contentWidth=shell.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight);
        const width=right.left-left.right;
        header.style.setProperty('--desktop-masthead-width',width+'px');
        header.style.setProperty('--desktop-masthead-margin',(contentWidth-width)/2+'px');
      }
      const fits=()=>{
        const widths=[...actions.children].map(child=>child.getBoundingClientRect().width).filter(width=>width>0);
        const gap=parseFloat(getComputedStyle(actions).columnGap)||0;
        return widths.reduce((sum,width)=>sum+width,0)+Math.max(0,widths.length-1)*gap<=actions.clientWidth+1;
      };
      // Start with all labels on every measurement, so zooming back out restores
      // them. Collapse only as many labels as the real controls require.
      for(const button of buttons){
        if(fits())break;
        if(button.getBoundingClientRect().width>0)button.setAttribute('data-header-icon-only','');
      }
    }
    function schedule(){if(!frame)frame=requestAnimationFrame(fit);}
    window.addEventListener('resize',schedule);
    window.addEventListener('family-accessibility-changed',schedule);
    if(typeof ResizeObserver==='function'){
      const observer=new ResizeObserver(schedule);
      observer.observe(header.parentElement);observer.observe(actions);
    }
    if(typeof MutationObserver==='function')new MutationObserver(schedule).observe(actions,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
    document.fonts?.ready.then(schedule);
    document.fonts?.addEventListener('loadingdone',schedule);
    schedule();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
