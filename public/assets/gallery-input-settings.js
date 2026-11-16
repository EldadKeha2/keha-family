(() => {
  'use strict';
  const key='keha-gallery-pad-direction',checking=new URL(location.href).searchParams.get('gesture-check')==='6';
  let factor=1,calibrating=checking,last='waiting',panel=null,scheduled=false;
  try{
    const saved=window.localStorage?.getItem(key);
    if(saved==='-1'||saved==='1'){factor=Number(saved);calibrating=false;}
  }catch{}
  function wheelDelta(raw){
    if(!Number.isFinite(raw)||!raw)return raw;
    // The first gesture in the explicit setup page is a physical rightward
    // swipe. Remember this device's sign instead of guessing its OS setting.
    if(calibrating&&document.getElementById('mediaViewer')?.open){
      factor=Math.sign(raw);calibrating=false;
      try{window.localStorage?.setItem(key,String(factor));}catch{}
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
      (viewer?.open?'לכיוון הפאד במחשב הזה: החליקו ימינה פעם אחת על התמונה.':'פתחו תמונה, ואז החליקו ימינה פעם אחת בפאד כדי לכוון אותו במחשב הזה.'):
      'הפאד כוון: החלקה ימינה מעבירה ל״הבא״. הכיוון נשמר במחשב הזה.';
    const native=window.FamilyPhotoNative,face=stage?._familyFaceContext;
    const source=[...document.scripts].map(script=>script.getAttribute('src')).find(src=>src?.includes('photo-native.js'))||'native missing';
    const counter=document.getElementById('mediaViewerCounter')?.textContent||'—';
    panel.querySelector('output').textContent='build 6 | '+last+' | factor '+factor+' | '+counter+
      ' | rail '+(strip?compact(strip.scrollLeft)+'/'+strip.clientWidth:'none')+
      ' | input '+(native?.isActive?.(stage)?'active':'idle')+' | loading '+(stage?.getAttribute('aria-busy')||'false')+
      ' | face '+(face?(face.saving?'saving':face.zoom||1):'none')+' | '+source;
    panel.querySelector('[data-gesture-recalibrate]').hidden=calibrating;
  }
  window.FamilyGalleryInput={wheelDelta,wheelFactor:()=>factor,isCalibrating:()=>calibrating};
  if(!checking)return;
  function init(){
    panel=document.createElement('aside');panel.id='galleryGestureCheck';panel.setAttribute('aria-label','כיוון ובדיקת ההחלקה');
    Object.assign(panel.style,{position:'fixed',bottom:'8px',left:'12px',right:'12px',zIndex:'2147483647',padding:'8px 12px',border:'1px solid #b6a377',borderRadius:'10px',background:'#fffdf2',color:'#243a30',boxShadow:'0 2px 12px #0003',fontFamily:'Arial,sans-serif',fontSize:'14px',lineHeight:'1.4',direction:'rtl',pointerEvents:'auto'});
    const instruction=document.createElement('strong');instruction.setAttribute('data-gesture-instruction','');panel.append(instruction);
    const again=document.createElement('button');again.type='button';again.textContent='כיוון מחדש';again.setAttribute('data-gesture-recalibrate','');Object.assign(again.style,{marginInlineStart:'12px',padding:'3px 10px'});
    again.addEventListener('click',()=>{calibrating=true;last='waiting for RIGHT swipe';schedule();});panel.append(again);
    const output=document.createElement('output');output.dir='ltr';Object.assign(output.style,{display:'block',fontSize:'11px',textAlign:'left',overflowWrap:'anywhere'});panel.append(output);document.body.append(panel);
    const viewer=document.getElementById('mediaViewer'),counter=document.getElementById('mediaViewerCounter'),Observer=window.MutationObserver;
    if(Observer){if(viewer)new Observer(schedule).observe(viewer,{attributes:true,attributeFilter:['open']});if(counter)new Observer(schedule).observe(counter,{childList:true,subtree:true,characterData:true});}
    const starts=new Map();
    const inStage=target=>Boolean(viewer?.open&&document.getElementById('mediaStage')?.contains(target));
    document.addEventListener('pointerdown',event=>{if(!inStage(event.target))return;starts.set(event.pointerId,{x:event.clientX,y:event.clientY});last='pointer '+(event.pointerType||'?')+' down';schedule();},{capture:true,passive:true});
    document.addEventListener('pointermove',event=>{const start=starts.get(event.pointerId);if(!start)return;last='pointer '+(event.pointerType||'?')+' dx '+compact(event.clientX-start.x)+' dy '+compact(event.clientY-start.y);schedule();},{capture:true,passive:true});
    for(const type of ['pointerup','pointercancel'])document.addEventListener(type,event=>{const start=starts.get(event.pointerId);if(!start)return;last=type+' dx '+compact(event.clientX-start.x)+' dy '+compact(event.clientY-start.y);starts.delete(event.pointerId);schedule();},{capture:true,passive:true});
    for(const type of ['touchstart','touchend','touchcancel'])document.addEventListener(type,event=>{if(!inStage(event.target))return;last=type+' contacts '+event.touches.length;schedule();},{capture:true,passive:true});
    document.addEventListener('scroll',event=>{if(viewer?.open&&event.target.classList?.contains('native-photo-strip'))schedule();},{capture:true,passive:true});
    render();
  }
  document.addEventListener('DOMContentLoaded',init,{once:true});
})();
