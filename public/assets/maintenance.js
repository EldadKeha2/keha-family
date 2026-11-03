(() => {
  'use strict';
  // Automatic failure handling only: no navigation item, public URL or manual activation.
  const bypassKey='keha-family-maintenance-continue';
  let active=false,bypassed=false,recoveryTimer=null,previousFocus=null;
  try{bypassed=sessionStorage.getItem(bypassKey)==='1';}catch{}
  const unavailable=status=>status===0||status===402||status===429||status===1027||status>=500;
  const nativeFetch=window.fetch.bind(window);
  function familyURL(input){
    try{const url=new URL(typeof input==='string'||input instanceof URL?input:input.url,location.href);return url.origin===location.origin?url:null;}catch{return null;}
  }
  function dataRequest(input){const url=familyURL(input);return Boolean(url&&(url.pathname.startsWith('/api/')||url.pathname.startsWith('/media/')||url.pathname==='/family-data.js'));}
  function pageRoot(){return document.querySelector('.page-shell');}
  function banner(){
    let notice=document.getElementById('familyLimitedNotice');
    if(!notice){
      notice=document.createElement('div');notice.id='familyLimitedNotice';notice.className='family-limited-notice';notice.setAttribute('role','status');notice.setAttribute('data-i18n-skip','');
      notice.innerHTML='<p lang="he" dir="rtl">גלישה מוגבלת: חלק מהתמונות, המידע והאפשרויות עשויים לא להיות זמינים כרגע.</p><p lang="en" dir="ltr">Limited browsing: some photos, information and features may be temporarily unavailable.</p>';
      document.body.prepend(notice);
    }
    notice.hidden=false;
  }
  function mount(){
    let screen=document.getElementById('familyMaintenanceScreen');if(screen)return screen;
    screen=document.createElement('div');screen.id='familyMaintenanceScreen';screen.className='family-maintenance';screen.hidden=true;
    screen.setAttribute('role','dialog');screen.setAttribute('aria-modal','true');screen.setAttribute('aria-labelledby','familyMaintenanceTitle');screen.setAttribute('aria-describedby','familyMaintenanceWarningHe familyMaintenanceWarningEn');screen.setAttribute('data-i18n-skip','');
    screen.innerHTML=`<div class="family-maintenance-card">
      <div class="family-maintenance-ornament" aria-hidden="true">✦ ◆ ✦ ◆ ✦ ◆ ✦</div>
      <div class="family-maintenance-brand">בית משפחת קהא <span>·</span> KEHA FAMILY</div>
      <div class="family-maintenance-columns">
        <section dir="rtl" lang="he"><h1 id="familyMaintenanceTitle">האתר תחת שיפוצים כעת</h1><p>אנחנו מתנצלים על אי הנוחות</p><small>סבתא יונה עובדת על זה באהבה.</small></section>
        <section dir="ltr" lang="en"><h1>The website is currently under maintenance</h1><p>We apologize for the inconvenience</p><small>GRANDMA is working on it with love.</small></section>
      </div>
      <div class="family-maintenance-art-wrap"><img class="family-maintenance-art" src="/assets/grandma-construction.png" width="1774" height="887" alt="סבתא יונה בונה קיר לבנים לצד תמרור עבודות תימני / Grandma building a brick wall beside a Yemeni roadworks sign"><span class="grandma-work-spark" aria-hidden="true">✦</span></div>
      <div class="family-maintenance-continue">
        <p id="familyMaintenanceWarningHe" dir="rtl" lang="he">עקב מגבלה או תקלה זמנית, ייתכן שחלק מהתמונות, המידע והאפשרויות לא יהיו זמינים. אפשר להמשיך לגלוש בכל זאת.</p>
        <p id="familyMaintenanceWarningEn" dir="ltr" lang="en">A temporary limit or service issue may prevent some photos, information and features from loading. You can still continue browsing.</p>
        <button class="family-maintenance-enter" type="button"><span lang="he" dir="rtl">המשך לאתר בכל זאת</span><span lang="en" dir="ltr">Continue to the website anyway</span></button>
      </div>
      <div class="family-maintenance-ornament bottom" aria-hidden="true">✦ ◆ ✦ ◆ ✦ ◆ ✦</div>
    </div>`;
    screen.querySelector('.family-maintenance-enter').addEventListener('click',continueToSite);
    screen.addEventListener('keydown',event=>{if(active&&event.key==='Tab'){event.preventDefault();screen.querySelector('.family-maintenance-enter').focus();}});
    document.body.append(screen);return screen;
  }
  function continueToSite(){
    bypassed=true;try{sessionStorage.setItem(bypassKey,'1');}catch{}
    active=false;if(recoveryTimer)clearInterval(recoveryTimer);recoveryTimer=null;
    const screen=document.getElementById('familyMaintenanceScreen');if(screen){screen.hidden=true;screen.style.display='none';}
    document.documentElement.classList.remove('family-maintenance-active');const root=pageRoot();if(root)root.inert=false;
    banner();if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true});
  }
  function activate(){
    if(active)return;
    if(bypassed){banner();return;}
    if(!document.body)return;
    previousFocus=document.activeElement;active=true;const screen=mount();screen.hidden=false;screen.style.display='grid';
    document.documentElement.classList.add('family-maintenance-active');const root=pageRoot();if(root)root.inert=true;
    screen.querySelector('.family-maintenance-enter').focus({preventScroll:true});
    if(!recoveryTimer)recoveryTimer=setInterval(checkRecovery,120000);
  }
  async function checkRecovery(){
    if(!active||document.visibilityState==='hidden')return;
    try{
      const response=await nativeFetch('/api/health',{cache:'no-store'});
      if(response.ok&&(await response.json()).available===true){try{sessionStorage.removeItem(bypassKey);}catch{}location.reload();}
    }catch{}
  }
  function observeResponse(input,response){
    if(!dataRequest(input))return;
    const type=response.headers.get('Content-Type')||'';
    if(unavailable(response.status)||response.headers.get('X-Family-Storage-Limit')==='daily'||(response.ok&&/text\/html/i.test(type)))activate();
  }
  window.fetch=async(...args)=>{
    try{const response=await nativeFetch(...args);observeResponse(args[0],response);return response;}
    catch(error){if(error?.name!=='AbortError'&&dataRequest(args[0]))activate();throw error;}
  };
  // Uploads use XMLHttpRequest, while regular data requests use fetch.
  const proto=window.XMLHttpRequest?.prototype;
  if(proto){
    const open=proto.open,observed=new WeakMap();
    proto.open=function(method,url,...args){
      const previous=observed.get(this);if(previous)for(const [name,listener]of previous)this.removeEventListener(name,listener);
      const result=open.call(this,method,url,...args);if(!dataRequest(url))return result;
      const loaded=()=>{if(unavailable(this.status)||this.getResponseHeader('X-Family-Storage-Limit')==='daily')activate();},failed=()=>activate();
      const listeners=[['load',loaded],['error',failed],['timeout',failed]];observed.set(this,listeners);
      for(const [name,listener]of listeners)this.addEventListener(name,listener,{once:true});return result;
    };
  }
  window.addEventListener('error',event=>{
    const target=event.target,src=target?.currentSrc||target?.src||'',url=familyURL(src);
    if(target?.tagName==='SCRIPT'&&url?.pathname==='/family-data.js'){activate();return;}
    if(['IMG','VIDEO','IFRAME'].includes(target?.tagName)&&url?.pathname.startsWith('/media/'))activate();
    if(/FAMILY_DATA|FAMILY_API_TOKEN|family-data\.js/.test(String(event.message||'')))activate();
  },true);
  window.addEventListener('load',event=>{
    const frame=event.target;if(frame?.tagName!=='IFRAME'||!familyURL(frame.src)?.pathname.startsWith('/media/'))return;
    try{const doc=frame.contentDocument;if(doc?.contentType==='application/json'&&/"error"\s*:/.test(doc.body?.textContent||''))activate();}catch{}
  },true);
  function checkStartup(){
    if(window.FAMILY_DATA_AVAILABLE===false||!window.FAMILY_DATA)activate();
    // A resource can fail during parsing, before its error event listener is installed.
    for(const image of document.querySelectorAll('img[src*="/media/"]'))if(image.complete&&image.naturalWidth===0&&dataRequest(image.currentSrc||image.src)){activate();break;}
  }
  // Deferred scripts run while readyState is "interactive", before the later data scripts.
  if(document.readyState!=='complete')document.addEventListener('DOMContentLoaded',checkStartup,{once:true});else checkStartup();
  window.FamilyMaintenance={isActive:()=>active};
})();
