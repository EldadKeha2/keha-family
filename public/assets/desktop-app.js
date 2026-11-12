(() => {
  'use strict';
  const ua=navigator.userAgent||'';
  const mobile=navigator.userAgentData?.mobile===true||/Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(ua)||(/Macintosh/i.test(ua)&&navigator.maxTouchPoints>1);
  if(mobile||/KehaFamilyDesktop\//i.test(ua)||window.top!==window)return;
  let fitted=false;
  function fitInstalledWindow(){
    if(fitted||!(matchMedia('(display-mode: standalone)').matches||matchMedia('(display-mode: minimal-ui)').matches))return;
    const screen=window.screen;
    const width=Number(screen?.availWidth),height=Number(screen?.availHeight);
    if(!Number.isFinite(width)||!Number.isFinite(height)||width<320||height<240)return;
    // Installed desktop PWAs may resize their own window. Ordinary tabs are
    // excluded; use the current display's work area so its taskbar stays usable.
    fitted=true;
    const left=Number.isFinite(screen.availLeft)?screen.availLeft:0;
    const top=Number.isFinite(screen.availTop)?screen.availTop:0;
    try{window.moveTo?.(left,top);}catch{}
    try{window.resizeTo?.(width,height);}catch{}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',fitInstalledWindow,{once:true});
  else fitInstalledWindow();
  window.addEventListener('pageshow',fitInstalledWindow);
})();
