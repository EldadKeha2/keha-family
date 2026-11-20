import {nakashHTML,NAKASH_WRITE_TOKEN} from './nakash-shell.mjs';
import {compatRoute} from './nakash-compat.mjs';
import {familyAppOrigins} from './family-app-origins.mjs';
import {toOriginalFamilyData} from '../public/nakash/tree-data-adapter.mjs';
import {createExtendedFamily,EXTENDED_HOME,EXTENDED_NAME,EXTENDED_COLOR} from '../public/keha-extended/family-data.mjs';

export function extendedKehaHTML(original, appOrigin='') {
  return nakashHTML(original,'keha')
    .replace('<html ', '<html data-extended-keha="true" ')
    .replace('data-nakash-branch="keha"','data-nakash-branch="extended" data-nakash-entry-view="tree"'+(appOrigin?' data-nakash-origin="'+appOrigin+'"':''))
    .replace(' data-nakash-search-branch="keha"','')
    .replaceAll('/nakash/keha/',EXTENDED_HOME)
    .replaceAll('/nakash/brand-keha.svg',EXTENDED_HOME+'brand.svg')
    .replaceAll('/nakash/brand-keha-192.png',EXTENDED_HOME+'icon-192.png')
    .replaceAll('/nakash/api/site-data.js',EXTENDED_HOME+'site-data.js')
    .replaceAll('/nakash/media-adapter.js',EXTENDED_HOME+'media-adapter.js')
    .replaceAll('משפחת קהא',EXTENDED_NAME)
    .replaceAll('משורש משותף, ארבעה ענפים','ארבעה ענפים · הקשר המשפחתי בבירור')
    .replaceAll('נקאש · מדינה · קהא','קהא · קהת · יששכר')
    .replace(/<nav class="branch-bar" aria-label="ענפי המשפחה">.*?<\/nav>/s,'')
    .replace(/(<meta name="theme-color" content=")[^"]+/,'$1'+EXTENDED_COLOR)
    .replace(/(<style id="familyStartupBackground">[^<]*)/,'$1:root{--family-accent:'+EXTENDED_COLOR+'}@media(display-mode:standalone){html,body{background:var(--family-accent)}}')
    .replace('</head>','<link rel="stylesheet" href="/assets/nakash-theme.css?v=1"><link rel="stylesheet" href="/keha-extended/hub.css?v=1"></head>')
    .replace(/(  <script src="\/assets\/app.js[^>]*>)/,'  <script src="/keha-extended/hub.js?v=1" defer></script>\n$1')
    .replace('<div id="treeView">','<div id="treeView"><section id="extendedKehaHub" aria-label="ארבעת ענפי משפחת קהא המורחבת" data-i18n-skip></section>')
    .replace(/(<header class="phone-home-intro">.*?<\/header>)/s,'$1<section id="extendedKehaHomeHub" aria-label="ארבעת ענפי משפחת קהא המורחבת" data-i18n-skip></section>')
    .replace('<h2>הבית שלנו מתחיל כאן</h2>','<h2>'+EXTENDED_NAME+'</h2>')
    .replace('חמישה דורות, סיפור אחד','ארבעה ענפים, סיפור משפחתי שנבנה יחד');
}

export async function extendedKehaRoute(request,env,db,ctx,options) {
  const url=new URL(request.url),path=url.pathname;
  if(path==='/keha-extended')return Response.redirect(new URL(EXTENDED_HOME+url.search,url),308);
  const projection=async()=>({...options.family,...await db('nakash.extended.projection')});
  if(path.startsWith(EXTENDED_HOME+'api/compat/'))return compatRoute(request,env,db,ctx,{...options,createFamily:createExtendedFamily,nakashToken:NAKASH_WRITE_TOKEN},projection);
  if(!['GET','HEAD'].includes(request.method))return null;
  if(path===EXTENDED_HOME+'privacy.html'){
    const response=await env.ASSETS.fetch(new Request(new URL('/privacy.html',url)));
    if(!response.ok)return response;
    const html=(await response.text()).replaceAll('assets/app-icons/icon-192.png',EXTENDED_HOME+'icon-192.png').replaceAll('משפחת קהא',EXTENDED_NAME).replace('href="/"','href="'+EXTENDED_HOME+'"');
    return new Response(request.method==='HEAD'?null:html,{headers:{'Content-Type':'text/html; charset=utf-8'}});
  }
  if(path===EXTENDED_HOME+'site-data.js'){
    let available=true,original;
    try{original=await projection();}catch{available=false;original=options.family;}
    const data=toOriginalFamilyData(createExtendedFamily(original));
    const script='window.FAMILY_DATA='+JSON.stringify(data)+';\nwindow.LOCAL_FAMILY_SERVER=true;\nwindow.FAMILY_API_TOKEN='+JSON.stringify(NAKASH_WRITE_TOKEN)+';\nwindow.FAMILY_DATA_AVAILABLE='+available+';\n';
    return new Response(request.method==='HEAD'?null:script,{headers:{'Content-Type':'application/javascript; charset=utf-8'}});
  }
  if(path===EXTENDED_HOME){
    const response=await env.ASSETS.fetch(new Request(new URL('/',url)));
    if(!response.ok)return response;
    return new Response(request.method==='HEAD'?null:extendedKehaHTML(await response.text(),familyAppOrigins(env).extended),{headers:{'Content-Type':'text/html; charset=utf-8'}});
  }
  if(path.startsWith(EXTENDED_HOME+'assets/'))return env.ASSETS.fetch(new Request(new URL(path.slice(EXTENDED_HOME.length-1)+url.search,url),request));
  return env.ASSETS.fetch(request);
}
