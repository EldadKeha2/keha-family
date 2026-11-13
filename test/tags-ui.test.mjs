import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import family from '../src/family.mjs';
const source=await readFile(new URL('../public/assets/tags.js',import.meta.url),'utf8');
class NodeStub extends EventTarget{
 constructor(){super();this.dataset={};this.children=new Map();this.isConnected=true;this.scrollTop=0;this.className='';this.value='';this.hidden=false;}
 querySelector(selector){if(!this.children.has(selector))this.children.set(selector,new NodeStub());return this.children.get(selector);}
 querySelectorAll(){return [];}
 replaceChildren(){}
 focus(){}
}
function fixture(respond){
 const nodes=new Map(),requests=[],events=[],windowHandlers=new Map();let init;
 const window={FAMILY_DATA:family,FamilyApp:{apiEnabled:true,toast(){}},addEventListener(type,fn){if(!windowHandlers.has(type))windowHandlers.set(type,[]);windowHandlers.get(type).push(fn);},dispatchEvent(event){events.push(event);for(const fn of windowHandlers.get(event.type)||[])fn(event);}};
 window.FamilyI18n={t:v=>v,html:(parts,...values)=>parts.reduce((s,p,i)=>s+p+(values[i]??''),''),isEnglish:false,locale:'he-IL',personName:p=>p.name,searchNames:p=>p.name,branchName:p=>p?.title||'',error:v=>v,fetch:async(path,options)=>{requests.push({path,body:options?.body?JSON.parse(options.body):null});const id=path.split('/')[2];return respond?respond(id):Response.json({item:{id,kind:'photo',tags:[],tagsRevision:'new'},taggedPeople:[]});}};
 const document={addEventListener(type,fn){if(type==='DOMContentLoaded')init=fn;},getElementById(id){if(!nodes.has(id))nodes.set(id,new NodeStub());return nodes.get(id);}};
 const context=vm.createContext({window,document,Response,AbortController,CustomEvent,clearTimeout,setTimeout});vm.runInContext(source,context);
 init();return {tags:window.FamilyTags,requests,events,emit:detail=>window.dispatchEvent(new CustomEvent('family-media-changed',{detail}))};
}
const photo=id=>({id,kind:'photo',name:'Memory',tags:[],tagsRevision:'empty'});

test('Hebrew tagging recognizes English keyboard keys, punctuation letters, capitals and mixed Hebrew input',async()=>{
 const asaf={id:'qa-asaf',name:'אסף כץ',nameEn:'Asaf Katz',extra:true},f=fixture(()=>Response.json({people:[...Object.values(family.people),asaf]}));
 for(const [query,id]of [['tkss evt','eldad'],['TKSS EVT','eldad'],['tkss קהא','eldad'],['hubv beta evt','yona'],['ru,h jrhzh','ruti'],['ta; f.','qa-asaf'],['Eldad Keha','eldad'],['Yona Nakash Keha','yona']]){
  const found=await f.tags.findPeople(query);assert.ok(found.some(person=>person.id===id),query);
 }
 const host=new NodeStub();f.tags.mountInline(host,{...photo('keyboard-search'),kind:'video'});const widget=host._tagWidget;
 widget.query='tkss evt';widget.renderResults(true);assert.match(widget.results.innerHTML,/אלדד קהא/);assert.equal(host.querySelector('[data-tag-add]').hidden,true);f.tags.clearInline(host);
});
test('keyboard recovery retains the global two-error limit while family members precede extra names',async()=>{
 const literal={id:'qa-literal',name:'טקסס',nameEn:'TKSS',extra:true},f=fixture(()=>Response.json({people:[...Object.values(family.people),literal]}));
 for(const query of ['tlss evt','tlzs evt'])assert.ok((await f.tags.findPeople(query)).some(person=>person.id==='eldad'),query);
 assert.equal((await f.tags.findPeople('tlzz evt')).some(person=>person.id==='eldad'),false);
 const found=await f.tags.findPeople('tkss');assert.ok(found.findIndex(person=>person.id==='eldad')<found.findIndex(person=>person.id==='qa-literal'));
});

test('tag search tolerates two inserted, missing or replaced letters and excludes three in Hebrew and English',async()=>{
 const person={id:'qa-alexander',name:'אלכסנדר קוגן',nameEn:'Alexander Bennett',extra:true};
 const f=fixture(()=>Response.json({people:[person]}));
 for(const query of ['אלכסנדז','אלכסנזז','אלכסדר','אלכדר','אלכסנדדר','אלכסנדדדר','alexanxer','alexanxxr','alexandr','alexndr','alexandder','alexanddder','alexanxer bennetx','bennetx alexanxer']){
  assert.ok((await f.tags.findPeople(query)).some(p=>p.id===person.id),query);
 }
 for(const query of ['אלכסזזז','אלדר','אלכסנדדדדר','alexanxxx','alexnd','alexandddder','alexanxxr bennetx']){
  assert.equal((await f.tags.findPeople(query)).some(p=>p.id===person.id),false,query);
 }
});
test('exact tag names precede one and two letter matches, and fuzzy suggestions still allow adding a distinct name',async()=>{
 const people=[{id:'qa-exact',name:'Alexander',extra:true},{id:'qa-one',name:'Alexanxer',extra:true},{id:'qa-two',name:'Alexanxxr',extra:true}];
 const f=fixture(()=>Response.json({people})),found=await f.tags.findPeople('Alexander',['qa-two']);
 assert.deepEqual(Array.from(found.filter(p=>p.id.startsWith('qa-')),p=>p.id),['qa-exact','qa-one','qa-two']);
 const host=new NodeStub();f.tags.mountInline(host,{...photo('fuzzy-search'),kind:'video'});const widget=host._tagWidget;
 widget.query='Alexandxr';widget.renderResults(true);assert.match(widget.results.innerHTML,/qa-exact/);assert.equal(host.querySelector('[data-tag-add]').hidden,false);
 f.tags.clearInline(host);
});

test('a saved face immediately updates the ordinary tagging widget and survives reopening a stale gallery card',()=>{
 const f=fixture(),host=new NodeStub();f.tags.mountInline(host,photo('a'));
 f.emit({operation:'faces',item:{...photo('a'),tags:[family.people.yona],tagsRevision:'face-label'}});
 assert.ok(host._tagWidget.store.selected().has('yona'));assert.match(host._tagWidget.selectedHost.innerHTML,/יונה נקאש/);
 f.tags.clearInline(host);f.tags.mountInline(host,photo('a'));assert.ok(host._tagWidget.store.selected().has('yona'));assert.equal(f.requests.length,0);
});

test('new names from face tagging immediately join the roster even before a tagging widget is mounted',async()=>{
 const extra={id:'extra-friend',name:'חברה חדשה',extra:true},f=fixture(()=>Response.json({people:[...Object.values(family.people)]}));
 f.emit({operation:'faces',item:{...photo('new-name'),tags:[extra]},taggedPeople:[extra]});
 const matches=await f.tags.findPeople(extra.name);assert.equal(matches.length,1);assert.equal(matches[0].id,extra.id);
 await f.tags.findPeople(extra.name);assert.equal(f.requests.filter(r=>r.path==='api/tag-people').length,1,'Repeated searches reuse the loaded roster');
 const host=new NodeStub();f.tags.mountInline(host,{...photo('new-name'),tags:[extra]});assert.match(host._tagWidget.selectedHost.innerHTML,/חברה חדשה/);f.tags.clearInline(host);
});
test('face search loads persisted extra names on the first search after a page reload',async()=>{
 const extra={id:'extra-older-friend',name:'אורח ותיק',extra:true},f=fixture(()=>Response.json({people:[...Object.values(family.people),extra]}));
 const matches=await f.tags.findPeople(extra.name);assert.equal(matches.length,1);assert.equal(matches[0].id,extra.id);assert.equal(f.requests[0].path,'api/tag-people');
});

test('a face saved during an ordinary tag request cannot be removed by its older response',async()=>{
 let resolveFirst,calls=0;const f=fixture(()=>{calls++;if(calls===1)return new Promise(resolve=>{resolveFirst=resolve;});return Response.json({item:{...photo('a'),tags:[family.people.yona,family.people.shlomo],tagsRevision:'latest'}});}),host=new NodeStub();f.tags.mountInline(host,photo('a'));
 const store=host._tagWidget.store;store.enqueue(family.people.shlomo,true);const saving=store.run();await new Promise(resolve=>setImmediate(resolve));
 f.emit({operation:'faces',item:{...photo('a'),tags:[family.people.yona],tagsRevision:'face-newer'}});
 resolveFirst(Response.json({item:{...photo('a'),tags:[family.people.shlomo],tagsRevision:'older'},taggedPeople:[]}));await saving;
 assert.deepEqual([...store.selected().keys()],['yona','shlomo']);assert.equal(calls,2);assert.equal(store.error,'');
});
test('switching images removes old checkbox and remove-button listeners from the reused tagging panel',async()=>{
 const f=fixture(),host=new NodeStub(),calls=[];
 f.tags.mountInline(host,{...photo('image-a'),kind:'video'});const a=host._tagWidget.store;a.enqueue=(person,tagged)=>calls.push(['a',person.id,tagged]);
 f.tags.mountInline(host,{...photo('image-b'),kind:'video'});const b=host._tagWidget.store;b.enqueue=(person,tagged)=>calls.push(['b',person.id,tagged]);
 const change=new Event('change');Object.defineProperty(change,'target',{value:{matches:s=>s==='[data-tag-person]',dataset:{tagPerson:'yona'},checked:true}});host.dispatchEvent(change);
 assert.deepEqual(calls,[['b','yona',true]],'A click in B must never write to closed image A');
 b.saved.set('yona',family.people.yona);const click=new Event('click');Object.defineProperty(click,'target',{value:{closest:s=>s==='[data-remove-person-tag]'?{dataset:{removePersonTag:'yona'}}:null}});host.dispatchEvent(click);
 assert.deepEqual(calls,[['b','yona',true],['b','yona',false]]);
 f.tags.clearInline(host);host.dispatchEvent(change);assert.equal(calls.length,2,'Closing the panel removes every delegated listener');assert.equal(f.requests.length,0,'Known tags and the roster need no extra requests on open');
});
test('rapid selections batch by image and collapse repeated changes to the same person',async()=>{
 const f=fixture(),host=new NodeStub();f.tags.mountInline(host,photo('image-a'));const store=host._tagWidget.store;
 store.enqueue(family.people.yona,true);store.enqueue(family.people.shlomo,true);store.enqueue(family.people.yona,false);
 assert.equal(f.requests.length,0);await store.run();assert.equal(f.requests.length,1);assert.equal(f.requests[0].path,'api/media/image-a/tags/patch');
 assert.deepEqual(f.requests[0].body.changes.map(c=>[c.personId,c.tagged]),[['shlomo',true],['yona',false]]);f.tags.clearInline(host);
});
test('name similarity precedes generation, resets search scroll, and shows family context',()=>{
  const f=fixture(),host=new NodeStub();f.tags.mountInline(host,{...photo('search-image'),kind:'video'});const widget=host._tagWidget;
  widget.results.scrollTop=500;widget.query='שי';widget.renderResults(true);
  assert.equal(widget.results.scrollTop,0);const html=widget.results.innerHTML;assert.ok(html.indexOf('data-tag-person="shay"')<html.indexOf('data-tag-person="avishai"'));assert.match(html,/הורים:/);
  widget.query='מתן';widget.renderResults(true);assert.match(widget.results.innerHTML,/data-tag-person="matan-g"/);assert.match(widget.results.innerHTML,/data-tag-person="matan-f"/);assert.match(widget.results.innerHTML,/גבי/);assert.match(widget.results.innerHTML,/תומר/);f.tags.clearInline(host);
});
test('video tagging retains its compact search field without repeated help text',()=>{
  const f=fixture(),host=new NodeStub();f.tags.mountInline(host,{...photo('compact-image'),kind:'video'});const widget=host._tagWidget;
  assert.match(host.innerHTML,/תייגו מי מופיע כאן/);assert.match(host.innerHTML,/class="tag-heading-icon"/);assert.ok(host.innerHTML.indexOf('data-tag-search-area')<host.innerHTML.indexOf('data-selected-people'));assert.ok(host.innerHTML.indexOf('data-tag-save-status')<host.innerHTML.indexOf('data-selected-people'));assert.doesNotMatch(host.innerHTML,/tag-add-help|התיוגים נשמרים אוטומטית|בחרו את האנשים/);assert.equal(widget.selectedHost.innerHTML,'');assert.equal(widget.status.textContent,'');assert.equal(host.querySelector('[data-tag-count]').textContent,'');
  widget.store.saved.set('yona',family.people.yona);widget.render();assert.match(widget.selectedHost.innerHTML,/יונה/);assert.match(widget.selectedHost.innerHTML,/data-remove-person-tag/);assert.equal(host.querySelector('[data-tag-count]').textContent,'אדם אחד תויג');f.tags.clearInline(host);
});
test('newest tags stay first while saving, after the response and when reopening the image',async()=>{
  let complete;
  const f=fixture(id=>new Promise(resolve=>{complete=ids=>resolve(Response.json({item:{...photo(id),tags:ids.map(id=>family.people[id]),tagsRevision:'saved'},taggedPeople:[]}));})),host=new NodeStub();
  f.tags.mountInline(host,{...photo('ordered-image'),tags:[family.people.yona]});const widget=host._tagWidget,store=widget.store;
  store.enqueue(family.people.shlomo,true);store.enqueue(family.people.roi,true);
  assert.deepEqual([...store.selected().keys()],['roi','shlomo','yona']);
  const first=store.run();store.enqueue(family.people.camille,true);
  assert.deepEqual([...store.selected().keys()],['camille','roi','shlomo','yona']);
  complete(['roi','shlomo','yona']);await first;
  assert.deepEqual([...store.selected().keys()],['camille','roi','shlomo','yona'],'A response must not move a later pending selection to the bottom');
  const second=store.run();complete(['camille','roi','shlomo','yona']);await second;
  assert.deepEqual([...store.selected().keys()],['camille','roi','shlomo','yona']);assert.equal(widget.status.textContent,'✓ התיוג נשמר בהצלחה');
  assert.ok(widget.selectedHost.innerHTML.indexOf('data-remove-person-tag="camille"')<widget.selectedHost.innerHTML.indexOf('data-remove-person-tag="roi"'));
  f.tags.clearInline(host);f.tags.mountInline(host,photo('ordered-image'));
  assert.deepEqual([...host._tagWidget.store.selected().keys()],['camille','roi','shlomo','yona']);f.tags.clearInline(host);
});

test('photos keep existing and new face names without a separate search box; videos retain name tagging',()=>{
 const f=fixture(),host=new NodeStub();f.tags.mountInline(host,{...photo('face-only'),tags:[family.people.yona]});
 assert.match(host._tagWidget.selectedHost.innerHTML,/יונה/);assert.match(host.innerHTML,/המתויגים בתמונה/);assert.doesNotMatch(host.innerHTML,/<input|data-tag-search|data-tag-add/);assert.equal(host._tagWidget.input,null);assert.equal(f.tags.controls(photo('face-only')),'');
 f.emit({operation:'faces',item:{...photo('face-only'),tags:[family.people.shlomo,family.people.yona],tagsRevision:'face-r2'}});assert.match(host._tagWidget.selectedHost.innerHTML,/שלמה/);assert.match(host._tagWidget.selectedHost.innerHTML,/יונה/);
 const removed=[];host._tagWidget.store.enqueue=(person,tagged)=>removed.push([person.id,tagged]);const click=new Event('click');Object.defineProperty(click,'target',{value:{closest:selector=>selector==='[data-remove-person-tag]'?{dataset:{removePersonTag:'yona'}}:null}});host.dispatchEvent(click);assert.deepEqual(removed,[['yona',false]]);
 f.tags.clearInline(host);const video={...photo('video'),kind:'video'};f.tags.mountInline(host,video);assert.match(host.innerHTML,/<input[^>]+type="search"/);assert.match(f.tags.controls(video),/data-edit-media-tags/);f.tags.clearInline(host);
});


test('tag suggestions prioritize generations, extended family, then acquaintances in both pickers',async()=>{
 const people=[...Array.from({length:5},(_,i)=>({id:'priority-'+(5-i),name:'Priority '+(5-i),generation:5-i})),{id:'priority-extended',name:'Priority',extended:true},{id:'priority-friend',name:'Priority',extra:true}];
 const f=fixture(()=>Response.json({people}));
 const results=await f.tags.findPeople('Priority',['priority-friend']);
 const expected=['priority-1','priority-2','priority-3','priority-4','priority-5','priority-extended','priority-friend'];
 assert.deepEqual(Array.from(results,p=>p.id),expected);
 const host=new NodeStub();f.tags.mountInline(host,{...photo('priority'),kind:'video'});const widget=host._tagWidget;widget.query='Priority';widget.renderResults(true);
 const html=widget.results.innerHTML;for(let i=1;i<expected.length;i++)assert.ok(html.indexOf(expected[i-1])<html.indexOf(expected[i]));f.tags.clearInline(host);
});

test('an exact Amit match comes before older-generation lookalikes in face and ordinary tagging',async()=>{
 const f=fixture(()=>Response.json({people:Object.values(family.people)}));
 for(const query of ['עמית','Amit']){
  const found=await f.tags.findPeople(query,['amir','tammy']);assert.equal(found[0].id,'amit',query);
  const host=new NodeStub();f.tags.mountInline(host,{...photo('amit-'+query),kind:'video'});const widget=host._tagWidget;widget.query=query;widget.renderResults(true);
  assert.equal(widget.results.innerHTML.match(/data-tag-person="([^"]+)"/)?.[1],'amit',query);f.tags.clearInline(host);
 }
});

test('main-branch Ben stays before exact extended-family and acquaintance Chen matches',async()=>{
 const extra=[{id:'qa-extended-chen',name:'חן',extended:true},{id:'qa-friend-chen',name:'חן',extra:true}];
 const f=fixture(()=>Response.json({people:[...Object.values(family.people),...extra]})),found=await f.tags.findPeople('חן',['qa-friend-chen']);
 const index=id=>found.findIndex(person=>person.id===id);assert.ok(index('ben')>=0);assert.ok(index('qa-extended-chen')>=0);assert.ok(index('qa-friend-chen')>=0);
 assert.ok(index('ben')<index('qa-extended-chen'));assert.ok(index('qa-extended-chen')<index('qa-friend-chen'));
 const host=new NodeStub();f.tags.mountInline(host,{...photo('ben-chen'),kind:'video'});const widget=host._tagWidget;widget.query='חן';widget.renderResults(true);
 const html=widget.results.innerHTML;assert.ok(html.indexOf('data-tag-person="ben"')<html.indexOf('data-tag-person="qa-extended-chen"'));assert.ok(html.indexOf('data-tag-person="qa-extended-chen"')<html.indexOf('data-tag-person="qa-friend-chen"'));f.tags.clearInline(host);
});

test('both Hebrew nicknames lead directly to Tidhar Fish in face and ordinary tagging',async()=>{
 const f=fixture(()=>Response.json({people:Object.values(family.people)}));
 for(const query of ['תדי','טדי']){
  assert.equal((await f.tags.findPeople(query))[0].id,'tidhar');
  const host=new NodeStub();f.tags.mountInline(host,{...photo('nickname-'+query),kind:'video'});const widget=host._tagWidget;widget.query=query;widget.renderResults(true);
  assert.match(widget.results.innerHTML,/tidhar/);f.tags.clearInline(host);
 }
});
