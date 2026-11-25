const document=window.document;
const finite=value=>typeof value==='number'&&Number.isFinite(value)?value:null;
const values=(object,keys)=>Object.fromEntries(keys.map(key=>[key,finite(object?.[key])]));
const ratio=Number(window.devicePixelRatio)||1;
const quarter=Math.ceil(Math.max(1,Math.min(6,ratio))*4);
const profilePath=number=>'/assets/app-icons/android-launch-v1/density-'+number+'.webmanifest';
const userAgent=navigator.userAgent||'';
const chrome=userAgent.match(/(?:Chrome|Chromium)\/([\d.]+)/)?.[1]||null;
const mode=['fullscreen','standalone','minimal-ui','browser'].find(value=>window.matchMedia('(display-mode: '+value+')').matches)||'unknown';
const report={
  diagnostic:'keha-launch-display-v1',
  capturedAt:new Date().toISOString(),
  chromeVersion:chrome,
  userAgent,
  devicePixelRatio:ratio,
  displayMode:mode,
  iosStandalone:navigator.standalone===true,
  screen:values(window.screen,['width','height','availWidth','availHeight','colorDepth','pixelDepth']),
  window:values(window,['innerWidth','innerHeight','outerWidth','outerHeight']),
  document:values(document.documentElement,['clientWidth','clientHeight']),
  visualViewport:window.visualViewport?values(window.visualViewport,['width','height','scale','offsetLeft','offsetTop']):null,
  manifestSelectedByMainPage:/Android/i.test(userAgent)?profilePath(quarter):'/manifest.webmanifest',
  // Web pages cannot inspect the installed WebAPK. This is the profile the user
  // supplied in chrome://webapks, not a claim about the current installation.
  manifestReferenceFromWebapksScreenshot:profilePath(13),
  manifests:[]
};
document.getElementById('chrome-version').textContent=chrome||'לא זוהתה';
document.getElementById('screen-density').textContent=String(ratio);
document.getElementById('display-mode').textContent=mode==='standalone'?'אפליקציה':mode==='browser'?'דפדפן':mode;

const output=document.getElementById('check-report');
const status=document.getElementById('check-status');
const button=document.getElementById('copy-report');
output.value=JSON.stringify(report,null,2);

async function readManifest(path){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),8000);
  try{
    const response=await fetch(path,{cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',signal:controller.signal});
    if(!response.ok)return {path,status:response.status};
    const manifest=await response.json();
    return {path,status:response.status,id:manifest.id,startUrl:manifest.start_url,backgroundColor:manifest.background_color,icons:manifest.icons};
  }catch(error){
    return {path,error:error.name==='AbortError'?'timeout':'unavailable'};
  }finally{
    clearTimeout(timeout);
  }
}

button.addEventListener('click',async()=>{
  try{
    await navigator.clipboard.writeText(output.value);
    status.textContent='הבדיקה הועתקה. אפשר להדביק אותה בצ׳אט.';
  }catch{
    document.querySelector('details').open=true;
    output.focus();
    output.select();
    output.setSelectionRange(0,output.value.length);
    status.textContent='הטקסט סומן. לחצו על „העתק” ושלחו אותו בצ׳אט.';
  }
});

report.manifests=await Promise.all([...new Set([report.manifestSelectedByMainPage,report.manifestReferenceFromWebapksScreenshot])].map(readManifest));
output.value=JSON.stringify(report,null,2);
button.disabled=false;
status.textContent=report.manifests.some(item=>item.error||item.status!==200)?'נתוני המסך מוכנים להעתקה; חלק מנתוני האתר לא נטענו.':'הבדיקה מוכנה להעתקה.';
