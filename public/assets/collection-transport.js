(() => {
  'use strict';
  // Keep the existing complete-album contract for sorting, filtering and
  // swiping. The wire format uses small, batched pages with bounded parallelism.
  const eligible=/^\/api\/(?:collections\/(?:photos|videos)|nostalgia|weddings\/[^/]+)$/;
  const collection=data=>data.collection||data;
  function response(data,source){
    const headers=new Headers(source.headers);headers.delete('Content-Length');headers.delete('Content-Encoding');
    return new Response(JSON.stringify(data),{status:source.status,headers});
  }
  async function fetchCollection(input,options={}){
    const native=(path,opts)=>window.FamilyI18n.fetch(path,opts);
    let url;try{url=new URL(input,location.href);}catch{return native(input,options);}
    if(url.origin!==location.origin||!eligible.test(url.pathname)||options.body||options.method&&options.method!=='GET'||url.searchParams.has('page')||url.searchParams.has('paged'))return native(input,options);
    url.searchParams.set('paged','1');url.searchParams.set('size','100');url.searchParams.set('page','1');
    for(let attempt=0;attempt<3;attempt++){
      const firstOptions={...options,headers:new Headers(options.headers)};
      if(attempt)firstOptions.headers.delete('If-None-Match');
      const first=await native(url.href,firstOptions);
      if(!first.ok||first.status===304)return first;
      const data=await first.json(),head=collection(data),paging=head.pagination;
      if(!paging||!Array.isArray(head.items))return response(data,first);
      if(!Number.isSafeInteger(paging.pages)||paging.pages<1)throw Error('Invalid album page count');
      const pages=new Array(paging.pages);pages[0]=head;let next=2,changed=false,stopped=false;
      async function worker(){
        try{while(!stopped&&next<=paging.pages){
          const page=next++,pageURL=new URL(url.href);pageURL.searchParams.set('page',String(page));
          const headers=new Headers(options.headers);headers.delete('If-None-Match');
          const result=await native(pageURL.href,{...options,headers});
          if(!result.ok){const error=Error('Album page unavailable');error.response=result;throw error;}
          const part=collection(await result.json());
          if(!Array.isArray(part.items))throw Error('Invalid album page');
          if(part.collectionRevision!==head.collectionRevision||part.pagination?.page!==page||part.pagination?.total!==paging.total||part.pagination?.pages!==paging.pages){changed=true;stopped=true;return;}
          pages[page-1]=part;
        }}catch(error){stopped=true;throw error;}
      }
      const results=await Promise.allSettled(Array.from({length:Math.min(2,paging.pages-1)},worker));
      const failed=results.find(result=>result.status==='rejected');
      if(failed){if(failed.reason?.response)return failed.reason.response;throw failed.reason;}
      if(changed||Array.from(pages).some(page=>!page))continue;
      head.items=pages.flatMap(page=>page.items);delete head.pagination;
      return response(data,first);
    }
    // An actively edited album must not expose a mixture of revisions. The
    // atomic legacy response is a safe bounded fallback after two restarts.
    const headers=new Headers(options.headers);headers.delete('If-None-Match');
    return native(input,{...options,headers});
  }
  window.FamilyCollectionTransport={fetch:fetchCollection};
})();
