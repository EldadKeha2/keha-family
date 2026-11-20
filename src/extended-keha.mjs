import {nakashHTML,NAKASH_WRITE_TOKEN} from './nakash-shell.mjs';
import {compatRoute} from './nakash-compat.mjs';
import {familyAppOrigins} from './family-app-origins.mjs';
import {toOriginalFamilyData} from '../public/nakash/tree-data-adapter.mjs';
import {createExtendedFamily,EXTENDED_HOME,EXTENDED_NAME,EXTENDED_COLOR} from '../public/keha-extended/family-data.mjs';
import {createShlomoFamily,SHLOMO_HOME,SHLOMO_NAME,SHLOMO_COLOR} from '../public/keha-extended/shlomo-data.mjs';
import {BRANCH_PORTALS,createBranchPortal} from '../public/keha-extended/branch-portals.mjs';
import {appleLaunchImages} from './nakash-launch.mjs';

export function extendedKehaHTML(original, appOrigin='', shlomoOrigin='', portalOrigins={}) {
  return nakashHTML(original,'keha')
    .replace('<html ', '<html data-extended-keha="true" data-keha-shlomo-home="'+shlomoOrigin+SHLOMO_HOME+'" '+Object.values(BRANCH_PORTALS).map(portal=>'data-keha-'+portal.id+'-home="'+(portalOrigins[portal.id]||'')+portal.home+'"').join(' ')+' ')
    .replace('data-nakash-branch="keha"','data-nakash-branch="extended" data-nakash-entry-view="tree"'+(appOrigin?' data-nakash-origin="'+appOrigin+'"':''))
    .replace(' data-nakash-search-branch="keha"','')
    .replaceAll('/nakash/keha/',EXTENDED_HOME)
    .replaceAll('/nakash/brand-keha.svg',EXTENDED_HOME+'brand.svg')
    .replaceAll('/nakash/brand-keha-192.png',EXTENDED_HOME+'icon-192.png')
    .replaceAll('/nakash/api/site-data.js',EXTENDED_HOME+'site-data.js')
    .replaceAll('/nakash/media-adapter.js',EXTENDED_HOME+'media-adapter.js')
    .replaceAll('משפחת קהא',EXTENDED_NAME)
    .replaceAll('משורש משותף, ארבעה ענפים','ענפי המשפחה · הקשר המשפחתי בבירור')
    .replaceAll('נקאש · מדינה · קהא','קהא · קהת · יששכר')
    .replace(/<nav class="branch-bar" aria-label="ענפי המשפחה">.*?<\/nav>/s,'')
    .replace(/(<meta name="theme-color" content=")[^"]+/,'$1'+EXTENDED_COLOR)
    .replace(/(<style id="familyStartupBackground">[^<]*)/,'$1:root{--family-accent:'+EXTENDED_COLOR+'}@media(display-mode:standalone){html,body{background:var(--family-accent)}}')
    .replace('</head>','<link rel="stylesheet" href="/assets/nakash-theme.css?v=1"><link rel="stylesheet" href="/keha-extended/hub.css?v=7"></head>')
    .replace(/(  <script src="\/assets\/app.js[^>]*>)/,'  <script src="/keha-extended/hub.js?v=11" defer></script>\n$1')
    .replace('<div id="treeView">','<div id="treeView"><section id="extendedKehaHub" aria-label="ענפי משפחת קהא המורחבת" data-i18n-skip></section>')
    .replace(/(<header class="phone-home-intro">.*?<\/header>)/s,'$1<section id="extendedKehaHomeHub" aria-label="ענפי משפחת קהא המורחבת" data-i18n-skip></section>')
    .replace('<h2>הבית שלנו מתחיל כאן</h2>','<h2>'+EXTENDED_NAME+'</h2>')
    .replace('חמישה דורות, סיפור אחד','ענפי המשפחה, סיפור שנבנה יחד');
}

export function shlomoKehaHTML(original,appOrigin=''){
  return nakashHTML(original,'keha')
    .replace('<html ','<html data-shlomo-keha="true" data-keha-api-prefix="'+SHLOMO_HOME+'api/compat" ')
    .replace('data-nakash-branch="keha"','data-nakash-branch="shlomo" data-nakash-entry-view="home"'+(appOrigin?' data-nakash-origin="'+appOrigin+'"':''))
    .replace(' data-nakash-search-branch="keha"','')
    .replaceAll('/nakash/keha/',SHLOMO_HOME)
    .replaceAll('/nakash/brand-keha.svg',SHLOMO_HOME+'brand.svg')
    .replaceAll('/nakash/brand-keha-192.png',SHLOMO_HOME+'icon-192.png')
    .replaceAll('/nakash/api/site-data.js',SHLOMO_HOME+'site-data.js')
    .replaceAll('/nakash/media-adapter.js','/keha-extended/media-adapter.js?v=2')
    .replaceAll('משפחת קהא',SHLOMO_NAME)
    .replaceAll('משורש משותף, ארבעה ענפים','שלמה ויונה קהא · המשפחה שלנו')
    .replaceAll('נקאש · מדינה · קהא','קהא · חריזי · בקר · נובל · פיש · בלום')
    .replace(/<nav class="branch-bar" aria-label="ענפי המשפחה">.*?<\/nav>/s,'<nav class="branch-bar"><a class="branch-chip" href="https://family-extended.eldadkeha.workers.dev/keha-extended/#tree">משפחת קהא המורחבת</a></nav>')
    .replace(/(<meta name="theme-color" content=")[^"]+/,'$1'+SHLOMO_COLOR)
    .replace(/(<style id="familyStartupBackground">[^<]*)/,'$1:root{--family-accent:'+SHLOMO_COLOR+'}')
    .replace('</head>','<link rel="stylesheet" href="/assets/nakash-theme.css?v=1"></head>')
    .replace('<h2>הבית שלנו מתחיל כאן</h2>','<h2>'+SHLOMO_NAME+'</h2>');
}

export function branchPortalHTML(original,id,appOrigin='',extendedOrigin='https://family-extended.eldadkeha.workers.dev'){
  const portal=BRANCH_PORTALS[id];
  const startup=appleLaunchImages(id).map(({href,media})=>'<link rel="apple-touch-startup-image" href="'+href+'" media="'+media+'">').join('\n');
  let html=nakashHTML(original,'keha')
    .replace('<html ','<html data-branch-portal="'+id+'" data-keha-api-prefix="'+portal.home+'api/compat" ')
    .replace('data-nakash-branch="keha"','data-nakash-branch="'+id+'" data-nakash-entry-view="home"'+(appOrigin?' data-nakash-origin="'+appOrigin+'"':''))
    .replace(' data-nakash-search-branch="keha"','')
    .replaceAll('/nakash/keha/',portal.home)
    .replaceAll('/nakash/brand-keha.svg',portal.home+'brand.svg')
    .replaceAll('/nakash/brand-keha-192.png',portal.home+'icon-192.png')
    .replaceAll('/nakash/api/site-data.js',portal.home+'site-data.js')
    .replaceAll('/nakash/media-adapter.js','/keha-extended/media-adapter.js?v=3')
    .replaceAll('משפחת קהא',portal.name)
    .replaceAll('משורש משותף, ארבעה ענפים',portal.tagline)
    .replaceAll('נקאש · מדינה · קהא',portal.tagline)
    .replace(/<nav class="branch-bar" aria-label="ענפי המשפחה">.*?<\/nav>/s,'<nav class="branch-bar"><a class="branch-chip" href="'+extendedOrigin+EXTENDED_HOME+'#tree">משפחת קהא המורחבת</a></nav>')
    .replace(/(<meta name="theme-color" content=")[^"]+/,'$1'+portal.color)
    .replace(/(<style id="familyStartupBackground">[^<]*)/,'$1:root{--family-accent:'+portal.color+'}@media(display-mode:standalone){html,body{background:var(--family-accent)}}')
    .replace(/<link rel="icon"[^>]*>/g,'<link rel="icon" type="image/svg+xml" href="'+portal.home+'brand.svg">')
    .replace('</head>','<link rel="stylesheet" href="/assets/nakash-theme.css?v=1">'+startup+'</head>')
    .replace('<h2>הבית שלנו מתחיל כאן</h2>','<h2>'+portal.name+'</h2>')
    .replace('חמישה דורות, סיפור אחד',portal.tagline);
  if(id==='kehat')html=html.replace('</head>','<link rel="stylesheet" href="/keha-extended/portal-tree.css?v=1"></head>')
    .replace(/(  <script src="\/assets\/app.js[^>]*>)/,'  <script src="/keha-extended/portal-tree.js?v=2" defer></script>\n$1')
    .replace('<div id="treeView">','<div id="treeView"><section id="kehatPortalOverview" aria-label="ענפי משפחת קהת" data-i18n-skip></section>');
  return html;
}

export async function extendedKehaRoute(request,env,db,ctx,options) {
  const url=new URL(request.url),path=url.pathname;
  if(path==='/keha-extended')return Response.redirect(new URL(EXTENDED_HOME+url.search,url),308);
  if(path===SHLOMO_HOME.slice(0,-1))return Response.redirect(new URL(SHLOMO_HOME+url.search,url),308);
  const portal=Object.values(BRANCH_PORTALS).find(item=>path===item.home.slice(0,-1)||path.startsWith(item.home));
  if(portal&&path===portal.home.slice(0,-1))return Response.redirect(new URL(portal.home+url.search,url),308);
  const shlomo=path.startsWith(SHLOMO_HOME),home=portal?.home || (shlomo?SHLOMO_HOME:EXTENDED_HOME);
  const createFamily=portal?original=>createBranchPortal(original,portal.id):shlomo?createShlomoFamily:createExtendedFamily;
  const projection=async()=>({...options.family,...await db('nakash.extended.projection')});
  if(path.startsWith(home+'api/compat/'))return compatRoute(request,env,db,ctx,{...options,createFamily,nakashToken:NAKASH_WRITE_TOKEN},projection);
  if(!['GET','HEAD'].includes(request.method))return null;
  if(path===home+'privacy.html'){
    const response=await env.ASSETS.fetch(new Request(new URL('/privacy.html',url)));
    if(!response.ok)return response;
    const html=(await response.text()).replaceAll('assets/app-icons/icon-192.png',home+'icon-192.png').replaceAll('משפחת קהא',portal?.name || (shlomo?SHLOMO_NAME:EXTENDED_NAME)).replace('href="/"','href="'+home+'"');
    return new Response(request.method==='HEAD'?null:html,{headers:{'Content-Type':'text/html; charset=utf-8'}});
  }
  if(path===home+'site-data.js'){
    let available=true,original;
    try{original=await projection();}catch{available=false;original=options.family;}
    const data=toOriginalFamilyData(createFamily(original));
    const script='window.FAMILY_DATA='+JSON.stringify(data)+';\nwindow.LOCAL_FAMILY_SERVER=true;\nwindow.FAMILY_API_TOKEN='+JSON.stringify(NAKASH_WRITE_TOKEN)+';\nwindow.FAMILY_DATA_AVAILABLE='+available+';\n';
    return new Response(request.method==='HEAD'?null:script,{headers:{'Content-Type':'application/javascript; charset=utf-8'}});
  }
  if(path===home){
    const response=await env.ASSETS.fetch(new Request(new URL('/',url)));
    if(!response.ok)return response;
    const origins=familyAppOrigins(env);
    const source=await response.text();
    const html=portal?branchPortalHTML(source,portal.id,origins[portal.id],origins.extended):shlomo?shlomoKehaHTML(source,origins.shlomo):extendedKehaHTML(source,origins.extended,origins.shlomo,origins);
    return new Response(request.method==='HEAD'?null:html,{headers:{'Content-Type':'text/html; charset=utf-8'}});
  }
  if(path.startsWith(home+'assets/'))return env.ASSETS.fetch(new Request(new URL(path.slice(home.length-1)+url.search,url),request));
  return env.ASSETS.fetch(request);
}
