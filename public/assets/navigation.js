(() => {
  'use strict';
  const key='familyNavigation';
  const gameIds=['photos','kinship','missing','trivia','chick','differences','puzzle','jachnun','rex','soup','north','neto-tetris','ruti-house'];
  const views=new Set(['home','tree','timeline','directory','gallery','calendar','videos','photos','stories','weddings','nostalgia','updates','memorial','person','games','nursery']);
  const root=()=>matchMedia('(max-width:700px)').matches?'#home':'#tree';
  const path=url=>url.pathname+url.search+url.hash;
  const current=()=>new URL(location.href);
  const entry=()=>history.state?.[key];
  function normalize(value){
    const url=new URL(value,location.href);
    if(url.origin!==location.origin||url.pathname!==location.pathname)return null;
    const legacy=url.searchParams.get('game');
    if(legacy&&(!url.hash||url.hash==='#games'))url.hash=gameIds.includes(legacy)?'#games/'+legacy:'#games';
    url.searchParams.delete('game');
    if(!url.hash)url.hash=root();
    return url;
  }
  function write(url,previous,replace=false){
    const state={...(history.state||{}),[key]:{url:path(url),previous}};
    history[replace?'replaceState':'pushState'](state,'',path(url));
  }
  function parent(url){
    const next=new URL(url);
    if(next.searchParams.has('media')){next.searchParams.delete('media');return next;}
    const [view,id]=next.hash.slice(1).split('/');
    if(id&&['games','weddings','nursery','updates','memorial'].includes(view))next.hash='#'+view;
    else if(view==='person'&&id)next.hash='#directory';
    else if(views.has(view)&&next.hash!==root()&&view!=='home'&&view!=='tree')next.hash=root();
    else return null;
    return next;
  }
  // A shared subpage is still a child page when it is the app's first entry.
  // Seed its parents once; reloading an existing entry preserves real history.
  const initial=normalize(location.href);
  if(initial&&entry()?.url!==path(initial)){
    const chain=[initial];
    for(let next=parent(initial);next;next=parent(next))chain.unshift(next);
    chain.forEach((url,index)=>write(url,index?path(chain[index-1]):null,index===0));
  }
  function go(value,{replace=false}={}){
    const url=normalize(value);if(!url)return false;
    if(String(value).startsWith('#')&&url.hash!==location.hash)url.searchParams.delete('media');
    if(path(url)===path(current()))return false;
    write(url,replace?entry()?.previous||null:path(current()),replace);return true;
  }
  function returnTo(value){
    const url=normalize(value);if(!url||path(url)===path(current()))return false;
    if(entry()?.previous===path(url)){history.back();return true;}
    go(url);return false;
  }
  function back(fallback){
    if(entry()?.previous){history.back();return true;}
    go(fallback,{replace:true});return false;
  }
  // Plain in-site anchors (for example a memorial portrait) use native hashes.
  // Mark their new entry without adding another step to Back/Forward.
  window.addEventListener('hashchange',event=>{
    if(entry()?.url===path(current()))return;
    if(!views.has(location.hash.slice(1).split('/')[0]))return;
    const old=new URL(event.oldURL);
    write(current(),old.origin===location.origin?path(old):null,true);
  });
  window.FamilyNavigation={go,returnTo,back,gameIds};
})();
