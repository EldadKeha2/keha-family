import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const presentation=await readFile(new URL('../public/assets/photo-presentation.js',import.meta.url),'utf8');
const thumbnails=await readFile(new URL('../public/assets/photo-thumbnails.js',import.meta.url),'utf8');
test('preview preparation uses the small browsing URL and requests the original only when explicitly needed',async()=>{
 const images=[],window={};class Image{constructor(){images.push(this);this.naturalWidth=2048;}}
 vm.runInNewContext(presentation,{window,Image,navigator:{},setTimeout,clearTimeout});const item={kind:'photo',src:'/large-original',previewSrc:'/small-preview'};
 const preview=window.FamilyPhotoPresentation.prepare(item);await images[0].onload();await preview;assert.equal(images[0].src,'/small-preview');
 const original=window.FamilyPhotoPresentation.prepare(item,'high',true);await images[1].onload();await original;assert.equal(images[1].src,'/large-original');
});
test('new uploads prepare copies from the local file before returning the album instead of downloading the original again',async()=>{
 const calls=[],window={FamilyApp:{apiEnabled:true},FAMILY_API_TOKEN:'test',dispatchEvent(){}},item={id:'a',file:'a.png',kind:'photo',src:'/media/a',mime:'image/png',size:3000000};let decoded=0,closed=false;
 const document={hidden:false,querySelectorAll:()=>[],addEventListener(){},createElement(){return{getContext:()=>({drawImage(){}}),toBlob:fn=>fn(new Blob(['copy'],{type:'image/webp'}))};}};
 window.FamilyI18n={fetch:async(path)=>{calls.push(path);return Response.json({item:{...item,thumbnailSrc:'/media/a?thumbnail=1',...(path.includes('/preview?')?{previewSrc:'/media/a?preview=1'}:{})}});}};
 const bitmap={width:6500,height:4100,close(){closed=true;}};vm.runInNewContext(thumbnails,{window,document,Blob,CustomEvent,setTimeout,createImageBitmap:async()=>{decoded++;return bitmap;}});
 const result={file:'a.png',collection:{items:[item]}};await window.FamilyPhotoThumbnails.fromUpload(result,{type:'image/png'});assert.equal(decoded,1);assert.equal(closed,true);assert.equal(calls.length,2);assert.match(result.collection.items[0].thumbnailSrc,/thumbnail/);assert.match(result.collection.items[0].previewSrc,/preview/);
});
test('adjacent preparation deduplicates downloads, decodes before use, bounds memory and respects data saving',async()=>{
 const images=[],navigator={connection:{}},window={};
 class Image{constructor(){images.push(this);this.naturalWidth=4000;this.decode=async()=>{this.decoded=true;};}}
 vm.runInNewContext(presentation,{window,Image,navigator,setTimeout,clearTimeout});const p=window.FamilyPhotoPresentation;
 const photo=id=>({kind:'photo',src:'/media/'+id,size:1000000});
 const a=p.prepare(photo('a'));assert.equal(p.prepare(photo('a')),a);assert.equal(images.length,1);assert.equal(images[0].fetchPriority,'high');
 await images[0].onload();assert.equal(await a,images[0]);assert.equal(images[0].decoded,true);
 p.preload([photo('a'),photo('b')],0);assert.equal(images.length,2);assert.equal(images[1].fetchPriority,'low');await images[1].onload();
 navigator.connection.saveData=true;p.preload([photo('b'),photo('c')],0);assert.equal(images.length,2);
 navigator.connection={effectiveType:'2g'};p.preload([photo('b'),photo('c')],0);assert.equal(images.length,2);
 navigator.connection={};const c=p.prepare(photo('c'));await images[2].onload();await c;
 const d=p.prepare(photo('d'));await images[3].onload();await d;
 const again=p.prepare(photo('a'));assert.equal(images.length,5,'Only three prepared photos are retained');await images[4].onload();await again;
});
test('sliding keeps one outgoing layer, follows the drag and cleans animation state without removing the full-resolution image',async()=>{
 const animations=[],nodes=[],window={FamilyFaces:{fit(){window.fitted=true;}}};let reduced=false;
 const classes=()=>{const set=new Set();return{add:v=>set.add(v),remove:v=>set.delete(v),contains:v=>set.has(v)};};
 const node=()=>({style:{},classList:classes(),setAttribute(){},remove(){this.removed=true;},animate(frames,options){let finish;const animation={frames,options,finished:new Promise(resolve=>{finish=resolve;}),cancel(){finish();}};animations.push(animation);return animation;}});
 const image={...node(),src:'/media/full',naturalWidth:6567,getBoundingClientRect:()=>({left:20,top:0,width:640,height:403})},scroll=node();
 const stage={classList:classes(),clientWidth:640,querySelector:s=>s==='.face-photo-scroll'?scroll:image,getBoundingClientRect:()=>({left:0,top:0}),append:n=>nodes.push(n)};
 const document={createElement:()=>node()};vm.runInNewContext(presentation,{window,document,navigator:{},setTimeout,clearTimeout,matchMedia:()=>({matches:reduced})});const p=window.FamilyPhotoPresentation;
 p.drag(stage,90);assert.equal(scroll.style.transform,'translateX(90px)');p.cancel();assert.equal(scroll.style.transform,'');
 const ghost=p.snapshot(stage);assert.match(ghost.style.backgroundImage,/\/media\/full/);p.slide(stage,ghost,-1);assert.equal(stage.classList.contains('photo-slide-running'),true);
 assert.equal(animations.at(-1).frames[0].transform,'translateX(-640px)');assert.equal(image.src,'/media/full');p.cancel();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(ghost.removed,true);assert.equal(stage.classList.contains('photo-slide-running'),false);assert.equal(image.removed,undefined);
 reduced=true;assert.equal(p.snapshot(stage),null);
});
test('a committed drag continues from its existing position in one motion',()=>{
 const frames=[],window={},classes={add(){},remove(){}},image={src:'/preview',naturalWidth:2000,style:{},animate(k){frames.push(k);return{finished:new Promise(()=>{}),cancel(){}};},getBoundingClientRect:()=>({left:-100,top:0,width:640,height:400})},scroller={style:{}},ghost={style:{},setAttribute(){},remove(){},animate:image.animate};
 const stage={clientWidth:640,classList:classes,querySelector:s=>s==='.face-photo-scroll'?scroller:image,getBoundingClientRect:()=>({left:0,top:0}),append(){}};
 vm.runInNewContext(presentation,{window,document:{createElement:()=>ghost},navigator:{},matchMedia:()=>({matches:false}),setTimeout,clearTimeout});const p=window.FamilyPhotoPresentation;p.drag(stage,-100);const captured=p.snapshot(stage);p.slide(stage,captured,1);assert.equal(frames[0][1].transform,'translateX(-540px)');assert.equal(frames[1][0].transform,'translateX(540px)');p.cancel();
});
test('arrow animations capture the displayed photo rather than an off-screen native neighbour',()=>{
 const window={},ghost={style:{},setAttribute(){}},shown={src:'/shown-photo',naturalWidth:2048,animate(){},getBoundingClientRect:()=>({left:20,top:10,width:640,height:400})},neighbour={...shown,src:'/off-screen-neighbour',getBoundingClientRect:()=>({left:-620,top:10,width:640,height:400})};
 const stage={querySelector:selector=>selector==='img'?neighbour:selector==='.face-photo-scroll img'?shown:null,getBoundingClientRect:()=>({left:0,top:0})};
 vm.runInNewContext(presentation,{window,document:{createElement:()=>ghost},navigator:{},matchMedia:()=>({matches:false}),setTimeout,clearTimeout});
 const result=window.FamilyPhotoPresentation.snapshot(stage);assert.match(result.style.backgroundImage,/shown-photo/);assert.doesNotMatch(result.style.backgroundImage,/neighbour/);assert.equal(result.style.left,'20px');
});
test('a heavy photo gets grid and viewer copies while its original URL remains intact',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const requests=[],dimensions=[],images=[],window={FamilyApp:{apiEnabled:true},FAMILY_API_TOKEN:'test',dispatchEvent(){}};
 const item={id:'a',kind:'photo',mime:'image/jpeg',src:'/media/a',size:4000000},image={naturalWidth:6567,naturalHeight:4137,src:'/media/a'};
 const document={hidden:false,querySelectorAll:()=>images,addEventListener(){},createElement(){const canvas={getContext:()=>({drawImage(...args){dimensions.push(args.slice(1));}}),toBlob(callback,type){callback(new Blob(['small image'],{type}));}};return canvas;}};
 window.FamilyI18n={fetch:async(path,options)=>{requests.push({path,options});return Response.json({saved:true,item:{...item,thumbnailSrc:'/media/a?thumbnail=1&v=original',thumbnailSize:11,...(path.includes('/preview?')?{previewSrc:'/media/a?preview=1',previewSize:20}:{})}});}};
 vm.runInNewContext(thumbnails,{window,document,setTimeout,Blob,CustomEvent});const api=window.FamilyPhotoThumbnails;
 api.schedule(item,image);api.schedule(item,image);t.mock.timers.tick(1000);await new Promise(resolve=>setImmediate(resolve));
 assert.equal(requests.length,2);assert.deepEqual(Array.from(dimensions[0]),[0,0,640,403]);assert.equal(requests[0].options.body.type,'image/webp');assert.equal(image.src,'/media/a');assert.equal(item.src,'/media/a');assert.match(item.thumbnailSrc,/thumbnail=1/);assert.match(item.previewSrc,/preview=1/);
 api.schedule({...item,thumbnailSrc:null},image);t.mock.timers.tick(2000);assert.equal(requests.length,2);
 assert.equal(api.attributes(item),'');assert.match(api.attributes({...item,thumbnailSrc:null}),/data-thumbnail-id="a"/);
});
