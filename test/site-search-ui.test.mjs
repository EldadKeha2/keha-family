import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';
import {suggestPeople,SEARCH_TYPES} from '../public/assets/site-search-core.mjs';

const source=(await readFile(new URL('../public/assets/site-search.js',import.meta.url),'utf8')).replace(/^import[^\n]+\n/,'');
const navigation=(await readFile(new URL('../public/index.html',import.meta.url),'utf8')).match(/<nav class="main-nav"[^>]*>[\s\S]*?<\/nav>/)[0];
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const empty={items:[],count:0,page:1,pages:1,size:24,facets:{types:[],branches:[],years:[],labels:[]}};
function press(window,field,key,extra={}){const event=new window.Event('keydown',{bubbles:true,cancelable:true});Object.assign(event,{key,...extra});field.dispatchEvent(event);return event;}
function fixture({fetcher}={}){
  const {window,document}=parseHTML('<html><body><header class="site-header"><a id="homeLink"><span>בית משפחת קהא</span></a><section id="homeInstall"><div data-home-install-actions></div></section>'+navigation+'</header><section id="siteSearchView" hidden></section></body></html>');
  const url=new URL('https://family.example/#home'),requests=[],profiles=[],views=[];let currentView='home';
  const create=document.createElement.bind(document);document.createElement=tag=>{
    const element=create(tag);if(tag==='dialog'){element.showModal=()=>{element.open=true;};element.close=()=>{element.open=false;element.dispatchEvent(new window.Event('close'));};}return element;
  };
  const people=[{id:'roi',name:'רועי אלחריזי',nameEn:'Roei Elharizi',profile:'/media/123',branch:'harizi'}];
  window.FamilyI18n={isEnglish:false,personName:p=>p.name,error:value=>value,async fetch(path,options){requests.push({path,options});return fetcher?fetcher(path,options):Response.json({...empty,query:new URL(path,url).searchParams.get('q')||'',person:new URL(path,url).searchParams.has('person')?people[0]:null});}};
  window.FamilyPeopleRoster={snapshot:()=>people,load:async()=>people};
  const go=route=>{url.href=new URL(route,url).href;};
  window.FamilyNavigation={go};
  window.FamilyApp={getView:()=>currentView,setView(view,syncRoute=true){views.push(view);if(syncRoute)go('#'+view);currentView=view;window.FamilySiteSearch?.activate(view);},openPerson(id){profiles.push(id);currentView='person';window.FamilySiteSearch?.activate('person');}};
  vm.runInContext(source,vm.createContext({window,document,location:url,history:{pushState:(state,unused,route)=>go(route)},URL,URLSearchParams,AbortController,Event:window.Event,suggestPeople,SEARCH_TYPES}));
  return {window,document,url,requests,profiles,views,$:id=>document.getElementById(id),input(value){const field=document.getElementById('siteSearchQuickInput');field.value=value;field.dispatchEvent(new window.Event('input'));},route(route){go(route);window.dispatchEvent(new window.Event('popstate'));}};
}
test('the phone search opens on demand and shows separate portrait/profile and all-content actions',async()=>{
  const f=fixture();assert.equal(f.requests.length,0);
  f.document.querySelector('[data-site-search-open]').click();assert.equal(f.$('siteSearchDialog').open,true);
  f.input('רועי');const host=f.$('siteSearchSuggestions');
  assert.equal(host.querySelector('[data-site-search-person]').getAttribute('href'),'#person/roi');
  assert.equal(host.querySelector('img').getAttribute('src'),'/media/123');
  assert.equal(host.querySelector('img').hasAttribute('data-photo-frame'),false,'Search portraits preserve framing without enabling album edits');
  assert.equal(host.children.length,2);
  const content=host.querySelector('[data-site-search-related]');
  assert.match(content.textContent,/כל התכנים של רועי אלחריזי/);assert.equal(content.querySelector('img'),null);assert.ok(content.querySelector('.site-search-content-icon svg'));
  assert.match(f.$('siteSearchFree').textContent,/חיפוש חופשי של ״רועי״/);
  host.querySelector('[data-site-search-person]').click();assert.deepEqual(f.profiles,['roi']);assert.equal(f.$('siteSearchDialog').open,false);
});
test('one search button follows every internal view and search results disappear on navigation',async()=>{
  const f=fixture(),button=f.document.querySelector('[data-site-search-open]');
  assert.equal(button.parentElement.hasAttribute('data-home-install-actions'),true);
  for(const name of ['person','gallery','videos','stories','calendar','games','weddings']){
    f.window.FamilyApp.setView(name);assert.equal(button.parentElement.className,'site-search-header-slot');assert.equal(f.document.querySelectorAll('[data-site-search-open]').length,1);
    button.click();assert.equal(f.$('siteSearchDialog').open,true);f.$('siteSearchDialog').close();
  }
  f.route('#search/q=רועי');await tick();assert.equal(f.$('siteSearchView').hidden,false);
  f.window.FamilyApp.setView('person');assert.equal(f.$('siteSearchView').hidden,true);
  f.window.FamilyApp.setView('home');assert.equal(button.parentElement.hasAttribute('data-home-install-actions'),true);
  assert.deepEqual([...f.document.querySelectorAll('.brand-title-line')].map(el=>el.textContent),['בית משפחת','קהא']);
});
test('the selected person search uses the full-site route once and renders a persistent subject',async()=>{
  const f=fixture();f.document.querySelector('[data-site-search-open]').click();f.input('רועי');f.document.querySelector('[data-site-search-related]').click();await tick();
  assert.ok(f.url.hash.startsWith('#search/'));const params=new URLSearchParams(f.url.hash.slice(8));assert.equal(params.get('person'),'roi');assert.equal(params.get('q'),'רועי אלחריזי');
  assert.equal(f.requests.length,1);assert.equal(f.$('siteSearchView').hidden,false);assert.match(f.$('siteSearchSubject').textContent,/רועי אלחריזי/);
});
test('arbitrary free search is available without a matching family member and escapes markup',async()=>{
  const f=fixture();f.document.querySelector('[data-site-search-open]').click();f.input('<img src=x onerror=bad>');
  assert.equal(f.$('siteSearchSuggestions').children.length,0);assert.equal(f.$('siteSearchFree').hidden,false);assert.equal(f.$('siteSearchFree').querySelector('img'),null);
  f.$('siteSearchFree').click();await tick();assert.equal(new URLSearchParams(f.url.hash.slice(8)).get('q'),'<img src=x onerror=bad>');
});
test('Back/Forward changes search within the same page and late responses cannot overwrite newer results',async()=>{
  const responses=[];const f=fixture({fetcher:()=>new Promise(resolve=>responses.push(resolve))});
  f.route('#search/q=first');f.route('#search/q=second');assert.equal(f.requests.length,2);assert.equal(f.requests[0].options.signal.aborted,true);
  responses[1](Response.json({...empty,query:'second',count:2}));await tick();assert.match(f.$('siteSearchStatus').textContent,/2 תוצאות/);
  responses[0](Response.json({...empty,query:'first',count:99}));await tick();assert.match(f.$('siteSearchStatus').textContent,/2 תוצאות/);
  f.route('#search/q=first');assert.equal(f.requests.length,3);
});
test('result cards show real thumbnails, links and mixed-media viewer items',async()=>{
  const people=[{id:'roi',name:'רועי אלחריזי'}],media={id:'image',kind:'photo',src:'/media/image'};
  const f=fixture({fetcher:async()=>Response.json({...empty,query:'רועי',count:1,items:[{id:'image',type:'photo',title:'תמונה',excerpt:'<script>bad</script>',year:1998,people,media}],facets:{...empty.facets,types:[{id:'photo',count:1}]}})});
  const opened=[];f.window.FamilyMedia={open:(...args)=>opened.push(args)};f.route('#search/q=רועי');await tick();
  assert.equal(f.$('siteSearchGrid').querySelector('img').getAttribute('src'),'/media/image');assert.equal(f.$('siteSearchGrid').querySelector('script'),null);
  f.document.querySelector('[data-site-search-result]').click();assert.equal(opened[0][0][0].id,'image');assert.equal(opened[0][1],0);
});
test('desktop typing suggests the same profiles and canonical all-content searches without fetching results early',async()=>{
  const f=fixture(),field=f.$('siteSearchDesktopInput'),menu=f.$('siteSearchDesktopMenu');
  assert.equal(field.getAttribute('placeholder'),'חיפוש');assert.equal(menu.hidden,true);assert.equal(f.requests.length,0);
  field.value='רועי';field.dispatchEvent(new f.window.Event('input'));
  assert.equal(menu.hidden,false);assert.equal(field.getAttribute('aria-expanded'),'true');assert.equal(menu.querySelector('[data-site-search-person]').getAttribute('href'),'#person/roi');
  assert.equal(menu.querySelector('img').getAttribute('src'),'/media/123');assert.equal(f.requests.length,0);
  menu.querySelector('[data-site-search-related]').click();await tick();
  const params=new URLSearchParams(f.url.hash.slice(8));assert.equal(params.get('person'),'roi');assert.equal(params.get('q'),'רועי אלחריזי');assert.equal(menu.hidden,true);assert.equal(f.requests.length,1);
});
test('desktop Enter searches arbitrary text and clearing or navigating dismisses suggestions',async()=>{
  const f=fixture(),field=f.$('siteSearchDesktopInput'),menu=f.$('siteSearchDesktopMenu');
  field.value='<img src=x onerror=bad>';field.dispatchEvent(new f.window.Event('input'));assert.equal(menu.querySelector('img'),null);assert.match(f.$('siteSearchDesktopFree').textContent,/<img src=x onerror=bad>/);
  f.$('siteSearchDesktopForm').dispatchEvent(new f.window.Event('submit',{cancelable:true}));await tick();
  assert.equal(new URLSearchParams(f.url.hash.slice(8)).get('q'),'<img src=x onerror=bad>');assert.equal(f.requests.length,1);assert.equal(menu.hidden,true);
  field.value='רועי';field.dispatchEvent(new f.window.Event('input'));menu.querySelector('[data-site-search-person]').click();assert.deepEqual(f.profiles,['roi']);assert.equal(menu.hidden,true);
  field.value='';field.dispatchEvent(new f.window.Event('input'));assert.equal(menu.hidden,true);assert.equal(field.getAttribute('aria-expanded'),'false');
});
for(const mode of ['Desktop','Quick']){
  function open(){
    const f=fixture();if(mode==='Quick')f.document.querySelector('[data-site-search-open]').click();
    const field=f.$('siteSearch'+mode+'Input'),host=f.$(mode==='Desktop'?'siteSearchDesktopMenu':'siteSearchQuickOptions');
    const type=value=>{field.value=value;field.dispatchEvent(new f.window.Event('input'));};
    const selected=()=>host.querySelector('[aria-selected="true"]');
    return {...f,field,host,type,selected};
  }
  test(mode+' Enter from the input opens the first displayed profile without a content search',()=>{
    const f=open();f.type('רועי');
    const first=f.host.querySelector('[data-site-search-person]');
    assert.equal(f.selected(),first);assert.equal(f.field.getAttribute('aria-activedescendant'),first.id);
    assert.equal(press(f.window,f.field,'Enter').defaultPrevented,true);
    assert.deepEqual(f.profiles,['roi']);assert.equal(f.requests.length,0);
    assert.equal(f.field.hasAttribute('aria-activedescendant'),false);
  });
  test(mode+' category suggestions reuse each live navigation title and its illustrated icon',()=>{
    const f=open();
    for(const category of f.document.querySelectorAll('#mainNav [data-view]')){
      f.type(category.textContent);
      const choice=f.host.querySelector('[data-site-search-section="'+category.dataset.view+'"]');
      assert.ok(choice,category.textContent);assert.equal(choice.querySelector('strong').textContent,category.textContent);
      assert.equal(choice.getAttribute('href'),'#'+category.dataset.view);
      assert.equal(choice.querySelector('use').getAttribute('href'),'assets/home-icons.svg?v=voices-v2#'+category.dataset.view);
      assert.equal(f.selected(),choice,'An exact category name is selected first');
    }
    assert.equal(f.requests.length,0);
  });
  test(mode+' category Enter navigates directly while Down then Enter still performs a free content search',async()=>{
    const f=open();f.type('סרטונים');assert.equal(f.selected().dataset.siteSearchSection,'videos');
    press(f.window,f.field,'Enter');assert.equal(f.url.hash,'#videos');assert.deepEqual(f.views,['videos']);assert.equal(f.requests.length,0);
    assert.equal(f.$('siteSearchDialog').open||false,false);assert.equal(f.$('siteSearchDesktopMenu').hidden,true);
    if(mode==='Quick')f.document.querySelector('[data-site-search-open]').click();
    f.type('סרטונים');press(f.window,f.field,'ArrowDown');assert.equal(f.selected().classList.contains('site-search-free'),true);
    press(f.window,f.field,'Enter');await tick();assert.equal(new URLSearchParams(f.url.hash.slice(8)).get('q'),'סרטונים');assert.equal(f.requests.length,1);
  });
  test(mode+' familiar short and English category names show the correct destinations',()=>{
    const f=open();
    for(const [query,id]of [['גלריה','gallery'],['משחקים','games'],['הקלטות','voices'],['Family AI','family-ai'],['תינוקיה','nursery']]){
      f.type(query);assert.equal(f.selected().dataset.siteSearchSection,id,query);
    }
    f.selected().click();assert.equal(f.url.hash,'#nursery');assert.equal(f.requests.length,0);
  });
  test(mode+' Up and Down visibly select each action and Enter activates that selection',async()=>{
    const f=open();f.type('רועי');
    assert.equal(press(f.window,f.field,'ArrowUp').defaultPrevented,true);
    assert.equal(f.selected().classList.contains('site-search-free'),true);
    press(f.window,f.field,'ArrowDown');assert.equal(f.selected().dataset.siteSearchPerson,'roi');
    press(f.window,f.field,'ArrowDown');assert.equal(f.selected().dataset.siteSearchRelated,'roi');
    press(f.window,f.field,'ArrowUp');assert.equal(f.selected().dataset.siteSearchPerson,'roi');
    press(f.window,f.field,'ArrowDown');
    if(mode==='Desktop'){f.field.dispatchEvent(new f.window.Event('focus'));await tick();assert.equal(f.selected().dataset.siteSearchRelated,'roi','Late roster refresh preserves the selected action');}
    assert.equal(f.field.getAttribute('aria-activedescendant'),f.selected().id);
    press(f.window,f.field,'Enter');await tick();
    assert.equal(new URLSearchParams(f.url.hash.slice(8)).get('person'),'roi');assert.equal(f.profiles.length,0);assert.equal(f.requests.length,1);
  });
  test(mode+' typing resets the selection and Enter preserves free search without a person match',async()=>{
    const f=open();f.type('רועי');press(f.window,f.field,'ArrowDown');f.type('רועי אלחריזי');assert.equal(f.selected().dataset.siteSearchPerson,'roi');
    press(f.window,f.field,'Enter',{isComposing:true});assert.equal(f.profiles.length,0);
    f.type('חופשה רחוקה');assert.equal(f.selected().classList.contains('site-search-free'),true);
    press(f.window,f.field,'Enter');await tick();assert.equal(new URLSearchParams(f.url.hash.slice(8)).get('q'),'חופשה רחוקה');assert.equal(f.profiles.length,0);
    f.type('');press(f.window,f.field,'Enter');assert.equal(f.requests.length,1);
  });
}
