(() => {
  'use strict';
  const prefix=document.documentElement.dataset.kehaApiPrefix || '/keha-extended/api/compat';
  const localPath=location.pathname.endsWith('/')?location.pathname:location.pathname+'/';
  function scoped(input){
    const value=input instanceof Request?input.url:input;
    if(typeof value!=='string'&&!(value instanceof URL))return null;
    const url=new URL(value,location.href);
    if(url.origin!==location.origin)return null;
    if(url.pathname.startsWith(localPath+'api/'))url.pathname='/'+url.pathname.slice(localPath.length);
    if(!url.pathname.startsWith('/api/'))return null;
    url.pathname=prefix+url.pathname;return url.href;
  }
  const originalFetch=window.fetch;
  window.fetch=function(input,init){const url=scoped(input);return originalFetch.call(window,url?(input instanceof Request?new Request(url,input):url):input,init);};
  const open=XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open=function(method,url,...options){return open.call(this,method,scoped(url)||url,...options);};
  if(navigator.serviceWorker)void navigator.serviceWorker.register('/keha-extended/sw.js',{scope:document.documentElement.dataset.nakashHome || '/keha-extended/'}).catch(()=>{});
  if(document.documentElement.dataset.extendedKeha==='true'){
    function renderGenerations(){
      const selected=window.FamilyPortal?.galleryQuery().generation||'first',english=window.FamilyI18n?.isEnglish;
      for(const button of document.querySelectorAll('[data-gallery-generation]')){
        button.setAttribute('aria-pressed',String(button.dataset.galleryGeneration===selected));
        button.querySelector('[data-generation-label]').textContent=button.dataset.galleryGeneration==='first'?(english?'First generation':'דור ראשון'):(english?'Include the second generation':'גם הדור השני');
      }
    }
    document.addEventListener('DOMContentLoaded',()=>{
      const portal=window.FamilyPortal;
      for(const name of ['activate','refineGallery']){
        const original=portal[name];
        portal[name]=function(...args){const result=original.apply(this,args);renderGenerations();return result;};
      }
      renderGenerations();
    });
    document.addEventListener('click',event=>{
      const button=event.target.closest('[data-gallery-generation]');if(!button)return;
      window.FamilyGalleryFilter?.reset();
      void window.FamilyPortal.refineGallery({generation:button.dataset.galleryGeneration});
    });
  }
})();
