import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';
import {browserHistory,navigationSource} from './helpers/browser-history.mjs';

const source=await readFile(new URL('../public/assets/family-documents.js',import.meta.url),'utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture({historyNavigation=false,href='https://family.test/#home',confirm:confirmDiscard=()=>true}={}){
  const {document,window:dom}=parseHTML('<html><body data-active-view="tree"><section id="documentsView" hidden></section></body></html>');
  const browser=historyNavigation?browserHistory(href):null,location=browser?.location||new URL(href);
  const listeners=new Map(),confirmations=[],uploads=[],removals=[],previews=[],revoked=[],items=[{id:'a'.repeat(32),name:'תעודת עלייה',filename:'certificate.png',kind:'document',mime:'image/png',src:'/media/a',caption:'הסריקה המקורית',personIds:['yona'],tags:[{id:'yona',name:'יונה קהא'}]},{id:'b'.repeat(32),name:'הקלטה נדירה',filename:'rare.mp3',kind:'audio',mime:'audio/mpeg',src:'/media/b',personIds:['shlomo'],tags:[{id:'shlomo',name:'שלמה קהא'}]}];
  const window={FamilyI18n:{isEnglish:false,error:v=>v,personName:p=>p.name,fetch:async(path,options)=>{
    if(options?.method==='POST'){
      if(options.headers?.['X-Family-Token']!=='test-token')return Response.json({error:'יש לרענן את הדף לפני שמירת השינוי.'},{status:403});
      const body=JSON.parse(options.body);removals.push({path,body,headers:options.headers});
      if(body.password!=='owner-test')return Response.json({error:'הסיסמה אינה נכונה.'},{status:401});
      items.splice(items.findIndex(item=>path.includes(item.id)),1);return Response.json({deleted:true});
    }
    return Response.json({items,people:[{id:'yona',name:'יונה קהא'},{id:'shlomo',name:'שלמה קהא'}]});
  }},FAMILY_API_TOKEN:'test-token'};
  class XHR{constructor(){this.upload={};this.headers={};}open(method,url){this.method=method;this.url=url;}setRequestHeader(key,value){this.headers[key]=value;}send(file){uploads.push({file,url:this.url,headers:this.headers});this.status=201;this.responseText='{"saved":true}';queueMicrotask(()=>this.onload());}}
  const objectURL={createObjectURL(file){previews.push(file);return 'blob:captured-'+previews.length;},revokeObjectURL(url){revoked.push(url);}};
  window.addEventListener=browser?.addEventListener||((type,fn)=>listeners.set(type,fn));window.confirm=message=>{confirmations.push(message);return confirmDiscard(message);};
  const context=vm.createContext({window,document,location,history:browser?.history,matchMedia:()=>({matches:true}),XMLHttpRequest:XHR,Response,CustomEvent:dom.CustomEvent,URL:Object.assign(class extends URL{},objectURL)});
  if(browser)vm.runInContext(navigationSource,context);
  vm.runInContext(source,context);
  if(browser)window.addEventListener('popstate',()=>window.FamilyDocuments.activate(location.hash.slice(1).split('/')[0]));
  for(const node of document.querySelectorAll('select'))Object.defineProperty(node,'value',{writable:true,value:'all'});
  for(const node of document.querySelectorAll('dialog')){node.showModal=function(){this.open=true;};node.close=function(){this.open=false;this.dispatchEvent(new dom.Event('close'));};}
  document.getElementById('documentForm').reset=()=>{};
  Object.defineProperty(document.getElementById('documentFile'),'files',{configurable:true,value:[]});
  Object.defineProperty(document.getElementById('documentCamera'),'files',{configurable:true,value:[]});
  return {document,dom,window,browser,location,uploads,removals,items,previews,revoked,confirmations,listeners};
}
test('document photo uploads confirm before closing a changed form and preserve the captured photo when staying',async()=>{
 let leave=false;const f=fixture({confirm:()=>leave});f.window.FamilyDocuments.activate('documents');await tick();f.document.getElementById('newDocument').click();
 const editor=f.document.getElementById('documentEditor'),close=editor.querySelector('[data-document-close]');close.click();assert.equal(f.confirmations.length,0);assert.equal(editor.open,false);
 const camera=f.document.getElementById('documentCamera'),photo={name:'scan.jpg',type:'image/jpeg'};Object.defineProperty(camera,'files',{value:[photo]});camera.dispatchEvent(new f.dom.Event('change'));await tick();
 close.click();assert.equal(editor.open,true);assert.match(f.confirmations[0],/השינויים לא נשמרו/);assert.equal(f.document.getElementById('documentCaptureImage').getAttribute('src'),'blob:captured-1');assert.equal(f.revoked.length,0);
 const escape=new f.dom.Event('cancel',{cancelable:true});editor.dispatchEvent(escape);assert.equal(escape.defaultPrevented,true);
 let guarded=false;f.listeners.get('beforeunload')({preventDefault(){guarded=true;}});assert.equal(guarded,true);
 leave=true;close.click();assert.equal(editor.open,false);assert.equal(f.revoked.length,1);assert.equal(f.uploads.length,0);
});
test('the archive filters real documents and audio, searches descriptions, and opens the original image',async()=>{
  const f=fixture();f.window.FamilyDocuments.activate('documents');await tick();
  assert.equal(f.document.querySelectorAll('.document-card').length,2);assert.ok(f.document.querySelector('audio[controls]'));
  f.document.querySelector('[data-document-kind=audio]').click();assert.equal(f.document.querySelectorAll('.document-card').length,1);assert.match(f.document.getElementById('documentGrid').textContent,/הקלטה נדירה/);
  f.document.querySelector('[data-document-kind=all]').click();f.window.FamilyDocuments.search('הסריקה המקורית');assert.equal(f.document.querySelectorAll('.document-card').length,1);
  f.document.querySelector('[data-document-open]').click();assert.equal(f.document.getElementById('documentViewer').open,true);assert.equal(f.document.querySelector('#documentViewerBody img').getAttribute('src'),'/media/a');
  f.window.FamilyDocuments.activate('tree');assert.equal(f.document.getElementById('documentsView').hidden,true);
});

test('Back closes scanned records and audio before leaving the archive and Forward restores their contents',async()=>{
  for(const kind of ['document','audio']){
    const f=fixture({historyNavigation:true});f.window.FamilyNavigation.go('#documents');f.window.FamilyDocuments.activate('documents');await tick();
    f.document.querySelector('[data-document-kind='+kind+']').click();f.document.querySelector('[data-document-open]').click();
    const item=f.items.find(item=>item.kind===kind),length=f.browser.history.length;
    assert.equal(f.location.hash,'#documents/'+item.id);assert.equal(f.document.getElementById('documentViewer').open,true);
    f.browser.history.back();await tick();assert.equal(f.location.hash,'#documents');assert.equal(f.document.getElementById('documentViewer').open,false);assert.equal(f.document.querySelectorAll('.document-card').length,1);
    f.browser.history.forward();await tick();assert.equal(f.document.getElementById('documentViewer').open,true);assert.equal(f.document.getElementById('documentViewerTitle').textContent,item.name);assert.equal(f.browser.history.length,length);
    f.document.querySelector('#documentViewer [data-document-close]').click();await tick();assert.equal(f.location.hash,'#documents');
    f.browser.history.back();await tick();assert.equal(f.location.hash,'#home');
  }
});
test('adding a record requires a subject and sends the unmodified file with its title and attribution',async()=>{
  const f=fixture();f.window.FamilyDocuments.activate('documents');await tick();f.document.getElementById('newDocument').click();
  assert.equal(f.document.getElementById('documentEditor').open,true);
  const submit=()=>f.document.getElementById('documentForm').dispatchEvent(new f.dom.Event('submit',{bubbles:true,cancelable:true}));
  submit();assert.match(f.document.getElementById('documentError').textContent,/בחרו לפחות אדם/);assert.equal(f.uploads.length,0);
  const original={name:'original.pdf',size:200};Object.defineProperty(f.document.getElementById('documentFile'),'files',{value:[original]});
  f.document.getElementById('documentTitle').value='תעודה מקורית';f.document.getElementById('documentCaption').value='המסמך מבית המשפחה';f.document.querySelector('#documentPeople input[value=yona]').setAttribute('checked','');
  submit();await tick();assert.equal(f.uploads.length,1);assert.equal(f.uploads[0].file,original);assert.equal(f.uploads[0].headers['X-Family-Token'],'test-token');
  assert.deepEqual(JSON.parse(decodeURIComponent(f.uploads[0].headers['X-Family-Document'])),{title:'תעודה מקורית',caption:'המסמך מבית המשפחה',personIds:['yona']});
  assert.equal(f.document.getElementById('documentEditor').open,false);
});
test('the camera opens immediately and its photo is previewed and uploaded as the selected document',async()=>{
  const f=fixture(),camera=f.document.getElementById('documentCamera');let opened=0;camera.click=()=>{opened++;};
  assert.equal(camera.getAttribute('capture'),'environment');assert.match(camera.getAttribute('accept'),/image\/jpeg/);
  f.document.getElementById('captureDocument').click();assert.equal(opened,1);assert.notEqual(f.document.getElementById('documentEditor').open,true);
  const photo={name:'camera-document.jpg',size:800,type:'image/jpeg'};Object.defineProperty(camera,'files',{value:[photo]});camera.dispatchEvent(new f.dom.Event('change'));await tick();
  assert.equal(f.document.getElementById('documentEditor').open,true);assert.equal(f.document.getElementById('documentFile').required,false);assert.equal(f.document.getElementById('documentCapturePreview').hidden,false);assert.equal(f.document.getElementById('documentCaptureImage').getAttribute('src'),'blob:captured-1');assert.equal(f.previews[0],photo);
  f.document.getElementById('documentTitle').value='מסמך שצולם בטלפון';f.document.querySelector('#documentPeople input[value=yona]').setAttribute('checked','');
  f.document.getElementById('documentForm').dispatchEvent(new f.dom.Event('submit',{bubbles:true,cancelable:true}));await tick();assert.equal(f.uploads.length,1);assert.equal(f.uploads[0].file,photo);assert.match(f.uploads[0].url,/filename=camera-document.jpg/);assert.equal(JSON.parse(decodeURIComponent(f.uploads[0].headers['X-Family-Document'])).title,'מסמך שצולם בטלפון');assert.deepEqual(f.revoked,['blob:captured-1']);
});
test('selecting another file replaces a captured photo and cancelling the camera does not open an empty editor',async()=>{
  const f=fixture(),camera=f.document.getElementById('documentCamera');camera.dispatchEvent(new f.dom.Event('change'));await tick();assert.notEqual(f.document.getElementById('documentEditor').open,true);
  const photo={name:'capture.jpg',size:300};Object.defineProperty(camera,'files',{value:[photo]});camera.dispatchEvent(new f.dom.Event('change'));await tick();
  const original={name:'certificate.pdf',size:900},file=f.document.getElementById('documentFile');Object.defineProperty(file,'files',{value:[original]});file.dispatchEvent(new f.dom.Event('change'));
  assert.equal(file.required,true);assert.equal(f.document.getElementById('documentCapturePreview').hidden,true);assert.deepEqual(f.revoked,['blob:captured-1']);
  f.document.querySelector('#documentPeople input[value=yona]').setAttribute('checked','');f.document.getElementById('documentForm').dispatchEvent(new f.dom.Event('submit',{bubbles:true,cancelable:true}));await tick();assert.equal(f.uploads[0].file,original);
});
test('compact recording thumbnails open a player and closing it stops playback',async()=>{
  const f=fixture();f.window.FamilyDocuments.activate('documents');await tick();f.document.querySelector('.document-recording-preview').click();
  assert.equal(f.document.getElementById('documentViewer').open,true);const audio=f.document.querySelector('#documentViewerBody audio');assert.equal(audio.getAttribute('src'),'/media/b');assert.ok(audio.hasAttribute('controls'));let paused=0;audio.pause=()=>{paused++;};f.document.getElementById('documentViewer').close();assert.equal(paused,1);assert.equal(f.document.querySelector('#documentViewerBody audio'),null);
});

test('each record has a password dialog; a rejected deletion keeps the record and clears the password',async()=>{
  const f=fixture();f.window.FamilyDocuments.activate('documents');await tick();
  assert.equal(f.document.querySelectorAll('[data-document-delete]').length,2);
  f.document.querySelector('[data-document-delete]').click();
  assert.equal(f.document.getElementById('documentRemoval').open,true);
  const submit=()=>f.document.getElementById('documentRemovalForm').dispatchEvent(new f.dom.Event('submit',{bubbles:true,cancelable:true}));
  submit();await tick();assert.equal(f.removals.length,0);
  f.document.getElementById('documentRemovalPassword').value='incorrect';submit();await tick();
  assert.equal(f.removals.length,1);assert.equal(f.removals[0].headers['X-Family-Token'],'test-token');
  assert.equal(f.document.querySelectorAll('.document-card').length,2);
  assert.match(f.document.getElementById('documentRemovalError').textContent,/הסיסמה אינה נכונה/);
  assert.equal(f.document.getElementById('documentRemovalPassword').value,'');
  f.document.getElementById('documentRemovalPassword').value='owner-test';submit();await tick();
  assert.equal(f.document.querySelectorAll('.document-card').length,1);
  assert.equal(f.document.getElementById('documentRemoval').open,false);
  assert.equal(f.document.getElementById('documentRemovalPassword').value,'');
});
