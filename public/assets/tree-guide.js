(() => {
 'use strict';
 const key='keha-tree-guide-v1';let shown=false,host=null,target=null,timer=null,events=null;
 const tr=(he,en)=>window.FamilyI18n.isEnglish?en:he;
 function hide(){clearTimeout(timer);events?.abort();events=null;host?.remove();host=null;target?.classList.remove('tree-guide-target');target=null;}
 function show(force=false){
  if(document.body.dataset.activeView!=='tree')return;
  let seen=false;try{seen=sessionStorage.getItem(key)==='seen';}catch{}
  if(!force&&(shown||seen))return;
  const viewport=document.getElementById('treeViewport'),name=viewport?.querySelector('.tree-unit[data-unit="'+window.FAMILY_DATA.root+'"] .person-name')||viewport?.querySelector('.person-name');
  if(!viewport||!name)return;
  hide();shown=true;try{sessionStorage.setItem(key,'seen');}catch{}
  target=name;target.classList.add('tree-guide-target');host=document.createElement('div');host.className='tree-guide-layer';
  host.innerHTML=`<svg class="tree-guide-arrow" aria-hidden="true"><defs><marker id="treeGuideArrowhead" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M1 1L6 4L1 7"/></marker></defs><path class="tree-guide-arrow-line" marker-end="url(#treeGuideArrowhead)"/></svg><aside class="tree-guide-card" role="status" aria-live="polite"><span class="tree-guide-eyebrow"><img class="tree-guide-fez" src="assets/fez.svg" alt="" width="30" height="30">${tr('כל שם הוא סיפור','Every name tells a story')}</span><p>${tr('לחץ על שם לפתיחת העמוד האישי','Click a name to open their personal page')}</p><button type="button" class="tree-guide-close" aria-label="${tr('סגירת ההדרכה','Dismiss tip')}">×</button><span class="tree-guide-countdown" aria-hidden="true"></span></aside>`;
  viewport.append(host);
  const view=viewport.getBoundingClientRect(),r=name.getBoundingClientRect(),card=host.querySelector('.tree-guide-card'),arrow=host.querySelector('.tree-guide-arrow');
  card.dir=window.FamilyI18n.isEnglish?'ltr':'rtl';
  const desktop=window.innerWidth>700,unit=name.closest('.tree-unit')?.getBoundingClientRect()||r;
  const w=Math.min(300,view.width-28),h=card.getBoundingClientRect().height,tx=r.left-view.left+r.width/2,ty=r.top-view.top+r.height/2,leftSpace=unit.left-view.left,rightSpace=view.right-unit.right,small=view.width<600||(desktop?rightSpace:leftSpace)<w+40;
  const x=desktop?Math.max(14,Math.min(view.width-w-14,unit.right-view.left+26)):small?Math.max(14,(view.width-w)/2):Math.max(14,Math.min(view.width-w-14,leftSpace-w-26));
  const y=small?Math.min(view.height-h-20,Math.max(12,ty+36)):Math.max(14,Math.min(view.height-h-20,ty-h/2-16));
  card.style.width=w+'px';card.style.left=x+'px';card.style.top=y+'px';
  const sx=small?x+w*(desktop?0.25:0.75):desktop?x-4:x+w+4,sy=small?y-3:y+h*.65;
  arrow.setAttribute('viewBox',`0 0 ${view.width} ${view.height}`);arrow.querySelector('.tree-guide-arrow-line').setAttribute('d',small?`M${sx} ${sy}Q${tx+55} ${ty+14} ${tx+4} ${ty+4}`:desktop?`M${sx} ${sy}Q${tx+20} ${sy+22} ${tx+5} ${ty+4}`:`M${sx} ${sy}Q${tx-20} ${sy+22} ${tx-5} ${ty+4}`);
  events=new AbortController();const options={signal:events.signal};
  host.querySelector('.tree-guide-close').addEventListener('click',event=>{event.stopPropagation();hide();},options);
  viewport.addEventListener('pointerdown',event=>{if(!event.target.closest('.tree-guide-card'))hide();},options);
  viewport.addEventListener('wheel',hide,{...options,passive:true});
  window.addEventListener('resize',hide,options);document.addEventListener('keydown',event=>{if(event.key==='Escape')hide();},options);
  timer=setTimeout(hide,8000);
 }
 document.addEventListener('DOMContentLoaded',()=>document.getElementById('treeGuideButton')?.addEventListener('click',()=>show(true)));
 window.FamilyTreeGuide={show,hide};
})();
