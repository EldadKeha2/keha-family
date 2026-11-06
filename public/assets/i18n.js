(() => {
  'use strict';
  const languages=new Set(['he','en-US','en-GB']),params=new URLSearchParams(location.search);
  let preference;try{preference=localStorage.getItem('keha-family-language');}catch{}
  const requested=params.get('lang'),language=languages.has(requested)?requested:languages.has(preference)?preference:'he',isEnglish=language!=='he',locale=isEnglish?language:'he-IL';
  const dictionary=window.FAMILY_TRANSLATIONS||{},own=(object,key)=>Object.prototype.hasOwnProperty.call(object,key);
  const hebrew=/[\u05d0-\u05ea][\u0590-\u05ff\s.,!?;:…()–—/\-]*/g,ending=/[\s.,!?;:…()–—/\-]+$/;
  const escapeRegExp=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const keys=Object.keys(dictionary).filter(key=>key.length).sort((a,b)=>b.length-a.length);
  const fragments=keys.length?new RegExp('(?:'+keys.map(escapeRegExp).join('|')+')(?![\\u0590-\\u05ff])','g'):null,hebrewBoundary=/[\u0590-\u05ff]/;
  function translateFragments(part){
    if(!fragments)return part;
    let result='',cursor=0,match;fragments.lastIndex=0;
    while((match=fragments.exec(part))){
      // Check the preceding character directly: older Safari versions cannot
      // compile lookbehind, even when Hebrew is the selected language.
      if(match.index>0&&hebrewBoundary.test(part[match.index-1])){fragments.lastIndex=match.index+1;continue;}
      result+=part.slice(cursor,match.index)+dictionary[match[0]];cursor=match.index+match[0].length;
    }
    return result+part.slice(cursor);
  }
  function t(value){
    if(!isEnglish||typeof value!=='string'||!/[\u05d0-\u05ea]/.test(value))return value;
    if(own(dictionary,value))return dictionary[value];
    return value.replace(hebrew,part=>{const key=part.trim().replace(ending,'');if(own(dictionary,key))return dictionary[key]+part.slice(key.length);return translateFragments(part);});
  }
  function html(strings,...values){return strings.reduce((result,part,index)=>result+t(part)+(index<values.length?String(values[index]):''),'');}
  function personName(person){if(!person)return '';const canonical=window.FAMILY_DATA?.people[person.id];return isEnglish?(person.nameEn||canonical?.nameEn||person.name||''):(person.name||canonical?.name||'');}
  function searchNames(person){return [person?.name,person?.nameEn,window.FAMILY_DATA?.people[person?.id]?.nameEn,window.FAMILY_DATA?.people[person?.id]?.name].filter(Boolean).join(' ');}
  function branchName(branch){return branch?(isEnglish?branch.titleEn||t(branch.title):branch.title):'';}
  function mediaName(item){return isEnglish&&item?.nameEn?item.nameEn:item?.name||'';}
  function date(value){if(!isEnglish)return value;const match=/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(String(value));if(!match)return value;const [day,month,year]=match.slice(1).map(Number);return new Intl.DateTimeFormat(locale,{day:'numeric',month:'short',year:'numeric'}).format(new Date(year,month-1,day,12));}
  function error(value){if(!isEnglish||typeof value!=='string')return value;let result=value;for(const person of Object.values(window.FAMILY_DATA?.people||{}))if(person.nameEn)result=result.split(person.name).join(person.nameEn);return t(result);}
  async function localizedFetch(input,options={}){
    const url=new URL(typeof input==='string'?input:input.url,location.href);
    if(url.origin===location.origin&&url.pathname==='/api/calendar')url.searchParams.set('lang',language);
    const response=await fetch(url,options);
    if(!isEnglish||response.ok||response.status===304||!response.headers.get('Content-Type')?.includes('json'))return response;
    try{const data=await response.clone().json();if(typeof data.error!=='string')return response;data.error=error(data.error);const headers=new Headers(response.headers);headers.delete('Content-Length');headers.delete('Content-Encoding');return new Response(JSON.stringify(data),{status:response.status,statusText:response.statusText,headers});}catch{return response;}
  }
  function setLanguage(next){if(!languages.has(next)||next===language)return;try{localStorage.setItem('keha-family-language',next);}catch{}const url=new URL(location.href);url.searchParams.set('lang',next);location.assign(url.href);}
  document.documentElement.lang=language;document.documentElement.dir=isEnglish?'ltr':'rtl';
  window.FamilyI18n={language,locale,isEnglish,t,html,word:(n,one,many)=>n===1?one:many,personName,searchNames,branchName,mediaName,date,error,fetch:localizedFetch,setLanguage};
  // This one-time pass localizes only the authored HTML, before any family content is rendered.
  if(isEnglish){
    const walker=document.createTreeWalker(document.documentElement,NodeFilter.SHOW_TEXT);let node;
    while((node=walker.nextNode())){if(!node.parentElement?.closest('script,style,[data-i18n-skip]'))node.nodeValue=t(node.nodeValue);}
    for(const element of document.querySelectorAll('*')){
      if(element.closest('[data-i18n-skip],script,style'))continue;
      for(const attribute of ['aria-label','title','placeholder','alt'])if(element.hasAttribute(attribute))element.setAttribute(attribute,t(element.getAttribute(attribute)));
      if(element.matches('meta[name=description]'))element.content=t(element.content);
    }
    for(const id of ['mediaPrevious','homeSlidePrevious']){const button=document.getElementById(id);if(button)button.textContent='←';}
    for(const id of ['mediaNext','homeSlideNext']){const button=document.getElementById(id);if(button)button.textContent='→';}
    for(const id of ['calendarPrevious']){const button=document.getElementById(id);if(button)button.textContent='←';}
    for(const id of ['calendarNext']){const button=document.getElementById(id);if(button)button.textContent='→';}
  }
  if(isEnglish){const videos=document.querySelector('#mainNav [data-view=videos]');if(videos)videos.textContent='Videos';}
  document.querySelector('.language-switcher')?.setAttribute('aria-label',isEnglish?'Language':'בחירת שפה');
  for(const button of document.querySelectorAll('[data-language]')){button.setAttribute('aria-pressed',String(button.dataset.language===language));button.addEventListener('click',()=>setLanguage(button.dataset.language));}
})();
