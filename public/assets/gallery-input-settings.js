(() => {
  'use strict';
  const key='keha-gallery-pad-direction-v2',confirmationKey='keha-gallery-pad-right-confirmed-v10',setup=new URL(location.href).searchParams.get('gesture-check'),guided=setup==='10',checking=['6','7','8','9','10'].includes(setup);
  // Wheel signs depend on device scrolling preferences. Preserve the gallery's
  // convention until an explicit physical-right sample sets this device's sign.
  let factor=1,calibrating=checking,last='waiting',rawWheel='none',lastPointer='none',lastTouch='none',panel=null,scheduled=false;
  try{
    const saved=window.localStorage?.getItem(key);
    if(saved==='-1'||saved==='1'){factor=Number(saved);calibrating=guided&&window.localStorage?.getItem(confirmationKey)!==saved;}
  }catch{}
  function saveDirection(){
    try{window.localStorage?.setItem(key,String(factor));window.localStorage?.setItem(confirmationKey,String(factor));}catch{}
  }
  function reverseWheelDirection(){factor*=-1;calibrating=false;last='pad direction reversed';saveDirection();schedule();}
  function wheelDelta(raw){
    if(!Number.isFinite(raw)||!raw)return raw;
    // The first gesture in the explicit setup page is a physical rightward
    // swipe. Remember this device's sign instead of guessing its OS setting.
    if(calibrating&&document.getElementById('mediaViewer')?.open){
      factor=Math.sign(raw);calibrating=false;
      saveDirection();
    }
    const mapped=raw*factor;last='wheel '+compact(raw)+' → '+compact(mapped);schedule();return mapped;
  }
  function compact(value){return Number.isFinite(value)?String(Math.round(value*1000)/1000):'?';}
  function schedule(){
    if(!checking||scheduled)return;scheduled=true;
    const paint=()=>{scheduled=false;render();};
    if(typeof requestAnimationFrame==='function')requestAnimationFrame(paint);else Promise.resolve().then(paint);
  }
  function render(){
    if(!panel)return;
    const viewer=document.getElementById('mediaViewer'),stage=document.getElementById('mediaStage'),strip=stage?.querySelector('.native-photo-strip');
    const parent=viewer?.open?viewer:document.body;if(panel.parentNode!==parent)parent.append(panel);
    panel.querySelector('[data-gesture-instruction]').textContent=calibrating?
      (viewer?.open?'גרסה 10 · החליקו עכשיו ימינה פעם אחת בפאד, על התמונה. ההחלקה הזו תקבע: ימינה = הבא.':'גרסה 10 · פתחו תמונה והחליקו ימינה פעם אחת בפאד. הכיוון יותאם ויישמר אוטומטית במחשב הזה.'):
      'גרסה 10 · הגדרת הפאד נשמרה. אם ההחלקה ימינה עדיין מעבירה לקודם, לחצו על ״הפוך כיוון הפאד״.';
    const native=window.FamilyPhotoNative,face=stage?._familyFaceContext;
    const source=[...document.scripts].map(script=>script.getAttribute('src')).find(src=>src?.includes('photo-native.js'))||'native missing';
    const counter=document.getElementById('mediaViewerCounter')?.textContent||'—';
    const diagnostic=native?.diagnostics?.(stage);
    panel.querySelector('output').textContent='build 10 | native implementation '+(native?.version??'unknown')+' | '+last+' | raw wheel '+rawWheel+' | factor '+factor+' | '+counter+
      ' | rail '+(strip?compact(strip.scrollLeft)+'/'+strip.clientWidth:'none')+
      ' | input '+(native?.isActive?.(stage)?'active':'idle')+' | loading '+(stage?.getAttribute('aria-busy')||'false')+
      ' | face '+(face?(face.saving?'saving':face.zoom||1):'none')+' | '+source+
      '\npointer '+lastPointer+' | touch '+lastTouch+'\ncontroller '+(diagnostic?JSON.stringify(diagnostic):'not available');
    panel.querySelector('[data-gesture-recalibrate]').hidden=calibrating;
    panel.querySelector('[data-gesture-reverse]').hidden=calibrating;
  }
  window.FamilyGalleryInput={wheelDelta,wheelFactor:()=>factor,isCalibrating:()=>calibrating,reverseWheelDirection};
  if(!checking)return;
  function init(){
    panel=document.createElement('aside');panel.id='galleryGestureCheck';panel.setAttribute('aria-label','כיוון ובדיקת ההחלקה');
    Object.assign(panel.style,{position:'fixed',bottom:'8px',left:'12px',right:'12px',zIndex:'2147483647',padding:'8px 12px',border:'1px solid #b6a377',borderRadius:'10px',background:'#fffdf2',color:'#243a30',boxShadow:'0 2px 12px #0003',fontFamily:'Arial,sans-serif',fontSize:'14px',lineHeight:'1.4',direction:'rtl',pointerEvents:'auto',maxHeight:'180px',overflowY:'auto'});
    const instruction=document.createElement('strong');instruction.setAttribute('data-gesture-instruction','');Object.assign(instruction.style,{display:'block',fontSize:'16px',marginBottom:'6px'});panel.append(instruction);
    const reverse=document.createElement('button');reverse.type='button';reverse.textContent='הפוך כיוון הפאד';reverse.setAttribute('data-gesture-reverse','');Object.assign(reverse.style,{padding:'6px 12px',fontSize:'15px'});reverse.addEventListener('click',reverseWheelDirection);panel.append(reverse);
    const again=document.createElement('button');again.type='button';again.textContent='התאמה מחדש לפי החלקה ימינה';again.setAttribute('data-gesture-recalibrate','');Object.assign(again.style,{marginInlineStart:'12px',padding:'6px 10px'});
    again.addEventListener('click',()=>{calibrating=true;last='waiting for RIGHT swipe';schedule();});panel.append(again);
    const copy=document.createElement('button');copy.type='button';copy.textContent='העתקת פרטי הבדיקה';Object.assign(copy.style,{marginInlineStart:'12px',padding:'3px 10px'});
    copy.addEventListener('click',async()=>{render();try{await navigator.clipboard.writeText(panel.querySelector('output').textContent);copy.textContent='פרטי הבדיקה הועתקו';}catch{copy.textContent='אפשר לסמן ולהעתיק את הפרטים למטה';}});
    const output=document.createElement('output');output.dir='ltr';Object.assign(output.style,{display:'block',fontSize:'11px',textAlign:'left',overflowWrap:'anywhere',whiteSpace:'pre-wrap',userSelect:'text'});
    if(guided){const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='פרטי בדיקה';details.append(summary,copy,output);panel.append(details);}else panel.append(copy,output);
    document.body.append(panel);
    const viewer=document.getElementById('mediaViewer'),counter=document.getElementById('mediaViewerCounter'),Observer=window.MutationObserver;
    if(Observer){if(viewer)new Observer(schedule).observe(viewer,{attributes:true,attributeFilter:['open']});if(counter)new Observer(schedule).observe(counter,{childList:true,subtree:true,characterData:true});}
    const starts=new Map(),touchStarts=new Map();
    const targetLabel=target=>String(target?.tagName||'?').toLowerCase()+'.'+[...(target?.classList||[])].slice(0,3).join('.');
    const inStage=target=>Boolean(viewer?.open&&document.getElementById('mediaStage')?.contains(target));
    document.addEventListener('wheel',event=>{if(!inStage(event.target))return;rawWheel=compact(event.deltaX)+','+compact(event.deltaY)+' cancelable '+(event.cancelable!==false)+' target '+targetLabel(event.target);schedule();},{capture:true,passive:true});
    document.addEventListener('pointerdown',event=>{if(!inStage(event.target))return;starts.set(event.pointerId,{x:event.clientX,y:event.clientY,target:targetLabel(event.target)});last=lastPointer='pointer '+(event.pointerType||'?')+' down on '+targetLabel(event.target);schedule();},{capture:true,passive:true});
    document.addEventListener('pointermove',event=>{const start=starts.get(event.pointerId);if(!start)return;last=lastPointer='pointer '+(event.pointerType||'?')+' dx '+compact(event.clientX-start.x)+' dy '+compact(event.clientY-start.y)+' start '+start.target;schedule();},{capture:true,passive:true});
    for(const type of ['pointerup','pointercancel'])document.addEventListener(type,event=>{const start=starts.get(event.pointerId);if(!start)return;last=lastPointer=type+' dx '+compact(event.clientX-start.x)+' dy '+compact(event.clientY-start.y)+' start '+start.target;starts.delete(event.pointerId);schedule();},{capture:true,passive:true});
    for(const type of ['touchstart','touchmove','touchend','touchcancel'])document.addEventListener(type,event=>{
      if(!inStage(event.target))return;const points=type==='touchmove'?event.touches:event.changedTouches;
      for(const point of points||[]){if(type==='touchstart')touchStarts.set(point.identifier,{x:point.clientX,y:point.clientY});const start=touchStarts.get(point.identifier);if(start)lastTouch=type+' dx '+compact(point.clientX-start.x)+' dy '+compact(point.clientY-start.y)+' target '+targetLabel(event.target);if(type==='touchend'||type==='touchcancel')touchStarts.delete(point.identifier);}
      last=type+' contacts '+event.touches.length;schedule();
    },{capture:true,passive:true});
    document.addEventListener('scroll',event=>{if(viewer?.open&&event.target.classList?.contains('native-photo-strip'))schedule();},{capture:true,passive:true});
    render();
  }
  document.addEventListener('DOMContentLoaded',init,{once:true});
})();
