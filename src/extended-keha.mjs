import {nakashHTML,NAKASH_WRITE_TOKEN} from './nakash-shell.mjs';
import {compatRoute} from './nakash-compat.mjs';
import {familyAppOrigins} from './family-app-origins.mjs';
import {toOriginalFamilyData} from '../public/nakash/tree-data-adapter.mjs';
import {createExtendedFamily,EXTENDED_HOME,EXTENDED_NAME,EXTENDED_COLOR} from '../public/keha-extended/family-data.mjs';
import {createShlomoFamily,SHLOMO_HOME,SHLOMO_NAME,SHLOMO_COLOR} from '../public/keha-extended/shlomo-data.mjs';
import {BRANCH_PORTALS,createBranchPortal} from '../public/keha-extended/branch-portals.mjs';
import {appleLaunchImages} from './nakash-launch.mjs';
import {restrictedOriginalPerson} from './family-content.mjs';
import {withStoryFormLink} from './story-submissions.mjs';

const relatedTrees={
  kehat:{to:'zechariah-tzadok',label:'לעץ של זכריה בן צדוק'},
  'zechariah-tzadok':{to:'kehat',label:'לעץ של ג׳ימעאן בן אהרון',footerLabel:'למשפחת סעדיה (ג׳ימעאן) בן אהרון'},
};

function relatedTreeNavigation(fromIds,origins,footer=false){
  const links=[];
  for(const from of fromIds){
    const other=relatedTrees[from];
    if(!other)continue;
    const href=(origins[other.to]||'')+BRANCH_PORTALS[other.to].home+'#tree';
    const id='related-tree-'+from;
    links.push(`<a ${footer?'id="relatedFamilyTreeFooterLink" class="family-extended-button family-related-tree-link" ':''}data-related-from="${BRANCH_PORTALS[from].branches[0]}" data-family-language-link href="${href}" aria-labelledby="${id}-label" aria-describedby="${id}-kinship"><strong id="${id}-label">${footer?other.footerLabel:other.label}</strong><small${footer?' class="visually-hidden"':''} id="${id}-kinship">יעקב בן ג׳ימעאן נישא ליהודית בת זכריה בן צדוק</small></a>`);
  }
  return footer?links.join(''):links.length?'<div id="relatedFamilyTrees">'+links.join('')+'</div>':'';
}

function withNameOrigin(html, home) {
  const href=home+'name-origin/';
  const link='<a class="nav-link" id="nameOriginTab" href="'+href+'">מקור השם קהא</a>';
  html=html.replace(/(<button\b[^>]*data-view="stories"[^>]*>.*?<\/button>)/,'$1'+link);
  if(home===SHLOMO_HOME){
    const source='<aside id="storyNameOriginSource" class="story-questionnaire" hidden><a class="secondary-button" href="'+href+'#stories">מקורות לסיפורי השורשים של סבא שלמה · מקור השם קהא</a></aside>';
    html=html.replace('<p id="memoryStatus"',source+'<p id="memoryStatus"');
  }
  return html.replace(/(src="\/assets\/(?:home|memories)\.js)(?:\?[^"]*)?"/g,'$1?v=keha-name-origin-1"');
}

function branchHomeHTML(original) {
  return nakashHTML(original,'keha')
    .replace(/<section class="family-slideshow"[^>]*>.*?<\/section>\s*/s,'');
}

export function extendedKehaHTML(original, appOrigin='', shlomoOrigin='', portalOrigins={}) {
  return withNameOrigin(withStoryFormLink(nakashHTML(original,'keha'),'extended'),EXTENDED_HOME)
    .replace('<html ', '<html data-extended-keha="true" data-keha-shlomo-home="'+shlomoOrigin+SHLOMO_HOME+'" '+Object.values(BRANCH_PORTALS).map(portal=>'data-keha-'+portal.id+'-home="'+(portalOrigins[portal.id]||'')+portal.home+'"').join(' ')+' ')
    .replace('data-nakash-branch="keha"','data-nakash-branch="extended" data-nakash-entry-view="tree"'+(appOrigin?' data-nakash-origin="'+appOrigin+'"':''))
    .replace(' data-nakash-search-branch="keha"','')
    .replaceAll('/nakash/keha/',EXTENDED_HOME)
    .replaceAll('/nakash/brand-keha.svg',EXTENDED_HOME+'brand.svg')
    .replaceAll('/nakash/brand-keha-192.png',EXTENDED_HOME+'icon-192.png')
    .replaceAll('/nakash/api/site-data.js',EXTENDED_HOME+'site-data.js')
    .replaceAll('/nakash/media-adapter.js',EXTENDED_HOME+'media-adapter.js?v=gallery-generations-v1')
    .replace(/(<section id="galleryView"[^>]*>)/,'$1<div class="extended-gallery-generations" role="group" aria-label="דורות בגלריה" data-i18n-skip><button type="button" data-gallery-generation="first" aria-pressed="true"><span data-generation-label="first">דור ראשון</span></button><button type="button" data-gallery-generation="second" aria-pressed="false"><span data-generation-label="second">גם הדור השני</span></button></div>')
    .replace(/<button[^>]*data-gallery-filter="untagged"[^>]*>.*?<\/button>/,'')
    .replace(/(src="\/assets\/(?:portal|media-selection|gallery-filter)\.js)(?:\?[^"]*)?"/g,'$1?v=extended-gallery-generations-v1"')
    .replaceAll('משפחת קהא',EXTENDED_NAME)
    .replaceAll('משורש משותף, ארבעה ענפים','קשר משפחתי ידוע · שורשים בבירור')
    .replaceAll('נקאש · מדינה · קהא','קהא · קהת · יששכר')
    .replace(/<nav class="branch-bar" aria-label="ענפי המשפחה">.*?<\/nav>/s,'')
    .replace(/(<meta name="theme-color" content=")[^"]+/,'$1'+EXTENDED_COLOR)
    .replace(/(<style id="familyStartupBackground">)[^<]*/,'$1html,body{background:'+EXTENDED_COLOR+'}:root{--family-accent:'+EXTENDED_COLOR+'}')
    .replace('</head>','<link rel="stylesheet" href="/assets/nakash-theme.css?v=related-trees-1"><link rel="stylesheet" href="/keha-extended/hub.css?v=gallery-generations-v1"></head>')
    .replace(/(  <script src="\/assets\/app.js[^>]*>)/,'  <script src="/keha-extended/hub.js?v=jimaan-family-v1" defer></script>\n$1')
    .replace('<div id="treeView">','<div id="treeView"><section id="extendedKehaHub" aria-label="ענפי משפחת קהא המורחבת" data-i18n-skip></section>')
    .replace('<div class="tree-viewport"',relatedTreeNavigation(Object.keys(relatedTrees),portalOrigins)+'<div class="tree-viewport"')
    .replace(/(<header class="phone-home-intro">.*?<\/header>)/s,'$1<section id="extendedKehaHomeHub" aria-label="ענפי משפחת קהא המורחבת" data-i18n-skip></section>')
    .replace('<h2>הבית שלנו מתחיל כאן</h2>','<h2>'+EXTENDED_NAME+'</h2>')
    .replace('חמישה דורות, סיפור אחד','ענפי המשפחה, סיפור שנבנה יחד');
}

export function shlomoKehaHTML(original,appOrigin=''){
  const html=branchHomeHTML(original)
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
    .replace(/(<meta name="theme-color" content=")[^"]+/,'$1'+SHLOMO_COLOR)
    .replace(/(<style id="familyStartupBackground">)[^<]*/,'$1html,body{background:'+SHLOMO_COLOR+'}:root{--family-accent:'+SHLOMO_COLOR+'}')
    .replace('</head>','<link rel="stylesheet" href="/assets/nakash-theme.css?v=1"></head>')
    .replace('<h2>הבית שלנו מתחיל כאן</h2>','<h2>'+SHLOMO_NAME+'</h2>');
  return withNameOrigin(withExtendedAccess(html),SHLOMO_HOME);
}

function withExtendedAccess(html,extendedOrigin='https://family-extended.eldadkeha.workers.dev',footerLink=''){
  const extendedHome=extendedOrigin+EXTENDED_HOME;
  const extendedLogo='<img src="/keha-extended/brand.svg" alt="" width="32" height="32">';
  const extendedTrigger=placement=>'<button type="button" class="'+(placement==='footer'?'family-extended-button':'nav-link')+'" data-extended-open="'+placement+'" aria-haspopup="dialog" aria-controls="extendedKehaDialog" data-i18n-skip>'+extendedLogo+'<span data-extended-label>'+(placement==='footer'?'לאתר קהא המורחבת':'לאתר משפחת קהא המורחבת')+'</span></button>';
  const extendedDialog='<dialog id="extendedKehaDialog" class="family-extended-dialog" aria-labelledby="extendedKehaTitle" data-i18n-skip>'+
    '<button type="button" class="family-extended-close" data-extended-close aria-label="סגירה">×</button>'+extendedLogo+
    '<h2 id="extendedKehaTitle">קהא המורחבת</h2><p data-extended-intro>איך תרצו לפתוח את אתר המשפחה?</p>'+
    '<div class="family-extended-choices"><a data-extended-install-link href="'+extendedHome+'?install=1#home"><span class="family-extended-choice-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="4" y="2" width="12" height="20" rx="2"/><path d="M8 18h4M19 5v8m-4-4h8"/></svg></span><span><strong data-extended-install-title>התקנת האתר במסך הבית</strong><small data-extended-install-note>קיצור ישיר לאתר קהא המורחבת</small></span></a>'+
    '<a data-extended-tree-link href="'+extendedHome+'#tree"><span class="family-extended-choice-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a17 17 0 0 1 0 18 17 17 0 0 1 0-18Z"/></svg></span><span><strong data-extended-visit-title>מעבר לאתר</strong><small data-extended-visit-note>לכל ענפי משפחת קהא המורחבת</small></span></a></div></dialog>';
  return html
    .replace(/<nav class="branch-bar" aria-label="ענפי המשפחה">.*?<\/nav>/s,'<nav class="family-extended-access" aria-label="קהא המורחבת">'+footerLink+extendedTrigger('footer')+'</nav>')
    .replace(/(<button\b[^>]*data-view="tree"[^>]*>.*?<\/button>)/,'$1'+extendedTrigger('nav'))
    .replace('<main id="mainContent"',extendedDialog+'<main id="mainContent"')
    .replace('</head>','<link rel="stylesheet" href="/keha-extended/portal-tree.css?v=family-footer-tabs-v5"></head>')
    .replace(/(  <script src="\/assets\/app.js[^>]*>)/,'  <script src="/keha-extended/portal-tree.js?v=family-footer-tabs-v3" defer></script>\n$1');
}

export function branchPortalHTML(original,id,appOrigin='',extendedOrigin='https://family-extended.eldadkeha.workers.dev',portalOrigins={}){
  const portal=BRANCH_PORTALS[id];
  const startup=appleLaunchImages(id).map(({href,media})=>'<link rel="apple-touch-startup-image" href="'+href+'" media="'+media+'">').join('\n');
  const html=withStoryFormLink(branchHomeHTML(original),id)
    .replace('<html ','<html data-branch-portal="'+id+'" data-branch-name-en="'+portal.nameEn+'" data-branch-tagline="'+portal.tagline+'" data-branch-tagline-en="'+portal.taglineEn+'" data-keha-extended-home="'+extendedOrigin+EXTENDED_HOME+'" data-keha-api-prefix="'+portal.home+'api/compat" ')
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
    .replace(/(<meta name="theme-color" content=")[^"]+/,'$1'+portal.color)
    .replace(/(<style id="familyStartupBackground">)[^<]*/,'$1html,body{background:'+portal.color+'}:root{--family-accent:'+portal.color+'}')
    .replace(/<link rel="icon"[^>]*>/g,'<link rel="icon" type="image/svg+xml" href="'+portal.home+'brand.svg">')
    .replace('</head>','<link rel="stylesheet" href="/assets/nakash-theme.css?v=related-trees-1">'+startup+'</head>')
    .replace('<div class="tree-viewport"',(id==='zechariah-tzadok'?'':relatedTreeNavigation([id],portalOrigins))+'<div class="tree-viewport"')
    .replace('<h2>הבית שלנו מתחיל כאן</h2>','<h2>'+portal.name+'</h2>')
    .replace('חמישה דורות, סיפור אחד',portal.tagline);
  return withNameOrigin(withExtendedAccess(html,extendedOrigin,id==='zechariah-tzadok'?relatedTreeNavigation([id],portalOrigins,true):''),portal.home);
}

export async function extendedKehaRoute(request,env,db,ctx,options) {
  const url=new URL(request.url),path=url.pathname;
  if(path==='/keha-extended')return Response.redirect(new URL(EXTENDED_HOME+url.search,url),308);
  if(path===SHLOMO_HOME.slice(0,-1))return Response.redirect(new URL(SHLOMO_HOME+url.search,url),308);
  const portal=Object.values(BRANCH_PORTALS).find(item=>path===item.home.slice(0,-1)||path.startsWith(item.home));
  if(portal&&path===portal.home.slice(0,-1))return Response.redirect(new URL(portal.home+url.search,url),308);
  const shlomo=path.startsWith(SHLOMO_HOME),home=portal?.home || (shlomo?SHLOMO_HOME:EXTENDED_HOME);
  const createFamily=portal?original=>createBranchPortal(original,portal.id):shlomo?createShlomoFamily:createExtendedFamily;
  const projection=async()=>{
    const saved=await db('nakash.extended.projection');
    if(shlomo)saved.sharedPeople=(await db('content.people',{branch:'shlomo'})).people;
    return {...options.family,...saved};
  };
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
    for(const p of Object.values(data.people))if(restrictedOriginalPerson(p.id))Object.assign(p,{photoCount:0,videoCount:0,documentCount:0,mediaCount:0});
    const script='window.FAMILY_DATA='+JSON.stringify(data)+';\nwindow.LOCAL_FAMILY_SERVER=true;\nwindow.FAMILY_API_TOKEN='+JSON.stringify(NAKASH_WRITE_TOKEN)+';\nwindow.FAMILY_DATA_AVAILABLE='+available+';\n';
    return new Response(request.method==='HEAD'?null:script,{headers:{'Content-Type':'application/javascript; charset=utf-8'}});
  }
  if(path===home){
    const response=await env.ASSETS.fetch(new Request(new URL('/',url)));
    if(!response.ok)return response;
    const origins=familyAppOrigins(env);
    const source=await response.text();
    const html=portal?branchPortalHTML(source,portal.id,origins[portal.id],origins.extended,origins):shlomo?shlomoKehaHTML(source,origins.shlomo):extendedKehaHTML(source,origins.extended,origins.shlomo,origins);
    return new Response(request.method==='HEAD'?null:html,{headers:{'Content-Type':'text/html; charset=utf-8'}});
  }
  if(path.startsWith(home+'assets/'))return env.ASSETS.fetch(new Request(new URL(path.slice(home.length-1)+url.search,url),request));
  return env.ASSETS.fetch(request);
}
