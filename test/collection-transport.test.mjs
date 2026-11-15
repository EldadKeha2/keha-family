import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../public/assets/collection-transport.js',import.meta.url),'utf8');
const turn=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(handler){
 const calls=[],location=new URL('https://family.test/index.html?lang=he'),window={FamilyI18n:{fetch:async(input,options)=>{const call={input,url:new URL(input,location.href),options};calls.push(call);return handler(call,calls);}}};
 vm.runInNewContext(source,{window,location,URL,Headers,Response});
 return {api:window.FamilyCollectionTransport,calls};
}
function page({page=1,total=250,revision='r1',extra={}}={}){
 const pages=Math.max(1,Math.ceil(total/100)),start=(page-1)*100;
 return {kind:'photos',items:Array.from({length:Math.max(0,Math.min(100,total-start))},(_,i)=>({id:String(start+i),caption:'Photo '+(start+i),tags:[{id:i%2?'yona':'ora'}]})),count:total,revision:revision+':page'+page,collectionRevision:revision,pagination:{page,pages,size:100,total},...extra};
}
const json=(value,headers={})=>Response.json(value,{headers:{ETag:'"first-page"',...headers}});

test('album page requests use at most two workers and assemble the complete original order despite out-of-order responses',async()=>{
 const waiting=new Map();let active=0,peak=0;
 const f=fixture(({url})=>{const n=Number(url.searchParams.get('page'));assert.equal(url.searchParams.get('paged'),'1');assert.equal(url.searchParams.get('size'),'100');assert.equal(url.searchParams.get('lang'),'en-US');if(n===1)return json(page({total:450}));active++;peak=Math.max(peak,active);return new Promise(resolve=>waiting.set(n,()=>{active--;resolve(json(page({page:n,total:450})));}));});
 const pending=f.api.fetch('api/collections/photos?lang=en-US',{headers:{'X-Test':'retained'}});await turn();
 assert.deepEqual(f.calls.map(call=>Number(call.url.searchParams.get('page'))),[1,2,3]);
 waiting.get(3)();await turn();waiting.get(4)();await turn();waiting.get(5)();await turn();assert.equal(f.calls.length,5);waiting.get(2)();
 const result=await(await pending).json();assert.equal(peak,2);assert.equal(result.items.length,450);assert.deepEqual(result.items.map(item=>item.id),Array.from({length:450},(_,i)=>String(i)));assert.equal(result.pagination,undefined);assert.equal(result.count,450);
 assert.ok(f.calls.every(call=>new Headers(call.options.headers).get('X-Test')==='retained'));
 // Existing sorting, people filters and full-album navigation still receive all items.
 assert.equal(result.items.filter(item=>item.tags.some(tag=>tag.id==='yona')).length,225);assert.equal([...result.items].reverse()[0].id,'449');assert.equal(result.items[(449+1)%result.items.length].id,'0');
});

test('wedding envelopes and nostalgia/video metadata remain attached to the full reconstructed collection',async()=>{
 for(const kind of ['wedding','nostalgia','videos']){
  const meta=kind==='nostalgia'?{library:{revision:'lib',events:[{id:'birthday',count:250}],categories:[{id:'birthdays'}]}}:kind==='videos'?{categories:[{id:'home',name:'Home'}]}:{};
  const f=fixture(({url})=>{const n=Number(url.searchParams.get('page')),collection=page({page:n,extra:n===1?meta:{}});return json(kind==='wedding'?{id:'u-root',name:'Parents',cover:'/cover.jpg',greetings:[{text:'Memory'}],collection}:collection,{'Content-Length':'12','Content-Encoding':'gzip'});});
  const path=kind==='wedding'?'api/weddings/u-root':kind==='nostalgia'?'api/nostalgia':'api/collections/videos';
  const response=await f.api.fetch(path),result=await response.json(),collection=kind==='wedding'?result.collection:result;
  assert.equal(collection.items.length,250);assert.equal(collection.pagination,undefined);assert.equal(response.headers.get('Content-Length'),null);assert.equal(response.headers.get('Content-Encoding'),null);assert.equal(response.headers.get('ETag'),'"first-page"');
  if(kind==='wedding'){assert.equal(result.id,'u-root');assert.equal(result.cover,'/cover.jpg');assert.equal(result.greetings[0].text,'Memory');}
  else if(kind==='nostalgia')assert.deepEqual(result.library,meta.library);
  else assert.deepEqual(result.categories,meta.categories);
 }
});

test('304 and first-page errors pass through without parsing or requesting more pages',async()=>{
 for(const response of [new Response(null,{status:304,headers:{ETag:'"cached"'}}),new Response('Unavailable',{status:503})]){
  const f=fixture(()=>response),result=await f.api.fetch('api/collections/photos',{headers:{'If-None-Match':'"cached"'}});
  assert.equal(result,response);assert.equal(f.calls.length,1);assert.equal(new Headers(f.calls[0].options.headers).get('If-None-Match'),'"cached"');
 }
});

test('an album revision changing between pages restarts from page one and never exposes a mixed list',async()=>{
 let attempt=0;
 const f=fixture(({url,options})=>{const n=Number(url.searchParams.get('page'));if(n===1)attempt++;if(attempt>1||n>1)assert.equal(new Headers(options.headers).get('If-None-Match'),null);const revision=attempt===1&&n===1?'old':'new';return json(page({page:n,revision,extra:{items:page({page:n}).items.map(item=>({...item,revision}))}}));});
 const result=await(await f.api.fetch('api/collections/photos',{headers:{'If-None-Match':'"old"'}})).json();
 assert.equal(attempt,2);assert.equal(result.items.length,250);assert.ok(result.items.every(item=>item.revision==='new'));assert.equal(result.collectionRevision,'new');
});

test('continuously edited albums fall back to the atomic legacy response after bounded retries',async()=>{
 let attempts=0;const atomic={kind:'photos',items:[{id:'atomic-final'}],count:1,revision:'legacy'};
 const f=fixture(({url,options})=>{if(!url.searchParams.has('paged')){assert.equal(new Headers(options.headers).get('If-None-Match'),null);assert.equal(url.searchParams.get('lang'),'he');return json(atomic);}const n=Number(url.searchParams.get('page'));if(n===1)attempts++;return json(page({page:n,revision:n===1?'start'+attempts:'changed'+attempts}));});
 assert.deepEqual(await(await f.api.fetch('api/collections/photos?lang=he',{headers:{'If-None-Match':'"cached"'}})).json(),atomic);assert.equal(attempts,3);assert.equal(f.calls.filter(call=>!call.url.searchParams.has('paged')).length,1);assert.ok(f.calls.length<=10,'Retries and the final fallback are bounded');
});

test('a failed later page returns its HTTP failure rather than a successful partial album, and fetch failures propagate',async()=>{
 const failure=new Response('Please retry',{status:502}),f=fixture(({url})=>Number(url.searchParams.get('page'))===1?json(page()):failure);
 assert.equal(await f.api.fetch('api/collections/photos'),failure);
 const network=Error('Connection interrupted'),broken=fixture(({url})=>Number(url.searchParams.get('page'))===1?json(page()):Promise.reject(network));
 await assert.rejects(broken.api.fetch('api/collections/photos'),error=>error===network);
});

test('cancelling an album load aborts both active pages and never returns or requests an unpaged fallback',async()=>{
 const controller=new AbortController();let aborted=0;
 const f=fixture(({url,options})=>{assert.equal(options.signal,controller.signal);if(Number(url.searchParams.get('page'))===1)return json(page({total:500}));return new Promise((resolve,reject)=>{options.signal.addEventListener('abort',()=>{aborted++;reject(new DOMException('Cancelled','AbortError'));},{once:true});});});
 const pending=f.api.fetch('api/collections/photos',{signal:controller.signal});await turn();assert.equal(f.calls.length,3);controller.abort();
 await assert.rejects(pending,{name:'AbortError'});assert.equal(aborted,2);assert.equal(f.calls.length,3);assert.ok(f.calls.every(call=>call.url.searchParams.has('paged')));
});

test('explicit pagination, gallery filters, mutations and external URLs retain their original fetch behavior',async()=>{
 for(const [input,options]of [['api/collections/gallery?page=2&filter=partial',{}],['api/collections/photos?page=2',{}],['api/collections/videos?paged=1',{}],['api/weddings',{}],['api/collections/photos',{method:'POST',body:'{}'}],['https://outside.test/api/collections/photos',{}]]){
  const original=new Response('original'),f=fixture(()=>original);assert.equal(await f.api.fetch(input,options),original);assert.equal(f.calls.length,1);assert.equal(f.calls[0].input,input);assert.equal(f.calls[0].options,options);
 }
});

test('single-page and empty albums preserve all metadata and do not start page workers',async()=>{
 for(const total of [0,1,100]){
  const head=page({total}),f=fixture(()=>json(head)),result=await(await f.api.fetch('api/collections/photos')).json();assert.equal(f.calls.length,1);assert.deepEqual(result.items,head.items);assert.equal(result.count,total);assert.equal(result.pagination,undefined);
 }
});
