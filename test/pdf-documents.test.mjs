import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {parseHTML} from 'linkedom';

const source=await readFile(new URL('../public/assets/pdf-documents.js',import.meta.url),'utf8');
const tick=async()=>{for(let n=0;n<12;n++)await new Promise(resolve=>setImmediate(resolve));};
const item={src:'/media/'+'a'.repeat(32)+'?version=original',filename:'תעודה.pdf',name:'תעודה משפחתית',mime:'application/pdf'};
function fixture({branch,english=false,nativeShare,error=false,delayed=false,clipboard=true}={}){
  const {document,window:dom}=parseHTML('<html><body><main id="host"></main></body></html>');
  if(branch){document.documentElement.dataset.nakashBranch=branch;document.documentElement.dataset.nakashHome='/keha-extended/'+branch+'/';document.documentElement.dataset.nakashOrigin='https://family.example';}
  const requests=[],renders=[],destroyed=[],copied=[],shared=[],observers=[],pending=[];
  const create=document.createElement.bind(document);
  document.createElement=tag=>{
    const node=create(tag);
    if(tag==='canvas'){node.getContext=()=>({});node.toDataURL=()=> 'data:image/webp;base64,thumbnail';}
    if(tag==='dialog'){node.showModal=()=>{node.open=true;};node.close=()=>{node.open=false;node.dispatchEvent(new dom.Event('close'));};}
    return node;
  };
  const pdfLibrary={GlobalWorkerOptions:{},getDocument(options){
    requests.push(options);const id=requests.length;
    const pdf={numPages:3,async getPage(number){return {getViewport:({scale})=>({width:600*scale,height:800*scale}),render({canvas,viewport}){renders.push({id,number,canvas,viewport});let complete;const promise=delayed?new Promise(resolve=>{complete=resolve;pending.push(resolve);}):Promise.resolve();return {promise,cancel(){complete?.();}};},async getTextContent(){return {items:[{str:'Document '+id+' page '+number,hasEOL:true}]};}};}};
    return {promise:error?Promise.reject(Error('Missing document')):Promise.resolve(pdf),destroy:async()=>{destroyed.push(id);}};
  }};
  const location=new URL('https://family.example/'+(branch?'keha-extended/'+branch+'/':'')+'?media=old#person/yona');
  const history={state:{},replaceState(state,_,url){location.href=String(url);}};
  const navigator={...(clipboard?{clipboard:{writeText:async value=>{copied.push(value);}}}:{}),...(nativeShare?{share:async data=>{shared.push(data);if(nativeShare==='cancel')throw Object.assign(Error(),{name:'AbortError'});}}:{})};
  class Observer{constructor(callback){this.callback=callback;this.nodes=[];observers.push(this);}observe(node){this.nodes.push(node);}unobserve(node){this.nodes=this.nodes.filter(value=>value!==node);}}
  const window={devicePixelRatio:2,FamilyI18n:{isEnglish:english,language:english?'en':'he'},testPdfLibrary:async()=>pdfLibrary};
  vm.runInNewContext(source.replace("import(assetRoot+'pdf.mjs')",'window.testPdfLibrary()'),{document,window,location,history,navigator,URL,IntersectionObserver:Observer,setTimeout,clearTimeout});
  return {document,dom,api:window.FamilyPDF,requests,renders,destroyed,copied,shared,observers,pending,host:document.getElementById('host'),location};
}

test('PDF detection covers MIME, attachment names and URLs, and rejects foreign sources',()=>{
  const f=fixture();assert.equal(f.api.isPDF(item),true);assert.equal(f.api.isPDF({name:'attachment.PDF'}),true);assert.equal(f.api.isPDF({name:'Historical record',src:'/records/example.pdf?x=1'}),true);assert.equal(f.api.isPDF({filename:'record.docx'}),false);
  assert.equal(f.api.open({...item,src:'https://other.example/record.pdf'}),false);assert.equal(f.api.open({...item,src:'javascript:alert(1)'}),false);
});
test('the embedded reader renders pages, validates page numbers and zooms without a native PDF plugin',async()=>{
  const f=fixture();f.api.mount(f.host,item);await tick();
  assert.equal(f.renders.length,1);assert.equal(f.renders[0].number,1);assert.match(f.host.querySelector('.pdf-page-total').textContent,/3/);assert.ok(f.host.querySelector('canvas'));assert.equal(f.host.querySelector('iframe'),null);
  const download=new URL(f.host.querySelector('[data-pdf-download]').href);assert.equal(download.searchParams.get('download'),'1');assert.equal(download.searchParams.has('inline'),false);assert.equal(download.searchParams.get('version'),'original');
  assert.equal(f.host.querySelector('[data-pdf-action=previous]').disabled,true);
  f.host.querySelector('[data-pdf-action=next]').click();await tick();assert.equal(f.renders.at(-1).number,2);
  const before=f.renders.at(-1).viewport.width;f.host.querySelector('[data-pdf-action=in]').click();await tick();assert.ok(f.renders.at(-1).viewport.width>before);
  f.host.querySelector('[data-pdf-action=fit]').click();await tick();assert.equal(f.renders.at(-1).viewport.width,before);
  const input=f.host.querySelector('.pdf-page-number');input.value='200';input.dispatchEvent(new f.dom.Event('change'));assert.equal(input.value,'2');
  input.value='3';input.dispatchEvent(new f.dom.Event('change'));await tick();assert.equal(f.host.querySelector('[data-pdf-action=next]').disabled,true);assert.match(f.host.querySelector('.pdf-reader-text p').textContent,/page 3/);
  f.api.unmount(f.host);await tick();assert.deepEqual(f.destroyed,[1]);
});
test('switching documents cancels old work and never paints an obsolete page',async()=>{
  const f=fixture({delayed:true});f.api.mount(f.host,item);await tick();assert.equal(f.pending.length,1);
  f.api.mount(f.host,{...item,src:'/media/'+'b'.repeat(32)});await tick();
  for(const resolve of f.pending)resolve();await tick();
  assert.equal(f.host.querySelectorAll('canvas').length,1);assert.equal(f.host.querySelector('canvas'),f.renders.at(-1).canvas);assert.deepEqual(f.destroyed,[1]);f.api.unmount(f.host);
});
test('missing PDFs retain working download and share controls with a readable error',async()=>{
  const f=fixture({error:true});f.api.mount(f.host,item);await tick();
  assert.match(f.host.querySelector('.pdf-reader-status').textContent,/לא ניתן לפתוח/);assert.ok(f.host.querySelector('[data-pdf-download]').href);
  f.host.querySelector('[data-pdf-action=share]').click();await tick();assert.equal(f.copied.length,1);
});
test('shared links retain the family origin, scope and document identity and reopen inside the site',async()=>{
  const f=fixture({branch:'zechariah-tzadok',nativeShare:true});f.api.mount(f.host,item);await tick();
  f.host.querySelector('[data-pdf-action=share]').click();await tick();assert.equal(f.shared.length,1);
  const url=new URL(f.shared[0].url);assert.equal(url.origin,'https://family.example');assert.equal(url.pathname,'/keha-extended/zechariah-tzadok/');assert.equal(url.hash,'#documents');assert.equal(url.searchParams.has('media'),false);
  const src=new URL(url.searchParams.get('pdf'),url);assert.equal(src.pathname,new URL(item.src,url).pathname);assert.equal(src.searchParams.get('familyScope'),'zechariah-tzadok');assert.equal(src.searchParams.has('download'),false);
  assert.equal(new URL(f.requests[0].url).searchParams.get('familyScope'),'zechariah-tzadok');assert.equal(url.searchParams.get('pdfTitle'),item.name);
});
test('cancelling native sharing does not copy a link; unavailable clipboard exposes a manual link',async()=>{
  const f=fixture({nativeShare:'cancel'});f.api.mount(f.host,item);await tick();f.host.querySelector('[data-pdf-action=share]').click();await tick();assert.equal(f.copied.length,0);assert.equal(f.host.querySelector('.pdf-share-fallback').hidden,true);
  const fallback=fixture({clipboard:false});fallback.api.mount(fallback.host,item);await tick();const input=fallback.host.querySelector('.pdf-share-fallback');input.select=()=>{};fallback.host.querySelector('[data-pdf-action=share]').click();await tick();assert.equal(input.hidden,false);assert.equal(new URL(input.value).searchParams.get('pdfName'),item.filename);
});
test('first-page previews are lazy, cached and released after rendering',async()=>{
  const f=fixture();f.host.innerHTML=f.api.preview(item);f.api.scan(f.host);await tick();assert.equal(f.requests.length,0);
  const observer=f.observers[0];observer.callback(observer.nodes.map(target=>({target,isIntersecting:true})));await tick();assert.equal(f.requests.length,1);assert.ok(f.host.querySelector('.pdf-thumbnail img'));assert.deepEqual(f.destroyed,[1]);
  f.host.innerHTML=f.api.preview(item);f.api.scan(f.host);observer.callback(observer.nodes.map(target=>({target,isIntersecting:true})));await tick();assert.equal(f.requests.length,1);assert.ok(f.host.querySelector('.pdf-thumbnail img'));
});
test('existing PDF attachments open in the reader while explicit download links stay downloads',async()=>{
  const f=fixture();f.host.innerHTML=`<a id="legacy" href="${item.src}" download="record.pdf">record.pdf</a><a id="download" data-pdf-download href="${item.src}&download=1" download="record.pdf">Download</a>`;f.api.scan(f.host);
  const link=f.host.querySelector('#legacy');assert.equal(link.hasAttribute('download'),false);assert.ok(link.querySelector('[data-pdf-thumbnail]'));assert.equal(f.host.querySelector('#download').hasAttribute('download'),true);
  link.click();await tick();assert.equal(f.document.getElementById('pdfDocumentViewer').open,true);assert.ok(f.document.querySelector('#pdfDocumentViewer canvas'));
});

function samplePDF(){
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>'];
  for(const label of ['FIRST PAGE','SECOND PAGE']){
    const stream='BT /F1 30 Tf 40 180 Td ('+label+') Tj ET';
    objects.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 240] /Resources << /Font << /F1 7 0 R >> >> /Contents '+(objects.length+2)+' 0 R >>','<< /Length '+stream.length+' >>\nstream\n'+stream+'\nendstream');
  }
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  let text='%PDF-1.4\n';const offsets=[0];for(const [index,body]of objects.entries()){offsets.push(text.length);text+=(index+1)+' 0 obj\n'+body+'\nendobj\n';}
  const xref=text.length;text+='xref\n0 '+(objects.length+1)+'\n0000000000 65535 f \n'+offsets.slice(1).map(offset=>String(offset).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size '+(objects.length+1)+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF';return new TextEncoder().encode(text);
}
test('the packaged Mozilla renderer reads and rasterizes both pages of a real PDF',async()=>{
  const {getDocument}=await import('../public/assets/pdfjs/6.5.438/pdf.mjs');
  const {createCanvas}=await import('@napi-rs/canvas');
  const task=getDocument({data:samplePDF(),standardFontDataUrl:fileURLToPath(new URL('../public/assets/pdfjs/6.5.438/standard_fonts/',import.meta.url))});
  try{const pdf=await task.promise;assert.equal(pdf.numPages,2);
    for(let number=1;number<=2;number++){const page=await pdf.getPage(number),viewport=page.getViewport({scale:1}),canvas=createCanvas(viewport.width,viewport.height);await page.render({canvas,canvasContext:canvas.getContext('2d'),viewport}).promise;const text=await page.getTextContent();assert.match(text.items.map(item=>item.str).join(' '),number===1?/FIRST PAGE/:/SECOND PAGE/);assert.ok(canvas.toBuffer('image/png').length>2000);}
  }finally{await task.destroy();}
});
