import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
import {photoDate,photoAge,photoDateText} from '../public/assets/photo-date.mjs';

const root=new URL('../',import.meta.url);
const html=await readFile(new URL('public/index.html',root),'utf8');
const sources=await Promise.all(['photo-collections.js','photo-viewer-layout.js','photo-moments.js'].map(async name=>(await readFile(new URL('public/assets/'+name,root),'utf8')).replace(/^import[^\n]+\n/,'')));
const expected=['names','regions','ages','date','family','review','edit'];

function fixture(english=false,scope='gallery'){
  const {window,document}=parseHTML(html),$=id=>document.getElementById(id);
  Object.defineProperty(document,'readyState',{value:'complete'});
  const create=document.createElement.bind(document);
  document.createElement=tag=>{const node=create(tag);if(tag==='dialog'){node.showModal=()=>{node.open=true;};node.close=()=>{node.open=false;node.dispatchEvent(new window.Event('close'));};}return node;};
  window.HTMLElement.prototype.focus=function(){document.activeElement=this;};
  let current={id:'first',kind:'photo',scope:'gallery',collections:['gallery'],takenDate:{year:1980}},controller;
  const viewer=$('mediaViewer');viewer.open=true;viewer.setAttribute('data-media-scope',scope);$('editOpenedPhoto').hidden=false;
  window.FamilyI18n={isEnglish:english,locale:english?'en-US':'he-IL',personName:person=>person?.name||'',error:String};
  window.FamilyApp={apiEnabled:true};window.FamilyMedia={current:()=>current};
  const context=vm.createContext({window,document,navigator:{userAgent:'Android Mobile'},matchMedia:query=>({matches:query.includes('max-width'),addEventListener(){}}),photoDate,photoAge,photoDateText,CustomEvent:window.CustomEvent});
  for(const source of sources)vm.runInContext(source,context);
  const api=window.FamilyPhotoViewerLayout;
  function controls(){
    return [...$('mediaPhotoIcons').querySelectorAll('button,a')].filter(node=>!node.hidden).map(node=>node.dataset.photoControlPlaceholder||node.dataset.photoAlbumKind||({togglePhotoNames:'names',togglePhotoAges:'ages',editPhotoDate:'date',editOpenedPhoto:'edit'})[node.id]||(node.classList.contains('face-regions-toggle')?'regions':node.classList.contains('face-review-button')?'review':'unknown'));
  }
  function select(id,takenDate={},extra={}){
    const previous=controller;current={id,kind:'photo',scope:'gallery',collections:['gallery'],takenDate,...extra};
    if(previous)api.faceControls(null,previous);
    $('mediaStage').replaceChildren();
    window.FamilyPhotoCollections.mountViewer($('mediaViewerCollections'),current,scope);
    window.FamilyPhotoDate.mount(current);api.sync();return current;
  }
  function ready({review=true}={}){
    const regionsButton=create('button');regionsButton.className='face-regions-toggle';regionsButton.innerHTML='<svg viewBox="0 0 24 24"><rect width="20" height="20"/></svg>';
    const reviewButton=review?create('button'):null;if(reviewButton){reviewButton.className='face-review-button';reviewButton.innerHTML='<svg viewBox="0 0 24 24"><path d="m4 12 5 5 10-12"/></svg>';}
    $('mediaStage').before(regionsButton);if(reviewButton)$('mediaViewerTitle').append(reviewButton);
    controller={dialog:viewer,item:{...current},regionsButton,reviewButton};api.faceControls(controller);return controller;
  }
  return {window,document,$,viewer,api,controls,select,ready,get current(){return current;}};
}

test('year-only and year/month dates have an editable check and retain the calendar control in both languages',()=>{
  for(const english of [false,true]){
    const f=fixture(english);
    for(const takenDate of [{year:1980},{year:1980,month:6},{year:1980,month:6,day:16},{}]){
      f.select('date-'+JSON.stringify(takenDate),takenDate);
      assert.deepEqual(f.controls(),expected);
      const check=f.$('photoDateSaved');
      assert.equal(Boolean(check&&!check.hidden),Boolean(takenDate.year));
      if(!takenDate.year)continue;
      assert.match(check.getAttribute('aria-label'),/1980/);check.click();
      assert.equal(f.$('photoDateDialog').open,true);
      for(const field of ['day','month','year'])assert.equal(String(f.$('photoDate'+field).value),String(takenDate[field]??''));
      f.$('photoDateDialog').close();
    }
  }
});

test('rapid photo changes keep the same seven controls while face metadata is pending or unavailable',()=>{
  const f=fixture();
  for(let n=0;n<50;n++){
    f.select('photo-'+n,n%3?{year:1980,month:6}:{});
    assert.deepEqual(f.controls(),expected,'pending photo '+n);
    for(const kind of ['regions','review'])assert.equal(f.$('mediaPhotoIcons').querySelector('[data-photo-control-placeholder="'+kind+'"]').disabled,true);
    f.ready({review:n%2===0});assert.deepEqual(f.controls(),expected,'ready photo '+n);
    assert.equal(f.$('mediaPhotoIcons').querySelectorAll('[data-photo-album-kind="family"]').length,1);
  }
});

test('each album keeps all its toolbar icons across dated and undated photos',()=>{
  for(const scope of ['gallery','photos','personal:owner','wedding:event','nursery:owner','nostalgia','family-ai','living-family']){
    const f=fixture(false,scope);f.select('start');const order=f.controls();
    assert.ok(expected.every(kind=>order.includes(kind)),scope);
    for(let n=0;n<8;n++){
      f.select(scope+'-'+n,n%2?{year:1991}:{});assert.deepEqual(f.controls(),order,scope);
      f.ready({review:n%2===0});assert.deepEqual(f.controls(),order,scope);
    }
  }
});

test('late callbacks cannot replace the next photo controls and interrupted metadata can repair the current toolbar',()=>{
  const f=fixture(),old=f.ready();f.select('new',{year:1992});const next=f.ready();
  f.api.faceControls(old);assert.equal(f.$('mediaPhotoIcons').querySelector('.face-regions-toggle'),next.regionsButton);
  f.$('mediaViewerCollections').replaceChildren();f.$('photoMomentTools').replaceChildren();f.api.sync();
  assert.deepEqual(f.controls(),expected);assert.match(f.$('editPhotoDate').getAttribute('aria-label'),/1992/);
  assert.equal(f.$('mediaViewerCollections').querySelector('.photo-collections').dataset.collectionPhoto,'new');
});

test('closing or visiting video and fullscreen restores the photo controls without duplicates',()=>{
  const f=fixture();f.ready();
  f.viewer.classList.add('photo-fullscreen');f.api.sync();f.viewer.classList.remove('photo-fullscreen');f.api.sync();assert.deepEqual(f.controls(),expected);
  f.select('film',{}, {kind:'video'});assert.equal(f.viewer.classList.contains('photo-controls-below'),false);
  f.select('again',{year:2001});f.ready();assert.deepEqual(f.controls(),expected);
  f.viewer.open=false;f.viewer.dispatchEvent(new f.window.Event('close'));f.viewer.open=true;f.select('reopened');assert.deepEqual(f.controls(),expected);
});
