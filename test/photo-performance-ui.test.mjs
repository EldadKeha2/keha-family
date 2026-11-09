import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const presentation=await readFile(new URL('../public/assets/photo-presentation.js',import.meta.url),'utf8');
const thumbnails=await readFile(new URL('../public/assets/photo-thumbnails.js',import.meta.url),'utf8');
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
 const again=p.prepare(photo('a'));assert.equal(images.length,4,'Only two prepared photos are retained');await images[3].onload();await again;
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
test('a heavy photo gets one small grid copy while the viewer image and original URL remain intact',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const requests=[],dimensions=[],images=[],window={FamilyApp:{apiEnabled:true},FAMILY_API_TOKEN:'test',dispatchEvent(){}};
 const item={id:'a',kind:'photo',mime:'image/jpeg',src:'/media/a',size:4000000},image={naturalWidth:6567,naturalHeight:4137,src:'/media/a'};
 const document={hidden:false,querySelectorAll:()=>images,addEventListener(){},createElement(){const canvas={getContext:()=>({drawImage(...args){dimensions.push(args.slice(1));}}),toBlob(callback,type){callback(new Blob(['small image'],{type}));}};return canvas;}};
 window.FamilyI18n={fetch:async(path,options)=>{requests.push({path,options});return Response.json({saved:true,item:{...item,thumbnailSrc:'/media/a?thumbnail=1&v=original',thumbnailSize:11}});}};
 vm.runInNewContext(thumbnails,{window,document,setTimeout,Blob,CustomEvent});const api=window.FamilyPhotoThumbnails;
 api.schedule(item,image);api.schedule(item,image);t.mock.timers.tick(1000);await new Promise(resolve=>setImmediate(resolve));
 assert.equal(requests.length,1);assert.deepEqual(Array.from(dimensions[0]),[0,0,640,403]);assert.equal(requests[0].options.body.type,'image/webp');assert.equal(image.src,'/media/a');assert.equal(item.src,'/media/a');assert.match(item.thumbnailSrc,/thumbnail=1/);
 api.schedule({...item,thumbnailSrc:null},image);t.mock.timers.tick(2000);assert.equal(requests.length,1);
 assert.equal(api.attributes(item),'');assert.match(api.attributes({...item,thumbnailSrc:null}),/data-thumbnail-id="a"/);
});
