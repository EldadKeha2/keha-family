import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';

const source=await readFile(new URL('../public/assets/family-documents.js',import.meta.url),'utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(){
  const {document,window:dom}=parseHTML('<html><body data-active-view="tree"><section id="documentsView" hidden></section></body></html>');
  const uploads=[],removals=[],items=[{id:'a'.repeat(32),name:'תעודת עלייה',filename:'certificate.png',kind:'document',mime:'image/png',src:'/media/a',caption:'הסריקה המקורית',personIds:['yona'],tags:[{id:'yona',name:'יונה קהא'}]},{id:'b'.repeat(32),name:'הקלטה נדירה',filename:'rare.mp3',kind:'audio',mime:'audio/mpeg',src:'/media/b',personIds:['shlomo'],tags:[{id:'shlomo',name:'שלמה קהא'}]}];
  const window={FamilyI18n:{isEnglish:false,error:v=>v,personName:p=>p.name,fetch:async(path,options)=>{
    if(options?.method==='POST'){
      const body=JSON.parse(options.body);removals.push({path,body});
      if(body.password!=='owner-test')return Response.json({error:'הסיסמה אינה נכונה.'},{status:401});
      items.splice(items.findIndex(item=>path.includes(item.id)),1);return Response.json({deleted:true});
    }
    return Response.json({items,people:[{id:'yona',name:'יונה קהא'},{id:'shlomo',name:'שלמה קהא'}]});
  }},FAMILY_API_TOKEN:'test-token'};
  class XHR{constructor(){this.upload={};this.headers={};}open(method,url){this.method=method;this.url=url;}setRequestHeader(key,value){this.headers[key]=value;}send(file){uploads.push({file,url:this.url,headers:this.headers});this.status=201;this.responseText='{"saved":true}';queueMicrotask(()=>this.onload());}}
  vm.runInNewContext(source,{window,document,XMLHttpRequest:XHR,Response,CustomEvent:dom.CustomEvent});
  for(const node of document.querySelectorAll('select'))Object.defineProperty(node,'value',{writable:true,value:'all'});
  for(const node of document.querySelectorAll('dialog')){node.showModal=function(){this.open=true;};node.close=function(){this.open=false;};}
  document.getElementById('documentForm').reset=()=>{};
  Object.defineProperty(document.getElementById('documentFile'),'files',{configurable:true,value:[]});
  return {document,dom,window,uploads,removals,items};
}
test('the archive filters real documents and audio, searches descriptions, and opens the original image',async()=>{
  const f=fixture();f.window.FamilyDocuments.activate('documents');await tick();
  assert.equal(f.document.querySelectorAll('.document-card').length,2);assert.ok(f.document.querySelector('audio[controls]'));
  f.document.querySelector('[data-document-kind=audio]').click();assert.equal(f.document.querySelectorAll('.document-card').length,1);assert.match(f.document.getElementById('documentGrid').textContent,/הקלטה נדירה/);
  f.document.querySelector('[data-document-kind=all]').click();f.window.FamilyDocuments.search('הסריקה המקורית');assert.equal(f.document.querySelectorAll('.document-card').length,1);
  f.document.querySelector('[data-document-open]').click();assert.equal(f.document.getElementById('documentViewer').open,true);assert.equal(f.document.querySelector('#documentViewerBody img').getAttribute('src'),'/media/a');
  f.window.FamilyDocuments.activate('tree');assert.equal(f.document.getElementById('documentsView').hidden,true);
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

test('each record has a password dialog; a rejected deletion keeps the record and clears the password',async()=>{
  const f=fixture();f.window.FamilyDocuments.activate('documents');await tick();
  assert.equal(f.document.querySelectorAll('[data-document-delete]').length,2);
  f.document.querySelector('[data-document-delete]').click();
  assert.equal(f.document.getElementById('documentRemoval').open,true);
  const submit=()=>f.document.getElementById('documentRemovalForm').dispatchEvent(new f.dom.Event('submit',{bubbles:true,cancelable:true}));
  submit();await tick();assert.equal(f.removals.length,0);
  f.document.getElementById('documentRemovalPassword').value='incorrect';submit();await tick();
  assert.equal(f.document.querySelectorAll('.document-card').length,2);
  assert.match(f.document.getElementById('documentRemovalError').textContent,/הסיסמה אינה נכונה/);
  assert.equal(f.document.getElementById('documentRemovalPassword').value,'');
  f.document.getElementById('documentRemovalPassword').value='owner-test';submit();await tick();
  assert.equal(f.document.querySelectorAll('.document-card').length,1);
  assert.equal(f.document.getElementById('documentRemoval').open,false);
  assert.equal(f.document.getElementById('documentRemovalPassword').value,'');
});
