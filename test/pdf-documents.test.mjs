import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {parseHTML} from 'linkedom';

const source=await readFile(new URL('../public/assets/pdf-documents.js',import.meta.url),'utf8');
const tick=async()=>{for(let n=0;n<12;n++)await new Promise(resolve=>setImmediate(resolve));};
const item={src:'/media/'+'a'.repeat(32)+'?version=original',filename:'תעודה.pdf',name:'תעודה משפחתית',mime:'application/pdf'};
function fixture({branch,english=false,nativeShare,error=false,delayed=false,clipboard=true,pageCount=3,mixedSizes=false,nativeRotation=0}={}){
  const {document,window:dom}=parseHTML('<html><body><main id="host"></main></body></html>');
  if(branch){document.documentElement.dataset.nakashBranch=branch;document.documentElement.dataset.nakashHome='/keha-extended/'+branch+'/';document.documentElement.dataset.nakashOrigin='https://family.example';}
  const requests=[],renders=[],destroyed=[],copied=[],shared=[],observers=[],pending=[],resizes=[],viewport={width:600,height:600};
  const create=document.createElement.bind(document);
  document.createElement=tag=>{
    const node=create(tag);
    Object.defineProperty(node,'clientWidth',{get:()=>node.classList.contains('pdf-page-scroll')?viewport.width:parseFloat(node.style.width)||viewport.width});
    Object.defineProperty(node,'clientHeight',{get:()=>node.classList.contains('pdf-page-scroll')?viewport.height:parseFloat(node.style.height)||viewport.height});
    node.getBoundingClientRect=()=>({left:0,top:0,width:node.clientWidth,height:node.clientHeight});
    if(tag==='canvas'){node.getContext=()=>({});node.toDataURL=()=> 'data:image/webp;base64,thumbnail';}
    if(tag==='dialog'){node.showModal=()=>{node.open=true;};node.close=()=>{node.open=false;node.dispatchEvent(new dom.Event('close'));};}
    return node;
  };
  const pdfLibrary={GlobalWorkerOptions:{},getDocument(options){
    requests.push(options);const id=requests.length;
    const pdf={numPages:pageCount,async getPage(number){return {rotate:nativeRotation,getViewport:({scale,rotation=nativeRotation})=>{const width=600,height=mixedSizes&&number===2?400:800;return {width:(rotation%180?height:width)*scale,height:(rotation%180?width:height)*scale,rotation};},render({canvas,viewport}){renders.push({id,number,canvas,viewport});let complete;const promise=delayed?new Promise(resolve=>{complete=resolve;pending.push(resolve);}):Promise.resolve();return {promise,cancel(){complete?.();}};},async getTextContent(){return {items:[{str:'Document '+id+' page '+number,hasEOL:true}]};},cleanup(){}};}};
    return {promise:error?Promise.reject(Error('Missing document')):Promise.resolve(pdf),destroy:async()=>{destroyed.push(id);}};
  }};
  const location=new URL('https://family.example/'+(branch?'keha-extended/'+branch+'/':'')+'?media=old#person/yona');
  const history={state:{},replaceState(state,_,url){location.href=String(url);}};
  const navigator={...(clipboard?{clipboard:{writeText:async value=>{copied.push(value);}}}:{}),...(nativeShare?{share:async data=>{shared.push(data);if(nativeShare==='cancel')throw Object.assign(Error(),{name:'AbortError'});}}:{})};
  class Observer{constructor(callback){this.callback=callback;this.nodes=[];observers.push(this);}observe(node){this.nodes.push(node);}unobserve(node){this.nodes=this.nodes.filter(value=>value!==node);}}
  class Resize{constructor(callback){this.callback=callback;resizes.push(this);}observe(){}disconnect(){}}
  const window={devicePixelRatio:2,FamilyI18n:{isEnglish:english,language:english?'en':'he'},testPdfLibrary:async()=>pdfLibrary,requestAnimationFrame:fn=>{queueMicrotask(fn);return 1;},cancelAnimationFrame(){}};
  vm.runInNewContext(source.replace("import(assetRoot+'pdf.mjs')",'window.testPdfLibrary()'),{document,window,location,history,navigator,URL,IntersectionObserver:Observer,ResizeObserver:Resize,setTimeout,clearTimeout});
  const mount=window.FamilyPDF.mount;
  window.FamilyPDF.mount=(host,item)=>{
    const dispose=mount(host,item),scroll=host.querySelector('.pdf-page-scroll');
    Object.defineProperty(scroll,'clientWidth',{get:()=>viewport.width});Object.defineProperty(scroll,'clientHeight',{get:()=>viewport.height});
    scroll.getBoundingClientRect=()=>({left:0,top:0,width:viewport.width,height:viewport.height});return dispose;
  };
  const fire=(node,type,values={})=>{const event=new dom.Event(type,{bubbles:true,cancelable:true});Object.assign(event,values);node.dispatchEvent(event);return event;};
  return {document,dom,api:window.FamilyPDF,requests,renders,destroyed,copied,shared,observers,pending,host:document.getElementById('host'),location,fire,resizes,viewport};
}

test('PDF detection covers MIME, attachment names and URLs, and rejects foreign sources',()=>{
  const f=fixture();assert.equal(f.api.isPDF(item),true);assert.equal(f.api.isPDF({name:'attachment.PDF'}),true);assert.equal(f.api.isPDF({name:'Historical record',src:'/records/example.pdf?x=1'}),true);assert.equal(f.api.isPDF({filename:'record.docx'}),false);
  assert.equal(f.api.open({...item,src:'https://other.example/record.pdf'}),false);assert.equal(f.api.open({...item,src:'javascript:alert(1)'}),false);
});
test('the reader lays out every page in order, scrolls to a page number and keeps download controls',async()=>{
  const f=fixture();f.api.mount(f.host,item);await tick();
  assert.deepEqual([...f.host.querySelectorAll('[data-pdf-page]')].map(node=>node.dataset.pdfPage),['1','2','3']);
  assert.equal(f.renders[0].number,1);assert.match(f.host.querySelector('.pdf-page-total').textContent,/3/);assert.ok(f.host.querySelector('canvas'));assert.equal(f.host.querySelector('iframe'),null);assert.equal(f.host.querySelector('[data-pdf-action=next]'),null);assert.equal(f.host.querySelector('[data-pdf-action=previous]'),null);
  const download=new URL(f.host.querySelector('[data-pdf-download]').href);assert.equal(download.searchParams.get('download'),'1');assert.equal(download.searchParams.has('inline'),false);assert.equal(download.searchParams.get('version'),'original');
  const input=f.host.querySelector('.pdf-page-number');input.value='200';f.fire(input,'change');assert.equal(input.value,'1');
  input.value='3';f.fire(input,'change');await tick();assert.ok(f.host.querySelector('[data-pdf-page="3"] canvas'));assert.match(f.host.querySelector('.pdf-reader-text p').textContent,/page 3/);
  const before=f.host.querySelector('[data-pdf-page="3"]').style.width;f.host.querySelector('[data-pdf-action=in]').click();await tick();assert.ok(parseFloat(f.host.querySelector('[data-pdf-page="3"]').style.width)>parseFloat(before));
  f.host.querySelector('[data-pdf-action=fit]').click();await tick();assert.equal(f.host.querySelector('[data-pdf-page="3"]').style.width,before);assert.equal(input.value,'3');
  f.api.unmount(f.host);await tick();assert.deepEqual(f.destroyed,[1]);
});
test('switching documents cancels old work and never paints an obsolete page',async()=>{
  const f=fixture({delayed:true});f.api.mount(f.host,item);await tick();assert.equal(f.pending.length,2);
  f.api.mount(f.host,{...item,src:'/media/'+'b'.repeat(32)});await tick();
  for(const resolve of f.pending)resolve();await tick();
  assert.equal(f.host.querySelectorAll('canvas').length,2);for(const canvas of f.host.querySelectorAll('canvas'))assert.equal(f.renders.find(render=>render.canvas===canvas).id,2);assert.deepEqual(f.destroyed,[1]);f.api.unmount(f.host);
});
test('long documents load only nearby pages, release distant canvases and track ordinary scrolling',async()=>{
  const f=fixture({pageCount:100});f.api.mount(f.host,item);await tick();
  assert.equal(f.host.querySelectorAll('[data-pdf-page]').length,100);assert.ok(f.renders.length<5);const old=f.host.querySelector('[data-pdf-page="1"] canvas');
  const scroll=f.host.querySelector('.pdf-page-scroll'),height=parseFloat(f.host.querySelector('.pdf-page-frame').style.height);scroll.scrollTop=12+9*(height+44);f.fire(scroll,'scroll');await tick();
  assert.equal(f.host.querySelector('.pdf-page-number').value,'10');assert.ok(f.host.querySelector('[data-pdf-page="10"] canvas'));assert.equal(old.width,0);assert.equal(old.height,0);assert.equal(f.host.querySelector('[data-pdf-page="1"] canvas'),null);assert.ok(f.host.querySelectorAll('canvas').length<6);
  f.host.querySelector('[data-pdf-action=in]').click();await tick();assert.equal(f.host.querySelector('.pdf-page-number').value,'10');f.api.unmount(f.host);
});
test('precision-pad pinch zooms around its point while plain wheel scrolling is left native',async()=>{
  const f=fixture();f.api.mount(f.host,item);await tick();const scroll=f.host.querySelector('.pdf-page-scroll'),row=f.host.querySelector('[data-pdf-page="1"]'),before=parseFloat(row.style.width),canvas=row.querySelector('canvas'),count=f.renders.length;
  const plain=f.fire(scroll,'wheel',{deltaY:120,deltaX:0,deltaMode:0,ctrlKey:false});assert.equal(plain.defaultPrevented,false);assert.equal(parseFloat(row.style.width),before);
  const pinch=f.fire(scroll,'wheel',{deltaY:-80,deltaMode:0,ctrlKey:true,clientX:240,clientY:240});assert.equal(pinch.defaultPrevented,true);assert.ok(parseFloat(row.style.width)>before);assert.equal(row.querySelector('canvas'),canvas);assert.equal(f.renders.length,count);assert.ok(scroll.scrollTop>0);
  await new Promise(resolve=>setTimeout(resolve,160));await tick();assert.ok(f.renders.length>count);assert.notEqual(row.querySelector('canvas'),canvas);
  f.fire(scroll,'wheel',{deltaY:80,deltaMode:0,ctrlKey:true,clientX:240,clientY:240});assert.ok(Math.abs(parseFloat(row.style.width)-before)<.01);f.api.unmount(f.host);
});
test('touch pinch expands and contracts the document without intercepting a single-finger scroll',async()=>{
  const f=fixture();f.api.mount(f.host,item);await tick();const scroll=f.host.querySelector('.pdf-page-scroll'),row=f.host.querySelector('[data-pdf-page="1"]'),before=parseFloat(row.style.width);
  const one=[{clientX:200,clientY:200}];assert.equal(f.fire(scroll,'touchstart',{touches:one}).defaultPrevented,false);assert.equal(f.fire(scroll,'touchmove',{touches:one}).defaultPrevented,false);
  const start=[{clientX:150,clientY:200},{clientX:250,clientY:200}],wide=[{clientX:100,clientY:200},{clientX:300,clientY:200}];
  assert.equal(f.fire(scroll,'touchstart',{touches:start}).defaultPrevented,true);assert.equal(f.fire(scroll,'touchmove',{touches:wide}).defaultPrevented,true);assert.equal(parseFloat(row.style.width),before*2);assert.equal(f.host.querySelector('.pdf-zoom-label').textContent,'200%');
  f.fire(scroll,'touchmove',{touches:start});assert.equal(parseFloat(row.style.width),before);f.fire(scroll,'touchend',{touches:[]});await tick();assert.ok(row.querySelector('canvas'));f.api.unmount(f.host);
});
test('Safari gestures and resize keep the reading position and honor zoom limits',async()=>{
  const f=fixture({pageCount:20,mixedSizes:true});f.api.mount(f.host,item);await tick();assert.equal(parseFloat(f.host.querySelector('[data-pdf-page="2"] .pdf-page-frame').style.height),384);
  const input=f.host.querySelector('.pdf-page-number');input.value='10';f.fire(input,'change');await tick();const scroll=f.host.querySelector('.pdf-page-scroll');
  const readingPoint=y=>{const rows=[...f.host.querySelectorAll('[data-pdf-page]')],top=12+rows.slice(0,9).reduce((sum,node)=>sum+parseFloat(node.querySelector('.pdf-page-frame').style.height)+44,0);return (scroll.scrollTop+y-top)/parseFloat(rows[9].querySelector('.pdf-page-frame').style.height);};
  const point=readingPoint(200);
  f.fire(scroll,'gesturestart',{clientX:200,clientY:200});f.fire(scroll,'gesturechange',{scale:30});assert.equal(f.host.querySelector('.pdf-zoom-label').textContent,'800%');f.fire(scroll,'gesturechange',{scale:.01});assert.equal(f.host.querySelector('.pdf-zoom-label').textContent,'50%');f.fire(scroll,'gestureend');await tick();
  assert.ok(Math.abs(readingPoint(200)-point)<.0001);const center=readingPoint(300);f.viewport.width=400;f.resizes[0].callback();await new Promise(resolve=>setTimeout(resolve,140));await tick();assert.ok(Math.abs(readingPoint(300)-center)<.0001);assert.ok(scroll.scrollTop>2000);assert.equal(parseFloat(f.host.querySelector('[data-pdf-page="10"]').style.width),188);f.api.unmount(f.host);
});
test('right and left rotation resize continuous pages, retain zoom and the reading area, and handle rapid turns',async()=>{
  const f=fixture({pageCount:30,mixedSizes:true});f.api.mount(f.host,item);await tick();
  const input=f.host.querySelector('.pdf-page-number');input.value='10';f.fire(input,'change');await tick();f.host.querySelector('[data-pdf-action=in]').click();await tick();
  const row=f.host.querySelector('[data-pdf-page="10"]'),old=row.querySelector('canvas'),right=f.host.querySelector('[data-pdf-action=rotate-right]'),left=f.host.querySelector('[data-pdf-action=rotate-left]');
  assert.match(right.textContent,/סובב ימינה/);assert.match(left.textContent,/סובב שמאלה/);
  right.click();assert.match(old.style.transform,/rotate\(90deg\)/);await tick();
  assert.equal(f.renders.findLast(render=>render.number===10).viewport.rotation,90);assert.equal(parseFloat(row.querySelector('.pdf-page-frame').style.height),540);assert.equal(f.host.querySelector('.pdf-zoom-label').textContent,'125%');assert.equal(old.width,0);
  assert.ok(f.host.querySelector('.pdf-page-scroll').scrollTop>1000);assert.equal(f.host.querySelectorAll('[data-pdf-page]').length,30);
  left.click();await tick();assert.equal(f.renders.findLast(render=>render.number===10).viewport.rotation,0);assert.equal(parseFloat(row.querySelector('.pdf-page-frame').style.height),960);
  right.click();right.click();right.click();await tick();assert.equal(f.renders.findLast(render=>render.number===10).viewport.rotation,270);right.click();await tick();assert.equal(f.renders.findLast(render=>render.number===10).viewport.rotation,0);f.api.unmount(f.host);
});
test('rotation adds to the orientation stored in a PDF and resets when another document opens',async()=>{
  const f=fixture({nativeRotation:90,english:true});f.api.mount(f.host,item);await tick();const first=f.renders[0].viewport;assert.equal(first.rotation,90);assert.ok(first.width>first.height);
  const right=f.host.querySelector('[data-pdf-action=rotate-right]');assert.match(right.textContent,/Rotate right/);right.click();await tick();assert.equal(f.renders.findLast(render=>render.number===1).viewport.rotation,180);
  f.api.mount(f.host,{...item,src:'/media/'+'c'.repeat(32)});await tick();assert.equal(f.renders.findLast(render=>render.id===2).viewport.rotation,90);f.api.unmount(f.host);
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
    const page=await pdf.getPage(1),rotated=page.getViewport({scale:1,rotation:90}),canvas=createCanvas(rotated.width,rotated.height);assert.equal(rotated.width,240);assert.equal(rotated.height,300);await page.render({canvas,canvasContext:canvas.getContext('2d'),viewport:rotated}).promise;assert.ok(canvas.toBuffer('image/png').length>2000);
  }finally{await task.destroy();}
});
