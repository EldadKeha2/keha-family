import {readFile} from 'node:fs/promises';

export const navigationSource=await readFile(new URL('../../public/assets/navigation.js',import.meta.url),'utf8');

// Model browser history entries and both events from a same-document traversal.
// App tests use their actual route controllers rather than testing URL strings alone.
export function browserHistory(href='https://family.test/#games'){
  const location=new URL(href),listeners=new Map();
  let entries=[{href:location.href,state:null}],index=0;
  const emit=(type,event)=>{for(const fn of [...listeners.get(type)||[]])fn(event);};
  const history={
    get state(){return entries[index].state;},
    get length(){return entries.length;},
    pushState(state,_title,url){location.href=new URL(url,location).href;entries.splice(index+1);entries.push({href:location.href,state:structuredClone(state)});index++;},
    replaceState(state,_title,url){location.href=new URL(url,location).href;entries[index]={href:location.href,state:structuredClone(state)};},
    go(delta){queueMicrotask(()=>{
      const next=index+delta;if(next<0||next>=entries.length)return;
      const oldURL=location.href;index=next;location.href=entries[index].href;
      emit('popstate',{state:history.state});
      if(new URL(oldURL).hash!==location.hash)emit('hashchange',{oldURL,newURL:location.href});
    });},
    back(){history.go(-1);},forward(){history.go(1);}
  };
  return {location,history,
    addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(fn);},
    get entries(){return entries;},get index(){return index;},
    anchor(hash){const oldURL=location.href;history.pushState(null,'',hash);emit('popstate',{state:null});emit('hashchange',{oldURL,newURL:location.href});},
    flush:()=>new Promise(resolve=>setImmediate(resolve))
  };
}
