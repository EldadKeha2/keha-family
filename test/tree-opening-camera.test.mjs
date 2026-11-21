import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';
import family from '../src/family.mjs';
import {nakashHTML} from '../src/nakash-shell.mjs';
import {branchPortalHTML,shlomoKehaHTML} from '../src/extended-keha.mjs';
import {createFamily} from '../public/nakash/family-data.mjs';
import {createShlomoFamily} from '../public/keha-extended/shlomo-data.mjs';
import {createBranchPortal} from '../public/keha-extended/branch-portals.mjs';
import {toOriginalFamilyData} from '../public/nakash/tree-data-adapter.mjs';

const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
const source=await readFile(new URL('../public/assets/app.js',import.meta.url),'utf8');
const portalSource=await readFile(new URL('../public/keha-extended/portal-tree.js',import.meta.url),'utf8');
const parents={haim:'u-nakash-haim',yehuda:'u-nakash-yehuda',medina:'u-nakash-medina',keha:'u-root',nakash:'u-nakash-root',shlomo:'u-root',zechariah:'u-keha-zechariah','zechariah-tzadok':'u-kehat-zechariah-ben-tzadok',kehat:'u-keha-kehat'};

function fixture(site,{phone=false,text=100,hash='#tree'}={}){
  const portal=['zechariah','zechariah-tzadok','kehat'].includes(site);
  const original=site==='original';
  const data=original?structuredClone(family):toOriginalFamilyData(portal?createBranchPortal(family,site):site==='shlomo'?createShlomoFamily(family):createFamily(family));
  const page=original?html:portal?branchPortalHTML(html,site):site==='shlomo'?shlomoKehaHTML(html):nakashHTML(html,site==='nakash'?'':site);
  const {document,window:dom}=parseHTML(page);
  const viewport=document.getElementById('treeViewport'),width=phone?358:1100,height=phone?560:720;
  Object.defineProperties(viewport,{clientWidth:{value:width},clientHeight:{value:height}});
  Object.defineProperty(dom.HTMLElement.prototype,'offsetHeight',{configurable:true,get(){return this.classList?.contains('tree-unit')?(phone?180:300)*text/100:0;}});
  Object.defineProperty(dom.HTMLElement.prototype,'offsetTop',{configurable:true,get(){return parseFloat(this.style.top)||0;}});
  const listeners=new Map(),frames=[];
  const window={FAMILY_DATA:data,addEventListener(type,listener){if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(listener);},dispatchEvent(){},scrollTo(){},FamilyAccessibility:{getSettings:()=>({text})}};
  window.FamilyI18n={isEnglish:false,t:v=>v,html:(parts,...values)=>parts.reduce((out,part,index)=>out+part+(values[index]??''),''),personName:p=>p.name,branchName:b=>b?.title,searchNames:p=>p.name,date:v=>v};
  window.FamilyDates={age:()=>null,parse:()=>null};
  const location={hash};
  const context=vm.createContext({window,document,location,performance,history:{pushState(state,title,next){location.hash=next;}},matchMedia:q=>({matches:phone&&q.includes('700px')}),requestAnimationFrame(callback){frames.push(callback);return frames.length;},cancelAnimationFrame(){},setInterval(){},innerWidth:phone?390:1280,innerHeight:900,CustomEvent:dom.CustomEvent});
  if(portal)vm.runInContext(portalSource,context);
  vm.runInContext(source,context);
  const flush=()=>{while(frames.length)frames.shift()();};
  flush();
  const bounds=id=>{
    const key=original?id:id===data.root?'u-root':id==='u-root'?'u-nakash-keha':id;
    const node=document.querySelector('#treeNodes [data-unit="'+key+'"]');
    assert.ok(node,'The founding parents remain in the tree: '+id);
    const [,x,y,scale]=/^translate\(([-\d.]+)px,([-\d.]+)px\) scale\(([-\d.]+)\)$/.exec(document.getElementById('treeWorld').style.transform).map(Number);
    return {x:x+(parseFloat(node.style.left)+parseFloat(node.style.width)/2)*scale,y:y+(parseFloat(node.style.top)+node.offsetHeight/2)*scale,width:parseFloat(node.style.width)*scale,height:node.offsetHeight*scale,scale};
  };
  return {document,window,data,flush,bounds,width,height};
}

function assertCentred(f,id){
  const bounds=f.bounds(id);
  assert.ok(Math.abs(bounds.x-f.width/2)<0.001,'The parents are horizontally centred');
  assert.ok(Math.abs(bounds.y-f.height/2)<0.001,'The parents are vertically centred');
  return bounds;
}

test('each additional family tree opens on its founding parents at a readable size on desktop and phone',()=>{
  for(const [site,id] of Object.entries(parents))for(const phone of [false,true])for(const text of [100,160]){
    const f=fixture(site,{phone,text}),bounds=assertCentred(f,id);
    assert.ok(bounds.width<=f.width-31,'Every founding partner fits across the viewport');
    assert.ok(bounds.height<=f.height-79,'Their complete cards stay visible');
    assert.ok(bounds.scale>0.4,'Large descendant trees do not shrink the opening to a miniature');
    if(['haim','yehuda','medina','keha'].includes(site))assert.equal(f.document.querySelector('#branchBar [aria-pressed="true"]').dataset.branch,site);
  }
});

test('reopening the tree returns to the site’s parents while other families and the whole-tree fit remain available',()=>{
  for(const phone of [false,true]){
    const f=fixture('haim',{phone});
    f.document.querySelector('#branchBar [data-branch="medina"]').click();f.flush();
    assertCentred(f,parents.medina);
    f.document.getElementById('fitButton').click();
    assert.ok(f.bounds(parents.medina).scale<0.5,'Fit still shows the full descendant tree');
    f.window.FamilyApp.setView('home');f.window.FamilyApp.setView('tree');f.flush();
    assertCentred(f,parents.haim);
    assert.equal(f.document.querySelector('#branchBar [aria-pressed="true"]').dataset.branch,'haim');
  }
});

test('direct links to a different branch keep their requested parents centred',()=>{
  for(const phone of [false,true]){
    const f=fixture('haim',{phone,hash:'#tree/medina'});
    assertCentred(f,parents.medina);
    assert.equal(f.document.querySelector('#branchBar [aria-pressed="true"]').dataset.branch,'medina');
  }
});

test('zooming a phone tree keeps its founding parents in the centre without snapping to the whole tree',()=>{
  for(const site of ['haim','shlomo','kehat','zechariah-tzadok']){
    const f=fixture(site,{phone:true}),before=assertCentred(f,parents[site]);
    f.document.getElementById('zoomIn').click();
    const after=assertCentred(f,parents[site]);
    assert.ok(after.scale>before.scale);
  }
});

test('the original family site retains its existing opening camera and overview',()=>{
  for(const phone of [false,true]){
    const f=fixture('original',{phone}),bounds=f.bounds('u-root');
    assert.equal(f.document.querySelector('#branchBar [aria-pressed="true"]').dataset.branch,'all');
    assert.equal(f.document.querySelectorAll('#treeNodes [data-open-branch]').length,6);
    assert.ok(bounds.y<f.height/2,'The original founding parents stay above the overview branches');
    if(!phone)assert.equal(bounds.scale,0.7);
  }
});
