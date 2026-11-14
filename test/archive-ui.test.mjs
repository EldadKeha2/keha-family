import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import family from '../src/family.mjs';
import {browserHistory,navigationSource} from './helpers/browser-history.mjs';

const source=await readFile(new URL('../public/assets/archive.js',import.meta.url),'utf8');
function fixture(items=[],{navigation=false,entryUrl='https://family.test/#weddings',weddingDate='',uploadTransport=null}={}){
  const browser=navigation?browserHistory(entryUrl):null;let view=navigation?new URL(entryUrl).hash.slice(1).split('/')[0]:'nostalgia';
  const nodes=new Map(),handlers=new Map(),windowEvents=new Map(),requests=[],intervals=[];
  class Node{
    constructor(){this.dataset={};this.children=[];this.className='';this.innerHTML='';this.value='';this.textContent='';this.parent=null;this.widgets=new Map();this.clicks=0;this.classList={add(){},remove(){},toggle(){}};}
    get firstElementChild(){return this.children[0]||null;}
    get nextElementSibling(){return this.parent?.children[this.parent.children.indexOf(this)+1]||null;}
    addEventListener(){} setAttribute(){} insertAdjacentHTML(position,html){if(position==='afterbegin')this.innerHTML=html+this.innerHTML;else if(position==='beforeend')this.innerHTML+=html;} contains(){return false;} scrollIntoView(){}
    querySelectorAll(){return [];}
    querySelector(selector){
      const match=/^\[data-nostalgia-(kind|empty)="([^"]+)"\]$/.exec(selector);
      if(match)return this.children.find(n=>n.dataset[match[1]==='kind'?'nostalgiaKind':'nostalgiaEmpty']===match[2])||null;
      if(selector==='video'||selector==='textarea'){
        if(!this.innerHTML.includes('<'+selector))return null;
        if(!this.widgets.has(selector))this.widgets.set(selector,new Node());return this.widgets.get(selector);
      }
      return null;
    }
    insertBefore(node,anchor){if(node.parent)node.remove();const at=anchor?this.children.indexOf(anchor):this.children.length;this.children.splice(at,0,node);node.parent=this;}
    remove(){if(this.parent){this.parent.children.splice(this.parent.children.indexOf(this),1);this.parent=null;}}
    click(){this.clicks++;} showModal(){this.open=true;}
  }
  const get=id=>{if(!nodes.has(id))nodes.set(id,new Node());return nodes.get(id);};
  const document={activeElement:null,visibilityState:'visible',getElementById:get,createElement:()=>new Node(),querySelector:()=>null,querySelectorAll:()=>[],addEventListener(type,fn){handlers.set(type,fn);}};
  const window={FAMILY_DATA:navigation?family:{people:{},units:{},branches:[]},FAMILY_API_TOKEN:'test',FamilyDates:{age:()=>null},FamilyTags:{refresh(){}},FamilyMedia:{register(){},controls:()=>''},FamilyI18n:{isEnglish:false,t:String,date:String,html:(parts,...values)=>parts.reduce((text,part,i)=>text+part+(values[i]??''),''),mediaName:item=>item.name,error:String,fetch:async(path,options)=>{requests.push(path);if(uploadTransport?.fetch){const response=await uploadTransport.fetch(path,options);if(response)return response;}if(path==='api/weddings')return Response.json({weddings:[]});if(path.startsWith('api/weddings/'))return Response.json({id:path.split('/').pop(),date:weddingDate,revision:'date-revision',greetings:[],collection:{items,count:items.length}});return Response.json({items,count:items.length});}},addEventListener(type,fn){if(!windowEvents.has(type))windowEvents.set(type,[]);windowEvents.get(type).push(fn);browser?.addEventListener(type,fn);}};
  window.FamilyI18n.branchName=b=>b?.name||'';
  window.FamilyApp={apiEnabled:true,getView:()=>view,nameOf:id=>family.people[id]?.name||id,setView(next,sync=true){if(browser&&sync)window.FamilyNavigation.go('#'+next);view=next;window.FamilyArchive.activate(next);},toast(){}};
  const context=vm.createContext({window,document,location:browser?.location||{hash:'#nostalgia',pathname:'/',search:''},history:browser?.history||{replaceState(){}},URL,setInterval:fn=>intervals.push(fn),clearTimeout(){},setTimeout(){},matchMedia:()=>({matches:false}),...(uploadTransport?{XMLHttpRequest:uploadTransport.XMLHttpRequest,btoa,Uint8Array,setTimeout:fn=>{fn();return 0;}}:{})});
  if(browser)vm.runInContext(navigationSource,context);vm.runInContext(source,context);
  handlers.get('DOMContentLoaded')();
  const flush=()=>new Promise(resolve=>setImmediate(resolve));
  const click=(selector,dataset)=>handlers.get('click')({target:{closest:s=>s===selector?{dataset}:null}});
  return {browser,window,get view(){return view;},openWedding:id=>click('[data-open-wedding]',{openWedding:id}),editWeddingDate:id=>click('[data-edit-wedding-date]',{editWeddingDate:id}),back:()=>click('[data-wedding-back]'),nodes,requests,flush,poll:()=>intervals.forEach(fn=>fn()),change:detail=>{for(const fn of windowEvents.get('family-media-changed')||[])fn({detail});},get grid(){return get('nostalgiaGrid');},upload(kind){click('[data-archive-upload]',{archiveUpload:'nostalgia',archiveKind:kind});},filter(kind){click('[data-archive-filter]',{archiveFilter:kind});}};
}
const item=(kind,n)=>({id:String(n),file:n+'.'+({photo:'jpg',video:'mp4',document:'pdf'}[kind]),filename:'Memory '+n,name:'Memory '+n,kind,src:'/media/'+n,mime:{photo:'image/jpeg',video:'video/mp4',document:'application/pdf'}[kind],size:100});

test('event folders render compact video tiles without upload headings and refresh descriptions after edits',async()=>{
 const film=item('video',1),f=fixture([film]);await f.flush();
 f.window.FamilyNostalgia={isEvent:()=>true};
 f.window.FamilyVideoPresentation={tile:(item,scope)=>`<button data-media-scope="${scope}">${item.caption||'Add description'}</button>`};
 f.filter('all');const card=f.grid.children.find(node=>node.dataset.mediaFile===film.file);
 assert.match(card.className,/video-tile/);assert.equal(f.grid.dataset.layout,'event');
 assert.doesNotMatch(f.grid.children.find(node=>node.dataset.nostalgiaKind==='video').innerHTML,/data-archive-upload/);
 f.change({operation:'caption',item:{...film,caption:'A family dance'}});
 assert.match(f.grid.children.find(node=>node.dataset.mediaFile===film.file).innerHTML,/A family dance/);
});

test('a nostalgia video over 90MB uses bounded parts, retries a transient failed part, and publishes only after completion',async()=>{
 const size=90*1024*1024+12345,partSize=8*1024*1024,requests=[],parts=[],attempts=new Map(),film={...item('video',99),size};
 class XHR{
  constructor(){this.upload={};this.headers={};}open(method,url){this.method=method;this.url=url;}setRequestHeader(key,value){this.headers[key]=value;}
  send(blob){
   const number=Number(this.headers['X-Upload-Part']);attempts.set(number,(attempts.get(number)||0)+1);parts.push({number,size:blob.size,url:this.url});
   assert.equal(this.method,'POST');assert.equal(this.headers['X-Family-Token'],'test');assert.equal(this.headers['X-Upload-Session'],'signed-test-session');
   this.upload.onprogress({lengthComputable:true,loaded:blob.size,total:blob.size});
   this.status=number===2&&attempts.get(number)===1?502:200;this.responseText=JSON.stringify(this.status===502?{error:'Try again',code:'VIDEO_PART_FAILED'}:{saved:true,part:number});queueMicrotask(()=>this.onload());
  }
 }
 const f=fixture([],{uploadTransport:{XMLHttpRequest:XHR,fetch:async(path,options)=>{
  if(!path.includes('/multipart/'))return null;requests.push(path);const body=JSON.parse(options.body);
  if(path.endsWith('/start')){assert.equal(body.size,size);assert.equal(body.filename,'Large family film.mp4');assert.ok(body.head.length);return Response.json({session:'signed-test-session',partSize,parts:Math.ceil(size/partSize)});}
  assert.ok(path.endsWith('/complete'));assert.equal(body.session,'signed-test-session');return Response.json({saved:true,file:film.file,collection:{items:[film],count:1}});
 }}});await f.flush();
 const file={name:'Large family film.mp4',type:'video/mp4',size,slice(start,end){const bytes=new Uint8Array(Math.min(128,end-start));return {size:end-start,arrayBuffer:async()=>bytes.buffer};}};
 assert.equal(f.window.FamilyArchive.acceptDrop({dataTransfer:{files:[file]}}),true);
 for(let turn=0;turn<30&&!f.nodes.get('nostalgiaUploadState').textContent.includes('נשמרו');turn++)await f.flush();
 assert.deepEqual(requests,['api/nostalgia/multipart/start','api/nostalgia/multipart/complete']);assert.equal(attempts.get(2),2);
 const unique=parts.filter((part,index)=>parts.findIndex(p=>p.number===part.number)===index);assert.equal(unique.reduce((n,p)=>n+p.size,0),size);assert.ok(unique.every(p=>p.size<=partSize));
 assert.ok(parts.every(p=>p.url==='api/nostalgia/multipart/part'));assert.match(f.nodes.get('nostalgiaUploadState').textContent,/1 קבצים נשמרו/);assert.equal(f.grid.children.filter(n=>n.dataset.mediaKind==='video').length,1);
});

test('nostalgia films keep a recording-date editor below each player without treating upload time as the recording date',async()=>{
  const film={...item('video',1),uploadedAt:'2026-11-13T12:00:00.000Z'},f=fixture([film]);await f.flush();
  const card=f.grid.children.find(node=>node.dataset.mediaKind==='video');assert.match(card.className,/nostalgia-video-card/);assert.match(card.innerHTML,/תאריך צילום טרם צוין/);assert.doesNotMatch(card.innerHTML,/2026/);assert.match(card.innerHTML,/data-archive-date="1"/);
  const player=card.querySelector('video');f.change({operation:'photo-date',scope:'nostalgia',item:{...film,takenDate:{year:1994},takenDateRevision:'saved'}});assert.equal(f.grid.children.find(node=>node.dataset.mediaKind==='video'),card);assert.equal(card.querySelector('video'),player);
});

test('wedding films show a site-styled poster without a YouTube link or player before opening',async()=>{
  const film={...item('video',1),provider:'youtube',youtubeId:'RrK53SZJJs8',poster:'https://i.ytimg.com/vi/RrK53SZJJs8/hqdefault.jpg',watchUrl:'https://www.youtube.com/watch?v=RrK53SZJJs8'};
  const f=fixture([film],{navigation:true,entryUrl:'https://family.test/#weddings/u-tomer'});await f.flush();
  const grid=f.nodes.get('weddingMediaGrid'),card=grid.children.find(node=>node.dataset.mediaKind==='video');
  assert.ok(card);assert.match(card.innerHTML,/class="archive-video-poster"/);assert.match(card.innerHTML,/data-media-open="1" data-media-scope="wedding:u-tomer"/);
  assert.match(card.innerHTML,/loading="lazy"/);assert.match(card.innerHTML,/aria-label="ניגון Memory 1"/);
  assert.doesNotMatch(card.innerHTML,/<iframe|<video|<source|youtube\.com|YouTube|youtube-play/);
  f.poll();await f.flush();assert.equal(grid.children.find(node=>node.dataset.mediaKind==='video'),card);
});
test('nostalgia separates images, films and documents and preserves a playing video through refreshes',async()=>{
  const f=fixture([item('video',1),item('photo',2),item('document',3)]);await f.flush();
  assert.deepEqual(f.requests,['api/nostalgia']);
  assert.deepEqual(f.grid.children.filter(n=>n.dataset.nostalgiaKind).map(n=>n.dataset.nostalgiaKind),['video','photo','document']);
  assert.deepEqual(f.grid.children.filter(n=>n.dataset.mediaKind).map(n=>n.dataset.mediaKind),['video','photo','document']);
  const video=f.grid.children.find(n=>n.dataset.mediaKind==='video'),player=video.querySelector('video');
  f.filter('all');assert.equal(f.grid.children.find(n=>n.dataset.mediaKind==='video'),video);assert.equal(video.querySelector('video'),player);
  f.filter('video');assert.equal(f.grid.children.filter(n=>n.dataset.mediaKind).length,1);assert.equal(f.grid.children.find(n=>n.dataset.mediaKind),video);
});

test('edited wedding and nostalgia photos replace cached thumbnails while unrelated video players remain mounted',async()=>{
 for(const scope of ['nostalgia','wedding:'+family.root]){
  const f=fixture([item('photo',1),item('video',2)],scope==='nostalgia'?{}:{navigation:true,entryUrl:'https://family.test/#weddings/'+family.root});await f.flush();
  const grid=scope==='nostalgia'?f.grid:f.nodes.get('weddingMediaGrid'),before=grid.children.find(n=>n.dataset.mediaKind==='photo'),video=grid.children.find(n=>n.dataset.mediaKind==='video');
  assert.ok(before);const edited={...item('photo',1),src:'/media/1?v=edited',photoRevision:'edited'};
  f.change({operation:'photo-edit',scope,item:edited});
  const after=grid.children.find(n=>n.dataset.mediaKind==='photo');assert.match(after.innerHTML,/src="\/media\/1\?v=edited"/);assert.notEqual(after,before);assert.equal(grid.children.find(n=>n.dataset.mediaKind==='video'),video);
  f.filter('all');assert.match(grid.children.find(n=>n.dataset.mediaKind==='photo').innerHTML,/src="\/media\/1\?v=edited"/);
 }
});
test('an archive refresh requested before an edit cannot restore the old photo in the viewer or gallery',async()=>{
 for(const scope of ['nostalgia','wedding:'+family.root]){
  const original=item('photo',1),f=fixture([original],scope==='nostalgia'?{}:{navigation:true,entryUrl:'https://family.test/#weddings/'+family.root});await f.flush();let resolve;
  f.window.FamilyI18n.fetch=()=>new Promise(done=>{resolve=done;});f.poll();assert.ok(resolve);
  const edited={...original,src:'/media/1?v=latest',photoRevision:'latest'};f.change({operation:'photo-edit',scope,item:edited});
  resolve(Response.json(scope==='nostalgia'?{items:[original],count:1}:{id:family.root,greetings:[],collection:{items:[original],count:1}}));await f.flush();
  const grid=scope==='nostalgia'?f.grid:f.nodes.get('weddingMediaGrid');assert.match(grid.children.find(n=>n.dataset.mediaKind==='photo').innerHTML,/src="\/media\/1\?v=latest"/);
 }
});

test('wedding history restores the correct couple and overview without adding entries during Back or Forward',async()=>{
  const ids=Object.values(family.units).filter(unit=>unit.people.length===2).map(unit=>unit.id);
  const f=fixture([],{navigation:true});await f.flush();
  f.openWedding(ids[0]);await f.flush();assert.equal(f.browser.location.hash,'#weddings/'+ids[0]);
  f.openWedding(ids[1]);await f.flush();const length=f.browser.history.length;
  f.browser.history.back();await f.flush();
  assert.equal(f.nodes.get('weddingDetail').dataset.couple,ids[0]);assert.equal(f.nodes.get('weddingsOverview').hidden,true);
  f.browser.history.back();await f.flush();
  assert.equal(f.browser.location.hash,'#weddings');assert.equal(f.nodes.get('weddingsOverview').hidden,false);
  assert.equal(f.nodes.get('weddingDetail').hidden,true);
  f.browser.history.forward();await f.flush();f.browser.history.forward();await f.flush();
  assert.equal(f.nodes.get('weddingDetail').dataset.couple,ids[1]);assert.equal(f.browser.history.length,length);
});

test('the wedding return button and revisiting the weddings tab do not reopen a stale couple',async()=>{
  const id=family.root,f=fixture([],{navigation:true});await f.flush();
  f.openWedding(id);await f.flush();f.back();await f.flush();
  assert.equal(f.browser.location.hash,'#weddings');assert.equal(f.nodes.get('weddingsOverview').hidden,false);
  f.browser.history.back();await f.flush();assert.equal(f.browser.location.hash,'#tree');
  f.window.FamilyApp.setView('weddings');f.openWedding(id);await f.flush();
  f.window.FamilyApp.setView('gallery');f.window.FamilyApp.setView('weddings');await f.flush();
  assert.equal(f.browser.location.hash,'#weddings');assert.equal(f.nodes.get('weddingsOverview').hidden,false);
});
test('empty nostalgia grids stay compact and each upload picker accepts the selected type',async()=>{
  const f=fixture();await f.flush();assert.equal(f.grid.children.filter(n=>n.dataset.nostalgiaKind).length,0);
  for(const [kind,accept]of [['photo','image/jpeg'],['video','video/mp4'],['document','.pdf']]){
    f.upload(kind);const input=f.nodes.get('nostalgiaUploadInput');assert.equal(input.dataset.scope,'nostalgia');assert.ok(input.accept.includes(accept));
    if(kind==='video')assert.ok(!input.accept.includes('image/'));if(kind==='photo')assert.ok(!input.accept.includes('video/'));
  }
  assert.equal(f.nodes.get('nostalgiaUploadInput').clicks,3);
});


test('a wedding year displays as a year and the editor leaves unknown day and month empty',async()=>{
  const f=fixture([],{navigation:true,entryUrl:'https://family.test/#weddings/u-root',weddingDate:'1938'});await f.flush();
  assert.equal(f.nodes.get('weddingDateLabel').textContent,'שנת הנישואים · 1938');
  assert.equal(f.nodes.get('weddingYears').textContent,'ידועה רק השנה');
  f.editWeddingDate('u-root');await f.flush();
  assert.equal(f.nodes.get('weddingDay').value,'');assert.equal(f.nodes.get('weddingMonth').value,'');assert.equal(f.nodes.get('weddingYear').value,1938);
  assert.match(f.nodes.get('weddingDatePreview').textContent,/לא תישלח תזכורת/);
});


test('dropping a video opens the shared video wizard and cancelling leaves the upload queue and gallery untouched',async()=>{
 const f=fixture();await f.flush();const calls=[];f.window.FamilyVideoUpload={prepare:async(files,options)=>{calls.push({files,options});return [];}};
 const file={name:'New family film.mp4',type:'video/mp4',size:128};
 assert.equal(f.window.FamilyArchive.acceptDrop({dataTransfer:{files:[file]}}),true);await f.flush();
 assert.equal(calls.length,1);assert.equal(calls[0].options.scope,'nostalgia');assert.equal(calls[0].files[0],file);assert.equal(typeof calls[0].options.upload,'function');assert.equal(typeof calls[0].options.onSaved,'function');assert.equal(f.grid.children.filter(n=>n.dataset.mediaKind==='video').length,0);
});
