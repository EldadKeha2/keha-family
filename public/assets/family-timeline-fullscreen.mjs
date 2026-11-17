// Keep the mounted timeline and its zoom/pan state when changing screen size.
export function bindTimelineFullscreen(root,{tr}){
  const doc=root.ownerDocument,win=doc.defaultView;
  let active=false,hadNative=false,previousOverflow='';
  function refresh(){
    const button=root.querySelector('[data-timeline-fullscreen]');
    if(button){
      const label=active?tr('יציאה ממסך מלא','Exit fullscreen'):tr('מסך מלא','Fullscreen');
      button.setAttribute('aria-label',label);button.title=label;
      button.setAttribute('aria-pressed',String(active));
      button.querySelector('span').textContent=label;
    }
    if(active){
      const toolbar=root.querySelector('.ft-toolbar');
      // The four-rail overview is 524px high before scaling. Leave space for
      // the toolbar, padding and footer, then fill the available screen.
      const scale=Math.max(.55,Math.min(2,(root.clientHeight-(toolbar?.offsetHeight||48)-64)/524));
      root.style.setProperty('--ft-fullscreen-scale',String(scale));
    }
  }
  function leaveNative(){
    if(doc.fullscreenElement===root)try{Promise.resolve(doc.exitFullscreen?.()).catch(()=>{});}catch{}
  }
  function exit({restoreFocus=true}={}){
    if(!active)return;
    active=false;hadNative=false;root.classList.remove('is-fullscreen');
    doc.body.style.overflow=previousOverflow;
    root.style.removeProperty('--ft-fullscreen-scale');leaveNative();refresh();
    if(restoreFocus)root.querySelector('[data-timeline-fullscreen]')?.focus({preventScroll:true});
  }
  function enter(){
    if(active)return;
    active=true;hadNative=false;previousOverflow=doc.body.style.overflow;
    doc.body.style.overflow='hidden';root.classList.add('is-fullscreen');refresh();
    root.querySelector('[data-timeline-fullscreen]')?.focus({preventScroll:true});
    // The viewport presentation also works when native fullscreen is absent
    // or unavailable inside an embedded browser.
    try{Promise.resolve(root.requestFullscreen?.()).then(()=>{if(!active)leaveNative();}).catch(()=>{});}catch{}
  }
  root.addEventListener('click',event=>{
    if(event.target.closest('[data-timeline-fullscreen]'))active?exit():enter();
  });
  doc.addEventListener('fullscreenchange',()=>{
    if(doc.fullscreenElement===root){hadNative=true;refresh();}
    else if(hadNative)exit();
  });
  doc.addEventListener('keydown',event=>{
    if(!active)return;
    if(event.key==='Escape'){event.preventDefault();exit();return;}
    // Keep keyboard navigation inside the timeline in the viewport fallback.
    if(event.key==='Tab'){
      const controls=[...root.querySelectorAll('button:not(:disabled),a[href],input,select,[tabindex="0"]')].filter(el=>el.getClientRects().length);
      const first=controls[0],last=controls.at(-1);
      if(first&&(event.shiftKey?doc.activeElement===first:doc.activeElement===last)){
        event.preventDefault();(event.shiftKey?last:first).focus();
      }
    }
  });
  win.addEventListener('resize',refresh);
  refresh();return {exit,refresh};
}
