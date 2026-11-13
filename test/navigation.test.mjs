import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {browserHistory,navigationSource} from './helpers/browser-history.mjs';

function fixture(href,{phone=false}={}){
  const browser=browserHistory(href);
  const window={location:browser.location,addEventListener:browser.addEventListener};
  const context=vm.createContext({window,location:browser.location,history:browser.history,URL,matchMedia:()=>({matches:phone})});
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
