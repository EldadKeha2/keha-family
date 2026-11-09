import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../public/assets/personal-photo-layout.js',import.meta.url),'utf8');
function fixture({width=1400,ua='Windows NT 10.0; Win64; x64',mobile=false,touch=0,scope='personal:avigail',kind='photo',english=false}={}){
 const nodes=new Map();let fits=0,current={id:'one',kind};
 class Node extends EventTarget{
  constructor(tag='div',id=''){super();this.tagName=tag.toUpperCase();this.id=id;this.childNodes=[];this.attributes=new Map();this.textContent='';this.hidden=false;this.disabled=false;this.open=false;this.classes=new Set();this.classList={add:value=>this.classes.add(value),remove:value=>this.classes.delete(value),contains:value=>this.classes.has(value)};}
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
  focus(){document.activeElement=this;}
  click(){if(!this.disabled)this.dispatchEvent(new Event('click'));}
 }
 const document={readyState:'complete',activeElement:null,createElement:tag=>new Node(tag),createComment:()=>new Node('comment'),getElementById:id=>document.body.id===id?document.body:document.body.querySelector('#'+id)};
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
 const window={FamilyI18n:{isEnglish:english},FamilyMedia:{current:()=>current},FamilyPhotoViewerLayout:{sync(){}},FamilyFaces:{fit(){fits++;}}};
 vm.runInNewContext(source,{document,window,navigator:{userAgent:ua,userAgentData:{mobile},maxTouchPoints:touch},matchMedia:()=>({get matches(){return width<=700;}})});
 const controller={item:current,dialog:viewer,toolbar,regionsButton:region,regionsNote:regionNote,reviewButton:review,reviewStatus:status};
 const api=window.FamilyPersonalPhotoLayout;
 return{nodes,viewer,document,window,api,controller,get:id=>document.getElementById(id),sync:()=>api.sync(controller),get fits(){return fits;},width(value){width=value;},scope(value){viewer.setAttribute('data-media-scope',value);},photo(id,kind='photo'){current={id,kind};controller.item=current;},add};
}
test('only computer personal-photo viewers use the new layout; phones and every other gallery keep their controls',()=>{
 for(const options of [{width:390},{width:700},{width:1024,ua:'Android 15 Mobile'},{width:1024,ua:'iPhone'},{width:1024,ua:'Macintosh',touch:5},{width:1024,mobile:true},{scope:'gallery'},{scope:'photos'},{scope:'wedding:parents'},{scope:'nursery:avigail'},{scope:'nostalgia'},{kind:'video'},{kind:'document'}]){
  const f=fixture(options),download=f.get('mediaOriginal'),parent=download.parentNode;f.sync();assert.equal(f.get('personalPhotoFrame'),null,JSON.stringify(options));assert.equal(download.parentNode,parent);assert.equal(f.viewer.getAttribute('aria-labelledby'),'mediaViewerTitle');
 }
 const f=fixture({ua:'Windows NT 10.0',touch:10});f.sync();assert.equal(f.viewer.classList.contains('personal-photo-desktop'),true,'A touch-screen Windows computer still uses the desktop layout');
});
test('personal desktop groups retain actual controls, requested physical order, zoom clicks and focus',()=>{
 for(const english of [false,true]){
  const f=fixture({english}),download=f.get('mediaOriginal'),names=f.get('togglePhotoNames'),deleteButton=f.get('mediaViewerDelete');let clicks=0;download.addEventListener('click',()=>clicks++);names.addEventListener('click',()=>clicks++);deleteButton.addEventListener('click',()=>clicks++);names.focus();f.sync();
  assert.equal(f.get('mediaStage').parentNode.id,'personalPhotoFrame');assert.equal(f.get('mediaViewerCollections').parentNode.id,'personalPhotoAlbums');assert.equal(f.controller.toolbar.parentNode.id,'personalPhotoZoom');
  assert.deepEqual(f.get('personalPhotoPrimary').childNodes.filter(n=>n.tagName!=='COMMENT').map(n=>n.id),['mediaViewerDelete','editOpenedCaption','openedProfilePhoto']);
  assert.deepEqual(f.get('collectionGroup').childNodes.filter(n=>n.tagName!=='COMMENT').map(n=>n.id),['album-wedding','album-family','album-baby']);
  assert.equal(f.get('photoMomentTools').parentNode.id,'personalPhotoInformation');assert.equal(f.controller.regionsButton.parentNode.id,'photoMomentTools');assert.equal(download.parentNode.id,'mediaShareActions');assert.equal(f.get('mediaShareActions').parentNode.id,'personalPhotoBelow');
  assert.equal(f.get('personalPhotoCounter').textContent,english?'Photo 1 of 12':'תמונה 1 מתוך 12');assert.equal(f.document.activeElement,names);
  download.click();names.click();deleteButton.click();assert.equal(clicks,3);
  const reset=f.get('zoom-reset');let resetClicks=0;reset.addEventListener('click',()=>resetClicks++);reset.disabled=false;f.sync();f.get('personalPhotoFit').click();assert.equal(resetClicks,1);assert.equal(f.fits,1);
 }
});
test('a phone resize restores the original controls and ordering and a desktop resize can reapply once',()=>{
 const f=fixture(),keys=['mediaStage','mediaOriginal','mediaViewerCollections','mediaHeaderCaption','photoMomentTools','regions','toolbar','review','editOpenedPhoto','mediaViewerDelete','openedProfilePhoto','editOpenedCaption','openedCaptionForm'];
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
 f.scope('wedding:parents');f.sync();assert.equal(f.get('personalPhotoFrame'),null);assert.equal(f.get('mediaOriginal').parentNode.id,'mediaViewerTitle');assert.equal(f.get('mediaTagPanel').textContent,'Existing people tags');
});
