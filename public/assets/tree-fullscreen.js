(() => {
  'use strict';
  const viewport=document.getElementById('treeViewport'),button=document.getElementById('treeFullscreenButton');
  if(!viewport||!button)return;
  const relatedTrees=document.getElementById('relatedFamilyTrees');
  const marriageFilters=document.getElementById('treeMarriageFilters');
  const marriageAnchor=marriageFilters?document.createComment('marriage families'):null;
  if(marriageAnchor)marriageFilters.before(marriageAnchor);
  const caption=document.createElement('span');caption.className='tree-fullscreen-label';button.append(caption);
  const exitButton=document.createElement('button');exitButton.type='button';exitButton.id='treeFullscreenExit';exitButton.hidden=true;
  exitButton.setAttribute('aria-controls',viewport.id);
  exitButton.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8h5V3m8 0v5h5M8 21v-5H3m18 0h-5v5"/></svg><span></span>';
  viewport.append(exitButton);
  let active=false,hadNative=false,frame=null,branchBarAnchor=null;
  function placeFamilyTabs(){
    if(!window.FamilyExtendedKeha?.phoneFamilies)return;
    const bar=document.getElementById('branchBar');
    if(active&&window.matchMedia('(max-width:700px)').matches){
      if(!branchBarAnchor){
        branchBarAnchor=document.createComment('family navigation');
        bar.replaceWith(branchBarAnchor);exitButton.after(bar);
      }
    }else if(branchBarAnchor){
      branchBarAnchor.replaceWith(bar);branchBarAnchor=null;
    }
  }
  const label=()=>window.FamilyI18n?.isEnglish?(active?'Exit fullscreen':'Fullscreen'):(active?'יציאה ממסך מלא':'מסך מלא');
  function refresh(){
    button.setAttribute('aria-label',label());button.title=label();button.setAttribute('aria-pressed',String(active));
    caption.textContent=window.FamilyI18n?.isEnglish?(active?'Exit':'Fullscreen'):(active?'יציאה':'מסך מלא');
    exitButton.hidden=!active;
    const exitLabel=window.FamilyI18n?.isEnglish?'Exit fullscreen':'יציאה ממסך מלא';
    exitButton.querySelector('span').textContent=exitLabel;exitButton.setAttribute('aria-label',exitLabel);
  }
  function fit(){
    if(frame!==null)cancelAnimationFrame(frame);
    frame=requestAnimationFrame(()=>{frame=null;if(document.body.dataset.activeView==='tree')document.getElementById('fitButton')?.click();});
  }
  function leaveNative(){
    if(document.fullscreenElement===viewport)try{Promise.resolve(document.exitFullscreen?.()).catch(()=>{});}catch{}
  }
  function exit({restoreFocus=true}={}){
    if(!active)return;
    active=false;hadNative=false;
    viewport.classList.remove('tree-is-fullscreen');document.documentElement.classList.remove('tree-fullscreen-active');
    if(relatedTrees)viewport.before(relatedTrees);
    if(marriageFilters)marriageAnchor.after(marriageFilters);
    viewport.scrollTop=0;viewport.scrollLeft=0;
    placeFamilyTabs();leaveNative();refresh();fit();
    if(restoreFocus)button.focus({preventScroll:true});
  }
  function enter(){
    if(active)return;
    active=true;hadNative=false;
    viewport.classList.add('tree-is-fullscreen');document.documentElement.classList.add('tree-fullscreen-active');
    if(relatedTrees)viewport.append(relatedTrees);
    if(marriageFilters)viewport.append(marriageFilters);
    viewport.scrollTop=0;viewport.scrollLeft=0;
    window.FamilyTreeGuide?.hide();refresh();placeFamilyTabs();fit();button.focus({preventScroll:true});
    // The fixed viewport also fills the screen on browsers without this API.
    try{Promise.resolve(viewport.requestFullscreen?.()).then(()=>{if(!active)leaveNative();}).catch(()=>{});}catch{}
  }
  button.addEventListener('click',()=>active?exit():enter());
  exitButton.addEventListener('click',()=>exit());
  document.addEventListener('fullscreenchange',()=>{
    if(document.fullscreenElement===viewport){hadNative=true;fit();}
    else if(hadNative)exit();
  });
  document.addEventListener('keydown',event=>{
    if(!active)return;
    if(event.key==='Escape'){event.preventDefault();exit();return;}
    if(event.key==='Tab'){
      const controls=[viewport,...viewport.querySelectorAll('button:not(:disabled),a[href],[tabindex="0"]')].filter(node=>node.getClientRects().length);
      const first=controls[0],last=controls.at(-1);
      if(first&&(event.shiftKey?document.activeElement===first:document.activeElement===last)){
        event.preventDefault();(event.shiftKey?last:first).focus();
      }
    }
  });
  if(typeof MutationObserver==='function')new MutationObserver(()=>{
    if(active&&document.body.dataset.activeView!=='tree')exit({restoreFocus:false});
  }).observe(document.body,{attributes:true,attributeFilter:['data-active-view']});
  window.addEventListener('resize',()=>{if(active){placeFamilyTabs();fit();}});
  window.addEventListener('pagehide',()=>exit({restoreFocus:false}));
  refresh();
})();
