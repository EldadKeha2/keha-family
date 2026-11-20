import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';
import family from '../src/family.mjs';

const [html,source,appSource]=await Promise.all([
  readFile(new URL('../public/index.html',import.meta.url),'utf8'),
  readFile(new URL('../public/assets/founder-trees.js',import.meta.url),'utf8'),
  readFile(new URL('../public/assets/app.js',import.meta.url),'utf8')
]);
function fixture({phone=false,english=false,hash='#tree'}={}){
  const {document}=parseHTML(html),events=new Map(),frames=[],opened=[];
  const location={hash},window={FAMILY_DATA:structuredClone(family),addEventListener:(name,fn)=>{if(!events.has(name))events.set(name,[]);events.get(name).push(fn);},dispatchEvent:event=>{for(const fn of events.get(event.type)||[])fn(event);},scrollTo(){}};
  const names={yona:'Yona Nakash Keha',shlomo:'Shlomo Keha'};
  window.FamilyI18n={isEnglish:english,locale:english?'en-US':'he-IL',t:s=>s,html:(parts,...values)=>parts.reduce((out,part,i)=>out+part+(values[i]??''),''),personName:p=>english?(names[p.id]||p.name):p.name,branchName:b=>b?.title||'',searchNames:p=>p.name,date:s=>s};
  window.FamilyDates={parse:()=>null,age:()=>null};window.FamilyPeople={activate(){},open:id=>opened.push(id)};
  const context=vm.createContext({window,document,location,history:{pushState:(state,title,hash)=>{location.hash=hash;}},matchMedia:q=>({matches:q.includes('700px')&&phone}),innerWidth:phone?390:1280,innerHeight:900,console,setTimeout,clearTimeout,setInterval:()=>0,requestAnimationFrame:callback=>{frames.push(callback);return frames.length;},cancelAnimationFrame(){},CustomEvent});
  vm.runInContext(source,context);vm.runInContext(appSource,context);
  const route=hash=>{location.hash=hash;for(const fn of events.get('hashchange')||[])fn({});};
  return {document,window,location,opened,route,section:document.getElementById('founderTreeView')};
}

test('both founding portraits keep their personal action and get independent illustrated tree links',()=>{
  for(const phone of [false,true]){
    const f=fixture({phone});
    const root=f.document.querySelector('[data-unit="u-root"]');
    assert.ok(root);
    for(const id of ['yona','shlomo']){
      const card=root.querySelector(`[data-person-card="${id}"]`),link=card.querySelector('a.founder-tree-link');
      assert.ok(card.querySelector(`button[data-person="${id}"]`));
      assert.equal(link.getAttribute('href'),id==='yona'?'/nakash/inside/':'/keha-extended/');
      assert.match(link.querySelector('img').getAttribute('src'),new RegExp('founder-tree-'+id+'-thumb-v1\\.webp$'));
      assert.ok(link.querySelector('svg'));
      assert.equal(link.closest('[data-person]'),null,'The tree link must not trigger the personal profile action');
    }
    assert.match(root.querySelector('[data-person="yona"] .person-name').textContent,/יונה נקאש קהא/);
    assert.equal(root.querySelectorAll('.founder-tree-link').length,2);
  }
});

test('each direct tree route shows its own image and founder, and switching routes updates the same view',()=>{
  for(const english of [false,true]){
    const f=fixture({english,hash:'#founder-tree/shlomo'});
    assert.equal(f.window.FamilyApp.getView(),'founder-tree');
    assert.equal(f.document.getElementById('treeView').hidden,true);
    assert.equal(f.section.hidden,false);
    assert.match(f.section.querySelector('.founder-tree-art').getAttribute('src'),/shlomo-v1\.webp$/);
    assert.equal(f.section.querySelector('.founder-tree-person').getAttribute('href'),'#person/shlomo');
    assert.equal(f.section.querySelector('.founder-tree-other').getAttribute('href'),'/nakash/inside/');
    f.route('#founder-tree/yona');
    assert.match(f.section.querySelector('.founder-tree-art').getAttribute('src'),/yona-v1\.webp$/);
    assert.equal(f.section.querySelector('.founder-tree-person').getAttribute('href'),'#person/yona');
    assert.ok(f.section.querySelector('a[href="/nakash/inside/"]'),'Old Yona links offer the new Nakash tree');
    assert.match(f.document.getElementById('workspaceTitle').textContent,english?/Grandma Yona/:/סבתא יונה/);
    assert.equal(f.section.querySelectorAll('.founder-tree-person').length,1,'Only known family information belongs in the new tree');
    f.route('#tree');assert.equal(f.section.hidden,true);assert.equal(f.document.getElementById('treeView').hidden,false);
  }
});

test('unrecognized tree routes offer only the two supported trees',()=>{
  for(const hash of ['#founder-tree','#founder-tree/unknown','#founder-tree/constructor']){
    const f=fixture({hash});
    assert.equal(f.section.querySelector('.founder-tree-art'),null);
    assert.equal(f.section.querySelectorAll('.founder-tree-choice a').length,2);
    assert.equal(f.section.querySelector('[data-founder-back]').getAttribute('href'),'#tree');
  }
});

test('live profile changes appear in a founder tree without replacing the illustration or its route',()=>{
  const f=fixture({hash:'#founder-tree/yona'});
  f.window.FamilyApp.updatePerson('yona',{name:'יונה נקאש קהא',profile:'/media/yona-portrait',birthday:'16.10.1921'});
  f.window.dispatchEvent(new CustomEvent('family-people-loaded'));
  assert.equal(f.section.querySelector('.founder-tree-portrait img').getAttribute('src'),'/media/yona-portrait');
  assert.match(f.section.querySelector('.founder-tree-art').getAttribute('src'),/yona-v1\.webp$/);
  assert.equal(f.location.hash,'#founder-tree/yona');
});
