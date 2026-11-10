import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../public/assets/personal-photo-layout.js',import.meta.url),'utf8');
function fixture({width=1400,ua='Windows NT 10.0; Win64; x64',mobile=false,touch=0,scope='personal:avigail',kind='photo',english=false,installed=false}={}){
 const nodes=new Map();let fits=0,current={id:'one',kind};
 class Node extends EventTarget{
  constructor(tag='div',id=''){super();this.tagName=tag.toUpperCase();this.id=id;this.childNodes=[];this.attributes=new Map();this.textContent='';this.hidden=false;this.disabled=false;this.open=false;this.classes=new Set();this.classList={add:value=>this.classes.add(value),remove:value=>this.classes.delete(value),contains:value=>this.classes.has(value)};const properties=new Map();this.style={setProperty:(key,value)=>properties.set(key,value),getPropertyValue:key=>properties.get(key)||''};}
  get isConnected(){return this===document.body||Boolean(this.parentNode?.isConnected);}
  get firstChild(){return this.childNodes[0]||null;}
  get nextSibling(){const a=this.parentNode?.childNodes||[];return a[a.indexOf(this)+1]||null;}
  setAttribute(key,value){this.attributes.set(key,String(value));}
  getAttribute(key){return this.attributes.get(key)??null;}
  removeAttribute(key){this.attributes.delete(key);}
  append(...values){for(const value of values)this.insertBefore(value,null);}
  insertBefore(node,before){if(node===before)return;node.remove();const at=before?this.childNodes.indexOf(before):this.childNodes.length;assert.ok(at>=0);this.childNodes.splice(at,0,node);node.parentNode=this;return node;}
  before(node){this.parentNode.insertBefore(node,this);}
  remove(){if(this.parentNode){const a=this.parentNode.childNodes;a.splice(a.indexOf(this),1);this.parentNode=null;}}
  replaceWith(node){const parent=this.parentNode;parent.insertBefore(node,this);this.remove();}
  contains(node){return node===this||this.childNodes.some(child=>child.contains(node));}
  matches(selector){if(selector.startsWith('.'))return this.classes.has(selector.slice(1));if(selector.startsWith('#'))return this.id===selector.slice(1);const attribute=selector.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);return attribute?this.attributes.has(attribute[1])&&(attribute[2]===undefined||this.getAttribute(attribute[1])===attribute[2]):this.tagName.toLowerCase()===selector;}
  querySelector(selector){for(const child of this.childNodes){if(child.matches(selector))return child;const found=child.querySelector(selector);if(found)return found;}return null;}
  querySelectorAll(selector){return this.childNodes.flatMap(child=>[...(child.matches(selector)?[child]:[]),...child.querySelectorAll(selector)]);}
  focus(){document.activeElement=this;}
  click(){if(!this.disabled)this.dispatchEvent(new Event('click'));}
 }
 const document={readyState:'complete',activeElement:null,documentElement:{clientWidth:1400},createElement:tag=>new Node(tag),createComment:()=>new Node('comment'),getElementById:id=>document.body.id===id?document.body:document.body.querySelector('#'+id)};
 document.body=new Node('body');
 const add=(id,parent,tag='div',className='')=>{const node=new Node(tag,id);if(className)node.classes.add(className);nodes.set(id,node);parent.append(node);return node;};
 const viewer=add('mediaViewer',document.body,'dialog');viewer.open=true;viewer.setAttribute('aria-labelledby','mediaViewerTitle');viewer.setAttribute('data-media-scope',scope);
 const header=add('header',viewer,'header','media-viewer-header'),title=add('mediaViewerTitle',header,'h2');
 add('mediaOriginal',title,'a');add('editOpenedPhoto',title,'button');const review=add('review',title,'button');
 add('mediaHeaderCaption',header,'p').textContent='Family memory';const paging=add('paging',header);add('mediaPrevious',paging,'button');add('mediaViewerCounter',paging,'span').textContent='1 / 12';add('mediaNext',paging,'button');add('closeMediaViewer',header,'button');
 const toolbar=add('toolbar',viewer);const region=add('regions',toolbar,'button'),regionNote=add('regionsNote',toolbar,'span');
 const zoomButtons=add('zoomButtons',toolbar);for(const key of ['in','out','reset','level']){const button=add('zoom-'+key,zoomButtons,key==='level'?'output':'button');button.setAttribute('data-face-zoom-'+key,'');}
 nodes.get('zoom-reset').disabled=true;
 const status=add('reviewStatus',viewer,'span'),stage=add('mediaStage',viewer),footer=add('footer',viewer,'footer','media-viewer-footer'),momentRow=add('momentRow',footer);
 const collection=add('mediaViewerCollections',momentRow),group=add('collectionGroup',collection,'div','photo-collections');
 for(const kind of ['family','baby','wedding'])add('album-'+kind,group,'button').setAttribute('data-photo-album-kind',kind);
 const moment=add('photoMomentTools',momentRow);add('editPhotoDate',moment,'button');add('dateText',moment,'time','photo-taken-date');add('togglePhotoNames',moment,'button');add('togglePhotoAges',moment,'button');
 const tools=add('tools',footer),manage=add('manage',tools);add('mediaViewerDelete',manage,'button');add('openedProfilePhoto',manage,'button');add('editOpenedCaption',tools,'button');add('openedCaptionForm',tools,'form');
 const share=add('mediaShareActions',tools);for(const id of ['shareMediaWhatsApp','shareMediaFacebook','shareMediaMessenger','shareMediaInstagram','shareMediaEmail','copyMediaLink'])add(id,share,'button');
 const tags=add('mediaTagPanel',footer);tags.textContent='Existing people tags';
 add('mediaPhotoLabels',footer).textContent='Existing topic labels';const labelList=add('faceLabelList',stage);labelList.hidden=true;
 const window={FamilyI18n:{isEnglish:english},FamilyMedia:{current:()=>current},FamilyPhotoViewerLayout:{sync(){}},FamilyFaces:{fit(){fits++;}}};
 vm.runInNewContext(source,{document,window,innerHeight:900,getComputedStyle:node=>node.computed||{},navigator:{userAgent:ua,userAgentData:{mobile},maxTouchPoints:touch,standalone:installed},matchMedia:query=>({get matches(){return query.includes('width')?width<=700:installed;}})});
 const controller={item:current,dialog:viewer,toolbar,regionsButton:region,regionsNote:regionNote,reviewButton:review,reviewStatus:status,labelList};
 const api=window.FamilyPersonalPhotoLayout;
 return{nodes,viewer,document,window,api,controller,get:id=>document.getElementById(id),sync:()=>api.sync(controller),get fits(){return fits;},width(value){width=value;},scope(value){viewer.setAttribute('data-media-scope',value);},photo(id,kind='photo'){current={id,kind};controller.item=current;},add};
}
test('only supported desktop photo contexts use the layout; phones, nostalgia, video and documents retain their controls',()=>{
 for(const options of [{width:390},{width:700},{width:1024,ua:'Android 15 Mobile'},{width:1024,ua:'iPhone'},{width:1024,ua:'Macintosh',touch:5},{width:1024,mobile:true},{scope:'nostalgia'},{scope:'videos'},{kind:'video'},{kind:'document'}]){
  const f=fixture(options),download=f.get('mediaOriginal'),parent=download.parentNode;f.sync();assert.equal(f.get('personalPhotoFrame'),null,JSON.stringify(options));assert.equal(download.parentNode,parent);assert.equal(f.viewer.getAttribute('aria-labelledby'),'mediaViewerTitle');
 }
 const f=fixture({ua:'Windows NT 10.0',touch:10});f.sync();assert.equal(f.viewer.classList.contains('personal-photo-desktop'),true,'A touch-screen Windows computer still uses the desktop layout');
});
test('family, wedding, nursery and personal viewers keep the same structure in desktop browser and installed Windows app',()=>{
 for(const scope of ['personal:avigail','gallery','photos','wedding:u-noble','nursery:avigail','link:direct-photo'])for(const english of [false,true])for(const installed of [false,true]){
  const f=fixture({scope,english,installed});f.sync();assert.equal(f.viewer.classList.contains('personal-photo-desktop'),true,scope);assert.equal(f.viewer.classList.contains('personal-photo-shared'),!scope.startsWith('personal:'));
  for(const [id,parent]of [['mediaStage','personalPhotoFrame'],['mediaViewerCollections','personalPhotoAlbums'],['editOpenedPhoto','personalPhotoEdit'],['photoMomentTools','personalPhotoInformation'],['editOpenedCaption','personalPhotoPrimary'],['mediaShareActions','personalPhotoBelow']])assert.equal(f.get(id).parentNode.id,parent,scope+' / '+id);
  assert.equal(f.get('personalPhotoCounter').textContent,english?'Photo 1 of 12':'תמונה 1 מתוך 12');
 }
 for(const scope of ['gallery','photos','wedding:u-noble','nursery:avigail'])for(const installed of [false,true])for(const width of [390,700,1024]){
  const f=fixture({scope,installed,width,ua:'Android 16 Mobile'});f.sync();assert.equal(f.get('personalPhotoFrame'),null,scope+' / '+width);
 }
});
test('personal desktop groups retain actual controls, requested physical order, zoom clicks and focus',()=>{
 for(const english of [false,true]){
  const f=fixture({english}),download=f.get('mediaOriginal'),names=f.get('togglePhotoNames'),deleteButton=f.get('mediaViewerDelete');let clicks=0;download.addEventListener('click',()=>clicks++);names.addEventListener('click',()=>clicks++);deleteButton.addEventListener('click',()=>clicks++);names.focus();f.sync();
  assert.equal(f.get('mediaStage').parentNode.id,'personalPhotoFrame');assert.equal(f.get('mediaViewerCollections').parentNode.id,'personalPhotoAlbums');assert.equal(f.controller.toolbar.parentNode.id,'personalPhotoZoom');
  assert.deepEqual(f.get('personalPhotoPrimary').childNodes.filter(n=>n.tagName!=='COMMENT').map(n=>n.id),['mediaViewerDelete','openedProfilePhoto','editOpenedCaption']);
  assert.deepEqual(f.get('collectionGroup').childNodes.filter(n=>n.tagName!=='COMMENT').map(n=>n.id),['album-family','album-baby','album-wedding']);
  assert.equal(f.get('photoMomentTools').parentNode.id,'personalPhotoInformation');assert.equal(f.controller.regionsButton.parentNode.id,'photoMomentTools');assert.equal(download.parentNode.id,'mediaShareActions');assert.equal(f.get('mediaShareActions').parentNode.id,'personalPhotoBelow');
  assert.equal(f.get('personalPhotoCounter').textContent,english?'Photo 1 of 12':'תמונה 1 מתוך 12');assert.equal(f.document.activeElement,names);
  download.click();names.click();deleteButton.click();assert.equal(clicks,3);
  const reset=f.get('zoom-reset');let resetClicks=0;reset.addEventListener('click',()=>resetClicks++);reset.disabled=false;f.sync();f.get('personalPhotoFit').click();assert.equal(resetClicks,1);assert.equal(f.fits,1);
 }
});
test('a phone resize restores the original controls and ordering and a desktop resize can reapply once',()=>{
 const f=fixture(),keys=['mediaStage','mediaOriginal','mediaViewerCollections','mediaHeaderCaption','photoMomentTools','regions','toolbar','review','editOpenedPhoto','mediaViewerDelete','openedProfilePhoto','editOpenedCaption','openedCaptionForm','mediaPhotoLabels','faceLabelList'];
 const parents=new Map(keys.map(id=>[id,f.get(id).parentNode]));f.sync();f.width(390);f.sync();
 assert.equal(f.get('personalPhotoFrame'),null);assert.equal(f.viewer.classList.contains('personal-photo-desktop'),false);assert.equal(f.viewer.getAttribute('aria-labelledby'),'mediaViewerTitle');
 for(const id of keys)assert.equal(f.get(id).parentNode,parents.get(id),id);
 assert.deepEqual(f.get('collectionGroup').childNodes.filter(n=>n.tagName!=='COMMENT').map(n=>n.id),['album-family','album-baby','album-wedding']);
 f.width(1400);f.sync();f.sync();assert.equal(f.get('mediaOriginal').parentNode.id,'mediaShareActions');f.api.restore();assert.equal(f.get('mediaOriginal').parentNode,parents.get('mediaOriginal'));
});
test('late face controls and replaced metadata mount in the right group and switching albums restores them',()=>{
 const f=fixture();f.api.sync(null);f.sync();assert.equal(f.controller.reviewButton.parentNode.id,'personalPhotoReview');assert.equal(f.get('editOpenedPhoto').parentNode.id,'personalPhotoEdit');
 const old=f.get('togglePhotoNames');old.remove();const replacement=f.add('togglePhotoNames',f.get('photoMomentTools'),'button');f.get('mediaViewerCounter').textContent='4 / 12';f.get('mediaHeaderCaption').textContent='Updated caption';f.photo('two');f.sync();
 assert.equal(f.get('togglePhotoNames'),replacement);assert.equal(f.get('personalPhotoCounter').textContent,'תמונה 4 מתוך 12');assert.equal(f.get('mediaHeaderCaption').parentNode.id,'personalPhotoHeading');
 f.scope('nostalgia');f.sync();assert.equal(f.get('personalPhotoFrame'),null);assert.equal(f.get('mediaOriginal').parentNode.id,'mediaViewerTitle');assert.equal(f.get('mediaTagPanel').textContent,'Existing people tags');
});
test('the red side trash uses the exact album removal handler and mirrors its disabled state',()=>{
 const f=fixture();let requests=0;const remove=f.get('mediaViewerDelete');remove.title='Remove from this album';remove.addEventListener('click',()=>requests++);f.sync();
 const shortcut=f.get('personalPhotoTrashButton');assert.equal(shortcut.getAttribute('aria-label'),remove.title);shortcut.click();assert.equal(requests,1);
 remove.disabled=true;f.sync();assert.equal(shortcut.disabled,true);shortcut.click();assert.equal(requests,1);
 remove.hidden=true;f.sync();assert.equal(shortcut.hidden,true);f.api.restore();assert.equal(f.get('personalPhotoTrashButton'),null);
});
test('desktop frames and side controls stay fixed before loading and across portrait, landscape and panoramic photos',()=>{
 const f=fixture();f.sync();const frame=f.get('personalPhotoFrame');frame.clientWidth=1200;frame.clientHeight=520;frame.computed={columnGap:'12px',paddingLeft:'16px',paddingRight:'16px',paddingTop:'10px',paddingBottom:'10px'};f.sync();
 const keys=['--personal-photo-width','--personal-photo-height','--personal-rail','--personal-review-top','--personal-albums-top','--personal-edit-top','--personal-trash-top','--personal-zoom-top'];
 const before=keys.map(key=>frame.style.getPropertyValue(key));
 const image=f.add('actualPhoto',f.get('mediaStage'),'img');image.naturalWidth=1200;image.naturalHeight=800;image.getBoundingClientRect=()=>({top:40,bottom:540,width:750,height:500});
 f.controller.image=image;f.controller.scroller={computed:{maxHeight:'500px'},getBoundingClientRect:()=>({top:40,bottom:540,width:750,height:500})};f.get('personalPhotoRight').getBoundingClientRect=()=>({top:40});f.sync();
 const value=key=>parseFloat(frame.style.getPropertyValue(key)),rail=value('--personal-rail'),zoom=rail*3+24,left=rail*4+36;
 assert.deepEqual(keys.map(key=>frame.style.getPropertyValue(key)),before);assert.equal(value('--personal-photo-height'),500);assert.ok(value('--personal-photo-width')>900);assert.ok(Math.abs(value('--personal-review-top')+left/2-250)<.01);assert.equal(value('--personal-zoom-top'),value('--personal-review-top'));
 assert.equal(value('--personal-albums-top'),value('--personal-review-top')+rail+12);
 assert.ok(Math.abs(value('--personal-trash-top')+rail-500)<.01);assert.ok(value('--personal-edit-top')+rail+11.9<=value('--personal-trash-top'));assert.ok(value('--personal-zoom-top')+zoom+11.9<=value('--personal-edit-top'));
 for(const [width,height]of [[800,2400],[5000,600],[50,40]]){image.naturalWidth=width;image.naturalHeight=height;f.get('mediaHeaderCaption').textContent='A long caption that must wrap without shifting navigation. '.repeat(15);f.get('mediaTagPanel').textContent='Many people tags '.repeat(100);f.photo(width+'x'+height);f.sync();assert.deepEqual(keys.map(key=>frame.style.getPropertyValue(key)),before);}
 frame.clientHeight=420;f.sync();assert.equal(value('--personal-photo-height'),400);assert.ok(f.fits>1,'a resized window refits the same photo inside the new frame');
});
test('topic labels precede the desktop actions and people tags, and each newly selected photo reveals them without scrolling',()=>{
 const f=fixture(),footer=f.get('footer'),labels=f.get('mediaPhotoLabels');f.sync();const order=footer.childNodes;
 assert.ok(order.indexOf(labels)<order.indexOf(f.get('personalPhotoBelow')));assert.ok(order.indexOf(labels)<order.indexOf(f.get('mediaTagPanel')));assert.equal(labels.textContent,'Existing topic labels');
 footer.scrollTop=160;f.viewer.scrollTop=120;f.sync();assert.equal(footer.scrollTop,160,'metadata updates preserve an ongoing footer interaction');
 f.photo('two');f.sync();assert.equal(footer.scrollTop,0);assert.equal(f.viewer.scrollTop,0);f.api.restore();assert.ok(footer.childNodes.indexOf(labels)>footer.childNodes.indexOf(f.get('mediaTagPanel')));
});
