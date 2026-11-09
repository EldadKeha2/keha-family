import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {PHOTO_LABELS,photoLabels,photoLabelName} from '../public/assets/photo-labels-catalog.mjs';
import * as labelCatalog from '../public/assets/photo-labels-catalog.mjs';
const source=(await readFile(new URL('../public/assets/photo-labels.js',import.meta.url),'utf8')).replace(/^import[^\n]+\n/,'');
function fixture(english=false,{navigator={userAgent:'Mozilla/5.0 (Linux; Android 16) Mobile',userAgentData:{mobile:true}},width=430}={}){
 let viewportHeight=800,footerHeight=300,viewportWidth=width;const frames=[],styles=new Map(),classes=new Set();
 const nodes=new Map(),handlers=new Map(),listeners=new Map(),requests=[],pending=[],saved=new Map();
 const node=id=>{if(!nodes.has(id))nodes.set(id,{id,dataset:{},hidden:false,open:false,innerHTML:'',selectionStart:0,focus(){document.activeElement=this;},setSelectionRange(start){this.selectionStart=start;},querySelectorAll:()=>[],classList:{toggle(name,on){if(on)classes.add(name);else classes.delete(name);},contains:name=>classes.has(name)},style:{getPropertyValue:key=>styles.get(key),setProperty:(key,value)=>styles.set(key,value)},addEventListener:(name,fn)=>handlers.set(id+':'+name,fn),querySelector:selector=>id==='mediaViewer'?node(selector):null,getBoundingClientRect:()=>({height:id==='.media-viewer-footer'?footerHeight:id==='.face-zoom-toolbar'?70:60}),replaceChildren(){this.innerHTML='';}});return nodes.get(id);};
 const window={FamilyI18n:{isEnglish:english,error:String,fetch:async(path,options)=>{const body=JSON.parse(options.body);requests.push({path,body});return new Promise(resolve=>pending.push((ok=true)=>{const id=path.split('/')[2],labels=new Set(saved.get(id)||[]);if(body.tagged)labels.add(body.label);else labels.delete(body.label);if(ok)saved.set(id,photoLabels([...labels]));resolve(Response.json(ok?{saved:true,operation:'labels',scope:'gallery',item:{id,kind:'photo',labels:saved.get(id)}}:{error:'Save failed'},{status:ok?200:503}));}));}},FamilyApp:{apiEnabled:true},get innerHeight(){return viewportHeight;},addEventListener:(name,fn)=>{if(!listeners.has(name))listeners.set(name,[]);listeners.get(name).push(fn);},dispatchEvent:event=>{for(const fn of listeners.get(event.type)||[])fn(event);}};
 window.navigator=navigator;Object.defineProperty(node('mediaStage'),'clientWidth',{get:()=>viewportWidth});
 const document={readyState:'complete',activeElement:null,getElementById:node};
 vm.runInNewContext(source,{...labelCatalog,window,document,Response,CustomEvent,matchMedia:()=>({matches:true}),requestAnimationFrame:fn=>{frames.push(fn);return frames.length;}});
 const click=selector=>handlers.get('mediaPhotoLabels:click')({target:{closest:value=>value===selector?{}:null}}),submit=()=>handlers.get('mediaPhotoLabels:submit')({preventDefault(){},target:{matches:selector=>selector==='[data-photo-label-form]'}});
 return{requests,pending,saved,window,submit,add(name){click('[data-photo-label-toggle]');click('[data-photo-label-add]');handlers.get('mediaPhotoLabels:input')({target:{matches:()=>true,value:name}});submit();},fit(footer=300,height=800,width=viewportWidth){footerHeight=footer;viewportHeight=height;viewportWidth=width;node('mediaViewer').open=true;for(const fn of listeners.get('resize')||[])fn();for(const fn of frames.splice(0))fn();return Number.parseFloat(styles.get('--photo-fit-height'));},mount(id,labels=[]){saved.set(id,labels);window.FamilyPhotoLabels.mount({id,kind:'photo',labels});},toggle(label,checked=true){handlers.get('mediaPhotoLabels:change')({target:{dataset:{photoLabelOption:label},checked}});},get fixedFrame(){return classes.has('mobile-photo-frame');},get html(){return node('mediaPhotoLabels').innerHTML;},async reply(ok=true){pending.shift()(ok);await new Promise(resolve=>setImmediate(resolve));}};
}
test('custom labels save with escaped names, survive reopening and do not attach to the next photo',async()=>{
 const f=fixture(),name='טיולים, חוף <ים>',id=labelCatalog.photoLabelFromName(name);f.mount('custom-a');f.add(name);assert.equal(f.requests[0].body.label,id);assert.match(f.html,/טיולים, חוף &lt;ים&gt;/);f.mount('custom-b');await f.reply();assert.doesNotMatch(f.html,/photo-label-chip[^>]*>טיולים/);
 f.mount('custom-a',f.saved.get('custom-a'));assert.deepEqual(f.saved.get('custom-a'),[id]);assert.match(f.html,/photo-label-chip[^>]*>טיולים, חוף &lt;ים&gt;/);f.toggle(id,false);await f.reply();assert.deepEqual(f.saved.get('custom-a'),[]);
});
test('a failed custom label retains its draft for retry while invalid and existing labels do not write',async()=>{
 const f=fixture();f.mount('retry-custom');f.add('מסיבת משפחה');await f.reply(false);assert.match(f.html,/value="מסיבת משפחה"/);assert.match(f.html,/Save failed/);f.submit();await f.reply();assert.equal(f.saved.get('retry-custom').length,1);
 const duplicate=fixture();duplicate.mount('known',['purim']);duplicate.add('פורים');assert.equal(duplicate.requests.length,0);assert.match(duplicate.html,/כבר קיימת/);
 const invalid=fixture();invalid.mount('invalid');invalid.add(' ');assert.equal(invalid.requests.length,0);
});
test('rapid label changes are serialized and the final checkbox choices are preserved',async()=>{
 const f=fixture();f.mount('a');f.toggle('birthdays');f.toggle('holidays');f.toggle('birthdays',false);assert.equal(f.requests.length,1);await f.reply();assert.equal(f.requests.length,2);await f.reply();assert.equal(f.requests.length,3);await f.reply();
 assert.deepEqual(f.saved.get('a'),['holidays']);assert.match(f.html,/photo-label-chip[^>]*>חגים/);assert.doesNotMatch(f.html,/photo-label-chip[^>]*>ימי הולדת/);assert.equal(f.requests[2].body.tagged,false);
});
test('a late save cannot attach labels or errors to the next photo, and failed choices can be retried',async()=>{
 const f=fixture(true);f.mount('a');f.toggle('abroad');f.mount('b',['purim']);await f.reply();assert.match(f.html,/photo-label-chip[^>]*>Purim/);assert.doesNotMatch(f.html,/photo-label-chip[^>]*>Abroad/);
 f.toggle('holidays');await f.reply(false);assert.match(f.html,/Save failed/);assert.deepEqual(f.saved.get('b'),['purim']);assert.doesNotMatch(f.html,/photo-label-chip[^>]*>Holidays/);
 f.toggle('holidays');await f.reply();assert.deepEqual(f.saved.get('b'),['purim','holidays']);assert.doesNotMatch(f.html,/Save failed/);assert.match(f.html,/photo-label-chip[^>]*>Holidays/);
});

test('a long list of people cannot shrink the mobile photo, and rotation still respects the viewport',()=>{
 const f=fixture();f.mount('group-photo');const withShortList=f.fit(80),withManyPeople=f.fit(1400),withLabelsExpanded=f.fit(1800);
 assert.ok(withShortList>400,'A portrait phone reserves a large photo area');assert.equal(withManyPeople,withShortList,'Dozens of names scroll below the image instead of reducing it');assert.equal(withLabelsExpanded,withShortList,'Expanding subject labels also leaves the photo size intact');
 const landscape=f.fit(1400,360);assert.ok(landscape>100&&landscape<=360-60-70,'The photo and its controls remain usable after rotation');assert.equal(f.fit(1400,800),withShortList,'Returning to portrait restores the large photo');
});
test('phone frames stay the same across photos, respect narrow screens and do not apply to Windows touch computers',()=>{
 const phone=fixture(false,{width:360});phone.mount('wide-photo');assert.equal(phone.fixedFrame,true);assert.equal(phone.fit(),360);
 phone.mount('tall-photo',['birthdays','holidays']);assert.equal(phone.fit(1800),360,'Different photo shapes and tags reserve the same frame');
 assert.equal(phone.fit(1800,800,320),320,'Narrow phones use a square frame that fits their width');
 assert.ok(phone.fit(1800,360,780)<200,'Rotating a phone limits the frame by its shorter height');
 for(const navigator of [{userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',userAgentData:{mobile:false,platform:'Windows'},maxTouchPoints:10},{userAgent:'Mozilla/5.0 (X11; Linux x86_64)',maxTouchPoints:0}]){
  const computer=fixture(false,{navigator,width:360});computer.mount('desktop-photo');assert.equal(computer.fixedFrame,false);assert.ok(Number.isNaN(computer.fit()),'Even a narrow touch computer keeps its existing layout');
 }
});
