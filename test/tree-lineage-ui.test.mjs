import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';
import family from '../src/family.mjs';
import {branchPortalHTML} from '../src/extended-keha.mjs';
import {createBranchPortal} from '../public/keha-extended/branch-portals.mjs';
import {toOriginalFamilyData} from '../public/nakash/tree-data-adapter.mjs';

const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
const source=await readFile(new URL('../public/assets/app.js',import.meta.url),'utf8');
const dateSource=await readFile(new URL('../public/assets/dates.js',import.meta.url),'utf8');
function fixture(portal,{phone=false,english=false,text=100,unitHeight=0,overview=false,overrides={}}={}){
  const {document,window:dom}=parseHTML(branchPortalHTML(html,portal));
  Object.defineProperty(dom.HTMLElement.prototype,'offsetHeight',{configurable:true,get(){return this.classList?.contains('tree-unit')?unitHeight:0;}});
  const data=toOriginalFamilyData(createBranchPortal(family,portal));
  for(const [id,patch] of Object.entries(overrides))Object.assign(data.people[id],patch);
  const window={LOCAL_FAMILY_SERVER:true,FAMILY_DATA:data,addEventListener(){},dispatchEvent(){},scrollTo(){},FamilyAccessibility:{getSettings:()=>({text})}};
  window.FamilyI18n={isEnglish:english,t:v=>v,html:(parts,...values)=>parts.reduce((out,part,index)=>out+part+(values[index]??''),''),personName:p=>english?(p.nameEn||p.englishName||p.name):p.name,branchName:b=>b?.title,searchNames:p=>p.name,date:v=>v};
  vm.runInNewContext(dateSource,{window,document,navigator:{userAgent:'Desktop'}});
  vm.runInNewContext(source,{window,document,location:{hash:'#tree'},history:{pushState(){}},matchMedia:q=>({matches:phone&&q.includes('700px')}),fetch:()=>new Promise(()=>{}),requestAnimationFrame(){},cancelAnimationFrame(){},setInterval(){},innerWidth:phone?390:1280,innerHeight:900,CustomEvent:dom.CustomEvent});
  if(!overview)document.getElementById('fullTreeButton').click();
  const card=id=>document.querySelector('#treeNodes [data-person-card="'+id+'"]');
  const role=id=>card(id).querySelector('[data-tree-role]');
  function incoming(id){
    const path=document.querySelector('#treeConnectors [data-child-person="'+id+'"]');
    assert.ok(path,'The ancestor branch reaches '+id);
    const unit=document.querySelector('#treeNodes [data-unit="'+path.dataset.childUnit+'"]');
    const middle=parseFloat(unit.style.left)+parseFloat(unit.style.width)/2;
    return {path,middle,x:Number(/^M(-?[\d.]+)/.exec(path.getAttribute('d'))[1])};
  }
  return {document,window,data,card,role,incoming};
}

test('each parent branch reaches its own child and labels the spouse on either side of an RTL or English tree',()=>{
  for(const phone of [false,true])for(const english of [false,true])for(const text of [100,160]){
    const f=fixture('kehat',{phone,english,text});
    assert.equal(f.role('kehat-aharon').textContent,english?'Son of Saadia':'בן של סעדיה');
    assert.equal(f.role('kehat-aharon-saida').textContent,english?'Wife of Aharon':'אשתו של אהרון');
    assert.equal(f.role('kehat-aharon-saida').dataset.treeRole,'partner');
    assert.equal(f.role('kehat-aharon').dataset.rolePerson,'kehat-jidaan');
    const child=f.incoming('kehat-aharon');
    assert.ok(english?child.x<child.middle:child.x>child.middle,'The line ends over Aharon’s portrait, away from the couple’s midpoint');
    assert.equal(f.document.querySelector('#treeConnectors [data-child-person="kehat-aharon-saida"]'),null,'Saida never acquires Saadia as a parent');
    assert.equal(f.role('kehat-hadassah').textContent,english?'Daughter of Saadia':'בת של סעדיה');
    const t=fixture('zechariah-tzadok',{phone,english,text});
    assert.equal(t.role('kehat-yaakov-yehudit').textContent,english?'Daughter of Zechariah':'בת של זכריה');
    assert.equal(t.role('kehat-yaakov').textContent,english?'Husband of Yehudit':'בעלה של יהודית');
    const daughter=t.incoming('kehat-yaakov-yehudit');
    assert.ok(english?daughter.x<daughter.middle:daughter.x>daughter.middle,'The same couple connects through Yehudit in her own parents’ branch');
    assert.equal(t.role('kehat-ron').textContent,english?'Grandson of Tzadok':'נכד של צדוק');
    assert.equal(t.role('kehat-shori').dataset.treeRole,'descendant','An unmarried daughter remains a daughter');
  }
});

test('female silhouettes follow the recorded gender, actual portraits survive updates, and unknown gender stays neutral',()=>{
  for(const phone of [false,true]){
    const f=fixture('kehat',{phone});
    assert.ok(f.card('kehat-aharon-saida').querySelector('svg.silhouette-female[data-placeholder-gender=f]'));
    assert.ok(f.card('kehat-aharon').querySelector('svg[data-placeholder-gender=m]'));
    assert.equal(f.card('kehat-aharon-saida').querySelector('.profile-photo'),null);
    f.window.FamilyApp.updatePerson('kehat-aharon-saida',{profile:'/media/original-family-portrait.jpg'});
    assert.equal(f.card('kehat-aharon-saida').querySelector('.profile-photo').getAttribute('src'),'/media/original-family-portrait.jpg');
    f.window.FamilyApp.updatePerson('kehat-aharon-saida',{profile:null});
    assert.equal(f.card('kehat-aharon-saida').querySelector('.profile-photo'),null);
    assert.ok(f.card('kehat-aharon-saida').querySelector('svg.silhouette-female'));
    const neutral=fixture('kehat',{phone,overrides:{'kehat-aharon-saida':{gender:''}}});
    assert.ok(neutral.card('kehat-aharon-saida').querySelector('svg[data-placeholder-gender=unknown]'),'A name does not determine gender');
    assert.equal(neutral.role('kehat-aharon-saida').textContent,'בן/בת זוג של אהרון');
  }
});

test('adoption labels preserve the recorded adoptive relationship rather than inventing a biological parent',()=>{
  const f=fixture('zechariah');
  assert.equal(f.role('saadia-aharon').textContent,'בן מאומץ של זכריה');
  assert.equal(f.role('saadia-yona-hovshi').textContent,'אשתו של אהרון');
});

test('Hebrew life dates keep each pencil before its own label and retain historical ranges and uncertain evidence',()=>{
  for(const phone of [false,true])for(const text of [100,150,200]){
    const f=fixture('kehat',{phone,text});
    const birth=f.card('kehat-jidaan').querySelector('.birthday-line');
    const death=f.card('kehat-jidaan').querySelector('[data-tree-death-year]');
    assert.equal(birth.firstElementChild.dataset.editBirthday,'kehat-jidaan');
    assert.equal(death.firstElementChild.dataset.editDeath,'kehat-jidaan');
    assert.match(birth.querySelector('.tree-date-value').textContent,/לידה: 1870–1877/);
    assert.match(death.querySelector('.tree-date-value').textContent,/פטירה: 1962/);
    const candidate=f.card('tri-yona').querySelector('[data-tree-death-year]');
    assert.ok(candidate.hasAttribute('data-year-candidate'));
    assert.equal(candidate.querySelector('[data-edit-death]'),null,'Unconfirmed evidence is not silently promoted to an editable confirmed date');
    assert.match(candidate.textContent,/1985/);
    assert.doesNotMatch(candidate.textContent,/\?/);
    assert.ok(candidate.getAttribute('title'));
  }
});

test('tall date cards reserve actual content height before the next generation and connectors end at the repositioned child',()=>{
  for(const phone of [false,true])for(const unitHeight of [350,700]){
    const f=fixture('kehat',{phone,text:200,unitHeight});
    for(const path of f.document.querySelectorAll('#treeConnectors .descendant-connector')){
      const child=f.document.querySelector('[data-unit="'+path.dataset.childUnit+'"]');
      const childTop=parseFloat(child.style.top),d=path.getAttribute('d');
      const [,middle,end]=/^M[-\d.]+ ([-\d.]+)V([-\d.]+)$/.exec(d);
      assert.equal(Number(end),childTop-14);
      assert.ok(Number(middle)<Number(end),'Sibling lines stay above the next portraits');
    }
    for(const unit of Object.values(f.data.units))for(const childId of unit.children){
      const parent=f.document.querySelector('[data-unit="'+(unit.id===f.data.root?'u-root':unit.id)+'"]');
      const child=f.document.querySelector('[data-unit="'+childId+'"]');
      if(parent&&child)assert.ok(parseFloat(child.style.top)>=parseFloat(parent.style.top)+unitHeight+144,'No generation overlaps the preceding dates');
    }
  }
});

test('compact family overview uses card widths for every displayed spouse instead of squeezing three portraits into a two-person frame',()=>{
  for(const phone of [false,true])for(const text of [100,200]){
    const f=fixture('kehat',{phone,text,overview:true,unitHeight:300});
    for(const unit of f.document.querySelectorAll('#treeNodes .tree-unit')){
      const count=unit.querySelectorAll('.person-card').length;
      assert.ok(parseFloat(unit.style.width)>=(count*(phone?136:146)+Math.max(0,count-1)*(phone?14:28))*text/100);
    }
  }
});
