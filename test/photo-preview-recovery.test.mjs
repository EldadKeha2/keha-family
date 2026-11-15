import {test} from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../public/assets/photo-thumbnails.js',import.meta.url),'utf8'),presentation=await readFile(new URL('../public/assets/photo-presentation.js',import.meta.url),'utf8');
function canvas(){let solid=false,w=1,h=1;return{get width(){return w;},set width(v){w=v;solid=false;},get height(){return h;},set height(v){h=v;solid=false;},get solid(){return solid;},getContext(){return{drawImage(image){solid=image.solid!==false;},getImageData(){const data=new Uint8ClampedArray(1024);if(solid)data[3]=255;return{data};}};},toBlob(fn){fn(new Blob([solid?'visible':'transparent'],{type:'image/webp'}));}};}
test('thumbnail generation freezes pixels before replacing the live grid src and keeps the saved preview visible',async()=>{
 const requests=[],timers=[];const image={naturalWidth:463,naturalHeight:1170,solid:true,isConnected:true,complete:false,dataset:{thumbnailId:'a'},addEventListener(){},removeAttribute(){delete this.dataset.thumbnailId;},set src(v){this.solid=false;this.currentSrc=v;}};
 const item={id:'a',kind:'photo',src:'/media/a',mime:'image/png',size:1200000},document={hidden:false,createElement:canvas,querySelectorAll:()=>[image],addEventListener(){}},window={FamilyApp:{apiEnabled:true},FamilyI18n:{fetch:async(path,options)=>{requests.push({path,body:await options.body.text()});return Response.json({item:{thumbnailSrc:'/thumb',...(path.includes('/preview?')?{previewSrc:'/preview'}:{})}});}},dispatchEvent(){}};
 vm.runInNewContext(source,{window,document,Blob,CustomEvent,setTimeout:fn=>timers.push(fn)});window.FamilyPhotoThumbnails.schedule(item,image);timers.shift()();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(image.solid,false,'The original DOM image changed while the background task was running');assert.equal(requests.length,2);assert.deepEqual(requests.map(r=>r.body),['visible','visible']);
});
test('a fully transparent prepared preview falls back to the intact original and invalidates the bad URL',async()=>{
 const images=[],bad=new Set(),window={FamilyPhotoThumbnails:{source:item=>bad.has(item.previewSrc)?item.src:item.previewSrc||item.src,rejectPreview:item=>bad.add(item.previewSrc),visiblePixels:image=>image.src!=='/bad-preview'}};
 class Image{constructor(){images.push(this);this.naturalWidth=463;this.naturalHeight=1170;}cloneNode(){return this;}}
 vm.runInNewContext(presentation,{window,Image,navigator:{},setTimeout,clearTimeout});const item={kind:'photo',src:'/original',previewSrc:'/bad-preview'},pending=window.FamilyPhotoPresentation.prepare(item);await images[0].onload();assert.equal(images[0].src,'/original');await images[0].onload();assert.equal(await pending,images[0]);assert.equal(window.FamilyPhotoPresentation.ready(item),images[0]);assert.equal(window.FamilyPhotoPresentation.source(item),'/original');
});
test('transparent previews are rejected but opaque dark photos and partly transparent artwork remain valid',()=>{
 const document={createElement:canvas,addEventListener(){}},window={};vm.runInNewContext(source,{window,document,setTimeout});const a=window.FamilyPhotoThumbnails;
 assert.equal(a.visiblePixels({width:20,solid:false}),false);assert.equal(a.visiblePixels({width:20,solid:true}),true);
 const item={src:'/full',previewSrc:'/bad'};a.rejectPreview(item);assert.equal(a.source(item),'/full');assert.equal(a.source({src:'/other',previewSrc:'/good'}),'/good');
});
