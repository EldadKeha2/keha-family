import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';
import family from '../src/family.mjs';
import {nakashHTML} from '../src/nakash-shell.mjs';
import {branchPortalHTML,extendedKehaHTML,shlomoKehaHTML} from '../src/extended-keha.mjs';
import {createFamily} from '../public/nakash/family-data.mjs';
import {createShlomoFamily} from '../public/keha-extended/shlomo-data.mjs';
import {createExtendedFamily} from '../public/keha-extended/family-data.mjs';
import {createBranchPortal} from '../public/keha-extended/branch-portals.mjs';
import {toOriginalFamilyData} from '../public/nakash/tree-data-adapter.mjs';

const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
const source=await readFile(new URL('../public/assets/app.js',import.meta.url),'utf8');
const homeSource=await readFile(new URL('../public/assets/home.js',import.meta.url),'utf8');
const portalSource=await readFile(new URL('../public/keha-extended/portal-tree.js',import.meta.url),'utf8');
const hubSource=await readFile(new URL('../public/keha-extended/hub.js',import.meta.url),'utf8');
const parents={haim:'u-nakash-haim',yehuda:'u-nakash-yehuda',medina:'u-nakash-medina',keha:'u-root',nakash:'u-nakash-root',shlomo:'u-root',zechariah:'u-keha-zechariah','zechariah-tzadok':'u-kehat-zechariah-ben-tzadok',kehat:'u-keha-kehat'};

function fixture(site,{phone=false,text=100,english=false,hash='#tree',viewportHeight,viewportWidth,ResizeObserver}={}){
  const portal=['zechariah','zechariah-tzadok','kehat'].includes(site);
  const original=site==='original';
  const extended=site==='extended';
  const data=original?structuredClone(family):toOriginalFamilyData(portal?createBranchPortal(family,site):extended?createExtendedFamily(family):site==='shlomo'?createShlomoFamily(family):createFamily(family));
  const page=original?html:portal?branchPortalHTML(html,site):extended?extendedKehaHTML(html):site==='shlomo'?shlomoKehaHTML(html):nakashHTML(html,site==='nakash'?'':site);
  const {document,window:dom}=parseHTML(page);
  const viewport=document.getElementById('treeViewport'),width=viewportWidth??(phone?358:1100),height=viewportHeight??(phone?560:720);
  Object.defineProperties(viewport,{clientWidth:{value:width,configurable:true},clientHeight:{value:height,configurable:true}});
  viewport.setPointerCapture=()=>{};
  viewport.getBoundingClientRect=()=>({left:0,top:0,width:viewport.clientWidth,height:viewport.clientHeight,right:viewport.clientWidth,bottom:viewport.clientHeight});
  Object.defineProperty(dom.HTMLElement.prototype,'offsetHeight',{configurable:true,get(){return this.classList?.contains('tree-unit')?(phone?180:300)*text/100:0;}});
  Object.defineProperty(dom.HTMLElement.prototype,'offsetTop',{configurable:true,get(){return parseFloat(this.style.top)||0;}});
  const listeners=new Map(),frames=[];
  const window={FAMILY_DATA:data,addEventListener(type,listener){if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(listener);},dispatchEvent(){},scrollTo(){},FamilyAccessibility:{getSettings:()=>({text}),isReducedMotion:()=>false}};
  window.FamilyI18n={isEnglish:english,t:v=>v,html:(parts,...values)=>parts.reduce((out,part,index)=>out+part+(values[index]??''),''),personName:p=>english?p.nameEn:p.name,branchName:b=>english?b?.titleEn:b?.title,searchNames:p=>p.name,date:v=>v};
  window.FamilyDates={age:()=>null,parse:()=>null};
  const location={hash};
  const context=vm.createContext({window,document,location,performance,ResizeObserver,history:{pushState(state,title,next){location.hash=next;}},matchMedia:q=>({matches:phone&&q.includes('700px')}),requestAnimationFrame(callback){frames.push(callback);return frames.length;},cancelAnimationFrame(){},setInterval(){},innerWidth:phone?390:1280,innerHeight:900,CustomEvent:dom.CustomEvent});
  vm.runInContext(document.getElementById('familyInitialView').textContent,context);
  const initialView=document.body.dataset.initialView;
  vm.runInContext(homeSource,context);
  if(portal)vm.runInContext(portalSource,context);
  if(extended)vm.runInContext(hubSource,context);
  vm.runInContext(source,context);
  const flush=()=>{let now=performance.now();while(frames.length)frames.shift()(now+=16);};
  flush();
  const bounds=id=>{
    const key=original?id:id===data.root?'u-root':id==='u-root'?'u-nakash-keha':id;
    const node=document.querySelector('#treeNodes [data-unit="'+key+'"]');
    assert.ok(node,'The founding parents remain in the tree: '+id);
    const [,x,y,scale]=/^translate\(([-\d.]+)px,([-\d.]+)px\) scale\(([-\d.]+)\)$/.exec(document.getElementById('treeWorld').style.transform).map(Number);
    return {x:x+(parseFloat(node.style.left)+parseFloat(node.style.width)/2)*scale,y:y+(parseFloat(node.style.top)+node.offsetHeight/2)*scale,width:parseFloat(node.style.width)*scale,height:node.offsetHeight*scale,scale};
  };
  return {document,window,data,flush,bounds,width,height,phone,initialView};
}

test('home launches select their first view before deferred scripts, then release it for normal navigation',()=>{
  for(const site of ['original','haim','yehuda','medina','extended','shlomo','zechariah','zechariah-tzadok','kehat']){
    for(const phone of [false,true])for(const hash of ['','#home']){
      const f=fixture(site,{phone,hash}),expected=phone||hash==='#home'?'home':'tree';
      assert.equal(f.initialView,expected==='home'?'home':undefined);
      assert.equal(f.window.FamilyApp.getView(),expected);
      assert.equal(f.document.getElementById('homeView').hidden,expected!=='home');
      assert.equal(f.document.getElementById('treeView').hidden,expected!=='tree');
      assert.equal(f.document.body.dataset.initialView,undefined,'Startup rules end after the application renders');
      f.window.FamilyApp.setView(expected==='home'?'tree':'home');
      assert.equal(f.document.getElementById('homeView').hidden,expected==='home');
      assert.equal(f.document.getElementById('treeView').hidden,expected==='tree');
    }
  }
});

test('explicit phone destinations never receive a temporary home screen',()=>{
  for(const hash of ['#tree','#tree/ruti','#gallery','#stories','#voices','#games']){
    const f=fixture('original',{phone:true,hash});
    assert.equal(f.initialView,undefined);
    assert.equal(f.window.FamilyApp.getView(),hash.slice(1).split('/')[0]);
    assert.equal(f.document.getElementById('homeView').hidden,true);
  }
});

function assertCentred(f,id){
  const bounds=f.bounds(id);
  assert.ok(Math.abs(bounds.x-f.width/2)<0.001,'The parents are horizontally centred');
  assert.ok(Math.abs(bounds.y-(f.height/2+(f.phone?14:0)))<0.001,'The parents are centred between the controls and the canvas hint');
  return bounds;
}

test('each additional family tree opens on its founding parents at a readable size on desktop and phone',()=>{
  for(const [site,id] of Object.entries(parents))for(const phone of [false,true])for(const text of [100,160]){
    const f=fixture(site,{phone,text});
    if(site==='zechariah'&&phone)f.document.getElementById('fullTreeButton').click();
    f.flush();
    const bounds=assertCentred(f,id);
    assert.ok(bounds.width<=f.width-31,'Every founding partner fits across the viewport');
    assert.ok(bounds.height<=f.height-79,'Their complete cards stay visible');
    assert.ok(bounds.scale>0.4,'Large descendant trees do not shrink the opening to a miniature');
    if(['haim','yehuda','medina','keha'].includes(site)){
      assert.equal(f.document.querySelector('#branchBar [aria-pressed="true"]').dataset.branch,site);
      assert.equal(f.document.getElementById('treeBreadcrumb').textContent,f.data.branches.find(branch=>branch.id===site).title);
      assert.ok(f.document.getElementById('overviewButton').closest('.workspace-header'));
    }
    if(['shlomo','zechariah','zechariah-tzadok','kehat'].includes(site)){
      assert.ok(f.document.getElementById('overviewButton').closest('.workspace-header'));
      assert.equal(f.document.getElementById('treeGuideButton'),null);
      const title=site==='kehat'?'האילן המשפחתי של סעדיה (ג׳ימעאן) בן אהרון':site==='zechariah-tzadok'?'האילן המשפחתי של זכריה בן צדוק':'האילן המשפחתי';
      assert.equal(f.document.getElementById('workspaceTitle').textContent,title);
    }
  }
});

test('each marriage focuses its couple and descendants, and a second press restores both families without changing the shared graph',()=>{
  for(const site of ['kehat','zechariah-tzadok'])for(const phone of [false,true])for(const english of [false,true])for(const text of [100,160]){
    const f=fixture(site,{phone,english,text}),root=parents[site];
    const originalUnits=structuredClone(f.data.units),visible=()=>[...new Set([...f.document.querySelectorAll('#treeNodes [data-person-card]')].map(card=>card.dataset.personCard))].sort();
    const allPeople=visible(),initialScale=f.bounds(root).scale,buttons=[...f.document.querySelectorAll('#treeMarriageFilters button')];
    assert.equal(buttons.length,site==='kehat'?3:2);assert.ok(buttons.every(button=>button.getAttribute('aria-pressed')==='false'));
    assert.match(buttons[0].textContent,site==='kehat'?(english?/Shoshana/:/שושנה/):(english?/Amna/:/אמנה/));
    assert.match(buttons[1].textContent,site==='kehat'?(english?/Miriam/:/מרים/):(english?/Tzinia/:/ציניה/));
    for(const index of [0,1]){
      buttons[index].click();f.flush();
      assert.equal(buttons[index].getAttribute('aria-pressed'),'true');assert.equal(buttons[1-index].getAttribute('aria-pressed'),'false');
      const union=f.data.units[root].relationships[index],expected=new Set(union.people),seen=new Set();
      const visit=id=>{if(seen.has(id))return;seen.add(id);const unit=f.data.units[id];
        if(site==='kehat'&&unit.parent==='u-kehat-zechariah'){expected.add(unit.people[0]);return;}
        unit.people.forEach(person=>expected.add(person));unit.children.forEach(visit);};
      union.children.forEach(visit);
      assert.deepEqual(visible(),[...expected].sort(),site+': only the selected couple and their complete descendant branch');
      const centred=assertCentred(f,root);
      if(phone)assert.ok(centred.scale>initialScale,'Focusing one marriage enlarges its parents');
      const lines=[...f.document.querySelectorAll('#treeConnectors [data-parent-unit="'+root+'"]')];
      assert.equal(lines.length,1);assert.equal(lines[0].dataset.parentPeople,union.people.join(' '));
      assert.deepEqual(f.data.units,originalUnits,'Canvas filtering never edits canonical family relationships');
    }
    if(site==='kehat'){
      buttons[2].click();f.flush();
      assert.equal(buttons[2].getAttribute('aria-pressed'),'true');
      const ids=visible();
      for(const id of ['kehat-zechariah','tri-yona','tri-shifra','tri-anat','tri-hanania','tri-shuki','tri-hana-adi'])assert.ok(ids.includes(id),id);
      assert.ok(!ids.includes('kehat-aharon'));
      assertCentred(f,'u-kehat-zechariah');
      buttons[2].click();f.flush();
    }else{buttons[1].click();f.flush();}
    assert.deepEqual(visible(),allPeople);assert.ok(buttons.every(button=>button.getAttribute('aria-pressed')==='false'));
    assert.deepEqual(f.data.units,originalUnits);
    assertCentred(f,root);
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

test('the original family site retains its family overview and uses the shared header controls',()=>{
  for(const phone of [false,true]){
    const f=fixture('original',{phone}),bounds=f.bounds('u-root');
    assert.equal(f.document.querySelector('#branchBar [aria-pressed="true"]').dataset.branch,'all');
    assert.equal(f.document.querySelectorAll('#treeNodes [data-open-branch]').length,6);
    assert.ok(f.document.getElementById('overviewButton').closest('.workspace-header'));
    assert.ok(bounds.y<f.height/2,'The original founding parents stay above the overview branches');
    if(!phone)assert.equal(bounds.scale,0.7);
  }
});

test('phone family overviews balance six and four branches on the two sides without clipping later rows',()=>{
  for(const [site,count,columns] of [['original',6,3],['shlomo',6,3],['nakash',4,2]])for(const text of [100,160]){
    const f=fixture(site,{phone:true,text});
    assert.equal(f.data.branches.length,count);
    assert.equal(f.document.getElementById('branchBar').style.getPropertyValue('--branch-columns'),String(columns));
    const root=f.bounds(f.data.root),sides={right:[],left:[]};
    for(const branch of f.data.branches){
      const bounds=f.bounds(branch.unit);
      sides[bounds.x>root.x?'right':'left'].push(bounds);
      assert.equal(f.document.querySelector('#treeConnectors [data-child-unit="'+branch.unit+'"]').dataset.childPerson,f.data.units[branch.unit].people[0]);
    }
    assert.equal(sides.right.length,Math.ceil(count/2));assert.equal(sides.left.length,Math.floor(count/2));
    for(const side of Object.values(sides))for(let index=1;index<side.length;index++){
      assert.ok(side[index].y-side[index].height/2>side[index-1].y+side[index-1].height/2,'Rows leave room below the previous family');
    }
    const worldHeight=parseFloat(f.document.getElementById('treeWorld').style.height);
    for(const node of f.document.querySelectorAll('#treeNodes .tree-unit'))assert.ok(parseFloat(node.style.top)+node.offsetHeight<worldHeight,'Every family fits inside the pannable canvas');
    for(const branch of f.data.branches){
      f.document.querySelector('#branchBar [data-branch="'+branch.id+'"]').click();f.flush();
      assert.equal(f.document.querySelector('#branchBar [aria-pressed="true"]').dataset.branch,branch.id);
      assert.equal(f.document.getElementById('treeViewport').dataset.overview,'false');
      f.document.getElementById('overviewButton').click();f.flush();
      assert.equal(f.document.querySelectorAll('#treeNodes [data-open-branch]').length,count,'The header restores all branches');
    }
  }
});

test('Zechariah’s five top buttons switch households directly while the phone canvas contains only profiles and family links',()=>{
  const expected=[
    ['kadya',"מש' קדיה מזרחי",'Kadya Mizrahi family','right'],
    ['saadia',"מש' סעדיה קהא",'Saadia Keha family','right'],
    ['shalom',"מש' שלום קהא",'Shalom Keha family','left'],
    ['boaz',"מש' בועז קהא",'Boaz Keha family','right'],
    ['aharon',"מש' אהרון חובשי",'Aharon Hovshi family','left'],
  ];
  for(const [viewportWidth,viewportHeight,text,english] of [[300,390,100,false],[358,560,100,false],[400,620,160,true]]){
    const f=fixture('zechariah',{phone:true,viewportWidth,viewportHeight,text,english});
    const nodes=f.document.getElementById('treeNodes'),bar=f.document.getElementById('branchBar');
    const buttons=()=>[...bar.querySelectorAll('button[data-tree-unit]')];
    assert.equal(bar.hidden,false);
    assert.equal(bar.previousElementSibling.classList.contains('workspace-header'),true);
    assert.equal(bar.style.getPropertyValue('--branch-columns'),'3');
    assert.deepEqual(buttons().map(b=>b.textContent),expected.map(row=>row[english?2:1]));
    assert.equal(new Set(buttons().map(b=>b.style.getPropertyValue('--branch-color'))).size,5);
    assert.ok(buttons().every(button=>button.getAttribute('aria-controls')==='treeViewport'));
    assert.equal(nodes.querySelectorAll('[data-open-branch],.family-diamond').length,0);
    assert.equal(nodes.querySelectorAll('[data-unit="u-saadia-kadya"] [data-person]').length,1);
    assert.equal(nodes.querySelectorAll('[data-unit="u-saadia-aharon"] [data-person]').length,2);
    const parentLink=f.document.querySelector('#treeConnectors [data-partner-unit="'+f.data.root+'"]');
    assert.ok(parentLink,'Zechariah and Yehudit have a visible couple connection');
    const trunk=f.document.querySelector('#treeConnectors .phone-family-trunk');
    const [,trunkX,trunkY]=/^M([\d.]+) ([\d.]+)/.exec(trunk.getAttribute('d'));
    assert.equal(trunkY,/^M[\d.]+ ([\d.]+)/.exec(parentLink.getAttribute('d'))[1],'The trunk starts at the parents’ couple connection');
    const previous={};
    for(const [key,,,side] of expected){
      const id='u-saadia-'+key,card=f.bounds(id);
      assert.equal(card.x>f.width/2?'right':'left',side);
      assert.ok(card.x-card.width/2>=0&&card.x+card.width/2<=f.width);
      assert.ok(card.y-card.height/2>=68&&card.y+card.height/2<=f.height-40);
      assert.ok(!previous[side]||previous[side]<card.y-card.height/2);
      previous[side]=card.y+card.height/2;
      const path=f.document.querySelector('#treeConnectors [data-child-unit="'+id+'"]');
      assert.equal(path.dataset.parentUnit,f.data.units[id].parent);
      assert.equal(path.dataset.overviewRoot,f.data.root);
      const [,startX,endX,endY]=/^M([\d.]+) [\d.]+H([\d.]+)V([\d.]+)$/.exec(path.getAttribute('d'));
      assert.equal(startX,trunkX,'Each household branches directly from the common trunk');
      const unit=nodes.querySelector('[data-unit="'+id+'"]');
      assert.equal(Number(endY),parseFloat(unit.style.top)-1);
      if(f.data.units[id].people.length>1){
        const center=parseFloat(unit.style.left)+parseFloat(unit.style.width)/2;
        assert.ok(side==='right'?Number(endX)<center:Number(endX)>center,'The branch reaches the child beside the trunk, with their spouse outside');
        assert.ok(f.document.querySelector('#treeConnectors [data-partner-unit="'+id+'"]'),'Each known spouse has a short couple connection');
      }
      assert.equal(path.getAttribute('stroke-dasharray')!==null,key==='aharon');
    }
    // No return to the overview is needed between the five selections.
    for(const [key,he,en] of expected){
      const id='u-saadia-'+key;
      bar.querySelector('[data-tree-unit="'+id+'"]').click();f.flush();
      const selected=bar.querySelector('[aria-pressed="true"]');
      assert.equal(selected.dataset.treeUnit,id);assert.equal(selected.textContent,english?en:he);
      assert.equal(bar.hidden,false);assert.equal(buttons().length,5);
      assertCentred(f,id);
      for(const child of f.data.units[id].children)assert.ok(nodes.querySelector('[data-unit="'+child+'"]'));
      if(key==='boaz'){
        assert.equal(nodes.querySelector('[data-unit="u-saadia-dalia"]'),null);
        assert.equal(nodes.querySelector('[data-unit="'+id+'"] .branch-label').textContent,english?en:he);
      }
      if(key==='aharon')assert.ok(nodes.querySelector('[data-person="saadia-yona-hovshi"]'));
    }
    f.document.getElementById('fullTreeButton').click();f.flush();
    assert.equal(bar.hidden,false);
    assert.ok(nodes.querySelector('[data-unit="u-saadia-israel"]'));
    assert.ok(nodes.querySelector('[data-unit="u-saadia-boaz"]'));
    f.document.getElementById('overviewButton').click();f.flush();
    assert.equal(nodes.querySelectorAll('.phone-family-card').length,6);
    f.window.FamilyApp.setView('home');f.window.FamilyApp.setView('tree');f.flush();
    assert.equal(buttons().length,5);assert.equal(bar.hidden,false);
  }
});

function cameraPosition(f){
  return /^translate\(([-\d.]+)px,([-\d.]+)px\) scale\(([-\d.]+)\)$/.exec(f.document.getElementById('treeWorld').style.transform).slice(1).map(Number);
}
function pointer(f,type,{id=1,x=120,y=160,time=100,pointerType='touch'}={}){
  const event=new f.document.defaultView.Event(type,{bubbles:true,cancelable:true});
  for(const [key,value]of Object.entries({pointerId:id,pointerType,button:0,clientX:x,clientY:y,timeStamp:time}))Object.defineProperty(event,key,{value});
  f.document.getElementById('treeViewport').dispatchEvent(event);
}

function frameBounds(f){
  const frame=f.document.querySelector('#treeConnectors .tree-boundary rect');
  const number=name=>Number(frame.getAttribute(name));
  return {left:number('x'),top:number('y'),width:number('width'),height:number('height')};
}

function zoomIntoMiddle(f){
  f.document.getElementById('fitButton').click();
  const {width,height}=frameBounds(f);
  for(let i=0;i<30;i++){
    const scale=cameraPosition(f)[2];
    if(width*scale>f.width+120&&height*scale>f.height+120)break;
    f.document.getElementById('zoomIn').click();
  }
}

test('phone swipes pan the original and public trees in both axes in overview and full-tree modes',()=>{
  for(const site of ['original',...Object.keys(parents)])for(const mode of ['overviewButton','fullTreeButton']){
    const f=fixture(site,{phone:true});f.document.getElementById(mode).click();f.flush();
    zoomIntoMiddle(f);
    const before=cameraPosition(f);
    pointer(f,'pointerdown');pointer(f,'pointermove',{x:140,y:190,time:116});
    const after=cameraPosition(f);
    assert.ok(after[0]>before[0]+5,site+' pans horizontally in '+mode);
    assert.ok(after[1]>before[1]+5,site+' pans vertically in '+mode);
    assert.equal(after[2],before[2],'One-finger panning retains the scale');
    pointer(f,'pointercancel');
  }
});

test('a pinch can continue as a vertical one-finger drag in the phone overview',()=>{
  for(const site of ['original','nakash','zechariah']){
    const f=fixture(site,{phone:true});
    zoomIntoMiddle(f);
    const before=cameraPosition(f);
    pointer(f,'pointerdown',{x:100,y:160});pointer(f,'pointerdown',{id:2,x:180,y:160,time:108});
    pointer(f,'pointermove',{id:2,x:210,y:160,time:124});
    assert.ok(cameraPosition(f)[2]>before[2]);
    pointer(f,'pointerup',{id:2,x:210,y:160,time:140});
    const pinched=cameraPosition(f);
    pointer(f,'pointermove',{x:100,y:190,time:156});
    assert.ok(cameraPosition(f)[1]>pinched[1]+5,'The remaining finger keeps moving the tree vertically');
    pointer(f,'pointercancel');
  }
});

test('card borders and drag limits follow each displayed tree on desktop and phone',()=>{
  for(const site of ['original',...Object.keys(parents)])for(const phone of [false,true]){
    const f=fixture(site,{phone});
    const pointerType=phone?'touch':'mouse';
    zoomIntoMiddle(f);
    const frame=frameBounds(f);
    const cards=[...f.document.querySelectorAll('#treeNodes .tree-unit')].map(unit=>{
      const left=parseFloat(unit.style.left),top=parseFloat(unit.style.top);
      return {left,top,right:left+parseFloat(unit.style.width),bottom:top+unit.offsetHeight};
    });
    assert.equal(frame.left,Math.min(...cards.map(card=>card.left))-16);
    assert.equal(frame.top,Math.min(...cards.map(card=>card.top))-16);
    assert.equal(frame.left+frame.width,Math.max(...cards.map(card=>card.right))+16);
    assert.equal(frame.top+frame.height,Math.max(...cards.map(card=>card.bottom))+16);
    for(const [dx,dy] of [[1,1],[-1,1],[-1,-1],[1,-1]]){
      pointer(f,'pointerdown',{pointerType});
      pointer(f,'pointermove',{x:dx*100000,y:dy*100000,pointerType,time:116});
      const [x,y,s]=cameraPosition(f);
      assert.ok(cards.some(card=>x+card.right*s>0&&x+card.left*s<f.width&&y+card.bottom*s>0&&y+card.top*s<f.height),site+' keeps a card visible at the corner');
      pointer(f,'pointermove',{x:dx*200000,y:dy*200000,pointerType,time:132});
      assert.deepEqual(cameraPosition(f),[x,y,s],site+' stops at its outermost cards');
      const arrow=new f.document.defaultView.Event('keydown',{cancelable:true});
      arrow.key=dy===1?'ArrowUp':'ArrowDown';
      f.document.getElementById('treeViewport').dispatchEvent(arrow);
      assert.deepEqual(cameraPosition(f),[x,y,s],'The keyboard shares the drag limits');
      pointer(f,'pointermove',{x:dx*200000,y:dy*(200000-24),pointerType,time:148});
      assert.ok((y-cameraPosition(f)[1])*dy>5,site+' immediately reverses a drag at the limit');
      pointer(f,'pointercancel',{pointerType});
    }
    f.document.getElementById('fitButton').click();
    const [x,y,s]=cameraPosition(f);
    assert.ok(x+frame.left*s>=0&&x+(frame.left+frame.width)*s<=f.width);
    assert.ok(y+frame.top*s>=0&&y+(frame.top+frame.height)*s<=f.height);
  }
});

test('marriage filters replace the frame and stop at the selected descendants',()=>{
  for(const site of ['kehat','zechariah-tzadok'])for(const phone of [false,true]){
    const f=fixture(site,{phone}),whole=frameBounds(f);
    const buttons=[...f.document.querySelectorAll('#treeMarriageFilters [data-marriage-index]')];
    for(const button of buttons){
      button.click();f.flush();
      const frame=frameBounds(f);
      assert.ok(frame.width<whole.width);
      assert.equal(f.document.querySelectorAll('.tree-boundary').length,1);
      assertCentred(f,parents[site]);
    }
    buttons[1].click();f.flush();
    assert.deepEqual(frameBounds(f),whole);
  }
});

test('phone momentum stops at the last generation and extended hub branches use the same frame',()=>{
  for(const branch of ['kehat','yissachar']){
    const f=fixture('extended',{phone:true,hash:'#tree/'+branch});
    assert.ok(f.document.querySelector('#treeConnectors .tree-boundary'));
    zoomIntoMiddle(f);
    pointer(f,'pointerdown');pointer(f,'pointermove',{x:120,y:-350,time:116});
    pointer(f,'pointerup',{x:120,y:-350,time:124});f.flush();
    const afterFlick=cameraPosition(f),frame=frameBounds(f);
    const bottom=()=>cameraPosition(f)[1]+(frame.top+frame.height)*cameraPosition(f)[2];
    assert.ok(bottom()>=f.height/2,'Inertia leaves the last generation in view');
    pointer(f,'pointerdown');pointer(f,'pointermove',{x:120,y:-100000,time:140});
    const limit=cameraPosition(f);
    assert.ok(afterFlick[1]>=limit[1]);
    pointer(f,'pointerup',{x:120,y:-100000,time:148});f.flush();
    assert.deepEqual(cameraPosition(f),limit,'Releasing at the boundary cannot coast past it');
  }
});

function wheel(f,deltaX,deltaY,options={}){
  const event=new f.document.defaultView.Event('wheel',{cancelable:true});
  Object.assign(event,{deltaMode:0,deltaX,deltaY,clientX:23,clientY:74,...options});
  f.document.getElementById('treeViewport').dispatchEvent(event);
  return event;
}

test('vertical scrolling stays on the page on desktop and moves the tree on phones',()=>{
  for(const phone of [true,false]){
    const f=fixture('haim',{phone}),before=cameraPosition(f),event=wheel(f,15,30);
    const after=cameraPosition(f);
    assert.equal(event.defaultPrevented,phone);
    if(phone){assert.ok(after[0]<before[0]);assert.ok(after[1]<before[1]);}
    else assert.deepEqual(after,before);
  }
});

test('horizontal trackpad gestures pan in both directions on desktop without zooming or drifting vertically',()=>{
  for(const site of ['original','haim','kehat']){
    const f=fixture(site);
    zoomIntoMiddle(f);
    const [x,y,scale]=cameraPosition(f);
    assert.ok(wheel(f,37,3).defaultPrevented);
    assert.deepEqual(cameraPosition(f),[x-37,y,scale]);
    assert.ok(wheel(f,-37,0).defaultPrevented);
    assert.deepEqual(cameraPosition(f),[x,y,scale]);
    wheel(f,2,0,{deltaMode:1});
    assert.deepEqual(cameraPosition(f),[x-32,y,scale]);
  }
});

function assertFittedTree(f){
  const viewport=f.document.getElementById('treeViewport'),frame=frameBounds(f);
  const top=f.phone?68:0,bottom=f.phone?40:0,height=viewport.clientHeight-top-bottom;
  const [x,y,scale]=cameraPosition(f),width=viewport.clientWidth;
  const expected=Math.min((width-16)/frame.width,(height-16)/frame.height);
  assert.ok(Math.abs(scale-expected)<1e-8,'One dimension of the displayed frame fills the available space');
  assert.ok(Math.abs(x+(frame.left+frame.width/2)*scale-width/2)<1e-6);
  assert.ok(Math.abs(y+(frame.top+frame.height/2)*scale-top-height/2)<1e-6);
  assert.ok(f.document.getElementById('zoomOut').disabled);
  return cameraPosition(f);
}

test('zoom-out stops at the centred fit for the current overview, full tree, branch and selected marriage',()=>{
  for(const phone of [false,true]){
    for(const site of ['original','haim','zechariah','kehat']){
      const f=fixture(site,{phone}),byId=id=>f.document.getElementById(id);
      const views=[byId('overviewButton'),byId('fullTreeButton')];
      const branch=f.document.querySelector('#branchBar [data-branch="medina"],#branchBar [data-tree-unit]');
      if(branch)views.push(branch);
      views.push(...f.document.querySelectorAll('#treeMarriageFilters button'));
      for(const view of views){
        view.click();f.flush();
        for(let i=0;i<45&&!byId('zoomOut').disabled;i++)byId('zoomOut').click();
        const fit=assertFittedTree(f);
        byId('zoomIn').click();
        assert.equal(byId('zoomOut').disabled,false);
        const key=new f.document.defaultView.Event('keydown',{cancelable:true});
        key.key='-';byId('treeViewport').dispatchEvent(key);byId('treeViewport').dispatchEvent(key);
        assert.deepEqual(cameraPosition(f),fit);
        byId('zoomIn').click();
        wheel(f,0,40,{ctrlKey:true});wheel(f,0,40,{ctrlKey:true});
        assert.deepEqual(cameraPosition(f),fit,'An off-centre trackpad pinch ends on the complete tree');
        byId('fitButton').click();wheel(f,45,0);
        assert.deepEqual(cameraPosition(f),fit);
      }
    }
    const f=fixture('haim',{phone});
    f.document.getElementById('fitButton').click();
    const fit=assertFittedTree(f);
    f.document.getElementById('zoomIn').click();
    pointer(f,'pointerdown',{x:20});pointer(f,'pointerdown',{id:2,x:260});
    pointer(f,'pointermove',{id:2,x:30});
    assert.deepEqual(cameraPosition(f),fit,'A two-finger touchscreen pinch reaches the same centred limit');
  }
});

test('a fitted tree follows viewport changes and can still zoom in when its fit exceeds 100%',()=>{
  let notify;
  const observed=new Set();
  class ResizeObserver{
    constructor(callback){notify=callback;}
    observe(node){observed.add(node);}
    disconnect(){observed.clear();}
  }
  const f=fixture('original',{ResizeObserver,viewportWidth:7000,viewportHeight:3000});
  const viewport=f.document.getElementById('treeViewport');
  assert.ok(observed.has(viewport));
  assert.ok(assertFittedTree(f)[2]>2.4,'A small tree opens at its fitted size even on a very large display');
  f.document.getElementById('zoomIn').click();
  assert.equal(f.document.getElementById('zoomOut').disabled,false);
  f.document.getElementById('fitButton').click();
  for(const [width,height] of [[920,420],[1600,900],[800,1100]]){
    Object.defineProperties(viewport,{clientWidth:{value:width},clientHeight:{value:height}});
    notify([{target:viewport}]);
    assertFittedTree(f);
  }
});

test('a short phone canvas keeps the fitted tree visible below a compact toolbar',()=>{
  for(const site of ['original','haim','zechariah']){
    for(const [viewportWidth,viewportHeight] of [[358,60],[172,80]]){
      const f=fixture(site,{phone:true,viewportWidth,viewportHeight});
      assert.ok(f.document.getElementById('treeViewport').hasAttribute('data-compact-tree-controls'));
      f.document.getElementById('fitButton').click();
      const [x,y,scale]=cameraPosition(f),frame=frameBounds(f);
      assert.ok(y+frame.top*scale>=30&&y+(frame.top+frame.height)*scale<=viewportHeight);
      assert.ok(x+frame.left*scale>=0&&x+(frame.left+frame.width)*scale<=viewportWidth);
      assert.ok(frame.height*scale>8,'The toolbar leaves room to display the generations');
    }
  }
});

test('phone founding parents fit below the toolbar in a short viewport, including enlarged text',()=>{
  for(const site of ['haim','shlomo','zechariah','zechariah-tzadok','kehat'])for(const text of [100,160]){
    const f=fixture(site,{phone:true,viewportHeight:240,text}),card=f.bounds(parents[site]);
    assert.ok(card.y-card.height/2>=56,'The toolbar does not cover the founding parents');
    assert.ok(card.y+card.height/2<=f.height-20,'The complete founding cards remain visible');
  }
});
