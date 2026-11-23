import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {browserHistory,navigationSource} from './helpers/browser-history.mjs';

function fixture(href,{phone=false,site}={}){
  const browser=browserHistory(href);
  const window={location:browser.location,addEventListener:browser.addEventListener};
  const context=vm.createContext({window,document:{documentElement:{dataset:site}},location:browser.location,history:browser.history,URL,matchMedia:()=>({matches:phone})});
  const reload=()=>vm.runInContext(navigationSource,context);
  reload();return {...browser,window,reload,nav:window.FamilyNavigation};
}
test('a shared family screensaver tab has a home parent and returns with the selected language',async()=>{
 for(const phone of [false,true]){
  const f=fixture('https://family.test/?lang=en-GB#screensaver',{phone});
  assert.equal(f.location.hash,'#screensaver');f.nav.back();await f.flush();
  assert.equal(f.location.hash,phone?'#home':'#tree');assert.equal(new URL(f.location.href).searchParams.get('lang'),'en-GB');
 }
});

test('both founder trees return directly to the family tree after sharing, reload, Back and Forward',async()=>{
  for(const phone of [false,true])for(const id of ['shlomo','yona']){
    const f=fixture('https://family.test/?lang=en-GB#founder-tree/'+id,{phone}),length=f.history.length;
    f.reload();assert.equal(f.history.length,length);
    assert.equal(f.nav.returnTo('#tree'),true);await f.flush();assert.equal(f.location.hash,'#tree');
    f.history.forward();await f.flush();assert.equal(f.location.hash,'#founder-tree/'+id);
    assert.equal(f.location.search,'?lang=en-GB');
  }
});
test('the recording archive is the parent of a shared interview on mobile and desktop',async()=>{
  const hash='#voices/'+('b'.repeat(32));
  for(const phone of [true,false]){
    const f=fixture('https://family.test/?lang=en-GB'+hash,{phone});
    f.history.back();await f.flush();assert.equal(f.location.hash,'#voices');
    f.history.forward();await f.flush();assert.equal(f.location.hash,hash);assert.equal(f.location.search,'?lang=en-GB');
  }
});

test('all direct game links have a lobby parent on desktop and in a phone app, including legacy links',async()=>{
  const ids=fixture('https://family.test/#games').nav.gameIds;
  for(const phone of [false,true])for(const id of ids)for(const legacy of [false,true]){
    const f=fixture('https://family.test/?lang=en-US'+(legacy?'&game='+id+'#games':'#games/'+id),{phone});
    assert.equal(f.location.hash,'#games/'+id);assert.equal(f.location.search,'?lang=en-US');
    f.history.back();await f.flush();assert.equal(f.location.hash,'#games');
    f.history.back();await f.flush();assert.equal(f.location.hash,phone?'#home':'#tree');
    f.history.forward();await f.flush();assert.equal(f.location.hash,'#games');
    f.history.forward();await f.flush();assert.equal(f.location.hash,'#games/'+id);
  }
});

test('branch game links stay within the current family, including Back and legacy links', async () => {
  const home='/keha-extended/shlomo/';
  const site={nakashHome:home,nakashEntryView:'home',nakashViews:'home tree games'};
  for (const url of ['#games/rex','?game=jachnun#games','#games/trivia']) {
    const f=fixture('https://family.test'+home+url,{site});
    assert.deepEqual([...f.nav.gameIds],['rex','jachnun']);
    assert.equal(f.location.hash,url.includes('trivia')?'#games':url.includes('rex')?'#games/rex':'#games/jachnun');
    if (f.location.hash!=='#games') {
      f.history.back();await f.flush();assert.equal(f.location.hash,'#games');
    }
    f.history.back();await f.flush();assert.equal(f.location.pathname,home);assert.equal(f.location.hash,'#home');
  }
});

test('a reload preserves the entry and Back/Forward never grows history',async()=>{
  const f=fixture('https://family.test/?lang=he#games/ruti-house',{phone:true}),length=f.history.length;
  f.reload();assert.equal(f.history.length,length);
  for(let i=0;i<4;i++){
    f.history.back();await f.flush();assert.equal(f.location.hash,'#games');
    f.history.forward();await f.flush();assert.equal(f.location.hash,'#games/ruti-house');
    assert.equal(f.history.length,length);
  }
});

test('on-page parent buttons consume their existing parent entry rather than adding a return loop',async()=>{
  for(const [child,parent]of [['#games/soup','#games'],['#weddings/u-root','#weddings'],['#nursery/yona','#nursery'],['#memorial/yona','#memorial']]){
    const f=fixture('https://family.test/?lang=he'+child,{phone:true}),length=f.history.length;
    assert.equal(f.nav.returnTo(parent),true);await f.flush();assert.equal(f.location.hash,parent);
    assert.equal(f.history.length,length);f.history.back();await f.flush();assert.equal(f.location.hash,'#home');
  }
});

test('nested albums and personal pages keep their real previous screen across several levels',async()=>{
  const f=fixture('https://family.test/#home',{phone:true});
  for(const hash of ['#calendar','#person/eldad','#person/yehiel','#weddings/u-yehiel'])f.nav.go(hash);
  for(const hash of ['#person/yehiel','#person/eldad','#calendar','#home']){
    f.history.back();await f.flush();assert.equal(f.location.hash,hash);
  }
  for(const [child,parent]of [['#weddings/u-root','#weddings'],['#nursery/yona','#nursery'],['#person/eldad','#directory'],['#updates/manage/token','#updates']]){
    const direct=fixture('https://family.test/'+child,{phone:true});direct.nav.back(parent);await direct.flush();assert.equal(direct.location.hash,parent);
  }
});

test('shared media gets its own entry and moving between photos replaces only that entry',async()=>{
  const f=fixture('https://family.test/?lang=en-GB&media=photo1#nursery/yona',{phone:true});
  const parent=new URL(f.location.href);parent.searchParams.delete('media');
  const next=new URL(f.location.href);next.searchParams.set('media','photo2');f.nav.go(next.href,{replace:true});
  assert.equal(f.nav.returnTo(parent.href),true);await f.flush();assert.equal(f.location.href,parent.href);
  f.history.back();await f.flush();assert.equal(f.location.hash,'#nursery');
});

test('leaving a direct game or media link removes stale parameters and preserves language',()=>{
  const f=fixture('https://family.test/?lang=en-US&game=north#games',{phone:true});
  f.nav.go('#gallery');assert.equal(f.location.href,'https://family.test/?lang=en-US#gallery');
  const photo=new URL(f.location.href);photo.searchParams.set('media','photo');f.nav.go(photo.href);
  f.nav.go('#person/eldad');assert.equal(f.location.href,'https://family.test/?lang=en-US#person/eldad');
  assert.equal(f.nav.go('https://outside.test/#games'),false);
  assert.equal(f.nav.go('/install/'),false);
});

test('native same-site portrait anchors preserve their actual source and repeated targets add no entries',async()=>{
  const f=fixture('https://family.test/#memorial',{phone:true}),length=f.history.length;
  f.anchor('#person/yona');assert.equal(f.history.length,length+1);
  assert.equal(f.nav.go('#person/yona'),false);assert.equal(f.history.length,length+1);
  f.nav.back('#directory');await f.flush();assert.equal(f.location.hash,'#memorial');
});


test('direct Artificial Family links retain a home parent and selected language',async()=>{
 for(const phone of [false,true]){
  const f=fixture('https://family.test/?lang=en-GB#family-ai',{phone});
  assert.equal(f.location.hash,'#family-ai');
  f.nav.back();await f.flush();
  assert.equal(f.location.hash,phone?'#home':'#tree');
  f.history.forward();await f.flush();assert.equal(f.location.hash,'#family-ai');
  assert.equal(f.location.search,'?lang=en-GB');
 }
});

test('shared stories and records return to their list in every family without growing history',async()=>{
  for(const phone of [true,false])for(const home of ['/','/nakash/','/keha-extended/','/keha-extended/zechariah-tzadok/'])for(const view of ['stories','documents']){
    const site=home==='/'?{}:{nakashHome:home,nakashEntryView:'home',nakashViews:'home tree stories documents search'};
    const f=fixture('https://family.test'+home+'?lang=en-GB#'+view+'/record',{phone,site}),length=f.history.length;
    f.reload();assert.equal(f.history.length,length);
    f.history.back();await f.flush();assert.equal(f.location.hash,'#'+view);
    f.history.back();await f.flush();assert.equal(f.location.hash,home==='/'&&!phone?'#tree':'#home');
    f.history.forward();await f.flush();f.history.forward();await f.flush();
    assert.equal(f.location.hash,'#'+view+'/record');assert.equal(f.location.pathname,home);assert.equal(f.location.search,'?lang=en-GB');assert.equal(f.history.length,length);
  }
});

test('nested PDF and search readers have separate parents and leaving them clears only reader parameters',async()=>{
  const url='https://family.test/?lang=en-US&content=story%3Aid&pdf=%2Frecord.pdf&pdfName=record.pdf&pdfTitle=Record#search/q=roots';
  const f=fixture(url,{phone:true}),length=f.history.length;
  f.history.back();await f.flush();assert.equal(f.location.search,'?lang=en-US&content=story%3Aid');
  f.history.back();await f.flush();assert.equal(f.location.href,'https://family.test/?lang=en-US#search/q=roots');
  f.history.forward();await f.flush();f.history.forward();await f.flush();assert.equal(f.location.href,url);assert.equal(f.history.length,length);
  f.nav.go('#gallery');assert.equal(f.location.href,'https://family.test/?lang=en-US#gallery');
});
